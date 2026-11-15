# Audit de confidentialité — Plateau

Ce document est le relevé de ce que l'application traite réellement, et la
justification des réponses aux questionnaires d'Apple et de Google. La page
publique destinée aux joueurs est
[store/confidentialite.html](store/confidentialite.html).

**Dernière révision : 20 septembre 2026**, après l'intégration publicitaire.

> **Ce que la version précédente affirmait, et qui est devenu faux.** Elle
> concluait « aucune donnée collectée, aucune donnée transmise », sur la foi
> d'une recherche de `XMLHttpRequest` et `navigator.sendBeacon` dans le
> paquet livré. Ce contrôle était doublement insuffisant : il ne cherchait ni
> `fetch`, ni les WebSockets, ni les SDK natifs, qui ne laissent aucune trace
> de ce genre dans le JavaScript. Et il est devenu caduc le jour où un module
> publicitaire est entré dans l'application.

---

## 1. La distinction qui structure tout

| | Plateau | Google AdMob |
|---|---|---|
| Collecte des données | **Non** | Oui |
| Transmet des données | **Non** | Oui |
| Conserve des données sur l'appareil | Réglages et progression | Choix de consentement, jetons techniques |
| Reçoit quelque chose de l'utilisateur | Rien | Voir §4 |
| Ce que l'éditeur voit | Rien | Des revenus agrégés, jamais des données personnelles |

Les deux magasins demandent de déclarer **aussi** ce que font les
bibliothèques intégrées. Répondre « aucune donnée » parce que notre propre
code n'en collecte pas serait une déclaration fausse.

---

## 2. Méthode, et pourquoi elle a changé

L'audit est désormais un programme : `outils/audit-confidentialite.mjs`,
exécuté par `npm run verifier` et par la CI. Il vérifie quatre choses.

**1. Le code de Plateau ne communique pas.** Les 133 fichiers de `src/`
(hors `src/pub/`) et de `app/` sont relus à la recherche de `fetch(`,
`XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`,
`navigator.geolocation` et de toute adresse `http(s)://` hors commentaire.
**Zéro occurrence.** Un `fetch` glissé dans un jeu fait échouer la chaîne —
vérifié en en injectant un.

**2. Les dépendances capables de communiquer sont recensées.** Les
24 dépendances d'exécution sont inscrites une par une avec ce qu'elles ont le
droit de faire. Une bibliothèque ajoutée sans être inscrite fait échouer le
contrôle. **Une seule communique : `react-native-google-mobile-ads`.**

**3. Les permissions correspondent.** Chaque permission déclarée doit être
justifiée par une dépendance connue, et une liste de permissions sensibles
est interdite d'office.

**4. Ce qui est écrit sur l'appareil est ce qui est documenté.** Le préfixe
de stockage et les clés utilisées sont comparés à ce qu'annonce la politique.

### Un défaut trouvé par cette méthode

`app.json` ne déclarait que quatre permissions. Le manifeste Android
**fusionné**, produit par `npx expo prebuild`, en contenait onze — dont
`RECORD_AUDIO`, apportée par `expo-audio`, alors que la politique affirmait
« ni microphone ». Aucune lecture de `app.json` ne pouvait le voir.

Sept permissions sont maintenant retirées par `android.blockedPermissions` :
`RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `READ_EXTERNAL_STORAGE`,
`WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_MEDIA_PLAYBACK`.

### Un second défaut du même genre, trouvé dans l'APK

Lire le manifeste de `expo prebuild` ne suffisait pas non plus. Ce fichier ne
contient que ce que **le module applicatif** déclare ; les bibliothèques
ajoutent les leurs plus tard, à la fusion des manifestes. L'APK compilé en
contient donc quatre de plus, qu'aucune lecture des sources ne pouvait
montrer.

L'audit lit désormais le manifeste **du paquet livré** quand il existe, et
retombe sur celui de prebuild sinon — en le disant. Relevé sur l'APK du
20 septembre 2026, par `aapt dump permissions` :

Provenance relevée dans le rapport de fusion de Gradle
(`android/app/build/outputs/logs/manifest-merger-release-report.txt`), pas
déduite :

| Permission | Déclarée par | Pourquoi |
|---|---|---|
| `INTERNET` | `app.json` + `react-native-google-mobile-ads` | Chargement des publicités |
| `ACCESS_NETWORK_STATE` | `app.json` + `react-native-google-mobile-ads` | Le SDK vérifie la connectivité |
| `VIBRATE` | `app.json` + `expo-haptics` | Retour haptique, désactivable |
| `com.google.android.gms.permission.AD_ID` | `app.json` + `play-services-ads-api 25.4.0` | Identifiant publicitaire, à déclarer depuis Android 13 |
| `WAKE_LOCK` | **`react-native-google-mobile-ads`** et **`media3-exoplayer`** (dépendance d'`expo-audio`) | Écran actif pendant une publicité vidéo ; lecture audio |
| `ACCESS_ADSERVICES_AD_ID` | **`play-services-ads-api 25.4.0`** | Bac à sable de confidentialité Android 13+ |
| `ACCESS_ADSERVICES_ATTRIBUTION` | **`play-services-ads-api 25.4.0`** | Attribution sans identifiant inter-applications |
| `ACCESS_ADSERVICES_TOPICS` | **`play-services-ads-api 25.4.0`** | Centres d'intérêt calculés par le système |
| `com.plateau.jeux.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | **`androidx.core 1.18.0`** | Interne, invisible pour l'utilisateur |

`WAKE_LOCK` mérite une précision : elle ne vient pas seulement de la
publicité. `media3-exoplayer`, que `expo-audio` embarque pour jouer les six
effets sonores, la déclare aussi. Elle resterait donc dans le paquet même
sans AdMob.

> **Deux permissions apparaissent dans l'AAB et pas dans l'APK** :
> `BIND_JOB_SERVICE` et `DUMP`. Ce ne sont pas des droits réclamés par
> l'application mais des attributs `android:permission` posés sur des
> services déclarés par les bibliothèques Google — c'est-à-dire des
> **restrictions** d'accès à ces services. Vérifié par comparaison :
> `aapt dump permissions` sur l'APK issu du même manifeste ne les liste pas.
> `outils/controle-paquet.mjs` les écarte explicitement, avec ce motif.

Aucune des quatre héritées n'est bloquée : les `ACCESS_ADSERVICES_*` sont
précisément le mécanisme par lequel Android remplace le suivi
inter-applications par des mesures calculées côté système. Les retirer
dégraderait la conformité au lieu de l'améliorer.

**`RECORD_AUDIO` est bien absente du paquet livré** — vérifié sur l'APK, pas
sur la configuration.

> **À confirmer sur appareil.** Bloquer les permissions audio de `expo-audio`
> est le bon choix du point de vue de la vie privée, mais aucune compilation
> native n'a encore tourné : *les six sons doivent être réécoutés sur un
> téléphone réel*. Ce point figure au protocole d'essai avec le statut
> NOT RUN.

---

## 3. Ce que Plateau enregistre

Deux clés dans AsyncStorage, sous le préfixe `plateau:v1:`.

| Clé | Contenu | Identifiant personnel ? |
|---|---|---|
| `settings` | Thème, vibrations, sons, animations réduites, affichage des règles | Non |
| `progress` | Records, parties jouées, victoires, défaites, favoris, jeux récents | Non |

Rien n'en sort. Ni nom, ni adresse, ni identifiant d'appareil, ni horodatage
transmis. Effaçable depuis *Réglages → Réinitialiser scores et favoris*, et
détruit à la désinstallation.

---

## 4. Ce que traite le SDK publicitaire

Ce tableau décrit ce que la documentation de Google indique pour le SDK
Mobile Ads. **Il n'a pas été mesuré sur un appareil** : aucune compilation
native n'a encore tourné, donc aucune capture réseau n'existe. C'est une
lecture de documentation, pas une observation.

| Donnée | Quand | Finalité |
|---|---|---|
| Identifiant publicitaire (AAID / IDFA) | Si le consentement le permet | Ciblage, plafonnement de fréquence, mesure |
| Adresse IP | À chaque requête | Acheminement, localisation approximative, conformité régionale |
| Modèle d'appareil, système, langue, taille d'écran | À chaque requête | Format et compatibilité de l'annonce |
| Événements d'affichage | À l'affichage | Facturation et mesure |
| Choix de consentement (chaîne TCF) | Après le formulaire | Base légale transmise aux annonceurs |
| Signaux antifraude | À chaque requête | Détection de clics frauduleux |

Ce que Plateau ne transmet **jamais**, quel que soit le consentement : les
scores, les jeux joués, la progression, les réglages. Ces données ne quittent
pas l'appareil, et le code publicitaire n'y a pas accès — il vit dans
`src/pub/` et ne lit jamais `src/engine/progress`.

### Sans consentement

| Situation | Conséquence |
|---|---|
| Formulaire refusé | Aucune requête publicitaire |
| Formulaire inaccessible (hors ligne) | Aucune requête publicitaire |
| Accepté sans profilage | Requêtes en mode non personnalisé (`requestNonPersonalizedAdsOnly`), SDK initialisé avec `publisherPrivacyPersonalizationState: 'disabled'` |
| Hors zone de recueil | Annonces diffusées selon la configuration AdMob |

Ces quatre cas sont couverts par `npm run test:pub`.

---

## 5. Réponses aux questionnaires

Le détail case par case est dans
[store/README.md](store/README.md#7-déclarations-de-confidentialité). En
résumé :

| Magasin | Ancienne réponse | Réponse correcte aujourd'hui |
|---|---|---|
| Google Play — collecte | Non | **Oui**, via AdMob |
| Google Play — partage | Non | **Oui**, avec Google |
| Google Play — contient des annonces | Non | **Oui** |
| Apple — données collectées | Aucune | **Par des tiers** : identifiant, usage, diagnostics |
| Apple — suivi | Non | **Oui** si la personnalisation est activée |

---

## 6. Ce qui reste à faire, et par qui

| Point | Statut | Qui |
|---|---|---|
| Identité de l'éditeur et adresse de contact dans la politique | `{{EDITEUR}}` et `{{CONTACT}}` — **non remplis, volontairement** | Toi. Rien ne sera inventé |
| Héberger la politique en HTTPS public | À faire | Toi |
| Créer les messages de consentement dans la console AdMob | À faire — sans eux, aucune annonce en Europe | Toi |
| Capture réseau sur appareil réel pour confirmer §4 | **NOT RUN** | À faire pendant le test fermé |
| Vérifier que les sons fonctionnent après le blocage des permissions audio | **NOT RUN** | À faire sur la première compilation native |
