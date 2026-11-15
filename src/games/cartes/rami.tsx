import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Carte as CarteVue, EmplacementVide, Row, Txt, GameOver } from '@/ui';
import { etiquette, jeu52, melanger, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'rami',
  name: 'Rami',
  tagline: 'Assemble brelans et suites, puis débarrasse-toi de tout.',
  category: 'cartes',
  emoji: '🀄',
  difficulty: 3,
  players: '1',
  minutes: 14,
  score: 'low',
  scoreUnit: 'points',
  tags: ['combinaisons', 'plis', 'classique'],
  rules: [
    'Pioche une carte, au talon ou à la défausse, puis jette-en une : ta main reste à dix cartes.',
    'Une combinaison, c’est trois cartes ou plus de même valeur, ou une suite de même couleur.',
    'Pose tes combinaisons quand tu veux ; il faut les avoir posées pour finir.',
    'Le premier qui n’a plus rien après sa défausse gagne. Les cartes qui restent en main comptent en points de pénalité.',
  ],
};

const TAILLE_MAIN = 10;

interface Etat {
  maMain: Carte[];
  saMain: Carte[];
  talon: Carte[];
  defausse: Carte[];
  mesPoses: Carte[][];
  sesPoses: Carte[][];
  tour: 'moi' | 'lui';
  /** Vrai une fois la pioche faite : il faut alors jeter une carte. */
  aPioche: boolean;
}

/** Pénalité d'une carte restée en main : figures 10, as 1, le reste sa valeur. */
const penalite = (carte: Carte): number => (carte.rang > 10 ? 10 : carte.rang);

/** Un brelan : au moins trois cartes de même valeur. */
function estBrelan(cartes: Carte[]): boolean {
  return cartes.length >= 3 && cartes.every((carte) => carte.rang === cartes[0].rang);
}

/** Une suite : au moins trois cartes de même couleur, rangs consécutifs. */
function estSuite(cartes: Carte[]): boolean {
  if (cartes.length < 3) return false;
  if (!cartes.every((carte) => carte.couleur === cartes[0].couleur)) return false;
  const rangs = cartes.map((carte) => carte.rang).sort((a, b) => a - b);
  return rangs.every((rang, i) => i === 0 || rang === rangs[i - 1] + 1);
}

const combinaisonValide = (cartes: Carte[]) => estBrelan(cartes) || estSuite(cartes);

/** Cherche les combinaisons d'une main : utile pour l'ordinateur. */
function combinaisonsDe(main: Carte[]): Carte[][] {
  const trouvees: Carte[][] = [];
  const restantes = main.slice();

  // Brelans d'abord, ils sont plus faciles à repérer.
  for (let rang = 1; rang <= 13; rang++) {
    const groupe = restantes.filter((carte) => carte.rang === rang);
    if (groupe.length >= 3) {
      trouvees.push(groupe);
      groupe.forEach((carte) => {
        const index = restantes.findIndex((r) => r.id === carte.id);
        if (index >= 0) restantes.splice(index, 1);
      });
    }
  }

  // Puis les suites, couleur par couleur.
  for (const couleur of ['P', 'C', 'K', 'T'] as const) {
    const parCouleur = restantes
      .filter((carte) => carte.couleur === couleur)
      .sort((a, b) => a.rang - b.rang);
    let courante: Carte[] = [];
    for (const carte of parCouleur) {
      if (courante.length === 0 || carte.rang === courante[courante.length - 1].rang + 1) {
        courante.push(carte);
      } else {
        if (courante.length >= 3) trouvees.push(courante);
        courante = [carte];
      }
    }
    if (courante.length >= 3) trouvees.push(courante);
  }

  return trouvees;
}

function distribuer(): Etat {
  const paquet = melanger(jeu52());
  return {
    maMain: paquet.slice(0, TAILLE_MAIN).map((c) => ({ ...c, visible: true })),
    saMain: paquet.slice(TAILLE_MAIN, TAILLE_MAIN * 2).map((c) => ({ ...c, visible: false })),
    defausse: [{ ...paquet[TAILLE_MAIN * 2], visible: true }],
    talon: paquet.slice(TAILLE_MAIN * 2 + 1).map((c) => ({ ...c, visible: false })),
    mesPoses: [],
    sesPoses: [],
    tour: 'moi',
    aPioche: false,
  };
}

export default function Rami({ submitScore, best, haptic }: GameScreenProps) {
  const { c, space } = useTheme();

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [selection, setSelection] = useState<string[]>([]);
  const [message, setMessage] = useState('Pioche au talon ou à la défausse');
  const [record, setRecord] = useState(false);
  const comptee = useRef(false);

  const maPenalite = useMemo(
    () => etat.maMain.reduce((total, carte) => total + penalite(carte), 0),
    [etat.maMain],
  );

  const gagne = etat.maMain.length === 0 && etat.mesPoses.length > 0;
  const perdu = etat.saMain.length === 0 && etat.sesPoses.length > 0;
  const fini = gagne || perdu;

  const reset = useCallback(() => {
    setEtat(distribuer());
    setSelection([]);
    setMessage('Pioche au talon ou à la défausse');
    setRecord(false);
    comptee.current = false;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    setRecord(submitScore(gagne ? 0 : maPenalite));
  }, [fini, gagne, maPenalite, haptic, submitScore]);

  const cartesChoisies = useMemo(
    () => etat.maMain.filter((carte) => selection.includes(carte.id)),
    [etat.maMain, selection],
  );

  const piocher = (source: 'talon' | 'defausse') => {
    if (etat.tour !== 'moi' || etat.aPioche || fini) return;
    if (source === 'talon' && etat.talon.length === 0) return;
    if (source === 'defausse' && etat.defausse.length === 0) return;

    haptic('light');
    setEtat((prev) => {
      if (source === 'talon') {
        const carte = { ...prev.talon[prev.talon.length - 1], visible: true };
        return { ...prev, talon: prev.talon.slice(0, -1), maMain: [...prev.maMain, carte], aPioche: true };
      }
      const carte = prev.defausse[prev.defausse.length - 1];
      return {
        ...prev,
        defausse: prev.defausse.slice(0, -1),
        maMain: [...prev.maMain, carte],
        aPioche: true,
      };
    });
    setMessage('Pose une combinaison si tu peux, puis jette une carte');
  };

  const poserCombinaison = () => {
    if (etat.tour !== 'moi' || fini) return;
    if (!combinaisonValide(cartesChoisies)) {
      setMessage('Il faut un brelan, ou une suite de même couleur, d’au moins trois cartes');
      haptic('warning');
      return;
    }
    haptic('success');
    setEtat((prev) => ({
      ...prev,
      maMain: prev.maMain.filter((carte) => !selection.includes(carte.id)),
      mesPoses: [...prev.mesPoses, cartesChoisies],
    }));
    setSelection([]);
    setMessage('Combinaison posée');
  };

  const jeter = () => {
    if (etat.tour !== 'moi' || !etat.aPioche || fini) return;
    if (cartesChoisies.length !== 1) {
      setMessage('Choisis exactement une carte à jeter');
      haptic('warning');
      return;
    }
    haptic('medium');
    const carte = cartesChoisies[0];
    setEtat((prev) => ({
      ...prev,
      maMain: prev.maMain.filter((m) => m.id !== carte.id),
      defausse: [...prev.defausse, carte],
      tour: 'lui',
      aPioche: false,
    }));
    setSelection([]);
    setMessage('Au tour de l’ordinateur');
  };

  // Tour de l'ordinateur : il pioche, pose ce qu'il peut, jette sa carte la plus chère.
  useEffect(() => {
    if (etat.tour !== 'lui' || fini) return;

    const id = setTimeout(() => {
      setEtat((prev) => {
        let main = prev.saMain.slice();
        let talon = prev.talon;
        let defausse = prev.defausse;

        // Il prend la défausse si elle complète une combinaison, sinon le talon.
        const candidate = defausse[defausse.length - 1];
        const avec = candidate ? combinaisonsDe([...main, candidate]).length : 0;
        const sans = combinaisonsDe(main).length;

        if (candidate && avec > sans) {
          main = [...main, candidate];
          defausse = defausse.slice(0, -1);
        } else if (talon.length > 0) {
          main = [...main, talon[talon.length - 1]];
          talon = talon.slice(0, -1);
        } else if (candidate) {
          main = [...main, candidate];
          defausse = defausse.slice(0, -1);
        }

        // Pose des combinaisons trouvées.
        const trouvees = combinaisonsDe(main);
        const posees = [...prev.sesPoses];
        for (const combinaison of trouvees) {
          posees.push(combinaison);
          for (const carte of combinaison) {
            const index = main.findIndex((m) => m.id === carte.id);
            if (index >= 0) main.splice(index, 1);
          }
        }

        if (main.length === 0) {
          return { ...prev, saMain: main, sesPoses: posees, talon, defausse, tour: 'moi', aPioche: false };
        }

        // Défausse la carte la plus coûteuse qui ne sert à rien.
        const jetee = main.reduce((a, b) => (penalite(b) > penalite(a) ? b : a));
        main = main.filter((m) => m.id !== jetee.id);

        return {
          ...prev,
          saMain: main,
          sesPoses: posees,
          talon,
          defausse: [...defausse, { ...jetee, visible: true }],
          tour: 'moi',
          aPioche: false,
        };
      });
      setMessage('À toi : pioche au talon ou à la défausse');
    }, 950);

    return () => clearTimeout(id);
  }, [etat.tour, fini]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {etat.maMain.length} cartes
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {etat.saMain.length}
      </Txt>
      <Txt variant="label" tone="warning">
        {maPenalite} pts
      </Txt>
    </Row>,
  );

  const dessusDefausse = etat.defausse[etat.defausse.length - 1];

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <View style={{ gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          POSES DE L’ORDINATEUR · {etat.sesPoses.length}
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={space.sm}>
            {etat.sesPoses.map((combinaison, i) => (
              <Row key={i} gap={-14}>
                {combinaison.map((carte) => (
                  <CarteVue key={carte.id} carte={{ ...carte, visible: true }} largeur={32} compacte />
                ))}
              </Row>
            ))}
          </Row>
        </ScrollView>
      </View>

      <Row gap={space.xl} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          {etat.talon.length > 0 ? (
            <CarteVue
              carte={{ ...etat.talon[0], visible: false }}
              largeur={58}
              onPress={() => piocher('talon')}
            />
          ) : (
            <EmplacementVide largeur={58} glyphe="∅" />
          )}
          <Txt variant="caption" tone="faint" style={{ fontSize: 10 }}>
            talon {etat.talon.length}
          </Txt>
        </View>

        <View style={{ alignItems: 'center', gap: 4 }}>
          {dessusDefausse ? (
            <CarteVue carte={dessusDefausse} largeur={58} onPress={() => piocher('defausse')} />
          ) : (
            <EmplacementVide largeur={58} />
          )}
          <Txt variant="caption" tone="faint" style={{ fontSize: 10 }}>
            défausse
          </Txt>
        </View>
      </Row>

      <Txt variant="label" tone="dim" center>
        {message}
      </Txt>

      <View style={{ gap: space.sm }}>
        {etat.mesPoses.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Row gap={space.sm}>
              {etat.mesPoses.map((combinaison, i) => (
                <Row key={i} gap={-14}>
                  {combinaison.map((carte) => (
                    <CarteVue key={carte.id} carte={carte} largeur={32} compacte />
                  ))}
                </Row>
              ))}
            </Row>
          </ScrollView>
        ) : null}

        <Txt variant="caption" tone="faint">
          TA MAIN
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={3} style={{ paddingVertical: 4 }}>
            {etat.maMain.map((carte) => (
              <CarteVue
                key={carte.id}
                carte={carte}
                largeur={46}
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

        <Row gap={space.sm}>
          <Button
            label="Poser"
            size="sm"
            accent="#E0525F"
            disabled={etat.tour !== 'moi' || fini || cartesChoisies.length < 3}
            onPress={poserCombinaison}
            style={{ flex: 1 }}
          />
          <Button
            label={cartesChoisies.length === 1 ? `Jeter ${etiquette(cartesChoisies[0].rang)}` : 'Jeter'}
            size="sm"
            kind="secondary"
            disabled={etat.tour !== 'moi' || !etat.aPioche || fini || cartesChoisies.length !== 1}
            onPress={jeter}
            style={{ flex: 1 }}
          />
        </Row>
      </View>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Rami !' : 'L’ordinateur a fini avant toi'}
        score={gagne ? 0 : maPenalite}
        scoreLabel="Points de pénalité"
        best={best}
        isRecord={record}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
