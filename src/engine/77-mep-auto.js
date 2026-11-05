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

/* ---------- proposition ---------- */
const MEP_DEF = {sys:{elec:true, plomb:true, vent:true, chauf:true}, occ:0, heat:'eau', light:'mixte', wm2:55, fix:true};
function mepPropose(O){
  const rooms = mepRooms().filter(r => r.kind !== 'ext'), items = [], byLvl = {};
  const nCh = rooms.filter(r => r.kind === 'chambre').length, occ = O.occ > 0 ? O.occ : Math.max(1, nCh + 1);
  const exist = fid => new Set(state.els.filter(e => e.kind === 'inst' && e.fam === fid && !e.auto).map(e => e.id));
  const ctx = rooms.map(r => ({r, E:roomEdges(r)}));
  const add = (r, fam_, o = {}) => items.push({fam:fam_, type:o.type | 0, params:o.params || {}, lvl:r.lvl, c:o.c, rot:o.rot || 0, room:r.key, kind:MEP_KIND[fam_], auto:true});
  const onWall = (R, fam_, e, t, o = {}) => { const ym = famYmax(fam_); add(R.r, fam_, {...o, c:V.add(edgePt(e, t), V.mul(e.nIn, ym)), rot:wallRot(e)}); };
  const wallItems = (R, fam_, n, o = {}) => { const S = spread(wallSlots(R.E, o.step || 0.7), n); S.forEach(s => { onWall(R, fam_, s.e, s.t, o); s.e.blocked.push([s.t - 0.2, s.t + 0.2]); }); };
  const fixture = (R, fam_, o = {}) => { if (!fam(fam_)) return null; const w = (famWidth(fam_) || 0.6) + 0.1, best = R.E.flatMap(e => freeIntervals(e, w).map(([l, h]) => ({e, l, h}))).sort((a, b) => (b.h - b.l) - (a.h - a.l))[0]; if (!best) return null;
    const t = o.end ? (o.end > 0 ? best.h - w / 2 : best.l + w / 2) : (best.l + best.h) / 2; onWall(R, fam_, best.e, t, o); best.e.blocked.push([t - w / 2, t + w / 2]); return {e:best.e, t}; };
  const roomsOf = k => ctx.filter(R => R.r.kind === k);
  const pick = (...ks) => { for (const k of ks){ const R = ctx.find(R => R.r.kind === k && R.r.lvl === 0) || ctx.find(R => R.r.kind === k); if (R) return R; } return ctx[0]; };
  // appareils sanitaires et cuisine (on ne double pas un appareil déjà dessiné dans la pièce)
  const has = (R, fid) => state.els.some(e => e.kind === 'inst' && e.fam === fid && !e.auto && ptInPoly(e.c?.[0], e.c?.[1], R.r.poly));
  if (O.fix) for (const R of ctx){ const k = R.r.kind;
    if (k === 'wc' && !has(R, 'wc')) fixture(R, 'wc'); if (k === 'sdb'){ if (!has(R, 'lavabo')) fixture(R, 'lavabo', {type:1}); if (!has(R, 'douche')) fixture(R, 'douche'); }
    if (k === 'cuisine' && !has(R, 'cuisine')) fixture(R, 'cuisine'); }
  for (const R of ctx){
    const k = R.r.kind, A = R.r.net, id = R.r.key;
    if (O.sys.elec){
      // prises (NF C 15-100)
      let np = 0, hot = 0;
      if (k === 'sejour') np = A > 28 ? Math.max(7, Math.ceil(A / 4)) : Math.max(5, Math.ceil(A / 4)); else if (k === 'chambre') np = 3;
      else if (k === 'cuisine'){ np = A <= 4 ? 3 : 6; hot = np > 3 ? 4 : 2; } else if (k === 'sdb') np = 1; else if (k === 'wc') np = 0; else if (k === 'garage') np = 2; else np = A > 4 ? 1 : 0;
      wallItems(R, 'e-prise', np - hot, {params:{zh:0.3}}); if (hot) wallItems(R, 'e-prise', hot, {params:{zh:1.05}, step:0.5});
      if (k === 'cuisine'){ wallItems(R, 'e-prise32', 1, {step:0.5}); wallItems(R, 'e-prise-spec', 2, {step:0.5}); wallItems(R, 'e-prise', 1, {params:{zh:1.8}, step:0.5}); }
      if ((k === 'buanderie') || (k === 'sdb' && !ctx.some(q => q.r.kind === 'buanderie' && q.r.lvl === R.r.lvl) && !ctx.some(q => q.r.kind === 'cuisine' && q.r.lvl === R.r.lvl && q.r.net > 8))) wallItems(R, 'e-prise-spec', k === 'buanderie' ? 2 : 1, {params:{zh:0.3}, step:0.5});
      if (k === 'sejour' || k === 'chambre' || (k === 'autre' && /bureau/.test(mepNorm(R.r.name)))) wallItems(R, 'e-rj45', 1, {step:0.5});
      // éclairage
      let nl = 1, fL = 'e-lum';
      const spots = O.light === 'spots' || (O.light === 'mixte' && ['cuisine', 'sdb', 'couloir', 'entree'].includes(k));
      if (spots){ fL = 'e-spot'; nl = k === 'couloir' || k === 'entree' ? Math.max(1, Math.ceil(A / 2.5)) : Math.max(2, Math.ceil(A / 2.8)); }
      else if (k === 'couloir') nl = Math.max(1, Math.round(A / 5));
      for (const c of ceilPoints(R.r.poly, nl)) add(R.r, fL, {c});
      // interrupteurs : près de chaque porte (va-et-vient si 2 portes)
      const doors = R.E.flatMap(e => e.doors.map(d => ({e, d})));
      if (doors.length){ doors.slice(0, 2).forEach(({e, d}, i) => { const lo = d.t - d.w / 2 - 0.2, hi = d.t + d.w / 2 + 0.2, t = hi + 0.1 < e.L - 0.25 ? hi : Math.max(0.3, lo); onWall(R, 'e-inter', e, t, {type:doors.length > 1 ? 1 : 0, params:{zh:1.1}}); e.blocked.push([t - 0.1, t + 0.1]); }); }
      else wallItems(R, 'e-inter', 1, {params:{zh:1.1}});
    }
    if (O.sys.vent){
      if (['cuisine', 'sdb', 'wc', 'buanderie'].includes(k)) add(R.r, 'v-extraction', {c:poleOf(R.r.poly), type:k === 'cuisine' ? 1 : 0, params:{q:k === 'cuisine' ? (nCh <= 0 ? 75 : [75, 90, 105, 120, 135][Math.min(4, nCh)]) : 15}});
      if (k === 'sejour' || k === 'chambre'){ const e = R.E.find(e => e.wins.length) || R.E.sort((a, b) => b.L - a.L)[0], t = e.wins[0]?.t ?? e.L / 2; onWall(R, 'v-entree', e, t, {params:{zh:2.25}}); }
    }
    if (O.heat !== 'none' && O.sys.chauf){
      const q = ['sejour', 'chambre', 'cuisine', 'autre', 'sdb', 'buanderie'].includes(k);
      if (q){ let W = Math.max(500, A * O.wm2 * (k === 'cuisine' ? 0.6 : k === 'sdb' ? 1.4 : 1)); const elec = O.heat === 'elec';
        if (k === 'sdb') wallItems(R, 'c-seche', 1, {step:0.5});
        else { const sizes = elec ? [1000, 1500] : [500, 1000, 1500, 2000], mx = sizes.at(-1), n = Math.ceil(W / mx), each = W / n, sz = sizes.find(s => s >= each - 1) || mx, ty = elec ? (sz >= 1500 ? 5 : 4) : sizes.indexOf(sz);
          const e = R.E.find(e => e.wins.some(w => w.sill < 0.9)) || R.E.slice().sort((a, b) => b.L - a.L)[0], wt = e.wins.find(w => w.sill < 0.9);
          for (let j = 0; j < n; j++){ const t = wt ? wt.t + (j - (n - 1) / 2) * 1.0 : e.L * (j + 1) / (n + 1); onWall(R, 'c-rad', e, clamp(t, 0.4, e.L - 0.4), {type:ty, params:{W:sz, L:elec ? (sz >= 1500 ? 1.0 : 0.8) : [0.5, 0.8, 1.1, 1.5][ty], zh:0}}); e.blocked.push([t - 0.5, t + 0.5]); } }
      }
    }
  }
  // éléments uniques : tableau, détecteurs de fumée, VMC, générateur, ballon, arrivée d'eau
  if (O.sys.elec){
    const T = pick('entree', 'couloir', 'garage', 'buanderie'); wallItems(T, 'e-tableau', 1, {step:0.4, params:{rg:3}});
    for (const li of [...new Set(rooms.map(r => r.lvl))]){ const L = ctx.filter(R => R.r.lvl === li), R = L.find(R => R.r.kind === 'couloir') || L.find(R => R.r.kind === 'entree') || L.find(R => R.r.kind === 'sejour') || L[0];
      if (R && (li === 0 || L.some(q => q.r.kind === 'chambre'))) add(R.r, 'e-daaf', {c:poleOf(R.r.poly)}); }
  }
  if (O.sys.vent){ const top = Math.max(...rooms.map(r => r.lvl)), L = ctx.filter(R => R.r.lvl === top), R = L.find(R => ['couloir', 'buanderie', 'wc', 'entree'].includes(R.r.kind)) || L[0]; if (R) add(R.r, 'v-caisson', {c:poleOf(R.r.poly), params:{zh:2.1}}); }
  if (O.sys.plomb || O.sys.chauf){
    const S = pick('buanderie', 'technique', 'garage', 'cuisine', 'sdb'), V0 = occ <= 2 ? 0 : occ <= 3 ? 1 : occ <= 4 ? 2 : occ <= 5 ? 3 : 4;
    if (O.sys.plomb){ wallItems(S, 'p-ballon', 1, {step:0.8, type:Math.min(4, [0, 1, 2, 3, 4][V0]), params:{}}); wallItems(S, 'p-arrivee', 1, {step:0.5}); }
    const need = items.filter(i => i.kind === 'rad').reduce((t, i) => t + (i.params.W || 1000), 0) + items.filter(i => i.kind === 'seche').length * 750;
    if (O.sys.chauf && O.heat === 'eau'){ const kW = need / 1000, ty = kW <= 9 ? 0 : kW <= 14 ? 1 : 2; wallItems(S, 'c-pac', 1, {step:0.8, type:ty}); }
  }
  items.occ = occ; return items;
}

/* ---------- fenêtre « Proposition automatique » ---------- */
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
      <div class="grp"><h3>Modifier l'aperçu</h3><div class="seg" id="mxTool">${[['move', 'Déplacer'], ['add', 'Ajouter'], ['del', 'Retirer']].map(([k, n]) => `<button class="${k === tool ? 'on' : ''}" data-mt="${k}">${n}</button>`).join('')}</div>
        <p class="hint" id="mxHint"></p><div class="mepx-pal" id="mxPal"></div></div>
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
    items.forEach((it, i) => { if (it.lvl !== lvl) return; const [ch, col] = MEP_SYM[it.kind] || ['?', '#666'], s = W2S(it.c), r = ch.length > 1 ? 11 : 8;
      g.beginPath(); g.arc(s[0], s[1], r, 0, 7); g.fillStyle = col; g.globalAlpha = i === sel ? 1 : 0.88; g.fill(); g.globalAlpha = 1; if (i === sel){ g.lineWidth = 3; g.strokeStyle = '#111'; g.stroke(); }
      g.fillStyle = '#fff'; g.font = `700 ${ch.length > 2 ? 8 : ch.length > 1 ? 9 : 10}px Inter, sans-serif`; g.textAlign = 'center'; g.fillText(ch, s[0], s[1] + 3.5); });
  };
  const kinds = [...new Set(Object.values(MEP_KIND))].filter(k => !['arrivee'].includes(k) || true);
  const sum = () => { const c = {}; items.forEach(i => c[i.kind] = (c[i.kind] || 0) + 1); q('#mxSum').textContent = `${items.length} éléments · ${items.filter(i => i.kind === 'prise' || i.kind === 'spec' || i.kind === 'plaque').length} prises · ${items.filter(i => i.kind === 'lum' || i.kind === 'spot').length} points lumineux`;
    q('#mxPal').innerHTML = kinds.filter(k => MEP_LABEL[k]).map(k => { const [ch, col] = MEP_SYM[k]; return `<button class="${k === pal ? 'on' : ''}" data-pk="${k}" title="${MEP_LABEL[k]}"><i style="background:${col}">${ch}</i><span>${MEP_LABEL[k]}</span><em>${c[k] || 0}</em></button>`; }).join('');
    q('#mxHint').textContent = tool === 'move' ? 'Glissez un symbole pour le déplacer (il se colle au mur le plus proche).' : tool === 'add' ? `Cliquez dans une pièce pour ajouter : ${MEP_LABEL[pal]}.` : 'Cliquez un symbole pour le retirer.'; };
  const hit = (sx, sy) => { let b = -1, bd = 14; items.forEach((it, i) => { if (it.lvl !== lvl) return; const s = W2S(it.c), dd = Math.hypot(s[0] - sx, s[1] - sy); if (dd < bd){ bd = dd; b = i; } }); return b; };
  const snapTo = (it, p) => {   // objets muraux : collés au mur de la pièce la plus proche ; plafond : dans la pièce
    const R = RL().find(r => ptInPoly(p[0], p[1], r.poly)) || RL().slice().sort((a, b) => dPoly(p, a.poly) - dPoly(p, b.poly))[0]; if (!R) return;
    it.room = R.key;
    if (MEP_WALLKINDS.has(it.kind)){ const E = roomEdges(R); let best = null, bd = 1e9; for (const e of E){ const c = segClosest(p, e.a, e.b), dd = V.len(V.sub(c.pt, p)); if (dd < bd){ bd = dd; best = {e, t:clamp(c.t * e.L, 0.2, e.L - 0.2)}; } }
      const ym = famYmax(it.fam); it.c = V.add(edgePt(best.e, best.t), V.mul(best.e.nIn, ym)); it.rot = wallRot(best.e); }
    else it.c = ptInPoly(p[0], p[1], R.poly) ? p : poleOf(R.poly); };
  cv.addEventListener('pointerdown', ev => { const r = cv.getBoundingClientRect(), sx = (ev.clientX - r.left) * cv.width / r.width, sy = (ev.clientY - r.top) * cv.height / r.height, h = hit(sx, sy);
    if (tool === 'del'){ if (h >= 0){ items.splice(h, 1); sel = -1; draw(); sum(); } return; }
    if (tool === 'add'){ const fid = MEP_FAM_OF[pal], it = {fam:fid, type:0, params:{}, lvl, c:S2W(sx, sy), rot:0, kind:pal, auto:true}; snapTo(it, it.c); if (!it.room) return; items.push(it); sel = items.length - 1; draw(); sum(); return; }
    sel = h; if (h >= 0){ drag = h; cv.setPointerCapture(ev.pointerId); } draw(); });
  cv.addEventListener('pointermove', ev => { if (drag == null) return; const r = cv.getBoundingClientRect(); snapTo(items[drag], S2W((ev.clientX - r.left) * cv.width / r.width, (ev.clientY - r.top) * cv.height / r.height)); draw(); });
  cv.addEventListener('pointerup', () => { drag = null; });
  d.addEventListener('keydown', ev => { if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel >= 0 && !/INPUT|SELECT/.test(ev.target.tagName)){ items.splice(sel, 1); sel = -1; draw(); sum(); } });
  d.addEventListener('click', ev => { const t = ev.target.closest('[data-mt]'); if (t){ tool = t.dataset.mt; d.querySelectorAll('[data-mt]').forEach(b => b.classList.toggle('on', b === t)); sum(); return; }
    const p = ev.target.closest('[data-pk]'); if (p){ pal = p.dataset.pk; tool = 'add'; d.querySelectorAll('[data-mt]').forEach(b => b.classList.toggle('on', b.dataset.mt === 'add')); sum(); return; }
    const l = ev.target.closest('[data-lv]'); if (l){ lvl = +l.dataset.lv; d.querySelectorAll('[data-lv]').forEach(b => b.classList.toggle('on', b === l)); sel = -1; draw(); } });
  const readO = () => { d.querySelectorAll('[data-sys]').forEach(c => O.sys[c.dataset.sys] = c.checked); O.occ = +q('#mxOcc').value || 0; O.heat = q('#mxHeat').value; O.light = q('#mxLight').value; O.wm2 = +q('#mxW').value || 55; O.fix = q('#mxFix').checked; state.mepOpts = JSON.parse(JSON.stringify(O)); };
  q('#mxRe').onclick = () => { readO(); items = mepPropose(O); sel = -1; draw(); sum(); };
  const place = nets => { readO(); mepApply(items); closeEDlg(); if (nets) mepGenerateNets(); };
  q('#mxPlace').onclick = () => place(false); q('#mxPlaceNets').onclick = () => place(true);
  draw(); sum();
}
/* pose : remplace les éléments techniques automatiques précédents */
function mepApply(items){
  pushHist(); state.isSample = false;
  const old = new Set(state.els.filter(e => (e.kind === 'inst' && e.auto && MEP_KIND[e.fam]) || (e.kind === 'net' && e.auto)).map(e => e.id)); state.els = state.els.filter(e => !old.has(e.id));
  for (const it of items) state.els.push({kind:'inst', fam:it.fam, type:it.type | 0, params:{...(it.params || {})}, c:it.c.map(v => Math.round(v * 1000) / 1000), rot:it.rot || 0, lvl:it.lvl, off:0, mirror:false, auto:true, room:it.room, id:state.nextId++});
  rebuild(); toast(`${items.length} équipement${items.length > 1 ? 's' : ''} placé${items.length > 1 ? 's' : ''}`);
}
function mepClear(){ pushHist(); state.els = state.els.filter(e => e.kind !== 'net'); rebuild(); toast('Réseaux effacés'); }
