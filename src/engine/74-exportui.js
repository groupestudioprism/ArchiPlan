/* Interface d'export 3D : options (niveaux, textures, verre) + aperçu en direct de la scène */
const EXP3D = {glb:['Archi Vision (.glb)', 'Modèle glTF texturé'], archivision:['Archi Vision (.archivision)', 'Format natif Archi Vision'], ifc:['Maquette BIM (.ifc)', 'IFC4 avec matériaux, couleurs et transparence'],
  pack:['Paquet complet (.zip)', 'GLB + IFC + métré + projet'], png:['Image (.png)', 'Capture de la vue 3D courante']};
function openExport3D(kind, arg){
  const cfg = EXP3D[kind], lv = state.levels.map((l, i) => [i, l.n]).filter(([i]) => state.els.some(e => e.lvl === i));
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Export</span><h3 class="ed-t2">${cfg[0]}</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body ia"><section><p class="hint">${cfg[1]}</p>
      <div class="grp" style="margin-top:0"><h3>Niveaux inclus</h3>${lv.map(([i, n]) => `<label class="ap-check2"><input type="checkbox" data-xl="${i}" checked> ${esc(n)}</label>`).join('')}</div>
      ${kind === 'png' ? `<div class="grp"><h3>Définition</h3><span class="in"><select id="xqS"><option value="1">Standard</option><option value="2" ${arg === 2 || !arg ? 'selected' : ''}>Haute (x2)</option><option value="4">Très haute (x4)</option></select></span></div>` : `<div class="grp"><h3>Matériaux</h3>
      <label class="ap-check2"><input type="checkbox" id="xTex" checked> Textures des matériaux</label>
      <label class="ap-check2"><input type="checkbox" id="xGl" checked> Verre transparent</label></div>`}
    </section><section><div class="grp" style="margin-top:0"><h3>Aperçu</h3><div id="xPrev" style="aspect-ratio:4/3;border-radius:10px;background:var(--bg2,#eee) center/cover no-repeat;display:grid;place-items:center;font-size:12px;color:#888">Calcul…</div>
      <p class="hint" id="xInfo"></p></div></section></div>
    <footer class="ed-f"><span class="hint"></span><button class="btn" data-close>Annuler</button><button class="btn primary" id="xGo">Exporter</button></footer>`, 'mid');
  const sub = () => { const on = new Set([...d.querySelectorAll('[data-xl]')].filter(c => c.checked).map(c => +c.dataset.xl)); return state.els.filter(e => on.has(e.lvl)); };
  /* sous-ensemble de niveaux : l'original est restauré dans tous les cas ; les appels sont mis en file (pas de chevauchement aperçu / export) */
  let chain = Promise.resolve();
  const withEls = (fn, keep) => { const run = async () => { const all = state.els; state.els = keep || sub(); try { rebuild(); return await fn(); } finally { state.els = all; rebuild(); } }; const r = chain.then(run, run); chain = r.catch(() => {}); return r; };
  let tm; const prev = () => { clearTimeout(tm); tm = setTimeout(async () => {
    const n = sub().length; d.querySelector('#xInfo').textContent = `${n} élément${n > 1 ? 's' : ''} exporté${n > 1 ? 's' : ''}`;
    try { if (!d.isConnected) return; const b = await withEls(() => captureImage(1), sub()); const u = URL.createObjectURL(b); const el = d.querySelector('#xPrev'); if (el){ el.style.backgroundImage = `url(${u})`; el.textContent = ''; } } catch(e){}
  }, 250); };
  d.addEventListener('change', prev); prev();
  d.querySelector('#xGo').onclick = async () => {
    if (!sub().length) return toast('Sélectionnez au moins un niveau');
    EXPCFG.tex = d.querySelector('#xTex')?.checked ?? true; EXPCFG.glass = d.querySelector('#xGl')?.checked ?? true;
    const q = +d.querySelector('#xqS')?.value || arg, keep = sub(); closeEDlg();   // la sélection est lue AVANT la fermeture (sinon le modèle exporté est vide)
    await withEls(() => doExport(kind, q), keep); EXPCFG.tex = EXPCFG.glass = true;
  };
}
/* Export du DQE : interface refaite. Format en cartes, sections repliables (document, lots avec montants, colonnes, prix et TVA, style du PDF),
   aperçu du document recalculé à chaque changement, totaux HT / TVA / TTC en pied. */
openDqeExport = function(){
  const items = dqeItems(), groups = dqeGroups(items), D0 = state.dqe || {}, st0 = {...DQE_STYLE0, ...(D0.style || {})};
  const o0 = {...Object.fromEntries(DQE_OPTS.map(([k, , d]) => [k, d])), ...(D0.opts || {})};
  const lotsOn = new Set(D0.lotsOff ? groups.map(g => g.code).filter(c => !D0.lotsOff.includes(c)) : groups.map(g => g.code));
  const fmtE = v => nf(v, 2) + ' €', opt = (o, v) => Object.entries(o).map(([k, x]) => `<option value="${k}"${k == v ? ' selected' : ''}>${Array.isArray(x) ? x[0] : x}</option>`).join('');
  const FM = {xlsx:['Excel', '.xlsx', 'Tableur : formules, lots en feuilles, prêt à chiffrer'], pdf:['PDF', 'impression', 'Document mis en page : en-tête, lots, totaux'], csv:['CSV', '.csv', 'Données brutes pour un autre logiciel']};
  const fmt0 = D0.fmt || 'xlsx';
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Métré</span><h3 class="ed-t2">Exporter le DQE</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="dqx"><aside class="dqx-l">
      <div class="dqx-fm" role="radiogroup" aria-label="Format">${Object.entries(FM).map(([k, [n, ext, sub]]) => `<button type="button" role="radio" data-fmt="${k}" aria-checked="${k === fmt0}"><b>${n}</b><em>${ext}</em><small>${sub}</small></button>`).join('')}</div>
      <details open class="dqx-s"><summary>Document</summary><div class="fields">
        <label class="f wide"><span>Titre</span><span class="in"><input id="dxT" type="text" value="${esc(D0.title || 'DQE · ' + state.name)}" style="font-family:var(--f-body)"></span></label>
        <label class="f"><span>Maître d'ouvrage</span><span class="in"><input id="dxMo" type="text" value="${esc(D0.mo || '')}" style="font-family:var(--f-body)"></span></label>
        <label class="f"><span>Rédigé par</span><span class="in"><input id="dxBy" type="text" value="${esc(D0.by || '')}" style="font-family:var(--f-body)"></span></label></div>
        ${state.site?.label ? `<p class="hint">Lieu : ${esc(state.site.label)}</p>` : ''}</details>
      <details open class="dqx-s"><summary>Lots <em id="dxLn"></em></summary>
        <div class="dqx-bar"><button type="button" class="chip" data-lotall="1">Tout</button><button type="button" class="chip" data-lotall="0">Aucun</button></div>
        <div class="dqx-lots">${groups.map(g => `<label class="dqx-lot"><input type="checkbox" data-dxlot="${g.code}"${lotsOn.has(g.code) ? ' checked' : ''}><span><b>${g.code}</b> ${esc(g.name)}</span><em>${g.items.length} art.</em><i>${fmtE(g.total)}</i></label>`).join('')}</div></details>
      <details class="dqx-s"><summary>Colonnes et contenu</summary><div class="dqx-chips">${DQE_OPTS.map(([k, n]) => `<label class="dqx-chip"><input type="checkbox" data-dxo="${k}"${o0[k] ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div></details>
      <details class="dqx-s"><summary>Prix et TVA</summary><div class="fields"><label class="f"><span>TVA</span><span class="in"><select id="dxTva">${[20, 10, 5.5, 0].map(t => `<option value="${t}"${(D0.tva ?? 20) == t ? ' selected' : ''}>${nf(t, 1)} %</option>`).join('')}</select></span></label></div>
        <p class="hint">Les prix unitaires se saisissent dans l'onglet Métré · DQE ; ici on choisit seulement le taux.</p></details>
      <details class="dqx-s" id="dxStyle"><summary>Style du PDF</summary><div class="fields">
        <label class="f"><span>Couleur d'accent</span><span class="in"><input type="color" data-dxs="ac" value="${st0.ac}"></span></label>
        <label class="f"><span>Texte et titres</span><span class="in"><input type="color" data-dxs="dk" value="${st0.dk}"></span></label>
        <label class="f"><span>Police</span><span class="in"><select data-dxs="font">${opt(DQE_FONTS, st0.font)}</select></span></label>
        <label class="f"><span>Corps (pt)</span><span class="in"><select data-dxs="size">${[8, 9, 9.5, 10, 11, 12].map(v => `<option${v == st0.size ? ' selected' : ''}>${v}</option>`).join('')}</select></span></label>
        <label class="f"><span>Papier</span><span class="in"><select data-dxs="paper">${opt({A4:'A4', A3:'A3', Letter:'Letter'}, st0.paper)}</select></span></label>
        <label class="f"><span>Orientation</span><span class="in"><select data-dxs="orient">${opt({auto:'Automatique', portrait:'Portrait', landscape:'Paysage'}, st0.orient)}</select></span></label>
        <label class="f"><span>Marges (mm)</span><span class="in"><select data-dxs="margin">${[8, 10, 12, 15, 20, 25].map(v => `<option${v == st0.margin ? ' selected' : ''}>${v}</option>`).join('')}</select></span></label>
        <label class="f"><span>Filigrane</span><span class="in"><input type="text" data-dxs="mark" value="${esc(st0.mark)}" placeholder="ex. PROVISOIRE" style="font-family:var(--f-body)"></span></label></div>
        <label class="ap-check2"><input type="checkbox" data-dxs="zebra"${st0.zebra ? ' checked' : ''}> Lignes alternées (zébrage)</label></details>
    </aside><section class="dqx-r"><div class="dqx-ph"><b>Aperçu</b><span class="hint" id="dxPh"></span></div><iframe id="dxPrev" title="Aperçu du DQE"></iframe></section></div>
    <footer class="ed-f"><span class="dqx-sum" id="dxSum"></span><button class="btn" data-close>Annuler</button><button class="btn primary" id="dxGo">Exporter</button></footer>`, 'wide');
  const q = s => d.querySelector(s); let fmt = fmt0;
  const readStyle = () => { const o = {}; d.querySelectorAll('[data-dxs]').forEach(c => { const k = c.dataset.dxs; o[k] = c.type === 'checkbox' ? c.checked : (['size', 'margin'].includes(k) ? +c.value : c.value); }); return o; };
  const read = () => { const o = {}; d.querySelectorAll('[data-dxo]').forEach(c => o[c.dataset.dxo] = c.checked);
    return {...(state.dqe || {}), pu:state.dqe?.pu || {}, opts:o, lotsOff:[...d.querySelectorAll('[data-dxlot]')].filter(c => !c.checked).map(c => c.dataset.dxlot), title:q('#dxT').value.trim(), mo:q('#dxMo').value.trim(), by:q('#dxBy').value.trim(), tva:+q('#dxTva').value, style:readStyle(), fmt}; };
  const upd = () => {
    const on = groups.filter(g => d.querySelector(`[data-dxlot="${g.code}"]`)?.checked), ht = on.reduce((t, g) => t + g.total, 0), tva = +q('#dxTva').value, n = on.reduce((t, g) => t + g.items.length, 0);
    q('#dxLn').textContent = `${on.length}/${groups.length}`; q('#dxSum').innerHTML = `${n} article${n > 1 ? 's' : ''} · <b>HT ${fmtE(ht)}</b> · TVA ${nf(tva, 1)} % ${fmtE(ht * tva / 100)} · <b>TTC ${fmtE(ht * (1 + tva / 100))}</b>`;
    q('#dxGo').textContent = `Exporter en ${FM[fmt][0]}`; q('#dxStyle').hidden = fmt !== 'pdf';
    d.querySelectorAll('[data-fmt]').forEach(b => b.setAttribute('aria-checked', b.dataset.fmt === fmt));
    if (!n){ q('#dxPrev').srcdoc = '<p style="font:14px sans-serif;color:#666;padding:20px">Aucun lot sélectionné : cochez au moins un lot.</p>'; q('#dxGo').disabled = true; return; } q('#dxGo').disabled = false;
    const bak = state.dqe; state.dqe = read(); try { q('#dxPrev').srcdoc = dqeHTML(); q('#dxPh').textContent = fmt === 'pdf' ? 'tel qu\'imprimé' : 'présentation indicative du contenu exporté'; } catch(e){ q('#dxPh').textContent = 'aperçu indisponible'; } finally { state.dqe = bak; } };
  let tm; const later = () => { clearTimeout(tm); tm = setTimeout(upd, 160); };
  d.addEventListener('input', later); d.addEventListener('change', later);
  d.addEventListener('click', e => { const f = e.target.closest('[data-fmt]'); if (f){ fmt = f.dataset.fmt; upd(); return; } const a = e.target.closest('[data-lotall]'); if (a){ d.querySelectorAll('[data-dxlot]').forEach(c => c.checked = a.dataset.lotall === '1'); upd(); } });
  q('#dxGo').onclick = () => { state.dqe = read(); save(); closeEDlg(); doExport('dqe', fmt); };
  upd();
};
