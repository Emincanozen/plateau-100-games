import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'reflexes',
  name: 'Réflexes',
  tagline: 'Attends le vert. Frappe. Mesure ton temps de réaction.',
  category: 'arcade',
  emoji: '⚡',
  difficulty: 1,
  players: '1',
  minutes: 2,
  score: 'time',
  scoreUnit: 'ms',
  tags: ['réflexe', 'solo', 'rapide'],
  rules: [
    'L’écran devient rouge : attends sans bouger.',
    'Dès qu’il passe au vert, touche-le le plus vite possible.',
    'Toucher trop tôt annule l’essai — la patience fait partie du jeu.',
    'Cinq essais valides, et ta moyenne devient ton score. Un humain rapide tourne autour de 250 ms.',
  ],
};

type Phase = 'repos' | 'attente' | 'pret' | 'mesure' | 'rate';
type Mode = 'couleur' | 'position';

const ESSAIS = 5;

export default function Reflexes({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [mode, setMode] = useState<Mode>('couleur');
  const [phase, setPhase] = useState<Phase>('repos');
  const [temps, setTemps] = useState<number[]>([]);
  const [dernier, setDernier] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  /** Coin où apparaît la cible en mode position, de 0 à 3. */
  const [coin, setCoin] = useState(0);

  const debut = useRef(0);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nettoyer = () => {
    if (minuterie.current) {
      clearTimeout(minuterie.current);
      minuterie.current = null;
    }
  };

  useEffect(() => nettoyer, []);

  const reset = useCallback(() => {
    nettoyer();
    setPhase('repos');
    setTemps([]);
    setDernier(null);
    setRecord(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  const fini = temps.length >= ESSAIS;
  const moyenne = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : 0;

  const comptee = useRef(false);
  useEffect(() => {
    if (!fini) {
      comptee.current = false;
      return;
    }
    if (comptee.current) return;
    comptee.current = true;
    haptic('success');
    setRecord(submitScore(moyenne));
  }, [fini, moyenne, haptic, submitScore]);

  const lancerEssai = useCallback(() => {
    if (fini) return;
    setPhase('attente');
    setDernier(null);
    setCoin(randBetween(0, 3));
    // Délai imprévisible : impossible d'anticiper au rythme.
    minuterie.current = setTimeout(
      () => {
        debut.current = Date.now();
        setPhase('pret');
        haptic('light');
      },
      randBetween(1200, 4000),
    );
  }, [fini, haptic]);

  const toucher = () => {
    if (fini) return;

    if (phase === 'repos' || phase === 'rate') {
      lancerEssai();
      return;
    }

    if (phase === 'attente') {
      // Trop tôt : l'essai est annulé.
      nettoyer();
      setPhase('rate');
      haptic('error');
      return;
    }

    if (phase === 'pret') {
      const reaction = Date.now() - debut.current;
      setDernier(reaction);
      setTemps((t) => [...t, reaction]);
      setPhase('mesure');
      haptic('success');
      return;
    }

    if (phase === 'mesure') lancerEssai();
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Essai {Math.min(temps.length + 1, ESSAIS)}/{ESSAIS}
      </Txt>
      {temps.length > 0 ? (
        <Txt variant="label" tone="faint">
          moy. {moyenne} ms
        </Txt>
      ) : null}
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best} ms
        </Txt>
      ) : null}
    </Row>,
  );

  const fond =
    phase === 'pret' ? '#1E9E6A' : phase === 'attente' ? '#C93544' : phase === 'rate' ? '#B76E12' : c.surfaceAlt;

  const texte =
    phase === 'repos'
      ? 'Touche pour commencer'
      : phase === 'attente'
        ? 'Attends le vert…'
        : phase === 'pret'
          ? mode === 'couleur'
            ? 'MAINTENANT !'
            : 'Touche la cible !'
          : phase === 'rate'
            ? 'Trop tôt — touche pour reprendre'
            : `${dernier} ms — touche pour continuer`;

  // En mode position, la zone verte n'occupe qu'un quart de l'écran.
  const cible = { top: coin < 2 ? 0 : '50%', left: coin % 2 === 0 ? 0 : '50%' } as const;

  return (
    <View style={{ flex: 1, gap: space.md, paddingVertical: space.md }}>
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'couleur', label: 'Tout l’écran' },
          { value: 'position', label: 'Viser la cible' },
        ]}
        accent="#F0A030"
      />

      <Pressable
        onPress={toucher}
        accessibilityRole="button"
        accessibilityLabel={texte}
        style={{
          flex: 1,
          borderRadius: radius.lg,
          backgroundColor: mode === 'position' && phase === 'pret' ? c.surfaceAlt : fond,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {mode === 'position' && phase === 'pret' ? (
          <View
            style={{
              position: 'absolute',
              top: cible.top,
              left: cible.left,
              width: '50%',
              height: '50%',
              backgroundColor: '#1E9E6A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ fontSize: 40 }}>⚡</Txt>
          </View>
        ) : null}

        <Txt
          variant="h2"
          center
          style={{ color: phase === 'repos' || phase === 'mesure' ? c.text : '#FFFFFF' }}
        >
          {texte}
        </Txt>
      </Pressable>

      <Row gap={6} style={{ justifyContent: 'center' }}>
        {Array.from({ length: ESSAIS }, (_, i) => (
          <View
            key={i}
            style={{
              paddingHorizontal: space.sm,
              paddingVertical: 4,
              borderRadius: radius.sm,
              backgroundColor: temps[i] !== undefined ? '#34B37E22' : c.surfaceAlt,
              minWidth: 54,
              alignItems: 'center',
            }}
          >
            <Txt variant="caption" tone={temps[i] !== undefined ? 'success' : 'faint'}>
              {temps[i] !== undefined ? `${temps[i]}` : '—'}
            </Txt>
          </View>
        ))}
      </Row>

      <GameOver
        visible={fini}
        outcome="over"
        title="Cinq essais bouclés"
        score={`${moyenne} ms`}
        scoreLabel="Moyenne"
        best={best !== undefined ? `${best} ms` : undefined}
        isRecord={record}
        detail={
          moyenne < 250
            ? 'Excellent — au niveau des meilleurs'
            : moyenne < 350
              ? 'Bon réflexe'
              : 'Il y a de la marge'
        }
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
