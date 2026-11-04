/* Tutoriel : visite guidée en pas à pas, accessible depuis le menu Fichier */
const TUTO = [
  ['Dessiner', 'Mur (M), Dalle (D), Toit (T), Escalier (E), Poteau (P) et Poutre (H) : cliquez des points, tapez une longueur puis Entrée. Échap annule ; deux Échap ramènent à la sélection.'],
  ['Sélectionner et déplacer', 'Cliquez un élément, Maj pour en ajouter. Les flèches du clavier le déplacent du pas affiché (Maj : x10). Le panneau de droite donne ses propriétés.'],
  ['Composants et menuiseries', 'L\'onglet Bibliothèque propose plus de 700 modèles : portes, fenêtres, mobilier, équipements. Chaque modèle a des types et des paramètres modifiables.'],
  ['Escaliers', 'Le panneau Escalier offre 25 modèles (droit, quart tournant, hélicoïdal, suspendu…) en 5 styles de matériaux, avec une galerie illustrée.'],
  ['Cotes et mesures', 'L\'outil Mesure pose des cotes cumulées ou automatiques ; Suppr efface la cote sélectionnée. L\'unité (m, cm, mm…) se règle dans Réglages.'],
  ['Niveaux et affichage', 'Le menu Affichage permet de voir le niveau inférieur en plan (masqué si une dalle existe), de masquer ou redimensionner les barres et de replier les sections.'],
  ['Vérifications du bâtiment', 'Dans l\'onglet Projet, « Vérifier le bâtiment » contrôle hauteurs, portes, escaliers, toitures et descente de charges, et propose un correctif problème par problème.'],
  ['Rendu Réaliste', 'Le mode Rendu > Réaliste active ciel, reflets, ombres douces et verre transparent.'],
  ['Exporter', 'Le menu Exporter ouvre une interface avec aperçu en direct : DQE (PDF, Excel), IFC, Archi Vision (.glb ou .archivision), paquet, image, projet .archiplan.']
];
function openTutorial(i = 0){
  const [t, tx] = TUTO[i];
  const d = openEDlg(`<header class="ed-h"><div><span class="eyebrow">Tutoriel · ${i + 1} / ${TUTO.length}</span><h3 class="ed-t2">${esc(t)}</h3></div><button class="ib ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="ed-body"><p style="font-size:15px;line-height:1.6">${esc(tx)}</p><div style="height:4px;background:var(--line,#ddd);border-radius:4px;margin-top:18px"><div style="height:100%;width:${(i + 1) / TUTO.length * 100}%;background:var(--ac,#0b7a9b);border-radius:4px;transition:width .3s"></div></div></div>
    <footer class="ed-f"><span class="hint"></span>${i ? '<button class="btn" id="tuP">Précédent</button>' : '<button class="btn" data-close>Passer</button>'}<button class="btn primary" id="tuN">${i < TUTO.length - 1 ? 'Suivant' : 'Terminer'}</button></footer>`, 'mid');
  d.querySelector('#tuN').onclick = () => { closeEDlg(); if (i < TUTO.length - 1) openTutorial(i + 1); else try { localStorage.setItem('ap.tuto', '1'); } catch(e){} };
  const p = d.querySelector('#tuP'); if (p) p.onclick = () => { closeEDlg(); openTutorial(i - 1); };
}
