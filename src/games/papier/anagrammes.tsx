import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Txt, GameOver } from '@/ui';
import { formatClock, useInterval } from '../lib/hooks';
import { MOTS_COURANTS } from '../lib/mots';
import { pick, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'anagrammes',
  name: 'Anagrammes',
  tagline: 'Les lettres sont là, dans le désordre. Remets-les d’aplomb.',
  category: 'papier',
  emoji: '🔤',
  difficulty: 2,
  players: '1',
  minutes: 4,
  score: 'high',
  scoreUnit: 'mots',
  tags: ['mots', 'rapidité', 'solo'],
  rules: [
    'Les lettres d’un mot sont mélangées. Touche-les dans le bon ordre pour le reconstituer.',
    'Touche une lettre déjà posée pour la reprendre.',
    'Un indice est affiché sous les lettres. Passer un mot coûte cinq secondes.',
    'Quatre-vingt-dix secondes au total : enchaîne le plus de mots possible.',
  ],
};

const DUREE = 90;

interface Lettre {
  id: number;
  caractere: string;
}

export default function Anagrammes({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [entree, setEntree] = useState(() => pick(MOTS_COURANTS));
  const [disponibles, setDisponibles] = useState<Lettre[]>([]);
  const [posees, setPosees] = useState<Lettre[]>([]);
  const [trouves, setTrouves] = useState(0);
  const [restant, setRestant] = useState(DUREE);
  const [message, setMessage] = useState('');
  const [record, setRecord] = useState(false);
  const comptee = useRef(false);

  const fini = restant <= 0;
  const proposition = posees.map((l) => l.caractere).join('');

  const nouveauMot = useCallback(() => {
    setEntree((precedent) => {
      let suivant = pick(MOTS_COURANTS);
      // On évite de retomber sur le même mot, et on écarte les trop longs.
      let essais = 0;
      while ((suivant.mot === precedent.mot || suivant.mot.length > 8) && essais < 30) {
        suivant = pick(MOTS_COURANTS);
        essais += 1;
      }
      return suivant;
    });
  }, []);

  // À chaque nouveau mot, on remélange les lettres.
  useEffect(() => {
    const lettres = entree.mot.split('').map((caractere, id) => ({ id, caractere }));
    let melangees = shuffle(lettres);
    // Un mélange qui redonne le mot d'origine gâcherait l'exercice.
    if (melangees.map((l) => l.caractere).join('') === entree.mot) {
      melangees = melangees.slice().reverse();
    }
    setDisponibles(melangees);
    setPosees([]);
  }, [entree]);

  const reset = useCallback(() => {
    setTrouves(0);
    setRestant(DUREE);
    setMessage('');
    setRecord(false);
    comptee.current = false;
    nouveauMot();
  }, [nouveauMot]);

  useFrameRestart(reset);

  useInterval(() => setRestant((s) => Math.max(0, s - 1)), fini ? null : 1000);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic('success');
    setRecord(submitScore(trouves));
  }, [fini, trouves, haptic, submitScore]);

  // Validation dès que le mot est complet.
  useEffect(() => {
    if (fini || posees.length !== entree.mot.length) return;
    if (proposition === entree.mot) {
      haptic('success');
      setTrouves((n) => n + 1);
      setMessage(`${entree.mot} — bien vu !`);
      const id = setTimeout(nouveauMot, 700);
      return () => clearTimeout(id);
    }
    haptic('error');
    setMessage('Ce n’est pas le bon mot');
  }, [posees.length, proposition, entree.mot, fini, haptic, nouveauMot]);

  const poser = (lettre: Lettre) => {
    if (fini) return;
    haptic('light');
    setMessage('');
    setDisponibles((d) => d.filter((l) => l.id !== lettre.id));
    setPosees((p) => [...p, lettre]);
  };

  const reprendre = (lettre: Lettre) => {
    if (fini) return;
    haptic('light');
    setMessage('');
    setPosees((p) => p.filter((l) => l.id !== lettre.id));
    setDisponibles((d) => [...d, lettre]);
  };

  const passer = () => {
    if (fini) return;
    haptic('warning');
    setRestant((s) => Math.max(0, s - 5));
    setMessage(`C’était ${entree.mot}`);
    nouveauMot();
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {trouves} mots
      </Txt>
      <Txt variant="label" tone={restant <= 15 ? 'danger' : 'faint'}>
        {formatClock(restant)}
      </Txt>
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
          TON MOT
        </Txt>
        <Row gap={5} style={{ minHeight: 56, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Array.from({ length: entree.mot.length }, (_, i) => {
            const lettre = posees[i];
            return lettre ? (
              <Pressable
                key={lettre.id}
                accessibilityRole="button"
                accessibilityLabel={`Reprendre ${lettre.caractere}`}
                onPress={() => reprendre(lettre)}
                style={{
                  width: 38,
                  height: 48,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#4BC4D6',
                }}
              >
                <Txt style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF' }}>
                  {lettre.caractere}
                </Txt>
              </Pressable>
            ) : (
              <View
                key={`vide${i}`}
                style={{
                  width: 38,
                  height: 48,
                  borderRadius: radius.sm,
                  borderWidth: 2,
                  borderColor: c.border,
                  borderStyle: 'dashed',
                }}
              />
            );
          })}
        </Row>
      </View>

      <Txt variant="label" tone={message.includes('bien vu') ? 'success' : 'dim'} center>
        {message || `Indice : ${entree.indice}`}
      </Txt>

      <Row gap={6} style={{ justifyContent: 'center', flexWrap: 'wrap', maxWidth: 320 }}>
        {disponibles.map((lettre) => (
          <Pressable
            key={lettre.id}
            accessibilityRole="button"
            accessibilityLabel={`Poser ${lettre.caractere}`}
            onPress={() => poser(lettre)}
            style={({ pressed }) => ({
              width: 44,
              height: 54,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? c.surfacePressed : c.surface,
              borderWidth: 1.5,
              borderColor: c.border,
            })}
          >
            <Txt style={{ fontSize: 24, fontWeight: '800' }}>{lettre.caractere}</Txt>
          </Pressable>
        ))}
      </Row>

      <Button label="Passer (−5 s)" kind="secondary" size="sm" disabled={fini} onPress={passer} />

      <GameOver
        visible={fini}
        outcome="over"
        title="Temps écoulé"
        score={trouves}
        scoreLabel="Mots trouvés"
        best={best}
        isRecord={record}
        accent="#4BC4D6"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
