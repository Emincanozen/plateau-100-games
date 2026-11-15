import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Segmented, Txt, GameOver } from '@/ui';
import { pick, randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'allumettes',
  name: 'Allumettes',
  tagline: 'Le jeu de Nim : ne prends surtout pas la dernière.',
  category: 'papier',
  emoji: '🔥',
  difficulty: 2,
  players: '1-2',
  minutes: 3,
  score: 'none',
  tags: ['stratégie', 'duo', 'mathématique'],
  rules: [
    'Trois rangées d’allumettes. À ton tour, retire autant d’allumettes que tu veux, mais d’une seule rangée.',
    'Touche une allumette : tout ce qui est à sa droite dans la rangée part avec elle.',
    'Celui qui retire la dernière allumette perd la partie.',
    'En mode Expert, l’ordinateur joue la stratégie mathématique parfaite : il ne se trompe jamais.',
  ],
};

type Rangees = number[];
type Mode = 'facile' | 'expert' | 'duo';

const DEPART: Rangees = [3, 5, 7];

/**
 * Nim misere : le coup gagnant annule le XOR des rangees,
 * sauf en fin de partie ou il faut laisser un nombre impair de rangees a 1.
 */
function coupOrdinateur(rangees: Rangees): { rangee: number; retirer: number } {
  const grandes = rangees.filter((n) => n > 1).length;
  const nonVides = rangees.filter((n) => n > 0).length;

  // Fin de partie : il ne reste que des rangees de 1.
  if (grandes === 0) {
    const index = rangees.findIndex((n) => n > 0);
    return { rangee: index, retirer: 1 };
  }

  // Une seule rangee de plus d'une allumette : on decide de la parite.
  if (grandes === 1) {
    const index = rangees.findIndex((n) => n > 1);
    const unites = nonVides - 1;
    // On veut laisser un nombre impair de rangees a 1.
    const laisser = unites % 2 === 0 ? 1 : 0;
    return { rangee: index, retirer: rangees[index] - laisser };
  }

  const xor = rangees.reduce((acc, n) => acc ^ n, 0);
  if (xor !== 0) {
    for (let i = 0; i < rangees.length; i++) {
      const cible = rangees[i] ^ xor;
      if (cible < rangees[i]) return { rangee: i, retirer: rangees[i] - cible };
    }
  }

  // Position perdante : on joue un coup minimal en attendant une erreur.
  const possibles = rangees
    .map((n, i) => ({ n, i }))
    .filter((r) => r.n > 0);
  const choix = pick(possibles);
  return { rangee: choix.i, retirer: 1 };
}

function coupFacile(rangees: Rangees): { rangee: number; retirer: number } {
  if (Math.random() < 0.45) return coupOrdinateur(rangees);
  const possibles = rangees.map((n, i) => ({ n, i })).filter((r) => r.n > 0);
  const choix = pick(possibles);
  return { rangee: choix.i, retirer: 1 + randInt(choix.n) };
}

export default function Allumettes({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [mode, setMode] = useState<Mode>('expert');
  const [rangees, setRangees] = useState<Rangees>(DEPART);
  const [tour, setTour] = useState<0 | 1>(0);
  const [comptee, setComptee] = useState(false);

  const total = useMemo(() => rangees.reduce((a, b) => a + b, 0), [rangees]);
  const fini = total === 0;
  // Celui qui prend la derniere allumette perd : le perdant est donc
  // le joueur qui vient de jouer, c'est-a-dire l'autre que `tour`.
  const humainGagne = fini && tour === 0;

  const reset = useCallback(() => {
    setRangees(DEPART);
    setTour(0);
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(humainGagne ? 'success' : 'error');
    if (mode !== 'duo') submitResult(humainGagne ? 'win' : 'loss');
  }, [fini, comptee, humainGagne, mode, haptic, submitResult]);

  // Tour de l'ordinateur.
  useEffect(() => {
    if (mode === 'duo' || tour !== 1 || fini) return;
    const id = setTimeout(() => {
      const coup = mode === 'facile' ? coupFacile(rangees) : coupOrdinateur(rangees);
      setRangees((r) => r.map((n, i) => (i === coup.rangee ? n - coup.retirer : n)));
      setTour(0);
    }, 620);
    return () => clearTimeout(id);
  }, [tour, mode, fini, rangees]);

  const retirer = (rangee: number, position: number) => {
    if (fini) return;
    if (mode !== 'duo' && tour !== 0) return;
    const restantes = rangees[rangee];
    if (position >= restantes) return;
    haptic('medium');
    setRangees((r) => r.map((n, i) => (i === rangee ? position : n)));
    setTour(tour === 0 ? 1 : 0);
  };

  const statut = fini
    ? mode === 'duo'
      ? `Joueur ${tour === 0 ? 1 : 2} gagne`
      : humainGagne
        ? 'Gagné'
        : 'Perdu'
    : mode === 'duo'
      ? `Au joueur ${tour + 1}`
      : tour === 0
        ? 'À toi de jouer'
        : 'L’ordinateur réfléchit…';

  useFrameStatus(
    <Txt variant="label" tone="dim">
      {statut}
    </Txt>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ width: 280 }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'expert', label: 'Expert' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent="#4BC4D6"
        />
      </View>

      <View style={{ gap: space.xl }}>
        {rangees.map((restantes, rangee) => (
          <Row key={rangee} gap={10} style={{ justifyContent: 'center', minHeight: 56 }}>
            {Array.from({ length: DEPART[rangee] }, (_, position) => {
              const presente = position < restantes;
              return (
                <Pressable
                  key={position}
                  accessibilityRole="button"
                  accessibilityLabel={`Rangée ${rangee + 1}, allumette ${position + 1}`}
                  disabled={!presente}
                  onPress={() => retirer(rangee, position)}
                  style={{ opacity: presente ? 1 : 0.12 }}
                >
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: presente ? '#E0525F' : c.borderStrong,
                      }}
                    />
                    <View
                      style={{
                        width: 4,
                        height: 40,
                        borderRadius: 2,
                        backgroundColor: presente ? '#C8A165' : c.borderStrong,
                      }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </Row>
        ))}
      </View>

      <Txt variant="caption" tone="faint" center>
        Touche une allumette : elle part avec toutes celles à sa droite.{'\n'}Celui qui prend la
        dernière a perdu.
      </Txt>

      <GameOver
        visible={fini}
        outcome={mode === 'duo' ? 'win' : humainGagne ? 'win' : 'loss'}
        title={
          mode === 'duo'
            ? `Joueur ${tour === 0 ? 1 : 2} gagne`
            : humainGagne
              ? 'Gagné !'
              : 'L’ordinateur gagne'
        }
        detail="La dernière allumette a été prise."
        accent="#4BC4D6"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
