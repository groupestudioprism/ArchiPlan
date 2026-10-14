/* ============ Éditeur de compositions (murs, planchers, toitures) et de matériaux ============ */
const edlg = () => $('#engDlg');
function openEDlg(html, cls = ''){ const d = edlg(); d.className = cls; d.querySelector('.edlg-card').innerHTML = html; d.hidden = false; d.querySelectorAll('[data-close]').forEach(b => b.onclick = closeEDlg); return d; }
function closeEDlg(){ if (state?.lib?.mats) delete state.lib.mats.__tmp; const d = edlg(); d.hidden = true; d.querySelector('.edlg-card').innerHTML = ''; if (famPrev){ famPrev.dispose(); famPrev = null; } }
edlg().addEventListener('click', e => { if (e.target === edlg()) closeEDlg(); });
function saveUserLib(){ try { window.APLib?.save(JSON.parse(JSON.stringify(USER_LIB))); } catch(e){} }
const PATTERNS = {plain:'Uni', concrete:'Béton', plaster:'Enduit / plâtre', brick:'Brique', brickbig:'Bloc alvéolaire', block:'Bloc / parpaing', stone:'Pierre', wood:'Bois', woodpanel:'Panneau bois', cladding:'Bardage', parquet:'Parquet', osb:'OSB', insul:'Isolant fibreux', insulboard:'Isolant en panneau', metal:'Métal', ribbed:'Bac nervuré', tile:'Carrelage', rooftile:'Tuiles', slate:'Ardoises', membrane:'Membrane', gravel:'Gravier', grass:'Végétal', earth:'Terre', fabric:'Textile', glass:'Verre'};

/* ---------- compositions ---------- */
function openComposer({id, apply}){
  const base = id ? compo(id) : {nom:'Nouvelle composition', kind:'wall', lot:'Gros œuvre', layers:[['enduit', 0.015], ['parpaing', 0.2], ['laine', 0.1], ['ba13', 0.013]]};
  const owner = id ? libOwner('compos', id) : 'new';
  const W = {nom:owner === 'base' ? base.nom : base.nom, kind:base.kind, lot:base.lot, layers:base.layers.map(l => [...l]), use:base.kind === 'wall' ? 'mur' : 'plancherBas', cond:{ti:20, hi:50, te:-5, he:80}};
  const target = apply ? getEl(apply) : null; if (target && target.kind === 'slab') W.use = elUse(target);
  const html = `<header class="ed-h"><div><span class="eyebrow">Composition de paroi</span><input class="ed-name" id="cpName" value="${esc(W.nom)}" aria-label="Nom de la composition"></div><button class="ib" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body cp">
      <section class="cp-l">
        <div class="cp-row"><label class="f"><span>Type</span><span class="in"><select id="cpKind"><option value="wall"${W.kind === 'wall' ? ' selected' : ''}>Mur / cloison</option><option value="slab"${W.kind === 'slab' ? ' selected' : ''}>Plancher / toiture</option></select></span></label>
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
  const syncUse = () => { const opts = W.kind === 'wall' ? [['mur', USES.mur]] : Object.entries(USES).filter(([k]) => k !== 'mur'); if (!opts.some(([k]) => k === W.use)) W.use = opts[0][0];
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
  d.querySelector('#cpSave').onclick = () => { const cid = persist(); if (W.kind === 'wall') defs.wall.type = cid; else defs.slab.type = cid; closeEDlg(); pushHist(); embedUsedLib(); rebuild(); syncHud(); toast('Composition enregistrée'); };
  const ap = d.querySelector('#cpApply'); if (ap) ap.onclick = () => { const cid = persist(); pushHist(); const el = getEl(apply); if (el && ((el.kind === 'wall') === (W.kind === 'wall'))){ el.type = cid; if (el.kind === 'slab') el.use = W.use; } embedUsedLib(); closeEDlg(); rebuild(); toast('Composition appliquée'); };
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
  box.innerHTML = `<div class="perf big">
      <div class="pc"><span>Coefficient U</span><b>${nf(th.U, 3)}</b><em>W/m²·K</em><i class="gr g${g.g}">${g.g}</i><small>${esc(g.t)}</small></div>
      <div class="pc"><span>Résistance R</span><b>${nf(th.R, 2)}</b><em>m²·K/W (paroi seule ${nf(th.Rp, 2)})</em></div>
      <div class="pc"><span>Déphasage</span><b>${nf(dyn.phase, 1)}</b><em>heures · amortissement ${nf(dyn.f, 2)}</em></div>
      <div class="pc"><span>Capacité intérieure κ₁</span><b>${n0(dyn.kappa1)}</b><em>kJ/m²·K</em></div>
      <div class="pc"><span>Acoustique Rw</span><b>≈ ${ac.Rw}</b><em>dB · ${esc(ac.kind)}${ac.f0 ? ` · f₀ ${n0(ac.f0)} Hz` : ''}</em></div>
      <div class="pc"><span>Masse surfacique</span><b>${n0(mass)}</b><em>kg/m² · épaisseur ${nf(T * 100, 1)} cm</em></div>
      <div class="pc"><span>Vapeur (Sd total)</span><b>${nf(gl.sdTot, 2)}</b><em>m d'air équivalent</em></div>
      <div class="pc"><span>Carbone (A1-A3)</span><b>${n0(co2)}</b><em>kg CO₂e/m²</em></div></div>
    <div class="cp-charts"><figure><figcaption>Coupe et profil de température</figcaption>${sectionSvg(W, L, gl)}</figure><figure><figcaption>Diagramme de Glaser (pression de vapeur)</figcaption>${glaserSvg(L, gl)}</figure></div>
    <ul class="warns">${warn.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join('')}</ul>
    <p class="hint">Calculs simplifiés de pré-dimensionnement (EN ISO 6946, EN ISO 13786, loi de masse EN 12354-1, méthode de Glaser). Ils ne remplacent ni une étude thermique réglementaire, ni une étude acoustique, ni une analyse hygrothermique dynamique (WUFI).</p>`;
}
function sectionSvg(W, L, gl){
  // L : intérieur → extérieur. Affichage : intérieur à gauche.
  const Wd = 420, H = 170, pad = 30, T = L.reduce((s, l) => s + l[1], 0) || 1, minW = 6;
  const widths = L.map(([, e]) => Math.max(minW, e / T * (Wd - 2 * pad))), tot = widths.reduce((a, b) => a + b, 0), k = (Wd - 2 * pad) / tot;
  let x = pad, rects = '', xs = [pad];
  L.forEach(([m, e], i) => { const w = widths[i] * k; rects += `<rect x="${x.toFixed(1)}" y="26" width="${w.toFixed(1)}" height="${H - 52}" fill="${mat(m).color}" stroke="#0003"><title>${esc(mat(m).nom)} · ${nf(e * 100, 1)} cm</title></rect>`; x += w; xs.push(x); });
  const tMin = Math.min(...gl.pts.map(p => p.t)), tMax = Math.max(...gl.pts.map(p => p.t)), ty = t => 26 + (H - 52) * (1 - (t - tMin) / ((tMax - tMin) || 1));
  const line = gl.pts.map((p, i) => `${xs[i].toFixed(1)},${ty(p.t).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="Coupe de la paroi">${rects}
    <polyline points="${line}" fill="none" stroke="#C0392B" stroke-width="2"/>${gl.pts.map((p, i) => `<circle cx="${xs[i]}" cy="${ty(p.t)}" r="2.5" fill="#C0392B"/>`).join('')}
    <text x="${pad}" y="16" class="lb">Intérieur ${nf(gl.cond.ti, 0)} °C</text><text x="${Wd - pad}" y="16" class="lb" text-anchor="end">Extérieur ${nf(gl.cond.te, 0)} °C</text>
    <text x="${pad}" y="${H - 8}" class="lb">θsi ${nf(gl.pts[0].t, 1)} °C</text><text x="${Wd - pad}" y="${H - 8}" class="lb" text-anchor="end">θse ${nf(gl.pts[gl.pts.length - 1].t, 1)} °C</text></svg>`;
}
function glaserSvg(L, gl){
  const Wd = 420, H = 170, pad = 34, T = gl.pts[gl.pts.length - 1].x || 1;
  const pMax = Math.max(...gl.pts.map(p => Math.max(p.ps, p.p))) * 1.08, X = x => pad + (Wd - pad - 10) * x / T, Y = p => 12 + (H - 40) * (1 - p / pMax);
  // courbe de saturation finement échantillonnée dans chaque couche
  let ps = ''; gl.pts.forEach((p, i) => { ps += `${X(p.x).toFixed(1)},${Y(p.ps).toFixed(1)} `; });
  const pp = gl.pts.map(p => `${X(p.x).toFixed(1)},${Y(p.p).toFixed(1)}`).join(' ');
  const risk = gl.pts.filter(p => p.p > p.ps).map(p => `<circle cx="${X(p.x)}" cy="${Y(p.p)}" r="4" fill="#C0392B"/>`).join('');
  return `<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="Diagramme de Glaser">
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
    </div><canvas id="mtPrev" width="256" height="96" class="mtprev"></canvas>
    <p class="hint">Laissez « Résistance fixe » vide pour un matériau courant : la résistance est alors e / λ. Pour une lame d'air, indiquez sa résistance (0,18 m²·K/W pour une lame non ventilée).</p></div>
    <footer class="ed-f">${ro ? '<button class="btn primary" id="mtDup">Dupliquer pour le modifier</button>' : `${owner === 'perso' ? '<button class="btn danger" id="mtDel">Supprimer</button>' : ''}<button class="btn" data-close>Annuler</button><button class="btn primary" id="mtSave">Enregistrer dans ma bibliothèque</button>`}</footer>`;
  const d = openEDlg(html);
  const prev = () => { const cv = d.querySelector('#mtPrev'), g = cv.getContext('2d'); const tmpId = '__prev'; MATS[tmpId] = {...base, color:d.querySelector('#mtColor').value, tex:d.querySelector('#mtTex').value}; const t = paint(tmpId); delete MATS[tmpId];
    const pat = g.createPattern(t.image, 'repeat'); g.fillStyle = pat; g.fillRect(0, 0, cv.width, cv.height); t.dispose(); };
  prev(); d.querySelector('#mtColor').oninput = prev; d.querySelector('#mtTex').onchange = prev;
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
