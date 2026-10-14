/* ============ Bibliothèque ARCHITRAFIC : catalogue des éléments à placer ============ */
const LIB_CATS = {temp:'Signalisation temporaire', reg:'Police et priorité', bal:'Balisage', veh:'Véhicules', eng:'Engins', chan:'Chantier et piétons'};
const LIB = [];
const libAdd = (cat, k, name, build, x = {}) => LIB.push({cat, k, name, build, ...x});
for (const code of ['AK5', 'AK3', 'AK3a', 'AK3b', 'AK14', 'AK17', 'AK2', 'AK4', 'AK22', 'AK30', 'AK31', 'KC1', 'KR_ROUTE', 'KD8', 'KD22a', 'KD22b', 'KD22c', 'KM9'])
  libAdd('temp', code, SIGNS[code].n, p => signOnStand(code, p), {sign:code, ref:code.replace('_ROUTE', '1').replace('KR', 'KC'), p:SIGNS[code].p ? {...SIGNS[code].p} : undefined, h:1.6});
for (const code of ['B1', 'B0', 'B2a', 'B2b', 'B3', 'B8', 'B9g', 'B14', 'B33', 'B15', 'C18', 'B21_1', 'B21_2', 'B21c1', 'B21c2', 'B21d1', 'B6a1', 'B6d', 'AB3a', 'AB4', 'C12', 'C13a', 'A13b'])
  libAdd('reg', code, SIGNS[code].n, p => p?.pole === 'mât' ? signOnPole(code, p) : signOnStand(code, p), {sign:code, ref:code.replace('_', '-'), p:{...(SIGNS[code].p || {}), pole:'chevalet'}, h:1.6});
libAdd('bal', 'K5a', 'Cône de chantier', p => coneK5a(+(p?.h || 0.75)), {ref:'K5a', p:{h:'0.75'}});
libAdd('bal', 'K5b', 'Balise d\'alignement', () => baliseK5b(), {ref:'K5b'});
libAdd('bal', 'K5c', 'Balise de guidage', () => baliseK5c(), {ref:'K5c'});
libAdd('bal', 'K2', 'Barrière de chantier', p => barrierK2(+(p?.len || 2)), {ref:'K2', p:{len:'2'}});
libAdd('bal', 'KR11', 'Feu de chantier (alternat)', p => feuKR11(p?.on || 'red'), {ref:'KR11', p:{on:'red'}});
libAdd('bal', 'FLR', 'Flèche lumineuse de rabattement', () => flr(), {ref:'FLR'});
libAdd('bal', 'PMV', 'Panneau à messages variables', () => pmv(), {ref:'PMV'});
libAdd('bal', 'K16x', 'Séparateur modulaire (1 m)', () => { const g = new THREE.Group(), m = k16Module(); g.add(part(m.geo, C.red)); return g; }, {ref:'K16'});
libAdd('bal', 'GBAx', 'Glissière béton (2 m)', () => { const g = new THREE.Group(), m = gbaModule(); g.add(part(m.geo, C.concrete)); return g; }, {ref:'GBA'});
libAdd('bal', 'VAUx', 'Barrière Vauban (2 m)', () => vaubanModule().grp, {ref:'Vauban'});
libAdd('bal', 'HERx', 'Clôture de chantier (3,5 m)', () => herasModule().grp, {ref:'Clôture'});
const VEH_DEF = {citadine:['Citadine', () => makeCar('citadine', 0xC9C2B4)], berline:['Berline', () => makeCar('berline', 0x8D949B)], break:['Break', () => makeCar('break', 0x1F3F73)], suv:['SUV', () => makeCar('suv', 0x2E3238)],
  utilitaire:['Fourgon utilitaire', () => makeVan()], porteur:['Camion porteur', () => makeTruck()], semi:['Semi-remorque', () => makeSemi()], bus:['Bus', () => makeBus()], moto:['Moto', () => makeMoto()], velo:['Vélo', () => makeBike()]};
for (const [k, [n, f]] of Object.entries(VEH_DEF)) libAdd('veh', k, n, p => { const g = f(); if (p?.color) recolor(g, p.color); return g; }, {p:{color:''}, color:true});
const ENG_DEF = {pelle:['Pelle sur chenilles', () => makeExcavator(false)], minipelle:['Mini-pelle', () => makeExcavator(true)], chargeuse:['Chargeuse sur pneus', makeLoader], tractopelle:['Tractopelle', makeBackhoe],
  compacteur:['Compacteur', makeRoller], finisseur:['Finisseur', makeFinisher], benne:['Camion benne', makeTipper], toupie:['Camion toupie', makeMixer], nacelle:['Véhicule nacelle', makeAerial], grue:['Grue mobile', makeCrane], balayeuse:['Balayeuse', makeSweeper]};
for (const [k, [n, f]] of Object.entries(ENG_DEF)) libAdd('eng', k, n, () => f());
libAdd('chan', 'bungalow', 'Bungalow de chantier', bungalow); libAdd('chan', 'wc', 'Sanitaire de chantier', wcChantier); libAdd('chan', 'benneDechets', 'Benne à gravats', benne);
libAdd('chan', 'bigbag', 'Big bag', bigBag); libAdd('chan', 'sable', 'Tas de sable', () => tas(C.sand)); libAdd('chan', 'terre', 'Tas de terre', () => tas(C.earth, 2.2, 1.4)); libAdd('chan', 'palette', 'Palette de matériaux', palette);
libAdd('chan', 'groupe', 'Groupe électrogène', groupeElec); libAdd('chan', 'plaque', 'Plaque de roulage', plaqueRoulage); libAdd('chan', 'tranchee', 'Tranchée', tranchee);
libAdd('chan', 'ouvrier', 'Agent de chantier', () => person(true)); libAdd('chan', 'pieton', 'Piéton', () => person(false));
const LIBK = Object.fromEntries(LIB.map(e => [e.k, e]));
/* balisage en ligne (outil « Balisage ») */
const LINE_TYPES = {
  cones:{n:'Cônes K5a', sp:4, item:'K5a', legend:'Cônes K5a', col:'#F06A12'}, k5b:{n:'Balises K5b', sp:5, item:'K5b', legend:'Balises K5b', col:'#C8102E'},
  k16:{n:'Séparateurs K16 (continus)', mod:'k16', legend:'Séparateurs modulaires K16', col:'#C8102E'}, gba:{n:'Glissière béton (GBA)', mod:'gba', legend:'Glissière béton armé', col:'#8C8A84'},
  heras:{n:'Clôture de chantier', mod:'heras', legend:'Clôture de chantier', col:'#6E7781'}, vauban:{n:'Barrières Vauban', mod:'vauban', legend:'Barrières Vauban', col:'#9AA1A8'},
  k2:{n:'Barrières K2 (continues)', mod:'k2', legend:'Barrières K2', col:'#C8102E'}, rubalise:{n:'Rubalise', mod:'tape', legend:'Rubalise', col:'#E53935'},
};
function recolor(g, color){ const c = new THREE.Color(color); g.traverse(o => { if (o.isMesh && o.material?.userData.body) o.material = bodyMat(c.getHex()); }); }
/* vignettes 3D (rendues une fois, à la demande) */
const THUMBS = {};
let thumbRT = null, thumbScene = null, thumbCam = null;
function libThumb(e){
  if (THUMBS[e.k]) return THUMBS[e.k];
  if (e.sign) return THUMBS[e.k] = signThumb(e.sign, e.p);
  try {
    if (!thumbRT){ thumbRT = new THREE.WebGLRenderTarget(160, 160, {samples:4}); thumbRT.texture.colorSpace = THREE.SRGBColorSpace; } thumbCam ??= new THREE.PerspectiveCamera(30, 1, 0.05, 200);
    if (!thumbScene){ thumbScene = new THREE.Scene(); thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 5, 4); thumbScene.add(d); }
    const obj = e.build(e.p || {}); thumbScene.add(obj);
    const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), r = Math.max(s.x, s.y, s.z) * 1.05 + 0.1;
    thumbCam.position.set(c.x + r * 1.2, c.y + r * 0.85, c.z + r * 1.55); thumbCam.lookAt(c);
    const bgc = renderer.getClearColor(new THREE.Color()), ba = renderer.getClearAlpha(), bgS = thumbScene.background; thumbScene.background = null; renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(thumbRT); renderer.clear(); renderer.render(thumbScene, thumbCam); const px = new Uint8Array(160 * 160 * 4); renderer.readRenderTargetPixels(thumbRT, 0, 0, 160, 160, px); renderer.setRenderTarget(null); renderer.setClearColor(bgc, ba); thumbScene.background = bgS;
    thumbScene.remove(obj); obj.traverse(o => o.geometry?.dispose());
    const cv = document.createElement('canvas'); cv.width = cv.height = 160; const g = cv.getContext('2d'), img = g.createImageData(160, 160);
    for (let y = 0; y < 160; y++) img.data.set(px.subarray((159 - y) * 640, (160 - y) * 640), y * 640);
    g.putImageData(img, 0, 0); return THUMBS[e.k] = cv.toDataURL('image/png');
  } catch(err){ return THUMBS[e.k] = ''; }
}
