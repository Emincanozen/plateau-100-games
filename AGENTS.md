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
| Solo et multi **local** uniquement | Aucun serveur, aucun compte, aucun réseau. Jamais de `fetch`. |
| Tout est **hors ligne** | Les scores vivent dans AsyncStorage, sur l'appareil. |
| Catalogue **équilibré** | ~20 plateau, ~20 cartes, ~20 logique, ~20 arcade, ~10 dés, ~10 papier. |
| Design **moderne épuré**, clair + sombre | Aucune couleur en dur hors des jetons de thème. |
| Interface **en français** | Y compris les noms de variables et les commentaires du code métier. |

**État actuel : 75 jeux sur 100.** Les catégories Cartes, Arcade et Logique sont complètes. Le décompte exact et la liste des jeux
restants sont dans l'annexe.

---

## 2. Démarrer

```bash
npm install
npm start        # puis « i », « a », ou le QR code avec Expo Go
npm run web      # itération rapide dans un navigateur
npm run typecheck
```

> Sous PowerShell, utiliser `npx.cmd` et non `npx` : la politique d'exécution
> bloque les scripts `.ps1`.

**Stack** : Expo SDK 57 · React Native 0.86 · React 19.2 · expo-router 7 ·
TypeScript strict · Reanimated 4 · react-native-svg · AsyncStorage.

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
| `mots.ts` | Listes de mots français avec indices |

---

## 6. Conventions

- **Français partout** : interface, commentaires, noms de variables du code
  métier. Les APIs React gardent leurs noms anglais.
- **Aucune couleur en dur** hors `theme/tokens.ts`, sauf les couleurs propres à
  un jeu (les tuiles de 2048, les pièces de Briques) — et alors en constante
  nommée en haut du fichier.
- **Accessibilité** : tout élément tactile porte `accessibilityRole` et
  `accessibilityLabel` en français.
- **Trois niveaux de difficulté** dès que c'est pertinent, via `Segmented`, plus
  un mode **Duo** sur le même appareil pour les jeux à deux.
- **Les IA de jeu doivent être honnêtes** : minimax complet quand l'espace de
  recherche le permet, alpha-beta sinon, jamais de triche sur l'état caché.
- `npm run typecheck` doit passer avant toute livraison.

---

## 7. Pièges connus — lis-les avant de déboguer

Ces cinq erreurs ont déjà été commises et corrigées dans ce dépôt. Elles sont
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

---

## 8. Vérifier son travail

```bash
npm run typecheck     # obligatoire
npm run web           # puis ouvrir le jeu et y jouer réellement
```

Un jeu n'est pas terminé tant qu'une partie complète n'a pas été jouée : début,
coups, fin de partie, enregistrement du record, bouton recommencer, mode duo si
présent. La console du navigateur doit rester vide d'erreurs.

---

## 9. Pour aller plus loin

- [docs/ANNEXE.md](docs/ANNEXE.md) — catalogue complet des jeux faits et
  restants, référence des jetons de design, API détaillée, journal des décisions.
- [README.md](README.md) — présentation, installation, fabrication des binaires
  iOS et Android avec EAS Build.
