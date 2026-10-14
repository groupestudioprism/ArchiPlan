/* ============ Utilitaires ============ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const nf = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('fr-FR', {minimumFractionDigits:d, maximumFractionDigits:d});
const n0 = x => Math.round(x).toLocaleString('fr-FR');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = s => { const v = parseFloat(String(s).trim().replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const uid8 = () => Math.random().toString(36).slice(2, 6) + Date.now().toString(36).slice(-4);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const V = {
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1]], add:(a,b)=>[a[0]+b[0],a[1]+b[1]], mul:(a,k)=>[a[0]*k,a[1]*k], dot:(a,b)=>a[0]*b[0]+a[1]*b[1],
  len:a=>Math.hypot(a[0],a[1]), cross:(a,b)=>a[0]*b[1]-a[1]*b[0], dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),
  norm:a=>{ const l = Math.hypot(a[0],a[1]) || 1; return [a[0]/l, a[1]/l]; }, perp:a=>[-a[1], a[0]],
  rot:(a,ang)=>[a[0]*Math.cos(ang)-a[1]*Math.sin(ang), a[0]*Math.sin(ang)+a[1]*Math.cos(ang)], lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t],
};
let toastT;
function toast(msg, ms = 3200){ const t = $('#toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }
function segClosest(p, a, b){ const d = V.sub(b, a), L2 = V.dot(d, d) || 1e-12; const t = clamp(V.dot(V.sub(p, a), d) / L2, 0, 1); return {pt:V.add(a, V.mul(d, t)), t}; }
function segInter(a, b, c, d){
  const r = V.sub(b, a), s = V.sub(d, c), den = V.cross(r, s); if (Math.abs(den) < 1e-9) return null;
  const t = V.cross(V.sub(c, a), s) / den, u = V.cross(V.sub(c, a), r) / den;
  return t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 ? V.add(a, V.mul(r, t)) : null;
}
/* polylignes */
const plLen = p => { let L = 0; for (let i = 1; i < p.length; i++) L += V.dist(p[i - 1], p[i]); return L; };
function plClosest(p, q){ // point le plus proche de q sur la polyligne p → {pt, d, i (segment), t, s (abscisse)}
  let best = {d:Infinity}, s = 0;
  for (let i = 0; i + 1 < p.length; i++){ const c = segClosest(q, p[i], p[i + 1]), d = V.dist(c.pt, q), L = V.dist(p[i], p[i + 1]); if (d < best.d) best = {pt:c.pt, d, i, t:c.t, s:s + L * c.t}; s += L; }
  return best;
}
function plAt(p, s){ // point et direction à l'abscisse s
  for (let i = 0; i + 1 < p.length; i++){ const L = V.dist(p[i], p[i + 1]); if (s <= L || i + 2 === p.length){ const t = L ? clamp(s / L, 0, 1) : 0; return {pt:V.lerp(p[i], p[i + 1], t), dir:V.norm(V.sub(p[i + 1], p[i])), i}; } s -= L; }
  return {pt:p[0] || [0, 0], dir:[1, 0], i:0};
}
function plOffset(p, o){ // décalage latéral (gauche > 0)
  const out = [];
  for (let i = 0; i < p.length; i++){
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], d0 = i > 0 ? V.norm(V.sub(p[i], p[i - 1])) : null, d1 = i + 1 < p.length ? V.norm(V.sub(p[i + 1], p[i])) : null;
    let n; if (d0 && d1){ const m = V.norm(V.add(d0, d1)); n = V.perp(m); const k = 1 / Math.max(0.35, V.dot(n, V.perp(d0))); n = V.mul(n, Math.min(k, 3)); } else n = V.perp(d0 || d1 || V.norm(V.sub(b, a)));
    out.push(V.add(p[i], V.mul(n, o)));
  }
  return out;
}
function plSlice(p, s0, s1){ // portion de polyligne entre deux abscisses
  const out = []; let s = 0;
  for (let i = 0; i + 1 < p.length; i++){
    const L = V.dist(p[i], p[i + 1]), a = s, b = s + L;
    if (b >= s0 && a <= s1){ if (!out.length) out.push(V.lerp(p[i], p[i + 1], L ? clamp((s0 - a) / L, 0, 1) : 0)); if (b <= s1) out.push(p[i + 1]); else { out.push(V.lerp(p[i], p[i + 1], L ? clamp((s1 - a) / L, 0, 1) : 1)); break; } }
    s = b;
  }
  return out;
}
const ringArea = p => { let a = 0; for (let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
function inPoly(x, y, p){ let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++){ const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const centroid = p => { const n = p.length || 1; return [p.reduce((a, q) => a + q[0], 0) / n, p.reduce((a, q) => a + q[1], 0) / n]; };
function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fmtM = m => m < 1000 ? `${nf(m, m < 10 ? 2 : 1)} m` : `${nf(m / 1000, 2)} km`;
const fmtDur = s => s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.floor(s / 3600)} h ${String(Math.round(s % 3600 / 60)).padStart(2, '0')}`;
async function downloadBlob(blob, name){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safeName = s => String(s || 'chantier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'chantier';
/* petit cache persistant (IndexedDB) : données de carte d'une zone, maquettes importées */
const IDB = {
  db:null,
  open(){ return this.db ??= new Promise((res, rej) => { try { const r = indexedDB.open('architrafic', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch(e){ rej(e); } }); },
  async get(k){ try { const db = await this.open(); return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch(e){ return undefined; } },
  async set(k, v){ try { const db = await this.open(); await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch(e){} },
};
