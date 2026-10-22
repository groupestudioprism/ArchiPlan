# ARCHIPLAN · Studio Prism

Modeleur 3D multi-appareil (téléphone, tablette, ordinateur) pour le bâtiment et l'industrie, compatible avec l'app de réalité augmentée **Archi Vision**. Une app du pôle **Prism App** de Studio Prism.

**En ligne :** https://groupestudioprism.github.io/archiplan/

## Contenu du dépôt

| Fichier | Rôle |
| --- | --- |
| `src/parts/` | Structure de la page : en-tête, corps (intro, compte, accueil, modeleur), import de Three.js |
| `src/css/` | Charte Studio Prism : `app.css` (modeleur), `home.css` (accueil, dialogues), `auth.css`, `splash.css` |
| `src/js/` | Compte Studio Prism et code PIN (`auth.js`), cloud, dossiers, partage, quotas, accueil (`cloud.js`), menu du compte (`auth-end.js`) |
| `src/engine/` | Moteur 3D (module ES, fichiers concaténés dans l'ordre) : matériaux, familles, calculs physiques, état, géométrie, scène et rendus, saisie et accroches, panneau, compositeur de parois, éditeur de familles, rendu, exports |
| `tools/build.py` | Assemble le tout : `python3 tools/build.py` → `index.html` (en ligne, Firebase branché) et `dist/archiplan-demo.html` (démo autonome) |
| `index.html` | **Version en ligne** (générée, ne pas modifier à la main) |
| `Studio-Prism/firebase/firestore.rules (source unique)` | Copie de référence des règles Firestore communes au site et à ARCHIPLAN |
| `.nojekyll` | Publication telle quelle par GitHub Pages |

On modifie `src/`, on lance `python3 tools/build.py`, on enregistre (commit) sur `main` : GitHub Pages met le site à jour en une minute environ.

## Modeleur

- **Trois modes** : *Plan* (vue de dessus façon DAO : niveau courant seul, aplats clairs, traits sombres, éléments au-dessus du plan de coupe en tirets), *3D*, *Rendu*.
- **Dessin façon AutoCAD** : barre de commande (`4,20` longueur, `4,2<90` longueur et angle, `@5;3` relatif, `2;3` absolu, mots-clés `MUR`, `DEP`, `CO`, `RO`, `PP`, `ZE`), accroches aux objets (extrémité, milieu, centre, intersection, perpendiculaire, proche, faces de mur) avec symboles, repérage, polaire, ortho, grille, accroche aux surfaces en 3D (F3, F7, F8, F9, F10, F11).
- **Simplicité façon SketchUp** : rail d'outils (sélection, déplacer, copier, rotation, mur, dalle, poteau, volume, composant, pousser/tirer, mesure), Pousser/Tirer sur les faces en 3D.
- **Onglet Projet** : arborescence niveaux → catégories → éléments (couches des parois, ouvertures sous leur mur), masquer / isoler, menu ⋮ par élément (centrer, dupliquer, ajuster l'isolant, composition, supprimer). **Ajuster l'isolant** : couche, matériau, λ, épaisseur, ou objectif U / R (épaisseur calculée), comparaison avant / après, valeurs U ou R forcées (avis technique). La variante est enregistrée dans la bibliothèque du projet.
- **Affichage** : fond blanc par défaut, couleur réglable, grille, cotes, arêtes, ombres (bouton « Affichage » de la vue).
- **Bibliothèque** : environ 95 matériaux (λ, ρ, c, μ, carbone A1-A3, motif de rendu), 21 compositions de parois, une trentaine de familles paramétriques (portes, fenêtres, structure, escalier, mobilier, sanitaires, industrie, végétation…). Bibliothèque personnelle dans le cloud (`apLibrary/{uid}`).
- **Compositeur de parois** : couches de l'extérieur vers l'intérieur ; U et R (EN ISO 6946), déphasage, amortissement et capacité intérieure (EN ISO 13786), indice acoustique Rw estimé (loi de masse, masse-ressort-masse), Sd et diagramme de Glaser (condensation, règle du facteur 5), masse et carbone. Calculs de pré-dimensionnement, indicatifs.
- **Familles** façon Revit : paramètres, types, pièces en formules (`w/2`, `min()`, répétitions `n`, conditions `si`), ouverture dans le mur, familles imbriquées (assemblages).
- **Rendus** : ombré, matériaux, réaliste (ciel, soleil réglable, ombres), croquis, filaire, rayons X ; captures HD et 4K.
- **Métré · DQE** : articles rangés automatiquement par lots (01 Terrassements … 14 Aménagements extérieurs) selon le contenu de la maquette (couches des parois, éléments, menuiseries, équipements), prix unitaires indicatifs modifiables (enregistrés dans le projet), export Excel (.xlsx avec formules), PDF ou CSV avec options à cocher (lots, numérotation, quantités, unités, prix, sous-totaux, TVA/TTC, quantités par niveau, masses, carbone, tableau des matériaux, en-tête).
- **Lieu du projet** : adresse (géocodage IGN), zone climatique H1a…H3 et altitude, exposition au bruit (DnT,A,tr visé), repères thermiques adaptés (classes A/B/C/D, R minimaux rénovation et aides), estimation de l'isolement des façades, terrain 3D (relief IGN RGE ALTI, plateforme sous le bâtiment), exporté dans le GLB.
- **Clés de licence** : activation d'une clé Studio Prism depuis l'écran licence (même procédure que le site).
- **Exports** (licence) : **GLB pour Archi Vision** (un groupe par niveau, matériaux PBR texturés, métadonnées), IFC4, métré CSV, image PNG, projet JSON, paquet ZIP.

## Comptes Studio Prism

ARCHIPLAN utilise **le même projet Firebase que le site Studio Prism** (`archivision-studioprism`) : un compte créé sur le site se connecte à ARCHIPLAN, et inversement.

- **Profil** : `users/{uid}`, le même document que le site (prénom, nom, e-mail, type de compte, abonnement, rôle, statut). Un compte désactivé sur le site est refusé dans ARCHIPLAN.
- **Fiche client** : `clientProfiles/{uid}` (téléphone, profil, société, adresse), demandée une seule fois.
- **Code PIN du compte** : haché (PBKDF2, 200 000 itérations), enregistré dans `userSecrets/{uid}` (lisible par le seul titulaire, jamais en clair, jamais envoyé par email). Le même code sur tous les appareils ; il confirme aussi la suppression du compte. Empreinte / visage (Face ID, Touch ID, Windows Hello) : **facultatif**, par appareil.
- **Ouverture rapide** : la session reste ouverte après fermeture du navigateur ; au retour, l'écran du code PIN s'affiche sans attendre le réseau (profil mémorisé, revérifié en arrière-plan). Délais maximum et bouton « Réessayer » si le réseau bloque.
- **Suppression du compte** : menu du compte → « Supprimer mon compte » → page `compte-suppression.html` du site Studio Prism → mot de passe du compte → code PIN → suppression (profil, licences, fiche client, code PIN, projets, dossiers, partages, bibliothèque et compteur de stockage ARCHIPLAN).

La configuration Firebase écrite dans `index.html` est publique par conception ; la sécurité repose sur les règles Firestore. **Ne jamais ajouter de clé privée ni de compte de service dans ce dépôt.**

## Accueil et cloud

Après le code PIN, ARCHIPLAN s'ouvre sur **l'accueil** : *Mes projets* (avec dossiers) et *Partagés avec moi*, carte « Mon cloud » (espace utilisé, dossiers).

- **Enregistrement automatique** à chaque modification (moins de 2 secondes après, miniature régulière).
- **Menu ⋮** : ouvrir, renommer, dupliquer, sauvegarde `.json`, déplacer, partager, supprimer.
- **Partage** comme Google Drive, pour un projet **ou un dossier** : par email (Lecture ou Modification) ou par lien (avec ou sans mot de passe). Invités : compte Studio Prism **vérifié**. Un invité « Modification » d'un dossier peut y créer des projets.
- **Stockage** : le propriétaire paie pour tout ce qu'il possède, y compris les projets créés ou agrandis par ses invités dans ses dossiers partagés.

| Offre | Cloud | Dossiers | Exports |
| --- | --- | --- | --- |
| Gratuite | 10 Mo | 5 privés + 3 partagés | Non |
| Licence ARCHIPLAN | 50 Mo | 5 privés + 3 partagés | Oui |
| Administrateur | 1 Go | 5 privés + 3 partagés | Oui |

Le quota de stockage est imposé **côté serveur** (compteur `apUsage/{uid}` mis à jour dans le même lot que chaque projet, cohérence vérifiée par les règles). Les plafonds de dossiers sont appliqués par l'application.

Données Firestore : `apProjects/{id}` (+ `content/main`), `apFolders`, `apShares/{cible}__{email}` (cible = projet, ou `F_` + dossier), `apGrants/{cible}__{uid}`, `apUsage/{uid}`, `apLibrary/{uid}`, `userSecrets/{uid}`.

## Licence ARCHIPLAN

Au moment de la connexion, ARCHIPLAN lit `licenses/{uid}_archiplan`, la licence que l'administration du site Studio Prism attribue à un compte pour le produit `archiplan`. Sans licence : tous les outils et 10 Mo de cloud, sans export. Hors ligne, les derniers droits vérifiés restent valables 7 jours.

**Attribuer une licence :** site Studio Prism → Administration → Utilisateurs → fiche du compte → « + Ajouter une licence » → produit ARCHIPLAN.

## Règles Firestore

Les règles sont communes au site et à ARCHIPLAN. La référence est le dépôt du site (`Studio-Prism/firebase/firestore.rules (source unique)`) : il contient les blocs ARCHIPLAN (`clientProfiles`, cloud, quotas). Publication : `bash ~/Documents/ARCHIPLAN/regles-firestore/publier-regles.sh`.

## Domaine

`groupestudioprism.github.io` est ajouté aux domaines autorisés de Firebase Authentication (projet `archivision-studioprism`).
