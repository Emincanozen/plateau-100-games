import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { etiquette, nomCarte, SYMBOLE, type Carte as CarteModel } from '@/games/lib/cartes';
import { Txt } from './Text';

export interface CarteProps {
  carte: CarteModel;
  /** Largeur en points ; la hauteur suit le ratio d'une vraie carte. */
  largeur?: number;
  onPress?: () => void;
  selectionnee?: boolean;
  style?: ViewStyle;
  /** Reduit l'affichage au coin haut-gauche (cartes empilees en cascade). */
  compacte?: boolean;
}

export const RATIO_CARTE = 1.45;

/** Une carte a jouer, face visible ou dos bleu. */
export function Carte({
  carte,
  largeur = 54,
  onPress,
  selectionnee,
  style,
  compacte,
}: CarteProps) {
  const { c, radius } = useTheme();
  const hauteur = largeur * RATIO_CARTE;
  // La face d'une carte est toujours claire : la teinte ne suit donc pas le theme.
  const teinte = carte.rouge ? '#D2384A' : '#1A1A24';

  const contenu = carte.visible ? (
    <View style={{ flex: 1, padding: largeur * 0.08 }}>
      <View style={{ alignItems: 'flex-start' }}>
        <Txt style={{ fontSize: largeur * 0.34, fontWeight: '800', color: teinte, lineHeight: largeur * 0.4 }}>
          {etiquette(carte.rang)}
        </Txt>
        <Txt style={{ fontSize: largeur * 0.28, color: teinte, lineHeight: largeur * 0.32 }}>
          {SYMBOLE[carte.couleur]}
        </Txt>
      </View>
      {!compacte ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Txt style={{ fontSize: largeur * 0.52, color: teinte }}>{SYMBOLE[carte.couleur]}</Txt>
        </View>
      ) : null}
    </View>
  ) : (
    <View
      style={{
        flex: 1,
        margin: 3,
        borderRadius: radius.sm - 2,
        backgroundColor: '#2F49A8',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt style={{ fontSize: largeur * 0.4, color: '#5C77D6' }}>✦</Txt>
    </View>
  );

  const corps = (
    <View
      style={[
        {
          width: largeur,
          height: hauteur,
          borderRadius: radius.sm,
          backgroundColor: carte.visible ? '#FBFBFD' : '#1E2C63',
          borderWidth: selectionnee ? 2.5 : 1,
          borderColor: selectionnee ? c.accent : '#00000026',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {contenu}
    </View>
  );

  if (!onPress) return corps;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={carte.visible ? nomCarte(carte) : 'Carte face cachée'}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {corps}
    </Pressable>
  );
}

/** Emplacement vide (fondation, colonne videe). */
export function EmplacementVide({
  largeur = 54,
  onPress,
  glyphe,
}: {
  largeur?: number;
  onPress?: () => void;
  glyphe?: string;
}) {
  const { c, radius } = useTheme();
  const corps = (
    <View
      style={{
        width: largeur,
        height: largeur * RATIO_CARTE,
        borderRadius: radius.sm,
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {glyphe ? (
        <Txt style={{ fontSize: largeur * 0.4, color: c.textFaint }}>{glyphe}</Txt>
      ) : null}
    </View>
  );
  if (!onPress) return corps;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Emplacement vide" onPress={onPress}>
      {corps}
    </Pressable>
  );
}
