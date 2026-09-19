import type { ComponentType } from 'react';
import type { CategoryId, GameEntry, GameMeta, GameScreenProps } from '@/engine/types';

/**
 * Registre central. Chaque jeu est un module qui exporte `meta` et un composant par defaut.
 * Ajouter un jeu = ajouter un import et une entree dans MODULES.
 */
interface GameModule {
  meta: GameMeta;
  default: ComponentType<GameScreenProps>;
}

// --- Plateau ---------------------------------------------------------------
import * as morpion from './plateau/morpion';
import * as puissance4 from './plateau/puissance4';
import * as othello from './plateau/othello';
import * as dames from './plateau/dames';
import * as gomoku from './plateau/gomoku';
import * as awale from './plateau/awale';

// --- Cartes ----------------------------------------------------------------
import * as solitaire from './cartes/solitaire';
import * as blackjack from './cartes/blackjack';
import * as pyramide from './cartes/pyramide';
import * as triPeaks from './cartes/tri-peaks';
import * as bataille from './cartes/bataille';
import * as huitAmericain from './cartes/huit-americain';
import * as golf from './cartes/golf';
import * as videoPoker from './cartes/video-poker';
import * as accordeon from './cartes/accordeon';
import * as pouilleux from './cartes/pouilleux';
import * as yukon from './cartes/yukon';
import * as trenteEtUn from './cartes/trente-et-un';
import * as freecell from './cartes/freecell';
import * as araignee from './cartes/araignee';
import * as quaranteVoleurs from './cartes/quarante-voleurs';
import * as canfield from './cartes/canfield';
import * as president from './cartes/president';
import * as menteur from './cartes/menteur';
import * as scopa from './cartes/scopa';
import * as rami from './cartes/rami';

// --- Logique ---------------------------------------------------------------
import * as jeu2048 from './logique/jeu2048';
import * as demineur from './logique/demineur';
import * as memory from './logique/memory';
import * as taquin from './logique/taquin';
import * as sudoku from './logique/sudoku';
import * as hanoi from './logique/hanoi';
import * as mastermind from './logique/mastermind';
import * as lightsOut from './logique/lights-out';
import * as flood from './logique/flood';
import * as simon from './logique/simon';

// --- Arcade ----------------------------------------------------------------
import * as snake from './arcade/snake';
import * as tetris from './arcade/tetris';
import * as casseBriques from './arcade/casse-briques';
import * as pong from './arcade/pong';
import * as flappy from './arcade/flappy';
import * as taupes from './arcade/taupes';
import * as dino from './arcade/dino';
import * as envahisseurs from './arcade/envahisseurs';
import * as empilage from './arcade/empilage';
import * as esquive from './arcade/esquive';
import * as reflexes from './arcade/reflexes';
import * as squash from './arcade/squash';
import * as helicoptere from './arcade/helicoptere';
import * as traversee from './arcade/traversee';
import * as sautPlateforme from './arcade/saut-plateforme';
import * as tunnel from './arcade/tunnel';
import * as asteroides from './arcade/asteroides';
import * as missiles from './arcade/missiles';
import * as bulles from './arcade/bulles';
import * as labyrintheFantomes from './arcade/labyrinthe-fantomes';

// --- Dés -------------------------------------------------------------------
import * as yams from './des/yams';
import * as cochon from './des/cochon';
import * as quatreCentVingtEtUn from './des/quatre-cent-vingt-et-un';
import * as fermerLaBoite from './des/fermer-la-boite';

// --- Papier-crayon ---------------------------------------------------------
import * as pendu from './papier/pendu';
import * as allumettes from './papier/allumettes';
import * as pointsEtCarres from './papier/points-et-carres';
import * as motus from './papier/motus';
import * as batailleNavale from './papier/bataille-navale';

const MODULES: GameModule[] = [
  morpion,
  puissance4,
  othello,
  dames,
  gomoku,
  awale,
  solitaire,
  blackjack,
  pyramide,
  triPeaks,
  bataille,
  huitAmericain,
  golf,
  videoPoker,
  accordeon,
  pouilleux,
  yukon,
  trenteEtUn,
  freecell,
  araignee,
  quaranteVoleurs,
  canfield,
  president,
  menteur,
  scopa,
  rami,
  jeu2048,
  demineur,
  memory,
  taquin,
  sudoku,
  hanoi,
  mastermind,
  lightsOut,
  flood,
  simon,
  snake,
  tetris,
  casseBriques,
  pong,
  flappy,
  taupes,
  dino,
  envahisseurs,
  empilage,
  esquive,
  reflexes,
  squash,
  helicoptere,
  traversee,
  sautPlateforme,
  tunnel,
  asteroides,
  missiles,
  bulles,
  labyrintheFantomes,
  yams,
  cochon,
  quatreCentVingtEtUn,
  fermerLaBoite,
  pendu,
  allumettes,
  pointsEtCarres,
  motus,
  batailleNavale,
];

export const GAMES: GameEntry[] = MODULES.map((m) => ({ meta: m.meta, component: m.default }));

export const GAME_COUNT = GAMES.length;

const BY_ID = new Map<string, GameEntry>(GAMES.map((g) => [g.meta.id, g]));

export function getGame(id: string | undefined): GameEntry | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function gamesInCategory(category: CategoryId): GameEntry[] {
  return GAMES.filter((g) => g.meta.category === category);
}

export function countByCategory(): Record<CategoryId, number> {
  const out = {} as Record<CategoryId, number>;
  for (const game of GAMES) {
    out[game.meta.category] = (out[game.meta.category] ?? 0) + 1;
  }
  return out;
}

const sansAccent = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Recherche tolerante : nom, phrase d'accroche et mots-cles, accents ignores. */
export function searchGames(query: string): GameEntry[] {
  const q = sansAccent(query.trim());
  if (!q) return GAMES;
  return GAMES.filter((g) =>
    sansAccent([g.meta.name, g.meta.tagline, ...g.meta.tags].join(' ')).includes(q),
  );
}
