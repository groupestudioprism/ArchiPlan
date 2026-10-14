/* ============ Calculs de paroi : thermique, inertie, acoustique, hygrométrie, carbone ============
   Méthodes simplifiées et indicatives (pré-dimensionnement) :
   - Résistance et coefficient U : EN ISO 6946 (sans ponts thermiques ni fixations).
   - Inertie : EN ISO 13786 (méthode des matrices de transfert, période 24 h) → déphasage, amortissement, capacité surfacique.
   - Acoustique : loi de masse expérimentale (EN 12354-1, annexe B) et système masse-ressort-masse pour les doubles parois.
   - Hygrométrie : méthode de Glaser (régime permanent, conditions d'hiver), facteur Sd et règle du facteur 5.
   - Carbone : production (A1-A3) à partir de valeurs génériques. */
const RS = { // résistances superficielles intérieure / extérieure (m²·K/W)
  mur:        {si:0.13, se:0.04, label:'Mur (flux horizontal)'},
  toiture:    {si:0.10, se:0.04, label:'Toiture (flux ascendant)'},
  plancherBas:{si:0.17, se:0.04, label:'Plancher bas sur extérieur ou vide sanitaire (flux descendant)'},
  plancherInt:{si:0.17, se:0.17, label:'Plancher intermédiaire (local chauffé des deux côtés)'},
  terrePlein: {si:0.17, se:0.00, label:'Dallage sur terre-plein (approché)'},
};
const PHYS_T = 86400;
const C = { // nombres complexes
  m:(a,b) => [a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]], a:(a,b) => [a[0]+b[0], a[1]+b[1]], s:(a,b) => [a[0]-b[0], a[1]-b[1]],
  abs:a => Math.hypot(a[0], a[1]), arg:a => Math.atan2(a[1], a[0]), div:(a,b) => { const d = b[0]*b[0]+b[1]*b[1]; return [(a[0]*b[0]+a[1]*b[1])/d, (a[1]*b[0]-a[0]*b[1])/d]; },
};
const mm2 = (A,B) => [[C.a(C.m(A[0][0],B[0][0]), C.m(A[0][1],B[1][0])), C.a(C.m(A[0][0],B[0][1]), C.m(A[0][1],B[1][1]))],
                      [C.a(C.m(A[1][0],B[0][0]), C.m(A[1][1],B[1][0])), C.a(C.m(A[1][0],B[0][1]), C.m(A[1][1],B[1][1]))]];
let matResolver = id => MATS[id];
const matOf = id => matResolver(id) || {nom:id, rho:1000, lambda:1, c:1000, mu:10, gwp:0};
const layerR = (m, e) => m.R != null ? m.R : e / m.lambda;
const sdOf = (m, e) => m.R != null ? e * 1 : m.mu * e;          // épaisseur d'air équivalente (m)
const psat = t => t >= 0 ? 610.5 * Math.exp(17.269*t/(237.3+t)) : 610.5 * Math.exp(21.875*t/(265.5+t));

/* layers : [[mat, e], ...] du côté INTÉRIEUR vers l'EXTÉRIEUR */
function thermal(layers, ctx = 'mur'){
  const rs = RS[ctx] || RS.mur; let R = rs.si + rs.se; const parts = [];
  for (const [id, e] of layers){ const r = layerR(matOf(id), e); parts.push(r); R += r; }
  return {R, Rp:R - rs.si - rs.se, U:1/R, si:rs.si, se:rs.se, parts};
}
function dynamicISO13786(layers, ctx = 'mur'){
  const rs = RS[ctx] || RS.mur, res = r => [[[1,0],[-r,0]],[[0,0],[1,0]]];
  let Z = res(rs.si);   // côté intérieur (1)
  for (const [id, e] of layers){
    const m = matOf(id); let L;
    if (m.R != null || e <= 0) L = res(m.R != null ? m.R : 0);
    else {
      const d = Math.sqrt(m.lambda * PHYS_T / (Math.PI * m.rho * m.c)), x = e / d;
      const ch = Math.cosh(x), sh = Math.sinh(x), co = Math.cos(x), si = Math.sin(x);
      const z11 = [ch*co, sh*si];
      const k12 = -d / (2*m.lambda), z12 = [k12*(sh*co + ch*si), k12*(ch*si - sh*co)];
      const k21 = -m.lambda / d, z21 = [k21*(sh*co - ch*si), k21*(sh*co + ch*si)];
      L = [[z11, z12], [z21, z11]];
    }
    Z = mm2(L, Z);
  }
  Z = mm2(res(rs.se), Z);
  const Y12 = C.div([-1,0], Z[0][1]);
  const U = thermal(layers, ctx).U;
  let dt = PHYS_T/(2*Math.PI) * C.arg(Y12) / 3600; dt = ((-dt % 24) + 24) % 24;
  const k1 = PHYS_T/(2*Math.PI) * C.abs(C.div(C.s(Z[0][0], [1,0]), Z[0][1]));   // capacité thermique surfacique côté intérieur κ1
  return {Y12:C.abs(Y12), f:C.abs(Y12)/U, phase:dt, kappa1:k1/1000};
}
function acoustic(layers){
  // feuilles « lourdes » séparées par un isolant souple (fibreux) → système masse-ressort-masse
  let m = 0; const leaves = []; let cur = 0, cav = 0, gap = 0;
  const soft = id => ['laine','laineVerre','fibreBoisS','ouate','chanvre','laineMouton','paille','airNV','airFV'].includes(id);
  for (const [id, e] of layers){
    const mt = matOf(id), ms = (mt.R != null ? 0 : mt.rho) * e; m += ms;
    if (soft(id)){ if (cur > 0){ leaves.push(cur); cur = 0; } gap += e; cav = Math.max(cav, gap); }
    else { if (gap > 0 && leaves.length) {} cur += ms; gap = 0; }
  }
  if (cur > 0) leaves.push(cur);
  const law = mm => mm >= 150 ? 37.5*Math.log10(mm) - 42 : Math.max(0, 12.4*Math.log10(Math.max(mm, 1)) + 12.6);
  let Rw = law(m), f0 = null, kind = 'Paroi simple (loi de masse)';
  if (leaves.length >= 2 && cav >= 0.02){
    const m1 = leaves[0], m2 = leaves[leaves.length - 1];
    f0 = 60 * Math.sqrt((1/m1 + 1/m2) / cav);
    const raw = 20*Math.log10(Math.max(1, 100/f0)) + 8 + 8*Math.log10(cav/0.05 + 1);
    const bonus = Math.max(0, Math.min(m1 + m2 > 150 ? 12 : 22, (m1 + m2 > 150 ? 0.5 : 1) * raw));   // doublage d'une paroi lourde : gain plus faible
    Rw = law(m1 + m2) + bonus; kind = 'Double paroi (masse-ressort-masse)';
  }
  return {m, Rw:Math.round(Math.max(0, Rw)), f0, kind, leaves:leaves.length};
}
function glaser(layers, ctx = 'mur', cond = {ti:20, hi:0.5, te:-5, he:0.8}){
  const th = thermal(layers, ctx), pi = cond.hi * psat(cond.ti), pe = cond.he * psat(cond.te);
  let sdTot = 0; for (const [id, e] of layers) sdTot += sdOf(matOf(id), e);
  const pts = []; let Rc = th.si, sdc = 0, x = 0;
  const T = R => cond.ti - (cond.ti - cond.te) * R / th.R;
  pts.push({x:0, t:T(Rc), ps:psat(T(Rc)), p:pi, name:'Surface intérieure'});
  layers.forEach(([id, e], i) => {
    const m = matOf(id); Rc += layerR(m, e); sdc += sdOf(m, e); x += e;
    const t = T(Rc), p = pi - (pi - pe) * (sdTot ? sdc/sdTot : 0);
    pts.push({x, t, ps:psat(t), p, name:i === layers.length-1 ? 'Surface extérieure' : `Interface ${i+1}/${i+2}`});
  });
  const risk = pts.filter(q => q.p > q.ps * 1.0001);
  // facteur 5 : Sd des couches côté intérieur de l'isolant principal / Sd côté extérieur
  let iIns = -1, rMax = 0; layers.forEach(([id, e], i) => { const r = layerR(matOf(id), e); if (r > rMax){ rMax = r; iIns = i; } });
  let sdIn = 0, sdOut = 0; layers.forEach(([id, e], i) => { const s = sdOf(matOf(id), e); if (i < iIns) sdIn += s; else if (i > iIns) sdOut += s; });
  return {pts, risk, cond, pi, pe, sdTot, sdIn, sdOut, ratio:sdOut > 0 ? sdIn/sdOut : Infinity, insul:iIns};
}
function wallReport(layers, ctx = 'mur'){
  const th = thermal(layers, ctx), dyn = dynamicISO13786(layers, ctx), ac = acoustic(layers), gl = glaser(layers, ctx);
  let mass = 0, T = 0, co2 = 0; for (const [id, e] of layers){ const m = matOf(id), mm = (m.R != null ? 0 : m.rho) * e; mass += mm; T += e; co2 += mm * (m.gwp || 0); }
  return {th, dyn, ac, gl, mass, T, co2};
}
/* Classement indicatif du U (repères RE2020 / rénovation) */
/* Repères ajustés au lieu du projet (zone climatique, altitude : voir 65-site.js) */
function uGradeLimits(ctx){
  const base = ctx === 'toiture' ? [0.12, 0.17, 0.25] : ctx === 'plancherBas' || ctx === 'terrePlein' ? [0.15, 0.20, 0.27] : [0.17, 0.22, 0.30];
  let f = 1; try { f = typeof siteFactor === 'function' ? siteFactor() : 1; } catch(e){}
  return base.map(v => Math.round(v * f * 1000) / 1000);
}
function uGrade(U, ctx){
  const lim = uGradeLimits(ctx);
  return U <= lim[0] ? {g:'A', t:'Très performant (niveau passif)'} : U <= lim[1] ? {g:'B', t:'Performant (neuf RE2020)'} : U <= lim[2] ? {g:'C', t:'Correct (rénovation)'} : {g:'D', t:'Insuffisant : renforcer l\'isolation'};
}
