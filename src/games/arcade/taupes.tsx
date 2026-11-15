import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useInterval } from '../lib/hooks';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'taupes',
  name: 'Chasse aux taupes',
  tagline: 'Elles sortent, tu tapes. Mais attention aux bombes.',
  category: 'arcade',
  emoji: '🦔',
  difficulty: 1,
  players: '1',
  minutes: 2,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['réflexe', 'solo', 'famille'],
  rules: [
    'Les taupes sortent des trous pendant une fraction de seconde : touche-les avant qu’elles rentrent.',
    'Chaque taupe attrapée rapporte des points ; les plus rapides en rapportent plus.',
    'Une bombe touchée coûte cinq points : regarde avant de taper.',
    'Tu as soixante secondes.',
  ],
};

type Vitesse = 'tranquille' | 'rapide' | 'frenetique';

const REGLAGES: Record<Vitesse, { apparition: number; duree: number; bombes: number }> = {
  tranquille: { apparition: 850, duree: 1500, bombes: 0.12 },
  rapide: { apparition: 600, duree: 1050, bombes: 0.18 },
  frenetique: { apparition: 380, duree: 780, bombes: 0.25 },
};

const TROUS = 9;
const DUREE_PARTIE = 60;

interface Occupant {
  type: 'taupe' | 'bombe';
  ne: number;
}

export default function Taupes({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.5);
  const gap = 10;
  const cellule = Math.floor((largeur - gap * 4) / 3);

  const [vitesse, setVitesse] = useState<Vitesse>('rapide');
  const [occupants, setOccupants] = useState<(Occupant | null)[]>(Array(TROUS).fill(null));
  const [score, setScore] = useState(0);
  const [restant, setRestant] = useState(DUREE_PARTIE);
  const [record, setRecord] = useState(false);
  /** Le chrono et les apparitions n'existent qu'une fois la partie lancee. */
  const [demarre, setDemarre] = useState(false);
  const scoreRef = useRef(0);
  const fini = restant <= 0;

  const reset = useCallback(() => {
    setOccupants(Array(TROUS).fill(null));
    setScore(0);
    scoreRef.current = 0;
    setRestant(DUREE_PARTIE);
    setRecord(false);
    setDemarre(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [vitesse, reset]);

  useInterval(() => setRestant((s) => Math.max(0, s - 1)), fini || !demarre ? null : 1000);

  const comptee = useRef(false);
  useEffect(() => {
    if (!fini || !demarre) {
      comptee.current = false;
      return;
    }
    if (comptee.current) return;
    comptee.current = true;
    haptic('success');
    setRecord(submitScore(scoreRef.current));
  }, [fini, demarre, haptic, submitScore]);

  const reglage = REGLAGES[vitesse];

  // Apparitions.
  useInterval(() => {
    setOccupants((actuels) => {
      const libres = actuels.map((o, i) => (o === null ? i : -1)).filter((i) => i >= 0);
      if (libres.length === 0) return actuels;
      const trou = libres[randInt(libres.length)];
      const suivant = actuels.slice();
      suivant[trou] = {
        type: Math.random() < reglage.bombes ? 'bombe' : 'taupe',
        ne: Date.now(),
      };
      return suivant;
    });
  }, fini || !demarre ? null : reglage.apparition);

  // Disparitions : chaque occupant a une duree de vie.
  useInterval(() => {
    const maintenant = Date.now();
    setOccupants((actuels) =>
      actuels.map((o) => (o && maintenant - o.ne > reglage.duree ? null : o)),
    );
  }, fini || !demarre ? null : 120);

  const taper = (index: number) => {
    const occupant = occupants[index];
    if (!occupant || fini) return;

    if (occupant.type === 'bombe') {
      haptic('error');
      scoreRef.current = Math.max(0, scoreRef.current - 5);
    } else {
      haptic('success');
      // Plus la reaction est rapide, plus la taupe vaut cher.
      const reaction = Date.now() - occupant.ne;
      const bonus = reaction < reglage.duree * 0.35 ? 3 : reaction < reglage.duree * 0.7 ? 2 : 1;
      scoreRef.current += bonus;
    }
    setScore(scoreRef.current);
    setOccupants((actuels) => actuels.map((o, i) => (i === index ? null : o)));
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {score} pts
      </Txt>
      <Txt variant="label" tone={restant <= 10 ? 'danger' : 'faint'}>
        {formatClock(restant)}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ width: cellule * 3 + gap * 2 }}>
        <Segmented<Vitesse>
          value={vitesse}
          onChange={setVitesse}
          options={[
            { value: 'tranquille', label: 'Calme' },
            { value: 'rapide', label: 'Rapide' },
            { value: 'frenetique', label: 'Frénétique' },
          ]}
          accent="#F0A030"
        />
      </View>

      <View
        style={{
          width: cellule * 3 + gap * 2,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap,
        }}
      >
        {occupants.map((occupant, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={
              occupant ? (occupant.type === 'taupe' ? 'Taupe' : 'Bombe') : 'Trou vide'
            }
            onPress={() => taper(i)}
            style={{
              width: cellule,
              height: cellule,
              borderRadius: cellule / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.surfaceAlt,
              borderWidth: 2,
              borderColor: c.border,
            }}
          >
            <Txt style={{ fontSize: cellule * 0.52 }}>
              {occupant ? (occupant.type === 'taupe' ? '🦔' : '💣') : ''}
            </Txt>
          </Pressable>
        ))}
      </View>

      {!demarre ? (
        <Button
          label="Commencer les 60 secondes"
          accent="#F0A030"
          onPress={() => {
            haptic('medium');
            setDemarre(true);
          }}
        />
      ) : (
        <Txt variant="caption" tone="faint">
          Tape les taupes, évite les bombes
        </Txt>
      )}

      <GameOver
        visible={fini}
        outcome="over"
        title="Temps écoulé"
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
