import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'dino',
  name: 'Course sans fin',
  tagline: 'Saute les obstacles aussi longtemps que tu tiens.',
  category: 'arcade',
  emoji: '🦖',
  difficulty: 1,
  players: '1',
  minutes: 3,
  score: 'high',
  scoreUnit: 'm',
  tags: ['réflexe', 'solo', 'endurance'],
  rules: [
    'Touche l’écran pour sauter par-dessus les cactus.',
    'La distance parcourue est ton score : elle monte en continu.',
    'Le décor accélère progressivement — les sauts doivent être de plus en plus précis.',
    'Un seul contact et la course s’arrête.',
  ],
};

interface Obstacle {
  x: number;
  largeur: number;
  hauteur: number;
}

type Niveau = 'balade' | 'normal' | 'sprint';

/** Le jeu demarre lentement et n'accelere que tres progressivement. */
const NIVEAUX: Record<Niveau, { depart: number; max: number; palier: number }> = {
  balade: { depart: 2.4, max: 4.6, palier: 900 },
  normal: { depart: 3.1, max: 6.2, palier: 620 },
  sprint: { depart: 4, max: 8, palier: 420 },
};

const GRAVITE = 0.62;
const IMPULSION = -12.4;

export default function Dino({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 460);
  const H = Math.min(winHeight * 0.42, 280);
  const SOL = H - 30;
  const TAILLE = 30;
  const X = 40;

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const reglage = NIVEAUX[niveau];

  const [distance, setDistance] = useState(0);
  const [over, setOver] = useState(false);
  const [demarre, setDemarre] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const perso = useRef({ y: SOL - TAILLE, v: 0 });
  const obstacles = useRef<Obstacle[]>([]);
  const distanceRef = useRef(0);
  const vitesseRef = useRef(4.2);
  const vivant = useRef(true);

  const reset = useCallback(() => {
    perso.current = { y: SOL - TAILLE, v: 0 };
    obstacles.current = [{ x: W + 100, largeur: 16, hauteur: 30 }];
    distanceRef.current = 0;
    vitesseRef.current = reglage.depart;
    vivant.current = true;
    setDistance(0);
    setOver(false);
    setDemarre(false);
    setRecord(false);
  }, [SOL, TAILLE, W, reglage]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, reset]);

  const sauter = () => {
    if (over) return;
    if (!demarre) setDemarre(true);
    // Le saut n'est possible qu'au contact du sol.
    if (perso.current.y >= SOL - TAILLE - 0.5) {
      haptic('light');
      perso.current.v = IMPULSION;
    }
  };

  const pas = useCallback(() => {
    if (!vivant.current || !demarre) return;

    const p = perso.current;
    p.v += GRAVITE;
    p.y += p.v;
    if (p.y > SOL - TAILLE) {
      p.y = SOL - TAILLE;
      p.v = 0;
    }

    vitesseRef.current = Math.min(reglage.max, reglage.depart + distanceRef.current / reglage.palier);
    obstacles.current = obstacles.current
      .map((o) => ({ ...o, x: o.x - vitesseRef.current }))
      .filter((o) => o.x + o.largeur > -20);

    const dernier = obstacles.current[obstacles.current.length - 1];
    if (!dernier || dernier.x < W - randBetween(260, 430)) {
      obstacles.current.push({
        x: W + 20,
        largeur: randBetween(14, 26),
        hauteur: randBetween(20, 36),
      });
    }

    for (const o of obstacles.current) {
      const chevaucheX = X + TAILLE > o.x && X < o.x + o.largeur;
      const chevaucheY = p.y + TAILLE > SOL - o.hauteur;
      if (chevaucheX && chevaucheY) {
        vivant.current = false;
        setOver(true);
        haptic('error');
        setRecord(submitScore(Math.floor(distanceRef.current)));
        return;
      }
    }

    distanceRef.current += vitesseRef.current / 6;
    setDistance(Math.floor(distanceRef.current));
    rendre((n) => (n + 1) % 1000);
  }, [demarre, reglage, SOL, TAILLE, W, X, haptic, submitScore]);

  useRafLoop(pas, !over);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {distance} m
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best} m
        </Txt>
      ) : null}
    </Row>,
  );

  const p = perso.current;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: W }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'balade', label: 'Balade' },
            { value: 'normal', label: 'Normal' },
            { value: 'sprint', label: 'Sprint' },
          ]}
          accent="#F0A030"
        />
      </View>

      <Pressable onPress={sauter} accessibilityRole="button" accessibilityLabel="Sauter">
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: SOL,
              height: 2,
              backgroundColor: c.borderStrong,
            }}
          />

          {obstacles.current.map((o, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: o.x,
                top: SOL - o.hauteur,
                width: o.largeur,
                height: o.hauteur,
                borderRadius: 3,
                backgroundColor: '#34B37E',
              }}
            />
          ))}

          <View
            style={{
              position: 'absolute',
              left: X,
              top: p.y,
              width: TAILLE,
              height: TAILLE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* L'emoji regarde a gauche : on le retourne pour qu'il coure vers la droite. */}
            <Txt style={{ fontSize: TAILLE * 0.9, transform: [{ scaleX: -1 }] }}>🦖</Txt>
          </View>

          {!demarre && !over ? (
            <Txt
              variant="label"
              tone="dim"
              style={{ position: 'absolute', alignSelf: 'center', top: H / 2 - 20 }}
            >
              Touche pour démarrer
            </Txt>
          ) : null}
        </View>
      </Pressable>

      <GameOver
        visible={over}
        outcome="over"
        title="Course terminée"
        score={`${distance} m`}
        best={best !== undefined ? `${best} m` : undefined}
        isRecord={record}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
