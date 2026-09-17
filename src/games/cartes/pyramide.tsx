import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, EmplacementVide, RATIO_CARTE, Row, Txt, GameOver } from '@/ui';
import { jeu52, melanger, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'pyramide',
  name: 'Pyramide',
  tagline: 'Associe les cartes qui totalisent treize pour démonter la pyramide.',
  category: 'cartes',
  emoji: '🔺',
  difficulty: 2,
  players: '1',
  minutes: 8,
  score: 'high',
  scoreUnit: 'cartes',
  tags: ['réussite', 'solo', 'calcul'],
  rules: [
    'Seules les cartes entièrement dégagées, en bas de la pyramide, sont jouables.',
    'Retire deux cartes dont la somme fait 13 : as = 1, valet = 11, dame = 12.',
    'Le roi vaut 13 : il part tout seul, d’un simple contact.',
    'La pioche donne une carte à la fois, utilisable pour former une paire.',
  ],
};

const RANGEES = 7;
const TOTAL_PYRAMIDE = (RANGEES * (RANGEES + 1)) / 2; // 28 cartes

interface Etat {
  pyramide: (Carte | null)[];
  pioche: Carte[];
  defausse: Carte[];
}

/** Indices des deux cartes qui reposent sur `index` dans la rangée du dessous. */
function enfants(index: number): [number, number] | null {
  let rangee = 0;
  let debut = 0;
  while (debut + rangee + 1 <= index) {
    debut += rangee + 1;
    rangee += 1;
  }
  if (rangee === RANGEES - 1) return null; // dernière rangée : rien au-dessous
  const position = index - debut;
  const debutSuivante = debut + rangee + 1;
  return [debutSuivante + position, debutSuivante + position + 1];
}

function distribuer(): Etat {
  const paquet = melanger(jeu52()).map((c) => ({ ...c, visible: true }));
  return {
    pyramide: paquet.slice(0, TOTAL_PYRAMIDE),
    pioche: paquet.slice(TOTAL_PYRAMIDE).map((c) => ({ ...c, visible: false })),
    defausse: [],
  };
}

export default function Pyramide({ submitScore, best, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 28) / RANGEES) - 2, 46);
  const hauteurCarte = largeurCarte * RATIO_CARTE;

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [selection, setSelection] = useState<number | 'defausse' | null>(null);
  const [retirees, setRetirees] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const degagee = useCallback(
    (index: number): boolean => {
      const dessous = enfants(index);
      if (!dessous) return true;
      return etat.pyramide[dessous[0]] === null && etat.pyramide[dessous[1]] === null;
    },
    [etat.pyramide],
  );

  const gagne = useMemo(() => etat.pyramide.every((carte) => carte === null), [etat.pyramide]);

  /** Plus aucun coup possible : pioche vide et aucune paire jouable. */
  const bloque = useMemo(() => {
    if (gagne || etat.pioche.length > 0) return false;
    const jouables: Carte[] = [];
    etat.pyramide.forEach((carte, i) => {
      if (carte && degagee(i)) jouables.push(carte);
    });
    const dessusDefausse = etat.defausse[etat.defausse.length - 1];
    if (dessusDefausse) jouables.push(dessusDefausse);
    if (jouables.some((carte) => carte.rang === 13)) return false;
    for (let i = 0; i < jouables.length; i++) {
      for (let j = i + 1; j < jouables.length; j++) {
        if (jouables[i].rang + jouables[j].rang === 13) return false;
      }
    }
    return true;
  }, [gagne, etat, degagee]);

  const fini = gagne || bloque;

  const reset = useCallback(() => {
    setEtat(distribuer());
    setSelection(null);
    setRetirees(0);
    setRecord(false);
    setComptee(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : 'error');
    setRecord(submitScore(retirees));
  }, [fini, comptee, gagne, retirees, haptic, submitScore]);

  const carteDe = (cible: number | 'defausse'): Carte | null =>
    cible === 'defausse'
      ? (etat.defausse[etat.defausse.length - 1] ?? null)
      : etat.pyramide[cible];

  const enlever = (cibles: (number | 'defausse')[]) => {
    setEtat((prev) => {
      const pyramide = prev.pyramide.slice();
      let defausse = prev.defausse;
      for (const cible of cibles) {
        if (cible === 'defausse') defausse = defausse.slice(0, -1);
        else pyramide[cible] = null;
      }
      return { ...prev, pyramide, defausse };
    });
    setRetirees((n) => n + cibles.length);
    setSelection(null);
  };

  const toucher = (cible: number | 'defausse') => {
    if (fini) return;
    const carte = carteDe(cible);
    if (!carte) return;
    if (typeof cible === 'number' && !degagee(cible)) {
      haptic('warning');
      return;
    }

    // Le roi vaut 13 : il se retire seul.
    if (carte.rang === 13) {
      haptic('success');
      enlever([cible]);
      return;
    }

    if (selection === null) {
      haptic('light');
      setSelection(cible);
      return;
    }
    if (selection === cible) {
      setSelection(null);
      return;
    }

    const autre = carteDe(selection);
    if (autre && autre.rang + carte.rang === 13) {
      haptic('success');
      enlever([selection, cible]);
    } else {
      haptic('warning');
      setSelection(cible);
    }
  };

  const piocher = () => {
    if (fini || etat.pioche.length === 0) return;
    haptic('light');
    setSelection(null);
    setEtat((prev) => ({
      ...prev,
      pioche: prev.pioche.slice(0, -1),
      defausse: [...prev.defausse, { ...prev.pioche[prev.pioche.length - 1], visible: true }],
    }));
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {retirees} cartes
      </Txt>
      <Txt variant="label" tone="faint">
        Pioche {etat.pioche.length}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  // Découpage de la pyramide en rangées pour l'affichage.
  const rangees: (Carte | null)[][] = [];
  let curseur = 0;
  for (let r = 0; r < RANGEES; r++) {
    rangees.push(etat.pyramide.slice(curseur, curseur + r + 1));
    curseur += r + 1;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <View style={{ alignItems: 'center' }}>
        {rangees.map((rangee, r) => {
          const debut = (r * (r + 1)) / 2;
          return (
            <Row
              key={r}
              gap={3}
              style={{ marginTop: r === 0 ? 0 : -(hauteurCarte * 0.42), justifyContent: 'center' }}
            >
              {rangee.map((carte, position) => {
                const index = debut + position;
                if (!carte) {
                  return <View key={index} style={{ width: largeurCarte, height: hauteurCarte }} />;
                }
                const libre = degagee(index);
                return (
                  <View key={index} style={{ opacity: libre ? 1 : 0.55 }}>
                    <CarteVue
                      carte={carte}
                      largeur={largeurCarte}
                      compacte
                      selectionnee={selection === index}
                      onPress={() => toucher(index)}
                    />
                  </View>
                );
              })}
            </Row>
          );
        })}
      </View>

      <Row between style={{ paddingHorizontal: space.lg }}>
        <Pressable onPress={piocher} accessibilityRole="button" accessibilityLabel="Piocher">
          {etat.pioche.length > 0 ? (
            <CarteVue carte={{ ...etat.pioche[0], visible: false }} largeur={largeurCarte + 10} />
          ) : (
            <EmplacementVide largeur={largeurCarte + 10} glyphe="∅" />
          )}
        </Pressable>

        <View style={{ alignItems: 'center', gap: 4 }}>
          <Txt variant="caption" tone="faint">
            SOMME À FORMER
          </Txt>
          <Txt style={{ fontSize: 26, fontWeight: '800', color: c.accent }}>13</Txt>
        </View>

        {etat.defausse.length > 0 ? (
          <CarteVue
            carte={etat.defausse[etat.defausse.length - 1]}
            largeur={largeurCarte + 10}
            selectionnee={selection === 'defausse'}
            onPress={() => toucher('defausse')}
          />
        ) : (
          <EmplacementVide largeur={largeurCarte + 10} />
        )}
      </Row>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Pyramide démontée !' : 'Plus aucun coup possible'}
        score={retirees}
        scoreLabel="Cartes retirées"
        best={best}
        isRecord={record}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
