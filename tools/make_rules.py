#!/usr/bin/env python3
"""Ajoute le bloc ARCHITRAFIC aux règles Firestore communes du site Studio Prism.

Le bloc est dérivé de celui d'ARCHIPLAN (cloud des projets, dossiers, partage, quotas, bibliothèque) :
mêmes règles, collections préfixées « at » au lieu de « ap » (atProjects, atFolders, atShares, atGrants, atUsage, atLibrary).
Quota ARCHITRAFIC : 50 Mo pour tout compte actif (licence gratuite pour l'instant), 1 Go pour un administrateur.

Usage : python3 tools/make_rules.py chemin/vers/firestore.rules  > firebase/firestore.rules
"""
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
if 'ARCHITRAFIC : cloud' in src:
    sys.stdout.write(src); sys.exit(0)            # déjà présent
start = src.index('    // ------------------------------------------------------------ ARCHIPLAN : cloud')
end = src.index('    match /userSecrets/{uid}')
blk = src[start:end]
blk = blk.replace('ARCHIPLAN : cloud des projets, dossiers, partage, quotas, bibliothèque, code PIN', 'ARCHITRAFIC : cloud des chantiers, dossiers, partage, quotas, bibliothèque')
blk = re.sub(r'\bap(Projects|Folders|Shares|Grants|Usage|Library)\b', r'at\1', blk)
blk = re.sub(r'\bap(Email|Verified|P|F|U|Quota|UsageOk|ShareRole|GrantOk|FolderRole|GuestRole|CanRead|CanEdit|ValidProject|ValidFolder|ValidShare|ValidGrant)\(', r'at\1(', blk)
blk = blk.replace('Quota : 10 Mo (gratuit), 50 Mo (licence ARCHIPLAN), 1 Go (administrateur).', 'Quota : 50 Mo (licence ARCHITRAFIC gratuite pour tout compte actif), 1 Go (administrateur).')
blk = blk.replace('bibliothèque personnelle (matériaux, compositions de parois, familles)', 'bibliothèque personnelle (éléments de signalisation et de balisage personnalisés)')
# quota : ARCHITRAFIC est gratuit pour l'instant (50 Mo pour tous)
q0 = blk.index('    function atQuota(uid) {'); q1 = blk.index('    }\n', q0) + 6
blk = blk[:q0] + '''    function atQuota(uid) {
      let u = get(/databases/$(database)/documents/users/$(uid)).data;
      return isActiveAdminProfile(u) ? 1000000000 : 50000000;
    }
''' + blk[q1:]
# on ne garde pas le commentaire du code PIN (déjà décrit pour ARCHIPLAN)
blk = blk.replace("    // userSecrets/{uid}          code PIN du compte, HACHÉ (PBKDF2) : lisible par son seul titulaire, jamais par un administrateur.\n", '')
assert 'apP(' not in blk and 'apProjects' not in blk, 'renommage incomplet'
sys.stdout.write(src[:end] + blk + src[end:])
