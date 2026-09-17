import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useProgress } from '@/engine/progress';
import { useSettings } from '@/engine/settings';
import { fireHaptic, type HapticKind } from '@/engine/haptics';
import { GameFrameProvider, StatusSlot, useGameFrame } from '@/engine/frame';
import { useRetour } from '@/engine/navigation';
import { CATEGORY_BY_ID, type GameScreenProps } from '@/engine/types';
import { getGame } from '@/games/registry';
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
  const { restart, runId, bumpRun } = useGameFrame();

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

  const haptic = useCallback(
    (kind: HapticKind = 'light') => {
      if (settings.haptics) fireHaptic(kind);
    },
    [settings.haptics],
  );

  const handleScore = useCallback(
    (score: number) => (entry ? submitScore(entry.meta.id, score, entry.meta.score) : false),
    [entry, submitScore],
  );

  const handleResult = useCallback(
    (outcome: 'win' | 'loss' | 'draw') => {
      if (entry) submitResult(entry.meta.id, outcome);
    },
    [entry, submitResult],
  );

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
        <IconButton glyph="‹" label="Retour" onPress={retour} />

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
