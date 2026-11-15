import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadJSON, saveJSON } from './storage';
import { normaliserProgression } from './progress-data';
import type { ScoreKind } from './types';

export interface GameStat {
  plays: number;
  best?: number;
  wins: number;
  losses: number;
  draws: number;
  lastPlayed?: number;
}

const EMPTY: GameStat = { plays: 0, wins: 0, losses: 0, draws: 0 };

interface ProgressState {
  stats: Record<string, GameStat>;
  favorites: string[];
  recent: string[];
}

interface ProgressCtx extends ProgressState {
  ready: boolean;
  statFor: (gameId: string) => GameStat;
  /** Renvoie true si c'est un nouveau record. */
  submitScore: (gameId: string, score: number, kind: ScoreKind) => boolean;
  submitResult: (gameId: string, outcome: 'win' | 'loss' | 'draw') => void;
  markPlayed: (gameId: string) => void;
  toggleFavorite: (gameId: string) => void;
  isFavorite: (gameId: string) => boolean;
  resetGame: (gameId: string) => void;
  resetEverything: () => void;
  totalPlays: number;
  gamesTried: number;
}

const INITIAL: ProgressState = { stats: {}, favorites: [], recent: [] };

const Ctx = createContext<ProgressCtx | null>(null);

const isBetter = (candidate: number, current: number | undefined, kind: ScoreKind): boolean => {
  if (current === undefined) return true;
  if (kind === 'high') return candidate > current;
  return candidate < current; // 'low' et 'time' : plus petit est meilleur
};

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>(INITIAL);
  const [ready, setReady] = useState(false);
  // Miroir de l'etat, lu par les fonctions qui doivent rester stables.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    loadJSON<unknown>('progress', INITIAL).then((stored) => {
      if (!alive) return;
      setState(normaliserProgression(stored));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const commit = useCallback((updater: (prev: ProgressState) => ProgressState) => {
    setState((prev) => {
      const next = updater(prev);
      void saveJSON('progress', next);
      return next;
    });
  }, []);

  const touch = (prev: ProgressState, gameId: string, patch: Partial<GameStat>): ProgressState => {
    const cur = prev.stats[gameId] ?? EMPTY;
    return {
      ...prev,
      stats: { ...prev.stats, [gameId]: { ...cur, ...patch, lastPlayed: Date.now() } },
      recent: [gameId, ...prev.recent.filter((id) => id !== gameId)].slice(0, 12),
    };
  };

  const markPlayed = useCallback<ProgressCtx['markPlayed']>(
    (gameId) => {
      commit((prev) => touch(prev, gameId, { plays: (prev.stats[gameId]?.plays ?? 0) + 1 }));
    },
    [commit],
  );

  /**
   * IMPORTANT : cette fonction doit garder la meme identite pour toujours.
   * Les jeux l'appellent depuis un useEffect en la mettant dans les dependances ;
   * si elle changeait a chaque enregistrement, l'effet se rappellerait sans fin
   * (« Maximum update depth exceeded »). D'ou la lecture via une ref, pas via l'etat.
   */
  const submitScore = useCallback<ProgressCtx['submitScore']>(
    (gameId, score, kind) => {
      const current = stateRef.current.stats[gameId]?.best;
      const record = kind !== 'none' && isBetter(score, current, kind);
      commit((prev) => {
        const cur = prev.stats[gameId]?.best;
        const isRecord = kind !== 'none' && isBetter(score, cur, kind);
        return touch(prev, gameId, { best: isRecord ? score : cur });
      });
      return record;
    },
    [commit],
  );

  const submitResult = useCallback<ProgressCtx['submitResult']>(
    (gameId, outcome) => {
      commit((prev) => {
        const cur = prev.stats[gameId] ?? EMPTY;
        return touch(prev, gameId, {
          wins: cur.wins + (outcome === 'win' ? 1 : 0),
          losses: cur.losses + (outcome === 'loss' ? 1 : 0),
          draws: cur.draws + (outcome === 'draw' ? 1 : 0),
        });
      });
    },
    [commit],
  );

  const toggleFavorite = useCallback<ProgressCtx['toggleFavorite']>(
    (gameId) => {
      commit((prev) => ({
        ...prev,
        favorites: prev.favorites.includes(gameId)
          ? prev.favorites.filter((id) => id !== gameId)
          : [...prev.favorites, gameId],
      }));
    },
    [commit],
  );

  const resetGame = useCallback<ProgressCtx['resetGame']>(
    (gameId) => {
      commit((prev) => {
        const stats = { ...prev.stats };
        delete stats[gameId];
        return { ...prev, stats };
      });
    },
    [commit],
  );

  const resetEverything = useCallback(() => commit(() => INITIAL), [commit]);

  const value = useMemo<ProgressCtx>(() => {
    const entries = Object.values(state.stats);
    return {
      ...state,
      ready,
      statFor: (id) => state.stats[id] ?? EMPTY,
      submitScore,
      submitResult,
      markPlayed,
      toggleFavorite,
      isFavorite: (id) => state.favorites.includes(id),
      resetGame,
      resetEverything,
      totalPlays: entries.reduce((sum, s) => sum + s.plays, 0),
      gamesTried: entries.filter((s) => s.plays > 0).length,
    };
  }, [state, ready, submitScore, submitResult, markPlayed, toggleFavorite, resetGame, resetEverything]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress(): ProgressCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProgress doit être utilisé dans un ProgressProvider');
  return ctx;
}
