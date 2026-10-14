/* ============ Toitures : 2 pans, 4 pans (croupes), 1 pan (appentis), plate ============
   roof {type (composition de toiture), p, q (rectangle des murs, en plan), lvl, off (hauteur d'égout au-dessus du niveau),
         shape '2'|'4'|'1'|'0', pitch (°), ov (débord, m), dir 'x'|'y' (faîtage parallèle à x ou y), gable (pignons maçonnés)}
   Les pans sont des plaques inclinées en couches (couverture, écran, isolant, parement), au vrai volume ; les pignons sont
   des triangles maçonnés. Les « pièces » renvoyées gardent l'interface commune (poly en plan × h = volume exact). */
const ROOF_SHAPES = {'2':'2 pans', '4':'4 pans (croupes)', '1':'1 pan (appentis)', '0':'Toiture plate'};
const roofPitch = el => el.shape === '0' ? 0 : clamp(el.pitch ?? 35, 3, 70);
function roofGeom(el){
  const ov = Math.max(0, el.ov ?? 0.4), a = Math.atan(1) * 0 + roofPitch(el) * Math.PI / 180, tp = Math.tan(a), zE = lvlZ(el.lvl) + (el.off ?? 2.7);
  const X0 = Math.min(el.p[0], el.q[0]), X1 = Math.max(el.p[0], el.q[0]), Y0 = Math.min(el.p[1], el.q[1]), Y1 = Math.max(el.p[1], el.q[1]);
  const ax = (el.dir || (X1 - X0 >= Y1 - Y0 ? 'x' : 'y')) === 'x';
  // repère local : u le long du faîtage, v en travers (montée du pan)
  const U0 = ax ? X0 : Y0, U1 = ax ? X1 : Y1, V0 = ax ? Y0 : X0, V1 = ax ? Y1 : X1, W = V1 - V0, vm = (V0 + V1) / 2;
  const P = (u, v, z) => ax ? [u, v, z] : [v, u, z];
  const u0 = U0 - ov, u1 = U1 + ov, v0 = V0 - ov, v1 = V1 + ov, zEo = zE - ov * tp;
  const pans = [], gables = [], ridges = [];
  const shape = el.shape || '2';
  if (shape === '0') pans.push([P(u0, v0, zE), P(u1, v0, zE), P(u1, v1, zE), P(u0, v1, zE)]);
  else if (shape === '1'){
    const z1 = zE + (W + ov) * tp;
    pans.push([P(u0, v0, zEo), P(u1, v0, zEo), P(u1, v1, z1), P(u0, v1, z1)]);
    if (el.gable !== false){ const zt = zE + W * tp; gables.push({tri:[P(U0, V0, zE), P(U0, V1, zE), P(U0, V1, zt)], dir:ax ? [1, 0] : [0, 1]}, {tri:[P(U1, V0, zE), P(U1, V1, zE), P(U1, V1, zt)], dir:ax ? [-1, 0] : [0, -1]}); }
  } else if (shape === '2'){
    const zR = zE + (W / 2) * tp;
    pans.push([P(u0, v0, zEo), P(u1, v0, zEo), P(u1, vm, zR), P(u0, vm, zR)], [P(u1, v1, zEo), P(u0, v1, zEo), P(u0, vm, zR), P(u1, vm, zR)]);
    ridges.push([P(u0, vm, zR), P(u1, vm, zR)]);
    if (el.gable !== false) gables.push({tri:[P(U0, V0, zE), P(U0, V1, zE), P(U0, vm, zR)], dir:ax ? [1, 0] : [0, 1]}, {tri:[P(U1, V0, zE), P(U1, V1, zE), P(U1, vm, zR)], dir:ax ? [-1, 0] : [0, -1]});
  } else { // 4 pans : faîtage raccourci de W/2 à chaque bout (pyramide si le plan est carré)
    const half = Math.min(W / 2, (U1 - U0) / 2), zR = zE + half * tp, ur0 = U0 + half, ur1 = U1 - half, vr0 = vm, vr1 = vm;
    pans.push([P(u0, v0, zEo), P(u1, v0, zEo), P(ur1, vr0, zR), P(ur0, vr0, zR)], [P(u1, v1, zEo), P(u0, v1, zEo), P(ur0, vr1, zR), P(ur1, vr1, zR)],
      [P(u0, v1, zEo), P(u0, v0, zEo), P(ur0, vm, zR)], [P(u1, v0, zEo), P(u1, v1, zEo), P(ur1, vm, zR)]);
    if (ur1 - ur0 > 1e-3) ridges.push([P(ur0, vm, zR), P(ur1, vm, zR)]);
  }
  return {pans:pans.map(p => p.filter((q, i) => i === 0 || Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1], q[2] - p[i - 1][2]) > 1e-6)), gables, ridges, a, zE, zEo, ax, W,
    eaveLen:shape === '0' ? 2 * (u1 - u0 + v1 - v0) : shape === '1' ? (u1 - u0) : shape === '2' ? 2 * (u1 - u0) : 2 * (u1 - u0 + v1 - v0),
    outline:[P(u0, v0, 0), P(u1, v0, 0), P(u1, v1, 0), P(u0, v1, 0)].map(q => [q[0], q[1]]), wall:[[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]]};
}
const planArea3 = pts => Math.abs(area(pts.map(q => [q[0], q[1]])));
function roofPieces(el){
  const G = roofGeom(el), C = compo(el.type), c = Math.cos(G.a), out = [];
  for (const pan of G.pans){
    let dzs = 0; const poly = pan.map(q => [q[0], q[1]]);
    for (const [m, e] of C.layers){
      const dz = e / c, top = pan.map(q => [q[0], q[1], q[2] - dzs]);
      out.push({poly, top, ext:[0, 0, -dz], base:Math.min(...top.map(q => q[2])) - dz, h:dz, mat:m, lot:C.lot || 'Gros œuvre', e, roof:true});
      dzs += dz;
    }
  }
  for (const g of G.gables){
    const t = 0.2, [A, B, T] = g.tri, Hh = T[2] - A[2], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const d = g.dir, rectP = [[A[0], A[1]], [B[0], B[1]], [B[0] + d[0] * t, B[1] + d[1] * t], [A[0] + d[0] * t, A[1] + d[1] * t]];
    out.push({poly:rectP, top:g.tri, ext:[d[0] * t, d[1] * t, 0], base:A[2], h:Hh / 2, mat:el.gableMat || 'parpaing', lot:'Gros œuvre', e:t, gable:true, area:L * Hh / 2});
  }
  return out;
}
/* Surfaces utiles au métré : rampants (vraie grandeur), égouts, faîtages, pignons */
function roofQty(el){
  const G = roofGeom(el), c = Math.cos(G.a);
  return {slope:G.pans.reduce((s, p) => s + planArea3(p), 0) / (c || 1), plan:G.pans.reduce((s, p) => s + planArea3(p), 0), eave:G.eaveLen,
    ridge:G.ridges.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0), gable:G.gables.reduce((s, g) => { const [A, B, T] = g.tri; return s + Math.hypot(B[0] - A[0], B[1] - A[1]) * (T[2] - A[2]) / 2; }, 0)};
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
