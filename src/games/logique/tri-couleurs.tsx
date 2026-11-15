import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'tri-couleurs',
  name: 'Tri de couleurs',
  tagline: 'Verse d’un tube à l’autre jusqu’à ne plus avoir qu’une couleur par tube.',
  category: 'logique',
  emoji: '🧪',
  difficulty: 2,
  players: '1',
  minutes: 6,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['puzzle', 'solo', 'couleurs'],
  rules: [
    'Touche un tube pour le prendre, puis un autre pour y verser.',
    'On ne verse que sur une couleur identique, ou dans un tube vide — et jamais au-delà de quatre unités.',
    'Tout le bloc de couleur du dessus part d’un coup.',
    'Le but : chaque tube ne contient qu’une seule couleur, ou rien. Deux tubes vides servent de réserve.',
  ],
};

const CAPACITE = 4;
const TEINTES = ['#E0525F', '#F0A030', '#EFB93B', '#34B37E', '#4BC4D6', '#7C9CF0', '#8B7DFF', '#E36BB0'];

type Tube = number[]; // index 0 = fond du tube
type Niveau = 4 | 6 | 8;

/** Hauteur du bloc de couleur identique au sommet d'un tube. */
function hauteurDuBloc(tube: Tube): number {
  if (tube.length === 0) return 0;
  const couleur = tube[tube.length - 1];
  let n = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === couleur; i--) n += 1;
  return n;
}

function versementPossible(source: Tube, cible: Tube): boolean {
  if (source.length === 0) return false;
  if (cible.length >= CAPACITE) return false;
  if (cible.length === 0) return true;
  return cible[cible.length - 1] === source[source.length - 1];
}

function verser(tubes: Tube[], de: number, vers: number): Tube[] {
  const source = tubes[de];
  const cible = tubes[vers];
  const quantite = Math.min(hauteurDuBloc(source), CAPACITE - cible.length);
  const suivant = tubes.map((t) => t.slice());
  suivant[vers] = [...cible, ...source.slice(source.length - quantite)];
  suivant[de] = source.slice(0, source.length - quantite);
  return suivant;
}

const resolu = (tubes: Tube[]): boolean =>
  tubes.every((tube) => tube.length === 0 || (tube.length === CAPACITE && new Set(tube).size === 1));

/**
 * Vérifie qu'une distribution est résoluble, par exploration en profondeur
 * avec mémorisation. Le plafond de nœuds évite de bloquer l'interface : une
 * grille non tranchée est simplement rejetée et retirée.
 */
function estResoluble(depart: Tube[], plafond = 40000): boolean {
  const vus = new Set<string>();
  const cle = (tubes: Tube[]) =>
    tubes
      .map((t) => t.join(','))
      .sort()
      .join('|');

  let noeuds = 0;
  const explorer = (tubes: Tube[]): boolean => {
    if (resolu(tubes)) return true;
    if (++noeuds > plafond) return false;
    const signature = cle(tubes);
    if (vus.has(signature)) return false;
    vus.add(signature);

    for (let de = 0; de < tubes.length; de++) {
      for (let vers = 0; vers < tubes.length; vers++) {
        if (de === vers || !versementPossible(tubes[de], tubes[vers])) continue;
        // Déplacer un tube monochrome vers un tube vide ne fait jamais progresser.
        if (tubes[vers].length === 0 && hauteurDuBloc(tubes[de]) === tubes[de].length) continue;
        if (explorer(verser(tubes, de, vers))) return true;
      }
    }
    return false;
  };

  return explorer(depart.map((t) => t.slice()));
}

function distribuer(couleurs: Niveau): Tube[] {
  for (let essai = 0; essai < 60; essai++) {
    const unites: number[] = [];
    for (let couleur = 0; couleur < couleurs; couleur++) {
      for (let k = 0; k < CAPACITE; k++) unites.push(couleur);
    }
    const melangees = shuffle(unites);
    const tubes: Tube[] = [];
    for (let i = 0; i < couleurs; i++) {
      tubes.push(melangees.slice(i * CAPACITE, (i + 1) * CAPACITE));
    }
    // Deux tubes vides en réserve : sans eux, presque rien n'est jouable.
    tubes.push([], []);
    if (!resolu(tubes) && estResoluble(tubes)) return tubes;
  }
  // Repli : une distribution triviale, plutôt qu'une grille impossible.
  const secours: Tube[] = [];
  for (let couleur = 0; couleur < couleurs; couleur++) {
    secours.push(Array(CAPACITE).fill(couleur));
  }
  return [...secours, [], []];
}

export default function TriCouleurs({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(32, 0.42);

  const [niveau, setNiveau] = useState<Niveau>(6);
  const [tubes, setTubes] = useState<Tube[]>(() => distribuer(6));
  const [historique, setHistorique] = useState<Tube[][]>([]);
  const [selection, setSelection] = useState<number | null>(null);
  const [coups, setCoups] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const nombreTubes = niveau + 2;
  const parRangee = Math.ceil(nombreTubes / 2);
  const largeurTube = Math.min(46, Math.floor(largeur / parRangee) - 10);
  const hauteurUnite = largeurTube * 0.62;

  const gagne = useMemo(() => resolu(tubes), [tubes]);
  const bloque = useMemo(() => {
    if (gagne) return false;
    for (let de = 0; de < tubes.length; de++) {
      for (let vers = 0; vers < tubes.length; vers++) {
        if (de !== vers && versementPossible(tubes[de], tubes[vers])) return false;
      }
    }
    return true;
  }, [tubes, gagne]);

  const reset = useCallback(() => {
    setTubes(distribuer(niveau));
    setHistorique([]);
    setSelection(null);
    setCoups(0);
    setRecord(false);
    setComptee(false);
  }, [niveau]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, reset]);

  useEffect(() => {
    if (!gagne || comptee) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(coups));
  }, [gagne, comptee, coups, haptic, submitScore]);

  const toucher = (index: number) => {
    if (gagne) return;

    if (selection === null) {
      if (tubes[index].length === 0) return;
      haptic('light');
      setSelection(index);
      return;
    }

    if (selection === index) {
      setSelection(null);
      return;
    }

    if (!versementPossible(tubes[selection], tubes[index])) {
      haptic('warning');
      setSelection(null);
      return;
    }

    haptic('medium');
    setHistorique((h) => [...h, tubes.map((t) => t.slice())]);
    setTubes(verser(tubes, selection, index));
    setCoups((n) => n + 1);
    setSelection(null);
  };

  const annuler = () => {
    if (historique.length === 0) return;
    haptic('light');
    setTubes(historique[historique.length - 1]);
    setHistorique((h) => h.slice(0, -1));
    setCoups((n) => Math.max(0, n - 1));
    setSelection(null);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {coups} coups
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  const rangees = [tubes.slice(0, parRangee), tubes.slice(parRangee)];

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ width: Math.max(largeur, 260) }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 4, label: '4 couleurs' },
            { value: 6, label: '6 couleurs' },
            { value: 8, label: '8 couleurs' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View style={{ gap: space.xl }}>
        {rangees.map((rangee, r) => (
          <Row key={r} gap={space.md} style={{ justifyContent: 'center' }} align="flex-end">
            {rangee.map((tube, i) => {
              const index = r * parRangee + i;
              const choisi = selection === index;
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={`Tube ${index + 1}, ${tube.length} unités`}
                  onPress={() => toucher(index)}
                  style={{
                    width: largeurTube,
                    height: hauteurUnite * CAPACITE + 8,
                    justifyContent: 'flex-end',
                    padding: 3,
                    borderRadius: largeurTube / 3,
                    borderWidth: 2,
                    borderColor: choisi ? c.accent : c.borderStrong,
                    backgroundColor: c.surfaceAlt,
                    transform: [{ translateY: choisi ? -10 : 0 }],
                  }}
                >
                  {tube.map((couleur, position) => (
                    <View
                      key={position}
                      style={{
                        height: hauteurUnite - 2,
                        marginTop: 2,
                        borderRadius: 3,
                        backgroundColor: TEINTES[couleur],
                      }}
                    />
                  ))}
                </Pressable>
              );
            })}
          </Row>
        ))}
      </View>

      <Row gap={space.md}>
        <Button
          label="Annuler"
          kind="secondary"
          size="sm"
          disabled={historique.length === 0 || gagne}
          onPress={annuler}
        />
        <Button label="Nouvelle grille" kind="ghost" size="sm" onPress={reset} />
      </Row>

      <GameOver
        visible={gagne || bloque}
        outcome={gagne ? 'win' : 'over'}
        title={gagne ? 'Tout est trié !' : 'Plus aucun versement possible'}
        score={gagne ? coups : undefined}
        scoreLabel="Coups"
        best={best}
        isRecord={record}
        detail={bloque ? 'Annule quelques coups ou relance une grille.' : undefined}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
