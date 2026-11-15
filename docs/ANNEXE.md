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
- [H. Ce que les tests couvrent](#h--ce-que-les-tests-couvrent)

---

## A · Catalogue des jeux livrés

**100 jeux sur 100 — le catalogue est complet.** Colonne « Score » : mode de comparaison des records —
`high` le plus grand gagne, `low` et `time` le plus petit gagne, `none` pas de
record chiffré (on suit victoires/défaites).

### Plateau — 20 sur 20 ✅

| id | Nom | Joueurs | Score | Fichier |
|---|---|---|---|---|
| `echecs` | Échecs | 1-2 | none | `plateau/echecs.tsx` + `lib/echecs.ts` |
| `backgammon` | Backgammon | 1-2 | none | `plateau/backgammon.tsx` + `lib/backgammon.ts` |
| `morpion` | Morpion | 1-2 | none | `plateau/morpion.tsx` |
| `puissance4` | Puissance 4 | 1-2 | none | `plateau/puissance4.tsx` |
| `othello` | Othello | 1-2 | none | `plateau/othello.tsx` |
| `dames` | Dames | 1-2 | none | `plateau/dames.tsx` |
| `gomoku` | Cinq en ligne | 1-2 | none | `plateau/gomoku.tsx` |
| `awale` | Awalé | 1-2 | none | `plateau/awale.tsx` |
| `moulin` | Moulin | 1-2 | none | `plateau/moulin.tsx` |
| `hex` | Hex | 1-2 | none | `plateau/hex.tsx` |
| `morpion-ultime` | Morpion ultime | 1-2 | none | `plateau/morpion-ultime.tsx` |
| `quarto` | Quarto | 1-2 | none | `plateau/quarto.tsx` |
| `amazones` | Amazones | 1-2 | none | `plateau/amazones.tsx` |
| `brandubh` | Brandubh | 1-2 | none | `plateau/brandubh.tsx` |
| `renard-poules` | Renard et poules | 1-2 | none | `plateau/renard-poules.tsx` |
| `solitaire-billes` | Solitaire à billes | 1 | low | `plateau/solitaire-billes.tsx` |
| `dames-chinoises` | Dames chinoises | 1-2 | none | `plateau/dames-chinoises.tsx` |
| `serpents-echelles` | Serpents et échelles | 2-4 | none | `plateau/serpents-echelles.tsx` |
| `petits-chevaux` | Petits chevaux | 2-4 | none | `plateau/petits-chevaux.tsx` |
| `jeu-oie` | Jeu de l'oie | 2-4 | none | `plateau/jeu-oie.tsx` |

Tous les jeux à adversaire ont trois niveaux d'IA et un mode Duo sur le même
appareil. Les jeux asymétriques (`renard-poules`, `brandubh`) laissent en plus
choisir son camp ; les jeux de parcours (`serpents-echelles`, `petits-chevaux`,
`jeu-oie`) se jouent de deux à quatre, contre l'ordinateur ou entre humains.

**IA employées.** Minimax complet (morpion) · alpha-beta profondeur 5
(Puissance 4, dames) · alpha-beta avec table de poids positionnels (Othello) ·
évaluation de menaces par fenêtre glissante (Cinq en ligne) · alpha-beta
profondeur 6 sur les greniers (Awalé) · alpha-beta sur matériel, moulins,
menaces et mobilité, le retrait d'un pion comptant pour un demi-coup (Moulin) ·
alpha-beta sur les grilles gagnées et les doubles menaces, profondeur réduite
quand les coups légaux sont trop nombreux (Morpion ultime) · **Monte-Carlo** :
quelques dizaines de parties aléatoires jouées jusqu'au bout depuis chaque case
candidate, précédées d'un test de gain et de blocage immédiats (Hex) ·
résolution exacte quand il reste peu de pièces, sinon minimisation du nombre de
pièces devenues gagnantes (Quarto) · alpha-beta avec tri des coups agressifs et
budget de nœuds (Brandubh) · alpha-beta profondeur 5 sur une note vue du renard
(Renard et poules) · **évaluation de territoire** par distances de dame
multi-sources, choix en deux temps déplacement puis flèche (Amazones) ·
avancement pondéré par le pion le plus en retard, avec riposte adverse en mode
expert (Dames chinoises) · priorités rentrer / manger / sortir / avancer
(Petits chevaux).

**Les deux moteurs séparés.** Les échecs et le backgammon sont les seuls jeux
dont les règles vivent hors du composant, dans `src/games/lib/echecs.ts` et
`src/games/lib/backgammon.ts`. Ils n'importent rien de React et sont testables
en ligne de commande — c'est justement pourquoi ils le sont (voir section H).

- **Échecs** — règles complètes : roque des deux côtés avec contrôle des cases
  traversées, prise en passant, promotion et sous-promotion, échec et mat, pat,
  matériel insuffisant, règle des cinquante coups. Recherche negamax
  alpha-beta avec tri des coups (promotions, puis prises de la plus grosse
  pièce par la plus petite), **recherche de quiescence** sur les prises pour ne
  jamais s'arrêter au milieu d'un échange, tables de position par pièce et
  table de roi distincte en finale. Profondeur 2, 3 ou 4 selon le niveau, avec
  un plafond de nœuds. La notation française abrégée du journal de partie est
  produite par le moteur.
- **Backgammon** — barre, rentrée, sortie au compte exact ou par-dessus, frappe,
  doubles joués quatre fois. Les deux règles dures sont appliquées : **user le
  plus de dés possible**, et si un seul est jouable, ce doit être le plus grand.
  Le moteur énumère toutes les suites maximales, dédoublonnées par position
  d'arrivée ; l'interface n'autorise qu'un coup qui reste sur l'une d'elles, ce
  qui rend toute illégalité impossible par construction. L'évaluation mêle
  parcours, cases tenues, mur de blocage et **risque réel des pions seuls**,
  tiré de la table des 36 lancers. En expert, chaque suite finaliste est
  repassée au crible des 21 lancers distincts de l'adversaire, pondérés : une
  espérance, pas un minimax — le hasard des dés rend l'arbre classique sans
  objet.

**Générateurs et plateaux.** Le circuit des petits chevaux (52 cases), l'étoile
des dames chinoises (121 trous) et le maillage du moulin (24 intersections,
16 alignements) sont construits par programme à partir de tables de
coordonnées, pas saisis case par case. Le solitaire à billes dérive ses deux
formes — croix anglaise de 33 trous, européenne de 37 — de la même règle
géométrique.

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

### Logique — 20 sur 20 ✅

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
| `nonogram` | Nonogram | 1 | time | `logique/nonogram.tsx` |
| `binairo` | Binairo | 1 | time | `logique/binairo.tsx` |
| `futoshiki` | Futoshiki | 1 | time | `logique/futoshiki.tsx` |
| `hitori` | Hitori | 1 | time | `logique/hitori.tsx` |
| `sokoban` | Sokoban | 1 | low — poussées | `logique/sokoban.tsx` |
| `embouteillage` | Embouteillage | 1 | low — coups | `logique/embouteillage.tsx` |
| `labyrinthe` | Labyrinthe | 1 | low — coups | `logique/labyrinthe.tsx` |
| `mahjong` | Mahjong solitaire | 1 | time | `logique/mahjong.tsx` |
| `tri-couleurs` | Tri de couleurs | 1 | low — coups | `logique/tri-couleurs.tsx` |
| `compte-est-bon` | Le compte est bon | 1 | low — écart | `logique/compte-est-bon.tsx` |

**Aucune grille impossible n'est jamais proposée.** Chaque générateur le
garantit, mais par un moyen différent :

| Jeu | Garantie |
|---|---|
| Sudoku, Binairo, Futoshiki | Grille complète par retour arrière, puis retrait de cases tant que la solution reste **unique** |
| Taquin | Mélange par coups légaux depuis la position résolue |
| Tout éteindre | Mélange depuis une grille éteinte |
| Labyrinthe | Creusage en profondeur : labyrinthe « parfait », un seul chemin entre deux cases |
| Hitori | Construit depuis sa solution : carré latin, puis cases noircies non adjacentes à complément connexe, puis doublons introduits |
| Tri de couleurs | Distribution aléatoire **vérifiée par un solveur** en profondeur, plafonné à 40 000 nœuds |
| Mahjong | Distribution par simulation de résolution : on retire deux places libres et on leur attribue la même tuile |
| Nonogram | La victoire compare les indices, pas le motif : une grille à plusieurs solutions reste gagnable |
| Sokoban, Embouteillage | Niveaux écrits à la main, six chacun |

Le compte est bon embarque un solveur exhaustif sur les paires, qui sert à
afficher la meilleure approche possible quand le joueur abandonne.

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

### Dés — 10 sur 10 ✅

| id | Nom | Joueurs | Score | Fichier |
|---|---|---|---|---|
| `yams` | Yams | 1 | high — pts | `des/yams.tsx` |
| `cochon` | Cochon | 1-2 | none | `des/cochon.tsx` |
| `421` | 421 | 1 | low — jetons | `des/quatre-cent-vingt-et-un.tsx` |
| `fermer-la-boite` | Fermer la boîte | 1 | low — pts restants | `des/fermer-la-boite.tsx` |
| `farkle` | Farkle | 1 | none | `des/farkle.tsx` |
| `des-menteurs` | Dés menteurs | 1 | none | `des/des-menteurs.tsx` |
| `craps` | Craps | 1 | high — jetons | `des/craps.tsx` |
| `zanzibar` | Zanzibar | 1 | none | `des/zanzibar.tsx` |
| `chicago` | Chicago | 1-2 | high — pts | `des/chicago.tsx` |
| `bataille-des` | Bataille de dés | 1 | high — victoires | `des/bataille-des.tsx` |

Tous utilisent le composant `De`, un dé à six faces dessiné avec de vrais
points. Les fonctions de décompte sont exportées et testables isolément :
`evaluerLancer` (Farkle), `evaluerZanzibar`, `valeurFigure` (Yams).

### Papier-crayon — 10 sur 10 ✅

| id | Nom | Joueurs | Score | Fichier |
|---|---|---|---|---|
| `pendu` | Le pendu | 1 | high — série | `papier/pendu.tsx` |
| `allumettes` | Allumettes (Nim) | 1-2 | none | `papier/allumettes.tsx` |
| `points-et-carres` | Points et carrés | 1-2 | none | `papier/points-et-carres.tsx` |
| `motus` | Motus | 1 | low — essais | `papier/motus.tsx` |
| `bataille-navale` | Bataille navale | 1 | low — tirs | `papier/bataille-navale.tsx` |
| `sos` | SOS | 1-2 | none | `papier/sos.tsx` |
| `pierre-feuille-ciseaux` | Pierre-feuille-ciseaux | 1 | high — manches | `papier/pierre-feuille-ciseaux.tsx` |
| `anagrammes` | Anagrammes | 1 | high — mots | `papier/anagrammes.tsx` |
| `mots-meles` | Mots mêlés | 1 | time | `papier/mots-meles.tsx` |
| `boggle` | Boggle | 1 | high — pts | `papier/boggle.tsx` |

Les jeux de lettres partagent `MOTS_JEU` (environ 270 mots français, en
majuscules sans accent) et `DICTIONNAIRE`, l'ensemble correspondant pour les
recherches rapides. Boggle ne se contente pas de lettres aléatoires : il trace
d'abord cinq mots réels le long de chemins de cases voisines, puis comble avec
des lettres fréquentes en français, et recense enfin tous les mots traçables
pour situer le score du joueur. Pierre-feuille-ciseaux construit une table de
transition — après tel coup, le joueur a joué tel autre — et contre la
prédiction sept fois sur neuf, en gardant une part de hasard pour ne pas
devenir lisible à son tour.

---

## B · Les jeux restants

**Aucun.** Les cent jeux sont livrés, et chaque catégorie atteint son total :
20 plateau, 20 cartes, 20 logique, 20 arcade, 10 dés, 10 papier-crayon.

Ce qui reste à faire ne concerne plus le catalogue mais la finition : voir la
section G, et le [guide de publication](PUBLICATION.md) pour la mise sur les
magasins.

Si un jeu devait s'ajouter un jour, ce serait en remplacement d'un autre de la
même catégorie, pour garder l'équilibre décidé avec l'utilisateur.

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
| Mahjong bloqué dès le départ | Symboles semés au hasard sur la disposition : une seule paire jouable, table souvent insoluble | Distribution par simulation de résolution — quatre à six paires jouables au départ, solution garantie |
| Vies, points et chronos consommés pendant la lecture des règles | Les boucles tournaient derrière la feuille de règles : Astéroïdes perdait une vie, le Labyrinthe avalait 70 points, le Démineur lançait son chrono | Pause portée par le frame, consultée automatiquement par `useInterval` et `useRafLoop` |

| Moulin : le retrait d’un pion ne répondait pas | Le pion visé appartenait à un moulin adverse, donc protégé par la règle | Aucun — comportement correct, confirmé en jeu : seuls les pions hors moulin portent le liseré rouge |
| Backgammon : des touchers perdus sur les flèches | `Fleche` était déclaré dans le corps du composant : React y voyait un type neuf à chaque rendu et remontait les vingt-quatre flèches, détachant les nœuds entre deux appuis | Simple fonction `rendreFleche(i)` au lieu d'un composant. Trois autres jeux avaient le même défaut : Awalé, Bataille de dés, Bataille navale. Devenu le piège n° 7, et détecté par `npm run audit` |
| Araignée : vibration jouée deux fois | `haptic('success')` était appelé **dans** l'updater de `setEtat`, que React peut rejouer | Calcul sorti de l'updater — c'est le piège n° 3 |
| Compilation refusée par `expo-doctor` | `newArchEnabled` a disparu du schéma au SDK 55, `android.edgeToEdgeEnabled` au SDK 56, et `splash` est devenu un plugin | Champs retirés, `expo-splash-screen` installé et configuré avec ses variantes claire et sombre |
| `npm run verifier` passait malgré des anomalies | `outils/audit.mjs` affichait les problèmes mais sortait toujours en code 0 : la chaîne continuait | `process.exit(1)` sur anomalie. Les **cinq** contrôles ont ensuite été éprouvés un par un sur un défaut injecté volontairement |
| 2048 injouable au navigateur | Piloté au balayage seul : aucun bouton, aucun clavier, aucune cible pour un lecteur d'écran | Clavier et croix directionnelle, comme au Snake. Bulles et Casse-briques avaient le même défaut |
| Sélecteurs muets pour un lecteur d'écran | `Segmented` n'avait pas d'`accessibilityLabel` — et il est présent dans presque tous les jeux | Étiquette ajoutée dans le composant : une correction, ~90 jeux |
| Cibles tactiles trop petites | `Segmented` faisait 32 px de haut, `Button size="sm"` 36 px, sous les 44 points recommandés par Apple | Minimum porté à 44 dans les deux composants partagés |
| `'OS'` dans le dictionnaire | Deux lettres, alors que le Boggle en exige trois : le mot était inatteignable | Retiré. Le test des règles vérifie désormais l'invariant |
| L'application aurait planté hors Expo Go | `expo-audio`, ajouté pour les sons, réclame `expo-asset` en dépendance de pair — absente | `expo-asset` installé. Trouvé par `expo-doctor`, pas en jouant : un build réel aurait planté au premier son |
| Thème automatique incomplet sur Android | `userInterfaceStyle: "automatic"` exige `expo-system-ui`, signalé seulement au `prebuild` | `expo-system-ui` installé |

### Équilibrage

Les jeux d'arcade ont tous été ralentis après essai : les valeurs d'origine
étaient calibrées « à l'œil » et se sont révélées injouables. Règle retenue :
**un jeu d'arcade doit être terminable par un débutant au niveau le plus bas.**
Chacun expose trois niveaux via `Segmented`.

---

## G · Points ouverts

| Sujet | État |
|---|---|
| **Catalogue** | Terminé. 100 jeux sur 100. |
| **Icône et écran de lancement** | Faits, générés par `npm run assets:icones` — encodeur PNG compris, aucune dépendance. |
| **Sons** | Faits. Six effets synthétisés par `npm run assets:sons`, branchés sur le même événement que les vibrations et pilotés par le réglage. Aucun fichier tiers, donc aucune question de licence. |
| **Contrôles automatiques** | `npm run verifier` : types, audit des 100 fichiers, 74 contrôles de règles partagées, 147 d’échecs, 274 de backgammon. La chaîne **échoue** réellement sur anomalie — éprouvé sur défaut injecté. |
| **Intégration continue** | `.github/workflows/verifier.yml` : les mêmes contrôles, plus `expo-doctor` et la construction des bundles. Aucun secret. |
| **Tests d’interface** | Toujours aucun test automatisé d’interface dans le dépôt. Les 100 jeux sont validés par une sonde de navigateur décrite dans [VALIDATION_100_JEUX.md](VALIDATION_100_JEUX.md), rejouée à la main. |
| **Parties complètes** | Aucune partie n’est jouée de bout en bout automatiquement. Les fins de partie ont été vérifiées à la main sur un échantillon. |
| **Confidentialité** | Politique rédigée sur un relevé vérifié du code, page prête à héberger, résumé consultable dans l’application. **L’adresse web reste à créer.** |
| **Licence** | Le titulaire est désormais un nom. L’orthographe exacte reste à confirmer par l’utilisateur. |
| **Captures pour les magasins** | Aucune. À produire depuis un build réel, jamais depuis une maquette. |
| **Traduction** | Français uniquement. Aucune infrastructure i18n : les chaînes sont dans les composants. |
| **Publication** | Configuration validée (`expo-doctor` 21/21, bundles iOS et Android produits localement), mais **aucune compilation EAS lancée** : comptes Expo, Apple et Google requis. Voir [PUBLICATION.md](PUBLICATION.md). |

---

## H · Ce que les tests couvrent

`npm run verifier` enchaîne quatre contrôles. Ils ne remplacent pas le fait de
jouer, mais ils attrapent ce que l'œil ne voit pas.

| Contrôle | Méthode | Ce qu'il a déjà trouvé |
|---|---|---|
| `typecheck` | TypeScript strict | — |
| `audit` | Relecture des 100 fichiers de jeu | L'effet de bord d'Araignée, les quatre composants imbriqués |
| `test:echecs` | **Perft** : dénombrement des positions à profondeur fixe, comparé aux valeurs publiées sur cinq positions — position initiale (197 281 à la profondeur 4), Kiwipete, une position à prise en passant, une position à promotions, une position piégeuse | — |
| `test:backgammon` | 400 parties aléatoires menées jusqu'au bout, avec vérification des invariants à chaque tour : quinze pions par camp, suites toutes de longueur maximale, aucune flèche surchargée, IA ne proposant jamais un coup hors de la liste légale | — |

Le perft est la seule preuve sérieuse qu'un moteur d'échecs respecte les règles :
un écart d'une seule position trahit un roque à travers l'échec, un clouage
ignoré ou une prise en passant mal gérée. Les cinq positions retenues sont
choisies pour couvrir exactement ces cas.

La sonde d'exécution — ouvrir les 100 jeux dans le navigateur et relire la
console — n'est pas scriptée dans le dépôt. Elle se fait avec `npm run web`.
