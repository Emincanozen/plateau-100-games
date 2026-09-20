import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useProgress } from '@/engine/progress';
import { useSettings } from '@/engine/settings';
import { fireHaptic, type HapticKind } from '@/engine/haptics';
import { jouerSon } from '@/engine/sons';
import { GameFrameProvider, StatusSlot, useGameFrame } from '@/engine/frame';
import { useRetour } from '@/engine/navigation';
import { CATEGORY_BY_ID, type GameScreenProps } from '@/engine/types';
import { getGame } from '@/games/registry';
import { useRegiePub } from '@/pub/regie';
import { Button, IconButton, Row, Sheet, Txt } from '@/ui';

export default function GameRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <GameFrameProvider>
      <GameHost id={id} />
    </GameFrameProvider>
  );
}

function GameHost({ id }: { id?: string }) {
  const { c, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const retour = useRetour();
  const { settings } = useSettings();
  const { statFor, markPlayed, submitScore, submitResult, isFavorite, toggleFavorite } = useProgress();
  const { restart, runId, bumpRun, setPause } = useGameFrame();
  const { entrerEnPartie, quitterLaPartie, signalerPartieTerminee, montrerInterstitiel } =
    useRegiePub();

  const entry = getGame(id);
  const stat = entry ? statFor(entry.meta.id) : undefined;
  const [rulesOpen, setRulesOpen] = useState(false);
  const opened = useRef(false);

  // Comptabilise une ouverture, et propose les regles a la toute premiere partie.
  useEffect(() => {
    if (!entry || opened.current) return;
    opened.current = true;
    const firstTime = (stat?.plays ?? 0) === 0;
    markPlayed(entry.meta.id);
    if (firstTime && settings.autoRules) setRulesOpen(true);
  }, [entry, stat, markPlayed, settings.autoRules]);

  // Le jeu se fige tant que la feuille de règles est ouverte : sans cela,
  // les boucles tournent en fond et le joueur perd des vies ou du temps
  // avant même d'avoir commencé.
  useEffect(() => {
    setPause(rulesOpen);
  }, [rulesOpen, setPause]);

  // Un seul entonnoir : les cent jeux appellent `haptic`, et c'est ici que
  // vibration et son partent ensemble. Aucun jeu ne connaît le module audio.
  const haptic = useCallback(
    (kind: HapticKind = 'light') => {
      if (settings.haptics) fireHaptic(kind);
      if (settings.sound) jouerSon(kind);
    },
    [settings.haptics, settings.sound],
  );

  // Les six lecteurs audio ne sont **pas** libérés en quittant cet écran.
  // Ils l'étaient, et c'était un défaut : détruire un lecteur en cours de
  // lecture produisait un rejet de promesse non géré à presque chaque
  // partie. Ils vivent maintenant aussi longtemps que l'application — voir
  // `libererLesSons` dans src/engine/sons.ts.

  // Tant que cet écran est monté, aucune publicité plein écran ne peut
  // partir. C'est la garantie « jamais pendant une partie », et elle tient
  // même si un jeu déclenche une fin de partie au millième de seconde près.
  useEffect(() => {
    entrerEnPartie();
    return quitterLaPartie;
  }, [entrerEnPartie, quitterLaPartie]);

  const handleScore = useCallback(
    (score: number) => {
      if (!entry) return false;
      signalerPartieTerminee();
      return submitScore(entry.meta.id, score, entry.meta.score);
    },
    [entry, submitScore, signalerPartieTerminee],
  );

  const handleResult = useCallback(
    (outcome: 'win' | 'loss' | 'draw') => {
      if (!entry) return;
      signalerPartieTerminee();
      submitResult(entry.meta.id, outcome);
    },
    [entry, submitResult, signalerPartieTerminee],
  );

  /**
   * Sortie du jeu : c'est le seul moment où un interstitiel peut apparaître.
   * La partie est finie, le joueur a décidé de partir, et la régie décide
   * ensuite si la fréquence le permet — le plus souvent, non.
   */
  const quitterLeJeu = useCallback(async () => {
    quitterLaPartie();
    try {
      await montrerInterstitiel();
    } catch {
      // Un problème de publicité ne retient jamais le joueur sur cet écran.
    }
    retour();
  }, [quitterLaPartie, montrerInterstitiel, retour]);

  if (!entry) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.bg,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.md,
          padding: space.xl,
        }}
      >
        <Txt style={{ fontSize: 40 }}>🧭</Txt>
        <Txt variant="h3">Ce jeu n’existe pas</Txt>
        <Button label="Retour au catalogue" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const { meta } = entry;
  const cat = CATEGORY_BY_ID[meta.category];
  const Game = entry.component;
  const fav = isFavorite(meta.id);

  const gameProps: GameScreenProps = {
    meta,
    submitScore: handleScore,
    submitResult: handleResult,
    best: stat?.best,
    haptic,
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Row
        between
        style={{
          paddingHorizontal: space.lg,
          paddingBottom: space.sm,
          gap: space.sm,
        }}
      >
        <IconButton glyph="‹" label="Retour" onPress={() => void quitterLeJeu()} />

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Row gap={6}>
            <Txt style={{ fontSize: 14 }}>{meta.emoji}</Txt>
            <Txt variant="h3" numberOfLines={1}>
              {meta.name}
            </Txt>
          </Row>
          <StatusSlot
            fallback={
              <Txt variant="caption" tone="faint">
                {cat.label}
              </Txt>
            }
          />
        </View>

        <Row gap={space.xs}>
          <IconButton
            glyph={fav ? '⭐' : '☆'}
            label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            onPress={() => toggleFavorite(meta.id)}
          />
          <IconButton glyph="?" label="Règles" onPress={() => setRulesOpen(true)} />
          <IconButton
            glyph="↻"
            label="Recommencer"
            onPress={() => {
              haptic('medium');
              restart();
            }}
          />
        </Row>
      </Row>

      <View style={{ flex: 1, paddingHorizontal: space.md, paddingBottom: insets.bottom }}>
        <Game key={`${meta.id}-${runId}`} {...gameProps} />
      </View>

      <Sheet visible={rulesOpen} onClose={() => setRulesOpen(false)} title={`Règles · ${meta.name}`}>
        <View style={{ gap: space.md, paddingBottom: space.lg }}>
          <Txt variant="body" tone="dim">
            {meta.tagline}
          </Txt>
          <View style={{ gap: space.sm }}>
            {meta.rules.map((rule, i) => (
              <Row key={i} align="flex-start" gap={space.sm}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.pill,
                    backgroundColor: cat.accent + '26',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  <Txt variant="caption" style={{ color: cat.accent }}>
                    {i + 1}
                  </Txt>
                </View>
                <Txt variant="body" style={{ flex: 1 }}>
                  {rule}
                </Txt>
              </Row>
            ))}
          </View>

          <Row gap={space.md} style={{ marginTop: space.sm }}>
            <Txt variant="caption" tone="faint">
              {meta.players === '1' ? 'Solo' : `${meta.players} joueurs`}
            </Txt>
            <Txt variant="caption" tone="faint">
              ~{meta.minutes} min
            </Txt>
            <Txt variant="caption" tone="faint">
              {'●'.repeat(meta.difficulty)}
              {'○'.repeat(3 - meta.difficulty)}
            </Txt>
          </Row>

          <Button
            label="Commencer"
            full
            accent={cat.accent}
            onPress={() => {
              setRulesOpen(false);
              bumpRun();
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}
