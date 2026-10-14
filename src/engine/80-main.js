/* ============ Interface : modes, outils, barre d'état, clavier, menus ============ */
function setView(v){
  const prev = view; view = v;
  c3.enabled = v !== '2d'; c2.enabled = v === '2d';
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === v));
  document.body.dataset.mode = v;
  if (v === '2d'){ c2.target.set(c3.target.x, 0, c3.target.z); ortho.position.set(c3.target.x, 200, c3.target.z); c2.update(); }
  if (v === 'render'){ if (tool !== 'select') setTool('select'); if (DISPLAY.style === 'shaded' || DISPLAY.style === 'wire') setStyle('realistic'); activeTab = 'render'; }
  else if (prev === 'render' && activeTab === 'render') activeTab = 'props';
  if (prev === 'render' && v !== 'render' && DISPLAY.style === 'realistic') setStyle('shaded');
  if ((prev === '2d') !== (v === '2d')){ resetMats(); applyThemeToScene(); rebuild({noPanel:true}); }
  positionGrid(); buildLabels(); updatePreview(); renderPanel(); dirty = true;
}
$$('[data-mode]').forEach(b => b.addEventListener('click', () => setView(b.dataset.mode)));
$$('[data-style]').forEach(b => { if (!b.closest('#pbody')) b.addEventListener('click', () => setStyle(b.dataset.style)); });
$$('[data-cam]').forEach(b => b.addEventListener('click', () => b.dataset.cam === 'fit' ? fit() : camPreset(b.dataset.cam)));
$('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
$$('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
function syncLevels(){ $('#lvlSel').innerHTML = state.levels.map((l, i) => `<option value="${i}"${i === curLvl ? ' selected' : ''}>${esc(l.n)} · ${nf(l.z)} m</option>`).join(''); }
$('#lvlSel').addEventListener('change', e => { curLvl = +e.target.value; snapGeo = null; cancelDraw(); if (view === '2d') rebuild({noPanel:true}); positionGrid(); buildLabels(); dirty = true; });
$('#typeSel').addEventListener('change', e => { if (tool === 'comp'){ defs.comp.type = +e.target.value; } else if (defs[tool]) defs[tool].type = e.target.value; updatePreview(); });
$('#hIn').addEventListener('change', e => { const v = num(e.target.value); if (v > 0 && defs[tool]) defs[tool].h = v; else e.target.value = defs[tool]?.h ?? ''; updatePreview(); });
$('#stepSel').addEventListener('change', e => { step = +e.target.value; positionGrid(); dirty = true; });
$('#cmdOk').addEventListener('click', runCmd);
$('#cmd').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); if (!e.target.value.trim() && tool === 'wall' && draw.start) cancelDraw(); else runCmd(); } else if (e.key === 'Escape'){ e.target.value = ''; e.target.blur(); cancelDraw(); } });
$('#endBtn').addEventListener('click', cancelDraw);
$('#closeBtn').addEventListener('click', () => { if (draw.chainFirst) placePoint(draw.chainFirst.slice()); });

/* barre d'état : accroches (façon AutoCAD) */
function syncStatus(){
  $$('[data-snap]').forEach(b => b.setAttribute('aria-pressed', !!SNAP[b.dataset.snap]));
  $('#polarInc').value = SNAP.polarInc;
  $$('#osnapMenu input[data-os]').forEach(i => i.checked = !!SNAP[i.dataset.os]);
}
$$('[data-snap]').forEach(b => b.addEventListener('click', () => toggleSnap(b.dataset.snap)));
function toggleSnap(k){
  SNAP[k] = !SNAP[k]; if (k === 'grid'){ DISPLAY.grid = SNAP.grid; saveDisplay(); } if (k === 'ortho' && SNAP.ortho) SNAP.polar = false; if (k === 'polar' && SNAP.polar) SNAP.ortho = false;
  saveSnap(); syncStatus(); positionGrid(); toast(`${{osnap:'Accroches aux objets', ortho:'Mode ortho', polar:'Repérage polaire', grid:'Grille et pas', track:'Repérage d\'objets', surf:'Accroche aux surfaces 3D'}[k] || k} : ${SNAP[k] ? 'activé' : 'désactivé'}`);
}
$('#polarInc').addEventListener('change', e => { SNAP.polarInc = +e.target.value; saveSnap(); });
const osm = $('#osnapMenu');
$('#osnapMore').addEventListener('click', e => { e.stopPropagation(); if (!osm.hidden){ osm.hidden = true; return; } const r = e.currentTarget.getBoundingClientRect(); osm.hidden = false; osm.style.left = Math.max(12, Math.min(r.left, innerWidth - osm.offsetWidth - 12)) + 'px'; osm.style.top = (r.top - osm.offsetHeight - 6) + 'px'; });
osm.addEventListener('change', e => { const k = e.target.dataset.os; if (k){ SNAP[k] = e.target.checked; saveSnap(); snapGeo = null; } });
document.addEventListener('click', e => { if (!osm.hidden && !osm.contains(e.target) && e.target.id !== 'osnapMore') osm.hidden = true; });

/* panneau (feuille sur mobile) */
function openSheet(on){ $('#panel').classList.toggle('open', on); $('#scrim').classList.toggle('on', on); }
$('#panelBtn').addEventListener('click', () => openSheet(!$('#panel').classList.contains('open')));
$('#scrim').addEventListener('click', () => openSheet(false));
$('.sheethead').addEventListener('click', () => openSheet(false));

/* clavier */
document.addEventListener('keydown', e => {
  const t = e.target, inField = t.closest && t.closest('input,select,textarea');
  if (!$('#engDlg').hidden){ if (e.key === 'Escape') closeEDlg(); return; }
  const fk = {F3:'osnap', F7:'grid', F8:'ortho', F9:'grid', F10:'polar', F11:'track'}[e.key];
  if (fk){ e.preventDefault(); toggleSnap(fk); return; }
  if (inField) return;
  const k = e.key;
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'y'){ e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a'){ e.preventDefault(); const ids = state.els.filter(x => x.lvl === curLvl).map(x => x.id); sel = ids[0] || null; multi = ids.slice(1); applySel(); buildLabels(); renderPanel(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === 'Escape'){ if (draw.start || draw.base) cancelDraw(); else if (tool !== 'select') setTool('select'); else select(null); return; }
  if ((k === 'Delete' || k === 'Backspace') && (sel || multi.length)){ e.preventDefault(); deleteSel(); return; }
  if (k === ' ' && tool === 'comp'){ e.preventDefault(); defs.comp.rot = (defs.comp.rot + 90) % 360; updatePreview(); return; }
  if (k === 'Enter' && tool === 'wall' && draw.start){ cancelDraw(); return; }
  if (tool !== 'select' && /^[0-9@.,<;\-]$/.test(k)){ e.preventDefault(); const c = $('#cmd'); c.value += k; c.focus(); return; }
  if (k.toLowerCase() === 'z'){ fit(); return; }
  const map = {v:'select', m:'wall', d:'slab', p:'col', b:'vol', f:'comp', u:'push', g:'move', c:'copy', o:'rotate', r:'measure'};
  if (map[k.toLowerCase()]) setTool(map[k.toLowerCase()]);
});

/* menus Fichier et Exporter */
function popMenu(menu, btn){
  if (!menu.hidden){ menu.hidden = true; return; }
  $$('.menu').forEach(m => { if (m !== menu && m.id !== 'userMenu') m.hidden = true; });
  const r = btn.getBoundingClientRect(); menu.hidden = false;
  menu.style.top = (r.bottom + 6) + 'px'; menu.style.left = Math.max(12, Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 12)) + 'px';
}
const fileMenu = $('#fileMenu'), expMenu = $('#exportMenu');
$('#fileBtn').addEventListener('click', e => { e.stopPropagation(); popMenu(fileMenu, e.currentTarget); });
$('#exportBtn').addEventListener('click', e => { e.stopPropagation(); popMenu(expMenu, e.currentTarget); $$('#exportMenu .lock').forEach(x => x.hidden = !!window.SPAccess?.canExport); });
document.addEventListener('click', e => { [fileMenu, expMenu].forEach(m => { if (!m.hidden && !m.contains(e.target)) m.hidden = true; }); });
fileMenu.addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return; const act = b.dataset.act; fileMenu.hidden = true;
  if (act === 'new'){ if (window.APCloudActive && window.APHome) return window.APHome.newProject(); pushHist(); state = migrate({name:'Nouveau projet', els:[]}); sel = null; multi = []; rebuild(); fit(); syncLevels(); toast('Nouveau projet (Ctrl+Z pour revenir)'); }
  else if (act === 'sample'){ pushHist(); state = migrate(sample()); sel = null; multi = []; rebuild(); fit(); syncLevels(); }
  else if (act === 'open') $('#fileIn').click();
  else if (act === 'home') $('#homeBtn').click();
});
expMenu.addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (!b) return; expMenu.hidden = true; doExport(b.dataset.act, +b.dataset.k || undefined); });
$('#fileIn').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try { const s = JSON.parse(rd.result); if (!Array.isArray(s.els)) throw 0;
      pushHist(); state = migrate({...s, name:s.name || f.name}); sel = null; multi = []; rebuild(); fit(); syncLevels(); toast(`${state.els.length} éléments chargés`);
    } catch(err){ toast('Ce fichier n\'est pas un projet ARCHIPLAN valide.'); }
    e.target.value = '';
  };
  rd.readAsText(f);
});

/* boucle de rendu */
function loop(){
  requestAnimationFrame(loop);
  const moved = ctl().update();
  if (moved || dirty){ renderer.render(scene, cam()); updateLabels(); if (draw.cursor && tool !== 'select') { const p = new THREE.Vector3(draw.cursor[0], curZ(), -draw.cursor[1]); drawSnapGlyph(p, draw.snap?.kind, draw.snap?.how); } dirty = false; }
}
new MutationObserver(() => { resetMats(); applyThemeToScene(); rebuild({noPanel:true}); }).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});

/* ---------- démarrage ---------- */
state = migrate(sample());
applyThemeToScene(); resize(); rebuild(); fit(); setTool('select'); setView('3d'); syncLevels(); syncStatus();
$$('[data-style]').forEach(b => b.setAttribute('aria-pressed', b.dataset.style === DISPLAY.style));
loop();

/* ---------- pont avec le compte et le cloud (script classique) ---------- */
window.APModel = {
  get: () => { embedUsedLib(); return JSON.stringify(state); },
  name: () => state.name,
  sample: () => sample(),
  load(s){
    quiet = true;
    try { state = migrate(s); hist.length = 0; redoS.length = 0; sel = null; multi = []; curLvl = 0; cancelDraw(); setTool('select'); rebuild(); fit(); syncLevels(); }
    finally { quiet = false; }
  },
  thumb(){
    try {
      const st = DISPLAY.style; renderer.render(scene, persp); const src = renderer.domElement; if (!src.width || !src.height) return '';
      const c = document.createElement('canvas'); c.width = 320; c.height = Math.max(120, Math.round(320 * src.height / src.width));
      const g = c.getContext('2d'); g.fillStyle = '#EEF3F7'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(src, 0, 0, c.width, c.height); dirty = true; return c.toDataURL('image/jpeg', 0.72);
    } catch(e){ return ''; }
  },
  setUserLib(lib){ USER_LIB = {mats:{...(lib?.mats || {})}, compos:{...(lib?.compos || {})}, fams:{...(lib?.fams || {})}}; resetMats(); rebuild({noPanel:false}); syncHud(); },
};
window.dispatchEvent(new Event('ap:ready'));
window.__apReady = true;
(() => { const sp = document.getElementById('splash'); if (!sp) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => { sp.classList.add('done'); setTimeout(() => sp.remove(), 600); }, Math.max(reduce ? 300 : 0, (reduce ? 600 : 2900) - performance.now())); })();
// Accès de diagnostic (console, tests automatiques) : lecture de l'état et sélection.
window.APDebug = {state: () => state, sel: () => sel, select: id => select(id), tool: t => setTool(t), view: v => setView(v), snapAt: (x, y) => snap([x, y], {}), style: s => setStyle(s),
  toScreen(x, y, z = 0){ const v = new THREE.Vector3(x, z, -y).project(cam()), r = renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }};

/* ---------- Paramètres d'affichage : couleur de fond, grille, cotes, arêtes, ombres ---------- */
const BG_PRESETS = [['', 'Blanc (défaut)'], ['#F1F2F4', 'Gris clair'], ['#F6F2E8', 'Papier'], ['#C9CDD2', 'Gris moyen'], ['#2B2F36', 'Anthracite'], ['#0F1115', 'Noir']];
function renderViewMenu(){
  const m = $('#viewMenu'), cur = DISPLAY.bg || '';
  m.innerHTML = `<div class="lbl">Couleur du fond</div><div class="bgsw">${BG_PRESETS.map(([c, n]) => `<button type="button" class="bgs${c === cur ? ' on' : ''}" data-bg="${c}" title="${n}" style="background:${c || '#FFFFFF'}" aria-label="${n}"></button>`).join('')}
    <label class="bgs custom" title="Autre couleur"><input type="color" data-bgc value="${esc(DISPLAY.bg || '#ffffff')}" aria-label="Autre couleur"></label></div>
    <hr><div class="lbl">Afficher</div>
    ${[['grid', 'Grille'], ['dims', 'Cotes en plan'], ['edges', 'Arêtes (traits)'], ['shadows', 'Ombres portées']].map(([k, n]) => `<label class="mi"><input type="checkbox" data-vopt="${k}"${(k === 'grid' ? DISPLAY.grid !== false && SNAP.grid : DISPLAY[k] !== false) ? ' checked' : ''}> ${n}</label>`).join('')}
    <p class="hint" style="margin:6px 10px 4px">Réglages mémorisés sur cet appareil.</p>`;
}
function applyDisplay(){ saveDisplay(); resetMats(); applyThemeToScene(); rebuild({noPanel:true}); positionGrid(); buildLabels(); }
$('#viewSet').addEventListener('click', e => {
  e.stopPropagation(); const m = $('#viewMenu'); if (!m.hidden){ m.hidden = true; return; }
  renderViewMenu(); m.hidden = false; const r = e.currentTarget.getBoundingClientRect();
  m.style.width = '250px'; m.style.left = Math.max(12, Math.min(r.right - 250, innerWidth - 262)) + 'px'; m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 12) + 'px';
});
$('#viewMenu').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-bg]'); if (b){ DISPLAY.bg = b.dataset.bg; applyDisplay(); renderViewMenu(); } });
$('#viewMenu').addEventListener('input', e => { if (e.target.matches('[data-bgc]')){ DISPLAY.bg = e.target.value; applyDisplay(); } });
$('#viewMenu').addEventListener('change', e => {
  const k = e.target.dataset.vopt; if (!k) return;
  if (k === 'grid'){ DISPLAY.grid = e.target.checked; SNAP.grid = e.target.checked; saveSnap(); syncStatus(); }
  else DISPLAY[k] = e.target.checked;
  applyDisplay();
});
document.addEventListener('click', e => { const m = $('#viewMenu'); if (!m.hidden && !m.contains(e.target)) m.hidden = true; });
