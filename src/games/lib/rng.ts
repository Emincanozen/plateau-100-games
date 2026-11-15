/** Utilitaires d'aléatoire partagés par tous les jeux. */

export function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

export function randBetween(min: number, maxInclusive: number): number {
  return min + randInt(maxInclusive - min + 1);
}

export function pick<T>(items: readonly T[]): T {
  return items[randInt(items.length)];
}

/** Mélange de Fisher-Yates, sur une copie. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Générateur déterministe (mulberry32) pour les puzzles du jour. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
