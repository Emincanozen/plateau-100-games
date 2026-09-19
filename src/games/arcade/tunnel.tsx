import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { BoutonControle, Row, Segmented, Txt, GameOver, useClavier } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { clamp, randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'tunnel',
  name: 'Tunnel',
  tagline: 'Un couloir qui serpente et se resserre. Tiens la trajectoire.',
  category: 'arcade',
  emoji: '🛸',
  difficulty: 2,
  players: '1',
  minutes: 3,
  score: 'high',
  scoreUnit: 'm',
  tags: ['réflexe', 'solo', 'nerveux'],
  rules: [
    'Vue de dessus : tu descends le tunnel à vitesse constante.',
    'Glisse ton doigt, ou utilise les boutons, pour rester dans le couloir.',
    'Le passage se resserre et ondule de plus en plus fort à mesure que tu avances.',
    'Frôler une paroi met fin à la descente. Ta distance est ton score.',
  ],
};

type Niveau = 'large' | 'normal' | 'etroit';

const REGLAGES: Record<Niveau, { largeur: number; vitesse: number; sinuosite: number }> = {
  large: { largeur: 0.46, vitesse: 2.6, sinuosite: 0.9 },
  normal: { largeur: 0.36, vitesse: 3.4, sinuosite: 1.3 },
  etroit: { largeur: 0.28, vitesse: 4.2, sinuosite: 1.8 },
};

/** Une tranche horizontale du tunnel : bord gauche et largeur du passage. */
interface Tranche {
  gauche: number;
  largeur: number;
}

const HAUTEUR_TRANCHE = 10;

export default function Tunnel({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 380);
  const H = Math.min(winHeight * 0.6, 540);
  const NB = Math.ceil(H / HAUTEUR_TRANCHE) + 2;
  const TAILLE = 22;
  const Y_VAISSEAU = H * 0.76;

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const reglage = REGLAGES[niveau];

  const [distance, setDistance] = useState(0);
  const [over, setOver] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const x = useRef(W / 2);
  const tranches = useRef<Tranche[]>([]);
  const decalage = useRef(0);
  const phase = useRef(0);
  const distanceRef = useRef(0);
  const vivant = useRef(true);

  const trancheSuivante = useCallback(
    (precedente: Tranche | undefined, avance: number): Tranche => {
      const largeur = Math.max(W * 0.15, W * reglage.largeur - avance / 24);
      if (!precedente) return { gauche: (W - largeur) / 2, largeur };

      // Le centre suit une sinusoïde bruitée : le couloir serpente.
      phase.current += 0.045;
      const derive = Math.sin(phase.current) * reglage.sinuosite * 2.2 + randBetween(-1, 1);
      const gauche = clamp(precedente.gauche + derive, 4, W - largeur - 4);
      return { gauche, largeur };
    },
    [W, reglage],
  );

  const reset = useCallback(() => {
    x.current = W / 2;
    decalage.current = 0;
    phase.current = 0;
    distanceRef.current = 0;
    vivant.current = true;

    const initiales: Tranche[] = [];
    for (let i = 0; i < NB; i++) initiales.push(trancheSuivante(initiales[i - 1], 0));
    tranches.current = initiales;

    setDistance(0);
    setOver(false);
    setRecord(false);
  }, [W, NB, trancheSuivante]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, reset]);

  const bouger = useCallback(
    (delta: number) => {
      if (!vivant.current) return;
      x.current = clamp(x.current + delta, TAILLE / 2, W - TAILLE / 2);
    },
    [W, TAILLE],
  );

  const pas = useCallback(() => {
    if (!vivant.current) return;

    decalage.current += reglage.vitesse;
    while (decalage.current >= HAUTEUR_TRANCHE) {
      decalage.current -= HAUTEUR_TRANCHE;
      // Les nouvelles tranches arrivent par le haut : on insère devant.
      tranches.current = [
        trancheSuivante(tranches.current[0], distanceRef.current),
        ...tranches.current.slice(0, -1),
      ];
    }

    distanceRef.current += reglage.vitesse / 6;
    setDistance(Math.floor(distanceRef.current));

    // Tranche à hauteur du vaisseau.
    const index = Math.floor((Y_VAISSEAU + decalage.current) / HAUTEUR_TRANCHE);
    const tranche = tranches.current[index];
    if (tranche) {
      const bordGauche = x.current - TAILLE / 2;
      const bordDroit = x.current + TAILLE / 2;
      if (bordGauche < tranche.gauche || bordDroit > tranche.gauche + tranche.largeur) {
        vivant.current = false;
        setOver(true);
        haptic('error');
        setRecord(submitScore(Math.floor(distanceRef.current)));
        return;
      }
    }

    rendre((n) => (n + 1) % 1000);
  }, [reglage, Y_VAISSEAU, TAILLE, trancheSuivante, haptic, submitScore]);

  useRafLoop(pas, !over);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          x.current = clamp(e.x, TAILLE / 2, W - TAILLE / 2);
        }),
    [W, TAILLE],
  );

  useClavier(
    {
      ArrowLeft: () => bouger(-16),
      ArrowRight: () => bouger(16),
      KeyQ: () => bouger(-16),
      KeyD: () => bouger(16),
    },
    !over,
  );

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

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: W }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'large', label: 'Large' },
            { value: 'normal', label: 'Normal' },
            { value: 'etroit', label: 'Étroit' },
          ]}
          accent="#F0A030"
        />
      </View>

      <GestureDetector gesture={pan}>
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: '#0E1626',
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {tranches.current.map((tranche, i) => {
            const y = i * HAUTEUR_TRANCHE - decalage.current;
            return (
              <React.Fragment key={i}>
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: y,
                    width: tranche.gauche,
                    height: HAUTEUR_TRANCHE + 1,
                    backgroundColor: '#2E4A6E',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: tranche.gauche + tranche.largeur,
                    top: y,
                    width: W - tranche.gauche - tranche.largeur,
                    height: HAUTEUR_TRANCHE + 1,
                    backgroundColor: '#2E4A6E',
                  }}
                />
              </React.Fragment>
            );
          })}

          <View
            style={{
              position: 'absolute',
              left: x.current - TAILLE / 2,
              top: Y_VAISSEAU - TAILLE / 2,
              width: TAILLE,
              height: TAILLE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ fontSize: TAILLE * 0.9 }}>🛸</Txt>
          </View>
        </View>
      </GestureDetector>

      <Row gap={space.xl}>
        <BoutonControle glyphe="◀" label="Gauche" repeter onPress={() => bouger(-16)} />
        <BoutonControle glyphe="▶" label="Droite" repeter onPress={() => bouger(16)} />
      </Row>

      <GameOver
        visible={over}
        outcome="over"
        title="Paroi touchée"
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
