/* ============ État du projet ============
   state = {format:'archiplan', v:2, name, els:[…], nextId, levels:[{n,z}], lib:{mats, compos, fams}}
   Éléments : wall {type,a,b,h,lvl,off,flip} · slab {type,p,q,lvl,off} · vol {mat,p,q,h,lvl,off} · col {mat,c,w,d,h,lvl,off}
              inst {fam,type,params,host?,t?,c?,rot,lvl,off,flip,mirror} (famille posée ; hébergée dans un mur si host)
   Bibliothèques : base (code) < bibliothèque personnelle (compte, cloud) < bibliothèque du projet. Un élément de bibliothèque
   utilisé par le projet est copié dans state.lib : le projet reste lisible chez un invité qui n'a pas la même bibliothèque. */
const KIND_NAME = {wall:'Mur', slab:'Dalle', vol:'Volume', col:'Poteau', inst:'Composant'};
const LOT_ORDER = ['Gros œuvre', 'Second œuvre', 'Menuiseries', 'Mobilier et équipements', 'Industrie'];
const DEFAULT_LEVELS = [{n:'RDC', z:0}, {n:'R+1', z:2.8}, {n:'R+2', z:5.6}];
let USER_LIB = {mats:{}, compos:{}, fams:{}};
let state, sel = null, multi = [];
const hist = [], redoS = [];
let quiet = false, dirty = true;
const hiddenIds = new Set(), hiddenLvls = new Set();   // masquage d'affichage (session, non enregistré)
const isHidden = el => hiddenIds.has(el.id) || hiddenLvls.has(el.lvl) || (el.kind === 'inst' && el.host && hiddenIds.has(el.host));

const libMats = () => ({...MATS, ...USER_LIB.mats, ...(state?.lib?.mats || {})});
const libCompos = () => ({...COMPOS, ...USER_LIB.compos, ...(state?.lib?.compos || {})});
const libFams = () => ({...FAMS, ...USER_LIB.fams, ...(state?.lib?.fams || {})});
const FALLBACK_MAT = {nom:'Matériau inconnu', cat:'Divers', rho:1000, lambda:1, c:1000, mu:10, color:'#B8B8B8', tex:'plain', gwp:0, rough:0.9};
function mat(id){ return state?.lib?.mats?.[id] || USER_LIB.mats[id] || MATS[id] || FALLBACK_MAT; }
function compo(id){ return state?.lib?.compos?.[id] || USER_LIB.compos[id] || COMPOS[id] || COMPOS['MUR-EXT-01']; }
function fam(id){ return state?.lib?.fams?.[id] || USER_LIB.fams[id] || FAMS[id] || null; }
matResolver = id => mat(id);
const isBaseMat = id => !!MATS[id] && !USER_LIB.mats[id] && !state?.lib?.mats?.[id];

/* Copie dans le projet ce qu'il utilise de la bibliothèque personnelle (portabilité) */
function embedUsedLib(){
  if (!state.lib) state.lib = {mats:{}, compos:{}, fams:{}};
  const used = {m:new Set(), c:new Set(), f:new Set()};
  const walkFam = (fid, depth = 0) => { if (depth > 4 || used.f.has(fid)) return; used.f.add(fid); const F = fam(fid); if (!F) return; for (const p of F.parts || []){ if (p.fam) walkFam(p.fam, depth + 1); if (p.m) used.m.add(p.m); } };
  for (const el of state.els){
    if (el.type && (el.kind === 'wall' || el.kind === 'slab')){ used.c.add(el.type); compo(el.type).layers.forEach(([m]) => used.m.add(m)); }
    if (el.mat) used.m.add(el.mat);
    if (el.kind === 'inst') walkFam(el.fam);
  }
  for (const id of used.c) if (USER_LIB.compos[id]) state.lib.compos[id] = JSON.parse(JSON.stringify(USER_LIB.compos[id]));
  for (const id of used.f) if (USER_LIB.fams[id]) state.lib.fams[id] = JSON.parse(JSON.stringify(USER_LIB.fams[id]));
  for (const id of used.m) if (USER_LIB.mats[id]) state.lib.mats[id] = JSON.parse(JSON.stringify(USER_LIB.mats[id]));
}

function migrate(s){
  s = s && typeof s === 'object' ? s : {};
  const out = {format:'archiplan', v:2, name:s.name || 'Projet', els:Array.isArray(s.els) ? s.els : [], nextId:1,
    levels:Array.isArray(s.levels) && s.levels.length ? s.levels.map(l => ({n:String(l.n || 'Niveau').slice(0, 30), z:+l.z || 0})) : DEFAULT_LEVELS.map(l => ({...l})),
    lib:{mats:{...(s.lib?.mats || {})}, compos:{...(s.lib?.compos || {})}, fams:{...(s.lib?.fams || {})}}, isSample:!!s.isSample,
    ...(s.site && typeof s.site === 'object' ? {site:s.site} : {}), ...(s.dqe && typeof s.dqe === 'object' ? {dqe:s.dqe} : {})};
  const okEl = el => el && KIND_NAME[el.kind] && (el.kind !== 'wall' || compo(el.type)) && (el.kind !== 'inst' || el.fam);
  const prev = state; state = out;   // pour que compo()/fam() lisent la bibliothèque du projet en cours de migration
  out.els = out.els.filter(okEl).map(el => ({...el, lvl:Math.max(0, Math.min(out.levels.length - 1, el.lvl | 0)), off:+el.off || 0}));
  out.els = out.els.filter(el => el.kind !== 'inst' || fam(el.fam));
  state = prev;
  out.nextId = Math.max(0, ...out.els.map(x => x.id || 0)) + 1;
  return out;
}
const lvlZ = i => state.levels[i] ? state.levels[i].z : 0;
const lvlName = i => state.levels[i]?.n || 'Niveau';

function sample(){
  const s = {name:'Exemple · maison plain-pied', isSample:true, els:[], nextId:1, levels:DEFAULT_LEVELS.map(l => ({...l})), lib:{mats:{}, compos:{}, fams:{}}};
  const add = e => { e.id = s.nextId++; s.els.push(e); return e.id; };
  add({kind:'slab', type:'DAL-ISO', p:[-0.2,-0.2], q:[10.2,8.2], lvl:0, off:0});
  const P = [[0,0],[10,0],[10,8],[0,8]], W = [];
  for (let i = 0; i < 4; i++) W.push(add({kind:'wall', type:'MUR-EXT-01', a:P[i], b:P[(i+1)%4], h:2.7, lvl:0, off:0, flip:false}));
  const c1 = add({kind:'wall', type:'CLO-72', a:[6,0.164], b:[6,7.836], h:2.5, lvl:0, off:0, flip:false});
  add({kind:'wall', type:'CLO-72', a:[0.164,4.6], b:[6,4.6], h:2.5, lvl:0, off:0, flip:false});
  add({kind:'inst', fam:'porte-entree', type:1, params:{}, host:W[0], t:3, lvl:0, off:0, flip:false, mirror:false});
  add({kind:'inst', fam:'baie-coulissante', type:1, params:{}, host:W[0], t:7.8, lvl:0, off:0, flip:false, mirror:false});
  add({kind:'inst', fam:'fenetre-2v', type:1, params:{}, host:W[2], t:3, lvl:0, off:0, flip:false, mirror:false});
  add({kind:'inst', fam:'fenetre-1v', type:1, params:{}, host:W[3], t:2.2, lvl:0, off:0, flip:false, mirror:false});
  add({kind:'inst', fam:'porte-simple', type:1, params:{}, host:c1, t:2.4, lvl:0, off:0, flip:false, mirror:false});
  add({kind:'inst', fam:'banc-assemblage', type:0, params:{}, c:[8,4.3], rot:0, lvl:0, off:0});
  add({kind:'inst', fam:'canape', type:0, params:{}, c:[3,1.4], rot:0, lvl:0, off:0});
  add({kind:'inst', fam:'lit', type:2, params:{}, c:[3,5.2], rot:0, lvl:0, off:0});
  add({kind:'slab', type:'DAL-BA-20', p:[10.2,2], q:[13.4,6], lvl:0, off:0});
  add({kind:'col', mat:'ba', c:[13.15,2.25], w:0.25, d:0.25, h:2.7, lvl:0, off:0});
  add({kind:'col', mat:'ba', c:[13.15,5.75], w:0.25, d:0.25, h:2.7, lvl:0, off:0});
  add({kind:'vol', mat:'acier', p:[10.2,2], q:[13.4,6], h:0.12, lvl:0, off:2.7});
  return s;
}

function save(){ if (!quiet) window.dispatchEvent(new Event('ap:changed')); }
const snapshot = () => JSON.stringify(state);
function pushHist(){ hist.push(snapshot()); if (hist.length > 150) hist.shift(); redoS.length = 0; updUndo(); }
function undo(){ if (!hist.length) return; redoS.push(snapshot()); state = JSON.parse(hist.pop()); if (sel && !getEl(sel)) sel = null; multi = multi.filter(getEl); rebuild(); }
function redo(){ if (!redoS.length) return; hist.push(snapshot()); state = JSON.parse(redoS.pop()); if (sel && !getEl(sel)) sel = null; multi = multi.filter(getEl); rebuild(); }
function updUndo(){ const u = $('#undo'), r = $('#redo'); if (u) u.disabled = !hist.length; if (r) r.disabled = !redoS.length; }
const getEl = id => state.els.find(e => e.id === id);
function addEl(e){ pushHist(); e.id = state.nextId++; state.els.push(e); state.isSample = false; rebuild(); return e.id; }
function removeEls(ids){
  const set = new Set(ids);
  // supprimer un mur supprime ses menuiseries
  state.els.forEach(e => { if (e.kind === 'inst' && e.host && set.has(e.host)) set.add(e.id); });
  state.els = state.els.filter(e => !set.has(e.id));
}
