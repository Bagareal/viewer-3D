"""Tests of the conversion server, with a real (tiny) STEP file and the real Step2GLB converter."""

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server.app import Config, create_app

PW = {"X-Passphrase": "secret"}


def make_step(path: Path) -> bytes:
    """Writes a small STEP file (two boxes) with OpenCascade and returns its bytes."""
    from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
    from OCP.STEPControl import STEPControl_AsIs, STEPControl_Writer
    from OCP.TopoDS import TopoDS_Compound
    from OCP.BRep import BRep_Builder

    comp, builder = TopoDS_Compound(), BRep_Builder()
    builder.MakeCompound(comp)
    builder.Add(comp, BRepPrimAPI_MakeBox(10, 20, 30).Shape())
    builder.Add(comp, BRepPrimAPI_MakeBox(5, 5, 5).Shape())
    w = STEPControl_Writer()
    w.Transfer(comp, STEPControl_AsIs)
    w.Write(str(path))
    return path.read_bytes()


@pytest.fixture(scope="module")
def step_bytes(tmp_path_factory):
    return make_step(tmp_path_factory.mktemp("step") / "box.step")


def make_client(tmp_path, **kw):
    viewer = tmp_path / "viewer"
    (viewer / "vendor").mkdir(parents=True, exist_ok=True)
    (viewer / "index.html").write_text("<html>viewer</html>")
    (viewer / "vendor" / "app.wasm").write_bytes(b"\0asm")
    (viewer / ".git").mkdir(exist_ok=True)
    (viewer / ".git" / "config").write_text("secret")
    (viewer / "README.md").write_text("readme")
    (viewer / "step2glb-server").mkdir(exist_ok=True)
    (viewer / "step2glb-server" / "step2glb-server.env.example").write_text("PASSPHRASE=x")
    cfg = Config(data_dir=tmp_path / "data", passphrase="secret", viewer_dir=viewer, **kw)
    return TestClient(create_app(cfg))


def upload(c, data: bytes, name="box.step", headers=PW):
    r = c.post("/api/upload", json={"name": name, "size": len(data)}, headers=headers)
    assert r.status_code == 200, r.text
    info = r.json()
    cb = info["chunk_bytes"]
    for n in range(info["chunks"]):
        r = c.put(f"/api/upload/{info['id']}/{n}", content=data[n * cb:(n + 1) * cb], headers=headers)
        assert r.status_code == 200, r.text
    return info


def wait_done(c, job_id, timeout=120):
    t0 = time.time()
    while time.time() - t0 < timeout:
        s = c.get(f"/api/jobs/{job_id}", headers=PW).json()
        if s["status"] in ("done", "error"):
            return s
        time.sleep(0.5)
    raise AssertionError("timeout")


def test_health_and_static(tmp_path):
    with make_client(tmp_path) as c:
        h = c.get("/api/health").json()
        assert h["ok"] and h["service"] == "step2glb" and h["auth_required"] is True
        assert c.get("/").text == "<html>viewer</html>"
        assert c.get("/vendor/app.wasm").headers["content-type"] == "application/wasm"


def test_only_the_viewer_files_are_served(tmp_path):
    with make_client(tmp_path) as c:
        assert c.get("/index.html").status_code == 200
        for path in ("/.git/config", "/README.md", "/step2glb-server/step2glb-server.env.example",
                     "/vendor/../README.md", "/%2e%2e/README.md", "/vendor/.hidden"):
            assert c.get(path).status_code == 404, path


def test_settings_from_environment(monkeypatch):
    for k in ("PASSPHRASE", "ALLOW_NO_PASSPHRASE", "HOST", "PORT", "VIEWER_DIR"):
        monkeypatch.delenv(k, raising=False)
    # no passphrase, or the example one: the server does not start
    with pytest.raises(SystemExit):
        Config.from_env()
    for bad in ("CHANGE_ME", "change me", " Change-Me "):
        monkeypatch.setenv("PASSPHRASE", bad)
        with pytest.raises(SystemExit):
            Config.from_env()
    # a real passphrase: defaults listen on this machine only, viewer found next to the server
    monkeypatch.setenv("PASSPHRASE", "a real one")
    cfg = Config.from_env()
    assert (cfg.host, cfg.port) == ("127.0.0.1", 8000)
    assert cfg.viewer_dir is not None and (cfg.viewer_dir / "index.html").is_file()
    monkeypatch.setenv("HOST", "0.0.0.0")
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("VIEWER_DIR", "")
    cfg = Config.from_env()
    assert (cfg.host, cfg.port, cfg.viewer_dir) == ("0.0.0.0", 9000, None)
    # no passphrase only when asked for explicitly
    monkeypatch.setenv("PASSPHRASE", "")
    monkeypatch.setenv("ALLOW_NO_PASSPHRASE", "1")
    assert Config.from_env().passphrase == ""


def test_passphrase(tmp_path):
    with make_client(tmp_path) as c:
        assert c.post("/api/upload", json={"name": "a.step", "size": 10}).status_code == 401
        assert c.post("/api/upload", json={"name": "a.step", "size": 10}, headers={"X-Passphrase": "no"}).status_code == 401
        assert c.get("/api/jobs/" + "0" * 32).status_code == 401


def test_full_flow_in_chunks(tmp_path, step_bytes):
    with make_client(tmp_path, chunk_bytes=1024) as c:
        info = upload(c, step_bytes)
        assert info["chunks"] == -(-len(step_bytes) // 1024) and info["chunks"] > 1
        r = c.post(f"/api/upload/{info['id']}/complete", headers=PW)
        assert r.status_code == 200 and r.json()["status"] in ("queued", "running")
        s = wait_done(c, info["id"])
        assert s["status"] == "done", s
        assert s["glb_bytes"] > 100
        r = c.get(f"/api/jobs/{info['id']}/glb", headers=PW)
        assert r.status_code == 200 and r.content[:4] == b"glTF"
        assert "box.glb" in r.headers["content-disposition"]
        assert len(r.content) == s["glb_bytes"]
        # the STEP copy is gone, the GLB stays until deleted
        d = tmp_path / "data" / "jobs" / info["id"]
        assert not (d / "input.stp").exists() and (d / "output.glb").exists()
        assert c.delete(f"/api/jobs/{info['id']}", headers=PW).status_code == 200
        assert not d.exists()
        assert c.get(f"/api/jobs/{info['id']}", headers=PW).status_code == 404


def test_bad_requests(tmp_path, step_bytes):
    with make_client(tmp_path, chunk_bytes=1024, max_bytes=len(step_bytes) + 10) as c:
        assert c.post("/api/upload", json={"name": "a.txt", "size": 10}, headers=PW).status_code == 400
        assert c.post("/api/upload", json={"name": "a.step", "size": 0}, headers=PW).status_code == 400
        r = c.post("/api/upload", json={"name": "a.step", "size": len(step_bytes) + 11}, headers=PW)
        assert r.status_code == 413 and r.json()["detail"]["code"] == "too_large"
        # path tricks in ids and names
        assert c.get("/api/jobs/../../etc/passwd", headers=PW).status_code in (404, 405)
        assert c.get("/api/jobs/" + "g" * 32, headers=PW).status_code == 404
        r = c.post("/api/upload", json={"name": "../../x/evil.step", "size": 100}, headers=PW)
        assert r.status_code == 200
        c.delete(f"/api/jobs/{r.json()['id']}", headers=PW)
        # wrong chunk size, chunk out of range, missing chunks, not a STEP
        info = c.post("/api/upload", json={"name": "a.step", "size": 2500}, headers=PW).json()
        assert info["chunks"] == 3
        assert c.put(f"/api/upload/{info['id']}/0", content=b"x" * 10, headers=PW).status_code == 400
        assert c.put(f"/api/upload/{info['id']}/0", content=b"x" * 2000, headers=PW).status_code == 413
        assert c.put(f"/api/upload/{info['id']}/9", content=b"x", headers=PW).status_code == 400
        r = c.post(f"/api/upload/{info['id']}/complete", headers=PW)
        assert r.status_code == 400 and r.json()["detail"]["missing"] == [0, 1, 2]
        for n, size in enumerate((1024, 1024, 452)):
            assert c.put(f"/api/upload/{info['id']}/{n}", content=b"x" * size, headers=PW).status_code == 200
        r = c.post(f"/api/upload/{info['id']}/complete", headers=PW)
        assert r.status_code == 400 and r.json()["detail"]["code"] == "bad_file"
        assert c.get(f"/api/jobs/{info['id']}", headers=PW).status_code == 404  # removed
        # the GLB of an unfinished job
        info = c.post("/api/upload", json={"name": "a.step", "size": 10}, headers=PW).json()
        assert c.get(f"/api/jobs/{info['id']}/glb", headers=PW).status_code == 409


def test_busy_and_rate(tmp_path):
    with make_client(tmp_path, max_active=2, uploads_per_hour=3) as c:
        a = c.post("/api/upload", json={"name": "a.step", "size": 10}, headers=PW)
        b = c.post("/api/upload", json={"name": "b.step", "size": 10}, headers=PW)
        assert a.status_code == b.status_code == 200
        r = c.post("/api/upload", json={"name": "c.step", "size": 10}, headers=PW)
        assert r.status_code == 503 and r.json()["detail"]["code"] == "busy"
        c.delete(f"/api/jobs/{a.json()['id']}", headers=PW)
        assert c.post("/api/upload", json={"name": "c.step", "size": 10}, headers=PW).status_code == 200
        c.delete(f"/api/jobs/{b.json()['id']}", headers=PW)
        r = c.post("/api/upload", json={"name": "d.step", "size": 10}, headers=PW)
        assert r.status_code == 429 and r.json()["detail"]["code"] == "rate"


def test_wrong_passphrase_lockout(tmp_path):
    with make_client(tmp_path, bad_passphrase_limit=3) as c:
        for _ in range(3):
            assert c.get("/api/jobs/" + "0" * 32, headers={"X-Passphrase": "bad"}).status_code == 401
        assert c.get("/api/jobs/" + "0" * 32, headers={"X-Passphrase": "bad"}).status_code == 429
        assert c.get("/api/jobs/" + "0" * 32, headers=PW).status_code == 429  # the same address stays blocked for a while


def test_queue_position_and_cancel(tmp_path, step_bytes):
    with make_client(tmp_path) as c:
        first = upload(c, step_bytes)
        c.post(f"/api/upload/{first['id']}/complete", headers=PW)
        second = upload(c, step_bytes)
        r = c.post(f"/api/upload/{second['id']}/complete", headers=PW).json()
        assert r["status"] == "queued" and r["ahead"] >= 1
        # cancel the queued one: it disappears
        assert c.delete(f"/api/jobs/{second['id']}", headers=PW).status_code == 200
        assert c.get(f"/api/jobs/{second['id']}", headers=PW).status_code == 404
        assert wait_done(c, first["id"])["status"] == "done"


def test_cancel_running(tmp_path, step_bytes):
    with make_client(tmp_path) as c:
        info = upload(c, step_bytes)
        c.post(f"/api/upload/{info['id']}/complete", headers=PW)
        t0 = time.time()
        while c.get(f"/api/jobs/{info['id']}", headers=PW).json()["status"] != "running":
            assert time.time() - t0 < 30
            time.sleep(0.05)
        assert c.delete(f"/api/jobs/{info['id']}", headers=PW).status_code == 200
        t0 = time.time()
        while c.get(f"/api/jobs/{info['id']}", headers=PW).status_code != 404:  # removed once the process stops
            assert time.time() - t0 < 30
            time.sleep(0.2)
        assert not (tmp_path / "data" / "jobs" / info["id"]).exists()


def test_cleanup_of_old_jobs(tmp_path, step_bytes):
    with make_client(tmp_path, ttl=1) as c:
        info = upload(c, step_bytes)
        c.post(f"/api/upload/{info['id']}/complete", headers=PW)
        assert wait_done(c, info["id"])["status"] == "done"
        time.sleep(1.2)
        c.app.state.manager.clean()
        assert c.get(f"/api/jobs/{info['id']}", headers=PW).status_code == 404
        assert not (tmp_path / "data" / "jobs" / info["id"]).exists()


def test_job_that_fails_reports_an_error(tmp_path):
    """A file with a STEP header but no geometry: the job ends in error, the server goes on."""
    bad = b"ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"
    with make_client(tmp_path) as c:
        info = upload(c, bad)
        c.post(f"/api/upload/{info['id']}/complete", headers=PW)
        s = wait_done(c, info["id"])
        assert s["status"] == "error" and s["error"]
        assert c.get(f"/api/jobs/{info['id']}/glb", headers=PW).status_code == 409
        assert c.get("/api/health").json()["ok"]
