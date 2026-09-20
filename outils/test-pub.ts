/**
 * Contrôle de la logique publicitaire.
 *
 *   npx.cmd tsx outils/test-pub.ts
 *
 * Ce que ces tests prouvent : la machine décide correctement **quand** une
 * annonce a le droit d'apparaître, et se tait dans tous les cas où elle le
 * doit. Ils exécutent le vrai code de `src/pub/machine.ts` avec un faux SDK
 * et une horloge pilotée, donc sans réseau, sans compte AdMob et sans
 * téléphone.
 *
 * Ce qu'ils ne prouvent pas, et il faut le dire : que le SDK de Google
 * fonctionne. Un adaptateur simulé ne remplace pas une annonce réelle
 * affichée sur un appareil. Cette vérification-là est listée NOT RUN dans
 * docs/RAPPORT_FINAL_VALIDATION.md tant qu'aucun build natif n'a tourné.
 */
import fs from 'node:fs';
import { MachinePub, type ReglesFrequence, type UnitesPub } from '../src/pub/machine';
import type { AdaptateurPub, InfoConsentement } from '../src/pub/types';

let echoues = 0;
let passes = 0;

function verifier(condition: boolean, quoi: string) {
  if (condition) passes += 1;
  else {
    echoues += 1;
    console.error('  ECHEC — ' + quoi);
  }
}

function egal<T>(obtenu: T, attendu: T, quoi: string) {
  verifier(
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `${quoi} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`,
  );
}

function titre(t: string) {
  console.log('\n' + t);
}

// ------------------------------------------------------------ outillage ---

const UNITES: UnitesPub = {
  banniere: 'test/banniere',
  interstitiel: 'test/interstitiel',
  recompense: 'test/recompense',
};

const FREQUENCE: ReglesFrequence = {
  partiesAvantInterstitiel: 3,
  delaiEntreInterstitiels: 180_000,
  graceApresDemarrage: 120_000,
  peremptionChargement: 3_000_000,
};

const ACCEPTE: InfoConsentement = {
  peutDemander: true,
  personnalisationAutorisee: true,
  optionsRequises: true,
  indetermine: false,
};

const REFUSE: InfoConsentement = {
  peutDemander: false,
  personnalisationAutorisee: false,
  optionsRequises: true,
  indetermine: false,
};

const SANS_PROFILAGE: InfoConsentement = {
  peutDemander: true,
  personnalisationAutorisee: false,
  optionsRequises: true,
  indetermine: false,
};

const INDETERMINE: InfoConsentement = {
  peutDemander: false,
  personnalisationAutorisee: false,
  optionsRequises: false,
  indetermine: true,
};

interface OptionsFaux {
  disponible?: boolean;
  consentement?: InfoConsentement;
  /** Simule une coupure réseau : tout appel au SDK rejette. */
  horsLigne?: boolean;
  /** Le chargement d'annonce échoue. */
  chargementEchoue?: boolean;
  /** L'affichage échoue alors que le chargement avait réussi. */
  affichageEchoue?: boolean;
  /** L'utilisateur regarde la récompensée jusqu'au bout. */
  recompenseGagnee?: boolean;
  /** L'initialisation du SDK échoue. */
  initEchoue?: boolean;
}

interface FauxAdaptateur extends AdaptateurPub {
  journal: string[];
  npaDemande: boolean[];
}

function fauxAdaptateur(o: OptionsFaux = {}): FauxAdaptateur {
  const journal: string[] = [];
  const npaDemande: boolean[] = [];
  const horsLigne = () => Promise.reject(new Error('réseau indisponible'));

  return {
    journal,
    npaDemande,
    disponible: o.disponible ?? true,

    async recueillirConsentement() {
      journal.push('consentement');
      if (o.horsLigne) return horsLigne();
      return o.consentement ?? ACCEPTE;
    },
    async lireConsentement() {
      journal.push('lecture-consentement');
      if (o.horsLigne) return horsLigne();
      return o.consentement ?? ACCEPTE;
    },
    async ouvrirOptionsConfidentialite() {
      journal.push('options');
    },
    async initialiser(personnalisation: boolean) {
      journal.push('init');
      npaDemande.push(!personnalisation);
      if (o.horsLigne || o.initEchoue) return horsLigne();
    },
    async chargerInterstitiel(_unite: string, personnalisation: boolean) {
      journal.push('charge-interstitiel');
      npaDemande.push(!personnalisation);
      if (o.horsLigne || o.chargementEchoue) return horsLigne();
    },
    async montrerInterstitiel() {
      journal.push('montre-interstitiel');
      if (o.affichageEchoue) return Promise.reject(new Error('affichage impossible'));
    },
    async chargerRecompense(_unite: string, personnalisation: boolean) {
      journal.push('charge-recompense');
      npaDemande.push(!personnalisation);
      if (o.horsLigne || o.chargementEchoue) return horsLigne();
    },
    async montrerRecompense() {
      journal.push('montre-recompense');
      return o.recompenseGagnee ?? false;
    },
  };
}

/** Horloge pilotée : les tests avancent le temps à la milliseconde près. */
function horloge(depart = 1_000_000) {
  let t = depart;
  return {
    maintenant: () => t,
    avancer: (ms: number) => {
      t += ms;
    },
  };
}

function machineAvec(o: OptionsFaux = {}, h = horloge()) {
  const adaptateur = fauxAdaptateur(o);
  const machine = new MachinePub({
    adaptateur,
    unites: UNITES,
    frequence: FREQUENCE,
    maintenant: h.maintenant,
  });
  return { machine, adaptateur, h };
}

/**
 * Amène la machine à l'état « tout est prêt, un interstitiel peut partir ».
 * Trois parties terminées, la période de grâce passée, hors partie.
 */
async function rendreEligible(machine: MachinePub, h: ReturnType<typeof horloge>) {
  await machine.demarrer();
  // Le démarrage lance le préchargement sans l'attendre — c'est voulu, pour
  // que l'application ne dépende jamais d'une annonce. Le test, lui, a
  // besoin de savoir où il en est.
  await machine.attendrePrechargement();
  h.avancer(FREQUENCE.graceApresDemarrage + 1000);
  for (let i = 0; i < FREQUENCE.partiesAvantInterstitiel; i++) machine.signalerPartieTerminee();
}

// `tsx` compile ce fichier en CommonJS, où le `await` de premier niveau
// n'existe pas : tout le déroulé tient donc dans une fonction.
async function principal() {

// ----------------------------------------------- 1. initialisation du SDK ---

titre('1. Initialisation du SDK');
{
  const { machine, adaptateur } = machineAvec();
  await machine.demarrer();
  egal(
    adaptateur.journal.slice(0, 2),
    ['consentement', 'init'],
    'le consentement est recueilli AVANT l’initialisation du SDK',
  );
  verifier(machine.diagnostic.sdkPret, 'le SDK est marqué prêt après une initialisation réussie');
  verifier(machine.pretADiffuser, 'la diffusion est ouverte');

  // Un second appel ne doit pas relancer la séquence.
  const avant = adaptateur.journal.length;
  await machine.demarrer();
  egal(adaptateur.journal.length, avant, 'démarrer deux fois n’initialise pas deux fois');
}

{
  const { machine } = machineAvec({ initEchoue: true });
  await machine.demarrer();
  verifier(!machine.diagnostic.sdkPret, 'une initialisation qui échoue ne marque pas le SDK prêt');
  verifier(!machine.pretADiffuser, 'et aucune diffusion n’est ouverte');
}

// -------------------------------------------------- 2. consentement donné ---

titre('2. Consentement accepté');
{
  const { machine, adaptateur } = machineAvec({ consentement: ACCEPTE });
  await machine.demarrer();
  verifier(machine.personnalisation, 'la personnalisation est autorisée');
  egal(adaptateur.npaDemande[0], false, 'le SDK est initialisé en mode personnalisé');
  verifier(machine.banniereAutorisee, 'la bannière est autorisée');
  egal(machine.uniteBanniere, UNITES.banniere, 'le bloc de bannière est exposé');
}

{
  // Accepter le formulaire sans accepter le profilage : cas fréquent en UE.
  const { machine, adaptateur } = machineAvec({ consentement: SANS_PROFILAGE });
  await machine.demarrer();
  verifier(machine.pretADiffuser, 'la diffusion reste ouverte sans profilage');
  verifier(!machine.personnalisation, 'mais la personnalisation est refusée');
  verifier(
    adaptateur.npaDemande.every((npa) => npa === true),
    'toutes les requêtes partent en « non personnalisé »',
  );
}

// -------------------------------------------------- 3. consentement refusé ---

titre('3. Consentement refusé');
{
  const { machine, adaptateur } = machineAvec({ consentement: REFUSE });
  await machine.demarrer();
  verifier(!machine.pretADiffuser, 'aucune diffusion n’est ouverte');
  egal(machine.uniteBanniere, null, 'aucune bannière');
  verifier(!adaptateur.journal.includes('init'), 'le SDK n’est même pas initialisé');
  verifier(
    !adaptateur.journal.includes('charge-interstitiel'),
    'et aucune annonce n’est préchargée — un refus n’est pas contourné',
  );

  const h2 = horloge();
  h2.avancer(FREQUENCE.graceApresDemarrage + 1000);
  for (let i = 0; i < 10; i++) machine.signalerPartieTerminee();
  egal(
    machine.evaluerInterstitiel(),
    'consentement-manquant',
    'même après dix parties, le refus tient',
  );
  const issue = await machine.montrerRecompense();
  egal(issue, { accordee: false, raison: 'consentement-manquant' }, 'et la récompensée est refusée');
}

// --------------------------------------------- 4. consentement indisponible ---

titre('4. Consentement indéterminé');
{
  const { machine } = machineAvec({ horsLigne: true });
  await machine.demarrer();
  egal(machine.infoConsentement, INDETERMINE, 'l’état reste « indéterminé »');
  verifier(
    !machine.infoConsentement.peutDemander,
    'un état inconnu ne vaut jamais un accord : aucune annonce',
  );
  egal(machine.evaluerInterstitiel(), 'consentement-manquant', 'l’interstitiel est bloqué');
}

// -------------------------------------------------------- 5. hors connexion ---

titre('5. Absence de connexion');
{
  const { machine, adaptateur } = machineAvec({ horsLigne: true });
  await machine.demarrer();
  verifier(machine.diagnostic.demarree, 'la machine a bien tourné');
  verifier(!machine.diagnostic.sdkPret, 'sans réussir à démarrer le SDK');
  egal(adaptateur.journal, ['consentement'], 'elle s’arrête au premier échec, sans insister');
  // Le point essentiel : rien n’a jeté.
  verifier(true, 'aucune exception n’est remontée jusqu’à l’application');
}

// --------------------------------------------------- 6. échec de chargement ---

titre('6. Échec du chargement publicitaire');
{
  const h = horloge();
  const { machine, adaptateur } = machineAvec({ chargementEchoue: true }, h);
  await rendreEligible(machine, h);
  verifier(
    adaptateur.journal.includes('charge-interstitiel'),
    'un préchargement a bien été tenté',
  );
  egal(machine.evaluerInterstitiel(), 'echec-chargement', 'l’échec est signalé comme tel');
  const issue = await machine.montrerInterstitiel();
  egal(issue, 'echec-chargement', 'et l’affichage renvoie cet échec sans rien montrer');
  verifier(
    !adaptateur.journal.includes('montre-interstitiel'),
    'le SDK n’est jamais sollicité pour montrer une annonce absente',
  );
}

{
  // Chargement réussi, affichage qui échoue quand même.
  const h = horloge();
  const { machine } = machineAvec({ affichageEchoue: true }, h);
  await rendreEligible(machine, h);
  const issue = await machine.montrerInterstitiel();
  egal(issue, 'echec-chargement', 'un affichage qui échoue ne fait pas planter la sortie de jeu');
}

// ------------------------------------------------ 7. interstitiel absent ----

titre('7. Interstitiel indisponible');
{
  const h = horloge();
  const adaptateur = fauxAdaptateur();
  // Aucun bloc d'annonce configuré : c'est le cas d'une production sans
  // identifiants AdMob renseignés.
  const machine = new MachinePub({
    adaptateur,
    unites: { banniere: null, interstitiel: null, recompense: null },
    frequence: FREQUENCE,
    maintenant: h.maintenant,
  });
  await rendreEligible(machine, h);
  egal(machine.evaluerInterstitiel(), 'desactive', 'sans bloc d’annonce, la publicité est éteinte');
  egal(machine.uniteBanniere, null, 'et la bannière ne s’affiche pas');
  egal(
    await machine.montrerRecompense(),
    { accordee: false, raison: 'desactive' },
    'la récompensée aussi',
  );
}

{
  const h = horloge();
  const { machine } = machineAvec({ disponible: false }, h);
  await rendreEligible(machine, h);
  egal(
    machine.evaluerInterstitiel(),
    'sdk-indisponible',
    'sans module natif (web, Expo Go), rien ne part',
  );
}

// ------------------------------------------------- 8. limite de fréquence ---

titre('8. Limitation de fréquence');
{
  const h = horloge();
  const { machine } = machineAvec({}, h);
  await machine.demarrer();

  egal(machine.evaluerInterstitiel(), 'trop-tot', 'rien dans les deux premières minutes');
  h.avancer(FREQUENCE.graceApresDemarrage + 1);
  egal(machine.evaluerInterstitiel(), 'trop-tot', 'ni avant trois parties terminées');

  machine.signalerPartieTerminee();
  machine.signalerPartieTerminee();
  egal(machine.evaluerInterstitiel(), 'trop-tot', 'deux parties ne suffisent pas');

  machine.signalerPartieTerminee();
  egal(machine.evaluerInterstitiel(), 'affiche', 'à la troisième, l’annonce est autorisée');
  egal(await machine.montrerInterstitiel(), 'affiche', 'elle part');

  egal(machine.evaluerInterstitiel(), 'trop-tot', 'le compteur est remis à zéro juste après');
  for (let i = 0; i < 3; i++) machine.signalerPartieTerminee();
  egal(
    machine.evaluerInterstitiel(),
    'trop-tot',
    'trois parties de plus ne suffisent pas : le délai de trois minutes court encore',
  );

  h.avancer(FREQUENCE.delaiEntreInterstitiels + 1);
  egal(machine.evaluerInterstitiel(), 'affiche', 'une fois le délai écoulé, elle redevient possible');
}

{
  // Dix parties d'affilée ne doivent pas produire dix annonces.
  const h = horloge();
  const { machine } = machineAvec({}, h);
  await machine.demarrer();
  h.avancer(FREQUENCE.graceApresDemarrage + 1);
  let affichees = 0;
  for (let partie = 0; partie < 30; partie++) {
    machine.signalerPartieTerminee();
    if ((await machine.montrerInterstitiel()) === 'affiche') affichees += 1;
    h.avancer(30_000); // une partie dure une demi-minute
  }
  verifier(
    affichees >= 2 && affichees <= 5,
    `30 parties en 15 minutes produisent ${affichees} interstitiels (attendu : entre 2 et 5)`,
  );
}

// ------------------------------------------------ 9. récompense accordée ---

titre('9. Récompense accordée');
{
  const h = horloge();
  const { machine, adaptateur } = machineAvec({ recompenseGagnee: true }, h);
  await machine.demarrer();
  const issue = await machine.montrerRecompense();
  egal(issue, { accordee: true }, 'la récompense est accordée quand le SDK la confirme');
  egal(
    adaptateur.journal.slice(-2),
    ['charge-recompense', 'montre-recompense'],
    'elle est chargée puis montrée',
  );
}

// -------------------------------------------- 10. récompense non accordée ---

titre('10. Absence de récompense quand les conditions ne sont pas remplies');
{
  const h = horloge();
  const { machine } = machineAvec({ recompenseGagnee: false }, h);
  await machine.demarrer();
  egal(
    await machine.montrerRecompense(),
    { accordee: false, raison: 'abandonnee' },
    'annonce fermée en cours de route : rien n’est accordé',
  );
}
{
  const { machine } = machineAvec({ chargementEchoue: true });
  await machine.demarrer();
  egal(
    await machine.montrerRecompense(),
    { accordee: false, raison: 'echec-chargement' },
    'annonce introuvable : rien n’est accordé',
  );
}
{
  const { machine } = machineAvec({ disponible: false });
  await machine.demarrer();
  egal(
    await machine.montrerRecompense(),
    { accordee: false, raison: 'sdk-indisponible' },
    'pas de SDK : rien n’est accordé',
  );
}

// ------------------------------------- 11. reprise après arrière-plan ------

titre('11. Reprise après un passage en arrière-plan');
{
  const h = horloge();
  const { machine, adaptateur } = machineAvec({}, h);
  await rendreEligible(machine, h);
  verifier(machine.diagnostic.interstitielCharge, 'une annonce est préchargée');

  // Le téléphone reste en arrière-plan plus longtemps que la péremption.
  h.avancer(FREQUENCE.peremptionChargement + 60_000);
  egal(
    machine.evaluerInterstitiel(),
    'pas-encore-charge',
    'l’annonce périmée n’est pas montrée',
  );

  const avant = adaptateur.journal.filter((e) => e === 'charge-interstitiel').length;
  await machine.reprendre();
  const apres = adaptateur.journal.filter((e) => e === 'charge-interstitiel').length;
  verifier(apres > avant, 'la reprise relance un préchargement');
  egal(machine.evaluerInterstitiel(), 'affiche', 'et l’annonce fraîche redevient affichable');
}

// ------------------------------------------- 12. jamais pendant une partie ---

titre('12. Aucune publicité pendant une partie');
{
  const h = horloge();
  const { machine, adaptateur } = machineAvec({}, h);
  await rendreEligible(machine, h);

  machine.entrerEnPartie();
  egal(machine.evaluerInterstitiel(), 'partie-en-cours', 'la partie bloque l’interstitiel');
  egal(await machine.montrerInterstitiel(), 'partie-en-cours', 'et l’affichage est refusé');
  verifier(
    !adaptateur.journal.includes('montre-interstitiel'),
    'le SDK n’est jamais appelé tant que le joueur est dans un jeu',
  );

  // Même en accumulant des parties terminées sans quitter l'écran.
  for (let i = 0; i < 10; i++) machine.signalerPartieTerminee();
  egal(machine.evaluerInterstitiel(), 'partie-en-cours', 'dix fins de partie ne forcent rien');

  machine.quitterLaPartie();
  egal(machine.evaluerInterstitiel(), 'affiche', 'une fois sorti du jeu, l’annonce est possible');
}

// ------------------------------ 13. disposition : pas de clic accidentel ---

titre('13. Disposition — aucun piège à clic');
{
  const banniereNative = fs.readFileSync('src/ui/Banniere.native.tsx', 'utf8');
  verifier(
    /hauteur > 0 \? hauteur \+ space\.sm \+ marge : 0/.test(banniereNative),
    'la bannière n’occupe aucune hauteur tant qu’aucune annonce n’est chargée',
  );
  verifier(
    /onAdFailedToLoad/.test(banniereNative) && /setEchec\(true\)/.test(banniereNative),
    'un échec de chargement retire l’emplacement au lieu de laisser un trou',
  );

  // Aucun des cent jeux ne doit contenir de publicité : la surface de jeu
  // reste entièrement à eux.
  const dossiers = ['plateau', 'cartes', 'logique', 'arcade', 'des', 'papier'];
  const fautifs: string[] = [];
  for (const d of dossiers) {
    for (const f of fs.readdirSync(`src/games/${d}`)) {
      const src = fs.readFileSync(`src/games/${d}/${f}`, 'utf8');
      if (/Banniere|BannerAd|google-mobile-ads|montrerInterstitiel/.test(src)) {
        fautifs.push(`${d}/${f}`);
      }
    }
  }
  egal(fautifs, [], 'aucun fichier de jeu ne contient de bannière ni d’interstitiel');

  // La bannière ne doit pas se trouver dans l'hôte de jeu non plus.
  const hote = fs.readFileSync('app/game/[id].tsx', 'utf8');
  verifier(!/Banniere/.test(hote), 'l’écran de jeu ne porte aucune bannière');
  verifier(
    /entrerEnPartie\(\)/.test(hote) && /return quitterLaPartie/.test(hote),
    'l’écran de jeu verrouille la publicité tant qu’il est monté',
  );
}

// ------------------------- 14. le jeu n'est jamais bloqué par la publicité ---

titre('14. Les jeux ne dépendent jamais de la publicité');
{
  // Panne totale : pas de module, pas de réseau, pas de consentement.
  const h = horloge();
  const { machine } = machineAvec({ disponible: false, horsLigne: true }, h);
  await machine.demarrer();
  h.avancer(FREQUENCE.graceApresDemarrage + 1);
  for (let i = 0; i < 5; i++) machine.signalerPartieTerminee();

  egal(machine.evaluerInterstitiel(), 'sdk-indisponible', 'la machine le dit clairement');
  egal(await machine.montrerInterstitiel(), 'sdk-indisponible', 'sans jeter');
  egal(
    await machine.montrerRecompense(),
    { accordee: false, raison: 'sdk-indisponible' },
    'la récompensée aussi, sans jeter',
  );
  egal(machine.uniteBanniere, null, 'et la bannière se retire');

  // Le contrat qui compte : aucun de ces appels n'a levé d'exception, donc
  // l'écran appelant poursuit son chemin normal.
  verifier(true, 'aucune exception ne remonte, le joueur ne voit rien');
}

{
  // Désactivation explicite — le futur bouton « retirer les publicités ».
  const h = horloge();
  const { machine } = machineAvec({}, h);
  await rendreEligible(machine, h);
  machine.definirActive(false);
  egal(machine.evaluerInterstitiel(), 'desactive', 'la désactivation coupe l’interstitiel');
  verifier(!machine.banniereAutorisee, 'et la bannière');
  machine.definirActive(true);
  egal(machine.evaluerInterstitiel(), 'affiche', 'la réactivation la rétablit');
}

// ------------------------------------------ garde-fous de configuration ---

titre('Configuration — identifiants');
{
  const config = fs.readFileSync('src/pub/config.ts', 'utf8');
  verifier(
    /EN_PRODUCTION\s*=\s*!__DEV__/.test(config),
    'les blocs de test ne sont utilisés qu’en dehors d’une compilation de production',
  );
  verifier(
    /return reelle && reelle\.startsWith\('ca-app-pub-'\) \? reelle : null/.test(config),
    'en production, un identifiant manquant éteint la publicité au lieu de retomber sur un bloc de test',
  );

  const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const plugin = (appJson.expo.plugins as unknown[]).find(
    (p) => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads',
  ) as [string, Record<string, string>] | undefined;
  verifier(plugin !== undefined, 'le greffon publicitaire est déclaré dans app.json');
  verifier(
    typeof plugin?.[1]?.androidAppId === 'string' && plugin[1].androidAppId.startsWith('ca-app-pub-'),
    'un identifiant d’application Android est renseigné',
  );
  verifier(
    typeof plugin?.[1]?.iosAppId === 'string' && plugin[1].iosAppId.startsWith('ca-app-pub-'),
    'un identifiant d’application iOS est renseigné',
  );

  const permissions: string[] = appJson.expo.android.permissions;
  verifier(
    permissions.includes('android.permission.INTERNET'),
    'la permission INTERNET est déclarée — la publicité en a besoin',
  );
  verifier(
    permissions.includes('com.google.android.gms.permission.AD_ID'),
    'la permission AD_ID est déclarée — obligatoire depuis Android 13 pour la publicité',
  );
}

// --------------------------------------------------------------- verdict ---

console.log('');
console.log(`${passes} contrôles passés, ${echoues} en échec.`);
console.log(echoues === 0 ? '\nLOGIQUE PUBLICITAIRE CONFORME' : '\nLA LOGIQUE PUBLICITAIRE EST EN DEFAUT');
process.exit(echoues === 0 ? 0 : 1);

}

principal().catch((erreur) => {
  console.error('\nLE BANC DE TEST LUI-MÊME A ÉCHOUÉ :', erreur);
  process.exit(1);
});
