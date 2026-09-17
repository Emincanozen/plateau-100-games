import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'taquin',
  name: 'Taquin',
  tagline: 'Remets les tuiles dans l’ordre en les faisant glisser.',
  category: 'logique',
  emoji: '🔢',
  difficulty: 2,
  players: '1',
  minutes: 6,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['puzzle', 'solo', 'classique'],
  rules: [
    'Une seule case est vide : touche une tuile voisine pour l’y faire glisser.',
    'Le but est de ranger les nombres dans l’ordre, la case vide en bas à droite.',
    'Le mélange est toujours résoluble : il n’y a pas de position piégée.',
    'Ton record est le plus petit nombre de coups.',
  ],
};

type Size = 3 | 4 | 5;

const solvedBoard = (n: number): number[] => [...Array.from({ length: n * n - 1 }, (_, i) => i + 1), 0];

/** Melange par coups legaux : la position obtenue est donc toujours resoluble. */
function scramble(n: number): number[] {
  let board = solvedBoard(n);
  let blank = n * n - 1;
  let previous = -1;

  for (let i = 0; i < n * n * 40; i++) {
    const moves = neighboursOf(blank, n).filter((m) => m !== previous);
    const target = moves[randInt(moves.length)];
    board = swap(board, blank, target);
    previous = blank;
    blank = target;
  }
  // Un melange peut retomber sur la position resolue : on recommence.
  return board.every((v, i) => v === solvedBoard(n)[i]) ? scramble(n) : board;
}

function neighboursOf(index: number, n: number): number[] {
  const row = Math.floor(index / n);
  const col = index % n;
  const out: number[] = [];
  if (row > 0) out.push(index - n);
  if (row < n - 1) out.push(index + n);
  if (col > 0) out.push(index - 1);
  if (col < n - 1) out.push(index + 1);
  return out;
}

function swap(board: number[], a: number, b: number): number[] {
  const next = board.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export default function Taquin({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const width = useBoardSize(40, 0.55);

  const [size, setSize] = useState<Size>(3);
  const [board, setBoard] = useState<number[]>(() => scramble(3));
  const [moves, setMoves] = useState(0);
  const [record, setRecord] = useState(false);
  const [scored, setScored] = useState(false);

  const gap = 6;
  const cell = Math.floor((width - gap * (size + 1)) / size);

  const solved = useMemo(() => {
    const target = solvedBoard(size);
    return board.length === target.length && board.every((v, i) => v === target[i]);
  }, [board, size]);

  const seconds = useTimer(!solved, `${size}-${moves === 0}`);

  const reset = useCallback(() => {
    setBoard(scramble(size));
    setMoves(0);
    setRecord(false);
    setScored(false);
  }, [size]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [size, reset]);

  useEffect(() => {
    if (!solved || scored || moves === 0) return;
    setScored(true);
    haptic('success');
    setRecord(submitScore(moves));
  }, [solved, scored, moves, haptic, submitScore]);

  const slide = (index: number) => {
    if (solved) return;
    const blank = board.indexOf(0);
    if (!neighboursOf(blank, size).includes(index)) return;
    haptic('light');
    setBoard((b) => swap(b, blank, index));
    setMoves((m) => m + 1);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {moves} coups
      </Txt>
      <Txt variant="label" tone="faint">
        {formatClock(seconds)}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ width: size * (cell + gap) + gap }}>
        <Segmented<Size>
          value={size}
          onChange={setSize}
          options={[
            { value: 3, label: '3 × 3' },
            { value: 4, label: '4 × 4' },
            { value: 5, label: '5 × 5' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View
        style={{
          width: size * (cell + gap) + gap,
          padding: gap,
          backgroundColor: c.surfaceAlt,
          borderRadius: radius.lg,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap,
        }}
      >
        {board.map((value, i) => {
          if (value === 0) return <View key={i} style={{ width: cell, height: cell }} />;
          const inPlace = value === i + 1;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Tuile ${value}`}
              onPress={() => slide(i)}
              style={({ pressed }) => ({
                width: cell,
                height: cell,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? c.surfacePressed : inPlace ? '#34B37E22' : c.surface,
              })}
            >
              <Txt
                style={{
                  fontSize: cell * 0.38,
                  fontWeight: '800',
                  color: inPlace ? '#34B37E' : c.text,
                }}
              >
                {value}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <GameOver
        visible={solved && moves > 0}
        outcome="win"
        title="Taquin résolu !"
        score={moves}
        scoreLabel="Coups"
        best={best}
        isRecord={record}
        detail={`En ${formatClock(seconds)}`}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
