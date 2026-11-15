import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, EmplacementVide, RATIO_CARTE, Row, Txt, GameOver } from '@/ui';
import { jeu52, melanger, rangsAdjacentsCirculaires, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'tri-peaks',
  name: 'Les trois pics',
  tagline: 'Enchaîne les cartes à la suite et fais fondre les trois sommets.',
  category: 'cartes',
  emoji: '⛰️',
  difficulty: 2,
  players: '1',
  minutes: 7,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['réussite', 'solo', 'enchaînement'],
  rules: [
    'Prends toute carte dégagée dont la valeur suit immédiatement celle du talon, en plus ou en moins.',
    'L’as relie le roi et le deux : la suite est circulaire.',
    'Chaque carte prise sans repiocher allonge ta série et rapporte de plus en plus de points.',
    'Piocher casse la série. Vide les trois pics avant d’épuiser la pioche.',
  ],
};

/**
 * Disposition classique : trois pics de trois rangées, puis une rangée
 * de dix cartes en bas. `couvertures` dit quelles cartes bloquent chaque carte.
 */
const PICS: number[][] = [
  [0, 1, 2], // sommets
  [3, 4, 5, 6, 7, 8], // deuxième rangée
  [9, 10, 11, 12, 13, 14, 15, 16, 17], // troisième rangée
  [18, 19, 20, 21, 22, 23, 24, 25, 26, 27], // base
];

const COUVERTURES: Record<number, number[]> = {
  0: [3, 4],
  1: [5, 6],
  2: [7, 8],
  3: [9, 10],
  4: [10, 11],
  5: [12, 13],
  6: [13, 14],
  7: [15, 16],
  8: [16, 17],
  9: [18, 19],
  10: [19, 20],
  11: [20, 21],
  12: [21, 22],
  13: [22, 23],
  14: [23, 24],
  15: [24, 25],
  16: [25, 26],
  17: [26, 27],
};

interface Etat {
  tableau: (Carte | null)[];
  pioche: Carte[];
  talon: Carte[];
}

function distribuer(): Etat {
  const paquet = melanger(jeu52());
  const tableau = paquet.slice(0, 28).map((carte, i) => ({ ...carte, visible: i >= 18 }));
  return {
    tableau,
    pioche: paquet.slice(29).map((c) => ({ ...c, visible: false })),
    talon: [{ ...paquet[28], visible: true }],
  };
}

export default function TriPeaks({ submitScore, best, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 24) / 10) - 2, 40);
  const hauteurCarte = largeurCarte * RATIO_CARTE;

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [score, setScore] = useState(0);
  const [serie, setSerie] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const degagee = useCallback(
    (index: number): boolean => {
      const bloqueurs = COUVERTURES[index];
      if (!bloqueurs) return true;
      return bloqueurs.every((i) => etat.tableau[i] === null);
    },
    [etat.tableau],
  );

  const gagne = useMemo(() => etat.tableau.every((carte) => carte === null), [etat.tableau]);

  const talon = etat.talon[etat.talon.length - 1];

  const coupPossible = useMemo(
    () =>
      etat.tableau.some(
        (carte, i) => carte !== null && degagee(i) && rangsAdjacentsCirculaires(carte.rang, talon.rang),
      ),
    [etat.tableau, degagee, talon],
  );

  const bloque = !gagne && etat.pioche.length === 0 && !coupPossible;
  const fini = gagne || bloque;

  const reset = useCallback(() => {
    setEtat(distribuer());
    setScore(0);
    setSerie(0);
    setRecord(false);
    setComptee(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : 'error');
    const total = score + (gagne ? 500 : 0);
    setScore(total);
    setRecord(submitScore(total));
  }, [fini, comptee, gagne, score, haptic, submitScore]);

  const prendre = (index: number) => {
    if (fini) return;
    const carte = etat.tableau[index];
    if (!carte || !degagee(index)) return;
    if (!rangsAdjacentsCirculaires(carte.rang, talon.rang)) {
      haptic('warning');
      return;
    }

    haptic('success');
    // Chaque carte d'une même série vaut de plus en plus cher.
    const gain = 10 + serie * 5;
    setScore((s) => s + gain);
    setSerie((s) => s + 1);

    setEtat((prev) => {
      const tableau = prev.tableau.slice();
      tableau[index] = null;
      // On retourne les cartes qui viennent d'être dégagées.
      const devoile = tableau.map((carteTableau, i) => {
        if (!carteTableau || carteTableau.visible) return carteTableau;
        const bloqueurs = COUVERTURES[i];
        const libre = !bloqueurs || bloqueurs.every((b) => tableau[b] === null);
        return libre ? { ...carteTableau, visible: true } : carteTableau;
      });
      return { ...prev, tableau: devoile, talon: [...prev.talon, carte] };
    });
  };

  const piocher = () => {
    if (fini || etat.pioche.length === 0) return;
    haptic('light');
    setSerie(0);
    setEtat((prev) => ({
      ...prev,
      pioche: prev.pioche.slice(0, -1),
      talon: [...prev.talon, { ...prev.pioche[prev.pioche.length - 1], visible: true }],
    }));
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {score} pts
      </Txt>
      {serie > 1 ? (
        <Txt variant="label" tone="success">
          série ×{serie}
        </Txt>
      ) : null}
      <Txt variant="label" tone="faint">
        Pioche {etat.pioche.length}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <View style={{ alignItems: 'center' }}>
        {PICS.map((rangee, r) => (
          <Row
            key={r}
            gap={2}
            style={{
              marginTop: r === 0 ? 0 : -(hauteurCarte * 0.45),
              justifyContent: 'center',
            }}
          >
            {rangee.map((index) => {
              const carte = etat.tableau[index];
              if (!carte) {
                return <View key={index} style={{ width: largeurCarte, height: hauteurCarte }} />;
              }
              const libre = degagee(index);
              const jouable = libre && rangsAdjacentsCirculaires(carte.rang, talon.rang);
              return (
                <View key={index} style={{ opacity: libre ? 1 : 0.82 }}>
                  <CarteVue
                    carte={carte}
                    largeur={largeurCarte}
                    compacte
                    selectionnee={jouable}
                    onPress={() => prendre(index)}
                  />
                </View>
              );
            })}
          </Row>
        ))}
      </View>

      <Row gap={space.xl} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Pressable onPress={piocher} accessibilityRole="button" accessibilityLabel="Piocher">
          {etat.pioche.length > 0 ? (
            <CarteVue carte={{ ...etat.pioche[0], visible: false }} largeur={largeurCarte + 16} />
          ) : (
            <EmplacementVide largeur={largeurCarte + 16} glyphe="∅" />
          )}
        </Pressable>

        <View style={{ alignItems: 'center', gap: 4 }}>
          <Txt variant="caption" tone="faint">
            TALON
          </Txt>
          <CarteVue carte={talon} largeur={largeurCarte + 16} />
        </View>
      </Row>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'over'}
        title={gagne ? 'Les trois pics sont tombés !' : 'Plus aucun enchaînement'}
        score={score}
        best={best}
        isRecord={record}
        detail={gagne ? 'Bonus de 500 points' : undefined}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
