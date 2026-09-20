import React, { useState } from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';
import type { BannerAdProps } from 'react-native-google-mobile-ads';
import { useTheme } from '@/theme/ThemeProvider';
import { useRegiePub } from '@/pub/regie';

/**
 * Bandeau publicitaire, posé dans le flux et jamais par-dessus une commande.
 *
 * Trois garde-fous tenus ici :
 *
 * - **Aucune place réservée tant que rien n'est chargé.** Un emplacement vide
 *   qui se remplit brusquement déplace les boutons sous le pouce du joueur :
 *   c'est exactement comme ça qu'on provoque un clic accidentel. La hauteur
 *   n'apparaît qu'une fois l'annonce reçue.
 * - **Une marge sous la bannière**, pour que le bord de l'annonce ne touche
 *   jamais un élément tactile de l'application.
 * - **Rien du tout dans Expo Go, ni sans consentement.** Le composant rend
 *   `null`, et la mise en page est celle d'avant la publicité. Le web, lui,
 *   reçoit `Banniere.tsx`, qui rend `null` sans même charger le SDK.
 */

type ComposantBanniere = React.ComponentType<BannerAdProps>;

let banniere: ComposantBanniere | null = null;
let tailles: { ANCHORED_ADAPTIVE_BANNER: string } | null = null;
let tentee = false;

function charger() {
  if (tentee) return;
  tentee = true;
  if (Constants.appOwnership === 'expo') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('react-native-google-mobile-ads');
    banniere = module.BannerAd as ComposantBanniere;
    tailles = module.BannerAdSize;
  } catch {
    banniere = null;
  }
}

export function Banniere({ marge = 0 }: { marge?: number }) {
  const { c, space } = useTheme();
  const { uniteBanniere } = useRegiePub();
  const [hauteur, setHauteur] = useState(0);
  const [echec, setEchec] = useState(false);

  charger();

  if (!uniteBanniere || !banniere || !tailles || echec) return null;

  const BannerAd = banniere;

  return (
    <View
      accessibilityLabel="Bandeau publicitaire"
      style={{
        alignItems: 'center',
        // La hauteur suit l'annonce reçue : zéro tant qu'il n'y a rien.
        height: hauteur > 0 ? hauteur + space.sm + marge : 0,
        overflow: 'hidden',
        backgroundColor: c.bg,
      }}
    >
      <BannerAd
        unitId={uniteBanniere}
        size={tailles.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={({ height }) => setHauteur(height)}
        onAdFailedToLoad={() => {
          // Hors ligne ou inventaire vide : on retire l'emplacement, on ne
          // laisse pas un rectangle gris dans le catalogue.
          setHauteur(0);
          setEchec(true);
        }}
      />
    </View>
  );
}
