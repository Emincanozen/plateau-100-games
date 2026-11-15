import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useSettings } from '@/engine/settings';
import { fireHaptic } from '@/engine/haptics';

/** Position des points pour chaque face, en fractions du côté du dé. */
const POINTS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.26, 0.26],
    [0.5, 0.5],
    [0.74, 0.74],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.26, 0.26],
    [0.74, 0.26],
    [0.5, 0.5],
    [0.26, 0.74],
    [0.74, 0.74],
  ],
  6: [
    [0.28, 0.24],
    [0.72, 0.24],
    [0.28, 0.5],
    [0.72, 0.5],
    [0.28, 0.76],
    [0.72, 0.76],
  ],
};

export interface DeProps {
  valeur: number;
  taille?: number;
  /** Dé mis de côté : il change de couleur et porte une bordure. */
  garde?: boolean;
  onPress?: () => void;
  tint?: string;
  /** Grisé : le dé ne compte pas ce tour-ci. */
  eteint?: boolean;
}

/** Un dé à six faces, dessiné avec de vrais points. */
export function De({ valeur, taille = 54, garde, onPress, tint, eteint }: DeProps) {
  const { c, radius } = useTheme();
  const { settings } = useSettings();
  const accent = tint ?? '#A96CF0';
  const rayonPoint = taille * 0.1;

  const corps = (
    <View
      style={{
        width: taille,
        height: taille,
        borderRadius: radius.md,
        backgroundColor: garde ? accent : c.surface,
        borderWidth: 2,
        borderColor: garde ? accent : c.border,
        opacity: eteint ? 0.35 : 1,
      }}
    >
      {(POINTS[valeur] ?? []).map(([x, y], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: x * taille - rayonPoint,
            top: y * taille - rayonPoint,
            width: rayonPoint * 2,
            height: rayonPoint * 2,
            borderRadius: rayonPoint,
            backgroundColor: garde ? '#FFFFFF' : c.text,
          }}
        />
      ))}
    </View>
  );

  if (!onPress) return corps;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dé ${valeur}${garde ? ', gardé' : ''}`}
      onPress={() => {
        if (settings.haptics) fireHaptic('light');
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {corps}
    </Pressable>
  );
}
