/* ============ Sécurité incendie : résistance au feu estimée des parois, exigences réglementaires, verdicts ============
   Estimation INDICATIVE d'aide à la conception (jamais un avis réglementaire ni un PV d'essai) :
   - résistance au feu R (stabilité), E (étanchéité aux flammes), I (isolation thermique) en minutes, puis classement
     européen (15, 20, 30, 45, 60, 90, 120, 180, 240) et équivalent français (SF / PF / CF, arrêté du 22 mars 2004) ;
   - méthode additive par couches, de la face exposée vers la face non exposée (EN 1995-1-2 annexe E, EN 1363 pratique) :
     plaques de plâtre, enduits et laines minérales protègent ; les couches massives (béton EN 1992-1-2 tab. 5.3/5.4/5.8,
     maçonnerie EN 1996-1-2 / DTU 20.1 et données CERIB / FFTB) apportent leur classement ; le bois contribue par sa
     vitesse de carbonisation (EN 1995-1-2 tab. 3.1) ; les isolants combustibles (PSE, XPS, PUR/PIR…) n'apportent rien ;
   - planchers et toitures : feu par dessous (plafond, plénum, isolant, structure) ; murs extérieurs : feu côté intérieur ;
     murs intérieurs : le plus défavorable des deux côtés ;
   - exigences (France) : habitation (arrêté du 31 janvier 1986 modifié, art. 6 à 8), ERP (arrêté du 25 juin 1980, CO 7,
     CO 12, CO 24, CO 28, PE 5), locaux de travail (Code du travail R. 4216-24, arrêté du 5 août 1992), industrie / entrepôts
     (ICPE 1510, arrêté du 11 avril 2017). */
const FIRE_CLASSES = [15, 20, 30, 45, 60, 90, 120, 180, 240];
const fireClass = min => { let c = 0; for (const k of FIRE_CLASSES) if (min >= k - 1e-9) c = k; return c; };
const FR_DUR = {15:'1/4 h', 20:'20 min', 30:'1/2 h', 45:'3/4 h', 60:'1 h', 90:'1 h 30', 120:'2 h', 180:'3 h', 240:'4 h'};
const frDur = c => FR_DUR[c] || (c ? c + ' min' : '—');
/* libellé européen + équivalent français : REI 60 (CF 1 h), EI 30 (CF 1/2 h), R 15 (SF 1/4 h), E 30 (PF 1/2 h) */
function fireName(crit, c){ if (!c) return 'non classé'; const fr = crit === 'R' ? 'SF' : crit === 'E' ? 'PF' : 'CF'; return `${crit} ${c} (${fr} ${frDur(c)})`; }

/* ---------- réaction (Euroclasses) et comportement au feu des matériaux ----------
   role : min (massif minéral, courbe épaisseur → minutes, bear = peut porter) · plate (plaque : t1 première plaque exposée,
   tn plaques suivantes, fall chute) · render (enduit, k min/mm) · wood (bois, beta vitesse de carbonisation mm/min,
   panel = panneau mince) · wool (laine minérale, k min/mm, cap) · comb (combustible, aucune contribution) · metal · glass · none */
const FIRE_CURVES = {
  ba:       [[60, 30], [80, 60], [100, 90], [120, 120], [150, 180], [175, 240]],      // voiles non porteurs / dalles : E et I selon l'épaisseur (EN 1992-1-2 tab. 5.3 et 5.8)
  bear:     [[100, 30], [110, 60], [120, 90], [150, 120], [180, 180], [230, 240]],    // voile porteur, μfi = 0,35, exposé sur une face (tab. 5.4)
  slabA:    [[10, 30], [20, 60], [30, 90], [40, 120], [55, 180], [65, 240]],          // dalle pleine : distance d'axe des armatures a (tab. 5.8)
  betonLeg: [[70, 30], [90, 60], [110, 90], [130, 120], [160, 180], [190, 240]],
  hourdis:  [[160, 30], [200, 60], [250, 90]],                                        // poutrelles-hourdis sans protection (R 30 nu, R 60 avec plafond plâtre)
  parpaing: [[100, 30], [150, 60], [200, 90], [250, 120], [300, 180]],                // bloc creux (CERIB) : + protection de la face exposée
  parpaingP:[[100, 60], [150, 120], [200, 180], [250, 240]],
  brique:   [[100, 30], [150, 60], [200, 90], [250, 120], [300, 180], [375, 240]],    // brique alvéolaire / monomur (FFTB)
  briqueP:  [[100, 90], [150, 120], [200, 180], [250, 240]],
  betCell:  [[75, 60], [100, 90], [150, 120], [200, 180], [250, 240]],                // béton cellulaire (A1, excellent isolant au feu)
  pierre:   [[120, 30], [150, 60], [250, 120], [400, 240]],
  terre:    [[150, 60], [200, 90], [300, 120], [400, 180], [500, 240]],
  carreau:  [[50, 45], [70, 60], [100, 120]],                                         // carreaux de plâtre pleins
  tile:     [[15, 10], [30, 15]],                                                     // tuiles, ardoises : écran, pas d'isolation
  gravel:   [[40, 10], [80, 20]],
};
const FIRE_MATS = {
  parpaing:{eu:'A1', role:'min', curve:'parpaing', bear:true}, parpaingP:{eu:'A1', role:'min', curve:'parpaingP', bear:true}, brique:{eu:'A1', role:'min', curve:'brique', bear:true},
  briqueTh:{eu:'A1', role:'min', curve:'brique', bear:true}, briqueP:{eu:'A1', role:'min', curve:'briqueP', bear:true}, betCell:{eu:'A1', role:'min', curve:'betCell', bear:true},
  pierreCalc:{eu:'A1', role:'min', curve:'pierre', bear:true}, pierreTend:{eu:'A1', role:'min', curve:'pierre', bear:true}, granit:{eu:'A1', role:'min', curve:'pierre', bear:true}, moellon:{eu:'A1', role:'min', curve:'pierre', bear:true},
  terreCrue:{eu:'A1', role:'min', curve:'terre', bear:true}, btc:{eu:'A1', role:'min', curve:'terre', bear:true}, briqueVerre:{eu:'A1', role:'glass'},
  ba:{eu:'A1', role:'min', curve:'ba', bear:true, concrete:true}, beton:{eu:'A1', role:'min', curve:'ba', bear:true, concrete:true}, betonLeg:{eu:'A1', role:'min', curve:'betonLeg', bear:true, concrete:true},
  hourdis:{eu:'A1', role:'min', curve:'hourdis', bear:true, concrete:true}, betonChanvre:{eu:'B-s1,d0', role:'render', k:0.3, cap:30}, betonCire:{eu:'A1', role:'min', curve:'ba'},
  mortier:{eu:'A1', role:'render', k:0.6, cap:20}, enduit:{eu:'A1', role:'render', k:0.6, cap:20}, enduitChaux:{eu:'A1', role:'render', k:0.8, cap:25}, enduitPlatre:{eu:'A1', role:'render', k:1.0, cap:30},
  chape:{eu:'A1', role:'min', curve:'ba'}, chapeAnhy:{eu:'A1', role:'min', curve:'ba'},
  laineVerre:{eu:'A1', role:'wool', k:0.1, cap:10, melt:true}, laine:{eu:'A1', role:'wool', k:0.2, cap:30}, laineRocheD:{eu:'A1', role:'wool', k:0.25, cap:40},
  pse:{eu:'E', role:'comb'}, pseG:{eu:'E', role:'comb'}, xps:{eu:'E', role:'comb'}, pir:{eu:'D-s2,d0', role:'comb'}, pu:{eu:'E', role:'comb'},
  fibreBoisR:{eu:'E', role:'comb', char:true}, fibreBoisS:{eu:'E', role:'comb', char:true}, ouate:{eu:'C-s2,d0', role:'comb', char:true}, chanvre:{eu:'E', role:'comb', char:true},
  liege:{eu:'E', role:'comb', char:true}, laineMouton:{eu:'E', role:'comb'}, verreCell:{eu:'A1', role:'wool', k:0.3, cap:40}, paille:{eu:'E', role:'straw'}, aerogel:{eu:'B-s1,d0', role:'wool', k:0.3, cap:20}, sousCoucheAc:{eu:'E', role:'comb'},
  bois:{eu:'D-s2,d0', role:'wood', beta:0.8}, chene:{eu:'D-s2,d0', role:'wood', beta:0.55}, douglas:{eu:'D-s2,d0', role:'wood', beta:0.8}, meleze:{eu:'D-s2,d0', role:'wood', beta:0.8},
  clt:{eu:'D-s2,d0', role:'wood', beta:0.8, bear:true}, glulam:{eu:'D-s2,d0', role:'wood', beta:0.7, bear:true}, osb:{eu:'D-s2,d0', role:'wood', beta:0.9, panel:true}, contreplaque:{eu:'D-s2,d0', role:'wood', beta:1.0, panel:true},
  mdf:{eu:'D-s2,d0', role:'wood', beta:0.9, panel:true}, agglo:{eu:'D-s2,d0', role:'wood', beta:0.9, panel:true}, fibroCiment:{eu:'A2-s1,d0', role:'plate', t1:12, tn:10, fall:25}, bardageBois:{eu:'D-s2,d0', role:'wood', beta:0.8, panel:true},
  ba13:{eu:'A2-s1,d0', role:'plate', t1:15, tn:13, fall:21}, ba13H:{eu:'A2-s1,d0', role:'plate', t1:15, tn:13, fall:21}, ba13F:{eu:'A2-s1,d0', role:'plate', t1:27, tn:22, fall:35, feu:true},
  carreauPl:{eu:'A1', role:'min', curve:'carreau'}, fermacell:{eu:'A2-s1,d0', role:'plate', t1:20, tn:17, fall:30},
  acier:{eu:'A1', role:'metal', struct:true}, inox:{eu:'A1', role:'metal'}, alu:{eu:'A1', role:'metal', melt:true}, cuivre:{eu:'A1', role:'metal'}, zinc:{eu:'A1', role:'metal', melt:true}, fonte:{eu:'A1', role:'metal', struct:true},
  bacAcier:{eu:'A1', role:'metal', deck:true}, acierLaque:{eu:'A1', role:'metal', struct:true}, aluAnthr:{eu:'A1', role:'metal', melt:true},
  verre:{eu:'A1', role:'glass'}, vitrage:{eu:'A1', role:'glass'}, polycarb:{eu:'C-s2,d0', role:'comb'}, pvc:{eu:'B-s3,d1', role:'comb'}, caoutchouc:{eu:'E', role:'comb'},
  carrelage:{eu:'A1fl', role:'min', curve:'ba'}, faience:{eu:'A1', role:'min', curve:'ba'}, parquet:{eu:'Dfl-s1', role:'wood', beta:0.65, panel:true}, stratifie:{eu:'Dfl-s1', role:'wood', beta:0.9, panel:true},
  pvcSol:{eu:'Bfl-s1', role:'comb'}, moquette:{eu:'Dfl-s1', role:'comb'}, resine:{eu:'Bfl-s1', role:'comb'}, linoleum:{eu:'Cfl-s1', role:'comb'}, pierreSol:{eu:'A1fl', role:'min', curve:'pierre'},
  tuile:{eu:'A1', role:'min', curve:'tile'}, ardoise:{eu:'A1', role:'min', curve:'tile'}, bitume:{eu:'E', role:'comb'}, epdm:{eu:'E', role:'comb'}, paraVapeur:{eu:'E', role:'comb', film:true}, freinVap:{eu:'E', role:'comb', film:true}, paraPluie:{eu:'E', role:'comb', film:true},
  gravier:{eu:'A1', role:'min', curve:'gravel'}, terreVeg:{eu:'A1', role:'min', curve:'terre'},
  airNV:{eu:'—', role:'none'}, airFV:{eu:'—', role:'none'}, sol:{eu:'A1', role:'min', curve:'terre'}, eau:{eu:'—', role:'none'}, textile:{eu:'E', role:'comb'}, feuillageC:{eu:'—', role:'none'}, fleurs:{eu:'—', role:'none'}, vegetal:{eu:'—', role:'none'},
};
const FIRE_CAT_DEFAULT = {'Maçonnerie':{eu:'A1', role:'min', curve:'parpaing', bear:true}, 'Béton et mortiers':{eu:'A1', role:'min', curve:'ba', bear:true, concrete:true}, 'Isolants':{eu:'E', role:'comb'},
  'Bois et dérivés':{eu:'D-s2,d0', role:'wood', beta:0.8}, 'Plâtre et plaques':{eu:'A2-s1,d0', role:'plate', t1:15, tn:13, fall:21}, 'Métaux':{eu:'A1', role:'metal'}, 'Verre et plastiques':{eu:'E', role:'comb'},
  'Revêtements de sol':{eu:'Dfl-s1', role:'comb'}, 'Couverture et étanchéité':{eu:'E', role:'comb'}, "Lames d'air et divers":{eu:'—', role:'none'}};
for (const [id, f] of Object.entries(FIRE_MATS)) if (MATS[id]) MATS[id].fire = f;
/* comportement au feu d'un matériau (de base, du projet ou de « ma bibliothèque ») */
function matFire(id){
  const m = mat(id); if (m.fire) return m.fire; if (FIRE_MATS[id]) return FIRE_MATS[id];
  if (m.R != null) return FIRE_MATS.airNV;
  const base = Object.keys(MATS).find(k => MATS[k].nom && m.nom && m.nom.startsWith(MATS[k].nom)); if (base && FIRE_MATS[base]) return FIRE_MATS[base];   // copie « (perso) » d'un matériau de base
  return FIRE_CAT_DEFAULT[m.cat] || {eu:'—', role:'none'};
}
const curveAt = (C, mm) => { if (!C || mm <= 0) return 0; let p = [0, 0]; for (const q of C){ if (mm < q[0]) return p[1] + (q[1] - p[1]) * (mm - p[0]) / (q[0] - p[0]); p = q; } return p[1]; };
const euComb = eu => /^[DEF]/.test(eu || '');
/* R d'une dalle béton selon la distance d'axe des armatures a (mm) et son épaisseur ; a = enrobage + Ø/2 */
const concreteSlabR = (mm, a) => Math.min(curveAt(FIRE_CURVES.ba, mm), curveAt(FIRE_CURVES.slabA, a));

/* ---------- résistance d'une suite de couches, de la face EXPOSÉE vers la face non exposée ----------
   opts : kind 'wall'|'slab'|'roof', bearing true si la paroi porte (R attendu), lot, cover enrobage (mm), frame (ossature bois / solives supposées) */
function fireAssess(layers, opts = {}){
  const kind = opts.kind || 'wall', cover = opts.cover ?? 30, contribs = [], warns = [];
  let I = 0, E = 0, tprot = 0, tprotCav = 0, cavity = false, struct = null, nPlates = 0, massiveDone = false, hasDeck = false, straw = null, cavityRock = false, combInsul = [], combAfter = false, glassWool = false;
  const protect = v => { if (!struct) tprot += v; if (!cavity) tprotCav += v; };   // protection apportée aux couches porteuses (massives) et à l'ossature (en cavité)
  layers.forEach(([id, e], i) => {
    const f = matFire(id), m = mat(id), mm = Math.round(e * 1000), nom = m.nom, c = {id, nom, mm, eu:f.eu, I:0, E:0, note:''};
    if (massiveDone){ c.note = 'au-delà de la couche massive'; if (f.role === 'comb' && !f.film){ combInsul.push(nom); combAfter = true; } contribs.push(c); return; }   // derrière 240 min, le reste ne change rien
    switch (f.role){
      case 'min': { const v = curveAt(FIRE_CURVES[f.curve] || FIRE_CURVES.ba, mm); c.I = v; c.E = v; c.note = 'couche minérale (épaisseur)';
        if (f.bear && mm >= 70 && !struct){ struct = {idx:i, id, nom, mm, f, kind:'massive'}; c.note = 'couche porteuse · ' + (f.concrete ? 'béton (EN 1992-1-2)' : 'maçonnerie'); } else protect(v);
        if (v >= 240) massiveDone = true; break; }
      case 'plate': { const k = Math.pow(Math.max(mm, 6) / 12.5, 1.2); c.I = (nPlates === 0 ? f.t1 : f.tn) * k; c.E = f.fall * k; nPlates++; c.note = f.feu ? 'plaque feu (type F)' : 'plaque de plâtre'; protect(c.I); break; }
      case 'render': { c.I = Math.min(f.cap, f.k * mm); c.E = c.I; c.note = 'enduit'; protect(c.I); break; }
      case 'wood': { const panel = f.panel || mm < 25, tp = 19 * Math.pow(mm / 20, 1.4), burn = mm / f.beta;
        c.I = panel ? Math.min(tp, burn) : Math.min(tp, Math.max(0, (mm - 20) / f.beta)); c.E = burn; c.note = panel ? `panneau bois, carbonisation ${f.beta} mm/min` : `bois massif, carbonisation ${f.beta} mm/min`;
        if (f.bear && mm >= 60 && !struct){ struct = {idx:i, id, nom, mm, f, kind:'wood'}; c.note = 'bois porteur (section résiduelle, EN 1995-1-2)'; } else protect(c.I * 0.5);
        if (i === 0) warns.push(['info', `Face exposée en bois (${nom}) : réaction au feu ${f.eu}, contribution par carbonisation seulement.`]);
        break; }
      case 'wool': { c.I = Math.min(f.cap, f.k * mm); c.E = c.I * 0.5; c.note = f.melt ? 'laine de verre : fond vers 600 °C, contribution limitée' : 'laine minérale A1, reste en place'; if (f.melt) glassWool = true; else if (mm >= 40) cavityRock = true; if (mm >= 40) cavity = true; protect(c.I); break; }
      case 'comb': { c.note = f.film ? 'film : sans effet' : f.char ? 'isolant combustible (fibres végétales) : contribution négligée' : 'combustible : aucune contribution'; if (!f.film){ combInsul.push(nom); if (struct) combAfter = true; if (mm >= 40) cavity = true; } break; }
      case 'straw': { straw = {idx:i, mm}; cavity = true; c.note = 'botte de paille : protégée par ses enduits'; break; }
      case 'metal': { if (f.deck){ hasDeck = true; c.E = 10; c.note = 'bac acier : écran quelques minutes, pas d\'isolation'; } else if (f.melt){ c.note = 'fond avant 700 °C'; } else { c.E = mm >= 3 ? 10 : 0; c.note = 'acier : conduit la chaleur'; } break; }
      case 'glass': c.note = 'verre : sans résistance au feu (sauf vitrage classé)'; break;
      default: c.note = 'sans effet';
    }
    I += c.I; E += c.E; contribs.push(c);
  });
  // ossature bois / solives : panneaux et isolant en cavité, sans couche massive porteuse
  if (!struct && opts.bearing){
    const wood = layers.some(([id]) => matFire(id).role === 'wood'), ins = layers.some(([id]) => ['wool', 'comb', 'none'].includes(matFire(id).role));
    if (hasDeck) struct = {kind:'deck', nom:'bac acier porteur'}; else if (wood && ins || opts.frame){ struct = {kind:'frame', nom:kind === 'wall' ? 'ossature bois' : kind === 'roof' ? 'charpente bois' : 'solives bois'}; }
    else if (straw) struct = {kind:'straw', nom:'bottes de paille porteuses'};
  }
  // mur paille : classement d'essais (RFCP) si enduit minéral ≥ 25 mm sur la face exposée
  if (straw){ const first = contribs[0], fr = first && matFire(first.id), ok = fr && (fr.role === 'render' || fr.role === 'min') && first.mm >= 25; if (ok){ I = Math.max(I, 90); E = Math.max(E, 90); warns.push(['info', 'Mur en paille enduit : REI 90 obtenu en essais (RFCP, enduits ≥ 25 mm) ; valeur retenue.']); } else warns.push(['bad', 'Paille non protégée par un enduit minéral ≥ 25 mm côté exposé : non classée, réaction au feu E.']); }
  I = Math.min(240, I); E = Math.min(240, E);
  // stabilité R
  let R = null, Rwhy = '';
  if (struct){
    if (struct.kind === 'massive'){
      const f = struct.f, mm = struct.mm;
      if (f.concrete){ const a = cover + 6;
        R = kind === 'wall' ? curveAt(FIRE_CURVES.bear, mm) : f.curve === 'hourdis' ? curveAt(FIRE_CURVES.hourdis, mm) : concreteSlabR(mm, a);
        Rwhy = kind === 'wall' ? `voile béton ${mm} mm, μfi 0,35 (EN 1992-1-2 tab. 5.4)` : f.curve === 'hourdis' ? `poutrelles-hourdis ${mm} mm` : `dalle béton ${mm} mm, distance d'axe des armatures ${a} mm (enrobage ${cover} mm, EN 1992-1-2 tab. 5.8)`; }
      else { R = curveAt(FIRE_CURVES[f.curve], mm); Rwhy = `${struct.nom} ${mm} mm (maçonnerie, données CERIB / FFTB / EN 1996-1-2)`; }
      R += tprot; if (tprot) Rwhy += ` + ${Math.round(tprot)} min de protection`;
    } else if (struct.kind === 'wood'){ const f = struct.f, mm = struct.mm, need = Math.max(0.5 * mm, 60); R = Math.max(0, (mm - need) / f.beta) + tprot; Rwhy = `${struct.nom} ${mm} mm : section résiduelle ≥ ${Math.round(need)} mm à ${f.beta} mm/min (EN 1995-1-2)${tprot ? ` + ${Math.round(tprot)} min de protection` : ''}`; }
    else if (struct.kind === 'frame'){ R = tprotCav + 15 + (cavityRock ? 10 : 0); Rwhy = `${struct.nom} non apparente : ${Math.round(tprotCav)} min de protection des parements + 15 min de bois (sections courantes)${cavityRock ? ' + 10 min (laine de roche en cavité)' : ''}`; if (tprotCav < 5) warns.push(['warn', 'Structure bois sans parement protecteur : R 15 au plus ; ajoutez une plaque de plâtre (BA13 : + 15 min, BA13 feu : + 27 min).']); }
    else if (struct.kind === 'deck'){ R = tprot + 15; Rwhy = `bac acier porteur non protégé : R 15${tprot ? ` + ${Math.round(tprot)} min de protection` : ''}`; warns.push(['warn', 'Acier non protégé : R 15 au plus. Flocage, peinture intumescente ou encoffrement en plaques pour atteindre R 30 à R 120.']); }
    else if (struct.kind === 'straw'){ R = Math.min(I, 90); Rwhy = 'paille porteuse : limité par les enduits'; }
    R = Math.min(240, R);
  } else if (opts.bearing){ R = 15; Rwhy = 'aucune couche porteuse identifiée : R 15 par défaut'; warns.push(['warn', 'Aucune couche porteuse reconnue dans la composition : stabilité au feu non évaluable (R 15 retenu).']); }
  if (combInsul.length){ const ext = kind === 'wall' && combAfter;   // isolant combustible côté extérieur d'un mur porteur : ITE
    warns.push([ext ? 'warn' : 'info', `${[...new Set(combInsul)].join(', ')} : isolant combustible, aucune contribution${ext ? ' · en ITE : bandes de recoupement en laine de roche et protection par enduit (IT 249)' : kind !== 'wall' ? ' · en plénum ou sous plancher : préférer la laine de roche (A1) pour la tenue au feu du plafond' : ' · à protéger par un parement A2 ≥ 12,5 mm'}.`]); }
  if (glassWool) warns.push(['info', 'Laine de verre : fond vers 600 °C, sa contribution est plafonnée à 10 min ; la laine de roche apporte jusqu\'à 30 min.']);
  if (struct?.kind === 'frame' && !cavityRock) warns.push(['info', 'Ossature bois : une laine de roche ≥ 40 mm en cavité protège les montants ou solives (+ 10 min de stabilité).']);
  const Rc = R == null ? null : fireClass(R), Ec = fireClass(E), Ic = fireClass(I), EIc = Math.min(Ec, Ic), REIc = Rc == null ? EIc : Math.min(Rc, EIc);
  const label = Rc == null ? (EIc ? `EI ${EIc}` : 'non classé') : (REIc ? `REI ${REIc}` : 'non classé');
  const crit = Rc != null && Rc <= EIc ? 'R' : Ic <= Ec ? 'I' : 'E';
  const limiting = crit === 'R' ? `stabilité : ${Rwhy}` : crit === 'I' ? 'isolation thermique : cumul des couches (face non exposée < 140 K)' : 'étanchéité aux flammes : cumul des couches';
  const exposedEu = layers.length ? matFire(layers[0][0]).eu : '—';
  return {R, E, I, Rc, Ec, Ic, EIc, REIc, label, crit, limiting, Rwhy, contribs, warns, struct, exposedEu, bearing:!!opts.bearing, confidence:'estimation indicative'};
}

/* ---------- exigences réglementaires (France) selon la destination du projet ---------- */
const FIRE_USAGES = {habitation:'Habitation', erp:'ERP (établissement recevant du public)', bureaux:'Bureaux / locaux de travail', industriel:'Industrie / entrepôt'};
const FIRE_FAMILIES = {'1':'1re famille (maison individuelle, jumelée ou en bande)', '2':'2e famille (collectif ≤ R+3, plancher bas ≤ 8 m)', '3A':'3e famille A (plancher bas ≤ 28 m, accès échelle)', '3B':'3e famille B (plancher bas ≤ 28 m)', '4':'4e famille (plancher bas 28 à 50 m)'};
const fireCfg = () => (state.fire ??= {usage:'habitation', family:'1', erpCat:'5', erpSleep:false, cover:30});
/* plancher bas du dernier niveau occupé (m au-dessus du niveau 0) */
function fireHeight(){ const used = state.levels.map((L, i) => state.els.some(e => e.lvl === i && (e.kind === 'wall' || e.kind === 'slab')) ? L.z : null).filter(z => z != null); return used.length ? Math.max(...used) - (state.levels[0]?.z || 0) : 0; }
function fireLevelsCount(){ return state.levels.filter((L, i) => state.els.some(e => e.lvl === i && (e.kind === 'wall' || e.kind === 'slab'))).length || 1; }
/* → {struct, floor, sep, cage, door, notes, title, refs} en minutes (0 = pas d'exigence) */
function fireReqs(cfg = fireCfg()){
  const h = fireHeight(), n = fireLevelsCount(), Q = (struct, floor, sep, cage, door, title, ref) => ({struct, floor, sep, cage, door, title, ref, h, n});
  if (cfg.usage === 'habitation'){
    const f = cfg.family || '1';
    if (f === '1') return Q(15, 15, 30, 0, 0, 'Habitation 1re famille', 'Arrêté du 31 janvier 1986 modifié, art. 6 (structure SF 1/4 h), art. 7 (planchers CF 1/4 h), art. 8 (séparatifs entre maisons CF 1/2 h)');
    if (f === '2') return Q(30, 30, 30, 30, 15, 'Habitation 2e famille', 'Arrêté du 31 janvier 1986 modifié, art. 6 (SF 1/2 h), art. 7 (CF 1/2 h), art. 8 (séparatifs CF 1/2 h, portes palières PF 1/4 h)');
    if (f === '4') return Q(90, 90, 60, 60, 30, 'Habitation 4e famille', 'Arrêté du 31 janvier 1986 modifié, art. 6 (SF 1 h 30), art. 7 (CF 1 h 30), art. 8 (séparatifs CF 1 h, portes palières PF 1/2 h), escaliers encloisonnés CF 1 h');
    return Q(60, 60, 60, 60, 30, `Habitation 3e famille ${f.slice(1)}`, 'Arrêté du 31 janvier 1986 modifié, art. 6 (SF 1 h), art. 7 (CF 1 h), art. 8 (séparatifs CF 1 h, portes palières PF 1/2 h)' + (f === '3B' ? ', escaliers encloisonnés CF 1 h' : ''));
  }
  if (cfg.usage === 'erp'){
    const cat = String(cfg.erpCat || '5'), sleep = !!cfg.erpSleep;
    if (cat === '5'){ const s = n > 1 || sleep ? 30 : 0; return Q(s, s, s ? 30 : 0, s ? 30 : 0, s ? 30 : 0, 'ERP de 5e catégorie', `Arrêté du 25 juin 1980, art. PE 5 (${n > 1 || sleep ? 'établissement à étage ou avec locaux à sommeil : SF 1/2 h, CF 1/2 h' : 'simple rez-de-chaussée sans locaux à sommeil : pas d\'exigence de résistance au feu'})`); }
    const s = n <= 1 ? 30 : h <= 8 ? (cat === '1' ? 60 : 30) : (cat === '1' ? 90 : 60), ss = sleep ? Math.max(s, 60) : s;
    return Q(ss, ss, Math.max(60, ss), Math.max(60, ss), 30, `ERP de ${cat}${cat === '1' ? 're' : 'e'} catégorie`, `Arrêté du 25 juin 1980, art. CO 12 (structure SF ${frDur(fireClass(ss))}, planchers CF ${frDur(fireClass(ss))} pour un plancher bas ${h > 8 ? '> 8 m' : '≤ 8 m'}), CO 7 (isolement tiers CF 1 h), CO 24 (parois entre locaux et dégagements), CO 28 (locaux à risques), CO 52 (escaliers encloisonnés CF 1 h, portes PF 1/2 h)${sleep ? ' ; locaux à sommeil : SF/CF 1 h minimum' : ''}`);
  }
  if (cfg.usage === 'bureaux'){ const s = n <= 1 ? 0 : h <= 8 ? 30 : 60; return Q(s, s, 60, Math.max(s, 60), 30, 'Bureaux / locaux de travail', `Code du travail, art. R. 4216-24 et arrêté du 5 août 1992 (${n <= 1 ? 'simple rez-de-chaussée : pas d\'exigence de résistance au feu' : h <= 8 ? 'plancher bas ≤ 8 m : SF 1/2 h, CF 1/2 h' : 'plancher bas > 8 m : SF 1 h, CF 1 h'}), R. 4227-24 (locaux à risques CF 1 h), escaliers encloisonnés CF 1 h`); }
  return Q(n <= 1 ? 15 : 60, 60, 120, 60, 120, 'Industrie / entrepôt', `ICPE rubrique 1510, arrêté du 11 avril 2017 (structure R 15 en simple rez-de-chaussée, R 60 avec étage ou mezzanine ; murs séparatifs de cellules et avec les tiers REI 120, portes EI 120 ; planchers REI 60) ; Code du travail R. 4216-24`);
}
const FIRE_ROLES = {'':'Automatique', struct:'Structure (porteur)', sep:'Séparatif (logements, cellules, tiers)', cage:'Cage d\'escalier / gaine', risk:'Local à risques', facade:'Façade non porteuse (pas d\'exigence)', none:'Aucune exigence'};
/* un mur est-il extérieur ? (une seule face dans une pièce) */
function wallIsExterior(w){
  try { const {n} = wallAxis(w), m = V.mul(V.add(w.a, w.b), 0.5), d = wallT(w) / 2 + 0.15, a = roomAt(V.add(m, V.mul(n, d)), w.lvl), b = roomAt(V.sub(m, V.mul(n, d)), w.lvl);
    return a && b ? false : a || b ? true : null; } catch(e){ return null; }
}
/* exposition et couches exposé → non exposé d'un élément ; murs intérieurs : les deux faces (le plus défavorable retenu) */
function fireExposures(el){
  const C = compo(el.type), bearing = el.kind !== 'wall' || (C.lot || 'Gros œuvre') !== 'Second œuvre';
  if (el.kind === 'wall'){ const L = wallLayers(el), ext = wallIsExterior(el), inside = L.slice().reverse(); // composition ext → int
    const nm = Ls => `feu côté ${mat(Ls[0][0]).nom}`;
    return ext === false ? [{side:nm(inside), layers:inside, bearing}, {side:nm(L), layers:L.slice(), bearing}] : [{side:'feu côté intérieur', layers:inside, bearing}]; }
  if (el.kind === 'roof') return [{side:'feu par dessous', layers:C.layers.slice().reverse(), bearing:true, frame:true}];
  const use = elUse(el), L = C.layers.slice();   // dalles : haut → bas ; feu par dessous
  return [{side:use === 'terrePlein' ? 'feu par dessus (dallage sur terre-plein)' : 'feu par dessous', layers:use === 'terrePlein' ? L : L.reverse(), bearing:true, frame:use !== 'terrePlein'}];
}
/* poteau : béton (EN 1992-1-2 tab. 5.2a, méthode A, μfi 0,5), bois (carbonisation), acier (non protégé), maçonnerie */
const COL_TAB = [[240, [[450, 75]]], [180, [[350, 63]]], [120, [[350, 45], [450, 40]]], [90, [[300, 45], [400, 38]]], [60, [[200, 36], [300, 31]]], [30, [[200, 25]]]];
function fireCol(el){
  const f = matFire(el.mat), m = mat(el.mat), b = Math.min(el.w, el.d) * 1000, cover = fireCfg().cover ?? 30, warns = []; let R = 0, why = '';
  if (f.concrete){ const a = cover + 8;
    for (const [cls, opts] of COL_TAB){ const ok = opts.some(([bm, am], i) => { const nx = opts[i + 1]; if (nx && b >= bm && b < nx[0]) return a >= am + (nx[1] - am) * (b - bm) / (nx[0] - bm); return b >= bm && a >= am; }); if (ok){ R = cls; break; } }
    why = `poteau béton ${Math.round(b)} mm, distance d'axe ${a} mm, μfi 0,5 (EN 1992-1-2 tab. 5.2a)`; if (!R) warns.push(['warn', 'Section ou enrobage insuffisants pour R 30 : élargir le poteau ou augmenter l\'enrobage.']); }
  else if (f.role === 'wood'){ R = Math.max(0, (0.2 * b - 7) / f.beta); why = `poteau bois ${Math.round(b)} mm : 4 faces exposées, carbonisation ${f.beta} mm/min, couche sans résistance 7 mm (EN 1995-1-2), section résiduelle ≥ 60 %`; }
  else if (f.role === 'metal'){ R = f.struct ? 15 : 0; why = f.struct ? 'acier non protégé : R 15 (sections courantes)' : `${m.nom} : non évaluable`; warns.push(['warn', 'Acier non protégé : flocage, peinture intumescente ou encoffrement pour R 30 à R 120 (épaisseur selon le facteur de massiveté).']); }
  else if (f.role === 'min'){ R = curveAt(FIRE_CURVES[f.curve] || FIRE_CURVES.ba, b); why = `${m.nom} ${Math.round(b)} mm (maçonnerie)`; }
  else { why = `${m.nom} : résistance au feu non évaluable`; warns.push(['warn', 'Matériau de poteau sans règle d\'estimation.']); }
  const Rc = fireClass(Math.min(240, R));
  return {R, Rc, Ec:null, Ic:null, REIc:Rc, label:Rc ? `R ${Rc}` : 'non classé', crit:'R', limiting:`stabilité : ${why}`, Rwhy:why, contribs:[], warns, bearing:true, exposedEu:f.eu, confidence:'estimation indicative'};
}
/* rôle au feu d'un élément (automatique ou choisi) et exigence applicable (minutes, critère) */
function fireRoleOf(el){
  if (el.fireRole) return el.fireRole;
  if (el.kind === 'col') return 'struct';
  if (el.kind === 'roof') return 'struct';
  if (el.kind === 'slab'){ const u = elUse(el); return u === 'plancherInt' ? 'floor' : u === 'toiture' ? 'struct' : 'none'; }
  const C = compo(el.type); if ((C.lot || 'Gros œuvre') === 'Second œuvre') return 'none';
  return 'struct';
}
function fireReqFor(el, Rq = fireReqs()){
  const role = fireRoleOf(el);
  const reqs = {struct:{min:Rq.struct, crit:'R', what:el.kind === 'wall' && wallIsExterior(el) === true ? 'stabilité de la structure (mur extérieur porteur, feu intérieur ; pas d\'exigence coupe-feu pour la façade elle-même)' : 'stabilité de la structure'}, floor:{min:Rq.floor, crit:'REI', what:'plancher coupe-feu'}, sep:{min:Math.max(Rq.sep, el.kind === 'slab' ? Rq.floor : 0), crit:'REI', what:'paroi séparative coupe-feu'},
    cage:{min:Rq.cage, crit:'REI', what:'cage d\'escalier / gaine coupe-feu'}, risk:{min:Math.max(60, Rq.sep), crit:'REI', what:'local à risques coupe-feu'}, facade:{min:0, crit:'', what:'façade non porteuse : pas d\'exigence coupe-feu (propagation par les façades, règle du C+D : à vérifier séparément)'}, none:{min:0, crit:'', what:'aucune exigence de résistance au feu'}};
  const r = reqs[role] || reqs.none; return {role, ...r, title:Rq.title};
}
/* bilan d'un élément : estimation + exigence + verdict ok / bad / warn / na */
function fireOf(el){
  const req = fireReqFor(el), cfg = fireCfg();
  let res, side = '';
  if (el.kind === 'col') res = fireCol(el);
  else { const ex = fireExposures(el).map(x => ({x, r:fireAssess(x.layers, {kind:el.kind, bearing:x.bearing, cover:cfg.cover ?? 30, frame:x.frame})}));
    ex.sort((p, q) => p.r.REIc - q.r.REIc); res = ex[0].r; side = ex[0].x.side; res.sides = ex.map(e => ({side:e.x.side, label:e.r.label})); }
  let verdict = 'na', why = '';
  if (req.min){ const have = req.crit === 'R' ? res.Rc : res.REIc;
    if (have == null){ verdict = 'warn'; why = 'stabilité non évaluable pour cette composition'; }
    else if (have >= req.min){ verdict = 'ok'; why = `${fireName(req.crit === 'R' ? 'R' : (res.Rc == null ? 'EI' : 'REI'), have)} estimé ≥ ${fireName(req.crit === 'R' ? 'R' : 'REI', req.min)} exigé`; }
    else { verdict = res.confidence && have >= req.min * 0.75 && have >= 15 ? 'warn' : 'bad'; why = `${fireName(req.crit === 'R' ? 'R' : (res.Rc == null ? 'EI' : 'REI'), have)} estimé < ${fireName(req.crit === 'R' ? 'R' : 'REI', req.min)} exigé`; }
  } else why = req.what;
  return {el, res, req, side, verdict, why};
}
function fireAll(){ return state.els.filter(e => ['wall', 'slab', 'roof', 'col'].includes(e.kind)).map(fireOf); }
/* portes : menuiseries générées par l'outil Menuiserie (F.join, joineryPerf) sur les parois séparatives / cages */
function fireDoors(){
  if (typeof joineryPerf !== 'function') return [];
  const Rq = fireReqs(), out = [];
  for (const el of state.els){
    if (el.kind !== 'inst' || !el.host) continue; const F = fam(el.fam); if (!F?.join || !['pi', 'pe'].includes(F.join.kind)) continue;
    const w = getEl(el.host); if (!w) continue; const role = fireRoleOf(w); if (!['sep', 'cage', 'risk'].includes(role)) continue;
    let perf = null; try { perf = joineryPerf(F, famScope(F, el)); } catch(e){}
    const need = role === 'risk' ? Math.max(30, Rq.door) : Rq.door, have = perf?.fire ? +(String(perf.fire).match(/(\d+)/)?.[1] || 0) : 0, crit = (perf?.fire || '').replace(/\d+/, '') || '—';
    out.push({el, F, wall:w, role, need, have, fire:perf?.fire || '', verdict:!need ? 'na' : have >= need ? 'ok' : 'bad', label:need ? `${role === 'risk' ? 'EI' : 'E'} ${need} (${role === 'risk' ? 'CF' : 'PF'} ${frDur(need)})` : 'aucune', crit});
  }
  return out;
}
const fireRoleName = r => ({struct:'porteur', floor:'plancher', sep:'séparatif', cage:'cage / gaine', risk:'local à risques', facade:'façade', none:'sans exigence'})[r] || r;
const fireKindName = el => el.kind === 'wall' ? 'Mur' : el.kind === 'slab' ? 'Dalle' : el.kind === 'roof' ? 'Toiture' : 'Poteau';
const fireElName = el => `${fireKindName(el)} ${el.id}`;
const verdictChip = v => v === 'ok' ? '<i class="gr gA" title="Conforme (estimation)">✓</i>' : v === 'bad' ? '<i class="gr gD" title="Insuffisant (estimation)">✕</i>' : v === 'warn' ? '<i class="gr gC" title="À vérifier">?</i>' : '';
const FIRE_DISCLAIMER = 'Estimation indicative d\'aide à la conception (méthode additive simplifiée, valeurs tabulées des Eurocodes et données fabricants) : à confirmer par un PV d\'essai, un avis de chantier ou l\'avis d\'un bureau de contrôle. Ce n\'est pas un avis réglementaire.';

/* ---------- carte d'un élément (propriétés) ---------- */
function fireCard(el){
  if (!['wall', 'slab', 'roof', 'col'].includes(el.kind)) return '';
  let o; try { o = fireOf(el); } catch(e){ console.warn('incendie', e); return ''; }
  const {res, req, verdict, why, side} = o, has = v => v == null ? '—' : Math.round(v);
  const roleSel = `<label class="f wide"><span>Rôle au feu</span><span class="in"><select id="f-fireRole" data-f="fireRole">${Object.entries(FIRE_ROLES).filter(([k]) => el.kind === 'wall' || !['facade'].includes(k)).map(([k, n]) => `<option value="${k}"${(el.fireRole || '') === k ? ' selected' : ''}>${esc(n)}${!k ? ` (${esc(fireRoleName(fireRoleOf({...el, fireRole:''})))})` : ''}</option>`).join('')}</select></span></label>`;
  const warns = [[verdict === 'ok' ? 'ok' : verdict === 'bad' ? 'bad' : verdict === 'warn' ? 'warn' : 'info', (verdict === 'na' ? '' : verdict === 'ok' ? 'Conforme (estimation) : ' : verdict === 'bad' ? 'Insuffisant (estimation) : ' : 'À vérifier : ') + why + (req.min ? ` · ${req.what}` : '')], ...res.warns.slice(0, 3)];
  return `<div class="grp fire"><h3>Sécurité incendie</h3><div class="perf">
    <div class="pc"><span>Résistance estimée</span><b>${esc(res.label)}</b><em>${esc(side || 'poteau')}${res.sides && res.sides.length > 1 && res.sides.some(s => s.label !== res.sides[0].label) ? ` · ${res.sides.map(s => `${s.side} : ${s.label}`).join(' · ')}` : res.sides && res.sides.length > 1 ? ' · même résultat sur les deux faces' : ''}</em>${verdictChip(verdict)}</div>
    <div class="pc"><span>Exigence</span><b>${req.min ? `${req.crit} ${req.min}` : 'aucune'}</b><em>${req.min ? `${req.crit === 'R' ? 'SF' : 'CF'} ${frDur(req.min)} · ${esc(fireRoleName(req.role))}` : esc(fireRoleName(req.role))}</em></div>
    <div class="pc"><span>R · E · I</span><b>${has(res.R)} · ${has(res.E)} · ${has(res.I)}</b><em>minutes</em></div>
    <div class="pc"><span>Face exposée</span><b>${esc(res.exposedEu || '—')}</b><em>réaction au feu</em></div></div>
    <p class="hint">Critère limitant · ${esc(res.limiting)}.</p>
    <ul class="warns">${warns.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join('')}</ul>
    <div class="fields">${roleSel}</div>
    <p class="hint">${esc(req.title)}. ${FIRE_DISCLAIMER}</p></div>`;
}
/* ---------- carte du projet ---------- */
function fireProjectCard(){
  if (!state.els.some(e => ['wall', 'slab', 'roof', 'col'].includes(e.kind))) return '';
  const cfg = fireCfg(), Rq = fireReqs(cfg); let all = [], doors = [];
  try { all = fireAll(); doors = fireDoors(); } catch(e){ console.warn('incendie', e); return ''; }
  const bad = all.filter(o => o.verdict === 'bad'), warn = all.filter(o => o.verdict === 'warn'), ok = all.filter(o => o.verdict === 'ok'), dbad = doors.filter(d => d.verdict === 'bad');
  const sel = (k, opts, cur) => `<select data-fire="${k}">${opts.map(([v, n]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  const h = fireHeight(), n = fireLevelsCount();
  let extra = '';
  if (cfg.usage === 'habitation'){ const sug = n <= 2 ? '1' : h <= 8 ? '2' : h <= 28 ? '3B' : '4', cur = cfg.family || '1';
    extra = `<label class="f wide"><span>Famille</span><span class="in">${sel('family', Object.entries(FIRE_FAMILIES), cur)}</span></label>${(sug === '1' ? !/^1|^2/.test(cur) : sug !== cur && !(sug === '3B' && cur === '3A')) ? `<p class="hint">D'après la hauteur du projet (${nf(h, 1)} m, ${n} niveau${n > 1 ? 'x' : ''}) : ${esc(FIRE_FAMILIES[sug])}${sug === '1' ? ', ou 2e famille s\'il s\'agit d\'un collectif' : ''}.</p>` : ''}`; }
  else if (cfg.usage === 'erp') extra = `<label class="f"><span>Catégorie</span><span class="in">${sel('erpCat', [['1', '1re (> 1 500 pers.)'], ['2', '2e (701 à 1 500)'], ['3', '3e (301 à 700)'], ['4', '4e (≤ 300)'], ['5', '5e (petits établissements)']], cfg.erpCat || '5')}</span></label><label class="f wide rchk"><input type="checkbox" data-fire="erpSleep"${cfg.erpSleep ? ' checked' : ''}> Locaux à sommeil (types O, U, J, R internat)</label>`;
  const rows = [...bad, ...warn].map(o => `<tr><td><button class="tlink" data-fsel="${o.el.id}">${esc(fireElName(o.el))}</button><div class="mut">${esc(o.el.kind === 'col' ? mat(o.el.mat).nom : compo(o.el.type).nom)}</div></td><td class="mut">${esc(fireRoleName(o.req.role))}</td><td class="n">${esc(o.res.label)}</td><td class="n">${o.req.crit} ${o.req.min}</td><td>${verdictChip(o.verdict)}</td></tr>`).join('');
  const drows = doors.map(d => `<tr><td><button class="tlink" data-fsel="${d.el.id}">${esc(d.F.nom)}</button><div class="mut">dans ${esc(fireElName(d.wall))} (${esc(fireRoleName(d.role))})</div></td><td class="n">${esc(d.fire || 'non classée')}</td><td class="n">${esc(d.label)}</td><td>${verdictChip(d.verdict)}</td></tr>`).join('');
  return `<div class="grp fire"><h3>Sécurité incendie</h3>
    <div class="fields"><label class="f wide"><span>Destination du bâtiment</span><span class="in">${sel('usage', Object.entries(FIRE_USAGES), cfg.usage)}</span></label>${extra}
      <label class="f"><span>Enrobage des armatures</span><span class="in"><input data-fire="cover" type="number" step="5" min="15" max="70" value="${cfg.cover ?? 30}"><em>mm</em></span></label>
      <div class="f"><span>Plancher bas du dernier niveau</span><div class="site-v">${nf(h, 2)} m · ${n} niveau${n > 1 ? 'x' : ''}</div></div></div>
    <p class="hint"><b>${esc(Rq.title)}</b> · structure ${Rq.struct ? fireName('R', Rq.struct) : 'pas d\'exigence'} · planchers ${Rq.floor ? fireName('REI', Rq.floor) : 'pas d\'exigence'} · séparatifs ${Rq.sep ? fireName('REI', Rq.sep) : '—'} · cages d'escalier ${Rq.cage ? fireName('REI', Rq.cage) : '—'} · portes ${Rq.door ? fireName('E', Rq.door) : '—'}.<br>${esc(Rq.ref)}.</p>
    <div class="perf"><div class="pc ${bad.length ? 'g-bad' : 'g-ok'}"><span>Parois vérifiées</span><b>${all.filter(o => o.verdict !== 'na').length}</b><em>${ok.length} conforme${ok.length > 1 ? 's' : ''} · ${bad.length} insuffisante${bad.length > 1 ? 's' : ''} · ${warn.length} à vérifier</em></div>
      <div class="pc"><span>Sans exigence</span><b>${all.filter(o => o.verdict === 'na').length}</b><em>façades, cloisons, dallages</em></div></div>
    ${rows ? `<table class="tbl rooms"><thead><tr><th>Élément</th><th>Rôle</th><th class="n">Estimé</th><th class="n">Exigé</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<ul class="warns"><li class="ok">Toutes les parois soumises à une exigence sont conformes (estimation).</li></ul>'}
    ${doors.length ? `<h4 class="mut" style="margin:10px 0 4px">Portes sur parois séparatives${dbad.length ? ` · ${dbad.length} à revoir` : ''}</h4><table class="tbl rooms"><thead><tr><th>Porte</th><th class="n">Classée</th><th class="n">Exigé</th><th></th></tr></thead><tbody>${drows}</tbody></table>` : ''}
    <p class="hint">Rôle de chaque paroi détecté automatiquement (porteur, façade, plancher, cloison) : précisez « Séparatif », « Cage d'escalier » ou « Local à risques » dans les propriétés de l'élément. ${FIRE_DISCLAIMER}</p>
    <div class="btns tight"><button class="btn" data-act="fire-pdf">Rapport sécurité incendie (PDF)</button></div></div>`;
}
/* ---------- section de la fiche composition (61-composer) ---------- */
function fireCompoHTML(W){
  const bearing = W.kind !== 'wall' || (W.lot || 'Gros œuvre') !== 'Second œuvre', cover = fireCfg().cover ?? 30;
  const ex = W.kind === 'wall' ? [['feu côté intérieur', W.layers.slice().reverse()], ['feu côté extérieur', W.layers.slice()]] : [[W.use === 'terrePlein' ? 'feu par dessus' : 'feu par dessous', W.use === 'terrePlein' ? W.layers.slice() : W.layers.slice().reverse()]];
  const res = ex.map(([side, L]) => [side, fireAssess(L, {kind:W.kind, bearing, cover, frame:W.kind !== 'wall'})]), worst = res.slice().sort((a, b) => a[1].REIc - b[1].REIc)[0][1];
  const rows = worst.contribs.map(c => `<tr><td>${esc(c.nom)}</td><td class="n">${c.mm}</td><td class="n">${esc(c.eu)}</td><td class="n">${Math.round(c.I)}</td><td class="n">${Math.round(c.E)}</td><td class="mut">${esc(c.note)}</td></tr>`).join('');
  return `<div class="grp fire"><h3>Sécurité incendie (estimation)</h3><div class="perf">${res.map(([side, r]) => `<div class="pc"><span>${esc(side)}</span><b>${esc(r.label)}</b><em>R ${r.R == null ? '—' : Math.round(r.R)} · E ${Math.round(r.E)} · I ${Math.round(r.I)} min</em></div>`).join('')}</div>
    <p class="hint">Critère limitant (cas le plus défavorable) · ${esc(worst.limiting)}.</p>
    <div class="wrap"><table class="tbl"><thead><tr><th>Couche (exposée → non exposée)</th><th class="n">mm</th><th class="n">Réaction</th><th class="n">I min</th><th class="n">E min</th><th>Rôle au feu</th></tr></thead><tbody>${rows}</tbody></table></div>
    <ul class="warns">${worst.warns.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join('')}</ul><p class="hint">${FIRE_DISCLAIMER}</p></div>`;
}
/* ---------- rapport imprimable ---------- */
function fireHTML(){
  const cfg = fireCfg(), Rq = fireReqs(cfg), all = fireAll(), doors = fireDoors(), today = new Date().toLocaleDateString('fr-FR'), logo = document.querySelector('.brand-mark img')?.src || '';
  const vtxt = v => v === 'ok' ? 'Conforme' : v === 'bad' ? 'Insuffisant' : v === 'warn' ? 'À vérifier' : 'Sans exigence';
  const byLvl = {}; for (const o of all) (byLvl[o.el.lvl] ??= []).push(o);
  const compos = new Map(); for (const o of all) if (o.el.kind !== 'col'){ const k = o.el.type; if (!compos.has(k)) compos.set(k, {C:compo(k), o}); }
  const elsHTML = Object.entries(byLvl).map(([li, list]) => `<h3>${esc(lvlName(+li))}</h3><table><thead><tr><th>Élément</th><th>Composition / matériau</th><th>Rôle</th><th>Exposition</th><th class="n">R</th><th class="n">E</th><th class="n">I</th><th class="n">Classe estimée</th><th class="n">Exigence</th><th>Verdict</th></tr></thead><tbody>
    ${list.map(o => `<tr class="v-${o.verdict}"><td>${esc(fireElName(o.el))}</td><td>${esc(o.el.kind === 'col' ? mat(o.el.mat).nom + ` ${n0(o.el.w * 100)} × ${n0(o.el.d * 100)} cm` : compo(o.el.type).nom)}</td><td>${esc(fireRoleName(o.req.role))}</td><td>${esc(o.side || '—')}</td><td class="n">${o.res.R == null ? '—' : Math.round(o.res.R)}</td><td class="n">${o.res.E == null ? '—' : Math.round(o.res.E)}</td><td class="n">${o.res.I == null ? '—' : Math.round(o.res.I)}</td><td class="n"><b>${esc(o.res.label)}</b></td><td class="n">${o.req.min ? `${o.req.crit} ${o.req.min} (${o.req.crit === 'R' ? 'SF' : 'CF'} ${frDur(o.req.min)})` : '—'}</td><td>${vtxt(o.verdict)}</td></tr>`).join('')}</tbody></table>`).join('');
  const compHTML = [...compos.values()].map(({C, o}) => { const r = o.res; return `<section class="cmp"><h3>${esc(C.nom)} <small>${esc(o.side)} · ${esc(r.label)}</small></h3><table><thead><tr><th>Couche (exposée → non exposée)</th><th class="n">mm</th><th class="n">Réaction</th><th class="n">I min</th><th class="n">E min</th><th>Rôle au feu</th></tr></thead><tbody>${r.contribs.map(c => `<tr><td>${esc(c.nom)}</td><td class="n">${c.mm}</td><td class="n">${esc(c.eu)}</td><td class="n">${Math.round(c.I)}</td><td class="n">${Math.round(c.E)}</td><td>${esc(c.note)}</td></tr>`).join('')}</tbody></table>
    <p><b>Critère limitant :</b> ${esc(r.limiting)}.</p>${r.warns.length ? `<ul>${r.warns.map(([, t]) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</section>`; }).join('');
  const doorsHTML = doors.length ? `<h2>Portes sur parois séparatives</h2><table><thead><tr><th>Porte</th><th>Paroi</th><th class="n">Classement</th><th class="n">Exigence</th><th>Verdict</th></tr></thead><tbody>${doors.map(d => `<tr class="v-${d.verdict}"><td>${esc(d.F.nom)}</td><td>${esc(fireElName(d.wall))} · ${esc(fireRoleName(d.role))}</td><td class="n">${esc(d.fire || 'non classée')}</td><td class="n">${esc(d.label)}</td><td>${vtxt(d.verdict)}</td></tr>`).join('')}</tbody></table>` : '';
  const title = `Sécurité incendie · ${state.name}`, bad = all.filter(o => o.verdict === 'bad').length, warn = all.filter(o => o.verdict === 'warn').length;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:A4 landscape;margin:16mm 14mm 18mm 14mm;@bottom-left{content:"${esc(title).replace(/"/g, '')}";font:8pt Arial,sans-serif;color:#8A8F98}@bottom-right{content:"Page " counter(page) " / " counter(pages);font:8pt Arial,sans-serif;color:#8A8F98}}
    *{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font:9.5pt/1.4 Inter,"Segoe UI",Arial,sans-serif;color:#1D2026}
    .hd{display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:2px solid #1D2026;margin-bottom:10px}.hd img{width:44px;height:44px;border-radius:10px}.hd .t{flex:1}.hd .k{font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:#6B7079;font-weight:700}.hd h1{margin:2px 0 0;font-size:16pt}
    h2{font-size:12pt;margin:14px 0 6px;border-bottom:1px solid #C9CED6;padding-bottom:3px}h3{font-size:10.5pt;margin:10px 0 4px}h3 small{font-weight:500;color:#6B7079}
    table{width:100%;border-collapse:collapse;margin:4px 0 8px;font-size:8.8pt}th,td{border:1px solid #D7DBE2;padding:3px 6px;vertical-align:top;text-align:left}th{background:#EEF1F5;font-size:8pt;text-transform:uppercase;letter-spacing:.04em}td.n,th.n{text-align:right;white-space:nowrap}
    tr.v-ok td:last-child{color:#1E8E4E;font-weight:700}tr.v-bad td:last-child{color:#C0392B;font-weight:700}tr.v-warn td:last-child{color:#B7791F;font-weight:700}
    .kpi{display:flex;gap:10px;margin:6px 0}.kpi div{border:1px solid #D7DBE2;border-radius:8px;padding:6px 10px;min-width:120px}.kpi b{display:block;font-size:14pt}.kpi span{font-size:8pt;color:#6B7079;text-transform:uppercase;letter-spacing:.04em}
    .box{border:1px solid #D7DBE2;border-radius:8px;padding:8px 12px;margin:6px 0;background:#F7F8FA}.cmp{page-break-inside:avoid}.disc{font-size:8.5pt;color:#6B7079;border-top:1px solid #C9CED6;margin-top:12px;padding-top:8px}ul{margin:4px 0;padding-left:18px}
  </style></head><body>
  <div class="hd">${logo ? `<img src="${logo}" alt="">` : ''}<div class="t"><div class="k">ARCHIPLAN · Studio Prism · aide à la conception</div><h1>Rapport sécurité incendie · ${esc(state.name)}</h1><div>${esc(state.site?.label || '')}${state.site?.label ? ' · ' : ''}${today}</div></div></div>
  <div class="box"><b>${esc(Rq.title)}</b> · plancher bas du dernier niveau à ${nf(Rq.h, 2)} m · ${Rq.n} niveau${Rq.n > 1 ? 'x' : ''} · enrobage des armatures ${cfg.cover ?? 30} mm.<br>
    Exigences retenues : structure ${Rq.struct ? fireName('R', Rq.struct) : 'aucune'} · planchers ${Rq.floor ? fireName('REI', Rq.floor) : 'aucune'} · parois séparatives ${Rq.sep ? fireName('REI', Rq.sep) : 'aucune'} · cages d'escalier et gaines ${Rq.cage ? fireName('REI', Rq.cage) : 'aucune'} · portes ${Rq.door ? fireName('E', Rq.door) : 'aucune'}.<br><small>${esc(Rq.ref)}.</small></div>
  <div class="kpi"><div><span>Parois vérifiées</span><b>${all.filter(o => o.verdict !== 'na').length}</b></div><div><span>Conformes</span><b>${all.filter(o => o.verdict === 'ok').length}</b></div><div><span>Insuffisantes</span><b>${bad}</b></div><div><span>À vérifier</span><b>${warn}</b></div><div><span>Sans exigence</span><b>${all.filter(o => o.verdict === 'na').length}</b></div></div>
  <h2>Parois et éléments</h2>${elsHTML}${doorsHTML}
  <h2>Compositions : détail de l'estimation</h2>${compHTML}
  <h2>Méthode et hypothèses</h2><ul><li>Méthode additive par couches de la face exposée vers la face non exposée (EN 1995-1-2 annexe E, pratique EN 1363) : plaques de plâtre (BA13 : 15 min la première, 13 min les suivantes ; type F : 27 / 22 min), enduits (0,6 à 1 min/mm), laines minérales (laine de roche 0,2 min/mm, plafonnée à 30 min ; laine de verre plafonnée à 10 min), panneaux bois 19·(e/20)^1,4 min.</li>
  <li>Béton armé : EN 1992-1-2 méthode tabulée (voiles porteurs tab. 5.4 μfi 0,35 ; dalles tab. 5.8 selon l'épaisseur et la distance d'axe des armatures a = enrobage + 6 mm ; poteaux tab. 5.2a méthode A, μfi 0,5, a = enrobage + 8 mm). Maçonnerie : EN 1996-1-2 et données CERIB / FFTB (bloc creux 20 cm : REI 90, 120 si protégé). Béton cellulaire, pierre, terre crue : valeurs usuelles.</li>
  <li>Bois : vitesse de carbonisation EN 1995-1-2 tab. 3.1 (résineux 0,8 mm/min notionnel, feuillus 0,55, lamellé-collé 0,7, panneaux 0,9 à 1,0) ; panneaux porteurs : section résiduelle ≥ 50 % ; ossatures et solives non apparentes : protection des parements + 15 min.</li>
  <li>Isolants combustibles (PSE, XPS, PUR/PIR, fibres végétales) : aucune contribution ; acier non protégé : R 15 ; murs en paille enduits ≥ 25 mm : REI 90 (essais RFCP).</li>
  <li>Exposition : planchers et toitures par dessous ; murs extérieurs côté intérieur ; murs intérieurs : la face la plus défavorable. Rôles détectés automatiquement (porteur / façade / cloison / plancher) ou précisés dans les propriétés (séparatif, cage, local à risques).</li>
  <li>Équivalences françaises (arrêté du 22 mars 2004) : SF ↔ R, PF ↔ E, CF ↔ REI / EI.</li></ul>
  <p class="disc">${FIRE_DISCLAIMER} Les exigences citées sont un rappel synthétique des textes (habitation : arrêté du 31 janvier 1986 modifié ; ERP : arrêté du 25 juin 1980 ; locaux de travail : Code du travail ; entrepôts : arrêté du 11 avril 2017) : vérifiez le texte applicable, les façades (C+D), le désenfumage, les dégagements et la réaction au feu des revêtements.</p>
  </body></html>`;
}
function printFire(){
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  f.srcdoc = fireHTML(); f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){ toast('Impression impossible dans ce navigateur'); } setTimeout(() => f.remove(), 60000); };
}

/* accès de test / débogage */
window.APFire = {assess:fireAssess, of:fireOf, all:fireAll, reqs:fireReqs, doors:fireDoors, html:fireHTML, compos:() => COMPOS, col:fireCol};
