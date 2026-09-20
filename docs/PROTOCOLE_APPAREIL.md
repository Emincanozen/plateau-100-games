# Protocole d'essai sur appareil

**Statut : NOT RUN.** Aucun point de ce document n'a été exécuté. Il n'y a
dans ce dépôt aucun résultat d'essai sur téléphone, et il ne faut en inventer
aucun.

Ce protocole existe parce que trois choses ne peuvent pas être prouvées
autrement : le comportement du SDK publicitaire, le rendu réel de
l'application, et les conséquences des permissions bloquées.

---

## Ce qu'il faut avant de commencer

| Élément | Pourquoi | Statut |
|---|---|---|
| Compte Expo (`eas login`) | Sans lui, aucune compilation | **BLOCKED** — identifiants de l'utilisateur |
| Compilation de développement Android | Expo Go ne contient pas le module publicitaire | BLOCKED |
| Compte AdMob | Sans identifiants, la production n'affiche rien ; les blocs de test suffisent pour ce protocole | BLOCKED |
| Un téléphone Android | — | — |
| Un iPhone, ou un Mac avec simulateur | Aucun projet iOS n'a pu être produit sous Windows | BLOCKED |

```bash
eas login
eas init
eas build --profile development --platform android
```

Installer le fichier obtenu, puis `npx expo start --dev-client`.

> **Pendant tout ce protocole, les identifiants de test de Google sont actifs**
> (`__DEV__` est vrai). Les annonces affichent « Test Ad ». C'est voulu :
> cliquer sur une vraie annonce dans sa propre application fait fermer un
> compte AdMob.

---

## 1. Démarrage et navigation

| # | À faire | Attendu | Résultat |
|---|---|---|---|
| 1.1 | Démarrage à froid, application tuée | Catalogue affiché en moins de 3 s | NOT RUN |
| 1.2 | Démarrage **en mode avion** | Catalogue affiché, aucun blocage, aucune attente | NOT RUN |
| 1.3 | Rechercher « échecs », ouvrir | Le jeu s'ouvre | NOT RUN |
| 1.4 | Revenir au catalogue | Retour immédiat | NOT RUN |
| 1.5 | Filtres, favoris, section « reprendre » | Fonctionnent | NOT RUN |
| 1.6 | Réglages : thème clair, sombre, système | Changement immédiat | NOT RUN |

## 2. Les cent jeux

Ouvrir chaque jeu et **jouer une partie complète** : début, coups, fin de
partie, enregistrement du record, bouton recommencer, mode duo s'il existe.

La liste jeu par jeu est dans
[VALIDATION_100_JEUX.md](VALIDATION_100_JEUX.md). La sonde de navigateur
couvre le chargement, le gel, la réaction et la relance ; **elle ne couvre
aucune fin de partie**. C'est le gros du travail de cette section.

| # | À faire | Attendu | Résultat |
|---|---|---|---|
| 2.1 | Une partie complète sur chacun des 100 jeux | Fin de partie atteinte, record enregistré | NOT RUN |
| 2.2 | Mode duo sur les 22 jeux qui en ont un | Alternance correcte | NOT RUN |
| 2.3 | Les trois niveaux sur les 27 jeux qui en ont | L'adversaire change réellement de force | NOT RUN |

## 3. Sons et vibrations — **priorité**

Sept permissions Android ont été **retirées** du manifeste, dont
`RECORD_AUDIO` et `MODIFY_AUDIO_SETTINGS`, apportées par `expo-audio`. Le
raisonnement est dans [CONFIDENTIALITE.md](CONFIDENTIALITE.md) §2. Ce choix
est bon pour la vie privée, mais **il n'a jamais été compilé**.

| # | À faire | Attendu | Résultat |
|---|---|---|---|
| 3.1 | Jouer un coup, réglage « Sons » actif | Le son part | NOT RUN |
| 3.2 | Les six sons : léger, moyen, lourd, succès, avertissement, erreur | Tous audibles | NOT RUN |
| 3.3 | Enchaîner vingt coups très vite | Aucun blocage, aucun plantage | NOT RUN |
| 3.4 | Couper « Sons » | Silence, les vibrations restent | NOT RUN |
| 3.5 | Couper « Vibrations » | Plus de vibration, le son reste | NOT RUN |
| 3.6 | Jouer pendant un appel ou de la musique | Pas de vol de focus audio brutal | NOT RUN |

> **Si les sons ne partent plus**, la cause la plus probable est le blocage de
> `MODIFY_AUDIO_SETTINGS`. La retirer de `android.blockedPermissions` dans
> `app.json`, recompiler, et la documenter dans la politique.

## 4. Publicité — **le cœur de cet essai**

| # | À faire | Attendu | Résultat |
|---|---|---|---|
| 4.1 | Premier lancement, appareil en Europe | Le formulaire de consentement s'affiche | NOT RUN |
| 4.2 | **Accepter** | Bannière de test en bas du catalogue | NOT RUN |
| 4.3 | Bannière : mesurer l'espace | Elle ne recouvre aucune fiche, aucun bouton | NOT RUN |
| 4.4 | Toucher juste au-dessus de la bannière | On atteint la fiche visée, pas l'annonce | NOT RUN |
| 4.5 | Ouvrir un jeu | **Aucune bannière, aucune annonce** | NOT RUN |
| 4.6 | Jouer trois parties, puis quitter le jeu | Un interstitiel de test apparaît, puis retour au catalogue | NOT RUN |
| 4.7 | Quitter un jeu juste après | **Aucun interstitiel** — le délai de trois minutes court | NOT RUN |
| 4.8 | Fermer l'interstitiel en cours de chargement | Aucun plantage, retour normal | NOT RUN |
| 4.9 | Mode avion, quitter un jeu | Sortie immédiate, aucune attente, aucune erreur | NOT RUN |
| 4.10 | Mode avion, ouvrir le catalogue | Pas de bannière, pas de rectangle vide | NOT RUN |
| 4.11 | Mettre en arrière-plan 5 min, revenir | Application intacte, bannière rechargée | NOT RUN |
| 4.12 | Mettre en arrière-plan **1 h**, revenir | L'annonce périmée est remplacée, pas affichée telle quelle | NOT RUN |
| 4.13 | Réglages → Choix de confidentialité publicitaire | Le formulaire se rouvre | NOT RUN |
| 4.14 | **Refuser**, revenir au catalogue | **Plus aucune publicité**, nulle part | NOT RUN |
| 4.15 | Après refus, ouvrir et jouer dix jeux | Tout fonctionne exactement pareil | NOT RUN |
| 4.16 | Capture réseau (proxy ou outil système) | Aucune requête hors domaines Google publicitaires | NOT RUN |
| 4.17 | Sur iOS : la demande ATT | S'affiche si le message ATT est configuré dans AdMob | NOT RUN |
| 4.18 | Sur iOS : refuser ATT | Annonces non personnalisées, jeux intacts | NOT RUN |

## 5. Sauvegarde et reprise

| # | À faire | Attendu | Résultat |
|---|---|---|---|
| 5.1 | Faire un record, tuer l'application, rouvrir | Le record est là | NOT RUN |
| 5.2 | Mettre un favori, redémarrer le téléphone | Le favori est là | NOT RUN |
| 5.3 | Réglages → Réinitialiser | Tout est effacé, y compris après redémarrage | NOT RUN |
| 5.4 | Arrière-plan pendant une partie, revenir | La partie est là où on l'a laissée | NOT RUN |

## 6. Écrans et formats

| # | À faire | Attendu | Résultat |
|---|---|---|---|
| 6.1 | Petit téléphone (≈ 5″) | Aucun plateau coupé, aucun texte tronqué | NOT RUN |
| 6.2 | Grand téléphone (≈ 6,7″) | Mise en page cohérente | NOT RUN |
| 6.3 | Tablette | `supportsTablet` est actif : Apple contrôlera l'iPad | NOT RUN |
| 6.4 | Grande taille de police système | Rien d'illisible ni de chevauché | NOT RUN |
| 6.5 | Encoche et barre de gestes | Rien sous l'encoche, rien sous la barre | NOT RUN |

## 7. Performance et stabilité

| # | À faire | Attendu | Résultat |
|---|---|---|---|
| 7.1 | Jeux d'arcade : serpent, tetris, astéroïdes, flappy | Animation fluide, pas de saccade | NOT RUN |
| 7.2 | Échecs, niveau Expert | Le coup arrive en quelques secondes, l'interface ne gèle pas | NOT RUN |
| 7.3 | Une heure d'utilisation continue | Pas de dérive mémoire, pas de ralentissement | NOT RUN |
| 7.4 | Ouvrir les 100 jeux à la suite | Aucun plantage | NOT RUN |
| 7.5 | Relever la consommation de batterie | Pas d'anomalie | NOT RUN |

---

## Comment consigner les résultats

Remplacer `NOT RUN` par `PASS`, `FAIL` ou `BLOCKED` dans la colonne
« Résultat », et ouvrir une ligne dans le journal de
[ANNEXE.md](ANNEXE.md) pour chaque `FAIL`. **Ne jamais écrire `PASS` sur une
ligne qui n'a pas été exécutée** : un essai non fait se note `NOT RUN`, et
c'est une information utile.
