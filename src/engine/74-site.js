/* ============ Lieu du chantier, maquettes ARCHIPLAN, menus ============ */
function openSiteDialog(){
  const s = state.site;
  dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Lieu du chantier</p><h3 class="ed-name" style="margin:0">Où se trouve le chantier ?</h3></div><button class="ib" id="sdX" aria-label="Fermer">×</button></div>
    <div class="ed-body" style="display:block">
      <div class="lsearch"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="sdQ" placeholder="Adresse, rue, place, commune…" value="${esc(s?.label || '')}" autocomplete="off"></div>
      <div id="sdRes" class="elist" style="margin-top:8px"></div>
      <div class="fields" style="margin-top:12px"><label class="f wide"><span>Taille de la zone chargée autour de l'adresse</span><span class="in"><select id="sdSize">${AREA_SIZES.map(v => `<option value="${v}"${(s?.size || 500) === v ? ' selected' : ''}>${v} × ${v} m${v === 500 ? ' (conseillé en ville)' : v === 1200 ? ' (grands itinéraires, plus long à charger)' : ''}</option>`).join('')}</select></span></label></div>
      <p class="hint">Données chargées : rues et sens de circulation (OpenStreetMap), bâtiments et hauteurs (IGN BD TOPO®), relief en altitudes NGF (IGN RGE ALTI®). Mises en cache sur cet appareil pendant 30 jours.</p>
      <div class="btns"><button class="btn primary" id="sdOk" ${s ? '' : 'disabled'}>Charger la zone</button><button class="btn" id="sdNo">Annuler</button></div></div>`, 'mid');
  let pick = s ? {...s} : null, t = 0;
  const q = $('#sdQ'), res = $('#sdRes'), ok = $('#sdOk');
  const search = async () => { const v = q.value.trim(); if (v.length < 3){ res.innerHTML = ''; return; }
    res.innerHTML = '<p class="hint">Recherche…</p>';
    try { const L = await geoSearch(v); res.innerHTML = L.length ? L.map((r, i) => `<div class="erow" data-i="${i}"><span class="ei"><i style="background:var(--accent)"></i></span><span><b>${esc(r.label)}</b><small>${esc(r.context)}</small></span><span></span></div>`).join('') : '<p class="hint">Aucun résultat : précisez la commune.</p>';
      res.querySelectorAll('[data-i]').forEach(r => r.onclick = () => { const x = L[+r.dataset.i]; pick = {label:x.label, lat:x.lat, lon:x.lon, citycode:x.citycode, city:x.city}; res.querySelectorAll('.erow').forEach(e => e.classList.toggle('on', e === r)); ok.disabled = false; q.value = x.label; }); }
    catch(e){ res.innerHTML = '<p class="hint">Service d\'adresses injoignable. Vérifiez la connexion.</p>'; } };
  q.oninput = () => { clearTimeout(t); t = setTimeout(search, 320); }; q.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); search(); } };
  setTimeout(() => { q.focus(); q.select(); }, 40);
  $('#sdX').onclick = $('#sdNo').onclick = closeEngine;
  ok.onclick = () => { if (!pick) return; const size = +$('#sdSize').value; const moved = !s || Math.abs(pick.lat - s.lat) > 1e-6 || Math.abs(pick.lon - s.lon) > 1e-6;
    if (moved && state.els.length && !confirm('Changer de lieu : les éléments déjà placés seront repositionnés par rapport à la nouvelle adresse. Continuer ?')) return;
    closeEngine(); beginEdit(); state.site = {...pick, size}; if (state.name === 'Nouveau chantier' || !state.name) state.name = pick.label.split(',')[0]; endEdit(); $('#projName').textContent = state.name; loadSite(false); };
}
/* ---------- maquettes ARCHIPLAN (.glb) placées à leur adresse ---------- */
const MODELS = new Map();
async function parseGLB(buf){ return new Promise((res, rej) => new GLTFLoader().parse(buf, '', g => res(g), rej)); }
async function loadModelFromBuf(key, buf){
  const g = await parseGLB(buf), root = g.scene; const site = root.getObjectByName('Site'); if (site) site.parent.remove(site);
  root.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } }); MODELS.set(key, root);
  const ex = g.parser?.json?.scenes?.[0]?.extras || root.userData || {}, lieu = ex.archiplan?.lieu || root.children[0]?.userData?.archiplan?.lieu || null;
  return {root, lieu};
}
async function importGLB(file){
  if (!state.site){ toast('Choisissez d\'abord le lieu du chantier.'); return; }
  const buf = await file.arrayBuffer(), key = 'model|' + uid8();
  try {
    const {lieu} = await loadModelFromBuf(key, buf); await IDB.set(key, buf);
    let x = 0, y = 0, zAbs = null; if (lieu?.latitude && WORLD){ [x, y] = WORLD.P.toXY(lieu.longitude, lieu.latitude); if (lieu.altitude != null) zAbs = lieu.altitude; }
    else if (WORLD){ x = c3.target.x; y = -c3.target.z; }
    addEl({id:uid8(), t:'model', key, name:file.name.replace(/\.glb$/i, ''), x, y, a:0, zAbs});
    toast(lieu?.latitude ? 'Maquette ARCHIPLAN placée à son adresse.' : 'Maquette placée au centre de la vue (sans adresse dans le fichier).', 4500);
  } catch(e){ console.error(e); toast('Fichier .glb illisible.'); }
}
async function restoreModels(){ for (const e of state.els) if (e.t === 'model' && !MODELS.has(e.key)){ const buf = await IDB.get(e.key); if (buf){ try { await loadModelFromBuf(e.key, buf); } catch(err){} } } rebuildProj(); }
$('#glbIn').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importGLB(f); });
$('#fileIn').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const r = new FileReader(); r.onload = () => { try { const s = JSON.parse(r.result); if (!Array.isArray(s.els)) throw 0; window.APModel.load(s); toast('Projet importé'); } catch(err){ toast('Fichier non reconnu : choisissez un projet ARCHITRAFIC (.json).'); } }; r.readAsText(f); });
/* ---------- menus ---------- */
function popMenu(m, btn){ document.querySelectorAll('.menu').forEach(x => { if (x !== m) x.hidden = true; }); if (!m.hidden){ m.hidden = true; return; } m.hidden = false; const r = btn.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(10, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 10)) + 'px'; }
document.addEventListener('click', e => { if (!e.target.closest('.menu') && !e.target.closest('#fileBtn,#exportBtn,#viewSet')) document.querySelectorAll('#fileMenu,#exportMenu,#viewMenu').forEach(m => m.hidden = true); });
$('#fileBtn').addEventListener('click', e => { e.stopPropagation(); popMenu($('#fileMenu'), e.currentTarget); });
$('#exportBtn').addEventListener('click', e => { e.stopPropagation(); popMenu($('#exportMenu'), e.currentTarget); });
$('#fileMenu').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; $('#fileMenu').hidden = true;
  ({home:() => $('#homeBtn').click(), new:() => window.APHome ? window.APHome.newProject() : window.APModel.load(blankState()), open:() => $('#fileIn').click(), glbin:() => $('#glbIn').click(), sample:() => window.APModel.load(window.APModel.sample())})[b.dataset.act]?.(); });
$('#exportMenu').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; $('#exportMenu').hidden = true; if (!canExport()) return;
  ({png:() => exportPNG(2), png4:() => exportPNG(4), glb:exportGLB, csv:exportCSV, geojson:exportGeoJSON, json:exportJSON})[b.dataset.act]?.(); });
$('#viewSet').addEventListener('click', e => { e.stopPropagation(); renderViewMenu(); popMenu($('#viewMenu'), e.currentTarget); });
function renderViewMenu(){
  const L = DISPLAY.lay, m = $('#viewMenu');
  m.innerHTML = `<div class="lbl">Calques du site</div>${[['bld', 'Bâtiments'], ['trees', 'Arbres et espaces verts'], ['sidewalks', 'Trottoirs, bordures, caniveaux'], ['marks', 'Marquages au sol'], ['walls', 'Murs, haies et clôtures'], ['lamps', 'Lampadaires et feux'], ['names', 'Noms des rues'], ['areas', 'Occupation du sol']].map(([k, n]) => `<label class="mi"><input type="checkbox" data-lay="${k}"${L[k] !== false ? ' checked' : ''}> ${n}</label>`).join('')}
    <hr><div class="lbl">Éléments du chantier</div><label class="mi"><input type="checkbox" data-proj${projGroup.visible ? ' checked' : ''}> Afficher le chantier</label><label class="mi"><input type="checkbox" data-legend${state.legend.show ? ' checked' : ''}> Légende sur la vue</label>
    <hr><div class="lbl">Lumière</div><label class="mi"><input type="checkbox" data-shadow${DISPLAY.shadows ? ' checked' : ''}> Ombres portées</label><label class="mi" style="display:grid;grid-template-columns:auto 1fr;gap:8px">Soleil<input type="range" min="60" max="300" step="5" value="${DISPLAY.sunAz}" data-sun></label>
    <hr><div class="lbl">Thème de l'interface</div><div class="thm" style="display:flex;gap:6px;padding:4px 10px">${[['light', 'Clair'], ['dark', 'Sombre']].map(([k, n]) => `<button type="button" class="btn" data-thm="${k}" aria-pressed="${(document.documentElement.dataset.theme || 'light') === k}">${n}</button>`).join('')}</div>`;
  m.querySelectorAll('[data-lay]').forEach(c => c.onchange = () => { DISPLAY.lay[c.dataset.lay] = c.checked; saveDisplay(); buildWorld(); annoKey = ''; });
  m.querySelector('[data-proj]').onchange = e => { projGroup.visible = e.target.checked; dirty = true; };
  m.querySelector('[data-legend]').onchange = e => { state.legend.show = e.target.checked; save(); renderLegend(); };
  m.querySelector('[data-shadow]').onchange = e => { DISPLAY.shadows = e.target.checked; saveDisplay(); applyThemeToScene(); };
  m.querySelector('[data-sun]').oninput = e => { DISPLAY.sunAz = +e.target.value; saveDisplay(); positionSun(); dirty = true; };
  m.querySelectorAll('[data-thm]').forEach(b => b.onclick = () => { setTheme(b.dataset.thm); renderViewMenu(); });
}
