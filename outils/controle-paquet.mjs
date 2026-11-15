/**
 * Contrôle d'un paquet Android **produit** — APK ou AAB.
 *
 *   node outils/controle-paquet.mjs <fichier.apk|fichier.aab> [--production]
 *
 * Tous les autres contrôles du dépôt lisent des sources. Celui-ci lit le
 * fichier qu'on s'apprête à installer ou à téléverser, ce qui est la seule
 * façon de répondre à trois questions :
 *
 *   1. Ce paquet utilise-t-il des blocs d'annonces **de démonstration** ?
 *   2. Quelles permissions demande-t-il **vraiment** ?
 *   3. Par quelle clé est-il signé ?
 *
 * Les trois ont déjà réservé des surprises : un APK de release qui
 * n'affichait aucune annonce, quatre permissions ajoutées par la fusion des
 * manifestes, un drapeau de configuration sans aucun effet à cause du cache
 * de Metro.
 *
 * Avec `--production`, tout ce qui interdirait la publication devient une
 * erreur : mode test, identifiants de démonstration, signature de débogage.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const fichier = process.argv[2];
const pourLesMagasins = process.argv.includes('--production');

if (!fichier || !fs.existsSync(fichier)) {
  console.error('usage : node outils/controle-paquet.mjs <fichier.apk|.aab> [--production]');
  process.exit(2);
}

const erreurs = [];
const avertissements = [];
const constats = [];
const bloquant = (m) => (pourLesMagasins ? erreurs : avertissements).push(m);

const estAab = fichier.toLowerCase().endsWith('.aab');
const EDITEUR_DE_TEST = 'ca-app-pub-3940256099942544';

// --- outils du SDK Android -------------------------------------------------

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

/**
 * Sous Windows, `apksigner` est un `.bat`. `execFileSync` refuse de lancer
 * un script de commandes sans passer par le shell — d'où le `shell: true`,
 * et les guillemets, puisque les chemins contiennent des espaces.
 */
function lancer(programme, args) {
  const parScript = /\.(bat|cmd)$/i.test(programme);
  if (!parScript) return execFileSync(programme, args, { encoding: 'latin1' });
  const cite = (s) => (/[\s&()]/.test(s) ? `"${s}"` : s);
  return execFileSync(cite(programme), args.map(cite), {
    encoding: 'latin1',
    shell: true,
  });
}
function outilSdk(nom) {
  if (!sdk) return null;
  const dossiers = fs
    .readdirSync(path.join(sdk, 'build-tools'))
    .sort()
    .reverse();
  for (const d of dossiers) {
    for (const ext of ['.exe', '.bat', '']) {
      const p = path.join(sdk, 'build-tools', d, nom + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// --- extraction ------------------------------------------------------------

const travail = fs.mkdtempSync(path.join(os.tmpdir(), 'plateau-paquet-'));
function extraire(entree) {
  try {
    execFileSync('unzip', ['-o', '-q', fichier, entree, '-d', travail], { stdio: 'pipe' });
  } catch {
    return null;
  }
  const p = path.join(travail, entree);
  return fs.existsSync(p) ? p : null;
}

const prefixe = estAab ? 'base/' : '';
constats.push(`format : ${estAab ? 'AAB (bundle Google Play)' : 'APK installable'}`);
constats.push(`taille : ${(fs.statSync(fichier).size / 1024 / 1024).toFixed(1)} Mo`);

// --- 1. Mode publicitaire --------------------------------------------------

const cheminConfig = extraire(`${prefixe}assets/app.config`);
if (!cheminConfig) {
  erreurs.push('manifeste Expo introuvable dans le paquet — paquet inattendu ?');
} else {
  const cfg = JSON.parse(fs.readFileSync(cheminConfig, 'utf8'));
  const admob = (cfg.extra && cfg.extra.admob) || {};

  if (admob.forcerTest === true) {
    bloquant(
      'le paquet est en MODE TEST : il affichera des annonces de démonstration ' +
        '« Test Ad », qui ne rapportent rien.',
    );
    constats.push('publicités : blocs de DÉMONSTRATION (forcerTest = true)');
  } else {
    constats.push('publicités : blocs réels (forcerTest = false)');
  }

  if (pourLesMagasins && cfg.extra && cfg.extra.compilePourLesMagasins !== true) {
    erreurs.push(
      'le paquet n’a pas été construit avec PLATEAU_PRODUCTION=1 : le garde-fou ' +
        'de app.config.js n’a donc jamais tourné.',
    );
  }

  // Les blocs d'annonces effectivement configurés.
  const blocs = Object.entries(admob).filter(
    ([cle, v]) => typeof v === 'string' && v.startsWith('ca-app-pub-') && cle !== '_lisezMoi',
  );
  const demonstration = blocs.filter(([, v]) => v.startsWith(EDITEUR_DE_TEST));
  if (demonstration.length > 0) {
    bloquant(
      `blocs de démonstration dans la configuration : ${demonstration.map(([c]) => c).join(', ')}`,
    );
  }
  constats.push(
    blocs.length > 0
      ? `blocs configurés : ${blocs.length}, dont ${demonstration.length} de démonstration`
      : 'aucun bloc d’annonces configuré — le paquet n’affichera rien en production',
  );
  if (pourLesMagasins && blocs.length === 0) {
    erreurs.push('aucun identifiant AdMob réel : le paquet ne rapporterait rien.');
  }
}

// --- 2. Identifiant d'application AdMob ------------------------------------

const cheminManifeste = extraire(
  estAab ? 'base/manifest/AndroidManifest.xml' : 'AndroidManifest.xml',
);
{
  // Le manifeste d'un APK est binaire (AXML) : une recherche de texte n'y
  // trouve rien. Il faut passer par aapt. Celui d'un AAB est en protobuf,
  // où les chaînes restent lisibles.
  const aaptIci = outilSdk('aapt');
  const texte =
    !estAab && aaptIci
      ? lancer(aaptIci, ['dump', 'xmltree', fichier, 'AndroidManifest.xml'])
      : cheminManifeste
        ? fs.readFileSync(cheminManifeste, 'latin1')
        : '';
  const trouves = [...texte.matchAll(/ca-app-pub-\d+~\d+/g)].map((m) => m[0]);
  const uniques = [...new Set(trouves)];
  if (uniques.length === 0) {
    avertissements.push('aucun identifiant d’application AdMob dans le manifeste.');
  } else {
    constats.push(`identifiant d’application : ${uniques.join(', ')}`);
    if (uniques.some((i) => i.startsWith(EDITEUR_DE_TEST))) {
      bloquant(
        'le manifeste porte l’identifiant d’application de DÉMONSTRATION de Google.',
      );
    }
  }
}

// --- 3. Permissions --------------------------------------------------------

/**
 * Les permissions attendues, et d'où elles viennent — relevé sur le rapport
 * de fusion des manifestes de Gradle, pas deviné.
 */
const ATTENDUES = {
  'android.permission.INTERNET': 'app.json + react-native-google-mobile-ads',
  'android.permission.ACCESS_NETWORK_STATE': 'app.json + react-native-google-mobile-ads',
  'android.permission.VIBRATE': 'app.json + expo-haptics',
  'com.google.android.gms.permission.AD_ID': 'app.json + play-services-ads-api',
  'android.permission.WAKE_LOCK': 'react-native-google-mobile-ads + media3-exoplayer (expo-audio)',
  'android.permission.ACCESS_ADSERVICES_AD_ID': 'play-services-ads-api',
  'android.permission.ACCESS_ADSERVICES_ATTRIBUTION': 'play-services-ads-api',
  'android.permission.ACCESS_ADSERVICES_TOPICS': 'play-services-ads-api',
  'com.plateau.jeux.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION': 'androidx.core',
};

/**
 * Celles-ci apparaissent dans un AAB sans être demandées par l'application :
 * ce sont des attributs `android:permission` posés sur des services déclarés
 * par les bibliothèques Google, c'est-à-dire des **restrictions** d'accès à
 * ces services, pas des droits réclamés. Vérifié par comparaison :
 * `aapt dump permissions` sur l'APK issu du même manifeste ne les liste pas.
 */
const GARDES_DE_COMPOSANTS = new Set([
  'android.permission.BIND_JOB_SERVICE',
  'android.permission.DUMP',
]);

let permissions = [];
let methode = '';

const aapt = outilSdk('aapt');
if (!estAab && aapt) {
  const sortie = lancer(aapt, ['dump', 'permissions', fichier]);
  permissions = [...sortie.matchAll(/uses-permission: name='([^']+)'/g)].map((m) => m[1]);
  methode = 'aapt dump permissions (fait autorité)';
} else if (cheminManifeste) {
  const octets = fs.readFileSync(cheminManifeste, 'latin1');
  permissions = [
    ...new Set(
      [...octets.matchAll(/(?:android|com\.[a-z.]+)\.permission\.[A-Z_]+/g)].map((m) => m[0]),
    ),
  ].filter((p) => !GARDES_DE_COMPOSANTS.has(p));
  methode = 'lecture du manifeste protobuf (approximative — les gardes de composants sont écartées)';
} else {
  erreurs.push('impossible de lire les permissions du paquet.');
}

if (permissions.length > 0) {
  constats.push(`permissions : ${permissions.length} — ${methode}`);
  const inconnues = permissions.filter((p) => !(p in ATTENDUES));
  const manquantes = Object.keys(ATTENDUES).filter((p) => !permissions.includes(p));

  for (const p of inconnues) {
    erreurs.push(
      `permission inattendue dans le paquet : « ${p} ». La documenter dans ` +
        'outils/controle-paquet.mjs et dans la politique de confidentialité, ou la bloquer.',
    );
  }
  // Une permission attendue mais absente n'est pas un défaut : la lecture
  // approximative d'un AAB peut en rater. On le signale sans bloquer.
  for (const p of manquantes) {
    avertissements.push(`permission attendue absente du relevé : « ${p} »`);
  }

  // Ce qui ne doit jamais s'y trouver, quelle que soit la raison.
  const INTERDITES = [
    'RECORD_AUDIO', 'CAMERA', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION',
    'READ_CONTACTS', 'READ_SMS', 'READ_PHONE_STATE', 'READ_EXTERNAL_STORAGE',
    'WRITE_EXTERNAL_STORAGE', 'SYSTEM_ALERT_WINDOW', 'POST_NOTIFICATIONS',
  ];
  for (const p of permissions) {
    if (INTERDITES.some((i) => p.endsWith('.' + i))) {
      erreurs.push(`permission sensible présente dans le paquet : « ${p} »`);
    }
  }
}

// --- 4. Signature ----------------------------------------------------------

if (estAab) {
  // Le bloc de signature porte le nom de l'alias de la clé : ANDROIDD.RSA
  // pour le certificat de débogage, ESSAI.RSA pour un alias « essai »… On
  // le cherche donc au lieu de le deviner. Première version : deux noms
  // codés en dur, et un AAB pourtant signé passait pour non signé.
  let rsa = null;
  try {
    const liste = execFileSync('unzip', ['-Z1', fichier, 'META-INF/*'], { encoding: 'utf8' });
    const entree = liste
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /\.(rsa|dsa|ec)$/i.test(l));
    if (entree) rsa = extraire(entree);
  } catch {
    /* unzip indisponible : traité plus bas */
  }
  if (rsa) {
    try {
      const sortie = lancer('keytool', ['-printcert', '-file', rsa]);
      const proprietaire = (sortie.match(/(?:Propri[ée]taire|Owner)\s*:\s*(.+)/) ?? [])[1] ?? '?';
      constats.push(`signature : ${proprietaire.trim()}`);
      if (/Android Debug/i.test(sortie)) {
        bloquant(
          'AAB signé par le certificat de DÉBOGAGE : Google Play le refusera. ' +
            'Voir docs/PUBLICATION.md, « Créer la clé de signature ».',
        );
      }
    } catch {
      avertissements.push('keytool indisponible : signature non vérifiée.');
    }
  } else {
    bloquant('aucune signature trouvée dans l’AAB.');
  }
} else {
  const apksigner = outilSdk('apksigner');
  if (apksigner) {
    const sortie = lancer(apksigner, ['verify', '--print-certs', '-v', fichier]);
    const dn = (sortie.match(/Signer #1 certificate DN: (.+)/) ?? [])[1] ?? '?';
    const verifie = /^Verifies/m.test(sortie);
    constats.push(`signature : ${dn.trim()} ${verifie ? '(vérifiée)' : '(NON VÉRIFIÉE)'}`);
    if (!verifie) erreurs.push('la signature de l’APK ne se vérifie pas.');
    if (/Android Debug/i.test(dn)) {
      bloquant('APK signé par le certificat de DÉBOGAGE : installable, non publiable.');
    }
  } else {
    avertissements.push('apksigner introuvable : signature non vérifiée.');
  }
}

// --- verdict ---------------------------------------------------------------

fs.rmSync(travail, { recursive: true, force: true });

console.log(`\n${path.basename(fichier)}\n`);
for (const c of constats) console.log('  · ' + c);

if (avertissements.length > 0) {
  console.log('\n  À SAVOIR :');
  for (const a of avertissements) console.log('  ~ ' + a);
}

if (erreurs.length > 0) {
  console.error(
    `\n${erreurs.length} POINT(S) BLOQUANT(S)${pourLesMagasins ? ' POUR LA PUBLICATION' : ''} :`,
  );
  for (const e of erreurs) console.error('  ✗ ' + e);
  process.exit(1);
}

console.log(
  pourLesMagasins
    ? '\nPAQUET PUBLIABLE — sous réserve des contrôles propres aux magasins.'
    : '\nPAQUET D’ESSAI CONFORME — utiliser --production avant tout téléversement.',
);
process.exit(0);
