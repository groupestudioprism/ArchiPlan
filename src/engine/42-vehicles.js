/* ============ Véhicules et engins de chantier (sans marque) ============
   Carrosseries extrudées et arrondies (pas de cubes), roues, vitrages, feux. Dimensions réelles moyennes.
   Repère : +x vers l'avant, origine au sol au milieu du véhicule. */
const BODY_COLORS = [0xE9ECEF, 0xF5F5F3, 0x1E1F22, 0x8D949B, 0x4E555D, 0xB3B8BD, 0x1F3F73, 0x8E1B1B, 0x2F5E3B, 0xC9C2B4, 0x5A3E2B, 0x2C6EAF, 0xD7D0C2];
function profileExtrude(pts, width, bevel = 0.07){
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(s, {depth:Math.max(0.02, width - 2 * bevel), bevelEnabled:bevel > 0, bevelSize:bevel, bevelThickness:bevel, bevelSegments:3, curveSegments:6});
  g.translate(0, 0, -(width - 2 * bevel) / 2); return g;
}
function wheel(r, w){ const g = new THREE.Group(); g.add(part(CYL(r, r, w, 20), C.rubber, 0, 0, 0, Math.PI / 2)); g.add(part(CYL(r * 0.58, r * 0.58, w + 0.012, 14), C.rim, 0, 0, 0, Math.PI / 2)); return g; }
function wheels(g, xs, r, w, track){ for (const x of xs) for (const s of [-1, 1]){ const wh = wheel(r, w); wh.position.set(x, r, s * track / 2); wh.userData.wheel = r; g.add(wh); } }
function lights(g, xF, xR, y, half, h = 0.12){ for (const s of [-1, 1]){ g.add(part(RBOX(0.05, h, 0.26, 0.02), C.lightW, xF, y, s * (half - 0.22))); g.add(part(RBOX(0.05, h, 0.24, 0.02), C.lightR, xR, y, s * (half - 0.2))); } }
const bodyMat = c => { const m = matCol(c, {rough:0.32, metal:0.55}); m.userData.body = true; return m; };
/* voitures : soubassement profilé + habitacle vitré + pavillon */
const CARS = {
  citadine:{L:3.95, W:1.74, belt:0.98, roof:1.5, cab:[0.32, 0.75, 2.25, 3.0], wb:[0.68, 3.22], wr:0.31, nose:0.62, tail:0.9},
  berline:{L:4.75, W:1.82, belt:0.98, roof:1.45, cab:[0.85, 1.35, 2.85, 3.55], wb:[0.95, 3.75], wr:0.33, nose:0.66, tail:0.88},
  suv:{L:4.55, W:1.86, belt:1.12, roof:1.7, cab:[0.35, 0.6, 2.75, 3.35], wb:[0.85, 3.55], wr:0.37, nose:0.82, tail:1.0},
  break:{L:4.7, W:1.8, belt:0.98, roof:1.48, cab:[0.25, 0.42, 2.8, 3.5], wb:[0.92, 3.68], wr:0.33, nose:0.66, tail:0.95},
};
function makeCar(type = 'berline', color = 0xB3B8BD){
  const S = CARS[type] || CARS.berline, g = new THREE.Group(), L = S.L, W = S.W, x0 = -L / 2, bm = bodyMat(color);
  const lower = [[0, 0.3], [0, S.tail], [0.12, S.belt], [L - 0.95, S.belt], [L - 0.2, S.nose + 0.1], [L, S.nose - 0.08], [L, 0.3], [L - 0.35, 0.22], [0.3, 0.22]];
  g.add(part(profileExtrude(lower, W, 0.09), bm, x0));
  const [r0, r1, f1, f0] = S.cab, cabW = W - 0.12;
  g.add(part(profileExtrude([[r0, S.belt - 0.02], [r1, S.roof - 0.05], [f1, S.roof - 0.05], [f0, S.belt - 0.02]], cabW, 0.05), C.glass, x0));
  g.add(part(profileExtrude([[r1 - 0.06, S.roof - 0.09], [r1, S.roof], [f1, S.roof], [f1 + 0.08, S.roof - 0.09]], cabW + 0.02, 0.04), bm, x0));
  // montants (pied milieu) et rétroviseurs
  const bx = (r1 + f1) / 2 - 0.15; g.add(part(BOX(0.1, S.roof - S.belt, cabW + 0.025), bm, x0 + bx, (S.roof + S.belt) / 2 - 0.03, 0));
  for (const s of [-1, 1]) g.add(part(RBOX(0.14, 0.1, 0.16, 0.03), bm, x0 + f0 - 0.1, S.belt + 0.08, s * (W / 2 + 0.06)));
  wheels(g, S.wb.map(x => x0 + x), S.wr, 0.22, W - 0.26); lights(g, L / 2 - 0.02, -L / 2 + 0.02, S.nose - 0.05, W / 2);
  g.add(part(RBOX(0.12, 0.16, W - 0.1, 0.04), C.dark, L / 2 - 0.02, 0.33, 0), part(RBOX(0.12, 0.16, W - 0.1, 0.04), C.dark, -L / 2 + 0.02, 0.33, 0));
  g.userData = {L, W, kind:'vl'}; return g;
}
function makeVan(color = 0xF4F5F3){ // fourgon utilitaire
  const g = new THREE.Group(), L = 5.4, W = 2.0, x0 = -L / 2, bm = bodyMat(color);
  g.add(part(profileExtrude([[0, 0.3], [0, 2.45], [0.12, 2.55], [L - 1.25, 2.55], [L - 0.35, 1.25], [L - 0.05, 0.95], [L, 0.55], [L, 0.3]], W, 0.1), bm, x0));
  g.add(part(profileExtrude([[L - 1.35, 1.3], [L - 1.25, 2.38], [L - 1.02, 2.38], [L - 0.36, 1.3]], W + 0.02, 0.06), C.glass, x0));
  wheels(g, [x0 + 1.0, x0 + 4.4], 0.36, 0.24, W - 0.25); lights(g, L / 2, -L / 2, 0.85, W / 2, 0.2); g.userData = {L, W, kind:'vul'}; return g;
}
function cab(g, x, W, color, h = 2.85){ // cabine de poids lourd (avant à x)
  const bm = bodyMat(color); g.add(part(profileExtrude([[0, 0.55], [0, h], [1.9, h], [2.15, h - 0.25], [2.25, 1.55], [2.3, 0.55]], W, 0.12), bm, x - 2.3));
  g.add(part(profileExtrude([[2.12, 1.6], [2.2, h - 0.32], [2.24, h - 0.32], [2.29, 1.6]], W - 0.18, 0.04), C.glass, x - 2.3 + 0.01));
  for (const s of [-1, 1]) g.add(part(profileExtrude([[1.2, 1.7], [1.25, h - 0.4], [1.95, h - 0.4], [2.1, 1.7]], 0.04, 0), C.glass, x - 2.3, 0, s * (W / 2 + 0.005)));
  g.add(part(BOX(0.1, 0.35, W - 0.1), C.dark, x - 0.02, 0.6, 0)); for (const s of [-1, 1]) g.add(part(RBOX(0.05, 0.16, 0.3, 0.02), C.lightW, x, 0.85, s * (W / 2 - 0.3)));
}
function makeTruck(color = 0xE9ECEF, boxColor = 0xF4F4F2){ // porteur à caisse 19 t
  const g = new THREE.Group(), L = 9.8, W = 2.5, x0 = -L / 2; cab(g, L / 2, W, color);
  g.add(part(RBOX(7.2, 2.7, W, 0.05), matCol(boxColor, {rough:0.6}), x0 + 3.6, 2.4, 0)); g.add(part(BOX(7.3, 0.25, 1.0), C.dark, x0 + 3.6, 0.85, 0));
  wheels(g, [x0 + 2.0, x0 + 3.3, L / 2 - 1.5], 0.5, 0.32, W - 0.35); g.userData = {L, W, kind:'pl'}; return g;
}
function makeSemi(color = 0x1F3F73){ const g = new THREE.Group(), L = 16.5, W = 2.55, x0 = -L / 2; cab(g, L / 2, W, color, 3.1);
  g.add(part(RBOX(13.6, 2.85, W, 0.05), matCol(0xE6E8EA, {rough:0.6}), x0 + 6.8, 2.6, 0)); g.add(part(BOX(13.4, 0.2, 1.0), C.dark, x0 + 6.8, 1.05, 0)); g.add(part(BOX(3, 0.3, 1.0), C.dark, L / 2 - 2.4, 0.9, 0));
  wheels(g, [x0 + 1.3, x0 + 2.65, x0 + 4.0, L / 2 - 3.5, L / 2 - 1.6], 0.5, 0.32, W - 0.35); g.userData = {L, W, kind:'pl'}; return g; }
function makeBus(color = 0xF2F4F6, stripe = 0x0E8FB0){ const g = new THREE.Group(), L = 12, W = 2.55, x0 = -L / 2, bm = bodyMat(color);
  g.add(part(profileExtrude([[0, 0.35], [0, 3.0], [0.1, 3.1], [L - 0.25, 3.1], [L, 2.85], [L, 0.35]], W, 0.12), bm, x0));
  g.add(part(profileExtrude([[0.4, 1.15], [0.4, 2.75], [L - 0.05, 2.75], [L - 0.02, 1.0]], W + 0.02, 0.05), C.glass, x0));
  g.add(part(BOX(L - 0.2, 0.25, W + 0.03), matCol(stripe, {rough:0.5}), 0, 0.85, 0));
  wheels(g, [x0 + 2.7, L / 2 - 2.6], 0.5, 0.3, W - 0.3); lights(g, L / 2, -L / 2, 0.75, W / 2, 0.2); g.userData = {L, W, kind:'bus'}; return g; }
function makeMoto(color = 0x1E1F22){ const g = new THREE.Group(); [-0.72, 0.72].forEach(x => { const w = wheel(0.32, 0.12); w.position.set(x, 0.32, 0); g.add(w); });
  g.add(part(profileExtrude([[-0.6, 0.55], [-0.2, 0.95], [0.35, 1.0], [0.75, 0.75], [0.3, 0.45]], 0.3, 0.05), bodyMat(color)));
  const p = person(false); p.scale.setScalar(0.95); p.position.set(-0.05, 0.25, 0); p.rotation.z = -0.15; g.add(p); g.userData = {L:2.1, W:0.8, kind:'2r'}; return g; }
function makeBike(){ const g = new THREE.Group(); [-0.55, 0.55].forEach(x => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 20), C.rubber); w.position.set(x, 0.35, 0); g.add(w); });
  g.add(part(BOX(1.1, 0.04, 0.04), C.steel, 0, 0.62, 0, 0, 0, 0.1)); const p = person(false); p.scale.setScalar(0.92); p.position.set(-0.1, 0.12, 0); g.add(p); g.userData = {L:1.8, W:0.6, kind:'2r'}; return g; }
/* ---------- engins (jaune chantier, sans marque) ---------- */
const ENG = 0xF2B705;
function track(g, x, z, L, h = 0.75, w = 0.55){ g.add(part(RBOX(L, h, w, 0.32), C.rubber, x, h / 2, z)); for (let k = -1; k <= 1; k++) g.add(part(CYL(h * 0.32, h * 0.32, w + 0.04, 12), C.dark, x + k * (L - h) / 2.2, h / 2, z, Math.PI / 2)); }
function cabin(g, x, y, z, l = 1.0, h = 1.6, w = 1.0, col = ENG){ g.add(part(RBOX(l, h, w, 0.06), matCol(col, {rough:0.45}), x, y + h / 2, z)); g.add(part(BOX(l + 0.02, h * 0.55, w + 0.02), C.glass, x, y + h * 0.66, z)); g.add(part(RBOX(l + 0.06, 0.08, w + 0.06, 0.03), matCol(col, {rough:0.45}), x, y + h + 0.03, z)); }
function makeExcavator(mini = false){ const g = new THREE.Group(), k = mini ? 0.45 : 1, E = matCol(ENG, {rough:0.45});
  track(g, 0, -1.15 * k, 4.4 * k, 0.8 * k, 0.6 * k); track(g, 0, 1.15 * k, 4.4 * k, 0.8 * k, 0.6 * k); g.add(part(BOX(3.2 * k, 0.4 * k, 1.8 * k), C.dark, 0, 0.6 * k, 0));
  const up = new THREE.Group(); up.position.y = 0.95 * k; g.add(up);
  up.add(part(RBOX(3.2 * k, 1.1 * k, 2.6 * k, 0.12), E, -0.45 * k, 0.55 * k, 0)); up.add(part(RBOX(0.9 * k, 0.9 * k, 2.5 * k, 0.15), C.dark, -1.95 * k, 0.45 * k, 0));
  cabin(up, 0.65 * k, 1.1 * k, 0.75 * k, 1.0 * k, 1.6 * k, 0.95 * k);
  const boom = new THREE.Group(); boom.position.set(0.9 * k, 1.3 * k, -0.35 * k); up.add(boom);
  boom.add(part(RBOX(3.2 * k, 0.45 * k, 0.42 * k, 0.08), E, 1.4 * k, 0.9 * k, 0, 0, 0, 0.62)); boom.add(part(RBOX(2.4 * k, 0.36 * k, 0.34 * k, 0.06), E, 3.35 * k, 0.6 * k, 0, 0, 0, -1.05));
  boom.add(part(profileExtrude([[0, 0], [0.75 * k, 0.1 * k], [0.8 * k, 0.6 * k], [0.15 * k, 0.75 * k]], 0.9 * k, 0.03), C.dark, 3.7 * k, -0.95 * k));
  g.userData = {L:(mini ? 4 : 9.5), W:2.9 * k, kind:'engin'}; return g; }
function makeLoader(){ const g = new THREE.Group(), E = matCol(ENG, {rough:0.45});
  g.add(part(RBOX(3.2, 1.2, 2.1, 0.15), E, -0.9, 1.35, 0)); g.add(part(RBOX(1.6, 0.9, 1.9, 0.12), E, 1.2, 1.25, 0)); cabin(g, -0.25, 1.95, 0, 1.3, 1.6, 1.4);
  wheels(g, [-1.6, 1.3], 0.78, 0.6, 2.2); for (const s of [-1, 1]) g.add(part(RBOX(2.0, 0.22, 0.2, 0.05), E, 2.4, 1.4, s * 0.75, 0, 0, -0.35));
  g.add(part(profileExtrude([[0, 0], [1.0, 0.05], [1.05, 0.9], [0.2, 1.1]], 2.6, 0.04), C.dark, 3.0, 0.15)); g.userData = {L:7.2, W:2.6, kind:'engin'}; return g; }
function makeBackhoe(){ const g = makeLoader(); g.scale.set(0.82, 0.82, 0.82); const E = matCol(ENG, {rough:0.45});
  g.add(part(RBOX(2.4, 0.3, 0.3, 0.06), E, -3.0, 2.2, 0, 0, 0, 0.7)); g.add(part(RBOX(1.8, 0.26, 0.26, 0.05), E, -4.2, 1.8, 0, 0, 0, -0.9)); g.add(part(profileExtrude([[0, 0], [0.5, 0.1], [0.55, 0.5], [0.1, 0.55]], 0.6, 0.02), C.dark, -4.9, 0.4));
  g.userData = {L:7.5, W:2.3, kind:'engin'}; return g; }
function makeRoller(){ const g = new THREE.Group(), E = matCol(ENG, {rough:0.45}); g.add(part(CYL(0.75, 0.75, 2.1, 24), C.steel, 1.4, 0.75, 0, Math.PI / 2)); g.add(part(RBOX(1.2, 0.5, 2.2, 0.06), E, 1.4, 1.55, 0));
  g.add(part(RBOX(2.4, 1.1, 1.8, 0.12), E, -0.8, 1.1, 0)); cabin(g, -0.6, 1.65, 0, 1.2, 1.5, 1.3); wheels(g, [-1.4], 0.75, 0.55, 1.9); g.userData = {L:5.8, W:2.3, kind:'engin'}; return g; }
function makeFinisher(){ const g = new THREE.Group(), E = matCol(ENG, {rough:0.45}); track(g, 0, -1.0, 3.0, 0.6, 0.45); track(g, 0, 1.0, 3.0, 0.6, 0.45);
  g.add(part(RBOX(2.6, 1.0, 2.5, 0.1), E, 0, 1.1, 0)); g.add(part(profileExtrude([[0, 0], [1.4, 0], [1.6, 0.9], [-0.1, 0.9]], 3.0, 0.03), C.dark, 1.2, 0.6)); g.add(part(BOX(0.6, 0.5, 3.4), C.dark, -1.7, 0.35, 0));
  g.add(part(BOX(1.4, 0.06, 2.4), C.dark, -0.6, 2.4, 0)); for (const s of [-1, 1]) g.add(part(CYL(0.03, 0.03, 0.8, 6), C.steel, -0.6, 2.0, s * 1.1)); g.userData = {L:6.2, W:3.4, kind:'engin'}; return g; }
function makeTipper(){ const g = new THREE.Group(), L = 9.2, W = 2.5, x0 = -L / 2; cab(g, L / 2, W, 0xE9ECEF, 3.0);
  const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(5.6, 0), new THREE.Vector2(5.8, 1.5), new THREE.Vector2(-0.2, 1.5)]); const b = new THREE.ExtrudeGeometry(s, {depth:W, bevelEnabled:false}); b.translate(0, 0, -W / 2);
  g.add(part(b, matCol(0x8E959C, {rough:0.5, metal:0.5}), x0 + 0.5, 1.25)); g.add(part(BOX(6.3, 0.3, 1.0), C.dark, x0 + 3.2, 0.95, 0));
  wheels(g, [x0 + 1.4, x0 + 2.75, L / 2 - 2.6, L / 2 - 1.3], 0.52, 0.33, W - 0.35); g.userData = {L, W, kind:'pl'}; return g; }
function makeMixer(){ const g = new THREE.Group(), L = 9.0, W = 2.5, x0 = -L / 2; cab(g, L / 2, W, 0xE9ECEF, 3.0);
  const d = new THREE.LatheGeometry([[0.1, 0], [1.0, 0.4], [1.2, 2.5], [0.9, 4.6], [0.35, 5.2]].map(p => new THREE.Vector2(p[0], p[1])), 20); d.rotateZ(Math.PI / 2 + 0.2); d.translate(0.9, 0, 0);
  g.add(part(d, matCol(0xF06A12, {rough:0.45}), x0 + 5.2, 2.0, 0)); g.add(part(BOX(6.0, 0.3, 1.0), C.dark, x0 + 3.0, 0.95, 0));
  wheels(g, [x0 + 1.3, x0 + 2.65, L / 2 - 1.3], 0.52, 0.33, W - 0.35); g.userData = {L, W, kind:'pl'}; return g; }
function makeAerial(){ const g = makeVan(0xF4F5F3), E = matCol(ENG, {rough:0.45}); g.add(part(BOX(0.6, 0.4, 0.6), E, -1.4, 2.75, 0)); g.add(part(RBOX(4.2, 0.22, 0.22, 0.05), E, 0.3, 3.4, 0, 0, 0, 0.32));
  g.add(part(BOX(0.9, 0.8, 0.8), matCol(0xE9ECEF), 2.3, 4.2, 0)); g.userData = {L:6.2, W:2.0, kind:'vul'}; return g; }
function makeCrane(){ const g = new THREE.Group(), L = 11.5, W = 2.55, x0 = -L / 2; cab(g, L / 2, W, ENG, 3.0); g.add(part(RBOX(8.3, 1.0, W, 0.08), matCol(ENG, {rough:0.45}), x0 + 4.1, 1.45, 0));
  wheels(g, [x0 + 1.3, x0 + 2.8, x0 + 4.4, L / 2 - 1.4], 0.55, 0.36, W - 0.35); g.add(part(RBOX(2.4, 1.3, 2.3, 0.1), matCol(ENG, {rough:0.45}), x0 + 2.2, 2.6, 0));
  g.add(part(RBOX(10, 0.6, 0.55, 0.06), matCol(ENG, {rough:0.45}), x0 + 6.5, 3.6, 0.6, 0, 0, 0.18)); for (const sx of [x0 + 0.8, L / 2 - 2.6]) for (const s of [-1, 1]) g.add(part(BOX(0.25, 0.9, 0.25), C.dark, sx, 0.45, s * 2.0));
  g.userData = {L, W, kind:'pl'}; return g; }
function makeSweeper(){ const g = makeVan(0xF4F5F3); g.add(part(CYL(0.4, 0.4, 0.1, 16), matCol(0x2E7D32), 2.2, 0.08, 0.7)); g.userData = {L:5.4, W:2.0, kind:'vul'}; return g; }
