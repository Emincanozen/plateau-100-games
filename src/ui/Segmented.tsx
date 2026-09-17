import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useSettings } from '@/engine/settings';
import { fireHaptic } from '@/engine/haptics';
import { Txt } from './Text';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accent,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
}) {
  const { c, radius } = useTheme();
  const { settings } = useSettings();
  const tint = accent ?? c.accent;

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.surfaceAlt,
        borderRadius: radius.md,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (settings.haptics) fireHaptic('light');
              onChange(opt.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: radius.sm,
              alignItems: 'center',
              backgroundColor: active ? tint : 'transparent',
            }}
          >
            <Txt variant="caption" style={{ color: active ? c.onAccent : c.textDim }}>
              {opt.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
