/**
 * Encodeur PNG minimal, sans dépendance.
 *
 * Extrait de `outils/icones.mjs` pour servir aussi aux visuels de magasin,
 * qui ne sont pas carrés. Zéro bibliothèque tierce : les images livrées aux
 * magasins ne doivent rien à personne, pas même une licence à vérifier.
 */
import zlib from 'node:zlib';

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

/**
 * `pixels` : RGBA sur 8 bits, largeur × hauteur × 4 octets.
 *
 * `opaque` force le type couleur RVB sans canal alpha. Google Play refuse
 * une icône transparente ; Apple aussi. Mieux vaut que l'encodeur sache le
 * produire que d'espérer qu'un outil de retouche s'en charge.
 */
export function encoderPng(largeur, hauteur, pixels, { opaque = false } = {}) {
  const canaux = opaque ? 3 : 4;
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8; // profondeur
  entete[9] = opaque ? 2 : 6; // 2 = RVB, 6 = RVBA
  entete[10] = 0;
  entete[11] = 0;
  entete[12] = 0;

  // Chaque ligne est précédée de son octet de filtre, ici toujours « aucun ».
  const pas = largeur * canaux + 1;
  const brut = Buffer.alloc(hauteur * pas);
  for (let y = 0; y < hauteur; y++) {
    brut[y * pas] = 0;
    for (let x = 0; x < largeur; x++) {
      const src = (y * largeur + x) * 4;
      const dst = y * pas + 1 + x * canaux;
      brut[dst] = pixels[src];
      brut[dst + 1] = pixels[src + 1];
      brut[dst + 2] = pixels[src + 2];
      if (!opaque) brut[dst + 3] = pixels[src + 3];
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', entete),
    chunk('IDAT', zlib.deflateSync(brut, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const teinte = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Toile rectangulaire. `icones.mjs` n'en connaissait que des carrées. */
export class Toile {
  constructor(largeur, hauteur = largeur, fond = null) {
    this.l = largeur;
    this.h = hauteur;
    this.px = Buffer.alloc(largeur * hauteur * 4);
    if (fond) this.remplir(fond);
  }

  remplir(hex) {
    const [r, v, b] = teinte(hex);
    for (let i = 0; i < this.l * this.h; i++) {
      this.px[i * 4] = r;
      this.px[i * 4 + 1] = v;
      this.px[i * 4 + 2] = b;
      this.px[i * 4 + 3] = 255;
    }
  }

  /** Mélange une couleur sur un pixel selon sa couverture (0 à 1). */
  poser(x, y, [r, v, b], couverture) {
    if (couverture <= 0 || x < 0 || y < 0 || x >= this.l || y >= this.h) return;
    const i = (y * this.l + x) * 4;
    const a = Math.min(1, couverture);
    const ancienA = this.px[i + 3] / 255;
    const nouvelA = a + ancienA * (1 - a);
    if (nouvelA === 0) return;
    this.px[i] = Math.round((r * a + this.px[i] * ancienA * (1 - a)) / nouvelA);
    this.px[i + 1] = Math.round((v * a + this.px[i + 1] * ancienA * (1 - a)) / nouvelA);
    this.px[i + 2] = Math.round((b * a + this.px[i + 2] * ancienA * (1 - a)) / nouvelA);
    this.px[i + 3] = Math.round(nouvelA * 255);
  }

  /**
   * La couverture est bornée à 1 **avant** d'appliquer l'opacité.
   *
   * Sans cela, `alpha` ne servait à rien à l'intérieur d'une forme : la
   * distance signée y vaut plusieurs dizaines, et `50 × 0,1` reste très
   * au-dessus de 1. Une trame demandée à 10 % sortait parfaitement opaque.
   */
  couvrir(d, alpha) {
    return Math.min(1, 0.5 - d) * alpha;
  }

  /** Rectangle à coins arrondis, lissé par distance signée. */
  rectArrondi(cx, cy, demiL, demiH, rayon, couleur, alpha = 1) {
    const col = teinte(couleur);
    for (let y = Math.max(0, Math.floor(cy - demiH - 2)); y <= Math.min(this.h - 1, Math.ceil(cy + demiH + 2)); y++) {
      for (let x = Math.max(0, Math.floor(cx - demiL - 2)); x <= Math.min(this.l - 1, Math.ceil(cx + demiL + 2)); x++) {
        const qx = Math.abs(x + 0.5 - cx) - (demiL - rayon);
        const qy = Math.abs(y + 0.5 - cy) - (demiH - rayon);
        const d =
          Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rayon;
        this.poser(x, y, col, this.couvrir(d, alpha));
      }
    }
  }

  disque(cx, cy, rayon, couleur, alpha = 1) {
    const col = teinte(couleur);
    for (let y = Math.max(0, Math.floor(cy - rayon - 2)); y <= Math.min(this.h - 1, Math.ceil(cy + rayon + 2)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rayon - 2)); x <= Math.min(this.l - 1, Math.ceil(cx + rayon + 2)); x++) {
        this.poser(x, y, col, this.couvrir(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - rayon, alpha));
      }
    }
  }

  encoder(options) {
    return encoderPng(this.l, this.h, this.px, options);
  }
}
