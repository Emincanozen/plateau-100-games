import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';
import { shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'binairo',
  name: 'Binairo',
  tagline: 'Des ronds et des croix, jamais trois de suite.',
  category: 'logique',
  emoji: '⭕',
  difficulty: 3,
  players: '1',
  minutes: 10,
  score: 'time',
  scoreUnit: 's',
  tags: ['déduction', 'solo', 'logique pure'],
  rules: [
    'Chaque case reçoit un rond ou une croix — touche-la pour faire défiler les trois états.',
    'Jamais trois symboles identiques côte à côte, ni en ligne ni en colonne.',
    'Chaque ligne et chaque colonne contient autant de ronds que de croix.',
    'Deux lignes ne peuvent pas être identiques, ni deux colonnes. La grille a une solution unique.',
  ],
};

type Valeur = 0 | 1 | null;
type Taille = 6 | 8 | 10;

const idx = (n: number, l: number, c: number) => l * n + c;

/** Trois identiques d'affilée, ou déséquilibre : la grille est-elle encore valide ? */
function valide(grille: Valeur[], n: number): boolean {
  const moitie = n / 2;

  for (let l = 0; l < n; l++) {
    let zeros = 0;
    let uns = 0;
    for (let c = 0; c < n; c++) {
      const v = grille[idx(n, l, c)];
      if (v === 0) zeros += 1;
      else if (v === 1) uns += 1;
      // Trois de suite à l'horizontale.
      if (c >= 2) {
        const a = grille[idx(n, l, c - 2)];
        const b = grille[idx(n, l, c - 1)];
        if (v !== null && a === v && b === v) return false;
      }
    }
    if (zeros > moitie || uns > moitie) return false;
  }

  for (let c = 0; c < n; c++) {
    let zeros = 0;
    let uns = 0;
    for (let l = 0; l < n; l++) {
      const v = grille[idx(n, l, c)];
      if (v === 0) zeros += 1;
      else if (v === 1) uns += 1;
      if (l >= 2) {
        const a = grille[idx(n, l - 2, c)];
        const b = grille[idx(n, l - 1, c)];
        if (v !== null && a === v && b === v) return false;
      }
    }
    if (zeros > moitie || uns > moitie) return false;
  }

  // Lignes et colonnes complètes en double.
  const lignes = new Set<string>();
  for (let l = 0; l < n; l++) {
    const ligne = Array.from({ length: n }, (_, c) => grille[idx(n, l, c)]);
    if (ligne.some((v) => v === null)) continue;
    const cle = ligne.join('');
    if (lignes.has(cle)) return false;
    lignes.add(cle);
  }
  const colonnes = new Set<string>();
  for (let c = 0; c < n; c++) {
    const colonne = Array.from({ length: n }, (_, l) => grille[idx(n, l, c)]);
    if (colonne.some((v) => v === null)) continue;
    const cle = colonne.join('');
    if (colonnes.has(cle)) return false;
    colonnes.add(cle);
  }

  return true;
}

/** Remplit la grille par retour arrière ; s'arrête à `limite` solutions. */
function resoudre(grille: Valeur[], n: number, limite = 2): number {
  const index = grille.indexOf(null);
  if (index === -1) return valide(grille, n) ? 1 : 0;

  let total = 0;
  for (const valeur of [0, 1] as const) {
    grille[index] = valeur;
    if (valide(grille, n)) total += resoudre(grille, n, limite - total);
    grille[index] = null;
    if (total >= limite) break;
  }
  return total;
}

function grilleComplete(n: number): Valeur[] {
  const grille: Valeur[] = Array(n * n).fill(null);

  const remplir = (index: number): boolean => {
    if (index === n * n) return true;
    for (const valeur of shuffle([0, 1]) as (0 | 1)[]) {
      grille[index] = valeur;
      if (valide(grille, n) && remplir(index + 1)) return true;
      grille[index] = null;
    }
    return false;
  };

  remplir(0);
  return grille;
}

/** Retire des cases tant que la solution reste unique. */
function fabriquer(n: number): { depart: Valeur[]; solution: Valeur[] } {
  const solution = grilleComplete(n);
  const depart = solution.slice();
  const ordre = shuffle(Array.from({ length: n * n }, (_, i) => i));
  // On garde une proportion de cases visibles suffisante pour rester jouable.
  const aRetirer = Math.floor(n * n * (n <= 6 ? 0.5 : 0.62));
  let retires = 0;

  for (const index of ordre) {
    if (retires >= aRetirer) break;
    const sauvegarde = depart[index];
    depart[index] = null;
    if (resoudre(depart.slice(), n) !== 1) depart[index] = sauvegarde;
    else retires += 1;
  }

  return { depart, solution };
}

export default function Binairo({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.48);

  const [taille, setTaille] = useState<Taille>(6);
  const [puzzle, setPuzzle] = useState(() => fabriquer(6));
  const [grille, setGrille] = useState<Valeur[]>(() => puzzle.depart.slice());
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const n = taille;
  const cellule = Math.floor(largeur / n);

  const resolue = useMemo(
    () => grille.every((v, i) => v !== null && v === puzzle.solution[i]),
    [grille, puzzle.solution],
  );
  const secondes = useTimer(!resolue, puzzle);

  const erreurs = useMemo(
    () => grille.filter((v, i) => v !== null && v !== puzzle.solution[i]).length,
    [grille, puzzle.solution],
  );

  const nouvelle = useCallback((cible: Taille) => {
    const fraiche = fabriquer(cible);
    setPuzzle(fraiche);
    setGrille(fraiche.depart.slice());
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

  const donnee = (i: number) => puzzle.depart[i] !== null;

  const basculer = (i: number) => {
    if (donnee(i) || resolue) return;
    haptic('light');
    // Cycle : vide → rond → croix → vide.
    setGrille((g) => g.map((v, k) => (k === i ? (v === null ? 0 : v === 0 ? 1 : null) : v)));
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {formatClock(secondes)}
      </Txt>
      {erreurs > 0 ? (
        <Txt variant="label" tone="danger">
          {erreurs} erreur{erreurs > 1 ? 's' : ''}
        </Txt>
      ) : null}
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {formatClock(best)}
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
            { value: 6, label: '6 × 6' },
            { value: 8, label: '8 × 8' },
            { value: 10, label: '10 × 10' },
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
        {grille.map((valeur, i) => {
          const fixe = donnee(i);
          const fausse = valeur !== null && valeur !== puzzle.solution[i];
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Case ${i + 1}, ${valeur === null ? 'vide' : valeur === 0 ? 'rond' : 'croix'}`}
              onPress={() => basculer(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 0.5,
                borderColor: c.border,
                backgroundColor: fixe ? c.surfaceAlt : c.surface,
              }}
            >
              {valeur !== null ? (
                <Txt
                  style={{
                    fontSize: cellule * 0.5,
                    fontWeight: '800',
                    color: fausse ? c.danger : fixe ? c.text : '#34B37E',
                  }}
                >
                  {valeur === 0 ? '○' : '✕'}
                </Txt>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Txt variant="caption" tone="faint" center>
        Touche une case pour passer de vide à ○, puis à ✕
      </Txt>

      <GameOver
        visible={resolue}
        outcome="win"
        title="Grille résolue !"
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
