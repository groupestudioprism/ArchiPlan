/* ============ Exports : Archi Vision (GLB), IFC4, CSV, JSON, ZIP, images ============ */
const fileBase = () => (state.name || 'projet').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'projet';
let dlNS;
async function getDl(){ if (dlNS === undefined){ try { dlNS = window.claude?.use ? await window.claude.use('downloads') : null; } catch(e){ dlNS = null; } } return dlNS; }
const MIME = {csv:'text/csv', json:'application/json', glb:'model/gltf-binary', ifc:'application/x-step', zip:'application/zip', png:'image/png', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', html:'text/html'};
async function offer(filename, data){
  const dl = await getDl();
  if (dl){
    try { await dl.save({filename, data:data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data}); toast(`${filename} enregistré`); return; }
    catch(err){ const c = err?.code; if (c === 'declined') return toast('Export annulé'); if (c === 'rate_limited') return toast('Une demande d\'enregistrement est déjà ouverte'); }
  }
  // site en ligne : téléchargement classique du navigateur
  const blob = data instanceof Blob ? data : new Blob([data], {type:MIME[filename.split('.').pop()] || 'application/octet-stream'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast(`${filename} téléchargé`);
}

function buildCSV(){
  const q = quantities(), d = x => String(Math.round(x * 1000) / 1000).replace('.', ',');
  const lines = [`ARCHIPLAN;${state.name}`, '', 'Lot;Matériau;Volume (m3);Masse (kg);Carbone (kg CO2e)'];
  for (const lot of LOT_ORDER) for (const r of q.mats.filter(r => r.lot === lot)){ const M = mat(r.mat), ms = r.v * (M.R != null ? 0 : M.rho); lines.push(`${lot};${M.nom};${d(r.v)};${d(ms)};${d(ms * (M.gwp || 0))}`); }
  lines.push('', 'Composition de mur;Longueur (ml);Surface brute (m2);Surface nette (m2)');
  for (const [k, w] of Object.entries(q.walls)) lines.push(`${compo(k).nom};${d(w.ml)};${d(w.m2)};${d(w.net)}`);
  lines.push('', 'Composition de plancher;Surface (m2)');
  for (const [k, s] of Object.entries(q.slabs)) lines.push(`${compo(k).nom};${d(s.m2)}`);
  lines.push('', 'Composition de toiture;Rampants (m2);Projection (m2);Égouts (ml);Faîtages (ml)');
  for (const [k, r] of Object.entries(q.roofs || {})) lines.push(`${compo(k).nom};${d(r.m2)};${d(r.plan)};${d(r.eave)};${d(r.ridge)}`);
  lines.push('', 'Famille;Type;Quantité;Surface de baie (m2)');
  for (const f of q.fams){ const F = fam(f.fam); lines.push(`${F?.nom || f.fam};${F?.types?.[f.type]?.nom || ''};${f.n};${d(f.area)}`); }
  return '﻿' + lines.join('\r\n');
}

/* ---------- IFC4 (murs à couches, ouvertures, portes et fenêtres, dalles, poteaux, mobilier) ---------- */
const GUIDCH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function guid(){ const a = crypto.getRandomValues(new Uint8Array(22)); let s = GUIDCH[a[0] % 4]; for (let i = 1; i < 22; i++) s += GUIDCH[a[i] % 64]; return s; }
function ifcS(s){ return "'" + [...String(s)].map(ch => { const c = ch.codePointAt(0); if (ch === "'") return "''"; if (ch === '\\') return '\\\\'; if (c < 32 || c > 126) return c > 0xFFFF ? '?' : '\\X2\\' + c.toString(16).toUpperCase().padStart(4, '0') + '\\X0\\'; return ch; }).join('') + "'"; }
function R(n){ let s = String(Math.round(n * 1e6) / 1e6); if (s.includes('e')) s = n.toFixed(6); if (!s.includes('.')) s += '.'; return s; }
function buildIFC(){
  let id = 0; const L = []; const E = s => { L.push(`#${++id}=${s};`); return '#' + id; };
  const O = E('IFCCARTESIANPOINT((0.,0.,0.))'), Z = E('IFCDIRECTION((0.,0.,1.))'), X = E('IFCDIRECTION((1.,0.,0.))');
  const AX = E(`IFCAXIS2PLACEMENT3D(${O},${Z},${X})`);
  const CTX = E(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${AX},$)`);
  const BODY = E(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${CTX},$,.MODEL_VIEW.,$)`);
  const u = [E('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'), E('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'), E('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'), E('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)')];
  const UA = E(`IFCUNITASSIGNMENT((${u.join(',')}))`);
  const PRJ = E(`IFCPROJECT('${guid()}',$,${ifcS(state.name)},$,$,$,$,(${CTX}),${UA})`);
  const SP = E(`IFCLOCALPLACEMENT($,${AX})`);
  const SITE = E(`IFCSITE('${guid()}',$,${ifcS('Terrain')},$,$,${SP},$,$,.ELEMENT.,$,$,$,$,$)`);
  const BP = E(`IFCLOCALPLACEMENT(${SP},${AX})`);
  const BLD = E(`IFCBUILDING('${guid()}',$,${ifcS('Bâtiment')},$,$,${BP},$,$,.ELEMENT.,$,$,$)`);
  E(`IFCRELAGGREGATES('${guid()}',$,$,$,${PRJ},(${SITE}))`); E(`IFCRELAGGREGATES('${guid()}',$,$,$,${SITE},(${BLD}))`);
  const used = [...new Set(state.els.map(e => e.lvl))].sort((a, b) => a - b); const storeys = {};
  for (const li of used){
    const z = lvlZ(li), pt = E(`IFCCARTESIANPOINT((0.,0.,${R(z)}))`), ax = E(`IFCAXIS2PLACEMENT3D(${pt},$,$)`), pl = E(`IFCLOCALPLACEMENT(${BP},${ax})`);
    storeys[li] = {pl, z, id:E(`IFCBUILDINGSTOREY('${guid()}',$,${ifcS(lvlName(li))},$,$,${pl},$,$,.ELEMENT.,${R(z)})`), items:[]};
  }
  if (used.length) E(`IFCRELAGGREGATES('${guid()}',$,$,$,${BLD},(${used.map(li => storeys[li].id).join(',')}))`);
  const matIds = {}; const imat = k => matIds[k] ??= E(`IFCMATERIAL(${ifcS(mat(k).nom)},$,$)`);
  const layerSets = {}; const lset = (key, name, layers) => layerSets[key] ??= E(`IFCMATERIALLAYERSET((${layers.map(([m, e]) => E(`IFCMATERIALLAYER(${imat(m)},${R(e)},$,${ifcS(mat(m).nom)},$,$,$)`)).join(',')}),${ifcS(name)},$)`);
  const extrudePoly = (poly, base, h) => {
    const pts = poly.map(p => E(`IFCCARTESIANPOINT((${R(p[0])},${R(p[1])}))`));
    const pl = E(`IFCPOLYLINE((${[...pts, pts[0]].join(',')}))`), prof = E(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${pl})`);
    const sax = E(`IFCAXIS2PLACEMENT3D(${E(`IFCCARTESIANPOINT((0.,0.,${R(base)}))`)},$,$)`);
    return E(`IFCEXTRUDEDAREASOLID(${prof},${sax},${Z},${R(h)})`);
  };
  const solidItem = (so, zRef) => {
    const ref = E(`IFCDIRECTION((${R(Math.cos(so.rz || 0))},${R(Math.sin(so.rz || 0))},0.))`);
    if (so.s === 'ext') return extrudePoly(so.pts.map(p => { const q = V.rot(p, so.rz || 0); return [so.c[0] + q[0], so.c[1] + q[1]]; }), so.c[2] - so.h / 2 - zRef, so.h);
    if (so.s === 'sph') return E(`IFCSPHERE(${E(`IFCAXIS2PLACEMENT3D(${E(`IFCCARTESIANPOINT((${R(so.c[0])},${R(so.c[1])},${R(so.c[2] - zRef)}))`)},$,$)`)},${R(so.r)})`);
    const h = so.s === 'cyl' ? so.h : so.h, base = so.c[2] - h / 2 - zRef;
    const pos = E(`IFCAXIS2PLACEMENT3D(${E(`IFCCARTESIANPOINT((${R(so.c[0])},${R(so.c[1])},${R(base)}))`)},${Z},${ref})`);
    if (so.s === 'cone') so = {...so, s:'cyl', r:(so.r + (so.r2 || 0)) / 2};
    const prof = so.s === 'cyl' ? E(`IFCCIRCLEPROFILEDEF(.AREA.,$,$,${R(so.r)})`) : E(`IFCRECTANGLEPROFILEDEF(.AREA.,$,$,${R(so.w)},${R(so.d)})`);
    return E(`IFCEXTRUDEDAREASOLID(${prof},${pos},${Z},${R(h)})`);
  };
  const shape = items => E(`IFCPRODUCTDEFINITIONSHAPE($,$,(${E(`IFCSHAPEREPRESENTATION(${BODY},'Body','${items.length > 1 ? 'CSG' : 'SweptSolid'}',(${items.join(',')}))`)}))`);
  const brep = (top, ext, zRef) => { // prisme quelconque en IfcFacetedBrep (pans de toiture, pignons)
    const P = q => E(`IFCCARTESIANPOINT((${R(q[0])},${R(q[1])},${R(q[2] - zRef)}))`), T = top.map(P), B = top.map(q => P([q[0] + ext[0], q[1] + ext[1], q[2] + ext[2]])), n = T.length;
    const face = ids => E(`IFCFACE((${E(`IFCFACEOUTERBOUND(${E(`IFCPOLYLOOP((${ids.join(',')}))`)},.T.)`)}))`);
    const faces = [face(T), face(B.slice().reverse())]; for (let i = 0; i < n; i++){ const j = (i + 1) % n; faces.push(face([T[i], B[i], B[j], T[j]])); }
    return E(`IFCFACETEDBREP(${E(`IFCCLOSEDSHELL((${faces.join(',')}))`)})`);
  };
  const brepShape = items => E(`IFCPRODUCTDEFINITIONSHAPE($,$,(${E(`IFCSHAPEREPRESENTATION(${BODY},'Body','Brep',(${items.join(',')}))`)}))`);
  for (const el of state.els.filter(e => e.kind === 'roof')){
    const st = storeys[el.lvl], rel = lvlZ(el.lvl), G = roofGeom(el), C = compo(el.type), T = C.layers.reduce((s, [, e]) => s + e, 0) / Math.cos(G.a);
    const items = G.pans.map(pan => brep(pan, [0, 0, -T], rel));
    const eid = E(`IFCSLAB('${guid()}',$,${ifcS(`Toiture ${el.id}`)},${ifcS(C.nom)},$,${E(`IFCLOCALPLACEMENT(${st.pl},${AX})`)},${brepShape(items)},${ifcS(String(el.id))},.ROOF.)`);
    E(`IFCRELASSOCIATESMATERIAL('${guid()}',$,$,$,(${eid}),${lset(el.type, C.nom, C.layers)})`); st.items.push(eid);
    G.gables.forEach((g, i) => { const GC = compo(gableType(el, g)), Tg = GC.layers.reduce((s, [, e]) => s + e, 0), o = [-g.dir[0], -g.dir[1]], tri = g.tri.map(q => [q[0] + o[0] * Tg / 2, q[1] + o[1] * Tg / 2, q[2]]);
      const gid = E(`IFCWALL('${guid()}',$,${ifcS(`Pignon ${el.id}.${i + 1}`)},${ifcS(GC.nom)},$,${E(`IFCLOCALPLACEMENT(${st.pl},${AX})`)},${brepShape([brep(tri, [g.dir[0] * Tg, g.dir[1] * Tg, 0], rel)])},$,.STANDARD.)`);
      E(`IFCRELASSOCIATESMATERIAL('${guid()}',$,$,$,(${gid}),${lset(gableType(el, g), GC.nom, GC.layers)})`); st.items.push(gid); });
  }
  const wallIds = {};
  for (const el of state.els.filter(e => e.kind === 'stair')){
    const st = storeys[el.lvl], rel = lvlZ(el.lvl), items = pieces(el).filter(pc => pc.top).map(pc => brep(pc.top, pc.ext, rel));
    const eid = E(`IFCSTAIR('${guid()}',$,${ifcS(`Escalier ${el.id}`)},${ifcS(STAIR_TYPES[el.st || 'droit'])},$,${E(`IFCLOCALPLACEMENT(${st.pl},${AX})`)},${brepShape(items)},${ifcS(String(el.id))},.NOTDEFINED.)`);
    E(`IFCRELASSOCIATESMATERIAL('${guid()}',$,$,$,(${eid}),${imat(el.mat === 'beton' ? 'beton' : el.mat === 'acier' ? 'acier' : 'chene')})`); st.items.push(eid);
  }
  for (const el of state.els.filter(e => e.kind !== 'inst' && e.kind !== 'roof' && e.kind !== 'stair')){
    const st = storeys[el.lvl], rel = lvlZ(el.lvl);
    let item, ent, matSel, name = `${KIND_NAME[el.kind]} ${el.id}`, desc = '';
    if (el.kind === 'wall'){ const T = wallT(el); item = extrudePoly(wallPoly(el, state.els, -T/2, T/2), (el.off || 0), el.h); ent = 'IFCWALL'; desc = compo(el.type).nom; matSel = lset(el.type + (el.flip ? '-f' : ''), compo(el.type).nom, wallLayers(el)); }
    else if (el.kind === 'slab'){ const T = slabT(el); item = extrudePoly(rect(el.p, el.q), (el.off || 0), T); ent = 'IFCSLAB'; desc = compo(el.type).nom; matSel = lset(el.type, compo(el.type).nom, compo(el.type).layers); }
    else if (el.kind === 'vol'){ item = extrudePoly(volPoly(el), el.off || 0, el.h); ent = 'IFCBUILDINGELEMENTPROXY'; desc = mat(el.mat).nom; matSel = imat(el.mat); }
    else { item = extrudePoly(colPoly(el), el.off || 0, el.h); ent = 'IFCCOLUMN'; desc = mat(el.mat).nom; matSel = imat(el.mat); }
    const epl = E(`IFCLOCALPLACEMENT(${st.pl},${AX})`);
    const pre = {IFCWALL:'.STANDARD.', IFCSLAB:'.FLOOR.', IFCCOLUMN:'.COLUMN.', IFCBUILDINGELEMENTPROXY:'.NOTDEFINED.'}[ent];
    const eid = E(`${ent}('${guid()}',$,${ifcS(name)},${ifcS(desc)},$,${epl},${shape([item])},${ifcS(String(el.id))},${pre})`);
    E(`IFCRELASSOCIATESMATERIAL('${guid()}',$,$,$,(${eid}),${matSel})`);
    st.items.push(eid); if (el.kind === 'wall') wallIds[el.id] = {eid, epl};
  }
  for (const el of state.els.filter(e => e.kind === 'inst')){
    const F = fam(el.fam); if (!F) continue; const st = storeys[el.lvl], zRef = lvlZ(el.lvl);
    const sols = instSolids(el); const items = sols.map(so => solidItem(so, zRef));
    const epl = E(`IFCLOCALPLACEMENT(${st.pl},${AX})`);
    const isDoor = F.cat === 'Portes', isWin = F.cat === 'Fenêtres', c = famCut(el), name = `${F.nom} ${el.id}`, tname = F.types?.[el.type | 0]?.nom || '';
    let eid;
    if (el.host && c){
      const w = getEl(el.host), wi = wallIds[el.host];
      if (w && wi){ // ouverture dans le mur
        const fr = instFrame(el), T = wallT(w) + 0.04, base = fr.z - zRef;
        const ref = E(`IFCDIRECTION((${R(Math.cos(fr.ang))},${R(Math.sin(fr.ang))},0.))`);
        const pos = E(`IFCAXIS2PLACEMENT3D(${E(`IFCCARTESIANPOINT((${R(fr.o[0])},${R(fr.o[1])},${R(base)}))`)},${Z},${ref})`);
        const op = E(`IFCOPENINGELEMENT('${guid()}',$,${ifcS('Ouverture ' + el.id)},$,$,${E(`IFCLOCALPLACEMENT(${st.pl},${AX})`)},${shape([E(`IFCEXTRUDEDAREASOLID(${E(`IFCRECTANGLEPROFILEDEF(.AREA.,$,$,${R(c.w)},${R(T)})`)},${pos},${Z},${R(c.h)})`)])},$,.OPENING.)`);
        E(`IFCRELVOIDSELEMENT('${guid()}',$,$,$,${wi.eid},${op})`);
        if (isDoor || isWin){
          eid = isDoor ? E(`IFCDOOR('${guid()}',$,${ifcS(name)},${ifcS(tname)},$,${epl},${items.length ? shape(items) : '$'},${ifcS(String(el.id))},${R(c.h)},${R(c.w)},.DOOR.,$,$)`)
                       : E(`IFCWINDOW('${guid()}',$,${ifcS(name)},${ifcS(tname)},$,${epl},${items.length ? shape(items) : '$'},${ifcS(String(el.id))},${R(c.h)},${R(c.w)},.WINDOW.,$,$)`);
          E(`IFCRELFILLSELEMENT('${guid()}',$,$,$,${op},${eid})`);
        }
      }
    }
    if (!eid && items.length){
      const ent = F.cat === 'Structure' ? 'IFCBEAM' : F.cat === 'Escaliers et garde-corps' ? 'IFCBUILDINGELEMENTPROXY' : ['Mobilier', 'Cuisine et sanitaires'].includes(F.cat) ? 'IFCFURNISHINGELEMENT' : 'IFCBUILDINGELEMENTPROXY';
      eid = ent === 'IFCFURNISHINGELEMENT' ? E(`IFCFURNISHINGELEMENT('${guid()}',$,${ifcS(name)},${ifcS(tname)},$,${epl},${shape(items)},${ifcS(String(el.id))},.NOTDEFINED.)`)
          : ent === 'IFCBEAM' ? E(`IFCBEAM('${guid()}',$,${ifcS(name)},${ifcS(tname)},$,${epl},${shape(items)},${ifcS(String(el.id))},.BEAM.)`)
          : E(`IFCBUILDINGELEMENTPROXY('${guid()}',$,${ifcS(name)},${ifcS(tname)},$,${epl},${shape(items)},${ifcS(String(el.id))},.NOTDEFINED.)`);
    }
    if (eid){ st.items.push(eid); const ms = [...new Set(sols.map(s => s.m))]; if (ms.length === 1) E(`IFCRELASSOCIATESMATERIAL('${guid()}',$,$,$,(${eid}),${imat(ms[0])})`); }
  }
  for (const li of used) if (storeys[li].items.length) E(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,(${storeys[li].items.join(',')}),${storeys[li].id})`);
  const now = new Date().toISOString().slice(0, 19);
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');\nFILE_NAME(${ifcS(fileBase() + '.ifc')},'${now}',(''),('Studio Prism'),'ARCHIPLAN ${APP_VERSION}','ARCHIPLAN','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${L.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}

/* ---------- GLB pour Archi Vision (Unity) ---------- */
function exportMat(id, cache){
  if (cache[id]) return cache[id];
  const m = mat(id), transp = m.opacity != null && m.opacity < 1;
  const M = new THREE.MeshStandardMaterial({name:m.nom, color:m.tex && m.tex !== 'glass' ? 0xffffff : m.color, map:m.tex && m.tex !== 'glass' && m.tex !== 'plain' ? texFor(id) : null,
    roughness:m.rough ?? 0.9, metalness:m.metal ?? 0, transparent:transp, opacity:m.opacity ?? 1});
  if (!M.map) M.color = new THREE.Color(m.color);
  M.userData = {archiplanMaterial:id, lambda:m.lambda, rho:m.rho, categorie:m.cat};
  return cache[id] = M;
}
function buildGLB(){
  return new Promise((res, rej) => {
    const root = new THREE.Group(); root.name = 'ARCHIPLAN - ' + state.name;
    root.userData = {archiplan:{version:APP_VERSION, projet:state.name, unites:'m', axeHaut:'Y', niveaux:state.levels, styles:Object.keys(STYLES), soleil:{azimut:DISPLAY.sunAz, hauteur:DISPLAY.sunEl}}};
    const lv = state.levels.map((l, i) => { const g = new THREE.Group(); g.name = l.n; g.userData = {niveau:l.n, altitude:l.z}; root.add(g); return g; });
    const cache = {};
    for (const el of state.els){
      const g = new THREE.Group(), info = {id:el.id, type:el.kind};
      const geoBy = {};
      if (el.kind === 'inst'){
        const F = fam(el.fam); g.name = `${F?.nom || 'Composant'} ${el.id}`; Object.assign(info, {famille:F?.nom, categorie:F?.cat, typeFamille:F?.types?.[el.type | 0]?.nom, parametres:F ? famScope(F, el) : {}, hote:el.host || null});
        for (const so of instSolids(el)) (geoBy[so.m] ??= []).push(solidGeo(so));
      } else {
        g.name = `${KIND_NAME[el.kind]} ${el.id}`;
        if (el.kind === 'wall' || el.kind === 'slab' || el.kind === 'roof'){ const C = compo(el.type), Lr = layersInToOut(el), th = thermal(Lr, elUse(el)); Object.assign(info, {composition:C.nom, couches:C.layers.map(([m, e]) => ({materiau:mat(m).nom, epaisseur:e})), U:Math.round(th.U * 1000) / 1000, lot:C.lot}); }
        else Object.assign(info, {materiau:mat(el.mat).nom});
        for (const pc of pieces(el)) (geoBy[pc.mat] ??= []).push(pieceGeo(pc));
      }
      for (const [m, geos] of Object.entries(geoBy)){
        const geo = geos.length === 1 ? geos[0] : mergeGeos(geos.map(x => x.index ? x.toNonIndexed() : x));
        const mesh = new THREE.Mesh(geo, exportMat(m, cache)); mesh.name = `${g.name} - ${mat(m).nom}`; mesh.userData = {materiau:mat(m).nom}; g.add(mesh);
      }
      g.userData = {archiplan:info};
      (lv[el.lvl] || root).add(g);
    }
    if ((state.site?.terrain && DISPLAY.terrain !== false) || (state.site?.env && DISPLAY.env !== false)){
      const vw = view; view = '3d'; siteKey = ''; buildTerrain(); view = vw; const T = state.site.terrain, E = state.site.env, sg = new THREE.Group(); sg.name = 'Site';
      terrainGroup.traverse(o => { if (!o.isMesh || o.isSprite) return; const m = o.material, t = new THREE.Mesh(o.geometry.clone(), new THREE.MeshStandardMaterial({color:m.color?.getHex?.() ?? 0x888888, vertexColors:!!m.vertexColors, roughness:1, side:m.side})); t.name = o.name || 'Site';
        t.userData = {archiplan:o.userData.terrain ? {type:'terrain', taille:T.size, altitudeOrigine:T.alt0, source:'IGN RGE ALTI'} : o.userData.env ? {type:'environnement', objet:o.userData.env, source:E?.src || ''} : {type:'socle'}}; sg.add(t); });
      root.add(sg); siteKey = ''; buildTerrain(); }
    if (state.site?.lat) root.userData.archiplan.lieu = {adresse:state.site.label || '', latitude:state.site.lat, longitude:state.site.lon, altitude:state.site.alt ?? null, zoneClimatique:state.site.zone || ''};
    new GLTFExporter().parse(root, r => { disposeGroup(root); res(new Uint8Array(r)); }, err => rej(err), {binary:true, maxTextureSize:1024, onlyVisible:true});
  });
}

/* ---------- ZIP (sans compression) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files){
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  for (const f of files){
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    [[0,0x04034b50,4],[4,20,2],[6,0x0800,2],[8,0,2],[10,tm,2],[12,dt,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,name.length,2],[28,0,2]].forEach(([o,v,s]) => s === 4 ? lh.setUint32(o,v,true) : lh.setUint16(o,v,true));
    parts.push(lh, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    [[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x0800,2],[10,0,2],[12,tm,2],[14,dt,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[30,0,2],[32,0,2],[34,0,2],[36,0,2],[38,0,4],[42,off,4]].forEach(([o,v,s]) => s === 4 ? ch.setUint32(o,v,true) : ch.setUint16(o,v,true));
    cen.push(ch, name); off += 30 + name.length + data.length;
  }
  const cs = cen.reduce((s, p) => s + p.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  [[0,0x06054b50,4],[4,0,2],[6,0,2],[8,files.length,2],[10,files.length,2],[12,cs,4],[16,off,4],[20,0,2]].forEach(([o,v,s]) => s === 4 ? end.setUint32(o,v,true) : end.setUint16(o,v,true));
  return new Blob([...parts, ...cen, end], {type:'application/zip'});
}
const projectJSON = () => { embedUsedLib(); return JSON.stringify({...state, format:'archiplan', v:4}, null, 2); };
async function doExport(kind, arg){
  if (!window.SPAccess?.canExport){ window.SPLicense?.prompt('export'); return; }
  window.SPLicense?.usage?.();   // rappel d'usage (non commercial) une fois par session
  if (!state.els.length && kind !== 'json'){ toast('Le modèle est vide : dessinez au moins un élément'); return; }
  const base = fileBase();
  try {
    if (kind === 'csv') return offer(`${base}_metre.csv`, buildCSV());
    if (kind === 'dqe'){ if (arg === 'pdf') return printDqe(); if (arg === 'csv') return offer(`${base}_DQE.csv`, dqeCSV()); return offer(`${base}_DQE.xlsx`, new Blob([dqeXLSX()], {type:MIME.xlsx})); }
    if (kind === 'json') return offer(`${base}.archiplan.json`, projectJSON());
    if (kind === 'ifc') return offer(`${base}.ifc`, buildIFC());
    if (kind === 'glb'){ toast('Préparation du modèle Archi Vision…'); return offer(`${base}_archivision.glb`, await buildGLB()); }
    if (kind === 'png'){ toast('Calcul de l\'image…'); return offer(`${base}_rendu.png`, await captureImage(arg || 2)); }
    if (kind === 'pack'){
      toast('Préparation du paquet…');
      const glb = await buildGLB();
      const readme = `ARCHIPLAN ${APP_VERSION} - ${state.name}\r\n\r\n${base}.glb : modèle 3D pour Archi Vision (glTF binaire, Y vers le haut, mètres, matériaux PBR texturés). Un nœud par niveau puis par élément ; les informations (type, composition, U, famille, paramètres) sont dans "extras".\r\n${base}.ifc : maquette BIM IFC4 (murs à couches, ouvertures, portes, fenêtres, dalles, poteaux, mobilier).\r\n${base}_metre.csv : métré par lot, par composition et par famille, avec carbone.\r\n${base}_DQE.xlsx : détail quantitatif estimatif par lots (corps d'état), prix indicatifs modifiables.\r\n${base}.archiplan.json : projet source, à rouvrir dans ARCHIPLAN.\r\n`;
      return offer(`${base}_archivision.zip`, makeZip([{name:`${base}.glb`, data:glb}, {name:`${base}.ifc`, data:buildIFC()}, {name:`${base}_metre.csv`, data:buildCSV()}, {name:`${base}_DQE.xlsx`, data:new Uint8Array(await dqeXLSX().arrayBuffer())}, {name:`${base}.archiplan.json`, data:projectJSON()}, {name:'LISEZMOI.txt', data:readme}]));
    }
  } catch(e){ console.error(e); toast('L\'export a échoué. Réessayez dans un instant.'); }
}
