import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { clamp, randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'helicoptere',
  name: 'Hélicoptère',
  tagline: 'Maintiens pour monter, relâche pour descendre. Traverse la grotte.',
  category: 'arcade',
  emoji: '🚁',
  difficulty: 2,
  players: '1',
  minutes: 3,
  score: 'high',
  scoreUnit: 'm',
  tags: ['réflexe', 'solo', 'nerveux'],
  rules: [
    'Garde le doigt appuyé pour monter. Relâche et l’appareil redescend.',
    'La grotte se resserre progressivement : le couloir devient étroit.',
    'Des blocs surgissent au milieu du passage, il faut les contourner.',
    'Toucher la roche, le plafond ou le sol met fin au vol.',
  ],
};

type Niveau = 'balade' | 'normal' | 'sportif';

const NIVEAUX: Record<Niveau, { poussee: number; gravite: number; vitesse: number; couloir: number }> = {
  balade: { poussee: 0.26, gravite: 0.2, vitesse: 2.2, couloir: 0.52 },
  normal: { poussee: 0.32, gravite: 0.26, vitesse: 2.9, couloir: 0.44 },
  sportif: { poussee: 0.4, gravite: 0.34, vitesse: 3.8, couloir: 0.36 },
};

/** Une tranche de grotte : hauteur du plafond et du sol. */
interface Tranche {
  plafond: number;
  sol: number;
  bloc: { haut: number; bas: number } | null;
}

const LARGEUR_TRANCHE = 12;

export default function Helicoptere({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 420);
  const H = Math.min(winHeight * 0.55, 460);
  const NB_TRANCHES = Math.ceil(W / LARGEUR_TRANCHE) + 2;
  const X_APPAREIL = W * 0.26;
  const TAILLE = 26;

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const reglage = NIVEAUX[niveau];

  const [distance, setDistance] = useState(0);
  const [over, setOver] = useState(false);
  const [demarre, setDemarre] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const y = useRef(H / 2);
  const vy = useRef(0);
  const monte = useRef(false);
  const tranches = useRef<Tranche[]>([]);
  const decalage = useRef(0);
  const distanceRef = useRef(0);
  const vivant = useRef(true);

  /** Fabrique la tranche suivante en suivant celle d'avant. */
  const trancheSuivante = useCallback(
    (precedente: Tranche | undefined, avance: number): Tranche => {
      const ouverture = Math.max(H * 0.18, H * reglage.couloir - avance / 22);
      if (!precedente) {
        const plafond = (H - ouverture) / 2;
        return { plafond, sol: plafond + ouverture, bloc: null };
      }
      // Le couloir ondule doucement.
      const derive = randBetween(-6, 6);
      const plafond = clamp(precedente.plafond + derive, 10, H - ouverture - 10);
      // Un obstacle central de temps en temps.
      const bloc =
        Math.random() < 0.035 && avance > 200
          ? { haut: plafond + ouverture * 0.32, bas: plafond + ouverture * 0.68 }
          : null;
      return { plafond, sol: plafond + ouverture, bloc };
    },
    [H, reglage.couloir],
  );

  const reset = useCallback(() => {
    y.current = H / 2;
    vy.current = 0;
    monte.current = false;
    decalage.current = 0;
    distanceRef.current = 0;
    vivant.current = true;

    const initiales: Tranche[] = [];
    for (let i = 0; i < NB_TRANCHES; i++) {
      initiales.push(trancheSuivante(initiales[i - 1], 0));
    }
    tranches.current = initiales;

    setDistance(0);
    setOver(false);
    setDemarre(false);
    setRecord(false);
  }, [H, NB_TRANCHES, trancheSuivante]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, reset]);

  const pas = useCallback(() => {
    if (!vivant.current || !demarre) return;

    vy.current += monte.current ? -reglage.poussee : reglage.gravite;
    vy.current = clamp(vy.current, -5.5, 5.5);
    y.current += vy.current;

    decalage.current += reglage.vitesse;
    while (decalage.current >= LARGEUR_TRANCHE) {
      decalage.current -= LARGEUR_TRANCHE;
      const derniere = tranches.current[tranches.current.length - 1];
      tranches.current = [...tranches.current.slice(1), trancheSuivante(derniere, distanceRef.current)];
    }

    distanceRef.current += reglage.vitesse / 7;
    setDistance(Math.floor(distanceRef.current));

    // Tranche située sous l'appareil.
    const index = Math.floor((X_APPAREIL + decalage.current) / LARGEUR_TRANCHE);
    const tranche = tranches.current[index];
    if (tranche) {
      const haut = y.current - TAILLE / 2;
      const bas = y.current + TAILLE / 2;
      const touche =
        haut < tranche.plafond ||
        bas > tranche.sol ||
        (tranche.bloc !== null && bas > tranche.bloc.haut && haut < tranche.bloc.bas);

      if (touche) {
        vivant.current = false;
        setOver(true);
        haptic('error');
        setRecord(submitScore(Math.floor(distanceRef.current)));
        return;
      }
    }

    rendre((n) => (n + 1) % 1000);
  }, [demarre, reglage, X_APPAREIL, TAILLE, trancheSuivante, haptic, submitScore]);

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

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: W }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'balade', label: 'Balade' },
            { value: 'normal', label: 'Normal' },
            { value: 'sportif', label: 'Sportif' },
          ]}
          accent="#F0A030"
        />
      </View>

      <Pressable
        onPressIn={() => {
          if (!demarre) setDemarre(true);
          monte.current = true;
          haptic('light');
        }}
        onPressOut={() => {
          monte.current = false;
        }}
        accessibilityRole="button"
        accessibilityLabel="Maintenir pour monter"
      >
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: '#1A1410',
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {tranches.current.map((tranche, i) => {
            const x = i * LARGEUR_TRANCHE - decalage.current;
            return (
              <React.Fragment key={i}>
                <View
                  style={{
                    position: 'absolute',
                    left: x,
                    top: 0,
                    width: LARGEUR_TRANCHE + 1,
                    height: tranche.plafond,
                    backgroundColor: '#6B4F35',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: x,
                    top: tranche.sol,
                    width: LARGEUR_TRANCHE + 1,
                    height: H - tranche.sol,
                    backgroundColor: '#6B4F35',
                  }}
                />
                {tranche.bloc ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: x,
                      top: tranche.bloc.haut,
                      width: LARGEUR_TRANCHE + 1,
                      height: tranche.bloc.bas - tranche.bloc.haut,
                      backgroundColor: '#8A6444',
                    }}
                  />
                ) : null}
              </React.Fragment>
            );
          })}

          <View
            style={{
              position: 'absolute',
              left: X_APPAREIL - TAILLE / 2,
              top: y.current - TAILLE / 2,
              width: TAILLE,
              height: TAILLE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ fontSize: TAILLE * 0.9 }}>🚁</Txt>
          </View>

          {!demarre && !over ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: H / 2 - 20, alignItems: 'center' }}>
              <Txt variant="h3" style={{ color: '#FFFFFF' }}>
                Maintiens pour décoller
              </Txt>
            </View>
          ) : null}
        </View>
      </Pressable>

      <GameOver
        visible={over}
        outcome="over"
        title="Écrasé contre la roche"
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
