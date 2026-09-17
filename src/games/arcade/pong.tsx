import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { clamp } from '../lib/rng';

export const meta: GameMeta = {
  id: 'pong',
  name: 'Pong',
  tagline: 'Le duel de raquettes originel, en onze points.',
  category: 'arcade',
  emoji: '🏓',
  difficulty: 1,
  players: '1-2',
  minutes: 5,
  score: 'none',
  tags: ['culte', 'duo', 'réflexe'],
  rules: [
    'Fais glisser ton doigt sur ta moitié d’écran pour déplacer ta raquette.',
    'La balle rebondit sur les côtés ; le point est marqué quand elle passe derrière une raquette.',
    'Le premier à onze points gagne la partie.',
    'À deux, chacun contrôle un bord de l’écran : l’appareil se pose entre vous.',
  ],
};

type Mode = 'facile' | 'normal' | 'expert' | 'duo';

const VITESSE_IA: Record<Mode, number> = { facile: 2.2, normal: 3.6, expert: 5.4, duo: 0 };
const POINTS_VICTOIRE = 11;

export default function Pong({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 420);
  const H = Math.min(winHeight * 0.66, 620);
  const R = 8;
  const RAQUETTE_L = Math.max(70, W * 0.24);
  const RAQUETTE_H = 12;
  const MARGE = 26;

  const [mode, setMode] = useState<Mode>('normal');
  const [scoreHaut, setScoreHaut] = useState(0);
  const [scoreBas, setScoreBas] = useState(0);
  const [fini, setFini] = useState(false);
  /** Entre deux points, la balle attend au centre que le joueur la serve. */
  const [enAttente, setEnAttente] = useState(true);
  const versLeBasRef = useRef(true);
  const [, rendre] = useState(0);

  const balle = useRef({ x: W / 2, y: H / 2, vx: 2.6, vy: 3.4 });
  const raquetteBas = useRef(W / 2);
  const raquetteHaut = useRef(W / 2);
  const enCours = useRef(true);
  const scoreRef = useRef({ haut: 0, bas: 0 });

  /** Gare la balle au centre et attend un appui pour la lancer. */
  const preparer = useCallback(
    (versLeBas: boolean) => {
      versLeBasRef.current = versLeBas;
      balle.current = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
      setEnAttente(true);
    },
    [W, H],
  );

  const servir = useCallback(() => {
    if (fini) return;
    const angle = (Math.random() - 0.5) * 1.1;
    const vitesse = 3.8;
    balle.current = {
      x: W / 2,
      y: H / 2,
      vx: vitesse * Math.sin(angle),
      vy: (versLeBasRef.current ? 1 : -1) * vitesse * Math.cos(angle),
    };
    setEnAttente(false);
    haptic('medium');
  }, [W, H, fini, haptic]);

  const reset = useCallback(() => {
    scoreRef.current = { haut: 0, bas: 0 };
    setScoreHaut(0);
    setScoreBas(0);
    setFini(false);
    enCours.current = true;
    raquetteBas.current = W / 2;
    raquetteHaut.current = W / 2;
    preparer(Math.random() < 0.5);
  }, [W, preparer]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  const marquer = useCallback(
    (camp: 'haut' | 'bas') => {
      haptic(camp === 'bas' ? 'success' : 'error');
      scoreRef.current[camp] += 1;
      setScoreHaut(scoreRef.current.haut);
      setScoreBas(scoreRef.current.bas);

      if (scoreRef.current[camp] >= POINTS_VICTOIRE) {
        enCours.current = false;
        setFini(true);
        if (mode !== 'duo') submitResult(camp === 'bas' ? 'win' : 'loss');
        return;
      }
      preparer(camp === 'haut');
    },
    [haptic, mode, submitResult, preparer],
  );

  const pas = useCallback(() => {
    if (!enCours.current || enAttente) return;
    const b = balle.current;
    b.x += b.vx;
    b.y += b.vy;

    if (b.x < R) {
      b.x = R;
      b.vx = Math.abs(b.vx);
    } else if (b.x > W - R) {
      b.x = W - R;
      b.vx = -Math.abs(b.vx);
    }

    // Raquette du bas (joueur 1)
    if (b.vy > 0 && b.y + R >= H - MARGE && b.y + R <= H - MARGE + RAQUETTE_H + 12) {
      const gauche = raquetteBas.current - RAQUETTE_L / 2;
      if (b.x >= gauche && b.x <= gauche + RAQUETTE_L) {
        const offset = (b.x - raquetteBas.current) / (RAQUETTE_L / 2);
        const vitesse = Math.min(9, Math.hypot(b.vx, b.vy) * 1.04);
        b.vx = vitesse * Math.sin(offset * 1.05);
        b.vy = -Math.abs(vitesse * Math.cos(offset * 1.05));
        b.y = H - MARGE - R;
        haptic('light');
      }
    }

    // Raquette du haut (ordinateur ou joueur 2)
    if (b.vy < 0 && b.y - R <= MARGE + RAQUETTE_H && b.y - R >= MARGE - 12) {
      const gauche = raquetteHaut.current - RAQUETTE_L / 2;
      if (b.x >= gauche && b.x <= gauche + RAQUETTE_L) {
        const offset = (b.x - raquetteHaut.current) / (RAQUETTE_L / 2);
        const vitesse = Math.min(9, Math.hypot(b.vx, b.vy) * 1.04);
        b.vx = vitesse * Math.sin(offset * 1.05);
        b.vy = Math.abs(vitesse * Math.cos(offset * 1.05));
        b.y = MARGE + RAQUETTE_H + R;
        haptic('light');
      }
    }

    if (b.y > H + 30) marquer('haut');
    else if (b.y < -30) marquer('bas');

    // Suivi de l'ordinateur : il vise la balle avec une vitesse plafonnee.
    if (mode !== 'duo') {
      const cible = b.vy < 0 ? b.x : W / 2;
      const ecart = cible - raquetteHaut.current;
      const pasMax = VITESSE_IA[mode];
      raquetteHaut.current = clamp(
        raquetteHaut.current + clamp(ecart, -pasMax, pasMax),
        RAQUETTE_L / 2,
        W - RAQUETTE_L / 2,
      );
    }

    rendre((n) => (n + 1) % 1000);
  }, [W, H, R, RAQUETTE_L, RAQUETTE_H, MARGE, mode, enAttente, haptic, marquer]);

  useRafLoop(pas, !fini);

  const gestes = useMemo(() => {
    const deplacer = Gesture.Pan()
      .runOnJS(true)
      .onUpdate((e) => {
        const cible = clamp(e.x, RAQUETTE_L / 2, W - RAQUETTE_L / 2);
        if (mode === 'duo' && e.y < H / 2) raquetteHaut.current = cible;
        else raquetteBas.current = cible;
      });
    // Un appui lance le point : la balle ne repart jamais toute seule.
    const lancer = Gesture.Tap().runOnJS(true).onEnd(() => servir());
    return Gesture.Simultaneous(deplacer, lancer);
  }, [RAQUETTE_L, W, H, mode, servir]);

  useFrameStatus(
    <Txt variant="label" tone="dim">
      {mode === 'duo' ? 'Joueur 2' : 'Ordinateur'} {scoreHaut} — {scoreBas} toi
    </Txt>,
  );

  const b = balle.current;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: W }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'expert', label: 'Expert' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent="#F0A030"
        />
      </View>

      <GestureDetector gesture={gestes}>
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: H / 2 - 1,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: c.border,
            }}
          />
          <Txt
            style={{
              position: 'absolute',
              top: H / 2 - 54,
              alignSelf: 'center',
              fontSize: 34,
              fontWeight: '800',
              color: c.border,
            }}
          >
            {scoreHaut}
          </Txt>
          <Txt
            style={{
              position: 'absolute',
              top: H / 2 + 14,
              alignSelf: 'center',
              fontSize: 34,
              fontWeight: '800',
              color: c.border,
            }}
          >
            {scoreBas}
          </Txt>

          <View
            style={{
              position: 'absolute',
              left: raquetteHaut.current - RAQUETTE_L / 2,
              top: MARGE,
              width: RAQUETTE_L,
              height: RAQUETTE_H,
              borderRadius: RAQUETTE_H / 2,
              backgroundColor: '#E0525F',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: raquetteBas.current - RAQUETTE_L / 2,
              top: H - MARGE,
              width: RAQUETTE_L,
              height: RAQUETTE_H,
              borderRadius: RAQUETTE_H / 2,
              backgroundColor: '#4BC4D6',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: b.x - R,
              top: b.y - R,
              width: R * 2,
              height: R * 2,
              borderRadius: R,
              backgroundColor: c.text,
            }}
          />

          {enAttente && !fini ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: H / 2 + 60, alignItems: 'center' }}>
              <Txt variant="label" tone="dim">
                Touche l'écran pour servir
              </Txt>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      <GameOver
        visible={fini}
        outcome={scoreBas > scoreHaut ? 'win' : 'loss'}
        title={
          mode === 'duo'
            ? `Joueur ${scoreBas > scoreHaut ? 1 : 2} gagne`
            : scoreBas > scoreHaut
              ? 'Gagné !'
              : 'L’ordinateur gagne'
        }
        score={`${scoreBas} – ${scoreHaut}`}
        scoreLabel="Score"
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
