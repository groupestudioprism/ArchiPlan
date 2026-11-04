/* ============ Cotations libres ============
   Outil Cote (Q) : premier point, second point, puis position de la ligne de cote (décalage). Les cotes sont enregistrées
   dans le projet (state.dims), dessinées sur le plan du niveau et reprises sur les planches. Modes : alignée, horizontale, verticale, cumul (chaîne + total), automatique (clic sur un mur), suppression ; clic sur une valeur : supprimer. */
const dimGroup = new THREE.Group(); dimGroup.name = 'cotes'; scene.add(dimGroup);
let dimMode = 'align';
const DIM_MODES = [['align', 'Alignée'], ['h', 'Horizontale'], ['v', 'Verticale'], ['chain', 'Cumul'], ['auto', 'Auto (mur)'], ['del', 'Supprimer']];
/* géométrie d'une cote : ax = 'h' | 'v' (projection sur un axe) ou absent (alignée sur a→b) */
const dimGeom = (a, b, off, ax) => {
  let u, n, A, B, L;
  if (ax === 'h'){ u = [Math.sign(b[0] - a[0]) || 1, 0]; n = [0, 1]; L = Math.abs(b[0] - a[0]); A = [a[0], a[1] + off]; B = [b[0], a[1] + off]; }
  else if (ax === 'v'){ u = [0, Math.sign(b[1] - a[1]) || 1]; n = [1, 0]; L = Math.abs(b[1] - a[1]); A = [a[0] + off, a[1]]; B = [a[0] + off, b[1]]; }
  else { const d = V.sub(b, a); L = V.len(d) || 1e-9; u = V.mul(d, 1 / L); n = [-u[1], u[0]]; A = V.add(a, V.mul(n, off)); B = V.add(b, V.mul(n, off)); }
  return {L, u, n, A, B};
};
function dimLines(a, b, off, col, z, ax){
  const {u, n, A, B} = dimGeom(a, b, off, ax), out = [], t = V.mul(V.add(u, n), 0.11);
  out.push(lineObj(A, B, col, z, false));
  for (const [P, Q] of [[a, A], [b, B]]){ const e = V.sub(Q, P), l = V.len(e); if (l > 0.02){ const w = V.mul(e, 1 / l); out.push(lineObj(V.add(P, V.mul(w, 0.08)), V.add(Q, V.mul(w, 0.12)), col, z, false)); } }
  for (const P of [A, B]) out.push(lineObj(V.sub(P, t), V.add(P, t), col, z, false));   // traits obliques d'architecte
  return out;
}
function buildDims(){
  disposeGroup(dimGroup); const col = '#1F2937';
  for (const d of state?.dims || []) if (d.lvl === curLvl && view !== 'sec') dimLines(d.a, d.b, d.off, col, lvlZ(d.lvl) + 0.03, d.ax).forEach(l => dimGroup.add(l));
  dirty = true;
}
function delDim(d){ pushHist(); state.dims = state.dims.filter(x => x !== d); state.isSample = false; rebuild({noPanel:true}); toast('Cote supprimée (Ctrl+Z pour annuler)'); }
function dimLabelsInto(box){
  for (const d of state?.dims || []){ if (d.lvl !== curLvl || view === 'sec') continue;
    const {L, A, B} = dimGeom(d.a, d.b, d.off, d.ax), m = V.mul(V.add(A, B), 0.5), el = document.createElement('div');
    el.className = 'dim cote' + (d.tot ? ' tot' : ''); el.textContent = lenNum(L); el.title = 'Cote · cliquer pour la supprimer';
    el.onclick = ev => { ev.stopPropagation(); if (tool !== 'select' && tool !== 'dim') return; delDim(d); };
    box.appendChild(el); labels.push({d:el, pos:new THREE.Vector3(m[0], lvlZ(d.lvl) + 0.03, -m[1])});
  }
}
const dimOff = (a, b, pt, ax) => ax === 'h' ? rnd(pt[1] - a[1]) : ax === 'v' ? rnd(pt[0] - a[0]) : rnd(V.dot(V.sub(pt, a), dimGeom(a, b, 0).n));
const dimId = () => 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const dimPush = ds => { pushHist(); (state.dims ??= []).push(...ds); state.isSample = false; rebuild({noPanel:true}); };
function distSeg(p, a, b){ const d = V.sub(b, a), l2 = V.dot(d, d) || 1e-9, t = clamp(V.dot(V.sub(p, a), d) / l2, 0, 1); return V.len(V.sub(p, V.add(a, V.mul(d, t)))); }
function dimBarSync(){
  let bar = $('#dimBar');
  if (tool !== 'dim'){ if (bar) bar.hidden = true; return; }
  if (!bar){ bar = document.createElement('div'); bar.id = 'dimBar'; bar.className = 'dimbar'; vpEl.appendChild(bar);
    bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.dm){ dimMode = b.dataset.dm; draw.start = null; draw.dimB = null; draw.dimPts = null; draw.dimOff = false; dimBarSync(); setPrompt(); updatePreview(); }
      else if (b.dataset.da === 'auto-lvl') dimAutoLevel(); else if (b.dataset.da === 'clear-lvl') dimClear(false); else if (b.dataset.da === 'clear-all') dimClear(true); }); }
  bar.hidden = false; const n = (state.dims || []).filter(d => d.lvl === curLvl).length;
  bar.innerHTML = `<div class="seg">${DIM_MODES.map(([k, t]) => `<button type="button" data-dm="${k}" class="${k === dimMode ? 'on' : ''}">${t}</button>`).join('')}</div>
    <span class="sep"></span><button type="button" class="sm" data-da="auto-lvl" title="Ajoute les cotes de chaînes et le total sur le pourtour du niveau">Cotes auto du niveau</button>
    <button type="button" class="sm" data-da="clear-lvl"${n ? '' : ' disabled'} title="Supprime les cotes libres de ce niveau">Effacer ce niveau (${n})</button>
    <button type="button" class="sm" data-da="clear-all"${state.dims?.length ? '' : ' disabled'}>Tout effacer</button>`;
  $('#labels').classList.toggle('dimbusy', !!(draw.start || draw.dimPts));
}
function dimClear(all){
  const n = (state.dims || []).filter(d => all || d.lvl === curLvl).length; if (!n) return;
  pushHist(); state.dims = (state.dims || []).filter(d => !(all || d.lvl === curLvl)); state.isSample = false; rebuild({noPanel:true}); dimBarSync(); toast(`${n} cote${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''} (Ctrl+Z pour annuler)`);
}
function dimAutoLevel(){
  const W = state.els.filter(e => e.kind === 'wall' && e.lvl === curLvl); if (!W.length) return toast('Aucun mur sur ce niveau');
  const xs = [...new Set(W.flatMap(w => [w.a[0], w.b[0]]).map(v => rnd(v, 2)))].sort((p, q) => p - q), ys = [...new Set(W.flatMap(w => [w.a[1], w.b[1]]).map(v => rnd(v, 2)))].sort((p, q) => p - q);
  const x0 = xs[0], x1 = xs.at(-1), y0 = ys[0], y1 = ys.at(-1), out = [], mk = (a, b, ax, off, tot) => out.push({id:dimId(), a, b, off:rnd(off), ax, lvl:curLvl, ...(tot ? {tot:true} : {})});
  const T = Math.max(...W.map(w => wallT(w))), o1 = T / 2 + 0.5, o2 = o1 + 0.5;
  for (let i = 0; i + 1 < xs.length; i++) if (xs[i + 1] - xs[i] > 0.05) mk([xs[i], y0], [xs[i + 1], y0], 'h', -o1);
  if (xs.length > 2) mk([x0, y0], [x1, y0], 'h', -o2, true);
  for (let i = 0; i + 1 < ys.length; i++) if (ys[i + 1] - ys[i] > 0.05) mk([x0, ys[i]], [x0, ys[i + 1]], 'v', -o1);
  if (ys.length > 2) mk([x0, y0], [x0, y1], 'v', -o2, true);
  if (xs.length <= 2 && ys.length <= 2){ mk([x0, y0], [x1, y0], 'h', -o1); mk([x0, y0], [x0, y1], 'v', -o1); }
  dimPush(out); dimBarSync(); toast(`${out.length} cotes ajoutées`);
}
function dimFinishChain(pt){
  const P = draw.dimPts, a0 = P[0], an = P.at(-1), ax = Math.abs(an[0] - a0[0]) >= Math.abs(an[1] - a0[1]) ? 'h' : 'v', line = ax === 'h' ? pt[1] : pt[0], out = [];
  for (let i = 0; i + 1 < P.length; i++){ const a = P[i], b = P[i + 1]; if ((ax === 'h' ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1])) < 0.01) continue; out.push({id:dimId(), a, b, off:rnd(line - (ax === 'h' ? a[1] : a[0])), ax, lvl:curLvl}); }
  if (P.length > 2){ const sgn = line >= (ax === 'h' ? a0[1] : a0[0]) ? 1 : -1; out.push({id:dimId(), a:a0, b:an, off:rnd(line - (ax === 'h' ? a0[1] : a0[0]) + sgn * 0.45), ax, lvl:curLvl, tot:true}); }
  draw.dimPts = null; draw.dimOff = false; if (out.length) dimPush(out); dimBarSync(); setPrompt();
}
function dimClick(pt){
  if (dimMode === 'del'){ let best = null, bd = 0.35; for (const d of state.dims || []){ if (d.lvl !== curLvl) continue; const {A, B} = dimGeom(d.a, d.b, d.off, d.ax), x = Math.min(distSeg(pt, A, B), distSeg(pt, d.a, A), distSeg(pt, d.b, B)); if (x < bd){ bd = x; best = d; } } if (best) delDim(best); else toast('Cliquez sur une ligne de cote pour la supprimer'); return; }
  if (dimMode === 'auto'){
    let best = null, bd = 0.5; for (const w of state.els) if (w.kind === 'wall' && w.lvl === curLvl){ const x = distSeg(pt, w.a, w.b); if (x < bd){ bd = x; best = w; } }
    if (!best) return toast('Cliquez sur un mur pour coter sa longueur');
    const {n} = wallAxis(best), m = V.mul(V.add(best.a, best.b), .5), s = V.dot(V.sub(pt, m), n) >= 0 ? 1 : -1;
    return dimPush([{id:dimId(), a:best.a.slice(), b:best.b.slice(), off:rnd(s * (wallT(best) / 2 + 0.4)), lvl:curLvl}]); }
  if (dimMode === 'chain'){
    if (draw.dimOff){ return dimFinishChain(pt); }
    const P = draw.dimPts ??= []; if (P.length && V.len(V.sub(pt, P.at(-1))) < 0.01){ if (P.length >= 2){ draw.dimOff = true; setPrompt(); } return; }
    P.push(pt.slice()); setPrompt(); dimBarSync(); return; }
  const ax = dimMode === 'h' || dimMode === 'v' ? dimMode : undefined;
  if (!draw.start){ draw.start = pt; draw.dimB = null; setPrompt(); dimBarSync(); return; }
  if (!draw.dimB){ if (V.len(V.sub(pt, draw.start)) < 0.01) return; draw.dimB = pt; setPrompt(); return; }
  const a = draw.start.slice(), b = draw.dimB.slice(); draw.start = null; draw.dimB = null;
  dimPush([{id:dimId(), a, b, off:dimOff(a, b, pt, ax), ...(ax ? {ax} : {}), lvl:curLvl}]); setPrompt(); dimBarSync();
}
const dimPrompt = () => dimMode === 'del' ? '<b>Cote</b> : cliquez sur une ligne de cote pour la supprimer' : dimMode === 'auto' ? '<b>Cote auto</b> : cliquez sur un mur (le côté du clic fixe la position)'
  : dimMode === 'chain' ? (draw.dimOff ? '<b>Cumul</b> : position de la ligne de cote' : !draw.dimPts?.length ? '<b>Cumul</b> : premier point' : `<b>Cumul</b> : point suivant (${draw.dimPts.length}) · <kbd>Entrée</kbd> ou re-cliquer le dernier point pour placer la ligne`)
  : !draw.start ? '<b>Cote</b> : premier point' : !draw.dimB ? '<b>Cote</b> : second point' : '<b>Cote</b> : position de la ligne de cote';
function previewDim(cur, ac){
  if (dimMode === 'del' || dimMode === 'auto') return `x ${lenNum(cur[0])} · y ${lenNum(cur[1])}`;
  if (dimMode === 'chain'){
    const P = draw.dimPts || []; if (!P.length) return `x ${lenNum(cur[0])} · y ${lenNum(cur[1])}`;
    P.forEach((p, i) => { markGroup.add(makeMarker(p, ac)); if (i) markGroup.add(lineObj(P[i - 1], p, ac)); });
    if (draw.dimOff){ const a0 = P[0], an = P.at(-1), ax = Math.abs(an[0] - a0[0]) >= Math.abs(an[1] - a0[1]) ? 'h' : 'v', line = ax === 'h' ? cur[1] : cur[0];
      for (let i = 0; i + 1 < P.length; i++) dimLines(P[i], P[i + 1], line - (ax === 'h' ? P[i][1] : P[i][0]), ac, undefined, ax).forEach(l => markGroup.add(l)); return `${lenTxt(V.len(V.sub(an, a0)))} · cliquez pour placer`; }
    markGroup.add(lineObj(P.at(-1), cur, ac)); return lenTxt(V.len(V.sub(cur, P.at(-1)))) + ' · total ' + lenTxt(V.len(V.sub(cur, P[0])));
  }
  const ax = dimMode === 'h' || dimMode === 'v' ? dimMode : undefined;
  if (!draw.start) return `x ${lenNum(cur[0])} · y ${lenNum(cur[1])}`;
  if (!draw.dimB){ markGroup.add(makeMarker(draw.start, ac)); markGroup.add(lineObj(draw.start, cur, ac)); const d = V.sub(cur, draw.start); return lenTxt(ax === 'h' ? Math.abs(d[0]) : ax === 'v' ? Math.abs(d[1]) : V.len(d)); }
  const off = dimOff(draw.start, draw.dimB, cur, ax), {L} = dimGeom(draw.start, draw.dimB, 0, ax);
  dimLines(draw.start, draw.dimB, off, ac, undefined, ax).forEach(l => markGroup.add(l)); return `${lenTxt(L)} · cliquez pour placer la cote`;
}
