import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'brandubh',
  name: 'Brandubh',
  tagline: 'Le vieux jeu celte : un roi cerné doit rejoindre un coin.',
  category: 'plateau',
  emoji: '👑',
  difficulty: 3,
  players: '1-2',
  minutes: 12,
  score: 'none',
  tags: ['stratégie', 'asymétrique', 'duo', 'tafl'],
  rules: [
    'Toutes les pièces se déplacent comme la tour aux échecs : en ligne droite, sans sauter personne.',
    'Le roi gagne en atteignant l’un des quatre coins. Les assaillants gagnent en le capturant.',
    'Une pièce prise en sandwich entre deux ennemies est capturée. Les coins et le trône vide comptent comme ennemis pour tout le monde.',
    'Le roi, lui, ne tombe que cerné de tous les côtés disponibles — trois assaillants suffisent contre un bord.',
    'Seul le roi peut occuper le trône central et les quatre coins.',
  ],
};

const N = 7;
const TRONE = 24;
const COINS = [0, 6, 42, 48];
const ACCENT = '#5B8DEF';
const CLAIR = '#F2E7D2';
const FONCE = '#2A2A33';

type Piece = 0 | 1 | 2 | 3; // 0 vide · 1 assaillant · 2 défenseur · 3 roi
type Camp = 1 | 2;
type Niveau = 'facile' | 'normal' | 'expert';
type Camps = 'attaque' | 'defense' | 'duo';

interface Etat {
  cases: Piece[];
  tour: Camp;
  coups: number;
}

interface Coup {
  depuis: number;
  vers: number;
}

const DIRS: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

function etatInitial(): Etat {
  const cases: Piece[] = Array(N * N).fill(0);
  for (const i of [3, 10, 21, 22, 26, 27, 38, 45]) cases[i] = 1;
  for (const i of [17, 23, 25, 31]) cases[i] = 2;
  cases[TRONE] = 3;
  return { cases, tour: 1, coups: 0 };
}

const campDe = (p: Piece): Camp | 0 => (p === 0 ? 0 : p === 1 ? 1 : 2);
const estRestreinte = (index: number) => index === TRONE || COINS.includes(index);

/** Case qui aide à capturer, quel que soit le camp : un coin ou le trône vide. */
function estHostile(cases: Piece[], index: number): boolean {
  if (COINS.includes(index)) return true;
  return index === TRONE && cases[TRONE] === 0;
}

function voisin(index: number, dl: number, dc: number, pas = 1): number | null {
  const l = Math.floor(index / N) + dl * pas;
  const col = (index % N) + dc * pas;
  if (l < 0 || l >= N || col < 0 || col >= N) return null;
  return l * N + col;
}

function coupsDe(cases: Piece[], camp: Camp): Coup[] {
  const out: Coup[] = [];
  for (let depuis = 0; depuis < cases.length; depuis++) {
    const piece = cases[depuis];
    if (campDe(piece) !== camp) continue;
    const roi = piece === 3;

    for (const [dl, dc] of DIRS) {
      for (let pas = 1; pas < N; pas++) {
        const vers = voisin(depuis, dl, dc, pas);
        if (vers === null || cases[vers] !== 0) break;
        // Les cases réservées ne se traversent pas : elles se survolent seulement.
        if (!estRestreinte(vers) || roi) out.push({ depuis, vers });
      }
    }
  }
  return out;
}

function appliquer(e: Etat, coup: Coup): Etat {
  const cases = e.cases.slice();
  const piece = cases[coup.depuis];
  cases[coup.vers] = piece;
  cases[coup.depuis] = 0;

  const moi = campDe(piece) as Camp;
  const adverse: Camp = moi === 1 ? 2 : 1;

  // Prise en tenaille : l'ennemi voisin est coincé contre un allié ou une case hostile.
  for (const [dl, dc] of DIRS) {
    const cible = voisin(coup.vers, dl, dc);
    if (cible === null) continue;
    const contenu = cases[cible];
    if (campDe(contenu) !== adverse || contenu === 3) continue;

    const derriere = voisin(coup.vers, dl, dc, 2);
    if (derriere === null) continue;
    if (campDe(cases[derriere]) === moi || estHostile(cases, derriere)) cases[cible] = 0;
  }

  return { cases, tour: adverse, coups: e.coups + 1 };
}

/** Le roi est-il cerné sur toutes ses cases voisines existantes ? */
function roiCerne(cases: Piece[]): boolean {
  const roi = cases.indexOf(3);
  if (roi < 0) return true;
  if (COINS.includes(roi)) return false;

  let voisinesExistantes = 0;
  for (const [dl, dc] of DIRS) {
    const index = voisin(roi, dl, dc);
    if (index === null) continue;
    voisinesExistantes += 1;
    const hostile = cases[index] === 1 || COINS.includes(index) || (index === TRONE && cases[TRONE] === 0);
    if (!hostile) return false;
  }
  return voisinesExistantes > 0;
}

function vainqueur(e: Etat): Camp | null {
  const roi = e.cases.indexOf(3);
  if (roi < 0) return 1;
  if (COINS.includes(roi)) return 2;
  if (roiCerne(e.cases)) return 1;
  if (coupsDe(e.cases, e.tour).length === 0) return e.tour === 1 ? 2 : 1;
  return null;
}

/** Coins que le roi peut rejoindre en un seul coup. */
function coinsOuverts(cases: Piece[]): number {
  const roi = cases.indexOf(3);
  if (roi < 0) return 0;
  let total = 0;
  for (const [dl, dc] of DIRS) {
    for (let pas = 1; pas < N; pas++) {
      const index = voisin(roi, dl, dc, pas);
      if (index === null || cases[index] !== 0) break;
      if (COINS.includes(index)) {
        total += 1;
        break;
      }
    }
  }
  return total;
}

/** Note de la position du point de vue des défenseurs. */
function noteDefense(e: Etat): number {
  const roi = e.cases.indexOf(3);
  if (roi < 0) return -100000;
  if (COINS.includes(roi)) return 100000;

  const ouverts = coinsOuverts(e.cases);
  if (ouverts >= 2) return 90000; // les assaillants ne peuvent bloquer qu'un coin

  let defenseurs = 0;
  let assaillants = 0;
  for (const p of e.cases) {
    if (p === 1) assaillants += 1;
    else if (p === 2) defenseurs += 1;
  }

  const l = Math.floor(roi / N);
  const col = roi % N;
  let distance = 99;
  for (const coin of COINS) {
    const d = Math.abs(l - Math.floor(coin / N)) + Math.abs(col - (coin % N));
    if (d < distance) distance = d;
  }

  let score = 130 * defenseurs - 100 * assaillants;
  score += (12 - distance) * 12;
  score += ouverts * 400;
  // Un roi encore sur son trône est à l'abri mais n'avance pas.
  if (roi === TRONE) score -= 20;
  return score;
}

let noeuds = 0;
const BUDGET = 120000;

function alphabeta(e: Etat, profondeur: number, alpha: number, beta: number, camp: Camp): number {
  noeuds += 1;
  const gagnant = vainqueur(e);
  if (gagnant !== null) return gagnant === camp ? 100000 + profondeur * 10 : -100000 - profondeur * 10;
  if (e.coups >= 120) return 0;
  if (profondeur === 0 || noeuds > BUDGET) {
    const note = noteDefense(e);
    return camp === 2 ? note : -note;
  }

  const liste = ordonner(e);
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
  return meilleur === Infinity || meilleur === -Infinity ? noteDefense(e) * (camp === 2 ? 1 : -1) : meilleur;
}

/** Les coups agressifs et les fuites du roi en premier : l'élagage y gagne. */
function ordonner(e: Etat): Coup[] {
  const liste = coupsDe(e.cases, e.tour);
  const adverse: Camp = e.tour === 1 ? 2 : 1;
  return liste
    .map((coup) => {
      let note = 0;
      for (const [dl, dc] of DIRS) {
        const cible = voisin(coup.vers, dl, dc);
        if (cible !== null && campDe(e.cases[cible]) === adverse) note += 2;
      }
      if (e.cases[coup.depuis] === 3) note += COINS.includes(coup.vers) ? 100 : 3;
      return { coup, note };
    })
    .sort((x, y) => y.note - x.note)
    .map((x) => x.coup);
}

function coupOrdinateur(e: Etat, niveau: Niveau): Coup | null {
  const liste = ordonner(e);
  if (liste.length === 0) return null;
  if (niveau === 'facile' && Math.random() < 0.35) return pick(liste);

  noeuds = 0;
  const profondeur = niveau === 'facile' ? 2 : niveau === 'normal' ? 3 : 4;

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

export default function Brandubh({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.46);
  const cellule = Math.floor(largeur / N);

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const [camps, setCamps] = useState<Camps>('defense');
  const [etat, setEtat] = useState<Etat>(etatInitial);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [comptee, setComptee] = useState(false);

  const monCamp: Camp | null = camps === 'attaque' ? 1 : camps === 'defense' ? 2 : null;
  const gagnant = useMemo(() => vainqueur(etat), [etat]);
  const nulle = etat.coups >= 120;
  const fini = gagnant !== null || nulle;
  const aMoi = monCamp === null || etat.tour === monCamp;

  const reset = useCallback(() => {
    setEtat(etatInitial());
    setChoisi(null);
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, camps, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    if (nulle) {
      haptic('warning');
      if (monCamp !== null) submitResult('draw');
      return;
    }
    const jeGagne = monCamp === null || gagnant === monCamp;
    haptic(jeGagne ? 'success' : 'error');
    if (monCamp !== null) submitResult(gagnant === monCamp ? 'win' : 'loss');
  }, [fini, comptee, nulle, gagnant, monCamp, haptic, submitResult]);

  useEffect(() => {
    if (monCamp === null || fini || etat.tour === monCamp) return;
    const id = setTimeout(() => {
      setEtat((courant) => {
        if (courant.tour === monCamp || vainqueur(courant) !== null) return courant;
        const coup = coupOrdinateur(courant, niveau);
        return coup ? appliquer(courant, coup) : courant;
      });
    }, 260);
    return () => clearTimeout(id);
  }, [etat, monCamp, niveau, fini]);

  const legaux = useMemo(() => coupsDe(etat.cases, etat.tour), [etat]);

  const destinations = useMemo(() => {
    if (choisi === null) return new Set<number>();
    return new Set(legaux.filter((k) => k.depuis === choisi).map((k) => k.vers));
  }, [choisi, legaux]);

  const toucher = (index: number) => {
    if (fini || !aMoi) return;

    if (choisi !== null && destinations.has(index)) {
      haptic('medium');
      setEtat((courant) => appliquer(courant, { depuis: choisi, vers: index }));
      setChoisi(null);
      return;
    }
    if (campDe(etat.cases[index]) === etat.tour) {
      haptic('light');
      setChoisi(choisi === index ? null : index);
      return;
    }
    setChoisi(null);
  };

  const compter = (cible: Piece) => etat.cases.filter((p) => p === cible).length;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini
          ? nulle
            ? 'Match nul'
            : gagnant === 2
              ? 'Le roi s’est échappé'
              : 'Le roi est tombé'
          : etat.tour === 1
            ? 'Aux assaillants'
            : 'Aux défenseurs'}
      </Txt>
      <Txt variant="label" tone="faint">
        {compter(1)} contre {compter(2) + 1}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: Math.max(cellule * N, 270), gap: space.sm }}>
        <Segmented<Camps>
          value={camps}
          onChange={setCamps}
          options={[
            { value: 'defense', label: 'Le roi' },
            { value: 'attaque', label: 'Les assaillants' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent={ACCENT}
        />
        {camps !== 'duo' ? (
          <Segmented<Niveau>
            value={niveau}
            onChange={setNiveau}
            options={[
              { value: 'facile', label: 'Facile' },
              { value: 'normal', label: 'Normal' },
              { value: 'expert', label: 'Expert' },
            ]}
            accent={ACCENT}
          />
        ) : null}
      </View>

      <View
        style={{
          width: cellule * N,
          height: cellule * N,
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: c.boardEdge,
        }}
      >
        {etat.cases.map((piece, i) => {
          const speciale = estRestreinte(i);
          const cible = destinations.has(i);

          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Case ${Math.floor(i / N) + 1}-${(i % N) + 1}${
                piece === 0 ? ', vide' : piece === 1 ? ', assaillant' : piece === 2 ? ', défenseur' : ', roi'
              }`}
              onPress={() => toucher(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: cible ? `${ACCENT}55` : speciale ? c.boardDark : c.boardLight,
                borderWidth: 0.5,
                borderColor: '#00000022',
              }}
            >
              {speciale && piece === 0 ? (
                <Txt style={{ fontSize: cellule * 0.34, opacity: 0.4 }}>
                  {i === TRONE ? '✦' : '◆'}
                </Txt>
              ) : null}
              {piece !== 0 ? (
                <View
                  style={{
                    width: cellule * 0.76,
                    height: cellule * 0.76,
                    borderRadius: cellule,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: piece === 1 ? FONCE : CLAIR,
                    borderWidth: choisi === i ? 3 : piece === 3 ? 2.5 : 1,
                    borderColor: choisi === i ? ACCENT : piece === 3 ? '#D8A93C' : '#00000055',
                  }}
                >
                  {piece === 3 ? <Txt style={{ fontSize: cellule * 0.4 }}>👑</Txt> : null}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Txt variant="caption" tone="faint" center>
        {fini
          ? 'Partie terminée'
          : !aMoi
            ? 'L’ordinateur réfléchit…'
            : choisi === null
              ? 'Choisis une pièce'
              : 'Touche une case allumée'}
      </Txt>

      <GameOver
        visible={fini}
        outcome={nulle ? 'draw' : monCamp === null || gagnant === monCamp ? 'win' : 'loss'}
        title={
          nulle
            ? 'Cent vingt coups sans conclusion'
            : gagnant === 2
              ? 'Le roi atteint le coin !'
              : 'Le roi est cerné'
        }
        detail={
          gagnant === 2
            ? 'Deux coins ouverts en même temps, et les assaillants ne peuvent plus suivre.'
            : 'Les assaillants ont refermé le cercle.'
        }
        accent={ACCENT}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
