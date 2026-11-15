/** Les données locales peuvent venir d'une ancienne version ou être corrompues. */
export interface StoredStat {
  plays: number;
  wins: number;
  losses: number;
  draws: number;
  best?: number;
  lastPlayed?: number;
}

function objet(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compteur(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function liste(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string =>
    typeof item === 'string' && item.length > 0))] : [];
}

export function normaliserProgression(value: unknown): {
  stats: Record<string, StoredStat>; favorites: string[]; recent: string[];
} {
  const source = objet(value) ? value : {};
  const stats: Record<string, StoredStat> = Object.create(null);
  if (objet(source.stats)) {
    for (const [id, valeur] of Object.entries(source.stats)) {
      if (!objet(valeur)) continue;
      const stat: StoredStat = { plays: compteur(valeur.plays), wins: compteur(valeur.wins),
        losses: compteur(valeur.losses), draws: compteur(valeur.draws) };
      if (typeof valeur.best === 'number' && Number.isFinite(valeur.best)) stat.best = valeur.best;
      if (typeof valeur.lastPlayed === 'number' && Number.isFinite(valeur.lastPlayed) &&
          valeur.lastPlayed >= 0) stat.lastPlayed = valeur.lastPlayed;
      stats[id] = stat;
    }
  }
  return { stats, favorites: liste(source.favorites), recent: liste(source.recent).slice(0, 12) };
}
