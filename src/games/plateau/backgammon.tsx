import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { randBetween } from '../lib/rng';
import {
  BARRE,
  SORTIE,
  appliquerMouvement,
  desDuLancer,
  etatInitial,
  fin,
  meilleureSuite,
  pipCount,
  toutesLesSuites,
  type Camp,
  type Etat,
  type Mouvement,
  type Niveau,
} from '../lib/backgammon';

export const meta: GameMeta = {
  id: 'backgammon',
  name: 'Backgammon',
  tagline: 'Les dés décident du possible, toi du reste.',
  category: 'plateau',
  emoji: '🎯',
  difficulty: 3,
  players: '1-2',
  minutes: 20,
  score: 'none',
  tags: ['dés', 'stratégie', 'duo', 'classique'],
  rules: [
    'Tu joues les blancs, qui descendent de la flèche 24 vers la 1 puis sortent du plateau.',
    'Chaque dé est un déplacement. Un double se joue quatre fois.',
    'Deux pions adverses ferment une flèche. Un pion seul s’y fait frapper et repart de la barre.',
    'Un pion sur la barre doit rentrer avant tout autre mouvement.',
    'La sortie commence quand tes quinze pions sont dans ton jan. Le premier à tout sortir gagne.',
  ],
};

const ACCENT = '#5B8DEF';
const PION_BLANC = '#F2F2F6';
const PION_NOIR = '#1C1C24';

type Camps = 'solo' | 'duo';

/** Deux mouvements sont le même coup s'ils partent et arrivent au même endroit. */
const memeCoup = (a: Mouvement, b: Mouvement) =>
  a.depuis === b.depuis && a.vers === b.vers && a.de === b.de;

/** Position d'écran d'une flèche : rangée du haut ou du bas, et colonne. */
function placement(index: number): { haut: boolean; colonne: number } {
  if (index >= 12) return { haut: true, colonne: index - 12 };
  return { haut: false, colonne: 11 - index };
}

export default function Backgammon({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(20, 0.42);

  const barLargeur = Math.floor(largeur * 0.055);
  const flecheLargeur = Math.floor((largeur - barLargeur) / 12);
  const demiHauteur = Math.floor(flecheLargeur * 4.2);
  const pion = Math.floor(flecheLargeur * 0.86);

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const [camps, setCamps] = useState<Camps>('solo');
  const [etat, setEtat] = useState<Etat>(etatInitial);
  const [des, setDes] = useState<[number, number] | null>(null);
  /** Suites encore compatibles avec ce qui a déjà été joué ce tour-ci. */
  const [restantes, setRestantes] = useState<Mouvement[][]>([]);
  const [selection, setSelection] = useState<number | null>(null);
  const [avantTour, setAvantTour] = useState<Etat | null>(null);
  const [message, setMessage] = useState('Lance les dés');
  const [comptee, setComptee] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  const solo = camps === 'solo';
  const issue = useMemo(() => fin(etat), [etat]);
  const fini = issue !== null;
  const aMoi = !solo || etat.trait === 1;

  const reset = useCallback(() => {
    setEtat(etatInitial());
    setDes(null);
    setRestantes([]);
    setSelection(null);
    setAvantTour(null);
    setMessage('Lance les dés');
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, camps, reset]);

  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    [],
  );

  useEffect(() => {
    if (!fini || comptee || issue === null) return;
    setComptee(true);
    const jeGagne = !solo || issue.gagnant === 1;
    haptic(jeGagne ? 'success' : 'error');
    if (solo) submitResult(issue.gagnant === 1 ? 'win' : 'loss');
  }, [fini, comptee, issue, solo, haptic, submitResult]);

  const passerLaMain = useCallback((position: Etat) => {
    setEtat({ ...position, trait: (position.trait === 1 ? -1 : 1) as Camp });
    setDes(null);
    setRestantes([]);
    setSelection(null);
    setAvantTour(null);
  }, []);

  const lancer = useCallback(() => {
    if (fini || des !== null) return;
    const a = randBetween(1, 6);
    const b = randBetween(1, 6);
    setDes([a, b]);
    haptic('medium');

    const suites = toutesLesSuites(etat, desDuLancer(a, b));
    if (suites.length === 0) {
      setMessage(`${a} et ${b} : aucun mouvement possible`);
      minuterie.current = setTimeout(() => passerLaMain(etat), 1100);
      return;
    }
    setAvantTour(etat);
    setRestantes(suites.map((s) => s.mouvements));
    setMessage(a === b ? `Double ${a} — quatre mouvements` : `${a} et ${b}`);
  }, [fini, des, etat, haptic, passerLaMain]);

  const jouerMouvement = useCallback(
    (m: Mouvement) => {
      const suivant = appliquerMouvement(etat, m);
      const reste = restantes
        .filter((suite) => suite.length > 0 && memeCoup(suite[0], m))
        .map((suite) => suite.slice(1));

      haptic(m.frappe ? 'heavy' : 'light');
      if (m.frappe) setMessage('Pion frappé — il repart de la barre');
      setSelection(null);

      if (reste.length === 0 || reste[0].length === 0) {
        setEtat(suivant);
        minuterie.current = setTimeout(() => passerLaMain(suivant), 320);
        return;
      }
      setEtat(suivant);
      setRestantes(reste);
    },
    [etat, restantes, haptic, passerLaMain],
  );

  // Tour de l'ordinateur : lancer, puis dérouler la meilleure suite.
  useEffect(() => {
    if (!solo || fini || etat.trait !== -1) return;
    if (des !== null) return;

    const id = setTimeout(() => {
      const a = randBetween(1, 6);
      const b = randBetween(1, 6);
      setDes([a, b]);

      const suite = meilleureSuite(etat, desDuLancer(a, b), niveau);
      if (!suite) {
        setMessage(`L’ordinateur fait ${a} et ${b} : bloqué`);
        minuterie.current = setTimeout(() => passerLaMain(etat), 900);
        return;
      }
      const frappes = suite.mouvements.filter((m) => m.frappe).length;
      setMessage(
        `L’ordinateur joue ${a} et ${b}${frappes > 0 ? ` et frappe ${frappes} pion${frappes > 1 ? 's' : ''}` : ''}`,
      );
      minuterie.current = setTimeout(() => {
        haptic(frappes > 0 ? 'heavy' : 'light');
        passerLaMain(suite.etat);
      }, 700);
    }, 520);
    return () => clearTimeout(id);
  }, [solo, fini, etat, des, niveau, haptic, passerLaMain]);

  const premiers = useMemo(
    () => restantes.map((suite) => suite[0]).filter((m): m is Mouvement => m !== undefined),
    [restantes],
  );

  const sources = useMemo(() => new Set(premiers.map((m) => m.depuis)), [premiers]);

  const destinations = useMemo(() => {
    if (selection === null) return new Map<number, Mouvement>();
    const carte = new Map<number, Mouvement>();
    for (const m of premiers) if (m.depuis === selection && !carte.has(m.vers)) carte.set(m.vers, m);
    return carte;
  }, [premiers, selection]);

  // Un pion sur la barre ne laisse pas le choix de la source.
  useEffect(() => {
    if (aMoi && sources.size > 0 && sources.has(BARRE) && selection !== BARRE) setSelection(BARRE);
  }, [aMoi, sources, selection]);

  const toucher = (cible: number) => {
    if (fini || !aMoi || restantes.length === 0) return;

    const m = destinations.get(cible);
    if (m) {
      jouerMouvement(m);
      return;
    }
    if (sources.has(cible)) {
      haptic('light');
      setSelection(selection === cible ? null : cible);
    }
  };

  const annuler = () => {
    if (avantTour === null || des === null) return;
    haptic('light');
    setEtat(avantTour);
    setRestantes(toutesLesSuites(avantTour, desDuLancer(des[0], des[1])).map((s) => s.mouvements));
    setSelection(null);
  };

  const nom = (camp: Camp) => (solo ? (camp === 1 ? 'Toi' : 'L’ordinateur') : camp === 1 ? 'Blancs' : 'Noirs');

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini
          ? `${nom(issue!.gagnant)} gagne`
          : des === null
            ? `${nom(etat.trait)} : à lancer`
            : `${nom(etat.trait)} joue`}
      </Txt>
      <Txt variant="label" tone="faint">
        {pipCount(etat, 1)} – {pipCount(etat, -1)}
      </Txt>
      <Txt variant="label" tone="faint">
        {etat.sortiBlanc}/15
      </Txt>
    </Row>,
  );

  /**
   * Une flèche avec ses pions empilés depuis le bord.
   * C'est une simple fonction, pas un composant : un composant déclaré ici
   * serait un type neuf à chaque rendu, et React remonterait les vingt-quatre
   * flèches — ce qui détache les nœuds entre deux touchers.
   */
  const rendreFleche = (index: number) => {
    const { haut } = placement(index);
    const nombre = Math.abs(etat.points[index]);
    const camp: Camp = etat.points[index] > 0 ? 1 : -1;
    const teinteFleche = index % 2 === 0 ? c.boardDark : c.boardLight;
    const choisie = selection === index;
    const cible = destinations.has(index);

    return (
      <Pressable
        key={index}
        accessibilityRole="button"
        accessibilityLabel={`Flèche ${index + 1}${
          nombre === 0 ? ' vide' : `, ${nombre} pion${nombre > 1 ? 's' : ''} ${camp === 1 ? 'blanc' : 'noir'}${nombre > 1 ? 's' : ''}`
        }`}
        onPress={() => toucher(index)}
        style={{ width: flecheLargeur, height: demiHauteur }}
      >
        <View
          style={{
            position: 'absolute',
            [haut ? 'top' : 'bottom']: 0,
            width: 0,
            height: 0,
            borderLeftWidth: flecheLargeur / 2,
            borderRightWidth: flecheLargeur / 2,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            ...(haut
              ? { borderTopWidth: demiHauteur, borderTopColor: teinteFleche }
              : { borderBottomWidth: demiHauteur, borderBottomColor: teinteFleche }),
          }}
        />
        {cible ? (
          <View
            style={{
              position: 'absolute',
              [haut ? 'top' : 'bottom']: 2,
              alignSelf: 'center',
              width: pion * 0.5,
              height: pion * 0.5,
              borderRadius: pion,
              backgroundColor: `${ACCENT}DD`,
            }}
          />
        ) : null}
        {Array.from({ length: Math.min(nombre, 5) }, (_, k) => (
          <View
            key={k}
            style={{
              position: 'absolute',
              [haut ? 'top' : 'bottom']: k * (pion * 0.82),
              left: (flecheLargeur - pion) / 2,
              width: pion,
              height: pion,
              borderRadius: pion,
              backgroundColor: camp === 1 ? PION_BLANC : PION_NOIR,
              borderWidth: choisie && k === Math.min(nombre, 5) - 1 ? 2.5 : 1,
              borderColor: choisie && k === Math.min(nombre, 5) - 1 ? ACCENT : '#00000055',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {nombre > 5 && k === 4 ? (
              <Txt
                style={{
                  fontSize: pion * 0.5,
                  fontWeight: '800',
                  color: camp === 1 ? '#1C1C24' : '#F2F2F6',
                }}
              >
                {nombre}
              </Txt>
            ) : null}
          </View>
        ))}
      </Pressable>
    );
  };

  const rangee = (indices: number[], haut: boolean) => (
    <Row gap={0} align="flex-start">
      {indices.slice(0, 6).map((i) => rendreFleche(i))}
      <View style={{ width: barLargeur, height: demiHauteur, backgroundColor: c.boardEdge }}>
        {/* Les pions frappés attendent sur la barre : les noirs en haut, les blancs en bas. */}
        {Array.from(
          { length: haut ? etat.barreNoir : etat.barreBlanc },
          (_, k) => (
            <View
              key={k}
              style={{
                position: 'absolute',
                [haut ? 'top' : 'bottom']: k * (pion * 0.5) + 4,
                left: (barLargeur - pion * 0.8) / 2,
                width: pion * 0.8,
                height: pion * 0.8,
                borderRadius: pion,
                backgroundColor: haut ? PION_NOIR : PION_BLANC,
                borderWidth: !haut && selection === BARRE ? 2.5 : 1,
                borderColor: !haut && selection === BARRE ? ACCENT : '#00000055',
              }}
            />
          ),
        )}
      </View>
      {indices.slice(6).map((i) => rendreFleche(i))}
    </Row>
  );

  const sortiePossible = destinations.has(SORTIE);

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: space.sm, paddingTop: space.sm }}>
      <View style={{ width: Math.max(largeur, 280), gap: space.sm }}>
        <Segmented<Camps>
          value={camps}
          onChange={setCamps}
          options={[
            { value: 'solo', label: 'Contre l’ordinateur' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent={ACCENT}
        />
        {solo ? (
          <Segmented<Niveau>
            value={niveau}
            onChange={setNiveau}
            options={[
              { value: 'facile', label: 'Facile' },
              { value: 'normal', label: 'Normal' },
              { value: 'expert', label: 'Expert' },
            ]}
            accent={ACCENT}
          />
        ) : null}
      </View>

      <View
        style={{
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 3,
          borderColor: c.boardEdge,
          backgroundColor: c.felt,
        }}
      >
        {rangee([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], true)}
        <View style={{ height: 6, backgroundColor: c.boardEdge }} />
        {rangee([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0], false)}
      </View>

      <Row gap={space.md} between style={{ width: Math.max(largeur, 280) }}>
        <Txt variant="caption" tone="faint">
          Sortis · toi {etat.sortiBlanc} / lui {etat.sortiNoir}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sortir le pion du plateau"
          disabled={!sortiePossible}
          onPress={() => toucher(SORTIE)}
          style={{
            paddingHorizontal: space.md,
            paddingVertical: 6,
            borderRadius: radius.pill,
            backgroundColor: sortiePossible ? ACCENT : c.surfaceAlt,
            opacity: sortiePossible ? 1 : 0.5,
          }}
        >
          <Txt variant="caption" style={{ color: sortiePossible ? c.onAccent : c.textFaint }}>
            Sortie
          </Txt>
        </Pressable>
      </Row>

      <Row gap={space.md}>
        {des ? (
          <>
            <De valeur={des[0]} taille={40} tint={etat.trait === 1 ? ACCENT : '#E0525F'} />
            <De valeur={des[1]} taille={40} tint={etat.trait === 1 ? ACCENT : '#E0525F'} />
          </>
        ) : (
          <>
            <De valeur={1} taille={40} eteint />
            <De valeur={1} taille={40} eteint />
          </>
        )}
        {restantes.length > 0 ? (
          <Txt variant="label" tone="accent">
            {restantes[0].length} à jouer
          </Txt>
        ) : null}
      </Row>

      <Row gap={space.sm}>
        <Button
          label={aMoi ? 'Lancer les dés' : 'À l’ordinateur'}
          disabled={fini || des !== null || !aMoi}
          accent={ACCENT}
          onPress={lancer}
        />
        <Button
          label="Annuler"
          kind="secondary"
          size="sm"
          disabled={avantTour === null || !aMoi}
          onPress={annuler}
        />
      </Row>

      <Txt variant="caption" tone="faint" center>
        {fini
          ? 'Partie terminée'
          : !aMoi
            ? message
            : restantes.length === 0
              ? message
              : selection === null
                ? 'Choisis un pion à déplacer'
                : sortiePossible
                  ? 'Touche une flèche marquée, ou « Sortie »'
                  : 'Touche une flèche marquée'}
      </Txt>

      <GameOver
        visible={fini}
        outcome={!solo || issue?.gagnant === 1 ? 'win' : 'loss'}
        title={
          issue?.facteur === 3
            ? 'Backgammon !'
            : issue?.facteur === 2
              ? 'Gammon !'
              : `${nom(issue?.gagnant ?? 1)} sort les quinze pions`
        }
        detail={
          issue?.facteur === 3
            ? 'Le perdant n’a rien sorti et avait encore un pion dans le jan adverse : la partie compte triple.'
            : issue?.facteur === 2
              ? 'Le perdant n’a sorti aucun pion : la partie compte double.'
              : undefined
        }
        accent={ACCENT}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
