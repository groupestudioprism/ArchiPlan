/* ============ Géométrie : murs (onglets, ouvertures), dalles, volumes, poteaux, familles ============ */
const wallT = w => compo(w.type).layers.reduce((s, l) => s + l[1], 0);
const slabT = s => compo(s.type).layers.reduce((a, l) => a + l[1], 0);
function lineInter(p, d, q, e){ const c = V.cross(d, e); if (Math.abs(c) < 1e-3) return null; const t = V.cross(V.sub(q, p), e) / c; return V.add(p, V.mul(d, t)); }
function wallAxis(w){ const d = V.sub(w.b, w.a), L = V.len(d) || 1e-9; const u = V.mul(d, 1 / L), A = wallArc(w); return {u, n:[-u[1], u[0]], L:A ? A.len : L, chord:L}; }
/* Mur courbe : w.bulge = flèche (m) au milieu de la corde, du côté gauche (> 0) ou droit (< 0) du sens a → b */
function wallArc(w){
  const s = +w.bulge || 0; if (Math.abs(s) < 1e-3) return null;
  const d = V.sub(w.b, w.a), c = V.len(d); if (c < 1e-6) return null;
  const u = V.mul(d, 1 / c), n = [-u[1], u[0]], R = (c * c / 4 + s * s) / (2 * Math.abs(s)), mid = V.mul(V.add(w.a, w.b), 0.5), C = V.add(mid, V.mul(n, s - Math.sign(s) * R)), pm = V.add(mid, V.mul(n, s));
  const ta = Math.atan2(w.a[1] - C[1], w.a[0] - C[0]), tb = Math.atan2(w.b[1] - C[1], w.b[0] - C[0]);
  let best = null; for (const k of [-1, 0, 1]){ const D = tb - ta + k * 2 * Math.PI; if (Math.abs(D) < 1e-6 || Math.abs(D) > 2 * Math.PI) continue; const tm = ta + D / 2, q = [C[0] + R * Math.cos(tm), C[1] + R * Math.sin(tm)], e = Math.hypot(q[0] - pm[0], q[1] - pm[1]); if (!best || e < best.e) best = {D, e}; }
  return {C, R, ta, D:best.D, len:R * Math.abs(best.D)};
}
function arcPts(w, off, A = wallArc(w)){ const N = Math.max(8, Math.ceil(Math.abs(A.D) / (Math.PI / 32))), r = A.R - Math.sign(A.D) * off, out = []; for (let i = 0; i <= N; i++){ const t = A.ta + A.D * i / N; out.push([A.C[0] + r * Math.cos(t), A.C[1] + r * Math.sin(t)]); } return out; }
// point de jonction d'une ligne de couche (décalage s) à une extrémité, avec onglet sur le mur adjacent
function endPt(w, atStart, s, els){
  const P = atStart ? w.a : w.b, {u, n} = wallAxis(w), base = V.add(P, V.mul(n, s));
  for (const v of els){
    if (v === w || v.kind !== 'wall' || v.lvl !== w.lvl || v.id === w.id || v.bulge || w.bulge) continue;
    let sign = 0;
    if (atStart){ if (V.eq(v.b, P)) sign = 1; else if (V.eq(v.a, P)) sign = -1; }
    else { if (V.eq(v.a, P)) sign = 1; else if (V.eq(v.b, P)) sign = -1; }
    if (!sign) continue;
    const ax = wallAxis(v); if (ax.L < 1e-6) continue;
    const X = lineInter(base, u, V.add(v.a, V.mul(ax.n, s * sign)), ax.u);
    if (!X) return base;
    if (V.len(V.sub(X, base)) > 4 * Math.max(wallT(w), 0.05) + 0.5) return base;
    return X;
  }
  return base;
}
function wallLayers(w){ const L = compo(w.type).layers.slice(); return w.flip ? L.reverse() : L; }
function wallPoly(w, els, s1, s2){ if (wallArc(w)) return [...arcPts(w, s1), ...arcPts(w, s2).reverse()]; return [endPt(w, true, s1, els), endPt(w, false, s1, els), endPt(w, false, s2, els), endPt(w, true, s2, els)]; }
const rect = (p, q) => { const x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]), y0 = Math.min(p[1], q[1]), y1 = Math.max(p[1], q[1]); return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]; };
const area = poly => { let a = 0; for (let i = 0; i < poly.length; i++){ const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0]*q[1] - q[0]*p[1]; } return Math.abs(a) / 2; };
function colPoly(c){ const hw = c.w/2, hd = c.d/2; return [[c.c[0]-hw,c.c[1]-hd],[c.c[0]+hw,c.c[1]-hd],[c.c[0]+hw,c.c[1]+hd],[c.c[0]-hw,c.c[1]+hd]]; }

/* ---------- familles ---------- */
const famLot = F => ({Portes:'Menuiseries', 'Fenêtres':'Menuiseries', Ouvertures:'Menuiseries', Structure:'Gros œuvre', 'Escaliers et garde-corps':'Gros œuvre', Industrie:'Industrie'})[F?.cat] || 'Mobilier et équipements';
function famScope(F, el){
  const s = {};
  for (const [k, p] of Object.entries(F.params || {})) s[k] = +p.v;
  const ty = (F.types || [])[el?.type | 0]; if (ty) for (const [k, v] of Object.entries(ty.p || {})) s[k] = typeof v === 'number' ? v : fx(v, s);
  for (const [k, v] of Object.entries(el?.params || {})) if (Number.isFinite(+v)) s[k] = +v;
  return s;
}
function famCut(el){
  const F = fam(el.fam); if (!F || F.host !== 'wall') return null;
  const s = famScope(F, el);
  return {w:Math.max(0.01, fx(F.cut?.w ?? 'w', s)), h:Math.max(0.01, fx(F.cut?.h ?? 'h', s)), sill:Math.max(0, s.sill ?? 0)};
}
/* Solides d'une famille dans son repère local : boîtes {s:'box', c:[x,y,z] centre, w,d,h, rz}, cylindres, sphères */
function famSolids(F, scope, depth = 0){
  const out = []; if (!F || depth > 4) return out;
  for (const part of F.parts || []){
    const n = part.n != null ? Math.max(0, Math.min(500, Math.round(fx(part.n, scope)))) : 1;
    for (let i = 0; i < n; i++){
      const s = {...scope, i};
      if (part.if != null && !fx(part.if, s)) continue;
      const x = fx(part.x ?? 0, s), y = fx(part.y ?? 0, s), z = fx(part.z ?? 0, s);
      if (part.fam){
        const G = fam(part.fam); if (!G) continue;
        const cs = famScope(G, {type:part.type | 0, params:{}});
        for (const [k, v] of Object.entries(part.p || {})) cs[k] = fx(v, s);
        const rot = fx(part.rot ?? 0, s) * Math.PI / 180;
        for (const so of famSolids(G, cs, depth + 1)){
          const [cx, cy] = V.rot([so.c[0], so.c[1]], rot);
          out.push({...so, c:[cx + x, cy + y, so.c[2] + z], rz:(so.rz || 0) + rot});
        }
        continue;
      }
      const m = part.m || 'bois';
      if (part.s === 'cyl'){ const r = Math.max(0.001, fx(part.r, s)), h = Math.max(0.001, fx(part.h, s)); out.push(part.ax ? {s:'cyl', m, c:[x, y, z], r, h, rz:0, ax:part.ax} : {s:'cyl', m, c:[x, y, z + h/2], r, h, rz:0}); }
      else if (part.s === 'cone'){ const r = Math.max(0.001, fx(part.r, s)), r2 = Math.max(0, fx(part.r2 ?? 0, s)), h = Math.max(0.001, fx(part.h, s)); out.push({s:'cone', m, c:[x, y, z + h/2], r, r2, h, rz:0}); }
      else if (part.s === 'ext'){ const W = s.w ?? 1, Dd = s.d ?? 1, h = fx(part.h ?? 1, s), P = (part.pts || []).map(([u, v]) => [x + (u - 0.5) * W, y + (v - 0.5) * Dd]); if (P.length >= 3 && h > 1e-4){ const cx = P.reduce((a, p) => a + p[0], 0) / P.length, cy = P.reduce((a, p) => a + p[1], 0) / P.length; out.push({s:'ext', m, c:[cx, cy, z + h / 2], pts:P.map(p => [p[0] - cx, p[1] - cy]), h, rz:0}); } }
      else if (part.s === 'sph'){ const r = Math.max(0.001, fx(part.r, s)); out.push({s:'sph', m, c:[x, y, z + r], r, rz:0}); }
      else { const w = fx(part.w, s), d = fx(part.d, s), h = fx(part.h, s); if (w > 1e-4 && d > 1e-4 && h > 1e-4) out.push({s:'box', m, c:[x + w/2, y + d/2, z + h/2], w, d, h, rz:0}); }
    }
  }
  return out;
}
/* Repère d'une famille posée : origine en plan, cote de base, angle de l'axe x local, symétries */
function instFrame(el){
  if (el.host){
    const w = getEl(el.host); if (!w || w.kind !== 'wall') return null;
    const {u, L} = wallAxis(w), cut = famCut(el) || {sill:0};
    const t = clamp(el.t ?? L/2, 0, L);
    return {o:V.add(w.a, V.mul(u, t)), z:lvlZ(w.lvl) + (w.off || 0) + cut.sill, ang:Math.atan2(u[1], u[0]), sx:el.mirror ? -1 : 1, sy:el.flip ? -1 : 1, wall:w};
  }
  return {o:el.c || [0, 0], z:lvlZ(el.lvl) + (el.off || 0), ang:(el.rot || 0) * Math.PI / 180, sx:el.mirror ? -1 : 1, sy:1};
}
function instSolids(el){
  const F = fam(el.fam), fr = instFrame(el); if (!F || !fr) return [];
  const mir = fr.sx * fr.sy;
  return famSolids(F, famScope(F, el)).map(so => {
    const lp = [so.c[0] * fr.sx, so.c[1] * fr.sy], wp = V.add(fr.o, V.rot(lp, fr.ang));
    return {...so, ...(so.pts ? {pts:so.pts.map(p => [p[0] * fr.sx, p[1] * fr.sy])} : {}), c:[wp[0], wp[1], so.c[2] + fr.z], rz:fr.ang + mir * (so.rz || 0), lot:famLot(F)};
  });
}
const solidVol = so => so.s === 'ext' ? area(so.pts) * so.h : so.s === 'box' ? so.w * so.d * so.h : so.s === 'cyl' ? Math.PI * so.r * so.r * so.h : so.s === 'cone' ? Math.PI * so.h * (so.r * so.r + so.r * so.r2 + so.r2 * so.r2) / 3 : 4/3 * Math.PI * so.r ** 3;

/* Ouvertures portées par un mur : intervalles le long de l'axe et en hauteur */
function wallOpenings(w, els = state.els){
  const {L} = wallAxis(w), out = [];
  for (const e of els){
    if (e.kind !== 'inst' || e.host !== w.id) continue;
    const c = famCut(e); if (!c) continue;
    const t = clamp(e.t ?? L/2, 0, L), t0 = Math.max(0.0005, t - c.w/2), t1 = Math.min(L - 0.0005, t + c.w/2);
    if (t1 - t0 < 0.005) continue;
    out.push({t0, t1, z0:c.sill, z1:Math.min(w.h, c.sill + c.h), id:e.id});
  }
  return out.sort((a, b) => a.t0 - b.t0);
}

// Décompose un élément en "pièces" homogènes : un matériau, un contour plan, une base et une hauteur
function pieces(el, els = state.els){
  if (el.kind === 'roof') return roofPieces(el);
  if (el.kind === 'stair') return stairPieces(el);
  const z = lvlZ(el.lvl) + (el.off || 0), out = [];
  if (el.kind === 'wall'){
    const T = wallT(el), {u, n, L} = wallAxis(el), ops = wallOpenings(el, els), lot = compo(el.type).lot;
    let s = -T/2;
    if (wallArc(el)){ for (const [m, e] of wallLayers(el)){ out.push({mat:m, e, poly:[...arcPts(el, s), ...arcPts(el, s + e).reverse()], base:z, h:el.h, lot}); s += e; } return out; }
    for (const [m, e] of wallLayers(el)){
      const s1 = s, s2 = s + e;
      const P0 = endPt(el, true, s1, els), P1 = endPt(el, false, s1, els), P2 = endPt(el, false, s2, els), P3 = endPt(el, true, s2, els);
      const at = (t, off) => V.add(V.add(el.a, V.mul(u, t)), V.mul(n, off));
      const side = t => t <= 0 ? [P0, P3] : t >= L ? [P1, P2] : [at(t, s1), at(t, s2)];
      const bounds = [0]; ops.forEach(o => bounds.push(o.t0, o.t1)); bounds.push(L);
      for (let k = 0; k < bounds.length - 1; k++){
        const ta = bounds[k], tb = bounds[k + 1]; if (tb - ta < 1e-5) continue;
        const [la1, la2] = side(ta), [lb1, lb2] = side(tb), poly = [la1, lb1, lb2, la2];
        const op = k % 2 === 1 ? ops[(k - 1) / 2] : null;
        if (!op) out.push({mat:m, e, poly, base:z, h:el.h, lot});
        else {
          if (op.z0 > 0.001) out.push({mat:m, e, poly, base:z, h:op.z0, lot});
          if (el.h - op.z1 > 0.001) out.push({mat:m, e, poly, base:z + op.z1, h:el.h - op.z1, lot});
        }
      }
      s += e;
    }
    if (el.top === 'roof') out.push(...wallCapPieces(el, lot));
    // tableaux, linteau et appui des baies : habillés avec le parement extérieur du mur (on ne voit plus les couches dans l'ouverture)
    if (ops.length){
      const outer = (wallLayers(el).find(([m]) => mat(m).R == null) || wallLayers(el)[0])[0], ep = 0.012;
      const at = (t, off) => V.add(V.add(el.a, V.mul(u, t)), V.mul(n, off)), box = (t0, t1) => [at(t0, -T/2), at(t1, -T/2), at(t1, T/2), at(t0, T/2)];
      for (const op of ops){
        const zh = op.z1 - op.z0; if (zh < 0.02 || op.t1 - op.t0 < 0.03) continue;
        out.push({mat:outer, poly:box(op.t0, op.t0 + ep), base:z + op.z0, h:zh, lot, reveal:true}, {mat:outer, poly:box(op.t1 - ep, op.t1), base:z + op.z0, h:zh, lot, reveal:true});
        if (el.h - op.z1 > 0.001) out.push({mat:outer, poly:box(op.t0 + ep, op.t1 - ep), base:z + op.z1 - ep, h:ep, lot, reveal:true});
        if (op.z0 > 0.001) out.push({mat:outer, poly:box(op.t0 + ep, op.t1 - ep), base:z + op.z0, h:ep, lot, reveal:true});
      }
    }
  } else if (el.kind === 'slab'){
    // la dalle est posée AU-DESSUS de son niveau : off = dessous de la dalle ; couches listées du dessus vers le dessous
    const poly = volPoly(el), C = compo(el.type), holes = slabHoles(el).concat(el.holes || []), net = area(poly) - holes.reduce((s, h) => s + area(h), 0); let top = z + slabT(el);
    for (const [m, e] of C.layers){ out.push({mat:m, e, poly, base:top - e, h:e, lot:C.lot, ...(holes.length ? {holes, vol:net * e} : {})}); top -= e; }
  } else if (el.kind === 'vol'){
    out.push({mat:el.mat, poly:volPoly(el), base:z, h:el.h, lot:'Industrie'});
  } else if (el.kind === 'col'){
    out.push({mat:el.mat, poly:colPoly(el), base:z, h:el.h, lot:'Gros œuvre'});
  }
  return out;
}
/* Volume et masse d'un élément (géométrie réelle, ouvertures déduites) */
function elStats(el){
  let v = 0, m = 0;
  if (el.kind === 'inst'){ for (const so of instSolids(el)){ const vv = solidVol(so); v += vv; m += vv * (mat(so.m).R != null ? 0 : mat(so.m).rho); } return {v, m}; }
  for (const pc of pieces(el)){ if (pc.reveal) continue; const vol = pc.vol ?? area(pc.poly) * pc.h; v += vol; m += vol * (mat(pc.mat).R != null ? 0 : mat(pc.mat).rho); }
  return {v, m};
}
/* Points caractéristiques d'un élément (accroches, cotes) */
function elKeyPoints(el){
  if (el.kind === 'wall' && wallArc(el)){ const P = arcPts(el, 0); return {ends:[el.a, el.b], segs:P.slice(1).map((p, i) => [P[i], p]), mids:[P[Math.floor(P.length / 2)]], faces:[]}; }
  if (el.kind === 'wall') return {ends:[el.a, el.b], segs:[[el.a, el.b]], mids:[V.mul(V.add(el.a, el.b), .5)], faces:(() => { const T = wallT(el); return [wallPoly(el, state.els, -T/2, -T/2).slice(0, 2), wallPoly(el, state.els, T/2, T/2).slice(0, 2)]; })()};
  if ((el.kind === 'vol' || el.kind === 'slab') && el.poly){ const r = el.poly, segs = r.map((p, i) => [p, r[(i + 1) % r.length]]), circ = el.shape === 'circ'; return {ends:circ ? [] : r, segs, mids:circ ? [] : segs.map(([a, b]) => V.mul(V.add(a, b), .5)), centers:[polyCentroid(r)]}; }
  if (el.kind === 'slab' || el.kind === 'vol'){ const r = rect(el.p, el.q); const segs = r.map((p, i) => [p, r[(i + 1) % 4]]); return {ends:r, segs, mids:segs.map(([a, b]) => V.mul(V.add(a, b), .5)), centers:[V.mul(V.add(r[0], r[2]), .5)]}; }
  if (el.kind === 'stair'){ const F = stairFootprint(el); if (!F) return {ends:[], segs:[], mids:[]}; const r = [[F.x0, F.y0], [F.x1, F.y0], [F.x1, F.y1], [F.x0, F.y1]]; return {ends:[el.c, ...r], segs:r.map((p, i) => [p, r[(i + 1) % 4]]), mids:[[(F.x0 + F.x1) / 2, (F.y0 + F.y1) / 2]]}; }
  if (el.kind === 'roof'){ const G = roofGeom(el), r = G.wall, o = G.outline, segs = [...r.map((p, i) => [p, r[(i + 1) % r.length]]), ...o.map((p, i) => [p, o[(i + 1) % o.length]])];
    return {ends:[...r, ...o, ...G.ridges.flatMap(([a, b]) => [[a[0], a[1]], [b[0], b[1]]])], segs, mids:segs.map(([a, b]) => V.mul(V.add(a, b), .5)), centers:[V.mul(V.add(r[0], r[2]), .5)]}; }
  if (el.kind === 'col'){ const r = colPoly(el); return {ends:r, segs:r.map((p, i) => [p, r[(i + 1) % 4]]), centers:[el.c], mids:[]}; }
  if (el.kind === 'inst'){ const fr = instFrame(el); if (!fr) return {ends:[]}; const pts = [fr.o];
    if (el.host){ const c = famCut(el); if (c){ const d = [Math.cos(fr.ang), Math.sin(fr.ang)]; pts.push(V.add(fr.o, V.mul(d, -c.w/2)), V.add(fr.o, V.mul(d, c.w/2))); } }
    return {ends:pts, centers:[fr.o], segs:[], mids:[]}; }
  return {ends:[]};
}
