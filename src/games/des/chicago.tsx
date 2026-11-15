import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'chicago',
  name: 'Chicago',
  tagline: 'Onze manches, onze totaux à sortir dans l’ordre.',
  category: 'des',
  emoji: '🏙️',
  difficulty: 1,
  players: '1-2',
  minutes: 5,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['dés', 'famille', 'rapide'],
  rules: [
    'Onze manches. À la première, il faut faire 2 avec deux dés ; à la deuxième, 3 ; et ainsi jusqu’à 12.',
    'Chaque joueur n’a qu’un seul lancer par manche.',
    'Sortir le total demandé rapporte sa valeur en points : un 12 réussi vaut douze points.',
    'Le plus grand total après les onze manches gagne.',
  ],
};

const MANCHES = 11;

export default function Chicago({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [manche, setManche] = useState(0);
  const [mesPoints, setMesPoints] = useState(0);
  const [sesPoints, setSesPoints] = useState(0);
  const [mesDes, setMesDes] = useState<[number, number]>([1, 1]);
  const [sesDes, setSesDes] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState('Sors un 2 pour commencer');
  const [lance, setLance] = useState(false);
  const [record, setRecord] = useState(false);
  const comptee = useRef(false);

  const cible = manche + 2;
  const fini = manche >= MANCHES;

  const reset = useCallback(() => {
    setManche(0);
    setMesPoints(0);
    setSesPoints(0);
    setMesDes([1, 1]);
    setSesDes(null);
    setMessage('Sors un 2 pour commencer');
    setLance(false);
    setRecord(false);
    comptee.current = false;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(mesPoints >= sesPoints ? 'success' : 'error');
    setRecord(submitScore(mesPoints));
  }, [fini, mesPoints, sesPoints, haptic, submitScore]);

  const jouerLaManche = () => {
    if (lance || fini) return;
    haptic('medium');

    const mien: [number, number] = [randBetween(1, 6), randBetween(1, 6)];
    const sien: [number, number] = [randBetween(1, 6), randBetween(1, 6)];
    setMesDes(mien);
    setSesDes(sien);
    setLance(true);

    const monTotal = mien[0] + mien[1];
    const sonTotal = sien[0] + sien[1];
    const jeReussis = monTotal === cible;
    const ilReussit = sonTotal === cible;

    if (jeReussis) setMesPoints((p) => p + cible);
    if (ilReussit) setSesPoints((p) => p + cible);

    setMessage(
      jeReussis && ilReussit
        ? `${cible} pour les deux ! Chacun marque ${cible}`
        : jeReussis
          ? `${cible} ! Tu marques ${cible} points`
          : ilReussit
            ? `L’ordinateur sort le ${cible} et marque`
            : `Ni l’un ni l’autre : il fallait ${cible}`,
    );
    haptic(jeReussis ? 'success' : 'warning');
  };

  const mancheSuivante = () => {
    setManche((m) => m + 1);
    setLance(false);
    setSesDes(null);
    setMessage(`Il faut maintenant sortir ${manche + 3}`);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {mesPoints}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {sesPoints}
      </Txt>
      <Txt variant="label" tone="warning">
        Manche {Math.min(manche + 1, MANCHES)}/{MANCHES}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <Txt variant="caption" tone="faint">
          TOTAL À SORTIR
        </Txt>
        <Txt style={{ fontSize: 56, fontWeight: '800', color: '#A96CF0' }}>{fini ? '—' : cible}</Txt>
      </View>

      <View style={{ alignItems: 'center', gap: space.sm, minHeight: 92 }}>
        <Txt variant="caption" tone="faint">
          ORDINATEUR
        </Txt>
        {sesDes ? (
          <Row gap={space.sm}>
            <De valeur={sesDes[0]} taille={44} tint="#E0525F" />
            <De valeur={sesDes[1]} taille={44} tint="#E0525F" />
          </Row>
        ) : (
          <Txt variant="label" tone="faint">
            —
          </Txt>
        )}
      </View>

      <Txt variant="h3" center tone="dim">
        {message}
      </Txt>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Row gap={space.md}>
          <De valeur={mesDes[0]} taille={66} eteint={!lance} />
          <De valeur={mesDes[1]} taille={66} eteint={!lance} />
        </Row>
        <Txt variant="caption" tone="faint">
          TOI · total {lance ? mesDes[0] + mesDes[1] : '—'}
        </Txt>
      </View>

      {lance && !fini ? (
        <Button label="Manche suivante" accent="#A96CF0" onPress={mancheSuivante} />
      ) : (
        <Button
          label={fini ? 'Partie terminée' : `Lancer pour faire ${cible}`}
          accent="#A96CF0"
          disabled={fini}
          onPress={jouerLaManche}
        />
      )}

      <GameOver
        visible={fini}
        outcome={mesPoints > sesPoints ? 'win' : mesPoints === sesPoints ? 'draw' : 'loss'}
        title={
          mesPoints > sesPoints
            ? 'Gagné !'
            : mesPoints === sesPoints
              ? 'Égalité'
              : 'L’ordinateur l’emporte'
        }
        score={mesPoints}
        best={best}
        isRecord={record}
        detail={`${mesPoints} contre ${sesPoints}`}
        accent="#A96CF0"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
