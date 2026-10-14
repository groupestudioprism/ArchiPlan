/* ============ Épures de giration (cinématique des véhicules) ============
   L'essieu avant suit la trajectoire dessinée ; l'essieu arrière suit en tractrice (modèle « bicyclette ») ;
   pour un semi-remorque, la remorque suit le pivot d'attelage de la même façon. On en déduit l'enveloppe balayée
   par la caisse et les traces des roues : de quoi vérifier qu'un véhicule passe dans un virage ou une déviation. */
const SWEPT_VEH = {
  vl:{n:'Voiture (VL)', L:4.75, W:1.82, wb:2.8, fo:0.95, build:() => makeCar('berline', 0x7B1FA2)},
  vul:{n:'Fourgon', L:5.4, W:2.0, wb:3.4, fo:1.0, build:() => makeVan(0xE1BEE7)},
  porteur:{n:'Porteur 19 t (10 m)', L:9.8, W:2.5, wb:5.3, fo:1.4, build:() => makeTruck()},
  bus:{n:'Bus standard (12 m)', L:12, W:2.55, wb:5.9, fo:2.7, build:() => makeBus()},
  benne:{n:'Camion benne 8×4', L:9.2, W:2.5, wb:5.0, fo:1.5, build:() => makeTipper()},
  semi:{n:'Semi-remorque (16,5 m)', L:16.5, W:2.55, wb:3.8, fo:1.4, kp:0.5, tl:7.7, tf:1.6, tr:4.3, build:() => makeSemi()},
};
const sweptVehicle = k => SWEPT_VEH[k] || null;
function sweptCompute(pts, k){
  const S = SWEPT_VEH[k] || SWEPT_VEH.porteur, path = densify(pts, 0.25), L = plLen(path); if (L < 1) return null;
  const d0 = plAt(path, 0).dir; let F = path[0], R = V.sub(F, V.mul(d0, S.wb)), K, T;
  if (S.tl){ K = V.add(R, V.mul(d0, S.kp)); T = V.sub(K, V.mul(d0, S.tl)); }
  const lft = [], rgt = [], tracks = [[], [], [], []], hw = S.W / 2;
  const push = () => {
    const h = V.norm(V.sub(F, R)), n = V.perp(h), corners = [];
    const front = V.add(F, V.mul(h, S.fo)), rear = V.sub(R, V.mul(h, S.L - S.wb - S.fo > 0 && !S.tl ? S.L - S.wb - S.fo : 0.6));
    corners.push(V.add(front, V.mul(n, hw)), V.sub(front, V.mul(n, hw)), V.add(rear, V.mul(n, hw)), V.sub(rear, V.mul(n, hw)));
    tracks[0].push(V.add(F, V.mul(n, hw - 0.25))); tracks[1].push(V.sub(F, V.mul(n, hw - 0.25)));
    if (S.tl){ const ht = V.norm(V.sub(K, T)), nt = V.perp(ht), tf = V.add(K, V.mul(ht, S.tf)), tb = V.sub(T, V.mul(ht, S.tr)); corners.push(V.add(tf, V.mul(nt, hw)), V.sub(tf, V.mul(nt, hw)), V.add(tb, V.mul(nt, hw)), V.sub(tb, V.mul(nt, hw)));
      tracks[2].push(V.add(T, V.mul(nt, hw - 0.25))); tracks[3].push(V.sub(T, V.mul(nt, hw - 0.25))); }
    else { tracks[2].push(V.add(R, V.mul(n, hw - 0.25))); tracks[3].push(V.sub(R, V.mul(n, hw - 0.25))); }
    // côtés de l'enveloppe : coins les plus à gauche / à droite de la trajectoire locale
    const t = V.norm(V.sub(F, R)), nn = V.perp(t); let bl = null, br = null, sl = -Infinity, sr = Infinity;
    for (const c of corners){ const s = V.dot(V.sub(c, F), nn); if (s > sl){ sl = s; bl = c; } if (s < sr){ sr = s; br = c; } }
    lft.push(bl); rgt.push(br);
  };
  push();
  for (let s = 0.25; s <= L; s += 0.25){
    F = plAt(path, s).pt; R = V.sub(F, V.mul(V.norm(V.sub(F, R)), S.wb));
    if (S.tl){ const h = V.norm(V.sub(F, R)); K = V.add(R, V.mul(h, S.kp)); T = V.sub(K, V.mul(V.norm(V.sub(K, T)), S.tl)); }
    push();
  }
  const thin = p => p.filter((q, i) => i % 3 === 0 || i === p.length - 1);
  const h = V.norm(V.sub(F, R)), mid = V.add(F, V.mul(h, S.fo - S.L / 2));
  return {l:thin(lft), r:thin(rgt), tracks:tracks.filter(t => t.length).map(thin), pose:S.tl ? null : [mid[0], mid[1], Math.atan2(h[1], h[0])], maxW:Math.max(...lft.map((q, i) => V.dist(q, rgt[i])))};
}
