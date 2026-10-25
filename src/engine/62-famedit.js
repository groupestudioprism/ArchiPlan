/* ============ Éditeur de familles (façon Revit) : paramètres, types, pièces, assemblages ============ */
let famPrev = null;
function makeFamPreview(cv){
  const r = new THREE.WebGLRenderer({canvas:cv, antialias:true}); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.background = new THREE.Color('#EEF3F7');
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8a7a, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(-4, 8, 6); sc.add(dl);
  const cm = new THREE.PerspectiveCamera(40, 1, 0.01, 200); cm.position.set(-3, 2.5, 4);
  const oc = new OrbitControls(cm, cv); oc.enableDamping = true; oc.addEventListener('change', () => { need = 2; });
  const grp = new THREE.Group(); sc.add(grp); const grid = new THREE.GridHelper(10, 20, '#C9D6E0', '#DDE6EE'); sc.add(grid);
  let raf = 0, alive = true; let need = 2;   // dessin à la demande : seulement quand la vue ou le contenu change
  const loop = () => { if (!alive) return; raf = requestAnimationFrame(loop); const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * r.getPixelRatio()) || cv.height !== Math.round(h * r.getPixelRatio())){ r.setSize(w, h, false); cm.aspect = w / h; cm.updateProjectionMatrix(); need = 2; } if (oc.update() || need > 0){ r.render(sc, cm); if (need > 0) need--; } };
  loop();
  return {
    show(F, scope){
      need = 2; disposeGroup(grp);
      const by = {}; for (const so of famSolids(F, scope)) (by[so.m] ??= []).push(solidGeo({...so, c:[so.c[0], so.c[1], so.c[2]]}));
      for (const [m, geos] of Object.entries(by)) grp.add(meshOf(geos.length === 1 ? geos[0] : mergeGeos(geos), m, false, 30));
      if (F.host === 'wall'){ // mur fantôme autour de l'ouverture
        const w = fx(F.cut?.w ?? 'w', scope), h = fx(F.cut?.h ?? 'h', scope), Ww = w + 1.2, Hw = h + 0.8, t = 0.2;
        const mk = (x0, x1, z0, z1) => { if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return; const g = new THREE.BoxGeometry(x1 - x0, z1 - z0, t); g.translate((x0 + x1) / 2, (z0 + z1) / 2, 0); const mm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:'#D9DEE3', transparent:true, opacity:0.45})); grp.add(mm); };
        mk(-Ww / 2, -w / 2, 0, Hw); mk(w / 2, Ww / 2, 0, Hw); mk(-w / 2, w / 2, h, Hw);
      }
      const b = new THREE.Box3().setFromObject(grp); if (!b.isEmpty()){ const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length(); oc.target.copy(c); if (!this.framed){ cm.position.copy(c).add(new THREE.Vector3(-0.7, 0.55, 0.9).multiplyScalar(s * 1.1 + 0.5)); this.framed = true; } }
    },
    dispose(){ alive = false; cancelAnimationFrame(raf); disposeGroup(grp); oc.dispose(); r.dispose(); },
  };
}
function openFamEditor(id, instId){
  const src = id ? fam(id) : {nom:'Nouvelle famille', cat:'Mobilier', host:'free', params:{w:{v:1, label:'Largeur', unit:'m'}, d:{v:0.6, label:'Profondeur', unit:'m'}, h:{v:0.8, label:'Hauteur', unit:'m'}}, types:[{nom:'Standard', p:{}}], parts:[{s:'box', m:'chene', x:'-w/2', y:'-d/2', z:'0', w:'w', d:'d', h:'h'}]};
  const owner = id ? libOwner('fams', id) : 'new';
  const F = JSON.parse(JSON.stringify(src)); F.types = F.types?.length ? F.types : [{nom:'Standard', p:{}}]; F.params = F.params || {}; F.parts = F.parts || [];
  if (F.host === 'wall' && !F.cut) F.cut = {w:'w', h:'h'};
  let curType = instId ? (getEl(instId)?.type | 0) : 0;
  const famOpts = cur => Object.entries(libFams()).filter(([k]) => k !== id).map(([k, G]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(G.nom)}</option>`).join('');
  const html = `<header class="ed-h"><div><span class="eyebrow">Famille paramétrique${owner === 'base' ? ' · bibliothèque de base' : owner === 'perso' ? ' · ma bibliothèque' : ''}</span><input class="ed-name" id="fmName" value="${esc(F.nom)}" aria-label="Nom de la famille"></div><button class="ib" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body fm"><section class="fm-l">
      <div class="cp-row"><label class="f"><span>Catégorie</span><span class="in"><select id="fmCat">${[...new Set(FAM_CATS.concat([F.cat]))].map(c => `<option${c === F.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></span></label>
        <label class="f"><span>Pose</span><span class="in"><select id="fmHost"><option value="free"${F.host !== 'wall' ? ' selected' : ''}>Libre (au sol, sur une surface)</option><option value="wall"${F.host === 'wall' ? ' selected' : ''}>Dans un mur (découpe une ouverture)</option></select></span></label></div>
      <h4>Paramètres</h4><div id="fmParams"></div><button class="btn" id="fmPAdd">+ Paramètre</button>
      <h4>Types</h4><div id="fmTypes"></div><button class="btn" id="fmTAdd">+ Type</button>
      <div id="fmCutBox"><h4>Ouverture dans le mur</h4><div class="cp-row"><label class="f"><span>Largeur (formule)</span><span class="in"><input id="fmCutW" value="${esc(F.cut?.w ?? 'w')}"></span></label><label class="f"><span>Hauteur (formule)</span><span class="in"><input id="fmCutH" value="${esc(F.cut?.h ?? 'h')}"></span></label></div><p class="hint">L'allège vient du paramètre <code>sill</code> (à créer). Repère : x le long du mur (centré), y à travers le mur, z depuis l'allège.</p></div>
      <h4>Pièces</h4><p class="hint">Dimensions en formules : nombres, paramètres, + − × ÷ ( ), min, max, round… <code>n</code> répète la pièce (variable <code>i</code>), <code>si</code> la conditionne. « Famille » imbrique une autre famille (assemblage).</p>
      <div id="fmParts" class="fm-parts"></div><button class="btn" id="fmAPart">+ Pièce</button>
    </section><section class="fm-r"><canvas id="fmCv" class="fm-cv"></canvas><p class="fe" id="fmErr"></p><div id="fmStats" class="hint"></div></section></div>
    <footer class="ed-f"><span class="hint">${owner === 'base' ? 'Famille de base : l\'enregistrement crée une copie dans « Ma bibliothèque ».' : ''}</span>${owner === 'perso' ? '<button class="btn danger" id="fmDel">Supprimer</button>' : ''}<button class="btn" data-close>Annuler</button>${instId ? '<button class="btn" id="fmApply">Enregistrer et appliquer au composant</button>' : ''}<button class="btn primary" id="fmSave">${owner === 'perso' ? 'Enregistrer' : 'Enregistrer dans ma bibliothèque'}</button></footer>`;
  const d = openEDlg(html, 'wide');
  famPrev = makeFamPreview(d.querySelector('#fmCv'));
  const renderParams = () => {
    d.querySelector('#fmParams').innerHTML = `<table class="tbl ed-t"><thead><tr><th>Nom</th><th>Libellé</th><th class="n">Valeur</th><th>Unité</th><th></th></tr></thead><tbody>${Object.entries(F.params).map(([k, p]) => `<tr>
      <td><input data-pk="${esc(k)}" value="${esc(k)}" class="mono" size="6"></td><td><input data-pl="${esc(k)}" value="${esc(p.label || '')}"></td><td><input data-pv="${esc(k)}" type="number" step="0.01" value="${p.v}" class="mono n" size="6"></td><td><input data-pu="${esc(k)}" value="${esc(p.unit ?? 'm')}" size="3"></td><td><button class="x" data-px="${esc(k)}" aria-label="Supprimer">×</button></td></tr>`).join('')}</tbody></table>`;
  };
  const renderTypes = () => {
    const keys = Object.keys(F.params);
    d.querySelector('#fmTypes').innerHTML = `<div class="wrap"><table class="tbl ed-t"><thead><tr><th></th><th>Type</th>${keys.map(k => `<th class="n">${esc(k)}</th>`).join('')}<th></th></tr></thead><tbody>${F.types.map((t, i) => `<tr class="${i === curType ? 'cur' : ''}">
      <td><input type="radio" name="fmCur" data-tc="${i}"${i === curType ? ' checked' : ''} aria-label="Aperçu de ce type"></td><td><input data-tn="${i}" value="${esc(t.nom)}"></td>
      ${keys.map(k => `<td><input data-tv="${i}" data-k="${esc(k)}" value="${t.p?.[k] ?? ''}" placeholder="${F.params[k].v}" class="mono n" size="5"></td>`).join('')}
      <td><button class="x" data-tx="${i}" aria-label="Supprimer le type"${F.types.length > 1 ? '' : ' disabled'}>×</button></td></tr>`).join('')}</tbody></table></div>`;
  };
  const cell = (i, k, v, size = 6) => `<input data-q="${i}" data-k="${k}" value="${esc(v ?? '')}" class="mono" size="${size}" aria-label="${k}">`;
  const renderParts = () => {
    d.querySelector('#fmParts').innerHTML = F.parts.map((p, i) => `<div class="fp">
      <div class="fp-h"><select data-q="${i}" data-k="s"><option value="box"${!p.fam && (p.s || 'box') === 'box' ? ' selected' : ''}>Boîte</option><option value="cyl"${!p.fam && p.s === 'cyl' ? ' selected' : ''}>Cylindre</option><option value="sph"${!p.fam && p.s === 'sph' ? ' selected' : ''}>Sphère</option>${p.s === 'ext' ? '<option value="ext" selected>Profil extrudé</option>' : ''}<option value="fam"${p.fam ? ' selected' : ''}>Famille</option></select>
        ${p.fam ? pickHTML({attrs:`data-q="${i}" data-k="fam"`, cur:p.fam, kind:'fam', opt:{not:id}, cls:'fp-pick'}) : pickHTML({attrs:`data-q="${i}" data-k="m"`, cur:p.m, kind:'mat', cls:'fp-pick'})}
        <button class="x" data-qx="${i}" aria-label="Supprimer la pièce">×</button></div>
      <div class="fp-g"><label>x ${cell(i, 'x', p.x)}</label><label>y ${cell(i, 'y', p.y)}</label><label>z ${cell(i, 'z', p.z)}</label>
        ${p.fam ? `<label>rot ${cell(i, 'rot', p.rot)}</label><label class="w2">param. ${cell(i, 'pp', Object.entries(p.p || {}).map(([a, b]) => `${a}=${b}`).join('; '), 14)}</label>`
          : p.s === 'ext' ? `<label>h ${cell(i, 'h', p.h)}</label><span class="hint">profil de ${(p.pts || []).length} points (dessiné à l'outil Forme)</span>` : p.s === 'cyl' ? `<label>r ${cell(i, 'r', p.r)}</label><label>h ${cell(i, 'h', p.h)}</label>` : p.s === 'sph' ? `<label>r ${cell(i, 'r', p.r)}</label>` : `<label>w ${cell(i, 'w', p.w)}</label><label>d ${cell(i, 'd', p.d)}</label><label>h ${cell(i, 'h', p.h)}</label>`}
        <label>n ${cell(i, 'n', p.n, 4)}</label><label>si ${cell(i, 'if', p.if, 8)}</label></div></div>`).join('');
  };
  let tmr = 0;
  const refresh = () => { clearTimeout(tmr); tmr = setTimeout(() => {
    const err = d.querySelector('#fmErr'); err.textContent = '';
    try {
      fxCache.clear();
      const scope = famScope(F, {type:curType, params:{}});
      const sol = famSolids(F, scope); famPrev?.show(F, scope);
      let v = 0, m = 0; sol.forEach(so => { const vv = solidVol(so); v += vv; m += vv * mat(so.m).rho; });
      d.querySelector('#fmStats').textContent = `${sol.length} solide${sol.length > 1 ? 's' : ''} · ${nf(v, 3)} m³ · ${n0(m)} kg`;
    } catch(x){ err.textContent = x.message; }
  }, 120); };
  const all = () => { renderParams(); renderTypes(); renderParts(); d.querySelector('#fmCutBox').hidden = F.host !== 'wall'; refresh(); };
  d.querySelector('#fmCat').onchange = e => F.cat = e.target.value;
  d.querySelector('#fmHost').onchange = e => { F.host = e.target.value; if (F.host === 'wall'){ F.cut = F.cut || {w:'w', h:'h'}; if (!F.params.sill) F.params.sill = {v:0.9, label:'Allège', unit:'m'}; } all(); };
  d.querySelector('#fmCutW').oninput = e => { F.cut.w = e.target.value; refresh(); }; d.querySelector('#fmCutH').oninput = e => { F.cut.h = e.target.value; refresh(); };
  d.querySelector('#fmPAdd').onclick = () => { let k = 'p1', n = 1; while (F.params[k]) k = 'p' + (++n); F.params[k] = {v:1, label:'Paramètre', unit:'m'}; all(); };
  d.querySelector('#fmTAdd').onclick = () => { F.types.push({nom:'Type ' + (F.types.length + 1), p:{}}); curType = F.types.length - 1; all(); };
  d.querySelector('#fmAPart').onclick = () => { F.parts.push({s:'box', m:'chene', x:'0', y:'0', z:'0', w:'0.5', d:'0.5', h:'0.5'}); all(); };
  const bodyEl = d.querySelector('.fm-l');
  bodyEl.addEventListener('input', e => {
    const t = e.target, ds = t.dataset;
    if (ds.pl != null) F.params[ds.pl].label = t.value;
    else if (ds.pv != null){ const v = num(t.value); if (!Number.isNaN(v)) F.params[ds.pv].v = v; }
    else if (ds.pu != null) F.params[ds.pu].unit = t.value;
    else if (ds.tn != null) F.types[+ds.tn].nom = t.value;
    else if (ds.tv != null){ const ty = F.types[+ds.tv]; ty.p = ty.p || {}; if (t.value.trim() === '') delete ty.p[ds.k]; else { const v = num(t.value); ty.p[ds.k] = Number.isNaN(v) ? t.value : v; } }
    else if (ds.q != null && t.tagName === 'INPUT'){ const p = F.parts[+ds.q];
      if (t.dataset.pick != null){ p[ds.k] = t.value; if (ds.k === 'fam') return all(); return refresh(); }
      if (ds.k === 'pp'){ p.p = {}; t.value.split(/[;\n]/).forEach(s => { const [a, b] = s.split('='); if (a && b != null && a.trim()) p.p[a.trim()] = b.trim(); }); }
      else if (t.value.trim() === '' && ['n', 'if', 'rot'].includes(ds.k)) delete p[ds.k]; else p[ds.k] = t.value; }
    else return;
    refresh();
  });
  bodyEl.addEventListener('change', e => {
    const t = e.target, ds = t.dataset;
    if (ds.pk != null){ const nk = t.value.trim().replace(/[^\w]/g, ''); if (!nk || /^\d/.test(nk) || (F.params[nk] && nk !== ds.pk)){ toast('Nom de paramètre invalide ou déjà utilisé'); return all(); }
      if (nk !== ds.pk){ F.params[nk] = F.params[ds.pk]; delete F.params[ds.pk]; F.types.forEach(ty => { if (ty.p && ds.pk in ty.p){ ty.p[nk] = ty.p[ds.pk]; delete ty.p[ds.pk]; } }); } return all(); }
    if (ds.tc != null){ curType = +ds.tc; return refresh(); }
    if (ds.q != null && t.tagName === 'SELECT'){ const p = F.parts[+ds.q];
      if (ds.k === 's'){ if (t.value === 'fam'){ delete p.s; delete p.m; p.fam = Object.keys(libFams()).find(k => k !== id); p.rot = '0'; } else { delete p.fam; delete p.p; p.s = t.value; p.m = p.m || 'chene'; if (t.value !== 'box'){ p.r = p.r || '0.2'; } if (t.value === 'cyl') p.h = p.h || '1'; } return all(); }
      p[ds.k] = t.value; return refresh(); }
  });
  bodyEl.addEventListener('click', e => {
    const b = e.target.closest('button.x'); if (!b) return; const ds = b.dataset;
    if (ds.px != null){ delete F.params[ds.px]; F.types.forEach(ty => ty.p && delete ty.p[ds.px]); }
    else if (ds.tx != null && F.types.length > 1){ F.types.splice(+ds.tx, 1); curType = Math.min(curType, F.types.length - 1); }
    else if (ds.qx != null) F.parts.splice(+ds.qx, 1);
    all();
  });
  const persist = () => {
    F.nom = d.querySelector('#fmName').value.trim() || 'Famille';
    try { fxCache.clear(); famSolids(F, famScope(F, {type:0, params:{}})); } catch(x){ toast('Formule invalide : ' + x.message); return null; }
    let fid = id;
    if (owner === 'perso') USER_LIB.fams[id] = F;
    else if (owner === 'projet') state.lib.fams[id] = F;
    else { fid = 'F-' + uid8(); if (owner === 'base' && F.nom === src.nom) F.nom += ' (perso)'; USER_LIB.fams[fid] = F; }
    if (state.lib.fams[fid] && USER_LIB.fams[fid]) state.lib.fams[fid] = JSON.parse(JSON.stringify(F));
    saveUserLib(); return fid;
  };
  d.querySelector('#fmSave').onclick = () => { const fid = persist(); if (!fid) return; closeEDlg(); defs.comp.fam = fid; defs.comp.type = 0; pushHist(); embedUsedLib(); rebuild(); libTab = 'fams'; renderPanel(); toast('Famille enregistrée'); };
  const ap = d.querySelector('#fmApply'); if (ap) ap.onclick = () => { const fid = persist(); if (!fid) return; pushHist(); const el = getEl(instId); if (el){ el.fam = fid; el.type = Math.min(curType, F.types.length - 1); el.params = {}; } embedUsedLib(); closeEDlg(); rebuild(); toast('Famille appliquée'); };
  const del = d.querySelector('#fmDel'); if (del) del.onclick = () => { delete USER_LIB.fams[id]; saveUserLib(); closeEDlg(); renderPanel(); toast('Famille retirée de ma bibliothèque'); };
  all();
}
