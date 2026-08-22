
"use strict";

var SIZE = 3;
var MIN_LEN = 3;
var MAX_LEN = 8;

var DIR = {
  top:   {label:"Top"},
  left:  {label:"Left"},
  right: {label:"Right"}
};

var TOP_POS = {
  1:{x:0,y:2}, 2:{x:0,y:1}, 3:{x:0,y:0},
  4:{x:1,y:2}, 5:{x:1,y:1}, 6:{x:1,y:0},
  7:{x:2,y:2}, 8:{x:2,y:1}, 9:{x:2,y:0}
};
var LEFT_POS = {
  10:{x:0,z:2}, 11:{x:1,z:2}, 12:{x:2,z:2},
  13:{x:0,z:1}, 14:{x:1,z:1}, 15:{x:2,z:1},
  16:{x:0,z:0}, 17:{x:1,z:0}, 18:{x:2,z:0}
};
var RIGHT_POS = {
  19:{y:2,z:2}, 20:{y:1,z:2}, 21:{y:0,z:2},
  22:{y:2,z:1}, 23:{y:1,z:1}, 24:{y:0,z:1},
  25:{y:2,z:0}, 26:{y:1,z:0}, 27:{y:0,z:0}
};

var state = null;
var trie = null;
var history = [];
var selectedFaceKey = null;
var selectedCubeId = null;
var highlightedPathKeys = [];
var started = false;

function posKey(x,y,z){ return x + "," + y + "," + z; }

function cubeNumberForInitialPosition(x,y,z) {
  var layer = 2 - z;
  return layer * 9 + y * 3 + x + 1;
}

function newState() {
  var cubes = {};
  var occupancy = {};
  var z,y,x,n,id;
  for (z=0; z<SIZE; z++) {
    for (y=0; y<SIZE; y++) {
      for (x=0; x<SIZE; x++) {
        n = cubeNumberForInitialPosition(x,y,z);
        id = "C" + String(n).padStart(2,"0");
        cubes[id] = {id:id, faces:{top:"",left:"",right:""}};
        occupancy[posKey(x,y,z)] = id;
      }
    }
  }
  return {cubes:cubes, occupancy:occupancy};
}

function cloneState(s){ return JSON.parse(JSON.stringify(s)); }

function saveLocal() {
  try {
    localStorage.setItem("custom3dBoggleV4State", JSON.stringify(state));
    localStorage.setItem("custom3dBoggleV4Started", started ? "1" : "0");
  } catch(e) {}
}

function loadLocal() {
  try {
    var raw = localStorage.getItem("custom3dBoggleV4State");
    if (!raw) return false;
    var parsed = JSON.parse(raw);
    if (!parsed || !parsed.cubes || !parsed.occupancy) return false;
    state = parsed;
    started = localStorage.getItem("custom3dBoggleV4Started") === "1";
    return true;
  } catch(e) {
    return false;
  }
}

function pushHistory() {
  history.push({state:cloneState(state), started:started});
  if (history.length > 40) history.shift();
  updateUndo();
}

function updateUndo() {
  var b = document.getElementById("undoBtn");
  if (b) b.disabled = history.length === 0;
}

function getCubeAt(x,y,z) {
  return state.occupancy[posKey(x,y,z)] || null;
}

function findCubePosition(cubeId) {
  var pos;
  for (pos in state.occupancy) {
    if (state.occupancy[pos] === cubeId) {
      var p = pos.split(",");
      return {x:Number(p[0]), y:Number(p[1]), z:Number(p[2])};
    }
  }
  return null;
}

function faceNode(cubeId, dir, x,y,z, viewPos) {
  return {
    key:cubeId + ":" + dir,
    cubeId:cubeId,
    dir:dir,
    x:x,y:y,z:z,
    viewPos:viewPos,
    letter:(state.cubes[cubeId].faces[dir] || "").toLowerCase()
  };
}

function currentVisibleFaces() {
  var nodes = [];
  var posStr,p,z,y,x,id,chosen;

  for (posStr in TOP_POS) {
    p = TOP_POS[posStr]; chosen = null;
    for (z=2; z>=0; z--) {
      id = getCubeAt(p.x,p.y,z);
      if (id) { chosen = faceNode(id,"top",p.x,p.y,z,Number(posStr)); break; }
    }
    if (chosen) nodes.push(chosen);
  }

  for (posStr in LEFT_POS) {
    p = LEFT_POS[posStr]; chosen = null;
    for (y=2; y>=0; y--) {
      id = getCubeAt(p.x,y,p.z);
      if (id) { chosen = faceNode(id,"left",p.x,y,p.z,Number(posStr)); break; }
    }
    if (chosen) nodes.push(chosen);
  }

  for (posStr in RIGHT_POS) {
    p = RIGHT_POS[posStr]; chosen = null;
    for (x=2; x>=0; x--) {
      id = getCubeAt(x,p.y,p.z);
      if (id) { chosen = faceNode(id,"right",x,p.y,p.z,Number(posStr)); break; }
    }
    if (chosen) nodes.push(chosen);
  }

  return nodes;
}

function bboxForFace(n) {
  if (n.dir === "top") return [[n.x,n.x+1],[n.y,n.y+1],[n.z+1,n.z+1]];
  if (n.dir === "left") return [[n.x,n.x+1],[n.y+1,n.y+1],[n.z,n.z+1]];
  return [[n.x+1,n.x+1],[n.y,n.y+1],[n.z,n.z+1]];
}

function boxesTouch(a,b) {
  var axis,lo,hi;
  for (axis=0; axis<3; axis++) {
    lo = Math.max(a[axis][0], b[axis][0]);
    hi = Math.min(a[axis][1], b[axis][1]);
    if (lo > hi) return false;
  }
  return true;
}

function buildAdjacency(nodes) {
  var adj = {};
  var i,j,a,b,ab;
  for (i=0; i<nodes.length; i++) adj[nodes[i].key] = [];
  for (i=0; i<nodes.length; i++) {
    a = nodes[i]; ab = bboxForFace(a);
    for (j=i+1; j<nodes.length; j++) {
      b = nodes[j];
      if (boxesTouch(ab,bboxForFace(b))) {
        adj[a.key].push(b.key);
        adj[b.key].push(a.key);
      }
    }
  }
  return adj;
}

function makeTrie(words) {
  var root = {};
  var i,w,j,ch,node;
  for (i=0; i<words.length; i++) {
    w = String(words[i]).trim().toLowerCase();
    if (w.length < MIN_LEN || w.length > MAX_LEN || !/^[a-z]+$/.test(w)) continue;
    node = root;
    for (j=0; j<w.length; j++) {
      ch = w[j];
      if (!node[ch]) node[ch] = {};
      node = node[ch];
    }
    node.$ = true;
  }
  return root;
}

function solveCurrentBoard() {
  if (!trie) trie = makeTrie(window.BOGGLE_WORDS || []);
  var all = currentVisibleFaces();
  var nodes = all.filter(function(n){ return /^[a-z]$/.test(n.letter); });
  var byKey = {}, i;
  for (i=0; i<nodes.length; i++) byKey[nodes[i].key] = nodes[i];
  var adj = buildAdjacency(nodes);
  var found = {};

  function dfs(nodeKey,trieNode,prefix,used,path) {
    var node = byKey[nodeKey];
    if (!node) return;
    var nextTrie = trieNode[node.letter];
    if (!nextTrie) return;

    var word = prefix + node.letter;
    var nextPath = path.concat([node]);

    if (word.length >= MIN_LEN && nextTrie.$ && !found[word]) {
      found[word] = nextPath;
    }
    if (word.length >= MAX_LEN) return;

    used[nodeKey] = true;
    var nbrs = adj[nodeKey] || [];
    var k,nk;
    for (k=0; k<nbrs.length; k++) {
      nk = nbrs[k];
      if (!used[nk]) dfs(nk,nextTrie,word,used,nextPath);
    }
    delete used[nodeKey];
  }

  for (i=0; i<nodes.length; i++) dfs(nodes[i].key,trie,"",{},[]);

  var arr = Object.keys(found).map(function(w){ return {word:w,path:found[w]}; });
  arr.sort(function(a,b){
    if (b.word.length !== a.word.length) return b.word.length - a.word.length;
    return a.word.localeCompare(b.word);
  });
  return arr;
}

function applyGravity() {
  var newOcc = {};
  var x,y,z,id,stack;
  for (x=0; x<3; x++) {
    for (y=0; y<3; y++) {
      stack = [];
      for (z=0; z<3; z++) {
        id = getCubeAt(x,y,z);
        if (id) stack.push(id);
      }
      for (z=0; z<stack.length; z++) newOcc[posKey(x,y,z)] = stack[z];
    }
  }
  state.occupancy = newOcc;
}

function removeSelectedCube() {
  if (!selectedCubeId) return;
  var p = findCubePosition(selectedCubeId);
  if (!p) return;
  pushHistory();
  delete state.occupancy[posKey(p.x,p.y,p.z)];
  applyGravity();
  selectedFaceKey = null;
  selectedCubeId = null;
  highlightedPathKeys = [];
  saveLocal();
  renderAll();
  clearResults();
  setStatus("Cubelet removed. Gravity applied.", "ok");
}

function undo() {
  if (!history.length) return;
  var h = history.pop();
  state = h.state;
  started = h.started;
  selectedFaceKey = null;
  selectedCubeId = null;
  highlightedPathKeys = [];
  saveLocal();
  renderAll();
  clearResults();
  setStatus("Undid the last change.", "ok");
}

function resetAll() {
  if (!confirm("Reset the whole cube and erase all letters?")) return;
  pushHistory();
  state = newState();
  started = false;
  selectedFaceKey = null;
  selectedCubeId = null;
  highlightedPathKeys = [];
  saveLocal();
  renderAll();
  clearResults();
  setStatus("Reset. Enter the 27 starting letters.", "ok");
}

function setStatus(msg, cls) {
  var e = document.getElementById("status");
  e.textContent = msg;
  e.className = cls || "";
}

function nodeForViewPos(pos) {
  var nodes = currentVisibleFaces();
  var i;
  for (i=0; i<nodes.length; i++) if (nodes[i].viewPos === pos) return nodes[i];
  return null;
}

function writeLetterToNode(node, value) {
  if (!node) return;
  var clean = String(value || "").replace(/[^A-Za-z]/g,"").slice(-1).toUpperCase();
  state.cubes[node.cubeId].faces[node.dir] = clean;
  saveLocal();
}

function initialEntryOrder() {
  // Follow the visual top-face entry order, then left and right.
  // This is the same fast "type one letter -> jump to next box" behavior wanted from v1.
  return [3,2,6,1,5,9,4,8,7,
          10,11,12,13,14,15,16,17,18,
          19,20,21,22,23,24,25,26,27];
}

function initialInputsToCube() {
  var order = initialEntryOrder();
  var i,pos,input,val,node;
  var missing = [];

  // Normalize all 27 entries first.
  for (i=0; i<order.length; i++) {
    pos = order[i];
    input = document.querySelector('[data-initial-pos="'+pos+'"]');
    val = input ? String(input.value || "").replace(/[^A-Za-z]/g,"").slice(-1).toUpperCase() : "";
    if (input) input.value = val;

    if (!/^[A-Z]$/.test(val)) {
      missing.push(pos);
      if (input) input.classList.add("missing");
    } else if (input) {
      input.classList.remove("missing");
    }
  }

  if (missing.length) {
    setInitialMessage("Missing letter" + (missing.length === 1 ? "" : "s") +
      " at position" + (missing.length === 1 ? " " : "s ") + missing.join(", ") + ".", "warn");
    setStatus("Fill the highlighted starting position" + (missing.length === 1 ? "" : "s") + ".", "warn");
    input = document.querySelector('[data-initial-pos="'+missing[0]+'"]');
    if (input) {
      input.scrollIntoView({block:"center", behavior:"smooth"});
      setTimeout(function(){ input.focus(); input.select(); }, 250);
    }
    return false;
  }

  pushHistory();

  // Write all 27 letters to the physical cubelet faces.
  for (i=0; i<order.length; i++) {
    pos = order[i];
    input = document.querySelector('[data-initial-pos="'+pos+'"]');
    node = nodeForViewPos(pos);
    if (!node) {
      setInitialMessage("Could not map starting position " + pos + ". Please reload this build.", "warn");
      return false;
    }
    state.cubes[node.cubeId].faces[node.dir] = input.value.toUpperCase();
  }

  started = true;
  selectedFaceKey = null;
  selectedCubeId = null;
  highlightedPathKeys = [];
  saveLocal();

  setInitialMessage("Starting cube loaded.", "ok");
  renderAll();
  clearResults();
  setStatus("Starting cube loaded. Tap any exposed face to enter or change a letter.", "ok");

  // Move user directly to the cube.
  setTimeout(function(){
    var cube = document.getElementById("cubeSection");
    if (cube) cube.scrollIntoView({block:"start", behavior:"smooth"});
  }, 60);

  return true;
}

function setInitialMessage(message, cls) {
  var el = document.getElementById("initialMessage");
  if (!el) return;
  el.textContent = message || "";
  el.className = "initial-message " + (cls || "");
}

function populateInitialInputsFromState() {
  var pos,node,input,val;
  for (pos=1; pos<=27; pos++) {
    input = document.querySelector('[data-initial-pos="'+pos+'"]');
    node = nodeForViewPos(pos);
    val = node ? (state.cubes[node.cubeId].faces[node.dir] || "") : "";
    if (input) input.value = val;
  }
}

function wireInitialInputs() {
  var order = initialEntryOrder();
  var inputs = [];

  order.forEach(function(pos){
    var inp = document.querySelector('[data-initial-pos="'+pos+'"]');
    if (inp) inputs.push(inp);
  });

  inputs.forEach(function(inp, idx){
    inp.addEventListener("input", function(){
      var cleaned = String(inp.value || "").replace(/[^A-Za-z]/g,"").slice(-1).toUpperCase();
      inp.value = cleaned;
      inp.classList.remove("missing");
      setInitialMessage("", "");

      if (cleaned && inputs[idx+1]) {
        // tiny delay makes iOS keyboard/focus movement more reliable
        setTimeout(function(){
          inputs[idx+1].focus();
          inputs[idx+1].select();
        }, 0);
      }
    });

    inp.addEventListener("focus", function(){
      try { inp.select(); } catch(e) {}
    });

    inp.addEventListener("keydown", function(e){
      if ((e.key === "Backspace" || e.key === "Delete") && !inp.value && idx > 0) {
        e.preventDefault();
        inputs[idx-1].focus();
        inputs[idx-1].select();
      }
    });
  });

  // v1-style: keyboard starts at the first top tile automatically.
  if (!started && inputs.length) {
    setTimeout(function(){
      inputs[0].focus();
      inputs[0].select();
    }, 250);
  }
}

function quickInputForNode(node) {
  if (!node) return;
  selectedFaceKey = node.key;
  selectedCubeId = node.cubeId;
  renderCubeSvg();
  renderQuickBar();

  var input = document.getElementById("quickLetterInput");
  input.value = state.cubes[node.cubeId].faces[node.dir] || "";
  input.dataset.nodekey = node.key;
  input.focus();
  input.select();
}

function saveQuickLetter() {
  var input = document.getElementById("quickLetterInput");
  var key = input.dataset.nodekey;
  if (!key) return;
  var nodes = currentVisibleFaces();
  var node = null, i;
  for (i=0; i<nodes.length; i++) if (nodes[i].key === key) { node = nodes[i]; break; }
  if (!node) return;
  writeLetterToNode(node,input.value);
  highlightedPathKeys = [];
  renderAll();
  clearResults();
}

function renderQuickBar() {
  var bar = document.getElementById("quickBar");
  var label = document.getElementById("quickFaceLabel");
  var node = null, nodes=currentVisibleFaces(), i;
  for (i=0; i<nodes.length; i++) if (nodes[i].key === selectedFaceKey) {node=nodes[i];break;}
  if (!node) {
    bar.classList.remove("show");
    return;
  }
  label.textContent = "Position " + node.viewPos + " · " + DIR[node.dir].label;
  bar.classList.add("show");
}

function runSolver() {
  var visible = currentVisibleFaces();
  var blanks = visible.filter(function(n){ return !(state.cubes[n.cubeId].faces[n.dir] || ""); });
  if (blanks.length) {
    setStatus(blanks.length + " visible face" + (blanks.length===1 ? " is" : "s are") + " blank. Tap a blank face and type its letter.", "warn");
    return;
  }
  var results = solveCurrentBoard();
  renderResults(results);
  setStatus("Found " + results.length.toLocaleString() + " words.", "ok");
}

function clearResults() {
  document.getElementById("wordCount").textContent = "";
  document.getElementById("results").innerHTML = '<div class="empty-results">Press <strong>Find Words</strong> when ready.</div>';
}

function renderResults(results) {
  var out = document.getElementById("results");
  out.innerHTML = "";
  document.getElementById("wordCount").textContent =
    results.length.toLocaleString() + " word" + (results.length===1 ? "" : "s");

  if (!results.length) {
    out.innerHTML = '<div class="empty-results">No 3–8 letter words found.</div>';
    return;
  }

  var len,group,section,h,list,i,item,btn;
  for (len=8; len>=3; len--) {
    group = results.filter(function(r){ return r.word.length === len; });
    if (!group.length) continue;
    section = document.createElement("section");
    section.className = "result-group";
    h = document.createElement("h3");
    h.textContent = len + "-LETTER WORDS (" + group.length + ")";
    section.appendChild(h);
    list = document.createElement("div");
    list.className = "word-list";

    for (i=0; i<group.length; i++) {
      item = group[i];
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "word-btn";
      btn.innerHTML = "<strong>" + item.word.toUpperCase() + "</strong><small>" +
        item.path.map(function(n){return n.viewPos;}).join(" → ") + "</small>";
      (function(path){
        btn.addEventListener("click", function(){
          highlightedPathKeys = path.map(function(n){return n.key;});
          renderCubeSvg();
          window.scrollTo({top:document.getElementById("cubeSection").offsetTop - 8, behavior:"smooth"});
        });
      })(item.path);
      list.appendChild(btn);
    }
    section.appendChild(list);
    out.appendChild(section);
  }
}

function projectFactory() {
  var ORIGIN_X=355, ORIGIN_Y=184;
  var VX={x:60,y:30}, VY={x:-60,y:30}, VZ={x:0,y:-60};
  function project(x,y,z){
    return {
      x:ORIGIN_X + VX.x*x + VY.x*y + VZ.x*z,
      y:ORIGIN_Y + VX.y*x + VY.y*y + VZ.y*z
    };
  }
  return project;
}
var project = projectFactory();

function facePolygon(n) {
  if (n.dir === "top") return [
    project(n.x,n.y,n.z+1), project(n.x+1,n.y,n.z+1),
    project(n.x+1,n.y+1,n.z+1), project(n.x,n.y+1,n.z+1)
  ];
  if (n.dir === "left") return [
    project(n.x,n.y+1,n.z+1), project(n.x+1,n.y+1,n.z+1),
    project(n.x+1,n.y+1,n.z), project(n.x,n.y+1,n.z)
  ];
  return [
    project(n.x+1,n.y,n.z+1), project(n.x+1,n.y+1,n.z+1),
    project(n.x+1,n.y+1,n.z), project(n.x+1,n.y,n.z)
  ];
}
function centroid(pts) {
  var x=0,y=0,i;
  for(i=0;i<pts.length;i++){x+=pts[i].x;y+=pts[i].y;}
  return {x:x/pts.length,y:y/pts.length};
}
function ptsAttr(pts){
  return pts.map(function(p){return p.x.toFixed(1)+","+p.y.toFixed(1);}).join(" ");
}

function renderCubeSvg() {
  var svg = document.getElementById("cubeSvg");
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  var ns="http://www.w3.org/2000/svg";

  var shadow=document.createElementNS(ns,"ellipse");
  shadow.setAttribute("cx","355"); shadow.setAttribute("cy","370");
  shadow.setAttribute("rx","185"); shadow.setAttribute("ry","50");
  shadow.setAttribute("fill","rgba(15,23,42,.10)");
  svg.appendChild(shadow);

  var nodes=currentVisibleFaces();
  nodes.sort(function(a,b){
    if (a.dir==="top" && b.dir!=="top") return 1;
    if (a.dir!=="top" && b.dir==="top") return -1;
    return (a.z+a.x+a.y)-(b.z+b.x+b.y);
  });

  nodes.forEach(function(n){
    var g=document.createElementNS(ns,"g");
    var cls="svg-face svg-"+n.dir;
    if (!state.cubes[n.cubeId].faces[n.dir]) cls += " blank";
    if (n.key===selectedFaceKey) cls += " selected";
    if (highlightedPathKeys.indexOf(n.key)>=0) cls += " in-path";
    g.setAttribute("class",cls);

    var poly=document.createElementNS(ns,"polygon");
    var pts=facePolygon(n), c=centroid(pts);
    poly.setAttribute("points",ptsAttr(pts));
    g.appendChild(poly);

    var num=document.createElementNS(ns,"text");
    num.setAttribute("class","pos-label");
    num.setAttribute("x",pts[0].x+15); num.setAttribute("y",pts[0].y+16);
    num.textContent=String(n.viewPos);
    g.appendChild(num);

    var letter=document.createElementNS(ns,"text");
    letter.setAttribute("class","letter-label");
    letter.setAttribute("x",c.x); letter.setAttribute("y",c.y+11);
    letter.setAttribute("text-anchor","middle");
    letter.textContent=state.cubes[n.cubeId].faces[n.dir] || "";
    g.appendChild(letter);

    var stepIndex=highlightedPathKeys.indexOf(n.key);
    if (stepIndex>=0) {
      var circ=document.createElementNS(ns,"circle");
      circ.setAttribute("cx",pts[1].x-10); circ.setAttribute("cy",pts[1].y+9);
      circ.setAttribute("r","12"); circ.setAttribute("class","step-circle");
      g.appendChild(circ);
      var st=document.createElementNS(ns,"text");
      st.setAttribute("x",pts[1].x-10); st.setAttribute("y",pts[1].y+13);
      st.setAttribute("text-anchor","middle"); st.setAttribute("class","step-number");
      st.textContent=String(stepIndex+1);
      g.appendChild(st);
    }

    g.addEventListener("click",function(){ quickInputForNode(n); });
    svg.appendChild(g);
  });
}

function renderAdvanced() {
  var box=document.getElementById("advancedInfo");
  var html="";
  if (selectedCubeId) {
    var p=findCubePosition(selectedCubeId);
    if (p) html += "<p><strong>"+selectedCubeId+"</strong> at x="+(p.x+1)+", y="+(p.y+1)+", z="+(p.z+1)+"</p>";
  }
  html += '<div class="layers">';
  [2,1,0].forEach(function(z){
    html += '<div class="layer"><h4>'+(z===2?"Top":z===1?"Middle":"Bottom")+' layer</h4><div class="layer-grid">';
    var y,x,id;
    for(y=0;y<3;y++) for(x=0;x<3;x++){
      id=getCubeAt(x,y,z);
      html += '<div class="layer-cell'+(id===selectedCubeId?" selected":"")+'">'+(id||"—")+'</div>';
    }
    html += '</div></div>';
  });
  html += "</div>";
  box.innerHTML=html;
}

function renderMode() {
  document.getElementById("initialSection").style.display = started ? "none" : "block";
  document.getElementById("cubeSection").style.display = started ? "block" : "none";
}

function renderStats() {
  document.getElementById("cubeCount").textContent = Object.keys(state.occupancy).length + " / 27 cubelets";
  var v=currentVisibleFaces();
  document.getElementById("visibleCount").textContent=v.length+" visible faces";
  var blanks=v.filter(function(n){return !state.cubes[n.cubeId].faces[n.dir];}).length;
  document.getElementById("blankCount").textContent=blanks+" blank";
  document.getElementById("dictionaryCount").textContent=(window.BOGGLE_WORDS||[]).length.toLocaleString()+" dictionary words";
  document.getElementById("removeBtn").disabled=!selectedCubeId;
  document.getElementById("removeBtn").textContent=selectedCubeId ? "Remove "+selectedCubeId : "Remove cubelet";
  updateUndo();
}

function renderAll() {
  renderMode();
  renderStats();
  if (!started) populateInitialInputsFromState();
  if (started) {
    renderCubeSvg();
    renderQuickBar();
    renderAdvanced();
  }
}

function exportState() {
  var blob=new Blob([JSON.stringify({state:state,started:started},null,2)],{type:"application/json"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download="3d-boggle-v4-state.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
}

function importState(file) {
  var reader=new FileReader();
  reader.onload=function(){
    try{
      var parsed=JSON.parse(reader.result);
      if (parsed.state && parsed.state.cubes) {
        pushHistory();
        state=parsed.state; started=!!parsed.started;
      } else if (parsed.cubes) {
        pushHistory();
        state=parsed; started=true;
      } else throw new Error("Invalid state");
      selectedFaceKey=null; selectedCubeId=null; highlightedPathKeys=[];
      saveLocal(); renderAll(); clearResults(); setStatus("State imported.","ok");
    }catch(e){setStatus("Could not import state.","warn");}
  };
  reader.readAsText(file);
}

function init() {
  if (!loadLocal()) state=newState();

  wireInitialInputs();

  var startBtn = document.getElementById("startCubeBtn");
  if (startBtn) startBtn.addEventListener("click", function(e){
    e.preventDefault();
    initialInputsToCube();
  });
  window.startCube = initialInputsToCube;
  document.getElementById("findBtn").addEventListener("click",runSolver);
  document.getElementById("removeBtn").addEventListener("click",removeSelectedCube);
  document.getElementById("undoBtn").addEventListener("click",undo);
  document.getElementById("resetBtn").addEventListener("click",resetAll);
  document.getElementById("exportBtn").addEventListener("click",exportState);
  document.getElementById("importFile").addEventListener("change",function(e){
    if(e.target.files && e.target.files[0]) importState(e.target.files[0]);
    e.target.value="";
  });

  var q=document.getElementById("quickLetterInput");
  q.addEventListener("input",function(){
    q.value=q.value.replace(/[^A-Za-z]/g,"").slice(-1).toUpperCase();
    if(q.value) {
      saveQuickLetter();
      setTimeout(function(){ q.blur(); },50);
    }
  });
  q.addEventListener("keydown",function(e){
    if(e.key==="Backspace" || e.key==="Delete") {
      q.value="";
      saveQuickLetter();
    }
  });

  renderAll();
  clearResults();
  setStatus(started ? "Tap a face to enter or change its letter." : "Enter the 27 starting letters, just like v1.","ok");
}

document.addEventListener("DOMContentLoaded",init);
