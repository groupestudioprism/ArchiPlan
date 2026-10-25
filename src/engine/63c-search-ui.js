/* ============ Recherche : sélecteurs intelligents (matériaux, compositions, familles) et palette globale Ctrl+K ============
   - pickHTML / pickField : remplace les longues listes déroulantes par un champ qui ouvre une fenêtre de recherche
     (clavier, souris, tactile) ; la valeur vit dans un <input type="hidden" data-pick> qui émet input + change,
     les gestionnaires existants (panneau, fiche de composition, éditeur de famille) n'ont rien à savoir ;
   - openPicker : la fenêtre elle-même, aussi utilisée par les pilules de l'ATH (loupe) ;
   - palette globale : Ctrl+K, touche « / », bouton loupe de la barre : outils, matériaux, compositions, familles,
     éléments du projet, niveaux, exports. */
const SPK = {pop:null, open:false, kind:'', opt:{}, items:[], shown:[], value:'', onPick:null, anchor:null, q:'', act:-1, label:''};
const SEARCH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const PICK_KIND_LABEL = {mat:'Matériau', compo:'Composition', fam:'Famille'};

/* ---------- éléments des listes ---------- */
function pickItems(kind, opt = {}){
  if (kind === 'mat'){
    const L = searchMats(opt.paint ? (k, m) => !m.R && m.cat !== "Lames d'air et divers" : null).map(x => ({id:x.id, nom:x.m.nom, grp:x.m.cat || 'Divers', meta:x.m.R != null ? `R ${nf(x.m.R, 2)}` : `λ ${nf(x.m.lambda, 3)}`, color:x.m.color, ix:x.ix, own:libOwner('mats', x.id)}));
    if (opt.paint) L.sort((a, b) => (a.grp === 'Peintures et finitions' ? -1 : b.grp === 'Peintures et finitions' ? 1 : 0));
    return L;
  }
  if (kind === 'compo'){
    const KL = {wall:'Murs et cloisons', slab:'Planchers et toitures-terrasses', roof:'Toitures en pente'};
    return searchCompos(opt.kind).map(x => { const L = x.c.kind === 'wall' ? x.c.layers.slice().reverse() : x.c.layers, r = thermal(L, x.c.kind === 'wall' ? 'mur' : x.c.kind === 'roof' ? 'toiture' : 'plancherBas');
      return {id:x.id, nom:x.c.nom, grp:KL[x.c.kind] || x.c.kind, meta:`U ${nf(r.U, 2)} · ${nf(x.c.layers.reduce((s, l) => s + l[1], 0) * 100, 1)} cm`, bar:layerBar(x.c.layers), ix:x.ix, own:libOwner('compos', x.id)}; });
  }
  if (kind === 'fam') return searchFams().filter(x => !opt.not || x.id !== opt.not).map(x => ({id:x.id, nom:x.F.nom, grp:(famPath(x.id, x.F) || [x.F.cat])[0] || 'Familles', meta:`${(x.F.types || []).length} type${(x.F.types || []).length > 1 ? 's' : ''}`, ix:x.ix, own:libOwner('fams', x.id)}));
  return [];
}
function pickLabelHTML(kind, id, opt = {}){
  if (kind === 'mat'){ if (!id){ return `<i class="swt none"></i><span class="spk-n">${esc(opt.none || '—')}</span>`; } const m = mat(id); return `<i class="swt" style="background:${m.color}"></i><span class="spk-n">${esc(m.nom)}</span><small>${esc(m.cat || '')}</small>`; }
  if (kind === 'compo'){ const c = compo(id); return `${layerBar(c.layers)}<span class="spk-n">${esc(c.nom)}</span>`; }
  if (kind === 'fam'){ const F = fam(id); return `<span class="spk-n">${esc(F?.nom || id)}</span>`; }
  return `<span class="spk-n">${esc(id)}</span>`;
}
/* champ : attrs = attributs de l'input caché (data-f="mat", data-lm="2"…) */
function pickHTML({attrs = '', cur = '', kind = 'mat', opt = {}, cls = ''} = {}){
  return `<span class="spk ${cls}" data-spk="${kind}" data-opt="${esc(JSON.stringify(opt))}"><input type="hidden" ${attrs} data-pick="1" value="${esc(cur)}"><button type="button" class="spk-b" aria-haspopup="dialog" title="Rechercher ${PICK_KIND_LABEL[kind] ? 'un' + (kind === 'compo' ? 'e ' : ' ') + PICK_KIND_LABEL[kind].toLowerCase() : ''}">${pickLabelHTML(kind, cur, opt)}<span class="spk-c">${SEARCH_ICON}</span></button></span>`;
}
function pickField(label, f, cur, kind = 'mat', opt = {}, wide = true){ return `<label class="f${wide ? ' wide' : ''} fpick"><span>${label}</span>${pickHTML({attrs:`data-f="${f}"`, cur, kind, opt})}</label>`; }

/* ---------- fenêtre de recherche ---------- */
function spkEl(){
  if (SPK.pop) return SPK.pop;
  const d = document.createElement('div'); d.id = 'spkPop'; d.className = 'spk-pop'; d.hidden = true; d.setAttribute('role', 'dialog');
  d.innerHTML = `<div class="spk-top">${SEARCH_ICON}<input type="search" class="spk-q" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Rechercher"><button type="button" class="ib ghost spk-x" aria-label="Fermer">✕</button></div><div class="spk-chips"></div><div class="spk-list" role="listbox"></div><div class="spk-foot"><span>↑ ↓ parcourir · Entrée choisir · Échap fermer</span><span class="spk-n2"></span></div>`;
  document.body.appendChild(d); SPK.pop = d;
  const q = d.querySelector('.spk-q');
  q.addEventListener('input', () => { SPK.q = q.value; SPK.act = -1; spkRender(); });
  d.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape'){ e.preventDefault(); closePicker(true); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); if (!SPK.shown.length) return; SPK.act = SPK.act < 0 ? (e.key === 'ArrowDown' ? 0 : SPK.shown.length - 1) : (SPK.act + (e.key === 'ArrowDown' ? 1 : -1) + SPK.shown.length) % SPK.shown.length; spkMarkActive(true); }
    else if (e.key === 'Enter'){ e.preventDefault(); const i = SPK.act >= 0 ? SPK.act : 0; if (SPK.shown[i]) spkChoose(SPK.shown[i].id); }
    else if (e.key === 'Tab'){ closePicker(true); }
  });
  d.querySelector('.spk-x').addEventListener('click', () => closePicker(true));
  d.addEventListener('click', e => { const r = e.target.closest('.spk-r'); if (r){ spkChoose(r.dataset.v); return; } const c = e.target.closest('.spk-chip'); if (c){ q.value = c.dataset.q; SPK.q = q.value; SPK.act = -1; spkRender(); q.focus(); } });
  d.addEventListener('pointermove', e => { const r = e.target.closest('.spk-r'); if (!r) return; const i = +r.dataset.i; if (i !== SPK.act){ SPK.act = i; spkMarkActive(false); } });
  document.addEventListener('pointerdown', e => { if (SPK.open && !d.contains(e.target) && !(SPK.anchor && SPK.anchor.contains(e.target))) closePicker(false); }, true);
  window.addEventListener('resize', () => { if (SPK.open) spkPlace(); });
  return d;
}
function openPicker({anchor, kind = 'mat', opt = {}, value = '', onPick, label = ''}){
  const d = spkEl();
  SPK.kind = kind; SPK.opt = opt || {}; SPK.value = value; SPK.onPick = onPick; SPK.anchor = anchor || null; SPK.q = ''; SPK.act = -1; SPK.label = label;
  SPK.items = pickItems(kind, SPK.opt);
  const q = d.querySelector('.spk-q'); q.value = '';
  q.placeholder = kind === 'mat' ? 'Rechercher un matériau : vapeur, isolant, couche intermédiaire…' : kind === 'compo' ? 'Rechercher une composition : ossature bois, béton, isolant…' : 'Rechercher une famille : porte, fenêtre, escalier…';
  d.querySelector('.spk-chips').innerHTML = kind === 'mat' ? MAT_CHIPS.map(([k, n]) => `<button type="button" class="spk-chip" data-q="${esc(n.toLowerCase())}">${esc(n)}</button>`).join('')
    : kind === 'compo' ? [['mur', 'Murs'], ['cloison', 'Cloisons'], ['ossature bois', 'Ossature bois'], ['béton', 'Béton'], ['isolant', 'Isolées'], ['biosourcé', 'Biosourcées'], ['plancher', 'Planchers'], ['toiture', 'Toitures']].map(([qq, n]) => `<button type="button" class="spk-chip" data-q="${esc(qq)}">${esc(n)}</button>`).join('')
    : [['porte', 'Portes'], ['fenêtre', 'Fenêtres'], ['escalier', 'Escaliers'], ['mobilier', 'Mobilier'], ['sanitaire', 'Sanitaires'], ['structure', 'Structure'], ['extérieur', 'Extérieur']].map(([qq, n]) => `<button type="button" class="spk-chip" data-q="${esc(qq)}">${esc(n)}</button>`).join('');
  d.hidden = false; SPK.open = true; d.classList.toggle('sheet', innerWidth < 640);
  spkRender(); spkPlace();
  requestAnimationFrame(() => { q.focus({preventScroll:true}); const on = d.querySelector('.spk-r.on'); if (on) on.scrollIntoView({block:'center'}); });
}
function closePicker(refocus){ if (!SPK.open) return; SPK.open = false; SPK.pop.hidden = true; const a = SPK.anchor; SPK.anchor = null; SPK.onPick = null; if (refocus && a && a.focus) a.focus({preventScroll:true}); }
function spkChoose(id){ const fn = SPK.onPick; closePicker(true); if (fn) fn(id); }
function spkPlace(){
  const d = SPK.pop; if (!d || d.hidden) return; const sheet = innerWidth < 640; d.classList.toggle('sheet', sheet);
  if (sheet){ d.style.cssText = ''; return; }
  const r = SPK.anchor ? SPK.anchor.getBoundingClientRect() : {left:innerWidth / 2 - 220, right:innerWidth / 2 + 220, top:80, bottom:80, width:440};
  const W = Math.min(Math.max(r.width, 420), innerWidth - 24); let left = Math.max(12, Math.min(r.left, innerWidth - W - 12));
  const below = innerHeight - r.bottom - 12, above = r.top - 12, maxH = 460, H = Math.min(maxH, Math.max(below, above));
  const up = below < 280 && above > below;
  d.style.left = left + 'px'; d.style.width = W + 'px'; d.style.maxHeight = H + 'px';
  if (up){ d.style.top = ''; d.style.bottom = (innerHeight - r.top + 4) + 'px'; } else { d.style.bottom = ''; d.style.top = (r.bottom + 4) + 'px'; }
}
function spkRow(it, i, why){
  const sw = SPK.kind === 'mat' ? `<i class="swt" style="background:${it.color}"></i>` : it.bar || '';
  const ownTag = it.own === 'perso' ? ' <em class="own">perso</em>' : it.own === 'projet' ? ' <em class="own">projet</em>' : '';
  return `<button type="button" role="option" class="spk-r${it.id === SPK.value ? ' on' : ''}${i === SPK.act ? ' act' : ''}" data-v="${esc(it.id)}" data-i="${i}" aria-selected="${it.id === SPK.value}">${sw}<span class="spk-t"><b>${SPK.q ? sHighlight(it.nom, SPK.q) : esc(it.nom)}${ownTag}</b><small>${esc(SPK.q ? it.grp : '')}${SPK.q && it.meta ? ' · ' : ''}${esc(it.meta || '')}</small></span>${why && why.length ? `<em class="spk-why" title="Trouvé par le sens du mot">${esc(why.map(synLabel).join(', '))}</em>` : ''}</button>`;
}
function spkRender(){
  const d = SPK.pop, list = d.querySelector('.spk-list'), opt = SPK.opt; let h = '', shown = [];
  const noneRow = opt.none != null ? {id:'', nom:opt.none, grp:'', meta:'', color:'transparent'} : null;
  if (!sHasQuery(SPK.q)){
    const by = new Map(); for (const it of SPK.items) (by.get(it.grp) || by.set(it.grp, []).get(it.grp)).push(it);
    if (noneRow){ shown.push(noneRow); h += spkRow(noneRow, 0); }
    for (const [g, L] of by){ h += `<div class="spk-g">${esc(g)}</div>`; for (const it of L.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))){ shown.push(it); h += spkRow(it, shown.length - 1); } }
    d.querySelector('.spk-n2').textContent = `${SPK.items.length} ${SPK.kind === 'mat' ? 'matériaux' : SPK.kind === 'compo' ? 'compositions' : 'familles'}`;
    d.querySelector('.spk-chips').hidden = false;
  } else {
    const res = smartSearch(SPK.q, SPK.items, {limit:120});
    if (noneRow && sScore(sParseQuery(SPK.q), sIndex(noneRow.nom))){ shown.push(noneRow); h += spkRow(noneRow, 0); }
    for (const r of res){ shown.push(r.item); h += spkRow(r.item, shown.length - 1, r.why); }
    if (!res.length) h += `<p class="spk-empty">Aucun résultat pour « ${esc(SPK.q)} ».${spkSuggest(SPK.q)}</p>`;
    d.querySelector('.spk-n2').textContent = `${res.length} résultat${res.length > 1 ? 's' : ''}`;
    d.querySelector('.spk-chips').hidden = true;
  }
  SPK.shown = shown; list.innerHTML = h; list.scrollTop = 0;
}
/* propositions quand rien ne correspond : concepts proches de ce qui a été tapé */
function spkSuggest(q){
  const toks = sTokens(q), near = new Set();
  for (const t of toks){ if (t.length < 3) continue; for (const [w, set] of SYN_WORD){ if (w.startsWith(t) || t.startsWith(w) || (t.length >= 5 && sEdit(t, w, 2) <= 2)) for (const k of set) near.add(k); if (near.size > 6) break; } }
  const L = [...near].slice(0, 6); if (!L.length) return ' Essayez un autre mot (matière, rôle dans la paroi, catégorie).';
  return ` Essayez : ${L.map(k => `<button type="button" class="spk-chip" data-q="${esc(synLabel(k).toLowerCase().split(' / ')[0])}">${esc(synLabel(k))}</button>`).join(' ')}`;
}
function spkMarkActive(scroll){ const d = SPK.pop; d.querySelectorAll('.spk-r.act').forEach(r => r.classList.remove('act')); const r = d.querySelector(`.spk-r[data-i="${SPK.act}"]`); if (r){ r.classList.add('act'); if (scroll) r.scrollIntoView({block:'nearest'}); } }

/* ---------- champs : ouverture au clic, mise à jour de la valeur ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('.spk-b'); if (!b) return; const span = b.closest('.spk'), hid = span.querySelector('input[data-pick]');
  if (b.disabled || hid.disabled) return;
  let opt = {}; try { opt = JSON.parse(span.dataset.opt || '{}'); } catch(x){}
  const kind = span.dataset.spk, sig = JSON.stringify(Object.entries(hid.dataset).filter(([k]) => k !== 'pick')), root = hid.closest('#engDlg, #pbody, .hud, body');
  openPicker({anchor:b, kind, opt, value:hid.value, onPick:id => {
    let h = hid, bb = b; // le champ a pu être redessiné entre-temps : on le retrouve par ses attributs
    if (!h.isConnected){ h = [...(root && root.isConnected ? root : document).querySelectorAll('input[data-pick]')].find(x => JSON.stringify(Object.entries(x.dataset).filter(([k]) => k !== 'pick')) === sig); if (!h) return; bb = h.parentElement.querySelector('.spk-b'); }
    if (id === h.value) return; h.value = id; if (bb) bb.innerHTML = pickLabelHTML(kind, id, opt) + `<span class="spk-c">${SEARCH_ICON}</span>`;
    h.dispatchEvent(new Event('input', {bubbles:true})); h.dispatchEvent(new Event('change', {bubbles:true}));
  }});
});
/* loupe des pilules de l'ATH (#typePill, #paintPill) : même fenêtre, applique au <select> natif */
function hudPickerFor(selEl, kind, opt, label){
  openPicker({anchor:selEl.parentElement.querySelector('.spk-hud') || selEl, kind, opt, value:selEl.value, label, onPick:id => { if ([...selEl.options].some(o => o.value === id)){ selEl.value = id; selEl.dispatchEvent(new Event('change', {bubbles:true})); } }});
}

/* ---------- palette globale ---------- */
const GS = {el:null, open:false, q:'', act:-1, rows:[], more:new Set()};
function gsEl(){
  if (GS.el) return GS.el;
  const d = document.createElement('div'); d.id = 'gsPal'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Recherche dans ARCHIPLAN');
  d.innerHTML = `<div class="gs-box"><div class="gs-top">${SEARCH_ICON}<input type="search" class="gs-q" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Rechercher partout : outil, matériau, composition, famille, élément, niveau, export…" aria-label="Rechercher"><kbd>Échap</kbd><button type="button" class="ib ghost gs-x" aria-label="Fermer">✕</button></div><div class="gs-list"></div><div class="gs-foot"><span>↑ ↓ parcourir · Entrée ouvrir · Maj+Entrée appliquer à la sélection</span><span class="gs-n"></span></div></div>`;
  document.body.appendChild(d); GS.el = d;
  const q = d.querySelector('.gs-q');
  q.addEventListener('input', () => { GS.q = q.value; GS.act = -1; GS.more.clear(); gsRender(); });
  d.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape'){ e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); const n = GS.rows.length; if (!n) return; GS.act = GS.act < 0 ? (e.key === 'ArrowDown' ? 0 : n - 1) : (GS.act + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; gsMark(true); }
    else if (e.key === 'Enter'){ e.preventDefault(); const i = GS.act >= 0 ? GS.act : 0; if (GS.rows[i]) gsRun(GS.rows[i], e.shiftKey); }
  });
  d.querySelector('.gs-x').addEventListener('click', closePalette);
  d.addEventListener('click', e => {
    if (e.target === d){ closePalette(); return; }
    const m = e.target.closest('[data-more]'); if (m){ GS.more.add(m.dataset.more); gsRender(); return; }
    const c = e.target.closest('.spk-chip'); if (c){ q.value = c.dataset.q; GS.q = q.value; GS.act = -1; gsRender(); q.focus(); return; }
    const r = e.target.closest('.gs-r'); if (r) gsRun(GS.rows[+r.dataset.i], e.shiftKey || !!e.target.closest('.gs-alt'));
  });
  d.addEventListener('pointermove', e => { const r = e.target.closest('.gs-r'); if (!r) return; const i = +r.dataset.i; if (i !== GS.act){ GS.act = i; gsMark(false); } });
  return d;
}
function openPalette(prefill){
  const d = gsEl(); closePicker(false); $$('.menu').forEach(m => m.hidden = true);
  d.hidden = false; GS.open = true; const q = d.querySelector('.gs-q'); q.value = prefill || ''; GS.q = q.value; GS.act = -1; GS.more.clear(); gsRender();
  requestAnimationFrame(() => { q.focus({preventScroll:true}); q.select(); });
}
function closePalette(){ if (!GS.open) return; GS.open = false; GS.el.hidden = true; }
/* sources : outils et actions (lus dans l'interface), matériaux, compositions, familles, éléments, niveaux */
function gsTools(){
  const out = [];
  for (const b of $$('.tools .tool[data-tool]')){ const lbl = b.querySelector('span')?.textContent.trim() || b.dataset.tool, title = b.title || ''; const key = title.match(/\(([A-Z0-9])\)/)?.[1] || '';
    const sub0 = title.replace(/\s*\([A-Z0-9]\)\s*:?/, '').trim(); out.push({kind:'tool', id:b.dataset.tool, nom:lbl, sub:(!sub0 || sub0 === lbl ? 'Outil' : sub0) + (key ? ` · touche ${key}` : ''), key, ix:sIndex(lbl, {kw:title + ' ' + b.dataset.tool, tags:['outil']}), run:() => { setTool(b.dataset.tool); }}); }
  for (const b of $$('.modes button[data-mode]')) out.push({kind:'tool', id:'mode-' + b.dataset.mode, nom:`Vue ${b.textContent.trim()}`, sub:'Mode d\'affichage', ix:sIndex(`vue ${b.textContent} ${b.dataset.mode === '2d' ? 'plan 2d' : b.dataset.mode === '3d' ? '3d maquette' : b.dataset.mode === 'render' ? 'rendu réaliste' : 'coupes'}`, {tags:['outil', b.dataset.mode === 'render' ? 'rendu' : 'plan']}), run:() => b.click()});
  for (const b of $$('.tabs button[data-tab]')) out.push({kind:'tool', id:'tab-' + b.dataset.tab, nom:`Onglet ${b.textContent.trim()}`, sub:'Panneau', ix:sIndex(`onglet ${b.textContent} ${b.dataset.tab === 'lib' ? 'bibliothèque matériaux compositions familles' : b.dataset.tab === 'qty' ? 'métré quantités DQE devis' : b.dataset.tab === 'props' ? 'projet arborescence propriétés' : 'rendu'}`, {tags:['outil']}), run:() => { b.click(); openSheet(true); }});
  for (const [menuId, grp] of [['#fileMenu', 'Fichier'], ['#exportMenu', 'Exporter']]) for (const b of $$(`${menuId} button`)){ const t = b.querySelector('b')?.textContent.trim() || b.textContent.trim(); if (!t) continue; const s = b.querySelector('span')?.textContent.trim() || '';
    out.push({kind:'tool', id:menuId + t, nom:t, sub:`${grp}${s ? ' · ' + s : ''}`, ix:sIndex(t + ' ' + s, {tags:['export', 'outil'], kw:grp}), run:() => { $$('.menu').forEach(m => m.hidden = true); b.click(); }}); }
  const extra = [
    ['Gérer les niveaux…', 'Niveaux, altitudes, niveau courant', ['niveau'], () => { activeTab = 'props'; renderPanel(); openSheet(true); runTreeAction('levels', 'P'); }],
    ['Lieu, climat, bruit et terrain…', 'Adresse, zone climatique, relief', ['site'], () => runTreeAction('site', 'P')],
    ['Nouvelle composition de paroi…', 'Fiche complète : couches, U, déphasage, Glaser', ['mur', 'dalle'], () => openComposer({})],
    ['Nouveau matériau…', 'λ, ρ, μ, carbone, texture', ['finition'], () => openMatEditor(null)],
    ['Menuiserie sur mesure…', 'Fenêtre, porte ou baie : dimensions, vitrage, performances', ['menuiserie', 'fenetre', 'porte'], () => openJoineryTool({})],
    ['Tout afficher', 'Rétablir les éléments masqués', ['outil'], () => runTreeAction('showall', 'P')],
    ['Cadrer tout le projet', 'Zoom étendu (Z)', ['outil'], () => fit()],
    ['Annuler', 'Ctrl+Z', ['outil'], () => undo()], ['Rétablir', 'Ctrl+Y', ['outil'], () => redo()],
    ['Sécurité incendie du projet', 'Classement, exigences, verdicts par paroi', ['feu', 'securite'], () => { activeTab = 'props'; sel = null; multi = []; applySel(); renderPanel(); openSheet(true); setTimeout(() => $('#pbody .grp.fire')?.scrollIntoView({block:'start', behavior:'smooth'}), 60); }],
  ];
  for (const [t, s, tags, run] of extra) if (typeof run === 'function') out.push({kind:'tool', id:'x-' + t, nom:t, sub:s, ix:sIndex(t + ' ' + s, {tags}), run});
  return out;
}
function gsAll(){
  const KN = typeof KIND_NAME !== 'undefined' ? KIND_NAME : {};
  const mats = searchMats().map(x => ({kind:'mat', id:x.id, nom:x.m.nom, sub:x.m.cat, color:x.m.color, ix:x.ix, run:() => openMatEditor(x.id)}));
  const compos = searchCompos().map(x => ({kind:'compo', id:x.id, nom:x.c.nom, sub:x.c.kind === 'wall' ? 'Composition de mur' : x.c.kind === 'roof' ? 'Composition de toiture' : 'Composition de plancher', bar:layerBar(x.c.layers), ix:x.ix, c:x.c, run:() => openComposer({id:x.id}), alt:gsApplyCompo(x.id, x.c)}));
  const fams = searchFams().map(x => ({kind:'fam', id:x.id, nom:x.F.nom, sub:(famPath(x.id, x.F) || [x.F.cat]).join(' › '), ix:x.ix, run:() => { defs.comp.fam = x.id; defs.comp.type = 0; setTool('comp'); libTab = 'fams'; activeTab = 'lib'; renderPanel(); }}));
  const els = state.els.map(el => ({kind:'el', id:el.id, nom:elName(el), sub:`${KN[el.kind] || el.kind} · ${state.levels[el.lvl]?.n || ''}${typeof elMeta === 'function' ? ' · ' + elMeta(el) : ''}`, ix:elIndex(el), run:() => { select(el.id); frameEl(el.id); openSheet(true); }}));
  const lvls = state.levels.map((l, i) => ({kind:'lvl', id:i, nom:l.n, sub:`Niveau · ${nf(l.z)} m${i === curLvl ? ' · courant' : ''}`, ix:sIndex(l.n + ' niveau', {kw:`L${i} ${i === 0 ? 'rdc rez' : 'R+' + i}`, tags:['niveau']}), run:() => runTreeAction('work', 'L' + i)}));
  return {Outils:gsTools(), Matériaux:mats, Compositions:compos, Familles:fams, 'Éléments du projet':els, Niveaux:lvls};
}
function gsApplyCompo(id, c){
  const ids = selIds().filter(i => { const el = getEl(i); return el && (el.kind === c.kind || (el.kind !== 'wall' && c.kind !== 'wall' && (el.kind === 'slab' || el.kind === 'roof'))); });
  if (!ids.length) return null;
  return {label:`Appliquer à ${ids.length > 1 ? ids.length + ' éléments' : 'la sélection'}`, run:() => { pushHist(); for (const i of ids){ const el = getEl(i); el.type = id; } state.isSample = false; embedUsedLib(); rebuild(); toast(`${c.nom} appliquée`); }};
}
function gsRender(){
  const d = GS.el, list = d.querySelector('.gs-list'), q = GS.q; let h = '', rows = [];
  const all = gsAll();
  if (!sHasQuery(q)){
    h += `<div class="gs-hint">Tapez un mot : un outil, un matériau (« vapeur » trouve le pare-vapeur, « isolant » tous les isolants, « couche intermédiaire » les couches techniques), une composition, une famille, un élément du projet, un niveau ou un export.</div>`;
    h += `<div class="spk-chips">${[['vapeur', 'vapeur'], ['isolant', 'isolant'], ['couche intermédiaire', 'couche intermédiaire'], ['ossature bois', 'ossature bois'], ['porte coupe-feu', 'porte coupe-feu'], ['escalier', 'escalier'], ['niveau', 'niveau'], ['pdf', 'export PDF']].map(([qq, n]) => `<button type="button" class="spk-chip" data-q="${esc(qq)}">${esc(n)}</button>`).join('')}</div>`;
    const tools = all.Outils.slice(0, 10); h += `<div class="gs-g">Outils</div>`; for (const it of tools){ rows.push(it); h += gsRow(it, rows.length - 1); }
    d.querySelector('.gs-n').textContent = '';
  } else {
    let total = 0;
    const found = Object.entries(all).map(([grp, items]) => [grp, smartSearch(q, items, {limit:60})]).filter(([, res]) => res.length);
    const GP = {Outils:0, Compositions:1, Matériaux:2, Familles:3, 'Éléments du projet':4, Niveaux:5};
    found.sort((a, b) => (Math.abs(b[1][0].s - a[1][0].s) > 0.02 ? b[1][0].s - a[1][0].s : 0) || (GP[a[0]] ?? 9) - (GP[b[0]] ?? 9)); // le groupe qui répond le mieux en premier, les outils avant à égalité
    for (const [grp, res] of found){ total += res.length;
      const N = GS.more.has(grp) ? res.length : (grp === 'Outils' ? 6 : 5);
      h += `<div class="gs-g">${esc(grp)} <span>${res.length}</span></div>`;
      for (const r of res.slice(0, N)){ rows.push(r.item); h += gsRow(r.item, rows.length - 1, r.why); }
      if (res.length > N) h += `<button type="button" class="gs-more" data-more="${esc(grp)}">Voir les ${res.length - N} autres…</button>`;
    }
    if (!total) h += `<p class="spk-empty">Aucun résultat pour « ${esc(q)} ».${spkSuggest(q)}</p>`;
    d.querySelector('.gs-n').textContent = total ? `${total} résultat${total > 1 ? 's' : ''}` : '';
  }
  GS.rows = rows; list.innerHTML = h; list.scrollTop = 0;
}
function gsRow(it, i, why){
  const ico = it.kind === 'mat' ? `<i class="swt" style="background:${it.color}"></i>` : it.kind === 'compo' ? it.bar : `<i class="gs-k gs-k-${it.kind}">${{tool:'⌘', fam:'▣', el:'◧', lvl:'≡'}[it.kind] || '•'}</i>`;
  return `<button type="button" class="gs-r${i === GS.act ? ' act' : ''}" data-i="${i}">${ico}<span class="spk-t"><b>${sHighlight(it.nom, GS.q)}</b><small>${esc(it.sub || '')}</small></span>${why && why.length ? `<em class="spk-why">${esc(why.map(synLabel).join(', '))}</em>` : ''}${it.key ? `<kbd>${esc(it.key)}</kbd>` : ''}${it.alt ? `<span class="gs-alt btn" title="Maj+Entrée">${esc(it.alt.label)}</span>` : ''}</button>`;
}
function gsMark(scroll){ const d = GS.el; d.querySelectorAll('.gs-r.act').forEach(r => r.classList.remove('act')); const r = d.querySelector(`.gs-r[data-i="${GS.act}"]`); if (r){ r.classList.add('act'); if (scroll) r.scrollIntoView({block:'nearest'}); } }
function gsRun(it, alt){ if (!it) return; closePalette(); if (!$('#engDlg').hidden && it.kind !== 'tool') closeEDlg(); if (alt && it.alt) it.alt.run(); else it.run(); }

/* raccourcis : Ctrl/Cmd+K partout, « / » hors champ de saisie ; bouton loupe de la barre */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); e.stopPropagation(); if (GS.open) closePalette(); else openPalette(); return; }
  if (GS.open) return;
  const t = e.target, inField = t.closest && t.closest('input,select,textarea,[contenteditable]');
  if (e.key === '/' && !inField && !e.ctrlKey && !e.metaKey && !e.altKey && $('#engDlg').hidden){ e.preventDefault(); openPalette(); }
}, true);
$('#searchBtn')?.addEventListener('click', () => openPalette());
if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)){ const k = $('#searchBtn .sb-k'); if (k) k.textContent = '⌘ K'; }
$('#typeFind')?.addEventListener('click', e => {
  e.preventDefault(); const selEl = $('#typeSel');
  if (tool === 'wall' || tool === 'slab' || tool === 'roof') return hudPickerFor(selEl, 'compo', {kind:tool});
  if (tool === 'vol' || tool === 'col' || tool === 'sketch') return hudPickerFor(selEl, 'mat', {});
  if (tool === 'comp') return openPicker({anchor:e.currentTarget, kind:'fam', value:defs.comp.fam, onPick:id => { defs.comp.fam = id; defs.comp.type = 0; setTool('comp'); renderPanel(); }});
});
$('#paintFind')?.addEventListener('click', e => { e.preventDefault(); hudPickerFor($('#paintMat'), 'mat', {paint:true, none:'Retirer le revêtement (matériau d\'origine)'}); });
