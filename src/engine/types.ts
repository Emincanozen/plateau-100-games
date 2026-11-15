import type { ComponentType } from 'react';

export type CategoryId = 'plateau' | 'cartes' | 'logique' | 'arcade' | 'des' | 'papier';

export interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
  accent: string;
  blurb: string;
}

export const CATEGORIES: Category[] = [
  { id: 'plateau', label: 'Plateau', emoji: '♟️', accent: '#5B8DEF', blurb: 'Les classiques du damier' },
  { id: 'cartes', label: 'Cartes', emoji: '🃏', accent: '#E0525F', blurb: 'Réussites et jeux de plis' },
  { id: 'logique', label: 'Logique', emoji: '🧩', accent: '#34B37E', blurb: 'Casse-têtes et déduction' },
  { id: 'arcade', label: 'Arcade', emoji: '🕹️', accent: '#F0A030', blurb: 'Réflexes et adresse' },
  { id: 'des', label: 'Dés', emoji: '🎲', accent: '#A96CF0', blurb: 'Le hasard et la prise de risque' },
  { id: 'papier', label: 'Papier-crayon', emoji: '✏️', accent: '#4BC4D6', blurb: 'À deux sur un carnet' },
];

export const CATEGORY_BY_ID: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>;

/** Comment le meilleur score d'un jeu est comparé. */
export type ScoreKind =
  | 'high' // le plus grand score gagne (2048, Snake…)
  | 'low' // le plus petit gagne (coups, déplacements…)
  | 'time' // le temps le plus court gagne, en millisecondes
  | 'none'; // pas de score, on suit victoires/défaites

export interface GameMeta {
  id: string;
  name: string;
  /** Une phrase, affichée sur la fiche du jeu. */
  tagline: string;
  category: CategoryId;
  emoji: string;
  /** 1 = accessible, 2 = intermédiaire, 3 = exigeant. */
  difficulty: 1 | 2 | 3;
  /** Nombre de joueurs sur le même appareil. */
  players: '1' | '1-2' | '2' | '2-4';
  /** Durée typique d'une partie, en minutes. */
  minutes: number;
  score: ScoreKind;
  /** Unité affichée à côté du record (« pts », « coups »…). */
  scoreUnit?: string;
  tags: string[];
  /** Règles affichées dans la fiche et le menu pause. */
  rules: string[];
}

export interface GameEntry {
  meta: GameMeta;
  component: ComponentType<GameScreenProps>;
}

/** Props reçues par chaque jeu. */
export interface GameScreenProps {
  meta: GameMeta;
  /** Enregistre un score final et renvoie true si c'est un nouveau record. */
  submitScore: (score: number) => boolean;
  /** Enregistre une issue pour les jeux sans score chiffré. */
  submitResult: (outcome: 'win' | 'loss' | 'draw') => void;
  /** Meilleur score connu, ou undefined. */
  best?: number;
  /** Retour haptique respectant les réglages de l'utilisateur. */
  haptic: (kind?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => void;
}
