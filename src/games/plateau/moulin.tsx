import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'moulin',
  name: 'Moulin',
  tagline: 'Aligne trois pions, prends-en un à l’adversaire.',
  category: 'plateau',
  emoji: '⚙️',
  difficulty: 3,
  players: '1-2',
  minutes: 12,
  score: 'none',
  tags: ['stratégie', 'duo', 'classique'],
  rules: [
    'Chacun pose ses neuf pions un par un sur les intersections libres.',
    'Aligner trois pions sur une même ligne forme un moulin : retire aussitôt un pion adverse.',
    'Un pion pris dans un moulin adverse est protégé, sauf si tous les siens le sont.',
    'Les pions posés, on les fait glisser le long des lignes. À trois pions, on saute où l’on veut.',
    'On perd en tombant à deux pions, ou en n’ayant plus aucun déplacement.',
  ],
};

type Camp = 1 | 2;
type Point = 0 | Camp;
type Mode = 'facile' | 'normal' | 'expert' | 'duo';

/** Position des 24 intersections, en unités de 0 à 6. */
const COORD: [number, number][] = [
  [0, 0],
  [3, 0],
  [6, 0],
  [1, 1],
  [3, 1],
  [5, 1],
  [2, 2],
  [3, 2],
  [4, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [4, 3],
  [5, 3],
  [6, 3],
  [2, 4],
  [3, 4],
  [4, 4],
  [1, 5],
  [3, 5],
  [5, 5],
  [0, 6],
  [3, 6],
  [6, 6],
];

/** Segments à tracer : les trois carrés et les quatre traverses. */
const SEGMENTS: [number, number, number, number][] = [
  [0, 0, 6, 0],
  [0, 6, 6, 6],
  [0, 0, 0, 6],
  [6, 0, 6, 6],
  [1, 1, 5, 1],
  [1, 5, 5, 5],
  [1, 1, 1, 5],
  [5, 1, 5, 5],
  [2, 2, 4, 2],
  [2, 4, 4, 4],
  [2, 2, 2, 4],
  [4, 2, 4, 4],
  [3, 0, 3, 2],
  [3, 4, 3, 6],
  [0, 3, 2, 3],
  [4, 3, 6, 3],
];

const ADJACENCE: number[][] = [
  [1, 9],
  [0, 2, 4],
  [1, 14],
  [4, 10],
  [1, 3, 5, 7],
  [4, 13],
  [7, 11],
  [4, 6, 8],
  [7, 12],
  [0, 10, 21],
  [3, 9, 11, 18],
  [6, 10, 15],
  [8, 13, 17],
  [5, 12, 14, 20],
  [2, 13, 23],
  [11, 16],
  [15, 17, 19],
  [12, 16],
  [10, 19],
  [16, 18, 20, 22],
  [13, 19],
  [9, 22],
  [19, 21, 23],
  [14, 22],
];

const MOULINS: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
  [12, 13, 14],
  [15, 16, 17],
  [18, 19, 20],
  [21, 22, 23],
  [0, 9, 21],
  [3, 10, 18],
  [6, 11, 15],
  [1, 4, 7],
  [16, 19, 22],
  [8, 12, 17],
  [5, 13, 20],
  [2, 14, 23],
];

/** Moulins passant par chaque intersection, précalculés. */
const MOULINS_PAR_POINT: [number, number, number][][] = COORD.map((_, i) =>
  MOULINS.filter((m) => m.includes(i)),
);

const BLANC = '#F6F6F8';
const NOIR = '#16161C';
const ACCENT = '#5B8DEF';

interface Etat {
  points: Point[];
  /** Pions restant à poser, pour le joueur 1 puis le joueur 2. */
  enMain: [number, number];
  tour: Camp;
  /** Le joueur au trait vient de fermer un moulin et doit retirer un pion. */
  aRetirer: boolean;
  /** Coups joués sans prise : sert à déclarer la partie nulle. */
  sansPrise: number;
}

interface Coup {
  type: 'poser' | 'bouger' | 'retirer';
  depuis?: number;
  vers: number;
}

function etatInitial(): Etat {
  return { points: Array(24).fill(0) as Point[], enMain: [9, 9], tour: 1, aRetirer: false, sansPrise: 0 };
}

const autre = (camp: Camp): Camp => (camp === 1 ? 2 : 1);

function compte(points: Point[], camp: Camp): number {
  let n = 0;
  for (const p of points) if (p === camp) n += 1;
  return n;
}

function estMoulin(points: Point[], index: number, camp: Camp): boolean {
  return MOULINS_PAR_POINT[index].some((m) => m.every((i) => points[i] === camp));
}

function nbMoulins(points: Point[], camp: Camp): number {
  return MOULINS.filter((m) => m.every((i) => points[i] === camp)).length;
}

/** Alignements à deux pions dont la troisième intersection est libre. */
function menaces(points: Point[], camp: Camp): number {
  let total = 0;
  for (const m of MOULINS) {
    const miens = m.filter((i) => points[i] === camp).length;
    const libres = m.filter((i) => points[i] === 0).length;
    if (miens === 2 && libres === 1) total += 1;
  }
  return total;
}

function mobilite(points: Point[], camp: Camp): number {
  let total = 0;
  for (let i = 0; i < 24; i++) {
    if (points[i] !== camp) continue;
    total += ADJACENCE[i].filter((v) => points[v] === 0).length;
  }
  return total;
}

function coups(e: Etat): Coup[] {
  const camp = e.tour;

  if (e.aRetirer) {
    const adverse = autre(camp);
    const cibles: number[] = [];
    for (let i = 0; i < 24; i++) if (e.points[i] === adverse) cibles.push(i);
    // Un pion en moulin est protégé, sauf s'ils le sont tous.
    const libres = cibles.filter((i) => !estMoulin(e.points, i, adverse));
    const choix = libres.length > 0 ? libres : cibles;
    return choix.map((i) => ({ type: 'retirer' as const, vers: i }));
  }

  if (e.enMain[camp - 1] > 0) {
    const out: Coup[] = [];
    for (let i = 0; i < 24; i++) if (e.points[i] === 0) out.push({ type: 'poser', vers: i });
    return out;
  }

  const miennes: number[] = [];
  for (let i = 0; i < 24; i++) if (e.points[i] === camp) miennes.push(i);
  const vol = miennes.length === 3;

  const out: Coup[] = [];
  for (const depuis of miennes) {
    const destinations = vol
      ? e.points.map((p, i) => (p === 0 ? i : -1)).filter((i) => i >= 0)
      : ADJACENCE[depuis].filter((i) => e.points[i] === 0);
    for (const vers of destinations) out.push({ type: 'bouger', depuis, vers });
  }
  return out;
}

function appliquer(e: Etat, coup: Coup): Etat {
  const points = e.points.slice();
  const enMain: [number, number] = [e.enMain[0], e.enMain[1]];
  const camp = e.tour;

  if (coup.type === 'retirer') {
    points[coup.vers] = 0;
    return { points, enMain, tour: autre(camp), aRetirer: false, sansPrise: 0 };
  }

  if (coup.type === 'poser') {
    points[coup.vers] = camp;
    enMain[camp - 1] -= 1;
  } else {
    points[coup.depuis as number] = 0;
    points[coup.vers] = camp;
  }

  const moulin = estMoulin(points, coup.vers, camp);
  const adverse = autre(camp);
  const prendPossible = moulin && points.some((p) => p === adverse);

  return {
    points,
    enMain,
    tour: prendPossible ? camp : adverse,
    aRetirer: prendPossible,
    sansPrise: coup.type === 'poser' ? 0 : e.sansPrise + 1,
  };
}

function perdant(e: Etat): Camp | null {
  const poseFinie = e.enMain[0] === 0 && e.enMain[1] === 0;
  if (poseFinie) {
    if (compte(e.points, 1) < 3) return 1;
    if (compte(e.points, 2) < 3) return 2;
  }
  if (!e.aRetirer && e.enMain[e.tour - 1] === 0 && coups(e).length === 0) return e.tour;
  return null;
}

function evaluer(e: Etat, camp: Camp): number {
  const adverse = autre(camp);
  const mes = compte(e.points, camp) + e.enMain[camp - 1];
  const ses = compte(e.points, adverse) + e.enMain[adverse - 1];

  let score = (mes - ses) * 100;
  score += (nbMoulins(e.points, camp) - nbMoulins(e.points, adverse)) * 26;
  score += (menaces(e.points, camp) - menaces(e.points, adverse)) * 14;
  score += (mobilite(e.points, camp) - mobilite(e.points, adverse)) * 4;
  return score;
}

function alphabeta(e: Etat, profondeur: number, alpha: number, beta: number, camp: Camp): number {
  const perdu = perdant(e);
  if (perdu !== null) return perdu === camp ? -100000 - profondeur : 100000 + profondeur;
  if (e.sansPrise >= 60) return 0;
  if (profondeur === 0) return evaluer(e, camp);

  const liste = coups(e);
  if (liste.length === 0) return evaluer(e, camp);

  const maximise = e.tour === camp;
  let meilleur = maximise ? -Infinity : Infinity;
  let a = alpha;
  let b = beta;

  for (const coup of liste) {
    const valeur = alphabeta(appliquer(e, coup), profondeur - 1, a, b, camp);
    if (maximise) {
      if (valeur > meilleur) meilleur = valeur;
      if (meilleur > a) a = meilleur;
    } else {
      if (valeur < meilleur) meilleur = valeur;
      if (meilleur < b) b = meilleur;
    }
    if (b <= a) break;
  }
  return meilleur;
}

function coupOrdinateur(e: Etat, mode: Mode): Coup | null {
  const liste = coups(e);
  if (liste.length === 0) return null;
  if (liste.length === 1) return liste[0];
  if (mode === 'facile' && Math.random() < 0.35) return pick(liste);

  const pose = e.enMain[e.tour - 1] > 0;
  const profondeur =
    mode === 'facile' ? 2 : mode === 'normal' ? (pose ? 3 : 4) : pose ? 4 : 5;

  let meilleur = liste[0];
  let meilleureValeur = -Infinity;
  for (const coup of liste) {
    const valeur = alphabeta(appliquer(e, coup), profondeur - 1, -Infinity, Infinity, e.tour);
    if (valeur > meilleureValeur) {
      meilleureValeur = valeur;
      meilleur = coup;
    }
  }
  return meilleur;
}

export default function Moulin({ submitResult, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const taille = useBoardSize(48, 0.5);
  const pion = Math.max(18, Math.floor(taille * 0.13));
  const unite = (taille - pion) / 6;
  const marge = pion / 2;

  const [mode, setMode] = useState<Mode>('normal');
  const [etat, setEtat] = useState<Etat>(etatInitial);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [comptee, setComptee] = useState(false);

  const perdu = useMemo(() => perdant(etat), [etat]);
  const nulle = etat.sansPrise >= 60;
  const fini = perdu !== null || nulle;
  const humainJoue = mode === 'duo' || etat.tour === 1;

  const reset = useCallback(() => {
    setEtat(etatInitial());
    setChoisi(null);
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    if (nulle) {
      haptic('warning');
      if (mode !== 'duo') submitResult('draw');
      return;
    }
    const humainGagne = perdu === 2;
    haptic(humainGagne || mode === 'duo' ? 'success' : 'error');
    if (mode !== 'duo') submitResult(humainGagne ? 'win' : 'loss');
  }, [fini, comptee, nulle, perdu, mode, haptic, submitResult]);

  useEffect(() => {
    if (mode === 'duo' || etat.tour !== 2 || fini) return;
    const id = setTimeout(() => {
      setEtat((courant) => {
        if (courant.tour !== 2 || perdant(courant) !== null) return courant;
        const coup = coupOrdinateur(courant, mode);
        return coup ? appliquer(courant, coup) : courant;
      });
    }, 280);
    return () => clearTimeout(id);
  }, [etat, mode, fini]);

  const legaux = useMemo(() => coups(etat), [etat]);

  const destinations = useMemo(() => {
    if (choisi === null) return new Set<number>();
    return new Set(legaux.filter((k) => k.type === 'bouger' && k.depuis === choisi).map((k) => k.vers));
  }, [choisi, legaux]);

  const retirables = useMemo(
    () => new Set(etat.aRetirer ? legaux.map((k) => k.vers) : []),
    [etat.aRetirer, legaux],
  );

  const toucher = (index: number) => {
    if (fini || !humainJoue) return;

    if (etat.aRetirer) {
      if (!retirables.has(index)) {
        haptic('warning');
        return;
      }
      haptic('heavy');
      setEtat((courant) => appliquer(courant, { type: 'retirer', vers: index }));
      setChoisi(null);
      return;
    }

    if (etat.enMain[etat.tour - 1] > 0) {
      if (etat.points[index] !== 0) return;
      haptic('light');
      setEtat((courant) => appliquer(courant, { type: 'poser', vers: index }));
      return;
    }

    if (choisi !== null && destinations.has(index)) {
      haptic('medium');
      setEtat((courant) => appliquer(courant, { type: 'bouger', depuis: choisi, vers: index }));
      setChoisi(null);
      return;
    }

    if (etat.points[index] === etat.tour) {
      const possible = legaux.some((k) => k.type === 'bouger' && k.depuis === index);
      if (!possible) {
        haptic('warning');
        return;
      }
      haptic('light');
      setChoisi(choisi === index ? null : index);
      return;
    }
    setChoisi(null);
  };

  /** Sujet et verbe accordés : « Tu poses », « L’ordinateur pose ». */
  const phrase = (camp: Camp, deuxieme: string, troisieme: string) =>
    mode !== 'duo' && camp === 1
      ? `Tu ${deuxieme}`
      : `${mode === 'duo' ? `Le joueur ${camp}` : 'L’ordinateur'} ${troisieme}`;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini
          ? nulle
            ? 'Match nul'
            : phrase(autre(perdu as Camp), 'gagnes', 'gagne')
          : etat.aRetirer
            ? phrase(etat.tour, 'retires un pion', 'retire un pion')
            : etat.enMain[etat.tour - 1] > 0
              ? phrase(etat.tour, 'poses un pion', 'pose un pion')
              : phrase(etat.tour, 'déplaces un pion', 'déplace un pion')}
      </Txt>
      <Txt variant="label" tone="faint">
        {compte(etat.points, 1) + etat.enMain[0]} – {compte(etat.points, 2) + etat.enMain[1]}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: Math.max(taille, 250) }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'expert', label: 'Expert' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent={ACCENT}
        />
      </View>

      <View
        style={{
          width: taille,
          height: taille,
          backgroundColor: c.boardLight,
          borderRadius: 10,
        }}
      >
        {SEGMENTS.map(([x1, y1, x2, y2], i) => (
          <View
            key={`s${i}`}
            style={{
              position: 'absolute',
              left: x1 * unite + marge - 1.5,
              top: y1 * unite + marge - 1.5,
              width: (x2 - x1) * unite + 3,
              height: (y2 - y1) * unite + 3,
              backgroundColor: '#00000055',
              borderRadius: 2,
            }}
          />
        ))}

        {COORD.map(([x, y], i) => {
          const contenu = etat.points[i];
          const cible = destinations.has(i);
          const prenable = etat.aRetirer && retirables.has(i);

          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Intersection ${i + 1}${
                contenu === 0 ? ', libre' : contenu === 1 ? ', pion clair' : ', pion foncé'
              }`}
              onPress={() => toucher(i)}
              style={{
                position: 'absolute',
                left: x * unite,
                top: y * unite,
                width: pion,
                height: pion,
                borderRadius: pion,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  contenu === 1 ? BLANC : contenu === 2 ? NOIR : cible ? `${ACCENT}88` : '#00000033',
                borderWidth: choisi === i ? 3 : prenable ? 3 : contenu !== 0 ? 1 : 0,
                borderColor: choisi === i ? ACCENT : prenable ? '#E0525F' : '#00000055',
              }}
            />
          );
        })}
      </View>

      <Row gap={space.lg}>
        <Row gap={6}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: BLANC, borderWidth: 1, borderColor: '#00000055' }} />
          <Txt variant="caption" tone="faint">
            {etat.enMain[0]} en main
          </Txt>
        </Row>
        <Row gap={6}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: NOIR }} />
          <Txt variant="caption" tone="faint">
            {etat.enMain[1]} en main
          </Txt>
        </Row>
      </Row>

      <Txt variant="caption" tone="faint" center>
        {fini
          ? 'Partie terminée'
          : !humainJoue
            ? 'L’ordinateur réfléchit…'
            : etat.aRetirer
              ? 'Retire un pion adverse'
              : etat.enMain[etat.tour - 1] > 0
                ? 'Pose un pion sur une intersection libre'
                : choisi === null
                  ? 'Choisis un pion à déplacer'
                  : 'Touche une intersection allumée'}
      </Txt>

      <GameOver
        visible={fini}
        outcome={nulle ? 'draw' : mode === 'duo' || perdu === 2 ? 'win' : 'loss'}
        title={
          nulle
            ? 'Soixante coups sans prise'
            : mode === 'duo'
              ? `Victoire du joueur ${autre(perdu as Camp)}`
              : perdu === 2
                ? 'L’adversaire est à bout'
                : 'L’ordinateur t’a réduit au silence'
        }
        accent={ACCENT}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
