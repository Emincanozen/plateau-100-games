import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Txt, GameOver } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { randBetween, randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'missiles',
  name: 'Missiles',
  tagline: 'Intercepte les traînées avant qu’elles n’atteignent les villes.',
  category: 'arcade',
  emoji: '🎆',
  difficulty: 2,
  players: '1',
  minutes: 5,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['culte', 'réflexe', 'défense'],
  rules: [
    'Touche le ciel : une explosion se déclenche à cet endroit après un court trajet.',
    'Tout missile pris dans le souffle est détruit — vise devant, pas dessus.',
    'Six villes à protéger. Chaque vague en envoie davantage, et plus vite.',
    'La partie s’arrête quand toutes les villes sont rasées. Les villes survivantes rapportent un bonus par vague.',
  ],
};

interface Missile {
  x: number;
  y: number;
  cibleX: number;
  cibleY: number;
  vitesse: number;
}

interface Explosion {
  x: number;
  y: number;
  rayon: number;
  croissance: boolean;
}

interface Interception {
  x: number;
  y: number;
  cibleX: number;
  cibleY: number;
}

const NB_VILLES = 6;
const RAYON_MAX = 34;

export default function Missiles({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 420);
  const H = Math.min(winHeight * 0.58, 500);
  const SOL = H - 26;

  const [score, setScore] = useState(0);
  const [vague, setVague] = useState(1);
  const [villesDebout, setVillesDebout] = useState(NB_VILLES);
  const [over, setOver] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const villes = useRef<boolean[]>(Array(NB_VILLES).fill(true));
  const missiles = useRef<Missile[]>([]);
  const explosions = useRef<Explosion[]>([]);
  const interceptions = useRef<Interception[]>([]);
  const restantsVague = useRef(6);
  const cadence = useRef(0);
  const scoreRef = useRef(0);
  const vagueRef = useRef(1);
  const vivant = useRef(true);

  const positionVille = useCallback((i: number) => ((i + 0.5) * W) / NB_VILLES, [W]);

  const reset = useCallback(() => {
    villes.current = Array(NB_VILLES).fill(true);
    missiles.current = [];
    explosions.current = [];
    interceptions.current = [];
    restantsVague.current = 6;
    cadence.current = 0;
    scoreRef.current = 0;
    vagueRef.current = 1;
    vivant.current = true;
    setScore(0);
    setVague(1);
    setVillesDebout(NB_VILLES);
    setOver(false);
    setRecord(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  const viser = (x: number, y: number) => {
    if (!vivant.current || y > SOL - 10) return;
    if (interceptions.current.length >= 3) return;
    haptic('light');
    interceptions.current.push({ x: W / 2, y: SOL, cibleX: x, cibleY: y });
  };

  const pas = useCallback(() => {
    if (!vivant.current) return;

    // Lancement des missiles de la vague.
    cadence.current += 1;
    const intervalle = Math.max(26, 90 - vagueRef.current * 8);
    if (restantsVague.current > 0 && cadence.current > intervalle) {
      cadence.current = 0;
      restantsVague.current -= 1;
      const cible = randInt(NB_VILLES);
      missiles.current.push({
        x: randBetween(0, Math.floor(W)),
        y: -10,
        cibleX: positionVille(cible),
        cibleY: SOL,
        vitesse: 0.6 + vagueRef.current * 0.14,
      });
    }

    // Déplacement des missiles ennemis.
    missiles.current = missiles.current.filter((missile) => {
      const dx = missile.cibleX - missile.x;
      const dy = missile.cibleY - missile.y;
      const distance = Math.hypot(dx, dy);
      if (distance < missile.vitesse * 2) {
        // Impact au sol : la ville visée tombe.
        const index = Math.min(
          NB_VILLES - 1,
          Math.max(0, Math.round((missile.cibleX / W) * NB_VILLES - 0.5)),
        );
        if (villes.current[index]) {
          villes.current[index] = false;
          setVillesDebout(villes.current.filter(Boolean).length);
          haptic('error');
        }
        explosions.current.push({ x: missile.cibleX, y: SOL, rayon: 4, croissance: true });
        return false;
      }
      missile.x += (dx / distance) * missile.vitesse;
      missile.y += (dy / distance) * missile.vitesse;
      return true;
    });

    // Déplacement des interceptions, qui explosent à destination.
    interceptions.current = interceptions.current.filter((tir) => {
      const dx = tir.cibleX - tir.x;
      const dy = tir.cibleY - tir.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 7) {
        explosions.current.push({ x: tir.cibleX, y: tir.cibleY, rayon: 4, croissance: true });
        haptic('medium');
        return false;
      }
      tir.x += (dx / distance) * 7;
      tir.y += (dy / distance) * 7;
      return true;
    });

    // Souffle des explosions.
    explosions.current = explosions.current.filter((explosion) => {
      explosion.rayon += explosion.croissance ? 1.8 : -1.5;
      if (explosion.rayon >= RAYON_MAX) explosion.croissance = false;
      return explosion.rayon > 0;
    });

    // Missiles pris dans un souffle.
    for (const explosion of explosions.current) {
      const touches = missiles.current.filter(
        (missile) => Math.hypot(missile.x - explosion.x, missile.y - explosion.y) < explosion.rayon,
      );
      if (touches.length === 0) continue;
      missiles.current = missiles.current.filter((missile) => !touches.includes(missile));
      scoreRef.current += touches.length * 25;
      setScore(scoreRef.current);
      // Réaction en chaîne : chaque missile abattu explose à son tour.
      touches.forEach((missile) =>
        explosions.current.push({ x: missile.x, y: missile.y, rayon: 3, croissance: true }),
      );
    }

    // Fin de partie.
    if (villes.current.every((v) => !v)) {
      vivant.current = false;
      setOver(true);
      haptic('error');
      setRecord(submitScore(scoreRef.current));
      return;
    }

    // Vague suivante.
    if (restantsVague.current === 0 && missiles.current.length === 0) {
      const survivantes = villes.current.filter(Boolean).length;
      scoreRef.current += survivantes * 50;
      setScore(scoreRef.current);
      vagueRef.current += 1;
      setVague(vagueRef.current);
      restantsVague.current = 5 + vagueRef.current * 2;
      haptic('success');
    }

    rendre((n) => (n + 1) % 1000);
  }, [W, SOL, positionVille, haptic, submitScore]);

  useRafLoop(pas, !over);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {score} pts
      </Txt>
      <Txt variant="label" tone="faint">
        Vague {vague}
      </Txt>
      <Txt variant="label" tone="danger">
        🏙 {villesDebout}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <Pressable
        onPress={(e) => viser(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        accessibilityRole="button"
        accessibilityLabel="Viser une position du ciel"
      >
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: '#0B1020',
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {/* Traînées des missiles ennemis */}
          {missiles.current.map((missile, i) => (
            <View
              key={`m${i}`}
              style={{
                position: 'absolute',
                left: missile.x - 3,
                top: missile.y - 3,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#FF6B78',
              }}
            />
          ))}

          {interceptions.current.map((tir, i) => (
            <View
              key={`i${i}`}
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

          {explosions.current.map((explosion, i) => (
            <View
              key={`e${i}`}
              style={{
                position: 'absolute',
                left: explosion.x - explosion.rayon,
                top: explosion.y - explosion.rayon,
                width: explosion.rayon * 2,
                height: explosion.rayon * 2,
                borderRadius: explosion.rayon,
                backgroundColor: '#EFB93B66',
                borderWidth: 2,
                borderColor: '#EFB93B',
              }}
            />
          ))}

          {/* Le sol et les villes */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: SOL,
              height: H - SOL,
              backgroundColor: '#243046',
            }}
          />
          {villes.current.map((debout, i) => (
            <View
              key={`v${i}`}
              style={{
                position: 'absolute',
                left: positionVille(i) - 14,
                top: SOL - 20,
                width: 28,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: debout ? 1 : 0.28,
              }}
            >
              <Txt style={{ fontSize: 20 }}>{debout ? '🏙' : '🔥'}</Txt>
            </View>
          ))}

          {/* La batterie */}
          <View
            style={{
              position: 'absolute',
              left: W / 2 - 10,
              top: SOL - 14,
              width: 20,
              height: 16,
              alignItems: 'center',
            }}
          >
            <Txt style={{ fontSize: 16 }}>🛰</Txt>
          </View>
        </View>
      </Pressable>

      <Txt variant="caption" tone="faint">
        Touche le ciel pour déclencher une interception · 3 en vol au maximum
      </Txt>

      <GameOver
        visible={over}
        outcome="over"
        title="Toutes les villes sont tombées"
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
