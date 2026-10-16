/* ============ Qualité du rendu réaliste : occlusion ambiante (GTAO), anticrénelage (SMAA / SSAA), ombres fines ============
   À l'écran : chaîne de post-traitement quand le style Réaliste est actif. À l'export « haute qualité » : 4K, 16 passes de
   suréchantillonnage, ombres 8192 px, occlusion ambiante, puis retour aux réglages de l'écran. */
let fxq = null;
const fxOn = () => DISPLAY.style === 'realistic' && (view === '3d' || view === 'render') && DISPLAY.fx !== false;
function fxBuild(){
  const w = vpEl.clientWidth || 800, h = vpEl.clientHeight || 600, c = new EffectComposer(renderer);
  const rp = new RenderPass(scene, persp), ao = new GTAOPass(scene, persp, w, h); ao.updateGtaoMaterial({radius:0.6, distanceExponent:1.5, thickness:1.5, scale:1.1, samples:12}); ao.blendIntensity = 0.85;
  const aa = new SMAAPass(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()), out = new OutputPass();
  c.addPass(rp); c.addPass(ao); c.addPass(aa); c.addPass(out);
  return fxq = {c, rp, ao, aa, out};
}
function fxResize(w, h){ if (!fxq) return; fxq.c.setPixelRatio(renderer.getPixelRatio()); fxq.c.setSize(w, h); fxq.ao.setSize(w, h); }
function renderFrame(){
  if (fxOn()){ try { (fxq || fxBuild()).c.render(); return; } catch(e){ console.warn('[ARCHIPLAN] post-traitement indisponible', e); DISPLAY.fx = false; } }
  renderer.render(scene, cam());
}
let hqPrev = null;
async function renderHQ(w, h, k){
  const real = DISPLAY.style === 'realistic';
  hqPrev = {style:DISPLAY.style, shadow:sun.shadow.mapSize.x};
  if (!real){ DISPLAY.style = 'realistic'; resetMats(); applyThemeToScene(); rebuild({noPanel:true}); }
  if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } sun.shadow.mapSize.set(8192, 8192); sun.shadow.needsUpdate = true;
  const c = new EffectComposer(renderer), ss = new SSAARenderPass(scene, persp, 0x000000, 0); ss.sampleLevel = 4; ss.unbiased = true;
  const ao = new GTAOPass(scene, persp, w * k, h * k); ao.updateGtaoMaterial({radius:0.6, distanceExponent:1.5, thickness:1.5, scale:1.15, samples:24}); ao.blendIntensity = 0.9;
  c.setPixelRatio(k); c.setSize(w, h); c.addPass(ss); c.addPass(ao); c.addPass(new OutputPass());
  await new Promise(r => requestAnimationFrame(r));
  c.render(); hqPrev.c = c;
}
function endHQ(){
  if (!hqPrev) return; const p = hqPrev; hqPrev = null; p.c?.dispose?.();
  if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } sun.shadow.mapSize.set(p.shadow, p.shadow);
  if (p.style !== DISPLAY.style){ DISPLAY.style = p.style; resetMats(); applyThemeToScene(); rebuild({noPanel:true}); }
  dirty = true;
}
/* ---------- Résolution adaptative (qualité « Auto » sur téléphone et tablette) ----------
   On démarre à 1× (prudent) puis, pendant que l'on manipule la vue, on mesure la cadence des images : si l'appareil reste
   fluide (< 19 ms par image), la netteté monte d'un cran (1× → 1,5× → 2×, jamais au-delà de l'écran) ; s'il peine
   (> 30 ms), elle redescend et ne remonte plus pendant la session. Le cran retenu est mémorisé pour cet appareil. */
const ADAPT = {steps:[1, 1.5, 2], i:0, cap:2, t:[], last:0};
const adaptOn = () => APP_PREFS.gfx === 'auto' && LOWPOW;
try { const k = ADAPT.steps.indexOf(+localStorage.getItem('ap.gfxpr')); if (k >= 0) ADAPT.i = k; } catch(e){}
const adaptPR = () => Math.min(devicePixelRatio || 1, ADAPT.steps[ADAPT.i]);
if (adaptOn()) renderer.setPixelRatio(adaptPR());
function adaptTick(now, moving){
  if (!moving || !adaptOn()){ ADAPT.t.length = 0; ADAPT.last = 0; return; }
  if (ADAPT.last){ const dt = now - ADAPT.last; if (dt < 250) ADAPT.t.push(dt); }
  ADAPT.last = now;
  if (ADAPT.t.length < 45) return;
  const a = ADAPT.t.sort((x, y) => x - y), med = a[a.length >> 1]; ADAPT.t = [];
  let k = ADAPT.i;
  if (med < 19 && k + 1 <= ADAPT.cap && ADAPT.steps[k + 1] <= (devicePixelRatio || 1) + 0.01) k++;
  else if (med > 30 && k > 0){ k--; ADAPT.cap = k; }
  if (k === ADAPT.i) return;
  ADAPT.i = k; try { localStorage.setItem('ap.gfxpr', String(ADAPT.steps[k])); } catch(e){}
  const w = vpEl.clientWidth, h = vpEl.clientHeight; renderer.setPixelRatio(adaptPR()); if (w && h){ renderer.setSize(w, h, false); fxResize(w, h); }
  dirty = true;
}
