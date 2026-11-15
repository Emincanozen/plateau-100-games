import assert from 'node:assert/strict';
import { normaliserProgression } from '../src/engine/progress-data';

for (const valeur of [null, false, 7, 'texte', [], { stats: null, favorites: null, recent: {} }]) {
  const resultat = normaliserProgression(valeur);
  assert.equal(Object.keys(resultat.stats).length, 0);
  assert.deepEqual(resultat.favorites, []);
  assert.deepEqual(resultat.recent, []);
}
const resultat = normaliserProgression({
  stats: { echecs: { plays: -1, wins: '4', losses: 2, draws: 1.5, best: NaN },
    serpent: { plays: 12, wins: 3, best: 42, lastPlayed: 1234 }, invalide: null },
  favorites: ['echecs', 'echecs', null, 4, ''],
  recent: Array.from({ length: 20 }, (_, i) => `jeu-${i}`),
});
assert.deepEqual(resultat.favorites, ['echecs']);
assert.equal(resultat.recent.length, 12);
assert.deepEqual(resultat.stats.echecs, { plays: 0, wins: 0, losses: 2, draws: 0 });
assert.equal(resultat.stats.serpent?.best, 42);
assert.equal(resultat.stats.serpent?.plays, 12);
assert.equal(resultat.stats.invalide, undefined);
console.log('Stockage : données invalides neutralisées, progression valide conservée.');
