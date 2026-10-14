/* ============ Coupes et élévations ============
   state.views = [{id, name, kind:'coupe', a:[x,y], b:[x,y]}] : trait de coupe tracé en plan (outil Coupe, touche K).
   On regarde du côté gauche du trait (flèches sur le plan) ; tout ce qui est devant le plan de coupe est retiré et les matières
   tranchées apparaissent en sombre (poché). Élévations : vues orthogonales des 4 façades, sans coupe. */
let curSec = null;
const ELEVS = {S:['Élévation sud', [0, 1]], N:['Élévation nord', [0, -1]], E:['Élévation est', [-1, 0]], O:['Élévation ouest', [1, 0]]};
function secDefs(){ return [...Object.entries(ELEVS).map(([k, [name, d]]) => ({id:'elev-' + k, name, kind:'elev', dir:d})), ...(state.views || [])]; }
function secDir(def){ if (def.kind === 'elev') return def.dir; const d = V.sub(def.b, def.a), L = V.len(d) || 1, n = [-d[1] / L, d[0] / L]; return def.flip ? [-n[0], -n[1]] : n; }
function secClip(){
  if (!curSec || curSec.kind !== 'coupe') return [];
  const n = secDir(curSec), N = new THREE.Vector3(n[0], 0, -n[1]), P = new THREE.Vector3(curSec.a[0], 0, -curSec.a[1]);
  return [new THREE.Plane(N, -N.dot(P))];
}
function openSection(def){
  curSec = def; const n = secDir(def), b = bbox(), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  const D = new THREE.Vector3(n[0], 0, -n[1]), right = new THREE.Vector3().crossVectors(D, new THREE.Vector3(0, 1, 0)).normalize();
  const target = def.kind === 'coupe' ? new THREE.Vector3((def.a[0] + def.b[0]) / 2, c.y, -(def.a[1] + def.b[1]) / 2) : c.clone();
  orthoS.up.set(0, 1, 0); orthoS.position.copy(target).addScaledVector(D, -300); c4.target.copy(target); orthoS.lookAt(target);
  const w = vpEl.clientWidth || 800, h = vpEl.clientHeight || 600, aspect = w / h, widthM = Math.abs(right.x) * s.x + Math.abs(right.z) * s.z + 3, hM = s.y + 3;
  Object.assign(orthoS, {left:-10 * aspect, right:10 * aspect, top:10, bottom:-10}); orthoS.zoom = Math.min(20 / hM, 20 * aspect / widthM); orthoS.updateProjectionMatrix(); c4.update();
  if (tool !== 'select') setTool('select');
  setView('sec'); renderer.clippingPlanes = secClip();
  renderSecBar(); dirty = true;
}
function renderSecBar(){
  const bar = $('#secBar'); if (!curSec){ bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = `<b>${esc(curSec.name)}</b><select id="secSel" aria-label="Changer de vue">${secDefs().map(d => `<option value="${esc(d.id)}"${d.id === curSec.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
    ${curSec.kind === 'coupe' ? '<button class="btn" data-sec="flip">Inverser le sens</button><button class="btn danger" data-sec="del">Supprimer</button>' : ''}<button class="btn" data-sec="png">Image</button><button class="btn primary" data-sec="back">Retour 3D</button>`;
}
$('#secBar').addEventListener('change', e => { if (e.target.id === 'secSel'){ const d = secDefs().find(x => x.id === e.target.value); if (d) openSection(d); } });
$('#secBar').addEventListener('click', e => {
  const b = e.target.closest('[data-sec]'); if (!b) return; const k = b.dataset.sec;
  if (k === 'back'){ curSec = null; setView('3d'); }
  else if (k === 'flip' && curSec){ pushHist(); curSec.flip = !curSec.flip; const v = (state.views || []).find(x => x.id === curSec.id); if (v) v.flip = curSec.flip; openSection(v || curSec); rebuild({noPanel:true}); }
  else if (k === 'del' && curSec){ pushHist(); state.views = (state.views || []).filter(x => x.id !== curSec.id); curSec = null; setView('3d'); rebuild({noPanel:true}); toast('Coupe supprimée'); }
  else if (k === 'png') doExport('png', 2);
});
function openSecMenu(btn){
  const m = $('#secMenu'), cuts = state.views || [];
  m.innerHTML = `<div class="lbl">Élévations</div>${Object.entries(ELEVS).map(([k, [n]]) => `<button type="button" data-secopen="elev-${k}"><b>${n}</b></button>`).join('')}
    <hr><div class="lbl">Coupes</div>${cuts.length ? cuts.map(c => `<button type="button" data-secopen="${esc(c.id)}"><b>${esc(c.name)}</b><span>${nf(V.len(V.sub(c.b, c.a)))} m</span></button>`).join('') : '<p class="hint" style="margin:4px 12px">Aucune coupe : tracez-en une en plan.</p>'}
    <hr><button type="button" data-secnew><b>+ Nouvelle coupe</b><span>Tracez le trait de coupe en plan (2 points)</span></button>`;
  popMenu(m, btn);
}
$('#secMenu').addEventListener('click', e => {
  const o = e.target.closest('[data-secopen]'), n = e.target.closest('[data-secnew]'); $('#secMenu').hidden = true;
  if (o){ const d = secDefs().find(x => x.id === o.dataset.secopen); if (d) openSection(d); }
  if (n){ curSec = null; setView('2d'); setTool('cut'); }
});
document.addEventListener('click', e => { const m = $('#secMenu'); if (!m.hidden && !m.contains(e.target) && !e.target.closest('[data-mode="sec"]')) m.hidden = true; });
function addCut(a, b){
  state.views ??= []; const used = new Set(state.views.map(v => v.name)); let k = 0; while (used.has('Coupe ' + String.fromCharCode(65 + k))) k++;
  const v = {id:'cut-' + Date.now().toString(36), name:'Coupe ' + String.fromCharCode(65 + (k % 26)), kind:'coupe', a:a.slice(), b:b.slice()};
  pushHist(); state.views.push(v); state.isSample = false; rebuild({noPanel:true}); toast(`${v.name} créée`); openSection(v);
}
/* traits de coupe affichés sur le plan et en 3D */
const cutMarks = new THREE.Group(); scene.add(cutMarks);
let cutTex = [];
function buildCutMarks(){
  disposeGroup(cutMarks); cutTex.forEach(t => t.dispose()); cutTex = []; cutMarks.visible = view !== 'sec';
  for (const v of state?.views || []){
    const z = lvlZ(curLvl) + 0.02, n = secDir(v), col = '#C0392B';
    cutMarks.add(lineObj(v.a, v.b, col, z, true));
    for (const p of [v.a, v.b]){ const q = V.add(p, V.mul(n, 0.8)); cutMarks.add(lineObj(p, q, col, z, false)); const h1 = V.add(q, V.mul(V.add(V.mul(n, -0.25), V.mul([-n[1], n[0]], 0.18)), 1)), h2 = V.add(q, V.mul(V.add(V.mul(n, -0.25), V.mul([n[1], -n[0]], 0.18)), 1)); cutMarks.add(lineObj(q, h1, col, z, false)); cutMarks.add(lineObj(q, h2, col, z, false));
      const sp = textSprite(v.name.replace('Coupe ', ''), 0.03, col); siteTex.pop(); cutTex.push(sp.material.map); sp.position.set(p[0] - n[0] * 0.4, z + 0.3, -(p[1] - n[1] * 0.4)); cutMarks.add(sp); }
  }
}
