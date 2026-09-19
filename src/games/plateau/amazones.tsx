import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'amazones',
  name: 'Amazones',
  tagline: 'Déplace, tire une flèche, brûle une case. Le dernier qui bouge gagne.',
  category: 'plateau',
  emoji: '🏹',
  difficulty: 3,
  players: '1-2',
  minutes: 12,
  score: 'none',
  tags: ['stratégie', 'duo', 'territoire'],
  rules: [
    'Chaque camp possède quatre amazones, qui se déplacent comme la dame aux échecs.',
    'Après s’être déplacée, l’amazone tire une flèche, elle aussi en ligne droite : la case touchée brûle.',
    'Une case brûlée bloque tout le monde pour le reste de la partie, flèches comprises.',
    'Le premier qui ne peut plus déplacer aucune amazone a perdu : il s’agit d’enfermer l’adversaire.',
  ],
};

type Camp = 1 | 2;
type Niveau = 'facile' | 'normal' | 'expert' | 'duo';
type Taille = 6 | 8;

const VIDE = 0;
const BLANC = 1;
const NOIR = 2;
const BRULEE = 3;

const ACCENT = '#5B8DEF';
const TEINTE_BLANC = '#F6F6F8';
const TEINTE_NOIR = '#2A2A33';
const TEINTE_BRULEE = '#8A4535';

const DIRS: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

interface Coup {
  depuis: number;
  vers: number;
  fleche: number;
}

function positionDepart(n: Taille): Int8Array {
  const cases = new Int8Array(n * n);
  const placer = (l: number, col: number, v: number) => {
    cases[l * n + col] = v;
  };
  if (n === 6) {
    placer(5, 1, BLANC);
    placer(5, 4, BLANC);
    placer(3, 0, BLANC);
    placer(3, 5, BLANC);
    placer(0, 1, NOIR);
    placer(0, 4, NOIR);
    placer(2, 0, NOIR);
    placer(2, 5, NOIR);
  } else {
    placer(7, 2, BLANC);
    placer(7, 5, BLANC);
    placer(5, 0, BLANC);
    placer(5, 7, BLANC);
    placer(0, 2, NOIR);
    placer(0, 5, NOIR);
    placer(2, 0, NOIR);
    placer(2, 7, NOIR);
  }
  return cases;
}

/** Cases atteignables en ligne droite. `ignorer` traite une case comme vide. */
function atteignables(cases: Int8Array, n: number, depuis: number, ignorer = -1): number[] {
  const out: number[] = [];
  const l = Math.floor(depuis / n);
  const col = depuis % n;
  for (const [dl, dc] of DIRS) {
    for (let pas = 1; pas < n; pas++) {
      const nl = l + dl * pas;
      const nc = col + dc * pas;
      if (nl < 0 || nl >= n || nc < 0 || nc >= n) break;
      const index = nl * n + nc;
      if (cases[index] !== VIDE && index !== ignorer) break;
      out.push(index);
    }
  }
  return out;
}

function amazones(cases: Int8Array, camp: Camp): number[] {
  const out: number[] = [];
  for (let i = 0; i < cases.length; i++) if (cases[i] === camp) out.push(i);
  return out;
}

/**
 * Un camp peut jouer dès qu'une amazone a une case libre à côté d'elle :
 * la flèche peut toujours repartir vers la case qu'elle vient de quitter.
 */
function peutJouer(cases: Int8Array, n: number, camp: Camp): boolean {
  for (const index of amazones(cases, camp)) {
    const l = Math.floor(index / n);
    const col = index % n;
    for (const [dl, dc] of DIRS) {
      const nl = l + dl;
      const nc = col + dc;
      if (nl < 0 || nl >= n || nc < 0 || nc >= n) continue;
      if (cases[nl * n + nc] === VIDE) return true;
    }
  }
  return false;
}

function appliquer(cases: Int8Array, coup: Coup): Int8Array {
  const suivant = Int8Array.from(cases);
  suivant[coup.vers] = suivant[coup.depuis];
  suivant[coup.depuis] = VIDE;
  suivant[coup.fleche] = BRULEE;
  return suivant;
}

const INFINI = 9999;

/** Nombre de coups de dame nécessaires pour atteindre chaque case libre. */
function distances(cases: Int8Array, n: number, sources: number[]): Int32Array {
  const d = new Int32Array(n * n).fill(INFINI);
  const file: number[] = [];
  for (const s of sources) {
    d[s] = 0;
    file.push(s);
  }

  let tete = 0;
  while (tete < file.length) {
    const index = file[tete];
    tete += 1;
    const l = Math.floor(index / n);
    const col = index % n;
    for (const [dl, dc] of DIRS) {
      for (let pas = 1; pas < n; pas++) {
        const nl = l + dl * pas;
        const nc = col + dc * pas;
        if (nl < 0 || nl >= n || nc < 0 || nc >= n) break;
        const voisine = nl * n + nc;
        if (cases[voisine] !== VIDE) break;
        if (d[voisine] > d[index] + 1) {
          d[voisine] = d[index] + 1;
          file.push(voisine);
        }
      }
    }
  }
  return d;
}

/**
 * Le territoire : chaque case libre revient au camp qui l'atteint
 * en le moins de coups. C'est l'évaluation classique aux Amazones.
 */
function note(cases: Int8Array, n: number, camp: Camp): number {
  const adverse: Camp = camp === BLANC ? NOIR : BLANC;
  const miennes = distances(cases, n, amazones(cases, camp));
  const siennes = distances(cases, n, amazones(cases, adverse));

  let territoire = 0;
  let acces = 0;
  for (let i = 0; i < cases.length; i++) {
    if (cases[i] !== VIDE) continue;
    const a = miennes[i];
    const b = siennes[i];
    if (a < b) territoire += 1;
    else if (b < a) territoire -= 1;
    if (a < INFINI) acces += 1;
    if (b < INFINI) acces -= 1;
  }
  return territoire * 10 + acces;
}

/**
 * Choix en deux temps : on retient d'abord les meilleurs déplacements
 * (sans la flèche), puis on cherche la meilleure flèche parmi eux.
 */
function meilleursCoups(cases: Int8Array, n: number, camp: Camp, largeur: number): Coup[] {
  const deplacements: { depuis: number; vers: number; valeur: number }[] = [];

  for (const depuis of amazones(cases, camp)) {
    for (const vers of atteignables(cases, n, depuis)) {
      const essai = Int8Array.from(cases);
      essai[vers] = essai[depuis];
      essai[depuis] = VIDE;
      deplacements.push({ depuis, vers, valeur: note(essai, n, camp) });
    }
  }
  if (deplacements.length === 0) return [];

  deplacements.sort((x, y) => y.valeur - x.valeur);
  const retenus = deplacements.slice(0, largeur);

  const coups: { coup: Coup; valeur: number }[] = [];
  for (const { depuis, vers } of retenus) {
    const apres = Int8Array.from(cases);
    apres[vers] = apres[depuis];
    apres[depuis] = VIDE;
    for (const fleche of atteignables(apres, n, vers, depuis)) {
      const final = Int8Array.from(apres);
      final[fleche] = BRULEE;
      coups.push({ coup: { depuis, vers, fleche }, valeur: note(final, n, camp) });
    }
  }

  coups.sort((x, y) => y.valeur - x.valeur);
  return coups.map((x) => x.coup);
}

function coupOrdinateur(cases: Int8Array, n: number, camp: Camp, niveau: Niveau): Coup | null {
  const adverse: Camp = camp === BLANC ? NOIR : BLANC;

  if (niveau === 'facile') {
    const liste = meilleursCoups(cases, n, camp, 3);
    if (liste.length === 0) return null;
    return Math.random() < 0.5 ? pick(liste.slice(0, Math.min(8, liste.length))) : liste[0];
  }

  const largeur = niveau === 'normal' ? 6 : 10;
  const liste = meilleursCoups(cases, n, camp, largeur);
  if (liste.length === 0) return null;
  if (niveau === 'normal') return liste[0];

  // Expert : un coup d'avance, en supposant que l'adversaire joue son meilleur coup.
  let meilleur = liste[0];
  let meilleureValeur = -Infinity;
  for (const coup of liste.slice(0, 8)) {
    const apres = appliquer(cases, coup);
    if (!peutJouer(apres, n, adverse)) return coup;

    const riposte = meilleursCoups(apres, n, adverse, 4)[0];
    const finale = riposte ? appliquer(apres, riposte) : apres;
    const valeur = note(finale, n, camp);
    if (valeur > meilleureValeur) {
      meilleureValeur = valeur;
      meilleur = coup;
    }
  }
  return meilleur;
}

export default function Amazones({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeurPlateau = useBoardSize(32, 0.48);

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const [taille, setTaille] = useState<Taille>(6);
  const n = taille;
  const cellule = Math.floor(largeurPlateau / n);

  const [cases, setCases] = useState<Int8Array>(() => positionDepart(6));
  const [tour, setTour] = useState<Camp>(BLANC);
  const [choisie, setChoisie] = useState<number | null>(null);
  /** Déplacement joué mais flèche pas encore tirée. */
  const [enCours, setEnCours] = useState<{ depuis: number; vers: number; avant: Int8Array } | null>(null);
  const [comptee, setComptee] = useState(false);

  const solo = niveau !== 'duo';
  const bloque = useMemo(() => !peutJouer(cases, n, tour), [cases, n, tour]);
  const fini = bloque && enCours === null;
  const gagnant: Camp = tour === BLANC ? NOIR : BLANC;

  const reset = useCallback(() => {
    setCases(positionDepart(taille));
    setTour(BLANC);
    setChoisie(null);
    setEnCours(null);
    setComptee(false);
  }, [taille]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, taille, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    const humainGagne = !solo || gagnant === BLANC;
    haptic(humainGagne ? 'success' : 'error');
    if (solo) submitResult(gagnant === BLANC ? 'win' : 'loss');
  }, [fini, comptee, gagnant, solo, haptic, submitResult]);

  useEffect(() => {
    if (!solo || fini || tour !== NOIR) return;
    const id = setTimeout(() => {
      const coup = coupOrdinateur(cases, n, NOIR, niveau);
      if (!coup) return;
      setCases(appliquer(cases, coup));
      setTour(BLANC);
    }, 280);
    return () => clearTimeout(id);
  }, [cases, tour, solo, niveau, fini, n]);

  const aMoi = !solo || tour === BLANC;

  const destinations = useMemo(() => {
    if (enCours !== null || choisie === null) return new Set<number>();
    return new Set(atteignables(cases, n, choisie));
  }, [cases, n, choisie, enCours]);

  const ciblesFleche = useMemo(() => {
    if (enCours === null) return new Set<number>();
    return new Set(atteignables(cases, n, enCours.vers, enCours.depuis));
  }, [cases, n, enCours]);

  const toucher = (index: number) => {
    if (fini || !aMoi) return;

    if (enCours !== null) {
      if (!ciblesFleche.has(index)) return;
      haptic('heavy');
      const suivant = Int8Array.from(cases);
      suivant[index] = BRULEE;
      setCases(suivant);
      setEnCours(null);
      setChoisie(null);
      setTour(tour === BLANC ? NOIR : BLANC);
      return;
    }

    if (destinations.has(index) && choisie !== null) {
      haptic('medium');
      const suivant = Int8Array.from(cases);
      suivant[index] = suivant[choisie];
      suivant[choisie] = VIDE;
      setEnCours({ depuis: choisie, vers: index, avant: cases });
      setCases(suivant);
      setChoisie(null);
      return;
    }

    if (cases[index] === tour) {
      haptic('light');
      setChoisie(choisie === index ? null : index);
      return;
    }
    setChoisie(null);
  };

  const annulerDeplacement = () => {
    if (enCours === null) return;
    haptic('light');
    setCases(enCours.avant);
    setChoisie(enCours.depuis);
    setEnCours(null);
  };

  const brulees = useMemo(() => cases.filter((v) => v === BRULEE).length, [cases]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini
          ? `${solo ? (gagnant === BLANC ? 'Tu gagnes' : 'L’ordinateur gagne') : `Victoire des ${gagnant === BLANC ? 'blanches' : 'noires'}`}`
          : enCours !== null
            ? 'Tire une flèche'
            : solo
              ? tour === BLANC
                ? 'À toi de jouer'
                : 'L’ordinateur réfléchit…'
              : `Au tour des ${tour === BLANC ? 'blanches' : 'noires'}`}
      </Txt>
      <Txt variant="label" tone="faint">
        {brulees} cases brûlées
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: Math.max(cellule * n, 270), gap: space.sm }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'expert', label: 'Expert' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent={ACCENT}
        />
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 6, label: '6 × 6' },
            { value: 8, label: '8 × 8' },
          ]}
          accent={ACCENT}
        />
      </View>

      <View
        style={{
          width: cellule * n,
          height: cellule * n,
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: c.boardEdge,
        }}
      >
        {Array.from({ length: n * n }, (_, i) => {
          const l = Math.floor(i / n);
          const col = i % n;
          const sombre = (l + col) % 2 === 1;
          const contenu = cases[i];
          const cible = destinations.has(i);
          const tir = ciblesFleche.has(i);

          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Case ${l + 1}-${col + 1}${
                contenu === VIDE
                  ? ', libre'
                  : contenu === BRULEE
                    ? ', brûlée'
                    : contenu === BLANC
                      ? ', amazone blanche'
                      : ', amazone noire'
              }`}
              onPress={() => toucher(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  contenu === BRULEE
                    ? TEINTE_BRULEE
                    : tir
                      ? '#E0525F55'
                      : cible
                        ? `${ACCENT}55`
                        : sombre
                          ? c.boardDark
                          : c.boardLight,
              }}
            >
              {contenu === BRULEE ? (
                <Txt style={{ fontSize: cellule * 0.38, color: '#FFFFFF88' }}>✕</Txt>
              ) : contenu === BLANC || contenu === NOIR ? (
                <View
                  style={{
                    width: cellule * 0.76,
                    height: cellule * 0.76,
                    borderRadius: cellule,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: contenu === BLANC ? TEINTE_BLANC : TEINTE_NOIR,
                    borderWidth: choisie === i || enCours?.vers === i ? 3 : 1,
                    borderColor: choisie === i || enCours?.vers === i ? ACCENT : '#00000055',
                  }}
                >
                  <Txt
                    style={{
                      fontSize: cellule * 0.46,
                      color: contenu === BLANC ? '#2A2A33' : '#F6F6F8',
                    }}
                  >
                    ♛
                  </Txt>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {enCours !== null ? (
        <Button label="Annuler le déplacement" kind="secondary" size="sm" onPress={annulerDeplacement} />
      ) : null}

      <Txt variant="caption" tone="faint" center>
        {fini
          ? 'Partie terminée'
          : !aMoi
            ? 'L’ordinateur réfléchit…'
            : enCours !== null
              ? 'Choisis la case à brûler'
              : choisie === null
                ? 'Choisis une amazone'
                : 'Touche une case allumée'}
      </Txt>

      <GameOver
        visible={fini}
        outcome={!solo || gagnant === BLANC ? 'win' : 'loss'}
        title={
          solo
            ? gagnant === BLANC
              ? 'L’ordinateur est enfermé !'
              : 'Tu n’as plus un seul coup'
            : `Victoire des ${gagnant === BLANC ? 'blanches' : 'noires'}`
        }
        detail={`${brulees} cases brûlées sur ${n * n}`}
        accent={ACCENT}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
