/* ============ Planches imprimables (PDF) ============
   Plans de niveaux, élévations et coupes mis à l'échelle (1/50, 1/100, 1/200…) sur des planches A3, A1 ou A4 paysage,
   avec cartouche, échelle graphique et nord. Les vues sont rendues hors écran avec leurs textes (cotes, pièces, niveaux),
   assemblées dans un aperçu, puis imprimées en PDF par le navigateur. */
const SHEET_FMT = {A4:[297, 210], A3:[420, 297], A2:[594, 420], A1:[841, 594]};
const SHEET_SCALES = [5, 10, 20, 50, 100, 200, 500];
const SHEET_PHASES = ['ESQ', 'APS', 'APD', 'PC', 'PRO', 'DCE', 'EXE', 'DOE'];
function sheetDefs(){
  const out = [];
  state.levels.forEach((L, i) => { if (state.els.some(e => e.lvl === i)) out.push({key:'L' + i, kind:'plan', lvl:i, name:`Plan ${L.n}`}); });
  for (const d of secDefs()) out.push({key:d.id, kind:d.kind, def:d, name:d.name});
  return out;
}
/* rendu hors écran d'une vue : {url, wM, hM} (dimensions réelles en mètres) */
async function renderSheetView(v, scale, dpi = scale <= 20 ? 110 : 150){
  const keep = {view, curLvl, curSec, sel, multi:multi.slice(), bg:scene.background, fog:scene.fog, clip:renderer.clippingPlanes, pr:renderer.getPixelRatio(), w:vpEl.clientWidth, h:vpEl.clientHeight,
    vis:[[gridMajor, gridMajor?.visible], [gridMinor, gridMinor?.visible], [markGroup, markGroup.visible], [previewGroup, previewGroup.visible], [terrainGroup, terrainGroup.visible]]};
  sel = null; multi = [];
  let cam, levelsLines = null;
  try {
    if (v.kind === 'plan'){ curLvl = v.lvl; curSec = null; if (view !== '2d') setView('2d'); rebuild({noPanel:true}); }
    else { openSection(v.def); }
    applySel();
    [gridMajor, gridMinor, markGroup, previewGroup, terrainGroup].forEach(o => { if (o) o.visible = false; });
    scene.background = new THREE.Color('#FFFFFF'); scene.fog = null;
    const box = new THREE.Box3(); modelGroup.updateMatrixWorld(true);
    modelGroup.traverse(o => { if (o.isMesh) box.expandByObject(o); });   // y compris les objets masqués par l'affichage groupé
    if (v.kind === 'plan'){ dimGroup.updateMatrixWorld(true); if (dimGroup.children.length) box.expandByObject(dimGroup); }
    if (box.isEmpty()) return null;
    const m = 0.6;   // marge autour du dessin (m)
    if (v.kind === 'plan'){
      const c = box.getCenter(new THREE.Vector3()), W = box.max.x - box.min.x + 2 * m, D = box.max.z - box.min.z + 2 * m;
      cam = new THREE.OrthographicCamera(-W / 2, W / 2, D / 2, -D / 2, 0.1, 2000); cam.up.set(0, 0, -1); cam.position.set(c.x, box.max.y + 200, c.z); cam.lookAt(c.x, box.min.y - 1, c.z);
      cam.userData = {W, D};
    } else {
      const n = secDir(v.def), Dv = new THREE.Vector3(n[0], 0, -n[1]).normalize(), R = new THREE.Vector3().crossVectors(Dv, new THREE.Vector3(0, 1, 0)).normalize();
      const cs = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) cs.push(new THREE.Vector3(x, y, z));
      const rs = cs.map(p => p.dot(R)), ys = cs.map(p => p.y), r0 = Math.min(...rs), r1 = Math.max(...rs);
      const z0 = Math.min(...ys, ...state.levels.map(l => l.z)), z1 = Math.max(...ys, ...state.levels.filter(l => l.z <= Math.max(...ys) + 0.2).map(l => l.z));
      const W = r1 - r0 + 2 * m + 3.2, D = z1 - z0 + 2 * m, mid = (r0 + r1) / 2 + 1.6, c = box.getCenter(new THREE.Vector3());
      const tgt = R.clone().multiplyScalar(mid).add(new THREE.Vector3(0, (z0 + z1) / 2, 0)).add(Dv.clone().multiplyScalar(c.dot(Dv)));
      if (v.kind === 'coupe'){ const P = new THREE.Vector3(v.def.a[0], 0, -v.def.a[1]); tgt.add(Dv.clone().multiplyScalar(P.dot(Dv) - tgt.dot(Dv))); }
      cam = new THREE.OrthographicCamera(-W / 2, W / 2, D / 2, -D / 2, 0.1, 2000); cam.up.set(0, 1, 0); cam.position.copy(tgt).addScaledVector(Dv, -400); cam.lookAt(tgt);
      cam.userData = {W, D}; levelsLines = true;
      renderer.clippingPlanes = v.kind === 'coupe' ? secClip() : [];
    }
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const {W, D} = cam.userData, ppm = Math.min((1000 / scale) / 25.4 * dpi, 6000 / Math.max(W, D)), wpx = Math.round(W * ppm), hpx = Math.round(D * ppm);
    renderer.setPixelRatio(1); renderer.setSize(wpx, hpx, false); renderer.render(scene, cam);
    const cv = document.createElement('canvas'); cv.width = wpx; cv.height = hpx; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, wpx, hpx); g.drawImage(renderer.domElement, 0, 0);
    const P = p => { const q = p.clone().project(cam); return [(q.x + 1) / 2 * wpx, (1 - q.y) / 2 * hpx]; }, fs = Math.max(11, Math.round(ppm * scale * 0.0027));   // texte ≈ 2,7 mm sur le papier, quelle que soit l'échelle
    const tag = (x, y, lines, bold) => { g.font = `${bold ? 600 : 500} ${fs}px Inter, Arial, sans-serif`; const wmax = Math.max(...lines.map(t => g.measureText(t).width)), hh = fs * 1.2 * lines.length;
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x - wmax / 2 - 3, y - hh / 2 - 2, wmax + 6, hh + 4); g.fillStyle = '#1F2937'; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((t, i) => g.fillText(t, x, y - hh / 2 + fs * 0.6 + i * fs * 1.2)); };
    if (v.kind === 'plan') for (const l of labels){ if (!l.d.isConnected || l.d.classList.contains('grip')) continue; const t = l.d.innerText.trim(); if (!t) continue; const [x, y] = P(l.pos); tag(x, y, t.split('\n'), l.d.classList.contains('room') || l.d.classList.contains('cote')); }
    if (levelsLines){ g.setLineDash([Math.max(4, fs * 0.6), Math.max(3, fs * 0.4)]); g.strokeStyle = '#2563EB'; g.lineWidth = Math.max(1, fs / 10);
      for (const L of state.levels){ const y = P(new THREE.Vector3(cam.position.x, L.z, cam.position.z))[1]; if (y < 0 || y > hpx) continue; g.beginPath(); g.moveTo(0, y); g.lineTo(wpx, y); g.stroke();
        g.font = `600 ${fs}px Inter, Arial, sans-serif`; const t = `${L.n}  ${L.z >= 0 ? '+' : ''}${nf(L.z)}`, tw = g.measureText(t).width; g.fillStyle = '#2563EB'; g.fillRect(wpx - tw - 14, y - fs * 0.75, tw + 10, fs * 1.5); g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, wpx - tw - 9, y); }
      g.setLineDash([]); }
    return {url:cv.toDataURL('image/png'), wM:W, hM:D};
  } finally {
    renderer.setPixelRatio(keep.pr); renderer.setSize(keep.w, keep.h, false); renderer.clippingPlanes = keep.clip; scene.background = keep.bg; scene.fog = keep.fog;
    keep.vis.forEach(([o, vv]) => { if (o) o.visible = vv; });
    curLvl = keep.curLvl; curSec = keep.curSec; sel = keep.sel; multi = keep.multi;
    if (keep.view === 'sec' && keep.curSec) openSection(keep.curSec); else { setView(keep.view); rebuild({noPanel:true}); }
    syncLevels(); positionGrid(); dirty = true;
  }
}
function sheetPack(items, fmt){
  const [SW, SH] = SHEET_FMT[fmt], M = 10, CART = 46, GAP = 12, CAP = 9, W = SW - 2 * M, H = SH - 2 * M - CART - 4, sheets = [];
  let cur = null, x = 0, y = 0, rowH = 0;
  const newSheet = () => { cur = []; sheets.push(cur); x = 0; y = 0; rowH = 0; };
  newSheet();
  for (const it of items){
    if (it.solo && (x > 0 || y > 0)) newSheet();
    const w = it.cw ?? it.wmm, h = (it.ch ?? it.hmm) + CAP;
    if (x > 0 && x + w > W){ x = 0; y += rowH + GAP; rowH = 0; }
    if (y + h > H && (x > 0 || y > 0)){ newSheet(); }
    cur.push({...it, x:M + x, y:M + y}); x += w + GAP; rowH = Math.max(rowH, h);
  }
  return sheets.filter(s => s.length);
}
function sheetHTML(sheets, opt){
  const [SW, SH] = SHEET_FMT[opt.fmt], N = sheets.length, today = new Date().toLocaleDateString('fr-FR');
  const north = `<svg viewBox="0 0 40 40" width="12mm" height="12mm"><circle cx="20" cy="20" r="18" fill="none" stroke="#111" stroke-width="1"/><path d="M20 4l7 22-7-5-7 5z" fill="#111"/><text x="20" y="37" font-size="7" text-anchor="middle" font-family="Arial">N</text></svg>`;
  const bar = sc => { const seg = sc <= 50 ? 1 : sc <= 100 ? 2 : sc <= 200 ? 5 : 10, mm = seg * 1000 / sc; return `<div class="bar"><div>${[0, 1, 2, 3].map(i => `<i style="width:${mm}mm;background:${i % 2 ? '#fff' : '#111'}"></i>`).join('')}</div><span>0</span><span style="left:${mm * 4}mm">${seg * 4} m</span></div>`; };
  const cart = (k) => `<table class="cart"><tr><td colspan="3" class="t">${esc(state.name)}</td><td rowspan="4" class="logo"><b>ARCHI<span>PLAN</span></b><small>Studio Prism</small></td></tr>
    <tr><td><em>Adresse</em>${esc(state.site?.label || state.site?.addr || '—')}</td><td><em>Maître d'ouvrage</em>${esc(opt.moa || '—')}</td><td><em>Phase</em>${esc(opt.phase)}</td></tr>
    <tr><td><em>Dessiné par</em>${esc(opt.auteur || '—')}</td><td><em>Date</em>${today}</td><td><em>Indice</em>${esc(opt.indice || 'A')}</td></tr>
    <tr><td><em>Contenu</em>${esc(sheets[k].map(v => v.name).join(', '))}</td><td><em>Échelle</em>${[...new Set(sheets[k].map(v => '1/' + v.scale))].join(', ')}</td><td><em>Planche</em>${k + 1} / ${N}</td></tr></table>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(state.name)} — planches</title><style>
    @page{size:${SW}mm ${SH}mm;margin:0} *{box-sizing:border-box} body{margin:0;background:#E5E7EB;font-family:Inter,Arial,sans-serif;color:#111}
    .sheet{position:relative;width:${SW}mm;height:${SH}mm;background:#fff;margin:10mm auto;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.15);page-break-after:always;break-after:page}
    .frame{position:absolute;inset:7mm;border:0.5mm solid #111;pointer-events:none}
    figure{position:absolute;margin:0} figure img{display:block} figcaption{font-size:3.4mm;font-weight:700;margin-top:1.5mm;display:flex;gap:4mm;align-items:center;white-space:nowrap}
    figcaption span{font-weight:500;color:#444} .nord{position:absolute;right:1mm;top:1mm}
    .bar{position:relative;height:6mm;margin-left:2mm} .bar div{display:flex;border:0.2mm solid #111;height:1.6mm} .bar i{display:block;height:100%} .bar span{position:absolute;top:2mm;font-size:2.4mm;transform:translateX(-50%)} .bar span:first-of-type{left:0}
    table.cart{position:absolute;right:10mm;bottom:10mm;width:190mm;border-collapse:collapse;font-size:2.8mm} .cart td{border:0.3mm solid #111;padding:1.2mm 2mm;vertical-align:top} .cart em{display:block;font-style:normal;font-size:2.2mm;color:#555;text-transform:uppercase;letter-spacing:.03em}
    .cart .t{font-size:4.4mm;font-weight:800} .cart .logo{width:34mm;text-align:center;vertical-align:middle} .cart .logo b{font-size:4.6mm;letter-spacing:.02em} .cart .logo b span{color:#0E8FB0} .cart .logo small{display:block;font-size:2.4mm;color:#555}
    @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact} body{background:#fff} .sheet{margin:0;box-shadow:none}}
  </style></head><body>${sheets.map((S, k) => `<div class="sheet"><div class="frame"></div>${S.map(v => `<figure style="left:${v.x}mm;top:${v.y}mm"><div style="width:${v.cw ?? v.wmm}mm;height:${v.ch ?? v.hmm}mm;overflow:hidden;position:relative"><img src="${v.url}" style="position:absolute;left:${-(v.ox || 0)}mm;top:${-(v.oy || 0)}mm;width:${v.wmm}mm;height:${v.hmm}mm"></div><figcaption>${esc(v.name)} <span>1/${v.scale}</span>${v.kind === 'plan' ? bar(v.scale) : ''}</figcaption>${v.kind === 'plan' ? `<div class="nord">${north}</div>` : ''}</figure>`).join('')}${cart(k)}</div>`).join('')}</body></html>`;
}
/* assemble les planches : chaque vue est rendue à l'échelle choisie (0 = ajustée automatiquement à la planche) ; une vue trop grande descend à l'échelle inférieure,
   et au-delà du 1/500 reçoit une échelle exacte ajustée, toujours affichée telle qu'appliquée */
async function buildSheets(o, defsL, cache, prog){
  const [SW, SH] = SHEET_FMT[o.fmt], maxW = SW - 20, maxH = SH - 20 - 46 - 4 - 9, items = [], warns = [];
  const render = async (v, sc) => { const k = v.key + '|' + sc; if (!(k in cache)) cache[k] = await renderSheetView(v, sc); return cache[k]; };
  for (const v of defsL.filter(x => o.pick.includes(x.key))){
    prog?.(`Rendu : ${v.name}…`); await new Promise(r => setTimeout(r, 20));
    try {
      let sc = o.scale || 100, r = await render(v, sc);
      if (!r){ warns.push(`« ${v.name} » est vide : la vue est ignorée.`); continue; }
      const need = Math.max(r.wM * 1000 / maxW, r.hM * 1000 / maxH);   // échelle (1/x) qui fait tenir la vue exactement sur la planche
      if (!o.scale){   // ajustée : la plus grande échelle ronde qui tient, une vue par planche
        sc = need <= 5 ? 5 : need <= 10 ? 10 : need <= 20 ? 20 : Math.ceil(need / 5) * 5; r = await render(v, sc) || r;
        items.push({...v, url:r.url, scale:sc, wmm:r.wM * 1000 / sc, hmm:r.hM * 1000 / sc, solo:true}); continue;
      }
      const wmm = r.wM * 1000 / sc, hmm = r.hM * 1000 / sc;
      if (wmm <= maxW && hmm <= maxH){ items.push({...v, url:r.url, scale:sc, wmm, hmm}); continue; }
      if (o.split === false){   // pas de découpe : on garde l'échelle la plus proche qui tient, et on le dit
        const sc2 = SHEET_SCALES.find(x => x >= need) || Math.ceil(need); r = await render(v, sc2) || r;
        warns.push(`« ${v.name} » ne tient pas à l'échelle 1/${sc} sur un ${o.fmt} : passée à 1/${sc2}.`);
        items.push({...v, url:r.url, scale:sc2, wmm:r.wM * 1000 / sc2, hmm:r.hM * 1000 / sc2}); continue;
      }
      const nc = Math.ceil(wmm / maxW - 1e-6), nr = Math.ceil(hmm / maxH - 1e-6), tw = wmm / nc, th = hmm / nr;
      warns.push(`« ${v.name} » mesure ${Math.round(wmm)} × ${Math.round(hmm)} mm à 1/${sc} : découpée en ${nc * nr} parties (${nc} × ${nr}) sur plusieurs planches ${o.fmt}.`);
      for (let j = 0; j < nr; j++) for (let k = 0; k < nc; k++)
        items.push({...v, name:`${v.name} (partie ${j * nc + k + 1}/${nc * nr})`, url:r.url, scale:sc, wmm, hmm, cw:tw, ch:th, ox:k * tw, oy:j * th, solo:true, tile:true});
    } catch(e){ console.error(e); warns.push(`Erreur de mise en page pour « ${v.name} » (${e.message || e}) : vue non placée.`); }
  }
  const sheets = sheetPack(items, o.fmt); warns.push(...sheetIssues(sheets, o.fmt));
  return {sheets, warns, html:sheetHTML(sheets, o)};
}
/* contrôle de la mise en page : chaque vue doit rester dans le cadre et hors du cartouche */
function sheetIssues(sheets, fmt){
  const [SW, SH] = SHEET_FMT[fmt], out = [], fr = 7, cart = {x:SW - 10 - 190, y:SH - 10 - 46, w:190, h:46};
  sheets.forEach((S, k) => S.forEach(v => {
    const w = v.cw ?? v.wmm, h = (v.ch ?? v.hmm) + 9;
    if (v.x < fr || v.y < fr || v.x + w > SW - fr + 0.01 || v.y + h > SH - fr + 0.01) out.push(`Planche ${k + 1} : « ${v.name} » dépasse du cadre.`);
    else if (v.x + w > cart.x && v.y + h > cart.y) out.push(`Planche ${k + 1} : « ${v.name} » chevauche le cartouche.`);
  }));
  return out;
}
function openSheets(){
  const o = state.sheet ??= {fmt:'A3', scale:100, phase:'APS', indice:'A', moa:'', auteur:$('#umName')?.textContent?.trim() || '', pick:null};
  const defsL = sheetDefs(), pick = new Set(o.pick || defsL.filter(d => d.kind === 'plan' || d.kind === 'coupe' || d.key === 'elev-S' || d.key === 'elev-E').map(d => d.key));
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Exporter</span><h3 class="ed-t2">Planches à imprimer (PDF)</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body ia" style="grid-template-columns:minmax(280px,.8fr) minmax(0,1.6fr)"><section><div class="fields">
      <label class="f"><span>Format</span><span class="in"><select id="shF">${Object.keys(SHEET_FMT).map(k => `<option${k === o.fmt ? ' selected' : ''}>${k}</option>`).join('')}</select></span></label>
      <label class="f"><span>Échelle</span><span class="in"><select id="shS"><option value="0"${!o.scale ? ' selected' : ''}>Auto (ajustée)</option>${SHEET_SCALES.map(s => `<option value="${s}"${s === o.scale ? ' selected' : ''}>1/${s}</option>`).join('')}</select></span></label>
      <label class="f"><span>Phase</span><span class="in"><select id="shP">${SHEET_PHASES.map(p => `<option${p === o.phase ? ' selected' : ''}>${p}</option>`).join('')}</select></span></label>
      <label class="f"><span>Indice</span><span class="in"><input id="shI" value="${esc(o.indice)}" maxlength="4"></span></label>
      <label class="f wide"><span>Maître d'ouvrage</span><span class="in"><input id="shM" value="${esc(o.moa)}" style="font-family:var(--f-body)"></span></label>
      <label class="f wide"><span>Dessiné par</span><span class="in"><input id="shA" value="${esc(o.auteur)}" style="font-family:var(--f-body)"></span></label></div>
      <div class="grp"><h3>Vues</h3>${defsL.map(v => `<label class="f wide rchk"><input type="checkbox" data-sv="${esc(v.key)}"${pick.has(v.key) ? ' checked' : ''}> ${esc(v.name)}</label>`).join('')}</div>
      <label class="ap-check2"><input type="checkbox" id="shSp"${o.split === false ? '' : ' checked'}> Échelle imposée : découper une grande vue sur plusieurs planches</label><p class="hint">« Ajusté » prend la plus grande échelle qui fait tenir chaque vue sur sa planche. Avec une échelle imposée, une vue trop grande est découpée (ou, si la case est décochée, passée à une échelle plus petite). L'échelle appliquée est écrite sous chaque vue et dans le cartouche. Imprimez à 100 % (sans « ajuster à la page »).</p></section>
    <section><div id="shWarn" role="alert" hidden style="margin-bottom:8px;padding:8px 12px;border-radius:8px;background:#FEF3C7;border:1px solid #F59E0B;color:#78350F;font-size:12.5px"></div><div class="grp" style="margin-top:0"><h3>Aperçu <span id="shProg" class="hint"></span></h3><iframe id="shFrame" title="Planches" style="width:100%;height:62vh;border:1px solid var(--line,#ddd);border-radius:8px;background:#E5E7EB"></iframe></div></section></div>
    <footer class="ed-f"><span class="hint" id="shN"></span><button class="btn" data-close>Fermer</button><button class="btn" id="shDl">Télécharger (.html)</button><button class="btn primary" id="shPr">Imprimer / PDF</button></footer>`, 'wide');
  const cache = {}; let html = '', run = 0, tm;
  const read = () => { Object.assign(o, {fmt:d.querySelector('#shF').value, scale:+d.querySelector('#shS').value, phase:d.querySelector('#shP').value, indice:d.querySelector('#shI').value.trim(), moa:d.querySelector('#shM').value.trim(), auteur:d.querySelector('#shA').value.trim()});
    o.split = d.querySelector('#shSp').checked; o.pick = [...d.querySelectorAll('[data-sv]:checked')].map(x => x.dataset.sv); };
  const refresh = async () => { if (!d.querySelector('#shF')) return; const my = ++run; read(); if (!o.pick.length){ d.querySelector('#shFrame').srcdoc = ''; return; }
    const prog = d.querySelector('#shProg'), wb = d.querySelector('#shWarn'); let r; try { r = await buildSheets(o, defsL, cache, t => { if (my === run) prog.textContent = t; }); } catch(e){ console.error(e); if (my === run){ wb.hidden = false; wb.innerHTML = '<b>Erreur de mise en page :</b> les planches n\'ont pas pu être générées (' + esc(e.message || String(e)) + '). Essayez un autre format ou une autre échelle.'; prog.textContent = ''; } return; }
    if (my !== run || !d.isConnected) return; html = r.html; wb.hidden = !r.warns.length; wb.innerHTML = r.warns.length ? '<b>Attention, mise en page :</b><ul style="margin:4px 0 0 18px;padding:0">' + r.warns.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : ''; const fr = d.querySelector('#shFrame'), z = Math.min(1, (fr.clientWidth - 24) / (SHEET_FMT[o.fmt][0] * 96 / 25.4 + 40)).toFixed(3); fr.srcdoc = html.replace('</style>', `body{zoom:${z}}@media print{body{zoom:1}}</style>`); prog.textContent = ''; d.querySelector('#shN').textContent = `${r.sheets.length} planche${r.sheets.length > 1 ? 's' : ''}`; };
  const later = () => { clearTimeout(tm); tm = setTimeout(refresh, 350); };
  d.addEventListener('change', later); d.addEventListener('input', e => { if (e.target.matches('input[type=text],input:not([type])')) later(); }); refresh();
  d.querySelector('#shPr').onclick = () => { const f = d.querySelector('#shFrame'); try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){ const w = window.open('', '_blank'); if (w){ w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); } } };
  d.querySelector('#shDl').onclick = () => offer(`${fileBase()}_planches.html`, new Blob([html], {type:'text/html'}));
}
function showSheets(html, n){
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">${n} planche${n > 1 ? 's' : ''}</span><h3 class="ed-t2">Aperçu avant impression</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body" style="padding:0"><iframe id="shFrame" title="Planches" style="width:100%;height:70vh;border:0;background:#E5E7EB"></iframe></div>
    <footer class="ed-f"><button class="btn" data-close>Fermer</button><button class="btn" id="shDl">Télécharger (.html)</button><button class="btn primary" id="shPr">Imprimer / PDF</button></footer>`, 'wide');
  const f = d.querySelector('#shFrame'); f.srcdoc = html;
  d.querySelector('#shPr').onclick = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){ const w = window.open('', '_blank'); if (w){ w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); } } };
  d.querySelector('#shDl').onclick = () => offer(`${fileBase()}_planches.html`, new Blob([html], {type:'text/html'}));
}
