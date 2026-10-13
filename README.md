# ARCHIPLAN · Studio Prism

Modeleur 3D multi-appareil (téléphone, tablette, ordinateur) pour le bâtiment et l'industrie, compatible avec l'app de réalité augmentée **Archi Vision**. Une app du pôle **Prism App** de Studio Prism.

**En ligne :** https://groupestudioprism.github.io/archiplan/

## Contenu du dépôt

| Fichier | Rôle |
| --- | --- |
| `index.html` | L'application complète : intro de chargement, connexion Studio Prism, fiche client, code PIN / Face ID / Touch ID, licence, modeleur 3D (Three.js 0.160), exports Archi Vision (ZIP), IFC4, GLB, CSV et projet JSON |
| `firebase/firestore.rules` | Copie de référence des règles Firestore : celles du site Studio Prism **plus** le bloc `clientProfiles` d'ARCHIPLAN |
| `.nojekyll` | Publication telle quelle par GitHub Pages |

Aucun outil de build : on modifie `index.html`, on enregistre (commit) sur `main`, et GitHub Pages met le site à jour en une minute environ.

## Comptes Studio Prism

ARCHIPLAN utilise **le même projet Firebase que le site Studio Prism** (`archivision-studioprism`) : un compte créé sur le site se connecte à ARCHIPLAN, et inversement.

- **Profil** : `users/{uid}`, le même document que le site (prénom, nom, e-mail, type de compte, abonnement, rôle, statut). Un compte désactivé sur le site est refusé dans ARCHIPLAN.
- **Fiche client** : `clientProfiles/{uid}` (téléphone, profil, société, adresse), demandée une seule fois.
- **Code PIN** : uniquement sur l'appareil, haché (PBKDF2), jamais envoyé.

La configuration Firebase écrite dans `index.html` est publique par conception ; la sécurité repose sur les règles Firestore. **Ne jamais ajouter de clé privée ni de compte de service dans ce dépôt.**

## Licence ARCHIPLAN

Au moment de la connexion, ARCHIPLAN lit `licenses/{uid}_archiplan`, la licence que l'administration du site Studio Prism attribue à un compte pour le produit `archiplan`.

| Situation | Accès |
| --- | --- |
| Administrateur actif (`role = admin`) | Tous les droits |
| Licence `active`, sans date de fin ou non expirée | Tous les droits |
| Aucune licence, licence expirée ou suspendue | **Mode découverte** : modélisation libre, mais export désactivé et maquette non conservée |

Hors ligne, les derniers droits vérifiés restent valables 7 jours.

**Attribuer une licence :** site Studio Prism → Administration → Utilisateurs → fiche du compte → « + Ajouter une licence » → produit ARCHIPLAN. Le produit `archiplan` doit exister dans Administration → Catalogue (identifiant / adresse : `archiplan`).

## Règles Firestore

Les règles sont communes au site et à ARCHIPLAN. La référence est le dépôt du site (`firebase/firestore.rules`) : il doit contenir le bloc `clientProfiles` présent dans `firebase/firestore.rules` ici, sinon la prochaine publication des règles du site empêcherait l'enregistrement des fiches client ARCHIPLAN.

## Domaine

`groupestudioprism.github.io` est ajouté aux domaines autorisés de Firebase Authentication (projet `archivision-studioprism`).
