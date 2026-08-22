# Custom 3D Boggle Solver v2

This is the second build of the custom cube solver.

## What changed from v1

v1 treated the 27 visible letter faces as a static board.

v2 models a real **3 x 3 x 3 cube made from 27 persistent physical cubelets**.

Each cubelet stores its own face letters. If a cubelet falls to a new position, the letters assigned
to that physical cubelet stay with it.

## Features

- 27 physical cubelets.
- Same user-facing top numbering:

          3
        2   6
      1   5   9
        4   8
          7

- Left face positions 10-18.
- Right face positions 19-27.
- Enter letters directly on currently visible/exposed faces.
- Select a cubelet from a face or from the 3 physical layers.
- Manually remove the selected cubelet.
- Automatic vertical gravity in that cubelet's x/y column.
- Cubelets above a removed cubelet fall down to fill the empty position.
- Previously assigned face letters move with the cubelet.
- Newly exposed faces that have never had a letter are shown blank and highlighted for entry.
- Word finder searches the current board.
- Word lengths 8 down to 3.
- Click a word to highlight its route.
- Undo.
- Automatic local browser saving.
- Export/import cube state as JSON.
- Runs offline in Chrome; no server required.

## Important model used in v2

The game view uses three face directions:

- Top (+Z)
- Left (+Y)
- Right (+X)

For each viewing position, the solver shows the first cubelet visible from that direction.
This recreates the original 27-face board when the cube is full, while allowing different
physical cubelets to become visible after removals and gravity.

The word adjacency is calculated from actual 3D face-square geometry. On a full cube this
reproduces the same adjacency table used by the working v1 solver.

## How to run

1. Unzip the folder.
2. Open `index.html` in Chrome.
3. Enter letters on all visible faces.
4. Press **Find Words**.
5. Click a face or a cubelet in the layer view to select it.
6. Press **Remove Cxx**.
7. Gravity runs automatically.
8. Fill any newly exposed blank faces.
9. Press **Find Words** again.

## Files

- `index.html` - interface
- `solver.js` - cube model, gravity, face exposure, adjacency, word finder
- `dictionary.js` - offline SCOWL-based dictionary used by the page
- `words.txt` - same dictionary in plain-text form
- `SCOWL-Copyright.txt` - dictionary attribution/license
- `README.md` - this file

## GitHub Pages

The contents of this folder can be uploaded directly to a GitHub repository and published with GitHub Pages.
