import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'lights-out',
  name: 'Tout éteindre',
  tagline: 'Chaque case bascule ses voisines. Éteins toute la grille.',
  category: 'logique',
  emoji: '💡',
  difficulty: 2,
  players: '1',
  minutes: 4,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['puzzle', 'solo', 'logique'],
  rules: [
    'Toucher une case l’allume ou l’éteint, et fait de même pour ses quatre voisines.',
    'Le but est d’éteindre absolument toutes les lumières.',
    'Appuyer deux fois au même endroit revient à ne rien faire : cherche des combinaisons.',
    'La grille de départ est toujours résoluble, elle est construite depuis une grille éteinte.',
  ],
};

type Taille = 3 | 4 | 5;

const voisines = (index: number, n: number): number[] => {
  const ligne = Math.floor(index / n);
  const colonne = index % n;
  const out = [index];
  if (ligne > 0) out.push(index - n);
  if (ligne < n - 1) out.push(index + n);
  if (colonne > 0) out.push(index - 1);
  if (colonne < n - 1) out.push(index + 1);
  return out;
};

function basculer(grille: boolean[], index: number, n: number): boolean[] {
  const cibles = new Set(voisines(index, n));
  return grille.map((allumee, i) => (cibles.has(i) ? !allumee : allumee));
}

/** Melange depuis une grille eteinte : la position obtenue est donc resoluble. */
function melangerGrille(n: number): boolean[] {
  let grille = Array<boolean>(n * n).fill(false);
  const coups = n * n;
  for (let i = 0; i < coups; i++) {
    grille = basculer(grille, randInt(n * n), n);
  }
  return grille.every((allumee) => !allumee) ? melangerGrille(n) : grille;
}

export default function LightsOut({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(48, 0.48);

  const [taille, setTaille] = useState<Taille>(5);
  const [grille, setGrille] = useState<boolean[]>(() => melangerGrille(5));
  const [coups, setCoups] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const gap = 8;
  const cellule = Math.floor((largeur - gap * (taille + 1)) / taille);
  const gagne = grille.every((allumee) => !allumee);

  const reset = useCallback(() => {
    setGrille(melangerGrille(taille));
    setCoups(0);
    setRecord(false);
    setComptee(false);
  }, [taille]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [taille, reset]);

  useEffect(() => {
    if (!gagne || comptee || coups === 0) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(coups));
  }, [gagne, comptee, coups, haptic, submitScore]);

  const toucher = (index: number) => {
    if (gagne) return;
    haptic('light');
    setGrille((g) => basculer(g, index, taille));
    setCoups((n) => n + 1);
  };

  const allumees = grille.filter(Boolean).length;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {coups} coups
      </Txt>
      <Txt variant="label" tone="faint">
        {allumees} allumées
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
      <View style={{ width: taille * (cellule + gap) + gap }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 3, label: '3 × 3' },
            { value: 4, label: '4 × 4' },
            { value: 5, label: '5 × 5' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View
        style={{
          width: taille * (cellule + gap) + gap,
          padding: gap,
          backgroundColor: c.surfaceAlt,
          borderRadius: radius.lg,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap,
        }}
      >
        {grille.map((allumee, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Case ${i + 1}, ${allumee ? 'allumée' : 'éteinte'}`}
            onPress={() => toucher(i)}
            style={({ pressed }) => ({
              width: cellule,
              height: cellule,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: allumee ? '#EFB93B' : c.surface,
              borderWidth: 1,
              borderColor: allumee ? '#EFB93B' : c.border,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Txt style={{ fontSize: cellule * 0.4, opacity: allumee ? 1 : 0.18 }}>💡</Txt>
          </Pressable>
        ))}
      </View>

      <GameOver
        visible={gagne && coups > 0}
        outcome="win"
        title="Tout est éteint !"
        score={coups}
        scoreLabel="Coups"
        best={best}
        isRecord={record}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
