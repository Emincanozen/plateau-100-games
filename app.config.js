/**
 * Configuration dynamique, appliquée par-dessus `app.json`.
 *
 * Elle décide d'une seule chose, et en interdit une autre :
 *
 * 1. **Décider** si le paquet utilise les blocs d'annonces *de test* de
 *    Google. Une compilation d'essai en a besoin — sans identifiants réels,
 *    un paquet `release` n'afficherait aucune annonce, et l'APK d'essai ne
 *    servirait à rien pour vérifier la publicité sur un téléphone.
 * 2. **Interdire** que ce mode atteigne un paquet destiné aux magasins.
 *
 * **Pourquoi ici et pas dans `process.env` côté application.** La première
 * version lisait `process.env.EXPO_PUBLIC_PUB_TEST` directement dans
 * `src/pub/config.ts`. Babel l'inline bien, mais Metro met les transformées
 * en cache et la valeur de la variable **ne fait pas partie de la clé de
 * cache** : deux paquets construits avec et sans le drapeau sortaient
 * rigoureusement identiques, empreinte comprise, tant que le cache était
 * chaud. Mesuré, pas supposé — il fallait `--clear` pour voir la différence.
 *
 * `extra` n'a pas ce défaut : la configuration est réévaluée à chaque
 * compilation et embarquée dans le manifeste, que l'application relit à
 * l'exécution. On peut de plus la vérifier dans l'APK produit, ce qui est
 * exactement ce qu'on veut d'un drapeau pareil —
 * `node outils/controle-paquet.mjs <fichier>` le fait.
 */

/**
 * Blocs officiels de démonstration de Google (AdMob Sample ID: ca-app-pub-3940256099942544).
 * Identifiant éditeur de test public officiel fourni par Google pour le développement.
 */
const EDITEUR_DE_TEST = 'ca-app-pub-3940256099942544';

module.exports = ({ config }) => {
  const forcerTest = process.env.PLATEAU_PUB_TEST === '1';
  const pourLesMagasins = process.env.PLATEAU_PRODUCTION === '1';
  const admob = (config.extra && config.extra.admob) || {};

  // --- Le garde-fou ---------------------------------------------------------
  //
  // Il échoue **avant** la compilation, pas après le téléversement. Un paquet
  // publié avec des blocs de test ne rapporte rien, fausse les statistiques
  // d'AdMob, et se corrige au prix d'une nouvelle revue de plusieurs jours.
  if (pourLesMagasins) {
    const griefs = [];

    if (forcerTest) {
      griefs.push(
        'PLATEAU_PUB_TEST=1 est posé : ce paquet utiliserait les blocs ' +
          'd’annonces de démonstration de Google. Les deux variables ' +
          's’excluent.',
      );
    }

    // Les identifiants d'application vivent dans le greffon, pas dans `extra`.
    const greffon = (config.plugins || []).find(
      (p) => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads',
    );
    const options = (greffon && greffon[1]) || {};
    for (const cle of ['androidAppId', 'iosAppId']) {
      const valeur = options[cle] || '';
      if (valeur.startsWith(EDITEUR_DE_TEST)) {
        griefs.push(
          `le greffon publicitaire porte encore l’identifiant de ` +
            `démonstration de Google pour « ${cle} ».`,
        );
      }
    }

    // Les blocs d'annonces, eux, viennent de `extra.admob`.
    const blocs = [
      'androidBanniere', 'iosBanniere',
      'androidInterstitiel', 'iosInterstitiel',
    ];
    const vides = blocs.filter((cle) => !admob[cle]);
    if (vides.length === blocs.length) {
      griefs.push(
        'aucun bloc d’annonces réel n’est renseigné dans extra.admob : le ' +
          'paquet n’afficherait aucune publicité.',
      );
    }
    for (const cle of blocs) {
      if ((admob[cle] || '').startsWith(EDITEUR_DE_TEST)) {
        griefs.push(`extra.admob.${cle} est un bloc de démonstration.`);
      }
    }

    if (griefs.length > 0) {
      throw new Error(
        '\n\n  COMPILATION DE PRODUCTION REFUSÉE\n\n' +
          griefs.map((g) => '  · ' + g).join('\n') +
          '\n\n  Procédure : docs/MONETISATION.md §7.\n' +
          '  Pour un paquet d’essai, retirer PLATEAU_PRODUCTION et poser ' +
          'PLATEAU_PUB_TEST=1.\n',
      );
    }
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      admob: {
        ...admob,
        // Vrai uniquement pour les profils d'essai ; jamais en production.
        forcerTest,
      },
      // Trace du mode de compilation, lisible dans le paquet produit.
      compilePourLesMagasins: pourLesMagasins,
    },
  };
};
