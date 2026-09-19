import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useInterval } from '../lib/hooks';
import { DICTIONNAIRE, MOTS_JEU } from '../lib/mots';
import { randInt, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'boggle',
  name: 'Boggle',
  tagline: 'Enchaîne les lettres voisines pour former le plus de mots.',
  category: 'papier',
  emoji: '🎲',
  difficulty: 2,
  players: '1',
  minutes: 4,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['mots', 'rapidité', 'solo'],
  rules: [
    'Touche des lettres qui se touchent — côté ou coin — pour construire un mot.',
    'Une même case ne sert qu’une fois dans un mot, et il faut au moins trois lettres.',
    'Un mot vaut d’autant plus de points qu’il est long : 1 point à trois lettres, 11 à sept.',
    'Trois minutes. Les mots possibles sont comptés à la fin, pour situer ton score.',
  ],
};

const N = 4;
const DUREE = 180;

/** Voisines d'une case, en comptant les diagonales. */
function voisines(index: number): number[] {
  const l = Math.floor(index / N);
  const c = index % N;
  const out: number[] = [];
  for (let dl = -1; dl <= 1; dl++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dl === 0 && dc === 0) continue;
      const nl = l + dl;
      const nc = c + dc;
      if (nl < 0 || nl >= N || nc < 0 || nc >= N) continue;
      out.push(nl * N + nc);
    }
  }
  return out;
}

/**
 * Grille construite autour de mots réels : on trace quelques mots du
 * dictionnaire le long de chemins de cases voisines, puis on comble le reste.
 * Sans cela, une grille purement aléatoire contient très peu de mots français.
 */
function fabriquer(): { lettres: string[]; possibles: string[] } {
  const lettres: string[] = Array(N * N).fill('');
  const candidats = shuffle(MOTS_JEU.filter((m) => m.length >= 4 && m.length <= 7));

  const tracer = (mot: string): boolean => {
    const depart = shuffle(Array.from({ length: N * N }, (_, i) => i));

    const explorer = (index: number, position: number, vus: number[]): number[] | null => {
      const existante = lettres[index];
      if (existante !== '' && existante !== mot[position]) return null;
      const chemin = [...vus, index];
      if (position === mot.length - 1) return chemin;

      for (const voisine of shuffle(voisines(index))) {
        if (chemin.includes(voisine)) continue;
        const suite = explorer(voisine, position + 1, chemin);
        if (suite) return suite;
      }
      return null;
    };

    for (const index of depart) {
      const chemin = explorer(index, 0, []);
      if (chemin) {
        chemin.forEach((caseIndex, k) => (lettres[caseIndex] = mot[k]));
        return true;
      }
    }
    return false;
  };

  let places = 0;
  for (const mot of candidats) {
    if (places >= 5) break;
    if (tracer(mot)) places += 1;
  }

  // Les cases restantes reçoivent des lettres fréquentes en français.
  const FREQUENTES = 'AAAEEEEIIOOUULLNNRRSSTTMCDPBGFHVJZ';
  for (let i = 0; i < lettres.length; i++) {
    if (lettres[i] === '') lettres[i] = FREQUENTES[randInt(FREQUENTES.length)];
  }

  // Recensement des mots réellement traçables, pour situer le score final.
  const possibles = new Set<string>();
  const parcourir = (index: number, courant: string, vus: number[]) => {
    const mot = courant + lettres[index];
    const chemin = [...vus, index];
    if (mot.length >= 3 && DICTIONNAIRE.has(mot)) possibles.add(mot);
    if (mot.length >= 8) return;
    for (const voisine of voisines(index)) {
      if (chemin.includes(voisine)) continue;
      parcourir(voisine, mot, chemin);
    }
  };
  for (let i = 0; i < N * N; i++) parcourir(i, '', []);

  return { lettres, possibles: [...possibles].sort() };
}

const pointsDuMot = (mot: string): number =>
  mot.length <= 4 ? 1 : mot.length === 5 ? 2 : mot.length === 6 ? 3 : mot.length === 7 ? 5 : 11;

export default function Boggle({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(60, 0.4);
  const cellule = Math.floor(largeur / N);

  const [puzzle, setPuzzle] = useState(fabriquer);
  const [chemin, setChemin] = useState<number[]>([]);
  const [trouves, setTrouves] = useState<string[]>([]);
  const [restant, setRestant] = useState(DUREE);
  const [message, setMessage] = useState('Enchaîne des lettres voisines');
  const [record, setRecord] = useState(false);
  const comptee = useRef(false);

  const fini = restant <= 0;
  const mot = chemin.map((i) => puzzle.lettres[i]).join('');
  const score = useMemo(() => trouves.reduce((total, m) => total + pointsDuMot(m), 0), [trouves]);

  const reset = useCallback(() => {
    setPuzzle(fabriquer());
    setChemin([]);
    setTrouves([]);
    setRestant(DUREE);
    setMessage('Enchaîne des lettres voisines');
    setRecord(false);
    comptee.current = false;
  }, []);

  useFrameRestart(reset);

  useInterval(() => setRestant((s) => Math.max(0, s - 1)), fini ? null : 1000);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic('success');
    setRecord(submitScore(score));
  }, [fini, score, haptic, submitScore]);

  const toucher = (index: number) => {
    if (fini) return;

    // Retoucher la dernière lettre la retire : on corrige sans tout reprendre.
    if (chemin.length > 0 && chemin[chemin.length - 1] === index) {
      setChemin((ch) => ch.slice(0, -1));
      return;
    }
    if (chemin.includes(index)) return;
    if (chemin.length > 0 && !voisines(chemin[chemin.length - 1]).includes(index)) {
      haptic('warning');
      setMessage('Les lettres doivent se toucher');
      return;
    }
    haptic('light');
    setMessage('');
    setChemin((ch) => [...ch, index]);
  };

  const valider = () => {
    if (fini) return;
    if (mot.length < 3) {
      setMessage('Trois lettres au minimum');
      haptic('warning');
      return;
    }
    if (trouves.includes(mot)) {
      setMessage(`${mot} est déjà trouvé`);
      haptic('warning');
      setChemin([]);
      return;
    }
    if (!DICTIONNAIRE.has(mot)) {
      setMessage(`${mot} n’est pas dans le dictionnaire du jeu`);
      haptic('error');
      setChemin([]);
      return;
    }
    haptic('success');
    setTrouves((t) => [...t, mot]);
    setMessage(`${mot} · +${pointsDuMot(mot)}`);
    setChemin([]);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {score} pts
      </Txt>
      <Txt variant="label" tone={restant <= 30 ? 'danger' : 'faint'}>
        {formatClock(restant)}
      </Txt>
      <Txt variant="label" tone="faint">
        {trouves.length} mots
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-around', paddingVertical: space.md }}>
      <View
        style={{
          width: cellule * N,
          height: cellule * N,
          flexDirection: 'row',
          flexWrap: 'wrap',
        }}
      >
        {puzzle.lettres.map((lettre, i) => {
          const position = chemin.indexOf(i);
          const choisie = position >= 0;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Lettre ${lettre}`}
              onPress={() => toucher(i)}
              style={{
                width: cellule - 4,
                height: cellule - 4,
                margin: 2,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: choisie ? '#4BC4D6' : c.surface,
                borderWidth: 2,
                borderColor: choisie ? '#4BC4D6' : c.border,
              }}
            >
              <Txt
                style={{
                  fontSize: cellule * 0.42,
                  fontWeight: '800',
                  color: choisie ? '#FFFFFF' : c.text,
                }}
              >
                {lettre}
              </Txt>
              {choisie ? (
                <Txt style={{ position: 'absolute', bottom: 2, right: 5, fontSize: 9, color: '#FFFFFFAA' }}>
                  {position + 1}
                </Txt>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <View
          style={{
            minWidth: 160,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
            borderRadius: radius.md,
            backgroundColor: c.surfaceAlt,
            alignItems: 'center',
          }}
        >
          <Txt variant="h3">{mot || '—'}</Txt>
        </View>
        <Txt variant="caption" tone="faint" center>
          {message}
        </Txt>
        <Row gap={space.sm}>
          <Button label="Valider" accent="#4BC4D6" disabled={fini || mot.length < 3} onPress={valider} />
          <Button label="Effacer" kind="secondary" disabled={chemin.length === 0} onPress={() => setChemin([])} />
        </Row>
      </View>

      <Row gap={5} style={{ flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: space.md }}>
        {trouves.map((m) => (
          <View
            key={m}
            style={{
              paddingHorizontal: space.sm,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: '#4BC4D622',
            }}
          >
            <Txt variant="caption" style={{ color: '#4BC4D6' }}>
              {m}
            </Txt>
          </View>
        ))}
      </Row>

      <GameOver
        visible={fini}
        outcome="over"
        title="Temps écoulé"
        score={score}
        best={best}
        isRecord={record}
        detail={`${trouves.length} mots trouvés sur ${puzzle.possibles.length} possibles`}
        accent="#4BC4D6"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
