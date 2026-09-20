# Plateau — briefing projet

**Lis ce fichier en entier. Il suffit à travailler sur le projet.** Tu n'as pas
besoin d'ouvrir les autres fichiers pour comprendre l'architecture : tout ce qui
suit est le contrat. L'[annexe](docs/ANNEXE.md) contient les listes exhaustives
(catalogue des 100 jeux, jetons de design, API détaillée) — va la consulter
seulement quand tu as besoin d'un détail précis.

---

## 1. Ce qu'est le projet

Une application mobile **iOS et Android** contenant une centaine de jeux :
plateau, cartes, logique, arcade, dés, papier-crayon. Un seul code source
React Native, distribué sur les deux plateformes.

**Contraintes de conception, décidées avec l'utilisateur, à ne pas remettre en
question sans le lui demander :**

| Décision | Conséquence |
|---|---|
| Solo et multi **local** uniquement | Aucun serveur, aucun compte. Le code de l'application ne communique jamais : pas de `fetch`, pas de `XMLHttpRequest`, pas de WebSocket. `npm run audit:confidentialite` le vérifie. |
| **Publicité** — la seule exception réseau | Google AdMob, confiné à `src/pub/` et `src/ui/Banniere.native.tsx`. Aucun des cent jeux ne la connaît. Voir [docs/MONETISATION.md](docs/MONETISATION.md). |
| Les **jeux** restent hors ligne | Les scores vivent dans AsyncStorage, sur l'appareil. Une publicité indisponible ne bloque jamais une partie. |
| Catalogue **équilibré** | ~20 plateau, ~20 cartes, ~20 logique, ~20 arcade, ~10 dés, ~10 papier. |
| Design **moderne épuré**, clair + sombre | Aucune couleur en dur hors des jetons de thème. |
| Interface **en français** | Y compris les noms de variables et les commentaires du code métier. |

**État actuel : 100 jeux sur 100.** Le catalogue est complet. Les moteurs
d'échecs et de backgammon vivent dans `src/games/lib/`, séparés de leur
composant, et sont couverts par des tests (§8). La monétisation publicitaire
est branchée et éprouvée hors appareil ; aucune annonce réelle n'a encore été
affichée — voir [docs/MONETISATION.md](docs/MONETISATION.md).

---

## 2. Démarrer

```bash
npm install
npm run web      # itération rapide dans un navigateur — le chemin normal
npm run verifier # la chaîne complète, obligatoire avant toute livraison
```

> **Expo Go ne fonctionne plus sur ce projet.** Le module publicitaire natif
> n'y existe pas. Deux chemins restent : `npm run web`, qui couvre les cent
> jeux, ou une compilation de développement
> (`eas build --profile development`) pour tout ce qui touche à la publicité.

> Sous PowerShell, utiliser `npx.cmd` et non `npx` : la politique d'exécution
> bloque les scripts `.ps1`.

**Stack** : Expo SDK 57 · React Native 0.86 · React 19.2 · expo-router 7 ·
TypeScript strict · Reanimated 4 · react-native-svg · AsyncStorage · expo-audio ·
react-native-google-mobile-ads 17.

> Expo change vite. Avant d'écrire du code qui touche à une API Expo, consulter
> <https://docs.expo.dev/versions/v57.0.0/> — la version exacte, pas la dernière.

---

## 3. Carte du code

```
app/                      Routes (expo-router, routage par fichier)
  _layout.tsx             Fournisseurs imbriqués : Settings → Progress → Theme
  index.tsx               Catalogue : recherche, filtres, favoris, reprise
  game/[id].tsx           Hôte de jeu : en-tête, règles, recommencer, scores
  reglages.tsx            Thème, vibrations, statistiques, remise à zéro

src/
  theme/tokens.ts         Palettes clair/sombre, espacements, rayons, typo
  theme/ThemeProvider.tsx useTheme() → { c, space, radius, font, name }
  ui/                     Composants partagés — voir §5
  engine/
    types.ts              GameMeta, GameScreenProps, catégories
    settings.tsx          Réglages persistés
    progress.tsx          Records, victoires, favoris, parties jouées
    frame.tsx             Lien jeu ↔ en-tête (ligne d'état, bouton recommencer)
    storage.ts            Enveloppe AsyncStorage
    navigation.ts         useRetour() — retour au catalogue
  pub/                    Publicité — voir §10. Les jeux ne la touchent jamais.
    types.ts              Vocabulaire maison : AdaptateurPub, InfoConsentement
    config.ts             Identifiants, fréquence, classement de contenu
    machine.ts            Quand une annonce a le droit de partir (sans React)
    adaptateur.ts         Web : ne fait rien · adaptateur.native.ts : le SDK
    regie.tsx             Fournisseur React, useRegiePub, useRecompense
  games/
    registry.ts           Registre central : un import + une ligne par jeu
    lib/                  rng, hooks de boucle, moteur de cartes, listes de mots
    plateau/ cartes/ logique/ arcade/ des/ papier/
```

Alias TypeScript : `@/` pointe sur `src/`.

---

## 4. Le contrat d'un jeu

**C'est la seule chose à connaître pour ajouter un jeu.** Un jeu est un fichier
qui exporte `meta` et un composant par défaut. Il hérite automatiquement de
l'en-tête, de la fiche du catalogue, de l'écran de règles, du bouton
« recommencer » et de l'enregistrement des records.

### 4.1 Le fichier du jeu

```tsx
// src/games/logique/mon-jeu.tsx
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Txt, GameOver } from '@/ui';

export const meta: GameMeta = {
  id: 'mon-jeu',              // unique, en kebab-case, sert d'URL
  name: 'Mon jeu',
  tagline: 'Une phrase qui donne envie.',
  category: 'logique',        // plateau | cartes | logique | arcade | des | papier
  emoji: '🧩',
  difficulty: 2,              // 1 accessible · 2 intermédiaire · 3 exigeant
  players: '1',               // '1' | '1-2' | '2' | '2-4'
  minutes: 5,                 // durée typique d'une partie
  score: 'high',              // high | low | time | none — voir 4.3
  scoreUnit: 'pts',
  tags: ['puzzle', 'solo'],
  rules: [                    // 3 à 5 phrases, montrées au premier lancement
    'Première règle.',
    'Deuxième règle.',
  ],
};

export default function MonJeu({ submitScore, submitResult, best, haptic }: GameScreenProps) {
  const recommencer = useCallback(() => { /* remet l'état à zéro */ }, []);

  useFrameRestart(recommencer);                       // branche le bouton ↻
  useFrameStatus(<Txt variant="label">Score 0</Txt>); // ligne sous le titre

  return <View />;
}
```

### 4.2 L'inscrire au registre

Dans `src/games/registry.ts`, deux lignes — un import dans la section de sa
catégorie, une entrée dans `MODULES`. Rien d'autre. Le catalogue, les compteurs
par catégorie et la recherche se mettent à jour tout seuls.

### 4.3 Les props reçues

| Prop | Rôle |
|---|---|
| `submitScore(n)` | Enregistre un score final. **Renvoie `true` si c'est un record.** |
| `submitResult('win' \| 'loss' \| 'draw')` | Pour les jeux sans score chiffré (`score: 'none'`). |
| `best` | Meilleur score connu, ou `undefined`. |
| `haptic(kind)` | Vibration respectant les réglages. `light` `medium` `heavy` `success` `warning` `error`. |
| `meta` | Les métadonnées ci-dessus. |

`score` détermine la comparaison des records : `high` = le plus grand gagne,
`low` et `time` = le plus petit gagne, `none` = pas de record, on suit
victoires/défaites.

**Appeler `submitScore` exactement une fois par partie.** Le garder derrière un
drapeau (`useState` ou `useRef`) armé à la fin de partie et désarmé au
redémarrage.

---

## 5. Les composants partagés

Tout vient de `@/ui` :

| Composant | Usage |
|---|---|
| `Txt` | Tout texte. `variant` = h1…h3, body, label, caption, mono. `tone` = dim, faint, accent, danger… |
| `Button` | `kind` = primary, secondary, ghost, danger. |
| `Card` `Row` `Badge` `Divider` `IconButton` | Mise en page. |
| `Segmented` | Sélecteur de niveau ou de mode — présent dans presque tous les jeux. |
| `Sheet` | Feuille modale par le bas. |
| `GameOver` | Écran de fin : titre, score, record, rejouer/quitter. |
| `Carte` `EmplacementVide` | Cartes à jouer. |
| `De` | Dé à six faces, avec points dessinés. |
| `BoutonControle` `CroixDirectionnelle` `useClavier` | Manette tactile et clavier (web). |

Et de `src/games/lib/` :

| Module | Contenu |
|---|---|
| `rng.ts` | `randInt` `randBetween` `pick` `shuffle` `seeded` `clamp` `range` |
| `hooks.ts` | `useInterval` `useRafLoop` `useTimer` `formatClock` `useBoardSize` `useUndoable`. Les deux hooks de boucle se figent tout seuls quand le jeu est en pause. |
| `cartes.ts` | Jeux de 52/32 cartes, valeurs blackjack, suites circulaires |
| `mots.ts` | Mots avec indices, mots de cinq lettres, vocabulaire de validation (`MOTS_JEU`, `DICTIONNAIRE`) |
| `regles.ts` | Barèmes extraits de leurs jeux : yams, farkle, zanzibar, 421, Motus |
| `echecs.ts` | Moteur d'échecs complet, sans React : règles, recherche, notation |
| `backgammon.ts` | Moteur de backgammon, sans React : règles, suites légales, IA probabiliste |

---

## 6. Conventions

- **Français partout** : interface, commentaires, noms de variables du code
  métier. Les APIs React gardent leurs noms anglais.
- **Aucune couleur en dur** hors `theme/tokens.ts`, sauf les couleurs propres à
  un jeu (les tuiles de 2048, les pièces de Briques) — et alors en constante
  nommée en haut du fichier.
- **Accessibilité** : tout élément tactile porte `accessibilityRole` et
  `accessibilityLabel` en français, et fait **au moins 44 points** de côté —
  le minimum recommandé par Apple. Les cases d'un plateau sont la seule
  exception : on ne met pas 144 tuiles de mahjong à 44 px.
- **Un jeu ne se pilote jamais au geste seul.** Sans bouton étiqueté ni
  clavier, il est injouable au navigateur et muet pour un lecteur d'écran.
  `npm run audit` refuse ce cas.
- **Trois niveaux de difficulté** dès que c'est pertinent, via `Segmented`, plus
  un mode **Duo** sur le même appareil pour les jeux à deux.
- **Les IA de jeu doivent être honnêtes** : minimax complet quand l'espace de
  recherche le permet, alpha-beta sinon, jamais de triche sur l'état caché.
- `npm run verifier` doit passer avant toute livraison : il enchaîne le
  contrôle de types, l'audit du catalogue et les tests des deux moteurs.

---

## 7. Pièges connus — lis-les avant de déboguer

Ces huit erreurs ont déjà été commises et corrigées dans ce dépôt. Elles sont
faciles à réintroduire.

**1. `submitScore` doit garder une identité stable.**
Les jeux l'appellent depuis un `useEffect` en la mettant dans les dépendances.
Si sa référence change à chaque enregistrement, l'effet se rappelle sans fin →
*Maximum update depth exceeded*. Dans `progress.tsx` elle lit l'état via une ref,
jamais via `state`. Même règle pour toute fonction exposée par un contexte.

**2. La ligne d'état ne doit pas re-rendre le jeu.**
`useFrameStatus` publie hors de l'arbre React ; seul le composant feuille
`StatusSlot` s'y abonne. Si l'en-tête s'abonnait et englobait le jeu, chaque
publication re-rendrait le jeu, qui republierait : boucle infinie.

**3. Jamais d'effet de bord dans un updater `setState`.**
Pas de `submitScore`, `setOver` ni `haptic` dans `setState(prev => …)` : React
peut rejouer l'updater. Calculer avant, appeler `setState` avec le résultat. Les
jeux d'arcade tiennent leur état de boucle dans des refs et ne poussent vers
React que pour l'affichage.

**4. `router.back()` échoue sur une pile d'un seul écran.**
Ouvrir un jeu par son URL laisse une pile vide → *GO_BACK was not handled*.
`canGoBack()` ne sauve pas : sur le web il consulte l'historique du navigateur.
Utiliser `useRetour()` de `engine/navigation.ts`, qui fait `dismissTo('/')`.

**5. Une boucle de jeu ne doit pas tourner pendant la lecture des règles.**
L'hôte met le jeu en pause tant que la feuille de règles est ouverte, et
`useInterval` comme `useRafLoop` consultent cette pause d'eux-mêmes via
`usePauseJeu()`. Un jeu qui fabrique sa propre boucle — `setInterval` brut ou
`requestAnimationFrame` direct — contourne ce garde-fou : le joueur perdait des
vies, du temps au chrono et des points avant même d'avoir commencé. **Toujours
passer par les hooks partagés.** En plus de la pause, un jeu d'action gagne à
attendre une première action explicite (« Touche pour lancer »).

**6. Une carte à jouer a toujours un fond clair.**
Sa teinte ne doit pas suivre le thème, sinon les piques et trèfles deviennent
blancs sur blanc en mode sombre.

**7. Ne jamais déclarer un composant dans un composant.**
`const Fleche = (...) => <View/>` écrit dans le corps du jeu crée un *type*
neuf à chaque rendu : React démonte puis remonte tout le sous-arbre, perd son
état, et les nœuds changent d'identité entre deux touchers — au point que des
appuis se perdent. Quatre jeux avaient ce défaut. Soit le composant sort au
niveau du module, soit — s'il a besoin de l'état du jeu — il devient une simple
fonction appelée `{rendreFleche(i)}`, sans passer par JSX. `npm run audit`
signale ce cas.

**8. Metro résout les `require` statiquement, même à l'intérieur d'un `try`.**
Un module natif ne se cache pas derrière un garde-fou `Platform.OS === 'web'` :
le code n'est jamais exécuté, mais le fichier est quand même tiré dans le
paquet, et la construction web échoue avec *« Importing native-only module
codegenNativeComponent on web »*. La seule parade est l'extension de
plateforme : `adaptateur.native.ts` et `Banniere.native.tsx` pour le natif,
`adaptateur.ts` et `Banniere.tsx` pour le web. La CI vérifie que le paquet web
ne contient pas `GoogleMobileAds`.

---

## 8. Vérifier son travail

```bash
npm run verifier      # obligatoire — enchaîne les huit contrôles ci-dessous
npm run web           # puis ouvrir le jeu et y jouer réellement
```

| Commande | Ce qu'elle contrôle |
|---|---|
| `npm run typecheck` | TypeScript strict sur tout le dépôt |
| `npm run audit` | Le contrat d'un jeu et les sept pièges, sur les 100 fichiers |
| `npm run audit:confidentialite` | Aucun appel réseau hors `src/pub/`, dépendances recensées, permissions justifiées — y compris dans le manifeste Android fusionné |
| `npm run test:fiches` | Les chiffres des fiches de magasin correspondent au code |
| `npm run test:regles` | Les règles partagées : paquets, blackjack, scopa, vocabulaire, aléatoire |
| `npm run test:regles-jeux` | Les barèmes propres aux jeux : yams, farkle, zanzibar, 421, Motus |
| `npm run test:pub` | Fréquence, consentement, pannes : la logique publicitaire, avec un faux SDK |
| `npm run test:moteurs` | Échecs (perft sur cinq positions) et backgammon (scénarios + 400 parties) |

**Chaque maillon fait échouer la chaîne.** Tous ont été éprouvés sur un défaut
injecté volontairement : aucun ne se contente d'afficher un message. Si tu
ajoutes un contrôle, termine-le par `process.exit(1)`.

**Le nombre total de contrôles varie d'une exécution à l'autre** (environ 540).
Les tests d'échecs et de backgammon comptent des assertions par coup sur des
parties tirées au hasard : le total bouge, pas la couverture. Ne pas citer un
chiffre figé dans un rapport.

`outils/audit.mjs` relit chaque fichier de jeu : meta complète, identifiant
unique, catégorie cohérente avec le dossier, trois à cinq règles, pas de boucle
brute, pas de `router.back()`, pas d'effet de bord dans un updater, pas de
composant imbriqué, étiquettes d'accessibilité, inscription au registre,
totaux par catégorie. Sortie vide = rien à signaler.

Un jeu n'est pas terminé tant qu'une partie complète n'a pas été jouée : début,
coups, fin de partie, enregistrement du record, bouton recommencer, mode duo si
présent. La console du navigateur doit rester vide d'erreurs.

---

## 9. La publicité, en six règles

Le détail est dans [docs/MONETISATION.md](docs/MONETISATION.md). Ce qu'il faut
tenir sans jamais y déroger :

1. **Aucun fichier de `src/games/` ne connaît la publicité.** Ni import, ni
   appel, ni composant. `npm run test:pub` le vérifie sur les cent fichiers.
2. **Jamais pendant une partie.** L'écran de jeu verrouille la régie tant
   qu'il est monté. Un interstitiel ne part qu'à la sortie.
3. **Une annonce indisponible ne bloque rien.** Pas de réseau, refus de
   consentement, module absent : la machine renvoie une raison, ne jette
   jamais, et l'appelant poursuit son chemin normal.
4. **Un consentement inconnu vaut un refus.** On ne suppose jamais un accord.
5. **Jamais de vrai identifiant en développement, jamais de bloc de test en
   production.** `src/pub/config.ts` s'en charge ; cliquer sur ses propres
   annonces fait fermer un compte AdMob.
6. **La séparation web / natif passe par l'extension de fichier.** Metro
   résout les `require` statiquement, même dans un `try` : sans
   `adaptateur.native.ts` et `Banniere.native.tsx`, le paquet web refuse de
   se construire. Ne pas « simplifier » en fusionnant ces fichiers.

---

## 10. Pour aller plus loin

- [docs/MONETISATION.md](docs/MONETISATION.md) — architecture publicitaire,
  consentement, identifiants, coûts et risques.
- [docs/ANNEXE.md](docs/ANNEXE.md) — catalogue complet des cent jeux, référence
  des jetons de design, API détaillée, journal des décisions et des correctifs.
- [docs/PROTOCOLE_APPAREIL.md](docs/PROTOCOLE_APPAREIL.md) — l'essai sur
  téléphone, entièrement à NOT RUN : c'est le principal angle mort du projet.
- [docs/PUBLICATION.md](docs/PUBLICATION.md) — ce qui est prêt pour l'App Store
  et Google Play, et ce qui demande les comptes développeur de l'utilisateur.
- [MEMORY.md](MEMORY.md) — reprise de projet : état, décisions, ce qui reste.
- [docs/VALIDATION_100_JEUX.md](docs/VALIDATION_100_JEUX.md) — ce qui a été
  réellement testé sur chacun des cent jeux, et ce qui ne l'a pas été.
- [README.md](README.md) — présentation, installation, fabrication des binaires
  iOS et Android avec EAS Build.
