import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick, randInt, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'bataille-navale',
  name: 'Bataille navale',
  tagline: 'Touche, coule, et trouve la flotte avant qu’elle trouve la tienne.',
  category: 'papier',
  emoji: '🚢',
  difficulty: 2,
  players: '1',
  minutes: 10,
  score: 'low',
  scoreUnit: 'tirs',
  tags: ['déduction', 'solo', 'classique'],
  rules: [
    'Cinq navires sont cachés dans la grille adverse, en ligne ou en colonne.',
    'Touche une case pour tirer : ● à l’eau, ✕ touché.',
    'Un navire entièrement touché est coulé et signalé.',
    'L’ordinateur tire sur ta flotte en parallèle. Coule les cinq navires avant lui.',
  ],
};

const N = 8;
const FLOTTE = [
  { nom: 'Porte-avions', taille: 5 },
  { nom: 'Croiseur', taille: 4 },
  { nom: 'Contre-torpilleur', taille: 3 },
  { nom: 'Sous-marin', taille: 3 },
  { nom: 'Torpilleur', taille: 2 },
];

interface Navire {
  nom: string;
  cases: number[];
}

type Tir = 'rien' | 'eau' | 'touche';

/** Place la flotte au hasard, sans chevauchement. */
function placerFlotte(): Navire[] {
  const occupees = new Set<number>();
  const navires: Navire[] = [];

  for (const modele of FLOTTE) {
    let pose = false;
    while (!pose) {
      const horizontal = Math.random() < 0.5;
      const ligne = randInt(horizontal ? N : N - modele.taille + 1);
      const colonne = randInt(horizontal ? N - modele.taille + 1 : N);
      const cases = Array.from({ length: modele.taille }, (_, k) =>
        horizontal ? ligne * N + colonne + k : (ligne + k) * N + colonne,
      );
      if (cases.some((i) => occupees.has(i))) continue;
      cases.forEach((i) => occupees.add(i));
      navires.push({ nom: modele.nom, cases });
      pose = true;
    }
  }
  return navires;
}

const coule = (navire: Navire, tirs: Tir[]) => navire.cases.every((i) => tirs[i] === 'touche');

const voisines = (index: number): number[] => {
  const ligne = Math.floor(index / N);
  const colonne = index % N;
  const out: number[] = [];
  if (ligne > 0) out.push(index - N);
  if (ligne < N - 1) out.push(index + N);
  if (colonne > 0) out.push(index - 1);
  if (colonne < N - 1) out.push(index + 1);
  return out;
};

export default function BatailleNavale({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.34);
  const cellule = Math.floor(largeur / N);

  const [flotteAdverse, setFlotteAdverse] = useState<Navire[]>(placerFlotte);
  const [maFlotte, setMaFlotte] = useState<Navire[]>(placerFlotte);
  const [mesTirs, setMesTirs] = useState<Tir[]>(() => Array(N * N).fill('rien'));
  const [sesTirs, setSesTirs] = useState<Tir[]>(() => Array(N * N).fill('rien'));
  const [message, setMessage] = useState('À toi de tirer');
  const [aMoi, setAMoi] = useState(true);
  const [record, setRecord] = useState(false);
  const comptee = useRef(false);
  /** Cases à explorer autour d'un coup au but, pour l'ordinateur. */
  const pistes = useRef<number[]>([]);

  const nombreTirs = useMemo(() => mesTirs.filter((t) => t !== 'rien').length, [mesTirs]);
  const mesCoules = useMemo(
    () => flotteAdverse.filter((n) => coule(n, mesTirs)).length,
    [flotteAdverse, mesTirs],
  );
  const sesCoules = useMemo(() => maFlotte.filter((n) => coule(n, sesTirs)).length, [maFlotte, sesTirs]);

  const gagne = mesCoules === FLOTTE.length;
  const perdu = sesCoules === FLOTTE.length;
  const fini = gagne || perdu;

  const reset = useCallback(() => {
    setFlotteAdverse(placerFlotte());
    setMaFlotte(placerFlotte());
    setMesTirs(Array(N * N).fill('rien'));
    setSesTirs(Array(N * N).fill('rien'));
    setMessage('À toi de tirer');
    setAMoi(true);
    setRecord(false);
    comptee.current = false;
    pistes.current = [];
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    if (gagne) setRecord(submitScore(nombreTirs));
  }, [fini, gagne, nombreTirs, haptic, submitScore]);

  const tirer = (index: number) => {
    if (fini || !aMoi || mesTirs[index] !== 'rien') return;

    const touche = flotteAdverse.some((n) => n.cases.includes(index));
    const suivant = mesTirs.slice();
    suivant[index] = touche ? 'touche' : 'eau';
    setMesTirs(suivant);
    haptic(touche ? 'success' : 'light');

    const navireCoule = flotteAdverse.find((n) => n.cases.includes(index) && coule(n, suivant));
    setMessage(navireCoule ? `${navireCoule.nom} coulé !` : touche ? 'Touché' : 'À l’eau');
    setAMoi(false);
  };

  // Riposte de l'ordinateur : il achève un navire entamé avant de tirer au hasard.
  useEffect(() => {
    if (aMoi || fini) return;

    const id = setTimeout(() => {
      const libres = sesTirs
        .map((t, i) => (t === 'rien' ? i : -1))
        .filter((i) => i >= 0);
      if (libres.length === 0) return;

      pistes.current = pistes.current.filter((i) => sesTirs[i] === 'rien');
      const cible = pistes.current.length > 0 ? pistes.current.shift()! : pick(shuffle(libres));

      const touche = maFlotte.some((n) => n.cases.includes(cible));
      const suivant = sesTirs.slice();
      suivant[cible] = touche ? 'touche' : 'eau';
      setSesTirs(suivant);

      if (touche) {
        pistes.current.push(...voisines(cible).filter((i) => suivant[i] === 'rien'));
        const navireCoule = maFlotte.find((n) => n.cases.includes(cible) && coule(n, suivant));
        setMessage(navireCoule ? `Ton ${navireCoule.nom.toLowerCase()} est coulé` : 'L’ordinateur touche');
        haptic('error');
      } else {
        setMessage('L’ordinateur tire à l’eau');
      }
      setAMoi(true);
    }, 620);

    return () => clearTimeout(id);
  }, [aMoi, fini, sesTirs, maFlotte, haptic]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Coulés {mesCoules}/{FLOTTE.length}
      </Txt>
      <Txt variant="label" tone="faint">
        {nombreTirs} tirs
      </Txt>
      <Txt variant="label" tone="danger">
        Perdus {sesCoules}
      </Txt>
    </Row>,
  );

  // Fonction et non composant : déclaré ici, un composant serait remonté à chaque
  // rendu, et les deux grilles perdraient leurs nœuds entre deux touchers.
  const rendreGrille = (
    tirs: Tir[],
    navires: Navire[],
    montrerNavires: boolean,
    onCase?: (i: number) => void,
  ) => (
    <View
      style={{
        width: cellule * N,
        height: cellule * N,
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderRadius: radius.sm,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: N * N }, (_, i) => {
        const tir = tirs[i];
        const navire = navires.find((n) => n.cases.includes(i));
        const estCoule = navire ? coule(navire, tirs) : false;
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Case ${String.fromCharCode(65 + (i % N))}${Math.floor(i / N) + 1}`}
            disabled={!onCase}
            onPress={() => onCase?.(i)}
            style={{
              width: cellule,
              height: cellule,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 0.5,
              borderColor: '#00000033',
              backgroundColor:
                tir === 'touche'
                  ? estCoule
                    ? '#8A2330'
                    : '#E0525F'
                  : montrerNavires && navire
                    ? c.borderStrong
                    : '#1C3D5A',
            }}
          >
            <Txt style={{ fontSize: cellule * 0.5, color: '#FFFFFFCC' }}>
              {tir === 'eau' ? '·' : tir === 'touche' ? '✕' : ''}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Txt variant="caption" tone="faint">
          FLOTTE ADVERSE — touche pour tirer
        </Txt>
        {rendreGrille(mesTirs, flotteAdverse, false, tirer)}
      </View>

      <Txt variant="label" tone="dim">
        {message}
      </Txt>

      <View style={{ alignItems: 'center', gap: 4 }}>
        {rendreGrille(sesTirs, maFlotte, true)}
        <Txt variant="caption" tone="faint">
          TA FLOTTE
        </Txt>
      </View>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Flotte adverse coulée !' : 'Ta flotte est détruite'}
        score={gagne ? nombreTirs : undefined}
        scoreLabel="Tirs"
        best={best}
        isRecord={record}
        accent="#4BC4D6"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
