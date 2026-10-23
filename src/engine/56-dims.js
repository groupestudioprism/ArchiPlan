/* ============ Cotations libres ============
   Outil Cote (Q) : premier point, second point, puis position de la ligne de cote (décalage). Les cotes sont enregistrées
   dans le projet (state.dims), dessinées sur le plan du niveau et reprises sur les planches. Clic sur la valeur : supprimer. */
const dimGroup = new THREE.Group(); dimGroup.name = 'cotes'; scene.add(dimGroup);
const dimGeom = (a, b, off) => { const d = V.sub(b, a), L = V.len(d) || 1e-9, u = V.mul(d, 1 / L), n = [-u[1], u[0]]; return {L, u, n, A:V.add(a, V.mul(n, off)), B:V.add(b, V.mul(n, off))}; };
function dimLines(a, b, off, col, z){
  const {u, n, A, B} = dimGeom(a, b, off), s = Math.sign(off) || 1, out = [], k = 0.12, t = V.mul(V.add(u, n), 0.11);
  out.push(lineObj(A, B, col, z, false));
  if (Math.abs(off) > 0.02){ out.push(lineObj(V.add(a, V.mul(n, s * 0.08)), V.add(A, V.mul(n, s * k)), col, z, false), lineObj(V.add(b, V.mul(n, s * 0.08)), V.add(B, V.mul(n, s * k)), col, z, false)); }
  for (const P of [A, B]) out.push(lineObj(V.sub(P, t), V.add(P, t), col, z, false));   // traits obliques d'architecte
  return out;
}
function buildDims(){
  disposeGroup(dimGroup); const col = '#1F2937';
  for (const d of state?.dims || []) if (d.lvl === curLvl && view !== 'sec') dimLines(d.a, d.b, d.off, col, lvlZ(d.lvl) + 0.03).forEach(l => dimGroup.add(l));
  dirty = true;
}
function dimLabelsInto(box){
  for (const d of state?.dims || []){ if (d.lvl !== curLvl || view === 'sec') continue;
    const {L, A, B} = dimGeom(d.a, d.b, d.off), m = V.mul(V.add(A, B), 0.5), el = document.createElement('div');
    el.className = 'dim cote'; el.textContent = nf(L); el.title = 'Cote · cliquer pour la supprimer';
    el.onclick = ev => { ev.stopPropagation(); if (tool !== 'select') return; pushHist(); state.dims = state.dims.filter(x => x !== d); state.isSample = false; rebuild({noPanel:true}); toast('Cote supprimée (Ctrl+Z pour annuler)'); };
    box.appendChild(el); labels.push({d:el, pos:new THREE.Vector3(m[0], lvlZ(d.lvl) + 0.03, -m[1])});
  }
}
function dimClick(pt){
  if (!draw.start){ draw.start = pt; draw.dimB = null; setPrompt(); return; }
  if (!draw.dimB){ if (V.len(V.sub(pt, draw.start)) < 0.01) return; draw.dimB = pt; setPrompt(); return; }
  const {n} = dimGeom(draw.start, draw.dimB, 0), off = rnd(V.dot(V.sub(pt, draw.start), n));
  pushHist(); (state.dims ??= []).push({id:'d' + Date.now().toString(36) + Math.floor(Math.random() * 1e3), a:draw.start.slice(), b:draw.dimB.slice(), off, lvl:curLvl});
  state.isSample = false; draw.start = null; draw.dimB = null; rebuild({noPanel:true}); setPrompt();
}
function previewDim(cur, ac){
  if (!draw.start) return `x ${nf(cur[0])} · y ${nf(cur[1])}`;
  if (!draw.dimB){ markGroup.add(makeMarker(draw.start, ac)); markGroup.add(lineObj(draw.start, cur, ac)); return nf(V.len(V.sub(cur, draw.start))) + ' m'; }
  const {n, L} = dimGeom(draw.start, draw.dimB, 0), off = V.dot(V.sub(cur, draw.start), n);
  dimLines(draw.start, draw.dimB, off, ac).forEach(l => markGroup.add(l)); return `${nf(L)} m · cliquez pour placer la cote`;
}
