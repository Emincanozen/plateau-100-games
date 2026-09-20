# Reprise du projet Plateau

**Ce fichier sert à reprendre le projet sans rien avoir suivi.** Il dit où en
est le travail, ce qui a été décidé et pourquoi, et ce qu'il reste à faire.

Pour *travailler* sur le code, lis [AGENTS.md](AGENTS.md) — c'est le contrat,
et il se suffit à lui-même. Ce fichier-ci raconte l'état, pas l'architecture.

---

## 1. Ce qu'est le projet

Une application mobile **iOS et Android** contenant **100 jeux** : plateau,
cartes, logique, arcade, dés, papier-crayon. Un seul code source React Native,
distribué sur les deux plateformes.

Quatre décisions ont été prises avec l'utilisateur et **ne se rediscutent pas
sans lui** :

1. **Solo et multi local uniquement.** Aucun serveur, aucun compte, aucun
   réseau. Jamais de `fetch`.
2. **Tout hors ligne.** Scores et réglages dans AsyncStorage, sur l'appareil.
3. **Catalogue équilibré.** 20 plateau, 20 cartes, 20 logique, 20 arcade,
   10 dés, 10 papier.
4. **Design moderne épuré**, thème clair et sombre automatique, **interface en
   français** — y compris les noms de variables et les commentaires.

---

## 2. Où en est le projet

| | État |
|---|---|
| Catalogue | **100 / 100.** Terminé. |
| Contrôles automatiques | `npm run verifier` : types, audit des 100 fichiers, règles partagées, deux moteurs. **Passe.** |
| Validation en navigateur | Les 100 jeux : chargement, gel des règles, réaction à une commande, relance, console. **100 / 100.** |
| Configuration de compilation | `npx expo-doctor` : **21 contrôles sur 21**. Bundles iOS et Android produits localement. |
| Compilation EAS | **Jamais lancée.** Demande le compte Expo de l'utilisateur. |
| Publication | **Non faite.** Demande les comptes développeur Apple et Google. |

Statut global : **développement terminé, compilation et publication à faire.**

---

## 3. Commandes

```bash
npm install
npm run web          # itération rapide dans un navigateur
npm start            # puis « a », ou le QR code avec Expo Go
npm run verifier     # obligatoire avant toute livraison
```

| Commande | Ce qu'elle fait |
|---|---|
| `npm run verifier` | Enchaîne les quatre contrôles, **s'arrête au premier échec** |
| `npm run typecheck` | TypeScript strict |
| `npm run audit` | Contrat d'un jeu et sept pièges, sur les 100 fichiers |
| `npm run test:regles` | Cartes, mots, aléatoire |
| `npm run test:moteurs` | Échecs (perft) et backgammon (scénarios + invariants) |
| `npm run assets:icones` | Régénère les icônes |
| `npm run assets:sons` | Régénère les effets sonores |

> Sous PowerShell : `npx.cmd`, jamais `npx` — la politique d'exécution bloque
> les scripts `.ps1`.

---

## 4. Décisions techniques, et pourquoi

**Les moteurs d'échecs et de backgammon vivent hors des composants**
(`src/games/lib/echecs.ts`, `backgammon.ts`). Ils n'importent rien de React.
C'est ce qui permet de les tester en ligne de commande — et c'est le seul
moyen sérieux de prouver qu'un moteur d'échecs respecte les règles.

**Le perft est la preuve, pas l'intuition.** On compte les positions
atteignables à profondeur fixe et on compare aux valeurs publiées. Cinq
positions couvrent roque à travers l'échec, clouage, prise en passant et
sous-promotion. Un seul écart trahit une règle fausse.

**Le son suit le retour haptique.** Les cent jeux appellent `haptic(kind)` ;
c'est l'hôte (`app/game/[id].tsx`) qui déclenche vibration **et** son. Aucun
jeu ne connaît le module audio. Les six fichiers sont **synthétisés** par
`outils/sons.mjs` — donc libres de tout droit tiers.

**Les icônes aussi sont générées** (`outils/icones.mjs`), encodeur PNG compris,
sans aucune dépendance.

**L'audit statique fait échouer la chaîne.** Il ne se contente pas d'afficher :
il sort en code non nul. Sans cela `npm run verifier` passait malgré des
anomalies — c'était un vrai défaut, corrigé.

**Pas de bibliothèque de composants tierce.** Huit fichiers dans `src/ui/`
évitent une dépendance qui vieillirait mal sur six versions d'Expo.

---

## 5. Points de vigilance

Les **sept pièges connus** sont détaillés dans [AGENTS.md §7](AGENTS.md). En
résumé, chacun a déjà cassé le projet une fois :

1. `submitScore` doit garder une identité stable — sinon boucle infinie.
2. La ligne d'état ne doit pas re-rendre le jeu.
3. Jamais d'effet de bord dans un updater `setState`.
4. `router.back()` échoue sur une pile d'un seul écran → `useRetour()`.
5. Une boucle de jeu ne tourne pas pendant la lecture des règles → hooks
   partagés obligatoires.
6. Une carte à jouer a toujours un fond clair.
7. **Ne jamais déclarer un composant dans un composant** — React remonte tout
   le sous-arbre et des touchers se perdent.

Deux autres réflexes, appris en validant :

- **Une cible tactile fait au moins 44 points.** `Segmented` et `Button`
  respectent ce minimum depuis la dernière passe. Les cases de plateau sont
  l'exception assumée : on ne peut pas mettre 144 tuiles de mahjong à 44 px.
- **Un jeu piloté au geste seul est injouable au navigateur et muet pour un
  lecteur d'écran.** 2048, Bulles et Casse-briques avaient ce défaut. `npm run
  audit` le détecte désormais.

---

## 6. Comment vérifier son travail

Trois niveaux, du moins au plus coûteux :

1. **`npm run verifier`** — obligatoire, quelques minutes.
2. **La sonde de navigateur** — ouvrir les 100 jeux et mesurer. Elle n'est pas
   scriptée dans le dépôt ; la méthode et les résultats sont dans
   [docs/VALIDATION_100_JEUX.md](docs/VALIDATION_100_JEUX.md).
3. **Jouer réellement.** Un jeu n'est pas terminé tant qu'une partie complète
   n'a pas été jouée : début, coups, fin, record, bouton recommencer, mode duo.

Attention au piège rencontré pendant la validation : **un détecteur de
changement qui ignore les positions ne voit pas un jeu d'arcade bouger.** Trois
jeux ont été soupçonnés à tort avant qu'on corrige la sonde. Vérifier l'outil
avant d'accuser le code.

---

## 7. Ce qui reste à faire

### Côté code — rien de bloquant

| Sujet | État |
|---|---|
| Traduction | Français uniquement, aucune infrastructure i18n. Les chaînes sont dans les composants. |
| Tests d'interface automatisés | Aucun. La sonde de navigateur n'est pas dans le dépôt. |
| Parties complètes automatisées | Aucune. Les fins de partie sont vérifiées à la main, jeu par jeu. |

### Côté publication — demande l'utilisateur

| Étape | Pourquoi elle est bloquée |
|---|---|
| `eas login` puis `eas init` | Compte Expo |
| `eas build` | Compte Expo, puis certificats Apple et Google |
| Fiches des magasins | Nom du responsable, adresse de contact, captures d'écran |
| Politique de confidentialité en ligne | Il faut héberger `docs/store/confidentialite.html` |
| **Test fermé Google Play** | 12 testeurs pendant 14 jours consécutifs pour un compte personnel — **c'est le chemin critique** |

Tout est détaillé dans [docs/PUBLICATION.md](docs/PUBLICATION.md) et
[docs/store/README.md](docs/store/README.md).

---

## 8. Où trouver quoi

| Document | Pour |
|---|---|
| [AGENTS.md](AGENTS.md) | **Travailler sur le code.** Contrat, carte, conventions, pièges. |
| [docs/ANNEXE.md](docs/ANNEXE.md) | Catalogue des 100 jeux, API, jetons de design, journal des correctifs |
| [docs/VALIDATION_100_JEUX.md](docs/VALIDATION_100_JEUX.md) | Ce qui a été testé, jeu par jeu, et ce qui ne l'a pas été |
| [docs/RAPPORT_FINAL_VALIDATION.md](docs/RAPPORT_FINAL_VALIDATION.md) | Bilan de la campagne de finalisation |
| [docs/PUBLICATION.md](docs/PUBLICATION.md) | Mettre l'application sur les magasins |
| [docs/store/](docs/store/) | Textes et éléments des fiches |
| [docs/CONFIDENTIALITE.md](docs/CONFIDENTIALITE.md) | Politique de confidentialité et déclarations aux magasins |
