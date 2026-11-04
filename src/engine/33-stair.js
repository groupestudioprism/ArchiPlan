/* ============ Escaliers : droit, quart tournant, demi-tournant, trois-quarts tournant, hélicoïdal (colimaçon) ============
   stair {c:[x,y] (départ, coin gauche de la 1re marche ; centre pour l'hélicoïdal), rot (°, sens de montée), lvl, off,
          st 'droit'|'quart'|'demi'|'tq'|'helico', side 'd'|'g' (sens du tournant), w (emmarchement), H (hauteur à monter, null = niveau),
          mat 'bois'|'beton'|'acier', R (rayon du colimaçon), rail (garde-corps / main courante), tremie (trémie auto dans le plancher d'arrivée)}
   Le tracé se construit « à la tortue » : volées droites et quarts tournants à marches rayonnantes (3 par quart). Hauteur de marche
   ≈ 17,5 cm, giron selon Blondel (2h + g ≈ 63 cm). Une trémie est découpée dans le plancher d'arrivée, au-dessus de l'escalier. */
const STAIR_TYPES = {droit:'Droit', quart:'Quart tournant', demi:'Demi-tournant', tq:'Trois-quarts tournant', helico:'Hélicoïdal (colimaçon)'};
const STAIR_MATS = {bois:'Bois (marches 45 mm, limons)', beton:'Béton (paillasse)', acier:'Acier et bois (limon central)'};   // ancien réglage, remplacé par STAIR_STYLES
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
    : (() => { const q = Math.floor(rest / 4), r = rest - q * 4, f = [0, 1, 2, 3].map(x => q + (x < r ? 1 : 0)); return [['f', f[0]], ['t'], ['f', f[1]], ['t'], ['f', f[2]], ['t'], ['f', f[3]]]; })();
  let A = [0, 0], B = [w, 0], d = [0, 1]; const out = [], add = (p, q) => [p[0] + q[0], p[1] + q[1]], mul = (p, s) => [p[0] * s, p[1] * s];
  for (const [op, n] of plan){
    if (op === 'f') for (let i = 0; i < n; i++){ const A2 = add(A, mul(d, D.g)), B2 = add(B, mul(d, D.g)); out.push({poly:[A, B, B2, A2], walk:mul(add(add(A, B), mul(d, D.g)), 0.5), outer:right ? [A, A2] : [B, B2], inner:right ? [B, B2] : [A, A2], k:++k}); A = A2; B = B2; }
    else if (pal){ // palier carré au tournant : une seule hauteur de marche, deux triangles de même niveau
      const pv = right ? B : A, s0 = right ? A : B, c1 = add(s0, mul(d, w)), e = add(pv, mul(d, w)); k++;
      out.push({poly:right ? [pv, s0, c1] : [pv, c1, s0], walk:mul(add(add(pv, s0), c1), 1 / 3), outer:[s0, c1], k, pal:true}, {poly:right ? [pv, c1, e] : [pv, e, c1], walk:mul(add(add(pv, c1), e), 1 / 3), outer:[c1, e], k, pal:true});
      if (right){ A = e; B = pv; d = rotR(d); } else { A = pv; B = e; d = rotL(d); }
    } else {
      const pv = right ? B : A, s0 = right ? A : B, c1 = add(s0, mul(d, w)), e = add(pv, mul(d, w)), path = [s0, c1, e], L = 2 * w;
      const at = t => t <= w ? add(s0, mul(d, t)) : add(c1, mul([e[0] - c1[0], e[1] - c1[1]], (t - w) / w));
      for (let q = 0; q < kT; q++){ const t0 = L * q / kT, t1 = L * (q + 1) / kT, pts = [at(t0)]; if (t0 < w && t1 > w) pts.push(c1); pts.push(at(t1));
        const poly = right ? [pv, ...pts] : [pv, ...pts.reverse()], mid = at((t0 + t1) / 2); out.push({poly, walk:mul(add(pv, mid), 0.5), outer:[at(t0), at(t1)], k:++k}); }
      if (right){ A = e; B = pv; d = rotR(d); } else { A = pv; B = e; d = rotL(d); }
    }
  }
  return out;
}
const stairXf = el => { const a = (el.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), o = el.c || [0, 0]; return p => [o[0] + p[0] * c - p[1] * s, o[1] + p[0] * s + p[1] * c]; };
function stairFootprint(el){ const X = stairXf(el), pts = stairTreads(el).flatMap(t => t.poly.map(X)); if (!pts.length) return null; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return {x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys)}; }
/* ---------- 25 designs × 5 styles de matériaux ----------
   Un design fixe la forme (type d'escalier, palier), la structure (limons, crémaillère, limon central, marches flottantes, paillasse,
   tirants, fût) et le garde-corps ; un style fixe les matériaux. Les deux se combinent librement (125 variantes). */
const STAIR_STYLES = [
  {id:1, n:'Bois chaud',            sw:['#B88A57', '#7A5530'], mat:'bois',  tread:'chene',      str:'chene',  rail:'chene',    bal:'acierLaque', riser:'chene',   mass:'ba'},
  {id:2, n:'Béton et acier loft',   sw:['#9FA3A6', '#3A3F46'], mat:'beton', tread:'betonCire',  str:'beton',  rail:'acierLaque', bal:'acierLaque', riser:'betonCire', mass:'beton'},
  {id:3, n:'Acier industriel',      sw:['#8C96A2', '#4A5058'], mat:'acier', tread:'acier',      str:'acier',  rail:'acier',    bal:'acier',      riser:'acier',   mass:'acier'},
  {id:4, n:'Verre et inox',         sw:['#9FD0E2', '#B9C0C6'], mat:'acier', tread:'verre',      str:'inox',   rail:'inox',     bal:'inox',       riser:'verre',   mass:'inox', glass:'vitrage'},
  {id:5, n:'Pierre naturelle et bois', sw:['#C9BFA9', '#8A6238'], mat:'beton', tread:'pierreSol', str:'granit', rail:'chene',  bal:'acierLaque', riser:'pierreSol', mass:'pierreSol'}];
const D_ = (n, st, str, balu, o = {}) => ({n, st, str, balu, ...o});
const STAIR_DESIGNS = [
  D_('Droit à limons latéraux', 'droit', 'lim2', 'barr'), D_('Droit à crémaillère', 'droit', 'crem', 'main'), D_('Droit à limon central', 'droit', 'cen', 'cable'),
  D_('Droit flottant sur mur', 'droit', 'flot', 'main'), D_('Droit béton à paillasse', 'droit', 'pail', 'plein'), D_('Droit à contremarches et verre', 'droit', 'lim1', 'verre', {cm:true}),
  D_('Droit suspendu à tirants', 'droit', 'tir', 'cable'), D_('Droit à double rampe', 'droit', 'lim2', 'main', {rail2:true}), D_('Droit monobloc épais et verre', 'droit', 'flot', 'verre', {thick:0.09}),
  D_('Quart tournant à limons', 'quart', 'lim1', 'barr'), D_('Quart tournant à crémaillère', 'quart', 'crem', 'main'), D_('Quart tournant avec palier', 'quart', 'lim2', 'barr', {pal:true}),
  D_('Quart tournant flottant', 'quart', 'flot', 'verre'), D_('Quart tournant béton', 'quart', 'pail', 'plein'), D_('Quart tournant à limon central', 'quart', 'cen', 'cable'),
  D_('Demi-tournant à limons', 'demi', 'lim1', 'barr'), D_('Demi-tournant à palier (en U)', 'demi', 'lim2', 'verre', {pal:true}), D_('Demi-tournant à crémaillère', 'demi', 'crem', 'cable'),
  D_('Demi-tournant béton', 'demi', 'pail', 'plein'), D_('Trois-quarts tournant à limons', 'tq', 'lim1', 'barr'), D_('Trois-quarts à paliers', 'tq', 'lim2', 'main', {pal:true}),
  D_('Hélicoïdal à fût central', 'helico', 'colim', 'barr'), D_('Hélicoïdal et verre', 'helico', 'colim', 'verre'), D_('Hélicoïdal à câbles', 'helico', 'colim', 'cable'),
  D_('Échelle de meunier (pente raide)', 'droit', 'lim1', 'main', {w:0.6, hs:0.21, g:0.21})];
const stairStyle = el => STAIR_STYLES.find(x => x.id === el.sty) || STAIR_STYLES.find(x => x.mat === (el.mat || 'bois')) || STAIR_STYLES[0];
const stairCfg = el => { const d = STAIR_DESIGNS[(el.dsg | 0) - 1]; return d ? d : {st:el.st || 'droit', str:(el.mat === 'beton' ? 'pail' : 'lim1'), balu:'main'}; };
/* applique un design (et un style) à un escalier : forme, palier, contremarches, emmarchement, hauteur / giron imposés */
function stairApplyDesign(el, dsg, sty){
  if (sty) { el.sty = sty; el.mat = stairStyle(el).mat; }
  if (!dsg) return el;
  const d = STAIR_DESIGNS[dsg - 1]; if (!d) return el;
  el.dsg = dsg; el.st = d.st; el.pal = !!d.pal; el.cm = !!d.cm; el.rail2 = !!d.rail2;
  if (d.w) el.w = d.w; else if (el.w < 0.8) el.w = 0.9;
  if (d.hs) el.hs = d.hs; else delete el.hs;
  if (d.g) el.g = d.g; else delete el.g;
  if (d.st === 'helico' && !el.R) el.R = 0.8;
  return el;
}
function stairPieces(el){
  const D = stairDims(el), X = stairXf(el), z0 = lvlZ(el.lvl) + (el.off || 0), T = stairTreads(el), out = [], ST = stairStyle(el), C = stairCfg(el), st = el.st || 'droit', helico = st === 'helico';
  const lot = 'Second œuvre', add = (p, mt, l = lot) => out.push({...p, mat:mt, lot:l, stair:true});
  const mem = (A, B, w, h, mt, kind = 'limon') => add(memberPiece({A, B, w, h, kind, id:''}), mt);
  const str = C.str, tT = str === 'flot' ? (C.thick || 0.07) : str === 'pail' ? 0.03 : 0.045;
  const zt = (t, i) => z0 + (t.k ?? i + 1) * D.h;
  const xy = (p, z) => { const q = X(p); return [q[0], q[1], z]; };
  /* marches, contremarches, masse (paillasse) */
  T.forEach((t, i) => {
    const poly = t.poly.map(X), z = zt(t, i);
    if (str === 'pail'){ const hh = Math.min(D.h + 0.14, z - z0) - tT; out.push({poly, top:poly.map(p => [p[0], p[1], z - tT]), ext:[0, 0, -hh], base:z - tT - hh, h:hh, mat:ST.mass, lot:'Gros œuvre', stair:true}); }
    out.push({poly, top:poly.map(p => [p[0], p[1], z]), ext:[0, 0, -tT], base:z - tT, h:tT, mat:ST.tread, lot, stair:true});
    if (el.cm && str !== 'pail' && !t.pal && !helico){ const [a, b] = [poly[0], poly[1]], n = V.norm([-(b[1] - a[1]), b[0] - a[0]]), e = 0.02, q = [a, b, V.add(b, V.mul(n, e)), V.add(a, V.mul(n, e))];
      add({poly:q, top:q.map(p => [p[0], p[1], z - tT]), ext:[0, 0, -(D.h - tT)], base:z - D.h, h:D.h - tT}, ST.riser); }
  });
  /* ligne de nez de marche : points (x, y, z) le long du bord extérieur */
  const NL = []; T.forEach((t, i) => { const [p0] = t.outer.map(X); NL.push([p0[0], p0[1], zt(t, i)]); });
  if (T.length){ const t = T.at(-1), p1 = X(t.outer[1]); NL.push([p1[0], p1[1], zt(t, T.length - 1) + (t.pal ? 0 : D.h)]); }
  /* structure */
  const segs = [], lim = (A, B, w, h, mt, up = 0.08) => mem([A[0], A[1], A[2] + up], [B[0], B[1], B[2] + up], w, h, mt);
  if (str === 'lim1' || str === 'lim2'){
    T.forEach((t, i) => { const [p0, p1] = t.outer.map(X), z = zt(t, i); lim([p0[0], p0[1], z], [p1[0], p1[1], z + (t.pal ? 0 : D.h)], 0.045, 0.3, ST.str);
      if (str === 'lim2' && t.inner){ const [q0, q1] = t.inner.map(X); lim([q0[0], q0[1], z], [q1[0], q1[1], z + D.h], 0.045, 0.3, ST.str); } });
  } else if (str === 'crem'){
    T.forEach((t, i) => { const z = zt(t, i), [p0, p1] = t.outer.map(X), c = X(t.walk), m = V.mul(V.add(p0, p1), .5), dir = V.norm(V.sub(c, m)), o = V.mul(dir, 0.07), q = [p0, p1, V.add(p1, o), V.add(p0, o)];
      add({poly:q, top:q.map(p => [p[0], p[1], z - tT]), ext:[0, 0, -(D.h + 0.1)], base:z - tT - D.h - 0.1, h:D.h + 0.1}, ST.str); });
  } else if (str === 'cen'){
    for (let i = 0; i + 1 < T.length; i++){ const a = X(T[i].walk), b = X(T[i + 1].walk), z = zt(T[i], i); if (V.len(V.sub(a, b)) < 1e-3) continue; mem([a[0], a[1], z - tT - 0.02], [b[0], b[1], z + D.h - tT - 0.02], 0.12, 0.22, ST.str); }
    if (T.length){ const a = X(T[0].walk), z = zt(T[0], 0); mem([a[0], a[1], z - tT - 0.02 - D.h], [a[0], a[1], z - tT - 0.02], 0.12, 0.22, ST.str); }
  } else if (str === 'tir'){
    const zTop = z0 + D.H + 0.3; T.forEach((t, i) => { const [p0] = t.outer.map(X), z = zt(t, i); mem([p0[0], p0[1], zTop], [p0[0], p0[1], z], 0.016, 0.016, ST.str === 'chene' ? 'acierLaque' : ST.str, 'post'); });
  } else if (str === 'colim' || helico){
    const c = X([0, 0]), r = 0.08, circ = Array.from({length:12}, (_, k) => [c[0] + r * Math.cos(k * Math.PI / 6), c[1] + r * Math.sin(k * Math.PI / 6)]), H = D.H + 1;
    out.push({poly:circ, top:circ.map(p => [p[0], p[1], z0 + H]), ext:[0, 0, -H], base:z0, h:H, mat:ST.mass === 'ba' ? 'acier' : ST.mass, lot, stair:true});
  }
  /* garde-corps : main courante le long de la ligne de nez, poteaux, remplissage */
  const railH = el.railH > 0.5 ? el.railH : 0.9, B = C.balu, RM = ST.rail;
  if (el.rail !== false && NL.length > 1 && B !== 'none'){
    const up = p => [p[0], p[1], p[2] + railH];
    for (let i = 0; i + 1 < NL.length; i++){ const a = NL[i], b = NL[i + 1], hl = Math.hypot(b[0] - a[0], b[1] - a[1]); if (hl < 1e-3) continue;
      mem(up(a), up(b), 0.045, 0.045, RM, 'rail');
      if (B === 'verre') mem([a[0], a[1], a[2] + railH - 0.045], [b[0], b[1], b[2] + railH - 0.045], 0.012, railH - 0.12, ST.glass || 'vitrage', 'verre');
      else if (B === 'plein') mem([a[0], a[1], a[2] + railH - 0.045], [b[0], b[1], b[2] + railH - 0.045], 0.04, railH - 0.14, ST.mass, 'plein');
      else if (B === 'barr'){ for (const f of [1 / 3, 2 / 3]){ const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f; mem([x, y, z + railH - 0.045], [x, y, z + 0.04], 0.014, 0.014, ST.bal, 'post'); } }
      else if (B === 'cable'){ for (const f of [0.25, 0.5, 0.75]) mem([a[0], a[1], a[2] + railH * f], [b[0], b[1], b[2] + railH * f], 0.008, 0.008, 'inox', 'rail'); }
    }
    if (str !== 'flot' || B !== 'main') NL.forEach((p, i) => { if (i % 3 === 0 || i === NL.length - 1) mem(up(p), [p[0], p[1], p[2] + (B === 'verre' ? 0.08 : 0)], 0.04, 0.04, B === 'verre' || B === 'cable' ? 'inox' : RM, 'post'); });
  }
  if (el.rail2 && !helico){ // seconde main courante côté intérieur (volées droites)
    const IL = []; T.forEach((t, i) => { if (!t.inner) return; const [q0, q1] = t.inner.map(X), z = zt(t, i); IL.push([q0[0], q0[1], z + railH], [q1[0], q1[1], z + D.h + railH]); });
    for (let i = 0; i + 1 < IL.length; i += 2) if (IL[i + 1]) mem(IL[i], IL[i + 1], 0.045, 0.045, RM, 'rail');
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

/* ---------- galerie : 25 designs × 5 styles, vignettes tracées par le code (plan des marches) ---------- */
function stairThumb(dsg, sty){
  const d = STAIR_DESIGNS[dsg - 1], S = STAIR_STYLES[sty - 1], t0 = stairApplyDesign({st:d.st, side:'d', w:0.9, lvl:0, H:2.8}, dsg, null), T = stairTreads(t0);
  const pts = T.flatMap(t => t.poly), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), k = 86 / Math.max(x1 - x0, y1 - y0, 0.5);
  const tx = x => ((x - x0) * k + (96 - (x1 - x0) * k) / 2).toFixed(1), ty = y => (96 - ((y - y0) * k + (96 - (y1 - y0) * k) / 2)).toFixed(1);
  return `<svg viewBox="0 0 96 96" aria-hidden="true">${T.map(t => `<polygon points="${t.poly.map(p => tx(p[0]) + ',' + ty(p[1])).join(' ')}" fill="${S.sw[0]}" stroke="${S.sw[1]}" stroke-width="1"/>`).join('')}</svg>`;
}
function openStairGallery(id){
  const el = getEl(id); if (!el) return; let sty = stairStyle(el).id;
  const render = () => `<header class="ed-h"><div><span class="eyebrow">Escalier ${el.id}</span><h3 class="ed-t2">Galerie des escaliers</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><div class="stg-sty">${STAIR_STYLES.map(x => `<button type="button" class="${x.id === sty ? 'on' : ''}" data-sty="${x.id}"><i style="background:linear-gradient(135deg,${x.sw[0]} 50%,${x.sw[1]} 50%)"></i>${esc(x.n)}</button>`).join('')}</div>
    <div class="stg">${STAIR_DESIGNS.map((d, i) => `<button type="button" class="stg-c${(el.dsg | 0) === i + 1 ? ' on' : ''}" data-dsg="${i + 1}">${stairThumb(i + 1, sty)}<b>${i + 1}</b><span>${esc(d.n)}</span></button>`).join('')}</div></div>
    <footer class="ed-f"><button class="btn primary" data-close>Terminer</button></footer>`;
  const wire = d => {
    d.querySelectorAll('[data-sty]').forEach(b => b.onclick = () => { sty = +b.dataset.sty; pushHist(); stairApplyDesign(el, null, sty); state.isSample = false; rebuild({noPanel:true}); const dd = openEDlg(render(), 'wide'); wire(dd); });
    d.querySelectorAll('[data-dsg]').forEach(b => b.onclick = () => { pushHist(); stairApplyDesign(el, +b.dataset.dsg, sty); state.isSample = false; rebuild({noPanel:true}); const dd = openEDlg(render(), 'wide'); wire(dd); });
    d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { closeEDlg(); renderPanel(); });
  };
  wire(openEDlg(render(), 'wide'));
}
