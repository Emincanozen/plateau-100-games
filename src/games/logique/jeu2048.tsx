import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { CroixDirectionnelle, Row, Txt, GameOver, useClavier, type Direction } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: '2048',
  name: '2048',
  tagline: 'Fais glisser, fusionne, atteins la tuile 2048.',
  category: 'logique',
  emoji: '🔢',
  difficulty: 2,
  players: '1',
  minutes: 8,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['puzzle', 'solo', 'addictif'],
  rules: [
    'Balaie l’écran, touche les flèches ou joue au clavier : toutes les tuiles glissent de ce côté.',
    'Deux tuiles identiques qui se rencontrent fusionnent et leur valeur double.',
    'Chaque fusion ajoute la valeur obtenue à ton score.',
    'Une nouvelle tuile apparaît après chaque mouvement. La partie s’arrête quand plus aucun mouvement n’est possible.',
  ],
};

const SIZE = 4;
type Board = number[]; // 0 = case vide

const emptyBoard = (): Board => Array(SIZE * SIZE).fill(0);

function spawn(board: Board): Board {
  const free = board.reduce<number[]>((acc, v, i) => (v === 0 ? [...acc, i] : acc), []);
  if (free.length === 0) return board;
  const next = board.slice();
  next[free[randInt(free.length)]] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function newBoard(): Board {
  return spawn(spawn(emptyBoard()));
}

/** Compacte puis fusionne une ligne vers la gauche. Renvoie la ligne et les points gagnes. */
function slideRow(row: number[]): { row: number[]; gained: number } {
  const values = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const merged = values[i] * 2;
      out.push(merged);
      gained += merged;
      i++; // la tuile fusionnee ne peut pas fusionner a nouveau ce tour-ci
    } else {
      out.push(values[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { row: out, gained };
}

type Dir = 'left' | 'right' | 'up' | 'down';

/** Extrait les 4 lignes a traiter selon la direction, deja orientees « vers la gauche ». */
function linesFor(board: Board, dir: Dir): number[][] {
  const lines: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    const line: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      switch (dir) {
        case 'left':
          line.push(board[i * SIZE + j]);
          break;
        case 'right':
          line.push(board[i * SIZE + (SIZE - 1 - j)]);
          break;
        case 'up':
          line.push(board[j * SIZE + i]);
          break;
        case 'down':
          line.push(board[(SIZE - 1 - j) * SIZE + i]);
          break;
      }
    }
    lines.push(line);
  }
  return lines;
}

function writeLines(lines: number[][], dir: Dir): Board {
  const board = emptyBoard();
  lines.forEach((line, i) => {
    line.forEach((value, j) => {
      switch (dir) {
        case 'left':
          board[i * SIZE + j] = value;
          break;
        case 'right':
          board[i * SIZE + (SIZE - 1 - j)] = value;
          break;
        case 'up':
          board[j * SIZE + i] = value;
          break;
        case 'down':
          board[(SIZE - 1 - j) * SIZE + i] = value;
          break;
      }
    });
  });
  return board;
}

function move(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  let gained = 0;
  const lines = linesFor(board, dir).map((line) => {
    const res = slideRow(line);
    gained += res.gained;
    return res.row;
  });
  const next = writeLines(lines, dir);
  const moved = next.some((v, i) => v !== board[i]);
  return { board: next, gained, moved };
}

function hasMoves(board: Board): boolean {
  if (board.some((v) => v === 0)) return true;
  return (['left', 'up'] as Dir[]).some((d) => move(board, d).moved);
}

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  2: { bg: '#EEE4DA', fg: '#776E65' },
  4: { bg: '#EDE0C8', fg: '#776E65' },
  8: { bg: '#F2B179', fg: '#FFFFFF' },
  16: { bg: '#F59563', fg: '#FFFFFF' },
  32: { bg: '#F67C5F', fg: '#FFFFFF' },
  64: { bg: '#F65E3B', fg: '#FFFFFF' },
  128: { bg: '#EDCF72', fg: '#FFFFFF' },
  256: { bg: '#EDCC61', fg: '#FFFFFF' },
  512: { bg: '#EDC850', fg: '#FFFFFF' },
  1024: { bg: '#EDC53F', fg: '#FFFFFF' },
  2048: { bg: '#EDC22E', fg: '#FFFFFF' },
};

export default function Jeu2048({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const size = useBoardSize(40, 0.52);
  const gap = 8;
  const cell = Math.floor((size - gap * (SIZE + 1)) / SIZE);

  const [board, setBoard] = useState<Board>(newBoard);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [reached2048, setReached2048] = useState(false);
  const [record, setRecord] = useState(false);
  const scoreRef = useRef(0);

  const reset = useCallback(() => {
    setBoard(newBoard());
    setScore(0);
    scoreRef.current = 0;
    setOver(false);
    setReached2048(false);
    setRecord(false);
  }, []);

  useFrameRestart(reset);

  const apply = useCallback(
    (dir: Dir) => {
      if (over) return;
      setBoard((prev) => {
        const res = move(prev, dir);
        if (!res.moved) return prev;
        haptic('light');
        if (res.gained > 0) {
          scoreRef.current += res.gained;
          setScore(scoreRef.current);
        }
        if (!reached2048 && res.board.some((v) => v >= 2048)) {
          setReached2048(true);
          haptic('success');
        }
        const withNew = spawn(res.board);
        if (!hasMoves(withNew)) {
          setOver(true);
          haptic('error');
          setRecord(submitScore(scoreRef.current));
        }
        return withNew;
      });
    },
    [over, reached2048, haptic, submitScore],
  );

  const fling = useMemo(() => {
    const make = (dir: Dir, direction: number) =>
      Gesture.Fling().direction(direction).runOnJS(true).onStart(() => apply(dir));
    // Directions issues de react-native-gesture-handler : 1=droite, 2=gauche, 4=haut, 8=bas
    return Gesture.Race(make('right', 1), make('left', 2), make('up', 4), make('down', 8));
  }, [apply]);

  // Le balayage ne suffit pas : sur le web il n'y a rien à balayer, et un
  // lecteur d'écran n'a aucune cible. D'où le clavier et la croix, comme au
  // Snake.
  useClavier({
    ArrowLeft: () => apply('left'),
    ArrowRight: () => apply('right'),
    ArrowUp: () => apply('up'),
    ArrowDown: () => apply('down'),
    KeyQ: () => apply('left'),
    KeyD: () => apply('right'),
    KeyZ: () => apply('up'),
    KeyS: () => apply('down'),
  });

  const versDirection: Record<Direction, Dir> = {
    gauche: 'left',
    droite: 'right',
    haut: 'up',
    bas: 'down',
  };

  useFrameStatus(
    <Row gap={space.lg}>
      <Txt variant="label" tone="dim">
        Score <Txt variant="label">{score}</Txt>
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <GestureDetector gesture={fling}>
        <View
          style={{
            width: cell * SIZE + gap * (SIZE + 1),
            height: cell * SIZE + gap * (SIZE + 1),
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.lg,
            padding: gap,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap,
          }}
        >
          {board.map((value, i) => {
            const skin = TILE_COLORS[value];
            return (
              <View
                key={i}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: value === 0 ? c.surface : (skin?.bg ?? '#3C3A32'),
                }}
              >
                {value > 0 ? (
                  <Txt
                    style={{
                      fontSize: value >= 1024 ? cell * 0.3 : value >= 128 ? cell * 0.36 : cell * 0.42,
                      fontWeight: '800',
                      color: skin?.fg ?? '#FFFFFF',
                    }}
                  >
                    {value}
                  </Txt>
                ) : null}
              </View>
            );
          })}
        </View>
      </GestureDetector>

      <CroixDirectionnelle onDirection={(d) => apply(versDirection[d])} tint="#34B37E33" />

      <Txt variant="caption" tone="faint">
        Balaie la grille, touche les flèches, ou joue au clavier
      </Txt>

      <GameOver
        visible={over}
        outcome={reached2048 ? 'win' : 'over'}
        title={reached2048 ? '2048 atteint !' : 'Plus aucun mouvement'}
        score={score}
        best={best}
        isRecord={record}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
