import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'dames',
  name: 'Dames',
  tagline: 'Saute les pions adverses et transforme les tiens en dames.',
  category: 'plateau',
  emoji: '⚪',
  difficulty: 3,
  players: '1-2',
  minutes: 15,
  score: 'none',
  tags: ['stratégie', 'duo', 'classique'],
  rules: [
    'Les pions avancent d’une case en diagonale, uniquement vers l’avant.',
    'La prise est obligatoire : si tu peux sauter un pion adverse, tu dois le faire.',
    'Une prise multiple s’enchaîne : continue tant que le même pion peut sauter.',
    'Un pion qui atteint la dernière rangée devient dame et peut aussi reculer.',
  ],
};

const N = 8;

type Piece = { camp: 'clair' | 'fonce'; dame: boolean } | null;
type Plateau = Piece[];
type Mode = 'facile' | 'normal' | 'expert' | 'duo';

interface Coup {
  depart: number;
  arrivee: number;
  /** Case du pion capture, ou null pour un simple deplacement. */
  capture: number | null;
}

const ligneDe = (i: number) => Math.floor(i / N);
const colonneDe = (i: number) => i % N;
const caseNoire = (i: number) => (ligneDe(i) + colonneDe(i)) % 2 === 1;

function plateauInitial(): Plateau {
  const p: Plateau = Array(N * N).fill(null);
  for (let i = 0; i < N * N; i++) {
    if (!caseNoire(i)) continue;
    const ligne = ligneDe(i);
    if (ligne < 3) p[i] = { camp: 'fonce', dame: false };
    else if (ligne > 4) p[i] = { camp: 'clair', dame: false };
  }
  return p;
}

const autreCamp = (camp: 'clair' | 'fonce') => (camp === 'clair' ? 'fonce' : 'clair');

/** Directions autorisees : les pions avancent, les dames vont partout. */
function directions(piece: NonNullable<Piece>): [number, number][] {
  if (piece.dame) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  // Les pions clairs remontent (ligne decroissante), les fonces descendent.
  return piece.camp === 'clair'
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

function coupsDepuis(plateau: Plateau, depart: number, uniquementPrises: boolean): Coup[] {
  const piece = plateau[depart];
  if (!piece) return [];
  const ligne = ligneDe(depart);
  const colonne = colonneDe(depart);
  const out: Coup[] = [];

  for (const [dl, dc] of directions(piece)) {
    const l1 = ligne + dl;
    const c1 = colonne + dc;
    if (l1 < 0 || l1 >= N || c1 < 0 || c1 >= N) continue;
    const voisine = l1 * N + c1;

    if (plateau[voisine] === null) {
      if (!uniquementPrises) out.push({ depart, arrivee: voisine, capture: null });
      continue;
    }

    if (plateau[voisine]!.camp === piece.camp) continue;

    const l2 = ligne + dl * 2;
    const c2 = colonne + dc * 2;
    if (l2 < 0 || l2 >= N || c2 < 0 || c2 >= N) continue;
    const derriere = l2 * N + c2;
    if (plateau[derriere] === null) {
      out.push({ depart, arrivee: derriere, capture: voisine });
    }
  }
  return out;
}

/** Tous les coups d'un camp, la prise etant obligatoire si elle existe. */
function coupsLegaux(plateau: Plateau, camp: 'clair' | 'fonce'): Coup[] {
  const prises: Coup[] = [];
  const simples: Coup[] = [];

  plateau.forEach((piece, i) => {
    if (!piece || piece.camp !== camp) return;
    for (const coup of coupsDepuis(plateau, i, false)) {
      if (coup.capture !== null) prises.push(coup);
      else simples.push(coup);
    }
  });

  return prises.length > 0 ? prises : simples;
}

function appliquer(plateau: Plateau, coup: Coup): { plateau: Plateau; promue: boolean } {
  const suivant = plateau.slice();
  const piece = suivant[coup.depart]!;
  suivant[coup.depart] = null;
  if (coup.capture !== null) suivant[coup.capture] = null;

  const ligneArrivee = ligneDe(coup.arrivee);
  const promue =
    !piece.dame &&
    ((piece.camp === 'clair' && ligneArrivee === 0) || (piece.camp === 'fonce' && ligneArrivee === N - 1));

  suivant[coup.arrivee] = { camp: piece.camp, dame: piece.dame || promue };
  return { plateau: suivant, promue };
}

const compterPieces = (plateau: Plateau, camp: 'clair' | 'fonce') =>
  plateau.filter((p) => p?.camp === camp).length;

function evaluer(plateau: Plateau, camp: 'clair' | 'fonce'): number {
  let score = 0;
  plateau.forEach((piece, i) => {
    if (!piece) return;
    const valeur = piece.dame ? 5 : 3;
    // Avancer vaut des points : on encourage la progression vers la promotion.
    const avance = piece.camp === 'fonce' ? ligneDe(i) : N - 1 - ligneDe(i);
    const total = valeur + avance * 0.12;
    score += piece.camp === camp ? total : -total;
  });
  return score;
}

function minimax(
  plateau: Plateau,
  profondeur: number,
  alpha: number,
  beta: number,
  camp: 'clair' | 'fonce',
  tour: 'clair' | 'fonce',
): number {
  const coups = coupsLegaux(plateau, tour);
  if (coups.length === 0) return tour === camp ? -1000 : 1000;
  if (profondeur === 0) return evaluer(plateau, camp);

  if (tour === camp) {
    let best = -Infinity;
    for (const coup of coups) {
      const { plateau: suivant } = appliquer(plateau, coup);
      best = Math.max(best, minimax(suivant, profondeur - 1, alpha, beta, camp, autreCamp(tour)));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const coup of coups) {
    const { plateau: suivant } = appliquer(plateau, coup);
    best = Math.min(best, minimax(suivant, profondeur - 1, alpha, beta, camp, autreCamp(tour)));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function choisirCoup(plateau: Plateau, mode: Mode): Coup | null {
  const coups = coupsLegaux(plateau, 'fonce');
  if (coups.length === 0) return null;
  if (mode === 'facile') return pick(coups);

  const profondeur = mode === 'normal' ? 3 : 5;
  let meilleur = coups[0];
  let meilleurScore = -Infinity;
  for (const coup of coups) {
    const { plateau: suivant } = appliquer(plateau, coup);
    const score = minimax(suivant, profondeur, -Infinity, Infinity, 'fonce', 'clair');
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = coup;
    }
  }
  return meilleur;
}

export default function Dames({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const taille = useBoardSize(32, 0.52);
  const cellule = Math.floor(taille / N);

  const [mode, setMode] = useState<Mode>('normal');
  const [plateau, setPlateau] = useState<Plateau>(plateauInitial);
  const [tour, setTour] = useState<'clair' | 'fonce'>('clair');
  const [selection, setSelection] = useState<number | null>(null);
  /** Case d'un pion en pleine rafle : il doit continuer a sauter. */
  const [rafle, setRafle] = useState<number | null>(null);
  const [comptee, setComptee] = useState(false);

  const coups = useMemo(() => {
    const tous = coupsLegaux(plateau, tour);
    // En pleine rafle, seuls les sauts du pion concerne sont autorises.
    return rafle === null ? tous : tous.filter((coup) => coup.depart === rafle && coup.capture !== null);
  }, [plateau, tour, rafle]);

  const fini = coups.length === 0;
  const clairs = compterPieces(plateau, 'clair');
  const fonces = compterPieces(plateau, 'fonce');
  const humainGagne = fini && tour === 'fonce';

  const reset = useCallback(() => {
    setPlateau(plateauInitial());
    setTour('clair');
    setSelection(null);
    setRafle(null);
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(humainGagne ? 'success' : 'error');
    if (mode !== 'duo') submitResult(humainGagne ? 'win' : 'loss');
  }, [fini, comptee, humainGagne, mode, haptic, submitResult]);

  const jouerCoup = useCallback(
    (coup: Coup) => {
      const { plateau: suivant, promue } = appliquer(plateau, coup);
      setPlateau(suivant);
      haptic(coup.capture !== null ? 'medium' : 'light');

      // Rafle : le meme pion rejoue s'il peut encore prendre et n'a pas ete promu.
      const encore =
        coup.capture !== null &&
        !promue &&
        coupsDepuis(suivant, coup.arrivee, true).some((c) => c.capture !== null);

      if (encore) {
        setRafle(coup.arrivee);
        setSelection(coup.arrivee);
        return;
      }
      setRafle(null);
      setSelection(null);
      setTour((t) => autreCamp(t));
    },
    [plateau, haptic],
  );

  // Tour de l'ordinateur.
  useEffect(() => {
    if (mode === 'duo' || tour !== 'fonce' || fini) return;
    const id = setTimeout(() => {
      const coup = choisirCoup(plateau, mode);
      if (coup) jouerCoup(coup);
    }, 500);
    return () => clearTimeout(id);
  }, [tour, mode, fini, plateau, jouerCoup]);

  const toucher = (index: number) => {
    if (fini) return;
    if (mode !== 'duo' && tour !== 'clair') return;

    const destination = coups.find((coup) => coup.depart === selection && coup.arrivee === index);
    if (destination) {
      jouerCoup(destination);
      return;
    }
    if (rafle !== null) return; // la rafle impose le pion a jouer
    if (coups.some((coup) => coup.depart === index)) {
      haptic('light');
      setSelection(index);
    }
  };

  const destinations = coups.filter((coup) => coup.depart === selection).map((coup) => coup.arrivee);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        ⚪ {clairs} · ⚫ {fonces}
      </Txt>
      <Txt variant="label" tone="faint">
        {fini
          ? 'Partie finie'
          : rafle !== null
            ? 'Rafle en cours'
            : tour === 'clair'
              ? mode === 'duo'
                ? 'Aux clairs'
                : 'À toi'
              : mode === 'duo'
                ? 'Aux foncés'
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
        }}
      >
        {plateau.map((piece, i) => {
          const noire = caseNoire(i);
          const cible = destinations.includes(i);
          const choisie = selection === i;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={
                piece
                  ? `${piece.camp === 'clair' ? 'Pion clair' : 'Pion foncé'}${piece.dame ? ' dame' : ''}`
                  : cible
                    ? 'Case de destination'
                    : 'Case vide'
              }
              onPress={() => toucher(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: noire ? c.boardDark : c.boardLight,
              }}
            >
              {piece ? (
                <View
                  style={{
                    width: cellule * 0.74,
                    height: cellule * 0.74,
                    borderRadius: cellule,
                    backgroundColor: piece.camp === 'clair' ? '#F4F1EA' : '#24242E',
                    borderWidth: choisie ? 3 : 1.5,
                    borderColor: choisie ? c.accent : '#00000055',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {piece.dame ? (
                    <Txt style={{ fontSize: cellule * 0.36, color: piece.camp === 'clair' ? '#B8860B' : '#E3B341' }}>
                      ♛
                    </Txt>
                  ) : null}
                </View>
              ) : cible ? (
                <View
                  style={{
                    width: cellule * 0.3,
                    height: cellule * 0.3,
                    borderRadius: cellule,
                    backgroundColor: c.accent + 'AA',
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <GameOver
        visible={fini}
        outcome={mode === 'duo' ? 'win' : humainGagne ? 'win' : 'loss'}
        title={
          mode === 'duo'
            ? `Victoire des ${tour === 'clair' ? 'foncés' : 'clairs'}`
            : humainGagne
              ? 'Gagné !'
              : 'L’ordinateur gagne'
        }
        detail={`${clairs} pions clairs contre ${fonces} foncés`}
        accent="#5B8DEF"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
