import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';
import { randInt, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'hitori',
  name: 'Hitori',
  tagline: 'Noircis les doublons, sans jamais en coller deux ni couper la grille.',
  category: 'logique',
  emoji: '⬛',
  difficulty: 3,
  players: '1',
  minutes: 10,
  score: 'time',
  scoreUnit: 's',
  tags: ['déduction', 'solo', 'japonais'],
  rules: [
    'Noircis des cases pour qu’aucun chiffre ne se répète dans une ligne ou une colonne.',
    'Deux cases noircies ne peuvent pas être côte à côte — en diagonale, c’est permis.',
    'Toutes les cases restées blanches doivent former un seul bloc d’un seul tenant.',
    'Touche une case pour la noircir, touche encore pour la marquer d’un point, encore pour l’effacer.',
  ],
};

type Etat = 0 | 1 | 2; // 0 blanc, 1 noirci, 2 marqué sûr
type Taille = 5 | 7 | 9;

const idx = (n: number, l: number, c: number) => l * n + c;

/**
 * Fabrique une grille depuis sa solution : on part d'un carré latin,
 * on choisit des cases à noircir (jamais adjacentes, complément connexe),
 * puis on remplace leur valeur par un doublon de leur ligne ou colonne.
 */
function fabriquer(n: number): { valeurs: number[]; solution: boolean[] } {
  // Carré latin par décalage : chaque ligne et colonne a des valeurs distinctes.
  const permutation = shuffle(Array.from({ length: n }, (_, i) => i + 1));
  const valeurs: number[] = [];
  for (let l = 0; l < n; l++) {
    for (let c = 0; c < n; c++) {
      valeurs.push(permutation[(l + c) % n]);
    }
  }

  const noircies: boolean[] = Array(n * n).fill(false);
  const cible = Math.floor(n * n * 0.22);
  const ordre = shuffle(Array.from({ length: n * n }, (_, i) => i));

  const voisines = (i: number): number[] => {
    const l = Math.floor(i / n);
    const c = i % n;
    const out: number[] = [];
    if (l > 0) out.push(i - n);
    if (l < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  };

  /** Les cases blanches forment-elles un seul bloc ? */
  const blanchesConnexes = (masque: boolean[]): boolean => {
    const depart = masque.findIndex((noire) => !noire);
    if (depart === -1) return false;
    const vues = new Set([depart]);
    const pile = [depart];
    while (pile.length) {
      const courante = pile.pop()!;
      for (const voisine of voisines(courante)) {
        if (masque[voisine] || vues.has(voisine)) continue;
        vues.add(voisine);
        pile.push(voisine);
      }
    }
    return vues.size === masque.filter((noire) => !noire).length;
  };

  let posees = 0;
  for (const i of ordre) {
    if (posees >= cible) break;
    if (voisines(i).some((v) => noircies[v])) continue;
    noircies[i] = true;
    if (!blanchesConnexes(noircies)) {
      noircies[i] = false;
      continue;
    }
    posees += 1;
  }

  // Chaque case noircie reçoit un doublon : c'est ce qui la rend détectable.
  for (let i = 0; i < n * n; i++) {
    if (!noircies[i]) continue;
    const l = Math.floor(i / n);
    const c = i % n;
    const candidats: number[] = [];
    for (let k = 0; k < n; k++) {
      if (k !== c && !noircies[idx(n, l, k)]) candidats.push(valeurs[idx(n, l, k)]);
      if (k !== l && !noircies[idx(n, k, c)]) candidats.push(valeurs[idx(n, k, c)]);
    }
    if (candidats.length > 0) valeurs[i] = candidats[randInt(candidats.length)];
  }

  return { valeurs, solution: noircies };
}

export default function Hitori({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.46);

  const [taille, setTaille] = useState<Taille>(5);
  const [puzzle, setPuzzle] = useState(() => fabriquer(5));
  const [etats, setEtats] = useState<Etat[]>(() => Array(25).fill(0));
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const n = taille;
  const cellule = Math.floor(largeur / n);

  const resolue = useMemo(
    () => puzzle.solution.every((noire, i) => noire === (etats[i] === 1)),
    [puzzle.solution, etats],
  );
  const secondes = useTimer(!resolue, puzzle);

  /** Erreurs visibles : deux cases noircies collées. */
  const collisions = useMemo(() => {
    let total = 0;
    for (let i = 0; i < n * n; i++) {
      if (etats[i] !== 1) continue;
      const l = Math.floor(i / n);
      const col = i % n;
      if (col < n - 1 && etats[i + 1] === 1) total += 1;
      if (l < n - 1 && etats[i + n] === 1) total += 1;
    }
    return total;
  }, [etats, n]);

  const nouvelle = useCallback((cible: Taille) => {
    setPuzzle(fabriquer(cible));
    setEtats(Array(cible * cible).fill(0));
    setRecord(false);
    setComptee(false);
  }, []);

  const reset = useCallback(() => nouvelle(taille), [taille, nouvelle]);
  useFrameRestart(reset);

  useEffect(() => {
    nouvelle(taille);
  }, [taille, nouvelle]);

  useEffect(() => {
    if (!resolue || comptee) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(secondes));
  }, [resolue, comptee, secondes, haptic, submitScore]);

  const basculer = (i: number) => {
    if (resolue) return;
    haptic('light');
    setEtats((e) => e.map((v, k) => (k === i ? (((v + 1) % 3) as Etat) : v)));
  };

  const noircies = etats.filter((e) => e === 1).length;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {formatClock(secondes)}
      </Txt>
      <Txt variant="label" tone="faint">
        {noircies} noircies
      </Txt>
      {collisions > 0 ? (
        <Txt variant="label" tone="danger">
          {collisions} collées
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: Math.max(cellule * n, 260) }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 5, label: '5 × 5' },
            { value: 7, label: '7 × 7' },
            { value: 9, label: '9 × 9' },
          ]}
          accent="#34B37E"
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
        {puzzle.valeurs.map((valeur, i) => {
          const etat = etats[i];
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Case ${valeur}, ${etat === 1 ? 'noircie' : etat === 2 ? 'marquée sûre' : 'blanche'}`}
              onPress={() => basculer(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 0.5,
                borderColor: c.border,
                backgroundColor: etat === 1 ? c.text : c.surface,
              }}
            >
              <Txt
                style={{
                  fontSize: cellule * 0.44,
                  fontWeight: '700',
                  color: etat === 1 ? c.bg : c.text,
                  opacity: etat === 1 ? 0.35 : 1,
                }}
              >
                {valeur}
              </Txt>
              {etat === 2 ? (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 3,
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: '#34B37E',
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Txt variant="caption" tone="faint" center>
        Touche une case : blanche → noircie → marquée sûre
      </Txt>

      <GameOver
        visible={resolue}
        outcome="win"
        title="Hitori résolu !"
        score={formatClock(secondes)}
        scoreLabel="Temps"
        best={best !== undefined ? formatClock(best) : undefined}
        isRecord={record}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
