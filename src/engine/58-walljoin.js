/* ============ Murs qui se raccrochent tout seuls ============
   - soudure : une extrémité posée près d'une autre extrémité (ou contre un mur) y est raccrochée exactement ;
   - mur superposé à un mur existant (même axe) : raccourci à la partie libre, ou refusé s'il est entièrement doublé ;
   - au rendu, un mur en T s'arrête au nu du mur traversant et un carrefour de 3 murs ne se chevauche plus
     (les faces qui se superposaient donnaient des textures qui « clignotent »). */
const WELD = {on:true, tol:0.2};
try { Object.assign(WELD, JSON.parse(localStorage.getItem('ap.weld') || '{}')); } catch(e){}
function weldWall(w){
  if (!WELD.on || w.kind !== 'wall' || w.bulge) return true;
  const others = state.els.filter(v => v.kind === 'wall' && v.lvl === w.lvl && v !== w && v.id !== w.id && !v.bulge);
  const R = p => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
  const vert = Math.abs(w.a[0] - w.b[0]) < 1e-6, horiz = Math.abs(w.a[1] - w.b[1]) < 1e-6;
  const free = p => !others.some(v => V.eq(v.a, p) || V.eq(v.b, p));
  // l'autre bout, s'il est libre, suit pour que le mur reste droit (horizontal / vertical)
  const keepStraight = (k, old) => { const o = k === 'a' ? 'b' : 'a', d = V.sub(w[k], old); if (!free(w[o])) return; if (vert) w[o] = R([w[o][0] + d[0], w[o][1]]); else if (horiz) w[o] = R([w[o][0], w[o][1] + d[1]]); };
  for (const k of ['a', 'b']){
    const P = w[k], T = wallT(w), tol = Math.max(WELD.tol, T * 0.75), old = P.slice();
    // 1) extrémité voisine
    let best = null, bd = tol;
    for (const v of others) for (const q of [v.a, v.b]){ const d = V.len(V.sub(q, P)); if (d > 1e-6 && d < bd){ bd = d; best = q; } }
    if (best){ w[k] = best.slice(); if (k === 'a') keepStraight(k, old); continue; }
    if (others.some(v => V.eq(v.a, P) || V.eq(v.b, P))) continue;
    // 2) contre un mur (T) : l'extrémité est ramenée sur l'axe du mur traversant, dans le prolongement du mur dessiné
    const o = w[k === 'a' ? 'b' : 'a'], dir = V.sub(P, o), L = V.len(dir); if (L < 1e-6) continue; const du = V.mul(dir, 1 / L);
    let hit = null, hd = Infinity;
    for (const v of others){
      const ax = wallAxis(v); if (Math.abs(V.cross(du, ax.u)) < 0.34) continue;   // presque parallèles : pas de T
      const rel = V.sub(P, v.a), t = V.dot(rel, ax.u), s = Math.abs(V.dot(rel, ax.n));
      if (t < 0.02 || t > ax.L - 0.02 || s > wallT(v) / 2 + tol * 0.6) continue;
      const X = lineInter(o, du, v.a, ax.u); if (!X) continue; const dx = V.len(V.sub(X, P)); if (dx < hd && dx < wallT(v) / 2 + tol){ hd = dx; hit = X; }
    }
    if (hit && hd > 1e-4){ w[k] = R(hit); if (k === 'a') keepStraight(k, old); }
  }
  // 3) mur doublé (même axe, longueurs qui se recouvrent)
  const ax = wallAxis(w);
  for (const v of others){
    const av = wallAxis(v); if (Math.abs(V.cross(ax.u, av.u)) > 0.02 || Math.abs(V.dot(V.sub(w.a, v.a), av.n)) > 0.03) continue;
    const ta = V.dot(V.sub(w.a, v.a), av.u), tb = V.dot(V.sub(w.b, v.a), av.u), lo = Math.min(ta, tb), hi = Math.max(ta, tb);
    const ov = Math.min(hi, av.L) - Math.max(lo, 0); if (ov < 0.05) continue;
    if (lo >= -0.05 && hi <= av.L + 0.05){ toast('Ce mur existe déjà à cet endroit'); return false; }
    // on ne garde que la partie qui dépasse
    const clampT = t => t < 0 ? t : t > av.L ? t : (Math.abs(t) < Math.abs(t - av.L) ? 0 : av.L);
    const na = V.add(v.a, V.mul(av.u, lo < 0 ? lo : av.L)), nb = V.add(v.a, V.mul(av.u, lo < 0 ? 0 : hi));
    if (lo < 0 && hi > av.L){ toast('Ce mur recouvre un mur existant : seule la partie qui dépasse d\'un côté est gardée'); }
    const keepA = ta < tb; void clampT;
    const p1 = R(lo < 0 ? V.add(v.a, V.mul(av.u, lo)) : v.b.slice()), p2 = R(lo < 0 ? v.a.slice() : V.add(v.a, V.mul(av.u, hi)));
    if (keepA){ w.a = p1; w.b = p2; } else { w.a = p2; w.b = p1; } void na; void nb;
    if (V.len(V.sub(w.a, w.b)) < 0.05){ toast('Ce mur existe déjà à cet endroit'); return false; }
  }
  return true;
}
/* nu (face) d'un mur traversant, du côté d'un point, pour arrêter proprement un mur en T */
function teeTrim(w, atStart, s, base, els){
  const P = atStart ? w.a : w.b, O = atStart ? w.b : w.a, {u} = wallAxis(w);
  for (const v of els){
    if (v === w || v.kind !== 'wall' || v.lvl !== w.lvl || v.id === w.id || v.bulge) continue;
    if (V.eq(v.a, P) || V.eq(v.b, P)) continue;
    const ax = wallAxis(v); if (ax.L < 1e-6 || Math.abs(V.cross(u, ax.u)) < 0.2) continue;
    const rel = V.sub(P, v.a), t = V.dot(rel, ax.u), sd = V.dot(rel, ax.n), Tv = wallT(v);
    if (t < -1e-3 || t > ax.L + 1e-3 || Math.abs(sd) > Tv / 2 + 1e-3) continue;
    const side = Math.sign(V.dot(V.sub(O, v.a), ax.n)) || 1;
    const X = lineInter(base, u, V.add(v.a, V.mul(ax.n, side * Tv / 2)), ax.u);
    if (X && V.len(V.sub(X, base)) < Tv + 0.2) return X;
  }
  return null;
}

/* ---------- arêtes propres d'un mur : contours et ouvertures seulement (plus de traits de découpe sur les faces) ---------- */
function wallEdgeGeo(el){
  const T = wallT(el), base = lvlZ(el.lvl) + (el.off || 0), top = base + el.h, segs = [], L3 = (p, z) => [p[0], z, -p[1]];
  const seg = (p, zp, q, zq) => segs.push(...L3(p, zp), ...L3(q, zq));
  const layers = wallLayers(el), ifs = [-T / 2]; let s = -T / 2; for (const [, e] of layers){ s += e; ifs.push(s); }
  if (wallArc(el)){
    for (const off of [-T / 2, T / 2]){ const P = arcPts(el, off); for (let i = 0; i + 1 < P.length; i++){ seg(P[i], top, P[i + 1], top); seg(P[i], base, P[i + 1], base); } }
    for (const off of ifs.slice(1, -1)){ const P = arcPts(el, off); for (let i = 0; i + 1 < P.length; i++) seg(P[i], top, P[i + 1], top); }
    for (const P of [arcPts(el, -T / 2), arcPts(el, T / 2)]) for (const q of [P[0], P[P.length - 1]]) seg(q, base, q, top);
    const A = arcPts(el, -T / 2), B = arcPts(el, T / 2); seg(A[0], top, B[0], top); seg(A.at(-1), top, B.at(-1), top); seg(A[0], base, B[0], base); seg(A.at(-1), base, B.at(-1), base);
    return segs;
  }
  const {u, n} = wallAxis(el), at = (t, off) => V.add(V.add(el.a, V.mul(u, t)), V.mul(n, off));
  const prof = el.top === 'roof' ? wallRoofProfile(el) : null;
  for (const off of ifs){
    const A = endPt(el, true, off, state.els), B = endPt(el, false, off, state.els), outer = off === ifs[0] || off === ifs[ifs.length - 1];
    if (prof && outer){ const P = prof.pts.map(([t, z]) => [at(t, off), Math.max(top, z)]); P[0][0] = A; P[P.length - 1][0] = B; for (let i = 0; i + 1 < P.length; i++) seg(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]); }
    else seg(A, top, B, top);
    if (outer) seg(A, base, B, base);
  }
  const A0 = endPt(el, true, ifs[0], state.els), A1 = endPt(el, true, ifs.at(-1), state.els), B0 = endPt(el, false, ifs[0], state.els), B1 = endPt(el, false, ifs.at(-1), state.els);
  const zEnd = (atStart) => prof ? Math.max(top, prof.pts[atStart ? 0 : prof.pts.length - 1][1]) : top;
  for (const [p, st] of [[A0, true], [A1, true], [B0, false], [B1, false]]) seg(p, base, p, zEnd(st));
  seg(A0, base, A1, base); seg(B0, base, B1, base); seg(A0, zEnd(true), A1, zEnd(true)); seg(B0, zEnd(false), B1, zEnd(false));
  for (const o of wallOpenings(el)){
    const z0 = base + o.z0, z1 = base + o.z1;
    for (const off of [ifs[0], ifs.at(-1)]){ const p0 = at(o.t0, off), p1 = at(o.t1, off); seg(p0, z0, p1, z0); seg(p0, z1, p1, z1); seg(p0, z0, p0, z1); seg(p1, z0, p1, z1); }
    for (const t of [o.t0, o.t1]) for (const z of [z0, z1]) seg(at(t, ifs[0]), z, at(t, ifs.at(-1)), z);
  }
  return segs;
}
function wallEdgeLines(el){
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wallEdgeGeo(el), 3));
  const l = new THREE.LineSegments(g, edgeMat); l.userData.isEdge = true; return l;
}
const cleanWallEdges = () => !planOn() && (DISPLAY.edges || DISPLAY.style === 'sketch' || DISPLAY.style === 'wire' || view === 'sec');
