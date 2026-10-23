/* ============ Conception plus pratique ============
   - pièces détectées automatiquement à partir des murs (nom modifiable, surface utile affichée sur le plan) ;
   - mur « Pièce » (rectangle de 4 murs en un geste), dalle posée sur une pièce ou sur l'emprise des murs ;
   - menu clic droit sur la maquette, symétrie, copie vers un autre niveau ;
   - cote d'un mur sélectionné modifiable d'un clic. */

/* ---------- pièces : faces fermées du graphe des axes de murs ---------- */
let roomsCache = null;
function detectRooms(lvl){
  if (roomsCache && roomsCache.seq === rebuildSeq && roomsCache.lvl === lvl && roomsCache.n === state.els.length) return roomsCache.rooms;
  const ws = state.els.filter(w => w.kind === 'wall' && w.lvl === lvl);
  const segs = [];
  for (const w of ws){ const P = wallArc(w) ? arcPts(w, 0) : [w.a, w.b]; for (let i = 0; i + 1 < P.length; i++) segs.push({a:P[i], b:P[i + 1], T:wallT(w)}); }
  // découpe aux croisements et aux « T »
  const cuts = segs.map(() => [0, 1]);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++){
    const A = segs[i], B = segs[j], d1 = V.sub(A.b, A.a), d2 = V.sub(B.b, B.a), den = V.cross(d1, d2);
    if (Math.abs(den) < 1e-9) continue;
    // tolérance : une cloison arrêtée sur la face d'un mur (et non sur son axe) est prolongée jusqu'à l'axe
    const t = V.cross(V.sub(B.a, A.a), d2) / den, u = V.cross(V.sub(B.a, A.a), d1) / den, e = (B.T / 2 + 0.05) / Math.max(V.len(d1), 1e-6), f = (A.T / 2 + 0.05) / Math.max(V.len(d2), 1e-6);
    if (t < -e || t > 1 + e || u < -f || u > 1 + f) continue;
    if ((t < 0 || t > 1) && (u < -1e-6 || u > 1 + 1e-6)) continue;   // deux prolongements à la fois : pas une jonction
    cuts[i].push(t); cuts[j].push(u);
  }
  const K = p => `${Math.round(p[0] * 50)};${Math.round(p[1] * 50)}`, nodes = new Map(), adj = new Map(), Tsum = {n:0, s:0};
  const node = p => { const k = K(p); if (!nodes.has(k)){ nodes.set(k, p); adj.set(k, new Set()); } return k; };
  segs.forEach((s, i) => { const ts = [...new Set(cuts[i].map(t => +t.toFixed(5)))].sort((a, b) => a - b);
    for (let k = 0; k + 1 < ts.length; k++){ const p = V.add(s.a, V.mul(V.sub(s.b, s.a), ts[k])), q = V.add(s.a, V.mul(V.sub(s.b, s.a), ts[k + 1])); const a = node(p), b = node(q); if (a !== b){ adj.get(a).add(b); adj.get(b).add(a); } }
    Tsum.n++; Tsum.s += s.T; });
  // élagage des extrémités libres
  for (let again = true; again;){ again = false; for (const [k, s] of adj) if (s.size === 1){ const o = [...s][0]; adj.get(o).delete(k); s.clear(); again = true; } }
  const ang = (a, b) => { const p = nodes.get(a), q = nodes.get(b); return Math.atan2(q[1] - p[1], q[0] - p[0]); };
  const sorted = new Map(); for (const [k, s] of adj) sorted.set(k, [...s].sort((x, y) => ang(k, x) - ang(k, y)));
  const seen = new Set(), rooms = [];
  for (const [u, list] of sorted) for (const v of list){
    if (seen.has(u + '>' + v)) continue;
    const poly = []; let a = u, b = v, guard = 0;
    while (guard++ < 2000){
      seen.add(a + '>' + b); poly.push(nodes.get(a));
      const nb = sorted.get(b); const i = nb.indexOf(a); const c = nb[(i - 1 + nb.length) % nb.length];   // on tourne au plus à gauche → face à gauche
      a = b; b = c; if (a === u && b === v) break;
    }
    const A = sArea(poly); if (A > 0.4 && poly.length >= 3) rooms.push({poly, area:A});
  }
  const hT = (Tsum.n ? Tsum.s / Tsum.n : 0.2) / 2;
  const out = rooms.map((r, i) => { let per = 0; r.poly.forEach((p, k) => { const q = r.poly[(k + 1) % r.poly.length]; per += Math.hypot(q[0] - p[0], q[1] - p[1]); });
    const c = polyCentroid(r.poly), key = `${lvl}:${c[0].toFixed(1)};${c[1].toFixed(1)}`;
    return {poly:r.poly, area:r.area, net:Math.max(0, r.area - per * hT + 4 * hT * hT), c, key, name:state.roomNames?.[key] || `Pièce ${i + 1}`}; });
  roomsCache = {seq:rebuildSeq, lvl, n:state.els.length, rooms:out};
  return out;
}
function polyCentroid(p){ let a = 0, x = 0, y = 0; for (let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length], c = p[i][0] * q[1] - q[0] * p[i][1]; a += c; x += (p[i][0] + q[0]) * c; y += (p[i][1] + q[1]) * c; } a /= 2; if (Math.abs(a) < 1e-9) return p[0]; let c = [x / (6 * a), y / (6 * a)]; if (!ptInPoly(c[0], c[1], p)){ const xs = p.map(q => q[0]); c = [ (Math.min(...xs) + Math.max(...xs)) / 2, c[1] ]; } return c; }
const roomAt = (pt, lvl = curLvl) => detectRooms(lvl).filter(r => ptInPoly(pt[0], pt[1], r.poly)).sort((a, b) => a.area - b.area)[0] || null;
/* teintes des pièces en plan */
const roomGroup = new THREE.Group(); scene.add(roomGroup);
function buildRooms(){
  disposeGroup(roomGroup); roomGroup.visible = view === '2d' && APP_PREFS?.rooms !== false;
  if (!roomGroup.visible) return;
  const top = Math.max(0, ...state.els.filter(e => e.kind === 'slab' && e.lvl === curLvl && (e.off || 0) < 1).map(e => (e.off || 0) + slabT(e))), z = lvlZ(curLvl) + top + 0.006, cols = [0xDCEBF5, 0xF3E7D3, 0xE3F0DF, 0xF2DFE5, 0xE6E2F3, 0xF4F0D6];
  detectRooms(curLvl).forEach((r, i) => { const sh = new THREE.Shape(r.poly.map(p => new THREE.Vector2(p[0], p[1]))), g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, z, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color:cols[i % cols.length], polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2, toneMapped:false})); roomGroup.add(m); });
}
function renameRoom(r){
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Pièce · ${nf(r.net, 2)} m² utiles</span><h3 class="ed-t2">Nom de la pièce</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><div class="fields"><label class="f wide"><span>Nom</span><span class="in"><input id="rmN" type="text" maxlength="40" value="${esc(r.name)}" style="font-family:var(--f-body)"></span></label></div>
    <div class="chips" style="margin-top:8px">${['Séjour', 'Cuisine', 'Chambre', 'Salle de bain', 'WC', 'Entrée', 'Dégagement', 'Bureau', 'Cellier', 'Garage'].map(n => `<button class="chip" data-rmn="${n}">${n}</button>`).join('')}</div></div>
    <footer class="ed-f"><button class="btn" data-close>Annuler</button><button class="btn primary" id="rmOk">Enregistrer</button></footer>`, 'small');
  const ok = () => { pushHist(); state.roomNames ??= {}; state.roomNames[r.key] = d.querySelector('#rmN').value.trim().slice(0, 40) || r.name; roomsCache = null; closeEDlg(); buildLabels(); renderPanel(); };
  d.querySelectorAll('[data-rmn]').forEach(b => b.onclick = () => { d.querySelector('#rmN').value = b.dataset.rmn; });
  d.querySelector('#rmOk').onclick = ok; d.querySelector('#rmN').onkeydown = e => { if (e.key === 'Enter') ok(); }; setTimeout(() => d.querySelector('#rmN').select(), 30);
}
function roomsCard(){
  const rs = state.levels.flatMap((L, li) => detectRooms(li).map(r => ({...r, li})));
  if (!rs.length) return '';
  const tot = rs.reduce((s, r) => s + r.net, 0);
  return `<div class="grp"><h3>Pièces (${rs.length})</h3><table class="tbl rooms"><tbody>${rs.map(r => `<tr><td><button class="tlink" data-room="${esc(r.key)}">${esc(r.name)}</button></td><td class="mut">${esc(state.levels[r.li].n)}</td><td class="n">${nf(r.net, 2)} m²</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="2">Surface utile totale</td><td class="n">${nf(tot, 2)} m²</td></tr></tfoot></table><p class="hint">Pièces trouvées automatiquement dans les contours fermés de murs. Cliquez un nom (ici ou sur le plan) pour le changer.</p></div>`;
}

/* ---------- sélection multiple : copier vers un niveau, symétrie ---------- */
function cloneSel(ids, fn){
  pushHist(); const map = {}, made = [];
  for (const id of ids){ const el = getEl(id); if (!el || (el.kind === 'inst' && el.host && ids.includes(el.host))) continue; const c = fn(JSON.parse(JSON.stringify(el))); if (!c) continue; c.id = state.nextId++; map[id] = c.id; state.els.push(c); made.push(c.id); }
  state.els.filter(e => e.kind === 'inst' && e.host && map[e.host] && !made.includes(e.id)).forEach(e => { const c = fn(JSON.parse(JSON.stringify(e)), true); c.id = state.nextId++; c.host = map[e.host]; state.els.push(c); made.push(c.id); });
  state.isSample = false; rebuild(); return made;
}
function openCopyToLevel(ids = selIds()){
  if (!ids.length) return toast('Sélectionnez d\'abord les éléments');
  const src = getEl(ids[0])?.lvl ?? curLvl;
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">${ids.length} élément${ids.length > 1 ? 's' : ''}</span><h3 class="ed-t2">Copier vers un niveau</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><div class="fields"><label class="f wide"><span>Niveau de destination</span><span class="in"><select id="ctlL">${state.levels.map((l, i) => `<option value="${i}"${i === src ? ' disabled' : i === src + 1 ? ' selected' : ''}>${esc(l.n)} · ${nf(l.z)} m</option>`).join('')}<option value="new">+ Nouveau niveau au-dessus</option></select></span></label></div>
    <p class="hint">Les murs gardent leurs portes et fenêtres ; la hauteur par rapport au plancher est conservée.</p></div>
    <footer class="ed-f"><button class="btn" data-close>Annuler</button><button class="btn primary" id="ctlOk">Copier</button></footer>`, 'small');
  d.querySelector('#ctlOk').onclick = () => {
    let li = d.querySelector('#ctlL').value;
    if (li === 'new'){ const last = state.levels[state.levels.length - 1]; state.levels.push({n:`R+${state.levels.length}`, z:rnd((last?.z || 0) + 2.8)}); li = state.levels.length - 1; syncLevels(); } else li = +li;
    closeEDlg(); const made = cloneSel(ids, c => { c.lvl = li; return c; });
    curLvl = li; syncLevels(); positionGrid(); sel = made[0] || null; multi = made.slice(1); applySel(); buildLabels(); renderPanel(); toast(`${made.length} élément${made.length > 1 ? 's' : ''} copié${made.length > 1 ? 's' : ''} sur ${state.levels[li].n}`);
  };
}
function reflectPt(p, A, B){ const d = V.sub(B, A), L = V.len(d) || 1, u = V.mul(d, 1 / L), v = V.sub(p, A), k = V.dot(v, u); return [rnd(A[0] + 2 * k * u[0] - v[0]), rnd(A[1] + 2 * k * u[1] - v[1])]; }
function mirroredEl(m, A, B){
  const R = p => reflectPt(p, A, B), th = Math.atan2(B[1] - A[1], B[0] - A[0]), deg = th * 180 / Math.PI, swapXY = Math.abs(Math.cos(2 * th)) < 0.5;
  if (m.kind === 'wall'){ const a = R(m.a), b = R(m.b); m.a = b; m.b = a; }
  else if (m.kind === 'inst'){ if (m.host){ const w = getEl(m.host); if (w) m.t = rnd(wallAxis(w).L - (m.t || 0)); } else { m.c = R(m.c); m.rot = ((2 * deg - (m.rot || 0)) % 360 + 360) % 360; } m.mirror = !m.mirror; }
  else if (m.kind === 'slab' || m.kind === 'vol' || m.kind === 'roof'){ const r = rect(m.p, m.q).map(R); m.p = [Math.min(...r.map(p => p[0])), Math.min(...r.map(p => p[1]))]; m.q = [Math.max(...r.map(p => p[0])), Math.max(...r.map(p => p[1]))];
    if (m.poly) m.poly = m.poly.map(R).reverse(); if (m.kind === 'roof' && m.dir && swapXY) m.dir = m.dir === 'x' ? 'y' : 'x'; }
  else if (m.kind === 'col'){ m.c = R(m.c); if (swapXY) [m.w, m.d] = [m.d, m.w]; }
  else if (m.kind === 'stair'){ const a = (m.rot || 0) * Math.PI / 180, xd = [Math.cos(a), Math.sin(a)], yd = [-Math.sin(a), Math.cos(a)];
    const c2 = m.st === 'helico' ? R(m.c) : R(V.add(m.c, V.mul(xd, m.w || 0.9))), y2 = V.sub(R(V.add(m.c, yd)), R(m.c)); m.c = c2; m.rot = Math.round(((Math.atan2(-y2[0], y2[1]) * 180 / Math.PI) + 360) % 360 * 10) / 10; m.side = (m.side || 'd') === 'd' ? 'g' : 'd'; }
  return m;
}
function applyMirror(A, B){
  const ids = selIds(); if (!ids.length) return;
  if (defs.mirror.keep){ const made = cloneSel(ids, (c, hosted) => hosted ? mirroredEl(c, A, B) : mirroredEl(c, A, B)); sel = made[0] || null; multi = made.slice(1); }
  else { pushHist(); const hostedOf = new Set(ids); for (const id of ids){ const el = getEl(id); if (el) Object.assign(el, mirroredEl(JSON.parse(JSON.stringify(el)), A, B)); }
    state.els.filter(e => e.kind === 'inst' && e.host && hostedOf.has(e.host) && !hostedOf.has(e.id)).forEach(e => Object.assign(e, mirroredEl(JSON.parse(JSON.stringify(e)), A, B))); state.isSample = false; rebuild(); }
  applySel(); buildLabels(); renderPanel(); toast('Symétrie appliquée');
}
function previewMirror(A, B){ for (const id of selIds()){ const el = getEl(id); if (!el) continue; const m = mirroredEl(JSON.parse(JSON.stringify(el)), A, B); if (m.kind === 'inst'){ if (!m.host) instMeshes(m, true).forEach(x => previewGroup.add(x)); } else pieces(m).forEach(pc => previewGroup.add(pieceMesh(pc, true))); } }

/* ---------- dalle sur une pièce / sur l'emprise des murs ---------- */
function slabOnRoom(pt){
  const r = roomAt(pt); if (!r){ toast('Cliquez à l\'intérieur d\'une pièce fermée par des murs'); return; }
  const el = {kind:'slab', type:defs.slab.type, lvl:curLvl, off:offFromZ(), bind:{room:[rnd(pt[0]), rnd(pt[1])]}, p:[0, 0], q:[1, 1]}; setSlabPoly(el, r.poly); addEl(el);
}
function slabOnWalls(){
  const P = slabBindPoly({bind:'walls', lvl:curLvl}); if (!P){ toast('Aucun mur sur ce niveau'); return; }
  const el = {kind:'slab', type:defs.slab.type, lvl:curLvl, off:offFromZ(), bind:'walls', p:[0, 0], q:[1, 1]}; setSlabPoly(el, P); addEl(el);
}
/* ---------- cote modifiable : clic sur la longueur d'un mur sélectionné ---------- */
function editWallLength(el, d){
  const inp = document.createElement('input'); inp.className = 'dim-in'; inp.value = nf(wallAxis(el).L, 2).replace(/\s/g, ''); d.textContent = ''; d.appendChild(inp); inp.focus(); inp.select();
  const done = ok => { if (ok){ const v = num(inp.value); if (v > 0.01){ pushHist(); const before = wallEnds([el.id]); const {u} = wallAxis(el); if (wallArc(el)){ const k = v / wallAxis(el).L; el.b = [rnd(el.a[0] + (el.b[0] - el.a[0]) * k), rnd(el.a[1] + (el.b[1] - el.a[1]) * k)]; el.bulge = rnd(el.bulge * k); } else el.b = [rnd(el.a[0] + u[0] * v), rnd(el.a[1] + u[1] * v)]; followJoins(before); state.isSample = false; rebuild(); return; } } buildLabels(); };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); };
  inp.onblur = () => done(true);
}
