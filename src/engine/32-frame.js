/* ============ Charpente bois d'une toiture : traditionnelle (pannes + chevrons) ou fermettes industrielles ============
   Générée automatiquement d'après la toiture (règles courantes : entraxe 60 cm, panne intermédiaire dès 3 m de rampant,
   arêtiers sur les croupes, sablières sur les murs) ; réglable et modifiable à la main dans la fenêtre « Charpente »
   (sections, entraxe, type ; pièces retirées une à une : el.frame.off). Les pièces sont comptées au DQE (lot 03). */
const FRAME_DEF = {mode:'auto', kind:'trad', sp:0.6, chev:[0.063, 0.15], panne:[0.075, 0.225], faitiere:[0.1, 0.25], sabliere:[0.075, 0.175], arretier:[0.075, 0.225], ferm:[0.036, 0.097], purlin:3.0};
const FRAME_NAMES = {sabliere:'Sablière', faitiere:'Faîtière', panne:'Panne intermédiaire', chevron:'Chevron', arretier:'Arêtier', arbal:'Arbalétrier (fermette)', entrait:'Entrait (fermette)', diag:'Diagonale (fermette)'};
const frameOpts = el => ({...FRAME_DEF, ...(el.frame || {})});
/* Coupe d'un polygone plan convexe par la droite {x : dot(x, n) = s} → segment [A, B] (ou null) */
function cutPoly(poly, n, s){
  const pts = [];
  for (let i = 0; i < poly.length; i++){ const a = poly[i], b = poly[(i + 1) % poly.length], da = a[0] * n[0] + a[1] * n[1] - s, db = b[0] * n[0] + b[1] * n[1] - s;
    if (Math.abs(da) < 1e-9) pts.push(a); else if (da * db < 0){ const t = da / (da - db); pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
  if (pts.length < 2) return null;
  const c = [-n[1], n[0]]; pts.sort((p, q) => (p[0] * c[0] + p[1] * c[1]) - (q[0] * c[0] + q[1] * c[1]));
  const A = pts[0], B = pts[pts.length - 1]; return Math.hypot(B[0] - A[0], B[1] - A[1]) > 0.05 ? [A, B] : null;
}
function planeOf(P){ // z = a x + b y + c d'après 3 points du pan
  const [p, q, r] = P, ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (Math.abs(nz) < 1e-9) return null;
  return {a:-nx / nz, b:-ny / nz, c:p[2] + (nx * p[0] + ny * p[1]) / nz, z(x, y){ return this.a * x + this.b * y + this.c; }};
}
function roofFrame(el){
  const O = frameOpts(el); if (O.mode === 'none' || (el.shape || '2') === '0') return [];
  const G = roofGeom(el), out = [], off = new Set(O.off || []);
  const add = (kind, A, B, sec) => { const id = `${kind}:${A.map(v => v.toFixed(2)).join(',')}:${B.map(v => v.toFixed(2)).join(',')}`; out.push({id, kind, A, B, w:sec[0], h:sec[1], off:off.has(id)}); };
  for (const W of G.wings){
    const P = (u, v, z) => W.ax ? [u, v, z] : [v, u, z], und = z => z - W.Tv;   // sous-face de la couverture
    const fermettes = O.kind === 'fermettes' && (el.shape || '2') === '2';
    // sablières sur les murs gouttereaux
    for (const v of (el.shape === '1' ? [W.V0] : [W.V0, W.V1])) add('sabliere', P(W.U0, v, W.base), P(W.U1, v, W.base), O.sabliere);
    if (fermettes){
      const n = Math.max(1, Math.round((W.U1 - W.U0) / O.sp));
      for (let k = 0; k <= n; k++){
        const u = W.U0 + (W.U1 - W.U0) * k / n, zr = W.base + W.W / 2 * W.tp, s = O.ferm, zEo = W.base - (W.V0 - W.v0) * W.tp;
        const L = P(u, W.v0, zEo), R = P(u, W.v1, zEo), T = P(u, W.vm, zr), B1 = P(u, W.V0 + W.W / 3, W.base + s[1]), B2 = P(u, W.V0 + 2 * W.W / 3, W.base + s[1]);
        const M1 = P(u, W.V0 + W.W / 4, W.base + W.W / 4 * W.tp), M2 = P(u, W.V1 - W.W / 4, W.base + W.W / 4 * W.tp);
        add('arbal', L, T, s); add('arbal', R, T, s); add('entrait', P(u, W.V0, W.base + s[1]), P(u, W.V1, W.base + s[1]), s);
        add('diag', B1, M1, s); add('diag', B1, T, s); add('diag', B2, T, s); add('diag', B2, M2, s);
      }
      continue;
    }
    for (const [a, b] of W.ridges) add('faitiere', [a[0], a[1], und(a[2])], [b[0], b[1], und(b[2])], O.faitiere);
    for (const [a, b] of W.hips) add('arretier', [a[0], a[1], und(a[2])], [b[0], b[1], und(b[2])], O.arretier);
    for (const pan of W.pans){
      const pl = planeOf(pan); if (!pl) continue;
      const poly = pan.map(q => [q[0], q[1]]), g = Math.hypot(pl.a, pl.b); if (g < 1e-6) continue;
      const d = [pl.a / g, pl.b / g], c = [-d[1], d[0]];                 // d : sens de la montée en plan ; c : le long des courbes de niveau
      const proj = (q, n) => q[0] * n[0] + q[1] * n[1], cs = poly.map(q => proj(q, c)), ds = poly.map(q => proj(q, d));
      // chevrons : parallèles à la pente, tous les O.sp
      const c0 = Math.min(...cs), c1 = Math.max(...cs), nC = Math.max(1, Math.round((c1 - c0) / O.sp));
      for (let k = 0; k <= nC; k++){ const s = c0 + 0.03 + (c1 - c0 - 0.06) * k / nC, seg = cutPoly(poly, c, s); if (!seg) continue;
        const [A, B] = seg; add('chevron', [A[0], A[1], und(pl.z(A[0], A[1]))], [B[0], B[1], und(pl.z(B[0], B[1]))], O.chev); }
      // pannes intermédiaires : dès que le rampant (en plan, du mur au faîtage) dépasse O.purlin
      const dLo = Math.min(...ds), dHi = Math.max(...ds), run = (dHi - dLo) - Math.max(0, el.ov ?? 0.4), np = Math.max(0, Math.ceil(run / O.purlin) - 1);
      for (let k = 1; k <= np; k++){ const s = dHi - (run * k) / (np + 1), seg = cutPoly(poly, d, s); if (!seg) continue;
        const [A, B] = seg; add('panne', [A[0], A[1], und(pl.z(A[0], A[1])) - O.chev[1]], [B[0], B[1], und(pl.z(B[0], B[1])) - O.chev[1]], O.panne); }
    }
  }
  return out;
}
/* Pièce de bois : section w × h, arête supérieure le long de A→B, retombée perpendiculaire vers le bas */
function memberGeo(mb){
  const t = V3.norm(V3.sub(mb.B, mb.A)); let side = V3.cross(t, [0, 0, 1]); if (V3.len(side) < 1e-6) side = [1, 0, 0]; side = V3.norm(side);
  let down = V3.cross(side, t); if (down[2] > 0) down = V3.mul(down, -1);
  const hw = V3.mul(side, mb.w / 2), top = [V3.sub(mb.A, hw), V3.sub(mb.B, hw), V3.add(mb.B, hw), V3.add(mb.A, hw)];
  return {top, ext:V3.mul(down, mb.h), L:V3.len(V3.sub(mb.B, mb.A))};
}
const V3 = {sub:(a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add:(a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul:(a, s) => [a[0] * s, a[1] * s, a[2] * s],
  len:a => Math.hypot(a[0], a[1], a[2]), norm:a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, cross:(a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]};
function memberPiece(mb){
  const g = memberGeo(mb), poly = g.top.map(q => [q[0], q[1]]), vol = g.L * mb.w * mb.h;
  return {poly, top:g.top, ext:g.ext, base:Math.min(...g.top.map(q => q[2])) - mb.h, h:vol, vol, mat:'bois', lot:'Couverture', e:mb.h, member:mb.kind, mid:mb.id};
}
function frameQty(el){
  const by = {}; for (const m of roofFrame(el)) if (!m.off){ const L = V3.len(V3.sub(m.B, m.A)), k = `${m.kind}|${n0(m.w * 1000)}x${n0(m.h * 1000)}`; by[k] ??= {kind:m.kind, w:m.w, h:m.h, n:0, ml:0, m3:0}; by[k].n++; by[k].ml += L; by[k].m3 += L * m.w * m.h; }
  return Object.values(by);
}

/* ---------- fenêtre « Charpente » : aperçu 3D, réglages, pièces retirées au clic ---------- */
let framePrev = null;
function makeFramePreview(cv, onPick){
  const r = new THREE.WebGLRenderer({canvas:cv, antialias:true}); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(isDark() ? '#1C2027' : '#F1F3F5');
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8a7a, 1.15)); const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(-6, 10, 8); sc.add(dl);
  const cm = new THREE.PerspectiveCamera(40, 1, 0.05, 400); const oc = new OrbitControls(cm, cv); oc.enableDamping = true;
  const grp = new THREE.Group(); sc.add(grp); let raf = 0, alive = true, framed = false;
  const ray = new THREE.Raycaster(), mp = new THREE.Vector2(); let downAt = null;
  cv.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', e => { if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return; const b = cv.getBoundingClientRect(); mp.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1); ray.setFromCamera(mp, cm); const h = ray.intersectObjects(grp.children, false).find(x => x.object.userData.mid); if (h) onPick(h.object.userData.mid); });
  const loop = () => { if (!alive) return; raf = requestAnimationFrame(loop); const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * r.getPixelRatio()) || cv.height !== Math.round(h * r.getPixelRatio())){ r.setSize(w, h, false); cm.aspect = w / h; cm.updateProjectionMatrix(); } oc.update(); r.render(sc, cm); };
  loop();
  const COL = {sabliere:'#B8834F', faitiere:'#9C6B3C', panne:'#A87443', chevron:'#D7AE72', arretier:'#9C6B3C', arbal:'#D7AE72', entrait:'#C99A5E', diag:'#E2BF8A'};
  return {
    show(el){
      disposeGroup(grp);
      const wp = roofWallPoly(el), b = roofBase(el);
      const sh = new THREE.Shape(wp.map(q => new THREE.Vector2(q[0], q[1]))), fg = new THREE.ShapeGeometry(sh); fg.rotateX(-Math.PI / 2); fg.translate(0, b - 0.002, 0);
      grp.add(new THREE.Mesh(fg, new THREE.MeshStandardMaterial({color:'#C9CED4', transparent:true, opacity:0.35, side:THREE.DoubleSide})));
      for (const m of roofFrame(el)){
        const g = memberGeo(m), mesh = new THREE.Mesh(prismGeo(g.top, g.ext), new THREE.MeshStandardMaterial({color:m.off ? '#E06B5A' : COL[m.kind] || '#D7AE72', roughness:0.8, transparent:m.off, opacity:m.off ? 0.28 : 1}));
        mesh.userData.mid = m.id; grp.add(mesh);
        if (!m.off){ const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), new THREE.LineBasicMaterial({color:'#5B4630', transparent:true, opacity:0.35})); mesh.add(e); }
      }
      const bb = new THREE.Box3().setFromObject(grp); if (!bb.isEmpty()){ const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3()).length(); oc.target.copy(c); if (!framed){ cm.position.copy(c).add(new THREE.Vector3(-0.75, 0.6, 0.85).multiplyScalar(s * 1.2 + 2)); framed = true; } }
    },
    dispose(){ alive = false; cancelAnimationFrame(raf); disposeGroup(grp); oc.dispose(); r.dispose(); }
  };
}
const isDark = () => document.documentElement.dataset.theme === 'dark';
function openFrameDialog(id){
  const el = getEl(id); if (!el || el.kind !== 'roof') return;
  pushHist(); el.frame = {...FRAME_DEF, ...(el.frame || {}), off:[...(el.frame?.off || [])]};
  const secF = (k, lbl) => `<label class="f"><span>${lbl}</span><span class="in"><input data-fsec="${k}" data-i="0" type="number" step="1" min="20" max="400" value="${n0(el.frame[k][0] * 1000)}" style="width:52px"><em>×</em><input data-fsec="${k}" data-i="1" type="number" step="1" min="40" max="500" value="${n0(el.frame[k][1] * 1000)}" style="width:52px"><em>mm</em></span></label>`;
  const table = () => { const q = frameQty(el); return q.length ? `<table class="tbl"><thead><tr><th>Pièce</th><th class="n">Section</th><th class="n">Nb</th><th class="n">ml</th><th class="n">m³</th></tr></thead><tbody>${q.map(r => `<tr><td>${esc(FRAME_NAMES[r.kind] || r.kind)}</td><td class="n">${n0(r.w * 1000)}×${n0(r.h * 1000)}</td><td class="n">${r.n}</td><td class="n">${nf(r.ml, 1)}</td><td class="n">${nf(r.m3, 3)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Total bois</td><td class="n">${nf(q.reduce((s, r) => s + r.ml, 0), 1)}</td><td class="n">${nf(q.reduce((s, r) => s + r.m3, 0), 3)}</td></tr></tfoot></table>` : '<p class="hint">Pas de charpente (toiture plate ou charpente désactivée).</p>'; };
  const html = `<header class="ed-h"><div><span class="eyebrow">Toiture ${el.id} · ${esc(compo(el.type).nom)}</span><h3 class="ed-t2">Charpente</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body frm"><section class="frm-v"><canvas id="frCv"></canvas><p class="hint">Faites tourner l'aperçu ; cliquez une pièce pour la retirer (ou la remettre).</p></section>
      <section class="frm-p"><div class="fields">
        <label class="f wide"><span>Charpente</span><span class="in"><select id="frMode"><option value="auto"${el.frame.mode !== 'none' ? ' selected' : ''}>Générée d'après la toiture</option><option value="none"${el.frame.mode === 'none' ? ' selected' : ''}>Aucune (non comptée)</option></select></span></label>
        <label class="f wide"><span>Type</span><span class="in"><select id="frKind"><option value="trad"${el.frame.kind === 'trad' ? ' selected' : ''}>Traditionnelle : faîtière, pannes, chevrons</option><option value="fermettes"${el.frame.kind === 'fermettes' ? ' selected' : ''}>Fermettes industrielles en W (2 pans)</option></select></span></label>
        <label class="f"><span>Entraxe</span><span class="in"><input id="frSp" type="number" step="5" min="30" max="120" value="${n0(el.frame.sp * 100)}"><em>cm</em></span></label>
        <label class="f"><span>Panne dès un rampant de</span><span class="in"><input id="frPu" type="number" step="0.1" min="1.5" max="8" value="${el.frame.purlin}"><em>m</em></span></label>
        ${secF('chev', 'Chevrons')}${secF('panne', 'Pannes')}${secF('faitiere', 'Faîtière')}${secF('arretier', 'Arêtiers')}${secF('sabliere', 'Sablières')}${secF('ferm', 'Fermettes')}</div>
        <div class="btns tight"><button class="btn" id="frReset">Remettre toutes les pièces</button></div>
        <label class="f wide rchk" style="margin-top:6px"><input type="checkbox" id="frShow"${el.frameView ? ' checked' : ''}> Afficher la charpente dans la maquette (couverture masquée)</label>
        <div id="frTab">${table()}</div>
        <p class="hint">Règles appliquées : entraxe des chevrons ou fermettes, une panne intermédiaire par tranche de rampant, arêtiers aux croupes, sablières sur les murs gouttereaux. Sections indicatives à faire valider par le charpentier (portées, charges de neige et de vent).</p></section></div>
    <footer class="ed-f"><span class="hint">Les pièces de charpente sont comptées au DQE (lot 03).</span><button class="btn primary" data-close>Terminer</button></footer>`;
  const d = openEDlg(html, 'wide');
  const refresh = () => { framePrev?.show(el); d.querySelector('#frTab').innerHTML = table(); rebuild({noPanel:true}); };
  framePrev = makeFramePreview(d.querySelector('#frCv'), mid => { const s = new Set(el.frame.off); s.has(mid) ? s.delete(mid) : s.add(mid); el.frame.off = [...s]; refresh(); });
  framePrev.show(el);
  d.querySelector('#frMode').onchange = e => { el.frame.mode = e.target.value; refresh(); };
  d.querySelector('#frKind').onchange = e => { el.frame.kind = e.target.value; el.frame.off = []; refresh(); };
  d.querySelector('#frSp').onchange = e => { const v = num(e.target.value); if (v >= 30 && v <= 120){ el.frame.sp = v / 100; el.frame.off = []; } refresh(); };
  d.querySelector('#frPu').onchange = e => { const v = num(e.target.value); if (v >= 1.5 && v <= 8){ el.frame.purlin = v; el.frame.off = []; } refresh(); };
  d.querySelectorAll('[data-fsec]').forEach(i => i.onchange = () => { const v = num(i.value); if (v > 0){ const k = i.dataset.fsec, s = el.frame[k].slice(); s[+i.dataset.i] = v / 1000; el.frame[k] = s; } refresh(); });
  d.querySelector('#frReset').onclick = () => { el.frame.off = []; refresh(); };
  d.querySelector('#frShow').onchange = e => { el.frameView = e.target.checked; refresh(); };
  d.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { framePrev?.dispose(); framePrev = null; state.isSample = false; rebuild(); }));
}
