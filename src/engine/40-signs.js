/* ============ Signalisation française (temporaire et permanente) ============
   Faces dessinées dans l'app d'après l'Instruction interministérielle sur la signalisation routière (IISR, 8e partie pour la
   signalisation temporaire) : couleurs et formes réglementaires, pictogrammes simplifiés. Aucune image tierce : libre de droit. */
const SC = {red:'#C1121F', yel:'#F6C400', blue:'#1F4FA3', blk:'#111111', wht:'#FFFFFF', grey:'#8C939B', grn:'#16803C', orange:'#F07A1A'};
const SIGN_FACE = {};
function sCanvas(w, h){ const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
/* formes de base (coordonnées en pixels sur 256) */
function triPath(g, s, inv = false){ const h = s * Math.sqrt(3) / 2, m = (256 - h) / 2, r = s * 0.06;
  const pts = inv ? [[128, 256 - m], [128 - s / 2, m], [128 + s / 2, m]] : [[128, m], [128 + s / 2, 256 - m], [128 - s / 2, 256 - m]];
  const st = V.lerp(pts[2], pts[0], 0.5); g.beginPath(); g.moveTo(st[0], st[1]);
  for (let i = 0; i < 3; i++){ const a = pts[i], b = pts[(i + 1) % 3]; g.arcTo(a[0], a[1], b[0], b[1], r); }
  g.closePath(); }
function octPath(g, r){ g.beginPath(); for (let i = 0; i < 8; i++){ const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.closePath(); }
function rr(g, x, y, w, h, r){ g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function arrow(g, x0, y0, x1, y1, w, head, col){ const d = V.norm([x1 - x0, y1 - y0]), n = V.perp(d), hb = [x1 - d[0] * head, y1 - d[1] * head];
  g.fillStyle = col; g.beginPath(); g.moveTo(x0 + n[0] * w / 2, y0 + n[1] * w / 2); g.lineTo(hb[0] + n[0] * w / 2, hb[1] + n[1] * w / 2); g.lineTo(hb[0] + n[0] * head * 0.62, hb[1] + n[1] * head * 0.62); g.lineTo(x1, y1);
  g.lineTo(hb[0] - n[0] * head * 0.62, hb[1] - n[1] * head * 0.62); g.lineTo(hb[0] - n[0] * w / 2, hb[1] - n[1] * w / 2); g.lineTo(x0 - n[0] * w / 2, y0 - n[1] * w / 2); g.closePath(); g.fill(); }
function turnArrow(g, side, col, w = 26){ // flèche de direction coudée (à droite si side = 1)
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(128 - side * 26, 205); g.lineTo(128 - side * 26, 140); g.quadraticCurveTo(128 - side * 26, 108, 128 + side * 6, 108); g.lineTo(128 + side * 30, 108); g.stroke();
  g.fillStyle = col; g.beginPath(); g.moveTo(128 + side * 82, 108); g.lineTo(128 + side * 28, 66); g.lineTo(128 + side * 28, 150); g.closePath(); g.fill(); }
function car(g, x, y, s, col){ g.fillStyle = col; g.save(); g.translate(x, y); g.scale(s, s); g.beginPath(); g.moveTo(-40, 8); g.lineTo(-40, -6); g.lineTo(-30, -10); g.lineTo(-20, -26); g.lineTo(18, -26); g.lineTo(28, -10); g.lineTo(40, -6); g.lineTo(40, 8); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.fillRect(-16, -22, 14, 10); g.fillRect(2, -22, 14, 10); g.fillStyle = col; g.beginPath(); g.arc(-24, 10, 8, 0, 7); g.arc(24, 10, 8, 0, 7); g.fill(); g.restore(); }
function walker(g, x, y, s, col){ g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.beginPath(); g.arc(4, -44, 8, 0, 7); g.fill(); g.lineWidth = 10;
  g.beginPath(); g.moveTo(2, -32); g.lineTo(-2, -2); g.lineTo(-14, 26); g.moveTo(-2, -2); g.lineTo(12, 26); g.moveTo(2, -26); g.lineTo(-14, -12); g.moveTo(2, -26); g.lineTo(16, -10); g.stroke(); g.restore(); }
function worker(g){ // AK5 : travailleur pelletant devant un tas
  g.fillStyle = SC.blk; g.strokeStyle = SC.blk; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(132, 196); g.quadraticCurveTo(160, 160, 190, 196); g.closePath(); g.fill();          // tas
  g.beginPath(); g.arc(104, 104, 11, 0, 7); g.fill();                                                          // tête
  g.lineWidth = 15; g.beginPath(); g.moveTo(100, 120); g.lineTo(92, 158); g.stroke();                            // buste penché
  g.lineWidth = 12; g.beginPath(); g.moveTo(92, 158); g.lineTo(78, 196); g.moveTo(92, 158); g.lineTo(110, 196); g.stroke();   // jambes
  g.lineWidth = 9; g.beginPath(); g.moveTo(100, 128); g.lineTo(122, 146); g.lineTo(140, 150); g.stroke();       // bras
  g.lineWidth = 6; g.beginPath(); g.moveTo(112, 128); g.lineTo(154, 168); g.stroke();                            // manche de pelle
  g.beginPath(); g.moveTo(150, 162); g.lineTo(166, 160); g.lineTo(166, 178); g.closePath(); g.fill(); }
function narrows(g, side){ // AK3 / AK3a / AK3b
  g.strokeStyle = SC.blk; g.lineWidth = 13; g.lineCap = 'butt';
  const L = (sx, k) => { g.beginPath(); g.moveTo(128 + sx * 40, 200); g.lineTo(128 + sx * 40, 170); g.quadraticCurveTo(128 + sx * 40, 150, 128 + sx * (k ? 20 : 40), 132); g.lineTo(128 + sx * (k ? 20 : 40), 100); g.stroke(); };
  L(-1, side !== 1); L(1, side !== -1); }
function textFit(g, txt, x, y, maxW, size, weight = 'bold', fam = 'Arial, Helvetica, sans-serif'){ let s = size; do { g.font = `${weight} ${s}px ${fam}`; s -= 2; } while (g.measureText(txt).width > maxW && s > 10); g.fillText(txt, x, y); }

/* catalogue des faces : forme, couleurs, dessin */
const SIGNS = {
  AK2:{n:'Cassis ou dos-d\'âne', s:'tri', ak:1, draw:g => { g.fillStyle = SC.blk; g.beginPath(); g.moveTo(66, 190); g.lineTo(96, 190); g.quadraticCurveTo(128, 120, 160, 190); g.lineTo(190, 190); g.lineTo(190, 200); g.lineTo(66, 200); g.fill(); }},
  AK3:{n:'Chaussée rétrécie', s:'tri', ak:1, draw:g => narrows(g, 0)},
  AK3a:{n:'Chaussée rétrécie par la droite', s:'tri', ak:1, draw:g => narrows(g, 1)},
  AK3b:{n:'Chaussée rétrécie par la gauche', s:'tri', ak:1, draw:g => narrows(g, -1)},
  AK4:{n:'Chaussée glissante', s:'tri', ak:1, draw:g => { car(g, 128, 130, 0.9, SC.blk); g.strokeStyle = SC.blk; g.lineWidth = 6; g.beginPath(); g.moveTo(100, 200); g.bezierCurveTo(120, 170, 90, 160, 110, 148); g.moveTo(156, 200); g.bezierCurveTo(176, 170, 146, 160, 166, 148); g.stroke(); }},
  AK5:{n:'Travaux', s:'tri', ak:1, draw:worker},
  AK14:{n:'Autres dangers', s:'tri', ak:1, draw:g => { g.fillStyle = SC.blk; rr(g, 117, 92, 22, 74, 8); g.fill(); g.beginPath(); g.arc(128, 186, 12, 0, 7); g.fill(); }},
  AK17:{n:'Feux de signalisation temporaires', s:'tri', ak:1, draw:g => { g.fillStyle = SC.blk; rr(g, 106, 92, 44, 106, 8); g.fill(); [[SC.red, 110], [SC.yel, 145], [SC.grn, 180]].forEach(([c, y]) => { g.fillStyle = c; g.beginPath(); g.arc(128, y, 13, 0, 7); g.fill(); }); }},
  AK22:{n:'Projections de gravillons', s:'tri', ak:1, draw:g => { car(g, 150, 180, 0.62, SC.blk); g.fillStyle = SC.blk; const R = rng(5); for (let i = 0; i < 14; i++){ g.beginPath(); g.arc(80 + R() * 50, 120 + R() * 60, 3 + R() * 4, 0, 7); g.fill(); } }},
  AK30:{n:'Bouchon', s:'tri', ak:1, draw:g => { car(g, 128, 110, 0.55, SC.blk); car(g, 128, 150, 0.68, SC.blk); car(g, 128, 194, 0.8, SC.blk); }},
  AK31:{n:'Accident', s:'tri', ak:1, draw:g => { car(g, 106, 170, 0.62, SC.blk); g.save(); g.translate(158, 150); g.rotate(-0.9); car(g, 0, 0, 0.62, SC.blk); g.restore(); }},
  A13b:{n:'Passage piétons', s:'tri', draw:g => walker(g, 128, 168, 1.15, SC.blk)},
  B0:{n:'Circulation interdite', s:'circ', draw:() => {}},
  B1:{n:'Sens interdit', s:'disc', draw:g => { g.fillStyle = SC.wht; g.fillRect(48, 108, 160, 40); }},
  B2a:{n:'Interdiction de tourner à gauche', s:'circ', draw:g => { turnArrow(g, -1, SC.blk, 22); g.strokeStyle = SC.red; g.lineWidth = 22; g.beginPath(); g.moveTo(62, 62); g.lineTo(194, 194); g.stroke(); }},
  B2b:{n:'Interdiction de tourner à droite', s:'circ', draw:g => { turnArrow(g, 1, SC.blk, 22); g.strokeStyle = SC.red; g.lineWidth = 22; g.beginPath(); g.moveTo(194, 62); g.lineTo(62, 194); g.stroke(); }},
  B3:{n:'Interdiction de dépasser', s:'circ', draw:g => { car(g, 98, 140, 0.62, SC.red); car(g, 160, 140, 0.62, SC.blk); }},
  B8:{n:'Interdit aux transports de marchandises', s:'circ', draw:g => { g.fillStyle = SC.blk; g.fillRect(64, 104, 84, 56); g.fillRect(152, 120, 38, 40); g.fillStyle = SC.wht; g.fillRect(160, 126, 20, 14); g.fillStyle = SC.blk; [84, 126, 172].forEach(x => { g.beginPath(); g.arc(x, 166, 12, 0, 7); g.fill(); }); }},
  B9g:{n:'Accès interdit aux piétons', s:'circ', draw:g => { walker(g, 128, 150, 1.05, SC.blk); g.strokeStyle = SC.red; g.lineWidth = 20; g.beginPath(); g.moveTo(62, 62); g.lineTo(194, 194); g.stroke(); }},
  B14:{n:'Limitation de vitesse', s:'circ', p:{v:'30'}, draw:(g, p) => { g.fillStyle = SC.blk; g.textAlign = 'center'; g.textBaseline = 'middle'; textFit(g, String(p?.v || '30'), 128, 136, 150, 120); }},
  B15:{n:'Cédez le passage à la circulation venant en sens inverse', s:'circ', draw:g => { arrow(g, 104, 200, 104, 60, 22, 46, SC.red); arrow(g, 152, 56, 152, 196, 22, 46, SC.blk); }},
  B21_1:{n:'Contournement obligatoire par la droite', s:'blue', draw:g => arrow(g, 92, 92, 166, 166, 26, 58, SC.wht)},
  B21_2:{n:'Contournement obligatoire par la gauche', s:'blue', draw:g => arrow(g, 164, 92, 90, 166, 26, 58, SC.wht)},
  B21c1:{n:'Obligation de tourner à droite', s:'blue', draw:g => turnArrow(g, 1, SC.wht, 26)},
  B21c2:{n:'Obligation de tourner à gauche', s:'blue', draw:g => turnArrow(g, -1, SC.wht, 26)},
  B21d1:{n:'Direction obligatoire : tout droit', s:'blue', draw:g => arrow(g, 128, 204, 128, 52, 28, 60, SC.wht)},
  B33:{n:'Fin de limitation de vitesse', s:'end', p:{v:'30'}, draw:(g, p) => { g.fillStyle = SC.grey; g.textAlign = 'center'; g.textBaseline = 'middle'; textFit(g, String(p?.v || '30'), 128, 136, 150, 116); g.strokeStyle = SC.blk; g.lineWidth = 12; g.beginPath(); g.moveTo(70, 186); g.lineTo(186, 70); g.stroke(); }},
  B6a1:{n:'Stationnement interdit', s:'park', draw:g => { g.strokeStyle = SC.red; g.lineWidth = 22; g.beginPath(); g.moveTo(66, 66); g.lineTo(190, 190); g.stroke(); }},
  B6d:{n:'Arrêt et stationnement interdits', s:'park', draw:g => { g.strokeStyle = SC.red; g.lineWidth = 22; g.beginPath(); g.moveTo(66, 66); g.lineTo(190, 190); g.moveTo(190, 66); g.lineTo(66, 190); g.stroke(); }},
  AB3a:{n:'Cédez le passage', s:'inv'},
  AB4:{n:'Arrêt obligatoire (STOP)', s:'oct'},
  C12:{n:'Sens unique', s:'sq', draw:g => arrow(g, 128, 212, 128, 44, 32, 66, SC.wht)},
  C13a:{n:'Impasse', s:'sq', draw:g => { g.fillStyle = SC.wht; g.fillRect(108, 104, 40, 110); g.fillStyle = SC.red; g.fillRect(70, 62, 116, 42); }},
  C18:{n:'Priorité par rapport au sens inverse', s:'sq', draw:g => { arrow(g, 98, 200, 98, 60, 24, 48, SC.wht); arrow(g, 158, 56, 158, 196, 24, 48, SC.red); }},
  KC1:{n:'Panneau de position (texte)', s:'rect', ak:1, ar:1.6, p:{t:'ROUTE BARRÉE'}, draw:(g, p, w, h) => { const L = String(p?.t || 'ROUTE BARRÉE').split(/\n|\|/).slice(0, 3), k = L.length === 1 ? 0.34 : L.length === 2 ? 0.27 : 0.21; g.fillStyle = SC.blk; g.textAlign = 'center'; g.textBaseline = 'middle'; L.forEach((t, i) => textFit(g, t.toUpperCase(), w / 2, h / 2 + (i - (L.length - 1) / 2) * h * (k + 0.06), w - h * 0.22, Math.round(h * k), '900', 'Arial Narrow, Arial, Helvetica, sans-serif')); }},
  KD22a:{n:'Déviation (vers la gauche)', s:'rect', ak:1, ar:2.4, draw:(g, p, w, h) => { arrow(g, w * 0.4, h / 2, w * 0.08, h / 2, h * 0.2, h * 0.36, SC.blk); g.fillStyle = SC.blk; g.textAlign = 'center'; g.textBaseline = 'middle'; textFit(g, 'DÉVIATION', w * 0.66, h / 2, w * 0.56, Math.round(h * 0.3)); }},
  KD22b:{n:'Déviation (vers la droite)', s:'rect', ak:1, ar:2.4, draw:(g, p, w, h) => { arrow(g, w * 0.6, h / 2, w * 0.92, h / 2, h * 0.2, h * 0.36, SC.blk); g.fillStyle = SC.blk; g.textAlign = 'center'; g.textBaseline = 'middle'; textFit(g, 'DÉVIATION', w * 0.34, h / 2, w * 0.56, Math.round(h * 0.3)); }},
  KD22c:{n:'Déviation (tout droit)', s:'rect', ak:1, ar:2.4, draw:(g, p, w, h) => { arrow(g, w * 0.14, h * 0.86, w * 0.14, h * 0.14, h * 0.2, h * 0.32, SC.blk); g.fillStyle = SC.blk; g.textAlign = 'center'; g.textBaseline = 'middle'; textFit(g, 'DÉVIATION', w * 0.6, h / 2, w * 0.7, Math.round(h * 0.3)); }},
  KD8:{n:'Présignalisation de déviation', s:'rect', ak:1, ar:1.3, p:{t:'DÉVIATION|à 150 m'}, draw:(g, p, w, h) => { const L = String(p?.t || 'DÉVIATION|à 150 m').split(/\n|\|/).slice(0, 3); g.fillStyle = SC.blk; g.textAlign = 'center'; g.textBaseline = 'middle'; L.forEach((t, i) => textFit(g, i ? t : t.toUpperCase(), w / 2, h * 0.36 + i * h * 0.3, w - 40, Math.round(h * (i ? 0.17 : 0.2)))); arrow(g, w / 2, h * 0.92, w / 2, h * 0.72, h * 0.07, h * 0.12, SC.blk); }},
  KM9:{n:'Piétons, passez en face', s:'rect', ak:1, ar:1.3, draw:(g, p, w, h) => { walker(g, w * 0.22, h * 0.56, 1.0, SC.blk); arrow(g, w * 0.4, h * 0.56, w * 0.9, h * 0.56, h * 0.08, h * 0.16, SC.blk); g.fillStyle = SC.blk; g.textAlign = 'center'; textFit(g, 'PIÉTONS', w / 2, h * 0.2, w - 40, Math.round(h * 0.14)); textFit(g, 'PASSEZ EN FACE', w / 2, h * 0.88, w - 40, Math.round(h * 0.12)); }},
  KR_ROUTE:{n:'Route barrée sauf riverains', s:'rect', ak:1, ar:1.6, p:{t:'RUE BARRÉE|SAUF RIVERAINS'}, base:'KC1'},
};
/* dessin d'une face (canvas, fond transparent hors du panneau) */
function signCanvas(code, p = {}, px = 256){
  const S = SIGNS[code] || SIGNS.AK14, base = S.base ? SIGNS[S.base] : S, shape = base.s, ar = base.ar || 1, w = shape === 'rect' ? Math.round(px * ar) : px, h = px, cv = sCanvas(w, h), g = cv.getContext('2d');
  const pp = {...(S.p || {}), ...p}; g.save(); if (shape !== 'rect') g.scale(px / 256, px / 256);
  const bg = base.ak ? SC.yel : SC.wht;
  switch (shape){
    case 'tri': triPath(g, 244); g.fillStyle = SC.wht; g.fill(); triPath(g, 238); g.fillStyle = SC.red; g.fill(); triPath(g, 176); g.fillStyle = bg; g.fill(); break;
    case 'inv': triPath(g, 244, true); g.fillStyle = SC.wht; g.fill(); triPath(g, 238, true); g.fillStyle = SC.red; g.fill(); triPath(g, 176, true); g.fillStyle = SC.wht; g.fill(); break;
    case 'circ': case 'park': case 'end': g.fillStyle = SC.wht; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.fillStyle = shape === 'end' ? SC.wht : SC.red; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.fillStyle = shape === 'park' ? SC.blue : SC.wht; g.beginPath(); g.arc(128, 128, shape === 'end' ? 116 : 96, 0, 7); g.fill(); if (shape === 'end'){ g.strokeStyle = SC.blk; g.lineWidth = 3; g.stroke(); } break;
    case 'disc': g.fillStyle = SC.wht; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.fillStyle = SC.red; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); break;
    case 'blue': g.fillStyle = SC.wht; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.fillStyle = SC.blue; g.beginPath(); g.arc(128, 128, 119, 0, 7); g.fill(); break;
    case 'oct': octPath(g, 126); g.fillStyle = SC.wht; g.fill(); octPath(g, 120); g.fillStyle = SC.red; g.fill(); g.fillStyle = SC.wht; g.textAlign = 'center'; g.textBaseline = 'middle'; textFit(g, 'STOP', 128, 132, 200, 84); break;
    case 'sq': rr(g, 4, 4, 248, 248, 22); g.fillStyle = SC.wht; g.fill(); rr(g, 12, 12, 232, 232, 16); g.fillStyle = SC.blue; g.fill(); break;
    case 'rect': rr(g, 3, 3, w - 6, h - 6, h * 0.08); g.fillStyle = SC.wht; g.fill(); rr(g, h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1, h * 0.05); g.fillStyle = bg; g.fill(); break;
  }
  (S.draw || base.draw)?.(g, pp, w, h); g.restore(); return cv;
}
function signShape(code){ const S = SIGNS[code] || SIGNS.AK14; return (S.base ? SIGNS[S.base] : S); }
function signFaceTex(code, p = {}){
  const key = code + '|' + JSON.stringify(p); if (SIGN_FACE[key]) return SIGN_FACE[key];
  const cv = signCanvas(code, p, 256), t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.cv = cv;
  return SIGN_FACE[key] = t;
}
const signThumb = (code, p) => { try { return signCanvas(code, p, 96).toDataURL('image/png'); } catch(e){ return ''; } };
