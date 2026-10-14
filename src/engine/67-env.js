/* ============ Environnement du projet : bâtiments, végétation, routes, eau ============
   Source : IGN BD TOPO® (service WFS de la Géoplateforme) ; repli sur OpenStreetMap (Overpass) si l'IGN ne répond pas
   ou hors de France. Le résultat est figé dans le projet :
   state.site.env = {at, src, size, cx, cy, opts, b:[{p, h}], r:[{p, w, k}], v:[{p, k}], w:[{p}], t:[[x, y, h, type]]}
   Coordonnées en mètres dans le repère du plan (origine = point d'adresse = 0;0 du projet). */
const WFS_URL = 'https://data.geopf.fr/wfs/ows', OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const ENV_WFS = {b:'BDTOPO_V3:batiment', r:'BDTOPO_V3:troncon_de_route', v:'BDTOPO_V3:zone_de_vegetation', w:'BDTOPO_V3:surface_hydrographique'};
const ENV_DEF = {b:true, r:true, v:true, w:true, drop:true};
const ROAD_W = {'Type autoroutier':22, 'Route à 2 chaussées':14, 'Route à 1 chaussée':6, 'Route empierrée':4, 'Bretelle':6, 'Rond-point':7, 'Chemin':3, 'Sentier':1.5, 'Piste cyclable':2, 'Escalier':2};
const OSM_W = {motorway:20, trunk:14, primary:10, secondary:8, tertiary:7, residential:6, unclassified:5, living_street:5, service:4, motorway_link:6, trunk_link:6, primary_link:6, secondary_link:6, track:3, footway:2, path:1.5, cycleway:2, steps:2, pedestrian:4, bridleway:2};
const PATHS = /chemin|sentier|piste|escalier|empierr|footway|path|cycleway|steps|track|bridleway|pedestrian/i;

function envArea(size){
  const T = state.site?.terrain; if (T) return {size:T.size, cx:T.cx, cy:T.cy};
  const b = bbox(); return {size, cx:(b.min.x + b.max.x) / 2, cy:-(b.min.z + b.max.z) / 2};
}
const ringArea = p => { let a = 0; for (let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
function inPoly(x, y, p){ let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++){ const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function clipPoly(p, X0, X1, Y0, Y1){ // Sutherland–Hodgman sur le carré d'étude
  const edges = [[q => q[0] >= X0, (a, b) => { const t = (X0 - a[0]) / (b[0] - a[0]); return [X0, a[1] + (b[1] - a[1]) * t]; }], [q => q[0] <= X1, (a, b) => { const t = (X1 - a[0]) / (b[0] - a[0]); return [X1, a[1] + (b[1] - a[1]) * t]; }],
    [q => q[1] >= Y0, (a, b) => { const t = (Y0 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, Y0]; }], [q => q[1] <= Y1, (a, b) => { const t = (Y1 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, Y1]; }]];
  let out = p;
  for (const [ins, cut] of edges){ const inp = out; out = []; for (let i = 0; i < inp.length; i++){ const a = inp[(i + inp.length - 1) % inp.length], b = inp[i]; if (ins(b)){ if (!ins(a)) out.push(cut(a, b)); out.push(b); } else if (ins(a)) out.push(cut(a, b)); } if (!out.length) break; }
  return out;
}
function clipLine(p, X0, X1, Y0, Y1){ // Liang–Barsky segment par segment ; renvoie les morceaux intérieurs
  const parts = []; let cur = null;
  for (let i = 0; i + 1 < p.length; i++){
    const [x1, y1] = p[i], [x2, y2] = p[i + 1], dx = x2 - x1, dy = y2 - y1; let t0 = 0, t1 = 1, ok = true;
    for (const [pp, qq] of [[-dx, x1 - X0], [dx, X1 - x1], [-dy, y1 - Y0], [dy, Y1 - y1]]){
      if (pp === 0){ if (qq < 0){ ok = false; break; } continue; }
      const r = qq / pp; if (pp < 0){ if (r > t1){ ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0){ ok = false; break; } if (r < t1) t1 = r; }
    }
    if (!ok){ cur = null; continue; }
    const a = [x1 + dx * t0, y1 + dy * t0], b = [x1 + dx * t1, y1 + dy * t1];
    if (!cur || t0 > 0){ cur = [a]; parts.push(cur); }
    cur.push(b); if (t1 < 1) cur = null;
  }
  return parts.filter(q => q.length > 1);
}
const simplify = (p, d = 0.3) => p.filter((q, i) => i === 0 || i === p.length - 1 || Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) > d);
const r2 = p => p.map(q => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]);

/* ---------- récupération des données ---------- */
async function wfsLayer(type, B){
  const p = new URLSearchParams({SERVICE:'WFS', VERSION:'2.0.0', REQUEST:'GetFeature', TYPENAMES:type, OUTPUTFORMAT:'application/json', COUNT:'2500', BBOX:`${B.s},${B.w},${B.n},${B.e},urn:ogc:def:crs:EPSG::4326`});
  return (await fetchJSON(`${WFS_URL}?${p}`, 25000)).features || [];
}
function geomParts(g, kind){ // kind 'poly' → anneaux extérieurs ; 'line' → polylignes
  if (!g) return [];
  if (kind === 'poly') return g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(p => p[0]) : [];
  return g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
}
async function fetchIGN(B, toXY){
  const res = await Promise.allSettled(Object.entries(ENV_WFS).map(async ([k, t]) => [k, await wfsLayer(t, B)]));
  const ok = res.filter(r => r.status === 'fulfilled').map(r => r.value); if (!ok.length) throw new Error('ign');
  const D = {b:[], r:[], v:[], w:[], t:[]};
  for (const [k, feats] of ok) for (const f of feats){
    const P = f.properties || {};
    if (k === 'r'){
      if (String(P.position_par_rapport_au_sol ?? '0').startsWith('-')) continue;
      const nat = P.nature || '', w = +P.largeur_de_chaussee > 0 ? +P.largeur_de_chaussee : ROAD_W[nat] ?? (+P.nombre_de_voies > 0 ? P.nombre_de_voies * 3 : 5);
      if (!w) continue; for (const l of geomParts(f.geometry, 'line')) D.r.push({p:l.map(toXY), w:Math.min(30, w), k:PATHS.test(nat) ? 'p' : 'r'});
    } else for (const ring of geomParts(f.geometry, 'poly')){
      const p = ring.map(toXY);
      if (k === 'b'){ const h = +P.hauteur > 0 ? +P.hauteur : +P.nombre_d_etages > 0 ? P.nombre_d_etages * 3 + 1 : 6; D.b.push({p, h:Math.min(200, h)}); }
      else if (k === 'v'){ const n = P.nature || ''; D.v.push({p, k:/haie/i.test(n) ? 'h' : /verger/i.test(n) ? 'o' : /vigne/i.test(n) ? 'g' : /lande/i.test(n) ? 'l' : /conif/i.test(n) ? 'c' : /ouverte/i.test(n) ? 'u' : 'f'}); }
      else D.w.push({p});
    }
  }
  return D;
}
async function fetchOSM(B, toXY){
  const bb = `(${B.s},${B.w},${B.n},${B.e})`;
  const q = `[out:json][timeout:25];(way["building"]${bb};way["highway"]${bb};way["natural"~"^(wood|scrub|water)$"]${bb};way["landuse"~"^(forest|orchard|vineyard)$"]${bb};node["natural"="tree"]${bb};);out geom;`;
  const c = new AbortController(), tm = setTimeout(() => c.abort(), 30000);
  let j; try { const r = await fetch(OVERPASS_URL, {method:'POST', body:'data=' + encodeURIComponent(q), headers:{'Content-Type':'application/x-www-form-urlencoded'}, signal:c.signal}); if (!r.ok) throw new Error('osm'); j = await r.json(); } finally { clearTimeout(tm); }
  const D = {b:[], r:[], v:[], w:[], t:[]};
  for (const e of j.elements || []){
    const T = e.tags || {};
    if (e.type === 'node'){ if (T.natural === 'tree'){ const [x, y] = toXY([e.lon, e.lat]); D.t.push([x, y, +T.height > 0 ? +T.height : 9, /conif|needle/i.test(T.leaf_type || '') ? 1 : 0]); } continue; }
    const p = (e.geometry || []).map(g => toXY([g.lon, g.lat])); if (p.length < 2) continue;
    if (T.building){ const h = parseFloat(T.height) > 0 ? parseFloat(T.height) : +T['building:levels'] > 0 ? T['building:levels'] * 3 + 1 : 6; D.b.push({p, h:Math.min(200, h)}); }
    else if (T.highway){ if (T.tunnel === 'yes' || +T.layer < 0) continue; const w = parseFloat(T.width) > 0 ? parseFloat(T.width) : OSM_W[T.highway]; if (w) D.r.push({p, w, k:PATHS.test(T.highway) ? 'p' : 'r'}); }
    else if (T.natural === 'water') D.w.push({p});
    else D.v.push({p, k:T.landuse === 'orchard' ? 'o' : T.landuse === 'vineyard' ? 'g' : T.natural === 'scrub' ? 'l' : /needle/i.test(T.leaf_type || '') ? 'c' : 'f'});
  }
  return D;
}
async function loadEnv(size = 100, opts = ENV_DEF){
  const s = state.site; if (!s?.lon) throw new Error('nosite');
  const A = envArea(size), h = A.size / 2, X0 = A.cx - h, X1 = A.cx + h, Y0 = A.cy - h, Y1 = A.cy + h;
  const B = {w:s.lon + mToLon(X0, s.lat), e:s.lon + mToLon(X1, s.lat), s:s.lat + mToLat(Y0), n:s.lat + mToLat(Y1)};
  const kx = 1 / mToLon(1, s.lat), ky = 1 / mToLat(1);
  let swap = null;
  const toXY = c => { if (swap === null) swap = Math.abs(c[0] - s.lon) + Math.abs(c[1] - s.lat) > Math.abs(c[1] - s.lon) + Math.abs(c[0] - s.lat); const lon = swap ? c[1] : c[0], lat = swap ? c[0] : c[1]; return [(lon - s.lon) * kx, (lat - s.lat) * ky]; };
  let D, src = 'IGN BD TOPO®';
  try { D = await fetchIGN(B, toXY); if (!D.b.length && !D.r.length && !D.v.length) throw new Error('empty'); }
  catch(e){ swap = null; D = await fetchOSM(B, toXY); src = 'OpenStreetMap'; }
  const fp = footprint(), m = 1.5;
  const out = {at:Date.now(), src, size:A.size, cx:A.cx, cy:A.cy, opts:{...opts}, b:[], r:[], v:[], w:[], t:[]};
  if (opts.b) for (const b of D.b){
    let p = simplify(b.p); if (p.length > 3 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 0.05) p.pop(); if (p.length < 3) continue;
    const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cy = p.reduce((a, q) => a + q[1], 0) / p.length;
    if (cx < X0 || cx > X1 || cy < Y0 || cy > Y1) continue;
    if (opts.drop && fp && cx > fp.x0 - m && cx < fp.x1 + m && cy > fp.y0 - m && cy < fp.y1 + m) continue;
    if (Math.abs(ringArea(p)) < 4) continue;
    out.b.push({p:r2(p), h:Math.round(b.h * 10) / 10}); if (out.b.length >= 600) break;
  }
  if (opts.r) for (const r of D.r.sort((a, b) => b.w - a.w)) for (const part of clipLine(simplify(r.p, 0.5), X0, X1, Y0, Y1)){ out.r.push({p:r2(part), w:r.w, k:r.k}); if (out.r.length >= 500) break; }
  const polys = (list, key) => { for (const v of list){ let p = v.p; if (p.length > 3 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 0.05) p = p.slice(0, -1); p = clipPoly(simplify(p, 0.5), X0, X1, Y0, Y1); if (p.length >= 3 && Math.abs(ringArea(p)) > 2) out[key].push({...v, p:r2(p)}); if (out[key].length >= 250) break; } };
  if (opts.v) polys(D.v, 'v');
  if (opts.w) polys(D.w, 'w');
  if (opts.v){ // arbres : isolés (OSM) + plantés dans les zones boisées, de façon reproductible
    const R = rng(Math.round(Math.abs(s.lon * 1e5 + s.lat * 1e5))), DENS = {f:1 / 45, c:1 / 40, u:1 / 140, o:1 / 36, h:1 / 10, l:1 / 220, g:0}, cap = 1400;
    for (const t of D.t) if (t[0] > X0 && t[0] < X1 && t[1] > Y0 && t[1] < Y1 && out.t.length < cap) out.t.push([Math.round(t[0] * 100) / 100, Math.round(t[1] * 100) / 100, t[2], t[3]]);
    for (const v of out.v){
      const A2 = Math.abs(ringArea(v.p)), n = Math.min(Math.round(A2 * (DENS[v.k] ?? 0)), cap - out.t.length); if (n <= 0) continue;
      const xs = v.p.map(q => q[0]), ys = v.p.map(q => q[1]), bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
      for (let k = 0, tries = 0; k < n && tries < n * 8; tries++){
        const x = bx0 + R() * (bx1 - bx0), y = by0 + R() * (by1 - by0); if (!inPoly(x, y, v.p)) continue;
        if (fp && x > fp.x0 - 3 && x < fp.x1 + 3 && y > fp.y0 - 3 && y < fp.y1 + 3) continue;
        const type = v.k === 'c' || (v.k === 'f' && R() < 0.12) ? 1 : v.k === 'o' ? 2 : v.k === 'h' || v.k === 'l' ? 3 : 0;
        const hh = type === 2 ? 4 + R() * 2 : type === 3 ? 2.5 + R() * 2 : type === 1 ? 12 + R() * 10 : 9 + R() * 9;
        out.t.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(hh * 10) / 10, type]); k++;
      }
    }
  }
  return out;
}

/* ---------- rendu ---------- */
const ENV_COL = {
  shaded:{bld:0xF3F2EF, bldE:0x9EA2A8, road:0xC9CCD0, path:0xDCCFB4, veg:0xC8D8B6, vegH:0xA9C29A, vine:0xE2DCB8, water:0xA9CCE0, crown:0xA6C493, crownC:0x8DAF86, trunk:0xB8A48C},
  real:{bld:0xD9D3C8, bldE:0x7E7A72, road:0x55595F, path:0xB3A385, veg:0x4E6B3B, vegH:0x3E5A30, vine:0x8E8A55, water:0x4C7891, crown:0x3D6A33, crownC:0x2C512E, trunk:0x6E5240}};
function drapedShape(p, H, dz){
  const pts = ringArea(p) < 0 ? p.slice().reverse() : p, g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(q => new THREE.Vector2(q[0], q[1]))));
  const a = g.attributes.position; for (let i = 0; i < a.count; i++){ const x = a.getX(i), y = a.getY(i); a.setXYZ(i, x, H(x, y) + dz, -y); }
  g.computeVertexNormals(); return g.index ? g.toNonIndexed() : g;
}
function ribbon(p, w, H, dz){
  const pts = []; for (let i = 0; i + 1 < p.length; i++){ const [a, b] = [p[i], p[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3)); for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  pts.push(p[p.length - 1]); if (pts.length < 2) return null;
  const pos = [], hw = w / 2;
  const off = i => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L * hw, dx / L * hw]; };
  const V = (x, y) => [x, H(x, y) + dz, -y];
  for (let i = 0; i + 1 < pts.length; i++){
    const o1 = off(i), o2 = off(i + 1), [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const A = V(x1 + o1[0], y1 + o1[1]), B = V(x1 - o1[0], y1 - o1[1]), C = V(x2 + o2[0], y2 + o2[1]), D = V(x2 - o2[0], y2 - o2[1]);
    pos.push(...A, ...B, ...C, ...C, ...B, ...D);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); return g;
}
function buildEnv(E, H, real, T){
  const C = real ? ENV_COL.real : ENV_COL.shaded, grp = new THREE.Group(); grp.name = 'Environnement';
  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness:0.95, metalness:0, ...extra});
  const add = (geos, mat, name, shadow = false) => { geos = geos.filter(Boolean); if (!geos.length) return null; geos.forEach(g => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); });
    const m = new THREE.Mesh(mergeGeos(geos), mat); m.name = name; m.castShadow = shadow; m.receiveShadow = true; m.userData.env = name; grp.add(m); return m; };
  // eau et végétation (surfaces drapées sur le relief)
  add(E.w.map(w => drapedShape(w.p, H, 0.02)), M(C.water, {roughness:0.3}), 'Eau');
  add(E.v.filter(v => v.k !== 'g' && v.k !== 'h').map(v => drapedShape(v.p, H, 0.025)), M(C.veg, {polygonOffset:true, polygonOffsetFactor:-1}), 'Végétation');
  add(E.v.filter(v => v.k === 'h').map(v => drapedShape(v.p, H, 0.03)), M(C.vegH), 'Haies');
  add(E.v.filter(v => v.k === 'g').map(v => drapedShape(v.p, H, 0.03)), M(C.vine), 'Vignes');
  // voirie
  add(E.r.filter(r => r.k === 'r').map(r => ribbon(r.p, r.w, H, 0.06)), M(C.road, {polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}), 'Routes');
  add(E.r.filter(r => r.k === 'p').map(r => ribbon(r.p, r.w, H, 0.05)), M(C.path, {polygonOffset:true, polygonOffsetFactor:-1}), 'Chemins');
  // bâtiments (volumes extrudés, posés sur le point bas du terrain)
  const bg = E.b.map(b => {
    const pts = ringArea(b.p) < 0 ? b.p.slice().reverse() : b.p, zs = pts.map(q => H(q[0], q[1])), z0 = Math.min(...zs) - 0.1, z1 = Math.max(...zs);
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(q => new THREE.Vector2(q[0], q[1]))), {depth:b.h + (z1 - z0), bevelEnabled:false});
    g.rotateX(-Math.PI / 2); g.translate(0, z0, 0); return g.index ? g.toNonIndexed() : g;
  });
  const bm = add(bg, M(C.bld, {roughness:0.85}), 'Bâtiments existants', true);
  if (bm && DISPLAY.edges !== false){ const e = new THREE.LineSegments(new THREE.EdgesGeometry(bm.geometry, 25), new THREE.LineBasicMaterial({color:C.bldE, transparent:true, opacity:0.7})); e.userData.envEdges = true; grp.add(e); }
  // arbres : tronc + houppier (feuillu, conifère, fruitier, arbuste)
  if (E.t.length){
    const tpl = {trunk:new THREE.CylinderGeometry(0.11, 0.17, 1, 5), ico:new THREE.IcosahedronGeometry(1, 0), cone:new THREE.ConeGeometry(1, 1, 7)};
    const crowns = [], cones = [], trunks = [];
    for (const [x, y, h, type] of E.t){
      const z = H(x, y), th = type === 3 ? 0.3 : type === 1 ? h * 0.25 : h * 0.38, sc = type === 3 ? 0.6 : h / 10;
      const t = tpl.trunk.clone(); t.scale(sc * 1.4, th, sc * 1.4); t.translate(x, z + th / 2, -y); trunks.push(t);
      if (type === 1){ const c = tpl.cone.clone(); c.scale(h * 0.22, h * 0.8, h * 0.22); c.translate(x, z + th + h * 0.38, -y); cones.push(c); }
      else { const r = type === 2 ? h * 0.4 : type === 3 ? h * 0.45 : h * 0.33, c = tpl.ico.clone(); c.scale(r, (h - th) * 0.55, r); c.rotateY((x * 7 + y * 13) % 6.28); c.translate(x, z + th + (h - th) * 0.5, -y); crowns.push(c); }
    }
    add(trunks, M(C.trunk), 'Troncs', true); add(crowns, M(C.crown, {flatShading:true}), 'Arbres', true); add(cones, M(C.crownC, {flatShading:true}), 'Conifères', true);
    Object.values(tpl).forEach(g => g.dispose());
  }
  terrainGroup.add(grp);
}
function envSummary(E){ if (!E) return ''; return `${E.b.length} bâtiment${E.b.length > 1 ? 's' : ''} · ${E.r.length} tronçon${E.r.length > 1 ? 's' : ''} de voirie · ${E.v.length} zone${E.v.length > 1 ? 's' : ''} végétale${E.v.length > 1 ? 's' : ''} · ${E.t.length} arbre${E.t.length > 1 ? 's' : ''}${E.w.length ? ` · ${E.w.length} surface${E.w.length > 1 ? 's' : ''} d'eau` : ''}`; }
