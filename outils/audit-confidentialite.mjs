/**
 * Audit de confidentialité.
 *
 *   node outils/audit-confidentialite.mjs
 *
 * Remplace un contrôle qui ne valait plus rien. L'ancien cherchait
 * `XMLHttpRequest` et `navigator.sendBeacon` dans le paquet livré et
 * concluait « aucun appel réseau ». Deux défauts : il ratait `fetch`, les
 * WebSockets et tout code minifié autrement, et il est devenu carrément faux
 * le jour où le SDK publicitaire est entré — lequel, lui, communique par
 * construction.
 *
 * Le contrôle utile n'est donc plus « rien ne parle au réseau », mais :
 *
 *   1. **le code de Plateau** ne parle jamais au réseau, lui ;
 *   2. la liste des dépendances qui le peuvent est **connue et justifiée** ;
 *   3. les permissions déclarées correspondent exactement à cette liste ;
 *   4. ce qui est enregistré sur l'appareil est bien ce qui est documenté.
 *
 * Une dépendance nouvelle, une permission nouvelle ou un `fetch` glissé dans
 * un jeu font échouer la chaîne, et obligent à mettre la politique à jour.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const problemes = [];
const ajouter = (quoi) => problemes.push('  ' + quoi);
const constats = [];

// --- 1. Le code de l'application ne communique pas ------------------------

/**
 * `src/pub/` est exclu : c'est le seul endroit qui a le droit de parler au
 * SDK publicitaire, et il est examiné séparément plus bas.
 */
const PRIMITIVES = [
  ['fetch(', /\bfetch\s*\(/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['WebSocket', /\bWebSocket\b/],
  ['sendBeacon', /sendBeacon/],
  ['EventSource', /\bEventSource\b/],
  ['geolocation', /navigator\.geolocation/],
  ['Image distante', /uri:\s*['"`]https?:/],
];

function fichiersSources(racine, exclure = []) {
  const sortie = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (exclure.some((x) => p.includes(x))) continue;
      if (e.isDirectory()) parcourir(p);
      else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) sortie.push(p);
    }
  };
  parcourir(racine);
  return sortie;
}

const sources = [...fichiersSources('src', ['src\\pub', 'src/pub']), ...fichiersSources('app')];
let fautes = 0;
for (const fichier of sources) {
  const texte = fs.readFileSync(fichier, 'utf8');
  for (const [nom, motif] of PRIMITIVES) {
    if (motif.test(texte)) {
      ajouter(`${fichier} : utilise « ${nom} » — le code de l'application ne communique pas`);
      fautes += 1;
    }
  }
}
constats.push(
  `${sources.length} fichiers de l'application examinés, ${fautes} appel réseau trouvé`,
);

// Aucune URL en dur non plus, hors liens de documentation dans src/pub.
for (const fichier of sources) {
  const texte = fs.readFileSync(fichier, 'utf8');
  for (const trouve of texte.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
    // Les liens en commentaire sont admis : ce sont des références.
    const ligne = texte.slice(0, trouve.index).split('\n').pop() ?? '';
    if (/^\s*(\*|\/\/)/.test(ligne)) continue;
    ajouter(`${fichier} : adresse en dur « ${trouve[0]} »`);
  }
}

// --- 2. Les dépendances qui peuvent communiquer ---------------------------

/**
 * Chaque dépendance d'exécution, et ce qu'elle a le droit de faire. Ajouter
 * une bibliothèque sans l'inscrire ici fait échouer le contrôle : c'est le
 * but. Une dépendance non examinée est une déclaration de confidentialité
 * fausse en puissance.
 */
const DEPENDANCES = {
  '@expo/vector-icons': 'polices embarquées, aucun réseau',
  '@react-native-async-storage/async-storage': 'stockage local uniquement',
  expo: 'socle ; aucune télémétrie en production',
  'expo-asset': 'ressources embarquées',
  'expo-audio': 'lecture des sons embarqués',
  'expo-constants': 'lecture de la configuration',
  'expo-font': 'polices embarquées',
  'expo-haptics': 'vibration',
  'expo-linking': 'liens internes de navigation',
  'expo-router': 'navigation',
  'expo-splash-screen': 'écran de lancement',
  'expo-status-bar': 'barre d’état',
  'expo-system-ui': 'couleur de fond du système',
  react: 'socle',
  'react-dom': 'socle web',
  'react-native': 'socle',
  'react-native-gesture-handler': 'gestes',
  'react-native-google-mobile-ads': 'RÉSEAU — régie publicitaire Google AdMob, déclarée dans la politique',
  'react-native-reanimated': 'animations',
  'react-native-safe-area-context': 'zones sûres',
  'react-native-screens': 'navigation native',
  'react-native-svg': 'dessin',
  'react-native-web': 'socle web',
  'react-native-worklets': 'animations',
};

const paquet = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const installees = Object.keys(paquet.dependencies ?? {});
const inconnues = installees.filter((d) => !(d in DEPENDANCES));
const disparues = Object.keys(DEPENDANCES).filter((d) => !installees.includes(d));

for (const d of inconnues) {
  ajouter(`dépendance « ${d} » non examinée — l'inscrire dans outils/audit-confidentialite.mjs`);
}
for (const d of disparues) {
  ajouter(`dépendance « ${d} » inscrite mais absente de package.json`);
}

const reseau = installees.filter((d) => DEPENDANCES[d]?.startsWith('RÉSEAU'));
constats.push(
  `${installees.length} dépendances d'exécution · ${reseau.length} peuvent communiquer : ` +
    (reseau.join(', ') || 'aucune'),
);

// --- 3. Les permissions déclarées -----------------------------------------

const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));

/** Permission → la dépendance qui la justifie. */
const PERMISSIONS_ATTENDUES = {
  'android.permission.VIBRATE': 'expo-haptics',
  'android.permission.INTERNET': 'react-native-google-mobile-ads',
  'android.permission.ACCESS_NETWORK_STATE': 'react-native-google-mobile-ads',
  'com.google.android.gms.permission.AD_ID': 'react-native-google-mobile-ads',
};

/**
 * Permissions qu'aucun fichier du dépôt ne déclare : elles arrivent par la
 * **fusion des manifestes** des bibliothèques, au moment de la compilation.
 *
 * Elles ont été découvertes dans l'APK produit, pas dans les sources. Lire
 * `app.json` n'y donnait accès d'aucune façon, et lire le manifeste écrit
 * par `expo prebuild` non plus : il ne contient que ce que le module
 * applicatif déclare. Seul le manifeste **fusionné** les montre.
 *
 * Aucune n'est bloquée : les trois `ACCESS_ADSERVICES_*` sont le bac à
 * sable de confidentialité d'Android, et les retirer dégraderait la mesure
 * publicitaire que le SDK est censé faire dans les règles.
 */
const PERMISSIONS_DES_BIBLIOTHEQUES = {
  'android.permission.WAKE_LOCK':
    'Google Mobile Ads — maintient l’écran actif pendant une vidéo publicitaire',
  'android.permission.ACCESS_ADSERVICES_AD_ID':
    'Google Mobile Ads — bac à sable de confidentialité Android 13+',
  'android.permission.ACCESS_ADSERVICES_ATTRIBUTION':
    'Google Mobile Ads — attribution sans identifiant inter-applications',
  'android.permission.ACCESS_ADSERVICES_TOPICS':
    'Google Mobile Ads — centres d’intérêt calculés par le système',
  'com.plateau.jeux.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION':
    'AndroidX — permission interne, non visible par l’utilisateur',
};

const declarees = appJson.expo.android?.permissions ?? [];
for (const p of declarees) {
  if (!(p in PERMISSIONS_ATTENDUES)) {
    ajouter(`permission Android « ${p} » déclarée sans justification connue`);
  }
}
for (const [p, cause] of Object.entries(PERMISSIONS_ATTENDUES)) {
  if (!declarees.includes(p) && installees.includes(cause)) {
    ajouter(`permission « ${p} » attendue pour ${cause} mais absente de app.json`);
  }
}

// Permissions qu'on ne veut voir apparaître sous aucun prétexte.
const INTERDITES = [
  'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'READ_CONTACTS', 'CAMERA',
  'RECORD_AUDIO', 'READ_PHONE_STATE', 'READ_EXTERNAL_STORAGE', 'POST_NOTIFICATIONS',
];
for (const p of declarees) {
  if (INTERDITES.some((i) => p.includes(i))) {
    ajouter(`permission sensible « ${p} » : incompatible avec la politique annoncée`);
  }
}
constats.push(`${declarees.length} permissions Android, toutes justifiées`);

/**
 * Le manifeste réellement produit, quand `npx expo prebuild` est passé.
 *
 * Ce contrôle a trouvé un vrai défaut : `app.json` ne déclarait que quatre
 * permissions, mais la fusion des manifestes en ajoutait sept, dont
 * **RECORD_AUDIO** — le microphone — apportée par `expo-audio`. La politique
 * de confidentialité affirmait « ni microphone ». Lire seulement `app.json`
 * ne suffit donc pas : il faut lire ce qui sort de la fusion.
 */
const MANIFESTES = [
  // Le meilleur : celui que Gradle assemble pour le paquet. Il n'existe
  // qu'après une compilation.
  'android/app/build/intermediates/merged_manifest/release/expoReleaseOverrideMaxSdkConflicts/AndroidManifest.xml',
  'android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml',
  // À défaut, celui de prebuild : il ne montre que le module applicatif,
  // mais il attrape déjà ce que les greffons Expo ajoutent.
  'android/app/src/main/AndroidManifest.xml',
];

const MANIFESTE = MANIFESTES.find((m) => fs.existsSync(m));
if (MANIFESTE) {
  const manifeste = fs.readFileSync(MANIFESTE, 'utf8');
  const lignes = [...manifeste.matchAll(/<uses-permission[^>]*android:name="([^"]+)"([^>]*)>/g)];
  const effectives = lignes
    .filter(([, , attributs]) => !attributs.includes('tools:node="remove"'))
    .map(([, nom]) => nom);

  for (const p of effectives) {
    if (p in PERMISSIONS_ATTENDUES || p in PERMISSIONS_DES_BIBLIOTHEQUES) continue;
    ajouter(
      `${MANIFESTE} : la fusion ajoute « ${p} », inconnue au bataillon — ` +
        'la bloquer avec android.blockedPermissions, ou la documenter ici et ' +
        'dans la politique de confidentialité',
    );
  }

  const fusionne = MANIFESTE.includes('build/intermediates');
  const heritees = effectives.filter((p) => p in PERMISSIONS_DES_BIBLIOTHEQUES).length;
  constats.push(
    `manifeste ${fusionne ? 'du paquet livré' : 'de prebuild (pas encore compilé)'} : ` +
      `${effectives.length} permissions, dont ${heritees} héritées des bibliothèques, ` +
      `${lignes.length - effectives.length} retirées par blockedPermissions`,
  );
  if (!fusionne) {
    constats.push(
      'compiler l’APK pour voir les permissions ajoutées par la fusion des ' +
        'manifestes — c’est là que RECORD_AUDIO et les ACCESS_ADSERVICES_* ont été trouvées',
    );
  }
} else {
  constats.push('aucun manifeste Android — lancer « npx expo prebuild » pour ce contrôle');
}

// iOS : aucune clé de permission ne doit apparaître sans raison.
const infoPlist = appJson.expo.ios?.infoPlist ?? {};
const CLES_IOS_INTERDITES = [
  'NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysUsageDescription',
  'NSContactsUsageDescription', 'NSCameraUsageDescription', 'NSMicrophoneUsageDescription',
  'NSPhotoLibraryUsageDescription',
];
for (const cle of CLES_IOS_INTERDITES) {
  if (cle in infoPlist) ajouter(`clé iOS sensible « ${cle} » présente dans app.json`);
}

// --- 4. Ce qui est écrit sur l'appareil -----------------------------------

const stockage = fs.readFileSync('src/engine/storage.ts', 'utf8');
const prefixe = (stockage.match(/const PREFIX = '([^']+)'/) ?? [])[1];
if (prefixe !== 'plateau:v1:') {
  ajouter(`le préfixe de stockage est « ${prefixe} », la politique annonce « plateau:v1: »`);
}

const clesUtilisees = new Set();
for (const fichier of sources) {
  const texte = fs.readFileSync(fichier, 'utf8');
  for (const t of texte.matchAll(/(?:loadJSON|saveJSON|removeKey)<?[^(]*\(\s*'([^']+)'/g)) {
    clesUtilisees.add(t[1]);
  }
}
const CLES_DOCUMENTEES = ['settings', 'progress'];
for (const cle of clesUtilisees) {
  if (!CLES_DOCUMENTEES.includes(cle)) {
    ajouter(`clé de stockage « ${cle} » non documentée dans la politique de confidentialité`);
  }
}
constats.push(`stockage local : ${[...clesUtilisees].sort().join(', ')} sous « ${prefixe} »`);

// --- 4 bis. Aucun secret de signature dans le dépôt -----------------------

/**
 * La clé de signature est la seule chose du projet qu'on ne peut pas
 * remplacer : la perdre interdit définitivement de publier une mise à jour,
 * la divulguer permet à n'importe qui de publier à votre place. Elle n'a
 * donc rien à faire dans un dépôt, fût-il privé — l'historique git ne
 * s'oublie pas.
 *
 * Le contrôle porte sur ce que git **suit**, pas sur ce qui traîne sur le
 * disque : un fichier ignoré est sans danger.
 */
const EXTENSIONS_DE_CLES = /\.(jks|keystore|p12|p8|mobileprovision)$/i;
try {
  const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  const cles = suivis.filter((f) => EXTENSIONS_DE_CLES.test(f.trim()));
  for (const c of cles) {
    ajouter(
      `${c} : une clé de signature est suivie par git. La retirer de l'index, ` +
        'la révoquer, et en produire une nouvelle.',
    );
  }
  // Un mot de passe de signature ne doit pas non plus traîner dans un fichier.
  const MOTS = /(PLATEAU_KEYSTORE_PASSWORD|PLATEAU_KEY_PASSWORD)\s*=\s*\S/;
  for (const f of suivis) {
    const nom = f.trim();
    if (!nom || !fs.existsSync(nom) || fs.statSync(nom).isDirectory()) continue;
    if (!/\.(json|js|mjs|ts|tsx|yml|yaml|properties|md|gradle)$/i.test(nom)) continue;
    const texte = fs.readFileSync(nom, 'utf8');
    // Les lignes de documentation montrent la forme sans valeur réelle.
    if (MOTS.test(texte) && !/PLATEAU_KEYSTORE_PASSWORD=…/.test(texte)) {
      ajouter(`${nom} : un mot de passe de signature semble écrit en clair.`);
    }
  }
  constats.push(`${suivis.length - 1} fichiers suivis par git, aucune clé de signature`);
} catch {
  constats.push('git indisponible — contrôle des clés de signature non exécuté');
}

// --- 5. La publicité est confinée -----------------------------------------

const ailleurs = [];
for (const fichier of [...fichiersSources('src', ['src\\pub', 'src/pub']), ...fichiersSources('app')]) {
  const texte = fs.readFileSync(fichier, 'utf8');
  if (/react-native-google-mobile-ads/.test(texte) && !/Banniere/.test(path.basename(fichier))) {
    ailleurs.push(fichier);
  }
}
if (ailleurs.length > 0) {
  ajouter(`le SDK publicitaire est importé hors de src/pub : ${ailleurs.join(', ')}`);
}
constats.push('SDK publicitaire confiné à src/pub/ et src/ui/Banniere.native.tsx');

// --- verdict ---------------------------------------------------------------

for (const c of constats) console.log('· ' + c);

if (problemes.length === 0) {
  console.log('\nAUDIT DE CONFIDENTIALITÉ CONFORME');
  process.exit(0);
}
console.error(`\n${problemes.length} POINTS À TRAITER :\n${problemes.join('\n')}`);
process.exit(1);
