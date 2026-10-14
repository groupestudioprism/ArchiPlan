#!/usr/bin/env python3
"""Fixture de test hors ligne : petite ville en damier (rues, sens uniques, bâtiments, parc, relief)."""
import json, math, random, sys
lat0, lon0 = 48.0, 2.0
kx = 111320 * math.cos(math.radians(lat0)); ky = 110540
ll = lambda x, y: (lon0 + x / kx, lat0 + y / ky)
els = []; nid = [1000]; wid = [5000]; nodes = {}
def node(x, y, tags=None):
    k = (round(x, 2), round(y, 2))
    if k in nodes: 
        if tags: 
            for e in els:
                if e['type']=='node' and e['id']==nodes[k]: e.setdefault('tags',{}).update(tags)
        return nodes[k]
    nid[0] += 1; lon, lat = ll(x, y); nodes[k] = nid[0]; e={'type':'node','id':nid[0],'lat':lat,'lon':lon}
    if tags: e['tags']=tags
    els.append(e); return nid[0]
def way(pts, tags, ids=None):
    wid[0] += 1; ids = ids or [node(*p) for p in pts]
    geom = [{'lat': ll(*p)[1], 'lon': ll(*p)[0]} for p in pts]
    els.append({'type':'way','id':wid[0],'nodes':ids,'geometry':geom,'tags':tags}); return wid[0]
G = [-320, -240, -160, -80, 0, 80, 160, 240, 320]
names_h = ['Rue des Lilas','Rue Pasteur','Rue Victor Hugo','Rue de la Paix','Avenue de la République','Rue Jean Jaurès','Rue du Moulin','Rue des Écoles','Rue Neuve']
names_v = ['Rue Voltaire','Rue Gambetta','Rue Carnot','Rue Thiers','Boulevard Central','Rue Foch','Rue Hoche','Rue Kléber','Rue Lafayette']
def street(fixed, horiz, name, hw, oneway=None):
    # découpée en tronçons entre carrefours, nœuds intermédiaires tous les 20 m
    for i in range(len(G)-1):
        a, b = G[i], G[i+1]; pts = []
        for k in range(5):
            t = a + (b-a)*k/4; pts.append((t, fixed) if horiz else (fixed, t))
        tags = {'highway':hw,'name':name}
        if oneway: tags['oneway'] = oneway
        way(pts, tags)
for j, y in enumerate(G):
    hw = 'secondary' if y == 0 else 'residential'
    ow = None if y in (0, -320, 320) else ('yes' if j % 2 else '-1') if j in (2, 6) else None
    street(y, True, names_h[j], hw, ow)
for i, x in enumerate(G):
    hw = 'secondary' if x == 0 else 'residential'
    ow = 'yes' if x == 80 else None
    street(x, False, names_v[i], hw, ow)
# feux au centre, passages piétons
node(0, 0, {'highway':'traffic_signals'})
for p in [(0, 12), (12, 0), (-12, 0), (0, -12), (80, 40), (-40, 80)]: node(*p, {'highway':'crossing'})
# bâtiments le long des rues (sauf le parc)
random.seed(4)
for i in range(len(G)-1):
    for j in range(len(G)-1):
        x0, x1, y0, y1 = G[i]+9, G[i+1]-9, G[j]+9, G[j+1]-9
        if (i, j) == (5, 5):
            way([(x0,y0),(x1,y0),(x1,y1),(x0,y1),(x0,y0)], {'leisure':'park'})
            for k in range(12): node(random.uniform(x0+5,x1-5), random.uniform(y0+5,y1-5), {'natural':'tree'})
            continue
        if (i, j) == (2, 5):
            way([(x0,y0),(x1,y0),(x1,y1),(x0,y1),(x0,y0)], {'amenity':'parking'}); continue
        x = x0
        while x < x1 - 8:
            w = random.uniform(8, 16); lv = random.choice([2,3,4,5])
            for (ya, yb) in [(y0, y0+12), (y1-12, y1)]:
                way([(x,ya),(x+w-0.5,ya),(x+w-0.5,yb),(x,yb),(x,ya)], {'building':'yes','building:levels':str(lv)})
            x += w
# arbres d'alignement
for x in range(-300, 300, 12): node(x, 5.5, {'natural':'tree'})
osm = {'elements': els}
N = 101; S = 500
z = [round(60 + 0.02*(i - N/2)*S/N*1.0 + 3*math.sin(j/12), 2) for j in range(N) for i in range(N)]
raw = {'at': 0, 'src': {'osm':'fixture', 'elev':'fixture'}, 'osm': osm, 'bdt': [], 'elev': {'N': N, 'z': z}}
json.dump(raw, open(sys.argv[1], 'w'))
print(len(els), 'éléments')
