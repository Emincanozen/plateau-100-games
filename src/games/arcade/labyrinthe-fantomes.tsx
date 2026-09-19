import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { CroixDirectionnelle, Row, Txt, GameOver, useClavier, type Direction } from '@/ui';
import { useInterval } from '../lib/hooks';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'labyrinthe-fantomes',
  name: 'Labyrinthe aux fantômes',
  tagline: 'Avale toutes les pastilles sans te faire attraper.',
  category: 'arcade',
  emoji: '👻',
  difficulty: 2,
  players: '1',
  minutes: 6,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['culte', 'labyrinthe', 'solo'],
  rules: [
    'Avale toutes les pastilles du labyrinthe pour passer au niveau suivant.',
    'Les quatre grosses pastilles des coins rendent les fantômes vulnérables pendant quelques secondes.',
    'Un fantôme vulnérable avalé rapporte gros et repart de sa base.',
    'Trois vies. Les couloirs latéraux font le tour de l’écran.',
  ],
};

/**
 * Le labyrinthe : # mur, . pastille, o super-pastille, espace vide,
 * P départ du joueur, G base des fantômes.
 */
const PLAN = [
  '###################',
  '#o.......#.......o#',
  '#.##.###.#.###.##.#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '   #.#.......#.#   ',
  '####.#.##G##.#.####',
  '.......#GGG#.......',
  '####.#.#####.#.####',
  '   #.#.......#.#   ',
  '####.#.#####.#.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.......P...#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];

const LIGNES = PLAN.length;
const COLONNES = PLAN[0].length;

type Case = 'mur' | 'vide';
interface Position {
  l: number;
  c: number;
}

const DELTAS: Record<Direction, Position> = {
  haut: { l: -1, c: 0 },
  bas: { l: 1, c: 0 },
  gauche: { l: 0, c: -1 },
  droite: { l: 0, c: 1 },
};

function lireMurs(): Case[][] {
  return PLAN.map((ligne) =>
    ligne.split('').map((ch) => (ch === '#' ? 'mur' : 'vide') as Case),
  );
}

function lirePastilles(): (0 | 1 | 2)[][] {
  return PLAN.map((ligne) =>
    ligne.split('').map((ch) => (ch === '.' ? 1 : ch === 'o' ? 2 : 0) as 0 | 1 | 2),
  );
}

function trouver(symbole: string): Position {
  for (let l = 0; l < LIGNES; l++) {
    const c = PLAN[l].indexOf(symbole);
    if (c >= 0) return { l, c };
  }
  return { l: 1, c: 1 };
}

const memePosition = (a: Position, b: Position) => a.l === b.l && a.c === b.c;

export default function LabyrintheFantomes({ submitScore, best, haptic }: GameScreenProps) {
  const { c: couleurs, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const CASE = Math.floor(Math.min((winWidth - 24) / COLONNES, (winHeight * 0.52) / LIGNES));
  const W = CASE * COLONNES;
  const H = CASE * LIGNES;

  const [score, setScore] = useState(0);
  const [vies, setVies] = useState(3);
  const [niveau, setNiveau] = useState(1);
  const [restantes, setRestantes] = useState(0);
  const [over, setOver] = useState(false);
  const [, rendre] = useState(0);
  const [record, setRecord] = useState(false);

  const murs = useRef<Case[][]>(lireMurs());
  const pastilles = useRef<(0 | 1 | 2)[][]>(lirePastilles());
  const joueur = useRef<Position>(trouver('P'));
  const direction = useRef<Direction>('gauche');
  const souhaitee = useRef<Direction>('gauche');
  const fantomes = useRef<{ pos: Position; dir: Direction }[]>([]);
  const effraye = useRef(0);
  const scoreRef = useRef(0);
  const viesRef = useRef(3);
  const niveauRef = useRef(1);
  const vivant = useRef(true);

  const baseFantomes = useCallback((): { pos: Position; dir: Direction }[] => {
    const base = trouver('G');
    return [
      { pos: { ...base }, dir: 'gauche' },
      { pos: { l: base.l + 1, c: base.c }, dir: 'droite' },
      { pos: { l: base.l + 1, c: base.c + 1 }, dir: 'haut' },
      { pos: { l: base.l + 1, c: base.c - 1 }, dir: 'bas' },
    ];
  }, []);

  const compterPastilles = () =>
    pastilles.current.reduce(
      (total, ligne) => total + ligne.filter((p) => p !== 0).length,
      0,
    );

  const reset = useCallback(() => {
    murs.current = lireMurs();
    pastilles.current = lirePastilles();
    joueur.current = trouver('P');
    direction.current = 'gauche';
    souhaitee.current = 'gauche';
    fantomes.current = baseFantomes();
    effraye.current = 0;
    scoreRef.current = 0;
    viesRef.current = 3;
    niveauRef.current = 1;
    vivant.current = true;
    setScore(0);
    setVies(3);
    setNiveau(1);
    setRestantes(compterPastilles());
    setOver(false);
    setRecord(false);
  }, [baseFantomes]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  /** Case suivante dans une direction, avec passage par les bords. */
  const avancer = useCallback((pos: Position, dir: Direction): Position => {
    const delta = DELTAS[dir];
    let l = pos.l + delta.l;
    let c = pos.c + delta.c;
    if (c < 0) c = COLONNES - 1;
    else if (c >= COLONNES) c = 0;
    if (l < 0) l = LIGNES - 1;
    else if (l >= LIGNES) l = 0;
    return { l, c };
  }, []);

  const libre = useCallback((pos: Position) => murs.current[pos.l]?.[pos.c] !== 'mur', []);

  const perdreUneVie = useCallback(() => {
    viesRef.current -= 1;
    setVies(viesRef.current);
    haptic('error');
    if (viesRef.current <= 0) {
      vivant.current = false;
      setOver(true);
      setRecord(submitScore(scoreRef.current));
      return;
    }
    joueur.current = trouver('P');
    direction.current = 'gauche';
    souhaitee.current = 'gauche';
    fantomes.current = baseFantomes();
    effraye.current = 0;
  }, [haptic, submitScore, baseFantomes]);

  const verifierCollisions = useCallback(() => {
    for (const fantome of fantomes.current) {
      if (!memePosition(fantome.pos, joueur.current)) continue;
      if (effraye.current > 0) {
        fantome.pos = trouver('G');
        scoreRef.current += 200;
        setScore(scoreRef.current);
        haptic('success');
      } else {
        perdreUneVie();
        return true;
      }
    }
    return false;
  }, [haptic, perdreUneVie]);

  /** Un pas de jeu : le joueur avance, puis les fantômes. */
  const tick = useCallback(() => {
    if (!vivant.current) return;

    // On prend la direction souhaitée dès qu'elle devient possible.
    if (libre(avancer(joueur.current, souhaitee.current))) direction.current = souhaitee.current;
    const suivante = avancer(joueur.current, direction.current);
    if (libre(suivante)) joueur.current = suivante;

    // Pastilles.
    const pastille = pastilles.current[joueur.current.l][joueur.current.c];
    if (pastille !== 0) {
      pastilles.current[joueur.current.l][joueur.current.c] = 0;
      scoreRef.current += pastille === 2 ? 50 : 10;
      setScore(scoreRef.current);
      if (pastille === 2) {
        effraye.current = 30;
        haptic('medium');
      }
      const reste = compterPastilles();
      setRestantes(reste);

      if (reste === 0) {
        niveauRef.current += 1;
        setNiveau(niveauRef.current);
        pastilles.current = lirePastilles();
        joueur.current = trouver('P');
        fantomes.current = baseFantomes();
        effraye.current = 0;
        setRestantes(compterPastilles());
        haptic('success');
        return;
      }
    }

    if (verifierCollisions()) return;

    if (effraye.current > 0) effraye.current -= 1;

    // Fantômes : ils choisissent une direction à chaque intersection,
    // en se rapprochant du joueur — ou en fuyant s'ils sont vulnérables.
    for (const fantome of fantomes.current) {
      const options = (['haut', 'bas', 'gauche', 'droite'] as Direction[]).filter((dir) =>
        libre(avancer(fantome.pos, dir)),
      );
      const opposee: Record<Direction, Direction> = {
        haut: 'bas',
        bas: 'haut',
        gauche: 'droite',
        droite: 'gauche',
      };
      // On évite le demi-tour tant qu'il reste un autre choix.
      const sansRetour = options.filter((dir) => dir !== opposee[fantome.dir]);
      const choix = sansRetour.length > 0 ? sansRetour : options;

      let meilleure = choix[0];
      if (Math.random() < 0.78) {
        let meilleureDistance = effraye.current > 0 ? -Infinity : Infinity;
        for (const dir of choix) {
          const cible = avancer(fantome.pos, dir);
          const distance = Math.hypot(cible.l - joueur.current.l, cible.c - joueur.current.c);
          const mieux =
            effraye.current > 0 ? distance > meilleureDistance : distance < meilleureDistance;
          if (mieux) {
            meilleureDistance = distance;
            meilleure = dir;
          }
        }
      } else {
        meilleure = pick(choix);
      }

      fantome.dir = meilleure;
      fantome.pos = avancer(fantome.pos, meilleure);
    }

    verifierCollisions();
    rendre((n) => (n + 1) % 1000);
  }, [libre, avancer, verifierCollisions, baseFantomes, haptic]);

  // Le rythme s'accélère avec les niveaux.
  useInterval(tick, over ? null : Math.max(105, 190 - niveau * 12));

  const tourner = useCallback((dir: Direction) => {
    souhaitee.current = dir;
  }, []);

  useClavier(
    {
      ArrowUp: () => tourner('haut'),
      ArrowDown: () => tourner('bas'),
      ArrowLeft: () => tourner('gauche'),
      ArrowRight: () => tourner('droite'),
    },
    !over,
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {score} pts
      </Txt>
      <Txt variant="label" tone="faint">
        Niv. {niveau} · {restantes}
      </Txt>
      <Txt variant="label" tone="danger">
        {'😀'.repeat(Math.max(0, vies))}
      </Txt>
    </Row>,
  );

  const teintesFantomes = ['#FF6B78', '#FFB86B', '#6BD5FF', '#FF8BD5'];

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View
        style={{
          width: W,
          height: H,
          backgroundColor: '#05060E',
          borderRadius: radius.sm,
          overflow: 'hidden',
        }}
      >
        {murs.current.map((ligne, l) =>
          ligne.map((caseMur, c) =>
            caseMur === 'mur' ? (
              <View
                key={`m${l}-${c}`}
                style={{
                  position: 'absolute',
                  left: c * CASE,
                  top: l * CASE,
                  width: CASE,
                  height: CASE,
                  backgroundColor: '#1E2A6B',
                  borderRadius: 2,
                }}
              />
            ) : null,
          ),
        )}

        {pastilles.current.map((ligne, l) =>
          ligne.map((pastille, c) =>
            pastille !== 0 ? (
              <View
                key={`p${l}-${c}`}
                style={{
                  position: 'absolute',
                  left: c * CASE + CASE / 2 - (pastille === 2 ? CASE * 0.26 : CASE * 0.1),
                  top: l * CASE + CASE / 2 - (pastille === 2 ? CASE * 0.26 : CASE * 0.1),
                  width: pastille === 2 ? CASE * 0.52 : CASE * 0.2,
                  height: pastille === 2 ? CASE * 0.52 : CASE * 0.2,
                  borderRadius: CASE,
                  backgroundColor: pastille === 2 ? '#EFB93B' : '#E8E4C8',
                }}
              />
            ) : null,
          ),
        )}

        {fantomes.current.map((fantome, i) => (
          <View
            key={`f${i}`}
            style={{
              position: 'absolute',
              left: fantome.pos.c * CASE,
              top: fantome.pos.l * CASE,
              width: CASE,
              height: CASE,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: effraye.current > 0 ? '#2B3A8A' : teintesFantomes[i] + '33',
              borderRadius: CASE / 2,
            }}
          >
            <Txt style={{ fontSize: CASE * 0.75 }}>{effraye.current > 0 ? '💙' : '👻'}</Txt>
          </View>
        ))}

        <View
          style={{
            position: 'absolute',
            left: joueur.current.c * CASE,
            top: joueur.current.l * CASE,
            width: CASE,
            height: CASE,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt style={{ fontSize: CASE * 0.8 }}>😀</Txt>
        </View>
      </View>

      <CroixDirectionnelle onDirection={tourner} taille={46} tint="#F0A03033" />

      <GameOver
        visible={over}
        outcome="over"
        title="Attrapé"
        score={score}
        best={best}
        isRecord={record}
        detail={`Niveau ${niveau}`}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
