import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Row, Segmented, Sheet, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import {
  CAVALIER,
  DAME,
  FOU,
  GLYPHES,
  TOUR,
  appliquer,
  couleurDe,
  coupsLegaux,
  enEchec,
  issue,
  meilleurCoup,
  noterCoup,
  positionInitiale,
  trouverRoi,
  type Coup,
  type Couleur,
  type Niveau,
  type Position,
} from '../lib/echecs';

export const meta: GameMeta = {
  id: 'echecs',
  name: 'Échecs',
  tagline: 'Le jeu de toujours, avec un adversaire qui calcule vraiment.',
  category: 'plateau',
  emoji: '♛',
  difficulty: 3,
  players: '1-2',
  minutes: 25,
  score: 'none',
  tags: ['stratégie', 'duo', 'classique'],
  rules: [
    'Les règles complètes : roque, prise en passant, promotion, échec et mat, pat.',
    'Touche une pièce pour voir ses coups légaux, puis touche la case d’arrivée.',
    'Un coup qui laisserait ton roi en échec n’est jamais proposé.',
    'La partie est nulle par pat, par matériel insuffisant ou après cinquante coups sans prise ni poussée de pion.',
  ],
};

const ACCENT = '#5B8DEF';
const BLANC = '#F4F4F7';
const NOIR = '#16161C';
const DERNIER = '#F0A03055';

type Camps = 'blancs' | 'noirs' | 'duo';

const PROMOTIONS: { valeur: number; nom: string }[] = [
  { valeur: DAME, nom: 'Dame' },
  { valeur: TOUR, nom: 'Tour' },
  { valeur: FOU, nom: 'Fou' },
  { valeur: CAVALIER, nom: 'Cavalier' },
];

/** Différence de matériel, en pions, du point de vue des blancs. */
function avantage(position: Position): number {
  const poids = [0, 1, 3, 3, 5, 9, 0];
  let total = 0;
  for (const piece of position.cases) {
    if (piece === 0) continue;
    total += piece > 0 ? poids[piece] : -poids[-piece];
  }
  return total;
}

export default function Echecs({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(24, 0.5);
  const cellule = Math.floor(largeur / 8);

  const [niveau, setNiveau] = useState<Niveau>('normal');
  const [camps, setCamps] = useState<Camps>('blancs');
  const [position, setPosition] = useState<Position>(positionInitiale);
  const [choisie, setChoisie] = useState<number | null>(null);
  const [dernier, setDernier] = useState<Coup | null>(null);
  const [journal, setJournal] = useState<string[]>([]);
  const [promotion, setPromotion] = useState<{ depuis: number; vers: number } | null>(null);
  const [comptee, setComptee] = useState(false);

  const monCamp: Couleur | null = camps === 'blancs' ? 1 : camps === 'noirs' ? -1 : null;
  const legaux = useMemo(() => coupsLegaux(position), [position]);
  const fin = useMemo(() => issue(position), [position]);
  const fini = fin !== null;
  const echec = useMemo(() => enEchec(position), [position]);
  const aMoi = monCamp === null || position.trait === monCamp;

  /** Le camp mat est celui qui ne peut plus jouer. */
  const vainqueur: Couleur | null = fin === 'mat' ? ((-position.trait) as Couleur) : null;

  const reset = useCallback(() => {
    setPosition(positionInitiale());
    setChoisie(null);
    setDernier(null);
    setJournal([]);
    setPromotion(null);
    setComptee(false);
  }, []);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [niveau, camps, reset]);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    if (vainqueur === null) {
      haptic('warning');
      if (monCamp !== null) submitResult('draw');
      return;
    }
    const jeGagne = monCamp === null || vainqueur === monCamp;
    haptic(jeGagne ? 'success' : 'error');
    if (monCamp !== null) submitResult(vainqueur === monCamp ? 'win' : 'loss');
  }, [fini, comptee, vainqueur, monCamp, haptic, submitResult]);

  const jouer = useCallback((courante: Position, coup: Coup) => {
    setJournal((liste) => [...liste, noterCoup(courante, coup)]);
    setPosition(appliquer(courante, coup));
    setDernier(coup);
    setChoisie(null);
  }, []);

  useEffect(() => {
    if (monCamp === null || fini || position.trait === monCamp) return;
    const id = setTimeout(() => {
      const coup = meilleurCoup(position, niveau);
      if (coup) {
        haptic(coup.prise > 0 ? 'heavy' : 'light');
        jouer(position, coup);
      }
    }, 240);
    return () => clearTimeout(id);
  }, [position, monCamp, niveau, fini, jouer, haptic]);

  const destinations = useMemo(() => {
    if (choisie === null) return new Map<number, Coup>();
    const carte = new Map<number, Coup>();
    for (const coup of legaux) if (coup.depuis === choisie) carte.set(coup.vers, coup);
    return carte;
  }, [choisie, legaux]);

  const toucher = (index: number) => {
    if (fini || !aMoi || promotion !== null) return;

    if (choisie !== null && destinations.has(index)) {
      const candidats = legaux.filter((k) => k.depuis === choisie && k.vers === index);
      // Une promotion offre quatre coups vers la même case : il faut choisir.
      if (candidats.length > 1 && candidats[0].promotion) {
        setPromotion({ depuis: choisie, vers: index });
        return;
      }
      haptic(candidats[0].prise > 0 ? 'heavy' : 'medium');
      jouer(position, candidats[0]);
      return;
    }

    const piece = position.cases[index];
    if (piece !== 0 && couleurDe(piece) === position.trait) {
      haptic('light');
      setChoisie(choisie === index ? null : index);
      return;
    }
    setChoisie(null);
  };

  const promouvoir = (valeur: number) => {
    if (promotion === null) return;
    const coup = legaux.find(
      (k) => k.depuis === promotion.depuis && k.vers === promotion.vers && k.promotion === valeur,
    );
    setPromotion(null);
    if (coup) {
      haptic('success');
      jouer(position, coup);
    }
  };

  const roiEnEchec = echec ? trouverRoi(position.cases, position.trait) : -1;
  const materiel = avantage(position);

  const nomCamp = (couleur: Couleur) => (couleur === 1 ? 'blancs' : 'noirs');

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone={echec && !fini ? 'danger' : 'dim'}>
        {fini
          ? fin === 'mat'
            ? `Mat — les ${nomCamp(vainqueur as Couleur)} gagnent`
            : fin === 'pat'
              ? 'Pat — partie nulle'
              : fin === 'materiel'
                ? 'Nulle — matériel insuffisant'
                : 'Nulle — cinquante coups'
          : echec
            ? `Échec aux ${nomCamp(position.trait)} !`
            : monCamp === null
              ? `Aux ${nomCamp(position.trait)}`
              : aMoi
                ? 'À toi de jouer'
                : 'L’ordinateur réfléchit…'}
      </Txt>
      {materiel !== 0 ? (
        <Txt variant="label" tone="faint">
          {materiel > 0 ? '+' : ''}
          {materiel}
        </Txt>
      ) : null}
      <Txt variant="label" tone="faint">
        {Math.floor(journal.length / 2) + 1}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ width: Math.max(cellule * 8, 280), gap: space.sm }}>
        <Segmented<Camps>
          value={camps}
          onChange={setCamps}
          options={[
            { value: 'blancs', label: 'Blancs' },
            { value: 'noirs', label: 'Noirs' },
            { value: 'duo', label: 'Duo' },
          ]}
          accent={ACCENT}
        />
        {camps !== 'duo' ? (
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
          width: cellule * 8,
          height: cellule * 8,
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: c.boardEdge,
        }}
      >
        {Array.from({ length: 64 }, (_, i) => {
          const piece = position.cases[i];
          const sombre = ((i >> 3) + (i & 7)) % 2 === 1;
          const cible = destinations.get(i);
          const surLeChemin = dernier && (dernier.depuis === i || dernier.vers === i);

          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Case ${'abcdefgh'[i & 7]}${8 - (i >> 3)}${
                piece === 0
                  ? ' vide'
                  : `, ${piece > 0 ? 'blanc' : 'noir'} ${
                      { 1: 'pion', 2: 'cavalier', 3: 'fou', 4: 'tour', 5: 'dame', 6: 'roi' }[
                        Math.abs(piece) as 1 | 2 | 3 | 4 | 5 | 6
                      ]
                    }`
              }`}
              onPress={() => toucher(i)}
              style={{
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  i === roiEnEchec
                    ? '#E0525F88'
                    : choisie === i
                      ? `${ACCENT}88`
                      : surLeChemin
                        ? DERNIER
                        : sombre
                          ? c.boardDark
                          : c.boardLight,
              }}
            >
              {piece !== 0 ? (
                <Txt
                  style={{
                    fontSize: cellule * 0.78,
                    lineHeight: cellule,
                    color: piece > 0 ? BLANC : NOIR,
                    textShadowColor: piece > 0 ? '#00000099' : '#FFFFFF44',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 2,
                  }}
                >
                  {GLYPHES[Math.abs(piece)]}
                </Txt>
              ) : null}

              {cible ? (
                <View
                  style={{
                    position: 'absolute',
                    width: piece === 0 ? cellule * 0.28 : cellule * 0.92,
                    height: piece === 0 ? cellule * 0.28 : cellule * 0.92,
                    borderRadius: cellule,
                    backgroundColor: piece === 0 ? `${ACCENT}CC` : 'transparent',
                    borderWidth: piece === 0 ? 0 : 3,
                    borderColor: '#E0525FCC',
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center', maxWidth: cellule * 8 }}>
        {journal.slice(-8).map((note, k) => (
          <Txt key={`${k}-${note}`} variant="caption" tone={k === journal.slice(-8).length - 1 ? 'accent' : 'faint'}>
            {note}
          </Txt>
        ))}
      </Row>

      <Txt variant="caption" tone="faint" center>
        {fini
          ? 'Partie terminée'
          : !aMoi
            ? 'L’ordinateur réfléchit…'
            : choisie === null
              ? 'Choisis une pièce'
              : 'Touche une case marquée'}
      </Txt>

      <Sheet visible={promotion !== null} onClose={() => setPromotion(null)} title="Promotion du pion">
        <Row gap={space.md} style={{ justifyContent: 'center', paddingVertical: space.md }}>
          {PROMOTIONS.map(({ valeur, nom }) => (
            <Pressable
              key={valeur}
              accessibilityRole="button"
              accessibilityLabel={`Promouvoir en ${nom}`}
              onPress={() => promouvoir(valeur)}
              style={{
                width: 64,
                height: 78,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                backgroundColor: c.surfaceAlt,
                borderWidth: 1.5,
                borderColor: c.border,
              }}
            >
              <Txt style={{ fontSize: 34, color: position.trait === 1 ? BLANC : NOIR }}>
                {GLYPHES[valeur]}
              </Txt>
              <Txt variant="caption" tone="faint">
                {nom}
              </Txt>
            </Pressable>
          ))}
        </Row>
      </Sheet>

      <GameOver
        visible={fini}
        outcome={
          vainqueur === null ? 'draw' : monCamp === null || vainqueur === monCamp ? 'win' : 'loss'
        }
        title={
          fin === 'mat'
            ? monCamp === null
              ? `Mat — victoire des ${nomCamp(vainqueur as Couleur)}`
              : vainqueur === monCamp
                ? 'Échec et mat !'
                : 'Tu es mat'
            : fin === 'pat'
              ? 'Pat'
              : fin === 'materiel'
                ? 'Matériel insuffisant'
                : 'Cinquante coups sans prise'
        }
        detail={
          fin === 'pat'
            ? 'Plus aucun coup légal, mais le roi n’est pas en échec : la partie est nulle.'
            : `${journal.length} demi-coups joués`
        }
        accent={ACCENT}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
