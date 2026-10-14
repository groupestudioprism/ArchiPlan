/* ============ Démarrage, vues, boucle de rendu, pont avec le compte et le cloud ============ */
function setView(v){
  const prev = view; view = v === 'render' ? 'render' : v === '2d' ? '2d' : '3d';
  if (view === '2d'){ c3.enabled = false; c2.enabled = true; const t = c3.target; c2.target.set(t.x, 0, t.z); ortho.position.set(t.x, 1500, t.z); if (prev !== '2d'){ const d = persp.position.distanceTo(c3.target); ortho.zoom = clamp((vpEl.clientHeight || 600) / (2 * d * Math.tan(persp.fov * Math.PI / 360)), c2.minZoom, c2.maxZoom); } ortho.updateProjectionMatrix(); c2.update(); }
  else { c2.enabled = false; c3.enabled = true; if (prev === '2d'){ const t = c2.target, z = WORLD ? H(t.x, -t.z) : 0, d = clamp((vpEl.clientHeight || 600) / ortho.zoom / (2 * Math.tan(persp.fov * Math.PI / 360)), 20, 3000), dir = persp.position.clone().sub(c3.target).normalize(); c3.target.set(t.x, z, t.z); persp.position.copy(c3.target).add(dir.multiplyScalar(d)); c3.update(); } }
  document.body.dataset.mode = view; $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === view));
  const wasPlan = planLook(); if (view === 'render' && DISPLAY.style !== 'realistic' && DISPLAY.style !== 'aerial') DISPLAY.style = 'realistic';
  if (view === '2d' && prev !== '2d' && DISPLAY.style === 'realistic') DISPLAY.style = 'textured';
  projGroup.traverse(o => { if (o.userData.planOnly) o.visible = view === '2d'; });
  syncStyleBtns(); applyThemeToScene(); if (wasPlan !== planLook() || planLook() || prev === 'render' || view === 'render') buildWorld(); annoKey = ''; dirty = true;
}
function setStyle(st){ if (!STYLES[st]) return; DISPLAY.style = st; saveDisplay(); syncStyleBtns(); for (const k of Object.keys(MAT)) if (k.startsWith('c|')) { /* couleurs partagées : inchangées */ } applyThemeToScene(); buildWorld(); rebuildProjAll(); }
function rebuildProjAll(){ for (const c of projCache.values()){ projGroup.remove(c.grp); } projCache.clear(); rebuildProj(); }
function syncStyleBtns(){ $$('[data-style]').forEach(b => b.setAttribute('aria-pressed', b.dataset.style === DISPLAY.style)); }
function setTheme(t){ document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light'; try { localStorage.setItem('at.theme', document.documentElement.dataset.theme); } catch(e){} }
window.APTheme = setTheme;
new MutationObserver(() => { applyThemeToScene(); if (planLook()) buildWorld(); }).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
$$('[data-mode]').forEach(b => b.addEventListener('click', () => setView(b.dataset.mode)));
$$('[data-style]').forEach(b => b.addEventListener('click', () => setStyle(b.dataset.style)));
$$('[data-cam]').forEach(b => b.addEventListener('click', () => camPreset(b.dataset.cam)));
$('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
$$('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
function syncSnap(){ $$('[data-snap]').forEach(b => b.setAttribute('aria-pressed', !!SNAP[b.dataset.snap])); }
$$('[data-snap]').forEach(b => b.addEventListener('click', () => { SNAP[b.dataset.snap] = !SNAP[b.dataset.snap]; try { localStorage.setItem('at.snap', JSON.stringify(SNAP)); } catch(e){} syncSnap(); }));
$('#simPlay').addEventListener('click', () => SIM.on ? simStop(false) : simStart());
$('#simSpeed').addEventListener('change', e => { SIM.speed = +e.target.value || 1; });
$('#simDens').addEventListener('change', e => { state.sim.dens = +e.target.value; save(); });
$('#simReset').addEventListener('click', () => { const was = SIM.on; simStop(true); if (was) simStart(); });

/* boucle de rendu */
function loop(now){
  requestAnimationFrame(loop);
  simTick(now);
  const moved = ctl().update();
  if (moved || dirty){ renderer.render(scene, cam()); updateLabels(); updateCompass(); dirty = false; }
}

/* ---------- exemple : rue barrée en centre-ville, déviation et balisage ---------- */
function sample(){ const s = blankState('Exemple · rue barrée'); s.site = {label:'Rue de Saint-Malo, 35000 Rennes', lat:48.11535, lon:-1.68255, size:500}; s.sampleSetup = true; s.meta = {...s.meta, moa:'Ville de Rennes (exemple)', entreprise:'Entreprise de travaux publics', arrete:'2026-XXX'}; return s; }
function runSampleSetup(){
  if (!state.sampleSetup || !WORLD) return; delete state.sampleSetup;
  let best = null; for (const [ri, r] of NET.roads.entries()){ if (!r.drive || r.cls < 4 || r.cls > 5) continue; for (let k = 0; k + 1 < r.pts.length; k++){ const c = segClosest([0, 0], r.pts[k], r.pts[k + 1]), d = V.len(c.pt); if (!best || d < best.d) best = {ri, k, t:c.t, pt:c.pt, d, r, dir:V.norm(V.sub(r.pts[k + 1], r.pts[k]))}; } }
  if (!best) return;
  const keep = {...TOOLOPT}; Object.assign(TOOLOPT, {closeMode:'total', autoDetour:true, autoSigns:true}); makeClosure(best); Object.assign(TOOLOPT, keep);
  const cl = state.els.find(e => e.t === 'closure'); if (!cl) return;
  edit(() => {
    const mid = plAt(cl.pts, plLen(cl.pts) / 2), n = V.perp(mid.dir), a = Math.atan2(mid.dir[1], mid.dir[0]);
    state.els.push({id:uid8(), t:'obj', k:'pelle', x:mid.pt[0], y:mid.pt[1], a});
    state.els.push({id:uid8(), t:'obj', k:'benne', x:mid.pt[0] + mid.dir[0] * 14, y:mid.pt[1] + mid.dir[1] * 14, a});
    const z = [-9, 9].flatMap(s => [-1, 1].map(t => V.add(V.add(mid.pt, V.mul(mid.dir, s * (t > 0 ? 1 : 1))), V.mul(n, t * 3.2))));
    state.els.push({id:uid8(), t:'zone', name:'Tranchée réseau', pts:[V.add(V.add(mid.pt, V.mul(mid.dir, -12)), V.mul(n, 3)), V.add(V.add(mid.pt, V.mul(mid.dir, 22)), V.mul(n, 3)), V.add(V.add(mid.pt, V.mul(mid.dir, 22)), V.mul(n, -3)), V.add(V.add(mid.pt, V.mul(mid.dir, -12)), V.mul(n, -3))], fence:true});
    state.els.push({id:uid8(), t:'note', x:mid.pt[0] + n[0] * 8, y:mid.pt[1] + n[1] * 8, text:'Tranchée réseau d\'eau\nAccès riverains maintenu', col:'#1565C0'});
  });
  frameAt(cl.pts[0][0], cl.pts[0][1], 90); toast('Exemple prêt : rue barrée, déviation calculée, panneaux et engins posés. Lancez la simulation ▶', 6000);
}

/* ---------- démarrage ---------- */
state = blankState(); applyThemeToScene(); resize(); fit(); setTool('select'); setView('3d'); syncStyleBtns(); syncSnap(); syncUndo(); renderPanel(); renderLegend();
$('#simDens').value = String(state.sim.dens);
requestAnimationFrame(loop);

/* ---------- pont avec le compte et le cloud (script classique) ---------- */
window.APModel = {
  get: () => JSON.stringify(state),
  name: () => state.name,
  sample: () => sample(),
  load(s){
    quiet = true;
    try {
      simStop(true); state = migrate(s); hist.length = 0; redoS.length = 0; sel = null; cancelDraw(); setTool('select'); syncUndo();
      projCache.forEach(c => projGroup.remove(c.grp)); projCache.clear(); $('#simDens').value = String(state.sim.dens);
      $('#projName').textContent = state.name;
      if (state.site?.lat){ WORLD = null; buildWorld(); rebuildProj(); loadSite(false).then(() => { restoreModels(); if (state.sampleSetup) runSampleSetup(); }); }
      else { WORLD = null; buildWorld(); rebuildProj(); fit(); }
      refreshPanel(); renderLegend();
    } finally { quiet = false; }
    if (!state.site) setTimeout(() => { if (!state.site && document.getElementById('home')?.hidden !== false && document.getElementById('auth')?.hidden !== false) openSiteDialog(); }, 400);
  },
  thumb(){
    try { renderer.render(scene, cam()); const src = renderer.domElement; if (!src.width || !src.height) return '';
      const c = document.createElement('canvas'); c.width = 320; c.height = Math.max(120, Math.round(320 * src.height / src.width)); const g = c.getContext('2d'); g.fillStyle = '#EEF3F7'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height); dirty = true; return c.toDataURL('image/jpeg', 0.72); }
    catch(e){ return ''; }
  },
  setUserLib(){},
};
window.dispatchEvent(new Event('ap:ready'));
window.__apReady = true;
(() => { const sp = document.getElementById('splash'); if (!sp) return; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => { sp.classList.add('done'); setTimeout(() => sp.remove(), 600); }, Math.max(reduce ? 300 : 0, (reduce ? 600 : 3000) - performance.now())); })();
/* accès de diagnostic (console, tests automatiques) */
window.ATDebug = {simRun:(sec) => { for (let t = 0; t < sec; t += 0.1) simStep(0.1); simRender(); simStatus(); dirty = true; }, look:(px, py, pz, tx, ty, tz) => { setView('3d'); persp.position.set(px, H(px, py) + pz, -py); c3.target.set(tx, H(tx, ty) + tz, -ty); c3.update(); dirty = true; }, meshes:() => worldGroup.children.map(o => [o.name, o.geometry?.attributes?.position?.count || 0, o.count]), annos:() => annos.slice(0, 3).map(a => ({xy:a.xy, z:a.z, street:a.street, s:toScreen(W3(a.xy[0], a.xy[1], (WORLD ? H(a.xy[0], a.xy[1]) : 0) + a.z))})), cams:() => ({zoom:ortho.zoom, mpp:mPerPx(), view, top:ortho.top, bottom:ortho.bottom}), state:() => state, world:() => WORLD, net:() => NET, sim:() => SIM, setView, setStyle, setTool, frameAt, loadSite, makeClosure, nearestRoad, sectionAt, route, closedSets, proposeDetours, buildWorld, rebuildProj, parseWorld, buildNet, exportPNG, exportGLB, exportCSV, exportGeoJSON,
  toScreen:(x, y) => { const [sx, sy] = toScreen(W3(x, y, WORLD ? H(x, y) : 0)); const r = canvas.getBoundingClientRect(); return [r.left + sx, r.top + sy]; }, setWorldRaw:async (raw, site) => { const P = makeProj(site.lat, site.lon), W = parseWorld(raw, P, site.size); const z = Float32Array.from(raw.elev.z), N = raw.elev.N; WORLD = {size:site.size, P, z0:z[(N >> 1) * N + (N >> 1)], elev:{N, z}, W, src:{...raw.src, bld:W.src.bld, at:Date.now()}}; buildNet(W); buildWorld(); rebuildProj(); fit(); refreshPanel(); }};
