import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'nonogram',
  name: 'Nonogram',
  tagline: 'Les chiffres disent où noircir. Une image apparaît.',
  category: 'logique',
  emoji: '🖼️',
  difficulty: 3,
  players: '1',
  minutes: 12,
  score: 'time',
  scoreUnit: 's',
  tags: ['déduction', 'solo', 'picross'],
  rules: [
    'Les chiffres d’une ligne donnent les blocs noirs à y placer, dans l’ordre, séparés d’au moins une case vide.',
    'Touche une case pour la noircir, touche encore pour la marquer d’une croix, encore pour l’effacer.',
    'Les croix ne servent qu’à toi : elles marquent les cases sûrement vides.',
    'La grille est résolue quand tous les indices de lignes et de colonnes sont satisfaits.',
  ],
};

type Etat = 0 | 1 | 2; // 0 vide, 1 noirci, 2 croix
type Taille = 5 | 10 | 15;

/** Suite des longueurs de blocs noirs d'une ligne. */
export function indicesDe(ligne: number[]): number[] {
  const out: number[] = [];
  let courant = 0;
  for (const cellule of ligne) {
    if (cellule === 1) courant += 1;
    else if (courant > 0) {
      out.push(courant);
      courant = 0;
    }
  }
  if (courant > 0) out.push(courant);
  return out.length > 0 ? out : [0];
}

const memesIndices = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Motif aléatoire : on vise une densité lisible, ni vide ni saturée. */
function creerMotif(n: number): number[] {
  const densite = n <= 5 ? 0.55 : n <= 10 ? 0.5 : 0.45;
  let motif: number[] = [];
  let essais = 0;

  do {
    motif = Array.from({ length: n * n }, () => (Math.random() < densite ? 1 : 0));
    essais += 1;
    // On refuse les lignes ou colonnes entièrement vides : la grille serait terne.
    const ligneVide = Array.from({ length: n }, (_, l) =>
      motif.slice(l * n, (l + 1) * n).every((v) => v === 0),
    ).some(Boolean);
    const colonneVide = Array.from({ length: n }, (_, c) =>
      Array.from({ length: n }, (_, l) => motif[l * n + c]).every((v) => v === 0),
    ).some(Boolean);
    if (!ligneVide && !colonneVide) break;
  } while (essais < 40);

  return motif;
}

export default function Nonogram({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeurTotale = useBoardSize(24, 0.5);

  const [taille, setTaille] = useState<Taille>(5);
  const [motif, setMotif] = useState<number[]>(() => creerMotif(5));
  const [grille, setGrille] = useState<Etat[]>(() => Array(25).fill(0));
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const n = taille;
  // Les indices occupent une gouttière : on réserve environ un tiers de la largeur.
  const gouttiere = Math.floor(largeurTotale * (n <= 5 ? 0.3 : 0.26));
  const cellule = Math.floor((largeurTotale - gouttiere) / n);

  const indicesLignes = useMemo(
    () => Array.from({ length: n }, (_, l) => indicesDe(motif.slice(l * n, (l + 1) * n))),
    [motif, n],
  );
  const indicesColonnes = useMemo(
    () =>
      Array.from({ length: n }, (_, col) =>
        indicesDe(Array.from({ length: n }, (_, l) => motif[l * n + col])),
      ),
    [motif, n],
  );

  /** Victoire : les indices du joueur correspondent, même si le motif diffère. */
  const resolue = useMemo(() => {
    const noircies = grille.map((e) => (e === 1 ? 1 : 0));
    for (let l = 0; l < n; l++) {
      if (!memesIndices(indicesDe(noircies.slice(l * n, (l + 1) * n)), indicesLignes[l])) return false;
    }
    for (let col = 0; col < n; col++) {
      const colonne = Array.from({ length: n }, (_, l) => noircies[l * n + col]);
      if (!memesIndices(indicesDe(colonne), indicesColonnes[col])) return false;
    }
    return true;
  }, [grille, n, indicesLignes, indicesColonnes]);

  const secondes = useTimer(!resolue, motif);

  const nouvelle = useCallback((cible: Taille) => {
    setMotif(creerMotif(cible));
    setGrille(Array(cible * cible).fill(0));
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
    setGrille((g) => g.map((e, k) => (k === i ? (((e + 1) % 3) as Etat) : e)));
  };

  const noircies = grille.filter((e) => e === 1).length;
  const attendues = motif.filter((v) => v === 1).length;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {formatClock(secondes)}
      </Txt>
      <Txt variant="label" tone="faint">
        {noircies}/{attendues}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {formatClock(best)}
        </Txt>
      ) : null}
    </Row>,
  );

  const tailleIndice = Math.max(8, Math.min(12, cellule * 0.42));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: Math.max(largeurTotale, 260) }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 5, label: '5 × 5' },
            { value: 10, label: '10 × 10' },
            { value: 15, label: '15 × 15' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View>
        {/* Indices des colonnes */}
        <Row gap={0} align="flex-end">
          <View style={{ width: gouttiere, height: gouttiere }} />
          {indicesColonnes.map((indices, col) => (
            <View
              key={col}
              style={{
                width: cellule,
                height: gouttiere,
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: 2,
              }}
            >
              {indices.map((valeur, k) => (
                <Txt
                  key={k}
                  style={{ fontSize: tailleIndice, color: c.textDim, lineHeight: tailleIndice * 1.15 }}
                >
                  {valeur}
                </Txt>
              ))}
            </View>
          ))}
        </Row>

        <Row gap={0} align="flex-start">
          {/* Indices des lignes */}
          <View style={{ width: gouttiere }}>
            {indicesLignes.map((indices, l) => (
              <View
                key={l}
                style={{
                  height: cellule,
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  paddingRight: 4,
                  gap: 3,
                }}
              >
                {indices.map((valeur, k) => (
                  <Txt key={k} style={{ fontSize: tailleIndice, color: c.textDim }}>
                    {valeur}
                  </Txt>
                ))}
              </View>
            ))}
          </View>

          <View
            style={{
              width: cellule * n,
              height: cellule * n,
              flexDirection: 'row',
              flexWrap: 'wrap',
              borderWidth: 1.5,
              borderColor: c.borderStrong,
              borderRadius: 2,
            }}
          >
            {grille.map((etat, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Case ${i + 1}, ${etat === 1 ? 'noircie' : etat === 2 ? 'marquée' : 'vide'}`}
                onPress={() => basculer(i)}
                style={{
                  width: cellule,
                  height: cellule,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 0.5,
                  borderColor: c.border,
                  // Trait plus marqué tous les cinq, comme sur les grilles imprimées.
                  borderRightWidth: (i % n) % 5 === 4 ? 1.5 : 0.5,
                  borderBottomWidth: Math.floor(i / n) % 5 === 4 ? 1.5 : 0.5,
                  backgroundColor: etat === 1 ? c.text : c.surface,
                }}
              >
                {etat === 2 ? (
                  <Txt style={{ fontSize: cellule * 0.5, color: c.textFaint }}>✕</Txt>
                ) : null}
              </Pressable>
            ))}
          </View>
        </Row>
      </View>

      <GameOver
        visible={resolue}
        outcome="win"
        title="Image révélée !"
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
