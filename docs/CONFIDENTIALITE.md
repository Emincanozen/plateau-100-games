# Politique de confidentialité — Plateau

**Dernière mise à jour : 20 septembre 2026.**

> **À compléter avant publication.** Deux éléments manquent, et eux seuls :
> le **nom du responsable** et une **adresse de contact**. Ils sont marqués
> `[À COMPLÉTER]` ci-dessous. Apple et Google exigent tous deux que cette
> politique soit accessible à une **adresse web publique** : le fichier
> `docs/store/confidentialite.html` en est la version prête à héberger.

---

## En un paragraphe

Plateau est une application de jeux qui fonctionne entièrement sur votre
appareil. Elle **ne collecte aucune donnée personnelle**, **ne transmet rien**
sur Internet, et **ne contient ni publicité, ni traceur, ni outil de mesure
d'audience**. Elle n'a besoin d'aucun compte.

---

## 1. Qui édite l'application

- **Responsable** : [À COMPLÉTER — nom ou raison sociale]
- **Contact** : [À COMPLÉTER — adresse électronique]

---

## 2. Quelles données sont traitées

### 2.1 Données enregistrées sur votre appareil

L'application écrit deux entrées dans le stockage local de l'appareil
(`AsyncStorage`), sous le préfixe `plateau:v1:` :

| Clé | Contenu |
|---|---|
| `plateau:v1:settings` | Vos réglages : thème clair ou sombre, vibrations, sons, animations réduites, affichage automatique des règles. |
| `plateau:v1:progress` | Votre progression : meilleurs scores, parties jouées, victoires et défaites, jeux mis en favori. |

Ces données :

- **ne quittent jamais l'appareil** ;
- ne contiennent **aucune information permettant de vous identifier** — ni nom,
  ni adresse, ni identifiant d'appareil, ni adresse IP ;
- sont supprimées quand vous désinstallez l'application ;
- peuvent être effacées à tout moment depuis **Réglages → Remettre les
  statistiques à zéro**, sans désinstaller.

### 2.2 Données transmises

**Aucune.** L'application ne comporte aucun code de communication réseau.

Ce point a été vérifié sur le paquet de production réellement livré : il ne
contient aucun appel `XMLHttpRequest`, aucun `navigator.sendBeacon`, aucune
adresse de serveur, et aucune bibliothèque de mesure d'audience, de publicité
ou de rapport d'incident.

### 2.3 Composants tiers

L'application s'appuie sur des bibliothèques libres : React Native, Expo, et
quelques modules d'interface. Aucune ne communique avec un serveur dans la
configuration retenue. En particulier, l'application **n'embarque pas** :

- de mesure d'audience ou d'analytique,
- de régie publicitaire,
- de rapport d'incident automatique,
- de mise à jour à distance du code.

---

## 3. Permissions demandées

| Plateforme | Permission | Pourquoi |
|---|---|---|
| Android | `VIBRATE` | Retour haptique lors d'un coup joué. Désactivable dans les réglages. |
| iOS | aucune | — |

L'application ne demande ni la localisation, ni les contacts, ni l'appareil
photo, ni le microphone, ni les notifications, ni l'identifiant publicitaire.

---

## 4. Enfants

L'application ne collectant aucune donnée, elle peut être utilisée par des
enfants sans traitement particulier. Elle ne comporte ni achat intégré, ni
publicité, ni lien sortant vers Internet.

---

## 5. Vos droits

Puisque aucune donnée personnelle n'est collectée ni transmise, il n'existe
aucun fichier vous concernant du côté de l'éditeur. Les droits d'accès, de
rectification, d'effacement et de portabilité prévus par le RGPD portent donc
sur les seules données de votre appareil, que vous contrôlez entièrement :

- **Consulter** : Réglages → Statistiques.
- **Effacer** : Réglages → Remettre les statistiques à zéro, ou désinstaller
  l'application.

Pour toute question : [À COMPLÉTER — adresse électronique].

---

## 6. Modifications

Toute évolution de cette politique sera publiée à la même adresse, avec une
nouvelle date de mise à jour. Si une version future de l'application venait à
transmettre des données — ce qui n'est pas prévu — cette politique serait
modifiée **avant** la mise en ligne de cette version.

---

## Réponses aux questionnaires des magasins

Ces réponses découlent des constats ci-dessus. Elles restent à **confirmer par
vous** dans les formulaires officiels : ni Apple ni Google ne les ont validées
à ce stade.

### Google Play — « Sécurité des données »

| Question | Réponse |
|---|---|
| L'application collecte-t-elle des données ? | **Non** |
| L'application partage-t-elle des données ? | **Non** |
| Les données sont-elles chiffrées en transit ? | Sans objet — aucune transmission |
| L'utilisateur peut-il demander la suppression de ses données ? | Sans objet — tout est local et effaçable dans l'application |
| Engagement « Play Families » | Non applicable sauf si la fiche vise explicitement les enfants |

### Apple — « Confidentialité des données »

| Question | Réponse |
|---|---|
| Données collectées | **Aucune** (« Data Not Collected ») |
| Suivi publicitaire | **Non** |
| Identifiant publicitaire | Non utilisé |
| `ITSAppUsesNonExemptEncryption` | `false`, déjà déclaré dans `app.json` |
