import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'label' | 'caption' | 'mono';
type Tone = 'normal' | 'dim' | 'faint' | 'accent' | 'success' | 'danger' | 'warning' | 'onAccent';

export interface TxtProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
  style?: TextStyle | TextStyle[];
}

export function Txt({ variant = 'body', tone = 'normal', center, style, ...rest }: TxtProps) {
  const { c, font } = useTheme();
  const colorByTone: Record<Tone, string> = {
    normal: c.text,
    dim: c.textDim,
    faint: c.textFaint,
    accent: c.accent,
    success: c.success,
    danger: c.danger,
    warning: c.warning,
    onAccent: c.onAccent,
  };
  return (
    <RNText
      {...rest}
      style={[
        font[variant] as TextStyle,
        { color: colorByTone[tone] },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}
