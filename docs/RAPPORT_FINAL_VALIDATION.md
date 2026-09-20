# Rapport de validation — Plateau

Deuxième campagne, menée le 20 septembre 2026 : correction des cinq défauts
relevés à l'audit, et intégration de la monétisation publicitaire.

> **Le statut global n'est pas « terminé ».** Le code est complet et éprouvé
> hors appareil ; **aucune publicité réelle n'a jamais été affichée**, et rien
> n'a tourné sur un téléphone. Le détail est en section 9.

---

## 1. Point de départ et protection du travail

| | |
|---|---|
| Commit de départ | `4ef7e6f` |
| État à l'arrivée | arbre propre, `main` synchronisée avec `origin` |
| Point de restauration | tag `point-de-restauration-4ef7e6f`, posé avant toute modification |
| Branche de travail | `monetisation` |
| Dépôt | `Emincanozen/jeux-2`, **privé** |
| Secrets exposés | aucun — voir §7 |

Aucun `reset --hard`, aucune suppression de branche, aucun force-push.

---

## 2. Les cinq défauts de l'audit

### B1 — Les affirmations commerciales étaient fausses

**Confirmé.** `docs/store/README.md` annonçait « Chaque jeu propose trois
niveaux de difficulté ». Le relevé des cent fichiers en donne **vingt-sept**.
La description annonçait aussi « sans publicité » et « aucune donnée
collectée », deux phrases devenues fausses le même jour.

**Corrigé**, et surtout **automatisé** : `outils/controle-fiches.mjs` compare
désormais chaque chiffre annoncé à ce que le code fait, et refuse une liste
de formules périmées. Il ne regarde que les **textes réellement livrés** — les
blocs encadrés de ``` — pour qu'une explication puisse citer l'ancienne
formulation sans faire échouer la chaîne.

Éprouvé sur défaut injecté : trois chiffres faussés dans la fiche →
trois anomalies signalées, code de sortie 1.

> Effet secondaire utile : deux outils comptaient les « jeux à trois niveaux »
> différemment — 27 pour l'un, 30 pour l'autre. Ils partagent maintenant une
> seule définition, dans `outils/lib/catalogue.mjs`.

### B2 — L'audit de confidentialité ne prouvait rien

**Confirmé, et pire que signalé.** L'ancien contrôle cherchait
`XMLHttpRequest` et `navigator.sendBeacon` dans le paquet livré. Il ratait
`fetch`, les WebSockets, et tout SDK natif — qui ne laisse aucune trace de ce
genre dans le JavaScript. Il concluait pourtant « aucun appel réseau ».

**Remplacé** par `outils/audit-confidentialite.mjs`, qui vérifie quatre choses
et fait échouer la chaîne :

| Contrôle | Résultat |
|---|---|
| Le code de Plateau ne communique pas (133 fichiers, 7 primitives cherchées) | **0 appel réseau** |
| Les 24 dépendances d'exécution sont recensées et justifiées une par une | **1 seule communique** : `react-native-google-mobile-ads` |
| Les permissions déclarées sont justifiées, les sensibles interdites | **4 permissions**, toutes justifiées |
| Le stockage local correspond à la politique | `settings`, `progress`, préfixe `plateau:v1:` |

Éprouvé sur défaut injecté : un `fetch` glissé dans 2048 → deux anomalies,
code 1.

### B3 — La politique de confidentialité était incomplète et périmée

**Corrigée et réécrite** pour le contexte publicitaire :
identité du partenaire, catégories de données traitées, finalités et bases
légales, consentement et retrait, transferts hors UE, durées, permissions,
droits et autorité de contrôle, liens vers les politiques de Google.

**Deux champs restent volontairement vides** : `{{EDITEUR}}` et `{{CONTACT}}`.
Ils demandent une identité légale et une adresse réelles. **Je n'invente pas
tes coordonnées.** Le contrôle automatique les signale à chaque exécution
par un « PUBLICATION BLOQUÉE » explicite, sans faire échouer la chaîne — le
code est correct, c'est la publication qui ne l'est pas encore.

### B4 — Le guide Google Play

**Vérifié contre la page d'aide officielle.** La règle citée était exacte :
compte personnel créé après le 13 novembre 2023 → test fermé de **12 testeurs
opt-in en continu pendant 14 jours**, les comptes d'organisation étant
exemptés.

**Ce qui manquait** : le guide laissait entendre que les testeurs n'avaient
qu'à accepter l'invitation. La demande d'accès à la production comporte un
questionnaire sur le déroulement du test, et des retours d'éditeurs signalent
depuis 2026 des refus pour engagement insuffisant. Ce point vient de sources
tierces, pas de Google : il est présenté comme une précaution, pas comme une
règle citée.

**Ajouté aussi** : la déclaration « contient des annonces », le formulaire de
sécurité des données revu, le public cible, la configuration ATT côté Apple.

### B5 — « Aucun blocage logiciel » n'était pas démontré

**Retiré.** Le rapport précédent concluait au développement terminé. Il
mélangeait des choses très différentes : du code relu, des tests passés, un
paquet JavaScript produit — et pas une seule compilation native, pas une
seule installation, pas un seul essai sur appareil. La section 9 distingue
maintenant sept niveaux, et le statut global n'est plus « terminé ».

> Deux autres inexactitudes du rapport précédent, corrigées ici :
>
> - Il annonçait **495 contrôles** comme un chiffre ferme. Le total varie
>   d'une exécution à l'autre — 141 à 147 pour les échecs, 266 à 273 pour le
>   backgammon — parce que ces tests comptent des assertions par coup sur des
>   parties tirées au hasard. On écrit désormais « environ 570 ».
> - Il présentait comme corrigé un rejet de promesse audio. Le correctif
>   était **du code mort** : il enveloppait la valeur de retour de `play()`,
>   dont la signature est `play(): void`. Le vrai défaut est décrit au §4.

---

## 3. La monétisation

### Le choix

**Google AdMob**, via `react-native-google-mobile-ads` **17.0.0**. C'est
`expo install` qui a retenu cette version, et elle est la première écrite pour
la nouvelle architecture React Native — la seule disponible en RN 0.86. La
branche 16 y fonctionne par la couche d'interopérabilité, avec un support
encore annoncé « en cours » pour les annonces plein écran et l'UMP côté
Android.

Le prix de ce choix est la jeunesse de la version : publiée deux jours avant
cette campagne. C'est une raison de plus de ne pas publier avant l'essai sur
appareil.

Le raisonnement complet, les emplacements, les seuils, les identifiants et
les risques sont dans [MONETISATION.md](MONETISATION.md).

### Ce qui est implémenté

| Format | Emplacement | État |
|---|---|---|
| **Bannière** | Bas du catalogue, hors de la liste | Implémentée |
| **Interstitiel** | À la sortie d'un jeu, jamais pendant | Implémenté |
| **Récompensée** | Aucun | Infrastructure prête, **volontairement branchée nulle part** |

**Pourquoi aucune récompensée.** La mission interdit d'introduire une
difficulté artificielle pour vendre une publicité, et interdit que la
publicité modifie les règles d'un jeu. Dans le catalogue actuel, les indices
sont déjà gratuits et illimités, une seconde chance en arcade fausserait les
scores, et un mélange de plateau changerait la règle de fin de partie. Aucun
emplacement n'échappe à l'une ou l'autre interdiction. La mission prévoit ce
cas. La piste honnête serait un **jeu nouveau**, conçu avec une ressource
limitée dès le départ.

### Ce qui empêche une annonce de partir

Huit verrous, chacun avec son propre code de retour et son propre test :
publicité désactivée, module natif absent, aucun bloc d'annonce configuré,
**joueur dans un jeu**, consentement absent ou refusé, SDK non initialisé,
fréquence, rien de préchargé.

Effet mesuré : **30 parties enchaînées sur 15 minutes produisent 2 à 5
interstitiels**, pas 30.

### Consentement

Google UMP, avec l'ordre imposé — consentement d'abord, initialisation
ensuite — et vérifié par un test. Un consentement **indéterminé** (hors
ligne, formulaire injoignable) est traité comme un refus : jamais d'annonce
sur une supposition. La personnalisation est lue sur les finalités TCF
réellement accordées, pas déduite du statut global. Le retrait est accessible
depuis *Réglages → Choix de confidentialité publicitaire*.

### Hors ligne

Les cent jeux tournent sans connexion, et la régie ne bloque jamais le chemin
d'affichage : aucun `await` sur le démarrage. Une annonce indisponible est
ignorée, pas signalée au joueur.

---

## 4. Défauts trouvés en plus des cinq

| # | Défaut | Gravité | Comment il a été trouvé |
|---|---|---|---|
| 1 | **Le paquet web refusait de se construire.** Metro résout les `require` **statiquement**, y compris dans un `try` : un garde-fou `Platform.OS === 'web'` ne suffit pas à tenir un module natif hors du paquet | **Bloquante** | `npm run web`, dès le premier essai |
| 2 | **Rejet de promesse non géré à presque chaque partie.** L'écran de jeu détruisait les six lecteurs audio à chaque sortie ; couper une lecture en cours fait rejeter la promesse interne de `HTMLAudioElement.play()`, que l'application ne peut pas attraper | Élevée | Sonde : **89 jeux sur 100** portaient l'erreur |
| 3 | **`RECORD_AUDIO` — le microphone — dans le manifeste Android.** `app.json` déclarait quatre permissions ; la fusion en produisait onze, dont trois sensibles. La politique affirmait « ni microphone » | Élevée | `npx expo prebuild`, en relisant le manifeste produit |
| 4 | Le correctif audio de la campagne précédente était **du code mort** : il enveloppait la valeur de retour de `play()`, dont la signature est `play(): void` | Moyenne | Lecture des typages de `expo-audio` |
| 5 | Deux outils donnaient deux chiffres pour « jeux à trois niveaux » (27 et 30), et l'un partait dans une fiche de magasin | Moyenne | Régénération croisée des deux documents |

**Corrections.** (1) fichiers `.native.ts` et `.native.tsx`, plus un contrôle
CI qui refuse `GoogleMobileAds` dans le paquet web. (2) les six lecteurs
vivent désormais aussi longtemps que l'application. (3) sept permissions
retirées par `android.blockedPermissions`, et l'audit lit maintenant le
manifeste **fusionné**. (4) code mort remplacé par un commentaire qui dit ce
qui se passait vraiment. (5) définition unique dans `outils/lib/catalogue.mjs`.

### Trois défauts de l'outil de mesure, pas du code

La sonde de navigateur a accusé cinq jeux à tort. Chaque fois, c'est elle qui
avait tort :

| Symptôme | Cause réelle |
|---|---|
| Bataille, Golf, Pyramide, Tri-peaks « ne réagissent pas » | La sonde n'essayait que 14 commandes. Dans un solitaire, « Piocher » arrive après cinquante cartes dont aucune n'est jouable au premier coup |
| Mastermind « ne réagit pas » | La signature ignorait les éléments `<button>` — c'est-à-dire précisément ce que `react-native-web` produit pour un `Pressable`. Elle regardait partout sauf là où ça bouge |
| Vingt-cinq jeux mesurés très lentement | L'onglet était en arrière-plan : le navigateur bride les minuteurs et suspend `requestAnimationFrame`. Les jeux d'arcade paraissaient figés |

La leçon de la campagne précédente valait donc encore : **vérifier l'outil
avant d'accuser le code.** Les cinq jeux ont été rouverts à la main, un par
un, avant toute modification. Aucun n'avait de défaut.

---

## 5. Tests

Commande unique : `npm run verifier`. Sept maillons, chacun terminant par
`process.exit(1)`.

| Maillon | Ce qu'il couvre | Dernière exécution |
|---|---|---|
| `typecheck` | TypeScript strict sur tout le dépôt | **PASS** |
| `audit` | Contrat d'un jeu et huit pièges, sur 100 fichiers | **PASS** — 100 fichiers, 0 anomalie |
| `audit:confidentialite` | Réseau, dépendances, permissions, manifeste fusionné, stockage | **PASS** |
| `test:fiches` | Les chiffres des fiches correspondent au code | **PASS** |
| `test:regles` | Cartes, mots, aléatoire | **PASS** — 74 contrôles |
| `test:pub` | Fréquence, consentement, pannes publicitaires | **PASS** — 78 contrôles |
| `test:echecs` | Perft sur cinq positions, mat, pat, roque, promotion | **PASS** — 147 contrôles |
| `test:backgammon` | Scénarios déterministes + 400 parties aléatoires | **PASS** — 273 contrôles |

**Environ 570 assertions**, un chiffre qui bouge d'une exécution à l'autre.
Ce n'est pas de l'imprécision : les tests de moteur comptent une assertion par
coup sur des parties tirées au hasard.

### Les tests publicitaires, et leurs limites

Les 78 contrôles couvrent les quatorze scénarios demandés : initialisation,
consentement accepté, refusé, indéterminé, absence de réseau, échec de
chargement, interstitiel indisponible, plafond de fréquence, récompense
accordée, récompense refusée, reprise après arrière-plan, aucune publicité
pendant une partie, disposition sans piège à clic, jeux jamais bloqués.

Ils exécutent le **vrai** code de `src/pub/machine.ts`, avec un faux
adaptateur et une horloge pilotée. Éprouvés sur deux défauts injectés :
retirer la garde « pendant une partie » → 5 échecs ; accorder la récompense
sans confirmation du SDK → 1 échec. Code de sortie 1 dans les deux cas.

**Ils ne prouvent pas que le SDK de Google fonctionne.** Un adaptateur simulé
n'est pas une annonce affichée sur un téléphone.

### Sonde de navigateur — 100 jeux

Rejouée intégralement sur le code final, après correction de l'outil.

| Critère | Résultat |
|---|---|
| Chargement sans erreur de console | **100 / 100** |
| Gel pendant la lecture des règles | **100 / 100** |
| Réaction à une commande | **100 / 100** |
| Relance par le bouton ↻ | **100 / 100** |
| **PASS sur les cinq critères** | **100 / 100** |

Résultats bruts dans `outils/donnees/sonde-navigateur.json`, matrice jeu par
jeu dans [VALIDATION_100_JEUX.md](VALIDATION_100_JEUX.md).

**Ce que la sonde ne prouve pas** : qu'une partie a été jouée jusqu'au bout.
Elle ouvre, touche, relance. Elle ne gagne jamais.

---

## 6. Compilations

Distinguer ce qui existe vraiment :

| Niveau | État | Détail |
|---|---|---|
| Paquet JavaScript Android | **PASS** | `entry-….hbc`, 5,3 Mo |
| Paquet JavaScript iOS | **PASS** | `entry-….hbc`, 5,1 Mo |
| Paquet JavaScript web | **PASS** | et **sans le SDK publicitaire** — vérifié par `grep` |
| Configuration Expo | **PASS** | `npx expo-doctor` : 21 / 21 |
| Projet natif Android | **PASS** | `expo prebuild` ; manifeste relu permission par permission |
| Projet natif iOS | **PASS (en CI)** | Impossible sous Windows : *« Run npx expo prebuild again from macOS or Linux »*. Produit par la CI sur Ubuntu, et son `Info.plist` contient bien `GADApplicationIdentifier` |
| Compilation EAS (APK, AAB, IPA) | **BLOCKED** | `eas login` requis |
| Application installée | **NOT RUN** | — |

**Aucun APK, AAB ou IPA n'existe.** Il n'y a que des paquets JavaScript et
deux projets natifs non compilés — Android en local, iOS en intégration
continue. Produire un projet natif n'est pas le compiler.

---

## 7. Sécurité et confidentialité

| Point | Constat |
|---|---|
| Secrets dans le dépôt | **Aucun.** Les identifiants AdMob sont publics par nature — ils figurent en clair dans tout paquet livré |
| Secrets dans les workflows | **Aucun.** La CI ne publie rien, ne signe rien, ne déclenche aucune compilation EAS |
| Dépôt privé | **Oui**, et rien n'a été fait pour contourner cela |
| Permissions effectives | 4 : `VIBRATE`, `INTERNET`, `ACCESS_NETWORK_STATE`, `AD_ID` |
| Permissions retirées | 7, dont `RECORD_AUDIO` |
| Réseau depuis le code de Plateau | **Aucun** — 133 fichiers relus à chaque `npm run verifier` |
| Données transmises par Plateau | **Aucune.** Scores, réglages et favoris ne quittent pas l'appareil |
| Données traitées par AdMob | Documentées dans [CONFIDENTIALITE.md](CONFIDENTIALITE.md) §4, **d'après la documentation de Google, non mesurées** |

---

## 8. Ce que tu dois faire toi-même

Dans cet ordre. Le premier point conditionne tous les suivants ; le dernier
est le chemin critique en temps.

### 1. Créer un compte AdMob — 20 minutes, gratuit

**Pourquoi.** Sans identifiants réels, une compilation de production
n'affiche **aucune** publicité. C'est le comportement voulu — jamais
d'annonce de test chez un vrai joueur — mais il ne rapporte rien.

**Où.** [admob.google.com](https://admob.google.com)

**Quoi.** Déclarer deux applications (une Android, une iOS), relever les deux
identifiants d'application et créer deux blocs d'annonces par application
(bannière, interstitiel). Puis, dans *Confidentialité et messages*, créer un
message de consentement RGPD **et** un message ATT pour iOS.

**Résultat attendu.** Huit chaînes de la forme `ca-app-pub-…`.

**Pour que je reprenne.** Colle-les-moi, ou reporte-les toi-même dans
`app.json` aux deux endroits indiqués dans
[MONETISATION.md](MONETISATION.md) §7. Ce ne sont pas des secrets.

### 2. Te connecter à Expo — 5 minutes

```bash
eas login
eas init
```

**Pourquoi.** Aucune compilation native n'est possible sans ton compte. Je ne
te demanderai jamais ton mot de passe : lance ces deux commandes toi-même.

**Pour que je reprenne.** Dis-moi que c'est fait, et je lance la compilation
de développement.

### 3. Lancer le test fermé Google Play — **le chemin critique**

**Pourquoi.** Un compte personnel créé après le 13 novembre 2023 doit réunir
**12 testeurs opt-in en continu pendant 14 jours** avant d'obtenir l'accès à
la production. Ces deux semaines ne se rattrapent pas.

**Où.** [Play Console](https://play.google.com/console) → Tests → Test fermé.

**Quoi.** Téléverser le premier `.aab` à la main, inviter douze adresses
Google distinctes, et leur demander d'**ouvrir vraiment l'application** tous
les deux ou trois jours.

**Résultat attendu.** Au bout de 14 jours, le bouton « Demander l'accès à la
production » s'active.

**Pendant ce temps** : les captures d'écran, la fiche, et le protocole
d'essai sur appareil.

### 4. Dérouler le protocole d'essai sur appareil

[PROTOCOLE_APPAREIL.md](PROTOCOLE_APPAREIL.md) — **tout est à NOT RUN.**
Deux points prioritaires :

- **Les sons.** Sept permissions ont été retirées du manifeste, dont deux
  audio. C'est le bon choix pour la vie privée, mais il n'a jamais été
  compilé. Si les sons ne partent plus, la marche à suivre est dans le
  protocole.
- **La publicité.** Bannière, interstitiel, formulaire de consentement,
  refus du consentement, mode avion.

### 5. Héberger la politique de confidentialité

`docs/store/confidentialite.html`, sur une adresse HTTPS publique. Remplacer
`{{EDITEUR}}` et `{{CONTACT}}` par ton identité et ton adresse de contact —
**je ne les inventerai pas**. Les deux magasins exigent une URL.

### 6. Produire les captures d'écran

Depuis un build installé, jamais depuis une maquette. **Sans publicité de
test visible** : un bandeau « Test Ad » sur une capture de magasin est un
motif de refus.

### 7. Créer les comptes développeur

Apple Developer (99 $/an) et Google Play Console (25 $ une fois). **Je n'ai
rien payé et ne paierai rien sans ton accord.**

---

## 9. Statut final

| Niveau | Statut | Portée |
|---|---|---|
| Code relu | **PASS** | 100 jeux, module publicitaire, outillage |
| Tests automatisés | **PASS** | ~570 assertions, 7 maillons, éprouvés sur défauts injectés |
| Validation en navigateur | **PASS** | 100 / 100 sur cinq critères |
| Audit de confidentialité | **PASS** | Automatisé, y compris le manifeste fusionné |
| Paquets JavaScript | **PASS** | iOS, Android, web |
| Projet natif Android | **PASS** | Produit, manifeste vérifié |
| Projet natif iOS | **PASS** | Produit par la CI sur Ubuntu — impossible sous Windows |
| Compilations natives (APK, AAB, IPA) | **BLOCKED** | `eas login` |
| Application installée | **NOT RUN** | — |
| Essais sur appareil | **NOT RUN** | Protocole écrit, rien d'exécuté |
| **Publicité réelle affichée** | **NOT RUN** | Aucune annonce n'a jamais été vue |
| Fiches des magasins | **PARTIEL** | Textes prêts ; identité, contact, URL et captures manquants |
| Publication | **NOT RUN** | Aucune soumission, aucune dépense |

**Statut global : développement fonctionnellement complet, validation
matérielle non entamée.**

Le plus gros angle mort tient en une phrase : **la fonctionnalité centrale de
cette campagne — afficher une publicité — n'a jamais été vue fonctionner.**
Tout ce qui l'entoure est testé ; elle-même ne l'est pas, et ne peut pas
l'être sans un téléphone et un compte AdMob.

Second angle mort, hérité : sur les cent jeux, **une douzaine seulement** ont
été joués jusqu'à une vraie fin de partie. Ouvrir, toucher et relancer n'est
pas jouer.
