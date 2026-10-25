/* ============ Menuiseries : un seul générateur pour la bibliothèque et l'outil Menuiserie ============
   Une menuiserie est décrite par une « fiche » (spec) : type, dimensions, nombre de vantaux, cadre, vitrage, ouverture, options.
   Le générateur en fait une famille paramétrique ordinaire (pièces en formules sur w, h, sill, fw, fd, T) : la bibliothèque de
   base (fenêtres, portes-fenêtres, baies, portes) est produite ainsi, et l'outil Menuiserie crée des familles sur mesure.
   Repère local (famille hébergée) : x le long du mur (centré), y à travers le mur (0 = axe, +y = côté intérieur, poignées),
   z vers le haut depuis l'allège. T = épaisseur du mur hôte (fournie par famScope).
   Performances calculées (EN ISO 10077-1 simplifiée) : Uw, facteur solaire Sw, transmission lumineuse TLw, affaiblissement Rw,
   masse, classes AEV et Acotherm. Contrôles : dimensions normalisées, accessibilité (largeurs de passage, poignée à 1,05 m),
   allège et garde-corps (NF P 01-012), vitrage de sécurité (DTU 39), poids des vantaux. */

/* ---------- matériaux complémentaires (cadres) ---------- */
Object.assign(MATS, {
  pvcAnthr:{...MATS.pvc, nom:'PVC plaxé gris anthracite', color:'#3F444B', rough:0.45},
  boisPeint:{...MATS.bois, nom:'Bois peint blanc (menuiserie)', color:'#F3F1EA', tex:'plain', rough:0.55},
  vitrage3:{...MATS.vitrage, nom:'Triple vitrage 4/16/4/16/4 (équivalent)', rho:600, lambda:0.03, opacity:0.3, Ug:0.6},
  vitrageAc:{...MATS.vitrage, nom:'Double vitrage acoustique 44.2/16/10 (équivalent)', rho:900, opacity:0.34, Ug:1.1},
});
/* ---------- cadres (profils) : matériau, Uf, largeurs de profils, classe AEV, masse linéique ---------- */
const JN_FRAMES = {
  pvc:  {nom:'PVC blanc', m:'pvc', Uf:1.3, fw:0.055, fd:0.07, ow:0.07, od:0.07, psi:0.06, aev:'A*4 E*7B V*A3', kg:3.5, ud:1.5},
  pvcA: {nom:'PVC plaxé gris anthracite', m:'pvcAnthr', Uf:1.3, fw:0.055, fd:0.07, ow:0.07, od:0.07, psi:0.06, aev:'A*4 E*7B V*A3', kg:3.5, ud:1.5},
  alu:  {nom:'Aluminium à rupture de pont thermique, gris anthracite', m:'aluAnthr', Uf:2.0, fw:0.05, fd:0.065, ow:0.055, od:0.065, psi:0.07, aev:'A*4 E*7B V*A3', kg:3.2, ud:1.3},
  aluB: {nom:'Aluminium à rupture de pont thermique, blanc', m:'alu', Uf:2.0, fw:0.05, fd:0.065, ow:0.055, od:0.065, psi:0.07, aev:'A*4 E*7B V*A3', kg:3.2, ud:1.3},
  bois: {nom:'Bois (chêne, exotique)', m:'chene', Uf:1.6, fw:0.058, fd:0.068, ow:0.068, od:0.068, psi:0.06, aev:'A*4 E*7B V*A3', kg:5.0, ud:2.0},
  boisP:{nom:'Bois peint blanc', m:'boisPeint', Uf:1.6, fw:0.058, fd:0.068, ow:0.068, od:0.068, psi:0.06, aev:'A*4 E*7B V*A3', kg:5.0, ud:2.0},
  acier:{nom:'Acier à profils fins (style atelier)', m:'acierLaque', Uf:3.5, fw:0.035, fd:0.045, ow:0.03, od:0.045, psi:0.08, aev:'A*2 E*4B V*A2', kg:6.0, ud:1.5},
};
const JN_KINDS = {fen:'Fenêtre', pf:'Porte-fenêtre', coul:'Baie coulissante', fixe:'Châssis fixe', pi:'Porte intérieure', pe:'Porte d\'entrée'};
const JN_OPENS = {fr:'À la française (battant)', ob:'Oscillo-battant', fixe:'Fixe'};
/* vantaux de portes : affaiblissement acoustique, masse surfacique, épaisseur */
const JN_LEAVES = {
  pi:{pleine:{nom:'Pleine (âme pleine)', Rw:28, kg:28, lt:0.04}, alveolaire:{nom:'Isoplane, âme alvéolaire', Rw:22, kg:12, lt:0.04}, panneaux:{nom:'Postformée à 2 panneaux', Rw:24, kg:14, lt:0.04},
      vitree:{nom:'Vitrée (vitrage central)', Rw:25, kg:20, lt:0.04}, atelier:{nom:'Verrière style atelier', Rw:22, kg:24, lt:0.035}, acou:{nom:'Acoustique (âme lourde, joints, seuil automatique)', Rw:38, kg:40, lt:0.045}},
  pe:{pleine:{nom:'Pleine isolante', Rw:30, kg:35, lt:0.068}, rainuree:{nom:'Pleine à rainures horizontales', Rw:30, kg:35, lt:0.068}, panneaux:{nom:'Moulurée à 2 panneaux', Rw:29, kg:34, lt:0.068},
      vitree:{nom:'Semi-vitrée', Rw:29, kg:32, lt:0.068}, acou:{nom:'Isolante acoustique renforcée', Rw:37, kg:48, lt:0.072}},
};
/* dimensions courantes (cm) par type et nombre de vantaux */
const JN_STD = {
  fen:{1:[[40,45],[40,60],[50,75],[60,75],[60,95],[80,95],[80,115],[90,115],[100,115],[100,125],[100,135]], 2:[[80,95],[100,115],[100,125],[120,125],[120,135],[140,135],[140,145],[160,145],[180,145]], 3:[[180,135],[200,145],[240,145]]},
  pf:{1:[[80,215],[90,215],[100,215]], 2:[[120,215],[140,215],[160,215],[180,215],[160,225]], 3:[[240,215]]},
  coul:{2:[[180,215],[200,215],[240,215],[300,215],[240,225]], 3:[[300,215],[360,215]], 4:[[400,215],[480,215]]},
  fixe:{1:[[60,60],[80,80],[100,100],[120,120],[200,60],[300,60],[100,215],[120,215]]},
  pi:{1:[[63,204],[73,204],[83,204],[93,204],[83,214],[93,224]], 2:[[126,204],[146,204],[166,204]]},
  pe:{1:[[90,215],[100,215],[90,225],[100,225]], 2:[[140,215],[160,215],[150,220]]},
};
const JN_DEF = {kind:'fen', w:1.2, h:1.35, sill:0.9, n:2, frame:'pvc', open:'fr', hinge:'g', swing:'in', glz:{t:'double', gas:'argon', le:true, ac:'std', saf:'std', sol:false, we:true}, bars:{h:0, v:0}, appui:true, leaf:'pleine', tierce:0, imposte:0, iso:false, fire:'', ouv:0};
const jnSpec = s => { const o = JSON.parse(JSON.stringify(JN_DEF)); if (s){ Object.assign(o, s); o.glz = {...JN_DEF.glz, ...(s.glz || {})}; o.bars = {...JN_DEF.bars, ...(s.bars || {})}; } return o; };
const jnq = v => String(Math.round(v * 1e4) / 1e4);

/* ---------- vitrages ---------- */
function glazingData(g){
  g = {...JN_DEF.glz, ...(g || {})};
  let Ug, gf, tl, Rw, comp, mm, m;
  const ext = g.ac === 'std' ? '4' : g.ac === 'renf' ? '10' : '44.2', eExt = g.ac === 'std' ? 4 : g.ac === 'renf' ? 10 : 8.8;
  if (g.t === 'simple'){ Ug = 5.8; gf = 0.85; tl = 0.90; comp = ext; mm = eExt; Rw = g.ac === 'std' ? 29 : g.ac === 'renf' ? 31 : 35; m = 'verre'; }
  else if (g.t === 'double'){
    const gap = g.gas === 'krypton' ? 12 : 16; Ug = g.le ? {air:1.4, argon:1.1, krypton:1.0}[g.gas] : {air:2.8, argon:2.7, krypton:2.6}[g.gas];
    gf = g.le ? 0.63 : 0.78; tl = g.le ? 0.80 : 0.81; comp = `${ext}/${gap}/4`; mm = eExt + gap + 4; Rw = g.ac === 'std' ? 32 : g.ac === 'renf' ? 36 : 41; m = g.ac === 'acou' ? 'vitrageAc' : 'vitrage';
  } else {
    const gap = g.gas === 'krypton' ? 12 : 16; Ug = g.le ? {air:0.8, argon:0.6, krypton:0.5}[g.gas] : {air:2.0, argon:1.9, krypton:1.8}[g.gas];
    gf = g.le ? 0.50 : 0.60; tl = g.le ? 0.70 : 0.72; comp = `${ext}/${gap}/4/${gap}/4`; mm = eExt + 2 * gap + 8; Rw = g.ac === 'std' ? 33 : g.ac === 'renf' ? 37 : 43; m = 'vitrage3';
  }
  if (g.le) comp += ' FE';
  if (g.gas !== 'air' && g.t !== 'simple') comp += ' ' + g.gas;
  if (g.sol){ gf = g.t === 'simple' ? 0.60 : g.t === 'double' ? 0.35 : 0.30; tl = Math.round(tl * 0.75 * 100) / 100; comp += ', contrôle solaire'; }
  if (g.saf === 'tremp') comp += ', trempé'; else if (g.saf === 'feuil'){ comp += ', feuilleté'; Rw += 1; mm += 2.6; }
  const glassMm = g.t === 'simple' ? eExt : g.t === 'double' ? eExt + 4 : eExt + 8;   // épaisseurs de verre seules
  return {Ug, g:gf, TL:tl, Rw, comp, e:mm / 1000, kg:2.5 * (glassMm + (g.saf === 'feuil' ? 2.6 : 0)), m, label:`${g.t === 'simple' ? 'Simple' : g.t === 'double' ? 'Double' : 'Triple'} vitrage ${comp}`};
}

/* ---------- géométrie ---------- */
function joineryParts(sp){
  const FR = JN_FRAMES[sp.frame] || JN_FRAMES.pvc, fm = FR.m, G = glazingData(sp.glz), gt = jnq(G.e), gm = G.m, n = Math.max(1, sp.n | 0), P = [];
  const B = (m, x, y, z, w, d, h, extra = {}) => P.push({s:'box', m, x:String(x), y:String(y), z:String(z), w:String(w), d:String(d), h:String(h), ...extra});
  const C = (m, x, y, z, r, h, extra = {}) => P.push({s:'cyl', m, x:String(x), y:String(y), z:String(z), r:String(r), h:String(h), ...extra});
  const isDoor = sp.kind === 'pi' || sp.kind === 'pe';
  /* --- dormant --- */
  B(fm, '-w/2', '-fd/2', '0', 'fw', 'fd', 'h'); B(fm, 'w/2-fw', '-fd/2', '0', 'fw', 'fd', 'h'); B(fm, '-w/2+fw', '-fd/2', 'h-fw', 'w-2*fw', 'fd', 'fw');
  if (sp.kind === 'fen' || sp.kind === 'fixe') B(fm, '-w/2+fw', '-fd/2', '0', 'w-2*fw', 'fd', 'fw');
  else if (sp.kind !== 'pi') B('alu', '-w/2+fw', '-fd/2', '0', 'w-2*fw', 'fd', '0.02');   // seuil aluminium (≤ 2 cm : accessibilité)
  /* --- appui extérieur et tablette intérieure (fenêtres à allège) --- */
  if ((sp.kind === 'fen' || sp.kind === 'fixe') && sp.appui){
    const am = /alu|pvc/.test(sp.frame) ? 'alu' : 'pierreSol';
    B(am, '-w/2-0.04', '-T/2-0.04', '0', 'w+0.08', 'max(0.02, T/2+0.04-fd/2+0.005)', '0.012', {if:'sill>0.01'});
    B(am, '-w/2-0.04', '-T/2-0.04', '-0.035', 'w+0.08', '0.03', '0.047', {if:'sill>0.01'});
    B('stratifie', '-w/2-0.03', 'fd/2-0.005', '0', 'w+0.06', 'max(0.02, T/2-fd/2+0.03)', '0.022', {if:'sill>0.01'});
  }
  const ow = jnq(FR.ow), od = jnq(FR.od), oy = jnq(-FR.od / 2 + 0.012);   // ouvrant légèrement côté intérieur
  const bars = (x0, y0, gw, gz, gh) => { // petits bois
    const nh = sp.bars?.h | 0, nv = sp.bars?.v | 0;
    for (let j = 1; j <= nh; j++) B(fm, x0, `${y0}-0.004`, `${gz}+${j}*(${gh})/${nh + 1}-0.011`, gw, `${gt}+0.008`, '0.022');
    for (let j = 1; j <= nv; j++) B(fm, `${x0}+${j}*(${gw})/${nv + 1}-0.011`, `${y0}-0.004`, gz, '0.022', `${gt}+0.008`, gh);
  };
  if (sp.kind === 'fixe'){
    B(gm, '-w/2+fw', `-${gt}/2`, 'fw', 'w-2*fw', gt, 'h-2*fw'); bars('-w/2+fw', `-${gt}/2`, '(w-2*fw)', 'fw', '(h-2*fw)');
    B(fm, '-w/2+fw', `${gt}/2`, 'fw', 'w-2*fw', '0.018', '0.018'); B(fm, '-w/2+fw', `${gt}/2`, 'h-fw-0.018', 'w-2*fw', '0.018', '0.018');   // parcloses
  } else if (sp.kind === 'fen' || sp.kind === 'pf'){
    const pf = sp.kind === 'pf', LW = `((w-2*fw)/${n})`, zb = pf ? '0.02' : 'fw', OH = pf ? '(h-fw-0.02)' : '(h-2*fw)', low = pf ? '0.1' : ow;
    for (let i = 0; i < n; i++){
      const x0 = `(-w/2+fw+${i}*${LW})`;
      B(fm, x0, oy, zb, ow, od, OH); B(fm, `${x0}+${LW}-${ow}`, oy, zb, ow, od, OH);
      B(fm, `${x0}+${ow}`, oy, `${zb}+${OH}-${ow}`, `${LW}-2*${ow}`, od, ow); B(fm, `${x0}+${ow}`, oy, zb, `${LW}-2*${ow}`, od, low);
      const gx = `${x0}+${ow}`, gw = `(${LW}-2*${ow})`, gz = `(${zb}+${low})`, gh = `(${OH}-${ow}-${low})`;
      B(gm, gx, `-${gt}/2+0.012`, gz, gw, gt, gh); bars(gx, `-${gt}/2+0.012`, gw, gz, gh);
    }
    if (sp.open !== 'fixe'){ // poignée : sur le vantail de service, montant opposé aux gonds
      const i = n === 1 ? 0 : sp.hinge === 'g' ? n - 1 : 0, x0 = `(-w/2+fw+${i}*${LW})`;
      const xs = (n === 1 ? sp.hinge === 'g' : sp.hinge !== 'g') ? `${x0}+${LW}-${ow}/2` : `${x0}+${ow}/2`;
      const zc = pf ? '1.05' : `(${zb}+${OH}/2)`, yf = jnq(FR.od / 2 + 0.012);
      B('inox', `${xs}-0.015`, yf, `${zc}-0.055`, '0.03', '0.013', '0.11'); C('inox', xs, `${yf}+0.034`, `${zc}-0.07`, '0.0085', '0.14'); C('inox', xs, `${yf}+0.012`, zc, '0.0085', '0.03', {ax:'y'});
    }
  } else if (sp.kind === 'coul'){
    const ov = 0.07, LW = `((w-2*fw+${jnq(ov * (n - 1))})/${n})`, ow2 = jnq(Math.max(0.05, FR.ow * 0.8)), od2 = '0.045';
    for (let i = 0; i < n; i++){
      const t = n === 4 ? (i < 2 ? i : 3 - i) : i % 2, yc = t ? 0.023 : -0.023, y0 = jnq(yc - 0.0225), x0 = `(-w/2+fw+${i}*(${LW}-${jnq(ov)}))`;
      B(fm, x0, y0, '0.02', ow2, od2, 'h-fw-0.02'); B(fm, `${x0}+${LW}-${ow2}`, y0, '0.02', ow2, od2, 'h-fw-0.02');
      B(fm, `${x0}+${ow2}`, y0, 'h-fw-0.07', `${LW}-2*${ow2}`, od2, '0.05'); B(fm, `${x0}+${ow2}`, y0, '0.02', `${LW}-2*${ow2}`, od2, '0.08');
      B(gm, `${x0}+${ow2}`, jnq(yc - G.e / 2), '0.1', `${LW}-2*${ow2}`, gt, 'h-fw-0.17');
    }
    const si = n === 4 ? 1 : 1, x0 = `(-w/2+fw+${si}*(${LW}-${jnq(ov)}))`;   // tirant sur le vantail intérieur, montant de rencontre
    C('inox', `${x0}+${ow2}/2`, jnq(0.023 + 0.0225 + 0.018), '0.92', '0.011', '0.26'); B('inox', `${x0}+${ow2}/2-0.012`, jnq(0.023 + 0.0225), '1.03', '0.024', '0.02', '0.04');
    B('inox', `${x0}+${ow2}/2-0.012`, jnq(0.023 + 0.0225), '1.17', '0.024', '0.02', '0.04');
    B(fm, '-w/2+fw', '-0.05', 'h-fw-0.004', 'w-2*fw', '0.1', '0.004'); B(fm, '-w/2+fw', '-0.05', '0.02', 'w-2*fw', '0.1', '0.004');   // rails
  } else if (isDoor){
    const pe = sp.kind === 'pe', L = (JN_LEAVES[sp.kind][sp.leaf] || JN_LEAVES[sp.kind].pleine), lt = jnq(L.lt), leafM = pe ? fm : (sp.leaf === 'atelier' ? 'acierLaque' : sp.frame === 'bois' ? 'chene' : 'boisPeint');
    const hi = sp.imposte > 0.15 ? sp.imposte : 0, wt = pe && sp.tierce > 0.2 ? sp.tierce : 0;
    if (!pe) for (const yy of ['T/2-0.004', '-T/2-0.01']){ // chambranles (habillage des deux faces)
      B(fm, '-w/2-0.06', yy, '0', '0.06', '0.014', 'h+0.06', {if:'T>fd+0.02'}); B(fm, 'w/2', yy, '0', '0.06', '0.014', 'h+0.06', {if:'T>fd+0.02'}); B(fm, '-w/2', yy, 'h', 'w', '0.014', '0.06', {if:'T>fd+0.02'}); }
    if (hi){ B(fm, '-w/2+fw', '-fd/2', `h-${jnq(hi)}-0.05`, 'w-2*fw', 'fd', '0.05'); B(gm, '-w/2+fw', `-${gt}/2`, `h-${jnq(hi)}`, 'w-2*fw', gt, `${jnq(hi)}-fw`); }
    if (wt){ const xm = sp.hinge === 'd' ? `w/2-fw-${jnq(wt)}-0.06` : `-w/2+fw+${jnq(wt)}`; B(fm, xm, '-fd/2', '0', '0.06', 'fd', `h-fw${hi ? `-${jnq(hi)}-0.05` : ''}`);
      const xg = sp.hinge === 'd' ? `w/2-fw-${jnq(wt)}` : '-w/2+fw'; B(gm, xg, `-${gt}/2`, '0.1', jnq(wt), gt, `h-fw-0.1${hi ? `-${jnq(hi)}-0.05` : ''}`); B(fm, xg, '-fd/2', '0', jnq(wt), 'fd', '0.1'); }
    const topL = `h-fw-0.013${hi ? `-${jnq(hi)}-0.05` : ''}`;   // hauteur du vantail
    if (sp.open === 'coul'){ // porte coulissante en applique sur la face intérieure : ouv (0-90) fait glisser le vantail
      B(leafM, `-w/2-0.03+ouv/90*(w+0.06)`, 'T/2+0.012', '0.01', 'w+0.06', lt, 'h+0.02'); B('acierLaque', '-w/2-0.03', 'T/2+0.004', 'h+0.05', '2*w+0.1', '0.03', '0.045');
      B('inox', `w/2-0.1+ouv/90*(w+0.06)`, `T/2+0.012+${lt}`, '0.95', '0.02', '0.012', '0.2'); return P;
    }
    const leaves = n === 2 ? ['d', 'g'] : [sp.hinge], lwE = n === 2 ? `((w-2*fw-${jnq(wt ? wt + 0.06 : 0)}-0.009)/2)` : `(w-2*fw-${jnq(wt ? wt + 0.06 : 0)}-0.006)`;
    leaves.forEach((hg, k) => {
      const pivX = hg === 'd' ? (wt && sp.hinge === 'g' ? `-w/2+fw+${jnq(wt + 0.06)}+0.003` : '-w/2+fw+0.003') : (wt && sp.hinge === 'd' ? `w/2-fw-${jnq(wt + 0.06)}-0.003` : 'w/2-fw-0.003');
      const th = hg === 'd' ? (sp.swing === 'in' ? 'ouv' : '(0-ouv)') : (sp.swing === 'in' ? '(180-ouv)' : '(180+ouv)'), sInt = hg === 'd' ? 1 : -1;
      const at = (a, b) => [`${pivX}+(${a})*cos(${th})-(${b})*sin(${th})`, `(${b})*cos(${th})+(${a})*sin(${th})`];
      const box = (m, a, b, z, len, dep, hh, extra = {}) => { const [x, y] = at(a, b); B(m, x, y, z, len, dep, hh, {rz:th, ...extra}); };
      const lw = lwE, service = n === 1 || hg === sp.hinge;
      if (sp.leaf === 'vitree' || sp.leaf === 'atelier'){
        const st = sp.leaf === 'atelier' ? 0.035 : 0.12, rb = sp.leaf === 'atelier' ? 0.035 : 0.26, rt = sp.leaf === 'atelier' ? 0.035 : 0.12, ltn = +lt;
        box(leafM, '0', `-${lt}/2`, '0.01', jnq(st), lt, topL); box(leafM, `${lw}-${jnq(st)}`, `-${lt}/2`, '0.01', jnq(st), lt, topL);
        box(leafM, jnq(st), `-${lt}/2`, '0.01', `${lw}-${jnq(2 * st)}`, lt, jnq(rb)); box(leafM, jnq(st), `-${lt}/2`, `${topL}-${jnq(rt)}+0.01`, `${lw}-${jnq(2 * st)}`, lt, jnq(rt));
        const gm2 = sp.leaf === 'atelier' || sp.kind === 'pi' ? 'verre' : gm, gt2 = sp.leaf === 'atelier' || sp.kind === 'pi' ? '0.008' : gt;
        box(gm2, jnq(st), `-${gt2}/2`, jnq(0.01 + rb), `${lw}-${jnq(2 * st)}`, gt2, `${topL}-${jnq(rb + rt)}`);
        if (sp.leaf === 'atelier'){ const nh = 4; for (let j = 1; j <= nh; j++) box(leafM, jnq(st), `-${ltn / 2}`, `0.01+${jnq(rb)}+${j}*(${topL}-${jnq(rb + rt)})/${nh + 1}-0.012`, `${lw}-${jnq(2 * st)}`, lt, '0.024'); box(leafM, `${lw}/2-0.012`, `-${ltn / 2}`, jnq(0.01 + rb), '0.024', lt, `${topL}-${jnq(rb + rt)}`); }
      } else box(leafM, '0', `-${lt}/2`, '0.01', lw, lt, topL);
      if (sp.leaf === 'rainuree') for (let j = 0; j < 5; j++) box('aluAnthr', '0.08', `${-sInt}*(${lt}/2+0.003)`, `0.3+${j}*(${topL}-0.75)/4`, `${lw}-0.16`, '0.006', '0.014');
      if (sp.leaf === 'panneaux') for (const s of [1, -1]) for (const [z0, z1] of [['0.2', '0.78'], ['0.95', `${topL}-0.2`]]){ const b = `${s}*(${lt}/2+0.003)`, bb = `${s}*(${lt}/2)`;
        box(leafM, '0.1', s > 0 ? bb : b, z0, '0.035', '0.006', `${z1}-${z0}`); box(leafM, `${lw}-0.135`, s > 0 ? bb : b, z0, '0.035', '0.006', `${z1}-${z0}`);
        box(leafM, '0.1', s > 0 ? bb : b, z0, `${lw}-0.2`, '0.006', '0.035'); box(leafM, '0.1', s > 0 ? bb : b, `${z1}-0.035`, `${lw}-0.2`, '0.006', '0.035'); }
      // paumelles (côté ouverture), béquille des deux faces ou bâton de maréchal extérieur, verrous du vantail semi-fixe
      const sw = sp.swing === 'in' ? sInt : -sInt;
      for (const z of ['0.22', `${topL}/2-0.045`, `${topL}-0.3`]){ const [x, y] = at('0.012', `${sw}*(${lt}/2+0.006)`); C(fm === 'chene' ? 'inox' : 'inox', x, y, z, '0.0075', '0.09'); }
      const hz = '1.05', aH = `${lw}-0.065`;   // poignée à 1,05 m du sol (accessibilité : entre 0,90 et 1,30 m)
      if (service) for (const s of pe ? [sInt] : [1, -1]){
        const [rx, ry] = at(aH, `${s}*(${lt}/2+0.005)`); C('inox', rx, ry, hz, '0.025', '0.01', {ax:'y', rz:th});
        const [nx, ny] = at(aH, `${s}*(${lt}/2+0.03)`); C('inox', nx, ny, hz, '0.0085', '0.05', {ax:'y', rz:th});
        const [lx, ly] = at(`${aH}-0.0575`, `${s}*(${lt}/2+0.053)`); C('inox', lx, ly, hz, '0.0085', '0.115', {ax:'x', rz:th});
      }
      if (service && pe){ const [bx, by] = at(`${lw}-0.08`, `${-sInt}*(${lt}/2+0.055)`); C('inox', bx, by, '0.55', '0.013', '1.0'); for (const z of ['0.6', '1.5']){ const [fx2, fy2] = at(`${lw}-0.08`, `${-sInt}*(${lt}/2+0.028)`); C('inox', fx2, fy2, z, '0.009', '0.055', {ax:'y', rz:th}); } }
      if (!service) for (const z of ['0.3', `${topL}-0.35`]){ const [vx, vy] = at(`${lw}-0.02`, `${sInt}*(${lt}/2+0.008)`); C('inox', vx, vy, z, '0.006', '0.08'); }
      void k;
    });
  }
  return P;
}
/* ---------- performances ---------- */
function joineryGeomStats(sp, w, h){
  const FR = JN_FRAMES[sp.frame] || JN_FRAMES.pvc, fw = FR.fw, n = Math.max(1, sp.n | 0); let Ag = 0, lg = 0;
  const add = (gw, gh, k = 1) => { if (gw > 0 && gh > 0){ Ag += k * gw * gh; lg += k * 2 * (gw + gh); } };
  if (sp.kind === 'fixe') add(w - 2 * fw, h - 2 * fw);
  else if (sp.kind === 'fen' || sp.kind === 'pf'){ const LW = (w - 2 * fw) / n, OH = sp.kind === 'pf' ? h - fw - 0.02 : h - 2 * fw, low = sp.kind === 'pf' ? 0.1 : FR.ow; add(LW - 2 * FR.ow, OH - FR.ow - low, n); }
  else if (sp.kind === 'coul'){ const ov = 0.07, LW = (w - 2 * fw + ov * (n - 1)) / n, ow2 = Math.max(0.05, FR.ow * 0.8); add(LW - 2 * ow2, h - fw - 0.17, n); }
  else { const L = JN_LEAVES[sp.kind][sp.leaf] || JN_LEAVES[sp.kind].pleine, hi = sp.imposte > 0.15 ? sp.imposte : 0, wt = sp.kind === 'pe' && sp.tierce > 0.2 ? sp.tierce : 0;
    const lw = n === 2 ? (w - 2 * fw - (wt ? wt + 0.06 : 0) - 0.009) / 2 : w - 2 * fw - (wt ? wt + 0.06 : 0) - 0.006, lh = h - fw - 0.013 - (hi ? hi + 0.05 : 0);
    if (sp.leaf === 'vitree') add(lw - 0.24, lh - 0.38, n); else if (sp.leaf === 'atelier') add(lw - 0.07, lh - 0.07, n);
    if (hi) add(w - 2 * fw, hi - fw); if (wt) add(wt, lh - 0.1); void L; }
  const Aw = Math.max(0.05, w * h); return {Aw, Ag:Math.min(Ag, Aw * 0.95), Af:Math.max(0, Aw - Math.min(Ag, Aw * 0.95)), lg, n};
}
function joineryPerfSpec(sp, w = sp.w, h = sp.h){
  const FR = JN_FRAMES[sp.frame] || JN_FRAMES.pvc, G = glazingData(sp.glz), S = joineryGeomStats(sp, w, h), isDoor = sp.kind === 'pi' || sp.kind === 'pe', psi = sp.glz?.we === false ? Math.max(0.07, FR.psi) : Math.min(0.04, FR.psi);   // intercalaire warm edge : Ψ ≈ 0,04 ; alu classique : ≈ 0,07
  let Uw, Rw, kg, Uf = FR.Uf + (sp.kind === 'coul' ? 0.2 : 0);
  if (isDoor){
    const L = JN_LEAVES[sp.kind][sp.leaf] || JN_LEAVES[sp.kind].pleine, Ud = sp.kind === 'pe' ? FR.ud * (sp.iso ? 0.75 : 1) : 2.5;
    Uw = (S.Ag * G.Ug + S.Af * Ud + S.lg * psi) / S.Aw;
    const Ro = L.Rw + (sp.fire ? 2 : 0), Rg = G.Rw + 1; Rw = S.Ag > 0.01 ? -10 * Math.log10((S.Af / S.Aw) * 10 ** (-Ro / 10) + (S.Ag / S.Aw) * 10 ** (-Rg / 10)) : Ro;
    kg = S.Af * L.kg + S.Ag * G.kg + (2 * h + w) * FR.kg;
  } else {
    Uw = (S.Ag * G.Ug + S.Af * Uf + S.lg * psi) / S.Aw; Rw = Math.max(25, G.Rw - (sp.kind === 'coul' ? 2 : 0)); kg = S.Ag * G.kg + (2 * h + 2 * w) * FR.kg + S.n * 2 * (h + w / S.n) * FR.kg * 0.8;
  }
  const Sw = (S.Ag * G.g * 0.95 + S.Af * 0.02) / S.Aw, TL = S.Ag * G.TL / S.Aw;
  const th = Uw <= 0.8 ? 'Th13' : Uw <= 1.0 ? 'Th12' : Uw <= 1.2 ? 'Th11' : Uw <= 1.4 ? 'Th10' : Uw <= 1.6 ? 'Th9' : Uw <= 1.8 ? 'Th8' : Uw <= 2.0 ? 'Th7' : Uw <= 2.2 ? 'Th6' : 'Th5';
  const ctr = Rw - 4, ac = ctr >= 40 ? 'AC4' : ctr >= 36 ? 'AC3' : ctr >= 33 ? 'AC2' : ctr >= 28 ? 'AC1' : '—';
  const leafKg = kg / Math.max(1, S.n);
  return {Uw:Math.round(Uw * 100) / 100, Ug:G.Ug, Uf:Math.round(Uf * 100) / 100, Sw:Math.round(Sw * 100) / 100, TL:Math.round(TL * 100) / 100, Rw:Math.round(Rw), RwCtr:Math.round(ctr), Ag:Math.round(S.Ag * 100) / 100, Af:Math.round(S.Af * 100) / 100, Aw:Math.round(S.Aw * 100) / 100,
    kg:Math.round(kg), leafKg:Math.round(leafKg), glazing:G.label, frame:FR.nom, aev:FR.aev, th, ac, fire:sp.fire || '', interior:sp.kind === 'pi', n:S.n};
}
function joineryPerf(F, scope){ if (!F?.join) return null; const s = scope || famScope(F, {type:0, params:{}}); return joineryPerfSpec(F.join, s.w ?? F.join.w, s.h ?? F.join.h); }
/* ---------- contrôles : dimensions normalisées, accessibilité, sécurité ---------- */
function joineryCheck(sp, perf){
  const E = [], W = [], N = [], w = sp.w, h = sp.h, n = Math.max(1, sp.n | 0), cm = v => Math.round(v * 100), isDoor = sp.kind === 'pi' || sp.kind === 'pe';
  const std = (JN_STD[sp.kind] || {})[n] || [], isStd = std.some(([a, b]) => Math.abs(a - cm(w)) < 0.5 && Math.abs(b - cm(h)) < 0.5);
  if (!isStd && std.length) N.push(`Dimension hors standard (${cm(w)} × ${cm(h)}) : fabrication sur mesure, délai et coût majorés. Courantes : ${std.slice(0, 5).map(([a, b]) => `${a}×${b}`).join(', ')}…`);
  if (w < 0.3 || h < 0.3) E.push('Dimension trop petite (minimum 30 cm).');
  if (sp.kind === 'pi'){
    if (w < 0.63) E.push('Porte intérieure : largeur minimale 63 cm.');
    else if (w < 0.83) W.push(`Passage utile ${cm(w - 0.06)} cm : prévoir 83 cm de largeur (passage ≥ 77 cm) pour l'accessibilité des logements (arrêté du 24 déc. 2015).`);
    if (h < 2.0) W.push('Hauteur inférieure à 2,00 m : hauteur de passage insuffisante (standard 204 cm).'); if (h > 2.4) N.push('Hauteur supérieure à 240 cm : vantail toute hauteur sur mesure.');
  }
  if (sp.kind === 'pe'){
    if (w < 0.8) E.push('Porte d\'entrée : largeur minimale 80 cm.');
    else if (w < 0.9 && n === 1) W.push(`Passage utile ${cm(w - 0.07)} cm : une porte de 90 cm (passage ≥ 83 cm) est requise pour l'accessibilité (logements neufs, ERP).`);
    if (h < 2.1) W.push('Hauteur inférieure à 210 cm : standard 215 cm.');
  }
  if (isDoor && n === 2 && w < 1.2) W.push('Porte à 2 vantaux : largeur inférieure à 120 cm, vantaux étroits (< 60 cm).');
  if (isDoor) N.push('Poignée à 1,05 m du sol (accessibilité : entre 0,90 et 1,30 m) ; seuil ≤ 2 cm.');
  if (!isDoor){
    const lw = (sp.kind === 'coul' ? (w - 0.12 + 0.07 * (n - 1)) : (w - 0.14)) / n;
    if ((sp.kind === 'fen' || sp.kind === 'pf') && lw > 1.2) E.push(`Vantail de ${cm(lw)} cm : trop large pour un battant (maximum ≈ 120 cm) — ajoutez un vantail ou passez en coulissant.`);
    if (sp.kind === 'coul' && lw > 2.5) W.push(`Vantail coulissant de ${cm(lw)} cm : très lourd, prévoir des roulettes renforcées ou un vantail de plus.`);
    if (sp.kind === 'fen' && sp.sill < 0.9 && sp.sill + h > 1.0) W.push(`Allège de ${cm(sp.sill)} cm (< 90 cm) : garde-corps obligatoire à 1,00 m (NF P 01-012) et vitrage de sécurité (feuilleté) sur la partie basse (DTU 39).`);
    if (sp.kind === 'fen' && sp.sill >= 1.3) N.push('Allège haute (≥ 130 cm) : vue vers l\'extérieur réduite ; conseillée seulement en salle d\'eau ou pour un bandeau.');
    if ((sp.kind === 'pf' || sp.kind === 'coul') && sp.glz?.saf === 'std') W.push('Porte-fenêtre / baie : vitrage de sécurité (trempé ou feuilleté) obligatoire sur les vitrages à hauteur de passage (DTU 39 P5).');
    if (sp.kind === 'fen' && sp.sill < 0.6 && sp.glz?.saf === 'std') W.push('Vitrage de sécurité requis (allège basse).');
    if (perf.leafKg > (sp.kind === 'coul' ? 150 : /pvc/.test(sp.frame) ? 80 : 100)) W.push(`Vantail de ${perf.leafKg} kg : trop lourd pour les paumelles standard (${sp.kind === 'coul' ? '150' : /pvc/.test(sp.frame) ? '80' : '100'} kg) — réduisez la largeur ou allégez le vitrage.`);
    if (sp.glz?.t === 'triple' && /pvc/.test(sp.frame)) N.push('Triple vitrage sur PVC : profils à renfort acier conseillés (poids et rigidité).');
    if (sp.open === 'ob' && lw > 1.0) W.push('Oscillo-battant : vantail au-delà de 100 cm, ferrage renforcé.');
    if (w / h > 3.5 || h / w > 3.5) N.push('Proportions extrêmes : vérifier la faisabilité (rigidité des profils).');
  }
  if ((sp.kind === 'pe' || sp.kind === 'pi') && (sp.leaf === 'vitree' || sp.leaf === 'atelier') && sp.glz?.saf === 'std') W.push('Porte vitrée : vitrage de sécurité (trempé ou feuilleté) obligatoire (DTU 39, zones de passage).');
  if (sp.fire){ if (sp.frame !== 'acier' && sp.frame !== 'bois' && sp.frame !== 'boisP') W.push(`Porte ${sp.fire} : huisserie métallique ou bois massif et bloc-porte certifié (PV d'essai) requis.`); if (sp.leaf === 'alveolaire' || sp.leaf === 'atelier') E.push(`Porte ${sp.fire} : vantail âme pleine ≥ 40 mm obligatoire.`); N.push(`Classement ${sp.fire} à justifier par le PV du bloc-porte (vantail + huisserie + ferrage + joints intumescents).`); }
  if (!isDoor || sp.kind === 'pe'){ if (perf.Uw > 1.3) W.push(`Uw = ${nf(perf.Uw, 2)} W/m²·K : au-dessus de 1,3 (seuil des aides à la rénovation, RE 2020 : viser ≤ 1,3 et Sw ≥ 0,3).`); else N.push(`Uw = ${nf(perf.Uw, 2)} W/m²·K : conforme aux exigences courantes (≤ 1,3).`); }
  return {errors:E, warns:W, notes:N, isStd};
}
/* ---------- nom et famille ---------- */
function joineryName(sp){
  const cm = v => Math.round(v * 100), n = Math.max(1, sp.n | 0), FR = JN_FRAMES[sp.frame] || JN_FRAMES.pvc, G = glazingData(sp.glz);
  const base = sp.kind === 'fen' ? `Fenêtre ${n} vanta${n > 1 ? 'ux' : 'il'}${sp.open === 'ob' ? ' oscillo-battant' : sp.open === 'fixe' ? ' fixe' : ''}` : sp.kind === 'pf' ? `Porte-fenêtre ${n} vanta${n > 1 ? 'ux' : 'il'}` : sp.kind === 'coul' ? `Baie coulissante ${n} vantaux` : sp.kind === 'fixe' ? 'Châssis fixe'
    : sp.kind === 'pi' ? `Porte intérieure ${(JN_LEAVES.pi[sp.leaf] || JN_LEAVES.pi.pleine).nom.toLowerCase()}${n === 2 ? ' 2 vantaux' : ''}${sp.open === 'coul' ? ' coulissante' : ''}` : `Porte d'entrée ${(JN_LEAVES.pe[sp.leaf] || JN_LEAVES.pe.pleine).nom.toLowerCase()}${n === 2 ? ' 2 vantaux' : ''}${sp.tierce > 0.2 ? ' avec tierce' : ''}`;
  const mat = FR.nom.split(/[ ,(]/)[0];
  return `${base} ${cm(sp.w)} × ${cm(sp.h)} ${mat}${sp.kind !== 'pi' && sp.kind !== 'pe' || sp.leaf === 'vitree' ? `, ${sp.glz.t === 'simple' ? 'simple' : sp.glz.t === 'double' ? 'double' : 'triple'} vitrage` : ''}${sp.fire ? ' ' + sp.fire : ''}`;
}
function joineryFamily(spec, opt = {}){
  const sp = jnSpec(spec), FR = JN_FRAMES[sp.frame] || JN_FRAMES.pvc, isDoor = sp.kind === 'pi' || sp.kind === 'pe';
  const params = {w:P(sp.w, 'Largeur'), h:P(sp.h, 'Hauteur'), sill:P(isDoor || sp.kind === 'pf' || sp.kind === 'coul' ? 0 : sp.sill, 'Allège'), fw:P(isDoor ? (sp.kind === 'pi' ? 0.045 : 0.07) : FR.fw, 'Largeur du dormant'), fd:P(isDoor ? (sp.kind === 'pi' ? 0.07 : 0.08) : FR.fd, 'Profondeur du dormant')};
  if (isDoor) params.ouv = P(sp.ouv || 0, sp.open === 'coul' ? 'Ouverture (0 à 90)' : 'Ouverture (°)', '°');
  const F = {nom:opt.nom || joineryName(sp), cat:isDoor ? 'Portes' : 'Fenêtres', host:'wall', path:opt.path, params, types:opt.types || [{nom:'Sur mesure', p:{}}], cut:{w:'w', h:'h'}, parts:joineryParts(sp), join:sp, made:'menuiserie'};
  if (!F.path) delete F.path;
  return F;
}
/* ---------- bibliothèque de base : fenêtres et portes générées (mêmes identifiants et types qu'avant) ---------- */
(() => {
  const T = (nom, p) => ({nom, p});
  const add = (id, spec, types, path) => { FAMS[id] = joineryFamily(spec, {types, path}); };
  add('fenetre-1v', {kind:'fen', w:0.8, h:1.15, sill:0.95, n:1, frame:'pvc', hinge:'g'}, [T('60 × 75', {w:0.6, h:0.75, sill:1.35}), T('80 × 115', {w:0.8, h:1.15}), T('100 × 135', {w:1.0, h:1.35, sill:0.9})], ['Fenêtres', '1 vantail']);
  add('fenetre-2v', {kind:'fen', w:1.2, h:1.35, sill:0.9, n:2, frame:'pvc'}, [T('100 × 115', {w:1.0, h:1.15, sill:0.95}), T('120 × 135', {w:1.2}), T('140 × 135', {w:1.4})], ['Fenêtres', '2 vantaux']);
  add('fenetre-2v-alu', {kind:'fen', w:1.2, h:1.35, sill:0.9, n:2, frame:'alu', glz:{t:'double', gas:'argon', le:true}}, [T('120 × 135', {}), T('140 × 145', {w:1.4, h:1.45}), T('160 × 145', {w:1.6, h:1.45})], ['Fenêtres', '2 vantaux']);
  add('fenetre-2v-bois', {kind:'fen', w:1.2, h:1.35, sill:0.9, n:2, frame:'bois', bars:{h:1, v:0}}, [T('120 × 135', {}), T('100 × 125', {w:1.0, h:1.25})], ['Fenêtres', '2 vantaux']);
  add('fenetre-3v', {kind:'fen', w:1.8, h:1.35, sill:0.9, n:3, frame:'pvc'}, [T('180 × 135', {}), T('240 × 145', {w:2.4, h:1.45})], ['Fenêtres', '3 vantaux']);
  add('fenetre-ob', {kind:'fen', w:0.8, h:1.15, sill:0.95, n:1, frame:'pvc', open:'ob', hinge:'g'}, [T('80 × 115', {}), T('60 × 95', {w:0.6, h:0.95, sill:1.15})], ['Fenêtres', '1 vantail']);
  add('fenetre-triple', {kind:'fen', w:1.2, h:1.35, sill:0.9, n:2, frame:'pvc', glz:{t:'triple', gas:'argon', le:true}}, [T('120 × 135', {}), T('140 × 145', {w:1.4, h:1.45})], ['Fenêtres', '2 vantaux']);
  add('porte-fenetre', {kind:'pf', w:1.4, h:2.15, n:2, frame:'alu', glz:{saf:'tremp'}}, [T('120 × 215', {w:1.2}), T('140 × 215', {w:1.4}), T('160 × 225', {w:1.6, h:2.25})], ['Fenêtres', 'Portes-fenêtres']);
  add('porte-fenetre-1v', {kind:'pf', w:0.9, h:2.15, n:1, frame:'pvc', hinge:'g', glz:{saf:'tremp'}}, [T('80 × 215', {w:0.8}), T('90 × 215', {}), T('100 × 215', {w:1.0})], ['Fenêtres', 'Portes-fenêtres']);
  add('baie-coulissante', {kind:'coul', w:2.4, h:2.15, n:2, frame:'alu', glz:{saf:'tremp'}}, [T('180 × 215', {w:1.8}), T('240 × 215', {w:2.4}), T('300 × 225', {w:3.0, h:2.25})], ['Fenêtres', 'Baies coulissantes']);
  add('baie-coulissante-3v', {kind:'coul', w:3.6, h:2.15, n:3, frame:'alu', glz:{saf:'tremp'}}, [T('300 × 215', {w:3.0}), T('360 × 215', {})], ['Fenêtres', 'Baies coulissantes']);
  add('baie-coulissante-4v', {kind:'coul', w:4.8, h:2.15, n:4, frame:'alu', glz:{saf:'tremp'}}, [T('400 × 215', {w:4.0}), T('480 × 215', {})], ['Fenêtres', 'Baies coulissantes']);
  add('fenetre-fixe', {kind:'fixe', w:1.0, h:1.0, sill:1.0, n:1, frame:'alu'}, [T('100 × 100', {}), T('Bandeau 300 × 60', {w:3.0, h:0.6, sill:1.6})], ['Fenêtres', 'Fixes']);
  add('fenetre-fixe-grande', {kind:'fixe', w:2.0, h:2.15, sill:0, n:1, frame:'alu', glz:{saf:'feuil'}}, [T('200 × 215', {}), T('120 × 215', {w:1.2})], ['Fenêtres', 'Fixes']);
  add('porte-simple', {kind:'pi', w:0.93, h:2.04, n:1, frame:'boisP', leaf:'pleine', hinge:'g'}, [T('73 × 204', {w:0.73}), T('83 × 204', {w:0.83}), T('93 × 204', {w:0.93})], ['Portes', 'Intérieure', '1 vantail']);
  add('porte-alveolaire', {kind:'pi', w:0.83, h:2.04, n:1, frame:'boisP', leaf:'alveolaire', hinge:'g'}, [T('73 × 204', {w:0.73}), T('83 × 204', {})], ['Portes', 'Intérieure', '1 vantail']);
  add('porte-postformee', {kind:'pi', w:0.83, h:2.04, n:1, frame:'boisP', leaf:'panneaux', hinge:'g'}, [T('73 × 204', {w:0.73}), T('83 × 204', {}), T('93 × 204', {w:0.93})], ['Portes', 'Intérieure', '1 vantail']);
  add('porte-acoustique', {kind:'pi', w:0.93, h:2.04, n:1, frame:'bois', leaf:'acou', hinge:'g'}, [T('83 × 204', {w:0.83}), T('93 × 204', {})], ['Portes', 'Intérieure', '1 vantail']);
  add('porte-double', {kind:'pi', w:1.6, h:2.15, n:2, frame:'bois', leaf:'pleine'}, [T('140 × 215', {w:1.4}), T('160 × 215', {w:1.6})], ['Portes', 'Intérieure', '2 vantaux']);
  add('porte-int-vitree', {kind:'pi', w:0.83, h:2.04, n:1, frame:'bois', leaf:'vitree', hinge:'g', glz:{t:'simple', saf:'tremp'}}, [T('73 × 204', {w:0.73}), T('83 × 204', {}), T('93 × 204', {w:0.93})], ['Portes', 'Intérieure', 'Vitrée']);
  add('porte-atelier', {kind:'pi', w:0.83, h:2.04, n:1, frame:'acier', leaf:'atelier', hinge:'g', glz:{t:'simple', saf:'tremp'}}, [T('83 × 204', {}), T('93 × 204', {w:0.93})], ['Portes', 'Intérieure', 'Vitrée']);
  add('porte-coulissante', {kind:'pi', w:0.83, h:2.04, n:1, frame:'bois', leaf:'pleine', open:'coul'}, [T('83 × 204', {}), T('93 × 204', {w:0.93})], ['Portes', 'Intérieure', 'Coulissante']);
  add('porte-entree', {kind:'pe', w:1.0, h:2.15, n:1, frame:'alu', leaf:'vitree', hinge:'g', glz:{t:'double', gas:'argon', le:true, saf:'feuil'}}, [T('90 × 215', {w:0.9}), T('100 × 215', {w:1.0})], ['Portes', 'Entrée', '1 vantail']);
  add('porte-entree-pleine', {kind:'pe', w:0.9, h:2.15, n:1, frame:'alu', leaf:'rainuree', hinge:'g', iso:true}, [T('90 × 215', {}), T('100 × 225', {w:1.0, h:2.25})], ['Portes', 'Entrée', '1 vantail']);
  add('porte-entree-bois', {kind:'pe', w:0.9, h:2.15, n:1, frame:'bois', leaf:'panneaux', hinge:'g'}, [T('90 × 215', {}), T('100 × 215', {w:1.0})], ['Portes', 'Entrée', '1 vantail']);
  add('porte-entree-tierce', {kind:'pe', w:1.3, h:2.15, n:1, frame:'alu', leaf:'pleine', hinge:'g', tierce:0.35, iso:true, glz:{saf:'feuil'}}, [T('130 × 215 (tierce 35)', {}), T('140 × 225 (tierce 40)', {w:1.4, h:2.25})], ['Portes', 'Entrée', 'Avec tierce']);
  add('porte-entree-imposte', {kind:'pe', w:1.0, h:2.55, n:1, frame:'alu', leaf:'pleine', hinge:'g', imposte:0.35, iso:true, glz:{saf:'feuil'}}, [T('100 × 255 (imposte 35)', {})], ['Portes', 'Entrée', 'Avec tierce']);
  add('porte-entree-2v', {kind:'pe', w:1.5, h:2.2, n:2, frame:'bois', leaf:'vitree', glz:{t:'double', gas:'argon', le:true, saf:'feuil'}}, [T('140 × 215', {w:1.4, h:2.15}), T('150 × 220', {})], ['Portes', 'Entrée', '2 vantaux']);
  add('porte-coupe-feu', {kind:'pi', w:0.93, h:2.04, n:1, frame:'acier', leaf:'pleine', hinge:'g', fire:'EI30'}, [T('93 × 204', {}), T('83 × 204', {w:0.83})], ['Portes', 'Intérieure', 'Coupe-feu']);
  FAMS['porte-coupe-feu'].nom = 'Porte coupe-feu EI 30, huisserie métallique';
  // les familles « FAM_PATH » explicites (13-families-plus) gardent la priorité ; les nouvelles passent par F.path
})();
