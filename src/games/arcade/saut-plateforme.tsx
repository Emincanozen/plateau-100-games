import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { BoutonControle, Row, Txt, GameOver, useClavier } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { clamp, randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'saut-plateforme',
  name: 'Saut de plateforme',
  tagline: 'Rebondis de plateforme en plateforme, toujours plus haut.',
  category: 'arcade',
  emoji: '🦘',
  difficulty: 2,
  players: '1',
  minutes: 4,
  score: 'high',
  scoreUnit: 'm',
  tags: ['réflexe', 'solo', 'ascension'],
  rules: [
    'Le personnage rebondit tout seul dès qu’il touche une plateforme.',
    'Glisse ton doigt ou utilise les boutons pour le déplacer à gauche et à droite.',
    'Les bords sont reliés : sortir à droite fait réapparaître à gauche.',
    'Les plateformes vertes propulsent plus haut, les brunes s’effondrent après un rebond. Tomber en bas termine la partie.',
  ],
};

type TypePlateforme = 'normale' | 'ressort' | 'fragile';

interface Plateforme {
  x: number;
  y: number;
  type: TypePlateforme;
  utilisee: boolean;
}

const LARGEUR_PLATEFORME = 62;
const HAUTEUR_PLATEFORME = 12;
const GRAVITE = 0.32;
const REBOND = -9.4;
const REBOND_RESSORT = -14;

export default function SautPlateforme({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 380);
  const H = Math.min(winHeight * 0.62, 560);
  const TAILLE = 28;

  const [hauteur, setHauteur] = useState(0);
  const [over, setOver] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const perso = useRef({ x: W / 2, y: H - 80, vx: 0, vy: 0 });
  const plateformes = useRef<Plateforme[]>([]);
  /** Hauteur totale gravie, en pixels de défilement. */
  const altitude = useRef(0);
  const vivant = useRef(true);

  const nouvellePlateforme = useCallback(
    (y: number, altitudeCourante: number): Plateforme => {
      const tirage = Math.random();
      // Les plateformes spéciales n'apparaissent qu'après un peu d'ascension.
      const type: TypePlateforme =
        altitudeCourante > 600 && tirage < 0.12
          ? 'ressort'
          : altitudeCourante > 900 && tirage < 0.3
            ? 'fragile'
            : 'normale';
      return {
        x: randBetween(0, Math.floor(W - LARGEUR_PLATEFORME)),
        y,
        type,
        utilisee: false,
      };
    },
    [W],
  );

  const reset = useCallback(() => {
    perso.current = { x: W / 2, y: H - 80, vx: 0, vy: 0 };
    altitude.current = 0;
    vivant.current = true;

    // Une plateforme de départ sous le personnage, puis un escalier régulier.
    const initiales: Plateforme[] = [
      { x: W / 2 - LARGEUR_PLATEFORME / 2, y: H - 40, type: 'normale', utilisee: false },
    ];
    for (let y = H - 110; y > -H; y -= randBetween(58, 86)) {
      initiales.push(nouvellePlateforme(y, 0));
    }
    plateformes.current = initiales;

    setHauteur(0);
    setOver(false);
    setRecord(false);
  }, [W, H, nouvellePlateforme]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  const pas = useCallback(() => {
    if (!vivant.current) return;
    const p = perso.current;

    p.vy += GRAVITE;
    p.y += p.vy;
    p.x += p.vx;
    p.vx *= 0.9; // frottement, le déplacement s'amortit

    // Bords reliés.
    if (p.x < -TAILLE) p.x = W;
    else if (p.x > W) p.x = -TAILLE;

    // Rebond : seulement en descente, et sur le dessus de la plateforme.
    if (p.vy > 0) {
      for (const plateforme of plateformes.current) {
        if (plateforme.utilisee && plateforme.type === 'fragile') continue;
        const dansX = p.x + TAILLE > plateforme.x && p.x < plateforme.x + LARGEUR_PLATEFORME;
        const dansY = p.y + TAILLE > plateforme.y && p.y + TAILLE < plateforme.y + HAUTEUR_PLATEFORME + 12;
        if (dansX && dansY) {
          p.vy = plateforme.type === 'ressort' ? REBOND_RESSORT : REBOND;
          plateforme.utilisee = true;
          haptic(plateforme.type === 'ressort' ? 'medium' : 'light');
          break;
        }
      }
    }

    // Défilement : le décor descend quand le personnage monte au-dessus du tiers.
    const seuil = H * 0.35;
    if (p.y < seuil) {
      const montee = seuil - p.y;
      p.y = seuil;
      altitude.current += montee;
      setHauteur(Math.floor(altitude.current / 10));
      plateformes.current = plateformes.current.map((plateforme) => ({
        ...plateforme,
        y: plateforme.y + montee,
      }));
    }

    // Recyclage : on remplace celles sorties par le bas.
    plateformes.current = plateformes.current.filter((plateforme) => plateforme.y < H + 40);
    while (plateformes.current.length < 12) {
      const plusHaute = plateformes.current.reduce(
        (min, plateforme) => Math.min(min, plateforme.y),
        H,
      );
      plateformes.current.push(nouvellePlateforme(plusHaute - randBetween(58, 86), altitude.current));
    }

    if (p.y > H + 40) {
      vivant.current = false;
      setOver(true);
      haptic('error');
      setRecord(submitScore(Math.floor(altitude.current / 10)));
      return;
    }

    rendre((n) => (n + 1) % 1000);
  }, [W, H, TAILLE, nouvellePlateforme, haptic, submitScore]);

  useRafLoop(pas, !over);

  const pousser = useCallback((delta: number) => {
    if (!vivant.current) return;
    perso.current.vx = clamp(perso.current.vx + delta, -7, 7);
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          // Le doigt attire le personnage : plus il est loin, plus ça pousse.
          const ecart = e.x - (perso.current.x + TAILLE / 2);
          perso.current.vx = clamp(ecart * 0.16, -7, 7);
        }),
    [TAILLE],
  );

  useClavier(
    {
      ArrowLeft: () => pousser(-2.4),
      ArrowRight: () => pousser(2.4),
      KeyQ: () => pousser(-2.4),
      KeyD: () => pousser(2.4),
    },
    !over,
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {hauteur} m
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best} m
        </Txt>
      ) : null}
    </Row>,
  );

  const couleur: Record<TypePlateforme, string> = {
    normale: '#7C9CF0',
    ressort: '#34B37E',
    fragile: '#8A6444',
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <GestureDetector gesture={pan}>
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: '#12182B',
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {plateformes.current.map((plateforme, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: plateforme.x,
                top: plateforme.y,
                width: LARGEUR_PLATEFORME,
                height: HAUTEUR_PLATEFORME,
                borderRadius: 6,
                backgroundColor: couleur[plateforme.type],
                opacity: plateforme.utilisee && plateforme.type === 'fragile' ? 0.25 : 1,
              }}
            />
          ))}

          <View
            style={{
              position: 'absolute',
              left: perso.current.x,
              top: perso.current.y,
              width: TAILLE,
              height: TAILLE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ fontSize: TAILLE * 0.9 }}>🦘</Txt>
          </View>
        </View>
      </GestureDetector>

      <Row gap={space.xl}>
        <BoutonControle glyphe="◀" label="Gauche" repeter onPress={() => pousser(-2.4)} />
        <BoutonControle glyphe="▶" label="Droite" repeter onPress={() => pousser(2.4)} />
      </Row>

      <GameOver
        visible={over}
        outcome="over"
        title="Chute"
        score={`${hauteur} m`}
        best={best !== undefined ? `${best} m` : undefined}
        isRecord={record}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
