/* ============ DQE : détail quantitatif estimatif par lots (corps d'état) ============
   Les articles sont déduits de la maquette : chaque couche de paroi, chaque élément et chaque composant est rangé dans le lot
   qui l'exécute (gros œuvre, isolation-plâtrerie, façades…). Prix unitaires indicatifs (€ HT), modifiables et enregistrés dans
   le projet (state.dqe.pu). Export : Excel (.xlsx), PDF (impression) ou CSV, avec options à cocher. */
const DQE_LOTS = [
  ['01', 'Terrassements – VRD'], ['02', 'Gros œuvre – Maçonnerie'], ['03', 'Charpente – Ossature bois'], ['04', 'Couverture – Étanchéité'],
  ['05', 'Menuiseries extérieures'], ['06', 'Isolation – Plâtrerie – Cloisons'], ['07', 'Menuiseries intérieures'], ['08', 'Revêtements de sols – Chapes'],
  ['09', 'Peinture – Revêtements muraux'], ['10', 'Façades – Bardage – Isolation extérieure'], ['11', 'Serrurerie – Métallerie'], ['12', 'Plomberie – Sanitaires'],
  ['13', 'Mobilier – Équipements'], ['14', 'Aménagements extérieurs']];
const DQE_LOT_NAME = Object.fromEntries(DQE_LOTS);
const STRUCT_CATS = ['Maçonnerie', 'Béton et mortiers', 'Bois et dérivés'];
const FINISH_IDS = new Set(['enduit', 'enduitChaux', 'enduitPlatre', 'mortier', 'chape', 'chapeAnhy', 'betonCire']);
const isAir = m => mat(m).R != null;
const isInsul = m => mat(m).cat === 'Isolants';
const isWoodFrameish = m => ['osb', 'contreplaque', 'agglo', 'mdf', 'fibroCiment'].includes(m);
const lc = t => t ? t.charAt(0).toLowerCase() + t.slice(1) : t;   // minuscule initiale seulement (garde C25/30, BA13, PSE…)
const cm = e => nf(e * 100, e * 100 % 1 ? 1 : 0);
/* Prix indicatifs (€ HT) : m² = base + parCm × épaisseur (cm) ; m³, kg, ml, u */
const PRICE_MAT = {
  parpaing:[30, 1.3], parpaingP:[35, 1.6], brique:[35, 1.6], briqueTh:[40, 1.5], briqueP:[45, 2.5], betCell:[35, 1.4], pierreCalc:[120, 3], pierreTend:[110, 3], granit:[150, 4], moellon:[90, 2.5], terreCrue:[40, 1.5], btc:[45, 2],
  ba:[60, 4.5], beton:[45, 3.5], hourdis:[45, 1.0], betonLeg:[40, 3], betonChanvre:[40, 2.5], laineVerre:[6, 0.6], laine:[7, 0.8], laineRocheD:[15, 1.2], pse:[5, 0.7], pseG:[6, 0.8], xps:[8, 1.2], pir:[9, 1.4],
  fibreBoisR:[12, 1.8], fibreBoisS:[8, 1.1], ouate:[5, 0.6], chanvre:[9, 1], liege:[15, 2.2], verreCell:[25, 3], paille:[10, 0.3], pu:[8, 1.2], clt:[40, 9], bois:[20, 4], glulam:[30, 7], osb:[10, 1], bardageBois:[45, 4]
};
const PRICE_FIXED = { enduit:28, enduitChaux:35, enduitPlatre:18, chape:22, chapeAnhy:25, carrelage:55, faience:50, parquet:75, stratifie:30, pvcSol:35, moquette:28, resine:45, linoleum:38, pierreSol:110, betonCire:90,
  tuile:55, ardoise:95, bitume:35, epdm:30, bacAcier:30, zinc:95, gravier:12, terreVeg:45, paraVapeur:4, freinVap:7, sousCoucheAc:6, paraPluie:5, ba13:12, ba13H:15, ba13F:16, carreauPl:45, fermacell:20 };
const pricePerM2 = (m, e) => PRICE_FIXED[m] != null ? PRICE_FIXED[m] : PRICE_MAT[m] ? PRICE_MAT[m][0] + PRICE_MAT[m][1] * e * 100 : 25;

/* Lot d'une couche de paroi selon sa position (côté extérieur de la structure, structure, côté intérieur) */
function layerLot(m, role, kind, use){
  const M = mat(m);
  if (kind === 'slab'){
    if (['Revêtements de sol'].includes(M.cat) || m === 'chape' || m === 'chapeAnhy' || m === 'betonCire') return use === 'toiture' ? '04' : '08';
    if (M.cat === 'Couverture et étanchéité' || m === 'bacAcier') return '04';
    if (role === 'struct') return M.cat === 'Bois et dérivés' ? '03' : '02';
    if (isInsul(m)) return role === 'above' ? (use === 'toiture' ? '04' : '08') : role === 'under' && (use === 'terrePlein' || use === 'plancherBas') ? '02' : '06';
    if (M.cat === 'Plâtre et plaques') return '06';
    if (isWoodFrameish(m)) return '03';
    return '02';
  }
  if (role === 'struct') return M.cat === 'Bois et dérivés' ? '03' : '02';
  if (role === 'ext') return isInsul(m) || FINISH_IDS.has(m) || m === 'bardageBois' || M.cat === 'Couverture et étanchéité' ? '10' : isWoodFrameish(m) ? '03' : '10';
  return isInsul(m) || M.cat === 'Plâtre et plaques' || FINISH_IDS.has(m) || isWoodFrameish(m) ? '06' : '06';
}
function structIndex(layers){
  let best = -1, w = -1;
  layers.forEach(([m, e], i) => { const M = mat(m); if (isAir(m) || FINISH_IDS.has(m) || isInsul(m) || !STRUCT_CATS.includes(M.cat) || isWoodFrameish(m) || m === 'bardageBois') return; const k = (M.rho || 0) * e; if (k > w){ w = k; best = i; } });
  return best;
}
const famLotDqe = (F, el) => {
  const c = F?.cat, id = el.fam;
  if (c === 'Fenêtres') return '05';
  if (c === 'Portes'){ const w = el.host ? getEl(el.host) : null, ext = /entree|ext/.test(id) || (w && compo(w.type).lot !== 'Second œuvre' && wallLayersHaveInsul(w)); return ext ? '05' : '07'; }
  if (c === 'Ouvertures') return null;
  if (c === 'Cuisine et sanitaires') return id === 'cuisine' ? '13' : '12';
  if (c === 'Escaliers et garde-corps') return /garde/.test(id) ? '11' : '02';
  if (c === 'Structure'){ const m = instSolids(el)[0]?.m; return m === 'acier' || mat(m).cat === 'Métaux' ? '11' : mat(m).cat === 'Bois et dérivés' ? '03' : '02'; }
  if (c === 'Extérieur') return '14';
  return '13';
};
const wallLayersHaveInsul = w => compo(w.type).layers.some(([m]) => isInsul(m)) || compo(w.type).lot === 'Gros œuvre';
function famPrice(F, el){
  const c = famCut(el), a = c ? c.w * c.h : 1, id = el.fam;
  if (F?.cat === 'Fenêtres') return Math.round(id === 'fenetre-fixe' ? 250 + 300 * a : /baie|porte-fenetre/.test(id) ? 600 + 450 * a : 380 + 420 * a);
  if (F?.cat === 'Portes') return /entree/.test(id) ? 1800 : /double/.test(id) ? 650 : 380;
  return ({wc:450, lavabo:380, douche:950, baignoire:1100, cuisine:3500, arbre:180, 'escalier-droit':2800, 'garde-corps':220, 'poutre-acier':0, 'poutre-bois':0, table:350, chaise:80, lit:500, canape:900, bureau:300, armoire:600, rayonnage:450, palette:0, cuve:2500, machine:0, voiture:0})[id] ?? 300;
}

/* Articles du DQE. Chaque article : {key, lot, des, det, u, q, byLvl, mass, co2, pu0} */
function dqeItems(){
  const items = new Map();
  const add = (key, lot, des, det, u, q, lvl, pu0, mass = 0, co2 = 0) => {
    if (!lot || !(q > 1e-6)) return;
    let it = items.get(key); if (!it) items.set(key, it = {key, lot, des, det, u, q:0, byLvl:{}, mass:0, co2:0, pu0});
    it.q += q; it.byLvl[lvl] = (it.byLvl[lvl] || 0) + q; it.mass += mass; it.co2 += co2;
  };
  const layerMass = (m, e, a) => { const M = mat(m), kg = isAir(m) ? 0 : (M.rho || 0) * e * a; return [kg, kg * (M.gwp || 0)]; };
  let groundArea = 0, groundPerim = 0;
  for (const el of state.els){
    if (el.kind === 'wall'){
      const C = compo(el.type), L = wallAxis(el).L, ops = wallOpenings(el).reduce((s, o) => s + (o.t1 - o.t0) * (o.z1 - o.z0), 0), net = Math.max(0, L * el.h - ops);
      const layers = C.layers, part = C.lot === 'Second œuvre';
      if (part){ // cloison : un seul article
        add('W|' + el.type, '06', /^cloison/i.test(C.nom) ? C.nom : `Cloison ${lc(C.nom)}`, `ép. ${cm(layers.reduce((s, l) => s + l[1], 0))} cm`, 'm²', net, el.lvl, Math.round(layers.reduce((s, [m, e]) => s + (isAir(m) ? 0 : pricePerM2(m, e)), 0) + 15), ...layers.reduce((acc, [m, e]) => { const r = layerMass(m, e, net); return [acc[0] + r[0], acc[1] + r[1]]; }, [0, 0]));
        add('P|wall2', '09', 'Peinture sur cloisons (2 faces)', 'impression + 2 couches', 'm²', net * 2, el.lvl, 14);
        continue;
      }
      const si = structIndex(layers), lining = [];
      layers.forEach(([m, e], i) => {
        if (isAir(m)) return;
        const role = si < 0 ? (i === 0 ? 'ext' : i === layers.length - 1 ? 'int' : 'struct') : i < si ? 'ext' : i === si ? 'struct' : 'int';
        const lot = layerLot(m, role, 'wall'), M = mat(m), [kg, co] = layerMass(m, e, net);
        if (role === 'int' && lot === '06'){ lining.push([m, e, kg, co]); return; }
        const des = role === 'struct' ? `${M.cat === 'Bois et dérivés' ? 'Mur' : M.cat === 'Béton et mortiers' ? 'Voile' : 'Maçonnerie'} ${lc(M.nom)}` : FINISH_IDS.has(m) ? `${M.nom} sur façade` : isInsul(m) ? `Isolation par l'extérieur : ${lc(M.nom)}` : M.nom;
        add(`L|${lot}|${m}|${Math.round(e * 1000)}`, lot, des, `ép. ${cm(e)} cm`, 'm²', net, el.lvl, Math.round(pricePerM2(m, e)), kg, co);
      });
      if (lining.length){
        const des = lining.some(([m]) => isInsul(m)) ? 'Doublage isolant : ' + lining.map(([m, e]) => `${lc(mat(m).nom)} ${cm(e)} cm`).join(' + ') : 'Parement intérieur : ' + lining.map(([m, e]) => `${lc(mat(m).nom)} ${cm(e)} cm`).join(' + ');
        add('D|' + lining.map(([m, e]) => m + Math.round(e * 1000)).join('+'), '06', des, '', 'm²', net, el.lvl, Math.round(lining.reduce((s, [m, e]) => s + pricePerM2(m, e), 0) + 10), lining.reduce((s, x) => s + x[2], 0), lining.reduce((s, x) => s + x[3], 0));
        add('P|wall1', '09', 'Peinture sur murs intérieurs', 'impression + 2 couches', 'm²', net, el.lvl, 14);
      }
      if (el.lvl === 0 && el.off <= 0.01){ groundPerim += L; add('T|fouilles', '01', 'Fouilles en rigole et semelles filantes', 'sous murs porteurs, ~0,5 × 0,6 m', 'ml', L, el.lvl, 95); }
    } else if (el.kind === 'slab'){
      const C = compo(el.type), use = elUse(el), r = rect(el.p, el.q), A = area(r), layers = C.layers, si = structIndex(layers);
      if (el.lvl === 0 && (use === 'terrePlein' || use === 'plancherBas')) groundArea += A;
      layers.forEach(([m, e], i) => {
        if (isAir(m)) return;
        const role = si < 0 ? 'struct' : i < si ? 'above' : i === si ? 'struct' : 'under', lot = layerLot(m, role, 'slab', use), M = mat(m), [kg, co] = layerMass(m, e, A);
        const des = role === 'struct' ? (M.cat === 'Bois et dérivés' ? `Plancher ${lc(M.nom)}` : use === 'terrePlein' ? `Dallage ${lc(M.nom)}` : `Dalle ${lc(M.nom)}`)
          : isInsul(m) ? `Isolant ${role === 'under' ? (use === 'terrePlein' ? 'sous dallage' : 'en sous-face') : use === 'toiture' ? 'de toiture' : 'sous chape'} : ${lc(M.nom)}` : M.nom;
        add(`S|${lot}|${m}|${Math.round(e * 1000)}|${role}`, lot, des, `ép. ${cm(e)} cm`, 'm²', A, el.lvl, Math.round(pricePerM2(m, e)), kg, co);
      });
    } else if (el.kind === 'roof'){
      const C = compo(el.type), Q = roofQty(el), A = Q.slope, layers = C.layers, flat = (el.shape || '2') === '0';
      const woodAt = layers.findIndex(([m]) => isWoodFrameish(m) || m === 'bois');
      let plaster = false;
      layers.forEach(([m, e], i) => {
        if (isAir(m)) return;
        const M = mat(m), [kg, co] = layerMass(m, e, A); let lot, des;
        if (m === 'freinVap' || m === 'paraVapeur'){ lot = '06'; des = `${M.nom} en rampants`; }
        else if (m === 'paraPluie'){ lot = '04'; des = 'Écran de sous-toiture HPV'; }
        else if (M.cat === 'Couverture et étanchéité' || m === 'bacAcier' || m === 'zinc'){
          if (/pluie|hpv/i.test(m + M.nom)){ lot = '04'; des = 'Écran de sous-toiture HPV'; }
          else { lot = '04'; des = i === layers.length - 1 && m === 'bacAcier' ? 'Bac acier en sous-face' : `Couverture ${lc(M.nom)}${flat ? '' : ` · pente ${n0(roofPitch(el))}°`}`; }
        } else if (isInsul(m)){ const sark = woodAt >= 0 && woodAt > i; lot = sark ? '04' : '06'; des = sark ? `Isolation par sarking : ${lc(M.nom)}` : `Isolation sous rampants : ${lc(M.nom)}`; }
        else if (m === 'paraPluie'){ lot = '04'; des = 'Écran de sous-toiture HPV'; }
        else if (m === 'freinVap' || m === 'paraVapeur'){ lot = '06'; des = `${M.nom} en rampants`; }
        else if (M.cat === 'Plâtre et plaques'){ lot = '06'; des = `Plafond rampant ${lc(M.nom)}`; plaster = true; }
        else if (isWoodFrameish(m) || m === 'bois'){ lot = '03'; des = i <= 2 ? `Voligeage / support ${lc(M.nom)}` : `Chevronnage ${lc(M.nom)}`; }
        else { lot = '04'; des = M.nom; }
        add(`R|${lot}|${m}|${Math.round(e * 1000)}|${des}`, lot, des, e >= 0.005 ? `ép. ${cm(e)} cm · rampants` : 'surface des rampants', 'm²', A, el.lvl, Math.round(pricePerM2(m, e)), kg, co);
      });
      if (!flat){ const FQ = frameQty(el), O = frameOpts(el);
        if (O.mode === 'none'){} else if (O.kind === 'fermettes' && FQ.some(f => f.kind === 'entrait')){ const nT = FQ.filter(f => f.kind === 'entrait').reduce((s, f) => s + f.n, 0), v = FQ.reduce((s, f) => s + f.m3, 0);
          add('R|fermettes', '03', 'Fermettes industrielles en W, posées et contreventées', `entraxe ${n0(O.sp * 100)} cm · ${nf(v, 2)} m³ de bois`, 'u', nT, el.lvl, 95, v * 450, v * 450 * 0.26);
          FQ.filter(f => !['arbal', 'entrait', 'diag'].includes(f.kind)).forEach(f => add(`R|fr|${f.kind}|${n0(f.w * 1000)}x${n0(f.h * 1000)}`, '03', FRAME_NAMES[f.kind], `section ${n0(f.w * 1000)} × ${n0(f.h * 1000)} mm`, 'ml', f.ml, el.lvl, Math.round(f.w * f.h * 1600 + 6), f.m3 * 450, f.m3 * 450 * 0.26)); }
        else FQ.forEach(f => add(`R|fr|${f.kind}|${n0(f.w * 1000)}x${n0(f.h * 1000)}`, '03', `${FRAME_NAMES[f.kind]}${f.kind === 'chevron' ? 's' : f.kind === 'panne' ? 's' : ''}`, `section ${n0(f.w * 1000)} × ${n0(f.h * 1000)} mm · ${f.n} pièce${f.n > 1 ? 's' : ''}`, 'ml', f.ml, el.lvl, Math.round(f.w * f.h * 1600 + 6), f.m3 * 450, f.m3 * 450 * 0.26));
        if (O.mode !== 'none' && Q.hip > 0) add('R|arret', '04', 'Arêtiers (closoirs et tuiles d\'arêtier)', 'linéaire d\'arêtier', 'ml', Q.hip, el.lvl, 45); }
      if (el.ceil){ add('R|ceil', '06', 'Plafond plaque de plâtre sur ossature', 'BA13 sur fourrures', 'm²', Q.ceil, el.lvl, 38); add('P|ceil', '09', 'Peinture sur plafonds', 'impression + 2 couches', 'm²', Q.ceil, el.lvl, 16);
        if (el.ceil === 'combles') add('R|combles', '06', 'Isolation des combles perdus : laine soufflée', 'ép. 30 cm (R ≈ 7)', 'm²', Q.ceil, el.lvl, 28); }
      if (Q.eave > 0) add('R|zing', '04', 'Gouttières et descentes (zinguerie)', 'linéaire d\'égout', 'ml', Q.eave, el.lvl, 55);
      if (Q.ridge > 0) add('R|faitage', '04', 'Faîtage et closoirs', 'linéaire de faîtage', 'ml', Q.ridge, el.lvl, 38);
      if (Q.gable > 0){ const G = roofGeom(el), gt = G.gables.length ? gableType(el, G.gables[0]) : 'MUR-EXT-01', GC = compo(gt), kg = GC.layers.reduce((s, [m, e]) => s + (isAir(m) ? 0 : (mat(m).rho || 0) * e), 0) * Q.gable;
        add(`R|pignon|${gt}`, '02', `Pignons : ${lc(GC.nom)}`, `ép. ${cm(GC.layers.reduce((s, l) => s + l[1], 0))} cm, triangles`, 'm²', Q.gable, el.lvl, Math.round(GC.layers.reduce((s, [m, e]) => s + (isAir(m) ? 0 : pricePerM2(m, e)), 0) + 15), kg, kg * 0.2); }
      if (plaster) add('P|ceil', '09', 'Peinture sur plafonds', 'impression + 2 couches', 'm²', A, el.lvl, 16);
    } else if (el.kind === 'stair'){
      const D = stairDims(el), st = el.st || 'droit', m = el.mat || 'bois', base = {droit:2600, quart:3600, demi:4300, tq:4900, helico:4200}[st] ?? 3000, k = m === 'beton' ? 1.15 : m === 'acier' ? 1.35 : 1;
      add(`ST|${st}|${m}|${D.n}`, m === 'beton' ? '02' : m === 'acier' ? '11' : '07', `Escalier ${lc(STAIR_TYPES[st])} en ${m === 'beton' ? 'béton armé' : m === 'acier' ? 'acier, marches bois' : 'bois'}`, `${D.n} marches de ${nf(D.h * 100, 1)} cm, giron ${nf(D.g * 100, 1)} cm${el.rail !== false ? ', avec main courante' : ''}`, 'u', 1, el.lvl, Math.round(base * k));
      if (el.tremie !== false && state.els.some(s => s.kind === 'slab' && slabHoles(s).length)) add(`ST|tremie`, '02', 'Trémie d\'escalier dans plancher (chevêtres, rives)', 'réservation et reprise', 'u', 1, el.lvl, 450);
    } else if (el.kind === 'col'){
      const M = mat(el.mat), v = el.w * el.d * el.h, kg = v * (M.rho || 0), lot = M.cat === 'Métaux' ? '11' : M.cat === 'Bois et dérivés' ? '03' : '02';
      add(`C|${el.mat}|${n0(el.w * 100)}x${n0(el.d * 100)}`, lot, `Poteau ${lc(M.nom)}`, `section ${n0(el.w * 100)} × ${n0(el.d * 100)} cm`, 'u', 1, el.lvl, lot === '11' ? Math.round(kg * 4.5) : lot === '03' ? Math.round(v * 1400 + 60) : Math.round(v * 600 + 120), kg, kg * (M.gwp || 0));
    } else if (el.kind === 'vol'){
      const M = mat(el.mat), r = rect(el.p, el.q), v = area(r) * el.h, kg = v * (M.rho || 0), lot = M.cat === 'Métaux' ? '11' : M.cat === 'Bois et dérivés' ? '03' : M.cat === 'Maçonnerie' || M.cat === 'Béton et mortiers' ? '02' : '13';
      add(`V|${el.mat}`, lot, `Ouvrage en ${lc(M.nom)}`, 'volume', 'm³', v, el.lvl, M.cat === 'Métaux' ? Math.round((M.rho || 7850) * 4.5) : M.cat === 'Bois et dérivés' ? 1300 : 450, kg, kg * (M.gwp || 0));
    } else if (el.kind === 'inst'){
      const F = fam(el.fam), lot = famLotDqe(F, el); if (!lot) continue;
      const c = famCut(el), t = F?.types?.[el.type | 0]?.nom, sols = instSolids(el), kg = sols.reduce((s, so) => s + solidVol(so) * (mat(so.m).rho || 0), 0), co = sols.reduce((s, so) => s + solidVol(so) * (mat(so.m).rho || 0) * (mat(so.m).gwp || 0), 0);
      const det = c ? `${n0(c.w * 100)} × ${n0(c.h * 100)} cm${t && !/×|x\s*\d/.test(t) ? ' · ' + t : ''}` : (t || '');
      if (F?.cat === 'Structure' && lot === '11') add(`F|${el.fam}|${el.type | 0}`, lot, F.nom, t || '', 'kg', kg, el.lvl, 4.5, kg, co);
      else if (F?.cat === 'Structure') add(`F|${el.fam}|${el.type | 0}`, lot, F.nom, t || '', 'm³', sols.reduce((s, so) => s + solidVol(so), 0), el.lvl, lot === '03' ? 1500 : 650, kg, co);
      else add(`F|${el.fam}|${el.type | 0}|${c ? n0(c.w * 100) + 'x' + n0(c.h * 100) : ''}`, lot, F?.nom || 'Composant', det, 'u', 1, el.lvl, famPrice(F, el), kg, co);
    }
  }
  if (groundArea > 0) add('T|decap', '01', 'Décapage de la terre végétale', 'emprise du bâtiment + 1 m', 'm²', groundArea + groundPerim * 1 + 4, 0, 4);
  const out = [...items.values()];
  for (const it of out){ it.pu = state.dqe?.pu?.[it.key] ?? it.pu0; it.total = it.q * it.pu; }
  return out.sort((a, b) => a.lot.localeCompare(b.lot) || a.des.localeCompare(b.des, 'fr'));
}
function dqeGroups(items){ const g = []; for (const [code, name] of DQE_LOTS){ const l = items.filter(i => i.lot === code); if (l.length) g.push({code, name, items:l, total:l.reduce((s, i) => s + i.total, 0)}); } return g; }
const eur = v => nfmt(2).format(Math.round(v * 100) / 100) + ' €';
const qtyFmt = (q, u) => nf(q, u === 'u' ? 0 : 2);

/* ---------- onglet Métré : aperçu du DQE, prix modifiables ---------- */
const dqeOpen = new Set();
function renderDqePanel(){
  if (!state.els.length) return `<p class="hint">Le DQE apparaîtra ici dès que vous aurez dessiné un premier élément.</p>`;
  const items = dqeItems(), groups = dqeGroups(items), ht = items.reduce((s, i) => s + i.total, 0), tva = state.dqe?.tva ?? 20;
  return `<div class="ph"><h2>DQE du projet</h2><span class="tag">Auto</span></div>
    <p class="hint">Détail quantitatif estimatif, rangé par lots selon ce que contient la maquette. Les prix unitaires sont indicatifs : modifiez-les, ils sont enregistrés dans le projet.</p>
    <div class="btns tight"><button class="btn primary" data-act="dqe-export">Exporter le DQE…</button><button class="btn" data-act="dqe-reset-pu">Prix par défaut</button></div>
    <div class="dqe">${groups.map(g => { const open = dqeOpen.has(g.code) || dqeOpen.size === 0;
      return `<section class="dqe-lot"><button class="dqe-h" data-dqelot="${g.code}" aria-expanded="${open}"><span class="dqe-c">${g.code}</span><b>${esc(g.name)}</b><span class="dqe-t">${eur(g.total)}</span></button>
        ${open ? `<div class="dqe-rows">${g.items.map((it, k) => `<div class="dqe-r"><div class="dqe-d"><span class="dqe-n">${g.code}.${k + 1}</span> ${esc(it.des)}${it.det ? `<small>${esc(it.det)}</small>` : ''}</div>
          <div class="dqe-m"><span>${qtyFmt(it.q, it.u)} ${it.u} ×</span><input class="pu" data-pu="${esc(it.key)}" type="text" inputmode="decimal" value="${nf(it.pu, 2)}" aria-label="Prix unitaire € HT"><span>€ =</span><b>${eur(it.total)}</b></div></div>`).join('')}</div>` : ''}</section>`; }).join('')}</div>
    <dl class="kv dqe-sum"><dt>Total HT</dt><dd class="big">${eur(ht)}</dd><dt>TVA ${nf(tva, 1)} %</dt><dd>${eur(ht * tva / 100)}</dd><dt>Total TTC</dt><dd class="big">${eur(ht * (1 + tva / 100))}</dd></dl>
    ${glazingCard()}
    <details class="help"><summary>Matériaux : volumes, masses, carbone</summary>${renderQty().replace(/<div class="ph">[\s\S]*?<\/div>/, '').replace(/<div class="btns">[\s\S]*?<\/div>/, '')}</details>`;
}
$('#pbody').addEventListener('change', e => {
  const t = e.target; if (!t.matches('[data-pu]')) return;
  const v = num(t.value); state.dqe ??= {pu:{}, tva:20}; state.dqe.pu ??= {};
  if (Number.isNaN(v)) delete state.dqe.pu[t.dataset.pu]; else state.dqe.pu[t.dataset.pu] = Math.max(0, v);
  save(); renderPanel();
});
$('#pbody').addEventListener('click', e => {
  const h = e.target.closest('[data-dqelot]'); if (h){ const c = h.dataset.dqelot; if (dqeOpen.size === 0) dqeGroups(dqeItems()).forEach(g => dqeOpen.add(g.code)); dqeOpen.has(c) ? dqeOpen.delete(c) : dqeOpen.add(c); if (!dqeOpen.size) dqeOpen.add('__none'); return renderPanel(); }
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'dqe-export') openDqeExport();
  if (b.dataset.act === 'dqe-reset-pu'){ if (state.dqe) state.dqe.pu = {}; save(); renderPanel(); toast('Prix unitaires par défaut rétablis'); }
});

/* ---------- options d'export ---------- */
const DQE_OPTS = [['lots', 'Regrouper par lots (corps d\'état)', true], ['num', 'Numéroter les articles (2.1, 2.2…)', true], ['details', 'Matériaux et épaisseurs dans les désignations', true],
  ['qty', 'Quantités', true], ['unit', 'Unités', true], ['pu', 'Prix unitaires', true], ['total', 'Montant par article', true], ['subtotal', 'Sous-totaux par lot', true],
  ['ttc', 'Total HT, TVA et TTC', true], ['levels', 'Quantités par niveau (une colonne par niveau)', false], ['mass', 'Masses (kg)', false], ['co2', 'Carbone (kg CO₂e)', false],
  ['matsheet', 'Tableau des matériaux (volumes, masses, carbone)', false], ['header', 'En-tête : projet, lieu, date, rédacteur', true],
  ['recap', 'Récapitulatif par lot en tête du document', true], ['pct', 'Part de chaque article et de chaque lot en % du total', true], ['sign', 'Cadre de signatures (PDF)', false]];
function openDqeExport(){
  const items = dqeItems(), groups = dqeGroups(items), o = {...Object.fromEntries(DQE_OPTS.map(([k, , d]) => [k, d])), ...(state.dqe?.opts || {})};
  const lotsOn = new Set(state.dqe?.lotsOff ? groups.map(g => g.code).filter(c => !state.dqe.lotsOff.includes(c)) : groups.map(g => g.code));
  const loc = state.site?.label || '';
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Métré</span><h3 class="ed-t2">Exporter le DQE</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body dqe-x"><section>
      <div class="fields"><label class="f wide"><span>Titre du document</span><span class="in"><input id="dxT" type="text" value="${esc(state.dqe?.title || 'DQE · ' + state.name)}" style="font-family:var(--f-body)"></span></label>
        <label class="f"><span>Maître d'ouvrage</span><span class="in"><input id="dxMo" type="text" value="${esc(state.dqe?.mo || '')}" style="font-family:var(--f-body)"></span></label>
        <label class="f"><span>Rédigé par</span><span class="in"><input id="dxBy" type="text" value="${esc(state.dqe?.by || '')}" style="font-family:var(--f-body)"></span></label>
        <label class="f"><span>TVA</span><span class="in"><select id="dxTva">${[20, 10, 5.5, 0].map(t => `<option value="${t}"${(state.dqe?.tva ?? 20) == t ? ' selected' : ''}>${nf(t, 1)} %</option>`).join('')}</select></span></label>
        <label class="f"><span>Format</span><span class="in"><select id="dxF"><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF (impression)</option><option value="csv">CSV</option></select></span></label></div>
      ${loc ? `<p class="hint">Lieu : ${esc(loc)}</p>` : ''}
      <div class="grp"><h3>Lots inclus</h3><div class="dx-lots">${groups.map(g => `<label class="ap-check2"><input type="checkbox" data-dxlot="${g.code}"${lotsOn.has(g.code) ? ' checked' : ''}> <b>${g.code}</b> ${esc(g.name)} <em>${g.items.length} art.</em></label>`).join('')}</div></div>
    </section><section><div class="grp" style="margin-top:0"><h3>Afficher</h3>${DQE_OPTS.map(([k, n]) => `<label class="ap-check2"><input type="checkbox" data-dxo="${k}"${o[k] ? ' checked' : ''}> ${n}</label>`).join('')}</div></section></div>
    <footer class="ed-f"><span class="hint">${items.length} articles · ${groups.length} lots</span><button class="btn" data-close>Annuler</button><button class="btn primary" id="dxGo">Exporter</button></footer>`, 'mid');
  d.querySelector('#dxGo').onclick = () => {
    const opts = {}; d.querySelectorAll('[data-dxo]').forEach(c => opts[c.dataset.dxo] = c.checked);
    const off = [...d.querySelectorAll('[data-dxlot]')].filter(c => !c.checked).map(c => c.dataset.dxlot);
    state.dqe = {...(state.dqe || {}), pu:state.dqe?.pu || {}, opts, lotsOff:off, title:d.querySelector('#dxT').value.trim(), mo:d.querySelector('#dxMo').value.trim(), by:d.querySelector('#dxBy').value.trim(), tva:+d.querySelector('#dxTva').value};
    save(); const fmt = d.querySelector('#dxF').value; closeEDlg(); doExport('dqe', fmt);
  };
}

/* ---------- construction des tableaux ---------- */
function dqeTable(){
  const D = state.dqe || {}, o = {...Object.fromEntries(DQE_OPTS.map(([k, , d]) => [k, d])), ...(D.opts || {})}, off = new Set(D.lotsOff || []), tva = D.tva ?? 20;
  const items = dqeItems().filter(i => !off.has(i.lot)), groups = o.lots ? dqeGroups(items) : [{code:'', name:'', items, total:items.reduce((s, i) => s + i.total, 0)}];
  const lv = o.levels ? state.levels.map((l, i) => [i, l.n]).filter(([i]) => items.some(it => it.byLvl[i])) : [];
  const cols = [o.num && ['N°', 'num'], ['Désignation', 'des'], o.unit && ['U', 'u'], ...lv.map(([i, n]) => [n, 'lvl' + i]), o.qty && ['Qté', 'q'], o.pu && ['PU € HT', 'pu'], o.total && ['Montant € HT', 'tot'], o.pct && o.total && ['% du total', 'pct'], o.mass && ['Masse kg', 'kg'], o.co2 && ['kg CO₂e', 'co2']].filter(Boolean);
  o._ht = groups.reduce((s, g) => s + g.total, 0);
  return {o, tva, items, groups, cols, lv};
}
function dqeCSV(){
  const {o, tva, groups, cols} = dqeTable(), d = v => typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : `"${String(v ?? '').replace(/"/g, '""')}"`, L = [];
  if (o.header) L.push(d(state.dqe?.title || 'DQE'), d(state.name), state.site?.label ? d(state.site.label) : '', d(new Date().toLocaleDateString('fr-FR')), '');
  L.push(cols.map(c => d(c[0])).join(';')); let ht = 0;
  for (const g of groups){
    if (o.lots) L.push(d(`${g.code} ${g.name}`));
    g.items.forEach((it, k) => { ht += it.total; L.push(cols.map(([, key]) => d(cellVal(key, it, g, k, o))).join(';')); });
    if (o.lots && o.subtotal && o.total) L.push(cols.map(([, key]) => key === 'des' ? d(`Sous-total lot ${g.code}`) : key === 'tot' ? d(g.total) : '').join(';'));
  }
  if (o.ttc && o.total) L.push('', `${d('Total HT')};${d(ht)}`, `${d('TVA ' + tva + ' %')};${d(ht * tva / 100)}`, `${d('Total TTC')};${d(ht * (1 + tva / 100))}`);
  return '﻿' + L.join('\r\n');
}
function cellVal(key, it, g, k, o){
  if (key === 'num') return o.lots ? `${g.code}.${k + 1}` : String(k + 1);
  if (key === 'des') return it.des + (o.details && it.det ? ` (${it.det})` : '');
  if (key === 'u') return it.u; if (key === 'q') return round2(it.q); if (key === 'pu') return round2(it.pu); if (key === 'tot') return round2(it.total);
  if (key === 'kg') return Math.round(it.mass); if (key === 'co2') return Math.round(it.co2);
  if (key === 'pct') return o._ht ? Math.round(it.total / o._ht * 1000) / 10 : 0;
  if (key.startsWith('lvl')) return round2(it.byLvl[+key.slice(3)] || 0);
  return '';
}
const round2 = v => Math.round(v * 100) / 100;

/* ---------- Excel (.xlsx) écrit à la main : styles, largeurs, formules (montants recalculés si on change un prix dans Excel) ---------- */
function xlsxEsc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
const colL = i => { let s = ''; i++; while (i > 0){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
function xlsxSheet(rows, widths, merges = []){
  const cell = (c, r, x) => { if (x == null || x === '') return ''; const ref = colL(c) + (r + 1); const o = typeof x === 'object' ? x : {v:x};
    const s = o.s ? ` s="${o.s}"` : '';
    if (o.f) return `<c r="${ref}"${s}><f>${xlsxEsc(o.f)}</f>${o.v != null ? `<v>${o.v}</v>` : ''}</c>`;
    if (typeof o.v === 'number') return `<c r="${ref}"${s}><v>${o.v}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xlsxEsc(o.v)}</t></is></c>`; };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${(r || []).map((x, ci) => cell(ci, ri, x)).join('')}</row>`).join('')}</sheetData>
${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/></worksheet>`;
}
const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>
<fonts count="5"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="15"/><name val="Calibri"/></font><font><sz val="9"/><color rgb="FF6B7280"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2A2E35"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEFF2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F2F9"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FFD5D8DC"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="2" borderId="0" applyFont="1" applyFill="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="3" borderId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="164" fontId="1" fillId="4" borderId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="4" borderId="0" applyFont="1" applyFill="1"/>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function dqeXLSX(){
  const {o, tva, groups, cols} = dqeTable(), rows = [], merges = [], W = cols.length, lastCol = colL(W - 1);
  const ci = k => cols.findIndex(c => c[1] === k);
  if (o.header){
    rows.push([{v:state.dqe?.title || 'DQE', s:2}]); merges.push(`A1:${lastCol}1`);
    const info = [['Projet', state.name], state.site?.label && ['Lieu', state.site.label], state.dqe?.mo && ['Maître d\'ouvrage', state.dqe.mo], state.dqe?.by && ['Rédigé par', state.dqe.by], ['Date', new Date().toLocaleDateString('fr-FR')]].filter(Boolean);
    info.forEach(([a, b]) => rows.push([{v:a, s:9}, {v:b, s:1}]));
    rows.push([{v:'Quantités issues de la maquette ARCHIPLAN ; prix unitaires indicatifs à valider.', s:9}], []);
  }
  rows.push(cols.map(c => ({v:c[0], s:3}))); const head = rows.length;
  const subRefs = [];
  for (const g of groups){
    if (o.lots){ const r = [{v:`${g.code}  ${g.name}`, s:4}]; for (let i = 1; i < W; i++) r.push({v:'', s:4}); rows.push(r); }
    const first = rows.length + 1;
    g.items.forEach((it, k) => {
      const r = cols.map(([, key]) => { const v = cellVal(key, it, g, k, o); return typeof v === 'number' ? {v, s:key === 'pu' || key === 'tot' ? 6 : 5} : {v, s:8}; });
      const iq = ci('q'), ip = ci('pu'), it2 = ci('tot');
      if (it2 >= 0 && iq >= 0 && ip >= 0) r[it2] = {f:`${colL(iq)}${rows.length + 1}*${colL(ip)}${rows.length + 1}`, v:round2(it.total), s:6};
      rows.push(r);
    });
    const last = rows.length, itot = ci('tot');
    if (o.lots && o.subtotal && itot >= 0){ const r = cols.map(() => ({v:'', s:11})); r[ci('des')] = {v:`Sous-total lot ${g.code}`, s:11}; r[itot] = {f:`SUM(${colL(itot)}${first}:${colL(itot)}${last})`, v:round2(g.total), s:10}; rows.push(r); subRefs.push(`${colL(itot)}${rows.length}`); }
    else if (itot >= 0) subRefs.push(`SUM(${colL(itot)}${first}:${colL(itot)}${last})`);
  }
  const itot = ci('tot');
  if (o.ttc && itot >= 0){
    const ht = groups.reduce((s, g) => s + g.total, 0), lab = Math.max(0, itot - 1);
    rows.push([]);
    const line = (txt, f, v) => { const r = []; r[lab] = {v:txt, s:1}; r[itot] = {f, v:round2(v), s:7}; rows.push(r); return `${colL(itot)}${rows.length}`; };
    const hR = line('Total HT', subRefs.join('+') || '0', ht); const tR = line(`TVA ${nf(tva, 1)} %`, `${hR}*${tva / 100}`, ht * tva / 100); line('Total TTC', `${hR}+${tR}`, ht * (1 + tva / 100));
  }
  const widths = cols.map(([, k]) => k === 'des' ? 62 : k === 'num' ? 7 : k === 'u' ? 6 : k === 'tot' || k === 'pu' ? 15 : 11);
  const sheets = [{name:'DQE', xml:xlsxSheet(rows, widths, merges)}];
  if (o.matsheet){
    const q = quantities(), mr = [[{v:'Matériaux', s:2}], [], ['Lot', 'Matériau', 'Volume m³', 'Masse t', 'kg CO₂e'].map(v => ({v, s:3}))];
    for (const lot of LOT_ORDER) for (const r of q.mats.filter(x => x.lot === lot)){ const M = mat(r.mat), ms = r.v * (M.R != null ? 0 : M.rho); mr.push([{v:lot, s:8}, {v:M.nom, s:8}, {v:round2(r.v), s:5}, {v:round2(ms / 1000), s:5}, {v:Math.round(ms * (M.gwp || 0)), s:5}]); }
    sheets.push({name:'Matériaux', xml:xlsxSheet(mr, [22, 40, 12, 12, 12])});
  }
  const files = [
    {name:'[Content_Types].xml', data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`},
    {name:'_rels/.rels', data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:'xl/workbook.xml', data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xlsxEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`},
    {name:'xl/_rels/workbook.xml.rels', data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml', data:XLSX_STYLES},
    ...sheets.map((s, i) => ({name:`xl/worksheets/sheet${i + 1}.xml`, data:s.xml}))];
  return makeZip(files);
}
/* PDF : document HTML mis en page, imprimé par le navigateur (« Enregistrer au format PDF ») */
function dqeHTML(){
  const {o, tva, groups, cols} = dqeTable(), ht = groups.reduce((s, g) => s + g.total, 0), D = state.dqe || {}, today = new Date().toLocaleDateString('fr-FR');
  const logo = document.querySelector('.brand-mark img')?.src || '', site = state.site || {}, wide = cols.length > 7;
  const isN = key => !['des', 'num', 'u'].includes(key);
  const fmt = (key, v) => typeof v === 'number' ? (key === 'pu' || key === 'tot' ? eur(v) : key === 'pct' ? nf(v, 1) + ' %' : nf(v, key === 'kg' || key === 'co2' ? 0 : 2)) : esc(v);
  const cell = (key, it, g, k) => { const v = cellVal(key, it, g, k, o);
    if (key === 'des'){ const d = o.details && it.det ? `<small>${esc(it.det)}</small>` : ''; return `<td class="des">${esc(it.des)}${d}</td>`; }
    return `<td class="${isN(key) ? 'n' : ''} c-${key.replace(/\d+/, '')}">${fmt(key, v)}</td>`; };
  const colgroup = `<colgroup>${cols.map(([, key]) => `<col class="w-${key.replace(/\d+/, '')}">`).join('')}</colgroup>`;
  const thead = `<thead><tr>${cols.map(([n, key]) => `<th class="${isN(key) ? 'n' : ''}">${esc(n)}</th>`).join('')}</tr></thead>`;
  const lotTable = g => `<section class="lot">${o.lots ? `<h2><span class="code">${g.code}</span>${esc(g.name)}${o.total ? `<span class="st">${eur(g.total)} HT</span>` : ''}</h2>` : ''}
    <table class="det">${colgroup}${thead}<tbody>${g.items.map((it, k) => `<tr>${cols.map(([, key]) => cell(key, it, g, k)).join('')}</tr>`).join('')}</tbody>
    ${o.lots && o.subtotal && o.total ? `<tfoot><tr><td colspan="${cols.findIndex(c => c[1] === 'tot')}">Sous-total lot ${g.code} · ${esc(g.name)}</td><td class="n">${eur(g.total)}</td>${cols.slice(cols.findIndex(c => c[1] === 'tot') + 1).map(c => c[1] === 'pct' ? `<td class="n">${ht ? nf(g.total / ht * 100, 1) : '0'} %</td>` : '<td></td>').join('')}</tr></tfoot>` : ''}</table></section>`;
  const info = [['Projet', state.name], site.label && ['Lieu', site.label], site.zone && ['Zone climatique', `${site.zone}${site.alt != null ? ` · altitude ${n0(site.alt)} m` : ''}`], D.mo && ['Maître d\'ouvrage', D.mo], D.by && ['Rédigé par', D.by], ['Date', today]].filter(Boolean);
  const recap = o.recap !== false && o.lots && o.total && groups.length > 1 ? `<section class="recap"><h3>Récapitulatif par lot</h3><table><thead><tr><th>Lot</th><th>Désignation</th><th class="n">Articles</th><th class="n">Montant € HT</th>${o.pct ? '<th class="n">Part</th>' : ''}</tr></thead><tbody>
    ${groups.map(g => `<tr><td class="code2">${g.code}</td><td>${esc(g.name)}</td><td class="n">${g.items.length}</td><td class="n">${eur(g.total)}</td>${o.pct ? `<td class=\"n\"><span class=\"bar\"><i style="width:${ht ? Math.round(g.total / ht * 100) : 0}%"></i></span>${ht ? nf(g.total / ht * 100, 1) : '0'} %</td>` : ''}</tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="3">Total HT</td><td class="n">${eur(ht)}</td>${o.pct ? '<td class="n">100 %</td>' : ''}</tr></tfoot></table></section>` : '';
  const totals = o.ttc && o.total ? `<table class="tot"><tr><td>Total HT</td><td class="n">${eur(ht)}</td></tr><tr><td>TVA ${nf(tva, 1)} %</td><td class="n">${eur(ht * tva / 100)}</td></tr><tr class="ttc"><td>Total TTC</td><td class="n">${eur(ht * (1 + tva / 100))}</td></tr></table>` : '';
  const sign = o.sign ? `<div class="sign"><div><b>Le maître d'ouvrage</b><span>${esc(D.mo || '')}</span><em>Date, mention « Bon pour accord » et signature</em></div><div><b>L'entreprise</b><span></span><em>Date, cachet et signature</em></div></div>` : '';
  const title = esc(D.title || 'DQE · ' + state.name);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>
    @page{size:A4 ${wide ? 'landscape' : 'portrait'};margin:20mm 15mm 22mm 20mm;@bottom-left{content:"${title.replace(/"/g, '')}";font:8pt Arial,sans-serif;color:#8A8F98}@bottom-right{content:"Page " counter(page) " / " counter(pages);font:8pt Arial,sans-serif;color:#8A8F98}}
    *{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{margin:0;font:9.5pt/1.4 Inter,"Segoe UI",Arial,sans-serif;color:#1D2026}
    .hd{display:flex;align-items:center;gap:14px;padding-bottom:12px;border-bottom:2px solid #1D2026}
    .hd img{width:44px;height:44px;border-radius:10px}.hd .t{flex:1}.hd .k{font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:#6B7079;font-weight:700}
    .hd h1{margin:2px 0 0;font-size:18pt;line-height:1.15;letter-spacing:-.01em}.hd .r{text-align:right;font-size:8.5pt;color:#6B7079}.hd .r b{display:block;font-size:13pt;color:#1D2026}
    .info{display:grid;grid-template-columns:repeat(${info.length === 4 ? 4 : Math.min(3, info.length)},1fr);gap:0;margin:14px 0 18px;border:1px solid #DADDE2;border-radius:8px;overflow:hidden}
    .info{margin:14px 0 18px}.info div{padding:8px 11px;border-right:1px solid #DADDE2;border-bottom:1px solid #DADDE2}.info span{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.08em;color:#7A7F88;font-weight:700}.info b{font-weight:600}
    h3{font-size:10.5pt;margin:0 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#4A4F57}
    table{width:100%;border-collapse:collapse}th{font-size:7.8pt;text-transform:uppercase;letter-spacing:.05em;color:#5C616A;text-align:left;padding:5px 6px;border-bottom:1.5px solid #1D2026;font-weight:700}
    td{padding:5px 6px;border-bottom:1px solid #E6E8EB;vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    thead{display:table-header-group}tfoot{display:table-row-group}tr{break-inside:avoid}
    .recap{margin-bottom:20px;break-inside:avoid}.recap tbody tr:nth-child(even) td{background:#F6F7F8}.recap tfoot td{font-weight:800;border-top:1.5px solid #1D2026;border-bottom:0;font-size:10.5pt}
    .code2{font-weight:700;color:#6B7079;width:40px}.bar{display:inline-block;width:46px;height:5px;background:#E6E8EB;border-radius:3px;margin-right:6px;vertical-align:middle;overflow:hidden}.bar i{display:block;height:100%;background:#E2861B}
    .lot{margin-top:16px}.lot h2{display:flex;align-items:center;gap:9px;margin:0 0 2px;padding:7px 10px;background:#1D2026;color:#fff;font-size:10.5pt;border-radius:6px 6px 0 0;break-after:avoid}
    .lot h2 .code{background:#E2861B;color:#fff;border-radius:4px;padding:1px 6px;font-size:9pt}.lot h2 .st{margin-left:auto;font-weight:600;font-size:9.5pt;opacity:.9}
    td.des small{display:block;color:#7A7F88;font-size:8pt;margin-top:1px}td.c-num{color:#6B7079;white-space:nowrap}td.c-tot{font-weight:600}
    .det tbody tr:nth-child(even) td{background:#FAFAFB}.det tfoot td{font-weight:700;background:#F1F2F4;border-bottom:0}
    col.w-num{width:44px}col.w-u{width:34px}col.w-q,col.w-pu,col.w-lvl{width:62px}col.w-tot{width:84px}col.w-kg,col.w-co2{width:62px}col.w-pct{width:58px}td.c-pct{color:#6B7079}
    .end{display:flex;gap:18px;align-items:flex-start;margin-top:18px;break-inside:avoid}.end .note{flex:1;color:#6B7079;font-size:8pt;margin:0}
    .tot{width:290px;border:1.5px solid #1D2026;border-radius:8px;border-collapse:separate;overflow:hidden}.tot td{border-bottom:1px solid #E6E8EB;padding:7px 10px;font-weight:600}.tot .ttc td{background:#1D2026;color:#fff;font-size:12pt;font-weight:800;border:0}
    .sign{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px;break-inside:avoid}.sign div{border:1px solid #DADDE2;border-radius:8px;padding:10px 12px;height:110px;display:flex;flex-direction:column}.sign span{color:#4A4F57}.sign em{margin-top:auto;font-size:7.5pt;color:#8A8F98}
    .foot{margin-top:14px;font-size:7.5pt;color:#9A9FA7;text-align:center}</style></head><body>
    ${o.header ? `<header class="hd">${logo ? `<img src="${logo}" alt="">` : ''}<div class="t"><div class="k">Détail quantitatif estimatif</div><h1>${title}</h1></div>${o.total ? `<div class="r">Montant ${o.ttc ? 'TTC' : 'HT'}<b>${eur(o.ttc ? ht * (1 + tva / 100) : ht)}</b>${groups.length} lot${groups.length > 1 ? 's' : ''} · ${groups.reduce((s, g) => s + g.items.length, 0)} articles</div>` : ''}</header>
    <div class="info">${info.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
    ${recap}${groups.map(lotTable).join('')}
    <div class="end"><p class="note">Quantités issues de la maquette numérique ARCHIPLAN (ouvertures déduites, rampants en vraie grandeur). Prix unitaires indicatifs en euros hors taxes, à valider par les entreprises. Document non contractuel.</p>${totals}</div>
    ${sign}<p class="foot">Établi avec ARCHIPLAN · Studio Prism · ${today}</p></body></html>`;
}
function printDqe(){
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  f.srcdoc = dqeHTML(); f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){ toast('Impression impossible dans ce navigateur'); } setTimeout(() => f.remove(), 60000); };
}
