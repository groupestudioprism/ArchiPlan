/* ============ Dalles au contour exact ============
   Une dalle peut suivre un contour quelconque (el.poly : pièce en L, contour tracé point par point, emprise des murs)
   et recevoir des trous (el.holes : trémies, patios, gaines) en plus des trémies d'escalier automatiques. */
/* décalage d'un contour (d > 0 : vers l'extérieur), angles vifs */
function offsetPoly(P, d){
  const n = P.length, s = sArea(P) > 0 ? 1 : -1;
  const L = P.map((a, i) => { const b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = s * dy / l, ny = -s * dx / l; return [[a[0] + nx * d, a[1] + ny * d], [dx / l, dy / l]]; });
  return P.map((_, i) => { const l1 = L[(i - 1 + n) % n], l2 = L[i]; return lineInter(l1[0], l1[1], l2[0], l2[1]) || l2[0]; });
}
/* sommets alignés retirés (contour plus propre) */
function cleanPoly(P){ const out = []; for (let i = 0; i < P.length; i++){ const a = P[(i - 1 + P.length) % P.length], b = P[i], c = P[(i + 1) % P.length]; if (V.len(V.sub(b, a)) < 1e-4) continue; if (Math.abs(V.cross(V.sub(b, a), V.sub(c, b))) > 1e-6 * (V.len(V.sub(b, a)) + V.len(V.sub(c, b)))) out.push(b); } return out.length >= 3 ? out : P; }
const isAxisRect = P => P.length === 4 && isOrtho(P);
/* contour fermé des murs porteurs / extérieurs d'un niveau (axes), quelle que soit sa forme ; sinon rectangle englobant */
function wallsLoop(lvl){
  const ws = state.els.filter(w => w.kind === 'wall' && w.lvl === lvl && compo(w.type).lot !== 'Second œuvre' && !wallArc(w));
  if (!ws.length) return null;
  // la plus grande pièce « extérieure » : réunion des pièces détectées → on prend le contour de la plus grande face du graphe
  const key = p => `${p[0].toFixed(3)};${p[1].toFixed(3)}`, adj = {};
  ws.forEach(w => { (adj[key(w.a)] ??= []).push(w.b); (adj[key(w.b)] ??= []).push(w.a); });
  const start = ws[0].a, path = [start]; let prev = null, cur = start;
  for (let k = 0; k < ws.length + 2; k++){
    const nx = (adj[key(cur)] || []).find(p => !prev || key(p) !== key(prev)); if (!nx) break;
    if (key(nx) === key(start)){ if (path.length >= 3) return cleanPoly(path.map(q => [q[0], q[1]])); break; }
    path.push(nx); prev = cur; cur = nx;
  }
  return wallsOutline(lvl);
}
function setSlabPoly(el, P){
  const R = v => Math.round(v * 1000) / 1000, Q = cleanPoly(P).map(p => [R(p[0]), R(p[1])]), xs = Q.map(p => p[0]), ys = Q.map(p => p[1]);
  el.p = [Math.min(...xs), Math.min(...ys)]; el.q = [Math.max(...xs), Math.max(...ys)];
  if (isAxisRect(Q)) delete el.poly; else el.poly = Q;
}
function slabBindPoly(el){
  if (el.bind === 'walls'){
    const bl = el.bindLvl ?? el.lvl, o = wallsLoop(bl); if (!o) return null;
    const ws = state.els.filter(w => w.kind === 'wall' && w.lvl === bl && compo(w.type).lot !== 'Second œuvre'), e = ws.length ? Math.max(...ws.map(wallT)) / 2 : 0;
    return offsetPoly(o, e);
  }
  if (el.bind?.room){ const r = roomAt(el.bind.room, el.lvl); return r ? r.poly.map(p => p.slice()) : null; }
  return null;
}
/* outil Dalle : contour tracé point par point, ou trou dans une dalle existante */
function finishSlabPoly(){
  const p = draw.poly || []; if (p.length < 3){ toast('Il faut au moins 3 points'); return; }
  const el = {kind:'slab', type:defs.slab.type, lvl:curLvl, off:offFromZ(), p:[0, 0], q:[1, 1]}; setSlabPoly(el, p);
  draw.poly = null; draw.start = null; addEl(el); draw.workZ = null; updatePreview(); setPrompt();
}
function slabAt(pt, lvl = curLvl){ return state.els.filter(s => s.kind === 'slab' && s.lvl === lvl && ptInPoly(pt[0], pt[1], volPoly(s))).sort((a, b) => area(volPoly(a)) - area(volPoly(b)))[0] || null; }
function addSlabHole(a, b){
  const r = rect(a, b), c = V.mul(V.add(r[0], r[2]), 0.5), s = slabAt(c);
  if (!s){ toast('Tracez le trou à l\'intérieur d\'une dalle du niveau'); return; }
  if (area(r) < 0.01){ toast('Trou trop petit'); return; }
  pushHist(); (s.holes ??= []).push(r.map(p => [rnd(p[0]), rnd(p[1])])); state.isSample = false; rebuild(); toast(`Trou ajouté à la dalle ${s.id} (${nf(area(r))} m²)`);
}
