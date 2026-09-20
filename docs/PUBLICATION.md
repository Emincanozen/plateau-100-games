# Publier Plateau sur l'App Store et Google Play

Ce document décrit **ce qui est déjà prêt dans le dépôt** et **ce que tu dois
faire toi-même**, parce que cela demande tes identifiants et tes comptes.

---

## 1. Ce qui est déjà fait

| Élément | État |
|---|---|
| Identifiant iOS | `com.plateau.jeux` |
| Identifiant Android | `com.plateau.jeux` |
| Version | `1.0.0` — `buildNumber` iOS 1, `versionCode` Android 1 |
| Icône, icône adaptative Android, calque monochrome, favicon | Générés, `assets/` |
| Écran de lancement | Plugin `expo-splash-screen`, variantes claire et sombre |
| Permissions Android | `VIBRATE` seule — c'est tout ce dont l'application a besoin |
| Chiffrement (déclaration Apple) | `ITSAppUsesNonExemptEncryption: false`, évite la question à chaque envoi |
| Profils de compilation | `eas.json` : `development`, `apercu`, `production` |
| `npx expo-doctor` | 21 contrôles sur 21 |

Android produit un **App Bundle** (`.aab`), le seul format accepté par Google
Play. iOS produit une archive envoyable à App Store Connect.

Pour régénérer les icônes après un changement de couleurs :

```bash
node outils/icones.mjs
```

---

## 2. Ce que je ne peux pas faire à ta place

Trois choses demandent **tes identifiants**, que je ne dois ni saisir ni voir :

1. **Se connecter à Expo** (`eas login`) — la compilation tourne sur leurs
   serveurs, sous ton compte.
2. **Les comptes développeur.** Apple Developer Program, 99 $ par an. Google
   Play Console, 25 $ une seule fois. Sans eux, aucune publication n'est
   possible.
3. **Les certificats de signature.** EAS peut les créer et les garder pour toi,
   mais il faut t'authentifier auprès d'Apple et de Google pour cela.

Tout le reste est prêt. Les commandes ci-dessous sont à lancer telles quelles.

---

## 3. Préparer une seule fois

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas init
```

`eas init` crée le projet côté Expo et écrit son identifiant dans `app.json`.
Committe ce changement.

> Sous PowerShell, écrire `npx.cmd` et non `npx` : la politique d'exécution
> bloque les scripts `.ps1`. Les commandes ci-dessus passent par `eas`
> directement, elles ne sont pas concernées.

---

## 4. Essayer avant de publier

Une compilation d'essai, installable directement sur un téléphone Android sans
passer par le magasin :

```bash
eas build --profile apercu --platform android
```

Le fichier `.apk` produit s'installe en le téléchargeant depuis le lien que
donne EAS. C'est la façon la plus rapide de voir les cent jeux sur un vrai
appareil.

---

## 5. Android — Google Play

### Compiler

```bash
eas build --profile production --platform android
```

EAS propose de créer le magasin de clés (*keystore*) et de le conserver. Accepte :
si tu le perds, tu ne peux plus mettre l'application à jour.

### ⚠ Le test fermé obligatoire — à lancer en premier

Si ton compte Play Console est un **compte personnel créé après le
13 novembre 2023**, Google n'ouvre pas la production tout de suite. Il faut
d'abord :

> un test fermé réunissant **au moins 12 testeurs**, inscrits **sans
> interruption pendant au moins 14 jours**.

Ce n'est qu'ensuite que tu peux demander l'accès à la production depuis le
tableau de bord de la Play Console. Les comptes d'organisation ne sont pas
concernés
([documentation Google](https://support.google.com/googleplay/android-developer/answer/14151465)).

**Conséquence pratique : ces quatorze jours sont le chemin critique.** Lance le
test fermé dès que tu as un premier `.aab`, même si les captures d'écran et la
fiche ne sont pas finies — tu les prépareras pendant que le délai court. Sinon
tu attendras deux semaines de plus pour rien.

Il te faut douze adresses Google distinctes. Des proches suffisent — mais
**accepter l'invitation ne suffit plus**. La demande d'accès à la production
comporte un questionnaire sur la façon dont le test s'est déroulé, et des
retours d'éditeurs signalent depuis 2026 des refus pour « engagement de test
insuffisant » quand les testeurs n'ouvrent jamais l'application. Ce point-là
ne figure pas noir sur blanc dans la page d'aide de Google : traite-le comme
une précaution, pas comme une règle citée. Demande donc à tes douze testeurs
d'ouvrir vraiment Plateau tous les deux ou trois jours et d'y jouer quelques
minutes.

Profite de ces deux semaines pour vérifier ce que seul un appareil réel peut
montrer : que les publicités se chargent, que le formulaire de consentement
s'affiche, et que le refuser n'empêche aucun des cent jeux de tourner.

### Envoyer

La toute première version doit être **téléversée à la main** dans la Play
Console, parce que Google exige que la fiche existe avant tout envoi
automatique. Ensuite seulement :

```bash
eas submit --profile production --platform android
```

Cette commande cherche `cles/google-play.json`, un compte de service exporté
depuis la Play Console (*Configuration → Accès à l'API*). Le dossier `cles/`
est déjà ignoré par git — n'y déroge pas.

### Ce que la fiche réclame

- Icône 512 × 512 (dérive-la de `assets/icon.png`)
- Bandeau 1024 × 500
- Au moins deux captures d'écran par format d'appareil
- Description courte (80 caractères) et longue (4000)
- Politique de confidentialité : **une adresse web est obligatoire**
- Questionnaire « Sécurité des données » : **répondre « oui » à la collecte et
  au partage**. Ce n'est plus « aucune donnée » depuis l'intégration
  publicitaire : Plateau ne collecte toujours rien, mais le SDK AdMob, si. Le
  tableau détaillé, case par case, est dans
  [store/README.md](store/README.md#7-déclarations-de-confidentialité).
- Déclaration **« Cette application contient des annonces »** : obligatoire, et
  Google le vérifie automatiquement. L'oublier fait retirer la fiche.
- **Public cible et contenu** : déclarer un public général. Inclure les moins
  de 13 ans ferait entrer l'application dans le programme « Conçu pour les
  familles », qui interdit la publicité personnalisée — il faudrait alors
  passer `PUBLIC_ENFANT` à `true` dans `src/pub/config.ts`.
- **Applications financées par la publicité** : la fiche doit dire que
  l'application est gratuite avec publicités, sans achats intégrés.
- Classification du contenu : questionnaire PEGI, sans difficulté ici

---

## 6. iOS — App Store

### Compiler

```bash
eas build --profile production --platform ios
```

EAS demande tes identifiants Apple et crée le certificat de distribution et le
profil de provisionnement. Aucun Mac n'est nécessaire.

### Envoyer

```bash
eas submit --profile production --platform ios
```

Il faut d'abord créer la fiche dans App Store Connect avec l'identifiant
`com.plateau.jeux`.

### Ce que la fiche réclame

- Icône 1024 × 1024 sans transparence — `assets/icon.png` convient telle quelle
- Captures pour iPhone 6,7″ et iPad 13″ (`supportsTablet` est activé, Apple
  contrôlera donc l'affichage sur iPad)
- Description, mots-clés, catégorie (Jeux → Casse-tête ou Jeux de société)
- Politique de confidentialité : une adresse web, là aussi obligatoire
- « Confidentialité des données » : **données collectées par des tiers**
  (identifiant de l'appareil, données d'usage, diagnostics), via Google AdMob.
  La réponse « aucune donnée collectée » n'est plus vraie. Détail case par
  case dans [store/README.md](store/README.md#7-déclarations-de-confidentialité).
- **Suivi (*Tracking*)** : répondre « oui » si tu actives la publicité
  personnalisée. L'application déclare `NSUserTrackingUsageDescription`, et le
  formulaire UMP de Google peut afficher la demande ATT — à condition de
  l'avoir activée dans la console AdMob (*Confidentialité et messages → ATT*).
  Sans cette activation, iOS ne montre jamais la demande, l'IDFA reste
  inaccessible, et les annonces iOS sont non personnalisées.
- Classification par âge : 4+

---

## 7. Publier une mise à jour

Relever `version` dans `app.json`, puis recompiler. `autoIncrement` est actif
dans le profil `production` : EAS s'occupe du `buildNumber` et du
`versionCode`.

Avant chaque envoi :

```bash
npm run verifier
```

Cette commande enchaîne le contrôle de types, l'audit du catalogue, l'audit de
confidentialité, le contrôle des fiches, les règles partagées, la logique
publicitaire et les deux moteurs. Elle doit passer entièrement.

---

## 8. Points à traiter avant une vraie publication

Ce qui a été fait depuis la première version de ce guide :

- ✅ **Sons** — six effets synthétisés, branchés sur le même événement que les
  vibrations, pilotés par le réglage. `npm run assets:sons` les régénère.
- ✅ **Politique de confidentialité** — rédigée sur un relevé vérifié du code,
  dans [CONFIDENTIALITE.md](CONFIDENTIALITE.md), avec une page prête à héberger
  dans [store/confidentialite.html](store/confidentialite.html), et un résumé
  consultable dans l'application (Réglages → Données).
- ✅ **Licence** — le titulaire est maintenant un nom, plus le nom du produit.
- ✅ **Textes des fiches** — description courte et longue, mots-clés,
  catégories, déclarations : [store/README.md](store/README.md).

Ce qui reste :

| Point | Pourquoi ça bloque | Qui |
|---|---|---|
| **Créer un compte AdMob et relever les identifiants** | Sans eux, la production n'affiche **aucune** publicité — c'est le comportement voulu, mais il ne rapporte rien | Toi — procédure dans [MONETISATION.md](MONETISATION.md) |
| **Héberger la politique** | Les deux magasins exigent une **adresse web** publique, pas un fichier | Toi |
| **Nom et adresse de contact** | Obligatoires sur les deux fiches ; marqués `{{EDITEUR}}` et `{{CONTACT}}` dans la page | Toi |
| **Captures d'écran** | À produire depuis un build réel, jamais depuis une maquette | Toi, une fois un build installé |
| **Icône 512 × 512 et bandeau 1024 × 500** | Exigés par Google Play | Redimensionnement de `assets/icon.png` + composition |
| **Vérifier le nom « Plateau »** | Mot courant, peut-être déjà déposé | Toi |
| **Le test fermé de 14 jours** | Voir la section 5 — c'est le chemin critique | Toi, dès le premier `.aab` |
