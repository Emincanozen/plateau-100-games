import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useSettings } from '@/engine/settings';
import { fireHaptic } from '@/engine/haptics';
import { Txt } from './Text';

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  kind?: Kind;
  size?: Size;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: ViewStyle;
  accent?: string;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  full,
  style,
  accent,
}: ButtonProps) {
  const { c, radius, space } = useTheme();
  const { settings } = useSettings();
  const tint = accent ?? c.accent;

  // 44 points au minimum : recommandation Apple pour une cible tactile.
  const heights: Record<Size, number> = { sm: 44, md: 48, lg: 56 };
  const pads: Record<Size, number> = { sm: space.md, md: space.lg, lg: space.xl };

  const bg: Record<Kind, string> = {
    primary: tint,
    secondary: c.surfaceAlt,
    ghost: 'transparent',
    danger: c.danger,
  };
  const fg: Record<Kind, string> = {
    primary: c.onAccent,
    secondary: c.text,
    ghost: c.textDim,
    danger: '#FFFFFF',
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={() => {
        if (settings.haptics) fireHaptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: pads[size],
          borderRadius: radius.md,
          backgroundColor: bg[kind],
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !disabled ? 0.975 : 1 }],
          borderWidth: kind === 'ghost' ? 1 : 0,
          borderColor: c.border,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[kind]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Txt style={{ fontSize: size === 'sm' ? 14 : 17 }}>{icon}</Txt> : null}
          <Txt
            variant={size === 'sm' ? 'caption' : 'label'}
            style={{ color: fg[kind], fontSize: size === 'lg' ? 17 : undefined }}
          >
            {label}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
