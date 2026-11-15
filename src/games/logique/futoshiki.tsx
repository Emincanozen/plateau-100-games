import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';
import { shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'futoshiki',
  name: 'Futoshiki',
  tagline: 'Un carré latin, plus des signes « plus grand que » à respecter.',
  category: 'logique',
  emoji: '⚖️',
  difficulty: 3,
  players: '1',
  minutes: 9,
  score: 'time',
  scoreUnit: 's',
  tags: ['déduction', 'solo', 'japonais'],
  rules: [
    'Chaque ligne et chaque colonne contient une fois chaque chiffre, de 1 à la taille de la grille.',
    'Les signes < et > entre deux cases imposent laquelle est la plus grande.',
    'Touche une case puis un chiffre du clavier du bas pour la remplir.',
    'La grille a toujours une solution unique : aucune supposition n’est nécessaire.',
  ],
};

type Taille = 4 | 5 | 6;
/** Une contrainte : la case `a` est strictement plus petite que la case `b`. */
interface Contrainte {
  a: number;
  b: number;
}

const idx = (n: number, l: number, c: number) => l * n + c;

function carreLatin(n: number): number[] {
  const grille: number[] = Array(n * n).fill(0);

  const remplir = (index: number): boolean => {
    if (index === n * n) return true;
    const l = Math.floor(index / n);
    const c = index % n;
    for (const valeur of shuffle(Array.from({ length: n }, (_, i) => i + 1))) {
      const conflitLigne = Array.from({ length: n }, (_, k) => grille[idx(n, l, k)]).includes(valeur);
      const conflitColonne = Array.from({ length: n }, (_, k) => grille[idx(n, k, c)]).includes(valeur);
      if (conflitLigne || conflitColonne) continue;
      grille[index] = valeur;
      if (remplir(index + 1)) return true;
      grille[index] = 0;
    }
    return false;
  };

  remplir(0);
  return grille;
}

/** Compte les solutions, en s'arrêtant dès qu'il y en a plus d'une. */
function compterSolutions(
  grille: number[],
  n: number,
  contraintes: Contrainte[],
  limite = 2,
): number {
  const index = grille.indexOf(0);
  if (index === -1) return 1;

  const l = Math.floor(index / n);
  const c = index % n;
  let total = 0;

  for (let valeur = 1; valeur <= n; valeur++) {
    const conflitLigne = Array.from({ length: n }, (_, k) => grille[idx(n, l, k)]).includes(valeur);
    const conflitColonne = Array.from({ length: n }, (_, k) => grille[idx(n, k, c)]).includes(valeur);
    if (conflitLigne || conflitColonne) continue;

    grille[index] = valeur;
    // Une contrainte n'est vérifiée que si ses deux cases sont remplies.
    const respecte = contraintes.every(({ a, b }) => {
      if (grille[a] === 0 || grille[b] === 0) return true;
      return grille[a] < grille[b];
    });
    if (respecte) total += compterSolutions(grille, n, contraintes, limite - total);
    grille[index] = 0;
    if (total >= limite) break;
  }
  return total;
}

function fabriquer(n: number): { depart: number[]; solution: number[]; contraintes: Contrainte[] } {
  const solution = carreLatin(n);

  // Toutes les paires voisines possibles, dans l'ordre imposé par la solution.
  const paires: Contrainte[] = [];
  for (let l = 0; l < n; l++) {
    for (let c = 0; c < n; c++) {
      if (c < n - 1) {
        const a = idx(n, l, c);
        const b = idx(n, l, c + 1);
        paires.push(solution[a] < solution[b] ? { a, b } : { a: b, b: a });
      }
      if (l < n - 1) {
        const a = idx(n, l, c);
        const b = idx(n, l + 1, c);
        paires.push(solution[a] < solution[b] ? { a, b } : { a: b, b: a });
      }
    }
  }

  const contraintes = shuffle(paires).slice(0, Math.floor(paires.length * 0.32));
  const depart = solution.slice();
  const ordre = shuffle(Array.from({ length: n * n }, (_, i) => i));

  for (const index of ordre) {
    const sauvegarde = depart[index];
    depart[index] = 0;
    if (compterSolutions(depart.slice(), n, contraintes) !== 1) depart[index] = sauvegarde;
  }

  return { depart, solution, contraintes };
}

export default function Futoshiki({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(48, 0.44);

  const [taille, setTaille] = useState<Taille>(4);
  const [puzzle, setPuzzle] = useState(() => fabriquer(4));
  const [grille, setGrille] = useState<number[]>(() => puzzle.depart.slice());
  const [selection, setSelection] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const n = taille;
  // Les signes occupent l'espace entre les cases.
  const ecart = Math.floor(largeur / (n * 5));
  const cellule = Math.floor((largeur - ecart * (n - 1)) / n);

  const resolue = useMemo(
    () => grille.every((v, i) => v !== 0 && v === puzzle.solution[i]),
    [grille, puzzle.solution],
  );
  const secondes = useTimer(!resolue, puzzle);

  const erreurs = useMemo(
    () => grille.filter((v, i) => v !== 0 && v !== puzzle.solution[i]).length,
    [grille, puzzle.solution],
  );

  const nouvelle = useCallback((cible: Taille) => {
    const fraiche = fabriquer(cible);
    setPuzzle(fraiche);
    setGrille(fraiche.depart.slice());
    setSelection(null);
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

  const donnee = (i: number) => puzzle.depart[i] !== 0;

  const saisir = (valeur: number) => {
    if (selection === null || donnee(selection) || resolue) return;
    haptic(valeur === 0 || valeur === puzzle.solution[selection] ? 'light' : 'error');
    setGrille((g) => g.map((v, i) => (i === selection ? valeur : v)));
  };

  /** Signe à afficher entre deux cases voisines, ou null. */
  const signeEntre = (a: number, b: number): string | null => {
    const contrainte = puzzle.contraintes.find(
      (k) => (k.a === a && k.b === b) || (k.a === b && k.b === a),
    );
    if (!contrainte) return null;
    // On affiche toujours dans le sens de lecture : de `a` vers `b`.
    return contrainte.a === a ? '<' : '>';
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
      <View style={{ width: Math.max(largeur, 260) }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 4, label: '4 × 4' },
            { value: 5, label: '5 × 5' },
            { value: 6, label: '6 × 6' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View>
        {Array.from({ length: n }, (_, l) => (
          <React.Fragment key={l}>
            <Row gap={0}>
              {Array.from({ length: n }, (_, col) => {
                const i = idx(n, l, col);
                const fixe = donnee(i);
                const fausse = grille[i] !== 0 && grille[i] !== puzzle.solution[i];
                const signe = col < n - 1 ? signeEntre(i, i + 1) : null;
                return (
                  <React.Fragment key={col}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ligne ${l + 1} colonne ${col + 1}, ${grille[i] || 'vide'}`}
                      onPress={() => {
                        haptic('light');
                        setSelection(i);
                      }}
                      style={{
                        width: cellule,
                        height: cellule,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radius.sm,
                        backgroundColor:
                          selection === i ? '#34B37E44' : fixe ? c.surfaceAlt : c.surface,
                        borderWidth: 1.5,
                        borderColor: selection === i ? '#34B37E' : c.border,
                      }}
                    >
                      <Txt
                        style={{
                          fontSize: cellule * 0.5,
                          fontWeight: fixe ? '800' : '600',
                          color: fausse ? c.danger : fixe ? c.text : '#34B37E',
                        }}
                      >
                        {grille[i] !== 0 ? grille[i] : ''}
                      </Txt>
                    </Pressable>
                    {col < n - 1 ? (
                      <View style={{ width: ecart, alignItems: 'center', justifyContent: 'center' }}>
                        <Txt style={{ fontSize: ecart * 0.9, fontWeight: '800', color: c.warning }}>
                          {signe ?? ''}
                        </Txt>
                      </View>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </Row>

            {l < n - 1 ? (
              <Row gap={0}>
                {Array.from({ length: n }, (_, col) => {
                  const i = idx(n, l, col);
                  const signe = signeEntre(i, i + n);
                  return (
                    <React.Fragment key={col}>
                      <View style={{ width: cellule, height: ecart, alignItems: 'center' }}>
                        <Txt style={{ fontSize: ecart * 0.9, fontWeight: '800', color: c.warning }}>
                          {signe === '<' ? '∧' : signe === '>' ? '∨' : ''}
                        </Txt>
                      </View>
                      {col < n - 1 ? <View style={{ width: ecart }} /> : null}
                    </React.Fragment>
                  );
                })}
              </Row>
            ) : null}
          </React.Fragment>
        ))}
      </View>

      <Row gap={6} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: n }, (_, i) => i + 1).map((valeur) => (
          <Pressable
            key={valeur}
            accessibilityRole="button"
            accessibilityLabel={`Saisir ${valeur}`}
            onPress={() => saisir(valeur)}
            style={{
              width: 46,
              height: 52,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Txt style={{ fontSize: 22, fontWeight: '700' }}>{valeur}</Txt>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Effacer"
          onPress={() => saisir(0)}
          style={{
            width: 46,
            height: 52,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surfaceAlt,
          }}
        >
          <Txt style={{ fontSize: 18, color: c.textDim }}>⌫</Txt>
        </Pressable>
      </Row>

      <GameOver
        visible={resolue}
        outcome="win"
        title="Futoshiki résolu !"
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
