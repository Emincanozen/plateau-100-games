import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'morpion-ultime',
  name: 'Morpion ultime',
  tagline: 'Neuf morpions imbriqués : ton coup choisit la grille de l’adversaire.',
  category: 'plateau',
  emoji: '🎯',
  difficulty: 3,
  players: '1-2',
  minutes: 12,
  score: 'none',
  tags: ['stratégie', 'duo', 'morpion'],
  rules: [
    'Le plateau contient neuf petites grilles de morpion. Gagner une petite grille la remporte en entier.',
    'Aligne trois petites grilles gagnées pour remporter la partie.',
    'La case que tu joues désigne la petite grille où l’adversaire devra jouer.',
    'Si cette grille est déjà terminée, l’adversaire joue où il veut : la grille libre est encadrée.',
  ],
};

type Camp = 'X' | 'O';
type Case = Camp | null;
/** Issue d'une petite grille : un camp, « N » pour nulle, ou rien. */
type Issue = Camp | 'N' | null;
type Mode = 'facile' | 'normal' | 'expert' | 'duo';

interface Etat {
  cases: Case[];
  zones: Issue[];
  /** Petite grille imposée, ou null quand le joueur choisit librement. */
  zone: number | null;
  tour: Camp;
}

const LIGNES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Le centre et les coins d'une méta-grille valent plus que les bords. */
const POIDS_ZONE = [3, 2, 3, 2, 4, 2, 3, 2, 3];

function etatInitial(): Etat {
  return { cases: Array(81).fill(null), zones: Array(9).fill(null), zone: null, tour: 'X' };
}

function issuePetiteGrille(g: Case[]): Issue {
  for (const [a, b, c] of LIGNES) {
    if (g[a] && g[a] === g[b] && g[b] === g[c]) return g[a];
  }
  return g.every((v) => v !== null) ? 'N' : null;
}

function issueGlobale(zones: Issue[]): Issue {
  for (const [a, b, c] of LIGNES) {
    const v = zones[a];
    if ((v === 'X' || v === 'O') && v === zones[b] && v === zones[c]) return v;
  }
  return zones.every((z) => z !== null) ? 'N' : null;
}

function ligneGlobale(zones: Issue[]): number[] | null {
  for (const trio of LIGNES) {
    const [a, b, c] = trio;
    const v = zones[a];
    if ((v === 'X' || v === 'O') && v === zones[b] && v === zones[c]) return trio;
  }
  return null;
}

function coupsPossibles(e: Etat): number[] {
  const zonesOuvertes =
    e.zone !== null && e.zones[e.zone] === null
      ? [e.zone]
      : e.zones.map((z, i) => (z === null ? i : -1)).filter((i) => i >= 0);

  const out: number[] = [];
  for (const z of zonesOuvertes) {
    for (let k = 0; k < 9; k++) {
      const index = z * 9 + k;
      if (e.cases[index] === null) out.push(index);
    }
  }
  return out;
}

function jouer(e: Etat, index: number): Etat {
  const cases = e.cases.slice();
  cases[index] = e.tour;

  const zone = Math.floor(index / 9);
  const zones = e.zones.slice();
  zones[zone] = issuePetiteGrille(cases.slice(zone * 9, zone * 9 + 9));

  const envoyeeVers = index % 9;
  return {
    cases,
    zones,
    zone: zones[envoyeeVers] === null ? envoyeeVers : null,
    tour: e.tour === 'X' ? 'O' : 'X',
  };
}

/** Menaces et occupation d'une petite grille encore ouverte. */
function noterPetiteGrille(g: Case[], camp: Camp): number {
  const adverse: Camp = camp === 'X' ? 'O' : 'X';
  let score = 0;

  for (const [a, b, c] of LIGNES) {
    const trio = [g[a], g[b], g[c]];
    const miens = trio.filter((v) => v === camp).length;
    const siens = trio.filter((v) => v === adverse).length;
    if (miens > 0 && siens > 0) continue; // ligne morte
    if (miens === 2) score += 6;
    else if (miens === 1) score += 1;
    if (siens === 2) score -= 6;
    else if (siens === 1) score -= 1;
  }

  if (g[4] === camp) score += 3;
  else if (g[4] === adverse) score -= 3;
  return score;
}

function evaluer(e: Etat, camp: Camp): number {
  const adverse: Camp = camp === 'X' ? 'O' : 'X';
  let score = 0;

  for (let z = 0; z < 9; z++) {
    const issue = e.zones[z];
    if (issue === camp) score += 25 * POIDS_ZONE[z];
    else if (issue === adverse) score -= 25 * POIDS_ZONE[z];
    else if (issue === null) score += noterPetiteGrille(e.cases.slice(z * 9, z * 9 + 9), camp) * 1.2;
  }

  // Une méta-ligne à deux grilles pèse bien plus que le détail des cases.
  for (const [a, b, c] of LIGNES) {
    const trio = [e.zones[a], e.zones[b], e.zones[c]];
    const miens = trio.filter((v) => v === camp).length;
    const siens = trio.filter((v) => v === adverse).length;
    if (miens > 0 && siens > 0) continue;
    if (miens === 2 && trio.includes(null)) score += 120;
    if (siens === 2 && trio.includes(null)) score -= 150;
  }

  return score;
}

function alphabeta(e: Etat, profondeur: number, alpha: number, beta: number, camp: Camp): number {
  const issue = issueGlobale(e.zones);
  if (issue === camp) return 100000 + profondeur;
  if (issue === 'X' || issue === 'O') return -100000 - profondeur;
  if (issue === 'N') return 0;
  if (profondeur === 0) return evaluer(e, camp);

  const liste = coupsPossibles(e);
  if (liste.length === 0) return evaluer(e, camp);

  const maximise = e.tour === camp;
  let meilleur = maximise ? -Infinity : Infinity;
  let a = alpha;
  let b = beta;

  for (const index of liste) {
    const valeur = alphabeta(jouer(e, index), profondeur - 1, a, b, camp);
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

function coupOrdinateur(e: Etat, mode: Mode): number {
  const liste = coupsPossibles(e);
  if (liste.length === 0) return -1;
  if (mode === 'facile' && Math.random() < 0.4) return pick(liste);

  // Un grand nombre de coups légaux fait exploser l'arbre : on raccourcit.
  const base = mode === 'facile' ? 2 : mode === 'normal' ? 4 : 5;
  const profondeur = liste.length > 24 ? Math.max(2, base - 2) : liste.length > 12 ? base - 1 : base;

  let meilleur = liste[0];
  let meilleureValeur = -Infinity;
  for (const index of liste) {
    const valeur = alphabeta(jouer(e, index), profondeur - 1, -Infinity, Infinity, e.tour);
    if (valeur > meilleureValeur) {
      meilleureValeur = valeur;
      meilleur = index;
    }
  }
  return meilleur;
}

const COULEUR_X = '#5B8DEF';
const COULEUR_O = '#E0525F';

export default function MorpionUltime({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const taille = useBoardSize(24, 0.56);
  const zoneTaille = Math.floor(taille / 3);
  const cellule = Math.floor((zoneTaille - 8) / 3);

  const [mode, setMode] = useState<Mode>('normal');
  const [etat, setEtat] = useState<Etat>(etatInitial);
  const [comptee, setComptee] = useState(false);

  const issue = useMemo(() => issueGlobale(etat.zones), [etat.zones]);
  const fini = issue !== null;
  const zonesGagnantes = useMemo(() => ligneGlobale(etat.zones) ?? [], [etat.zones]);

  const reset = useCallback(() => {
    setEtat(etatInitial());
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    if (issue === 'N') {
      haptic('warning');
      if (mode !== 'duo') submitResult('draw');
      return;
    }
    const humain = issue === 'X';
    haptic(humain || mode === 'duo' ? 'success' : 'error');
    if (mode !== 'duo') submitResult(humain ? 'win' : 'loss');
  }, [fini, comptee, issue, mode, haptic, submitResult]);

  useEffect(() => {
    if (mode === 'duo' || etat.tour !== 'O' || fini) return;
    const id = setTimeout(() => {
      setEtat((courant) => {
        if (issueGlobale(courant.zones) !== null || courant.tour !== 'O') return courant;
        const index = coupOrdinateur(courant, mode);
        return index < 0 ? courant : jouer(courant, index);
      });
    }, 260);
    return () => clearTimeout(id);
  }, [etat, mode, fini]);

  const jouable = useMemo(() => new Set(coupsPossibles(etat)), [etat]);

  const poser = (index: number) => {
    if (fini || !jouable.has(index)) return;
    if (mode !== 'duo' && etat.tour !== 'X') return;
    haptic('light');
    setEtat((courant) => jouer(courant, index));
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini
          ? issue === 'N'
            ? 'Match nul'
            : `${issue === 'X' ? 'Croix' : 'Rond'} remporte la partie`
          : mode === 'duo'
            ? `Au tour des ${etat.tour === 'X' ? 'croix' : 'ronds'}`
            : etat.tour === 'X'
              ? 'À toi de jouer'
              : 'L’ordinateur réfléchit…'}
      </Txt>
      {!fini ? (
        <Txt variant="label" tone="faint">
          {etat.zone === null ? 'Grille libre' : `Grille ${etat.zone + 1}`}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: Math.max(zoneTaille * 3, 250) }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'expert', label: 'Expert' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent={COULEUR_X}
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: zoneTaille * 3 }}>
        {Array.from({ length: 9 }, (_, z) => {
          const issueZone = etat.zones[z];
          const ouverte =
            !fini && (etat.zone === null ? issueZone === null : etat.zone === z && issueZone === null);

          return (
            <View
              key={z}
              style={{
                width: zoneTaille,
                height: zoneTaille,
                padding: 4,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  borderRadius: radius.sm,
                  borderWidth: ouverte ? 2 : 1,
                  borderColor: ouverte ? COULEUR_X : c.border,
                  backgroundColor: zonesGagnantes.includes(z)
                    ? issue === 'X'
                      ? `${COULEUR_X}33`
                      : `${COULEUR_O}33`
                    : ouverte
                      ? `${COULEUR_X}12`
                      : c.surface,
                  overflow: 'hidden',
                }}
              >
                {issueZone === 'X' || issueZone === 'O' ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt
                      style={{
                        fontSize: zoneTaille * 0.5,
                        fontWeight: '800',
                        color: issueZone === 'X' ? COULEUR_X : COULEUR_O,
                      }}
                    >
                      {issueZone === 'X' ? '✕' : '◯'}
                    </Txt>
                  </View>
                ) : issueZone === 'N' ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt variant="caption" tone="faint">
                      nulle
                    </Txt>
                  </View>
                ) : (
                  Array.from({ length: 9 }, (_, k) => {
                    const index = z * 9 + k;
                    const contenu = etat.cases[index];
                    return (
                      <Pressable
                        key={k}
                        accessibilityRole="button"
                        accessibilityLabel={`Grille ${z + 1}, case ${k + 1}${
                          contenu ? (contenu === 'X' ? ', croix' : ', rond') : ', libre'
                        }`}
                        onPress={() => poser(index)}
                        style={{
                          width: cellule,
                          height: cellule,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 0.5,
                          borderColor: c.border,
                        }}
                      >
                        {contenu ? (
                          <Txt
                            style={{
                              fontSize: cellule * 0.74,
                              lineHeight: cellule,
                              fontWeight: '800',
                              color: contenu === 'X' ? COULEUR_X : COULEUR_O,
                            }}
                          >
                            {contenu === 'X' ? '✕' : '◯'}
                          </Txt>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>
          );
        })}
      </View>

      <Txt variant="caption" tone="faint" center>
        {etat.zone === null
          ? 'Tu peux jouer dans n’importe quelle grille encore ouverte'
          : 'Joue dans la grille encadrée'}
      </Txt>

      <GameOver
        visible={fini}
        outcome={issue === 'N' ? 'draw' : mode === 'duo' || issue === 'X' ? 'win' : 'loss'}
        title={
          issue === 'N'
            ? 'Plus aucune grille ouverte'
            : mode === 'duo'
              ? `Victoire des ${issue === 'X' ? 'croix' : 'ronds'}`
              : issue === 'X'
                ? 'Trois grilles alignées !'
                : 'L’ordinateur aligne trois grilles'
        }
        accent={COULEUR_X}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
