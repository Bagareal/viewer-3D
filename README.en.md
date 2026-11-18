# Viewer 3D

[![Français](https://img.shields.io/badge/lang-Français-blue)](README.md)

A 3D viewer that runs entirely in the browser: load a 3D file, pick the point of view and save an image of that view. Handy as a position reference for AI image generation.

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
6. **Exploded view**: the slider moves parts away from the product's centre. **All parts** explodes everything, **Chosen parts** only the parts or groups marked ✦ in the list. A part always moves as one piece, even when the GLB stores it in several pieces (one per colour, or one per face in files made by STEP2GLB before 1.2).
7. **Choose the look**: shaded **Render** (neutral grey or the file's colours), **Depth** map (white = near) or **Lines** drawing. Grey, white or transparent background.
8. **Save the image**: what is inside the frame, 2000, 3000 or 4000 px on the long side. JPEG, or PNG for transparent background, depth and lines.
9. **Camera moves** (for AI video): 10 ready-made moves (orbits, push in, pull back, crane up, top to 3/4, side tracking, low hero, descending arc), defined relative to the product: 0° = the front view, distance 1 = whole product in the frame. Picking a move plays it at once (**Preview** to play it again), buttons 1, 2, 3 show each keyframe, **Export frames and video** downloads the keyframes (with the chosen format, image type and size), an MP4 reference video of the whole move (1080p or 4K, 5 s per clip, 30 fps, rendered frame by frame so it is always smooth; solid background, as MP4 has no transparency; Chrome, Edge or Brave) and a `_seedance.txt` file: one first-frame → last-frame clip per pair of frames, with the camera prompt in English. For push in and pull back, first click the part to aim at on the model.

The page's **How to use** tab repeats these steps. The interface is available in French, English and Italian.

## Licenses and commercial use
Both libraries allow commercial use: three.js (MIT license) and occt-import-js / OpenCascade (LGPL-2.1, used unmodified). Their license texts are included in `vendor/`. Images saved with the tool are not covered by these licenses.

## Under the hood
No build step: plain HTML, CSS and JavaScript modules, with every dependency stored in the repository (the page works without any external server).
- `index.html`, `css/style.css`: the page.
- `js/viewer.js`: scene, camera, framing, render styles and image export. `js/model.js`: materials, parts list, exploded view, picking. `js/loaders.js` and `js/step-worker.js`: file reading. `js/i18n.js`: texts. `js/moves.js`: camera moves and the prompt file. `js/main.js`: interface wiring.
- `vendor/three`: [three.js](https://threejs.org) 0.170 for display.
- `vendor/occt`: [occt-import-js](https://github.com/kovacsv/occt-import-js) (OpenCascade compiled to WebAssembly) to read STEP and IGES files, in a Web Worker.

To run it locally, serve the folder with any static server, for example `python -m http.server`, and open the address it prints.
