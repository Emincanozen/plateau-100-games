/**
 * Contrôle des règles déterministes partagées par les jeux.
 *
 *   npx.cmd tsx outils/test-regles.ts
 *
 * Ne couvre que ce qui est testable hors de React : les bibliothèques de
 * `src/games/lib/`. Les règles propres à un jeu vivent dans son composant et
 * se vérifient en jouant — voir docs/VALIDATION_100_JEUX.md.
 *
 * Les tirages aléatoires sont rejoués un grand nombre de fois plutôt que
 * figés par une graine : `shuffle` et `randInt` s'appuient sur `Math.random`,
 * qui n'est pas injectable. Le nombre d'itérations rend un défaut visible.
 */
import {
  COULEURS,
  creerCarte,
  etiquette,
  jeu32,
  jeu40,
  jeu52,
  melanger,
  nomCarte,
  rangsAdjacentsCirculaires,
  sabot,
  totalBlackjack,
  valeurBlackjack,
  valeurScopa,
  type Carte,
  type Rang,
} from '../src/games/lib/cartes';
import { ALPHABET, DICTIONNAIRE, MOTS_CINQ, MOTS_COURANTS, MOTS_JEU, normaliser } from '../src/games/lib/mots';
import { clamp, randBetween, randInt, range, seeded, shuffle } from '../src/games/lib/rng';

let echoues = 0;
let passes = 0;

function verifier(condition: boolean, quoi: string) {
  if (condition) passes += 1;
  else {
    echoues += 1;
    console.error('  ÉCHEC — ' + quoi);
  }
}

function egal<T>(obtenu: T, attendu: T, quoi: string) {
  verifier(
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `${quoi} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`,
  );
}

function section(titre: string) {
  console.log('\n' + titre);
}

// ---------------------------------------------------------------- cartes ---

section('Paquets');

const paquet52 = jeu52();
egal(paquet52.length, 52, 'le jeu de 52 compte 52 cartes');
egal(new Set(paquet52.map((c) => c.id)).size, 52, 'les 52 identifiants sont uniques');
for (const couleur of COULEURS) {
  egal(paquet52.filter((c) => c.couleur === couleur).length, 13, `13 cartes en ${couleur}`);
}
egal(paquet52.filter((c) => c.rouge).length, 26, 'la moitié du paquet est rouge');

const paquet40 = jeu40();
egal(paquet40.length, 40, 'le jeu de 40 compte 40 cartes');
verifier(
  paquet40.every((c) => c.rang <= 7 || c.rang >= 11),
  'le jeu de 40 ne contient ni 8, ni 9, ni 10',
);

const paquet32 = jeu32();
egal(paquet32.length, 32, 'le jeu de 32 compte 32 cartes');
verifier(
  paquet32.every((c) => c.rang >= 7 || c.rang === 1),
  'le jeu de 32 va du 7 à l’as',
);

// Le sabot doit rester sans doublon d'identifiant, sinon une réussite peut
// « perdre » une carte quand un jeu l'indexe par id.
const sabot4 = sabot(4);
egal(sabot4.length, 208, 'un sabot de quatre jeux compte 208 cartes');
egal(new Set(sabot4.map((c) => c.id)).size, 208, 'les identifiants du sabot sont tous distincts');

section('Mélange');

// Un mélange doit être une permutation : ni perte, ni duplication, ni création.
let identiques = 0;
for (let essai = 0; essai < 500; essai++) {
  const melange = melanger(paquet52);
  if (melange.length !== 52) {
    verifier(false, 'le mélange change le nombre de cartes');
    break;
  }
  const ids = melange.map((c) => c.id).sort().join();
  if (ids !== paquet52.map((c) => c.id).sort().join()) {
    verifier(false, 'le mélange ne conserve pas exactement les mêmes cartes');
    break;
  }
  if (melange.map((c) => c.id).join() === paquet52.map((c) => c.id).join()) identiques += 1;
}
verifier(true, '500 mélanges conservent exactement les 52 cartes');
verifier(identiques <= 1, `le mélange brasse réellement (${identiques} mélanges identiques sur 500)`);

// Fisher-Yates non biaisé : chaque carte doit visiter toutes les positions.
const positions = new Map<string, Set<number>>();
for (let essai = 0; essai < 400; essai++) {
  melanger(paquet52).forEach((c, i) => {
    const vues = positions.get(c.id) ?? new Set<number>();
    vues.add(i);
    positions.set(c.id, vues);
  });
}
const minPositions = Math.min(...[...positions.values()].map((s) => s.size));
verifier(minPositions > 40, `chaque carte visite au moins 40 positions distinctes (minimum : ${minPositions})`);

section('Blackjack');

const carte = (couleur: 'P' | 'C' | 'K' | 'T', rang: Rang) => creerCarte(couleur, rang);
const main = (...c: Carte[]) => totalBlackjack(c);

egal(valeurBlackjack(carte('P', 1)), 11, 'un as vaut 11 avant ajustement');
egal(valeurBlackjack(carte('P', 13)), 10, 'un roi vaut 10');
egal(valeurBlackjack(carte('P', 11)), 10, 'un valet vaut 10');
egal(valeurBlackjack(carte('P', 7)), 7, 'un 7 vaut 7');

egal(main(carte('P', 1), carte('C', 13)), { total: 21, souple: true }, 'as + roi = 21 souple');
egal(main(carte('P', 13), carte('C', 12), carte('K', 11)), { total: 30, souple: false }, 'trois figures brûlent à 30');
egal(main(carte('P', 1), carte('C', 1)), { total: 12, souple: true }, 'deux as = 12, l’un compte 1');
egal(
  main(carte('P', 1), carte('C', 1), carte('K', 1), carte('T', 1)),
  { total: 14, souple: true },
  'quatre as = 14',
);
egal(
  main(carte('P', 1), carte('C', 9), carte('K', 5)),
  { total: 15, souple: false },
  'as + 9 + 5 : l’as retombe à 1, la main devient dure',
);
egal(main(carte('P', 10), carte('C', 10), carte('K', 2)), { total: 22, souple: false }, '10 + 10 + 2 brûle');

section('Scopa');

egal(valeurScopa(carte('P', 1)), 1, 'as = 1');
egal(valeurScopa(carte('P', 7)), 7, 'sept = 7');
egal(valeurScopa(carte('P', 11)), 8, 'valet = 8');
egal(valeurScopa(carte('P', 12)), 9, 'dame = 9');
egal(valeurScopa(carte('P', 13)), 10, 'roi = 10');
egal(
  new Set(jeu40().map(valeurScopa)).size,
  10,
  'les 40 cartes couvrent exactement dix valeurs de capture',
);

section('Suites circulaires (Golf, Tri-peaks)');

verifier(rangsAdjacentsCirculaires(5, 6), '5 et 6 se suivent');
verifier(rangsAdjacentsCirculaires(6, 5), 'l’ordre n’importe pas');
verifier(rangsAdjacentsCirculaires(1, 13), 'l’as suit le roi');
verifier(rangsAdjacentsCirculaires(13, 1), 'et le roi suit l’as');
verifier(!rangsAdjacentsCirculaires(5, 7), '5 et 7 ne se suivent pas');
verifier(!rangsAdjacentsCirculaires(7, 7), 'une carte ne se suit pas elle-même');

section('Libellés');

egal(etiquette(1), 'A', 'l’as s’abrège en A');
egal(etiquette(13), 'R', 'le roi s’abrège en R');
egal(etiquette(10), '10', 'le dix garde son chiffre');
egal(nomCarte(carte('C', 12)), 'dame de cœur', 'le nom lisible est correct');
verifier(
  jeu52().every((c) => nomCarte(c).length > 4),
  'toutes les cartes ont un nom lisible pour l’accessibilité',
);

// ------------------------------------------------------------------ mots ---

section('Vocabulaire');

verifier(MOTS_JEU.length >= 200, `le dictionnaire de jeu compte ${MOTS_JEU.length} mots`);
egal(DICTIONNAIRE.size, new Set(MOTS_JEU).size, 'le dictionnaire reprend exactement MOTS_JEU');
verifier(
  MOTS_JEU.every((m) => /^[A-Z]+$/.test(m)),
  'les mots de jeu sont en majuscules sans accent — indispensable pour la saisie',
);
verifier(
  MOTS_JEU.every((m) => m.length >= 3),
  'aucun mot de moins de trois lettres : le Boggle en exige trois',
);
egal(new Set(MOTS_JEU).size, MOTS_JEU.length, 'aucun doublon dans le dictionnaire');

verifier(
  MOTS_CINQ.every((m) => m.length === 5),
  'tous les mots de Motus font bien cinq lettres',
);
verifier(
  MOTS_CINQ.every((m) => /^[A-Z]+$/.test(m)),
  'les mots de Motus sont en majuscules sans accent',
);
egal(new Set(MOTS_CINQ).size, MOTS_CINQ.length, 'aucun doublon dans les mots de cinq lettres');

verifier(MOTS_COURANTS.length >= 40, `${MOTS_COURANTS.length} mots à indice pour le pendu et les anagrammes`);
verifier(
  MOTS_COURANTS.every((e) => /^[A-Z]+$/.test(e.mot) && e.indice.length > 2),
  'chaque mot à indice a un mot en majuscules et un indice non vide',
);
egal(
  new Set(MOTS_COURANTS.map((e) => e.mot)).size,
  MOTS_COURANTS.length,
  'aucun mot à indice en double',
);

section('Normalisation des accents');

egal(normaliser('ÉLÉPHANT'), 'ELEPHANT', 'les accents aigus tombent');
egal(normaliser('français'), 'FRANCAIS', 'la cédille tombe et la casse monte');
egal(normaliser('Noël'), 'NOEL', 'le tréma tombe');
egal(normaliser('où'), 'OU', 'l’accent grave tombe');
egal(normaliser('CRÊPE'), 'CREPE', 'l’accent circonflexe tombe');
verifier(
  MOTS_JEU.every((m) => normaliser(m) === m),
  'le dictionnaire est déjà normalisé : une saisie accentuée y retombera',
);

egal(ALPHABET.length, 26, 'l’alphabet compte 26 lettres');
egal(ALPHABET.join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'dans l’ordre, en majuscules');

// ------------------------------------------------------------------- rng ---

section('Aléatoire');

// Le générateur à graine doit être reproductible : les puzzles du jour en dépendent.
const a = seeded(12345);
const b = seeded(12345);
const suiteA = range(20).map(() => a());
const suiteB = range(20).map(() => b());
egal(suiteA, suiteB, 'deux générateurs de même graine donnent la même suite');

const c = seeded(12346);
verifier(
  range(20).map(() => c()).join() !== suiteA.join(),
  'une graine différente donne une suite différente',
);
verifier(
  suiteA.every((v) => v >= 0 && v < 1),
  'le générateur reste dans [0, 1[',
);

let horsBornes = 0;
for (let i = 0; i < 20000; i++) {
  const v = randInt(6);
  if (v < 0 || v > 5 || !Number.isInteger(v)) horsBornes += 1;
}
egal(horsBornes, 0, 'randInt(6) reste dans 0 à 5, sur 20 000 tirages');

const faces = new Map<number, number>();
for (let i = 0; i < 60000; i++) {
  const v = randBetween(1, 6);
  faces.set(v, (faces.get(v) ?? 0) + 1);
}
egal([...faces.keys()].sort(), [1, 2, 3, 4, 5, 6], 'un dé sort bien les six faces');
const ecart = Math.max(...faces.values()) - Math.min(...faces.values());
verifier(ecart < 1500, `les six faces sont équiprobables (écart max ${ecart} sur 60 000 lancers)`);

egal(shuffle([]).length, 0, 'mélanger une liste vide ne casse pas');
egal(shuffle([7]), [7], 'mélanger un élément le laisse en place');
egal(clamp(5, 0, 10), 5, 'clamp laisse passer une valeur interne');
egal(clamp(-3, 0, 10), 0, 'clamp remonte au minimum');
egal(clamp(42, 0, 10), 10, 'clamp redescend au maximum');
egal(range(4), [0, 1, 2, 3], 'range produit 0 à n−1');

// --------------------------------------------------------------- verdict ---

console.log('');
console.log(`${passes} contrôles passés, ${echoues} en échec.`);
console.log(echoues === 0 ? '\nRÈGLES PARTAGÉES CONFORMES' : '\nDES RÈGLES NE SONT PAS RESPECTÉES');
process.exit(echoues === 0 ? 0 : 1);
