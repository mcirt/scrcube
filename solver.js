"use strict";

const SIZE = 3;
const MIN_LEN = 3;
const MAX_LEN = 8;
const FACE_DIRS = ["top", "left", "right"];

const DIR = {
  top:   {dx:0, dy:0, dz:1, label:"Top"},
  left:  {dx:0, dy:1, dz:0, label:"Left"},
  right: {dx:1, dy:0, dz:0, label:"Right"}
};

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
let history = [];
let selectedFaceKey = null;
let selectedCubeId = null;
let highlightedPathKeys = [];

function key(x,y,z) { return `${x},${y},${z}`; }

function cubeNumberForInitialPosition(x,y,z) {
  const layer = 2 - z;
  return layer * 9 + y * 3 + x + 1;
}

function newState() {
  const cubes = {};
  const occupancy = {};
  for (let z=0; z<SIZE; z++) {
    for (let y=0; y<SIZE; y++) {
      for (let x=0; x<SIZE; x++) {
        const n = cubeNumberForInitialPosition(x,y,z);
        const id = `C${String(n).padStart(2,"0")}`;
        cubes[id] = { id, faces: {top:"", left:"", right:""} };
        occupancy[key(x,y,z)] = id;
      }
    }
  }
  return { cubes, occupancy };
}

function cloneState(s) { return JSON.parse(JSON.stringify(s)); }

function pushHistory() {
  history.push(cloneState(state));
  if (history.length > 40) history.shift();
  updateUndoState();
}

function updateUndoState() {
  const btn = document.getElementById("undoBtn");
  if (btn) btn.disabled = history.length === 0;
}

function saveLocal() {
  try { localStorage.setItem("custom3dBoggleV3", JSON.stringify(state)); } catch (_) {}
}
function loadLocal() {
  try {
    const raw = localStorage.getItem("custom3dBoggleV3");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.cubes || !parsed?.occupancy) return false;
    state = parsed;
    return true;
  } catch (_) { return false; }
}

function setStatus(msg, cls="") {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = cls;
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

function currentVisibleFaces() {
  const nodes = [];

  for (const [posStr, p] of Object.entries(TOP_POS)) {
    let chosen = null;
    for (let z = SIZE - 1; z >= 0; z--) {
      const id = getCubeAt(p.x,p.y,z);
      if (id) { chosen = faceNode(id, "top", p.x,p.y,z, Number(posStr)); break; }
    }
    if (chosen) nodes.push(chosen);
  }

  for (const [posStr, p] of Object.entries(LEFT_POS)) {
    let chosen = null;
    for (let y = SIZE - 1; y >= 0; y--) {
      const id = getCubeAt(p.x,y,p.z);
      if (id) { chosen = faceNode(id, "left", p.x,y,p.z, Number(posStr)); break; }
    }
    if (chosen) nodes.push(chosen);
  }

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
  if (dir === "top") return [[x,x+1],[y,y+1],[z+1,z+1]];
  if (dir === "left") return [[x,x+1],[y+1,y+1],[z,z+1]];
  return [[x+1,x+1],[y,y+1],[z,z+1]];
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
    const a = nodes[i], ab = bboxForFace(a);
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

    if (word.length >= MIN_LEN && nextTrie.$ && !found.has(word)) found.set(word, nextPath);
    if (word.length >= MAX_LEN) return;

    used.add(nodeKey);
    for (const nextKey of adj.get(nodeKey) || []) {
      if (!used.has(nextKey)) dfs(nextKey, nextTrie, word, used, nextPath);
    }
    used.delete(nodeKey);
  }

  for (const node of nodes) dfs(node.key, trie, "", new Set(), []);

  return [...found.entries()]
    .map(([word, path]) => ({word, path}))
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
      for (let z=0; z<stack.length; z++) newOcc[key(x,y,z)] = stack[z];
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
  if (selectedCubeId === cubeId) selectedCubeId = null;
  if (selectedFaceKey && selectedFaceKey.startsWith(cubeId + ":")) selectedFaceKey = null;
  highlightedPathKeys = [];
  saveLocal();
  renderAll(false);
  clearResults();
  setStatus(`${cubeId} removed. Gravity applied.`, "ok");
}

function undo() {
  if (!history.length) return;
  state = history.pop();
  selectedFaceKey = null;
  selectedCubeId = null;
  highlightedPathKeys = [];
  saveLocal();
  renderAll(false);
  clearResults();
  updateUndoState();
  setStatus("Undid the last board change.", "ok");
}

function resetEverything() {
  if (!confirm("Reset the entire cube and erase all letters?")) return;
  pushHistory();
  state = newState();
  selectedFaceKey = null;
  selectedCubeId = null;
  highlightedPathKeys = [];
  saveLocal();
  renderAll(false);
  clearResults();
  setStatus("Cube reset.", "ok");
}

function loadExampleLetters() {
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
  highlightedPathKeys = [];
  renderAll(false);
  clearResults();
  setStatus("Example letters loaded.", "ok");
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "3d-boggle-cube-state.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  setStatus("State exported.", "ok");
}

function importState(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed?.cubes || !parsed?.occupancy) throw new Error("Not a valid state file.");
      pushHistory();
      state = parsed;
      selectedFaceKey = null;
      selectedCubeId = null;
      highlightedPathKeys = [];
      saveLocal();
      renderAll(false);
      clearResults();
      setStatus("State imported.", "ok");
    } catch (e) {
      setStatus(`Import failed: ${e.message}`, "warn");
    }
  };
  reader.readAsText(file);
}

function selectedNode() {
  return currentVisibleFaces().find(n => n.key === selectedFaceKey) || null;
}

function setSelectedNode(node) {
  selectedFaceKey = node ? node.key : null;
  selectedCubeId = node ? node.cubeId : null;
  renderAll(false);
}

function updateSelectedLetter(newValue) {
  const node = selectedNode();
  if (!node) return;
  const cleaned = (newValue || "").replace(/[^a-zA-Z]/g, "").slice(-1).toUpperCase();
  state.cubes[node.cubeId].faces[node.dir] = cleaned;
  saveLocal();
  highlightedPathKeys = [];
  renderAll(false);
  clearResults();
}

function clearResults() {
  document.getElementById("wordCount").textContent = "";
  document.getElementById("results").innerHTML =
    '<div class="empty-results">Press <strong>Find Words</strong> after the visible faces have letters.</div>';
}

function runSolver() {
  const visible = currentVisibleFaces();
  const blanks = visible.filter(n => !(state.cubes[n.cubeId].faces[n.dir] || ""));
  if (blanks.length) {
    setStatus(`${blanks.length} visible face${blanks.length===1 ? " is" : "s are"} blank. Fill them first.`, "warn");
    if (!selectedFaceKey && blanks[0]) setSelectedNode(blanks[0]);
    return;
  }
  setStatus("Searching…");
  const results = solveCurrentBoard();
  renderResults(results);
  setStatus(`Done. Found ${results.length.toLocaleString()} words.`, "ok");
}

function renderResults(results) {
  const out = document.getElementById("results");
  document.getElementById("wordCount").textContent =
    `${results.length.toLocaleString()} word${results.length===1 ? "" : "s"} found`;
  out.innerHTML = "";
  if (!results.length) {
    out.innerHTML = '<div class="empty-results">No 3–8 letter words found.</div>';
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
      btn.innerHTML = `<strong>${item.word.toUpperCase()}</strong><small>${item.path.map(n => n.viewPos).join(" → ")}</small>`;
      btn.addEventListener("click", () => {
        highlightedPathKeys = item.path.map(n => n.key);
        renderAll(false);
      });
      list.appendChild(btn);
    }

    section.appendChild(list);
    out.appendChild(section);
  }
}

function renderStats() {
  document.getElementById("dictionaryCount").textContent =
    `${(window.BOGGLE_WORDS || []).length.toLocaleString()} dictionary words`;
  document.getElementById("cubeCount").textContent =
    `${Object.keys(state.occupancy).length} / 27 cubelets`;
  const visible = currentVisibleFaces();
  document.getElementById("visibleCount").textContent = `${visible.length} visible faces`;
  const blanks = visible.filter(n => !(state.cubes[n.cubeId].faces[n.dir] || "")).length;
  document.getElementById("blankCount").textContent =
    blanks ? `${blanks} blank face${blanks===1 ? "" : "s"}` : "All visible faces lettered";
  updateUndoState();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

function renderInspector() {
  const holder = document.getElementById("selectionPanel");
  const removeBtn = document.getElementById("removeBtn");
  const node = selectedNode();

  if (!selectedCubeId || !findCubePosition(selectedCubeId)) {
    holder.innerHTML = '<div class="muted">Click a visible face on the cube or a cubelet in the layer view to select it.</div>';
    removeBtn.disabled = true;
    removeBtn.textContent = "Remove selected cubelet";
    return;
  }

  const cube = state.cubes[selectedCubeId];
  const pos = findCubePosition(selectedCubeId);
  const visibleDirs = currentVisibleFaces().filter(n => n.cubeId === selectedCubeId).map(n => n.dir);

  let html = `
    <div class="sel-head">
      <strong>${selectedCubeId}</strong>
      <span>x=${pos.x+1}, y=${pos.y+1}, z=${pos.z+1}</span>
    </div>
    <div class="face-mini-grid">
      ${FACE_DIRS.map(dir => `
        <div class="mini ${visibleDirs.includes(dir) ? "visible" : ""} ${node && node.dir===dir ? "active" : ""}" data-mini-dir="${dir}">
          <span>${DIR[dir].label}</span>
          <b>${cube.faces[dir] || "—"}</b>
          <small>${visibleDirs.includes(dir) ? "visible" : "hidden"}</small>
        </div>
      `).join("")}
    </div>
  `;

  if (node) {
    html += `
      <div class="selected-face-editor">
        <label>Selected face: <strong>position ${node.viewPos}</strong> · ${DIR[node.dir].label}</label>
        <div class="edit-row">
          <input id="faceLetterInput" type="text" maxlength="1" value="${escapeHtml(cube.faces[node.dir] || "")}" placeholder="A">
          <button id="clearFaceBtn" type="button">Clear face</button>
        </div>
        <p class="hint">Tip: click a visible face and type a letter. The letter stays with that physical cubelet face if it later falls.</p>
      </div>
    `;
  } else {
    html += '<p class="hint">Select one of this cubelet’s visible faces on the cube to edit that face letter.</p>';
  }

  holder.innerHTML = html;

  removeBtn.disabled = false;
  removeBtn.textContent = `Remove ${selectedCubeId}`;

  holder.querySelectorAll("[data-mini-dir]").forEach(el => {
    el.addEventListener("click", () => {
      const dir = el.dataset.miniDir;
      const n = currentVisibleFaces().find(n => n.cubeId === selectedCubeId && n.dir === dir);
      if (n) setSelectedNode(n);
    });
  });

  const input = document.getElementById("faceLetterInput");
  if (input) {
    input.addEventListener("input", () => updateSelectedLetter(input.value));
    input.addEventListener("focus", () => input.select());
  }
  const clearBtn = document.getElementById("clearFaceBtn");
  if (clearBtn) clearBtn.addEventListener("click", () => updateSelectedLetter(""));
}

function renderLayers() {
  const holder = document.getElementById("layers");
  holder.innerHTML = "";

  for (const z of [2,1,0]) {
    const layer = document.createElement("div");
    layer.className = "layer";
    layer.innerHTML = `<h4>${z===2 ? "Top" : z===1 ? "Middle" : "Bottom"} layer <span>z=${z+1}</span></h4>`;
    const grid = document.createElement("div");
    grid.className = "layer-grid";

    for (let y=0; y<SIZE; y++) {
      for (let x=0; x<SIZE; x++) {
        const id = getCubeAt(x,y,z);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "layer-cell";
        if (!id) {
          btn.classList.add("empty");
          btn.innerHTML = "<strong>—</strong><small>empty</small>";
          btn.disabled = true;
        } else {
          if (id === selectedCubeId) btn.classList.add("selected");
          btn.innerHTML = `<strong>${id}</strong><small>x${x+1} y${y+1}</small>`;
          btn.addEventListener("click", () => {
            selectedCubeId = id;
            const firstVisible = currentVisibleFaces().find(n => n.cubeId === id) || null;
            selectedFaceKey = firstVisible ? firstVisible.key : null;
            renderAll(false);
          });
        }
        grid.appendChild(btn);
      }
    }
    layer.appendChild(grid);
    holder.appendChild(layer);
  }
}

// ---------- SVG cube rendering ----------
const ORIGIN_X = 355;
const ORIGIN_Y = 180;
const VX = {x:58, y:29};
const VY = {x:-58, y:29};
const VZ = {x:0, y:-58};

function add(a,b){ return {x:a.x+b.x, y:a.y+b.y}; }
function mul(v,t){ return {x:v.x*t, y:v.y*t}; }
function project(x,y,z){
  return add(add(add({x:ORIGIN_X, y:ORIGIN_Y}, mul(VX,x)), mul(VY,y)), mul(VZ,z));
}
function pointStr(p){ return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }
function centroid(points){
  return points.reduce((acc,p) => ({x:acc.x + p.x/points.length, y:acc.y + p.y/points.length}), {x:0,y:0});
}

function facePolygon(node) {
  const {x,y,z,dir} = node;
  if (dir === "top") {
    return [
      project(x,   y,   z+1),
      project(x+1, y,   z+1),
      project(x+1, y+1, z+1),
      project(x,   y+1, z+1)
    ];
  }
  if (dir === "left") {
    return [
      project(x,   y+1, z+1),
      project(x+1, y+1, z+1),
      project(x+1, y+1, z),
      project(x,   y+1, z)
    ];
  }
  return [
    project(x+1, y,   z+1),
    project(x+1, y+1, z+1),
    project(x+1, y+1, z),
    project(x+1, y,   z)
  ];
}

function sortForDraw(nodes) {
  const sides = nodes.filter(n => n.dir !== "top")
    .sort((a,b) => (a.z + a.x + a.y) - (b.z + b.x + b.y) || a.viewPos - b.viewPos);
  const tops = nodes.filter(n => n.dir === "top")
    .sort((a,b) => (a.z + a.x + a.y) - (b.z + b.x + b.y) || a.viewPos - b.viewPos);
  return sides.concat(tops);
}

function pathStepForNode(nodeKey) {
  const idx = highlightedPathKeys.indexOf(nodeKey);
  return idx >= 0 ? idx + 1 : null;
}

function renderCubeSvg() {
  const svg = document.getElementById("cubeSvg");
  svg.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";

  const shadow = document.createElementNS(ns, "ellipse");
  shadow.setAttribute("cx", "355");
  shadow.setAttribute("cy", "365");
  shadow.setAttribute("rx", "180");
  shadow.setAttribute("ry", "52");
  shadow.setAttribute("fill", "rgba(15,23,42,0.10)");
  svg.appendChild(shadow);

  const outlineTop = [project(0,0,3), project(3,0,3), project(3,3,3), project(0,3,3)];
  const outlineLeft = [project(0,3,3), project(3,3,3), project(3,3,0), project(0,3,0)];
  const outlineRight = [project(3,0,3), project(3,3,3), project(3,3,0), project(3,0,0)];

  for (const pts of [outlineLeft, outlineRight, outlineTop]) {
    const poly = document.createElementNS(ns, "polygon");
    poly.setAttribute("points", pts.map(pointStr).join(" "));
    poly.setAttribute("class", "cube-outline");
    svg.appendChild(poly);
  }

  const visible = sortForDraw(currentVisibleFaces());
  for (const node of visible) {
    const polyPts = facePolygon(node);
    const center = centroid(polyPts);
    const blank = !(state.cubes[node.cubeId].faces[node.dir] || "");
    const isSelCube = selectedCubeId === node.cubeId;
    const isSelFace = selectedFaceKey === node.key;
    const pathStep = pathStepForNode(node.key);

    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", `svg-face svg-${node.dir}${blank ? " blank" : ""}${isSelCube ? " selected-cube" : ""}${isSelFace ? " selected-face" : ""}${pathStep ? " in-path" : ""}`);

    const poly = document.createElementNS(ns, "polygon");
    poly.setAttribute("points", polyPts.map(pointStr).join(" "));
    g.appendChild(poly);

    const num = document.createElementNS(ns, "text");
    num.setAttribute("class", "pos-label");
    num.setAttribute("x", polyPts[0].x + 15);
    num.setAttribute("y", polyPts[0].y + 16);
    num.textContent = String(node.viewPos);
    g.appendChild(num);

    const letter = document.createElementNS(ns, "text");
    letter.setAttribute("class", "letter-label");
    letter.setAttribute("x", center.x);
    letter.setAttribute("y", center.y + 10);
    letter.setAttribute("text-anchor", "middle");
    letter.textContent = state.cubes[node.cubeId].faces[node.dir] || "";
    g.appendChild(letter);

    const cubeText = document.createElementNS(ns, "text");
    cubeText.setAttribute("class", "cube-label");
    cubeText.setAttribute("x", center.x);
    cubeText.setAttribute("y", center.y + 30);
    cubeText.setAttribute("text-anchor", "middle");
    cubeText.textContent = `${node.cubeId} · ${DIR[node.dir].label}`;
    g.appendChild(cubeText);

    if (pathStep) {
      const bp = polyPts[1];
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", bp.x - 10);
      circle.setAttribute("cy", bp.y + 9);
      circle.setAttribute("r", "12");
      circle.setAttribute("class", "step-circle");
      g.appendChild(circle);

      const step = document.createElementNS(ns, "text");
      step.setAttribute("x", bp.x - 10);
      step.setAttribute("y", bp.y + 13);
      step.setAttribute("text-anchor", "middle");
      step.setAttribute("class", "step-number");
      step.textContent = String(pathStep);
      g.appendChild(step);
    }

    g.addEventListener("click", () => {
      selectedFaceKey = node.key;
      selectedCubeId = node.cubeId;
      renderAll(false);
    });

    svg.appendChild(g);
  }
}

function handleGlobalTyping(e) {
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  const typingInInput = activeTag === "input" || activeTag === "textarea";
  const node = selectedNode();
  if (!node) return;

  if (!typingInInput && /^[a-z]$/i.test(e.key)) {
    e.preventDefault();
    updateSelectedLetter(e.key);
    return;
  }
  if (!typingInInput && (e.key === "Backspace" || e.key === "Delete")) {
    e.preventDefault();
    updateSelectedLetter("");
  }
}


function renderAll(preserveStatus=true) {
  renderStats();
  renderCubeSvg();
  renderInspector();
  renderLayers();
  if (!preserveStatus) setStatus("");
}

function init() {
  if (!loadLocal()) state = newState();

  document.getElementById("findBtn").addEventListener("click", runSolver);
  document.getElementById("removeBtn").addEventListener("click", () => {
    if (selectedCubeId) removeCube(selectedCubeId);
  });
  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("resetBtn").addEventListener("click", resetEverything);
  document.getElementById("exampleBtn").addEventListener("click", loadExampleLetters);
  document.getElementById("exportBtn").addEventListener("click", exportState);
  document.getElementById("importFile").addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (file) importState(file);
    e.target.value = "";
  });
  document.addEventListener("keydown", handleGlobalTyping);

  renderAll(false);
  clearResults();
  setStatus("Ready. Click a visible face on the cube and type a letter.", "ok");
}
document.addEventListener("DOMContentLoaded", init);
