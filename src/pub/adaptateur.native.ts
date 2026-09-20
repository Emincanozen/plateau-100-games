import Constants from 'expo-constants';
import type {
  AdEventType as TypeEvenement,
  InterstitialAd as TypeInterstitiel,
  RewardedAd as TypeRecompense,
  RewardedAdEventType as TypeEvenementRecompense,
} from 'react-native-google-mobile-ads';
import { CLASSEMENT_MAX, PUBLIC_ENFANT } from './config';
import type { AdaptateurPub, InfoConsentement } from './types';

/**
 * L'unique fichier qui touche `react-native-google-mobile-ads`.
 *
 * Extension `.native` volontaire : Metro ne le retient que pour iOS et
 * Android. Le web reçoit `adaptateur.ts`, qui ne connaît pas le SDK — sans
 * cette séparation, le paquet web refuse même de se construire.
 *
 * Le `require` reste tardif et gardé malgré tout : dans Expo Go le module JS
 * se résout mais la partie native manque. L'application doit continuer à
 * fonctionner, simplement sans publicité.
 */

const INDETERMINE: InfoConsentement = {
  peutDemander: false,
  personnalisationAutorisee: false,
  optionsRequises: false,
  indetermine: true,
};

/** Les finalités du cadre TCF dont dépend la publicité personnalisée. */
const FINALITES_PERSONNALISATION = [
  'selectPersonalisedAds',
  'createAPersonalisedAdsProfile',
] as const;

type ModulePub = typeof import('react-native-google-mobile-ads');

let module: ModulePub | null = null;
let tentee = false;

/** Expo Go embarque un jeu de modules fixe : le nôtre n'en fait pas partie. */
const dansExpoGo = Constants.appOwnership === 'expo';

function charger(): ModulePub | null {
  if (tentee) return module;
  tentee = true;
  if (dansExpoGo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require('react-native-google-mobile-ads') as ModulePub;
  } catch {
    module = null;
  }
  return module;
}

/**
 * Attend un événement du SDK, avec une échéance.
 *
 * Sans échéance, une annonce qui ne charge jamais laisserait une promesse en
 * suspens et, avec elle, l'écouteur natif : la fuite est silencieuse et ne se
 * voit qu'après une heure de jeu.
 */
function avecEcheance<T>(promesse: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error(message)), ms);
    promesse.then(
      (valeur) => {
        clearTimeout(minuteur);
        resoudre(valeur);
      },
      (erreur) => {
        clearTimeout(minuteur);
        rejeter(erreur);
      },
    );
  });
}

const ECHEANCE_CHARGEMENT = 15_000;

export function creerAdaptateurGoogle(): AdaptateurPub {
  const pub = charger();

  let interstitiel: TypeInterstitiel | null = null;
  let recompense: TypeRecompense | null = null;

  /** Détache tout : un objet d'annonce consommé ne se réutilise pas. */
  function jeter(annonce: TypeInterstitiel | TypeRecompense | null) {
    if (!annonce) return;
    try {
      annonce.removeAllListeners();
    } catch {
      /* déjà détruit */
    }
  }

  function lireInfo(info: {
    canRequestAds: boolean;
    privacyOptionsRequirementStatus: string;
  }, personnalisation: boolean): InfoConsentement {
    return {
      peutDemander: info.canRequestAds,
      personnalisationAutorisee: personnalisation,
      optionsRequises: info.privacyOptionsRequirementStatus === 'REQUIRED',
      indetermine: false,
    };
  }

  /**
   * La personnalisation ne se déduit pas du statut global : un utilisateur
   * peut accepter le formulaire tout en refusant le profilage. On lit les
   * finalités réellement accordées.
   */
  async function personnalisationAccordee(): Promise<boolean> {
    if (!pub) return false;
    try {
      const choix = await pub.AdsConsent.getUserChoices();
      return FINALITES_PERSONNALISATION.every((f) => choix[f] === true);
    } catch {
      // Hors zone TCF (pas d'obligation de recueil), Google autorise la
      // personnalisation par défaut ; le formulaire n'a rien à dire.
      return true;
    }
  }

  return {
    disponible: pub !== null,

    async recueillirConsentement() {
      if (!pub) return INDETERMINE;
      const info = await pub.AdsConsent.gatherConsent({
        tagForUnderAgeOfConsent: PUBLIC_ENFANT,
      });
      return lireInfo(info, info.canRequestAds ? await personnalisationAccordee() : false);
    },

    async lireConsentement() {
      if (!pub) return INDETERMINE;
      const info = await pub.AdsConsent.getConsentInfo();
      return lireInfo(info, info.canRequestAds ? await personnalisationAccordee() : false);
    },

    async ouvrirOptionsConfidentialite() {
      if (!pub) return;
      await pub.AdsConsent.showPrivacyOptionsForm();
    },

    async initialiser(personnalisation: boolean) {
      if (!pub) throw new Error('module publicitaire absent');
      await pub.MobileAds().setRequestConfiguration({
        maxAdContentRating: CLASSEMENT_MAX as never,
        tagForChildDirectedTreatment: PUBLIC_ENFANT,
        tagForUnderAgeOfConsent: PUBLIC_ENFANT,
        // Sans consentement au profilage, on le dit explicitement au SDK en
        // plus de le dire à chaque requête : ceinture et bretelles.
        publisherPrivacyPersonalizationState: personnalisation ? 'enabled' : 'disabled',
      });
      await pub.MobileAds().initialize();
    },

    chargerInterstitiel(unite: string, personnalisation: boolean) {
      if (!pub) return Promise.reject(new Error('module publicitaire absent'));
      jeter(interstitiel);
      const annonce = pub.InterstitialAd.createForAdRequest(unite, {
        requestNonPersonalizedAdsOnly: !personnalisation,
      });
      interstitiel = annonce;

      const attente = new Promise<void>((resoudre, rejeter) => {
        const evt = pub.AdEventType as typeof TypeEvenement;
        annonce.addAdEventListener(evt.LOADED, () => resoudre());
        annonce.addAdEventListener(evt.ERROR, (erreur) =>
          rejeter(erreur instanceof Error ? erreur : new Error(String(erreur))),
        );
      });

      annonce.load();
      return avecEcheance(attente, ECHEANCE_CHARGEMENT, 'interstitiel : délai dépassé');
    },

    montrerInterstitiel() {
      const annonce = interstitiel;
      if (!pub || !annonce) return Promise.reject(new Error('aucun interstitiel prêt'));
      const evt = pub.AdEventType as typeof TypeEvenement;

      // On rend la main quand l'annonce se ferme, pas quand elle s'ouvre :
      // l'appelant reprend le fil du jeu seulement à ce moment-là.
      const fermeture = new Promise<void>((resoudre, rejeter) => {
        annonce.addAdEventListener(evt.CLOSED, () => resoudre());
        annonce.addAdEventListener(evt.ERROR, (erreur) =>
          rejeter(erreur instanceof Error ? erreur : new Error(String(erreur))),
        );
      });

      return annonce
        .show()
        .then(() => fermeture)
        .finally(() => {
          jeter(annonce);
          if (interstitiel === annonce) interstitiel = null;
        });
    },

    chargerRecompense(unite: string, personnalisation: boolean) {
      if (!pub) return Promise.reject(new Error('module publicitaire absent'));
      jeter(recompense);
      const annonce = pub.RewardedAd.createForAdRequest(unite, {
        requestNonPersonalizedAdsOnly: !personnalisation,
      });
      recompense = annonce;

      const attente = new Promise<void>((resoudre, rejeter) => {
        const evtR = pub.RewardedAdEventType as typeof TypeEvenementRecompense;
        const evt = pub.AdEventType as typeof TypeEvenement;
        annonce.addAdEventListener(evtR.LOADED, () => resoudre());
        annonce.addAdEventListener(evt.ERROR, (erreur) =>
          rejeter(erreur instanceof Error ? erreur : new Error(String(erreur))),
        );
      });

      annonce.load();
      return avecEcheance(attente, ECHEANCE_CHARGEMENT, 'récompensée : délai dépassé');
    },

    montrerRecompense() {
      const annonce = recompense;
      if (!pub || !annonce) return Promise.reject(new Error('aucune récompensée prête'));
      const evt = pub.AdEventType as typeof TypeEvenement;
      const evtR = pub.RewardedAdEventType as typeof TypeEvenementRecompense;

      // `gagnee` ne passe à vrai que sur l'événement du SDK. Fermer l'annonce
      // en cours de route laisse la valeur à faux, et rien n'est accordé.
      let gagnee = false;
      const fin = new Promise<boolean>((resoudre, rejeter) => {
        annonce.addAdEventListener(evtR.EARNED_REWARD, () => {
          gagnee = true;
        });
        annonce.addAdEventListener(evt.CLOSED, () => resoudre(gagnee));
        annonce.addAdEventListener(evt.ERROR, (erreur) =>
          rejeter(erreur instanceof Error ? erreur : new Error(String(erreur))),
        );
      });

      return annonce
        .show()
        .then(() => fin)
        .finally(() => {
          jeter(annonce);
          if (recompense === annonce) recompense = null;
        });
    },
  };
}
