/* ============ Escaliers : droit, quart tournant, demi-tournant, trois-quarts tournant, hélicoïdal (colimaçon) ============
   stair {c:[x,y] (départ, coin gauche de la 1re marche ; centre pour l'hélicoïdal), rot (°, sens de montée), lvl, off,
          st 'droit'|'quart'|'demi'|'tq'|'helico', side 'd'|'g' (sens du tournant), w (emmarchement), H (hauteur à monter, null = niveau),
          mat 'bois'|'beton'|'acier', R (rayon du colimaçon), rail (garde-corps / main courante), tremie (trémie auto dans le plancher d'arrivée)}
   Le tracé se construit « à la tortue » : volées droites et quarts tournants à marches rayonnantes (3 par quart). Hauteur de marche
   ≈ 17,5 cm, giron selon Blondel (2h + g ≈ 63 cm). Une trémie est découpée dans le plancher d'arrivée, au-dessus de l'escalier. */
const STAIR_TYPES = {droit:'Droit', quart:'Quart tournant', demi:'Demi-tournant', tq:'Trois-quarts tournant', helico:'Hélicoïdal (colimaçon)'};
const STAIR_MATS = {bois:'Bois (marches 45 mm, limons)', beton:'Béton (paillasse)', acier:'Acier et bois (limon central)'};
function stairH(el){ if (el.H > 0) return el.H; const z0 = lvlZ(el.lvl) + (el.off || 0), nxt = state.levels[el.lvl + 1]; return nxt ? Math.max(0.5, nxt.z - z0) : 2.8; }
function stairDims(el){ const H = stairH(el), n = Math.max(3, Math.round(H / 0.175)), h = H / n, g = clamp(0.63 - 2 * h, 0.21, 0.32); return {H, n, h, g, blondel:2 * h + g}; }
const rotR = d => [d[1], -d[0]], rotL = d => [-d[1], d[0]];
/* Marches dans le repère local (montée vers +y, emmarchement sur x ∈ [0, w]) : [{poly, walk:[x,y], outer:[[x,y]…]}] */
function stairTreads(el){
  const D = stairDims(el), w = el.w || 0.9, nT = D.n - 1, st = el.st || 'droit', right = (el.side || 'd') === 'd';
  if (st === 'helico'){
    const R = Math.max(0.6, el.R || 0.8), r0 = 0.08, rw = Math.max(r0 + 0.15, R * 0.62), dA = D.g * 0.92 / rw, out = [];
    for (let i = 0; i < nT; i++){ const a0 = i * dA * (right ? -1 : 1), a1 = (i + 1) * dA * (right ? -1 : 1), P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
      const outer = []; for (let k = 0; k <= 5; k++) outer.push(P(R, a0 + (a1 - a0) * k / 5));
      out.push({poly:[P(r0, a0), ...outer, P(r0, a1)], walk:P(rw, (a0 + a1) / 2), outer:[outer[0], outer[5]]}); }
    return out;
  }
  const turns = {droit:0, quart:1, demi:2, tq:3}[st] ?? 0, kT = 3, rest = Math.max(0, nT - turns * kT);
  const plan = turns === 0 ? [['f', nT]] : turns === 1 ? [['f', Math.ceil(rest / 2)], ['t'], ['f', Math.floor(rest / 2)]] : turns === 2 ? [['f', Math.ceil(rest / 2)], ['t'], ['t'], ['f', Math.floor(rest / 2)]]
    : [['f', Math.ceil(rest / 2)], ['t'], ['t'], ['t'], ['f', Math.floor(rest / 2)]];
  let A = [0, 0], B = [w, 0], d = [0, 1]; const out = [], add = (p, q) => [p[0] + q[0], p[1] + q[1]], mul = (p, s) => [p[0] * s, p[1] * s];
  for (const [op, n] of plan){
    if (op === 'f') for (let i = 0; i < n; i++){ const A2 = add(A, mul(d, D.g)), B2 = add(B, mul(d, D.g)); out.push({poly:[A, B, B2, A2], walk:mul(add(add(A, B), mul(d, D.g)), 0.5), outer:right ? [A, A2] : [B, B2]}); A = A2; B = B2; }
    else {
      const pv = right ? B : A, s0 = right ? A : B, c1 = add(s0, mul(d, w)), e = add(pv, mul(d, w)), path = [s0, c1, e], L = 2 * w;
      const at = t => t <= w ? add(s0, mul(d, t)) : add(c1, mul([e[0] - c1[0], e[1] - c1[1]], (t - w) / w));
      for (let k = 0; k < kT; k++){ const t0 = L * k / kT, t1 = L * (k + 1) / kT, pts = [at(t0)]; if (t0 < w && t1 > w) pts.push(c1); pts.push(at(t1));
        const poly = right ? [pv, ...pts] : [pv, ...pts.reverse()], mid = at((t0 + t1) / 2); out.push({poly, walk:mul(add(pv, mid), 0.5), outer:[at(t0), at(t1)]}); }
      if (right){ A = e; B = pv; d = rotR(d); } else { A = pv; B = e; d = rotL(d); }
    }
  }
  return out;
}
const stairXf = el => { const a = (el.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), o = el.c || [0, 0]; return p => [o[0] + p[0] * c - p[1] * s, o[1] + p[0] * s + p[1] * c]; };
function stairFootprint(el){ const X = stairXf(el), pts = stairTreads(el).flatMap(t => t.poly.map(X)); if (!pts.length) return null; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return {x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys)}; }
function stairPieces(el){
  const D = stairDims(el), X = stairXf(el), z0 = lvlZ(el.lvl) + (el.off || 0), T = stairTreads(el), out = [], m = el.mat || 'bois';
  const wood = m === 'beton' ? 'ba' : 'chene', tread = m === 'beton' ? 'beton' : 'chene';
  T.forEach((t, i) => {
    const poly = t.poly.map(X), zt = z0 + (i + 1) * D.h;
    if (m === 'beton'){ const hh = D.h + 0.14; out.push({poly, top:poly.map(p => [p[0], p[1], zt]), ext:[0, 0, -Math.min(hh, zt - z0)], base:zt - Math.min(hh, zt - z0), h:Math.min(hh, zt - z0), mat:'beton', lot:'Gros œuvre', stair:true}); }
    else out.push({poly, top:poly.map(p => [p[0], p[1], zt]), ext:[0, 0, -0.045], base:zt - 0.045, h:0.045, mat:tread, lot:'Second œuvre', stair:true});
  });
  const mem = (A, B, w, h, mt = 'chene') => { const mb = {A, B, w, h, kind:'limon', id:''}; const p = memberPiece(mb); return {...p, mat:mt, lot:'Second œuvre', stair:true}; };
  if (m !== 'beton' && (el.st || 'droit') !== 'helico'){
    // limons : le long de chaque bord extérieur des marches (et du bord intérieur des volées droites), suivant la pente
    T.forEach((t, i) => { const zt = z0 + (i + 1) * D.h, [p0, p1] = t.outer.map(X); out.push(mem([p0[0], p0[1], zt + 0.03], [p1[0], p1[1], zt + D.h + 0.03], 0.045, 0.28, m === 'acier' ? 'acier' : 'chene')); });
  }
  if ((el.st || 'droit') === 'helico'){ // fût central
    const c = X([0, 0]), r = 0.08, circ = Array.from({length:12}, (_, k) => [c[0] + r * Math.cos(k * Math.PI / 6), c[1] + r * Math.sin(k * Math.PI / 6)]), H = D.H + 1;
    out.push({poly:circ, top:circ.map(p => [p[0], p[1], z0 + H]), ext:[0, 0, -H], base:z0, h:H, mat:'acier', lot:'Second œuvre', stair:true});
  }
  if (el.rail !== false){ // main courante et poteaux, côté extérieur
    let prev = null; T.forEach((t, i) => { const zt = z0 + (i + 1) * D.h, p = X(t.outer[1]), q = [p[0], p[1], zt + 0.9];
      if (prev) out.push({...memberPiece({A:prev, B:q, w:0.045, h:0.045, kind:'rail', id:''}), mat:m === 'acier' ? 'acier' : 'chene', lot:'Second œuvre', stair:true});
      if (i % 3 === 0 || i === T.length - 1) out.push({...memberPiece({A:[q[0], q[1], q[2]], B:[q[0], q[1], zt], w:0.04, h:0.04, kind:'post', id:''}), mat:m === 'acier' ? 'acier' : 'chene', lot:'Second œuvre', stair:true});
      prev = q; });
  }
  return out;
}
/* Trémies : escaliers (et familles « escalier ») qui arrivent à travers une dalle */
function slabHoles(slab){
  if (!state?.els) return [];
  const r = rect(slab.p, slab.q), sx0 = r[0][0], sx1 = r[1][0], sy0 = r[0][1], sy1 = r[2][1], zb = lvlZ(slab.lvl) + (slab.off || 0), zt = zb + slabT(slab), holes = [];
  for (const e of state.els){
    let F = null, top = 0;
    if (e.kind === 'stair' && e.tremie !== false){ F = stairFootprint(e); top = lvlZ(e.lvl) + (e.off || 0) + stairH(e); }
    else if (e.kind === 'inst' && /^escalier/.test(e.fam || '')){ const so = instSolids(e); if (so.length){ const xs = so.flatMap(s => [s.c[0] - (s.w || 2 * (s.r || 0)) / 2, s.c[0] + (s.w || 2 * (s.r || 0)) / 2]), ys = so.flatMap(s => [s.c[1] - (s.d || 2 * (s.r || 0)) / 2, s.c[1] + (s.d || 2 * (s.r || 0)) / 2]); F = {x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys)}; top = Math.max(...so.map(s => s.c[2] + s.h / 2)); } }
    if (!F || top < zb - 0.05 || top > zt + 0.35) continue;
    const x0 = Math.max(F.x0, sx0), x1 = Math.min(F.x1, sx1), y0 = Math.max(F.y0, sy0), y1 = Math.min(F.y1, sy1);
    if (x1 - x0 < 0.2 || y1 - y0 < 0.2) continue;
    if (x1 - x0 > (sx1 - sx0) - 0.05 && y1 - y0 > (sy1 - sy0) - 0.05) continue;
    holes.push([x0, y0, x1, y1]);
  }
  // trémies qui se touchent : fusionnées (le découpage d'une dalle exige des trous disjoints)
  for (let again = true; again;){ again = false;
    for (let i = 0; i < holes.length && !again; i++) for (let j = i + 1; j < holes.length; j++){ const a = holes[i], b = holes[j];
      if (a[0] <= b[2] + 0.05 && b[0] <= a[2] + 0.05 && a[1] <= b[3] + 0.05 && b[1] <= a[3] + 0.05){ holes[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; holes.splice(j, 1); again = true; break; } } }
  return holes.filter(h => !(h[2] - h[0] > (sx1 - sx0) - 0.05 && h[3] - h[1] > (sy1 - sy0) - 0.05)).map(([x0, y0, x1, y1]) => [[Math.max(x0, sx0 + 0.02), Math.max(y0, sy0 + 0.02)], [Math.min(x1, sx1 - 0.02), Math.max(y0, sy0 + 0.02)], [Math.min(x1, sx1 - 0.02), Math.min(y1, sy1 - 0.02)], [Math.max(x0, sx0 + 0.02), Math.min(y1, sy1 - 0.02)]]);
}
function stairPlace(el, a, b){ el.c = a.slice(); if (b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05) el.rot = Math.round(((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI - 90) + 720) % 360 * 10) / 10; }
