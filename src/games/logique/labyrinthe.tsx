import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, CroixDirectionnelle, Row, Segmented, Txt, GameOver, useClavier, type Direction } from '@/ui';
import { formatClock, useBoardSize, useTimer } from '../lib/hooks';
import { randInt, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'labyrinthe',
  name: 'Labyrinthe',
  tagline: 'Un chemin et un seul mène à la sortie. Trouve-le.',
  category: 'logique',
  emoji: '🌀',
  difficulty: 2,
  players: '1',
  minutes: 4,
  score: 'low',
  scoreUnit: 'coups',
  tags: ['puzzle', 'solo', 'orientation'],
  rules: [
    'Déplace-toi avec les boutons ou les flèches du clavier.',
    'Le labyrinthe est parfait : entre deux cases, il n’existe qu’un seul chemin.',
    'Rejoins la sortie, marquée en vert en bas à droite.',
    'Le bouton « indice » éclaire les trois prochaines cases du bon chemin, mais ajoute cinq coups.',
  ],
};

type Taille = 8 | 12 | 16;

/** Une case et ses quatre murs. */
interface Case {
  nord: boolean;
  sud: boolean;
  est: boolean;
  ouest: boolean;
  visitee: boolean;
}

const creerGrille = (n: number): Case[] =>
  Array.from({ length: n * n }, () => ({
    nord: true,
    sud: true,
    est: true,
    ouest: true,
    visitee: false,
  }));

/**
 * Génération par exploration en profondeur avec retour arrière :
 * produit un labyrinthe « parfait », sans boucle ni zone inaccessible.
 */
function creuser(n: number): Case[] {
  const grille = creerGrille(n);
  const pile: number[] = [0];
  grille[0].visitee = true;

  while (pile.length > 0) {
    const courante = pile[pile.length - 1];
    const ligne = Math.floor(courante / n);
    const colonne = courante % n;

    const voisines: { index: number; mur: keyof Case; oppose: keyof Case }[] = [];
    if (ligne > 0) voisines.push({ index: courante - n, mur: 'nord', oppose: 'sud' });
    if (ligne < n - 1) voisines.push({ index: courante + n, mur: 'sud', oppose: 'nord' });
    if (colonne > 0) voisines.push({ index: courante - 1, mur: 'ouest', oppose: 'est' });
    if (colonne < n - 1) voisines.push({ index: courante + 1, mur: 'est', oppose: 'ouest' });

    const libres = shuffle(voisines.filter((v) => !grille[v.index].visitee));
    if (libres.length === 0) {
      pile.pop();
      continue;
    }

    const choisie = libres[0];
    (grille[courante][choisie.mur] as boolean) = false;
    (grille[choisie.index][choisie.oppose] as boolean) = false;
    grille[choisie.index].visitee = true;
    pile.push(choisie.index);
  }

  return grille;
}

/** Chemin le plus court entre deux cases, par parcours en largeur. */
function cheminVers(grille: Case[], n: number, depart: number, arrivee: number): number[] {
  const precedent = new Map<number, number>([[depart, -1]]);
  const file = [depart];

  while (file.length > 0) {
    const courante = file.shift()!;
    if (courante === arrivee) break;
    const ligne = Math.floor(courante / n);
    const colonne = courante % n;
    const suivantes: number[] = [];
    if (!grille[courante].nord && ligne > 0) suivantes.push(courante - n);
    if (!grille[courante].sud && ligne < n - 1) suivantes.push(courante + n);
    if (!grille[courante].ouest && colonne > 0) suivantes.push(courante - 1);
    if (!grille[courante].est && colonne < n - 1) suivantes.push(courante + 1);

    for (const suivante of suivantes) {
      if (precedent.has(suivante)) continue;
      precedent.set(suivante, courante);
      file.push(suivante);
    }
  }

  const chemin: number[] = [];
  let courante = arrivee;
  while (courante !== -1 && precedent.has(courante)) {
    chemin.unshift(courante);
    courante = precedent.get(courante)!;
  }
  return chemin;
}

export default function Labyrinthe({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(40, 0.46);

  const [taille, setTaille] = useState<Taille>(12);
  const [grille, setGrille] = useState<Case[]>(() => creuser(12));
  const [position, setPosition] = useState(0);
  const [coups, setCoups] = useState(0);
  const [penalite, setPenalite] = useState(0);
  const [indice, setIndice] = useState<number[]>([]);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  const n = taille;
  const cellule = Math.floor(largeur / n);
  const arrivee = n * n - 1;
  const gagne = position === arrivee;
  const secondes = useTimer(!gagne, `${taille}-${coups === 0}`);
  const total = coups + penalite;

  const reset = useCallback(() => {
    setGrille(creuser(taille));
    setPosition(0);
    setCoups(0);
    setPenalite(0);
    setIndice([]);
    setRecord(false);
    setComptee(false);
  }, [taille]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [taille, reset]);

  useEffect(() => {
    if (!gagne || comptee || coups === 0) return;
    setComptee(true);
    haptic('success');
    setRecord(submitScore(total));
  }, [gagne, comptee, coups, total, haptic, submitScore]);

  const deplacer = useCallback(
    (direction: Direction) => {
      if (gagne) return;
      const ligne = Math.floor(position / n);
      const colonne = position % n;
      const murs = grille[position];

      let cible = -1;
      if (direction === 'haut' && !murs.nord && ligne > 0) cible = position - n;
      else if (direction === 'bas' && !murs.sud && ligne < n - 1) cible = position + n;
      else if (direction === 'gauche' && !murs.ouest && colonne > 0) cible = position - 1;
      else if (direction === 'droite' && !murs.est && colonne < n - 1) cible = position + 1;

      if (cible < 0) {
        haptic('warning');
        return;
      }
      haptic('light');
      setPosition(cible);
      setCoups((k) => k + 1);
      setIndice((ancien) => ancien.filter((i) => i !== cible));
    },
    [gagne, position, n, grille, haptic],
  );

  const demanderIndice = () => {
    if (gagne) return;
    haptic('medium');
    const chemin = cheminVers(grille, n, position, arrivee);
    setIndice(chemin.slice(1, 4));
    setPenalite((p) => p + 5);
  };

  useClavier(
    {
      ArrowUp: () => deplacer('haut'),
      ArrowDown: () => deplacer('bas'),
      ArrowLeft: () => deplacer('gauche'),
      ArrowRight: () => deplacer('droite'),
    },
    !gagne,
  );

  const longueurOptimale = useMemo(
    () => cheminVers(grille, n, 0, arrivee).length - 1,
    [grille, n, arrivee],
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {total} coups
      </Txt>
      <Txt variant="label" tone="faint">
        min. {longueurOptimale}
      </Txt>
      <Txt variant="label" tone="faint">
        {formatClock(secondes)}
      </Txt>
    </Row>,
  );

  const epaisseur = Math.max(1, Math.floor(cellule / 12));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View style={{ width: Math.max(cellule * n, 260) }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 8, label: '8 × 8' },
            { value: 12, label: '12 × 12' },
            { value: 16, label: '16 × 16' },
          ]}
          accent="#34B37E"
        />
      </View>

      <View
        style={{
          width: cellule * n,
          height: cellule * n,
          backgroundColor: c.surface,
          borderRadius: radius.sm,
          borderWidth: epaisseur * 2,
          borderColor: c.text,
          overflow: 'hidden',
        }}
      >
        {grille.map((murs, i) => {
          const ligne = Math.floor(i / n);
          const colonne = i % n;
          const surLeChemin = indice.includes(i);
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: colonne * cellule,
                top: ligne * cellule,
                width: cellule,
                height: cellule,
                borderRightWidth: murs.est ? epaisseur : 0,
                borderBottomWidth: murs.sud ? epaisseur : 0,
                borderTopWidth: murs.nord ? epaisseur : 0,
                borderLeftWidth: murs.ouest ? epaisseur : 0,
                borderColor: c.text,
                backgroundColor:
                  i === arrivee ? '#34B37E44' : surLeChemin ? '#EFB93B55' : 'transparent',
              }}
            />
          );
        })}

        <View
          style={{
            position: 'absolute',
            left: (position % n) * cellule + cellule * 0.2,
            top: Math.floor(position / n) * cellule + cellule * 0.2,
            width: cellule * 0.6,
            height: cellule * 0.6,
            borderRadius: cellule,
            backgroundColor: '#34B37E',
          }}
        />
      </View>

      <Row gap={space.xl} align="center">
        <CroixDirectionnelle onDirection={deplacer} taille={44} tint="#34B37E22" />
        <View style={{ gap: space.sm }}>
          <Button label="Indice (+5)" kind="secondary" size="sm" disabled={gagne} onPress={demanderIndice} />
          <Button label="Nouveau" kind="ghost" size="sm" onPress={reset} />
        </View>
      </Row>

      <GameOver
        visible={gagne && coups > 0}
        outcome="win"
        title="Sortie atteinte !"
        score={total}
        scoreLabel="Coups"
        best={best}
        isRecord={record}
        detail={
          penalite > 0
            ? `${coups} coups + ${penalite} de pénalité · optimal ${longueurOptimale}`
            : coups === longueurOptimale
              ? 'Chemin optimal, sans une erreur'
              : `Chemin optimal : ${longueurOptimale} coups`
        }
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
