import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'simon',
  name: 'Séquence',
  tagline: 'Répète la suite de couleurs, qui s’allonge à chaque tour.',
  category: 'logique',
  emoji: '🔴',
  difficulty: 1,
  players: '1',
  minutes: 4,
  score: 'high',
  scoreUnit: 'niveau',
  tags: ['mémoire', 'solo', 'culte'],
  rules: [
    'Regarde la séquence de couleurs qui s’allume, puis reproduis-la dans le même ordre.',
    'À chaque réussite, une couleur de plus est ajoutée à la fin.',
    'Une seule erreur met fin à la partie.',
    'Trois niveaux : de quatre à neuf carreaux, avec un rythme de plus en plus soutenu.',
  ],
};

const COULEURS = [
  { actif: '#FF5A6E', repos: '#7E2E39' },
  { actif: '#4BD08A', repos: '#22624A' },
  { actif: '#5B9BFF', repos: '#2B4C88' },
  { actif: '#FFD24A', repos: '#806417' },
  { actif: '#C77DFF', repos: '#5A3580' },
  { actif: '#4BE3E3', repos: '#1F6A6A' },
  { actif: '#FF9F45', repos: '#8A5220' },
  { actif: '#98E04B', repos: '#4A6E22' },
  { actif: '#FF6FB5', repos: '#83375D' },
];

type Niveau = 'debutant' | 'normal' | 'expert';

/**
 * `rythme` est la durée d'un carreau en démonstration.
 * Elle se raccourcit avec la séquence, mais jamais en dessous de `minimum`.
 */
const NIVEAUX: Record<Niveau, { cases: number; colonnes: number; rythme: number; minimum: number }> = {
  debutant: { cases: 4, colonnes: 2, rythme: 820, minimum: 560 },
  normal: { cases: 6, colonnes: 3, rythme: 720, minimum: 470 },
  expert: { cases: 9, colonnes: 3, rythme: 620, minimum: 380 },
};

type Phase = 'attente' | 'demonstration' | 'joueur';

export default function Simon({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(48, 0.46);

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const reglage = NIVEAUX[niveau];
  const gap = 10;
  const cote = Math.floor((largeur - gap * (reglage.colonnes - 1)) / reglage.colonnes);

  const [sequence, setSequence] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('attente');
  const [actif, setActif] = useState<number | null>(null);
  const [position, setPosition] = useState(0);
  const [perdu, setPerdu] = useState(false);
  const [record, setRecord] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const nettoyer = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => nettoyer, []);

  const reset = useCallback(() => {
    nettoyer();
    setSequence([]);
    setPhase('attente');
    setActif(null);
    setPosition(0);
    setPerdu(false);
    setRecord(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, reset]);

  /** Rejoue toute la séquence, puis rend la main au joueur. */
  const montrer = useCallback(
    (suite: number[]) => {
      nettoyer();
      setPhase('demonstration');
      const rythme = Math.max(reglage.minimum, reglage.rythme - suite.length * 14);

      suite.forEach((couleur, i) => {
        timers.current.push(
          setTimeout(() => {
            setActif(couleur);
            haptic('light');
          }, i * rythme),
        );
        timers.current.push(setTimeout(() => setActif(null), i * rythme + rythme * 0.58));
      });

      timers.current.push(
        setTimeout(() => {
          setPhase('joueur');
          setPosition(0);
        }, suite.length * rythme + 260),
      );
    },
    [haptic, reglage],
  );

  const demarrer = useCallback(() => {
    const suite = [randInt(reglage.cases)];
    setSequence(suite);
    setPerdu(false);
    montrer(suite);
  }, [montrer, reglage.cases]);

  const toucher = (couleur: number) => {
    if (phase !== 'joueur') return;

    if (sequence[position] !== couleur) {
      haptic('error');
      setActif(null);
      setPhase('attente');
      setPerdu(true);
      setRecord(submitScore(sequence.length - 1));
      return;
    }

    haptic('light');
    setActif(couleur);
    timers.current.push(setTimeout(() => setActif(null), 170));

    if (position === sequence.length - 1) {
      // Séquence reproduite : on l'allonge.
      const suite = [...sequence, randInt(reglage.cases)];
      setPhase('attente');
      timers.current.push(
        setTimeout(() => {
          setSequence(suite);
          montrer(suite);
        }, 620),
      );
      return;
    }
    setPosition((p) => p + 1);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Niveau {sequence.length}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  const enJeu = sequence.length > 0 && !perdu;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ width: largeur }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'debutant', label: '4 cases' },
            { value: 'normal', label: '6 cases' },
            { value: 'expert', label: '9 cases' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View
        style={{
          width: largeur,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap,
          justifyContent: 'center',
        }}
      >
        {Array.from({ length: reglage.cases }, (_, i) => {
          const couleur = COULEURS[i];
          const allume = actif === i;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Carreau ${i + 1}`}
              disabled={phase !== 'joueur'}
              onPress={() => toucher(i)}
              style={{
                width: cote,
                height: cote,
                borderRadius: radius.lg,
                backgroundColor: allume ? couleur.actif : couleur.repos,
                borderWidth: allume ? 3 : 0,
                borderColor: '#FFFFFF88',
                opacity: phase === 'joueur' || allume ? 1 : 0.82,
              }}
            />
          );
        })}
      </View>

      <View style={{ alignItems: 'center', gap: space.md, minHeight: 84 }}>
        <Txt variant="label" tone="dim">
          {phase === 'demonstration'
            ? 'Regarde bien…'
            : phase === 'joueur'
              ? `À toi — ${position + 1} sur ${sequence.length}`
              : enJeu
                ? 'Bien joué, on continue…'
                : 'Prêt ?'}
        </Txt>

        {phase === 'joueur' ? (
          <Row gap={5}>
            {sequence.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: i < position ? '#34B37E' : c.borderStrong,
                }}
              />
            ))}
          </Row>
        ) : null}

        {phase === 'attente' && !enJeu ? (
          <Button label="Commencer" accent="#34B37E" onPress={demarrer} />
        ) : null}
      </View>

      <GameOver
        visible={perdu}
        outcome="over"
        title="Séquence manquée"
        score={sequence.length - 1}
        scoreLabel="Niveau"
        best={best}
        isRecord={record}
        accent="#34B37E"
        onReplay={() => {
          reset();
          timers.current.push(setTimeout(demarrer, 180));
        }}
        onQuit={reset}
      />
    </View>
  );
}
