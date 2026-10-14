/* ============ Modèles 3D : balisage, signalisation sur support, installations de chantier ============
   Modèles procéduraux légers (quelques centaines de faces), sans marque, aux dimensions réelles.
   Repère d'un modèle : +x vers l'avant (sens de marche, ou face visible d'un panneau), +y vers le haut, z latéral. */
const part = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; return m; };
const BOX = (l, h, w) => new THREE.BoxGeometry(l, h, w);
const RBOX = (l, h, w, r = 0.04) => new RoundedBoxGeometry(l, h, w, 2, Math.min(r, l / 2.1, h / 2.1, w / 2.1));
const CYL = (r0, r1, h, n = 14) => new THREE.CylinderGeometry(r0, r1, h, n);
const C = {
  orange:matCol(0xF06A12, {rough:0.55}), white:matCol(0xF4F4F2, {rough:0.5}), red:matCol(0xC8102E, {rough:0.55}), black:matCol(0x1D1F22, {rough:0.8}), dark:matCol(0x2E3238, {rough:0.6, metal:0.3}),
  galva:matCol(0xA9B0B7, {rough:0.35, metal:0.85}), steel:matCol(0x6C737B, {rough:0.4, metal:0.7}), yellow:matCol(0xF2B705, {rough:0.5}), concrete:matCol(0xB9B6AE, {rough:0.95}), wood:matCol(0xB08452, {rough:0.9}),
  glass:matCol(0x26313B, {rough:0.08, metal:0.6}), rubber:matCol(0x18191B, {rough:0.95}), rim:matCol(0xB8BEC4, {rough:0.3, metal:0.8}), sand:matCol(0xC9AE7C, {rough:1}), earth:matCol(0x7A5C3E, {rough:1}),
  lightW:matCol(0xFFFFF0, {emissive:0xFFF6D8, ei:0.6}), lightR:matCol(0xB0101A, {emissive:0x900010, ei:0.5}), lightO:matCol(0xFF8A00, {emissive:0xFF7A00, ei:0.9}), lightRon:matCol(0xFF2020, {emissive:0xFF1010, ei:1.6}), green:matCol(0x2E7D32, {rough:0.6}),
  mesh:matCol(0x9CA3AA, {rough:0.5, metal:0.6, opacity:0.55, depthWrite:false}), bag:matCol(0x6B6B4E, {rough:1}), blue:matCol(0x1F4FA3, {rough:0.5}), skin:matCol(0xC99B7A, {rough:0.8}), vest:matCol(0xF2D200, {rough:0.6}), jeans:matCol(0x2F4A6E, {rough:0.9}),
};
/* rayures rouge et blanc (panneaux K2, K5b, séparateurs) */
function stripeTex(c1 = '#C8102E', c2 = '#F4F4F2', diag = true, n = 4){
  const key = `stripe|${c1}|${c2}|${diag}|${n}`; if (TEX[key]) return TEX[key];
  return TEX[key] = canvasTex(256, 64, (g, w, h) => { g.fillStyle = c2; g.fillRect(0, 0, w, h); g.fillStyle = c1; const s = w / n; for (let i = -1; i <= n; i++){ g.beginPath(); if (diag){ g.moveTo(i * s, h); g.lineTo(i * s + s / 2, h); g.lineTo(i * s + s / 2 + h, 0); g.lineTo(i * s + h, 0); } else { g.rect(i * s, 0, s / 2, h); } g.fill(); } });
}
const stripeMat = (c1, c2, diag, n) => { const key = `ms|${c1}|${c2}|${diag}|${n}`; return MAT[key] ??= new THREE.MeshStandardMaterial({map:stripeTex(c1, c2, diag, n), roughness:0.45}); };
/* panneau de signalisation : face texturée (+x), dos gris ; sur chevalet de chantier ou sur mât */
const SIGN_SIZE = {tri:[0.7, 0.62], inv:[0.7, 0.62], circ:[0.65, 0.65], disc:[0.65, 0.65], blue:[0.65, 0.65], park:[0.65, 0.65], end:[0.65, 0.65], oct:[0.65, 0.65], sq:[0.6, 0.6]};
function signPlate(code, p = {}, scale = 1){
  const S = signShape(code), ar = S.ar || 1, sz = S.s === 'rect' ? [0.9 * ar * (ar > 2 ? 0.6 : 0.8), 0.9 * (ar > 2 ? 0.6 : 0.8)] : SIGN_SIZE[S.s] || [0.7, 0.7];
  const w = sz[0] * scale, h = sz[1] * scale, t = signFaceTex(code, p), grp = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT['face|' + t.uuid] ??= new THREE.MeshStandardMaterial({map:t, transparent:false, alphaTest:0.5, roughness:0.35, metalness:0}));
  face.rotation.y = Math.PI / 2; face.position.x = 0.012; face.castShadow = true; grp.add(face);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT['back|' + t.uuid] ??= new THREE.MeshStandardMaterial({color:0x9AA1A8, alphaMap:t, alphaTest:0.5, roughness:0.4, metalness:0.6}));
  back.rotation.y = -Math.PI / 2; back.position.x = -0.002; back.castShadow = true; grp.add(back);
  grp.userData.size = [w, h]; return grp;
}
function signOnStand(code, p = {}){ // chevalet de chantier lesté (signalisation temporaire)
  const g = new THREE.Group(), pl = signPlate(code, p), [w, h] = pl.userData.size, y0 = 0.9;
  pl.position.y = y0 + h / 2; g.add(pl);
  g.add(part(BOX(0.035, y0 + h * 0.6, 0.035), C.galva, -0.03, (y0 + h * 0.6) / 2, -w * 0.3), part(BOX(0.035, y0 + h * 0.6, 0.035), C.galva, -0.03, (y0 + h * 0.6) / 2, w * 0.3));
  const leg = part(BOX(0.03, 1.15, 0.03), C.galva, -0.38, 0.55, 0, 0, 0, -0.62); g.add(leg); g.add(part(BOX(0.6, 0.03, w * 0.65), C.galva, -0.2, 0.06, 0));
  g.add(part(RBOX(0.45, 0.12, 0.3, 0.05), C.bag, -0.42, 0.08, 0)); return g;
}
function signOnPole(code, p = {}, H0 = 2.3){ // mât (signalisation permanente)
  const g = new THREE.Group(), pl = signPlate(code, p, 1.1), [w, h] = pl.userData.size; pl.position.y = H0 + h / 2; g.add(pl);
  g.add(part(CYL(0.035, 0.035, H0 + h * 0.9, 10), C.galva, -0.05, (H0 + h * 0.9) / 2, 0)); return g;
}
/* balisage ponctuel */
function coneK5a(h = 0.75){
  const g = new THREE.Group(), r = h * 0.22;
  const body = CYL(r * 0.18, r, h * 0.92, 18); body.translate(0, h * 0.46 + 0.04, 0);
  const uv = body.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
  g.add(part(body, C.orange));
  [0.35, 0.62].forEach((t, i) => { const y0 = h * t, rr = r * (1 - (y0 - 0.04) / (h * 0.92) * 0.82), b = CYL(rr * 0.97 + 0.004, rr + 0.004, h * 0.1, 18); b.translate(0, y0 + 0.04, 0); g.add(part(b, C.white)); });
  g.add(part(BOX(r * 2.3, 0.04, r * 2.3), C.black, 0, 0.02, 0)); return g;
}
function baliseK5b(){ const g = new THREE.Group(); const t = CYL(0.055, 0.055, 1.0, 12); t.translate(0, 0.62, 0);
  const m = MAT.k5b ??= new THREE.MeshStandardMaterial({map:stripeTex('#C8102E', '#F4F4F2', false, 2), roughness:0.45}); m.map.rotation = Math.PI / 2;
  g.add(part(t, m), part(CYL(0.22, 0.25, 0.12, 14), C.black, 0, 0.06, 0)); return g; }
function baliseK5c(){ const g = new THREE.Group(); // balise de virage (chevron)
  const pl = signPlate('B21_1'); pl.scale.setScalar(0.7); pl.position.y = 1.0; g.add(pl); g.add(part(BOX(0.04, 1.0, 0.04), C.galva, -0.03, 0.5, 0), part(CYL(0.22, 0.25, 0.1, 12), C.black, 0, 0.05, 0)); return g; }
function barrierK2(len = 2){ // barrière de chantier : lisse rouge et blanc sur deux pieds
  const g = new THREE.Group(), m = stripeMat('#C8102E', '#F4F4F2', true, Math.round(len * 2.5));
  g.add(part(BOX(0.04, 0.25, len), m, 0, 0.95, 0));
  for (const z of [-len / 2 + 0.15, len / 2 - 0.15]){ g.add(part(BOX(0.05, 1.08, 0.05), C.galva, 0, 0.54, z)); g.add(part(BOX(0.7, 0.04, 0.06), C.galva, 0, 0.03, z)); g.add(part(RBOX(0.4, 0.1, 0.25, 0.04), C.bag, 0.12, 0.08, z)); }
  return g;
}
function feuKR11(on = 'red'){ // feu de chantier mobile (alternat)
  const g = new THREE.Group(); g.add(part(BOX(0.06, 2.6, 0.06), C.yellow, 0, 1.3, 0)); g.add(part(RBOX(0.3, 0.9, 0.36, 0.05), C.dark, 0.08, 2.45, 0));
  [['red', 2.72], ['orange', 2.45], ['green', 2.18]].forEach(([c, y]) => g.add(part(CYL(0.1, 0.1, 0.04, 16), c === on ? (c === 'red' ? C.lightRon : c === 'orange' ? C.lightO : matCol(0x30FF60, {emissive:0x10D040, ei:1.4})) : matCol(0x30343A, {rough:0.3}), 0.25, y, 0, 0, 0, Math.PI / 2)));
  g.add(part(BOX(1.1, 0.12, 0.8), C.yellow, 0, 0.06, 0)); g.add(part(BOX(0.4, 0.4, 0.3), C.dark, -0.3, 0.32, 0)); return g;
}
function flr(){ // flèche lumineuse de rabattement sur remorque
  const g = new THREE.Group(), pl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), MAT.flr ??= new THREE.MeshStandardMaterial({map:canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#FFB300'; for (let x = 30; x < 200; x += 18) c.fillRect(x, 74, 10, 12); c.beginPath(); c.moveTo(200, 40); c.lineTo(240, 80); c.lineTo(200, 120); c.fill(); }), emissive:0xFFFFFF, emissiveIntensity:0.6, roughness:0.3})); pl.material.emissiveMap = pl.material.map;
  pl.rotation.y = Math.PI / 2; pl.position.set(0.06, 2.4, 0); g.add(pl); g.add(part(BOX(0.1, 1.1, 1.7), C.dark, 0, 2.4, 0), part(BOX(0.1, 1.8, 0.1), C.yellow, 0, 0.9, 0));
  g.add(part(RBOX(1.6, 0.35, 1.4, 0.05), C.yellow, -0.6, 0.55, 0)); for (const z of [-0.75, 0.75]) g.add(part(CYL(0.3, 0.3, 0.18, 16), C.rubber, -0.6, 0.3, z, Math.PI / 2)); g.add(part(BOX(1.2, 0.08, 0.08), C.steel, 0.5, 0.45, 0)); return g;
}
function pmv(){ const g = flr(); g.children[0].material = MAT.pmv ??= new THREE.MeshStandardMaterial({map:canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#FFB300'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.fillText('TRAVAUX', w / 2, 66); c.fillText('DÉVIATION', w / 2, 116); }), emissive:0xFFFFFF, emissiveIntensity:0.6, roughness:0.3}); g.children[0].material.emissiveMap = g.children[0].material.map; return g; }
/* éléments linéaires (un module) */
function k16Module(){ const g = new THREE.Group(), s = new THREE.Shape([new THREE.Vector2(-0.3, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.18, 0.8), new THREE.Vector2(-0.18, 0.8)]);
  const geo = new THREE.ExtrudeGeometry(s, {depth:0.96, bevelEnabled:true, bevelSize:0.02, bevelThickness:0.02, bevelSegments:2}); geo.translate(0, 0, -0.48); return {geo, len:1.0}; }
function gbaModule(){ const s = new THREE.Shape([new THREE.Vector2(-0.3, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.27, 0.08), new THREE.Vector2(0.1, 0.33), new THREE.Vector2(0.075, 0.8), new THREE.Vector2(-0.075, 0.8), new THREE.Vector2(-0.1, 0.33), new THREE.Vector2(-0.27, 0.08)]);
  const geo = new THREE.ExtrudeGeometry(s, {depth:1.98, bevelEnabled:false}); geo.translate(0, 0, -0.99); return {geo, len:2.0}; }
function herasModule(){ const g = new THREE.Group(); g.add(part(new THREE.PlaneGeometry(3.4, 1.9), C.mesh, 0, 1.05, 0, 0, Math.PI / 2)); for (const z of [-1.7, 1.7]){ g.add(part(CYL(0.02, 0.02, 2, 6), C.galva, 0, 1.05, z)); g.add(part(BOX(0.18, 0.15, 0.6), C.concrete, 0, 0.075, z)); }
  g.add(part(BOX(0.03, 0.03, 3.4), C.galva, 0, 2.0, 0), part(BOX(0.03, 0.03, 3.4), C.galva, 0, 0.1, 0)); return {grp:g, len:3.5}; }
function vaubanModule(){ const g = new THREE.Group(); g.add(part(BOX(0.04, 0.04, 2.0), C.galva, 0, 1.08, 0), part(BOX(0.04, 0.04, 2.0), C.galva, 0, 0.2, 0)); for (let z = -0.9; z <= 0.91; z += 0.15) g.add(part(CYL(0.01, 0.01, 0.88, 5), C.galva, 0, 0.64, z));
  for (const z of [-1, 1]){ g.add(part(CYL(0.02, 0.02, 1.1, 6), C.galva, 0, 0.55, z)); g.add(part(BOX(0.5, 0.03, 0.04), C.galva, 0, 0.02, z)); } return {grp:g, len:2.05}; }
/* installations de chantier */
function bungalow(){ const g = new THREE.Group(); g.add(part(RBOX(6, 2.6, 2.4, 0.05), C.white, 0, 1.45, 0)); g.add(part(BOX(6.05, 0.15, 2.45), C.dark, 0, 2.8, 0), part(BOX(6.05, 0.2, 2.45), C.dark, 0, 0.2, 0));
  g.add(part(BOX(0.05, 1.0, 1.2), C.glass, 1.2, 1.7, 1.21, 0, Math.PI / 2), part(BOX(0.05, 2.0, 0.9), C.dark, -1.8, 1.3, 1.21, 0, Math.PI / 2)); return g; }
function wcChantier(){ const g = new THREE.Group(); g.add(part(RBOX(1.15, 2.3, 1.15, 0.06), C.blue, 0, 1.15, 0), part(RBOX(1.2, 0.12, 1.2, 0.04), C.white, 0, 2.33, 0)); return g; }
function benne(){ const g = new THREE.Group(), s = new THREE.Shape([new THREE.Vector2(-2, 0), new THREE.Vector2(2, 0), new THREE.Vector2(2.6, 1.5), new THREE.Vector2(-2.6, 1.5)]);
  const outer = new THREE.ExtrudeGeometry(s, {depth:2.0, bevelEnabled:false}); outer.translate(0, 0.1, -1.0); g.add(part(outer, C.yellow)); g.add(part(BOX(5.0, 0.05, 1.9), C.earth, 0, 1.45, 0)); return g; }
function bigBag(){ const g = new THREE.Group(); g.add(part(RBOX(0.95, 0.9, 0.95, 0.12), matCol(0xE6E0D0, {rough:1}), 0, 0.45, 0), part(new THREE.SphereGeometry(0.44, 12, 8, 0, 6.3, 0, 1.2), C.sand, 0, 0.88, 0)); return g; }
function tas(mat = C.sand, r = 1.6, h = 1.1){ const g = new THREE.Group(), geo = new THREE.ConeGeometry(r, h, 18, 4); const a = geo.attributes.position, R = rng(3); for (let i = 0; i < a.count; i++){ const y = a.getY(i); if (y > -h / 2 + 0.01) { const k = 0.9 + R() * 0.2; a.setX(i, a.getX(i) * k); a.setZ(i, a.getZ(i) * k); } } geo.computeVertexNormals(); g.add(part(geo, mat, 0, h / 2, 0)); return g; }
function palette(){ const g = new THREE.Group(); g.add(part(BOX(1.2, 0.14, 0.8), C.wood, 0, 0.07, 0), part(RBOX(1.15, 0.7, 0.75, 0.02), matCol(0xB7B0A3, {rough:0.95}), 0, 0.5, 0)); return g; }
function groupeElec(){ const g = new THREE.Group(); g.add(part(RBOX(1.8, 1.2, 0.9, 0.06), C.yellow, 0, 0.75, 0), part(BOX(1.9, 0.1, 1.0), C.dark, 0, 0.12, 0)); for (const z of [-0.5, 0.5]) g.add(part(CYL(0.22, 0.22, 0.12, 14), C.rubber, -0.4, 0.22, z, Math.PI / 2)); return g; }
function plaqueRoulage(){ const g = new THREE.Group(); g.add(part(BOX(3, 0.03, 2), matCol(0x5D6167, {metal:0.8, rough:0.55}), 0, 0.015, 0)); return g; }
function tranchee(){ const g = new THREE.Group(); g.add(part(BOX(6, 0.02, 1.0), matCol(0x3D2E22, {rough:1}), 0, 0.01, 0)); g.add(part(BOX(6, 0.6, 0.6), C.earth, 0, 0.3, 1.0)); return g; }
function person(vest = true){ const g = new THREE.Group(); g.add(part(CYL(0.13, 0.11, 0.85, 8), C.jeans, 0, 0.43, 0)); g.add(part(RBOX(0.26, 0.6, 0.42, 0.08), vest ? C.vest : matCol(0x55606E), 0, 1.15, 0));
  g.add(part(new THREE.SphereGeometry(0.11, 12, 10), C.skin, 0, 1.6, 0)); if (vest) g.add(part(new THREE.SphereGeometry(0.13, 12, 8, 0, 6.3, 0, 1.4), C.white, 0, 1.64, 0)); return g; }
