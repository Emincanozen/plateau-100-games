# Plateau

Une application de jeux pour **iOS et Android** : une centaine de jeux de
société, de cartes, de logique, d'arcade, de dés et de papier-crayon, réunis dans
un seul catalogue, à partir d'un seul code source.

Tout fonctionne **hors ligne** : aucun compte, aucun serveur, aucune donnée
envoyée. Les scores, records et favoris restent sur l'appareil.

> **État : 33 jeux sur 100.** Le catalogue complet et la liste des jeux restants
> sont dans l'[annexe](docs/ANNEXE.md#a--catalogue-des-jeux-livrés).

---

## Ce qu'il y a dedans

| Catégorie | Livrés | Exemples |
|---|---|---|
| ♟️ Plateau | 5 / 20 | Morpion, Puissance 4, Othello, Dames, Cinq en ligne |
| 🃏 Cartes | 8 / 20 | Solitaire, Pyramide, Les trois pics, Golf, Blackjack, Vidéo poker |
| 🧩 Logique | 10 / 20 | 2048, Démineur, Sudoku, Taquin, Mastermind, Tours de Hanoï |
| 🕹️ Arcade | 7 / 20 | Snake, Briques, Casse-briques, Pong, Envol, Course sans fin |
| 🎲 Dés | 1 / 10 | Yams |
| ✏️ Papier-crayon | 2 / 10 | Le pendu, Allumettes |

Chaque jeu propose **trois niveaux de difficulté** et, quand la règle s'y prête,
un **mode Duo** sur le même appareil. Les adversaires sont de vraies IA : minimax
complet au morpion, alpha-beta aux dames et au Puissance 4, évaluation
positionnelle à Othello, stratégie de Nim parfaite aux allumettes.

L'application retient tes records, tes victoires et tes favoris, affiche les
règles au premier lancement de chaque jeu, et suit le thème clair ou sombre du
système.

---

## Démarrer

```bash
npm install
npm start
```

Puis, dans le terminal d'Expo :

- `i` lance le simulateur iOS (nécessite un Mac)
- `a` lance l'émulateur Android
- ou scanne le QR code avec l'application **Expo Go** sur ton téléphone

Pour itérer vite dans un navigateur :

```bash
npm run web
```

> Sous PowerShell, utiliser `npx.cmd` et non `npx` : la politique d'exécution par
> défaut bloque les scripts `.ps1`.

---

## Fabriquer les applications

Les binaires se construisent dans le cloud avec **EAS Build** — pas besoin de Mac
pour iOS.

```bash
npm install -g eas-cli
eas login
eas build:configure

eas build --platform android --profile preview   # APK installable directement
eas build --platform ios --profile preview       # nécessite un compte Apple Developer
```

Pour les magasins :

```bash
eas build --platform all --profile production
eas submit --platform android
eas submit --platform ios
```

L'identifiant d'application est `com.plateau.jeux` sur les deux plateformes
(`app.json`). L'icône et l'écran de lancement sont encore ceux du modèle Expo :
à remplacer avant publication.

---

## Architecture

```
app/                      Routes (expo-router)
  _layout.tsx             Fournisseurs : réglages, progression, thème
  index.tsx               Catalogue : recherche, filtres, favoris, reprise
  game/[id].tsx           Hôte de jeu : en-tête, règles, recommencer, scores
  reglages.tsx            Thème, vibrations, statistiques, remise à zéro

src/
  theme/                  Jetons de design et thème clair/sombre
  ui/                     Composants partagés
  engine/                 Types, réglages, progression, lien jeu ↔ en-tête
  games/
    registry.ts           Registre central : un import par jeu
    lib/                  Aléatoire, boucles de jeu, moteur de cartes, mots
    plateau/ cartes/ logique/ arcade/ des/ papier/
```

### Ajouter un jeu

1. Créer `src/games/<catégorie>/<mon-jeu>.tsx`.
2. Exporter `meta` (un `GameMeta`) et un composant par défaut recevant
   `GameScreenProps`.
3. Ajouter l'import et l'entrée dans `src/games/registry.ts`.

Le jeu hérite alors de l'en-tête, des règles, du bouton « recommencer », de
l'enregistrement des records et de sa fiche dans le catalogue.

```tsx
export const meta: GameMeta = { id: 'mon-jeu', name: 'Mon jeu', /* … */ };

export default function MonJeu({ submitScore, best, haptic }: GameScreenProps) {
  useFrameRestart(recommencer);        // branche le bouton ↻ de l'en-tête
  useFrameStatus(<Txt>Score 0</Txt>);  // ligne d'état sous le titre
  return <View />;
}
```

Le contrat complet est décrit dans [AGENTS.md](AGENTS.md#4-le-contrat-dun-jeu).

---

## Documentation

| Fichier | Pour qui |
|---|---|
| **[AGENTS.md](AGENTS.md)** | **Point d'entrée unique pour un agent IA.** Se suffit à lui-même : contraintes du projet, carte du code, contrat d'un jeu, conventions, pièges connus. |
| [docs/ANNEXE.md](docs/ANNEXE.md) | Listes exhaustives : catalogue, jeux restants, API détaillée, jetons de design, journal des correctifs. |
| README.md | Ce fichier : présentation, installation, fabrication des binaires. |

`CLAUDE.md` pointe simplement sur `AGENTS.md`, pour que les outils qui cherchent
l'un ou l'autre trouvent le même document.

---

## Vérifications

```bash
npm run typecheck
```

TypeScript est en mode strict et doit passer sans erreur. Il n'y a pas encore de
tests automatisés : un jeu se valide en y jouant une partie complète, via
`npm run web` ou sur un téléphone.

---

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · expo-router 7 · TypeScript strict ·
Reanimated 4 · react-native-gesture-handler · react-native-svg · AsyncStorage ·
expo-haptics.

## Licence

MIT — voir [LICENSE](LICENSE).
