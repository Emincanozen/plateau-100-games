import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { pick, shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'points-et-carres',
  name: 'Points et carrés',
  tagline: 'Trace des traits, ferme des carrés, et rejoue à chaque fois.',
  category: 'papier',
  emoji: '⬜',
  difficulty: 2,
  players: '1-2',
  minutes: 8,
  score: 'none',
  tags: ['stratégie', 'duo', 'classique'],
  rules: [
    'À ton tour, trace un trait entre deux points voisins.',
    'Fermer un carré te le fait gagner — et tu rejoues immédiatement.',
    'Enchaîner plusieurs carrés d’affilée est la clé de la partie.',
    'Quand tous les traits sont tracés, celui qui possède le plus de carrés gagne.',
  ],
};

type Taille = 3 | 4 | 5;
type Mode = 'facile' | 'normal' | 'duo';

/**
 * Traits horizontaux et verticaux, indexés séparément.
 * Pour une grille de n×n carrés, il y a (n+1)·n traits de chaque sorte.
 */
interface Etat {
  horizontaux: (0 | 1 | null)[];
  verticaux: (0 | 1 | null)[];
  carres: (0 | 1 | null)[];
}

const etatInitial = (n: number): Etat => ({
  horizontaux: Array((n + 1) * n).fill(null),
  verticaux: Array(n * (n + 1)).fill(null),
  carres: Array(n * n).fill(null),
});

const idxH = (ligne: number, colonne: number, n: number) => ligne * n + colonne;
const idxV = (ligne: number, colonne: number, n: number) => ligne * (n + 1) + colonne;

/** Les quatre traits qui bordent un carré. */
function cotesDuCarre(ligne: number, colonne: number, n: number) {
  return {
    haut: idxH(ligne, colonne, n),
    bas: idxH(ligne + 1, colonne, n),
    gauche: idxV(ligne, colonne, n),
    droite: idxV(ligne, colonne + 1, n),
  };
}

function compterCotes(etat: Etat, ligne: number, colonne: number, n: number): number {
  const { haut, bas, gauche, droite } = cotesDuCarre(ligne, colonne, n);
  return (
    (etat.horizontaux[haut] !== null ? 1 : 0) +
    (etat.horizontaux[bas] !== null ? 1 : 0) +
    (etat.verticaux[gauche] !== null ? 1 : 0) +
    (etat.verticaux[droite] !== null ? 1 : 0)
  );
}

type Coup = { sorte: 'h' | 'v'; index: number };

function coupsLibres(etat: Etat): Coup[] {
  const out: Coup[] = [];
  etat.horizontaux.forEach((v, i) => {
    if (v === null) out.push({ sorte: 'h', index: i });
  });
  etat.verticaux.forEach((v, i) => {
    if (v === null) out.push({ sorte: 'v', index: i });
  });
  return out;
}

/** Applique un trait et renvoie le nouvel état plus le nombre de carrés fermés. */
function jouer(etat: Etat, coup: Coup, joueur: 0 | 1, n: number): { etat: Etat; fermes: number } {
  const suivant: Etat = {
    horizontaux: etat.horizontaux.slice(),
    verticaux: etat.verticaux.slice(),
    carres: etat.carres.slice(),
  };
  if (coup.sorte === 'h') suivant.horizontaux[coup.index] = joueur;
  else suivant.verticaux[coup.index] = joueur;

  let fermes = 0;
  for (let ligne = 0; ligne < n; ligne++) {
    for (let colonne = 0; colonne < n; colonne++) {
      const index = ligne * n + colonne;
      if (suivant.carres[index] !== null) continue;
      if (compterCotes(suivant, ligne, colonne, n) === 4) {
        suivant.carres[index] = joueur;
        fermes += 1;
      }
    }
  }
  return { etat: suivant, fermes };
}

/**
 * IA : ferme tout ce qui est fermable, sinon évite de donner un troisième côté
 * à un carré — c'est ce qui offre une chaîne à l'adversaire.
 */
function choisirCoup(etat: Etat, n: number, mode: Mode): Coup {
  const libres = shuffle(coupsLibres(etat));

  for (const coup of libres) {
    if (jouer(etat, coup, 1, n).fermes > 0) return coup;
  }
  if (mode === 'facile') return pick(libres);

  const sansCadeau = libres.filter((coup) => {
    const apres = jouer(etat, coup, 1, n).etat;
    for (let ligne = 0; ligne < n; ligne++) {
      for (let colonne = 0; colonne < n; colonne++) {
        if (apres.carres[ligne * n + colonne] !== null) continue;
        if (compterCotes(apres, ligne, colonne, n) === 3) return false;
      }
    }
    return true;
  });

  return sansCadeau.length > 0 ? pick(sansCadeau) : pick(libres);
}

export default function PointsEtCarres({ submitResult, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const largeur = useBoardSize(48, 0.48);

  const [taille, setTaille] = useState<Taille>(4);
  const [mode, setMode] = useState<Mode>('normal');
  const n = taille;
  const pas = Math.floor(largeur / n);
  const rayonPoint = 6;
  const epaisseur = 7;

  const [etat, setEtat] = useState<Etat>(() => etatInitial(4));
  const [tour, setTour] = useState<0 | 1>(0);
  const [comptee, setComptee] = useState(false);

  const scores = useMemo(
    () => [
      etat.carres.filter((v) => v === 0).length,
      etat.carres.filter((v) => v === 1).length,
    ],
    [etat.carres],
  );

  const fini = coupsLibres(etat).length === 0;
  const gagne = fini && scores[0] > scores[1];
  const nul = fini && scores[0] === scores[1];

  const reset = useCallback(() => {
    setEtat(etatInitial(taille));
    setTour(0);
    setComptee(false);
  }, [taille]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [taille, mode, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : nul ? 'warning' : 'error');
    if (mode !== 'duo') submitResult(gagne ? 'win' : nul ? 'draw' : 'loss');
  }, [fini, comptee, gagne, nul, mode, haptic, submitResult]);

  const tracer = useCallback(
    (coup: Coup, joueur: 0 | 1) => {
      setEtat((prev) => {
        const cible = coup.sorte === 'h' ? prev.horizontaux[coup.index] : prev.verticaux[coup.index];
        if (cible !== null) return prev;
        const { etat: suivant, fermes } = jouer(prev, coup, joueur, n);
        // Fermer un carré donne le droit de rejouer.
        if (fermes === 0) setTour(joueur === 0 ? 1 : 0);
        return suivant;
      });
    },
    [n],
  );

  // Tour de l'ordinateur.
  useEffect(() => {
    if (mode === 'duo' || tour !== 1 || fini) return;
    const id = setTimeout(() => {
      const coup = choisirCoup(etat, n, mode);
      haptic('light');
      tracer(coup, 1);
    }, 480);
    return () => clearTimeout(id);
  }, [tour, mode, fini, etat, n, tracer, haptic]);

  const toucher = (coup: Coup) => {
    if (fini) return;
    if (mode !== 'duo' && tour !== 0) return;
    const cible = coup.sorte === 'h' ? etat.horizontaux[coup.index] : etat.verticaux[coup.index];
    if (cible !== null) return;
    haptic('medium');
    tracer(coup, tour);
  };

  const couleurs = ['#4BC4D6', '#E0525F'];

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" style={{ color: couleurs[0] }}>
        {scores[0]}
      </Txt>
      <Txt variant="label" tone="faint">
        {fini
          ? 'Terminé'
          : mode === 'duo'
            ? `Joueur ${tour + 1}`
            : tour === 0
              ? 'À toi'
              : 'Ordinateur…'}
      </Txt>
      <Txt variant="label" style={{ color: couleurs[1] }}>
        {scores[1]}
      </Txt>
    </Row>,
  );

  const cote = pas * n;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <View style={{ width: Math.max(cote, 260), gap: space.sm }}>
        <Segmented<Taille>
          value={taille}
          onChange={setTaille}
          options={[
            { value: 3, label: '3 × 3' },
            { value: 4, label: '4 × 4' },
            { value: 5, label: '5 × 5' },
          ]}
          accent="#4BC4D6"
        />
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent="#4BC4D6"
        />
      </View>

      <View style={{ width: cote + rayonPoint * 2, height: cote + rayonPoint * 2 }}>
        {/* Carrés gagnés */}
        {etat.carres.map((proprietaire, i) => {
          if (proprietaire === null) return null;
          const ligne = Math.floor(i / n);
          const colonne = i % n;
          return (
            <View
              key={`c${i}`}
              style={{
                position: 'absolute',
                left: colonne * pas + rayonPoint,
                top: ligne * pas + rayonPoint,
                width: pas,
                height: pas,
                backgroundColor: couleurs[proprietaire] + '33',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt style={{ fontSize: pas * 0.4, color: couleurs[proprietaire], fontWeight: '800' }}>
                {proprietaire === 0 ? '1' : '2'}
              </Txt>
            </View>
          );
        })}

        {/* Traits horizontaux */}
        {etat.horizontaux.map((proprietaire, i) => {
          const ligne = Math.floor(i / n);
          const colonne = i % n;
          return (
            <Pressable
              key={`h${i}`}
              accessibilityRole="button"
              accessibilityLabel={`Trait horizontal ligne ${ligne + 1}, colonne ${colonne + 1}`}
              onPress={() => toucher({ sorte: 'h', index: i })}
              style={{
                position: 'absolute',
                left: colonne * pas + rayonPoint,
                top: ligne * pas + rayonPoint - epaisseur / 2,
                width: pas,
                height: epaisseur,
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  height: proprietaire === null ? 2 : epaisseur,
                  borderRadius: epaisseur / 2,
                  backgroundColor: proprietaire === null ? c.surfaceAlt : couleurs[proprietaire],
                }}
              />
            </Pressable>
          );
        })}

        {/* Traits verticaux */}
        {etat.verticaux.map((proprietaire, i) => {
          const ligne = Math.floor(i / (n + 1));
          const colonne = i % (n + 1);
          return (
            <Pressable
              key={`v${i}`}
              accessibilityRole="button"
              accessibilityLabel={`Trait vertical ligne ${ligne + 1}, colonne ${colonne + 1}`}
              onPress={() => toucher({ sorte: 'v', index: i })}
              style={{
                position: 'absolute',
                left: colonne * pas + rayonPoint - epaisseur / 2,
                top: ligne * pas + rayonPoint,
                width: epaisseur,
                height: pas,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: proprietaire === null ? 2 : epaisseur,
                  height: '100%',
                  borderRadius: epaisseur / 2,
                  backgroundColor: proprietaire === null ? c.surfaceAlt : couleurs[proprietaire],
                }}
              />
            </Pressable>
          );
        })}

        {/* Points */}
        {Array.from({ length: (n + 1) * (n + 1) }, (_, i) => {
          const ligne = Math.floor(i / (n + 1));
          const colonne = i % (n + 1);
          return (
            <View
              key={`p${i}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: colonne * pas + rayonPoint - rayonPoint / 2,
                top: ligne * pas + rayonPoint - rayonPoint / 2,
                width: rayonPoint,
                height: rayonPoint,
                borderRadius: rayonPoint,
                backgroundColor: c.textDim,
              }}
            />
          );
        })}
      </View>

      <GameOver
        visible={fini}
        outcome={nul ? 'draw' : gagne ? 'win' : 'loss'}
        title={
          nul
            ? 'Égalité'
            : mode === 'duo'
              ? `Joueur ${gagne ? 1 : 2} gagne`
              : gagne
                ? 'Gagné !'
                : 'L’ordinateur gagne'
        }
        score={`${scores[0]} – ${scores[1]}`}
        scoreLabel="Carrés"
        accent="#4BC4D6"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
