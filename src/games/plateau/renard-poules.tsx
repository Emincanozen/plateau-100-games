import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'renard-poules',
  name: 'Renard et poules',
  tagline: 'Treize poules encerclent un renard. L’une des deux a tort.',
  category: 'plateau',
  emoji: '🦊',
  difficulty: 2,
  players: '1-2',
  minutes: 8,
  score: 'none',
  tags: ['stratégie', 'asymétrique', 'duo'],
  rules: [
    'Les poules avancent d’une case vers le bas, à gauche ou à droite — jamais en arrière, jamais en diagonale.',
    'Le renard se déplace d’une case dans les quatre directions.',
    'Le renard mange en sautant par-dessus une poule voisine pour retomber dans la case juste derrière.',
    'Les poules gagnent en bloquant complètement le renard ; le renard gagne s’il n’en reste plus que quatre.',
  ],
};

const N = 7;
const RENARD_DEPART = 3 * N + 3;
const ACCENT = '#5B8DEF';
const COULEUR_POULE = '#F0A030';
const COULEUR_RENARD = '#E0525F';

/** Les 33 cases de la croix. */
const VALIDE: boolean[] = (() => {
  const out: boolean[] = [];
  for (let l = 0; l < N; l++) {
    for (let col = 0; col < N; col++) out.push((l >= 2 && l <= 4) || (col >= 2 && col <= 4));
  }
  return out;
})();

type Case = 0 | 1 | 2; // 0 vide · 1 poule · 2 renard
type Camp = 1 | 2;
type Niveau = 'facile' | 'normal' | 'expert';
type Camps = 'oies' | 'renard' | 'duo';

interface Etat {
  cases: Case[];
  tour: Camp;
  /** Coups joués sans prise, pour éviter les parties sans fin. */
  sansPrise: number;
}

interface Coup {
  depuis: number;
  vers: number;
  capture?: number;
}

function etatInitial(): Etat {
  const cases: Case[] = VALIDE.map(() => 0);
  // Treize poules alignées sur les trois premières rangées.
  for (const i of [2, 3, 4, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20]) cases[i] = 1;
  cases[RENARD_DEPART] = 2;
  return { cases, tour: 1, sansPrise: 0 };
}

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
/** Les poules ne reculent jamais. */
const DIRS_POULES: [number, number][] = [
  [1, 0],
  [0, 1],
  [0, -1],
];

function indexDe(l: number, col: number): number | null {
  if (l < 0 || l >= N || col < 0 || col >= N) return null;
  const i = l * N + col;
  return VALIDE[i] ? i : null;
}

function positionRenard(cases: Case[]): number {
  return cases.indexOf(2);
}

function compterPoules(cases: Case[]): number {
  let n = 0;
  for (const v of cases) if (v === 1) n += 1;
  return n;
}

function coupsPoules(cases: Case[]): Coup[] {
  const out: Coup[] = [];
  for (let i = 0; i < cases.length; i++) {
    if (cases[i] !== 1) continue;
    const l = Math.floor(i / N);
    const col = i % N;
    for (const [dl, dc] of DIRS_POULES) {
      const vers = indexDe(l + dl, col + dc);
      if (vers !== null && cases[vers] === 0) out.push({ depuis: i, vers });
    }
  }
  return out;
}

function coupsRenard(cases: Case[]): Coup[] {
  const depuis = positionRenard(cases);
  if (depuis < 0) return [];
  const l = Math.floor(depuis / N);
  const col = depuis % N;
  const out: Coup[] = [];

  for (const [dl, dc] of DIRS) {
    const pas = indexDe(l + dl, col + dc);
    if (pas === null) continue;
    if (cases[pas] === 0) {
      out.push({ depuis, vers: pas });
      continue;
    }
    if (cases[pas] !== 1) continue;
    const saut = indexDe(l + dl * 2, col + dc * 2);
    if (saut !== null && cases[saut] === 0) out.push({ depuis, vers: saut, capture: pas });
  }
  return out;
}

function coups(e: Etat): Coup[] {
  return e.tour === 1 ? coupsPoules(e.cases) : coupsRenard(e.cases);
}

function appliquer(e: Etat, coup: Coup): Etat {
  const cases = e.cases.slice();
  cases[coup.vers] = cases[coup.depuis];
  cases[coup.depuis] = 0;
  if (coup.capture !== undefined) cases[coup.capture] = 0;
  return {
    cases,
    tour: e.tour === 1 ? 2 : 1,
    sansPrise: coup.capture !== undefined ? 0 : e.sansPrise + 1,
  };
}

/** Camp gagnant, ou null si la partie continue. */
function vainqueur(e: Etat): Camp | null {
  if (compterPoules(e.cases) < 5) return 2;
  if (coupsRenard(e.cases).length === 0) return 1;
  if (e.tour === 1 && coupsPoules(e.cases).length === 0) return 2;
  return null;
}

/** Note de la position du point de vue du renard. */
function noteRenard(e: Etat): number {
  const poules = compterPoules(e.cases);
  const mobilite = coupsRenard(e.cases).length;

  let avancement = 0;
  let groupees = 0;
  for (let i = 0; i < e.cases.length; i++) {
    if (e.cases[i] !== 1) continue;
    const l = Math.floor(i / N);
    const col = i % N;
    avancement += l;
    for (const [dl, dc] of DIRS) {
      const v = indexDe(l + dl, col + dc);
      if (v !== null && e.cases[v] === 1) groupees += 1;
    }
  }

  // Le renard veut peu de poules, de l'air, et des poules dispersées et en retard.
  return -14 * poules + 6 * mobilite - 0.8 * avancement - 0.5 * groupees;
}

function alphabeta(e: Etat, profondeur: number, alpha: number, beta: number, camp: Camp): number {
  const gagnant = vainqueur(e);
  if (gagnant !== null) return gagnant === camp ? 100000 + profondeur : -100000 - profondeur;
  if (e.sansPrise >= 80) return 0;
  if (profondeur === 0) {
    const note = noteRenard(e);
    return camp === 2 ? note : -note;
  }

  const liste = coups(e);
  if (liste.length === 0) {
    const note = noteRenard(e);
    return camp === 2 ? note : -note;
  }

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

function coupOrdinateur(e: Etat, niveau: Niveau): Coup | null {
  const liste = coups(e);
  if (liste.length === 0) return null;
  if (liste.length === 1) return liste[0];
  if (niveau === 'facile' && Math.random() < 0.35) return pick(liste);

  const profondeur = niveau === 'facile' ? 2 : niveau === 'normal' ? 4 : 5;

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

export default function RenardPoules({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.46);
  const cellule = Math.floor(largeur / N);

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const [camps, setCamps] = useState<Camps>('oies');
  const [etat, setEtat] = useState<Etat>(etatInitial);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [comptee, setComptee] = useState(false);

  const monCamp: Camp | null = camps === 'oies' ? 1 : camps === 'renard' ? 2 : null;
  const gagnant = useMemo(() => vainqueur(etat), [etat]);
  const nulle = etat.sansPrise >= 80;
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
    }, 280);
    return () => clearTimeout(id);
  }, [etat, monCamp, niveau, fini]);

  const legaux = useMemo(() => coups(etat), [etat]);

  const destinations = useMemo(() => {
    if (choisi === null) return new Map<number, Coup>();
    return new Map(legaux.filter((k) => k.depuis === choisi).map((k) => [k.vers, k]));
  }, [choisi, legaux]);

  const deplacables = useMemo(() => new Set(legaux.map((k) => k.depuis)), [legaux]);

  const toucher = (index: number) => {
    if (fini || !aMoi) return;

    const coup = destinations.get(index);
    if (coup) {
      haptic(coup.capture !== undefined ? 'heavy' : 'medium');
      setEtat((courant) => appliquer(courant, coup));
      setChoisi(null);
      return;
    }

    if (etat.cases[index] === etat.tour && deplacables.has(index)) {
      haptic('light');
      setChoisi(choisi === index ? null : index);
      return;
    }
    setChoisi(null);
  };

  const poules = compterPoules(etat.cases);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini
          ? nulle
            ? 'Match nul'
            : gagnant === 1
              ? 'Le renard est bloqué'
              : 'Le renard l’emporte'
          : etat.tour === 1
            ? 'Aux poules'
            : 'Au renard'}
      </Txt>
      <Txt variant="label" tone="faint">
        {poules} poules
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
            { value: 'oies', label: 'Les poules' },
            { value: 'renard', label: 'Le renard' },
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
          backgroundColor: c.boardLight,
          borderRadius: radius.lg,
          overflow: 'hidden',
        }}
      >
        {VALIDE.map((ok, i) => {
          if (!ok) return <View key={i} style={{ width: cellule, height: cellule }} />;

          const contenu = etat.cases[i];
          const cible = destinations.has(i);
          const capture = destinations.get(i)?.capture !== undefined;

          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Case ${Math.floor(i / N) + 1}-${(i % N) + 1}${
                contenu === 0 ? ', vide' : contenu === 1 ? ', poule' : ', renard'
              }`}
              onPress={() => toucher(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 0.5,
                borderColor: '#00000022',
                backgroundColor: cible ? (capture ? `${COULEUR_RENARD}55` : `${ACCENT}44`) : 'transparent',
              }}
            >
              {contenu === 0 ? (
                <View
                  style={{
                    width: cellule * 0.16,
                    height: cellule * 0.16,
                    borderRadius: cellule,
                    backgroundColor: '#00000022',
                  }}
                />
              ) : (
                <View
                  style={{
                    width: cellule * 0.78,
                    height: cellule * 0.78,
                    borderRadius: cellule,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: contenu === 1 ? COULEUR_POULE : COULEUR_RENARD,
                    borderWidth: choisi === i ? 3 : 1,
                    borderColor: choisi === i ? '#FFFFFF' : '#00000044',
                  }}
                >
                  <Txt style={{ fontSize: cellule * 0.42 }}>{contenu === 1 ? '🐔' : '🦊'}</Txt>
                </View>
              )}
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
              ? etat.tour === 1
                ? 'Choisis une poule à avancer'
                : 'Touche le renard'
              : 'Touche une case allumée'}
      </Txt>

      <GameOver
        visible={fini}
        outcome={nulle ? 'draw' : monCamp === null || gagnant === monCamp ? 'win' : 'loss'}
        title={
          nulle
            ? 'Quatre-vingts coups sans prise'
            : gagnant === 1
              ? 'Le renard n’a plus une case'
              : 'Le renard a dévoré la basse-cour'
        }
        detail={
          gagnant === 1
            ? 'Les poules avancent en mur : c’est ainsi qu’elles gagnent.'
            : 'Il ne reste plus assez de poules pour bloquer quoi que ce soit.'
        }
        accent={ACCENT}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
