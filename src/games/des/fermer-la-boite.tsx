import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'fermer-la-boite',
  name: 'Fermer la boîte',
  tagline: 'Rabats les volets qui totalisent ton lancer. Objectif : tous.',
  category: 'des',
  emoji: '📦',
  difficulty: 2,
  players: '1',
  minutes: 5,
  score: 'low',
  scoreUnit: 'pts restants',
  tags: ['dés', 'calcul', 'solo'],
  rules: [
    'Lance les dés, puis rabats un ou plusieurs volets dont la somme égale ton lancer.',
    'Exemple : avec un 9, tu peux fermer le 9, ou le 4 et le 5, ou le 1, le 3 et le 5.',
    'Quand tous les volets restants valent 6 ou moins, tu ne lances plus qu’un seul dé.',
    'La partie s’arrête si aucune combinaison ne convient. Le score est la somme des volets restés ouverts — zéro est parfait.',
  ],
};

const VOLETS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Existe-t-il un sous-ensemble des volets ouverts dont la somme vaut `cible` ? */
function combinaisonPossible(ouverts: number[], cible: number): boolean {
  if (cible === 0) return true;
  if (cible < 0 || ouverts.length === 0) return false;
  const [premier, ...reste] = ouverts;
  return combinaisonPossible(reste, cible - premier) || combinaisonPossible(reste, cible);
}

export default function FermerLaBoite({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [fermes, setFermes] = useState<number[]>([]);
  const [des, setDes] = useState<number[]>([1, 1]);
  const [selection, setSelection] = useState<number[]>([]);
  const [lance, setLance] = useState(false);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const ouverts = useMemo(() => VOLETS.filter((v) => !fermes.includes(v)), [fermes]);
  const sommeOuverte = ouverts.reduce((a, b) => a + b, 0);
  const total = des.reduce((a, b) => a + b, 0);
  const sommeSelection = selection.reduce((a, b) => a + b, 0);

  // Un seul dé quand tout ce qui reste tient sous 6 : règle classique.
  const unSeulDe = ouverts.every((v) => v <= 6);

  const gagne = ouverts.length === 0;
  const bloque = lance && !gagne && !combinaisonPossible(ouverts, total);
  const fini = gagne || bloque;

  const reset = useCallback(() => {
    setFermes([]);
    setDes([1, 1]);
    setSelection([]);
    setLance(false);
    setRecord(false);
    setComptee(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : 'error');
    setRecord(submitScore(sommeOuverte));
  }, [fini, comptee, gagne, sommeOuverte, haptic, submitScore]);

  const lancer = () => {
    if (fini) return;
    haptic('medium');
    setDes(unSeulDe ? [randBetween(1, 6)] : [randBetween(1, 6), randBetween(1, 6)]);
    setSelection([]);
    setLance(true);
  };

  const basculer = (volet: number) => {
    if (!lance || fini || fermes.includes(volet)) return;
    haptic('light');
    setSelection((s) => (s.includes(volet) ? s.filter((v) => v !== volet) : [...s, volet]));
  };

  const valider = () => {
    if (sommeSelection !== total || selection.length === 0) return;
    haptic('success');
    setFermes((f) => [...f, ...selection]);
    setSelection([]);
    setLance(false);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Restant {sommeOuverte}
      </Txt>
      {lance ? (
        <Txt variant="label" tone="warning">
          Lancer {total}
        </Txt>
      ) : null}
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          LES VOLETS
        </Txt>
        <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center', maxWidth: 340 }}>
          {VOLETS.map((volet) => {
            const ferme = fermes.includes(volet);
            const choisi = selection.includes(volet);
            return (
              <Pressable
                key={volet}
                accessibilityRole="button"
                accessibilityLabel={`Volet ${volet}${ferme ? ', fermé' : choisi ? ', sélectionné' : ''}`}
                onPress={() => basculer(volet)}
                style={{
                  width: 46,
                  height: 62,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: ferme ? c.surfaceAlt : choisi ? '#A96CF0' : c.surface,
                  borderWidth: 2,
                  borderColor: ferme ? c.border : choisi ? '#A96CF0' : c.borderStrong,
                  opacity: ferme ? 0.35 : 1,
                }}
              >
                <Txt
                  style={{
                    fontSize: 26,
                    fontWeight: '800',
                    color: choisi ? '#FFFFFF' : ferme ? c.textFaint : c.text,
                    textDecorationLine: ferme ? 'line-through' : 'none',
                  }}
                >
                  {volet}
                </Txt>
              </Pressable>
            );
          })}
        </Row>
      </View>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <Row gap={space.md}>
          {des.map((valeur, i) => (
            <De key={i} valeur={valeur} taille={64} eteint={!lance} />
          ))}
        </Row>
        <Txt variant="label" tone={sommeSelection === total && lance ? 'success' : 'dim'}>
          {!lance
            ? unSeulDe
              ? 'Un seul dé à ce stade'
              : 'Lance les dés'
            : `Sélection ${sommeSelection} / ${total}`}
        </Txt>
      </View>

      <Row gap={space.md}>
        <Button
          label="Lancer"
          accent="#A96CF0"
          disabled={lance || fini}
          onPress={lancer}
        />
        <Button
          label="Fermer"
          kind="secondary"
          disabled={!lance || fini || sommeSelection !== total || selection.length === 0}
          onPress={valider}
        />
      </Row>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'over'}
        title={gagne ? 'Boîte fermée !' : 'Aucune combinaison possible'}
        score={sommeOuverte}
        scoreLabel="Points restants"
        best={best}
        isRecord={record}
        detail={gagne ? 'Score parfait' : `Il te restait ${ouverts.join(', ')}`}
        accent="#A96CF0"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
