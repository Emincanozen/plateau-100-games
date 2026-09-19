/**
 * Contrôle du moteur de backgammon par invariants sur des parties aléatoires.
 *
 *   npx.cmd tsx outils/test-backgammon.ts
 *
 * Il n'existe pas de table de référence comme au perft des échecs : on vérifie
 * donc ce qui ne doit jamais changer — quinze pions par camp, des suites
 * toutes de longueur maximale, et une partie qui finit toujours.
 */
import {
  desDuLancer,
  etatInitial,
  fin,
  meilleureSuite,
  pipCount,
  toutesLesSuites,
  type Camp,
  type Etat,
} from '../src/games/lib/backgammon';

const echecs: string[] = [];
const verifier = (condition: boolean, quoi: string) => {
  if (!condition) echecs.push(quoi);
};

const de = () => 1 + Math.floor(Math.random() * 6);

function compter(e: Etat, camp: Camp): number {
  let n = camp === 1 ? e.barreBlanc + e.sortiBlanc : e.barreNoir + e.sortiNoir;
  for (const v of e.points) {
    if (camp === 1 && v > 0) n += v;
    if (camp === -1 && v < 0) n += -v;
  }
  return n;
}

// 1 · La position de départ vaut 167 points de parcours de chaque côté.
const depart = etatInitial();
verifier(pipCount(depart, 1) === 167, `pip blanc initial ${pipCount(depart, 1)} au lieu de 167`);
verifier(pipCount(depart, -1) === 167, `pip noir initial ${pipCount(depart, -1)} au lieu de 167`);

// 2 · Un double doit se jouer quatre fois quand c'est possible.
verifier(
  toutesLesSuites(depart, desDuLancer(3, 3)).every((s) => s.mouvements.length === 4),
  'un double depuis la position initiale doit user les quatre dés',
);

// 3 · Quatre cents parties aléatoires menées jusqu'au bout.
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
      if (longueurs.size !== 1) echecs.push('des suites de longueurs différentes ont été proposées');
      const choisie = suites[Math.floor(Math.random() * suites.length)];
      e = choisie.etat;
      mouvements += choisie.mouvements.length;
    }
    if (compter(e, 1) !== 15) {
      echecs.push(`pions blancs : ${compter(e, 1)} au lieu de 15`);
      break;
    }
    if (compter(e, -1) !== 15) {
      echecs.push(`pions noirs : ${compter(e, -1)} au lieu de 15`);
      break;
    }
    if (e.points.some((v) => v > 15 || v < -15)) {
      echecs.push('une flèche porte plus de quinze pions');
      break;
    }
    e = { ...e, trait: (e.trait === 1 ? -1 : 1) as Camp };
    tours += 1;
  }
  if (fin(e) !== null) terminees += 1;
}
verifier(terminees === PARTIES, `${terminees}/${PARTIES} parties se sont terminées`);

// 4 · L'IA ne propose jamais qu'une suite légale.
let controles = 0;
let e2 = etatInitial();
for (let k = 0; k < 60 && fin(e2) === null; k++) {
  const des = desDuLancer(de(), de());
  const legales = toutesLesSuites(e2, des);
  const choix = meilleureSuite(e2, des, 'expert');
  if (legales.length === 0) {
    verifier(choix === null, 'l’IA propose une suite alors qu’aucune n’est légale');
  } else {
    verifier(choix !== null, 'l’IA ne propose rien alors qu’il existe un coup');
    if (choix) {
      const connue = legales.some((s) => s.etat.points.join() === choix.etat.points.join());
      verifier(connue, 'l’IA propose une suite hors de la liste légale');
      e2 = choix.etat;
      controles += 1;
    }
  }
  e2 = { ...e2, trait: (e2.trait === 1 ? -1 : 1) as Camp };
}

console.log(`parties menées à terme : ${terminees}/${PARTIES}`);
console.log(`mouvements joués : ${mouvements}`);
console.log(`tours contrôlés côté IA experte : ${controles}`);
console.log(
  echecs.length === 0
    ? '\nMOTEUR DE BACKGAMMON CONFORME'
    : `\n${echecs.length} ÉCHECS :\n` + [...new Set(echecs)].join('\n'),
);
process.exit(echecs.length === 0 ? 0 : 1);
