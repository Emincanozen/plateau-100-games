# Plateau — revue privée du 30 octobre 2026

## À quoi sert le projet

Application Expo/React Native de cent jeux, solo et multijoueur local sur un même appareil. Les parties et la progression fonctionnent hors ligne. La publicité est isolée du code des jeux et ne doit jamais empêcher une partie. Le [README](README.md) explique le démarrage ; [AGENTS.md](AGENTS.md) décrit le contrat commun des jeux.

## Défaut corrigé

La progression était chargée par un simple cast TypeScript, qui ne valide rien à l'exécution. Un JSON valide comme `{ "stats": null, "favorites": null }` pouvait donc casser l'écran du catalogue ou les calculs de statistiques.

Une normalisation valide maintenant les collections, les compteurs et les scores finis, conserve les données valides, élimine les doublons et borne les éléments récents. Le test `npm run test:stockage` éprouve les données mal formées et les données valides ; il fait partie de `npm run verifier` et de la CI.

## Vérification

La chaîne complète `npm run verifier` et l'export web ont été exécutés. Elle couvre le typage, le contrat du catalogue, la confidentialité, les fiches de magasins, les règles, la publicité simulée, les échecs et le backgammon. Le nombre d'assertions du moteur de backgammon varie selon les parties aléatoires ; aucun total figé n'est annoncé.

Les dépendances corrigibles sans migration majeure ont été mises à jour par `npm audit fix`, sans rétrograder Expo comme le suggérait une résolution forcée. Des alertes restent dans la chaîne Expo et ses outils ; elles sont à examiner avec une migration de SDK validée. Aucune publicité réelle, signature de binaire ou publication de magasin n'est effectuée.

## Avant ouverture

Jouer réellement chaque jeu du début à la fin sur les appareils cibles, vérifier la persistance après redémarrage, la reprise, les modes duo, les lecteurs d'écran et les interactions publicitaires sur téléphone. Les protocoles existants dans `docs/` conservent leur statut ; les tests Node et l'export web ne remplacent pas ces essais.

Le dépôt reste privé. Rien n'est fusionné ou déployé par cette revue.
