import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'petits-chevaux',
  name: 'Petits chevaux',
  tagline: 'Un six pour sortir, le compte juste pour rentrer, et gare aux collisions.',
  category: 'plateau',
  emoji: '🐴',
  difficulty: 1,
  players: '2-4',
  minutes: 15,
  score: 'none',
  tags: ['dés', 'famille', 'parcours', 'classique'],
  rules: [
    'Il faut un six pour faire sortir un cheval de l’écurie. Un six donne aussi droit à un nouveau lancer.',
    'Les chevaux tournent autour du plateau, puis remontent leur colonne de couleur jusqu’à l’arrivée.',
    'Tomber sur un cheval adverse le renvoie à son écurie. On ne peut pas se poser sur son propre cheval.',
    'L’arrivée demande le compte exact. Le premier à rentrer tous ses chevaux gagne.',
  ],
};

const N = 15;
const TOUR_PISTE = 52;
const ARRIVEE = 56;
const ACCENT = '#5B8DEF';
const COULEURS = ['#5B8DEF', '#E0525F', '#34B37E', '#F0A030'];
const NOMS = ['Bleu', 'Rouge', 'Vert', 'Orange'];

/** Les 52 cases du circuit, dans le sens des aiguilles d'une montre. */
const PISTE: [number, number][] = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0],
];

const DEPARTS = [0, 13, 26, 39];

/** Colonne de couleur menant à l'arrivée. */
const MAISONS: [number, number][][] = [
  [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
  [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
];

/** Emplacements d'écurie, dans les quatre coins. */
const ECURIES: [number, number][][] = [
  [
    [1, 1],
    [1, 4],
    [4, 1],
    [4, 4],
  ],
  [
    [1, 10],
    [1, 13],
    [4, 10],
    [4, 13],
  ],
  [
    [10, 10],
    [10, 13],
    [13, 10],
    [13, 13],
  ],
  [
    [10, 1],
    [10, 4],
    [13, 1],
    [13, 4],
  ],
];

type Nombre = 2 | 3 | 4;
type Chevaux = 2 | 4;
type Adversaires = 'ordinateur' | 'humains';

/** −1 à l'écurie · 0 à 50 sur la piste · 51 à 55 dans la maison · 56 arrivé. */
type Etat = number[][];

const clef = (l: number, col: number) => l * N + col;

const INDEX_PISTE = new Map<number, number>(PISTE.map(([l, col], i) => [clef(l, col), i]));
const INDEX_MAISON = new Map<number, { joueur: number; rang: number }>();
MAISONS.forEach((maison, joueur) =>
  maison.forEach(([l, col], rang) => INDEX_MAISON.set(clef(l, col), { joueur, rang })),
);

function caseDe(joueur: number, progression: number, cheval: number): [number, number] {
  if (progression === -1) return ECURIES[joueur][cheval];
  if (progression === ARRIVEE) return [7, 7];
  if (progression >= 51) return MAISONS[joueur][progression - 51];
  return PISTE[(DEPARTS[joueur] + progression) % TOUR_PISTE];
}

/** Une de mes montures occupe-t-elle déjà cette progression ? */
function occupeeParMoi(etat: Etat, joueur: number, progression: number): boolean {
  if (progression === -1 || progression === ARRIVEE) return false;
  return etat[joueur].some((p) => p === progression);
}

function chevauxJouables(etat: Etat, joueur: number, de: number): number[] {
  const out: number[] = [];
  etat[joueur].forEach((progression, cheval) => {
    if (progression === ARRIVEE) return;
    if (progression === -1) {
      if (de === 6 && !occupeeParMoi(etat, joueur, 0)) out.push(cheval);
      return;
    }
    const cible = progression + de;
    if (cible > ARRIVEE) return; // le compte doit être exact
    if (occupeeParMoi(etat, joueur, cible)) return;
    out.push(cheval);
  });
  return out;
}

interface Deplacement {
  etat: Etat;
  capture: number | null;
}

function deplacer(etat: Etat, joueur: number, cheval: number, de: number): Deplacement {
  const suivant = etat.map((liste) => liste.slice());
  const progression = suivant[joueur][cheval];
  const cible = progression === -1 ? 0 : progression + de;
  suivant[joueur][cheval] = cible;

  // Sur la piste seulement, on renvoie l'occupant adverse à l'écurie.
  let capture: number | null = null;
  if (cible <= 50) {
    const absolue = (DEPARTS[joueur] + cible) % TOUR_PISTE;
    suivant.forEach((liste, autre) => {
      if (autre === joueur) return;
      liste.forEach((p, k) => {
        if (p < 0 || p > 50) return;
        if ((DEPARTS[autre] + p) % TOUR_PISTE === absolue) {
          suivant[autre][k] = -1;
          capture = autre;
        }
      });
    });
  }
  return { etat: suivant, capture };
}

/** Choix de l'ordinateur : rentrer, manger, sortir, puis avancer le plus avancé. */
function choisirCheval(etat: Etat, joueur: number, de: number, candidats: number[]): number {
  const rentrer = candidats.find((k) => etat[joueur][k] + de === ARRIVEE);
  if (rentrer !== undefined) return rentrer;

  const mangeur = candidats.find((k) => deplacer(etat, joueur, k, de).capture !== null);
  if (mangeur !== undefined) return mangeur;

  const sortir = candidats.find((k) => etat[joueur][k] === -1);
  if (sortir !== undefined) return sortir;

  return candidats.reduce((a, b) => (etat[joueur][a] >= etat[joueur][b] ? a : b));
}

export default function PetitsChevaux({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(24, 0.46);
  const cellule = Math.floor(largeur / N);

  const [nombre, setNombre] = useState<Nombre>(2);
  const [parJoueur, setParJoueur] = useState<Chevaux>(2);
  const [adversaires, setAdversaires] = useState<Adversaires>('ordinateur');

  const [etat, setEtat] = useState<Etat>(() => [Array(2).fill(-1), Array(2).fill(-1)]);
  const [tour, setTour] = useState(0);
  const [de, setDe] = useState(1);
  /** Lancer en attente : le joueur doit désigner un cheval. */
  const [aJouer, setAJouer] = useState<number[] | null>(null);
  const [message, setMessage] = useState('Lance le dé pour commencer');
  const [gagnant, setGagnant] = useState<number | null>(null);
  const comptee = useRef(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  const solo = adversaires === 'ordinateur';
  const fini = gagnant !== null;
  const monTour = !solo || tour === 0;

  const reset = useCallback(() => {
    setEtat(Array.from({ length: nombre }, () => Array(parJoueur).fill(-1)));
    setTour(0);
    setDe(1);
    setAJouer(null);
    setMessage('Lance le dé pour commencer');
    setGagnant(null);
    comptee.current = false;
  }, [nombre, parJoueur]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [nombre, parJoueur, adversaires, reset]);

  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    [],
  );

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    const humainGagne = !solo || gagnant === 0;
    haptic(humainGagne ? 'success' : 'error');
    if (solo) submitResult(gagnant === 0 ? 'win' : 'loss');
  }, [fini, gagnant, solo, haptic, submitResult]);

  const lancer = useCallback(() => {
    if (fini || aJouer !== null) return;
    const valeur = randBetween(1, 6);
    setDe(valeur);
    haptic('medium');

    const candidats = chevauxJouables(etat, tour, valeur);
    if (candidats.length === 0) {
      setMessage(`${NOMS[tour]} fait ${valeur} : aucun coup possible`);
      minuterie.current = setTimeout(() => setTour((t) => (t + 1) % nombre), 550);
      return;
    }
    setMessage(
      `${NOMS[tour]} fait ${valeur}${candidats.length === 1 ? '' : ' — choisis un cheval'}`,
    );
    setAJouer(candidats);
  }, [fini, aJouer, etat, tour, nombre, haptic]);

  const bouger = useCallback(
    (cheval: number) => {
      if (aJouer === null || !aJouer.includes(cheval)) return;

      const { etat: suivant, capture } = deplacer(etat, tour, cheval, de);
      setEtat(suivant);
      setAJouer(null);
      haptic(capture !== null ? 'heavy' : 'light');

      if (capture !== null) setMessage(`${NOMS[tour]} renvoie un cheval ${NOMS[capture]} à l’écurie !`);
      else if (suivant[tour][cheval] === ARRIVEE) setMessage(`Un cheval ${NOMS[tour]} est rentré !`);

      if (suivant[tour].every((p) => p === ARRIVEE)) {
        setGagnant(tour);
        return;
      }
      // Un six redonne la main.
      if (de !== 6) setTour((t) => (t + 1) % nombre);
      else setMessage((m) => `${m} — six, rejoue !`);
    },
    [aJouer, etat, tour, de, nombre, haptic],
  );

  // Choix automatique quand un seul cheval peut bouger.
  useEffect(() => {
    if (aJouer === null || aJouer.length !== 1) return;
    if (solo && tour !== 0) return;
    const id = setTimeout(() => bouger(aJouer[0]), 380);
    return () => clearTimeout(id);
  }, [aJouer, solo, tour, bouger]);

  // Tour de l'ordinateur.
  useEffect(() => {
    if (!solo || fini || tour === 0) return;
    if (aJouer === null) {
      const id = setTimeout(lancer, 620);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => bouger(choisirCheval(etat, tour, de, aJouer)), 450);
    return () => clearTimeout(id);
  }, [solo, fini, tour, aJouer, etat, de, lancer, bouger]);

  const pionsParCase = useMemo(() => {
    const carte = new Map<number, { joueur: number; cheval: number }[]>();
    etat.forEach((liste, joueur) =>
      liste.forEach((progression, cheval) => {
        const [l, col] = caseDe(joueur, progression, cheval);
        const k = clef(l, col);
        const groupe = carte.get(k) ?? [];
        groupe.push({ joueur, cheval });
        carte.set(k, groupe);
      }),
    );
    return carte;
  }, [etat]);

  const jouables = useMemo(() => new Set(monTour && aJouer ? aJouer : []), [monTour, aJouer]);

  const fondDeCase = (l: number, col: number): string | null => {
    const k = clef(l, col);
    if (l === 7 && col === 7) return '#D8A93C55';

    const maison = INDEX_MAISON.get(k);
    if (maison && maison.joueur < nombre) return `${COULEURS[maison.joueur]}44`;

    const piste = INDEX_PISTE.get(k);
    if (piste !== undefined) {
      const depart = DEPARTS.indexOf(piste);
      if (depart >= 0 && depart < nombre) return `${COULEURS[depart]}66`;
      return c.surface;
    }

    // Blocs d'écurie dans les quatre coins.
    const bloc = l < 6 ? (col < 6 ? 0 : col > 8 ? 1 : -1) : l > 8 ? (col > 8 ? 2 : col < 6 ? 3 : -1) : -1;
    if (bloc >= 0 && bloc < nombre) return `${COULEURS[bloc]}14`;
    return null;
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini ? `${NOMS[gagnant as number]} gagne` : `Au tour de ${NOMS[tour]}`}
      </Txt>
      <Txt variant="label" tone="faint">
        {etat.map((liste) => liste.filter((p) => p === ARRIVEE).length).join(' · ')} rentrés
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: space.sm, paddingTop: space.sm }}>
      <View style={{ width: Math.max(cellule * N, 280), gap: space.sm }}>
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <Segmented<Nombre>
              value={nombre}
              onChange={setNombre}
              options={[
                { value: 2, label: '2 j.' },
                { value: 3, label: '3 j.' },
                { value: 4, label: '4 j.' },
              ]}
              accent={ACCENT}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Segmented<Chevaux>
              value={parJoueur}
              onChange={setParJoueur}
              options={[
                { value: 2, label: '2 chevaux' },
                { value: 4, label: '4 chevaux' },
              ]}
              accent={ACCENT}
            />
          </View>
        </Row>
        <Segmented<Adversaires>
          value={adversaires}
          onChange={setAdversaires}
          options={[
            { value: 'ordinateur', label: 'Contre l’ordinateur' },
            { value: 'humains', label: 'Entre nous' },
          ]}
          accent={ACCENT}
        />
      </View>

      <View
        style={{
          width: cellule * N,
          height: cellule * N,
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: c.borderStrong,
          backgroundColor: c.surfaceAlt,
        }}
      >
        {Array.from({ length: N * N }, (_, k) => {
          const l = Math.floor(k / N);
          const col = k % N;
          const fond = fondDeCase(l, col);
          if (fond === null) return null;
          return (
            <View
              key={`f${k}`}
              style={{
                position: 'absolute',
                left: col * cellule,
                top: l * cellule,
                width: cellule,
                height: cellule,
                backgroundColor: fond,
                borderWidth: 0.5,
                borderColor: c.border,
              }}
            />
          );
        })}

        {[...pionsParCase.entries()].map(([k, groupe]) => {
          const l = Math.floor(k / N);
          const col = k % N;
          return groupe.map(({ joueur, cheval }, rang) => {
            const bougeable = joueur === tour && jouables.has(cheval);
            const decalage = groupe.length > 1 ? (rang - (groupe.length - 1) / 2) * cellule * 0.28 : 0;
            return (
              <Pressable
                key={`p${joueur}-${cheval}`}
                accessibilityRole="button"
                accessibilityLabel={`Cheval ${NOMS[joueur]} numéro ${cheval + 1}`}
                disabled={!bougeable}
                onPress={() => bouger(cheval)}
                style={{
                  position: 'absolute',
                  left: col * cellule + cellule * 0.12 + decalage,
                  top: l * cellule + cellule * 0.12,
                  width: cellule * 0.76,
                  height: cellule * 0.76,
                  borderRadius: cellule,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COULEURS[joueur],
                  borderWidth: bougeable ? 2.5 : 1,
                  borderColor: bougeable ? '#FFFFFF' : '#00000055',
                }}
              >
                <Txt style={{ fontSize: cellule * 0.4, color: '#FFFFFF', fontWeight: '800' }}>
                  {cheval + 1}
                </Txt>
              </Pressable>
            );
          });
        })}
      </View>

      <Row gap={space.lg}>
        <De valeur={de} taille={48} tint={COULEURS[tour]} />
        <Button
          label={monTour ? (aJouer ? 'Choisis un cheval' : 'Lancer le dé') : 'Au tour de l’ordinateur'}
          disabled={fini || !monTour || aJouer !== null}
          accent={COULEURS[tour]}
          onPress={lancer}
        />
      </Row>

      <Txt variant="caption" tone="faint" center>
        {message}
      </Txt>

      <GameOver
        visible={fini}
        outcome={!solo || gagnant === 0 ? 'win' : 'loss'}
        title={`${NOMS[gagnant ?? 0]} rentre tous ses chevaux`}
        accent={COULEURS[gagnant ?? 0]}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
