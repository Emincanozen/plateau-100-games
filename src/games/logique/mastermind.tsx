import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Segmented, Txt, GameOver } from '@/ui';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'mastermind',
  name: 'Mastermind',
  tagline: 'Devine la combinaison de couleurs grâce aux indices.',
  category: 'logique',
  emoji: '🎨',
  difficulty: 2,
  players: '1',
  minutes: 6,
  score: 'low',
  scoreUnit: 'essais',
  tags: ['déduction', 'solo', 'classique'],
  rules: [
    'Une combinaison secrète de quatre couleurs est tirée au sort.',
    'Compose ta proposition en touchant les emplacements, puis valide.',
    'Un point noir = une couleur bien placée. Un point blanc = couleur présente, mais mal placée.',
    'Les indices ne disent pas quelle position est juste : à toi de déduire. Dix essais maximum.',
  ],
};

const PALETTE = ['#E0525F', '#F0A030', '#EFB93B', '#34B37E', '#4BC4D6', '#8B7DFF'];
const LONGUEUR = 4;
const ESSAIS_MAX = 10;

type Difficulte = 'simple' | 'classique';

interface Essai {
  proposition: number[];
  bienPlaces: number;
  presents: number;
}

function tirerSecret(couleurs: number, repetitions: boolean): number[] {
  if (repetitions) return Array.from({ length: LONGUEUR }, () => randInt(couleurs));
  const disponibles = Array.from({ length: couleurs }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < LONGUEUR; i++) {
    out.push(...disponibles.splice(randInt(disponibles.length), 1));
  }
  return out;
}

/** Noirs = bien places ; blancs = bonne couleur mal placee, sans double comptage. */
function evaluer(proposition: number[], secret: number[]): { bienPlaces: number; presents: number } {
  const restantSecret: number[] = [];
  const restantProposition: number[] = [];
  let bienPlaces = 0;

  proposition.forEach((couleur, i) => {
    if (couleur === secret[i]) {
      bienPlaces += 1;
    } else {
      restantSecret.push(secret[i]);
      restantProposition.push(couleur);
    }
  });

  let presents = 0;
  for (const couleur of restantProposition) {
    const index = restantSecret.indexOf(couleur);
    if (index !== -1) {
      presents += 1;
      restantSecret.splice(index, 1);
    }
  }
  return { bienPlaces, presents };
}

export default function Mastermind({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [difficulte, setDifficulte] = useState<Difficulte>('simple');
  const couleurs = difficulte === 'simple' ? 5 : 6;
  const repetitions = difficulte === 'classique';

  const [secret, setSecret] = useState<number[]>(() => tirerSecret(5, false));
  const [proposition, setProposition] = useState<number[]>(Array(LONGUEUR).fill(-1));
  const [essais, setEssais] = useState<Essai[]>([]);
  const [position, setPosition] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const gagne = essais.some((e) => e.bienPlaces === LONGUEUR);
  const perdu = !gagne && essais.length >= ESSAIS_MAX;
  const fini = gagne || perdu;

  const reset = useCallback(() => {
    setSecret(tirerSecret(difficulte === 'simple' ? 5 : 6, difficulte === 'classique'));
    setProposition(Array(LONGUEUR).fill(-1));
    setEssais([]);
    setPosition(0);
    setRecord(false);
    setComptee(false);
  }, [difficulte]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [difficulte, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : 'error');
    if (gagne) setRecord(submitScore(essais.length));
  }, [fini, comptee, gagne, essais.length, haptic, submitScore]);

  const choisir = (couleur: number) => {
    if (fini) return;
    haptic('light');
    setProposition((p) => p.map((v, i) => (i === position ? couleur : v)));
    setPosition((p) => Math.min(p + 1, LONGUEUR - 1));
  };

  const valider = () => {
    if (proposition.includes(-1) || fini) return;
    haptic('medium');
    const { bienPlaces, presents } = evaluer(proposition, secret);
    setEssais((e) => [...e, { proposition: proposition.slice(), bienPlaces, presents }]);
    setProposition(Array(LONGUEUR).fill(-1));
    setPosition(0);
  };

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

  return (
    <View style={{ flex: 1, gap: space.md, paddingTop: space.sm }}>
      <Segmented<Difficulte>
        value={difficulte}
        onChange={setDifficulte}
        options={[
          { value: 'simple', label: '5 couleurs, sans doublon' },
          { value: 'classique', label: '6 couleurs, doublons' },
        ]}
        accent="#34B37E"
      />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6 }}>
          {essais.map((essai, i) => (
            <Row key={i} between style={{ paddingHorizontal: space.md }}>
              <Row gap={8}>
                <Txt variant="caption" tone="faint" style={{ width: 20 }}>
                  {i + 1}
                </Txt>
                {essai.proposition.map((couleur, j) => (
                  <View
                    key={j}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: PALETTE[couleur],
                    }}
                  />
                ))}
              </Row>
              <Row gap={3}>
                {Array.from({ length: essai.bienPlaces }, (_, k) => (
                  <View
                    key={`n${k}`}
                    style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c.text }}
                  />
                ))}
                {Array.from({ length: essai.presents }, (_, k) => (
                  <View
                    key={`b${k}`}
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 6,
                      borderWidth: 1.5,
                      borderColor: c.textDim,
                    }}
                  />
                ))}
              </Row>
            </Row>
          ))}
        </View>
      </ScrollView>

      <View
        style={{
          gap: space.md,
          padding: space.md,
          backgroundColor: c.surface,
          borderRadius: radius.lg,
        }}
      >
        <Row gap={10} style={{ justifyContent: 'center' }}>
          {proposition.map((couleur, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Emplacement ${i + 1}`}
              onPress={() => setPosition(i)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: couleur >= 0 ? PALETTE[couleur] : c.surfaceAlt,
                borderWidth: position === i ? 3 : 1,
                borderColor: position === i ? c.accent : c.border,
              }}
            />
          ))}
        </Row>

        <Row gap={8} style={{ justifyContent: 'center' }}>
          {PALETTE.slice(0, couleurs).map((couleur, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Couleur ${i + 1}`}
              onPress={() => choisir(i)}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: couleur,
                opacity: pressed ? 0.7 : 1,
              })}
            />
          ))}
        </Row>

        <Button
          label="Valider la proposition"
          full
          accent="#34B37E"
          disabled={proposition.includes(-1) || fini}
          onPress={valider}
        />
      </View>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Combinaison trouvée !' : 'Dix essais épuisés'}
        score={gagne ? essais.length : undefined}
        scoreLabel="Essais"
        best={best}
        isRecord={record}
        detail={gagne ? undefined : 'La solution est révélée ci-dessous.'}
        accent="#34B37E"
        extra={
          !gagne ? (
            <Row gap={8}>
              {secret.map((couleur, i) => (
                <View
                  key={i}
                  style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: PALETTE[couleur] }}
                />
              ))}
            </Row>
          ) : undefined
        }
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
