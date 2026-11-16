# Viewer 3D

[![Français](https://img.shields.io/badge/lang-Français-blue)](README.md)

A 3D viewer that runs entirely in the browser: load a 3D file, pick the point of view and save a JPEG of that view. Handy as a position reference for AI image generation.

**👉 Open the tool: https://bagareal.github.io/viewer-3D/**

## Privacy
Files are read and converted locally, by your browser. Nothing is sent to GitHub or to any server, and the file is gone when you close the tab. Only the page's code is public.

## Supported formats
STEP / STP, IGES, GLB / GLTF, OBJ, STL.

**STEP: up to about 100 MB.** Above that the browser runs out of memory to read the file (the page warns you before trying). First convert the STEP to **GLB** with another program or an AI, keeping the parts separate: the GLB opens instantly, even when heavy, and keeps the parts list and the exploded view.

## How to use
1. **Load** a file (button or drag and drop onto the window).
2. **Move around**: hold left click to orbit, scroll to zoom, hold the wheel button (or right click) to pan.
3. **Frame**: **Rotation** free or locked to a single axis (X, Y or Z, with Reset), quick views (front, 3/4, side, high angle…), focal lengths from 24 to 105 mm, **Orientation** buttons to straighten a product that comes in lying down.
4. **Pick the parts**: the **Parts** list shows the file's tree. Untick to hide a part, **Solo** to isolate it, **Show all** to go back; hovering a name lights the part up in orange.
5. **Exploded view**: the slider moves parts away from the product's centre. **All parts** explodes everything, **Chosen parts** only the parts or groups marked ✦ in the list.
6. **Save JPEG of this view**: the image as on screen, 3000 px on the long side. White background option, floor can be hidden.

The page's **How to use** tab repeats these steps. The interface is in French, with an **EN** button to switch to English.

## Licenses and commercial use
Both libraries allow commercial use: three.js (MIT license) and occt-import-js / OpenCascade (LGPL-2.1, used unmodified, license texts included in this repository). Images saved with the tool are not covered by these licenses.

## Under the hood
- [three.js](https://threejs.org) for display.
- [occt-import-js](https://github.com/kovacsv/occt-import-js) (OpenCascade compiled to WebAssembly) to read STEP and IGES files, in a Web Worker. Licenses: `license.occt-import-js.txt` and `license.occt.txt`.
