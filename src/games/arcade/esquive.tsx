import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { BoutonControle, Row, Segmented, Txt, GameOver, useClavier } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { clamp, randBetween, randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'esquive',
  name: 'Esquive',
  tagline: 'Ça tombe de partout. Reste en vie le plus longtemps possible.',
  category: 'arcade',
  emoji: '☄️',
  difficulty: 1,
  players: '1',
  minutes: 3,
  score: 'high',
  scoreUnit: 's',
  tags: ['réflexe', 'solo', 'nerveux'],
  rules: [
    'Glisse ton doigt, ou utilise les boutons, pour déplacer ton personnage.',
    'Évite tout ce qui tombe. Un seul contact met fin à la partie.',
    'Les étoiles dorées rapportent un bonus de temps : va les chercher.',
    'La chute s’accélère au fil des secondes. Ton score est ta durée de survie.',
  ],
};

interface Objet {
  x: number;
  y: number;
  vitesse: number;
  taille: number;
  bonus: boolean;
}

type Niveau = 'calme' | 'normal' | 'chaos';

const REGLAGES: Record<Niveau, { cadence: number; vitesse: number }> = {
  calme: { cadence: 44, vitesse: 2.1 },
  normal: { cadence: 30, vitesse: 2.8 },
  chaos: { cadence: 19, vitesse: 3.6 },
};

export default function Esquive({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 400);
  const H = Math.min(winHeight * 0.58, 520);
  const TAILLE = 30;
  const JOUEUR_Y = H - 44;

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const reglage = REGLAGES[niveau];

  const [secondes, setSecondes] = useState(0);
  const [bonusPris, setBonusPris] = useState(0);
  const [over, setOver] = useState(false);
  const [record, setRecord] = useState(false);
  /** Rien ne tombe tant que le joueur n a pas bouge. */
  const [demarre, setDemarre] = useState(false);
  const [, rendre] = useState(0);

  const joueur = useRef(W / 2);
  const objets = useRef<Objet[]>([]);
  const images = useRef(0);
  const bonusRef = useRef(0);
  const vivant = useRef(true);

  const reset = useCallback(() => {
    joueur.current = W / 2;
    objets.current = [];
    images.current = 0;
    bonusRef.current = 0;
    vivant.current = true;
    setSecondes(0);
    setBonusPris(0);
    setOver(false);
    setRecord(false);
    setDemarre(false);
  }, [W]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, reset]);

  const bouger = useCallback(
    (delta: number) => {
      if (!vivant.current) return;
      setDemarre(true);
      joueur.current = clamp(joueur.current + delta, TAILLE / 2, W - TAILLE / 2);
    },
    [W],
  );

  const pas = useCallback(() => {
    if (!vivant.current || !demarre) return;
    images.current += 1;

    // La cadence d'apparition se resserre avec le temps.
    const ecoule = images.current / 60;
    const cadence = Math.max(9, reglage.cadence - Math.floor(ecoule / 5) * 2);

    if (images.current % cadence === 0) {
      const bonus = Math.random() < 0.09;
      objets.current.push({
        x: randBetween(16, W - 16),
        y: -20,
        vitesse: reglage.vitesse + ecoule / 14 + Math.random(),
        taille: bonus ? 22 : randBetween(18, 30),
        bonus,
      });
    }

    objets.current = objets.current
      .map((o) => ({ ...o, y: o.y + o.vitesse }))
      .filter((o) => o.y < H + 40);

    for (const objet of objets.current) {
      const dx = Math.abs(objet.x - joueur.current);
      const dy = Math.abs(objet.y - JOUEUR_Y);
      if (dx < (objet.taille + TAILLE) / 2.4 && dy < (objet.taille + TAILLE) / 2.4) {
        if (objet.bonus) {
          objets.current = objets.current.filter((o) => o !== objet);
          bonusRef.current += 1;
          setBonusPris(bonusRef.current);
          haptic('success');
          continue;
        }
        vivant.current = false;
        setOver(true);
        haptic('error');
        setRecord(submitScore(Math.floor(ecoule) + bonusRef.current * 3));
        return;
      }
    }

    setSecondes(Math.floor(ecoule));
    rendre((n) => (n + 1) % 1000);
  }, [demarre, W, H, JOUEUR_Y, reglage, haptic, submitScore]);

  useRafLoop(pas, !over);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          setDemarre(true);
          joueur.current = clamp(e.x, TAILLE / 2, W - TAILLE / 2);
        }),
    [W],
  );

  useClavier(
    {
      ArrowLeft: () => bouger(-18),
      ArrowRight: () => bouger(18),
      KeyQ: () => bouger(-18),
      KeyD: () => bouger(18),
    },
    !over,
  );

  const total = secondes + bonusPris * 3;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {total} pts
      </Txt>
      <Txt variant="label" tone="faint">
        {secondes} s
      </Txt>
      {bonusPris > 0 ? (
        <Txt variant="label" tone="warning">
          ⭐ {bonusPris}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: W }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'calme', label: 'Calme' },
            { value: 'normal', label: 'Normal' },
            { value: 'chaos', label: 'Chaos' },
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
          {objets.current.map((objet, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: objet.x - objet.taille / 2,
                top: objet.y - objet.taille / 2,
                width: objet.taille,
                height: objet.taille,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt style={{ fontSize: objet.taille * 0.9 }}>{objet.bonus ? '⭐' : '☄️'}</Txt>
            </View>
          ))}

          <View
            style={{
              position: 'absolute',
              left: joueur.current - TAILLE / 2,
              top: JOUEUR_Y - TAILLE / 2,
              width: TAILLE,
              height: TAILLE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ fontSize: TAILLE * 0.9 }}>🏃</Txt>
          </View>

          {!demarre && !over ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: H / 2 - 20, alignItems: 'center' }}>
              <Txt variant="h3" tone="dim">
                Bouge pour commencer
              </Txt>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      <Row gap={space.xl}>
        <BoutonControle glyphe="◀" label="Gauche" repeter onPress={() => bouger(-18)} />
        <BoutonControle glyphe="▶" label="Droite" repeter onPress={() => bouger(18)} />
      </Row>

      <GameOver
        visible={over}
        outcome="over"
        title="Touché"
        score={total}
        best={best}
        isRecord={record}
        detail={`${secondes} secondes${bonusPris > 0 ? ` · ${bonusPris} étoiles` : ''}`}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
