import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { randInt, pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'morpion',
  name: 'Morpion',
  tagline: 'Trois symboles alignés et la partie est pliée.',
  category: 'plateau',
  emoji: '⭕',
  difficulty: 1,
  players: '1-2',
  minutes: 2,
  score: 'none',
  tags: ['classique', 'rapide', 'duo'],
  rules: [
    'À tour de rôle, chaque joueur pose son symbole dans une case vide.',
    'Le premier qui aligne trois symboles — ligne, colonne ou diagonale — gagne.',
    'Si les neuf cases sont remplies sans alignement, la partie est nulle.',
    'En solo, tu joues les ronds et l’ordinateur les croix.',
  ],
};

type Cell = 'O' | 'X' | null;
type Board = Cell[];
type Mode = 'facile' | 'normal' | 'expert' | 'duo';

const LINES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function winnerOf(b: Board): { player: Cell; line: [number, number, number] } | null {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line };
  }
  return null;
}

const emptyCells = (b: Board): number[] =>
  b.reduce<number[]>((acc, cell, i) => (cell === null ? [...acc, i] : acc), []);

/** Minimax complet : le plateau 3x3 est assez petit pour etre explore entierement. */
function minimax(b: Board, forPlayer: Cell, turn: Cell, depth: number): number {
  const win = winnerOf(b);
  if (win) return win.player === forPlayer ? 10 - depth : depth - 10;
  const free = emptyCells(b);
  if (free.length === 0) return 0;

  const scores = free.map((i) => {
    const next = b.slice();
    next[i] = turn;
    return minimax(next, forPlayer, turn === 'X' ? 'O' : 'X', depth + 1);
  });

  return turn === forPlayer ? Math.max(...scores) : Math.min(...scores);
}

function bestMove(b: Board, me: Cell): number {
  const free = emptyCells(b);
  let best = free[0];
  let bestScore = -Infinity;
  for (const i of free) {
    const next = b.slice();
    next[i] = me;
    const s = minimax(next, me, me === 'X' ? 'O' : 'X', 0);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best;
}

/** Coup gagnant immediat, sinon coup bloquant, sinon null. */
function tacticalMove(b: Board, me: Cell): number | null {
  const opponent: Cell = me === 'X' ? 'O' : 'X';
  for (const who of [me, opponent]) {
    for (const line of LINES) {
      const trio = [b[line[0]], b[line[1]], b[line[2]]];
      const filled = trio.filter((v) => v === who).length;
      const free = trio.filter((v) => v === null).length;
      if (filled === 2 && free === 1) return line[trio.indexOf(null)];
    }
  }
  return null;
}

function aiMove(b: Board, mode: Mode): number {
  const free = emptyCells(b);
  if (mode === 'facile') {
    return Math.random() < 0.65 ? pick(free) : (tacticalMove(b, 'X') ?? pick(free));
  }
  if (mode === 'normal') {
    const tactical = tacticalMove(b, 'X');
    if (tactical !== null) return tactical;
    if (b[4] === null) return 4;
    return pick(free);
  }
  return bestMove(b, 'X');
}

const EMPTY_BOARD: Board = Array(9).fill(null);

export default function Morpion({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const size = useBoardSize(40, 0.5);
  const cell = Math.floor(size / 3);

  const [mode, setMode] = useState<Mode>('normal');
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [turn, setTurn] = useState<Cell>('O');
  const [counted, setCounted] = useState(false);
  const [tally, setTally] = useState({ O: 0, X: 0, nul: 0 });

  const result = useMemo(() => winnerOf(board), [board]);
  const full = useMemo(() => emptyCells(board).length === 0, [board]);
  const finished = !!result || full;

  const reset = useCallback(() => {
    setBoard(EMPTY_BOARD);
    setTurn('O');
    setCounted(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  // Fin de partie : comptabilisee une seule fois par manche.
  useEffect(() => {
    if (!finished || counted) return;
    setCounted(true);
    if (result) {
      const side = result.player as 'O' | 'X';
      const humanWon = side === 'O';
      haptic(mode === 'duo' ? 'success' : humanWon ? 'success' : 'error');
      setTally((t) => ({ ...t, [side]: t[side] + 1 }));
      if (mode !== 'duo') submitResult(humanWon ? 'win' : 'loss');
    } else {
      haptic('warning');
      setTally((t) => ({ ...t, nul: t.nul + 1 }));
      if (mode !== 'duo') submitResult('draw');
    }
  }, [finished, counted, result, mode, haptic, submitResult]);

  // Tour de l'ordinateur.
  useEffect(() => {
    if (mode === 'duo' || turn !== 'X' || finished) return;
    const id = setTimeout(
      () => {
        setBoard((b) => {
          if (winnerOf(b) || emptyCells(b).length === 0) return b;
          const next = b.slice();
          next[aiMove(b, mode)] = 'X';
          return next;
        });
        setTurn('O');
      },
      380 + randInt(220),
    );
    return () => clearTimeout(id);
  }, [turn, mode, finished]);

  const play = (index: number) => {
    if (board[index] || finished) return;
    if (mode !== 'duo' && turn !== 'O') return;
    haptic('light');
    const next = board.slice();
    next[index] = turn;
    setBoard(next);
    setTurn(turn === 'O' ? 'X' : 'O');
  };

  const statusText = finished
    ? result
      ? `${result.player === 'O' ? 'Ronds' : 'Croix'} gagnent`
      : 'Match nul'
    : mode === 'duo'
      ? `Au tour des ${turn === 'O' ? 'ronds' : 'croix'}`
      : turn === 'O'
        ? 'À toi de jouer'
        : 'L’ordinateur réfléchit…';

  useFrameStatus(
    <Txt variant="label" tone="dim">
      {statusText}
    </Txt>,
  );

  const winLine: number[] = result?.line ?? [];

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ width: cell * 3 }}>
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

      <View
        style={{
          width: cell * 3,
          height: cell * 3,
          backgroundColor: c.surfaceAlt,
          borderRadius: radius.lg,
          overflow: 'hidden',
          flexDirection: 'row',
          flexWrap: 'wrap',
        }}
      >
        {board.map((value, i) => {
          const highlight = winLine.includes(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Case ${i + 1}, ${value ? (value === 'O' ? 'rond' : 'croix') : 'vide'}`}
              onPress={() => play(i)}
              style={({ pressed }) => ({
                width: cell,
                height: cell,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: c.bg,
                backgroundColor: highlight
                  ? c.accent + '2E'
                  : pressed && !value
                    ? c.surfacePressed
                    : c.surface,
              })}
            >
              <Txt
                style={{
                  fontSize: cell * 0.5,
                  fontWeight: '800',
                  color: value === 'O' ? c.accent : c.danger,
                }}
              >
                {value ?? ''}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <Row gap={space.xl}>
        <Tally label="Ronds" value={tally.O} color={c.accent} />
        <Tally label="Nuls" value={tally.nul} color={c.textFaint} />
        <Tally label="Croix" value={tally.X} color={c.danger} />
      </Row>

      <GameOver
        visible={finished}
        outcome={result ? (mode === 'duo' || result.player === 'O' ? 'win' : 'loss') : 'draw'}
        title={
          result
            ? mode === 'duo'
              ? `Victoire des ${result.player === 'O' ? 'ronds' : 'croix'}`
              : result.player === 'O'
                ? 'Gagné !'
                : 'L’ordinateur gagne'
            : 'Match nul'
        }
        detail={`Ronds ${tally.O} · Nuls ${tally.nul} · Croix ${tally.X}`}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Txt>
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
    </View>
  );
}
