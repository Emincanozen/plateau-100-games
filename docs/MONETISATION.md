# Monétisation publicitaire de Plateau

Comment les publicités sont choisies, où elles apparaissent, ce qui les
empêche d'apparaître, et ce qu'il reste à faire côté compte AdMob.

> **État : le code est en place et éprouvé hors appareil.** Aucune annonce
> réelle n'a encore été affichée : cela demande une compilation native et un
> compte AdMob. Voir [RAPPORT_FINAL_VALIDATION.md](RAPPORT_FINAL_VALIDATION.md)
> pour ce qui est PASS, BLOCKED et NOT RUN.

---

## 1. Le fournisseur retenu, et pourquoi

**Google AdMob**, via `react-native-google-mobile-ads` **17.0.0**
([invertase/react-native-google-mobile-ads](https://github.com/invertase/react-native-google-mobile-ads)).

| Critère | Constat |
|---|---|
| Compatibilité React Native | v17 exige **RN ≥ 0.76 et la nouvelle architecture** ; le projet est en RN 0.86, où la nouvelle architecture est la seule disponible |
| Compatibilité Expo | `expo install` a choisi cette version de lui-même, et fournit un greffon de configuration officiel |
| Vitalité | publiée le 18 septembre 2026 ; la 16.5.0 date du 18 août 2026 — bibliothèque suivie de près |
| Consentement | intègre **Google UMP**, certifié IAB TCF v2, sans dépendance supplémentaire |
| Formats | bannière, interstitiel, récompensée, natif, ouverture d'application |

**Pourquoi la 17 et pas la 16.5.** La branche 16 fonctionne sur la nouvelle
architecture par la couche d'interopérabilité, et le dépôt indiquait encore
« en cours » pour les annonces plein écran et l'UMP côté Android. La 17 est la
première version écrite **pour** l'architecture que ce projet utilise. Le prix
à payer est sa jeunesse, et il est réel : c'est la raison pour laquelle
l'essai sur appareil (phase G) reste indispensable avant toute publication.

**Ce que ce choix coûte au projet.** `AGENTS.md` posait « aucun réseau,
jamais de `fetch` » comme une décision de conception. Elle tombe : le SDK
communique par construction. Ce que l'on a conservé, et qui est vérifié
automatiquement, c'est que **le code de Plateau**, lui, ne communique
toujours pas — voir `npm run audit:confidentialite`.

---

## 2. Architecture

```
src/pub/
  types.ts           Le vocabulaire maison : AdaptateurPub, InfoConsentement, IssueAffichage
  config.ts          Identifiants, règles de fréquence, classement de contenu
  machine.ts         QUAND une annonce a le droit de partir — sans React, sans SDK
  adaptateur.ts      Version web : ne fait rien
  adaptateur.native.ts  Version iOS/Android : enveloppe le SDK Google
  regie.tsx          Le fournisseur React et les crochets
src/ui/
  Banniere.tsx          Version web : rend null
  Banniere.native.tsx   Le bandeau réel
```

Trois idées tiennent l'ensemble.

**1. Les cent jeux ignorent la publicité.** Aucun fichier de
`src/games/` ne contient le mot. C'est vérifié par un test : si un jeu
importe une bannière ou un interstitiel, `npm run test:pub` échoue.

**2. La décision est séparée de l'affichage.** `machine.ts` ne connaît ni
React ni Google : on lui injecte un adaptateur et une horloge. C'est ce qui
rend la fréquence, le consentement et les pannes réellement testables — 78
contrôles, sans téléphone ni compte.

**3. La séparation web / natif passe par l'extension de fichier.** Metro
analyse les `require` statiquement, y compris dans un `try` : un garde-fou
`Platform.OS === 'web'` ne suffisait pas, et le paquet web refusait de se
construire (« Importing native-only module codegenNativeComponent on web »).
Les fichiers `.native.ts` règlent le problème à la racine, et `npm run web`
reste utilisable pour développer et éprouver les cent jeux.

---

## 3. Où les annonces apparaissent

| Format | Emplacement | Règle |
|---|---|---|
| **Bannière** | Bas du catalogue, hors de la liste | Aucune hauteur réservée tant que rien n'est chargé ; marge sous le bandeau ; retirée en cas d'échec |
| **Interstitiel** | À la **sortie** d'un jeu, jamais pendant | Voir les seuils ci-dessous |
| **Récompensée** | Aucun emplacement pour l'instant — voir §6 | Infrastructure en place et testée |

**Nulle part ailleurs.** Pas de bannière dans l'écran de jeu, pas de bannière
dans la fenêtre de fin de partie — elle jouxterait les boutons « Rejouer » et
« Quitter », ce qui est la manière la plus sûre de provoquer un clic
accidentel. Pas d'annonce à l'ouverture de l'application non plus.

### Les seuils, en un endroit

`src/pub/config.ts`, constante `FREQUENCE` :

| Règle | Valeur | Raison |
|---|---|---|
| Parties terminées avant de redevenir éligible | 3 | Une annonce par partie ferait fuir le joueur avant de rapporter |
| Délai minimal entre deux interstitiels | 3 min | Empêche l'enchaînement sur des parties courtes |
| Silence après le lancement | 2 min | Les premières minutes appartiennent au joueur |
| Péremption d'une annonce préchargée | 50 min | Google fixe la limite à 1 h |

Effet mesuré par les tests : **30 parties enchaînées sur 15 minutes
produisent 2 à 5 interstitiels**, pas 30.

### Ce qui bloque un interstitiel

Dans l'ordre où la machine les examine :

1. publicité désactivée ;
2. pas de module natif (web, Expo Go) ;
3. aucun bloc d'annonce configuré ;
4. **le joueur est dans un jeu** ;
5. consentement absent, refusé ou indéterminé ;
6. SDK non initialisé ;
7. période de grâce, quota de parties, ou délai entre annonces ;
8. rien de préchargé, ou chargement en échec.

Chaque cas a son propre code de retour, et chacun est couvert par un test.

---

## 4. Consentement et conformité

Le recueil passe par **Google UMP**. L'ordre est imposé par Google et vérifié
par un test : **consentement d'abord, initialisation du SDK ensuite**.

| Exigence | Traitement |
|---|---|
| RGPD / ePrivacy (EEE, Royaume-Uni, Suisse) | Formulaire UMP, configuré dans la console AdMob |
| Publicités non personnalisées | **Ne sont pas dispensées de consentement** : elles supposent un accès au terminal. Le formulaire est présenté partout où la configuration Google le prévoit |
| Refus du profilage | Toutes les requêtes partent avec `requestNonPersonalizedAdsOnly`, et le SDK est initialisé avec `publisherPrivacyPersonalizationState: 'disabled'` |
| Refus complet | **Aucune annonce.** Pas de repli silencieux |
| Consentement indisponible (hors ligne) | État « indéterminé », traité comme un refus. Un inconnu ne vaut jamais un accord |
| Retrait du consentement | *Réglages → Choix de confidentialité publicitaire*, visible dès que Google signale le formulaire comme requis |
| États américains régulés | Couverts par la même configuration UMP, à activer dans la console AdMob |
| ATT (iOS) | `NSUserTrackingUsageDescription` déclaré ; la demande est présentée par UMP **si tu actives le message ATT dans la console AdMob**. Sans cela, pas d'IDFA et annonces non personnalisées sur iOS |
| Classement de contenu | `maxAdContentRating: 'G'` — tout public |
| Public enfant | `PUBLIC_ENFANT = false`. À passer à `true` si la Play Console déclare un public cible de moins de 13 ans, ce qui interdit alors la personnalisation |

La personnalisation n'est pas déduite du statut global : le code lit les
finalités TCF réellement accordées
(`selectPersonalisedAds`, `createAPersonalisedAdsProfile`). Accepter le
formulaire sans accepter le profilage est un cas fréquent en Europe, et il
est traité.

---

## 5. Hors ligne

Les cent jeux fonctionnent sans connexion : c'est une contrainte du projet,
et elle tient. Ce qui change avec la publicité :

| Sans réseau | Comportement |
|---|---|
| Démarrage de l'application | Normal. La régie démarre **sans attendre** : aucun `await` bloquant sur le chemin d'affichage |
| Ouverture d'un jeu | Normale |
| Partie, sauvegarde, records | Normaux — tout est local |
| Bannière | Ne s'affiche pas, et n'occupe aucune place |
| Interstitiel | Refusé silencieusement, la sortie de jeu est immédiate |
| Récompensée | Renvoie « non accordée ». L'appelant garde son chemin normal |

Aucune de ces situations ne remonte d'exception à l'application : c'est le
scénario 14 des tests.

---

## 6. Les publicités récompensées — pourquoi aucune, pour l'instant

L'infrastructure est écrite et testée (`useRecompense`, scénarios 9 et 10) :
brancher une récompense demande trois lignes dans un jeu. Elle n'est branchée
**nulle part**, et c'est une décision, pas un oubli.

La mission pose deux règles : *ne pas introduire artificiellement des
difficultés pour pousser les joueurs à regarder une publicité*, et *les
publicités ne doivent pas modifier les règles des jeux*. Or, dans le
catalogue actuel :

- **Les indices sont déjà gratuits et illimités** (mahjong, et les indices
  affichés du pendu et des anagrammes). Les plafonner pour vendre le
  dépassement, c'est exactement retirer quelque chose pour le revendre.
- **Une seconde chance en arcade** modifierait la courbe de score, donc la
  règle du jeu et la valeur des records déjà enregistrés.
- **Un mélange du plateau en cas de blocage** change la règle de fin de
  partie.

Aucun emplacement n'échappe à l'une ou l'autre règle. La mission prévoit
explicitement ce cas : *si aucune récompense cohérente n'existe pour un jeu,
ne pas y ajouter ce format*.

**Si tu veux ce format malgré tout**, la piste la plus honnête est un jeu
**nouveau**, conçu dès le départ avec une ressource limitée — par exemple un
solitaire à trois annulations, où la quatrième s'obtient par une annonce.
Rien n'est alors retiré à personne. Dis-le-moi et je le construis.

---

## 7. Identifiants : test et production

### En développement, toujours les blocs de test de Google

`src/pub/config.ts` force les identifiants de démonstration publiés par
Google dès que `__DEV__` est vrai ou que l'application tourne dans Expo Go.

**Ce n'est pas une précaution de confort.** Cliquer sur ses propres annonces
réelles, même une fois, même par accident pendant un test, fait fermer un
compte AdMob. Les blocs de test ne rapportent rien et ne risquent rien.

Les identifiants d'application inscrits dans `app.json` sont eux aussi ceux
de la documentation Google (`ca-app-pub-3940256099942544~…`). Ils doivent
être remplacés.

### Trois verrous contre un bloc de test publié

Le risque est réel et coûteux : un paquet publié avec les blocs de
démonstration ne rapporte rien, fausse les statistiques d'AdMob, et ne se
corrige qu'au prix d'une nouvelle revue de plusieurs jours.

| Verrou | Quand | Ce qu'il fait |
|---|---|---|
| **`app.config.js`** | à la configuration, avant toute compilation | `PLATEAU_PRODUCTION=1` **refuse de compiler** si le mode test est actif, si le greffon porte encore un identifiant de démonstration, ou si aucun bloc réel n'est renseigné |
| **`npm run test:pub`** | à chaque `npm run verifier` | appelle réellement `app.config.js` et vérifie qu'il refuse ; vérifie aussi que le profil EAS `production` ne pose pas le drapeau |
| **`npm run paquet:verifier … -- --production`** | sur le fichier produit | relit l'APK ou l'AAB : mode publicitaire, identifiants, permissions, signature. Sort en échec sur tout ce qui interdirait la publication |

Le troisième est le seul qui juge le fichier réellement téléversé. Les deux
premiers peuvent être contournés par une variable oubliée ; celui-là non.

```bash
npm run paquet:verifier android/app/build/outputs/bundle/release/app-release.aab -- --production
```

### En production, jamais de bloc de test

La règle symétrique est codée : si l'identifiant réel manque, `UNITES` vaut
`null` et **aucune annonce n'est diffusée**. L'application n'affiche jamais
une annonce de démonstration à un vrai joueur.

### Ce que tu dois faire

1. Créer un compte sur [admob.google.com](https://admob.google.com) — gratuit.
2. Y déclarer **deux applications** : une Android, une iOS. AdMob demande si
   l'application est déjà publiée : réponds non, il attribuera quand même les
   identifiants.
3. Relever l'**identifiant d'application** de chacune, de la forme
   `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY` (avec un tilde).
4. Créer, pour chaque application, **deux blocs d'annonces** : une bannière et
   un interstitiel. En créer un troisième, récompensé, seulement si on branche
   un jour ce format. Chaque bloc donne un identifiant de la forme
   `ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ` (avec une barre oblique).
5. Reporter ces valeurs dans `app.json`, à **deux endroits** :

```jsonc
// 1. le greffon — c'est lui qui écrit l'identifiant dans le manifeste Android
//    et dans l'Info.plist iOS
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-VOTRE~ANDROID",
    "iosAppId": "ca-app-pub-VOTRE~IOS",
    ...
  }
]

// 2. extra.admob — les blocs d'annonces lus à l'exécution
"extra": {
  "admob": {
    "androidAppId": "ca-app-pub-VOTRE~ANDROID",
    "iosAppId": "ca-app-pub-VOTRE~IOS",
    "androidBanniere": "ca-app-pub-VOTRE/BANNIERE_ANDROID",
    "iosBanniere": "ca-app-pub-VOTRE/BANNIERE_IOS",
    "androidInterstitiel": "ca-app-pub-VOTRE/INTER_ANDROID",
    "iosInterstitiel": "ca-app-pub-VOTRE/INTER_IOS",
    "androidRecompense": "",
    "iosRecompense": ""
  }
}
```

6. Dans la console AdMob, section **Confidentialité et messages**, créer un
   message de consentement RGPD **et** un message ATT pour iOS. Sans eux, le
   formulaire UMP ne s'affiche jamais et l'application ne diffuse rien en
   Europe — c'est le comportement voulu, mais il ne rapporte rien.
7. Recompiler : ces valeurs sont lues à la compilation.

### Ce qui est public, ce qui ne l'est pas

| Donnée | Nature |
|---|---|
| Identifiant d'application, blocs d'annonces | **Publics.** Ils figurent en clair dans tout paquet Android ou iOS, et n'importe qui peut les extraire. Les mettre dans `app.json` et dans git est normal |
| Identifiants de connexion Google, code de validation | **Secrets.** Ils ne doivent jamais apparaître dans le dépôt, dans un workflow, ni dans une conversation |
| Compte de service Play Console (`cles/google-play.json`) | **Secret.** Le dossier `cles/` est ignoré par git |

Aucun secret n'est nécessaire pour compiler ni pour diffuser des publicités.

---

## 8. Vérifier son travail

```bash
npm run test:pub              # 78 contrôles, sans réseau ni appareil
npm run audit:confidentialite # le code de l'application ne communique pas
npm run verifier              # la chaîne complète
```

**Ce que ces tests ne prouvent pas.** Ils exécutent la vraie machine, mais
avec un faux SDK. Ils ne disent rien du comportement du SDK de Google sur un
téléphone : chargement réel, formulaire de consentement, rendu de la
bannière, interstitiel à l'écran, retour d'arrière-plan. Cette vérification
demande une compilation native et figure au protocole d'essai
(phase G du rapport), avec le statut **NOT RUN**.

`npx expo-doctor` contrôle en plus la compatibilité de version et la
configuration du greffon.

---

## 9. Coûts et risques

| Point | Détail |
|---|---|
| Coût direct | Aucun. AdMob est gratuit ; Google prélève sa part sur les revenus |
| Seuil de paiement | 70 € (ou 100 $) chez Google, après vérification d'identité et d'adresse |
| Fiscalité | Des revenus publicitaires sont des revenus imposables. Google demande un formulaire fiscal avant le premier versement |
| **Fermeture de compte** | Le risque majeur : cliquer sur ses propres annonces, même une fois. D'où les blocs de test forcés en développement |
| Refus de fiche | Déclaration « contient des annonces » oubliée, ou formulaire de sécurité des données incohérent avec le SDK |
| Revenus attendus | Un catalogue de jeux hors ligne sans achat intégré rapporte peu par utilisateur. L'ordre de grandeur usuel se compte en euros pour mille affichages, pas en euros par joueur |
| Dépendance à une bibliothèque jeune | La 17.0.0 a quelques jours. Un défaut du SDK se corrige par une mise à jour, mais il faut recompiler et repasser par la revue des magasins |
| Expo Go | **N'est plus utilisable** pour ce projet : un module natif est maintenant présent. Le développement passe par `npm run web` ou par une compilation de développement |
