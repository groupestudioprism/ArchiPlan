/* ============ Simulation du trafic (agents autonomes) ============
   Chaque véhicule est un agent : il entre par une voie en bordure de zone, choisit une destination, calcule son itinéraire
   sur le réseau réel (sens uniques, interdictions de tourner, routes barrées → il prend la déviation), puis roule en
   respectant les distances de sécurité (modèle IDM), les feux tricolores et la priorité aux carrefours. */
const SIM_TYPES = {
  citadine:{f:() => makeCar('citadine', 0xffffff), mix:'vl', w:0.32, len:3.95}, berline:{f:() => makeCar('berline', 0xffffff), mix:'vl', w:0.34, len:4.75},
  suv:{f:() => makeCar('suv', 0xffffff), mix:'vl', w:0.2, len:4.55}, breakv:{f:() => makeCar('break', 0xffffff), mix:'vl', w:0.14, len:4.7},
  van:{f:() => makeVan(0xffffff), mix:'vul', w:1, len:5.4}, truck:{f:() => makeTruck(0xffffff), mix:'pl', w:0.65, len:9.8, pl:true}, semi:{f:() => makeSemi(0xffffff), mix:'pl', w:0.35, len:16.5, pl:true},
  bus:{f:() => makeBus(0xffffff), mix:'bus', w:1, len:12, pl:true}, moto:{f:() => makeMoto(0xffffff), mix:'r2', w:1, len:2.1},
};
const SIM = {on:false, t:0, speed:1, agents:[], inst:null, cap:360, entries:[], exits:[], rc:new Map(), base:new Map(), nextSpawn:new Map(), occ:new Map(), resv:new Map(), seq:0, stats:{n:0, done:0, sumT:0, sumT0:0, dev:0}, sigOff:new Map()};
/* instances : une InstancedMesh par type et par matériau */
function simBuildInstances(){
  if (SIM.inst) return SIM.inst;
  SIM.inst = {};
  for (const [k, T] of Object.entries(SIM_TYPES)){
    const g = T.f(); g.updateMatrixWorld(true); const parts = new Map();
    g.traverse(o => { if (!o.isMesh) return; const geo = o.geometry.clone().applyMatrix4(o.matrixWorld); const nonIdx = geo.index ? geo.toNonIndexed() : geo; for (const a of Object.keys(nonIdx.attributes)) if (!['position', 'normal', 'uv'].includes(a)) nonIdx.deleteAttribute(a); if (!nonIdx.attributes.uv) nonIdx.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(nonIdx.attributes.position.count * 2), 2));
      const key = o.material.uuid; (parts.get(key) || parts.set(key, {mat:o.material, geos:[]}).get(key)).geos.push(nonIdx); });
    SIM.inst[k] = [...parts.values()].map(({mat, geos}) => { const geo = mergeGeometries(geos); const body = !!mat.userData.body; const m = new THREE.InstancedMesh(geo, body ? new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.32, metalness:0.55}) : mat, SIM.cap);
      m.count = 0; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; m.userData.body = body; if (body) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SIM.cap * 3), 3); simGroup.add(m); return m; });
  }
  return SIM.inst;
}
function simEntries(){
  const S = WORLD.size / 2, ent = [], ex = [];
  for (const [id, n] of NET.nodes){
    const m = Math.max(Math.abs(n.xy[0]), Math.abs(n.xy[1])); if (m < S - 30 || m > S + 70) continue;
    let cls = 9; for (const ri of n.ways) cls = Math.min(cls, NET.roads[ri].cls); if (cls > 6) continue;
    // une entrée est un nœud de bord dont une arête mène vers l'intérieur
    const inward = n.out.some(ei => { const t = NET.nodes.get(NET.edges[ei].to).xy; return Math.max(Math.abs(t[0]), Math.abs(t[1])) < m; });
    const outward = n.inn.some(ei => { const f = NET.nodes.get(NET.edges[ei].from).xy; return Math.max(Math.abs(f[0]), Math.abs(f[1])) < m; });
    const rate = {1:0.3, 2:0.22, 3:0.12, 4:0.07, 5:0.035, 6:0.012}[cls] || 0.01;
    if (inward && nodeDeg(n) <= 2) ent.push({id, rate, cls}); if (outward && nodeDeg(n) <= 2) ex.push({id, w:rate, cls});
  }
  SIM.entries = ent; SIM.exits = ex;
}
function simNetworkChanged(){ SIM.rc.clear(); if (!SIM.on) return; const C = closedSets(state.els);
  for (const a of SIM.agents){ // ré-itinéraire depuis le prochain nœud
    const e = NET.edges[a.edges[a.ei]]; if (!e) continue; if (C.both.has(e.key) || C.dir.has(`${e.from}>${e.to}`)){ a.kill = true; continue; }
    const r = route(e.to, a.dest, C, {vtype:a.pl ? 'pl' : ''}); if (!r){ a.kill = true; continue; } a.edges = [...a.edges.slice(0, a.ei + 1), ...r.edges]; a.dev = true; }
}
function simStop(clear){ SIM.on = false; $('#simPlay')?.classList.remove('on'); const b = $('#simPlay'); if (b){ b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>'; b.setAttribute('aria-label', 'Lancer la simulation'); }
  if (clear){ SIM.agents = []; SIM.t = 0; SIM.stats = {n:0, done:0, sumT:0, sumT0:0, dev:0}; SIM.occ.clear(); SIM.resv.clear(); if (SIM.inst) for (const ms of Object.values(SIM.inst)) for (const m of ms) m.count = 0; simStatus(); } dirty = true; }
function simStart(){
  if (!WORLD){ toast('Choisissez d\'abord le lieu du chantier (outil Lieu).'); return; }
  simBuildInstances(); if (!SIM.entries.length || SIM.entriesFor !== WORLD) { simEntries(); SIM.entriesFor = WORLD; }
  if (!SIM.entries.length){ toast('Aucune voie d\'entrée trouvée en bordure de zone : agrandissez la zone du chantier.'); return; }
  SIM.on = true; const b = $('#simPlay'); b.classList.add('on'); b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>'; b.setAttribute('aria-label', 'Mettre en pause'); lastT = performance.now();
}
function pickWeighted(list, R = Math.random){ const tot = list.reduce((a, x) => a + x.w, 0); let r = R() * tot; for (const x of list){ r -= x.w; if (r <= 0) return x; } return list[list.length - 1]; }
function pickType(){
  const mix = state.sim.mix, grp = pickWeighted(Object.entries(mix).map(([k, w]) => ({k, w:+w || 0}))).k;
  const opts = Object.entries(SIM_TYPES).filter(([, T]) => T.mix === grp).map(([k, T]) => ({k, w:T.w}));
  return opts.length ? pickWeighted(opts).k : 'berline';
}
function simSpawn(dt){
  const C = closedSets(state.els), dens = +state.sim.dens || 1;
  for (const en of SIM.entries){
    let t = SIM.nextSpawn.get(en.id) ?? Math.random() * 6; t -= dt;
    if (t <= 0 && SIM.agents.length < SIM.cap - 4){
      t = -Math.log(1 - Math.random()) / (en.rate * dens);
      const occ = SIM.agents.some(a => a.ei === 0 && a.from === en.id && a.s < 9); if (occ){ SIM.nextSpawn.set(en.id, 1.5); continue; }
      const type = pickType(), T = SIM_TYPES[type];
      const exits = SIM.exits.filter(x => x.id !== en.id && V.dist(NET.nodes.get(x.id).xy, NET.nodes.get(en.id).xy) > 80); if (!exits.length) continue;
      const dest = pickWeighted(exits).id, key = `${en.id}|${dest}|${T.pl ? 'pl' : ''}`;
      let r = SIM.rc.get(key); if (r === undefined){ r = route(en.id, dest, C, {vtype:T.pl ? 'pl' : ''}) || null; SIM.rc.set(key, r); }
      if (!r || !r.edges.length) { SIM.nextSpawn.set(en.id, t); continue; }
      let base = SIM.base.get(key); if (base === undefined){ base = route(en.id, dest, closedSets([]), {vtype:T.pl ? 'pl' : ''}); SIM.base.set(key, base); }
      const col = new THREE.Color(T.mix === 'bus' ? 0xF2F4F6 : T.pl && Math.random() < 0.5 ? 0xE9ECEF : BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)]);
      const v0 = Math.min(NET.edges[r.edges[0]].sp, 14);
      SIM.agents.push({id:++SIM.seq, type, len:T.len, pl:!!T.pl, edges:r.edges.slice(), ei:0, s:0, v:v0 * 0.7, from:en.id, dest, col, t0:SIM.t, free:r.time, dev:!!base && r.len > base.len + 5, wait:0});
      SIM.stats.n++;
    }
    SIM.nextSpawn.set(en.id, t);
  }
}
function sigGreen(n, e){ // feu vert pour l'approche e au nœud n ?
  let off = SIM.sigOff.get(n.id); if (off === undefined){ off = Math.random() * 60; SIM.sigOff.set(n.id, off); }
  const a = NET.nodes.get(e.from).xy, d = V.norm(V.sub(n.xy, a)), ew = Math.abs(d[0]) > Math.abs(d[1]), ph = (SIM.t + off) % 60;
  return ew ? ph < 27 : ph >= 30 && ph < 57;
}
function simStep(dt){
  SIM.t += dt; simSpawn(dt);
  // occupation des arêtes (tri par abscisse)
  const occ = new Map(); for (const a of SIM.agents){ const ei = a.edges[a.ei]; (occ.get(ei) || occ.set(ei, []).get(ei)).push(a); } for (const l of occ.values()) l.sort((x, y) => x.s - y.s);
  const C = closedSets(state.els);
  for (const a of SIM.agents){
    const e = NET.edges[a.edges[a.ei]]; if (!e){ a.kill = true; continue; }
    const v0 = e.sp * (C.slow.get(e.key) || 1) * (a.pl ? 0.85 : 1);
    // véhicule devant (même arête, puis arêtes suivantes)
    let gap = Infinity, vl = 0; const list = occ.get(a.edges[a.ei]), idx = list.indexOf(a);
    if (idx + 1 < list.length){ const b = list[idx + 1]; gap = b.s - a.s - b.len; vl = b.v; }
    else { let acc = e.len - a.s; for (let k = a.ei + 1; k < Math.min(a.edges.length, a.ei + 4) && gap === Infinity; k++){ const l2 = occ.get(a.edges[k]); if (l2?.length){ const b = l2[0]; gap = acc + b.s - b.len; vl = b.v; } else acc += NET.edges[a.edges[k]].len; if (acc > 80) break; } }
    // arrêt au bout de l'arête : feu rouge, priorité, fin de parcours
    const rem = e.len - a.s, n = NET.nodes.get(e.to), nextE = NET.edges[a.edges[a.ei + 1]];
    if (nextE && rem < 40){
      let stop = false;
      if (n.sig && !sigGreen(n, e)) stop = rem > 1.5;
      else if (nodeDeg(n) >= 3){ const r = SIM.resv.get(n.id); if (r && r.a !== a.id && SIM.t - r.t < 3.5 && r.from !== e.from) stop = rem > 1 && rem < 14; else if (rem < 9) SIM.resv.set(n.id, {a:a.id, t:SIM.t, from:e.from}); }
      // virage serré : ralentir
      const d1 = V.norm(V.sub(n.xy, NET.nodes.get(e.from).xy)), d2 = V.norm(V.sub(NET.nodes.get(nextE.to).xy, n.xy)), cosT = V.dot(d1, d2);
      if (cosT < 0.7 && rem < 25){ const vt = cosT < 0 ? 4 : 6.5; if (a.v > vt) gap = Math.min(gap, rem + 6), vl = Math.min(vl || vt, vt); }
      if (stop){ gap = Math.min(gap, rem - 1); vl = 0; }
    }
    const s0 = 2, T = 1.2, am = a.pl ? 0.9 : 1.6, bm = 2.2, dv = a.v - vl, ss = s0 + Math.max(0, a.v * T + a.v * dv / (2 * Math.sqrt(am * bm)));
    let acc = am * (1 - Math.pow(a.v / Math.max(1, v0), 4) - (gap < Infinity ? Math.pow(ss / Math.max(0.1, gap), 2) : 0));
    acc = clamp(acc, -8, am); a.v = Math.max(0, a.v + acc * dt); if (gap < 0.5) a.v = 0;
    a.s += a.v * dt; if (a.v < 0.5) a.wait += dt;
    while (a.s >= NET.edges[a.edges[a.ei]].len){ a.s -= NET.edges[a.edges[a.ei]].len; a.ei++; if (a.ei >= a.edges.length){ a.done = true; break; } }
    if (a.done){ SIM.stats.done++; SIM.stats.sumT += SIM.t - a.t0; SIM.stats.sumT0 += a.free; }
  }
  SIM.agents = SIM.agents.filter(a => !a.done && !a.kill);
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function simRender(){
  if (!SIM.inst) return; const cnt = {};
  for (const k of Object.keys(SIM.inst)) cnt[k] = 0;
  for (const a of SIM.agents){
    const e = NET.edges[a.edges[a.ei]]; if (!e) continue; const A = NET.nodes.get(e.from).xy, B = NET.nodes.get(e.to).xy, d = V.norm(V.sub(B, A));
    const road = NET.roads[e.r], lat = road.oneway ? 0 : Math.min(road.w / 4, 2.2), mid = a.s - a.len / 2;
    let p = V.add(V.lerp(A, B, clamp(mid / e.len, 0, 1)), V.mul(V.perp(d), -lat)), dir = d;
    if (mid < 0 && a.ei > 0){ const pe = NET.edges[a.edges[a.ei - 1]], PA = NET.nodes.get(pe.from).xy, pd = V.norm(V.sub(A, PA)); const pr = NET.roads[pe.r], pl = pr.oneway ? 0 : Math.min(pr.w / 4, 2.2); p = V.add(V.add(A, V.mul(pd, mid)), V.mul(V.perp(pd), -pl)); const t = clamp(-mid / a.len, 0, 1); dir = V.norm(V.lerp(d, pd, t)); }
    const k = a.type, i = cnt[k]++; if (i >= SIM.cap) continue;
    _p.set(p[0], H(p[0], p[1]) + 0.02, -p[1]); _q.setFromAxisAngle(_up, Math.atan2(dir[1], dir[0])); _m4.compose(_p, _q, _s);
    for (const m of SIM.inst[k]){ m.setMatrixAt(i, _m4); if (m.userData.body) m.setColorAt(i, a.col); }
  }
  for (const [k, ms] of Object.entries(SIM.inst)) for (const m of ms){ m.count = Math.min(cnt[k], SIM.cap); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
function simStatus(){
  const n = SIM.agents.length, h = 7 * 3600 + 30 * 60 + SIM.t, hh = String(Math.floor(h / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(h % 3600 / 60)).padStart(2, '0'), ss = String(Math.floor(h % 60)).padStart(2, '0');
  const vm = n ? SIM.agents.reduce((s, a) => s + a.v, 0) / n * 3.6 : 0, dev = SIM.agents.filter(a => a.dev).length, stopped = SIM.agents.filter(a => a.v < 0.5).length;
  $('#simClock').textContent = SIM.t > 0 ? `${hh}:${mm}:${ss}` : 'Simulation';
  $('#simStat').textContent = SIM.t > 0 ? `${n} véhicule${n > 1 ? 's' : ''} · ${Math.round(vm)} km/h moy.${dev ? ` · ${dev} dévié${dev > 1 ? 's' : ''}` : ''}${stopped > n * 0.4 && n > 10 ? ' · ralentissements' : ''}` : 'Trafic à l\'arrêt';
  SIM.live = {n, vm, dev, stopped, done:SIM.stats.done, delay:SIM.stats.done ? (SIM.stats.sumT - SIM.stats.sumT0) / SIM.stats.done : 0};
}
let lastT = performance.now(), statT = 0;
function simTick(now){
  if (!SIM.on){ lastT = now; return; }
  let dt = Math.min(0.1, (now - lastT) / 1000) * SIM.speed; lastT = now;
  while (dt > 0){ const st = Math.min(0.1, dt); simStep(st); dt -= st; }
  simRender(); dirty = true;
  if (now - statT > 500){ statT = now; simStatus(); if (activeTab === 'traffic') renderTrafficStats(); }
}
