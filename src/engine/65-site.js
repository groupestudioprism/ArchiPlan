/* ============ Lieu du projet : adresse, zone climatique, altitude, exposition au bruit, terrain (relief IGN) ============
   state.site = {label, lon, lat, dept, postcode, citycode, alt, zone, zoneAuto, noise, terrain:{size, n, z:[…], alt0}}
   Services publics de la Géoplateforme IGN (sans clé) : géocodage et altimétrie. Hors ligne : saisie manuelle du département
   et de l'altitude. Les repères thermiques et acoustiques qui en découlent sont indicatifs. */
const GEO_SEARCH = 'https://data.geopf.fr/geocodage/search';
const GEO_ALTI = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
const CLIMATE_ZONES = {
  H1a:['02','14','27','28','59','60','61','62','75','76','77','78','80','91','92','93','94','95'],
  H1b:['08','10','45','51','52','54','55','57','58','67','68','70','88','89','90'],
  H1c:['01','03','05','15','19','21','23','25','38','39','42','43','63','69','71','73','74','87'],
  H2a:['22','29','35','50','56'],
  H2b:['16','17','18','36','37','41','44','49','53','72','79','85','86'],
  H2c:['07','09','12','24','31','32','33','40','46','47','64','65','81','82'],
  H2d:['04','26','48','84'],
  H3:['06','11','13','2A','2B','30','34','66','83','971','972','973','974','976']};
const DEPT_ZONE = Object.fromEntries(Object.entries(CLIMATE_ZONES).flatMap(([z, l]) => l.map(d => [d, z])));
const ZONE_TXT = {H1:'climat le plus froid (nord, est, montagne)', H2:'climat tempéré (ouest, sud-ouest)', H3:'climat méditerranéen'};
/* Exposition au bruit des façades : isolement visé DnT,A,tr (arrêtés du 30 mai 1996 / 23 juillet 2013, valeurs indicatives) */
const NOISE = {
  rural:['Zone rurale calme', 30, 'Pas de voie bruyante classée à proximité'],
  periurbain:['Périurbain, lotissement', 30, 'Voie de desserte, trafic faible'],
  urbain:['Zone urbaine', 35, 'Rue animée (voie de catégorie 4 environ)'],
  centre:['Centre-ville', 38, 'Voie de catégorie 3, trafic dense'],
  hyper:['Hyper-centre, boulevard', 42, 'Voie de catégorie 2, trafic très dense'],
  axe:['Bord d\'autoroute ou de voie ferrée', 45, 'Voie de catégorie 1, à moins de 100 m'],
  pebC:['Zone aéroportuaire (PEB C)', 35, 'Plan d\'exposition au bruit, zone C'],
  pebB:['Zone aéroportuaire (PEB B)', 40, 'Plan d\'exposition au bruit, zone B (construction très encadrée)']};
/* Résistances minimales (m²·K/W) : réglementation thermique des bâtiments existants (élément par élément, 2018) et aides (MaPrimeRénov' / CEE) */
const R_MIN_RT = {mur:{H1:2.9, H2:2.9, H3:2.2}, toiture:{H1:3.3, H2:3.3, H3:3.3}, plancherBas:{H1:2.7, H2:2.7, H3:2.1}, terrePlein:{H1:2.7, H2:2.7, H3:2.1}, plancherInt:null};
const R_AIDES = {mur:3.7, toiture:4.5, plancherBas:3, terrePlein:3, plancherInt:null};

const siteZone = () => state?.site?.zone || '';
const zoneMain = z => (z || '').slice(0, 2);
function altClass(a){ return a == null || Number.isNaN(a) ? '' : a <= 400 ? '≤ 400 m' : a <= 800 ? '401 à 800 m' : '> 800 m'; }
/* Facteur appliqué aux repères de classement A/B/C du U : zone froide et altitude plus exigeantes */
function siteFactor(){
  const s = state?.site; if (!s?.zone) return 1;
  const z = zoneMain(s.zone), a = s.alt ?? 0;
  let f = z === 'H1' ? 0.92 : z === 'H3' ? 1.15 : 1;
  if (a > 800) f = Math.min(f, 1) * 0.85; else if (a > 400) f *= 0.95;
  return f;
}
function rtMin(ctx){
  const s = state?.site, t = R_MIN_RT[ctx]; if (!t || !s?.zone) return null;
  const z = zoneMain(s.zone), eff = z === 'H3' && (s.alt ?? 0) > 800 ? 'H2' : z;
  return t[eff] ?? null;
}

/* ---------- services IGN ---------- */
async function fetchJSON(url, ms = 9000){
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, {signal:c.signal}); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function geoSearch(q){
  const j = await fetchJSON(`${GEO_SEARCH}?${new URLSearchParams({q, limit:'6'})}`);
  return (j.features || []).map(f => { const p = f.properties || {}, [lon, lat] = f.geometry?.coordinates || [];
    const cc = String(p.citycode || ''), dept = cc.startsWith('97') ? cc.slice(0, 3) : cc.slice(0, 2);
    return {label:p.label || p.name || q, lon, lat, postcode:p.postcode || '', citycode:cc, city:p.city || '', dept:dept || String(p.postcode || '').slice(0, 2), context:p.context || ''}; })
    .filter(r => Number.isFinite(r.lon) && Number.isFinite(r.lat));
}
async function geoAlt(points){ // [[lon, lat]…] → [z…] (par lots de 100 points, ≤ 5 requêtes / s)
  const out = [];
  for (let i = 0; i < points.length; i += 100){
    const ch = points.slice(i, i + 100);
    const j = await fetchJSON(`${GEO_ALTI}?${new URLSearchParams({lon:ch.map(p => p[0].toFixed(6)).join('|'), lat:ch.map(p => p[1].toFixed(6)).join('|'), resource:'ign_rge_alti_wld', delimiter:'|', zonly:'true', indent:'false'})}`, 15000);
    const e = j.elevations || []; e.forEach(v => out.push(typeof v === 'number' ? v : v?.z));
    if (i + 100 < points.length) await new Promise(r => setTimeout(r, 230));
  }
  return out.map(z => (z == null || z < -900) ? null : z);   // -99999 : hors couverture
}
const mToLon = (m, lat) => m / (111320 * Math.cos(lat * Math.PI / 180)), mToLat = m => m / 110540;
async function loadTerrain(size = 100, n = size <= 100 ? 41 : 51){
  const s = state.site; if (!s?.lon) throw new Error('nosite');
  const b = bbox(), cx = (b.min.x + b.max.x) / 2, cy = -(b.min.z + b.max.z) / 2;   // centre de la maquette (plan)
  const pts = [], xs = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){ const x = cx - size / 2 + size * i / (n - 1), y = cy - size / 2 + size * j / (n - 1); xs.push([x, y]); pts.push([s.lon + mToLon(x, s.lat), s.lat + mToLat(y)]); }
  const z = await geoAlt([[s.lon, s.lat], ...pts]);
  const z0 = z.shift(); if (z0 == null) throw new Error('nodata');
  const fill = z.map(v => v == null ? z0 : v);
  s.alt = Math.round(z0 * 10) / 10;
  s.terrain = {size, n, cx, cy, alt0:z0, z:fill.map(v => Math.round((v - z0) * 100) / 100), at:Date.now()};
}

/* ---------- terrain dans la scène : relief lissé, teintes hypsométriques, courbes de niveau NGF, socle de maquette ---------- */
const terrainGroup = new THREE.Group(); terrainGroup.name = 'Site'; scene.add(terrainGroup);
let siteKey = '', siteTex = [];
function footprint(){ const bb = new THREE.Box3().setFromObject(modelGroup); return bb.isEmpty() ? null : {x0:bb.min.x, x1:bb.max.x, y0:-bb.max.z, y1:-bb.min.z}; }
/* hauteur du terrain (m, relative au rez-de-chaussée) au point (x, y) du plan ; plate-forme de terrassement sous l'emprise */
function makeTerrainH(T, fp){
  const n = T.n, st = T.size / (n - 1), X0 = T.cx - T.size / 2, Y0 = T.cy - T.size / 2;
  const raw = (x, y) => { let fi = (x - X0) / st, fj = (y - Y0) / st; fi = Math.max(0, Math.min(n - 1.0001, fi)); fj = Math.max(0, Math.min(n - 1.0001, fj));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, z = (a, b) => T.z[b * n + a] ?? 0;
    return (z(i, j) * (1 - u) + z(i + 1, j) * u) * (1 - v) + (z(i, j + 1) * (1 - u) + z(i + 1, j + 1) * u) * v; };
  if (!fp) return raw;
  return (x, y) => { const h = raw(x, y), dx = Math.max(fp.x0 - x, 0, x - fp.x1), dy = Math.max(fp.y0 - y, 0, y - fp.y1), d = Math.hypot(dx, dy), t = Math.min(1, Math.max(0, (d - 1) / 5));
    return -0.05 + (h + 0.05) * t * t * (3 - 2 * t); };
}
const contourStep = r => r < 3 ? 0.25 : r < 8 ? 0.5 : r < 25 ? 1 : r < 70 ? 2 : 5;
function textSprite(txt, size, color = '#3E4A35'){
  const cv = document.createElement('canvas'), g = cv.getContext('2d'), f = 44; g.font = `600 ${f}px Inter, Arial, sans-serif`;
  const w = Math.ceil(g.measureText(txt).width) + 24; cv.width = w; cv.height = f + 18; g.font = `600 ${f}px Inter, Arial, sans-serif`;
  g.fillStyle = 'rgba(255,255,255,.82)'; g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, cv.height, 12) : g.rect(0, 0, w, cv.height); g.fill();
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(txt, 12, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; siteTex.push(tex);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, depthTest:false, transparent:true, sizeAttenuation:false})); sp.scale.set(size * w / cv.height, size, 1); sp.renderOrder = 6; return sp;
}
function buildTerrain(){
  const T = state?.site?.terrain, E = state?.site?.env, onT = !!T && DISPLAY.terrain !== false, onE = !!E && DISPLAY.env !== false;
  if ((!onT && !onE) || view === '2d'){ terrainGroup.visible = false; return; }
  const fp = footprint(), real = DISPLAY.style === 'realistic', dark = isDarkBg?.() || false;
  const key = [T?.at, T?.size, E?.at, onT, onE, real, dark, DISPLAY.style, fp && [fp.x0, fp.x1, fp.y0, fp.y1].map(v => v.toFixed(1)).join(',')].join('|');
  terrainGroup.visible = true; if (onT){ groundShadow.visible = false; groundReal.visible = false; }
  if (key === siteKey && terrainGroup.children.length){ dirty = true; return; }
  siteKey = key; disposeGroup(terrainGroup); siteTex.forEach(t => t.dispose()); siteTex = [];
  const H = onT ? makeTerrainH(T, fp) : () => 0;
  if (onT) buildRelief(T, H, real);
  if (onE) buildEnv(E, H, real, T);
  dirty = true;
}
const isDarkBg = () => { const c = DISPLAY.bg || ''; if (!/^#[0-9a-f]{6}$/i.test(c)) return false; const v = parseInt(c.slice(1), 16); return ((v >> 16) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11) < 110; };
function buildRelief(T, H, real){
  const R = Math.min(180, (T.n - 1) * 4), size = T.size, X0 = T.cx - size / 2, Y0 = T.cy - size / 2, N = R + 1, st = size / R;
  const hs = new Float32Array(N * N); let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){ const h = H(X0 + i * st, Y0 + j * st); hs[j * N + i] = h; if (h < lo) lo = h; if (h > hi) hi = h; }
  const range = Math.max(0.01, hi - lo);
  // maillage (plan y → scène −z)
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){ const k = j * N + i; pos[k * 3] = X0 + i * st; pos[k * 3 + 1] = hs[k] - 0.03; pos[k * 3 + 2] = -(Y0 + j * st); }
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++){ const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const nor = g.attributes.normal.array;
  const ramp = real ? [[0, [0.36, 0.47, 0.29]], [0.5, [0.47, 0.54, 0.33]], [1, [0.6, 0.56, 0.42]]] : [[0, [0.86, 0.90, 0.82]], [0.5, [0.90, 0.91, 0.82]], [1, [0.93, 0.89, 0.80]]];
  const rampAt = t => { for (let q = 1; q < ramp.length; q++) if (t <= ramp[q][0]){ const [t0, c0] = ramp[q - 1], [t1, c1] = ramp[q], u = (t - t0) / (t1 - t0); return c0.map((c, m) => c + (c1[m] - c) * u); } return ramp[ramp.length - 1][1]; };
  for (let k = 0; k < N * N; k++){ const c = rampAt((hs[k] - lo) / range), sh = 0.82 + 0.18 * Math.pow(nor[k * 3 + 1], 4); col[k * 3] = Math.pow(c[0] * sh, 2.2); col[k * 3 + 1] = Math.pow(c[1] * sh, 2.2); col[k * 3 + 2] = Math.pow(c[2] * sh, 2.2); }   // sRGB → linéaire
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, metalness:0, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:2, polygonOffsetUnits:2}));
  mesh.receiveShadow = true; mesh.name = 'Terrain'; mesh.userData.terrain = true; terrainGroup.add(mesh);
  // courbes de niveau (altitudes NGF absolues), maîtresses toutes les 5 courbes
  const iv = contourStep(range), a0 = T.alt0 || 0, minor = [], major = [], labels = {}, cand = {};
  const k0 = Math.ceil((lo + a0) / iv), k1 = Math.floor((hi + a0) / iv), nl = k1 - k0 + 1, lab = nl >= 10 ? 5 : nl >= 4 ? 2 : 1;
  for (let kk = k0; kk <= k1 && k1 - k0 < 400; kk++){
    const lv = kk * iv - a0, out = kk % 5 === 0 ? major : minor, P = (i, j) => [X0 + i * st, Y0 + j * st];
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++){
      const v = [hs[j * N + i], hs[j * N + i + 1], hs[(j + 1) * N + i + 1], hs[(j + 1) * N + i]], c = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
      const pts = []; for (let e = 0; e < 4; e++){ const f = (e + 1) % 4, A = v[e] - lv, B = v[f] - lv; if ((A < 0) !== (B < 0)){ const t = A / (A - B); pts.push([c[e][0] + (c[f][0] - c[e][0]) * t, c[e][1] + (c[f][1] - c[e][1]) * t]); } }
      for (let q = 0; q + 1 < pts.length; q += 2){ out.push(pts[q][0], lv + 0.03, -pts[q][1], pts[q + 1][0], lv + 0.03, -pts[q + 1][1]);
        if (kk % lab === 0 && (i + j) % 3 === 0){ const mx = (pts[q][0] + pts[q + 1][0]) / 2, my = (pts[q][1] + pts[q + 1][1]) / 2, sc = Math.max(Math.abs(mx - T.cx), Math.abs(my - T.cy)); if (sc < size * 0.44 && sc > size * 0.12) (cand[kk] ??= []).push({sc, x:mx, y:my, z:lv}); } }
    }
  }
  // étiquettes : une par courbe retenue, en évitant qu'elles se chevauchent
  const placed = [];
  for (const kk of Object.keys(cand).sort((a, b) => a - b)){ const c = cand[kk].sort((a, b) => b.sc - a.sc); const pick = c.find(p => placed.every(q => Math.hypot(p.x - q.x, p.y - q.y) > size * 0.22)) || null; if (pick){ placed.push(pick); labels[kk] = pick; } }
  const lines = (arr, color, op) => { if (!arr.length) return; const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const l = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({color, transparent:true, opacity:op})); l.userData.contour = true; terrainGroup.add(l); };
  lines(minor, real ? 0x3F5233 : 0x9AA88B, real ? 0.35 : 0.55); lines(major, real ? 0x2E3D25 : 0x6F7E60, real ? 0.6 : 0.9);
  Object.entries(labels).forEach(([kk, L]) => { const sp = textSprite(`${nf(kk * iv, iv < 1 ? 1 : 0)} m NGF`, 0.024); sp.position.set(L.x, L.z + 0.4, -L.y); terrainGroup.add(sp); });
  // socle : flancs de la maquette jusqu'à une base horizontale
  const base = lo - Math.max(1.5, range * 0.12) - 0.03, sp = [], edge = [];
  const side = (getP) => { for (let q = 0; q < R; q++){ const [x1, y1, h1] = getP(q), [x2, y2, h2] = getP(q + 1); sp.push(x1, h1, -y1, x1, base, -y1, x2, base, -y2, x1, h1, -y1, x2, base, -y2, x2, h2, -y2); edge.push(x1, h1, -y1, x2, h2, -y2); } };
  const at = (i, j) => [X0 + i * st, Y0 + j * st, hs[j * N + i] - 0.03];
  side(q => at(R - q, 0)); side(q => at(R, R - q)); side(q => at(q, R)); side(q => at(0, q));
  // orientation : on laisse DoubleSide, normales recalculées
  sp.push(X0, base, -Y0, X0 + size, base, -Y0, X0 + size, base, -(Y0 + size), X0, base, -Y0, X0 + size, base, -(Y0 + size), X0, base, -(Y0 + size));
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.computeVertexNormals();
  const socle = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({color:real ? 0x6B5643 : 0xD9CDB8, roughness:1, side:THREE.DoubleSide})); socle.name = 'Socle'; socle.userData.socle = true; terrainGroup.add(socle);
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3)); terrainGroup.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({color:real ? 0x3B2F24 : 0x8C7F6A})));
  T._stats = {lo, hi, iv};
}

/* ---------- dialogue « Lieu du projet » ---------- */
function siteSummary(){
  const s = state.site; if (!s?.zone && !s?.label) return '<p class="hint">Aucun lieu défini : les repères thermiques et acoustiques sont généraux.</p>';
  return `<dl class="kv"><dt>Lieu</dt><dd style="font-family:var(--f-body);text-align:right">${esc(s.label || 'Département ' + (s.dept || '?'))}</dd>
    <dt>Zone climatique</dt><dd>${esc(s.zone || '—')}</dd><dt>Altitude</dt><dd>${s.alt != null ? nf(s.alt, 0) + ' m' : '—'}</dd>
    <dt>Bruit (façades)</dt><dd>${s.noise ? `${NOISE[s.noise][1]} dB` : '—'}</dd><dt>Terrain</dt><dd>${s.terrain ? `${s.terrain.size} × ${s.terrain.size} m` : '—'}</dd><dt>Environnement</dt><dd>${s.env ? `${s.env.b.length} bât. · ${s.env.t.length} arbres` : '—'}</dd></dl>`;
}
function facadeAcoustic(){
  // isolement de façade estimé : composite murs extérieurs (Rw + Ctr ≈ Rw − 5) et menuiseries (Rw + Ctr ≈ 28 dB, double vitrage courant)
  let Sw = 0, Sr = 0, acc = 0;
  for (const el of state.els){
    if (el.kind !== 'wall' || compo(el.type).lot === 'Second œuvre') continue;
    const L = wallAxis(el).L, ops = wallOpenings(el).reduce((s, o) => s + (o.t1 - o.t0) * (o.z1 - o.z0), 0), net = Math.max(0, L * el.h - ops);
    const Rw = acoustic(layersInToOut(el)).Rw - 5; Sw += net; acc += net * Math.pow(10, -Rw / 10); Sr += ops;
  }
  if (!Sw) return null;
  acc += Sr * Math.pow(10, -2.8); const S = Sw + Sr, Rc = -10 * Math.log10(acc / S);
  return {Rc, DnT:Rc - 3, Sw, Sr};
}
function openSiteDialog(){
  state.site ??= {};
  const S = {...state.site, results:[], q:state.site.label || '', busy:'', msg:'', envOpts:{...ENV_DEF, ...(state.site.env?.opts || {})}};
  const render = () => {
    const z = S.zone || '', zm = zoneMain(z), f = facadeAcoustic(), target = S.noise ? NOISE[S.noise][1] : null;
    return `<header class="ed-h"><div><span class="eyebrow">Paramètres du projet</span><h3 class="ed-t2">Lieu, climat, bruit et terrain</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body site">
      <section>
        <div class="grp" style="margin-top:0"><h3>Adresse du projet</h3>
          <div class="site-q"><input id="stQ" type="search" placeholder="Adresse, commune ou code postal" value="${esc(S.q)}" autocomplete="off"><button class="btn" id="stGo">Rechercher</button></div>
          ${S.results.length ? `<div class="site-r">${S.results.map((r, i) => `<button data-stres="${i}"><b>${esc(r.label)}</b><span>${esc(r.context)}</span></button>`).join('')}</div>` : ''}
          ${S.busy ? `<p class="hint">${esc(S.busy)}</p>` : ''}${S.msg ? `<p class="fe">${esc(S.msg)}</p>` : ''}
          ${S.label ? `<p class="hint">Retenu : <b>${esc(S.label)}</b>${S.lat ? ` · ${S.lat.toFixed(5)}, ${S.lon.toFixed(5)}` : ''}</p>` : ''}
          <div class="fields"><label class="f"><span>Département</span><span class="in"><input id="stDept" type="text" maxlength="3" value="${esc(S.dept || '')}" placeholder="ex. 69"></span></label>
            <label class="f"><span>Altitude</span><span class="in"><input id="stAlt" type="text" inputmode="decimal" value="${S.alt != null ? nf(S.alt, 0) : ''}"><em>m</em></span></label></div></div>
        <div class="grp"><h3>Climat</h3>
          <div class="fields"><label class="f"><span>Zone climatique</span><span class="in"><select id="stZone"><option value="">—</option>${Object.keys(CLIMATE_ZONES).map(k => `<option${k === z ? ' selected' : ''}>${k}</option>`).join('')}</select></span></label>
            <div class="f"><span>Classe d'altitude</span><div class="site-v">${esc(altClass(S.alt) || '—')}</div></div></div>
          ${z ? `<p class="hint">${esc(z)} : ${esc(ZONE_TXT[zm] || '')}.${S.zoneAuto === false ? ' Zone choisie manuellement.' : ''}</p>` : '<p class="hint">Indiquez l\'adresse ou le département pour obtenir la zone (H1a à H3).</p>'}
        </div>
        <div class="grp"><h3>Exposition au bruit</h3>
          <div class="fields"><label class="f wide"><span>Environnement</span><span class="in"><select id="stNoise"><option value="">—</option>${Object.entries(NOISE).map(([k, [n, d]]) => `<option value="${k}"${k === S.noise ? ' selected' : ''}>${esc(n)} · ${d} dB</option>`).join('')}</select></span></label></div>
          ${S.noise ? `<p class="hint">${esc(NOISE[S.noise][2])}. Isolement de façade visé : DnT,A,tr ≥ ${target} dB.</p>` : ''}
        </div>
        <div class="grp"><h3>Terrain (relief IGN)</h3>
          <div class="fields"><label class="f"><span>Emprise</span><span class="in"><select id="stSize">${[60, 100, 150, 200].map(v => `<option value="${v}"${(S.terrain?.size || 100) === v ? ' selected' : ''}>${v} × ${v} m</option>`).join('')}</select></span></label>
            <div class="f"><span>&nbsp;</span><button class="btn" id="stTer"${S.lon ? '' : ' disabled'}>${S.terrain ? 'Recharger le relief' : 'Charger le relief'}</button></div></div>
          ${S.terrain ? `<p class="hint">Relief chargé : ${nf(S.terrain.alt0 + Math.min(...S.terrain.z), 0)} à ${nf(S.terrain.alt0 + Math.max(...S.terrain.z), 0)} m NGF, maille ${nf(S.terrain.size / (S.terrain.n - 1), 1)} m. Courbes de niveau et altitudes NGF affichées en 3D. <button class="tlink" id="stTerDel">Retirer le terrain</button></p>` : `<p class="hint">${S.lon ? 'Altitudes du RGE ALTI® (IGN) autour du projet ; le rez-de-chaussée est calé sur l\'altitude du point d\'adresse.' : 'Choisissez d\'abord une adresse.'}</p>`}
        </div>
        <div class="grp"><h3>Environnement (bâti, végétation, voirie)</h3>
          <div class="env-o">${[['b', 'Bâtiments existants'], ['v', 'Végétation et arbres'], ['r', 'Routes et chemins'], ['w', 'Eau'], ['drop', 'Retirer le bâti existant sous le projet']].map(([k, n]) => `<label class="ap-check2"><input type="checkbox" data-envo="${k}"${S.envOpts[k] ? ' checked' : ''}> ${n}</label>`).join('')}</div>
          <div class="env-a"><button class="btn" id="stEnv"${S.lon ? '' : ' disabled'}>${S.env ? 'Regénérer l\'environnement' : 'Générer l\'environnement'}</button>${S.env ? '<button class="tlink" id="stEnvDel">Retirer</button>' : ''}</div>
          <p class="hint">${S.env ? `${esc(envSummary(S.env))} sur ${S.env.size} × ${S.env.size} m. Source : ${esc(S.env.src)}.` : S.lon ? 'Bâtiments (avec leur hauteur), routes, zones boisées, haies et plans d\'eau autour du projet, d\'après la BD TOPO® de l\'IGN (OpenStreetMap en secours). Même emprise que le relief.' : 'Choisissez d\'abord une adresse.'}</p>
        </div>
      </section>
      <section>
        <div class="grp" style="margin-top:0"><h3>Repères thermiques ${z ? `(${esc(z)}${S.alt > 400 ? ', ' + esc(altClass(S.alt)) : ''})` : '(généraux)'}</h3>
          <table class="tbl"><thead><tr><th>Paroi</th><th class="n">U « A »</th><th class="n">U « B »</th><th class="n">R min. rénov.</th><th class="n">R aides</th></tr></thead><tbody>
          ${[['mur', 'Murs extérieurs'], ['toiture', 'Toiture / plancher haut'], ['plancherBas', 'Plancher bas'], ['terrePlein', 'Dallage sur terre-plein']].map(([ctx, n]) => { const g = uLimits(ctx, S); const rm = rtMinFor(ctx, S);
            return `<tr><td>${n}</td><td class="n">${nf(g[0], 2)}</td><td class="n">${nf(g[1], 2)}</td><td class="n">${rm != null ? nf(rm, 1) : '—'}</td><td class="n">${R_AIDES[ctx] != null ? nf(R_AIDES[ctx], 1) : '—'}</td></tr>`; }).join('')}
          </tbody></table>
          <p class="hint">A : très performant · B : neuf RE2020 (W/m²·K). R min. rénov. : réglementation des bâtiments existants, élément par élément (valeurs 2018, renforcées depuis). R aides : seuil MaPrimeRénov' / CEE. Les classes A/B/C/D des parois du projet utilisent ces repères.</p></div>
        <div class="grp"><h3>Acoustique des façades</h3>
          ${f ? `<div class="perf"><div class="pc"><span>Isolement estimé</span><b>≈ ${n0(f.DnT)}</b><em>dB DnT,A,tr</em></div><div class="pc"><span>Objectif</span><b>${target ?? '—'}</b><em>${target ? 'dB, selon l\'environnement' : 'choisissez l\'environnement'}</em></div></div>
            ${target ? `<ul class="warns"><li class="${f.DnT >= target ? 'ok' : 'bad'}">${f.DnT >= target ? 'Objectif atteint (estimation).' : `Objectif non atteint : il manque environ ${n0(target - f.DnT)} dB. Les menuiseries limitent souvent l'isolement : prévoir un vitrage acoustique (feuilleté asymétrique, ≈ 35 dB Rw+Ctr) et des entrées d'air acoustiques.`}</li></ul>` : ''}
            <p class="hint">Estimation simplifiée (EN 12354-3) : murs extérieurs ${n0(f.Sw)} m², menuiseries ${n0(f.Sr)} m² supposées en double vitrage courant (Rw+Ctr ≈ 28 dB).</p>` : '<p class="hint">Dessinez des murs extérieurs pour estimer l\'isolement des façades.</p>'}
        </div>
      </section></div>
    <footer class="ed-f"><span class="hint">Données : Géoplateforme IGN (adresse, altitudes, BD TOPO®) · © OpenStreetMap en secours.</span><button class="btn" data-close>Annuler</button><button class="btn primary" id="stOk">Enregistrer</button></footer>`;
  };
  const draw = () => { const d = openEDlg(render(), 'mid'); wire(d); };
  const wire = d => {
    const q = x => d.querySelector(x);
    const search = async () => { S.q = q('#stQ').value.trim(); if (S.q.length < 3) return; S.busy = 'Recherche…'; S.msg = ''; draw();
      try { S.results = await geoSearch(S.q); S.busy = ''; if (!S.results.length) S.msg = 'Aucune adresse trouvée.'; }
      catch(e){ S.busy = ''; S.results = []; S.msg = 'Service d\'adresses IGN injoignable : indiquez le département et l\'altitude à la main.'; }
      draw(); };
    q('#stGo').onclick = search; q('#stQ').onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); search(); } };
    d.querySelectorAll('[data-stres]').forEach(b => b.onclick = async () => {
      const r = S.results[+b.dataset.stres]; Object.assign(S, {label:r.label, lon:r.lon, lat:r.lat, dept:r.dept, postcode:r.postcode, citycode:r.citycode, q:r.label, results:[], terrain:null});
      if (DEPT_ZONE[r.dept]){ S.zone = DEPT_ZONE[r.dept]; S.zoneAuto = true; }
      S.busy = 'Altitude…'; draw();
      try { const [z] = await geoAlt([[r.lon, r.lat]]); if (z != null) S.alt = Math.round(z); S.busy = ''; } catch(e){ S.busy = ''; S.msg = 'Altitude indisponible (service IGN) : saisissez-la.'; }
      draw(); });
    q('#stDept').onchange = e => { S.dept = e.target.value.trim().toUpperCase().padStart(2, '0'); if (DEPT_ZONE[S.dept]){ S.zone = DEPT_ZONE[S.dept]; S.zoneAuto = true; } draw(); };
    q('#stAlt').onchange = e => { const v = num(e.target.value); S.alt = Number.isNaN(v) ? null : v; draw(); };
    q('#stZone').onchange = e => { S.zone = e.target.value; S.zoneAuto = false; draw(); };
    q('#stNoise').onchange = e => { S.noise = e.target.value; draw(); };
    q('#stTer').onclick = async () => { S.busy = 'Chargement du relief (IGN)…'; S.msg = ''; draw();
      const keep = state.site; state.site = {...S}; try { await loadTerrain(+q('#stSize').value || 100); S.terrain = state.site.terrain; S.alt = state.site.alt; S.busy = ''; }
      catch(e){ S.busy = ''; S.msg = e.message === 'nodata' ? 'Pas de données d\'altitude à cet endroit.' : 'Relief indisponible (service IGN injoignable).'; }
      state.site = keep; draw(); };
    d.querySelectorAll('[data-envo]').forEach(c => c.onchange = () => { S.envOpts[c.dataset.envo] = c.checked; });
    q('#stEnv').onclick = async () => { S.busy = 'Génération de l\'environnement (IGN BD TOPO®)…'; S.msg = ''; draw();
      const keep = state.site; state.site = {...S}; try { S.env = await loadEnv(+q('#stSize').value || 100, S.envOpts); S.busy = ''; if (!S.env.b.length && !S.env.r.length && !S.env.v.length) S.msg = 'Aucun élément trouvé autour du projet.'; }
      catch(e){ S.busy = ''; S.msg = 'Environnement indisponible (services IGN et OpenStreetMap injoignables).'; }
      state.site = keep; draw(); };
    const ed = q('#stEnvDel'); if (ed) ed.onclick = () => { S.env = null; draw(); };
    const del = q('#stTerDel'); if (del) del.onclick = () => { S.terrain = null; draw(); };
    q('#stOk').onclick = () => { pushHist(); const {results, busy, msg, q:_q, envOpts, ...keep} = S; if (!keep.env) delete keep.env; state.site = keep; state.isSample = false; closeEDlg(); resetMats(); rebuild(); buildTerrain(); toast('Lieu du projet enregistré'); };
  };
  draw();
}
function uLimits(ctx, S){ const prev = state.site; state.site = S; const g = ['A', 'B'].map((_, i) => uGradeLimits(ctx)[i]); state.site = prev; return g; }
function rtMinFor(ctx, S){ const prev = state.site; state.site = S; const r = rtMin(ctx); state.site = prev; return r; }
