# Viewer 3D

A 3D viewer that runs entirely in the browser: load a 3D file, pick the point of view and save an image of that view with its masks, or export a camera move as keyframes with their masks and a reference video. Handy as a position reference for AI image and video generation.

**👉 Open the tool: https://bagareal.github.io/viewer-3D/**

## Privacy
Files are read and converted locally, by your browser. Nothing is sent to GitHub or to any server, and the file is gone when you close the tab. Only the page's code is public.

## Supported formats
STEP / STP, IGES, GLB / GLTF, OBJ, STL.

**STEP: up to about 100 MB.** Above that the browser runs out of memory to read the file (the page warns you before trying). First convert the STEP to **GLB**, for example with [STEP2GLB](https://github.com/Bagareal/step2glb) (portable, no installation), keeping the parts separate: the GLB opens instantly, even when heavy, and keeps the parts list and the exploded view.

## How to use
1. **Load** a file (button or drag and drop onto the window).
2. **Move around**: hold left click to orbit, scroll to zoom, hold right click (or the wheel button) to pan. Click a part on the model to find it in the list.
3. **Frame**: quick views (front, 3/4, side, high angle…), focal lengths from 24 to 105 mm, and an **image format** (free, 1:1, 4:5, 3:2, 16:9, 9:16) shown as a frame on screen. **Saved views** keep a framing so you can apply it to other products; they can be exported and imported as a file.
4. **Position the product**: quarter turns to straighten a product that comes in lying down, or drag to turn it on a single axis (X, Y or Z, with Reset). Axes follow the CAD convention: Z is vertical.
   The **orientation cube** at the top right turns with the view: click a face, an edge or a corner to look at the product from that side.
5. **Pick the parts**: the **Parts** list shows the file's tree, with a search box. Untick to hide a part, **Solo** to isolate it, **Show all** to go back; hovering a name lights the part up in orange.
6. **Exploded view**: like a technical exploded drawing. The largest part (the body) stays; every other part leaves along one of the product's six axes, on the side it sticks out of the body the most (a part underneath goes down, a handle on top goes up). Parts leaving on the same side keep their order, the outer ones going further, without going through each other. The directions follow the product, even turned. Parts fully inside the body leave by the nearest side, through its wall. **All parts** explodes everything, **Chosen parts** only the parts or groups marked ✦ in the list. A part always moves as one piece, even when the GLB stores it in several pieces (one per colour, or one per face in files made by STEP2GLB before 1.2).
7. **Choose the look**: shaded **Render** (neutral grey or the file's colours), **Depth** map (white = near) or **Lines** drawing. Grey, white or transparent background.
8. **Save the image** (Camera panel, under Export): what is inside the frame, 2000, 3000 or 4000 px on the long side. JPEG, or PNG for transparent background, depth and lines. Each image comes with two **masks**, always PNG, with the same camera, framing and size in pixels as the image: `<name>_mask.png`, the visible parts opaque on a transparent background (the main one, ready for cutting out), and `<name>_mask_bw.png`, the same in black on white. Edges are antialiased: the mask is drawn as if at twice the size, in four tiles at the image's own size with the very same camera (its view split in four), and every 2 × 2 pixels are averaged, so edge pixels get in-between values that follow how much of them the product covers. Nothing is zoomed, centred or cropped on the silhouette. Openings where the background shows through the product stay transparent (white in the black and white one). Hidden parts and the exploded view are followed. Use the masks as exported: a threshold or a selection without antialiasing brings the jagged edges back.
9. **Camera moves** (for AI video): 10 ready-made moves (orbits, push in, pull back, crane up, top to 3/4, side tracking, low hero, descending arc), defined relative to the product: 0° = the front view, distance 1 = whole product in the frame. Picking a move plays it at once (**Preview** to play it again), buttons 1, 2, 3 show each keyframe. Under **Export**, three buttons: **Frames** downloads the keyframes (with the chosen format, image type and size), and the two masks of each keyframe (same as for Save the image), **Video** only the MP4 reference video, **Everything** both. The MP4 covers the whole move (1080p or 4K, 5 s per clip, 30 fps, rendered frame by frame so it is always smooth; solid background, as MP4 has no transparency; Chrome, Edge or Brave). For push in and pull back, first click the part to aim at on the model. File names follow the 3D file and the move: `<file>_PUSH_1.jpg`, `<file>_PUSH_1_mask.png`, `<file>_PUSH_1_mask_bw.png`, `<file>_PUSH_2.jpg`…, `<file>_PUSH_video.mp4` (a move of My moves uses its name).
10. **Aimed point**: by default a move aims at the middle of the product (or at the clicked part for push in and pull back). Under **Aimed point**, set the height aimed at the start and at the end of the move (0% = base, 100% = top), or click **On model** and then a point of the product (the slider then fine-tunes its height). The keyframes in between go from one point to the other, so a different start and end point gives a tilt; **Auto** gives back the move's own. Numbered dots on the view show where each keyframe aims (green = start, red = end); they never appear in the exported images.
11. **Distance**: the camera distance at the start and at the end of the move, from 10% to 250% (100% = the whole product fills the frame, less = closer, more = farther). The keyframes in between go from one distance to the other; **Auto** gives back the move's own. The camera dollies in or out: the focal length does not change, so the perspective does.
12. **My moves**: camera moves made by hand. **+ New move**, frame with the mouse and press **+ Keyframe** at each position (it is added after the selected keyframe; **Replace**, **Delete** and the **Distance** slider act on the selected one). **Aim at a point** turns the camera towards a clicked point without moving it. **Copy this move** starts from a ready-made move, with its aimed points and distances. Saved moves are relative to the product's size and front, so they fit any product; they stay in the browser and can be exported / imported as a JSON file (dropping the file on the window works too). Export works as for the ready-made moves.

The **Help** (?) button at the bottom of the icon bar repeats these steps. The interface opens in English and is also available in French and Italian (the last language picked is remembered).

## Versions
The version number is shown at the bottom of the icon bar.
- **v11**: no more `_seedance.txt` prompt file with the keyframes.
- **v10**: masks again exactly on the image (v9 enlarged the canvas to twice the size for the antialiasing; when the graphics card refused that size, the browser silently used a smaller one and the mask came out zoomed in and shifted up and to the right).
- **v9**: antialiased masks; `_mask.png` is now the product opaque on a transparent background, `_mask_bw.png` the same in black on white.
- **v8**: a black and white mask (`_mask.png`, hard edges) with every saved image and every exported keyframe.
- **v7**: camera distance at the start and at the end of the ready-made moves; distance slider for each keyframe of the moves made by hand.
- **v6**: aimed point at the start and at the end of the ready-made moves (height slider or a point clicked on the model), markers on the view, moves made by hand with keyframes (My moves), JSON export / import.
- **v5**: export section in the Camera panel, English README and interface by default.

Each version is one commit on `main`. To go back, undo the commits of the newer versions with `git revert` (the history stays, and the undo can be undone the same way), then push: GitHub Pages publishes the result within a few minutes. For example, back to v10: `git revert --no-edit <v11 commit>`, then `git push origin main`.

## Licenses and commercial use
Both libraries allow commercial use: three.js (MIT license) and occt-import-js / OpenCascade (LGPL-2.1, used unmodified). Their license texts are included in `vendor/`. Images saved with the tool are not covered by these licenses.

## Under the hood
No build step: plain HTML, CSS and JavaScript modules, with every dependency stored in the repository (the page works without any external server).
- `index.html`, `css/style.css`: the page.
- `js/viewer.js`: scene, camera, framing, render styles and image export. `js/model.js`: materials, parts list, exploded view, picking (parts and exact surface points). `js/loaders.js` and `js/step-worker.js`: file reading. `js/i18n.js`: texts. `js/moves.js`: camera moves (keyframes, aimed point, distance, keyframes from the current view). `js/video.js`: MP4 reference video (WebCodecs). `js/gizmo.js`: orientation cube. `js/main.js`: interface wiring.
- Camera moves are lists of keyframes: `az` (degrees around the product, 0 = front), `el` (degrees above the aimed point), `d` (distance, 1 = whole product in the frame) and the aimed point, either `ty` (height, 0 to 1) or `t` (`[x, y, z]` inside the product's box, 0 to 1). Moves made by hand use `t`. Everything is relative to the product's size and front, so a move fits any product.
- Browser storage (`localStorage`): `viewer3d.views` (saved views), `viewer3d.moves` (my moves), `lang` (interface language). Exported files are JSON: `{ "viewer3d": 1, "views": [...] }` and `{ "viewer3d": 1, "moves": [...] }`.
- `vendor/three`: [three.js](https://threejs.org) 0.170 for display.
- `vendor/occt`: [occt-import-js](https://github.com/kovacsv/occt-import-js) (OpenCascade compiled to WebAssembly) to read STEP and IGES files, in a Web Worker.

To run it locally, serve the folder with any static server, for example `python -m http.server`, and open the address it prints.
