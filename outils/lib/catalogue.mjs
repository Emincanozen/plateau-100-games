/**
 * Lecture du catalogue depuis les fichiers source.
 *
 * Ce module existe parce que deux outils comptaient les jeux « à trois
 * niveaux de difficulté » différemment : `matrice.mjs` en trouvait 30 en
 * cherchant `value: 'facile'`, `controle-fiches.mjs` en trouvait 27 en
 * comptant les étiquettes affichées. Deux chiffres pour la même question,
 * dont l'un finit dans une fiche de magasin : il ne peut y avoir qu'une
 * définition.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Fins de ligne normalisées à la lecture — voir outils/audit.mjs. */
const lireSource = (chemin) => fs.readFileSync(chemin, 'utf8').split('\r\n').join('\n');

export const DOSSIERS = ['plateau', 'cartes', 'logique', 'arcade', 'des', 'papier'];

/**
 * Étiquettes qui désignent une **force d'adversaire**, par opposition à une
 * taille de grille (« 8 × 8 ») ou à un nombre de pions, qui règlent la
 * difficulté autrement et ne s'annoncent pas comme « trois niveaux ».
 */
export const ETIQUETTE_NIVEAU =
  /^(Facile|Normal|Expert|Moyen|Difficile|Débutant|Novice|Calme|Chaos|Balade|Sprint|Sportif|Souple|Nerveux|Rapide|Frénétique|Large|Étroit|Prudent|Joueur|Escarmouche|Bataille|Siège)$/;

/** Un jeu propose « trois niveaux » à partir de trois étiquettes de force. */
export function compteNiveaux(source) {
  return [...source.matchAll(/label:\s*'([^']+)'/g)]
    .map((m) => m[1])
    .filter((e) => ETIQUETTE_NIVEAU.test(e)).length;
}

export function aTroisNiveaux(source) {
  return compteNiveaux(source) >= 3;
}

export function aModeDuo(source) {
  return /label:\s*'Duo'/.test(source);
}

/** Relit les cent fichiers de jeu et rend ce qu'on peut en déduire. */
export function lireCatalogue(racine = '.') {
  const jeux = [];
  for (const dossier of DOSSIERS) {
    const chemin = path.join(racine, 'src/games', dossier);
    for (const fichier of fs.readdirSync(chemin)) {
      if (!fichier.endsWith('.tsx')) continue;
      // Normalisé : voir le commentaire en tête de outils/audit.mjs.
      const source = lireSource(path.join(chemin, fichier));
      jeux.push({
        id: (source.match(/id:\s*'([^']+)'/) ?? [])[1] ?? fichier,
        fichier,
        dossier,
        joueurs: (source.match(/players:\s*'([^']+)'/) ?? [])[1] ?? '1',
        niveaux: aTroisNiveaux(source),
        duo: aModeDuo(source),
        source,
      });
    }
  }
  return jeux;
}
