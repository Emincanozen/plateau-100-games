/**
 * Contrôle du moteur d'échecs par dénombrement de coups (« perft »).
 *
 *   npx.cmd tsx outils/test-echecs.ts
 *
 * On compte les positions atteignables à profondeur donnée et on compare aux
 * valeurs de référence publiées. Un seul écart trahit une règle mal écrite :
 * roque à travers l'échec, prise en passant, clouage, sous-promotion.
 */
import { appliquer, coupsLegaux, type Couleur, type Position } from '../src/games/lib/echecs';

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
  ['prise en passant et échecs à la découverte', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  [
    'promotions et sous-promotions',
    'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    [6, 264, 9467],
  ],
  ['position piégeuse', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];

let tout = true;
for (const [nom, fen, attendus] of CAS) {
  const details: string[] = [];
  for (let d = 1; d <= attendus.length; d++) {
    const n = perft(lireFen(fen), d);
    const bon = n === attendus[d - 1];
    if (!bon) tout = false;
    details.push(`d${d}=${n}${bon ? '' : ` ≠ ${attendus[d - 1]} ÉCHEC`}`);
  }
  console.log(`${nom.padEnd(42)} ${details.join('  ')}`);
}

console.log(tout ? '\nMOTEUR D’ÉCHECS CONFORME' : '\nDIVERGENCE — le moteur ne respecte pas les règles');
process.exit(tout ? 0 : 1);
