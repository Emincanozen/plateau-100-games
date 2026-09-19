import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Segmented, Txt, GameOver } from '@/ui';
import { useBoardSize } from '../lib/hooks';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'jeu-oie',
  name: 'Jeu de l’oie',
  tagline: 'Soixante-trois cases, des oies qui relancent et un puits qui retient.',
  category: 'plateau',
  emoji: '🪿',
  difficulty: 1,
  players: '2-4',
  minutes: 10,
  score: 'none',
  tags: ['dés', 'famille', 'parcours', 'classique'],
  rules: [
    'Lance le dé et avance. Tomber sur une oie fait rejouer aussitôt la même distance.',
    'Le pont mène à la 12, le labyrinthe renvoie à la 30, la mort ramène au départ.',
    'L’auberge, le puits et la prison coûtent des tours de pause.',
    'Il faut le compte exact pour la case 63 : au-delà, le pion rebondit en arrière.',
  ],
};

const ARRIVEE = 63;
const COLONNES = 9;
const ACCENT = '#5B8DEF';
const COULEURS = ['#5B8DEF', '#E0525F', '#34B37E', '#F0A030'];
const NOMS = ['Bleu', 'Rouge', 'Vert', 'Orange'];

const OIES = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59];

interface Speciale {
  emoji: string;
  nom: string;
}

const SPECIALES: Record<number, Speciale> = {
  6: { emoji: '🌉', nom: 'Le pont' },
  19: { emoji: '🍺', nom: 'L’auberge' },
  31: { emoji: '🕳️', nom: 'Le puits' },
  42: { emoji: '🌀', nom: 'Le labyrinthe' },
  52: { emoji: '⛓️', nom: 'La prison' },
  58: { emoji: '💀', nom: 'La mort' },
  63: { emoji: '🏁', nom: 'L’arrivée' },
};

type Nombre = 2 | 3 | 4;
type Adversaires = 'ordinateur' | 'humains';

/** Le parcours serpente : une rangée vers la droite, la suivante vers la gauche. */
function coordonnees(numero: number): { ligne: number; colonne: number } {
  const index = numero - 1;
  const ligne = Math.floor(index / COLONNES);
  const dans = index % COLONNES;
  return { ligne, colonne: ligne % 2 === 0 ? dans : COLONNES - 1 - dans };
}

function rebond(cible: number): number {
  return cible > ARRIVEE ? ARRIVEE - (cible - ARRIVEE) : cible;
}

interface Resultat {
  position: number;
  attente: number;
  texte: string;
}

function resoudre(arrivee: number, valeur: number): Resultat {
  let position = arrivee;
  let texte = '';

  // Les oies relancent d'autant, en chaîne si besoin.
  let securite = 0;
  while (OIES.includes(position) && securite < 12) {
    position = rebond(position + valeur);
    texte = 'une oie fait rejouer';
    securite += 1;
  }

  if (position === 6) return { position: 12, attente: 0, texte: 'le pont mène à la 12' };
  if (position === 19) return { position: 19, attente: 2, texte: 'l’auberge : deux tours de pause' };
  if (position === 31) return { position: 31, attente: 3, texte: 'le puits : trois tours de pause' };
  if (position === 42) return { position: 30, attente: 0, texte: 'le labyrinthe renvoie à la 30' };
  if (position === 52) return { position: 52, attente: 3, texte: 'la prison : trois tours de pause' };
  if (position === 58) return { position: 1, attente: 0, texte: 'la mort ramène au départ' };

  return { position, attente: 0, texte };
}

export default function JeuOie({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const largeur = useBoardSize(24, 0.4);
  const cellule = Math.floor(largeur / COLONNES);

  const [nombre, setNombre] = useState<Nombre>(2);
  const [adversaires, setAdversaires] = useState<Adversaires>('ordinateur');
  const [positions, setPositions] = useState<number[]>(() => [0, 0]);
  const [attentes, setAttentes] = useState<number[]>(() => [0, 0]);
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
    setAttentes(Array(nombre).fill(0));
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

  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    [],
  );

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

    // Un joueur en pause passe son tour sans lancer.
    if (attentes[tour] > 0) {
      const restant = attentes[tour] - 1;
      setAttentes((liste) => liste.map((v, i) => (i === tour ? restant : v)));
      setMessage(`${NOMS[tour]} passe son tour (${restant} restant${restant > 1 ? 's' : ''})`);
      haptic('warning');
      minuterie.current = setTimeout(() => {
        setTour((t) => (t + 1) % nombre);
        setLance(false);
      }, 500);
      return;
    }

    const valeur = randBetween(1, 6);
    setDe(valeur);
    haptic('medium');

    const brut = rebond(positions[tour] + valeur);
    const resultat = resoudre(brut, valeur);

    minuterie.current = setTimeout(() => {
      setPositions((liste) => liste.map((v, i) => (i === tour ? resultat.position : v)));
      if (resultat.attente > 0) {
        setAttentes((liste) => liste.map((v, i) => (i === tour ? resultat.attente : v)));
      }
      const suffixe = resultat.texte ? ` — ${resultat.texte}` : '';
      setMessage(`${NOMS[tour]} fait ${valeur} et va case ${resultat.position}${suffixe}`);

      if (resultat.position === ARRIVEE) setGagnant(tour);
      else setTour((t) => (t + 1) % nombre);
      setLance(false);
    }, 420);
  }, [fini, lance, attentes, positions, tour, nombre, haptic]);

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
        {positions.join(' · ')}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: space.sm, paddingTop: space.sm }}>
      <View style={{ width: Math.max(cellule * COLONNES, 270), gap: space.sm }}>
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
          width: cellule * COLONNES,
          height: cellule * 7,
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: c.borderStrong,
        }}
      >
        {Array.from({ length: ARRIVEE }, (_, k) => {
          const numero = k + 1;
          const { ligne, colonne } = coordonnees(numero);
          const oie = OIES.includes(numero);
          const speciale = SPECIALES[numero];
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
                backgroundColor: oie
                  ? '#34B37E22'
                  : speciale
                    ? '#E0525F18'
                    : (ligne + colonne) % 2 === 0
                      ? c.surface
                      : c.surfaceAlt,
                borderWidth: 0.5,
                borderColor: c.border,
              }}
            >
              <Txt style={{ fontSize: cellule * 0.24, color: c.textFaint }}>{numero}</Txt>
              {oie || speciale ? (
                <Txt style={{ fontSize: cellule * 0.34 }}>{oie ? '🪿' : speciale.emoji}</Txt>
              ) : null}
              {occupants.length > 0 ? (
                <Row gap={1} style={{ position: 'absolute', bottom: 2 }}>
                  {occupants.map((joueur) => (
                    <View
                      key={joueur}
                      style={{
                        width: cellule * 0.22,
                        height: cellule * 0.22,
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
              {attentes[joueur] > 0 ? ` ⏸${attentes[joueur]}` : ''}
            </Txt>
          </Row>
        ))}
      </Row>

      <Row gap={space.lg}>
        <De valeur={de} taille={52} tint={COULEURS[tour]} />
        <Button
          label={
            monTour ? (attentes[tour] > 0 ? 'Passer le tour' : 'Lancer le dé') : 'Au tour de l’ordinateur'
          }
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
        title={`${NOMS[gagnant ?? 0]} atteint la case 63`}
        detail="Le compte exact, ni plus ni moins."
        accent={COULEURS[gagnant ?? 0]}
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
