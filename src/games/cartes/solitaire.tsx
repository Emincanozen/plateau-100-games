import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, EmplacementVide, RATIO_CARTE, Row, Txt, GameOver } from '@/ui';
import {
  COULEURS,
  SYMBOLE,
  jeu52,
  melanger,
  type Carte,
  type Couleur,
} from '../lib/cartes';
import { formatClock, useTimer } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'solitaire',
  name: 'Solitaire',
  tagline: 'La réussite Klondike : remonte les quatre familles de l’as au roi.',
  category: 'cartes',
  emoji: '🃏',
  difficulty: 2,
  players: '1',
  minutes: 15,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['réussite', 'classique', 'solo'],
  rules: [
    'Touche une carte pour la sélectionner, puis touche sa destination pour la déplacer.',
    'Dans les colonnes, on empile en descendant et en alternant les couleurs : un 7 rouge sur un 8 noir.',
    'Les quatre fondations se remplissent en montant, famille par famille, de l’as au roi.',
    'Seul un roi peut occuper une colonne vide. La pioche se retourne indéfiniment.',
  ],
};

type ZoneId =
  | { type: 'colonne'; index: number }
  | { type: 'fondation'; couleur: Couleur }
  | { type: 'defausse' };

interface Etat {
  colonnes: Carte[][];
  fondations: Record<Couleur, Carte[]>;
  pioche: Carte[];
  defausse: Carte[];
}

function distribuer(): Etat {
  const paquet = melanger(jeu52());
  const colonnes: Carte[][] = [];
  let curseur = 0;
  for (let i = 0; i < 7; i++) {
    const colonne = paquet.slice(curseur, curseur + i + 1).map((carte, j) => ({
      ...carte,
      visible: j === i, // seule la derniere est face visible
    }));
    curseur += i + 1;
    colonnes.push(colonne);
  }
  return {
    colonnes,
    fondations: { P: [], C: [], K: [], T: [] },
    pioche: paquet.slice(curseur).map((c) => ({ ...c, visible: false })),
    defausse: [],
  };
}

const sommet = (pile: Carte[]): Carte | undefined => pile[pile.length - 1];

/** Empilement en colonne : couleurs alternees, rang decroissant. */
function peutPoserSurColonne(carte: Carte, colonne: Carte[]): boolean {
  const dessus = sommet(colonne);
  if (!dessus) return carte.rang === 13; // colonne vide : roi uniquement
  return dessus.visible && dessus.rouge !== carte.rouge && dessus.rang === carte.rang + 1;
}

function peutPoserSurFondation(carte: Carte, fondation: Carte[]): boolean {
  const dessus = sommet(fondation);
  if (!dessus) return carte.rang === 1;
  return dessus.rang === carte.rang - 1;
}

/** Une sequence deplacable : cartes visibles et bien ordonnees depuis `depuis`. */
function sequenceValide(colonne: Carte[], depuis: number): boolean {
  for (let i = depuis; i < colonne.length; i++) {
    if (!colonne[i].visible) return false;
    if (i > depuis) {
      const precedente = colonne[i - 1];
      const courante = colonne[i];
      if (precedente.rouge === courante.rouge || precedente.rang !== courante.rang + 1) return false;
    }
  }
  return true;
}

export default function Solitaire({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 24 - 6 * 4) / 7), 58);
  const hauteurCarte = largeurCarte * RATIO_CARTE;
  const decalage = Math.max(16, largeurCarte * 0.34);

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [selection, setSelection] = useState<{ zone: ZoneId; depuis: number } | null>(null);
  const [coups, setCoups] = useState(0);
  const [record, setRecord] = useState(false);
  const [compte, setCompte] = useState(false);

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
    setCompte(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!gagne || compte) return;
    setCompte(true);
    haptic('success');
    setRecord(submitScore(coups));
  }, [gagne, compte, coups, haptic, submitScore]);

  /** Retourne la derniere carte d'une colonne si elle est face cachee. */
  const devoiler = (colonnes: Carte[][]): Carte[][] =>
    colonnes.map((colonne) => {
      const derniere = sommet(colonne);
      if (!derniere || derniere.visible) return colonne;
      return [...colonne.slice(0, -1), { ...derniere, visible: true }];
    });

  const piocher = () => {
    haptic('light');
    setSelection(null);
    setCoups((n) => n + 1);
    setEtat((prev) => {
      if (prev.pioche.length === 0) {
        // Pioche epuisee : on retourne la defausse.
        return {
          ...prev,
          pioche: prev.defausse.slice().reverse().map((carte) => ({ ...carte, visible: false })),
          defausse: [],
        };
      }
      const tiree = { ...prev.pioche[prev.pioche.length - 1], visible: true };
      return {
        ...prev,
        pioche: prev.pioche.slice(0, -1),
        defausse: [...prev.defausse, tiree],
      };
    });
  };

  /** Cartes actuellement selectionnees, ou tableau vide. */
  const cartesSelectionnees = (source: Etat): Carte[] => {
    if (!selection) return [];
    if (selection.zone.type === 'defausse') {
      const carte = sommet(source.defausse);
      return carte ? [carte] : [];
    }
    if (selection.zone.type === 'colonne') {
      return source.colonnes[selection.zone.index].slice(selection.depuis);
    }
    const fondation = source.fondations[selection.zone.couleur];
    const carte = sommet(fondation);
    return carte ? [carte] : [];
  };

  const retirerSource = (source: Etat): Etat => {
    if (!selection) return source;
    if (selection.zone.type === 'defausse') {
      return { ...source, defausse: source.defausse.slice(0, -1) };
    }
    if (selection.zone.type === 'colonne') {
      const index = selection.zone.index;
      const colonnes = source.colonnes.map((colonne, i) =>
        i === index ? colonne.slice(0, selection.depuis) : colonne,
      );
      return { ...source, colonnes: devoiler(colonnes) };
    }
    const couleur = selection.zone.couleur;
    return {
      ...source,
      fondations: { ...source.fondations, [couleur]: source.fondations[couleur].slice(0, -1) },
    };
  };

  const deposer = (cible: ZoneId) => {
    if (!selection) return;
    const paquet = cartesSelectionnees(etat);
    if (paquet.length === 0) {
      setSelection(null);
      return;
    }

    if (cible.type === 'colonne') {
      if (!peutPoserSurColonne(paquet[0], etat.colonnes[cible.index])) {
        haptic('warning');
        setSelection(null);
        return;
      }
      haptic('light');
      setEtat((prev) => {
        const sansSource = retirerSource(prev);
        const colonnes = sansSource.colonnes.map((colonne, i) =>
          i === cible.index ? [...colonne, ...paquet] : colonne,
        );
        return { ...sansSource, colonnes };
      });
    } else if (cible.type === 'fondation') {
      if (paquet.length !== 1 || paquet[0].couleur !== cible.couleur) {
        haptic('warning');
        setSelection(null);
        return;
      }
      if (!peutPoserSurFondation(paquet[0], etat.fondations[cible.couleur])) {
        haptic('warning');
        setSelection(null);
        return;
      }
      haptic('success');
      setEtat((prev) => {
        const sansSource = retirerSource(prev);
        return {
          ...sansSource,
          fondations: {
            ...sansSource.fondations,
            [cible.couleur]: [...sansSource.fondations[cible.couleur], paquet[0]],
          },
        };
      });
    } else {
      setSelection(null);
      return;
    }

    setCoups((n) => n + 1);
    setSelection(null);
  };

  /** Envoi direct vers la fondation quand on retouche une carte deja selectionnee. */
  const envoyerEnFondation = (carte: Carte): boolean => {
    if (!peutPoserSurFondation(carte, etat.fondations[carte.couleur])) return false;
    deposer({ type: 'fondation', couleur: carte.couleur });
    return true;
  };

  const toucherColonne = (index: number, position: number) => {
    const colonne = etat.colonnes[index];
    if (selection) {
      // Meme carte retouchee : tentative d'envoi en fondation.
      if (
        selection.zone.type === 'colonne' &&
        selection.zone.index === index &&
        selection.depuis === position &&
        position === colonne.length - 1
      ) {
        if (!envoyerEnFondation(colonne[position])) setSelection(null);
        return;
      }
      deposer({ type: 'colonne', index });
      return;
    }
    if (colonne.length === 0) return;
    if (!colonne[position]?.visible) return;
    if (!sequenceValide(colonne, position)) {
      haptic('warning');
      return;
    }
    haptic('light');
    setSelection({ zone: { type: 'colonne', index }, depuis: position });
  };

  const toucherDefausse = () => {
    const carte = sommet(etat.defausse);
    if (!carte) return;
    if (selection?.zone.type === 'defausse') {
      if (!envoyerEnFondation(carte)) setSelection(null);
      return;
    }
    if (selection) {
      setSelection(null);
      return;
    }
    haptic('light');
    setSelection({ zone: { type: 'defausse' }, depuis: 0 });
  };

  const estSelectionnee = (index: number, position: number) =>
    selection?.zone.type === 'colonne' &&
    selection.zone.index === index &&
    position >= selection.depuis;

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
      <Row between style={{ paddingHorizontal: 2 }}>
        <Row gap={6}>
          <Pressable onPress={piocher} accessibilityRole="button" accessibilityLabel="Piocher">
            {etat.pioche.length > 0 ? (
              <CarteVue carte={{ ...etat.pioche[0], visible: false }} largeur={largeurCarte} />
            ) : (
              <EmplacementVide largeur={largeurCarte} glyphe="↻" />
            )}
          </Pressable>

          {sommet(etat.defausse) ? (
            <CarteVue
              carte={sommet(etat.defausse)!}
              largeur={largeurCarte}
              onPress={toucherDefausse}
              selectionnee={selection?.zone.type === 'defausse'}
            />
          ) : (
            <EmplacementVide largeur={largeurCarte} />
          )}
        </Row>

        <Row gap={4}>
          {COULEURS.map((couleur) => {
            const pile = etat.fondations[couleur];
            const dessus = sommet(pile);
            return dessus ? (
              <CarteVue
                key={couleur}
                carte={dessus}
                largeur={largeurCarte}
                onPress={() => deposer({ type: 'fondation', couleur })}
              />
            ) : (
              <EmplacementVide
                key={couleur}
                largeur={largeurCarte}
                glyphe={SYMBOLE[couleur]}
                onPress={() => deposer({ type: 'fondation', couleur })}
              />
            );
          })}
        </Row>
      </Row>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Row gap={4} align="flex-start">
          {etat.colonnes.map((colonne, index) => (
            <View
              key={index}
              style={{
                width: largeurCarte,
                minHeight: hauteurCarte,
              }}
            >
              {colonne.length === 0 ? (
                <EmplacementVide
                  largeur={largeurCarte}
                  onPress={() => toucherColonne(index, 0)}
                />
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
                      onPress={() => toucherColonne(index, position)}
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
        title="Réussite terminée !"
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
