/* Tutoriel : visite guidée qui MONTRE les éléments réels de l'interface (surbrillance, flèche, démonstration), accessible depuis le menu Fichier.
   Chaque étape : sel = élément à mettre en valeur (sélecteur CSS), demo = action de démonstration, undo = retour à l'état précédent. */
const tuTab = t => () => { const b = document.querySelector(`#panel [data-tab="${t}"]`); if (b) b.click(); };
const TUTO = [
  {t:'Dessiner : les outils', sel:'.tools [data-tool="wall"]', x:'Mur (M), Dalle (D), Toit (T), Escalier (E), Poteau (P), Poutre (H) : choisissez un outil ici, cliquez des points dans le plan, tapez une longueur puis Entrée. Échap annule ; deux Échap ramènent à la sélection.', demo:() => setTool('wall'), undo:() => setTool('select')},
  {t:'Toits, escaliers et dalles au tracé', sel:'.tools [data-tool="roof"]', x:'Toit, Escalier et Dalle acceptent un mode « Au tracé » : cliquez le contour (ou le cheminement de l\'escalier) point par point, Entrée ou clic sur le premier point pour fermer. Toute forme est possible, même non orthogonale.', demo:() => setTool('roof'), undo:() => setTool('select')},
  {t:'Sélectionner et modifier', sel:'.tools [data-tool="select"]', x:'Cliquez un élément (Maj pour en ajouter). Les flèches du clavier le déplacent du pas affiché. Le panneau de droite donne ses propriétés : composition des murs, isolant, hauteur, matériaux.', demo:() => { setTool('select'); tuTab('props')(); }},
  {t:'La bibliothèque', sel:'#panel [data-tab="lib"]', x:'L\'onglet Bibliothèque propose plus de 700 modèles : portes, fenêtres, mobilier, équipements et matériaux. Cliquez un modèle puis le plan pour le placer.', demo:tuTab('lib'), undo:tuTab('props')},
  {t:'Plomberie, électricité, ventilation, chauffage', sel:'[data-act="mepAuto"]', x:'Placez à la main radiateurs, luminaires, prises, bouches VMC, ballon, tableau… ou laissez le site faire : nommez vos pièces, validez la proposition modifiable en plan, puis « Générer les réseaux » (tuyaux, gaines, câbles). Les règles NF C 15-100 et DTU sont appliquées.', demo:tuTab('props')},
  {t:'Vues et élévations', sel:'.vgrp.cams', x:'ISO, Dessus, Dessous, puis Face, Droite, Gauche, Arrière : des élévations propres, à la manière d\'une coupe. Le bouton niveau (à côté) affiche en plus le niveau supérieur et/ou inférieur.'},
  {t:'Niveaux voisins', sel:'#nbTog', x:'Affichez ou masquez le niveau du dessus et/ou du dessous en transparence pour caler vos murs, vos escaliers et vos réseaux.'},
  {t:'Barres et panneaux', sel:'.bar-h', x:'Chaque barre se masque et se réaffiche avec sa flèche, accrochée au bord de la barre. Les panneaux se redimensionnent à la poignée.'},
  {t:'Vérifications du bâtiment', sel:'[data-act="checks"]', x:'Contrôle de tout le bâtiment : structure, thermique RE2020, incendie, acoustique, accessibilité, ventilation, électricité, eau. Chaque problème est expliqué avec sa référence et une correction en un clic.', demo:tuTab('props')},
  {t:'Exporter', sel:'#exportBtn', x:'Le menu Exporter ouvre une interface avec aperçu en direct : DQE (PDF, Excel), IFC, Archi Vision, paquet, image, planches à l\'échelle, projet .archiplan.'}
];
let tuState = null;
function closeTutorial(done){
  if (!tuState) return; const S = tuState; tuState = null; try { S.cur?.undo?.(); } catch(e){}
  S.root.remove(); removeEventListener('resize', S.re, true); removeEventListener('keydown', S.key, true);
  if (done) try { localStorage.setItem('ap.tuto', '1'); } catch(e){}
}
function openTutorial(i = 0){
  closeTutorial(); closeEDlg?.();
  const root = document.createElement('div'); root.className = 'tuto'; root.innerHTML = '<div class="tu-hole"></div><div class="tu-ring"></div><div class="tu-card" role="dialog" aria-modal="false" aria-label="Tutoriel"><div class="tu-ar"></div><div class="tu-h"><span class="tu-n"></span><button class="ib ghost" data-x aria-label="Fermer">✕</button></div><h3></h3><p></p><div class="tu-bar"><i></i></div><div class="tu-f"><button class="btn" data-p>Précédent</button><button class="btn primary" data-n>Suivant</button></div></div>';
  document.body.appendChild(root);
  const S = tuState = {root, i, cur:null, re:() => place(), key:e => { if (e.key === 'Escape'){ e.stopPropagation(); closeTutorial(); } else if (e.key === 'ArrowRight') go(S.i + 1); else if (e.key === 'ArrowLeft') go(S.i - 1); }};
  const hole = root.querySelector('.tu-hole'), ring = root.querySelector('.tu-ring'), card = root.querySelector('.tu-card'), ar = root.querySelector('.tu-ar');
  function target(){ const st = TUTO[S.i]; const el = st.sel ? [...document.querySelectorAll(st.sel)].find(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed') : null; return el || null; }
  function place(){
    const el = target(), cw = card.offsetWidth, ch = card.offsetHeight, W = innerWidth, H = innerHeight;
    if (!el){ hole.style.cssText = ring.style.cssText = 'display:none'; ar.style.display = 'none'; card.style.left = Math.max(12, (W - cw) / 2) + 'px'; card.style.top = Math.max(12, (H - ch) / 2) + 'px'; return; }
    const r = el.getBoundingClientRect(), pad = 6, x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
    for (const e of [hole, ring]) e.style.cssText = `display:block;left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    let side = 'right', cx, cy; const sp = {right:W - (x + w), left:x, bottom:H - (y + h), top:y};
    side = sp.right > cw + 30 ? 'right' : sp.left > cw + 30 ? 'left' : sp.bottom > ch + 30 ? 'bottom' : 'top';
    if (side === 'right'){ cx = x + w + 18; cy = clamp(y + h / 2 - ch / 2, 12, H - ch - 12); } else if (side === 'left'){ cx = x - cw - 18; cy = clamp(y + h / 2 - ch / 2, 12, H - ch - 12); }
    else { cx = clamp(x + w / 2 - cw / 2, 12, W - cw - 12); cy = side === 'bottom' ? y + h + 18 : y - ch - 18; }
    card.style.left = cx + 'px'; card.style.top = cy + 'px'; ar.style.display = 'block'; ar.dataset.side = side;
    if (side === 'right' || side === 'left') ar.style.cssText = `display:block;top:${clamp(y + h / 2 - cy - 7, 10, ch - 24)}px;${side === 'right' ? 'left:-7px' : 'right:-7px'}`; else ar.style.cssText = `display:block;left:${clamp(x + w / 2 - cx - 7, 10, cw - 24)}px;${side === 'bottom' ? 'top:-7px' : 'bottom:-7px'}`;
  }
  function go(n){
    if (n < 0) return; if (n >= TUTO.length){ closeTutorial(true); return; }
    try { S.cur?.undo?.(); } catch(e){} S.i = n; const st = S.cur = TUTO[n];
    try { st.demo?.(); } catch(e){ console.warn('tuto', e); }
    root.querySelector('.tu-n').textContent = `Tutoriel · ${n + 1} / ${TUTO.length}`; root.querySelector('h3').textContent = st.t; root.querySelector('p').textContent = st.x; root.querySelector('.tu-bar i').style.width = (n + 1) / TUTO.length * 100 + '%';
    root.querySelector('[data-p]').style.visibility = n ? '' : 'hidden'; root.querySelector('[data-n]').textContent = n < TUTO.length - 1 ? 'Suivant' : 'Terminer';
    requestAnimationFrame(() => { const el = target(); el?.scrollIntoView?.({block:'nearest', inline:'nearest'}); place(); setTimeout(place, 260); });
  }
  root.querySelector('[data-x]').onclick = () => closeTutorial(); root.querySelector('[data-n]').onclick = () => go(S.i + 1); root.querySelector('[data-p]').onclick = () => go(S.i - 1);
  addEventListener('resize', S.re, true); addEventListener('keydown', S.key, true); go(i);
}
