/**
 * Produit docs/VALIDATION_100_JEUX.md.
 *
 *   node outils/matrice.mjs <resultats-sonde.json>
 *
 * Croise les métadonnées lues dans chaque fichier de jeu avec les résultats
 * de la sonde de navigateur. Le fichier JSON attendu est un tableau de
 * [id, commandes, voie, gel, reagit, relance, erreurs] — c'est ce que produit
 * la sonde décrite dans docs/VALIDATION_100_JEUX.md.
 *
 * Aucun résultat n'est inventé : sans fichier de sonde, les colonnes
 * correspondantes restent « non exécuté ».
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aModeDuo, aTroisNiveaux } from './lib/catalogue.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossiers = ['plateau', 'cartes', 'logique', 'arcade', 'des', 'papier'];

const LIBELLE = {
  plateau: 'Plateau',
  cartes: 'Cartes',
  logique: 'Logique',
  arcade: 'Arcade',
  des: 'Dés',
  papier: 'Papier-crayon',
};

/**
 * Fins de ligne normalisées à la lecture. Plusieurs motifs de ce fichier
 * contiennent un saut de ligne suivi de deux espaces ; sur un poste où git
 * réécrit les sources en CRLF, ils ne trouveraient plus rien — et le
 * document serait généré avec des colonnes vides, sans une seule alerte.
 */
const lireSource = (chemin) => fs.readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');

const fichierSonde = process.argv[2];
const sonde = new Map(
  fichierSonde && fs.existsSync(fichierSonde)
    ? JSON.parse(fs.readFileSync(fichierSonde, 'utf8')).map((l) => [l[0], l])
    : [],
);

const jeux = [];
for (const cat of dossiers) {
  const dir = path.join(racine, 'src/games', cat);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.tsx'))) {
    const src = lireSource(path.join(dir, f));
    const champ = (nom) => src.match(new RegExp(`\\n  ${nom}: '([^']*)'`))?.[1];
    const nombre = (nom) => src.match(new RegExp(`\\n  ${nom}: (\\d+)`))?.[1];

    const regles = src.match(/\n  rules: \[([\s\S]*?)\n  \]/)?.[1] ?? '';
    // Définition partagée avec controle-fiches.mjs : deux outils comptaient
    // autrefois les niveaux différemment, et l'un des chiffres partait dans
    // une fiche de magasin.
    const niveaux = aTroisNiveaux(src);
    const duo = aModeDuo(src);
    const moteur = src.includes("from '../lib/echecs'")
      ? '`lib/echecs.ts`'
      : src.includes("from '../lib/backgammon'")
        ? '`lib/backgammon.ts`'
        : src.includes("from '../lib/cartes'")
          ? '`lib/cartes.ts`'
          : src.includes("from '../lib/mots'")
            ? '`lib/mots.ts`'
            : '—';

    jeux.push({
      cat,
      id: champ('id'),
      nom: champ('name'),
      fichier: `${cat}/${f}`,
      score: champ('score'),
      unite: champ('scoreUnit') ?? '',
      joueurs: champ('players'),
      difficulte: nombre('difficulty'),
      minutes: nombre('minutes'),
      regles: (regles.match(/^\s*'/gm) || []).length,
      niveaux,
      duo,
      moteur,
      clavier: src.includes('useClavier('),
      annulation: /Annuler|useUndoable/.test(src),
      sonde: sonde.get(champ('id')),
    });
  }
}

const oui = (v) => (v ? '✅' : '—');
const etat = (j) => {
  if (!j.sonde) return 'non exécuté';
  const [, , , gel, reagit, relance, err] = j.sonde;
  return gel && reagit && relance && !err ? '✅ PASS' : '❌ FAIL';
};

const lignes = [];
lignes.push('# Matrice de validation des 100 jeux');
lignes.push('');
lignes.push('> **Généré par `node outils/matrice.mjs`.** Ne pas modifier à la main :');
lignes.push('> les colonnes viennent des fichiers source et de la sonde de navigateur.');
lignes.push('');
lignes.push(`Dernière exécution : ${new Date().toISOString().slice(0, 10)}.`);
lignes.push('');
lignes.push('## Ce que chaque colonne prouve — et ce qu’elle ne prouve pas');
lignes.push('');
lignes.push('| Colonne | Méthode | Portée |');
lignes.push('|---|---|---|');
lignes.push('| **Chargement** | Navigation vers `/game/<id>`, en-tête présent, écran non vide | Automatisée, navigateur |');
lignes.push('| **Gel** | La feuille de règles ouverte, aucune pixel ni compteur ne bouge pendant 900 ms | Automatisée, navigateur |');
lignes.push('| **Réaction** | Jusqu’à quarante-cinq commandes touchées, les commandes explicites d’abord, puis le clavier, puis l’attente d’une boucle ; on compare étiquettes, texte, couleurs, bordures **et positions** | Automatisée, navigateur |');
lignes.push('| **Relance** | Le bouton ↻ est actionné, le jeu doit se reconstruire avec ses commandes | Automatisée, navigateur |');
lignes.push('| **Console** | Toute erreur console, `window.onerror` et rejet de promesse est capturée | Automatisée, navigateur |');
lignes.push('| **Règles** | Nombre de phrases de règles, conformité au contrat (3 à 5) | Automatisée, statique |');
lignes.push('| **Moteur** | Bibliothèque partagée dont le jeu dépend, et qui a ses propres tests | Statique |');
lignes.push('| **Publicité** | Aucun fichier de jeu ne contient de bannière, d’interstitiel ni d’import du SDK ; l’écran de jeu verrouille la régie tant qu’il est monté | Automatisée, `npm run test:pub` |');
lignes.push('');
lignes.push('**Ce que la matrice ne prouve pas.** Une partie complète jouée jusqu’à la');
lignes.push('victoire, l’exactitude des règles propres à chaque jeu, le rendu sur un');
lignes.push('vrai téléphone, le comportement réel du SDK publicitaire. Ces points sont listés dans');
lignes.push('[RAPPORT_FINAL_VALIDATION.md](RAPPORT_FINAL_VALIDATION.md), section « Risques restants ».');
lignes.push('');

for (const cat of dossiers) {
  const liste = jeux.filter((j) => j.cat === cat);
  lignes.push(`## ${LIBELLE[cat]} — ${liste.length} jeux`);
  lignes.push('');
  lignes.push('| Jeu | Fichier | Score | Joueurs | Diff. | Règles | Niveaux | Duo | Clavier | Annuler | Moteur | Cmd. | Gel | Réagit | Relance | Console | État |');
  lignes.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const j of liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))) {
    const s = j.sonde;
    lignes.push(
      `| **${j.nom}** | \`${j.fichier}\` | ${j.score}${j.unite ? ' ' + j.unite : ''} | ${j.joueurs} | ${'●'.repeat(Number(j.difficulte))} | ${j.regles} | ${oui(j.niveaux)} | ${oui(j.duo)} | ${oui(j.clavier)} | ${oui(j.annulation)} | ${j.moteur} | ${s ? s[1] : '?'} | ${s ? oui(s[3]) : '?'} | ${s ? oui(s[4]) : '?'} | ${s ? oui(s[5]) : '?'} | ${s ? (s[6] ? '❌ ' + s[6] : '✅') : '?'} | ${etat(j)} |`,
    );
  }
  lignes.push('');
}

const passes = jeux.filter((j) => etat(j) === '✅ PASS').length;
const echoues = jeux.filter((j) => etat(j) === '❌ FAIL');

lignes.push('---');
lignes.push('');
lignes.push('## Bilan');
lignes.push('');
lignes.push('| | Nombre |');
lignes.push('|---|---|');
lignes.push(`| Jeux au catalogue | ${jeux.length} |`);
lignes.push(`| Chargés sans erreur de console | ${jeux.filter((j) => j.sonde && !j.sonde[6]).length} |`);
lignes.push(`| Gel des règles respecté | ${jeux.filter((j) => j.sonde && j.sonde[3]).length} |`);
lignes.push(`| Répondent à une commande | ${jeux.filter((j) => j.sonde && j.sonde[4]).length} |`);
lignes.push(`| Se relancent correctement | ${jeux.filter((j) => j.sonde && j.sonde[5]).length} |`);
lignes.push(`| **PASS sur les cinq critères** | **${passes} / ${jeux.length}** |`);
lignes.push(`| Trois niveaux de difficulté | ${jeux.filter((j) => j.niveaux).length} |`);
lignes.push(`| Mode Duo | ${jeux.filter((j) => j.duo).length} |`);
lignes.push(`| Pilotables au clavier | ${jeux.filter((j) => j.clavier).length} |`);
lignes.push(`| Avec annulation | ${jeux.filter((j) => j.annulation).length} |`);
lignes.push('');
if (echoues.length) {
  lignes.push('### Jeux en échec');
  lignes.push('');
  for (const j of echoues) lignes.push(`- **${j.nom}** (\`${j.fichier}\`)`);
} else {
  lignes.push('Aucun jeu en échec sur les critères automatisés.');
}
lignes.push('');

const sortie = path.join(racine, 'docs/VALIDATION_100_JEUX.md');
fs.writeFileSync(sortie, lignes.join('\n'));
console.log(`docs/VALIDATION_100_JEUX.md écrit — ${jeux.length} jeux, ${passes} PASS, ${echoues.length} FAIL`);
