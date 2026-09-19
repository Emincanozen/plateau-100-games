import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick, range, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'quarto',
  name: 'Quarto',
  tagline: 'C’est l’adversaire qui choisit la pièce que tu poses.',
  category: 'plateau',
  emoji: '🔶',
  difficulty: 3,
  players: '1-2',
  minutes: 10,
  score: 'none',
  tags: ['stratégie', 'duo', 'abstrait'],
  rules: [
    'Seize pièces, toutes différentes : grande ou petite, claire ou foncée, ronde ou carrée, pleine ou creuse.',
    'Tu ne choisis pas ta pièce : l’adversaire te la donne, et tu la poses où tu veux.',
    'Aligner quatre pièces qui partagent au moins un trait — quatre grandes, quatre creuses… — fait gagner.',
    'Les lignes, les colonnes et les deux diagonales comptent. Attention à la pièce que tu offres.',
  ],
};

/**
 * Une pièce tient dans quatre bits :
 * 1 = grande · 2 = foncée · 4 = carrée · 8 = creuse.
 */
const GRANDE = 1;
const FONCEE = 2;
const CARREE = 4;
const CREUSE = 8;

/** Le bois des pièces ne suit pas le thème : les traits doivent rester lisibles. */
const BOIS_CLAIR = '#E9C892';
const BOIS_FONCE = '#5A4330';
const ACCENT = '#5B8DEF';

type Mode = 'facile' | 'normal' | 'expert' | 'duo';
type Plateau = (number | null)[];

const LIGNES: number[][] = (() => {
  const out: number[][] = [];
  for (let l = 0; l < 4; l++) out.push([0, 1, 2, 3].map((k) => l * 4 + k));
  for (let col = 0; col < 4; col++) out.push([0, 1, 2, 3].map((k) => k * 4 + col));
  out.push([0, 5, 10, 15]);
  out.push([3, 6, 9, 12]);
  return out;
})();

/** Quatre pièces forment un quarto si un bit est à 1 partout, ou à 0 partout. */
function ligneGagnante(plateau: Plateau): number[] | null {
  for (const ligne of LIGNES) {
    const pieces = ligne.map((i) => plateau[i]);
    if (pieces.some((p) => p === null)) continue;
    let et = 15;
    let ou = 0;
    for (const p of pieces as number[]) {
      et &= p;
      ou |= p;
    }
    if (et !== 0 || ou !== 15) return ligne;
  }
  return null;
}

function casesVides(plateau: Plateau): number[] {
  const out: number[] = [];
  for (let i = 0; i < 16; i++) if (plateau[i] === null) out.push(i);
  return out;
}

/** Case où poser `piece` gagne immédiatement, s'il en existe une. */
function caseGagnante(plateau: Plateau, piece: number): number | null {
  for (const i of casesVides(plateau)) {
    plateau[i] = piece;
    const gagne = ligneGagnante(plateau) !== null;
    plateau[i] = null;
    if (gagne) return i;
  }
  return null;
}

/**
 * Valeur de la position pour le joueur qui doit poser `piece`.
 * +1 il gagne, −1 il perd, 0 nul ou indéterminé (profondeur épuisée).
 * Le plateau est modifié puis restauré : c'est la version rapide.
 */
function resoudre(plateau: Plateau, reserve: number[], piece: number, profondeur: number): number {
  let meilleur = -2;

  for (const cellule of casesVides(plateau)) {
    plateau[cellule] = piece;

    if (ligneGagnante(plateau)) {
      plateau[cellule] = null;
      return 1;
    }

    let valeur: number;
    if (reserve.length === 0 || profondeur <= 1) {
      valeur = 0; // plus rien à donner, ou horizon atteint
    } else {
      // On cherche le cadeau le plus gênant pour l'adversaire.
      let meilleurCadeau = -2;
      for (let k = 0; k < reserve.length; k++) {
        const reste = reserve.slice(0, k).concat(reserve.slice(k + 1));
        const v = -resoudre(plateau, reste, reserve[k], profondeur - 1);
        if (v > meilleurCadeau) meilleurCadeau = v;
        if (meilleurCadeau === 1) break;
      }
      valeur = meilleurCadeau;
    }

    plateau[cellule] = null;
    if (valeur > meilleur) meilleur = valeur;
    if (meilleur === 1) return 1;
  }

  return meilleur === -2 ? 0 : meilleur;
}

/** Profondeur de recherche exacte, réglée pour rester instantanée. */
function profondeurRecherche(mode: Mode, reserve: number[]): number {
  if (mode === 'facile') return 0;
  if (reserve.length <= 4) return 8;
  if (reserve.length <= 6) return mode === 'expert' ? 4 : 0;
  return 0;
}

/** Combien de lignes cette pièce pourrait-elle encore compléter ? */
function potentiel(plateau: Plateau, piece: number): number {
  let total = 0;
  for (const ligne of LIGNES) {
    const posees = ligne.map((i) => plateau[i]).filter((p): p is number => p !== null);
    if (posees.length === 0 || posees.length === 4) continue;
    let et = piece;
    let ou = piece;
    for (const p of posees) {
      et &= p;
      ou |= p;
    }
    if (et !== 0 || ou !== 15) total += posees.length;
  }
  return total;
}

function choisirPlacement(plateau: Plateau, reserve: number[], piece: number, mode: Mode): number {
  const vides = casesVides(plateau);

  const gagnante = caseGagnante(plateau, piece);
  if (gagnante !== null) return gagnante;
  if (mode === 'facile') return pick(vides);

  const profondeur = profondeurRecherche(mode, reserve);
  if (profondeur > 0 && reserve.length > 0) {
    let meilleure = vides[0];
    let meilleureValeur = -2;
    for (const cellule of shuffle(vides)) {
      plateau[cellule] = piece;
      let valeur = -2;
      for (let k = 0; k < reserve.length; k++) {
        const reste = reserve.slice(0, k).concat(reserve.slice(k + 1));
        const v = -resoudre(plateau, reste, reserve[k], profondeur - 1);
        if (v > valeur) valeur = v;
        if (valeur === 1) break;
      }
      plateau[cellule] = null;
      if (valeur > meilleureValeur) {
        meilleureValeur = valeur;
        meilleure = cellule;
      }
      if (meilleureValeur === 1) break;
    }
    return meilleure;
  }

  // Sinon : poser là où le moins de pièces restantes deviennent gagnantes.
  let meilleure = vides[0];
  let moindreDanger = Infinity;
  for (const cellule of shuffle(vides)) {
    plateau[cellule] = piece;
    const danger = reserve.filter((p) => caseGagnante(plateau, p) !== null).length;
    plateau[cellule] = null;
    if (danger < moindreDanger) {
      moindreDanger = danger;
      meilleure = cellule;
    }
  }
  return meilleure;
}

function choisirCadeau(plateau: Plateau, reserve: number[], mode: Mode): number {
  if (mode === 'facile') return pick(reserve);

  const profondeur = profondeurRecherche(mode, reserve);
  if (profondeur > 0) {
    let meilleur = reserve[0];
    let pire = 2;
    for (const piece of shuffle(reserve)) {
      const reste = reserve.filter((p) => p !== piece);
      const valeur = resoudre(plateau, reste, piece, profondeur);
      if (valeur < pire) {
        pire = valeur;
        meilleur = piece;
      }
      if (pire === -1) break;
    }
    return meilleur;
  }

  // Ne jamais offrir une pièce qui gagne sur-le-champ.
  const sures = reserve.filter((p) => caseGagnante(plateau, p) === null);
  if (sures.length === 0) return pick(reserve);

  let meilleur = sures[0];
  let moindre = Infinity;
  for (const piece of shuffle(sures)) {
    const note = potentiel(plateau, piece);
    if (note < moindre) {
      moindre = note;
      meilleur = piece;
    }
  }
  return meilleur;
}

interface Partie {
  plateau: Plateau;
  reserve: number[];
  enMain: number | null;
  phase: 'donner' | 'placer';
  tour: 0 | 1;
  vainqueur: 0 | 1 | null;
  ligne: number[] | null;
  nulle: boolean;
}

function partieInitiale(): Partie {
  return {
    plateau: Array(16).fill(null),
    reserve: range(16),
    enMain: null,
    phase: 'donner',
    tour: 0,
    vainqueur: null,
    ligne: null,
    nulle: false,
  };
}

function donner(p: Partie, piece: number): Partie {
  return {
    ...p,
    reserve: p.reserve.filter((x) => x !== piece),
    enMain: piece,
    phase: 'placer',
    tour: p.tour === 0 ? 1 : 0,
  };
}

function placer(p: Partie, cellule: number): Partie {
  if (p.enMain === null) return p;
  const plateau = p.plateau.slice();
  plateau[cellule] = p.enMain;
  const ligne = ligneGagnante(plateau);
  return {
    ...p,
    plateau,
    enMain: null,
    phase: 'donner',
    vainqueur: ligne ? p.tour : null,
    ligne,
    nulle: !ligne && p.reserve.length === 0,
  };
}

/** Une pièce dessinée : taille, teinte, forme et creux. */
function Piece({ code, taille }: { code: number; taille: number }) {
  const { radius } = useTheme();
  const grande = (code & GRANDE) !== 0;
  const foncee = (code & FONCEE) !== 0;
  const carree = (code & CARREE) !== 0;
  const creuse = (code & CREUSE) !== 0;

  const cote = taille * (grande ? 0.84 : 0.56);
  const teinte = foncee ? BOIS_FONCE : BOIS_CLAIR;

  return (
    <View
      style={{
        width: cote,
        height: cote,
        borderRadius: carree ? radius.sm * 0.6 : cote,
        backgroundColor: teinte,
        borderWidth: 1.5,
        borderColor: foncee ? '#2E2116' : '#B99154',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {creuse ? (
        <View
          style={{
            width: cote * 0.38,
            height: cote * 0.38,
            borderRadius: carree ? radius.sm * 0.3 : cote,
            backgroundColor: foncee ? '#2E2116' : '#B99154',
          }}
        />
      ) : null}
    </View>
  );
}

const NOM_PIECE = (code: number) =>
  [
    (code & GRANDE) !== 0 ? 'grande' : 'petite',
    (code & FONCEE) !== 0 ? 'foncée' : 'claire',
    (code & CARREE) !== 0 ? 'carrée' : 'ronde',
    (code & CREUSE) !== 0 ? 'creuse' : 'pleine',
  ].join(' ');

export default function Quarto({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(48, 0.38);
  const cellule = Math.floor(largeur / 4);

  const [mode, setMode] = useState<Mode>('normal');
  const [partie, setPartie] = useState<Partie>(partieInitiale);
  const [comptee, setComptee] = useState(false);

  const fini = partie.vainqueur !== null || partie.nulle;
  const soloHumain = mode !== 'duo';

  const reset = useCallback(() => {
    setPartie(partieInitiale());
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    if (partie.nulle) {
      haptic('warning');
      if (soloHumain) submitResult('draw');
      return;
    }
    const humain = partie.vainqueur === 0;
    haptic(humain || !soloHumain ? 'success' : 'error');
    if (soloHumain) submitResult(humain ? 'win' : 'loss');
  }, [fini, comptee, partie.nulle, partie.vainqueur, soloHumain, haptic, submitResult]);

  useEffect(() => {
    if (!soloHumain || fini || partie.tour !== 1) return;
    const id = setTimeout(() => {
      setPartie((p) => {
        if (p.tour !== 1 || p.vainqueur !== null || p.nulle) return p;
        if (p.phase === 'placer' && p.enMain !== null) {
          return placer(p, choisirPlacement(p.plateau.slice(), p.reserve, p.enMain, mode));
        }
        if (p.reserve.length === 0) return p;
        return donner(p, choisirCadeau(p.plateau.slice(), p.reserve, mode));
      });
    }, 420);
    return () => clearTimeout(id);
  }, [partie, mode, soloHumain, fini]);

  const monTour = !soloHumain || partie.tour === 0;

  const toucherCase = (cellule2: number) => {
    if (fini || !monTour || partie.phase !== 'placer' || partie.plateau[cellule2] !== null) return;
    haptic('light');
    setPartie((p) => placer(p, cellule2));
  };

  const toucherPiece = (piece: number) => {
    if (fini || !monTour || partie.phase !== 'donner') return;
    haptic('light');
    setPartie((p) => donner(p, piece));
  };

  /** Sujet et verbe accordés : « Tu choisis », « L’ordinateur choisit ». */
  const phrase = (n: 0 | 1, deuxieme: string, troisieme: string) =>
    soloHumain && n === 0
      ? `Tu ${deuxieme}`
      : `${soloHumain ? 'L’ordinateur' : `Le joueur ${n + 1}`} ${troisieme}`;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini
          ? partie.nulle
            ? 'Match nul'
            : phrase(partie.vainqueur as 0 | 1, 'gagnes', 'gagne')
          : partie.phase === 'donner'
            ? phrase(partie.tour, 'choisis la pièce', 'choisit la pièce')
            : phrase(partie.tour, 'poses la pièce', 'pose la pièce')}
      </Txt>
      <Txt variant="label" tone="faint">
        {partie.reserve.length} en réserve
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: space.md, paddingTop: space.sm }}>
      <View style={{ width: Math.max(cellule * 4, 260) }}>
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

      <Row gap={space.md} style={{ minHeight: 64 }}>
        <Txt variant="label" tone="faint">
          PIÈCE À POSER
        </Txt>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.md,
            borderWidth: 2,
            borderStyle: partie.enMain === null ? 'dashed' : 'solid',
            borderColor: partie.enMain === null ? c.border : ACCENT,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: partie.enMain === null ? 'transparent' : `${ACCENT}18`,
          }}
        >
          {partie.enMain !== null ? <Piece code={partie.enMain} taille={50} /> : null}
        </View>
      </Row>

      <View
        style={{
          width: cellule * 4,
          height: cellule * 4,
          flexDirection: 'row',
          flexWrap: 'wrap',
          backgroundColor: c.boardLight,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        {partie.plateau.map((code, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={
              code === null ? `Case ${i + 1} libre` : `Case ${i + 1} : pièce ${NOM_PIECE(code)}`
            }
            onPress={() => toucherCase(i)}
            style={{
              width: cellule,
              height: cellule,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 0.5,
              borderColor: '#00000033',
              backgroundColor: partie.ligne?.includes(i) ? `${ACCENT}66` : 'transparent',
            }}
          >
            {code !== null ? <Piece code={code} taille={cellule} /> : null}
          </Pressable>
        ))}
      </View>

      <Txt variant="caption" tone="faint" center>
        {fini
          ? 'Partie terminée'
          : !monTour
            ? 'L’ordinateur réfléchit…'
            : partie.phase === 'donner'
              ? 'Choisis la pièce que l’adversaire devra poser'
              : 'Pose la pièce sur une case libre'}
      </Txt>

      <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center', maxWidth: 360 }}>
        {range(16).map((code) => {
          const disponible = partie.reserve.includes(code);
          if (!disponible) return null;
          return (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityLabel={`Donner la pièce ${NOM_PIECE(code)}`}
              onPress={() => toucherPiece(code)}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? c.surfacePressed : c.surfaceAlt,
                opacity: monTour && partie.phase === 'donner' && !fini ? 1 : 0.45,
              })}
            >
              <Piece code={code} taille={38} />
            </Pressable>
          );
        })}
      </Row>

      <GameOver
        visible={fini}
        outcome={partie.nulle ? 'draw' : !soloHumain || partie.vainqueur === 0 ? 'win' : 'loss'}
        title={
          partie.nulle
            ? 'Les seize pièces sont posées'
            : soloHumain
              ? partie.vainqueur === 0
                ? 'Quarto !'
                : 'L’ordinateur annonce quarto'
              : `Quarto pour le joueur ${(partie.vainqueur ?? 0) + 1}`
        }
        detail={partie.ligne ? 'Quatre pièces partagent un même trait' : undefined}
        accent={ACCENT}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
