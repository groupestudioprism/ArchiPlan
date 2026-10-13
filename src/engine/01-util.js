/* ============ Utilitaires ============ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const nf = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('fr-FR', {minimumFractionDigits:d, maximumFractionDigits:d});
const n0 = x => Math.round(x).toLocaleString('fr-FR');
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
function toast(msg){ const t = $('#toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }
function segClosest(p, a, b){ const d = V.sub(b, a), L2 = V.dot(d, d) || 1e-12; const t = clamp(V.dot(V.sub(p, a), d) / L2, 0, 1); return {pt:V.add(a, V.mul(d, t)), t}; }
function segInter(a, b, c, d){ // intersection de deux segments (ou null)
  const r = V.sub(b, a), s = V.sub(d, c), den = V.cross(r, s); if (Math.abs(den) < 1e-9) return null;
  const t = V.cross(V.sub(c, a), s) / den, u = V.cross(V.sub(c, a), r) / den;
  return t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 ? V.add(a, V.mul(r, t)) : null;
}
