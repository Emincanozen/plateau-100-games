import React from 'react';
import { Pressable, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useSettings } from '@/engine/settings';
import { fireHaptic } from '@/engine/haptics';
import { Txt } from './Text';

export function Screen({ children, style, padded = true }: ViewProps & { padded?: boolean }) {
  const { c, space } = useTheme();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: c.bg },
        padded && { paddingHorizontal: space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  accent,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  accent?: string;
}) {
  const { c, radius, space } = useTheme();
  const { settings } = useSettings();

  const inner: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: space.lg,
    // Un peu de relief : l'ombre porte en clair, l'élévation sur Android.
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  };

  if (!onPress) return <View style={[inner, style]}>{children}</View>;

  return (
    <Pressable
      onPress={() => {
        if (settings.haptics) fireHaptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        inner,
        accent ? { borderColor: pressed ? accent : c.border } : null,
        pressed && { backgroundColor: c.surfacePressed, transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Row({
  children,
  gap = 8,
  style,
  between,
  align = 'center',
}: {
  children: React.ReactNode;
  gap?: number;
  style?: ViewStyle;
  between?: boolean;
  align?: ViewStyle['alignItems'];
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: align,
          gap,
          justifyContent: between ? 'space-between' : 'flex-start',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Badge({ label, color, soft = true }: { label: string; color?: string; soft?: boolean }) {
  const { c, radius } = useTheme();
  const tint = color ?? c.accent;
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: soft ? tint + '22' : tint,
      }}
    >
      <Txt variant="caption" style={{ color: soft ? tint : '#fff' }}>
        {label}
      </Txt>
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

export function IconButton({
  glyph,
  onPress,
  label,
  tint,
}: {
  glyph: string;
  onPress: () => void;
  label: string;
  tint?: string;
}) {
  const { c, radius } = useTheme();
  const { settings } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        if (settings.haptics) fireHaptic('light');
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.surfacePressed : c.surfaceAlt,
      })}
    >
      <Txt style={{ fontSize: 18, color: tint ?? c.text }}>{glyph}</Txt>
    </Pressable>
  );
}

/** Espace bas sûr, pour les listes qui touchent le bord de l'écran. */
export function BottomInset({ extra = 0 }: { extra?: number }) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.bottom + extra }} />;
}
