import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, EmplacementVide, RATIO_CARTE, Row, Txt, GameOver } from '@/ui';
import { COULEURS, etiquette, jeu52, melanger, type Carte, type Couleur, type Rang } from '../lib/cartes';
import { formatClock, useTimer } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'canfield',
  name: 'Canfield',
  tagline: 'Les fondations ne commencent pas à l’as, mais où le sort décide.',
  category: 'cartes',
  emoji: '🎩',
  difficulty: 3,
  players: '1',
  minutes: 14,
  score: 'high',
  scoreUnit: 'cartes rangées',
  tags: ['réussite', 'solo', 'casino'],
  rules: [
    'Une carte est retournée : son rang devient la base des quatre fondations.',
    'La réserve de treize cartes alimente les colonnes, une carte à la fois.',
    'Colonnes : on descend en alternant les couleurs, et la suite boucle — l’as suit le deux, le roi suit l’as.',
    'Une colonne vidée se recharge automatiquement depuis la réserve. Score : le nombre de cartes montées en fondation.',
  ],
};

const COLONNES = 4;
const TAILLE_RESERVE = 13;

interface Etat {
  colonnes: Carte[][];
  fondations: Record<Couleur, Carte[]>;
  reserve: Carte[];
  pioche: Carte[];
  defausse: Carte[];
  /** Rang de départ des fondations, tiré au sort. */
  base: Rang;
}

const suivantCirculaire = (rang: number): number => (rang === 13 ? 1 : rang + 1);
const precedentCirculaire = (rang: number): number => (rang === 1 ? 13 : rang - 1);

function distribuer(): Etat {
  const paquet = melanger(jeu52()).map((c) => ({ ...c, visible: true }));
  const premiere = paquet[0];
  const base = premiere.rang;

  const fondations: Record<Couleur, Carte[]> = { P: [], C: [], K: [], T: [] };
  fondations[premiere.couleur] = [premiere];

  const reserve = paquet.slice(1, 1 + TAILLE_RESERVE);
  const colonnes = Array.from({ length: COLONNES }, (_, i) => [paquet[1 + TAILLE_RESERVE + i]]);
  const pioche = paquet.slice(1 + TAILLE_RESERVE + COLONNES).map((c) => ({ ...c, visible: false }));

  return { colonnes, fondations, reserve, pioche, defausse: [], base };
}

const sommet = (pile: Carte[]): Carte | undefined => pile[pile.length - 1];

function peutPoserSurColonne(carte: Carte, colonne: Carte[]): boolean {
  const dessus = sommet(colonne);
  if (!dessus) return true; // une colonne vide accepte tout, puis se recharge
  return dessus.rouge !== carte.rouge && precedentCirculaire(dessus.rang) === carte.rang;
}

function peutPoserSurFondation(carte: Carte, fondation: Carte[], base: Rang): boolean {
  const dessus = sommet(fondation);
  if (!dessus) return carte.rang === base;
  return suivantCirculaire(dessus.rang) === carte.rang;
}

type Source =
  | { type: 'colonne'; index: number; depuis: number }
  | { type: 'reserve' }
  | { type: 'defausse' };

export default function Canfield({ submitScore, best, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 40) / 5), 54);
  const hauteurCarte = largeurCarte * RATIO_CARTE;
  const decalage = Math.max(16, largeurCarte * 0.32);

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [selection, setSelection] = useState<Source | null>(null);
  const [coups, setCoups] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const rangees = useMemo(
    () => COULEURS.reduce((total, couleur) => total + etat.fondations[couleur].length, 0),
    [etat.fondations],
  );
  const gagne = rangees === 52;
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
    setRecord(submitScore(rangees));
  }, [gagne, comptee, rangees, haptic, submitScore]);

  const cartesSource = (source: Source): Carte[] => {
    if (source.type === 'reserve') {
      const carte = sommet(etat.reserve);
      return carte ? [carte] : [];
    }
    if (source.type === 'defausse') {
      const carte = sommet(etat.defausse);
      return carte ? [carte] : [];
    }
    return etat.colonnes[source.index].slice(source.depuis);
  };

  const retirerSource = (prev: Etat, source: Source): Etat => {
    if (source.type === 'reserve') return { ...prev, reserve: prev.reserve.slice(0, -1) };
    if (source.type === 'defausse') return { ...prev, defausse: prev.defausse.slice(0, -1) };
    return {
      ...prev,
      colonnes: prev.colonnes.map((col, i) => (i === source.index ? col.slice(0, source.depuis) : col)),
    };
  };

  /** Une colonne vide se remplit aussitôt avec le dessus de la réserve. */
  const rechargerColonnes = (prev: Etat): Etat => {
    let reserve = prev.reserve;
    const colonnes = prev.colonnes.map((colonne) => {
      if (colonne.length > 0 || reserve.length === 0) return colonne;
      const carte = reserve[reserve.length - 1];
      reserve = reserve.slice(0, -1);
      return [carte];
    });
    return { ...prev, colonnes, reserve };
  };

  const versColonne = (cible: number) => {
    if (!selection) return;
    const paquet = cartesSource(selection);
    if (paquet.length === 0) return;
    if (!peutPoserSurColonne(paquet[0], etat.colonnes[cible])) {
      haptic('warning');
      setSelection(null);
      return;
    }
    haptic('light');
    setEtat((prev) => {
      const sans = retirerSource(prev, selection);
      const colonnes = sans.colonnes.map((col, i) => (i === cible ? [...col, ...paquet] : col));
      return rechargerColonnes({ ...sans, colonnes });
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  const versFondation = (couleur: Couleur) => {
    if (!selection) return;
    const paquet = cartesSource(selection);
    if (paquet.length !== 1 || paquet[0].couleur !== couleur) {
      haptic('warning');
      setSelection(null);
      return;
    }
    if (!peutPoserSurFondation(paquet[0], etat.fondations[couleur], etat.base)) {
      haptic('warning');
      setSelection(null);
      return;
    }
    haptic('success');
    setEtat((prev) => {
      const sans = retirerSource(prev, selection);
      return rechargerColonnes({
        ...sans,
        fondations: { ...sans.fondations, [couleur]: [...sans.fondations[couleur], paquet[0]] },
      });
    });
    setCoups((n) => n + 1);
    setSelection(null);
  };

  const monterSiPossible = (carte: Carte): boolean => {
    if (!peutPoserSurFondation(carte, etat.fondations[carte.couleur], etat.base)) return false;
    versFondation(carte.couleur);
    return true;
  };

  const toucherColonne = (index: number, position: number) => {
    const colonne = etat.colonnes[index];
    if (selection) {
      const meme =
        selection.type === 'colonne' && selection.index === index && selection.depuis === position;
      if (meme && position === colonne.length - 1) {
        if (!monterSiPossible(colonne[position])) setSelection(null);
        return;
      }
      versColonne(index);
      return;
    }
    if (colonne.length === 0) return;
    haptic('light');
    setSelection({ type: 'colonne', index, depuis: position });
  };

  const toucherPile = (type: 'reserve' | 'defausse') => {
    const carte = type === 'reserve' ? sommet(etat.reserve) : sommet(etat.defausse);
    if (!carte) return;
    if (selection?.type === type) {
      if (!monterSiPossible(carte)) setSelection(null);
      return;
    }
    if (selection) {
      setSelection(null);
      return;
    }
    haptic('light');
    setSelection({ type });
  };

  const piocher = () => {
    haptic('light');
    setSelection(null);
    setEtat((prev) => {
      if (prev.pioche.length === 0) {
        // Recyclage de la défausse : la pioche est illimitée au Canfield.
        return {
          ...prev,
          pioche: prev.defausse.slice().reverse().map((c) => ({ ...c, visible: false })),
          defausse: [],
        };
      }
      // On retourne trois cartes à la fois, comme à la banque.
      const tirees = prev.pioche.slice(-3).map((c) => ({ ...c, visible: true }));
      return {
        ...prev,
        pioche: prev.pioche.slice(0, Math.max(0, prev.pioche.length - 3)),
        defausse: [...prev.defausse, ...tirees],
      };
    });
    setCoups((n) => n + 1);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {rangees}/52
      </Txt>
      <Txt variant="label" tone="faint">
        base {etiquette(etat.base)}
      </Txt>
      <Txt variant="label" tone="faint">
        {formatClock(secondes)}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, gap: space.md, paddingTop: space.sm }}>
      <Row between style={{ paddingHorizontal: 2 }}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          {sommet(etat.reserve) ? (
            <CarteVue
              carte={sommet(etat.reserve)!}
              largeur={largeurCarte}
              selectionnee={selection?.type === 'reserve'}
              onPress={() => toucherPile('reserve')}
            />
          ) : (
            <EmplacementVide largeur={largeurCarte} />
          )}
          <Txt variant="caption" tone="faint" style={{ fontSize: 9 }}>
            réserve {etat.reserve.length}
          </Txt>
        </View>

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
                glyphe={etiquette(etat.base)}
                onPress={() => versFondation(couleur)}
              />
            );
          })}
        </Row>
      </Row>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Row gap={4} align="flex-start" style={{ justifyContent: 'center' }}>
          {etat.colonnes.map((colonne, index) => (
            <View key={index} style={{ width: largeurCarte, minHeight: hauteurCarte }}>
              {colonne.length === 0 ? (
                <EmplacementVide largeur={largeurCarte} onPress={() => toucherColonne(index, 0)} />
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
                      compacte={position < colonne.length - 1}
                      selectionnee={
                        selection?.type === 'colonne' &&
                        selection.index === index &&
                        position >= selection.depuis
                      }
                      onPress={() => toucherColonne(index, position)}
                    />
                  </View>
                ))
              )}
            </View>
          ))}
        </Row>
        <View style={{ height: space.xl }} />
      </ScrollView>

      <Row gap={space.lg} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Pressable onPress={piocher} accessibilityRole="button" accessibilityLabel="Piocher trois cartes">
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
            selectionnee={selection?.type === 'defausse'}
            onPress={() => toucherPile('defausse')}
          />
        ) : (
          <EmplacementVide largeur={largeurCarte} />
        )}
      </Row>

      <GameOver
        visible={gagne}
        outcome="win"
        title="Canfield réussi !"
        score={rangees}
        scoreLabel="Cartes rangées"
        best={best}
        isRecord={record}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
