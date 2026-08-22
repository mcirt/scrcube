# Custom 3D Boggle Solver v4.1

Fixes in this build:

- **Start Cube fixed and hardened.**
- Start Cube now reports exactly which position is missing if any box is empty.
- After successful Start Cube, the page automatically moves to the cube.
- Initial entry restores the fast v1 workflow:
  - first top box receives focus automatically,
  - type one letter,
  - focus advances to the next box automatically,
  - continue through all 27 letters.
- Initial entry order follows the visible board:
  `3, 2, 6, 1, 5, 9, 4, 8, 7, 10...27`.
- Backspace on an empty box moves to the previous box.
- Script cache version bumped to `v=4.1` for GitHub Pages / Safari / Chrome.
