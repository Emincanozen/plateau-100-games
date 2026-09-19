import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'awale',
  name: 'Awalé',
  tagline: 'Sème tes graines et récolte celles de l’adversaire.',
  category: 'plateau',
  emoji: '🌰',
  difficulty: 3,
  players: '1-2',
  minutes: 12,
  score: 'none',
  tags: ['stratégie', 'duo', 'traditionnel'],
  rules: [
    'Choisis un de tes six trous : ses graines sont semées une par une dans les trous suivants, dans le sens inverse des aiguilles d’une montre.',
    'Si la dernière graine tombe chez l’adversaire et porte le trou à deux ou trois graines, tu les récoltes.',
    'La récolte remonte tant que les trous précédents contiennent aussi deux ou trois graines.',
    'On ne peut pas affamer l’adversaire : un coup doit lui laisser de quoi jouer. Le premier à 25 graines gagne.',
  ],
};

/**
 * Les trous 0 à 5 appartiennent au joueur du bas, 6 à 11 à celui du haut.
 * Le semis tourne dans l'ordre croissant des index.
 */
type Plateau = number[];
type Camp = 0 | 1;
type Mode = 'facile' | 'normal' | 'expert' | 'duo';

const TROUS = 12;
const GRAINES_DEPART = 4;
const OBJECTIF = 25;

const plateauInitial = (): Plateau => Array(TROUS).fill(GRAINES_DEPART);

const campDuTrou = (trou: number): Camp => (trou < 6 ? 0 : 1);

/** Coups légaux : trou non vide et qui n'affame pas l'adversaire. */
function coupsLegaux(plateau: Plateau, camp: Camp): number[] {
  const miens = plateau
    .map((graines, i) => ({ graines, i }))
    .filter((t) => campDuTrou(t.i) === camp && t.graines > 0)
    .map((t) => t.i);

  const adverseVide = plateau.every((graines, i) => campDuTrou(i) === camp || graines === 0);
  if (!adverseVide) return miens;

  // L'adversaire n'a plus rien : seuls les coups qui le réapprovisionnent valent.
  return miens.filter((trou) => {
    const { plateau: apres } = appliquer(plateau, trou, camp);
    return apres.some((graines, i) => campDuTrou(i) !== camp && graines > 0);
  });
}

/** Sème depuis `trou` et récolte si la dernière graine le permet. */
function appliquer(plateau: Plateau, trou: number, camp: Camp): { plateau: Plateau; recolte: number } {
  const suivant = plateau.slice();
  let graines = suivant[trou];
  suivant[trou] = 0;
  let position = trou;

  while (graines > 0) {
    position = (position + 1) % TROUS;
    // On ne sème jamais dans le trou de départ lors d'un tour complet.
    if (position === trou) continue;
    suivant[position] += 1;
    graines -= 1;
  }

  let recolte = 0;
  // Récolte en remontant, tant qu'on est chez l'adversaire avec 2 ou 3 graines.
  while (
    campDuTrou(position) !== camp &&
    (suivant[position] === 2 || suivant[position] === 3)
  ) {
    recolte += suivant[position];
    suivant[position] = 0;
    position = (position - 1 + TROUS) % TROUS;
  }

  return { plateau: suivant, recolte };
}

function evaluer(plateau: Plateau, greniers: [number, number], camp: Camp): number {
  const adverse: Camp = camp === 0 ? 1 : 0;
  let score = (greniers[camp] - greniers[adverse]) * 10;
  // Les graines massées de son côté sont une réserve utile.
  plateau.forEach((graines, i) => {
    score += campDuTrou(i) === camp ? graines * 0.4 : -graines * 0.4;
    // Un trou adverse à 1 ou 2 graines est une prise potentielle.
    if (campDuTrou(i) !== camp && (graines === 1 || graines === 2)) score += 1.5;
  });
  return score;
}

function minimax(
  plateau: Plateau,
  greniers: [number, number],
  profondeur: number,
  alpha: number,
  beta: number,
  camp: Camp,
  tour: Camp,
): number {
  if (greniers[0] >= OBJECTIF) return camp === 0 ? 1000 : -1000;
  if (greniers[1] >= OBJECTIF) return camp === 1 ? 1000 : -1000;

  const coups = coupsLegaux(plateau, tour);
  if (coups.length === 0 || profondeur === 0) return evaluer(plateau, greniers, camp);

  const suivant: Camp = tour === 0 ? 1 : 0;

  if (tour === camp) {
    let best = -Infinity;
    for (const coup of coups) {
      const res = appliquer(plateau, coup, tour);
      const nouveaux: [number, number] = [...greniers];
      nouveaux[tour] += res.recolte;
      best = Math.max(best, minimax(res.plateau, nouveaux, profondeur - 1, alpha, beta, camp, suivant));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const coup of coups) {
    const res = appliquer(plateau, coup, tour);
    const nouveaux: [number, number] = [...greniers];
    nouveaux[tour] += res.recolte;
    best = Math.min(best, minimax(res.plateau, nouveaux, profondeur - 1, alpha, beta, camp, suivant));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function choisirCoup(plateau: Plateau, greniers: [number, number], mode: Mode): number | null {
  const coups = coupsLegaux(plateau, 1);
  if (coups.length === 0) return null;
  if (mode === 'facile') return pick(coups);

  const profondeur = mode === 'normal' ? 3 : 6;
  let meilleur = coups[0];
  let meilleurScore = -Infinity;
  for (const coup of coups) {
    const res = appliquer(plateau, coup, 1);
    const nouveaux: [number, number] = [greniers[0], greniers[1] + res.recolte];
    const score = minimax(res.plateau, nouveaux, profondeur, -Infinity, Infinity, 1, 0);
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = coup;
    }
  }
  return meilleur;
}

export default function Awale({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(32, 0.36);
  const trou = Math.floor(largeur / 6) - 6;

  const [mode, setMode] = useState<Mode>('normal');
  const [plateau, setPlateau] = useState<Plateau>(plateauInitial);
  const [greniers, setGreniers] = useState<[number, number]>([0, 0]);
  const [tour, setTour] = useState<Camp>(0);
  const [comptee, setComptee] = useState(false);

  const mesCoups = useMemo(() => coupsLegaux(plateau, tour), [plateau, tour]);
  const fini = greniers[0] >= OBJECTIF || greniers[1] >= OBJECTIF || mesCoups.length === 0;
  const gagne = greniers[0] > greniers[1];
  const nul = greniers[0] === greniers[1];

  const reset = useCallback(() => {
    setPlateau(plateauInitial());
    setGreniers([0, 0]);
    setTour(0);
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : nul ? 'warning' : 'error');
    if (mode !== 'duo') submitResult(gagne ? 'win' : nul ? 'draw' : 'loss');
  }, [fini, comptee, gagne, nul, mode, haptic, submitResult]);

  const jouerCoup = useCallback(
    (index: number, camp: Camp) => {
      const res = appliquer(plateau, index, camp);
      setPlateau(res.plateau);
      if (res.recolte > 0) {
        setGreniers((g) => {
          const copie: [number, number] = [...g];
          copie[camp] += res.recolte;
          return copie;
        });
        haptic('success');
      } else {
        haptic('light');
      }
      setTour(camp === 0 ? 1 : 0);
    },
    [plateau, haptic],
  );

  // Tour de l'ordinateur.
  useEffect(() => {
    if (mode === 'duo' || tour !== 1 || fini) return;
    const id = setTimeout(() => {
      const coup = choisirCoup(plateau, greniers, mode);
      if (coup !== null) jouerCoup(coup, 1);
    }, 600);
    return () => clearTimeout(id);
  }, [tour, mode, fini, plateau, greniers, jouerCoup]);

  const toucher = (index: number) => {
    if (fini) return;
    if (mode !== 'duo' && tour !== 0) return;
    if (campDuTrou(index) !== tour) return;
    if (!mesCoups.includes(index)) {
      haptic('warning');
      return;
    }
    jouerCoup(index, tour);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {greniers[0]}
      </Txt>
      <Txt variant="label" tone="faint">
        {mode === 'duo' ? 'J2' : 'Ordi'} {greniers[1]}
      </Txt>
      <Txt variant="label" tone="faint">
        {fini ? 'Fini' : tour === 0 ? 'À toi' : mode === 'duo' ? 'Joueur 2' : 'Ordinateur…'}
      </Txt>
    </Row>,
  );

  const Trou = ({ index }: { index: number }) => {
    const graines = plateau[index];
    const jouable = mesCoups.includes(index) && (mode === 'duo' || tour === 0) && campDuTrou(index) === tour;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Trou ${(index % 6) + 1}, ${graines} graines`}
        onPress={() => toucher(index)}
        style={{
          width: trou,
          height: trou,
          borderRadius: trou / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.boardDark,
          borderWidth: jouable ? 2.5 : 1,
          borderColor: jouable ? '#5B8DEF' : c.boardEdge,
        }}
      >
        <Txt style={{ fontSize: trou * 0.34, fontWeight: '800', color: '#F4EAD5' }}>{graines}</Txt>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: Math.max(largeur, 280) }}>
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

      <Row gap={space.md} align="center">
        <Grenier valeur={greniers[1]} label={mode === 'duo' ? 'J2' : 'Ordi'} />

        <View
          style={{
            padding: space.sm,
            borderRadius: radius.lg,
            backgroundColor: c.boardLight,
            gap: space.sm,
          }}
        >
          {/* Rangée adverse, affichée de droite à gauche : le semis tourne. */}
          <Row gap={6}>
            {[11, 10, 9, 8, 7, 6].map((i) => (
              <Trou key={i} index={i} />
            ))}
          </Row>
          <Row gap={6}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Trou key={i} index={i} />
            ))}
          </Row>
        </View>

        <Grenier valeur={greniers[0]} label="Toi" />
      </Row>

      <Txt variant="caption" tone="faint" center>
        Premier à {OBJECTIF} graines
      </Txt>

      <GameOver
        visible={fini}
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
        score={`${greniers[0]} – ${greniers[1]}`}
        scoreLabel="Graines"
        accent="#5B8DEF"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}

function Grenier({ valeur, label }: { valeur: number; label: string }) {
  const { c, radius } = useTheme();
  return (
    <View
      style={{
        width: 44,
        height: 70,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceAlt,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Txt style={{ fontSize: 20, fontWeight: '800', color: c.text }}>{valeur}</Txt>
      <Txt variant="caption" tone="faint" style={{ fontSize: 10 }}>
        {label}
      </Txt>
    </View>
  );
}
