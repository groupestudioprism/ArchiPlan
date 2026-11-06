/* ============ Cheminement des réseaux : grille de la maquette et passages intérieurs ============
   Référentiel ArchiPlan (document fondateur 4.2, 4.3, 12.7 ; règles CH-01, EL-01, EL-03) :
   - CH-01 : un réseau intérieur ne sort jamais de l'emprise du bâtiment (cellules hors des pièces interdites) ;
   - au sol (eau, évacuations, chauffage) : d'une pièce à l'autre en passant sous les portes et ouvertures, ce qui évite de percer
     les murs et limite les coudes ; à défaut sous une cloison légère (signalé) ; jamais à travers un mur porteur ou extérieur ;
   - en partie haute (électricité, communication, ventilation) : au-dessus des murs dans les combles ; sous un plancher habité,
     la traversée d'un mur porteur demande une réservation (signalée, document fondateur 4.3) ;
   - trajets orthogonaux (horizontaux et verticaux, jamais en biais), le long des murs, chaque réseau dans son couloir de pose
     (distance au mur) pour ne pas superposer eau, chauffage, électricité et communication. */
const MEP_CELL = 0.1;
const MG_OUT = 0, MG_ROOM = 1, MG_CLO = 2, MG_POR = 3, MG_EXT = 4, MG_DOOR = 5, MG_PRIO = [0, 0, 2, 3, 4, 1];
const mepIsCloison = w => !!w.partition || compo(w.type)?.lot === 'Second œuvre';
/* grille d'un niveau : nature de chaque cellule de 10 cm (pièce, porte, cloison, mur porteur, mur extérieur, dehors) */
function mepGrid(lvl){
  const key = rebuildSeq + '|' + lvl + '|' + state.els.length + '|' + state.nextId;
  mepGrid.c ??= {}; if (mepGrid.c[lvl]?.key === key) return mepGrid.c[lvl].g;
  const R = mepRooms().filter(r => r.lvl === lvl && r.kind !== 'ext'); if (!R.length) return null;
  const P = R.flatMap(r => r.poly), C = MEP_CELL, x0 = Math.min(...P.map(p => p[0])) - 0.8, y0 = Math.min(...P.map(p => p[1])) - 0.8;
  const nx = Math.ceil((Math.max(...P.map(p => p[0])) + 0.8 - x0) / C), ny = Math.ceil((Math.max(...P.map(p => p[1])) + 0.8 - y0) / C), N = nx * ny;
  const room = new Int16Array(N).fill(-1), kind = new Uint8Array(N), ctr = i => [x0 + (i % nx + 0.5) * C, y0 + (Math.floor(i / nx) + 0.5) * C];
  const cellOf = p => { const ix = Math.floor((p[0] - x0) / C), iy = Math.floor((p[1] - y0) / C); return ix < 0 || iy < 0 || ix >= nx || iy >= ny ? -1 : iy * nx + ix; };
  R.forEach((r, k) => { const xs = r.poly.map(p => p[0]), ys = r.poly.map(p => p[1]);
    for (let iy = Math.max(0, Math.floor((Math.min(...ys) - y0) / C)); iy <= Math.min(ny - 1, Math.floor((Math.max(...ys) - y0) / C)); iy++)
      for (let ix = Math.max(0, Math.floor((Math.min(...xs) - x0) / C)); ix <= Math.min(nx - 1, Math.floor((Math.max(...xs) - x0) / C)); ix++){ const i = iy * nx + ix, c = ctr(i); if (room[i] < 0 && ptInPoly(c[0], c[1], r.poly)) room[i] = k; } });
  for (let i = 0; i < N; i++) kind[i] = room[i] >= 0 ? MG_ROOM : MG_OUT;
  const inside = p => { const i = cellOf(p); return i >= 0 && room[i] >= 0; };
  const walls = state.els.filter(w => w.kind === 'wall' && w.lvl === lvl), ops = state.els.filter(e => e.kind === 'inst' && e.host);
  for (const w of walls){ const T = wallT(w), Pw = wallArc(w) ? arcPts(w, 0) : [w.a, w.b], clo = mepIsCloison(w);
    const doors = ops.filter(o => o.host === w.id).map(o => { const c = famCut(o), f = instFrame(o); return c && f ? {o:f.o, w:c.w, sill:c.sill} : null; }).filter(o => o && o.sill <= 0.05);
    for (let s = 0; s + 1 < Pw.length; s++){ const a = Pw[s], b = Pw[s + 1], d = V.sub(b, a), L = V.len(d) || 1e-9, u = V.mul(d, 1 / L), n = [-u[1], u[0]];
      const xs = [a[0], b[0]], ys = [a[1], b[1]], m = T / 2 + C * 0.5;
      for (let iy = Math.max(0, Math.floor((Math.min(...ys) - m - y0) / C)); iy <= Math.min(ny - 1, Math.floor((Math.max(...ys) + m - y0) / C)); iy++)
        for (let ix = Math.max(0, Math.floor((Math.min(...xs) - m - x0) / C)); ix <= Math.min(nx - 1, Math.floor((Math.max(...xs) + m - x0) / C)); ix++){
          const i = iy * nx + ix, c = ctr(i), t = V.dot(V.sub(c, a), u); if (t < -T / 2 || t > L + T / 2) continue;
          const off = V.dot(V.sub(c, a), n); if (Math.abs(off) > T / 2 + C * 0.35) continue;
          const foot = V.add(a, V.mul(u, clamp(t, 0, L))), ext = !inside(V.add(foot, V.mul(n, T / 2 + 0.2))) || !inside(V.sub(foot, V.mul(n, T / 2 + 0.2)));
          const door = doors.some(o => Math.abs(V.dot(V.sub(c, o.o), u)) <= o.w / 2 - 0.04);
          const k = ext ? MG_EXT : door ? MG_DOOR : clo ? MG_CLO : MG_POR;
          if (MG_PRIO[k] > MG_PRIO[kind[i]]) kind[i] = k; } } }   // à la jonction de deux murs, le plus contraignant l'emporte
  // distance au mur le plus proche (en cellules) : couloirs de pose le long des murs
  const dist = new Int16Array(N).fill(-1), q = []; for (let i = 0; i < N; i++) if (kind[i] !== MG_ROOM){ dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++){ const i = q[h], ix = i % nx; for (const j of [ix > 0 ? i - 1 : -1, ix < nx - 1 ? i + 1 : -1, i - nx, i + nx]) if (j >= 0 && j < N && dist[j] < 0){ dist[j] = dist[i] + 1; q.push(j); } }
  const above = state.levels[lvl + 1] && mepRooms().some(r => r.lvl === lvl + 1);   // plancher habité au-dessus : faux plafond, sinon combles
  const g = {lvl, x0, y0, nx, ny, N, kind, room, dist, ctr, cellOf, inside, above, rooms:R};
  mepGrid.c[lvl] = {key, g}; return g;
}
/* coût d'entrée dans une cellule selon le mode de pose ; Infinity = interdit */
function mepCellCost(g, i, mode){
  const k = g.kind[i];
  if (k === MG_ROOM || k === MG_DOOR) return 1;
  if (mode === 'floor') return k === MG_CLO ? 400 : Infinity;                       // sous une cloison légère : en dernier recours
  if (k === MG_CLO) return 2;
  if (k === MG_POR) return g.above ? 30 : 3;                                         // combles : par-dessus ; sous plancher : réservation
  return Infinity;                                                                   // mur extérieur, dehors
}
/* plus court chemin orthogonal depuis un point (Dijkstra sur cellule × direction, pénalité de coude) */
function mepDijkstra(lvl, mode, lane, from){
  const g = mepGrid(lvl); if (!g) return null;
  const s = mepSnap(g, from, mode); if (s < 0) return null;
  const N = g.N, nx = g.nx, cost = new Float64Array(N * 4).fill(Infinity), prev = new Int32Array(N * 4).fill(-1), laneC = Math.round(lane / MEP_CELL);
  const heap = [], push = (c, st) => { heap.push([c, st]); let i = heap.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (let d = 0; d < 4; d++){ cost[s * 4 + d] = 0; push(0, s * 4 + d); }
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  while (heap.length){ const [c, st] = pop(); if (c > cost[st]) continue; const i = st >> 2, d0 = st & 3, ix = i % nx, iy = (i - ix) / nx;
    for (let d = 0; d < 4; d++){ const jx = ix + DX[d], jy = iy + DY[d]; if (jx < 0 || jy < 0 || jx >= nx || jy >= g.ny) continue; const j = jy * nx + jx;
      let w = mepCellCost(g, j, mode); if (!isFinite(w)) continue;
      if (g.kind[j] === MG_ROOM) w += 0.5 * Math.min(6, Math.abs(g.dist[j] - laneC));
      const nc = c + w + (d !== d0 ? 3 : 0), ns = j * 4 + d; if (nc < cost[ns]){ cost[ns] = nc; prev[ns] = st; push(nc, ns); } } }
  return {g, cost, prev, mode, src:s, from};
}
/* cellule de départ ou d'arrivée : la plus proche cellule de pièce (≤ 1 m) */
function mepSnap(g, p, mode){
  let best = -1, bd = 1e9; const c0 = g.cellOf(p), R = Math.ceil(1.0 / MEP_CELL);
  if (c0 >= 0 && g.kind[c0] === MG_ROOM) return c0;
  const ix0 = Math.floor((p[0] - g.x0) / MEP_CELL), iy0 = Math.floor((p[1] - g.y0) / MEP_CELL);
  for (let iy = iy0 - R; iy <= iy0 + R; iy++) for (let ix = ix0 - R; ix <= ix0 + R; ix++){ if (ix < 0 || iy < 0 || ix >= g.nx || iy >= g.ny) continue; const i = iy * g.nx + ix; if (g.kind[i] !== MG_ROOM) continue;
    const c = g.ctr(i), d = Math.hypot(c[0] - p[0], c[1] - p[1]); if (d < bd){ bd = d; best = i; } }
  return best;
}
/* chemin depuis la source du calcul jusqu'au point p : polyligne [x, y] (coins seulement) + passages particuliers */
function mepPathTo(D, p){
  if (!D) return null; const g = D.g, t = mepSnap(g, p, D.mode); if (t < 0) return null;
  let bs = -1, bc = Infinity; for (let d = 0; d < 4; d++) if (D.cost[t * 4 + d] < bc){ bc = D.cost[t * 4 + d]; bs = t * 4 + d; }
  if (!isFinite(bc)) return null;
  const cells = []; for (let st = bs; st >= 0; st = D.prev[st]){ const i = st >> 2; if (cells.at(-1) !== i) cells.push(i); }
  cells.reverse(); const pts = cells.map(i => g.ctr(i)); let clo = 0, por = 0, door = 0, last = -1;
  for (const i of cells){ const k = g.kind[i]; if (k !== last){ if (k === MG_CLO) clo++; if (k === MG_POR) por++; if (k === MG_DOOR) door++; } last = k; }
  // extrémités exactes, raccordées à angle droit
  const a = D.from, b = p, A = pts[0], B = pts.at(-1), out = [a.slice()];
  if (Math.abs(a[0] - A[0]) > 1e-3 && Math.abs(a[1] - A[1]) > 1e-3) out.push(Math.abs(a[0] - A[0]) < Math.abs(a[1] - A[1]) ? [A[0], a[1]] : [a[0], A[1]]);
  out.push(...pts);
  if (Math.abs(b[0] - B[0]) > 1e-3 && Math.abs(b[1] - B[1]) > 1e-3) out.push(Math.abs(b[0] - B[0]) < Math.abs(b[1] - B[1]) ? [b[0], B[1]] : [B[0], b[1]]);
  out.push(b.slice());
  // ne garder que les coins
  const S = out.filter((q, i) => i === 0 || Math.hypot(q[0] - out[i - 1][0], q[1] - out[i - 1][1]) > 1e-4), K = [S[0]];
  for (let i = 1; i < S.length - 1; i++){ const u = V.sub(S[i], K.at(-1)), v = V.sub(S[i + 1], S[i]); if (Math.abs(u[0] * v[1] - u[1] * v[0]) > 1e-6) K.push(S[i]); }
  if (S.length > 1) K.push(S.at(-1));
  return {pts:K, clo, por, door, len:K.reduce((t, q, i) => i ? t + Math.hypot(q[0] - K[i - 1][0], q[1] - K[i - 1][1]) : 0, 0)};
}
/* mur extérieur le plus proche d'un point : pied de la perpendiculaire, normale vers l'extérieur, épaisseur */
function mepNearestFacade(lvl, p){
  const g = mepGrid(lvl); if (!g) return null; let best = null;
  for (const w of state.els.filter(w => w.kind === 'wall' && w.lvl === lvl && !wallArc(w))){
    const d = V.sub(w.b, w.a), L = V.len(d); if (L < 0.3) continue; const u = V.mul(d, 1 / L), n = [-u[1], u[0]], T = wallT(w);
    const t = clamp(V.dot(V.sub(p, w.a), u), Math.min(0.4, L / 2), Math.max(L - 0.4, L / 2)), foot = V.add(w.a, V.mul(u, t));
    const sP = g.inside(V.add(foot, V.mul(n, T / 2 + 0.2))), sM = g.inside(V.sub(foot, V.mul(n, T / 2 + 0.2))); if (sP === sM) continue;
    const nOut = sP ? V.mul(n, -1) : n, dd = Math.hypot(foot[0] - p[0], foot[1] - p[1]);
    if (!best || dd < best.d) best = {d:dd, foot, nOut, T, wall:w}; }
  return best;
}
