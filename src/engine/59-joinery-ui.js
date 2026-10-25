/* ============ Outil Menuiserie : fenêtres et portes sur mesure, fiche de performances, symbole de battement en plan ============ */
const JN_KIND_DEF = {fen:{n:2, w:1.2, h:1.35, sill:0.9, open:'fr', frame:'pvc'}, pf:{n:2, w:1.4, h:2.15, sill:0, open:'fr', frame:'alu'}, coul:{n:2, w:2.4, h:2.15, sill:0, frame:'alu'}, fixe:{n:1, w:1.0, h:1.0, sill:1.0, frame:'alu'},
  pi:{n:1, w:0.83, h:2.04, sill:0, leaf:'pleine', frame:'boisP', open:'fr'}, pe:{n:1, w:0.9, h:2.15, sill:0, leaf:'pleine', frame:'alu', iso:true, open:'fr'}};
const JN_N = {fen:[1, 2, 3], pf:[1, 2, 3], coul:[2, 3, 4], fixe:[1], pi:[1, 2], pe:[1, 2]};
function jnPerfHTML(perf, chk){
  const pc = (l, v, u) => `<div class="pc"><span>${l}</span><b>${v}</b><em>${u}</em></div>`;
  let h = `<div class="perf jn-perf">${perf.interior ? pc('Isolation', '—', 'porte intérieure') : pc('Uw', nf(perf.Uw, 2), `W/m²·K · ${perf.th}`)}${pc('Facteur solaire Sw', nf(perf.Sw, 2), `TLw ${nf(perf.TL, 2)}`)}${pc('Acoustique', `${perf.Rw} dB`, `Rw · Rw+Ctr ≈ ${perf.RwCtr} · ${perf.ac}`)}${pc('Masse', `${perf.kg} kg`, perf.n > 1 ? `${perf.leafKg} kg par vantail` : 'par unité')}</div>
    <p class="hint">${esc(perf.glazing)} (Ug ${nf(perf.Ug, 1)}) · cadre ${esc(perf.frame)} (Uf ${nf(perf.Uf, 1)}) · vitrage ${nf(perf.Ag, 2)} m² sur ${nf(perf.Aw, 2)} m² · perméabilité ${esc(perf.aev)}${perf.fire ? ` · résistance au feu ${esc(perf.fire)}` : ''}</p>`;
  if (chk){ const li = (cls, t) => `<li class="${cls}">${esc(t)}</li>`, all = [...chk.errors.map(t => li('bad', t)), ...chk.warns.map(t => li('warn', t)), ...chk.notes.map(t => li('ok', t))]; if (all.length) h += `<ul class="warns jn-warns">${all.join('')}</ul>`; }
  return h;
}
function openJoineryTool(opt = {}){
  const inst = opt.instId ? getEl(opt.instId) : null, srcId = inst ? inst.fam : opt.famId, srcF = srcId ? fam(srcId) : null;
  const sp = jnSpec(opt.spec || srcF?.join || {});
  if (inst && srcF?.join){ const s = famScope(srcF, inst); sp.w = s.w; sp.h = s.h; if (s.sill != null && (sp.kind === 'fen' || sp.kind === 'fixe')) sp.sill = s.sill; }
  let nameAuto = !srcF?.join || srcF.nom === joineryName(srcF.join), name = srcF?.join ? srcF.nom : joineryName(sp), F = null, perf = null, chk = null;
  const cm = v => Math.round(v * 100), isDoor = () => sp.kind === 'pi' || sp.kind === 'pe';
  const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([k, n]) => `<option value="${esc(k)}"${String(k) === String(cur) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  const fld = (label, inner, wide) => `<label class="f${wide ? ' wide' : ''}"><span>${label}</span><span class="in">${inner}</span></label>`;
  const numf = (id, v, unit, step = 1) => `<input id="${id}" type="number" step="${step}" inputmode="decimal" value="${v}"><em>${unit}</em>`;
  const chk1 = (id, label, on) => `<label class="f wide rchk"><input type="checkbox" id="${id}"${on ? ' checked' : ''}> ${label}</label>`;
  const stdList = () => (JN_STD[sp.kind] || {})[sp.n] || [];
  const stdCur = () => { const i = stdList().findIndex(([a, b]) => a === cm(sp.w) && b === cm(sp.h)); return i < 0 ? 'custom' : String(i); };
  const form = () => {
    const door = isDoor(), win = !door, kindBtns = Object.entries(JN_KINDS).map(([k, n]) => `<button type="button" data-jk="${k}" class="${sp.kind === k ? 'on' : ''}">${n}</button>`).join('');
    let h = `<h4>Type</h4><div class="seg jn-seg">${kindBtns}</div>
      <h4>Dimensions</h4><div class="fields">
      ${fld('Dimension courante', sel('jnStd', [['custom', 'Sur mesure'], ...stdList().map(([a, b], i) => [i, `${a} × ${b} cm`])], stdCur()), true)}
      ${fld('Largeur', numf('jnW', cm(sp.w), 'cm'))}${fld('Hauteur', numf('jnH', cm(sp.h), 'cm'))}
      ${sp.kind === 'fen' || sp.kind === 'fixe' ? fld('Allège (sol → bas de la fenêtre)', numf('jnSill', cm(sp.sill), 'cm')) : ''}
      ${JN_N[sp.kind].length > 1 ? fld('Vantaux', sel('jnN', JN_N[sp.kind].map(n => [n, `${n} vanta${n > 1 ? 'ux' : 'il'}`]), sp.n)) : ''}
      </div><h4>Cadre et ouverture</h4><div class="fields">
      ${fld('Cadre', sel('jnFrame', Object.entries(JN_FRAMES).map(([k, f]) => [k, f.nom]), sp.frame), true)}`;
    if (sp.kind === 'fen') h += fld('Ouverture', sel('jnOpen', Object.entries(JN_OPENS), sp.open), true);
    if (sp.kind === 'pi') h += fld('Ouverture', sel('jnOpen', [['fr', 'Battante'], ['coul', 'Coulissante en applique']], sp.open), true);
    if ((win && sp.kind !== 'coul' && sp.kind !== 'fixe' && sp.open !== 'fixe') || (door && sp.open !== 'coul')) h += fld(door ? 'Gonds (vu de l\'intérieur)' : 'Gonds (vu de l\'intérieur)', sel('jnHinge', [['g', 'À gauche'], ['d', 'À droite']], sp.hinge));
    if (door && sp.open !== 'coul') h += fld('Sens', sel('jnSwing', [['in', 'Ouvre vers l\'intérieur'], ['out', 'Ouvre vers l\'extérieur']], sp.swing));
    if (door) h += fld('Vantail', sel('jnLeaf', Object.entries(JN_LEAVES[sp.kind]).map(([k, l]) => [k, l.nom]), sp.leaf), true);
    if (sp.kind === 'pe') h += fld('Tierce vitrée (largeur)', numf('jnTierce', cm(sp.tierce || 0), 'cm')) + fld('Imposte vitrée (hauteur)', numf('jnImp', cm(sp.imposte || 0), 'cm'));
    if (sp.kind === 'pi') h += fld('Imposte vitrée (hauteur)', numf('jnImp', cm(sp.imposte || 0), 'cm'));
    if (sp.kind === 'pe') h += chk1('jnIso', 'Vantail à isolation renforcée (mousse, Ud −25 %)', sp.iso);
    if (door) h += fld('Résistance au feu', sel('jnFire', [['', 'Sans classement'], ['E30', 'E 30 (pare-flammes ½ h)'], ['EI30', 'EI 30 (coupe-feu ½ h)'], ['EI60', 'EI 60 (coupe-feu 1 h)']], sp.fire || ''), true);
    h += `</div>`;
    const glz = win || sp.leaf === 'vitree' || sp.leaf === 'atelier' || (sp.tierce || 0) > 0.2 || (sp.imposte || 0) > 0.15;
    if (glz){ const g = sp.glz; h += `<h4>Vitrage</h4><div class="fields">
      ${fld('Vitrage', sel('jnGt', [['simple', 'Simple'], ['double', 'Double'], ['triple', 'Triple']], g.t))}${g.t !== 'simple' ? fld('Gaz', sel('jnGas', [['air', 'Air'], ['argon', 'Argon'], ['krypton', 'Krypton']], g.gas)) : ''}
      ${fld('Acoustique', sel('jnAc', [['std', 'Courant'], ['renf', 'Renforcé (verre épais)'], ['acou', 'Acoustique (feuilleté silence)']], g.ac))}${fld('Sécurité', sel('jnSaf', [['std', 'Recuit (ordinaire)'], ['tremp', 'Trempé'], ['feuil', 'Feuilleté']], g.saf))}
      ${g.t !== 'simple' ? chk1('jnLe', 'Faible émissivité (FE)', g.le) : ''}${chk1('jnSol', 'Contrôle solaire', g.sol)}${g.t !== 'simple' ? chk1('jnWe', 'Intercalaire isolant (warm edge)', g.we !== false) : ''}
      ${win ? fld('Petits bois', `<input id="jnBh" type="number" min="0" max="6" step="1" value="${sp.bars?.h | 0}" aria-label="Horizontaux"><em>h</em><input id="jnBv" type="number" min="0" max="6" step="1" value="${sp.bars?.v | 0}" aria-label="Verticaux"><em>v</em>`) : ''}
      ${sp.kind === 'fen' || sp.kind === 'fixe' ? chk1('jnAppui', 'Appui extérieur et tablette intérieure', sp.appui !== false) : ''}</div>`; }
    return h;
  };
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Menuiserie${inst ? ' · modification' : ' sur mesure'}</span><input class="ed-name" id="jnName" value="${esc(name)}" aria-label="Nom de la menuiserie"></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body fm"><section class="fm-l" id="jnForm"></section><section class="fm-r"><canvas id="jnCv" class="fm-cv jn-cv"></canvas><div id="jnPerf"></div></section></div>
    <footer class="ed-f"><label class="f rchk" style="margin-right:auto"><input type="checkbox" id="jnLib"> Ajouter à ma bibliothèque</label><button class="btn" data-close>Annuler</button>${inst ? '<button class="btn primary" id="jnApply">Appliquer</button>' : '<button class="btn" id="jnSave">Enregistrer seulement</button><button class="btn primary" id="jnPlace">Poser dans un mur</button>'}</footer>`, 'wide');
  famPrev = makeFamPreview(d.querySelector('#jnCv'));
  const refresh = () => {
    F = joineryFamily(sp, {nom:name}); perf = joineryPerfSpec(sp); chk = joineryCheck(sp, perf);
    if (nameAuto){ name = joineryName(sp); d.querySelector('#jnName').value = name; F.nom = name; }
    try { fxCache.clear(); famPrev.show(F, famScope(F, {type:0, params:{}})); } catch(e){ console.warn('aperçu menuiserie', e); }
    d.querySelector('#jnPerf').innerHTML = jnPerfHTML(perf, chk);
    const go = d.querySelector('#jnPlace') || d.querySelector('#jnApply'); if (go) go.disabled = chk.errors.length > 0;
  };
  const all = () => { d.querySelector('#jnForm').innerHTML = form(); refresh(); };
  const read = () => {
    const g = id => d.querySelector('#' + id), v = id => g(id) ? num(g(id).value) : NaN;
    if (!Number.isNaN(v('jnW')) && v('jnW') > 0) sp.w = v('jnW') / 100; if (!Number.isNaN(v('jnH')) && v('jnH') > 0) sp.h = v('jnH') / 100; if (g('jnSill') && !Number.isNaN(v('jnSill'))) sp.sill = Math.max(0, v('jnSill') / 100);
    if (g('jnN')) sp.n = +g('jnN').value; if (g('jnFrame')) sp.frame = g('jnFrame').value; if (g('jnOpen')) sp.open = g('jnOpen').value; if (g('jnHinge')) sp.hinge = g('jnHinge').value; if (g('jnSwing')) sp.swing = g('jnSwing').value;
    if (g('jnLeaf')) sp.leaf = g('jnLeaf').value; if (g('jnTierce')) sp.tierce = Math.max(0, v('jnTierce') || 0) / 100; if (g('jnImp')) sp.imposte = Math.max(0, v('jnImp') || 0) / 100; if (g('jnIso')) sp.iso = g('jnIso').checked; if (g('jnFire')) sp.fire = g('jnFire').value;
    if (g('jnGt')) sp.glz.t = g('jnGt').value; if (g('jnGas')) sp.glz.gas = g('jnGas').value; if (g('jnAc')) sp.glz.ac = g('jnAc').value; if (g('jnSaf')) sp.glz.saf = g('jnSaf').value; if (g('jnLe')) sp.glz.le = g('jnLe').checked; if (g('jnSol')) sp.glz.sol = g('jnSol').checked; if (g('jnWe')) sp.glz.we = g('jnWe').checked;
    if (g('jnBh')) sp.bars = {h:Math.max(0, Math.min(6, v('jnBh') | 0)), v:Math.max(0, Math.min(6, v('jnBv') | 0))}; if (g('jnAppui')) sp.appui = g('jnAppui').checked;
  };
  const fm = d.querySelector('#jnForm');
  fm.addEventListener('click', e => { const b = e.target.closest('[data-jk]'); if (!b) return; const k = b.dataset.jk; if (k === sp.kind) return; sp.kind = k; Object.assign(sp, JN_KIND_DEF[k]); if (k === 'fixe') sp.open = 'fixe'; else if (sp.open === 'fixe' || sp.open === 'coul' && k !== 'pi') sp.open = 'fr'; if (k === 'pf' || k === 'coul') sp.glz.saf = sp.glz.saf === 'std' ? 'tremp' : sp.glz.saf; all(); });
  fm.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'jnStd'){ if (t.value !== 'custom'){ const [a, b] = stdList()[+t.value]; sp.w = a / 100; sp.h = b / 100; } all(); return; }
    read(); if (['jnN', 'jnOpen', 'jnLeaf', 'jnGt', 'jnHinge', 'jnTierce', 'jnImp'].includes(t.id)) all(); else refresh();
  });
  fm.addEventListener('input', e => { if (['jnW', 'jnH', 'jnSill', 'jnBh', 'jnBv', 'jnTierce', 'jnImp'].includes(e.target.id)){ read(); refresh(); const s = d.querySelector('#jnStd'); if (s) s.value = stdCur(); } });
  d.querySelector('#jnName').addEventListener('input', e => { name = e.target.value.trim() || joineryName(sp); nameAuto = !e.target.value.trim(); if (F) F.nom = name; });
  const persist = (toLib) => { const fid = 'J-' + uid8(), out = JSON.parse(JSON.stringify(F)); out.nom = name; state.lib.fams[fid] = out; if (toLib){ USER_LIB.fams[fid] = JSON.parse(JSON.stringify(out)); saveUserLib(); } return fid; };
  if (!inst){
    d.querySelector('#jnSave').onclick = () => { read(); refresh(); if (chk.errors.length) return toast(chk.errors[0]); const fid = persist(true); closeEDlg(); libTab = 'fams'; libPath = [F.cat]; activeTab = 'lib'; defs.comp.fam = fid; defs.comp.type = 0; renderPanel(); toast('Menuiserie enregistrée dans ma bibliothèque'); };
    d.querySelector('#jnPlace').onclick = () => { read(); refresh(); if (chk.errors.length) return toast(chk.errors[0]); const fid = persist(d.querySelector('#jnLib').checked); closeEDlg(); defs.comp.fam = fid; defs.comp.type = 0; defs.comp.rot = 0; setTool('comp'); renderPanel(); toast('Cliquez dans un mur pour poser la menuiserie (côté où elle s\'ouvre)'); };
  } else {
    d.querySelector('#jnApply').onclick = () => {
      read(); refresh(); if (chk.errors.length) return toast(chk.errors[0]);
      const owner = libOwner('fams', inst.fam), out = JSON.parse(JSON.stringify(F)); out.nom = name; pushHist();
      if (owner === 'base'){ const fid = 'J-' + uid8(); state.lib.fams[fid] = out; if (d.querySelector('#jnLib').checked){ USER_LIB.fams[fid] = JSON.parse(JSON.stringify(out)); saveUserLib(); } inst.fam = fid; }
      else { for (const tgt of [state.lib.fams[inst.fam], USER_LIB.fams[inst.fam]].filter(Boolean)){ for (const k of Object.keys(tgt)) delete tgt[k]; Object.assign(tgt, JSON.parse(JSON.stringify(out))); } if (USER_LIB.fams[inst.fam]) saveUserLib(); }
      inst.type = 0; inst.params = {}; state.isSample = false; fxCache.clear(); closeEDlg(); rebuild(); toast(owner === 'base' ? 'Menuiserie modifiée (copie dans le projet)' : 'Menuiserie modifiée : toutes les poses de ce modèle suivent');
    };
  }
  all();
}
/* carte « Menuiserie » dans les propriétés d'une pose */
function joineryCard(el){
  const F = fam(el.fam); if (!F?.join) return '';
  const perf = joineryPerf(F, famScope(F, el)), chk = joineryCheck({...F.join, w:famScope(F, el).w, h:famScope(F, el).h, sill:famScope(F, el).sill ?? F.join.sill}, perf);
  return `<div class="grp"><h3>Menuiserie</h3>${jnPerfHTML(perf, chk)}<div class="btns tight"><button class="btn primary" data-act="jnedit">Modifier la menuiserie…</button></div></div>`;
}
/* récapitulatif des menuiseries du projet (surface, Uw moyen pondéré) */
function joineryProjectCard(){
  const rows = new Map();
  for (const el of state.els){ if (el.kind !== 'inst' || !el.host) continue; const F = fam(el.fam); if (!F?.join) continue; const s = famScope(F, el), p = joineryPerf(F, s), a = s.w * s.h;
    const k = el.fam, r = rows.get(k) || {nom:F.nom, n:0, a:0, uwa:0, swa:0, rw:p.Rw, interior:p.interior, fire:p.fire}; r.n++; r.a += a; r.uwa += p.Uw * a; r.swa += p.Sw * a; rows.set(k, r); }
  if (!rows.size) return '';
  const ext = [...rows.values()].filter(r => !r.interior), A = ext.reduce((s, r) => s + r.a, 0), Uw = A ? ext.reduce((s, r) => s + r.uwa, 0) / A : 0;
  return `<div class="grp"><h3>Menuiseries</h3>${A ? `<div class="perf"><div class="pc"><span>Surface de baies</span><b>${nf(A, 1)}</b><em>m² · ${ext.reduce((s, r) => s + r.n, 0)} menuiserie${ext.length > 1 ? 's' : ''}</em></div><div class="pc ${Uw <= 1.3 ? 'g-ok' : 'g-bad'}"><span>Uw moyen</span><b>${nf(Uw, 2)}</b><em>W/m²·K (objectif ≤ 1,3)</em></div></div>` : ''}
    <table class="tbl rooms"><thead><tr><th>Modèle</th><th class="num">Nb</th><th class="num">Uw</th><th class="num">Rw</th></tr></thead><tbody>${[...rows.values()].map(r => `<tr><td>${esc(r.nom)}${r.fire ? ` <span class="tag">${esc(r.fire)}</span>` : ''}</td><td class="num">${r.n}</td><td class="num">${r.interior ? '—' : nf(r.uwa / r.a, 2)}</td><td class="num">${r.rw}</td></tr>`).join('')}</tbody></table></div>`;
}
/* symbole de battement des portes en plan (quart de cercle depuis les gonds) */
let doorMarks = null;
function buildDoorMarks(){
  if (!doorMarks){ doorMarks = new THREE.Group(); doorMarks.name = 'battements'; scene.add(doorMarks); }
  disposeGroup(doorMarks); if (view !== '2d' || !state?.els) return;
  const mat = new THREE.LineBasicMaterial({color:0x4B5563, depthTest:false, transparent:true, opacity:0.8});
  for (const el of state.els){
    if (el.kind !== 'inst' || !el.host || el.lvl !== curLvl) continue; const F = fam(el.fam); if (!F?.join || (F.join.kind !== 'pi' && F.join.kind !== 'pe' && F.join.kind !== 'pf') || F.join.open === 'coul') continue;
    const fr = instFrame(el); if (!fr) continue; const s = famScope(F, el), sp = F.join, n = Math.max(1, sp.n | 0), fw = s.fw ?? 0.06;
    const dir = [Math.cos(fr.ang), Math.sin(fr.ang)], nrm = [-dir[1], dir[0]], z = lvlZ(el.lvl) + (el.off || 0) + 0.04;
    const leaves = n === 2 ? [['d', (s.w - 2 * fw) / 2], ['g', (s.w - 2 * fw) / 2]] : [[sp.hinge, s.w - 2 * fw]];
    for (const [hg, lw] of leaves){
      const hx = (hg === 'd' ? -1 : 1) * (s.w / 2 - fw) * fr.sx, sgn = (hg === 'd' ? 1 : -1) * fr.sx, sw = (sp.swing === 'out' ? -1 : 1) * fr.sy;
      const H = V.add(fr.o, V.mul(dir, hx)), pts = [];
      for (let i = 0; i <= 16; i++){ const a = i / 16 * Math.PI / 2; pts.push(V.add(H, V.add(V.mul(dir, sgn * lw * Math.cos(a)), V.mul(nrm, sw * lw * Math.sin(a))))); }
      const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], z, -p[1]))); const l = new THREE.Line(g, mat); l.renderOrder = 9; doorMarks.add(l);
      const tip = pts[pts.length - 1], g2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(H[0], z, -H[1]), new THREE.Vector3(tip[0], z, -tip[1])]); const l2 = new THREE.Line(g2, mat); l2.renderOrder = 9; doorMarks.add(l2);
    }
  }
  dirty = true;
}
