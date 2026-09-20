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
const MANIFESTE = 'android/app/src/main/AndroidManifest.xml';
if (fs.existsSync(MANIFESTE)) {
  const manifeste = fs.readFileSync(MANIFESTE, 'utf8');
  const lignes = [...manifeste.matchAll(/<uses-permission[^>]*android:name="([^"]+)"([^>]*)>/g)];
  const effectives = lignes
    .filter(([, , attributs]) => !attributs.includes('tools:node="remove"'))
    .map(([, nom]) => nom);

  for (const p of effectives) {
    if (!(p in PERMISSIONS_ATTENDUES)) {
      ajouter(
        `${MANIFESTE} : la fusion ajoute « ${p} », non déclarée dans app.json — ` +
          'la bloquer avec android.blockedPermissions, ou la documenter',
      );
    }
  }
  constats.push(
    `manifeste fusionné : ${effectives.length} permissions effectives, ` +
      `${lignes.length - effectives.length} retirées par blockedPermissions`,
  );
} else {
  constats.push(`${MANIFESTE} absent — lancer « npx expo prebuild » pour ce contrôle`);
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
