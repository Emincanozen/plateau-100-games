# Matrice de validation des 100 jeux

> **Généré par `node outils/matrice.mjs`.** Ne pas modifier à la main :
> les colonnes viennent des fichiers source et de la sonde de navigateur.

Dernière exécution : 2026-09-20.

## Ce que chaque colonne prouve — et ce qu’elle ne prouve pas

| Colonne | Méthode | Portée |
|---|---|---|
| **Chargement** | Navigation vers `/game/<id>`, en-tête présent, écran non vide | Automatisée, navigateur |
| **Gel** | La feuille de règles ouverte, aucune pixel ni compteur ne bouge pendant 900 ms | Automatisée, navigateur |
| **Réaction** | Jusqu’à quarante-cinq commandes touchées, les commandes explicites d’abord, puis le clavier, puis l’attente d’une boucle ; on compare étiquettes, texte, couleurs, bordures **et positions** | Automatisée, navigateur |
| **Relance** | Le bouton ↻ est actionné, le jeu doit se reconstruire avec ses commandes | Automatisée, navigateur |
| **Console** | Toute erreur console, `window.onerror` et rejet de promesse est capturée | Automatisée, navigateur |
| **Règles** | Nombre de phrases de règles, conformité au contrat (3 à 5) | Automatisée, statique |
| **Moteur** | Bibliothèque partagée dont le jeu dépend, et qui a ses propres tests | Statique |
| **Publicité** | Aucun fichier de jeu ne contient de bannière, d’interstitiel ni d’import du SDK ; l’écran de jeu verrouille la régie tant qu’il est monté | Automatisée, `npm run test:pub` |

**Ce que la matrice ne prouve pas.** Une partie complète jouée jusqu’à la
victoire, l’exactitude des règles propres à chaque jeu, le rendu sur un
vrai téléphone, le comportement réel du SDK publicitaire. Ces points sont listés dans
[RAPPORT_FINAL_VALIDATION.md](RAPPORT_FINAL_VALIDATION.md), section « Risques restants ».

## Plateau — 20 jeux

| Jeu | Fichier | Score | Joueurs | Diff. | Règles | Niveaux | Duo | Clavier | Annuler | Moteur | Cmd. | Gel | Réagit | Relance | Console | État |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Amazones** | `plateau/amazones.tsx` | none | 1-2 | ●●● | 4 | ✅ | ✅ | — | ✅ | — | 47 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Awalé** | `plateau/awale.tsx` | none | 1-2 | ●●● | 4 | ✅ | ✅ | — | — | — | 21 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Backgammon** | `plateau/backgammon.tsx` | none | 1-2 | ●●● | 5 | ✅ | ✅ | — | ✅ | `lib/backgammon.ts` | 37 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Brandubh** | `plateau/brandubh.tsx` | none | 1-2 | ●●● | 5 | ✅ | ✅ | — | — | — | 60 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Cinq en ligne** | `plateau/gomoku.tsx` | none | 1-2 | ●● | 4 | ✅ | ✅ | — | — | — | 178 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Dames** | `plateau/dames.tsx` | none | 1-2 | ●●● | 4 | ✅ | ✅ | — | — | — | 73 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Dames chinoises** | `plateau/dames-chinoises.tsx` | none | 1-2 | ●● | 5 | ✅ | ✅ | — | — | — | 130 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Échecs** | `plateau/echecs.tsx` | none | 1-2 | ●●● | 4 | ✅ | ✅ | — | — | `lib/echecs.ts` | 75 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Hex** | `plateau/hex.tsx` | none | 1-2 | ●●● | 4 | ✅ | ✅ | — | — | — | 93 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Jeu de l’oie** | `plateau/jeu-oie.tsx` | none | 2-4 | ● | 4 | — | — | — | — | — | 11 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Morpion** | `plateau/morpion.tsx` | none | 1-2 | ● | 4 | ✅ | ✅ | — | — | — | 18 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Morpion ultime** | `plateau/morpion-ultime.tsx` | none | 1-2 | ●●● | 4 | ✅ | ✅ | — | — | — | 90 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Moulin** | `plateau/moulin.tsx` | none | 1-2 | ●●● | 5 | ✅ | ✅ | — | — | — | 33 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Othello** | `plateau/othello.tsx` | none | 1-2 | ●●● | 4 | ✅ | ✅ | — | — | — | 73 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Petits chevaux** | `plateau/petits-chevaux.tsx` | none | 2-4 | ● | 4 | — | — | — | — | — | 17 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Puissance 4** | `plateau/puissance4.tsx` | none | 1-2 | ●● | 4 | ✅ | ✅ | — | — | — | 16 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Quarto** | `plateau/quarto.tsx` | none | 1-2 | ●●● | 4 | ✅ | ✅ | — | — | — | 41 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Renard et poules** | `plateau/renard-poules.tsx` | none | 1-2 | ●● | 4 | ✅ | ✅ | — | — | — | 44 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Serpents et échelles** | `plateau/serpents-echelles.tsx` | none | 2-4 | ● | 4 | — | — | — | — | — | 11 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Solitaire à billes** | `plateau/solitaire-billes.tsx` | low billes | 1 | ●●● | 4 | — | — | — | ✅ | — | 42 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |

## Cartes — 20 jeux

| Jeu | Fichier | Score | Joueurs | Diff. | Règles | Niveaux | Duo | Clavier | Annuler | Moteur | Cmd. | Gel | Réagit | Relance | Console | État |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Accordéon** | `cartes/accordeon.tsx` | low tas | 1 | ●●● | 4 | — | — | — | — | `lib/cartes.ts` | 57 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Araignée** | `cartes/araignee.tsx` | low coups | 1 | ●●● | 4 | — | — | — | — | `lib/cartes.ts` | 63 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Bataille** | `cartes/bataille.tsx` | none | 1 | ● | 4 | — | — | — | — | `lib/cartes.ts` | 6 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Blackjack** | `cartes/blackjack.tsx` | high jetons | 1 | ● | 4 | — | — | — | — | `lib/cartes.ts` | 10 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Canfield** | `cartes/canfield.tsx` | high cartes rangées | 1 | ●●● | 4 | — | — | — | — | `lib/cartes.ts` | 15 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **FreeCell** | `cartes/freecell.tsx` | low coups | 1 | ●●● | 4 | — | — | — | — | `lib/cartes.ts` | 65 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Golf** | `cartes/golf.tsx` | low cartes restantes | 1 | ●● | 4 | — | — | — | — | `lib/cartes.ts` | 41 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Huit américain** | `cartes/huit-americain.tsx` | none | 1 | ● | 4 | — | — | — | — | `lib/cartes.ts` | 13 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Le menteur** | `cartes/menteur.tsx` | none | 1 | ●● | 4 | — | — | — | — | `lib/cartes.ts` | 32 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Le pouilleux** | `cartes/pouilleux.tsx` | none | 1 | ● | 4 | — | — | — | — | `lib/cartes.ts` | 16 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Les quarante voleurs** | `cartes/quarante-voleurs.tsx` | low coups | 1 | ●●● | 4 | — | — | — | — | `lib/cartes.ts` | 54 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Les trois pics** | `cartes/tri-peaks.tsx` | high pts | 1 | ●● | 4 | — | — | — | — | `lib/cartes.ts` | 34 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Président** | `cartes/president.tsx` | low place | 1 | ●● | 4 | — | — | — | — | `lib/cartes.ts` | 20 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Pyramide** | `cartes/pyramide.tsx` | high cartes | 1 | ●● | 4 | — | — | — | — | `lib/cartes.ts` | 34 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Rami** | `cartes/rami.tsx` | low points | 1 | ●●● | 4 | — | — | — | — | `lib/cartes.ts` | 19 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Scopa** | `cartes/scopa.tsx` | none | 1 | ●● | 4 | — | — | — | — | `lib/cartes.ts` | 8 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Solitaire** | `cartes/solitaire.tsx` | low coups | 1 | ●● | 4 | — | — | — | — | `lib/cartes.ts` | 38 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Trente-et-un** | `cartes/trente-et-un.tsx` | none | 1 | ●● | 4 | — | — | — | — | `lib/cartes.ts` | 14 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Vidéo poker** | `cartes/video-poker.tsx` | high jetons | 1 | ●● | 4 | — | — | — | — | `lib/cartes.ts` | 6 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Yukon** | `cartes/yukon.tsx` | low coups | 1 | ●●● | 4 | — | — | — | — | `lib/cartes.ts` | 61 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |

## Logique — 20 jeux

| Jeu | Fichier | Score | Joueurs | Diff. | Règles | Niveaux | Duo | Clavier | Annuler | Moteur | Cmd. | Gel | Réagit | Relance | Console | État |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **2048** | `logique/jeu2048.tsx` | high pts | 1 | ●● | 4 | — | — | ✅ | — | — | 9 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Binairo** | `logique/binairo.tsx` | time s | 1 | ●●● | 4 | — | — | — | — | — | 44 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Démineur** | `logique/demineur.tsx` | time s | 1 | ●● | 4 | ✅ | — | — | — | — | 88 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Embouteillage** | `logique/embouteillage.tsx` | low coups | 1 | ●●● | 4 | — | — | — | — | — | 42 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Futoshiki** | `logique/futoshiki.tsx` | time s | 1 | ●●● | 4 | — | — | — | — | — | 29 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Hitori** | `logique/hitori.tsx` | time s | 1 | ●●● | 4 | — | — | — | — | — | 33 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Inondation** | `logique/flood.tsx` | low coups | 1 | ●● | 4 | — | — | — | — | — | 14 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Labyrinthe** | `logique/labyrinthe.tsx` | low coups | 1 | ●● | 4 | — | — | ✅ | — | — | 14 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Le compte est bon** | `logique/compte-est-bon.tsx` | low écart | 1 | ●●● | 4 | — | — | — | — | — | 17 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Mahjong solitaire** | `logique/mahjong.tsx` | time s | 1 | ●● | 4 | — | — | — | — | — | 69 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Mastermind** | `logique/mastermind.tsx` | low essais | 1 | ●● | 4 | — | — | — | — | — | 17 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Memory** | `logique/memory.tsx` | low coups | 1-2 | ● | 4 | — | ✅ | — | — | — | 30 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Nonogram** | `logique/nonogram.tsx` | time s | 1 | ●●● | 4 | — | — | — | — | — | 33 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Séquence** | `logique/simon.tsx` | high niveau | 1 | ● | 4 | — | — | — | — | — | 15 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Sokoban** | `logique/sokoban.tsx` | low poussées | 1 | ●●● | 4 | — | — | ✅ | ✅ | — | 11 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Sudoku** | `logique/sudoku.tsx` | time s | 1 | ●● | 4 | ✅ | — | — | — | — | 99 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Taquin** | `logique/taquin.tsx` | low coups | 1 | ●● | 4 | — | — | — | — | — | 16 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Tours de Hanoï** | `logique/hanoi.tsx` | low coups | 1 | ●● | 4 | — | — | — | — | — | 12 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Tout éteindre** | `logique/lights-out.tsx` | low coups | 1 | ●● | 4 | — | — | — | — | — | 33 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Tri de couleurs** | `logique/tri-couleurs.tsx` | low coups | 1 | ●● | 4 | — | — | — | ✅ | — | 18 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |

## Arcade — 20 jeux

| Jeu | Fichier | Score | Joueurs | Diff. | Règles | Niveaux | Duo | Clavier | Annuler | Moteur | Cmd. | Gel | Réagit | Relance | Console | État |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Astéroïdes** | `arcade/asteroides.tsx` | high pts | 1 | ●●● | 4 | — | — | ✅ | — | — | 9 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Briques** | `arcade/tetris.tsx` | high pts | 1 | ●● | 4 | — | — | ✅ | — | — | 10 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Bulles** | `arcade/bulles.tsx` | high pts | 1 | ●● | 4 | — | — | ✅ | — | — | 8 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Casse-briques** | `arcade/casse-briques.tsx` | high pts | 1 | ●● | 4 | — | — | ✅ | — | — | 8 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Chasse aux taupes** | `arcade/taupes.tsx` | high pts | 1 | ● | 4 | ✅ | — | — | — | — | 18 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Course sans fin** | `arcade/dino.tsx` | high m | 1 | ● | 4 | ✅ | — | — | — | — | 9 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Empilage** | `arcade/empilage.tsx` | high étages | 1 | ● | 4 | — | — | ✅ | — | — | 6 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Envahisseurs** | `arcade/envahisseurs.tsx` | high pts | 1 | ●● | 4 | — | — | ✅ | — | — | 8 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Envol** | `arcade/flappy.tsx` | high passages | 1 | ●● | 4 | — | — | — | — | — | 9 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Esquive** | `arcade/esquive.tsx` | high s | 1 | ● | 4 | ✅ | — | ✅ | — | — | 10 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Hélicoptère** | `arcade/helicoptere.tsx` | high m | 1 | ●● | 4 | ✅ | — | — | — | — | 9 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Labyrinthe aux fantômes** | `arcade/labyrinthe-fantomes.tsx` | high pts | 1 | ●● | 4 | — | — | ✅ | — | — | 9 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Missiles** | `arcade/missiles.tsx` | high pts | 1 | ●● | 4 | — | — | — | — | — | 6 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Pong** | `arcade/pong.tsx` | none | 1-2 | ● | 4 | ✅ | ✅ | — | — | — | 9 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Réflexes** | `arcade/reflexes.tsx` | time ms | 1 | ● | 4 | — | — | — | — | — | 8 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Saut de plateforme** | `arcade/saut-plateforme.tsx` | high m | 1 | ●● | 4 | — | — | ✅ | — | — | 7 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Snake** | `arcade/snake.tsx` | high pts | 1 | ● | 4 | ✅ | — | ✅ | — | — | 12 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Squash** | `arcade/squash.tsx` | high échanges | 1 | ●● | 4 | ✅ | — | — | — | — | 8 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Traversée** | `arcade/traversee.tsx` | high pts | 1 | ●● | 4 | — | — | ✅ | — | — | 9 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Tunnel** | `arcade/tunnel.tsx` | high m | 1 | ●● | 4 | ✅ | — | ✅ | — | — | 10 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |

## Dés — 10 jeux

| Jeu | Fichier | Score | Joueurs | Diff. | Règles | Niveaux | Duo | Clavier | Annuler | Moteur | Cmd. | Gel | Réagit | Relance | Console | État |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **421** | `des/quatre-cent-vingt-et-un.tsx` | low jetons | 1 | ●● | 4 | — | — | — | — | — | 10 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Bataille de dés** | `des/bataille-des.tsx` | high victoires | 1 | ●● | 4 | ✅ | — | — | — | — | 9 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Chicago** | `des/chicago.tsx` | high pts | 1-2 | ● | 4 | — | — | — | — | — | 6 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Cochon** | `des/cochon.tsx` | none | 1-2 | ● | 4 | — | ✅ | — | — | — | 10 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Craps** | `des/craps.tsx` | high jetons | 1 | ● | 4 | — | — | — | — | — | 12 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Dés menteurs** | `des/des-menteurs.tsx` | none | 1 | ●●● | 4 | — | — | — | — | — | 11 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Farkle** | `des/farkle.tsx` | none | 1 | ●● | 4 | — | — | — | — | — | 13 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Fermer la boîte** | `des/fermer-la-boite.tsx` | low pts restants | 1 | ●● | 4 | — | — | — | — | — | 16 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Yams** | `des/yams.tsx` | high pts | 1 | ●● | 4 | — | — | — | — | — | 24 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Zanzibar** | `des/zanzibar.tsx` | none | 1 | ●● | 4 | — | — | — | — | — | 10 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |

## Papier-crayon — 10 jeux

| Jeu | Fichier | Score | Joueurs | Diff. | Règles | Niveaux | Duo | Clavier | Annuler | Moteur | Cmd. | Gel | Réagit | Relance | Console | État |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Allumettes** | `papier/allumettes.tsx` | none | 1-2 | ●● | 4 | — | ✅ | — | — | — | 23 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Anagrammes** | `papier/anagrammes.tsx` | high mots | 1 | ●● | 4 | — | — | — | — | `lib/mots.ts` | 12 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Bataille navale** | `papier/bataille-navale.tsx` | low tirs | 1 | ●● | 4 | — | — | — | — | — | 133 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Boggle** | `papier/boggle.tsx` | high pts | 1 | ●● | 4 | — | — | — | — | `lib/mots.ts` | 23 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Le pendu** | `papier/pendu.tsx` | high série | 1 | ● | 4 | — | — | — | — | `lib/mots.ts` | 31 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Mots mêlés** | `papier/mots-meles.tsx` | time s | 1 | ● | 4 | — | — | — | — | `lib/mots.ts` | 108 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Motus** | `papier/motus.tsx` | low essais | 1 | ●● | 4 | — | — | — | — | `lib/mots.ts` | 33 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Pierre-feuille-ciseaux** | `papier/pierre-feuille-ciseaux.tsx` | high manches | 1 | ● | 4 | — | — | — | — | — | 10 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **Points et carrés** | `papier/points-et-carres.tsx` | none | 1-2 | ●● | 4 | — | ✅ | — | — | — | 51 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| **SOS** | `papier/sos.tsx` | none | 1-2 | ●● | 4 | — | ✅ | — | — | — | 38 | ✅ | ✅ | ✅ | ✅ | ✅ PASS |

---

## Bilan

| | Nombre |
|---|---|
| Jeux au catalogue | 100 |
| Chargés sans erreur de console | 100 |
| Gel des règles respecté | 100 |
| Répondent à une commande | 100 |
| Se relancent correctement | 100 |
| **PASS sur les cinq critères** | **100 / 100** |
| Trois niveaux de difficulté | 27 |
| Mode Duo | 22 |
| Pilotables au clavier | 15 |
| Avec annulation | 5 |

Aucun jeu en échec sur les critères automatisés.
