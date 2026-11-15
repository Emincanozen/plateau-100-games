import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Txt, GameOver } from '@/ui';
import { formatClock, useTimer } from '../lib/hooks';
import { pick, randBetween, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'compte-est-bon',
  name: 'Le compte est bon',
  tagline: 'Six nombres, quatre opérations, un total à atteindre.',
  category: 'logique',
  emoji: '🔢',
  difficulty: 3,
  players: '1',
  minutes: 5,
  score: 'low',
  scoreUnit: 'écart',
  tags: ['calcul', 'solo', 'télé'],
  rules: [
    'Touche un nombre, une opération, puis un second nombre : le résultat remplace les deux.',
    'Chaque nombre ne sert qu’une fois. Les divisions doivent tomber juste et les soustractions rester positives.',
    'Il n’est pas obligatoire d’utiliser les six nombres.',
    'Le score est l’écart avec la cible — zéro est le compte exact.',
  ],
};

type Operation = '+' | '−' | '×' | '÷';

interface Nombre {
  id: number;
  valeur: number;
  /** Expression qui a produit ce nombre, pour l'afficher à la fin. */
  detail: string;
  utilise: boolean;
}

const GROS = [25, 50, 75, 100];

function tirage(): { nombres: number[]; cible: number } {
  const nombreDeGros = randBetween(0, 2);
  const petits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const nombres = shuffle([
    ...shuffle(GROS).slice(0, nombreDeGros),
    ...petits.slice(0, 6 - nombreDeGros),
  ]);
  return { nombres, cible: randBetween(101, 999) };
}

function appliquer(a: number, b: number, operation: Operation): number | null {
  switch (operation) {
    case '+':
      return a + b;
    case '−':
      return a - b > 0 ? a - b : null;
    case '×':
      return a * b;
    case '÷':
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/**
 * Meilleure valeur atteignable, par exploration exhaustive des paires.
 * Six nombres donnent au plus quelques centaines de milliers d'états :
 * c'est instantané, et ça permet d'afficher une solution honnête.
 */
export function meilleureApproche(
  nombres: number[],
  cible: number,
): { valeur: number; etapes: string[] } {
  let meilleure = { valeur: nombres[0], etapes: [] as string[] };
  let meilleurEcart = Math.abs(nombres[0] - cible);

  const explorer = (restants: number[], etapes: string[]) => {
    for (const valeur of restants) {
      const ecart = Math.abs(valeur - cible);
      if (ecart < meilleurEcart) {
        meilleurEcart = ecart;
        meilleure = { valeur, etapes: etapes.slice() };
      }
    }
    if (meilleurEcart === 0 || restants.length < 2) return;

    for (let i = 0; i < restants.length; i++) {
      for (let j = 0; j < restants.length; j++) {
        if (i === j) continue;
        const a = restants[i];
        const b = restants[j];
        const reste = restants.filter((_, k) => k !== i && k !== j);

        for (const operation of ['+', '−', '×', '÷'] as Operation[]) {
          // L'addition et la multiplication sont commutatives : une seule fois.
          if ((operation === '+' || operation === '×') && i > j) continue;
          const resultat = appliquer(a, b, operation);
          if (resultat === null) continue;
          explorer([...reste, resultat], [...etapes, `${a} ${operation} ${b} = ${resultat}`]);
          if (meilleurEcart === 0) return;
        }
      }
    }
  };

  explorer(nombres, []);
  return meilleure;
}

export default function CompteEstBon({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [donne, setDonne] = useState(tirage);
  const [nombres, setNombres] = useState<Nombre[]>([]);
  const [premier, setPremier] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [fini, setFini] = useState(false);
  const [record, setRecord] = useState(false);
  const [prochainId, setProchainId] = useState(100);

  const disponibles = useMemo(() => nombres.filter((n) => !n.utilise), [nombres]);
  const meilleurEcart = useMemo(
    () => Math.min(...disponibles.map((n) => Math.abs(n.valeur - donne.cible))),
    [disponibles, donne.cible],
  );
  const exact = meilleurEcart === 0;
  const secondes = useTimer(!fini, donne);

  const nouvelleDonne = useCallback(() => {
    const fraiche = tirage();
    setDonne(fraiche);
    setNombres(
      fraiche.nombres.map((valeur, i) => ({ id: i, valeur, detail: String(valeur), utilise: false })),
    );
    setPremier(null);
    setOperation(null);
    setFini(false);
    setRecord(false);
    setProchainId(100);
  }, []);

  useEffect(() => {
    nouvelleDonne();
  }, [nouvelleDonne]);

  useFrameRestart(nouvelleDonne);

  // Le compte exact clôt la manche immédiatement.
  useEffect(() => {
    if (!exact || fini || nombres.length === 0) return;
    setFini(true);
    haptic('success');
    setRecord(submitScore(0));
  }, [exact, fini, nombres.length, haptic, submitScore]);

  const toucherNombre = (id: number) => {
    if (fini) return;
    const nombre = nombres.find((n) => n.id === id);
    if (!nombre || nombre.utilise) return;

    if (premier === null) {
      haptic('light');
      setPremier(id);
      return;
    }
    if (premier === id) {
      setPremier(null);
      setOperation(null);
      return;
    }
    if (operation === null) {
      setPremier(id);
      return;
    }

    const a = nombres.find((n) => n.id === premier)!;
    const resultat = appliquer(a.valeur, nombre.valeur, operation);
    if (resultat === null) {
      haptic('warning');
      setPremier(null);
      setOperation(null);
      return;
    }

    haptic('medium');
    setNombres((liste) => [
      ...liste.map((n) => (n.id === premier || n.id === id ? { ...n, utilise: true } : n)),
      {
        id: prochainId,
        valeur: resultat,
        detail: `${a.valeur} ${operation} ${nombre.valeur}`,
        utilise: false,
      },
    ]);
    setProchainId((n) => n + 1);
    setPremier(null);
    setOperation(null);
  };

  const abandonner = () => {
    if (fini) return;
    setFini(true);
    haptic('warning');
    setRecord(submitScore(meilleurEcart));
  };

  const solution = useMemo(
    () => (fini && !exact ? meilleureApproche(donne.nombres, donne.cible) : null),
    [fini, exact, donne],
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Cible {donne.cible}
      </Txt>
      <Txt variant="label" tone={exact ? 'success' : 'faint'}>
        écart {meilleurEcart}
      </Txt>
      <Txt variant="label" tone="faint">
        {formatClock(secondes)}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', paddingVertical: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <Txt variant="caption" tone="faint">
          LE COMPTE À TROUVER
        </Txt>
        <Txt style={{ fontSize: 52, fontWeight: '800', color: '#34B37E' }}>{donne.cible}</Txt>
      </View>

      <View style={{ gap: space.md }}>
        <Row gap={space.sm} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {disponibles.map((nombre) => {
            const choisi = premier === nombre.id;
            return (
              <Pressable
                key={nombre.id}
                accessibilityRole="button"
                accessibilityLabel={`Nombre ${nombre.valeur}`}
                onPress={() => toucherNombre(nombre.id)}
                style={{
                  minWidth: 64,
                  paddingHorizontal: space.md,
                  paddingVertical: space.md,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor: choisi ? '#34B37E' : c.surface,
                  borderWidth: 2,
                  borderColor: choisi ? '#34B37E' : c.border,
                }}
              >
                <Txt
                  style={{
                    fontSize: 24,
                    fontWeight: '800',
                    color: choisi ? '#FFFFFF' : c.text,
                  }}
                >
                  {nombre.valeur}
                </Txt>
                {nombre.detail !== String(nombre.valeur) ? (
                  <Txt variant="caption" style={{ color: choisi ? '#FFFFFFAA' : c.textFaint, fontSize: 9 }}>
                    {nombre.detail}
                  </Txt>
                ) : null}
              </Pressable>
            );
          })}
        </Row>

        <Row gap={space.sm} style={{ justifyContent: 'center' }}>
          {(['+', '−', '×', '÷'] as Operation[]).map((op) => (
            <Pressable
              key={op}
              accessibilityRole="button"
              accessibilityLabel={`Opération ${op}`}
              disabled={premier === null || fini}
              onPress={() => {
                haptic('light');
                setOperation(op);
              }}
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: operation === op ? '#34B37E' : c.surfaceAlt,
                opacity: premier === null || fini ? 0.4 : 1,
              }}
            >
              <Txt style={{ fontSize: 26, color: operation === op ? '#FFFFFF' : c.text }}>{op}</Txt>
            </Pressable>
          ))}
        </Row>

        <Txt variant="caption" tone="faint" center>
          {premier === null
            ? 'Choisis un premier nombre'
            : operation === null
              ? 'Choisis une opération'
              : 'Choisis le second nombre'}
        </Txt>
      </View>

      <Row gap={space.md} style={{ justifyContent: 'center' }}>
        <Button label="Je donne ma langue au chat" kind="secondary" size="sm" disabled={fini} onPress={abandonner} />
        <Button label="Nouveau tirage" kind="ghost" size="sm" onPress={nouvelleDonne} />
      </Row>

      <GameOver
        visible={fini}
        outcome={exact ? 'win' : 'over'}
        title={exact ? 'Le compte est bon !' : `Le compte n’est pas bon`}
        score={meilleurEcart}
        scoreLabel="Écart"
        best={best}
        isRecord={record}
        detail={
          solution
            ? solution.valeur === donne.cible
              ? `C’était faisable : ${solution.etapes.join(' · ')}`
              : `Le mieux possible était ${solution.valeur} : ${solution.etapes.join(' · ')}`
            : `En ${formatClock(secondes)}`
        }
        accent="#34B37E"
        onReplay={nouvelleDonne}
        onQuit={nouvelleDonne}
      />
    </View>
  );
}
