"use strict";

/*
CUSTOM 3D BOGGLE SOLVER v2
==========================

Physical model
--------------
- The large cube is 3 x 3 x 3 = 27 persistent physical cubelets.
- Each cubelet has three game-facing letter faces:
    top   = +Z
    left  = +Y
    right = +X
- A letter belongs to the PHYSICAL CUBELET FACE, not to a board position.
- If that cubelet falls because of gravity, its assigned letters move with it.
- A newly visible face that never had a letter is blank/editable.

Gravity
-------
- Z=0 is bottom, Z=2 is top.
- Removing a cubelet compacts only its vertical (x,y) column downward.
- Relative order of remaining cubelets in the column is preserved.

Word finder
-----------
- Searches the currently visible Top + Left + Right face tiles.
- Faces are neighbors when their actual unit squares touch by side or corner.
- A face tile cannot be reused in the same word.
- 3 to 8 letters, sorted longest first.
*/

const SIZE = 3;
const MIN_LEN = 3;
const MAX_LEN = 8;
const FACE_DIRS = ["top", "left", "right"];

const DIR = {
  top:   {dx:0, dy:0, dz:1, label:"Top"},
  left:  {dx:0, dy:1, dz:0, label:"Left"},
  right: {dx:1, dy:0, dz:0, label:"Right"}
};

// User-facing face-position numbering.
// These are VIEW POSITIONS, not physical cubelet IDs.
//
// TOP:
//         3
//       2   6
//     1   5   9
//       4   8
//         7
//
// LEFT:
// 10 11 12
// 13 14 15
// 16 17 18
//
// RIGHT:
// 19 20 21
// 22 23 24
// 25 26 27

const TOP_POS = {
  1:{x:0,y:2}, 2:{x:0,y:1}, 3:{x:0,y:0},
  4:{x:1,y:2}, 5:{x:1,y:1}, 6:{x:1,y:0},
  7:{x:2,y:2}, 8:{x:2,y:1}, 9:{x:2,y:0}
};

const LEFT_POS = {
  10:{x:0,z:2}, 11:{x:1,z:2}, 12:{x:2,z:2},
  13:{x:0,z:1}, 14:{x:1,z:1}, 15:{x:2,z:1},
  16:{x:0,z:0}, 17:{x:1,z:0}, 18:{x:2,z:0}
};

const RIGHT_POS = {
  19:{y:2,z:2}, 20:{y:1,z:2}, 21:{y:0,z:2},
  22:{y:2,z:1}, 23:{y:1,z:1}, 24:{y:0,z:1},
  25:{y:2,z:0}, 26:{y:1,z:0}, 27:{y:0,z:0}
};

let state = null;
let trie = null;
let selectedCubeId = null;
let highlightedNodeKeys = new Set();
let history = [];

function key(x,y,z) {
  return `${x},${y},${z}`;
}

function cubeNumberForInitialPosition(x,y,z) {
  // Top layer C01-C09, middle C10-C18, bottom C19-C27.
  const layer = 2 - z;
  return layer * 9 + y * 3 + x + 1;
}

function newState() {
  const cubes = {};
  const occupancy = {};

  for (let z = 0; z < SIZE; z++) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const n = cubeNumberForInitialPosition(x,y,z);
        const id = `C${String(n).padStart(2,"0")}`;
        cubes[id] = {
          id,
          faces: {top:"", left:"", right:""}
        };
        occupancy[key(x,y,z)] = id;
      }
    }
  }

  return { cubes, occupancy };
}

function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

function saveLocal() {
  try {
    localStorage.setItem("custom3dBoggleV2", JSON.stringify(state));
  } catch (_) {}
}

function loadLocal() {
  try {
    const raw = localStorage.getItem("custom3dBoggleV2");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.cubes || !parsed?.occupancy) return false;
    state = parsed;
    return true;
  } catch (_) {
    return false;
  }
}

function pushHistory() {
  history.push(cloneState(state));
  if (history.length > 30) history.shift();
  document.getElementById("undoBtn").disabled = history.length === 0;
}

function setStatus(msg, type="") {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = type;
}

function getCubeAt(x,y,z) {
  return state.occupancy[key(x,y,z)] || null;
}

function findCubePosition(cubeId) {
  for (const [pos, id] of Object.entries(state.occupancy)) {
    if (id === cubeId) {
      const [x,y,z] = pos.split(",").map(Number);
      return {x,y,z};
    }
  }
  return null;
}

function faceNode(cubeId, dir, x,y,z, viewPos) {
  return {
    key: `${cubeId}:${dir}`,
    cubeId, dir, x,y,z, viewPos,
    letter: (state.cubes[cubeId]?.faces?.[dir] || "").toLowerCase()
  };
}

// "Visible/exposed" from the same corner as the original game:
// Top: highest cube in each x,y column
// Left: furthest +Y cube at each x,z
// Right: furthest +X cube at each y,z
function currentVisibleFaces() {
  const nodes = [];

  // Top view positions 1-9
  for (const [posStr, p] of Object.entries(TOP_POS)) {
    let chosen = null;
    for (let z = SIZE - 1; z >= 0; z--) {
      const id = getCubeAt(p.x,p.y,z);
      if (id) { chosen = faceNode(id, "top", p.x,p.y,z, Number(posStr)); break; }
    }
    if (chosen) nodes.push(chosen);
  }

  // Left (+Y), positions 10-18
  for (const [posStr, p] of Object.entries(LEFT_POS)) {
    let chosen = null;
    for (let y = SIZE - 1; y >= 0; y--) {
      const id = getCubeAt(p.x,y,p.z);
      if (id) { chosen = faceNode(id, "left", p.x,y,p.z, Number(posStr)); break; }
    }
    if (chosen) nodes.push(chosen);
  }

  // Right (+X), positions 19-27
  for (const [posStr, p] of Object.entries(RIGHT_POS)) {
    let chosen = null;
    for (let x = SIZE - 1; x >= 0; x--) {
      const id = getCubeAt(x,p.y,p.z);
      if (id) { chosen = faceNode(id, "right", x,p.y,p.z, Number(posStr)); break; }
    }
    if (chosen) nodes.push(chosen);
  }

  return nodes;
}

function bboxForFace(node) {
  const {x,y,z,dir} = node;
  if (dir === "top") {
    return [[x,x+1],[y,y+1],[z+1,z+1]];
  }
  if (dir === "left") {
    return [[x,x+1],[y+1,y+1],[z,z+1]];
  }
  return [[x+1,x+1],[y,y+1],[z,z+1]]; // right
}

function boxesTouch(a,b) {
  for (let axis=0; axis<3; axis++) {
    const lo = Math.max(a[axis][0], b[axis][0]);
    const hi = Math.min(a[axis][1], b[axis][1]);
    if (lo > hi) return false;
  }
  return true;
}

function buildAdjacency(nodes) {
  const adj = new Map(nodes.map(n => [n.key, []]));
  for (let i=0; i<nodes.length; i++) {
    const a = nodes[i];
    const ab = bboxForFace(a);
    for (let j=i+1; j<nodes.length; j++) {
      const b = nodes[j];
      if (boxesTouch(ab, bboxForFace(b))) {
        adj.get(a.key).push(b.key);
        adj.get(b.key).push(a.key);
      }
    }
  }
  return adj;
}

function makeTrie(words) {
  const root = Object.create(null);
  for (const raw of words || []) {
    const w = raw.trim().toLowerCase();
    if (w.length < MIN_LEN || w.length > MAX_LEN || !/^[a-z]+$/.test(w)) continue;
    let node = root;
    for (const ch of w) {
      node[ch] ??= Object.create(null);
      node = node[ch];
    }
    node.$ = true;
  }
  return root;
}

function solveCurrentBoard() {
  if (!trie) trie = makeTrie(window.BOGGLE_WORDS || []);

  const nodes = currentVisibleFaces().filter(n => /^[a-z]$/.test(n.letter));
  const byKey = new Map(nodes.map(n => [n.key,n]));
  const adj = buildAdjacency(nodes);
  const found = new Map();

  function dfs(nodeKey, trieNode, prefix, used, path) {
    const node = byKey.get(nodeKey);
    if (!node) return;
    const nextTrie = trieNode[node.letter];
    if (!nextTrie) return;

    const word = prefix + node.letter;
    const nextPath = path.concat(node);

    if (word.length >= MIN_LEN && nextTrie.$ && !found.has(word)) {
      found.set(word, nextPath);
    }
    if (word.length >= MAX_LEN) return;

    used.add(nodeKey);
    for (const nextKey of adj.get(nodeKey) || []) {
      if (!used.has(nextKey)) {
        dfs(nextKey, nextTrie, word, used, nextPath);
      }
    }
    used.delete(nodeKey);
  }

  for (const node of nodes) {
    dfs(node.key, trie, "", new Set(), []);
  }

  return [...found.entries()]
    .map(([word,path]) => ({word,path}))
    .sort((a,b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
}

function applyGravity() {
  const newOcc = {};

  for (let x=0; x<SIZE; x++) {
    for (let y=0; y<SIZE; y++) {
      const stack = [];
      for (let z=0; z<SIZE; z++) {
        const id = getCubeAt(x,y,z);
        if (id) stack.push(id);
      }
      for (let z=0; z<stack.length; z++) {
        newOcc[key(x,y,z)] = stack[z];
      }
    }
  }

  state.occupancy = newOcc;
}

function removeCube(cubeId) {
  const pos = findCubePosition(cubeId);
  if (!pos) return;

  pushHistory();
  delete state.occupancy[key(pos.x,pos.y,pos.z)];
  applyGravity();

  if (!findCubePosition(selectedCubeId)) selectedCubeId = null;
  highlightedNodeKeys.clear();
  saveLocal();
  renderAll();

  setStatus(`${cubeId} removed. Gravity applied. Any newly exposed blank faces are ready for letters.`, "ok");
}

function undo() {
  if (!history.length) return;
  state = history.pop();
  selectedCubeId = null;
  highlightedNodeKeys.clear();
  saveLocal();
  renderAll();
  setStatus("Last board change undone.", "ok");
}

function resetEverything() {
  if (!confirm("Reset all cubelets and erase every letter?")) return;
  pushHistory();
  state = newState();
  selectedCubeId = null;
  highlightedNodeKeys.clear();
  saveLocal();
  renderAll();
  clearResults();
  setStatus("Cube reset to all 27 cubelets.", "ok");
}

function facePositionElement(pos, node) {
  const wrap = document.createElement("div");
  wrap.className = "face-tile";
  wrap.dataset.viewpos = String(pos);

  if (!node) {
    wrap.classList.add("empty-face");
    wrap.innerHTML = `<span class="pos-num">${pos}</span><div class="hole">—</div><small>empty</small>`;
    return wrap;
  }

  wrap.dataset.nodekey = node.key;
  wrap.dataset.cubeid = node.cubeId;
  if (highlightedNodeKeys.has(node.key)) wrap.classList.add("path");

  const cube = state.cubes[node.cubeId];
  const val = cube.faces[node.dir] || "";
  if (!val) wrap.classList.add("needs-letter");
  if (node.cubeId === selectedCubeId) wrap.classList.add("selected");

  const badge = highlightedNodeKeys.has(node.key)
    ? `<b class="step-badge">${[...highlightedNodeKeys].indexOf(node.key)+1}</b>` : "";

  wrap.innerHTML = `
    <span class="pos-num">${pos}</span>
    ${badge}
    <input maxlength="1" value="${escapeHtml(val)}" aria-label="Position ${pos}, ${node.cubeId} ${node.dir} face">
    <small>${node.cubeId} · ${DIR[node.dir].label}</small>
  `;

  const input = wrap.querySelector("input");
  input.addEventListener("click", e => e.stopPropagation());
  input.addEventListener("focus", () => {
    selectedCubeId = node.cubeId;
    renderCubeInfo();
    document.querySelectorAll(".face-tile.selected").forEach(el => el.classList.remove("selected"));
    wrap.classList.add("selected");
    input.select();
  });
  input.addEventListener("input", () => {
    const cleaned = input.value.replace(/[^a-zA-Z]/g,"").slice(-1).toUpperCase();
    input.value = cleaned;
    cube.faces[node.dir] = cleaned;
    wrap.classList.toggle("needs-letter", !cleaned);
    highlightedNodeKeys.clear();
    saveLocal();
    clearResults();
    renderCubeInfo();
  });

  wrap.addEventListener("click", () => {
    selectedCubeId = node.cubeId;
    renderAll(false);
  });

  return wrap;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function renderFaces() {
  const nodes = currentVisibleFaces();
  const byPos = new Map(nodes.map(n => [n.viewPos,n]));

  const top = document.getElementById("topFace");
  const left = document.getElementById("leftFace");
  const right = document.getElementById("rightFace");
  top.innerHTML = ""; left.innerHTML = ""; right.innerHTML = "";

  // Diamond top rows: 3 / 2,6 / 1,5,9 / 4,8 / 7
  const rows = [[3],[2,6],[1,5,9],[4,8],[7]];
  for (const row of rows) {
    const rowEl = document.createElement("div");
    rowEl.className = `diamond-row row-${row.length}`;
    for (const pos of row) rowEl.appendChild(facePositionElement(pos, byPos.get(pos)));
    top.appendChild(rowEl);
  }

  for (let pos=10; pos<=18; pos++) left.appendChild(facePositionElement(pos, byPos.get(pos)));
  for (let pos=19; pos<=27; pos++) right.appendChild(facePositionElement(pos, byPos.get(pos)));

  const blankCount = nodes.filter(n => !(state.cubes[n.cubeId].faces[n.dir] || "")).length;
  document.getElementById("visibleCount").textContent = `${nodes.length} visible faces`;
  document.getElementById("blankCount").textContent =
    blankCount ? `${blankCount} need letter${blankCount===1?"":"s"}` : "All visible faces lettered";
}

function renderLayers() {
  const holder = document.getElementById("layers");
  holder.innerHTML = "";

  for (const z of [2,1,0]) {
    const layer = document.createElement("div");
    layer.className = "layer";
    layer.innerHTML = `<h4>${z===2?"Top":z===1?"Middle":"Bottom"} layer <span>z=${z}</span></h4>`;
    const grid = document.createElement("div");
    grid.className = "layer-grid";

    for (let y=0; y<SIZE; y++) {
      for (let x=0; x<SIZE; x++) {
        const id = getCubeAt(x,y,z);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cube-cell";
        if (!id) {
          cell.classList.add("hole-cell");
          cell.innerHTML = `<strong>—</strong><small>x${x+1} y${y+1}</small>`;
          cell.disabled = true;
        } else {
          if (id === selectedCubeId) cell.classList.add("selected");
          cell.innerHTML = `<strong>${id}</strong><small>x${x+1} y${y+1}</small>`;
          cell.addEventListener("click", () => {
            selectedCubeId = id;
            renderAll(false);
          });
        }
        grid.appendChild(cell);
      }
    }
    layer.appendChild(grid);
    holder.appendChild(layer);
  }
}

function renderCubeInfo() {
  const panel = document.getElementById("cubeInfo");
  const removeBtn = document.getElementById("removeBtn");

  if (!selectedCubeId || !findCubePosition(selectedCubeId)) {
    panel.innerHTML = `<div class="muted">Select a face or cubelet to inspect it.</div>`;
    removeBtn.disabled = true;
    removeBtn.textContent = "Remove selected cubelet";
    return;
  }

  const pos = findCubePosition(selectedCubeId);
  const cube = state.cubes[selectedCubeId];
  const visible = new Set(currentVisibleFaces()
    .filter(n => n.cubeId === selectedCubeId)
    .map(n => n.dir));

  panel.innerHTML = `
    <div class="cube-info-head">
      <strong>${selectedCubeId}</strong>
      <span>position x=${pos.x+1}, y=${pos.y+1}, z=${pos.z+1}</span>
    </div>
    <div class="mini-faces">
      ${FACE_DIRS.map(dir => `
        <div class="${visible.has(dir) ? "is-visible" : ""}">
          <span>${DIR[dir].label}</span>
          <b>${cube.faces[dir] || "—"}</b>
          <small>${visible.has(dir) ? "visible" : "hidden"}</small>
        </div>
      `).join("")}
    </div>
    <p class="hint">Letters stay attached to ${selectedCubeId} if it falls.</p>
  `;

  removeBtn.disabled = false;
  removeBtn.textContent = `Remove ${selectedCubeId}`;
}

function renderStats() {
  const remaining = Object.keys(state.occupancy).length;
  document.getElementById("cubeCount").textContent = `${remaining} / 27 cubelets`;
  document.getElementById("undoBtn").disabled = history.length === 0;
}

function renderAll(includeResultsClear=true) {
  renderFaces();
  renderLayers();
  renderCubeInfo();
  renderStats();
  if (includeResultsClear) clearResults();
}

function clearResults() {
  document.getElementById("wordCount").textContent = "";
  document.getElementById("results").innerHTML =
    `<div class="empty-results">Press <strong>Find Words</strong> after the visible faces have letters.</div>`;
  highlightedNodeKeys.clear();
}

function highlightPath(path) {
  highlightedNodeKeys = new Set(path.map(n => n.key));
  renderFaces();

  // Add exact sequence numbers after render (Set preserves path insertion order).
  path.forEach((n,i) => {
    const el = document.querySelector(`[data-nodekey="${CSS.escape(n.key)}"]`);
    if (el) {
      let badge = el.querySelector(".step-badge");
      if (!badge) {
        badge = document.createElement("b");
        badge.className = "step-badge";
        el.appendChild(badge);
      }
      badge.textContent = String(i+1);
    }
  });
}

function renderResults(results) {
  const out = document.getElementById("results");
  document.getElementById("wordCount").textContent =
    `${results.length.toLocaleString()} word${results.length===1?"":"s"} found`;
  out.innerHTML = "";

  if (!results.length) {
    out.innerHTML = `<div class="empty-results">No 3–8 letter words found.</div>`;
    return;
  }

  for (let len=MAX_LEN; len>=MIN_LEN; len--) {
    const group = results.filter(r => r.word.length === len);
    if (!group.length) continue;

    const section = document.createElement("section");
    section.className = "result-group";
    const h = document.createElement("h3");
    h.textContent = `${len}-LETTER WORDS (${group.length})`;
    section.appendChild(h);

    const list = document.createElement("div");
    list.className = "word-list";

    for (const item of group) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "word-btn";
      const route = item.path.map(n => `${n.viewPos}:${n.cubeId}`).join(" → ");
      btn.innerHTML = `<strong>${item.word.toUpperCase()}</strong><small>${route}</small>`;
      btn.addEventListener("click", () => highlightPath(item.path));
      list.appendChild(btn);
    }

    section.appendChild(list);
    out.appendChild(section);
  }
}

function runSolver() {
  const visible = currentVisibleFaces();
  const blanks = visible.filter(n => !(state.cubes[n.cubeId].faces[n.dir] || ""));

  if (blanks.length) {
    setStatus(`${blanks.length} currently visible face${blanks.length===1?" is":"s are"} blank. Fill them first so the word search is complete.`, "warn");
    const first = document.querySelector(".face-tile.needs-letter input");
    if (first) first.focus();
    return;
  }

  setStatus("Searching…");
  const results = solveCurrentBoard();
  renderResults(results);
  setStatus(`Done. Found ${results.length.toLocaleString()} words from 8 letters down to 3. Click a word to show its path.`, "ok");
}

function loadExampleLetters() {
  // Uses 27 letters from an example board only to demonstrate the UI.
  // They are assigned to the original 27 visible face positions.
  const example = {
    1:"E",2:"O",3:"A",4:"T",5:"S",6:"A",7:"Z",8:"L",9:"H",
    10:"E",11:"P",12:"R",13:"R",14:"H",15:"I",16:"I",17:"H",18:"C",
    19:"H",20:"N",21:"S",22:"S",23:"F",24:"F",25:"A",26:"A",27:"S"
  };

  pushHistory();
  for (const node of currentVisibleFaces()) {
    state.cubes[node.cubeId].faces[node.dir] = example[node.viewPos] || "";
  }
  saveLocal();
  renderAll();
  setStatus("Example letters loaded. Press Find Words.", "ok");
}

function exportState() {
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "3d-boggle-cube-state.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importState(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed?.cubes || !parsed?.occupancy) throw new Error("Not a v2 cube state.");
      pushHistory();
      state = parsed;
      selectedCubeId = null;
      highlightedNodeKeys.clear();
      saveLocal();
      renderAll();
      setStatus("Cube state imported.", "ok");
    } catch (e) {
      setStatus(`Could not import file: ${e.message}`, "warn");
    }
  };
  reader.readAsText(file);
}

function init() {
  if (!loadLocal()) state = newState();

  document.getElementById("dictionaryCount").textContent =
    `${(window.BOGGLE_WORDS || []).length.toLocaleString()} dictionary words`;

  document.getElementById("findBtn").addEventListener("click", runSolver);
  document.getElementById("removeBtn").addEventListener("click", () => {
    if (selectedCubeId) removeCube(selectedCubeId);
  });
  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("resetBtn").addEventListener("click", resetEverything);
  document.getElementById("exampleBtn").addEventListener("click", loadExampleLetters);
  document.getElementById("exportBtn").addEventListener("click", exportState);
  document.getElementById("importFile").addEventListener("change", e => {
    const f = e.target.files?.[0];
    if (f) importState(f);
    e.target.value = "";
  });

  renderAll(false);
  setStatus("Ready. Enter letters on the visible faces.");
}

document.addEventListener("DOMContentLoaded", init);
