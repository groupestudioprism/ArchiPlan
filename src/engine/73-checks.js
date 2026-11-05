/* ============ Poutres et « Vérifications du bâtiment » ============
   Poutre = forme rectangulaire orientée (kind 'vol', beam:true), posée sous le plancher du niveau. Le contrôle passe en revue le
   bâtiment d'après des règles courantes (France) ; chaque problème est expliqué et peut être corrigé un par un :
   - hauteur sous plafond ≥ 2,20 m (décret n° 2002-120, logement décent ; RSD) ;
   - une pièce principale d'au moins 9 m² (même décret) ;
   - porte : passage libre ≥ 0,83 m, hauteur ≥ 2,04 m (accessibilité, arrêté du 20 avril 2017 ; 0,90 m de vantail) ;
   - garde-corps / allège ≥ 1,00 m au-dessus de 1 m de chute (NF P 01-012, DTU 36.5) ; allège de fenêtre d'étage ;
   - plancher béton : portée libre max. ≈ 5 m sans appui intermédiaire (dalle pleine 20 cm), poutre h ≈ L/12, poteau élancement ≤ 15 ;
   - murs d'étage appuyés sur un mur, un poteau ou une poutre en dessous (descente de charges) ;
   - pente de toiture mini. selon la couverture (tuiles ≥ 30 %, ardoise ≥ 22°…) ; escaliers (NF P 21-211 : 2h + g, échappée 1,90 m).
   Calculs de pré-dimensionnement, indicatifs : ils ne remplacent ni un bureau d'études structure ni le contrôle technique. */
function beamEl(a, b, o = {}){
  const w = o.w || 0.2, h = o.h || 0.3, d = V.norm(V.sub(b, a)), n = [-d[1] * w / 2, d[0] * w / 2];
  const poly = [V.sub(a, n), V.sub(b, n), V.add(b, n), V.add(a, n)].map(p => [rnd(p[0]), rnd(p[1])]), xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const lvl = o.lvl ?? curLvl, nx = state.levels[lvl + 1], top = o.top ?? (nx ? nx.z - state.levels[lvl].z : 2.8);
  return {kind:'vol', beam:true, mat:o.type || o.mat || 'ba', p:[Math.min(...xs), Math.min(...ys)], q:[Math.max(...xs), Math.max(...ys)], poly, h, lvl, off:rnd(top - h), bw:w, a:a.map(rnd), b:b.map(rnd)};
}
const beamLen = e => V.len(V.sub(e.b, e.a));
const beamSec = L => ({h:Math.max(0.25, Math.ceil(L / 12 / 0.05) * 0.05), w:L > 5 ? 0.25 : 0.2});
/* appuis sous un niveau : murs, poteaux et poutres du niveau d'en dessous (segments et points) */
function supportsBelow(lvl){
  const seg = [], pts = [];
  for (const e of state.els){ if (e.lvl !== lvl) continue;
    if (e.kind === 'wall') seg.push([e.a, e.b, wallT(e) / 2 + 0.05]);
    else if (e.kind === 'col') pts.push([e.c, Math.max(e.w, e.d) / 2 + 0.05]);
    else if (e.beam && e.a) seg.push([e.a, e.b, (e.bw || 0.2) / 2 + 0.05]); }
  return {seg, pts};
}
function distSupport(p, S){ let d = Infinity; for (const [a, b, t] of S.seg){ const c = segClosest(p, a, b); d = Math.min(d, Math.max(0, V.len(V.sub(c.pt, p)) - t)); } for (const [c, t] of S.pts) d = Math.min(d, Math.max(0, V.len(V.sub(c, p)) - t)); return d; }
const polyBox = poly => { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
/* plus grande portée libre d'une dalle d'étage : point le plus éloigné de tout appui (murs, poteaux, poutres du niveau dessous) */
function slabSpan(s){
  const poly = volPoly(s), [x0, y0, x1, y1] = polyBox(poly), S = supportsBelow(s.lvl - 1), n = 14; let best = {d:0, p:null};
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++){ const p = [x0 + (x1 - x0) * (i + .5) / (n + 1), y0 + (y1 - y0) * (j + .5) / (n + 1)]; if (!ptInPoly(p[0], p[1], poly)) continue; const d = distSupport(p, S); if (d > best.d) best = {d, p}; }
  return {span:best.d * 2, p:best.p, bb:[x0, y0, x1, y1], poly};
}
function polyChord(poly, p, horizontal){   // extrémités de la droite (horizontale ou verticale) par p dans le polygone
  const hits = []; for (let i = 0; i < poly.length; i++){ const a = poly[i], b = poly[(i + 1) % poly.length];
    if (horizontal){ if ((a[1] > p[1]) !== (b[1] > p[1])) hits.push(a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
    else if ((a[0] > p[0]) !== (b[0] > p[0])) hits.push(a[1] + (p[0] - a[0]) * (b[1] - a[1]) / (b[0] - a[0])); }
  if (hits.length < 2) return null; hits.sort((u, v) => u - v); const u = hits[0], v = hits.at(-1); return horizontal ? [[u, p[1]], [v, p[1]]] : [[p[0], u], [p[0], v]];
}
/* ---------- règles ---------- */
const CHECK_REF = {ceil:'Décret n° 2002-120 (logement décent) : hauteur sous plafond ≥ 2,20 m.', room:'Décret n° 2002-120 : au moins une pièce principale de 9 m² minimum.',
  door:'Arrêté du 20 avril 2017 (accessibilité) : porte ≥ 0,90 m (passage libre ≥ 0,83 m), hauteur ≥ 2,04 m.', sill:'NF P 01-012 / DTU 36.5 : protection de 1,00 m au-dessus d\'une chute de 1 m ; allège de fenêtre d\'étage ≥ 0,90 m.',
  span:'Règle de pré-dimensionnement : dalle béton pleine, portée libre ≈ 5 m max. sans appui ; poutre h ≈ L/12 (BAEL / Eurocode 2).', col:'Poteau béton : élancement h / côté ≤ 15 (pré-dimensionnement) ; côté ≥ 0,20 m.',
  load:'Descente de charges : un mur d\'étage s\'appuie sur un mur, un poteau ou une poutre en dessous.', roof:'DTU 40.21/40.11 : pente mini. tuiles 30 % (≈ 17°), ardoises 22° (≈ 40 %).',
  stair:'NF P 21-211 : 2h + g = 60 à 65 cm, giron ≥ 24 cm, hauteur ≤ 19 cm, échappée 1,90 m.', slab:'Un niveau habité a un plancher : sans dalle, les murs d\'étage ne reposent sur rien.'};
function runChecks(){
  const out = [], E = state.els, add = (id, lvl, title, detail, ref, fix, els = []) => out.push({id, lvl, title, detail, ref, fix, els, key:id + '|' + els.join(',')});
  const lv = i => state.levels[i]?.n || `Niveau ${i}`;
  // 1. hauteur sous plafond
  for (const w of E) if (w.kind === 'wall' && w.h < 2.2 - 1e-6 && !w.partition) add('ceil', 'bad', `Mur ${w.id} (${lv(w.lvl)}) : hauteur ${lenTxt(w.h)}`, 'Hauteur sous plafond inférieure à 2,20 m (pièce habitable).', CHECK_REF.ceil, {t:'Porter la hauteur à 2,50 m', run:() => { w.h = 2.5; delete w.top; }}, [w.id]);
  // 2. pièce principale 9 m²
  const rooms = []; for (let i = 0; i < state.levels.length; i++) try { for (const r of detectRooms(i)) rooms.push({...r, lvl:i}); } catch(e){}
  if (rooms.length && !rooms.some(r => r.area >= 9)) add('room', 'warn', 'Aucune pièce de 9 m² ou plus', `La plus grande pièce mesure ${nf(Math.max(...rooms.map(r => r.area)), 1)} m².`, CHECK_REF.room, null);
  // 3. portes et allèges
  for (const e of E) if (e.kind === 'inst' && e.host){ const F = fam(e.fam), c = famCut(e); if (!F || !c) continue;
    const isDoor = /^Portes$/.test(F.cat || '') || /porte(?!-fen)/.test(e.fam || '');
    if (isDoor && /entree|simple|double|porte/.test(e.fam || '') && !/garage|fenetre/.test(e.fam || '')){
      if (c.w < 0.83 - 1e-6 || c.h < 2.04 - 1e-6) add('door', 'warn', `${F.nom} ${e.id} : ${n0(c.w * 100)} × ${n0(c.h * 100)} cm`, 'Passage trop étroit ou trop bas pour l\'accessibilité (≥ 0,83 m libre, ≥ 2,04 m).', CHECK_REF.door, {t:'Passer à 90 × 210 cm', run:() => { e.params = {...(e.params || {}), w:Math.max(0.9, c.w), h:Math.max(2.1, c.h)}; }}, [e.id]); }
    else if (!isDoor && e.lvl > 0 && c.sill < 0.9 - 1e-6 && c.sill + c.h > 1 && !/porte-fen|baie/.test(e.fam || '')) add('sill', 'warn', `${F.nom} ${e.id} (${lv(e.lvl)}) : allège ${n0(c.sill * 100)} cm`, 'Fenêtre d\'étage à allège basse : garde-corps de 1 m nécessaire, ou allège ≥ 0,90 m.', CHECK_REF.sill, {t:'Allège à 0,90 m', run:() => { e.params = {...(e.params || {}), sill:0.9}; }}, [e.id]);
  }
  // 4. niveaux sans plancher
  for (let i = 1; i < state.levels.length; i++){ const walls = E.filter(w => w.kind === 'wall' && w.lvl === i); if (walls.length && !E.some(s => s.kind === 'slab' && s.lvl === i && (s.off || 0) <= 1.2 && elUse(s) !== 'toiture'))
    add('slab', 'bad', `${lv(i)} : murs sans plancher`, `${walls.length} mur(s) à ce niveau, aucune dalle de plancher.`, CHECK_REF.slab, {t:'Créer une dalle béton sur l\'emprise des murs', run:() => { const [x0, y0, x1, y1] = polyBox(walls.flatMap(w => [w.a, w.b])); const d = state.lib?.compos && Object.keys(libCompos()).includes('DAL-BA-20') ? 'DAL-BA-20' : defs.slab.type; const t = slabT({type:d}); state.els.push({kind:'slab', type:d, p:[x0, y0], q:[x1, y1], lvl:i, off:-t, id:state.nextId++}); }}, walls.map(w => w.id)); }
  // 5. dalles : portée libre
  for (const s of E) if (s.kind === 'slab' && s.lvl > 0 && elUse(s) !== 'toiture' && (s.off || 0) <= 1.2){
    const R = slabSpan(s); if (R.span > 5.2 && R.p){
      const c1 = polyChord(R.poly, R.p, true), c2 = polyChord(R.poly, R.p, false), len = c => c ? V.len(V.sub(c[1], c[0])) : Infinity;
      const ch = len(c1) <= len(c2) ? c1 : c2; if (!ch) continue; /* poutre dans le sens le plus court, portée par les murs d'about */ const L = V.len(V.sub(ch[1], ch[0])), sec = beamSec(L > 6 ? L / 2 : L);
      add('span', 'bad', `${lv(s.lvl)} · dalle ${s.id} : portée libre ≈ ${nf(R.span, 1)} m`, 'Portée supérieure à ≈ 5 m sans appui intermédiaire : ajouter une poutre (et un poteau si elle dépasse 6 m).', CHECK_REF.span,
        {t:`Ajouter une poutre ${n0(sec.w * 100)} × ${n0(sec.h * 100)} cm${L > 6 ? ' et un poteau' : ''}`, run:() => {
          const lvl = s.lvl - 1, zb = lvlZ(s.lvl) + (s.off || 0) - lvlZ(lvl), b = beamEl(ch[0], ch[1], {lvl, top:zb, h:sec.h, w:sec.w}); b.id = state.nextId++; state.els.push(b);
          if (L > 6){ const m = V.mul(V.add(ch[0], ch[1]), .5), cs = Math.max(0.25, Math.ceil((zb - sec.h) / 15 / 0.05) * 0.05); state.els.push({kind:'col', mat:'ba', c:m.map(rnd), w:cs, d:cs, h:rnd(zb - sec.h), lvl, off:0, id:state.nextId++}); } }}, [s.id]); } }
  // 6. poutres : portée et appuis
  for (const b of E) if (b.beam && b.a){ const L = beamLen(b), S = supportsBelow(b.lvl - 1), Sw = supportsBelow(b.lvl), ends = [b.a, b.b].filter(p => distSupport(p, Sw) > 0.15 && !(b.lvl > 0 && distSupport(p, S) <= 0.15 && false));
    const ts = [0, L, ...E.filter(c => c.kind === 'col' && c.lvl === b.lvl).map(c => { const q = segClosest(c.c, b.a, b.b); return V.len(V.sub(q.pt, c.c)) < 0.4 ? q.t * L : null; }).filter(v => v != null)].sort((u, v) => u - v);
    const gap = Math.max(...ts.slice(1).map((v, i) => v - ts[i]));
    if (gap > 6.5) add('span', 'warn', `Poutre ${b.id} : portée ${nf(gap, 1)} m`, 'Portée de poutre importante (> 6,5 m) : ajouter un appui intermédiaire.', CHECK_REF.span, {t:'Ajouter un poteau à mi-portée', run:() => { const m = V.mul(V.add(b.a, b.b), .5), z0 = lvlZ(b.lvl) + (b.off || 0); state.els.push({kind:'col', mat:'ba', c:m.map(rnd), w:0.25, d:0.25, h:rnd(z0 - lvlZ(b.lvl)), lvl:b.lvl, off:0, id:state.nextId++}); }}, [b.id]);
    if (b.h < gap / 14 - 1e-6) add('span', 'warn', `Poutre ${b.id} : hauteur ${n0(b.h * 100)} cm pour ${nf(gap, 1)} m`, 'Hauteur insuffisante (règle h ≈ L/12 pour une poutre béton).', CHECK_REF.span, {t:`Porter à ${n0(beamSec(gap).h * 100)} cm`, run:() => { const sec = beamSec(gap), top = (b.off || 0) + b.h; b.h = sec.h; b.off = rnd(top - sec.h); }}, [b.id]);
    for (const p of ends) if (!E.some(w => w.kind === 'wall' && w.lvl === b.lvl && V.len(V.sub(segClosest(p, w.a, w.b).pt, p)) < wallT(w) / 2 + 0.1) && !E.some(c => c.kind === 'col' && c.lvl === b.lvl && V.len(V.sub(c.c, p)) < Math.max(c.w, c.d) / 2 + 0.1))
      add('load', 'warn', `Poutre ${b.id} : appui manquant`, 'Une extrémité ne repose ni sur un mur ni sur un poteau.', CHECK_REF.load, {t:'Ajouter un poteau sous cet appui', run:() => { const z0 = lvlZ(b.lvl) + (b.off || 0); state.els.push({kind:'col', mat:'ba', c:p.map(rnd), w:0.25, d:0.25, h:rnd(z0 - lvlZ(b.lvl)), lvl:b.lvl, off:0, id:state.nextId++}); }}, [b.id]); }
  // 7. poteaux : section et élancement
  for (const c of E) if (c.kind === 'col' && /^(ba|beton)/.test(c.mat || '')){ const m = Math.min(c.w, c.d), need = Math.max(0.2, Math.ceil(c.h / 15 / 0.05) * 0.05);
    if (m < need - 1e-6) add('col', m < 0.2 - 1e-6 ? 'bad' : 'warn', `Poteau ${c.id} : ${n0(c.w * 100)} × ${n0(c.d * 100)} cm pour ${nf(c.h, 2)} m`, 'Section trop faible pour la hauteur (élancement > 15) ou côté < 20 cm.', CHECK_REF.col, {t:`Porter la section à ${n0(need * 100)} × ${n0(need * 100)} cm`, run:() => { c.w = Math.max(c.w, need); c.d = Math.max(c.d, need); }}, [c.id]); }
  // 8. murs d'étage sans appui
  for (let i = 1; i < state.levels.length; i++){ const S = supportsBelow(i - 1), hasFloor = E.some(s => s.kind === 'slab' && s.lvl === i && (s.off || 0) <= 1.2);
    if (!hasFloor || !S.seg.length && !S.pts.length) continue;
    for (const w of E) if (w.kind === 'wall' && w.lvl === i){ const L = V.len(V.sub(w.b, w.a)), pts = [0.1, 0.5, 0.9].map(t => V.add(w.a, V.mul(V.sub(w.b, w.a), t))), un = pts.filter(p => distSupport(p, S) > wallT(w) / 2 + 0.1).length;
      if (un >= 2 && L > 1.5 && !w.partition){ const sec = beamSec(L); add('load', 'warn', `${lv(i)} · mur ${w.id} en porte-à-faux (${nf(L, 1)} m)`, 'Ce mur d\'étage n\'a ni mur, ni poteau, ni poutre en dessous : il est porté par le plancher seul.', CHECK_REF.load,
        {t:`Ajouter une poutre de reprise ${n0(sec.w * 100)} × ${n0(sec.h * 100)} cm sous le mur`, run:() => { const lvl = i - 1, zb = lvlZ(i) + (E.find(s => s.kind === 'slab' && s.lvl === i && (s.off || 0) <= 1.2)?.off || 0) - lvlZ(lvl), b = beamEl(w.a, w.b, {lvl, top:zb, h:sec.h, w:Math.max(sec.w, wallT(w))}); b.id = state.nextId++; state.els.push(b); }}, [w.id]); } } }
  // 9. toitures
  for (const r of E) if (r.kind === 'roof' && (r.shape || '2') !== '0'){ const C = compo(r.type), tile = /tuile|ardoise|zinc|bac/i, name = C?.nom || ''; const min = /ardoise/i.test(name) ? 22 : /tuile/i.test(name) ? 17 : /bac|zinc|membrane|v[ée]g[ée]/i.test(name) ? 3 : 5;
    if ((r.pitch ?? 35) < min - 1e-6 && tile) add('roof', 'warn', `Toiture ${r.id} : pente ${n0(r.pitch)}° pour « ${name} »`, `Pente inférieure au minimum usuel (${min}°) pour cette couverture.`, CHECK_REF.roof, {t:`Passer à ${min + 3}°`, run:() => { r.pitch = min + 3; }}, [r.id]); }
  // 10. escaliers
  for (const s of E) if (s.kind === 'stair'){ const bad = stairCheck(s).checks.filter(c => c.lvl === 'bad'); if (bad.length) add('stair', 'bad', `Escalier ${s.id} : ${bad.length} point${bad.length > 1 ? 's' : ''} bloquant${bad.length > 1 ? 's' : ''}`, bad.map(c => c.t).join(' '), CHECK_REF.stair, {t:'Hauteur, giron et emmarchement automatiques', run:() => { delete s.n; delete s.hs; delete s.g; s.w = Math.max(s.w || 0.9, s.use === 'erp' ? 1.2 : 0.9); }}, [s.id]); }
  return out;
}
const CHK = {ignored:new Set(), list:[]};
function openChecks(){
  CHK.list = runChecks().filter(c => !CHK.ignored.has(c.key));
  const bad = CHK.list.filter(c => c.lvl === 'bad').length, warn = CHK.list.length - bad;
  const row = (c, i) => `<article class="chk ${c.lvl}" style="animation-delay:${Math.min(i, 8) * 30}ms"><i class="chk-ic" aria-hidden="true">${c.lvl === 'bad' ? '!' : '?'}</i><div class="chk-b"><h4>${c.cat && typeof CHK_CATS !== 'undefined' ? `<span class="chk-cat">${esc(CHK_CATS[c.cat] || c.cat)}</span>` : ''}${esc(c.title)}</h4><p>${esc(c.detail)}</p><small>${esc(c.ref)}</small>
    <div class="chk-a">${c.els[0] ? `<button class="btn" data-chk-sel="${i}">Voir</button>` : ''}${c.fix ? `<button class="btn primary" data-chk-fix="${i}">${esc(c.fix.t)}</button>` : '<span class="mut">À corriger manuellement</span>'}<button class="btn ghost" data-chk-ign="${i}">Ignorer</button></div></div></article>`;
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Projet</span><h3 class="ed-t2">Vérifications du bâtiment</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body chk-body">${CHK.list.length ? `<p class="hint"><b>${bad}</b> problème${bad > 1 ? 's' : ''} bloquant${bad > 1 ? 's' : ''}, <b>${warn}</b> point${warn > 1 ? 's' : ''} d'attention. Chaque correction est appliquée une par une (Ctrl+Z pour annuler).</p>${CHK.list.map(row).join('')}`
      : '<div class="chk-ok"><i>✓</i><h4>Aucun problème détecté</h4><p>Structure, thermique RE2020, incendie, acoustique, accessibilité, ventilation, électricité et eau respectent les règles courantes contrôlées.</p></div>'}
      <p class="hint">Contrôle indicatif de pré-dimensionnement (règles françaises courantes) : il ne remplace pas une étude de structure ni le contrôle technique.</p></div>
    <footer class="ed-f"><button class="btn" id="chkAddBeam">Ajouter une poutre…</button><button class="btn primary" data-close>Fermer</button></footer>`, 'mid');
  d.querySelectorAll('[data-chk-fix]').forEach(b => b.onclick = () => { const c = CHK.list[+b.dataset.chkFix]; pushHist(); state.isSample = false; try { c.fix.run(); } catch(e){ console.warn(e); } rebuild(); toast('Corrigé : ' + c.fix.t); if (c.fix.open) closeEDlg(); else openChecks(); });
  d.querySelectorAll('[data-chk-ign]').forEach(b => b.onclick = () => { CHK.ignored.add(CHK.list[+b.dataset.chkIgn].key); openChecks(); });
  d.querySelectorAll('[data-chk-sel]').forEach(b => b.onclick = () => { const c = CHK.list[+b.dataset.chkSel]; closeEDlg(); const el = getEl(c.els[0]); if (el){ if (el.lvl !== curLvl){ curLvl = el.lvl; syncLevels(); rebuild(); } select(c.els[0]); frameEl(c.els[0]); } });
  d.querySelector('#chkAddBeam').onclick = () => { closeEDlg(); setTool('beam'); toast('Poutre : cliquez les deux appuis'); };
}
const checksCard = () => { let n = 0; try { n = runChecks().filter(c => !CHK.ignored.has(c.key)).length; } catch(e){} return `<div class="grp"><h3>Vérifications du bâtiment</h3><p class="hint">Hauteurs, portes, descente de charges, poutres et poteaux, escaliers, toitures : règles courantes.</p><div class="btns tight"><button class="btn${n ? ' primary' : ''}" data-act="checks">${n ? `Vérifier le bâtiment · ${n} point${n > 1 ? 's' : ''}` : 'Vérifier le bâtiment'}</button><button class="btn" data-act="addbeam">Poutre</button></div></div>`; };
