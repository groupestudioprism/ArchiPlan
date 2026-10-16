/* ============ Affichage groupé : beaucoup moins d'objets à dessiner à chaque image ============
   La maquette garde un groupe d'objets par élément (sélection, accroches, mesures, exports, coupes). Pour l'affichage,
   les pièces opaques sont fusionnées par matériau, par paquets de BATCH_N éléments : une maison de 15 éléments passe de
   ~170 à ~25 appels de dessin, un projet de 1 200 éléments de ~14 000 à ~600. Les objets d'origine fusionnés sont
   seulement masqués (le lancer de rayons les voit toujours).
   - Le paquet qui contient la sélection s'affiche « en direct » (objets d'origine) : la mise en évidence est inchangée.
   - Les matériaux transparents (vitrages, rayons X) ne sont jamais fusionnés : leur tri d'affichage reste le même.
   - Les matrices de la maquette ne sont recalculées qu'à la reconstruction (les objets ne bougent pas entre deux). */
const BATCH_N = 32;
let BATCH_ON = true, batchChunks = [];
const batchGroup = new THREE.Group(); batchGroup.name = 'affichage-groupe'; batchGroup.matrixWorldAutoUpdate = false; scene.add(batchGroup);
modelGroup.matrixWorldAutoUpdate = false;
const batchNoRay = () => {};
function batchClear(){
  for (const c of batchChunks) for (const o of c.objs) o.geometry.dispose();
  batchGroup.clear(); batchChunks = [];
}
const isIdent = m => { const e = m.elements; return e[0] === 1 && e[5] === 1 && e[10] === 1 && e[15] === 1 && !e[1] && !e[2] && !e[3] && !e[4] && !e[6] && !e[7] && !e[8] && !e[9] && !e[11] && !e[12] && !e[13] && !e[14]; };
/* copie d'un attribut (éventuellement entrelacé ou indexé) dans un tableau plat */
function batchCopy(attr, idx, dst, at, size){
  const n = idx ? idx.count : attr.count;
  if (!idx && !attr.isInterleavedBufferAttribute && attr.itemSize === size && attr.array.length === n * size && attr.array instanceof Float32Array){ dst.set(attr.array, at * size); return n; }
  for (let i = 0; i < n; i++){ const k = idx ? idx.getX(i) : i; for (let s = 0; s < size; s++) dst[(at + i) * size + s] = s < attr.itemSize ? attr.getComponent(k, s) : 0; }
  return n;
}
const vtxCount = g => g.index ? g.index.count : g.attributes.position.count;
function batchMerge(list, lines){
  let n = 0; for (const it of list) n += vtxCount(it.geo);
  const pos = new Float32Array(n * 3), nor = lines ? null : new Float32Array(n * 3), uv = lines ? null : new Float32Array(n * 2);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(); let at = 0;
  for (const {geo, mw} of list){
    const idx = geo.index, A = geo.attributes, c = batchCopy(A.position, idx, pos, at, 3);
    if (nor && A.normal) batchCopy(A.normal, idx, nor, at, 3);
    if (uv && A.uv) batchCopy(A.uv, idx, uv, at, 2);
    if (!isIdent(mw)){
      nm.getNormalMatrix(mw);
      for (let i = at; i < at + c; i++){
        v.fromArray(pos, i * 3).applyMatrix4(mw).toArray(pos, i * 3);
        if (nor && A.normal) v.fromArray(nor, i * 3).applyMatrix3(nm).normalize().toArray(nor, i * 3);
      }
    }
    at += c;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nor){ g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  g.computeBoundingSphere(); return g;
}
function batchBuild(){
  batchClear(); modelGroup.updateMatrixWorld(true);
  if (!BATCH_ON) return;
  const gs = modelGroup.children;
  for (let i = 0; i < gs.length; i += BATCH_N){
    const ch = {ids:new Set(), hide:[], objs:[], grp:new THREE.Group(), live:false}, merged = new Set(), buckets = new Map();
    const put = (key, M, o, line, cast, recv) => { let b = buckets.get(key); if (!b) buckets.set(key, b = {M, line, cast, recv, list:[]}); b.list.push({geo:o.geometry, mw:o.matrixWorld}); };
    for (const g of gs.slice(i, i + BATCH_N)){
      ch.ids.add(g.userData.id);
      g.traverse(o => {
        if (o === g || !o.visible || !o.geometry?.attributes?.position) return;
        if (o.isMesh){
          if (o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.geometry.morphAttributes?.position) return;
          const M = o.userData.mat != null ? matFor(o.userData.mat, false, o.userData.light || 0) : o.material;
          if (!M || M.transparent || o.material.transparent || o.renderOrder) return;   // transparents : tri inchangé
          put('m' + M.uuid + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0), M, o, false, o.castShadow, o.receiveShadow);
          merged.add(o); ch.hide.push(o);
        } else if (o.isLineSegments){
          if (o.renderOrder) return;
          const viaParent = o.parent !== g;               // arêtes d'une pièce : suivent leur pièce
          if (viaParent && !merged.has(o.parent)) return;
          const M = o.userData.isEdge ? edgeMat : o.material;
          if (!M || Array.isArray(M)) return;
          put('l' + M.uuid, M, o, true, false, false);
          if (!viaParent) ch.hide.push(o);
        }
      });
    }
    for (const b of buckets.values()){
      const geo = batchMerge(b.list, b.line);
      const o = b.line ? new THREE.LineSegments(geo, b.M) : new THREE.Mesh(geo, b.M);
      if (b.line && b.M.isLineDashedMaterial) o.computeLineDistances();
      o.castShadow = b.cast; o.receiveShadow = b.recv; o.raycast = batchNoRay; o.matrixAutoUpdate = false;
      ch.grp.add(o); ch.objs.push(o);
    }
    for (const o of ch.hide) o.visible = false;
    batchGroup.add(ch.grp); batchChunks.push(ch);
  }
  batchGroup.updateMatrixWorld(true);
}
/* le paquet qui contient la sélection s'affiche en direct */
function batchLive(set){
  for (const ch of batchChunks){
    let live = false; for (const id of set) if (ch.ids.has(id)){ live = true; break; }
    if (live === ch.live) continue;
    ch.live = live; ch.grp.visible = !live; for (const o of ch.hide) o.visible = live;
  }
}
