import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, EmplacementVide, RATIO_CARTE, Row, Segmented, Txt, GameOver } from '@/ui';
import { creerCarte, melanger, type Carte, type Couleur, type Rang } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'araignee',
  name: 'Araignée',
  tagline: 'Assemble huit suites du roi à l’as pour les faire disparaître.',
  category: 'cartes',
  emoji: '🕷️',
  difficulty: 3,
  players: '1',
  minutes: 20,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['réussite', 'solo', 'longue'],
  rules: [
    'Empile en descendant, quelle que soit la couleur : un 6 se pose sur n’importe quel 7.',
    'Seule une suite de même couleur se déplace d’un bloc ; sinon tu ne bouges qu’une carte.',
    'Une suite complète du roi à l’as est retirée du jeu automatiquement.',
    'La pioche distribue une carte sur chaque colonne — mais seulement si aucune n’est vide.',
  ],
};

const COLONNES = 10;
type Difficulte = 1 | 2 | 4;

interface Etat {
  colonnes: Carte[][];
  pioche: Carte[][];
  suitesFinies: number;
}

/** Deux jeux de 52 cartes, réduits à 1, 2 ou 4 couleurs selon la difficulté. */
function construirePaquet(couleurs: Difficulte): Carte[] {
  const palette: Couleur[] =
    couleurs === 1 ? ['P'] : couleurs === 2 ? ['P', 'C'] : ['P', 'C', 'K', 'T'];
  const cartes: Carte[] = [];
  const repetitions = 8 / palette.length;

  for (const couleur of palette) {
    for (let n = 0; n < repetitions; n++) {
      for (let rang = 1; rang <= 13; rang++) {
        const carte = creerCarte(couleur, rang as Rang);
        cartes.push({ ...carte, id: `${carte.id}#${n}` });
      }
    }
  }
  return melanger(cartes);
}

function distribuer(couleurs: Difficulte): Etat {
  const paquet = construirePaquet(couleurs);
  const colonnes: Carte[][] = Array.from({ length: COLONNES }, () => []);
  let curseur = 0;

  // Quatre colonnes de six cartes, six colonnes de cinq : 54 cartes posées.
  for (let i = 0; i < COLONNES; i++) {
    const hauteur = i < 4 ? 6 : 5;
    for (let k = 0; k < hauteur; k++) {
      colonnes[i].push({ ...paquet[curseur++], visible: k === hauteur - 1 });
    }
  }

  // Le reste forme cinq donnes de dix cartes.
  const pioche: Carte[][] = [];
  while (curseur < paquet.length) {
    pioche.push(paquet.slice(curseur, curseur + COLONNES).map((c) => ({ ...c, visible: true })));
    curseur += COLONNES;
  }

  return { colonnes, pioche, suitesFinies: 0 };
}

const sommet = (pile: Carte[]): Carte | undefined => pile[pile.length - 1];

/** Une suite déplaçable : même couleur, rangs décroissants d'un en un. */
function suiteDeplacable(colonne: Carte[], depuis: number): boolean {
  for (let i = depuis; i < colonne.length; i++) {
    if (!colonne[i].visible) return false;
    if (i > depuis) {
      if (colonne[i].couleur !== colonne[i - 1].couleur) return false;
      if (colonne[i].rang !== colonne[i - 1].rang - 1) return false;
    }
  }
  return true;
}

const devoiler = (colonnes: Carte[][]): Carte[][] =>
  colonnes.map((colonne) => {
    const derniere = sommet(colonne);
    if (!derniere || derniere.visible) return colonne;
    return [...colonne.slice(0, -1), { ...derniere, visible: true }];
  });

/** Retire les suites roi→as complètes et compte celles qui partent. */
function retirerSuites(colonnes: Carte[][]): { colonnes: Carte[][]; retirees: number } {
  let retirees = 0;
  const suivant = colonnes.map((colonne) => {
    if (colonne.length < 13) return colonne;
    const debut = colonne.length - 13;
    const bloc = colonne.slice(debut);
    if (bloc[0].rang !== 13 || bloc[12].rang !== 1) return colonne;
    if (!suiteDeplacable(colonne, debut)) return colonne;
    retirees += 1;
    return colonne.slice(0, debut);
  });
  return { colonnes: retirees > 0 ? devoiler(suivant) : suivant, retirees };
}

export default function Araignee({ submitScore, best, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 16 - 9 * 2) / COLONNES), 36);
  const hauteurCarte = largeurCarte * RATIO_CARTE;
  const decalage = Math.max(13, largeurCarte * 0.42);

  const [difficulte, setDifficulte] = useState<Difficulte>(1);
  const [etat, setEtat] = useState<Etat>(() => distribuer(1));
  const [selection, setSelection] = useState<{ colonne: number; depuis: number } | null>(null);
  const [coups, setCoups] = useState(0);
  const [message, setMessage] = useState('');
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const gagne = etat.suitesFinies === 8;

  const reset = useCallback(() => {
    setEtat(distribuer(difficulte));
    setSelection(null);
    setCoups(0);
    setMessage('');
    setRecord(false);
    setComptee(false);
  }, [difficulte]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [difficulte, reset]);

  useEffect(() => {
    if (!gagne || comptee) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(coups));
  }, [gagne, comptee, coups, haptic, submitScore]);

  const deplacer = (cible: number) => {
    if (!selection) return;
    const paquet = etat.colonnes[selection.colonne].slice(selection.depuis);
    if (paquet.length === 0) return;

    const dessus = sommet(etat.colonnes[cible]);
    // Colonne vide : tout paquet est accepté. Sinon, rang immédiatement supérieur.
    if (dessus && dessus.rang !== paquet[0].rang + 1) {
      haptic('warning');
      setMessage('Il faut poser sur une carte d’un rang au-dessus');
      setSelection(null);
      return;
    }

    haptic('light');
    setMessage('');
    setEtat((prev) => {
      const colonnes = prev.colonnes.map((colonne, i) => {
        if (i === selection.colonne) return colonne.slice(0, selection.depuis);
        if (i === cible) return [...colonne, ...paquet];
        return colonne;
      });
      const nettoyees = retirerSuites(devoiler(colonnes));
      if (nettoyees.retirees > 0) haptic('success');
      return {
        ...prev,
        colonnes: nettoyees.colonnes,
        suitesFinies: prev.suitesFinies + nettoyees.retirees,
      };
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  const toucher = (colonne: number, position: number) => {
    const pile = etat.colonnes[colonne];

    if (selection) {
      if (selection.colonne === colonne && selection.depuis === position) {
        setSelection(null);
        return;
      }
      deplacer(colonne);
      return;
    }

    if (pile.length === 0) return;
    if (!pile[position]?.visible) return;
    if (!suiteDeplacable(pile, position)) {
      haptic('warning');
      setMessage('Seule une suite de même couleur se déplace entière');
      return;
    }
    haptic('light');
    setMessage('');
    setSelection({ colonne, depuis: position });
  };

  const piocher = () => {
    if (etat.pioche.length === 0 || gagne) return;
    if (etat.colonnes.some((colonne) => colonne.length === 0)) {
      haptic('warning');
      setMessage('Impossible de piocher : une colonne est vide');
      return;
    }
    haptic('medium');
    setMessage('');
    setSelection(null);
    setEtat((prev) => {
      const donne = prev.pioche[prev.pioche.length - 1];
      const colonnes = prev.colonnes.map((colonne, i) => [...colonne, donne[i]]);
      const nettoyees = retirerSuites(colonnes);
      return {
        colonnes: nettoyees.colonnes,
        pioche: prev.pioche.slice(0, -1),
        suitesFinies: prev.suitesFinies + nettoyees.retirees,
      };
    });
    setCoups((n) => n + 1);
  };

  const estSelectionnee = (colonne: number, position: number) =>
    selection?.colonne === colonne && position >= selection.depuis;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {etat.suitesFinies}/8 suites
      </Txt>
      <Txt variant="label" tone="faint">
        {coups} coups
      </Txt>
      <Txt variant="label" tone="faint">
        Pioche {etat.pioche.length}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, gap: space.sm, paddingTop: space.sm }}>
      <Segmented<Difficulte>
        value={difficulte}
        onChange={setDifficulte}
        options={[
          { value: 1, label: '1 couleur' },
          { value: 2, label: '2 couleurs' },
          { value: 4, label: '4 couleurs' },
        ]}
        accent="#E0525F"
      />

      {message ? (
        <Txt variant="caption" tone="danger" center>
          {message}
        </Txt>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        <Row gap={2} align="flex-start">
          {etat.colonnes.map((colonne, index) => (
            <View key={index} style={{ width: largeurCarte, minHeight: hauteurCarte }}>
              {colonne.length === 0 ? (
                <EmplacementVide largeur={largeurCarte} onPress={() => toucher(index, 0)} />
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
                      selectionnee={estSelectionnee(index, position)}
                      onPress={() => toucher(index, position)}
                    />
                  </View>
                ))
              )}
            </View>
          ))}
        </Row>
        <View style={{ height: space.xxl }} />
      </ScrollView>

      <Row between style={{ paddingHorizontal: space.sm }}>
        <Pressable onPress={piocher} accessibilityRole="button" accessibilityLabel="Piocher une donne">
          <Row gap={-largeurCarte * 0.7}>
            {etat.pioche.map((_, i) => (
              <CarteVue
                key={i}
                carte={{ ...etat.pioche[0][0], visible: false }}
                largeur={largeurCarte + 6}
              />
            ))}
            {etat.pioche.length === 0 ? (
              <EmplacementVide largeur={largeurCarte + 6} glyphe="∅" />
            ) : null}
          </Row>
        </Pressable>

        <Txt variant="caption" tone="faint">
          {etat.suitesFinies > 0 ? `${etat.suitesFinies} suite(s) rangée(s)` : 'Touche la pioche pour distribuer'}
        </Txt>
      </Row>

      <GameOver
        visible={gagne}
        outcome="win"
        title="Les huit suites sont rangées !"
        score={coups}
        scoreLabel="Coups"
        best={best}
        isRecord={record}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
