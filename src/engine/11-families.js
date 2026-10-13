/* ============ Familles paramétriques (portes, fenêtres, mobilier, structure…) ============
   Une famille = des paramètres (avec valeurs par défaut), des types (jeux de valeurs nommés) et des pièces géométriques dont les
   dimensions sont des formules sur les paramètres (« w-2*c », « max(0.05, h/10) »…). Repère local :
   - famille hébergée (mur) : x le long du mur (centré sur l'ouverture), y à travers le mur (0 = axe), z vers le haut depuis l'allège ;
   - famille libre : x, y en plan depuis le point d'insertion, z vers le haut ; rotation autour de z.
   Pièces : {s:'box', x,y,z,w,d,h} (coin minimal + dimensions), {s:'cyl', x,y,z,r,h}, {s:'sph', x,y,z,r},
            {fam:'id', type?, p:{…}, x,y,z, rot} (famille imbriquée = assemblage), n:'…' répétition avec la variable i, if:'…' condition.
   cut : ouverture taillée dans le mur hôte {w, h} (formules). */

/* --- formules : analyseur sûr (nombres, paramètres, + - * / ^ ( ), min max abs round floor ceil sqrt, comparaisons) --- */
const FX_FUN = {min:Math.min, max:Math.max, abs:Math.abs, round:Math.round, floor:Math.floor, ceil:Math.ceil, sqrt:Math.sqrt, sin:x => Math.sin(x*Math.PI/180), cos:x => Math.cos(x*Math.PI/180)};
const fxCache = new Map();
function fxCompile(src){
  src = String(src ?? '0').trim(); if (fxCache.has(src)) return fxCache.get(src);
  const toks = src.match(/\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z_][\w]*|<=|>=|==|!=|[-+*/^(),<>?:]/g) || [];
  if (toks.join('') !== src.replace(/\s+/g, '').replace(/,(?=\d)/g, ',')) { /* caractères inconnus ignorés : on vérifie plus bas */ }
  let i = 0; const peek = () => toks[i], eat = t => { if (toks[i] !== t) throw new Error('Formule : « ' + t + ' » attendu'); i++; };
  const prim = () => {
    const t = toks[i++];
    if (t === undefined) throw new Error('Formule incomplète');
    if (t === '(') { const v = tern(); eat(')'); return v; }
    if (t === '-') { const v = unary(); return s => -v(s); }
    if (/^\d|^\./.test(t)) { const n = parseFloat(t); return () => n; }
    if (/^[A-Za-z_]/.test(t)) {
      if (peek() === '(') { const f = FX_FUN[t]; if (!f) throw new Error('Fonction inconnue : ' + t); i++; const args = []; if (peek() !== ')') { args.push(tern()); while (peek() === ',') { i++; args.push(tern()); } } eat(')'); return s => f(...args.map(a => a(s))); }
      if (t === 'PI') return () => Math.PI;
      return s => { const v = s[t]; if (typeof v !== 'number') throw new Error('Paramètre inconnu : ' + t); return v; };
    }
    throw new Error('Symbole inattendu : ' + t);
  };
  const unary = () => prim();
  const pow = () => { let a = unary(); while (peek() === '^') { i++; const b = unary(), A = a; a = s => Math.pow(A(s), b(s)); } return a; };
  const mul = () => { let a = pow(); while (peek() === '*' || peek() === '/') { const op = toks[i++], b = pow(), A = a; a = op === '*' ? s => A(s) * b(s) : s => A(s) / b(s); } return a; };
  const add = () => { let a = mul(); while (peek() === '+' || peek() === '-') { const op = toks[i++], b = mul(), A = a; a = op === '+' ? s => A(s) + b(s) : s => A(s) - b(s); } return a; };
  const cmp = () => { let a = add(); while (['<','>','<=','>=','==','!='].includes(peek())) { const op = toks[i++], b = add(), A = a;
    a = {'<':s=>+(A(s)<b(s)), '>':s=>+(A(s)>b(s)), '<=':s=>+(A(s)<=b(s)), '>=':s=>+(A(s)>=b(s)), '==':s=>+(Math.abs(A(s)-b(s))<1e-9), '!=':s=>+(Math.abs(A(s)-b(s))>=1e-9)}[op]; } return a; };
  const tern = () => { const c = cmp(); if (peek() === '?') { i++; const a = tern(); eat(':'); const b = tern(); return s => c(s) ? a(s) : b(s); } return c; };
  const f = tern(); if (i !== toks.length) throw new Error('Formule : symbole en trop « ' + toks[i] + ' »');
  const safe = s => { const v = f(s); return Number.isFinite(v) ? v : 0; };
  fxCache.set(src, safe); return safe;
}
const fx = (src, scope) => typeof src === 'number' ? src : fxCompile(src)(scope);

/* --- bibliothèque de base --- */
const FAM_CATS = ['Portes', 'Fenêtres', 'Ouvertures', 'Structure', 'Escaliers et garde-corps', 'Mobilier', 'Cuisine et sanitaires', 'Industrie', 'Extérieur'];
const P = (v, label, unit = 'm') => ({v, label, unit});
// cadre d'une menuiserie : montants, traverses, ouvrant(s) vitrés
const frameParts = (mat = 'pvc') => [
  {s:'box', m:mat, x:'-w/2', y:'-fd/2', z:'0', w:'fw', d:'fd', h:'h'},
  {s:'box', m:mat, x:'w/2-fw', y:'-fd/2', z:'0', w:'fw', d:'fd', h:'h'},
  {s:'box', m:mat, x:'-w/2+fw', y:'-fd/2', z:'h-fw', w:'w-2*fw', d:'fd', h:'fw'},
  {s:'box', m:mat, x:'-w/2+fw', y:'-fd/2', z:'0', w:'w-2*fw', d:'fd', h:'fw', if:'sill>0.01'},
];
const FAMS = {
  'porte-simple': {nom:'Porte intérieure 1 vantail', cat:'Portes', host:'wall', params:{w:P(0.93,'Largeur'), h:P(2.04,'Hauteur'), sill:P(0,'Allège'), fw:P(0.045,'Largeur du dormant'), fd:P(0.07,'Profondeur du dormant')},
    types:[{nom:'73 × 204', p:{w:0.73}}, {nom:'83 × 204', p:{w:0.83}}, {nom:'93 × 204', p:{w:0.93}}], cut:{w:'w', h:'h'},
    parts:[...frameParts('bois'), {s:'box', m:'mdf', x:'-w/2+fw', y:'-0.02', z:'0.01', w:'w-2*fw', d:'0.04', h:'h-fw-0.01'},
      {s:'cyl', m:'inox', x:'w/2-fw-0.07', y:'0.04', z:'1.0', r:'0.012', h:'0.12'}]},
  'porte-double': {nom:'Porte 2 vantaux', cat:'Portes', host:'wall', params:{w:P(1.6,'Largeur'), h:P(2.15,'Hauteur'), sill:P(0,'Allège'), fw:P(0.05,'Dormant'), fd:P(0.07,'Profondeur')},
    types:[{nom:'140 × 215', p:{w:1.4}}, {nom:'160 × 215', p:{w:1.6}}], cut:{w:'w', h:'h'},
    parts:[...frameParts('bois'), {s:'box', m:'chene', x:'-w/2+fw', y:'-0.02', z:'0.01', w:'(w-2*fw)/2-0.003', d:'0.045', h:'h-fw-0.01'},
      {s:'box', m:'chene', x:'0.003', y:'-0.02', z:'0.01', w:'(w-2*fw)/2-0.003', d:'0.045', h:'h-fw-0.01'}]},
  'porte-entree': {nom:'Porte d\'entrée vitrée', cat:'Portes', host:'wall', params:{w:P(1.0,'Largeur'), h:P(2.15,'Hauteur'), sill:P(0,'Allège'), fw:P(0.07,'Dormant'), fd:P(0.08,'Profondeur')},
    types:[{nom:'90 × 215', p:{w:0.9}}, {nom:'100 × 215', p:{w:1.0}}], cut:{w:'w', h:'h'},
    parts:[...frameParts('alu'), {s:'box', m:'alu', x:'-w/2+fw', y:'-0.03', z:'0.01', w:'w-2*fw', d:'0.06', h:'h-fw-0.01'},
      {s:'box', m:'verre', x:'-w/2+fw+0.12', y:'-0.032', z:'0.9', w:'w-2*fw-0.24', d:'0.064', h:'h-fw-1.1'}]},
  'fenetre-1v': {nom:'Fenêtre 1 vantail', cat:'Fenêtres', host:'wall', params:{w:P(0.8,'Largeur'), h:P(1.15,'Hauteur'), sill:P(0.95,'Allège'), fw:P(0.06,'Dormant'), fd:P(0.07,'Profondeur')},
    types:[{nom:'60 × 75', p:{w:0.6, h:0.75, sill:1.35}}, {nom:'80 × 115', p:{w:0.8, h:1.15}}, {nom:'100 × 135', p:{w:1.0, h:1.35, sill:0.9}}], cut:{w:'w', h:'h'},
    parts:[...frameParts('pvc'), {s:'box', m:'vitrage', x:'-w/2+fw', y:'-0.012', z:'fw', w:'w-2*fw', d:'0.024', h:'h-2*fw'}]},
  'fenetre-2v': {nom:'Fenêtre 2 vantaux', cat:'Fenêtres', host:'wall', params:{w:P(1.2,'Largeur'), h:P(1.35,'Hauteur'), sill:P(0.9,'Allège'), fw:P(0.06,'Dormant'), fd:P(0.07,'Profondeur'), mw:P(0.08,'Montant central')},
    types:[{nom:'100 × 115', p:{w:1.0, h:1.15, sill:0.95}}, {nom:'120 × 135', p:{w:1.2}}, {nom:'140 × 135', p:{w:1.4}}], cut:{w:'w', h:'h'},
    parts:[...frameParts('pvc'), {s:'box', m:'pvc', x:'-mw/2', y:'-fd/2', z:'fw', w:'mw', d:'fd', h:'h-2*fw'},
      {s:'box', m:'vitrage', x:'-w/2+fw', y:'-0.012', z:'fw', w:'w/2-fw-mw/2', d:'0.024', h:'h-2*fw'},
      {s:'box', m:'vitrage', x:'mw/2', y:'-0.012', z:'fw', w:'w/2-fw-mw/2', d:'0.024', h:'h-2*fw'}]},
  'porte-fenetre': {nom:'Porte-fenêtre 2 vantaux', cat:'Fenêtres', host:'wall', params:{w:P(1.4,'Largeur'), h:P(2.15,'Hauteur'), sill:P(0,'Allège'), fw:P(0.06,'Dormant'), fd:P(0.07,'Profondeur'), mw:P(0.09,'Montant central')},
    types:[{nom:'120 × 215', p:{w:1.2}}, {nom:'140 × 215', p:{w:1.4}}, {nom:'160 × 225', p:{w:1.6, h:2.25}}], cut:{w:'w', h:'h'},
    parts:[...frameParts('alu'), {s:'box', m:'alu', x:'-mw/2', y:'-fd/2', z:'0', w:'mw', d:'fd', h:'h-fw'},
      {s:'box', m:'vitrage', x:'-w/2+fw', y:'-0.012', z:'0.1', w:'w/2-fw-mw/2', d:'0.024', h:'h-fw-0.1'},
      {s:'box', m:'vitrage', x:'mw/2', y:'-0.012', z:'0.1', w:'w/2-fw-mw/2', d:'0.024', h:'h-fw-0.1'},
      {s:'box', m:'alu', x:'-w/2+fw', y:'-fd/2', z:'0', w:'w-2*fw', d:'fd', h:'0.1'}]},
  'baie-coulissante': {nom:'Baie coulissante 2 vantaux', cat:'Fenêtres', host:'wall', params:{w:P(2.4,'Largeur'), h:P(2.15,'Hauteur'), sill:P(0,'Allège'), fw:P(0.05,'Dormant'), fd:P(0.1,'Profondeur')},
    types:[{nom:'180 × 215', p:{w:1.8}}, {nom:'240 × 215', p:{w:2.4}}, {nom:'300 × 225', p:{w:3.0, h:2.25}}], cut:{w:'w', h:'h'},
    parts:[...frameParts('alu'), {s:'box', m:'vitrage', x:'-w/2+fw', y:'-0.035', z:'fw', w:'w/2-fw+0.04', d:'0.024', h:'h-2*fw'},
      {s:'box', m:'vitrage', x:'-0.04', y:'0.01', z:'fw', w:'w/2-fw+0.04', d:'0.024', h:'h-2*fw'}]},
  'fenetre-fixe': {nom:'Châssis fixe', cat:'Fenêtres', host:'wall', params:{w:P(1.0,'Largeur'), h:P(1.0,'Hauteur'), sill:P(1.0,'Allège'), fw:P(0.05,'Dormant'), fd:P(0.07,'Profondeur')},
    types:[{nom:'100 × 100', p:{}}, {nom:'Bandeau 300 × 60', p:{w:3.0, h:0.6, sill:1.6}}], cut:{w:'w', h:'h'},
    parts:[...frameParts('alu'), {s:'box', m:'vitrage', x:'-w/2+fw', y:'-0.012', z:'fw', w:'w-2*fw', d:'0.024', h:'h-2*fw'}]},
  'ouverture': {nom:'Ouverture (baie libre)', cat:'Ouvertures', host:'wall', params:{w:P(0.9,'Largeur'), h:P(2.1,'Hauteur'), sill:P(0,'Allège')},
    types:[{nom:'90 × 210', p:{}}, {nom:'Passage 140 × 220', p:{w:1.4, h:2.2}}, {nom:'Trémie technique 30 × 30', p:{w:0.3, h:0.3, sill:1.5}}], cut:{w:'w', h:'h'}, parts:[]},
  'poutre-acier': {nom:'Poutre acier profilé I', cat:'Structure', host:'free', params:{L:P(5,'Longueur'), hp:P(0.2,'Hauteur du profil'), b:P(0.1,'Largeur des ailes'), tw:P(0.0056,'Âme'), tf:P(0.0085,'Ailes'), z0:P(2.5,'Niveau bas')},
    types:[{nom:'IPE 200', p:{hp:0.2, b:0.1, tw:0.0056, tf:0.0085}}, {nom:'IPE 300', p:{hp:0.3, b:0.15, tw:0.0071, tf:0.0107}}, {nom:'HEA 200', p:{hp:0.19, b:0.2, tw:0.0065, tf:0.01}}, {nom:'HEB 300', p:{hp:0.3, b:0.3, tw:0.011, tf:0.019}}],
    parts:[{s:'box', m:'acier', x:'0', y:'-b/2', z:'z0', w:'L', d:'b', h:'tf'}, {s:'box', m:'acier', x:'0', y:'-tw/2', z:'z0+tf', w:'L', d:'tw', h:'hp-2*tf'}, {s:'box', m:'acier', x:'0', y:'-b/2', z:'z0+hp-tf', w:'L', d:'b', h:'tf'}]},
  'poutre-bois': {nom:'Poutre bois lamellé-collé', cat:'Structure', host:'free', params:{L:P(5,'Longueur'), b:P(0.12,'Largeur'), hp:P(0.32,'Hauteur'), z0:P(2.4,'Niveau bas')},
    types:[{nom:'12 × 32', p:{}}, {nom:'16 × 48', p:{b:0.16, hp:0.48}}, {nom:'20 × 60', p:{b:0.2, hp:0.6}}], parts:[{s:'box', m:'glulam', x:'0', y:'-b/2', z:'z0', w:'L', d:'b', h:'hp'}]},
  'poteau-rond': {nom:'Poteau rond', cat:'Structure', host:'free', params:{r:P(0.15,'Rayon'), h:P(2.7,'Hauteur')},
    types:[{nom:'Béton Ø30', p:{}}, {nom:'Acier Ø20', p:{r:0.1}}], parts:[{s:'cyl', m:'ba', x:'0', y:'0', z:'0', r:'r', h:'h'}]},
  'escalier-droit': {nom:'Escalier droit', cat:'Escaliers et garde-corps', host:'free', params:{w:P(0.9,'Largeur'), H:P(2.8,'Hauteur à monter'), g:P(0.27,'Giron'), ep:P(0.04,'Épaisseur des marches')},
    types:[{nom:'Bois 90', p:{}}, {nom:'Béton 100', p:{w:1.0, ep:0.18}}],
    parts:[{s:'box', m:'chene', n:'round(H/0.175)', x:'0', y:'i*g', z:'(i+1)*H/round(H/0.175)-ep', w:'w', d:'g+0.02', h:'ep'},
      {s:'box', m:'chene', x:'-0.05', y:'0', z:'0', w:'0.05', d:'round(H/0.175)*g', h:'H', if:'ep<0.1'}, {s:'box', m:'chene', x:'w', y:'0', z:'0', w:'0.05', d:'round(H/0.175)*g', h:'H', if:'ep<0.1'}]},
  'garde-corps': {nom:'Garde-corps barreaudé', cat:'Escaliers et garde-corps', host:'free', params:{L:P(3,'Longueur'), h:P(1.0,'Hauteur'), e:P(0.11,'Entraxe barreaux')},
    types:[{nom:'Acier 1,00 m', p:{}}], parts:[{s:'box', m:'acier', x:'0', y:'-0.025', z:'h-0.04', w:'L', d:'0.05', h:'0.04'}, {s:'box', m:'acier', x:'0', y:'-0.02', z:'0.08', w:'L', d:'0.04', h:'0.03'},
      {s:'box', m:'acier', n:'floor(L/e)+1', x:'min(i*e, L-0.02)', y:'-0.01', z:'0', w:'0.02', d:'0.02', h:'h-0.04'}]},
  'table': {nom:'Table', cat:'Mobilier', host:'free', params:{w:P(1.6,'Longueur'), d:P(0.9,'Largeur'), h:P(0.75,'Hauteur')},
    types:[{nom:'4 personnes 120 × 80', p:{w:1.2, d:0.8}}, {nom:'6 personnes 160 × 90', p:{}}, {nom:'8 personnes 220 × 100', p:{w:2.2, d:1.0}}],
    parts:[{s:'box', m:'chene', x:'-w/2', y:'-d/2', z:'h-0.04', w:'w', d:'d', h:'0.04'},
      ...[['-w/2+0.04','-d/2+0.04'],['w/2-0.09','-d/2+0.04'],['-w/2+0.04','d/2-0.09'],['w/2-0.09','d/2-0.09']].map(([x,y]) => ({s:'box', m:'chene', x, y, z:'0', w:'0.05', d:'0.05', h:'h-0.04'}))]},
  'chaise': {nom:'Chaise', cat:'Mobilier', host:'free', params:{w:P(0.45,'Largeur'), d:P(0.5,'Profondeur')}, types:[{nom:'Standard', p:{}}],
    parts:[{s:'box', m:'chene', x:'-w/2', y:'-d/2', z:'0.43', w:'w', d:'d', h:'0.04'}, {s:'box', m:'chene', x:'-w/2', y:'d/2-0.04', z:'0.47', w:'w', d:'0.03', h:'0.42'},
      ...[['-w/2','-d/2'],['w/2-0.035','-d/2'],['-w/2','d/2-0.035'],['w/2-0.035','d/2-0.035']].map(([x,y]) => ({s:'box', m:'acier', x, y, z:'0', w:'0.035', d:'0.035', h:'0.43'}))]},
  'lit': {nom:'Lit', cat:'Mobilier', host:'free', params:{w:P(1.6,'Largeur'), L:P(2.0,'Longueur')}, types:[{nom:'Simple 90', p:{w:0.9, L:1.9}}, {nom:'Double 140', p:{w:1.4, L:1.9}}, {nom:'Queen 160', p:{}}],
    parts:[{s:'box', m:'chene', x:'-w/2-0.03', y:'0', z:'0', w:'w+0.06', d:'L', h:'0.3'}, {s:'box', m:'textile', x:'-w/2', y:'0', z:'0.3', w:'w', d:'L', h:'0.22'}, {s:'box', m:'chene', x:'-w/2-0.03', y:'-0.05', z:'0', w:'w+0.06', d:'0.05', h:'1.0'}]},
  'canape': {nom:'Canapé', cat:'Mobilier', host:'free', params:{w:P(2.2,'Longueur'), d:P(0.95,'Profondeur')}, types:[{nom:'3 places', p:{}}, {nom:'2 places', p:{w:1.7}}],
    parts:[{s:'box', m:'textile', x:'-w/2', y:'-d/2', z:'0.1', w:'w', d:'d', h:'0.33'}, {s:'box', m:'textile', x:'-w/2', y:'d/2-0.2', z:'0.43', w:'w', d:'0.2', h:'0.42'},
      {s:'box', m:'textile', x:'-w/2', y:'-d/2', z:'0.43', w:'0.18', d:'d-0.2', h:'0.22'}, {s:'box', m:'textile', x:'w/2-0.18', y:'-d/2', z:'0.43', w:'0.18', d:'d-0.2', h:'0.22'}]},
  'bureau': {nom:'Bureau', cat:'Mobilier', host:'free', params:{w:P(1.4,'Longueur'), d:P(0.7,'Profondeur')}, types:[{nom:'140 × 70', p:{}}, {nom:'160 × 80', p:{w:1.6, d:0.8}}],
    parts:[{s:'box', m:'stratifie', x:'-w/2', y:'-d/2', z:'0.72', w:'w', d:'d', h:'0.03'}, {s:'box', m:'acier', x:'-w/2', y:'-d/2+0.05', z:'0', w:'0.05', d:'d-0.1', h:'0.72'}, {s:'box', m:'acier', x:'w/2-0.05', y:'-d/2+0.05', z:'0', w:'0.05', d:'d-0.1', h:'0.72'}]},
  'armoire': {nom:'Armoire / placard', cat:'Mobilier', host:'free', params:{w:P(1.2,'Largeur'), d:P(0.6,'Profondeur'), h:P(2.2,'Hauteur')}, types:[{nom:'120 cm', p:{}}, {nom:'200 cm', p:{w:2.0}}],
    parts:[{s:'box', m:'mdf', x:'-w/2', y:'-d/2', z:'0', w:'w', d:'d', h:'h'}, {s:'box', m:'inox', n:'max(1, round(w/0.6))', x:'-w/2+(i+1)*w/(max(1, round(w/0.6))+1)-0.01', y:'-d/2-0.03', z:'1.0', w:'0.02', d:'0.03', h:'0.3'}]},
  'cuisine': {nom:'Cuisine linéaire', cat:'Cuisine et sanitaires', host:'free', params:{L:P(2.4,'Longueur'), d:P(0.6,'Profondeur')}, types:[{nom:'2,40 m', p:{}}, {nom:'3,60 m', p:{L:3.6}}],
    parts:[{s:'box', m:'mdf', n:'max(1, round(L/0.6))', x:'i*L/max(1, round(L/0.6))+0.005', y:'0', z:'0.1', w:'L/max(1, round(L/0.6))-0.01', d:'d-0.02', h:'0.76'},
      {s:'box', m:'pierreSol', x:'0', y:'-0.02', z:'0.86', w:'L', d:'d+0.02', h:'0.04'}, {s:'box', m:'inox', x:'L/2-0.4', y:'0.1', z:'0.9', w:'0.8', d:'0.45', h:'0.005'},
      {s:'box', m:'mdf', n:'max(1, round(L/0.6))', x:'i*L/max(1, round(L/0.6))+0.005', y:'0.25', z:'1.5', w:'L/max(1, round(L/0.6))-0.01', d:'0.35', h:'0.7'}]},
  'wc': {nom:'WC suspendu', cat:'Cuisine et sanitaires', host:'free', params:{}, types:[{nom:'Standard', p:{}}],
    parts:[{s:'box', m:'faience', x:'-0.18', y:'0', z:'0.25', w:'0.36', d:'0.54', h:'0.16'}, {s:'box', m:'ba13', x:'-0.3', y:'0.5', z:'0', w:'0.6', d:'0.2', h:'1.1'}]},
  'lavabo': {nom:'Lavabo sur meuble', cat:'Cuisine et sanitaires', host:'free', params:{w:P(0.8,'Largeur')}, types:[{nom:'60 cm', p:{w:0.6}}, {nom:'80 cm', p:{}}],
    parts:[{s:'box', m:'mdf', x:'-w/2', y:'0', z:'0.3', w:'w', d:'0.46', h:'0.5'}, {s:'box', m:'faience', x:'-w/2', y:'-0.01', z:'0.8', w:'w', d:'0.48', h:'0.06'}, {s:'cyl', m:'inox', x:'0', y:'0.4', z:'0.86', r:'0.015', h:'0.2'}]},
  'douche': {nom:'Douche à l\'italienne', cat:'Cuisine et sanitaires', host:'free', params:{w:P(0.9,'Largeur'), d:P(1.2,'Longueur')}, types:[{nom:'90 × 120', p:{}}, {nom:'120 × 120', p:{w:1.2}}],
    parts:[{s:'box', m:'carrelage', x:'0', y:'0', z:'0', w:'w', d:'d', h:'0.02'}, {s:'box', m:'verre', x:'w-0.01', y:'0', z:'0.02', w:'0.01', d:'d*0.7', h:'2.0'}]},
  'baignoire': {nom:'Baignoire', cat:'Cuisine et sanitaires', host:'free', params:{w:P(0.75,'Largeur'), L:P(1.7,'Longueur')}, types:[{nom:'170 × 75', p:{}}, {nom:'180 × 80', p:{L:1.8, w:0.8}}],
    parts:[{s:'box', m:'faience', x:'0', y:'0', z:'0', w:'L', d:'w', h:'0.58'}]},
  'palette': {nom:'Palette Europe chargée', cat:'Industrie', host:'free', params:{hc:P(1.0,'Hauteur de charge')}, types:[{nom:'Charge 1,00 m', p:{}}, {nom:'Vide', p:{hc:0}}],
    parts:[{s:'box', m:'bois', x:'0', y:'0', z:'0', w:'1.2', d:'0.8', h:'0.144'}, {s:'box', m:'textile', x:'0.02', y:'0.02', z:'0.144', w:'1.16', d:'0.76', h:'hc', if:'hc>0'}]},
  'rayonnage': {nom:'Rayonnage à palettes', cat:'Industrie', host:'free', params:{L:P(2.7,'Longueur de travée'), d:P(1.1,'Profondeur'), n:P(4,'Niveaux', ''), e:P(1.5,'Hauteur entre lisses')},
    types:[{nom:'4 niveaux', p:{}}, {nom:'5 niveaux', p:{n:5}}],
    parts:[{s:'box', m:'acier', x:'0', y:'0', z:'0', w:'0.1', d:'d', h:'n*e'}, {s:'box', m:'acier', x:'L+0.1', y:'0', z:'0', w:'0.1', d:'d', h:'n*e'},
      {s:'box', m:'acier', n:'n', x:'0.1', y:'0', z:'(i+1)*e-0.12', w:'L', d:'0.05', h:'0.12'}, {s:'box', m:'acier', n:'n', x:'0.1', y:'d-0.05', z:'(i+1)*e-0.12', w:'L', d:'0.05', h:'0.12'}]},
  'cuve': {nom:'Cuve cylindrique', cat:'Industrie', host:'free', params:{r:P(1.2,'Rayon'), h:P(4,'Hauteur')}, types:[{nom:'Ø2,4 × 4', p:{}}, {nom:'Ø3 × 6', p:{r:1.5, h:6}}],
    parts:[{s:'cyl', m:'inox', x:'0', y:'0', z:'0', r:'r', h:'h'}]},
  'machine': {nom:'Machine-outil (encombrement)', cat:'Industrie', host:'free', params:{w:P(2.5,'Longueur'), d:P(1.6,'Largeur'), h:P(2.0,'Hauteur')}, types:[{nom:'Centre d\'usinage', p:{}}],
    parts:[{s:'box', m:'acier', x:'-w/2', y:'-d/2', z:'0', w:'w', d:'d', h:'h*0.75'}, {s:'box', m:'verre', x:'-w/2+0.1', y:'-d/2-0.01', z:'h*0.3', w:'w-0.2', d:'0.02', h:'h*0.4'}, {s:'box', m:'acier', x:'w/2-0.4', y:'-d/2', z:'h*0.75', w:'0.4', d:'0.4', h:'h*0.25'}]},
  'arbre': {nom:'Arbre', cat:'Extérieur', host:'free', params:{h:P(6,'Hauteur'), r:P(1.8,'Rayon du houppier')}, types:[{nom:'Feuillu 6 m', p:{}}, {nom:'Jeune 3 m', p:{h:3, r:0.9}}],
    parts:[{s:'cyl', m:'chene', x:'0', y:'0', z:'0', r:'0.12', h:'h*0.55'}, {s:'sph', m:'vegetal', x:'0', y:'0', z:'h-r', r:'r'}]},
  'voiture': {nom:'Voiture (gabarit)', cat:'Extérieur', host:'free', params:{}, types:[{nom:'Berline', p:{}}],
    parts:[{s:'box', m:'acier', x:'-2.3', y:'-0.9', z:'0.25', w:'4.6', d:'1.8', h:'0.75'}, {s:'box', m:'verre', x:'-1.2', y:'-0.8', z:'1.0', w:'2.3', d:'1.6', h:'0.45'},
      ...[['-1.5','-0.95'],['1.4','-0.95'],['-1.5','0.75'],['1.4','0.75']].map(([x,y]) => ({s:'cyl', m:'caoutchouc', x, y, z:'0', r:'0.32', h:'0.2'}))]},
  'banc-assemblage': {nom:'Ensemble repas (assemblage)', cat:'Mobilier', host:'free', params:{w:P(1.6,'Longueur de table')}, types:[{nom:'6 places', p:{}}],
    parts:[{fam:'table', p:{w:'w', d:'0.9'}, x:'0', y:'0', z:'0', rot:'0'}, {fam:'chaise', n:'3', x:'-w/2+(i+0.5)*w/3', y:'-0.75', z:'0', rot:'180'}, {fam:'chaise', n:'3', x:'-w/2+(i+0.5)*w/3', y:'0.75', z:'0', rot:'0'}]},
};
