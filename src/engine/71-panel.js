/* ============ Panneau latéral : Projet, Bibliothèque, Trafic, Légende ============ */
let activeTab = 'props', libCat = 'temp', libQ = '';
const pb = () => $('#pbody');
function setTab(t){ activeTab = t; $$('.tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t)); refreshPanel(); }
$$('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
function openPanelMobile(){ if (isNarrow.matches){ $('#panel').classList.add('open'); $('#scrim').classList.add('on'); } }
$('#panelBtn').addEventListener('click', () => { const p = $('#panel'); const o = !p.classList.contains('open'); p.classList.toggle('open', o); $('#scrim').classList.toggle('on', o); });
$('#scrim').addEventListener('click', () => { $('#panel').classList.remove('open'); $('#scrim').classList.remove('on'); });
let panelT = 0;
function refreshPanel(){ clearTimeout(panelT); panelT = setTimeout(renderPanel, 16); }
function renderPanel(){ if (!state) return; ({props:renderProps, lib:renderLib, traffic:renderTraffic, legend:renderLegendTab})[activeTab]?.(); }
const EL_NAME = {obj:'Élément', line:'Balisage', zone:'Emprise de chantier', closure:'Route barrée', detour:'Déviation', note:'Annotation', arrow:'Flèche', dim:'Cote', swept:'Épure de giration', model:'Maquette ARCHIPLAN'};
function elLabel(e){
  if (e.t === 'obj') return LIBK[e.k]?.name || e.k; if (e.t === 'line') return LINE_TYPES[e.k]?.n || 'Balisage';
  if (e.t === 'closure') return `${cap(e.name || 'Rue')} · ${e.mode === 'sens' ? 'un sens' : e.mode === 'alternat' ? 'alternat' : 'barrée'}`;
  if (e.t === 'detour') return e.name || 'Déviation'; if (e.t === 'zone') return e.name || 'Emprise'; if (e.t === 'note') return (e.text || '').split('\n')[0].slice(0, 40) || 'Annotation';
  if (e.t === 'dim') return `Cote ${fmtM(V.dist(e.a, e.b))}`; if (e.t === 'swept') return `Giration · ${SWEPT_VEH[e.veh]?.n || e.veh}`; if (e.t === 'model') return e.name || 'Maquette'; return EL_NAME[e.t] || e.t;
}
function elIcon(e){
  if (e.t === 'obj'){ const L = LIBK[e.k]; const th = L ? libThumb(L) : ''; return th ? `<img src="${th}" alt="">` : ''; }
  const col = e.t === 'closure' ? '#D32F2F' : e.t === 'detour' ? (e.col || '#F28A1A') : e.t === 'zone' ? '#F28A1A' : e.t === 'line' ? (LINE_TYPES[e.k]?.col || '#F06A12') : e.t === 'swept' ? '#7B1FA2' : e.t === 'arrow' ? (e.col || '#1565C0') : '#5B6B7F';
  return `<i style="background:${col}"></i>`;
}
function elSub(e){
  if (e.t === 'closure') return `${fmtM(e.len || plLen(e.pts || []))}${e.riv ? ' · sauf riverains' : ''}`;
  if (e.t === 'detour') return `${fmtM(e.len || plLen(e.pts || []))}${e.extra ? ` · +${fmtM(e.extra)}` : ''}${e.extraT ? ` · +${fmtDur(e.extraT)}` : ''}`;
  if (e.t === 'line'){ const L = plLen(e.pts), T = LINE_TYPES[e.k]; return `${fmtM(L)}${T?.item ? ` · ${Math.floor(L / (e.sp || T.sp)) + 1} u.` : ''}`; }
  if (e.t === 'zone') return `${nf(Math.abs(ringArea(e.pts)), 0)} m²${e.fence ? ' · clôturée' : ''}`;
  if (e.t === 'obj') return LIBK[e.k]?.ref || ''; if (e.t === 'swept') return `largeur balayée ${nf(e.w || 0, 2)} m`; return '';
}
/* ---------- onglet Projet ---------- */
function renderProps(){
  const s = state.site, e = sel && byId(sel); let h = '';
  if (e){ h += renderElProps(e); }
  else if (!s){
    h += `<div class="site-hero"><b>Où se trouve le chantier ?</b><span>Recherchez l'adresse : ARCHITRAFIC charge les rues (sens uniques, impasses), les bâtiments, les arbres et le relief en altitudes NGF, partout en France.</span></div>
      <button class="btn primary wide-btn" id="pSite">Choisir le lieu du chantier</button>`;
  } else {
    const W = WORLD, src = W?.src || {};
    h += `<div class="ph"><h2>${esc(state.name)}</h2><span class="tag">Chantier</span></div>
      <div class="grp"><h3>Lieu</h3><p class="hint" style="margin:0 0 8px">${esc(s.label || '')}</p>
      <dl class="kv"><dt>Zone chargée</dt><dd>${s.size || 500} × ${s.size || 500} m</dd>${W ? `<dt>Altitude NGF à l'origine</dt><dd class="big">${nf(W.z0, 2)} m</dd><dt>Voies circulées</dt><dd>${n0(W.W.roads.filter(r => r.drive).length)}</dd><dt>Bâtiments</dt><dd>${n0(W.W.bld.length)}</dd>` : '<dt>État</dt><dd>non chargée</dd>'}</dl>
      <div class="btns"><button class="btn" id="pSite">Changer de lieu</button><button class="btn" id="pReload" title="Télécharger à nouveau les rues, les bâtiments et le relief">Mettre à jour les données</button></div>
      ${W ? `<p class="src">Sources : relief ${esc(src.elev || 'IGN')} (NGF-IGN69) · bâtiments ${esc(src.bld || '')} · voirie, sens uniques et arbres © contributeurs OpenStreetMap (ODbL)${src.ortho ? ' · photo aérienne IGN BD ORTHO®' : ''} · textures Poly Haven (CC0). Données du ${new Date(src.at || Date.now()).toLocaleDateString('fr-FR')}.</p>` : ''}</div>`;
    const groups = [['closure', 'Routes barrées'], ['detour', 'Déviations'], ['zone', 'Emprises'], ['obj', 'Signalisation, balisage, véhicules'], ['line', 'Balisage en ligne'], ['swept', 'Épures de giration'], ['note', 'Annotations'], ['arrow', 'Flèches'], ['dim', 'Cotes'], ['model', 'Maquettes ARCHIPLAN']];
    const any = state.els.length;
    h += `<div class="grp"><h3>Éléments du chantier</h3>${any ? '' : '<p class="hint">Barrez une rue (outil <b>Route barrée</b>, touche <kbd>B</kbd>) : la déviation et les panneaux sont proposés automatiquement. Puis complétez avec la bibliothèque.</p>'}`;
    for (const [t, n] of groups){ const L = state.els.filter(x => x.t === t); if (!L.length) continue;
      h += `<p class="lsec">${n} · ${L.length}</p><div class="elist">${L.slice(0, 80).map(x => `<div class="erow${x.id === sel ? ' on' : ''}" data-el="${x.id}"><span class="ei">${elIcon(x)}</span><span><b>${esc(elLabel(x))}</b><small>${esc(elSub(x))}</small></span><button class="x" data-del="${x.id}" title="Supprimer" aria-label="Supprimer">×</button></div>`).join('')}${L.length > 80 ? `<p class="hint">… et ${L.length - 80} autres</p>` : ''}</div>`; }
    h += `</div><div class="grp"><h3>Informations du chantier</h3><div class="fields">
      <label class="f wide"><span>Nom du chantier</span><span class="in"><input id="mName" value="${esc(state.name)}" style="font-family:var(--f-body)"></span></label>
      <label class="f wide"><span>Maître d'ouvrage</span><span class="in"><input id="mMoa" value="${esc(state.meta.moa)}" style="font-family:var(--f-body)"></span></label>
      <label class="f wide"><span>Entreprise</span><span class="in"><input id="mEnt" value="${esc(state.meta.entreprise)}" style="font-family:var(--f-body)"></span></label>
      <label class="f"><span>Du</span><span class="in"><input id="mFrom" type="date" value="${esc(state.meta.from)}"></span></label><label class="f"><span>Au</span><span class="in"><input id="mTo" type="date" value="${esc(state.meta.to)}"></span></label>
      <label class="f wide"><span>Arrêté de circulation n°</span><span class="in"><input id="mArr" value="${esc(state.meta.arrete)}" style="font-family:var(--f-body)"></span></label></div>
      <p class="hint">Ces informations figurent dans le cartouche des plans exportés.</p></div>`;
  }
  pb().innerHTML = h; bindProps();
}
function bindProps(){
  const B = pb();
  B.querySelectorAll('#pSite').forEach(b => b.onclick = openSiteDialog); const rl = $('#pReload'); if (rl) rl.onclick = () => loadSite(true);
  B.querySelectorAll('[data-el]').forEach(r => r.onclick = ev => { if (ev.target.closest('[data-del]')) return; sel = r.dataset.el; applySel(); const e = byId(sel); const c = elCenter(e); frameAt(c[0], c[1], e.pts ? Math.max(30, plLen(e.pts) / 2) : 25); renderProps(); });
  B.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { sel = b.dataset.del; deleteSel(); });
  const meta = [['mMoa', 'moa'], ['mEnt', 'entreprise'], ['mFrom', 'from'], ['mTo', 'to'], ['mArr', 'arrete']];
  for (const [id, k] of meta){ const i = $('#' + id); if (i) i.onchange = () => { beginEdit(); state.meta[k] = i.value; endEdit(); renderLegend(); }; }
  const nm = $('#mName'); if (nm) nm.onchange = () => { beginEdit(); state.name = nm.value.trim() || 'Chantier'; endEdit(); $('#projName').textContent = state.name; };
  bindElProps();
}
function renderElProps(e){
  let h = `<div class="ph"><h2>${esc(elLabel(e))}</h2><span class="tag">${esc(EL_NAME[e.t] || '')}</span></div>`;
  const fld = (id, label, val, type = 'text', extra = '') => `<label class="f${type === 'text' ? ' wide' : ''}"><span>${label}</span><span class="in"><input id="${id}" type="${type}" value="${esc(val ?? '')}" ${extra}${type === 'text' ? ' style="font-family:var(--f-body)"' : ''}></span></label>`;
  const selF = (id, label, opts, val, wide = true) => `<label class="f${wide ? ' wide' : ''}"><span>${label}</span><span class="in"><select id="${id}">${opts.map(([v, n]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></span></label>`;
  if (e.t === 'obj'){
    const L = LIBK[e.k]; h += `<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px"><img src="${L ? libThumb(L) : ''}" alt="" style="width:64px;height:64px;object-fit:contain"><div class="hint">${esc(L?.ref ? 'Référence ' + L.ref : '')}${L?.sign ? '<br>Orienté automatiquement face au trafic.' : ''}</div></div><div class="fields">`;
    h += fld('eA', 'Orientation (°)', Math.round(((e.a || 0) * 180 / Math.PI % 360 + 360) % 360), 'number', 'step="5"');
    h += fld('eDz', 'Hauteur ajoutée (m)', e.dz || 0, 'number', 'step="0.05"');
    if (L?.sign && SIGNS[L.sign]?.p?.v != null) h += fld('eV', 'Valeur', e.p?.v ?? '30');
    if (L?.sign && (SIGNS[L.sign]?.p?.t != null || SIGNS[L.sign]?.base === 'KC1')) h += `<label class="f wide"><span>Texte (une ligne par « | »)</span><span class="in"><input id="eT" value="${esc(e.p?.t ?? SIGNS[L.sign]?.p?.t ?? '')}" style="font-family:var(--f-body)"></span></label>`;
    if (L?.cat === 'reg') h += selF('ePole', 'Support', [['chevalet', 'Chevalet de chantier'], ['mât', 'Mât']], e.p?.pole || 'chevalet');
    if (e.k === 'K5a') h += selF('eH', 'Hauteur du cône', [['0.5', '50 cm'], ['0.75', '75 cm'], ['1', '1 m']], e.p?.h || '0.75');
    if (e.k === 'KR11') h += selF('eOn', 'Feu allumé', [['red', 'Rouge'], ['orange', 'Orange'], ['green', 'Vert']], e.p?.on || 'red');
    if (L?.color) h += `<label class="f"><span>Couleur</span><span class="in"><input id="eCol" type="color" value="${esc(e.p?.color || '#8D949B')}" style="height:30px;padding:0"></span></label>`;
    h += `</div>`;
  } else if (e.t === 'closure'){
    h += `<div class="fields">${fld('eName', 'Nom de la voie', e.name)}${selF('eMode', 'Fermeture', [['total', 'Totale (2 sens)'], ['sens', 'Un seul sens'], ['alternat', 'Alternat (circulation maintenue)']], e.mode)}
      ${e.mode === 'sens' ? selF('eDir', 'Sens fermé', [['1', 'Sens du tracé'], ['-1', 'Sens inverse']], e.dir) : ''}<label class="f rchk wide"><input type="checkbox" id="eRiv"${e.riv ? ' checked' : ''}> Sauf riverains (panneaux « Rue barrée sauf riverains »)</label></div>
      <dl class="kv" style="margin-top:10px"><dt>Longueur barrée</dt><dd>${fmtM(e.len || plLen(e.pts))}</dd></dl>
      <div class="btns"><button class="btn primary" id="eDet">Recalculer les déviations</button><button class="btn" id="eSig">Reposer les panneaux</button></div>`;
  } else if (e.t === 'detour'){
    h += `<div class="fields">${fld('eName', 'Nom', e.name)}<label class="f"><span>Couleur</span><span class="in"><input id="eCol2" type="color" value="${esc(e.col || '#F28A1A')}" style="height:30px;padding:0"></span></label>${selF('eCls', 'Véhicules concernés', [['tous', 'Tous véhicules'], ['VL', 'Véhicules légers'], ['PL', 'Poids lourds'], ['bus', 'Bus'], ['velo', 'Cycles']], e.cls, false)}</div>
      <dl class="kv" style="margin-top:10px"><dt>Longueur</dt><dd>${fmtM(e.len || plLen(e.pts))}</dd>${e.extra != null ? `<dt>Allongement</dt><dd>+${fmtM(e.extra)}</dd>` : ''}${e.extraT != null ? `<dt>Temps perdu (fluide)</dt><dd>+${fmtDur(e.extraT)}</dd>` : ''}${e.via ? `<dt>Par</dt><dd style="font-family:var(--f-body);text-align:right">${esc(e.via)}</dd>` : ''}</dl>`;
  } else if (e.t === 'zone'){
    h += `<div class="fields">${fld('eName', 'Nom', e.name)}<label class="f rchk wide"><input type="checkbox" id="eFence"${e.fence ? ' checked' : ''}> Clôturer l'emprise (clôture de chantier)</label></div><dl class="kv" style="margin-top:10px"><dt>Surface</dt><dd>${nf(Math.abs(ringArea(e.pts)), 1)} m²</dd><dt>Périmètre</dt><dd>${fmtM(plLen([...e.pts, e.pts[0]]))}</dd></dl>`;
  } else if (e.t === 'line'){
    const T = LINE_TYPES[e.k]; h += `<div class="fields">${selF('eLine', 'Type', Object.entries(LINE_TYPES).map(([k, t]) => [k, t.n]), e.k)}${T?.item ? fld('eSp', 'Espacement (m)', e.sp || T.sp, 'number', 'step="0.5" min="1"') : ''}</div><dl class="kv" style="margin-top:10px"><dt>Longueur</dt><dd>${fmtM(plLen(e.pts))}</dd></dl>`;
  } else if (e.t === 'note'){
    h += `<textarea class="note-in" id="eText">${esc(e.text)}</textarea><div class="fields" style="margin-top:8px"><label class="f"><span>Couleur</span><span class="in"><input id="eCol3" type="color" value="${esc(e.col || '#1565C0')}" style="height:30px;padding:0"></span></label>${selF('eSize', 'Taille', [['', 'Normale'], ['big', 'Grande']], e.size || '', false)}</div>`;
  } else if (e.t === 'arrow'){
    h += `<div class="fields"><label class="f"><span>Couleur</span><span class="in"><input id="eCol4" type="color" value="${esc(e.col || '#1565C0')}" style="height:30px;padding:0"></span></label>${fld('eW', 'Largeur (m)', e.w || 1.2, 'number', 'step="0.1" min="0.3"')}${fld('eLab', 'Légende', e.label || '')}</div>`;
  } else if (e.t === 'swept'){
    h += `<dl class="kv"><dt>Véhicule</dt><dd style="font-family:var(--f-body)">${esc(SWEPT_VEH[e.veh]?.n || '')}</dd><dt>Largeur balayée max.</dt><dd class="big">${nf(e.w || 0, 2)} m</dd><dt>Longueur de trajectoire</dt><dd>${fmtM(plLen(e.pts))}</dd></dl><p class="hint">Enveloppe calculée par suivi en tractrice des essieux ; à vérifier pour un dimensionnement définitif.</p>`;
  } else if (e.t === 'model'){
    h += `<div class="fields">${fld('eA', 'Orientation (°)', Math.round((e.a || 0) * 180 / Math.PI), 'number', 'step="1"')}</div><p class="hint">${MODELS.has(e.key) ? 'Maquette ARCHIPLAN placée à son adresse.' : 'La maquette n\'est pas enregistrée sur cet appareil : réimportez le fichier .glb (Fichier → Importer une maquette ARCHIPLAN).'}</p>`;
  }
  h += `<div class="btns"><button class="btn" id="eZoom">Centrer la vue</button><button class="btn" id="eHide">${e.hidden ? 'Afficher' : 'Masquer'}</button><button class="btn danger" id="eDel">Supprimer</button><button class="btn" id="eBack">← Tous les éléments</button></div>`;
  return h;
}
function bindElProps(){
  const e = sel && byId(sel); if (!e) return; const v = id => $('#' + id);
  const ch = (id, f, ev = 'change') => { const el = v(id); if (el) el.addEventListener(ev, () => { edit(() => f(el)); }); };
  ch('eA', el => { e.a = (+el.value || 0) * Math.PI / 180; e.manualA = true; }); ch('eDz', el => { e.dz = +el.value || 0; });
  ch('eV', el => { e.p = {...(e.p || {}), v:el.value}; }); ch('eT', el => { e.p = {...(e.p || {}), t:el.value}; }); ch('ePole', el => { e.p = {...(e.p || {}), pole:el.value}; });
  ch('eH', el => { e.p = {...(e.p || {}), h:el.value}; }); ch('eOn', el => { e.p = {...(e.p || {}), on:el.value}; }); ch('eCol', el => { e.p = {...(e.p || {}), color:el.value}; });
  ch('eName', el => { e.name = el.value; }); ch('eMode', el => { e.mode = el.value; }); ch('eDir', el => { e.dir = +el.value; }); ch('eRiv', el => { e.riv = el.checked; });
  ch('eCol2', el => { e.col = el.value; }); ch('eCls', el => { e.cls = el.value; }); ch('eFence', el => { e.fence = el.checked; });
  ch('eLine', el => { e.k = el.value; e.sp = undefined; }); ch('eSp', el => { e.sp = +el.value || undefined; });
  ch('eText', el => { e.text = el.value; }); ch('eCol3', el => { e.col = el.value; }); ch('eSize', el => { e.size = el.value; });
  ch('eCol4', el => { e.col = el.value; }); ch('eW', el => { e.w = +el.value || 1.2; }); ch('eLab', el => { e.label = el.value; });
  const b = (id, f) => { const el = v(id); if (el) el.onclick = f; };
  b('eDet', () => { const r = (() => { let out; edit(() => { out = addDetoursFor(e); }); return out; })(); toast(r.ok ? `${r.ok} déviation${r.ok > 1 ? 's' : ''} recalculée${r.ok > 1 ? 's' : ''}` : 'Aucune déviation possible depuis ce tronçon.'); });
  b('eSig', () => { edit(() => autoSigns(e)); toast('Panneaux de route barrée et de déviation reposés'); });
  b('eZoom', () => { const c = elCenter(e); frameAt(c[0], c[1], e.pts ? Math.max(30, plLen(e.pts) / 2) : 20); });
  b('eHide', () => edit(() => { e.hidden = !e.hidden; })); b('eDel', deleteSel); b('eBack', () => { sel = null; applySel(); renderProps(); });
}
/* ---------- onglet Bibliothèque ---------- */
function renderLib(){
  const q = libQ.trim().toLowerCase(), items = LIB.filter(e => q ? (e.name + ' ' + (e.ref || '') + ' ' + LIB_CATS[e.cat]).toLowerCase().includes(q) : e.cat === libCat);
  pb().innerHTML = `<div class="lsearch"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="libQ" placeholder="Rechercher : AK5, cône, pelle, déviation…" value="${esc(libQ)}"></div>
    <div class="lcats">${Object.entries(LIB_CATS).map(([k, n]) => `<button type="button" data-cat="${k}" aria-pressed="${!q && k === libCat}">${n}</button>`).join('')}</div>
    <div class="lgrid">${items.map(e => `<button type="button" class="lcard${PLACE.k === e.k && tool === 'place' ? ' on' : ''}" data-k="${e.k}" title="${esc(e.name)}"><img data-th="${e.k}" src="${THUMBS[e.k] || (e.sign ? libThumb(e) : '')}" alt=""><b>${esc(e.name)}</b>${e.ref ? `<small>${esc(e.ref)}</small>` : ''}</button>`).join('') || '<p class="hint">Aucun élément ne correspond.</p>'}</div>
    <p class="src">Panneaux dessinés selon l'Instruction interministérielle sur la signalisation routière. Véhicules et engins génériques, sans marque.</p>`;
  const qi = $('#libQ'); qi.oninput = () => { libQ = qi.value; const pos = qi.selectionStart; renderLib(); const n = $('#libQ'); n.focus(); n.setSelectionRange(pos, pos); };
  pb().querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { libCat = b.dataset.cat; libQ = ''; renderLib(); });
  pb().querySelectorAll('[data-k]').forEach(b => b.onclick = () => { PLACE = {k:b.dataset.k, a:0, p:LIBK[b.dataset.k]?.p ? {...LIBK[b.dataset.k].p} : {}}; if (ghost){ previewGroup.remove(ghost); ghost = null; } tool = 'place'; $$('.tool').forEach(t => t.setAttribute('aria-pressed', t.dataset.tool === 'place')); syncHud(); setPrompt(); renderLib(); if (isNarrow.matches){ $('#panel').classList.remove('open'); $('#scrim').classList.remove('on'); } });
  // vignettes 3D générées au fil de l'eau
  const todo = [...pb().querySelectorAll('img[data-th]')].filter(i => !i.getAttribute('src'));
  const later = f => window.requestIdleCallback ? requestIdleCallback(f, {timeout:200}) : setTimeout(f, 20);
  const next = () => { const img = todo.shift(); if (!img) return; const e = LIBK[img.dataset.th]; if (img.isConnected) img.src = libThumb(e); later(next); };
  next();
}
/* ---------- onglet Trafic ---------- */
function renderTraffic(){
  const cls = state.els.filter(e => e.t === 'closure'), dts = state.els.filter(e => e.t === 'detour'), m = state.sim.mix;
  let h = `<div class="ph"><h2>Circulation</h2><span class="tag">${cls.length} route${cls.length > 1 ? 's' : ''} barrée${cls.length > 1 ? 's' : ''}</span></div>`;
  if (!WORLD) h += `<p class="hint">Choisissez d'abord le lieu du chantier.</p>`;
  h += `<div class="grp"><h3>Routes barrées et déviations</h3>`;
  if (!cls.length) h += `<p class="hint">Aucune rue barrée. Outil <b>Route barrée</b> (<kbd>B</kbd>) : cliquez sur une rue, la déviation est calculée en respectant les sens uniques, les impasses et les interdictions de tourner.</p>`;
  for (const c of cls){ const ds = dts.filter(d => d.cl === c.id);
    h += `<div class="erow" data-el="${c.id}" style="margin-bottom:4px"><span class="ei"><i style="background:#D32F2F"></i></span><span><b>${esc(elLabel(c))}</b><small>${esc(elSub(c))}</small></span><button class="x" data-del="${c.id}" aria-label="Supprimer">×</button></div>`;
    h += ds.map(d => `<div class="erow" data-el="${d.id}" style="margin:0 0 4px 18px"><span class="ei"><i style="background:${esc(d.col)}"></i></span><span><b>${esc(d.name)}</b><small>${esc(elSub(d))}${d.via ? ' · par ' + esc(d.via) : ''}</small></span><button class="x" data-del="${d.id}" aria-label="Supprimer">×</button></div>`).join('') || (c.mode === 'alternat' ? '<p class="hint" style="margin:0 0 8px 18px">Alternat : circulation maintenue, vitesse réduite.</p>' : `<p class="hint" style="margin:0 0 8px 18px">Pas de déviation. <button class="btn" data-redet="${c.id}">Proposer</button></p>`);
  }
  const free = dts.filter(d => !d.cl); if (free.length) h += `<p class="lsec">Itinéraires tracés</p>` + free.map(d => `<div class="erow" data-el="${d.id}"><span class="ei"><i style="background:${esc(d.col)}"></i></span><span><b>${esc(d.name)}</b><small>${esc(elSub(d))}</small></span><button class="x" data-del="${d.id}">×</button></div>`).join('');
  h += `</div><div class="grp"><h3>Simulation du trafic</h3><p class="hint" style="margin-top:0">Les véhicules entrent par les rues en bordure de zone, choisissent une destination et suivent les déviations. Lancez la simulation avec ▶ en bas de la vue ou la touche <kbd>Espace</kbd>.</p>
    <div class="fields"><label class="f wide"><span>Densité</span><span class="in"><select id="tDens">${[['0.4', 'Calme'], ['1', 'Normal'], ['1.8', 'Heure de pointe'], ['3', 'Saturé']].map(([v, n]) => `<option value="${v}"${String(state.sim.dens) === v ? ' selected' : ''}>${n}</option>`).join('')}</select></span></label>
    ${[['vl', 'Voitures (%)'], ['vul', 'Utilitaires (%)'], ['pl', 'Poids lourds (%)'], ['bus', 'Bus (%)'], ['r2', 'Deux-roues (%)']].map(([k, n]) => `<label class="f"><span>${n}</span><span class="in"><input type="number" min="0" max="100" step="1" data-mix="${k}" value="${m[k]}"></span></label>`).join('')}</div>
    <div id="tStats"></div></div>`;
  pb().innerHTML = h;
  pb().querySelectorAll('[data-el]').forEach(r => r.onclick = ev => { if (ev.target.closest('[data-del]')) return; sel = r.dataset.el; applySel(); const e = byId(sel); const c = elCenter(e); frameAt(c[0], c[1], Math.max(40, plLen(e.pts || []) / 2)); setTab('props'); });
  pb().querySelectorAll('[data-del]').forEach(b => b.onclick = () => { sel = b.dataset.del; deleteSel(); renderTraffic(); });
  pb().querySelectorAll('[data-redet]').forEach(b => b.onclick = () => { const c = byId(b.dataset.redet); let r; edit(() => { r = addDetoursFor(c); autoSigns(c); }); toast(r.ok ? 'Déviation proposée' : 'Aucune déviation possible depuis ce tronçon.'); renderTraffic(); });
  $('#tDens').onchange = e => { state.sim.dens = +e.target.value; $('#simDens').value = e.target.value; save(); };
  pb().querySelectorAll('[data-mix]').forEach(i => i.onchange = () => { state.sim.mix[i.dataset.mix] = clamp(+i.value || 0, 0, 100); save(); });
  renderTrafficStats();
}
function renderTrafficStats(){
  const el = $('#tStats'); if (!el) return; const L = SIM.live;
  if (!L || !SIM.t){ el.innerHTML = ''; return; }
  el.innerHTML = `<div class="sumcards"><div><b>${L.n}</b><span>véhicules</span></div><div><b>${Math.round(L.vm)}</b><span>km/h moyens</span></div><div><b>${L.dev}</b><span>déviés</span></div></div>
    <dl class="kv" style="margin-top:10px"><dt>Trajets terminés</dt><dd>${L.done}</dd><dt>Retard moyen par trajet</dt><dd>${L.done ? fmtDur(Math.max(0, L.delay)) : '—'}</dd><dt>Véhicules à l'arrêt</dt><dd>${L.stopped}</dd></dl>`;
}
/* ---------- fenêtres (dialogue moteur) ---------- */
function dlgEngine(html, size = ''){ const d = $('#engDlg'); d.className = size; d.querySelector('.edlg-card').innerHTML = html; d.hidden = false; }
function closeEngine(){ $('#engDlg').hidden = true; }
$('#engDlg').addEventListener('click', e => { if (e.target.id === 'engDlg') closeEngine(); });
