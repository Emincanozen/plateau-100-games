import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'sos',
  name: 'SOS',
  tagline: 'Place des S et des O, forme « SOS », et rejoue.',
  category: 'papier',
  emoji: '🆘',
  difficulty: 2,
  players: '1-2',
  minutes: 7,
  score: 'none',
  tags: ['stratégie', 'duo', 'classique'],
  rules: [
    'Choisis S ou O, puis touche une case vide pour l’y écrire.',
    'Former « SOS » — en ligne, en colonne ou en diagonale — marque un point et te fait rejouer.',
    'Un même coup peut former plusieurs SOS à la fois : ils comptent tous.',
    'Quand la grille est pleine, celui qui a le plus de SOS gagne.',
  ],
};

type Lettre = 'S' | 'O' | null;
type Taille = 5 | 6 | 7;
type Mode = 'facile' | 'normal' | 'duo';

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** Les SOS formés par la pose d'une lettre en (l, c). */
function sosFormes(grille: Lettre[], n: number, index: number): number[][] {
  const l = Math.floor(index / n);
  const col = index % n;
  const lettre = grille[index];
  const trouves: number[][] = [];

  const lire = (li: number, co: number): Lettre =>
    li < 0 || li >= n || co < 0 || co >= n ? null : grille[li * n + co];

  for (const [dl, dc] of DIRS) {
    for (const sens of [1, -1]) {
      const ddl = dl * sens;
      const ddc = dc * sens;

      if (lettre === 'S') {
        // S à une extrémité : S-O-S dans la direction.
        if (lire(l + ddl, col + ddc) === 'O' && lire(l + ddl * 2, col + ddc * 2) === 'S') {
          trouves.push([index, (l + ddl) * n + col + ddc, (l + ddl * 2) * n + col + ddc * 2]);
        }
      } else if (lettre === 'O' && sens === 1) {
        // O au milieu : un S de chaque côté.
        if (lire(l - ddl, col - ddc) === 'S' && lire(l + ddl, col + ddc) === 'S') {
          trouves.push([(l - ddl) * n + col - ddc, index, (l + ddl) * n + col + ddc]);
        }
      }
    }
  }
  return trouves;
}

export default function Sos({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.46);

  const [taille, setTaille] = useState<Taille>(5);
  const [mode, setMode] = useState<Mode>('normal');
  const n = taille;
  const cellule = Math.floor(largeur / n);

  const [grille, setGrille] = useState<Lettre[]>(() => Array(25).fill(null));
  const [lettre, setLettre] = useState<'S' | 'O'>('S');
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [tour, setTour] = useState<0 | 1>(0);
  const [marques, setMarques] = useState<number[][]>([]);
  const [comptee, setComptee] = useState(false);

  const pleine = useMemo(() => grille.every((v) => v !== null), [grille]);
  const gagne = pleine && scores[0] > scores[1];
  const nul = pleine && scores[0] === scores[1];

  const reset = useCallback(() => {
    setGrille(Array(taille * taille).fill(null));
    setScores([0, 0]);
    setTour(0);
    setMarques([]);
    setComptee(false);
  }, [taille]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [taille, mode, reset]);

  useEffect(() => {
    if (!pleine || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : nul ? 'warning' : 'error');
    if (mode !== 'duo') submitResult(gagne ? 'win' : nul ? 'draw' : 'loss');
  }, [pleine, comptee, gagne, nul, mode, haptic, submitResult]);

  const poser = useCallback(
    (index: number, valeur: 'S' | 'O', joueur: 0 | 1) => {
      setGrille((precedente) => {
        if (precedente[index] !== null) return precedente;
        const suivante = precedente.slice();
        suivante[index] = valeur;

        const formes = sosFormes(suivante, n, index);
        if (formes.length > 0) {
          setScores((s) => {
            const copie: [number, number] = [...s];
            copie[joueur] += formes.length;
            return copie;
          });
          setMarques((m) => [...m, ...formes]);
          haptic('success');
        } else {
          // Aucun SOS : la main passe.
          setTour(joueur === 0 ? 1 : 0);
          haptic('light');
        }
        return suivante;
      });
    },
    [n, haptic],
  );

  const toucher = (index: number) => {
    if (pleine || grille[index] !== null) return;
    if (mode !== 'duo' && tour !== 0) return;
    poser(index, lettre, tour);
  };

  // Tour de l'ordinateur.
  useEffect(() => {
    if (mode === 'duo' || tour !== 1 || pleine) return;

    const id = setTimeout(() => {
      const libres = grille.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
      if (libres.length === 0) return;

      // Il cherche d'abord un coup qui marque.
      type Coup = { index: number; valeur: 'S' | 'O'; gains: number };
      const coups: Coup[] = [];
      for (const index of libres) {
        for (const valeur of ['S', 'O'] as const) {
          const essai = grille.slice();
          essai[index] = valeur;
          coups.push({ index, valeur, gains: sosFormes(essai, n, index).length });
        }
      }

      const gagnants = coups.filter((k) => k.gains > 0);
      if (gagnants.length > 0) {
        const meilleur = gagnants.reduce((a, b) => (b.gains > a.gains ? b : a));
        poser(meilleur.index, meilleur.valeur, 1);
        return;
      }

      if (mode === 'facile') {
        const choix = pick(coups);
        poser(choix.index, choix.valeur, 1);
        return;
      }

      // Sinon il évite d'offrir un SOS à l'adversaire au coup suivant.
      const surs = shuffle(coups).filter((k) => {
        const essai = grille.slice();
        essai[k.index] = k.valeur;
        return !essai.some((v, i) => {
          if (v !== null) return false;
          return (['S', 'O'] as const).some((autre) => {
            const suite = essai.slice();
            suite[i] = autre;
            return sosFormes(suite, n, i).length > 0;
          });
        });
      });

      const choix = surs.length > 0 ? surs[0] : pick(coups);
      poser(choix.index, choix.valeur, 1);
    }, 550);

    return () => clearTimeout(id);
  }, [tour, mode, pleine, grille, n, poser]);

  const casesMarquees = useMemo(() => new Set(marques.flat()), [marques]);
  const couleurs = ['#4BC4D6', '#E0525F'];

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" style={{ color: couleurs[0] }}>
        {scores[0]}
      </Txt>
      <Txt variant="label" tone="faint">
        {pleine
          ? 'Grille pleine'
          : mode === 'duo'
            ? `Joueur ${tour + 1}`
            : tour === 0
              ? 'À toi'
              : 'Ordinateur…'}
      </Txt>
      <Txt variant="label" style={{ color: couleurs[1] }}>
        {scores[1]}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: Math.max(cellule * n, 260), gap: space.sm }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 5, label: '5 × 5' },
            { value: 6, label: '6 × 6' },
            { value: 7, label: '7 × 7' },
          ]}
          accent="#4BC4D6"
        />
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent="#4BC4D6"
        />
      </View>

      <View
        style={{
          width: cellule * n,
          height: cellule * n,
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: c.borderStrong,
        }}
      >
        {grille.map((valeur, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Case ${i + 1}, ${valeur ?? 'vide'}`}
            onPress={() => toucher(i)}
            style={{
              width: cellule,
              height: cellule,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 0.5,
              borderColor: c.border,
              backgroundColor: casesMarquees.has(i) ? '#4BC4D622' : c.surface,
            }}
          >
            <Txt style={{ fontSize: cellule * 0.5, fontWeight: '800' }}>{valeur ?? ''}</Txt>
          </Pressable>
        ))}
      </View>

      <Row gap={space.md}>
        {(['S', 'O'] as const).map((valeur) => (
          <Pressable
            key={valeur}
            accessibilityRole="button"
            accessibilityState={{ selected: lettre === valeur }}
            accessibilityLabel={`Écrire ${valeur}`}
            onPress={() => setLettre(valeur)}
            style={{
              width: 70,
              height: 60,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: lettre === valeur ? '#4BC4D6' : c.surfaceAlt,
            }}
          >
            <Txt
              style={{
                fontSize: 28,
                fontWeight: '800',
                color: lettre === valeur ? '#FFFFFF' : c.text,
              }}
            >
              {valeur}
            </Txt>
          </Pressable>
        ))}
      </Row>

      <GameOver
        visible={pleine}
        outcome={nul ? 'draw' : gagne ? 'win' : 'loss'}
        title={
          nul
            ? 'Égalité'
            : mode === 'duo'
              ? `Joueur ${gagne ? 1 : 2} gagne`
              : gagne
                ? 'Gagné !'
                : 'L’ordinateur gagne'
        }
        score={`${scores[0]} – ${scores[1]}`}
        scoreLabel="SOS formés"
        accent="#4BC4D6"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
