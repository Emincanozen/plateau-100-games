import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Carte as CarteVue, Row, Txt } from '@/ui';
import { jeu52, melanger, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'video-poker',
  name: 'Vidéo poker',
  tagline: 'Garde les bonnes cartes, change les autres, et vise la couleur.',
  category: 'cartes',
  emoji: '🎰',
  difficulty: 2,
  players: '1',
  minutes: 6,
  score: 'high',
  scoreUnit: 'jetons',
  tags: ['casino', 'solo', 'combinaisons'],
  rules: [
    'Tu reçois cinq cartes. Touche celles que tu veux garder, elles se marquent « GARDÉE ».',
    'Un seul tirage : les cartes non gardées sont remplacées.',
    'La combinaison finale détermine le gain, de la paire de valets à la quinte flush royale.',
    'Une main perdante coûte ta mise. Le tableau des gains est affiché en permanence.',
  ],
};

type Combinaison =
  | 'quinteFlushRoyale'
  | 'quinteFlush'
  | 'carre'
  | 'full'
  | 'couleur'
  | 'quinte'
  | 'brelan'
  | 'deuxPaires'
  | 'paireValets'
  | 'rien';

const GAINS: Record<Combinaison, number> = {
  quinteFlushRoyale: 250,
  quinteFlush: 50,
  carre: 25,
  full: 9,
  couleur: 6,
  quinte: 4,
  brelan: 3,
  deuxPaires: 2,
  paireValets: 1,
  rien: 0,
};

const NOMS: Record<Combinaison, string> = {
  quinteFlushRoyale: 'Quinte flush royale',
  quinteFlush: 'Quinte flush',
  carre: 'Carré',
  full: 'Full',
  couleur: 'Couleur',
  quinte: 'Quinte',
  brelan: 'Brelan',
  deuxPaires: 'Deux paires',
  paireValets: 'Paire de valets ou mieux',
  rien: 'Rien',
};

const ORDRE: Combinaison[] = [
  'quinteFlushRoyale',
  'quinteFlush',
  'carre',
  'full',
  'couleur',
  'quinte',
  'brelan',
  'deuxPaires',
  'paireValets',
];

/** Évalue une main de cinq cartes. */
export function evaluer(main: Carte[]): Combinaison {
  const rangs = main.map((c) => c.rang).sort((a, b) => a - b);
  const couleurUnique = main.every((c) => c.couleur === main[0].couleur);

  const occurrences = new Map<number, number>();
  rangs.forEach((r) => occurrences.set(r, (occurrences.get(r) ?? 0) + 1));
  const paquets = [...occurrences.values()].sort((a, b) => b - a);

  // La suite peut être A-2-3-4-5 ou 10-V-D-R-A.
  const suiteBasse = rangs.every((r, i) => i === 0 || r === rangs[i - 1] + 1);
  const suiteRoyale = rangs.join(',') === '1,10,11,12,13';
  const suite = suiteBasse || suiteRoyale;

  if (suite && couleurUnique && suiteRoyale) return 'quinteFlushRoyale';
  if (suite && couleurUnique) return 'quinteFlush';
  if (paquets[0] === 4) return 'carre';
  if (paquets[0] === 3 && paquets[1] === 2) return 'full';
  if (couleurUnique) return 'couleur';
  if (suite) return 'quinte';
  if (paquets[0] === 3) return 'brelan';
  if (paquets[0] === 2 && paquets[1] === 2) return 'deuxPaires';

  // Paire payante seulement à partir des valets (ou des as).
  for (const [rang, n] of occurrences) {
    if (n === 2 && (rang >= 11 || rang === 1)) return 'paireValets';
  }
  return 'rien';
}

const MISE = 5;

export default function VideoPoker({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [jetons, setJetons] = useState(100);
  const [main, setMain] = useState<Carte[]>([]);
  const [gardees, setGardees] = useState<boolean[]>([false, false, false, false, false]);
  const [phase, setPhase] = useState<'mise' | 'tirage' | 'resultat'>('mise');
  const [resultat, setResultat] = useState<Combinaison | null>(null);
  const sabot = useRef<Carte[]>(melanger(jeu52()));
  const record = useRef(100);

  const tirer = (): Carte => {
    if (sabot.current.length < 6) sabot.current = melanger(jeu52());
    return { ...sabot.current.pop()!, visible: true };
  };

  const reset = useCallback(() => {
    sabot.current = melanger(jeu52());
    setJetons(100);
    setMain([]);
    setGardees([false, false, false, false, false]);
    setPhase('mise');
    setResultat(null);
    record.current = 100;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (jetons > record.current) {
      record.current = jetons;
      submitScore(jetons);
    }
  }, [jetons, submitScore]);

  const distribuer = () => {
    if (jetons < MISE) return;
    haptic('medium');
    setJetons((j) => j - MISE);
    setMain([tirer(), tirer(), tirer(), tirer(), tirer()]);
    setGardees([false, false, false, false, false]);
    setResultat(null);
    setPhase('tirage');
  };

  const remplacer = () => {
    haptic('medium');
    const nouvelle = main.map((carte, i) => (gardees[i] ? carte : tirer()));
    setMain(nouvelle);
    const combinaison = evaluer(nouvelle);
    setResultat(combinaison);
    const gain = GAINS[combinaison] * MISE;
    if (gain > 0) {
      setJetons((j) => j + gain);
      haptic('success');
    } else {
      haptic('error');
    }
    setPhase('resultat');
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {jetons} jetons
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <View
        style={{
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          padding: space.md,
          gap: 3,
        }}
      >
        {ORDRE.map((combinaison) => (
          <Row key={combinaison} between>
            <Txt
              variant="caption"
              style={{ color: resultat === combinaison ? '#EFB93B' : c.textDim }}
            >
              {NOMS[combinaison]}
            </Txt>
            <Txt
              variant="caption"
              style={{ color: resultat === combinaison ? '#EFB93B' : c.textFaint }}
            >
              ×{GAINS[combinaison]}
            </Txt>
          </Row>
        ))}
      </View>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <Row gap={5} style={{ justifyContent: 'center', minHeight: 100 }}>
          {main.length === 0
            ? Array.from({ length: 5 }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: 58,
                    height: 58 * 1.45,
                    borderRadius: radius.sm,
                    borderWidth: 1.5,
                    borderColor: c.border,
                    borderStyle: 'dashed',
                  }}
                />
              ))
            : main.map((carte, i) => (
                <View key={`${carte.id}-${i}`} style={{ alignItems: 'center', gap: 4 }}>
                  <CarteVue
                    carte={carte}
                    largeur={58}
                    selectionnee={gardees[i]}
                    onPress={
                      phase === 'tirage'
                        ? () => {
                            haptic('light');
                            setGardees((g) => g.map((v, j) => (i === j ? !v : v)));
                          }
                        : undefined
                    }
                  />
                  <Txt
                    variant="caption"
                    style={{ color: gardees[i] ? c.accent : 'transparent', fontSize: 10 }}
                  >
                    GARDÉE
                  </Txt>
                </View>
              ))}
        </Row>

        {resultat ? (
          <Txt variant="h3" center tone={GAINS[resultat] > 0 ? 'success' : 'danger'}>
            {resultat === 'rien'
              ? 'Rien cette fois'
              : `${NOMS[resultat]} · +${GAINS[resultat] * MISE}`}
          </Txt>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        {phase === 'tirage' ? (
          <Button label="Remplacer les autres cartes" full accent="#E0525F" onPress={remplacer} />
        ) : (
          <Button
            label={jetons < MISE ? 'Plus de jetons — recommencer' : `Distribuer (mise ${MISE})`}
            full
            accent="#E0525F"
            onPress={jetons < MISE ? reset : distribuer}
          />
        )}
        <Txt variant="caption" tone="faint" center>
          {phase === 'tirage' ? 'Touche les cartes à conserver' : 'Un seul tirage par main'}
        </Txt>
      </View>
    </View>
  );
}
