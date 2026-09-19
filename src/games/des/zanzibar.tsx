import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'zanzibar',
  name: 'Zanzibar',
  tagline: 'Trois dés, trois lancers. Le 4-5-6 bat tout le reste.',
  category: 'des',
  emoji: '🏝️',
  difficulty: 2,
  players: '1',
  minutes: 7,
  score: 'none',
  tags: ['dés', 'bistrot', 'combinaisons'],
  rules: [
    'Tu disposes de trois lancers ; touche un dé pour le garder entre deux jets.',
    'La hiérarchie : 4-5-6 d’abord, puis les brelans, puis les paires, puis la somme la plus forte.',
    'Le premier joueur fixe le nombre de lancers ; l’adversaire ne peut pas en prendre davantage.',
    'Le perdant de la manche prend un jeton. Trois jetons et la partie est perdue.',
  ],
};

type Des = [number, number, number];

const lancerTrois = (): Des => [randBetween(1, 6), randBetween(1, 6), randBetween(1, 6)];

/** Valeur d'une main : plus le rang est haut, plus la main est forte. */
export function evaluerZanzibar(des: Des): { rang: number; nom: string } {
  const tri = [...des].sort((a, b) => b - a);
  const [a, b, c] = tri;

  if (a === 6 && b === 5 && c === 4) return { rang: 10000, nom: 'Zanzibar (4-5-6)' };
  if (a === b && b === c) return { rang: 9000 + a, nom: `Brelan de ${a}` };
  if (a === 1 && b === 2 && c === 3) return { rang: 8000, nom: 'Petite suite (1-2-3)' };

  // Paires : la valeur de la paire prime, le dé isolé départage.
  if (a === b) return { rang: 5000 + a * 10 + c, nom: `Paire de ${a}` };
  if (b === c) return { rang: 5000 + b * 10 + a, nom: `Paire de ${b}` };

  return { rang: a * 100 + b * 10 + c, nom: `${a}-${b}-${c}` };
}

const JETONS_MAX = 3;

export default function Zanzibar({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [mesDes, setMesDes] = useState<Des>(lancerTrois);
  const [gardes, setGardes] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [lancersFaits, setLancersFaits] = useState(1);
  const [sesDes, setSesDes] = useState<Des | null>(null);
  const [mesJetons, setMesJetons] = useState(0);
  const [sesJetons, setSesJetons] = useState(0);
  const [message, setMessage] = useState('Garde ce qui t’arrange, puis relance');
  const [mancheFinie, setMancheFinie] = useState(false);
  const comptee = useRef(false);

  const maMain = useMemo(() => evaluerZanzibar(mesDes), [mesDes]);
  const fini = mesJetons >= JETONS_MAX || sesJetons >= JETONS_MAX;
  const gagne = sesJetons >= JETONS_MAX;

  const nouvelleManche = useCallback(() => {
    setMesDes(lancerTrois());
    setGardes([false, false, false]);
    setLancersFaits(1);
    setSesDes(null);
    setMancheFinie(false);
    setMessage('Garde ce qui t’arrange, puis relance');
  }, []);

  const reset = useCallback(() => {
    setMesJetons(0);
    setSesJetons(0);
    comptee.current = false;
    nouvelleManche();
  }, [nouvelleManche]);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    submitResult(gagne ? 'win' : 'loss');
  }, [fini, gagne, haptic, submitResult]);

  const relancer = () => {
    if (lancersFaits >= 3 || mancheFinie || fini) return;
    haptic('medium');
    setMesDes((d) => d.map((valeur, i) => (gardes[i] ? valeur : randBetween(1, 6))) as Des);
    setLancersFaits((n) => n + 1);
  };

  const conclure = () => {
    if (mancheFinie || fini) return;
    haptic('medium');

    // L'ordinateur joue avec le même nombre de lancers, au maximum.
    let sienne = lancerTrois();
    for (let tour = 1; tour < lancersFaits; tour++) {
      const actuelle = evaluerZanzibar(sienne);
      if (actuelle.rang >= 9000) break; // il garde un brelan ou mieux
      // Il garde ses plus gros dés et relance le reste.
      const seuil = actuelle.rang >= 5000 ? 0 : 4;
      sienne = sienne.map((valeur) => (valeur >= seuil ? valeur : randBetween(1, 6))) as Des;
    }

    setSesDes(sienne);
    setMancheFinie(true);

    const saMain = evaluerZanzibar(sienne);
    if (maMain.rang === saMain.rang) {
      setMessage(`Égalité sur ${maMain.nom} — personne ne prend de jeton`);
      haptic('warning');
    } else if (maMain.rang > saMain.rang) {
      setSesJetons((j) => j + 1);
      setMessage(`${maMain.nom} bat ${saMain.nom} — l’ordinateur prend un jeton`);
      haptic('success');
    } else {
      setMesJetons((j) => j + 1);
      setMessage(`${saMain.nom} bat ${maMain.nom} — tu prends un jeton`);
      haptic('error');
    }
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="danger">
        {'●'.repeat(mesJetons)}
        {'○'.repeat(Math.max(0, JETONS_MAX - mesJetons))}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {'●'.repeat(sesJetons)}
        {'○'.repeat(Math.max(0, JETONS_MAX - sesJetons))}
      </Txt>
      <Txt variant="label" tone="dim">
        lancer {lancersFaits}/3
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.sm, minHeight: 110 }}>
        <Txt variant="caption" tone="faint">
          ORDINATEUR
        </Txt>
        {sesDes ? (
          <>
            <Row gap={space.sm}>
              {sesDes.map((valeur, i) => (
                <De key={i} valeur={valeur} taille={48} tint="#E0525F" />
              ))}
            </Row>
            <Txt variant="label" tone="faint">
              {evaluerZanzibar(sesDes).nom}
            </Txt>
          </>
        ) : (
          <Txt variant="label" tone="faint">
            Il jouera après toi
          </Txt>
        )}
      </View>

      <Txt variant="label" tone="dim" center>
        {message}
      </Txt>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <Row gap={space.md}>
          {mesDes.map((valeur, i) => (
            <De
              key={i}
              valeur={valeur}
              taille={70}
              garde={gardes[i]}
              onPress={
                mancheFinie || fini
                  ? undefined
                  : () =>
                      setGardes(
                        (g) => g.map((v, k) => (k === i ? !v : v)) as [boolean, boolean, boolean],
                      )
              }
            />
          ))}
        </Row>
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: 6,
            borderRadius: radius.pill,
            backgroundColor: c.surfaceAlt,
          }}
        >
          <Txt variant="label" style={{ color: '#A96CF0' }}>
            {maMain.nom}
          </Txt>
        </View>
      </View>

      {mancheFinie ? (
        <Button label="Manche suivante" accent="#A96CF0" disabled={fini} onPress={nouvelleManche} />
      ) : (
        <Row gap={space.md}>
          <Button
            label={lancersFaits < 3 ? `Relancer (${3 - lancersFaits})` : 'Plus de lancer'}
            accent="#A96CF0"
            disabled={lancersFaits >= 3 || fini}
            onPress={relancer}
          />
          <Button label="Comparer" kind="secondary" disabled={fini} onPress={conclure} />
        </Row>
      )}

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'L’ordinateur a trois jetons !' : 'Tu as trois jetons'}
        detail="Le premier à trois jetons a perdu."
        accent="#A96CF0"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
