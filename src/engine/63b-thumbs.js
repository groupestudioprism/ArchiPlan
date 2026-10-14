/* ============ Vignettes des familles (aperçus 3D rendus hors écran, mis en cache) ============ */
const thumbCache = new Map(); let thumbR = null, thumbQ = [], thumbBusy = false;
const famThumbCached = (id, t) => thumbCache.get(`${id}|${t}|${famRev(id)}`) || '';
const famRev = id => { const F = fam(id); return F ? (JSON.stringify(F).length % 9973) : 0; };
function thumbRenderer(){
  if (thumbR) return thumbR;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192;
  const r = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true, preserveDrawingBuffer:true}); r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(0x000000, 0);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x9a948a, 1.25)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(-3, 6, 5); sc.add(dl);
  const cm = new THREE.PerspectiveCamera(30, 4 / 3, 0.01, 500), grp = new THREE.Group(); sc.add(grp);
  return thumbR = {r, sc, cm, grp, cv};
}
function renderThumb(id, t){
  const F = fam(id); if (!F) return '';
  const T = thumbRenderer(); disposeGroup(T.grp);
  const by = {}; for (const so of famSolids(F, famScope(F, {type:t, params:{}}))) (by[so.m] ??= []).push(solidGeo(so));
  for (const [m, geos] of Object.entries(by)){ const M = mat(m), mm = new THREE.MeshStandardMaterial({color:M.color, roughness:M.rough ?? 0.8, metalness:M.metal ?? 0, transparent:M.opacity < 1, opacity:M.opacity ?? 1});
    const mesh = new THREE.Mesh(geos.length === 1 ? geos[0] : mergeGeos(geos), mm); T.grp.add(mesh);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 35), new THREE.LineBasicMaterial({color:0x5b6068, transparent:true, opacity:0.35})); T.grp.add(e); }
  if (F.host === 'wall'){ // mur fantôme autour de l'ouverture
    const s = famScope(F, {type:t, params:{}}), w = fx(F.cut?.w ?? 'w', s), h = fx(F.cut?.h ?? 'h', s), Ww = w + 0.8, Hw = h + 0.5, th = 0.22, mk = (x0, x1, z0, z1) => { if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return; const g = new THREE.BoxGeometry(x1 - x0, z1 - z0, th); g.translate((x0 + x1) / 2, (z0 + z1) / 2, 0); T.grp.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:0xE6E3DD, transparent:true, opacity:0.55}))); };
    mk(-Ww / 2, -w / 2, 0, Hw); mk(w / 2, Ww / 2, 0, Hw); mk(-w / 2, w / 2, h, Hw);
  }
  const b = new THREE.Box3().setFromObject(T.grp); if (b.isEmpty()) return '';
  const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), R = Math.max(sz.x, sz.y * 1.2, sz.z) * 0.5 + 0.05;
  const dir = (F.host === 'wall' ? new THREE.Vector3(0.38, 0.18, 1) : new THREE.Vector3(-0.85, 0.65, 1)).normalize();
  T.cm.position.copy(c).addScaledVector(dir, R / Math.tan(15 * Math.PI / 180) * 1.05); T.cm.lookAt(c); T.cm.updateProjectionMatrix();
  T.r.render(T.sc, T.cm); const url = T.cv.toDataURL('image/png'); disposeGroup(T.grp); return url;
}
function fillThumbs(){
  document.querySelectorAll('img.fthumb[data-thumb]').forEach(img => { if (img.getAttribute('src')) return; const [id, t] = img.dataset.thumb.split('|'); const key = `${id}|${t}|${famRev(id)}`; if (!thumbQ.includes(key)) thumbQ.push(key); });
  if (!thumbBusy) pumpThumbs();
}
function pumpThumbs(){
  if (!thumbQ.length){ thumbBusy = false; return; } thumbBusy = true;
  const key = thumbQ.shift(), [id, t] = key.split('|');
  if (!thumbCache.has(key)){ try { thumbCache.set(key, renderThumb(id, +t)); } catch(e){ thumbCache.set(key, ''); } }
  const url = thumbCache.get(key); document.querySelectorAll(`img.fthumb[data-thumb="${CSS.escape(id + '|' + t)}"]`).forEach(img => { if (url) img.src = url; });
  setTimeout(pumpThumbs, 0);
}
