import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { BoutonControle, Row, Txt, GameOver, useClavier } from '@/ui';
import { useInterval } from '../lib/hooks';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'tetris',
  name: 'Briques',
  tagline: 'Emboîte les pièces qui tombent et fais disparaître les lignes.',
  category: 'arcade',
  emoji: '🧱',
  difficulty: 2,
  players: '1',
  minutes: 10,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['culte', 'réflexe', 'solo'],
  rules: [
    'Touche à gauche ou à droite de la pièce pour la déplacer, touche-la pour la faire pivoter.',
    'Balaie vers le bas pour la précipiter au sol.',
    'Une ligne entièrement remplie disparaît et rapporte des points.',
    'Quatre lignes d’un coup rapportent beaucoup plus. La partie s’arrête quand la pile atteint le haut.',
  ],
};

const COLS = 10;
const ROWS = 18;

type Shape = number[][];

interface Piece {
  shape: Shape;
  color: string;
  x: number;
  y: number;
}

const PIECES: { shape: Shape; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: '#4BC4D6' }, // I
  {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: '#EFB93B',
  }, // O
  {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: '#A96CF0',
  }, // T
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: '#34B37E',
  }, // S
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: '#E0525F',
  }, // Z
  {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: '#5B8DEF',
  }, // J
  {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: '#F0A030',
  }, // L
];

type Grid = (string | null)[][];

const emptyGrid = (): Grid => Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));

function rotate(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  return Array.from({ length: cols }, (_, x) =>
    Array.from({ length: rows }, (_, y) => shape[rows - 1 - y][x]),
  );
}

function newPiece(): Piece {
  const model = PIECES[randInt(PIECES.length)];
  return {
    shape: model.shape,
    color: model.color,
    x: Math.floor((COLS - model.shape[0].length) / 2),
    y: 0,
  };
}

function collides(grid: Grid, piece: Piece, dx = 0, dy = 0, shape?: Shape): boolean {
  const form = shape ?? piece.shape;
  for (let y = 0; y < form.length; y++) {
    for (let x = 0; x < form[y].length; x++) {
      if (!form[y][x]) continue;
      const nx = piece.x + x + dx;
      const ny = piece.y + y + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && grid[ny][nx]) return true;
    }
  }
  return false;
}

function merge(grid: Grid, piece: Piece): Grid {
  const next = grid.map((row) => row.slice());
  piece.shape.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (!filled) return;
      const ny = piece.y + y;
      const nx = piece.x + x;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) next[ny][nx] = piece.color;
    });
  });
  return next;
}

const LINE_POINTS = [0, 100, 300, 500, 800];

function clearLines(grid: Grid): { grid: Grid; cleared: number } {
  const kept = grid.filter((row) => row.some((cell) => cell === null));
  const cleared = ROWS - kept.length;
  if (cleared === 0) return { grid, cleared };
  const fresh = Array.from({ length: cleared }, () => Array<string | null>(COLS).fill(null));
  return { grid: [...fresh, ...kept], cleared };
}

export default function Tetris({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const cell = 18;

  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [piece, setPiece] = useState<Piece>(newPiece);
  const [nextPiece, setNextPiece] = useState<Piece>(newPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [record, setRecord] = useState(false);

  const gridRef = useRef<Grid>(grid);
  const pieceRef = useRef<Piece>(piece);
  const nextRef = useRef<Piece>(nextPiece);
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const overRef = useRef(false);

  const reset = useCallback(() => {
    const first = newPiece();
    const second = newPiece();
    gridRef.current = emptyGrid();
    pieceRef.current = first;
    nextRef.current = second;
    scoreRef.current = 0;
    linesRef.current = 0;
    overRef.current = false;
    setGrid(gridRef.current);
    setPiece(first);
    setNextPiece(second);
    setScore(0);
    setLines(0);
    setLevel(1);
    setOver(false);
    setRecord(false);
  }, []);

  useFrameRestart(reset);

  /** Fixe la piece au sol, nettoie les lignes et sort la suivante. */
  const lockPiece = useCallback(() => {
    const merged = merge(gridRef.current, pieceRef.current);
    const { grid: cleaned, cleared } = clearLines(merged);
    gridRef.current = cleaned;
    setGrid(cleaned);

    if (cleared > 0) {
      haptic(cleared >= 4 ? 'success' : 'medium');
      linesRef.current += cleared;
      scoreRef.current += LINE_POINTS[cleared] * Math.max(1, Math.floor(linesRef.current / 10) + 1);
      setLines(linesRef.current);
      setScore(scoreRef.current);
      setLevel(Math.floor(linesRef.current / 10) + 1);
    }

    const upcoming = nextRef.current;
    const following = newPiece();
    if (collides(cleaned, upcoming)) {
      overRef.current = true;
      setOver(true);
      haptic('error');
      setRecord(submitScore(scoreRef.current));
      return;
    }
    pieceRef.current = upcoming;
    nextRef.current = following;
    setPiece(upcoming);
    setNextPiece(following);
  }, [haptic, submitScore]);

  const stepDown = useCallback(() => {
    if (overRef.current) return;
    if (collides(gridRef.current, pieceRef.current, 0, 1)) {
      lockPiece();
      return;
    }
    const moved = { ...pieceRef.current, y: pieceRef.current.y + 1 };
    pieceRef.current = moved;
    setPiece(moved);
  }, [lockPiece]);

  useInterval(stepDown, over ? null : Math.max(150, 720 - level * 55));

  /** Descente commandee par le joueur : elle rapporte un point par case. */
  const descendre = useCallback(() => {
    if (overRef.current) return;
    if (collides(gridRef.current, pieceRef.current, 0, 1)) {
      lockPiece();
      return;
    }
    const moved = { ...pieceRef.current, y: pieceRef.current.y + 1 };
    pieceRef.current = moved;
    scoreRef.current += 1;
    setScore(scoreRef.current);
    setPiece(moved);
  }, [lockPiece]);

  const shift = useCallback(
    (dx: number) => {
      if (overRef.current) return;
      if (collides(gridRef.current, pieceRef.current, dx, 0)) return;
      haptic('light');
      const moved = { ...pieceRef.current, x: pieceRef.current.x + dx };
      pieceRef.current = moved;
      setPiece(moved);
    },
    [haptic],
  );

  const spin = useCallback(() => {
    if (overRef.current) return;
    const turned = rotate(pieceRef.current.shape);
    // Repousse la piece si la rotation la fait mordre sur un bord.
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!collides(gridRef.current, pieceRef.current, dx, 0, turned)) {
        haptic('light');
        const moved = { ...pieceRef.current, shape: turned, x: pieceRef.current.x + dx };
        pieceRef.current = moved;
        setPiece(moved);
        return;
      }
    }
  }, [haptic]);

  const drop = useCallback(() => {
    if (overRef.current) return;
    let fallen = 0;
    while (!collides(gridRef.current, pieceRef.current, 0, fallen + 1)) fallen++;
    if (fallen > 0) {
      const moved = { ...pieceRef.current, y: pieceRef.current.y + fallen };
      pieceRef.current = moved;
      scoreRef.current += fallen * 2;
      setScore(scoreRef.current);
      setPiece(moved);
    }
    haptic('heavy');
    lockPiece();
  }, [haptic, lockPiece]);

  const swipeDown = useMemo(
    () =>
      Gesture.Fling()
        .direction(8)
        .runOnJS(true)
        .onStart(() => drop()),
    [drop],
  );

  useClavier(
    {
      ArrowLeft: () => shift(-1),
      ArrowRight: () => shift(1),
      ArrowDown: descendre,
      ArrowUp: spin,
      Space: drop,
      KeyQ: () => shift(-1),
      KeyD: () => shift(1),
      KeyS: descendre,
      KeyZ: spin,
    },
    !over,
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Score <Txt variant="label">{score}</Txt>
      </Txt>
      <Txt variant="label" tone="faint">
        Niv. {level}
      </Txt>
      <Txt variant="label" tone="faint">
        {lines} lignes
      </Txt>
    </Row>,
  );

  // Superposition de la piece courante sur la grille figee, pour l'affichage.
  const view = useMemo(() => {
    const copy = grid.map((row) => row.slice());
    piece.shape.forEach((row, y) => {
      row.forEach((filled, x) => {
        if (!filled) return;
        const ny = piece.y + y;
        const nx = piece.x + x;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) copy[ny][nx] = piece.color;
      });
    });
    return copy;
  }, [grid, piece]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <Row gap={space.lg} align="flex-start">
        <GestureDetector gesture={swipeDown}>
          <View
            style={{
              width: cell * COLS,
              height: cell * ROWS,
              backgroundColor: c.surfaceAlt,
              borderRadius: radius.sm,
              overflow: 'hidden',
            }}
          >
            {view.map((row, y) => (
              <View key={y} style={{ flexDirection: 'row' }}>
                {row.map((color, x) => (
                  <View
                    key={x}
                    style={{
                      width: cell,
                      height: cell,
                      padding: 1,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 3,
                        backgroundColor: color ?? c.surface,
                      }}
                    />
                  </View>
                ))}
              </View>
            ))}

          </View>
        </GestureDetector>

        <View style={{ gap: space.sm, alignItems: 'center' }}>
          <Txt variant="caption" tone="faint">
            SUIVANTE
          </Txt>
          <View
            style={{
              width: cell * 4,
              height: cell * 2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View>
              {nextPiece.shape.map((row, y) => (
                <View key={y} style={{ flexDirection: 'row' }}>
                  {row.map((filled, x) => (
                    <View key={x} style={{ width: cell * 0.8, height: cell * 0.8, padding: 1 }}>
                      <View
                        style={{
                          flex: 1,
                          borderRadius: 2,
                          backgroundColor: filled ? nextPiece.color : 'transparent',
                        }}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
          {best !== undefined ? (
            <View style={{ alignItems: 'center', marginTop: space.md }}>
              <Txt variant="caption" tone="faint">
                RECORD
              </Txt>
              <Txt variant="label">{best}</Txt>
            </View>
          ) : null}
        </View>
      </Row>

      <Row gap={10} style={{ justifyContent: 'center' }}>
        <BoutonControle glyphe="◀" label="Déplacer à gauche" repeter onPress={() => shift(-1)} />
        <BoutonControle glyphe="▼" label="Descendre" repeter onPress={descendre} />
        <BoutonControle glyphe="▶" label="Déplacer à droite" repeter onPress={() => shift(1)} />
        <BoutonControle glyphe="↻" label="Pivoter" tint="#F0A030" onPress={spin} />
        <BoutonControle glyphe="⤓" label="Lâcher la pièce" onPress={drop} />
      </Row>

      <Txt variant="caption" tone="faint" center>
        Flèches du clavier ou boutons · espace pour lâcher
      </Txt>

      <GameOver
        visible={over}
        outcome="over"
        title="La pile a débordé"
        score={score}
        best={best}
        isRecord={record}
        accent="#F0A030"
        detail={`${lines} lignes · niveau ${level}`}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
