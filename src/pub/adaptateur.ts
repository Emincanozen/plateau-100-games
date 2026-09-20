import type { AdaptateurPub, InfoConsentement } from './types';

/**
 * Adaptateur du web — celui qui ne fait rien.
 *
 * Metro choisit `adaptateur.native.ts` sur iOS et Android, et ce fichier-ci
 * sur le web. Ce n'est pas une coquetterie : Metro analyse les `require`
 * **statiquement**, même à l'intérieur d'un `try`. Un simple garde-fou
 * `Platform.OS === 'web'` ne suffisait pas, le paquet web refusait de se
 * construire avec l'erreur « Importing native-only module
 * codegenNativeComponent on web ». La séparation par extension de plateforme
 * est la seule qui empêche vraiment le module natif d'entrer dans le paquet.
 *
 * Conséquence voulue : `npm run web` reste utilisable pour développer et
 * pour éprouver les cent jeux, exactement comme avant la publicité.
 */

const INDETERMINE: InfoConsentement = {
  peutDemander: false,
  personnalisationAutorisee: false,
  optionsRequises: false,
  indetermine: true,
};

const ABSENT = () => Promise.reject(new Error('publicité indisponible sur cette plateforme'));

export function creerAdaptateurGoogle(): AdaptateurPub {
  return {
    disponible: false,
    recueillirConsentement: async () => INDETERMINE,
    lireConsentement: async () => INDETERMINE,
    ouvrirOptionsConfidentialite: async () => {},
    initialiser: ABSENT,
    chargerInterstitiel: ABSENT,
    montrerInterstitiel: ABSENT,
    chargerRecompense: ABSENT,
    montrerRecompense: ABSENT,
  };
}
