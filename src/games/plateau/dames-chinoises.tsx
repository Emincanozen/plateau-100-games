import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Txt, GameOver } from '@/ui';
import { pick } from '../lib/rng';

export const meta: GameMeta = {
  id: 'dames-chinoises',
  name: 'Dames chinoises',
  tagline: 'Traverse l’étoile en enchaînant les sauts jusqu’au camp d’en face.',
  category: 'plateau',
  emoji: '⭐',
  difficulty: 2,
  players: '1-2',
  minutes: 12,
  score: 'none',
  tags: ['stratégie', 'duo', 'classique'],
  rules: [
    'Chaque camp a dix pions dans une pointe de l’étoile et doit remplir la pointe opposée.',
    'Un pion avance d’un trou vers l’une de ses six voisines libres.',
    'Ou bien il saute par-dessus un pion voisin — le sien ou celui de l’adversaire — pour retomber juste derrière.',
    'Les sauts s’enchaînent : une bonne échelle de pions traverse le plateau d’un seul coup.',
    'Le premier à occuper les dix trous d’en face gagne.',
  ],
};

const ACCENT = '#5B8DEF';
const BLEU = '#5B8DEF';
const ROUGE = '#E0525F';

/** Nombre de trous et abscisse du premier, ligne par ligne. */
const RANGEES: [number, number][] = [
  [1, 12],
  [2, 11],
  [3, 10],
  [4, 9],
  [13, 0],
  [12, 1],
  [11, 2],
  [10, 3],
  [9, 4],
  [10, 3],
  [11, 2],
  [12, 1],
  [13, 0],
  [4, 9],
  [3, 10],
  [2, 11],
  [1, 12],
];

interface Trou {
  ligne: number;
  x: number;
}

const TROUS: Trou[] = (() => {
  const out: Trou[] = [];
  RANGEES.forEach(([nombre, depart], ligne) => {
    for (let k = 0; k < nombre; k++) out.push({ ligne, x: depart + 2 * k });
  });
  return out;
})();

const INDEX = new Map<string, number>(TROUS.map((t, i) => [`${t.ligne},${t.x}`, i]));
const trouver = (ligne: number, x: number): number | undefined => INDEX.get(`${ligne},${x}`);

/** Les six directions du maillage triangulaire. */
const DIRS: [number, number][] = [
  [0, 2],
  [0, -2],
  [-1, 1],
  [-1, -1],
  [1, 1],
  [1, -1],
];

const VOISINS: number[][] = TROUS.map(({ ligne, x }) =>
  DIRS.map(([dl, dx]) => trouver(ligne + dl, x + dx)).filter((i): i is number => i !== undefined),
);

/** Pour chaque trou : les sauts possibles, sous la forme [survolé, arrivée]. */
const SAUTS: [number, number][][] = TROUS.map(({ ligne, x }) => {
  const out: [number, number][] = [];
  for (const [dl, dx] of DIRS) {
    const survole = trouver(ligne + dl, x + dx);
    const arrivee = trouver(ligne + dl * 2, x + dx * 2);
    if (survole !== undefined && arrivee !== undefined) out.push([survole, arrivee]);
  }
  return out;
});

const POINTE_HAUT = TROUS.map((t, i) => (t.ligne <= 3 ? i : -1)).filter((i) => i >= 0);
const POINTE_BAS = TROUS.map((t, i) => (t.ligne >= 13 ? i : -1)).filter((i) => i >= 0);

type Camp = 1 | 2; // 1 = bleu, part du bas · 2 = rouge, part du haut
type Case = 0 | Camp;
type Mode = 'facile' | 'normal' | 'expert' | 'duo';

const BUT: Record<Camp, number[]> = { 1: POINTE_HAUT, 2: POINTE_BAS };

function positionDepart(): Case[] {
  const cases: Case[] = TROUS.map(() => 0);
  for (const i of POINTE_BAS) cases[i] = 1;
  for (const i of POINTE_HAUT) cases[i] = 2;
  return cases;
}

/** Arrivées possibles pour un pion : un pas, ou une chaîne de sauts. */
function destinations(cases: Case[], depuis: number): Set<number> {
  const out = new Set<number>();
  for (const v of VOISINS[depuis]) if (cases[v] === 0) out.add(v);

  const pile = [depuis];
  const vus = new Set<number>([depuis]);
  while (pile.length > 0) {
    const index = pile.pop() as number;
    for (const [survole, arrivee] of SAUTS[index]) {
      if (cases[survole] === 0 || cases[arrivee] !== 0 || vus.has(arrivee)) continue;
      vus.add(arrivee);
      out.add(arrivee);
      pile.push(arrivee);
    }
  }
  out.delete(depuis);
  return out;
}

/** Avancement d'un trou pour un camp : 0 au départ, 16 au but. */
function avancement(camp: Camp, index: number): number {
  const ligne = TROUS[index].ligne;
  return camp === 1 ? 16 - ligne : ligne;
}

function gagnant(cases: Case[]): Camp | null {
  if (BUT[1].every((i) => cases[i] === 1)) return 1;
  if (BUT[2].every((i) => cases[i] === 2)) return 2;
  return null;
}

function note(cases: Case[], camp: Camp): number {
  let total = 0;
  let retardataire = 99;
  let arrivees = 0;
  const but = new Set(BUT[camp]);

  for (let i = 0; i < cases.length; i++) {
    if (cases[i] !== camp) continue;
    const a = avancement(camp, i);
    total += a;
    if (a < retardataire) retardataire = a;
    if (but.has(i)) arrivees += 1;
  }
  // Le pion le plus en retard décide de la fin de partie : il pèse double.
  return total + retardataire * 2 + arrivees * 6;
}

interface Coup {
  depuis: number;
  vers: number;
}

function tousLesCoups(cases: Case[], camp: Camp): Coup[] {
  const out: Coup[] = [];
  for (let depuis = 0; depuis < cases.length; depuis++) {
    if (cases[depuis] !== camp) continue;
    for (const vers of destinations(cases, depuis)) out.push({ depuis, vers });
  }
  return out;
}

function appliquer(cases: Case[], coup: Coup): Case[] {
  const suivant = cases.slice();
  suivant[coup.vers] = suivant[coup.depuis];
  suivant[coup.depuis] = 0;
  return suivant;
}

function coupOrdinateur(cases: Case[], camp: Camp, mode: Mode): Coup | null {
  const liste = tousLesCoups(cases, camp);
  if (liste.length === 0) return null;

  const adverse: Camp = camp === 1 ? 2 : 1;
  const but = new Set(BUT[camp]);

  const notes = liste.map((coup) => {
    // Ne jamais ressortir un pion déjà arrivé.
    if (but.has(coup.depuis) && !but.has(coup.vers)) return { coup, valeur: -1000 };
    return { coup, valeur: note(appliquer(cases, coup), camp) };
  });
  notes.sort((a, b) => b.valeur - a.valeur);

  if (mode === 'facile') {
    return Math.random() < 0.4 ? pick(liste) : notes[Math.min(2, notes.length - 1)].coup;
  }
  if (mode !== 'expert') return notes[0].coup;

  // Expert : on retranche ce que la meilleure riposte rapporterait à l'adversaire.
  let meilleur = notes[0].coup;
  let meilleureValeur = -Infinity;
  for (const { coup, valeur } of notes.slice(0, 8)) {
    const apres = appliquer(cases, coup);
    const riposte = tousLesCoups(apres, adverse)
      .map((k) => note(appliquer(apres, k), adverse))
      .reduce((a, b) => Math.max(a, b), -Infinity);
    const total = valeur - riposte * 0.5;
    if (total > meilleureValeur) {
      meilleureValeur = total;
      meilleur = coup;
    }
  }
  return meilleur;
}

export default function DamesChinoises({ submitResult, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const { width, height } = useWindowDimensions();

  const [mode, setMode] = useState<Mode>('normal');
  const [cases, setCases] = useState<Case[]>(positionDepart);
  const [tour, setTour] = useState<Camp>(1);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [comptee, setComptee] = useState(false);

  // L'étoile fait 13 diamètres de large et environ 15 de haut.
  const diametre = Math.floor(Math.min((Math.min(width, 520) - 32) / 13, (height * 0.5) / 15.1));
  const largeur = diametre * 13;
  const hauteur = diametre * 15.1;

  const vainqueur = useMemo(() => gagnant(cases), [cases]);
  const fini = vainqueur !== null;

  const reset = useCallback(() => {
    setCases(positionDepart());
    setTour(1);
    setChoisi(null);
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    const humainGagne = mode === 'duo' || vainqueur === 1;
    haptic(humainGagne ? 'success' : 'error');
    if (mode !== 'duo') submitResult(vainqueur === 1 ? 'win' : 'loss');
  }, [fini, comptee, vainqueur, mode, haptic, submitResult]);

  useEffect(() => {
    if (mode === 'duo' || tour !== 2 || fini) return;
    const id = setTimeout(() => {
      setCases((courant) => {
        if (gagnant(courant) !== null) return courant;
        const coup = coupOrdinateur(courant, 2, mode);
        return coup ? appliquer(courant, coup) : courant;
      });
      setTour(1);
    }, 320);
    return () => clearTimeout(id);
  }, [tour, mode, fini]);

  const arrivees = useMemo(
    () => (choisi === null ? new Set<number>() : destinations(cases, choisi)),
    [cases, choisi],
  );

  const toucher = (index: number) => {
    if (fini) return;
    if (mode !== 'duo' && tour !== 1) return;

    if (choisi !== null && arrivees.has(index)) {
      haptic('medium');
      setCases((courant) => appliquer(courant, { depuis: choisi, vers: index }));
      setChoisi(null);
      setTour(tour === 1 ? 2 : 1);
      return;
    }
    if (cases[index] === tour) {
      haptic('light');
      setChoisi(choisi === index ? null : index);
      return;
    }
    setChoisi(null);
  };

  const rentres = (camp: Camp) => BUT[camp].filter((i) => cases[i] === camp).length;

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini
          ? `${vainqueur === 1 ? 'Bleu' : 'Rouge'} a traversé`
          : mode === 'duo'
            ? `Au tour du ${tour === 1 ? 'bleu' : 'rouge'}`
            : tour === 1
              ? 'À toi de jouer'
              : 'L’ordinateur réfléchit…'}
      </Txt>
      <Txt variant="label" tone="faint">
        {rentres(1)}/10 – {rentres(2)}/10
      </Txt>
    </Row>,
  );

  const butBleu = new Set(POINTE_HAUT);
  const butRouge = new Set(POINTE_BAS);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: Math.min(width - 32, 340) }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'facile', label: 'Facile' },
            { value: 'normal', label: 'Normal' },
            { value: 'expert', label: 'Expert' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent={ACCENT}
        />
      </View>

      <View style={{ width: largeur, height: hauteur }}>
        {TROUS.map(({ ligne, x }, i) => {
          const contenu = cases[i];
          const cible = arrivees.has(i);
          const zoneBleue = butBleu.has(i);
          const zoneRouge = butRouge.has(i);

          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Trou ligne ${ligne + 1}${
                contenu === 0 ? ', libre' : contenu === 1 ? ', pion bleu' : ', pion rouge'
              }`}
              onPress={() => toucher(i)}
              style={{
                position: 'absolute',
                left: x * (diametre / 2),
                top: ligne * diametre * 0.88,
                width: diametre - 2,
                height: diametre - 2,
                borderRadius: diametre,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  contenu === 1
                    ? BLEU
                    : contenu === 2
                      ? ROUGE
                      : cible
                        ? `${ACCENT}77`
                        : zoneBleue
                          ? `${BLEU}20`
                          : zoneRouge
                            ? `${ROUGE}20`
                            : c.surfaceAlt,
                borderWidth: choisi === i ? 3 : cible ? 2 : 1,
                borderColor:
                  choisi === i
                    ? '#FFFFFF'
                    : cible
                      ? ACCENT
                      : zoneBleue
                        ? `${BLEU}66`
                        : zoneRouge
                          ? `${ROUGE}66`
                          : c.border,
              }}
            />
          );
        })}
      </View>

      <Txt variant="caption" tone="faint" center>
        {fini
          ? 'Partie terminée'
          : mode !== 'duo' && tour === 2
            ? 'L’ordinateur réfléchit…'
            : choisi === null
              ? 'Choisis un pion'
              : 'Touche un trou allumé — les sauts s’enchaînent tout seuls'}
      </Txt>

      <GameOver
        visible={fini}
        outcome={mode === 'duo' || vainqueur === 1 ? 'win' : 'loss'}
        title={
          mode === 'duo'
            ? `Victoire du ${vainqueur === 1 ? 'bleu' : 'rouge'}`
            : vainqueur === 1
              ? 'Tes dix pions sont arrivés !'
              : 'L’ordinateur a traversé le premier'
        }
        detail="Les longues chaînes de sauts font toute la différence."
        accent={ACCENT}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
