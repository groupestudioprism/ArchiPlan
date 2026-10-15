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
  canvas.addEventListener('wheel', ev => {
    const c = ctls.find(x => x.enabled && x.enableZoom);
    if (!c || ev.defaultPrevented) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    let d = ev.deltaY * (ev.deltaMode === 1 ? 33 : ev.deltaMode === 2 ? 400 : 1);
    if (!d || !isFinite(d)) return;
    if (ev.ctrlKey) d *= 2.5;         // pincement sur pavé tactile : petits écarts
    const n = Math.max(-1.5, Math.min(1.5, d / 100));   // au plus 1,5 cran par évènement
    const f = Math.pow(STEP, Math.abs(n)), zin = n < 0;
    const cam = c.object, r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    if (cam.isOrthographicCamera){
      v.set(ndc.x, ndc.y, 0).unproject(cam);
      cam.zoom = Math.max(c.minZoom, Math.min(c.maxZoom, zin ? cam.zoom / f : cam.zoom * f));
      cam.updateProjectionMatrix();
      if (c.zoomToCursor !== false){ w.set(ndc.x, ndc.y, 0).unproject(cam); v.sub(w); cam.position.add(v); c.target.add(v); }
    } else {
      const dist = cam.position.distanceTo(c.target);
      const nd = Math.max(c.minDistance, Math.min(c.maxDistance, zin ? dist * f : dist / f));
      const hit = () => { rc.setFromCamera(ndc, cam); return rc.ray.intersectPlane(pl, new THREE.Vector3()); };
      if (c.zoomToCursor){ cam.getWorldDirection(w); pl.setFromNormalAndCoplanarPoint(w, c.target); }
      const p0 = c.zoomToCursor ? hit() : null;
      v.subVectors(cam.position, c.target).setLength(nd); cam.position.copy(c.target).add(v);   // rapprocher / éloigner
      cam.updateMatrixWorld();
      const p1 = p0 && hit();
      if (p0 && p1){ v.subVectors(p0, p1); cam.position.add(v); c.target.add(v); }       // le point sous le curseur ne bouge pas
    }
    c.update();
  }, {capture:true, passive:false});
})();
