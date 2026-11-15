import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { creerAdaptateurGoogle } from './adaptateur';
import { FREQUENCE, UNITES } from './config';
import { MachinePub } from './machine';
import type { InfoConsentement, IssueAffichage, IssueRecompense } from './types';

/**
 * La régie — le point d'entrée unique de la publicité côté React.
 *
 * Les cent jeux ne l'utilisent pas : ils ne connaissent pas ce module. Seuls
 * le catalogue (bannière), l'hôte de jeu (interstitiel à la sortie) et les
 * réglages (choix de confidentialité) s'y branchent. Un jeu qui voudrait une
 * récompense passe par `useRecompense`, et rien d'autre ne change chez lui.
 */

interface RegieCtx {
  /** Bloc d'annonce de la bannière, ou `null` si aucune bannière ne doit s'afficher. */
  uniteBanniere: string | null;
  /** Vrai quand une annonce peut partir : consentement réglé et SDK démarré. */
  diffusionActive: boolean;
  consentement: InfoConsentement;
  /** Le formulaire de choix doit-il rester joignable depuis les réglages ? */
  optionsConfidentialiteDisponibles: boolean;
  ouvrirOptionsConfidentialite: () => Promise<void>;

  entrerEnPartie: () => void;
  quitterLaPartie: () => void;
  signalerPartieTerminee: () => void;
  montrerInterstitiel: () => Promise<IssueAffichage>;
  montrerRecompense: () => Promise<IssueRecompense>;
}

const VIDE: RegieCtx = {
  uniteBanniere: null,
  diffusionActive: false,
  consentement: {
    peutDemander: false,
    personnalisationAutorisee: false,
    optionsRequises: false,
    indetermine: true,
  },
  optionsConfidentialiteDisponibles: false,
  ouvrirOptionsConfidentialite: async () => {},
  entrerEnPartie: () => {},
  quitterLaPartie: () => {},
  signalerPartieTerminee: () => {},
  montrerInterstitiel: async () => 'sdk-indisponible',
  montrerRecompense: async () => ({ accordee: false, raison: 'sdk-indisponible' }),
};

const Ctx = createContext<RegieCtx>(VIDE);

export function RegiePubProvider({ children }: { children: React.ReactNode }) {
  // Une seule machine pour toute la durée de vie de l'application : le
  // compteur de fréquence ne doit pas se réinitialiser à chaque rendu.
  const reference = useRef<MachinePub | null>(null);
  if (reference.current === null) {
    reference.current = new MachinePub({
      adaptateur: creerAdaptateurGoogle(),
      unites: UNITES,
      frequence: FREQUENCE,
    });
  }
  const machine = reference as { current: MachinePub };

  const [version, setVersion] = useState(0);
  const rafraichir = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let vivant = true;
    // Volontairement sans `await` bloquant : si le réseau est absent, le
    // catalogue s'affiche quand même, immédiatement.
    machine.current.demarrer().then(() => {
      if (vivant) rafraichir();
    });
    return () => {
      vivant = false;
    };
  }, [rafraichir]);

  // Au retour d'arrière-plan, l'annonce préchargée peut avoir expiré.
  useEffect(() => {
    const onChange = (etat: AppStateStatus) => {
      if (etat === 'active') void machine.current.reprendre().then(rafraichir);
    };
    const abonnement = AppState.addEventListener('change', onChange);
    return () => abonnement.remove();
  }, [rafraichir]);

  // Piège n° 1 du projet : ces fonctions figurent dans les dépendances
  // d'effets côté jeux. Si leur identité changeait à chaque rafraîchissement
  // de la régie, les effets se rappelleraient en boucle. Elles sont donc
  // créées une fois pour toutes et lisent la machine à travers la ref.
  const entrerEnPartie = useCallback(() => machine.current.entrerEnPartie(), []);
  const quitterLaPartie = useCallback(() => machine.current.quitterLaPartie(), []);
  const signalerPartieTerminee = useCallback(() => machine.current.signalerPartieTerminee(), []);
  const montrerInterstitiel = useCallback(() => machine.current.montrerInterstitiel(), []);
  const montrerRecompense = useCallback(() => machine.current.montrerRecompense(), []);
  const ouvrirOptionsConfidentialite = useCallback(async () => {
    await machine.current.ouvrirOptionsConfidentialite();
    rafraichir();
  }, [rafraichir]);

  const valeur = useMemo<RegieCtx>(() => {
    const m = machine.current;
    // `version` n'est pas lu : il ne sert qu'à relire la machine, dont l'état
    // vit hors de React, quand quelque chose a bougé.
    void version;
    return {
      uniteBanniere: m.uniteBanniere,
      diffusionActive: m.pretADiffuser,
      consentement: m.infoConsentement,
      optionsConfidentialiteDisponibles: m.infoConsentement.optionsRequises,
      ouvrirOptionsConfidentialite,
      entrerEnPartie,
      quitterLaPartie,
      signalerPartieTerminee,
      montrerInterstitiel,
      montrerRecompense,
    };
  }, [
    version,
    ouvrirOptionsConfidentialite,
    entrerEnPartie,
    quitterLaPartie,
    signalerPartieTerminee,
    montrerInterstitiel,
    montrerRecompense,
  ]);

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useRegiePub() {
  return useContext(Ctx);
}

/**
 * Aide facultative rémunérée par une annonce.
 *
 * Contrat volontairement strict, pour qu'aucun jeu ne puisse se tromper :
 * `demander` renvoie `true` **seulement** si le SDK a confirmé la récompense.
 * Toute autre issue — pas de réseau, refus de consentement, annonce fermée en
 * route — renvoie `false`, et le jeu doit continuer normalement sans elle.
 */
export function useRecompense() {
  const { montrerRecompense, diffusionActive } = useRegiePub();
  const [enCours, setEnCours] = useState(false);
  // Le verrou vit dans une ref pour que `demander` garde son identité : elle
  // finit dans les dépendances d'effets des jeux.
  const verrou = useRef(false);

  const demander = useCallback(async (): Promise<boolean> => {
    if (verrou.current) return false;
    verrou.current = true;
    setEnCours(true);
    try {
      const issue = await montrerRecompense();
      return issue.accordee;
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }, [montrerRecompense]);

  return { demander, enCours, disponible: diffusionActive };
}
