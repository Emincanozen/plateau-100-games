# Rapport final de validation — Plateau

Campagne de finalisation menée le 20 septembre 2026.

---

## 1. État du projet

| | |
|---|---|
| Commit de départ | `d2a93db` |
| Point de restauration | tag `point-de-restauration-d2a93db` |
| Branche de travail | `finalisation`, fusionnée dans `main` |
| Jeux au catalogue | **100** — 20 plateau, 20 cartes, 20 logique, 20 arcade, 10 dés, 10 papier |
| État de l'application | **Fonctionnelle.** 100 jeux validés en navigateur sur cinq critères |
| État de la compilation | **Configuration validée**, bundles iOS et Android produits localement. Aucune compilation EAS lancée |
| État de la publication | **Non entamée.** Comptes développeur requis |

---

## 2. Travaux réalisés

### 2.1 Défauts signalés dans la mission — tous confirmés puis corrigés

| # | Problème | Fichier | Correction | Preuve |
|---|---|---|---|---|
| B1 | `npm run verifier` pouvait passer malgré des anomalies : l'audit affichait les problèmes mais sortait toujours en code 0 | `outils/audit.mjs` | `process.exit(1)` sur anomalie | **Les cinq contrôles éprouvés un par un sur un défaut injecté** : codes 2, 1, 1, 1, 1. La chaîne s'arrête et les tests suivants ne tournent pas |
| B2 | README faux sur quatre points : icônes « du modèle Expo », « pas encore de tests », profil `preview` inexistant, `build:configure` | `README.md` | Réécriture des trois sections concernées | `grep` sur les six documents : plus aucune contradiction |
| B3 | Réglage « Sons » présent mais totalement inerte — aucun lecteur, aucun fichier | `outils/sons.mjs`, `src/engine/sons.ts`, `app/game/[id].tsx` | Six effets **synthétisés**, branchés sur l'entonnoir `haptic` | `leger.wav` capté à la lecture lors d'un coup au morpion |
| B4 | Points ouverts de l'annexe périmés | `docs/ANNEXE.md` | Tableau réécrit, journal des correctifs complété | — |

### 2.2 Défauts trouvés en plus, pendant la validation

| # | Problème | Gravité | Fichier | Correction | Comment il a été trouvé |
|---|---|---|---|---|---|
| 1 | **L'application aurait planté hors Expo Go.** `expo-audio` exige `expo-asset` en dépendance de pair, absente | **Critique** | `package.json` | `expo-asset` installé | `expo-doctor`, après l'ajout des sons |
| 2 | **2048 injouable au navigateur** : balayage seul, aucun bouton, aucun clavier, aucune cible pour un lecteur d'écran | Élevée | `logique/jeu2048.tsx` | Clavier + croix directionnelle | Sonde : zéro commande étiquetée |
| 3 | **Bulles et Casse-briques** : même défaut | Élevée | `arcade/bulles.tsx`, `arcade/casse-briques.tsx` | Clavier + boutons | Nouveau contrôle ajouté à l'audit |
| 4 | **`Segmented` sans `accessibilityLabel`** — composant présent dans ~90 jeux | Élevée | `src/ui/Segmented.tsx` | Étiquette ajoutée | Sonde : Pong ne montrait aucune commande |
| 5 | **Cibles tactiles sous la norme** : `Segmented` 32 px, `Button` sm 36 px, contre 44 points recommandés par Apple | Moyenne | `src/ui/Segmented.tsx`, `src/ui/Button.tsx` | Minimum porté à 44 | Mesure des rectangles à 360 px de large |
| 6 | **Rejet de promesse non géré** : `play()` interrompu par la lecture suivante | Moyenne | `src/engine/sons.ts` | Promesse explicitement traitée | Sonde, sur Embouteillage — **défaut que j'avais moi-même introduit** |
| 7 | **Thème automatique incomplet sur Android** : `userInterfaceStyle` exige `expo-system-ui` | Moyenne | `package.json` | Module installé | Avertissement au `prebuild` |
| 8 | `'OS'` dans le dictionnaire : deux lettres, inatteignable au Boggle qui en exige trois | Faible | `src/games/lib/mots.ts` | Retiré | `npm run test:regles` |
| 9 | Bouton « Sortie » du backgammon à 28 px de haut | Faible | `plateau/backgammon.tsx` | Porté à 44 | Mesure des cibles |

### 2.3 Outillage ajouté

| Fichier | Rôle |
|---|---|
| `outils/test-regles.ts` | 74 contrôles : paquets, mélange, blackjack, scopa, vocabulaire, normalisation, aléatoire |
| `outils/test-echecs.ts` | Étendu de 5 à **147 contrôles** : perft, mat, pat, nulles, roque, prise en passant, promotion, notation, IA |
| `outils/test-backgammon.ts` | Étendu à **274 contrôles** : scénarios déterministes sur les règles délicates + 400 parties |
| `outils/sons.mjs` | Synthèse des six effets sonores, encodeur WAV compris |
| `outils/matrice.mjs` | Génère `VALIDATION_100_JEUX.md` depuis les sources et la sonde |
| `outils/donnees/sonde-navigateur.json` | Résultats bruts de la sonde, pour que la matrice soit reproductible |
| `.github/workflows/verifier.yml` | Intégration continue, sans aucun secret |

---

## 3. Tests

| Contrôle | Exécuté | Résultat | Preuve |
|---|---|---|---|
| `npm run typecheck` | ✅ | **PASS** | TypeScript strict, aucune erreur |
| `npm run audit` | ✅ | **PASS** | 100 fichiers, 100 identifiants uniques, 0 problème |
| `npm run test:regles` | ✅ | **PASS** | 74 contrôles, 0 échec |
| `npm run test:echecs` | ✅ | **PASS** | 147 contrôles, 0 échec |
| `npm run test:backgammon` | ✅ | **PASS** | 274 contrôles, 0 échec |
| `npm run verifier` (chaîne) | ✅ | **PASS** | Code de sortie 0 |
| Échec sur défaut injecté | ✅ | **PASS** | Les 5 contrôles sortent en code non nul |
| Sonde navigateur, 100 jeux | ✅ | **PASS** | 100/100 sur les 5 critères |
| `npx expo-doctor` | ✅ | **PASS** | 21 contrôles sur 21 |
| Bundle web de production | ✅ | **PASS** | 2,8 Mo |
| Bundles iOS et Android | ✅ | **PASS** | 4,6 Mo et 4,8 Mo, sons embarqués |
| `expo prebuild` Android | ✅ | **PASS** | Projet natif généré sans avertissement |
| `expo prebuild` iOS | ⛔ | **BLOCKED** | Expo l'ignore sur Windows — EAS le fait sur macOS |
| Secrets dans le dépôt | ✅ | **PASS** | Aucun, ni dans l'arbre ni dans les 157 fichiers de l'historique |
| Réseau dans le bundle livré | ✅ | **PASS** | 0 `XMLHttpRequest`, 0 `sendBeacon`, 0 domaine |
| Débordement à 360 px | ✅ | **PASS** | 0 débordement, 0 défilement horizontal sur 12 jeux |
| Compilation EAS Android | ⛔ | **BLOCKED** | Compte Expo requis |
| Compilation EAS iOS | ⛔ | **BLOCKED** | Compte Expo et certificats Apple requis |
| Tests sur appareil réel | ⛔ | **NOT RUN** | Aucun appareil ni simulateur disponible ici |

### Détail du perft

| Position | Profondeurs | Résultat |
|---|---|---|
| Position initiale | 20 · 400 · 8 902 · **197 281** | conforme |
| Kiwipete — roques et clouages | 48 · 2 039 · 97 862 | conforme |
| Prise en passant et échecs à la découverte | 14 · 191 · 2 812 · 43 238 | conforme |
| Promotions et sous-promotions | 6 · 264 · 9 467 | conforme |
| Position piégeuse | 44 · 1 486 · 62 379 | conforme |

---

## 4. Catalogue

| Niveau de validation | Couverture | Ce que ça prouve |
|---|---|---|
| **Automatisée — statique** | 100 / 100 | Contrat respecté, sept pièges évités, catégories et totaux corrects |
| **Automatisée — navigateur** | 100 / 100 | Chargement, gel pendant les règles, réaction à une commande, relance, console vide |
| **Automatisée — moteurs** | 2 / 100 | Échecs et backgammon : règles prouvées |
| **Automatisée — règles partagées** | ~35 / 100 | Les jeux qui dépendent de `cartes.ts` ou `mots.ts` |
| **Manuelle, partie complète** | ~12 / 100 | Mat du sot et sous-promotion aux échecs, tour complet au backgammon, moulin fermé et pion pris, saut et annulation au solitaire, partie entière du jeu de l'oie, décompte du Farkle, semis de l'awalé, 2048 au clavier et à la croix |
| **Sur Android** | 0 / 100 | Aucune compilation |
| **Sur iOS** | 0 / 100 | Aucune compilation |

Le détail jeu par jeu est dans [VALIDATION_100_JEUX.md](VALIDATION_100_JEUX.md).

**Ce qui n'est pas prouvé** : qu'une partie complète se déroule correctement
dans chacun des 100 jeux. Ouvrir, toucher et relancer n'est pas jouer.

---

## 5. Builds

| Cible | État | Détail |
|---|---|---|
| Bundle JavaScript iOS | **PASS** | 4,6 Mo, 29 ressources dont 6 sons |
| Bundle JavaScript Android | **PASS** | 4,8 Mo, 33 ressources dont 6 sons |
| Projet natif Android (`prebuild`) | **PASS** | Généré sans avertissement |
| Projet natif iOS (`prebuild`) | **BLOCKED** | Impossible depuis Windows, par conception |
| **APK Android (`eas build --profile apercu`)** | **BLOCKED** | `eas login` requis |
| **AAB Android (`--profile production`)** | **BLOCKED** | `eas login` requis |
| **IPA iOS (`--profile production`)** | **BLOCKED** | `eas login` + compte Apple Developer requis |

Le projet n'est pas encore lié à EAS : `app.json` n'a pas d'`extra.eas.projectId`,
et `eas whoami` répond « Not logged in ».

---

## 6. Publication

### Prêt

- Identifiants `com.plateau.jeux`, version 1.0.0, build 1
- Icônes, icône adaptative Android, calque monochrome, écran de lancement clair et sombre
- Permissions réduites à `VIBRATE` ; déclaration de chiffrement Apple
- Profils EAS `development`, `apercu`, `production` — Android produit un App Bundle
- Politique de confidentialité rédigée sur constats vérifiés, page HTML prête, résumé dans l'application
- Textes des fiches : description courte et longue, mots-clés, catégories, classification proposée

### Manque — et pourquoi

| Élément | Nature du blocage |
|---|---|
| Comptes Apple (99 $/an) et Google Play (25 $) | **Administratif** |
| `eas login`, `eas init` | **Administratif** — identifiants |
| Nom du responsable, adresse de contact | **Administratif** |
| Adresse web de la politique de confidentialité | **Administratif** — hébergement |
| Captures d'écran | **Technique** — exige un build installé |
| Icône 512 × 512, bandeau 1024 × 500 | **Technique** — dérivables de l'icône existante |
| Test fermé Google Play : 12 testeurs, 14 jours | **Administratif** — et c'est le chemin critique |

Aucun blocage n'est de nature **logicielle**.

---

## 7. Risques restants

| Risque | Gravité | Pourquoi il subsiste |
|---|---|---|
| **Les 100 jeux n'ont pas été joués de bout en bout** | **Élevé** | Une règle fausse en fin de partie ne se verrait pas. Seuls ~12 jeux ont été menés jusqu'à une conclusion. C'est le principal angle mort. |
| **Rien n'a tourné sur un vrai appareil** | **Élevé** | Le navigateur ne dit rien des performances réelles, du retour haptique, de la mise en arrière-plan, ni des encoches. Le son n'a été vérifié que sur le web. |
| **Aucun test d'interface automatisé dans le dépôt** | Moyen | La sonde est une méthode documentée, pas un script versionné. Une régression d'interface ne serait pas attrapée par l'intégration continue. |
| 14 avis de sécurité modérés | Faible | Deux racines : `decode-uri-component` et `uuid`, atteintes uniquement par l'outillage de compilation Expo. **Absentes du bundle livré**, vérifié. Les corriger imposerait de forcer les versions internes d'Expo. |
| Avertissement `textShadow*` sur le web | Faible | Vient de react-native-web, pas de React Native. `textShadowColor` reste l'API documentée pour iOS et Android : migrer casserait le natif. |
| Cases de plateau sous 44 px | Faible | Intrinsèque : 144 tuiles de mahjong ne tiennent pas à 44 px sur un téléphone. Les boutons, eux, respectent la norme. |
| Orthographe du titulaire de licence | Faible | `LICENSE` porte « Emincan Ozen », déduit du compte git. À confirmer. |
| Français uniquement | Faible | Décision assumée. Aucune infrastructure i18n. |

---

## 8. Ce que tu dois faire toi-même

### 1. Créer les comptes développeur

**Pourquoi** : sans eux, rien ne peut être publié.
**Où** : [developer.apple.com](https://developer.apple.com/programs/) (99 $/an) et
[play.google.com/console](https://play.google.com/console/signup) (25 $ une fois).
**Vérifier** : les deux consoles t'affichent un tableau de bord actif.

### 2. Lier le projet à EAS

**Pourquoi** : la compilation tourne sur les serveurs d'Expo, sous ton compte.

```bash
npm install -g eas-cli
```
```bash
eas login
```
```bash
eas init
```

**Vérifier** : `app.json` contient désormais `extra.eas.projectId`. Committe ce changement.

### 3. Lancer le test fermé Google Play — **en premier**

**Pourquoi** : un compte personnel créé après le 13 novembre 2023 doit réunir
**12 testeurs inscrits sans interruption pendant 14 jours** avant d'accéder à la
production. Ces deux semaines sont le chemin critique : lance-les avant de
préparer les captures.

```bash
eas build --profile production --platform android
```

Téléverse le `.aab` dans la Play Console, crée une piste de test fermé, invite
douze adresses Google.
**Vérifier** : le tableau de bord affiche le décompte des jours.

### 4. Produire les captures d'écran

**Pourquoi** : obligatoires sur les deux magasins, et elles doivent montrer
l'application réelle.
**Où** : depuis un build installé, ou depuis un simulateur.
**Quoi** : la liste et les formats sont dans [store/README.md](store/README.md).

### 5. Héberger la politique de confidentialité

**Pourquoi** : les deux magasins exigent une **adresse web**, pas un fichier.
**Comment** : `docs/store/confidentialite.html` est prêt. GitHub Pages suffit.
**Avant** : remplacer les trois `[À COMPLÉTER]` par ton nom et ton adresse.
**Vérifier** : la page s'ouvre dans un navigateur privé.

### 6. Confirmer le titulaire de la licence

**Pourquoi** : `LICENSE` porte « Emincan Ozen », déduit de ton compte git.
**Vérifier** : l'orthographe exacte, accents compris.

### 7. Compiler pour iOS

```bash
eas build --profile production --platform ios
```

EAS demandera tes identifiants Apple et créera les certificats. **Ne me les
communique jamais** : la commande te les demande directement.

---

## 9. Statut final

> ## **A — DÉVELOPPEMENT TERMINÉ**

Le code et les contrôles techniques sont validés :

- 100 jeux présents, enregistrés, et validés en navigateur sur cinq critères
- `npm run verifier` passe, et **échoue réellement** sur défaut injecté
- 495 contrôles automatisés au total (74 règles, 147 échecs, 274 backgammon)
- `expo-doctor` : 21 sur 21 ; bundles iOS et Android produits
- Aucun secret, aucun appel réseau, confidentialité établie sur constats
- Neuf défauts trouvés et corrigés au-delà de ceux signalés, dont un qui aurait
  fait planter l'application en production

Le statut n'est pas **B — BUILD VALIDÉ**, parce qu'aucune compilation EAS n'a
été lancée ni aucun test mené sur appareil : les deux demandent des comptes que
je ne dois pas manipuler.

Le statut n'est pas **BLOCKED** : aucun défaut logiciel connu ne subsiste, et
tout ce qui reste relève de démarches administratives ou d'étapes qui exigent
un build.
