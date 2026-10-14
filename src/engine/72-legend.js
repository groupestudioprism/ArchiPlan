/* ============ Légende automatique et étiquettes à l'écran ============ */
function legendEntries(){
  const out = [], seen = new Map(), hide = new Set(state.legend.hide || []);
  const add = (key, html, label, n = 1) => { if (seen.has(key)){ seen.get(key).n += n; return; } const e = {key, html, label, n}; seen.set(key, e); out.push(e); };
  for (const e of state.els){
    if (e.hidden) continue;
    if (e.t === 'closure') add('closure|' + e.mode, `<i class="lg-zone" style="border-color:#D32F2F;background:repeating-linear-gradient(135deg,#D32F2F99 0 4px,#fff9 4px 7px)"></i>`, e.mode === 'alternat' ? 'Chaussée rétrécie, alternat' : e.mode === 'sens' ? 'Route barrée dans un sens' : 'Route barrée');
    else if (e.t === 'detour') add('detour|' + e.col + '|' + e.name, `<i class="lg-line" style="border-color:${esc(e.col)}"></i>`, (e.name || 'Déviation') + (e.cls && e.cls !== 'tous' ? ` (${e.cls})` : ''));
    else if (e.t === 'zone') add('zone', `<i class="lg-zone" style="border-color:#F28A1A;background:#F28A1A33"></i>`, 'Emprise de chantier');
    else if (e.t === 'line'){ const T = LINE_TYPES[e.k]; add('line|' + e.k, `<i class="lg-line dash" style="border-color:${T?.col || '#F06A12'}"></i>`, T?.legend || 'Balisage'); }
    else if (e.t === 'obj'){ const L = LIBK[e.k]; if (!L) continue; const p = L.sign ? JSON.stringify(e.p || {}) : ''; add('obj|' + e.k + '|' + p, `<img src="${libThumb(L)}" alt="">`, (L.ref && L.sign ? L.ref.replace('KR1', 'KC1') + ' · ' : '') + L.name); }
    else if (e.t === 'swept') add('swept|' + e.veh, `<i class="lg-zone" style="border-color:#7B1FA2;background:#7B1FA233"></i>`, `Giration · ${SWEPT_VEH[e.veh]?.n || ''}`);
    else if (e.t === 'arrow' && e.label) add('arrow|' + e.col + e.label, `<i class="lg-line" style="border-color:${esc(e.col)}"></i>`, e.label);
  }
  for (const c of state.legend.custom || []) add('custom|' + c.t + c.c, `<i class="lg-line" style="border-color:${esc(c.c)}"></i>`, c.t);
  return out.filter(e => !hide.has(e.key));
}
function renderLegend(){
  const box = $('#legendBox'); if (!state) return; const L = legendEntries();
  box.hidden = !state.legend.show || !L.length;
  box.innerHTML = `<h4>${esc(state.legend.title || 'Légende')}</h4><ul>${L.map(e => `<li><span class="lg-sym">${e.html}</span><span>${esc(e.label)}${e.n > 1 ? ` <small style="display:inline;color:var(--mut)">× ${e.n}</small>` : ''}</span></li>`).join('')}</ul><small>${esc(state.site?.label || '')}</small>`;
  const p = state.legend.pos; if (p){ box.style.left = p[0] + 'px'; box.style.top = p[1] + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto'; } else { box.style.left = box.style.top = ''; box.style.right = ''; box.style.bottom = ''; }
}
/* déplacement de la légende à la souris */
(() => { const box = $('#legendBox'); let st = null;
  box.addEventListener('pointerdown', e => { const r = box.getBoundingClientRect(), vr = vpEl.getBoundingClientRect(); st = {dx:e.clientX - r.left, dy:e.clientY - r.top, vr}; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', e => { if (!st) return; const x = clamp(e.clientX - st.vr.left - st.dx, 0, st.vr.width - box.offsetWidth), y = clamp(e.clientY - st.vr.top - st.dy, 0, st.vr.height - box.offsetHeight); box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto'; });
  box.addEventListener('pointerup', () => { if (!st) return; st = null; state.legend.pos = [parseFloat(box.style.left), parseFloat(box.style.top)]; save(); }); })();
function renderLegendTab(){
  const all = (() => { const keep = state.legend.hide; state.legend.hide = []; const r = legendEntries(); state.legend.hide = keep; return r; })(), hide = new Set(state.legend.hide || []);
  pb().innerHTML = `<div class="ph"><h2>Légende</h2><span class="tag">Automatique</span></div>
    <label class="f rchk"><input type="checkbox" id="lgShow"${state.legend.show ? ' checked' : ''}> Afficher la légende sur la vue et les exports</label>
    <div class="fields" style="margin-top:10px"><label class="f wide"><span>Titre</span><span class="in"><input id="lgTitle" value="${esc(state.legend.title || 'Légende')}" style="font-family:var(--f-body)"></span></label></div>
    <div class="grp"><h3>Entrées (créées d'après le plan)</h3>${all.length ? `<div class="elist">${all.map(e => `<label class="erow" style="cursor:pointer"><span class="ei">${e.html}</span><span><b>${esc(e.label)}</b><small>${e.n > 1 ? e.n + ' éléments' : '1 élément'}</small></span><input type="checkbox" data-lg="${esc(e.key)}"${hide.has(e.key) ? '' : ' checked'}></label>`).join('')}</div>` : '<p class="hint">La légende se remplit toute seule à mesure que vous barrez des rues, tracez des déviations et posez des panneaux.</p>'}</div>
    <div class="grp"><h3>Entrées personnalisées</h3><div class="elist">${(state.legend.custom || []).map((c, i) => `<div class="erow"><span class="ei"><i style="background:${esc(c.c)}"></i></span><span><b>${esc(c.t)}</b></span><button class="x" data-lgdel="${i}">×</button></div>`).join('')}</div>
    <div class="fields" style="margin-top:8px"><label class="f wide"><span>Libellé</span><span class="in"><input id="lgNew" placeholder="Ex. : Itinéraire piétons" style="font-family:var(--f-body)"></span></label><label class="f"><span>Couleur</span><span class="in"><input id="lgCol" type="color" value="#2E7D32" style="height:30px;padding:0"></span></label></div>
    <div class="btns"><button class="btn" id="lgAdd">Ajouter</button><button class="btn" id="lgPos">Replacer en bas à droite</button></div></div>`;
  $('#lgShow').onchange = e => { beginEdit(); state.legend.show = e.target.checked; endEdit(); renderLegend(); };
  $('#lgTitle').onchange = e => { beginEdit(); state.legend.title = e.target.value; endEdit(); renderLegend(); };
  pb().querySelectorAll('[data-lg]').forEach(c => c.onchange = () => { beginEdit(); const h = new Set(state.legend.hide || []); c.checked ? h.delete(c.dataset.lg) : h.add(c.dataset.lg); state.legend.hide = [...h]; endEdit(); renderLegend(); });
  pb().querySelectorAll('[data-lgdel]').forEach(b => b.onclick = () => { beginEdit(); state.legend.custom.splice(+b.dataset.lgdel, 1); endEdit(); renderLegend(); renderLegendTab(); });
  $('#lgAdd').onclick = () => { const t = $('#lgNew').value.trim(); if (!t) return; beginEdit(); state.legend.custom = [...(state.legend.custom || []), {t, c:$('#lgCol').value}]; endEdit(); renderLegend(); renderLegendTab(); };
  $('#lgPos').onclick = () => { state.legend.pos = null; save(); renderLegend(); };
}
/* ---------- étiquettes HTML : noms de rues, annotations, cotes, routes barrées ---------- */
let annoKey = '', annos = [];
function buildAnnos(){
  const L = $('#labels'); L.innerHTML = ''; annos = [];
  const mk = (cls, txt, xy, z = 0, extra = {}) => { const d = document.createElement('div'); d.className = 'anno ' + cls; d.textContent = txt; L.appendChild(d); annos.push({d, xy, z, ...extra}); return d; };
  if (WORLD?.labels && DISPLAY.lay.names !== false) for (const s of WORLD.labels) mk('street', s.name, s.xy, 0.5, {street:true, dir:s.dir});
  for (const e of state?.els || []){
    if (e.hidden) continue;
    if (e.t === 'note'){ const d = mk(e.size === 'big' ? 'big' : '', e.text, [e.x, e.y], 2.4); d.style.color = e.col || '#1565C0'; }
    else if (e.t === 'dim'){ mk('dimtxt', fmtM(V.dist(e.a, e.b)), V.lerp(e.a, e.b, 0.5), 0.5); }
    else if (e.t === 'closure' && e.pts?.length > 1){ mk('closed', e.mode === 'alternat' ? 'ALTERNAT' : e.mode === 'sens' ? 'SENS BARRÉ' : 'ROUTE BARRÉE', plAt(e.pts, plLen(e.pts) / 2).pt, 1); }
    else if (e.t === 'detour' && e.pts?.length > 1){ const d = mk('detour', e.name?.split(' · ')[0] || 'Déviation', plAt(e.pts, plLen(e.pts) * 0.33).pt, 1); d.style.background = e.col; d.style.borderColor = e.col; }
  }
}
function updateLabels(){
  const k = (state?.els || []).map(e => e.id + (e.text || '') + (e.name || '') + (e.hidden ? 1 : 0) + (e.pts?.length || '') + (e.x ?? '') + (e.a ?? '')).join() + '|' + (WORLD?.labels?.length || 0) + DISPLAY.lay.names;
  if (k !== annoKey){ annoKey = k; buildAnnos(); }
  const W = vpEl.clientWidth, Hh = vpEl.clientHeight, far = view !== '2d' && persp.position.distanceTo(c3.target) > 700, mpp = mPerPx();
  for (const a of annos){
    if (a.street && (far || mpp > 1.6 || (view !== '2d' && Math.hypot(a.xy[0] - c3.target.x, a.xy[1] + c3.target.z) > 220))){ a.d.hidden = true; continue; }
    const [x, y, z] = toScreen(W3(a.xy[0], a.xy[1], (WORLD ? H(a.xy[0], a.xy[1]) : 0) + a.z));
    const vis = z < 1 && z > -1 && x > -50 && y > -20 && x < W + 50 && y < Hh + 20; a.d.hidden = !vis; if (!vis) continue;
    a.d.style.left = x + 'px'; a.d.style.top = y + 'px';
    if (a.street && view === '2d'){ let ang = Math.atan2(-a.dir[1], a.dir[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180; a.d.style.transform = `translate(-50%,-50%) rotate(${ang}deg)`; } else if (a.street) a.d.style.transform = 'translate(-50%,-50%)';
  }
}
function updateCompass(){ const g = $('#cmpG'); if (!g) return; let a = 0; if (view !== '2d'){ const d = new THREE.Vector3(); persp.getWorldDirection(d); a = Math.atan2(d.x, -d.z) * 180 / Math.PI; } g.style.transform = `rotate(${-a}deg)`; }
