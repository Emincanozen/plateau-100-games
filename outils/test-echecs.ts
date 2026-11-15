/**
 * Contrôle du moteur d'échecs.
 *
 *   npx.cmd tsx outils/test-echecs.ts
 *
 * Trois niveaux de preuve :
 *   1. le **perft** — on compte les positions atteignables à profondeur fixe
 *      et on compare aux valeurs de référence publiées. Un seul écart trahit
 *      une règle mal écrite : roque à travers l'échec, clouage, prise en
 *      passant, sous-promotion ;
 *   2. des **positions posées à la main** pour les fins de partie, la notation
 *      et les coups spéciaux, que le perft ne couvre pas ;
 *   3. des contrôles sur l'**IA**, qui doit trouver un mat en un et ne jamais
 *      proposer un coup illégal.
 *
 * Le perft valide la génération de coups, pas l'interface ni la force de jeu.
 */
import {
  appliquer,
  coupsLegaux,
  enEchec,
  evaluer,
  issue,
  meilleurCoup,
  nomCase,
  noterCoup,
  positionInitiale,
  type Coup,
  type Couleur,
  type Position,
} from '../src/games/lib/echecs';

const CODES: Record<string, number> = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };

function lireFen(fen: string): Position {
  const [plateau, trait, roques, ep] = fen.split(' ');
  const cases = new Int8Array(64);
  let i = 0;
  for (const ch of plateau) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') {
      i += Number(ch);
      continue;
    }
    const bas = ch.toLowerCase();
    cases[i] = (ch === bas ? -1 : 1) * CODES[bas];
    i += 1;
  }
  return {
    cases,
    trait: (trait === 'w' ? 1 : -1) as Couleur,
    roques: {
      br: roques.includes('K'),
      bd: roques.includes('Q'),
      nr: roques.includes('k'),
      nd: roques.includes('q'),
    },
    enPassant: ep === '-' ? -1 : 'abcdefgh'.indexOf(ep[0]) + (8 - Number(ep[1])) * 8,
    demiCoups: 0,
  };
}

function perft(pos: Position, profondeur: number): number {
  if (profondeur === 0) return 1;
  const coups = coupsLegaux(pos);
  if (profondeur === 1) return coups.length;
  let total = 0;
  for (const coup of coups) total += perft(appliquer(pos, coup), profondeur - 1);
  return total;
}

const DEPART = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const CAS: [string, string, number[]][] = [
  ['position initiale', DEPART, [20, 400, 8902, 197281]],
  [
    'Kiwipete — roques et clouages',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    [48, 2039, 97862],
  ],
  [
    'prise en passant et échecs à la découverte',
    '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    [14, 191, 2812, 43238],
  ],
  [
    'promotions et sous-promotions',
    'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    [6, 264, 9467],
  ],
  ['position piégeuse', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];

let passes = 0;
let echoues = 0;

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

const section = (titre: string) => console.log('\n' + titre);
const cas = (fen: string) => lireFen(fen);

const trouver = (pos: Position, depuis: string, vers: string, promotion?: number): Coup | undefined =>
  coupsLegaux(pos).find(
    (c) => nomCase(c.depuis) === depuis && nomCase(c.vers) === vers && c.promotion === promotion,
  );

// ----------------------------------------------------------------- perft ---

section('Dénombrement (perft)');

for (const [nom, fen, attendus] of CAS) {
  const details: string[] = [];
  for (let d = 1; d <= attendus.length; d++) {
    const n = perft(lireFen(fen), d);
    verifier(n === attendus[d - 1], `${nom}, profondeur ${d} : ${n} au lieu de ${attendus[d - 1]}`);
    details.push(`d${d}=${n}`);
  }
  console.log(`  ${nom.padEnd(42)} ${details.join('  ')}`);
}

// --------------------------------------------------------- fins de partie ---

section('Mat, pat et nulles');

egal(
  issue(cas('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4')),
  'mat',
  'mat du berger',
);
egal(
  issue(cas('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')),
  'mat',
  'mat du sot',
);

const pat = cas('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
egal(issue(pat), 'pat', 'pat : aucun coup légal, roi non attaqué');
verifier(!enEchec(pat), 'et le roi n’est effectivement pas en échec');
egal(coupsLegaux(pat).length, 0, 'zéro coup légal en position de pat');

egal(issue(cas('8/8/4k3/8/8/4K3/8/8 w - - 0 1')), 'materiel', 'roi contre roi');
egal(issue(cas('8/8/4k3/8/8/4K3/8/5N2 w - - 0 1')), 'materiel', 'roi et cavalier contre roi');
egal(issue(cas('8/8/4k3/8/8/4K3/8/5B2 w - - 0 1')), 'materiel', 'roi et fou contre roi');
egal(issue(cas('8/8/4k3/8/8/4K3/8/4R3 w - - 0 1')), null, 'roi et tour : la partie continue');
egal(issue(cas('8/5p2/4k3/8/8/4K3/8/8 w - - 0 1')), null, 'un pion suffit à continuer');

egal(
  issue({ ...cas('8/8/4k3/8/8/4K3/8/4R3 w - - 0 1'), demiCoups: 100 }),
  'cinquante',
  'cent demi-coups sans prise ni poussée',
);
egal(issue(positionInitiale()), null, 'la position initiale n’est pas une fin de partie');

section('Échec et coups interdits');

verifier(
  enEchec(cas('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')),
  'le roi blanc est bien en échec',
);
verifier(!enEchec(positionInitiale()), 'personne n’est en échec au départ');

const cloue = cas('4k3/8/8/8/8/8/4R3/4K2r w - - 0 1');
verifier(
  coupsLegaux(cloue).every((c) => !enEchec({ ...appliquer(cloue, c), trait: 1 })),
  'aucun coup légal ne laisse son propre roi en prise',
);

section('Roque, prise en passant, promotion');

const avantRoque = cas('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');

const petitRoque = trouver(avantRoque, 'e1', 'g1');
verifier(petitRoque?.roque === 'petit', 'le petit roque est proposé');
if (petitRoque) {
  const apres = appliquer(avantRoque, petitRoque);
  egal(nomCase(apres.cases.indexOf(6)), 'g1', 'le roi arrive en g1');
  egal(apres.cases[61], 4, 'et la tour saute en f1');
  verifier(!apres.roques.br && !apres.roques.bd, 'les blancs perdent leurs deux droits au roque');
}

const grandRoque = trouver(avantRoque, 'e1', 'c1');
verifier(grandRoque?.roque === 'grand', 'le grand roque est proposé');
if (grandRoque) {
  const apres = appliquer(avantRoque, grandRoque);
  egal(nomCase(apres.cases.indexOf(6)), 'c1', 'le roi arrive en c1');
  egal(apres.cases[59], 4, 'et la tour saute en d1');
}

// Tour noire en f8, colonne f dégagée (f2 est vide) : elle attaque f1, la case
// que le roi traverserait. Le petit roque tombe, le grand reste permis.
const roqueSousLeFeu = cas('k4r2/8/8/8/8/8/PPPPP1PP/R3K2R w KQ - 0 1');
verifier(
  trouver(roqueSousLeFeu, 'e1', 'g1') === undefined,
  'pas de petit roque quand la case traversée est attaquée',
);
verifier(
  trouver(roqueSousLeFeu, 'e1', 'c1') !== undefined,
  'mais le grand roque reste possible : sa route n’est pas attaquée',
);
// Roi en échec : aucun roque possible.
verifier(
  trouver(cas('4k3/8/8/8/8/8/PPPP1PPP/R3K2R w KQ - 0 1'), 'e1', 'g1') !== undefined,
  'position de contrôle : le roque passe quand rien n’attaque',
);

const enPassant = cas('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
const prise = trouver(enPassant, 'e5', 'd6');
verifier(prise?.enPassant === true, 'la prise en passant est proposée');
if (prise) {
  const apres = appliquer(enPassant, prise);
  egal(apres.cases[27], 0, 'le pion noir capturé disparaît de d5');
  egal(apres.cases[19], 1, 'et le pion blanc arrive en d6');
}
verifier(
  trouver(cas('4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1'), 'e5', 'd6') === undefined,
  'sans case de prise en passant, le coup n’existe pas',
);

const promo = cas('8/4P3/8/8/8/8/8/4K2k w - - 0 1');
const versE8 = coupsLegaux(promo).filter((c) => nomCase(c.vers) === 'e8');
egal(versE8.length, 4, 'quatre promotions possibles sur e8');
egal(versE8.map((c) => c.promotion).sort(), [2, 3, 4, 5], 'dame, tour, fou et cavalier sont proposés');
const enCavalier = versE8.find((c) => c.promotion === 2);
if (enCavalier) egal(appliquer(promo, enCavalier).cases[4], 2, 'la sous-promotion pose bien un cavalier');

section('Notation');

const depart = positionInitiale();
const e4 = trouver(depart, 'e2', 'e4');
if (e4) egal(noterCoup(depart, e4), 'e4', 'une poussée de pion se note par sa case');
const cf3 = trouver(depart, 'g1', 'f3');
if (cf3) egal(noterCoup(depart, cf3), 'Cf3', 'un cavalier porte son initiale française');
if (petitRoque) egal(noterCoup(avantRoque, petitRoque), 'O-O', 'le petit roque se note O-O');
if (grandRoque) egal(noterCoup(avantRoque, grandRoque), 'O-O-O', 'le grand roque se note O-O-O');
if (prise) egal(noterCoup(enPassant, prise), 'exd6', 'une prise de pion indique sa colonne de départ');
if (enCavalier) egal(noterCoup(promo, enCavalier), 'e8=C', 'la promotion indique la pièce choisie');

const avantMat = cas('rnb1kbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2');
const dameH4 = trouver(avantMat, 'd8', 'h4');
if (dameH4) egal(noterCoup(avantMat, dameH4), 'Dh4#', 'le mat est suffixé par un dièse');

const echecSimple = cas('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1');
const tourA8 = trouver(echecSimple, 'a1', 'a8');
if (tourA8) egal(noterCoup(echecSimple, tourA8), 'Ta8+', 'un échec simple est suffixé par un plus');

section('Évaluation');

egal(evaluer(positionInitiale()), 0, 'la position initiale est parfaitement équilibrée');
verifier(evaluer(cas('4k3/8/8/8/8/8/8/3QK3 w - - 0 1')) > 800, 'une dame d’avance se voit');
verifier(evaluer(cas('3qk3/8/8/8/8/8/8/4K3 w - - 0 1')) < -800, 'et une dame de retard aussi');
egal(
  Math.sign(evaluer(cas('4k3/8/8/8/8/8/8/3QK3 w - - 0 1'))),
  -Math.sign(evaluer(cas('3qk3/8/8/8/8/8/8/4K3 w - - 0 1'))),
  'l’évaluation est symétrique entre les deux camps',
);

section('Intelligence artificielle');

// Mat en un : la tour descend en a8, le roi noir est enfermé par ses pions.
const matEnUn = cas('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
for (const niveau of ['normal', 'expert'] as const) {
  const coup = meilleurCoup(matEnUn, niveau);
  verifier(coup !== null, `${niveau} : un coup est proposé`);
  if (coup) {
    verifier(
      issue(appliquer(matEnUn, coup)) === 'mat',
      `${niveau} : le mat en un est trouvé (joué : ${noterCoup(matEnUn, coup)})`,
    );
  }
}
verifier(meilleurCoup(matEnUn, 'facile') !== null, 'facile : un coup est proposé aussi');
egal(meilleurCoup(pat, 'expert'), null, 'aucun coup proposé quand il n’y en a aucun');

let controles = 0;
let pos = positionInitiale();
for (let demiCoup = 0; demiCoup < 40 && issue(pos) === null; demiCoup++) {
  const legaux = coupsLegaux(pos);
  const coup = meilleurCoup(pos, demiCoup % 2 === 0 ? 'normal' : 'facile');
  verifier(coup !== null, 'l’IA propose un coup tant qu’il en existe');
  if (!coup) break;
  verifier(
    legaux.some(
      (c) => c.depuis === coup.depuis && c.vers === coup.vers && c.promotion === coup.promotion,
    ),
    'le coup proposé fait partie des coups légaux',
  );
  pos = appliquer(pos, coup);
  controles += 1;
}
verifier(
  controles >= 1 && (controles >= 20 || issue(pos) !== null),
  `${controles} demi-coups joués par l’IA sans aucun coup illégal${issue(pos) ? ` (partie terminée : ${issue(pos)})` : ''}`,
);

// --------------------------------------------------------------- verdict ---

console.log('');
console.log(`${passes} contrôles passés, ${echoues} en échec.`);
console.log(echoues === 0 ? '\nMOTEUR D’ÉCHECS CONFORME' : '\nLE MOTEUR NE RESPECTE PAS LES RÈGLES');
process.exit(echoues === 0 ? 0 : 1);
