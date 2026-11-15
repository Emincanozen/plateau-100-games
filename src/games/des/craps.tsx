import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'craps',
  name: 'Craps',
  tagline: 'Sept ou onze et tu gagnes. Sinon, il faut refaire son point.',
  category: 'des',
  emoji: '🎲',
  difficulty: 1,
  players: '1',
  minutes: 6,
  score: 'high',
  scoreUnit: 'jetons',
  tags: ['casino', 'dés', 'hasard'],
  rules: [
    'Premier lancer, dit « sortie » : 7 ou 11 gagnent tout de suite, 2, 3 et 12 perdent.',
    'Tout autre total devient ton point : il faut le refaire avant de sortir un 7.',
    'La mise « passe » suit ce schéma ; la mise « ne passe pas » parie exactement l’inverse.',
    'Tu commences avec cent jetons. Le score retenu est le plus haut tapis atteint.',
  ],
};

type Phase = 'sortie' | 'point';
type Pari = 'passe' | 'ne-passe-pas';

const MISES = [5, 10, 25, 50];

export default function Craps({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [jetons, setJetons] = useState(100);
  const [mise, setMise] = useState(10);
  const [pari, setPari] = useState<Pari>('passe');
  const [phase, setPhase] = useState<Phase>('sortie');
  const [point, setPoint] = useState<number | null>(null);
  const [des, setDes] = useState<[number, number]>([1, 1]);
  const [message, setMessage] = useState('Choisis ta mise et lance');
  const [engage, setEngage] = useState(false);
  const record = useRef(100);

  const total = des[0] + des[1];

  const reset = useCallback(() => {
    setJetons(100);
    setMise(10);
    setPari('passe');
    setPhase('sortie');
    setPoint(null);
    setDes([1, 1]);
    setMessage('Choisis ta mise et lance');
    setEngage(false);
    record.current = 100;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (jetons > record.current) {
      record.current = jetons;
      submitScore(jetons);
    }
  }, [jetons, submitScore]);

  const gagner = (montant: number, texte: string) => {
    setJetons((j) => j + montant);
    setMessage(texte);
    haptic('success');
    setPhase('sortie');
    setPoint(null);
    setEngage(false);
  };

  const perdre = (texte: string) => {
    setMessage(texte);
    haptic('error');
    setPhase('sortie');
    setPoint(null);
    setEngage(false);
  };

  const lancer = () => {
    if (jetons < mise && !engage) return;

    const tirage: [number, number] = [randBetween(1, 6), randBetween(1, 6)];
    setDes(tirage);
    const somme = tirage[0] + tirage[1];
    haptic('medium');

    if (phase === 'sortie') {
      // La mise est prélevée au lancer de sortie.
      setJetons((j) => j - mise);
      setEngage(true);

      if (somme === 7 || somme === 11) {
        if (pari === 'passe') gagner(mise * 2, `${somme} — passe gagne !`);
        else perdre(`${somme} — ne passe pas perd`);
        return;
      }
      if (somme === 2 || somme === 3) {
        if (pari === 'ne-passe-pas') gagner(mise * 2, `${somme} — ne passe pas gagne !`);
        else perdre(`${somme} — craps, passe perd`);
        return;
      }
      if (somme === 12) {
        // Le 12 est un « barré » : la mise ne passe pas est rendue.
        if (pari === 'ne-passe-pas') gagner(mise, '12 — barré, mise rendue');
        else perdre('12 — craps, passe perd');
        return;
      }

      setPoint(somme);
      setPhase('point');
      setMessage(`Ton point est ${somme}. Refais-le avant un 7.`);
      return;
    }

    // Phase de point.
    if (somme === point) {
      if (pari === 'passe') gagner(mise * 2, `${somme} — point refait, gagné !`);
      else perdre(`${somme} — point refait, ne passe pas perd`);
      return;
    }
    if (somme === 7) {
      if (pari === 'ne-passe-pas') gagner(mise * 2, '7 — ne passe pas gagne !');
      else perdre('7 avant le point — perdu');
      return;
    }
    setMessage(`${somme} — on relance, le point reste ${point}`);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {jetons} jetons
      </Txt>
      {point ? (
        <Txt variant="label" tone="warning">
          point {point}
        </Txt>
      ) : null}
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          {phase === 'sortie' ? 'LANCER DE SORTIE' : `POINT À REFAIRE : ${point}`}
        </Txt>
        <Row gap={space.md}>
          <De valeur={des[0]} taille={78} />
          <De valeur={des[1]} taille={78} />
        </Row>
        <Txt style={{ fontSize: 34, fontWeight: '800', color: '#A96CF0' }}>{total}</Txt>
      </View>

      <Txt variant="h3" center tone="dim">
        {message}
      </Txt>

      <View style={{ gap: space.md, alignItems: 'center' }}>
        <Row gap={space.sm}>
          <Button
            label="Passe"
            size="sm"
            kind={pari === 'passe' ? 'primary' : 'secondary'}
            accent="#A96CF0"
            disabled={engage}
            onPress={() => setPari('passe')}
          />
          <Button
            label="Ne passe pas"
            size="sm"
            kind={pari === 'ne-passe-pas' ? 'primary' : 'secondary'}
            accent="#A96CF0"
            disabled={engage}
            onPress={() => setPari('ne-passe-pas')}
          />
        </Row>

        <Row gap={space.sm}>
          {MISES.map((montant) => (
            <Button
              key={montant}
              label={`${montant}`}
              size="sm"
              kind={mise === montant ? 'primary' : 'secondary'}
              accent="#A96CF0"
              disabled={engage || montant > jetons}
              onPress={() => setMise(montant)}
            />
          ))}
        </Row>

        <Button
          label={
            jetons < mise && !engage
              ? 'Plus assez de jetons — recommencer'
              : phase === 'sortie'
                ? `Lancer (mise ${mise})`
                : 'Relancer'
          }
          full
          accent="#A96CF0"
          onPress={jetons < mise && !engage ? reset : lancer}
        />
      </View>
    </View>
  );
}
