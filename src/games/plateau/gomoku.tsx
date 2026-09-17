import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'gomoku',
  name: 'Cinq en ligne',
  tagline: 'Le morpion en grand : aligne cinq pierres avant l’adversaire.',
  category: 'plateau',
  emoji: '⚫',
  difficulty: 2,
  players: '1-2',
  minutes: 8,
  score: 'none',
  tags: ['stratégie', 'duo', 'gomoku'],
  rules: [
    'Pose une pierre sur n’importe quelle intersection libre de la grille.',
    'Le premier qui aligne cinq pierres — ligne, colonne ou diagonale — gagne.',
    'Il n’y a ni capture ni déplacement : chaque pierre reste où elle est posée.',
    'Surveille les doubles menaces : deux alignements ouverts à la fois sont imparables.',
  ],
};

const N = 13;
const ALIGNEMENT = 5;

type Pierre = 'N' | 'B' | null;
type Grille = Pierre[];
type Mode = 'facile' | 'normal' | 'expert' | 'duo';

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function chercherVictoire(grille: Grille): { camp: 'N' | 'B'; cases: number[] } | null {
  for (let ligne = 0; ligne < N; ligne++) {
    for (let colonne = 0; colonne < N; colonne++) {
      const depart = grille[ligne * N + colonne];
      if (!depart) continue;
      for (const [dl, dc] of DIRS) {
        const cases = [ligne * N + colonne];
        for (let pas = 1; pas < ALIGNEMENT; pas++) {
          const l = ligne + dl * pas;
          const cc = colonne + dc * pas;
          if (l < 0 || l >= N || cc < 0 || cc >= N) break;
          if (grille[l * N + cc] !== depart) break;
          cases.push(l * N + cc);
        }
        if (cases.length === ALIGNEMENT) return { camp: depart, cases };
      }
    }
  }
  return null;
}

/** Note une case pour un camp : longueur des alignements crees et bloques. */
function noterCase(grille: Grille, index: number, camp: 'N' | 'B'): number {
  const ligne = Math.floor(index / N);
  const colonne = index % N;
  let score = 0;

  for (const cible of [camp, camp === 'N' ? 'B' : 'N'] as const) {
    const defense = cible !== camp;
    for (const [dl, dc] of DIRS) {
      let compte = 0;
      let ouvertures = 0;

      for (const sens of [1, -1]) {
        for (let pas = 1; pas < ALIGNEMENT; pas++) {
          const l = ligne + dl * pas * sens;
          const cc = colonne + dc * pas * sens;
          if (l < 0 || l >= N || cc < 0 || cc >= N) break;
          const contenu = grille[l * N + cc];
          if (contenu === cible) {
            compte += 1;
          } else {
            if (contenu === null) ouvertures += 1;
            break;
          }
        }
      }

      // Une menace de 4 doit primer sur tout le reste.
      const poids = [0, 1, 12, 120, 1500, 20000][Math.min(compte + 1, 5)];
      score += defense ? poids * 0.85 : poids;
      score += ouvertures * 2;
    }
  }

  // Le centre ouvre plus de directions.
  const distanceCentre = Math.abs(ligne - (N - 1) / 2) + Math.abs(colonne - (N - 1) / 2);
  return score + (N - distanceCentre) * 0.6;
}

/** Cases vides adjacentes a une pierre : inutile d'evaluer le reste. */
function casesInteressantes(grille: Grille): number[] {
  const out: number[] = [];
  for (let i = 0; i < grille.length; i++) {
    if (grille[i] !== null) continue;
    const ligne = Math.floor(i / N);
    const colonne = i % N;
    let voisine = false;
    for (let dl = -2; dl <= 2 && !voisine; dl++) {
      for (let dc = -2; dc <= 2; dc++) {
        const l = ligne + dl;
        const cc = colonne + dc;
        if (l < 0 || l >= N || cc < 0 || cc >= N) continue;
        if (grille[l * N + cc] !== null) {
          voisine = true;
          break;
        }
      }
    }
    if (voisine) out.push(i);
  }
  return out;
}

function coupOrdinateur(grille: Grille, mode: Mode): number {
  const centre = Math.floor((N * N) / 2);
  if (grille.every((p) => p === null)) return centre;

  const candidates = casesInteressantes(grille);
  if (candidates.length === 0) return centre;
  if (mode === 'facile' && Math.random() < 0.4) return pick(candidates);

  let meilleur = candidates[0];
  let meilleurScore = -Infinity;
  for (const index of candidates) {
    const score = noterCase(grille, index, 'B');
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = index;
    }
  }
  return meilleur;
}

export default function Gomoku({ submitResult, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const taille = useBoardSize(24, 0.58);
  const cellule = Math.floor(taille / N);

  const [mode, setMode] = useState<Mode>('normal');
  const [grille, setGrille] = useState<Grille>(() => Array(N * N).fill(null));
  const [tour, setTour] = useState<'N' | 'B'>('N');
  const [comptee, setComptee] = useState(false);

  const victoire = useMemo(() => chercherVictoire(grille), [grille]);
  const pleine = useMemo(() => grille.every((p) => p !== null), [grille]);
  const fini = !!victoire || pleine;

  const reset = useCallback(() => {
    setGrille(Array(N * N).fill(null));
    setTour('N');
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    if (victoire) {
      const humain = victoire.camp === 'N';
      haptic(humain || mode === 'duo' ? 'success' : 'error');
      if (mode !== 'duo') submitResult(humain ? 'win' : 'loss');
    } else {
      haptic('warning');
      if (mode !== 'duo') submitResult('draw');
    }
  }, [fini, comptee, victoire, mode, haptic, submitResult]);

  useEffect(() => {
    if (mode === 'duo' || tour !== 'B' || fini) return;
    const id = setTimeout(() => {
      setGrille((g) => {
        if (chercherVictoire(g)) return g;
        const suivant = g.slice();
        suivant[coupOrdinateur(g, mode)] = 'B';
        return suivant;
      });
      setTour('N');
    }, 320);
    return () => clearTimeout(id);
  }, [tour, mode, fini]);

  const poser = (index: number) => {
    if (fini || grille[index] !== null) return;
    if (mode !== 'duo' && tour !== 'N') return;
    haptic('light');
    setGrille((g) => {
      const suivant = g.slice();
      suivant[index] = tour;
      return suivant;
    });
    setTour(tour === 'N' ? 'B' : 'N');
  };

  useFrameStatus(
    <Txt variant="label" tone="dim">
      {fini
        ? victoire
          ? `${victoire.camp === 'N' ? 'Noir' : 'Blanc'} gagne`
          : 'Match nul'
        : mode === 'duo'
          ? `Au tour des ${tour === 'N' ? 'noirs' : 'blancs'}`
          : tour === 'N'
            ? 'À toi de jouer'
            : 'L’ordinateur réfléchit…'}
    </Txt>,
  );

  const casesGagnantes: number[] = victoire?.cases ?? [];

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: Math.max(cellule * N, 240) }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'expert', label: 'Expert' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent="#5B8DEF"
        />
      </View>

      <View
        style={{
          width: cellule * N,
          height: cellule * N,
          flexDirection: 'row',
          flexWrap: 'wrap',
          backgroundColor: c.boardLight,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {grille.map((pierre, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Intersection ${i + 1}${pierre ? (pierre === 'N' ? ' noire' : ' blanche') : ' libre'}`}
            onPress={() => poser(i)}
            style={{
              width: cellule,
              height: cellule,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 0.5,
              borderColor: '#00000033',
              backgroundColor: casesGagnantes.includes(i) ? '#5B8DEF55' : 'transparent',
            }}
          >
            {pierre ? (
              <View
                style={{
                  width: cellule * 0.82,
                  height: cellule * 0.82,
                  borderRadius: cellule,
                  backgroundColor: pierre === 'N' ? '#16161C' : '#F6F6F8',
                  borderWidth: 0.5,
                  borderColor: '#00000044',
                }}
              />
            ) : null}
          </Pressable>
        ))}
      </View>

      <GameOver
        visible={fini}
        outcome={victoire ? (mode === 'duo' || victoire.camp === 'N' ? 'win' : 'loss') : 'draw'}
        title={
          victoire
            ? mode === 'duo'
              ? `Victoire des ${victoire.camp === 'N' ? 'noirs' : 'blancs'}`
              : victoire.camp === 'N'
                ? 'Cinq alignés !'
                : 'L’ordinateur aligne cinq'
            : 'Grille pleine'
        }
        accent="#5B8DEF"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
