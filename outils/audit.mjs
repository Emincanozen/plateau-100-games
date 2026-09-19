/**
 * Contrôle statique du catalogue.
 *
 *   node outils/audit.mjs
 *
 * Vérifie le contrat d'un jeu (AGENTS.md §4), les six pièges connus (§7) et
 * les totaux par catégorie. Sortie vide = rien à signaler.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossiers = ['plateau', 'cartes', 'logique', 'arcade', 'des', 'papier'];
const probs = [];
const ajouter = (fichier, quoi) => probs.push(`${fichier} — ${quoi}`);

const fichiers = [];
for (const d of dossiers) {
  const dir = path.join(racine, 'src/games', d);
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.tsx')) fichiers.push({ cat: d, chemin: path.join(dir, f), nom: `${d}/${f}` });
  }
}

const registre = fs.readFileSync(path.join(racine, 'src/games/registry.ts'), 'utf8');
const ids = new Map();

for (const { cat, chemin, nom } of fichiers) {
  const src = fs.readFileSync(chemin, 'utf8');

  // --- contrat : meta exportée et composant par défaut
  if (!src.includes('export const meta: GameMeta = {')) ajouter(nom, 'pas de meta exportée');
  if (!src.includes('export default function ')) ajouter(nom, 'pas de composant par défaut');

  const id = src.match(/\bid: '([^']+)'/)?.[1];
  if (!id) ajouter(nom, 'id introuvable');
  else {
    if (ids.has(id)) ajouter(nom, `id « ${id} » déjà pris par ${ids.get(id)}`);
    ids.set(id, nom);
    if (!/^[a-z0-9-]+$/.test(id)) ajouter(nom, `id « ${id} » n'est pas en kebab-case`);
  }

  const categorie = src.match(/category: '([^']+)'/)?.[1];
  if (!categorie) ajouter(nom, 'category absente');
  else if (categorie !== cat) ajouter(nom, `category « ${categorie} » ne colle pas au dossier ${cat}`);

  // Champs obligatoires de GameMeta, cherchés en début de ligne indentée.
  for (const champ of ['name', 'tagline', 'emoji', 'difficulty', 'players', 'minutes', 'score', 'tags', 'rules']) {
    if (!src.includes('\n  ' + champ + ':')) ajouter(nom, `champ meta manquant : ${champ}`);
  }

  const score = src.match(/\n  score: '([^']+)'/)?.[1];
  if (score && score !== 'none' && !src.includes('\n  scoreUnit:')) {
    ajouter(nom, `score « ${score} » sans scoreUnit`);
  }

  const regles = src.match(/\n  rules: \[([\s\S]*?)\n  \]/)?.[1];
  if (regles) {
    const n = (regles.match(/^\s*'/gm) || []).length;
    if (n < 3 || n > 5) ajouter(nom, `${n} règles (3 à 5 attendues)`);
  } else {
    ajouter(nom, 'tableau rules illisible');
  }

  // --- piège 5 : une boucle propre au jeu contournerait la pause des règles
  if (/\bsetInterval\(/.test(src)) ajouter(nom, 'setInterval brut — contourne la pause, utiliser useInterval');
  if (/\brequestAnimationFrame\(/.test(src)) ajouter(nom, 'requestAnimationFrame direct — utiliser useRafLoop');

  // --- piège 4 : retour arrière sur une pile d'un seul écran
  if (src.includes('router.back()')) ajouter(nom, 'router.back() — utiliser useRetour()');

  // --- piège 3 : effet de bord dans un updater setState
  const updaters = src.match(/set[A-Z]\w*\(\([^)]*\) => \{[\s\S]{0,500}?\n {4}\}\)/g) || [];
  for (const bloc of updaters) {
    if (/\b(submitScore|submitResult|haptic)\(/.test(bloc)) {
      ajouter(nom, 'submitScore / submitResult / haptic appelé dans un updater setState');
    }
  }

  // --- composant déclaré dans un composant : React le remonte à chaque rendu.
  // On ne retient que les noms en CamelCase affectés à une fonction :
  // les constantes tout en majuscules sont légitimes.
  for (const decl of src.match(/^  (?:const [A-Z]\w*[a-z]\w* = \(|function [A-Z]\w*[a-z]\w*\()/gm) || []) {
    ajouter(nom, `${decl.trim()} — composant déclaré dans le composant, remonté à chaque rendu`);
  }

  // --- contrat : bouton recommencer branché
  if (!src.includes('useFrameRestart(')) ajouter(nom, 'useFrameRestart absent — le bouton ↻ ne ferait rien');
  if (!src.includes('useFrameStatus(')) ajouter(nom, 'useFrameStatus absent — pas de ligne d’état');

  // --- accessibilité
  const pressables = (src.match(/<Pressable\b/g) || []).length;
  const labels = (src.match(/accessibilityLabel=/g) || []).length;
  if (pressables > 0 && labels === 0) ajouter(nom, `${pressables} Pressable sans accessibilityLabel`);

  // --- enregistrement du résultat
  if (score && score !== 'none' && !src.includes('submitScore(')) {
    ajouter(nom, `score « ${score} » mais submitScore n'est jamais appelé`);
  }
  if (score === 'none' && !src.includes('submitResult(')) {
    ajouter(nom, 'score « none » mais submitResult n’est jamais appelé');
  }

  // --- inscrit au registre
  const base = path.basename(chemin, '.tsx');
  if (!registre.includes(`from './${cat}/${base}'`)) ajouter(nom, 'absent des imports du registre');

  // --- hors ligne obligatoire
  if (/\bfetch\(/.test(src) || src.includes('XMLHttpRequest')) {
    ajouter(nom, 'accès réseau détecté — le projet est entièrement hors ligne');
  }
}

// --- totaux par catégorie
const parCat = {};
for (const { cat } of fichiers) parCat[cat] = (parCat[cat] || 0) + 1;
const attendus = { plateau: 20, cartes: 20, logique: 20, arcade: 20, des: 10, papier: 10 };
for (const [cat, n] of Object.entries(attendus)) {
  if ((parCat[cat] || 0) !== n) ajouter('catalogue', `${cat} : ${parCat[cat] || 0} fichiers, ${n} attendus`);
}

const lignesModules = (registre.match(/^  [a-zA-Z0-9]+,$/gm) || []).length;
if (lignesModules !== fichiers.length) {
  ajouter('registry.ts', `${lignesModules} entrées MODULES pour ${fichiers.length} fichiers`);
}

console.log(`fichiers de jeu analysés : ${fichiers.length}`);
console.log(`par catégorie : ${Object.entries(parCat).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`identifiants uniques : ${ids.size}`);
console.log('');
console.log(probs.length === 0 ? 'AUCUN PROBLEME STATIQUE' : `${probs.length} PROBLEMES :\n` + probs.join('\n'));
