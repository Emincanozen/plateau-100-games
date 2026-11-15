import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'solitaire-billes',
  name: 'Solitaire à billes',
  tagline: 'Saute par-dessus les billes pour n’en laisser qu’une.',
  category: 'plateau',
  emoji: '🔵',
  difficulty: 3,
  players: '1',
  minutes: 12,
  score: 'low',
  scoreUnit: 'billes',
  tags: ['casse-tête', 'solo', 'classique'],
  rules: [
    'Une bille saute par-dessus une voisine — horizontalement ou verticalement — et retombe dans le trou juste derrière.',
    'La bille sautée est retirée du plateau. Les sauts en diagonale n’existent pas.',
    'Touche une bille pour la choisir : ses arrivées possibles s’allument.',
    'L’objectif est de finir avec une seule bille, idéalement au centre. Le record retenu est le plus petit nombre de billes restantes.',
  ],
};

const N = 7;
const CENTRE = 3 * N + 3;
const ACCENT = '#5B8DEF';

type Forme = 'anglaise' | 'europeenne';

/** Cases appartenant au plateau, selon la forme de la croix. */
function plateauValide(forme: Forme): boolean[] {
  const out: boolean[] = [];
  for (let l = 0; l < N; l++) {
    for (let col = 0; col < N; col++) {
      const croix = (l >= 2 && l <= 4) || (col >= 2 && col <= 4);
      // La croix européenne ajoute les quatre cases en biais des coins.
      const biais = forme === 'europeenne' && (l === 1 || l === 5) && (col === 1 || col === 5);
      out.push(croix || biais);
    }
  }
  return out;
}

function positionDepart(forme: Forme): boolean[] {
  const valide = plateauValide(forme);
  return valide.map((ok, i) => ok && i !== CENTRE);
}

interface Saut {
  depart: number;
  saute: number;
  arrivee: number;
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

function sautsDepuis(billes: boolean[], valide: boolean[], depart: number): Saut[] {
  if (!billes[depart]) return [];
  const l = Math.floor(depart / N);
  const col = depart % N;
  const out: Saut[] = [];

  for (const [dl, dc] of DIRECTIONS) {
    const lm = l + dl;
    const cm = col + dc;
    const la = l + dl * 2;
    const ca = col + dc * 2;
    if (la < 0 || la >= N || ca < 0 || ca >= N) continue;

    const saute = lm * N + cm;
    const arrivee = la * N + ca;
    if (!valide[arrivee] || !billes[saute] || billes[arrivee]) continue;
    out.push({ depart, saute, arrivee });
  }
  return out;
}

function tousLesSauts(billes: boolean[], valide: boolean[]): Saut[] {
  const out: Saut[] = [];
  for (let i = 0; i < billes.length; i++) {
    if (billes[i]) out.push(...sautsDepuis(billes, valide, i));
  }
  return out;
}

export default function SolitaireBilles({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.5);
  const cellule = Math.floor(largeur / N);

  const [forme, setForme] = useState<Forme>('anglaise');
  const valide = useMemo(() => plateauValide(forme), [forme]);

  const [billes, setBilles] = useState<boolean[]>(() => positionDepart('anglaise'));
  const [historique, setHistorique] = useState<boolean[][]>([]);
  const [choisie, setChoisie] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  const comptee = useRef(false);

  const restantes = useMemo(() => billes.filter(Boolean).length, [billes]);
  const sauts = useMemo(() => tousLesSauts(billes, valide), [billes, valide]);
  const bloque = sauts.length === 0;
  const parfait = restantes === 1 && billes[CENTRE];

  const arrivees = useMemo(() => {
    if (choisie === null) return new Map<number, Saut>();
    return new Map(sautsDepuis(billes, valide, choisie).map((s) => [s.arrivee, s]));
  }, [choisie, billes, valide]);

  const reset = useCallback(() => {
    setBilles(positionDepart(forme));
    setHistorique([]);
    setChoisie(null);
    setRecord(false);
    comptee.current = false;
  }, [forme]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [forme, reset]);

  useEffect(() => {
    if (!bloque || comptee.current) return;
    comptee.current = true;
    haptic(restantes === 1 ? 'success' : 'warning');
    setRecord(submitScore(restantes));
  }, [bloque, restantes, haptic, submitScore]);

  const jouer = (saut: Saut) => {
    setHistorique((h) => [...h, billes]);
    const suivant = billes.slice();
    suivant[saut.depart] = false;
    suivant[saut.saute] = false;
    suivant[saut.arrivee] = true;
    setBilles(suivant);
    setChoisie(null);
    haptic('medium');
  };

  const annuler = () => {
    if (historique.length === 0) return;
    haptic('light');
    setBilles(historique[historique.length - 1]);
    setHistorique((h) => h.slice(0, -1));
    setChoisie(null);
    comptee.current = false;
  };

  const toucher = (index: number) => {
    if (bloque) return;

    const saut = arrivees.get(index);
    if (saut) {
      jouer(saut);
      return;
    }
    if (billes[index]) {
      if (sautsDepuis(billes, valide, index).length === 0) {
        haptic('warning');
        return;
      }
      haptic('light');
      setChoisie(choisie === index ? null : index);
      return;
    }
    setChoisie(null);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {restantes} billes
      </Txt>
      <Txt variant="label" tone="faint">
        {sauts.length} sauts possibles
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
      <View style={{ width: Math.max(cellule * N, 260) }}>
        <Segmented<Forme>
          value={forme}
          onChange={setForme}
          options={[
            { value: 'anglaise', label: 'Croix anglaise (33)' },
            { value: 'europeenne', label: 'Européenne (37)' },
          ]}
          accent={ACCENT}
        />
      </View>

      <View
        style={{
          width: cellule * N,
          height: cellule * N,
          flexDirection: 'row',
          flexWrap: 'wrap',
          backgroundColor: c.boardLight,
          borderRadius: radius.lg,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {valide.map((ok, i) => {
          if (!ok) return <View key={i} style={{ width: cellule, height: cellule }} />;

          const bille = billes[i];
          const cible = arrivees.has(i);
          const selectionnee = choisie === i;

          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Case ${Math.floor(i / N) + 1}-${(i % N) + 1}${
                bille ? ', bille' : ', trou vide'
              }`}
              onPress={() => toucher(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: cellule * 0.82,
                  height: cellule * 0.82,
                  borderRadius: cellule,
                  backgroundColor: bille ? ACCENT : cible ? `${ACCENT}44` : '#00000022',
                  borderWidth: selectionnee ? 3 : cible ? 2 : 0,
                  borderColor: selectionnee ? '#FFFFFF' : ACCENT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {bille ? (
                  <View
                    style={{
                      width: cellule * 0.24,
                      height: cellule * 0.24,
                      borderRadius: cellule,
                      backgroundColor: '#FFFFFF44',
                      position: 'absolute',
                      top: cellule * 0.14,
                      left: cellule * 0.16,
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Row gap={space.md}>
        <Button
          label="Annuler"
          kind="secondary"
          size="sm"
          disabled={historique.length === 0}
          onPress={annuler}
        />
        <Button label="Recommencer" kind="ghost" size="sm" onPress={reset} />
      </Row>

      <Txt variant="caption" tone="faint" center>
        {choisie === null
          ? 'Touche une bille qui peut sauter'
          : 'Touche un trou allumé pour y sauter'}
      </Txt>

      <GameOver
        visible={bloque}
        outcome={restantes === 1 ? 'win' : 'over'}
        title={
          parfait
            ? 'Une seule bille, au centre !'
            : restantes === 1
              ? 'Une seule bille restante !'
              : 'Plus aucun saut possible'
        }
        score={restantes}
        scoreLabel="Billes restantes"
        best={best}
        isRecord={record}
        detail={
          parfait
            ? 'La finale parfaite du solitaire.'
            : restantes <= 3
              ? 'Très près du but.'
              : 'Le centre se libère mieux en commençant par les bras de la croix.'
        }
        accent={ACCENT}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
