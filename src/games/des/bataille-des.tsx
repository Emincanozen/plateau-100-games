import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Segmented, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'bataille-des',
  name: 'Bataille de dés',
  tagline: 'Attaque à trois dés, défends-en à deux. Les plus forts s’affrontent.',
  category: 'des',
  emoji: '⚔️',
  difficulty: 2,
  players: '1',
  minutes: 6,
  score: 'high',
  scoreUnit: 'victoires',
  tags: ['dés', 'stratégie', 'conquête'],
  rules: [
    'Tu attaques une place forte défendue par des unités. Chaque assaut oppose tes dés aux siens.',
    'Tu lances jusqu’à trois dés, le défenseur deux. On compare le plus fort de chacun, puis le deuxième.',
    'Chaque comparaison perdue coûte une unité — et en cas d’égalité, c’est l’attaquant qui perd.',
    'Prends la place en éliminant toute la défense. Il t’en faut au moins deux pour repartir à l’assaut.',
  ],
};

type Niveau = 'escarmouche' | 'bataille' | 'siege';

const REGLAGES: Record<Niveau, { attaque: number; defense: number }> = {
  escarmouche: { attaque: 10, defense: 6 },
  bataille: { attaque: 12, defense: 10 },
  siege: { attaque: 14, defense: 14 },
};

export default function BatailleDes({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [niveau, setNiveau] = useState<Niveau>('bataille');
  const reglage = REGLAGES[niveau];

  const [attaque, setAttaque] = useState(reglage.attaque);
  const [defense, setDefense] = useState(reglage.defense);
  const [mesDes, setMesDes] = useState<number[]>([]);
  const [sesDes, setSesDes] = useState<number[]>([]);
  const [message, setMessage] = useState('Lance l’assaut');
  const [victoires, setVictoires] = useState(0);
  const [record, setRecord] = useState(false);
  const comptee = useRef(false);

  // Il faut garder une unité sur place : on attaque avec le reste, trois au plus.
  const desAttaque = Math.min(3, Math.max(0, attaque - 1));
  const desDefense = Math.min(2, defense);

  const gagne = defense === 0;
  const perdu = attaque <= 1 && defense > 0;
  const fini = gagne || perdu;

  const reset = useCallback(() => {
    setAttaque(REGLAGES[niveau].attaque);
    setDefense(REGLAGES[niveau].defense);
    setMesDes([]);
    setSesDes([]);
    setMessage('Lance l’assaut');
    setVictoires(0);
    setRecord(false);
    comptee.current = false;
  }, [niveau]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, reset]);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    setRecord(submitScore(victoires + (gagne ? 1 : 0)));
  }, [fini, gagne, victoires, haptic, submitScore]);

  const assaut = () => {
    if (fini) return;
    haptic('medium');

    // Les deux camps lancent, puis on trie par ordre décroissant.
    const mien = Array.from({ length: desAttaque }, () => randBetween(1, 6)).sort((a, b) => b - a);
    const sien = Array.from({ length: desDefense }, () => randBetween(1, 6)).sort((a, b) => b - a);
    setMesDes(mien);
    setSesDes(sien);

    let pertesAttaque = 0;
    let pertesDefense = 0;
    const comparaisons = Math.min(mien.length, sien.length);
    for (let i = 0; i < comparaisons; i++) {
      // L'égalité profite au défenseur : c'est la règle classique.
      if (mien[i] > sien[i]) pertesDefense += 1;
      else pertesAttaque += 1;
    }

    const nouvelleAttaque = attaque - pertesAttaque;
    const nouvelleDefense = defense - pertesDefense;
    setAttaque(nouvelleAttaque);
    setDefense(nouvelleDefense);

    if (nouvelleDefense === 0) {
      setVictoires((v) => v + 1);
      setMessage('La place est prise !');
      return;
    }
    setMessage(
      pertesDefense > pertesAttaque
        ? `Bon assaut : ${pertesDefense} défenseur${pertesDefense > 1 ? 's' : ''} à terre`
        : pertesAttaque > pertesDefense
          ? `Repoussé : tu perds ${pertesAttaque} unité${pertesAttaque > 1 ? 's' : ''}`
          : 'Échange équilibré',
    );
    haptic(pertesDefense > pertesAttaque ? 'success' : 'warning');
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        ⚔ {attaque}
      </Txt>
      <Txt variant="label" tone="danger">
        🛡 {defense}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  // Fonction et non composant : déclaré ici, un composant serait remonté à chaque rendu.
  const rendreArmee = (nombre: number, couleur: string, label: string) => (
    <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
      <Txt style={{ fontSize: 34, fontWeight: '800', color: couleur }}>{nombre}</Txt>
      <Row gap={2} style={{ flexWrap: 'wrap', justifyContent: 'center', maxWidth: 130 }}>
        {Array.from({ length: Math.min(nombre, 16) }, (_, i) => (
          <View
            key={i}
            style={{ width: 8, height: 14, borderRadius: 2, backgroundColor: couleur }}
          />
        ))}
      </Row>
    </View>
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.lg }}>
      <View style={{ width: 300 }}>
        <Segmented<Niveau>
          value={niveau}
          onChange={setNiveau}
          options={[
            { value: 'escarmouche', label: 'Escarmouche' },
            { value: 'bataille', label: 'Bataille' },
            { value: 'siege', label: 'Siège' },
          ]}
          accent="#A96CF0"
        />
      </View>

      <Row style={{ width: '100%' }}>
        {rendreArmee(attaque, '#4BC4D6', 'TON ARMÉE')}
        {rendreArmee(defense, '#E0525F', 'LA DÉFENSE')}
      </Row>

      <View
        style={{
          alignItems: 'center',
          gap: space.md,
          minHeight: 120,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          borderRadius: radius.lg,
          backgroundColor: c.surface,
          alignSelf: 'stretch',
          marginHorizontal: space.lg,
        }}
      >
        <Row gap={space.xl} style={{ justifyContent: 'center' }}>
          <Row gap={4}>
            {mesDes.map((valeur, i) => (
              <De key={i} valeur={valeur} taille={42} tint="#4BC4D6" garde />
            ))}
          </Row>
          <Row gap={4}>
            {sesDes.map((valeur, i) => (
              <De key={i} valeur={valeur} taille={42} tint="#E0525F" garde />
            ))}
          </Row>
        </Row>
        <Txt variant="label" tone="dim" center>
          {message}
        </Txt>
      </View>

      <Button
        label={fini ? 'Bataille terminée' : `Assaut — ${desAttaque} contre ${desDefense} dés`}
        accent="#A96CF0"
        disabled={fini}
        onPress={assaut}
      />

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Place conquise !' : 'Ton armée est brisée'}
        score={victoires + (gagne ? 0 : 0)}
        scoreLabel="Victoires"
        best={best}
        isRecord={record}
        detail={gagne ? `Il te restait ${attaque} unités` : `Il restait ${defense} défenseurs`}
        accent="#A96CF0"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
