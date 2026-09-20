/**
 * Contrôle des affirmations commerciales.
 *
 *   node outils/controle-fiches.mjs
 *
 * Né d'un défaut réel : `docs/store/README.md` promettait « Chaque jeu
 * propose trois niveaux de difficulté » alors que vingt-sept jeux sur cent
 * en proposent. Une fiche de magasin qui ment fait rejeter l'application, et
 * personne ne relit une description de deux mille signes à chaque commit.
 *
 * Ce script compare donc les chiffres écrits dans les fiches à ce que le code
 * fait vraiment, et refuse les formules devenues fausses depuis l'arrivée de
 * la publicité.
 */
import fs from 'node:fs';
import { lireCatalogue } from './lib/catalogue.mjs';

const problemes = [];
const ajouter = (ou, quoi) => problemes.push(`  ${ou} : ${quoi}`);

// ----------------------------------------------- ce que le code fait -------

/**
 * Le catalogue est relu par `outils/lib/catalogue.mjs`, partagé avec
 * `matrice.mjs`. Deux définitions concurrentes donnaient deux chiffres
 * différents pour « jeux à trois niveaux » — 27 ici, 30 là — et l'un des
 * deux partait dans une description de magasin.
 */
const jeux = lireCatalogue();
const DOSSIERS = [...new Set(jeux.map((j) => j.dossier))];

const reel = {
  total: jeux.length,
  parCategorie: Object.fromEntries(
    DOSSIERS.map((d) => [d, jeux.filter((j) => j.dossier === d).length]),
  ),
  troisNiveaux: jeux.filter((j) => j.niveaux).length,
  duo: jeux.filter((j) => j.duo).length,
  deuxJoueurs: jeux.filter((j) => j.joueurs !== '1').length,
};

// ------------------------------------------- les fiches des magasins -------

const fiche = fs.readFileSync('docs/store/README.md', 'utf8');
const politique = fs.readFileSync('docs/store/confidentialite.html', 'utf8');

/**
 * Les textes réellement livrés aux magasins, c'est-à-dire les blocs encadrés
 * de ``` dans la fiche : description courte, description longue, mots-clés.
 *
 * La distinction compte. Le reste du document explique, nuance et cite les
 * anciennes formules — y compris pour dire qu'elles étaient fausses. Traquer
 * un mot dans une explication ferait échouer le contrôle pour de mauvaises
 * raisons, et on finirait par le désactiver.
 */
const textesLivres = [...fiche.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');

/** Le résumé en tête de la politique, et la description de la page. */
const resumePolitique = [
  (politique.match(/<meta\s+name="description"[\s\S]*?content="([\s\S]*?)"/) ?? [])[1] ?? '',
  (politique.match(/<p class="resume">([\s\S]*?)<\/p>/) ?? [])[1] ?? '',
].join('\n');

/**
 * Formules devenues fausses le jour où la publicité est entrée. Les laisser
 * traîner dans une fiche, c'est une déclaration inexacte auprès d'Apple et de
 * Google — motif de retrait, pas seulement de refus.
 */
const PERIMEES = [
  ['sans publicité', /sans\s+publicité/i],
  ['aucune publicité', /aucune\s+publicité/i],
  ['pas de publicité', /pas\s+de\s+publicité/i],
  ['ni publicité', /ni\s+publicité/i],
  ['aucune donnée collectée', /aucune\s+donnée\s+(n’est\s+)?collectée/i],
  ['aucune donnée transmise', /aucune\s+donnée\s+(n’est\s+)?transmise/i],
  ['ne transmet rien', /ne\s+transmet\s+rien/i],
  ['aucun identifiant publicitaire', /ni\s+identifiant\s+publicitaire/i],
];

for (const [nom, motif] of PERIMEES) {
  if (motif.test(textesLivres)) {
    ajouter('docs/store/README.md (texte livré)', `affirmation périmée « ${nom} »`);
  }
  if (motif.test(resumePolitique)) {
    ajouter('docs/store/confidentialite.html (résumé)', `affirmation périmée « ${nom} »`);
  }
}

/**
 * Deux champs ne peuvent pas être remplis par un programme : l'identité de
 * l'éditeur et son adresse de contact. Les inventer serait pire que les
 * laisser vides.
 *
 * Ils portent donc un jeton unique et reconnaissable. Le contrôle vérifie
 * deux choses : qu'il ne reste **aucun autre** marqueur vague, et que les
 * jetons restants sont bien signalés. Leur présence n'arrête pas la chaîne
 * de vérification — le code est correct — mais elle interdit la publication,
 * et le script le dit haut et fort.
 */
const JETONS = ['{{EDITEUR}}', '{{CONTACT}}'];
const restants = JETONS.filter((j) => politique.includes(j));

if (/À COMPLÉTER|TODO|XXX|LOREM/i.test(politique)) {
  ajouter(
    'docs/store/confidentialite.html',
    'contient un marqueur vague — utiliser les jetons {{EDITEUR}} / {{CONTACT}}',
  );
}

// La politique doit maintenant nommer le partenaire et le cadre du consentement.
for (const attendu of ['AdMob', 'consentement', 'Google']) {
  if (!politique.includes(attendu)) {
    ajouter('docs/store/confidentialite.html', `ne mentionne pas « ${attendu} »`);
  }
}

// ---------------------------------------- les chiffres doivent coller -------

/** Cherche « N jeux se jouent à deux » et compagnie, en chiffres ou en lettres. */
const LETTRES = {
  dix: 10, vingt: 20, 'vingt et un': 21, 'vingt-et-un': 21, 'vingt-deux': 22,
  'vingt-trois': 23, 'vingt-quatre': 24, 'vingt-cinq': 25, 'vingt-six': 26, 'vingt-sept': 27, cent: 100,
};

function nombreEcrit(texte) {
  const n = Number(texte);
  if (!Number.isNaN(n)) return n;
  return LETTRES[texte.toLowerCase()] ?? null;
}

const motifDuo = /([\wÀ-ÿ-]+(?:\s+et\s+[\wÀ-ÿ]+)?)\s+jeux\s+se\s+jouent\s+à\s+deux/i;
const trouveDuo = textesLivres.match(motifDuo);
if (!trouveDuo) {
  ajouter('docs/store/README.md', 'la phrase sur les jeux à deux a disparu — chiffre invérifiable');
} else {
  const annonce = nombreEcrit(trouveDuo[1]);
  if (annonce !== reel.duo) {
    ajouter(
      'docs/store/README.md',
      `annonce ${trouveDuo[1]} jeux à deux, le code en a ${reel.duo}`,
    );
  }
}

if (/[Cc]haque jeu propose trois niveaux/.test(textesLivres)) {
  ajouter(
    'docs/store/README.md',
    `« chaque jeu propose trois niveaux » est faux : ${reel.troisNiveaux} jeux sur ${reel.total}`,
  );
}

const motifNiveaux = /([\wÀ-ÿ-]+(?:\s+et\s+[\wÀ-ÿ]+)?)\s+jeux\s+proposent\s+trois\s+niveaux/i;
const trouveNiveaux = textesLivres.match(motifNiveaux);
if (trouveNiveaux) {
  const annonce = nombreEcrit(trouveNiveaux[1]);
  if (annonce !== reel.troisNiveaux) {
    ajouter(
      'docs/store/README.md',
      `annonce ${trouveNiveaux[1]} jeux à trois niveaux, le code en a ${reel.troisNiveaux}`,
    );
  }
}

// Les totaux par catégorie apparaissent dans la description longue.
for (const [categorie, attendu] of Object.entries(reel.parCategorie)) {
  const mot = { plateau: 'jeux de plateau', cartes: 'jeux de cartes', logique: 'casse-têtes',
    arcade: 'jeux d’arcade', des: 'jeux de dés', papier: 'jeux de papier-crayon' }[categorie];
  const motif = new RegExp(`(\\d+)\\s+${mot.replace(/[’]/g, '[’\']')}`, 'i');
  const trouve = textesLivres.match(motif);
  if (!trouve) ajouter('docs/store/README.md', `le décompte « ${mot} » est introuvable`);
  else if (Number(trouve[1]) !== attendu) {
    ajouter('docs/store/README.md', `annonce ${trouve[1]} ${mot}, le code en a ${attendu}`);
  }
}

if (reel.total !== 100) {
  ajouter('src/games', `le catalogue compte ${reel.total} jeux et non 100`);
}

// --------------------------------------- cohérence de la configuration -----

const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const description = appJson.expo.description ?? '';
for (const [nom, motif] of PERIMEES) {
  if (motif.test(description)) {
    ajouter('app.json', `la description contient l’affirmation périmée « ${nom} »`);
  }
}

// --------------------------------------------------------------- verdict ---

console.log(`jeux analysés : ${reel.total}`);
console.log(
  `trois niveaux de difficulté : ${reel.troisNiveaux} · mode duo : ${reel.duo} · ` +
    `deux joueurs ou plus dans meta : ${reel.deuxJoueurs}`,
);

if (restants.length > 0) {
  console.log('');
  console.log(
    `PUBLICATION BLOQUÉE : ${restants.join(' et ')} restent à remplir dans ` +
      'docs/store/confidentialite.html. Seul l’éditeur peut fournir ces valeurs.',
  );
}

if (problemes.length === 0) {
  console.log('\nLES FICHES CORRESPONDENT AU PRODUIT');
  process.exit(0);
}

console.error(`\n${problemes.length} AFFIRMATIONS À CORRIGER :\n${problemes.join('\n')}`);
process.exit(1);
