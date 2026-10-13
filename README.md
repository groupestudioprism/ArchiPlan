# ARCHIPLAN · Studio Prism

Modeleur 3D multi-appareil (téléphone, tablette, ordinateur) pour le bâtiment et l'industrie, compatible avec l'app de réalité augmentée **Archi Vision**. Une app du pôle **Prism App** de Studio Prism.

**En ligne :** https://groupestudioprism.github.io/archiplan/

## Contenu du dépôt

| Fichier | Rôle |
| --- | --- |
| `src/archiplan.html` | **Source** de l'application (fichier unique). Ouvert seul, il fonctionne en mode démo (comptes et cloud dans le navigateur) |
| `tools/build.py` | Construit `index.html` à partir de la source : branche Firebase et précharge ses scripts. `python3 tools/build.py` |
| `index.html` | **Version en ligne** (générée, ne pas modifier à la main) : intro, connexion Studio Prism, fiche client, code PIN, accueil cloud, licence, modeleur 3D (Three.js 0.160), exports Archi Vision (ZIP), IFC4, GLB, CSV, JSON |
| `firebase/firestore.rules` | Copie de référence des règles Firestore : celles du site Studio Prism **plus** le bloc `clientProfiles` d'ARCHIPLAN |
| `.nojekyll` | Publication telle quelle par GitHub Pages |

On modifie `src/archiplan.html`, on lance `python3 tools/build.py`, on enregistre (commit) sur `main` : GitHub Pages met le site à jour en une minute environ.

## Comptes Studio Prism

ARCHIPLAN utilise **le même projet Firebase que le site Studio Prism** (`archivision-studioprism`) : un compte créé sur le site se connecte à ARCHIPLAN, et inversement.

- **Profil** : `users/{uid}`, le même document que le site (prénom, nom, e-mail, type de compte, abonnement, rôle, statut). Un compte désactivé sur le site est refusé dans ARCHIPLAN.
- **Fiche client** : `clientProfiles/{uid}` (téléphone, profil, société, adresse), demandée une seule fois.
- **Code PIN du compte** : haché (PBKDF2, 200 000 itérations), enregistré dans `userSecrets/{uid}` (lisible par le seul titulaire, jamais en clair, jamais envoyé par email). Le même code sur tous les appareils ; il confirme aussi la suppression du compte. Empreinte / visage (Face ID, Touch ID, Windows Hello) : **facultatif**, par appareil.
- **Ouverture rapide** : la session reste ouverte après fermeture du navigateur ; au retour, l'écran du code PIN s'affiche sans attendre le réseau (profil mémorisé, revérifié en arrière-plan). Délais maximum et bouton « Réessayer » si le réseau bloque.
- **Suppression du compte** : menu du compte → « Supprimer mon compte » → page `compte-suppression.html` du site Studio Prism → lien de confirmation par email → code PIN → suppression (profil, licences, fiche client, code PIN, projets ARCHIPLAN et partages).

La configuration Firebase écrite dans `index.html` est publique par conception ; la sécurité repose sur les règles Firestore. **Ne jamais ajouter de clé privée ni de compte de service dans ce dépôt.**

## Accueil et cloud

Après le code PIN, ARCHIPLAN s'ouvre sur **l'accueil** : *Mes projets* (avec dossiers) et *Partagés avec moi*.

- **Enregistrement automatique** dans le cloud à chaque modification (moins de 2 secondes après, miniature régulière). État affiché dans l'en-tête : « Enregistré · 14:32 », « Lecture seule »…
- **Menu ⋮** d'un projet : ouvrir, renommer, dupliquer (sauvegarde), télécharger une sauvegarde `.json`, déplacer vers un dossier, partager, supprimer. Dossier : ouvrir, renommer, supprimer (son contenu remonte d'un niveau).
- **Partage** comme Google Drive : par email (Lecture ou Modification), ou par lien (Lecture ou Modification), **avec ou sans mot de passe**. Les invités se connectent avec un compte Studio Prism **vérifié**. Leurs droits dépendent aussi de **leur propre licence** : un invité sans licence ne peut que consulter, même si l'hôte a une licence Pro.
- Données Firestore : `apProjects/{id}` (+ `content/main`), `apFolders`, `apShares/{id}__{email}`, `apGrants/{id}__{uid}`. Les règles imposent tous ces droits côté serveur.

## Licence ARCHIPLAN

Au moment de la connexion, ARCHIPLAN lit `licenses/{uid}_archiplan`, la licence que l'administration du site Studio Prism attribue à un compte pour le produit `archiplan`.

| Situation | Accès |
| --- | --- |
| Administrateur actif (`role = admin`) | Tous les droits |
| Licence `active`, sans date de fin ou non expirée | Tous les droits |
| Aucune licence, licence expirée ou suspendue | **Mode découverte** : modélisation libre et projets partagés en lecture, mais pas de cloud personnel ni d'export |

Hors ligne, les derniers droits vérifiés restent valables 7 jours.

**Attribuer une licence :** site Studio Prism → Administration → Utilisateurs → fiche du compte → « + Ajouter une licence » → produit ARCHIPLAN. Le produit `archiplan` doit exister dans Administration → Catalogue (identifiant / adresse : `archiplan`).

## Règles Firestore

Les règles sont communes au site et à ARCHIPLAN. La référence est le dépôt du site (`firebase/firestore.rules`) : il doit contenir le bloc `clientProfiles` présent dans `firebase/firestore.rules` ici, sinon la prochaine publication des règles du site empêcherait l'enregistrement des fiches client ARCHIPLAN.

## Domaine

`groupestudioprism.github.io` est ajouté aux domaines autorisés de Firebase Authentication (projet `archivision-studioprism`).
