"""STEP to GLB conversion server for Viewer 3D.

- Upload in chunks (each request stays well under the 100 MB limit of the free Cloudflare plan).
- One conversion at a time, in a separate process (Step2GLB's own worker), so a heavy file never
  freezes the server and its memory is given back when the job ends.
- A queue, a shared passphrase, size / queue / time limits and automatic deletion of old files.
- Optionally serves the Viewer 3D files too (same address, so no CORS and no mixed content). Only the
  viewer's own files are served (index.html, css, js, vendor), never the rest of the folder.

Start it with:  python -m server   (from the step2glb-server folder)
Settings come from environment variables (see Config.from_env and step2glb-server.env.example).
"""

from __future__ import annotations

import hmac
import logging
import math
import mimetypes
import multiprocessing
import os
import re
import shutil
import threading
import time
import uuid
from collections import deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

log = logging.getLogger("step2glb-server")

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")

ID_RE = re.compile(r"^[0-9a-f]{32}$")
ACTIVE = ("uploading", "assembling", "queued", "running")
FINISHED = ("done", "error")

# The viewer is in the folder above this package (the repository root) unless VIEWER_DIR says otherwise.
DEFAULT_VIEWER_DIR = Path(__file__).resolve().parents[2]
# The only entries of that folder that are served; everything else (.git, README, this server) is not.
VIEWER_ENTRIES = frozenset({"index.html", "css", "js", "vendor"})


# ---------------------------------------------------------------- settings
@dataclass
class Config:
    data_dir: Path
    passphrase: str = ""
    max_bytes: int = 1 << 30            # biggest STEP accepted (1 GiB)
    chunk_bytes: int = 50 << 20         # size of each upload piece (50 MiB)
    max_active: int = 5                 # jobs alive at once (uploading, queued or running)
    ttl: int = 2 * 3600                 # seconds a finished job (and its GLB) is kept
    upload_ttl: int = 3600              # seconds an unfinished upload is kept
    job_timeout: int = 2 * 3600         # a conversion running longer than this is stopped
    quality: str = "normal"
    viewer_dir: Optional[Path] = None   # folder with the Viewer 3D files, served at /
    host: str = "127.0.0.1"             # address to listen on (used by python -m server)
    port: int = 8000                    # port to listen on (used by python -m server)
    cors_origins: list = field(default_factory=list)
    trust_proxy: bool = False           # read the client address from CF-Connecting-IP / X-Forwarded-For
    uploads_per_hour: int = 30          # uploads one client may start per hour
    bad_passphrase_limit: int = 10      # wrong passphrases allowed per 15 minutes
    job_target: Optional[Callable] = None  # for tests; default is step2glb.worker.run_job

    @staticmethod
    def from_env() -> "Config":
        e = os.environ
        pw = e.get("PASSPHRASE", "")
        if re.sub(r"[\s_-]", "", pw).upper() == "CHANGEME":
            raise SystemExit("PASSPHRASE is still the example value CHANGE_ME. Choose your own.")
        if not pw and e.get("ALLOW_NO_PASSPHRASE") != "1":
            raise SystemExit("Set PASSPHRASE (or ALLOW_NO_PASSPHRASE=1 to run without one).")
        viewer = e.get("VIEWER_DIR")
        if viewer is None:  # not set: the viewer next to this package, when it is there
            viewer_dir = DEFAULT_VIEWER_DIR if (DEFAULT_VIEWER_DIR / "index.html").is_file() else None
        else:  # set: that folder; set but empty: no viewer, API only
            viewer_dir = Path(viewer) if viewer else None
        return Config(
            data_dir=Path(e.get("DATA_DIR", "/var/lib/step2glb-server")),
            passphrase=pw,
            max_bytes=int(e.get("MAX_FILE_MB", "1024")) << 20,
            chunk_bytes=int(e.get("CHUNK_MB", "50")) << 20,
            max_active=int(e.get("MAX_ACTIVE_JOBS", "5")),
            ttl=int(float(e.get("FILE_TTL_HOURS", "2")) * 3600),
            job_timeout=int(float(e.get("JOB_TIMEOUT_HOURS", "2")) * 3600),
            quality=e.get("QUALITY", "normal"),
            viewer_dir=viewer_dir,
            host=e.get("HOST", "127.0.0.1"),
            port=int(e.get("PORT", "8000")),
            cors_origins=[o.strip() for o in e.get("CORS_ORIGINS", "").split(",") if o.strip()],
            trust_proxy=e.get("TRUST_PROXY") == "1",
        )


def err(status: int, code: str, message: str, **extra) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": message, **extra})


class RateLimiter:
    """Counts events per key in a sliding window."""

    def __init__(self, limit: int, window: float):
        self.limit, self.window, self.hits = limit, window, {}
        self.lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque:
        q = self.hits.setdefault(key, deque())
        while q and now - q[0] > self.window:
            q.popleft()
        return q

    def blocked(self, key: str) -> bool:
        with self.lock:
            return len(self._prune(key, time.time())) >= self.limit

    def hit(self, key: str) -> None:
        with self.lock:
            now = time.time()
            self._prune(key, now).append(now)

    def take(self, key: str) -> bool:
        """Counts one event; False when the limit is already reached."""
        with self.lock:
            now = time.time()
            q = self._prune(key, now)
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True


# ---------------------------------------------------------------- jobs
@dataclass
class Job:
    id: str
    name: str
    size: int
    chunks: int
    chunk_bytes: int
    status: str = "uploading"
    created: float = field(default_factory=time.time)
    updated: float = field(default_factory=time.time)
    started: Optional[float] = None
    finished: Optional[float] = None
    phase: Optional[str] = None
    fraction: Optional[float] = None
    code: Optional[str] = None
    error: Optional[str] = None
    glb_bytes: int = 0
    cancel: bool = False

    def chunk_len(self, n: int) -> int:
        if n < self.chunks - 1:
            return self.chunk_bytes
        return self.size - self.chunk_bytes * (self.chunks - 1)


class Manager:
    """Holds the jobs, the queue and the two background threads (worker and cleaner)."""

    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.jobs: dict[str, Job] = {}
        self.queue: deque[str] = deque()
        self.cv = threading.Condition()
        self.stopping = False
        self.proc: Optional[multiprocessing.Process] = None
        self.jobs_dir = cfg.data_dir / "jobs"

    # -- paths
    def dir(self, job_id: str) -> Path:
        return self.jobs_dir / job_id

    # -- lifecycle
    def start(self) -> None:
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
        for old in self.jobs_dir.iterdir():  # leftovers from a previous run
            shutil.rmtree(old, ignore_errors=True)
        for target in (self._worker, self._cleaner):
            threading.Thread(target=target, daemon=True).start()

    def stop(self) -> None:
        with self.cv:
            self.stopping = True
            self.cv.notify_all()
        p = self.proc
        if p is not None and p.is_alive():
            p.terminate()

    # -- helpers used by the endpoints
    def active_count(self) -> int:
        with self.cv:
            return sum(1 for j in self.jobs.values() if j.status in ACTIVE)

    def counts(self) -> tuple[int, int]:
        with self.cv:
            return (len(self.queue), sum(1 for j in self.jobs.values() if j.status == "running"))

    def add(self, job: Job) -> None:
        with self.cv:
            self.jobs[job.id] = job
        self.dir(job.id).joinpath("parts").mkdir(parents=True, exist_ok=True)

    def submit(self, job: Job) -> None:
        with self.cv:
            job.status = "queued"
            job.updated = time.time()
            self.queue.append(job.id)
            self.cv.notify_all()

    def remove(self, job: Job) -> None:
        with self.cv:
            self.jobs.pop(job.id, None)
            try:
                self.queue.remove(job.id)
            except ValueError:
                pass
        shutil.rmtree(self.dir(job.id), ignore_errors=True)

    def public(self, job: Job) -> dict:
        with self.cv:
            ahead = 0
            if job.status == "queued":
                ahead = list(self.queue).index(job.id) + sum(1 for j in self.jobs.values() if j.status == "running")
            now = time.time()
            return {
                "id": job.id,
                "status": job.status,
                "name": job.name,
                "size": job.size,
                "ahead": ahead,
                "phase": job.phase,
                "fraction": job.fraction,
                "elapsed": round(now - job.started, 1) if job.started and not job.finished else (
                    round(job.finished - job.started, 1) if job.started and job.finished else 0),
                "code": job.code,
                "error": job.error,
                "glb_bytes": job.glb_bytes,
            }

    # -- background threads
    def _worker(self) -> None:
        while True:
            with self.cv:
                while not self.queue and not self.stopping:
                    self.cv.wait(1.0)
                if self.stopping:
                    return
                job = self.jobs.get(self.queue.popleft())
                if job is None or job.status != "queued":
                    continue
                job.status = "running"
                job.started = time.time()
            try:
                self._convert(job)
            except Exception as e:  # never let the worker thread die
                log.exception("job %s crashed", job.id)
                self._finish(job, "error", code="internal", error=f"{type(e).__name__}: {e}")

    def _finish(self, job: Job, status: str, code: Optional[str] = None, error: Optional[str] = None) -> None:
        d = self.dir(job.id)
        (d / "input.stp").unlink(missing_ok=True)  # the STEP is no longer needed
        if job.cancel:
            self.remove(job)
            return
        out = d / "output.glb"
        with self.cv:
            job.status = status
            job.code, job.error = code, error
            job.finished = time.time()
            job.updated = job.finished
            job.glb_bytes = out.stat().st_size if status == "done" and out.exists() else 0

    def _convert(self, job: Job) -> None:
        from step2glb.converter import Options
        target = self.cfg.job_target
        if target is None:
            from step2glb.worker import run_job as target
        d = self.dir(job.id)
        src, dst = str(d / "input.stp"), str(d / "output.glb")
        ctx = multiprocessing.get_context("spawn")
        recv, send = ctx.Pipe(duplex=False)
        proc = ctx.Process(target=target, args=(src, dst, Options(quality=self.cfg.quality), send), daemon=True)
        t0 = time.time()
        log.info("job %s: converting %s (%.1f MB)", job.id, job.name, job.size / 1e6)
        proc.start()
        send.close()  # only the child keeps the sending end, so we see EOF when it ends
        self.proc = proc
        result: Optional[tuple] = None
        timed_out = False
        try:
            while True:
                if job.cancel or self.stopping:
                    break
                if time.time() - t0 > self.cfg.job_timeout:
                    timed_out = True
                    break
                if recv.poll(0.5):
                    try:
                        kind, data = recv.recv()
                    except EOFError:
                        break
                    if kind == "phase":
                        with self.cv:
                            job.phase, job.fraction = data[0], data[1]
                    elif kind == "log":
                        log.info("job %s: %s", job.id, data)
                    elif kind in ("ok", "error"):
                        result = (kind, data)
                        break
                elif not proc.is_alive():
                    break
        finally:
            if proc.is_alive():
                proc.terminate()
                proc.join(5)
                if proc.is_alive():
                    proc.kill()
            proc.join()
            recv.close()
            self.proc = None
        if job.cancel or self.stopping:
            self._finish(job, "error", code="cancelled", error="Cancelled")
        elif timed_out:
            self._finish(job, "error", code="timeout", error="The conversion took too long and was stopped.")
        elif result and result[0] == "ok" and os.path.exists(dst):
            log.info("job %s: done in %.0f s", job.id, time.time() - t0)
            self._finish(job, "done")
        elif result and result[0] == "error":
            self._finish(job, "error", code="convert", error=str(result[1]))
        else:
            self._finish(job, "error", code="crashed",
                         error="The conversion stopped unexpectedly (probably not enough memory for this file).")

    def _cleaner(self) -> None:
        while not self.stopping:
            time.sleep(30)
            self.clean()

    def clean(self) -> None:
        now = time.time()
        with self.cv:
            old = [j for j in self.jobs.values()
                   if (j.status in FINISHED and now - (j.finished or j.updated) > self.cfg.ttl)
                   or (j.status == "uploading" and now - j.updated > self.cfg.upload_ttl)]
        for j in old:
            log.info("job %s: removed (expired)", j.id)
            self.remove(j)


# ---------------------------------------------------------------- app
class ViewerFiles(StaticFiles):
    """Static files of the viewer, limited to VIEWER_ENTRIES and never a hidden file or folder."""

    async def get_response(self, path, scope):
        parts = [p for p in path.replace("\\", "/").split("/") if p not in ("", ".")]
        if parts and (parts[0] not in VIEWER_ENTRIES or any(p.startswith(".") for p in parts)):
            raise HTTPException(404)
        return await super().get_response(path, scope)


class UploadStart(BaseModel):
    name: str
    size: int


def create_app(cfg: Optional[Config] = None) -> FastAPI:
    cfg = cfg or Config.from_env()
    mgr = Manager(cfg)
    starts = RateLimiter(cfg.uploads_per_hour, 3600)
    wrong = RateLimiter(cfg.bad_passphrase_limit, 900)

    @asynccontextmanager
    async def lifespan(_app):
        mgr.start()
        yield
        mgr.stop()

    app = FastAPI(title="STEP2GLB server", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.manager = mgr
    if cfg.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=cfg.cors_origins,
                           allow_methods=["GET", "POST", "PUT", "DELETE"],
                           allow_headers=["X-Passphrase", "Content-Type"])

    def client_key(request: Request) -> str:
        if cfg.trust_proxy:
            ip = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            if ip:
                return ip
        return request.client.host if request.client else "?"

    def auth(request: Request, x_passphrase: Optional[str] = Header(default=None)) -> None:
        if not cfg.passphrase:
            return
        key = client_key(request)
        if wrong.blocked(key):
            raise err(429, "rate", "Too many wrong passphrases. Wait a few minutes.")
        if x_passphrase is None or not hmac.compare_digest(x_passphrase.encode("utf-8", "replace"), cfg.passphrase.encode()):
            wrong.hit(key)
            raise err(401, "auth", "Wrong passphrase.")

    def get_job(job_id: str) -> Job:
        job = mgr.jobs.get(job_id) if ID_RE.match(job_id) else None
        if job is None:
            raise err(404, "not_found", "Unknown or expired job.")
        return job

    # -- info (no passphrase: it only says whether the server is there and how it is set up)
    @app.get("/api/health")
    def health():
        try:
            from step2glb import __version__ as version
        except Exception:
            version = "?"
        queued, running = mgr.counts()
        return {"ok": True, "service": "step2glb", "version": version, "auth_required": bool(cfg.passphrase),
                "max_bytes": cfg.max_bytes, "chunk_bytes": cfg.chunk_bytes, "queued": queued, "running": running}

    # -- upload
    @app.post("/api/upload")
    def upload_start(body: UploadStart, request: Request, _=Depends(auth)):
        name = os.path.basename(body.name.replace("\\", "/")).strip()
        if not name.lower().endswith((".stp", ".step")):
            raise err(400, "bad_file", "Only .step and .stp files can be converted.")
        if body.size <= 0:
            raise err(400, "bad_file", "Empty file.")
        if body.size > cfg.max_bytes:
            raise err(413, "too_large", f"The limit is {cfg.max_bytes >> 20} MB.", max_bytes=cfg.max_bytes)
        if mgr.active_count() >= cfg.max_active:
            raise err(503, "busy", "The server is busy. Try again in a few minutes.")
        if shutil.disk_usage(cfg.data_dir).free < body.size * 2 + (1 << 30):
            raise err(507, "disk", "Not enough free space on the server.")
        if not starts.take(client_key(request)):
            raise err(429, "rate", "Too many uploads from this address. Try again later.")
        job = Job(id=uuid.uuid4().hex, name=name[:200], size=body.size, chunk_bytes=cfg.chunk_bytes,
                  chunks=math.ceil(body.size / cfg.chunk_bytes))
        mgr.add(job)
        log.info("job %s: upload started (%s, %.1f MB, %d chunks)", job.id, job.name, job.size / 1e6, job.chunks)
        return {"id": job.id, "chunks": job.chunks, "chunk_bytes": job.chunk_bytes}

    @app.put("/api/upload/{job_id}/{n}")
    async def upload_chunk(job_id: str, n: int, request: Request, _=Depends(auth)):
        job = get_job(job_id)
        if job.status != "uploading":
            raise err(409, "state", "This upload is already complete.")
        if not 0 <= n < job.chunks:
            raise err(400, "bad_chunk", "Chunk number out of range.")
        expected = job.chunk_len(n)
        parts = mgr.dir(job.id) / "parts"
        tmp, final = parts / f"{n:06d}.tmp", parts / f"{n:06d}.part"
        written = 0
        try:
            with open(tmp, "wb") as f:
                async for data in request.stream():
                    written += len(data)
                    if written > expected:
                        raise err(413, "bad_chunk", "Chunk larger than expected.")
                    f.write(data)
            if written != expected:
                raise err(400, "bad_chunk", f"Chunk {n} has {written} bytes, expected {expected}.")
            os.replace(tmp, final)
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
        job.updated = time.time()
        return {"ok": True}

    def assemble(job: Job) -> None:
        d = mgr.dir(job.id)
        with open(d / "input.stp", "wb") as out:
            for n in range(job.chunks):
                p = d / "parts" / f"{n:06d}.part"
                with open(p, "rb") as f:
                    shutil.copyfileobj(f, out, 1 << 20)
                p.unlink()
        shutil.rmtree(d / "parts", ignore_errors=True)

    @app.post("/api/upload/{job_id}/complete")
    async def upload_complete(job_id: str, _=Depends(auth)):
        job = get_job(job_id)
        with mgr.cv:
            if job.status != "uploading":
                raise err(409, "state", "This upload is already complete.")
            parts = mgr.dir(job.id) / "parts"
            missing = [n for n in range(job.chunks)
                       if not (parts / f"{n:06d}.part").is_file()
                       or (parts / f"{n:06d}.part").stat().st_size != job.chunk_len(n)]
            if missing:
                raise err(400, "incomplete", "Some chunks are missing.", missing=missing)
            job.status = "assembling"
        try:
            await run_in_threadpool(assemble, job)
            with open(mgr.dir(job.id) / "input.stp", "rb") as f:
                head = f.read(4096)
            if b"ISO-10303-21" not in head:
                raise err(400, "bad_file", "This does not look like a STEP file.")
        except BaseException:
            mgr.remove(job)
            raise
        mgr.submit(job)
        log.info("job %s: queued", job.id)
        return mgr.public(job)

    # -- jobs
    @app.get("/api/jobs/{job_id}")
    def job_status(job_id: str, _=Depends(auth)):
        return mgr.public(get_job(job_id))

    @app.get("/api/jobs/{job_id}/glb")
    def job_glb(job_id: str, _=Depends(auth)):
        job = get_job(job_id)
        path = mgr.dir(job.id) / "output.glb"
        if job.status != "done" or not path.is_file():
            raise err(409, "state", "The GLB is not ready.")
        return FileResponse(path, media_type="model/gltf-binary", filename=Path(job.name).stem + ".glb")

    @app.delete("/api/jobs/{job_id}")
    def job_delete(job_id: str, _=Depends(auth)):
        job = get_job(job_id)
        if job.status == "assembling":
            raise err(409, "state", "Busy, try again in a moment.")
        if job.status == "running":
            job.cancel = True  # the worker stops the process and cleans up
        else:
            mgr.remove(job)
        return {"ok": True}

    # -- the viewer itself
    if cfg.viewer_dir and cfg.viewer_dir.is_dir():
        log.info("serving the viewer from %s", cfg.viewer_dir)
        app.mount("/", ViewerFiles(directory=str(cfg.viewer_dir), html=True), name="viewer")

    return app
