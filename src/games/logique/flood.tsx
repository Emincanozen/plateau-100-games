import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'flood',
  name: 'Inondation',
  tagline: 'Propage ta couleur depuis le coin jusqu’à envahir la grille.',
  category: 'logique',
  emoji: '🌊',
  difficulty: 2,
  players: '1',
  minutes: 4,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['puzzle', 'solo', 'couleurs'],
  rules: [
    'Ta zone démarre dans le coin haut-gauche. Choisis une couleur en bas de l’écran.',
    'Toutes les cases de ta zone prennent cette couleur, et les voisines identiques la rejoignent.',
    'Le but est d’absorber la grille entière avant d’épuiser ton quota de coups.',
    'Vise les grandes plages de couleur adjacentes : c’est ce qui fait grossir la zone le plus vite.',
  ],
};

const PALETTE = ['#E0525F', '#F0A030', '#EFB93B', '#34B37E', '#4BC4D6', '#8B7DFF'];

type Taille = 10 | 14 | 18;
const QUOTA: Record<Taille, number> = { 10: 20, 14: 28, 18: 36 };

const nouvelleGrille = (n: number, couleurs: number): number[] =>
  Array.from({ length: n * n }, () => randInt(couleurs));

/** Cases reliees au coin haut-gauche et de meme couleur que lui. */
function zone(grille: number[], n: number): Set<number> {
  const couleur = grille[0];
  const vus = new Set<number>([0]);
  const pile = [0];
  while (pile.length) {
    const index = pile.pop()!;
    const ligne = Math.floor(index / n);
    const colonne = index % n;
    const voisins = [
      ligne > 0 ? index - n : -1,
      ligne < n - 1 ? index + n : -1,
      colonne > 0 ? index - 1 : -1,
      colonne < n - 1 ? index + 1 : -1,
    ];
    for (const voisin of voisins) {
      if (voisin < 0 || vus.has(voisin)) continue;
      if (grille[voisin] !== couleur) continue;
      vus.add(voisin);
      pile.push(voisin);
    }
  }
  return vus;
}

export default function Flood({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(32, 0.5);

  const [taille, setTaille] = useState<Taille>(14);
  const [grille, setGrille] = useState<number[]>(() => nouvelleGrille(14, 6));
  const [coups, setCoups] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const cellule = Math.floor(largeur / taille);
  const quota = QUOTA[taille];

  const zoneActuelle = useMemo(() => zone(grille, taille), [grille, taille]);
  const gagne = zoneActuelle.size === taille * taille;
  const perdu = !gagne && coups >= quota;
  const fini = gagne || perdu;

  const reset = useCallback(() => {
    setGrille(nouvelleGrille(taille, 6));
    setCoups(0);
    setRecord(false);
    setComptee(false);
  }, [taille]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [taille, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : 'error');
    if (gagne) setRecord(submitScore(coups));
  }, [fini, comptee, gagne, coups, haptic, submitScore]);

  const inonder = (couleur: number) => {
    if (fini || couleur === grille[0]) return;
    haptic('light');
    setGrille((g) => {
      const actuelle = zone(g, taille);
      return g.map((valeur, i) => (actuelle.has(i) ? couleur : valeur));
    });
    setCoups((n) => n + 1);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {coups}/{quota} coups
      </Txt>
      <Txt variant="label" tone="faint">
        {Math.round((zoneActuelle.size / (taille * taille)) * 100)} %
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: cellule * taille }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 10, label: 'Petit' },
            { value: 14, label: 'Moyen' },
            { value: 18, label: 'Grand' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View
        style={{
          width: cellule * taille,
          height: cellule * taille,
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        {grille.map((couleur, i) => (
          <View
            key={i}
            style={{
              width: cellule,
              height: cellule,
              backgroundColor: PALETTE[couleur],
              opacity: zoneActuelle.has(i) ? 1 : 0.82,
            }}
          />
        ))}
      </View>

      <Row gap={space.sm} style={{ justifyContent: 'center' }}>
        {PALETTE.map((couleur, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Couleur ${i + 1}`}
            onPress={() => inonder(i)}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: couleur,
              borderWidth: grille[0] === i ? 3 : 0,
              borderColor: c.text,
              opacity: pressed ? 0.7 : 1,
            })}
          />
        ))}
      </Row>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Grille inondée !' : 'Coups épuisés'}
        score={gagne ? coups : undefined}
        scoreLabel="Coups"
        best={best}
        isRecord={record}
        detail={gagne ? undefined : `Il restait ${taille * taille - zoneActuelle.size} cases`}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
