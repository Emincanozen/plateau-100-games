import type { AdaptateurPub, InfoConsentement, IssueAffichage, IssueRecompense } from './types';

/**
 * La machine décide **quand** une annonce a le droit d'apparaître. Elle ne
 * connaît ni React, ni Google : on lui passe un adaptateur et une horloge.
 *
 * Tout est ici pour une raison : c'est la seule partie de la publicité qu'on
 * peut éprouver sans téléphone. `outils/test-pub.ts` l'exécute avec un faux
 * adaptateur et une horloge qu'il pilote, et couvre les quatorze scénarios
 * demandés — refus de consentement, coupure réseau, échec de chargement,
 * plafond de fréquence, récompense non gagnée.
 */

export interface ReglesFrequence {
  partiesAvantInterstitiel: number;
  delaiEntreInterstitiels: number;
  graceApresDemarrage: number;
  peremptionChargement: number;
}

export interface UnitesPub {
  banniere: string | null;
  interstitiel: string | null;
  recompense: string | null;
}

export interface OptionsMachine {
  adaptateur: AdaptateurPub;
  unites: UnitesPub;
  frequence: ReglesFrequence;
  /** Injectée pour que les tests maîtrisent le temps. */
  maintenant?: () => number;
}

const CONSENTEMENT_INCONNU: InfoConsentement = {
  peutDemander: false,
  personnalisationAutorisee: false,
  optionsRequises: false,
  indetermine: true,
};

export class MachinePub {
  private readonly adaptateur: AdaptateurPub;
  private readonly unites: UnitesPub;
  private readonly frequence: ReglesFrequence;
  private readonly maintenant: () => number;

  private consentement: InfoConsentement = CONSENTEMENT_INCONNU;
  private demarree = false;
  private sdkPret = false;
  private instantDemarrage = 0;

  private partiesDepuis = 0;
  private dernierInterstitiel = 0;
  private interstitielChargeA: number | null = null;
  private chargementEnCours = false;
  /**
   * Le préchargement en cours. Le démarrage ne l'attend pas — il ne faut pas
   * qu'une annonce lente retarde l'application — mais `reprendre` et les
   * tests ont besoin d'un point de rendez-vous.
   */
  private enVol: Promise<void> | null = null;
  /** Dernier échec de chargement, pour distinguer « pas prêt » de « a échoué ». */
  private dernierEchec: string | null = null;

  private enPartie = false;
  private active = true;

  constructor(options: OptionsMachine) {
    this.adaptateur = options.adaptateur;
    this.unites = options.unites;
    this.frequence = options.frequence;
    this.maintenant = options.maintenant ?? (() => Date.now());
  }

  // --- Démarrage ----------------------------------------------------------

  /**
   * Consentement d'abord, SDK ensuite. L'ordre n'est pas négociable : Google
   * demande que l'encadrement du consentement (UMP) soit résolu avant
   * l'initialisation, sinon la première requête part sans base légale.
   *
   * Aucun `await` de cette méthode ne doit bloquer l'application : un joueur
   * dans le métro doit pouvoir ouvrir un jeu pendant que la requête échoue.
   */
  async demarrer(): Promise<void> {
    if (this.demarree) return;
    this.demarree = true;
    this.instantDemarrage = this.maintenant();

    if (!this.adaptateur.disponible) return;

    try {
      this.consentement = await this.adaptateur.recueillirConsentement();
    } catch {
      // Hors ligne, formulaire injoignable : on reste en « indéterminé », donc
      // sans annonce. On ne suppose jamais un accord.
      this.consentement = CONSENTEMENT_INCONNU;
      return;
    }

    if (!this.consentement.peutDemander) return;

    try {
      await this.adaptateur.initialiser(this.consentement.personnalisationAutorisee);
      this.sdkPret = true;
    } catch {
      this.sdkPret = false;
      return;
    }

    void this.prechargerInterstitiel();
  }

  /** Relit le consentement après un passage dans le formulaire des réglages. */
  async rafraichirConsentement(): Promise<InfoConsentement> {
    if (!this.adaptateur.disponible) return CONSENTEMENT_INCONNU;
    try {
      this.consentement = await this.adaptateur.lireConsentement();
    } catch {
      this.consentement = CONSENTEMENT_INCONNU;
    }
    return this.consentement;
  }

  async ouvrirOptionsConfidentialite(): Promise<void> {
    if (!this.adaptateur.disponible) return;
    await this.adaptateur.ouvrirOptionsConfidentialite();
    await this.rafraichirConsentement();
  }

  // --- État consultable ---------------------------------------------------

  get infoConsentement(): InfoConsentement {
    return this.consentement;
  }

  get personnalisation(): boolean {
    return this.consentement.personnalisationAutorisee;
  }

  get pretADiffuser(): boolean {
    return this.active && this.adaptateur.disponible && this.sdkPret && this.consentement.peutDemander;
  }

  /** La bannière n'a pas de règle de fréquence : elle est là ou elle n'est pas là. */
  get banniereAutorisee(): boolean {
    return this.pretADiffuser && this.unites.banniere !== null;
  }

  get uniteBanniere(): string | null {
    return this.banniereAutorisee ? this.unites.banniere : null;
  }

  /** Coupe toute diffusion — réservé aux réglages et aux tests. */
  definirActive(valeur: boolean): void {
    this.active = valeur;
  }

  // --- Cycle de vie d'une partie -----------------------------------------

  entrerEnPartie(): void {
    this.enPartie = true;
  }

  quitterLaPartie(): void {
    this.enPartie = false;
  }

  /** Appelé une fois par partie achevée — c'est le compteur de fréquence. */
  signalerPartieTerminee(): void {
    this.partiesDepuis += 1;
  }

  // --- Interstitiel -------------------------------------------------------

  private prechargerInterstitiel(): Promise<void> {
    const unite = this.unites.interstitiel;
    if (!unite || this.chargementEnCours || !this.pretADiffuser) return Promise.resolve();
    if (this.interstitielChargeA !== null) return Promise.resolve();

    this.chargementEnCours = true;
    const course = this.adaptateur.chargerInterstitiel(unite, this.personnalisation).then(
      () => {
        this.interstitielChargeA = this.maintenant();
        this.dernierEchec = null;
      },
      (erreur: unknown) => {
        this.interstitielChargeA = null;
        this.dernierEchec = erreur instanceof Error ? erreur.message : String(erreur);
      },
    ).finally(() => {
      this.chargementEnCours = false;
      if (this.enVol === course) this.enVol = null;
    });

    this.enVol = course;
    return course;
  }

  /**
   * Attend le préchargement en cours, s'il y en a un.
   *
   * L'application ne s'en sert pas : elle ne doit jamais attendre une
   * annonce. C'est le point de rendez-vous des tests, et de `reprendre`.
   */
  attendrePrechargement(): Promise<void> {
    return this.enVol ?? Promise.resolve();
  }

  /** Force un préchargement — utilisé au retour d'arrière-plan. */
  async reprendre(): Promise<void> {
    if (!this.demarree) return;
    await this.attendrePrechargement();
    if (this.interstitielPerime()) this.interstitielChargeA = null;
    await this.prechargerInterstitiel();
  }

  private interstitielPerime(): boolean {
    if (this.interstitielChargeA === null) return false;
    return this.maintenant() - this.interstitielChargeA > this.frequence.peremptionChargement;
  }

  /**
   * Décide sans rien afficher. Séparée de `montrerInterstitiel` pour que les
   * tests lisent la raison exacte d'un refus.
   */
  evaluerInterstitiel(): IssueAffichage {
    if (!this.active) return 'desactive';
    if (!this.adaptateur.disponible) return 'sdk-indisponible';
    if (this.unites.interstitiel === null) return 'desactive';
    if (this.enPartie) return 'partie-en-cours';
    if (!this.consentement.peutDemander) return 'consentement-manquant';
    if (!this.sdkPret) return 'sdk-indisponible';

    const t = this.maintenant();
    if (t - this.instantDemarrage < this.frequence.graceApresDemarrage) return 'trop-tot';
    if (this.partiesDepuis < this.frequence.partiesAvantInterstitiel) return 'trop-tot';
    if (this.dernierInterstitiel !== 0 && t - this.dernierInterstitiel < this.frequence.delaiEntreInterstitiels) {
      return 'trop-tot';
    }

    if (this.interstitielChargeA === null) {
      return this.dernierEchec !== null ? 'echec-chargement' : 'pas-encore-charge';
    }
    if (this.interstitielPerime()) return 'pas-encore-charge';

    return 'affiche';
  }

  /**
   * Tente l'affichage. Ne jette jamais : un échec publicitaire ne doit pas
   * remonter jusqu'au joueur, qui n'a rien demandé.
   */
  async montrerInterstitiel(): Promise<IssueAffichage> {
    const verdict = this.evaluerInterstitiel();
    if (verdict !== 'affiche') {
      // Un refus pour cause de chargement relance une tentative en fond.
      if (verdict === 'pas-encore-charge' || verdict === 'echec-chargement') {
        void this.prechargerInterstitiel();
      }
      return verdict;
    }

    try {
      await this.adaptateur.montrerInterstitiel();
    } catch {
      this.interstitielChargeA = null;
      void this.prechargerInterstitiel();
      return 'echec-chargement';
    }

    this.dernierInterstitiel = this.maintenant();
    this.partiesDepuis = 0;
    this.interstitielChargeA = null;
    void this.prechargerInterstitiel();
    return 'affiche';
  }

  // --- Récompensée --------------------------------------------------------

  /**
   * Une récompense n'est accordée qu'après l'événement du SDK. Fermer
   * l'annonce en avance, perdre le réseau, ne pas avoir consenti : dans tous
   * ces cas on renvoie `accordee: false`, et l'appelant ne donne rien.
   *
   * Symétriquement, l'indisponibilité ne bloque jamais le jeu : l'appelant
   * garde son chemin normal, la récompense est simplement un bonus.
   */
  async montrerRecompense(): Promise<IssueRecompense> {
    if (!this.active) return { accordee: false, raison: 'desactive' };
    if (!this.adaptateur.disponible) return { accordee: false, raison: 'sdk-indisponible' };
    const unite = this.unites.recompense;
    if (unite === null) return { accordee: false, raison: 'desactive' };
    if (!this.consentement.peutDemander) return { accordee: false, raison: 'consentement-manquant' };
    if (!this.sdkPret) return { accordee: false, raison: 'sdk-indisponible' };

    try {
      await this.adaptateur.chargerRecompense(unite, this.personnalisation);
    } catch {
      return { accordee: false, raison: 'echec-chargement' };
    }

    let gagnee = false;
    try {
      gagnee = await this.adaptateur.montrerRecompense();
    } catch {
      return { accordee: false, raison: 'echec-chargement' };
    }

    return gagnee ? { accordee: true } : { accordee: false, raison: 'abandonnee' };
  }

  // --- Introspection, pour les tests et le journal de bord ----------------

  get diagnostic() {
    return {
      demarree: this.demarree,
      sdkPret: this.sdkPret,
      consentement: this.consentement,
      partiesDepuis: this.partiesDepuis,
      interstitielCharge: this.interstitielChargeA !== null,
      dernierEchec: this.dernierEchec,
      enPartie: this.enPartie,
      active: this.active,
    };
  }
}
