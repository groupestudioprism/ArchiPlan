#!/usr/bin/env python3
"""Construit index.html (site en ligne) à partir de src/archiplan.html (source unique, mode démo quand on l'ouvre seule).

- branche le projet Firebase de Studio Prism (configuration web publique par conception) ;
- ajoute l'en-tête HTML et le préchargement des scripts Firebase (connexion plus rapide).
Usage : python3 tools/build.py
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'src' / 'archiplan.html', ROOT / 'index.html'
FB = '10.12.2'
CONFIG = '''const FIREBASE_CONFIG = {
  // Projet Firebase de Studio Prism : le même que le site (js/firebase.js du dépôt Studio-Prism). Configuration publique par conception.
  apiKey: "AIzaSyAAD5rrHuVh6_PC2_45L3y9F7zWe5ACW6E",
  authDomain: "archivision-studioprism.firebaseapp.com",
  projectId: "archivision-studioprism",
  storageBucket: "archivision-studioprism.firebasestorage.app",
  messagingSenderId: "226072216517",
  appId: "1:226072216517:web:0aeef645a4f1481fe801ac"
};'''
HEAD = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="description" content="ARCHIPLAN · Studio Prism : conception de plans et modélisation 3D sur téléphone, tablette et ordinateur.">'
        '<link rel="preconnect" href="https://www.gstatic.com" crossorigin>'
        '<link rel="preconnect" href="https://firestore.googleapis.com">'
        '<link rel="preconnect" href="https://identitytoolkit.googleapis.com">'
        '<link rel="preconnect" href="https://securetoken.googleapis.com">'
        '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>'
        + ''.join(f'<link rel="preload" as="script" href="https://www.gstatic.com/firebasejs/{FB}/firebase-{n}-compat.js">' for n in ('app', 'auth', 'firestore')) +
        '<style>[hidden]{display:none!important}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}</style></head><body>\n')
s = SRC.read_text(encoding='utf-8')
assert s.count('const FIREBASE_CONFIG = null;') == 1 and f"FIREBASE_VERSION = '{FB}'" in s
s = s.replace('const FIREBASE_CONFIG = null;', CONFIG).replace('<title>ARCHIPLAN</title>', '<title>ARCHIPLAN · Studio Prism</title>', 1)
OUT.write_text(HEAD + s + '\n</body></html>\n', encoding='utf-8')
print('index.html :', OUT.stat().st_size, 'octets')
