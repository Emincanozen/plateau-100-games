import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Txt, GameOver } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { clamp } from '../lib/rng';

export const meta: GameMeta = {
  id: 'casse-briques',
  name: 'Casse-briques',
  tagline: 'Renvoie la balle et pulvérise le mur, sans la laisser tomber.',
  category: 'arcade',
  emoji: '🧱',
  difficulty: 2,
  players: '1',
  minutes: 5,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['culte', 'réflexe', 'solo'],
  rules: [
    'Fais glisser ton doigt pour déplacer la raquette sous la balle.',
    'Chaque brique touchée éclate et rapporte des points — les rangées du haut valent plus cher.',
    'Le mur est percé de trous : glisse la balle derrière pour qu’elle ricoche et fasse le ménage.',
    'Le point d’impact sur la raquette change l’angle de rebond. Tu as trois balles.',
  ],
};

const COLS = 11;
const BRICK_ROWS = 8;
const ROW_COLORS = ['#E0525F', '#EE7A4C', '#F0A030', '#EFB93B', '#8FCB52', '#34B37E', '#4BC4D6', '#7C9CF0'];

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Eclat {
  x: number;
  y: number;
  couleur: string;
  ne: number;
}

const DUREE_ECLAT = 260;

/**
 * Mur troue : environ une brique sur sept manque, ce qui ouvre des couloirs.
 * La rangee du haut reste pleine pour que le mur garde sa silhouette.
 */
function construireMur(): boolean[] {
  const mur: boolean[] = [];
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const bordure = row === 0;
      mur.push(bordure ? true : Math.random() > 0.14);
    }
  }
  return mur;
}

export default function CasseBriques({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 32, 420);
  const H = Math.min(winHeight * 0.62, 560);
  const BALL_R = 6;
  const PADDLE_W = Math.max(72, W * 0.26);
  const PADDLE_H = 12;
  const PADDLE_Y = H - 34;
  const BRICK_W = W / COLS;
  const BRICK_H = 15;
  const BRICK_TOP = 36;

  const [bricks, setBricks] = useState<boolean[]>(construireMur);
  const [score, setScore] = useState(0);
  const [balls, setBalls] = useState(3);
  const [level, setLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [record, setRecord] = useState(false);
  const [, forceRender] = useState(0);

  // Balle volontairement plus lente qu'a l'origine : le mur est plus fin,
  // il faut pouvoir suivre les ricochets.
  const baseSpeed = useCallback(() => H / 210, [H]);

  const ballRef = useRef<Ball>({ x: W / 2, y: PADDLE_Y - 30, vx: 2, vy: -2 });
  const paddleRef = useRef(W / 2);
  const bricksRef = useRef<boolean[]>([]);
  const eclatsRef = useRef<Eclat[]>([]);
  const scoreRef = useRef(0);
  const ballsRef = useRef(3);
  const levelRef = useRef(1);
  const runningRef = useRef(true);

  const launch = useCallback(
    (speedUp = 1) => {
      const s = baseSpeed() * speedUp;
      ballRef.current = {
        x: paddleRef.current,
        y: PADDLE_Y - 30,
        vx: s * (Math.random() < 0.5 ? -1 : 1),
        vy: -s,
      };
    },
    [PADDLE_Y, baseSpeed],
  );

  const reset = useCallback(() => {
    bricksRef.current = construireMur();
    eclatsRef.current = [];
    scoreRef.current = 0;
    ballsRef.current = 3;
    levelRef.current = 1;
    runningRef.current = true;
    paddleRef.current = W / 2;
    setBricks(bricksRef.current);
    setScore(0);
    setBalls(3);
    setLevel(1);
    setOver(false);
    setWon(false);
    setRecord(false);
    launch();
  }, [W, launch]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  const endGame = useCallback(
    (victory: boolean) => {
      runningRef.current = false;
      setOver(true);
      setWon(victory);
      haptic(victory ? 'success' : 'error');
      setRecord(submitScore(scoreRef.current));
    },
    [haptic, submitScore],
  );

  const casser = useCallback(
    (index: number, row: number, x: number, y: number) => {
      bricksRef.current = bricksRef.current.map((alive, i) => (i === index ? false : alive));
      setBricks(bricksRef.current);
      eclatsRef.current = [
        ...eclatsRef.current.slice(-14),
        { x, y, couleur: ROW_COLORS[row % ROW_COLORS.length], ne: Date.now() },
      ];
      scoreRef.current += (BRICK_ROWS - row) * 5;
      setScore(scoreRef.current);
      haptic('medium');
    },
    [haptic],
  );

  const step = useCallback(() => {
    if (!runningRef.current) return;
    const ball = ballRef.current;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Murs
    if (ball.x < BALL_R) {
      ball.x = BALL_R;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x > W - BALL_R) {
      ball.x = W - BALL_R;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y < BALL_R) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
    }

    // Raquette
    const paddleLeft = paddleRef.current - PADDLE_W / 2;
    if (
      ball.vy > 0 &&
      ball.y + BALL_R >= PADDLE_Y &&
      ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 10 &&
      ball.x >= paddleLeft &&
      ball.x <= paddleLeft + PADDLE_W
    ) {
      // L'angle depend de l'endroit touche : -1 a gauche, +1 a droite.
      const offset = (ball.x - paddleRef.current) / (PADDLE_W / 2);
      const speed = Math.hypot(ball.vx, ball.vy);
      const angle = offset * 1.05; // ~60 degres au maximum
      ball.vx = speed * Math.sin(angle);
      ball.vy = -Math.abs(speed * Math.cos(angle));
      ball.y = PADDLE_Y - BALL_R;
      haptic('light');
    }

    // Briques : on teste le point de la balle qui avance, ce qui permet
    // de traverser un trou sans declencher de collision parasite.
    const hautMur = BRICK_TOP;
    const basMur = BRICK_TOP + BRICK_ROWS * BRICK_H;
    if (ball.y + BALL_R > hautMur && ball.y - BALL_R < basMur) {
      const sondes: [number, number][] = [
        [ball.x, ball.y - BALL_R],
        [ball.x, ball.y + BALL_R],
        [ball.x - BALL_R, ball.y],
        [ball.x + BALL_R, ball.y],
      ];

      for (const [sx, sy] of sondes) {
        const col = Math.floor(sx / BRICK_W);
        const row = Math.floor((sy - BRICK_TOP) / BRICK_H);
        if (col < 0 || col >= COLS || row < 0 || row >= BRICK_ROWS) continue;
        const index = row * COLS + col;
        if (!bricksRef.current[index]) continue;

        casser(index, row, col * BRICK_W + BRICK_W / 2, BRICK_TOP + row * BRICK_H + BRICK_H / 2);
        // Rebond selon le cote touche.
        if (sy === ball.y) ball.vx = -ball.vx;
        else ball.vy = -ball.vy;
        break;
      }

      if (bricksRef.current.every((alive) => !alive)) {
        levelRef.current += 1;
        setLevel(levelRef.current);
        bricksRef.current = construireMur();
        setBricks(bricksRef.current);
        launch(1 + levelRef.current * 0.1);
        haptic('success');
      }
    }

    // Balle perdue
    if (ball.y > H + 20) {
      ballsRef.current -= 1;
      setBalls(ballsRef.current);
      haptic('error');
      if (ballsRef.current <= 0) {
        endGame(false);
        return;
      }
      launch(1 + (levelRef.current - 1) * 0.1);
    }

    // Purge des eclats expires.
    const maintenant = Date.now();
    if (eclatsRef.current.some((e) => maintenant - e.ne > DUREE_ECLAT)) {
      eclatsRef.current = eclatsRef.current.filter((e) => maintenant - e.ne <= DUREE_ECLAT);
    }

    forceRender((n) => (n + 1) % 1000);
  }, [W, H, BALL_R, PADDLE_W, PADDLE_Y, PADDLE_H, BRICK_W, BRICK_H, BRICK_TOP, haptic, launch, endGame, casser]);

  useRafLoop(step, !over);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          paddleRef.current = clamp(e.x, PADDLE_W / 2, W - PADDLE_W / 2);
        }),
    [PADDLE_W, W],
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
        {'●'.repeat(Math.max(0, balls))}
      </Txt>
    </Row>,
  );

  const ball = ballRef.current;
  const maintenant = Date.now();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <GestureDetector gesture={pan}>
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {bricks.map((alive, i) => {
            if (!alive) return null;
            const row = Math.floor(i / COLS);
            const col = i % COLS;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: col * BRICK_W + 1,
                  top: BRICK_TOP + row * BRICK_H + 1,
                  width: BRICK_W - 2,
                  height: BRICK_H - 2,
                  borderRadius: 3,
                  backgroundColor: ROW_COLORS[row % ROW_COLORS.length],
                }}
              />
            );
          })}

          {/* Éclats : un flash qui grossit et s'efface là où la brique a sauté. */}
          {eclatsRef.current.map((eclat, i) => {
            const age = (maintenant - eclat.ne) / DUREE_ECLAT;
            if (age > 1) return null;
            const taille = BRICK_W * (0.5 + age * 1.1);
            return (
              <View
                key={`${eclat.ne}-${i}`}
                style={{
                  position: 'absolute',
                  left: eclat.x - taille / 2,
                  top: eclat.y - taille / 2,
                  width: taille,
                  height: taille,
                  borderRadius: taille / 2,
                  borderWidth: 2,
                  borderColor: eclat.couleur,
                  opacity: 1 - age,
                }}
              />
            );
          })}

          <View
            style={{
              position: 'absolute',
              left: ball.x - BALL_R,
              top: ball.y - BALL_R,
              width: BALL_R * 2,
              height: BALL_R * 2,
              borderRadius: BALL_R,
              backgroundColor: c.text,
            }}
          />

          <View
            style={{
              position: 'absolute',
              left: paddleRef.current - PADDLE_W / 2,
              top: PADDLE_Y,
              width: PADDLE_W,
              height: PADDLE_H,
              borderRadius: PADDLE_H / 2,
              backgroundColor: c.accent,
            }}
          />
        </View>
      </GestureDetector>

      <Txt variant="caption" tone="faint">
        Glisse ton doigt pour déplacer la raquette
      </Txt>

      <GameOver
        visible={over}
        outcome={won ? 'win' : 'over'}
        title={won ? 'Mur pulvérisé !' : 'Plus de balles'}
        score={score}
        best={best}
        isRecord={record}
        detail={`Niveau ${level}`}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
