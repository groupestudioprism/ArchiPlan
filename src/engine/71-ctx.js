/* ============ Menu clic droit (appui long au doigt) ============
   1) NOYAU COMMUN « PrismCtx » : identique dans toutes les apps Studio Prism (ARCHIPLAN, ARCHITRAFIC, SPECTRA, Nexus…).
      Il ne connaît rien de l'app : on lui donne une liste d'actions { label, hint, checked, danger, disabled, onClick, sub:[…] }.
   2) ACTIONS D'ARCHIPLAN : ce que propose le menu selon ce qu'on vise (mur, dalle, composant…, plan vide, tracé en cours, ligne de l'arbre).
   Clic droit sans bouger = menu ; clic droit glissé = déplacement / rotation de la vue (comme avant). Au doigt : appui long. */

/* ---------- 1) noyau commun ---------- */
const PrismCtx = window.PrismCtx || (window.PrismCtx = (() => {
  let menus = [], prevFocus = null, armed = false;
  const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const close = () => {
    for (const m of menus) m.remove(); menus = [];
    if (armed){ armed = false; for (const [t, f, o] of LISTEN) window.removeEventListener(t, f, o); }
    if (prevFocus?.isConnected) try { prevFocus.focus({preventScroll:true}); } catch(_){ } prevFocus = null;
  };
  const isOpen = () => menus.length > 0;
  const place = (m, x, y, anchor) => {
    m.style.left = '0px'; m.style.top = '0px'; m.style.visibility = 'hidden'; document.body.appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight, W = innerWidth, H = innerHeight, g = 6;
    let l = x, t = y;
    if (anchor){ l = anchor.right - 3; if (l + w > W - g) l = Math.max(g, anchor.left - w + 3); t = anchor.top - 6; }
    else if (l + w > W - g) l = x - w;                 // pas la place à droite du curseur : le menu s'ouvre vers la gauche
    if (t + h > H - g) t = anchor ? H - g - h : y - h;  // pas la place en bas : vers le haut
    m.style.left = Math.max(g, Math.min(l, W - w - g)) + 'px'; m.style.top = Math.max(g, Math.min(t, H - h - g)) + 'px'; m.style.visibility = '';
  };
  const closeFrom = depth => { while (menus.length > depth){ menus.pop().remove(); } };
  function build(items, depth, title){
    const m = mk('div', 'pctx'); m.setAttribute('role', 'menu'); m.tabIndex = -1; m.dataset.depth = depth;
    if (title) m.appendChild(mk('div', 'pctx-h', title));
    let any = false;
    for (const it of items){
      if (!it) continue;
      if (it.sep){ if (any) m.appendChild(Object.assign(mk('div', 'pctx-sep'), {role:'separator'})); continue; }
      if (it.header){ m.appendChild(mk('div', 'pctx-h', it.header)); continue; }
      any = true;
      const b = mk('button', 'pctx-i' + (it.danger ? ' danger' : '')); b.type = 'button'; b.disabled = !!it.disabled;
      b.setAttribute('role', it.checked != null ? 'menuitemradio' : 'menuitem'); if (it.checked != null) b.setAttribute('aria-checked', String(!!it.checked));
      b.append(mk('span', 'pctx-ic', it.checked ? '✓' : (it.icon || '')), mk('span', 'pctx-t', it.label));
      if (it.hint) b.appendChild(mk('kbd', 'pctx-k', it.hint));
      if (it.sub){ b.appendChild(mk('span', 'pctx-ar', '›')); b.setAttribute('aria-haspopup', 'true'); }
      const openSub = focus => { closeFrom(depth + 1); for (const x of m.querySelectorAll('.open')) x.classList.remove('open'); b.classList.add('open');
        const s = build(it.sub, depth + 1); menus.push(s); place(s, 0, 0, b.getBoundingClientRect()); if (focus) s.querySelector('.pctx-i:not(:disabled)')?.focus(); };
      b.addEventListener('pointerenter', () => { if (b.disabled) return; if (it.sub) openSub(false); else { closeFrom(depth + 1); m.querySelectorAll('.open').forEach(x => x.classList.remove('open')); } });
      b.addEventListener('click', ev => { ev.stopPropagation(); if (b.disabled) return; if (it.sub){ openSub(true); return; }
        close(); try { it.onClick?.(); } catch(err){ console.warn('menu contextuel', err); } });
      b.addEventListener('keydown', ev => { if (it.sub && ev.key === 'ArrowRight' && !b.disabled){ ev.preventDefault(); openSub(true); } });
      m.appendChild(b);
    }
    m.addEventListener('keydown', ev => {
      const bs = [...m.querySelectorAll(':scope > .pctx-i:not(:disabled)')], i = bs.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown'){ ev.preventDefault(); bs[(i + 1) % bs.length]?.focus(); }
      else if (ev.key === 'ArrowUp'){ ev.preventDefault(); bs[(i - 1 + bs.length) % bs.length]?.focus(); }
      else if (ev.key === 'Home'){ ev.preventDefault(); bs[0]?.focus(); } else if (ev.key === 'End'){ ev.preventDefault(); bs.at(-1)?.focus(); }
      else if (ev.key === 'ArrowLeft' && depth){ ev.preventDefault(); const p = menus[depth - 1]; closeFrom(depth); p?.querySelector('.pctx-i.open')?.focus(); }
    });
    return m;
  }
  /* fermeture : clic ailleurs, Échap, défilement, redimensionnement, changement de fenêtre */
  const away = ev => { if (ev.type === 'keydown'){ if (ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); if (menus.length > 1) closeFrom(menus.length - 1); else close(); } return; }
    if (ev.type === 'blur' || ev.type === 'resize') return close();
    if (!menus.some(m => m.contains(ev.target))) close(); };
  const LISTEN = [['pointerdown', away, true], ['wheel', away, {capture:true, passive:true}], ['keydown', away, true], ['resize', away, false], ['blur', away, false]];
  function open(x, y, items, title){
    close(); if (!items?.some(i => i && !i.sep && !i.header)) return false;
    prevFocus = document.activeElement; const m = build(items, 0, title); menus = [m]; place(m, x, y);
    armed = true; for (const [t, f, o] of LISTEN) window.addEventListener(t, f, o);
    m.focus({preventScroll:true}); return true;
  }
  /* branche le menu sur un élément : clic droit sans glisser, appui long au doigt ; getItems(ev) → {items, title} | tableau | null
     (ev porte clientX/clientY ; renvoyer null laisse le comportement par défaut du navigateur) */
  function attach(target, getItems, o = {}){
    const LP = o.longPress ?? 520, TOL = 6; let rt = null, tp = null, lastRight = -1e9;
    const show = (ev, x, y) => { const r = getItems(ev, x, y); const items = Array.isArray(r) ? r : r?.items; return !!items?.length && open(x, y, items, r?.title); };
    const stopLP = () => { if (tp){ clearTimeout(tp.t); tp = null; } };
    target.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse'){ if (ev.button === 2){ rt = {x:ev.clientX, y:ev.clientY, at:performance.now()}; lastRight = rt.at; } return; }
      if (!ev.isPrimary){ stopLP(); return; }
      stopLP(); const d = {x:ev.clientX, y:ev.clientY, clientX:ev.clientX, clientY:ev.clientY, target:ev.target, pointerType:ev.pointerType};
      tp = {x:d.x, y:d.y, t:setTimeout(() => { tp = null; if (show(d, d.x, d.y)) o.onLongPress?.(); }, LP)};
    });
    target.addEventListener('pointermove', ev => { if (tp && Math.hypot(ev.clientX - tp.x, ev.clientY - tp.y) > 8) stopLP(); });
    for (const t of ['pointerup', 'pointercancel']) target.addEventListener(t, ev => {
      stopLP(); if (!rt) return; const r = rt; rt = null;
      if (t === 'pointerup' && ev.button === 2 && Math.hypot(ev.clientX - r.x, ev.clientY - r.y) <= TOL && performance.now() - r.at < 600) show(ev, ev.clientX, ev.clientY);
    });
    target.addEventListener('contextmenu', ev => { ev.preventDefault();
      if (performance.now() - lastRight < 800) return;               // clic droit souris : déjà traité au relâchement
      if (ev.pointerType === 'touch' || ev.pointerType === 'pen') return;   // appui long : déjà traité par le minuteur
      show(ev, ev.clientX, ev.clientY); });                          // Ctrl+clic (Mac), touche Menu du clavier
  }
  return {open, close, isOpen, attach};
})());

/* ---------- 2) actions d'ARCHIPLAN ---------- */
const ctxEl = id => getEl(id);
const ctxNameOf = el => el.kind === 'inst' ? (fam(el.fam)?.nom || fam(el.fam)?.name || KIND_NAME.inst) : (typeof elName === 'function' ? elName(el) : KIND_NAME[el.kind]) || KIND_NAME[el.kind] || 'Élément';
/* convertit les entrées de l'arbre (treeMenuItems) en actions du menu : le clic droit propose exactement les mêmes actions que le menu ⋮ */
const ctxFromTree = (key, items = treeMenuItems(key)) => { const out = []; for (const i of items) out.push(i === '-' ? {sep:true} : {label:i.t, danger:!!i.danger, disabled:!!i.off, onClick:() => runTreeAction(i.k, key)}); return out; };

function ctxElementItems(el, touch){
  const ids = selIds(), many = ids.length > 1 && ids.includes(el.id);
  if (many){
    return {title:`${ids.length} éléments sélectionnés`, items:[
      {label:'Masquer la sélection', onClick:() => { ids.forEach(i => hiddenIds.add(i)); sel = null; multi = []; rebuild(); }},
      {label:'Isoler la sélection', onClick:() => { hiddenLvls.clear(); hiddenIds.clear(); const keep = new Set(ids); state.els.forEach(e => { if (!keep.has(e.id) && !keep.has(e.host)) hiddenIds.add(e.id); }); rebuild(); frameEl(ids); }},
      {label:'Centrer la vue', onClick:() => frameEl(ids)},
      {label:'Désélectionner', onClick:() => { sel = null; multi = []; applySel(); buildLabels(); renderPanel(); }},
      {sep:true}, {label:'Supprimer', danger:true, hint:'Suppr', onClick:deleteSel}]};
  }
  const key = 'E' + el.id, items = [{label:'Propriétés', onClick:() => select(el.id)}];
  if (touch && tool === 'select') items.push({label:'Ajouter à la sélection', onClick:() => { if (sel && sel !== el.id && !multi.includes(el.id)) multi.push(el.id); else if (!sel) sel = el.id; applySel(); buildLabels(); renderPanel(); }});
  items.push({sep:true}, ...ctxFromTree(key));
  /* ce qui n'existe que dans le plan : agir sur le niveau et la catégorie de l'élément */
  const extra = [];
  if (el.lvl !== curLvl) extra.push({label:`Travailler sur ${lvlName(el.lvl)}`, onClick:() => runTreeAction('work', 'L' + el.lvl)});
  if (el.kind !== 'inst') extra.push({label:`Sélectionner les ${({wall:'murs', slab:'dalles', roof:'toitures', stair:'escaliers', vol:'formes', sk:'esquisses', col:'poteaux'})[el.kind] || 'éléments'} de ${lvlName(el.lvl)}`, onClick:() => runTreeAction('selall', `L${el.lvl}|${el.kind}`)});
  extra.push({label:`Masquer ${lvlName(el.lvl)}`, onClick:() => runTreeAction('lhide', 'L' + el.lvl)});
  const at = items.findIndex(i => i.label === 'Dupliquer'); items.splice(at > 0 ? at - 1 : items.length, 0, {sep:true}, ...extra);
  return {items, title:ctxNameOf(el)};
}
/* clic droit à vide : niveau, affichage, historique */
function ctxGroundItems(){
  const items = [], hid = hiddenIds.size + hiddenLvls.size;
  items.push({label:'Niveau de travail', hint:lvlName(curLvl), sub:state.levels.map((L, i) => ({label:`${L.n}  ·  ${nf(L.z)} m`, checked:i === curLvl, onClick:() => runTreeAction('work', 'L' + i)}))});
  items.push({label:'Ajouter un niveau', onClick:() => runTreeAction('lvl-add', 'P')}, {label:'Gérer les niveaux…', onClick:openLevels});
  items.push({sep:true}, {label:'Tout voir', onClick:fit});
  if (hid) items.push({label:`Tout afficher (${hid} masqué${hid > 1 ? 's' : ''})`, onClick:() => runTreeAction('showall', 'P')});
  items.push({sep:true}, {label:'Annuler', hint:'Ctrl+Z', disabled:!hist.length, onClick:undo}, {label:'Refaire', hint:'Ctrl+Maj+Z', disabled:!redoS.length, onClick:redo});
  if (tool !== 'select') items.push({sep:true}, {label:'Outil Sélection', hint:'V', onClick:() => setTool('select')});
  if (sel || multi.length) items.push({label:'Désélectionner', onClick:() => { sel = null; multi = []; applySel(); buildLabels(); renderPanel(); }});
  items.push({sep:true}, {label:'Lieu, climat et terrain…', onClick:() => runTreeAction('site', 'P')});
  return {items, title:'Plan'};
}
/* tracé en cours */
function ctxDrawItems(){
  const items = [];
  if (draw.poly?.length >= 4) items.push({label:'Terminer la toiture', onClick:finishRoofPoly});
  items.push({label:tool === 'wall' && draw.chainN ? 'Terminer la chaîne de murs' : 'Annuler le tracé', hint:'Échap', danger:!(tool === 'wall' && draw.chainN), onClick:() => { cancelDraw(); syncHud(); }});
  if (tool !== 'select') items.push({label:'Outil Sélection', hint:'V', onClick:() => setTool('select')});
  return {items, title:'Tracé en cours'};
}

PrismCtx.attach(canvas, ev => {
  if (typeof state === 'undefined' || !state || !$('#app') || $('#app').inert) return null;
  const touch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
  if (draw.start || draw.base || draw.poly?.length || draw.arcB) return ctxDrawItems();
  const h = hitModel(ev), el = h?.id != null ? ctxEl(h.id) : null;
  if (el){ if (!selIds().includes(el.id)) select(el.id); return ctxElementItems(el, touch); }
  return ctxGroundItems();
}, {onLongPress:() => { down = null; }});   // l'appui long ne doit pas ajouter à la sélection au relâchement : le menu propose « Ajouter à la sélection »

/* même menu sur les lignes de l'arbre du projet */
document.addEventListener('contextmenu', ev => {
  const row = ev.target.closest?.('.tr[data-tk]'); if (!row || !state) return;
  const key = row.querySelector('[data-tmenu]')?.dataset.tmenu; if (!key) return;
  const items = ctxFromTree(key); if (!items.length) return; ev.preventDefault();
  PrismCtx.open(ev.clientX, ev.clientY, items, key.startsWith('E') && getEl(+key.slice(1)) ? ctxNameOf(getEl(+key.slice(1))) : undefined);
});
