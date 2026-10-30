# Plateau

Une application de jeux pour **iOS et Android** : une centaine de jeux de
société, de cartes, de logique, d'arcade, de dés et de papier-crayon, réunis dans
un seul catalogue, à partir d'un seul code source.

Les cent jeux fonctionnent **hors ligne** : aucun compte, aucun serveur. Les
scores, records et favoris restent sur l'appareil et ne sont envoyés nulle
part. L'application est gratuite et financée par la publicité — Google AdMob,
confiné à `src/pub/`, et sans lequel tous les jeux tournent quand même. Voir
[docs/MONETISATION.md](docs/MONETISATION.md).

> **État : 100 jeux sur 100.** Le catalogue est complet. Le détail est dans
> l’[annexe](docs/ANNEXE.md#a--catalogue-des-jeux-livrés), la mise sur les magasins
> dans le [guide de publication](docs/PUBLICATION.md).

---

## Ce qu'il y a dedans

| Catégorie | Livrés | Exemples |
|---|---|---|
| ♟️ Plateau | **20 / 20** | Échecs, Backgammon, Othello, Dames, Moulin, Hex, Quarto, Amazones, Brandubh, Petits chevaux… |
| 🃏 Cartes | **20 / 20** | Solitaire, FreeCell, Araignée, Yukon, Canfield, Pyramide, Scopa, Président, Rami… |
| 🧩 Logique | **20 / 20** | 2048, Démineur, Sudoku, Nonogram, Sokoban, Binairo, Futoshiki, Hitori, Mahjong, Embouteillage… |
| 🕹️ Arcade | **20 / 20** | Snake, Briques, Envahisseurs, Astéroïdes, Labyrinthe aux fantômes, Bulles, Missiles, Traversée… |
| 🎲 Dés | **10 / 10** | Yams, Farkle, 421, Dés menteurs, Craps, Zanzibar, Chicago… |
| ✏️ Papier-crayon | **10 / 10** | Le pendu, Motus, Bataille navale, Boggle, Mots mêlés, SOS, Anagrammes… |

Chaque jeu propose **trois niveaux de difficulté** et, quand la règle s'y prête,
un **mode Duo** sur le même appareil. Les adversaires sont de vraies IA : minimax
complet au morpion, alpha-beta aux dames et au Puissance 4, évaluation
positionnelle à Othello, recherche Monte-Carlo à Hex, évaluation de territoire
aux Amazones, espérance sur les vingt-et-un lancers au backgammon. Le moteur
d’échecs applique les règles complètes et sa génération de coups est vérifiée
par dénombrement (« perft ») sur cinq positions de référence.

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

> **Expo Go ne fonctionne plus sur ce projet.** L'intégration publicitaire a
> introduit un module natif qui n'y existe pas. Pour tout ce qui touche à la
> publicité, il faut une compilation de développement :
> `eas build --profile development --platform android`.

Pour itérer vite dans un navigateur — c'est le chemin normal, et il couvre les
cent jeux :

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
eas init
```

Trois profils sont définis dans `eas.json` : `development`, `apercu` et
`production`.

```bash
eas build --platform android --profile apercu   # APK installable directement
eas build --platform ios --profile apercu       # build simulateur
```

Pour les magasins :

```bash
eas build --platform all --profile production
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

L'identifiant d'application est `com.plateau.jeux` sur les deux plateformes
(`app.json`). L'icône, l'icône adaptative Android et l'écran de lancement sont
générés par `node outils/icones.mjs`.

La marche à suivre complète — comptes développeur, signature, fiches des
magasins — est dans le [guide de publication](docs/PUBLICATION.md).

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
| [MEMORY.md](MEMORY.md) | Reprise de projet : où en est le travail, ce qui a été décidé, ce qui reste. |
| [docs/ANNEXE.md](docs/ANNEXE.md) | Listes exhaustives : catalogue des 100 jeux, API détaillée, jetons de design, journal des correctifs. |
| [docs/VALIDATION_100_JEUX.md](docs/VALIDATION_100_JEUX.md) | Matrice de validation, jeu par jeu, avec le détail de ce qui a été réellement testé. |
| [docs/PUBLICATION.md](docs/PUBLICATION.md) | Mise sur l'App Store et Google Play : ce qui est prêt, ce qui demande tes comptes. |
| [docs/CONFIDENTIALITE.md](docs/CONFIDENTIALITE.md) | Politique de confidentialité, établie sur un relevé vérifié du code. |
| [docs/store/](docs/store/) | Textes et éléments des fiches magasins. |
| README.md | Ce fichier : présentation, installation, fabrication des binaires. |

`CLAUDE.md` pointe simplement sur `AGENTS.md`, pour que les outils qui cherchent
l'un ou l'autre trouvent le même document.

---

## Vérifications

```bash
npm run verifier
```

Cette commande enchaîne sept contrôles et **s'arrête au premier échec** :

| Commande | Ce qu'elle contrôle |
|---|---|
| `npm run typecheck` | TypeScript strict sur tout le dépôt |
| `npm run audit` | Le contrat d'un jeu et les sept pièges connus, sur les 100 fichiers |
| `npm run audit:confidentialite` | Aucun appel réseau hors `src/pub/`, dépendances recensées, permissions justifiées |
| `npm run test:fiches` | Les chiffres des fiches de magasin correspondent au code |
| `npm run test:regles` | Les règles déterministes : cartes, scores de dés, mots, registre |
| `npm run test:pub` | Fréquence, consentement et pannes publicitaires, avec un faux SDK |
| `npm run test:moteurs` | Échecs (perft) et backgammon (invariants et scénarios) |

Environ **540 assertions** au total. Le chiffre bouge d'une exécution à
l'autre : les tests de moteur comptent des assertions par coup sur des parties
tirées au hasard.

Cela ne remplace pas de jouer. Un jeu n'est validé qu'après une partie complète
— début, coups, fin, record, bouton recommencer — via `npm run web` ou sur un
téléphone. L'état jeu par jeu est tenu dans
[docs/VALIDATION_100_JEUX.md](docs/VALIDATION_100_JEUX.md).

---

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · expo-router 7 · TypeScript strict ·
Reanimated 4 · react-native-gesture-handler · react-native-svg · AsyncStorage ·
expo-haptics · expo-audio · expo-splash-screen.

## Licence

MIT — voir [LICENSE](LICENSE).

## Revue privée

[Résultats et limites de la revue du 30 octobre 2026](REVIEW.md).
