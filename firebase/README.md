# Règles Firestore : elles ne sont plus dans ce dépôt

Toutes les apps Studio Prism partagent **un seul projet Firebase** (`archivision-studioprism`) et donc **un seul fichier de règles en ligne**.
Pour éviter qu'une copie ancienne écrase les règles des autres apps, la source unique est désormais dans le dépôt **Studio-Prism** :

- règles par app : `Studio-Prism/firebase/rules/*.rules`
- fichier complet à publier : `Studio-Prism/firebase/firestore.rules` (assemblé et contrôlé par `python3 tools/build_rules.py`)
- publication : depuis Studio-Prism uniquement (`firebase deploy --only firestore:rules`, ou coller le fichier complet dans la console)

Pour tester en local (émulateur), récupérer le fichier complet :

    curl -fsSL https://raw.githubusercontent.com/groupestudioprism/Studio-Prism/main/firebase/firestore.rules -o firebase/firestore.rules

(ce fichier téléchargé est ignoré par git).
