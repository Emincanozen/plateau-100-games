import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'flappy',
  name: 'Envol',
  tagline: 'Un tapotement pour battre des ailes, et surtout ne rien toucher.',
  category: 'arcade',
  emoji: '🐤',
  difficulty: 2,
  players: '1',
  minutes: 3,
  score: 'high',
  scoreUnit: 'passages',
  tags: ['réflexe', 'solo', 'nerveux'],
  rules: [
    'Touche l’écran pour donner un coup d’aile : l’oiseau monte puis retombe.',
    'Passe entre les tuyaux sans les effleurer ni toucher le sol.',
    'Chaque tuyau franchi vaut un point.',
    'Le rythme reste constant : tout est une affaire de régularité.',
  ],
};

interface Tuyau {
  x: number;
  trou: number;
  compte: boolean;
}

type Niveau = 'tranquille' | 'normal' | 'nerveux';

/**
 * Reglages volontairement doux : l'oiseau doit planer, pas tomber comme une pierre.
 * `chute` plafonne la vitesse de descente, c'est ce qui rend le vol rattrapable.
 */
const NIVEAUX: Record<Niveau, { gravite: number; impulsion: number; vitesse: number; chute: number; trou: number }> = {
  tranquille: { gravite: 0.26, impulsion: -6.2, vitesse: 1.7, chute: 5.5, trou: 0.34 },
  normal: { gravite: 0.34, impulsion: -6.8, vitesse: 2.1, chute: 6.5, trou: 0.29 },
  nerveux: { gravite: 0.44, impulsion: -7.6, vitesse: 2.7, chute: 8, trou: 0.24 },
};

const RAYON = 13;

export default function Flappy({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 400);
  const H = Math.min(winHeight * 0.68, 620);

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const reglage = NIVEAUX[niveau];
  const TROU = Math.max(155, H * reglage.trou);
  const LARGEUR_TUYAU = 52;
  const ESPACEMENT = Math.max(230, W * 0.72);

  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [demarre, setDemarre] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const oiseau = useRef({ y: H / 2, v: 0 });
  const tuyaux = useRef<Tuyau[]>([]);
  const scoreRef = useRef(0);
  const vivant = useRef(true);

  const nouveauTuyau = useCallback(
    (x: number): Tuyau => ({
      x,
      trou: randBetween(Math.floor(TROU * 0.7), Math.floor(H - TROU * 1.3)),
      compte: false,
    }),
    [H, TROU],
  );

  const reset = useCallback(() => {
    oiseau.current = { y: H / 2, v: 0 };
    tuyaux.current = [nouveauTuyau(W + 60), nouveauTuyau(W + 60 + ESPACEMENT)];
    scoreRef.current = 0;
    vivant.current = true;
    setScore(0);
    setOver(false);
    setDemarre(false);
    setRecord(false);
  }, [H, W, nouveauTuyau]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, reset]);

  const battre = () => {
    if (over) return;
    if (!demarre) setDemarre(true);
    haptic('light');
    oiseau.current.v = reglage.impulsion;
  };

  const pas = useCallback(() => {
    if (!vivant.current || !demarre) return;

    const o = oiseau.current;
    o.v += reglage.gravite;
    // Vitesse de chute plafonnee : sans ca, l'oiseau devient increcuperable.
    if (o.v > reglage.chute) o.v = reglage.chute;
    o.y += o.v;

    tuyaux.current = tuyaux.current.map((t) => ({ ...t, x: t.x - reglage.vitesse }));

    // Recyclage du tuyau sorti a gauche.
    if (tuyaux.current[0] && tuyaux.current[0].x < -LARGEUR_TUYAU) {
      const dernier = tuyaux.current[tuyaux.current.length - 1];
      tuyaux.current = [...tuyaux.current.slice(1), nouveauTuyau(dernier.x + ESPACEMENT)];
    }

    const x = W * 0.28;

    for (const t of tuyaux.current) {
      if (!t.compte && t.x + LARGEUR_TUYAU < x - RAYON) {
        t.compte = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
        haptic('success');
      }

      const chevauche = x + RAYON > t.x && x - RAYON < t.x + LARGEUR_TUYAU;
      const dansLeTrou = o.y - RAYON > t.trou && o.y + RAYON < t.trou + TROU;
      if (chevauche && !dansLeTrou) {
        vivant.current = false;
        setOver(true);
        haptic('error');
        setRecord(submitScore(scoreRef.current));
        return;
      }
    }

    if (o.y + RAYON > H || o.y - RAYON < 0) {
      vivant.current = false;
      setOver(true);
      haptic('error');
      setRecord(submitScore(scoreRef.current));
      return;
    }

    rendre((n) => (n + 1) % 1000);
  }, [demarre, reglage, W, H, TROU, LARGEUR_TUYAU, ESPACEMENT, nouveauTuyau, haptic, submitScore]);

  useRafLoop(pas, !over);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {score}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  const o = oiseau.current;
  const xOiseau = W * 0.28;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: W }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'tranquille', label: 'Tranquille' },
            { value: 'normal', label: 'Normal' },
            { value: 'nerveux', label: 'Nerveux' },
          ]}
          accent="#F0A030"
        />
      </View>

      <Pressable onPress={battre} accessibilityRole="button" accessibilityLabel="Battre des ailes">
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: '#1B2A4A',
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {tuyaux.current.map((t, i) => (
            <React.Fragment key={i}>
              <View
                style={{
                  position: 'absolute',
                  left: t.x,
                  top: 0,
                  width: LARGEUR_TUYAU,
                  height: t.trou,
                  backgroundColor: '#34B37E',
                  borderBottomLeftRadius: 6,
                  borderBottomRightRadius: 6,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: t.x,
                  top: t.trou + TROU,
                  width: LARGEUR_TUYAU,
                  height: H - t.trou - TROU,
                  backgroundColor: '#34B37E',
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                }}
              />
            </React.Fragment>
          ))}

          <View
            style={{
              position: 'absolute',
              left: xOiseau - RAYON,
              top: o.y - RAYON,
              width: RAYON * 2,
              height: RAYON * 2,
              borderRadius: RAYON,
              backgroundColor: '#EFB93B',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ fontSize: RAYON * 1.3 }}>🐤</Txt>
          </View>

          {!demarre && !over ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: H / 2 - 40,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Txt variant="h3" style={{ color: '#FFFFFF' }}>
                Touche pour décoller
              </Txt>
              <Txt variant="caption" style={{ color: '#FFFFFF99' }}>
                Un tapotement = un coup d’aile
              </Txt>
            </View>
          ) : null}
        </View>
      </Pressable>

      <GameOver
        visible={over}
        outcome="over"
        title="Atterrissage forcé"
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
