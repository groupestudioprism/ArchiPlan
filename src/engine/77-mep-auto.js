/* ============ Équipements techniques : mode automatique et génération des réseaux ============
   Pièces nommées → proposition d'implantation (modifiable en plan) → pose des composants → génération des réseaux (voir règles dans 76-mep.js). */
const mepNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function roomKind(name){
  const n = mepNorm(name);
  if (/\b(wc|toilette|toilettes)\b/.test(n)) return 'wc';
  if (/salle de bain|sdb|salle d.eau|\bsde\b|douche|bain/.test(n)) return 'sdb';
  if (/buanderie|cellier|lingerie|arriere.cuisine/.test(n)) return 'buanderie';
  if (/cuisine|cuisinette|kitchen/.test(n)) return 'cuisine';
  if (/chambre|suite|dortoir/.test(n)) return 'chambre';
  if (/sejour|salon|salle a manger|\bsam\b|living|piece de vie|piece a vivre/.test(n)) return 'sejour';
  if (/entree|hall|sas|vestibule/.test(n)) return 'entree';
  if (/couloir|degagement|circulation|palier|passage/.test(n)) return 'couloir';
  if (/garage/.test(n)) return 'garage';
  if (/cave|local tech|chaufferie|atelier|technique/.test(n)) return 'technique';
  if (/terrasse|balcon|exterieur|jardin|patio|veranda|loggia|auvent/.test(n)) return 'ext';
  return 'autre';
}
const ROOM_KIND_NAME = {sejour:'Séjour', chambre:'Chambre', cuisine:'Cuisine', sdb:'Salle d\'eau', wc:'WC', entree:'Entrée', couloir:'Couloir', buanderie:'Buanderie', garage:'Garage', technique:'Local technique', ext:'Extérieur', autre:'Autre pièce'};
const ROOM_SUGG = ['Séjour', 'Cuisine', 'Chambre 1', 'Chambre 2', 'Chambre 3', 'Salle de bain', 'Salle d\'eau', 'WC', 'Entrée', 'Couloir', 'Buanderie', 'Cellier', 'Garage', 'Bureau', 'Dressing', 'Local technique'];
function mepRooms(){
  const out = [];
  state.levels.forEach((_, i) => { if (!state.els.some(e => e.kind === 'wall' && e.lvl === i)) return; for (const r of detectRooms(i)) out.push({...r, lvl:i, kind:roomKind(r.name), named:!!state.roomNames?.[r.key]}); });
  return out;
}
/* ---------- géométrie d'une pièce : arêtes, ouvertures, créneaux libres ---------- */
const dPoly = (p, poly) => { let d = Infinity; for (let i = 0; i < poly.length; i++) d = Math.min(d, segClosest(p, poly[i], poly[(i + 1) % poly.length]).d ?? V.len(V.sub(segClosest(p, poly[i], poly[(i + 1) % poly.length]).pt, p))); return d; };
function roomEdges(r){
  const walls = state.els.filter(w => w.kind === 'wall' && w.lvl === r.lvl), ops = state.els.filter(e => e.kind === 'inst' && e.host && state.els.find(w => w.id === e.host)?.lvl === r.lvl);
  return r.poly.map((a, i) => { const b = r.poly[(i + 1) % r.poly.length], d = V.sub(b, a), L = V.len(d) || 1e-9, u = V.mul(d, 1 / L), nIn = [-u[1], u[0]], m = V.mul(V.add(a, b), .5);
    let T = 0.2, bd = 1e9; for (const w of walls){ const q = segClosest(m, w.a, w.b), dd = V.len(V.sub(q.pt, m)); if (dd < bd){ bd = dd; T = wallT(w); } }
    const e = {i, a, b, u, nIn, L, T, f:T / 2, blocked:[[0, 0.25], [L - 0.25, L]], doors:[], wins:[]};
    for (const o of ops){ const F = fam(o.fam), c = famCut(o), fr = instFrame(o); if (!c || !fr) continue; const rel = V.sub(fr.o, a), t = V.dot(rel, u), sd = V.dot(rel, nIn);
      if (t < -0.2 || t > L + 0.2 || Math.abs(sd) > T / 2 + 0.25) continue;
      const iw = F?.cat === 'Portes'; (iw ? e.doors : e.wins).push({t, w:c.w, sill:c.sill, h:c.h}); if (iw || c.sill < 0.9) e.blocked.push([t - c.w / 2 - 0.1, t + c.w / 2 + 0.1]); }
    return e; });
}
const edgePt = (e, t, off = e.f) => V.add(V.add(e.a, V.mul(e.u, t)), V.mul(e.nIn, off));
const wallRot = e => Math.round((Math.atan2(-e.nIn[1], -e.nIn[0]) * 180 / Math.PI - 90) * 100) / 100;
function freeIntervals(e, need = 0.3){
  const B = e.blocked.slice().sort((x, y) => x[0] - y[0]), out = []; let c = 0;
  for (const [l, h] of B){ if (l - c >= need) out.push([c, l]); c = Math.max(c, h); } if (e.L - c >= need) out.push([c, e.L]); return out;
}
function wallSlots(edges, step = 0.7){
  const out = []; for (const e of edges) for (const [l, h] of freeIntervals(e, 0.3)){ const n = Math.max(1, Math.floor((h - l) / step)); for (let k = 0; k < n; k++) out.push({e, t:l + (h - l) * (k + 0.5) / n}); }
  return out;
}
const spread = (arr, n) => { if (!arr.length || n <= 0) return []; const out = [], used = new Set(); for (let i = 0; i < n; i++){ let k = Math.floor((i + 0.5) * arr.length / n); while (used.has(k) && used.size < arr.length) k = (k + 1) % arr.length; used.add(k); out.push(arr[k]); } return out; };
function poleOf(poly, margin = 0){ const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); let best = null, bd = -1;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.2) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.2){ if (!ptInPoly(x, y, poly)) continue; const d = dPoly([x, y], poly); if (d > bd){ bd = d; best = [x, y]; } } return best || polyCentroid(poly); }
function ceilPoints(poly, n){
  const c0 = poleOf(poly); if (n <= 1) return [c0]; const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), cand = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.25) if (ptInPoly(x, y, poly) && dPoly([x, y], poly) > 0.35) cand.push([x, y]);
  const pts = [c0]; while (pts.length < n && cand.length){ let b = null, bd = -1; for (const p of cand){ const d = Math.min(...pts.map(q => V.len(V.sub(p, q)))); if (d > bd){ bd = d; b = p; } } pts.push(b); }
  return pts;
}
const famYmax = id => { const F = fam(id); if (!F) return 0; try { return Math.max(...famSolids(F, famScope(F, {type:0, params:{}})).map(s => s.c[1] + (s.s === 'box' ? s.d / 2 : s.s === 'cyl' || s.s === 'sph' ? s.r : 0))); } catch(e){ return 0; } };
const famWidth = id => { const F = fam(id); if (!F) return 0.5; try { const S = famSolids(F, famScope(F, {type:0, params:{}})), xs = S.flatMap(s => [s.c[0] - (s.w ?? s.r * 2) / 2, s.c[0] + (s.w ?? s.r * 2) / 2]); return Math.max(...xs) - Math.min(...xs); } catch(e){ return 0.6; } };

/* ---------- obstacles : mobilier, appareils sanitaires, équipements déjà posés (empreintes au sol + hauteurs) ---------- */
const MEP_ELEC_WALL = new Set(['prise', 'spec', 'plaque', 'rj45', 'inter', 'tableau']);
const MEP_SMALL = new Set(['prise', 'spec', 'plaque', 'rj45', 'inter', 'applique', 'lum', 'spot', 'daaf', 'vext', 'ventree']);
const pseudoEl = it => ({kind:'inst', fam:it.fam, type:it.type | 0, params:it.params || {}, c:it.c, rot:it.rot || 0, lvl:it.lvl, off:mepFloorOff(it.lvl), mirror:false});
/* rectangles (coins en plan + cotes basse et haute, relatives au niveau) des pièces d'une famille posée librement */
function mepRects(el){
  let S = []; try { S = instSolids(el); } catch(e){ return []; } const z0L = lvlZ(el.lvl || 0) + mepFloorOff(el.lvl || 0), out = [];   // cotes relatives au sol fini
  for (const so of S){ let w, d, z0, z1;
    if (so.s === 'box'){ w = so.w; d = so.d; z0 = so.c[2] - so.h / 2; z1 = so.c[2] + so.h / 2; }
    else if (so.s === 'cyl' || so.s === 'cone'){ w = d = 2 * so.r; z0 = so.c[2] - (so.h || 0) / 2; z1 = so.c[2] + (so.h || 0) / 2; if (so.ax){ z0 = so.c[2] - so.r; z1 = so.c[2] + so.r; } }
    else if (so.s === 'sph'){ w = d = 2 * so.r; z0 = so.c[2] - so.r; z1 = so.c[2] + so.r; }
    else if (so.s === 'ext' && so.pts?.length >= 3){ const a = so.rz || 0, ca = Math.cos(a), sa = Math.sin(a); out.push({pts:so.pts.map(([x, y]) => [so.c[0] + x * ca - y * sa, so.c[1] + x * sa + y * ca]), z0:so.c[2] - so.h / 2 - z0L, z1:so.c[2] + so.h / 2 - z0L, m:so.m, h:so.h}); continue; }
    else if (so.w && so.d){ w = so.w; d = so.d; z0 = so.c[2] - (so.h || 0.5) / 2; z1 = so.c[2] + (so.h || 0.5) / 2; }
    else continue;
    const a = so.rz || 0, ux = [Math.cos(a) * w / 2, Math.sin(a) * w / 2], uy = [-Math.sin(a) * d / 2, Math.cos(a) * d / 2], c = [so.c[0], so.c[1]];
    out.push({pts:[[c[0] - ux[0] - uy[0], c[1] - ux[1] - uy[1]], [c[0] + ux[0] - uy[0], c[1] + ux[1] - uy[1]], [c[0] + ux[0] + uy[0], c[1] + ux[1] + uy[1]], [c[0] - ux[0] + uy[0], c[1] - ux[1] + uy[1]]], z0:z0 - z0L, z1:z1 - z0L, m:so.m, h:so.h}); }
  return out;
}
const rectDist = (p, pts) => ptInPoly(p[0], p[1], pts) ? 0 : dPoly(p, pts);
/* toutes les contraintes d'un niveau : obstacles (mobilier et gros équipements) et zones d'eau (douche, baignoire, lavabo, évier) */
function mepConstraints(lvl, items = []){
  const obst = [], wet = [], basins = [];
  const take = (el, kind, src) => { const R = mepRects(el); if (!R.length) return;
    if (kind === 'douche' || kind === 'baignoire') wet.push(...R.map(r => ({...r, kind, src})));
    if (kind === 'lavabo') basins.push(...R.map(r => ({...r, kind, src})));
    if (kind === 'cuisine') basins.push(...R.filter(r => r.m === 'inox' && (r.h || 1) < 0.02).map(r => ({...r, kind:'evier', z1:Math.max(r.z1, 0.9), src})));
    // receveur de douche, baignoire : obstacle sur toute la hauteur (rien ne se pose au-dessus)
    obst.push(...R.map(r => ({...r, kind:kind || 'meuble', src, z1:kind === 'douche' || kind === 'baignoire' ? Math.max(r.z1, 2.2) : r.z1}))); };
  for (const e of state.els) if (e.kind === 'inst' && !e.host && e.lvl === lvl && e.c){ const k = MEP_KIND[e.fam]; if (k && MEP_SMALL.has(k)) continue; if (e.auto && k) continue; take(e, k, e.id); }
  items.forEach((it, i) => { if (it.lvl !== lvl || MEP_SMALL.has(it.kind)) return; take(pseudoEl(it), it.kind, 'p' + i); });
  return {obst, wet, basins};
}
/* raison pour laquelle un équipement ne peut pas être à cet endroit ('' = autorisé). p : position du composant (au nu du mur pour un objet mural) */
function mepWhyNot(kind, p, zlo, zhi, C, o = {}){
  const self = o.self, halfW = o.halfW || 0.05, dir = o.dir, ign = o.ignore || [];
  const pts = dir ? [p, V.add(p, V.mul(dir, halfW)), V.sub(p, V.mul(dir, halfW))] : [p];
  if (MEP_ELEC_WALL.has(kind)){
    for (const r of C.wet) if (r.src !== self && pts.some(q => rectDist(q, r.pts) < 0.6 - 1e-3)) return `${MEP_LABEL[kind]} : interdit à moins de 60 cm d'une ${r.kind === 'douche' ? 'douche' : 'baignoire'} (volumes 1 et 2, NF C 15-100 partie 7-701)`;
    if (kind !== 'inter' && kind !== 'tableau') for (const r of C.basins) if (r.src !== self && zlo >= r.z1 - 0.05 && pts.some(q => rectDist(q, r.pts) < 0.1)) return `${MEP_LABEL[kind]} : pas au-dessus d'un ${r.kind === 'evier' ? 'évier' : 'lavabo'} (NF C 15-100)`;
  }
  if (kind === 'seche') for (const r of C.wet) if (r.src !== self && pts.some(q => rectDist(q, r.pts) < 0.05)) return 'Sèche-serviettes interdit dans la douche ou la baignoire (volume 1) ; classe II admise en volume 2';
  if (kind === 'tableau'){ for (const r of C.wet) if (r.src !== self && pts.some(q => rectDist(q, r.pts) < 0.6)) return 'Tableau électrique interdit dans une salle d\'eau (hors des volumes 0 à 2 au minimum ; à éviter dans la pièce)'; }
  for (const r of C.obst){ if (r.src === self || ign.includes(r.kind) || r.z1 <= zlo + 0.02 || r.z0 >= zhi - 0.02) continue;
    if (pts.some(q => rectDist(q, r.pts) < 0.06)) return r.kind && MEP_KIND[r.kind] !== undefined && r.kind !== 'meuble' ? `Emplacement déjà occupé (${MEP_LABEL[r.kind] || 'équipement'})` : 'Emplacement occupé par un meuble'; }
  return '';
}
/* sorties placées volontairement derrière les meubles de cuisine : plaque 32 A, circuits spécialisés (four, lave-vaisselle), prise de hotte */
const mepIgnores = (k, zlo) => k === 'plaque' || k === 'spec' || (k === 'prise' && zlo >= 1.7) ? ['cuisine'] : [];
/* hauteurs occupées par un composant (relatives au niveau) */
function mepZRange(fam_, params = {}){
  const F = fam(fam_), k = MEP_KIND[fam_]; let s = {}; try { s = famScope(F, {type:0, params}); } catch(e){}
  if (k === 'tableau') return [s.zh ?? 1, (s.zh ?? 1) + 0.15 * (s.rg || 3) + 0.5];
  if (k === 'rad') return [0, 0.8]; if (k === 'seche') return [0.4, 1.6]; if (k === 'ballon') return [0, (s.h || 1.5) + 0.1]; if (k === 'pac') return [0, 1.1];
  if (['wc', 'lavabo', 'douche', 'baignoire', 'cuisine'].includes(k)) return [0, 2.2];
  if (k === 'arrivee') return [(s.zh ?? 0.6), (s.zh ?? 0.6) + 0.2];
  const z = params.zh ?? s.zh ?? 0.3; return [z, z + 0.1];
}
/* centre en x (repère local) d'une famille : la cuisine linéaire part de x = 0, les autres sont centrées */
const famCx = (id, params = {}) => { const F = fam(id); if (!F) return 0; try { const S = famSolids(F, famScope(F, {type:0, params})); const xs = S.flatMap(s => [s.c[0] - (s.w ?? (s.r || 0) * 2) / 2, s.c[0] + (s.w ?? (s.r || 0) * 2) / 2]); return (Math.min(...xs) + Math.max(...xs)) / 2; } catch(e){ return 0; } };

/* ---------- proposition ---------- */
const MEP_DEF = {sys:{elec:true, plomb:true, vent:true, chauf:true}, occ:0, heat:'eau', light:'mixte', wm2:55, fix:true};
/* keep : équipements placés ou déplacés par l'utilisateur dans l'aperçu (conservés tels quels, la proposition les complète) */
function mepPropose(O, keep = [], opt = {}){
  const rooms = mepRooms().filter(r => r.kind !== 'ext'), items = keep.map(it => ({...it, user:true})), notes = [];
  const nCh = rooms.filter(r => r.kind === 'chambre').length, occ = O.occ > 0 ? O.occ : Math.max(1, nCh + 1), T = Math.max(1, rooms.filter(mepIsMain).length);
  const ctx = rooms.map(r => ({r, E:roomEdges(r)}));
  const CC = {}, cons = lvl => CC[lvl] ??= mepConstraints(lvl, items), dirty = lvl => { delete CC[lvl]; };
  // équipements déjà là (dessinés à la main dans la maquette, ou posés par l'utilisateur dans l'aperçu)
  const manual = state.els.filter(e => e.kind === 'inst' && (!e.auto || opt.countAll) && MEP_KIND[e.fam] && e.c).map(e => ({kind:MEP_KIND[e.fam], lvl:e.lvl, c:e.c}));
  const present = () => [...manual, ...items.filter(i => i.user)];
  const countIn = (R, kinds) => present().filter(i => kinds.includes(i.kind) && i.lvl === R.r.lvl && ptInPoly(i.c[0], i.c[1], R.r.poly)).length;
  const anyOf = kind => present().some(i => i.kind === kind);
  const add = (r, fam_, o = {}) => { const it = {fam:fam_, type:o.type | 0, params:o.params || {}, lvl:r.lvl, c:o.c, rot:o.rot || 0, room:r.key, kind:MEP_KIND[fam_], auto:true}; items.push(it); if (!MEP_SMALL.has(it.kind)) dirty(r.lvl); return it; };
  const posOn = (fam_, e, t, params = {}) => { const ym = famYmax(fam_), cx = famCx(fam_, params), rot = wallRot(e), a = rot * Math.PI / 180;
    return {c:V.sub(V.add(edgePt(e, t), V.mul(e.nIn, ym)), [Math.cos(a) * cx, Math.sin(a) * cx]), rot}; };
  const onWall = (R, fam_, e, t, o = {}) => add(R.r, fam_, {...o, ...posOn(fam_, e, t, o.params)});
  /* créneaux possibles sur les murs d'une pièce pour un composant de largeur w (hors portes, fenêtres basses, mobilier, volumes de salle d'eau) */
  const slots = (R, fam_, o = {}) => { const k = MEP_KIND[fam_], w = o.w ?? (MEP_SMALL.has(k) ? 0.1 : (famWidth(fam_) || 0.5)), [zlo, zhi] = o.z || mepZRange(fam_, o.params), C = cons(R.r.lvl), out = [];
    for (const e of R.E){ if (o.edges && !o.edges.includes(e)) continue;
      for (const [l, h] of freeIntervals(e, w + 0.1)){ for (let t = l + w / 2 + 0.05; t <= h - w / 2 - 0.05 + 1e-6; t += o.step || 0.1){
        const p = edgePt(e, t), why = mepWhyNot(k, p, zlo, zhi, C, {halfW:w / 2 + 0.05, dir:e.u, ignore:mepIgnores(k, zlo)});
        if (!why) out.push({e, t}); } } }
    return out; };
  const block = (s, w) => s.e.blocked.push([s.t - w / 2 - 0.05, s.t + w / 2 + 0.05]);
  const wallItems = (R, fam_, n, o = {}) => { if (n <= 0) return 0; let S = slots(R, fam_, o); const w = MEP_SMALL.has(MEP_KIND[fam_]) ? 0.1 : (famWidth(fam_) || 0.5);
    // espacer les créneaux retenus (pas plus de un tous les o.step mètres sur un même mur)
    const pickd = []; for (const s of spread(S, Math.min(n, S.length))){ if (pickd.some(q => q.e === s.e && Math.abs(q.t - s.t) < (o.gap ?? 0.4))) continue; pickd.push(s); }
    for (const s of pickd){ onWall(R, fam_, s.e, s.t, o); block(s, Math.max(w, 0.3)); }
    if (pickd.length < n) notes.push(`${R.r.name} : ${n - pickd.length} ${MEP_LABEL[MEP_KIND[fam_]]?.toLowerCase() || 'élément'}${n - pickd.length > 1 ? 's' : ''} sans emplacement libre (mobilier, ouvertures ou volumes de la salle d'eau)`);
    return pickd.length; };
  /* appareil posé contre un mur : le plus long créneau libre */
  const fixture = (R, fam_, o = {}) => { if (!fam(fam_)) return null; const S = slots(R, fam_, {...o, step:0.05}); if (!S.length){ notes.push(`${R.r.name} : pas de place libre pour ${fam(fam_).nom.toLowerCase()}`); return null; }
    // regrouper en suites continues, garder la plus longue, se placer au centre (ou à une extrémité)
    const runs = []; for (const s of S){ const r = runs.at(-1); if (r && r.e === s.e && s.t - r.h < 0.051) r.h = s.t; else runs.push({e:s.e, l:s.t, h:s.t}); }
    const best = runs.sort((a, b) => (b.h - b.l) - (a.h - a.l))[0], t = o.end ? (o.end > 0 ? best.h : best.l) : (best.l + best.h) / 2, w = famWidth(fam_) || 0.6;
    onWall(R, fam_, best.e, t, o); block({e:best.e, t}, w); return {e:best.e, t}; };
  const pick = (...ks) => { for (const k of ks){ const R = ctx.find(R => R.r.kind === k && R.r.lvl === 0) || ctx.find(R => R.r.kind === k); if (R) return R; } return ctx[0]; };
  // 1) appareils sanitaires et cuisine (pas de doublon avec un appareil déjà dessiné dans la pièce)
  if (O.fix) for (const R of ctx){ const k = R.r.kind;
    if (k === 'wc' && !countIn(R, ['wc'])) fixture(R, 'wc');
    if (k === 'sdb'){ if (!countIn(R, ['douche', 'baignoire'])) fixture(R, 'douche', {end:1}); if (!countIn(R, ['lavabo'])) fixture(R, 'lavabo', {type:1}); }
    if (k === 'cuisine' && !countIn(R, ['cuisine'])) fixture(R, 'cuisine'); }
  for (const R of ctx){
    const k = R.r.kind, A = R.r.net;
    // chauffage d'abord : un radiateur a besoin d'un long pan de mur libre, les petits équipements se placent ensuite autour
    if (O.heat !== 'none' && O.sys.chauf && !countIn(R, ['rad', 'seche'])){
      const q = ['sejour', 'chambre', 'cuisine', 'autre', 'sdb', 'buanderie'].includes(k);
      if (q){ const W = Math.max(500, A * O.wm2 * (k === 'cuisine' ? 0.6 : k === 'sdb' ? 1.4 : 1)), elec = O.heat === 'elec';
        if (k === 'sdb') wallItems(R, 'c-seche', 1, {step:0.1});
        else { const sizes = elec ? [1000, 1500] : [500, 1000, 1500, 2000], mx = sizes.at(-1), n = Math.ceil(W / mx), each = W / n, sz = sizes.find(s => s >= each - 1) || mx, ty = elec ? (sz >= 1500 ? 5 : 4) : sizes.indexOf(sz);
          const L = elec ? (sz >= 1500 ? 1.0 : 0.8) : [0.5, 0.8, 1.1, 1.5][ty], params = {W:sz, L, zh:0};
          for (let j = 0; j < n; j++){
            // 1er choix : sous une fenêtre dont l'allège dépasse le radiateur (allège ≥ 0,85 m) ; jamais devant une porte, une porte-fenêtre ou une baie
            const all = slots(R, 'c-rad', {w:L, params, step:0.05}), under = all.filter(s => s.e.wins.some(w => w.sill >= 0.85 && Math.abs(s.t - w.t) < Math.max(0.05, (w.w - L) / 2 + 0.02)));
            const ext = all.filter(s => s.e.wins.length), S = under.length ? under : ext.length ? ext : all;
            if (!S.length){ notes.push(`${R.r.name} : aucun mur libre pour un radiateur de ${n0(L * 100)} cm (mobilier, ouvertures)`); break; }
            const s = under.length ? S.sort((a, b) => Math.min(...a.e.wins.map(w => Math.abs(a.t - w.t))) - Math.min(...b.e.wins.map(w => Math.abs(b.t - w.t))))[0] : S[Math.floor(S.length / 2)];
            onWall(R, 'c-rad', s.e, s.t, {type:ty, params}); block(s, L + 0.3); } }
      }
    }
    if (O.sys.elec){
      // prises (NF C 15-100) : on retire celles déjà posées dans la pièce
      const np = Math.max(0, mepPrisesMin(k, A) - countIn(R, ['prise'])); let hot = 0;
      if (k === 'cuisine'){ hot = Math.min(np, A <= 4 ? 2 : 4);
        // prises du plan de travail : au-dessus du plan, hors de l'évier
        const kit = items.concat(state.els.filter(e => e.kind === 'inst' && e.fam === 'cuisine')).find(i => i.fam === 'cuisine' && i.lvl === R.r.lvl && ptInPoly(i.c[0], i.c[1], R.r.poly));
        const edges = kit ? R.E.filter(e => Math.abs(V.dot(V.sub(kit.c, e.a), e.nIn)) < 1.0) : null;
        const got = wallItems(R, 'e-prise', hot, {params:{zh:1.05}, step:0.15, gap:0.3, edges}); if (got < hot) wallItems(R, 'e-prise', hot - got, {params:{zh:1.05}, step:0.15, gap:0.3}); }
      wallItems(R, 'e-prise', np - hot, {params:{zh:0.3}});
      if (k === 'cuisine'){ if (!countIn(R, ['plaque'])) wallItems(R, 'e-prise32', 1, {params:{zh:0.12}, step:0.2}); wallItems(R, 'e-prise-spec', Math.max(0, 2 - countIn(R, ['spec'])), {step:0.2}); wallItems(R, 'e-prise', 1, {params:{zh:1.8}, step:0.2}); }
      if ((k === 'buanderie') || (k === 'sdb' && !ctx.some(q => q.r.kind === 'buanderie' && q.r.lvl === R.r.lvl) && !ctx.some(q => q.r.kind === 'cuisine' && q.r.lvl === R.r.lvl && q.r.net > 8))) wallItems(R, 'e-prise-spec', Math.max(0, (k === 'buanderie' ? 2 : 1) - countIn(R, ['spec', 'll'])), {params:{zh:0.3}, step:0.2});
      if ((k === 'sejour' || k === 'chambre' || (k === 'autre' && /bureau/.test(mepNorm(R.r.name)))) && !countIn(R, ['rj45'])) wallItems(R, 'e-rj45', 1, {step:0.2});
      // éclairage
      if (!countIn(R, ['lum', 'spot', 'applique'])){ let nl = 1, fL = 'e-lum';
        const spots = O.light === 'spots' || (O.light === 'mixte' && ['cuisine', 'sdb', 'couloir', 'entree'].includes(k));
        if (spots){ fL = 'e-spot'; nl = k === 'couloir' || k === 'entree' ? Math.max(1, Math.ceil(A / 2.5)) : Math.max(2, Math.ceil(A / 2.8)); }
        else if (k === 'couloir') nl = Math.max(1, Math.round(A / 5));
        for (const c of ceilPoints(R.r.poly, nl)) add(R.r, fL, {c}); }
      // interrupteurs : côté poignée de chaque porte, sinon de l'autre côté, jamais derrière un meuble (va-et-vient si 2 portes)
      if (!countIn(R, ['inter'])){ const doors = R.E.flatMap(e => e.doors.map(d => ({e, d}))), C = cons(R.r.lvl); let placed = 0;
        doors.slice(0, 2).forEach(({e, d}) => { const cand = [d.t + d.w / 2 + 0.2, d.t - d.w / 2 - 0.2].filter(t => t > 0.15 && t < e.L - 0.15);
          const t = cand.find(t => !mepWhyNot('inter', edgePt(e, t), 1.1, 1.2, C)); if (t == null) return; onWall(R, 'e-inter', e, t, {type:doors.length > 1 ? 1 : 0, params:{zh:1.1}}); e.blocked.push([t - 0.1, t + 0.1]); placed++; });
        if (!placed) wallItems(R, 'e-inter', 1, {params:{zh:1.1}}); }
    }
    if (O.sys.vent){ const F = mepVentFlows(T), nWC = ctx.filter(q => q.r.kind === 'wc').length, nSdb = ctx.filter(q => q.r.kind === 'sdb').length;
      if (['cuisine', 'sdb', 'wc', 'buanderie'].includes(k) && !countIn(R, ['vext'])){ const first = ctx.find(q => q.r.kind === k) === R;
        const q = k === 'cuisine' ? F.cuisine : k === 'sdb' ? (first ? F.sdb : F.sde) : k === 'wc' ? (nWC > 1 ? F.wcN : F.wc1) : 15;
        add(R.r, 'v-extraction', {c:poleOf(R.r.poly), type:k === 'cuisine' ? 1 : 0, params:{q}}); }
      if ((k === 'sejour' || k === 'chambre') && !countIn(R, ['ventree'])){ const e = R.E.find(e => e.wins.length) || R.E.slice().sort((a, b) => b.L - a.L)[0], t = e.wins[0]?.t ?? e.L / 2; onWall(R, 'v-entree', e, t, {params:{zh:2.25}}); }
    }
  }
  // éléments uniques : tableau, détecteurs de fumée, VMC, générateur, ballon, arrivée d'eau
  if (O.sys.elec){
    if (!anyOf('tableau')){ const order = ['entree', 'couloir', 'garage', 'buanderie', 'technique', 'sejour'], cands = order.flatMap(k => ctx.filter(R => R.r.kind === k && R.r.lvl === 0)).concat(ctx); let ok = 0;
      for (const R of cands){ if (wallItems(R, 'e-tableau', 1, {step:0.2, params:{rg:3, zh:1.0}})){ ok = 1; break; } notes.pop(); }
      if (!ok) notes.push('Tableau électrique : aucun mur libre trouvé'); }
    for (const li of [...new Set(rooms.map(r => r.lvl))]){ if (present().some(i => i.kind === 'daaf' && i.lvl === li)) continue; const L = ctx.filter(R => R.r.lvl === li), R = L.find(R => R.r.kind === 'couloir') || L.find(R => R.r.kind === 'entree') || L.find(R => R.r.kind === 'sejour') || L[0];
      if (R && (li === 0 || L.some(q => q.r.kind === 'chambre'))) add(R.r, 'e-daaf', {c:poleOf(R.r.poly)}); }
  }
  if (O.sys.vent && !anyOf('vmc')){ const top = Math.max(...rooms.map(r => r.lvl)), L = ctx.filter(R => R.r.lvl === top), R = L.find(R => ['couloir', 'buanderie', 'wc', 'entree'].includes(R.r.kind)) || L[0]; if (R) add(R.r, 'v-caisson', {c:poleOf(R.r.poly), params:{zh:2.1}}); }
  if (O.sys.plomb || O.sys.chauf){
    const S = pick('buanderie', 'technique', 'garage', 'cuisine', 'sdb'), V0 = Math.max(0, [100, 150, 200, 250, 300].findIndex(v => v >= occ * 55)), V0f = V0 < 0 ? 4 : V0;   // ≈ 55 l par occupant
    if (O.sys.plomb){ if (!anyOf('ballon')) wallItems(S, 'p-ballon', 1, {step:0.1, type:[100, 150, 200, 250, 300].some(v => v >= occ * 55) ? V0f : 4, params:{}}); if (!anyOf('arrivee')) wallItems(S, 'p-arrivee', 1, {step:0.2, params:{zh:0.6}}); }
    const need = items.filter(i => i.kind === 'rad').reduce((t, i) => t + (i.params.W || 1000), 0) + items.filter(i => i.kind === 'seche').length * 750;
    if (O.sys.chauf && O.heat === 'eau' && !anyOf('pac')){ const kW = need / 1000, ty = kW <= 9 ? 0 : kW <= 14 ? 1 : 2;
      if (ty < 2){ // pompe à chaleur air/eau : unité extérieure posée dehors, contre un pan de façade plein, au plus près du local technique
        const all = rooms.filter(r => r.lvl === 0), outside = q => !all.some(r => ptInPoly(q[0], q[1], r.poly)), cand = [];
        for (const R of ctx.filter(R => R.r.lvl === 0)) for (const e of R.E){ const mid = edgePt(e, e.L / 2, -e.f - 0.6); if (!outside(mid) || e.L < 1.4 || e.wins.length || e.doors.length) continue;
          for (const [l, h] of freeIntervals({...e, blocked:[[0, 0.4], [e.L - 0.4, e.L]]}, 1.0)){ const t = (l + h) / 2, p = edgePt(e, t, -e.f); cand.push({e, t, p, d:Math.hypot(p[0] - S.r.poly[0][0], p[1] - S.r.poly[0][1])}); } }
        cand.sort((a, b) => a.d - b.d); const c = cand[0];
        if (c){ const ym = famYmax('c-pac'), rot = (wallRot(c.e) + 180) % 360; items.push({fam:'c-pac', type:ty, params:{}, lvl:0, c:V.sub(c.p, V.mul(c.e.nIn, ym)), rot, room:null, kind:'pac', auto:true, outside:true}); }
        else wallItems(S, 'c-pac', 1, {step:0.1, type:ty}); }
      else wallItems(S, 'c-pac', 1, {step:0.1, type:ty}); }
  }
  items.occ = occ; items.notes = notes; return items;
}
/* contrôle d'un équipement déplacé ou ajouté dans l'aperçu : '' si l'emplacement est autorisé, sinon la raison */
function mepItemProblem(it, items, idx){
  const k = it.kind, C = mepConstraints(it.lvl, items.filter((_, i) => i !== idx)), [zlo, zhi] = mepZRange(it.fam, it.params);
  if (MEP_SMALL.has(k) && !MEP_WALLKINDS.has(k)) return '';
  // objets muraux : point au nu du mur (le composant est décalé de son épaisseur vers la pièce)
  const a = (it.rot || 0) * Math.PI / 180, inward = [Math.sin(a), -Math.cos(a)], back = V.sub(it.c, V.mul(inward, famYmax(it.fam)));
  const w = MEP_SMALL.has(k) ? 0.1 : (famWidth(it.fam) || 0.5), cx = famCx(it.fam, it.params), mid = V.add(back, [Math.cos(a) * cx, Math.sin(a) * cx]);
  return mepWhyNot(k, mid, zlo, zhi, C, {halfW:w / 2, dir:[Math.cos(a), Math.sin(a)], ignore:mepIgnores(k, zlo)});
}
const MEP_SYM = {prise:['P', '#2563EB'], spec:['S', '#1D4ED8'], plaque:['C', '#1E3A8A'], rj45:['R', '#0EA5E9'], inter:['I', '#F59E0B'], lum:['L', '#EAB308'], spot:['•', '#EAB308'], applique:['A', '#EAB308'], tableau:['T', '#DC2626'], daaf:['F', '#DC2626'],
  ballon:['B', '#0891B2'], arrivee:['E', '#0369A1'], ll:['LL', '#0369A1'], wc:['WC', '#0F766E'], lavabo:['LV', '#0F766E'], douche:['D', '#0F766E'], baignoire:['BA', '#0F766E'], cuisine:['CU', '#0F766E'], vext:['X', '#7C3AED'], ventree:['v', '#7C3AED'], vmc:['VMC', '#7C3AED'], rad:['H', '#C2410C'], seche:['H', '#C2410C'], pac:['PAC', '#C2410C']};
const MEP_LABEL = {prise:'Prise de courant', spec:'Prise spécialisée', plaque:'Plaque de cuisson', rj45:'RJ45 / TV', inter:'Interrupteur', lum:'Plafonnier', spot:'Spot', applique:'Applique', tableau:'Tableau électrique', daaf:'Détecteur de fumée', ballon:'Ballon d\'eau chaude', arrivee:'Arrivée d\'eau', ll:'Attente lave-linge', wc:'WC', lavabo:'Lavabo', douche:'Douche', baignoire:'Baignoire', cuisine:'Cuisine', vext:'Bouche d\'extraction', ventree:'Entrée d\'air', vmc:'Caisson VMC', rad:'Radiateur', seche:'Sèche-serviettes', pac:'Générateur (PAC / chaudière)'};
const MEP_FAM_OF = Object.fromEntries(Object.entries(MEP_KIND).map(([f, k]) => [k, f]));
const MEP_WALLKINDS = new Set(['prise', 'spec', 'plaque', 'rj45', 'inter', 'applique', 'tableau', 'ballon', 'arrivee', 'll', 'wc', 'lavabo', 'douche', 'baignoire', 'cuisine', 'ventree', 'rad', 'seche', 'pac']);

function mepStart(){
  const rooms = mepRooms(); if (!rooms.length){ toast('Dessinez d\'abord des murs fermés : aucune pièce détectée'); return; }
  const un = rooms.filter(r => !r.named);
  if (un.length) return openRoomNames(rooms, true);
  openMepAuto(rooms);
}
/* nommer les pièces (la proposition en dépend) */
function openRoomNames(rooms, thenAuto){
  const un = rooms.filter(r => !r.named);
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Équipements techniques</span><h3 class="ed-t2">Nommez vos pièces</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><section><p class="mep-alert" role="alert"><b>${un.length} pièce${un.length > 1 ? 's ne sont pas renseignées' : ' n\'est pas renseignée'}.</b> La proposition automatique se base sur le nom de chaque pièce (séjour, cuisine, chambre, salle de bain, WC…) : prises, luminaires, ventilation et chauffage n'ont pas les mêmes règles selon la pièce.</p>
      <datalist id="rmSug">${ROOM_SUGG.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="mep-rooms">${rooms.map((r, i) => `<label class="mep-room${r.named ? '' : ' un'}"><span>${esc(state.levels[r.lvl].n)} · ${nf(r.net, 1)} m²</span><input data-rn="${i}" list="rmSug" value="${r.named ? esc(r.name) : ''}" placeholder="Nom de la pièce (ex. Chambre 1)" style="font-family:var(--f-body)"><em>${r.named ? ROOM_KIND_NAME[r.kind] : ''}</em></label>`).join('')}</div>
      <p class="hint">Les pièces laissées vides sont traitées comme « Autre pièce » (1 prise et 1 point lumineux).</p></section></div>
    <footer class="ed-f"><button class="btn" data-close>Annuler</button><button class="btn primary" id="rnGo">Valider les noms et continuer</button></footer>`, 'mid');
  d.querySelector('#rnGo').onclick = () => { pushHist(); state.roomNames ??= {}; d.querySelectorAll('[data-rn]').forEach(i => { const v = i.value.trim().slice(0, 40), r = rooms[+i.dataset.rn]; if (v) state.roomNames[r.key] = v; }); roomsCache = null; buildLabels(); closeEDlg(); mepStart2(); };
  function mepStart2(){ openMepAuto(mepRooms()); }
}
function openMepAuto(rooms){
  rooms ??= mepRooms();
  const O = {...MEP_DEF, sys:{...MEP_DEF.sys}, ...(state.mepOpts || {})}; O.sys = {...MEP_DEF.sys, ...(O.sys || {})};
  let items = mepPropose(O), lvl = rooms[0]?.lvl ?? 0, tool = 'move', pal = 'prise', sel = -1, drag = null;
  const lvls = [...new Set(rooms.map(r => r.lvl))];
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Plomberie · Électricité · Ventilation · Chauffage</span><h3 class="ed-t2">Proposition d'implantation</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="mepx"><aside class="mepx-l">
      <div class="grp" style="margin-top:0"><h3>Réseaux à équiper</h3>${[['elec', 'Électricité (NF C 15-100)'], ['plomb', 'Plomberie (eau, évacuations)'], ['vent', 'Ventilation (VMC)'], ['chauf', 'Chauffage']].map(([k, n]) => `<label class="ap-check2"><input type="checkbox" data-sys="${k}"${O.sys[k] ? ' checked' : ''}> ${n}</label>`).join('')}
        <div class="fields" style="margin-top:6px"><label class="f"><span>Occupants</span><span class="in"><input id="mxOcc" type="number" min="0" max="12" step="1" value="${O.occ || ''}" placeholder="auto"></span></label>
        <label class="f"><span>Chauffage</span><span class="in"><select id="mxHeat"><option value="eau"${O.heat === 'eau' ? ' selected' : ''}>Eau chaude (PAC)</option><option value="elec"${O.heat === 'elec' ? ' selected' : ''}>Radiateurs électriques</option><option value="none"${O.heat === 'none' ? ' selected' : ''}>Aucun</option></select></span></label>
        <label class="f"><span>Éclairage</span><span class="in"><select id="mxLight"><option value="mixte"${O.light === 'mixte' ? ' selected' : ''}>Mixte</option><option value="lum"${O.light === 'lum' ? ' selected' : ''}>Plafonniers</option><option value="spots"${O.light === 'spots' ? ' selected' : ''}>Spots</option></select></span></label>
        <label class="f"><span>Besoin</span><span class="in"><input id="mxW" type="number" min="25" max="120" step="5" value="${O.wm2}"><em>W/m²</em></span></label></div>
        <label class="ap-check2"><input type="checkbox" id="mxFix"${O.fix ? ' checked' : ''}> Placer aussi WC, lavabo, douche, cuisine</label>
        <button class="btn" id="mxRe" style="margin-top:6px">Recalculer la proposition</button></div>
      <div class="grp"><h3>Modifier l'aperçu</h3><div class="seg" id="mxTool" style="flex-wrap:wrap">${[['move', 'Déplacer'], ['add', 'Ajouter'], ['furn', 'Meubles'], ['del', 'Retirer']].map(([k, n]) => `<button class="${k === tool ? 'on' : ''}" data-mt="${k}">${n}</button>`).join('')}</div>
        <p class="hint" id="mxHint"></p><div class="mepx-pal" id="mxPal"></div><div class="mepx-pal" id="mxFurn" hidden></div><button class="btn" id="mxRot" hidden style="margin-top:6px">Pivoter le meuble de 90°</button>
        <p class="hint" id="mxNotes" role="status"></p></div>
    </aside><section class="mepx-r"><div class="mepx-top"><div class="seg" id="mxLv">${lvls.map(l => `<button class="${l === lvl ? 'on' : ''}" data-lv="${l}">${esc(state.levels[l].n)}</button>`).join('')}</div><span class="hint" id="mxSum"></span></div>
      <canvas id="mxCv" width="900" height="640"></canvas></section></div>
    <footer class="ed-f"><span class="hint">Les composants posés sont de vrais éléments (comptés au DQE). Les anciens éléments automatiques sont remplacés.</span><button class="btn" data-close>Annuler</button><button class="btn" id="mxPlace">Valider et placer</button><button class="btn primary" id="mxPlaceNets">Valider, placer et générer les réseaux</button></footer>`, 'wide');
  const q = s => d.querySelector(s), cv = q('#mxCv'), g = cv.getContext('2d'), RL = () => rooms.filter(r => r.lvl === lvl);
  let X = null;   // transformation monde → écran
  const fit = () => { const P = RL().flatMap(r => r.poly); if (!P.length) return; const xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs) - 0.5, x1 = Math.max(...xs) + 0.5, y0 = Math.min(...ys) - 0.5, y1 = Math.max(...ys) + 0.5, k = Math.min(cv.width / (x1 - x0), cv.height / (y1 - y0)); X = {k, x0, y1, ox:(cv.width - (x1 - x0) * k) / 2, oy:(cv.height - (y1 - y0) * k) / 2}; };
  const W2S = p => [X.ox + (p[0] - X.x0) * X.k, X.oy + (X.y1 - p[1]) * X.k], S2W = (sx, sy) => [X.x0 + (sx - X.ox) / X.k, X.y1 - (sy - X.oy) / X.k];
  const COL = {sejour:'#FDE9C9', chambre:'#DDEBFA', cuisine:'#E6F4D7', sdb:'#D5F0F2', wc:'#D5F0F2', entree:'#EFE3F7', couloir:'#EFE3F7', buanderie:'#E9ECEF', garage:'#E9ECEF', technique:'#E9ECEF', autre:'#F4F4F1'};
  const draw = () => {
    fit(); g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    for (const r of RL()){ g.beginPath(); r.poly.forEach((p, i) => { const s = W2S(p); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.closePath(); g.fillStyle = COL[r.kind] || '#F4F4F1'; g.fill(); g.strokeStyle = '#1B2433'; g.lineWidth = 2.5; g.stroke();
      const c = W2S(polyCentroid(r.poly)); g.fillStyle = 'rgba(17,24,39,.55)'; g.font = '600 13px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(r.name, c[0], c[1] + 4); g.font = '11px Inter, sans-serif'; g.fillText(nf(r.net, 1) + ' m²', c[0], c[1] + 18); }
    for (const e of state.els) if (e.kind === 'inst' && e.host && !MEP_KIND[e.fam]){ const w = getEl(e.host); if (!w || w.lvl !== lvl) continue; const c = famCut(e), fr = instFrame(e); if (!c || !fr) continue; const u = [Math.cos(fr.ang), Math.sin(fr.ang)], a = W2S(V.sub(fr.o, V.mul(u, c.w / 2))), b = W2S(V.add(fr.o, V.mul(u, c.w / 2))); g.strokeStyle = fam(e.fam)?.cat === 'Portes' ? '#C2410C' : '#2563EB'; g.lineWidth = 4; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    // mobilier et appareils de la maquette (empreintes), puis appareils proposés
    const poly = (pts, fill, stroke) => { g.beginPath(); pts.forEach((p, i) => { const s = W2S(p); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); };
    for (const e of furnList()) for (const r of mepRects(e)) if (r.z1 >= 0.05 || ['douche', 'baignoire'].includes(MEP_KIND[e.fam])) poly(r.pts, e.id === fsel ? 'rgba(37,99,235,.28)' : 'rgba(100,110,125,.22)', e.id === fsel ? '#2563EB' : 'rgba(60,70,85,.55)');
    items.forEach(it => { if (it.lvl !== lvl || MEP_SMALL.has(it.kind)) return; for (const r of mepRects(pseudoEl(it))) if (r.z1 >= 0.05 || it.kind === 'douche' || it.kind === 'baignoire') poly(r.pts, 'rgba(15,118,110,.12)', 'rgba(15,118,110,.45)'); });
    // volume 2 (60 cm autour de la douche ou de la baignoire) : aucune prise ni interrupteur
    g.setLineDash([5, 4]); for (const r of mepConstraints(lvl, items).wet){ const xs = r.pts.map(p => p[0]), ys = r.pts.map(p => p[1]), a = W2S([Math.min(...xs) - 0.6, Math.max(...ys) + 0.6]), b = W2S([Math.max(...xs) + 0.6, Math.min(...ys) - 0.6]); g.strokeStyle = 'rgba(8,145,178,.7)'; g.lineWidth = 1.2; g.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); } g.setLineDash([]);
    items.forEach((it, i) => { if (it.lvl !== lvl) return; const [ch, col] = MEP_SYM[it.kind] || ['?', '#666'], s = W2S(it.c), r = ch.length > 1 ? 11 : 8;
      g.beginPath(); g.arc(s[0], s[1], r, 0, 7); g.fillStyle = col; g.globalAlpha = i === sel ? 1 : 0.88; g.fill(); g.globalAlpha = 1; if (i === sel){ g.lineWidth = 3; g.strokeStyle = '#111'; g.stroke(); }
      if (it.bad){ g.beginPath(); g.arc(s[0], s[1], r + 4, 0, 7); g.lineWidth = 3; g.strokeStyle = '#DC2626'; g.stroke(); } else if (it.user){ g.beginPath(); g.arc(s[0], s[1], r + 3, 0, 7); g.lineWidth = 1.5; g.strokeStyle = '#111'; g.stroke(); }
      g.fillStyle = '#fff'; g.font = `700 ${ch.length > 2 ? 8 : ch.length > 1 ? 9 : 10}px Inter, sans-serif`; g.textAlign = 'center'; g.fillText(ch, s[0], s[1] + 3.5); });
  };
  const kinds = [...new Set(Object.values(MEP_KIND))].filter(k => !['arrivee'].includes(k) || true);
  const sum = () => { const c = {}; items.forEach(i => c[i.kind] = (c[i.kind] || 0) + 1); q('#mxSum').textContent = `${items.length} éléments · ${items.filter(i => i.kind === 'prise' || i.kind === 'spec' || i.kind === 'plaque').length} prises · ${items.filter(i => i.kind === 'lum' || i.kind === 'spot').length} points lumineux`;
    q('#mxPal').innerHTML = kinds.filter(k => MEP_LABEL[k]).map(k => { const [ch, col] = MEP_SYM[k]; return `<button class="${k === pal ? 'on' : ''}" data-pk="${k}" title="${MEP_LABEL[k]}"><i style="background:${col}">${ch}</i><span>${MEP_LABEL[k]}</span><em>${c[k] || 0}</em></button>`; }).join('');
    q('#mxFurn').innerHTML = FURN.map(([f, n]) => `<button class="${f === fpal ? 'on' : ''}" data-fp="${f}"><i style="background:#64748B">${esc(n.slice(0, 2))}</i><span>${esc(n)}</span></button>`).join('');
    q('#mxFurn').hidden = tool !== 'furn'; q('#mxPal').hidden = tool === 'furn'; q('#mxRot').hidden = !fsel || !getEl(fsel);
    q('#mxHint').textContent = tool === 'move' ? 'Glissez un symbole ou un meuble pour le déplacer : les équipements se collent au mur le plus proche, un emplacement interdit est refusé. Ce que vous placez ou déplacez est conservé quand la proposition est recalculée.' : tool === 'add' ? `Cliquez dans une pièce pour ajouter : ${MEP_LABEL[pal]}.` : tool === 'furn' ? `Cliquez dans une pièce pour poser : ${FURN.find(f => f[0] === fpal)?.[1] || ''} (contre le mur le plus proche). Le meuble est ajouté à la maquette et la proposition s'adapte.` : 'Cliquez un symbole ou un meuble pour le retirer.';
    const N = items.notes || [], bad = items.filter(i => i.bad).length; q('#mxNotes').innerHTML = (bad ? `<b style="color:#DC2626">${bad} équipement${bad > 1 ? 's' : ''} à un emplacement interdit.</b> ` : '') + N.slice(0, 6).map(esc).join('<br>'); };
  const hit = (sx, sy) => { let b = -1, bd = 14; items.forEach((it, i) => { if (it.lvl !== lvl) return; const s = W2S(it.c), dd = Math.hypot(s[0] - sx, s[1] - sy); if (dd < bd){ bd = dd; b = i; } }); return b; };
  const placeOnEdge = (fid, params, e, t) => { const w = MEP_SMALL.has(MEP_KIND[fid]) ? 0.1 : (famWidth(fid) || 0.5), tt = clamp(t, Math.min(e.L / 2, w / 2 + 0.05), Math.max(e.L / 2, e.L - w / 2 - 0.05)), ym = famYmax(fid), cx = famCx(fid, params), rot = wallRot(e), a = rot * Math.PI / 180;
    return {c:V.sub(V.add(edgePt(e, tt), V.mul(e.nIn, ym)), [Math.cos(a) * cx, Math.sin(a) * cx]), rot}; };
  const nearestEdge = (R, p) => { let best = null, bd = 1e9; for (const e of roomEdges(R)){ const c = segClosest(p, e.a, e.b), dd = V.len(V.sub(c.pt, p)); if (dd < bd){ bd = dd; best = {e, t:c.t * e.L, d:dd}; } } return best; };
  const roomAt = p => RL().find(r => ptInPoly(p[0], p[1], r.poly));
  const snapTo = (it, p) => {   // objets muraux : collés au mur de la pièce la plus proche ; plafond : dans la pièce
    const R = roomAt(p) || RL().slice().sort((a, b) => dPoly(p, a.poly) - dPoly(p, b.poly))[0]; if (!R) return;
    it.room = R.key;
    if (MEP_WALLKINDS.has(it.kind)){ const b = nearestEdge(R, p); Object.assign(it, placeOnEdge(it.fam, it.params, b.e, b.t)); }
    else it.c = ptInPoly(p[0], p[1], R.poly) ? p : poleOf(R.poly); };
  /* mobilier : éléments réels de la maquette (familles libres hors petits équipements) */
  const FURN = [['lit', 'Lit'], ['armoire', 'Armoire / placard'], ['canape', 'Canapé'], ['table', 'Table'], ['bureau', 'Bureau'], ['cuisine', 'Cuisine'], ['wc', 'WC'], ['lavabo', 'Lavabo'], ['douche', 'Douche'], ['baignoire', 'Baignoire']].filter(([f]) => fam(f));
  let fpal = FURN[0]?.[0], fsel = null, fdrag = null, start = null;
  function furnList(){ return state.els.filter(e => e.kind === 'inst' && !e.host && e.lvl === lvl && e.c && !(MEP_KIND[e.fam] && (MEP_SMALL.has(MEP_KIND[e.fam]) || e.auto))); }
  const furnAt = p => furnList().filter(e => mepRects(e).some(r => r.z1 >= 0.05 && ptInPoly(p[0], p[1], r.pts))).at(-1);
  /* meuble lâché près d'un mur : dos plaqué contre le mur, parallèle à lui */
  const snapFurn = el => { const a = (el.rot || 0) * Math.PI / 180, cx = famCx(el.fam, el.params), ym = famYmax(el.fam), xa = [Math.cos(a), Math.sin(a)], ya = [-Math.sin(a), Math.cos(a)];
    // centre approché du meuble ; s'il est parallèle à un mur proche, son dos est plaqué contre ce mur (quel que soit le sens de départ)
    const P = mepRects(el).flatMap(r => r.pts); if (!P.length) return; const mid = [P.reduce((t, p) => t + p[0], 0) / P.length, P.reduce((t, p) => t + p[1], 0) / P.length], R = roomAt(mid) || roomAt(el.c); if (!R) return; const b = nearestEdge(R, mid); if (!b) return;
    const face = edgePt(b.e, b.t), gap = Math.min(...P.map(p => V.dot(V.sub(p, face), b.e.nIn))); if (gap < 0.5 && Math.abs(V.dot(xa, b.e.u)) > 0.7){ const ps = placeOnEdge(el.fam, el.params, b.e, b.t); el.c = ps.c.map(rnd); el.rot = ps.rot; } };
  const recalc = () => { items = mepPropose(O, items.filter(i => i.user)); items.forEach((it, i) => { if (it.user) it.bad = mepItemProblem(it, items, i); }); sel = -1; draw(); sum(); };
  const furnChanged = () => { roomsCache = null; rebuild({noPanel:true}); recalc(); };
  const ptr = ev => { const r = cv.getBoundingClientRect(); return S2W((ev.clientX - r.left) * cv.width / r.width, (ev.clientY - r.top) * cv.height / r.height); };
  cv.addEventListener('pointerdown', ev => { const r = cv.getBoundingClientRect(), sx = (ev.clientX - r.left) * cv.width / r.width, sy = (ev.clientY - r.top) * cv.height / r.height, h = hit(sx, sy), p = S2W(sx, sy);
    if (tool === 'del'){ if (h >= 0){ items.splice(h, 1); sel = -1; draw(); sum(); return; } const f = furnAt(p); if (f){ pushHist(); state.els = state.els.filter(e => e !== f); fsel = null; furnChanged(); } return; }
    if (tool === 'add'){ const fid = MEP_FAM_OF[pal], it = {fam:fid, type:0, params:{}, lvl, c:p, rot:0, kind:pal, auto:true, user:true}; snapTo(it, it.c); if (!it.room) return;
      const why = mepItemProblem(it, items, -1); if (why){ toast(why); return; } items.push(it); sel = items.length - 1; draw(); sum(); return; }
    if (tool === 'furn'){ const R = roomAt(p); if (!R) return toast('Cliquez dans une pièce'); const params = {}, b = nearestEdge(R, p), ym = famYmax(fpal);
      const ps = b && b.d < ym + 0.9 ? placeOnEdge(fpal, params, b.e, b.t) : {c:p, rot:0};
      pushHist(); const el = {kind:'inst', fam:fpal, type:0, params, c:ps.c.map(rnd), rot:ps.rot, lvl, off:0, mirror:false, id:state.nextId++}; state.els.push(el); fsel = el.id; furnChanged(); return; }
    sel = h; if (h >= 0){ drag = h; start = {c:items[h].c.slice(), rot:items[h].rot, room:items[h].room}; cv.setPointerCapture(ev.pointerId); draw(); return; }
    const f = furnAt(p); fsel = f?.id ?? null; if (f){ fdrag = {el:f, off:V.sub(f.c, p), moved:false}; cv.setPointerCapture(ev.pointerId); } draw(); sum(); });
  cv.addEventListener('pointermove', ev => { const p = ptr(ev);
    if (fdrag){ if (!fdrag.moved){ pushHist(); fdrag.moved = true; } fdrag.el.c = V.add(p, fdrag.off).map(rnd); draw(); return; }
    if (drag == null) return; const it = items[drag]; snapTo(it, p); it.bad = mepItemProblem(it, items, drag); draw(); if (it.bad) q('#mxHint').textContent = it.bad; });
  cv.addEventListener('pointerup', () => {
    if (fdrag){ const el = fdrag.el, moved = fdrag.moved; fdrag = null; if (moved){ snapFurn(el); furnChanged(); } return; }
    if (drag != null){ const it = items[drag]; if (it.bad){ toast(it.bad); Object.assign(it, start); it.bad = ''; } else it.user = true; drag = null; draw(); sum(); } });
  q('#mxRot').onclick = () => { const el = getEl(fsel); if (!el) return; pushHist(); el.rot = ((el.rot || 0) + 90) % 360; snapFurn(el); furnChanged(); };
  d.addEventListener('keydown', ev => { if ((ev.key === 'Delete' || ev.key === 'Backspace') && !/INPUT|SELECT/.test(ev.target.tagName)){ if (sel >= 0){ items.splice(sel, 1); sel = -1; draw(); sum(); } else if (fsel && getEl(fsel)){ pushHist(); state.els = state.els.filter(e => e.id !== fsel); fsel = null; furnChanged(); } } });
  d.addEventListener('click', ev => { const t = ev.target.closest('[data-mt]'); if (t){ tool = t.dataset.mt; d.querySelectorAll('[data-mt]').forEach(b => b.classList.toggle('on', b === t)); sum(); return; }
    const fp = ev.target.closest('[data-fp]'); if (fp){ fpal = fp.dataset.fp; tool = 'furn'; d.querySelectorAll('[data-mt]').forEach(b => b.classList.toggle('on', b.dataset.mt === 'furn')); sum(); return; }
    const p = ev.target.closest('[data-pk]'); if (p){ pal = p.dataset.pk; tool = 'add'; d.querySelectorAll('[data-mt]').forEach(b => b.classList.toggle('on', b.dataset.mt === 'add')); sum(); return; }
    const l = ev.target.closest('[data-lv]'); if (l){ lvl = +l.dataset.lv; d.querySelectorAll('[data-lv]').forEach(b => b.classList.toggle('on', b === l)); sel = -1; draw(); } });
  const readO = () => { d.querySelectorAll('[data-sys]').forEach(c => O.sys[c.dataset.sys] = c.checked); O.occ = +q('#mxOcc').value || 0; O.heat = q('#mxHeat').value; O.light = q('#mxLight').value; O.wm2 = +q('#mxW').value || 55; O.fix = q('#mxFix').checked; state.mepOpts = JSON.parse(JSON.stringify(O)); };
  q('#mxRe').onclick = () => { readO(); recalc(); };
  const place = nets => { readO(); const bad = items.filter(i => i.bad); if (bad.length){ toast(`${bad.length} équipement${bad.length > 1 ? 's' : ''} à un emplacement interdit : déplacez-le${bad.length > 1 ? 's' : ''} ou retirez-le${bad.length > 1 ? 's' : ''}`); return; } mepApply(items); closeEDlg(); if (nets) mepGenerateNets(); };
  q('#mxPlace').onclick = () => place(false); q('#mxPlaceNets').onclick = () => place(true);
  draw(); sum();
}
/* pose : remplace les éléments techniques automatiques précédents */
function mepApply(items){
  pushHist(); state.isSample = false;
  const old = new Set(state.els.filter(e => (e.kind === 'inst' && e.auto && MEP_KIND[e.fam]) || (e.kind === 'net' && e.auto)).map(e => e.id)); state.els = state.els.filter(e => !old.has(e.id));
  for (const it of items){ const fo = mepFloorOff(it.lvl), params = {...(it.params || {})}; if (['lum', 'spot', 'daaf', 'vext'].includes(it.kind) && params.hc == null) params.hc = Math.round((mepCeilH(it.lvl) - fo) * 100) / 100;
    state.els.push({kind:'inst', fam:it.fam, type:it.type | 0, params, c:it.c.map(v => Math.round(v * 1000) / 1000), rot:it.rot || 0, lvl:it.lvl, off:fo, mirror:false, auto:!it.user, room:it.room, id:state.nextId++}); }   // placé par l'utilisateur (auto:false) : conservé lors des propositions suivantes
  rebuild(); toast(`${items.length} équipement${items.length > 1 ? 's' : ''} placé${items.length > 1 ? 's' : ''}`);
}
function mepClear(){ pushHist(); state.els = state.els.filter(e => e.kind !== 'net'); rebuild(); toast('Réseaux effacés'); }
