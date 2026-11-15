import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'hex',
  name: 'Hex',
  tagline: 'Relie tes deux bords avant que l’adversaire ne relie les siens.',
  category: 'plateau',
  emoji: '⬡',
  difficulty: 3,
  players: '1-2',
  minutes: 10,
  score: 'none',
  tags: ['stratégie', 'duo', 'connexion'],
  rules: [
    'Chacun son tour, pose une pierre sur une case libre du losange.',
    'Rouge doit relier le bord du haut au bord du bas, bleu le bord de gauche à celui de droite.',
    'Deux cases sont voisines si elles se touchent : six voisines par case, diagonales comprises.',
    'Il n’y a jamais match nul : quand le plateau se remplit, quelqu’un a forcément relié ses bords.',
  ],
};

type Pion = 0 | 1 | 2; // 0 vide · 1 rouge · 2 bleu
type Mode = 'facile' | 'normal' | 'expert' | 'duo';
type Taille = 7 | 9 | 11;

const ROUGE = '#E0525F';
const BLEU = '#5B8DEF';

/** Décalages des six voisines dans un losange hexagonal. */
const VOISINS: [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [-1, 1],
  [1, -1],
  [1, 0],
];

function voisines(index: number, n: number): number[] {
  const l = Math.floor(index / n);
  const col = index % n;
  const out: number[] = [];
  for (const [dl, dc] of VOISINS) {
    const nl = l + dl;
    const nc = col + dc;
    if (nl < 0 || nl >= n || nc < 0 || nc >= n) continue;
    out.push(nl * n + nc);
  }
  return out;
}

/**
 * Le camp relie-t-il ses deux bords ?
 * Rouge va du haut vers le bas, bleu de gauche à droite.
 */
function relie(cases: Int8Array, n: number, couleur: 1 | 2, chemin?: Set<number>): boolean {
  const vus = new Uint8Array(n * n);
  const pile: number[] = [];

  for (let k = 0; k < n; k++) {
    const depart = couleur === 1 ? k : k * n;
    if (cases[depart] === couleur) {
      vus[depart] = 1;
      pile.push(depart);
    }
  }

  const atteintes: number[] = [];
  let touche = false;
  while (pile.length > 0) {
    const index = pile.pop() as number;
    atteintes.push(index);
    const l = Math.floor(index / n);
    const col = index % n;
    if (couleur === 1 ? l === n - 1 : col === n - 1) {
      touche = true;
      if (!chemin) return true;
    }
    for (const v of voisines(index, n)) {
      if (vus[v] || cases[v] !== couleur) continue;
      vus[v] = 1;
      pile.push(v);
    }
  }

  if (touche && chemin) for (const index of atteintes) chemin.add(index);
  return touche;
}

function vides(cases: Int8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < cases.length; i++) if (cases[i] === 0) out.push(i);
  return out;
}

/**
 * Une partie aléatoire jouée jusqu'au bout : on remplit toutes les cases
 * libres en alternant les couleurs, puis on regarde qui a relié ses bords.
 * Sur Hex cette estimation est étonnamment fiable — le plateau plein a
 * toujours exactement un gagnant.
 */
function simuler(base: Int8Array, n: number, aJouer: 1 | 2, tampon: Int8Array, libres: number[]): 1 | 2 {
  tampon.set(base);
  const ordre = libres.slice();
  for (let i = ordre.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = ordre[i];
    ordre[i] = ordre[j];
    ordre[j] = tmp;
  }
  let couleur: 1 | 2 = aJouer;
  for (const index of ordre) {
    tampon[index] = couleur;
    couleur = couleur === 1 ? 2 : 1;
  }
  return relie(tampon, n, 1) ? 1 : 2;
}

/** Cases libres proches d'une pierre : inutile d'évaluer le grand vide. */
function candidates(cases: Int8Array, n: number): number[] {
  const libres = vides(cases);
  if (cases.every((v) => v === 0)) return [Math.floor((n * n) / 2)];

  const proches = libres.filter((index) => {
    for (const v of voisines(index, n)) {
      if (cases[v] !== 0) return true;
      for (const v2 of voisines(v, n)) if (cases[v2] !== 0) return true;
    }
    return false;
  });
  return proches.length > 0 ? proches : libres;
}

function coupOrdinateur(cases: Int8Array, n: number, mode: Mode): number {
  const libres = vides(cases);
  if (libres.length === 0) return -1;

  const essai = new Int8Array(n * n);

  // Gagner tout de suite si c'est possible.
  for (const index of libres) {
    essai.set(cases);
    essai[index] = 2;
    if (relie(essai, n, 2)) return index;
  }
  // Sinon empêcher l'adversaire de gagner tout de suite.
  for (const index of libres) {
    essai.set(cases);
    essai[index] = 1;
    if (relie(essai, n, 1)) return index;
  }

  const liste = candidates(cases, n);
  if (mode === 'facile' && Math.random() < 0.35) return pick(liste);

  const parties = mode === 'facile' ? 4 : mode === 'normal' ? 18 : 48;
  const tampon = new Int8Array(n * n);

  let meilleur = liste[0];
  let meilleurTaux = -1;
  for (const index of liste) {
    essai.set(cases);
    essai[index] = 2;
    const libresApres = vides(essai);
    let victoires = 0;
    for (let k = 0; k < parties; k++) {
      if (simuler(essai, n, 1, tampon, libresApres) === 2) victoires += 1;
    }
    const taux = victoires / parties;
    if (taux > meilleurTaux) {
      meilleurTaux = taux;
      meilleur = index;
    }
  }
  return meilleur;
}

export default function Hex({ submitResult, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const { width, height } = useWindowDimensions();

  const [mode, setMode] = useState<Mode>('normal');
  const [taille, setTaille] = useState<Taille>(9);
  const n = taille;

  const [cases, setCases] = useState<Int8Array>(() => new Int8Array(n * n));
  const [tour, setTour] = useState<1 | 2>(1);
  const [comptee, setComptee] = useState(false);

  // Le losange est plus large que haut : sa largeur vaut 1,5 n − 0,5 cellules.
  const cellule = Math.floor(
    Math.min((Math.min(width, 520) - 24) / (1.5 * n - 0.5), (height * 0.46) / (0.88 * (n - 1) + 1)),
  );
  const pasLigne = cellule * 0.88;
  const largeurPlateau = cellule * (1.5 * n - 0.5);
  const hauteurPlateau = pasLigne * (n - 1) + cellule;

  const gagnant = useMemo<1 | 2 | null>(() => {
    if (relie(cases, n, 1)) return 1;
    if (relie(cases, n, 2)) return 2;
    return null;
  }, [cases, n]);

  const cheminGagnant = useMemo(() => {
    if (!gagnant) return new Set<number>();
    const chemin = new Set<number>();
    relie(cases, n, gagnant, chemin);
    return chemin;
  }, [cases, n, gagnant]);

  const fini = gagnant !== null;

  const reset = useCallback(() => {
    setCases(new Int8Array(n * n));
    setTour(1);
    setComptee(false);
  }, [n]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, taille, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    const humain = gagnant === 1;
    haptic(humain || mode === 'duo' ? 'success' : 'error');
    if (mode !== 'duo') submitResult(humain ? 'win' : 'loss');
  }, [fini, comptee, gagnant, mode, haptic, submitResult]);

  useEffect(() => {
    if (mode === 'duo' || tour !== 2 || fini) return;
    const id = setTimeout(() => {
      setCases((courant) => {
        if (relie(courant, n, 1) || relie(courant, n, 2)) return courant;
        const index = coupOrdinateur(courant, n, mode);
        if (index < 0) return courant;
        const suivant = Int8Array.from(courant);
        suivant[index] = 2;
        return suivant;
      });
      setTour(1);
    }, 220);
    return () => clearTimeout(id);
  }, [tour, mode, fini, n]);

  const poser = (index: number) => {
    if (fini || cases[index] !== 0) return;
    if (mode !== 'duo' && tour !== 1) return;
    haptic('light');
    setCases((courant) => {
      const suivant = Int8Array.from(courant);
      suivant[index] = tour;
      return suivant;
    });
    setTour(tour === 1 ? 2 : 1);
  };

  useFrameStatus(
    <Txt variant="label" tone="dim">
      {fini
        ? `${gagnant === 1 ? 'Rouge' : 'Bleu'} a relié ses bords`
        : mode === 'duo'
          ? `Au tour du ${tour === 1 ? 'rouge' : 'bleu'}`
          : tour === 1
            ? 'À toi de jouer (rouge)'
            : 'L’ordinateur réfléchit…'}
    </Txt>,
  );

  const indices = Array.from({ length: n * n }, (_, i) => i);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: Math.min(width - 32, 340), gap: space.sm }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'expert', label: 'Expert' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent={BLEU}
        />
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 7, label: '7 × 7' },
            { value: 9, label: '9 × 9' },
            { value: 11, label: '11 × 11' },
          ]}
          accent={BLEU}
        />
      </View>

      <Row gap={space.lg}>
        <Row gap={6}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: ROUGE }} />
          <Txt variant="caption" tone="faint">
            haut ↕ bas
          </Txt>
        </Row>
        <Row gap={6}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: BLEU }} />
          <Txt variant="caption" tone="faint">
            gauche ↔ droite
          </Txt>
        </Row>
      </Row>

      <View style={{ width: largeurPlateau, height: hauteurPlateau }}>
        {indices.map((index) => {
          const l = Math.floor(index / n);
          const col = index % n;
          const pion = cases[index];
          const bordRouge = l === 0 || l === n - 1;
          const bordBleu = col === 0 || col === n - 1;
          const teinteBord = bordRouge ? ROUGE : bordBleu ? BLEU : c.borderStrong;

          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`Ligne ${l + 1}, colonne ${col + 1}${
                pion === 0 ? ', libre' : pion === 1 ? ', rouge' : ', bleu'
              }`}
              onPress={() => poser(index)}
              style={{
                position: 'absolute',
                left: col * cellule + l * (cellule / 2),
                top: l * pasLigne,
                width: cellule - 2,
                height: cellule - 2,
                borderRadius: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  pion === 1 ? ROUGE : pion === 2 ? BLEU : bordRouge || bordBleu ? c.surfaceAlt : c.surface,
                borderWidth: bordRouge || bordBleu ? 2 : 1,
                borderColor: teinteBord,
                opacity: pion !== 0 && cheminGagnant.size > 0 && !cheminGagnant.has(index) ? 0.55 : 1,
              }}
            >
              {cheminGagnant.has(index) ? (
                <View
                  style={{
                    width: cellule * 0.3,
                    height: cellule * 0.3,
                    borderRadius: cellule,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <GameOver
        visible={fini}
        outcome={mode === 'duo' || gagnant === 1 ? 'win' : 'loss'}
        title={
          mode === 'duo'
            ? `Victoire du ${gagnant === 1 ? 'rouge' : 'bleu'}`
            : gagnant === 1
              ? 'Tes bords sont reliés !'
              : 'L’ordinateur a relié les siens'
        }
        detail="Sur un plateau de Hex plein, il y a toujours exactement un gagnant."
        accent={BLEU}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
