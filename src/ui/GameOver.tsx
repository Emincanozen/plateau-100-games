import React from 'react';
import { Modal, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Text';
import { Button } from './Button';
import { Row } from './Surface';

export type Outcome = 'win' | 'loss' | 'draw' | 'over';

const TITLES: Record<Outcome, string> = {
  win: 'Gagné !',
  loss: 'Perdu',
  draw: 'Égalité',
  over: 'Partie terminée',
};

const EMOJIS: Record<Outcome, string> = {
  win: '🏆',
  loss: '😕',
  draw: '🤝',
  over: '🏁',
};

export function GameOver({
  visible,
  outcome = 'over',
  title,
  detail,
  score,
  scoreLabel = 'Score',
  best,
  isRecord,
  onReplay,
  onQuit,
  accent,
  extra,
}: {
  visible: boolean;
  outcome?: Outcome;
  title?: string;
  detail?: string;
  score?: number | string;
  scoreLabel?: string;
  best?: number | string;
  isRecord?: boolean;
  onReplay: () => void;
  onQuit: () => void;
  accent?: string;
  extra?: React.ReactNode;
}) {
  const { c, radius, space } = useTheme();
  const tint = accent ?? c.accent;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: c.scrim,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: c.bgElevated,
            borderRadius: radius.xl,
            padding: space.xl,
            alignItems: 'center',
            gap: space.md,
          }}
        >
          <Txt style={{ fontSize: 46 }}>{EMOJIS[outcome]}</Txt>
          <Txt variant="h2" center>
            {title ?? TITLES[outcome]}
          </Txt>
          {detail ? (
            <Txt variant="body" tone="dim" center>
              {detail}
            </Txt>
          ) : null}

          {score !== undefined ? (
            <View style={{ alignItems: 'center', marginTop: space.xs }}>
              <Txt variant="caption" tone="faint">
                {scoreLabel.toUpperCase()}
              </Txt>
              <Txt style={{ fontSize: 40, fontWeight: '800', color: tint }}>{score}</Txt>
            </View>
          ) : null}

          {isRecord ? (
            <View
              style={{
                paddingHorizontal: space.md,
                paddingVertical: 5,
                borderRadius: radius.pill,
                backgroundColor: c.gold + '26',
              }}
            >
              <Txt variant="caption" style={{ color: c.gold }}>
                ⭐ NOUVEAU RECORD
              </Txt>
            </View>
          ) : best !== undefined ? (
            <Txt variant="caption" tone="faint">
              Record : {best}
            </Txt>
          ) : null}

          {extra}

          <Row gap={10} style={{ marginTop: space.md, alignSelf: 'stretch' }}>
            <Button label="Quitter" kind="secondary" onPress={onQuit} style={{ flex: 1 }} />
            <Button label="Rejouer" onPress={onReplay} accent={tint} style={{ flex: 1 }} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}
