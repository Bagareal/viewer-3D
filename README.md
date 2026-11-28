# Viewer 3D

A 3D viewer that runs entirely in the browser: load a 3D file, pick the point of view and save an image of that view with its masks, export a camera move as keyframes with their masks and a reference video, or place the product in a photo, in its perspective. Handy as a position reference for AI image and video generation.

**👉 Open the tool: https://bagareal.github.io/viewer-3D/**

## Privacy
Files are read and converted locally, by your browser. Nothing is sent to GitHub or to any server, and the file is gone when you close the tab. Only the page's code is public. The one exception is a STEP file above the browser limit when the page is served by a conversion server (see [Installing the conversion server](#installing-the-conversion-server-on-your-own-server-optional)): the page asks first, and the file goes only to that server.

## Supported formats
STEP / STP, IGES, GLB / GLTF, OBJ, STL. Photos for the Scene panel: JPEG, PNG, WebP.

**STEP: up to about 100 MB.** Above that the browser runs out of memory to read the file (the page warns you before trying). First convert the STEP to **GLB**, for example with [STEP2GLB](https://github.com/Bagareal/step2glb) (portable, no installation), keeping the parts separate: the GLB opens instantly, even when heavy, and keeps the parts list and the exploded view.

## How to use
1. **Load** a file (button or drag and drop onto the window).
2. **Move around**: hold left click to orbit, scroll to zoom, hold right click (or the wheel button) to pan. Click a part on the model to find it in the list.
3. **Frame** (**Photo** and **Video** tabs, same block in both): quick views (front, 3/4, side, high angle…), focal lengths from 24 to 105 mm, and an **image format** (free, 1:1, 4:5, 3:2, 16:9, 9:16) shown as a frame on screen. **Saved views** keep a framing so you can apply it to other products; they can be exported and imported as a file.
4. **Position the product**: quarter turns to straighten a product that comes in lying down, or drag to turn it on a single axis (X, Y or Z, with Reset). Axes follow the CAD convention: Z is vertical.
   The **orientation cube** at the top right turns with the view: click a face, an edge or a corner to look at the product from that side.
5. **Pick the parts**: the **Parts** list shows the file's tree, with a search box. Untick to hide a part, **Solo** to isolate it, **Show all** to go back; hovering a name lights the part up in orange.
   **Part opacity**: click a name in the list (or the part on the model), then move the **Part opacity** slider to make it see-through and show what is inside it (a clear bowl, a cover). Each part keeps its own opacity, shown next to its name; **Make all opaque again** resets them. Clicks on the model go through parts below 50%, to reach what is inside. The shaded render and its exports follow the opacity; the **Depth** map and the **Lines** drawing draw those parts solid (a part at 0% is left out).
6. **Exploded view**: like a technical exploded drawing. The largest part (the body) stays; every other part leaves along one of the product's six axes, on the side it sticks out of the body the most (a part underneath goes down, a handle on top goes up). Parts leaving on the same side keep their order, the outer ones going further, without going through each other. The directions follow the product, even turned. Parts fully inside the body leave by the nearest side, through its wall. **All parts** explodes everything, **Chosen parts** only the parts or groups marked ✦ in the list. A part always moves as one piece, even when the GLB stores it in several pieces (one per colour, or one per face in files made by STEP2GLB before 1.2).
7. **Choose the look**: shaded **Render** (neutral grey or the file's colours), **Depth** map (white = near) or **Lines** drawing. Grey, white or transparent background.
8. **Save the image** (**Photo** tab, under Export): what is inside the frame, 2000, 3000 or 4000 px on the long side. JPEG, or PNG for transparent background, depth and lines. Each image comes with two **masks**, always PNG, with the same camera, framing and size in pixels as the image: `<name>_mask.png`, the visible parts opaque on a transparent background (the main one, ready for cutting out), and `<name>_mask_bw.png`, the same in black on white. Edges are antialiased: the mask is drawn as if at twice the size, in four tiles at the image's own size with the very same camera (its view split in four), and every 2 × 2 pixels are averaged, so edge pixels get in-between values that follow how much of them the product covers. Nothing is zoomed, centred or cropped on the silhouette. Openings where the background shows through the product stay transparent (white in the black and white one). Hidden parts and the exploded view are followed. Use the masks as exported: a threshold or a selection without antialiasing brings the jagged edges back. When a part is see-through (Part opacity), `_mask.png` and `_mask_bw.png` count it as solid (a part at 0% is left out) and a third mask is added, `<name>_mask_alpha.png`: the same, where each part covers as much as it lets through in the render (a closed see-through part is crossed twice, front and back wall, so a part at 25% with nothing behind it gives about 44%). The image and its masks come in one ZIP file, `<name>.zip`.
9. **Camera moves** (**Video** tab, for AI video): 10 ready-made moves (orbits, push in, pull back, crane up, top to 3/4, side tracking, low hero, descending arc), defined relative to the product: 0° = the front view, distance 1 = whole product in the frame. Picking a move plays it at once (**Preview** to play it again), buttons 1, 2, 3 show each keyframe. Under **Export**, three buttons: **Frames** downloads the keyframes (with the chosen format, image type and size), and the two masks of each keyframe (same as for Save the image), **Video** only the MP4 reference video, **Everything** both. Each export downloads one ZIP file: `<file>_PUSH_frames.zip`, `<file>_PUSH_video.zip` or `<file>_PUSH_all.zip`. The MP4 covers the whole move (1080p or 4K, 5 s per clip, 30 fps, rendered frame by frame so it is always smooth; solid background, as MP4 has no transparency; Chrome, Edge or Brave). For push in and pull back, first click the part to aim at on the model. Inside the ZIP, file names follow the 3D file and the move: `<file>_PUSH_1.jpg`, `<file>_PUSH_1_mask.png`, `<file>_PUSH_1_mask_bw.png` (and `<file>_PUSH_1_mask_alpha.png` when a part is see-through), `<file>_PUSH_2.jpg`…, `<file>_PUSH_video.mp4` (a move of My moves uses its name).
10. **Aimed point**: by default a move aims at the middle of the product (or at the clicked part for push in and pull back). Under **Aimed point**, set the height aimed at the start and at the end of the move (0% = base, 100% = top), or click **On model** and then a point of the product (the slider then fine-tunes its height). The keyframes in between go from one point to the other, so a different start and end point gives a tilt; **Auto** gives back the move's own. Numbered dots on the view show where each keyframe aims (green = start, red = end); they never appear in the exported images.
11. **Distance**: the camera distance at the start and at the end of the move, from 10% to 250% (100% = the whole product fills the frame, less = closer, more = farther). The keyframes in between go from one distance to the other; **Auto** gives back the move's own. The camera dollies in or out: the focal length does not change, so the perspective does.
12. **My moves**: camera moves made by hand. **+ New move**, frame with the mouse and press **+ Keyframe** at each position (it is added after the selected keyframe; **Replace**, **Delete** and the **Distance** slider act on the selected one). **Aim at a point** turns the camera towards a clicked point without moving it. **Copy this move** starts from a ready-made move, with its aimed points and distances. Saved moves are relative to the product's size and front, so they fit any product; they stay in the browser and can be exported / imported as a JSON file (dropping the file on the window works too). Export works as for the ready-made moves.

13. **Product in a photo** (**Scene** panel): see the section below.

The **Help** (?) button at the bottom of the icon bar repeats these steps. The interface opens in English and is also available in French and Italian (the last language picked is remembered).

## Product in a photo (Scene panel)
Puts the grey product into a photo of a setting (a kitchen, a worktop, a table), with the photo's perspective, so that an AI can then generate the final image with the product exactly where you want it.

1. Load the 3D file, then open **Scene** and **Load a photo** (JPEG, PNG, WebP; dropping it on the window works too). The photo becomes the background, framed exactly as it will be exported, and the camera follows the photo: orbiting, the orientation cube and the camera moves are off in this panel.
2. **Perspective square**: drag the **four corners** onto a rectangle lying on the surface where the product will stand: the edges of the worktop, a tile, a table, a mat. Corners 1 to 4 go round the rectangle in order. The rectangle only has to be a real rectangle in the room: its proportions do not matter, and the product can stand beyond it, anywhere on the same plane.
   - The corners can go **anywhere, also far outside the photo** (close-ups and portrait photos often leave the corners of the surface out of the frame). The **wheel** zooms the view out and in around the pointer, **Space + drag** or the **middle button** moves it, and the bar at the bottom left has **−**, **+** and **Fit**. The zoom only changes the view on screen: the exported images are always the photo, at its size.
   - While a corner is dragged, a **magnifier** shows the photo under it with a crosshair.
   - The square's sides are carried on in dotted lines to where they meet (marked with a ring), and the **horizon** (dashed white line) and a grid inside the square show the plane it gives, under the product; untick **Grid and horizon** to hide them.
   - If the corners make a shape that crosses itself, or that cannot lie on a plane seen from above, the outline turns red and dashed, a message says so and the camera keeps its last valid position. **Reset the square** puts it back to the start.
3. **Focal length** (for a 24 × 36 sensor on the photo's short side, as everywhere in the viewer): **Auto** works it out from the square when both pairs of its sides converge in the photo. When one pair is parallel (a worktop seen straight on, its front and back edges both horizontal), it cannot be worked out: the panel says so and uses the slider, to be set by hand until the product looks right (phone photos are usually 24–30 mm). Moving the slider switches Auto off; **Auto** switches it back on.
4. **Product**: it always rests on the plane. **Drag** on the photo to slide it, **right drag** to turn it around the vertical axis, or use the **Rotation** slider; the **Size** slider makes it bigger or smaller (the wheel zooms the view). **Face the camera** turns it back towards the camera, **100%** gives back its starting size, **Back to the middle of the square** puts it back in the middle of the square. Its base stays on the same point of the photo when the corners are moved. The **Opacity** slider makes the product see-through to show what is under it; it only applies to the preview in the app, every export is always at 100%. Straighten the product first in the Product panel (front, quarter turns): that orientation is the one placed in the photo. Hidden parts and the exploded view are followed.
5. **Export the scene** downloads one ZIP file, `<file>_SCENE.zip`, with everything at the photo's size in pixels:
   - `<file>_SCENE_photo.<ext>`: the photo, the very file loaded (re-saved as JPEG at the exported size only when the photo is larger than the graphics card can render; the panel then says so).
   - `<file>_SCENE_composite.jpg`: the photo with the grey product resting on it, the input for the AI.
   - `<file>_SCENE_grey.png`: the grey product alone, on a transparent background, at its exact place (for checking the position after the AI, by laying it at 50% over the result).
   - `<file>_SCENE_mask.png` and `<file>_SCENE_mask_bw.png`: the product's silhouette, as for Save the image (opaque on transparent, and black on white; smooth edges), and `<file>_SCENE_mask_alpha.png` when a part is see-through.
   - `<file>_SCENE.json`: the square's corners, the focal length, the product's position, turn and size, and the camera (focal length, vertical field of view, world matrix).

   There are no shadows and no contact shadow on purpose: the AI makes them. The render is always the neutral grey shaded one, whatever the Look panel says.
6. **Opening a scene again**: drop the `_SCENE.json` on the window (or load it with the photo already loaded): the square, the focal length and the product's position come back. Load the same photo, or a photo with the same proportions. Files from v13 and v14 still open.

Leaving the Scene panel gives the 3D view back exactly as it was (camera, focal length, image format, look, no zoom); the photo and the scene stay ready for when you come back, until the page is closed. Nothing is stored in the browser and nothing is sent anywhere.

Limits: the camera is worked out from the photo, so the result is as accurate as the corners placed on it (a large rectangle gives a steadier result than a small one; zoom out to reach its real corners); the photo's centre is taken as the lens axis (true unless the photo was cropped off-centre); a lens with strong distortion (very wide phone lenses) bends straight lines and the grid cannot follow that. Objects in front of the product (a plant, a bowl in the foreground) are not cut out: the grey product is drawn over the photo, and the AI or the mask can take care of it.

## Versions
The version number is shown at the bottom of the right panel.
- **v1**: first version: everything described above, with the conversion server for big STEP files (see below).

## Installing the conversion server on your own server (optional)
The page opens STEP files up to about 100 MB in the browser. For bigger ones it can use a conversion server, `step2glb-server`, in this repository: it converts the file with [STEP2GLB](https://github.com/Bagareal/step2glb) and sends the GLB back. The same server also serves the viewer, so people just open its address. Nothing changes without a server, and the GitHub Pages version never uses one.

What the server does: the page sends the STEP in pieces (50 MB by default), one conversion runs at a time in a separate process (a heavy file cannot freeze the server, and a conversion that runs out of memory fails with a message), the others wait in a queue, and the files are deleted automatically: the STEP as soon as the conversion ends, the GLB after `FILE_TTL_HOURS` (2 hours by default). It asks for a shared passphrase.

**Requirements**: Linux with systemd and Python 3.10 to 3.12 (STEP2GLB does not support 3.13 yet). Tested with Python 3.12 on Ubuntu 24.04. Internet access is needed only to install and update (GitHub and PyPI).

**Install** (Debian or Ubuntu; for another system, change the first command). Replace `v1` with the release you want to install: the list is at https://github.com/Bagareal/viewer-3d/releases.

1. Packages, a user with no login for the service, and the folders:
```
sudo apt update
sudo apt install -y python3 python3-venv git
sudo useradd --system --no-create-home --shell /usr/sbin/nologin step2glb
sudo mkdir -p /opt/step2glb-server/app
```
2. The viewer and the server (they are in the same release), then the Python environment with STEP2GLB at the version fixed in `requirements.txt`:
```
sudo git clone --depth 1 --branch v1 https://github.com/Bagareal/viewer-3d.git /opt/step2glb-server/app
sudo python3 -m venv /opt/step2glb-server/venv
sudo /opt/step2glb-server/venv/bin/pip install -r /opt/step2glb-server/app/step2glb-server/requirements.txt
```
3. The settings. Open the file and change at least `PASSPHRASE` (the server does not start while it is empty or still `CHANGE_ME`). The server listens only on its own machine by default: set `HOST` as described in the table below to reach it from the network.
```
sudo install -m 600 /opt/step2glb-server/app/step2glb-server/step2glb-server.env.example /etc/step2glb-server.env
sudo nano /etc/step2glb-server.env
```
4. The service, started now and at every boot:
```
sudo cp /opt/step2glb-server/app/step2glb-server/step2glb-server.service /etc/systemd/system/step2glb-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now step2glb-server
```
5. Check that it runs (the answer is a line of JSON with `"ok":true`; use your port if you changed it), and read its log if it does not:
```
curl http://127.0.0.1:8000/api/health
sudo systemctl status step2glb-server
sudo journalctl -u step2glb-server -n 50
```

The service file expects the paths above (user `step2glb`, folder `/opt/step2glb-server`). If you install somewhere else, change `User`, `WorkingDirectory` and `ExecStart` in it.

**Settings** (in `/etc/step2glb-server.env`; after a change, `sudo systemctl restart step2glb-server`):

| Setting | Default | Meaning |
|---|---|---|
| `PASSPHRASE` | none, required | Shared passphrase asked by the viewer. Empty or `CHANGE_ME`: the server does not start. |
| `HOST` | `127.0.0.1` | Address to listen on. `127.0.0.1`: only this machine (use it behind a reverse proxy). `0.0.0.0`: every network interface. Or the machine's own address, to listen on one interface only. |
| `PORT` | `8000` | Port to listen on. |
| `DATA_DIR` | `/var/lib/step2glb-server` | Where uploads and converted files are kept. The service file creates the default folder; for another one, create it and give it to the `step2glb` user. |
| `VIEWER_DIR` | the viewer next to the server | Folder with the viewer files. Only `index.html`, `css`, `js` and `vendor` are served from it, never the rest (no `.git`, README or server files). Set but empty: no viewer, only the API. |
| `MAX_FILE_MB` | `1024` | Largest STEP accepted, in MB. |
| `CHUNK_MB` | `50` | Size of each upload piece, in MB. A reverse proxy must accept request bodies at least this big (nginx: `client_max_body_size`). |
| `MAX_ACTIVE_JOBS` | `5` | Jobs alive at the same time (uploading, waiting or converting). |
| `FILE_TTL_HOURS` | `2` | Hours a converted file is kept before it is deleted. |
| `JOB_TIMEOUT_HOURS` | `2` | Hours after which a conversion is stopped. |
| `QUALITY` | `normal` | Mesh quality: `draft`, `normal` or `fine`. |
| `CORS_ORIGINS` | empty | Addresses allowed to call the API from another website (comma separated). Leave empty when the viewer is served by this same server. |
| `TRUST_PROXY` | off | Set to `1` only behind a reverse proxy or tunnel you trust: the real client address is then read from its headers (used for the limits below). |
| `ALLOW_NO_PASSPHRASE` | off | Set to `1` to run with an empty `PASSPHRASE`, only on a network where everyone who can reach the server may use it. |

Limits per client address: 30 uploads per hour, and 10 wrong passphrases per 15 minutes.

**Update**: stop the service, move the folder to the new release, install the requirements again and start it. The settings in `/etc` stay as they are. Replace `v2` with the release you are moving to (the one after v1 will be v2):
```
sudo systemctl stop step2glb-server
sudo git -C /opt/step2glb-server/app fetch --depth 1 origin tag v2
sudo git -C /opt/step2glb-server/app checkout v2
sudo /opt/step2glb-server/venv/bin/pip install -r /opt/step2glb-server/app/step2glb-server/requirements.txt
sudo systemctl start step2glb-server
```

**Without systemd** (a quick try, or a container): from the `step2glb-server` folder, with the requirements installed in a Python environment:
```
PASSPHRASE='your passphrase' HOST=0.0.0.0 DATA_DIR=/tmp/step2glb-data python -m server
```

## What the service does on the network
- **The page** (served by the server) asks only for files stored in this repository: no CDN, no external font, no analytics, no tracking. All its requests go to the address it was opened from. Browser storage holds only saved views, saved moves and the interface language; the passphrase, if you type one, is kept for the current tab only.
- **When the page calls the server**: only when a STEP or STP file above the browser limit (about 100 MB) is opened, the page asks its own address for `/api/health` to know whether a conversion server is there. If there is one, it asks you whether to send the file to it; nothing is sent before you agree. Then it uses `/api/upload` (the pieces), `/api/jobs/<id>` (progress, every second or two), `/api/jobs/<id>/glb` (the result) and `DELETE /api/jobs/<id>`. Smaller files and every other format never leave the browser.
- **The server** makes no outgoing connection: no update check, no telemetry, no external service. The conversion runs on the machine, in a local process. The interactive API documentation is turned off.
- **Checked in a browser**: a test with the browser's developer tools (Network tab), loading the page and converting a STEP file of more than 100 MB through a running server, showed requests only to the address that hosts the service. No other host appeared, at any point. To repeat it, open the developer tools, run the conversion, and type this in the Console; the answer is a list with one address:
```js
[...new Set(performance.getEntriesByType('resource').map(e => new URL(e.name).host))]
```
- **Access**: the shared passphrase is sent in the `X-Passphrase` header, and the server speaks plain HTTP. On a company network, put it behind your reverse proxy with HTTPS, or reach it only from the internal network or through a VPN.

## Licenses and commercial use
Both libraries allow commercial use: three.js (MIT license) and occt-import-js / OpenCascade (LGPL-2.1, used unmodified). Their license texts are included in `vendor/`. Images saved with the tool are not covered by these licenses.

## Under the hood
No build step: plain HTML, CSS and JavaScript modules, with every dependency stored in the repository (the page works without any external server).
- `index.html`, `css/style.css`: the page.
- `js/viewer.js`: scene, camera, framing, render styles and image export. `js/model.js`: materials, parts list, exploded view, picking (parts and exact surface points). `js/loaders.js` and `js/step-worker.js`: file reading. `js/i18n.js`: texts. `js/moves.js`: camera moves (keyframes, aimed point, distance, keyframes from the current view). `js/video.js`: MP4 reference video (WebCodecs). `js/gizmo.js`: orientation cube. `js/zip.js`: ZIP of the camera move and scene exports (files stored as they are, no extra library). `js/scene.js`: product in a photo (grid, camera from the photo, product on the plane, scene export). `js/main.js`: interface wiring.
- Scene panel: the square's opposite sides meet at two vanishing points, the images of the plane's two directions; seen from the camera they give its rotation (made exactly perpendicular), and, when both are finite, the focal length (f² = −(x₁x₂ + y₁y₂), from the photo centre). The camera is put at a fixed height above the plane (three times the product's radius), so only the product's size in the photo is a free choice, made with Size; the product's base is kept as a point of the photo. The view's zoom and shift (`zoom2d` in `viewer.js`) move the frame on the stage and the lens axis with it (`setViewOffset`); the capture clears it, so images never depend on it. Scene JSON: `{ "viewer3d": 1, "scene": { "photo", "corners" (corners 1 to 4, [x, y] in fractions of the photo, may be below 0 or above 1), "focal": { "auto", "mm" }, "product": { "u", "v" (its base, in fractions of the photo), "rotation", "size" }, "file" }, "camera": { "focal_mm", "focal_auto", "fov_vertical_deg", "matrix_world" (three.js, Y up), "product_radius" }, "export": { "width", "height" } }`.
- Camera moves are lists of keyframes: `az` (degrees around the product, 0 = front), `el` (degrees above the aimed point), `d` (distance, 1 = whole product in the frame) and the aimed point, either `ty` (height, 0 to 1) or `t` (`[x, y, z]` inside the product's box, 0 to 1). Moves made by hand use `t`. Everything is relative to the product's size and front, so a move fits any product.
- Browser storage (`localStorage`): `viewer3d.views` (saved views), `viewer3d.moves` (my moves), `lang` (interface language). Exported files are JSON: `{ "viewer3d": 1, "views": [...] }` and `{ "viewer3d": 1, "moves": [...] }`.
- `vendor/three`: [three.js](https://threejs.org) 0.170 for display.
- `vendor/occt`: [occt-import-js](https://github.com/kovacsv/occt-import-js) (OpenCascade compiled to WebAssembly) to read STEP and IGES files, in a Web Worker.

To run it locally, serve the folder with any static server, for example `python -m http.server`, and open the address it prints.
