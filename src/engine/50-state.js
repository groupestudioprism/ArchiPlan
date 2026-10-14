/* ============ Projet : état, historique, chargement du site, dessin des éléments du chantier ============ */
let state = null, sel = null, quiet = false;
const hist = [], redoS = [];
const blankState = (name = 'Nouveau chantier') => ({v:1, app:'architrafic', name, site:null, els:[], legend:{show:true, title:'Légende', pos:null, custom:[], hide:[]}, sim:{dens:1, mix:{vl:78, vul:11, pl:6, bus:3, r2:2}}, meta:{moa:'', entreprise:'', from:'', to:'', arrete:'', notes:''}});
function migrate(s){
  const b = blankState(s?.name || 'Chantier'); if (!s || typeof s !== 'object') return b;
  const o = {...b, ...s, legend:{...b.legend, ...(s.legend || {})}, sim:{...b.sim, ...(s.sim || {}), mix:{...b.sim.mix, ...(s.sim?.mix || {})}}, meta:{...b.meta, ...(s.meta || {})}};
  o.els = Array.isArray(s.els) ? s.els.filter(e => e && e.t && e.id) : []; return o;
}
const byId = id => state.els.find(e => e.id === id);
function save(){ if (!quiet) window.dispatchEvent(new Event('ap:changed')); }
function commit(label){ hist.push(JSON.stringify({els:state.els, legend:state.legend, meta:state.meta})); if (hist.length > 80) hist.shift(); redoS.length = 0; save(); syncUndo(); }
function snapshot(){ return JSON.stringify({els:state.els, legend:state.legend, meta:state.meta}); }
let lastSnap = null;
function beginEdit(){ lastSnap = snapshot(); }
function endEdit(){ if (lastSnap && lastSnap !== snapshot()){ hist.push(lastSnap); if (hist.length > 80) hist.shift(); redoS.length = 0; } lastSnap = null; save(); syncUndo(); }
function edit(fn){ beginEdit(); fn(); endEdit(); rebuildProj(); refreshPanel(); }
function undo(){ if (!hist.length) return; redoS.push(snapshot()); restore(hist.pop()); }
function redo(){ if (!redoS.length) return; hist.push(snapshot()); restore(redoS.pop()); }
function restore(js){ const o = JSON.parse(js); state.els = o.els; state.legend = o.legend; state.meta = o.meta; if (sel && !byId(sel)) sel = null; rebuildProj(); refreshPanel(); save(); syncUndo(); }
function syncUndo(){ $('#undo').disabled = !hist.length; $('#redo').disabled = !redoS.length; }

/* ---------- chargement de la zone du chantier ---------- */
const AREA_SIZES = [300, 500, 800, 1200];
function loadUI(on, title = '', step = '', pct = 0){ const b = $('#loadBox'); b.hidden = !on; if (!on) return; $('#loadTitle').textContent = title; $('#loadStep').textContent = step; $('#loadBar').style.width = Math.round(pct * 100) + '%'; }
let loadToken = 0;
async function loadSite(force = false){
  const s = state.site; if (!s?.lat){ WORLD = null; buildWorld(); rebuildProj(); return; }
  const tok = ++loadToken, size = s.size || 500, P = makeProj(s.lat, s.lon), key = `site|${DATA_VER}|${s.lat.toFixed(5)}|${s.lon.toFixed(5)}|${size}`;
  simStop(true);
  let raw = force ? null : await IDB.get(key);
  if (raw && Date.now() - raw.at > 30 * 864e5) raw = null;   // plus de 30 jours : on remet à jour
  try {
    if (!raw){
      const B = areaBounds(P, size + 120); raw = {at:Date.now(), src:{}};
      loadUI(true, 'Chargement de la zone', 'Rues, sens uniques et carrefours (OpenStreetMap)…', 0.08);
      const osmP = loadOSM(B).then(j => { raw.osm = j; raw.src.osm = 'OpenStreetMap'; });
      const bdtP = loadBDTopo(areaBounds(P, size + 40)).then(f => { raw.bdt = f; }).catch(() => { raw.bdt = []; });
      loadUI(true, 'Chargement de la zone', 'Relief et altitudes NGF (IGN RGE ALTI®)…', 0.18);
      const el = await loadElevation(P, size, p => { if (tok === loadToken) loadUI(true, 'Chargement de la zone', 'Relief et altitudes NGF (IGN RGE ALTI®)…', 0.18 + p * 0.3); });
      raw.elev = {N:el.N, z:Array.from(el.z, v => Math.round(v * 100) / 100)}; raw.src.elev = el.src;
      if (tok !== loadToken) return;
      loadUI(true, 'Chargement de la zone', 'Bâtiments (IGN BD TOPO®) et voirie (OpenStreetMap)…', 0.55);
      await Promise.all([osmP, bdtP]);
      if (tok !== loadToken) return;
      IDB.set(key, raw);
    }
    loadUI(true, 'Construction du site en 3D', 'Voirie, trottoirs, bâtiments, arbres…', 0.8); await sleep(30);
    const W = parseWorld(raw, P, size);
    const z = Float32Array.from(raw.elev.z), N = raw.elev.N, mid = Math.floor(N / 2), z0 = z[mid * N + mid];
    WORLD = {size, P, z0, elev:{N, z}, W, src:{...raw.src, bld:W.src.bld, at:raw.at}};
    buildNet(W); orthoTex = null; orthoState = '';
    buildWorld(); rematchClosures(); rebuildProj(); fit(); refreshPanel();
    loadUI(false); toast(`Zone chargée : ${W.roads.filter(r => r.drive).length} voies, ${W.bld.length} bâtiments, altitude NGF ${nf(z0, 2)} m au point d'origine.`, 5200);
  } catch(e){
    console.error(e); loadUI(false);
    if (tok === loadToken){ toast('Impossible de charger la zone : vérifiez la connexion, puis réessayez (onglet Projet → Mettre à jour).', 7000); WORLD = WORLD || null; refreshPanel(); }
  }
}
/* routes barrées : les nœuds OSM peuvent changer entre deux mises à jour → on les retrouve par leur position */
function rematchClosures(){
  for (const c of state.els) if (c.t === 'closure'){
    if (c.ids?.every(id => NET.nodes.has(id))) continue;
    const a = c.pts?.[0], b = c.pts?.[c.pts.length - 1]; if (!a || !b) continue;
    const near = q => { let best = null, bd = 12; for (const [id, n] of NET.nodes){ const d = V.dist(n.xy, q); if (d < bd){ bd = d; best = id; } } return best; };
    const A = near(a), B = near(b); if (A == null || B == null) continue;
    const r = route(A, B, closedSets([]), {}); if (r && r.len < plLen(c.pts) * 1.5 + 20){ c.ids = r.ids; c.pts = r.pts; }
  }
}

/* ---------- hauteur de pose : chaussée, trottoir ou sol ---------- */
function surfaceZ(x, y){
  const z = H(x, y); if (!WORLD) return 0;
  const nr = nearestRoad([x, y], 8, false); if (!nr) return z;
  const d = V.dist(nr.pt, [x, y]), hw = nr.r.w / 2;
  if (d <= hw) return z + 0.05;
  if (!nr.r.foot && d < hw + 3.2 && d > hw + 0.3 && nr.r.cls <= 6 && !/^(no|none|separate)$/.test(nr.r.sidewalk)) return z + 0.15;
  return z;
}
/* orientation automatique d'un panneau : face au trafic qui arrive, sur le bord droit */
function autoOrient(x, y){
  const nr = nearestRoad([x, y], 14); if (!nr) return null;
  const side = V.cross(nr.dir, V.sub([x, y], nr.pt)) < 0 ? 1 : -1;     // 1 : à droite du sens de saisie de la voie
  const d = side > 0 ? nr.dir : V.mul(nr.dir, -1);                      // sens de circulation qui longe ce bord
  if (nr.r.oneway && side < 0 && nr.r.oneway > 0) return Math.atan2(-nr.dir[1], -nr.dir[0]);
  return Math.atan2(-d[1], -d[0]);                                       // la face (+x) regarde les véhicules qui arrivent
}

/* ---------- dessin des éléments du projet ---------- */
const projCache = new Map();
const closedTex = () => TEX.closed ??= (() => { const t = canvasTex(128, 128, (g, w, h) => { g.fillStyle = 'rgba(211,47,47,.55)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 14; for (let i = -2; i < 4; i++){ g.beginPath(); g.moveTo(i * 64, h); g.lineTo(i * 64 + h, 0); g.stroke(); } }); t.repeat.set(1 / 3, 1 / 3); return t; })();
const zoneTex = () => TEX.zone ??= (() => { const t = canvasTex(128, 128, (g, w, h) => { g.fillStyle = 'rgba(242,138,26,.28)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(242,138,26,.85)'; g.lineWidth = 6; for (let i = -2; i < 4; i++){ g.beginPath(); g.moveTo(i * 64, h); g.lineTo(i * 64 + h, 0); g.stroke(); } }); t.repeat.set(1 / 4, 1 / 4); return t; })();
function chevronTex(col){ const key = 'chev|' + col; return TEX[key] ??= (() => { const t = canvasTex(128, 64, (g, w, h) => { g.fillStyle = col; g.globalAlpha = 0.92; g.fillRect(0, 0, w, h); g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineJoin = 'miter'; g.beginPath(); g.moveTo(38, 12); g.lineTo(70, 32); g.lineTo(38, 52); g.stroke(); }); t.repeat.set(1 / 6, 1 / 3.2); return t; })(); }
function ribbonMesh(pts, w, mat, dz = 0.12, off = 0){
  const gb = new GB(); bandGB(gb, off ? plOffset(pts, off) : pts, -w / 2, w / 2, dz); if (gb.empty) return null;
  const g = gb.geo(), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) + 0); const m = new THREE.Mesh(g, mat); m.renderOrder = 2; return m;
}
function placeObj(grp, x, y, a, dz = 0){ grp.position.set(x, surfaceZ(x, y) + dz, -y); grp.rotation.y = a; return grp; }
function elSig(e){ return JSON.stringify(e) + (WORLD ? WORLD.z0 + WORLD.size : '') + DISPLAY.style; }
function buildEl(e){
  const g = new THREE.Group(); g.userData.id = e.id;
  if (e.t === 'obj'){ const L = LIBK[e.k]; if (!L) return g; const o = L.build(e.p || {}); o.traverse(m => { if (m.isMesh) m.userData.id = e.id; }); g.add(o); placeObj(g, e.x, e.y, e.a || 0, e.dz || 0);
    if (L.sign){ // en plan : symbole du panneau vu de face, à l'échelle du plan
      const sp = new THREE.Sprite(MAT['spr|' + L.sign + JSON.stringify(e.p || {})] ??= new THREE.SpriteMaterial({map:signFaceTex(L.sign, e.p || {}), depthTest:false})); const sh = signShape(L.sign), ar = sh.s === 'rect' ? sh.ar || 1.6 : 1;
      sp.scale.set(2.2 * ar, 2.2, 1); sp.position.set(0, 3, 0); sp.renderOrder = 20; sp.userData = {planOnly:true, id:e.id}; sp.visible = view === '2d'; g.add(sp); }
    return g; }
  if (e.t === 'model'){ const o = MODELS.get(e.key); if (o){ const c = o.clone(true); c.traverse(m => { if (m.isMesh) m.userData.id = e.id; }); g.add(c); } else { const ph = part(BOX(6, 3, 6), matCol(0x9AB0C8, {opacity:0.35, depthWrite:false}), 0, 1.5, 0); ph.userData.id = e.id; g.add(ph); }
    g.position.set(e.x, (e.zAbs != null && WORLD ? e.zAbs - WORLD.z0 : H(e.x, e.y)), -e.y); g.rotation.y = e.a || 0; return g; }
  if (e.t === 'closure' && e.pts?.length > 1){
    const w = closureWidth(e) + 0.4, m = ribbonMesh(e.pts, w, MAT.closed ??= new THREE.MeshBasicMaterial({map:closedTex(), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-6, polygonOffsetUnits:-6}), 0.14);
    if (m){ m.userData.id = e.id; g.add(m); }
    if (e.mode === 'sens'){ const p = e.dir === -1 ? e.pts.slice().reverse() : e.pts, mid = plAt(p, plLen(p) / 2), a = Math.atan2(mid.dir[1], mid.dir[0]), ar = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 3), matCol(0xD32F2F)); ar.rotation.set(0, a, -Math.PI / 2); ar.position.set(mid.pt[0], H(mid.pt[0], mid.pt[1]) + 0.3, -mid.pt[1]); ar.scale.y = 0.3; g.add(ar); }
    return g;
  }
  if (e.t === 'detour' && e.pts?.length > 1){
    const col = e.col || '#F28A1A', m = ribbonMesh(e.pts, 1.6, MAT['det|' + col] ??= new THREE.MeshBasicMaterial({map:chevronTex(col), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-8, polygonOffsetUnits:-8}), 0.16, -(e.off ?? 1.4));
    if (m){ m.userData.id = e.id; g.add(m); } return g;
  }
  if (e.t === 'zone' && e.pts?.length > 2){
    const gb = new GB(); try { polyGB(gb, e.pts, [], 0.1); } catch(err){}
    if (!gb.empty){ const m = new THREE.Mesh(gb.geo(), MAT.zone ??= new THREE.MeshBasicMaterial({map:zoneTex(), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-5, polygonOffsetUnits:-5})); m.userData.id = e.id; m.renderOrder = 1; g.add(m); }
    const ring = [...e.pts, e.pts[0]], ob = ribbonMesh(ring, 0.25, matCol(0xF28A1A, {po:-7}), 0.13); if (ob){ ob.userData.id = e.id; g.add(ob); }
    if (e.fence){ const mod = herasModule(); lineModules(g, ring, mod.grp, mod.len, e.id); }
    return g;
  }
  if (e.t === 'line' && e.pts?.length > 1){
    const T = LINE_TYPES[e.k] || LINE_TYPES.cones;
    if (T.item){ const L = plLen(e.pts), sp = e.sp || T.sp; for (let s = 0; s <= L + 0.01; s += sp){ const a = plAt(e.pts, Math.min(s, L)), o = LIBK[T.item].build({}); o.traverse(m => { if (m.isMesh) m.userData.id = e.id; }); placeObj(o, a.pt[0], a.pt[1], Math.atan2(a.dir[1], a.dir[0])); g.add(o); } }
    else if (T.mod === 'k16'){ const m = k16Module(); lineModules(g, e.pts, null, m.len, e.id, (i) => part(m.geo, i % 2 ? C.white : C.red)); }
    else if (T.mod === 'gba'){ const m = gbaModule(); lineModules(g, e.pts, null, m.len, e.id, () => part(m.geo, C.concrete)); }
    else if (T.mod === 'heras'){ const m = herasModule(); lineModules(g, e.pts, m.grp, m.len, e.id); }
    else if (T.mod === 'vauban'){ const m = vaubanModule(); lineModules(g, e.pts, m.grp, m.len, e.id); }
    else if (T.mod === 'k2'){ lineModules(g, e.pts, barrierK2(2), 2.05, e.id); }
    else if (T.mod === 'tape'){ const L = plLen(e.pts); for (let s = 0; s <= L + 0.01; s += 3){ const a = plAt(e.pts, Math.min(s, L)), p = part(CYL(0.02, 0.02, 1.1, 6), C.white, 0, 0.55, 0); const o = new THREE.Group(); o.add(p); placeObj(o, a.pt[0], a.pt[1], 0); o.traverse(m => { if (m.isMesh) m.userData.id = e.id; }); g.add(o); }
      const gb = new GB(); const p = densify(e.pts, 3); for (let i = 0; i + 1 < p.length; i++){ const a = p[i], b = p[i + 1], za = surfaceZ(a[0], a[1]) + 1.0, zb = surfaceZ(b[0], b[1]) + 1.0, n = V.mul(V.perp(V.norm(V.sub(b, a))), 0.0); gb.quad(P3(a[0], a[1], za), P3(b[0], b[1], zb), P3(b[0], b[1], zb + 0.07), P3(a[0], a[1], za + 0.07), [0, 0], [V.dist(a, b), 0], [V.dist(a, b), 1], [0, 1]); }
      if (!gb.empty){ const m = new THREE.Mesh(gb.geo(), MAT.tape ??= new THREE.MeshStandardMaterial({map:stripeTex('#E53935', '#FFFFFF', true, 6), side:THREE.DoubleSide, roughness:0.6})); m.userData.id = e.id; g.add(m); } }
    return g;
  }
  if (e.t === 'arrow' && e.pts?.length > 1){
    const col = e.col || '#1565C0', w = e.w || 1.2, L = plLen(e.pts), head = Math.min(w * 3, L * 0.4), body = plSlice(e.pts, 0, L - head * 0.9);
    const m = ribbonMesh(body, w, matCol(new THREE.Color(col).getHex(), {po:-9, rough:0.7}), 0.18); if (m){ m.userData.id = e.id; g.add(m); }
    const end = plAt(e.pts, L), base = V.sub(end.pt, V.mul(end.dir, head)), n = V.perp(end.dir), gb = new GB(), A = V.add(base, V.mul(n, w * 1.4)), B = V.sub(base, V.mul(n, w * 1.4)), z = q => H(q[0], q[1]) + 0.185;
    gb.tri(P3(B[0], B[1], z(B)), P3(end.pt[0], end.pt[1], z(end.pt)), P3(A[0], A[1], z(A)), [0, 0], [1, 0], [0, 1]); const hm = new THREE.Mesh(gb.geo(), matCol(new THREE.Color(col).getHex(), {po:-9, rough:0.7, side:THREE.DoubleSide})); hm.userData.id = e.id; g.add(hm); return g;
  }
  if (e.t === 'dim' && e.a && e.b){
    const m = ribbonMesh([e.a, e.b], 0.12, matCol(0x111827, {po:-9}), 0.2); if (m){ m.userData.id = e.id; g.add(m); }
    const d = V.norm(V.sub(e.b, e.a)), n = V.perp(d); for (const q of [e.a, e.b]){ const t = ribbonMesh([V.add(q, V.mul(n, -0.9)), V.add(q, V.mul(n, 0.9))], 0.12, matCol(0x111827, {po:-9}), 0.2); if (t){ t.userData.id = e.id; g.add(t); } } return g;
  }
  if (e.t === 'swept' && e.env){
    const gb = new GB(); try { polyGB(gb, [...e.env.l, ...e.env.r.slice().reverse()], [], 0.17); } catch(err){}
    if (!gb.empty){ const m = new THREE.Mesh(gb.geo(), matCol(0x7B1FA2, {opacity:0.28, depthWrite:false, po:-9})); m.userData.id = e.id; g.add(m); }
    for (const side of [e.env.l, e.env.r]){ const m = ribbonMesh(side, 0.14, matCol(0x7B1FA2, {po:-10}), 0.19); if (m){ m.userData.id = e.id; g.add(m); } }
    for (const tr of e.env.tracks || []){ const m = ribbonMesh(tr, 0.08, matCol(0x4A148C, {po:-10}), 0.19); if (m){ m.userData.id = e.id; g.add(m); } }
    const v = sweptVehicle(e.veh); if (v && e.pose){ const o = v.build(); o.traverse(mm => { if (mm.isMesh){ mm.userData.id = e.id; mm.material = mm.material.clone(); mm.material.transparent = true; mm.material.opacity = 0.55; } }); placeObj(o, e.pose[0], e.pose[1], e.pose[2]); g.add(o); }
    return g;
  }
  if (e.t === 'note'){ const pin = part(CYL(0.05, 0.05, 2.2, 6), matCol(new THREE.Color(e.col || '#1565C0').getHex()), 0, 1.1, 0); pin.userData.id = e.id; g.add(pin); g.position.set(e.x, H(e.x, e.y), -e.y); return g; }
  return g;
}
function lineModules(g, pts, tpl, len, id, make){
  const L = plLen(pts); let i = 0;
  for (let s = len / 2; s < L; s += len){ const a = plAt(pts, s), o = make ? (() => { const gg = new THREE.Group(); gg.add(make(i)); return gg; })() : tpl.clone(true); o.traverse(m => { if (m.isMesh) m.userData.id = id; });
    placeObj(o, a.pt[0], a.pt[1], Math.atan2(a.dir[1], a.dir[0]) + Math.PI / 2); g.add(o); i++; }
}
function closureWidth(c){ let w = 0; for (let i = 0; i + 1 < (c.ids?.length || 0); i++){ const s = NET.segIdx.get(segKey(c.ids[i], c.ids[i + 1])); if (s) w = Math.max(w, NET.roads[s.ri].w); } return w || 6; }
function rebuildProj(){
  const keep = new Set();
  for (const e of state?.els || []){
    const sig = elSig(e); let c = projCache.get(e.id);
    if (!c || c.sig !== sig){ if (c){ projGroup.remove(c.grp); c.grp.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); } let grp; try { grp = buildEl(e); } catch(err){ console.warn('élément', e, err); grp = new THREE.Group(); } c = {sig, grp}; projCache.set(e.id, c); projGroup.add(grp); }
    if (e.hidden) c.grp.visible = false; else c.grp.visible = true;
    keep.add(e.id);
  }
  for (const [id, c] of projCache) if (!keep.has(id)){ projGroup.remove(c.grp); c.grp.traverse(o => o.geometry?.dispose()); projCache.delete(id); }
  applySel(); renderLegend(); simNetworkChanged(); dirty = true;
}
/* sélection : contour orange */
const selBox = new THREE.Box3Helper(new THREE.Box3(), 0xF28A1A); selBox.visible = false; markGroup.add(selBox);
function applySel(){
  const c = sel && projCache.get(sel); if (!c){ selBox.visible = false; dirty = true; return; }
  const b = new THREE.Box3().setFromObject(c.grp); if (b.isEmpty()){ selBox.visible = false; return; }
  b.expandByScalar(0.25); selBox.box.copy(b); selBox.visible = true; dirty = true;
}
