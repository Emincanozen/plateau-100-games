import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'hanoi',
  name: 'Tours de Hanoï',
  tagline: 'Déplace la pile entière sans jamais poser un grand sur un petit.',
  category: 'logique',
  emoji: '🗼',
  difficulty: 2,
  players: '1',
  minutes: 5,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['puzzle', 'solo', 'classique'],
  rules: [
    'Touche une tour pour prendre son disque du dessus, puis une autre pour l’y poser.',
    'Un disque ne peut jamais reposer sur un disque plus petit que lui.',
    'Le but est de reconstituer la pile complète sur la tour de droite.',
    'Le minimum théorique est de 2ⁿ − 1 coups : 7 pour trois disques, 31 pour cinq.',
  ],
};

type Tours = number[][];
type Taille = 3 | 4 | 5 | 6;

const COULEURS = ['#E0525F', '#F0A030', '#EFB93B', '#34B37E', '#4BC4D6', '#8B7DFF'];

const depart = (n: Taille): Tours => [Array.from({ length: n }, (_, i) => n - i), [], []];

export default function Hanoi({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(32, 0.42);

  const [taille, setTaille] = useState<Taille>(4);
  const [tours, setTours] = useState<Tours>(() => depart(4));
  const [source, setSource] = useState<number | null>(null);
  const [coups, setCoups] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const gagne = tours[2].length === taille;
  const minimum = Math.pow(2, taille) - 1;

  const reset = useCallback(() => {
    setTours(depart(taille));
    setSource(null);
    setCoups(0);
    setRecord(false);
    setComptee(false);
  }, [taille]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [taille, reset]);

  useEffect(() => {
    if (!gagne || comptee) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(coups));
  }, [gagne, comptee, coups, haptic, submitScore]);

  const toucher = (index: number) => {
    if (gagne) return;

    if (source === null) {
      if (tours[index].length === 0) return;
      haptic('light');
      setSource(index);
      return;
    }

    if (source === index) {
      setSource(null);
      return;
    }

    const disque = tours[source][tours[source].length - 1];
    const dessus = tours[index][tours[index].length - 1];
    if (dessus !== undefined && dessus < disque) {
      haptic('warning');
      setSource(null);
      return;
    }

    haptic('medium');
    setTours((t) =>
      t.map((tour, i) => {
        if (i === source) return tour.slice(0, -1);
        if (i === index) return [...tour, disque];
        return tour;
      }),
    );
    setCoups((n) => n + 1);
    setSource(null);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {coups} coups
      </Txt>
      <Txt variant="label" tone="faint">
        min. {minimum}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  const hauteurDisque = 22;
  const largeurTour = largeur / 3 - 8;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ width: largeur }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 3, label: '3' },
            { value: 4, label: '4' },
            { value: 5, label: '5' },
            { value: 6, label: '6' },
          ]}
          accent="#34B37E"
        />
      </View>

      <Row gap={8} align="flex-end" style={{ justifyContent: 'center' }}>
        {tours.map((tour, index) => {
          const cible = index === 2;
          const choisie = source === index;
          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`Tour ${index + 1}, ${tour.length} disques${cible ? ', tour d’arrivée' : ''}`}
              onPress={() => toucher(index)}
              style={{
                width: largeurTour,
                height: hauteurDisque * (taille + 1) + 26,
                justifyContent: 'flex-end',
                alignItems: 'center',
                borderRadius: radius.lg,
                backgroundColor: choisie ? c.accentSoft : c.surfaceAlt,
                borderWidth: choisie ? 2 : cible ? 1.5 : 1,
                borderColor: choisie ? c.accent : cible ? '#34B37E' : c.border,
                borderStyle: cible && tour.length < taille ? 'dashed' : 'solid',
                paddingBottom: 10,
              }}
            >
              {/* Mât central, derrière les disques */}
              <View
                style={{
                  position: 'absolute',
                  width: 7,
                  height: hauteurDisque * taille,
                  borderRadius: 4,
                  backgroundColor: c.borderStrong,
                  bottom: 10,
                }}
              />
              {/* Socle */}
              <View
                style={{
                  position: 'absolute',
                  bottom: 4,
                  width: largeurTour - 14,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: c.borderStrong,
                }}
              />

              {/*
                `tour[0]` est le disque du bas. En colonne, le premier enfant
                s'affiche le plus haut : on inverse donc pour empiler du plus
                grand en bas au plus petit en haut.
              */}
              {tour
                .slice()
                .reverse()
                .map((disque, rang) => {
                  const dessus = rang === 0;
                  return (
                    <View
                      key={disque}
                      style={{
                        width: (largeurTour - 18) * (0.32 + 0.68 * (disque / taille)),
                        height: hauteurDisque - 5,
                        borderRadius: (hauteurDisque - 5) / 2,
                        marginTop: 3,
                        backgroundColor: COULEURS[(disque - 1) % COULEURS.length],
                        borderWidth: choisie && dessus ? 2 : 0,
                        borderColor: c.text,
                        opacity: choisie && dessus ? 0.75 : 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt style={{ fontSize: hauteurDisque * 0.46, fontWeight: '800', color: '#00000077' }}>
                        {disque}
                      </Txt>
                    </View>
                  );
                })}

              <View style={{ position: 'absolute', bottom: -20 }}>
                <Txt variant="caption" tone={cible ? 'success' : 'faint'}>
                  {cible ? 'Arrivée' : `Tour ${index + 1}`}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </Row>

      <Txt variant="caption" tone="faint" center style={{ marginTop: space.lg }}>
        But : reconstituer la pile complète sur la tour d’arrivée.{'\n'}
        Touche une tour pour prendre son disque du dessus, une autre pour le poser.
      </Txt>

      <GameOver
        visible={gagne}
        outcome="win"
        title="Tour reconstituée !"
        score={coups}
        scoreLabel="Coups"
        best={best}
        isRecord={record}
        detail={coups === minimum ? 'Solution optimale, bravo' : `Minimum possible : ${minimum}`}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
