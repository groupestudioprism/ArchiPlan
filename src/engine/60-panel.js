/* ============ Panneau : propriétés, bibliothèque, métré ============ */
let activeTab = 'props', libTab = 'fams', libQuery = '', libCat = '';
const USES = {mur:'Mur extérieur', plancherBas:'Plancher bas (vide sanitaire, extérieur)', terrePlein:'Dallage sur terre-plein', plancherInt:'Plancher intermédiaire', toiture:'Toiture / plancher haut'};
const elUse = el => el.kind === 'wall' ? 'mur' : el.kind === 'roof' ? 'toiture' : (el.use || (el.lvl === 0 ? 'terrePlein' : 'plancherInt'));
// couches côté intérieur → extérieur pour les calculs
function layersInToOut(el){
  if (el.kind === 'wall') return wallLayers(el).slice().reverse();         // murs : la composition est saisie extérieur → intérieur
  if (el.kind === 'roof') return compo(el.type).layers.slice().reverse();   // toitures : couverture (dessus) → parement (dessous)
  const L = compo(el.type).layers.slice();                                   // planchers : haut → bas
  return elUse(el) === 'toiture' ? L.reverse() : L;
}
function field(label, f, val, unit, step = '0.01', wide){
  return `<label class="f${wide ? ' wide' : ''}"><span>${label}</span><span class="in"><input id="f-${f}" data-f="${f}" type="number" step="${step}" inputmode="decimal" value="${rnd(val)}"><em>${unit}</em></span></label>`;
}
function selectField(label, f, opts, cur, wide = true){
  return `<label class="f${wide ? ' wide' : ''}"><span>${label}</span><span class="in"><select id="f-${f}" data-f="${f}">${opts.map(([k, n]) => `<option value="${esc(k)}"${String(k) === String(cur) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></span></label>`;
}
function matOptions(){
  const by = {}; for (const [k, m] of Object.entries(libMats())) (by[m.cat || 'Divers'] ??= []).push([k, m.nom]);
  return Object.entries(by).map(([c, l]) => `<optgroup label="${esc(c)}">${l.sort((a, b) => a[1].localeCompare(b[1], 'fr')).map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</optgroup>`).join('');
}
function matSelect(label, f, cur, wide = true){ return `<label class="f${wide ? ' wide' : ''}"><span>${label}</span><span class="in"><select id="f-${f}" data-f="${f}">${matOptions().replace(`value="${esc(cur)}"`, `value="${esc(cur)}" selected`)}</select></span></label>`; }
const lvlOpts = () => state.levels.map((l, i) => [i, `${l.n} (${nf(l.z)} m)`]);
function layerBar(layers){
  const T = layers.reduce((s, l) => s + l[1], 0) || 1;
  return `<span class="lbar">${layers.map(([m, e]) => `<i style="flex:${e / T};background:${mat(m).color}" title="${esc(mat(m).nom)} · ${nf(e * 100, 1)} cm"></i>`).join('')}</span>`;
}
function layerTable(layers, area2d, isWall){
  let rows = '', tm = 0;
  layers.forEach(([m, e], i) => {
    const M = mat(m), mass = area2d * e * (M.R != null ? 0 : M.rho); tm += mass;
    rows += `<tr><td>${i + 1}</td><td><span class="sw" style="background:${M.color}"></span>${esc(M.nom)}</td><td class="n">${nf(e * 1000, 1)}</td><td class="n">${M.R != null ? 'R ' + nf(M.R, 2) : nf(M.lambda, 3)}</td><td class="n">${n0(mass)}</td></tr>`;
  });
  return `<div class="wrap"><table class="tbl"><thead><tr><th>#</th><th>Couche ${isWall ? '(ext. → int.)' : '(haut → bas)'}</th><th class="n">mm</th><th class="n">λ</th><th class="n">kg</th></tr></thead><tbody>${rows}<tr class="tot"><td></td><td>Total</td><td class="n">${nf(layers.reduce((s, l) => s + l[1], 0) * 1000, 1)}</td><td></td><td class="n">${n0(tm)}</td></tr></tbody></table></div>`;
}
function perfCards(el){
  const L = layersInToOut(el), ctx = elUse(el), r = wallReport(L, ctx), g = uGrade(r.th.U, ctx);
  const cond = r.gl.risk.length ? `<b class="bad">Risque de condensation</b>` : `<b class="ok">Pas de condensation</b>`;
  const f = forcedPerf(el), rs = RS[ctx] || RS.mur, U = f ? (f.U || 1 / (f.R + rs.si + rs.se)) : r.th.U, Rp = f ? (f.R || 1 / f.U - rs.si - rs.se) : r.th.Rp, gf = uGrade(U, ctx);
  return `${f ? `<p class="forced">Valeurs forcées${el.forceNote ? ' · ' + esc(el.forceNote) : ''} <span>(calcul : U ${nf(r.th.U, 3)})</span></p>` : ''}<div class="perf">
    <div class="pc${f ? ' fz' : ''}"><span>Coefficient U${f ? ' (forcé)' : ''}</span><b>${nf(U, 3)}</b><em>W/m²·K</em><i class="gr g${gf.g}" title="${esc(gf.t)}">${gf.g}</i></div>
    <div class="pc${f ? ' fz' : ''}"><span>Résistance R paroi</span><b>${nf(Rp, 2)}</b><em>m²·K/W</em></div>
    <div class="pc"><span>Déphasage</span><b>${nf(r.dyn.phase, 1)}</b><em>heures</em></div>
    <div class="pc"><span>Isolement acoustique</span><b>≈ ${r.ac.Rw}</b><em>dB (Rw)</em></div>
    <div class="pc"><span>Hygrométrie</span>${cond}<em>Glaser, hiver</em></div>
    <div class="pc"><span>Carbone</span><b>${n0(r.co2)}</b><em>kg CO₂e/m²</em></div></div>`;
}

function renderProps(){
  const ids = selIds();
  if (ids.length > 1){
    return `<div class="ph"><h2>${ids.length} éléments sélectionnés</h2></div><p class="hint">Déplacer (<kbd>G</kbd>), copier (<kbd>C</kbd>), pivoter (<kbd>O</kbd>) ou supprimer (<kbd>Suppr</kbd>) la sélection. Maj + clic pour ajouter ou retirer un élément.</p>
      <div class="btns"><button class="btn" data-act="tool-move">Déplacer</button><button class="btn" data-act="tool-copy">Copier</button><button class="btn" data-act="tool-rotate">Rotation</button><button class="btn danger" data-act="del">Supprimer</button></div>`;
  }
  const el = sel ? getEl(sel) : null;
  if (!el){
    const counts = {}; state.els.forEach(e => counts[e.kind] = (counts[e.kind] || 0) + 1);
    return `<div class="ph"><h2>${esc(state.name)}</h2>${state.isSample ? '<span class="tag">Exemple</span>' : ''}</div>
      <div class="fields"><label class="f wide"><span>Nom du projet</span><span class="in"><input id="f-pname" data-f="pname" type="text" value="${esc(state.name)}" style="font-family:var(--f-body)"></span></label></div>
      <div class="grp"><h3>Lieu du projet</h3>${siteSummary()}<div class="btns tight"><button class="btn${state.site?.zone ? '' : ' primary'}" data-act="site">${state.site?.zone ? 'Modifier le lieu, le climat, le bruit…' : 'Définir le lieu du projet'}</button></div></div>
      <div class="grp"><h3>Niveaux</h3><div class="lvls">${state.levels.map((l, i) => `<div class="lv${i === curLvl ? ' cur' : ''}"><input data-lvn="${i}" value="${esc(l.n)}" aria-label="Nom du niveau"><span class="in"><input data-lvz="${i}" type="number" step="0.01" value="${rnd(l.z)}" aria-label="Altitude"><em>m</em></span>${state.levels.length > 1 ? `<button class="x" data-lvdel="${i}" title="Supprimer le niveau" aria-label="Supprimer le niveau ${esc(l.n)}">×</button>` : ''}</div>`).join('')}</div>
        <div class="btns"><button class="btn" data-act="lvl-add">+ Niveau</button></div></div>
      <details class="help"><summary>Aide : saisie précise et raccourcis</summary><div class="grp"><h3>Saisie précise</h3><dl class="syntax">
        <dt><code>4,20</code></dt><dd>Longueur dans la direction du curseur</dd>
        <dt><code>4,2&lt;90</code></dt><dd>Longueur et angle (0° = est)</dd>
        <dt><code>@5;3</code></dt><dd>Déplacement relatif, ou côtés L ; l</dd>
        <dt><code>2;3</code></dt><dd>Point en coordonnées absolues</dd>
        <dt><code>MUR · DEP · CO</code></dt><dd>Commandes : mur, déplacer, copier, RO rotation, PP pousser/tirer, ZE zoom étendu</dd></dl></div>
      <div class="grp"><h3>Raccourcis</h3><p class="hint"><kbd>V</kbd> sélection · <kbd>M</kbd> mur · <kbd>D</kbd> dalle · <kbd>P</kbd> poteau · <kbd>B</kbd> volume · <kbd>F</kbd> composant · <kbd>U</kbd> pousser/tirer · <kbd>G</kbd> déplacer · <kbd>C</kbd> copier · <kbd>O</kbd> rotation · <kbd>R</kbd> mesure · <kbd>F3</kbd> accroches · <kbd>F8</kbd> ortho · <kbd>F10</kbd> polaire · <kbd>F9</kbd> grille · <kbd>Z</kbd> zoom étendu.</p></div></details>`;
  }
  const {v, m} = elStats(el);
  const lot = el.kind === 'wall' || el.kind === 'slab' || el.kind === 'roof' ? compo(el.type).lot : el.kind === 'inst' ? famLot(fam(el.fam)) : el.kind === 'vol' ? 'Industrie' : 'Gros œuvre';
  const title = el.kind === 'inst' ? esc(fam(el.fam)?.nom || 'Composant') : `${KIND_NAME[el.kind]} ${el.id}`;
  let h = `<div class="ph"><h2>${title}</h2><span class="tag">${esc(lot)}</span></div><div class="fields">`;
  if (el.kind === 'wall'){
    const {L} = wallAxis(el), layers = wallLayers(el), T = wallT(el), ops = wallOpenings(el);
    h += selectField('Composition', 'type', Object.entries(libCompos()).filter(([, t]) => t.kind === 'wall').map(([k, t]) => [k, t.nom]), el.type);
    h += field('Longueur', 'len', L, 'm') + field('Hauteur', 'h', el.h, 'm');
    h += selectField('Niveau', 'lvl', lvlOpts(), el.lvl, false) + field('Décalage base', 'off', el.off, 'm');
    h += field('Départ x', 'ax', el.a[0], 'm') + field('Départ y', 'ay', el.a[1], 'm') + field('Arrivée x', 'bx', el.b[0], 'm') + field('Arrivée y', 'by', el.b[1], 'm');
    h += `</div><div class="grp"><h3>Performances de la paroi</h3>${perfCards(el)}<div class="btns tight"><button class="btn primary" data-act="insul">Ajuster l'isolant / U / R</button><button class="btn" data-act="compose">Fiche complète</button></div></div>
      <div class="grp"><h3>Quantités</h3><dl class="kv"><dt>Épaisseur</dt><dd>${nf(T * 100, 1)} cm</dd><dt>Surface brute</dt><dd>${nf(L * el.h)} m²</dd><dt>Ouvertures</dt><dd>${ops.length}</dd><dt>Volume net</dt><dd>${nf(v, 3)} m³</dd><dt>Masse</dt><dd>${n0(m)} kg</dd></dl></div>
      <div class="grp"><h3>Composition ${layerBar(layers)}</h3>${layerTable(layers, L * el.h, true)}</div>
      <div class="btns"><button class="btn" data-act="flip">Inverser les faces</button><button class="btn" data-act="add-opening">+ Ouverture</button><button class="btn danger" data-act="del">Supprimer</button></div>`;
  } else if (el.kind === 'roof'){
    const layers = compo(el.type).layers, Q = roofQty(el), r = rect(el.p, el.q);
    h += selectField('Composition', 'type', Object.entries(libCompos()).filter(([, t]) => t.kind === 'roof').map(([k, t]) => [k, t.nom]), el.type);
    h += selectField('Forme', 'rshape', Object.entries(ROOF_SHAPES), el.shape || '2', false) + field('Pente', 'rpitch', roofPitch(el), '°', '1');
    h += selectField('Faîtage parallèle à', 'rdir', [['x', 'l\'axe x (est-ouest)'], ['y', 'l\'axe y (nord-sud)']], el.dir || (Math.abs(r[1][0] - r[0][0]) >= Math.abs(r[2][1] - r[1][1]) ? 'x' : 'y'), false) + field('Débord', 'rov', el.ov ?? 0.4, 'm');
    h += field('Hauteur d\'égout', 'off', el.off ?? 2.7, 'm') + selectField('Niveau', 'lvl', lvlOpts(), el.lvl, false);
    h += field('Longueur (x)', 'lx', r[1][0] - r[0][0], 'm') + field('Largeur (y)', 'ly', r[2][1] - r[1][1], 'm') + field('Origine x', 'px', r[0][0], 'm') + field('Origine y', 'py', r[0][1], 'm');
    h += `<label class="f wide rchk"><input type="checkbox" data-f="rgable"${el.gable !== false ? ' checked' : ''}> Pignons maçonnés (2 pans et appentis)</label>`;
    h += `</div><div class="grp"><h3>Performances</h3>${perfCards(el)}<div class="btns tight"><button class="btn primary" data-act="insul">Ajuster l'isolant / U / R</button><button class="btn" data-act="compose">Fiche complète</button></div></div>
      <div class="grp"><h3>Quantités</h3><dl class="kv"><dt>Surface des rampants</dt><dd>${nf(Q.slope)} m²</dd><dt>Surface en plan</dt><dd>${nf(Q.plan)} m²</dd><dt>Égouts (gouttières)</dt><dd>${nf(Q.eave)} ml</dd><dt>Faîtage</dt><dd>${nf(Q.ridge)} ml</dd>${Q.gable ? `<dt>Pignons</dt><dd>${nf(Q.gable)} m²</dd>` : ''}<dt>Masse</dt><dd>${n0(m)} kg</dd></dl></div>
      <div class="grp"><h3>Composition ${layerBar(layers)}</h3>${layerTable(layers, Q.slope, false)}</div>
      <div class="btns"><button class="btn danger" data-act="del">Supprimer</button></div>`;
  } else if (el.kind === 'slab'){
    const r = rect(el.p, el.q), Lx = r[1][0] - r[0][0], Ly = r[2][1] - r[1][1], layers = compo(el.type).layers;
    h += selectField('Composition', 'type', Object.entries(libCompos()).filter(([, t]) => t.kind === 'slab').map(([k, t]) => [k, t.nom]), el.type);
    h += selectField('Usage (calculs)', 'use', Object.entries(USES).filter(([k]) => k !== 'mur'), elUse(el));
    h += field('Longueur (x)', 'lx', Lx, 'm') + field('Largeur (y)', 'ly', Ly, 'm') + field('Origine x', 'px', r[0][0], 'm') + field('Origine y', 'py', r[0][1], 'm');
    h += selectField('Niveau', 'lvl', lvlOpts(), el.lvl, false) + field('Arase supérieure', 'off', el.off, 'm');
    h += `</div><div class="grp"><h3>Performances</h3>${perfCards(el)}<div class="btns tight"><button class="btn primary" data-act="insul">Ajuster l'isolant / U / R</button><button class="btn" data-act="compose">Fiche complète</button></div></div>
      <div class="grp"><h3>Quantités</h3><dl class="kv"><dt>Épaisseur</dt><dd>${nf(slabT(el) * 100, 1)} cm</dd><dt>Surface</dt><dd>${nf(Lx * Ly)} m²</dd><dt>Volume</dt><dd>${nf(v, 3)} m³</dd><dt>Masse</dt><dd>${n0(m)} kg</dd></dl></div>
      <div class="grp"><h3>Composition ${layerBar(layers)}</h3>${layerTable(layers, Lx * Ly, false)}</div>
      <div class="btns"><button class="btn danger" data-act="del">Supprimer</button></div>`;
  } else if (el.kind === 'vol'){
    const r = rect(el.p, el.q);
    h += matSelect('Matériau', 'mat', el.mat);
    h += field('Longueur (x)', 'lx', r[1][0] - r[0][0], 'm', '0.001') + field('Largeur (y)', 'ly', r[2][1] - r[1][1], 'm', '0.001') + field('Hauteur', 'h', el.h, 'm', '0.001');
    h += field('Origine x', 'px', r[0][0], 'm', '0.001') + field('Origine y', 'py', r[0][1], 'm', '0.001') + field('Base z', 'off', el.off, 'm', '0.001');
    h += selectField('Niveau', 'lvl', lvlOpts(), el.lvl, false);
    h += `</div><div class="grp"><h3>Quantités</h3><dl class="kv"><dt>Volume</dt><dd>${nf(v, 4)} m³</dd><dt>Masse volumique</dt><dd>${n0(mat(el.mat).rho)} kg/m³</dd><dt>Masse</dt><dd class="big">${nf(m, 1)} kg</dd><dt>Carbone</dt><dd>${n0(m * (mat(el.mat).gwp || 0))} kg CO₂e</dd></dl></div>
      <div class="btns"><button class="btn danger" data-act="del">Supprimer</button></div>`;
  } else if (el.kind === 'col'){
    h += matSelect('Matériau', 'mat', el.mat);
    h += field('Section x', 'w', el.w, 'm') + field('Section y', 'd', el.d, 'm') + field('Hauteur', 'h', el.h, 'm') + field('Base z', 'off', el.off, 'm');
    h += field('Centre x', 'cx', el.c[0], 'm') + field('Centre y', 'cy', el.c[1], 'm') + selectField('Niveau', 'lvl', lvlOpts(), el.lvl, true);
    h += `</div><div class="grp"><h3>Quantités</h3><dl class="kv"><dt>Volume</dt><dd>${nf(v, 3)} m³</dd><dt>Masse</dt><dd class="big">${n0(m)} kg</dd></dl></div>
      <div class="btns"><button class="btn danger" data-act="del">Supprimer</button></div>`;
  } else if (el.kind === 'inst'){
    const F = fam(el.fam), s = F ? famScope(F, el) : {};
    h += selectField('Type', 'ftype', (F?.types || []).map((t, i) => [i, t.nom]), el.type | 0);
    for (const [k, p] of Object.entries(F?.params || {})) h += `<label class="f"><span>${esc(p.label || k)}</span><span class="in"><input data-fp="${esc(k)}" type="number" step="0.01" inputmode="decimal" value="${rnd(s[k])}"><em>${esc(p.unit ?? 'm')}</em></span></label>`;
    if (el.host){
      const w = getEl(el.host);
      h += field('Distance au départ du mur', 't', el.t ?? 0, 'm', '0.01', true);
      h += `</div><p class="hint">Posé dans le mur ${w ? w.id : '?'} · ${esc(compo(w?.type).nom)}. L'ouverture est découpée automatiquement dans toutes les couches.</p>
        <div class="btns"><button class="btn" data-act="iflip">Côté d'ouverture</button><button class="btn" data-act="imirror">Sens (gauche / droite)</button>`;
    } else {
      h += field('Position x', 'icx', el.c[0], 'm') + field('Position y', 'icy', el.c[1], 'm') + field('Rotation', 'irot', el.rot || 0, '°', '1') + field('Base z', 'off', el.off, 'm');
      h += selectField('Niveau', 'lvl', lvlOpts(), el.lvl, true) + `</div><div class="btns"><button class="btn" data-act="irot90">Pivoter 90°</button><button class="btn" data-act="imirror">Symétrie</button>`;
    }
    h += `<button class="btn" data-act="fam-edit">Modifier la famille</button><button class="btn danger" data-act="del">Supprimer</button></div>
      <div class="grp"><h3>Quantités</h3><dl class="kv"><dt>Volume</dt><dd>${nf(v, 3)} m³</dd><dt>Masse</dt><dd>${n0(m)} kg</dd>${famCut(el) ? `<dt>Ouverture</dt><dd>${nf(famCut(el).w)} × ${nf(famCut(el).h)} m</dd>` : ''}</dl></div>`;
  }
  return h;
}

/* ---------- bibliothèque ---------- */
const FAM_ICON = {Portes:'M7 21V3h10v18M14 12h.01', 'Fenêtres':'M4 4h16v16H4zM12 4v16M4 12h16', Ouvertures:'M5 21V5h14v16', Structure:'M3 6h18M3 18h18M12 6v12', 'Escaliers et garde-corps':'M3 21h4v-4h4v-4h4V9h4V5', Mobilier:'M4 11h16v4H4zM6 15v5M18 15v5', 'Cuisine et sanitaires':'M5 10h14v5a5 5 0 0 1-10 0M12 3v4', Industrie:'M3 21V9l6 4V9l6 4V5h6v16z', 'Extérieur':'M12 2a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5M12 12v10'};
const libOwner = (kind, id) => state.lib?.[kind]?.[id] ? 'projet' : USER_LIB[kind][id] ? 'perso' : 'base';
function renderLib(){
  const q = libQuery.trim().toLowerCase(), match = s => !q || s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  let body = '';
  if (libTab === 'mats'){
    const cats = MAT_CATS.concat([...new Set(Object.values(libMats()).map(m => m.cat))].filter(c => !MAT_CATS.includes(c)));
    const list = Object.entries(libMats()).filter(([, m]) => match(m.nom) && (!libCat || m.cat === libCat));
    body = `<div class="libtools"><select data-libcat aria-label="Catégorie"><option value="">Toutes les catégories</option>${cats.map(c => `<option${c === libCat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select><button class="btn primary" data-act="mat-new">+ Matériau</button></div>
      <div class="lib">${list.map(([k, m]) => `<div class="row" data-mat="${esc(k)}"><span class="swt" style="background:${m.color}"></span><div><b>${esc(m.nom)}</b><div class="comp">${esc(m.cat)}${libOwner('mats', k) !== 'base' ? ' · <em>' + (libOwner('mats', k) === 'perso' ? 'Ma bibliothèque' : 'Projet') + '</em>' : ''}</div></div>
        <span class="n">${m.R != null ? 'R ' + nf(m.R, 2) : 'λ ' + nf(m.lambda, 3)}<br>${n0(m.rho)} kg/m³</span></div>`).join('') || '<p class="hint">Aucun matériau trouvé.</p>'}</div>`;
  } else if (libTab === 'compos'){
    const list = Object.entries(libCompos()).filter(([, c]) => match(c.nom));
    const blk = kind => list.filter(([, c]) => c.kind === kind).map(([k, c]) => { const L = c.kind === 'wall' ? c.layers.slice().reverse() : c.layers, r = thermal(L, c.kind === 'wall' ? 'mur' : 'plancherBas');
      return `<div class="row crow" data-compo="${esc(k)}"><div><b>${esc(c.nom)}</b>${layerBar(c.layers)}<div class="comp">${nf(c.layers.reduce((s, l) => s + l[1], 0) * 100, 1)} cm${libOwner('compos', k) !== 'base' ? ' · <em>' + (libOwner('compos', k) === 'perso' ? 'Ma bibliothèque' : 'Projet') + '</em>' : ''}</div></div><span class="n">U ${nf(r.U, 2)}</span></div>`; }).join('');
    body = `<div class="libtools"><button class="btn primary" data-act="compo-new">+ Composition</button></div><div class="grp"><h3>Murs et cloisons</h3><div class="lib">${blk('wall')}</div></div><div class="grp"><h3>Planchers et toitures</h3><div class="lib">${blk('slab')}</div></div>`;
  } else {
    const list = Object.entries(libFams()).filter(([, F]) => match(F.nom) && (!libCat || F.cat === libCat));
    const cats = [...new Set(FAM_CATS.concat(list.map(([, F]) => F.cat)))];
    body = `<div class="libtools"><select data-libcat aria-label="Catégorie"><option value="">Toutes les familles</option>${cats.map(c => `<option${c === libCat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select><button class="btn primary" data-act="fam-new">+ Famille</button></div>` +
      cats.map(c => { const items = list.filter(([, F]) => F.cat === c); if (!items.length) return '';
        return `<div class="grp"><h3>${esc(c)}</h3><div class="fgrid">${items.map(([k, F]) => `<button class="fcard${tool === 'comp' && defs.comp.fam === k ? ' on' : ''}" data-fam="${esc(k)}" title="${esc(F.nom)}"><svg viewBox="0 0 24 24"><path d="${FAM_ICON[F.cat] || FAM_ICON.Mobilier}"/></svg><b>${esc(F.nom)}</b><small>${F.host === 'wall' ? 'Dans un mur' : (F.types || []).length + ' type' + ((F.types || []).length > 1 ? 's' : '')}${libOwner('fams', k) !== 'base' ? ' · perso' : ''}</small></button>`).join('')}</div></div>`; }).join('');
  }
  return `<div class="ph"><h2>Bibliothèque</h2></div>
    <div class="subtabs" role="tablist">${[['fams', 'Familles'], ['compos', 'Compositions'], ['mats', 'Matériaux']].map(([k, n]) => `<button role="tab" data-libtab="${k}" aria-selected="${libTab === k}">${n}</button>`).join('')}</div>
    <input class="libsearch" data-libq type="search" placeholder="Rechercher…" value="${esc(libQuery)}" aria-label="Rechercher dans la bibliothèque">${body}
    <p class="hint" style="margin-top:14px">Valeurs indicatives (λ en W/m·K) à remplacer par les fiches techniques des produits retenus. Vos créations sont enregistrées dans « Ma bibliothèque » et copiées dans les projets qui les utilisent.</p>`;
}

/* ---------- métré ---------- */
function quantities(){
  const mats = {}, walls = {}, slabs = {}, roofs = {}, fams = {};
  const addM = (lot, m, v) => { const k = lot + '|' + m; mats[k] ??= {lot, mat:m, v:0}; mats[k].v += v; };
  for (const el of state.els){
    if (el.kind === 'inst'){ const F = fam(el.fam); for (const so of instSolids(el)) addM(famLot(F), so.m, solidVol(so));
      const k = el.fam + '|' + (el.type | 0); fams[k] ??= {fam:el.fam, type:el.type | 0, n:0, area:0}; fams[k].n++; const c = famCut(el); if (c) fams[k].area += c.w * c.h; continue; }
    for (const pc of pieces(el)) addM(pc.lot, pc.mat, area(pc.poly) * pc.h);
    if (el.kind === 'wall'){ const L = wallAxis(el).L, ops = wallOpenings(el).reduce((s, o) => s + (o.t1 - o.t0) * (o.z1 - o.z0), 0); walls[el.type] ??= {ml:0, m2:0, net:0}; walls[el.type].ml += L; walls[el.type].m2 += L * el.h; walls[el.type].net += L * el.h - ops; }
    if (el.kind === 'slab'){ slabs[el.type] ??= {m2:0}; slabs[el.type].m2 += area(rect(el.p, el.q)); }
    if (el.kind === 'roof'){ const r = roofQty(el); roofs[el.type] ??= {m2:0, plan:0, eave:0, ridge:0}; roofs[el.type].m2 += r.slope; roofs[el.type].plan += r.plan; roofs[el.type].eave += r.eave; roofs[el.type].ridge += r.ridge; }
  }
  return {mats:Object.values(mats), walls, slabs, roofs, fams:Object.values(fams)};
}
function renderQty(){
  const q = quantities(); if (!state.els.length) return `<p class="hint">Le métré apparaîtra ici dès que vous aurez dessiné un premier élément.</p>`;
  let rows = '', tv = 0, tm = 0, tc = 0;
  for (const lot of LOT_ORDER){
    const list = q.mats.filter(r => r.lot === lot).sort((a, b) => b.v * mat(b.mat).rho - a.v * mat(a.mat).rho);
    if (!list.length) continue;
    rows += `<tr class="lot"><td colspan="4">${lot}</td></tr>`;
    for (const r of list){ const M = mat(r.mat), mass = r.v * (M.R != null ? 0 : M.rho), co2 = mass * (M.gwp || 0); tv += r.v; tm += mass; tc += co2;
      rows += `<tr><td><span class="sw" style="background:${M.color}"></span>${esc(M.nom)}</td><td class="n">${nf(r.v, 3)}</td><td class="n">${nf(mass / 1000, 2)}</td><td class="n">${n0(co2)}</td></tr>`; }
  }
  rows += `<tr class="tot"><td>Total</td><td class="n">${nf(tv, 2)}</td><td class="n">${nf(tm / 1000, 2)}</td><td class="n">${n0(tc)}</td></tr>`;
  const wr = Object.entries(q.walls).map(([k, w]) => `<tr><td>${esc(compo(k).nom)}</td><td class="n">${nf(w.ml)}</td><td class="n">${nf(w.m2)}</td><td class="n">${nf(w.net)}</td></tr>`).join('');
  const sr = Object.entries(q.slabs).map(([k, s]) => `<tr><td>${esc(compo(k).nom)}</td><td class="n">${nf(s.m2)}</td></tr>`).join('');
  const fr = q.fams.map(f => { const F = fam(f.fam); return `<tr><td>${esc(F?.nom || f.fam)}<div class="comp">${esc(F?.types?.[f.type]?.nom || '')}</div></td><td class="n">${f.n}</td><td class="n">${f.area ? nf(f.area) : '—'}</td></tr>`; }).join('');
  return `<div class="ph"><h2>Métré du projet</h2><span class="tag">Auto</span></div>
    <div class="grp"><h3>Matériaux par lot</h3><div class="wrap"><table class="tbl"><thead><tr><th>Matériau</th><th class="n">m³</th><th class="n">t</th><th class="n">kg CO₂e</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    ${wr ? `<div class="grp"><h3>Murs et cloisons</h3><div class="wrap"><table class="tbl"><thead><tr><th>Composition</th><th class="n">ml</th><th class="n">m² brut</th><th class="n">m² net</th></tr></thead><tbody>${wr}</tbody></table></div></div>` : ''}
    ${sr ? `<div class="grp"><h3>Planchers</h3><div class="wrap"><table class="tbl"><thead><tr><th>Composition</th><th class="n">m²</th></tr></thead><tbody>${sr}</tbody></table></div></div>` : ''}
    ${fr ? `<div class="grp"><h3>Menuiseries et composants</h3><div class="wrap"><table class="tbl"><thead><tr><th>Famille</th><th class="n">Qté</th><th class="n">m² baie</th></tr></thead><tbody>${fr}</tbody></table></div></div>` : ''}
    <p class="hint" style="margin-top:12px">Volumes sur la géométrie réelle : onglets d'angle compris, ouvertures déduites. Carbone : production des matériaux (A1-A3), valeurs génériques indicatives.</p>
    <div class="btns"><button class="btn primary" data-act="csv">Exporter le métré (.csv)</button></div>`;
}

function renderPanel(){
  if (view === 'render' && activeTab === 'props' && !sel) activeTab = 'render';
  $$('.tabs button').forEach(b => { b.setAttribute('aria-selected', b.dataset.tab === activeTab); if (b.dataset.tab === 'render') b.hidden = view !== 'render' && activeTab !== 'render'; });
  const body = $('#pbody'); const st = body.scrollTop;
  const tp = body.querySelector('.tree-pane'), pp = body.querySelector('.prop-pane'), tst = tp?.scrollTop, pst = pp?.scrollTop;
  body.classList.toggle('splitmode', activeTab === 'props');
  body.innerHTML = activeTab === 'props' ? renderProjectTab() : activeTab === 'qty' ? renderDqePanel() : activeTab === 'lib' ? renderLib() : renderRenderPanel();
  body.scrollTop = st; if (tst != null){ const a = body.querySelector('.tree-pane'), b = body.querySelector('.prop-pane'); if (a) a.scrollTop = tst; if (b) b.scrollTop = pst; }
}
$('#pbody').addEventListener('input', e => {
  if (e.target.matches('[data-libq]')){ libQuery = e.target.value; const pos = e.target.selectionStart; renderPanel(); const i = $('#pbody [data-libq]'); if (i){ i.focus(); i.setSelectionRange(pos, pos); } }
  if (e.target.matches('[data-rset]')) onRenderInput(e.target);
});
$('#pbody').addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-libcat]')){ libCat = t.value; return renderPanel(); }
  if (t.matches('[data-rset]')) return onRenderInput(t, true);
  if (t.dataset.lvn != null){ pushHist(); state.levels[+t.dataset.lvn].n = t.value.trim().slice(0, 30) || 'Niveau'; rebuild(); syncLevels(); return; }
  if (t.dataset.lvz != null){ const z = num(t.value); if (Number.isNaN(z)) return renderPanel(); pushHist(); state.levels[+t.dataset.lvz].z = z; rebuild(); syncLevels(); return; }
  const f = t.dataset.f, fp = t.dataset.fp;
  if (f === 'pname'){ pushHist(); state.name = t.value.trim() || 'Projet sans nom'; state.isSample = false; rebuild(); return; }
  const el = getEl(sel); if (!el || (!f && !fp)) return;
  if (fp){ const v = num(t.value); if (Number.isNaN(v)) return renderPanel(); pushHist(); el.params = {...(el.params || {}), [fp]:v}; state.isSample = false; rebuild(); return; }
  if (f === 'rgable'){ pushHist(); el.gable = t.checked; state.isSample = false; rebuild(); return; }
  const val = t.tagName === 'SELECT' ? t.value : num(t.value);
  if (typeof val === 'number' && Number.isNaN(val)){ renderPanel(); return; }
  pushHist(); state.isSample = false;
  const pos = x => Math.max(0.001, x);
  if (f === 'rshape') el.shape = val; else if (f === 'rpitch') el.pitch = clamp(val, 3, 70); else if (f === 'rdir') el.dir = val; else if (f === 'rov') el.ov = clamp(val, 0, 2); else if (f === 'type') el.type = val; else if (f === 'mat') el.mat = val; else if (f === 'lvl') el.lvl = +val; else if (f === 'use') el.use = val;
  else if (f === 'ftype'){ el.type = +val; el.params = {}; }
  else if (f === 'h') el.h = pos(val); else if (f === 'off') el.off = val;
  else if (f === 't'){ const w = getEl(el.host); if (w){ const c = famCut(el), L = wallAxis(w).L; el.t = rnd(clamp(val, c.w / 2, L - c.w / 2)); } }
  else if (f === 'icx') el.c = [val, el.c[1]]; else if (f === 'icy') el.c = [el.c[0], val]; else if (f === 'irot') el.rot = val % 360;
  else if (el.kind === 'wall'){
    if (f === 'len'){ const {u} = wallAxis(el); el.b = [rnd(el.a[0] + u[0] * pos(val)), rnd(el.a[1] + u[1] * pos(val))]; }
    else if (f === 'ax') el.a = [val, el.a[1]]; else if (f === 'ay') el.a = [el.a[0], val];
    else if (f === 'bx') el.b = [val, el.b[1]]; else if (f === 'by') el.b = [el.b[0], val];
    if (V.len(V.sub(el.a, el.b)) < 0.01){ state = JSON.parse(hist.pop()); updUndo(); renderPanel(); toast('Un mur doit mesurer au moins 1 cm'); return; }
  } else if (el.kind === 'slab' || el.kind === 'vol' || el.kind === 'roof'){
    const r = rect(el.p, el.q); let [x0, y0] = r[0], lx = r[1][0] - x0, ly = r[2][1] - y0;
    if (f === 'lx') lx = pos(val); else if (f === 'ly') ly = pos(val); else if (f === 'px') x0 = val; else if (f === 'py') y0 = val;
    el.p = [x0, y0]; el.q = [rnd(x0 + lx), rnd(y0 + ly)];
  } else if (el.kind === 'col'){
    if (f === 'w') el.w = pos(val); else if (f === 'd') el.d = pos(val); else if (f === 'cx') el.c = [val, el.c[1]]; else if (f === 'cy') el.c = [el.c[0], val];
  }
  rebuild();
});
$('#pbody').addEventListener('click', e => {
  const t = e.target;
  const lt = t.closest('[data-libtab]'); if (lt){ libTab = lt.dataset.libtab; libCat = ''; return renderPanel(); }
  const fc = t.closest('[data-fam]'); if (fc){ defs.comp.fam = fc.dataset.fam; defs.comp.type = 0; defs.comp.rot = 0; setTool('comp'); renderPanel(); if (isNarrow.matches) openSheet(false); return; }
  const cr = t.closest('[data-compo]'); if (cr) return openComposer({id:cr.dataset.compo});
  const mr = t.closest('[data-mat]'); if (mr) return openMatEditor(mr.dataset.mat);
  const ld = t.closest('[data-lvdel]'); if (ld){ const i = +ld.dataset.lvdel; if (state.els.some(x => x.lvl === i)) return toast('Ce niveau contient des éléments : déplacez-les ou supprimez-les d\'abord.');
    pushHist(); state.levels.splice(i, 1); state.els.forEach(x => { if (x.lvl > i) x.lvl--; }); curLvl = Math.min(curLvl, state.levels.length - 1); rebuild(); syncLevels(); return; }
  const b = t.closest('button[data-act]'); if (!b) return;
  const act = b.dataset.act, el = getEl(sel);
  if (act === 'del') deleteSel();
  else if (act.startsWith('tool-')) setTool(act.slice(5));
  else if (act === 'flip' && el){ pushHist(); el.flip = !el.flip; rebuild(); }
  else if (act === 'iflip' && el){ pushHist(); el.flip = !el.flip; rebuild(); }
  else if (act === 'imirror' && el){ pushHist(); el.mirror = !el.mirror; rebuild(); }
  else if (act === 'irot90' && el){ pushHist(); el.rot = ((el.rot || 0) + 90) % 360; rebuild(); }
  else if (act === 'add-opening' && el){ libTab = 'fams'; libCat = 'Fenêtres'; activeTab = 'lib'; renderPanel(); toast('Choisissez une porte ou une fenêtre, puis cliquez dans le mur'); }
  else if (act === 'compose' && el) openComposer({id:el.type, apply:el.id});
  else if (act === 'insul' && el) openInsulAdjust(el.id);
  else if (act === 'site') openSiteDialog();
  else if (act === 'fam-edit' && el) openFamEditor(el.fam, el.id);
  else if (act === 'fam-new') openFamEditor(null);
  else if (act === 'compo-new') openComposer({id:null});
  else if (act === 'mat-new') openMatEditor(null);
  else if (act === 'lvl-add'){ pushHist(); const last = state.levels[state.levels.length - 1]; state.levels.push({n:`R+${state.levels.length}`, z:rnd((last?.z || 0) + 2.8)}); rebuild(); syncLevels(); }
  else if (act === 'csv') doExport('csv');
  else onRenderClick(act, b);
});
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderPanel(); }));
