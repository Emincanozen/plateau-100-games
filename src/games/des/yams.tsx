import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'yams',
  name: 'Yams',
  tagline: 'Trois lancers par tour pour remplir la meilleure combinaison.',
  category: 'des',
  emoji: '🎲',
  difficulty: 2,
  players: '1',
  minutes: 12,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['dés', 'classique', 'solo'],
  rules: [
    'À chaque tour tu lances cinq dés, puis tu peux relancer deux fois ceux que tu veux.',
    'Touche un dé pour le garder ; touche-le à nouveau pour le relâcher.',
    'Choisis ensuite une combinaison libre où inscrire ton résultat — une seule fois chacune.',
    'La section du haut donne 35 points de bonus si elle atteint 63. Treize tours, puis le total.',
  ],
};

type Dice = number[];
type Figure =
  | 'as' | 'deux' | 'trois' | 'quatre' | 'cinq' | 'six'
  | 'brelan' | 'carre' | 'full' | 'petiteSuite' | 'grandeSuite' | 'yams' | 'chance';

const HAUT: Figure[] = ['as', 'deux', 'trois', 'quatre', 'cinq', 'six'];
const BAS: Figure[] = ['brelan', 'carre', 'full', 'petiteSuite', 'grandeSuite', 'yams', 'chance'];

const LABELS: Record<Figure, string> = {
  as: 'As (1)',
  deux: 'Deux',
  trois: 'Trois',
  quatre: 'Quatre',
  cinq: 'Cinq',
  six: 'Six',
  brelan: 'Brelan',
  carre: 'Carré',
  full: 'Full',
  petiteSuite: 'Petite suite',
  grandeSuite: 'Grande suite',
  yams: 'Yams',
  chance: 'Chance',
};

const compte = (dice: Dice, face: number) => dice.filter((d) => d === face).length;
const somme = (dice: Dice) => dice.reduce((a, b) => a + b, 0);

function occurrences(dice: Dice): number[] {
  const out = Array(7).fill(0);
  dice.forEach((d) => (out[d] += 1));
  return out;
}

/** Longueur de la plus longue suite de faces consecutives. */
function plusLongueSuite(dice: Dice): number {
  const presentes = new Set(dice);
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

export function valeurFigure(figure: Figure, dice: Dice): number {
  const occ = occurrences(dice);
  switch (figure) {
    case 'as':
      return compte(dice, 1) * 1;
    case 'deux':
      return compte(dice, 2) * 2;
    case 'trois':
      return compte(dice, 3) * 3;
    case 'quatre':
      return compte(dice, 4) * 4;
    case 'cinq':
      return compte(dice, 5) * 5;
    case 'six':
      return compte(dice, 6) * 6;
    case 'brelan':
      return occ.some((n) => n >= 3) ? somme(dice) : 0;
    case 'carre':
      return occ.some((n) => n >= 4) ? somme(dice) : 0;
    case 'full':
      return occ.some((n) => n === 3) && occ.some((n) => n === 2) ? 25 : 0;
    case 'petiteSuite':
      return plusLongueSuite(dice) >= 4 ? 30 : 0;
    case 'grandeSuite':
      return plusLongueSuite(dice) >= 5 ? 40 : 0;
    case 'yams':
      return occ.some((n) => n === 5) ? 50 : 0;
    case 'chance':
      return somme(dice);
  }
}

const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const lancer = (): Dice => Array.from({ length: 5 }, () => randBetween(1, 6));

export default function Yams({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [dice, setDice] = useState<Dice>(lancer);
  const [gardes, setGardes] = useState<boolean[]>([false, false, false, false, false]);
  const [lancersRestants, setLancersRestants] = useState(2);
  const [grille, setGrille] = useState<Partial<Record<Figure, number>>>({});
  const [record, setRecord] = useState(false);
  const [scored, setScored] = useState(false);

  const totalHaut = useMemo(
    () => HAUT.reduce((sum, f) => sum + (grille[f] ?? 0), 0),
    [grille],
  );
  const bonus = totalHaut >= 63 ? 35 : 0;
  const totalBas = useMemo(() => BAS.reduce((sum, f) => sum + (grille[f] ?? 0), 0), [grille]);
  const total = totalHaut + bonus + totalBas;

  const toursJoues = Object.keys(grille).length;
  const fini = toursJoues === 13;

  const reset = useCallback(() => {
    setDice(lancer());
    setGardes([false, false, false, false, false]);
    setLancersRestants(2);
    setGrille({});
    setRecord(false);
    setScored(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || scored) return;
    setScored(true);
    haptic('success');
    setRecord(submitScore(total));
  }, [fini, scored, total, haptic, submitScore]);

  const relancer = () => {
    if (lancersRestants <= 0 || fini) return;
    haptic('medium');
    setDice((d) => d.map((valeur, i) => (gardes[i] ? valeur : randBetween(1, 6))));
    setLancersRestants((n) => n - 1);
  };

  const inscrire = (figure: Figure) => {
    if (grille[figure] !== undefined || fini) return;
    haptic('success');
    setGrille((g) => ({ ...g, [figure]: valeurFigure(figure, dice) }));
    setDice(lancer());
    setGardes([false, false, false, false, false]);
    setLancersRestants(2);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Total <Txt variant="label">{total}</Txt>
      </Txt>
      <Txt variant="label" tone="faint">
        Tour {Math.min(toursJoues + 1, 13)}/13
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, gap: space.md, paddingTop: space.sm }}>
      <Row gap={space.sm} style={{ justifyContent: 'center' }}>
        {dice.map((valeur, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Dé ${valeur}${gardes[i] ? ', gardé' : ''}`}
            onPress={() => {
              haptic('light');
              setGardes((g) => g.map((garde, j) => (i === j ? !garde : garde)));
            }}
            style={{
              width: 54,
              height: 54,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: gardes[i] ? '#A96CF0' : c.surfaceAlt,
              borderWidth: 2,
              borderColor: gardes[i] ? '#A96CF0' : c.border,
            }}
          >
            <Txt style={{ fontSize: 36, color: gardes[i] ? '#FFFFFF' : c.text, lineHeight: 44 }}>
              {FACES[valeur]}
            </Txt>
          </Pressable>
        ))}
      </Row>

      <Row gap={space.md} style={{ justifyContent: 'center' }}>
        <Button
          label={lancersRestants > 0 ? `Relancer (${lancersRestants})` : 'Plus de lancer'}
          onPress={relancer}
          disabled={lancersRestants <= 0 || fini}
          accent="#A96CF0"
        />
        <Txt variant="caption" tone="faint" style={{ alignSelf: 'center' }}>
          Touche un dé pour le garder
        </Txt>
      </Row>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4 }}>
          <Txt variant="caption" tone="faint">
            SECTION HAUTE {totalHaut}/63 {bonus ? '· bonus +35' : ''}
          </Txt>
          {HAUT.map((figure) => (
            <LigneFigure
              key={figure}
              figure={figure}
              dice={dice}
              inscrit={grille[figure]}
              onPress={() => inscrire(figure)}
            />
          ))}

          <Txt variant="caption" tone="faint" style={{ marginTop: space.sm }}>
            SECTION BASSE
          </Txt>
          {BAS.map((figure) => (
            <LigneFigure
              key={figure}
              figure={figure}
              dice={dice}
              inscrit={grille[figure]}
              onPress={() => inscrire(figure)}
            />
          ))}
        </View>
      </ScrollView>

      <GameOver
        visible={fini}
        outcome="over"
        title="Feuille complète"
        score={total}
        best={best}
        isRecord={record}
        detail={bonus ? 'Bonus de 35 points obtenu' : `Section haute : ${totalHaut}/63`}
        accent="#A96CF0"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}

function LigneFigure({
  figure,
  dice,
  inscrit,
  onPress,
}: {
  figure: Figure;
  dice: Dice;
  inscrit?: number;
  onPress: () => void;
}) {
  const { c, radius, space } = useTheme();
  const potentiel = valeurFigure(figure, dice);
  const pris = inscrit !== undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${LABELS[figure]}${pris ? `, inscrit ${inscrit}` : `, vaudrait ${potentiel}`}`}
      disabled={pris}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: space.md,
        paddingVertical: 10,
        borderRadius: radius.sm,
        backgroundColor: pris ? c.surfaceAlt : pressed ? c.surfacePressed : c.surface,
        opacity: pris ? 0.6 : 1,
      })}
    >
      <Txt variant="label">{LABELS[figure]}</Txt>
      <Txt
        variant="label"
        style={{
          color: pris ? c.textDim : potentiel > 0 ? '#A96CF0' : c.textFaint,
          fontVariant: ['tabular-nums'],
        }}
      >
        {pris ? inscrit : potentiel}
      </Txt>
    </Pressable>
  );
}
