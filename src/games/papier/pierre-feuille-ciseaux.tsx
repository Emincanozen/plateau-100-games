import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'pierre-feuille-ciseaux',
  name: 'Pierre-feuille-ciseaux',
  tagline: 'Simple — sauf que l’ordinateur apprend tes habitudes.',
  category: 'papier',
  emoji: '✌️',
  difficulty: 1,
  players: '1',
  minutes: 3,
  score: 'high',
  scoreUnit: 'manches',
  tags: ['rapide', 'psychologie', 'classique'],
  rules: [
    'La pierre casse les ciseaux, les ciseaux coupent la feuille, la feuille enveloppe la pierre.',
    'Le premier à cinq manches gagnées remporte la partie.',
    'En mode Devin, l’ordinateur mémorise tes enchaînements et anticipe ton prochain coup.',
    'Contre un joueur qui se répète, il devient très difficile à battre : varie.',
  ],
};

type Coup = 'pierre' | 'feuille' | 'ciseaux';
type Mode = 'hasard' | 'devin';

const COUPS: Coup[] = ['pierre', 'feuille', 'ciseaux'];
const EMOJIS: Record<Coup, string> = { pierre: '✊', feuille: '✋', ciseaux: '✌️' };
const BAT: Record<Coup, Coup> = { pierre: 'ciseaux', feuille: 'pierre', ciseaux: 'feuille' };
/** Le coup qui bat celui donné. */
const CONTRE: Record<Coup, Coup> = { pierre: 'feuille', feuille: 'ciseaux', ciseaux: 'pierre' };

const OBJECTIF = 5;

export default function PierreFeuilleCiseaux({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [mode, setMode] = useState<Mode>('devin');
  const [mesVictoires, setMesVictoires] = useState(0);
  const [sesVictoires, setSesVictoires] = useState(0);
  const [nuls, setNuls] = useState(0);
  const [monCoup, setMonCoup] = useState<Coup | null>(null);
  const [sonCoup, setSonCoup] = useState<Coup | null>(null);
  const [message, setMessage] = useState('Choisis ton coup');
  const [record, setRecord] = useState(false);

  /** Table de transition : après tel coup, le joueur a joué tel autre. */
  const transitions = useRef<Record<Coup, Record<Coup, number>>>({
    pierre: { pierre: 0, feuille: 0, ciseaux: 0 },
    feuille: { pierre: 0, feuille: 0, ciseaux: 0 },
    ciseaux: { pierre: 0, feuille: 0, ciseaux: 0 },
  });
  const dernierCoup = useRef<Coup | null>(null);
  const comptee = useRef(false);

  const fini = mesVictoires >= OBJECTIF || sesVictoires >= OBJECTIF;
  const gagne = mesVictoires >= OBJECTIF;

  const reset = useCallback(() => {
    setMesVictoires(0);
    setSesVictoires(0);
    setNuls(0);
    setMonCoup(null);
    setSonCoup(null);
    setMessage('Choisis ton coup');
    setRecord(false);
    transitions.current = {
      pierre: { pierre: 0, feuille: 0, ciseaux: 0 },
      feuille: { pierre: 0, feuille: 0, ciseaux: 0 },
      ciseaux: { pierre: 0, feuille: 0, ciseaux: 0 },
    };
    dernierCoup.current = null;
    comptee.current = false;
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    setRecord(submitScore(mesVictoires));
  }, [fini, gagne, mesVictoires, haptic, submitScore]);

  /** Prédiction : le coup le plus probable après le dernier coup joué. */
  const choisirCoupOrdinateur = (): Coup => {
    if (mode === 'hasard' || dernierCoup.current === null) return COUPS[randInt(3)];

    const suite = transitions.current[dernierCoup.current];
    const total = suite.pierre + suite.feuille + suite.ciseaux;
    // Pas assez d'observations : on reste imprévisible.
    if (total < 2) return COUPS[randInt(3)];

    let prevu: Coup = 'pierre';
    for (const coup of COUPS) if (suite[coup] > suite[prevu]) prevu = coup;
    // Une part de hasard, sinon il devient lisible à son tour.
    return Math.random() < 0.78 ? CONTRE[prevu] : COUPS[randInt(3)];
  };

  const jouer = (coup: Coup) => {
    if (fini) return;
    const sien = choisirCoupOrdinateur();

    // On apprend l'enchaînement avant de remplacer le dernier coup.
    if (dernierCoup.current !== null) {
      transitions.current[dernierCoup.current][coup] += 1;
    }
    dernierCoup.current = coup;

    setMonCoup(coup);
    setSonCoup(sien);

    if (coup === sien) {
      setNuls((n) => n + 1);
      setMessage('Égalité');
      haptic('warning');
    } else if (BAT[coup] === sien) {
      setMesVictoires((v) => v + 1);
      setMessage(`${EMOJIS[coup]} bat ${EMOJIS[sien]} — manche gagnée`);
      haptic('success');
    } else {
      setSesVictoires((v) => v + 1);
      setMessage(`${EMOJIS[sien]} bat ${EMOJIS[coup]} — manche perdue`);
      haptic('error');
    }
  };

  const observations = useMemo(
    () =>
      COUPS.reduce(
        (total, coup) =>
          total +
          transitions.current[coup].pierre +
          transitions.current[coup].feuille +
          transitions.current[coup].ciseaux,
        0,
      ),
    // Recalculé à chaque manche jouée.
    [mesVictoires, sesVictoires, nuls],
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {mesVictoires} – {sesVictoires}
      </Txt>
      {nuls > 0 ? (
        <Txt variant="label" tone="faint">
          {nuls} nuls
        </Txt>
      ) : null}
      {mode === 'devin' ? (
        <Txt variant="label" tone="faint">
          {observations} observés
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.lg }}>
      <View style={{ width: 300 }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'hasard', label: 'Pur hasard' },
            { value: 'devin', label: 'Devin' },
          ]}
          accent="#4BC4D6"
        />
      </View>

      <Row gap={space.xl} style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Txt style={{ fontSize: 58 }}>{monCoup ? EMOJIS[monCoup] : '❔'}</Txt>
          <Txt variant="caption" tone="faint">
            TOI
          </Txt>
        </View>
        <Txt variant="h2" tone="faint">
          vs
        </Txt>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Txt style={{ fontSize: 58 }}>{sonCoup ? EMOJIS[sonCoup] : '❔'}</Txt>
          <Txt variant="caption" tone="faint">
            ORDINATEUR
          </Txt>
        </View>
      </Row>

      <Txt variant="h3" center tone="dim">
        {message}
      </Txt>

      <Row gap={space.sm} style={{ justifyContent: 'center' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={`m${i}`}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: i < mesVictoires ? '#34B37E' : c.surfaceAlt,
            }}
          />
        ))}
        <View style={{ width: space.md }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={`s${i}`}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: i < sesVictoires ? '#E0525F' : c.surfaceAlt,
            }}
          />
        ))}
      </Row>

      <Row gap={space.md}>
        {COUPS.map((coup) => (
          <Pressable
            key={coup}
            accessibilityRole="button"
            accessibilityLabel={coup}
            disabled={fini}
            onPress={() => jouer(coup)}
            style={({ pressed }) => ({
              width: 86,
              height: 86,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? c.surfacePressed : c.surface,
              borderWidth: 2,
              borderColor: c.border,
              opacity: fini ? 0.45 : 1,
            })}
          >
            <Txt style={{ fontSize: 40 }}>{EMOJIS[coup]}</Txt>
          </Pressable>
        ))}
      </Row>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Partie gagnée !' : 'L’ordinateur t’a cerné'}
        score={mesVictoires}
        scoreLabel="Manches gagnées"
        best={best}
        isRecord={record}
        detail={`${mesVictoires} – ${sesVictoires}${nuls > 0 ? ` · ${nuls} nuls` : ''}`}
        accent="#4BC4D6"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
