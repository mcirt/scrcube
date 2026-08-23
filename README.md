# 3D Boggle Solver v4.5

This build changes the architecture:

- Start Cube, visual cube, tap-a-face editing, removal, gravity, and undo are all inline in `index.html`.
- Those controls do NOT depend on `solver.js`.
- There is no `solver.js` in this build.
- `dictionary.js` is only used by Find Words.
- If `dictionary.js` fails to load, the cube still works and displays a dictionary warning only when Find Words is pressed.

This isolates the previous failure and makes Start Cube independent of the word-search dependency.
