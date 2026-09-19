import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Carte as CarteVue, Row, Txt, GameOver } from '@/ui';
import { jeu52, melanger, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'president',
  name: 'Président',
  tagline: 'Débarrasse-toi de tes cartes le premier. Le dernier est le trou du cul.',
  category: 'cartes',
  emoji: '👑',
  difficulty: 2,
  players: '1',
  minutes: 12,
  score: 'low',
  scoreUnit: 'place',
  tags: ['plis', 'famille', 'stratégie'],
  rules: [
    'Quatre joueurs. On pose une carte, une paire, un brelan ou un carré de même valeur.',
    'Pour poser, il faut battre le coup précédent : même nombre de cartes, valeur strictement supérieure.',
    'Le 2 est la carte la plus forte. Si tu ne peux ou ne veux pas jouer, tu passes.',
    'Quand tout le monde passe, le pli est ramassé et celui qui a posé en dernier relance. Premier sorti : président.',
  ],
};

const NOMS = ['Toi', 'Alice', 'Bruno', 'Clara'];
const PLACES = ['Président', 'Vice-président', 'Vice-trou', 'Trou du cul'];

/** Le 2 domine tout, puis l'as, puis le roi… */
const force = (carte: Carte): number => (carte.rang === 2 ? 15 : carte.rang === 1 ? 14 : carte.rang);

interface Coup {
  cartes: Carte[];
  joueur: number;
}

interface Etat {
  mains: Carte[][];
  pli: Coup | null;
  tour: number;
  /** Joueurs ayant passé depuis le dernier coup posé. */
  passes: number[];
  classement: number[];
  journal: string;
}

function distribuer(): Etat {
  const paquet = melanger(jeu52()).map((c) => ({ ...c, visible: true }));
  const mains: Carte[][] = [[], [], [], []];
  paquet.forEach((carte, i) => mains[i % 4].push(carte));
  mains.forEach((main) => main.sort((a, b) => force(a) - force(b)));

  return { mains, pli: null, tour: 0, passes: [], classement: [], journal: 'À toi d’ouvrir' };
}

/** Groupes de cartes de même valeur jouables contre le pli courant. */
function coupsJouables(main: Carte[], pli: Coup | null): Carte[][] {
  const parRang = new Map<number, Carte[]>();
  for (const carte of main) {
    const groupe = parRang.get(carte.rang) ?? [];
    groupe.push(carte);
    parRang.set(carte.rang, groupe);
  }

  const sorties: Carte[][] = [];
  for (const groupe of parRang.values()) {
    const taille = pli ? pli.cartes.length : 0;
    if (!pli) {
      // Ouverture : n'importe quelle combinaison de 1 à 4 cartes identiques.
      for (let n = 1; n <= groupe.length; n++) sorties.push(groupe.slice(0, n));
    } else if (groupe.length >= taille && force(groupe[0]) > force(pli.cartes[0])) {
      sorties.push(groupe.slice(0, taille));
    }
  }
  return sorties;
}

export default function President({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [selection, setSelection] = useState<string[]>([]);
  const [record, setRecord] = useState(false);
  const comptee = useRef(false);

  const maPlace = etat.classement.indexOf(0);
  const fini = etat.classement.length >= 3;

  const reset = useCallback(() => {
    setEtat(distribuer());
    setSelection([]);
    setRecord(false);
    comptee.current = false;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    // Place finale : si le joueur n'est pas sorti, il est dernier.
    const place = maPlace >= 0 ? maPlace + 1 : 4;
    haptic(place <= 2 ? 'success' : 'error');
    setRecord(submitScore(place));
  }, [fini, maPlace, haptic, submitScore]);

  /** Fait avancer le tour au joueur suivant encore en jeu. */
  const joueurSuivant = (depuis: number, mains: Carte[][], classement: number[]): number => {
    let candidat = depuis;
    for (let i = 0; i < 4; i++) {
      candidat = (candidat + 1) % 4;
      if (mains[candidat].length > 0 && !classement.includes(candidat)) return candidat;
    }
    return depuis;
  };

  const appliquerCoup = useCallback((prev: Etat, joueur: number, cartes: Carte[] | null): Etat => {
    // Passer : on note le passage et on avance.
    if (cartes === null) {
      const passes = [...prev.passes, joueur];
      const encoreEnJeu = [0, 1, 2, 3].filter(
        (j) => prev.mains[j].length > 0 && !prev.classement.includes(j),
      );
      const tousPasses = encoreEnJeu.every((j) => passes.includes(j) || j === prev.pli?.joueur);

      if (tousPasses && prev.pli) {
        // Le pli est ramassé : celui qui a posé en dernier relance.
        const relance = prev.mains[prev.pli.joueur].length > 0 ? prev.pli.joueur : joueurSuivant(prev.pli.joueur, prev.mains, prev.classement);
        return {
          ...prev,
          pli: null,
          passes: [],
          tour: relance,
          journal: `${NOMS[prev.pli.joueur]} remporte le pli et relance`,
        };
      }

      return {
        ...prev,
        passes,
        tour: joueurSuivant(joueur, prev.mains, prev.classement),
        journal: `${NOMS[joueur]} passe`,
      };
    }

    const ids = new Set(cartes.map((carte) => carte.id));
    const mains = prev.mains.map((main, i) => (i === joueur ? main.filter((m) => !ids.has(m.id)) : main));
    const classement = mains[joueur].length === 0 ? [...prev.classement, joueur] : prev.classement;

    return {
      ...prev,
      mains,
      classement,
      pli: { cartes, joueur },
      passes: [],
      tour: joueurSuivant(joueur, mains, classement),
      journal:
        mains[joueur].length === 0
          ? `${NOMS[joueur]} a fini — ${PLACES[classement.length - 1]}`
          : `${NOMS[joueur]} pose ${cartes.length} × ${cartes[0].rang === 1 ? 'as' : cartes[0].rang}`,
    };
  }, []);

  const mesCoups = useMemo(() => coupsJouables(etat.mains[0], etat.pli), [etat.mains, etat.pli]);

  const cartesChoisies = useMemo(
    () => etat.mains[0].filter((carte) => selection.includes(carte.id)),
    [etat.mains, selection],
  );

  /** La sélection forme-t-elle un coup légal ? */
  const selectionValide = useMemo(() => {
    if (cartesChoisies.length === 0) return false;
    if (!cartesChoisies.every((carte) => carte.rang === cartesChoisies[0].rang)) return false;
    if (!etat.pli) return true;
    return (
      cartesChoisies.length === etat.pli.cartes.length &&
      force(cartesChoisies[0]) > force(etat.pli.cartes[0])
    );
  }, [cartesChoisies, etat.pli]);

  const poser = () => {
    if (etat.tour !== 0 || fini || !selectionValide) return;
    haptic('medium');
    setEtat((prev) => appliquerCoup(prev, 0, cartesChoisies));
    setSelection([]);
  };

  const passer = () => {
    if (etat.tour !== 0 || fini) return;
    haptic('light');
    setEtat((prev) => appliquerCoup(prev, 0, null));
    setSelection([]);
  };

  // Tours des trois adversaires.
  useEffect(() => {
    if (etat.tour === 0 || fini) return;

    const id = setTimeout(() => {
      setEtat((prev) => {
        const joueur = prev.tour;
        const options = coupsJouables(prev.mains[joueur], prev.pli);
        if (options.length === 0) return appliquerCoup(prev, joueur, null);

        // Il joue le plus petit coup valable, et garde ses 2 pour la fin.
        const trie = options
          .slice()
          .sort((a, b) => a.length - b.length || force(a[0]) - force(b[0]));
        const choix = trie.find((coup) => force(coup[0]) < 15) ?? trie[0];
        return appliquerCoup(prev, joueur, choix);
      });
    }, 700);

    return () => clearTimeout(id);
  }, [etat.tour, etat.pli, fini, appliquerCoup]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {etat.mains[0].length} cartes
      </Txt>
      <Txt variant="label" tone="faint">
        {etat.tour === 0 ? 'À toi' : NOMS[etat.tour]}
      </Txt>
      {maPlace >= 0 ? (
        <Txt variant="label" tone="success">
          {PLACES[maPlace]}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <Row gap={space.sm} style={{ justifyContent: 'center' }}>
        {[1, 2, 3].map((j) => {
          const sorti = etat.classement.indexOf(j);
          return (
            <View
              key={j}
              style={{
                alignItems: 'center',
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderRadius: radius.md,
                backgroundColor: etat.tour === j ? c.accentSoft : c.surfaceAlt,
                borderWidth: 1,
                borderColor: etat.tour === j ? c.accent : 'transparent',
              }}
            >
              <Txt variant="label">{NOMS[j]}</Txt>
              <Txt variant="caption" tone={sorti >= 0 ? 'success' : 'faint'}>
                {sorti >= 0 ? PLACES[sorti] : `${etat.mains[j].length} cartes`}
              </Txt>
            </View>
          );
        })}
      </Row>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <Txt variant="caption" tone="faint">
          LE PLI
        </Txt>
        <Row gap={5} style={{ minHeight: 84, justifyContent: 'center' }}>
          {etat.pli ? (
            etat.pli.cartes.map((carte, i) => (
              <CarteVue key={`${carte.id}-${i}`} carte={carte} largeur={54} />
            ))
          ) : (
            <Txt variant="label" tone="faint">
              Table libre
            </Txt>
          )}
        </Row>
        <Txt variant="label" tone="dim" center>
          {etat.journal}
        </Txt>
      </View>

      <View style={{ gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          TA MAIN · {mesCoups.length} coup{mesCoups.length > 1 ? 's' : ''} possible
          {mesCoups.length > 1 ? 's' : ''}
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={3} style={{ paddingVertical: 4 }}>
            {etat.mains[0].map((carte) => (
              <CarteVue
                key={carte.id}
                carte={carte}
                largeur={50}
                selectionnee={selection.includes(carte.id)}
                onPress={() =>
                  setSelection((s) =>
                    s.includes(carte.id) ? s.filter((id) => id !== carte.id) : [...s, carte.id],
                  )
                }
              />
            ))}
          </Row>
        </ScrollView>

        <Row gap={space.md}>
          <Button
            label={`Poser${cartesChoisies.length > 0 ? ` (${cartesChoisies.length})` : ''}`}
            accent="#E0525F"
            disabled={etat.tour !== 0 || fini || !selectionValide}
            onPress={poser}
            style={{ flex: 1 }}
          />
          <Button
            label="Passer"
            kind="secondary"
            disabled={etat.tour !== 0 || fini}
            onPress={passer}
            style={{ flex: 1 }}
          />
        </Row>
      </View>

      <GameOver
        visible={fini}
        outcome={maPlace === 0 ? 'win' : maPlace >= 0 && maPlace <= 1 ? 'win' : 'loss'}
        title={maPlace >= 0 ? PLACES[maPlace] : 'Trou du cul'}
        score={maPlace >= 0 ? maPlace + 1 : 4}
        scoreLabel="Place"
        best={best}
        isRecord={record}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
