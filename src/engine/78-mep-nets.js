/* ============ Génération des réseaux (eau, évacuations, électricité, ventilation, chauffage) ============
   À partir des composants techniques placés (à la main ou automatiquement). Cheminements : horizontaux en plancher (eau, chauffage, évacuations)
   ou sous plafond (câbles, gaines), verticaux dans des gaines techniques ; tracé orthogonal (parallèle aux murs). Règles : voir 76-mep.js. */
const mepRun = (a, b, z, z2) => { const p = [[a[0], a[1], z]]; if (Math.abs(a[0] - b[0]) > 1e-3 && Math.abs(a[1] - b[1]) > 1e-3) p.push([b[0], a[1], z + (z2 - z) * 0.5]); p.push([b[0], b[1], z2]); return p; };   // L : x puis y
const lvH = i => mepCeilH(i);   // hauteur du plafond (haut des murs) au-dessus de la cote du niveau
function mepGenerateNets(){
  const E = mepEls(); if (!E.length){ toast('Placez d\'abord des équipements techniques'); return; }
  const rooms = mepRooms(), roomOf = e => rooms.find(r => r.lvl === e.lvl && ptInPoly(e.c[0], e.c[1], r.poly)), kindR = e => roomOf(e)?.kind || 'autre';
  const rep = {warn:[], sys:{}}, nets = [], add = (sys, lvl, pts, d, label, o = {}) => { const p = pts.filter((q, i) => i === 0 || Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1], q[2] - pts[i - 1][2]) > 1e-4); if (p.length < 2) return;
    nets.push({kind:'net', sys, lvl, pts:p.map(q => q.map(v => Math.round(v * 1000) / 1000)), d, ...(o.sec ? {sec:o.sec} : {}), label, note:o.note || '', auto:true}); };
  const by = k => E.filter(e => mepKindOf(e) === k), zf = i => lvlZ(i) + mepFloorOff(i);   // sol fini
  const zh = e => { const F = fam(e.fam), s = famScope(F, e); return s.zh ?? s.hc ?? 0; };
  const ceilZ = i => lvlZ(i) + lvH(i) - 0.2;   // cheminement sous plafond (dans le plénum ou les combles), jamais en travers des baies
  const near = (from, list) => { const out = [], rest = list.slice(); let c = from; while (rest.length){ let bi = 0, bd = 1e9; rest.forEach((e, i) => { const d = Math.abs(e.c[0] - c[0]) + Math.abs(e.c[1] - c[1]); if (d < bd){ bd = d; bi = i; } }); c = rest[bi].c; out.push(rest.splice(bi, 1)[0]); } return out; };

  /* ---------------- Électricité ---------------- */
  const tab = by('tableau')[0]; let nCirc = 0, kVA = 0, circ = [];
  if (tab){
    const T = tab.c, Tz = zf(tab.lvl), roomOfEl = e => rooms.find(r => r.lvl === e.lvl && ptInPoly(e.c[0], e.c[1], r.poly));
    const ceilEls = k => by(k), bylvl = list => { const m = {}; list.forEach(e => (m[e.lvl] ??= []).push(e)); return m; };
    const circuit = (label, sec, amp, els, kind, o = {}) => {
      if (!els.length) return; const rg = famScope(fam(tab.fam), tab).rg || 3; let pts = [[T[0], T[1], Tz + (zh(tab) || 1) + 0.15 * rg + 0.2]], cur = T, lvl = els[0].lvl; const zr0 = ceilZ(tab.lvl);
      pts.push([T[0], T[1], zr0]); let zr = zr0;
      for (const e of near(T, els)){ const nz = ceilZ(e.lvl); if (nz !== zr){ pts.push([cur[0], cur[1], zr], [cur[0] === T[0] ? T[0] : cur[0], cur[1], nz]); zr = nz; }
        const wallDev = !['lum', 'spot', 'daaf', 'vmc', 'vext'].includes(mepKindOf(e)), zd = wallDev ? zf(e.lvl) + (zh(e) || 0.3) : zr + 0.15;
        pts.push(...mepRun(cur, e.c, zr, zr).slice(1), [e.c[0], e.c[1], zd], [e.c[0], e.c[1], zr]); cur = e.c; }
      const n = o.n ?? els.length; add('elec', lvl, pts, 12, label, {sec, note:`${amp} A · ${sec} mm² · ${n} point${n > 1 ? 's' : ''}`}); circ.push({label, sec, amp, n, kind, ...o}); };
    /* éclairage : chaque pièce est commandée par ses interrupteurs (le circuit passe par eux) ; les DAAF sont autonomes (à piles), hors circuit */
    const withSwitches = list => { const out = [], done = new Set(); for (const e of list){ const R = roomOfEl(e); if (R && !done.has(R.key)){ done.add(R.key); out.push(...by('inter').filter(s => s.lvl === e.lvl && ptInPoly(s.c[0], s.c[1], R.poly))); } out.push(e); } return out; };
    const chunks = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
    for (const [li, L] of Object.entries(bylvl([...ceilEls('lum'), ...ceilEls('spot'), ...ceilEls('applique')]))) chunks(near(T, L), 8).forEach((c, i) => circuit(`Éclairage ${state.levels[li].n} ${i + 1}`, 1.5, 16, withSwitches(c), 'light', {n:c.length}));
    const pr = by('prise'); const kit = pr.filter(e => kindR(e) === 'cuisine'), oth = pr.filter(e => kindR(e) !== 'cuisine');
    chunks(near(T, kit), 6).forEach((c, i) => circuit(`Prises cuisine ${i + 1}`, 2.5, 20, c, 'plug'));
    for (const [li, L] of Object.entries(bylvl(oth))) chunks(near(T, L), 12).forEach((c, i) => circuit(`Prises ${state.levels[li].n} ${i + 1}`, 2.5, 20, c, 'plug'));
    by('plaque').forEach(e => circuit('Plaque de cuisson', 6, 32, [e], 'plaque'));
    const LBL = ['Four', 'Lave-vaisselle', 'Lave-linge', 'Sèche-linge', 'Congélateur'], sp = by('spec'); let ik = 0;
    sp.forEach(e => { const k = kindR(e); const l = k === 'cuisine' ? (ik++ % 2 ? 'Lave-vaisselle' : 'Four') : (ik++ % 2 ? 'Sèche-linge' : 'Lave-linge'); circuit(`${l} (circuit spécialisé)`, 2.5, 20, [e], 'spec'); });
    by('ll').forEach(e => circuit('Lave-linge (circuit spécialisé)', 2.5, 20, [e], 'spec'));
    by('ballon').forEach(e => circuit('Chauffe-eau', 2.5, 20, [e], 'spec'));
    by('vmc').forEach(e => circuit('VMC', 1.5, 2, [e], 'vmc'));
    by('pac').forEach(e => { const kW = famScope(fam(e.fam), e).kW || 8; circuit('Générateur de chauffage', kW > 9 ? 10 : 6, kW > 9 ? 40 : 32, [e], 'pac'); });
    const rad = by('rad').filter(e => (e.type | 0) >= 4 || mepRadElec()), seche = by('seche');
    if (rad.length || seche.length){ const all = near(T, [...rad, ...seche]); let acc = [], P = 0; const flush = () => { if (acc.length) circuit(`Chauffage électrique ${circ.filter(c => c.kind === 'heat').length + 1}`, 1.5, 16, acc, 'heat'); acc = []; P = 0; };
      all.forEach(e => { const w = famScope(fam(e.fam), e).W || 750; if (P + w > 3500) flush(); acc.push(e); P += w; }); flush(); }
    /* protection différentielle 30 mA (NF C 15-100) : selon la surface, 1 (≤ 35 m²), 2 (≤ 100 m²) ou 3 interrupteurs de type AC, plus au moins 1 de type A pour la plaque de cuisson et le lave-linge ;
       8 circuits au plus par interrupteur différentiel ; type F conseillé pour une pompe à chaleur (édition 2024) */
    nCirc = circ.length; const shab0 = rooms.reduce((t, r) => t + r.net, 0), isA = c => c.kind === 'plaque' || /Lave-linge/.test(c.label), nA = circ.filter(isA).length, hasPac = circ.some(c => c.kind === 'pac');
    const idA = Math.max(1, Math.ceil(nA / 8)), idF = hasPac ? 1 : 0, idAC = Math.max(shab0 <= 35 ? 1 : shab0 <= 100 ? 2 : 3, Math.ceil((nCirc - nA - (hasPac ? 1 : 0)) / 8)), nID = idAC + idA + idF;
    const mods = Math.ceil((nCirc + nID * 2 + 2) * 1.2), rows = Math.max(2, Math.ceil(mods / 13));
    tab.params = {...(tab.params || {}), rg:rows}; tab.type = rows <= 2 ? 1 : rows === 3 ? 0 : 2;
    const pw = circ.reduce((t, c) => t + (c.kind === 'plaque' ? 7000 : c.kind === 'light' ? 200 : c.kind === 'heat' ? 3000 : c.kind === 'pac' ? 4000 : c.kind === 'vmc' ? 30 : 1500), 0), shab = rooms.reduce((t, r) => t + r.net, 0);
    kVA = by('rad').some(e => (e.type | 0) >= 4) ? (shab > 100 ? 15 : 12) : shab < 60 ? 6 : shab < 100 ? 9 : 12;
    rep.sys.elec = {title:'Électricité', lines:[`${nCirc} circuits : ${circ.filter(c => c.kind === 'light').length} éclairage (1,5 mm², 16 A, 8 points max.), ${circ.filter(c => c.kind === 'plug').length} prises (2,5 mm², 20 A, 12 max. ; 6 max. en cuisine), ${circ.filter(c => !['light', 'plug'].includes(c.kind)).length} spécialisés/dédiés`,
      `Tableau : ${nID} interrupteurs différentiels 30 mA : ${idAC} de type AC, ${idA} de type A (au moins un exigé, il protège la plaque de cuisson et le lave-linge)${idF ? ', 1 de type F (pompe à chaleur)' : ''} · 8 circuits au plus par différentiel · ${mods} modules avec 20 % de réserve → ${rows} rangée${rows > 1 ? 's' : ''} de 13 modules, organes de commande entre 0,90 et 1,80 m du sol`,
      `${by('inter').length} interrupteur${by('inter').length > 1 ? 's' : ''} raccordé${by('inter').length > 1 ? 's' : ''} aux circuits d'éclairage · ${by('daaf').length} détecteur${by('daaf').length > 1 ? 's' : ''} de fumée autonome${by('daaf').length > 1 ? 's' : ''} (à piles, non raccordé${by('daaf').length > 1 ? 's' : ''})${by('rj45').length ? ` · ${by('rj45').length} prise${by('rj45').length > 1 ? 's' : ''} RJ45 à relier au coffret de communication (non tracé)` : ''}`, `Puissance à souscrire indicative : ${kVA} kVA`, `Sections : éclairage 1,5 mm² · prises et circuits spécialisés 2,5 mm² · plaque de cuisson 6 mm² (32 A)`]};
  } else rep.warn.push('Aucun tableau électrique placé : les circuits ne sont pas générés (ajoutez un tableau).');

  /* ---------------- Plomberie ---------------- */
  const wps = E.filter(e => WATER_PTS[mepKindOf(e)]), src = by('arrivee')[0] || by('ballon')[0], bal = by('ballon')[0];
  if (wps.length){
    if (!src) rep.warn.push('Aucune arrivée d\'eau ni ballon : eau froide et chaude non générées.');
    else { const S = src.c, s0 = zf(src.lvl);
      if (bal && src !== bal) add('ef', src.lvl, [[S[0], S[1], s0 + 0.6], [S[0], S[1], s0 - 0.04], ...mepRun(S, bal.c, s0 - 0.04, s0 - 0.04).slice(1), [bal.c[0], bal.c[1], zf(bal.lvl) + 0.15]], 20, 'Alimentation ballon', {note:'Ø20 PER'});
      if (!bal && wps.some(e => WATER_PTS[mepKindOf(e)][1] != null)) rep.warn.push('Aucun ballon d\'eau chaude : l\'eau chaude n\'est pas tracée (ajoutez un ballon ou un chauffe-eau).');
      const B = bal ? bal.c : S;
      for (const e of near(S, wps)){ const k = mepKindOf(e), [hEF, hECS, , dA] = WATER_PTS[k], zr = zf(e.lvl) - 0.04, P = e.c;   // PER sous fourreau dans la chape
        const up = e.lvl !== src.lvl ? [[S[0], S[1], s0 - 0.04], [S[0], S[1], zr]] : [];
        add('ef', e.lvl, [[S[0], S[1], s0 - 0.04], ...up.slice(1), ...mepRun(up.length ? S : S, P, zr, zr).slice(up.length ? 0 : 1), [P[0], P[1], zf(e.lvl) + hEF]], dA, `${MEP_LABEL[k]}`, {note:`PER Ø${dA} · eau froide`});
        if (hECS != null && bal){ const o = 0.05; add('ecs', e.lvl, [[B[0] + o, B[1] + o, zf(bal.lvl) + 0.15], [B[0] + o, B[1] + o, zr], ...mepRun([B[0] + o, B[1] + o], [P[0] + o, P[1] + o], zr, zr).slice(1), [P[0] + o, P[1] + o, zf(e.lvl) + hECS]], dA, `${MEP_LABEL[k]}`, {note:`PER Ø${dA} · eau chaude, à 2 cm de l'eau froide minimum`}); } }
      rep.sys.plomb = {title:'Plomberie (alimentation)', lines:[`${wps.length} points d'eau · PER Ø12 (lavabo, évier, WC, lave-linge) et Ø16 (douche, baignoire, ballon) · eau chaude séparée de l'eau froide`, bal ? `Ballon d'eau chaude : ${famScope(fam(bal.fam), bal).V || 200} l (base : 50 à 60 l par occupant et par jour)` : 'Pas de ballon placé']}; }
    // évacuations : chute au WC (sinon au premier appareil), pente 2 cm/m (≥ 1 cm/m exigé), collecteur Ø100 vers l'extérieur
    const stack = (wps.find(e => mepKindOf(e) === 'wc' && e.lvl === 0) || wps.find(e => e.lvl === 0) || wps[0]).c, sl = 0.02, W0 = state.els.filter(w => w.kind === 'wall' && w.lvl === 0);
    const xs = W0.flatMap(w => [w.a[0], w.b[0]]), ys = W0.flatMap(w => [w.a[1], w.b[1]]);
    const out = xs.length ? (() => { const d = [[stack[0] - Math.min(...xs), [Math.min(...xs) - 1.5, stack[1]]], [Math.max(...xs) - stack[0], [Math.max(...xs) + 1.5, stack[1]]], [stack[1] - Math.min(...ys), [stack[0], Math.min(...ys) - 1.5]], [Math.max(...ys) - stack[1], [stack[0], Math.max(...ys) + 1.5]]].sort((a, b) => a[0] - b[0]); return d[0][1]; })() : [stack[0] + 3, stack[1]];
    let zmin = 1e9; const top = Math.max(...wps.map(e => e.lvl));
    for (const e of wps){ const k = mepKindOf(e), P = e.c, Ld = Math.abs(P[0] - stack[0]) + Math.abs(P[1] - stack[1]), D = WATER_PTS[k][2] < 100 && Ld > 4 ? 50 : WATER_PTS[k][2] /* branche longue (> 4 m) : Ø50 */, z0 = zf(e.lvl) - 0.1, run = mepRun(P, stack, z0, z0), L = Math.abs(P[0] - stack[0]) + Math.abs(P[1] - stack[1]), zEnd = z0 - Math.max(L * sl, 0.01);
      const pts = [[P[0], P[1], zf(e.lvl) + 0.05], [P[0], P[1], z0], ...mepRun(P, stack, z0, zEnd).slice(1)]; if (D === 50) rep.warn.push(`${MEP_LABEL[k]} : branche d'évacuation de ${nf(L, 1)} m portée en Ø50 ; rapprocher l'appareil de la chute reste préférable.`);
      add('eu', e.lvl, pts, D, MEP_LABEL[k], {note:`PVC Ø${D} · pente ${nf(sl * 100, 0)} % (≥ 1 % exigé)${D === 50 ? ' · branche longue portée en Ø50' : ''}`}); if (e.lvl === 0) zmin = Math.min(zmin, zEnd); else zmin = Math.min(zmin, zf(0) - 0.2); }
    const zc = (isFinite(zmin) ? zmin : zf(0) - 0.2) - 0.05, Lc = Math.abs(out[0] - stack[0]) + Math.abs(out[1] - stack[1]);
    if (top > 0) add('eu', top, [[stack[0], stack[1], zf(top) - 0.1], [stack[0], stack[1], zc]], 100, 'Chute d\'eaux usées', {note:'PVC Ø100 · chute verticale en gaine technique'});
    add('eu', 0, [[stack[0], stack[1], zc], ...mepRun(stack, out, zc, zc - Lc * sl).slice(1)], 100, 'Collecteur vers l\'extérieur', {note:`PVC Ø100 · pente ${nf(sl * 100, 0)} % · regard de branchement en limite de bâtiment`});
    add('eu', top, [[stack[0], stack[1], zf(top) + 0.05], [stack[0], stack[1], lvlZ(top) + lvH(top) + 0.6]], 100, 'Ventilation primaire', {note:'Ø100 prolongée au-dessus de la toiture (DTU 60.11)'});
    (rep.sys.plomb ??= {title:'Plomberie', lines:[]}).lines.push(`Évacuations : chute Ø100 ${top > 0 ? 'sur ' + (top + 1) + ' niveaux ' : ''}+ collecteur Ø100 à ${nf(sl * 100, 0)} % (minimum réglementaire 1 %), branches Ø40 (lavabo, douche, baignoire, évier, lave-linge) et Ø100 (WC), ventilation primaire Ø100`);
  }

  /* ---------------- Ventilation ---------------- */
  const vm = by('vmc')[0], vx = by('vext');
  if (vx.length && vm){
    const nPP = Math.max(1, rooms.filter(mepIsMain).length), minTot = mepVentFlows(nPP).tot;   // pièces principales : séjour, chambres, bureau
    let tot = 0; const Zc = zf(vm.lvl) + (famScope(fam(vm.fam), vm).zh || 2.1) + 0.15, Vc = vm.c;
    for (const e of vx){ const q = famScope(fam(e.fam), e).q || 15, D = q <= 45 ? 80 : q <= 135 ? 125 : 160, zr = lvlZ(e.lvl) + lvH(e.lvl) - 0.1; tot += q;
      const pts = [[e.c[0], e.c[1], zr], ...mepRun(e.c, Vc, zr, zr).slice(1)]; if (e.lvl !== vm.lvl) pts.push([Vc[0], Vc[1], zr], [Vc[0], Vc[1], Zc]); else pts.push([Vc[0], Vc[1], Zc]);
      add('vmc', e.lvl, pts, D, `Extraction ${q} m³/h`, {note:`Gaine Ø${D} · ${q} m³/h`}); }
    const Dr = tot <= 150 ? 125 : tot <= 250 ? 160 : 200; add('vmc', vm.lvl, [[Vc[0], Vc[1], Zc], [Vc[0], Vc[1], (() => { const t = Math.max(...vx.map(e => e.lvl), vm.lvl); return lvlZ(t) + lvH(t) + 0.8; })()]], Dr, `Rejet ${tot} m³/h`, {note:`Rejet en toiture Ø${Dr}`});
    rep.sys.vent = {title:'Ventilation', lines:[`${vx.length} bouches d'extraction · débit total ${tot} m³/h (minimum réglementaire ≈ ${minTot} m³/h pour ${nPP} pièce${nPP > 1 ? 's' : ''} principale${nPP > 1 ? 's' : ''}, arrêté du 24 mars 1982)`, `Gaines Ø80 (salle de bain, WC), Ø125 (cuisine), rejet Ø${Dr} en toiture ; entrées d'air dans les pièces principales : ${by('ventree').length}`]};
    if (tot < minTot) rep.warn.push(`Débit d'extraction ${tot} m³/h inférieur au minimum ≈ ${minTot} m³/h.`);
    if (!by('ventree').length) rep.warn.push('Aucune entrée d\'air dans les pièces principales : à prévoir (menuiseries ou murs).');
  } else if (vx.length) rep.warn.push('Bouches d\'extraction sans caisson VMC : ventilation non générée.');

  /* ---------------- Chauffage hydraulique ---------------- */
  const gen = by('pac')[0], rads = by('rad').filter(e => (e.type | 0) < 4).concat(by('seche'));
  if (gen && rads.length && !by('rad').some(e => (e.type | 0) >= 4)){
    const G = gen.c; let P = 0;
    for (const e of near(G, rads)){ const zr = zf(e.lvl) - 0.04, w = famScope(fam(e.fam), e).W || 750; P += w;
      for (const [o, lab] of [[0.03, 'Départ'], [-0.03, 'Retour']]){ const pts = [[G[0] + o, G[1] + o, zf(gen.lvl) + 0.3], ...(e.lvl !== gen.lvl ? [[G[0] + o, G[1] + o, zr]] : [[G[0] + o, G[1] + o, zr]]), ...mepRun([G[0] + o, G[1] + o], [e.c[0] + o, e.c[1] + o], zr, zr).slice(1), [e.c[0] + o, e.c[1] + o, zf(e.lvl) + 0.3]]; add('chauf', e.lvl, pts, 16, `${lab} ${MEP_LABEL[mepKindOf(e)]}`, {note:`PER Ø16 · ${w} W`}); } }
    const kW = famScope(fam(gen.fam), gen).kW || 8;
    rep.sys.chauf = {title:'Chauffage', lines:[`${rads.length} émetteurs · ${nf(P / 1000, 1)} kW installés · générateur ${kW} kW ${P / 1000 > kW ? '(INSUFFISANT : choisir un générateur plus puissant)' : '(suffisant)'} · départs et retours PER Ø16`]};
    if (P / 1000 > kW) rep.warn.push(`Générateur de ${kW} kW inférieur à la puissance installée (${nf(P / 1000, 1)} kW).`);
  }
  /* tronçons hors du bâtiment (arrivée d'eau au compteur, générateur extérieur…) : enterrés hors gel (eau, chauffage ≈ 0,80 m), câbles à 0,50 m sous fourreau */
  const inside0 = rooms.filter(r => r.lvl === 0 && r.kind !== 'ext'), isIn = q => !inside0.length || inside0.some(r => ptInPoly(q[0], q[1], r.poly) || dPoly(q, r.poly) < 0.4);
  for (const n of nets){ if (n.lvl !== 0 || !['ef', 'ecs', 'chauf', 'elec'].includes(n.sys)) continue; const zb = lvlZ(0) - (n.sys === 'elec' ? 0.5 : 0.8), P = n.pts, out = [];
    for (let i = 0; i < P.length; i++){ const q = P[i], qin = isIn(q);
      if (i){ const pr = P[i - 1], pin = isIn(pr); if (pin !== qin){ let a = 0, b = 1; for (let k = 0; k < 14; k++){ const m = (a + b) / 2, x = [pr[0] + (q[0] - pr[0]) * m, pr[1] + (q[1] - pr[1]) * m]; if (isIn(x) === pin) a = m; else b = m; }
        const x = [pr[0] + (q[0] - pr[0]) * a, pr[1] + (q[1] - pr[1]) * a].map(v => Math.round(v * 1000) / 1000), zi = pin ? pr[2] : q[2]; out.push(pin ? [x[0], x[1], zi] : [x[0], x[1], zb], pin ? [x[0], x[1], zb] : [x[0], x[1], zi]); } }
      out.push(qin ? q : [q[0], q[1], zb]); }
    if (out.some((q, i) => q[2] !== P[i]?.[2] || out.length !== P.length)){ n.pts = out.filter((q, i) => i === 0 || Math.hypot(q[0] - out[i - 1][0], q[1] - out[i - 1][1], q[2] - out[i - 1][2]) > 1e-4); n.note += ` · tronçon extérieur enterré à ${nf(lvlZ(0) - zb, 2)} m${n.sys === 'elec' ? ' sous fourreau rouge' : ' hors gel, grillage avertisseur'}`; } }
  pushHist(); state.isSample = false; state.els = state.els.filter(e => !(e.kind === 'net' && e.auto));
  for (const n of nets){ n.id = state.nextId++; state.els.push(n); }
  rebuild(); toast(`${nets.length} tronçons de réseau générés`); mepReport(rep, nets);
}
const mepRadElec = () => false;
function mepReport(rep, nets){
  const len = s => nets.filter(n => n.sys === s).reduce((t, n) => t + netLen(n), 0);
  const rows = Object.entries(NET_SYS).map(([k, S]) => { const l = len(k); return l ? `<tr><td>${S.n}</td><td class="n">${nets.filter(n => n.sys === k).length}</td><td class="n">${nf(l, 1)} m</td></tr>` : ''; }).join('');
  openEDlg(`<header class="ed-h"><div><span class="eyebrow">Équipements techniques</span><h3 class="ed-t2">Réseaux générés</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><section><table class="tbl"><thead><tr><th>Réseau</th><th class="n">Tronçons</th><th class="n">Longueur</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Aucun réseau généré</td></tr>'}</tbody></table>
      ${Object.values(rep.sys).map(s => `<div class="grp"><h3>${esc(s.title)}</h3><ul class="warns">${s.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`).join('')}
      ${rep.warn.length ? `<div class="grp"><h3>Points d'attention</h3><ul class="warns">${rep.warn.map(l => `<li class="bad">${esc(l)}</li>`).join('')}</ul></div>` : ''}
      <p class="hint">Cheminements simplifiés (tracé orthogonal, passage à travers les cloisons par fourreaux) : à valider par un bureau d'études, un électricien et un plombier. Les tronçons sont comptés au DQE (lots Plomberie, Électricité, Ventilation, Chauffage).</p></section></div>
    <footer class="ed-f"><button class="btn primary" data-close>Fermer</button></footer>`, 'mid');
}
