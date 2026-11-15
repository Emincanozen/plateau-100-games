import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Configuration publicitaire — un seul endroit pour les identifiants, les
 * emplacements et les règles de fréquence.
 *
 * Deux principes tenus ici :
 *
 * 1. **Jamais de vraie annonce en développement.** Google interdit de cliquer
 *    sur ses propres annonces ; un compte peut être fermé pour cela. Tant que
 *    le paquet n'est pas une compilation de production, on force les
 *    identifiants de test officiels.
 * 2. **Jamais d'identifiant de test en production.** C'est l'erreur
 *    symétrique : elle ne rapporte rien et fausse les statistiques. Si les
 *    identifiants réels manquent, la publicité est simplement désactivée.
 */

/**
 * Identifiants officiels et publics de démonstration publiés par Google (Google Sample IDs: ca-app-pub-3940256099942544).
 * Ces identifiants de test officiels sont publics et réservés au développement : ils ne rapportent rien et ne présentent aucun risque.
 */
export const UNITES_TEST = {
  banniere: 'ca-app-pub-3940256099942544/6300978111',
  banniereIos: 'ca-app-pub-3940256099942544/2934735716',
  interstitiel: 'ca-app-pub-3940256099942544/1033173712',
  interstitielIos: 'ca-app-pub-3940256099942544/4411468910',
  recompense: 'ca-app-pub-3940256099942544/5224354917',
  recompenseIos: 'ca-app-pub-3940256099942544/1712485313',
} as const;

interface ExtraAdmob {
  /** `ca-app-pub-…~…` — identifiant d'application, public, figure dans le paquet. */
  androidAppId?: string;
  iosAppId?: string;
  /** `ca-app-pub-…/…` — blocs d'annonces, publics eux aussi. */
  androidBanniere?: string;
  iosBanniere?: string;
  androidInterstitiel?: string;
  iosInterstitiel?: string;
  androidRecompense?: string;
  iosRecompense?: string;
  /** Posé par app.config.js pour les compilations d'essai. */
  forcerTest?: boolean;
}

const extra = ((Constants.expoConfig?.extra ?? {}) as { admob?: ExtraAdmob }).admob ?? {};

/**
 * Force les blocs de test dans une compilation **de prévisualisation**.
 *
 * Sans ce drapeau, l'APK d'essai était inutilisable pour éprouver la
 * publicité : un paquet compilé en mode release a `__DEV__` à faux, donc
 * `EN_PRODUCTION` à vrai, donc — faute d'identifiants réels — **aucune
 * annonce du tout**. Rigoureusement correct, et rigoureusement inutile pour
 * vérifier qu'une bannière s'affiche sur un téléphone.
 *
 * La valeur vient de `app.config.js`, pas de `process.env` : voir
 * l'explication du cache de Metro dans ce fichier-là.
 */
const FORCER_BLOCS_TEST = extra.forcerTest === true;

/**
 * Vrai uniquement dans une compilation de production installée.
 * `__DEV__` couvre Metro ; `appOwnership` vaut `'expo'` dans Expo Go, où le
 * module natif n'existe de toute façon pas.
 */
export const EN_PRODUCTION =
  !__DEV__ && Constants.appOwnership !== 'expo' && !FORCER_BLOCS_TEST;

/** Les annonces affichées portent-elles la mention « Test Ad » ? */
export const EN_MODE_TEST = !EN_PRODUCTION;

const ios = Platform.OS === 'ios';

function unite(reelle: string | undefined, test: string): string | null {
  if (!EN_PRODUCTION) return test;
  // En production sans identifiant réel : pas d'annonce du tout.
  return reelle && reelle.startsWith('ca-app-pub-') ? reelle : null;
}

export const UNITES = {
  banniere: unite(
    ios ? extra.iosBanniere : extra.androidBanniere,
    ios ? UNITES_TEST.banniereIos : UNITES_TEST.banniere,
  ),
  interstitiel: unite(
    ios ? extra.iosInterstitiel : extra.androidInterstitiel,
    ios ? UNITES_TEST.interstitielIos : UNITES_TEST.interstitiel,
  ),
  recompense: unite(
    ios ? extra.iosRecompense : extra.androidRecompense,
    ios ? UNITES_TEST.recompenseIos : UNITES_TEST.recompense,
  ),
};

/** L'identifiant d'application est-il renseigné ? Sans lui, le SDK ne démarre pas. */
export const APP_ID_RENSEIGNE = Boolean(ios ? extra.iosAppId : extra.androidAppId);

/**
 * Règles de fréquence — le seul endroit où elles sont écrites.
 *
 * Les valeurs sont volontairement conservatrices : une application de jeux se
 * rouvre vingt fois par jour, et un interstitiel à chaque partie ferait fuir
 * le joueur bien avant de rapporter quoi que ce soit.
 */
export const FREQUENCE = {
  /** Parties terminées à accumuler avant de redevenir éligible. */
  partiesAvantInterstitiel: 3,
  /** Délai minimal entre deux interstitiels. */
  delaiEntreInterstitiels: 3 * 60 * 1000,
  /** Silence après le lancement : les premières minutes appartiennent au joueur. */
  graceApresDemarrage: 2 * 60 * 1000,
  /** Au-delà, une annonce préchargée est considérée comme périmée (règle Google : 1 h). */
  peremptionChargement: 50 * 60 * 1000,
} as const;

/**
 * Classement de contenu maximal demandé aux annonceurs.
 *
 * `G` = tout public. Plateau vise une classification PEGI 3 / 4+ : une annonce
 * de jeu d'argent ou de film d'horreur dans un catalogue de solitaires serait
 * incohérente, et ferait échouer la revue.
 */
export const CLASSEMENT_MAX = 'G' as const;

/**
 * Déclarer l'application « destinée aux enfants » (COPPA / Family Policy).
 *
 * **Laissé à `false` volontairement.** Plateau est une application tout public,
 * pas une application pour enfants : sa fiche ne vise pas la tranche 0-12 ans.
 * Activer ce drapeau interdit la publicité personnalisée, réduit fortement les
 * revenus et impose le programme « Conçu pour les familles » de Google Play.
 * À passer à `true` **uniquement** si la fiche Play Console déclare un public
 * cible enfant — voir docs/MONETISATION.md.
 */
export const PUBLIC_ENFANT = false;
