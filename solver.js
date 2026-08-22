"use strict";

/*
  Custom 3D Boggle Solver v1

  Board numbering:
  TOP (as viewed in the user's cube):
          3
        2   6
      1   5   9
        4   8
          7

  LEFT:  10 11 12 / 13 14 15 / 16 17 18
  RIGHT: 19 20 21 / 22 23 24 / 25 26 27

  Rule: next tile may touch by side OR corner.
  A tile may not be used twice in the same word.
*/

const NEIGHBORS = {
  1:[2,4,5,10,11],
  2:[1,3,4,5,6],
  3:[2,5,6],
  4:[1,2,5,7,8,10,11,12],
  5:[1,2,3,4,6,7,8,9],
  6:[2,3,5,8,9],
  7:[4,5,8,11,12,19,20],
  8:[4,5,6,7,9,19,20,21],
  9:[5,6,8,20,21],

  10:[1,4,11,13,14],
  11:[1,4,7,10,12,13,14,15],
  12:[4,7,11,14,15,19,22],
  13:[10,11,14,16,17],
  14:[10,11,12,13,15,16,17,18],
  15:[11,12,14,17,18,19,22,25],
  16:[13,14,17],
  17:[13,14,15,16,18],
  18:[14,15,17,22,25],

  19:[7,8,12,15,20,22,23],
  20:[7,8,9,19,21,22,23,24],
  21:[8,9,20,23,24],
  22:[12,15,18,19,20,23,25,26],
  23:[19,20,21,22,24,25,26,27],
  24:[20,21,23,26,27],
  25:[15,18,22,23,26],
  26:[22,23,24,25,27],
  27:[23,24,26]
};

const MIN_LEN = 3;
const MAX_LEN = 8;

function makeTrie(words) {
  const root = Object.create(null);
  for (const raw of words) {
    const word = raw.trim().toLowerCase();
    if (word.length < MIN_LEN || word.length > MAX_LEN) continue;
    let node = root;
    for (const ch of word) {
      node[ch] ??= Object.create(null);
      node = node[ch];
    }
    node.$ = true;
  }
  return root;
}

let TRIE = null;

function getBoard() {
  const board = {};
  for (let i = 1; i <= 27; i++) {
    const el = document.querySelector(`[data-tile="${i}"] input`);
    const value = (el?.value || "").trim().toLowerCase();
    if (!/^[a-z]$/.test(value)) {
      throw new Error(`Tile ${i} needs exactly one letter.`);
    }
    board[i] = value;
  }
  return board;
}

function solveBoard(board) {
  if (!TRIE) TRIE = makeTrie(window.BOGGLE_WORDS || []);

  const found = new Map(); // word -> first path

  function dfs(tile, trieNode, prefix, used, path) {
    const ch = board[tile];
    const next = trieNode[ch];
    if (!next) return;

    const word = prefix + ch;
    const nextPath = path.concat(tile);

    if (word.length >= MIN_LEN && next.$ && !found.has(word)) {
      found.set(word, nextPath);
    }

    if (word.length >= MAX_LEN) return;

    used.add(tile);
    for (const n of NEIGHBORS[tile]) {
      if (!used.has(n)) {
        dfs(n, next, word, used, nextPath);
      }
    }
    used.delete(tile);
  }

  for (let tile = 1; tile <= 27; tile++) {
    dfs(tile, TRIE, "", new Set(), []);
  }

  return [...found.entries()]
    .map(([word, path]) => ({word, path}))
    .sort((a, b) =>
      b.word.length - a.word.length ||
      a.word.localeCompare(b.word)
    );
}

function clearHighlights() {
  document.querySelectorAll(".tile").forEach(el => {
    el.classList.remove("path");
    el.removeAttribute("data-step");
  });
}

function showPath(path) {
  clearHighlights();
  path.forEach((tile, idx) => {
    const el = document.querySelector(`[data-tile="${tile}"]`);
    if (el) {
      el.classList.add("path");
      el.dataset.step = String(idx + 1);
    }
  });
}

function renderResults(results) {
  const resultsEl = document.getElementById("results");
  const countEl = document.getElementById("wordCount");
  countEl.textContent = `${results.length.toLocaleString()} word${results.length === 1 ? "" : "s"} found`;

  resultsEl.innerHTML = "";
  clearHighlights();

  if (!results.length) {
    resultsEl.innerHTML = `<div class="empty">No 3–8 letter words found.</div>`;
    return;
  }

  for (let len = MAX_LEN; len >= MIN_LEN; len--) {
    const group = results.filter(r => r.word.length === len);
    if (!group.length) continue;

    const section = document.createElement("section");
    section.className = "result-group";

    const heading = document.createElement("h3");
    heading.textContent = `${len}-letter words (${group.length})`;
    section.appendChild(heading);

    const list = document.createElement("div");
    list.className = "word-list";

    for (const item of group) {
      const btn = document.createElement("button");
      btn.className = "word";
      btn.type = "button";
      btn.innerHTML = `<span>${item.word.toUpperCase()}</span><small>${item.path.join(" → ")}</small>`;
      btn.addEventListener("click", () => showPath(item.path));
      list.appendChild(btn);
    }

    section.appendChild(list);
    resultsEl.appendChild(section);
  }
}

function solve() {
  const status = document.getElementById("status");
  try {
    status.textContent = "Solving…";
    const board = getBoard();
    const results = solveBoard(board);
    renderResults(results);
    status.textContent = "Done. Click any word to highlight its tile path.";
  } catch (err) {
    status.textContent = err.message;
  }
}

function clearBoard() {
  document.querySelectorAll(".tile input").forEach(input => input.value = "");
  document.getElementById("results").innerHTML = `<div class="empty">Enter all 27 letters, then press Solve.</div>`;
  document.getElementById("wordCount").textContent = "";
  document.getElementById("status").textContent = "";
  clearHighlights();
  document.querySelector('[data-tile="1"] input')?.focus();
}

function fillExample() {
  // Simple test board; not intended to match a real puzzle.
  const letters = "catersinopldguhbmwyfvxqjkza";
  for (let i = 1; i <= 27; i++) {
    document.querySelector(`[data-tile="${i}"] input`).value = letters[i-1] || "e";
  }
  document.getElementById("status").textContent = "Example letters loaded.";
}

function wireInputs() {
  const inputs = [...document.querySelectorAll(".tile input")];
  inputs.forEach((input, idx) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^a-zA-Z]/g, "").slice(-1).toUpperCase();
      if (input.value && inputs[idx + 1]) inputs[idx + 1].focus();
    });
    input.addEventListener("focus", () => input.select());
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireInputs();
  document.getElementById("solveBtn").addEventListener("click", solve);
  document.getElementById("clearBtn").addEventListener("click", clearBoard);
  document.getElementById("exampleBtn").addEventListener("click", fillExample);
  document.getElementById("dictionaryCount").textContent =
    `${(window.BOGGLE_WORDS || []).length.toLocaleString()} dictionary words`;
});
