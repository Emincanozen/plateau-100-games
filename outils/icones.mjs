/**
 * Génère les icônes et l'écran de lancement de Plateau.
 *
 *   node outils/icones.mjs
 *
 * Tout est dessiné par programme, sans dépendance : un encodeur PNG minimal
 * suffit. Le motif — quatre quartiers aux couleurs des catégories — reste
 * lisible à 48 pixels comme à 1024.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossier = path.join(racine, 'assets');

// --- Encodeur PNG ----------------------------------------------------------

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const octet of buf) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(data.length);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const somme = Buffer.alloc(4);
  somme.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, somme]);
}

/** `pixels` : RGBA sur 8 bits, largeur × hauteur × 4 octets. */
function encoderPng(largeur, hauteur, pixels) {
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8; // profondeur
  entete[9] = 6; // RGBA
  entete[10] = 0;
  entete[11] = 0;
  entete[12] = 0;

  // Chaque ligne est précédée de son octet de filtre, ici toujours « aucun ».
  const brut = Buffer.alloc(hauteur * (largeur * 4 + 1));
  for (let y = 0; y < hauteur; y++) {
    brut[y * (largeur * 4 + 1)] = 0;
    pixels.copy(brut, y * (largeur * 4 + 1) + 1, y * largeur * 4, (y + 1) * largeur * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', entete),
    chunk('IDAT', zlib.deflateSync(brut, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Dessin ----------------------------------------------------------------

const teinte = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

class Toile {
  constructor(taille, fond) {
    this.n = taille;
    this.px = Buffer.alloc(taille * taille * 4);
    if (fond) {
      const [r, v, b] = teinte(fond);
      for (let i = 0; i < taille * taille; i++) {
        this.px[i * 4] = r;
        this.px[i * 4 + 1] = v;
        this.px[i * 4 + 2] = b;
        this.px[i * 4 + 3] = 255;
      }
    }
  }

  /** Mélange une couleur sur un pixel selon sa couverture (0 à 1). */
  poser(x, y, [r, v, b], couverture) {
    if (couverture <= 0) return;
    const i = (y * this.n + x) * 4;
    const a = Math.min(1, couverture);
    const ancienA = this.px[i + 3] / 255;
    const nouvelA = a + ancienA * (1 - a);
    if (nouvelA === 0) return;
    this.px[i] = Math.round((r * a + this.px[i] * ancienA * (1 - a)) / nouvelA);
    this.px[i + 1] = Math.round((v * a + this.px[i + 1] * ancienA * (1 - a)) / nouvelA);
    this.px[i + 2] = Math.round((b * a + this.px[i + 2] * ancienA * (1 - a)) / nouvelA);
    this.px[i + 3] = Math.round(nouvelA * 255);
  }

  /** Rectangle à coins arrondis, lissé par distance signée. */
  rectArrondi(cx, cy, demiL, demiH, rayon, couleur) {
    const col = teinte(couleur);
    const x0 = Math.max(0, Math.floor(cx - demiL - 2));
    const x1 = Math.min(this.n - 1, Math.ceil(cx + demiL + 2));
    const y0 = Math.max(0, Math.floor(cy - demiH - 2));
    const y1 = Math.min(this.n - 1, Math.ceil(cy + demiH + 2));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const qx = Math.abs(x + 0.5 - cx) - (demiL - rayon);
        const qy = Math.abs(y + 0.5 - cy) - (demiH - rayon);
        const d =
          Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rayon;
        this.poser(x, y, col, 0.5 - d);
      }
    }
  }

  disque(cx, cy, rayon, couleur) {
    const col = teinte(couleur);
    for (let y = Math.max(0, Math.floor(cy - rayon - 2)); y <= Math.min(this.n - 1, Math.ceil(cy + rayon + 2)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rayon - 2)); x <= Math.min(this.n - 1, Math.ceil(cx + rayon + 2)); x++) {
        this.poser(x, y, col, 0.5 - (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - rayon));
      }
    }
  }

  ecrire(nom) {
    const chemin = path.join(dossier, nom);
    fs.writeFileSync(chemin, encoderPng(this.n, this.n, this.px));
    return `${nom} — ${this.n}×${this.n}, ${(fs.statSync(chemin).size / 1024).toFixed(1)} ko`;
  }
}

// Les quatre couleurs de catégorie les plus contrastées entre elles.
const QUARTIERS = ['#5B8DEF', '#E0525F', '#34B37E', '#F0A030'];
const FOND = '#101018';

/**
 * Le motif : quatre quartiers arrondis séparés par le fond, plus un petit
 * disque clair au centre — un pion posé sur le plateau.
 * `echelle` donne la part de la toile occupée par le motif.
 */
function dessinerMarque(toile, echelle, couleurs = QUARTIERS, pion = '#F4F4F7') {
  const n = toile.n;
  const centre = n / 2;
  const bloc = (n * echelle) / 2; // demi-côté du motif entier
  const jeu = bloc * 0.075; // écart entre les quartiers
  const demi = (bloc - jeu) / 2;
  const rayon = demi * 0.42;

  const positions = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  positions.forEach(([sx, sy], k) => {
    toile.rectArrondi(centre + sx * (demi + jeu), centre + sy * (demi + jeu), demi, demi, rayon, couleurs[k % couleurs.length]);
  });

  if (pion) {
    toile.disque(centre, centre, bloc * 0.2, FOND);
    toile.disque(centre, centre, bloc * 0.145, pion);
  }
}

const faits = [];

// 1 · Icône iOS et icône générale : opaque, sans transparence, motif large.
{
  const t = new Toile(1024, FOND);
  dessinerMarque(t, 0.66);
  faits.push(t.ecrire('icon.png'));
}

// 2 · Android, calque avant : le motif doit tenir dans le cercle de sûreté
//     (66 % de la toile), le système rognant les bords.
{
  const t = new Toile(1024, null);
  dessinerMarque(t, 0.44);
  faits.push(t.ecrire('android-icon-foreground.png'));
}

// 3 · Android, calque arrière : aplat.
{
  const t = new Toile(1024, FOND);
  faits.push(t.ecrire('android-icon-background.png'));
}

// 4 · Android, calque monochrome (thème dynamique) : silhouette blanche.
{
  const t = new Toile(1024, null);
  dessinerMarque(t, 0.44, ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'], null);
  faits.push(t.ecrire('android-icon-monochrome.png'));
}

// 5 · Écran de lancement : motif seul sur fond transparent, centré par Expo.
{
  const t = new Toile(1024, null);
  dessinerMarque(t, 0.52);
  faits.push(t.ecrire('splash-icon.png'));
}

// 6 · Favicon du site.
{
  const t = new Toile(64, FOND);
  dessinerMarque(t, 0.72);
  faits.push(t.ecrire('favicon.png'));
}

console.log('Icônes écrites dans assets/ :');
for (const f of faits) console.log('  ' + f);
