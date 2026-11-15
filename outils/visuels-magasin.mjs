/**
 * Produit les visuels exigés par les magasins et absents du dépôt.
 *
 *   node outils/visuels-magasin.mjs
 *
 * Deux fichiers, écrits dans `docs/store/visuels/` — volontairement **hors**
 * de `assets/`, que `assetBundlePatterns` embarque en entier dans
 * l'application : un bandeau de magasin n'a rien à faire dans le paquet
 * installé sur le téléphone.
 *
 * | Fichier | Exigé par | Contrainte |
 * |---|---|---|
 * | `icone-512.png` | Google Play | 512 × 512, **sans transparence** |
 * | `bandeau-1024x500.png` | Google Play | 1024 × 500, sans transparence |
 *
 * **Le bandeau ne porte aucun texte, et c'est un choix.** Dessiner du texte
 * sans moteur de rendu de police donnerait un résultat approximatif, et
 * Google recommande de toute façon d'éviter le texte sur cette image : elle
 * est recadrée différemment selon les emplacements, et devrait être
 * retraduite pour chaque langue. Le motif de marque seul reste lisible
 * partout.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Toile } from './lib/png.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossier = path.join(racine, 'docs/store/visuels');
fs.mkdirSync(dossier, { recursive: true });

// Les mêmes couleurs que l'icône de l'application — c'est la même marque.
const QUARTIERS = ['#5B8DEF', '#E0525F', '#34B37E', '#F0A030'];
const FOND = '#101018';
const PION = '#F4F4F7';

/** Le motif : quatre quartiers arrondis, un pion clair au centre. */
function marque(toile, cx, cy, bloc, alpha = 1) {
  const jeu = bloc * 0.075;
  const demi = (bloc - jeu) / 2;
  const rayon = demi * 0.42;
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([sx, sy], k) => {
    toile.rectArrondi(cx + sx * (demi + jeu), cy + sy * (demi + jeu), demi, demi, rayon, QUARTIERS[k], alpha);
  });
  toile.disque(cx, cy, bloc * 0.2, FOND, alpha);
  toile.disque(cx, cy, bloc * 0.145, PION, alpha);
}

function ecrire(nom, toile) {
  // `opaque: true` : les deux magasins refusent un canal alpha sur ces images.
  const chemin = path.join(dossier, nom);
  fs.writeFileSync(chemin, toile.encoder({ opaque: true }));
  const ko = (fs.statSync(chemin).size / 1024).toFixed(1);
  console.log(`docs/store/visuels/${nom} — ${toile.l} × ${toile.h}, ${ko} ko`);
}

// --- Icône 512 × 512 --------------------------------------------------------

const icone = new Toile(512, 512, FOND);
marque(icone, 256, 256, 512 * 0.62);
ecrire('icone-512.png', icone);

// --- Bandeau 1024 × 500 -----------------------------------------------------

const bandeau = new Toile(1024, 500, FOND);

// Une trame de motifs estompés : le catalogue évoqué, pas illustré.
const pas = 132;
for (let y = -pas; y < 500 + pas; y += pas) {
  for (let x = -pas; x < 1024 + pas; x += pas) {
    // Décalage d'une ligne sur deux, comme un damier de plateaux.
    const dx = (Math.floor(y / pas) % 2) * (pas / 2);
    marque(bandeau, x + dx, y, pas * 0.42, 0.14);
  }
}

// Le motif principal, à gauche du tiers d'or — l'espace libre à droite
// laisse la place au titre que Google superpose sur certains emplacements.
marque(bandeau, 288, 250, 190);
ecrire('bandeau-1024x500.png', bandeau);

console.log('\nCes deux images ne contiennent aucun texte : voir l’en-tête du script.');
