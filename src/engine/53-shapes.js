/* ============ Formes simples et composants maison (façon SketchUp) ============
   Outil Forme (B) : rectangle, cercle ou polygone tracé au sol ou sur une face, puis hauteur à la souris (on « tire » la forme)
   ou au clavier. Pousser/Tirer (U) ajuste ensuite la hauteur. « Créer un composant » regroupe les formes sélectionnées
   en une famille réutilisable (bibliothèque perso), redimensionnable par largeur / profondeur / hauteur. */

const SHAPE_NAMES = {rect:'Rectangle', circ:'Cercle', poly:'Polygone'};
const circlePts = (c, r, n = 48) => Array.from({length:n}, (_, i) => { const a = i / n * Math.PI * 2; return [Math.round((c[0] + r * Math.cos(a)) * 1000) / 1000, Math.round((c[1] + r * Math.sin(a)) * 1000) / 1000]; });
function shapeBase(a, b){
  const sh = defs.vol.shape || 'rect';
  if (sh === 'circ'){ const r = V.len(V.sub(b, a)); return r < 0.01 ? null : {poly:circlePts(a, r), shape:'circ', r}; }
  if (Math.abs(b[0] - a[0]) < 0.01 || Math.abs(b[1] - a[1]) < 0.01) return null;
  return {rect:[a, b]};
}
function volFrom(base, h, off){
  const e = {kind:'vol', mat:defs.vol.type, h:rnd(Math.max(0.01, h)), lvl:curLvl, off:rnd(off)};
  if (base.rect){ const r = rect(base.rect[0], base.rect[1]); e.p = r[0]; e.q = r[2]; }
  else { const xs = base.poly.map(p => p[0]), ys = base.poly.map(p => p[1]); e.p = [Math.min(...xs), Math.min(...ys)]; e.q = [Math.max(...xs), Math.max(...ys)]; e.poly = base.poly.map(p => [rnd(p[0]), rnd(p[1])]); if (base.shape) e.shape = base.shape; }
  return e;
}
/* étape « tirer » : la souris règle la hauteur, clic pour valider */
function startExtrude(base){
  const off = offFromZ();
  if (view === '2d'){ addEl(volFrom(base, defs.vol.h, off)); draw.workZ = null; return; }
  const fp = base.rect ? rect(base.rect[0], base.rect[1]) : base.poly, c = polyCentroid(fp), z0 = lvlZ(curLvl) + off;
  const p1 = toScreen(new THREE.Vector3(c[0], z0, -c[1])), p2 = toScreen(new THREE.Vector3(c[0], z0 + 1, -c[1])), ppm = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
  // forme dessinée sur le dessus d'une forme ou d'une dalle : on peut aussi la pousser vers le bas pour percer (trou ou poche)
  const host = draw.workZ != null ? state.els.find(e => (e.kind === 'vol' || e.kind === 'slab') && Math.abs(lvlZ(e.lvl) + (e.off || 0) + (e.kind === 'slab' ? slabT(e) : e.h) - draw.workZ) < 0.01 && ptInPoly(c[0], c[1], volPoly(e))) : null;
  draw.ext = {base, off, p1, dir:[(p2[0] - p1[0]) / ppm, (p2[1] - p1[1]) / ppm], ppm, h:defs.vol.h, z0, c, host:host?.id};
  draw.start = null; draw.poly = null; previewExtrude(); setPrompt();
}
function previewExtrude(){
  const x = draw.ext; if (!x) return; disposeGroup(previewGroup); disposeGroup(markGroup);
  drawSnapGlyph(null);
  if (x.h > 0) pieces(volFrom(x.base, x.h, x.off)).forEach(pc => previewGroup.add(pieceMesh(pc, true)));
  else { const fp = x.base.rect ? rect(x.base.rect[0], x.base.rect[1]) : x.base.poly; for (const zz of [x.z0, x.z0 + x.h]) for (let i = 0; i < fp.length; i++) markGroup.add(lineObj(fp[i], fp[(i + 1) % fp.length], '#C0392B', zz, false)); }
  const lv = $('#live'), s = toScreen(new THREE.Vector3(x.c[0], x.z0 + x.h, -x.c[1])), H = getEl(x.host); lv.textContent = x.h > 0 ? `H ${nf(x.h)} m` : H && (H.kind === 'slab' || -x.h >= H.h - 1e-3) ? `Trou traversant` : `Poche ${nf(-x.h)} m`; lv.style.left = s[0] + 'px'; lv.style.top = s[1] + 'px'; lv.hidden = false; dirty = true;
}
function endExtrude(h){ const x = draw.ext; if (!x) return; draw.ext = null; $('#live').hidden = true;
  if (h < 0 && x.host) carveHost(getEl(x.host), x.base, -h);
  else { if (h > 0) defs.vol.h = rnd(h); addEl(volFrom(x.base, h > 0 ? h : x.h, x.off)); }
  draw.workZ = null; updatePreview(); setPrompt(); }
/* percer : trou traversant (dalle, ou forme percée sur toute sa hauteur) ou poche (fond laissé en place) */
function carveHost(H, base, depth){
  if (!H) return; const fp = (base.rect ? rect(base.rect[0], base.rect[1]) : base.poly).map(p => [rnd(p[0]), rnd(p[1])]);
  pushHist(); (H.holes ??= []).push(fp);
  if (H.kind === 'vol' && depth < H.h - 1e-3){ const f = {kind:'vol', mat:H.mat, h:rnd(H.h - depth), lvl:H.lvl, off:H.off || 0, id:state.nextId++, p:[0, 0], q:[1, 1]}; const xs = fp.map(p => p[0]), ys = fp.map(p => p[1]); f.p = [Math.min(...xs), Math.min(...ys)]; f.q = [Math.max(...xs), Math.max(...ys)]; if (!isAxisRect(fp)) f.poly = fp; state.els.push(f); toast(`Poche de ${nf(depth)} m creusée`); }
  else toast(H.kind === 'slab' ? 'Trou percé dans la dalle' : 'Forme percée de part en part');
  state.isSample = false; rebuild();
}
let extDown = null;
canvas.addEventListener('pointermove', e => {
  if (!draw.ext || e.buttons) return; e.stopImmediatePropagation();
  const r = canvas.getBoundingClientRect(), x = draw.ext, mx = e.clientX - r.left - x.p1[0], my = e.clientY - r.top - x.p1[1];
  const v = (mx * x.dir[0] + my * x.dir[1]) / x.ppm, H = getEl(x.host), vv = SNAP.grid ? Math.round(v / step) * step : rnd(v);
  x.h = H ? (vv > -step / 2 && vv < step ? step : Math.max(vv, -(H.kind === 'slab' ? slabT(H) : H.h))) : Math.max(step, vv); previewExtrude();
}, {capture:true});
canvas.addEventListener('pointerdown', e => { if (draw.ext && e.button === 0){ extDown = [e.clientX, e.clientY]; } }, {capture:true});
canvas.addEventListener('pointerup', e => {
  if (!draw.ext || e.button !== 0 || !extDown) return; const moved = Math.hypot(e.clientX - extDown[0], e.clientY - extDown[1]); extDown = null;
  if (moved > 7) return; e.stopImmediatePropagation(); down = null; endExtrude(draw.ext.h);
}, {capture:true});
$('#cmd').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !draw.ext && (tool === 'vol' || tool === 'slab') && (draw.poly?.length || 0) >= 3 && !e.target.value.trim()){ e.preventDefault(); e.stopImmediatePropagation(); tool === 'vol' ? finishShapePoly() : finishSlabPoly(); return; }
  if (!draw.ext || e.key !== 'Enter') return; const v = num(e.target.value.replace(/^[hH]\s*/, ''));
  e.preventDefault(); e.stopImmediatePropagation(); e.target.value = ''; endExtrude(v > 0 || (v < 0 && draw.ext.host) ? v : draw.ext.h);
}, {capture:true});
document.addEventListener('keydown', e => { if (draw.ext && e.key === 'Escape'){ e.stopImmediatePropagation(); draw.ext = null; $('#live').hidden = true; disposeGroup(previewGroup); draw.workZ = null; setPrompt(); dirty = true; } }, {capture:true});
/* clic de l'outil Forme (appelé par placePoint) */
function shapeClick(pt){
  const sh = defs.vol.shape || 'rect';
  if (sh === 'poly'){
    draw.poly ??= [];
    if (draw.poly.length >= 3 && V.len(V.sub(pt, draw.poly[0])) < 0.05) return finishShapePoly();
    if (!draw.poly.length || V.len(V.sub(pt, draw.poly.at(-1))) > 0.01) draw.poly.push(pt.slice());
    draw.start = pt; updatePreview(); setPrompt(); return;
  }
  if (!draw.start){ draw.start = pt; return; }
  const b = shapeBase(draw.start, pt); if (!b){ toast(sh === 'circ' ? 'Rayon trop petit' : 'La forme doit avoir deux côtés non nuls'); return; }
  draw.start = null; startExtrude(b);
}
function finishShapePoly(){ const p = draw.poly || []; if (p.length < 3){ toast('Il faut au moins 3 points'); return; } draw.start = null; const pts = p.slice(); draw.poly = null; startExtrude({poly:pts, shape:'poly'}); }
function shapePreviewBase(){
  const sh = defs.vol.shape || 'rect', cur = draw.cursor; if (!cur) return null;
  if (sh === 'poly'){ const p = draw.poly || []; return p.length >= 2 ? {poly:[...p, cur]} : null; }
  return draw.start ? shapeBase(draw.start, cur) : null;
}

/* ---------- créer un composant à partir des formes sélectionnées ---------- */
function canMakeComp(ids){ return ids.some(id => getEl(id)?.kind === 'vol'); }
function openMakeComp(ids){
  const els = ids.map(getEl).filter(e => e && (e.kind === 'vol' || (e.kind === 'inst' && !e.host)));
  if (!els.some(e => e.kind === 'vol')) return toast('Sélectionnez au moins une forme (outil Forme)');
  const cats = ['Mobilier', 'Équipements', 'Aménagement extérieur', 'Structure', 'Industrie', 'Divers'];
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">${els.length} élément${els.length > 1 ? 's' : ''}</span><h3 class="ed-t2">Créer un composant</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><div class="fields"><label class="f wide"><span>Nom</span><span class="in"><input id="mcN" type="text" maxlength="40" value="Mon composant" style="font-family:var(--f-body)"></span></label>
      <label class="f wide"><span>Catégorie</span><span class="in"><select id="mcC">${cats.map(c => `<option>${c}</option>`).join('')}</select></span></label></div>
      <label class="f wide rchk"><input type="checkbox" id="mcR" checked> Remplacer la sélection par le composant</label>
      <p class="hint">Le composant rejoint votre bibliothèque (onglet Bibliothèque, Composants) : vous pourrez le poser autant de fois que vous voulez, changer sa largeur, sa profondeur et sa hauteur, ou l'ouvrir dans l'éditeur de familles.</p></div>
    <footer class="ed-f"><button class="btn" data-close>Annuler</button><button class="btn primary" id="mcOk">Créer</button></footer>`, 'small');
  d.querySelector('#mcN').select();
  d.querySelector('#mcOk').onclick = () => { const id = makeComponent(els, d.querySelector('#mcN').value.trim() || 'Mon composant', d.querySelector('#mcC').value, d.querySelector('#mcR').checked); closeEDlg(); if (id) toast('Composant créé : il est dans votre bibliothèque'); };
}
function makeComponent(els, nom, cat, replace = true){
  const R4 = v => Math.round(v * 1e4) / 1e4, lvl = els[0].lvl;
  const box = {x0:Infinity, y0:Infinity, x1:-Infinity, y1:-Infinity, z0:Infinity, z1:-Infinity};
  const grow = (x, y, z0, z1) => { box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); box.z0 = Math.min(box.z0, z0); box.z1 = Math.max(box.z1, z1); };
  for (const e of els){
    if (e.kind === 'vol'){ const z = lvlZ(e.lvl) + (e.off || 0); volPoly(e).forEach(p => grow(p[0], p[1], z, z + e.h)); }
    else for (const so of instSolids(e)){ const r = so.pts ? Math.max(...so.pts.map(p => Math.hypot(p[0], p[1]))) : so.r || Math.hypot(so.w || 0, so.d || 0) / 2; grow(so.c[0] - r, so.c[1] - r, so.c[2] - (so.h || 2 * r) / 2, so.c[2] + (so.h || 2 * r) / 2); grow(so.c[0] + r, so.c[1] + r, so.c[2], so.c[2]); }
  }
  const W = Math.max(0.01, box.x1 - box.x0), D = Math.max(0.01, box.y1 - box.y0), H = Math.max(0.01, box.z1 - box.z0);
  const parts = [];
  for (const e of els){
    if (e.kind === 'vol'){ const z = lvlZ(e.lvl) + (e.off || 0) - box.z0;
      parts.push({s:'ext', m:e.mat, pts:volPoly(e).map(p => [R4((p[0] - box.x0) / W), R4((p[1] - box.y0) / D)]), z:`h*${R4(z / H)}`, h:`h*${R4(e.h / H)}`}); }
    else { const fr = instFrame(e); parts.push({fam:e.fam, type:e.type | 0, x:`w*${R4((fr.o[0] - box.x0) / W - 0.5)}`, y:`d*${R4((fr.o[1] - box.y0) / D - 0.5)}`, z:`h*${R4((fr.z - box.z0) / H)}`, rot:String(e.rot || 0), p:{...(e.params || {})}}); }
  }
  const F = {nom:nom.slice(0, 40), cat, host:'free', made:'formes', params:{w:{v:rnd(W), label:'Largeur', unit:'m'}, d:{v:rnd(D), label:'Profondeur', unit:'m'}, h:{v:rnd(H), label:'Hauteur', unit:'m'}}, types:[{nom:'Standard', p:{}}], parts};
  const fid = 'F-' + uid8(); USER_LIB.fams[fid] = F; saveUserLib();
  pushHist();
  const inst = {kind:'inst', fam:fid, type:0, params:{}, c:[rnd((box.x0 + box.x1) / 2), rnd((box.y0 + box.y1) / 2)], rot:0, lvl, off:rnd(box.z0 - lvlZ(lvl))};
  if (replace) removeEls(els.map(e => e.id));
  inst.id = state.nextId++; state.els.push(inst); state.isSample = false; embedUsedLib();
  sel = replace ? inst.id : sel; multi = replace ? [] : multi; rebuild(); fxCache?.clear?.();
  return fid;
}
