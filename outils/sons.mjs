/**
 * Génère les effets sonores de Plateau.
 *
 *   node outils/sons.mjs
 *
 * Les sons sont **synthétisés ici**, pas téléchargés : aucune question de
 * licence ne se pose, et ils pèsent quelques kilo-octets. Un encodeur WAV
 * tient en vingt lignes, donc aucune dépendance non plus.
 *
 * Six sons, un par événement du retour haptique — les jeux n'ont rien à
 * changer, le son suit exactement les mêmes moments que la vibration.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossier = path.join(racine, 'assets', 'sons');
fs.mkdirSync(dossier, { recursive: true });

const FREQUENCE = 44100;

/** En-tête RIFF puis échantillons PCM 16 bits mono. */
function encoderWav(echantillons) {
  const donnees = Buffer.alloc(echantillons.length * 2);
  for (let i = 0; i < echantillons.length; i++) {
    const v = Math.max(-1, Math.min(1, echantillons[i]));
    donnees.writeInt16LE(Math.round(v * 32767), i * 2);
  }

  const entete = Buffer.alloc(44);
  entete.write('RIFF', 0);
  entete.writeUInt32LE(36 + donnees.length, 4);
  entete.write('WAVE', 8);
  entete.write('fmt ', 12);
  entete.writeUInt32LE(16, 16); // taille du bloc fmt
  entete.writeUInt16LE(1, 20); // PCM
  entete.writeUInt16LE(1, 22); // mono
  entete.writeUInt32LE(FREQUENCE, 24);
  entete.writeUInt32LE(FREQUENCE * 2, 28); // octets par seconde
  entete.writeUInt16LE(2, 32); // alignement
  entete.writeUInt16LE(16, 34); // bits par échantillon
  entete.write('data', 36);
  entete.writeUInt32LE(donnees.length, 40);

  return Buffer.concat([entete, donnees]);
}

/**
 * Une note : sinusoïde adoucie par une harmonique, avec une enveloppe
 * attaque-chute. Sans enveloppe, un son court « claque » désagréablement.
 */
function note(frequence, duree, { debut = 0, gain = 1, harmonique = 0.25 } = {}) {
  const total = Math.round(duree * FREQUENCE);
  const attaque = Math.round(0.006 * FREQUENCE);
  const out = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const t = i / FREQUENCE;
    const enveloppe =
      i < attaque ? i / attaque : Math.pow(1 - (i - attaque) / (total - attaque), 2.2);
    const onde =
      Math.sin(2 * Math.PI * frequence * t) +
      harmonique * Math.sin(4 * Math.PI * frequence * t);
    out[i] = onde * enveloppe * gain * 0.42;
  }
  return { echantillons: out, debut: Math.round(debut * FREQUENCE) };
}

/** Superpose des notes décalées dans le temps. */
function assembler(notes) {
  const longueur = Math.max(...notes.map((n) => n.debut + n.echantillons.length));
  const melange = new Float32Array(longueur);
  for (const { echantillons, debut } of notes) {
    for (let i = 0; i < echantillons.length; i++) melange[debut + i] += echantillons[i];
  }
  // Normalisation douce : on évite l'écrêtage sans tout aplatir.
  let crete = 0;
  for (const v of melange) crete = Math.max(crete, Math.abs(v));
  if (crete > 0.95) for (let i = 0; i < melange.length; i++) melange[i] *= 0.95 / crete;
  return melange;
}

/** Bruit filtré court, pour les sons mats. */
function souffle(duree, gain = 0.3) {
  const total = Math.round(duree * FREQUENCE);
  const out = new Float32Array(total);
  let precedent = 0;
  for (let i = 0; i < total; i++) {
    const brut = Math.random() * 2 - 1;
    precedent = precedent * 0.72 + brut * 0.28; // passe-bas simple
    out[i] = precedent * Math.pow(1 - i / total, 3) * gain;
  }
  return { echantillons: out, debut: 0 };
}

// Gamme de référence, en hertz.
const LA3 = 440;
const hauteur = (demiTons) => LA3 * Math.pow(2, demiTons / 12);

const SONS = {
  // Toucher léger : un clic mat et bref.
  leger: () => assembler([note(hauteur(7), 0.045, { gain: 0.5, harmonique: 0.1 }), souffle(0.03, 0.18)]),

  // Coup joué : plus grave, plus présent.
  moyen: () => assembler([note(hauteur(0), 0.07, { gain: 0.7 }), souffle(0.04, 0.22)]),

  // Prise, capture : un thud grave.
  lourd: () => assembler([note(hauteur(-12), 0.11, { gain: 0.85, harmonique: 0.4 }), souffle(0.06, 0.3)]),

  // Réussite : une tierce montante.
  succes: () =>
    assembler([
      note(hauteur(4), 0.1, { gain: 0.6 }),
      note(hauteur(9), 0.1, { debut: 0.07, gain: 0.6 }),
      note(hauteur(16), 0.22, { debut: 0.14, gain: 0.55 }),
    ]),

  // Avertissement : deux notes égales, sèches.
  avertissement: () =>
    assembler([
      note(hauteur(2), 0.07, { gain: 0.55, harmonique: 0.5 }),
      note(hauteur(2), 0.09, { debut: 0.1, gain: 0.5, harmonique: 0.5 }),
    ]),

  // Erreur, défaite : une seconde descendante.
  erreur: () =>
    assembler([
      note(hauteur(-2), 0.12, { gain: 0.6, harmonique: 0.55 }),
      note(hauteur(-7), 0.2, { debut: 0.09, gain: 0.6, harmonique: 0.55 }),
    ]),
};

const faits = [];
for (const [nom, fabriquer] of Object.entries(SONS)) {
  const chemin = path.join(dossier, `${nom}.wav`);
  fs.writeFileSync(chemin, encoderWav(fabriquer()));
  const taille = fs.statSync(chemin).size;
  faits.push(`${nom}.wav — ${(taille / 1024).toFixed(1)} ko, ${(taille - 44) / 2 / FREQUENCE * 1000 | 0} ms`);
}

console.log('Sons écrits dans assets/sons/ :');
for (const f of faits) console.log('  ' + f);
console.log('\nSynthétisés pour ce projet, donc libres de tout droit tiers.');
