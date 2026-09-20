/**
 * Configuration dynamique, appliquée par-dessus `app.json`.
 *
 * Elle ne sert qu'à une chose : décider si le paquet doit utiliser les blocs
 * d'annonces **de test** de Google. Une compilation de prévisualisation en
 * a besoin — sans identifiants réels, un paquet `release` n'afficherait
 * aucune annonce, et l'APK d'essai ne servirait à rien pour vérifier la
 * publicité sur un téléphone.
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
 * exactement ce qu'on veut d'un drapeau pareil.
 */
module.exports = ({ config }) => {
  const forcerTest = process.env.PLATEAU_PUB_TEST === '1';

  return {
    ...config,
    extra: {
      ...config.extra,
      admob: {
        ...(config.extra && config.extra.admob),
        // Vrai uniquement pour les profils d'essai ; jamais en production.
        forcerTest,
      },
    },
  };
};
