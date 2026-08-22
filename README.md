# Custom 3D Boggle Solver v3

This build adds the visual **isometric cube** that was missing from v2.

## Features

- A real isometric cube view showing the currently visible top, left, and right faces.
- 27 persistent physical cubelets.
- Letters belong to physical cubelet faces: `top`, `left`, and `right`.
- Click a visible face on the cube and type a letter.
- Remove the selected cubelet.
- Gravity moves every cubelet above it in the same vertical column down.
- Assigned face letters stay attached to the physical cubelet when it falls.
- Newly exposed faces appear on the cube; if that face never had a letter, it is blank and ready for entry.
- Word finder searches from **8 letters down to 3**.
- Clicking a word highlights its path directly on the cube.
- Undo, reset, local browser save, export state, and import state.

## How to use

1. Unzip the folder.
2. Open `index.html` in Chrome.
3. Click a visible face on the cube and type a letter.
4. Repeat until all visible faces have letters.
5. Press **Find Words**.
6. Click a word to highlight its path.
7. Select a cubelet and press **Remove selected cubelet**.
8. Enter letters on any newly exposed blank faces.
9. Press **Find Words** again.

## Numbering

Top uses your numbering:

        3
      2   6
    1   5   9
      4   8
        7

Left positions are 10–18. Right positions are 19–27.
