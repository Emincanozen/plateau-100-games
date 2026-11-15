import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Segmented, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'cochon',
  name: 'Cochon',
  tagline: 'Relance pour accumuler, mais un seul 1 et tu perds tout.',
  category: 'des',
  emoji: '🐷',
  difficulty: 1,
  players: '1-2',
  minutes: 6,
  score: 'none',
  tags: ['dés', 'prise de risque', 'duo'],
  rules: [
    'À ton tour, lance le dé autant de fois que tu veux : chaque résultat s’ajoute à ta cagnotte.',
    'Si tu tires un 1, ta cagnotte du tour est perdue et la main passe à l’adversaire.',
    'Tu peux t’arrêter quand tu veux : la cagnotte est alors ajoutée à ton total.',
    'Le premier à cent points gagne. Tout le jeu tient dans le choix du moment où s’arrêter.',
  ],
};

type Mode = 'prudent' | 'joueur' | 'duo';
const OBJECTIF = 100;

/** Seuil de cagnotte au-delà duquel l'ordinateur s'arrête. */
const SEUIL: Record<Mode, number> = { prudent: 16, joueur: 24, duo: 0 };

export default function Cochon({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [mode, setMode] = useState<Mode>('joueur');
  const [totaux, setTotaux] = useState<[number, number]>([0, 0]);
  const [cagnotte, setCagnotte] = useState(0);
  const [de, setDe] = useState(1);
  const [tour, setTour] = useState<0 | 1>(0);
  const [message, setMessage] = useState('À toi de lancer');
  const [lance, setLance] = useState(false);
  const comptee = useRef(false);

  const gagnant = totaux[0] >= OBJECTIF ? 0 : totaux[1] >= OBJECTIF ? 1 : null;
  const fini = gagnant !== null;

  const reset = useCallback(() => {
    setTotaux([0, 0]);
    setCagnotte(0);
    setDe(1);
    setTour(0);
    setMessage('À toi de lancer');
    setLance(false);
    comptee.current = false;
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagnant === 0 ? 'success' : 'error');
    if (mode !== 'duo') submitResult(gagnant === 0 ? 'win' : 'loss');
  }, [fini, gagnant, mode, haptic, submitResult]);

  const lancer = useCallback(
    (joueur: 0 | 1) => {
      const valeur = randBetween(1, 6);
      setDe(valeur);
      setLance(true);

      if (valeur === 1) {
        haptic('error');
        setCagnotte(0);
        setTour(joueur === 0 ? 1 : 0);
        setMessage(joueur === 0 ? 'Un ! Tu perds ta cagnotte' : 'L’ordinateur tire un 1');
        return 0;
      }
      haptic('light');
      setCagnotte((cag) => cag + valeur);
      return valeur;
    },
    [haptic],
  );

  const arreter = useCallback(
    (joueur: 0 | 1, montant: number) => {
      setTotaux((t) => {
        const copie: [number, number] = [...t];
        copie[joueur] += montant;
        return copie;
      });
      setCagnotte(0);
      setTour(joueur === 0 ? 1 : 0);
      setMessage(joueur === 0 ? `Tu encaisses ${montant}` : `L’ordinateur encaisse ${montant}`);
      haptic('success');
    },
    [haptic],
  );

  // Tour de l'ordinateur : il relance jusqu'à son seuil, ou jusqu'à gagner.
  useEffect(() => {
    if (mode === 'duo' || tour !== 1 || fini) return;

    const id = setTimeout(() => {
      const objectifAtteignable = totaux[1] + cagnotte >= OBJECTIF;
      if (objectifAtteignable || cagnotte >= SEUIL[mode]) {
        arreter(1, cagnotte);
        return;
      }
      lancer(1);
    }, 800);

    return () => clearTimeout(id);
  }, [tour, mode, fini, cagnotte, totaux, lancer, arreter]);

  const monTour = mode === 'duo' ? true : tour === 0;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {totaux[0]}
      </Txt>
      <Txt variant="label" tone="faint">
        {mode === 'duo' ? 'Joueur 2' : 'Ordi'} {totaux[1]}
      </Txt>
      <Txt variant="label" tone="warning">
        Cagnotte {cagnotte}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ width: 300 }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'prudent', label: 'Prudent' },
            { value: 'joueur', label: 'Joueur' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent="#A96CF0"
        />
      </View>

      <Row gap={space.xl}>
        <Compteur label={mode === 'duo' ? 'Joueur 1' : 'Toi'} valeur={totaux[0]} actif={tour === 0} />
        <Compteur
          label={mode === 'duo' ? 'Joueur 2' : 'Ordinateur'}
          valeur={totaux[1]}
          actif={tour === 1}
        />
      </Row>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <De valeur={de} taille={92} eteint={!lance} />
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: 8,
            borderRadius: radius.pill,
            backgroundColor: cagnotte > 0 ? '#A96CF022' : c.surfaceAlt,
          }}
        >
          <Txt variant="label" style={{ color: cagnotte > 0 ? '#A96CF0' : c.textFaint }}>
            Cagnotte du tour : {cagnotte}
          </Txt>
        </View>
        <Txt variant="label" tone="dim" center>
          {message}
        </Txt>
      </View>

      <Row gap={space.md}>
        <Button
          label="Lancer"
          accent="#A96CF0"
          disabled={!monTour || fini}
          onPress={() => lancer(tour)}
        />
        <Button
          label={`Encaisser ${cagnotte}`}
          kind="secondary"
          disabled={!monTour || fini || cagnotte === 0}
          onPress={() => arreter(tour, cagnotte)}
        />
      </Row>

      <Txt variant="caption" tone="faint">
        Premier à {OBJECTIF} points
      </Txt>

      <GameOver
        visible={fini}
        outcome={gagnant === 0 ? 'win' : 'loss'}
        title={
          mode === 'duo'
            ? `Joueur ${(gagnant ?? 0) + 1} gagne`
            : gagnant === 0
              ? 'Gagné !'
              : 'L’ordinateur gagne'
        }
        score={`${totaux[0]} – ${totaux[1]}`}
        scoreLabel="Score"
        accent="#A96CF0"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}

function Compteur({ label, valeur, actif }: { label: string; valeur: number; actif: boolean }) {
  const { c, radius, space } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        backgroundColor: actif ? '#A96CF022' : 'transparent',
        borderWidth: 1,
        borderColor: actif ? '#A96CF0' : 'transparent',
        minWidth: 110,
      }}
    >
      <Txt style={{ fontSize: 28, fontWeight: '800', color: actif ? '#A96CF0' : c.textDim }}>
        {valeur}
      </Txt>
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
    </View>
  );
}
