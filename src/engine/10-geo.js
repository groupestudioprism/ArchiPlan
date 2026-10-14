/* ============ Données géographiques : adresse, relief NGF, rues, bâtiments, végétation ============
   Sources publiques et libres, chargées pour la seule zone du chantier, partout en France :
   - Géoplateforme IGN (data.geopf.fr) : géocodage, altitudes RGE ALTI® en NGF-IGN69, bâtiments BD TOPO® (hauteurs, toits, matériaux), photo aérienne.
     Licence Ouverte Etalab 2.0.
   - OpenStreetMap (Overpass) : voies avec sens uniques, impasses, interdictions de tourner, feux, passages piétons, arbres, espaces verts. ODbL.
   Repère du projet : origine = point d'adresse, x vers l'est, y vers le nord, en mètres ; altitudes relatives à l'altitude NGF de l'origine. */
const GEO_SEARCH = 'https://data.geopf.fr/geocodage/search', GEO_REVERSE = 'https://data.geopf.fr/geocodage/reverse';
const GEO_ALTI = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
const WMS_R = 'https://data.geopf.fr/wms-r', WFS_URL = 'https://data.geopf.fr/wfs/ows';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const DATA_VER = 3;   // version du format en cache (incrémenter si l'analyse change)

async function fetchJSON(url, ms = 12000, opt = {}){
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, {...opt, signal:c.signal}); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function geoSearch(q){
  const j = await fetchJSON(`${GEO_SEARCH}?${new URLSearchParams({q, limit:'7'})}`);
  return (j.features || []).map(f => { const p = f.properties || {}, [lon, lat] = f.geometry?.coordinates || [];
    return {label:p.label || p.name || q, lon, lat, postcode:p.postcode || '', citycode:String(p.citycode || ''), city:p.city || '', context:p.context || '', type:p.type || ''}; })
    .filter(r => Number.isFinite(r.lon) && Number.isFinite(r.lat));
}
async function geoReverse(lon, lat){
  try { const j = await fetchJSON(`${GEO_REVERSE}?${new URLSearchParams({lon:lon.toFixed(6), lat:lat.toFixed(6), limit:'1'})}`, 8000); const p = j.features?.[0]?.properties; return p ? (p.label || '') : ''; } catch(e){ return ''; }
}
/* projection locale (équirectangulaire autour de l'origine : < 1 cm d'écart sur 1 km) */
function makeProj(lat0, lon0){
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  return {lat0, lon0, kx, ky, toXY:(lon, lat) => [(lon - lon0) * kx, (lat - lat0) * ky], toLL:(x, y) => [lon0 + x / kx, lat0 + y / ky]};
}
function areaBounds(P, size){ const h = size / 2, [w, s] = P.toLL(-h, -h), [e, n] = P.toLL(h, h); return {w, s, e, n}; }

/* ---------- relief : grille d'altitudes NGF (RGE ALTI®) ---------- */
async function elevBIL(B, N){ // WMS-R au format BIL 32 bits : toute la grille en une requête
  const p = new URLSearchParams({SERVICE:'WMS', VERSION:'1.3.0', REQUEST:'GetMap', LAYERS:'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES', STYLES:'', CRS:'EPSG:4326',
    BBOX:`${B.s},${B.w},${B.n},${B.e}`, WIDTH:String(N), HEIGHT:String(N), FORMAT:'image/x-bil;bits=32'});
  const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fetch(`${WMS_R}?${p}`, {signal:c.signal}); if (!r.ok) throw new Error('bil ' + r.status);
    const buf = await r.arrayBuffer(); if (buf.byteLength !== N * N * 4) throw new Error('bil size');
    const dv = new DataView(buf), z = new Float32Array(N * N); let ok = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){ const v = dv.getFloat32(((N - 1 - j) * N + i) * 4, true); z[j * N + i] = v > -500 && v < 6000 ? v : NaN; if (v > -500 && v < 6000) ok++; }
    if (ok < N * N * 0.5) throw new Error('bil nodata');
    return z;   // ligne j = du sud au nord
  } finally { clearTimeout(t); }
}
async function elevREST(P, size, N, onStep){ // repli : service de calcul altimétrique, par lots de points
  const pts = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push(P.toLL(-size / 2 + size * i / (N - 1), -size / 2 + size * j / (N - 1)));
  const z = new Float32Array(pts.length), B = 150;
  for (let k = 0; k < pts.length; k += B){
    const ch = pts.slice(k, k + B);
    const j = await fetchJSON(`${GEO_ALTI}?${new URLSearchParams({lon:ch.map(p => p[0].toFixed(6)).join('|'), lat:ch.map(p => p[1].toFixed(6)).join('|'), resource:'ign_rge_alti_wld', delimiter:'|', zonly:'true', indent:'false'})}`, 15000);
    (j.elevations || []).forEach((v, i) => { const e = typeof v === 'number' ? v : v?.z; z[k + i] = e == null || e < -900 ? NaN : e; });
    onStep?.(Math.min(1, (k + B) / pts.length)); if (k + B < pts.length) await sleep(210);
  }
  return z;
}
function fillNaN(z, N){ // trous (hors couverture) : moyenne des voisins, puis valeur médiane
  const ok = [...z].filter(Number.isFinite).sort((a, b) => a - b), med = ok.length ? ok[ok.length >> 1] : 0;
  for (let pass = 0; pass < 4; pass++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){ const k = j * N + i; if (Number.isFinite(z[k])) continue; let s = 0, n = 0; for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]){ const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < N && b < N && Number.isFinite(z[b * N + a])){ s += z[b * N + a]; n++; } } if (n) z[k] = s / n; }
  for (let k = 0; k < z.length; k++) if (!Number.isFinite(z[k])) z[k] = med;
  return z;
}
async function loadElevation(P, size, onStep){
  const N = clamp(Math.round(size / 4) + 1, 81, 257), B = areaBounds(P, size);
  let z, src = 'IGN RGE ALTI® 1 m (WMS)';
  try { z = await elevBIL(B, N); }
  catch(e){ const n2 = clamp(Math.round(size / 10) + 1, 41, 81); src = 'IGN RGE ALTI® (calcul altimétrique)'; z = await elevREST(P, size, n2, onStep); return {N:n2, z:fillNaN(z, n2), src}; }
  return {N, z:fillNaN(z, N), src};
}

/* ---------- OpenStreetMap (Overpass) ---------- */
async function overpass(q){
  let err;
  for (const url of OVERPASS){
    const c = new AbortController(), t = setTimeout(() => c.abort(), 70000);
    try { const r = await fetch(url, {method:'POST', body:'data=' + encodeURIComponent(q), headers:{'Content-Type':'application/x-www-form-urlencoded'}, signal:c.signal}); if (!r.ok) throw new Error('overpass ' + r.status); return await r.json(); }
    catch(e){ err = e; } finally { clearTimeout(t); }
  }
  throw err || new Error('overpass');
}
async function loadOSM(B){
  const bb = `(${B.s},${B.w},${B.n},${B.e})`;
  const q = `[out:json][timeout:60];(
way["highway"]${bb};
way["building"]${bb};way["building:part"]${bb};
way["landuse"]${bb};way["leisure"~"^(park|garden|pitch|playground|sports_centre)$"]${bb};way["natural"~"^(wood|scrub|water|grassland|heath|wetland)$"]${bb};way["amenity"~"^(parking|school|place_of_worship)$"]${bb};
way["waterway"~"^(river|canal|stream)$"]${bb};way["railway"~"^(rail|tram|light_rail)$"]${bb};way["barrier"~"^(wall|fence|hedge|retaining_wall)$"]${bb};
node["natural"="tree"]${bb};node["highway"~"^(traffic_signals|stop|give_way|crossing|street_lamp|bus_stop|mini_roundabout)$"]${bb};node["amenity"~"^(bench|waste_basket|bicycle_parking)$"]${bb};
relation["type"="restriction"]${bb};relation["type"="multipolygon"]["building"]${bb};
);out body geom qt;`;
  return await overpass(q);
}

/* ---------- BD TOPO® : bâtiments (hauteur, altitude des toits, matériaux) ---------- */
async function loadBDTopo(B){
  const out = [];
  for (let start = 0; start < 20000; start += 5000){
    const p = new URLSearchParams({SERVICE:'WFS', VERSION:'2.0.0', REQUEST:'GetFeature', TYPENAMES:'BDTOPO_V3:batiment', OUTPUTFORMAT:'application/json', COUNT:'5000', STARTINDEX:String(start), BBOX:`${B.s},${B.w},${B.n},${B.e},urn:ogc:def:crs:EPSG::4326`});
    const j = await fetchJSON(`${WFS_URL}?${p}`, 40000); const f = j.features || []; out.push(...f); if (f.length < 5000) break;
  }
  return out;
}

/* ---------- analyse : du brut au « monde » du projet ---------- */
const ROAD_CLASS = {motorway:1, trunk:1, primary:2, secondary:3, tertiary:4, unclassified:5, residential:5, living_street:6, service:7, motorway_link:2, trunk_link:2, primary_link:3, secondary_link:4, tertiary_link:5, road:5, busway:6};
const ROAD_SPEED = {motorway:110, trunk:90, primary:50, secondary:50, tertiary:50, unclassified:40, residential:30, living_street:20, service:20, motorway_link:70, trunk_link:60, primary_link:40, secondary_link:40, tertiary_link:30, road:30, busway:30};
const ROAD_LANES = {motorway:2, trunk:2, primary:2, secondary:2, tertiary:2, unclassified:2, residential:2, living_street:1, service:1, motorway_link:1, trunk_link:1, primary_link:1, secondary_link:1, tertiary_link:1, road:2, busway:1};
const FOOT = /^(footway|path|cycleway|steps|pedestrian|track|bridleway|corridor|elevator|platform)$/;
function roadWidth(T){
  const w = parseFloat(String(T.width || '').replace(',', '.')); if (w > 1.5 && w < 40) return w;
  const hw = T.highway; if (FOOT.test(hw)) return hw === 'pedestrian' ? 6 : hw === 'track' ? 3 : hw === 'cycleway' ? 2.2 : 1.8;
  const ln = +T.lanes > 0 ? +T.lanes : (T.oneway === 'yes' || T.junction === 'roundabout' ? Math.max(1, (ROAD_LANES[hw] || 2) - (hw === 'residential' ? 0 : 1)) : ROAD_LANES[hw] || 2);
  const lw = hw === 'motorway' || hw === 'trunk' ? 3.5 : hw === 'residential' || hw === 'service' || hw === 'living_street' ? 2.9 : 3.2;
  return clamp(ln * lw + (hw === 'service' ? 0.6 : 0.4), 3, 30);
}
function parseMaxspeed(v, hw){ const m = parseFloat(v); if (m > 0) return m; if (/FR:zone30|zone30/i.test(v || '')) return 30; if (/FR:urban/i.test(v || '')) return 50; if (/FR:rural/i.test(v || '')) return 80; return ROAD_SPEED[hw] || 30; }
const BDT_WALL = {'00':'enduit', '01':'pierre', '02':'meuliere', '03':'beton', '04':'brique', '05':'agglo', '06':'bois', '09':'enduit', '10':'pierre', '11':'pierre', '12':'pierre', '13':'brique', '14':'brique', '20':'meuliere', '30':'beton', '40':'brique', '50':'agglo', '60':'bois'};
const BDT_ROOF = {'00':'', '01':'tuiles', '02':'ardoises', '03':'zinc', '04':'beton', '05':'verre', '06':'bois', '09':'', '10':'tuiles', '12':'tuiles', '13':'tuiles', '20':'ardoises', '30':'zinc', '40':'beton'};
function simplifyRing(p, d = 0.25){ const o = p.filter((q, i) => i === 0 || V.dist(q, p[i - 1]) > d); if (o.length > 3 && V.dist(o[0], o[o.length - 1]) < 0.05) o.pop(); return o; }
function parseWorld(raw, P, size){
  const W = {size, roads:[], bld:[], areas:[], trees:[], points:[], restr:[], rails:[], water:[], walls:[], nodes:new Map(), src:raw.src || {}};
  const half = size / 2 + 60, inside = q => Math.abs(q[0]) < half && Math.abs(q[1]) < half;
  const osm = raw.osm?.elements || [];
  const byId = new Map();
  for (const e of osm){
    if (e.type === 'node'){
      const xy = P.toXY(e.lon, e.lat), T = e.tags || {};
      if (T.natural === 'tree') W.trees.push({x:xy[0], y:xy[1], h:parseFloat(T.height) > 0 ? parseFloat(T.height) : 0, k:/needle|conif/i.test(T.leaf_type || '') ? 'c' : 'f'});
      else if (T.highway || T.amenity) W.points.push({id:e.id, x:xy[0], y:xy[1], k:T.highway || T.amenity, tags:T});
      continue;
    }
    if (e.type === 'way'){
      const pts = (e.geometry || []).map(g => P.toXY(g.lon, g.lat)); if (pts.length < 2) continue;
      const T = e.tags || {}; byId.set(e.id, {pts, nodes:e.nodes || []});
      e.nodes?.forEach((nid, i) => { if (pts[i]) W.nodes.set(nid, pts[i]); });
      if (T.highway && !/^(proposed|construction|abandoned|razed|raceway)$/.test(T.highway)){
        if (T.area === 'yes' && T.highway !== 'pedestrian') continue;
        const hw = T.highway, foot = FOOT.test(hw), noCar = v => /^(no|private|agricultural|forestry|delivery)$/.test(v || '');
        const drive = !foot && hw !== 'busway' && !noCar(T.motor_vehicle) && !noCar(T.vehicle) && !(noCar(T.access) && !T.motor_vehicle);
        const layer = +T.layer || 0, tunnel = T.tunnel === 'yes' || T.tunnel === 'building_passage' || T.covered === 'yes';
        W.roads.push({id:e.id, nodes:e.nodes || [], pts, hw, name:T.name || T.ref || '', ref:T.ref || '', w:roadWidth(T), foot, drive:drive && !foot,
          oneway:T.oneway === 'yes' || T.oneway === '1' || T.oneway === 'true' ? 1 : T.oneway === '-1' ? -1 : (T.junction === 'roundabout' || T.junction === 'circular' || hw === 'motorway') && T.oneway !== 'no' ? 1 : 0,
          speed:parseMaxspeed(T.maxspeed, hw), cls:ROAD_CLASS[hw] || 8, lanes:+T.lanes || 0, round:T.junction === 'roundabout' || T.junction === 'circular', bridge:T.bridge === 'yes' || T.bridge === 'viaduct', tunnel, layer,
          sidewalk:T.sidewalk || T['sidewalk:both'] || '', surface:T.surface || '', psv:hw === 'busway' || T.access === 'psv', bus:T['oneway:bus'] === 'no' || T['busway'] === 'opposite_lane',
          cycle:T.cycleway || T['cycleway:right'] || T['cycleway:left'] || '', parking:T['parking:lane:both'] || T['parking:both'] || T['parking:lane:right'] || T['parking:right'] || '', tags:T});
      }
      else if (T.building || T['building:part']){
        if (T.building === 'roof' || T['building:part'] === 'roof') { /* auvents : ignorés */ }
        else { const p = simplifyRing(pts); if (p.length >= 3 && Math.abs(ringArea(p)) > 3 && inside(centroid(p))) W.bld.push({osm:e.id, p, part:!!T['building:part'], h:parseFloat(T.height) || 0, lv:+T['building:levels'] || 0, minH:parseFloat(T.min_height) || 0,
          roof:T['roof:shape'] || '', roofC:T['roof:colour'] || '', wallC:T['building:colour'] || '', mat:T['building:material'] || '', roofM:T['roof:material'] || '', kind:T.building || 'yes', name:T.name || ''}); }
      }
      else if (T.railway){ W.rails.push({pts, k:T.railway}); }
      else if (T.waterway){ W.water.push({pts, line:true, w:T.waterway === 'river' ? 12 : T.waterway === 'canal' ? 10 : 3}); }
      else if (T.barrier){ W.walls.push({pts, k:T.barrier, h:parseFloat(T.height) || (T.barrier === 'hedge' ? 1.6 : T.barrier === 'fence' ? 1.5 : 1.8)}); }
      else {
        const k = T.natural === 'water' || T.landuse === 'reservoir' || T.landuse === 'basin' ? 'water'
          : T.natural === 'wood' || T.landuse === 'forest' ? 'wood' : T.natural === 'scrub' || T.natural === 'heath' ? 'scrub'
          : T.leisure === 'park' || T.leisure === 'garden' || T.landuse === 'grass' || T.landuse === 'village_green' || T.landuse === 'recreation_ground' || T.natural === 'grassland' || T.landuse === 'meadow' || T.landuse === 'cemetery' ? 'grass'
          : T.leisure === 'pitch' || T.leisure === 'playground' || T.leisure === 'sports_centre' ? 'pitch'
          : T.amenity === 'parking' ? 'parking' : T.landuse === 'farmland' || T.landuse === 'orchard' || T.landuse === 'vineyard' || T.landuse === 'allotments' ? 'farm'
          : T.landuse === 'construction' ? 'works' : T.landuse === 'railway' ? 'rail' : null;
        if (!k) continue; const p = simplifyRing(pts, 0.5); if (p.length >= 3 && Math.abs(ringArea(p)) > 4) (k === 'water' ? W.water : W.areas).push({p, k});
      }
    }
    if (e.type === 'relation' && e.tags?.type === 'restriction'){
      const R = e.tags.restriction || e.tags['restriction:motorcar'] || ''; if (!R) continue;
      const from = e.members?.find(m => m.role === 'from' && m.type === 'way'), via = e.members?.find(m => m.role === 'via' && m.type === 'node'), to = e.members?.find(m => m.role === 'to' && m.type === 'way');
      if (from && via && to) W.restr.push({from:from.ref, via:via.ref, to:to.ref, only:R.startsWith('only_'), k:R});
    }
    if (e.type === 'relation' && e.tags?.type === 'multipolygon' && e.tags.building){
      const outer = e.members?.find(m => m.role === 'outer' && m.geometry); if (!outer) continue;
      const p = simplifyRing(outer.geometry.map(g => P.toXY(g.lon, g.lat))); const T = e.tags;
      if (p.length >= 3 && Math.abs(ringArea(p)) > 3 && inside(centroid(p))) W.bld.push({osm:e.id, p, h:parseFloat(T.height) || 0, lv:+T['building:levels'] || 0, minH:0, roof:T['roof:shape'] || '', roofC:T['roof:colour'] || '', wallC:T['building:colour'] || '', mat:'', roofM:'', kind:T.building, name:T.name || ''});
    }
  }
  // BD TOPO : remplace les bâtiments OSM (emprises et hauteurs officielles) ; les couleurs OSM sont reportées quand elles existent
  if (raw.bdt?.length){
    let swap = null;
    const toXY = c => { if (swap === null) swap = Math.abs(c[0] - P.lon0) + Math.abs(c[1] - P.lat0) > Math.abs(c[1] - P.lon0) + Math.abs(c[0] - P.lat0); return swap ? P.toXY(c[1], c[0]) : P.toXY(c[0], c[1]); };
    const osmB = W.bld.filter(b => !b.part); const grid = new Map(), gk = (x, y) => `${Math.floor(x / 25)},${Math.floor(y / 25)}`;
    osmB.forEach(b => { const c = centroid(b.p), k = gk(...c); (grid.get(k) || grid.set(k, []).get(k)).push(b); });
    const out = [];
    for (const f of raw.bdt){
      const g = f.geometry, Pp = f.properties || {}; if (!g) continue;
      const rings = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const r of rings){
        const p = simplifyRing(r[0].map(toXY)); if (p.length < 3 || Math.abs(ringArea(p)) < 3) continue; const c = centroid(p); if (!inside(c)) continue;
        const holes = r.slice(1).map(h => simplifyRing(h.map(toXY))).filter(h => h.length >= 3 && Math.abs(ringArea(h)) > 2);
        let h = +Pp.hauteur > 0 ? +Pp.hauteur : +Pp.nombre_d_etages > 0 ? Pp.nombre_d_etages * 3 + 0.8 : 0;
        const zr0 = +Pp.altitude_minimale_toit, zr1 = +Pp.altitude_maximale_toit, zs = +Pp.altitude_minimale_sol;
        if (!(h > 0) && zr1 > 0 && zs > 0) h = zr1 - zs;
        const ridge = zr1 > 0 && zr0 > 0 ? Math.max(0, zr1 - zr0) : 0;
        let mate = null; const cand = [-1, 0, 1].flatMap(dx => [-1, 0, 1].flatMap(dy => grid.get(`${Math.floor(c[0] / 25) + dx},${Math.floor(c[1] / 25) + dy}`) || []));
        for (const b of cand) if (inPoly(c[0], c[1], b.p)) { mate = b; break; }
        out.push({p, holes, h:h > 0 ? Math.min(h, 250) : 0, lv:+Pp.nombre_d_etages || mate?.lv || 0, ridge, minH:0, roof:mate?.roof || '', roofC:mate?.roofC || '', wallC:mate?.wallC || '',
          mat:BDT_WALL[String(Pp.materiaux_des_murs || '').padStart(2, '0')] || mate?.mat || '', roofM:BDT_ROOF[String(Pp.materiaux_de_la_toiture || '').padStart(2, '0')] || mate?.roofM || '',
          kind:String(Pp.usage_1 || Pp.nature || mate?.kind || ''), light:!!Pp.construction_legere, name:mate?.name || ''});
      }
    }
    if (out.length) W.bld = [...out, ...W.bld.filter(b => b.part)].filter(b => !b.part || true);
    if (out.length) W.src.bld = 'IGN BD TOPO®';
  }
  if (!W.src.bld) W.src.bld = 'OpenStreetMap';
  // hauteurs par défaut, réalistes (centre-ville plus haut que le pavillonnaire)
  for (const b of W.bld){
    const A = Math.abs(ringArea(b.p));
    if (!(b.h > 0)) b.h = b.lv > 0 ? b.lv * 3 + 1 : /garage|shed|hut|cabin|annexe/i.test(b.kind) || A < 25 ? 3 : /house|detached|semidetached|bungalow|Résidentiel/i.test(b.kind) || A < 150 ? 6.5 : A < 600 ? 10 : 12;
    if (!b.lv) b.lv = Math.max(1, Math.round((b.h - 1) / 3));
  }
  return W;
}
