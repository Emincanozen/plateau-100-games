import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';
import { shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'memory',
  name: 'Memory',
  tagline: 'Retrouve les paires avec le moins de coups possible.',
  category: 'logique',
  emoji: '🧠',
  difficulty: 1,
  players: '1-2',
  minutes: 5,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['mémoire', 'famille', 'duo'],
  rules: [
    'Retourne deux cartes : si elles sont identiques, la paire reste découverte.',
    'Sinon les deux cartes se retournent et c’est au tour suivant.',
    'En solo, le but est de tout découvrir en un minimum de coups.',
    'En duo, chaque paire trouvée rapporte un point et rejoue immédiatement.',
  ],
};

const SYMBOLS = [
  '🍎', '🍋', '🍇', '🍓', '🥝', '🍑', '🍒', '🥥',
  '🐙', '🦋', '🐞', '🐳', '🦊', '🐸', '🦉', '🐨',
  '⚓', '🎈', '🎸', '🚀', '⛵', '🔔', '🎲', '🧩',
];

type Level = 'petit' | 'moyen' | 'grand';
type Mode = 'solo' | 'duo';

const LAYOUT: Record<Level, { pairs: number; cols: number }> = {
  petit: { pairs: 6, cols: 3 },
  moyen: { pairs: 10, cols: 4 },
  grand: { pairs: 18, cols: 6 },
};

interface CardState {
  symbol: string;
  matched: boolean;
}

function buildDeck(pairs: number): CardState[] {
  const chosen = shuffle(SYMBOLS).slice(0, pairs);
  return shuffle([...chosen, ...chosen]).map((symbol) => ({ symbol, matched: false }));
}

export default function Memory({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const width = useBoardSize(32, 0.56);

  const [level, setLevel] = useState<Level>('moyen');
  const [mode, setMode] = useState<Mode>('solo');
  const { pairs, cols } = LAYOUT[level];
  const cell = Math.floor((width - (cols + 1) * 6) / cols);

  const [deck, setDeck] = useState<CardState[]>(() => buildDeck(pairs));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [points, setPoints] = useState<[number, number]>([0, 0]);
  const [record, setRecord] = useState(false);
  const lockRef = useRef(false);

  const found = useMemo(() => deck.filter((card) => card.matched).length / 2, [deck]);
  const finished = found === pairs && pairs > 0;
  const seconds = useTimer(!finished, `${level}-${mode}`);

  const reset = useCallback(() => {
    lockRef.current = false;
    setDeck(buildDeck(LAYOUT[level].pairs));
    setFlipped([]);
    setMoves(0);
    setTurn(0);
    setPoints([0, 0]);
    setRecord(false);
  }, [level]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [level, mode, reset]);

  const scored = useRef(false);
  useEffect(() => {
    if (!finished || scored.current) return;
    scored.current = true;
    haptic('success');
    if (mode === 'solo') setRecord(submitScore(moves));
  }, [finished, moves, mode, haptic, submitScore]);

  useEffect(() => {
    scored.current = false;
  }, [level, mode, deck]);

  const flip = (index: number) => {
    if (lockRef.current || finished) return;
    if (deck[index].matched || flipped.includes(index)) return;

    const next = [...flipped, index];
    setFlipped(next);
    haptic('light');

    if (next.length < 2) return;

    setMoves((m) => m + 1);
    const [a, b] = next;

    if (deck[a].symbol === deck[b].symbol) {
      haptic('success');
      setDeck((d) => d.map((card, i) => (i === a || i === b ? { ...card, matched: true } : card)));
      setFlipped([]);
      if (mode === 'duo') {
        setPoints((p) => {
          const copy: [number, number] = [...p];
          copy[turn] += 1;
          return copy;
        });
      }
      return;
    }

    // Laisse le temps de voir la seconde carte avant de la retourner.
    lockRef.current = true;
    setTimeout(() => {
      setFlipped([]);
      lockRef.current = false;
      if (mode === 'duo') setTurn((t) => (t === 0 ? 1 : 0));
    }, 750);
  };

  useFrameStatus(
    <Row gap={space.md}>
      {mode === 'solo' ? (
        <>
          <Txt variant="label" tone="dim">
            {moves} coups
          </Txt>
          <Txt variant="label" tone="faint">
            {formatClock(seconds)}
          </Txt>
          {best !== undefined ? (
            <Txt variant="label" tone="faint">
              Record {best}
            </Txt>
          ) : null}
        </>
      ) : (
        <Txt variant="label" tone="dim">
          Joueur {turn + 1} · {points[0]} – {points[1]}
        </Txt>
      )}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: space.md, paddingTop: space.sm }}>
      <View style={{ width, gap: space.sm }}>
        <Segmented<Level>
          value={level}
          onChange={setLevel}
          options={[
            { value: 'petit', label: '6 paires' },
            { value: 'moyen', label: '10 paires' },
            { value: 'grand', label: '18 paires' },
          ]}
          accent="#34B37E"
        />
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'solo', label: 'Solo' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View
        style={{
          width: cols * (cell + 6),
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {deck.map((card, i) => {
          const visible = card.matched || flipped.includes(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={visible ? `Carte ${card.symbol}` : 'Carte face cachée'}
              onPress={() => flip(i)}
              style={{
                width: cell,
                height: cell,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: card.matched
                  ? '#34B37E22'
                  : visible
                    ? c.surface
                    : c.surfaceAlt,
                borderWidth: visible ? 1 : 0,
                borderColor: '#34B37E55',
                opacity: card.matched ? 0.55 : 1,
              }}
            >
              <Txt style={{ fontSize: cell * 0.5 }}>{visible ? card.symbol : '?'}</Txt>
            </Pressable>
          );
        })}
      </View>

      <GameOver
        visible={finished}
        outcome="win"
        title={
          mode === 'solo'
            ? 'Toutes les paires !'
            : points[0] === points[1]
              ? 'Égalité'
              : `Joueur ${points[0] > points[1] ? 1 : 2} gagne`
        }
        score={mode === 'solo' ? moves : `${points[0]} – ${points[1]}`}
        scoreLabel={mode === 'solo' ? 'Coups' : 'Score'}
        best={mode === 'solo' ? best : undefined}
        isRecord={record}
        detail={mode === 'solo' ? `En ${formatClock(seconds)}` : undefined}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
