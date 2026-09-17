import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'demineur',
  name: 'Démineur',
  tagline: 'Déduis la position des mines sans jamais en toucher une.',
  category: 'logique',
  emoji: '💣',
  difficulty: 2,
  players: '1',
  minutes: 6,
  score: 'time',
  scoreUnit: 's',
  tags: ['déduction', 'solo', 'classique'],
  rules: [
    'Touche une case pour la révéler. Le chiffre indique le nombre de mines adjacentes.',
    'Bascule en mode drapeau pour marquer les cases que tu crois minées.',
    'Ta première case révélée n’est jamais une mine : la grille s’adapte.',
    'Découvre toutes les cases sûres pour gagner. Le record retenu est ton meilleur temps.',
  ],
};

type Level = 'facile' | 'normal' | 'expert';

const LEVELS: Record<Level, { cols: number; rows: number; mines: number }> = {
  facile: { cols: 8, rows: 10, mines: 10 },
  normal: { cols: 9, rows: 13, mines: 20 },
  expert: { cols: 10, rows: 16, mines: 35 },
};

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  around: number;
}

type Grid = Cell[];

const makeGrid = (count: number): Grid =>
  Array.from({ length: count }, () => ({ mine: false, revealed: false, flagged: false, around: 0 }));

function neighbours(index: number, cols: number, rows: number): number[] {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      out.push(nr * cols + nc);
    }
  }
  return out;
}

/** Pose les mines en epargnant la premiere case touchee et ses voisines. */
function plantMines(grid: Grid, cols: number, rows: number, mines: number, safe: number): Grid {
  const next = grid.map((cell) => ({ ...cell }));
  const forbidden = new Set([safe, ...neighbours(safe, cols, rows)]);
  let placed = 0;
  while (placed < mines) {
    const i = randInt(next.length);
    if (next[i].mine || forbidden.has(i)) continue;
    next[i].mine = true;
    placed++;
  }
  next.forEach((cell, i) => {
    cell.around = neighbours(i, cols, rows).filter((n) => next[n].mine).length;
  });
  return next;
}

/** Revele en cascade toutes les cases vides connectees. */
function revealFrom(grid: Grid, start: number, cols: number, rows: number): Grid {
  const next = grid.map((cell) => ({ ...cell }));
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    const cell = next[i];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.around === 0 && !cell.mine) {
      for (const n of neighbours(i, cols, rows)) {
        if (!next[n].revealed) stack.push(n);
      }
    }
  }
  return next;
}

const NUMBER_COLORS = ['', '#4C8DF6', '#2FA36B', '#E0525F', '#8E5BDB', '#D98324', '#00A7B5', '#B14AA0', '#7A7A8C'];

export default function Demineur({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const width = useBoardSize(32, 0.58);

  const [level, setLevel] = useState<Level>('facile');
  const { cols, rows, mines } = LEVELS[level];
  const cell = Math.floor(width / cols);

  const [grid, setGrid] = useState<Grid>(() => makeGrid(cols * rows));
  const [started, setStarted] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [state, setState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [record, setRecord] = useState(false);

  const seconds = useTimer(started && state === 'playing', level + String(started));

  const reset = useCallback(() => {
    setGrid(makeGrid(LEVELS[level].cols * LEVELS[level].rows));
    setStarted(false);
    setState('playing');
    setRecord(false);
    setFlagMode(false);
  }, [level]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [level, reset]);

  const flagsPlaced = useMemo(() => grid.filter((g) => g.flagged).length, [grid]);

  const checkWin = useCallback(
    (g: Grid) => {
      const safeLeft = g.filter((cell) => !cell.mine && !cell.revealed).length;
      if (safeLeft > 0) return false;
      setState('won');
      haptic('success');
      setRecord(submitScore(seconds));
      return true;
    },
    [haptic, submitScore, seconds],
  );

  const touch = (index: number) => {
    if (state !== 'playing') return;

    if (flagMode) {
      if (grid[index].revealed) return;
      haptic('light');
      setGrid((g) => g.map((cell, i) => (i === index ? { ...cell, flagged: !cell.flagged } : cell)));
      return;
    }

    if (grid[index].flagged) return;

    let working = grid;
    if (!started) {
      working = plantMines(grid, cols, rows, mines, index);
      setStarted(true);
    }

    if (working[index].mine) {
      haptic('error');
      setGrid(working.map((cell) => (cell.mine ? { ...cell, revealed: true } : cell)));
      setState('lost');
      return;
    }

    haptic('light');
    const revealed = revealFrom(working, index, cols, rows);
    setGrid(revealed);
    checkWin(revealed);
  };

  useFrameStatus(
    <Row gap={space.lg}>
      <Txt variant="label" tone="dim">
        💣 {mines - flagsPlaced}
      </Txt>
      <Txt variant="label" tone="dim">
        ⏱ {formatClock(seconds)}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: space.md, paddingTop: space.md }}>
      <View style={{ width: cell * cols }}>
        <Segmented<Level>
          value={level}
          onChange={setLevel}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'expert', label: 'Expert' },
          ]}
        />
      </View>

      <View
        style={{
          width: cell * cols,
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        {grid.map((cellData, i) => {
          const showNumber = cellData.revealed && !cellData.mine && cellData.around > 0;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={
                cellData.revealed
                  ? cellData.mine
                    ? 'Mine'
                    : `${cellData.around} mines autour`
                  : cellData.flagged
                    ? 'Case marquée'
                    : 'Case cachée'
              }
              onPress={() => touch(i)}
              style={{
                width: cell,
                height: cell,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 0.5,
                borderColor: c.bg,
                backgroundColor: cellData.revealed
                  ? cellData.mine
                    ? c.danger
                    : c.surface
                  : c.surfaceAlt,
              }}
            >
              <Txt
                style={{
                  fontSize: cell * 0.5,
                  fontWeight: '800',
                  color: showNumber ? NUMBER_COLORS[cellData.around] : c.text,
                }}
              >
                {cellData.revealed
                  ? cellData.mine
                    ? '💥'
                    : cellData.around > 0
                      ? String(cellData.around)
                      : ''
                  : cellData.flagged
                    ? '🚩'
                    : ''}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: flagMode }}
        onPress={() => {
          haptic('light');
          setFlagMode((f) => !f);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          borderRadius: radius.pill,
          backgroundColor: flagMode ? c.accent : c.surfaceAlt,
        }}
      >
        <Txt style={{ fontSize: 18 }}>{flagMode ? '🚩' : '⛏️'}</Txt>
        <Txt variant="label" style={{ color: flagMode ? c.onAccent : c.textDim }}>
          {flagMode ? 'Mode drapeau' : 'Mode pioche'}
        </Txt>
      </Pressable>

      <GameOver
        visible={state !== 'playing'}
        outcome={state === 'won' ? 'win' : 'loss'}
        title={state === 'won' ? 'Terrain déminé !' : 'Boum…'}
        detail={state === 'won' ? undefined : 'Tu es tombé sur une mine.'}
        score={state === 'won' ? formatClock(seconds) : undefined}
        scoreLabel="Temps"
        best={best !== undefined ? formatClock(best) : undefined}
        isRecord={record}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
