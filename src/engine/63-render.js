/* ============ Outil Rendu : styles, soleil, exposition, captures ============ */
const SUN_PRESETS = {matin:{sunAz:100, sunEl:18}, midi:{sunAz:180, sunEl:62}, aprem:{sunAz:235, sunEl:38}, soir:{sunAz:285, sunEl:10}};
function renderRenderPanel(){
  const st = DISPLAY.style;
  return `<div class="ph"><h2>Rendu</h2><span class="tag">${esc(STYLES[st])}</span></div>
    <div class="grp"><h3>Style d'affichage</h3><div class="stylegrid">${Object.entries(STYLES).map(([k, n]) => `<button class="sty${k === st ? ' on' : ''}" data-act="style" data-style="${k}" aria-pressed="${k === st}"><i class="sw-${k}"></i>${n}</button>`).join('')}</div>
      <p class="hint">Ces styles sont aussi ceux d'Archi Vision : le modèle exporté (.glb) contient les matériaux et leurs textures.</p></div>
    <div class="grp"><h3>Soleil</h3>
      <div class="chips">${Object.entries({matin:'Matin', midi:'Midi', aprem:'Après-midi', soir:'Soir'}).map(([k, n]) => `<button class="chip" data-act="sun" data-k="${k}">${n}</button>`).join('')}</div>
      <label class="rng"><span>Orientation (azimut)</span><input type="range" min="0" max="359" step="1" data-rset="sunAz" value="${DISPLAY.sunAz}"><b>${n0(DISPLAY.sunAz)}°</b></label>
      <label class="rng"><span>Hauteur</span><input type="range" min="2" max="88" step="1" data-rset="sunEl" value="${DISPLAY.sunEl}"><b>${n0(DISPLAY.sunEl)}°</b></label>
      <label class="rng"><span>Exposition</span><input type="range" min="0.4" max="2" step="0.05" data-rset="exposure" value="${DISPLAY.exposure}"><b>${nf(DISPLAY.exposure, 2)}</b></label>
      <label class="ap-check2"><input type="checkbox" data-rset="shadows"${DISPLAY.shadows ? ' checked' : ''}> Ombres portées</label>
      <label class="ap-check2"><input type="checkbox" data-rset="edges"${DISPLAY.edges ? ' checked' : ''}> Arêtes (traits)</label></div>
    <div class="grp"><h3>Points de vue</h3><div class="chips">${[['iso', 'Perspective'], ['front', 'Face'], ['right', 'Droite'], ['back', 'Arrière'], ['left', 'Gauche'], ['top', 'Dessus']].map(([k, n]) => `<button class="chip" data-act="cam" data-k="${k}">${n}</button>`).join('')}</div></div>
    <div class="grp"><h3>Image</h3><div class="btns"><button class="btn" data-act="png" data-k="2">Capture HD (×2)</button><button class="btn primary" data-act="png" data-k="4">Capture 4K</button></div>
      <p class="hint">L'image reprend exactement la vue et le style à l'écran (PNG). Réservé aux comptes avec licence ARCHIPLAN.</p></div>
    <div class="grp"><h3>Archi Vision</h3><div class="btns"><button class="btn primary" data-act="export-glb">Exporter pour Archi Vision (.glb)</button></div>
      <p class="hint">glTF binaire, mètres, axe Y vers le haut, matériaux PBR texturés, un nœud par niveau et par élément avec ses informations (type, composition, U, famille…).</p></div>`;
}
function onRenderInput(t, commit){
  const k = t.dataset.rset;
  if (t.type === 'checkbox'){ DISPLAY[k] = t.checked; saveDisplay(); if (k === 'edges'){ resetMats(); rebuild({noPanel:true}); } applyThemeToScene(); return; }
  const v = +t.value; DISPLAY[k] = v; const out = t.parentElement.querySelector('b'); if (out) out.textContent = k === 'exposure' ? nf(v, 2) : n0(v) + '°';
  if (k === 'exposure') renderer.toneMappingExposure = DISPLAY.style === 'realistic' ? v : 1; else positionSun();
  dirty = true; if (commit) saveDisplay();
}
function onRenderClick(act, b){
  if (act === 'style') setStyle(b.dataset.style);
  else if (act === 'sun'){ Object.assign(DISPLAY, SUN_PRESETS[b.dataset.k]); saveDisplay(); positionSun(); renderPanel(); }
  else if (act === 'cam') camPreset(b.dataset.k);
  else if (act === 'png') doExport('png', +b.dataset.k);
  else if (act === 'export-glb') doExport('glb');
}
