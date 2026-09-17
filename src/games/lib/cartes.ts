/**
 * Moteur de cartes partage par tous les jeux de cartes.
 * Une carte est identifiee par un id stable : "P7", "CR", "TA"…
 */

import { shuffle } from './rng';

export type Couleur = 'P' | 'C' | 'K' | 'T'; // Pique, Coeur, Karreau, Trefle
export type Rang = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Carte {
  id: string;
  couleur: Couleur;
  rang: Rang;
  /** Rouge (coeur, carreau) ou noir (pique, trefle). */
  rouge: boolean;
  /** Face visible ? Les jeux la modifient au fil de la partie. */
  visible: boolean;
}

export const COULEURS: Couleur[] = ['P', 'C', 'K', 'T'];

export const SYMBOLE: Record<Couleur, string> = {
  P: '♠',
  C: '♥',
  K: '♦',
  T: '♣',
};

export const NOM_COULEUR: Record<Couleur, string> = {
  P: 'pique',
  C: 'cœur',
  K: 'carreau',
  T: 'trèfle',
};

const ETIQUETTES: Record<number, string> = {
  1: 'A',
  11: 'V',
  12: 'D',
  13: 'R',
};

export function etiquette(rang: Rang): string {
  return ETIQUETTES[rang] ?? String(rang);
}

export function nomRang(rang: Rang): string {
  switch (rang) {
    case 1:
      return 'as';
    case 11:
      return 'valet';
    case 12:
      return 'dame';
    case 13:
      return 'roi';
    default:
      return String(rang);
  }
}

/** Libelle lisible pour l'accessibilite : « dame de cœur ». */
export function nomCarte(carte: Carte): string {
  return `${nomRang(carte.rang)} de ${NOM_COULEUR[carte.couleur]}`;
}

export const estRouge = (couleur: Couleur): boolean => couleur === 'C' || couleur === 'K';

export function creerCarte(couleur: Couleur, rang: Rang, visible = false): Carte {
  return {
    id: `${couleur}${etiquette(rang)}`,
    couleur,
    rang,
    rouge: estRouge(couleur),
    visible,
  };
}

/** Jeu de 52 cartes, dans l'ordre. */
export function jeu52(): Carte[] {
  const cartes: Carte[] = [];
  for (const couleur of COULEURS) {
    for (let rang = 1; rang <= 13; rang++) {
      cartes.push(creerCarte(couleur, rang as Rang));
    }
  }
  return cartes;
}

/** Jeu de 32 cartes (7 a l'as), pour la belote et la bataille corse. */
export function jeu32(): Carte[] {
  return jeu52().filter((c) => c.rang >= 7 || c.rang === 1);
}

/** Plusieurs jeux melanges ensemble, avec des identifiants uniques. */
export function sabot(nombreDeJeux: number, source: () => Carte[] = jeu52): Carte[] {
  const cartes: Carte[] = [];
  for (let n = 0; n < nombreDeJeux; n++) {
    for (const carte of source()) {
      cartes.push({ ...carte, id: `${carte.id}#${n}` });
    }
  }
  return shuffle(cartes);
}

export function melanger(cartes: Carte[]): Carte[] {
  return shuffle(cartes);
}

export function retourner(carte: Carte, visible: boolean): Carte {
  return { ...carte, visible };
}

/** Valeur au blackjack : figures = 10, as = 11 (ajuste ensuite). */
export function valeurBlackjack(carte: Carte): number {
  if (carte.rang === 1) return 11;
  return Math.min(carte.rang, 10);
}

/** Total d'une main au blackjack, les as comptant 1 si 11 fait depasser 21. */
export function totalBlackjack(main: Carte[]): { total: number; souple: boolean } {
  let total = main.reduce((sum, c) => sum + valeurBlackjack(c), 0);
  let as = main.filter((c) => c.rang === 1).length;
  let souple = as > 0;
  while (total > 21 && as > 0) {
    total -= 10;
    as -= 1;
    souple = as > 0;
  }
  return { total, souple };
}

/** Rangs alternes : utile pour les reussites (roi → dame → valet…). */
export const suitImmediatement = (dessus: Carte, dessous: Carte): boolean =>
  dessus.rang === dessous.rang - 1;

/** Comparaison circulaire, l'as suivant le roi et inversement (Golf, Tri-peaks). */
export function rangsAdjacentsCirculaires(a: Rang, b: Rang): boolean {
  const diff = Math.abs(a - b);
  return diff === 1 || diff === 12;
}
