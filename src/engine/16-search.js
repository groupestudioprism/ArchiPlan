/* ============ Recherche intelligente ============
   Moteur commun à toutes les barres de recherche (bibliothèque, fiches de composition, palette globale Ctrl+K).
   - insensible aux accents, à la casse, aux pluriels et aux tirets (« vapeur » trouve « Pare-vapeur ») ;
   - préfixes et fautes de frappe tolérés (« isol », « parpain ») ;
   - thésaurus métier : un mot de la requête est rattaché à des concepts (« isolant » → tous les isolants,
     « couche intermédiaire » → isolants, membranes, lames d'air, panneaux, chapes…) ; chaque élément porte des
     étiquettes de concepts (rôle dans la paroi, catégorie, mots de son nom) ;
   - tous les mots de la requête doivent trouver une correspondance (ET), le classement vient du meilleur score.
   Le module ne dépend de rien d'autre que des bibliothèques (MATS, COMPOS, FAMS) et est copié tel quel dans les
   autres apps du studio (ARCHITRAFIC) avec leur propre thésaurus. */
const sFold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’'`´]/g, ' ');
const S_KEEP = new Set(['bois', 'gris', 'bas', 'pays', 'mois', 'puits', 'os', 'gaz', 'plus', 'sous', 'dessous', 'dessus', 'vis', 'tapis', 'pvc', 'abs', 'eps', 'xps', 'pse', 'ba13', 'ips']);
function sStem(t){
  if (t.length <= 3 || /\d/.test(t) || S_KEEP.has(t)) return t;
  if (/(eaux|aux|eux)$/.test(t) && t.length > 4) return t.slice(0, -1);
  if (/[^s]s$/.test(t)) return t.slice(0, -1);
  return t;
}
const S_STOP = new Set(['de', 'd', 'du', 'des', 'le', 'la', 'les', 'l', 'un', 'une', 'en', 'et', 'a', 'au', 'aux', 'ou', 'par', 'pour', 'avec', 'dans', 'the', 'of']);
const sTokens = s => sFold(s).split(/[^a-z0-9]+/).filter(t => t && !S_STOP.has(t)).map(sStem);

/* ---------- thésaurus : concept → libellé | termes (un terme précédé de ~ sert à la requête mais n'étiquette pas
   automatiquement les éléments dont le nom le contient, parce qu'il est trop générique) ---------- */
const SYN = {
  isolant: 'Isolant|isolant,isolation,isoler,isole,thermique,laine,mousse,ouate,calorifuge,calorifugeage,isolation thermique,laine minerale,laine de verre,laine de roche,ite,iti,itr,isolation exterieure,isolation interieure,isolation par l exterieur,polystyrene,styrodur,~fibre,panneau isolant,isolant biosource,r thermique,resistance thermique',
  vapeur: 'Pare-vapeur|vapeur,pare vapeur,parevapeur,frein vapeur,freinvapeur,sd,hygrovariable,hygro,hygroregulant,membrane vapeur,etancheite a l air,etancheite air,barriere vapeur,pare-vapeur,frein-vapeur,regulateur de vapeur',
  membrane: 'Membrane / film|membrane,film,ecran,feutre,bache,pare pluie,parepluie,hpv,bitumineuse,elastomere,geotextile,ecran de sous toiture,sous toiture,~le',
  etancheite: 'Étanchéité|etancheite,etanche,impermeable,impermeabilisation,hors d eau,mise hors d eau,humidite,infiltration,~eau,~pluie,hydrofuge,resistant a l eau,drainage,drainant,etancheite liquide,sel,resine d etancheite',
  air: 'Lame d\'air|air,lame d air,lame air,~lame,~vide,ventile,ventilee,ventilation,cavite,vide technique,espace technique,non ventilee,faiblement ventilee,couche d air',
  panneau: 'Panneau|panneau,~plaque,contreventement,voile travaillant,osb,contreplaque,panneau bois,derive du bois,panneau de particules,multiplis,triply,~derive',
  parement: 'Parement intérieur|parement,~finition,finition interieure,placo,placoplatre,~platre,~plaque,doublage,habillage,lambris,plaque de platre,ba13,ba18,ba25,~cloison,cloison seche,fermacell,gypse,contre cloison,parement interieur',
  enduit: 'Enduit|enduit,enduits,crepi,ravalement,rpe,~mortier,~chaux,enduit exterieur,enduit interieur,lissage,platrage,corps d enduit,gobetis,monocouche,enduit monocouche,gratte,taloche,projete',
  bardage: 'Bardage / façade|bardage,facade,vetage,veture,peau exterieure,claire voie,clin,clins,revetement exterieur,finition exterieure,~tole,~lame,parement exterieur,brique de parement,pierre de parement,plaquette,plaquettes',
  revsol: 'Revêtement de sol|revetement de sol,revetements de sol,~sol,~sols,sol fini,finition sol,carrelage,~carreau,~carreaux,gres,gres cerame,parquet,moquette,lino,linoleum,vinyle,lvt,stratifie,~resine,dallage,sol souple,sol dur,plinthe,chevrons,point de hongrie,lame de parquet',
  chape: 'Chape / sous-couche|chape,chapes,ravoirage,sous couche,souscouche,sous-couche,resilient,resiliente,couche de forme,forme de pente,anhydrite,chape fluide,chape seche,chape flottante,plancher chauffant,chape liquide',
  porteur: 'Structure porteuse|porteur,porteurs,porteuse,structure,structurel,structurelle,gros oeuvre,ossature,mur porteur,~voile,refend,corps de mur,element porteur,charpente,lamelle,poutrelle,hourdis,~massif,element de structure,descente de charge,reprise de charge,chainage',
  maconnerie: 'Maçonnerie|maconnerie,macon,maconne,brique,briques,bloc,blocs,parpaing,parpaings,agglo,agglomere,pierre,pierres,moellon,moellons,monomur,terre cuite,bloc beton,bloc a bancher,beton cellulaire,siporex,ytong,thermopierre,pise,adobe,btc,terre crue,mur en pierre,pierre de taille,calcaire,granit,meuliere',
  beton: 'Béton|beton,betons,ba,beton arme,~voile,~dalle,ciment,beton banche,banche,coule,coule en place,prefabrique,prefa,predalle,poutrelle,hourdis,beton leger,beton de chanvre,beton cire,beton brut,beton desactive,beton fibre,c25,c30,c25/30,ferraillage,armature,armatures',
  bois: 'Bois|bois,boise,boisee,wood,resineux,feuillu,feuillus,epicea,sapin,pin,douglas,meleze,chene,hetre,frene,lamelle colle,lamelle croise,clt,glulam,bld,osb,contreplaque,mdf,panneau de particules,agglomere,ossature bois,mob,~bardage,~parquet,lambris,chevron,solive,solives,~poutre,madrier,bastaing,liteau,voliges,volige,bardeau,essence,essence de bois,bois massif,bois brut,bois peint,bois lasure',
  metal: 'Métal|metal,metaux,metallique,metalliques,acier,aciers,inox,inoxydable,alu,aluminium,zinc,cuivre,fonte,tole,tolerie,bac acier,galva,galvanise,ferraille,profile,profiles,ipe,ipn,hea,heb,upn,acier galvanise,laque,thermolaque,anodise,corten,plomb,laiton,bronze,serrurerie,metallerie',
  verre: 'Verre et vitrage|verre,verres,vitre,vitres,vitrage,vitrages,vitree,vitre,glass,transparent,translucide,double vitrage,triple vitrage,simple vitrage,verre float,feuillete,trempe,securit,polycarbonate,plexiglas,plexi,pmma,brique de verre,pave de verre,miroir,glace,ug,sw,tl,facteur solaire,transmission lumineuse',
  plastique: 'Plastique / synthétique|plastique,plastiques,synthetique,synthetiques,pvc,polyethylene,polypropylene,caoutchouc,elastomere,epdm,~resine,polyester,nylon,vinyle,polyurethane,pu,pur,pir,silicone,composite,fibre de verre,resine epoxy,epoxy,stratifie',
  platre: 'Plâtre et plaques|platre,placo,placoplatre,ba13,ba18,ba25,plaque de platre,gypse,fermacell,carreau de platre,carreaux de platre,staff,stuc,hydrofuge,plafond suspendu,faux plafond,rail,rails,montant,montants,ossature metallique,fourrure,fourrures,enduit platre,plafond',
  couverture: 'Couverture / toiture|couverture,~toiture,~toit,tuile,tuiles,ardoise,ardoises,bac acier,~zinc,zinguerie,toiture terrasse,~terrasse,faitage,toit plat,toiture vegetalisee,toiture vegetale,chaume,shingle,bardeau,bardeaux,lauze,lauzes,tuile canal,tuile plate,tuile mecanique,gouttiere,cheneau,descente eau pluviale,eau pluviale,eaux pluviales,ep,gravillon,gravillons,lestage',
  vegetal: 'Végétal|vegetal,vegetale,vegetaux,vegetation,vegetalise,vegetalisee,plante,plantes,plantation,arbre,arbres,arbuste,arbustes,haie,haies,gazon,pelouse,herbe,jardin,fleur,fleurs,massif fleuri,feuillage,conifere,coniferes,toiture vegetalisee,terre vegetale,paysage,paysager,espace vert,espaces verts,arbre fruitier,buisson',
  terre: 'Terre / sol naturel|terre,terrain,~sol,argile,argileux,argilo,sable,sableux,gravier,gravillon,graviers,remblai,tout venant,pise,adobe,btc,terre crue,terre vegetale,humus,geotechnique,fondation,fondations,sol naturel,terre plein,terrassement,deblai,plateforme,empierrement,grave,grave non traitee,gnt',
  eau: 'Eau|~eau,piscine,bassin,liquide,aquatique,nappe,nappe phreatique,mare,etang,fontaine',
  biosource: 'Biosourcé / bas carbone|biosource,biosourcee,biosources,bio source,naturel,naturelle,naturels,ecologique,ecologiques,ecolo,bas carbone,faible carbone,decarbone,renouvelable,renouvelables,materiau naturel,geosource,geosources,re2020,durable,recyclable,recycle,vertueux,sain,sains,materiau sain,ecoconstruction,eco construction,eco materiau,ecomateriau,chanvre,paille,liege,lin,cellulose,mouton,fibre de bois,laine de bois',
  acoustique: 'Acoustique|acoustique,acoustiques,phonique,phoniques,bruit,bruits,son,sonore,isolation phonique,isolation acoustique,affaiblissement acoustique,affaiblissement,resilient,resiliente,decibel,decibels,db,rw,dnt,dntw,bruit d impact,bruit aerien,bruits aeriens,antibruit,anti bruit,silence,silencieux,insonorisation,insonoriser,correction acoustique,absorbant,absorption acoustique,reverberation,masse ressort masse,desolidarise,desolidarisation',
  feu: 'Feu / incendie|feu,incendie,coupe feu,coupefeu,pare flamme,pareflamme,ignifuge,ignifugee,ignifugé,incombustible,resistance au feu,reaction au feu,rei,ei,m0,m1,m2,a1,a2,euroclasse,euroclasses,securite incendie,ssi,desenfumage,flamme,flammes,combustible,stabilite au feu,sf,cf,pf,degre coupe feu,porte coupe feu,bloc porte coupe feu,compartimentage,recoupement,sprinkler,sprinkleur,extincteur,alarme incendie,detecteur,daaf,issue de secours,evacuation',
  lourd: 'Lourd / inertie|lourd,lourde,lourds,masse,massique,~massif,massive,dense,densite,inertie,forte inertie,pesant,inertiel,inertielle,masse volumique,kg/m3,kg/m2',
  leger: 'Léger|leger,legere,legers,allege,allegee,alleges,faible densite,basse densite,poids leger,structure legere,ossature legere',
  exterieur: 'Extérieur|exterieur,exterieure,exterieurs,ext,dehors,~facade,facades,cote exterieur,en exterieur,face exterieure,paroi exterieure,mur exterieur,enveloppe,exterieur du batiment,dehors,outdoor',
  interieur: 'Intérieur|interieur,interieure,interieurs,int,dedans,cote interieur,en interieur,face interieure,paroi interieure,mur interieur,cloison interieure,indoor,amenagement interieur,second oeuvre',
  intermediaire: 'Couche intermédiaire|intermediaire,intermediaires,couche intermediaire,couches intermediaires,couche du milieu,couches du milieu,entre deux,ame,ame de paroi,noyau,coeur de paroi,corps de paroi,couche interne,couches internes,sous jacent,sous jacente,couche cachee,couche technique,couches techniques,milieu de paroi,dans l epaisseur,epaisseur de la paroi',
  finition: 'Finition|finition,finitions,couche de finition,fini,finie,revetement,revetements,habillage,decoration,decoratif,decorative,aspect,~parement,peinture,peintures,peint,peinte,couche visible,surface,surfaces,aspect de surface,texture,textures,coloris,couleur,couleurs,teinte,teintes,laque,vernis,lasure,badigeon,chaux',
  menuiserie: 'Menuiserie|menuiserie,menuiseries,fenetre,fenetres,porte,portes,baie,baies,chassis,dormant,dormants,ouvrant,ouvrants,vantail,vantaux,huisserie,huisseries,bloc porte,bloc-porte,croisee,croisees,porte fenetre,porte-fenetre,coulissant,coulissante,coulissantes,baie vitree,baie coulissante,oscillo,oscillo battant,oscillobattant,velux,lucarne,fenetre de toit,volet,volets,persienne,persiennes,store,stores,brise soleil,claustra,menuiserie exterieure,menuiserie interieure,seuil,seuils,appui,appuis,linteau,linteaux,tableau,tableaux,imposte,impostes,ouverture,ouvertures,~trou,ebrasement,quincaillerie,poignee,poignees,serrure,serrures,paumelle,paumelles,gond,gonds,vitrerie,miroiterie,joint,joints,dormant,battement,battue,parclose,parcloses,petit bois,petits bois,croisillon,croisillons,garde corps,garde-corps,rupture de pont thermique,rpt',
  fenetre: 'Fenêtre|fenetre,fenetres,chassis,baie,baies,baie vitree,croisee,croisees,ouvrant,ouvrants,oscillo,oscillo battant,oscillobattant,velux,lucarne,lucarnes,fenetre de toit,~vitree,~vitrees,~vitre,porte fenetre,porte-fenetre,coulissante,coulissantes,baie coulissante,galandage,jalousie,oeil de boeuf,hublot,imposte,impostes,fixe,fixes,chassis fixe,soufflet,a soufflet,basculante,basculant,a la francaise,a l anglaise,1 vantail,2 vantaux,3 vantaux,un vantail,deux vantaux,trois vantaux,~double vitrage,~triple vitrage,verriere,verrieres,bow window,bow-window,fenêtre',
  porte: 'Porte|porte,portes,bloc porte,bloc-porte,blocs portes,huisserie,huisseries,~vantail,~battant,battante,battants,coulissante,porte coulissante,porte a galandage,galandage,porte d entree,entree,entrees,porte interieure,porte paliere,paliere,palieres,porte de garage,garage,porte coupe feu,issue,issue de secours,porte vitree,porte pleine,alveolaire,alveolaires,postformee,postforme,porte atelier,porte de service,service,portail,portails,portillon,tierce,a tierce,porte double,double porte,porte a deux vantaux,porte simple,porte isoplane,isoplane,isoplanes,porte acoustique,porte isolante,porte blindee,blindee,anti effraction,porte sectionnelle,sectionnelle,basculante,rideau metallique,porte battante,porte va et vient,va et vient,huisserie bois,huisserie metallique,bati,batis,chambranle,chambranles,clanche,clanches,bequille,bequilles,cylindre,ferme porte,ferme-porte,groom,seuil,seuil pmr,largeur de passage,passage libre,passage utile,porte 83,porte 93,porte 73',
  escalier: 'Escalier|escalier,escaliers,marche,marches,volee,volees,palier,paliers,giron,girons,contremarche,contremarches,limon,limons,cremaillere,garde corps,garde-corps,main courante,rampe,rampes,quart tournant,deux quarts tournants,demi tournant,helicoidal,helicoidaux,colimacon,echappee,tremie,tremie d escalier,nez de marche,balancement,balance,balancee,blondel,loi de blondel,escalier droit,escalier tournant,escalier beton,escalier bois,escalier metallique,escalier exterieur,escalier de secours,echelle,echelle de meunier,meunier,ascenseur,monte charge,montee,descente,emmarchement,hauteur de marche,hauteur a monter',
  toit: 'Toit / toiture|toit,toits,toiture,toitures,~couverture,charpente,charpentes,deux pans,un pan,quatre pans,2 pans,4 pans,toit plat,toit terrasse,toiture terrasse,pente,pentes,pan,pans,comble,combles,combles amenages,combles perdus,faitage,faitiere,egout,egouts,debord,debord de toit,debords,rive,rives,pignon,pignons,croupe,croupes,noue,noues,aretier,aretiers,chevron,chevrons,panne,pannes,ferme,fermes,fermette,fermettes,monopente,mono pente,appentis,mansarde,mansardee,lucarne,lucarnes,chien assis,toiture vegetalisee,acrotere,acroteres,solin,solins,ecran de sous toiture,isolation de toiture,sarking,rampant,rampants,sous pente,sous rampant',
  mur: 'Mur|mur,murs,cloison,cloisons,paroi,parois,refend,refends,~voile,voiles,doublage,doublages,mur porteur,mur exterieur,mur interieur,mur de refend,mur rideau,ossature,mur ossature bois,mob,cloison seche,cloison legere,cloison distributive,cloison alveolaire,separatif,separative,mur mitoyen,mitoyen,mitoyennete,pignon,allege,alleges,allege de fenetre,muret,murets,soubassement,soubassements,mur de soutenement,soutenement,mur de cloture,mur banche,voile beton,contre cloison,paroi verticale,parois verticales,mur courbe,mur en arc,arc de cercle,trumeau,trumeaux,jambage,jambages,poteau,poteaux',
  dalle: 'Dalle / plancher|dalle,dalles,plancher,planchers,dallage,dallages,dalle beton,plancher bas,plancher haut,plancher intermediaire,plancher bois,dalle portee,dalle pleine,dalle sur terre plein,terre plein,vide sanitaire,hourdis,poutrelle,poutrelles,predalle,predalles,plancher collaborant,collaborant,solivage,solive,solives,radier,radiers,sol fini,~sol,~chape,~terrasse,trou,trous,tremie,tremies,reservation,reservations,plancher chauffant,plancher technique,faux plancher,sous face,sous-face,plafond,plancher a plancher,hauteur libre,niveau fini,nf',
  poteau: 'Poteau / poutre|poteau,poteaux,poutre,poutres,colonne,colonnes,pilier,piliers,portique,portiques,linteau,linteaux,chainage,chainages,chainage vertical,chainage horizontal,poteau beton,poteau bois,poteau acier,ipe,ipn,hea,heb,poutre bois,longrine,longrines,sommier,sommiers,ossature poteaux poutres,poteaux poutres,poteau poutre,porte a faux,console,consoles,contreventement,palee,palees,croix de saint andre,tirant,tirants,bracon,bracons,jambe de force',
  cote: 'Cote / mesure|cote,cotes,cotation,cotations,coter,dimension,dimensions,dimensionner,mesure,mesures,mesurer,metre,metre ruban,distance,distances,longueur,longueurs,largeur,largeurs,hauteur,hauteurs,ligne de cote,lignes de cote,annotation,annotations,surface,surfaces,aire,perimetre,angle,angles,regle,equerre,niveau a bulle,aplomb,nivellement,altimetrie',
  volume: 'Volume / forme|volume,volumes,forme,formes,boite,boites,bloc,blocs,masse,masses,forme libre,formes libres,extrusion,extruder,extrude,pousser tirer,pousser,tirer,push pull,pushpull,primitive,primitives,cube,cubes,pave,cylindre,cylindres,sphere,spheres,prisme,prismes,cone,cones,forme simple,formes simples,sketchup,volumetrie,volumetrique,gabarit,gabarits,emprise,enveloppe,solide,solides,modelisation,modeliser,3d',
  esquisse: 'Esquisse 3D|esquisse,esquisses,esquisser,croquis,dessin,dessiner,sketch,dessin libre,main levee,a main levee,stylet,crayon,tracer,trace,traces,contour,contours,forme libre,shapr,shapr3d,shape 3d,profil,profils,profil extrude,courbe,courbes,polyligne,polylignes,spline,arc,arcs,cercle,cercles,rectangle,rectangles,polygone,polygones,ligne,lignes,segment,segments,dessin sur face,dessiner sur une face,sur mesure,fabrique sur place,sur place,fait sur place',
  composant: 'Composant / famille|composant,composants,famille,familles,bibliotheque,bibliotheques,catalogue,catalogues,objet,objets,element,elements,~bloc,blocs,mobilier,meuble,meubles,equipement,equipements,composant parametrique,parametrique,parametriques,instance,instances,revit,bim,prefabrique,prefabriques,prefa,prefabrication,modele,modeles,symbole,symboles,type,types,gabarit,inserer,insertion,poser,placer,placement',
  mobilier: 'Mobilier|mobilier,mobiliers,meuble,meubles,meubler,ameublement,table,tables,chaise,chaises,canape,canapes,fauteuil,fauteuils,lit,lits,literie,armoire,armoires,placard,placards,dressing,bureau,bureaux,etagere,etageres,rangement,rangements,bibliotheque meuble,commode,commodes,tabouret,tabourets,banc,bancs,buffet,console,tele,television,ecran,lampe,lampadaire,luminaire,luminaires,tapis,rideau,rideaux,decoration,plante verte',
  sanitaire: 'Cuisine et sanitaires|sanitaire,sanitaires,wc,toilette,toilettes,cuvette,cuvettes,lavabo,lavabos,vasque,vasques,lave mains,lave-mains,douche,douches,receveur,receveurs,baignoire,baignoires,bain,salle de bain,salle de bains,salle d eau,evier,eviers,cuisine,cuisines,plan de travail,plans de travail,four,fours,plaque de cuisson,cuisson,frigo,refrigerateur,lave vaisselle,lave-vaisselle,lave linge,lave-linge,machine a laver,seche linge,robinet,robinets,robinetterie,chauffe eau,chauffe-eau,ballon,ballon d eau chaude,cumulus,radiateur,radiateurs,chaudiere,chaudieres,pompe a chaleur,pac,vmc,ventilation,bouche,bouches,hotte,hottes,plomberie,sanitaires pmr,urinoir,urinoirs,bidet,meuble vasque,colonne de douche,paroi de douche,miroir',
  industrie: 'Industrie|industrie,industriel,industrielle,industriels,usine,usines,atelier,ateliers,hangar,hangars,entrepot,entrepots,logistique,pont roulant,ponts roulants,porte sectionnelle,sectionnelle,rideau metallique,quai,quais,quai de chargement,niveleur de quai,rack,racks,rayonnage,rayonnages,palette,palettes,convoyeur,convoyeurs,machine,machines,machine outil,silo,silos,cuve,cuves,bardage industriel,charpente metallique,portique,portiques,mezzanine industrielle,escalier industriel,caillebotis,chariot elevateur,chariot,transpalette,local technique,transformateur,compresseur,extraction,aspiration,process,ligne de production,production',
  niveau: 'Niveau / étage|niveau,niveaux,etage,etages,rdc,rez de chaussee,rez-de-chaussee,rez,r+1,r + 1,r+2,r+3,sous sol,sous-sol,ss,cave,caves,comble,combles,mezzanine,mezzanines,altitude,altitudes,hauteur sous plafond,hsp,plancher a plancher,attique,duplex,triplex,gerer les niveaux,nouveau niveau,ajouter un niveau,etage courant,niveau courant,coupe de niveau,plan de niveau,storey,story',
  export: 'Exporter / fichiers|export,exporter,exportation,exports,telecharger,telechargement,enregistrer,sauvegarder,sauvegarde,fichier,fichiers,pdf,ifc,dxf,dwg,csv,excel,xlsx,glb,gltf,obj,json,plan pdf,impression,imprimer,mise en page,planche,planches,carnet,carnet de plans,devis,dqe,metre,metres,quantitatif,quantites,notice,notices,rapport,rapports,partage,partager,envoyer,archicad,revit,autocad,sketchup,bim,maquette numerique,maquette,ouvrir,importer,import,nouveau projet,projet,projets,dupliquer,renommer,supprimer le projet,cloud,synchroniser',
  rendu: 'Rendu|rendu,rendus,render,photorealiste,realiste,realistes,temps reel,ombre,ombres,soleil,ensoleillement,course du soleil,lumiere,lumieres,eclairage,eclairages,hdri,ciel,texture,textures,materiau realiste,qualite,qualite de rendu,camera,cameras,point de vue,points de vue,perspective,perspectives,vue 3d,visite,visite virtuelle,image,images,capture,capture d ecran,photo,photos,nuit,jour,heure,saison,azimut,nord,orientation,reflet,reflets,brouillard,ambiance,ambiances,exposition,couleur du ciel',
  plan: 'Plan 2D|plan,plans,vue en plan,2d,plan de masse,plan de niveau,plan d etage,coupe,coupes,coupe verticale,coupe horizontale,~facade,facades,elevation,elevations,vue de dessus,dessus,cotes,dessin technique,mise en page,feuille,feuilles,cartouche,cartouches,echelle,echelles,1/50,1/100,1/200,1:50,1:100,1:200,trait,traits,hachure,hachures,calque,calques,grille,quadrillage,accrochage,magnetisme,snap,ortho,polaire,reperage,nord,orientation,legende,legendes,plan de vente,plan de permis,permis de construire,pc,dp,declaration prealable,dossier',
  site: 'Site / terrain|site,terrain,terrains,parcelle,parcelles,cadastre,cadastral,cadastrale,adresse,adresses,geolocalisation,gps,coordonnees,latitude,longitude,zone climatique,zones climatiques,climat,meteo,altitude,ngf,relief,pente du terrain,courbes de niveau,courbe de niveau,topographie,topographique,orientation,nord,boussole,voisinage,voisins,environnement,bruit,plan local d urbanisme,plu,limite de propriete,limites de propriete,mitoyennete,implantation,implanter,acces,voirie,rue,route,reseau,reseaux,raccordement,viabilisation,bornage,geometre,lieu,localisation,commune,ville,village,quartier,contexte',
  energie: 'Thermique / énergie|thermique,thermiques,energie,energetique,energetiques,u,coefficient u,uw,ug,uf,up,ubat,r,resistance thermique,lambda,conductivite,conductivite thermique,pont thermique,ponts thermiques,psi,bbio,cep,dpe,re2020,re 2020,rt2012,rt 2012,etude thermique,chauffage,besoin de chauffage,besoins de chauffage,dephasage,inertie,confort,confort d ete,confort thermique,surchauffe,condensation,glaser,hygrometrie,hygrothermique,point de rosee,rosee,humidite,deperdition,deperditions,bilan thermique,performance,performances,performant,performante,isolation,etancheite a l air,infiltrometrie,q4,n50,effusivite,diffusivite,capacite thermique,chaleur,froid,climatisation,rafraichissement,passif,maison passive,passivhaus,bepos,energie positive,solaire,apports solaires,facteur solaire,sw,tl,transmission lumineuse',
  carbone: 'Carbone / environnement|carbone,co2,co2e,empreinte carbone,bilan carbone,acv,analyse de cycle de vie,cycle de vie,inies,fdes,pep,impact environnemental,impacts environnementaux,environnement,environnemental,ges,gaz a effet de serre,re2020,ic,ic construction,ic energie,~biosource,stockage carbone,carbone biogenique,kgco2,kg co2,empreinte,emissions,emission,decarbonation,decarboner,reemploi,recyclage,recycle,circulaire,economie circulaire,dechet,dechets,label,labels,e+c-,hqe,breeam,leed,bbca,effinergie',
  handicap: 'Accessibilité|accessibilite,accessible,accessibles,pmr,handicap,handicape,handicapes,fauteuil roulant,fauteuils roulants,rampe d acces,rampe pmr,largeur de passage,passage,porte 90,porte 93,unite de passage,unites de passage,up,norme pmr,ascenseur,ascenseurs,elevateur,elevateurs,seuil,seuils,ressaut,ressauts,aire de rotation,aire de retournement,cercle de rotation,diametre 150,erp,etablissement recevant du public,sanitaire pmr,douche a l italienne,italienne,main courante,contraste,contrastes,bande d eveil,bande podotactile,podotactile,nez de marche contraste',
  securite: 'Sécurité|securite,securites,garde corps,garde-corps,garde corps,main courante,mains courantes,hauteur de garde corps,chute,chutes,protection,protections,anti chute,antichute,issue,issues,issue de secours,evacuation,evacuations,desenfumage,alarme,alarmes,extincteur,extincteurs,sprinkler,sprinkleurs,erp,igh,code du travail,norme,normes,reglementation,reglementaire,reglementations,dtu,dtus,nf,en,iso,eurocode,eurocodes,conformite,conforme,non conforme,verification,verifications,controle,controles,alerte,alertes,avertissement,avertissements,bureau de controle,garde fou,barreaudage,remplissage,lisse,lisses,sous lisse,plinthe de garde corps,sabot',
  mesureqty: 'Métré / quantités|metre,metres,metrer,quantitatif,quantitatifs,quantite,quantites,dqe,devis,devis quantitatif,devis estimatif,estimation,estimatif,chiffrage,chiffrer,cout,couts,prix,budget,budgets,bordereau,bpu,dpgf,lot,lots,poste,postes,m2,m3,ml,metre lineaire,metre carre,metre cube,surface,surfaces,volume,volumes,masse,tonne,tonnes,kg,unite,unites,ratio,ratios,shab,surface habitable,shon,sdp,surface de plancher,emprise au sol,ces,surface utile,su,surface taxable,tableau des surfaces,recapitulatif',
  outil: 'Outils|outil,outils,commande,commandes,raccourci,raccourcis,clavier,touche,touches,menu,menus,action,actions,fonction,fonctions,fonctionnalite,fonctionnalites,aide,help,comment,comment faire,tutoriel,tuto,guide,mode,modes,selectionner,selection,selectionne,deplacer,deplacement,copier,copie,coller,dupliquer,rotation,tourner,pivoter,symetrie,miroir,inverser,retourner,couper,coupe,scinder,diviser,joindre,fusionner,souder,prolonger,ajuster,aligner,alignement,annuler,retablir,refaire,undo,redo,supprimer,effacer,masquer,afficher,isoler,cacher,montrer,zoom,zoomer,cadrer,recentrer,vue,vues,orbite,panoramique,pivot,grille,accrochage,magnetisme,ortho,orthogonal,polaire,trajectoire,saisie,saisir,entrer,valider,echap,~entree,ctrl,maj,alt,espace,clic droit,menu contextuel,glisser,glisser deposer,tactile,stylet,doigt,tablette,telephone,mobile,ordinateur,souris,molette',
  tout: 'Tout afficher|tout,tous,toutes,all,*,liste,lister,voir tout,afficher tout,afficher toutes,toute la liste,tout voir',
};
/* index : terme (replié) → ensemble de concepts ; termes multi-mots séparés ; libellés */
const SYN_LABEL = {}, SYN_WORD = new Map(), SYN_PHRASE = [], SYN_TAGWORD = new Map();
for (const [k, v] of Object.entries(SYN)){
  const bar = v.indexOf('|'); SYN_LABEL[k] = v.slice(0, bar);
  for (let raw of v.slice(bar + 1).split(',')){
    raw = raw.trim(); if (!raw) continue; const weak = raw.startsWith('~'); if (weak) raw = raw.slice(1);
    const toks = sTokens(raw); if (!toks.length) continue;
    if (toks.length > 1){ SYN_PHRASE.push({p:toks.join(' '), k, n:toks.length, weak}); continue; }
    const t = toks[0]; (SYN_WORD.get(t) || SYN_WORD.set(t, new Set()).get(t)).add(k);
    if (!weak) (SYN_TAGWORD.get(t) || SYN_TAGWORD.set(t, new Set()).get(t)).add(k);
  }
}
SYN_PHRASE.sort((a, b) => b.n - a.n);
const synLabel = k => SYN_LABEL[k] || k;
/* concepts larges : quand un mot désigne aussi un concept précis (« châssis » → fenêtre et menuiserie), seul le précis est retenu */
const SYN_BROAD = new Set(['menuiserie', 'composant', 'outil', 'finition', 'exterieur', 'interieur', 'porteur', 'energie', 'securite', 'export', 'plan', 'rendu', 'tout', 'mesureqty', 'site']);

/* ---------- requête : groupes de jetons + concepts ----------
   Chaque groupe est soit un mot (avec les concepts qu'il désigne), soit une expression du thésaurus (« couche
   intermédiaire », « lame d'air ») dont les mots restent disponibles pour une correspondance littérale. */
function sParseQuery(q){
  const toks = sTokens(q); if (!toks.length) return {groups:[], raw:''};
  const used = new Array(toks.length).fill(false), groups = [];
  for (const ph of SYN_PHRASE){ const pt = ph.p.split(' ');
    for (let i = 0; i + pt.length <= toks.length; i++){ if (used.slice(i, i + pt.length).some(Boolean)) continue; let ok = true; for (let j = 0; j < pt.length; j++) if (toks[i + j] !== pt[j]){ ok = false; break; }
      if (ok){ const g = {toks:pt.slice(), k:{[ph.k]:0.9}, phrase:true}; for (let j = 0; j < pt.length; j++) used[i + j] = true; groups.push({at:i, g}); } }
  }
  for (let i = 0; i < toks.length; i++){ if (used[i]) continue; const t = toks[i], k = {};
    for (const c of (SYN_WORD.get(t) || [])) k[c] = 0.82;
    // préfixe d'un terme du thésaurus (≥ 4 lettres) : « isol » → isolant, « acous » → acoustique (concept plus faible) ;
    // faute de frappe sur un terme (≥ 6 lettres, une lettre d'écart) : « isolent » → isolant
    if (t.length >= 4){ const tol = t.length >= 6 ? 1 : 0;
      for (const [w, set] of SYN_WORD){ if (w.length > t.length && w.startsWith(t)){ for (const c of set) k[c] = Math.max(k[c] || 0, 0.7); }
        else if (tol && w.length >= 6 && !Object.keys(k).length && sEdit(t, w, tol) <= tol){ for (const c of set) k[c] = Math.max(k[c] || 0, 0.66); } } }
    // un mot qui a un sens précis (« châssis » → fenêtre) ne déclenche pas en plus le concept large (menuiserie)
    if (Object.keys(k).some(c => !SYN_BROAD.has(c))) for (const c of Object.keys(k)) if (SYN_BROAD.has(c)) delete k[c];
    groups.push({at:i, g:{toks:[t], k, phrase:false}}); }
  groups.sort((a, b) => a.at - b.at);
  return {groups:groups.map(x => x.g), raw:q};
}

/* ---------- distance d'édition bornée (fautes de frappe) ---------- */
function sEdit(a, b, max){
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length; let prev = Array.from({length:n + 1}, (_, j) => j), cur = new Array(n + 1), prev2 = null;
  for (let i = 1; i <= m; i++){
    cur[0] = i; let rowMin = i;
    for (let j = 1; j <= n; j++){
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v; if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur; cur = new Array(n + 1);
  }
  return prev[n];
}
/* score d'un jeton de requête q face à un mot w de l'élément (0 = rien) */
function sTokScore(q, w){
  if (w === q) return 1;
  if (q.length >= 2 && w.startsWith(q)) return q.length <= 3 ? Math.max(0.55, 0.92 - (w.length - q.length) * 0.05) : 0.92 - Math.min(0.12, (w.length - q.length) * 0.012);
  if (w.length >= 4 && q.startsWith(w)) return 0.7;
  if (q.length >= 4 && w.length >= 4){
    const tol = q.length >= 9 ? 2 : q.length >= 6 ? 1 : 0;   // faute de frappe : « limitaion », « parpain »
    if (tol && sEdit(q, w, tol) <= tol) return 0.72;
    let p = 0; while (p < q.length && p < w.length && q[p] === w[p]) p++;
    if (p >= Math.max(4, Math.ceil(0.6 * Math.min(q.length, w.length)))) return 0.62;
    if (w.includes(q)) return 0.55;
  }
  return 0;
}

/* ---------- éléments indexés : {id, kind, nom, words:[...], tags:Set, cat, meta, ...} ---------- */
function sIndex(nom, {cat = '', kw = '', tags = [], canon = [], ord = 0} = {}){
  const words = sTokens(nom), kwords = sTokens(kw), cwords = sTokens(cat), T = new Set(tags.concat(canon));
  for (const w of words){ const ks = SYN_TAGWORD.get(w); if (ks) for (const k of ks) T.add(k); }
  // expressions dans le nom (« terre végétale », « pare pluie »)
  const joined = ' ' + words.join(' ') + ' ';
  for (const ph of SYN_PHRASE) if (!ph.weak && ph.n <= words.length && joined.includes(' ' + ph.p + ' ')) T.add(ph.k);
  return {nom, words, kwords, cwords, tags:T, canon:new Set(canon), cat, ord};
}
/* score global d'une requête analysée face à un élément indexé ; renvoie {s, why:[concepts]} ou null */
function sLit(q, ix){
  let best = 0;
  for (const w of ix.words){ const v = sTokScore(q, w); if (v > best) best = v; }
  if (best < 0.9) for (const w of ix.kwords){ const v = sTokScore(q, w) * 0.95; if (v > best) best = v; }
  if (!best) for (const w of ix.cwords){ const v = sTokScore(q, w) * 0.6; if (v > best) best = v; }
  return best;
}
function sScore(Q, ix){
  if (!Q.groups.length) return {s:1, why:[]};
  let sum = 0; const why = [];
  for (const g of Q.groups){
    let lit = 0; for (const t of g.toks){ const v = sLit(t, ix); if (!v){ lit = 0; break; } lit += v; } lit = lit / g.toks.length;
    let con = 0, by = null; for (const [k, w0] of Object.entries(g.k)) if (ix.tags.has(k)){ const w = w0 + (ix.canon.has(k) ? 0.04 : 0); if (w > con){ con = w; by = k; } }
    const best = Math.max(lit, con); if (!best) return null;
    sum += best; if (con > lit && by) why.push(by);
  }
  let s = sum / Q.groups.length;
  // bonus : début du nom identique au premier mot de la requête, noms courts
  const firstQ = Q.groups[0].toks[0]; if (firstQ && ix.words[0] && ix.words[0].startsWith(firstQ)) s += 0.05;
  s += Math.max(0, 0.03 - ix.words.length * 0.003);
  return {s, why:[...new Set(why)]};
}
/* recherche : items = [{ix, ...}] → [{item, s, why}] triés */
function smartSearch(query, items, {limit = 200, min = 0.62} = {}){
  const Q = sParseQuery(query); const out = [];
  for (const it of items){ const r = sScore(Q, it.ix); if (r && r.s >= min) out.push({item:it, s:r.s, why:r.why}); }
  out.sort((a, b) => (Math.abs(b.s - a.s) > 0.001 ? b.s - a.s : 0) || (a.item.ix.ord - b.item.ix.ord) || a.item.ix.nom.localeCompare(b.item.ix.nom, 'fr'));
  return out.slice(0, limit);
}
const sHasQuery = q => sTokens(q).length > 0;
/* surlignage des parties du nom qui correspondent (préfixes des jetons) */
function sHighlight(nom, query){
  const Q = sParseQuery(query); const qs = Q.groups.flatMap(g => g.toks).filter(t => t.length >= 2); if (!qs.length) return esc(nom);
  const src = String(nom ?? ''), folded = sFold(src); // même longueur que src ? pas garanti (ligatures) → on travaille caractère par caractère
  // positions des mots dans la chaîne repliée (sans ligatures la longueur est identique)
  if (folded.length !== src.length) return esc(src);
  const marks = new Array(src.length).fill(false);
  const re = /[a-z0-9]+/g; let m;
  while ((m = re.exec(folded))){ const w = m[0], st = sStem(w);
    for (const q of qs){ const v = sTokScore(q, st) || (w !== st ? sTokScore(q, w) : 0); if (v >= 0.5){ const n = v >= 0.9 || w.startsWith(q) ? Math.min(w.length, Math.max(q.length, v === 1 ? w.length : q.length)) : w.length; for (let i = 0; i < n; i++) marks[m.index + i] = true; } }
  }
  let out = '', open = false;
  for (let i = 0; i < src.length; i++){ if (marks[i] !== open){ out += marks[i] ? '<mark>' : '</mark>'; open = marks[i]; } out += esc(src[i]); }
  if (open) out += '</mark>';
  return out;
}

/* ---------- ARCHIPLAN : étiquettes métier ---------- */
/* rôle de chaque matériau de base dans une paroi (en plus de ce que son nom et sa catégorie disent) */
const MAT_ROLE_SETS = {
  porteur: 'parpaing parpaingP brique briqueTh briqueP betCell pierreCalc pierreTend granit moellon terreCrue btc ba beton betonLeg clt glulam bois chene douglas meleze acier hourdis',
  isolant: 'laineVerre laine laineRocheD pse pseG xps pir fibreBoisR fibreBoisS ouate chanvre liege laineMouton verreCell paille aerogel pu betonChanvre sousCoucheAc',
  membrane: 'bitume epdm paraVapeur freinVap paraPluie',
  vapeur: 'paraVapeur freinVap',
  etancheite: 'bitume epdm paraPluie paraVapeur freinVap ba13H epdm',
  air: 'airNV airFV',
  panneau: 'osb contreplaque mdf agglo fibroCiment clt ba13 ba13H ba13F fermacell',
  parement: 'ba13 ba13H ba13F fermacell enduitPlatre carreauPl faience',
  enduit: 'enduit enduitChaux enduitPlatre mortier enduitGratteBlanc enduitGratteGris enduitTaloche',
  bardage: 'bardageBois fibroCiment bacAcier zinc acierLaque aluAnthr bardageVertical bardageGris briqueParement pierreParement',
  chape: 'chape chapeAnhy mortier sousCoucheAc',
  revsol: 'carrelage parquet stratifie pvcSol moquette resine linoleum pierreSol betonCire carrelage60 carrelageAnth parquetChevrons parquetClair',
  couverture: 'tuile ardoise bacAcier zinc bitume epdm gravier terreVeg',
  vitrage: 'verre vitrage vitrage3 vitrageAc polycarb briqueVerre',
  menuiserie: 'pvc pvcAnthr alu aluAnthr boisPeint vitrage vitrage3 vitrageAc',
  biosource: 'bois chene douglas meleze clt glulam osb contreplaque fibreBoisR fibreBoisS ouate chanvre liege laineMouton paille betonChanvre terreCrue btc bardageBois parquet linoleum enduitChaux parquetChevrons parquetClair bardageVertical',
  acoustique: 'laine laineVerre laineRocheD fibreBoisS ouate chanvre liege laineMouton sousCoucheAc moquette ba13 fermacell betonChanvre vitrageAc ba13F',
  feu: 'ba13F laine laineRocheD verreCell ba beton parpaing parpaingP brique briqueP betCell pierreCalc granit carreauPl fermacell enduitPlatre enduit',
  exterieur: 'enduit enduitChaux bardageBois fibroCiment bacAcier zinc tuile ardoise paraPluie laineRocheD pse pseG xps gravier terreVeg bitume epdm enduitGratteBlanc enduitGratteGris enduitTaloche bardageVertical bardageGris briqueParement pierreParement',
  interieur: 'ba13 ba13H ba13F fermacell enduitPlatre carreauPl parquet carrelage faience moquette stratifie pvcSol linoleum resine paraVapeur freinVap peintBlancCasse peintGrisPerle peintBleuNuit peintTerracotta peintVertSauge parquetChevrons parquetClair carrelage60 carrelageAnth',
  finition: 'peintBlancCasse peintGrisPerle peintBleuNuit peintTerracotta peintVertSauge enduitGratteBlanc enduitGratteGris enduitTaloche bardageVertical bardageGris carrelage60 carrelageAnth parquetChevrons parquetClair briqueParement pierreParement enduit enduitChaux enduitPlatre ba13 faience carrelage parquet',
  lourd: 'parpaingP briqueP pierreCalc granit moellon ba beton chape chapeAnhy acier inox fonte cuivre pierreSol carrelage hourdis terreCrue btc',
  leger: 'laineVerre laine pse pseG xps pir ouate chanvre laineMouton paille pu airNV airFV betCell betonLeg fibreBoisS',
  vegetal: 'terreVeg feuillageC fleurs vegetal',
  terre: 'terreCrue btc sol terreVeg gravier',
};
const MAT_ROLES = {};
for (const [k, ids] of Object.entries(MAT_ROLE_SETS)) for (const id of ids.split(/\s+/)) (MAT_ROLES[id] ??= new Set()).add(k);
// couche intermédiaire = isolants, membranes, lames d'air, panneaux de contreventement, chapes et sous-couches, mortier
for (const [id, R] of Object.entries(MAT_ROLES)) if (R.has('isolant') || R.has('membrane') || R.has('air') || R.has('chape') || ['osb', 'contreplaque', 'agglo', 'fibroCiment', 'mortier', 'hourdis'].includes(id)) R.add('intermediaire');
const CAT_TAGS = {
  'Maçonnerie':['maconnerie', 'porteur', 'lourd'], 'Béton et mortiers':['beton'], 'Isolants':['isolant', 'intermediaire'], 'Bois et dérivés':['bois'], 'Plâtre et plaques':['platre', 'parement', 'interieur'],
  'Métaux':['metal'], 'Verre et plastiques':[], 'Revêtements de sol':['revsol', 'finition', 'interieur'], 'Couverture et étanchéité':['couverture', 'etancheite', 'exterieur'], 'Lames d\'air et divers':[], 'Peintures et finitions':['finition'],
  Portes:['porte', 'menuiserie'], 'Fenêtres':['fenetre', 'menuiserie'], Ouvertures:['menuiserie'], Structure:['porteur', 'poteau'], 'Escaliers et garde-corps':['escalier', 'securite'], Mobilier:['mobilier', 'composant'],
  'Cuisine et sanitaires':['sanitaire', 'composant'], Industrie:['industrie', 'composant'], 'Extérieur':['exterieur', 'vegetal', 'composant'],
};
const matIxCache = new Map();
function matIndex(id, m){
  const key = id + '|' + m.nom + '|' + (m.cat || '');
  let ix = matIxCache.get(key); if (ix) return ix;
  const tags = [...(MAT_ROLES[id] || [])], canon = CAT_TAGS[m.cat] || [];
  if (m.R != null) tags.push('air', 'intermediaire');
  if (m.lambda <= 0.055 && m.R == null && m.rho < 300) tags.push('isolant', 'intermediaire');
  if (m.rho >= 1800) tags.push('lourd'); else if (m.rho <= 200 && m.R == null) tags.push('leger');
  const ord = Math.max(0, MAT_CATS.indexOf(m.cat)) * 1000 + (MATS[id] ? 0 : 500);
  ix = sIndex(m.nom, {cat:m.cat, kw:id, tags, canon, ord}); matIxCache.set(key, ix); return ix;
}
const compoIxCache = new Map();
function compoIndex(id, c){
  const key = id + '|' + c.nom + '|' + c.kind + '|' + c.layers.map(l => l[0]).join(',');
  let ix = compoIxCache.get(key); if (ix) return ix;
  const tags = c.kind === 'wall' ? ['mur'] : c.kind === 'roof' ? ['toit', 'couverture'] : ['dalle'];
  const kw = [id, c.lot || '', ...c.layers.map(([m]) => mat(m).nom)].join(' ');
  for (const [m] of c.layers) for (const k of (MAT_ROLES[m] || [])) if (['isolant', 'biosource', 'bois', 'beton', 'maconnerie', 'metal', 'vapeur', 'membrane', 'acoustique', 'feu'].includes(k)) tags.push(k);
  ix = sIndex(c.nom, {cat:c.kind === 'wall' ? 'mur cloison' : c.kind === 'roof' ? 'toiture' : 'plancher dalle', kw, tags, ord:c.kind === 'wall' ? 0 : c.kind === 'slab' ? 1000 : 2000}); compoIxCache.set(key, ix); return ix;
}
const famIxCache = new Map();
function famIndex(id, F){
  const key = id + '|' + F.nom + '|' + (F.cat || '') + '|' + (F.types || []).length;
  let ix = famIxCache.get(key); if (ix) return ix;
  const path = typeof famPath === 'function' ? famPath(id, F) : [F.cat || ''];
  const tags = ['composant'], canon = CAT_TAGS[F.cat] || []; if (F.made === 'menuiserie' || F.join) tags.push('menuiserie');
  const jk = F.join?.kind || F.join?.type; if (jk) tags.push(/^p[ie]$|porte/.test(jk) && jk !== 'pf' ? 'porte' : 'fenetre');
  ix = sIndex(F.nom, {cat:path.join(' '), kw:[id, ...(F.types || []).map(t => t.nom), F.desc || ''].join(' '), tags, canon, ord:Math.max(0, FAM_CATS.indexOf(F.cat)) * 1000}); famIxCache.set(key, ix); return ix;
}
function elIndex(el){
  const KN = typeof KIND_NAME !== 'undefined' ? KIND_NAME : {};
  const kindTag = {wall:'mur', slab:'dalle', roof:'toit', stair:'escalier', col:'poteau', vol:'volume', sk:'esquisse', inst:'composant'}[el.kind];
  const tags = kindTag ? [kindTag] : [];
  let nom = typeof elName === 'function' ? elName(el) : (KN[el.kind] || el.kind) + ' ' + el.id, kw = String(el.id);
  if (el.kind === 'inst'){ const F = fam(el.fam); if (F){ const fx = famIndex(el.fam, F); for (const k of fx.tags) tags.push(k); kw += ' ' + (F.cat || ''); } }
  else if (el.kind === 'wall' || el.kind === 'slab' || el.kind === 'roof'){ const cx = compoIndex(el.type, compo(el.type)); for (const k of cx.tags) tags.push(k); }
  else if (el.mat){ const mx = matIndex(el.mat, mat(el.mat)); for (const k of mx.tags) tags.push(k); }
  const lv = state.levels[el.lvl]; if (lv) kw += ' ' + lv.n;
  return sIndex(nom, {cat:KN[el.kind] || '', kw, tags});
}
/* listes prêtes à chercher */
const searchMats = (filter) => Object.entries(libMats()).filter(([k, m]) => !k.startsWith('__') && (!filter || filter(k, m))).map(([id, m]) => ({id, m, ix:matIndex(id, m)}));
const searchCompos = (kind) => Object.entries(libCompos()).filter(([, c]) => !kind || c.kind === kind).map(([id, c]) => ({id, c, ix:compoIndex(id, c)}));
const searchFams = () => Object.entries(libFams()).map(([id, F]) => ({id, F, ix:famIndex(id, F)}));
/* chips de suggestion affichées sous les champs de recherche de matériaux */
const MAT_CHIPS = [['isolant', 'Isolants'], ['vapeur', 'Pare-vapeur'], ['porteur', 'Structure'], ['parement', 'Parement'], ['air', 'Lame d\'air'], ['membrane', 'Membranes'], ['revsol', 'Sols'], ['bois', 'Bois'], ['biosource', 'Biosourcé'], ['intermediaire', 'Couche intermédiaire']];
