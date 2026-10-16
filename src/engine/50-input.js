/* ============ Saisie : accroches (façon AutoCAD), repérage, outils de dessin et de modification ============ */
const SNAP = {osnap:true, end:true, mid:true, cen:true, int:true, perp:true, near:true, face:true, track:true, ortho:false, polar:true, polarInc:15, grid:true, surf:true};
try { Object.assign(SNAP, JSON.parse(localStorage.getItem('ap.snap') || '{}')); } catch(e){}
const saveSnap = () => { try { localStorage.setItem('ap.snap', JSON.stringify(SNAP)); } catch(e){} };
const SNAP_NAMES = {end:'Extrémité', mid:'Milieu', cen:'Centre', int:'Intersection', perp:'Perpendiculaire', near:'Proche', face:'Face de mur', track:'Repérage', polar:'Polaire', ortho:'Ortho', grid:'Grille', surf:'Surface'};
let tool = 'select';
const defs = {wall:{type:'MUR-EXT-01', h:2.7}, slab:{type:'DAL-BA-20'}, roof:{type:'TOIT-TUILE', h:2.7, shape:'2', pitch:35, ov:0.4, mode:'rect'}, stair:{st:'droit', side:'d', w:0.9, mat:'bois'}, vol:{type:'acier', h:0.5}, col:{type:'ba', h:2.7, w:0.25}, comp:{fam:'fenetre-2v', type:1, rot:0}};
let draw = {start:null, cursor:null, chainFirst:null, chainN:0, measure:null, snap:null, workZ:null, hostHit:null, track:[], base:null, copies:0};

/* ---------- rayon, plans de travail ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function setNdc(e){ const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam()); }
function planePt(e, z){ setNdc(e); const p = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -z), p) ? [p.x, -p.z] : null; }
function worldPerPx(){
  const h = vpEl.clientHeight || 600;
  if (view === '2d') return (ortho.top - ortho.bottom) / ortho.zoom / h;
  return 2 * persp.position.distanceTo(c3.target) * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)) / h;
}
function hitModel(e){
  setNdc(e);
  const hits = ray.intersectObjects(modelGroup.children, true).filter(h => h.object.isMesh && h.object.material.visible !== false);
  if (!hits.length) return null;
  const h = hits[0]; let o = h.object; while (o && o.userData.id === undefined) o = o.parent;
  const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
  return {id:o ? o.userData.id : null, point:h.point, normal:n, plan:[h.point.x, -h.point.z]};
}

/* ---------- géométrie d'accroche (mise en cache à chaque reconstruction) ---------- */
let snapGeo = null;
function snapData(){
  if (snapGeo && snapGeo.lvl === curLvl && snapGeo.n === state.els.length && snapGeo.v === rebuildSeq) return snapGeo;
  const ends = [], mids = [], cens = [], segs = [], faceSegs = [];
  for (const el of state.els){
    if (el.lvl !== curLvl) continue;
    const k = elKeyPoints(el);
    (k.ends || []).forEach(p => ends.push(p)); (k.mids || []).forEach(p => mids.push(p)); (k.centers || []).forEach(p => cens.push(p));
    (k.segs || []).forEach(s => segs.push(s)); (k.faces || []).forEach(s => faceSegs.push(s));
  }
  const all = segs.concat(faceSegs), ints = [];
  for (let i = 0; i < all.length && all.length < 400; i++) for (let j = i + 1; j < all.length; j++){
    const p = segInter(all[i][0], all[i][1], all[j][0], all[j][1]); if (p && !ends.some(q => V.eq(q, p))) ints.push(p);
  }
  return snapGeo = {lvl:curLvl, n:state.els.length, v:rebuildSeq, ends, mids, cens, segs, faceSegs, ints,
    faceEnds:faceSegs.flat(), faceMids:faceSegs.map(([a, b]) => V.mul(V.add(a, b), .5))};
}
let rebuildSeq = 0;
function snap(raw, opts = {}){
  const tol = 14 * worldPerPx(), D = snapData();
  const S = draw.start || draw.base;
  if (SNAP.osnap && !opts.noObj){
    const cands = [];
    const test = (pts, kind, pri) => { for (const p of pts){ const d = V.len(V.sub(p, raw)); if (d < tol) cands.push({pt:p, kind, pri, d}); } };
    if (SNAP.end){ test(D.ends, 'end', 0); if (draw.chainFirst) test([draw.chainFirst], 'end', 0); if (SNAP.face) test(D.faceEnds, 'end', 0.5); }
    if (SNAP.int) test(D.ints, 'int', 1);
    if (SNAP.mid){ test(D.mids, 'mid', 2); if (SNAP.face) test(D.faceMids, 'mid', 2.5); }
    if (SNAP.cen) test(D.cens, 'cen', 3);
    if (SNAP.perp && S) for (const [a, b] of D.segs.concat(SNAP.face ? D.faceSegs : [])){
      const c = segClosest(S, a, b); if (c.t > 0.001 && c.t < 0.999 && V.len(V.sub(c.pt, S)) > 0.01){ const d = V.len(V.sub(c.pt, raw)); if (d < tol) cands.push({pt:c.pt, kind:'perp', pri:4, d}); }
    }
    if (SNAP.near) for (const [a, b] of D.segs.concat(SNAP.face ? D.faceSegs : [])){ const c = segClosest(raw, a, b); const d = V.len(V.sub(c.pt, raw)); if (d < tol * 0.7) cands.push({pt:c.pt, kind:'near', pri:6, d}); }
    if (cands.length){
      cands.sort((x, y) => x.pri - y.pri || x.d - y.d); const c = cands[0];
      if (SNAP.track && c.kind !== 'near'){ draw.track = [c.pt, ...draw.track.filter(p => !V.eq(p, c.pt))].slice(0, 4); }
      return {pt:[rnd(c.pt[0]), rnd(c.pt[1])], how:SNAP_NAMES[c.kind], kind:c.kind};
    }
  }
  let pt = raw.slice(), how = '', kind = '', guides = [];
  // repérage : alignement horizontal / vertical sur un point acquis
  let tracked = false;
  if (SNAP.track && SNAP.osnap){
    const tl = tol * 0.8;
    for (const tp of draw.track.concat(S ? [S] : [])){
      if (Math.abs(raw[0] - tp[0]) < tl){ pt[0] = tp[0]; guides.push([tp, [tp[0], raw[1]]]); tracked = true; }
      if (Math.abs(raw[1] - tp[1]) < tl){ pt[1] = tp[1]; guides.push([tp, [raw[0], tp[1]]]); tracked = true; }
    }
    if (tracked){ how = SNAP_NAMES.track; kind = 'track'; }
  }
  if (S && !tracked && (SNAP.ortho || SNAP.polar) && !opts.noPolar){
    const d = V.sub(raw, S); let L = V.len(d), a = Math.atan2(d[1], d[0]);
    const inc = (SNAP.ortho ? 90 : SNAP.polarInc) * Math.PI / 180, ar = Math.round(a / inc) * inc;
    if (SNAP.ortho || Math.abs(ar - a) < 4 * Math.PI / 180){
      a = ar; if (SNAP.grid) L = Math.round(L / step) * step;
      pt = [S[0] + L * Math.cos(a), S[1] + L * Math.sin(a)]; how = SNAP.ortho ? 'Ortho' : `Polaire ${Math.round(((a * 180 / Math.PI) % 360 + 360) % 360)}°`; kind = 'polar';
      guides.push([S, V.add(S, V.mul([Math.cos(a), Math.sin(a)], Math.max(L, 1) * 3))]);
      return {pt:[rnd(pt[0]), rnd(pt[1])], how, kind, guides};
    }
  }
  if (!tracked && SNAP.grid){ pt = [Math.round(raw[0] / step) * step, Math.round(raw[1] / step) * step]; how = 'Grille'; kind = 'grid'; }
  return {pt:[rnd(pt[0]), rnd(pt[1])], how, kind, guides};
}

/* ---------- symboles d'accroche (SVG au-dessus de la vue) ---------- */
const GLYPH = {
  end:'<rect x="-6" y="-6" width="12" height="12"/>', mid:'<path d="M0-7 7 5H-7z"/>', cen:'<circle r="6.5"/>', int:'<path d="M-6-6 6 6M6-6-6 6"/>',
  perp:'<path d="M-6 6H6M-6 6V-6M-6 0H0V6"/>', near:'<path d="M-6-6H6L-6 6H6z"/>', track:'<path d="M-4 0H4M0-4V4"/>', polar:'<circle r="3"/>', grid:'<path d="M-3 0H3M0-3V3"/>', surf:'<path d="M-7 3 0-4 7 3 0 7z"/>',
};
function drawSnapGlyph(pt3, kind, label){
  const mk = $('#snapMk'); if (!mk) return;
  if (!pt3 || !kind){ mk.innerHTML = ''; return; }
  const [x, y, z] = toScreen(pt3); if (z > 1 || z < -1){ mk.innerHTML = ''; return; }
  mk.innerHTML = `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})" class="g-${kind}">${GLYPH[kind] || GLYPH.grid}</g>` +
    (label && kind !== 'grid' ? `<text x="${(x + 12).toFixed(1)}" y="${(y + 22).toFixed(1)}">${esc(label)}</text>` : '');
}

/* ---------- aperçu de construction ---------- */
function makeMarker(pt, color, z){
  const g = new THREE.Group(), y = (z ?? curZ()) + 0.01, s = 10 * worldPerPx();
  const ring = new THREE.Mesh(new THREE.RingGeometry(s * 0.45, s * 0.7, 24), new THREE.MeshBasicMaterial({color, depthTest:false, transparent:true}));
  ring.rotation.x = -Math.PI / 2; ring.position.set(pt[0], y, -pt[1]); ring.renderOrder = 10; g.add(ring);
  return g;
}
function lineObj(a, b, color, z, dashed = true){
  const y = (z ?? curZ()) + 0.02;
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], y, -a[1]), new THREE.Vector3(b[0], y, -b[1])]);
  const l = new THREE.Line(geo, dashed ? new THREE.LineDashedMaterial({color, dashSize:0.15, gapSize:0.08, depthTest:false, transparent:true, opacity:0.9}) : new THREE.LineBasicMaterial({color, depthTest:false}));
  l.computeLineDistances(); l.renderOrder = 10; return l;
}
const curZ = () => draw.workZ ?? lvlZ(curLvl);
const offFromZ = () => draw.workZ != null ? rnd(draw.workZ - lvlZ(curLvl)) : 0;
function tempEl(a, b){
  const lvl = curLvl, off = offFromZ();
  if (tool === 'wall') return {kind:'wall', type:defs.wall.type, a, b, h:defs.wall.h, lvl, off, flip:false};
  if (tool === 'slab') return {kind:'slab', type:defs.slab.type, p:a, q:b, lvl, off};
  if (tool === 'roof') return {kind:'roof', type:defs.roof.type, p:a, q:b, lvl, off:rnd(off + defs.roof.h), shape:defs.roof.shape, pitch:defs.roof.pitch, ov:defs.roof.ov};
  if (tool === 'stair'){ const t = {kind:'stair', st:defs.stair.st, side:defs.stair.side, w:defs.stair.w, mat:defs.stair.mat, lvl, off, rail:true, tremie:true, R:0.8, rot:0}; stairPlace(t, a || b, a ? b : null); return t; }
  if (tool === 'vol') return {kind:'vol', mat:defs.vol.type, p:a, q:b, h:defs.vol.h, lvl, off};
  if (tool === 'col') return {kind:'col', mat:defs.col.type, c:b, w:defs.col.w, d:defs.col.w, h:defs.col.h, lvl, off};
}
function updatePreview(){
  disposeGroup(previewGroup); disposeGroup(markGroup);
  const ac = cssVar('--accent') || '#0877B9', sc = cssVar('--sel') || '#E2861B', live = $('#live');
  const cur = draw.cursor;
  if (draw.measure){ markGroup.add(lineObj(draw.measure[0], draw.measure[1], sc, null, false)); markGroup.add(makeMarker(draw.measure[0], sc)); markGroup.add(makeMarker(draw.measure[1], sc)); }
  (draw.snap?.guides || []).forEach(([a, b]) => markGroup.add(lineObj(a, b, '#16A3A3')));
  if (!cur || tool === 'select'){ live.hidden = true; drawSnapGlyph(null); dirty = true; return; }
  let text = '';
  const S = draw.start || draw.base;
  if (tool === 'comp') text = previewComp(cur);
  else if (tool === 'stair'){ const t = draw.start ? tempEl(draw.start, cur) : tempEl(cur, null); for (const pc of pieces(t)) previewGroup.add(pieceMesh(pc, true)); const D = stairDims(t); text = `${STAIR_TYPES[t.st]} · ${D.n} marches de ${nf(D.h * 100, 1)} cm${draw.start ? ` · ${nf(t.rot, 0)}°` : ''}`; if (draw.start) markGroup.add(makeMarker(draw.start, ac)); }
  else if (tool === 'roof' && defs.roof.mode === 'walls'){
    const o = wallsOutline(curLvl); if (o){ const t = roofFromPoly(o); for (const pc of pieces(t)) previewGroup.add(pieceMesh(pc, true)); text = 'Cliquez pour poser la toiture sur les murs du niveau'; } else text = 'Aucun mur sur ce niveau';
  }
  else if (tool === 'roof' && defs.roof.mode === 'poly' && draw.poly?.length){
    const pts = [...draw.poly, cur]; for (let i = 0; i + 1 < pts.length; i++) markGroup.add(lineObj(pts[i], pts[i + 1], ac)); markGroup.add(makeMarker(draw.poly[0], ac));
    if (pts.length >= 3){ markGroup.add(lineObj(cur, draw.poly[0], ac, null, true)); if (pts.length >= 4){ const t = roofFromPoly(pts); try { for (const pc of pieces(t)) previewGroup.add(pieceMesh(pc, true)); } catch(e){} } }
    const d = V.sub(cur, draw.poly[draw.poly.length - 1]); text = `${nf(V.len(d))} m · ${draw.poly.length} point${draw.poly.length > 1 ? 's' : ''}`;
  }
  else if (S){
    markGroup.add(makeMarker(S, ac));
    const d = V.sub(cur, S), L = V.len(d);
    if (L > 0.005) markGroup.add(lineObj(S, cur, ac));
    if (tool === 'wall' && draw.arcB){ const B = draw.arcB, t = tempEl(S, B), m = V.mul(V.add(S, B), 0.5), {n} = wallAxis(t); t.bulge = rnd(V.dot(V.sub(cur, m), n)); for (const pc of pieces(t, state.els.concat([t]))) previewGroup.add(pieceMesh(pc, true)); markGroup.add(makeMarker(B, ac)); }
    else if (tool === 'wall' && L > 0.005){ const t = tempEl(S, cur); for (const pc of pieces(t, state.els.concat([t]))) previewGroup.add(pieceMesh(pc, true)); }
    if ((tool === 'slab' || tool === 'vol' || tool === 'roof') && Math.abs(d[0]) > 0.005 && Math.abs(d[1]) > 0.005){ const t = tempEl(S, cur); for (const pc of pieces(t)) previewGroup.add(pieceMesh(pc, true)); }
    if ((tool === 'move' || tool === 'copy') && L > 0.005) previewMove(d);
    if (tool === 'rotate') previewRotate(Math.atan2(d[1], d[0]));
    let ang = Math.atan2(d[1], d[0]) * 180 / Math.PI; if (ang < 0) ang += 360;
    text = (tool === 'slab' || tool === 'vol' || tool === 'roof') ? `${nf(Math.abs(d[0]))} × ${nf(Math.abs(d[1]))} m` : tool === 'rotate' ? `${nf(ang, 1)}°` : `${nf(L)} m · ${nf(ang, 1)}°`;
  } else {
    if (tool === 'col'){ const t = tempEl(null, cur); for (const pc of pieces(t)) previewGroup.add(pieceMesh(pc, true)); }
    text = `x ${nf(cur[0])} · y ${nf(cur[1])}${draw.workZ != null && Math.abs(draw.workZ - lvlZ(curLvl)) > 0.001 ? ` · z ${nf(draw.workZ)}` : ''}`;
  }
  const p3 = new THREE.Vector3(cur[0], curZ(), -cur[1]);
  drawSnapGlyph(p3, draw.snap?.kind, draw.snap?.how);
  const [sx, sy] = toScreen(p3);
  live.textContent = forTouch(text); live.style.left = sx + 'px'; live.style.top = sy + 'px'; live.hidden = !text;
  dirty = true;
}

/* ---------- composants (familles) : pose libre ou dans un mur ---------- */
function wallUnder(pt, e){
  // en 3D : mur touché par le rayon ; en plan : mur le plus proche de l'axe, à moins de l'épaisseur + tolérance
  if (e && view !== '2d'){ const h = hitModel(e); if (h?.id){ const el = getEl(h.id); if (el?.kind === 'wall') return el; if (el?.kind === 'inst' && el.host) return getEl(el.host); } }
  let best = null, bd = Infinity;
  for (const w of state.els){ if (w.kind !== 'wall' || w.lvl !== curLvl) continue; const c = segClosest(pt, w.a, w.b), d = V.len(V.sub(c.pt, pt)); if (d < wallT(w) / 2 + 12 * worldPerPx() && d < bd){ bd = d; best = w; } }
  return best;
}
function compPlacement(pt, e){
  const F = fam(defs.comp.fam); if (!F) return null;
  if (F.host !== 'wall') return {free:true, c:pt};
  const w = wallUnder(pt, e); if (!w) return {needWall:true};
  if (wallArc(w)) return {curved:true};
  const {u, n, L} = wallAxis(w), c = segClosest(pt, w.a, w.b);
  let t = c.t * L; if (SNAP.grid) t = Math.round(t / step) * step;
  const cut = famCut({fam:defs.comp.fam, type:defs.comp.type, params:{}});
  t = clamp(t, cut.w / 2 + 0.05, L - cut.w / 2 - 0.05);
  const side = V.dot(V.sub(pt, w.a), n) < 0;
  const clash = wallOpenings(w).some(o => t + cut.w / 2 > o.t0 + 1e-4 && t - cut.w / 2 < o.t1 - 1e-4);
  return {host:w.id, t:rnd(t), flip:side, w, cut, clash, tooBig:cut.w + 0.1 > L || cut.sill + cut.h > w.h + 1e-6};
}
function previewComp(cur){
  const pl = compPlacement(cur, draw.lastEvt); if (!pl) return '';
  const F = fam(defs.comp.fam);
  if (pl.needWall) return `${F.nom} : survolez un mur`;
  if (pl.curved) return 'Pas d\'ouverture dans un mur courbe';
  const el = pl.free ? {kind:'inst', fam:defs.comp.fam, type:defs.comp.type, params:{}, c:pl.c, rot:defs.comp.rot, lvl:curLvl, off:offFromZ()}
    : {kind:'inst', fam:defs.comp.fam, type:defs.comp.type, params:{}, host:pl.host, t:pl.t, lvl:curLvl, off:0, flip:pl.flip};
  instMeshes(el, true).forEach(m => previewGroup.add(m));
  if (pl.host){ // ouverture fantôme
    const fr = instFrame(el); markGroup.add(makeMarker(fr.o, pl.clash || pl.tooBig ? '#C0392B' : cssVar('--accent'), lvlZ(pl.w.lvl)));
    return pl.tooBig ? 'Trop grand pour ce mur' : pl.clash ? 'Chevauche une autre ouverture' : `${F.nom} · à ${nf(pl.t)} m du départ du mur`;
  }
  return `${F.nom} · rotation ${nf(defs.comp.rot, 0)}°`;
}
function placeComp(pt){
  const pl = compPlacement(pt, draw.lastEvt); if (!pl) return;
  if (pl.needWall) return toast('Cette famille se pose dans un mur : cliquez sur un mur.');
  if (pl.curved) return toast('Les ouvertures ne se posent pas dans un mur courbe.');
  if (pl.tooBig) return toast('Ouverture trop grande pour ce mur.');
  if (pl.clash) return toast('Une autre ouverture occupe déjà cet emplacement.');
  if (pl.free) addEl({kind:'inst', fam:defs.comp.fam, type:defs.comp.type, params:{}, c:pt, rot:defs.comp.rot, lvl:curLvl, off:offFromZ(), mirror:false});
  else addEl({kind:'inst', fam:defs.comp.fam, type:defs.comp.type, params:{}, host:pl.host, t:pl.t, lvl:getEl(pl.host).lvl, off:0, flip:pl.flip, mirror:false});
  toast(`${fam(defs.comp.fam).nom} posé`);
}

/* ---------- déplacer, copier, rotation ---------- */
const selIds = () => [...new Set([sel, ...multi].filter(Boolean))];
function movedEl(el, d){
  const m = JSON.parse(JSON.stringify(el)), mv = p => [rnd(p[0] + d[0]), rnd(p[1] + d[1])];
  if (m.kind === 'wall'){ m.a = mv(m.a); m.b = mv(m.b); }
  else if (m.kind === 'slab' || m.kind === 'vol' || m.kind === 'roof'){ m.p = mv(m.p); m.q = mv(m.q); if (m.poly) m.poly = m.poly.map(mv); }
  else if (m.kind === 'col' || m.kind === 'stair') m.c = mv(m.c);
  else if (m.kind === 'inst'){ if (m.host){ const w = getEl(m.host); if (w){ const {u} = wallAxis(w); m.t = rnd((m.t || 0) + V.dot(d, u)); } } else m.c = mv(m.c); }
  return m;
}
function rotatedEl(el, base, ang){
  const m = JSON.parse(JSON.stringify(el)), rp = p => { const r = V.add(base, V.rot(V.sub(p, base), ang)); return [rnd(r[0]), rnd(r[1])]; };
  if (m.kind === 'wall'){ m.a = rp(m.a); m.b = rp(m.b); }
  else if (m.kind === 'slab' || m.kind === 'vol' || m.kind === 'roof'){ const r = rect(m.p, m.q).map(rp); m.p = [Math.min(...r.map(p => p[0])), Math.min(...r.map(p => p[1]))]; m.q = [Math.max(...r.map(p => p[0])), Math.max(...r.map(p => p[1]))]; if (m.kind === 'roof' && Math.abs(Math.sin(ang)) > 0.7 && !m.poly){ const G = roofGeom(el); m.dir = G.ax ? 'y' : 'x'; } if (m.poly) m.poly = m.poly.map(rp); }
  else if (m.kind === 'stair'){ m.c = rp(m.c); m.rot = ((m.rot || 0) + ang * 180 / Math.PI + 360) % 360; }
  else if (m.kind === 'col'){ m.c = rp(m.c); if (Math.abs(Math.sin(ang)) > 0.7) [m.w, m.d] = [m.d, m.w]; }
  else if (m.kind === 'inst' && !m.host){ m.c = rp(m.c); m.rot = ((m.rot || 0) + ang * 180 / Math.PI) % 360; }
  return m;
}
const rectOnly = () => selIds().some(id => ['slab', 'vol', 'col', 'roof'].includes(getEl(id)?.kind));
function previewMove(d){ for (const id of selIds()){ const el = getEl(id); if (!el) continue; const m = movedEl(el, d); if (m.kind === 'inst') instMeshes(m, true).forEach(x => previewGroup.add(x)); else pieces(m).forEach(pc => previewGroup.add(pieceMesh(pc, true))); } }
function previewRotate(a){ if (rectOnly()) a = Math.round(a / (Math.PI / 2)) * (Math.PI / 2); for (const id of selIds()){ const el = getEl(id); if (!el || (el.kind === 'inst' && el.host)) continue; const m = rotatedEl(el, draw.base, a); if (m.kind === 'inst') instMeshes(m, true).forEach(x => previewGroup.add(x)); else pieces(m).forEach(pc => previewGroup.add(pieceMesh(pc, true))); } }
function applyMove(d, copy){
  pushHist(); const ids = selIds(), map = {}, created = [];
  for (const id of ids){
    const el = getEl(id); if (!el) continue; const m = movedEl(el, d);
    if (copy){ m.id = state.nextId++; map[id] = m.id; state.els.push(m); created.push(m.id); }
    else Object.assign(el, m);
  }
  if (copy) state.els.forEach(e => { if (e.kind === 'inst' && e.host && map[e.host] && created.includes(e.id) === false && ids.includes(e.id) === false){
    const c = JSON.parse(JSON.stringify(e)); c.id = state.nextId++; c.host = map[e.host]; state.els.push(c); } });
  state.isSample = false; rebuild();
}
function applyRotate(a){
  if (rectOnly()) a = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  pushHist(); for (const id of selIds()){ const el = getEl(id); if (!el || (el.kind === 'inst' && el.host)) continue; Object.assign(el, rotatedEl(el, draw.base, a)); }
  state.isSample = false; rebuild();
}

/* ---------- Pousser / Tirer (façon SketchUp) ---------- */
let push = null;
function pushStart(e){
  if (view === '2d'){ toast('Pousser/Tirer s\'utilise en vue 3D'); return false; }
  const h = hitModel(e); if (!h?.id) return false;
  const el = getEl(h.id); if (!el || el.kind === 'inst' && el.host) return false;
  const up = h.normal.y > 0.85, down = h.normal.y < -0.85, side = Math.abs(h.normal.y) < 0.2;
  if (side && !(el.kind === 'vol' || el.kind === 'slab')) return false;
  if (!up && !down && !side) return false;
  pushHist();
  const base = h.point.clone(), p1 = toScreen(base), p2 = toScreen(base.clone().add(up || down ? new THREE.Vector3(0, 1, 0) : h.normal.clone().setY(0).normalize()));
  const ppm = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, dir = [(p2[0] - p1[0]) / ppm, (p2[1] - p1[1]) / ppm];
  push = {el, orig:JSON.parse(JSON.stringify(el)), x:e.clientX, y:e.clientY, ppm, dir, mode:up ? 'up' : down ? 'down' : 'side', n:[h.normal.x, -h.normal.z]};
  c3.enabled = false; return true;
}
function pushMove(e){
  if (!push) return;
  const dx = e.clientX - push.x, dy = e.clientY - push.y, along = (dx * push.dir[0] + dy * push.dir[1]) / push.ppm;
  let v = SNAP.grid ? Math.round(along / step) * step : along; const el = push.el, o = push.orig;
  if (push.mode === 'up'){
    if (el.kind === 'slab') el.off = rnd(o.off + v); else if (el.kind === 'inst') el.off = rnd(o.off + v); else el.h = rnd(Math.max(0.01, o.h + v));
  } else if (push.mode === 'down'){
    if (el.kind === 'slab') el.off = rnd(o.off - v); else { const nh = Math.max(0.01, o.h + v); el.off = rnd(o.off - (nh - o.h)); el.h = rnd(nh); }
  } else {
    const r = rect(o.p, o.q), n = push.n; let [x0, y0] = r[0], [x1, y1] = r[2];
    if (Math.abs(n[0]) > 0.7){ if (n[0] > 0) x1 = Math.max(x0 + 0.01, x1 + v); else x0 = Math.min(x1 - 0.01, x0 - v); }
    else { if (n[1] > 0) y1 = Math.max(y0 + 0.01, y1 + v); else y0 = Math.min(y1 - 0.01, y0 - v); }
    el.p = [rnd(x0), rnd(y0)]; el.q = [rnd(x1), rnd(y1)];
  }
  $('#live').textContent = `${v >= 0 ? '+' : ''}${nf(v)} m`; const [sx, sy] = [e.clientX - canvas.getBoundingClientRect().left, e.clientY - canvas.getBoundingClientRect().top];
  $('#live').style.left = sx + 'px'; $('#live').style.top = sy + 'px'; $('#live').hidden = false;
  rebuild({noPanel:true});
}
function pushEnd(){ if (!push) return; push = null; c3.enabled = view !== '2d'; state.isSample = false; rebuild(); $('#live').hidden = true; }

/* ---------- outils ---------- */
const PROMPTS = {
  select:() => 'Sélection : cliquez un élément (Maj pour en ajouter). Clic droit : déplacer la vue, ou tourner autour de l\'élément sélectionné.',
  wall:() => defs.wall.arc ? (draw.arcB ? '<b>Mur courbe</b> : un point de la courbe (sa flèche)' : draw.start ? '<b>Mur courbe</b> : point d\'arrivée' : '<b>Mur courbe</b> : point de départ') : draw.start ? '<b>Mur</b> : point suivant, longueur, ou <code>longueur&lt;angle</code>' : '<b>Mur</b> : premier point (ou x;y)',
  slab:() => draw.start ? '<b>Dalle</b> : coin opposé, ou <code>L;l</code>' : '<b>Dalle</b> : premier coin (ou x;y)',
  roof:() => defs.roof.mode === 'walls' ? '<b>Toit sur les murs</b> : cliquez dans le modèle pour poser la toiture sur le contour des murs du niveau' : defs.roof.mode === 'poly' ? (draw.poly?.length ? `<b>Toit (contour)</b> : point suivant ; cliquez le premier point ou <kbd>Entrée</kbd> pour fermer` : '<b>Toit (contour)</b> : premier angle du contour des murs (côtés parallèles aux axes)') : draw.start ? '<b>Toit</b> : coin opposé du contour des murs, ou <code>L;l</code>' : '<b>Toit</b> : premier coin du contour des murs (ou x;y) · forme, pente et débord dans la barre et les propriétés',
  cut:() => draw.start ? '<b>Coupe</b> : second point du trait de coupe (on regarde vers la gauche du trait)' : '<b>Coupe</b> : premier point du trait de coupe',
  stair:() => draw.start ? '<b>Escalier</b> : direction de la montée (clic ou angle)' : '<b>Escalier</b> : point de départ (coin gauche de la première marche ; centre pour un colimaçon)',
  vol:() => draw.start ? '<b>Volume</b> : coin opposé, ou <code>L;l</code>' : '<b>Volume</b> : premier coin (ou x;y)',
  col:() => '<b>Poteau</b> : position du centre (ou x;y)',
  comp:() => fam(defs.comp.fam)?.host === 'wall' ? `<b>${esc(fam(defs.comp.fam)?.nom)}</b> : cliquez dans un mur, du côté où elle s'ouvre` : `<b>${esc(fam(defs.comp.fam)?.nom || 'Composant')}</b> : point d'insertion · <kbd>Espace</kbd> pivote de 90°`,
  push:() => '<b>Pousser/Tirer</b> : glissez la face supérieure (hauteur) ou une face latérale d\'une dalle ou d\'un volume',
  move:() => !selIds().length ? '<b>Déplacer</b> : sélectionnez d\'abord les éléments' : draw.base ? '<b>Déplacer</b> : point de destination, ou <code>@dx;dy</code>' : '<b>Déplacer</b> : point de base',
  copy:() => !selIds().length ? '<b>Copier</b> : sélectionnez d\'abord les éléments' : draw.base ? '<b>Copier</b> : points de destination (Échap pour finir)' : '<b>Copier</b> : point de base',
  rotate:() => !selIds().length ? '<b>Rotation</b> : sélectionnez d\'abord les éléments' : draw.base ? '<b>Rotation</b> : angle (clic ou degrés)' : '<b>Rotation</b> : centre de rotation',
  measure:() => draw.start ? '<b>Mesure</b> : second point' : '<b>Mesure</b> : premier point',
};
function setPrompt(){
  $('#prompt').innerHTML = forTouch(PROMPTS[tool]());
  $('#endBtn').hidden = !((tool === 'wall' && draw.start) || (tool === 'copy' && draw.base));
  $('#closeBtn').hidden = !((tool === 'wall' && draw.chainN >= 2 && draw.chainFirst && !V.eq(draw.chainFirst, draw.start || [1e9, 1e9])) || (tool === 'roof' && (draw.poly?.length || 0) >= 4));
}
function cancelDraw(){ draw.arcB = null; draw.poly = null; draw.start = null; draw.chainFirst = null; draw.chainN = 0; draw.snap = null; draw.base = null; draw.copies = 0; draw.workZ = null; draw.track = []; updatePreview(); setPrompt(); }
function setTool(t){
  if (!PROMPTS[t]) return;
  tool = t; cancelDraw(); draw.cursor = null; draw.measure = null; updatePreview();
  $$('.tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
  canvas.style.cursor = t === 'select' ? 'default' : t === 'push' ? 'ns-resize' : 'crosshair';
  if (t === 'comp' && activeTab !== 'lib'){ activeTab = 'lib'; libTab = 'fams'; renderPanel(); }
  syncHud(); setPrompt();
}
function syncHud(){
  const tSel = $('#typeSel'), tp = $('#typePill'), hp = $('#hPill');
  let opts = null, cur = null, lbl = 'Type';
  if (tool === 'wall'){ opts = Object.entries(libCompos()).filter(([, v]) => v.kind === 'wall').map(([k, v]) => [k, v.nom]); cur = defs.wall.type; lbl = 'Mur'; }
  else if (tool === 'slab'){ opts = Object.entries(libCompos()).filter(([, v]) => v.kind === 'slab').map(([k, v]) => [k, v.nom]); cur = defs.slab.type; lbl = 'Plancher'; }
  else if (tool === 'roof'){ opts = Object.entries(libCompos()).filter(([, v]) => v.kind === 'roof').map(([k, v]) => [k, v.nom]); cur = defs.roof.type; lbl = 'Toiture'; }
  else if (tool === 'vol' || tool === 'col'){ opts = Object.entries(libMats()).map(([k, v]) => [k, v.nom]).sort((a, b) => a[1].localeCompare(b[1], 'fr')); cur = defs[tool].type; lbl = 'Matériau'; }
  else if (tool === 'comp'){ const F = fam(defs.comp.fam); opts = (F?.types || []).map((t, i) => [i, `${F.nom} · ${t.nom}`]); cur = defs.comp.type; lbl = 'Type'; }
  tp.hidden = !opts;
  if (opts){ tSel.innerHTML = opts.map(([k, n]) => `<option value="${esc(k)}"${String(k) === String(cur) ? ' selected' : ''}>${esc(n)}</option>`).join(''); $('#typeLbl').textContent = lbl; }
  hp.hidden = !(tool === 'wall' || tool === 'vol' || tool === 'col' || tool === 'roof');
  if (!hp.hidden) $('#hIn').value = defs[tool].h;
  $('#hLbl').textContent = tool === 'roof' ? 'Égout' : 'H'; $('#wallArcPill').hidden = tool !== 'wall'; if (tool === 'wall') $('#wArcIn').value = defs.wall.arc ? '1' : ''; $('#stairPill').hidden = tool !== 'stair'; if (tool === 'stair'){ $('#sTypeIn').value = defs.stair.st; $('#sSideIn').value = defs.stair.side; $('#sMatIn').value = defs.stair.mat; } $('#roofPill').hidden = tool !== 'roof'; $('#roofModePill').hidden = tool !== 'roof'; if (tool === 'roof') $('#rModeIn').value = defs.roof.mode;
  if (tool === 'roof'){ $('#rShapeIn').value = defs.roof.shape; $('#rPitchIn').value = defs.roof.pitch; }
}
function placePoint(pt){
  const S = draw.start;
  if (tool === 'wall' && defs.wall.arc && S){
    if (!draw.arcB){ if (V.len(V.sub(pt, S)) > 0.01) draw.arcB = pt; }
    else { const B = draw.arcB, t = tempEl(S.slice(), B.slice()), m = V.mul(V.add(S, B), 0.5), {n} = wallAxis(t); t.bulge = rnd(V.dot(V.sub(pt, m), n)); addEl(t); draw.chainN++; draw.start = B; draw.arcB = null; }
  } else if (tool === 'wall'){
    if (!S){ draw.start = pt; draw.chainFirst = pt; draw.chainN = 0; }
    else if (V.len(V.sub(pt, S)) > 0.01){
      addEl(tempEl(S.slice(), pt.slice())); draw.chainN++;
      if (draw.chainFirst && V.eq(pt, draw.chainFirst) && draw.chainN > 1){ cancelDraw(); toast('Contour fermé'); return; }
      draw.start = pt;
    }
  } else if (tool === 'cut'){
    if (!S) draw.start = pt; else if (V.len(V.sub(pt, S)) > 0.1){ const a = S; draw.start = null; addCut(a, pt); return; }
  } else if (tool === 'stair'){
    if (!S) draw.start = pt; else { addEl(tempEl(S, pt)); draw.start = null; draw.workZ = null; rebuild(); }
  } else if (tool === 'roof' && defs.roof.mode !== 'rect'){
    if (defs.roof.mode === 'walls'){ const o = wallsOutline(curLvl); if (!o) toast('Aucun mur sur ce niveau'); else addRoof(o); }
    else { draw.poly ??= [];
      if (draw.poly.length >= 3 && V.len(V.sub(pt, draw.poly[0])) < 0.05) finishRoofPoly();
      else if (!draw.poly.length || V.len(V.sub(pt, draw.poly[draw.poly.length - 1])) > 0.01) draw.poly.push(pt); }
  } else if (tool === 'slab' || tool === 'vol' || tool === 'roof'){
    if (!S) draw.start = pt;
    else if (Math.abs(pt[0] - S[0]) > 0.01 && Math.abs(pt[1] - S[1]) > 0.01){ const r = rect(S, pt), t = tempEl(r[0], r[2]); if (t.kind === 'roof') roofFitWalls(t); addEl(t); draw.start = null; draw.workZ = null; }
    else toast('Le rectangle doit avoir deux côtés non nuls');
  } else if (tool === 'col'){ addEl(tempEl(null, pt)); }
  else if (tool === 'comp'){ placeComp(pt); }
  else if (tool === 'measure'){
    if (!S){ draw.start = pt; draw.measure = null; }
    else { const d = V.sub(pt, S); draw.measure = [S, pt]; toast(`Distance ${nf(V.len(d), 3)} m · Δx ${nf(d[0], 3)} · Δy ${nf(d[1], 3)}`); draw.start = null; }
  } else if (tool === 'move' || tool === 'copy' || tool === 'rotate'){
    if (!selIds().length){ toast('Sélectionnez d\'abord les éléments (outil Sélection, Maj pour plusieurs)'); return; }
    if (!draw.base){ draw.base = pt; }
    else if (tool === 'rotate'){ applyRotate(Math.atan2(pt[1] - draw.base[1], pt[0] - draw.base[0])); draw.base = null; }
    else { const d = V.sub(pt, draw.base); if (V.len(d) > 1e-4){ applyMove(d, tool === 'copy'); draw.copies++; } if (tool === 'move') draw.base = null; }
  }
  draw.cursor = pt; updatePreview(); setPrompt();
}

/* ---------- ligne de commande : 4,2 · 4,2<90 · @5;3 · 2;3 · commandes (MUR, DEP, CO, RO, PP, ZE…) ---------- */
const CMDS = {mur:'wall', m:'wall', dalle:'slab', d:'slab', toit:'roof', toiture:'roof', t:'roof', escalier:'stair', e:'stair', poteau:'col', p:'col', volume:'vol', b:'vol', composant:'comp', f:'comp', fenetre:'comp', porte:'comp',
  coupe:'cut', k:'cut', deplacer:'move', dep:'move', g:'move', copier:'copy', co:'copy', c:'copy', rotation:'rotate', ro:'rotate', o:'rotate', pp:'push', pousser:'push', u:'push', mesure:'measure', di:'measure', r:'measure', selection:'select', v:'select'};
function parseCmd(raw){
  let s = raw.trim(); if (!s) return null;
  const rel = s.startsWith('@'); if (rel) s = s.slice(1).trim();
  if (s.includes('<')){ const [a, b] = s.split('<'); const A = num(b); const L = a.trim() === '' ? NaN : num(a); return Number.isNaN(A) ? null : {polar:L, ang:A}; }
  let parts = s.split(/[;\s]+/).filter(Boolean);
  if (parts.length === 1 && /^-?\d*\.?\d+,-?\d*\.?\d+$/.test(s) && s.includes('.')) parts = s.split(',');
  if (parts.length === 2){ const x = num(parts[0]), y = num(parts[1]); return Number.isNaN(x) || Number.isNaN(y) ? null : {x, y, rel}; }
  if (parts.length === 1){ const L = num(parts[0]); return Number.isNaN(L) ? null : {len:L}; }
  return null;
}
function runCmd(){
  const inp = $('#cmd'), raw = inp.value.trim();
  const word = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/^[a-z]+$/.test(word)){
    inp.value = '';
    if (word === 'ze' || word === 'zoom') return fit();
    if (word === 'u' && !draw.start) return undo();
    if (CMDS[word]) return setTool(CMDS[word]);
    return toast('Commande inconnue. Exemples : MUR, DALLE, TOIT, DEP, CO, RO, PP, ZE');
  }
  const c = parseCmd(raw);
  if (!c){ if (raw) toast('Saisie non reconnue. Exemples : 4,20 · 4,2<90 · @5;3'); return; }
  if (tool === 'select'){ toast('Choisissez d\'abord un outil'); return; }
  if (tool === 'comp' && 'polar' in c && !Number.isNaN(c.ang)){ defs.comp.rot = c.ang; inp.value = ''; updatePreview(); toast(`Rotation ${nf(c.ang, 0)}°`); return; }
  if (tool === 'rotate' && draw.base && ('len' in c || 'polar' in c)){ inp.value = ''; const a = ('len' in c ? c.len : c.ang) * Math.PI / 180; applyRotate(a); draw.base = null; setPrompt(); return; }
  if (tool === 'stair' && draw.start && 'polar' in c){ inp.value = ''; const a = c.ang * Math.PI / 180; placePoint([draw.start[0] + Math.cos(a), draw.start[1] + Math.sin(a)]); return; }
  if (tool === 'push'){ toast('Pousser/Tirer : glissez une face dans la vue 3D'); return; }
  let pt = null; const S = draw.start || draw.base || (tool === 'roof' && draw.poly?.length ? draw.poly[draw.poly.length - 1] : null);
  if (!S || tool === 'col' || tool === 'comp'){
    if ('x' in c) pt = [c.x, c.y]; else { toast('Entrez une position x;y, par exemple 0;0'); return; }
  } else {
    if ('polar' in c){ const a = c.ang * Math.PI / 180; const L = Number.isNaN(c.polar) ? 1 : c.polar; pt = [S[0] + L * Math.cos(a), S[1] + L * Math.sin(a)]; }
    else if ('x' in c) pt = [S[0] + c.x, S[1] + c.y];
    else if ('len' in c){
      if (tool === 'slab' || tool === 'vol' || tool === 'roof'){ toast('Entrez les deux côtés : L;l'); return; }
      let dir = draw.cursor ? V.sub(draw.cursor, S) : [1, 0]; if (V.len(dir) < 1e-6) dir = [1, 0];
      pt = V.add(S, V.mul(dir, c.len / V.len(dir)));
    }
  }
  inp.value = '';
  placePoint([rnd(pt[0]), rnd(pt[1])]);
}

/* ---------- pointeur ---------- */
let down = null;
function cursorPoint(e){
  // en 3D, accroche aux surfaces : face supérieure touchée = plan de travail à sa hauteur
  draw.lastEvt = e;
  if (view !== '2d' && SNAP.surf && tool !== 'select' && tool !== 'push' && tool !== 'comp' && !draw.start && !draw.base){
    const h = hitModel(e);
    if (h && h.normal.y > 0.85) draw.workZ = h.point.y; else draw.workZ = null;
  }
  return planePt(e, curZ());
}
/* clic droit en 3D avec une sélection : rotation autour du centre de la sélection (pivot) ; sans sélection : déplacement de la vue */
function selCenter(){ const set = new Set(selIds()), b = new THREE.Box3(); for (const g of modelGroup.children) if (set.has(g.userData.id)) b.expandByObject(g); return b.isEmpty() ? null : b.getCenter(new THREE.Vector3()); }
canvas.addEventListener('pointerdown', e => {
  if (view === '2d' || e.button !== 2){ c3.mouseButtons.RIGHT = THREE.MOUSE.PAN; return; }
  const c = selIds().length ? selCenter() : null;
  if (!c){ c3.mouseButtons.RIGHT = THREE.MOUSE.PAN; return; }
  c3.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  if (c.distanceTo(c3.target) > 0.05){ const d = persp.position.distanceTo(c3.target); c3.target.copy(c); if (persp.position.distanceTo(c) < 0.5) persp.position.add(persp.getWorldDirection(new THREE.Vector3()).multiplyScalar(-Math.max(2, d))); c3.update(); dirty = true; }
}, {capture:true});
canvas.addEventListener('pointerdown', e => {
  down = {x:e.clientX, y:e.clientY, t:performance.now(), b:e.button};
  if (tool === 'push' && e.button === 0 && pushStart(e)){ down.push = true; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointermove', e => {
  if (push){ pushMove(e); return; }
  const g = cursorPoint(e);
  if (g) $('#coords').textContent = `x ${nf(g[0])} · y ${nf(g[1])}${draw.workZ != null ? ` · z ${nf(draw.workZ)}` : ''}`;
  if (tool === 'select' || tool === 'push' || !g) { if (tool === 'push' && view !== '2d'){ const h = hitModel(e); canvas.style.cursor = h?.id ? 'ns-resize' : 'default'; } return; }
  if (e.pointerType === 'touch' && !draw.start && !draw.base) return;
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
  const s = tool === 'comp' ? {pt:g, how:'', kind:''} : snap(g);
  draw.cursor = s.pt; draw.snap = s; updatePreview();
});
canvas.addEventListener('pointerup', e => {
  if (push){ pushEnd(); down = null; return; }
  if (!down) return; const d = down; down = null;
  const longTouch = e.pointerType !== 'mouse' && tool === 'select' && performance.now() - d.t >= 480 && performance.now() - d.t < 1500;
  if (d.b !== 0 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7 || (performance.now() - d.t > 700 && !longTouch)) return;
  if (longTouch){ pick(e, true); try { navigator.vibrate?.(12); } catch(_){} return; }   // appui long au doigt : ajouter / retirer de la sélection
  if (tool === 'select' || tool === 'push'){ pick(e); return; }
  const g = cursorPoint(e); if (!g) return;
  const s = tool === 'comp' ? {pt:g} : snap(g); draw.snap = s; placePoint(s.pt);
});
canvas.addEventListener('dblclick', () => { if (tool === 'wall' && draw.start) cancelDraw(); else if (tool === 'select' && sel){ const el = getEl(sel); if (el?.kind === 'inst' && !el.host){ pushHist(); el.rot = ((el.rot || 0) + 90) % 360; rebuild(); } } });
canvas.addEventListener('pointerleave', () => { if (tool !== 'select'){ $('#live').hidden = true; drawSnapGlyph(null); } });
canvas.addEventListener('contextmenu', e => e.preventDefault());
function pick(e, add = false){
  const h = hitModel(e); const id = h?.id ?? null;
  if (add && !id) return;
  if ((e.shiftKey || add) && id){ if (sel === id){ sel = multi.shift() || null; } else if (multi.includes(id)) multi = multi.filter(x => x !== id); else { if (sel) multi.push(sel); sel = id; } }
  else { sel = id; multi = []; }
  activeTab = 'props'; applySel(); buildLabels(); renderPanel();
  if (id && isNarrow.matches && !add) openSheet(true);   // appui long : on compose la sélection sans ouvrir le panneau
}
function select(id){ sel = id; multi = []; activeTab = 'props'; if (id) revealInTree(id); applySel(); buildLabels(); renderPanel(); requestAnimationFrame(() => $('#pbody .tree .tr.on')?.scrollIntoView({block:'nearest'})); }
function deleteSel(){ const ids = selIds(); if (!ids.length) return; pushHist(); removeEls(ids); sel = null; multi = []; rebuild(); toast(ids.length > 1 ? `${ids.length} éléments supprimés` : 'Élément supprimé'); }

/* ---------- toiture sur contour ---------- */
function roofFromPoly(pts){
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const t = {kind:'roof', type:defs.roof.type, p:[Math.min(...xs), Math.min(...ys)], q:[Math.max(...xs), Math.max(...ys)], lvl:curLvl, off:rnd(offFromZ() + defs.roof.h), shape:defs.roof.shape, pitch:defs.roof.pitch, ov:defs.roof.ov};
  const isRect = pts.length === 4 && isOrtho(pts);
  if (!isRect) t.poly = pts.map(q => [rnd(q[0]), rnd(q[1])]);
  roofFitWalls(t); return t;
}
function addRoof(pts){ const t = roofFromPoly(pts); addEl(t); if (t.poly && !isOrtho(t.poly)) toast('Contour non orthogonal : la toiture couvre son rectangle englobant'); }
function finishRoofPoly(){ const p = draw.poly || []; if (p.length < 4){ toast('Il faut au moins 4 points'); return; } addRoof(p.slice()); draw.poly = null; draw.workZ = null; updatePreview(); setPrompt(); }
