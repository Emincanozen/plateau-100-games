import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { BoutonControle, Row, Txt, GameOver, useClavier } from '@/ui';
import { useRafLoop } from '../lib/hooks';
import { clamp, randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'bulles',
  name: 'Bulles',
  tagline: 'Vise, tire, et fais éclater les groupes de trois couleurs ou plus.',
  category: 'arcade',
  emoji: '🫧',
  difficulty: 2,
  players: '1',
  minutes: 7,
  score: 'high',
  scoreUnit: 'pts',
  tags: ['couleurs', 'solo', 'visée'],
  rules: [
    'Oriente le canon en glissant le doigt, aux boutons ou au clavier, puis tire.',
    'Une bulle qui rejoint deux congénères de sa couleur ou plus fait éclater tout le groupe.',
    'Les bulles détachées du plafond tombent aussi — enchaîner rapporte gros.',
    'Une nouvelle rangée descend tous les sept tirs. Si les bulles atteignent le bas, c’est perdu.',
  ],
};

const COLONNES = 9;
const RANGEES_MAX = 13;
const COULEURS = ['#E0525F', '#F0A030', '#EFB93B', '#34B37E', '#4BC4D6', '#8B7DFF'];
const TIRS_AVANT_DESCENTE = 7;

/** La grille est décalée d'une demi-case une rangée sur deux. */
const estDecalee = (rangee: number) => rangee % 2 === 1;

export default function Bulles({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const W = Math.min(winWidth - 24, 380);
  const R = Math.floor(W / (COLONNES * 2 + 1));
  const D = R * 2;
  const H = Math.min(winHeight * 0.58, D * RANGEES_MAX + 70);
  const CANON_Y = H - 26;

  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [gagne, setGagne] = useState(false);
  const [record, setRecord] = useState(false);
  const [, rendre] = useState(0);

  /** grille[rangee][colonne] = index de couleur, ou null. */
  const grille = useRef<(number | null)[][]>([]);
  const angle = useRef(-Math.PI / 2);
  const bulle = useRef<{ x: number; y: number; vx: number; vy: number; couleur: number } | null>(null);
  const prochaine = useRef(randInt(COULEURS.length));
  const enAttente = useRef(randInt(COULEURS.length));
  const tirs = useRef(0);
  const scoreRef = useRef(0);
  const vivant = useRef(true);

  const centreDe = useCallback(
    (rangee: number, colonne: number) => ({
      x: colonne * D + R + (estDecalee(rangee) ? R : 0),
      y: rangee * (D - 4) + R + 4,
    }),
    [D, R],
  );

  const reset = useCallback(() => {
    const depart: (number | null)[][] = [];
    for (let r = 0; r < RANGEES_MAX; r++) {
      const largeur = estDecalee(r) ? COLONNES - 1 : COLONNES;
      depart.push(
        Array.from({ length: largeur }, () => (r < 5 ? randInt(COULEURS.length) : null)),
      );
    }
    grille.current = depart;
    angle.current = -Math.PI / 2;
    bulle.current = null;
    prochaine.current = randInt(COULEURS.length);
    enAttente.current = randInt(COULEURS.length);
    tirs.current = 0;
    scoreRef.current = 0;
    vivant.current = true;
    setScore(0);
    setOver(false);
    setGagne(false);
    setRecord(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [reset]);

  /** Voisines d'une case, en tenant compte du décalage des rangées. */
  const voisines = useCallback((r: number, cc: number): [number, number][] => {
    const decalee = estDecalee(r);
    const deltas: [number, number][] = [
      [0, -1],
      [0, 1],
      [-1, decalee ? 0 : -1],
      [-1, decalee ? 1 : 0],
      [1, decalee ? 0 : -1],
      [1, decalee ? 1 : 0],
    ];
    return deltas
      .map(([dr, dc]) => [r + dr, cc + dc] as [number, number])
      .filter(([nr, nc]) => {
        if (nr < 0 || nr >= RANGEES_MAX) return false;
        const largeur = estDecalee(nr) ? COLONNES - 1 : COLONNES;
        return nc >= 0 && nc < largeur;
      });
  }, []);

  /** Groupe connexe de même couleur à partir d'une case. */
  const groupe = useCallback(
    (r: number, cc: number): [number, number][] => {
      const couleur = grille.current[r]?.[cc];
      if (couleur === null || couleur === undefined) return [];
      const vus = new Set<string>([`${r},${cc}`]);
      const pile: [number, number][] = [[r, cc]];
      const resultat: [number, number][] = [[r, cc]];
      while (pile.length) {
        const [cr, cco] = pile.pop()!;
        for (const [nr, nc] of voisines(cr, cco)) {
          const cle = `${nr},${nc}`;
          if (vus.has(cle)) continue;
          if (grille.current[nr][nc] !== couleur) continue;
          vus.add(cle);
          pile.push([nr, nc]);
          resultat.push([nr, nc]);
        }
      }
      return resultat;
    },
    [voisines],
  );

  /** Bulles encore reliées au plafond ; les autres tombent. */
  const retirerFlottantes = useCallback((): number => {
    const reliees = new Set<string>();
    const pile: [number, number][] = [];

    grille.current[0]?.forEach((couleur, cc) => {
      if (couleur !== null) {
        pile.push([0, cc]);
        reliees.add(`0,${cc}`);
      }
    });

    while (pile.length) {
      const [r, cc] = pile.pop()!;
      for (const [nr, nc] of voisines(r, cc)) {
        const cle = `${nr},${nc}`;
        if (reliees.has(cle)) continue;
        if (grille.current[nr][nc] === null) continue;
        reliees.add(cle);
        pile.push([nr, nc]);
      }
    }

    let tombees = 0;
    grille.current.forEach((rangee, r) =>
      rangee.forEach((couleur, cc) => {
        if (couleur !== null && !reliees.has(`${r},${cc}`)) {
          grille.current[r][cc] = null;
          tombees += 1;
        }
      }),
    );
    return tombees;
  }, [voisines]);

  /** Fixe la bulle en vol dans la case libre la plus proche. */
  const accrocher = useCallback(
    (x: number, y: number, couleur: number) => {
      let meilleure: [number, number] | null = null;
      let meilleureDistance = Infinity;

      for (let r = 0; r < RANGEES_MAX; r++) {
        const largeur = estDecalee(r) ? COLONNES - 1 : COLONNES;
        for (let cc = 0; cc < largeur; cc++) {
          if (grille.current[r][cc] !== null) continue;
          // La case doit toucher une bulle existante, ou être au plafond.
          const adjacente =
            r === 0 || voisines(r, cc).some(([nr, nc]) => grille.current[nr][nc] !== null);
          if (!adjacente) continue;
          const centre = centreDe(r, cc);
          const distance = Math.hypot(centre.x - x, centre.y - y);
          if (distance < meilleureDistance) {
            meilleureDistance = distance;
            meilleure = [r, cc];
          }
        }
      }

      if (!meilleure) return;
      const [r, cc] = meilleure;
      grille.current[r][cc] = couleur;

      const amas = groupe(r, cc);
      if (amas.length >= 3) {
        amas.forEach(([ar, ac]) => (grille.current[ar][ac] = null));
        const tombees = retirerFlottantes();
        scoreRef.current += amas.length * 10 + tombees * 20;
        setScore(scoreRef.current);
        haptic(tombees > 0 ? 'success' : 'medium');
      } else {
        haptic('light');
      }

      // Défaite si une bulle atteint la dernière rangée.
      const derniere = grille.current[RANGEES_MAX - 1];
      if (derniere.some((couleurCase) => couleurCase !== null)) {
        vivant.current = false;
        setOver(true);
        setGagne(false);
        haptic('error');
        setRecord(submitScore(scoreRef.current));
        return;
      }

      // Victoire si la grille est vide.
      if (grille.current.every((rangee) => rangee.every((couleurCase) => couleurCase === null))) {
        vivant.current = false;
        setOver(true);
        setGagne(true);
        scoreRef.current += 500;
        setScore(scoreRef.current);
        haptic('success');
        setRecord(submitScore(scoreRef.current));
      }
    },
    [centreDe, voisines, groupe, retirerFlottantes, haptic, submitScore],
  );

  /** Descend toute la grille d'une rangée et en ajoute une en haut. */
  const descendre = useCallback(() => {
    const nouvelle: (number | null)[][] = [];
    nouvelle.push(Array.from({ length: COLONNES }, () => randInt(COULEURS.length)));
    for (let r = 0; r < RANGEES_MAX - 1; r++) {
      const largeur = estDecalee(r + 1) ? COLONNES - 1 : COLONNES;
      const source = grille.current[r];
      nouvelle.push(Array.from({ length: largeur }, (_, i) => source[i] ?? null));
    }
    grille.current = nouvelle;
    haptic('warning');
  }, [haptic]);

  const tirer = useCallback(() => {
    if (!vivant.current || bulle.current) return;
    bulle.current = {
      x: W / 2,
      y: CANON_Y,
      vx: Math.cos(angle.current) * 9,
      vy: Math.sin(angle.current) * 9,
      couleur: prochaine.current,
    };
    prochaine.current = enAttente.current;
    enAttente.current = randInt(COULEURS.length);

    tirs.current += 1;
    if (tirs.current % TIRS_AVANT_DESCENTE === 0) descendre();
  }, [W, CANON_Y, descendre]);

  const pas = useCallback(() => {
    if (!vivant.current) return;
    const b = bulle.current;
    if (b) {
      b.x += b.vx;
      b.y += b.vy;
      // Rebond sur les parois.
      if (b.x < R) {
        b.x = R;
        b.vx = Math.abs(b.vx);
      } else if (b.x > W - R) {
        b.x = W - R;
        b.vx = -Math.abs(b.vx);
      }

      // Contact avec le plafond ou une bulle posée.
      let contact = b.y <= R;
      if (!contact) {
        for (let r = 0; r < RANGEES_MAX && !contact; r++) {
          const largeur = estDecalee(r) ? COLONNES - 1 : COLONNES;
          for (let cc = 0; cc < largeur; cc++) {
            if (grille.current[r][cc] === null) continue;
            const centre = centreDe(r, cc);
            if (Math.hypot(centre.x - b.x, centre.y - b.y) < D - 3) {
              contact = true;
              break;
            }
          }
        }
      }

      if (contact) {
        const couleur = b.couleur;
        const { x, y } = b;
        bulle.current = null;
        accrocher(x, y, couleur);
      }
    }
    rendre((n) => (n + 1) % 1000);
  }, [W, R, D, centreDe, accrocher]);

  useRafLoop(pas, !over);

  const viser = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          const dx = e.x - W / 2;
          const dy = e.y - CANON_Y;
          // On borne l'angle pour éviter de tirer vers le bas.
          angle.current = clamp(Math.atan2(dy, dx), -Math.PI + 0.35, -0.35);
        })
        .onEnd(() => tirer()),
    [W, CANON_Y, tirer],
  );

  // Viser au geste seul rend le jeu injouable au clavier et muet pour un
  // lecteur d'écran. On expose donc l'angle par pas de cinq degrés.
  const pivoter = useCallback(
    (radians: number) => {
      angle.current = clamp(angle.current + radians, -Math.PI + 0.35, -0.35);
      rendre((n) => n + 1); // le canon doit suivre à l'écran
    },
    [],
  );
  const PAS = Math.PI / 36; // cinq degrés

  useClavier({
    ArrowLeft: () => pivoter(-PAS),
    ArrowRight: () => pivoter(PAS),
    KeyQ: () => pivoter(-PAS),
    KeyD: () => pivoter(PAS),
    Space: tirer,
    Enter: tirer,
  });

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {score} pts
      </Txt>
      <Txt variant="label" tone="faint">
        {TIRS_AVANT_DESCENTE - (tirs.current % TIRS_AVANT_DESCENTE)} avant descente
      </Txt>
    </Row>,
  );

  const longueurVisee = 60;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <GestureDetector gesture={viser}>
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: '#101426',
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {grille.current.map((rangee, r) =>
            rangee.map((couleur, cc) => {
              if (couleur === null) return null;
              const centre = centreDe(r, cc);
              return (
                <View
                  key={`${r}-${cc}`}
                  style={{
                    position: 'absolute',
                    left: centre.x - R,
                    top: centre.y - R,
                    width: D - 2,
                    height: D - 2,
                    borderRadius: R,
                    backgroundColor: COULEURS[couleur],
                  }}
                />
              );
            }),
          )}

          {bulle.current ? (
            <View
              style={{
                position: 'absolute',
                left: bulle.current.x - R,
                top: bulle.current.y - R,
                width: D - 2,
                height: D - 2,
                borderRadius: R,
                backgroundColor: COULEURS[bulle.current.couleur],
              }}
            />
          ) : null}

          {/* Ligne de visée */}
          <View
            style={{
              position: 'absolute',
              left: W / 2 - 1,
              top: CANON_Y - 1,
              width: 2,
              height: longueurVisee,
              backgroundColor: '#FFFFFF44',
              transformOrigin: 'top',
              transform: [{ rotate: `${angle.current + Math.PI / 2}rad` }],
            }}
          />

          <View
            style={{
              position: 'absolute',
              left: W / 2 - R,
              top: CANON_Y - R,
              width: D - 2,
              height: D - 2,
              borderRadius: R,
              backgroundColor: COULEURS[prochaine.current],
              borderWidth: 2,
              borderColor: '#FFFFFF66',
            }}
          />
        </View>
      </GestureDetector>

      <Row gap={space.sm} align="center">
        <Txt variant="caption" tone="faint">
          Suivante
        </Txt>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: COULEURS[enAttente.current],
          }}
        />
        <Txt variant="caption" tone="faint">
          · glisse pour viser
        </Txt>
      </Row>

      <Row gap={10}>
        <BoutonControle glyphe="◀" label="Pivoter à gauche" tint="#8B7DFF33" onPress={() => pivoter(-PAS)} />
        <BoutonControle glyphe="●" label="Tirer" tint="#8B7DFF33" onPress={tirer} />
        <BoutonControle glyphe="▶" label="Pivoter à droite" tint="#8B7DFF33" onPress={() => pivoter(PAS)} />
      </Row>

      <GameOver
        visible={over}
        outcome={gagne ? 'win' : 'over'}
        title={gagne ? 'Grille vidée !' : 'Les bulles ont atteint le bas'}
        score={score}
        best={best}
        isRecord={record}
        accent="#F0A030"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
