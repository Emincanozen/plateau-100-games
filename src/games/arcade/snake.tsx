import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { CroixDirectionnelle, Row, Segmented, Txt, GameOver, useClavier, type Direction } from '@/ui';
import { useBoardSize, useInterval } from '../lib/hooks';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'snake',
  name: 'Snake',
  tagline: 'Mange, grandis, et ne te mords jamais la queue.',
  category: 'arcade',
  emoji: '🐍',
  difficulty: 1,
  players: '1',
  minutes: 4,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['réflexe', 'solo', 'culte'],
  rules: [
    'Balaie l’écran pour faire tourner le serpent. Il avance tout seul, sans jamais s’arrêter.',
    'Chaque pomme avalée allonge le serpent et rapporte des points.',
    'Toucher un mur ou ton propre corps met fin à la partie.',
    'Plus tu manges, plus le rythme s’accélère.',
  ],
};

const GRID = 17;
type Point = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';
type Speed = 'calme' | 'normal' | 'nerveux';

const TICK: Record<Speed, number> = { calme: 190, normal: 135, nerveux: 95 };

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const STEP: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const startSnake = (): Point[] => [
  { x: 8, y: 9 },
  { x: 8, y: 10 },
  { x: 8, y: 11 },
];

function spawnApple(snake: Point[]): Point {
  let apple: Point;
  do {
    apple = { x: randInt(GRID), y: randInt(GRID) };
  } while (snake.some((s) => s.x === apple.x && s.y === apple.y));
  return apple;
}

export default function Snake({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const size = useBoardSize(40, 0.55);
  const cell = Math.floor(size / GRID);

  const [speed, setSpeed] = useState<Speed>('normal');
  const [snake, setSnake] = useState<Point[]>(startSnake);
  const [apple, setApple] = useState<Point>(() => spawnApple(startSnake()));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [record, setRecord] = useState(false);

  // La logique de la boucle travaille sur des refs : l'etat React ne sert
  // qu'a l'affichage, ce qui evite tout effet de bord dans un updater.
  const snakeRef = useRef<Point[]>(snake);
  const appleRef = useRef<Point>(apple);
  const scoreRef = useRef(0);
  const dirRef = useRef<Dir>('up');
  // Le sens saisi n'est applique qu'au tick suivant : sinon deux balayages
  // tres rapproches peuvent retourner le serpent sur lui-meme.
  const pendingRef = useRef<Dir>('up');

  const reset = useCallback(() => {
    const fresh = startSnake();
    const freshApple = spawnApple(fresh);
    snakeRef.current = fresh;
    appleRef.current = freshApple;
    scoreRef.current = 0;
    dirRef.current = 'up';
    pendingRef.current = 'up';
    setSnake(fresh);
    setApple(freshApple);
    setScore(0);
    setOver(false);
    setRecord(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [speed, reset]);

  const turn = useCallback((dir: Dir) => {
    if (OPPOSITE[dir] === dirRef.current) return;
    pendingRef.current = dir;
  }, []);

  const tick = useCallback(() => {
    dirRef.current = pendingRef.current;
    const step = STEP[dirRef.current];
    const body = snakeRef.current;
    const head = { x: body[0].x + step.x, y: body[0].y + step.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    // La derniere case se libere pendant le deplacement : elle ne tue pas.
    const hitSelf = body.some((s, i) => i < body.length - 1 && s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      setOver(true);
      haptic('error');
      setRecord(submitScore(scoreRef.current));
      return;
    }

    const eats = head.x === appleRef.current.x && head.y === appleRef.current.y;
    const next = [head, ...body];
    if (eats) {
      haptic('success');
      scoreRef.current += 10;
      setScore(scoreRef.current);
      const freshApple = spawnApple(next);
      appleRef.current = freshApple;
      setApple(freshApple);
    } else {
      next.pop();
    }
    snakeRef.current = next;
    setSnake(next);
  }, [haptic, submitScore]);

  useInterval(tick, over ? null : Math.max(60, TICK[speed] - Math.floor(score / 60) * 6));

  const gesture = useMemo(() => {
    const make = (dir: Dir, direction: number) =>
      Gesture.Fling()
        .direction(direction)
        .runOnJS(true)
        .onStart(() => turn(dir));
    // Directions de react-native-gesture-handler : 1=droite, 2=gauche, 4=haut, 8=bas
    return Gesture.Race(make('right', 1), make('left', 2), make('up', 4), make('down', 8));
  }, [turn]);

  useClavier(
    {
      ArrowUp: () => turn('up'),
      ArrowDown: () => turn('down'),
      ArrowLeft: () => turn('left'),
      ArrowRight: () => turn('right'),
      KeyZ: () => turn('up'),
      KeyS: () => turn('down'),
      KeyQ: () => turn('left'),
      KeyD: () => turn('right'),
    },
    !over,
  );

  const versDirection: Record<Direction, Dir> = {
    haut: 'up',
    bas: 'down',
    gauche: 'left',
    droite: 'right',
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
      <View style={{ width: cell * GRID }}>
        <Segmented<Speed>
          value={speed}
          onChange={setSpeed}
          options={[
            { value: 'calme', label: 'Calme' },
            { value: 'normal', label: 'Normal' },
            { value: 'nerveux', label: 'Nerveux' },
          ]}
          accent="#F0A030"
        />
      </View>

      <GestureDetector gesture={gesture}>
        <View
          style={{
            width: cell * GRID,
            height: cell * GRID,
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: apple.x * cell,
              top: apple.y * cell,
              width: cell,
              height: cell,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ fontSize: cell * 0.8 }}>🍎</Txt>
          </View>

          {snake.map((part, i) => (
            <View
              key={`${part.x}-${part.y}-${i}`}
              style={{
                position: 'absolute',
                left: part.x * cell,
                top: part.y * cell,
                width: cell,
                height: cell,
                padding: 1,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: i === 0 ? cell * 0.35 : cell * 0.22,
                  backgroundColor: i === 0 ? '#F0A030' : '#3DD39A',
                  opacity: i === 0 ? 1 : Math.max(0.45, 1 - i / (snake.length + 6)),
                }}
              />
            </View>
          ))}
        </View>
      </GestureDetector>

      <CroixDirectionnelle onDirection={(d) => turn(versDirection[d])} tint="#F0A03033" />

      <Txt variant="caption" tone="faint" center>
        Boutons, flèches du clavier ou balayage sur la grille
      </Txt>

      <GameOver
        visible={over}
        outcome="over"
        title="Le serpent s’arrête là"
        score={score}
        best={best}
        isRecord={record}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
