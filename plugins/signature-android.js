const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Configuration de signature Android pour les paquets publiables.
 *
 * **Pourquoi un greffon et pas une modification de `android/app/build.gradle`.**
 * Le dossier `android/` est régénéré par `npx expo prebuild` et ignoré par
 * git : toute modification à la main y disparaît au prochain prebuild, en
 * silence. Un greffon la réapplique à chaque fois.
 *
 * **Ce que ce fichier ne fait pas, volontairement.** Il ne crée aucune clé,
 * n'en lit aucune, n'en écrit aucune, et ne contient aucun mot de passe. Il
 * se contente de dire à Gradle *où* chercher, si l'utilisateur a fourni les
 * informations. La clé de signature d'une application est l'unique chose
 * qu'on ne peut pas remplacer : la perdre interdit définitivement de publier
 * une mise à jour, et la divulguer permet à n'importe qui de publier à votre
 * place. Elle reste donc entre les mains de son propriétaire.
 *
 * **Où vivent les informations.** Dans `~/.gradle/gradle.properties`, hors
 * du dépôt, jamais versionné :
 *
 *     PLATEAU_KEYSTORE_FILE=C:\\chemin\\hors\\depot\\plateau-upload.jks
 *     PLATEAU_KEYSTORE_PASSWORD=…
 *     PLATEAU_KEY_ALIAS=upload
 *     PLATEAU_KEY_PASSWORD=…
 *
 * Sans elles, la compilation continue avec le certificat de débogage : le
 * paquet reste installable pour les essais, et **Gradle l'écrit en clair
 * dans son journal**, pour qu'on ne prenne jamais un paquet d'essai pour un
 * paquet publiable.
 *
 * La procédure de création de la clé est dans docs/PUBLICATION.md.
 */

const MARQUE = '// --- signature Plateau (greffon) ---';

const BLOC_SIGNATURE = `
        release {
            // Renseignée seulement si l'utilisateur a fourni sa clé.
            if (project.hasProperty('PLATEAU_KEYSTORE_FILE')) {
                storeFile file(project.property('PLATEAU_KEYSTORE_FILE'))
                storePassword project.property('PLATEAU_KEYSTORE_PASSWORD')
                keyAlias project.property('PLATEAU_KEY_ALIAS')
                keyPassword project.property('PLATEAU_KEY_PASSWORD')
            }
        }`;

const CHOIX_SIGNATURE = `${MARQUE}
            // Le paquet n'est publiable que signé par la clé de production.
            // Sans elle on retombe sur le certificat de débogage, et on le
            // dit : un AAB de débogage est refusé par Google Play, autant
            // l'apprendre ici plutôt qu'après le téléversement.
            if (project.hasProperty('PLATEAU_KEYSTORE_FILE')) {
                signingConfig signingConfigs.release
                println '[Plateau] signature de PRODUCTION (' + project.property('PLATEAU_KEY_ALIAS') + ')'
            } else {
                signingConfig signingConfigs.debug
                println '[Plateau] signature de DEBOGAGE - paquet installable, NON publiable'
            }`;

module.exports = function withSignatureAndroid(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes(MARQUE)) return cfg;

    // 1. Déclarer la configuration de signature de production.
    const finSigningConfigs = gradle.indexOf('    }\n    buildTypes {');
    if (finSigningConfigs === -1) {
      throw new Error(
        'signature-android : bloc « signingConfigs … buildTypes » introuvable dans app/build.gradle. ' +
          'Le gabarit Expo a changé — relire le greffon avant de compiler quoi que ce soit.',
      );
    }
    gradle =
      gradle.slice(0, finSigningConfigs) +
      BLOC_SIGNATURE +
      '\n' +
      gradle.slice(finSigningConfigs);

    // 2. Remplacer le choix de signature du type « release ».
    const avant = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
    if (!gradle.includes(avant)) {
      throw new Error(
        'signature-android : le bloc « release » du gabarit Expo a changé. ' +
          'Ne pas compiler un paquet de production tant que ce greffon n’a pas été relu.',
      );
    }
    gradle = gradle.replace(avant, `        release {\n${CHOIX_SIGNATURE}`);

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
