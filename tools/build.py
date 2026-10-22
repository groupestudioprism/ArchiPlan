#!/usr/bin/env python3
"""Assemble ARCHIPLAN en un seul fichier HTML à partir des sources de src/.

  src/parts/head.html            titre, polices
  src/css/*.css                  styles (ordre : CSS_ORDER)
  src/parts/body.html            structure de la page (intro, compte, maquette, accueil)
  src/js/auth.js + cloud.js + auth-end.js   compte Studio Prism, cloud, accueil (script classique, une seule IIFE)
  src/parts/importmap.html       Three.js
  src/engine/*.js                moteur 3D (module ES, fichiers concaténés dans l'ordre alphabétique)

Sorties :
  index.html                     site en ligne (GitHub Pages) : Firebase branché, scripts préchargés
  dist/archiplan-demo.html       démo autonome (comptes et cloud dans le navigateur), utilisée pour l'aperçu Claude
Usage : python3 tools/build.py
"""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
S = ROOT / 'src'
CSS_ORDER = ['app.css', 'splash.css', 'auth.css', 'home.css']
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
def rd(p): return (S / p).read_text(encoding='utf-8')
def assemble(engine_dir='engine', css=CSS_ORDER, body='parts/body.html', cloud='js/cloud.js'):
    engine = ''.join(f'/* ==== {f.name} ==== */\n' + f.read_text(encoding='utf-8') + '\n' for f in sorted((S / engine_dir).glob('*.js')))
    return (rd('parts/head.html') + '<style>\n' + ''.join(rd('css/' + c) for c in css) + '</style>\n' + rd(body)
            + '<script>\n' + rd('js/auth.js') + rd(cloud) + rd('js/auth-end.js') + '</script>\n'
            + rd('parts/importmap.html') + '<script type="module">\n' + engine + '</script>\n')
HEAD = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">'
        '<meta name="description" content="ARCHIPLAN · Studio Prism : conception de plans et modélisation 3D sur téléphone, tablette et ordinateur.">'
        '<meta name="theme-color" content="#071B55">'
        '<link rel="preconnect" href="https://www.gstatic.com" crossorigin>'
        '<link rel="preconnect" href="https://firestore.googleapis.com">'
        '<link rel="preconnect" href="https://identitytoolkit.googleapis.com">'
        '<link rel="preconnect" href="https://securetoken.googleapis.com">'
        '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>'
        + ''.join(f'<link rel="preload" as="script" href="https://www.gstatic.com/firebasejs/{FB}/firebase-{n}-compat.js">' for n in ('app', 'auth', 'firestore')) +
        '<style id="spBoot">html{background:#F9FAFA}</style><style>[hidden]{display:none!important}html{overflow:hidden;overscroll-behavior:none}body{overflow:hidden;overscroll-behavior:none}*{overscroll-behavior-x:contain}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}body{margin:0}</style></head><body>\n')
def main(argv):
    demo = assemble()
    assert demo.count('const FIREBASE_CONFIG = null;') == 1 and f"FIREBASE_VERSION = '{FB}'" in demo
    (ROOT / 'dist').mkdir(exist_ok=True)
    (ROOT / 'dist' / 'archiplan-demo.html').write_text(demo, encoding='utf-8')
    live = HEAD + demo.replace('const FIREBASE_CONFIG = null;', CONFIG).replace('<title>ARCHIPLAN</title>', '<title>ARCHIPLAN · Studio Prism</title>', 1) + '</body></html>\n'
    (ROOT / 'index.html').write_text(live, encoding='utf-8')
    print('index.html', len(live), 'octets · dist/archiplan-demo.html', len(demo), 'octets')
if __name__ == '__main__': main(sys.argv[1:])
