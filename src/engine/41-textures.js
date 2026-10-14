/* ============ Textures procédurales v2 : 512 px, bruit fractal, relief (bump), bibliothèque de motifs ============
   Chaque motif dessine une tuile carrée répétée ; `sz` = taille réelle de la tuile en mètres. Le relief (bumpMap) est tiré de
   la luminance de la tuile : joints creux, veinage, granulats. Les motifs de la v1 (40-scene.js) restent disponibles. */
const TEX_LIB = {
  // maçonnerie et béton
  brick:{nom:'Brique de parement', grp:'Maçonnerie', sz:0.5}, brickbig:{nom:'Brique alvéolaire', grp:'Maçonnerie', sz:1}, block:{nom:'Bloc béton', grp:'Maçonnerie', sz:1},
  stone:{nom:'Pierre appareillée', grp:'Maçonnerie', sz:1.2}, rubble:{nom:'Moellons', grp:'Maçonnerie', sz:1.2}, concrete:{nom:'Béton brut', grp:'Maçonnerie', sz:2},
  concreteBoard:{nom:'Béton banché (planches)', grp:'Maçonnerie', sz:1.2}, polished:{nom:'Béton ciré / résine', grp:'Maçonnerie', sz:2}, aac:{nom:'Béton cellulaire', grp:'Maçonnerie', sz:1.25},
  // enduits
  plaster:{nom:'Enduit lisse / plâtre', grp:'Enduits', sz:2}, render:{nom:'Enduit gratté', grp:'Enduits', sz:1}, roughcast:{nom:'Crépi', grp:'Enduits', sz:0.6},
  // bois
  wood:{nom:'Bois massif', grp:'Bois', sz:1}, woodpanel:{nom:'Panneau bois (CLT)', grp:'Bois', sz:1.2}, cladding:{nom:'Bardage horizontal', grp:'Bois', sz:0.6}, cladV:{nom:'Bardage vertical', grp:'Bois', sz:0.6},
  parquet:{nom:'Parquet à lames', grp:'Bois', sz:1}, herringbone:{nom:'Parquet point de Hongrie', grp:'Bois', sz:0.8}, deck:{nom:'Lames de terrasse', grp:'Bois', sz:0.75}, osb:{nom:'OSB', grp:'Bois', sz:1}, cork:{nom:'Liège', grp:'Bois', sz:0.5},
  // sols
  tile:{nom:'Carrelage 50 × 50', grp:'Sols', sz:1}, tile60:{nom:'Grès cérame 60 × 60', grp:'Sols', sz:1.2}, tile20:{nom:'Faïence 20 × 20', grp:'Sols', sz:0.4}, marble:{nom:'Marbre', grp:'Sols', sz:1.6},
  terrazzo:{nom:'Terrazzo', grp:'Sols', sz:0.8}, flagstone:{nom:'Dallage pierre', grp:'Sols', sz:1.6}, pavers:{nom:'Pavés', grp:'Sols', sz:0.6}, gravel:{nom:'Gravier', grp:'Sols', sz:0.8}, sand:{nom:'Sable', grp:'Sols', sz:1},
  grass:{nom:'Pelouse / végétal', grp:'Sols', sz:1}, earth:{nom:'Terre', grp:'Sols', sz:1.5}, fabric:{nom:'Moquette / textile', grp:'Sols', sz:0.5},
  // couverture et métal
  rooftile:{nom:'Tuiles', grp:'Couverture', sz:1}, slate:{nom:'Ardoises', grp:'Couverture', sz:0.8}, zinc:{nom:'Zinc joint debout', grp:'Couverture', sz:1.3}, ribbed:{nom:'Bac acier', grp:'Couverture', sz:1}, membrane:{nom:'Membrane', grp:'Couverture', sz:1},
  metal:{nom:'Métal brossé', grp:'Métal et verre', sz:1}, glass:{nom:'Verre', grp:'Métal et verre', sz:1}, water:{nom:'Eau', grp:'Métal et verre', sz:2},
  // isolants
  insul:{nom:'Isolant fibreux', grp:'Isolants', sz:0.6}, insulboard:{nom:'Isolant en panneau', grp:'Isolants', sz:1.2}, plain:{nom:'Uni', grp:'Isolants', sz:2},
};
// matériaux de base dont le motif v1 était approximatif
Object.assign(MATS.zinc ?? {}, {tex:'zinc'}); Object.assign(MATS.betonCire ?? {}, {tex:'polished'}); Object.assign(MATS.resine ?? {}, {tex:'polished'});
Object.assign(MATS.enduit ?? {}, {tex:'render'}); Object.assign(MATS.enduitChaux ?? {}, {tex:'render'}); Object.assign(MATS.faience ?? {}, {tex:'tile20'}); Object.assign(MATS.carrelage ?? {}, {tex:'tile60'});
Object.assign(MATS.pierreSol ?? {}, {tex:'flagstone'}); Object.assign(MATS.moellon ?? {}, {tex:'rubble'}); Object.assign(MATS.eau ?? {}, {tex:'water'}); Object.assign(MATS.liege ?? {}, {tex:'cork'});
Object.assign(MATS.betCell ?? {}, {tex:'aac'}); Object.assign(MATS.chape ?? {}, {tex:'concrete'}); Object.assign(MATS.pvcSol ?? {}, {tex:'parquet'}); Object.assign(MATS.terreVeg ?? {}, {tex:'grass'}); Object.assign(MATS.sol ?? {}, {tex:'earth'});

/* bruit de valeur fractal (périodique sur la tuile) */
function fbmField(S, R, oct = 5, base = 4){
  const out = new Float32Array(S * S);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++){
    const n = base << o, gr = new Float32Array(n * n); for (let i = 0; i < n * n; i++) gr[i] = R();
    const at = (x, y) => gr[((y % n + n) % n) * n + ((x % n + n) % n)], sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < S; y++){ const fy = y / S * n, y0 = Math.floor(fy), ty = sm(fy - y0);
      for (let x = 0; x < S; x++){ const fx = x / S * n, x0 = Math.floor(fx), tx = sm(fx - x0);
        const v = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
        out[y * S + x] += v * amp; } }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function tintField(g, S, base, field, amt, fn = v => v){
  const c = new THREE.Color(base), id = g.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < S * S; i++){ const k = 1 + (fn(field[i]) - 0.5) * amt; d[i * 4] = clamp(d[i * 4] * k, 0, 255); d[i * 4 + 1] = clamp(d[i * 4 + 1] * k, 0, 255); d[i * 4 + 2] = clamp(d[i * 4 + 2] * k, 0, 255); }
  g.putImageData(id, 0, 0); return c;
}
const TEXV2 = new Set(['render', 'roughcast', 'polished', 'concreteBoard', 'aac', 'cladV', 'herringbone', 'deck', 'cork', 'tile60', 'tile20', 'marble', 'terrazzo', 'flagstone', 'pavers', 'sand', 'rubble', 'zinc', 'water', 'wood', 'concrete', 'plaster', 'grass', 'brick', 'stone']);
function paintV2(id){
  const m = mat(id), t = m.tex || 'plain'; if (!TEXV2.has(t)) return null;
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), R = rng([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 11));
  const base = m.color; g.fillStyle = base; g.fillRect(0, 0, S, S);
  const joint = (c, w = 3) => { g.fillStyle = c; return w; };
  if (t === 'plaster' || t === 'render' || t === 'roughcast' || t === 'concrete' || t === 'polished' || t === 'sand' || t === 'aac'){
    const f = fbmField(S, R, t === 'polished' ? 4 : 6, t === 'polished' ? 2 : t === 'render' || t === 'roughcast' || t === 'sand' ? 16 : 4);
    tintField(g, S, base, f, t === 'polished' ? 0.28 : t === 'concrete' ? 0.22 : t === 'roughcast' ? 0.34 : t === 'sand' ? 0.3 : 0.1);
    if (t === 'concrete' || t === 'aac'){ for (let i = 0; i < (t === 'aac' ? 900 : 60); i++){ g.fillStyle = shade(base, -0.18 - R() * 0.1); g.globalAlpha = 0.6; g.beginPath(); g.arc(R() * S, R() * S, t === 'aac' ? 0.6 + R() * 1.6 : 1 + R() * 2.2, 0, 7); g.fill(); } g.globalAlpha = 1; }
    if (t === 'aac'){ g.fillStyle = shade(base, -0.12); g.fillRect(0, S / 2 - 1, S, 2); g.fillRect(0, 0, S, 2); g.fillRect(S * 0.3, 0, 2, S / 2); g.fillRect(S * 0.8, S / 2, 2, S / 2); }
    if (t === 'polished') for (let i = 0; i < 26; i++){ g.strokeStyle = shade(base, (R() - 0.5) * 0.12); g.globalAlpha = 0.35; g.lineWidth = 6 + R() * 10; g.beginPath(); const x = R() * S, y = R() * S, r = 40 + R() * 80; g.arc(x, y, r, R() * 6, R() * 6 + 1.2); g.stroke(); }
    g.globalAlpha = 1;
  } else if (t === 'concreteBoard'){
    const n = 8, h = S / n; for (let i = 0; i < n; i++){ const f = fbmField(S, R, 3, 4); g.fillStyle = shade(base, (R() - 0.5) * 0.08); g.fillRect(0, i * h, S, h);
      for (let k = 0; k < 10; k++){ g.strokeStyle = shade(base, (R() - 0.5) * 0.1); g.globalAlpha = 0.5; g.lineWidth = 1; g.beginPath(); const y = i * h + R() * h; g.moveTo(0, y); g.bezierCurveTo(S / 3, y + (R() - 0.5) * 5, S * 2 / 3, y + (R() - 0.5) * 5, S, y); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = shade(base, -0.14); g.fillRect(0, i * h, S, 1.5); }
    for (const [x, y] of [[0.25, 0.5], [0.75, 0.5]]){ g.fillStyle = shade(base, -0.3); g.beginPath(); g.arc(x * S, y * S, 5, 0, 7); g.fill(); }
  } else if (t === 'wood' || t === 'cladV' || t === 'deck'){
    const vert = t === 'cladV', planks = t === 'wood' ? 3 : t === 'deck' ? 4 : 5, ph = S / planks;
    for (let p = 0; p < planks; p++){
      const col = shade(base, (R() - 0.5) * 0.12), f = fbmField(64, R, 3, 4);
      g.save(); if (vert){ g.translate(S, 0); g.rotate(Math.PI / 2); }
      g.fillStyle = col; g.fillRect(0, p * ph, S, ph);
      const rings = 10 + Math.floor(R() * 10), cx = R() * S, cy = p * ph + (R() - 0.5) * ph * 3;
      for (let k = 0; k < rings * 3; k++){ g.strokeStyle = shade(col, (R() - 0.5) * 0.2 - 0.04); g.globalAlpha = 0.45; g.lineWidth = 0.8 + R() * 1.6;
        g.beginPath(); const y = p * ph + R() * ph; g.moveTo(0, y); for (let x = 0; x <= S; x += 32){ const w = (f[(Math.floor(x / 8) % 64) + (Math.floor((y - p * ph) / ph * 63)) * 64] - 0.5) * 10; g.lineTo(x, y + w + Math.sin((x - cx) / 90) * 3); } g.stroke(); }
      if (R() < 0.5){ g.globalAlpha = 0.5; g.fillStyle = shade(col, -0.25); g.beginPath(); g.ellipse(R() * S, p * ph + ph / 2, 7, 4, 0, 0, 7); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = shade(base, -0.35); g.fillRect(0, p * ph, S, t === 'deck' ? 6 : vert ? 4 : 2);
      if (t === 'deck') for (let k = 0; k < 6; k++){ g.fillStyle = shade(col, -0.1); g.fillRect(0, p * ph + 10 + k * (ph - 16) / 6, S, 1); }
      g.restore();
    }
  } else if (t === 'herringbone'){
    g.fillStyle = shade(base, -0.3); g.fillRect(0, 0, S, S); const L = S / 2, W = S / 8;
    for (let row = -2; row < 6; row++) for (let col = -2; col < 6; col++){
      const x0 = col * W * 2, y0 = row * W * 2 + col * W * 0;
      for (const rot of [0, 1]){ g.save(); g.translate(x0 + (rot ? W : 0), y0 + (rot ? 0 : W)); g.rotate(rot ? Math.PI / 4 : -Math.PI / 4); g.fillStyle = shade(base, (R() - 0.5) * 0.14); g.fillRect(1, 1, L * 0.7 - 2, W - 2);
        for (let k = 0; k < 6; k++){ g.strokeStyle = shade(base, (R() - 0.5) * 0.2); g.globalAlpha = 0.4; g.beginPath(); const y = R() * W; g.moveTo(2, y); g.lineTo(L * 0.7 - 2, y + (R() - 0.5) * 2); g.stroke(); } g.globalAlpha = 1; g.restore(); }
    }
  } else if (t === 'cork'){ for (let i = 0; i < 5000; i++){ g.fillStyle = shade(base, (R() - 0.5) * 0.35); g.beginPath(); g.arc(R() * S, R() * S, 1 + R() * 3, 0, 7); g.fill(); } }
  else if (t === 'tile60' || t === 'tile20'){
    const n = t === 'tile60' ? 2 : 2, j = t === 'tile60' ? 3 : 4, s = S / n; g.fillStyle = shade(base, t === 'tile20' ? -0.06 : -0.14); g.fillRect(0, 0, S, S);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){ g.fillStyle = shade(base, (R() - 0.5) * (t === 'tile60' ? 0.05 : 0.03)); g.fillRect(c * s + j / 2, r * s + j / 2, s - j, s - j);
      if (t === 'tile60'){ const f = fbmField(128, R, 4, 2); g.globalAlpha = 0.18; for (let k = 0; k < 140; k++){ const x = R() * (s - j), y = R() * (s - j); g.fillStyle = shade(base, (f[Math.floor(k * 117) % f.length] - 0.5) * 0.3); g.fillRect(c * s + x, r * s + y, 18, 18); } g.globalAlpha = 1; }
      else { const gr = g.createLinearGradient(c * s, r * s, c * s + s, r * s + s); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(c * s + j / 2, r * s + j / 2, s - j, s - j); } }
  } else if (t === 'marble'){
    const f = fbmField(S, R, 6, 3), id2 = g.getImageData(0, 0, S, S), d = id2.data, c = new THREE.Color(base);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){ const i = y * S + x, v = Math.abs(Math.sin((x + y) / S * Math.PI * 3 + f[i] * 9)); const k = v < 0.08 ? 0.72 : 1 - (1 - v) * 0.06; d[i * 4] = c.r * 255 * k; d[i * 4 + 1] = c.g * 255 * k; d[i * 4 + 2] = c.b * 255 * k; }
    g.putImageData(id2, 0, 0); g.fillStyle = shade(base, -0.2); g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S);
  } else if (t === 'terrazzo'){ const f = fbmField(S, R, 3, 4); tintField(g, S, base, f, 0.08); const cols = ['#8A7F72', '#C9B79C', '#5D6066', '#E8E2D6', '#A35D42'];
    for (let i = 0; i < 1300; i++){ g.fillStyle = cols[Math.floor(R() * cols.length)]; g.beginPath(); const x = R() * S, y = R() * S, r = 1.5 + R() * 5; g.moveTo(x + r, y); for (let k = 1; k < 6; k++) g.lineTo(x + Math.cos(k * 1.26) * r * (0.6 + R() * 0.6), y + Math.sin(k * 1.26) * r * (0.6 + R() * 0.6)); g.fill(); } }
  else if (t === 'flagstone' || t === 'pavers' || t === 'stone' || t === 'rubble' || t === 'brick'){
    g.fillStyle = t === 'brick' ? '#CFC7B6' : shade(base, -0.24); g.fillRect(0, 0, S, S); const f = fbmField(S, R, 5, 8);
    const block = (x, y, w, h, r = 3) => { g.fillStyle = shade(base, (R() - 0.5) * (t === 'brick' ? 0.16 : 0.14)); g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill(); };
    if (t === 'brick'){ const rows = 8, rh = S / rows, cw = S / 2; for (let r = 0; r < rows; r++) for (let c = -1; c < 3; c++) block(c * cw + (r % 2 ? cw / 2 : 0) + 3, r * rh + 3, cw - 6, rh - 6, 2); }
    else if (t === 'pavers'){ const n = 4, s = S / n; for (let r = 0; r < n; r++) for (let c = 0; c < n * 2; c++) block(c * s / 2 + (r % 2 ? s / 4 : 0) + 3, r * s + 3, s / 2 - 6, s - 6, 4); }
    else if (t === 'rubble'){ for (let i = 0; i < 70; i++){ const x = R() * S, y = R() * S, rx = 18 + R() * 30, ry = 12 + R() * 20; g.fillStyle = shade(base, (R() - 0.5) * 0.2); g.beginPath(); g.ellipse(x, y, rx, ry, R() * 3, 0, 7); g.fill(); for (const [dx, dy] of [[S, 0], [-S, 0], [0, S], [0, -S]]){ g.beginPath(); g.ellipse(x + dx, y + dy, rx, ry, 0, 0, 7); g.fill(); } } }
    else { const rows = t === 'stone' ? 4 : 3, rh = S / rows; for (let r = 0; r < rows; r++){ let x = -R() * 80; while (x < S){ const w = (t === 'stone' ? 90 : 110) + R() * 120; block(x + 3, r * rh + 3, w - 6, rh - 6, t === 'flagstone' ? 5 : 2); x += w; } } }
    tintField(g, S, base, f, 0.16);
  } else if (t === 'zinc'){
    const f = fbmField(S, R, 4, 4); tintField(g, S, base, f, 0.08); const n = 3, w = S / n;
    for (let i = 0; i < n; i++){ const x = i * w; const gr = g.createLinearGradient(x - 8, 0, x + 8, 0); gr.addColorStop(0, shade(base, -0.12)); gr.addColorStop(0.45, shade(base, 0.22)); gr.addColorStop(0.55, shade(base, -0.05)); gr.addColorStop(1, shade(base, -0.16)); g.fillStyle = gr; g.fillRect(x - 8, 0, 16, S); }
  } else if (t === 'water'){ const f = fbmField(S, R, 5, 4); tintField(g, S, base, f, 0.35, v => Math.abs(Math.sin(v * 12))); }
  else if (t === 'grass'){ const f = fbmField(S, R, 5, 8); tintField(g, S, base, f, 0.3); for (let i = 0; i < 9000; i++){ g.strokeStyle = shade(base, (R() - 0.4) * 0.35); g.globalAlpha = 0.5; g.lineWidth = 1; g.beginPath(); const x = R() * S, y = R() * S; g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y - 3 - R() * 5); g.stroke(); } g.globalAlpha = 1; }
  return cv;
}
const bumpCache = {};
function texFromCanvas(cv, id, color){
  const m = mat(id), info = TEX_LIB[m.tex] || {}, sz = info.sz || 1, tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; tex.anisotropy = 8;
  tex.repeat.set(1 / (m.tx || sz), 1 / (m.ty || sz)); tex.name = 'archiplan-' + id + (color ? '' : '-relief'); return tex;
}
function texForV2(id){ const cv = paintV2(id); if (!cv) return null; bumpCache[id] = texFromCanvas(cv, id, false); return texFromCanvas(cv, id, true); }
const bumpFor = id => { texFor(id); return bumpCache[id] || null; };
/* aperçu d'un motif pour la bibliothèque de textures (couleur au choix) */
function patternPreview(tex, color){
  const tmp = '__pat_' + tex; MATS[tmp] = {nom:'', cat:'', color, tex, rho:0, lambda:1}; const cv = paintV2(tmp) || paint(tmp).image; delete MATS[tmp];
  const c2 = document.createElement('canvas'); c2.width = c2.height = 96; c2.getContext('2d').drawImage(cv, 0, 0, 96, 96); return c2.toDataURL('image/jpeg', 0.8);
}
