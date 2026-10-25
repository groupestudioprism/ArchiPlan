/* ============ Revêtements et textures à l'échelle (façon SketchUp) ============
   - Chaque matériau a une taille de motif (texScale, m) et une rotation (texRot, °), réglables dans sa fiche ; les UV de toute
     la maquette sont « monde », donc un motif de 0,50 m mesure 0,50 m sur un mur droit, en diagonale, sur une dalle ou un toit.
   - Un élément peut recevoir un revêtement d'affichage : el.paint {m, s, r} (forme, poteau, escalier, toiture, dessus d'une dalle),
     el.paintUnder (sous-face d'une dalle), el.paintOut / el.paintIn (faces extérieure / intérieure d'un mur), el.paintMap
     (composant : par matériau d'origine). Affichage seulement : composition, thermique, DQE et IFC restent la vérité.
     Un mur ou une dalle peints reçoivent une fine pellicule (1,5 mm) qui suit les ouvertures et le chapeau sous toiture ; les
     tableaux des baies suivent la face extérieure.
   - Outil Peindre (X) : pot de peinture sur une face ; Alt + clic (ou le mode Pipette, au doigt) reprend le matériau et son échelle. */
const PAINT_KEYS = ['paint', 'paintUnder', 'paintOut', 'paintIn'];
const paintOf = p => p && typeof p === 'object' && p.m && libMats()[p.m] ? p : null;
const paintTr = p => p ? {s:p.s > 0 ? +p.s : 0, r:+p.r || 0} : null;
const finOf = p => { p = paintOf(p); return p ? {m:p.m, tr:paintTr(p)} : null; };
/* matériau affiché d'une pièce d'élément (null = matériau réel) */
function pieceFinish(el, pc){
  if (pc.coat) return null;
  if (el.kind === 'wall') return pc.reveal ? finOf(el.paintOut) : null;
  if (el.kind === 'roof') return pc.roof && pc.li === 0 ? finOf(el.paint) : null;
  if (el.kind === 'slab') return null;
  return finOf(el.paint);
}
const instFinish = (el, m) => finOf(el.paintMap?.[m]);
/* pellicules de revêtement : faces d'un mur, dessus et dessous d'une dalle */
const COAT = 0.0015;
function wallCoat(el, side, p){
  const T = wallT(el), els = state.els, z = lvlZ(el.lvl) + (el.off || 0), tr = paintTr(p), out = [], m = p.m;
  const minus = (side === 'ext') === !el.flip;   // face extérieure = côté −n tant que les faces ne sont pas inversées
  const s1 = minus ? -T / 2 - COAT : T / 2, s2 = s1 + COAT;
  if (wallArc(el)){ out.push({mat:m, poly:[...arcPts(el, s1), ...arcPts(el, s2).reverse()], base:z, h:el.h, coat:true, tr}); return out; }
  const {u, n, L} = wallAxis(el), ops = wallOpenings(el, els);
  const P0 = endPt(el, true, s1, els), P1 = endPt(el, false, s1, els), P2 = endPt(el, false, s2, els), P3 = endPt(el, true, s2, els);
  const at = (t, off) => V.add(V.add(el.a, V.mul(u, t)), V.mul(n, off)), sideAt = t => t <= 0 ? [P0, P3] : t >= L ? [P1, P2] : [at(t, s1), at(t, s2)];
  const bounds = [0]; ops.forEach(o => bounds.push(o.t0, o.t1)); bounds.push(L);
  for (let k = 0; k < bounds.length - 1; k++){
    const ta = bounds[k], tb = bounds[k + 1]; if (tb - ta < 1e-5) continue;
    const [la1, la2] = sideAt(ta), [lb1, lb2] = sideAt(tb), poly = [la1, lb1, lb2, la2], op = k % 2 === 1 ? ops[(k - 1) / 2] : null;
    if (!op) out.push({mat:m, poly, base:z, h:el.h, coat:true, tr});
    else { if (op.z0 > 0.001) out.push({mat:m, poly, base:z, h:op.z0, coat:true, tr}); if (el.h - op.z1 > 0.001) out.push({mat:m, poly, base:z + op.z1, h:el.h - op.z1, coat:true, tr}); }
  }
  if (el.top === 'roof'){   // chapeau sous la toiture : mêmes bandes que wallCapPieces
    const P = wallRoofProfile(el); if (P){ const zTop = z + el.h;
      for (let i = 0; i + 1 < P.pts.length; i++){
        const [t0, z0] = P.pts[i], [t1, z1] = P.pts[i + 1]; if (Math.max(z0, z1) - zTop < 0.002 || t1 - t0 < 1e-4) continue;
        const a = at(t0, s1), b = at(t1, s1), top = [[a[0], a[1], zTop], [b[0], b[1], zTop], [b[0], b[1], Math.max(zTop, z1)], [a[0], a[1], Math.max(zTop, z0)]];
        out.push({mat:m, poly:[a, b, at(t1, s2), at(t0, s2)], top, ext:[n[0] * COAT, n[1] * COAT, 0], base:zTop, h:0, coat:true, tr});
      } }
  }
  return out;
}
function paintCoats(el){
  const out = [];
  if (el.kind === 'wall'){ for (const [k, side] of [['paintOut', 'ext'], ['paintIn', 'int']]){ const p = paintOf(el[k]); if (p) try { out.push(...wallCoat(el, side, p)); } catch(e){ console.warn('revêtement', e); } } }
  else if (el.kind === 'slab'){
    const z = lvlZ(el.lvl) + (el.off || 0), P = volPoly(el), holes = slabHoles(el).concat(el.holes || []), pt = paintOf(el.paint), pu = paintOf(el.paintUnder);
    if (pt) out.push({mat:pt.m, poly:P, holes, base:z + slabT(el), h:COAT, coat:true, tr:paintTr(pt)});
    if (pu) out.push({mat:pu.m, poly:P, holes, base:z - COAT, h:COAT, coat:true, tr:paintTr(pu)});
  }
  return out;
}

/* ---------- outil Peindre ---------- */
const paintHoverGroup = new THREE.Group(); paintHoverGroup.name = 'survol-peinture'; scene.add(paintHoverGroup);
let paintHoverKey = '';
function paintHoverClear(){ paintHoverGroup.clear(); paintHoverKey = ''; dirty = true; }
/* face visée : élément, maillage, normale et point (dans le monde) */
function paintHit(e){
  setNdc(e);
  const hits = ray.intersectObjects(modelGroup.children, true).filter(h => h.object.isMesh && h.object.material.visible !== false && !h.object.userData.isEdge);
  if (!hits.length) return null;
  const h = hits[0]; let o = h.object; while (o && o.userData.id === undefined) o = o.parent;
  const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
  return {id:o ? o.userData.id : null, obj:h.object, normal:n, point:h.point};
}
/* face d'un mur visée : 'ext' | 'int' | null (dessus, bout) */
function wallSideOf(el, normal){
  const n = wallAxis(el).n, d = normal.dot(new THREE.Vector3(n[0], 0, -n[1])); if (Math.abs(d) < 0.5) return null;
  return (d < 0) === !el.flip ? 'ext' : 'int';
}
function paintTargetKey(el, h){
  if (el.kind === 'wall'){ const s = wallSideOf(el, h.normal); return s ? (s === 'ext' ? 'paintOut' : 'paintIn') : null; }
  if (el.kind === 'slab') return h.normal.y < -0.5 ? 'paintUnder' : 'paint';
  if (el.kind === 'inst') return 'paintMap';
  return 'paint';
}
const paintLabel = (el, key) => key === 'paintOut' ? 'face extérieure' : key === 'paintIn' ? 'face intérieure' : key === 'paintUnder' ? 'sous-face' : el.kind === 'slab' ? 'dessus' : el.kind === 'inst' ? 'ce matériau' : 'tout l\'élément';
function paintHover(e){
  const h = paintHit(e), el = h?.id != null ? getEl(h.id) : null, key = el ? paintTargetKey(el, h) : null;
  const k = el && key ? `${el.id}|${key}|${h.obj.uuid}` : '';
  canvas.style.cursor = el && key ? (defs.paint.pip || e.altKey ? 'copy' : 'cell') : 'not-allowed';
  if (k === paintHoverKey) return; paintHoverGroup.clear(); paintHoverKey = k;
  if (el && key){
    const set = el.kind === 'inst' ? [h.obj] : [];   // mur / dalle : toutes les pièces de la face visée ; composant : le matériau visé
    if (el.kind !== 'inst'){ let g = h.obj; while (g && g.userData.id === undefined) g = g.parent;
      g?.traverse(o => { if (!o.isMesh || o.userData.isEdge) return;
        if (el.kind === 'wall' || el.kind === 'slab'){ if (o.userData.coat) return; } set.push(o); }); }
    for (const o of set){ const m = new THREE.Mesh(o.geometry, hoverMat); m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.renderOrder = 5; paintHoverGroup.add(m); }
    const lv = $('#live'); lv.textContent = `${el.kind === 'inst' ? (fam(el.fam)?.nom || 'Composant') : KIND_NAME[el.kind]} ${el.id} · ${paintLabel(el, key)}${defs.paint.pip || e.altKey ? ' · pipette' : ''}`;
    const r = canvas.getBoundingClientRect(); lv.style.left = (e.clientX - r.left + 14) + 'px'; lv.style.top = (e.clientY - r.top + 18) + 'px'; lv.hidden = false;
  } else $('#live').hidden = true;
  dirty = true;
}
function paintValue(){ const P = defs.paint; if (!P.m || !libMats()[P.m]) return null; const v = {m:P.m}; if (P.s > 0) v.s = +P.s; if (P.r) v.r = +P.r; return v; }
function paintPick(e){
  const h = paintHit(e); if (!h || h.id == null){ toast('Cliquez une face de la maquette'); return; }
  const el = getEl(h.id); if (!el) return;
  const key = paintTargetKey(el, h); if (!key){ toast('Cliquez une face du mur (pas le dessus ni le bout)'); return; }
  if (e.altKey || defs.paint.pip){   // pipette : matériau affiché, avec son échelle
    const ud = h.obj.userData, m = ud.mat; if (!m || !libMats()[m]) return;
    const tr = ud.tr || {}; defs.paint.m = m; defs.paint.s = tr.s > 0 ? +tr.s : (libMats()[m].texScale > 0 ? +libMats()[m].texScale : 0); defs.paint.r = tr.r || libMats()[m].texRot || 0;
    if (defs.paint.pip){ defs.paint.pip = false; }
    syncHud(); toast(`Pipette : ${libMats()[m].nom}`); return;
  }
  const v = paintValue();
  pushHist();
  if (key === 'paintMap'){ const src = h.obj.userData.src || h.obj.userData.mat; const map = {...(el.paintMap || {})}; if (v) map[src] = v; else delete map[src]; if (Object.keys(map).length) el.paintMap = map; else delete el.paintMap; }
  else if (v) el[key] = v; else delete el[key];
  state.isSample = false; paintHoverClear(); rebuild({noPanel:sel !== el.id});
  toast(v ? `${libMats()[v.m].nom} appliqué (${paintLabel(el, key)})` : `Revêtement retiré (${paintLabel(el, key)})`);
}
/* pilule de l'outil : matériau, taille du motif, rotation, pipette */
function paintMatOptions(cur){
  const by = {}; for (const [k, m] of Object.entries(libMats())) if (!m.R && m.cat !== "Lames d'air et divers") (by[m.cat || 'Divers'] ??= []).push([k, m.nom]);
  const cats = Object.keys(by).sort((a, b) => (a === 'Peintures et finitions' ? -1 : b === 'Peintures et finitions' ? 1 : a.localeCompare(b, 'fr')));
  return `<option value="">Retirer le revêtement (matériau d'origine)</option>` + cats.map(c => `<optgroup label="${esc(c)}">${by[c].sort((a, b) => a[1].localeCompare(b[1], 'fr')).map(([k, n]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('');
}
function paintHud(){
  const pill = $('#paintPill'); if (!pill) return; pill.hidden = tool !== 'paint'; if (tool !== 'paint'){ paintHoverClear(); return; }
  const P = defs.paint, sel = $('#paintMat'); if (sel.dataset.n !== String(Object.keys(libMats()).length) || sel.value !== (P.m || '')){ sel.innerHTML = paintMatOptions(P.m); sel.dataset.n = String(Object.keys(libMats()).length); sel.value = P.m || ''; }
  const m = P.m ? libMats()[P.m] : null; $('#paintScale').value = P.s > 0 ? P.s : ''; $('#paintScale').placeholder = m ? nf(texNat(m)[0]) : '—'; $('#paintScale').disabled = !m || !m.tex || m.tex === 'glass';
  $('#paintRot').value = String(P.r || 0); $('#paintPip').classList.toggle('on', !!P.pip); $('#paintPip').setAttribute('aria-pressed', String(!!P.pip));
}
/* ---------- propriétés : revêtements d'un élément ---------- */
function paintFields(el){
  const keys = el.kind === 'wall' ? [['paintOut', 'Revêtement extérieur'], ['paintIn', 'Revêtement intérieur']] : el.kind === 'slab' ? [['paint', 'Revêtement du dessus'], ['paintUnder', 'Revêtement de la sous-face']] : el.kind === 'inst' ? [] : [['paint', 'Revêtement']];
  let h = '';
  for (const [k, label] of keys){
    const p = paintOf(el[k]), m = p ? libMats()[p.m] : null;
    h += `<label class="f wide"><span>${label}</span><span class="in"><select data-f="${k}">${paintMatOptions(p?.m || '')}</select></span></label>`;
    if (p) h += `<label class="f"><span>Taille du motif</span><span class="in"><input data-f="${k}.s" type="number" step="0.05" min="0.05" value="${p.s > 0 ? p.s : ''}" placeholder="${m ? nf(texNat(m)[0]) : ''}"><em>m</em></span></label><label class="f"><span>Rotation</span><span class="in"><input data-f="${k}.r" type="number" step="15" value="${p.r || 0}"><em>°</em></span></label>`;
  }
  if (el.kind === 'inst' && el.paintMap && Object.keys(el.paintMap).length){
    h += `<div class="f wide"><span>Revêtements du composant</span><div class="chips">${Object.entries(el.paintMap).map(([src, p]) => `<span class="chip">${esc(libMats()[src]?.nom || src)} → <b>${esc(libMats()[p.m]?.nom || p.m)}</b> <button type="button" class="x" data-act="paint-unmap" data-src="${esc(src)}" title="Retirer">×</button></span>`).join('')}</div></div>`;
  }
  return h;
}
/* changement d'un champ data-f="paint…" (appelé par le panneau) */
function setPaintField(el, f, t){
  const [key, sub] = f.split('.');
  if (key === 'paintMap'){ const map = {...(el.paintMap || {})}; delete map[sub]; if (Object.keys(map).length) el.paintMap = map; else delete el.paintMap; return; }
  if (!sub){ const m = t.value; if (!m || !libMats()[m]) delete el[key]; else el[key] = {...(paintOf(el[key]) || {}), m}; return; }
  const p = paintOf(el[key]); if (!p) return; const v = num(t.value);
  if (sub === 's'){ if (v > 0) p.s = v; else delete p.s; } else if (sub === 'r'){ if (v) p.r = v; else delete p.r; }
}
/* toutes les occurrences d'un revêtement (pour la bibliothèque : « utilisé dans n éléments ») */
function paintUses(mid){ let n = 0; for (const el of state?.els || []){ for (const k of PAINT_KEYS) if (el[k]?.m === mid) n++; if (el.paintMap) for (const p of Object.values(el.paintMap)) if (p?.m === mid) n++; } return n; }
