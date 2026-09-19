import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, CroixDirectionnelle, Row, Txt, GameOver, useClavier, type Direction } from '@/ui';
import { useBoardSize } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'sokoban',
  name: 'Sokoban',
  tagline: 'Pousse les caisses sur les cibles. On ne tire jamais.',
  category: 'logique',
  emoji: '📦',
  difficulty: 3,
  players: '1',
  minutes: 12,
  score: 'low',
  scoreUnit: 'poussées',
  tags: ['puzzle', 'solo', 'réflexion'],
  rules: [
    'Déplace le gardien avec les boutons ou les flèches du clavier.',
    'Une caisse se pousse, jamais ne se tire, et une seule à la fois.',
    'Pose toutes les caisses sur les cibles marquées au sol.',
    'Une caisse coincée dans un coin est perdue : annule, ou recommence le niveau.',
  ],
};

/**
 * Niveaux au format texte : # mur, espace sol, . cible,
 * $ caisse, * caisse déjà sur cible, @ gardien, + gardien sur cible.
 */
const NIVEAUX: string[][] = [
  [
    '#######',
    '#     #',
    '# .$. #',
    '#  $  #',
    '# .$. #',
    '#  @  #',
    '#######',
  ],
  [
    '########',
    '#  .   #',
    '# $$$  #',
    '# .@.  #',
    '#      #',
    '########',
  ],
  [
    '########',
    '#      #',
    '# .##. #',
    '# $  $ #',
    '#  @   #',
    '# $  $ #',
    '# .##. #',
    '########',
  ],
  [
    '#########',
    '#   #   #',
    '# $ # . #',
    '#  $$.  #',
    '# . @   #',
    '#   #   #',
    '#########',
  ],
  [
    '##########',
    '#        #',
    '#  ....  #',
    '#  $$$$  #',
    '#        #',
    '#   @    #',
    '##########',
  ],
  [
    '########',
    '#. #   #',
    '#  $   #',
    '#  #$# #',
    '#. $ . #',
    '#  @   #',
    '########',
  ],
];

interface Etat {
  murs: boolean[];
  cibles: boolean[];
  caisses: number[];
  gardien: number;
  colonnes: number;
  lignes: number;
}

function lireNiveau(plan: string[]): Etat {
  const lignes = plan.length;
  const colonnes = Math.max(...plan.map((l) => l.length));
  const murs: boolean[] = [];
  const cibles: boolean[] = [];
  const caisses: number[] = [];
  let gardien = 0;

  for (let l = 0; l < lignes; l++) {
    for (let c = 0; c < colonnes; c++) {
      const symbole = plan[l][c] ?? ' ';
      const index = l * colonnes + c;
      murs.push(symbole === '#');
      cibles.push(symbole === '.' || symbole === '*' || symbole === '+');
      if (symbole === '$' || symbole === '*') caisses.push(index);
      if (symbole === '@' || symbole === '+') gardien = index;
    }
  }

  return { murs, cibles, caisses, gardien, colonnes, lignes };
}

const DELTAS: Record<Direction, { l: number; c: number }> = {
  haut: { l: -1, c: 0 },
  bas: { l: 1, c: 0 },
  gauche: { l: 0, c: -1 },
  droite: { l: 0, c: 1 },
};

export default function Sokoban({ submitScore, best, haptic }: GameScreenProps) {
  const { c: couleurs, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.44);

  const [niveau, setNiveau] = useState(0);
  const [etat, setEtat] = useState<Etat>(() => lireNiveau(NIVEAUX[0]));
  const [historique, setHistorique] = useState<{ caisses: number[]; gardien: number }[]>([]);
  const [poussees, setPoussees] = useState(0);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const cellule = Math.floor(
    Math.min(largeur / etat.colonnes, (largeur * 1.1) / etat.lignes),
  );

  const gagne = useMemo(
    () => etat.caisses.every((index) => etat.cibles[index]),
    [etat.caisses, etat.cibles],
  );
  const dernierNiveau = niveau === NIVEAUX.length - 1;
  const fini = gagne && dernierNiveau;

  const chargerNiveau = useCallback((index: number) => {
    setEtat(lireNiveau(NIVEAUX[index]));
    setHistorique([]);
    setNiveau(index);
  }, []);

  const reset = useCallback(() => {
    chargerNiveau(0);
    setPoussees(0);
    setRecord(false);
    setComptee(false);
  }, [chargerNiveau]);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(poussees));
  }, [fini, comptee, poussees, haptic, submitScore]);

  // Niveau suivant après une courte pause de satisfaction.
  useEffect(() => {
    if (!gagne || dernierNiveau) return;
    haptic('success');
    const id = setTimeout(() => chargerNiveau(niveau + 1), 900);
    return () => clearTimeout(id);
  }, [gagne, dernierNiveau, niveau, chargerNiveau, haptic]);

  const deplacer = useCallback(
    (direction: Direction) => {
      if (gagne) return;
      const delta = DELTAS[direction];
      const pas = delta.l * etat.colonnes + delta.c;
      const devant = etat.gardien + pas;
      const apres = devant + pas;

      if (etat.murs[devant]) {
        haptic('warning');
        return;
      }

      const caisseDevant = etat.caisses.includes(devant);
      if (caisseDevant) {
        // On ne pousse qu'une caisse, et seulement vers une case libre.
        if (etat.murs[apres] || etat.caisses.includes(apres)) {
          haptic('warning');
          return;
        }
        haptic('medium');
        setHistorique((h) => [...h, { caisses: etat.caisses.slice(), gardien: etat.gardien }]);
        setEtat((e) => ({
          ...e,
          caisses: e.caisses.map((index) => (index === devant ? apres : index)),
          gardien: devant,
        }));
        setPoussees((n) => n + 1);
        return;
      }

      haptic('light');
      setHistorique((h) => [...h, { caisses: etat.caisses.slice(), gardien: etat.gardien }]);
      setEtat((e) => ({ ...e, gardien: devant }));
    },
    [gagne, etat, haptic],
  );

  const annuler = () => {
    if (historique.length === 0) return;
    haptic('light');
    const precedent = historique[historique.length - 1];
    setEtat((e) => ({ ...e, caisses: precedent.caisses, gardien: precedent.gardien }));
    setHistorique((h) => h.slice(0, -1));
  };

  useClavier(
    {
      ArrowUp: () => deplacer('haut'),
      ArrowDown: () => deplacer('bas'),
      ArrowLeft: () => deplacer('gauche'),
      ArrowRight: () => deplacer('droite'),
    },
    !fini,
  );

  const surCible = etat.caisses.filter((index) => etat.cibles[index]).length;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Niveau {niveau + 1}/{NIVEAUX.length}
      </Txt>
      <Txt variant="label" tone="faint">
        {surCible}/{etat.caisses.length} posées
      </Txt>
      <Txt variant="label" tone="faint">
        {poussees} poussées
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View
        style={{
          width: cellule * etat.colonnes,
          height: cellule * etat.lignes,
          borderRadius: radius.sm,
          overflow: 'hidden',
          backgroundColor: couleurs.surface,
        }}
      >
        {etat.murs.map((mur, i) => {
          const l = Math.floor(i / etat.colonnes);
          const c = i % etat.colonnes;
          const cible = etat.cibles[i];
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: c * cellule,
                top: l * cellule,
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: mur ? '#5A4636' : couleurs.surfaceAlt,
                borderWidth: mur ? 0 : 0.5,
                borderColor: couleurs.border,
              }}
            >
              {cible && !mur ? (
                <View
                  style={{
                    width: cellule * 0.28,
                    height: cellule * 0.28,
                    borderRadius: cellule,
                    backgroundColor: '#34B37E',
                  }}
                />
              ) : null}
            </View>
          );
        })}

        {etat.caisses.map((index, i) => {
          const l = Math.floor(index / etat.colonnes);
          const c = index % etat.colonnes;
          const posee = etat.cibles[index];
          return (
            <View
              key={`caisse${i}`}
              style={{
                position: 'absolute',
                left: c * cellule + cellule * 0.08,
                top: l * cellule + cellule * 0.08,
                width: cellule * 0.84,
                height: cellule * 0.84,
                borderRadius: 4,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: posee ? '#34B37E' : '#C8903A',
                borderWidth: 2,
                borderColor: posee ? '#1E7A52' : '#8A5E22',
              }}
            >
              <Txt style={{ fontSize: cellule * 0.42 }}>📦</Txt>
            </View>
          );
        })}

        <View
          style={{
            position: 'absolute',
            left: (etat.gardien % etat.colonnes) * cellule,
            top: Math.floor(etat.gardien / etat.colonnes) * cellule,
            width: cellule,
            height: cellule,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt style={{ fontSize: cellule * 0.7 }}>🧍</Txt>
        </View>
      </View>

      <Row gap={space.xl} align="center">
        <CroixDirectionnelle onDirection={deplacer} taille={44} tint="#34B37E22" />
        <View style={{ gap: space.sm }}>
          <Button
            label="Annuler"
            kind="secondary"
            size="sm"
            disabled={historique.length === 0}
            onPress={annuler}
          />
          <Button
            label="Recommencer"
            kind="ghost"
            size="sm"
            onPress={() => chargerNiveau(niveau)}
          />
        </View>
      </Row>

      <GameOver
        visible={fini}
        outcome="win"
        title="Les six niveaux sont bouclés !"
        score={poussees}
        scoreLabel="Poussées"
        best={best}
        isRecord={record}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
