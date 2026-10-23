/* ============ Murs attachés sous la toiture (façon Revit « Attacher le haut ») ============
   wall.top = 'roof' : le haut du mur suit la sous-face de la toiture qui le couvre (pignons, murs de combles, cloisons sous rampant).
   La partie droite du mur (jusqu'au point le plus bas de la pente) garde ses ouvertures ; au-dessus, un « chapeau » épouse la pente. */
function roofUnderFn(el){
  const G = roofGeom(el), T = roofT(el) / Math.max(0.2, Math.cos(G.a)), pans = G.pans.map(p => ({p, xy:p.map(q => [q[0], q[1]])}));
  return (x, y) => { let best = null;
    for (const {p, xy} of pans){ if (!ptInPoly(x, y, xy)) continue;
      const A = p[0]; let n = null; for (let i = 1; i + 1 < p.length && !n; i++){ const u = [p[i][0] - A[0], p[i][1] - A[1], p[i][2] - A[2]], v = [p[i + 1][0] - A[0], p[i + 1][1] - A[1], p[i + 1][2] - A[2]], c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (Math.abs(c[2]) > 1e-9) n = c; }
      if (!n) continue; const z = A[2] - (n[0] * (x - A[0]) + n[1] * (y - A[1])) / n[2]; if (best == null || z > best) best = z; }
    return best == null ? null : best - T; };
}
/* toiture au-dessus d'un mur (la plus basse qui le couvre) */
function roofOver(w){
  const m = V.mul(V.add(w.a, w.b), 0.5), z0 = lvlZ(w.lvl) + (w.off || 0); let best = null;
  for (const r of state.els){ if (r.kind !== 'roof') continue; const G = roofGeom(r), o = G.outline;
    if (m[0] < o[0][0] - 1e-3 || m[0] > o[1][0] + 1e-3 || m[1] < o[0][1] - 1e-3 || m[1] > o[2][1] + 1e-3) continue;
    const b = roofBase(r); if (b < z0 + 0.3) continue; if (!best || b < roofBase(best)) best = r; }
  return best;
}
/* profil de la sous-face le long de l'axe du mur : [[t, z]…] (z absolu), points alignés retirés */
function wallRoofProfile(w){
  if (wallArc(w)) return null; const r = roofOver(w); if (!r) return null;
  const f = roofUnderFn(r), {u, L} = wallAxis(w), N = Math.max(2, Math.ceil(L / 0.05)), base = roofBase(r), raw = [];
  for (let i = 0; i <= N; i++){ const t = L * i / N, p = V.add(w.a, V.mul(u, t)), z = f(p[0], p[1]); raw.push([t, z == null ? base : Math.max(base, z)]); }
  const pts = [raw[0]]; for (let i = 1; i < raw.length - 1; i++){ const a = pts[pts.length - 1], b = raw[i], c = raw[i + 1]; if (Math.abs((b[1] - a[1]) * (c[0] - b[0]) - (c[1] - b[1]) * (b[0] - a[0])) > 1e-5) pts.push(b); } pts.push(raw[raw.length - 1]);
  return {pts, zmin:Math.min(...pts.map(q => q[1])), roof:r};
}
/* chapeau au-dessus de la partie droite : bandes verticales (toujours convexes) par couche */
function wallCapPieces(w, lot){
  if (w.top !== 'roof') return [];
  const P = wallRoofProfile(w); if (!P) return [];
  const zTop = lvlZ(w.lvl) + (w.off || 0) + w.h, {u, n} = wallAxis(w), T = wallT(w), out = []; let s = -T / 2;
  for (const [m, e] of wallLayers(w)){
    const at = (t, off) => V.add(V.add(w.a, V.mul(u, t)), V.mul(n, off));
    for (let i = 0; i + 1 < P.pts.length; i++){
      const [t0, z0] = P.pts[i], [t1, z1] = P.pts[i + 1]; if (Math.max(z0, z1) - zTop < 0.002 || t1 - t0 < 1e-4) continue;
      const a = at(t0, s), b = at(t1, s), top = [[a[0], a[1], zTop], [b[0], b[1], zTop], [b[0], b[1], Math.max(zTop, z1)], [a[0], a[1], Math.max(zTop, z0)]];
      const hm = (Math.max(0, z0 - zTop) + Math.max(0, z1 - zTop)) / 2;
      out.push({mat:m, e, poly:[a, b, at(t1, s + e), at(t0, s + e)], top, ext:[n[0] * e, n[1] * e, 0], base:zTop, h:hm, vol:(t1 - t0) * hm * e, lot, cap:true});
    }
    s += e;
  }
  return out;
}
/* toiture : attacher (ou détacher) les murs situés dessous */
function attachWallsToRoof(roof, on = true){
  const G = roofGeom(roof), o = G.outline, ws = state.els.filter(w => w.kind === 'wall' && w.lvl === roof.lvl && !wallArc(w) && (() => { const m = V.mul(V.add(w.a, w.b), 0.5); return m[0] >= o[0][0] && m[0] <= o[1][0] && m[1] >= o[0][1] && m[1] <= o[2][1]; })());
  if (!ws.length){ toast('Aucun mur sous cette toiture'); return 0; }
  pushHist();
  for (const w of ws){ if (on){ w.top = 'roof'; delete w.topOff; } else if (w.top === 'roof'){ delete w.top; } }
  if (on) roof.gable = false;   // les murs montent eux-mêmes en pignon
  state.isSample = false; rebuild(); toast(on ? `${ws.length} mur${ws.length > 1 ? 's' : ''} attaché${ws.length > 1 ? 's' : ''} sous la toiture` : 'Murs détachés de la toiture');
  return ws.length;
}
