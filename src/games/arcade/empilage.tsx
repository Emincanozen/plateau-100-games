import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Txt, GameOver, useClavier } from '@/ui';
import { useRafLoop } from '../lib/hooks';

export const meta: GameMeta = {
  id: 'empilage',
  name: 'Empilage',
  tagline: 'Pose chaque bloc pile sur le précédent. Ce qui dépasse est perdu.',
  category: 'arcade',
  emoji: '🏗️',
  difficulty: 1,
  players: '1',
  minutes: 3,
  score: 'high',
  scoreUnit: 'étages',
  tags: ['réflexe', 'solo', 'précision'],
  rules: [
    'Un bloc glisse de gauche à droite. Touche l’écran pour le lâcher.',
    'La partie qui dépasse du bloc du dessous est coupée : la tour rétrécit.',
    'Un dépôt parfait ne coupe rien — et te rend un peu de largeur.',
    'Le bloc va de plus en plus vite. La partie s’arrête quand il ne reste plus rien à poser.',
  ],
};

interface Bloc {
  x: number;
  largeur: number;
  couleur: string;
}

const HAUTEUR_BLOC = 22;
const TEINTES = ['#E0525F', '#EE7A4C', '#F0A030', '#EFB93B', '#8FCB52', '#34B37E', '#4BC4D6', '#7C9CF0', '#8B7DFF'];

export default function Empilage({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 400);
  const H = Math.min(winHeight * 0.58, 520);
  const VISIBLES = Math.floor(H / HAUTEUR_BLOC) - 1;

  const [etages, setEtages] = useState(0);
  const [over, setOver] = useState(false);
  const [parfaits, setParfaits] = useState(0);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  const tour = useRef<Bloc[]>([]);
  const mobile = useRef<Bloc>({ x: 0, largeur: W * 0.6, couleur: TEINTES[0] });
  const direction = useRef(1);
  const vitesse = useRef(2.2);
  const vivant = useRef(true);
  const etagesRef = useRef(0);
  const parfaitsRef = useRef(0);

  const reset = useCallback(() => {
    const base: Bloc = { x: (W - W * 0.6) / 2, largeur: W * 0.6, couleur: TEINTES[0] };
    tour.current = [base];
    mobile.current = { x: 0, largeur: base.largeur, couleur: TEINTES[1] };
    direction.current = 1;
    vitesse.current = 2.2;
    vivant.current = true;
    etagesRef.current = 0;
    parfaitsRef.current = 0;
    setEtages(0);
    setParfaits(0);
    setOver(false);
    setRecord(false);
  }, [W]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  const poser = useCallback(() => {
    if (!vivant.current) return;

    const dessous = tour.current[tour.current.length - 1];
    const bloc = mobile.current;

    // Chevauchement entre le bloc lâché et celui du dessous.
    const gauche = Math.max(bloc.x, dessous.x);
    const droite = Math.min(bloc.x + bloc.largeur, dessous.x + dessous.largeur);
    const largeur = droite - gauche;

    if (largeur <= 2) {
      vivant.current = false;
      setOver(true);
      haptic('error');
      setRecord(submitScore(etagesRef.current));
      return;
    }

    const decalage = Math.abs(bloc.x - dessous.x);
    const parfait = decalage < 4;

    if (parfait) {
      // Récompense : on rend un peu de largeur, sans dépasser l'original.
      parfaitsRef.current += 1;
      setParfaits(parfaitsRef.current);
      haptic('success');
    } else {
      haptic('medium');
    }

    const nouvelle = parfait ? Math.min(dessous.largeur + 6, W * 0.6) : largeur;
    const nouveauX = parfait ? dessous.x - (nouvelle - dessous.largeur) / 2 : gauche;

    tour.current = [...tour.current, { x: nouveauX, largeur: nouvelle, couleur: bloc.couleur }];
    etagesRef.current += 1;
    setEtages(etagesRef.current);

    vitesse.current = Math.min(7, 2.2 + etagesRef.current * 0.12);
    mobile.current = {
      x: direction.current > 0 ? 0 : W - nouvelle,
      largeur: nouvelle,
      couleur: TEINTES[(etagesRef.current + 1) % TEINTES.length],
    };
  }, [W, haptic, submitScore]);

  const pas = useCallback(() => {
    if (!vivant.current) return;
    const bloc = mobile.current;
    bloc.x += vitesse.current * direction.current;

    if (bloc.x + bloc.largeur > W) {
      bloc.x = W - bloc.largeur;
      direction.current = -1;
    } else if (bloc.x < 0) {
      bloc.x = 0;
      direction.current = 1;
    }

    rendre((n) => (n + 1) % 1000);
  }, [W]);

  useRafLoop(pas, !over);
  useClavier({ Space: poser, Enter: poser }, !over);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {etages} étages
      </Txt>
      {parfaits > 0 ? (
        <Txt variant="label" tone="success">
          {parfaits} parfaits
        </Txt>
      ) : null}
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  // On n'affiche que le haut de la tour : elle défile vers le bas.
  const visibles = tour.current.slice(-VISIBLES);
  const baseY = H - HAUTEUR_BLOC;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <Pressable onPress={poser} accessibilityRole="button" accessibilityLabel="Lâcher le bloc">
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {visibles.map((bloc, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: bloc.x,
                top: baseY - (visibles.length - 1 - i) * HAUTEUR_BLOC,
                width: bloc.largeur,
                height: HAUTEUR_BLOC - 2,
                borderRadius: 4,
                backgroundColor: bloc.couleur,
              }}
            />
          ))}

          <View
            style={{
              position: 'absolute',
              left: mobile.current.x,
              top: baseY - visibles.length * HAUTEUR_BLOC,
              width: mobile.current.largeur,
              height: HAUTEUR_BLOC - 2,
              borderRadius: 4,
              backgroundColor: mobile.current.couleur,
              opacity: 0.9,
            }}
          />
        </View>
      </Pressable>

      <Txt variant="caption" tone="faint">
        Touche l’écran — ou espace — pour lâcher
      </Txt>

      <GameOver
        visible={over}
        outcome="over"
        title="La tour s’écroule"
        score={etages}
        scoreLabel="Étages"
        best={best}
        isRecord={record}
        detail={parfaits > 0 ? `${parfaits} dépôts parfaits` : undefined}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
