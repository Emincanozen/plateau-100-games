import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'embouteillage',
  name: 'Embouteillage',
  tagline: 'Dégage la sortie pour la voiture rouge, une manœuvre à la fois.',
  category: 'logique',
  emoji: '🚗',
  difficulty: 3,
  players: '1',
  minutes: 10,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['puzzle', 'solo', 'glissement'],
  rules: [
    'Touche un véhicule pour le sélectionner, puis une case libre de son axe pour l’y amener.',
    'Chaque véhicule ne glisse que dans son sens : les horizontaux à gauche et à droite, les verticaux en haut et en bas.',
    'Rien ne tourne, rien ne se soulève, et deux véhicules ne se traversent jamais.',
    'Sors la voiture rouge par l’ouverture de droite. Six embouteillages de plus en plus serrés.',
  ],
};

const N = 6;
const LIGNE_SORTIE = 2;

interface Vehicule {
  id: number;
  /** Case du haut ou de gauche, selon l'orientation. */
  depart: number;
  longueur: number;
  horizontal: boolean;
  rouge?: boolean;
}

/** Chaque niveau : positions de départ. La voiture rouge porte l'id 0. */
const NIVEAUX: Vehicule[][] = [
  [
    { id: 0, depart: 12, longueur: 2, horizontal: true, rouge: true },
    { id: 1, depart: 0, longueur: 2, horizontal: false },
    { id: 2, depart: 1, longueur: 3, horizontal: false },
    { id: 3, depart: 14, longueur: 2, horizontal: false },
    { id: 4, depart: 27, longueur: 3, horizontal: true },
  ],
  [
    { id: 0, depart: 12, longueur: 2, horizontal: true, rouge: true },
    { id: 1, depart: 2, longueur: 2, horizontal: true },
    { id: 2, depart: 6, longueur: 3, horizontal: false },
    { id: 3, depart: 11, longueur: 3, horizontal: false },
    { id: 4, depart: 19, longueur: 2, horizontal: true },
    { id: 5, depart: 31, longueur: 2, horizontal: true },
  ],
  [
    { id: 0, depart: 13, longueur: 2, horizontal: true, rouge: true },
    { id: 1, depart: 0, longueur: 3, horizontal: false },
    { id: 2, depart: 4, longueur: 2, horizontal: false },
    { id: 3, depart: 5, longueur: 3, horizontal: false },
    { id: 4, depart: 21, longueur: 2, horizontal: true },
    { id: 5, depart: 24, longueur: 2, horizontal: true },
    { id: 6, depart: 33, longueur: 3, horizontal: true },
  ],
  [
    { id: 0, depart: 12, longueur: 2, horizontal: true, rouge: true },
    { id: 1, depart: 0, longueur: 2, horizontal: true },
    { id: 2, depart: 3, longueur: 3, horizontal: false },
    { id: 3, depart: 6, longueur: 2, horizontal: false },
    { id: 4, depart: 8, longueur: 2, horizontal: false },
    { id: 5, depart: 16, longueur: 2, horizontal: false },
    { id: 6, depart: 26, longueur: 2, horizontal: true },
    { id: 7, depart: 30, longueur: 3, horizontal: true },
  ],
  [
    { id: 0, depart: 14, longueur: 2, horizontal: true, rouge: true },
    { id: 1, depart: 0, longueur: 2, horizontal: false },
    { id: 2, depart: 1, longueur: 2, horizontal: true },
    { id: 3, depart: 4, longueur: 3, horizontal: false },
    { id: 4, depart: 8, longueur: 2, horizontal: false },
    { id: 5, depart: 13, longueur: 2, horizontal: false },
    { id: 6, depart: 24, longueur: 3, horizontal: true },
    { id: 7, depart: 28, longueur: 2, horizontal: false },
  ],
  [
    { id: 0, depart: 12, longueur: 2, horizontal: true, rouge: true },
    { id: 1, depart: 2, longueur: 3, horizontal: false },
    { id: 2, depart: 3, longueur: 2, horizontal: false },
    { id: 3, depart: 5, longueur: 3, horizontal: false },
    { id: 4, depart: 6, longueur: 2, horizontal: true },
    { id: 5, depart: 15, longueur: 2, horizontal: true },
    { id: 6, depart: 20, longueur: 2, horizontal: false },
    { id: 7, depart: 26, longueur: 2, horizontal: true },
    { id: 8, depart: 31, longueur: 2, horizontal: true },
  ],
];

const TEINTES = ['#E0525F', '#5B8DEF', '#34B37E', '#EFB93B', '#8B7DFF', '#4BC4D6', '#EE7A4C', '#98B04B', '#E36BB0'];

/** Cases occupées par un véhicule. */
function casesDe(v: Vehicule): number[] {
  const pas = v.horizontal ? 1 : N;
  return Array.from({ length: v.longueur }, (_, k) => v.depart + k * pas);
}

function occupation(vehicules: Vehicule[]): (number | null)[] {
  const grille: (number | null)[] = Array(N * N).fill(null);
  for (const v of vehicules) {
    for (const index of casesDe(v)) grille[index] = v.id;
  }
  return grille;
}

export default function Embouteillage({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.46);
  const cellule = Math.floor(largeur / N);

  const [niveau, setNiveau] = useState(0);
  const [vehicules, setVehicules] = useState<Vehicule[]>(() =>
    NIVEAUX[0].map((v) => ({ ...v })),
  );
  const [selection, setSelection] = useState<number | null>(null);
  const [coups, setCoups] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const grille = useMemo(() => occupation(vehicules), [vehicules]);
  const rouge = vehicules.find((v) => v.rouge)!;
  // Sortie : la voiture rouge touche le bord droit de sa ligne.
  const gagne = rouge.depart % N === N - rouge.longueur && Math.floor(rouge.depart / N) === LIGNE_SORTIE;
  const dernierNiveau = niveau === NIVEAUX.length - 1;
  const fini = gagne && dernierNiveau;

  const chargerNiveau = useCallback((index: number) => {
    setVehicules(NIVEAUX[index].map((v) => ({ ...v })));
    setSelection(null);
    setNiveau(index);
  }, []);

  const reset = useCallback(() => {
    chargerNiveau(0);
    setCoups(0);
    setRecord(false);
    setComptee(false);
  }, [chargerNiveau]);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(coups));
  }, [fini, comptee, coups, haptic, submitScore]);

  useEffect(() => {
    if (!gagne || dernierNiveau) return;
    haptic('success');
    const id = setTimeout(() => chargerNiveau(niveau + 1), 900);
    return () => clearTimeout(id);
  }, [gagne, dernierNiveau, niveau, chargerNiveau, haptic]);

  /** Positions de départ atteignables par le véhicule sélectionné. */
  const destinations = useMemo(() => {
    if (selection === null) return new Map<number, number>();
    const v = vehicules.find((x) => x.id === selection);
    if (!v) return new Map<number, number>();

    const pas = v.horizontal ? 1 : N;
    const atteignables = new Map<number, number>();
    const libre = (index: number) => grille[index] === null || grille[index] === v.id;

    // Vers l'avant, puis vers l'arrière, en s'arrêtant au premier obstacle.
    for (const sens of [1, -1]) {
      let decalage = sens;
      while (true) {
        const nouveauDepart = v.depart + decalage * pas;
        const ligneDepart = Math.floor(nouveauDepart / N);
        const fin = nouveauDepart + (v.longueur - 1) * pas;

        if (nouveauDepart < 0 || fin >= N * N) break;
        // Un véhicule horizontal ne doit pas changer de ligne.
        if (v.horizontal && ligneDepart !== Math.floor(fin / N)) break;
        if (v.horizontal && ligneDepart !== Math.floor(v.depart / N)) break;
        if (!v.horizontal && nouveauDepart % N !== v.depart % N) break;

        const casesVisees = Array.from({ length: v.longueur }, (_, k) => nouveauDepart + k * pas);
        if (!casesVisees.every(libre)) break;

        atteignables.set(nouveauDepart, decalage);
        decalage += sens;
      }
    }
    return atteignables;
  }, [selection, vehicules, grille]);

  const toucher = (index: number) => {
    if (gagne) return;
    const occupant = grille[index];

    if (selection !== null) {
      // On vise la case de tête correspondant au clic, en cherchant une
      // destination dont le véhicule couvrirait cette case.
      const v = vehicules.find((x) => x.id === selection)!;
      const pas = v.horizontal ? 1 : N;
      for (const [nouveauDepart] of destinations) {
        const casesVisees = Array.from({ length: v.longueur }, (_, k) => nouveauDepart + k * pas);
        if (!casesVisees.includes(index)) continue;
        haptic('medium');
        setVehicules((liste) =>
          liste.map((x) => (x.id === selection ? { ...x, depart: nouveauDepart } : x)),
        );
        setCoups((n) => n + 1);
        setSelection(null);
        return;
      }
      if (occupant !== null && occupant !== selection) {
        haptic('light');
        setSelection(occupant);
        return;
      }
      setSelection(null);
      return;
    }

    if (occupant === null) return;
    haptic('light');
    setSelection(occupant);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Niveau {niveau + 1}/{NIVEAUX.length}
      </Txt>
      <Txt variant="label" tone="faint">
        {coups} coups
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View
        style={{
          width: cellule * N,
          height: cellule * N,
          backgroundColor: c.surfaceAlt,
          borderRadius: radius.md,
          borderWidth: 3,
          borderColor: c.borderStrong,
          // L'ouverture de sortie, à droite de la ligne de la voiture rouge.
          borderRightColor: 'transparent',
        }}
      >
        {/* Cases de destination */}
        {[...destinations.keys()].map((depart) => {
          const v = vehicules.find((x) => x.id === selection)!;
          const pas = v.horizontal ? 1 : N;
          return Array.from({ length: v.longueur }, (_, k) => {
            const index = depart + k * pas;
            return (
              <View
                key={`d${depart}-${k}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (index % N) * cellule + cellule * 0.35,
                  top: Math.floor(index / N) * cellule + cellule * 0.35,
                  width: cellule * 0.3,
                  height: cellule * 0.3,
                  borderRadius: cellule,
                  backgroundColor: '#34B37E88',
                }}
              />
            );
          });
        })}

        {/* Zone tactile par case */}
        {Array.from({ length: N * N }, (_, index) => (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`Case ${index + 1}`}
            onPress={() => toucher(index)}
            style={{
              position: 'absolute',
              left: (index % N) * cellule,
              top: Math.floor(index / N) * cellule,
              width: cellule,
              height: cellule,
            }}
          />
        ))}

        {vehicules.map((v) => {
          const l = Math.floor(v.depart / N);
          const col = v.depart % N;
          const choisi = selection === v.id;
          return (
            <View
              key={v.id}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: col * cellule + 3,
                top: l * cellule + 3,
                width: (v.horizontal ? cellule * v.longueur : cellule) - 6,
                height: (v.horizontal ? cellule : cellule * v.longueur) - 6,
                borderRadius: 6,
                backgroundColor: v.rouge ? TEINTES[0] : TEINTES[(v.id % (TEINTES.length - 1)) + 1],
                borderWidth: choisi ? 3 : 0,
                borderColor: c.text,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {v.rouge ? <Txt style={{ fontSize: cellule * 0.5 }}>🚗</Txt> : null}
            </View>
          );
        })}

        {/* Repère de sortie */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: -14,
            top: LIGNE_SORTIE * cellule + cellule * 0.25,
            width: 12,
            height: cellule * 0.5,
            borderRadius: 3,
            backgroundColor: '#34B37E',
          }}
        />
      </View>

      <Txt variant="caption" tone="faint" center>
        {selection === null
          ? 'Touche un véhicule pour le sélectionner'
          : 'Touche un point vert pour l’y amener'}
      </Txt>

      <Row gap={space.md}>
        <Button label="Recommencer" kind="secondary" size="sm" onPress={() => chargerNiveau(niveau)} />
        {niveau > 0 ? (
          <Button label="Niveau précédent" kind="ghost" size="sm" onPress={() => chargerNiveau(niveau - 1)} />
        ) : null}
      </Row>

      <GameOver
        visible={fini}
        outcome="win"
        title="Six embouteillages dégagés !"
        score={coups}
        scoreLabel="Coups"
        best={best}
        isRecord={record}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
