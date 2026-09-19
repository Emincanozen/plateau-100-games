import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, EmplacementVide, RATIO_CARTE, Row, Txt, GameOver } from '@/ui';
import { COULEURS, SYMBOLE, jeu52, melanger, type Carte, type Couleur } from '../lib/cartes';
import { formatClock, useTimer } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'freecell',
  name: 'FreeCell',
  tagline: 'Tout est visible : presque toutes les donnes sont gagnables.',
  category: 'cartes',
  emoji: '🗄️',
  difficulty: 3,
  players: '1',
  minutes: 15,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['réussite', 'solo', 'réflexion'],
  rules: [
    'Les cinquante-deux cartes sont visibles dès le départ : aucun hasard caché.',
    'Quatre cases libres en haut à gauche peuvent accueillir une carte chacune.',
    'Dans les colonnes, on empile en descendant et en alternant les couleurs.',
    'Déplacer un paquet exige assez de cases libres : une case libre ou une colonne vide double la longueur transportable.',
  ],
};

const COLONNES = 8;
const CASES_LIBRES = 4;

interface Etat {
  colonnes: Carte[][];
  libres: (Carte | null)[];
  fondations: Record<Couleur, Carte[]>;
}

function distribuer(): Etat {
  const paquet = melanger(jeu52()).map((carte) => ({ ...carte, visible: true }));
  const colonnes: Carte[][] = Array.from({ length: COLONNES }, () => []);
  paquet.forEach((carte, i) => colonnes[i % COLONNES].push(carte));
  return {
    colonnes,
    libres: Array(CASES_LIBRES).fill(null),
    fondations: { P: [], C: [], K: [], T: [] },
  };
}

const sommet = (pile: Carte[]): Carte | undefined => pile[pile.length - 1];

const suiteValide = (dessus: Carte, dessous: Carte) =>
  dessus.rouge !== dessous.rouge && dessus.rang === dessous.rang + 1;

function peutPoserSurColonne(carte: Carte, colonne: Carte[]): boolean {
  const dessus = sommet(colonne);
  if (!dessus) return true; // n'importe quelle carte va dans une colonne vide
  return suiteValide(dessus, carte);
}

function peutPoserSurFondation(carte: Carte, fondation: Carte[]): boolean {
  const dessus = sommet(fondation);
  if (!dessus) return carte.rang === 1;
  return dessus.rang === carte.rang - 1;
}

/** Une séquence déplaçable : cartes alternées et décroissantes. */
function sequenceDepuis(colonne: Carte[], depuis: number): boolean {
  for (let i = depuis + 1; i < colonne.length; i++) {
    if (!suiteValide(colonne[i - 1], colonne[i])) return false;
  }
  return true;
}

/**
 * Longueur maximale transportable :
 * (cases libres + 1) × 2^(colonnes vides), la cible ne comptant pas si elle est vide.
 */
function capaciteDeplacement(etat: Etat, cibleEstVide: boolean): number {
  const libres = etat.libres.filter((c) => c === null).length;
  const vides = etat.colonnes.filter((col) => col.length === 0).length - (cibleEstVide ? 1 : 0);
  return (libres + 1) * Math.pow(2, Math.max(0, vides));
}

type Source = { type: 'colonne'; index: number; depuis: number } | { type: 'libre'; index: number };

export default function FreeCell({ submitScore, best, haptic }: GameScreenProps) {
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 20 - 7 * 3) / COLONNES), 44);
  const hauteurCarte = largeurCarte * RATIO_CARTE;
  const decalage = Math.max(15, largeurCarte * 0.38);

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [selection, setSelection] = useState<Source | null>(null);
  const [coups, setCoups] = useState(0);
  const [message, setMessage] = useState('');
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
    setMessage('');
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

  const cartesSelectionnees = (source: Source): Carte[] => {
    if (source.type === 'libre') {
      const carte = etat.libres[source.index];
      return carte ? [carte] : [];
    }
    return etat.colonnes[source.index].slice(source.depuis);
  };

  const retirerSource = (prev: Etat, source: Source): Etat => {
    if (source.type === 'libre') {
      return { ...prev, libres: prev.libres.map((c, i) => (i === source.index ? null : c)) };
    }
    return {
      ...prev,
      colonnes: prev.colonnes.map((col, i) => (i === source.index ? col.slice(0, source.depuis) : col)),
    };
  };

  const versColonne = (cible: number) => {
    if (!selection) return;
    const paquet = cartesSelectionnees(selection);
    if (paquet.length === 0) return;

    if (!peutPoserSurColonne(paquet[0], etat.colonnes[cible])) {
      haptic('warning');
      setMessage('Il faut une carte d’un rang au-dessus, de couleur opposée');
      setSelection(null);
      return;
    }

    const capacite = capaciteDeplacement(etat, etat.colonnes[cible].length === 0);
    if (paquet.length > capacite) {
      haptic('warning');
      setMessage(`Pas assez de cases libres : ${capacite} carte${capacite > 1 ? 's' : ''} au maximum`);
      setSelection(null);
      return;
    }

    haptic('light');
    setMessage('');
    setEtat((prev) => {
      const sans = retirerSource(prev, selection);
      return {
        ...sans,
        colonnes: sans.colonnes.map((col, i) => (i === cible ? [...col, ...paquet] : col)),
      };
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  const versLibre = (cible: number) => {
    if (!selection) return;
    if (etat.libres[cible] !== null) {
      setSelection(null);
      return;
    }
    const paquet = cartesSelectionnees(selection);
    if (paquet.length !== 1) {
      haptic('warning');
      setMessage('Une case libre n’accepte qu’une seule carte');
      setSelection(null);
      return;
    }
    haptic('light');
    setMessage('');
    setEtat((prev) => {
      const sans = retirerSource(prev, selection);
      return { ...sans, libres: sans.libres.map((c, i) => (i === cible ? paquet[0] : c)) };
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  const versFondation = (couleur: Couleur) => {
    if (!selection) return;
    const paquet = cartesSelectionnees(selection);
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
    setMessage('');
    setEtat((prev) => {
      const sans = retirerSource(prev, selection);
      return {
        ...sans,
        fondations: { ...sans.fondations, [couleur]: [...sans.fondations[couleur], paquet[0]] },
      };
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  const toucherColonne = (index: number, position: number) => {
    const colonne = etat.colonnes[index];

    if (selection) {
      const memeCarte =
        selection.type === 'colonne' && selection.index === index && selection.depuis === position;
      if (memeCarte && position === colonne.length - 1) {
        const carte = colonne[position];
        if (peutPoserSurFondation(carte, etat.fondations[carte.couleur])) {
          versFondation(carte.couleur);
          return;
        }
        setSelection(null);
        return;
      }
      versColonne(index);
      return;
    }

    if (colonne.length === 0) return;
    if (!sequenceDepuis(colonne, position)) {
      haptic('warning');
      setMessage('Ce paquet n’est pas une suite alternée');
      return;
    }
    haptic('light');
    setMessage('');
    setSelection({ type: 'colonne', index, depuis: position });
  };

  const toucherLibre = (index: number) => {
    const carte = etat.libres[index];
    if (selection) {
      if (selection.type === 'libre' && selection.index === index && carte) {
        if (peutPoserSurFondation(carte, etat.fondations[carte.couleur])) versFondation(carte.couleur);
        else setSelection(null);
        return;
      }
      versLibre(index);
      return;
    }
    if (!carte) return;
    haptic('light');
    setSelection({ type: 'libre', index });
  };

  const estSelectionnee = (index: number, position: number) =>
    selection?.type === 'colonne' && selection.index === index && position >= selection.depuis;

  const capaciteActuelle = capaciteDeplacement(etat, false);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {coups} coups
      </Txt>
      <Txt variant="label" tone="faint">
        {formatClock(secondes)}
      </Txt>
      <Txt variant="label" tone="faint">
        max {capaciteActuelle}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, gap: space.sm, paddingTop: space.sm }}>
      <Row between style={{ paddingHorizontal: 2 }}>
        <Row gap={3}>
          {etat.libres.map((carte, i) =>
            carte ? (
              <CarteVue
                key={i}
                carte={carte}
                largeur={largeurCarte}
                selectionnee={selection?.type === 'libre' && selection.index === i}
                onPress={() => toucherLibre(i)}
              />
            ) : (
              <EmplacementVide key={i} largeur={largeurCarte} onPress={() => toucherLibre(i)} />
            ),
          )}
        </Row>

        <Row gap={3}>
          {COULEURS.map((couleur) => {
            const dessus = sommet(etat.fondations[couleur]);
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
      </Row>

      {message ? (
        <Txt variant="caption" tone="danger" center>
          {message}
        </Txt>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        <Row gap={3} align="flex-start">
          {etat.colonnes.map((colonne, index) => (
            <View key={index} style={{ width: largeurCarte, minHeight: hauteurCarte }}>
              {colonne.length === 0 ? (
                <EmplacementVide largeur={largeurCarte} onPress={() => toucherColonne(index, 0)} />
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
        title="FreeCell résolu !"
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
