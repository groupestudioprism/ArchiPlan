/* ============ Toitures : 2 pans, 4 pans (croupes), 1 pan (appentis), plate — sur rectangle ou sur contour orthogonal ============
   roof {type (composition de toiture), p, q (rectangle des murs) | poly:[[x,y]…] (contour des murs, côtés parallèles aux axes),
         lvl, off (dessus des murs = appui de la toiture, au-dessus du niveau), shape '2'|'4'|'1'|'0', pitch (°), ov (débord, m),
         dir 'x'|'y' (faîtage d'un toit rectangulaire), gable (pignons), gableType (composition de mur des pignons, '' = celle des murs),
         ceil '' | 'platre' | 'combles' (plafond sous toiture), frame {mode 'auto'|'none', kind 'trad'|'fermettes', sp, …, off:[ids]},
         frameView (charpente affichée dans la maquette, couverture masquée)}
   La sous-face de la toiture repose sur le dessus des murs à l'aplomb de leur axe : plus aucun mur ne traverse la couverture.
   Un contour en L, T, U… est découpé en ailes rectangulaires qui se recoupent : les noues se forment d'elles-mêmes (même pente). */
const ROOF_SHAPES = {'2':'2 pans', '4':'4 pans (croupes)', '1':'1 pan (appentis)', '0':'Toiture plate'};
const ROOF_CEIL = {'':'Sans plafond (rampants habillés)', platre:'Plafond en plaque de plâtre', combles:'Plafond + isolant en combles perdus'};
const roofPitch = el => el.shape === '0' ? 0 : clamp(el.pitch ?? 35, 3, 70);
const roofT = el => compo(el.type).layers.reduce((s, [, e]) => s + e, 0);
const roofBase = el => lvlZ(el.lvl) + (el.off ?? 2.7);
const roofWallPoly = el => el.poly && el.poly.length >= 4 ? el.poly.map(q => [q[0], q[1]]) : rect(el.p, el.q);
const sArea = p => { let a = 0; for (let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
function ptInPoly(x, y, p){ let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++){ const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const isOrtho = p => p.every((q, i) => { const r = p[(i + 1) % p.length]; return Math.abs(q[0] - r[0]) < 1e-6 || Math.abs(q[1] - r[1]) < 1e-6; });
/* Découpe d'un contour orthogonal en ailes rectangulaires (maximales, qui peuvent se recouvrir) */
function orthoRects(poly){
  const xs = [...new Set(poly.map(q => +q[0].toFixed(4)))].sort((a, b) => a - b), ys = [...new Set(poly.map(q => +q[1].toFixed(4)))].sort((a, b) => a - b);
  const nx = xs.length - 1, ny = ys.length - 1, IN = [], cov = [];
  for (let i = 0; i < nx; i++){ IN[i] = []; cov[i] = []; for (let j = 0; j < ny; j++){ IN[i][j] = ptInPoly((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2, poly); cov[i][j] = false; } }
  const full = (i0, i1, j0, j1) => { for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!IN[i][j]) return false; return true; };
  const grow = (i, j, xFirst) => { let i0 = i, i1 = i, j0 = j, j1 = j;
    const gx = () => { while (i0 > 0 && full(i0 - 1, i0 - 1, j0, j1)) i0--; while (i1 < nx - 1 && full(i1 + 1, i1 + 1, j0, j1)) i1++; };
    const gy = () => { while (j0 > 0 && full(i0, i1, j0 - 1, j0 - 1)) j0--; while (j1 < ny - 1 && full(i0, i1, j1 + 1, j1 + 1)) j1++; };
    if (xFirst){ gx(); gy(); } else { gy(); gx(); } return {i0, i1, j0, j1, a:(xs[i1 + 1] - xs[i0]) * (ys[j1 + 1] - ys[j0])}; };
  const out = [];
  for (let guard = 0; guard < 50; guard++){
    let best = null;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (IN[i][j] && !cov[i][j]) for (const xf of [true, false]){ const r = grow(i, j, xf); let nw = 0; for (let a = r.i0; a <= r.i1; a++) for (let b = r.j0; b <= r.j1; b++) if (!cov[a][b]) nw += (xs[a + 1] - xs[a]) * (ys[b + 1] - ys[b]); if (!best || nw > best.nw + 1e-9 || (Math.abs(nw - best.nw) < 1e-9 && r.a > best.a)) best = {...r, nw}; }
    if (!best) break;
    for (let a = best.i0; a <= best.i1; a++) for (let b = best.j0; b <= best.j1; b++) cov[a][b] = true;
    out.push({x0:xs[best.i0], x1:xs[best.i1 + 1], y0:ys[best.j0], y1:ys[best.j1 + 1]});
  }
  return out;
}
/* Ailes de la toiture : {x0, x1, y0, y1, ax (faîtage // x), open:{u0, u1} (bout intérieur : pas de pignon, pas de croupe)} */
function roofRects(el){
  const wp = roofWallPoly(el);
  if (!(el.poly && el.poly.length >= 4)){ const r = wp, x0 = r[0][0], x1 = r[1][0], y0 = r[0][1], y1 = r[2][1];
    return [{x0, x1, y0, y1, ax:(el.dir || (x1 - x0 >= y1 - y0 ? 'x' : 'y')) === 'x', open:{u0:false, u1:false}}]; }
  const rs = isOrtho(wp) ? orthoRects(wp) : (() => { const xs = wp.map(q => q[0]), ys = wp.map(q => q[1]); return [{x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys)}]; })();
  const onBoundary = (a, b) => { // segment entièrement sur le contour ?
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], e = 1e-3, d = Math.abs(a[0] - b[0]) < e ? [e * 20, 0] : [0, e * 20];
    return ptInPoly(m[0] + d[0], m[1] + d[1], wp) !== ptInPoly(m[0] - d[0], m[1] - d[1], wp); };
  const W = rs.map(r => { const ax = r.x1 - r.x0 >= r.y1 - r.y0;
    const u0 = ax ? onBoundary([r.x0, r.y0], [r.x0, r.y1]) : onBoundary([r.x0, r.y0], [r.x1, r.y0]), u1 = ax ? onBoundary([r.x1, r.y0], [r.x1, r.y1]) : onBoundary([r.x0, r.y1], [r.x1, r.y1]);
    return {...r, ax, open:{u0:!u0, u1:!u1}}; });
  // ailes qui se croisent : la moins large s'arrête au faîtage de l'autre (noues), sans pignon ni débord à ce bout
  const e = 1e-6, wid = r => r.ax ? r.y1 - r.y0 : r.x1 - r.x0;
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++){
    const A = W[i], B = W[j]; if (A.ax === B.ax) continue;
    if (Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) < e || Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) < e) continue;
    const N = wid(B) <= wid(A) + e ? B : A, K = N === B ? A : B;
    if (N.ax){ const c = (K.x0 + K.x1) / 2; if (N.x0 >= K.x0 - e && N.x0 <= K.x1 + e && c > N.x0 && c < N.x1){ N.x0 = c; N.open.u0 = true; } if (N.x1 >= K.x0 - e && N.x1 <= K.x1 + e && c < N.x1 && c > N.x0){ N.x1 = c; N.open.u1 = true; } }
    else { const c = (K.y0 + K.y1) / 2; if (N.y0 >= K.y0 - e && N.y0 <= K.y1 + e && c > N.y0 && c < N.y1){ N.y0 = c; N.open.u0 = true; } if (N.y1 >= K.y0 - e && N.y1 <= K.y1 + e && c < N.y1 && c > N.y0){ N.y1 = c; N.open.u1 = true; } }
  }
  return W;
}
/* Géométrie d'une aile. Les pans (dessus de couverture) sont relevés de l'épaisseur verticale de la toiture : leur sous-face passe par le dessus des murs. */
function roofWing(el, R){
  const ov = Math.max(0, el.ov ?? 0.4), a = roofPitch(el) * Math.PI / 180, tp = Math.tan(a), base = roofBase(el), Tv = roofT(el) / Math.cos(a), zE = base + Tv;
  const ax = R.ax, U0 = ax ? R.x0 : R.y0, U1 = ax ? R.x1 : R.y1, V0 = ax ? R.y0 : R.x0, V1 = ax ? R.y1 : R.x1, W = V1 - V0, vm = (V0 + V1) / 2;
  const P = (u, v, z) => ax ? [u, v, z] : [v, u, z];
  const u0 = U0 - (R.open.u0 ? 0 : ov), u1 = U1 + (R.open.u1 ? 0 : ov), v0 = V0 - ov, v1 = V1 + ov, zEo = zE - ov * tp;
  const pans = [], gables = [], ridges = [], hips = [], shape = el.shape || '2';
  const gIn = s => ax ? [s, 0] : [0, s];
  const wantG = end => el.gable !== false && !R.open[end];
  if (shape === '0') pans.push([P(u0, v0, zE), P(u1, v0, zE), P(u1, v1, zE), P(u0, v1, zE)]);
  else if (shape === '1'){
    const z1 = zE + (W + ov) * tp; pans.push([P(u0, v0, zEo), P(u1, v0, zEo), P(u1, v1, z1), P(u0, v1, z1)]);
    const zt = base + W * tp;
    if (wantG('u0')) gables.push({tri:[P(U0, V0, base), P(U0, V1, base), P(U0, V1, zt)], dir:gIn(1), end:'u0'});
    if (wantG('u1')) gables.push({tri:[P(U1, V0, base), P(U1, V1, base), P(U1, V1, zt)], dir:gIn(-1), end:'u1'});
  } else if (shape === '2' || R.open.u0 || R.open.u1){
    // 2 pans ; une croupe n'est posée qu'aux bouts extérieurs d'un toit à 4 pans
    const zR = zE + (W / 2) * tp, hip = shape === '4', h0 = hip && !R.open.u0 ? Math.min(W / 2, (U1 - U0) / 2) : 0, h1 = hip && !R.open.u1 ? Math.min(W / 2, (U1 - U0) / 2) : 0;
    const ur0 = (h0 ? U0 + h0 : u0), ur1 = (h1 ? U1 - h1 : u1);
    pans.push([P(u0, v0, zEo), P(u1, v0, zEo), P(ur1, vm, zR), P(ur0, vm, zR)], [P(u1, v1, zEo), P(u0, v1, zEo), P(ur0, vm, zR), P(ur1, vm, zR)]);
    if (h0){ pans.push([P(u0, v1, zEo), P(u0, v0, zEo), P(ur0, vm, zR)]); hips.push([P(u0, v0, zEo), P(ur0, vm, zR)], [P(u0, v1, zEo), P(ur0, vm, zR)]); }
    if (h1){ pans.push([P(u1, v0, zEo), P(u1, v1, zEo), P(ur1, vm, zR)]); hips.push([P(u1, v0, zEo), P(ur1, vm, zR)], [P(u1, v1, zEo), P(ur1, vm, zR)]); }
    if (ur1 - ur0 > 1e-3) ridges.push([P(ur0, vm, zR), P(ur1, vm, zR)]);
    const zg = base + (W / 2) * tp;
    if (!hip && wantG('u0')) gables.push({tri:[P(U0, V0, base), P(U0, V1, base), P(U0, vm, zg)], dir:gIn(1), end:'u0'});
    if (!hip && wantG('u1')) gables.push({tri:[P(U1, V0, base), P(U1, V1, base), P(U1, vm, zg)], dir:gIn(-1), end:'u1'});
  } else { // 4 pans
    const half = Math.min(W / 2, (U1 - U0) / 2), zR = zE + half * tp, ur0 = U0 + half, ur1 = U1 - half;
    pans.push([P(u0, v0, zEo), P(u1, v0, zEo), P(ur1, vm, zR), P(ur0, vm, zR)], [P(u1, v1, zEo), P(u0, v1, zEo), P(ur0, vm, zR), P(ur1, vm, zR)],
      [P(u0, v1, zEo), P(u0, v0, zEo), P(ur0, vm, zR)], [P(u1, v0, zEo), P(u1, v1, zEo), P(ur1, vm, zR)]);
    hips.push([P(u0, v0, zEo), P(ur0, vm, zR)], [P(u0, v1, zEo), P(ur0, vm, zR)], [P(u1, v0, zEo), P(ur1, vm, zR)], [P(u1, v1, zEo), P(ur1, vm, zR)]);
    if (ur1 - ur0 > 1e-3) ridges.push([P(ur0, vm, zR), P(ur1, vm, zR)]);
  }
  const clean = p => p.filter((q, i) => i === 0 || Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1], q[2] - p[i - 1][2]) > 1e-6);
  const eave = shape === '0' ? 2 * (u1 - u0 + v1 - v0) : shape === '1' ? (u1 - u0) : 2 * (u1 - u0) + (shape === '4' ? (R.open.u0 ? 0 : v1 - v0) + (R.open.u1 ? 0 : v1 - v0) : 0);
  return {pans:pans.map(clean), gables, ridges, hips, a, tp, zE, zEo, base, Tv, ax, U0, U1, V0, V1, W, vm, u0, u1, v0, v1, eave, R};
}
function roofGeom(el){
  const wings = roofRects(el).map(R => roofWing(el, R)), a = roofPitch(el) * Math.PI / 180, ov = Math.max(0, el.ov ?? 0.4), wall = roofWallPoly(el);
  const xs = wall.map(q => q[0]), ys = wall.map(q => q[1]);
  return {wings, a, ax:wings[0]?.ax ?? true, pans:wings.flatMap(w => w.pans), gables:wings.flatMap(w => w.gables), ridges:wings.flatMap(w => w.ridges), hips:wings.flatMap(w => w.hips),
    eaveLen:wings.reduce((s, w) => s + w.eave, 0), wall, base:roofBase(el),
    outline:[[Math.min(...xs) - ov, Math.min(...ys) - ov], [Math.max(...xs) + ov, Math.min(...ys) - ov], [Math.max(...xs) + ov, Math.max(...ys) + ov], [Math.min(...xs) - ov, Math.max(...ys) + ov]]};
}
/* Composition des pignons : celle choisie, sinon celle du mur situé sous ce bout du toit, sinon un mur extérieur de base */
function gableType(el, g){
  if (el.gableType && compo(el.gableType)?.kind === 'wall') return el.gableType;
  const [A, B] = g.tri, m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  let best = null, bd = 0.6;
  for (const w of state.els) if (w.kind === 'wall' && w.lvl === el.lvl && compo(w.type).lot !== 'Second œuvre'){
    const {u, L} = wallAxis(w), t = clamp(V.dot(V.sub(m, w.a), u), 0, L), q = V.add(w.a, V.mul(u, t)), d = Math.hypot(q[0] - m[0], q[1] - m[1]);
    if (d < bd){ bd = d; best = w.type; } }
  return best || (compo('MUR-EXT-01') ? 'MUR-EXT-01' : Object.entries(libCompos()).find(([, c]) => c.kind === 'wall')?.[0]);
}
const planArea3 = pts => Math.abs(sArea(pts.map(q => [q[0], q[1]])));
function roofPieces(el){
  const G = roofGeom(el), C = compo(el.type), c = Math.cos(G.a), out = [], fv = el.frameView;
  if (!fv) for (const pan of G.pans){
    let dzs = 0; const poly = pan.map(q => [q[0], q[1]]);
    for (const [m, e] of C.layers){
      const dz = e / c, top = pan.map(q => [q[0], q[1], q[2] - dzs]);
      out.push({poly, top, ext:[0, 0, -dz], base:Math.min(...top.map(q => q[2])) - dz, h:dz, mat:m, lot:C.lot || 'Couverture', e, roof:true});
      dzs += dz;
    }
  }
  // pignons : triangles en couches, avec la composition du mur choisi, centrés sur l'axe du mur
  for (const g of G.gables){
    const wt = gableType(el, g), WC = compo(wt), T = WC.layers.reduce((s, [, e]) => s + e, 0), o = [-g.dir[0], -g.dir[1]], [A, B, Tp] = g.tri, Hh = Tp[2] - A[2], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    let s = 0;
    for (const [m, e] of WC.layers){
      const off = T / 2 - s, top = g.tri.map(q => [q[0] + o[0] * off, q[1] + o[1] * off, q[2]]);
      const poly = [[top[0][0], top[0][1]], [top[1][0], top[1][1]], [top[1][0] - o[0] * e, top[1][1] - o[1] * e], [top[0][0] - o[0] * e, top[0][1] - o[1] * e]];
      out.push({poly, top, ext:[-o[0] * e, -o[1] * e, 0], base:A[2], h:Hh / 2, mat:m, lot:WC.lot || 'Gros œuvre', e, gable:true, area:L * Hh / 2});
      s += e;
    }
  }
  // plafond sous toiture (plaque de plâtre, et isolant en combles perdus)
  if (el.ceil){ const wp = roofWallPoly(el), b = G.base;
    out.push({poly:wp, base:b - 0.013, h:0.013, mat:'ba13', lot:'Second œuvre', e:0.013, ceil:true});
    if (el.ceil === 'combles') out.push({poly:wp, base:b, h:0.3, mat:'laineVerre', lot:'Second œuvre', e:0.3, ceil:true}); }
  if (fv) for (const mb of roofFrame(el).filter(m => !m.off)) out.push(memberPiece(mb));
  return out;
}
/* Surfaces utiles au métré : rampants (vraie grandeur, = projection / cos pente pour une pente unique), égouts, faîtages, arêtiers, pignons */
function roofQty(el){
  const G = roofGeom(el), c = Math.cos(G.a), wp = roofWallPoly(el), ov = Math.max(0, el.ov ?? 0.4);
  let per = 0; for (let i = 0; i < wp.length; i++){ const q = wp[(i + 1) % wp.length]; per += Math.hypot(q[0] - wp[i][0], q[1] - wp[i][1]); }
  const multi = G.wings.length > 1, plan = multi ? Math.abs(sArea(wp)) + per * ov + 4 * ov * ov : G.pans.reduce((s, p) => s + planArea3(p), 0);
  const L2 = ([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return {slope:plan / (c || 1), plan, eave:multi && (el.shape || '2') !== '1' ? per + 8 * ov : G.eaveLen,
    ridge:G.ridges.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0), hip:G.hips.reduce((s, h) => s + L2(h), 0),
    gable:G.gables.reduce((s, g) => { const [A, B, T] = g.tri; return s + Math.hypot(B[0] - A[0], B[1] - A[1]) * (T[2] - A[2]) / 2; }, 0),
    ceil:el.ceil ? Math.abs(sArea(wp)) : 0};
}
/* Calage : la toiture se pose sur le dessus des murs de son niveau situés sous son contour */
function roofFitWalls(el){
  const wp = roofWallPoly(el), xs = wp.map(q => q[0]), ys = wp.map(q => q[1]), x0 = Math.min(...xs) - 0.6, x1 = Math.max(...xs) + 0.6, y0 = Math.min(...ys) - 0.6, y1 = Math.max(...ys) + 0.6;
  const tops = state.els.filter(w => w.kind === 'wall' && w.lvl === el.lvl && w.top !== 'roof' && [w.a, w.b].every(p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1)).map(w => (w.off || 0) + w.h);
  if (tops.length){ el.off = Math.round(Math.max(...tops) * 1000) / 1000; return true; }
  return false;
}
/* Contour des murs extérieurs d'un niveau (rectangle englobant si les murs ne forment pas un contour orthogonal simple) */
function wallsOutline(lvl){
  const ws = state.els.filter(w => w.kind === 'wall' && w.lvl === lvl && compo(w.type).lot !== 'Second œuvre');
  if (!ws.length) return null;
  // chaîne fermée : on suit les extrémités communes
  const key = p => `${p[0].toFixed(3)};${p[1].toFixed(3)}`, adj = {};
  ws.forEach(w => { (adj[key(w.a)] ??= []).push(w.b); (adj[key(w.b)] ??= []).push(w.a); });
  const start = ws[0].a, path = [start]; let prev = null, cur = start;
  for (let k = 0; k < ws.length + 2; k++){
    const nx = (adj[key(cur)] || []).find(p => !prev || key(p) !== key(prev)); if (!nx) break;
    if (key(nx) === key(start)){ if (path.length >= 4 && isOrtho(path)) return path.map(q => [q[0], q[1]]); break; }
    path.push(nx); prev = cur; cur = nx;
  }
  const xs = ws.flatMap(w => [w.a[0], w.b[0]]), ys = ws.flatMap(w => [w.a[1], w.b[1]]);
  return rect([Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]);
}
/* Prisme quelconque : face supérieure (polygone convexe 3D, plan y = −z scène) translatée de ext */
function prismGeo(top, ext){
  const n = top.length, toS = q => [q[0], q[2], -q[1]], E = toS(ext), T = top.map(toS), B = T.map(q => [q[0] + E[0], q[1] + E[1], q[2] + E[2]]);
  let nx = 0, ny = 0, nz = 0; for (let i = 0; i < n; i++){ const a = T[i], b = T[(i + 1) % n]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  let top2 = T, bot = B; if (nx * E[0] + ny * E[1] + nz * E[2] > 0){ top2 = T.slice().reverse(); bot = B.slice().reverse(); }
  const pos = [], uv = [], push = (...pts) => pts.forEach(p => { pos.push(p[0], p[1], p[2]); uv.push(p[0], -p[2] + p[1] * 0.3); });
  for (let i = 1; i < n - 1; i++) push(top2[0], top2[i], top2[i + 1]);
  for (let i = 1; i < n - 1; i++) push(bot[0], bot[i + 1], bot[i]);
  for (let i = 0; i < n; i++){ const j = (i + 1) % n; push(top2[i], bot[i], bot[j]); push(top2[i], bot[j], top2[j]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}
