/**
 * Contrôle des barèmes propres aux jeux.
 *
 *   npx.cmd tsx outils/test-regles-jeux.ts
 *
 * `test-regles.ts` couvrait les bibliothèques partagées — paquets de cartes,
 * vocabulaire, aléatoire. Les **règles de chaque jeu**, elles, n'étaient
 * couvertes par rien : elles vivaient dans les composants, inatteignables
 * depuis Node. Cinq d'entre elles ont été sorties dans
 * `src/games/lib/regles.ts`, et c'est ce que ce fichier éprouve.
 *
 * Choix des cinq : ce sont les barèmes les plus denses du catalogue. Le yams
 * compte treize figures, le 421 hiérarchise neuf mains, le farkle empile
 * brelans et doublements, Motus doit gérer les lettres en double. Une erreur
 * y passe inaperçue tant qu'on ne tombe pas sur le bon lancer.
 *
 * **Ce que ces tests ne prouvent pas** : que le composant appelle bien la
 * fonction au bon moment, ni qu'une partie complète se déroule correctement.
 * Ils prouvent que la règle, elle, est juste.
 */
import {
  comparer,
  evaluerLancer,
  evaluerMain,
  evaluerZanzibar,
  valeurFigure,
  type Des3,
} from '../src/games/lib/regles';

let echoues = 0;
let passes = 0;

function verifier(condition: boolean, quoi: string) {
  if (condition) passes += 1;
  else {
    echoues += 1;
    console.error('  ECHEC — ' + quoi);
  }
}

function egal<T>(obtenu: T, attendu: T, quoi: string) {
  verifier(
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `${quoi} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`,
  );
}

const titre = (t: string) => console.log('\n' + t);

// ------------------------------------------------------------------ yams ---

titre('Yams — les treize figures');

egal(valeurFigure('as', [1, 1, 3, 4, 5]), 2, 'deux as valent 2');
egal(valeurFigure('six', [6, 6, 6, 2, 1]), 18, 'trois six valent 18');
egal(valeurFigure('trois', [1, 2, 4, 5, 6]), 0, 'aucun trois vaut 0');

egal(valeurFigure('brelan', [4, 4, 4, 2, 1]), 15, 'un brelan vaut la somme des cinq dés');
egal(valeurFigure('brelan', [4, 4, 2, 2, 1]), 0, 'deux paires ne font pas un brelan');
egal(valeurFigure('brelan', [4, 4, 4, 4, 1]), 17, 'un carré contient un brelan');

egal(valeurFigure('carre', [3, 3, 3, 3, 6]), 18, 'un carré vaut la somme des cinq dés');
egal(valeurFigure('carre', [3, 3, 3, 6, 6]), 0, 'un full n’est pas un carré');
egal(valeurFigure('carre', [5, 5, 5, 5, 5]), 25, 'un yams contient un carré');

egal(valeurFigure('full', [2, 2, 2, 5, 5]), 25, 'un full vaut 25');
egal(valeurFigure('full', [2, 2, 2, 2, 5]), 0, 'quatre + un n’est pas un full');
verifier(
  valeurFigure('full', [3, 3, 3, 3, 3]) === 0,
  'cinq identiques ne comptent pas comme full — il faut exactement 3 + 2',
);

egal(valeurFigure('petiteSuite', [1, 2, 3, 4, 6]), 30, 'quatre consécutifs : petite suite');
egal(valeurFigure('petiteSuite', [1, 2, 3, 5, 6]), 0, 'trois consécutifs ne suffisent pas');
egal(valeurFigure('petiteSuite', [2, 3, 4, 5, 6]), 30, 'une grande suite contient une petite');
egal(valeurFigure('grandeSuite', [2, 3, 4, 5, 6]), 40, 'cinq consécutifs : grande suite');
egal(valeurFigure('grandeSuite', [1, 2, 3, 4, 6]), 0, 'quatre consécutifs ne suffisent pas');

egal(valeurFigure('yams', [4, 4, 4, 4, 4]), 50, 'cinq identiques : 50');
egal(valeurFigure('yams', [4, 4, 4, 4, 2]), 0, 'quatre identiques : rien');

egal(valeurFigure('chance', [6, 5, 4, 3, 2]), 20, 'la chance vaut la somme');
egal(valeurFigure('chance', [1, 1, 1, 1, 1]), 5, 'même très basse');

// Un doublon dans la suite ne doit pas la casser.
egal(valeurFigure('petiteSuite', [3, 3, 4, 5, 6]), 30, 'un doublon ne casse pas la suite');

// ---------------------------------------------------------------- farkle ---

titre('Farkle — brelans, doublements et combinaisons de six dés');

egal(evaluerLancer([1, 2, 3, 4, 6]), { points: 100, utilises: 1 }, 'un as seul vaut 100');
egal(evaluerLancer([5, 2, 3, 4, 6]), { points: 50, utilises: 1 }, 'un cinq seul vaut 50');
egal(evaluerLancer([2, 3, 4, 6, 6]), { points: 0, utilises: 0 }, 'aucun as ni cinq : zéro');

egal(evaluerLancer([1, 1, 1, 2, 3]), { points: 1000, utilises: 3 }, 'brelan d’as : 1000');
egal(evaluerLancer([4, 4, 4, 2, 3]), { points: 400, utilises: 3 }, 'brelan de 4 : 400');
egal(evaluerLancer([6, 6, 6, 2, 3]), { points: 600, utilises: 3 }, 'brelan de 6 : 600');

egal(evaluerLancer([4, 4, 4, 4, 3]), { points: 800, utilises: 4 }, 'le quatrième dé double');
egal(evaluerLancer([4, 4, 4, 4, 4]), { points: 1600, utilises: 5 }, 'le cinquième double encore');
egal(
  evaluerLancer([1, 1, 1, 1, 2, 3]),
  { points: 2000, utilises: 4 },
  'quatre as : 1000 doublé',
);

// Les deux combinaisons de six dés priment sur le décompte figure par figure.
egal(
  evaluerLancer([1, 2, 3, 4, 5, 6]),
  { points: 1500, utilises: 6 },
  'suite complète : 1500, et pas 150 pour l’as et le cinq',
);
egal(
  evaluerLancer([2, 2, 4, 4, 6, 6]),
  { points: 1500, utilises: 6 },
  'trois paires : 1500',
);
verifier(
  evaluerLancer([1, 2, 3, 4, 5]).points === 150,
  'à cinq dés, la suite ne compte pas : seulement l’as et le cinq',
);

// Cumul brelan + dés isolés.
egal(
  evaluerLancer([3, 3, 3, 1, 5]),
  { points: 300 + 100 + 50, utilises: 5 },
  'un brelan et deux dés qui comptent s’additionnent',
);

// -------------------------------------------------------------- zanzibar ---

titre('Zanzibar — hiérarchie des mains');

const zanzi = (d: Des3) => evaluerZanzibar(d).rang;

verifier(zanzi([4, 5, 6]) > zanzi([6, 6, 6]), 'le 4-5-6 bat tous les brelans');
verifier(zanzi([6, 6, 6]) > zanzi([1, 1, 1]), 'un brelan de 6 bat un brelan d’as');
verifier(zanzi([1, 1, 1]) > zanzi([1, 2, 3]), 'un brelan bat la petite suite');
verifier(zanzi([1, 2, 3]) > zanzi([6, 6, 2]), 'la petite suite bat une paire');
verifier(zanzi([6, 6, 2]) > zanzi([2, 2, 6]), 'la paire la plus forte gagne');
verifier(zanzi([6, 6, 5]) > zanzi([6, 6, 2]), 'à paire égale, le dé isolé départage');
verifier(zanzi([2, 2, 6]) > zanzi([6, 5, 3]), 'une paire bat une main quelconque');
verifier(zanzi([6, 5, 3]) > zanzi([6, 5, 2]), 'entre mains quelconques, on compare dé à dé');

// L'ordre des dés ne doit rien changer.
egal(zanzi([5, 6, 4]), zanzi([4, 5, 6]), 'l’ordre du lancer est indifférent');
egal(zanzi([2, 6, 6]), zanzi([6, 6, 2]), 'même pour une paire');

// ------------------------------------------------------------------- 421 ---

titre('421 — hiérarchie et jetons');

egal(evaluerMain([4, 2, 1]).nom, '421', 'le 421 est reconnu');
egal(evaluerMain([1, 2, 4]).jetons, 10, 'le 421 vaut dix jetons, quel que soit l’ordre');

const rang = (d: Des3) => evaluerMain(d).rang;
verifier(rang([4, 2, 1]) > rang([1, 1, 1]), 'le 421 bat le brelan d’as');
verifier(rang([1, 1, 1]) > rang([1, 1, 6]), 'le brelan d’as bat l’as au six');
verifier(rang([1, 1, 6]) > rang([1, 1, 2]), 'as au six bat as au deux');
verifier(rang([1, 1, 2]) > rang([6, 6, 6]), 'un as au deux bat un brelan de six');
verifier(rang([6, 6, 6]) > rang([6, 5, 4]), 'un brelan bat une suite');
verifier(rang([6, 5, 4]) > rang([6, 5, 2]), 'une suite bat une main quelconque');

egal(evaluerMain([1, 1, 6]).jetons, 6, 'l’as au six vaut six jetons');
egal(evaluerMain([1, 1, 3]).jetons, 2, 'les autres as valent deux jetons');
egal(evaluerMain([5, 5, 5]).jetons, 5, 'un brelan vaut sa face en jetons');
egal(evaluerMain([6, 5, 4]).jetons, 2, 'une suite vaut deux jetons');
egal(evaluerMain([6, 5, 3]).jetons, 1, 'une main quelconque vaut un jeton');

// ----------------------------------------------------------------- motus ---

titre('Motus — le piège des lettres en double');

egal(
  comparer('CHIEN', 'CHIEN'),
  ['juste', 'juste', 'juste', 'juste', 'juste'],
  'le mot exact est tout juste',
);
egal(
  comparer('ABCDE', 'FGHIJ'),
  ['absent', 'absent', 'absent', 'absent', 'absent'],
  'aucune lettre commune',
);
egal(
  comparer('NEICH', 'CHIEN'),
  ['present', 'present', 'juste', 'present', 'present'],
  'les mêmes lettres, mal placées',
);

// Le cœur du sujet : une lettre en double dans la proposition, une seule
// dans le secret. La bien placée doit l'emporter.
egal(
  comparer('ELLES', 'PELLE'),
  ['present', 'present', 'juste', 'present', 'absent'],
  'lettres en double : la bien placée prime, le surplus est absent',
);
// CANAL porte ses deux A en positions 1 et 3 — pas 0 et 2.
egal(
  comparer('AAAAA', 'CANAL'),
  ['absent', 'juste', 'absent', 'juste', 'absent'],
  'cinq A face à deux A : deux justes aux bonnes places, trois absents',
);
// TASSE : le A est en position 1, donc juste ; les deux S et le E suivent.
egal(
  comparer('SALES', 'TASSE'),
  ['present', 'juste', 'absent', 'present', 'present'],
  'deux S dans le secret, deux S retenus, et le A bien placé',
);

// Une lettre du secret ne peut servir qu'une fois.
const r = comparer('OSSES', 'BOSSE');
egal(
  r.filter((e) => e !== 'absent').length,
  4,
  'quatre lettres au plus peuvent compter quand le secret n’en offre que quatre',
);

// --------------------------------------------------------------- verdict ---

console.log('');
console.log(`${passes} contrôles passés, ${echoues} en échec.`);
console.log(echoues === 0 ? '\nBARÈMES DES JEUX CONFORMES' : '\nDES BARÈMES SONT FAUX');
process.exit(echoues === 0 ? 0 : 1);
