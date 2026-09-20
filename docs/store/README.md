# Fiches des magasins — Plateau

Tout ce qui est prêt à copier dans App Store Connect et la Play Console, et
tout ce qui manque encore.

> **Aucun élément de ce dossier n'a été validé par Apple ou Google.** Les
> classifications et les déclarations proposées sont des réponses argumentées
> à remplir dans leurs questionnaires officiels, pas des décisions acquises.

> **Les chiffres de cette page sont vérifiés à chaque `npm run verifier`**, par
> `outils/controle-fiches.mjs`. Ce contrôle existe parce que la version
> précédente promettait « chaque jeu propose trois niveaux de difficulté »
> alors que vingt-sept jeux sur cent en proposent. Une fiche inexacte fait
> rejeter l'application ; désormais, elle fait échouer la chaîne de
> vérification d'abord.

| Fichier | Contenu |
|---|---|
| `README.md` | Ce document : textes, catégories, déclarations, ce qui manque |
| `confidentialite.html` | La politique de confidentialité, page statique prête à héberger |

---

## 1. Nom

**Plateau**

Identifiant d'application : `com.plateau.jeux` sur les deux plateformes.

> **À vérifier avant de dépendre de ce nom.** « Plateau » est un mot courant :
> une recherche sur l'App Store et sur Google Play s'impose, ainsi qu'une
> vérification à l'INPI si tu comptes le protéger. Ce n'est pas un avis
> juridique, seulement une précaution. Un nom de repli du type « Plateau —
> 100 jeux » lève l'ambiguïté et améliore le référencement.

---

## 2. Description courte

**Google Play — 80 caractères maximum**

```
100 jeux en une seule application. Jouables hors ligne, sans compte.
```

*(68 caractères.)*

**App Store — sous-titre, 30 caractères maximum**

```
100 jeux, jouables hors ligne
```

*(29 caractères.)*

---

## 3. Description longue

À coller telle quelle (Google Play accepte 4000 caractères ; ce texte en fait
environ 1900).

```
Cent jeux réunis dans une seule application.

Pas de compte à créer, pas de connexion à attendre pour jouer. Vous ouvrez,
vous jouez — y compris en avion ou au sous-sol.

CE QU'IL Y A DEDANS

• 20 jeux de plateau — échecs, backgammon, dames, othello, moulin, hex,
  quarto, amazones, petits chevaux, jeu de l'oie…
• 20 jeux de cartes — solitaire, FreeCell, araignée, yukon, canfield,
  pyramide, scopa, président, rami, blackjack…
• 20 casse-têtes — sudoku, démineur, 2048, nonogram, sokoban, binairo,
  futoshiki, hitori, mahjong, embouteillage…
• 20 jeux d'arcade — serpent, briques, envahisseurs, astéroïdes, pong,
  casse-briques, labyrinthe aux fantômes…
• 10 jeux de dés — yams, farkle, 421, dés menteurs, craps, zanzibar…
• 10 jeux de papier-crayon — pendu, motus, bataille navale, boggle,
  mots mêlés, points et carrés…

DE VRAIS ADVERSAIRES

Les ordinateurs ne trichent pas et ne jouent pas au hasard. Le moteur d'échecs
applique les règles complètes — roque, prise en passant, promotion, pat — et
réfléchit vraiment. Le backgammon pèse chaque coup sur les vingt-et-un lancers
possibles de l'adversaire. Vingt-sept jeux proposent trois niveaux de
difficulté ; les autres se règlent par la taille de la grille, le nombre de
pions ou le nombre de couleurs.

À DEUX SUR LE MÊME TÉLÉPHONE

Vingt-deux jeux se jouent à deux en se passant l'appareil, et trois — le jeu
de l'oie, les petits chevaux, serpents et échelles — se jouent jusqu'à quatre.
Rien à installer chez l'autre, aucune connexion.

VOS DONNÉES

Vos scores, vos favoris et vos réglages restent sur votre appareil et ne sont
envoyés nulle part. L'application est gratuite et financée par la publicité :
les annonces sont fournies par Google AdMob, qui peut de son côté utiliser un
identifiant publicitaire. Là où la loi l'exige, un écran de consentement vous
laisse choisir, et ce choix reste modifiable dans les réglages.

ET AUSSI

• Thème clair et sombre, qui suit celui du système
• Les règles de chaque jeu, affichées au premier lancement
• Vos records et vos statistiques, conservés d'une session à l'autre
• Les cent jeux fonctionnent hors ligne ; seules les publicités ont besoin
  d'une connexion, et leur absence ne bloque jamais une partie
```

---

## 4. Mots-clés

**App Store — 100 caractères maximum, séparés par des virgules, sans espaces**

```
jeux,solitaire,echecs,sudoku,demineur,cartes,backgammon,dames,yams,motus,puzzle,hors ligne,2048
```

*(95 caractères.)*

**Google Play** n'a pas de champ de mots-clés : le référencement se fait sur le
titre et la description, où les termes ci-dessus figurent déjà.

---

## 5. Catégories proposées

| Magasin | Catégorie principale | Secondaire |
|---|---|---|
| App Store | Jeux → Casse-tête | Jeux → Jeux de société |
| Google Play | Jeux → Casse-tête | — |

---

## 6. Classification par âge — proposition à confirmer

L'application ne contient ni violence, ni contenu sensible, ni achat intégré,
ni lien sortant, ni interaction entre utilisateurs. **Elle contient de la
publicité**, ce qui se déclare séparément de la classification.

| Système | Proposition | Sur quoi elle repose |
|---|---|---|
| Apple | **4+** | Aucun contenu réservé aux adultes |
| Google Play (IARC) | **PEGI 3 / Tout public** | Aucune catégorie de contenu déclenchée |
| Google Play — « Contient des annonces » | **Oui** | Obligatoire, et vérifié par Google |

**Deux points à trancher toi-même dans les questionnaires.**

1. **Les jetons de casino.** Le blackjack, le vidéo poker et le craps mettent
   en scène des jetons. Il n'y a **ni argent réel, ni achat, ni gain
   convertible** — ce sont des jetons de partie remis à zéro à chaque fois.
   Les questionnaires demandent néanmoins si l'application « simule des jeux
   d'argent ». Une réponse affirmative fait monter la classification (souvent
   12+ chez Apple, PEGI 12 chez IARC).

2. **Le public cible.** Si tu déclares dans la Play Console un public cible
   incluant les moins de 13 ans, l'application entre dans le programme
   « Conçu pour les familles » : la publicité personnalisée devient interdite,
   et seules les régies certifiées peuvent diffuser. Il faudrait alors passer
   `PUBLIC_ENFANT` à `true` dans `src/pub/config.ts`. La configuration
   actuelle vise un **public général**, avec un classement de contenu
   publicitaire limité à « G » (tout public).

---

## 7. Déclarations de confidentialité

Le raisonnement complet et les preuves sont dans
[../CONFIDENTIALITE.md](../CONFIDENTIALITE.md), et l'architecture publicitaire
dans [../MONETISATION.md](../MONETISATION.md).

> **Ces réponses ont changé avec l'arrivée de la publicité.** La version
> précédente déclarait « aucune donnée collectée », ce qui n'est plus exact :
> Plateau ne collecte toujours rien, mais le SDK publicitaire de Google, lui,
> traite des données. Les magasins demandent de déclarer **aussi** ce que font
> les bibliothèques tierces intégrées.

### Google Play — « Sécurité des données »

| Question | Réponse | Justification |
|---|---|---|
| L'application collecte-t-elle des données ? | **Oui** | Uniquement via le SDK Google AdMob |
| Données partagées avec des tiers ? | **Oui** | Avec Google, pour la diffusion publicitaire |
| Type : identifiants d'appareil / publicitaires | **Collecté et partagé** | Finalité : publicité ; non obligatoire ; retirable via le formulaire de consentement |
| Type : informations sur l'application et ses performances | **Collecté** | Diagnostics du SDK publicitaire |
| Type : localisation approximative | **Vérifier dans AdMob** | Le SDK peut en déduire une depuis l'adresse IP |
| Données chiffrées en transit | **Oui** | HTTPS, imposé par le SDK Google |
| Suppression des données sur demande | **Via Google** | Lien vers la politique de Google dans la page de confidentialité |
| Progression et scores du joueur | **Non collecté** | Reste sur l'appareil, jamais transmis |

> Google publie un guide de correspondance entre les données traitées par
> AdMob et les cases de ce formulaire. **Relis-le au moment de remplir la
> fiche** : ces catégories évoluent. Le tableau ci-dessus est une proposition
> argumentée, pas une déclaration validée.

### Apple — « Confidentialité des données »

| Question | Réponse |
|---|---|
| Données collectées par l'éditeur | **Aucune** |
| Données collectées par des tiers | **Oui** — identifiant de l'appareil, données d'usage, diagnostics, via Google AdMob |
| Utilisation : publicité tierce | **Oui** |
| Suivi (*Tracking*) | **Oui si la publicité personnalisée est activée** — l'application déclare `NSUserTrackingUsageDescription` et le formulaire UMP de Google peut afficher la demande ATT |
| Données liées à l'identité de l'utilisateur | **Non** |
| Chiffrement non exempté | `false`, déjà déclaré dans `app.json` |

---

## 8. Éléments graphiques

### Prêts

| Élément | Où | Format |
|---|---|---|
| Icône 1024 × 1024 sans transparence | `assets/icon.png` | Convient telle quelle à l'App Store |
| Icône adaptative Android | `assets/android-icon-*.png` | Avant, arrière, monochrome |
| Écran de lancement | `assets/splash-icon.png` | Variantes claire et sombre via le plugin |

Régénérables par `npm run assets:icones`.

### Manquants

| Élément | Exigé par | Comment le produire |
|---|---|---|
| Icône 512 × 512 | Google Play | Redimensionner `assets/icon.png` |
| Bandeau 1024 × 500 | Google Play | À composer |
| Captures iPhone 6,7″ | App Store | Simulateur iOS, ou un iPhone réel |
| Captures iPad 13″ | App Store — obligatoire car `supportsTablet` est activé | Simulateur iPad |
| Captures téléphone Android | Google Play, au moins 2 | Émulateur ou téléphone |
| Captures tablette Android | Google Play, si la fiche vise les tablettes | Émulateur |

**Les captures doivent montrer l'application réelle.** Ne pas fabriquer de
maquette montrant une interface qui n'existe pas : les deux magasins refusent
la fiche, et Apple le vérifie à la revue. **Ne pas y faire figurer de
publicité de test** : un bandeau « Test Ad » sur une capture de magasin est un
motif de refus.

Suggestion de séquence, une capture par idée :

1. Le catalogue, filtre « Tous », qui montre les 100 jeux
2. Les échecs en cours de partie
3. Un solitaire
4. Le sudoku
5. Un jeu d'arcade en mouvement
6. L'écran des réglages, thème sombre

---

## 9. Informations qui manquent encore

| Élément | Pourquoi il manque | Qui peut le fournir |
|---|---|---|
| Nom du responsable de publication | Identité légale | **Toi** |
| Adresse électronique de contact | Obligatoire sur les deux fiches et dans la politique | **Toi** |
| Adresse web de la politique de confidentialité | Il faut héberger `confidentialite.html` | **Toi** |
| Compte AdMob et identifiants de production | Sans eux, aucune publicité en production | **Toi** — voir [../MONETISATION.md](../MONETISATION.md) |
| Compte Apple Developer | 99 $ par an | **Toi** |
| Compte Google Play Console | 25 $ une fois | **Toi** |
| Captures d'écran | Production sur appareil ou simulateur | À faire une fois un build installé |
