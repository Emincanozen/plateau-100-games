# Annexe

Compléments du [briefing](../AGENTS.md). Ce document contient les listes
exhaustives et les références détaillées. **Il n'est pas nécessaire de le lire en
entier** : va directement à la section dont tu as besoin.

- [A. Catalogue des jeux livrés](#a--catalogue-des-jeux-livrés)
- [B. Les jeux restants](#b--les-jeux-restants)
- [C. Référence de l'API des jeux](#c--référence-de-lapi-des-jeux)
- [D. Jetons de design](#d--jetons-de-design)
- [E. Bibliothèques partagées](#e--bibliothèques-partagées)
- [F. Journal des décisions et des correctifs](#f--journal-des-décisions-et-des-correctifs)
- [G. Points ouverts](#g--points-ouverts)

---

## A · Catalogue des jeux livrés

**65 jeux sur 100.** Colonne « Score » : mode de comparaison des records —
`high` le plus grand gagne, `low` et `time` le plus petit gagne, `none` pas de
record chiffré (on suit victoires/défaites).

### Plateau — 6 sur 20

| id | Nom | Joueurs | Score | Fichier |
|---|---|---|---|---|
| `morpion` | Morpion | 1-2 | none | `plateau/morpion.tsx` |
| `puissance4` | Puissance 4 | 1-2 | none | `plateau/puissance4.tsx` |
| `othello` | Othello | 1-2 | none | `plateau/othello.tsx` |
| `dames` | Dames | 1-2 | none | `plateau/dames.tsx` |
| `gomoku` | Cinq en ligne | 1-2 | none | `plateau/gomoku.tsx` |
| `awale` | Awalé | 1-2 | none | `plateau/awale.tsx` |

Tous ont trois niveaux d'IA et un mode Duo sur le même appareil.
IA employées : minimax complet (morpion), alpha-beta profondeur 5 (Puissance 4,
dames), alpha-beta avec table de poids positionnels (Othello), évaluation de
menaces par fenêtre glissante (Cinq en ligne), alpha-beta profondeur 6 sur les
greniers et les prises potentielles (Awalé).

### Cartes — 20 sur 20 ✅

| id | Nom | Joueurs | Score | Fichier |
|---|---|---|---|---|
| `solitaire` | Solitaire (Klondike) | 1 | low — coups | `cartes/solitaire.tsx` |
| `pyramide` | Pyramide | 1 | high — cartes | `cartes/pyramide.tsx` |
| `tri-peaks` | Les trois pics | 1 | high — pts | `cartes/tri-peaks.tsx` |
| `golf` | Golf | 1 | low — cartes restantes | `cartes/golf.tsx` |
| `blackjack` | Blackjack | 1 | high — jetons | `cartes/blackjack.tsx` |
| `video-poker` | Vidéo poker | 1 | high — jetons | `cartes/video-poker.tsx` |
| `bataille` | Bataille | 1 | none | `cartes/bataille.tsx` |
| `huit-americain` | Huit américain | 1 | none | `cartes/huit-americain.tsx` |
| `freecell` | FreeCell | 1 | low — coups | `cartes/freecell.tsx` |
| `araignee` | Araignée | 1 | low — coups | `cartes/araignee.tsx` |
| `yukon` | Yukon | 1 | low — coups | `cartes/yukon.tsx` |
| `canfield` | Canfield | 1 | high — cartes rangées | `cartes/canfield.tsx` |
| `quarante-voleurs` | Les quarante voleurs | 1 | low — coups | `cartes/quarante-voleurs.tsx` |
| `accordeon` | Accordéon | 1 | low — tas | `cartes/accordeon.tsx` |
| `president` | Président | 1 | low — place | `cartes/president.tsx` |
| `rami` | Rami | 1 | low — points | `cartes/rami.tsx` |
| `scopa` | Scopa | 1 | none | `cartes/scopa.tsx` |
| `menteur` | Le menteur | 1 | none | `cartes/menteur.tsx` |
| `pouilleux` | Le pouilleux | 1 | none | `cartes/pouilleux.tsx` |
| `trente-et-un` | Trente-et-un | 1 | none | `cartes/trente-et-un.tsx` |

Les sept réussites (Klondike, FreeCell, Araignée, Yukon, Canfield, Quarante
voleurs, Golf) partagent le même schéma d'interaction : toucher une carte la
sélectionne, toucher la destination la déplace, retoucher la carte déjà
sélectionnée tente de la monter en fondation.

Scopa utilise un paquet de 40 cartes (`jeu40()`) et ses propres valeurs de
capture (`valeurScopa()` : as = 1, sept = 7, valet = 8, dame = 9, roi = 10).
FreeCell calcule la longueur transportable par la formule
`(cases libres + 1) × 2^(colonnes vides)`. Araignée propose 1, 2 ou 4 couleurs,
ce qui change radicalement la difficulté.

### Logique — 10 sur 20

| id | Nom | Joueurs | Score | Fichier |
|---|---|---|---|---|
| `2048` | 2048 | 1 | high — pts | `logique/jeu2048.tsx` |
| `demineur` | Démineur | 1 | time | `logique/demineur.tsx` |
| `sudoku` | Sudoku | 1 | time | `logique/sudoku.tsx` |
| `memory` | Memory | 1-2 | low — coups | `logique/memory.tsx` |
| `taquin` | Taquin | 1 | low — coups | `logique/taquin.tsx` |
| `hanoi` | Tours de Hanoï | 1 | low — coups | `logique/hanoi.tsx` |
| `mastermind` | Mastermind | 1 | low — essais | `logique/mastermind.tsx` |
| `lights-out` | Tout éteindre | 1 | low — coups | `logique/lights-out.tsx` |
| `flood` | Inondation | 1 | low — coups | `logique/flood.tsx` |
| `simon` | Séquence | 1 | high — niveau | `logique/simon.tsx` |

Le sudoku génère ses grilles par retour arrière puis retire des cases tant que
la solution reste unique — les grilles sont donc toujours résolubles sans
supposition. Même principe pour le taquin (mélange par coups légaux) et pour
Tout éteindre (mélange depuis une grille éteinte).

### Arcade — 20 sur 20 ✅

| id | Nom | Joueurs | Score | Fichier |
|---|---|---|---|---|
| `snake` | Snake | 1 | high — pts | `arcade/snake.tsx` |
| `tetris` | Briques | 1 | high — pts | `arcade/tetris.tsx` |
| `casse-briques` | Casse-briques | 1 | high — pts | `arcade/casse-briques.tsx` |
| `pong` | Pong | 1-2 | none | `arcade/pong.tsx` |
| `flappy` | Envol | 1 | high — passages | `arcade/flappy.tsx` |
| `taupes` | Chasse aux taupes | 1 | high — pts | `arcade/taupes.tsx` |
| `dino` | Course sans fin | 1 | high — m | `arcade/dino.tsx` |
| `envahisseurs` | Envahisseurs | 1 | high — pts | `arcade/envahisseurs.tsx` |
| `asteroides` | Astéroïdes | 1 | high — pts | `arcade/asteroides.tsx` |
| `labyrinthe-fantomes` | Labyrinthe aux fantômes | 1 | high — pts | `arcade/labyrinthe-fantomes.tsx` |
| `missiles` | Missiles | 1 | high — pts | `arcade/missiles.tsx` |
| `bulles` | Bulles | 1 | high — pts | `arcade/bulles.tsx` |
| `traversee` | Traversée | 1 | high — pts | `arcade/traversee.tsx` |
| `saut-plateforme` | Saut de plateforme | 1 | high — m | `arcade/saut-plateforme.tsx` |
| `helicoptere` | Hélicoptère | 1 | high — m | `arcade/helicoptere.tsx` |
| `tunnel` | Tunnel | 1 | high — m | `arcade/tunnel.tsx` |
| `empilage` | Empilage | 1 | high — étages | `arcade/empilage.tsx` |
| `esquive` | Esquive | 1 | high — s | `arcade/esquive.tsx` |
| `squash` | Squash | 1 | high — échanges | `arcade/squash.tsx` |
| `reflexes` | Réflexes | 1 | time — ms | `arcade/reflexes.tsx` |

Tous les jeux d'action tiennent leur état de boucle dans des `useRef` et ne
poussent vers React que ce qui doit s'afficher. Les boucles passent par
`useRafLoop` (60 images par seconde) ou `useInterval` (jeux à cases : Snake,
Briques, Labyrinthe), qui se figent automatiquement quand le jeu est en pause.

Le labyrinthe aux fantômes est décrit par un plan en caractères (`#` mur,
`.` pastille, `o` super-pastille) : le modifier suffit à changer le niveau.
Les fantômes choisissent leur direction à chaque intersection en se rapprochant
du joueur, ou en le fuyant quand ils sont vulnérables, avec 22 % de hasard pour
qu'ils ne soient pas parfaitement prévisibles.

### Dés — 4 sur 10

| id | Nom | Joueurs | Score | Fichier |
|---|---|---|---|---|
| `yams` | Yams | 1 | high — pts | `des/yams.tsx` |
| `cochon` | Cochon | 1-2 | none | `des/cochon.tsx` |
| `421` | 421 | 1 | low — jetons | `des/quatre-cent-vingt-et-un.tsx` |
| `fermer-la-boite` | Fermer la boîte | 1 | low — pts restants | `des/fermer-la-boite.tsx` |

### Papier-crayon — 5 sur 10

| id | Nom | Joueurs | Score | Fichier |
|---|---|---|---|---|
| `pendu` | Le pendu | 1 | high — série | `papier/pendu.tsx` |
| `allumettes` | Allumettes (Nim) | 1-2 | none | `papier/allumettes.tsx` |
| `points-et-carres` | Points et carrés | 1-2 | none | `papier/points-et-carres.tsx` |
| `motus` | Motus | 1 | low — essais | `papier/motus.tsx` |
| `bataille-navale` | Bataille navale | 1 | low — tirs | `papier/bataille-navale.tsx` |

---

## B · Les jeux restants

**35 à écrire.** Cette liste est une intention, pas un contrat : un jeu peut être
remplacé par un équivalent de même famille s'il se prête mieux au tactile. Garder
les totaux par catégorie.

### Plateau — 14 restants
Échecs · Moulin (jeu du moulin) · Backgammon · Hex · Morpion ultime ·
Solitaire à billes · Dames chinoises · Serpents et échelles · Petits chevaux ·
Jeu de l'oie · Quarto · Renard et poules · Brandubh (tafl) · Amazones

### Logique — 10 restants
Nonogram (picross) · Futoshiki · Binairo · Sokoban · Labyrinthe ·
Embouteillage (Rush Hour) · Hitori · Le compte est bon · Tri de couleurs ·
Mahjong solitaire

### Dés — 6 restants
Farkle · Dés menteurs · Craps · Zanzibar · Chicago · Bataille de dés

### Papier-crayon — 5 restants
SOS · Pierre-feuille-ciseaux · Anagrammes · Mots mêlés · Boggle

---

## C · Référence de l'API des jeux

### `GameMeta` — `src/engine/types.ts`

| Champ | Type | Notes |
|---|---|---|
| `id` | `string` | Unique, kebab-case. Sert d'URL : `/game/<id>`. |
| `name` | `string` | Nom affiché. |
| `tagline` | `string` | Une phrase, sur la fiche et en tête des règles. |
| `category` | `CategoryId` | `plateau` `cartes` `logique` `arcade` `des` `papier` |
| `emoji` | `string` | Icône de la fiche. |
| `difficulty` | `1 \| 2 \| 3` | Affiché en pastilles ●●○. |
| `players` | `'1' \| '1-2' \| '2' \| '2-4'` | Sur le même appareil. |
| `minutes` | `number` | Durée typique d'une partie. |
| `score` | `ScoreKind` | `high` `low` `time` `none` |
| `scoreUnit` | `string?` | « pts », « coups »… |
| `tags` | `string[]` | Alimentent la recherche. |
| `rules` | `string[]` | 3 à 5 phrases. Affichées au premier lancement. |

### `GameScreenProps`

```ts
interface GameScreenProps {
  meta: GameMeta;
  submitScore: (score: number) => boolean;   // true si nouveau record
  submitResult: (outcome: 'win' | 'loss' | 'draw') => void;
  best?: number;
  haptic: (kind?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => void;
}
```

### Hooks de l'hôte — `src/engine/frame.tsx`

| Hook | Rôle |
|---|---|
| `useFrameRestart(fn)` | Branche le bouton ↻ de l'en-tête sur la remise à zéro du jeu. |
| `useFrameStatus(node)` | Affiche une ligne d'état sous le titre (tour, score, chrono). |
| `StatusSlot` | Composant feuille qui rend cette ligne. Réservé à l'hôte. |

### Registre — `src/games/registry.ts`

| Export | Rôle |
|---|---|
| `GAMES` | Tous les jeux, dans l'ordre d'affichage. |
| `GAME_COUNT` | Nombre de jeux. Affiché dans l'en-tête et les réglages. |
| `getGame(id)` | Recherche par identifiant. |
| `gamesInCategory(cat)` | Filtre par catégorie. |
| `countByCategory()` | Compteurs des pastilles de filtre. |
| `searchGames(q)` | Recherche insensible aux accents sur nom, accroche et tags. |

### Progression — `src/engine/progress.tsx`

| Export | Rôle |
|---|---|
| `statFor(id)` | `{ plays, best?, wins, losses, draws, lastPlayed? }` |
| `submitScore(id, score, kind)` | **Identité stable obligatoire** — voir piège n° 1. |
| `submitResult(id, outcome)` | Victoires / défaites / nuls. |
| `markPlayed(id)` | Appelé par l'hôte à l'ouverture. |
| `toggleFavorite(id)` `isFavorite(id)` | Favoris. |
| `resetGame(id)` `resetEverything()` | Remises à zéro. |
| `totalPlays` `gamesTried` | Statistiques globales. |

Tout est persisté sous la clé `plateau:v1:progress` d'AsyncStorage. Les réglages
vivent sous `plateau:v1:settings`.

---

## D · Jetons de design

`src/theme/tokens.ts`. **Ne jamais écrire une couleur en dur ailleurs.**

### Palette

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `bg` | `#F4F4F7` | `#0B0B11` | Fond d'écran |
| `bgElevated` | `#FFFFFF` | `#13131B` | Feuilles modales |
| `surface` | `#FFFFFF` | `#16161F` | Cartes |
| `surfaceAlt` | `#ECECF2` | `#1F1F2A` | Plateaux, champs |
| `surfacePressed` | `#E2E2EA` | `#282835` | État pressé |
| `border` / `borderStrong` | `#E3E3EB` / `#C9C9D6` | `#282833` / `#3A3A4A` | Bordures |
| `text` / `textDim` / `textFaint` | `#111119` / `#61616F` / `#9494A4` | `#F2F2F7` / `#A2A2B4` / `#6D6D82` | Trois niveaux de texte |
| `accent` / `accentSoft` / `onAccent` | `#5A56D6` / `#E8E7FB` / `#FFFFFF` | `#8B7DFF` / `#241F45` / `#0B0B11` | Couleur principale |
| `success` / `danger` / `warning` / `gold` | `#118A5C` / `#C93544` / `#B76E12` / `#C8901A` | `#3DD39A` / `#FF6B78` / `#E8A33D` / `#E3B341` | États |
| `boardLight` / `boardDark` / `boardEdge` | damier | | Plateaux de jeu |
| `felt` | `#1F7A52` | `#15503A` | Tapis de cartes |

### Couleurs de catégorie

| Catégorie | Couleur | Emoji |
|---|---|---|
| Plateau | `#5B8DEF` | ♟️ |
| Cartes | `#E0525F` | 🃏 |
| Logique | `#34B37E` | 🧩 |
| Arcade | `#F0A030` | 🕹️ |
| Dés | `#A96CF0` | 🎲 |
| Papier-crayon | `#4BC4D6` | ✏️ |

Un jeu utilise la couleur de sa catégorie comme `accent` de ses contrôles et de
son écran de fin.

### Échelles

- **Espacement** : `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `xxl` 32 · `xxxl` 48
- **Rayons** : `sm` 8 · `md` 12 · `lg` 18 · `xl` 26 · `pill` 999
- **Typographie** : `h1` 32/800 · `h2` 24/700 · `h3` 19/700 · `body` 16/500 · `label` 14/600 · `caption` 12/600 · `mono` chiffres tabulaires
- **Durées** : `instant` 90 · `fast` 160 · `base` 240 · `slow` 380 ms

---

## E · Bibliothèques partagées

### `src/games/lib/rng.ts`

```ts
randInt(max)                  // entier dans [0, max[
randBetween(min, maxInclus)
pick(tableau)                 // un élément au hasard
shuffle(tableau)              // Fisher-Yates, sur une copie
seeded(graine)                // générateur déterministe (puzzles du jour)
range(n) · clamp(v, min, max)
```

### `src/games/lib/hooks.ts`

```ts
useInterval(fn, delaiOuNull)  // null met en pause
useRafLoop(fn, actif)         // boucle requestAnimationFrame, delta en ms
useTimer(actif, cleDeReset)   // chronomètre en secondes
formatClock(secondes)         // « 2:07 »
useBoardSize(marge, ratioMax) // côté d'un plateau carré qui tient à l'écran
useUndoable(valeurInitiale)   // état avec pile d'annulation
```

### `src/games/lib/cartes.ts`

```ts
jeu52() · jeu32() · sabot(n)  // paquets
melanger(cartes)
etiquette(rang)               // 'A' 'V' 'D' 'R' ou le chiffre
nomCarte(carte)               // « dame de cœur », pour l'accessibilité
totalBlackjack(main)          // { total, souple } — as comptés 11 puis 1
rangsAdjacentsCirculaires(a, b) // l'as relie le roi et le deux
SYMBOLE · NOM_COULEUR · COULEURS
```

Une `Carte` est `{ id, couleur, rang, rouge, visible }`. `couleur` vaut `'P'`
pique, `'C'` cœur, `'K'` carreau, `'T'` trèfle. `rang` va de 1 (as) à 13 (roi).

### `src/ui/De.tsx`

Un dé à six faces dessiné avec de vrais points. `valeur`, `taille`, `garde`
(mis de côté), `eteint` (grisé), `onPress`. Utilisé par tous les jeux de dés.

### `src/games/lib/mots.ts`

`MOTS_COURANTS` (mots français avec indice, pour le pendu et les anagrammes),
`MOTS_CINQ` (mots de cinq lettres pour Motus), `ALPHABET`, `normaliser(mot)`.

---

## F · Journal des décisions et des correctifs

### Décisions d'architecture

**Registre statique plutôt que chargement paresseux.** Metro n'applique pas de
découpage de code sur mobile : un `import()` dynamique ne gagnerait rien et
compliquerait le typage. Cent imports statiques dans un seul fichier restent
lisibles et les `inline requires` de Metro assurent la paresse à l'exécution.

**État de boucle dans des refs pour l'arcade.** Les jeux à 60 images par seconde
tiennent leur état dans des `useRef` et ne poussent vers React que ce qui doit
s'afficher. Passer par `useState` à chaque image provoque des rendus en cascade
et des effets de bord dans les updaters.

**La ligne d'état vit hors de l'arbre React.** Voir le piège n° 2 : c'est la
seule façon qu'un jeu publie son score dans l'en-tête sans se re-rendre lui-même.

**Pas de bibliothèque de composants tierce.** Le jeu de composants tient en huit
fichiers et évite une dépendance qui vieillirait mal sur six versions d'Expo.

### Correctifs notables

| Symptôme | Cause réelle | Correctif |
|---|---|---|
| *Maximum update depth exceeded* au Blackjack | `submitScore` dépendait de `state.stats`, donc changeait d'identité à chaque enregistrement ; les effets qui l'avaient en dépendance se rappelaient sans fin | Lecture de l'état via une ref dans `progress.tsx`, fonction stable à vie |
| Même erreur au Morpion | L'en-tête s'abonnait à la ligne d'état **et** englobait le jeu | `StatusSlot`, composant feuille abonné seul |
| *GO_BACK was not handled* | `router.back()` sur une pile d'un seul écran ; `canGoBack()` consulte l'historique du navigateur sur le web | `useRetour()` → `router.dismissTo('/')` |
| Piques et trèfles invisibles en thème sombre | La teinte de la carte suivait le thème alors que son fond est toujours clair | Teinte fixe dans `ui/Carte.tsx` |
| Envol injouable | La vitesse de chute n'était pas plafonnée : l'oiseau accélérait sans limite | Plafond `chute` par niveau, gravité réduite |
| Tours de Hanoï à l'envers | En colonne, le premier enfant s'affiche en haut, or `tour[0]` est le disque du bas | Rendu de la pile inversée |
| Briques impossible à piloter | Zones tactiles invisibles découpant le plateau en trois | Vrais boutons + clavier sur le web |
| Vies, points et chronos consommés pendant la lecture des règles | Les boucles tournaient derrière la feuille de règles : Astéroïdes perdait une vie, le Labyrinthe avalait 70 points, le Démineur lançait son chrono | Pause portée par le frame, consultée automatiquement par `useInterval` et `useRafLoop` |

### Équilibrage

Les jeux d'arcade ont tous été ralentis après essai : les valeurs d'origine
étaient calibrées « à l'œil » et se sont révélées injouables. Règle retenue :
**un jeu d'arcade doit être terminable par un débutant au niveau le plus bas.**
Chacun expose trois niveaux via `Segmented`.

---

## G · Points ouverts

| Sujet | État |
|---|---|
| **Sons** | Le réglage existe et est persisté, aucun effet sonore n'est encore produit. Il faut des fichiers audio et un lecteur (`expo-audio`). |
| **Icône et écran de lancement** | Ceux du modèle Expo. À remplacer avant publication. |
| **67 jeux** | Voir section B. |
| **Traduction** | L'interface est en français uniquement. Aucune infrastructure i18n : les chaînes sont dans les composants. |
| **Tests** | Aucun test automatisé. La vérification se fait en jouant, via `npm run web`. |
| **Publication** | Aucun build EAS n'a encore été lancé. Voir le README. |
