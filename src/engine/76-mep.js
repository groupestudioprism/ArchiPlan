/* ============ Plomberie · Électricité · Ventilation · Chauffage ============
   1) Éléments placeables à la main : familles (catégories Électricité, Plomberie, Ventilation, Chauffage) dans la bibliothèque.
   2) Mode automatique (77-mep-auto.js) : pièces nommées → proposition modifiable en plan → pose ; puis génération des réseaux.
   3) Réseaux : éléments « net » (polylignes 3D à section carrée équivalente) comptés au DQE et exportés en IFC.
   Règles (France, repères de pré-dimensionnement, à valider par un bureau d'études / un électricien / un plombier) :
   - NF C 15-100 : prises par pièce (séjour 1 par 4 m² mini. 5, > 28 m² mini. 7 ; chambre 3 ; cuisine 6 dont 4 au-dessus du plan de travail, 3 si ≤ 4 m² ;
     autre pièce > 4 m² : 1 ; WC : 0 ; salle d'eau : 1 hors volumes), circuits spécialisés 20 A / 2,5 mm² (four, lave-linge, lave-vaisselle, sèche-linge, chauffe-eau),
     plaque de cuisson 32 A / 6 mm², éclairage 16 A / 1,5 mm² (8 points max.), prises 16 A / 1,5 mm² (8 max.) ou 20 A / 2,5 mm² (12 max.), 1 interrupteur différentiel 30 mA par rangée
     (8 circuits max. par différentiel), 20 % de réserve, rangées de 13 modules ; prises à 5 cm mini. et 1,30 m maxi. du sol, interrupteurs à 1,10 m ; hotte à 1,80 m ;
   - DTU 60.1 / 60.11 : évacuations EU pente ≥ 1 cm/m (2 cm/m retenu), Ø 100 pour WC, Ø 40 pour lavabo, douche, baignoire, évier, lave-linge ; eau chaude et froide espacées de 2 cm ;
     PER Ø 12 (lavabo, évier, lave-linge, WC) et Ø 16 (douche, baignoire, ballon) ; croisement eau potable / eaux usées : eau potable au-dessus ;
   - Arrêté du 24 mars 1982 : extraction dans les pièces de service (cuisine 75 à 135 m³/h, salle de bain 15, WC 15), entrées d'air dans les pièces principales, débit total mini. 35 à 120 m³/h ;
   - Eau chaude : ≈ 50 à 60 l par personne et par jour (ballon 100 l pour 1 à 2 personnes, 150 l pour 2 à 3, 200 l pour 3 à 4, 250 à 300 l au-delà). */

/* ---------- matériaux des réseaux ---------- */
(() => { const add = (id, nom, col) => { if (!MATS[id]) M(id, nom, 'Verre et plastiques', 950, 0.4, 2000, 1e5, col, 'plain', 2.5); };
  add('resEF', 'Réseau eau froide (PER bleu)', '#2F7FD6'); add('resECS', 'Réseau eau chaude (PER rouge)', '#D6402F'); add('resEU', 'Évacuation PVC', '#8A7F72');
  add('resElec', 'Câblage électrique', '#E3A21A'); add('resVMC', 'Gaine de ventilation', '#9AA6B2'); add('resChauf', 'Réseau chauffage (PER)', '#B8476B'); })();

/* ---------- familles ---------- */
const MEP_CATS = ['Électricité', 'Plomberie', 'Ventilation', 'Chauffage'];
const MEP_FAMS = (() => {
  const Z = (n = 0.3) => ({zh:P(n, 'Hauteur d\'installation')});
  const wall = (o, z, w = 0.08, h = 0.08, m = 'pvc') => ({s:'box', m, x:`-${w / 2}`, y:'-0.012', z:String(z), w:String(w), d:'0.012', h:String(h)});
  return {
    'e-prise': {nom:'Prise de courant 2P+T', cat:'Électricité', host:'free', params:Z(0.3), types:[{nom:'16 A', p:{}}, {nom:'20 A', p:{}}], price:28, parts:[wall(0, 'zh'), {s:'box', m:'acierLaque', x:'-0.015', y:'-0.016', z:'zh+0.025', w:'0.03', d:'0.004', h:'0.03'}]},
    'e-prise-spec': {nom:'Prise spécialisée 20 A (four, lave-linge, lave-vaisselle…)', cat:'Électricité', host:'free', params:Z(0.3), types:[{nom:'20 A', p:{}}], price:42, parts:[wall(0, 'zh', 0.09, 0.09), {s:'box', m:'acierLaque', x:'-0.02', y:'-0.016', z:'zh+0.025', w:'0.04', d:'0.004', h:'0.04'}]},
    'e-prise32': {nom:'Sortie plaque de cuisson 32 A', cat:'Électricité', host:'free', params:Z(0.12), types:[{nom:'32 A', p:{}}], price:65, parts:[wall(0, 'zh', 0.1, 0.1, 'acierLaque')]},
    'e-rj45': {nom:'Prise RJ45 / TV', cat:'Électricité', host:'free', params:Z(0.3), types:[{nom:'RJ45', p:{}}], price:34, parts:[wall(0, 'zh', 0.08, 0.08, 'acierLaque')]},
    'e-inter': {nom:'Interrupteur', cat:'Électricité', host:'free', params:Z(1.1), types:[{nom:'Simple allumage', p:{}}, {nom:'Va-et-vient', p:{}}], price:24, parts:[wall(0, 'zh'), {s:'box', m:'acierLaque', x:'-0.015', y:'-0.016', z:'zh+0.02', w:'0.03', d:'0.004', h:'0.04'}]},
    'e-lum': {nom:'Luminaire plafonnier', cat:'Électricité', host:'free', params:{hc:P(2.5, 'Hauteur du plafond'), r:P(0.15, 'Rayon')}, types:[{nom:'Plafonnier', p:{}}], price:60, parts:[{s:'cyl', m:'pvc', x:'0', y:'0', z:'hc-0.06', r:'r', h:'0.06'}]},
    'e-spot': {nom:'Spot encastré', cat:'Électricité', host:'free', params:{hc:P(2.5, 'Hauteur du plafond')}, types:[{nom:'Spot LED', p:{}}], price:22, parts:[{s:'cyl', m:'alu', x:'0', y:'0', z:'hc-0.03', r:'0.045', h:'0.03'}]},
    'e-applique': {nom:'Applique murale', cat:'Électricité', host:'free', params:Z(1.8), types:[{nom:'Applique', p:{}}], price:55, parts:[{s:'box', m:'alu', x:'-0.1', y:'-0.1', z:'zh', w:'0.2', d:'0.1', h:'0.1'}]},
    'e-daaf': {nom:'Détecteur avertisseur de fumée (DAAF)', cat:'Électricité', host:'free', params:{hc:P(2.5, 'Hauteur du plafond')}, types:[{nom:'DAAF NF EN 14604', p:{}}], price:25, parts:[{s:'cyl', m:'pvc', x:'0', y:'0', z:'hc-0.04', r:'0.05', h:'0.04'}]},
    'e-tableau': {nom:'Tableau électrique (GTL)', cat:'Électricité', host:'free', params:{rg:P(3, 'Rangées de 13 modules', ''), zh:P(0.2, 'Hauteur de pose')}, types:[{nom:'Tableau 3 rangées', p:{}}, {nom:'Tableau 2 rangées', p:{rg:2}}, {nom:'Tableau 4 rangées', p:{rg:4}}], price:'250+rg*160',
      parts:[{s:'box', m:'acierLaque', x:'-0.2', y:'-0.1', z:'zh', w:'0.4', d:'0.1', h:'0.15*rg+0.2'}, {s:'box', m:'alu', x:'-0.2', y:'-0.1', z:'zh+1.8', w:'0.4', d:'0.1', h:'0.2'}]},
    'p-ballon': {nom:'Chauffe-eau (ballon d\'eau chaude)', cat:'Plomberie', host:'free', params:{V:P(200, 'Volume (l)', 'l'), r:P(0.28, 'Rayon'), h:P(1.5, 'Hauteur')}, price:'450+V*3.5',
      types:[{nom:'100 l', p:{V:100, r:0.23, h:1.0}}, {nom:'150 l', p:{V:150, r:0.26, h:1.2}}, {nom:'200 l', p:{}}, {nom:'250 l', p:{V:250, r:0.3, h:1.6}}, {nom:'300 l', p:{V:300, r:0.32, h:1.75}}],
      parts:[{s:'cyl', m:'acierLaque', x:'0', y:'-r', z:'0', r:'r', h:'h'}, {s:'cyl', m:'inox', x:'0', y:'-r', z:'h', r:'r*0.3', h:'0.06'}]},
    'p-arrivee': {nom:'Arrivée d\'eau (compteur et vanne)', cat:'Plomberie', host:'free', params:Z(0.6), types:[{nom:'Compteur', p:{}}], price:180, parts:[{s:'box', m:'inox', x:'-0.12', y:'-0.12', z:'zh', w:'0.24', d:'0.12', h:'0.18'}]},
    'p-attente-ll': {nom:'Attente lave-linge / lave-vaisselle', cat:'Plomberie', host:'free', params:Z(0.5), types:[{nom:'Arrivée + évacuation', p:{}}], price:85, parts:[{s:'box', m:'inox', x:'-0.1', y:'-0.06', z:'zh', w:'0.2', d:'0.06', h:'0.12'}]},
    'v-extraction': {nom:'Bouche d\'extraction VMC', cat:'Ventilation', host:'free', params:{hc:P(2.5, 'Hauteur du plafond'), q:P(15, 'Débit (m³/h)', 'm³/h')}, types:[{nom:'Salle de bain / WC 15 m³/h', p:{}}, {nom:'Cuisine 90 m³/h', p:{q:90}}], price:45, parts:[{s:'cyl', m:'pvc', x:'0', y:'0', z:'hc-0.05', r:'0.075', h:'0.05'}]},
    'v-entree': {nom:'Entrée d\'air (grille autoréglable)', cat:'Ventilation', host:'free', params:Z(2.2), types:[{nom:'Entrée d\'air 30 m³/h', p:{}}], price:30, parts:[{s:'box', m:'pvc', x:'-0.15', y:'-0.02', z:'zh', w:'0.3', d:'0.02', h:'0.04'}]},
    'v-caisson': {nom:'Caisson VMC', cat:'Ventilation', host:'free', params:{zh:P(2.5, 'Hauteur de pose')}, types:[{nom:'VMC simple flux hygroréglable', p:{}}, {nom:'VMC double flux', p:{}}], price:'420',
      parts:[{s:'box', m:'acierLaque', x:'-0.3', y:'-0.2', z:'zh', w:'0.6', d:'0.4', h:'0.3'}]},
    'c-rad': {nom:'Radiateur', cat:'Chauffage', host:'free', params:{W:P(1000, 'Puissance (W)', 'W'), L:P(0.8, 'Longueur'), h:P(0.6, 'Hauteur')}, price:'90+W*0.18',
      types:[{nom:'Eau chaude 500 W', p:{W:500, L:0.5}}, {nom:'Eau chaude 1000 W', p:{}}, {nom:'Eau chaude 1500 W', p:{W:1500, L:1.1}}, {nom:'Eau chaude 2000 W', p:{W:2000, L:1.5}}, {nom:'Électrique 1000 W', p:{}}, {nom:'Électrique 1500 W', p:{W:1500, L:1.0}}],
      parts:[{s:'box', m:'acierLaque', x:'-L/2', y:'-0.1', z:'0.15', w:'L', d:'0.1', h:'h'}]},
    'c-seche': {nom:'Sèche-serviettes', cat:'Chauffage', host:'free', params:{W:P(750, 'Puissance (W)', 'W')}, types:[{nom:'750 W', p:{}}], price:280, parts:[{s:'box', m:'acierLaque', x:'-0.25', y:'-0.1', z:'0.4', w:'0.5', d:'0.1', h:'1.2'}]},
    'c-pac': {nom:'Pompe à chaleur / chaudière (générateur)', cat:'Chauffage', host:'free', params:{kW:P(8, 'Puissance (kW)', 'kW')}, price:'3000+kW*600',
      types:[{nom:'PAC air/eau 8 kW', p:{}}, {nom:'PAC air/eau 12 kW', p:{kW:12}}, {nom:'Chaudière gaz 24 kW', p:{kW:24}}], parts:[{s:'box', m:'acierLaque', x:'-0.3', y:'-0.6', z:'0', w:'0.6', d:'0.6', h:'1.1'}]},
  };
})();
Object.assign(FAMS, MEP_FAMS); MEP_CATS.forEach(c => { if (!FAM_CATS.includes(c)) FAM_CATS.push(c); });
/* nature d'un composant pour la logique des réseaux */
const MEP_KIND = {'e-prise':'prise', 'e-prise-spec':'spec', 'e-prise32':'plaque', 'e-rj45':'rj45', 'e-inter':'inter', 'e-lum':'lum', 'e-spot':'spot', 'e-applique':'applique', 'e-tableau':'tableau', 'e-daaf':'daaf',
  'p-ballon':'ballon', 'p-arrivee':'arrivee', 'p-attente-ll':'ll', wc:'wc', lavabo:'lavabo', douche:'douche', baignoire:'baignoire', cuisine:'cuisine', 'v-extraction':'vext', 'v-entree':'ventree', 'v-caisson':'vmc', 'c-rad':'rad', 'c-seche':'seche', 'c-pac':'pac'};
const mepKindOf = el => el.kind === 'inst' ? MEP_KIND[el.fam] || null : null;
const mepEls = () => state.els.filter(e => mepKindOf(e));
/* points d'eau : [hauteur EF, hauteur ECS (ou null), Ø évacuation, Ø alimentation] */
const WATER_PTS = {wc:[0.25, null, 100, 12], lavabo:[0.55, 0.55, 40, 12], douche:[1.0, 1.0, 40, 16], baignoire:[0.5, 0.5, 40, 16], cuisine:[0.55, 0.55, 40, 12], ll:[0.5, null, 40, 12]};

/* ---------- réseaux ---------- */
const NET_SYS = {ef:{n:'Eau froide', mat:'PER', m:'resEF', lot:'12', kg:0.1}, ecs:{n:'Eau chaude sanitaire', mat:'PER', m:'resECS', lot:'12', kg:0.1}, eu:{n:'Évacuation eaux usées', mat:'PVC', m:'resEU', lot:'12', kg:1.2},
  elec:{n:'Câblage électrique', mat:'cuivre', m:'resElec', lot:'15', kg:0.12}, vmc:{n:'Gaine de ventilation', mat:'acier galvanisé / PVC', m:'resVMC', lot:'16', kg:0.8}, chauf:{n:'Réseau de chauffage', mat:'PER', m:'resChauf', lot:'17', kg:0.15}};
const netLen = el => (el.pts || []).reduce((t, p, i) => i ? t + Math.hypot(p[0] - el.pts[i - 1][0], p[1] - el.pts[i - 1][1], p[2] - el.pts[i - 1][2]) : 0, 0);
const netName = el => `${NET_SYS[el.sys]?.n || 'Réseau'}${el.label ? ' · ' + el.label : ''} ${el.sec ? el.sec + ' mm²' : 'Ø' + el.d}`;
const netDetail = el => el.sec ? `section ${el.sec} mm²${el.label ? ' · ' + el.label : ''}` : `Ø ${el.d} mm`;
const NET_PRICE = {ef:{12:6.5, 16:8, 20:10, 25:13}, ecs:{12:8, 16:10, 20:12.5, 25:16}, eu:{40:13, 50:15, 100:30}, vmc:{80:9, 125:14, 160:19, 200:26}, chauf:{16:10, 20:13, 25:16}, elec:{1.5:2.5, 2.5:3.4, 6:6.5, 10:9.5}};
const netPrice = el => { const T = NET_PRICE[el.sys] || {}, k = el.sec || el.d; const keys = Object.keys(T).map(Number).sort((a, b) => a - b); const best = keys.find(x => x >= k) ?? keys.at(-1); return (T[best] ?? 10) * (el.sys === 'vmc' || el.sys === 'eu' ? 1 : 1) + 4.5; };   // + pose (ml)
function netPieces(el){
  const S = NET_SYS[el.sys] || NET_SYS.ec || NET_SYS.elec, out = [], d = Math.max(0.03, (el.d || 12) / 1000), P = el.pts || [];
  for (let i = 0; i + 1 < P.length; i++){
    const A = P[i], B = P[i + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]); if (L < 1e-4) continue;
    const lift = Math.abs(B[2] - A[2]) < L * 0.5 ? d / 2 : 0;
    const pc = memberPiece({A:[A[0], A[1], A[2] + lift], B:[B[0], B[1], B[2] + lift], w:d, h:d, kind:'net', id:''});
    out.push({...pc, mat:S.m, lot:({'12':'Plomberie', '15':'Électricité', '16':'Ventilation', '17':'Chauffage'})[S.lot] || 'Plomberie', net:true});
  }
  return out;
}
function netPanel(el){
  const S = NET_SYS[el.sys] || {}, L = netLen(el), P = el.pts || [], slope = P.length > 1 && el.sys === 'eu' ? (() => { let h = 0, l = 0; for (let i = 0; i + 1 < P.length; i++){ const dz = P[i][2] - P[i + 1][2], dl = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); if (dl > 0.05 && Math.abs(dz) / dl < 0.2){ h += dz; l += dl; } } return l ? h / l : 0; })() : null;
  return `<div class="grp"><h3>Réseau</h3><dl class="kv"><dt>Type</dt><dd>${esc(S.n || '')}</dd><dt>Désignation</dt><dd>${esc(el.label || '—')}</dd><dt>${el.sec ? 'Section' : 'Diamètre'}</dt><dd>${el.sec ? el.sec + ' mm²' : 'Ø ' + el.d + ' mm'}</dd>
    <dt>Longueur développée</dt><dd class="big">${nf(L, 2)} m</dd>${slope != null ? `<dt>Pente moyenne</dt><dd>${nf(slope * 100, 1)} % ${slope * 100 >= 1 ? '(≥ 1 %, conforme)' : '(inférieure à 1 % : à corriger)'}</dd>` : ''}${el.note ? `<dt>Règle</dt><dd>${esc(el.note)}</dd>` : ''}</dl></div>
    <div class="btns"><button class="btn" data-act="mepNets">Régénérer tous les réseaux</button><button class="btn danger" data-act="del">Supprimer</button></div>`;
}

/* ---------- carte du panneau Projet ---------- */
function mepCard(){
  const n = mepEls().length, nets = state.els.filter(e => e.kind === 'net').length;
  return `<div class="grp"><h3>Plomberie · Électricité · Ventilation · Chauffage</h3>
    <p class="hint">${n ? `${n} équipement${n > 1 ? 's' : ''} placé${n > 1 ? 's' : ''}, ${nets} tronçon${nets > 1 ? 's' : ''} de réseau.` : 'Placez les équipements à la main (bibliothèque) ou laissez le site proposer une implantation selon vos pièces.'}</p>
    <div class="btns tight"><button class="btn primary" data-act="mepAuto">Proposition automatique…</button><button class="btn" data-act="mepLib">Placer à la main</button><button class="btn" data-act="mepNets"${n ? '' : ' disabled'}>Générer les réseaux</button>${nets ? '<button class="btn ghost" data-act="mepClear">Effacer les réseaux</button>' : ''}</div></div>`;
}
