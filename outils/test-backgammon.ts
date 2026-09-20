/**
 * Contrôle du moteur de backgammon.
 *
 *   npx.cmd tsx outils/test-backgammon.ts
 *
 * Deux approches complémentaires :
 *   1. des **scénarios déterministes** sur les règles délicates, où la
 *      position et les dés sont posés à la main et le résultat attendu connu ;
 *   2. des **invariants** sur des centaines de parties aléatoires, qui
 *      attrapent ce qu'aucun scénario écrit d'avance n'aurait prévu.
 *
 * Il n'existe pas de table de référence comme le perft des échecs : c'est
 * pourquoi les deux sont nécessaires.
 */
import {
  BARRE,
  SORTIE,
  desDuLancer,
  etatInitial,
  fin,
  meilleureSuite,
  mouvementsPossibles,
  pipCount,
  toutesLesSuites,
  toutALaMaison,
  type Camp,
  type Etat,
} from '../src/games/lib/backgammon';

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

function section(titre: string) {
  console.log('\n' + titre);
}

const de = () => 1 + Math.floor(Math.random() * 6);

/** Construit une position à la main. `points` : indice → nombre signé. */
function position(
  points: Record<number, number>,
  extra: Partial<Omit<Etat, 'points'>> = {},
): Etat {
  const tableau = new Int8Array(24);
  for (const [i, v] of Object.entries(points)) tableau[Number(i)] = v;
  return {
    points: tableau,
    barreBlanc: 0,
    barreNoir: 0,
    sortiBlanc: 0,
    sortiNoir: 0,
    trait: 1,
    ...extra,
  };
}

function compter(e: Etat, camp: Camp): number {
  let n = camp === 1 ? e.barreBlanc + e.sortiBlanc : e.barreNoir + e.sortiNoir;
  for (const v of e.points) {
    if (camp === 1 && v > 0) n += v;
    if (camp === -1 && v < 0) n += -v;
  }
  return n;
}

// ------------------------------------------------------ position initiale ---

section('Position initiale');

const depart = etatInitial();
egal(pipCount(depart, 1), 167, 'parcours blanc');
egal(pipCount(depart, -1), 167, 'parcours noir');
egal(compter(depart, 1), 15, 'quinze pions blancs');
egal(compter(depart, -1), 15, 'quinze pions noirs');
verifier(!toutALaMaison(depart, 1), 'les blancs ne sont pas tous au jan au départ');
verifier(
  toutesLesSuites(depart, desDuLancer(3, 3)).every((s) => s.mouvements.length === 4),
  'un double se joue quatre fois',
);

// ------------------------------------------------------------ scénarios ---

section('Aucun dé jouable');

// Blancs bloqués : toutes les cases d'arrivée sont fermées par deux pions noirs.
const bloque = position({ 10: 1, 9: -2, 8: -2, 7: -2, 6: -2, 5: -2, 4: -2 });
egal(toutesLesSuites(bloque, desDuLancer(1, 2)).length, 0, 'aucune suite quand tout est fermé');
egal(meilleureSuite(bloque, desDuLancer(1, 2), 'expert'), null, 'l’IA ne propose rien non plus');

section('Un seul dé jouable : ce doit être le plus grand');

// Un seul pion, en 6. Le dé 1 viserait la flèche 5, fermée. Le dé 4 vise la 2,
// libre. Et la flèche 1 est fermée aussi, sinon le dé 1 redeviendrait jouable
// après le 4 — les deux passeraient, et le cas ne testerait plus rien.
const unSeul = position({ 6: 1, 5: -2, 1: -2 });
const suitesUnSeul = toutesLesSuites(unSeul, desDuLancer(1, 4));
verifier(suitesUnSeul.length > 0, 'une suite existe');
verifier(
  suitesUnSeul.every((s) => s.mouvements.length === 1),
  'une seule des deux valeurs est jouable',
);
egal(
  [...new Set(suitesUnSeul.map((s) => s.mouvements[0].de))],
  [4],
  'c’est bien le plus grand dé qui est retenu, pas le petit',
);

section('Les deux dés ne passent que dans un seul ordre');

// Jouer 2 d'abord mène sur 6, qui est fermé ; jouer 5 d'abord passe par 3, libre.
const ordreImpose = position({ 8: 1, 6: -2, 1: 0 });
const suitesOrdre = toutesLesSuites(ordreImpose, desDuLancer(2, 5));
verifier(suitesOrdre.length > 0, 'un chemin existe');
verifier(
  suitesOrdre.every((s) => s.mouvements.length === 2),
  'les deux dés sont utilisés — le moteur trouve le bon ordre',
);
verifier(
  suitesOrdre.every((s) => s.mouvements[0].de === 5),
  'et il commence nécessairement par le 5',
);

section('Un double ne peut pas être utilisé entièrement');

// Un seul pion en 12, double 3 : 12 → 9 → 6, puis la flèche 3 est fermée.
// Deux dés sur quatre sont donc jouables, et le moteur doit les jouer.
const doublePartiel = position({ 12: 1, 3: -2 });
const suitesDouble = toutesLesSuites(doublePartiel, desDuLancer(3, 3));
verifier(suitesDouble.length > 0, 'le double est partiellement jouable');
egal(
  [...new Set(suitesDouble.map((s) => s.mouvements.length))],
  [2],
  'exactement deux des quatre dés sont jouables, et le moteur en joue le maximum',
);

section('Pion sur la barre');

const surLaBarre = position({ 10: 3, 20: -2 }, { barreBlanc: 1 });
const rentrees = toutesLesSuites(surLaBarre, desDuLancer(2, 6));
verifier(
  rentrees.every((s) => s.mouvements[0].depuis === BARRE),
  'le premier mouvement rentre obligatoirement le pion de la barre',
);
// 24 − 6 = 18 est libre ; 24 − 2 = 22 est libre aussi.
verifier(
  mouvementsPossibles(surLaBarre, 6).length === 1 && mouvementsPossibles(surLaBarre, 6)[0].vers === 18,
  'le dé 6 fait rentrer sur la flèche 19 (indice 18)',
);
// La flèche 20 est fermée par deux noirs : le dé 4 ne peut pas rentrer.
egal(mouvementsPossibles(surLaBarre, 4).length, 0, 'un dé qui vise une flèche fermée ne rentre pas');

section('Plusieurs pions sur la barre');

const deuxSurLaBarre = position({ 10: 2 }, { barreBlanc: 2 });
const suitesDeux = toutesLesSuites(deuxSurLaBarre, desDuLancer(1, 2));
verifier(
  suitesDeux.every((s) => s.mouvements.every((m) => m.depuis === BARRE)),
  'tant qu’il reste un pion sur la barre, rien d’autre ne bouge',
);
verifier(
  suitesDeux.some((s) => s.mouvements.length === 2),
  'les deux pions peuvent rentrer dans le même tour',
);

section('Frappe');

// Un pion noir seul sur la flèche d'arrivée doit partir à la barre.
const frappe = position({ 10: 1, 6: -1 });
const mvt = mouvementsPossibles(frappe, 4);
egal(mvt.length, 1, 'un seul mouvement possible');
verifier(mvt[0].frappe === true, 'le mouvement est marqué comme une frappe');
const apresFrappe = toutesLesSuites(frappe, desDuLancer(4, 4))[0];
verifier(apresFrappe.etat.barreNoir >= 1, 'le pion noir se retrouve bien à la barre');
egal(compter(apresFrappe.etat, -1), 1, 'et il n’est pas perdu : toujours un pion noir en jeu');

section('Deux pions adverses ferment la flèche');

const ferme = position({ 10: 1, 6: -2 });
egal(mouvementsPossibles(ferme, 4).length, 0, 'on ne se pose pas sur deux pions adverses');

section('Sortie');

// Tous les blancs au jan : la sortie devient possible.
const jan = position({ 5: 2, 3: 2, 0: 1 });
verifier(toutALaMaison(jan, 1), 'les blancs sont tous au jan intérieur');
const sorties = mouvementsPossibles(jan, 6);
verifier(
  sorties.some((m) => m.vers === SORTIE && m.depuis === 5),
  'le dé 6 sort le pion de la flèche 6 au compte exact',
);
// Dé plus grand que la distance : n'est permis que si plus rien n'est en arrière.
const janHaut = position({ 2: 1, 5: 1 });
verifier(
  !mouvementsPossibles(janHaut, 6).some((m) => m.vers === SORTIE && m.depuis === 2),
  'un dé trop grand ne sort pas un pion tant qu’un autre est plus loin',
);
const janSeul = position({ 2: 1 });
verifier(
  mouvementsPossibles(janSeul, 6).some((m) => m.vers === SORTIE),
  'mais il le sort dès que plus rien n’est en arrière',
);
// Un pion sur la barre interdit toute sortie.
const janAvecBarre = position({ 2: 2 }, { barreBlanc: 1 });
verifier(!toutALaMaison(janAvecBarre, 1), 'un pion à la barre empêche d’être « tout au jan »');

section('Frappe suivie d’une rentrée obligatoire');

// Blancs frappent, puis c'est aux noirs, qui doivent d'abord rentrer.
const avantFrappe = position({ 10: 1, 6: -1, 20: -2 });
const apres = toutesLesSuites(avantFrappe, desDuLancer(4, 4))[0].etat;
const auxNoirs: Etat = { ...apres, trait: -1 };
verifier(auxNoirs.barreNoir === 1, 'un pion noir est bien à la barre');
const riposte = toutesLesSuites(auxNoirs, desDuLancer(2, 3));
verifier(
  riposte.length === 0 || riposte.every((s) => s.mouvements[0].depuis === BARRE),
  'les noirs rentrent avant tout autre mouvement',
);

section('Fin de partie');

egal(fin(position({}, { sortiBlanc: 15, sortiNoir: 5 })), { gagnant: 1, facteur: 1 }, 'partie simple');
egal(
  fin(position({ 20: -3 }, { sortiBlanc: 15, sortiNoir: 0 })),
  { gagnant: 1, facteur: 2 },
  'gammon : le perdant n’a rien sorti',
);
egal(
  fin(position({ 3: -2 }, { sortiBlanc: 15, sortiNoir: 0 })),
  { gagnant: 1, facteur: 3 },
  'backgammon : un pion du perdant est encore dans le jan du gagnant',
);
egal(
  fin(position({}, { sortiBlanc: 15, sortiNoir: 0, barreNoir: 1 })),
  { gagnant: 1, facteur: 3 },
  'backgammon aussi quand le perdant est à la barre',
);
egal(fin(etatInitial()), null, 'la position initiale n’est pas une fin de partie');

// ----------------------------------------------------------- invariants ---

section('Invariants sur 400 parties aléatoires');

const PARTIES = 400;
let terminees = 0;
let mouvements = 0;
for (let partie = 0; partie < PARTIES; partie++) {
  let e = etatInitial();
  let tours = 0;
  while (fin(e) === null && tours < 600) {
    const suites = toutesLesSuites(e, desDuLancer(de(), de()));
    if (suites.length > 0) {
      const longueurs = new Set(suites.map((s) => s.mouvements.length));
      if (longueurs.size !== 1) {
        verifier(false, 'des suites de longueurs différentes ont été proposées');
        break;
      }
      const choisie = suites[Math.floor(Math.random() * suites.length)];
      e = choisie.etat;
      mouvements += choisie.mouvements.length;
    }
    if (compter(e, 1) !== 15 || compter(e, -1) !== 15) {
      verifier(false, `un camp n’a plus quinze pions (${compter(e, 1)} / ${compter(e, -1)})`);
      break;
    }
    if (e.points.some((v) => v > 15 || v < -15)) {
      verifier(false, 'une flèche porte plus de quinze pions');
      break;
    }
    // Une flèche ne peut jamais porter les deux couleurs à la fois.
    if (e.points.some((v) => !Number.isInteger(v))) {
      verifier(false, 'une flèche porte une valeur non entière');
      break;
    }
    e = { ...e, trait: (e.trait === 1 ? -1 : 1) as Camp };
    tours += 1;
  }
  if (fin(e) !== null) terminees += 1;
}
egal(terminees, PARTIES, 'toutes les parties se terminent');
verifier(mouvements > 50000, `${mouvements} mouvements joués`);

section('L’IA ne propose jamais un coup illégal');

let controles = 0;
for (const niveau of ['facile', 'normal', 'expert'] as const) {
  let e = etatInitial();
  for (let k = 0; k < 40 && fin(e) === null; k++) {
    const des = desDuLancer(de(), de());
    const legales = toutesLesSuites(e, des);
    const choix = meilleureSuite(e, des, niveau);
    if (legales.length === 0) {
      verifier(choix === null, `${niveau} : une suite proposée alors qu’aucune n’est légale`);
    } else {
      verifier(choix !== null, `${niveau} : rien proposé alors qu’un coup existe`);
      if (choix) {
        const connue = legales.some((s) => s.etat.points.join() === choix.etat.points.join());
        verifier(connue, `${niveau} : suite hors de la liste légale`);
        e = choix.etat;
        controles += 1;
      }
    }
    e = { ...e, trait: (e.trait === 1 ? -1 : 1) as Camp };
  }
}
verifier(controles > 60, `${controles} tours contrôlés sur les trois niveaux`);

// -------------------------------------------------------------- verdict ---

console.log('');
console.log(`${passes} contrôles passés, ${echoues} en échec.`);
console.log(echoues === 0 ? '\nMOTEUR DE BACKGAMMON CONFORME' : '\nLE MOTEUR NE RESPECTE PAS LES RÈGLES');
process.exit(echoues === 0 ? 0 : 1);
