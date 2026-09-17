import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'puissance4',
  name: 'Puissance 4',
  tagline: 'Empile tes jetons et aligne-en quatre avant l’adversaire.',
  category: 'plateau',
  emoji: '🔴',
  difficulty: 2,
  players: '1-2',
  minutes: 5,
  score: 'none',
  tags: ['classique', 'duo', 'stratégie'],
  rules: [
    'Touche une colonne pour y laisser tomber ton jeton : il se pose sur la pile.',
    'Aligne quatre jetons de ta couleur, à l’horizontale, à la verticale ou en diagonale.',
    'La grille pleine sans alignement donne un match nul.',
    'En solo tu joues les rouges et commences toujours la partie.',
  ],
};

const COLS = 7;
const ROWS = 6;

type Disc = 'R' | 'J' | null;
type Grid = Disc[]; // index = row * COLS + col, ligne 0 en haut
type Mode = 'facile' | 'normal' | 'expert' | 'duo';

const idx = (row: number, col: number) => row * COLS + col;
const newGrid = (): Grid => Array(COLS * ROWS).fill(null);

/** Ligne libre la plus basse d'une colonne, ou -1 si la colonne est pleine. */
function dropRow(g: Grid, col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (g[idx(row, col)] === null) return row;
  }
  return -1;
}

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function findWin(g: Grid): { player: Disc; cells: number[] } | null {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const start = g[idx(row, col)];
      if (!start) continue;
      for (const [dr, dc] of DIRS) {
        const cells = [idx(row, col)];
        for (let step = 1; step < 4; step++) {
          const r = row + dr * step;
          const cc = col + dc * step;
          if (r < 0 || r >= ROWS || cc < 0 || cc >= COLS) break;
          if (g[idx(r, cc)] !== start) break;
          cells.push(idx(r, cc));
        }
        if (cells.length === 4) return { player: start, cells };
      }
    }
  }
  return null;
}

const playableCols = (g: Grid): number[] => {
  const out: number[] = [];
  for (let col = 0; col < COLS; col++) if (dropRow(g, col) >= 0) out.push(col);
  return out;
};

function place(g: Grid, col: number, disc: Disc): Grid {
  const row = dropRow(g, col);
  if (row < 0) return g;
  const next = g.slice();
  next[idx(row, col)] = disc;
  return next;
}

/** Note une fenetre de 4 cases du point de vue de `me`. */
function scoreWindow(cells: Disc[], me: Disc): number {
  const other: Disc = me === 'R' ? 'J' : 'R';
  const mine = cells.filter((v) => v === me).length;
  const theirs = cells.filter((v) => v === other).length;
  if (mine && theirs) return 0;
  if (mine === 4) return 10000;
  if (theirs === 4) return -10000;
  if (mine === 3) return 60;
  if (theirs === 3) return -80; // bloquer vaut un peu plus que construire
  if (mine === 2) return 8;
  if (theirs === 2) return -6;
  return 0;
}

function evaluate(g: Grid, me: Disc): number {
  let total = 0;
  // Les colonnes centrales ouvrent plus d'alignements.
  for (let row = 0; row < ROWS; row++) {
    if (g[idx(row, 3)] === me) total += 6;
  }
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      for (const [dr, dc] of DIRS) {
        const endR = row + dr * 3;
        const endC = col + dc * 3;
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        const window: Disc[] = [0, 1, 2, 3].map((s) => g[idx(row + dr * s, col + dc * s)]);
        total += scoreWindow(window, me);
      }
    }
  }
  return total;
}

/** Minimax alpha-beta, ecrit explicitement pour rester lisible. */
function search(g: Grid, depth: number, alpha: number, beta: number, me: Disc, turn: Disc): number {
  const win = findWin(g);
  if (win) return win.player === me ? 100000 + depth : -100000 - depth;
  const cols = playableCols(g);
  if (cols.length === 0) return 0;
  if (depth === 0) return evaluate(g, me);

  const ordered = cols.slice().sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
  const next: Disc = turn === 'R' ? 'J' : 'R';

  if (turn === me) {
    let best = -Infinity;
    for (const col of ordered) {
      best = Math.max(best, search(place(g, col, turn), depth - 1, alpha, beta, me, next));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const col of ordered) {
    best = Math.min(best, search(place(g, col, turn), depth - 1, alpha, beta, me, next));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function aiColumn(g: Grid, mode: Mode): number {
  const cols = playableCols(g);
  if (cols.length === 0) return 0;

  // Coup gagnant immediat, puis blocage : vrai quel que soit le niveau.
  for (const col of cols) {
    if (findWin(place(g, col, 'J'))) return col;
  }
  for (const col of cols) {
    if (findWin(place(g, col, 'R'))) return col;
  }

  if (mode === 'facile') return pick(cols);

  const depth = mode === 'normal' ? 3 : 5;
  let best = cols[0];
  let bestScore = -Infinity;
  const ordered = cols.slice().sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
  for (const col of ordered) {
    const score = search(place(g, col, 'J'), depth - 1, -Infinity, Infinity, 'J', 'R');
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return best;
}

export default function Puissance4({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const width = useBoardSize(32, 0.56);
  const cell = Math.floor(width / COLS);

  const [mode, setMode] = useState<Mode>('normal');
  const [grid, setGrid] = useState<Grid>(newGrid);
  const [turn, setTurn] = useState<Disc>('R');
  const [counted, setCounted] = useState(false);
  const [thinking, setThinking] = useState(false);

  const win = useMemo(() => findWin(grid), [grid]);
  const full = useMemo(() => playableCols(grid).length === 0, [grid]);
  const finished = !!win || full;

  const reset = useCallback(() => {
    setGrid(newGrid());
    setTurn('R');
    setCounted(false);
    setThinking(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!finished || counted) return;
    setCounted(true);
    if (win) {
      const humanWon = win.player === 'R';
      haptic(humanWon || mode === 'duo' ? 'success' : 'error');
      if (mode !== 'duo') submitResult(humanWon ? 'win' : 'loss');
    } else {
      haptic('warning');
      if (mode !== 'duo') submitResult('draw');
    }
  }, [finished, counted, win, mode, haptic, submitResult]);

  useEffect(() => {
    if (mode === 'duo' || turn !== 'J' || finished) return;
    setThinking(true);
    const id = setTimeout(() => {
      setGrid((g) => (findWin(g) ? g : place(g, aiColumn(g, mode), 'J')));
      setTurn('R');
      setThinking(false);
    }, 420);
    return () => clearTimeout(id);
  }, [turn, mode, finished]);

  const drop = (col: number) => {
    if (finished || thinking) return;
    if (mode !== 'duo' && turn !== 'R') return;
    if (dropRow(grid, col) < 0) return;
    haptic('medium');
    setGrid((g) => place(g, col, turn));
    setTurn(turn === 'R' ? 'J' : 'R');
  };

  const statusText = finished
    ? win
      ? `${win.player === 'R' ? 'Rouge' : 'Jaune'} gagne`
      : 'Match nul'
    : mode === 'duo'
      ? `Au tour de ${turn === 'R' ? 'rouge' : 'jaune'}`
      : turn === 'R'
        ? 'À toi de jouer'
        : 'L’ordinateur réfléchit…';

  useFrameStatus(
    <Txt variant="label" tone="dim">
      {statusText}
    </Txt>,
  );

  const winCells: number[] = win?.cells ?? [];

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: cell * COLS }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'expert', label: 'Expert' },
            { value: 'duo', label: 'Duo' },
          ]}
        />
      </View>

      <View style={{ flexDirection: 'row' }}>
        {Array.from({ length: COLS }, (_, col) => (
          <Pressable
            key={col}
            accessibilityRole="button"
            accessibilityLabel={`Jouer colonne ${col + 1}`}
            onPress={() => drop(col)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? c.accentSoft : 'transparent',
              borderRadius: radius.sm,
            })}
          >
            {Array.from({ length: ROWS }, (_, row) => {
              const disc = grid[idx(row, col)];
              const highlight = winCells.includes(idx(row, col));
              return (
                <View
                  key={row}
                  style={{
                    width: cell,
                    height: cell,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: c.surfaceAlt,
                    borderWidth: 2,
                    borderColor: c.bg,
                  }}
                >
                  <View
                    style={{
                      width: cell * 0.76,
                      height: cell * 0.76,
                      borderRadius: cell,
                      backgroundColor:
                        disc === 'R' ? '#E0525F' : disc === 'J' ? '#EFB93B' : c.bg,
                      borderWidth: highlight ? 3 : 0,
                      borderColor: c.text,
                    }}
                  />
                </View>
              );
            })}
          </Pressable>
        ))}
      </View>

      <GameOver
        visible={finished}
        outcome={win ? (mode === 'duo' || win.player === 'R' ? 'win' : 'loss') : 'draw'}
        title={
          win
            ? mode === 'duo'
              ? `Victoire des ${win.player === 'R' ? 'rouges' : 'jaunes'}`
              : win.player === 'R'
                ? 'Gagné !'
                : 'L’ordinateur gagne'
            : 'Match nul'
        }
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
