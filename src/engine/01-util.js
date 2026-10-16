/* ============ Utilitaires ============ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const NF_CACHE = new Map(), nfmt = d => { let f = NF_CACHE.get(d); if (!f) NF_CACHE.set(d, f = new Intl.NumberFormat('fr-FR', {minimumFractionDigits:d, maximumFractionDigits:d})); return f; };   // un formateur par précision (toLocaleString en recrée un à chaque appel)
const NF0 = new Intl.NumberFormat('fr-FR');
const nf = (x, d = 2) => nfmt(d).format(Math.round(x * 10 ** d) / 10 ** d);
const n0 = x => NF0.format(Math.round(x));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = s => { const v = parseFloat(String(s).trim().replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
const rnd = x => Math.round(x * 1e5) / 1e5;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const uid8 = () => Math.random().toString(36).slice(2, 6) + Date.now().toString(36).slice(-4);
const V = {
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1]], add:(a,b)=>[a[0]+b[0],a[1]+b[1]], mul:(a,k)=>[a[0]*k,a[1]*k], dot:(a,b)=>a[0]*b[0]+a[1]*b[1],
  len:a=>Math.hypot(a[0],a[1]), cross:(a,b)=>a[0]*b[1]-a[1]*b[0], eq:(a,b)=>Math.abs(a[0]-b[0])<1e-4&&Math.abs(a[1]-b[1])<1e-4,
  norm:a=>{ const l = Math.hypot(a[0],a[1]) || 1; return [a[0]/l, a[1]/l]; }, rot:(a,ang)=>[a[0]*Math.cos(ang)-a[1]*Math.sin(ang), a[0]*Math.sin(ang)+a[1]*Math.cos(ang)],
};
let toastT;
/* Appareil tactile sans souris ni pavé (téléphone, tablette) : les consignes parlent du doigt, pas de la souris */
const MQ_COARSE = matchMedia('(pointer: coarse)'), MQ_FINE = matchMedia('(any-pointer: fine)');
const touchOnly = () => MQ_COARSE.matches && !MQ_FINE.matches;
const TOUCH_TXT = [
  [/ \(Maj pour en ajouter\)/g, ' (appui long pour en ajouter)'],
  [/Clic droit : déplacer la vue, ou tourner autour de l'élément sélectionné\./g, 'Glissez pour tourner, deux doigts pour déplacer et zoomer.'],
  [/\(Échap pour finir\)/g, '(bouton Terminer pour finir)'],
  [/([Cc])liquez (sur|dans) un mur/g, (m, c) => (c === 'C' ? 'T' : 't') + 'ouchez un mur'],
  [/([Cc])liquez sur /g, (m, c) => (c === 'C' ? 'T' : 't') + 'ouchez '],
  [/([Cc])liquez/g, (m, c) => (c === 'C' ? 'T' : 't') + 'ouchez'],
  [/([Ss])urvolez/g, (m, c) => (c === 'S' ? 'T' : 't') + 'ouchez'],
  [/\(clic ou degrés\)/g, '(toucher ou degrés)'],
];
const forTouch = s => { if (typeof s !== 'string' || !touchOnly()) return s; for (const [a, b] of TOUCH_TXT) s = s.replace(a, b); return s; };
function toast(msg){ const t = $('#toast'); if (!t) return; t.textContent = forTouch(msg); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }
function segClosest(p, a, b){ const d = V.sub(b, a), L2 = V.dot(d, d) || 1e-12; const t = clamp(V.dot(V.sub(p, a), d) / L2, 0, 1); return {pt:V.add(a, V.mul(d, t)), t}; }
function segInter(a, b, c, d){ // intersection de deux segments (ou null)
  const r = V.sub(b, a), s = V.sub(d, c), den = V.cross(r, s); if (Math.abs(den) < 1e-9) return null;
  const t = V.cross(V.sub(c, a), s) / den, u = V.cross(V.sub(c, a), r) / den;
  return t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 ? V.add(a, V.mul(r, t)) : null;
}
