/* ============ Génération des réseaux (eau, évacuations, électricité, ventilation, chauffage) ============
   À partir des composants techniques placés (à la main ou automatiquement). Cheminements calculés par 77b-mep-route.js (référentiel ArchiPlan) :
   - eau froide, eau chaude, évacuations, chauffage : au sol (chape ou terre-plein), en pieuvre depuis une nourrice ou un collecteur,
     d'une pièce à l'autre sous les portes ; remontée verticale dans le mur sous l'appareil ;
   - électricité et communication : en pieuvre depuis le tableau et le coffret (un conduit par point), en partie haute le long des murs,
     descente verticale dans le mur jusqu'à l'appareil ;
   - seuls sortent du bâtiment : arrivée d'eau, arrivée électrique, arrivée télécom, collecteur EU / EV vers le regard, liaison de la PAC (CH-02).
   Chaque tronçon est contrôlé (CH-01, EU-01, PL-04, EL-03, EL-09) et le rapport donne un statut final (document fondateur, partie 15). */
const lvH = i => mepCeilH(i);   // hauteur du plafond (haut des murs) au-dessus de la cote du niveau
function mepGenerateNets(){
  const E = mepEls(); if (!E.length){ toast('Placez d\'abord des équipements techniques'); return; }
  const rooms = mepRooms(), roomOf = e => rooms.find(r => r.lvl === e.lvl && ptInPoly(e.c[0], e.c[1], r.poly)), kindR = e => roomOf(e)?.kind || 'autre';
  const rep = {warn:[], sys:{}}, nets = [], add = (sys, lvl, pts, d, label, o = {}) => { const p = pts.filter((q, i) => i === 0 || Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1], q[2] - pts[i - 1][2]) > 1e-4); if (p.length < 2) return;
    nets.push({kind:'net', sys, lvl, pts:p.map(q => q.map(v => Math.round(v * 1000) / 1000)), d, ...(o.sec ? {sec:o.sec} : {}), ...(o.ext ? {ext:true} : {}), label, note:o.note || '', auto:true}); };
  const by = k => E.filter(e => mepKindOf(e) === k), zf = i => lvlZ(i) + mepFloorOff(i);   // sol fini
  const zh = e => { const F = fam(e.fam), s = famScope(F, e); return s.zh ?? s.hc ?? 0; };
  const hasAbove = i => rooms.some(r => r.lvl === i + 1), hiZ = i => hasAbove(i) ? lvlZ(i) + lvH(i) - 0.12 : lvlZ(i) + lvH(i) + 0.05;   // faux plafond, sinon combles (au-dessus des murs)
  const ceilZ = hiZ, floorZ = i => zf(i) - 0.04;   // réseaux d'eau et de chauffage sous fourreau dans la chape
  const DJ = {}, dj = (lvl, mode, lane, from) => DJ[[lvl, mode, lane, from.map(v => v.toFixed(2))].join('|')] ??= mepDijkstra(lvl, mode, lane, from);
  const at = (P, z) => P.map(q => [q[0], q[1], z]);
  const flags = {floor:{clo:0, por:0, door:0}, high:{clo:0, por:0, door:0}};
  /* chemin intérieur sur un niveau ; null (et bloquant CH-01) s'il n'existe pas */
  const route = (lvl, mode, lane, from, to, label) => { const r = mepPathTo(dj(lvl, mode, lane, from), to);
    if (!r){ rep.block.push(`${label} : aucun cheminement intérieur trouvé (CH-01) ; tronçon non généré.`); return null; }
    const F = flags[mode]; F.clo += r.clo; F.por += r.por; F.door += r.door; return r; };
  rep.block = []; rep.ctl = []; rep.miss = [];
  const near = (from, list) => { const out = [], rest = list.slice(); let c = from; while (rest.length){ let bi = 0, bd = 1e9; rest.forEach((e, i) => { const d = Math.abs(e.c[0] - c[0]) + Math.abs(e.c[1] - c[1]); if (d < bd){ bd = d; bi = i; } }); c = rest[bi].c; out.push(rest.splice(bi, 1)[0]); } return out; };

  /* ---------------- Électricité ---------------- */
  const tab = by('tableau')[0]; let nCirc = 0, kVA = 0, circ = [];
  if (tab){
    const T = tab.c, Tz = zf(tab.lvl), roomOfEl = e => rooms.find(r => r.lvl === e.lvl && ptInPoly(e.c[0], e.c[1], r.poly));
    const ceilEls = k => by(k), bylvl = list => { const m = {}; list.forEach(e => (m[e.lvl] ??= []).push(e)); return m; };
    const circuit = (label, sec, amp, els, kind, o = {}) => { if (!els.length) return; const n = o.n ?? els.length; circ.push({label, sec, amp, n, kind, els, ...o}); };
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
    /* pieuvre : un conduit ICTA par point, depuis le tableau, en partie haute le long des murs (couloir à 15 cm du mur),
       descente verticale dans le mur jusqu'à l'appareil ; un appareil d'un autre niveau monte par la gaine technique (à l'aplomb du tableau) */
    const Ttop = Tz + (zh(tab) || 1) + 0.15 * rows + 0.1, ceilDev = k => ['lum', 'spot', 'vmc', 'vext'].includes(k);
    const pieuvre = (sys, e, lane, z0, xy0, label, o) => { const k = mepKindOf(e), zH = hiZ(e.lvl), zd = ceilDev(k) ? zH - 0.05 : zf(e.lvl) + (zh(e) || 0.3);
      /* appareil posé dehors (unité extérieure de PAC…) : le conduit s'arrête derrière le mur, une courte liaison le traverse (CH-02) */
      const g = mepGrid(e.lvl), fx = g && !g.inside(e.c) ? mepNearestFacade(e.lvl, e.c) : null, tg = fx ? V.sub(fx.foot, V.mul(fx.nOut, fx.T / 2 + 0.15)) : e.c;
      const r = route(e.lvl, 'high', lane, xy0, tg, label); if (!r) return null;
      const pts = [[xy0[0], xy0[1], z0], [xy0[0], xy0[1], hiZ(tab.lvl)]]; if (e.lvl !== tab.lvl) pts.push([xy0[0], xy0[1], zH]);
      pts.push(...at(r.pts, zH).slice(1), [tg[0], tg[1], zd]); add(sys, e.lvl, pts, sys === 'com' ? 20 : 16, label, o);
      if (fx) add(sys, e.lvl, [[tg[0], tg[1], zd], [e.c[0], e.c[1], zd]], sys === 'com' ? 20 : 16, `${label} · traversée du mur`, {...o, note:`${o.note || ''} · traversée du mur extérieur sous fourreau calfeutré, câble adapté à l'extérieur`, ext:true});
      return r; };
    let nCond = 0; for (const c of circ) for (const e of c.els){ if (mepKindOf(e) === 'daaf') continue;
      if (pieuvre('elec', e, 0.15, Ttop, T, `${c.label} · ${MEP_LABEL[mepKindOf(e)] || 'point'}`, {sec:c.sec, note:`${c.amp} A · ${c.sec} mm² · conduit ICTA Ø16 en pieuvre depuis le tableau`})) nCond++; }
    /* communication : un câble par prise RJ45, en étoile depuis le coffret de communication (au-dessus du tableau), dans son propre conduit Ø20 (EL-07, EL-10) */
    const rj = by('rj45'), Cz = Ttop + 0.25, Cxy = [T[0], T[1]]; let comL = 0;
    near(T, rj).forEach((e, i) => { const r = pieuvre('com', e, 0.35, Cz, Cxy, `RJ45 ${i + 1} (${roomOfEl(e)?.name || state.levels[e.lvl].n})`, {note:'câble 4 paires catégorie 6, grade 2TV · conduit Ø20 séparé des courants forts'});
      if (r) comL = Math.max(comL, r.len + (hiZ(e.lvl) - Cz) + (hiZ(e.lvl) - zf(e.lvl))); });
    /* arrivées : câble du distributeur et fourreau télécom, enterrés, entrés sous le dallage jusqu'à la gaine technique (CH-02, CH-04) */
    const fa = mepNearestFacade(tab.lvl, T);
    if (fa && tab.lvl === 0){ const o = V.add(fa.foot, V.mul(fa.nOut, fa.T / 2 + 1.5)), zb = lvlZ(0) - 0.5;
      add('elec', 0, [[o[0], o[1], zb], [T[0], T[1], zb], [T[0], T[1], Tz + (zh(tab) || 1)]], 32, 'Arrivée électrique (depuis le coffret en limite de propriété)', {sec:16, note:'câble du distributeur sous fourreau rouge, grillage avertisseur rouge 20 cm au-dessus (NF C 15-520) · profondeur 0,50 m estimée', ext:true});
      const o2 = V.add(o, V.mul([-fa.nOut[1], fa.nOut[0]], 0.1)), T2 = V.add(Cxy, V.mul([-fa.nOut[1], fa.nOut[0]], 0.1));
      add('com', 0, [[o2[0], o2[1], zb], [T2[0], T2[1], zb], [T2[0], T2[1], Cz]], 42, 'Arrivée télécom (depuis la chambre de tirage)', {note:'fourreau télécom, grillage avertisseur vert · profondeur 0,50 m estimée', ext:true}); }
    rep.ctl.push(['EL-01', `${nCond} conduits en pieuvre : horizontaux en partie haute, descentes verticales dans les murs, jamais en biais`, 'à vérifier']);
    const shabC = rooms.reduce((t, r) => t + r.net, 0), needC = mepRj45Total(shabC);
    if (rj.length) rep.comLine = [`${rj.length} prise${rj.length > 1 ? 's' : ''} RJ45 câblée${rj.length > 1 ? 's' : ''} en étoile depuis le coffret de communication (grade 2TV, au-dessus du tableau) · câble le plus long ${nf(comL, 1)} m`];
    if (rj.length < needC) rep.warn.push(`Communication : ${rj.length} prise${rj.length > 1 ? 's' : ''} RJ45 pour ${needC} exigées (NF C 15-100 : 2 dans le séjour, ${needC} au total pour ${n0(shabC)} m²).`);
    if (comL > 45) rep.warn.push(`Communication : un câble RJ45 mesure ${nf(comL, 1)} m ; au-delà d'environ 45 m le débit baisse, rapprochez le coffret.`);
    const pw = circ.reduce((t, c) => t + (c.kind === 'plaque' ? 7000 : c.kind === 'light' ? 200 : c.kind === 'heat' ? 3000 : c.kind === 'pac' ? 4000 : c.kind === 'vmc' ? 30 : 1500), 0), shab = rooms.reduce((t, r) => t + r.net, 0);
    kVA = by('rad').some(e => (e.type | 0) >= 4) ? (shab > 100 ? 15 : 12) : shab < 60 ? 6 : shab < 100 ? 9 : 12;
    rep.sys.elec = {title:'Électricité', lines:[`${nCirc} circuits : ${circ.filter(c => c.kind === 'light').length} éclairage (1,5 mm², 16 A, 8 points max.), ${circ.filter(c => c.kind === 'plug').length} prises (2,5 mm², 20 A, 12 max. ; 6 max. en cuisine), ${circ.filter(c => !['light', 'plug'].includes(c.kind)).length} spécialisés/dédiés`,
      `Tableau : ${nID} interrupteurs différentiels 30 mA : ${idAC} de type AC, ${idA} de type A (au moins un exigé, il protège la plaque de cuisson et le lave-linge)${idF ? ', 1 de type F (pompe à chaleur)' : ''} · 8 circuits au plus par différentiel · ${mods} modules avec 20 % de réserve → ${rows} rangée${rows > 1 ? 's' : ''} de 13 modules, organes de commande entre 0,90 et 1,80 m du sol`,
      `Distribution en pieuvre : ${nCond} conduits, un par point, depuis le tableau · ${by('inter').length} interrupteur${by('inter').length > 1 ? 's' : ''} raccordé${by('inter').length > 1 ? 's' : ''} aux circuits d'éclairage · ${by('daaf').length} détecteur${by('daaf').length > 1 ? 's' : ''} de fumée autonome${by('daaf').length > 1 ? 's' : ''} (à piles, non raccordé${by('daaf').length > 1 ? 's' : ''})`, `Puissance à souscrire indicative : ${kVA} kVA`, `Sections : éclairage 1,5 mm² · prises et circuits spécialisés 2,5 mm² · plaque de cuisson 6 mm² (32 A)`]};
    if (rep.comLine) rep.sys.com = {title:'Communication', lines:rep.comLine};
  } else rep.warn.push('Aucun tableau électrique placé : les circuits ne sont pas générés (ajoutez un tableau).');

  /* ---------------- Plomberie ---------------- */
  const wps = E.filter(e => WATER_PTS[mepKindOf(e)]), src = by('arrivee')[0] || by('ballon')[0], bal = by('ballon')[0], PER_DI = {12:0.0098, 16:0.013, 20:0.0162};
  if (wps.length){
    if (!src) rep.warn.push('Aucune arrivée d\'eau ni ballon : eau froide et chaude non générées.');
    else { const S = src.c, s0 = zf(src.lvl), zA = s0 + (zh(src) || 0.6), sL = src.lvl;
      /* branchement : du compteur en limite de propriété à l'arrivée, enterré hors gel, entré sous le dallage (CH-02, CH-03) */
      const fa = by('arrivee')[0] && mepNearestFacade(sL, S);
      if (fa && sL === 0){ const o = V.add(fa.foot, V.mul(fa.nOut, fa.T / 2 + 1.5)), zb = lvlZ(0) - 0.8;
        add('ef', 0, [[o[0], o[1], zb], [S[0], S[1], zb], [S[0], S[1], zA]], 25, 'Branchement d\'eau (depuis le compteur)', {note:'PEHD Ø25 sous fourreau, grillage avertisseur bleu · profondeur hors gel 0,80 m estimée (à confirmer selon le gestionnaire)', ext:true}); }
      /* nourrices : eau froide à l'arrivée, eau chaude au ballon ; un tube PER par appareil, sans raccord noyé (PL-02) */
      const tube = (sys, from, zFrom, e, zTo, lane, D, label, note) => { const r = route(e.lvl, 'floor', lane, from, e.c, label); if (!r) return null;
        const pts = [[from[0], from[1], zFrom], [from[0], from[1], floorZ(e.lvl)], ...at(r.pts, floorZ(e.lvl)).slice(1), [e.c[0], e.c[1], zTo]]; add(sys, e.lvl, pts, D, label, {note}); return r; };
      if (bal && src !== bal) tube('ef', S, zA, bal, zf(bal.lvl) + 0.15, 0.15, 20, 'Alimentation ballon', 'PER Ø20 sous fourreau · depuis la nourrice d\'eau froide');
      if (!bal && wps.some(e => WATER_PTS[mepKindOf(e)][1] != null)) rep.warn.push('Aucun ballon d\'eau chaude : l\'eau chaude n\'est pas tracée (ajoutez un ballon ou un chauffe-eau).');
      let vMax = 0, vWho = '';
      for (const e of near(S, wps)){ const k = mepKindOf(e), [hEF, hECS, , dA] = WATER_PTS[k];
        if (e.lvl !== sL){ rep.warn.push(`${MEP_LABEL[k]} (${state.levels[e.lvl].n}) : alimentation d'un autre niveau non tracée (colonne montante à prévoir).`); continue; }
        tube('ef', S, zA, e, zf(e.lvl) + hEF, 0.15, dA, MEP_LABEL[k], `PER Ø${dA} sous fourreau · eau froide, depuis la nourrice`);
        if (hECS != null && bal){ const r = tube('ecs', bal.c, zf(bal.lvl) + 0.15, e, zf(e.lvl) + hECS, 0.25, dA, MEP_LABEL[k], `PER Ø${dA} sous fourreau · eau chaude, depuis la nourrice du ballon`);
          if (r){ const L = r.len + (zf(bal.lvl) + 0.15 - floorZ(e.lvl)) + hECS + 0.04, v = Math.PI * (PER_DI[dA] || 0.0098) ** 2 / 4 * L * 1000; if (v > vMax){ vMax = v; vWho = MEP_LABEL[k]; } } } }
      rep.sys.plomb = {title:'Plomberie (alimentation)', lines:[`${wps.length} points d'eau en pieuvre : nourrice d'eau froide à l'arrivée${bal ? ', nourrice d\'eau chaude au ballon' : ''}, un tube PER sous fourreau par appareil, dans la chape, passant sous les portes`, `PER Ø12 (lavabo, évier, WC, lave-linge) et Ø16 (douche, baignoire) : diamètres de repérage, non calculés (pression disponible inconnue)`, bal ? `Ballon d'eau chaude : ${famScope(fam(bal.fam), bal).V || 200} l (repère : 50 à 60 l par occupant)` : 'Pas de ballon placé', 'Eau chaude : 50 °C au plus aux points de puisage des pièces de toilette, 60 °C ailleurs (arrêté du 30 novembre 2005) : mitigeur thermostatique ou limiteur à prévoir']};
      if (bal){ rep.ctl.push(['PL-04', `Volume d'eau chaude le plus long : ${nf(vMax, 2)} l (${vWho})${vMax > 3 ? ' : plus de 3 l, l\'eau doit rester à 50 °C au moins dans le réseau (tubes finaux ≤ 3 l) ou le ballon doit être rapproché' : ' : 3 l au plus'}`, 'vérifiée']);
        if (vMax > 3) rep.warn.push(`Eau chaude : ${nf(vMax, 2)} l entre le ballon et ${vWho} (plus de 3 l, arrêté du 30 novembre 2005) : rapprochez le ballon ou maintenez 50 °C dans le réseau.`); }
      rep.miss.push('Pression disponible au compteur (diamètres d\'eau non dimensionnés)'); }
    /* évacuations : EU (eaux ménagères) et EV (WC) au sol, en pente vers une sortie unique vers le regard (CH-02, EU-01, EU-02) */
    const wc0 = wps.find(e => mepKindOf(e) === 'wc' && e.lvl === 0) || wps.find(e => e.lvl === 0) || wps[0], sl = 0.02, fx = mepNearestFacade(0, wc0.c);
    if (!fx) rep.block.push('Évacuations : aucun mur extérieur trouvé pour la sortie vers le regard ; non générées.');
    else { const xin = V.sub(fx.foot, V.mul(fx.nOut, fx.T / 2 + 0.2)), xout = V.add(fx.foot, V.mul(fx.nOut, fx.T / 2 + 1.5)), stack = wc0.c, top = Math.max(...wps.map(e => e.lvl));
      let zmin = 1e9, nOk = 0;
      for (const e of wps){ const k = mepKindOf(e), sys = k === 'wc' ? 'ev' : 'eu', D = WATER_PTS[k][2], z0 = zf(e.lvl) - 0.1;
        if (e.lvl !== 0){ const r = route(e.lvl, 'floor', 0.3, stack, e.c, MEP_LABEL[k]); if (!r) continue; const L = r.len, pts = [[e.c[0], e.c[1], zf(e.lvl) + 0.05], [e.c[0], e.c[1], z0]];
          r.pts.slice().reverse().forEach((q, i, A) => { const l = A.slice(0, i + 1).reduce((t, w, j) => j ? t + Math.hypot(w[0] - A[j - 1][0], w[1] - A[j - 1][1]) : 0, 0); pts.push([q[0], q[1], z0 - l * sl]); });
          add(sys, e.lvl, pts, D, MEP_LABEL[k], {note:`PVC Ø${D} · pente ${nf(sl * 100, 0)} % retenue (à confirmer, NF DTU 60.11 P2) · vers la chute`}); nOk++; continue; }
        const r = route(0, 'floor', 0.3, xin, e.c, MEP_LABEL[k]); if (!r) continue;
        const A = r.pts.slice().reverse(), pts = [[e.c[0], e.c[1], zf(0) + 0.05]]; let l = 0;
        A.forEach((q, i) => { if (i) l += Math.hypot(q[0] - A[i - 1][0], q[1] - A[i - 1][1]); pts.push([q[0], q[1], z0 - l * sl]); });
        zmin = Math.min(zmin, z0 - l * sl); add(sys, 0, pts, D, MEP_LABEL[k], {note:`PVC Ø${D} · ${sys === 'ev' ? 'eaux vannes' : 'eaux ménagères'} · pente ${nf(sl * 100, 0)} % retenue (à confirmer, NF DTU 60.11 P2)`}); nOk++; }
      if (top > 0){ const zt = zf(0) - 0.2; add('eu', top, [[stack[0], stack[1], zf(top) - 0.1], [stack[0], stack[1], zt]], 100, 'Chute d\'eaux usées', {note:'PVC Ø100 · chute verticale en gaine technique'});
        const r = route(0, 'floor', 0.3, xin, stack, 'Chute d\'eaux usées'); if (r){ const A = r.pts.slice().reverse(); let l = 0; const pts = A.map((q, i) => { if (i) l += Math.hypot(q[0] - A[i - 1][0], q[1] - A[i - 1][1]); return [q[0], q[1], zt - l * sl]; }); zmin = Math.min(zmin, zt - l * sl); add('eu', 0, pts, 100, 'Pied de chute', {note:'PVC Ø100 · vers la sortie'}); } }
      const zc = (isFinite(zmin) ? zmin : zf(0) - 0.2) - 0.02, Lc = Math.hypot(xout[0] - xin[0], xout[1] - xin[1]);
      add('eu', 0, [[xin[0], xin[1], zc], [xout[0], xout[1], zc - Lc * sl]], 100, 'Collecteur EU / EV vers le regard', {note:`PVC Ø100 · pente ${nf(sl * 100, 0)} % retenue · traverse le mur sous le dallage · regard de branchement à l'extérieur`, ext:true});
      add('eu', top, [[stack[0], stack[1], zf(top) + 0.05], [stack[0], stack[1], lvlZ(top) + lvH(top) + 0.6]], 100, 'Ventilation primaire', {note:'Ø100 prolongée à l\'air libre au-dessus de la toiture (NF DTU 60.11)'});
      (rep.sys.plomb ??= {title:'Plomberie', lines:[]}).lines.push(`Évacuations : ${nOk} branches au sol vers une sortie unique (collecteur Ø100 vers le regard), eaux vannes (WC) et eaux ménagères distinguées, ventilation primaire Ø100 ; pente ${nf(sl * 100, 0)} % retenue, à confirmer avec la table du NF DTU 60.11 P2`, 'Eaux pluviales non tracées : type de réseau (séparatif ou unitaire) et règles du gestionnaire inconnus');
      rep.miss.push('Type de réseau d\'assainissement (séparatif ou unitaire) et prescriptions du gestionnaire', 'Table de pentes et de diamètres du NF DTU 60.11 P2'); }
  }

  /* ---------------- Ventilation ---------------- */
  const vm = by('vmc')[0], vx = by('vext');
  if (vx.length && vm){
    const nPP = Math.max(1, rooms.filter(mepIsMain).length), minTot = mepVentFlows(nPP).tot;   // pièces principales : séjour, chambres, bureau
    let tot = 0; const Zc = zf(vm.lvl) + (famScope(fam(vm.fam), vm).zh || 2.1) + 0.15, Vc = vm.c;
    for (const e of vx){ const q = famScope(fam(e.fam), e).q || 15, D = q <= 45 ? 80 : q <= 135 ? 125 : 160, zr = hiZ(e.lvl) + 0.1; tot += q;
      const r = route(e.lvl, 'high', 0.6, Vc, e.c, `Extraction ${q} m³/h`); if (!r) continue;
      const pts = [[Vc[0], Vc[1], Zc], [Vc[0], Vc[1], zr], ...at(r.pts, zr).slice(1), [e.c[0], e.c[1], hiZ(e.lvl) - 0.05]];
      add('vmc', e.lvl, pts, D, `Extraction ${q} m³/h`, {note:`Gaine Ø${D} · ${q} m³/h · ${hasAbove(e.lvl) ? 'en faux plafond' : 'dans les combles, isolée'}`}); }
    const Dr = tot <= 150 ? 125 : tot <= 250 ? 160 : 200; add('vmc', vm.lvl, [[Vc[0], Vc[1], Zc], [Vc[0], Vc[1], (() => { const t = Math.max(...vx.map(e => e.lvl), vm.lvl); return lvlZ(t) + lvH(t) + 0.8; })()]], Dr, `Rejet ${tot} m³/h`, {note:`Rejet en toiture Ø${Dr}`});
    rep.sys.vent = {title:'Ventilation', lines:[`${vx.length} bouches d'extraction · débit total ${tot} m³/h (minimum réglementaire ≈ ${minTot} m³/h pour ${nPP} pièce${nPP > 1 ? 's' : ''} principale${nPP > 1 ? 's' : ''}, arrêté du 24 mars 1982)`, `Gaines Ø80 (salle de bain, WC), Ø125 (cuisine), rejet Ø${Dr} en toiture ; entrées d'air dans les pièces principales : ${by('ventree').length}`]};
    if (tot < minTot) rep.warn.push(`Débit d'extraction ${tot} m³/h inférieur au minimum ≈ ${minTot} m³/h.`);
    if (!by('ventree').length) rep.warn.push('Aucune entrée d\'air dans les pièces principales : à prévoir (menuiseries ou murs).');
  } else if (vx.length) rep.warn.push('Bouches d\'extraction sans caisson VMC : ventilation non générée.');

  /* ---------------- Chauffage hydraulique ---------------- */
  const gen = by('pac')[0], rads = by('rad').filter(e => (e.type | 0) < 4).concat(by('seche'));
  if (gen && rads.length && !by('rad').some(e => (e.type | 0) >= 4)){
    const g0 = mepGrid(gen.lvl), outside = g0 && !g0.inside(gen.c); let Cc = gen.c; const zG = zf(gen.lvl) + 0.3;
    /* PAC air / eau dehors : liaison courte qui traverse le mur derrière l'unité, collecteur juste derrière le mur (CHF-01) */
    if (outside){ const fa = mepNearestFacade(gen.lvl, gen.c);
      if (fa){ Cc = V.sub(fa.foot, V.mul(fa.nOut, fa.T / 2 + 0.25)); for (const [o, lab] of [[0.06, 'Départ'], [-0.06, 'Retour']]){ const t = [-fa.nOut[1] * o, fa.nOut[0] * o];
        add('chauf', gen.lvl, [[gen.c[0] + t[0], gen.c[1] + t[1], zG], [fa.foot[0] + t[0], fa.foot[1] + t[1], zG], [Cc[0] + t[0], Cc[1] + t[1], zG]], 25, `Liaison PAC · ${lab.toLowerCase()}`, {note:'PER ou multicouche Ø25 isolé · traversée du mur sous fourreau calfeutré · longueur maximale selon la notice de la PAC', ext:true}); } } }
    let P = 0, nOk = 0;
    for (const e of near(Cc, rads)){ const w = famScope(fam(e.fam), e).W || 750; P += w;
      if (e.lvl !== gen.lvl){ rep.warn.push(`${MEP_LABEL[mepKindOf(e)]} (${state.levels[e.lvl].n}) : émetteur d'un autre niveau non raccordé (colonne à prévoir).`); continue; }
      for (const [lane, lab] of [[0.4, 'Départ'], [0.5, 'Retour']]){ const r = route(e.lvl, 'floor', lane, Cc, e.c, `${lab} ${MEP_LABEL[mepKindOf(e)]}`); if (!r) continue;
        add('chauf', e.lvl, [[Cc[0], Cc[1], zG], [Cc[0], Cc[1], floorZ(e.lvl) - 0.02], ...at(r.pts, floorZ(e.lvl) - 0.02).slice(1), [e.c[0], e.c[1], zf(e.lvl) + 0.3]], 16, `${lab} ${MEP_LABEL[mepKindOf(e)]}`, {note:`PER Ø16 sous fourreau, en pieuvre depuis le collecteur · ${w} W`}); }
      nOk++; }
    const kW = famScope(fam(gen.fam), gen).kW || 8;
    rep.sys.chauf = {title:'Chauffage', lines:[`${nOk} émetteurs raccordés en pieuvre depuis un collecteur${outside ? ' placé derrière le mur de la PAC (liaison courte à travers le mur)' : ''} · ${nf(P / 1000, 1)} kW installés · générateur ${kW} kW ${P / 1000 > kW ? '(INSUFFISANT : choisir un générateur plus puissant)' : '(suffisant d\'après les puissances saisies)'} · départs et retours PER Ø16, diamètres de repérage non calculés`]};
    if (P / 1000 > kW) rep.warn.push(`Générateur de ${kW} kW inférieur à la puissance installée (${nf(P / 1000, 1)} kW).`);
    rep.miss.push('Besoins thermiques par pièce (NF EN 12831) : puissances des émetteurs estimées à la surface');
  }
  /* ---------------- Contrôles (référentiel ArchiPlan) ---------------- */
  // CH-01 : aucun réseau intérieur hors du bâtiment ; un tronçon fautif n'est pas généré
  let nOut = 0; for (let i = nets.length - 1; i >= 0; i--){ const n = nets[i]; if (n.ext || /Ventilation primaire|Rejet/.test(n.label)) continue; const g = mepGrid(n.lvl); if (!g) continue; let bad = false;
    for (let k = 0; k + 1 < n.pts.length && !bad; k++){ const a = n.pts[k], b = n.pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / 0.05));
      for (let j = 0; j <= m; j++){ const q = [a[0] + (b[0] - a[0]) * j / m, a[1] + (b[1] - a[1]) * j / m], c = g.cellOf(q); if (c < 0 || g.kind[c] === MG_OUT){ bad = true; break; } } }
    if (bad){ nOut++; rep.block.push(`${NET_SYS[n.sys]?.n} « ${n.label} » : sort du bâtiment (CH-01) ; tronçon non généré.`); nets.splice(i, 1); } }
  rep.ctl.unshift(['CH-01', nOut ? `${nOut} tronçon${nOut > 1 ? 's' : ''} hors du bâtiment, non généré${nOut > 1 ? 's' : ''}` : `${nets.filter(n => !n.ext).length} tronçons intérieurs, aucun hors du bâtiment`, 'principe'],
    ['CH-02', `${nets.filter(n => n.ext).length} tronçons extérieurs : arrivées (eau, électricité, télécom), collecteur EU / EV, liaison PAC`, 'à vérifier']);
  rep.ctl.push(['PL-02', `Réseaux au sol (eau, chauffage, évacuations) : ${flags.floor.door} passages sous une porte${flags.floor.clo ? `, ${flags.floor.clo} sous une cloison faute de porte sur le trajet (fourreau sous la cloison)` : ', aucun sous une cloison'}`, 'à vérifier'], ['CH-03', `Réseaux en partie haute (électricité, communication, ventilation) : ${flags.high.clo} traversées de cloison${flags.high.por ? `, ${flags.high.por} de mur porteur` : ''}`, 'à vérifier']);
  if (flags.high.por) rep.warn.push(`${flags.high.por} traversée${flags.high.por > 1 ? 's' : ''} de mur porteur en faux plafond : réservation à prévoir et à faire valider (document fondateur 4.3).`);
  // EU-01 : pente continue, sans contre-pente
  let cp = 0; for (const n of nets) if ((n.sys === 'eu' || n.sys === 'ev') && !/Ventilation primaire|Chute/.test(n.label)) for (let k = 1; k + 1 < n.pts.length; k++) if (n.pts[k + 1][2] > n.pts[k][2] + 1e-4){ cp++; rep.block.push(`Évacuation « ${n.label} » : contre-pente (EU-01).`); break; }
  rep.ctl.push(['EU-01', cp ? `${cp} contre-pente${cp > 1 ? 's' : ''}` : 'Pente continue vers la sortie sur toutes les branches', 'à vérifier']);
  // EL-03 : descente dans un mur extérieur sans doublage (saignée dans la structure porteuse)
  const mepWallAt = e => state.els.filter(w => w.kind === 'wall' && w.lvl === e.lvl && !wallArc(w)).map(w => ({w, d:segClosest(e.c, w.a, w.b)})).map(o => ({...o, dd:V.len(V.sub(o.d.pt, e.c))})).filter(o => o.dd < wallT(o.w) / 2 + 0.12).sort((a, b) => a.dd - b.dd)[0]?.w;
  const noDoub = new Set(); for (const e of E){ const k = mepKindOf(e); if (!MEP_ELEC_WALL.has(k) && k !== 'applique') continue; const w = mepWallAt(e); if (!w || mepIsCloison(w)) continue;
    const L = (compo(w.type)?.layers || []).map(l => l[0]); if (!L.some(m => /ba13|laine|plaque|placo/.test(m))) noDoub.add(compo(w.type)?.nom || w.type); }
  if (noDoub.size) rep.warn.push(`Appareils sur un mur porteur sans doublage (${[...noDoub].join(', ')}) : pas de saignée dans le béton ; prévoir une goulotte, une plinthe technique ou un doublage (EL-03).`);
  rep.ctl.push(['EL-03', noDoub.size ? `${noDoub.size} type${noDoub.size > 1 ? 's' : ''} de mur porteur sans doublage reçoivent des appareils` : 'Descentes dans les cloisons ou dans le doublage des murs extérieurs', 'à vérifier']);
  // EL-09 : descente électrique à moins de 10 cm d'une remontée d'eau (bonne pratique)
  const vert = sys => nets.filter(n => sys.includes(n.sys)).flatMap(n => n.pts.slice(1).filter((q, i) => Math.hypot(q[0] - n.pts[i][0], q[1] - n.pts[i][1]) < 1e-3 && Math.abs(q[2] - n.pts[i][2]) > 0.3).map(q => ({q, lvl:n.lvl})));
  const ve = vert(['elec']), vw = vert(['ef', 'ecs']); let close = 0; for (const a of ve) if (vw.some(b => b.lvl === a.lvl && Math.hypot(a.q[0] - b.q[0], a.q[1] - b.q[1]) < 0.1)) close++;
  rep.ctl.push(['EL-09', close ? `${close} descente${close > 1 ? 's' : ''} électrique${close > 1 ? 's' : ''} à moins de 10 cm d'une remontée d'eau` : 'Électricité en partie haute, eau au sol : aucun voisinage à moins de 10 cm', 'bonne pratique']);
  if (close) rep.warn.push(`${close} descente${close > 1 ? 's' : ''} électrique${close > 1 ? 's' : ''} à moins de 10 cm d'une remontée d'eau : écarter ou protéger (bonne pratique, EL-09).`);
  rep.miss.push('Profondeur hors gel locale (branchements estimés à 0,80 m pour l\'eau, 0,50 m pour les câbles)', 'Puissances réelles des appareils (sections et protections forfaitaires, sans chute de tension)');
  pushHist(); state.isSample = false; state.els = state.els.filter(e => !(e.kind === 'net' && e.auto));
  for (const n of nets){ n.id = state.nextId++; state.els.push(n); }
  rebuild(); toast(`${nets.length} tronçons de réseau générés`); mepReport(rep, nets);
}
const mepRadElec = () => false;
function mepReport(rep, nets){
  const len = s => nets.filter(n => n.sys === s).reduce((t, n) => t + netLen(n), 0), block = rep.block || [], ctl = rep.ctl || [], miss = [...new Set(rep.miss || [])];
  const rows = Object.entries(NET_SYS).map(([k, S]) => { const l = len(k); return l ? `<tr><td>${S.n}</td><td class="n">${nets.filter(n => n.sys === k).length}</td><td class="n">${nf(l, 1)} m</td></tr>` : ''; }).join('');
  /* statut final (document fondateur, partie 15) : jamais « conforme » tant qu'une règle reste à vérifier ou qu'une donnée manque */
  const nc = block.filter(b => /contre-pente/.test(b)).length, st = nc ? ['NON CONFORME', 'bad'] : block.length || miss.length || ctl.some(c => c[2] !== 'vérifiée' && c[2] !== 'principe') ? ['CONFORMITÉ NON DÉMONTRÉE', 'warn'] : ['CONFORME AUX RÈGLES VÉRIFIÉES', 'ok'];
  const col = {bad:'#B42318', warn:'#B54708', ok:'#067647'}[st[1]];
  openEDlg(`<header class="ed-h"><div><span class="eyebrow">Équipements techniques</span><h3 class="ed-t2">Réseaux générés</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><section>
      <div class="grp" style="margin-top:0"><p style="margin:0 0 4px;font-weight:700;color:${col}" data-mep-statut>Statut : ${st[0]}</p><p class="hint" style="margin:0">${nc ? 'Au moins une règle bloquante n\'est pas respectée.' : block.length ? `${block.length} tronçon${block.length > 1 ? 's n\'ont' : ' n\'a'} pas été généré${block.length > 1 ? 's' : ''} plutôt que de tracer un réseau fautif.` : ''} Les règles « à vérifier » et les données manquantes doivent être confirmées par les professionnels concernés.</p></div>
      <table class="tbl"><thead><tr><th>Réseau</th><th class="n">Tronçons</th><th class="n">Longueur</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Aucun réseau généré</td></tr>'}</tbody></table>
      ${block.length ? `<div class="grp"><h3>Non générés ou bloquants</h3><ul class="warns">${block.map(l => `<li class="bad">${esc(l)}</li>`).join('')}</ul></div>` : ''}
      ${Object.values(rep.sys).map(s => `<div class="grp"><h3>${esc(s.title)}</h3><ul class="warns">${s.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`).join('')}
      ${rep.warn.length ? `<div class="grp"><h3>Points d'attention</h3><ul class="warns">${rep.warn.map(l => `<li class="bad">${esc(l)}</li>`).join('')}</ul></div>` : ''}
      ${ctl.length ? `<div class="grp"><h3>Contrôles effectués</h3><table class="tbl"><thead><tr><th>Règle</th><th>Résultat</th><th>Statut de la règle</th></tr></thead><tbody>${ctl.map(c => `<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${miss.length ? `<div class="grp"><h3>Données manquantes</h3><ul class="warns">${miss.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}
      <p class="hint">Réseaux tracés à l'intérieur du bâtiment : eau, chauffage et évacuations au sol en passant sous les portes, électricité et communication en pieuvre par le plafond avec descentes verticales dans les murs ; seuls les branchements et la liaison de la PAC sortent. Tracé de principe à faire valider par un bureau d'études, un électricien et un plombier. Les tronçons sont comptés au DQE (lots Plomberie, Électricité, Ventilation, Chauffage).</p></section></div>
    <footer class="ed-f"><button class="btn primary" data-close>Fermer</button></footer>`, 'mid');
}
