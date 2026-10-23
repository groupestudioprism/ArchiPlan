/* ============ Surface vitrée : baies (mesurées en tableau) rapportées à la surface habitable ============
   Repère réglementaire : la RT 2012 (art. 20) impose une surface totale de baies ≥ 1/6 de la surface habitable pour les logements ;
   ce ratio reste le repère usuel d'éclairement naturel en maison individuelle. La surface habitable est estimée d'après les
   planchers (moins l'emprise des murs) ou saisie dans le projet (state.shab). */
const GLAZ_MIN = 1 / 6;
const glazedDoor = (F, el) => /vitr|fen[eê]tre|baie/i.test(`${el.fam} ${F?.nom || ''} ${F?.types?.[el.type | 0]?.nom || ''}`);
function shabEstimate(){
  const rooms = state.levels.flatMap((_, li) => detectRooms(li)); if (rooms.length) return rooms.reduce((s, r) => s + r.net, 0);
  let A = 0;
  state.levels.forEach((_, li) => {
    const slabs = state.els.filter(e => e.kind === 'slab' && e.lvl === li && elUse(e) !== 'toiture');
    const walls = state.els.filter(e => e.kind === 'wall' && e.lvl === li);
    let floor = slabs.reduce((s, e) => s + Math.abs(area(volPoly(e))), 0);
    if (!floor && walls.length){ // pas de plancher dessiné : rectangle englobant des murs
      const xs = walls.flatMap(w => [w.a[0], w.b[0]]), ys = walls.flatMap(w => [w.a[1], w.b[1]]);
      floor = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    }
    const wallFoot = walls.reduce((s, w) => s + wallAxis(w).L * wallT(w), 0);
    if (walls.length) A += Math.max(0, floor - wallFoot);
  });
  return A;
}
function glazingReport(){
  const walls = state.els.filter(e => e.kind === 'wall');
  const xs = walls.flatMap(w => [w.a[0], w.b[0]]), ys = walls.flatMap(w => [w.a[1], w.b[1]]);
  const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0, cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
  const by = {N:0, E:0, S:0, O:0}, items = []; let total = 0;
  for (const el of state.els){
    if (el.kind !== 'inst' || !el.host) continue;
    const F = fam(el.fam), c = famCut(el); if (!F || !c) continue;
    if (!(F.cat === 'Fenêtres' || (F.cat === 'Portes' && glazedDoor(F, el)))) continue;
    const w = getEl(el.host); if (!w) continue;
    const a = c.w * c.h, {n} = wallAxis(w), m = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
    const out = (m[0] + n[0] - cx) ** 2 + (m[1] + n[1] - cy) ** 2 > (m[0] - n[0] - cx) ** 2 + (m[1] - n[1] - cy) ** 2 ? n : [-n[0], -n[1]];
    const ang = (Math.atan2(out[0], out[1]) * 180 / Math.PI + 360) % 360, o = ang < 45 || ang >= 315 ? 'N' : ang < 135 ? 'E' : ang < 225 ? 'S' : 'O';
    by[o] += a; total += a; items.push({el, a, o});
  }
  const auto = shabEstimate(), shab = state.shab > 0 ? state.shab : auto, ratio = shab > 0 ? total / shab : 0;
  return {total, by, items, shab, auto, manual:state.shab > 0, ratio, ok:ratio >= GLAZ_MIN, need:Math.max(0, shab * GLAZ_MIN - total)};
}
function glazingCard(){
  const r = glazingReport(); if (!state.els.some(e => e.kind === 'wall')) return '';
  const pct = v => nf(v * 100, 1) + ' %';
  return `<div class="grp glz"><h3>Surface vitrée</h3>
    <div class="perf"><div class="pc"><span>Baies (en tableau)</span><b>${nf(r.total, 2)}</b><em>m² · ${r.items.length} baie${r.items.length > 1 ? 's' : ''}</em></div>
      <div class="pc ${r.ok ? 'g-ok' : 'g-bad'}"><span>Ratio / surface habitable</span><b>${pct(r.ratio)}</b><em>minimum 1/6 = ${pct(GLAZ_MIN)}</em></div></div>
    <ul class="warns"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? 'Conforme : la surface des baies atteint au moins 1/6 de la surface habitable.' : `Non conforme : il manque environ ${nf(r.need, 2)} m² de baies pour atteindre 1/6 de la surface habitable.`}</li></ul>
    <div class="glz-o">${['N', 'E', 'S', 'O'].map(o => `<div><span>${{N:'Nord', E:'Est', S:'Sud', O:'Ouest'}[o]}</span><b>${nf(r.by[o], 2)} m²</b><i style="width:${r.total ? Math.round(r.by[o] / r.total * 100) : 0}%"></i></div>`).join('')}</div>
    <div class="fields"><label class="f"><span>Surface habitable</span><span class="in"><input data-f="shab" type="number" step="0.1" min="0" value="${r.manual ? nf(state.shab, 1).replace(',', '.') : ''}" placeholder="${nf(r.auto, 1)} (estimée)"><em>m²</em></span></label></div>
    <p class="hint">Surface des baies mesurée en tableau (fenêtres, portes-fenêtres, baies, portes vitrées). Repère : RT 2012, art. 20 (baies ≥ 1/6 de la surface habitable), toujours utilisé en maison individuelle. Surface habitable estimée d'après les planchers moins l'emprise des murs ; saisissez la valeur exacte si vous la connaissez. Le sud favorise les apports solaires l'hiver.</p></div>`;
}
