/* ============ Vérifications du bâtiment : règles étendues (thermique, incendie, acoustique, accessibilité, ventilation, électricité…) ============
   S'ajoute à runChecks() (73-checks.js). Chaque problème : catégorie, texte de référence, correction proposée (appliquée ou assistée).
   Sources (repères indicatifs, à confirmer par un bureau de contrôle) :
   - RE2020 (arrêté du 4 août 2021) : baies ≥ 1/6 de la surface habitable ; parois repères Umur ≈ 0,22, toiture ≈ 0,17, plancher bas ≈ 0,20 W/m²K ;
   - Incendie : DAAF obligatoire (loi du 9 mars 2010, arrêté du 5 février 2013) ; logement individuel : escalier ≥ 0,80 m ;
   - Accessibilité : arrêté du 20 avril 2017 (aire de giration Ø 1,50 m, circulations ≥ 0,90 m, WC et pièce d'eau au niveau d'accès) ;
   - Ventilation : arrêté du 24 mars 1982 (extraction cuisine, salle de bain, WC ; entrées d'air dans les pièces principales) ;
   - Électricité NF C 15-100 : séjour ≥ 5 prises (1 par 4 m² au-delà de 20 m²), chambre ≥ 3, cuisine ≥ 6 dont 4 sur plan de travail, salle d'eau ≥ 2, autres ≥ 1,
     un point lumineux par pièce, tableau avec différentiels 30 mA, circuits spécialisés (four, lave-linge, lave-vaisselle) ;
   - Acoustique : une chambre ne partage pas de cloison légère (Rw < 40 dB) avec une pièce humide ou la cuisine ;
   - Eau chaude : ballon ≈ 50 à 60 l par occupant et par jour (NF C 15-100 / DTU 60.1 pour les réseaux). */
const CHK_CATS = {struct:'Structure', therm:'Thermique RE2020', fire:'Incendie', ac:'Acoustique', pmr:'Accessibilité', safe:'Sécurité', vent:'Ventilation', elec:'Électricité', eau:'Eau et chauffage', conf:'Confort'};
const chkNear = (p, poly) => { let d = 1e9; for (let i = 0; i < poly.length; i++){ const a = poly[i], b = poly[(i + 1) % poly.length]; d = Math.min(d, V.len(V.sub(segClosest(p, a, b).pt, p))); } return d; };
function chkAddMissing(roomKey, kinds, n){
  const O = {...MEP_DEF, sys:{...MEP_DEF.sys}, ...(state.mepOpts || {})}; O.sys = {...MEP_DEF.sys, ...(O.sys || {})};
  const items = mepPropose(O).filter(it => kinds.includes(it.kind) && (roomKey == null || it.room === roomKey)).slice(0, n || 99);
  for (const it of items) state.els.push({kind:'inst', fam:it.fam, type:it.type | 0, params:{...(it.params || {})}, c:it.c.map(v => Math.round(v * 1000) / 1000), rot:it.rot || 0, lvl:it.lvl, off:0, mirror:false, auto:true, room:it.room, id:state.nextId++});
  if (!items.length) throw new Error('rien à ajouter');
}
function runChecksExt(){
  const out = [], E = state.els, lv = i => state.levels[i]?.n || `Niveau ${i}`;
  const add = (id, cat, lvl, title, detail, ref, fix, els = []) => out.push({id, cat, lvl, title, detail, ref, fix, els, key:id + '|' + title});
  let rooms = []; try { rooms = mepRooms().filter(r => r.kind !== 'ext'); } catch(e){}
  const shab = rooms.reduce((t, r) => t + r.net, 0), M = E.filter(e => mepKindOf(e)), has = (r, k) => M.filter(e => mepKindOf(e) === k && e.lvl === r.lvl && ptInPoly(e.c[0], e.c[1], r.poly)).length;
  const glaz = E.filter(e => e.kind === 'inst' && e.host && !/^Portes$/.test(fam(e.fam)?.cat || '') && !/porte(?!-fen)/.test(e.fam || ''));
  const glazOf = e => { const c = famCut(e); return c ? c.w * c.h : 0; };
  const open = (f) => ({open:true, run:f});
  /* ---------- Thermique ---------- */
  const roomAt = (lvl, p) => rooms.find(r => r.lvl === lvl && ptInPoly(p[0], p[1], r.poly));
  const sides = w => { const d = V.sub(w.b, w.a), L = V.len(d) || 1, u = V.mul(d, 1 / L), n = [-u[1], u[0]], m = V.mul(V.add(w.a, w.b), 0.5), t = wallT(w) / 2 + 0.25; return [roomAt(w.lvl, V.add(m, V.mul(n, t))), roomAt(w.lvl, V.sub(m, V.mul(n, t)))]; };
  const isExtW = w => { if (!rooms.length) return /EXT|FAC/i.test(w.type || ''); const [a, b] = sides(w); return !!a !== !!b; };
  const seen = new Set();
  for (const w of E){ if (!(w.kind === 'wall' || w.kind === 'roof') || w.partition) continue; const C = compo(w.type), key = w.kind + w.type; if (seen.has(key)) continue; seen.add(key);
    if (w.kind === 'wall' && !isExtW(w)) continue;
    let U = null; try { U = wallReport(layersInToOut(w), elUse(w)).th.U; } catch(e){ continue; } const g = uGrade(U, elUse(w)), lim = uGradeLimits(elUse(w));
    if (U > lim[2] + 0.005) add('th-' + key, 'therm', 'bad', `${w.kind === 'roof' ? 'Toiture' : 'Mur'} « ${C.nom || w.type} » : U = ${nf(U, 2)} W/m²K`, `Au-dessus du repère RE2020 « correct » (${nf(lim[2], 2)}) : classe ${g.g}. ${g.t}.`, 'RE2020 : parois courantes en neuf ≈ U ≤ 0,22 (mur), 0,17 (toiture) W/m²K ; niveau rénovation ≤ 0,30 / 0,25.', {...open(() => setTimeout(() => openInsulAdjust(w.id), 0)), t:'Ajuster l\'isolant pour atteindre le niveau visé'}, [w.id]);
    else if (U > lim[1] + 0.005) add('th-' + key, 'therm', 'warn', `${w.kind === 'roof' ? 'Toiture' : 'Mur'} « ${C.nom || w.type} » : U = ${nf(U, 2)} W/m²K`, `Niveau ${g.g} : correct en rénovation mais en dessous du repère « neuf RE2020 » (${nf(lim[1], 2)}).`, 'RE2020 : repère neuf U ≈ 0,22 (mur), 0,17 (toiture).', {...open(() => setTimeout(() => openInsulAdjust(w.id), 0)), t:'Renforcer l\'isolant'}, [w.id]); }
  if (shab > 8 && glaz.length){ const ag = glaz.reduce((t, e) => t + glazOf(e), 0);
    if (ag < shab / 6 - 0.01) add('baies', 'therm', 'warn', `Surface vitrée ${nf(ag, 1)} m² pour ${nf(shab, 0)} m² habitables`, `Moins de 1/6 de la surface habitable (${nf(shab / 6, 1)} m² attendus) : confort lumineux et apports solaires insuffisants.`, 'RE2020 / Code de la construction : baies ≥ 1/6 de la surface habitable.', null, glaz.map(e => e.id).slice(0, 1)); }
  /* ---------- Éclairement naturel et surfaces ---------- */
  for (const r of rooms) if (r.kind === 'sejour' || r.kind === 'chambre' || r.kind === 'cuisine'){
    const win = glaz.some(e => { const f = instFrame(e); return f && chkNear(f.o, r.poly) < 0.45 && e.lvl === r.lvl; });
    if (!win && glaz.length) add('lum', 'conf', 'warn', `${r.name} (${lv(r.lvl)}) : aucune fenêtre`, 'Pièce principale sans éclairement naturel ni ouvrant sur l\'extérieur.', 'Décret 2002-120 / RSD : éclairement naturel des pièces principales.', null);
    if (r.kind === 'chambre' && r.net < 7 - 1e-6) add('surf', 'conf', 'warn', `${r.name} : ${nf(r.net, 1)} m²`, 'Pièce principale de moins de 7 m².', 'CCH R111-2 : pièces principales ≥ 7 m² (une au moins de 9 m²).', null); }
  /* ---------- Accessibilité (arrêté du 20 avril 2017) ---------- */
  for (const r of rooms.filter(r => r.lvl === 0)){ const [x0, y0, x1, y1] = polyBox(r.poly), a = Math.min(x1 - x0, y1 - y0), box = (x1 - x0) * (y1 - y0), rect = r.net > box * 0.9;
    if (rect && ['sejour', 'cuisine', 'chambre', 'sdb'].includes(r.kind) && a < 1.5 - 1e-6) add('pmr-g', 'pmr', 'warn', `${r.name} : largeur ${nf(a, 2)} m`, 'Aire de giration Ø 1,50 m impossible au niveau d\'accès.', 'Arrêté du 20 avril 2017 : aire de rotation Ø 1,50 m dans les pièces de vie.', null);
    if (rect && r.kind === 'couloir' && a < 0.9 - 1e-6) add('pmr-c', 'pmr', 'bad', `${r.name} : largeur ${nf(a, 2)} m`, 'Circulation inférieure à 0,90 m.', 'Arrêté du 20 avril 2017 : circulations ≥ 0,90 m.', null); }
  if (rooms.some(r => r.kind === 'wc' || r.kind === 'sdb') || M.length){
    const wc0 = rooms.some(r => r.lvl === 0 && (r.kind === 'wc' || r.kind === 'sdb')); if (!wc0 && rooms.some(r => r.lvl === 0)) add('pmr-wc', 'pmr', 'warn', 'Aucun WC ou salle d\'eau au niveau d\'accès', 'Un WC et une douche accessibles doivent être possibles au niveau d\'entrée du logement.', 'Arrêté du 20 avril 2017 : WC et pièce d\'eau accessibles au niveau d\'accès.', null); }
  /* ---------- Incendie et sécurité ---------- */
  const daaf = M.filter(e => mepKindOf(e) === 'daaf').length;
  if (rooms.length && !daaf) add('daaf', 'fire', 'bad', 'Aucun détecteur de fumée (DAAF)', 'Au moins un détecteur autonome avertisseur de fumée est obligatoire dans chaque logement, de préférence dans le dégagement des chambres.', 'Loi du 9 mars 2010 ; arrêté du 5 février 2013 (NF EN 14604).', {t:'Placer un détecteur de fumée', run:() => chkAddMissing(null, ['daaf'], 1)});
  else if (daaf && state.levels.length > 1){ for (let i = 0; i < state.levels.length; i++) if (rooms.some(r => r.lvl === i && r.kind === 'chambre') && !M.some(e => mepKindOf(e) === 'daaf' && e.lvl === i)) add('daaf' + i, 'fire', 'warn', `${lv(i)} : pas de détecteur de fumée près des chambres`, 'Un détecteur par niveau habité est recommandé.', 'Recommandation DGSCGC : un détecteur par niveau.', {t:'Placer un détecteur à ce niveau', run:() => { const r = rooms.find(r => r.lvl === i && r.kind === 'chambre'), c = polyCentroid(r.poly); state.els.push({kind:'inst', fam:MEP_FAM_OF.daaf, type:0, params:{}, c:c.map(rnd), rot:0, lvl:i, off:0, mirror:false, auto:true, id:state.nextId++}); }}); }
  const hasEntry = E.some(e => e.kind === 'inst' && e.host && e.lvl === 0 && (/^Portes$/.test(fam(e.fam)?.cat || '') || /porte(?!-fen)/.test(e.fam || '')));
  if (state.levels.length && E.some(w => w.kind === 'wall' && w.lvl === 0) && !hasEntry && !E.some(e => e.kind === 'inst' && /porte-fen|baie/.test(e.fam || ''))) add('exit', 'fire', 'bad', 'Aucune porte d\'accès au rez-de-chaussée', 'Le bâtiment doit avoir au moins une issue vers l\'extérieur.', 'CCH R111-13 ; règlement de sécurité contre l\'incendie (habitation).', null);
  for (const s of E) if (s.kind === 'stair'){ const W = s.w ?? s.width ?? 0; if (W && W < 0.8 - 1e-6) add('st-w', 'fire', 'bad', `Escalier ${s.id} : largeur ${nf(W, 2)} m`, 'Escalier trop étroit pour l\'évacuation.', 'Habitation individuelle : largeur ≥ 0,80 m (0,90 m si collectif).', null, [s.id]); }
  /* ---------- Acoustique : chambre accolée à une pièce bruyante par une cloison légère ---------- */
  const doneAc = new Set();
  for (const w of E) if (w.kind === 'wall' && !w.partition || w.kind === 'wall'){ const d = V.sub(w.b, w.a), L = V.len(d); if (L < 0.8) continue; const u = V.mul(d, 1 / L), n = [-u[1], u[0]], m = V.mul(V.add(w.a, w.b), 0.5), t = wallT(w) / 2 + 0.25;
    const r1 = roomAt(w.lvl, V.add(m, V.mul(n, t))), r2 = roomAt(w.lvl, V.sub(m, V.mul(n, t))); if (!r1 || !r2 || r1 === r2) continue;
    const pair = [r1, r2], ch = pair.find(r => r.kind === 'chambre'), bruit = pair.find(r => ['cuisine', 'sdb', 'wc', 'technique', 'buanderie', 'garage'].includes(r.kind)); if (!ch || !bruit) continue;
    let Rw = 99; try { Rw = wallReport(layersInToOut(w), 'mur').ac.Rw; } catch(e){} const k = ch.key + bruit.key; if (Rw >= 40 || doneAc.has(k)) continue; doneAc.add(k);
    add('ac-' + k, 'ac', 'warn', `${ch.name} / ${bruit.name} : cloison Rw ≈ ${Rw} dB`, 'Cloison légère entre une chambre et une pièce humide ou bruyante.', 'Recommandation : Rw ≥ 40 dB entre chambre et pièce de service (NRA : 53 dB entre logements).', {...open(() => setTimeout(() => openInsulAdjust(w.id), 0)), t:'Ajouter un isolant acoustique (laine) dans la cloison'}, [w.id]); }
  /* ---------- Structure : épaisseur de dalle ---------- */
  for (const s of E) if (s.kind === 'slab' && s.lvl > 0 && elUse(s) !== 'toiture' && (s.off || 0) <= 1.2){ let R; try { R = slabSpan(s); } catch(e){ continue; } const e = slabT(s);
    if (R.span > 2.5 && e < R.span / 32 - 0.005 && R.span <= 5.2) add('slab-e', 'struct', 'warn', `${lv(s.lvl)} · dalle ${s.id} : ${n0(e * 100)} cm pour ${nf(R.span, 1)} m de portée`, 'Épaisseur inférieure à portée / 32 (flèche à contrôler).', 'BAEL / Eurocode 2 : épaisseur de dalle pleine ≈ L/30 à L/35.', {...open(() => setTimeout(() => openComposer({id:s.type, apply:s.id}), 0)), t:'Ouvrir la composition de la dalle'}, [s.id]); }
  /* ---------- Équipements : électricité, ventilation, eau ---------- */
  if (rooms.length && !M.length) add('mep0', 'elec', 'warn', 'Aucun équipement technique placé', 'Les prises, l\'éclairage, la ventilation, la plomberie et le chauffage ne peuvent pas être contrôlés : aucun équipement n\'est placé.', 'NF C 15-100 ; arrêté du 24 mars 1982 ; DTU 60.1.', {...open(() => setTimeout(() => mepStart(), 0)), t:'Lancer la proposition automatique'});
  if (rooms.length && M.length){
    if (!M.some(e => mepKindOf(e) === 'tableau')) add('tab', 'elec', 'bad', 'Aucun tableau électrique', 'Toute installation commence par un tableau de répartition avec disjoncteurs et différentiels 30 mA.', 'NF C 15-100 art. 771 : tableau près de l\'entrée.', {t:'Placer un tableau électrique', run:() => chkAddMissing(null, ['tableau'], 1)});
    const need = {sejour:[5, 'séjour'], chambre:[3, 'chambre'], cuisine:[6, 'cuisine'], sdb:[2, 'salle d\'eau'], buanderie:[2, 'buanderie'], entree:[1, 'entrée'], couloir:[1, 'couloir'], wc:[0, 'WC'], autre:[1, 'pièce']};
    for (const r of rooms){ const [n0p] = need[r.kind] || [1]; let req = n0p; if (r.kind === 'sejour' && r.net > 20) req = Math.max(5, Math.ceil(r.net / 4)); const pr = has(r, 'prise') + has(r, 'spec') + has(r, 'rj45') * 0;
      if (pr < req) add('pr', 'elec', 'warn', `${r.name} (${lv(r.lvl)}) : ${pr} prise${pr > 1 ? 's' : ''} pour ${req} exigée${req > 1 ? 's' : ''}`, `NF C 15-100 : ${req} prises de courant minimum dans cette pièce.`, 'NF C 15-100 art. 771.314 : séjour ≥ 5 (1 par 4 m² au-delà de 20 m²), chambre ≥ 3, cuisine ≥ 6, salle d\'eau ≥ 2.', {t:`Ajouter ${req - pr} prise${req - pr > 1 ? 's' : ''}`, run:() => chkAddMissing(r.key, ['prise'], req - pr)}, []);
      if (r.kind !== 'ext' && !has(r, 'lum') && !has(r, 'spot') && !has(r, 'applique') && r.kind !== 'wc') add('lm', 'elec', 'warn', `${r.name} (${lv(r.lvl)}) : aucun point lumineux`, 'Un point d\'éclairage par pièce est exigé.', 'NF C 15-100 : au moins un point lumineux au plafond ou en applique par pièce.', {t:'Ajouter un luminaire', run:() => chkAddMissing(r.key, ['lum', 'spot', 'applique'], 1)});
      if (['cuisine', 'sdb', 'wc'].includes(r.kind) && M.some(e => mepKindOf(e) === 'vmc' || mepKindOf(e) === 'vext') && !has(r, 'vext')) add('vx', 'vent', 'bad', `${r.name} : pas de bouche d'extraction`, 'Les pièces humides (cuisine, salle de bain, WC) sont ventilées par extraction mécanique.', 'Arrêté du 24 mars 1982 : débits ≥ 15 m³/h (WC), 15-30 (salle de bain), 20-45 m³/h (cuisine).', {t:'Ajouter une bouche d\'extraction', run:() => chkAddMissing(r.key, ['vext'], 1)});
      else if (['cuisine', 'sdb', 'wc'].includes(r.kind) && !M.some(e => mepKindOf(e) === 'vmc')) add('vx', 'vent', 'bad', `${r.name} : aucune ventilation`, 'Aucun caisson VMC ni bouche d\'extraction dans le bâtiment.', 'Arrêté du 24 mars 1982 : ventilation générale et permanente obligatoire.', {t:'Ajouter caisson VMC et bouche', run:() => chkAddMissing(null, ['vmc'], 1) || chkAddMissing(r.key, ['vext'], 1)});
      if (['sejour', 'chambre'].includes(r.kind) && M.some(e => mepKindOf(e) === 'vmc') && !has(r, 'ventree') && !glaz.some(e => { const f = instFrame(e); return f && e.lvl === r.lvl && chkNear(f.o, r.poly) < 0.45; })) add('ve', 'vent', 'warn', `${r.name} : pas d'entrée d'air`, 'Les pièces principales reçoivent l\'air neuf par des entrées d\'air.', 'Arrêté du 24 mars 1982 : entrées d\'air en pièces principales.', {t:'Ajouter une entrée d\'air', run:() => chkAddMissing(r.key, ['ventree'], 1)}); }
    const hab = rooms.filter(r => ['sejour', 'chambre'].includes(r.kind)).length, occ = Math.max(1, rooms.filter(r => r.kind === 'chambre').length + 1), ball = M.find(e => mepKindOf(e) === 'ballon');
    if (ball){ const V_ = famScope(fam(ball.fam), ball).V || 200; if (V_ < occ * 55 - 1) add('bal', 'eau', 'warn', `Ballon de ${V_} l pour ${occ} occupants`, `Capacité conseillée ≈ ${Math.ceil(occ * 55 / 50) * 50} l (50 à 60 l par personne et par jour).`, 'NF C 15-100 / DTU 60.1 : dimensionnement du ballon selon les occupants.', null, [ball.id]); }
    if (M.some(e => ['wc', 'lavabo', 'douche', 'baignoire', 'cuisine'].includes(mepKindOf(e))) && !M.some(e => ['arrivee', 'ballon'].includes(mepKindOf(e)))) add('arr', 'eau', 'warn', 'Aucune arrivée d\'eau', 'Les points d\'eau n\'ont pas d\'arrivée d\'eau ni de ballon.', 'DTU 60.1 : alimentation par compteur et réducteur de pression.', {t:'Placer arrivée d\'eau et ballon', run:() => chkAddMissing(null, ['arrivee', 'ballon'], 2)});
  }
  return out;
}
const runChecksBase = runChecks;
runChecks = function(){ const a = runChecksBase(); a.forEach(c => c.cat ??= c.id === 'span' || c.id === 'load' || c.id === 'col' || c.id === 'slab' ? 'struct' : c.id === 'stair' ? 'safe' : c.id === 'door' ? 'pmr' : c.id === 'sill' ? 'safe' : c.id === 'roof' ? 'therm' : 'conf'); let b = []; try { b = runChecksExt(); } catch(e){ console.warn('vérifications étendues', e); } return [...a, ...b].sort((p, q) => (p.lvl === 'bad' ? 0 : 1) - (q.lvl === 'bad' ? 0 : 1)); };
