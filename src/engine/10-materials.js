/* ============ Bibliothèque de matériaux ============
   Valeurs indicatives (ordre de grandeur des règles Th-U, EN ISO 10456, bases INIES / ICE) à remplacer par les fiches
   techniques des produits retenus. rho kg/m³ · lambda W/m·K · c J/kg·K · mu facteur de résistance à la vapeur (−) ·
   gwp kg CO2e/kg (production A1-A3, carbone biogénique non compté) · R résistance fixe (m²·K/W) pour les lames d'air.
   tex : motif de texture procédurale du rendu réaliste ; tx/ty taille du motif (m). */
const MAT_CATS = ['Maçonnerie', 'Béton et mortiers', 'Isolants', 'Bois et dérivés', 'Plâtre et plaques', 'Métaux', 'Verre et plastiques',
  'Revêtements de sol', 'Couverture et étanchéité', 'Lames d\'air et divers'];
const MATS = {};
function M(id, nom, cat, rho, lambda, c, mu, color, tex, gwp, extra = {}){ MATS[id] = {nom, cat, rho, lambda, c, mu, color, tex, gwp, rough:0.9, ...extra}; }
// ---- Maçonnerie
M('parpaing',   'Bloc béton creux B40',               'Maçonnerie', 1350, 1.00, 1000, 10,  '#BDB6A8', 'block',    0.10, {tx:0.5, ty:0.2});
M('parpaingP',  'Bloc béton plein',                   'Maçonnerie', 2000, 1.40, 1000, 15,  '#B3AC9F', 'block',    0.11, {tx:0.5, ty:0.2});
M('brique',     'Brique terre cuite alvéolaire',      'Maçonnerie', 800,  0.40, 1000, 10,  '#C47A52', 'brickbig', 0.24, {tx:0.5, ty:0.25});
M('briqueTh',   'Brique monomur R≥1 (37,5 cm)',       'Maçonnerie', 650,  0.12, 1000, 6,   '#C98258', 'brickbig', 0.26, {tx:0.25, ty:0.25});
M('briqueP',    'Brique pleine terre cuite',          'Maçonnerie', 1800, 0.80, 1000, 16,  '#B5603F', 'brick',    0.24, {tx:0.22, ty:0.065});
M('betCell',    'Béton cellulaire',                   'Maçonnerie', 450,  0.11, 1000, 6,   '#E4E2DC', 'block',    0.28, {tx:0.625, ty:0.25});
M('pierreCalc', 'Pierre calcaire ferme',              'Maçonnerie', 2200, 1.70, 1000, 40,  '#D9CDB4', 'stone',    0.08, {tx:0.6, ty:0.3});
M('pierreTend', 'Pierre calcaire tendre',             'Maçonnerie', 1800, 1.10, 1000, 25,  '#E3D8BF', 'stone',    0.07, {tx:0.6, ty:0.3});
M('granit',     'Granit',                             'Maçonnerie', 2700, 2.80, 1000, 10000,'#9C9A98','stone',    0.10, {tx:0.6, ty:0.3});
M('moellon',    'Moellons hourdés',                   'Maçonnerie', 2100, 1.40, 1000, 30,  '#BFB29A', 'stone',    0.06, {tx:0.4, ty:0.25});
M('terreCrue',  'Terre crue (pisé)',                  'Maçonnerie', 1900, 1.10, 1000, 8,   '#B58A5E', 'earth',    0.02);
M('btc',        'Brique de terre compressée (BTC)',   'Maçonnerie', 1900, 1.00, 1000, 8,   '#B98D62', 'brick',    0.05, {tx:0.3, ty:0.1});
M('briqueVerre','Brique de verre',                    'Maçonnerie', 2500, 1.00, 750,  10000,'#BFE3EC','tile',     0.9,  {tx:0.19, ty:0.19, opacity:0.55, rough:0.1});
// ---- Béton et mortiers
M('ba',         'Béton armé C25/30',                  'Béton et mortiers', 2500, 2.30, 1000, 130, '#A9AEB1', 'concrete', 0.16);
M('beton',      'Béton non armé',                     'Béton et mortiers', 2300, 1.75, 1000, 100, '#B0B3B3', 'concrete', 0.13);
M('betonLeg',   'Béton léger de granulats',           'Béton et mortiers', 1200, 0.52, 1000, 15,  '#BDBDB6', 'concrete', 0.14);
M('betonChanvre','Béton de chanvre',                  'Béton et mortiers', 400,  0.07, 1500, 5,   '#C9BB93', 'insulboard',0.15);
M('betonCire',  'Béton ciré (revêtement)',            'Béton et mortiers', 2000, 1.60, 1000, 100, '#9FA3A6', 'concrete', 0.2,  {rough:0.45});
M('mortier',    'Mortier de ciment',                  'Béton et mortiers', 1800, 1.15, 1000, 20,  '#C8C3B8', 'plaster',  0.20);
M('enduit',     'Enduit ciment',                      'Béton et mortiers', 1800, 1.15, 1000, 15,  '#E7E1D3', 'plaster',  0.20);
M('enduitChaux','Enduit chaux',                       'Béton et mortiers', 1600, 0.80, 1000, 10,  '#EFE8D8', 'plaster',  0.15);
M('enduitPlatre','Enduit plâtre',                     'Béton et mortiers', 1200, 0.57, 1000, 10,  '#F4F1EA', 'plaster',  0.12);
M('chape',      'Chape ciment',                       'Béton et mortiers', 2000, 1.40, 1000, 50,  '#9C978E', 'concrete', 0.17);
M('chapeAnhy',  'Chape anhydrite',                    'Béton et mortiers', 2000, 1.20, 1000, 20,  '#B9B3A4', 'concrete', 0.10);
// ---- Isolants
M('laineVerre', 'Laine de verre',                     'Isolants', 15,  0.035, 1030, 1,  '#E8D56F', 'insul', 1.35);
M('laine',      'Laine de roche',                     'Isolants', 40,  0.035, 1030, 1,  '#D8BF6E', 'insul', 1.28);
M('laineRocheD','Laine de roche haute densité (ITE)', 'Isolants', 140, 0.038, 1030, 1,  '#CBB062', 'insulboard', 1.28);
M('pse',        'Polystyrène expansé PSE',            'Isolants', 20,  0.032, 1450, 60, '#E9EEF0', 'insulboard', 3.29);
M('pseG',       'PSE graphité',                       'Isolants', 18,  0.031, 1450, 60, '#B8BCC2', 'insulboard', 3.30);
M('xps',        'Polystyrène extrudé XPS',            'Isolants', 32,  0.032, 1450, 150,'#A9CBE4', 'insulboard', 3.40);
M('pir',        'Polyuréthane PIR (parements alu)',   'Isolants', 32,  0.022, 1400, 60, '#E7D9A8', 'insulboard', 3.48);
M('fibreBoisR', 'Fibre de bois rigide',               'Isolants', 160, 0.040, 2100, 5,  '#B48A5A', 'insulboard', 0.25);
M('fibreBoisS', 'Fibre de bois souple',               'Isolants', 50,  0.038, 2100, 2,  '#BE966A', 'insul', 0.25);
M('ouate',      'Ouate de cellulose insufflée',       'Isolants', 45,  0.040, 1900, 2,  '#BFBDB6', 'insul', 0.10);
M('chanvre',    'Laine de chanvre',                   'Isolants', 35,  0.040, 1700, 2,  '#BFAF86', 'insul', 0.15);
M('liege',      'Liège expansé',                      'Isolants', 110, 0.040, 1800, 10, '#7E5B3E', 'insulboard', 0.19);
M('laineMouton','Laine de mouton',                    'Isolants', 25,  0.040, 1300, 2,  '#EAE3D2', 'insul', 0.10);
M('verreCell',  'Verre cellulaire',                   'Isolants', 120, 0.040, 1000, 100000,'#3E4246','insulboard', 1.40);
M('paille',     'Botte de paille',                    'Isolants', 100, 0.052, 1600, 2,  '#D9C07A', 'insul', 0.06);
M('aerogel',    'Aérogel de silice (panneau)',        'Isolants', 150, 0.015, 1000, 5,  '#DDE6EC', 'insulboard', 5.00);
M('pu',         'Mousse polyuréthane projetée',       'Isolants', 35,  0.027, 1400, 60, '#EADBA1', 'insulboard', 3.50);
// ---- Bois et dérivés
M('bois',       'Bois résineux (épicéa, sapin)',      'Bois et dérivés', 450, 0.13, 1600, 50,  '#D8B27A', 'wood', 0.26, {tx:1.2, ty:0.2});
M('chene',      'Bois feuillu (chêne)',               'Bois et dérivés', 700, 0.18, 1600, 50,  '#B88A57', 'wood', 0.30, {tx:1.2, ty:0.2});
M('douglas',    'Douglas',                            'Bois et dérivés', 530, 0.13, 1600, 50,  '#C99665', 'wood', 0.26, {tx:1.2, ty:0.2});
M('meleze',     'Mélèze',                             'Bois et dérivés', 600, 0.14, 1600, 50,  '#C3925C', 'wood', 0.26, {tx:1.2, ty:0.2});
M('clt',        'Bois lamellé croisé CLT',            'Bois et dérivés', 470, 0.13, 1600, 50,  '#D3A86A', 'woodpanel', 0.40);
M('glulam',     'Lamellé-collé GL24h',                'Bois et dérivés', 450, 0.13, 1600, 50,  '#D6AE72', 'wood', 0.38, {tx:1.2, ty:0.2});
M('osb',        'Panneau OSB/3',                      'Bois et dérivés', 600, 0.13, 1700, 200, '#CDA766', 'osb',  0.45);
M('contreplaque','Contreplaqué',                      'Bois et dérivés', 500, 0.13, 1600, 150, '#D9B47D', 'woodpanel', 0.68);
M('mdf',        'Panneau MDF',                        'Bois et dérivés', 750, 0.14, 1700, 20,  '#B99B78', 'plain', 0.72);
M('agglo',      'Panneau de particules',              'Bois et dérivés', 650, 0.14, 1700, 50,  '#C8AE86', 'osb',  0.55);
M('fibroCiment','Plaque fibres-ciment',               'Bois et dérivés', 1500, 0.35, 1050, 50, '#A8A8A2', 'plain', 0.60);
M('bardageBois','Bardage bois (lames)',               'Bois et dérivés', 500, 0.13, 1600, 50,  '#9C7348', 'cladding', 0.26, {tx:1, ty:0.15});
// ---- Plâtre et plaques
M('ba13',       'Plaque de plâtre BA13',              'Plâtre et plaques', 800, 0.25, 1000, 10, '#F2F0EA', 'plaster', 0.39);
M('ba13H',      'Plaque de plâtre hydrofuge (H1)',    'Plâtre et plaques', 850, 0.25, 1000, 10, '#DCEBDD', 'plaster', 0.42);
M('ba13F',      'Plaque de plâtre feu (DF)',          'Plâtre et plaques', 900, 0.25, 1000, 10, '#F3DEDE', 'plaster', 0.42);
M('carreauPl',  'Carreau de plâtre',                  'Plâtre et plaques', 1000, 0.40, 1000, 6, '#F1EFE9', 'block',   0.15, {tx:0.666, ty:0.5});
M('fermacell',  'Plaque gypse-fibres',                'Plâtre et plaques', 1150, 0.32, 1100, 13,'#EDE7DB', 'plaster', 0.30);
// ---- Métaux
M('acier',      'Acier S235',                         'Métaux', 7850, 50,  450, 1e6, '#8C96A2', 'metal', 1.55, {rough:0.35, metal:0.85});
M('inox',       'Acier inoxydable',                   'Métaux', 7900, 17,  500, 1e6, '#B9C0C6', 'metal', 4.40, {rough:0.25, metal:0.95});
M('alu',        'Aluminium 6060',                     'Métaux', 2700, 160, 880, 1e6, '#C3CAD2', 'metal', 6.70, {rough:0.3, metal:0.9});
M('cuivre',     'Cuivre',                             'Métaux', 8900, 380, 380, 1e6, '#B87333', 'metal', 2.70, {rough:0.3, metal:0.95});
M('zinc',       'Zinc',                               'Métaux', 7200, 110, 380, 1e6, '#8E9AA0', 'metal', 3.10, {rough:0.45, metal:0.8});
M('fonte',      'Fonte',                              'Métaux', 7500, 50,  450, 1e6, '#4D5155', 'metal', 1.50, {rough:0.6, metal:0.7});
M('bacAcier',   'Bac acier laqué',                    'Métaux', 7850, 50,  450, 1e6, '#5F6B76', 'ribbed',2.40, {tx:0.25, ty:0.25, rough:0.4, metal:0.6});
// ---- Verre et plastiques
M('verre',      'Verre float',                        'Verre et plastiques', 2500, 1.00, 750, 1e6, '#9FD0E2', 'glass', 1.44, {rough:0.05, opacity:0.35});
M('vitrage',    'Double vitrage 4/16/4 (équivalent)', 'Verre et plastiques', 500, 0.04, 750, 1e6, '#9FD0E2', 'glass', 1.44, {rough:0.05, opacity:0.32, Ug:1.1});
M('polycarb',   'Polycarbonate alvéolaire',           'Verre et plastiques', 1200, 0.20, 1200, 1e5,'#D8EEF4', 'glass', 7.6,  {opacity:0.5, rough:0.2});
M('pvc',        'PVC rigide (menuiserie)',            'Verre et plastiques', 1390, 0.17, 900, 5e4, '#F4F5F2', 'plain', 3.10, {rough:0.5});
M('caoutchouc', 'Caoutchouc',                         'Verre et plastiques', 1200, 0.17, 1400, 1e4,'#2E3135', 'plain', 2.80);
// ---- Revêtements de sol
M('carrelage',  'Carrelage grès cérame',              'Revêtements de sol', 2300, 1.30, 840, 200, '#D4CDBF', 'tile', 0.78, {tx:0.6, ty:0.6, rough:0.45});
M('faience',    'Faïence murale',                     'Revêtements de sol', 2000, 1.00, 840, 200, '#F3F4F2', 'tile', 0.78, {tx:0.3, ty:0.3, rough:0.3});
M('parquet',    'Parquet chêne massif',               'Revêtements de sol', 700, 0.18, 1600, 50, '#B98955', 'parquet', 0.30, {tx:0.9, ty:0.14, rough:0.55});
M('stratifie',  'Sol stratifié',                      'Revêtements de sol', 850, 0.17, 1700, 200,'#C8A678', 'parquet', 0.90, {tx:1.2, ty:0.19, rough:0.5});
M('pvcSol',     'Sol vinyle (LVT)',                   'Revêtements de sol', 1200, 0.25, 1400, 1e4,'#A79C8E', 'parquet', 2.90, {tx:1.2, ty:0.18, rough:0.6});
M('moquette',   'Moquette',                           'Revêtements de sol', 200, 0.06, 1300, 5,  '#6F7684', 'fabric', 4.00);
M('resine',     'Résine époxy',                       'Revêtements de sol', 1400, 0.20, 1400, 1e4,'#9AA7B0', 'plain', 5.70, {rough:0.25});
M('linoleum',   'Linoléum',                           'Revêtements de sol', 1200, 0.17, 1400, 1000,'#9DA88A','plain', 1.20, {rough:0.6});
M('pierreSol',  'Dallage pierre naturelle',           'Revêtements de sol', 2500, 2.30, 1000, 50, '#CFC4AE', 'tile', 0.10, {tx:0.6, ty:0.4, rough:0.6});
// ---- Couverture et étanchéité
M('tuile',      'Tuile terre cuite',                  'Couverture et étanchéité', 1900, 1.00, 800, 40, '#B4583A', 'rooftile', 0.45, {tx:0.25, ty:0.18});
M('ardoise',    'Ardoise naturelle',                  'Couverture et étanchéité', 2700, 2.20, 1000, 800,'#4A5059','slate', 0.10, {tx:0.3, ty:0.15});
M('bitume',     'Membrane bitumineuse',               'Couverture et étanchéité', 1100, 0.23, 1000, 50000,'#2C2E31','membrane',0.43);
M('epdm',       'Membrane EPDM',                      'Couverture et étanchéité', 1150, 0.25, 1000, 60000,'#25282C','membrane',3.10);
M('paraVapeur', 'Pare-vapeur polyéthylène',           'Couverture et étanchéité', 920, 0.33, 2200, 100000,'#D6E7EE','membrane',2.0);
M('freinVap',   'Frein-vapeur hygrovariable (Sd 2 m)', 'Couverture et étanchéité', 920, 0.33, 2200, 10000, '#E2EDDA','membrane',2.0);
M('paraPluie',  'Écran pare-pluie HPV',               'Couverture et étanchéité', 400, 0.30, 1500, 50, '#E9EEF1', 'membrane', 2.5);
M('gravier',    'Gravillons de protection',           'Couverture et étanchéité', 1700, 2.00, 1000, 50, '#A8A49B', 'gravel', 0.004);
M('terreVeg',   'Terre végétale (toiture végétalisée)','Couverture et étanchéité', 1500, 1.50, 1500, 50, '#5C6B3B', 'grass', 0.02);
// ---- Lames d'air et divers
M('airNV',      'Lame d\'air non ventilée (2 à 30 cm)',"Lames d'air et divers", 1.2, 0.025, 1000, 1, '#EAF4F8', 'plain', 0, {R:0.18, opacity:0.08});
M('airFV',      'Lame d\'air faiblement ventilée',    "Lames d'air et divers", 1.2, 0.025, 1000, 1, '#EAF4F8', 'plain', 0, {R:0.09, opacity:0.08});
M('sol',        'Terrain (sol argilo-sableux)',       "Lames d'air et divers", 2000, 2.00, 1000, 50, '#8A7356', 'earth', 0);
M('eau',        'Eau',                                "Lames d'air et divers", 1000, 0.60, 4190, 1e6, '#5FA8D3', 'glass', 0, {opacity:0.6, rough:0.05});
M('textile',    'Textile d\'ameublement',             "Lames d'air et divers", 300, 0.06, 1300, 5, '#7A8597', 'fabric', 5.0);
M('vegetal',    'Végétal (feuillage)',                "Lames d'air et divers", 300, 0.10, 1500, 5, '#5E8C4A', 'grass', 0);

/* ============ Compositions de base (murs : extérieur → intérieur ; planchers et toitures : haut → bas) ============ */
const COMPOS = {
  'MUR-EXT-01': {nom:'Mur ext. parpaing 20 + doublage 10', kind:'wall', lot:'Gros œuvre', layers:[['enduit',.015],['parpaing',.20],['laine',.10],['ba13',.013]]},
  'MUR-EXT-02': {nom:'Mur ext. béton 18 + ITE PSE 14', kind:'wall', lot:'Gros œuvre', layers:[['enduit',.01],['pse',.14],['ba',.18]]},
  'MUR-EXT-03': {nom:'Mur ext. brique 20 + doublage 10', kind:'wall', lot:'Gros œuvre', layers:[['enduit',.015],['brique',.20],['laine',.10],['ba13',.013]]},
  'MUR-EXT-04': {nom:'Mur ext. monomur 37,5', kind:'wall', lot:'Gros œuvre', layers:[['enduit',.02],['briqueTh',.375],['enduitPlatre',.01]]},
  'MUR-EXT-05': {nom:'Mur ext. béton cellulaire 30', kind:'wall', lot:'Gros œuvre', layers:[['enduit',.015],['betCell',.30],['enduitPlatre',.01]]},
  'MUR-BOIS-01':{nom:'Mur ossature CLT 10 + isolant 14', kind:'wall', lot:'Gros œuvre', layers:[['enduit',.01],['laine',.14],['clt',.10]]},
  'MUR-MOB-01': {nom:'Mur ossature bois 145 + fibre de bois', kind:'wall', lot:'Gros œuvre', layers:[['bardageBois',.022],['airFV',.027],['fibreBoisR',.06],['fibreBoisS',.145],['osb',.012],['airNV',.045],['ba13',.013]]},
  'MUR-PAILLE': {nom:'Mur paille + enduit terre/chaux', kind:'wall', lot:'Gros œuvre', layers:[['enduitChaux',.03],['paille',.36],['terreCrue',.04]]},
  'MUR-PIERRE': {nom:'Mur pierre 50 + correction chanvre 8', kind:'wall', lot:'Gros œuvre', layers:[['enduitChaux',.02],['pierreTend',.50],['betonChanvre',.08],['enduitChaux',.015]]},
  'REF-BA-15':  {nom:'Refend béton armé 15', kind:'wall', lot:'Gros œuvre', layers:[['ba',.15]]},
  'REF-BA-20':  {nom:'Refend béton armé 20', kind:'wall', lot:'Gros œuvre', layers:[['ba',.20]]},
  'CLO-72':     {nom:'Cloison plâtre 72/48', kind:'wall', lot:'Second œuvre', layers:[['ba13',.0125],['laine',.047],['ba13',.0125]]},
  'CLO-98':     {nom:'Cloison plâtre 98/48 double peau', kind:'wall', lot:'Second œuvre', layers:[['ba13',.025],['laine',.048],['ba13',.025]]},
  'CLO-CAR-07': {nom:'Cloison carreaux de plâtre 7', kind:'wall', lot:'Second œuvre', layers:[['carreauPl',.07]]},
  'DAL-ISO':    {nom:'Dallage isolé : chape + BA 15 + PSE 10', kind:'slab', lot:'Gros œuvre', layers:[['chape',.05],['ba',.15],['pse',.10]]},
  'DAL-BA-20':  {nom:'Dalle BA 20 + chape + carrelage', kind:'slab', lot:'Gros œuvre', layers:[['carrelage',.01],['chape',.05],['ba',.20]]},
  'PL-CLT-14':  {nom:'Plancher CLT 14', kind:'slab', lot:'Gros œuvre', layers:[['clt',.14]]},
  'PL-BOIS-01': {nom:'Plancher bois : parquet + OSB + solives isolées', kind:'slab', lot:'Gros œuvre', layers:[['parquet',.014],['osb',.022],['laineVerre',.20],['ba13',.013]]},
  'TT-BAC-01':  {nom:'Toiture terrasse bac acier + PIR 12', kind:'slab', lot:'Gros œuvre', layers:[['bitume',.006],['pir',.12],['bacAcier',.0008]]},
  'TT-VEG-01':  {nom:'Toiture végétalisée sur BA', kind:'slab', lot:'Gros œuvre', layers:[['terreVeg',.10],['epdm',.0015],['xps',.14],['bitume',.004],['ba',.20]]},
  'DAL-IND':    {nom:'Dallage industriel BA 20 + résine', kind:'slab', lot:'Industrie', layers:[['resine',.003],['ba',.20]]},
};
