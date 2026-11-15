import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'serpents-echelles',
  name: 'Serpents et échelles',
  tagline: 'Cent cases, quelques raccourcis et beaucoup de dégringolades.',
  category: 'plateau',
  emoji: '🪜',
  difficulty: 1,
  players: '2-4',
  minutes: 8,
  score: 'none',
  tags: ['dés', 'famille', 'parcours'],
  rules: [
    'Chacun son tour, lance le dé et avance ton pion d’autant de cases.',
    'Le pied d’une échelle te fait monter d’un coup ; la tête d’un serpent te fait redescendre.',
    'Il faut le compte exact pour arriver sur la case 100 : au-delà, le pion rebondit en arrière.',
    'Le premier arrivé sur la case 100 gagne la partie.',
  ],
};

const ARRIVEE = 100;
const ACCENT = '#5B8DEF';
const COULEURS = ['#5B8DEF', '#E0525F', '#34B37E', '#F0A030'];
const NOMS = ['Bleu', 'Rouge', 'Vert', 'Orange'];

/** Départ → arrivée. Les montées sont des échelles, les descentes des serpents. */
const RACCOURCIS: Record<number, number> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

type Nombre = 2 | 3 | 4;
type Adversaires = 'ordinateur' | 'humains';

/** Ligne et colonne d'une case, le plateau serpentant de bas en haut. */
function coordonnees(numero: number): { ligne: number; colonne: number } {
  const index = numero - 1;
  const rangee = Math.floor(index / 10);
  const dans = index % 10;
  return { ligne: 9 - rangee, colonne: rangee % 2 === 0 ? dans : 9 - dans };
}

function avancer(depart: number, des: number): number {
  let cible = depart + des;
  // Le compte doit être exact : le trop-plein fait reculer.
  if (cible > ARRIVEE) cible = ARRIVEE - (cible - ARRIVEE);
  return RACCOURCIS[cible] ?? cible;
}

export default function SerpentsEchelles({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(24, 0.5);
  const cellule = Math.floor(largeur / 10);

  const [nombre, setNombre] = useState<Nombre>(2);
  const [adversaires, setAdversaires] = useState<Adversaires>('ordinateur');
  const [positions, setPositions] = useState<number[]>(() => [0, 0]);
  const [tour, setTour] = useState(0);
  const [de, setDe] = useState(1);
  const [message, setMessage] = useState('Lance le dé pour commencer');
  const [gagnant, setGagnant] = useState<number | null>(null);
  const [lance, setLance] = useState(false);
  const comptee = useRef(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  const solo = adversaires === 'ordinateur';
  const fini = gagnant !== null;

  const reset = useCallback(() => {
    setPositions(Array(nombre).fill(0));
    setTour(0);
    setDe(1);
    setMessage('Lance le dé pour commencer');
    setGagnant(null);
    setLance(false);
    comptee.current = false;
  }, [nombre]);

  useFrameRestart(reset);
  useEffect(() => {
    reset();
  }, [nombre, adversaires, reset]);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    const humainGagne = !solo || gagnant === 0;
    haptic(humainGagne ? 'success' : 'error');
    if (solo) submitResult(gagnant === 0 ? 'win' : 'loss');
  }, [fini, gagnant, solo, haptic, submitResult]);

  const jouer = useCallback(() => {
    if (fini || lance) return;
    setLance(true);
    const valeur = randBetween(1, 6);
    setDe(valeur);
    haptic('medium');

    const depart = positions[tour];
    const arrivee = avancer(depart, valeur);
    // Case atteinte avant l'éventuel serpent ou échelle, rebond compris.
    const intermediaire = depart + valeur > ARRIVEE ? ARRIVEE - (depart + valeur - ARRIVEE) : depart + valeur;

    const suivant = positions.slice();
    suivant[tour] = arrivee;

    let texte = `${NOMS[tour]} avance de ${valeur}`;
    if (depart + valeur > ARRIVEE) texte += ' et rebondit';
    if (arrivee > intermediaire) texte += ` — échelle jusqu’à ${arrivee} !`;
    else if (arrivee < intermediaire) texte += ` — serpent jusqu’à ${arrivee}…`;

    // Court délai pour laisser voir le dé avant le déplacement.
    minuterie.current = setTimeout(() => {
      setPositions(suivant);
      setMessage(texte);
      if (arrivee === ARRIVEE) {
        setGagnant(tour);
      } else {
        setTour((t) => (t + 1) % nombre);
      }
      setLance(false);
    }, 380);
  }, [fini, lance, positions, tour, nombre, haptic]);

  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    [],
  );

  // Les joueurs pilotés par l'ordinateur lancent tout seuls.
  useEffect(() => {
    if (!solo || fini || tour === 0 || lance) return;
    const id = setTimeout(jouer, 600);
    return () => clearTimeout(id);
  }, [solo, fini, tour, lance, jouer]);

  const monTour = !solo || tour === 0;

  const pionsPar = useMemo(() => {
    const carte = new Map<number, number[]>();
    positions.forEach((p, joueur) => {
      if (p === 0) return;
      const liste = carte.get(p) ?? [];
      liste.push(joueur);
      carte.set(p, liste);
    });
    return carte;
  }, [positions]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {fini ? `${NOMS[gagnant as number]} gagne` : `Au tour de ${NOMS[tour]}`}
      </Txt>
      <Txt variant="label" tone="faint">
        {positions.map((p) => p).join(' · ')}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: space.sm, paddingTop: space.sm }}>
      <View style={{ width: Math.max(cellule * 10, 270), gap: space.sm }}>
        <Segmented<Nombre>
          value={nombre}
          onChange={setNombre}
          options={[
            { value: 2, label: '2 pions' },
            { value: 3, label: '3 pions' },
            { value: 4, label: '4 pions' },
          ]}
          accent={ACCENT}
        />
        <Segmented<Adversaires>
          value={adversaires}
          onChange={setAdversaires}
          options={[
            { value: 'ordinateur', label: 'Contre l’ordinateur' },
            { value: 'humains', label: 'Entre nous' },
          ]}
          accent={ACCENT}
        />
      </View>

      <View
        style={{
          width: cellule * 10,
          height: cellule * 10,
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: c.borderStrong,
        }}
      >
        {Array.from({ length: ARRIVEE }, (_, k) => {
          const numero = k + 1;
          const { ligne, colonne } = coordonnees(numero);
          const cible = RACCOURCIS[numero];
          const echelle = cible !== undefined && cible > numero;
          const serpent = cible !== undefined && cible < numero;
          const occupants = pionsPar.get(numero) ?? [];

          return (
            <View
              key={numero}
              style={{
                position: 'absolute',
                left: colonne * cellule,
                top: ligne * cellule,
                width: cellule,
                height: cellule,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: echelle
                  ? '#34B37E22'
                  : serpent
                    ? '#E0525F22'
                    : (ligne + colonne) % 2 === 0
                      ? c.surface
                      : c.surfaceAlt,
                borderWidth: 0.5,
                borderColor: c.border,
              }}
            >
              <Txt style={{ fontSize: cellule * 0.26, color: c.textFaint }}>{numero}</Txt>
              {cible !== undefined ? (
                <Txt
                  style={{
                    fontSize: cellule * 0.24,
                    color: echelle ? '#34B37E' : '#E0525F',
                    fontWeight: '800',
                  }}
                >
                  {echelle ? `↑${cible}` : `↓${cible}`}
                </Txt>
              ) : null}
              {occupants.length > 0 ? (
                <Row gap={1} style={{ position: 'absolute', bottom: 1 }}>
                  {occupants.map((joueur) => (
                    <View
                      key={joueur}
                      style={{
                        width: cellule * 0.24,
                        height: cellule * 0.24,
                        borderRadius: cellule,
                        backgroundColor: COULEURS[joueur],
                        borderWidth: 1,
                        borderColor: '#FFFFFFAA',
                      }}
                    />
                  ))}
                </Row>
              ) : null}
            </View>
          );
        })}
      </View>

      <Row gap={space.md} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {positions.map((p, joueur) => (
          <Row key={joueur} gap={5}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: COULEURS[joueur],
                opacity: tour === joueur && !fini ? 1 : 0.45,
              }}
            />
            <Txt variant="caption" tone={tour === joueur && !fini ? 'normal' : 'faint'}>
              {NOMS[joueur]} {p}
            </Txt>
          </Row>
        ))}
      </Row>

      <Row gap={space.lg}>
        <De valeur={de} taille={52} tint={COULEURS[tour]} />
        <Button
          label={monTour ? 'Lancer le dé' : 'Au tour de l’ordinateur'}
          disabled={fini || lance || !monTour}
          accent={COULEURS[tour]}
          onPress={jouer}
        />
      </Row>

      <Txt variant="caption" tone="faint" center>
        {message}
      </Txt>

      <GameOver
        visible={fini}
        outcome={!solo || gagnant === 0 ? 'win' : 'loss'}
        title={`${NOMS[gagnant ?? 0]} atteint la case 100`}
        detail={solo ? (gagnant === 0 ? 'Bien joué.' : 'Le dé ne t’a pas souri.') : undefined}
        accent={COULEURS[gagnant ?? 0]}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
