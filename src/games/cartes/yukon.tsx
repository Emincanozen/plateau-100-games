import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, EmplacementVide, RATIO_CARTE, Row, Txt, GameOver } from '@/ui';
import { COULEURS, SYMBOLE, jeu52, melanger, type Carte, type Couleur } from '../lib/cartes';
import { formatClock, useTimer } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'yukon',
  name: 'Yukon',
  tagline: 'Comme le solitaire, mais tu déplaces les paquets en désordre.',
  category: 'cartes',
  emoji: '🏔️',
  difficulty: 3,
  players: '1',
  minutes: 12,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['réussite', 'solo', 'exigeant'],
  rules: [
    'Aucune pioche : les cinquante-deux cartes sont sur la table dès le départ.',
    'Tu peux déplacer n’importe quelle carte visible avec tout ce qui la recouvre, même en désordre.',
    'La carte déplacée doit se poser sur une carte d’un rang au-dessus et de couleur opposée.',
    'Seul un roi occupe une colonne vide. Remonte les quatre familles de l’as au roi.',
  ],
};

const COLONNES = 7;

interface Etat {
  colonnes: Carte[][];
  fondations: Record<Couleur, Carte[]>;
}

/**
 * Distribution du Yukon : la première colonne reçoit une carte,
 * les suivantes reçoivent des cartes cachées puis cinq cartes visibles.
 */
function distribuer(): Etat {
  const paquet = melanger(jeu52());
  const colonnes: Carte[][] = Array.from({ length: COLONNES }, () => []);
  let curseur = 0;

  colonnes[0].push({ ...paquet[curseur++], visible: true });

  for (let i = 1; i < COLONNES; i++) {
    for (let k = 0; k < i; k++) {
      colonnes[i].push({ ...paquet[curseur++], visible: false });
    }
    for (let k = 0; k < 5; k++) {
      colonnes[i].push({ ...paquet[curseur++], visible: true });
    }
  }

  return { colonnes, fondations: { P: [], C: [], K: [], T: [] } };
}

const sommet = (pile: Carte[]): Carte | undefined => pile[pile.length - 1];

function peutPoserSurColonne(carte: Carte, colonne: Carte[]): boolean {
  const dessus = sommet(colonne);
  if (!dessus) return carte.rang === 13;
  return dessus.visible && dessus.rouge !== carte.rouge && dessus.rang === carte.rang + 1;
}

function peutPoserSurFondation(carte: Carte, fondation: Carte[]): boolean {
  const dessus = sommet(fondation);
  if (!dessus) return carte.rang === 1;
  return dessus.rang === carte.rang - 1;
}

/** Retourne la dernière carte d'une colonne si elle est face cachée. */
const devoiler = (colonnes: Carte[][]): Carte[][] =>
  colonnes.map((colonne) => {
    const derniere = sommet(colonne);
    if (!derniere || derniere.visible) return colonne;
    return [...colonne.slice(0, -1), { ...derniere, visible: true }];
  });

export default function Yukon({ submitScore, best, haptic }: GameScreenProps) {
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 24 - 6 * 4) / COLONNES), 56);
  const hauteurCarte = largeurCarte * RATIO_CARTE;
  const decalage = Math.max(15, largeurCarte * 0.3);

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [selection, setSelection] = useState<{ colonne: number; depuis: number } | null>(null);
  const [coups, setCoups] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const gagne = useMemo(
    () => COULEURS.every((couleur) => etat.fondations[couleur].length === 13),
    [etat.fondations],
  );
  const secondes = useTimer(!gagne, coups === 0);

  const reset = useCallback(() => {
    setEtat(distribuer());
    setSelection(null);
    setCoups(0);
    setRecord(false);
    setComptee(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!gagne || comptee) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(coups));
  }, [gagne, comptee, coups, haptic, submitScore]);

  /** Déplace le paquet sélectionné vers une colonne. */
  const versColonne = (cible: number) => {
    if (!selection) return;
    const paquet = etat.colonnes[selection.colonne].slice(selection.depuis);
    if (paquet.length === 0) return;

    if (!peutPoserSurColonne(paquet[0], etat.colonnes[cible])) {
      haptic('warning');
      setSelection(null);
      return;
    }

    haptic('light');
    setEtat((prev) => {
      const colonnes = prev.colonnes.map((colonne, i) => {
        if (i === selection.colonne) return colonne.slice(0, selection.depuis);
        if (i === cible) return [...colonne, ...paquet];
        return colonne;
      });
      return { ...prev, colonnes: devoiler(colonnes) };
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  /** Monte une carte seule sur sa fondation. */
  const versFondation = (couleur: Couleur) => {
    if (!selection) return;
    const paquet = etat.colonnes[selection.colonne].slice(selection.depuis);
    if (paquet.length !== 1 || paquet[0].couleur !== couleur) {
      haptic('warning');
      setSelection(null);
      return;
    }
    if (!peutPoserSurFondation(paquet[0], etat.fondations[couleur])) {
      haptic('warning');
      setSelection(null);
      return;
    }

    haptic('success');
    setEtat((prev) => {
      const colonnes = prev.colonnes.map((colonne, i) =>
        i === selection.colonne ? colonne.slice(0, selection.depuis) : colonne,
      );
      return {
        colonnes: devoiler(colonnes),
        fondations: { ...prev.fondations, [couleur]: [...prev.fondations[couleur], paquet[0]] },
      };
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  const toucherCarte = (colonne: number, position: number) => {
    const pile = etat.colonnes[colonne];

    if (selection) {
      // Retoucher la carte déjà choisie tente de la monter en fondation.
      if (selection.colonne === colonne && selection.depuis === position) {
        const carte = pile[position];
        if (position === pile.length - 1 && peutPoserSurFondation(carte, etat.fondations[carte.couleur])) {
          versFondation(carte.couleur);
        } else {
          setSelection(null);
        }
        return;
      }
      versColonne(colonne);
      return;
    }

    if (!pile[position]?.visible) return;
    haptic('light');
    setSelection({ colonne, depuis: position });
  };

  const estSelectionnee = (colonne: number, position: number) =>
    selection?.colonne === colonne && position >= selection.depuis;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {coups} coups
      </Txt>
      <Txt variant="label" tone="faint">
        {formatClock(secondes)}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, gap: space.md, paddingTop: space.sm }}>
      <Row gap={4} style={{ justifyContent: 'center' }}>
        {COULEURS.map((couleur) => {
          const pile = etat.fondations[couleur];
          const dessus = sommet(pile);
          return dessus ? (
            <CarteVue
              key={couleur}
              carte={dessus}
              largeur={largeurCarte}
              onPress={() => versFondation(couleur)}
            />
          ) : (
            <EmplacementVide
              key={couleur}
              largeur={largeurCarte}
              glyphe={SYMBOLE[couleur]}
              onPress={() => versFondation(couleur)}
            />
          );
        })}
      </Row>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Row gap={4} align="flex-start">
          {etat.colonnes.map((colonne, index) => (
            <View key={index} style={{ width: largeurCarte, minHeight: hauteurCarte }}>
              {colonne.length === 0 ? (
                <EmplacementVide largeur={largeurCarte} onPress={() => versColonne(index)} />
              ) : (
                colonne.map((carte, position) => (
                  <View
                    key={carte.id}
                    style={{
                      marginTop: position === 0 ? 0 : -(hauteurCarte - decalage),
                      zIndex: position,
                    }}
                  >
                    <CarteVue
                      carte={carte}
                      largeur={largeurCarte}
                      compacte={position < colonne.length - 1}
                      selectionnee={estSelectionnee(index, position)}
                      onPress={() => toucherCarte(index, position)}
                    />
                  </View>
                ))
              )}
            </View>
          ))}
        </Row>
        <View style={{ height: space.xxl }} />
      </ScrollView>

      <GameOver
        visible={gagne}
        outcome="win"
        title="Yukon résolu !"
        score={coups}
        scoreLabel="Coups"
        best={best}
        isRecord={record}
        detail={`En ${formatClock(secondes)}`}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
