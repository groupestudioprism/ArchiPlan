/* ============ Esquisse 3D (façon Shapr3D) ============
   On choisit un plan de travail en touchant une face (sol, dalle, mur, forme, toit), on y dessine des contours (lignes, rectangles,
   cercles, arcs, ou main levée au stylet : le trait est reconnu en rectangle, cercle ou polygone), puis on tire chaque face fermée
   pour en faire un solide (kind 'sk' : profil 2D dans un repère 3D + épaisseur). Un contour dessiné à l'intérieur d'un autre
   devient un trou. Souris, doigt et stylet : un appui bref place un point, un trait continu dessine à main levée.
   Élément : {kind:'sk', mat, lvl, off, fr:{o:[x,y,z], u:[x,y,z], v:[x,y,z]} (z relatif au niveau), poly:[[a,b]…], holes:[[[a,b]…]], d, dir:±1} */
const SK_MODES = {sel:'Sélection / tirer', line:'Ligne / polygone', rect:'Rectangle', circ:'Cercle', arc:'Arc (3 points)', free:'Main levée (stylet)'};
const SK = {on:false, fr:null, mode:'rect', pts:[], ents:[], faceSel:-1, stroke:null, pull:null, grid:null, hover:null};
const skGroup = new THREE.Group(); skGroup.name = 'esquisse'; scene.add(skGroup);
const v3 = p => new THREE.Vector3(p[0], p[2], -p[1]);   // plan (x, y, z haut) → three.js
const p3 = v => [v.x, -v.z, v.y];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const skN = fr => norm3(cross3(fr.u, fr.v));
const skPt = (fr, a, b) => [fr.o[0] + a * fr.u[0] + b * fr.v[0], fr.o[1] + a * fr.u[1] + b * fr.v[1], fr.o[2] + a * fr.u[2] + b * fr.v[2]];
/* repère d'un plan de travail : normale donnée → u horizontal, v « vers le haut » (ou y pour un plan horizontal) */
function skFrame(o, n){
  n = norm3(n); let u, v;
  if (Math.abs(n[2]) > 0.9){ const s = n[2] > 0 ? 1 : -1; u = [1, 0, 0]; v = [0, s, 0]; }   // sol / dessus : x, y (dessous : y inversé pour garder la normale)
  else { u = norm3(cross3([0, 0, 1], n)); v = norm3(cross3(n, u)); }
  return {o:o.slice(), u, v};
}
/* ---------- solide extrudé : géométrie, pièces, points d'accroche ---------- */
function skGeo(el){
  const fr = el.fr, n = skN(fr), d = Math.max(0.005, el.d || 0.1), dir = el.dir || 1, z0 = lvlZ(el.lvl) + (el.off || 0);
  const shape = new THREE.Shape(el.poly.map(p => new THREE.Vector2(p[0], p[1])));
  for (const h of el.holes || []) shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
  const g = new THREE.ExtrudeGeometry(shape, {depth:d, bevelEnabled:false});
  const U = v3([fr.u[0], fr.u[1], fr.u[2]]).sub(new THREE.Vector3()), Vv = v3(fr.v), N = v3([n[0] * dir, n[1] * dir, n[2] * dir]), O = v3([fr.o[0], fr.o[1], fr.o[2] + z0]);
  const M = new THREE.Matrix4().makeBasis(U, Vv, N).setPosition(O); g.applyMatrix4(M); g.computeVertexNormals();
  return g;
}
function skPieces(el){
  const fr = el.fr, n = skN(fr), d = Math.max(0.005, el.d || 0.1), dir = el.dir || 1, z0 = lvlZ(el.lvl) + (el.off || 0);
  const top = el.poly.map(([a, b]) => { const p = skPt(fr, a, b); return [p[0], p[1], p[2] + z0]; }), ext = [n[0] * d * dir, n[1] * d * dir, n[2] * d * dir];
  const A = Math.abs(area(el.poly)) - (el.holes || []).reduce((s, h) => s + Math.abs(area(h)), 0);
  return [{mat:el.mat || 'acier', poly:top.map(p => [p[0], p[1]]), top, ext, base:Math.min(...top.map(p => p[2]), ...top.map(p => p[2] + ext[2])), h:d, vol:A * d, lot:'Gros œuvre', sk:el}];
}
function skKeyPoints(el){ const pc = skPieces(el)[0], r = pc.poly; return {ends:r, segs:r.map((p, i) => [p, r[(i + 1) % r.length]]), mids:[], centers:[polyCentroid(r)]}; }
/* ---------- session d'esquisse ---------- */
let skMat = new THREE.LineBasicMaterial({color:0x0E7490, depthTest:false, transparent:true}), skMatSel = new THREE.LineBasicMaterial({color:0xE2861B, depthTest:false}),
  skFill = new THREE.MeshBasicMaterial({color:0x22B8CF, transparent:true, opacity:0.18, side:THREE.DoubleSide, depthTest:false}), skFillSel = new THREE.MeshBasicMaterial({color:0xE2861B, transparent:true, opacity:0.3, side:THREE.DoubleSide, depthTest:false});
function skStart(fr){ SK.on = true; SK.fr = fr; SK.pts = []; SK.ents = []; SK.faceSel = -1; SK.stroke = null; SK.pull = null; skDraw(); setPrompt(); syncHud(); }
function skEnd(){ if (SK.ents.some(e => e.closed)) toast('Contours non extrudés abandonnés'); SK.on = false; SK.fr = null; SK.pts = []; SK.ents = []; SK.faceSel = -1; SK.stroke = null; SK.pull = null; disposeGroup(skGroup); c3.enabled = view !== '2d'; dirty = true; }
/* point du plan sous le pointeur : (a, b) dans le repère du plan, aimanté à la grille et aux sommets déjà dessinés */
function skHit(e, raw = false){
  setNdc(e); const fr = SK.fr, n = v3(skN(fr)), o = v3([fr.o[0], fr.o[1], fr.o[2] + lvlZ(curLvl)]), pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, o), P = new THREE.Vector3();
  if (!ray.ray.intersectPlane(pl, P)) return null; const d = p3(P), rel = [d[0] - fr.o[0], d[1] - fr.o[1], d[2] - lvlZ(curLvl) - fr.o[2]];
  let a = rel[0] * fr.u[0] + rel[1] * fr.u[1] + rel[2] * fr.u[2], b = rel[0] * fr.v[0] + rel[1] * fr.v[1] + rel[2] * fr.v[2];
  if (raw) return [a, b];
  const tol = 12 * worldPerPx(); let best = null;
  for (const ent of SK.ents) for (const p of ent.pts){ const dd = Math.hypot(p[0] - a, p[1] - b); if (dd < tol && (!best || dd < best.d)) best = {p, d:dd}; }
  if (SK.pts.length){ const p = SK.pts[0], dd = Math.hypot(p[0] - a, p[1] - b); if (dd < tol && (!best || dd < best.d)) best = {p, d:dd}; }
  if (best) return best.p.slice();
  if (SNAP.grid){ a = Math.round(a / step) * step; b = Math.round(b / step) * step; }
  return [rnd(a), rnd(b)];
}
const skCircle = (c, r, n = 40) => Array.from({length:n}, (_, i) => { const t = i / n * Math.PI * 2; return [rnd(c[0] + r * Math.cos(t)), rnd(c[1] + r * Math.sin(t))]; });
function skArc(A, B, C){ // arc passant par 3 points
  const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])); if (Math.abs(d) < 1e-9) return [A, C];
  const ux = ((A[0] ** 2 + A[1] ** 2) * (B[1] - C[1]) + (B[0] ** 2 + B[1] ** 2) * (C[1] - A[1]) + (C[0] ** 2 + C[1] ** 2) * (A[1] - B[1])) / d, uy = ((A[0] ** 2 + A[1] ** 2) * (C[0] - B[0]) + (B[0] ** 2 + B[1] ** 2) * (A[0] - C[0]) + (C[0] ** 2 + C[1] ** 2) * (B[0] - A[0])) / d;
  const r = Math.hypot(A[0] - ux, A[1] - uy), a0 = Math.atan2(A[1] - uy, A[0] - ux), a1 = Math.atan2(B[1] - uy, B[0] - ux), a2 = Math.atan2(C[1] - uy, C[0] - ux);
  const ccw = ((a1 - a0 + 2 * Math.PI) % (2 * Math.PI)) < ((a2 - a0 + 2 * Math.PI) % (2 * Math.PI)); let sweep = ((a2 - a0) * (ccw ? 1 : -1) + 2 * Math.PI) % (2 * Math.PI);
  const n = Math.max(4, Math.ceil(sweep / (Math.PI / 16))), out = []; for (let i = 0; i <= n; i++){ const t = a0 + (ccw ? 1 : -1) * sweep * i / n; out.push([rnd(ux + r * Math.cos(t)), rnd(uy + r * Math.sin(t))]); } return out;
}
/* trait à main levée → forme reconnue : cercle, rectangle, polygone fermé ou polyligne */
function skRecognize(raw){
  if (raw.length < 3) return null;
  const simp = (pts, tol) => { // Douglas–Peucker
    if (pts.length < 3) return pts.slice(); let imax = 0, dmax = 0; const A = pts[0], B = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++){ const d = Math.abs(V.cross(V.sub(B, A), V.sub(pts[i], A))) / (V.len(V.sub(B, A)) || 1e-9); if (d > dmax){ dmax = d; imax = i; } }
    if (dmax > tol){ const L = simp(pts.slice(0, imax + 1), tol), R = simp(pts.slice(imax), tol); return [...L.slice(0, -1), ...R]; } return [A, B]; };
  const L = raw.reduce((s, p, i) => i ? s + V.len(V.sub(p, raw[i - 1])) : 0, 0), tol = Math.max(0.04, L * 0.025), closed = V.len(V.sub(raw[0], raw[raw.length - 1])) < Math.max(0.15, L * 0.12);
  let pts = simp(raw, tol); if (closed && pts.length > 2) pts = pts.slice(0, -1);
  if (closed && raw.length > 12){ // cercle : distances au centre peu dispersées
    const c = polyCentroid(raw), rs = raw.map(p => V.len(V.sub(p, c))), m = rs.reduce((s, r) => s + r, 0) / rs.length, dev = Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / rs.length);
    if (dev / m < 0.1 && pts.length >= 5) return {kind:'circ', pts:skCircle([rnd(c[0]), rnd(c[1])], rnd(m)), closed:true};
  }
  if (closed && pts.length === 4){ // rectangle : angles proches de 90°, aligné sur les axes du plan si l'écart est faible
    const ang = pts.map((p, i) => { const a = pts[(i + 3) % 4], b = pts[(i + 1) % 4], u = V.norm(V.sub(a, p)), w = V.norm(V.sub(b, p)); return Math.abs(V.dot(u, w)); });
    if (ang.every(x => x < 0.25)){ const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), ax = Math.abs(V.norm(V.sub(pts[1], pts[0]))[0]);
      if (ax > 0.9 || ax < 0.1){ const r = rect([Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]); return {kind:'rect', pts:r.map(p => [rnd(p[0]), rnd(p[1])]), closed:true}; }
      return {kind:'poly', pts:pts.map(p => [rnd(p[0]), rnd(p[1])]), closed:true}; }
  }
  if (closed && pts.length >= 3) return {kind:'poly', pts:pts.map(p => [rnd(p[0]), rnd(p[1])]), closed:true};
  return {kind:'line', pts:pts.map(p => [rnd(p[0]), rnd(p[1])]), closed:false};
}
/* faces fermées : contour extérieur + trous (contours contenus) ; la face choisie en orange */
function skFaces(){
  const closed = SK.ents.map((e, i) => ({i, e})).filter(x => x.e.closed && x.e.pts.length >= 3), faces = [];
  for (const {i, e} of closed){
    const c = polyCentroid(e.pts), inside = closed.filter(o => o.i !== i && ptInPoly(c[0], c[1], o.e.pts) && Math.abs(area(o.e.pts)) > Math.abs(area(e.pts)));
    if (inside.length) continue;   // c'est un trou d'une face plus grande
    const holes = closed.filter(o => o.i !== i && ptInPoly(polyCentroid(o.e.pts)[0], polyCentroid(o.e.pts)[1], e.pts) && Math.abs(area(o.e.pts)) < Math.abs(area(e.pts))).map(o => o.e.pts);
    faces.push({i, poly:e.pts, holes});
  }
  return faces;
}
function skDraw(){
  disposeGroup(skGroup); if (!SK.on) return; const fr = SK.fr, z = lvlZ(curLvl), P = (a, b) => { const p = skPt(fr, a, b); return v3([p[0], p[1], p[2] + z]); };
  const line = (pts, closed, mat) => { const g = new THREE.BufferGeometry().setFromPoints((closed ? [...pts, pts[0]] : pts).map(p => P(p[0], p[1]))); const l = new THREE.Line(g, mat); l.renderOrder = 12; skGroup.add(l); };
  // grille du plan de travail (repère visuel), 40 × 40 pas
  { const n = 20, s = step < 0.1 ? 0.5 : step * 5, gpts = []; for (let i = -n; i <= n; i++){ gpts.push(P(i * s, -n * s), P(i * s, n * s), P(-n * s, i * s), P(n * s, i * s)); }
    const g = new THREE.BufferGeometry().setFromPoints(gpts), l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:0x0E7490, transparent:true, opacity:0.12, depthTest:false})); l.renderOrder = 11; skGroup.add(l);
    const ax = new THREE.BufferGeometry().setFromPoints([P(-n * s, 0), P(n * s, 0), P(0, -n * s), P(0, n * s)]); const la = new THREE.LineSegments(ax, new THREE.LineBasicMaterial({color:0x0E7490, transparent:true, opacity:0.35, depthTest:false})); la.renderOrder = 11; skGroup.add(la); }
  const faces = skFaces();
  faces.forEach(f => { const sel = f.i === SK.faceSel, sh = new THREE.Shape(f.poly.map(p => new THREE.Vector2(p[0], p[1]))); f.holes.forEach(h => sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1])))));
    const g = new THREE.ShapeGeometry(sh), U = v3(fr.u), Vv = v3(fr.v), N = v3(skN(fr)); g.applyMatrix4(new THREE.Matrix4().makeBasis(U, Vv, N).setPosition(v3([fr.o[0], fr.o[1], fr.o[2] + z])));
    const m = new THREE.Mesh(g, sel ? skFillSel : skFill); m.renderOrder = 10; m.userData.face = f.i; skGroup.add(m); });
  SK.ents.forEach((e, i) => line(e.pts, e.closed, i === SK.faceSel ? skMatSel : skMat));
  if (SK.pts.length) line(SK.pts.concat(SK.hover ? [SK.hover] : []), false, skMat);
  if (SK.stroke) line(SK.stroke, false, skMat);
  for (const e of SK.ents) for (const p of e.pts){ const m = new THREE.Mesh(new THREE.SphereGeometry(4 * worldPerPx(), 6, 6), new THREE.MeshBasicMaterial({color:0x0E7490, depthTest:false})); m.position.copy(P(p[0], p[1])); m.renderOrder = 12; skGroup.add(m); }
  if (SK.pull){ const f = faces.find(x => x.i === SK.pull.face); if (f){ const tmp = {kind:'sk', mat:defs.sketch.type, lvl:curLvl, off:0, fr, poly:f.poly, holes:f.holes, d:Math.abs(SK.pull.d) || 0.01, dir:Math.sign(SK.pull.d) || 1}; try { skGroup.add(meshOf(skGeo(tmp), tmp.mat, true, 30)); } catch(err){} } }
  dirty = true;
}
/* --- étapes de dessin --- */
function skClosed(ent){ SK.ents.push(ent); SK.pts = []; if (ent.closed){ SK.faceSel = SK.ents.length - 1; SK.mode = 'sel'; syncHud(); } }
function skPlace(pt){
  const m = SK.mode; if (m === 'sel') return;
  if (m === 'line'){
    if (SK.pts.length >= 2 && V.len(V.sub(pt, SK.pts[0])) < 1e-6) skClosed({kind:'poly', pts:SK.pts.slice(), closed:true});
    else if (!SK.pts.length || V.len(V.sub(pt, SK.pts[SK.pts.length - 1])) > 0.005) SK.pts.push(pt);
  } else if (m === 'rect'){
    if (!SK.pts.length) SK.pts = [pt]; else { const a = SK.pts[0]; if (Math.abs(pt[0] - a[0]) > 0.01 && Math.abs(pt[1] - a[1]) > 0.01) skClosed({kind:'rect', pts:rect(a, pt), closed:true}); else SK.pts = []; }
  } else if (m === 'circ'){
    if (!SK.pts.length) SK.pts = [pt]; else { const r = V.len(V.sub(pt, SK.pts[0])); if (r > 0.01) skClosed({kind:'circ', pts:skCircle(SK.pts[0], rnd(r)), closed:true}); else SK.pts = []; }
  } else if (m === 'arc'){
    SK.pts.push(pt); if (SK.pts.length === 3){ SK.ents.push({kind:'arc', pts:skArc(...SK.pts), closed:false}); SK.pts = []; }
  }
  skDraw(); setPrompt();
}
function skFinishLine(){ if (SK.mode === 'line' && SK.pts.length >= 2){ SK.ents.push({kind:'line', pts:SK.pts.slice(), closed:false}); SK.pts = []; skDraw(); setPrompt(); } else if (SK.pts.length){ SK.pts = []; skDraw(); setPrompt(); } }
/* --- extrusion d'une face : glisser depuis la face, ou valeur au clavier --- */
function skPullStart(e, faceI){
  const faces = skFaces(), f = faces.find(x => x.i === faceI); if (!f) return false;
  const fr = SK.fr, n = skN(fr), c = polyCentroid(f.poly), base = skPt(fr, c[0], c[1]); base[2] += lvlZ(curLvl);
  const p1 = toScreen(v3(base)), p2 = toScreen(v3([base[0] + n[0], base[1] + n[1], base[2] + n[2]])), ppm = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
  SK.pull = {face:faceI, x:e.clientX, y:e.clientY, ppm, dir:[(p2[0] - p1[0]) / ppm, (p2[1] - p1[1]) / ppm], d:0}; c3.enabled = false; return true;
}
function skPullMove(e){ const P = SK.pull; if (!P) return; const v = ((e.clientX - P.x) * P.dir[0] + (e.clientY - P.y) * P.dir[1]) / P.ppm; P.d = SNAP.grid ? Math.round(v / step) * step : rnd(v); skDraw(); const lv = $('#live'); lv.textContent = `${P.d >= 0 ? '+' : ''}${nf(P.d)} m`; const r = canvas.getBoundingClientRect(); lv.style.left = (e.clientX - r.left) + 'px'; lv.style.top = (e.clientY - r.top) + 'px'; lv.hidden = false; }
function skPullEnd(dOverride){
  const P = SK.pull; if (!P) return; const d = dOverride ?? P.d; SK.pull = null; $('#live').hidden = true; c3.enabled = view !== '2d';
  if (Math.abs(d) < 0.005){ skDraw(); return; }
  skExtrude(P.face, d);
}
function skExtrude(faceI, d){
  const f = skFaces().find(x => x.i === faceI); if (!f) return;
  const el = {kind:'sk', mat:defs.sketch.type, lvl:curLvl, off:0, fr:JSON.parse(JSON.stringify(SK.fr)), poly:f.poly.map(p => p.slice()), holes:f.holes.map(h => h.map(p => p.slice())), d:rnd(Math.abs(d)), dir:d < 0 ? -1 : 1};
  const used = new Set([faceI, ...SK.ents.map((e, i) => i).filter(i => f.holes.includes(SK.ents[i].pts))]);
  SK.ents = SK.ents.filter((e, i) => !used.has(i)); SK.faceSel = -1;
  const id = addEl(el); skDraw(); setPrompt(); toast(`Solide de ${nf(Math.abs(d))} m créé`); return id;
}
/* --- pointeur : plan de travail, points, traits au stylet, faces et extrusion (capture : avant les gestionnaires généraux) --- */
let skDown = null;
canvas.addEventListener('pointerdown', e => {
  if (tool !== 'sketch' || e.button !== 0) return;
  skDown = {x:e.clientX, y:e.clientY, t:performance.now(), id:e.pointerId, pen:e.pointerType === 'pen', moved:false};
  if (!SK.on) return;   // le choix du plan se fait au relâchement
  if (SK.faceSel >= 0 && !SK.pts.length && (SK.mode === 'sel' || SK.mode === 'free')){ const fh = skFaceAt(e); if (fh === SK.faceSel && skPullStart(e, fh)){ skDown.pull = true; e.stopImmediatePropagation(); canvas.setPointerCapture(e.pointerId); return; } }
  if (SK.mode === 'free' || (skDown.pen && !SK.pts.length)){ const p = skHit(e, true); if (p){ SK.stroke = [p]; skDown.stroke = true; c3.enabled = false; e.stopImmediatePropagation(); canvas.setPointerCapture(e.pointerId); } }
}, {capture:true});
canvas.addEventListener('pointermove', e => {
  if (tool !== 'sketch') return;
  if (SK.pull){ skPullMove(e); e.stopImmediatePropagation(); return; }
  if (skDown?.stroke){ const p = skHit(e, true); if (p && V.len(V.sub(p, SK.stroke[SK.stroke.length - 1])) > 0.005){ SK.stroke.push(p); if (Math.hypot(e.clientX - skDown.x, e.clientY - skDown.y) > 6) skDown.moved = true; skDraw(); } e.stopImmediatePropagation(); return; }
  if (!SK.on) return; e.stopImmediatePropagation();
  const p = skHit(e); SK.hover = p; const fh = (SK.mode === 'sel' || SK.mode === 'free') ? skFaceAt(e) : -1; canvas.style.cursor = fh >= 0 ? 'pointer' : 'crosshair';
  if (p) $('#coords').textContent = `a ${nf(p[0])} · b ${nf(p[1])}`; if (SK.pts.length) skDraw();
}, {capture:true});
canvas.addEventListener('pointerup', e => {
  if (tool !== 'sketch' || e.button !== 0) return; const d = skDown; skDown = null;
  if (SK.pull){ skPullEnd(); e.stopImmediatePropagation(); return; }
  if (d?.stroke){ e.stopImmediatePropagation(); c3.enabled = view !== '2d'; const st = SK.stroke; SK.stroke = null;
    if (d.moved && st.length > 2){ const r = skRecognize(st); if (r){ if (r.closed) skClosed(r); else { SK.ents.push(r); SK.pts = []; } toast(r.kind === 'circ' ? 'Cercle reconnu' : r.kind === 'rect' ? 'Rectangle reconnu' : r.closed ? 'Polygone fermé' : 'Trait'); } skDraw(); setPrompt(); return; }
    // appui bref au stylet sans mouvement : sélection d'une face, ou point dans le mode courant
    if (SK.mode === 'free' || SK.mode === 'sel'){ const fh = skFaceAt(e); SK.faceSel = fh >= 0 ? (SK.faceSel === fh ? -1 : fh) : -1; skDraw(); setPrompt(); return; } const p = skHit(e); if (p) skPlace(p); return; }
  if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7) return; e.stopImmediatePropagation();
  if (!SK.on){ // choix du plan de travail
    const h = hitModel(e); let fr;
    if (h && h.id != null){ const n = p3(h.normal), o = p3(h.point); o[2] -= lvlZ(curLvl); fr = skFrame(o, n); toast(Math.abs(n[2]) > 0.9 ? 'Plan de travail : face horizontale' : 'Plan de travail : face verticale'); }
    else { const g = cursorPoint(e); if (!g) return; fr = skFrame([g[0], g[1], draw.workZ != null ? draw.workZ - lvlZ(curLvl) : 0], [0, 0, 1]); toast('Plan de travail : sol du niveau'); }
    skStart(fr); return;
  }
  if (SK.mode === 'sel' || SK.mode === 'free'){ const fh = skFaceAt(e); SK.faceSel = fh >= 0 ? (SK.faceSel === fh ? -1 : fh) : -1; skDraw(); setPrompt(); return; }
  const p = skHit(e); if (p) skPlace(p);
}, {capture:true});
/* face sous le pointeur (maillages de remplissage de l'esquisse) */
function skFaceAt(e){ setNdc(e); const hits = ray.intersectObjects(skGroup.children.filter(o => o.isMesh && o.userData.face != null), false); return hits.length ? hits[0].object.userData.face : -1; }
/* clavier : Entrée termine une polyligne ou applique l'extrusion saisie, Échap annule le tracé / la face / l'esquisse */
document.addEventListener('keydown', e => {
  if (tool !== 'sketch' || !SK.on) return; const inCmd = e.target === $('#cmd');
  if (e.key === 'Escape'){ e.stopImmediatePropagation(); e.preventDefault(); if (SK.pull){ SK.pull = null; $('#live').hidden = true; c3.enabled = view !== '2d'; skDraw(); } else if (SK.pts.length){ SK.pts = []; skDraw(); } else if (SK.faceSel >= 0){ SK.faceSel = -1; skDraw(); } else { skEnd(); setTool('select'); } setPrompt(); return; }
  if (e.key === 'Enter' && !inCmd){ e.stopImmediatePropagation(); e.preventDefault(); skFinishLine(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !inCmd && SK.faceSel >= 0){ e.stopImmediatePropagation(); e.preventDefault(); SK.ents.splice(SK.faceSel, 1); SK.faceSel = -1; skDraw(); setPrompt(); }
}, {capture:true});
$('#cmd').addEventListener('keydown', e => {
  if (tool !== 'sketch' || !SK.on || e.key !== 'Enter') return; const v = num(e.target.value);
  if (SK.faceSel >= 0 && !Number.isNaN(v) && Math.abs(v) >= 0.005){ e.preventDefault(); e.stopImmediatePropagation(); e.target.value = ''; skExtrude(SK.faceSel, v); return; }
  if (!e.target.value.trim()){ e.preventDefault(); e.stopImmediatePropagation(); skFinishLine(); return; }
  const c = parseCmd(e.target.value); if (c && 'x' in c){ e.preventDefault(); e.stopImmediatePropagation(); e.target.value = ''; const last = SK.pts[SK.pts.length - 1]; skPlace(c.rel && last ? [rnd(last[0] + c.x), rnd(last[1] + c.y)] : [c.x, c.y]); }
}, {capture:true});
function skPrompt(){
  if (!SK.on) return '<b>Esquisse</b> : touchez une face (sol, dalle, mur, forme, toit) pour choisir le plan de travail · ou dessinez directement au sol';
  if (SK.pull) return '<b>Esquisse</b> : glissez pour donner l\'épaisseur, relâchez pour créer le solide';
  if (SK.faceSel >= 0) return '<b>Face choisie</b> : glissez-la pour l\'extruder, ou tapez une épaisseur (négative = vers l\'arrière) puis <kbd>Entrée</kbd> · <kbd>Suppr</kbd> efface · dessinez un contour à l\'intérieur pour un trou';
  const m = SK.mode;
  if (m === 'sel') return SK.ents.some(e => e.closed) ? '<b>Sélection</b> : touchez une face pour la choisir, puis tirez-la · choisissez un tracé dans la barre pour dessiner' : '<b>Esquisse</b> : choisissez un tracé (rectangle, ligne, cercle, arc) ou dessinez au stylet';
  if (m === 'line') return SK.pts.length ? `<b>Ligne</b> : point suivant (${SK.pts.length}) · revenez au premier point pour fermer · <kbd>Entrée</kbd> termine` : '<b>Ligne</b> : premier point (fermez le contour pour obtenir une face)';
  if (m === 'rect') return SK.pts.length ? '<b>Rectangle</b> : coin opposé' : '<b>Rectangle</b> : premier coin';
  if (m === 'circ') return SK.pts.length ? '<b>Cercle</b> : un point du cercle (rayon)' : '<b>Cercle</b> : centre';
  if (m === 'arc') return `<b>Arc</b> : ${['premier point', 'point de passage', 'point final'][SK.pts.length]}`;
  return '<b>Main levée</b> : tracez d\'un trait (stylet, doigt ou souris) : rectangles, cercles et polygones fermés sont reconnus · touchez une face pour l\'extruder';
}
