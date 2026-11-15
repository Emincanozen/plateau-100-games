import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { BoutonControle, Row, Txt, GameOver, useClavier } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { clamp, randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'envahisseurs',
  name: 'Envahisseurs',
  tagline: 'Ils descendent en rangs serrés. Tire avant qu’ils te touchent.',
  category: 'arcade',
  emoji: '👾',
  difficulty: 2,
  players: '1',
  minutes: 6,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['culte', 'réflexe', 'solo'],
  rules: [
    'Déplace ton vaisseau avec les boutons, ou les flèches du clavier.',
    'Tire pour détruire les envahisseurs : les rangées du fond valent plus cher.',
    'À chaque fois qu’ils touchent un bord, ils descendent d’un cran et accélèrent.',
    'Ils tirent aussi. Trois vies, et la partie s’arrête s’ils atteignent ton niveau.',
  ],
};

const COLONNES = 7;
const RANGEES = 4;

interface Tir {
  x: number;
  y: number;
}

export default function Envahisseurs({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 420);
  const H = Math.min(winHeight * 0.52, 480);
  const TAILLE = Math.floor(W / (COLONNES * 1.8));
  const PAS_X = Math.floor(W / (COLONNES + 1));
  const VAISSEAU_Y = H - 30;

  const [score, setScore] = useState(0);
  const [vies, setVies] = useState(3);
  const [vague, setVague] = useState(1);
  const [over, setOver] = useState(false);
  const [gagne, setGagne] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const vaisseau = useRef(W / 2);
  /** Un envahisseur vivant par case, ou null. */
  const grille = useRef<boolean[]>([]);
  const decalage = useRef({ x: 0, y: 0, sens: 1 });
  const mesTirs = useRef<Tir[]>([]);
  const leursTirs = useRef<Tir[]>([]);
  const scoreRef = useRef(0);
  const viesRef = useRef(3);
  const vagueRef = useRef(1);
  const vivant = useRef(true);
  const cadence = useRef(0);

  const reset = useCallback(() => {
    grille.current = Array(COLONNES * RANGEES).fill(true);
    decalage.current = { x: 0, y: 0, sens: 1 };
    mesTirs.current = [];
    leursTirs.current = [];
    scoreRef.current = 0;
    viesRef.current = 3;
    vagueRef.current = 1;
    vivant.current = true;
    vaisseau.current = W / 2;
    setScore(0);
    setVies(3);
    setVague(1);
    setOver(false);
    setGagne(false);
    setRecord(false);
  }, [W]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  const terminer = useCallback(
    (victoire: boolean) => {
      vivant.current = false;
      setOver(true);
      setGagne(victoire);
      haptic(victoire ? 'success' : 'error');
      setRecord(submitScore(scoreRef.current));
    },
    [haptic, submitScore],
  );

  const tirer = useCallback(() => {
    if (!vivant.current) return;
    // Deux tirs à l'écran au maximum : ça force à viser.
    if (mesTirs.current.length >= 2) return;
    haptic('light');
    mesTirs.current.push({ x: vaisseau.current, y: VAISSEAU_Y - 12 });
  }, [haptic, VAISSEAU_Y]);

  const bouger = useCallback(
    (delta: number) => {
      if (!vivant.current) return;
      vaisseau.current = clamp(vaisseau.current + delta, TAILLE / 2, W - TAILLE / 2);
    },
    [TAILLE, W],
  );

  /** Position à l'écran d'un envahisseur de la grille. */
  const positionDe = useCallback(
    (index: number) => {
      const colonne = index % COLONNES;
      const rangee = Math.floor(index / COLONNES);
      return {
        x: PAS_X * (colonne + 1) + decalage.current.x,
        y: 40 + rangee * (TAILLE + 10) + decalage.current.y,
      };
    },
    [PAS_X, TAILLE],
  );

  const pas = useCallback(() => {
    if (!vivant.current) return;
    const vivants = grille.current.filter(Boolean).length;

    // Plus il en reste peu, plus ils vont vite. Chaque vague accélère aussi.
    const vitesse = (0.35 + (COLONNES * RANGEES - vivants) * 0.05) * (1 + (vagueRef.current - 1) * 0.3);
    decalage.current.x += vitesse * decalage.current.sens;

    // Rebond sur les bords : ils descendent d'un cran.
    const xs = grille.current
      .map((vivantCase, i) => (vivantCase ? positionDe(i).x : null))
      .filter((x): x is number => x !== null);
    if (xs.length > 0) {
      const gauche = Math.min(...xs);
      const droite = Math.max(...xs);
      if (droite > W - TAILLE / 2 || gauche < TAILLE / 2) {
        decalage.current.sens *= -1;
        decalage.current.y += 14;
        decalage.current.x += vitesse * decalage.current.sens * 2;
      }
    }

    // Tirs du joueur.
    mesTirs.current = mesTirs.current.map((t) => ({ ...t, y: t.y - 7 })).filter((t) => t.y > -10);
    for (const tir of mesTirs.current) {
      for (let i = 0; i < grille.current.length; i++) {
        if (!grille.current[i]) continue;
        const p = positionDe(i);
        if (Math.abs(tir.x - p.x) < TAILLE / 2 && Math.abs(tir.y - p.y) < TAILLE / 2) {
          grille.current[i] = false;
          mesTirs.current = mesTirs.current.filter((t) => t !== tir);
          // Les rangées du fond rapportent davantage.
          scoreRef.current += (RANGEES - Math.floor(i / COLONNES)) * 10;
          setScore(scoreRef.current);
          haptic('medium');
          break;
        }
      }
    }

    // Tirs ennemis : une colonne au hasard, depuis son envahisseur le plus bas.
    cadence.current += 1;
    if (cadence.current > Math.max(28, 70 - vagueRef.current * 8)) {
      cadence.current = 0;
      const colonne = randInt(COLONNES);
      let plusBas = -1;
      for (let r = 0; r < RANGEES; r++) {
        if (grille.current[r * COLONNES + colonne]) plusBas = r * COLONNES + colonne;
      }
      if (plusBas >= 0) {
        const p = positionDe(plusBas);
        leursTirs.current.push({ x: p.x, y: p.y + TAILLE / 2 });
      }
    }

    leursTirs.current = leursTirs.current.map((t) => ({ ...t, y: t.y + 4 })).filter((t) => t.y < H + 10);
    for (const tir of leursTirs.current) {
      if (Math.abs(tir.x - vaisseau.current) < TAILLE / 2 && Math.abs(tir.y - VAISSEAU_Y) < 14) {
        leursTirs.current = leursTirs.current.filter((t) => t !== tir);
        viesRef.current -= 1;
        setVies(viesRef.current);
        haptic('error');
        if (viesRef.current <= 0) {
          terminer(false);
          return;
        }
      }
    }

    // Ils ont atteint le vaisseau.
    const plusBasY = Math.max(
      ...grille.current.map((vivantCase, i) => (vivantCase ? positionDe(i).y : 0)),
    );
    if (plusBasY > VAISSEAU_Y - TAILLE) {
      terminer(false);
      return;
    }

    // Vague suivante.
    if (vivants === 0) {
      vagueRef.current += 1;
      setVague(vagueRef.current);
      if (vagueRef.current > 3) {
        terminer(true);
        return;
      }
      grille.current = Array(COLONNES * RANGEES).fill(true);
      decalage.current = { x: 0, y: 0, sens: 1 };
      mesTirs.current = [];
      leursTirs.current = [];
      haptic('success');
    }

    rendre((n) => (n + 1) % 1000);
  }, [W, H, TAILLE, VAISSEAU_Y, positionDe, haptic, terminer]);

  useRafLoop(pas, !over);

  useClavier(
    {
      ArrowLeft: () => bouger(-14),
      ArrowRight: () => bouger(14),
      Space: tirer,
      KeyQ: () => bouger(-14),
      KeyD: () => bouger(14),
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

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View
        style={{
          width: W,
          height: H,
          backgroundColor: '#0A0A14',
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        {grille.current.map((vivantCase, i) => {
          if (!vivantCase) return null;
          const p = positionDe(i);
          const rangee = Math.floor(i / COLONNES);
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: p.x - TAILLE / 2,
                top: p.y - TAILLE / 2,
                width: TAILLE,
                height: TAILLE,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt style={{ fontSize: TAILLE * 0.85 }}>
                {rangee === 0 ? '👾' : rangee === 1 ? '🛸' : rangee === 2 ? '👽' : '🤖'}
              </Txt>
            </View>
          );
        })}

        {mesTirs.current.map((tir, i) => (
          <View
            key={`m${i}`}
            style={{
              position: 'absolute',
              left: tir.x - 2,
              top: tir.y,
              width: 4,
              height: 12,
              borderRadius: 2,
              backgroundColor: '#4BC4D6',
            }}
          />
        ))}

        {leursTirs.current.map((tir, i) => (
          <View
            key={`l${i}`}
            style={{
              position: 'absolute',
              left: tir.x - 2,
              top: tir.y,
              width: 4,
              height: 12,
              borderRadius: 2,
              backgroundColor: '#E0525F',
            }}
          />
        ))}

        <View
          style={{
            position: 'absolute',
            left: vaisseau.current - TAILLE / 2,
            top: VAISSEAU_Y - TAILLE / 2,
            width: TAILLE,
            height: TAILLE,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt style={{ fontSize: TAILLE * 0.9 }}>🚀</Txt>
        </View>
      </View>

      <Row gap={space.md}>
        <BoutonControle glyphe="◀" label="Gauche" repeter onPress={() => bouger(-14)} />
        <BoutonControle glyphe="🔥" label="Tirer" tint="#F0A03033" onPress={tirer} taille={66} />
        <BoutonControle glyphe="▶" label="Droite" repeter onPress={() => bouger(14)} />
      </Row>

      <Txt variant="caption" tone="faint">
        Flèches et espace au clavier
      </Txt>

      <GameOver
        visible={over}
        outcome={gagne ? 'win' : 'over'}
        title={gagne ? 'Invasion repoussée !' : 'Vaisseau détruit'}
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
