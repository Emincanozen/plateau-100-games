import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Txt, GameOver } from '@/ui';
import { ALPHABET, MOTS_COURANTS } from '../lib/mots';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'pendu',
  name: 'Le pendu',
  tagline: 'Devine le mot lettre par lettre avant que le dessin soit complet.',
  category: 'papier',
  emoji: '✏️',
  difficulty: 1,
  players: '1',
  minutes: 3,
  score: 'high',
  scoreUnit: 'série',
  tags: ['mots', 'classique', 'solo'],
  rules: [
    'Choisis une lettre : si elle est dans le mot, elle apparaît à toutes ses positions.',
    'Chaque lettre absente ajoute un trait au pendu. Six erreurs et c’est perdu.',
    'Un indice est affiché sous le mot pour t’aiguiller.',
    'Le record retenu est ta plus longue série de mots trouvés d’affilée.',
  ],
};

const MAX_ERREURS = 6;

export default function Pendu({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [entree, setEntree] = useState(() => pick(MOTS_COURANTS));
  const [essayees, setEssayees] = useState<string[]>([]);
  const [serie, setSerie] = useState(0);
  const [record, setRecord] = useState(false);

  const erreurs = useMemo(
    () => essayees.filter((l) => !entree.mot.includes(l)).length,
    [essayees, entree.mot],
  );

  const lettresTrouvees = useMemo(
    () => new Set(entree.mot.split('').filter((l) => essayees.includes(l))),
    [entree.mot, essayees],
  );

  const gagne = useMemo(
    () => entree.mot.split('').every((l) => essayees.includes(l)),
    [entree.mot, essayees],
  );
  const perdu = erreurs >= MAX_ERREURS;
  const fini = gagne || perdu;

  const nouveauMot = useCallback(() => {
    setEntree((precedent) => {
      let suivant = pick(MOTS_COURANTS);
      // Evite de retomber immediatement sur le meme mot.
      while (suivant.mot === precedent.mot) suivant = pick(MOTS_COURANTS);
      return suivant;
    });
    setEssayees([]);
  }, []);

  const reset = useCallback(() => {
    nouveauMot();
    setSerie(0);
    setRecord(false);
  }, [nouveauMot]);

  useFrameRestart(reset);

  // Fin de manche : on met a jour la serie une seule fois.
  const [manchComptee, setMancheComptee] = useState(false);
  useEffect(() => {
    if (!fini || manchComptee) return;
    setMancheComptee(true);
    if (gagne) {
      haptic('success');
      const suivante = serie + 1;
      setSerie(suivante);
      setRecord(submitScore(suivante));
    } else {
      haptic('error');
      setRecord(submitScore(serie));
    }
  }, [fini, manchComptee, gagne, serie, haptic, submitScore]);

  useEffect(() => {
    setMancheComptee(false);
  }, [entree]);

  const jouer = (lettre: string) => {
    if (fini || essayees.includes(lettre)) return;
    haptic(entree.mot.includes(lettre) ? 'light' : 'warning');
    setEssayees((e) => [...e, lettre]);
  };

  const continuer = () => {
    if (gagne) {
      nouveauMot();
    } else {
      setSerie(0);
      nouveauMot();
    }
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Série {serie}
      </Txt>
      <Txt variant="label" tone="faint">
        {MAX_ERREURS - erreurs} vies
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md }}>
      <Potence erreurs={erreurs} stroke={c.text} accent={c.danger} />

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {entree.mot.split('').map((lettre, i) => (
            <View
              key={i}
              style={{
                width: 26,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: c.borderStrong,
                paddingBottom: 2,
              }}
            >
              <Txt style={{ fontSize: 24, fontWeight: '800' }}>
                {lettresTrouvees.has(lettre) || perdu ? lettre : ' '}
              </Txt>
            </View>
          ))}
        </Row>
        <Txt variant="caption" tone="faint">
          Indice : {entree.indice}
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
        {ALPHABET.map((lettre) => {
          const essayee = essayees.includes(lettre);
          const juste = essayee && entree.mot.includes(lettre);
          return (
            <Pressable
              key={lettre}
              accessibilityRole="button"
              accessibilityLabel={`Lettre ${lettre}`}
              disabled={essayee || fini}
              onPress={() => jouer(lettre)}
              style={{
                width: 34,
                height: 40,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: essayee ? (juste ? '#34B37E' : c.surfaceAlt) : c.surface,
                borderWidth: 1,
                borderColor: c.border,
                opacity: essayee && !juste ? 0.4 : 1,
              }}
            >
              <Txt
                variant="label"
                style={{ color: juste ? '#FFFFFF' : c.text, fontSize: 16 }}
              >
                {lettre}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Trouvé !' : 'Pendu…'}
        detail={gagne ? `Série de ${serie}` : `Le mot était ${entree.mot}`}
        score={gagne ? serie : undefined}
        scoreLabel="Série"
        best={best}
        isRecord={record}
        accent="#4BC4D6"
        onReplay={continuer}
        onQuit={reset}
      />
    </View>
  );
}

/** Dessin progressif : une partie du corps par erreur. */
function Potence({ erreurs, stroke, accent }: { erreurs: number; stroke: string; accent: string }) {
  const trait = { stroke, strokeWidth: 4, strokeLinecap: 'round' as const };
  const corps = { stroke: accent, strokeWidth: 4, strokeLinecap: 'round' as const };

  return (
    <Svg width={180} height={200} viewBox="0 0 180 200">
      {/* Potence, toujours visible */}
      <Line x1="20" y1="190" x2="120" y2="190" {...trait} />
      <Line x1="55" y1="190" x2="55" y2="20" {...trait} />
      <Line x1="55" y1="20" x2="125" y2="20" {...trait} />
      <Line x1="125" y1="20" x2="125" y2="45" {...trait} />

      {erreurs > 0 ? <Circle cx="125" cy="62" r="17" {...corps} fill="none" /> : null}
      {erreurs > 1 ? <Line x1="125" y1="79" x2="125" y2="130" {...corps} /> : null}
      {erreurs > 2 ? <Line x1="125" y1="92" x2="100" y2="115" {...corps} /> : null}
      {erreurs > 3 ? <Line x1="125" y1="92" x2="150" y2="115" {...corps} /> : null}
      {erreurs > 4 ? <Line x1="125" y1="130" x2="105" y2="165" {...corps} /> : null}
      {erreurs > 5 ? <Line x1="125" y1="130" x2="145" y2="165" {...corps} /> : null}
    </Svg>
  );
}
