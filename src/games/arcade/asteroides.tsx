import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { BoutonControle, Row, Txt, GameOver, useClavier } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'asteroides',
  name: 'Astéroïdes',
  tagline: 'Pivote, pousse, tire. Chaque roche brisée en donne deux plus petites.',
  category: 'arcade',
  emoji: '🌑',
  difficulty: 3,
  players: '1',
  minutes: 6,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['culte', 'réflexe', 'inertie'],
  rules: [
    'Les flèches de gauche et de droite font pivoter le vaisseau ; la poussée l’accélère dans son axe.',
    'Il n’y a pas de frein : l’inertie te porte, c’est tout le sel du jeu.',
    'Un gros astéroïde touché se scinde en deux moyens, puis en deux petits.',
    'Les bords sont reliés : sortir d’un côté fait réapparaître de l’autre. Trois vies.',
  ],
};

interface Roche {
  x: number;
  y: number;
  vx: number;
  vy: number;
  taille: 3 | 2 | 1;
}

interface Tir {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
}

const RAYONS: Record<3 | 2 | 1, number> = { 3: 28, 2: 17, 1: 10 };
const POINTS: Record<3 | 2 | 1, number> = { 3: 20, 2: 50, 1: 100 };

export default function Asteroides({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 400);
  const H = Math.min(winHeight * 0.56, 480);

  const [score, setScore] = useState(0);
  const [vies, setVies] = useState(3);
  const [vague, setVague] = useState(1);
  const [over, setOver] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const vaisseau = useRef({ x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 });
  const roches = useRef<Roche[]>([]);
  const tirs = useRef<Tir[]>([]);
  const rotation = useRef(0);
  const poussee = useRef(false);
  const scoreRef = useRef(0);
  const viesRef = useRef(3);
  const vagueRef = useRef(1);
  const invulnerable = useRef(0);
  const vivant = useRef(true);

  const semerRoches = useCallback(
    (nombre: number): Roche[] =>
      Array.from({ length: nombre }, () => {
        // On les fait naître loin du centre, où le vaisseau réapparaît.
        const surLesBords = Math.random() < 0.5;
        return {
          x: surLesBords ? randBetween(0, 1) * W : randBetween(0, Math.floor(W)),
          y: surLesBords ? randBetween(0, Math.floor(H)) : randBetween(0, 1) * H,
          vx: randBetween(-10, 10) / 10,
          vy: randBetween(-10, 10) / 10,
          taille: 3 as const,
        };
      }),
    [W, H],
  );

  const reset = useCallback(() => {
    vaisseau.current = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
    roches.current = semerRoches(4);
    tirs.current = [];
    rotation.current = 0;
    poussee.current = false;
    scoreRef.current = 0;
    viesRef.current = 3;
    vagueRef.current = 1;
    invulnerable.current = 90;
    vivant.current = true;
    setScore(0);
    setVies(3);
    setVague(1);
    setOver(false);
    setRecord(false);
  }, [W, H, semerRoches]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  const tirer = useCallback(() => {
    if (!vivant.current || tirs.current.length >= 4) return;
    const v = vaisseau.current;
    haptic('light');
    tirs.current.push({
      x: v.x + Math.cos(v.angle) * 14,
      y: v.y + Math.sin(v.angle) * 14,
      vx: Math.cos(v.angle) * 6 + v.vx,
      vy: Math.sin(v.angle) * 6 + v.vy,
      vie: 70,
    });
  }, [haptic]);

  /** Ramène une position dans l'écran : les bords sont reliés. */
  const enrouler = useCallback(
    (objet: { x: number; y: number }) => {
      if (objet.x < 0) objet.x += W;
      else if (objet.x > W) objet.x -= W;
      if (objet.y < 0) objet.y += H;
      else if (objet.y > H) objet.y -= H;
    },
    [W, H],
  );

  const pas = useCallback(() => {
    if (!vivant.current) return;
    const v = vaisseau.current;

    v.angle += rotation.current * 0.075;
    if (poussee.current) {
      v.vx += Math.cos(v.angle) * 0.14;
      v.vy += Math.sin(v.angle) * 0.14;
    }
    // Léger freinage spatial, sinon le vaisseau devient incontrôlable.
    v.vx *= 0.992;
    v.vy *= 0.992;
    const vitesse = Math.hypot(v.vx, v.vy);
    if (vitesse > 5) {
      v.vx = (v.vx / vitesse) * 5;
      v.vy = (v.vy / vitesse) * 5;
    }
    v.x += v.vx;
    v.y += v.vy;
    enrouler(v);

    if (invulnerable.current > 0) invulnerable.current -= 1;

    roches.current.forEach((roche) => {
      roche.x += roche.vx;
      roche.y += roche.vy;
      enrouler(roche);
    });

    tirs.current = tirs.current
      .map((tir) => {
        const suivant = { ...tir, x: tir.x + tir.vx, y: tir.y + tir.vy, vie: tir.vie - 1 };
        enrouler(suivant);
        return suivant;
      })
      .filter((tir) => tir.vie > 0);

    // Tirs contre roches.
    for (const tir of tirs.current) {
      for (const roche of roches.current) {
        const distance = Math.hypot(tir.x - roche.x, tir.y - roche.y);
        if (distance > RAYONS[roche.taille]) continue;

        tirs.current = tirs.current.filter((t) => t !== tir);
        roches.current = roches.current.filter((r) => r !== roche);
        scoreRef.current += POINTS[roche.taille];
        setScore(scoreRef.current);
        haptic('medium');

        // Un fragment se scinde en deux, jusqu'à la plus petite taille.
        if (roche.taille > 1) {
          const petite = (roche.taille - 1) as 2 | 1;
          for (let k = 0; k < 2; k++) {
            const angle = Math.random() * Math.PI * 2;
            roches.current.push({
              x: roche.x,
              y: roche.y,
              vx: Math.cos(angle) * (1 + Math.random()),
              vy: Math.sin(angle) * (1 + Math.random()),
              taille: petite,
            });
          }
        }
        break;
      }
    }

    // Collisions vaisseau.
    if (invulnerable.current === 0) {
      for (const roche of roches.current) {
        if (Math.hypot(v.x - roche.x, v.y - roche.y) < RAYONS[roche.taille] + 9) {
          viesRef.current -= 1;
          setVies(viesRef.current);
          haptic('error');
          if (viesRef.current <= 0) {
            vivant.current = false;
            setOver(true);
            setRecord(submitScore(scoreRef.current));
            return;
          }
          vaisseau.current = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
          invulnerable.current = 110;
          break;
        }
      }
    }

    // Vague suivante.
    if (roches.current.length === 0) {
      vagueRef.current += 1;
      setVague(vagueRef.current);
      roches.current = semerRoches(3 + vagueRef.current);
      invulnerable.current = 70;
      haptic('success');
    }

    rendre((n) => (n + 1) % 1000);
  }, [W, H, enrouler, semerRoches, haptic, submitScore]);

  useRafLoop(pas, !over);

  useClavier(
    {
      ArrowLeft: () => {
        rotation.current = -1;
        setTimeout(() => (rotation.current = 0), 110);
      },
      ArrowRight: () => {
        rotation.current = 1;
        setTimeout(() => (rotation.current = 0), 110);
      },
      ArrowUp: () => {
        poussee.current = true;
        setTimeout(() => (poussee.current = false), 160);
      },
      Space: tirer,
    },
    !over,
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {score} pts
      </Txt>
      <Txt variant="label" tone="faint">
        Vague {vague}
      </Txt>
      <Txt variant="label" tone="danger">
        {'▲'.repeat(Math.max(0, vies))}
      </Txt>
    </Row>,
  );

  const v = vaisseau.current;
  const clignote = invulnerable.current > 0 && Math.floor(invulnerable.current / 6) % 2 === 0;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View
        style={{
          width: W,
          height: H,
          backgroundColor: '#07070E',
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        {roches.current.map((roche, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: roche.x - RAYONS[roche.taille],
              top: roche.y - RAYONS[roche.taille],
              width: RAYONS[roche.taille] * 2,
              height: RAYONS[roche.taille] * 2,
              borderRadius: RAYONS[roche.taille],
              borderWidth: 2,
              borderColor: '#9A9AB0',
              backgroundColor: '#2A2A38',
            }}
          />
        ))}

        {tirs.current.map((tir, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: tir.x - 2,
              top: tir.y - 2,
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#4BC4D6',
            }}
          />
        ))}

        <View
          style={{
            position: 'absolute',
            left: v.x - 14,
            top: v.y - 14,
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: clignote ? 0.35 : 1,
            // L'emoji pointe vers le haut : on ajoute 90° à l'angle de vol.
            transform: [{ rotate: `${v.angle + Math.PI / 2}rad` }],
          }}
        >
          <Txt style={{ fontSize: 24 }}>🚀</Txt>
        </View>
      </View>

      <Row gap={space.sm}>
        <BoutonControle
          glyphe="↺"
          label="Pivoter à gauche"
          onPress={() => {
            rotation.current = -1;
            setTimeout(() => (rotation.current = 0), 140);
          }}
        />
        <BoutonControle
          glyphe="▲"
          label="Pousser"
          tint="#34B37E33"
          onPress={() => {
            poussee.current = true;
            setTimeout(() => (poussee.current = false), 220);
          }}
        />
        <BoutonControle
          glyphe="↻"
          label="Pivoter à droite"
          onPress={() => {
            rotation.current = 1;
            setTimeout(() => (rotation.current = 0), 140);
          }}
        />
        <BoutonControle glyphe="🔥" label="Tirer" tint="#F0A03033" onPress={tirer} />
      </Row>

      <GameOver
        visible={over}
        outcome="over"
        title="Vaisseau pulvérisé"
        score={score}
        best={best}
        isRecord={record}
        detail={`Vague ${vague}`}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
