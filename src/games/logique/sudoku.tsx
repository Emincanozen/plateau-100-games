import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';
import { shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'sudoku',
  name: 'Sudoku',
  tagline: 'Un chiffre de 1 à 9 par ligne, par colonne et par bloc.',
  category: 'logique',
  emoji: '9️⃣',
  difficulty: 2,
  players: '1',
  minutes: 15,
  score: 'time',
  scoreUnit: 's',
  tags: ['déduction', 'solo', 'classique'],
  rules: [
    'Chaque ligne, chaque colonne et chaque bloc de 3 × 3 doit contenir les chiffres 1 à 9, une seule fois.',
    'Touche une case vide, puis choisis un chiffre dans le clavier du bas.',
    'Le mode notes permet d’inscrire plusieurs candidats en petit dans une case.',
    'Les chiffres donnés au départ, en gras, ne peuvent pas être modifiés.',
  ],
};

type Grille = number[]; // 81 cases, 0 = vide
type Niveau = 'facile' | 'moyen' | 'difficile';

const TROUS: Record<Niveau, number> = { facile: 38, moyen: 48, difficile: 56 };

const ligneDe = (i: number) => Math.floor(i / 9);
const colonneDe = (i: number) => i % 9;
const blocDe = (i: number) => Math.floor(ligneDe(i) / 3) * 3 + Math.floor(colonneDe(i) / 3);

function estPlacable(grille: Grille, index: number, valeur: number): boolean {
  const ligne = ligneDe(index);
  const colonne = colonneDe(index);
  const bloc = blocDe(index);
  for (let i = 0; i < 81; i++) {
    if (i === index || grille[i] !== valeur) continue;
    if (ligneDe(i) === ligne || colonneDe(i) === colonne || blocDe(i) === bloc) return false;
  }
  return true;
}

/** Remplit une grille complete par retour arriere, avec un ordre aleatoire. */
function grilleComplete(): Grille {
  const grille: Grille = Array(81).fill(0);

  const remplir = (index: number): boolean => {
    if (index === 81) return true;
    for (const valeur of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (!estPlacable(grille, index, valeur)) continue;
      grille[index] = valeur;
      if (remplir(index + 1)) return true;
      grille[index] = 0;
    }
    return false;
  };

  remplir(0);
  return grille;
}

/** Compte les solutions, en s'arretant des qu'il y en a plus d'une. */
function compterSolutions(grille: Grille, limite = 2): number {
  const index = grille.indexOf(0);
  if (index === -1) return 1;
  let total = 0;
  for (let valeur = 1; valeur <= 9; valeur++) {
    if (!estPlacable(grille, index, valeur)) continue;
    grille[index] = valeur;
    total += compterSolutions(grille, limite);
    grille[index] = 0;
    if (total >= limite) break;
  }
  return total;
}

/** Retire des cases tant que la grille garde une solution unique. */
function fabriquer(niveau: Niveau): { depart: Grille; solution: Grille } {
  const solution = grilleComplete();
  const depart = solution.slice();
  const ordre = shuffle(Array.from({ length: 81 }, (_, i) => i));
  let retires = 0;

  for (const index of ordre) {
    if (retires >= TROUS[niveau]) break;
    const sauvegarde = depart[index];
    depart[index] = 0;
    if (compterSolutions(depart.slice()) !== 1) {
      depart[index] = sauvegarde;
    } else {
      retires += 1;
    }
  }
  return { depart, solution };
}

export default function Sudoku({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const taille = useBoardSize(24, 0.46);
  const cellule = Math.floor(taille / 9);

  const [niveau, setNiveau] = useState<Niveau>('facile');
  const [puzzle, setPuzzle] = useState(() => fabriquer('facile'));
  const [grille, setGrille] = useState<Grille>(() => puzzle.depart.slice());
  const [notes, setNotes] = useState<Record<number, number[]>>({});
  const [selection, setSelection] = useState<number | null>(null);
  const [modeNotes, setModeNotes] = useState(false);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const resolue = useMemo(
    () => grille.every((valeur, i) => valeur === puzzle.solution[i]),
    [grille, puzzle.solution],
  );
  const secondes = useTimer(!resolue, puzzle);

  const nouvelle = useCallback(
    (cible: Niveau) => {
      const fraiche = fabriquer(cible);
      setPuzzle(fraiche);
      setGrille(fraiche.depart.slice());
      setNotes({});
      setSelection(null);
      setRecord(false);
      setComptee(false);
    },
    [],
  );

  const reset = useCallback(() => nouvelle(niveau), [niveau, nouvelle]);
  useFrameRestart(reset);

  useEffect(() => {
    nouvelle(niveau);
  }, [niveau, nouvelle]);

  useEffect(() => {
    if (!resolue || comptee) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(secondes));
  }, [resolue, comptee, secondes, haptic, submitScore]);

  const donnee = (i: number) => puzzle.depart[i] !== 0;

  const saisir = (valeur: number) => {
    if (selection === null || donnee(selection) || resolue) return;

    if (modeNotes && valeur !== 0) {
      haptic('light');
      setNotes((n) => {
        const actuelles = n[selection] ?? [];
        return {
          ...n,
          [selection]: actuelles.includes(valeur)
            ? actuelles.filter((v) => v !== valeur)
            : [...actuelles, valeur],
        };
      });
      return;
    }

    const correcte = valeur === 0 || valeur === puzzle.solution[selection];
    haptic(valeur === 0 ? 'light' : correcte ? 'light' : 'error');
    setGrille((g) => g.map((v, i) => (i === selection ? valeur : v)));
    setNotes((n) => ({ ...n, [selection]: [] }));
  };

  const erreurs = useMemo(
    () => grille.filter((valeur, i) => valeur !== 0 && valeur !== puzzle.solution[i]).length,
    [grille, puzzle.solution],
  );

  const valeurSelectionnee = selection !== null ? grille[selection] : 0;

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
    <View style={{ flex: 1, alignItems: 'center', gap: space.md, paddingTop: space.sm }}>
      <View style={{ width: cellule * 9 }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'moyen', label: 'Moyen' },
            { value: 'difficile', label: 'Difficile' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View
        style={{
          width: cellule * 9,
          height: cellule * 9,
          flexDirection: 'row',
          flexWrap: 'wrap',
          backgroundColor: c.surface,
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: c.borderStrong,
        }}
      >
        {grille.map((valeur, i) => {
          const fixe = donnee(i);
          const fausse = valeur !== 0 && valeur !== puzzle.solution[i];
          const choisie = selection === i;
          const meme = valeur !== 0 && valeur === valeurSelectionnee;
          const memeZone =
            selection !== null &&
            (ligneDe(i) === ligneDe(selection) ||
              colonneDe(i) === colonneDe(selection) ||
              blocDe(i) === blocDe(selection));
          const candidats = notes[i] ?? [];

          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Ligne ${ligneDe(i) + 1} colonne ${colonneDe(i) + 1}, ${valeur || 'vide'}`}
              onPress={() => {
                haptic('light');
                setSelection(i);
              }}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: choisie
                  ? '#34B37E44'
                  : meme
                    ? '#34B37E22'
                    : memeZone
                      ? c.surfaceAlt
                      : c.surface,
                borderRightWidth: colonneDe(i) % 3 === 2 && colonneDe(i) !== 8 ? 1.5 : 0.5,
                borderBottomWidth: ligneDe(i) % 3 === 2 && ligneDe(i) !== 8 ? 1.5 : 0.5,
                borderColor: c.border,
              }}
            >
              {valeur !== 0 ? (
                <Txt
                  style={{
                    fontSize: cellule * 0.55,
                    fontWeight: fixe ? '800' : '600',
                    color: fausse ? c.danger : fixe ? c.text : '#34B37E',
                  }}
                >
                  {valeur}
                </Txt>
              ) : candidats.length > 0 ? (
                <Txt style={{ fontSize: cellule * 0.24, color: c.textFaint, textAlign: 'center' }}>
                  {candidats.sort((a, b) => a - b).join('')}
                </Txt>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Row gap={4} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((valeur) => {
          const restants = 9 - grille.filter((v) => v === valeur).length;
          return (
            <Pressable
              key={valeur}
              accessibilityRole="button"
              accessibilityLabel={`Saisir ${valeur}`}
              onPress={() => saisir(valeur)}
              style={{
                width: cellule * 0.94,
                height: cellule * 1.25,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: restants === 0 ? c.surfaceAlt : c.surface,
                borderWidth: 1,
                borderColor: c.border,
                opacity: restants === 0 ? 0.35 : 1,
              }}
            >
              <Txt style={{ fontSize: cellule * 0.5, fontWeight: '700' }}>{valeur}</Txt>
              <Txt variant="caption" tone="faint" style={{ fontSize: 9 }}>
                {restants > 0 ? restants : ''}
              </Txt>
            </Pressable>
          );
        })}
      </Row>

      <Row gap={space.sm}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: modeNotes }}
          onPress={() => setModeNotes((m) => !m)}
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: 10,
            borderRadius: radius.pill,
            backgroundColor: modeNotes ? '#34B37E' : c.surfaceAlt,
          }}
        >
          <Txt variant="label" style={{ color: modeNotes ? '#FFFFFF' : c.textDim }}>
            ✎ Notes
          </Txt>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Effacer la case"
          onPress={() => saisir(0)}
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: 10,
            borderRadius: radius.pill,
            backgroundColor: c.surfaceAlt,
          }}
        >
          <Txt variant="label" tone="dim">
            ⌫ Effacer
          </Txt>
        </Pressable>
      </Row>

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
