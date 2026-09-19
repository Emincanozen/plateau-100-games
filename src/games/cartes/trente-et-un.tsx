import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Carte as CarteVue, Row, Txt, GameOver } from '@/ui';
import { COULEURS, jeu52, melanger, type Carte, type Couleur } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'trente-et-un',
  name: 'Trente-et-un',
  tagline: 'Trois cartes d’une même couleur, et vise trente-et-un.',
  category: 'cartes',
  emoji: '🎴',
  difficulty: 2,
  players: '1',
  minutes: 8,
  score: 'none',
  tags: ['plis', 'bluff', 'classique'],
  rules: [
    'Tu as trois cartes ; trois autres sont posées face visible au milieu.',
    'À ton tour, échange une carte avec le milieu, ou échange les trois d’un coup, ou passe.',
    'Ton score est la somme de tes cartes d’une même couleur : as = 11, figures = 10. Trois cartes identiques valent 30½.',
    'Quand tu frappes, chacun joue un dernier tour puis on compare : le plus faible perd une vie. Trois vies chacun.',
  ],
};

const valeur = (carte: Carte): number => {
  if (carte.rang === 1) return 11;
  return Math.min(carte.rang, 10);
};

/** Meilleur total d'une main : la meilleure couleur, ou 30,5 pour un brelan. */
export function scoreMain(main: Carte[]): number {
  if (main.length === 3 && main.every((carte) => carte.rang === main[0].rang)) return 30.5;
  let meilleur = 0;
  for (const couleur of COULEURS) {
    const total = main
      .filter((carte) => carte.couleur === couleur)
      .reduce((somme, carte) => somme + valeur(carte), 0);
    meilleur = Math.max(meilleur, total);
  }
  return meilleur;
}

const VIES_DEPART = 3;

export default function TrenteEtUn({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [maMain, setMaMain] = useState<Carte[]>([]);
  const [saMain, setSaMain] = useState<Carte[]>([]);
  const [milieu, setMilieu] = useState<Carte[]>([]);
  const [mesVies, setMesVies] = useState(VIES_DEPART);
  const [sesVies, setSesVies] = useState(VIES_DEPART);
  const [aMoi, setAMoi] = useState(true);
  /** Qui a frappé : chacun joue encore un tour après. */
  const [frappe, setFrappe] = useState<null | 'moi' | 'lui'>(null);
  const [toursApresFrappe, setToursApresFrappe] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const [message, setMessage] = useState('Échange une carte ou passe');
  const [revele, setRevele] = useState(false);
  const comptee = useRef(false);

  const monScore = useMemo(() => scoreMain(maMain), [maMain]);
  const sonScore = useMemo(() => scoreMain(saMain), [saMain]);

  const fini = mesVies <= 0 || sesVies <= 0;
  const gagne = fini && sesVies <= 0;

  const nouvelleManche = useCallback(() => {
    const paquet = melanger(jeu52()).map((carte) => ({ ...carte, visible: true }));
    setMaMain(paquet.slice(0, 3));
    setSaMain(paquet.slice(3, 6).map((carte) => ({ ...carte, visible: false })));
    setMilieu(paquet.slice(6, 9));
    setAMoi(true);
    setFrappe(null);
    setToursApresFrappe(0);
    setSelection(null);
    setRevele(false);
    setMessage('Échange une carte ou passe');
  }, []);

  const reset = useCallback(() => {
    setMesVies(VIES_DEPART);
    setSesVies(VIES_DEPART);
    comptee.current = false;
    nouvelleManche();
  }, [nouvelleManche]);

  useEffect(() => {
    reset();
  }, [reset]);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    submitResult(gagne ? 'win' : 'loss');
  }, [fini, gagne, haptic, submitResult]);

  /** Comparaison de fin de manche : le plus faible perd une vie. */
  const conclure = useCallback(
    (mienne: Carte[], sienne: Carte[]) => {
      const a = scoreMain(mienne);
      const b = scoreMain(sienne);
      setRevele(true);
      setSaMain(sienne.map((carte) => ({ ...carte, visible: true })));

      if (a === b) {
        setMessage(`Égalité à ${a} — personne ne perd de vie`);
        haptic('warning');
      } else if (a > b) {
        setSesVies((v) => v - 1);
        setMessage(`${a} contre ${b} : l’ordinateur perd une vie`);
        haptic('success');
      } else {
        setMesVies((v) => v - 1);
        setMessage(`${a} contre ${b} : tu perds une vie`);
        haptic('error');
      }

      // Manche suivante après un temps de lecture.
      setTimeout(() => {
        setRevele(false);
        nouvelleManche();
      }, 2200);
    },
    [haptic, nouvelleManche],
  );

  const passerLaMain = useCallback(
    (mienne: Carte[], sienne: Carte[], milieuCourant: Carte[]) => {
      if (frappe === null) {
        setAMoi((tour) => !tour);
        return;
      }
      // Un tour complet après la frappe, puis on compare.
      const tours = toursApresFrappe + 1;
      setToursApresFrappe(tours);
      if (tours >= 2) conclure(mienne, sienne);
      else setAMoi((tour) => !tour);
    },
    [frappe, toursApresFrappe, conclure],
  );

  const echanger = (indexMilieu: number) => {
    if (!aMoi || fini || revele) return;
    if (selection === null) {
      setMessage('Choisis d’abord une de tes cartes');
      haptic('warning');
      return;
    }
    haptic('light');
    const mienne = maMain.slice();
    const table = milieu.slice();
    const temporaire = mienne[selection];
    mienne[selection] = table[indexMilieu];
    table[indexMilieu] = temporaire;
    setMaMain(mienne);
    setMilieu(table);
    setSelection(null);
    setMessage('Carte échangée');
    passerLaMain(mienne, saMain, table);
  };

  const toutEchanger = () => {
    if (!aMoi || fini || revele) return;
    haptic('medium');
    const mienne = milieu.slice();
    const table = maMain.slice();
    setMaMain(mienne);
    setMilieu(table);
    setSelection(null);
    setMessage('Tu prends les trois cartes du milieu');
    passerLaMain(mienne, saMain, table);
  };

  const passer = () => {
    if (!aMoi || fini || revele) return;
    haptic('light');
    setMessage('Tu passes');
    passerLaMain(maMain, saMain, milieu);
  };

  const frapper = () => {
    if (!aMoi || fini || revele || frappe !== null) return;
    haptic('medium');
    setFrappe('moi');
    setToursApresFrappe(0);
    setMessage('Tu frappes : dernier tour pour l’adversaire');
    setAMoi(false);
  };

  // Tour de l'ordinateur.
  useEffect(() => {
    if (aMoi || fini || revele) return;

    const id = setTimeout(() => {
      const actuel = scoreMain(saMain);

      // Cherche l'échange qui améliore le plus sa main.
      let meilleur = { gain: 0, main: saMain, table: milieu };
      for (let i = 0; i < saMain.length; i++) {
        for (let j = 0; j < milieu.length; j++) {
          const essai = saMain.slice();
          const table = milieu.slice();
          const temporaire = essai[i];
          essai[i] = table[j];
          table[j] = temporaire;
          const gain = scoreMain(essai) - actuel;
          if (gain > meilleur.gain) meilleur = { gain, main: essai, table };
        }
      }

      if (frappe === null && actuel >= 29) {
        setFrappe('lui');
        setToursApresFrappe(0);
        setMessage('L’ordinateur frappe : dernier tour pour toi');
        setAMoi(true);
        return;
      }

      if (meilleur.gain > 0) {
        setSaMain(meilleur.main);
        setMilieu(meilleur.table);
        setMessage('L’ordinateur échange une carte');
        passerLaMain(maMain, meilleur.main, meilleur.table);
      } else {
        setMessage('L’ordinateur passe');
        passerLaMain(maMain, saMain, milieu);
      }
    }, 850);

    return () => clearTimeout(id);
  }, [aMoi, fini, revele, saMain, milieu, maMain, frappe, passerLaMain]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {'♥'.repeat(Math.max(0, mesVies))}
      </Txt>
      <Txt variant="label" style={{ color: '#E0525F' }}>
        {monScore % 1 === 0 ? monScore : monScore.toFixed(1)}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {'♥'.repeat(Math.max(0, sesVies))}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.md }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          ORDINATEUR {revele ? `· ${sonScore}` : ''}
        </Txt>
        <Row gap={5}>
          {saMain.map((carte, i) => (
            <CarteVue key={`${carte.id}-${i}`} carte={carte} largeur={52} />
          ))}
        </Row>
      </View>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          LE MILIEU — touche pour échanger
        </Txt>
        <Row gap={5}>
          {milieu.map((carte, i) => (
            <CarteVue
              key={`${carte.id}-${i}`}
              carte={carte}
              largeur={58}
              onPress={() => echanger(i)}
            />
          ))}
        </Row>
      </View>

      <Txt variant="label" tone="dim" center>
        {message}
      </Txt>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Row gap={5}>
          {maMain.map((carte, i) => (
            <CarteVue
              key={`${carte.id}-${i}`}
              carte={carte}
              largeur={58}
              selectionnee={selection === i}
              onPress={() => setSelection(selection === i ? null : i)}
            />
          ))}
        </Row>
        <View
          style={{
            paddingHorizontal: space.md,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: monScore >= 31 ? '#34B37E22' : c.surfaceAlt,
          }}
        >
          <Txt variant="label" style={{ color: monScore >= 31 ? '#34B37E' : c.textDim }}>
            Ta main : {monScore % 1 === 0 ? monScore : monScore.toFixed(1)}
          </Txt>
        </View>
      </View>

      <Row gap={space.sm}>
        <Button
          label="Tout échanger"
          size="sm"
          kind="secondary"
          disabled={!aMoi || fini || revele}
          onPress={toutEchanger}
        />
        <Button label="Passer" size="sm" kind="secondary" disabled={!aMoi || fini || revele} onPress={passer} />
        <Button
          label="Frapper"
          size="sm"
          accent="#E0525F"
          disabled={!aMoi || fini || revele || frappe !== null}
          onPress={frapper}
        />
      </Row>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'L’ordinateur a coulé !' : 'Tu as perdu tes trois vies'}
        detail={`Vies restantes : toi ${Math.max(0, mesVies)}, ordinateur ${Math.max(0, sesVies)}`}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
