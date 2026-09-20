/**
 * Règles déterministes extraites de leurs jeux.
 *
 * Même raison d'être que `echecs.ts` et `backgammon.ts` : ces fonctions
 * n'importent rien de React, donc elles s'exécutent en ligne de commande, et
 * `outils/test-regles-jeux.ts` peut les éprouver sur des cas fixés.
 *
 * Avant cette extraction, aucun barème de jeu n'était couvert par un test.
 * Le yams compte treize figures, le 421 hiérarchise neuf mains, Motus doit
 * gérer les lettres en double — autant d'endroits où une erreur ne se voit
 * qu'en jouant, et seulement si on tombe sur le bon lancer.
 *
 * **Ne pas ajouter ici ce qui touche à l'affichage.** Les libellés, les
 * couleurs et les faces dessinées restent dans les composants ; seule la
 * règle vient ici.
 */

// ----------------------------------------------------------------- yams ---

export type Des5 = number[];

export type FigureYams =
  | 'as' | 'deux' | 'trois' | 'quatre' | 'cinq' | 'six'
  | 'brelan' | 'carre' | 'full' | 'petiteSuite' | 'grandeSuite' | 'yams' | 'chance';

const compte = (des: Des5, face: number) => des.filter((d) => d === face).length;
const somme = (des: Des5) => des.reduce((a, b) => a + b, 0);

function occurrences(des: Des5): number[] {
  const out = Array(7).fill(0);
  des.forEach((d) => (out[d] += 1));
  return out;
}

/** Longueur de la plus longue suite de faces consécutives. */
function plusLongueSuite(des: Des5): number {
  const presentes = new Set(des);
  let best = 0;
  let courant = 0;
  for (let face = 1; face <= 6; face++) {
    if (presentes.has(face)) {
      courant += 1;
      best = Math.max(best, courant);
    } else {
      courant = 0;
    }
  }
  return best;
}

export function valeurFigure(figure: FigureYams, des: Des5): number {
  const occ = occurrences(des);
  switch (figure) {
    case 'as':
      return compte(des, 1) * 1;
    case 'deux':
      return compte(des, 2) * 2;
    case 'trois':
      return compte(des, 3) * 3;
    case 'quatre':
      return compte(des, 4) * 4;
    case 'cinq':
      return compte(des, 5) * 5;
    case 'six':
      return compte(des, 6) * 6;
    case 'brelan':
      return occ.some((n) => n >= 3) ? somme(des) : 0;
    case 'carre':
      return occ.some((n) => n >= 4) ? somme(des) : 0;
    case 'full':
      return occ.some((n) => n === 3) && occ.some((n) => n === 2) ? 25 : 0;
    case 'petiteSuite':
      return plusLongueSuite(des) >= 4 ? 30 : 0;
    case 'grandeSuite':
      return plusLongueSuite(des) >= 5 ? 40 : 0;
    case 'yams':
      return occ.some((n) => n === 5) ? 50 : 0;
    case 'chance':
      return somme(des);
  }
}

// --------------------------------------------------------------- farkle ---

export function evaluerLancer(des: number[]): { points: number; utilises: number } {
  const comptes = [0, 0, 0, 0, 0, 0, 0];
  des.forEach((d) => (comptes[d] += 1));

  let points = 0;
  let utilises = 0;

  // Suite complète et trois paires : les combinaisons de six dés d'abord.
  if (des.length === 6) {
    if (comptes.slice(1).every((n) => n === 1)) return { points: 1500, utilises: 6 };
    if (comptes.filter((n) => n === 2).length === 3) return { points: 1500, utilises: 6 };
  }

  for (let face = 1; face <= 6; face++) {
    const n = comptes[face];
    if (n >= 3) {
      // Un brelan vaut 100 × la face, sauf les as qui valent 1000.
      const base = face === 1 ? 1000 : face * 100;
      // Chaque dé au-delà du brelan double la valeur.
      points += base * Math.pow(2, n - 3);
      utilises += n;
      comptes[face] = 0;
    }
  }

  points += comptes[1] * 100;
  utilises += comptes[1];
  points += comptes[5] * 50;
  utilises += comptes[5];

  return { points, utilises };
}

// ---------------------------------------------------- zanzibar et 421 -----

export type Des3 = [number, number, number];

export function evaluerZanzibar(des: Des3): { rang: number; nom: string } {
  const tri = [...des].sort((a, b) => b - a);
  const [a, b, c] = tri;

  if (a === 6 && b === 5 && c === 4) return { rang: 10000, nom: 'Zanzibar (4-5-6)' };
  if (a === b && b === c) return { rang: 9000 + a, nom: `Brelan de ${a}` };
  // `tri` est **décroissant** : la petite suite s'y lit 3-2-1, pas 1-2-3.
  // Écrite à l'envers, la condition n'était jamais vraie, et un 1-2-3
  // retombait dans le cas général — il valait 321, donc moins qu'une paire.
  if (a === 3 && b === 2 && c === 1) return { rang: 8000, nom: 'Petite suite (1-2-3)' };

  // Paires : la valeur de la paire prime, le dé isolé départage.
  if (a === b) return { rang: 5000 + a * 10 + c, nom: `Paire de ${a}` };
  if (b === c) return { rang: 5000 + b * 10 + a, nom: `Paire de ${b}` };

  return { rang: a * 100 + b * 10 + c, nom: `${a}-${b}-${c}` };
}

export function evaluerMain(des: Des3): { rang: number; nom: string; jetons: number } {
  const tri = [...des].sort((a, b) => b - a);
  const [a, b, c] = tri;

  if (a === 4 && b === 2 && c === 1) return { rang: 1000, nom: '421', jetons: 10 };

  // Les as : deux 1 et une troisième valeur. Le 1-1-1 est le brelan d'as.
  if (a === 1 && b === 1 && c === 1) return { rang: 900, nom: 'Brelan d’as', jetons: 7 };
  if (b === 1 && c === 1) return { rang: 800 + a, nom: `As au ${a}`, jetons: a === 6 ? 6 : 2 };

  if (a === b && b === c) return { rang: 700 + a, nom: `Brelan de ${a}`, jetons: a };

  // Suites : trois valeurs consécutives.
  if (a - 1 === b && b - 1 === c) return { rang: 600 + a, nom: `Suite au ${a}`, jetons: 2 };

  // Les mains quelconques se comparent dé à dé, mais **sous** la bande des
  // suites. Le rang valait auparavant `a*100 + b*10 + c`, soit jusqu'à 654 :
  // un 6-5-2 à 652 battait donc une suite 6-5-4 à 606, alors qu'il vaut cinq
  // fois moins de jetons. La division ramène toute la bande sous 1.
  return { rang: (a * 100 + b * 10 + c) / 1000, nom: `${a}-${b}-${c}`, jetons: 1 };
}

// ---------------------------------------------------------------- motus ---

export type EtatLettre = 'juste' | 'present' | 'absent';

/**
 * Compare une proposition au mot secret, à la manière de Motus.
 *
 * Les deux passages comptent : sans le premier, une lettre bien placée
 * pourrait se faire voler sa correspondance par la même lettre mal placée
 * plus tôt dans le mot. C'est le piège classique de ce genre de jeu, et il
 * ne se voit qu'avec un mot contenant une lettre en double.
 */
export function comparer(proposition: string, secret: string): EtatLettre[] {
  const longueur = secret.length;
  const resultat: EtatLettre[] = Array(longueur).fill('absent');
  const restantes: (string | null)[] = secret.split('');

  // Premier passage : les lettres bien placées.
  for (let i = 0; i < longueur; i++) {
    if (proposition[i] === secret[i]) {
      resultat[i] = 'juste';
      restantes[i] = null;
    }
  }
  // Second passage : les lettres présentes ailleurs.
  for (let i = 0; i < longueur; i++) {
    if (resultat[i] === 'juste') continue;
    const position = restantes.indexOf(proposition[i]);
    if (position !== -1) {
      resultat[i] = 'present';
      restantes[position] = null;
    }
  }
  return resultat;
}
