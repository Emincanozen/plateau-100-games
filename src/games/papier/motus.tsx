import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Txt, GameOver } from '@/ui';
import { MOTS_CINQ } from '../lib/mots';
import { comparer, type EtatLettre as Etat } from '../lib/regles';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'motus',
  name: 'Motus',
  tagline: 'Six essais pour trouver le mot de cinq lettres.',
  category: 'papier',
  emoji: '🔤',
  difficulty: 2,
  players: '1',
  minutes: 5,
  score: 'low',
  scoreUnit: 'essais',
  tags: ['mots', 'déduction', 'solo'],
  rules: [
    'Propose un mot de cinq lettres et valide.',
    'Une lettre sur fond vert est bien placée ; sur fond orange elle est dans le mot, mais ailleurs.',
    'Une lettre grise n’est pas dans le mot du tout.',
    'La première lettre est donnée. Tu as six essais.',
  ],
};

const LONGUEUR = 5;
const ESSAIS_MAX = 6;


/** Compare une proposition au mot secret, sans compter deux fois une lettre. */

const CLAVIER = ['AZERTYUIOP'.split(''), 'QSDFGHJKLM'.split(''), 'WXCVBN'.split('')];

export default function Motus({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [secret, setSecret] = useState(() => pick(MOTS_CINQ));
  const [essais, setEssais] = useState<string[]>([]);
  const [saisie, setSaisie] = useState('');
  const [message, setMessage] = useState('');
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const gagne = essais.includes(secret);
  const perdu = !gagne && essais.length >= ESSAIS_MAX;
  const fini = gagne || perdu;

  const reset = useCallback(() => {
    setSecret(pick(MOTS_CINQ));
    setEssais([]);
    setSaisie('');
    setMessage('');
    setRecord(false);
    setComptee(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : 'error');
    if (gagne) setRecord(submitScore(essais.length));
  }, [fini, comptee, gagne, essais.length, haptic, submitScore]);

  /** État connu de chaque lettre du clavier, pour la colorer. */
  const etatsClavier = useMemo(() => {
    const out: Record<string, Etat> = {};
    for (const essai of essais) {
      const etats = comparer(essai, secret);
      essai.split('').forEach((lettre, i) => {
        const actuel = out[lettre];
        const nouveau = etats[i];
        // Une information plus forte écrase la précédente.
        if (actuel === 'juste') return;
        if (actuel === 'present' && nouveau === 'absent') return;
        out[lettre] = nouveau;
      });
    }
    return out;
  }, [essais, secret]);

  const taper = (lettre: string) => {
    if (fini || saisie.length >= LONGUEUR) return;
    haptic('light');
    setSaisie((s) => s + lettre);
    setMessage('');
  };

  const effacer = () => {
    if (fini) return;
    setSaisie((s) => s.slice(0, -1));
    setMessage('');
  };

  const valider = () => {
    if (fini) return;
    if (saisie.length !== LONGUEUR) {
      setMessage('Il faut cinq lettres');
      haptic('warning');
      return;
    }
    if (saisie[0] !== secret[0]) {
      setMessage(`Le mot commence par ${secret[0]}`);
      haptic('warning');
      return;
    }
    haptic('medium');
    setEssais((e) => [...e, saisie]);
    setSaisie('');
    setMessage('');
  };

  const couleurEtat = (etat: Etat | undefined) =>
    etat === 'juste' ? '#34B37E' : etat === 'present' ? '#F0A030' : etat === 'absent' ? c.surfaceAlt : c.surface;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Essai {Math.min(essais.length + 1, ESSAIS_MAX)}/{ESSAIS_MAX}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  const lignes = Array.from({ length: ESSAIS_MAX }, (_, i) => {
    if (i < essais.length) return { mot: essais[i], etats: comparer(essais[i], secret) };
    if (i === essais.length) {
      // Ligne en cours : la première lettre est offerte.
      const mot = (saisie || secret[0]).padEnd(LONGUEUR, ' ');
      return { mot, etats: null };
    }
    return { mot: ' '.repeat(LONGUEUR), etats: null };
  });

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md }}>
      <View style={{ gap: 5 }}>
        {lignes.map((ligne, i) => (
          <Row key={i} gap={5} style={{ justifyContent: 'center' }}>
            {Array.from({ length: LONGUEUR }, (_, j) => {
              const lettre = ligne.mot[j] ?? ' ';
              const etat = ligne.etats?.[j];
              return (
                <View
                  key={j}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: etat ? couleurEtat(etat) : c.surface,
                    borderWidth: 2,
                    borderColor: etat ? 'transparent' : c.border,
                  }}
                >
                  <Txt
                    style={{
                      fontSize: 26,
                      fontWeight: '800',
                      color: etat && etat !== 'absent' ? '#FFFFFF' : c.text,
                    }}
                  >
                    {lettre.trim()}
                  </Txt>
                </View>
              );
            })}
          </Row>
        ))}
      </View>

      <Txt variant="label" tone="danger">
        {message}
      </Txt>

      <View style={{ gap: 5, alignItems: 'center' }}>
        {CLAVIER.map((rangee, i) => (
          <Row key={i} gap={4}>
            {i === 2 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Valider"
                onPress={valider}
                style={{
                  paddingHorizontal: 10,
                  height: 46,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#4BC4D6',
                }}
              >
                <Txt variant="caption" style={{ color: '#FFFFFF' }}>
                  OK
                </Txt>
              </Pressable>
            ) : null}
            {rangee.map((lettre) => (
              <Pressable
                key={lettre}
                accessibilityRole="button"
                accessibilityLabel={`Lettre ${lettre}`}
                onPress={() => taper(lettre)}
                style={{
                  width: 30,
                  height: 46,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: couleurEtat(etatsClavier[lettre]),
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Txt
                  variant="label"
                  style={{
                    color:
                      etatsClavier[lettre] && etatsClavier[lettre] !== 'absent'
                        ? '#FFFFFF'
                        : etatsClavier[lettre] === 'absent'
                          ? c.textFaint
                          : c.text,
                  }}
                >
                  {lettre}
                </Txt>
              </Pressable>
            ))}
            {i === 2 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Effacer"
                onPress={effacer}
                style={{
                  paddingHorizontal: 10,
                  height: 46,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.surfaceAlt,
                }}
              >
                <Txt variant="caption" tone="dim">
                  ⌫
                </Txt>
              </Pressable>
            ) : null}
          </Row>
        ))}
      </View>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Trouvé !' : 'Six essais épuisés'}
        detail={gagne ? undefined : `Le mot était ${secret}`}
        score={gagne ? essais.length : undefined}
        scoreLabel="Essais"
        best={best}
        isRecord={record}
        accent="#4BC4D6"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
