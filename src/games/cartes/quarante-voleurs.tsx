import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, EmplacementVide, RATIO_CARTE, Row, Txt, GameOver } from '@/ui';
import { SYMBOLE, jeu52, melanger, type Carte, type Couleur } from '../lib/cartes';
import { formatClock, useTimer } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'quarante-voleurs',
  name: 'Les quarante voleurs',
  tagline: 'Deux jeux, huit fondations, une seule carte à la fois.',
  category: 'cartes',
  emoji: '🗝️',
  difficulty: 3,
  players: '1',
  minutes: 18,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['réussite', 'solo', 'patience'],
  rules: [
    'Dix colonnes de quatre cartes, tirées de deux jeux complets.',
    'Dans les colonnes, on empile en descendant et dans la même couleur : un 8 de cœur sur un 9 de cœur.',
    'On ne déplace qu’une carte à la fois, jamais un paquet.',
    'Huit fondations à remplir de l’as au roi. La pioche se retourne une carte à la fois, sans recyclage.',
  ],
};

const COLONNES = 10;
const HAUTEUR = 4;
/** Deux jeux : chaque couleur a deux fondations, indexées de 0 à 7. */
const FONDATIONS = 8;

interface Etat {
  colonnes: Carte[][];
  fondations: Carte[][];
  pioche: Carte[];
  defausse: Carte[];
}

function distribuer(): Etat {
  const deuxJeux = [
    ...jeu52().map((c) => ({ ...c, id: `${c.id}#0` })),
    ...jeu52().map((c) => ({ ...c, id: `${c.id}#1` })),
  ];
  const paquet = melanger(deuxJeux).map((c) => ({ ...c, visible: true }));

  const colonnes: Carte[][] = Array.from({ length: COLONNES }, (_, i) =>
    paquet.slice(i * HAUTEUR, (i + 1) * HAUTEUR),
  );

  return {
    colonnes,
    fondations: Array.from({ length: FONDATIONS }, () => []),
    pioche: paquet.slice(COLONNES * HAUTEUR).map((c) => ({ ...c, visible: false })),
    defausse: [],
  };
}

const sommet = (pile: Carte[]): Carte | undefined => pile[pile.length - 1];

/** Colonne : même couleur, rang immédiatement inférieur. */
function peutPoserSurColonne(carte: Carte, colonne: Carte[]): boolean {
  const dessus = sommet(colonne);
  if (!dessus) return true;
  return dessus.couleur === carte.couleur && dessus.rang === carte.rang + 1;
}

function peutPoserSurFondation(carte: Carte, fondation: Carte[]): boolean {
  const dessus = sommet(fondation);
  if (!dessus) return carte.rang === 1;
  return dessus.couleur === carte.couleur && dessus.rang === carte.rang - 1;
}

type Source = { type: 'colonne'; index: number } | { type: 'defausse' };

export default function QuaranteVoleurs({ submitScore, best, haptic }: GameScreenProps) {
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 16 - 9 * 2) / COLONNES), 34);
  const hauteurCarte = largeurCarte * RATIO_CARTE;
  const decalage = Math.max(13, largeurCarte * 0.44);

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [selection, setSelection] = useState<Source | null>(null);
  const [coups, setCoups] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const rangees = useMemo(
    () => etat.fondations.reduce((total, pile) => total + pile.length, 0),
    [etat.fondations],
  );
  const gagne = rangees === 104;
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

  const carteSource = (source: Source): Carte | undefined =>
    source.type === 'defausse' ? sommet(etat.defausse) : sommet(etat.colonnes[source.index]);

  const retirerSource = (prev: Etat, source: Source): Etat =>
    source.type === 'defausse'
      ? { ...prev, defausse: prev.defausse.slice(0, -1) }
      : {
          ...prev,
          colonnes: prev.colonnes.map((col, i) => (i === source.index ? col.slice(0, -1) : col)),
        };

  const versColonne = (cible: number) => {
    if (!selection) return;
    const carte = carteSource(selection);
    if (!carte) {
      setSelection(null);
      return;
    }
    if (!peutPoserSurColonne(carte, etat.colonnes[cible])) {
      haptic('warning');
      setSelection(null);
      return;
    }
    haptic('light');
    setEtat((prev) => {
      const sans = retirerSource(prev, selection);
      return {
        ...sans,
        colonnes: sans.colonnes.map((col, i) => (i === cible ? [...col, carte] : col)),
      };
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  const versFondation = (index: number) => {
    if (!selection) return;
    const carte = carteSource(selection);
    if (!carte || !peutPoserSurFondation(carte, etat.fondations[index])) {
      haptic('warning');
      setSelection(null);
      return;
    }
    haptic('success');
    setEtat((prev) => {
      const sans = retirerSource(prev, selection);
      return {
        ...sans,
        fondations: sans.fondations.map((pile, i) => (i === index ? [...pile, carte] : pile)),
      };
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  /** Cherche une fondation qui accepte la carte, pour le double contact. */
  const monterSiPossible = (carte: Carte): boolean => {
    const index = etat.fondations.findIndex((pile) => peutPoserSurFondation(carte, pile));
    if (index < 0) return false;
    versFondation(index);
    return true;
  };

  const toucherColonne = (index: number) => {
    if (selection) {
      if (selection.type === 'colonne' && selection.index === index) {
        const carte = sommet(etat.colonnes[index]);
        if (!carte || !monterSiPossible(carte)) setSelection(null);
        return;
      }
      versColonne(index);
      return;
    }
    if (etat.colonnes[index].length === 0) return;
    haptic('light');
    setSelection({ type: 'colonne', index });
  };

  const toucherDefausse = () => {
    const carte = sommet(etat.defausse);
    if (!carte) return;
    if (selection?.type === 'defausse') {
      if (!monterSiPossible(carte)) setSelection(null);
      return;
    }
    if (selection) {
      setSelection(null);
      return;
    }
    haptic('light');
    setSelection({ type: 'defausse' });
  };

  const piocher = () => {
    if (etat.pioche.length === 0) return;
    haptic('light');
    setSelection(null);
    setEtat((prev) => ({
      ...prev,
      pioche: prev.pioche.slice(0, -1),
      defausse: [...prev.defausse, { ...prev.pioche[prev.pioche.length - 1], visible: true }],
    }));
    setCoups((n) => n + 1);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {rangees}/104
      </Txt>
      <Txt variant="label" tone="faint">
        {coups} coups
      </Txt>
      <Txt variant="label" tone="faint">
        {formatClock(secondes)}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, gap: space.sm, paddingTop: space.sm }}>
      <Row gap={2} style={{ justifyContent: 'center' }}>
        {etat.fondations.map((pile, i) => {
          const dessus = sommet(pile);
          return dessus ? (
            <CarteVue key={i} carte={dessus} largeur={largeurCarte} compacte onPress={() => versFondation(i)} />
          ) : (
            <EmplacementVide key={i} largeur={largeurCarte} glyphe="A" onPress={() => versFondation(i)} />
          );
        })}
      </Row>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Row gap={2} align="flex-start">
          {etat.colonnes.map((colonne, index) => (
            <View key={index} style={{ width: largeurCarte, minHeight: hauteurCarte }}>
              {colonne.length === 0 ? (
                <EmplacementVide largeur={largeurCarte} onPress={() => toucherColonne(index)} />
              ) : (
                colonne.map((carte, position) => (
                  <View
                    key={`${carte.id}-${position}`}
                    style={{
                      marginTop: position === 0 ? 0 : -(hauteurCarte - decalage),
                      zIndex: position,
                    }}
                  >
                    <CarteVue
                      carte={carte}
                      largeur={largeurCarte}
                      compacte
                      selectionnee={
                        selection?.type === 'colonne' &&
                        selection.index === index &&
                        position === colonne.length - 1
                      }
                      onPress={() => toucherColonne(index)}
                    />
                  </View>
                ))
              )}
            </View>
          ))}
        </Row>
        <View style={{ height: space.xxl }} />
      </ScrollView>

      <Row gap={space.lg} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Pressable onPress={piocher} accessibilityRole="button" accessibilityLabel="Piocher">
          {etat.pioche.length > 0 ? (
            <CarteVue carte={{ ...etat.pioche[0], visible: false }} largeur={largeurCarte + 14} />
          ) : (
            <EmplacementVide largeur={largeurCarte + 14} glyphe="∅" />
          )}
        </Pressable>

        {sommet(etat.defausse) ? (
          <CarteVue
            carte={sommet(etat.defausse)!}
            largeur={largeurCarte + 14}
            selectionnee={selection?.type === 'defausse'}
            onPress={toucherDefausse}
          />
        ) : (
          <EmplacementVide largeur={largeurCarte + 14} />
        )}

        <Txt variant="caption" tone="faint">
          {etat.pioche.length} en pioche
        </Txt>
      </Row>

      <GameOver
        visible={gagne}
        outcome="win"
        title="Les quarante voleurs sont rangés !"
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
