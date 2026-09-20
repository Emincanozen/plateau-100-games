/**
 * La frontière entre l'application et la régie publicitaire.
 *
 * Tout ce qui suit est du vocabulaire maison : aucun type de Google n'entre
 * ici. C'est ce qui permet de tester la logique d'affichage sans le SDK, et
 * de faire tourner l'application sur le web, où le module natif n'existe pas.
 */

/** Ce que l'encadrement du consentement (UMP) nous apprend. */
export interface InfoConsentement {
  /** Peut-on demander une annonce ? C'est la seule question qui compte. */
  peutDemander: boolean;
  /** L'utilisateur a-t-il accordé les finalités nécessaires à la personnalisation ? */
  personnalisationAutorisee: boolean;
  /** Le formulaire « choix de confidentialité » doit-il rester accessible ? */
  optionsRequises: boolean;
  /**
   * `true` quand le SDK n'a rien pu dire : pas de réseau, pas de module natif,
   * formulaire indisponible. On ne confond pas « refusé » et « inconnu ».
   */
  indetermine: boolean;
}

/** Issue d'une tentative d'affichage. Chaque cas est distinct : les tests s'en servent. */
export type IssueAffichage =
  | 'affiche'
  | 'sdk-indisponible'
  | 'consentement-manquant'
  | 'trop-tot'
  | 'pas-encore-charge'
  | 'echec-chargement'
  | 'partie-en-cours'
  | 'desactive';

/** Issue d'une publicité récompensée. */
export type IssueRecompense =
  | { accordee: true }
  | { accordee: false; raison: Exclude<IssueAffichage, 'affiche'> | 'abandonnee' };

/**
 * Le SDK, vu de l'application. L'implémentation réelle enveloppe
 * `react-native-google-mobile-ads` ; les tests en injectent une fausse.
 */
export interface AdaptateurPub {
  /** Faux sur le web, dans Expo Go, ou si le module natif manque. */
  readonly disponible: boolean;

  /** Encadrement du consentement. Doit être appelé avant `initialiser`. */
  recueillirConsentement(): Promise<InfoConsentement>;
  /** Relit l'état sans réafficher de formulaire. */
  lireConsentement(): Promise<InfoConsentement>;
  /** Rouvre le formulaire de choix, depuis les réglages. */
  ouvrirOptionsConfidentialite(): Promise<void>;

  /** Démarre le SDK Google Mobile Ads. À n'appeler qu'une fois le consentement réglé. */
  initialiser(personnalisation: boolean): Promise<void>;

  /** Précharge. Résout quand l'annonce est prête, rejette si le chargement échoue. */
  chargerInterstitiel(unite: string, personnalisation: boolean): Promise<void>;
  /** Affiche l'annonce préchargée. Rejette si rien n'est prêt. */
  montrerInterstitiel(): Promise<void>;

  chargerRecompense(unite: string, personnalisation: boolean): Promise<void>;
  /** `true` seulement si le SDK a émis l'événement « récompense gagnée ». */
  montrerRecompense(): Promise<boolean>;
}
