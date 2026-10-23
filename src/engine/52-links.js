/* ============ Éléments reliés entre eux (façon Revit) ============
   Contraintes recalculées à chaque reconstruction, avant la géométrie :
   - mur : base posée sur le plancher (onSlab), haut attaché à un niveau (top:'next' = niveau supérieur, ou n° de niveau) + décalage (topOff) ;
   - poteau : mêmes contraintes, plus « sous l'élément au-dessus » (top:'above' : dalle, volume ou toiture qui le couvre) ;
   - dalle : liée aux murs (bind:'walls') ou à une pièce (bind:{room:[x,y]}), elle suit leurs déplacements ;
   - toiture / volume : posés sur le haut des murs (onWalls).
   Murs joints : quand un mur bouge, les murs raccordés (angles et T) suivent.
   Poignées : extrémités d'un mur, coins d'une dalle ou d'un volume, à tirer directement. */

const inRect = (pt, el, m = 1e-6) => { if (el.poly && el.kind !== 'roof' && m < 0.01) return ptInPoly(pt[0], pt[1], el.poly) || el.poly.some((a, i) => segClosest(pt, a, el.poly[(i + 1) % el.poly.length]).t >= 0 && V.len(V.sub(segClosest(pt, a, el.poly[(i + 1) % el.poly.length]).pt, pt)) < 0.01); const r = rect(el.p, el.q); return pt[0] >= r[0][0] - m && pt[0] <= r[2][0] + m && pt[1] >= r[0][1] - m && pt[1] <= r[2][1] + m; };
/* point nettement à l'intérieur d'une dalle (à plus de 2 cm de son bord) */
function strictIn(pt, el){ const P = volPoly(el); if (!ptInPoly(pt[0], pt[1], P)) return false; for (let i = 0; i < P.length; i++){ const c = segClosest(pt, P[i], P[(i + 1) % P.length]); if (V.len(V.sub(c.pt, pt)) < 0.02) return false; } return true; }
const topLvl = el => el.top === 'next' ? el.lvl + 1 : Number.isInteger(el.top) ? el.top : null;
/* dessus du plancher posé sur ce niveau sous le point (cote relative au niveau), ou null */
function floorTopAt(lvl, pts, excl){
  let best = null;
  for (const s of state.els){
    if (s.kind !== 'slab' || s.lvl !== lvl || s.id === excl || elUse(s) === 'toiture' || (s.off || 0) > 1.2) continue;
    if (!pts.some(p => strictIn(p, s))) continue;   // le mur doit être sur la dalle, pas seulement contre son bord (dalle de pièce)
    const top = (s.off || 0) + slabT(s); if (best == null || top > best) best = top;
  }
  return best;
}
/* dessous de l'élément qui couvre le point au-dessus de la cote z (absolue), ou null */
function undersideAbove(pt, z, excl){
  let best = null;
  for (const e of state.els){
    if (e.id === excl || !['slab', 'vol', 'roof'].includes(e.kind)) continue;
    const zz = lvlZ(e.lvl) + (e.off || 0); if (zz <= z + 0.05) continue;
    const fp = e.kind === 'vol' ? volPoly(e) : e.kind === 'roof' && e.poly ? e.poly : null;
    if (fp ? !ptInPoly(pt[0], pt[1], fp) : !inRect(pt, e, e.kind === 'roof' ? (e.ov ?? 0.4) : 1e-6)) continue;
    if (best == null || zz < best) best = zz;
  }
  return best;
}
const volPoly = el => el.poly && el.poly.length >= 3 ? el.poly : rect(el.p, el.q);
function applyLinks(){
  if (!state?.els) return;
  const R = v => Math.round(v * 1000) / 1000;
  for (const el of state.els) if (el.kind === 'slab' && el.bind){ const P = slabBindPoly(el); if (P) setSlabPoly(el, P); }
  for (const el of state.els){
    if (el.kind === 'wall' || el.kind === 'col'){
      if (el.onSlab){ const pts = el.kind === 'col' ? [el.c] : [V.mul(V.add(el.a, el.b), 0.5), el.a, el.b]; el.off = R(floorTopAt(el.lvl, pts) ?? 0); }
      const tl = topLvl(el);
      if (tl != null && state.levels[tl]) el.h = R(Math.max(0.05, lvlZ(tl) + (el.topOff || 0) - lvlZ(el.lvl) - (el.off || 0)));
    }
  }
  for (const el of state.els){
    if (el.kind === 'roof' && el.onWalls) roofFitWalls(el);
    else if (el.kind === 'vol' && el.onWalls){
      const fp = volPoly(el), xs = fp.map(p => p[0]), ys = fp.map(p => p[1]), x0 = Math.min(...xs) - 0.3, x1 = Math.max(...xs) + 0.3, y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3;
      const tops = state.els.filter(w => (w.kind === 'wall' || w.kind === 'col') && w.lvl === el.lvl && (w.kind === 'col' ? [w.c] : [0, .25, .5, .75, 1].map(t => V.add(w.a, V.mul(V.sub(w.b, w.a), t)))).some(p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) && !(w.kind === 'col' && w.top === 'above')).map(w => (w.off || 0) + w.h);
      if (tops.length) el.off = R(Math.max(...tops));
    }
  }
  for (const el of state.els) if (el.kind === 'col' && el.top === 'above'){
    const z0 = lvlZ(el.lvl) + (el.off || 0), u = undersideAbove(el.c, z0, el.id);
    if (u != null) el.h = R(Math.max(0.05, u - z0 + (el.topOff || 0)));
  }
}

/* ---------- murs joints : les murs raccordés suivent ---------- */
function wallEnds(ids){ const m = new Map(); for (const id of ids){ const w = getEl(id); if (w?.kind === 'wall') m.set(id, {a:w.a.slice(), b:w.b.slice(), lvl:w.lvl, T:wallT(w), arc:!!wallArc(w)}); } return m; }
/* before : Map id → anciennes extrémités (wallEnds) ; à appeler après avoir modifié les murs */
function followJoins(before){
  if (!before?.size) return;
  const R = v => Math.round(v * 1000) / 1000, moved = new Set(before.keys());
  for (const [id, o] of before){
    const w = getEl(id); if (!w || w.kind !== 'wall') continue;
    if (V.eq(o.a, w.a) && V.eq(o.b, w.b)) continue;
    const d0 = V.sub(o.b, o.a), L0 = V.len(d0); if (L0 < 1e-6) continue;
    const u0 = V.mul(d0, 1 / L0), n0 = [-u0[1], u0[0]], d1 = V.sub(w.b, w.a), L1 = V.len(d1) || 1e-9, u1 = V.mul(d1, 1 / L1), n1 = [-u1[1], u1[0]];
    for (const x of state.els){
      if (x.kind !== 'wall' || moved.has(x.id) || x.lvl !== o.lvl) continue;
      for (const k of ['a', 'b']){
        const P = x[k], other = x[k === 'a' ? 'b' : 'a'];
        if (V.len(V.sub(P, o.a)) < 2e-3){ x[k] = w.a.slice(); continue; }
        if (V.len(V.sub(P, o.b)) < 2e-3){ x[k] = w.b.slice(); continue; }
        if (o.arc || wallArc(x)) continue;
        const rel = V.sub(P, o.a), t = V.dot(rel, u0), s = V.dot(rel, n0);
        if (t < -0.02 || t > L0 + 0.02 || Math.abs(s) > o.T / 2 + 0.02) continue;   // extrémité posée contre ce mur (T)
        const dir = V.sub(P, other); if (V.len(dir) < 1e-6) continue;
        const q = lineInter(other, V.mul(dir, 1 / V.len(dir)), V.add(w.a, V.mul(n1, s)), u1);
        if (q && V.len(V.sub(q, other)) > 0.01) x[k] = [R(q[0]), R(q[1])];
      }
    }
  }
}
function withJoins(ids, fn){ const before = wallEnds(ids); const r = fn(); followJoins(before); return r; }

/* ---------- poignées sur l'élément sélectionné ---------- */
let gripDrag = null;
function gripPoints(el){
  if (el.kind === 'wall') return [{k:'a', pt:el.a}, {k:'b', pt:el.b}];
  if ((el.kind === 'slab' || el.kind === 'vol') && !el.poly && !el.bind){ const r = rect(el.p, el.q); return r.map((pt, i) => ({k:'c' + i, pt})); }
  return [];
}
function addGrips(el, add){
  if (multi.length || tool !== 'select' || gripDrag) return;
  const z = el.kind === 'slab' ? lvlZ(el.lvl) + (el.off || 0) + slabT(el) : lvlZ(el.lvl) + (el.off || 0) + (view !== '2d' ? el.h || 0 : 0);
  for (const g of gripPoints(el)){
    const d = add(new THREE.Vector3(g.pt[0], z, -g.pt[1]), '', 'grip');
    d.title = el.kind === 'wall' ? 'Tirer l\'extrémité (les murs raccordés suivent)' : 'Tirer le coin';
    d.onpointerdown = ev => { if (ev.button !== 0) return; ev.stopPropagation(); ev.preventDefault(); gripStart(el, g.k, ev); };
  }
}
function gripStart(el, k, ev){
  pushHist(); const before = el.kind === 'wall' ? wallEnds([el.id]) : null;
  gripDrag = {id:el.id, k, orig:JSON.stringify(state.els), before};
  c3.enabled = false; document.body.classList.add('gripping');
  const move = e => {
    const g = cursorPoint(e); if (!g) return; const s = snap(g); draw.snap = s; const pt = [rnd(s.pt[0]), rnd(s.pt[1])];
    state.els = JSON.parse(gripDrag.orig); elIdxOf = null; const x = getEl(gripDrag.id); if (!x) return;
    if (x.kind === 'wall'){ const other = k === 'a' ? x.b : x.a; if (V.len(V.sub(pt, other)) < 0.02) return; x[k] = pt; followJoins(gripDrag.before); }
    else { const r = rect(x.p, x.q), opp = r[(+k.slice(1) + 2) % 4]; if (Math.abs(pt[0] - opp[0]) < 0.02 || Math.abs(pt[1] - opp[1]) < 0.02) return; x.p = [Math.min(pt[0], opp[0]), Math.min(pt[1], opp[1])]; x.q = [Math.max(pt[0], opp[0]), Math.max(pt[1], opp[1])]; }
    state.isSample = false; rebuild({noPanel:true}); drawSnapGlyph(toV3(s.pt), s.kind, s.how);
  };
  const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); if (JSON.stringify(state.els) === gripDrag.orig){ hist.pop(); updUndo(); } gripDrag = null; c3.enabled = view !== '2d'; document.body.classList.remove('gripping'); drawSnapGlyph(null); snapGeo = null; rebuild(); };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
}
const toV3 = p => new THREE.Vector3(p[0], curZ(), -p[1]);

/* ---------- niveaux façon Revit : tableau, hauteurs d'étage, lignes de niveau en coupe et élévation ---------- */
function sortLevels(){
  const order = state.levels.map((l, i) => i).sort((a, b) => state.levels[a].z - state.levels[b].z);
  if (order.every((v, i) => v === i)) return;
  const map = {}; order.forEach((old, i) => map[old] = i);
  state.levels = order.map(i => state.levels[i]);
  state.els.forEach(e => { e.lvl = map[e.lvl]; if (Number.isInteger(e.top)) e.top = map[e.top]; });
  curLvl = map[curLvl] ?? 0;
}
function setLevelZ(i, z, shiftAbove){
  const d = z - state.levels[i].z; if (Math.abs(d) < 1e-6) return;
  if (shiftAbove) state.levels.forEach((l, j) => { if (j > i) l.z = rnd(l.z + d); });
  state.levels[i].z = rnd(z); sortLevels();
}
function addLevelAbove(opts = {}){
  const last = state.levels[state.levels.length - 1], wl = state.els.filter(w => w.kind === 'wall').map(w => w.lvl), below = wl.length ? Math.max(...wl) : state.levels.length - 1;
  const hEt = opts.h ?? (state.levels.length > 1 ? rnd(last.z - state.levels[state.levels.length - 2].z) : 2.8);
  state.levels.push({n:`R+${state.levels.length}`, z:rnd((last?.z || 0) + hEt)}); const li = state.levels.length - 1;
  if (opts.floor){ const ws = state.els.filter(w => w.kind === 'wall' && w.lvl === below); if (ws.length){ const s = {kind:'slab', type:'DAL-BA-20', lvl:li, off:0, bind:'walls', bindLvl:below, id:state.nextId++, p:[0, 0], q:[1, 1]}; state.els.push(s); } }
  if (opts.walls){ const ext = state.els.filter(w => w.kind === 'wall' && w.lvl === below && compo(w.type).lot !== 'Second œuvre');
    for (const w of ext){ const c = JSON.parse(JSON.stringify(w)); c.id = state.nextId++; c.lvl = li; c.onSlab = true; c.top = state.levels[li + 1] ? 'next' : undefined; if (c.top == null) c.h = w.h; state.els.push(c); } }
  return li;
}
function openLevels(){
  const row = (l, i) => { const next = state.levels[i + 1], n = state.els.filter(e => e.lvl === i).length;
    return `<tr data-li="${i}"><td><input data-ln value="${esc(l.n)}" maxlength="30" aria-label="Nom"></td><td><span class="in"><input data-lz type="number" step="0.01" value="${rnd(l.z)}" aria-label="Altitude"><em>m</em></span></td>
      <td>${next ? `<span class="in"><input data-lh type="number" step="0.01" min="0.5" value="${rnd(next.z - l.z)}" aria-label="Hauteur d'étage"><em>m</em></span>` : '<span class="hint">—</span>'}</td>
      <td class="num">${n}</td><td><button class="btn sm" data-lwork${i === curLvl ? ' disabled' : ''}>${i === curLvl ? 'Courant' : 'Travailler'}</button>${state.levels.length > 1 ? `<button class="x" data-ldel title="Supprimer" aria-label="Supprimer ${esc(l.n)}">×</button>` : ''}</td></tr>`; };
  const html = () => `<header class="ed-h"><div><span class="eyebrow">Projet</span><h3 class="ed-t2">Niveaux</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><p class="hint">Comme dans Revit : chaque niveau a une altitude ; les murs attachés au « niveau supérieur » et les dalles posées sur un niveau suivent quand vous le déplacez. Modifier la hauteur d'un étage décale tous les niveaux au-dessus.</p>
      <table class="tbl lvt"><thead><tr><th>Nom</th><th>Altitude</th><th>Hauteur d'étage</th><th class="num">Él.</th><th></th></tr></thead><tbody>${state.levels.map(row).reverse().join('')}</tbody></table>
      <div class="grp"><h3>Nouveau niveau au-dessus</h3><div class="fields"><label class="f"><span>Hauteur d'étage</span><span class="in"><input id="nlH" type="number" step="0.01" min="0.5" value="${state.levels.length > 1 ? rnd(state.levels.at(-1).z - state.levels.at(-2).z) : 2.8}"><em>m</em></span></label></div>
        <label class="f wide rchk"><input type="checkbox" id="nlF" checked> Créer le plancher (dalle liée aux murs du niveau inférieur)</label>
        <label class="f wide rchk"><input type="checkbox" id="nlW"> Monter aussi les murs extérieurs</label>
        <div class="btns tight"><button class="btn primary" id="nlAdd">+ Ajouter le niveau</button></div></div></div>
    <footer class="ed-f"><button class="btn" data-close>Fermer</button></footer>`;
  const d = openEDlg(html(), 'small');
  const redraw = () => { d.querySelector('.edlg-card').innerHTML = html(); d.querySelectorAll('[data-close]').forEach(b => b.onclick = closeEDlg); wire(); };
  const done = () => { state.isSample = false; rebuild(); syncLevels(); redraw(); };
  function wire(){
    d.querySelector('#nlAdd').onclick = () => { const h = num(d.querySelector('#nlH').value); pushHist(); const li = addLevelAbove({h:h > 0.5 ? h : undefined, floor:d.querySelector('#nlF').checked, walls:d.querySelector('#nlW').checked});
      // les murs du niveau inférieur restés en hauteur libre s'attachent au nouveau niveau
      state.els.forEach(w => { if (w.kind === 'wall' && w.lvl === li - 1 && w.top == null && w.autoTop !== false && Math.abs(lvlZ(w.lvl) + w.off + w.h - lvlZ(li)) < 0.6){ w.top = 'next'; w.topOff = 0; } });
      done(); toast(`${lvlName(li)} ajouté`); };
    d.querySelectorAll('tr[data-li]').forEach(tr => { const i = +tr.dataset.li;
      tr.querySelector('[data-ln]').onchange = e => { pushHist(); state.levels[i].n = e.target.value.trim().slice(0, 30) || state.levels[i].n; done(); };
      tr.querySelector('[data-lz]').onchange = e => { const z = num(e.target.value); if (Number.isNaN(z)) return redraw(); pushHist(); setLevelZ(i, z, false); done(); };
      const lh = tr.querySelector('[data-lh]'); if (lh) lh.onchange = e => { const h = num(e.target.value); if (!(h >= 0.5)) return redraw(); pushHist(); setLevelZ(i + 1, state.levels[i].z + h, true); done(); };
      const w = tr.querySelector('[data-lwork]'); if (w) w.onclick = () => { curLvl = i; snapGeo = null; syncLevels(); positionGrid(); rebuild(); redraw(); };
      const x = tr.querySelector('[data-ldel]'); if (x) x.onclick = () => { if (state.els.some(e => e.lvl === i)) return toast('Ce niveau contient des éléments : déplacez-les ou supprimez-les d\'abord.');
        pushHist(); state.levels.splice(i, 1); state.els.forEach(e => { if (e.lvl > i) e.lvl--; if (Number.isInteger(e.top) && e.top > i) e.top--; }); curLvl = Math.min(curLvl, state.levels.length - 1); done(); };
    });
  }
  wire();
}
/* lignes de niveau dans les coupes et élévations (à tirer pour changer l'altitude, double-clic pour renommer) */
function buildLevelMarks(){
  const box = $('#lvlMarks'); if (!box) return;
  if (view !== 'sec' || !curSec){ box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = state.levels.map((l, i) => `<div class="lvm" data-li="${i}"><i></i><span class="lvm-h" title="Tirer pour changer l'altitude · double-clic pour renommer"><b>${esc(l.n)}</b><em>${nf(l.z)} m</em></span></div>`).join('') + '<button class="lvm-add btn sm" title="Ajouter un niveau au-dessus">+ Niveau</button>';
  placeLevelMarks();
  box.querySelector('.lvm-add').onclick = () => { pushHist(); addLevelAbove({}); state.isSample = false; rebuild(); syncLevels(); };
  box.querySelectorAll('.lvm').forEach(m => { const i = +m.dataset.li, h = m.querySelector('.lvm-h');
    h.ondblclick = () => levelDialog(i);
    h.onpointerdown = ev => { if (ev.button !== 0) return; ev.preventDefault(); ev.stopPropagation(); const z0 = state.levels[i].z, y0 = ev.clientY, ppm = levelPpm(); let z = z0; pushHist();
      const mv = e => { z = rnd(Math.round((z0 - (e.clientY - y0) / ppm) / 0.05) * 0.05); state.levels[i].z = z; m.querySelector('em').textContent = nf(z) + ' m'; placeLevelMarks(); };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if (Math.abs(z - z0) < 1e-6){ hist.pop(); updUndo(); return; } sortLevels(); state.isSample = false; rebuild(); syncLevels(); toast(`${lvlName(Math.min(i, state.levels.length - 1))} : ${nf(z)} m`); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); };
  });
}
function levelPpm(){ const c = c4.target, a = toScreen(new THREE.Vector3(c.x, 0, c.z)), b = toScreen(new THREE.Vector3(c.x, 1, c.z)); return Math.abs(a[1] - b[1]) || 40; }
function placeLevelMarks(){
  const box = $('#lvlMarks'); if (!box || box.hidden) return; const c = c4.target;
  box.querySelectorAll('.lvm').forEach(m => { const z = state.levels[+m.dataset.li].z, y = toScreen(new THREE.Vector3(c.x, z, c.z))[1]; m.style.top = y.toFixed(1) + 'px'; m.hidden = y < -20 || y > vpEl.clientHeight + 20; });
}
/* valeurs par défaut d'un mur ou d'un poteau qu'on dessine : posé sur le plancher, haut attaché au niveau supérieur */
function linkDefaults(e){
  const d = defs[e.kind === 'col' ? 'col' : 'wall'];
  if (draw.workZ == null){ e.onSlab = true; const pts = e.kind === 'col' ? [e.c] : [V.mul(V.add(e.a, e.b), 0.5), e.a, e.b]; e.off = rnd(floorTopAt(e.lvl, pts) ?? e.off ?? 0); }
  if (d.top === 'above' && e.kind === 'col'){ e.top = 'above'; e.topOff = 0; const z0 = lvlZ(e.lvl) + e.off, u = undersideAbove(e.c, z0); if (u != null) e.h = rnd(u - z0); }
  else if (d.top === 'next' && state.levels[e.lvl + 1]){ e.top = 'next'; e.topOff = 0; e.h = rnd(Math.max(0.05, lvlZ(e.lvl + 1) - lvlZ(e.lvl) - e.off)); }
  return e;
}

/* ---------- propriétés : contraintes de base et de haut ---------- */
const lockF = h => h.replace('<input ', '<input disabled title="Calculé par la contrainte" ');
function linkFields(el){
  const lv = state.levels.map((l, i) => [i, l]).filter(([i]) => i > el.lvl);
  const opts = [['', 'Hauteur libre'], ...(state.levels[el.lvl + 1] ? [['next', `Niveau supérieur (${lvlName(el.lvl + 1)})`]] : []), ...lv.slice(1).map(([i, l]) => ['L' + i, `Jusqu'au niveau ${l.n}`]), ...(el.kind === 'col' ? [['above', 'Sous l\'élément au-dessus']] : [])];
  const cur = el.top === 'next' || el.top === 'above' ? el.top : Number.isInteger(el.top) ? 'L' + el.top : '';
  let h = `<label class="f wide rchk"><input type="checkbox" data-f="onSlab"${el.onSlab ? ' checked' : ''}> Posé sur le plancher (suit la dalle)</label>`;
  h += selectField('Niveau de base', 'lvl', lvlOpts(), el.lvl, false) + (el.onSlab ? lockF(field('Décalage base', 'off', el.off, 'm')) : field('Décalage base', 'off', el.off, 'm'));
  h += selectField('Contrainte haute', 'top', opts, cur, false) + (cur ? field('Décalage haut', 'topOff', el.topOff || 0, 'm') : '');
  h += cur ? lockF(field('Hauteur', 'h', el.h, 'm')) : field('Hauteur', 'h', el.h, 'm');
  return h;
}
function slabLinkField(el){
  const cur = el.bind === 'walls' ? (el.bindLvl != null && el.bindLvl !== el.lvl ? 'W' + el.bindLvl : 'walls') : el.bind?.room ? 'room' : '';
  const opts = [['', 'Libre (dimensions saisies)'], ['walls', 'Sous les murs du niveau'], ['room', 'Sur la pièce'], ...state.levels.map((l, i) => [i, l]).filter(([i]) => i < el.lvl).map(([i, l]) => ['W' + i, `Sur les murs de ${l.n} (plancher haut)`])];
  return selectField('Liée à', 'bind', opts, cur);
}
const onWallsField = el => `<label class="f wide rchk"><input type="checkbox" data-f="onWalls"${el.onWalls ? ' checked' : ''}> Posé sur le haut des murs (suit leur hauteur)</label>`;
function setLinkField(el, f, t){
  if (f === 'onSlab'){ if (t.checked) el.onSlab = true; else delete el.onSlab; }
  else if (f === 'top'){ const v = t.value; if (!v){ delete el.top; delete el.topOff; } else { el.top = v === 'next' || v === 'above' ? v : +v.slice(1); el.topOff ??= 0; } }
  else if (f === 'topOff'){ const v = num(t.value); if (!Number.isNaN(v)) el.topOff = v; }
  else if (f === 'onWalls'){ if (t.checked) el.onWalls = true; else delete el.onWalls; }
  else if (f === 'bind'){ const v = t.value; delete el.bindLvl;
    if (!v) delete el.bind;
    else if (v === 'walls') el.bind = 'walls';
    else if (v[0] === 'W'){ el.bind = 'walls'; el.bindLvl = +v.slice(1); }
    else if (v === 'room'){ const c = [rnd((el.p[0] + el.q[0]) / 2), rnd((el.p[1] + el.q[1]) / 2)]; if (roomAt(c, el.lvl)) el.bind = {room:c}; else toast('Aucune pièce fermée sous le centre de la dalle'); } }
}
/* projets existants : on relie ce qui se touche déjà (aucune géométrie ne bouge) */
function autoLink(){
  const near = (a, b) => Math.abs(a - b) < 0.02;
  for (const el of state.els){
    if (el.kind === 'wall' || el.kind === 'col'){
      const pts = el.kind === 'col' ? [el.c] : [V.mul(V.add(el.a, el.b), 0.5), el.a, el.b], ft = floorTopAt(el.lvl, pts);
      if (el.onSlab == null && (ft != null ? near(el.off || 0, ft) : !(el.off || 0))) el.onSlab = true;
      if (el.top == null){ const zt = lvlZ(el.lvl) + (el.off || 0) + el.h, i = state.levels.findIndex((l, j) => j > el.lvl && near(l.z, zt)); if (i > 0){ el.top = i === el.lvl + 1 ? 'next' : i; el.topOff = 0; } }
    }
  }
  for (const el of state.els){
    if (el.kind === 'vol' && el.onWalls == null){
      const fp = volPoly(el), xs = fp.map(p => p[0]), ys = fp.map(p => p[1]), x0 = Math.min(...xs) - 0.3, x1 = Math.max(...xs) + 0.3, y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3;
      const touch = state.els.some(w => w.kind === 'wall' && w.lvl === el.lvl && near((w.off || 0) + w.h, el.off || 0) && [0, .25, .5, .75, 1].some(t => { const p = V.add(w.a, V.mul(V.sub(w.b, w.a), t)); return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1; }));
      if (touch) el.onWalls = true;
    }
    if (el.kind === 'roof' && el.onWalls == null){ const c = {...el}; if (roofFitWalls(c) && near(c.off, el.off || 0)) el.onWalls = true; }
  }
  for (const el of state.els) if (el.kind === 'col' && el.top == null){ const z0 = lvlZ(el.lvl) + (el.off || 0), u = undersideAbove(el.c, z0, el.id); if (u != null && near(u, z0 + el.h)){ el.top = 'above'; el.topOff = 0; } }
}
