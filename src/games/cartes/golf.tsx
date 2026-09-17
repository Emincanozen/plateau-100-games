import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, EmplacementVide, Row, Txt, GameOver } from '@/ui';
import { jeu52, melanger, rangsAdjacentsCirculaires, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'golf',
  name: 'Golf',
  tagline: 'Vide les sept colonnes en enchaînant les cartes une à une.',
  category: 'cartes',
  emoji: '⛳',
  difficulty: 2,
  players: '1',
  minutes: 6,
  score: 'low',
  scoreUnit: 'cartes restantes',
  tags: ['réussite', 'solo', 'rapide'],
  rules: [
    'Seules les cartes du bas de chaque colonne sont jouables.',
    'Prends une carte dont la valeur suit celle du talon, au-dessus ou en dessous.',
    'L’as relie le roi et le deux : la suite tourne en rond.',
    'Pioche quand tu es bloqué. Le but est de finir avec le moins de cartes possible sur le tableau.',
  ],
};

const COLONNES = 7;
const HAUTEUR = 5;

interface Etat {
  colonnes: Carte[][];
  pioche: Carte[];
  talon: Carte[];
}

function distribuer(): Etat {
  const paquet = melanger(jeu52()).map((c) => ({ ...c, visible: true }));
  const colonnes: Carte[][] = [];
  for (let i = 0; i < COLONNES; i++) {
    colonnes.push(paquet.slice(i * HAUTEUR, (i + 1) * HAUTEUR));
  }
  const reste = paquet.slice(COLONNES * HAUTEUR);
  return {
    colonnes,
    pioche: reste.slice(1).map((c) => ({ ...c, visible: false })),
    talon: [reste[0]],
  };
}

export default function Golf({ submitScore, best, haptic }: GameScreenProps) {
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 24) / COLONNES) - 3, 44);
  const decalage = Math.max(20, largeurCarte * 0.46);

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const talon = etat.talon[etat.talon.length - 1];
  const restantes = useMemo(
    () => etat.colonnes.reduce((total, colonne) => total + colonne.length, 0),
    [etat.colonnes],
  );

  const coupPossible = useMemo(
    () =>
      etat.colonnes.some((colonne) => {
        const derniere = colonne[colonne.length - 1];
        return derniere && rangsAdjacentsCirculaires(derniere.rang, talon.rang);
      }),
    [etat.colonnes, talon],
  );

  const gagne = restantes === 0;
  const bloque = !gagne && etat.pioche.length === 0 && !coupPossible;
  const fini = gagne || bloque;

  const reset = useCallback(() => {
    setEtat(distribuer());
    setRecord(false);
    setComptee(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : 'error');
    setRecord(submitScore(restantes));
  }, [fini, comptee, gagne, restantes, haptic, submitScore]);

  const prendre = (index: number) => {
    if (fini) return;
    const colonne = etat.colonnes[index];
    const carte = colonne[colonne.length - 1];
    if (!carte) return;
    if (!rangsAdjacentsCirculaires(carte.rang, talon.rang)) {
      haptic('warning');
      return;
    }
    haptic('light');
    setEtat((prev) => ({
      ...prev,
      colonnes: prev.colonnes.map((col, i) => (i === index ? col.slice(0, -1) : col)),
      talon: [...prev.talon, carte],
    }));
  };

  const piocher = () => {
    if (fini || etat.pioche.length === 0) return;
    haptic('light');
    setEtat((prev) => ({
      ...prev,
      pioche: prev.pioche.slice(0, -1),
      talon: [...prev.talon, { ...prev.pioche[prev.pioche.length - 1], visible: true }],
    }));
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {restantes} cartes
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

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <Row gap={3} align="flex-start" style={{ justifyContent: 'center' }}>
        {etat.colonnes.map((colonne, index) => (
          <View key={index} style={{ width: largeurCarte }}>
            {colonne.map((carte, position) => {
              const derniere = position === colonne.length - 1;
              const jouable = derniere && rangsAdjacentsCirculaires(carte.rang, talon.rang);
              return (
                <View
                  key={carte.id}
                  style={{
                    marginTop: position === 0 ? 0 : -(largeurCarte * 1.45 - decalage),
                    zIndex: position,
                  }}
                >
                  <CarteVue
                    carte={carte}
                    largeur={largeurCarte}
                    compacte={!derniere}
                    selectionnee={jouable}
                    onPress={() => prendre(index)}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </Row>

      <Row gap={space.xl} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Pressable onPress={piocher} accessibilityRole="button" accessibilityLabel="Piocher">
          {etat.pioche.length > 0 ? (
            <CarteVue carte={{ ...etat.pioche[0], visible: false }} largeur={largeurCarte + 20} />
          ) : (
            <EmplacementVide largeur={largeurCarte + 20} glyphe="∅" />
          )}
        </Pressable>

        <View style={{ alignItems: 'center', gap: 4 }}>
          <Txt variant="caption" tone="faint">
            TALON
          </Txt>
          <CarteVue carte={talon} largeur={largeurCarte + 20} />
        </View>
      </Row>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'over'}
        title={gagne ? 'Parcours terminé !' : 'Plus aucun enchaînement'}
        score={restantes}
        scoreLabel="Cartes restantes"
        best={best}
        isRecord={record}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
