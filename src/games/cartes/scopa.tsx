import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, Row, Txt, GameOver } from '@/ui';
import { jeu40, melanger, valeurScopa, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'scopa',
  name: 'Scopa',
  tagline: 'Ramasse les cartes de la table par égalité ou par addition.',
  category: 'cartes',
  emoji: '🇮🇹',
  difficulty: 2,
  players: '1',
  minutes: 12,
  score: 'none',
  tags: ['plis', 'calcul', 'traditionnel'],
  rules: [
    'Jeu de quarante cartes : as = 1, sept = 7, valet = 8, dame = 9, roi = 10.',
    'Pose une carte : si elle égale une carte de la table, elle la ramasse. Sinon elle ramasse toute combinaison dont la somme l’égale.',
    'Vider la table d’un coup, c’est une scopa : un point de plus.',
    'Points de fin : le plus de cartes, le plus de carreaux, le sept de carreau, et chaque scopa. Premier à onze.',
  ],
};

const OBJECTIF = 11;

interface Etat {
  pioche: Carte[];
  maMain: Carte[];
  saMain: Carte[];
  table: Carte[];
  mesPrises: Carte[];
  sesPrises: Carte[];
  mesScopas: number;
  sesScopas: number;
  /** Qui a ramassé en dernier : il rafle la table en fin de donne. */
  dernierPreneur: 'moi' | 'lui' | null;
}

/**
 * Toutes les façons de capturer avec `valeur`.
 * L'égalité simple prime : si une carte de même valeur existe, on ne peut pas
 * prendre une combinaison à la place.
 */
export function capturesPossibles(table: Carte[], valeur: number): Carte[][] {
  const egales = table.filter((carte) => valeurScopa(carte) === valeur);
  if (egales.length > 0) return egales.map((carte) => [carte]);

  const combinaisons: Carte[][] = [];
  const explorer = (index: number, reste: number, courant: Carte[]) => {
    if (reste === 0 && courant.length > 1) {
      combinaisons.push(courant.slice());
      return;
    }
    if (reste <= 0 || index >= table.length) return;
    explorer(index + 1, reste - valeurScopa(table[index]), [...courant, table[index]]);
    explorer(index + 1, reste, courant);
  };
  explorer(0, valeur, []);
  return combinaisons;
}

const estSetteBello = (carte: Carte) => carte.rang === 7 && carte.couleur === 'K';

/** Décompte de fin de donne : cartes, carreaux, sept de carreau, scopas. */
function compterPoints(etat: Etat): { moi: number; lui: number; detail: string[] } {
  const detail: string[] = [];
  let moi = etat.mesScopas;
  let lui = etat.sesScopas;
  if (etat.mesScopas) detail.push(`${etat.mesScopas} scopa pour toi`);
  if (etat.sesScopas) detail.push(`${etat.sesScopas} scopa pour l’ordinateur`);

  if (etat.mesPrises.length > etat.sesPrises.length) {
    moi += 1;
    detail.push('Cartes : toi');
  } else if (etat.sesPrises.length > etat.mesPrises.length) {
    lui += 1;
    detail.push('Cartes : ordinateur');
  }

  const mesCarreaux = etat.mesPrises.filter((c) => c.couleur === 'K').length;
  const sesCarreaux = etat.sesPrises.filter((c) => c.couleur === 'K').length;
  if (mesCarreaux > sesCarreaux) {
    moi += 1;
    detail.push('Carreaux : toi');
  } else if (sesCarreaux > mesCarreaux) {
    lui += 1;
    detail.push('Carreaux : ordinateur');
  }

  if (etat.mesPrises.some(estSetteBello)) {
    moi += 1;
    detail.push('Sept de carreau : toi');
  } else if (etat.sesPrises.some(estSetteBello)) {
    lui += 1;
    detail.push('Sept de carreau : ordinateur');
  }

  return { moi, lui, detail };
}

function nouvelleDonne(): Etat {
  const paquet = melanger(jeu40()).map((c) => ({ ...c, visible: true }));
  return {
    pioche: paquet.slice(10),
    maMain: paquet.slice(0, 3),
    saMain: paquet.slice(3, 6).map((c) => ({ ...c, visible: false })),
    table: paquet.slice(6, 10),
    mesPrises: [],
    sesPrises: [],
    mesScopas: 0,
    sesScopas: 0,
    dernierPreneur: null,
  };
}

export default function Scopa({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [etat, setEtat] = useState<Etat>(nouvelleDonne);
  const [mesPoints, setMesPoints] = useState(0);
  const [sesPoints, setSesPoints] = useState(0);
  const [aMoi, setAMoi] = useState(true);
  const [message, setMessage] = useState('Pose une carte');
  const [selection, setSelection] = useState<number | null>(null);
  const comptee = useRef(false);

  const fini = mesPoints >= OBJECTIF || sesPoints >= OBJECTIF;
  const gagne = mesPoints > sesPoints;

  const reset = useCallback(() => {
    setEtat(nouvelleDonne());
    setMesPoints(0);
    setSesPoints(0);
    setAMoi(true);
    setMessage('Pose une carte');
    setSelection(null);
    comptee.current = false;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    submitResult(gagne ? 'win' : 'loss');
  }, [fini, gagne, haptic, submitResult]);

  /** Applique une pose et renvoie l'état suivant. */
  const poser = useCallback(
    (prev: Etat, carte: Carte, joueur: 'moi' | 'lui'): Etat => {
      const main = joueur === 'moi' ? prev.maMain : prev.saMain;
      const resteMain = main.filter((m) => m.id !== carte.id);
      const options = capturesPossibles(prev.table, valeurScopa(carte));

      if (options.length === 0) {
        const suivant = {
          ...prev,
          table: [...prev.table, { ...carte, visible: true }],
        };
        return joueur === 'moi'
          ? { ...suivant, maMain: resteMain }
          : { ...suivant, saMain: resteMain };
      }

      // On prend la capture la plus fournie : c'est presque toujours le bon choix.
      const prise = options.reduce((a, b) => (b.length > a.length ? b : a));
      const ids = new Set(prise.map((p) => p.id));
      const table = prev.table.filter((t) => !ids.has(t.id));
      const butin = [...prise, { ...carte, visible: true }];
      const scopa = table.length === 0 && prev.pioche.length + main.length > 1;

      const base = {
        ...prev,
        table,
        dernierPreneur: joueur,
      };

      return joueur === 'moi'
        ? {
            ...base,
            maMain: resteMain,
            mesPrises: [...prev.mesPrises, ...butin],
            mesScopas: prev.mesScopas + (scopa ? 1 : 0),
          }
        : {
            ...base,
            saMain: resteMain,
            sesPrises: [...prev.sesPrises, ...butin],
            sesScopas: prev.sesScopas + (scopa ? 1 : 0),
          };
    },
    [],
  );

  /** Redistribue trois cartes, ou clôt la donne si la pioche est vide. */
  const apresTour = useCallback(
    (suivant: Etat) => {
      if (suivant.maMain.length > 0 || suivant.saMain.length > 0) {
        setEtat(suivant);
        return;
      }

      if (suivant.pioche.length >= 6) {
        setEtat({
          ...suivant,
          maMain: suivant.pioche.slice(0, 3),
          saMain: suivant.pioche.slice(3, 6).map((c) => ({ ...c, visible: false })),
          pioche: suivant.pioche.slice(6),
        });
        setMessage('Nouvelles cartes');
        return;
      }

      // Fin de donne : le dernier preneur rafle ce qui reste sur la table.
      const cloture: Etat = {
        ...suivant,
        table: [],
        mesPrises:
          suivant.dernierPreneur === 'moi'
            ? [...suivant.mesPrises, ...suivant.table]
            : suivant.mesPrises,
        sesPrises:
          suivant.dernierPreneur === 'lui'
            ? [...suivant.sesPrises, ...suivant.table]
            : suivant.sesPrises,
      };

      const points = compterPoints(cloture);
      setMesPoints((p) => p + points.moi);
      setSesPoints((p) => p + points.lui);
      setMessage(`Fin de donne — ${points.detail.join(' · ') || 'aucun point'}`);
      haptic(points.moi > points.lui ? 'success' : 'warning');

      setTimeout(() => {
        setEtat(nouvelleDonne());
        setMessage('Nouvelle donne');
      }, 2600);
      setEtat(cloture);
    },
    [haptic],
  );

  const jouer = (index: number) => {
    if (!aMoi || fini) return;
    const carte = etat.maMain[index];
    if (!carte) return;
    const options = capturesPossibles(etat.table, valeurScopa(carte));
    haptic(options.length > 0 ? 'success' : 'light');
    setMessage(options.length > 0 ? 'Tu ramasses' : 'Carte posée sur la table');
    setSelection(null);
    const suivant = poser(etat, carte, 'moi');
    apresTour(suivant);
    setAMoi(false);
  };

  // Tour de l'ordinateur : il préfère prendre, et surtout le sept de carreau.
  useEffect(() => {
    if (aMoi || fini) return;
    if (etat.saMain.length === 0) {
      setAMoi(true);
      return;
    }

    const id = setTimeout(() => {
      let meilleure = etat.saMain[0];
      let meilleurGain = -1;

      for (const carte of etat.saMain) {
        const options = capturesPossibles(etat.table, valeurScopa(carte));
        if (options.length === 0) continue;
        const prise = options.reduce((a, b) => (b.length > a.length ? b : a));
        let gain = prise.length * 2;
        if (prise.some(estSetteBello) || estSetteBello(carte)) gain += 10;
        gain += prise.filter((p) => p.couleur === 'K').length * 2;
        if (etat.table.length === prise.length) gain += 8; // scopa
        if (gain > meilleurGain) {
          meilleurGain = gain;
          meilleure = carte;
        }
      }

      // Rien à prendre : il se défausse de sa plus petite carte.
      if (meilleurGain < 0) {
        meilleure = etat.saMain.reduce((a, b) => (valeurScopa(b) < valeurScopa(a) ? b : a));
      }

      setMessage(meilleurGain >= 0 ? 'L’ordinateur ramasse' : 'L’ordinateur se défausse');
      const suivant = poser(etat, meilleure, 'lui');
      apresTour(suivant);
      setAMoi(true);
    }, 850);

    return () => clearTimeout(id);
  }, [aMoi, fini, etat, poser, apresTour]);

  const mesCarreaux = useMemo(() => etat.mesPrises.filter((c) => c.couleur === 'K').length, [etat.mesPrises]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {mesPoints}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {sesPoints}
      </Txt>
      <Txt variant="label" tone="faint">
        objectif {OBJECTIF}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          ORDINATEUR · {etat.saMain.length} cartes · {etat.sesPrises.length} ramassées
          {etat.sesScopas > 0 ? ` · ${etat.sesScopas} scopa` : ''}
        </Txt>
        <Row gap={4}>
          {etat.saMain.map((carte, i) => (
            <CarteVue key={`${carte.id}-${i}`} carte={{ ...carte, visible: false }} largeur={44} />
          ))}
        </Row>
      </View>

      <View
        style={{
          alignItems: 'center',
          gap: space.sm,
          paddingVertical: space.md,
          marginHorizontal: space.md,
          borderRadius: radius.lg,
          backgroundColor: c.felt + '33',
        }}
      >
        <Txt variant="caption" tone="faint">
          TABLE
        </Txt>
        <Row gap={4} style={{ flexWrap: 'wrap', justifyContent: 'center', minHeight: 70 }}>
          {etat.table.map((carte, i) => (
            <CarteVue key={`${carte.id}-${i}`} carte={carte} largeur={48} />
          ))}
        </Row>
        <Txt variant="label" tone="dim" center>
          {message}
        </Txt>
      </View>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Row gap={5}>
          {etat.maMain.map((carte, i) => (
            <CarteVue
              key={`${carte.id}-${i}`}
              carte={carte}
              largeur={62}
              selectionnee={selection === i}
              onPress={() => {
                setSelection(i);
                jouer(i);
              }}
            />
          ))}
        </Row>
        <Txt variant="caption" tone="faint">
          TOI · {etat.mesPrises.length} ramassées · {mesCarreaux} carreaux
          {etat.mesScopas > 0 ? ` · ${etat.mesScopas} scopa` : ''}
        </Txt>
      </View>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Partie gagnée !' : 'L’ordinateur l’emporte'}
        score={`${mesPoints} – ${sesPoints}`}
        scoreLabel="Points"
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
