CUSTOM 3D BOGGLE SOLVER v1
==========================

HOW TO USE
1. Unzip this folder.
2. Open index.html in Chrome.
3. Enter one letter in every numbered tile.
4. Press Solve.
5. Results are shown 8 letters first, then 7, 6, 5, 4, and 3.
6. Click any word to highlight its path on the board.

BOARD NUMBERING

TOP:
        3
      2   6
    1   5   9
      4   8
        7

LEFT:
10 11 12
13 14 15
16 17 18

RIGHT:
19 20 21
22 23 24
25 26 27

RULES USED
- Start on any tile.
- Next tile must physically touch the current tile by a side or corner.
- A tile cannot be reused in the same word.
- Minimum word length: 3
- Maximum word length: 8

DICTIONARY
- 41,634 words
- Generated from SCOWLv2 source data at size 60 or lower.
- Filtered to alphabetic 3-8 letter entries and excludes obvious names,
  abbreviations, and special non-word categories.
- This is a first-pass game dictionary. The game's own accepted-word list
  may differ, so the dictionary can be adjusted later.

IMPORTANT
The adjacency map is our current v1 map based on the board geometry we
mapped together. If we discover one cross-face connection is wrong, it can
be changed in one place at the top of solver.js.

FILES
- index.html          User interface
- solver.js           Board rules + solver engine
- dictionary.js       Offline word list
- SCOWL-Copyright.txt Dictionary attribution/license
