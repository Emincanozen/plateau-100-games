import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { clamp } from '../lib/rng';

export const meta: GameMeta = {
  id: 'squash',
  name: 'Squash',
  tagline: 'Un mur, une raquette, et une balle qui accélère sans arrêt.',
  category: 'arcade',
  emoji: '🎾',
  difficulty: 2,
  players: '1',
  minutes: 4,
  score: 'high',
  scoreUnit: 'échanges',
  tags: ['réflexe', 'solo', 'endurance'],
  rules: [
    'La balle rebondit sur le mur du haut et sur les côtés. À toi de la renvoyer en bas.',
    'Chaque renvoi compte un échange et accélère légèrement la balle.',
    'Le point d’impact sur la raquette change l’angle : les bords renvoient très ouvert.',
    'La raquette rétrécit tous les dix échanges. Une balle manquée et c’est fini.',
  ],
};

type Niveau = 'souple' | 'normal' | 'nerveux';

const REGLAGES: Record<Niveau, { depart: number; acceleration: number }> = {
  souple: { depart: 3.2, acceleration: 0.035 },
  normal: { depart: 4.1, acceleration: 0.055 },
  nerveux: { depart: 5.2, acceleration: 0.08 },
};

export default function Squash({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 400);
  const H = Math.min(winHeight * 0.62, 560);
  const R = 8;
  const RAQUETTE_H = 12;
  const RAQUETTE_Y = H - 30;

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const reglage = REGLAGES[niveau];

  const [echanges, setEchanges] = useState(0);
  const [over, setOver] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const largeurRaquette = useRef(Math.max(60, W * 0.3));
  const raquette = useRef(W / 2);
  const balle = useRef({ x: W / 2, y: H / 2, vx: 2, vy: -3 });
  const echangesRef = useRef(0);
  const vivant = useRef(true);

  const reset = useCallback(() => {
    largeurRaquette.current = Math.max(60, W * 0.3);
    raquette.current = W / 2;
    const v = reglage.depart;
    balle.current = { x: W / 2, y: H * 0.4, vx: v * 0.5, vy: v };
    echangesRef.current = 0;
    vivant.current = true;
    setEchanges(0);
    setOver(false);
    setRecord(false);
  }, [W, H, reglage]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, reset]);

  const pas = useCallback(() => {
    if (!vivant.current) return;
    const b = balle.current;
    b.x += b.vx;
    b.y += b.vy;

    // Murs latéraux et mur du fond.
    if (b.x < R) {
      b.x = R;
      b.vx = Math.abs(b.vx);
      haptic('light');
    } else if (b.x > W - R) {
      b.x = W - R;
      b.vx = -Math.abs(b.vx);
      haptic('light');
    }
    if (b.y < R) {
      b.y = R;
      b.vy = Math.abs(b.vy);
      haptic('light');
    }

    // Raquette.
    const largeur = largeurRaquette.current;
    const gauche = raquette.current - largeur / 2;
    if (
      b.vy > 0 &&
      b.y + R >= RAQUETTE_Y &&
      b.y + R <= RAQUETTE_Y + RAQUETTE_H + 12 &&
      b.x >= gauche &&
      b.x <= gauche + largeur
    ) {
      const offset = (b.x - raquette.current) / (largeur / 2);
      const vitesse = Math.hypot(b.vx, b.vy) + reglage.acceleration;
      const angle = offset * 1.1;
      b.vx = vitesse * Math.sin(angle);
      b.vy = -Math.abs(vitesse * Math.cos(angle));
      b.y = RAQUETTE_Y - R;

      echangesRef.current += 1;
      setEchanges(echangesRef.current);
      haptic('medium');

      // La raquette rétrécit par paliers : la difficulté monte d'elle-même.
      if (echangesRef.current % 10 === 0) {
        largeurRaquette.current = Math.max(34, largeurRaquette.current * 0.88);
        haptic('warning');
      }
    }

    if (b.y > H + 20) {
      vivant.current = false;
      setOver(true);
      haptic('error');
      setRecord(submitScore(echangesRef.current));
      return;
    }

    rendre((n) => (n + 1) % 1000);
  }, [W, H, R, RAQUETTE_Y, RAQUETTE_H, reglage, haptic, submitScore]);

  useRafLoop(pas, !over);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          raquette.current = clamp(
            e.x,
            largeurRaquette.current / 2,
            W - largeurRaquette.current / 2,
          );
        }),
    [W],
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {echanges} échanges
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  const b = balle.current;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: W }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'souple', label: 'Souple' },
            { value: 'normal', label: 'Normal' },
            { value: 'nerveux', label: 'Nerveux' },
          ]}
          accent="#F0A030"
        />
      </View>

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
          {/* Le mur du fond */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 8,
              backgroundColor: c.borderStrong,
            }}
          />

          <View
            style={{
              position: 'absolute',
              left: b.x - R,
              top: b.y - R,
              width: R * 2,
              height: R * 2,
              borderRadius: R,
              backgroundColor: '#D7F04A',
            }}
          />

          <View
            style={{
              position: 'absolute',
              left: raquette.current - largeurRaquette.current / 2,
              top: RAQUETTE_Y,
              width: largeurRaquette.current,
              height: RAQUETTE_H,
              borderRadius: RAQUETTE_H / 2,
              backgroundColor: c.accent,
            }}
          />
        </View>
      </GestureDetector>

      <Txt variant="caption" tone="faint">
        Glisse pour déplacer la raquette
      </Txt>

      <GameOver
        visible={over}
        outcome="over"
        title="Balle manquée"
        score={echanges}
        scoreLabel="Échanges"
        best={best}
        isRecord={record}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
