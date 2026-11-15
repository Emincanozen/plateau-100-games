/**
 * Moteur de backgammon : règles complètes et IA probabiliste.
 *
 * Les flèches sont numérotées de 0 à 23. Un nombre positif compte des pions
 * blancs, un nombre négatif des pions noirs. Les blancs descendent de 23 vers 0
 * et sortent par le bas ; les noirs montent de 0 vers 23.
 *
 * Aucun code d'affichage ici : ce fichier est testable seul.
 */

export type Camp = 1 | -1;

/** Sentinelles pour la barre (départ) et la sortie (arrivée). */
export const BARRE = 24;
export const SORTIE = -1;

export interface Etat {
  points: Int8Array;
  barreBlanc: number;
  barreNoir: number;
  sortiBlanc: number;
  sortiNoir: number;
  trait: Camp;
}

export interface Mouvement {
  depuis: number;
  vers: number;
  de: number;
  /** Vrai si le mouvement renvoie un pion adverse à la barre. */
  frappe?: boolean;
}

export interface Suite {
  etat: Etat;
  mouvements: Mouvement[];
}

export function etatInitial(): Etat {
  const points = new Int8Array(24);
  points[23] = 2;
  points[12] = 5;
  points[7] = 3;
  points[5] = 5;
  points[0] = -2;
  points[11] = -5;
  points[16] = -3;
  points[18] = -5;
  return { points, barreBlanc: 0, barreNoir: 0, sortiBlanc: 0, sortiNoir: 0, trait: 1 };
}

function copier(e: Etat): Etat {
  return {
    points: Int8Array.from(e.points),
    barreBlanc: e.barreBlanc,
    barreNoir: e.barreNoir,
    sortiBlanc: e.sortiBlanc,
    sortiNoir: e.sortiNoir,
    trait: e.trait,
  };
}

export const barreDe = (e: Etat, camp: Camp) => (camp === 1 ? e.barreBlanc : e.barreNoir);
export const sortiDe = (e: Etat, camp: Camp) => (camp === 1 ? e.sortiBlanc : e.sortiNoir);

/** La flèche accueille-t-elle ce camp ? Deux pions adverses la ferment. */
function accessible(e: Etat, index: number, camp: Camp): boolean {
  const v = e.points[index];
  return camp === 1 ? v >= -1 : v <= 1;
}

/** Tous les pions du camp sont-ils dans son jan intérieur ? */
export function toutALaMaison(e: Etat, camp: Camp): boolean {
  if (barreDe(e, camp) > 0) return false;
  if (camp === 1) {
    for (let i = 6; i < 24; i++) if (e.points[i] > 0) return false;
  } else {
    for (let i = 0; i < 18; i++) if (e.points[i] < 0) return false;
  }
  return true;
}

/** Reste-t-il un pion plus éloigné de la sortie que celui-ci ? */
function pionPlusLoin(e: Etat, camp: Camp, index: number): boolean {
  if (camp === 1) {
    for (let i = index + 1; i <= 5; i++) if (e.points[i] > 0) return true;
  } else {
    for (let i = 18; i < index; i++) if (e.points[i] < 0) return true;
  }
  return false;
}

export function mouvementsPossibles(e: Etat, de: number): Mouvement[] {
  const camp = e.trait;

  // Un pion sur la barre doit rentrer avant tout autre mouvement.
  if (barreDe(e, camp) > 0) {
    const vers = camp === 1 ? 24 - de : de - 1;
    if (!accessible(e, vers, camp)) return [];
    return [{ depuis: BARRE, vers, de, frappe: e.points[vers] === -camp }];
  }

  const out: Mouvement[] = [];
  const maison = toutALaMaison(e, camp);

  for (let depuis = 0; depuis < 24; depuis++) {
    const v = e.points[depuis];
    if (camp === 1 ? v <= 0 : v >= 0) continue;

    const vers = depuis - camp * de;
    if (vers >= 0 && vers < 24) {
      if (accessible(e, vers, camp)) out.push({ depuis, vers, de, frappe: e.points[vers] === -camp });
      continue;
    }

    if (!maison) continue;
    // Sortie : le compte exact, ou un dé plus grand si plus rien n'est en arrière.
    const distance = camp === 1 ? depuis + 1 : 24 - depuis;
    if (de === distance || (de > distance && !pionPlusLoin(e, camp, depuis))) {
      out.push({ depuis, vers: SORTIE, de });
    }
  }
  return out;
}

export function appliquerMouvement(e: Etat, m: Mouvement): Etat {
  const suivant = copier(e);
  const camp = e.trait;

  if (m.depuis === BARRE) {
    if (camp === 1) suivant.barreBlanc -= 1;
    else suivant.barreNoir -= 1;
  } else {
    suivant.points[m.depuis] -= camp;
  }

  if (m.vers === SORTIE) {
    if (camp === 1) suivant.sortiBlanc += 1;
    else suivant.sortiNoir += 1;
    return suivant;
  }

  if (suivant.points[m.vers] === -camp) {
    suivant.points[m.vers] = 0;
    if (camp === 1) suivant.barreNoir += 1;
    else suivant.barreBlanc += 1;
  }
  suivant.points[m.vers] += camp;
  return suivant;
}

const clef = (e: Etat) =>
  `${e.points.join(',')}|${e.barreBlanc},${e.barreNoir},${e.sortiBlanc},${e.sortiNoir}`;

export function desDuLancer(a: number, b: number): number[] {
  return a === b ? [a, a, a, a] : [a, b];
}

/**
 * Toutes les façons de jouer le lancer, en respectant les deux règles dures :
 * on doit utiliser le plus de dés possible, et si un seul est jouable, ce doit
 * être le plus grand. La recherche est plafonnée pour rester instantanée.
 */
export function toutesLesSuites(e: Etat, des: number[], plafond = 6000): Suite[] {
  const terminales: Suite[] = [];
  let maxLongueur = 0;
  let visites = 0;

  const explorer = (courant: Etat, restants: number[], faits: Mouvement[]) => {
    visites += 1;
    if (faits.length > maxLongueur) maxLongueur = faits.length;
    if (restants.length === 0 || visites > plafond) {
      if (faits.length > 0) terminales.push({ etat: courant, mouvements: faits });
      return;
    }

    let avance = false;
    const dejaEssayes = new Set<number>();
    for (let i = 0; i < restants.length; i++) {
      const de = restants[i];
      if (dejaEssayes.has(de)) continue;
      dejaEssayes.add(de);
      const reste = restants.slice(0, i).concat(restants.slice(i + 1));
      for (const m of mouvementsPossibles(courant, de)) {
        avance = true;
        explorer(appliquerMouvement(courant, m), reste, [...faits, m]);
      }
    }
    if (!avance && faits.length > 0) terminales.push({ etat: courant, mouvements: faits });
  };

  explorer(e, des, []);
  if (maxLongueur === 0) return [];

  let gardees = terminales.filter((s) => s.mouvements.length === maxLongueur);

  // Un seul dé jouable et deux valeurs différentes : c'est le plus grand qui compte.
  if (maxLongueur === 1 && des.length === 2 && des[0] !== des[1]) {
    const grand = Math.max(des[0], des[1]);
    const avecGrand = gardees.filter((s) => s.mouvements[0].de === grand);
    if (avecGrand.length > 0) gardees = avecGrand;
  }

  // Deux chemins menant à la même position sont un seul choix.
  const vues = new Map<string, Suite>();
  for (const s of gardees) if (!vues.has(clef(s.etat))) vues.set(clef(s.etat), s);
  return [...vues.values()];
}

// --- Évaluation ------------------------------------------------------------

/**
 * Sur 36 lancers, combien couvrent cette distance ?
 * C'est la table classique du backgammon : elle rend le calcul du risque
 * réellement probabiliste plutôt qu'approximatif.
 */
const JETS_COUVRANTS: Record<number, number> = {
  1: 11,
  2: 12,
  3: 14,
  4: 15,
  5: 15,
  6: 17,
  7: 6,
  8: 6,
  9: 5,
  10: 3,
  11: 2,
  12: 3,
  15: 1,
  16: 1,
  18: 1,
  20: 1,
  24: 1,
};

export function pipCount(e: Etat, camp: Camp): number {
  let total = barreDe(e, camp) * 25;
  for (let i = 0; i < 24; i++) {
    const v = e.points[i];
    if (camp === 1 && v > 0) total += v * (i + 1);
    else if (camp === -1 && v < 0) total += -v * (24 - i);
  }
  return total;
}

/** Pions seuls exposés, pondérés par la probabilité d'être frappés. */
function risqueDesBlots(e: Etat, camp: Camp): number {
  let risque = 0;
  const adverse: Camp = camp === 1 ? -1 : 1;

  for (let i = 0; i < 24; i++) {
    if (e.points[i] !== camp) continue; // exactement un pion à nous

    // Distance depuis le pion adverse le plus proche encore en arrière.
    let distance = 0;
    if (barreDe(e, adverse) > 0) {
      distance = camp === 1 ? 24 - i : i + 1;
    } else {
      let meilleure = 99;
      for (let j = 0; j < 24; j++) {
        const v = e.points[j];
        if (adverse === 1 ? v <= 0 : v >= 0) continue;
        const d = adverse === 1 ? j - i : i - j;
        if (d > 0 && d < meilleure) meilleure = d;
      }
      distance = meilleure === 99 ? 0 : meilleure;
    }

    const jets = JETS_COUVRANTS[distance] ?? 0;
    // Un pion perdu dans notre jan intérieur coûte plus cher : il repart de zéro.
    const profondeur = camp === 1 ? 1 + (23 - i) / 23 : 1 + i / 23;
    risque += (jets / 36) * 25 * profondeur;
  }
  return risque;
}

/** Cases tenues à deux pions ou plus, avec bonus pour le blocage. */
function structure(e: Etat, camp: Camp): number {
  let note = 0;
  let consecutives = 0;
  let meilleurMur = 0;

  for (let k = 0; k < 24; k++) {
    const i = camp === 1 ? k : 23 - k;
    const v = e.points[i] * camp;
    if (v >= 2) {
      note += 4;
      // Une case du jan intérieur vaut plus qu'une case au loin.
      const dansMaison = camp === 1 ? i <= 5 : i >= 18;
      if (dansMaison) note += 6;
      // La case 5 — le « point d'or » — est la meilleure du plateau.
      if ((camp === 1 && i === 4) || (camp === -1 && i === 19)) note += 8;
      consecutives += 1;
      if (consecutives > meilleurMur) meilleurMur = consecutives;
    } else {
      consecutives = 0;
    }
  }
  return note + meilleurMur * meilleurMur * 1.5;
}

/** Note de la position pour le camp donné. Plus c'est haut, mieux c'est. */
export function evaluer(e: Etat, camp: Camp): number {
  const adverse: Camp = camp === 1 ? -1 : 1;

  let note = (pipCount(e, adverse) - pipCount(e, camp)) * 1.0;
  note += (sortiDe(e, camp) - sortiDe(e, adverse)) * 12;
  note += (barreDe(e, adverse) - barreDe(e, camp)) * 18;
  note += structure(e, camp) - structure(e, adverse);
  note -= risqueDesBlots(e, camp);
  note += risqueDesBlots(e, adverse) * 0.7;
  return note;
}

export type Niveau = 'facile' | 'normal' | 'expert';

/** Les 21 lancers distincts, avec leur poids sur 36. */
const LANCERS: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) out.push([a, b, a === b ? 1 : 2]);
  return out;
})();

/**
 * Choix de l'ordinateur.
 * En expert, chaque suite finaliste est repassée au crible des 21 lancers
 * distincts de l'adversaire, pondérés sur 36 : c'est une espérance, pas un
 * minimax — le hasard des dés rend l'arbre classique sans objet.
 */
export function meilleureSuite(e: Etat, des: number[], niveau: Niveau): Suite | null {
  const suites = toutesLesSuites(e, des);
  if (suites.length === 0) return null;
  if (suites.length === 1) return suites[0];

  const camp = e.trait;
  const adverse: Camp = camp === 1 ? -1 : 1;

  if (niveau === 'facile') {
    if (Math.random() < 0.4) return suites[Math.floor(Math.random() * suites.length)];
    let meilleure = suites[0];
    let minPip = Infinity;
    for (const s of suites) {
      const pip = pipCount(s.etat, camp);
      if (pip < minPip) {
        minPip = pip;
        meilleure = s;
      }
    }
    return meilleure;
  }

  const notees = suites
    .map((suite) => ({ suite, note: evaluer(suite.etat, camp) }))
    .sort((a, b) => b.note - a.note);

  if (niveau === 'normal') return notees[0].suite;

  let meilleure = notees[0].suite;
  let meilleureEsperance = -Infinity;
  for (const { suite } of notees.slice(0, 4)) {
    const apres: Etat = { ...suite.etat, trait: adverse };
    let total = 0;
    for (const [a, b, poids] of LANCERS) {
      const riposte = toutesLesSuites(apres, desDuLancer(a, b), 900);
      let pire = evaluer(apres, camp);
      if (riposte.length > 0) {
        pire = Math.min(...riposte.map((r) => evaluer(r.etat, camp)));
      }
      total += pire * poids;
    }
    const esperance = total / 36;
    if (esperance > meilleureEsperance) {
      meilleureEsperance = esperance;
      meilleure = suite;
    }
  }
  return meilleure;
}

export type Fin = { gagnant: Camp; facteur: 1 | 2 | 3 } | null;

/** Simple, gammon (l'adversaire n'a rien sorti) ou backgammon (il est encore chez nous). */
export function fin(e: Etat): Fin {
  const gagnant: Camp | null = e.sortiBlanc === 15 ? 1 : e.sortiNoir === 15 ? -1 : null;
  if (gagnant === null) return null;

  const perdant: Camp = gagnant === 1 ? -1 : 1;
  if (sortiDe(e, perdant) > 0) return { gagnant, facteur: 1 };

  const chezLeGagnant = barreDe(e, perdant) > 0 ||
    (gagnant === 1
      ? e.points.some((v, i) => i <= 5 && v < 0)
      : e.points.some((v, i) => i >= 18 && v > 0));

  return { gagnant, facteur: chezLeGagnant ? 3 : 2 };
}
