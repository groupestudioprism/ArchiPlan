/* ============ Arborescence du projet (niveaux → catégories → éléments), menus ⋮, ajustement de l'isolant ============ */
const treeOpen = new Set(['P', 'L0', 'L0|wall', 'L0|slab', 'L0|roof', 'L0|inst']);
let treeQuery = '';
const TREE_CATS = [['wall', 'Murs et cloisons'], ['slab', 'Dalles et planchers'], ['roof', 'Toitures'], ['stair', 'Escaliers'], ['col', 'Poteaux'], ['vol', 'Formes et volumes'], ['inst', 'Composants et mobilier']];
const TICON = {
  wall:'M3 7h18v10H3zM3 12h18M9 7v5M15 12v5', slab:'M3 14l9-5 9 5-9 5zM3 14v2l9 5 9-5v-2', roof:'M2 12l10-7 10 7M5 10v10h14V10', stair:'M3 20h5v-4h4v-4h4V8h5M3 20V9', col:'M9 3h6v18H9z', vol:'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  inst:'M4 11h16v4H4zM6 15v5M18 15v5', open:'M4 4h16v16H4zM12 4v16M4 12h16', door:'M7 21V3h10v18M14 12h.01', lvl:'M3 17h18M3 12h18M3 7h18', proj:'M3 21V9l9-6 9 6v12zM9 21v-7h6v7',
  eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', eyeOff:'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1'
};
const ico = (k, cls = '') => `<svg class="ti${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${TICON[k] || TICON.inst}"/></svg>`;
const DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>';

function elName(el){
  if (el.kind === 'inst'){ const F = fam(el.fam); const t = F?.types?.[el.type | 0]?.nom; return `${F?.nom || 'Composant'}${t ? ' · ' + t : ''}`; }
  if (el.kind === 'wall' || el.kind === 'slab' || el.kind === 'roof') return `${KIND_NAME[el.kind]} ${el.id} · ${compo(el.type).nom}`;
  if (el.kind === 'stair') return `Escalier ${el.id} · ${STAIR_TYPES[el.st || 'droit']}`;
  return `${KIND_NAME[el.kind]} ${el.id} · ${mat(el.mat).nom}`;
}
function forcedPerf(el){ return el.forceU > 0 ? {U:el.forceU, R:null} : el.forceR > 0 ? {U:null, R:el.forceR} : null; }
function elMeta(el){
  if (el.kind === 'wall' || el.kind === 'slab' || el.kind === 'roof'){
    const f = forcedPerf(el); if (f) return f.U ? `U ${nf(f.U, 2)}*` : `R ${nf(f.R, 2)}*`;
    return 'U ' + nf(thermal(layersInToOut(el), elUse(el)).U, 2);
  }
  if (el.kind === 'inst'){ const c = famCut(el); return c ? `${n0(c.w * 100)}×${n0(c.h * 100)}` : ''; }
  if (el.kind === 'col') return `${n0(el.w * 100)}×${n0(el.d * 100)}`;
  if (el.kind === 'stair') return `${stairDims(el).n} m.`;
  const r = rect(el.p, el.q); return `${nf(r[1][0] - r[0][0], 1)}×${nf(r[2][1] - r[1][1], 1)}`;
}
function treeRow({key, depth, icon, label, meta = '', open = null, selected = false, hidden = null, menu = '', cls = '', title = ''}){
  return `<div class="tr${selected ? ' on' : ''}${hidden ? ' off' : ''} ${cls}" style="--d:${depth}" data-tk="${esc(key)}"${title ? ` title="${esc(title)}"` : ''}>
    <button class="tw" data-twist="${esc(key)}" ${open === null ? 'disabled aria-hidden="true"' : `aria-expanded="${open}" aria-label="${open ? 'Replier' : 'Déplier'}"`}>${open === null ? '' : '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'}</button>
    ${icon}<span class="tl">${label}</span>${meta ? `<span class="tm">${meta}</span>` : ''}
    ${hidden !== null ? `<button class="te" data-teye="${esc(key)}" title="${hidden ? 'Afficher' : 'Masquer'}" aria-label="${hidden ? 'Afficher' : 'Masquer'}">${ico(hidden ? 'eyeOff' : 'eye')}</button>` : ''}
    ${menu ? `<button class="td" data-tmenu="${esc(menu)}" aria-label="Actions">${DOTS}</button>` : ''}</div>`;
}
function renderTree(){
  const q = treeQuery.trim().toLowerCase(), match = el => !q || elName(el).toLowerCase().includes(q) || String(el.id) === q;
  const ids = TREE_NOSEL ? new Set() : new Set(selIds()); let h = '';
  const byId = new Map(state.els.map(e => [e.id, e])), kidsOf = new Map();
  for (const x of state.els) if (x.kind === 'inst' && x.host != null){ let a = kidsOf.get(x.host); if (!a) kidsOf.set(x.host, a = []); a.push(x); }
  h += treeRow({key:'P', depth:0, icon:ico('proj'), label:`<b>${esc(state.name)}</b>`, meta:`${state.els.length} él.`, open:treeOpen.has('P'), menu:'P'});
  if (treeOpen.has('P') || q) state.levels.forEach((L, li) => {
    const lk = 'L' + li, els = state.els.filter(e => e.lvl === li && match(e)), lOpen = treeOpen.has(lk) || !!q;
    if (q && !els.length) return;
    h += treeRow({key:lk, depth:1, icon:ico('lvl'), label:`${esc(L.n)} <em>${nf(L.z)} m</em>`, meta:String(els.length), open:lOpen, hidden:hiddenLvls.has(li), menu:lk, cls:li === curLvl ? 'cur' : '', selected:false});
    if (!lOpen) return;
    for (const [kind, cname] of TREE_CATS){
      const list = els.filter(e => e.kind === kind && !(kind === 'inst' && e.host && byId.get(e.host)));
      if (!list.length) continue;
      const ck = lk + '|' + kind, cOpen = treeOpen.has(ck) || !!q;
      h += treeRow({key:ck, depth:2, icon:ico(kind), label:cname, meta:String(list.length), open:cOpen, menu:ck, cls:'cat'});
      if (!cOpen) continue;
      for (const el of list){
        const ek = 'E' + el.id, kids = kind === 'wall' ? kidsOf.get(el.id) || [] : [];
        const hasKids = kind === 'wall' || kind === 'slab' || kind === 'roof' || kids.length, eOpen = treeOpen.has(ek);
        h += treeRow({key:ek, depth:3, icon:kind === 'wall' || kind === 'slab' || kind === 'roof' ? `<span class="tsw">${layerBar(compo(el.type).layers)}</span>` : ico(kind), label:esc(elName(el)), meta:elMeta(el), open:hasKids ? eOpen : null, selected:ids.has(el.id), hidden:hiddenIds.has(el.id), menu:ek, title:elName(el)});
        if (!hasKids || !eOpen) continue;
        if (kind === 'wall' || kind === 'slab' || kind === 'roof'){
          const layers = compo(el.type).layers;
          h += `<div class="tlayers" style="--d:4">${layers.map(([m, e]) => { const M = mat(m); return `<div class="tly"><span class="sw" style="background:${M.color}"></span><span>${esc(M.nom)}</span><em>${nf(e * 1000, 0)} mm</em><em>${M.R != null ? 'R ' + nf(M.R, 2) : 'λ ' + nf(M.lambda, 3)}</em></div>`; }).join('')}
            <button class="tlink" data-tins="${el.id}">Ajuster l'isolant et les performances…</button></div>`;
        }
        for (const k of kids) h += treeRow({key:'E' + k.id, depth:4, icon:ico(fam(k.fam)?.cat === 'Portes' ? 'door' : 'open'), label:esc(elName(k)), meta:elMeta(k), selected:ids.has(k.id), hidden:hiddenIds.has(k.id), menu:'E' + k.id});
      }
    }
  });
  return h;
}
function renderProjectTab(){
  return `<div class="split"><section class="tree-pane" aria-label="Arborescence du projet">
      <div class="tree-h"><input class="libsearch tq" data-treeq type="search" placeholder="Filtrer les éléments…" value="${esc(treeQuery)}" aria-label="Filtrer"><button class="ib ghost" data-tact="collapse" title="Tout replier">−</button><button class="ib ghost" data-tact="expand" title="Tout déplier">+</button></div>
      <div class="tree" role="tree">${renderTree()}</div></section>
    <section class="prop-pane" aria-label="Propriétés">${renderProps()}</section></div>`;
}

/* ---------- menus ⋮ ---------- */
function treeMenuItems(key){
  if (key === 'P') return [{k:'site', t:'Lieu, climat, bruit et terrain…', s:'Adresse, zone climatique, bruit, relief NGF, environnement'}, '-', {k:'showall', t:'Tout afficher', s:'Rétablit les éléments et niveaux masqués'}, {k:'lvl-add', t:'Ajouter un niveau'}, {k:'fit', t:'Tout voir'}];
  if (/^L\d+$/.test(key)){ const li = +key.slice(1), on = hiddenLvls.has(li);
    return [{k:'work', t:'Travailler sur ce niveau', s:'Niveau courant pour le dessin et le plan'}, {k:'solo', t:'Afficher seulement ce niveau'}, {k:'lhide', t:on ? 'Afficher le niveau' : 'Masquer le niveau'}, '-', {k:'lrename', t:'Renommer, altitude…'}, {k:'levels', t:'Gérer les niveaux…', s:'Altitudes, hauteurs d\'étage, nouveau niveau avec plancher'}, {k:'ldel', t:'Supprimer le niveau', danger:true, off:state.levels.length < 2}]; }
  if (key.includes('|')) return [{k:'selall', t:'Sélectionner toute la catégorie'}, {k:'chide', t:'Masquer la catégorie'}, {k:'cshow', t:'Afficher la catégorie'}, {k:'cframe', t:'Centrer la vue'}];
  const el = getEl(+key.slice(1)); if (!el) return [];
  const it = [{k:'frame', t:'Centrer la vue'}, {k:'hide', t:hiddenIds.has(el.id) ? 'Afficher' : 'Masquer'}, {k:'iso', t:'Isoler', s:'Masquer tout le reste'}, '-',
    {k:'tmove', t:'Déplacer', s:'Point de base puis destination'}, {k:'tcopy', t:'Copier'}, {k:'trot', t:'Rotation'}, {k:'tmirror', t:'Symétrie…', s:'Axe en 2 points, copie ou déplacement'}, {k:'tolevel', t:'Copier vers un niveau…', s:'Monter les murs à l\'étage, avec leurs ouvertures'}, '-'];
  if (el.kind === 'wall' || el.kind === 'slab' || el.kind === 'roof'){
    it.push({k:'insul', t:'Ajuster l\'isolant et les performances…', s:'Épaisseur, λ, objectif U ou R, valeurs forcées'}, {k:'compose', t:'Modifier la composition…', s:'Fiche complète : couches, Glaser, acoustique'});
    if (forcedPerf(el)) it.push({k:'unforce', t:'Revenir aux valeurs calculées', s:'Supprime le U / R forcé'});
    if (el.kind === 'wall') it.push({k:'flip', t:'Inverser les faces'}, {k:'opening', t:'+ Porte ou fenêtre'});
  }
  if (el.kind === 'vol') it.push({k:'mkcomp', t:'Créer un composant…', s:'Regrouper les formes sélectionnées en un composant réutilisable'}, {k:'tpush', t:'Pousser / Tirer'});
  if (el.kind === 'inst') it.push({k:'famedit', t:'Modifier la famille…'}, ...(el.host ? [{k:'iflip', t:'Côté d\'ouverture'}] : [{k:'rot90', t:'Pivoter de 90°'}]));
  it.push('-', {k:'dup', t:'Dupliquer'}, {k:'del', t:'Supprimer', danger:true});
  return it;
}
function openTreeMenu(btn, key){
  const m = $('#treeMenu'), items = treeMenuItems(key);
  m.innerHTML = items.map(i => i === '-' ? '<hr>' : `<button type="button" data-tmi="${i.k}" class="${i.danger ? 'danger' : ''}"${i.off ? ' disabled' : ''}><b>${esc(i.t)}</b>${i.s ? `<span>${esc(i.s)}</span>` : ''}</button>`).join('');
  m.dataset.key = key; m.hidden = false;
  const r = btn.getBoundingClientRect(); m.style.width = '280px';
  m.style.left = Math.max(12, Math.min(r.right - 280, innerWidth - 292)) + 'px';
  m.style.top = Math.max(12, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 12)) + 'px';
}
function catEls(key){ const [l, kind] = key.split('|'); const li = +l.slice(1); return state.els.filter(e => e.lvl === li && e.kind === kind); }
function dupEl(el){
  const c = JSON.parse(JSON.stringify(el)); c.id = state.nextId++;
  if (el.kind === 'wall'){ const {n} = wallAxis(el), d = wallT(el) + 0.5; c.a = V.add(el.a, V.mul(n, d)); c.b = V.add(el.b, V.mul(n, d)); }
  else if (el.kind === 'inst' && el.host){ const w = getEl(el.host), cut = famCut(el), L = w ? wallAxis(w).L : 0, t = (el.t || 0) + (cut?.w || 1) + 0.3; if (!w || t + (cut?.w || 1) / 2 > L) return null; c.t = rnd(t); }
  else if (el.c) c.c = [el.c[0] + 0.6, el.c[1] - 0.6];
  else if (el.p){ c.p = [el.p[0] + 0.6, el.p[1] - 0.6]; c.q = [el.q[0] + 0.6, el.q[1] - 0.6]; if (el.poly) c.poly = el.poly.map(q => [q[0] + 0.6, q[1] - 0.6]); }
  state.els.push(c); return c;
}
function runTreeAction(k, key){
  const el = key.startsWith('E') ? getEl(+key.slice(1)) : null, li = /^L\d+$/.test(key) ? +key.slice(1) : null;
  const re = () => { rebuild(); };
  switch (k){
    case 'site': return openSiteDialog();
    case 'showall': hiddenIds.clear(); hiddenLvls.clear(); return re();
    case 'lvl-add': { pushHist(); const last = state.levels[state.levels.length - 1]; state.levels.push({n:`R+${state.levels.length}`, z:rnd((last?.z || 0) + 2.8)}); rebuild(); syncLevels(); return; }
    case 'fit': return fit();
    case 'work': curLvl = li; treeOpen.add('L' + li); syncLevels(); positionGrid(); if (view === '2d') rebuild(); else { buildLabels(); renderPanel(); } return;
    case 'solo': hiddenLvls.clear(); state.levels.forEach((_, i) => { if (i !== li) hiddenLvls.add(i); }); return re();
    case 'lhide': hiddenLvls.has(li) ? hiddenLvls.delete(li) : hiddenLvls.add(li); return re();
    case 'lrename': return levelDialog(li);
    case 'levels': return openLevels();
    case 'mkcomp': { const ids = selIds().includes(el?.id) ? selIds() : [el.id]; return openMakeComp(ids); }
    case 'tpush': select(el.id); return setTool('push');
    case 'ldel': if (state.els.some(x => x.lvl === li)) return toast('Ce niveau contient des éléments : déplacez-les ou supprimez-les d\'abord.');
      pushHist(); state.levels.splice(li, 1); state.els.forEach(x => { if (x.lvl > li) x.lvl--; }); curLvl = Math.min(curLvl, state.levels.length - 1); rebuild(); syncLevels(); return;
    case 'selall': { const l = catEls(key); if (!l.length) return; sel = l[0].id; multi = l.slice(1).map(e => e.id); applySel(); buildLabels(); renderPanel(); return; }
    case 'chide': catEls(key).forEach(e => hiddenIds.add(e.id)); return re();
    case 'cshow': catEls(key).forEach(e => hiddenIds.delete(e.id)); return re();
    case 'cframe': return frameEl(catEls(key).map(e => e.id));
  }
  if (!el) return;
  switch (k){
    case 'frame': select(el.id); return frameEl(el.id);
    case 'hide': hiddenIds.has(el.id) ? hiddenIds.delete(el.id) : hiddenIds.add(el.id); if (sel === el.id && hiddenIds.has(el.id)) sel = null; return re();
    case 'iso': hiddenLvls.clear(); hiddenIds.clear(); state.els.forEach(e => { if (e.id !== el.id && !(e.host === el.id) && !(el.host && e.id === el.host)) hiddenIds.add(e.id); }); select(el.id); rebuild(); return frameEl(el.id);
    case 'insul': return openInsulAdjust(el.id);
    case 'compose': return openComposer({id:el.type, apply:el.id});
    case 'unforce': pushHist(); delete el.forceU; delete el.forceR; delete el.forceNote; return re();
    case 'flip': case 'iflip': pushHist(); el.flip = !el.flip; return re();
    case 'opening': select(el.id); libTab = 'fams'; libPath = ['Fenêtres']; libCat = 'Fenêtres'; activeTab = 'lib'; renderPanel(); return toast('Choisissez une porte ou une fenêtre, puis cliquez dans le mur');
    case 'famedit': return openFamEditor(el.fam, el.id);
    case 'rot90': pushHist(); el.rot = ((el.rot || 0) + 90) % 360; return re();
    case 'dup': { pushHist(); const c = dupEl(el); if (!c){ hist.pop(); updUndo(); return toast('Pas assez de place dans le mur pour dupliquer'); } state.isSample = false; sel = c.id; multi = []; rebuild(); return toast('Élément dupliqué'); }
    case 'del': if (!selIds().includes(el.id)){ sel = el.id; multi = []; } return deleteSel();
    case 'tmove': case 'tcopy': case 'trot': case 'tmirror': if (!selIds().includes(el.id)) select(el.id); return setTool({tmove:'move', tcopy:'copy', trot:'rotate', tmirror:'mirror'}[k]);
    case 'tolevel': return openCopyToLevel(selIds().includes(el.id) ? selIds() : [el.id]);
  }
}
function levelDialog(li){
  const L = state.levels[li];
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Niveau</span><h3 class="ed-t2">${esc(L.n)}</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><div class="fields"><label class="f wide"><span>Nom</span><span class="in"><input id="lvN" type="text" value="${esc(L.n)}" maxlength="30" style="font-family:var(--f-body)"></span></label>
    <label class="f wide"><span>Altitude du plancher</span><span class="in"><input id="lvZ" type="number" step="0.01" value="${rnd(L.z)}"><em>m</em></span></label></div></div>
    <footer class="ed-f"><button class="btn" data-close>Annuler</button><button class="btn primary" id="lvOk">Enregistrer</button></footer>`, 'small');
  d.querySelector('#lvOk').onclick = () => { const z = num(d.querySelector('#lvZ').value); pushHist(); L.n = d.querySelector('#lvN').value.trim().slice(0, 30) || L.n; if (!Number.isNaN(z)) L.z = z; sortLevels(); closeEDlg(); rebuild(); syncLevels(); };
}

/* ---------- ajuster l'isolant : épaisseur, λ, objectif U / R, valeurs forcées ---------- */
const layersCalc = (kind, use, layers) => kind === 'wall' ? layers.slice().reverse() : use === 'toiture' ? layers.slice().reverse() : layers.slice();
function mainInsulIdx(layers){
  let best = -1, br = -1; layers.forEach(([m, e], i) => { const M = mat(m); if (M.R != null) return; const r = e / M.lambda; if ((M.cat === 'Isolants' ? 1e3 : 0) + r > br){ br = (M.cat === 'Isolants' ? 1e3 : 0) + r; best = i; } });
  return Math.max(0, best);
}
function openInsulAdjust(id){
  const el = getEl(id); if (!el || !(el.kind === 'wall' || el.kind === 'slab' || el.kind === 'roof')) return;
  const base = compo(el.type), use = elUse(el), layers0 = base.layers.map(l => l.slice());
  const S = {idx:mainInsulIdx(layers0), mode:'e', target:''};
  S.mat = layers0[S.idx][0]; S.e = layers0[S.idx][1]; S.lambda = mat(S.mat).lambda ?? 0.035;
  S.forceU = el.forceU || ''; S.forceR = el.forceR || ''; S.note = el.forceNote || '';
  const insulOpts = () => { const by = {}; for (const [k, m] of Object.entries(libMats())) if (m.R == null) (by[m.cat] ??= []).push([k, m.nom]);
    const cats = ['Isolants', ...Object.keys(by).filter(c => c !== 'Isolants')];
    return cats.filter(c => by[c]).map(c => `<optgroup label="${esc(c)}">${by[c].sort((a, b) => a[1].localeCompare(b[1], 'fr')).map(([k, n]) => `<option value="${esc(k)}"${k === S.mat ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join(''); };
  const tmpMat = () => { const M = mat(S.mat); return Math.abs((M.lambda ?? 0) - S.lambda) > 1e-6 ? {...M, lambda:S.lambda, nom:`${M.nom} (λ ${nf(S.lambda, 3)})`} : null; };
  const newLayers = () => { const L = layers0.map(l => l.slice()); const t = tmpMat(); if (t){ state.lib.mats.__tmp = t; } L[S.idx] = [t ? '__tmp' : S.mat, S.e]; return L; };
  const report = L => wallReport(layersCalc(el.kind, use, L), use);
  const solve = () => { // épaisseur pour atteindre un U ou un R cible
    const v = num(S.target); if (!(v > 0)) return;
    const L = newLayers(), th = thermal(layersCalc(el.kind, use, L), use), rLayer = S.e / S.lambda, rOther = th.R - rLayer;
    const Rtot = S.mode === 'U' ? 1 / v : v + th.si + th.se, need = Rtot - rOther;
    if (need <= 0){ S.e = 0.01; return 'Objectif déjà atteint sans cet isolant : épaisseur minimale.'; }
    S.e = Math.min(0.6, Math.ceil(need * S.lambda / 0.005) * 0.005);
    return S.e >= 0.6 ? 'Objectif hors de portée avec ce matériau (plus de 60 cm).' : '';
  };
  const fmtRow = (n, a, b, unit, better, fmt) => { const diff = b - a, cls = better === 'none' || Math.abs(diff) < 1e-9 ? '' : (better === 'low' ? diff < 0 : diff > 0) ? 'up' : 'down';
    return `<tr><td>${n}</td><td class="n">${fmt(a)}</td><td class="n ${cls}">${fmt(b)}</td><td>${unit}</td></tr>`; };
  const f3 = v => nf(v, 3), f2 = v => nf(v, 2), f1 = v => nf(v, 1), f0 = v => n0(v);
  const render = msg => {
    const L1 = newLayers(), r0 = report(layers0), r1 = report(L1), g0 = uGrade(r0.th.U, use), g1 = uGrade(r1.th.U, use);
    const fU = num(S.forceU), fR = num(S.forceR);
    return `<header class="ed-h"><div><span class="eyebrow">${el.kind === 'wall' ? 'Mur' : 'Plancher'} ${el.id} · ${esc(USES[use] || '')}</span><h3 class="ed-t2">Ajuster l'isolant et les performances</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body ia">
      <section>
        <p class="hint">Composition actuelle : <b>${esc(base.nom)}</b>. Choisissez la couche à modifier, puis l'épaisseur ou un objectif.</p>
        <div class="ia-layers">${L1.map(([m, e], i) => { const M = mat(m); return `<button class="ia-l${i === S.idx ? ' on' : ''}" data-ial="${i}"><span class="sw" style="background:${M.color}"></span><span>${esc(M.nom)}</span><em>${nf(e * 1000, 0)} mm</em></button>`; }).join('')}</div>
        <div class="fields">
          <label class="f wide"><span>Matériau de la couche</span><span class="in"><select id="iaMat">${insulOpts()}</select></span></label>
          <label class="f"><span>λ (conductivité)</span><span class="in"><input id="iaLam" type="text" inputmode="decimal" step="0.001" min="0.005" value="${rnd(S.lambda, 4)}"><em>W/m·K</em></span></label>
          <label class="f"><span>Épaisseur</span><span class="in"><input id="iaE" type="number" step="5" min="1" value="${n0(S.e * 1000)}"><em>mm</em></span></label>
          <label class="f wide rngf"><input id="iaER" type="range" min="10" max="400" step="5" value="${Math.min(400, n0(S.e * 1000))}" aria-label="Épaisseur"></label>
        </div>
        <div class="grp"><h3>Ou viser une performance</h3><div class="seg">${[['e', 'Épaisseur libre'], ['U', 'U cible'], ['R', 'R cible']].map(([k, n]) => `<button class="${S.mode === k ? 'on' : ''}" data-iamode="${k}">${n}</button>`).join('')}</div>
          ${S.mode !== 'e' ? `<div class="fields" style="margin-top:8px"><label class="f wide"><span>${S.mode === 'U' ? 'U visé (W/m²·K)' : 'R visé de la paroi (m²·K/W)'}</span><span class="in"><input id="iaT" type="text" inputmode="decimal" step="0.01" value="${esc(S.target)}" placeholder="${S.mode === 'U' ? 'ex. 0,20' : 'ex. 4,5'}"><em>${S.mode === 'U' ? 'W/m²·K' : 'm²·K/W'}</em></span></label></div><p class="hint">L'épaisseur est arrondie aux 5 mm supérieurs.</p>` : ''}
          ${msg ? `<p class="fe">${esc(msg)}</p>` : ''}</div>
        <details class="cp-cond"${fU > 0 || fR > 0 ? ' open' : ''}><summary>Forcer des valeurs (fiche technique, avis technique)</summary>
          <p class="hint">Remplace le calcul pour cet élément : utile si un fabricant fournit un U ou un R certifié (ponts thermiques intégrés…). Les autres calculs restent indicatifs.</p>
          <div class="fields"><label class="f"><span>U forcé</span><span class="in"><input id="iaFU" type="text" inputmode="decimal" step="0.001" min="0" value="${esc(S.forceU)}" placeholder="—"><em>W/m²·K</em></span></label>
          <label class="f"><span>ou R forcé</span><span class="in"><input id="iaFR" type="text" inputmode="decimal" step="0.01" min="0" value="${esc(S.forceR)}" placeholder="—"><em>m²·K/W</em></span></label>
          <label class="f wide"><span>Source</span><span class="in"><input id="iaFN" type="text" maxlength="120" value="${esc(S.note)}" placeholder="ex. Avis technique n°…" style="font-family:var(--f-body)"></span></label></div></details>
      </section>
      <section>
        <div class="perf big">
          <div class="pc"><span>U ${fU > 0 || fR > 0 ? 'forcé' : 'après'}</span><b>${fU > 0 ? nf(fU, 3) : fR > 0 ? nf(1 / (fR + RS[use].si + RS[use].se), 3) : nf(r1.th.U, 3)}</b><em>W/m²·K</em><i class="gr g${g1.g}" title="${esc(g1.t)}">${g1.g}</i></div>
          <div class="pc"><span>R paroi</span><b>${fR > 0 ? nf(fR, 2) : fU > 0 ? nf(1 / fU - RS[use].si - RS[use].se, 2) : nf(r1.th.Rp, 2)}</b><em>m²·K/W</em></div>
          <div class="pc"><span>Déphasage</span><b>${nf(r1.dyn.phase, 1)}</b><em>heures</em></div>
          <div class="pc"><span>Acoustique</span><b>≈ ${r1.ac.Rw}</b><em>dB (Rw)</em></div></div>
        <table class="tbl ia-cmp"><thead><tr><th></th><th class="n">Avant</th><th class="n">Après</th><th></th></tr></thead><tbody>
          ${fmtRow('Coefficient U', r0.th.U, r1.th.U, 'W/m²·K', 'low', f3)}
          ${fmtRow('Résistance R (paroi)', r0.th.Rp, r1.th.Rp, 'm²·K/W', 'high', f2)}
          ${fmtRow('Déphasage', r0.dyn.phase, r1.dyn.phase, 'h', 'high', f1)}
          ${fmtRow('Isolement Rw', r0.ac.Rw, r1.ac.Rw, 'dB', 'high', f0)}
          ${fmtRow('Épaisseur totale', r0.T * 100, r1.T * 100, 'cm', 'none', f1)}
          ${fmtRow('Masse', r0.mass, r1.mass, 'kg/m²', 'none', f0)}
          ${fmtRow('Carbone', r0.co2, r1.co2, 'kg CO₂e/m²', 'low', f0)}
          <tr><td>Condensation (Glaser)</td><td class="n">${r0.gl.risk.length ? 'Risque' : 'Non'}</td><td class="n ${r1.gl.risk.length && !r0.gl.risk.length ? 'down' : !r1.gl.risk.length && r0.gl.risk.length ? 'up' : ''}">${r1.gl.risk.length ? 'Risque' : 'Non'}</td><td></td></tr>
          <tr><td>Classe</td><td class="n">${g0.g}</td><td class="n">${g1.g}</td><td>${esc(g1.t)}</td></tr>
        </tbody></table>
        ${r1.gl.risk.length ? '<ul class="warns"><li class="bad">Risque de condensation : ajoutez un pare-vapeur côté intérieur (fiche complète de la composition).</li></ul>' : ''}
        <p class="hint">Calculs de pré-dimensionnement (EN ISO 6946, 13786, loi de masse, Glaser), indicatifs.</p>
      </section></div>
    <footer class="ed-f"><button class="btn" data-close>Annuler</button><button class="btn" id="iaAll">Appliquer à tous (${state.els.filter(x => x.type === el.type).length})</button><button class="btn primary" id="iaOne">Appliquer à cet élément</button></footer>`;
  };
  let msg = '';
  const draw = () => { const d = openEDlg(render(msg), 'mid'); wire(d); };
  const wire = d => {
    const q = s => d.querySelector(s);
    d.querySelectorAll('[data-ial]').forEach(b => b.onclick = () => { S.idx = +b.dataset.ial; S.mat = layers0[S.idx][0]; S.e = layers0[S.idx][1]; S.lambda = mat(S.mat).lambda ?? 0.035; msg = ''; draw(); });
    q('#iaMat').onchange = e => { S.mat = e.target.value; S.lambda = mat(S.mat).lambda ?? 0.035; if (S.mode !== 'e') msg = solve() || ''; draw(); };
    q('#iaLam').onchange = e => { const v = num(e.target.value); if (v > 0.004) S.lambda = v; if (S.mode !== 'e') msg = solve() || ''; draw(); };
    q('#iaE').onchange = e => { const v = num(e.target.value); if (v > 0) { S.e = v / 1000; S.mode = 'e'; } msg = ''; draw(); };
    q('#iaER').oninput = e => { S.e = +e.target.value / 1000; q('#iaE').value = e.target.value; };
    q('#iaER').onchange = () => { S.mode = 'e'; msg = ''; draw(); };
    d.querySelectorAll('[data-iamode]').forEach(b => b.onclick = () => { S.mode = b.dataset.iamode; msg = S.mode !== 'e' && S.target ? solve() || '' : ''; draw(); setTimeout(() => d.querySelector('#iaT')?.focus(), 30); });
    const t = q('#iaT'); if (t) t.onchange = e => { S.target = e.target.value; msg = solve() || ''; draw(); };
    q('#iaFU').onchange = e => { S.forceU = e.target.value; if (num(S.forceU) > 0) S.forceR = ''; draw(); };
    q('#iaFR').onchange = e => { S.forceR = e.target.value; if (num(S.forceR) > 0) S.forceU = ''; draw(); };
    q('#iaFN').onchange = e => { S.note = e.target.value; };
    q('#iaOne').onclick = () => apply([el]);
    q('#iaAll').onclick = () => apply(state.els.filter(x => x.type === el.type));
  };
  const apply = targets => {
    delete state.lib.mats.__tmp;
    const changed = Math.abs(S.e - layers0[S.idx][1]) > 1e-6 || S.mat !== layers0[S.idx][0] || Math.abs((mat(S.mat).lambda ?? 0) - S.lambda) > 1e-6;
    pushHist(); state.isSample = false;
    let typeId = el.type;
    if (changed){
      let mid = S.mat;
      if (Math.abs((mat(S.mat).lambda ?? 0) - S.lambda) > 1e-6){
        const M = mat(S.mat); mid = Object.entries(state.lib.mats).find(([, x]) => x.base === S.mat && Math.abs(x.lambda - S.lambda) < 1e-6)?.[0] || 'P-' + uid8();
        state.lib.mats[mid] = {...M, lambda:S.lambda, nom:`${M.nom} (λ ${nf(S.lambda, 3)})`, base:S.mat};
      }
      const L = layers0.map(l => l.slice()); L[S.idx] = [mid, rnd(S.e, 3)];
      const sig = JSON.stringify(L), found = Object.entries(libCompos()).find(([, c]) => c.kind === base.kind && JSON.stringify(c.layers) === sig);
      if (found) typeId = found[0];
      else { typeId = 'P-' + uid8(); state.lib.compos[typeId] = {...JSON.parse(JSON.stringify(base)), layers:L, nom:`${base.nom.replace(/ · isolant .*$/, '')} · isolant ${n0(S.e * 1000)} mm`, from:el.type}; }
    }
    const fU = num(S.forceU), fR = num(S.forceR);
    for (const t of targets){
      t.type = typeId;
      if (fU > 0){ t.forceU = fU; delete t.forceR; } else if (fR > 0){ t.forceR = fR; delete t.forceU; } else { delete t.forceU; delete t.forceR; }
      if ((fU > 0 || fR > 0) && S.note) t.forceNote = S.note.slice(0, 120); else delete t.forceNote;
    }
    closeEDlg(); rebuild(); toast(targets.length > 1 ? `${targets.length} éléments mis à jour` : 'Performances mises à jour');
  };
  if (!state.lib) state.lib = {mats:{}, compos:{}, fams:{}};
  draw();
}

/* ---------- événements de l'arborescence ---------- */
$('#pbody').addEventListener('click', e => {
  const t = e.target; if (activeTab !== 'props') return;
  const tw = t.closest('[data-twist]'); if (tw && !tw.disabled){ const k = tw.dataset.twist; treeOpen.has(k) ? treeOpen.delete(k) : treeOpen.add(k); return renderPanel(); }
  const ey = t.closest('[data-teye]'); if (ey){ const k = ey.dataset.teye; if (k.startsWith('L')) runTreeAction('lhide', k); else runTreeAction('hide', k); return; }
  const dm = t.closest('[data-tmenu]'); if (dm){ e.stopPropagation(); return openTreeMenu(dm, dm.dataset.tmenu); }
  const ti = t.closest('[data-tins]'); if (ti) return openInsulAdjust(+ti.dataset.tins);
  const ta = t.closest('[data-tact]'); if (ta){ if (ta.dataset.tact === 'collapse'){ treeOpen.clear(); treeOpen.add('P'); } else { treeOpen.add('P'); state.levels.forEach((_, i) => { treeOpen.add('L' + i); TREE_CATS.forEach(([k]) => treeOpen.add(`L${i}|${k}`)); }); } return renderPanel(); }
  const row = t.closest('.tr'); if (row && row.closest('.tree')){
    const k = row.dataset.tk;
    if (k.startsWith('E')){ const id = +k.slice(1); if (e.shiftKey && sel){ multi = multi.includes(id) ? multi.filter(x => x !== id) : [...multi, id]; applySel(); buildLabels(); renderPanel(); } else select(id); }
    else if (/^L\d+$/.test(k)) runTreeAction('work', k);
    else { treeOpen.has(k) ? treeOpen.delete(k) : treeOpen.add(k); renderPanel(); }
  }
});
$('#pbody').addEventListener('dblclick', e => { const row = e.target.closest('.tree .tr[data-tk^="E"]'); if (row) frameEl(+row.dataset.tk.slice(1)); });
$('#pbody').addEventListener('input', e => { if (e.target.matches('[data-treeq]')){ treeQuery = e.target.value; const pos = e.target.selectionStart; renderPanel(); const i = $('#pbody [data-treeq]'); if (i){ i.focus(); i.setSelectionRange(pos, pos); } } });
$('#treeMenu').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-tmi]'); if (!b || b.disabled) return; const m = $('#treeMenu'); m.hidden = true; runTreeAction(b.dataset.tmi, m.dataset.key); });
document.addEventListener('click', e => { const m = $('#treeMenu'); if (!m.hidden && !m.contains(e.target)) m.hidden = true; });
// ouvre la branche de l'élément sélectionné depuis la vue 3D
function revealInTree(id){ const el = getEl(id); if (!el) return; treeOpen.add('P'); treeOpen.add('L' + el.lvl); const host = el.kind === 'inst' && el.host ? getEl(el.host) : null; if (host){ treeOpen.add(`L${host.lvl}|wall`); treeOpen.add('E' + host.id); } else treeOpen.add(`L${el.lvl}|${el.kind}`); }
