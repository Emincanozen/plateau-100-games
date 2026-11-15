import React, { useEffect } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useSettings } from '@/engine/settings';
import { fireHaptic } from '@/engine/haptics';
import { Txt } from './Text';

/**
 * Bouton de manette : grande cible tactile, repetition automatique possible
 * quand on garde le doigt appuye (deplacement lateral, descente…).
 */
export function BoutonControle({
  glyphe,
  label,
  onPress,
  taille = 58,
  tint,
  repeter,
  style,
}: {
  glyphe: string;
  label: string;
  onPress: () => void;
  taille?: number;
  tint?: string;
  /** Repete l'action tant que le doigt reste appuye. */
  repeter?: boolean;
  style?: ViewStyle;
}) {
  const { c, radius } = useTheme();
  const { settings } = useSettings();
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopper = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => stopper, []);

  const declencher = () => {
    if (settings.haptics) fireHaptic('light');
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={repeter ? undefined : declencher}
      onPressIn={
        repeter
          ? () => {
              declencher();
              stopper();
              timer.current = setInterval(onPress, 130);
            }
          : undefined
      }
      onPressOut={repeter ? stopper : undefined}
      style={({ pressed }) => [
        {
          width: taille,
          height: taille,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? c.surfacePressed : (tint ?? c.surfaceAlt),
          borderWidth: 1,
          borderColor: c.border,
        },
        style,
      ]}
    >
      <Txt style={{ fontSize: taille * 0.4, color: c.text }}>{glyphe}</Txt>
    </Pressable>
  );
}

export type Direction = 'haut' | 'bas' | 'gauche' | 'droite';

/** Croix directionnelle, pour les jeux qui se pilotent au doigt. */
export function CroixDirectionnelle({
  onDirection,
  taille = 52,
  tint,
}: {
  onDirection: (d: Direction) => void;
  taille?: number;
  tint?: string;
}) {
  const vide = <View style={{ width: taille, height: taille }} />;
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <BoutonControle glyphe="▲" label="Haut" taille={taille} tint={tint} onPress={() => onDirection('haut')} />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <BoutonControle glyphe="◀" label="Gauche" taille={taille} tint={tint} onPress={() => onDirection('gauche')} />
        {vide}
        <BoutonControle glyphe="▶" label="Droite" taille={taille} tint={tint} onPress={() => onDirection('droite')} />
      </View>
      <BoutonControle glyphe="▼" label="Bas" taille={taille} tint={tint} onPress={() => onDirection('bas')} />
    </View>
  );
}

/**
 * Raccourcis clavier, actifs uniquement sur le web.
 * `touches` associe un code clavier (ArrowLeft, Space, KeyA…) a une action.
 */
export function useClavier(touches: Record<string, () => void>, actif = true) {
  const ref = React.useRef(touches);
  ref.current = touches;

  useEffect(() => {
    if (Platform.OS !== 'web' || !actif) return;
    const onKey = (event: KeyboardEvent) => {
      const action = ref.current[event.code] ?? ref.current[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actif]);
}
