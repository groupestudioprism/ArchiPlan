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
/* Aperçu en direct du DQE : le document est recalculé à chaque changement d'option */
(() => { const orig = openDqeExport;
  openDqeExport = function(){
    orig(); const d = document.querySelector('.ed-dlg, dialog[open], .edlg') || document.body, body = document.querySelector('.dqe-x'); if (!body) return;
    const st0 = {...DQE_STYLE0, ...(state.dqe?.style || {})}, sec2 = body.children[1];
    const opt = (o, v) => Object.entries(o).map(([k, x]) => `<option value="${k}"${k == v ? ' selected' : ''}>${Array.isArray(x) ? x[0] : x}</option>`).join('');
    const g = document.createElement('div'); g.className = 'grp'; g.innerHTML = `<h3>Style du PDF</h3><div class="fields">
      <label class="f"><span>Couleur d'accent</span><span class="in"><input type="color" data-dxs="ac" value="${st0.ac}"></span></label>
      <label class="f"><span>Couleur du texte et titres</span><span class="in"><input type="color" data-dxs="dk" value="${st0.dk}"></span></label>
      <label class="f"><span>Police</span><span class="in"><select data-dxs="font">${opt(DQE_FONTS, st0.font)}</select></span></label>
      <label class="f"><span>Corps (pt)</span><span class="in"><select data-dxs="size">${[8, 9, 9.5, 10, 11, 12].map(v => `<option${v == st0.size ? ' selected' : ''}>${v}</option>`).join('')}</select></span></label>
      <label class="f"><span>Papier</span><span class="in"><select data-dxs="paper">${opt({A4:'A4', A3:'A3', Letter:'Letter'}, st0.paper)}</select></span></label>
      <label class="f"><span>Orientation</span><span class="in"><select data-dxs="orient">${opt({auto:'Automatique', portrait:'Portrait', landscape:'Paysage'}, st0.orient)}</select></span></label>
      <label class="f"><span>Marges (mm)</span><span class="in"><select data-dxs="margin">${[8, 10, 12, 15, 20, 25].map(v => `<option${v == st0.margin ? ' selected' : ''}>${v}</option>`).join('')}</select></span></label>
      <label class="f"><span>Filigrane</span><span class="in"><input type="text" data-dxs="mark" value="${esc(st0.mark)}" placeholder="ex. PROVISOIRE" style="font-family:var(--f-body)"></span></label></div>
      <label class="ap-check2"><input type="checkbox" data-dxs="zebra"${st0.zebra ? ' checked' : ''}> Lignes alternées (zébrage)</label>`;
    if (sec2) sec2.appendChild(g);
    const readStyle = () => { const o = {}; body.querySelectorAll('[data-dxs]').forEach(c => { const k = c.dataset.dxs; o[k] = c.type === 'checkbox' ? c.checked : (['size', 'margin'].includes(k) ? +c.value : c.value); }); return o; };
    const box = document.createElement('section'); box.innerHTML = '<div class="grp" style="margin-top:0"><h3>Aperçu</h3><iframe id="dxPrev" style="width:100%;height:420px;border:1px solid var(--line,#ddd);border-radius:8px;background:#fff"></iframe></div>'; body.appendChild(box);
    body.style.gridTemplateColumns = 'minmax(260px,1fr) minmax(260px,1fr) minmax(300px,1.4fr)'; body.style.display = 'grid'; body.style.gap = '16px';
    const upd = () => { const o = {}; body.querySelectorAll('[data-dxo]').forEach(c => o[c.dataset.dxo] = c.checked);
      const off = [...body.querySelectorAll('[data-dxlot]')].filter(c => !c.checked).map(c => c.dataset.dxlot), bak = state.dqe;
      state.dqe = {...(bak || {}), pu:bak?.pu || {}, opts:o, lotsOff:off, title:body.querySelector('#dxT').value, mo:body.querySelector('#dxMo').value, by:body.querySelector('#dxBy').value, tva:+body.querySelector('#dxTva').value, style:readStyle()};
      try { body.querySelector('#dxPrev').srcdoc = dqeHTML(); } finally { state.dqe = bak; } };
    const sv = () => { state.dqe = {...(state.dqe || {}), style:readStyle()}; };
    body.addEventListener('input', sv); body.addEventListener('change', sv); body.addEventListener('input', upd); body.addEventListener('change', upd); upd();
  };
})();
