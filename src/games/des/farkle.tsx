import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'farkle',
  name: 'Farkle',
  tagline: 'Mets de côté, relance, encaisse — ou perds tout d’un coup.',
  category: 'des',
  emoji: '🎰',
  difficulty: 2,
  players: '1',
  minutes: 12,
  score: 'none',
  tags: ['dés', 'prise de risque', 'classique'],
  rules: [
    'Lance six dés. Chaque 1 vaut 100, chaque 5 vaut 50, et un brelan vaut cent fois sa valeur (mille pour les as).',
    'Mets de côté au moins un dé payant, puis relance les autres — ou encaisse.',
    'Si un lancer ne rapporte rien, c’est un farkle : tout ce que tu as accumulé ce tour-ci est perdu.',
    'Les six dés mis de côté te rendent les six dés. Premier à 4 000 points.',
  ],
};

const OBJECTIF = 4000;

/** Points d'un ensemble de dés, et nombre de dés qui ne rapportent rien. */
export function evaluerLancer(des: number[]): { points: number; utilises: number } {
  const comptes = [0, 0, 0, 0, 0, 0, 0];
  des.forEach((d) => (comptes[d] += 1));

  let points = 0;
  let utilises = 0;

  // Suite complète et trois paires : les combinaisons de six dés d'abord.
  if (des.length === 6) {
    if (comptes.slice(1).every((n) => n === 1)) return { points: 1500, utilises: 6 };
    if (comptes.filter((n) => n === 2).length === 3) return { points: 1500, utilises: 6 };
  }

  for (let face = 1; face <= 6; face++) {
    const n = comptes[face];
    if (n >= 3) {
      // Un brelan vaut 100 × la face, sauf les as qui valent 1000.
      const base = face === 1 ? 1000 : face * 100;
      // Chaque dé au-delà du brelan double la valeur.
      points += base * Math.pow(2, n - 3);
      utilises += n;
      comptes[face] = 0;
    }
  }

  points += comptes[1] * 100;
  utilises += comptes[1];
  points += comptes[5] * 50;
  utilises += comptes[5];

  return { points, utilises };
}

const lancer = (nombre: number): number[] =>
  Array.from({ length: nombre }, () => randBetween(1, 6));

export default function Farkle({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [mesPoints, setMesPoints] = useState(0);
  const [sesPoints, setSesPoints] = useState(0);
  const [des, setDes] = useState<number[]>(() => lancer(6));
  const [gardes, setGardes] = useState<boolean[]>([]);
  const [cagnotte, setCagnotte] = useState(0);
  const [aMoi, setAMoi] = useState(true);
  const [message, setMessage] = useState('Mets de côté les dés payants');
  const [farkle, setFarkle] = useState(false);
  const comptee = useRef(false);

  const fini = mesPoints >= OBJECTIF || sesPoints >= OBJECTIF;
  const gagne = mesPoints >= OBJECTIF;

  const selectionnes = useMemo(() => des.filter((_, i) => gardes[i]), [des, gardes]);
  const valeurSelection = useMemo(() => evaluerLancer(selectionnes), [selectionnes]);
  /** La sélection est valable si tous les dés choisis rapportent. */
  const selectionValable =
    selectionnes.length > 0 && valeurSelection.utilises === selectionnes.length;

  const nouveauTour = useCallback((nombre = 6) => {
    const tirage = lancer(nombre);
    setDes(tirage);
    setGardes(Array(nombre).fill(false));
    return tirage;
  }, []);

  const reset = useCallback(() => {
    setMesPoints(0);
    setSesPoints(0);
    setCagnotte(0);
    setAMoi(true);
    setFarkle(false);
    setMessage('Mets de côté les dés payants');
    nouveauTour(6);
    comptee.current = false;
  }, [nouveauTour]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    submitResult(gagne ? 'win' : 'loss');
  }, [fini, gagne, haptic, submitResult]);

  // Détection du farkle : le lancer ne rapporte rien du tout.
  useEffect(() => {
    if (!aMoi || fini || farkle) return;
    if (evaluerLancer(des).points === 0) {
      setFarkle(true);
      setMessage('Farkle ! Ce tour ne rapporte rien');
      haptic('error');
    }
  }, [des, aMoi, fini, farkle, haptic]);

  const relancer = () => {
    if (!selectionValable) return;
    haptic('medium');
    const nouvelle = cagnotte + valeurSelection.points;
    setCagnotte(nouvelle);
    const restants = des.length - selectionnes.length;
    // Tous les dés mis de côté : on repart avec les six.
    nouveauTour(restants === 0 ? 6 : restants);
    setMessage(restants === 0 ? 'Six dés à nouveau !' : `${nouvelle} en jeu`);
  };

  const encaisser = () => {
    if (!selectionValable) return;
    const total = cagnotte + valeurSelection.points;
    haptic('success');
    setMesPoints((p) => p + total);
    setCagnotte(0);
    setMessage(`Tu encaisses ${total}`);
    setAMoi(false);
    nouveauTour(6);
  };

  const passerApresFarkle = () => {
    setFarkle(false);
    setCagnotte(0);
    setAMoi(false);
    nouveauTour(6);
    setMessage('Au tour de l’ordinateur');
  };

  // Tour de l'ordinateur : il garde tout ce qui rapporte et s'arrête à 350.
  useEffect(() => {
    if (aMoi || fini) return;

    const id = setTimeout(() => {
      let accumule = 0;
      let restants = 6;

      while (true) {
        const tirage = lancer(restants);
        const valeur = evaluerLancer(tirage);
        if (valeur.points === 0) {
          accumule = 0;
          setMessage('L’ordinateur fait un farkle');
          break;
        }
        accumule += valeur.points;
        restants = restants - valeur.utilises;
        if (restants === 0) restants = 6;
        // Il s'arrête dès qu'il a de quoi, ou s'il peut gagner.
        if (accumule >= 350 || sesPoints + accumule >= OBJECTIF) {
          setMessage(`L’ordinateur encaisse ${accumule}`);
          break;
        }
      }

      if (accumule > 0) setSesPoints((p) => p + accumule);
      setAMoi(true);
      setFarkle(false);
      nouveauTour(6);
    }, 1100);

    return () => clearTimeout(id);
  }, [aMoi, fini, sesPoints, nouveauTour]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {mesPoints}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {sesPoints}
      </Txt>
      <Txt variant="label" tone="warning">
        +{cagnotte + (selectionValable ? valeurSelection.points : 0)}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.lg }}>
      <Row gap={space.xl}>
        <Compteur label="Toi" valeur={mesPoints} actif={aMoi} />
        <Compteur label="Ordinateur" valeur={sesPoints} actif={!aMoi} />
      </Row>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <Row gap={space.sm} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {des.map((valeur, i) => (
            <De
              key={i}
              valeur={valeur}
              taille={56}
              garde={gardes[i]}
              eteint={!aMoi || farkle}
              onPress={
                aMoi && !farkle && !fini
                  ? () => setGardes((g) => g.map((v, k) => (k === i ? !v : v)))
                  : undefined
              }
            />
          ))}
        </Row>

        <View
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: 6,
            borderRadius: radius.pill,
            backgroundColor: selectionValable ? '#A96CF022' : c.surfaceAlt,
          }}
        >
          <Txt variant="label" style={{ color: selectionValable ? '#A96CF0' : c.textFaint }}>
            {selectionnes.length === 0
              ? 'Sélection vide'
              : selectionValable
                ? `Sélection : ${valeurSelection.points} points`
                : 'Un dé sélectionné ne rapporte rien'}
          </Txt>
        </View>

        <Txt variant="label" tone={farkle ? 'danger' : 'dim'} center>
          {message}
        </Txt>
      </View>

      {farkle ? (
        <Button label="Passer la main" accent="#A96CF0" onPress={passerApresFarkle} />
      ) : (
        <Row gap={space.md}>
          <Button
            label="Relancer"
            accent="#A96CF0"
            disabled={!aMoi || !selectionValable || fini}
            onPress={relancer}
          />
          <Button
            label={`Encaisser ${cagnotte + (selectionValable ? valeurSelection.points : 0)}`}
            kind="secondary"
            disabled={!aMoi || !selectionValable || fini}
            onPress={encaisser}
          />
        </Row>
      )}

      <Txt variant="caption" tone="faint">
        Premier à {OBJECTIF} points · 1 = 100 · 5 = 50 · brelan = 100 × la face
      </Txt>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Gagné !' : 'L’ordinateur atteint l’objectif'}
        score={`${mesPoints} – ${sesPoints}`}
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
        minWidth: 120,
      }}
    >
      <Txt style={{ fontSize: 26, fontWeight: '800', color: actif ? '#A96CF0' : c.textDim }}>
        {valeur}
      </Txt>
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
    </View>
  );
}
