import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'othello',
  name: 'Othello',
  tagline: 'Prends l’adversaire en tenaille et retourne ses pions.',
  category: 'plateau',
  emoji: '⚫',
  difficulty: 3,
  players: '1-2',
  minutes: 12,
  score: 'none',
  tags: ['stratégie', 'duo', 'classique'],
  rules: [
    'Pose un pion de façon à encadrer une ou plusieurs lignes de pions adverses.',
    'Tous les pions encadrés, en ligne, colonne ou diagonale, changent de couleur.',
    'Si tu n’as aucun coup légal, tu passes ton tour automatiquement.',
    'La partie se termine quand personne ne peut jouer : le plus grand nombre de pions gagne.',
  ],
};

const N = 8;
type Pion = 'N' | 'B' | null;
type Plateau = Pion[];
type Mode = 'facile' | 'normal' | 'expert' | 'duo';

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

function plateauInitial(): Plateau {
  const p: Plateau = Array(N * N).fill(null);
  p[27] = 'B';
  p[28] = 'N';
  p[35] = 'N';
  p[36] = 'B';
  return p;
}

const adverse = (pion: 'N' | 'B'): 'N' | 'B' => (pion === 'N' ? 'B' : 'N');

/** Pions retournes si `joueur` pose en `index`, vide si le coup est illegal. */
function gains(plateau: Plateau, index: number, joueur: 'N' | 'B'): number[] {
  if (plateau[index] !== null) return [];
  const ligne = Math.floor(index / N);
  const colonne = index % N;
  const captures: number[] = [];

  for (const [dl, dc] of DIRS) {
    const chemin: number[] = [];
    let l = ligne + dl;
    let cc = colonne + dc;
    while (l >= 0 && l < N && cc >= 0 && cc < N) {
      const pos = l * N + cc;
      const contenu = plateau[pos];
      if (contenu === adverse(joueur)) {
        chemin.push(pos);
      } else if (contenu === joueur) {
        captures.push(...chemin);
        break;
      } else {
        break;
      }
      l += dl;
      cc += dc;
    }
  }
  return captures;
}

function coupsLegaux(plateau: Plateau, joueur: 'N' | 'B'): number[] {
  const out: number[] = [];
  for (let i = 0; i < plateau.length; i++) {
    if (gains(plateau, i, joueur).length > 0) out.push(i);
  }
  return out;
}

function jouer(plateau: Plateau, index: number, joueur: 'N' | 'B'): Plateau {
  const captures = gains(plateau, index, joueur);
  if (captures.length === 0) return plateau;
  const suivant = plateau.slice();
  suivant[index] = joueur;
  captures.forEach((pos) => (suivant[pos] = joueur));
  return suivant;
}

const compter = (plateau: Plateau, pion: 'N' | 'B') => plateau.filter((p) => p === pion).length;

/** Les coins valent beaucoup, leurs voisins immediats sont dangereux. */
const POIDS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

function evaluer(plateau: Plateau, joueur: 'N' | 'B'): number {
  let score = 0;
  plateau.forEach((pion, i) => {
    if (pion === joueur) score += POIDS[i];
    else if (pion === adverse(joueur)) score -= POIDS[i];
  });
  // La mobilite compte autant que la position en milieu de partie.
  score += (coupsLegaux(plateau, joueur).length - coupsLegaux(plateau, adverse(joueur)).length) * 8;
  return score;
}

function minimax(
  plateau: Plateau,
  profondeur: number,
  alpha: number,
  beta: number,
  joueur: 'N' | 'B',
  tour: 'N' | 'B',
): number {
  if (profondeur === 0) return evaluer(plateau, joueur);
  const coups = coupsLegaux(plateau, tour);

  if (coups.length === 0) {
    const coupsAdverse = coupsLegaux(plateau, adverse(tour));
    if (coupsAdverse.length === 0) {
      const diff = compter(plateau, joueur) - compter(plateau, adverse(joueur));
      return diff * 1000;
    }
    return minimax(plateau, profondeur - 1, alpha, beta, joueur, adverse(tour));
  }

  if (tour === joueur) {
    let best = -Infinity;
    for (const coup of coups) {
      best = Math.max(
        best,
        minimax(jouer(plateau, coup, tour), profondeur - 1, alpha, beta, joueur, adverse(tour)),
      );
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const coup of coups) {
    best = Math.min(
      best,
      minimax(jouer(plateau, coup, tour), profondeur - 1, alpha, beta, joueur, adverse(tour)),
    );
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function coupOrdinateur(plateau: Plateau, mode: Mode): number | null {
  const coups = coupsLegaux(plateau, 'B');
  if (coups.length === 0) return null;
  if (mode === 'facile') return pick(coups);

  const profondeur = mode === 'normal' ? 2 : 4;
  let meilleur = coups[0];
  let meilleurScore = -Infinity;
  for (const coup of coups) {
    const score = minimax(jouer(plateau, coup, 'B'), profondeur, -Infinity, Infinity, 'B', 'N');
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = coup;
    }
  }
  return meilleur;
}

export default function Othello({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const taille = useBoardSize(32, 0.5);
  const cellule = Math.floor(taille / N);

  const [mode, setMode] = useState<Mode>('normal');
  const [plateau, setPlateau] = useState<Plateau>(plateauInitial);
  const [tour, setTour] = useState<'N' | 'B'>('N');
  const [comptee, setComptee] = useState(false);

  const coupsJoueur = useMemo(() => coupsLegaux(plateau, tour), [plateau, tour]);
  const coupsAdverse = useMemo(() => coupsLegaux(plateau, adverse(tour)), [plateau, tour]);
  const fini = coupsJoueur.length === 0 && coupsAdverse.length === 0;

  const noirs = compter(plateau, 'N');
  const blancs = compter(plateau, 'B');

  const reset = useCallback(() => {
    setPlateau(plateauInitial());
    setTour('N');
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  // Passage de tour automatique quand un joueur est bloque.
  useEffect(() => {
    if (fini || coupsJoueur.length > 0) return;
    const id = setTimeout(() => setTour((t) => adverse(t)), 700);
    return () => clearTimeout(id);
  }, [fini, coupsJoueur.length]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    const gagnant = noirs > blancs ? 'N' : blancs > noirs ? 'B' : null;
    haptic(gagnant === 'N' ? 'success' : gagnant === null ? 'warning' : 'error');
    if (mode !== 'duo') submitResult(gagnant === 'N' ? 'win' : gagnant === 'B' ? 'loss' : 'draw');
  }, [fini, comptee, noirs, blancs, mode, haptic, submitResult]);

  // Tour de l'ordinateur.
  useEffect(() => {
    if (mode === 'duo' || tour !== 'B' || fini || coupsJoueur.length === 0) return;
    const id = setTimeout(() => {
      const coup = coupOrdinateur(plateau, mode);
      if (coup !== null) setPlateau((p) => jouer(p, coup, 'B'));
      setTour('N');
    }, 450);
    return () => clearTimeout(id);
  }, [tour, mode, fini, plateau, coupsJoueur.length]);

  const poser = (index: number) => {
    if (fini) return;
    if (mode !== 'duo' && tour !== 'N') return;
    if (!coupsJoueur.includes(index)) return;
    haptic('medium');
    setPlateau((p) => jouer(p, index, tour));
    setTour(adverse(tour));
  };

  const montrerAides = mode === 'duo' || tour === 'N';

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        ⚫ {noirs} · ⚪ {blancs}
      </Txt>
      <Txt variant="label" tone="faint">
        {fini
          ? 'Partie finie'
          : tour === 'N'
            ? mode === 'duo'
              ? 'Aux noirs'
              : 'À toi'
            : mode === 'duo'
              ? 'Aux blancs'
              : 'Ordinateur…'}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: cellule * N }}>
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
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: c.felt,
        }}
      >
        {plateau.map((pion, i) => {
          const jouable = montrerAides && coupsJoueur.includes(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Case ${i + 1}${pion ? (pion === 'N' ? ' noir' : ' blanc') : jouable ? ' jouable' : ' vide'}`}
              onPress={() => poser(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 0.5,
                borderColor: '#00000033',
              }}
            >
              {pion ? (
                <View
                  style={{
                    width: cellule * 0.78,
                    height: cellule * 0.78,
                    borderRadius: cellule,
                    backgroundColor: pion === 'N' ? '#15151C' : '#F2F2F4',
                  }}
                />
              ) : jouable ? (
                <View
                  style={{
                    width: cellule * 0.24,
                    height: cellule * 0.24,
                    borderRadius: cellule,
                    backgroundColor: '#FFFFFF44',
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <GameOver
        visible={fini}
        outcome={noirs > blancs ? 'win' : noirs === blancs ? 'draw' : 'loss'}
        title={
          noirs === blancs
            ? 'Égalité'
            : mode === 'duo'
              ? `Victoire des ${noirs > blancs ? 'noirs' : 'blancs'}`
              : noirs > blancs
                ? 'Gagné !'
                : 'L’ordinateur gagne'
        }
        score={`${noirs} – ${blancs}`}
        scoreLabel="Pions"
        accent="#5B8DEF"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
