import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';
import { ALPHABET, MOTS_JEU } from '../lib/mots';
import { randInt, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'mots-meles',
  name: 'Mots mêlés',
  tagline: 'Les mots sont cachés dans la grille, dans tous les sens.',
  category: 'papier',
  emoji: '🔎',
  difficulty: 1,
  players: '1',
  minutes: 8,
  score: 'time',
  scoreUnit: 's',
  tags: ['mots', 'observation', 'solo'],
  rules: [
    'Touche la première lettre d’un mot, puis sa dernière : le trait se trace tout seul.',
    'Les mots se lisent horizontalement, verticalement ou en diagonale, à l’endroit comme à l’envers.',
    'Un mot trouvé est barré dans la liste et reste surligné dans la grille.',
    'Trouve-les tous. Le record retenu est ton meilleur temps.',
  ],
};

type Taille = 8 | 10 | 12;

interface MotPlace {
  mot: string;
  cases: number[];
  trouve: boolean;
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Place autant de mots que possible, sans conflit de lettres. */
function fabriquer(n: number): { grille: string[]; mots: MotPlace[] } {
  const grille: string[] = Array(n * n).fill('');
  const mots: MotPlace[] = [];
  const objectif = n <= 8 ? 6 : n <= 10 ? 9 : 12;

  const candidats = shuffle(MOTS_JEU.filter((m) => m.length >= 4 && m.length <= n));

  for (const mot of candidats) {
    if (mots.length >= objectif) break;

    let place = false;
    for (let essai = 0; essai < 60 && !place; essai++) {
      const [dl, dc] = DIRECTIONS[randInt(DIRECTIONS.length)];
      const l = randInt(n);
      const c = randInt(n);
      const finL = l + dl * (mot.length - 1);
      const finC = c + dc * (mot.length - 1);
      if (finL < 0 || finL >= n || finC < 0 || finC >= n) continue;

      // Le mot ne peut croiser un autre que sur une lettre identique.
      const cases: number[] = [];
      let compatible = true;
      for (let k = 0; k < mot.length; k++) {
        const index = (l + dl * k) * n + (c + dc * k);
        const existante = grille[index];
        if (existante !== '' && existante !== mot[k]) {
          compatible = false;
          break;
        }
        cases.push(index);
      }
      if (!compatible) continue;

      cases.forEach((index, k) => (grille[index] = mot[k]));
      mots.push({ mot, cases, trouve: false });
      place = true;
    }
  }

  // Le reste de la grille se remplit de lettres au hasard.
  for (let i = 0; i < grille.length; i++) {
    if (grille[i] === '') grille[i] = ALPHABET[randInt(ALPHABET.length)];
  }

  return { grille, mots };
}

/** Cases traversées d'un bout à l'autre, si l'alignement est valide. */
function segment(depart: number, arrivee: number, n: number): number[] | null {
  const l1 = Math.floor(depart / n);
  const c1 = depart % n;
  const l2 = Math.floor(arrivee / n);
  const c2 = arrivee % n;
  const dl = l2 - l1;
  const dc = c2 - c1;

  const aligne = dl === 0 || dc === 0 || Math.abs(dl) === Math.abs(dc);
  if (!aligne) return null;

  const longueur = Math.max(Math.abs(dl), Math.abs(dc));
  const pasL = Math.sign(dl);
  const pasC = Math.sign(dc);
  return Array.from({ length: longueur + 1 }, (_, k) => (l1 + pasL * k) * n + (c1 + pasC * k));
}

export default function MotsMeles({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(32, 0.44);

  const [taille, setTaille] = useState<Taille>(10);
  const [puzzle, setPuzzle] = useState(() => fabriquer(10));
  const [mots, setMots] = useState<MotPlace[]>(() => puzzle.mots);
  const [depart, setDepart] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const n = taille;
  const cellule = Math.floor(largeur / n);

  const tousTrouves = useMemo(() => mots.every((m) => m.trouve), [mots]);
  const secondes = useTimer(!tousTrouves, puzzle);

  const casesTrouvees = useMemo(
    () => new Set(mots.filter((m) => m.trouve).flatMap((m) => m.cases)),
    [mots],
  );

  const nouvelle = useCallback((cible: Taille) => {
    const fraiche = fabriquer(cible);
    setPuzzle(fraiche);
    setMots(fraiche.mots);
    setDepart(null);
    setRecord(false);
    setComptee(false);
  }, []);

  const reset = useCallback(() => nouvelle(taille), [taille, nouvelle]);
  useFrameRestart(reset);

  useEffect(() => {
    nouvelle(taille);
  }, [taille, nouvelle]);

  useEffect(() => {
    if (!tousTrouves || comptee || mots.length === 0) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(secondes));
  }, [tousTrouves, comptee, mots.length, secondes, haptic, submitScore]);

  const toucher = (index: number) => {
    if (tousTrouves) return;

    if (depart === null) {
      haptic('light');
      setDepart(index);
      return;
    }
    if (depart === index) {
      setDepart(null);
      return;
    }

    const trace = segment(depart, index, n);
    setDepart(null);
    if (!trace) {
      haptic('warning');
      return;
    }

    // Le tracé correspond-il à un mot, dans un sens ou dans l'autre ?
    const cible = mots.find(
      (m) =>
        !m.trouve &&
        m.cases.length === trace.length &&
        (m.cases.every((v, k) => v === trace[k]) ||
          m.cases.every((v, k) => v === trace[trace.length - 1 - k])),
    );

    if (!cible) {
      haptic('warning');
      return;
    }
    haptic('success');
    setMots((liste) => liste.map((m) => (m.mot === cible.mot ? { ...m, trouve: true } : m)));
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {mots.filter((m) => m.trouve).length}/{mots.length}
      </Txt>
      <Txt variant="label" tone="faint">
        {formatClock(secondes)}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {formatClock(best)}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: space.md, paddingTop: space.sm }}>
      <View style={{ width: Math.max(cellule * n, 260) }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 8, label: '8 × 8' },
            { value: 10, label: '10 × 10' },
            { value: 12, label: '12 × 12' },
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
        {puzzle.grille.map((lettre, i) => {
          const trouvee = casesTrouvees.has(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Lettre ${lettre}`}
              onPress={() => toucher(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: depart === i ? '#4BC4D6' : trouvee ? '#4BC4D633' : c.surface,
                borderWidth: 0.5,
                borderColor: c.border,
              }}
            >
              <Txt
                style={{
                  fontSize: cellule * 0.46,
                  fontWeight: trouvee ? '800' : '600',
                  color: depart === i ? '#FFFFFF' : trouvee ? '#4BC4D6' : c.text,
                }}
              >
                {lettre}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: space.md }}>
        {mots.map((m) => (
          <View
            key={m.mot}
            style={{
              paddingHorizontal: space.sm,
              paddingVertical: 3,
              borderRadius: radius.pill,
              backgroundColor: m.trouve ? '#4BC4D622' : c.surfaceAlt,
            }}
          >
            <Txt
              variant="caption"
              style={{
                color: m.trouve ? '#4BC4D6' : c.textDim,
                textDecorationLine: m.trouve ? 'line-through' : 'none',
              }}
            >
              {m.mot}
            </Txt>
          </View>
        ))}
      </Row>

      <Txt variant="caption" tone="faint">
        Touche la première puis la dernière lettre
      </Txt>

      <GameOver
        visible={tousTrouves && mots.length > 0}
        outcome="win"
        title="Tous les mots sont trouvés !"
        score={formatClock(secondes)}
        scoreLabel="Temps"
        best={best !== undefined ? formatClock(best) : undefined}
        isRecord={record}
        accent="#4BC4D6"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
