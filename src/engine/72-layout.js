/* ============ Disposition : barres masquables, panneau de droite redimensionnable, sections repliables ============
   Mémorisé sur l'appareil (ap.layout). Barres : outils (gauche), panneau de droite, barre de commande, aides au dessin, commandes de vue. */
const LAYOUT = (() => { try { return {panelW:352, treeH:0, bars:{}, closed:{}, ...JSON.parse(localStorage.getItem('ap.layout') || '{}')}; } catch(e){ return {panelW:352, treeH:0, bars:{}, closed:{}}; } })();
const saveLayout = () => { try { localStorage.setItem('ap.layout', JSON.stringify(LAYOUT)); } catch(e){} };
const BARS = [['tools', 'Outils (à gauche)', '.tools'], ['panel', 'Panneau de droite', '#panel'], ['cmd', 'Barre de commande', '.cmdin'], ['status', 'Aides au dessin (accroches)', '.status'], ['vtools', 'Commandes de vue', '.vtools'], ['hud', 'Niveau, matériau, pas', '.hud']];
function applyLayout(){
  const app = $('#app'); if (!app) return;
  const narrow = matchMedia('(max-width:860px)').matches;
  for (const [k] of BARS) app.classList.toggle('hide-' + k, !!LAYOUT.bars[k]);
  app.style.setProperty('--panelW', Math.round(clamp(LAYOUT.panelW, 220, Math.max(300, innerWidth * 0.7))) + 'px');
  app.classList.toggle('no-panel', !narrow && !!LAYOUT.bars.panel); app.classList.toggle('no-tools', !narrow && !!LAYOUT.bars.tools);
  const tp = $('#pbody .tree-pane'); if (tp && LAYOUT.treeH) tp.style.maxHeight = tp.style.height = LAYOUT.treeH + 'px';
  syncBarHandles(); if (!applyLayout.q){ applyLayout.q = requestAnimationFrame(() => { applyLayout.q = 0; window.dispatchEvent(new Event('resize')); }); }
}
function layoutMenuHtml(){
  return `<hr><div class="lbl">Largeur du panneau</div><div class="seg-row">${[[300, 'Étroit'], [352, 'Normal'], [440, 'Large'], [560, 'Très large']].map(([w, n]) => `<button type="button" class="chip${LAYOUT.panelW === w ? ' on' : ''}" data-pw="${w}">${n}</button>`).join('')}</div>
    <div class="lbl" style="margin-top:6px;font-weight:400;opacity:.8">Les barres se masquent avec la flèche accrochée à chacune d'elles.</div>`;
}
document.addEventListener('change', e => { const k = e.target.dataset?.bar; if (!k) return; LAYOUT.bars[k] = !e.target.checked; saveLayout(); applyLayout(); toast(e.target.checked ? 'Barre affichée' : 'Barre masquée (Réglages › Affichage pour la remettre)'); });
document.addEventListener('click', e => { const b = e.target.closest?.('[data-pw]'); if (!b) return; LAYOUT.panelW = +b.dataset.pw; saveLayout(); applyLayout(); renderViewMenu(); });
/* poignée de largeur du panneau */
(() => {
  const app = $('#app'), panel = $('#panel'); if (!app || !panel) return;
  const h = document.createElement('div'); h.className = 'panel-res'; h.title = 'Glisser pour régler la largeur du panneau (double clic : réinitialiser)'; h.setAttribute('role', 'separator'); h.setAttribute('aria-orientation', 'vertical'); panel.prepend(h);
  let drag = null;
  h.addEventListener('pointerdown', e => { drag = {x:e.clientX, w:panel.getBoundingClientRect().width}; h.setPointerCapture(e.pointerId); h.classList.add('on'); app.classList.add('dragging'); e.preventDefault(); });
  h.addEventListener('pointermove', e => { if (!drag) return; LAYOUT.panelW = Math.max(150, drag.w + (drag.x - e.clientX)); applyLayout(); });
  const end = () => { if (!drag) return; drag = null; h.classList.remove('on'); app.classList.remove('dragging'); if (LAYOUT.panelW < 200){ LAYOUT.panelW = 352; LAYOUT.bars.panel = true; applyLayout(); } saveLayout(); };   // tiré tout à droite : le panneau se masque
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  h.addEventListener('dblclick', () => { LAYOUT.panelW = 352; saveLayout(); applyLayout(); });
  h.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ LAYOUT.panelW += (e.key === 'ArrowLeft' ? 24 : -24); saveLayout(); applyLayout(); } }); h.tabIndex = 0;
})();
/* sections repliables : clic sur un titre d'encadré ; poignée de hauteur entre l'arborescence et les propriétés */
function enhancePanel(){
  const body = $('#pbody'); if (!body) return;
  body.querySelectorAll('.grp > h3').forEach(h3 => {
    const g = h3.parentElement; if (g.dataset.fold) return; g.dataset.fold = '1'; h3.classList.add('fold'); h3.tabIndex = 0; h3.setAttribute('role', 'button');
    const key = h3.textContent.trim().slice(0, 40); g.classList.toggle('closed', !!LAYOUT.closed[key]); h3.setAttribute('aria-expanded', !LAYOUT.closed[key]);
    const tog = () => { const c = !g.classList.contains('closed'); g.classList.toggle('closed', c); h3.setAttribute('aria-expanded', !c); if (c) LAYOUT.closed[key] = 1; else delete LAYOUT.closed[key]; saveLayout(); };
    h3.onclick = ev => { if (ev.target.closest('button,a,input,select')) return; tog(); };
    h3.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); tog(); } };
  });
  const tp = body.querySelector('.tree-pane'), pp = body.querySelector('.prop-pane');
  if (tp && pp && !tp.nextElementSibling?.classList.contains('split-res')){
    const r = document.createElement('div'); r.className = 'split-res'; r.title = 'Glisser pour régler la hauteur de l\'arborescence'; tp.after(r); let d = null;
    r.addEventListener('pointerdown', e => { d = {y:e.clientY, h:tp.getBoundingClientRect().height}; r.setPointerCapture(e.pointerId); r.classList.add('on'); e.preventDefault(); });
    r.addEventListener('pointermove', e => { if (!d) return; LAYOUT.treeH = clamp(d.h + e.clientY - d.y, 90, body.clientHeight - 140); tp.style.maxHeight = tp.style.height = LAYOUT.treeH + 'px'; });
    r.addEventListener('pointerup', () => { d = null; r.classList.remove('on'); saveLayout(); });
    r.addEventListener('dblclick', () => { LAYOUT.treeH = 0; tp.style.height = tp.style.maxHeight = ''; saveLayout(); });
  }
  if (tp && LAYOUT.treeH) tp.style.maxHeight = tp.style.height = LAYOUT.treeH + 'px';
}
new MutationObserver(() => enhancePanel()).observe($('#pbody'), {childList:true, subtree:true});
/* indicateur animé sous l'onglet actif */
function tabInk(){ const t = $('.tabs'); if (!t) return; let ink = t.querySelector('.ink'); if (!ink){ ink = document.createElement('i'); ink.className = 'ink'; t.appendChild(ink); }
  const b = t.querySelector('button[aria-selected="true"]'); if (b){ ink.style.width = b.offsetWidth + 'px'; ink.style.transform = `translateX(${b.offsetLeft}px)`; } }
new MutationObserver(() => requestAnimationFrame(tabInk)).observe($('.tabs'), {attributes:true, subtree:true, attributeFilter:['aria-selected', 'hidden']});
window.addEventListener('resize', () => requestAnimationFrame(tabInk));

/* ---- flèches accrochées aux barres : masquer / afficher chaque barre sans passer par le menu Affichage ---- */
const BAR_ARROWS = {   // clé : [libellé, sens de la flèche quand la barre est visible]
  tools:['les outils', 'left'], panel:['le panneau', 'right'], cmd:['la ligne de commande', 'down'], status:['les aides au dessin', 'down'], vtools:['les commandes de vue', 'up'], hud:['niveau, matériau, pas', 'up']};
const barHandles = {};
function syncBarHandles(){
  for (const k in barHandles){ const hidden = !!LAYOUT.bars[k], [n, dir] = BAR_ARROWS[k], b = barHandles[k];
    b.classList.toggle('shut', hidden); b.setAttribute('aria-expanded', !hidden); b.title = (hidden ? 'Afficher ' : 'Masquer ') + n; b.setAttribute('aria-label', b.title); }
  const app = $('#app'); if (app) app.style.setProperty('--panelHandle', (LAYOUT.bars.panel ? 0 : Math.round(clamp(LAYOUT.panelW, 220, Math.max(300, innerWidth * 0.7)))) + 'px');
}
(() => {
  const app = $('#app'); if (!app) return;
  const mk = k => { const b = document.createElement('button'); b.type = 'button'; b.className = 'bar-h bar-' + k; b.dataset.dir = BAR_ARROWS[k][1]; b.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>';
    b.onclick = e => { e.stopPropagation(); LAYOUT.bars[k] = !LAYOUT.bars[k]; saveLayout(); applyLayout(); }; barHandles[k] = b; return b; };
  app.append(mk('tools'), mk('panel'));
  const cmdrow = $('.cmdrow'); if (cmdrow) cmdrow.prepend(mk('cmd'));
  const st = $('.status'); if (st){ const w = document.createElement('div'); w.className = 'statrow'; st.before(w); w.append(mk('status'), st); }
  const vt = $('.vtools'); if (vt) vt.prepend(mk('vtools'));
  const hud = $('.hud'); if (hud) hud.prepend(mk('hud'));
  syncBarHandles();
})();
applyLayout(); enhancePanel(); requestAnimationFrame(tabInk);
