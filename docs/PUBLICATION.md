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
- Politique de confidentialité : **une adresse web est obligatoire**, même sans
  collecte de données
- Questionnaire « Sécurité des données » : répondre **aucune donnée collectée,
  aucune donnée partagée**. C'est exact : l'application n'a pas de réseau.
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
- « Confidentialité des données » : **aucune donnée collectée**
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

Cette commande enchaîne le contrôle de types, l'audit du catalogue et les deux
tests de moteur. Elle doit passer entièrement.

---

## 8. Points à traiter avant une vraie publication

- **Adresse de la politique de confidentialité.** Obligatoire chez Apple comme
  chez Google. Le texte peut être court : l'application ne collecte rien, ne
  transmet rien, et tout reste sur l'appareil.
- **Captures d'écran.** Aucune n'est encore préparée.
- **Nom sur les magasins.** « Plateau » est peut-être déjà pris ; vérifie-le
  avant de dépendre de ce nom.
- **Licence.** `LICENSE` porte encore « Plateau » comme titulaire du droit
  d'auteur, pas ton nom.
- **Sons.** Le réglage existe et est persisté, mais aucun son n'est joué.
