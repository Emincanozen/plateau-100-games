# Fiches des magasins — Plateau

Tout ce qui est prêt à copier dans App Store Connect et la Play Console, et
tout ce qui manque encore.

> **Aucun élément de ce dossier n'a été validé par Apple ou Google.** Les
> classifications et les déclarations proposées sont des réponses argumentées
> à remplir dans leurs questionnaires officiels, pas des décisions acquises.

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
100 jeux en une application. Hors ligne, sans compte, sans publicité.
```

*(69 caractères.)*

**App Store — sous-titre, 30 caractères maximum**

```
100 jeux, zéro connexion
```

*(24 caractères.)*

---

## 3. Description longue

À coller telle quelle (Google Play accepte 4000 caractères ; ce texte en fait
environ 1900).

```
Cent jeux réunis dans une seule application, et rien d'autre.

Pas de compte à créer, pas de connexion à attendre, pas de publicité qui
s'intercale entre deux parties. Vous ouvrez, vous jouez.

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
possibles de l'adversaire. Chaque jeu propose trois niveaux de difficulté.

À DEUX SUR LE MÊME TÉLÉPHONE

Vingt-deux jeux se jouent à deux, en se passant l'appareil. Rien à installer
chez l'autre, aucune connexion.

RESPECTUEUSE DE VOTRE VIE PRIVÉE

Aucune donnée collectée. Aucune donnée transmise. Aucune publicité, aucun
traceur, aucune mesure d'audience. Vos scores et vos favoris restent sur votre
appareil, et disparaissent si vous désinstallez.

ET AUSSI

• Thème clair et sombre, qui suit celui du système
• Les règles de chaque jeu, affichées au premier lancement
• Vos records et vos statistiques, conservés d'une session à l'autre
• Fonctionne entièrement hors ligne, en avion comme au sous-sol
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
ni publicité, ni lien sortant, ni interaction entre utilisateurs.

| Système | Proposition | Sur quoi elle repose |
|---|---|---|
| Apple | **4+** | Aucun contenu réservé aux adultes |
| Google Play (IARC) | **PEGI 3 / Tout public** | Aucune catégorie de contenu déclenchée |

**Nuance à trancher toi-même dans le questionnaire.** Le blackjack, le vidéo
poker et le craps mettent en scène des jetons. Il n'y a **ni argent réel, ni
achat, ni gain convertible** — ce sont des jetons de partie remis à zéro à
chaque fois. Les questionnaires demandent néanmoins si l'application
« simule des jeux d'argent ». Une réponse affirmative fait monter la
classification (souvent 12+ chez Apple, PEGI 12 chez IARC). Réponds selon la
formulation exacte du questionnaire au moment où tu le remplis : les deux
magasins ont fait évoluer cette question ces dernières années.

---

## 7. Déclarations de confidentialité

Le raisonnement complet et les preuves sont dans
[../CONFIDENTIALITE.md](../CONFIDENTIALITE.md).

### Google Play — « Sécurité des données »

| Question | Réponse |
|---|---|
| Collecte de données | **Non** |
| Partage de données | **Non** |
| Chiffrement en transit | Sans objet |
| Suppression des données sur demande | Sans objet : tout est local et effaçable dans l'application |

### Apple — « Confidentialité des données »

| Question | Réponse |
|---|---|
| Données collectées | **Aucune** (« Data Not Collected ») |
| Suivi | **Non** |
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
la fiche, et Apple le vérifie à la revue.

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
| Adresse électronique de contact | Obligatoire sur les deux fiches | **Toi** |
| Adresse web de la politique de confidentialité | Il faut héberger `confidentialite.html` | **Toi** |
| Compte Apple Developer | 99 $ par an | **Toi** |
| Compte Google Play Console | 25 $ une fois | **Toi** |
| Captures d'écran | Production sur appareil ou simulateur | À faire une fois un build installé |
