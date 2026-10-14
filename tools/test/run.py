#!/usr/bin/env python3
"""Test de bout en bout hors ligne (Playwright + Chromium, WebGL logiciel).
Usage : python3 tools/test/run.py <three_dir> <fixture.json> <out_dir> [étapes]"""
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
THREE, FIX, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]); OUT.mkdir(parents=True, exist_ok=True)
steps = sys.argv[4].split(',') if len(sys.argv) > 4 else ['all']
fx = json.loads(FIX.read_text())
def route(r):
    u = r.request.url
    if 'cdn.jsdelivr.net/npm/three@0.160.0/' in u:
        p = THREE / u.split('three@0.160.0/')[1]
        return r.fulfill(path=str(p), content_type='application/javascript') if p.exists() else r.abort()
    if '/assets/' in u and u.startswith('file'):
        return r.fulfill(path=str(ROOT / 'assets' / u.split('/assets/')[1]))
    if u.startswith('file:') or u.startswith('data:') or u.startswith('blob:'): return r.continue_()
    return r.abort()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.route('**/*', route)
    pg.goto((ROOT / 'dist' / 'architrafic-demo.html').as_uri())
    pg.wait_for_function('window.__apReady === true', timeout=30000)
    time.sleep(3.4)
    pg.evaluate("""() => { document.getElementById('auth').hidden = true; const a = document.getElementById('app'); a.inert = false; const h = document.getElementById('home'); h.hidden = true; }""")
    pg.evaluate("""async fx => { const st = window.ATDebug.state(); st.site = {label:'Ville test', lat:48, lon:2, size:500}; await window.ATDebug.setWorldRaw(fx, st.site); }""", fx)
    time.sleep(1.5); pg.screenshot(path=str(OUT / '01-site-3d.png'))
    info = pg.evaluate("""() => { const W = window.ATDebug.world(); return {roads:W.W.roads.length, bld:W.W.bld.length, nodes:window.ATDebug.net().nodes.size, edges:window.ATDebug.net().edges.length, ms:0}; }""")
    print('monde', info)
    r = pg.evaluate("""() => { const D = window.ATDebug; const nr = D.nearestRoad([40, 80], 10); D.makeClosure(nr); const s = D.state(); return s.els.map(e => [e.t, e.k || e.mode || '', e.name || '', Math.round(e.len || 0), e.extra || 0]); }""")
    print('après fermeture', r)
    pg.evaluate("() => window.ATDebug.frameAt(40, 80, 70)"); time.sleep(1.2); pg.screenshot(path=str(OUT / '02-closure.png'))
    pg.evaluate("() => { window.ATDebug.setView('2d'); window.ATDebug.setStyle('plan'); window.ATDebug.frameAt(40, 80, 160); }"); time.sleep(1.2); pg.screenshot(path=str(OUT / '03-plan.png'))
    pg.evaluate("() => { window.ATDebug.setStyle('textured'); window.ATDebug.setView('3d'); window.ATDebug.frameAt(0, 0, 90); document.getElementById('simDens').value='1.8'; window.ATDebug.state().sim.dens = 1.8; document.getElementById('simPlay').click(); }")
    time.sleep(14); pg.screenshot(path=str(OUT / '04-sim.png'))
    print('sim', pg.evaluate("() => { const S = window.ATDebug.sim(); return {agents:S.agents.length, t:Math.round(S.t), entries:S.entries.length, exits:S.exits.length, live:S.live}; }"))
    pg.evaluate("() => document.querySelector('[data-tab=lib]').click()"); time.sleep(2.5); pg.screenshot(path=str(OUT / '05-lib.png'))
    pg.evaluate("() => { document.querySelector('[data-cat=eng]').click(); }"); time.sleep(3); pg.screenshot(path=str(OUT / '06-lib-eng.png'))
    pg.evaluate("() => { document.documentElement.dataset.theme='dark'; document.querySelector('[data-tab=traffic]').click(); }"); time.sleep(1.5); pg.screenshot(path=str(OUT / '07-dark-traffic.png'))
    b.close()
print('\n'.join(errs[:40]) or 'aucune erreur console')
