/* ============ Scène 3D, styles d'affichage, textures ============ */
const canvas = $('#c'), vpEl = $('#vp');
const isNarrow = matchMedia('(max-width: 860px)');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const persp = new THREE.PerspectiveCamera(42, 1, 0.05, 3000);
const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -1000, 1000);
persp.position.set(-6, 14, 16); ortho.position.set(5, 200, -4);
const c3 = new OrbitControls(persp, canvas); c3.enableDamping = true; c3.dampingFactor = 0.12; c3.maxPolarAngle = Math.PI * 0.495; c3.target.set(5, 0, -4);
c3.touches = {ONE:THREE.TOUCH.ROTATE, TWO:THREE.TOUCH.DOLLY_PAN};
c3.mouseButtons = {LEFT:THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.PAN, RIGHT:THREE.MOUSE.PAN};
const c2 = new OrbitControls(ortho, canvas); c2.enableRotate = false; c2.screenSpacePanning = true; c2.minPolarAngle = c2.maxPolarAngle = 0; c2.minAzimuthAngle = c2.maxAzimuthAngle = 0;
c2.mouseButtons = {LEFT:THREE.MOUSE.PAN, MIDDLE:THREE.MOUSE.PAN, RIGHT:THREE.MOUSE.PAN}; c2.touches = {ONE:THREE.TOUCH.PAN, TWO:THREE.TOUCH.DOLLY_PAN};
c2.zoomToCursor = true; c2.minZoom = 0.03; c2.maxZoom = 120; c2.target.set(5, 0, -4); c2.enabled = false;
[c2, c3].forEach(c => c.addEventListener('change', () => dirty = true));
let view = '3d';                // '2d' plan | '3d' | 'render'
const cam = () => view === '2d' ? ortho : persp;
const ctl = () => view === '2d' ? c2 : c3;

const hemi = new THREE.HemisphereLight(0xf2f7ff, 0x6b6456, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.castShadow = true;
sun.shadow.mapSize.set(isNarrow.matches ? 1024 : 2048, isNarrow.matches ? 1024 : 2048);
Object.assign(sun.shadow.camera, {left:-30, right:30, top:30, bottom:-30, near:1, far:220}); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);
const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({opacity:0.16}));
groundShadow.rotation.x = -Math.PI / 2; groundShadow.position.y = -0.002; groundShadow.receiveShadow = true; scene.add(groundShadow);
const groundReal = new THREE.Mesh(new THREE.CircleGeometry(220, 64), new THREE.MeshStandardMaterial({color:0x6F8A5A, roughness:1}));
groundReal.rotation.x = -Math.PI / 2; groundReal.position.y = -0.01; groundReal.receiveShadow = true; groundReal.visible = false; scene.add(groundReal);
let pmrem = null, envTex = null, skyTex = null;

let gridMajor, gridMinor;
const modelGroup = new THREE.Group(), previewGroup = new THREE.Group(), markGroup = new THREE.Group();
scene.add(modelGroup, previewGroup, markGroup);

/* Réglages d'affichage (enregistrés par appareil) */
const DISPLAY = {style:'shaded', sunAz:215, sunEl:42, exposure:1.0, shadows:true, edges:true, bg:'', grid:true, dims:true};
try { Object.assign(DISPLAY, JSON.parse(localStorage.getItem('ap.display') || '{}')); } catch(e){}
const STYLES = {shaded:'Ombré', textured:'Matériaux', realistic:'Réaliste', sketch:'Croquis', wire:'Filaire', xray:'Rayons X'};
const isDarkUI = () => (cssVar('--panel') || '#fff').toLowerCase() !== '#ffffff';
const bgColor = () => DISPLAY.bg || (isDarkUI() ? '#16191E' : '#FFFFFF');
const bgLight = () => new THREE.Color(bgColor()).getHSL({}).l > 0.5;
function saveDisplay(){ try { localStorage.setItem('ap.display', JSON.stringify(DISPLAY)); } catch(e){} }

/* ---------- textures procédurales (motifs en mètres, répétées sur les UV « monde ») ---------- */
const texCache = {};
function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function shade(hex, k){ const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, h.s, clamp(h.l + k, 0, 1)); return '#' + c.getHexString(); }
function paint(id){
  const m = mat(id), S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), R = rng([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const base = m.color, noise = (amt, n = 2600, sz = 2) => { for (let i = 0; i < n; i++){ g.fillStyle = shade(base, (R() - .5) * amt); g.globalAlpha = .5; g.fillRect(R()*S, R()*S, sz, sz); } g.globalAlpha = 1; };
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const t = m.tex || 'plain';
  if (t === 'brick' || t === 'brickbig' || t === 'block'){
    const rows = t === 'brick' ? 4 : 2, cols = 2, rh = S / rows, cw = S / cols, j = t === 'brick' ? 5 : 4;
    g.fillStyle = t === 'block' ? shade(base, .12) : '#D9D2C3'; g.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) for (let c = -1; c < cols + 1; c++){
      const x = c * cw + (r % 2 ? cw / 2 : 0); g.fillStyle = shade(base, (R() - .5) * .12); g.fillRect(x + j/2, r * rh + j/2, cw - j, rh - j);
      if (t === 'brickbig'){ g.strokeStyle = shade(base, -.12); g.lineWidth = 1; for (let k = 1; k < 6; k++){ g.beginPath(); g.moveTo(x + j, r*rh + k*rh/6); g.lineTo(x + cw - j, r*rh + k*rh/6); g.stroke(); } }
    }
    noise(.15, 1800);
  } else if (t === 'concrete' || t === 'plaster' || t === 'earth' || t === 'membrane' || t === 'plain'){
    noise(t === 'concrete' ? .14 : t === 'earth' ? .2 : .06, t === 'plain' ? 900 : 4200, t === 'concrete' ? 3 : 2);
    if (t === 'concrete'){ g.strokeStyle = shade(base, -.06); g.lineWidth = 1; g.strokeRect(0.5, 0.5, S - 1, S - 1); for (let i = 0; i < 6; i++){ g.fillStyle = shade(base, -.1); g.beginPath(); g.arc(R()*S, R()*S, 1.5, 0, 7); g.fill(); } }
  } else if (t === 'wood' || t === 'woodpanel' || t === 'cladding' || t === 'parquet'){
    const planks = t === 'parquet' ? 4 : t === 'cladding' ? 4 : 1, ph = S / planks;
    for (let p = 0; p < planks; p++){
      const off = t === 'parquet' ? (p % 2) * S / 2 : 0, col = shade(base, (R() - .5) * .1);
      g.fillStyle = col; g.fillRect(0, p * ph, S, ph);
      for (let k = 0; k < 18; k++){ g.strokeStyle = shade(col, (R() - .5) * .16); g.lineWidth = 1 + R() * 1.5; g.beginPath(); const y = p * ph + R() * ph; g.moveTo(0, y); g.bezierCurveTo(S/3, y + (R()-.5)*8, 2*S/3, y + (R()-.5)*8, S, y); g.stroke(); }
      g.fillStyle = shade(base, -.22); g.fillRect(0, p * ph, S, t === 'cladding' ? 4 : 1);
      if (t === 'parquet'){ g.fillRect(off, p * ph, 1.5, ph); g.fillRect((off + S/2) % S, p * ph, 1.5, ph); }
    }
  } else if (t === 'insul' || t === 'insulboard' || t === 'osb' || t === 'fabric' || t === 'grass' || t === 'gravel'){
    const n = t === 'gravel' ? 900 : 1600;
    for (let i = 0; i < n; i++){
      g.fillStyle = shade(base, (R() - .5) * (t === 'osb' ? .35 : .22)); g.globalAlpha = .7;
      if (t === 'osb'){ g.save(); g.translate(R()*S, R()*S); g.rotate(R()*3.14); g.fillRect(-9, -3, 18, 6); g.restore(); }
      else if (t === 'insul'){ g.strokeStyle = g.fillStyle; g.lineWidth = 1; g.beginPath(); const x = R()*S, y = R()*S; g.moveTo(x, y); g.quadraticCurveTo(x + (R()-.5)*20, y + (R()-.5)*20, x + (R()-.5)*30, y + (R()-.5)*10); g.stroke(); }
      else if (t === 'gravel'){ g.beginPath(); g.arc(R()*S, R()*S, 2 + R()*4, 0, 7); g.fill(); }
      else g.fillRect(R()*S, R()*S, 3, 3);
    }
    g.globalAlpha = 1;
  } else if (t === 'metal' || t === 'ribbed'){
    for (let y = 0; y < S; y++){ g.fillStyle = shade(base, (R() - .5) * .06); g.fillRect(0, y, S, 1); }
    if (t === 'ribbed') for (let k = 0; k < 4; k++){ const x = k * S/4; const gr = g.createLinearGradient(x, 0, x + S/4, 0); gr.addColorStop(0, shade(base, .1)); gr.addColorStop(.3, shade(base, -.12)); gr.addColorStop(.6, shade(base, .08)); gr.addColorStop(1, shade(base, .1)); g.fillStyle = gr; g.fillRect(x, 0, S/4, S); }
  } else if (t === 'tile'){
    g.fillStyle = shade(base, -.16); g.fillRect(0, 0, S, S);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++){ g.fillStyle = shade(base, (R() - .5) * .06); g.fillRect(c * S/2 + 2, r * S/2 + 2, S/2 - 4, S/2 - 4); }
  } else if (t === 'stone'){
    g.fillStyle = shade(base, -.2); g.fillRect(0, 0, S, S);
    const rows = 3; for (let r = 0; r < rows; r++){ let x = -R() * 60; const rh = S / rows; while (x < S){ const w = 50 + R() * 90; g.fillStyle = shade(base, (R() - .5) * .14); g.fillRect(x + 3, r * rh + 3, w - 6, rh - 6); x += w; } }
    noise(.12, 2000);
  } else if (t === 'rooftile' || t === 'slate'){
    const rows = 4, rh = S / rows; for (let r = 0; r < rows; r++) for (let c = -1; c < 4; c++){ const x = c * S/3 + (r % 2 ? S/6 : 0); g.fillStyle = shade(base, (R() - .5) * .12); g.fillRect(x + 1, r * rh, S/3 - 2, rh - 2); g.fillStyle = shade(base, -.18); g.fillRect(x, r * rh + rh - 4, S/3, 4); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.repeat.set(1 / (m.tx || (t === 'plain' || t === 'concrete' || t === 'plaster' ? 2 : 1)), 1 / (m.ty || (t === 'plain' || t === 'concrete' || t === 'plaster' ? 2 : 1)));
  tex.name = 'archiplan-' + id;
  return tex;
}
const texFor = id => texCache[id] ??= paint(id);

/* ---------- matériaux selon le style ---------- */
let matCache = {};
const edgeMat = new THREE.LineBasicMaterial({color:0x24324F, transparent:true, opacity:0.55});
const selEdgeMat = new THREE.LineBasicMaterial({color:0xE2861B});
const ghostMat = new THREE.MeshStandardMaterial({color:0x0877B9, transparent:true, opacity:0.35, depthWrite:false});
const ghostEdge = new THREE.LineBasicMaterial({color:0x0877B9});
const hoverMat = new THREE.MeshBasicMaterial({color:0x1F89C5, transparent:true, opacity:0.18, depthWrite:false, side:THREE.DoubleSide});
const PLAN_LIGHT = {wall:0.08, col:0.08, slab:0.84, vol:0.55, inst:0.72, host:0.35};
const planOn = () => view === '2d';
function matFor(id, selected, light = 0){
  const plan = planOn(), st = plan ? 'plan' : DISPLAY.style, key = st + '|' + id + (selected ? '|s' : '') + (plan ? '|' + light : '');
  if (matCache[key]) return matCache[key];
  const m = mat(id); let M;
  const transp = m.opacity != null && m.opacity < 1;
  if (plan){ // plan façon DAO : aplats clairs, traits sombres, sans ombre
    const c = new THREE.Color(m.color).lerp(new THREE.Color(0xffffff), transp ? Math.max(light, 0.6) : light);
    M = new THREE.MeshBasicMaterial({color:c, transparent:transp, opacity:transp ? 0.6 : 1, depthWrite:!transp});
  }
  else if (st === 'sketch') M = new THREE.MeshLambertMaterial({color:transp ? 0xDCEFF6 : 0xF7F6F2, transparent:transp, opacity:transp ? 0.45 : 1});
  else if (st === 'xray') M = new THREE.MeshStandardMaterial({color:m.color, roughness:.8, transparent:true, opacity:0.22, depthWrite:false});
  else if (st === 'wire') M = new THREE.MeshBasicMaterial({visible:false});
  else if (st === 'shaded'){ // ombré façon SketchUp : couleurs adoucies, pas de noirs francs
    const c = new THREE.Color(m.color), hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s * 0.8, Math.max(0.42, hsl.l * 0.82 + 0.16));
    M = new THREE.MeshStandardMaterial({color:c, roughness:0.95, metalness:0, transparent:transp, opacity:m.opacity ?? 1, depthWrite:!transp, envMapIntensity:0.3});
  }
  else {
    const textured = st === 'textured' || st === 'realistic';
    M = new THREE.MeshStandardMaterial({color:textured && m.tex && m.tex !== 'glass' ? 0xffffff : m.color, map:textured && m.tex && m.tex !== 'glass' ? texFor(id) : null,
      roughness:m.rough ?? .9, metalness:m.metal ?? 0, transparent:transp, opacity:m.opacity ?? 1, depthWrite:!transp,
      envMapIntensity:st === 'realistic' ? 0.6 : 0.35});
  }
  M.polygonOffset = true; M.polygonOffsetFactor = 1; M.polygonOffsetUnits = 1; M.name = m.nom;
  if (selected && M.emissive){ M.emissive = new THREE.Color(cssVar('--sel') || '#E2861B'); M.emissiveIntensity = 0.3; }
  else if (selected) M.color = new THREE.Color(cssVar('--sel') || '#E2861B');
  return matCache[key] = M;
}
function resetMats(){ Object.values(matCache).forEach(m => m.dispose()); matCache = {}; }

function boxGeo(w, d, h){ // boîte aux UV « monde » (motifs à la bonne échelle)
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++){ const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return g;
}
function pieceGeo(pc){
  if (pc.top) return prismGeo(pc.top, pc.ext);
  const shape = new THREE.Shape(pc.poly.map(p => new THREE.Vector2(p[0], p[1])));
  const geo = new THREE.ExtrudeGeometry(shape, {depth:Math.max(pc.h, 0.001), bevelEnabled:false});
  geo.rotateX(-Math.PI / 2); geo.translate(0, pc.base, 0);
  return geo;
}
function solidGeo(so){
  let g;
  if (so.s === 'cyl') g = new THREE.CylinderGeometry(so.r, so.r, so.h, so.r > 0.3 ? 40 : 20);
  else if (so.s === 'sph') g = new THREE.SphereGeometry(so.r, 20, 14);
  else g = boxGeo(so.w, so.d, so.h);
  if (so.rz) g.rotateY(so.rz);
  g.translate(so.c[0], so.c[2], -so.c[1]);
  return g;
}
function meshOf(geo, matId, ghost, edgeAngle = 25, light = 0){
  const mesh = new THREE.Mesh(geo, ghost ? ghostMat : matFor(matId, false, light));
  mesh.castShadow = !ghost && !(mat(matId).opacity < 1); mesh.receiveShadow = !ghost; mesh.userData.mat = matId; mesh.userData.light = light;
  if (DISPLAY.edges || DISPLAY.style === 'sketch' || DISPLAY.style === 'wire' || planOn()){
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, edgeAngle), ghost ? ghostEdge : edgeMat);
    edges.userData.isEdge = true; mesh.add(edges);
  }
  return mesh;
}
const pieceMesh = (pc, ghost, light = 0) => meshOf(pieceGeo(pc), pc.mat, ghost, 25, light);
function disposeGroup(g){ g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); g.clear(); }

/* Regroupe les solides d'une famille par matériau (moins d'objets à dessiner) */
function instMeshes(el, ghost, light = 0){
  const by = {};
  for (const so of instSolids(el)) (by[so.m] ??= []).push(solidGeo(so));
  const out = [];
  for (const [m, geos] of Object.entries(by)){
    const g = geos.length === 1 ? geos[0] : mergeGeos(geos);
    out.push(meshOf(g, m, ghost, 30, light));
  }
  return out;
}
function mergeGeos(geos){
  // fusion simple (positions, normales, uv) — géométries non indexées
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g); let n = 0; parts.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  for (const g of parts){ pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geos.forEach(g => g.dispose()); parts.forEach(g => g.dispose());
  return out;
}

/* ---------- ambiance selon le style ---------- */
function skyTexture(){
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#5D8FC7'); gr.addColorStop(0.55, '#B9D3EC'); gr.addColorStop(0.75, '#E9EEF2'); gr.addColorStop(1, '#D9DCD3');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 256); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function applyThemeToScene(){
  const plan = planOn(), st = DISPLAY.style, real = st === 'realistic' && !plan;
  if (real){
    if (!pmrem){ pmrem = new THREE.PMREMGenerator(renderer); envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture; }
    if (!skyTex) skyTex = skyTexture();
    scene.environment = envTex; scene.background = skyTex;
  } else { scene.environment = null; scene.background = new THREE.Color(bgColor()); }
  vpEl.style.setProperty('--vp', bgColor()); vpEl.classList.toggle('dark-bg', !bgLight());
  groundReal.visible = real; groundShadow.visible = !real && !plan && st !== 'wire' && st !== 'xray';
  renderer.toneMappingExposure = real ? DISPLAY.exposure : 1.0;
  renderer.shadowMap.enabled = DISPLAY.shadows && st !== 'wire' && st !== 'xray' && !planOn();
  hemi.intensity = real ? 0.3 : st === 'sketch' ? 1.6 : 1.0;
  sun.color.set(real ? 0xFFF1DC : 0xffffff); sun.intensity = real ? 3.2 : st === 'sketch' ? 0.6 : 1.9;
  sun.castShadow = renderer.shadowMap.enabled;
  const dark = !bgLight();
  edgeMat.color.set(st === 'sketch' || st === 'wire' ? (st === 'wire' ? cssVar('--accent') || '#0877B9' : '#1B2333') : (cssVar('--edge') || '#24324F'));
  if (plan || (st !== 'wire' && dark)) edgeMat.color.set(dark ? '#D5D9DF' : '#1B2333');
  edgeMat.opacity = plan ? 0.9 : st === 'sketch' ? 0.95 : st === 'wire' ? 0.9 : st === 'realistic' ? 0.18 : dark ? 0.75 : 0.5;
  selEdgeMat.color.set(cssVar('--sel') || '#E2861B');
  const ac = new THREE.Color(cssVar('--accent') || '#0877B9'); ghostMat.color.copy(ac); ghostEdge.color.copy(ac);
  buildGrid(); positionSun(); dirty = true;
}
function setStyle(st){
  if (!STYLES[st]) return; DISPLAY.style = st; saveDisplay(); resetMats(); applyThemeToScene(); rebuild({noPanel:activeTab !== 'render'}); if (activeTab === 'render') renderPanel();
  $$('[data-style]').forEach(b => b.setAttribute('aria-pressed', b.dataset.style === st));
}
function buildGrid(){
  if (gridMajor){ scene.remove(gridMajor, gridMinor); gridMajor.geometry.dispose(); gridMinor.geometry.dispose(); }
  const b = bgColor(), L = bgLight(), gMin = shade(b, L ? -0.06 : 0.07), gMaj = shade(b, L ? -0.14 : 0.15);
  gridMinor = new THREE.GridHelper(60, 600, gMin, gMin);
  gridMajor = new THREE.GridHelper(200, 200, gMaj, gMaj);
  [gridMinor, gridMajor].forEach(g => { g.material.transparent = true; g.material.depthWrite = false; g.renderOrder = -1; scene.add(g); });
  gridMinor.material.opacity = 0.7; positionGrid();
}
function positionGrid(){
  if (!gridMajor) return; const y = lvlZ(curLvl) + 0.001, hide = DISPLAY.style === 'realistic' || view === 'render' || !SNAP.grid || !DISPLAY.grid || (view !== '2d' && state?.site?.terrain && DISPLAY.terrain !== false);
  gridMajor.position.y = y + 0.0005; gridMinor.position.y = y; gridMajor.visible = !hide; gridMinor.visible = !hide && (view === '2d' || step <= 0.1); dirty = true;
}

/* ---------- reconstruction ---------- */
let curLvl = 0, step = 0.05;
function rebuild(opts = {}){
  rebuildSeq++; disposeGroup(modelGroup);
  const plan = planOn(), cutZ = lvlZ(curLvl) + 1.5;
  for (const el of state.els){
    if (plan && el.lvl !== curLvl) continue; // plan : seulement le niveau courant
    if (isHidden(el)) continue;
    const g = new THREE.Group(); g.userData.id = el.id;
    const F = el.kind === 'inst' ? fam(el.fam) : null;
    const light = plan ? (el.kind === 'inst' && el.host ? PLAN_LIGHT.host : PLAN_LIGHT[el.kind] ?? 0) : 0;
    g.name = el.kind === 'inst' ? `${F?.nom || 'Composant'}-${el.id}` : `${KIND_NAME[el.kind]}-${el.id}`;
    g.userData.archiplan = {id:el.id, kind:el.kind, type:el.kind === 'inst' ? el.fam : (el.type || el.mat), niveau:lvlName(el.lvl)};
    if (el.kind === 'inst') instMeshes(el, false, light).forEach(m => { m.name = `${g.name}-${m.userData.mat}`; m.userData.archiplan = {materiau:mat(m.userData.mat).nom, lot:famLot(F)}; g.add(m); });
    else for (const pc of pieces(el)){ const m = pieceMesh(pc, false, light); m.name = `${g.name}-${pc.mat}`; m.userData.archiplan = {materiau:mat(pc.mat).nom, lot:pc.lot, epaisseur:pc.e ?? null}; g.add(m); }
    if (plan && new THREE.Box3().setFromObject(g).min.y > cutZ) overhead(g); // au-dessus du plan de coupe : contour en tirets
    modelGroup.add(g);
  }
  applySel(); updateSunTarget(); buildLabels(); if (!opts.noPanel) renderPanel(); updUndo(); save(); dirty = true;
  if (typeof buildTerrain === 'function') buildTerrain();
}
const dashMat = new THREE.LineDashedMaterial({color:0x4B5563, dashSize:0.18, gapSize:0.12});
function overhead(g){
  const lines = [];
  g.traverse(o => { if (o.isMesh){ const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), dashMat); e.computeLineDistances(); e.userData.isOver = true; lines.push(e); } });
  disposeGroup(g); lines.forEach(l => g.add(l)); g.userData.overhead = true;
}
function applySel(){
  const set = new Set([sel, ...multi].filter(Boolean));
  for (const g of modelGroup.children){
    const on = set.has(g.userData.id);
    g.traverse(o => { if (o.isMesh) o.material = matFor(o.userData.mat, on, o.userData.light || 0); if (o.userData.isEdge) o.material = on ? selEdgeMat : edgeMat; });
  }
  dirty = true;
}
function bbox(){ const b = new THREE.Box3().setFromObject(modelGroup); return b.isEmpty() ? new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5)) : b; }
function updateSunTarget(){ const b = bbox(), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); sun.target.position.copy(c);
  const R = Math.max(30, Math.max(s.x, s.z) * 0.8 + 10); Object.assign(sun.shadow.camera, {left:-R, right:R, top:R, bottom:-R}); sun.shadow.camera.updateProjectionMatrix(); positionSun(); }
function positionSun(){
  const az = DISPLAY.sunAz * Math.PI / 180, el = DISPLAY.sunEl * Math.PI / 180, d = 60, t = sun.target.position;
  // azimut depuis le nord (plan +y) dans le sens horaire ; plan (x, y) → scène (x, −z)
  sun.position.set(t.x + d * Math.cos(el) * Math.sin(az), t.y + d * Math.sin(el), t.z - d * Math.cos(el) * Math.cos(az));
  dirty = true;
}
function frameEl(ids){ // centrer la vue sur des éléments
  const set = new Set([].concat(ids)), b = new THREE.Box3();
  for (const g of modelGroup.children) if (set.has(g.userData.id)) b.expandByObject(g);
  if (b.isEmpty()) return toast('Élément masqué ou hors du niveau affiché');
  const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), r = Math.max(s.x, s.y, s.z, 1.2) * 1.4 + 1.5;
  if (view === '2d'){ c2.target.set(c.x, 0, c.z); ortho.position.set(c.x, 200, c.z); const w = vpEl.clientWidth || 800, h = vpEl.clientHeight || 600; ortho.zoom = Math.min(20 / (s.z + 2), 20 * (w / h) / (s.x + 2)); ortho.updateProjectionMatrix(); c2.update(); }
  else { const dir = persp.position.clone().sub(c3.target).normalize(); c3.target.copy(c); persp.position.copy(c).add(dir.multiplyScalar(r)); c3.update(); }
  dirty = true;
}
function fit(){
  const b = bbox(), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.z, 4) * 0.62 + 1;
  c3.target.copy(c); persp.position.set(c.x - r * 0.9, c.y + r * 1.1, c.z + r * 1.25); c3.update();
  c2.target.set(c.x, 0, c.z); ortho.position.set(c.x, 200, c.z);
  const w = vpEl.clientWidth || 800, h = vpEl.clientHeight || 600, aspect = w / h, viewH = 20;
  ortho.zoom = Math.min(viewH / (s.z + 3), viewH * aspect / (s.x + 3)); ortho.updateProjectionMatrix(); c2.update();
  dirty = true;
}
function camPreset(k){
  if (view === '2d') setView('3d');
  const b = bbox(), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), r = Math.max(s.x, s.z, s.y, 4) * 1.25 + 2;
  c3.target.copy(c);
  const P = {iso:[-0.75, 0.8, 0.95], front:[0, 0.12, 1], right:[1, 0.12, 0], back:[0, 0.12, -1], left:[-1, 0.12, 0], top:[0.0001, 1, 0.0001]}[k] || [-0.75, 0.8, 0.95];
  const v = new THREE.Vector3(...P).normalize().multiplyScalar(r); persp.position.copy(c).add(v); c3.update(); dirty = true;
}
function resize(){
  const w = vpEl.clientWidth, h = vpEl.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false);
  persp.aspect = w / h; persp.updateProjectionMatrix();
  const a = w / h; Object.assign(ortho, {left:-10 * a, right:10 * a, top:10, bottom:-10}); ortho.updateProjectionMatrix();
  dirty = true;
}
new ResizeObserver(resize).observe(vpEl);

/* ---------- cotes (étiquettes HTML) ---------- */
let labels = [];
const showDimsOn = () => DISPLAY.dims !== false;
function buildLabels(){
  const box = $('#labels'); box.textContent = ''; labels = [];
  const set = new Set([sel, ...multi].filter(Boolean));
  for (const el of state.els){
    const isSel = set.has(el.id);
    if (el.lvl !== curLvl && !isSel) continue;
    if (!(showDimsOn() && view === '2d') && !isSel) continue;
    const add = (pos, text) => { const d = document.createElement('div'); d.className = 'dim' + (isSel ? ' sel' : ''); d.textContent = text; box.appendChild(d); labels.push({d, pos}); };
    const y3 = lvlZ(el.lvl) + (el.off || 0) + (view !== '2d' ? (el.h || 0) + 0.15 : 0);
    if (el.kind === 'wall'){
      const {n, L} = wallAxis(el), T = wallT(el), side = el.flip ? 1 : -1;
      const m = V.add(V.mul(V.add(el.a, el.b), .5), V.mul(n, side * (T/2 + 0.28)));
      add(new THREE.Vector3(m[0], y3, -m[1]), nf(L));
    } else if (el.kind === 'slab' || el.kind === 'vol'){
      const r = rect(el.p, el.q), y = el.kind === 'slab' ? lvlZ(el.lvl) + (el.off || 0) : y3;
      add(new THREE.Vector3((r[0][0] + r[1][0]) / 2, y, -(r[0][1] - 0.3)), nf(r[1][0] - r[0][0]));
      add(new THREE.Vector3(r[1][0] + 0.35, y, -(r[1][1] + r[2][1]) / 2), nf(r[2][1] - r[1][1]));
    } else if (el.kind === 'col' && isSel){
      add(new THREE.Vector3(el.c[0], y3, -el.c[1]), `${nf(el.w)} × ${nf(el.d)}`);
    } else if (el.kind === 'inst' && (isSel || (view === '2d' && el.host))){
      const fr = instFrame(el), c = famCut(el); if (!fr) continue;
      const txt = c ? `${n0(c.w * 100)} × ${n0(c.h * 100)}` : fam(el.fam)?.nom || '';
      add(new THREE.Vector3(fr.o[0], fr.z + (view !== '2d' ? (c ? c.h + 0.1 : 1) : 0), -fr.o[1]), txt);
    }
  }
  dirty = true;
}
const tmpV = new THREE.Vector3();
function toScreen(v){ tmpV.copy(v).project(cam()); return [(tmpV.x + 1) / 2 * vpEl.clientWidth, (1 - tmpV.y) / 2 * vpEl.clientHeight, tmpV.z]; }
function updateLabels(){ for (const l of labels){ const [x, y, z] = toScreen(l.pos); l.d.style.left = x + 'px'; l.d.style.top = y + 'px'; l.d.hidden = z > 1 || z < -1; } }

/* ---------- capture d'image (rendu haute définition) ---------- */
async function captureImage(scale = 2){
  const w = vpEl.clientWidth, h = vpEl.clientHeight, k = Math.min(scale, 4096 / Math.max(w, h));
  const pr = renderer.getPixelRatio(); renderer.setPixelRatio(k); renderer.setSize(w, h, false);
  $('#labels').hidden = true; markGroup.visible = previewGroup.visible = false;
  renderer.render(scene, cam());
  const blob = await new Promise(res => renderer.domElement.toBlob(res, 'image/png'));
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); $('#labels').hidden = false; markGroup.visible = previewGroup.visible = true; dirty = true;
  return blob;
}
