/* ============ Éditeur de compositions (murs, planchers, toitures) et de matériaux ============ */
const edlg = () => $('#engDlg');
function openEDlg(html, cls = ''){ const d = edlg(); d.className = cls; d.querySelector('.edlg-card').innerHTML = html; d.hidden = false; d.querySelectorAll('[data-close]').forEach(b => b.onclick = closeEDlg); return d; }
function closeEDlg(){ if (state?.lib?.mats) delete state.lib.mats.__tmp; const d = edlg(); d.hidden = true; d.querySelector('.edlg-card').innerHTML = ''; if (famPrev){ famPrev.dispose(); famPrev = null; } if (typeof framePrev !== 'undefined' && framePrev){ framePrev.dispose(); framePrev = null; } }
edlg().addEventListener('click', e => { if (e.target === edlg()) closeEDlg(); });
function saveUserLib(){ try { window.APLib?.save(JSON.parse(JSON.stringify(USER_LIB))); } catch(e){} }
const PATTERNS = {plain:'Uni', concrete:'Béton', plaster:'Enduit / plâtre', brick:'Brique', brickbig:'Bloc alvéolaire', block:'Bloc / parpaing', stone:'Pierre', wood:'Bois', woodpanel:'Panneau bois', cladding:'Bardage', parquet:'Parquet', osb:'OSB', insul:'Isolant fibreux', insulboard:'Isolant en panneau', metal:'Métal', ribbed:'Bac nervuré', tile:'Carrelage', rooftile:'Tuiles', slate:'Ardoises', membrane:'Membrane', gravel:'Gravier', grass:'Végétal', earth:'Terre', fabric:'Textile', glass:'Verre'};
Object.entries(TEX_LIB).forEach(([k, v]) => { PATTERNS[k] ??= v.nom; });

/* ---------- compositions ---------- */
function openComposer({id, apply}){
  const base = id ? compo(id) : {nom:'Nouvelle composition', kind:'wall', lot:'Gros œuvre', layers:[['enduit', 0.015], ['parpaing', 0.2], ['laine', 0.1], ['ba13', 0.013]]};
  const owner = id ? libOwner('compos', id) : 'new';
  const W = {nom:owner === 'base' ? base.nom : base.nom, kind:base.kind, lot:base.lot, layers:base.layers.map(l => [...l]), use:base.kind === 'wall' ? 'mur' : base.kind === 'roof' ? 'toiture' : 'plancherBas', cond:{ti:20, hi:50, te:-5, he:80}};
  const target = apply ? getEl(apply) : null; if (target && (target.kind === 'slab' || target.kind === 'roof')) W.use = elUse(target);
  const html = `<header class="ed-h"><div><span class="eyebrow">Composition de paroi</span><input class="ed-name" id="cpName" value="${esc(W.nom)}" aria-label="Nom de la composition"></div><button class="ib" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body cp">
      <section class="cp-l">
        <div class="cp-row"><label class="f"><span>Type</span><span class="in"><select id="cpKind"><option value="wall"${W.kind === 'wall' ? ' selected' : ''}>Mur / cloison</option><option value="slab"${W.kind === 'slab' ? ' selected' : ''}>Plancher / toiture-terrasse</option><option value="roof"${W.kind === 'roof' ? ' selected' : ''}>Toiture en pente</option></select></span></label>
          <label class="f"><span>Usage (calculs)</span><span class="in"><select id="cpUse"></select></span></label>
          <label class="f"><span>Lot</span><span class="in"><select id="cpLot">${LOT_ORDER.map(l => `<option${l === W.lot ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></span></label></div>
        <p class="hint" id="cpOrder"></p>
        <div id="cpLayers" class="cp-layers"></div>
        <button class="btn" id="cpAdd">+ Ajouter une couche</button>
        <details class="cp-cond"><summary>Conditions de calcul hygrométrique</summary><div class="fields">
          ${[['ti', 'Température intérieure', '°C'], ['hi', 'Humidité intérieure', '%'], ['te', 'Température extérieure', '°C'], ['he', 'Humidité extérieure', '%']].map(([k, l, u]) => `<label class="f"><span>${l}</span><span class="in"><input data-cond="${k}" type="number" step="1" value="${W.cond[k]}"><em>${u}</em></span></label>`).join('')}</div></details>
      </section>
      <section class="cp-r" id="cpRes"></section>
    </div>
    <footer class="ed-f"><span class="hint">${owner === 'base' ? 'Composition de base : vos changements créent une copie dans « Ma bibliothèque ».' : owner === 'projet' ? 'Composition du projet.' : owner === 'perso' ? 'Composition de « Ma bibliothèque ».' : ''}</span>
      <button class="btn" data-close>Annuler</button>${target ? '<button class="btn" id="cpApply">Enregistrer et appliquer à l\'élément</button>' : ''}<button class="btn primary" id="cpSave">${owner === 'perso' ? 'Enregistrer' : 'Enregistrer dans ma bibliothèque'}</button></footer>`;
  const d = openEDlg(html, 'wide');
  const useSel = d.querySelector('#cpUse');
  const syncUse = () => { const opts = W.kind === 'wall' ? [['mur', USES.mur]] : W.kind === 'roof' ? [['toiture', USES.toiture]] : Object.entries(USES).filter(([k]) => k !== 'mur'); if (!opts.some(([k]) => k === W.use)) W.use = opts[0][0];
    useSel.innerHTML = opts.map(([k, n]) => `<option value="${k}"${k === W.use ? ' selected' : ''}>${esc(n)}</option>`).join('');
    d.querySelector('#cpOrder').textContent = W.kind === 'wall' ? 'Couches de l\'extérieur (en haut) vers l\'intérieur (en bas).' : 'Couches du dessus (en haut) vers le dessous (en bas).'; };
  const opts = matOptions();
  const renderLayers = () => {
    d.querySelector('#cpLayers').innerHTML = W.layers.map(([m, e], i) => `<div class="cl" data-i="${i}"><span class="swt" style="background:${mat(m).color}"></span>
      <select data-lm="${i}" aria-label="Matériau de la couche ${i + 1}">${opts.replace(`value="${esc(m)}"`, `value="${esc(m)}" selected`)}</select>
      <span class="in"><input data-le="${i}" type="number" step="1" min="0.1" value="${rnd(e * 1000)}" aria-label="Épaisseur en mm"><em>mm</em></span>
      <button class="x" data-lu="${i}" aria-label="Monter"${i ? '' : ' disabled'}>↑</button><button class="x" data-ld="${i}" aria-label="Descendre"${i < W.layers.length - 1 ? '' : ' disabled'}>↓</button><button class="x" data-lx="${i}" aria-label="Supprimer la couche"${W.layers.length > 1 ? '' : ' disabled'}>×</button></div>`).join('');
  };
  const calc = () => { renderResults(d.querySelector('#cpRes'), W); };
  d.querySelector('#cpKind').onchange = e => { W.kind = e.target.value; syncUse(); calc(); };
  useSel.onchange = e => { W.use = e.target.value; calc(); };
  d.querySelector('#cpLot').onchange = e => { W.lot = e.target.value; };
  d.querySelector('#cpAdd').onclick = () => { W.layers.push(['laine', 0.1]); renderLayers(); calc(); };
  d.querySelectorAll('[data-cond]').forEach(i => i.oninput = () => { const v = num(i.value); if (!Number.isNaN(v)){ W.cond[i.dataset.cond] = v; calc(); } });
  d.querySelector('#cpLayers').addEventListener('input', e => { const i = e.target.dataset.le; if (i != null){ const v = num(e.target.value); if (v > 0){ W.layers[+i][1] = v / 1000; calc(); } } });
  d.querySelector('#cpLayers').addEventListener('change', e => { const i = e.target.dataset.lm; if (i != null){ W.layers[+i][0] = e.target.value; renderLayers(); calc(); } });
  d.querySelector('#cpLayers').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const i = +(b.dataset.lu ?? b.dataset.ld ?? b.dataset.lx);
    if (b.dataset.lu != null && i > 0) [W.layers[i - 1], W.layers[i]] = [W.layers[i], W.layers[i - 1]];
    else if (b.dataset.ld != null && i < W.layers.length - 1) [W.layers[i + 1], W.layers[i]] = [W.layers[i], W.layers[i + 1]];
    else if (b.dataset.lx != null && W.layers.length > 1) W.layers.splice(i, 1);
    renderLayers(); calc(); });
  const persist = () => {
    W.nom = d.querySelector('#cpName').value.trim() || 'Composition';
    const data = {nom:W.nom, kind:W.kind, lot:W.lot, layers:W.layers.map(([m, e]) => [m, rnd(e)])};
    let cid = id;
    if (owner === 'perso') USER_LIB.compos[id] = data;
    else if (owner === 'projet'){ state.lib.compos[id] = data; }
    else { cid = 'U-' + uid8(); if (owner === 'base' && data.nom === base.nom) data.nom += ' (perso)'; USER_LIB.compos[cid] = data; }
    if (USER_LIB.compos[cid] && state.lib.compos[cid]) state.lib.compos[cid] = JSON.parse(JSON.stringify(data));
    saveUserLib(); return cid;
  };
  d.querySelector('#cpSave').onclick = () => { const cid = persist(); if (W.kind === 'wall') defs.wall.type = cid; else if (W.kind === 'roof') defs.roof.type = cid; else defs.slab.type = cid; closeEDlg(); pushHist(); embedUsedLib(); rebuild(); syncHud(); toast('Composition enregistrée'); };
  const ap = d.querySelector('#cpApply'); if (ap) ap.onclick = () => { const cid = persist(); pushHist(); const el = getEl(apply); if (el && (el.kind === W.kind || (el.kind !== 'wall' && W.kind !== 'wall'))){ el.type = cid; if (el.kind === 'slab') el.use = W.use; } embedUsedLib(); closeEDlg(); rebuild(); toast('Composition appliquée'); };
  syncUse(); renderLayers(); calc();
}
function renderResults(box, W){
  const L = W.kind === 'wall' ? W.layers.slice().reverse() : (W.use === 'toiture' ? W.layers.slice().reverse() : W.layers.slice());
  const cond = {ti:W.cond.ti, hi:W.cond.hi / 100, te:W.cond.te, he:W.cond.he / 100};
  const th = thermal(L, W.use), dyn = dynamicISO13786(L, W.use), ac = acoustic(L), gl = glaser(L, W.use, cond), g = uGrade(th.U, W.use);
  let mass = 0, T = 0, co2 = 0; for (const [id, e] of L){ const m = mat(id), mm = (m.R != null ? 0 : m.rho) * e; mass += mm; T += e; co2 += mm * (m.gwp || 0); }
  const warn = [];
  if (gl.risk.length) warn.push(['bad', `Condensation possible à ${gl.risk.length} interface${gl.risk.length > 1 ? 's' : ''} (${gl.risk.map(p => p.name).join(', ')}) : ajoutez un pare-vapeur ou un frein-vapeur côté intérieur, ou un isolant plus ouvert à la vapeur côté extérieur.`]);
  if (gl.insul >= 0 && gl.ratio < 5 && Number.isFinite(gl.ratio)) warn.push(['warn', `Règle du facteur 5 non respectée : Sd intérieur ${nf(gl.sdIn, 2)} m < 5 × Sd extérieur ${nf(gl.sdOut, 2)} m.`]);
  if (W.kind === 'wall' && dyn.phase < 6 && th.U < 0.5) warn.push(['info', `Déphasage de ${nf(dyn.phase, 1)} h : un isolant plus dense (fibre de bois, ouate) améliore le confort d'été (objectif ≥ 8 h en toiture).`]);
  if (ac.f0 && ac.f0 > 100) warn.push(['warn', `Fréquence de résonance élevée (${n0(ac.f0)} Hz) : augmentez la lame d'air ou la masse des parements.`]);
  if (!warn.length) warn.push(['ok', 'Aucune alerte : paroi cohérente pour ces conditions.']);
  box.closest('.ed-body')?.classList.toggle('focus', !!W.focus);
  if (W.focus){
    box.innerHTML = `<div class="cp-fbar"><button class="btn" data-cpback>← Retour à la fiche</button><div class="cp-kpi"><span>U <b>${nf(th.U, 3)}</b></span><span>R <b>${nf(th.R, 2)}</b></span><span>Déphasage <b>${nf(dyn.phase, 1)} h</b></span><span>Rw <b>≈ ${ac.Rw} dB</b></span><span class="${gl.risk.length ? 'bad' : 'ok'}">${gl.risk.length ? 'Condensation possible' : 'Pas de condensation'}</span></div></div>
      <div class="cp-charts big"><figure><figcaption>Coupe et profil de température · survolez pour lire les valeurs</figcaption>${sectionSvg(W, L, gl, true)}<div class="cp-tip" hidden></div></figure>
      <figure><figcaption>Diagramme de Glaser (pression de vapeur) · survolez pour lire les valeurs</figcaption>${glaserSvg(L, gl, true)}<div class="cp-tip" hidden></div></figure></div>
      <ul class="warns">${warn.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join('')}</ul>`;
    wireCharts(box, L, W); return;
  }
  box.innerHTML = `<div class="perf big">
      <div class="pc"><span>Coefficient U</span><b>${nf(th.U, 3)}</b><em>W/m²·K</em><i class="gr g${g.g}">${g.g}</i><small>${esc(g.t)}</small></div>
      <div class="pc"><span>Résistance R</span><b>${nf(th.R, 2)}</b><em>m²·K/W (paroi seule ${nf(th.Rp, 2)})</em></div>
      <div class="pc"><span>Déphasage</span><b>${nf(dyn.phase, 1)}</b><em>heures · amortissement ${nf(dyn.f, 2)}</em></div>
      <div class="pc"><span>Capacité intérieure κ₁</span><b>${n0(dyn.kappa1)}</b><em>kJ/m²·K</em></div>
      <div class="pc"><span>Acoustique Rw</span><b>≈ ${ac.Rw}</b><em>dB · ${esc(ac.kind)}${ac.f0 ? ` · f₀ ${n0(ac.f0)} Hz` : ''}</em></div>
      <div class="pc"><span>Masse surfacique</span><b>${n0(mass)}</b><em>kg/m² · épaisseur ${nf(T * 100, 1)} cm</em></div>
      <div class="pc"><span>Vapeur (Sd total)</span><b>${nf(gl.sdTot, 2)}</b><em>m d'air équivalent</em></div>
      <div class="pc"><span>Carbone (A1-A3)</span><b>${n0(co2)}</b><em>kg CO₂e/m²</em></div></div>
    <div class="cp-charts"><figure class="zoomable" title="Cliquer pour agrandir"><figcaption>Coupe et profil de température <em>· cliquer pour agrandir</em></figcaption>${sectionSvg(W, L, gl)}<div class="cp-tip" hidden></div></figure><figure class="zoomable" title="Cliquer pour agrandir"><figcaption>Diagramme de Glaser (pression de vapeur) <em>· cliquer pour agrandir</em></figcaption>${glaserSvg(L, gl)}<div class="cp-tip" hidden></div></figure></div>
    <ul class="warns">${warn.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join('')}</ul>
    ${typeof fireCompoHTML === 'function' ? fireCompoHTML(W) : ''}
    <p class="hint">Calculs simplifiés de pré-dimensionnement (EN ISO 6946, EN ISO 13786, loi de masse EN 12354-1, méthode de Glaser). Ils ne remplacent ni une étude thermique réglementaire, ni une étude acoustique, ni une analyse hygrothermique dynamique (WUFI).</p>`;
  wireCharts(box, L, W);
}
function sectionSvg(W, L, gl, big){
  // L : intérieur → extérieur. Affichage : intérieur à gauche.
  const Wd = big ? 760 : 420, H = big ? 300 : 170, pad = 30, T = L.reduce((s, l) => s + l[1], 0) || 1, minW = 6;
  const widths = L.map(([, e]) => Math.max(minW, e / T * (Wd - 2 * pad))), tot = widths.reduce((a, b) => a + b, 0), k = (Wd - 2 * pad) / tot;
  let x = pad, rects = '', xs = [pad];
  L.forEach(([m, e], i) => { const w = widths[i] * k; rects += `<rect x="${x.toFixed(1)}" y="26" width="${w.toFixed(1)}" height="${H - 52}" fill="${mat(m).color}" stroke="#0003"><title>${esc(mat(m).nom)} · ${nf(e * 100, 1)} cm</title></rect>`; x += w; xs.push(x); });
  const tMin = Math.min(...gl.pts.map(p => p.t)), tMax = Math.max(...gl.pts.map(p => p.t)), ty = t => 26 + (H - 52) * (1 - (t - tMin) / ((tMax - tMin) || 1));
  const line = gl.pts.map((p, i) => `${xs[i].toFixed(1)},${ty(p.t).toFixed(1)}`).join(' ');
  const data = gl.pts.map((p, i) => ({x:+xs[i].toFixed(1), t:p.t, p:p.p, ps:p.ps, d:p.x * 100}));
  return `<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="Coupe de la paroi" data-pts='${JSON.stringify(data)}' data-y0="26" data-y1="${H - 26}">${rects}
    <polyline points="${line}" fill="none" stroke="#C0392B" stroke-width="2"/>${gl.pts.map((p, i) => `<circle cx="${xs[i]}" cy="${ty(p.t)}" r="2.5" fill="#C0392B"/>`).join('')}
    <text x="${pad}" y="16" class="lb">Intérieur ${nf(gl.cond.ti, 0)} °C</text><text x="${Wd - pad}" y="16" class="lb" text-anchor="end">Extérieur ${nf(gl.cond.te, 0)} °C</text>
    <text x="${pad}" y="${H - 8}" class="lb">θsi ${nf(gl.pts[0].t, 1)} °C</text><text x="${Wd - pad}" y="${H - 8}" class="lb" text-anchor="end">θse ${nf(gl.pts[gl.pts.length - 1].t, 1)} °C</text></svg>`;
}
function glaserSvg(L, gl, big){
  const Wd = big ? 760 : 420, H = big ? 300 : 170, pad = 34, T = gl.pts[gl.pts.length - 1].x || 1;
  const pMax = Math.max(...gl.pts.map(p => Math.max(p.ps, p.p))) * 1.08, X = x => pad + (Wd - pad - 10) * x / T, Y = p => 12 + (H - 40) * (1 - p / pMax);
  // courbe de saturation finement échantillonnée dans chaque couche
  let ps = ''; gl.pts.forEach((p, i) => { ps += `${X(p.x).toFixed(1)},${Y(p.ps).toFixed(1)} `; });
  const pp = gl.pts.map(p => `${X(p.x).toFixed(1)},${Y(p.p).toFixed(1)}`).join(' ');
  const risk = gl.pts.filter(p => p.p > p.ps).map(p => `<circle cx="${X(p.x)}" cy="${Y(p.p)}" r="4" fill="#C0392B"/>`).join('');
  const data = gl.pts.map(p => ({x:+X(p.x).toFixed(1), t:p.t, p:p.p, ps:p.ps, d:p.x * 100}));
  return `<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="Diagramme de Glaser" data-pts='${JSON.stringify(data)}' data-y0="12" data-y1="${H - 28}">
    <line x1="${pad}" y1="${H - 28}" x2="${Wd - 10}" y2="${H - 28}" stroke="#9AA7B4"/><line x1="${pad}" y1="12" x2="${pad}" y2="${H - 28}" stroke="#9AA7B4"/>
    ${gl.pts.map(p => `<line x1="${X(p.x)}" y1="12" x2="${X(p.x)}" y2="${H - 28}" stroke="#DCE5EC"/>`).join('')}
    <polyline points="${ps}" fill="none" stroke="#C0392B" stroke-width="2"/><polyline points="${pp}" fill="none" stroke="#0877B9" stroke-width="2" stroke-dasharray="5 3"/>${risk}
    <text x="${pad + 4}" y="${H - 10}" class="lb">Intérieur</text><text x="${Wd - 10}" y="${H - 10}" class="lb" text-anchor="end">Extérieur</text>
    <text x="${Wd - 12}" y="24" class="lb" text-anchor="end" fill="#C0392B">p saturante</text><text x="${Wd - 12}" y="38" class="lb" text-anchor="end" fill="#0877B9">p partielle</text>
    <text x="4" y="16" class="lb">${n0(pMax)} Pa</text></svg>`;
}

/* ---------- matériaux ---------- */
function openMatEditor(id){
  const base = id ? mat(id) : {nom:'Nouveau matériau', cat:'Maçonnerie', rho:1000, lambda:0.5, c:1000, mu:10, color:'#B8B0A2', tex:'plain', gwp:0.2, rough:0.9};
  const owner = id ? libOwner('mats', id) : 'new', ro = owner === 'base';
  const cats = [...new Set(MAT_CATS.concat(Object.values(libMats()).map(m => m.cat)))];
  const f = (k, l, u, step = '0.001') => `<label class="f"><span>${l}</span><span class="in"><input data-m="${k}" type="number" step="${step}" value="${base[k] ?? ''}"${ro ? ' readonly' : ''}><em>${u}</em></span></label>`;
  const html = `<header class="ed-h"><div><span class="eyebrow">Matériau${ro ? ' · bibliothèque de base' : owner === 'perso' ? ' · ma bibliothèque' : ''}</span><input class="ed-name" id="mtName" value="${esc(base.nom)}"${ro ? ' readonly' : ''} aria-label="Nom du matériau"></div><button class="ib" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><div class="fields">
      <label class="f wide"><span>Catégorie</span><span class="in"><select id="mtCat"${ro ? ' disabled' : ''}>${cats.map(c => `<option${c === base.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></span></label>
      ${f('rho', 'Masse volumique ρ', 'kg/m³', '1')}${f('lambda', 'Conductivité λ', 'W/m·K')}${f('c', 'Chaleur massique c', 'J/kg·K', '10')}${f('mu', 'Résistance à la vapeur μ', '—', '1')}
      ${f('gwp', 'Carbone (A1-A3)', 'kg CO₂e/kg')}${f('R', 'Résistance fixe (lame d\'air)', 'm²·K/W', '0.01')}
      <label class="f"><span>Couleur</span><span class="in"><input id="mtColor" type="color" value="${esc(base.color)}"${ro ? ' disabled' : ''}></span></label>
      <label class="f"><span>Motif de rendu</span><span class="in"><select id="mtTex"${ro ? ' disabled' : ''}>${Object.entries(PATTERNS).map(([k, n]) => `<option value="${k}"${k === base.tex ? ' selected' : ''}>${n}</option>`).join('')}</select></span></label>
      <div class="f wide"><span>Bibliothèque de textures</span><div class="patlib" id="mtPats">${[...new Set(Object.values(TEX_LIB).map(v => v.grp))].map(gp => `<div class="patg"><em>${esc(gp)}</em><div class="patgrid">${Object.entries(TEX_LIB).filter(([, v]) => v.grp === gp).map(([k, v]) => `<button type="button" class="pat${k === base.tex ? ' on' : ''}" data-pat="${k}" title="${esc(v.nom)}"${ro ? ' disabled' : ''}><img alt="" data-patimg="${k}"><span>${esc(v.nom)}</span></button>`).join('')}</div></div>`).join('')}</div></div>
    </div><canvas id="mtPrev" width="256" height="96" class="mtprev"></canvas>
    <p class="hint">Laissez « Résistance fixe » vide pour un matériau courant : la résistance est alors e / λ. Pour une lame d'air, indiquez sa résistance (0,18 m²·K/W pour une lame non ventilée).</p></div>
    <footer class="ed-f">${ro ? '<button class="btn primary" id="mtDup">Dupliquer pour le modifier</button>' : `${owner === 'perso' ? '<button class="btn danger" id="mtDel">Supprimer</button>' : ''}<button class="btn" data-close>Annuler</button><button class="btn primary" id="mtSave">Enregistrer dans ma bibliothèque</button>`}</footer>`;
  const d = openEDlg(html);
  const prev = () => { const cv = d.querySelector('#mtPrev'), g = cv.getContext('2d'); const tmpId = '__prev'; MATS[tmpId] = {...base, color:d.querySelector('#mtColor').value, tex:d.querySelector('#mtTex').value}; const img = paintV2(tmpId) || paint(tmpId).image; delete MATS[tmpId];
    g.clearRect(0, 0, cv.width, cv.height); const k = cv.height / img.height * 1.4; for (let x = 0; x < cv.width; x += img.width * k) g.drawImage(img, x, 0, img.width * k, img.height * k); };
  const pats = () => { const c = d.querySelector('#mtColor').value; d.querySelectorAll('[data-patimg]').forEach((im, i) => setTimeout(() => { im.src = patternPreview(im.dataset.patimg, c); }, i * 8)); };
  prev(); pats(); d.querySelector('#mtColor').oninput = prev; d.querySelector('#mtColor').onchange = pats; d.querySelector('#mtTex').onchange = () => { d.querySelectorAll('[data-pat]').forEach(b => b.classList.toggle('on', b.dataset.pat === d.querySelector('#mtTex').value)); prev(); };
  d.querySelectorAll('[data-pat]').forEach(b => b.onclick = () => { const sel = d.querySelector('#mtTex'); if (![...sel.options].some(o => o.value === b.dataset.pat)) sel.add(new Option(TEX_LIB[b.dataset.pat].nom, b.dataset.pat)); sel.value = b.dataset.pat; sel.onchange(); });
  const dup = d.querySelector('#mtDup'); if (dup) dup.onclick = () => { const nid = 'M-' + uid8(); USER_LIB.mats[nid] = {...base, nom:base.nom + ' (perso)'}; saveUserLib(); closeEDlg(); openMatEditor(nid); renderPanel(); };
  const del = d.querySelector('#mtDel'); if (del) del.onclick = () => { delete USER_LIB.mats[id]; saveUserLib(); closeEDlg(); resetMats(); delete texCache[id]; rebuild(); toast('Matériau retiré de ma bibliothèque (les projets qui l\'utilisent en gardent une copie)'); };
  const sv = d.querySelector('#mtSave'); if (sv) sv.onclick = () => {
    const m = {nom:d.querySelector('#mtName').value.trim() || 'Matériau', cat:d.querySelector('#mtCat').value, color:d.querySelector('#mtColor').value, tex:d.querySelector('#mtTex').value, rough:base.rough ?? 0.9};
    for (const k of ['rho', 'lambda', 'c', 'mu', 'gwp', 'R']){ const v = num(d.querySelector(`[data-m="${k}"]`).value); if (!Number.isNaN(v)) m[k] = v; }
    if (!(m.lambda > 0) && m.R == null) return toast('Indiquez une conductivité λ positive (ou une résistance fixe).');
    if (!(m.rho >= 0)) m.rho = 0;
    const mid = owner === 'perso' ? id : 'M-' + uid8(); USER_LIB.mats[mid] = m; if (state.lib.mats[mid]) state.lib.mats[mid] = {...m};
    saveUserLib(); delete texCache[mid]; resetMats(); closeEDlg(); rebuild(); libTab = 'mats'; renderPanel(); toast('Matériau enregistré');
  };
}

/* graphiques interactifs : curseur vertical, valeurs au survol ; clic pour agrandir (composition à gauche, graphiques à droite) */
function wireCharts(box, L, W){
  box.querySelectorAll('figure').forEach(fig => {
    const svg = fig.querySelector('svg.chart[data-pts]'), tip = fig.querySelector('.cp-tip'); if (!svg || !tip) return;
    const pts = JSON.parse(svg.dataset.pts), y0 = +svg.dataset.y0, y1 = +svg.dataset.y1, NS = 'http://www.w3.org/2000/svg';
    const ln = document.createElementNS(NS, 'line'); ln.setAttribute('class', 'hv'); ln.setAttribute('y1', y0); ln.setAttribute('y2', y1); ln.style.display = 'none'; svg.appendChild(ln);
    const hide = () => { ln.style.display = 'none'; tip.hidden = true; };
    svg.addEventListener('mouseleave', hide);
    svg.addEventListener('mousemove', e => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const sp = pt.matrixTransform(svg.getScreenCTM().inverse());
      if (sp.x < pts[0].x || sp.x > pts[pts.length - 1].x){ hide(); return; }
      let i = 0; while (i < pts.length - 2 && sp.x > pts[i + 1].x) i++;
      const a = pts[i], b = pts[i + 1], u = (sp.x - a.x) / ((b.x - a.x) || 1), lerp = k => a[k] + (b[k] - a[k]) * u, t = lerp('t'), p = lerp('p'), ps = psat(t), d = lerp('d');
      ln.setAttribute('x1', sp.x); ln.setAttribute('x2', sp.x); ln.style.display = '';
      const m = L[i] ? mat(L[i][0]) : null, hr = Math.min(100, p / ps * 100);
      tip.innerHTML = `<b>${esc(m?.nom || '')}</b><span>à ${nf(d, 1)} cm de l'intérieur</span><span>Température <b>${nf(t, 1)} °C</b></span><span>Pression de vapeur <b>${n0(p)} Pa</b> / saturante ${n0(ps)} Pa</span><span class="${p > ps ? 'bad' : ''}">Humidité relative <b>${n0(hr)} %</b>${p > ps ? ' · condensation' : ''}</span>`;
      const r = fig.getBoundingClientRect(); tip.hidden = false; let left = e.clientX - r.left + 14; if (left + 230 > r.width) left = e.clientX - r.left - 240; tip.style.left = Math.max(4, left) + 'px'; tip.style.top = Math.max(4, e.clientY - r.top - 20) + 'px';
    });
    if (fig.classList.contains('zoomable')) fig.addEventListener('click', () => { W.focus = true; renderResults(box, W); });
  });
  const back = box.querySelector('[data-cpback]'); if (back) back.onclick = () => { W.focus = false; renderResults(box, W); };
}
