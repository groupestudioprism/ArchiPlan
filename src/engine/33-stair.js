/* ============ Escaliers : droit, quart tournant, demi-tournant, trois-quarts tournant, hélicoïdal (colimaçon) ============
   stair {c:[x,y] (départ, coin gauche de la 1re marche ; centre pour l'hélicoïdal), rot (°, sens de montée), lvl, off,
          st 'droit'|'quart'|'demi'|'tq'|'helico', side 'd'|'g' (sens du tournant), w (emmarchement), H (hauteur à monter, null = niveau),
          mat 'bois'|'beton'|'acier', R (rayon du colimaçon), rail (garde-corps / main courante), tremie (trémie auto dans le plancher d'arrivée)}
   Le tracé se construit « à la tortue » : volées droites et quarts tournants à marches rayonnantes (3 par quart). Hauteur de marche
   ≈ 17,5 cm, giron selon Blondel (2h + g ≈ 63 cm). Une trémie est découpée dans le plancher d'arrivée, au-dessus de l'escalier. */
const STAIR_TYPES = {droit:'Droit', quart:'Quart tournant', demi:'Demi-tournant', tq:'Trois-quarts tournant', helico:'Hélicoïdal (colimaçon)'};
const STAIR_MATS = {bois:'Bois (marches 45 mm, limons)', beton:'Béton (paillasse)', acier:'Acier et bois (limon central)'};
function stairH(el){ if (el.H > 0) return el.H; const z0 = lvlZ(el.lvl) + (el.off || 0), nxt = state.levels[el.lvl + 1]; return nxt ? Math.max(0.5, nxt.z - z0) : 2.8; }
function stairDims(el){
  const H = stairH(el), hT = el.hs > 0.1 ? el.hs : (el.use === 'erp' ? 0.16 : 0.175), n = el.n >= 3 ? el.n | 0 : Math.max(3, Math.round(H / hT)), h = H / n;
  const g = el.g > 0.15 ? el.g : clamp(0.63 - 2 * h, el.use === 'erp' ? 0.28 : 0.24, 0.32);
  return {H, n, h, g, blondel:2 * h + g};
}
/* contrôles réglementaires et de confort (habitation : NF P 21-211 et usages ; ERP : arrêté du 25 juin 1980, art. CO 36 et AM ; accessibilité : arrêté du 20 avril 2017) */
function stairCheck(el){
  const D = stairDims(el), erp = el.use === 'erp', w = el.w || 0.9, out = [], add = (lvl, t) => out.push({lvl, t});
  if (D.blondel < 0.60 || D.blondel > 0.65) add('warn', `Blondel 2h + g = ${nf(D.blondel * 100, 1)} cm : hors de la plage de confort 60–65 cm.`); else add('ok', `Blondel 2h + g = ${nf(D.blondel * 100, 1)} cm : confortable.`);
  if (erp){ if (D.h > 0.16 + 1e-6) add('bad', `Hauteur de marche ${nf(D.h * 100, 1)} cm : ERP, maximum 16 cm (art. CO 36).`); if (D.g < 0.28 - 1e-6) add('bad', `Giron ${nf(D.g * 100, 1)} cm : ERP, minimum 28 cm.`); if (w < 1.2) add('bad', `Emmarchement ${nf(w)} m : ERP, 1,20 m minimum (2 unités de passage) ; 1,40 m au-delà de 100 personnes.`); }
  else { if (D.h > 0.19 + 1e-6) add('warn', `Hauteur de marche ${nf(D.h * 100, 1)} cm : au-dessus de 19 cm, escalier raide (16 à 18 cm conseillés).`); else if (D.h < 0.15) add('warn', 'Hauteur de marche inférieure à 15 cm : escalier très plat, allongé.');
    if (D.g < 0.24 - 1e-6) add('bad', `Giron ${nf(D.g * 100, 1)} cm : minimum 24 cm en habitation (28 cm conseillés).`); if (w < 0.8) add('bad', `Emmarchement ${nf(w)} m : minimum 0,80 m entre mains courantes (accessibilité).`); else if (w < 0.9) add('warn', 'Emmarchement inférieur à 0,90 m : passage des meubles difficile.'); }
  if ((el.st || 'droit') === 'helico'){ const R = Math.max(0.6, el.R || 0.8); if (R < 0.7) add('warn', 'Colimaçon de rayon inférieur à 70 cm : giron très faible à l\'intérieur, usage secondaire seulement.'); if (erp) add('bad', 'Escalier hélicoïdal : non admis comme escalier d\'évacuation d\'un ERP.'); }
  const E = stairHeadroom(el); if (E != null){ const lim = erp ? 2.0 : 1.9; if (E < lim) add('bad', `Échappée ${nf(E)} m sous le plancher : minimum ${nf(lim)} m (la trémie est agrandie automatiquement si elle est active).`); else add('ok', `Échappée ${nf(E)} m (minimum ${nf(lim)} m, 2,00 m conseillé).`); }
  if (el.rail === false && D.H > 1) add('warn', 'Sans garde-corps ni main courante : obligatoire dès 1 m de dénivelé (NF P 01-012 : garde-corps 1,00 m, main courante 0,80 à 1,00 m).');
  if (D.n - 1 > 25 && !el.pal) add('warn', `${D.n - 1} marches sans palier : un palier de repos est conseillé toutes les 25 marches.`);
  return {D, checks:out};
}
/* échappée : hauteur libre la plus faible au-dessus des marches, sous le plancher ou la toiture (hors trémie) */
function stairHeadroom(el){
  if (!state?.els) return null; const D = stairDims(el), X = stairXf(el), z0 = lvlZ(el.lvl) + (el.off || 0), T = stairTreads(el); let worst = null;
  const holes = s => (el.tremie !== false ? [stairTremie(el, s)] : []).filter(Boolean);
  T.forEach((t, i) => { const p = X(t.walk), zt = z0 + (t.k ?? i + 1) * D.h;
    for (const s of state.els){ if (s.kind !== 'slab' || s.lvl <= el.lvl && s.off <= 0.3 && s.lvl === el.lvl) continue; const zb = lvlZ(s.lvl) + (s.off || 0); if (zb <= zt + 0.3 || zb > z0 + D.H + 3) continue;
      if (!ptInPoly(p[0], p[1], volPoly(s))) continue; if (holes(s).some(h => p[0] >= h[0] && p[0] <= h[2] && p[1] >= h[1] && p[1] <= h[3])) continue;
      const c = zb - zt; if (worst == null || c < worst) worst = c; } });
  return worst;
}
/* trémie minimale d'un escalier dans un plancher : seules les marches dont l'échappée serait insuffisante sont découvertes */
function stairTremie(el, slab){
  const D = stairDims(el), X = stairXf(el), z0 = lvlZ(el.lvl) + (el.off || 0), zb = lvlZ(slab.lvl) + (slab.off || 0), ech = el.ech > 1 ? el.ech : (el.use === 'erp' ? 2.0 : 1.9) + 0.1, pts = [];
  stairTreads(el).forEach((t, i) => { const zt = z0 + (t.k ?? i + 1) * D.h; if (zt + ech > zb - 0.001) pts.push(...t.poly.map(X)); });
  const F = stairFootprint(el); if (!F) return null; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  if (!pts.length) return null; const m = 0.02;
  return [Math.max(F.x0, Math.min(...xs) - m), Math.max(F.y0, Math.min(...ys) - m), Math.min(F.x1, Math.max(...xs) + m), Math.min(F.y1, Math.max(...ys) + m)];
}
const rotR = d => [d[1], -d[0]], rotL = d => [-d[1], d[0]];
/* Marches dans le repère local (montée vers +y, emmarchement sur x ∈ [0, w]) : [{poly, walk:[x,y], outer:[[x,y]…]}] */
function stairTreads(el){
  const D = stairDims(el), w = el.w || 0.9, nT = D.n - 1, st = el.st || 'droit', right = (el.side || 'd') === 'd';
  if (st === 'helico'){
    const R = Math.max(0.6, el.R || 0.8), r0 = 0.08, rw = Math.max(r0 + 0.15, R * 0.62), dA = D.g * 0.92 / rw, out = [];
    for (let i = 0; i < nT; i++){ const a0 = i * dA * (right ? -1 : 1), a1 = (i + 1) * dA * (right ? -1 : 1), P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
      const outer = []; for (let k = 0; k <= 5; k++) outer.push(P(R, a0 + (a1 - a0) * k / 5));
      out.push({poly:[P(r0, a0), ...outer, P(r0, a1)], walk:P(rw, (a0 + a1) / 2), outer:[outer[0], outer[5]], k:i + 1}); }
    return out;
  }
  const turns = {droit:0, quart:1, demi:2, tq:3}[st] ?? 0, pal = !!el.pal && turns > 0, kT = pal ? 1 : 3, rest = Math.max(0, nT - turns * kT); let k = 0;
  const plan = turns === 0 ? [['f', nT]] : turns === 1 ? [['f', Math.ceil(rest / 2)], ['t'], ['f', Math.floor(rest / 2)]] : turns === 2 ? [['f', Math.ceil(rest / 2)], ['t'], ['t'], ['f', Math.floor(rest / 2)]]
    : [['f', Math.ceil(rest / 2)], ['t'], ['t'], ['t'], ['f', Math.floor(rest / 2)]];
  let A = [0, 0], B = [w, 0], d = [0, 1]; const out = [], add = (p, q) => [p[0] + q[0], p[1] + q[1]], mul = (p, s) => [p[0] * s, p[1] * s];
  for (const [op, n] of plan){
    if (op === 'f') for (let i = 0; i < n; i++){ const A2 = add(A, mul(d, D.g)), B2 = add(B, mul(d, D.g)); out.push({poly:[A, B, B2, A2], walk:mul(add(add(A, B), mul(d, D.g)), 0.5), outer:right ? [A, A2] : [B, B2], k:++k}); A = A2; B = B2; }
    else if (pal){ // palier carré au tournant : une seule hauteur de marche, deux triangles de même niveau
      const pv = right ? B : A, s0 = right ? A : B, c1 = add(s0, mul(d, w)), e = add(pv, mul(d, w)); k++;
      out.push({poly:right ? [pv, s0, c1] : [pv, c1, s0], walk:mul(add(add(pv, s0), c1), 1 / 3), outer:[s0, c1], k, pal:true}, {poly:right ? [pv, c1, e] : [pv, e, c1], walk:mul(add(add(pv, c1), e), 1 / 3), outer:[c1, e], k, pal:true});
      if (right){ A = e; B = pv; d = rotR(d); } else { A = pv; B = e; d = rotL(d); }
    } else {
      const pv = right ? B : A, s0 = right ? A : B, c1 = add(s0, mul(d, w)), e = add(pv, mul(d, w)), path = [s0, c1, e], L = 2 * w;
      const at = t => t <= w ? add(s0, mul(d, t)) : add(c1, mul([e[0] - c1[0], e[1] - c1[1]], (t - w) / w));
      for (let k = 0; k < kT; k++){ const t0 = L * k / kT, t1 = L * (k + 1) / kT, pts = [at(t0)]; if (t0 < w && t1 > w) pts.push(c1); pts.push(at(t1));
        const poly = right ? [pv, ...pts] : [pv, ...pts.reverse()], mid = at((t0 + t1) / 2); out.push({poly, walk:mul(add(pv, mid), 0.5), outer:[at(t0), at(t1)], k:++k}); }
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
    const poly = t.poly.map(X), zt = z0 + (t.k ?? i + 1) * D.h;
    if (m === 'beton'){ const hh = D.h + 0.14; out.push({poly, top:poly.map(p => [p[0], p[1], zt]), ext:[0, 0, -Math.min(hh, zt - z0)], base:zt - Math.min(hh, zt - z0), h:Math.min(hh, zt - z0), mat:'beton', lot:'Gros œuvre', stair:true}); }
    else out.push({poly, top:poly.map(p => [p[0], p[1], zt]), ext:[0, 0, -0.045], base:zt - 0.045, h:0.045, mat:tread, lot:'Second œuvre', stair:true});
    if (m !== 'beton' && el.cm){ // contremarches fermées : plaque verticale au nez de la marche suivante (bord d'attaque)
      const [a, b] = [poly[0], poly[1]], n = V.norm([-(b[1] - a[1]), b[0] - a[0]]), e = 0.02, q = [a, b, V.add(b, V.mul(n, e)), V.add(a, V.mul(n, e))].map(p => [p[0], p[1]]);
      out.push({poly:q, top:q.map(p => [p[0], p[1], zt - 0.045]), ext:[0, 0, -(D.h - 0.045)], base:zt - D.h, h:D.h - 0.045, mat:wood, lot:'Second œuvre', stair:true}); }
  });
  const mem = (A, B, w, h, mt = 'chene') => { const mb = {A, B, w, h, kind:'limon', id:''}; const p = memberPiece(mb); return {...p, mat:mt, lot:'Second œuvre', stair:true}; };
  if (m !== 'beton' && (el.st || 'droit') !== 'helico'){
    // limons : le long de chaque bord extérieur des marches (et du bord intérieur des volées droites), suivant la pente
    T.forEach((t, i) => { const zt = z0 + (t.k ?? i + 1) * D.h, [p0, p1] = t.outer.map(X); if (t.pal){ out.push(mem([p0[0], p0[1], zt + 0.03], [p1[0], p1[1], zt + 0.03], 0.045, 0.28, m === 'acier' ? 'acier' : 'chene')); return; } out.push(mem([p0[0], p0[1], zt + 0.03], [p1[0], p1[1], zt + D.h + 0.03], 0.045, 0.28, m === 'acier' ? 'acier' : 'chene')); });
  }
  if ((el.st || 'droit') === 'helico'){ // fût central
    const c = X([0, 0]), r = 0.08, circ = Array.from({length:12}, (_, k) => [c[0] + r * Math.cos(k * Math.PI / 6), c[1] + r * Math.sin(k * Math.PI / 6)]), H = D.H + 1;
    out.push({poly:circ, top:circ.map(p => [p[0], p[1], z0 + H]), ext:[0, 0, -H], base:z0, h:H, mat:'acier', lot:'Second œuvre', stair:true});
  }
  const railH = el.railH > 0.5 ? el.railH : 0.9;   // main courante : 0,80 à 1,00 m au nez de marche (NF P 01-012)
  if (el.rail !== false){ // main courante et poteaux, côté extérieur
    let prev = null; T.forEach((t, i) => { const zt = z0 + (t.k ?? i + 1) * D.h, p = X(t.outer[1]), q = [p[0], p[1], zt + railH];
      if (prev) out.push({...memberPiece({A:prev, B:q, w:0.045, h:0.045, kind:'rail', id:''}), mat:m === 'acier' ? 'acier' : 'chene', lot:'Second œuvre', stair:true});
      if (i % 3 === 0 || i === T.length - 1) out.push({...memberPiece({A:[q[0], q[1], q[2]], B:[q[0], q[1], zt], w:0.04, h:0.04, kind:'post', id:''}), mat:m === 'acier' ? 'acier' : 'chene', lot:'Second œuvre', stair:true});
      prev = q; });
  }
  if (el.rail2 && (el.st || 'droit') !== 'helico'){ // seconde main courante, côté intérieur (murs ou vide central)
    let prev = null; T.forEach((t, i) => { const zt = z0 + (t.k ?? i + 1) * D.h, inner = null, p = X(right2(t)), q = [p[0], p[1], zt + railH];
      if (prev) out.push({...memberPiece({A:prev, B:q, w:0.045, h:0.045, kind:'rail', id:''}), mat:m === 'acier' ? 'acier' : 'chene', lot:'Second œuvre', stair:true});
      if (i % 3 === 0 || i === T.length - 1) out.push({...memberPiece({A:q, B:[q[0], q[1], zt], w:0.04, h:0.04, kind:'post', id:''}), mat:m === 'acier' ? 'acier' : 'chene', lot:'Second œuvre', stair:true});
      prev = q; void inner; });
  }
  return out;
}
/* bord intérieur d'une marche (opposé au bord « outer ») : point d'arrivée de la marche côté intérieur */
function right2(t){ const o = t.outer; const cands = t.poly.filter(p => !o.includes(p)); if (!cands.length) return t.poly[0]; return cands[cands.length - 1]; }
/* Trémies : escaliers (et familles « escalier ») qui arrivent à travers une dalle */
function slabHoles(slab){
  if (!state?.els) return [];
  const r = rect(slab.p, slab.q), sx0 = r[0][0], sx1 = r[1][0], sy0 = r[0][1], sy1 = r[2][1], zb = lvlZ(slab.lvl) + (slab.off || 0), zt = zb + slabT(slab), holes = [];
  for (const e of state.els){
    let F = null, top = 0;
    if (e.kind === 'stair' && e.tremie !== false){ const tr = e.fullTremie ? null : stairTremie(e, slab); F = tr ? {x0:tr[0], y0:tr[1], x1:tr[2], y1:tr[3]} : stairFootprint(e); top = lvlZ(e.lvl) + (e.off || 0) + stairH(e); }
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
