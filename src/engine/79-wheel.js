/* Zoom à la molette maîtrisé.
 * Le zoom intégré d'OrbitControls (three r160) divise l'écart de la molette par devicePixelRatio arrondi à l'entier :
 * avec un zoom navigateur < 100 % (devicePixelRatio 0,8 ou 0,9) il devient infini et la vue saute d'un coup au zoom
 * maximal ; avec certaines souris il fait aussi de trop grands pas. On le remplace par un pas fixe et doux :
 * un cran de molette ≈ 4 %, les petits mouvements du pavé tactile sont proportionnels, toujours plafonnés.
 * Le pincement à deux doigts (écran tactile) reste géré par OrbitControls.
 */
(() => {
  const STEP = 0.96;                  // facteur par cran « standard » (100 px)
  const ctls = [c2, c3, c4];
  const rc = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3(), w = new THREE.Vector3(), pl = new THREE.Plane();
  /* zoom d'un facteur k (k < 1 : rapprocher) en gardant fixe le point sous le curseur */
  const zoomBy = (c, k, nx, ny) => {
    const cam = c.object; ndc.set(nx, ny);
    if (cam.isOrthographicCamera){
      v.set(ndc.x, ndc.y, 0).unproject(cam);
      cam.zoom = Math.max(c.minZoom, Math.min(c.maxZoom, cam.zoom / k)); cam.updateProjectionMatrix();
      if (c.zoomToCursor !== false){ w.set(ndc.x, ndc.y, 0).unproject(cam); v.sub(w); cam.position.add(v); c.target.add(v); }
    } else {
      const dist = cam.position.distanceTo(c.target), nd = Math.max(c.minDistance, Math.min(c.maxDistance, dist * k));
      const hit = () => { rc.setFromCamera(ndc, cam); return rc.ray.intersectPlane(pl, new THREE.Vector3()); };
      if (c.zoomToCursor){ cam.getWorldDirection(w); pl.setFromNormalAndCoplanarPoint(w, c.target); }
      const p0 = c.zoomToCursor ? hit() : null;
      v.subVectors(cam.position, c.target).setLength(nd); cam.position.copy(c.target).add(v); cam.updateMatrixWorld();
      const p1 = p0 && hit(); if (p0 && p1){ v.subVectors(p0, p1); cam.position.add(v); c.target.add(v); }
    }
    c.update();
  };
  /* glissement : chaque cran ajoute son zoom à une réserve, consommée en douceur sur ≈ 150 ms (même amplitude qu'avant, sans à-coup) */
  let pend = 0, pc = null, px = 0, py = 0, raf = 0, last = 0;
  const tick = now => { const dt = Math.min(50, now - (last || now)); last = now; if (!pc || Math.abs(pend) < 1e-4){ pend = 0; raf = 0; last = 0; return; }
    const part = Math.abs(pend) < 2e-3 ? pend : pend * (1 - Math.exp(-dt / 55));   /* fin du glissement : on applique le reste, le pas par cran est exact */ pend -= part; zoomBy(pc, Math.exp(part), px, py); raf = requestAnimationFrame(tick); };
  canvas.addEventListener('wheel', ev => {
    const c = ctls.find(x => x.enabled && x.enableZoom);
    if (!c || ev.defaultPrevented) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    let d = ev.deltaY * (ev.deltaMode === 1 ? 33 : ev.deltaMode === 2 ? 400 : 1);
    { const W = (window.PrismSettings?.wheel?.() || {k:1, inv:false}); d *= W.k * (W.inv ? -1 : 1); }   // Réglages : vitesse et sens de la molette
    if (!d || !isFinite(d)) return;
    if (ev.ctrlKey) d *= 2.5;         // pincement sur pavé tactile : petits écarts
    const n = Math.max(-1.5, Math.min(1.5, d / 100));   // au plus 1,5 cran par évènement
    const r = canvas.getBoundingClientRect();
    if (pc !== c) pend = 0; pc = c; px = ((ev.clientX - r.left) / r.width) * 2 - 1; py = -((ev.clientY - r.top) / r.height) * 2 + 1;
    pend += Math.abs(n) * Math.log(STEP) * (n < 0 ? 1 : -1);   // < 0 : rapprocher
    pend = Math.max(-1.2, Math.min(1.2, pend));                   // molette lancée très vite : pas d'emballement
    if (!raf) raf = requestAnimationFrame(tick);
  }, {capture:true, passive:false});
})();
/* la molette au-dessus d'une bulle ou d'une étiquette zoome quand même la vue */
document.getElementById('labels')?.addEventListener('wheel', ev => { ev.preventDefault(); canvas.dispatchEvent(new WheelEvent('wheel', ev)); }, {passive:false});
