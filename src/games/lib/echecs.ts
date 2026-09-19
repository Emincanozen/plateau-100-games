/**
 * Moteur d'échecs : règles complètes et recherche alpha-beta.
 *
 * Les cases vont de 0 (a8, en haut à gauche) à 63 (h1, en bas à droite).
 * Une pièce est un entier signé : positif pour les blancs, négatif pour les
 * noirs. Les blancs jouent vers le haut du plateau, donc vers les indices bas.
 *
 * Ce fichier ne contient aucun code d'affichage : il est testable seul.
 */

export const VIDE = 0;
export const PION = 1;
export const CAVALIER = 2;
export const FOU = 3;
export const TOUR = 4;
export const DAME = 5;
export const ROI = 6;

export type Couleur = 1 | -1;

export interface Roques {
  /** Blancs, petit roque (côté roi) */
  br: boolean;
  /** Blancs, grand roque (côté dame) */
  bd: boolean;
  nr: boolean;
  nd: boolean;
}

export interface Position {
  cases: Int8Array;
  trait: Couleur;
  roques: Roques;
  /** Case de prise en passant, ou −1. */
  enPassant: number;
  /** Demi-coups sans prise ni poussée de pion (règle des cinquante coups). */
  demiCoups: number;
}

export interface Coup {
  depuis: number;
  vers: number;
  /** Pièce choisie à la promotion. */
  promotion?: number;
  roque?: 'petit' | 'grand';
  enPassant?: boolean;
  /** Valeur absolue de la pièce prise, 0 sinon — sert au tri des coups. */
  prise: number;
}

const ligne = (index: number) => index >> 3;
const colonne = (index: number) => index & 7;
const dans = (l: number, c: number) => l >= 0 && l < 8 && c >= 0 && c < 8;

const SAUTS_CAVALIER: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const DIRS_ROI: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
const DIRS_FOU: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const DIRS_TOUR: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export function positionInitiale(): Position {
  const cases = new Int8Array(64);
  const fond = [TOUR, CAVALIER, FOU, DAME, ROI, FOU, CAVALIER, TOUR];
  for (let c = 0; c < 8; c++) {
    cases[c] = -fond[c];
    cases[8 + c] = -PION;
    cases[48 + c] = PION;
    cases[56 + c] = fond[c];
  }
  return {
    cases,
    trait: 1,
    roques: { br: true, bd: true, nr: true, nd: true },
    enPassant: -1,
    demiCoups: 0,
  };
}

export function copier(pos: Position): Position {
  return {
    cases: Int8Array.from(pos.cases),
    trait: pos.trait,
    roques: { ...pos.roques },
    enPassant: pos.enPassant,
    demiCoups: pos.demiCoups,
  };
}

export function couleurDe(piece: number): Couleur | 0 {
  return piece === 0 ? 0 : piece > 0 ? 1 : -1;
}

export function trouverRoi(cases: Int8Array, couleur: Couleur): number {
  const cible = couleur * ROI;
  for (let i = 0; i < 64; i++) if (cases[i] === cible) return i;
  return -1;
}

/** La case est-elle attaquée par une pièce de la couleur donnée ? */
export function estAttaquee(cases: Int8Array, index: number, par: Couleur): boolean {
  const l = ligne(index);
  const c = colonne(index);

  for (const [dl, dc] of SAUTS_CAVALIER) {
    const nl = l + dl;
    const nc = c + dc;
    if (dans(nl, nc) && cases[nl * 8 + nc] === par * CAVALIER) return true;
  }

  for (const [dl, dc] of DIRS_ROI) {
    const nl = l + dl;
    const nc = c + dc;
    if (dans(nl, nc) && cases[nl * 8 + nc] === par * ROI) return true;
  }

  // Un pion blanc avance vers les lignes basses : il attaque donc depuis la ligne du dessous.
  const depuisLigne = par === 1 ? l + 1 : l - 1;
  for (const dc of [-1, 1]) {
    const nc = c + dc;
    if (dans(depuisLigne, nc) && cases[depuisLigne * 8 + nc] === par * PION) return true;
  }

  for (const [dl, dc] of DIRS_FOU) {
    for (let pas = 1; pas < 8; pas++) {
      const nl = l + dl * pas;
      const nc = c + dc * pas;
      if (!dans(nl, nc)) break;
      const p = cases[nl * 8 + nc];
      if (p === 0) continue;
      if (p === par * FOU || p === par * DAME) return true;
      break;
    }
  }

  for (const [dl, dc] of DIRS_TOUR) {
    for (let pas = 1; pas < 8; pas++) {
      const nl = l + dl * pas;
      const nc = c + dc * pas;
      if (!dans(nl, nc)) break;
      const p = cases[nl * 8 + nc];
      if (p === 0) continue;
      if (p === par * TOUR || p === par * DAME) return true;
      break;
    }
  }

  return false;
}

export function enEchec(pos: Position, couleur: Couleur = pos.trait): boolean {
  const roi = trouverRoi(pos.cases, couleur);
  return roi >= 0 && estAttaquee(pos.cases, roi, (-couleur) as Couleur);
}

/** Coups possibles sans vérifier que le roi reste en sûreté. */
export function coupsPseudo(pos: Position): Coup[] {
  const { cases, trait } = pos;
  const out: Coup[] = [];

  const glissantes = (depuis: number, dirs: [number, number][]) => {
    const l = ligne(depuis);
    const c = colonne(depuis);
    for (const [dl, dc] of dirs) {
      for (let pas = 1; pas < 8; pas++) {
        const nl = l + dl * pas;
        const nc = c + dc * pas;
        if (!dans(nl, nc)) break;
        const vers = nl * 8 + nc;
        const cible = cases[vers];
        if (cible === 0) {
          out.push({ depuis, vers, prise: 0 });
          continue;
        }
        if (couleurDe(cible) !== trait) out.push({ depuis, vers, prise: Math.abs(cible) });
        break;
      }
    }
  };

  const sauts = (depuis: number, dirs: [number, number][]) => {
    const l = ligne(depuis);
    const c = colonne(depuis);
    for (const [dl, dc] of dirs) {
      const nl = l + dl;
      const nc = c + dc;
      if (!dans(nl, nc)) continue;
      const vers = nl * 8 + nc;
      const cible = cases[vers];
      if (cible !== 0 && couleurDe(cible) === trait) continue;
      out.push({ depuis, vers, prise: Math.abs(cible) });
    }
  };

  const PROMOTIONS = [DAME, TOUR, FOU, CAVALIER];
  const rangPromotion = trait === 1 ? 0 : 7;

  const poserPion = (depuis: number, vers: number, prise: number) => {
    if (ligne(vers) === rangPromotion) {
      for (const promotion of PROMOTIONS) out.push({ depuis, vers, promotion, prise });
    } else {
      out.push({ depuis, vers, prise });
    }
  };

  for (let depuis = 0; depuis < 64; depuis++) {
    const piece = cases[depuis];
    if (piece === 0 || couleurDe(piece) !== trait) continue;
    const type = Math.abs(piece);

    if (type === PION) {
      const sens = trait === 1 ? -1 : 1;
      const rangDepart = trait === 1 ? 6 : 1;
      const l = ligne(depuis);
      const c = colonne(depuis);

      const devant = (l + sens) * 8 + c;
      if (dans(l + sens, c) && cases[devant] === 0) {
        poserPion(depuis, devant, 0);
        const double = (l + 2 * sens) * 8 + c;
        if (l === rangDepart && cases[double] === 0) out.push({ depuis, vers: double, prise: 0 });
      }

      for (const dc of [-1, 1]) {
        const nl = l + sens;
        const nc = c + dc;
        if (!dans(nl, nc)) continue;
        const vers = nl * 8 + nc;
        const cible = cases[vers];
        if (cible !== 0 && couleurDe(cible) !== trait) poserPion(depuis, vers, Math.abs(cible));
        else if (vers === pos.enPassant && cible === 0)
          out.push({ depuis, vers, enPassant: true, prise: PION });
      }
      continue;
    }

    if (type === CAVALIER) sauts(depuis, SAUTS_CAVALIER);
    else if (type === FOU) glissantes(depuis, DIRS_FOU);
    else if (type === TOUR) glissantes(depuis, DIRS_TOUR);
    else if (type === DAME) glissantes(depuis, [...DIRS_FOU, ...DIRS_TOUR]);
    else if (type === ROI) sauts(depuis, DIRS_ROI);
  }

  // Roques : cases vides, roi ni en échec ni traversant une case attaquée.
  const adverse = (-trait) as Couleur;
  if (trait === 1 && cases[60] === ROI) {
    if (
      pos.roques.br &&
      cases[63] === TOUR &&
      cases[61] === 0 &&
      cases[62] === 0 &&
      !estAttaquee(cases, 60, adverse) &&
      !estAttaquee(cases, 61, adverse) &&
      !estAttaquee(cases, 62, adverse)
    )
      out.push({ depuis: 60, vers: 62, roque: 'petit', prise: 0 });
    if (
      pos.roques.bd &&
      cases[56] === TOUR &&
      cases[57] === 0 &&
      cases[58] === 0 &&
      cases[59] === 0 &&
      !estAttaquee(cases, 60, adverse) &&
      !estAttaquee(cases, 59, adverse) &&
      !estAttaquee(cases, 58, adverse)
    )
      out.push({ depuis: 60, vers: 58, roque: 'grand', prise: 0 });
  }
  if (trait === -1 && cases[4] === -ROI) {
    if (
      pos.roques.nr &&
      cases[7] === -TOUR &&
      cases[5] === 0 &&
      cases[6] === 0 &&
      !estAttaquee(cases, 4, adverse) &&
      !estAttaquee(cases, 5, adverse) &&
      !estAttaquee(cases, 6, adverse)
    )
      out.push({ depuis: 4, vers: 6, roque: 'petit', prise: 0 });
    if (
      pos.roques.nd &&
      cases[0] === -TOUR &&
      cases[1] === 0 &&
      cases[2] === 0 &&
      cases[3] === 0 &&
      !estAttaquee(cases, 4, adverse) &&
      !estAttaquee(cases, 3, adverse) &&
      !estAttaquee(cases, 2, adverse)
    )
      out.push({ depuis: 4, vers: 2, roque: 'grand', prise: 0 });
  }

  return out;
}

export function appliquer(pos: Position, coup: Coup): Position {
  const suivant = copier(pos);
  const { cases } = suivant;
  const piece = cases[coup.depuis];
  const type = Math.abs(piece);
  const trait = pos.trait;

  cases[coup.depuis] = 0;
  cases[coup.vers] = coup.promotion ? trait * coup.promotion : piece;

  if (coup.enPassant) {
    // Le pion pris n'est pas sur la case d'arrivée mais juste à côté.
    const capture = coup.vers + (trait === 1 ? 8 : -8);
    cases[capture] = 0;
  }

  if (coup.roque === 'petit') {
    const base = trait === 1 ? 56 : 0;
    cases[base + 5] = cases[base + 7];
    cases[base + 7] = 0;
  } else if (coup.roque === 'grand') {
    const base = trait === 1 ? 56 : 0;
    cases[base + 3] = cases[base];
    cases[base] = 0;
  }

  // Droits au roque : perdus dès que le roi ou la tour bouge, ou que la tour tombe.
  if (type === ROI) {
    if (trait === 1) {
      suivant.roques.br = false;
      suivant.roques.bd = false;
    } else {
      suivant.roques.nr = false;
      suivant.roques.nd = false;
    }
  }
  if (coup.depuis === 63 || coup.vers === 63) suivant.roques.br = false;
  if (coup.depuis === 56 || coup.vers === 56) suivant.roques.bd = false;
  if (coup.depuis === 7 || coup.vers === 7) suivant.roques.nr = false;
  if (coup.depuis === 0 || coup.vers === 0) suivant.roques.nd = false;

  suivant.enPassant =
    type === PION && Math.abs(coup.vers - coup.depuis) === 16
      ? (coup.depuis + coup.vers) / 2
      : -1;

  suivant.demiCoups = type === PION || coup.prise > 0 ? 0 : pos.demiCoups + 1;
  suivant.trait = (-trait) as Couleur;
  return suivant;
}

export function coupsLegaux(pos: Position): Coup[] {
  const out: Coup[] = [];
  for (const coup of coupsPseudo(pos)) {
    const apres = appliquer(pos, coup);
    const roi = trouverRoi(apres.cases, pos.trait);
    if (roi >= 0 && estAttaquee(apres.cases, roi, (-pos.trait) as Couleur)) continue;
    out.push(coup);
  }
  return out;
}

export type Issue = 'mat' | 'pat' | 'materiel' | 'cinquante' | null;

export function issue(pos: Position): Issue {
  if (coupsLegaux(pos).length === 0) return enEchec(pos) ? 'mat' : 'pat';
  if (pos.demiCoups >= 100) return 'cinquante';

  // Matériel insuffisant : roi seul, ou roi et une pièce mineure de chaque côté.
  let mineures = 0;
  for (let i = 0; i < 64; i++) {
    const t = Math.abs(pos.cases[i]);
    if (t === 0 || t === ROI) continue;
    if (t === CAVALIER || t === FOU) mineures += 1;
    else return null;
  }
  return mineures <= 1 ? 'materiel' : null;
}

// --- Évaluation ------------------------------------------------------------

const VALEURS = [0, 100, 320, 330, 500, 900, 0];

/** Tables de position, écrites du point de vue des blancs, a8 en premier. */
const TABLE_PION = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10,
  25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10,
  10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];
const TABLE_CAVALIER = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0,
  -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5,
  -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];
const TABLE_FOU = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
];
const TABLE_TOUR = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
  0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5,
  5, 0, 0, 0,
];
const TABLE_DAME = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5,
  0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0,
  -10, -20, -10, -10, -5, -5, -10, -10, -20,
];
const TABLE_ROI_MILIEU = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
  -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
  -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
  10, 30, 20,
];
const TABLE_ROI_FINALE = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30,
  20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10,
  20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
];

const TABLES = [null, TABLE_PION, TABLE_CAVALIER, TABLE_FOU, TABLE_TOUR, TABLE_DAME, null];

/** Note de la position en centièmes de pion, du point de vue des blancs. */
export function evaluer(pos: Position): number {
  let score = 0;
  let materielLourd = 0;

  for (let i = 0; i < 64; i++) {
    const piece = pos.cases[i];
    if (piece === 0) continue;
    const type = Math.abs(piece);
    if (type !== PION && type !== ROI) materielLourd += VALEURS[type];
  }
  const finale = materielLourd < 1600;

  for (let i = 0; i < 64; i++) {
    const piece = pos.cases[i];
    if (piece === 0) continue;
    const type = Math.abs(piece);
    const blanc = piece > 0;
    // Les tables sont écrites pour les blancs : on les retourne pour les noirs.
    const indice = blanc ? i : (7 - ligne(i)) * 8 + colonne(i);
    const table = type === ROI ? (finale ? TABLE_ROI_FINALE : TABLE_ROI_MILIEU) : TABLES[type];
    const valeur = VALEURS[type] + (table ? table[indice] : 0);
    score += blanc ? valeur : -valeur;
  }

  return score;
}

// --- Recherche -------------------------------------------------------------

const MAT = 100000;
let noeuds = 0;
let budget = 0;

/** Tri : promotions, puis prises de la plus grosse pièce par la plus petite. */
function ordonner(pos: Position, coups: Coup[]): Coup[] {
  return coups
    .map((coup) => {
      let note = 0;
      if (coup.promotion) note += 900 + VALEURS[coup.promotion];
      if (coup.prise > 0) note += 100 * VALEURS[coup.prise] - VALEURS[Math.abs(pos.cases[coup.depuis])];
      if (coup.roque) note += 60;
      return { coup, note };
    })
    .sort((a, b) => b.note - a.note)
    .map((x) => x.coup);
}

/**
 * Recherche de quiescence : on ne s'arrête jamais au milieu d'un échange.
 * Sans elle, le moteur laisse des pièces en prise juste au-delà de l'horizon.
 */
function quiescence(pos: Position, alpha: number, beta: number, profondeur: number): number {
  noeuds += 1;
  const debout = evaluer(pos) * pos.trait;
  if (profondeur === 0 || noeuds > budget) return debout;
  if (debout >= beta) return beta;
  let a = Math.max(alpha, debout);

  const prises = coupsLegaux(pos).filter((coup) => coup.prise > 0 || coup.promotion);
  for (const coup of ordonner(pos, prises)) {
    const valeur = -quiescence(appliquer(pos, coup), -beta, -a, profondeur - 1);
    if (valeur >= beta) return beta;
    if (valeur > a) a = valeur;
  }
  return a;
}

function negamax(pos: Position, profondeur: number, alpha: number, beta: number): number {
  noeuds += 1;
  const legaux = coupsLegaux(pos);

  if (legaux.length === 0) return enEchec(pos) ? -MAT - profondeur : 0;
  if (pos.demiCoups >= 100) return 0;
  if (profondeur === 0) return quiescence(pos, alpha, beta, 4);
  if (noeuds > budget) return evaluer(pos) * pos.trait;

  let a = alpha;
  for (const coup of ordonner(pos, legaux)) {
    const valeur = -negamax(appliquer(pos, coup), profondeur - 1, -beta, -a);
    if (valeur >= beta) return beta;
    if (valeur > a) a = valeur;
  }
  return a;
}

export type Niveau = 'facile' | 'normal' | 'expert';

/** Le meilleur coup pour le camp au trait, ou null s'il n'y en a aucun. */
export function meilleurCoup(pos: Position, niveau: Niveau): Coup | null {
  const legaux = coupsLegaux(pos);
  if (legaux.length === 0) return null;
  if (legaux.length === 1) return legaux[0];

  if (niveau === 'facile' && Math.random() < 0.3) {
    return legaux[Math.floor(Math.random() * legaux.length)];
  }

  noeuds = 0;
  budget = niveau === 'facile' ? 8000 : niveau === 'normal' ? 90000 : 400000;
  const profondeur = niveau === 'facile' ? 2 : niveau === 'normal' ? 3 : 4;

  let meilleur = legaux[0];
  let meilleureValeur = -Infinity;
  for (const coup of ordonner(pos, legaux)) {
    const valeur = -negamax(appliquer(pos, coup), profondeur - 1, -Infinity, -meilleureValeur);
    if (valeur > meilleureValeur) {
      meilleureValeur = valeur;
      meilleur = coup;
    }
  }
  return meilleur;
}

// --- Affichage -------------------------------------------------------------

const FICHIERS = 'abcdefgh';

export function nomCase(index: number): string {
  return FICHIERS[colonne(index)] + (8 - ligne(index));
}

const LETTRE_PIECE: Record<number, string> = {
  [CAVALIER]: 'C',
  [FOU]: 'F',
  [TOUR]: 'T',
  [DAME]: 'D',
  [ROI]: 'R',
};

/** Notation française abrégée, suffisamment précise pour un journal de partie. */
export function noterCoup(pos: Position, coup: Coup): string {
  if (coup.roque === 'petit') return 'O-O';
  if (coup.roque === 'grand') return 'O-O-O';

  const type = Math.abs(pos.cases[coup.depuis]);
  const prefixe = type === PION ? (coup.prise > 0 ? FICHIERS[colonne(coup.depuis)] : '') : LETTRE_PIECE[type];
  const prise = coup.prise > 0 ? 'x' : '';
  const promotion = coup.promotion ? '=' + (LETTRE_PIECE[coup.promotion] ?? 'D') : '';

  const apres = appliquer(pos, coup);
  const suffixe = coupsLegaux(apres).length === 0 ? (enEchec(apres) ? '#' : '') : enEchec(apres) ? '+' : '';

  return prefixe + prise + nomCase(coup.vers) + promotion + suffixe;
}

/** Symboles Unicode pleins : la couleur est portée par le style, pas par le glyphe. */
export const GLYPHES: Record<number, string> = {
  [PION]: '♟',
  [CAVALIER]: '♞',
  [FOU]: '♝',
  [TOUR]: '♜',
  [DAME]: '♛',
  [ROI]: '♚',
};
