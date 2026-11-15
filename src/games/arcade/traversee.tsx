import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { CroixDirectionnelle, Row, Txt, GameOver, useClavier, type Direction } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'traversee',
  name: 'Traversée',
  tagline: 'La route, puis la rivière. Saute de case en case sans te faire écraser.',
  category: 'arcade',
  emoji: '🐸',
  difficulty: 2,
  players: '1',
  minutes: 5,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['culte', 'réflexe', 'solo'],
  rules: [
    'Avance case par case avec les boutons ou les flèches du clavier.',
    'Sur la route, évite les véhicules : un contact et tu perds une vie.',
    'Sur la rivière, il faut monter sur les troncs — l’eau est mortelle, et les troncs t’emportent.',
    'Atteins le haut pour marquer, puis recommence plus vite. Trois vies.',
  ],
};

const COLONNES = 11;
const RANGEES = 11;

type TypeVoie = 'depart' | 'route' | 'berge' | 'riviere' | 'arrivee';

interface Voie {
  type: TypeVoie;
  vitesse: number;
  /** Position du premier élément ; les autres sont espacés régulièrement. */
  decalage: number;
  espacement: number;
  longueur: number;
}

/** Cinq voies de route, une berge, quatre de rivière. */
function construireVoies(niveau: number): Voie[] {
  const voies: Voie[] = [{ type: 'arrivee', vitesse: 0, decalage: 0, espacement: 0, longueur: 0 }];

  for (let i = 0; i < 4; i++) {
    voies.push({
      type: 'riviere',
      vitesse: (i % 2 === 0 ? 1 : -1) * (0.6 + Math.random() * 0.5 + niveau * 0.12),
      decalage: Math.random() * 4,
      espacement: randBetween(4, 5),
      longueur: randBetween(2, 3),
    });
  }

  voies.push({ type: 'berge', vitesse: 0, decalage: 0, espacement: 0, longueur: 0 });

  for (let i = 0; i < 5; i++) {
    voies.push({
      type: 'route',
      vitesse: (i % 2 === 0 ? -1 : 1) * (0.7 + Math.random() * 0.6 + niveau * 0.15),
      decalage: Math.random() * 4,
      espacement: randBetween(3, 5),
      longueur: 1,
    });
  }

  voies.push({ type: 'depart', vitesse: 0, decalage: 0, espacement: 0, longueur: 0 });
  return voies;
}

/** Positions occupées par les objets d'une voie, en colonnes fractionnaires. */
function objetsDeLaVoie(voie: Voie): number[] {
  if (voie.espacement === 0) return [];
  const out: number[] = [];
  for (let base = -voie.espacement; base < COLONNES + voie.espacement; base += voie.espacement) {
    out.push(((base + voie.decalage) % (COLONNES + voie.espacement) + COLONNES + voie.espacement) %
      (COLONNES + voie.espacement) - voie.espacement);
  }
  return out;
}

export default function Traversee({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 380);
  const CASE = Math.floor(W / COLONNES);
  const H = CASE * RANGEES;

  const [score, setScore] = useState(0);
  const [vies, setVies] = useState(3);
  const [niveau, setNiveau] = useState(1);
  const [over, setOver] = useState(false);
  const [, rendre] = useState(0);
  const [record, setRecord] = useState(false);

  const voies = useRef<Voie[]>(construireVoies(1));
  /** Position du personnage : colonne fractionnaire, rangée entière. */
  const perso = useRef({ colonne: Math.floor(COLONNES / 2), rangee: RANGEES - 1 });
  const scoreRef = useRef(0);
  const viesRef = useRef(3);
  const niveauRef = useRef(1);
  const vivant = useRef(true);

  const reset = useCallback(() => {
    voies.current = construireVoies(1);
    perso.current = { colonne: Math.floor(COLONNES / 2), rangee: RANGEES - 1 };
    scoreRef.current = 0;
    viesRef.current = 3;
    niveauRef.current = 1;
    vivant.current = true;
    setScore(0);
    setVies(3);
    setNiveau(1);
    setOver(false);
    setRecord(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  const perdreUneVie = useCallback(() => {
    viesRef.current -= 1;
    setVies(viesRef.current);
    haptic('error');
    if (viesRef.current <= 0) {
      vivant.current = false;
      setOver(true);
      setRecord(submitScore(scoreRef.current));
      return;
    }
    perso.current = { colonne: Math.floor(COLONNES / 2), rangee: RANGEES - 1 };
  }, [haptic, submitScore]);

  const deplacer = useCallback(
    (direction: Direction) => {
      if (!vivant.current) return;
      const p = perso.current;
      haptic('light');

      if (direction === 'haut' && p.rangee > 0) p.rangee -= 1;
      else if (direction === 'bas' && p.rangee < RANGEES - 1) p.rangee += 1;
      else if (direction === 'gauche' && p.colonne > 0) p.colonne -= 1;
      else if (direction === 'droite' && p.colonne < COLONNES - 1) p.colonne += 1;

      // Arrivée atteinte.
      if (p.rangee === 0) {
        scoreRef.current += 100 * niveauRef.current;
        setScore(scoreRef.current);
        niveauRef.current += 1;
        setNiveau(niveauRef.current);
        voies.current = construireVoies(niveauRef.current);
        perso.current = { colonne: Math.floor(COLONNES / 2), rangee: RANGEES - 1 };
        haptic('success');
      }
    },
    [haptic],
  );

  const pas = useCallback(() => {
    if (!vivant.current) return;

    // Les voies défilent.
    voies.current = voies.current.map((voie) =>
      voie.espacement === 0
        ? voie
        : { ...voie, decalage: voie.decalage + voie.vitesse / 26 },
    );

    const p = perso.current;
    const voie = voies.current[p.rangee];
    if (!voie) return;

    if (voie.type === 'route') {
      const touche = objetsDeLaVoie(voie).some(
        (x) => p.colonne + 0.5 > x && p.colonne + 0.5 < x + voie.longueur,
      );
      if (touche) {
        perdreUneVie();
        return;
      }
    } else if (voie.type === 'riviere') {
      const tronc = objetsDeLaVoie(voie).find(
        (x) => p.colonne + 0.5 > x && p.colonne + 0.5 < x + voie.longueur,
      );
      if (tronc === undefined) {
        perdreUneVie();
        return;
      }
      // Le tronc emporte le personnage.
      p.colonne += voie.vitesse / 26;
      if (p.colonne < -0.5 || p.colonne > COLONNES - 0.5) {
        perdreUneVie();
        return;
      }
    }

    rendre((n) => (n + 1) % 1000);
  }, [perdreUneVie]);

  useRafLoop(pas, !over);

  useClavier(
    {
      ArrowUp: () => deplacer('haut'),
      ArrowDown: () => deplacer('bas'),
      ArrowLeft: () => deplacer('gauche'),
      ArrowRight: () => deplacer('droite'),
    },
    !over,
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {score} pts
      </Txt>
      <Txt variant="label" tone="faint">
        Niv. {niveau}
      </Txt>
      <Txt variant="label" tone="danger">
        {'🐸'.repeat(Math.max(0, vies))}
      </Txt>
    </Row>,
  );

  const couleurVoie: Record<TypeVoie, string> = {
    depart: '#3A6B3A',
    berge: '#3A6B3A',
    arrivee: '#2E8B57',
    route: '#2B2B33',
    riviere: '#1E4E79',
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View
        style={{
          width: CASE * COLONNES,
          height: H,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        {voies.current.map((voie, r) => (
          <View
            key={r}
            style={{
              position: 'absolute',
              top: r * CASE,
              left: 0,
              width: CASE * COLONNES,
              height: CASE,
              backgroundColor: couleurVoie[voie.type],
            }}
          >
            {objetsDeLaVoie(voie).map((x, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: x * CASE,
                  top: CASE * 0.12,
                  width: CASE * voie.longueur - 3,
                  height: CASE * 0.76,
                  borderRadius: 4,
                  backgroundColor: voie.type === 'riviere' ? '#7A5230' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {voie.type === 'route' ? (
                  <Txt style={{ fontSize: CASE * 0.7 }}>{voie.vitesse > 0 ? '🚗' : '🚙'}</Txt>
                ) : null}
              </View>
            ))}
          </View>
        ))}

        <View
          style={{
            position: 'absolute',
            left: perso.current.colonne * CASE,
            top: perso.current.rangee * CASE,
            width: CASE,
            height: CASE,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt style={{ fontSize: CASE * 0.8 }}>🐸</Txt>
        </View>
      </View>

      <CroixDirectionnelle onDirection={deplacer} taille={46} tint="#F0A03033" />

      <GameOver
        visible={over}
        outcome="over"
        title="Plus de vies"
        score={score}
        best={best}
        isRecord={record}
        detail={`Niveau ${niveau} atteint`}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
