import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Row, Txt, GameOver } from '@/ui';
import { formatClock, useTimer } from '../lib/hooks';
import { shuffle } from '../lib/rng';

export const meta: GameMeta = {
  id: 'mahjong',
  name: 'Mahjong solitaire',
  tagline: 'Associe les tuiles libres deux à deux jusqu’à vider le tas.',
  category: 'logique',
  emoji: '🀄',
  difficulty: 2,
  players: '1',
  minutes: 12,
  score: 'time',
  scoreUnit: 's',
  tags: ['tuiles', 'solo', 'observation'],
  rules: [
    'Une tuile est libre si rien ne la recouvre et si son côté gauche ou droit est dégagé.',
    'Touche deux tuiles libres identiques pour les retirer.',
    'Les tuiles empilées se libèrent au fur et à mesure : pense à dégager les étages.',
    'Le bouton « indice » signale une paire jouable. Vide la table pour gagner.',
  ],
};

/**
 * Disposition en trois étages. Chaque tuile occupe deux demi-cases en largeur,
 * ce qui permet les décalages classiques du mahjong.
 */
interface Emplacement {
  etage: number;
  /** Colonne en demi-cases. */
  x: number;
  y: number;
}

function construireDisposition(): Emplacement[] {
  const out: Emplacement[] = [];

  // Étage 0 : un large rectangle de 8 colonnes sur 5 rangées.
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 8; x++) {
      out.push({ etage: 0, x: x * 2, y });
    }
  }
  // Étage 1 : un bloc central de 6 sur 3, décalé d'une demi-case.
  for (let y = 1; y < 4; y++) {
    for (let x = 1; x < 7; x++) {
      out.push({ etage: 1, x: x * 2, y });
    }
  }
  // Étage 2 : une couronne de 4 sur 1, au sommet.
  for (let x = 2; x < 6; x++) {
    out.push({ etage: 2, x: x * 2, y: 2 });
  }

  return out;
}

const SYMBOLES = [
  '🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏',
  '🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗',
  '🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🀟',
  '🀀', '🀁', '🀂', '🀃', '🀄', '🀅', '🀆',
];

interface Tuile {
  id: number;
  symbole: string;
  place: Emplacement;
  retiree: boolean;
}

/** Une place est libre si rien ne la couvre et si un côté est dégagé. */
function placeLibre(place: Emplacement, restantes: Emplacement[]): boolean {
  const { etage, x, y } = place;

  const couverte = restantes.some(
    (autre) => autre.etage === etage + 1 && Math.abs(autre.x - x) < 2 && autre.y === y,
  );
  if (couverte) return false;

  const bloqueeGauche = restantes.some(
    (autre) => autre.etage === etage && autre.y === y && autre.x === x - 2,
  );
  const bloqueeDroite = restantes.some(
    (autre) => autre.etage === etage && autre.y === y && autre.x === x + 2,
  );

  return !bloqueeGauche || !bloqueeDroite;
}

/**
 * Distribution garantie soluble : au lieu de semer les symboles au hasard —
 * ce qui donne très souvent une table bloquée — on simule une résolution.
 * On retire deux places actuellement libres, on leur attribue la même tuile,
 * et on recommence. Le chemin de résolution existe donc par construction.
 */
function distribuer(): Tuile[] {
  const places = construireDisposition();
  const utilisables = places.length % 2 === 0 ? places : places.slice(0, -1);

  for (let essai = 0; essai < 30; essai++) {
    const restantes = utilisables.slice();
    const tuiles: Tuile[] = [];
    let symbole = 0;
    let echec = false;

    while (restantes.length > 0) {
      const libres = shuffle(restantes.filter((place) => placeLibre(place, restantes)));
      if (libres.length < 2) {
        echec = true;
        break;
      }
      const [a, b] = libres;
      const motif = SYMBOLES[symbole % SYMBOLES.length];
      symbole += 1;

      for (const place of [a, b]) {
        tuiles.push({ id: tuiles.length, symbole: motif, place, retiree: false });
        restantes.splice(restantes.indexOf(place), 1);
      }
    }

    if (!echec) return tuiles;
  }

  // Repli : distribution simple, au cas très improbable où la simulation échoue.
  return utilisables.map((place, i) => ({
    id: i,
    symbole: SYMBOLES[Math.floor(i / 2) % SYMBOLES.length],
    place,
    retiree: false,
  }));
}

const estLibre = (tuile: Tuile, tuiles: Tuile[]): boolean =>
  !tuile.retiree &&
  placeLibre(
    tuile.place,
    tuiles.filter((t) => !t.retiree).map((t) => t.place),
  );

export default function Mahjong({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();
  const { width } = useWindowDimensions();

  const [tuiles, setTuiles] = useState<Tuile[]>(distribuer);
  const [selection, setSelection] = useState<number | null>(null);
  const [indice, setIndice] = useState<number[]>([]);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  // La disposition fait 16 demi-cases de large, plus le décalage des étages.
  const demiCase = Math.floor(Math.min((width - 32) / 17, 26));
  const largeurTuile = demiCase * 2;
  const hauteurTuile = largeurTuile * 1.3;
  const decalageEtage = 4;

  const restantes = useMemo(() => tuiles.filter((t) => !t.retiree), [tuiles]);
  const libres = useMemo(
    () => restantes.filter((t) => estLibre(t, tuiles)),
    [restantes, tuiles],
  );

  /** Paires jouables parmi les tuiles libres. */
  const pairesPossibles = useMemo(() => {
    const paires: [number, number][] = [];
    for (let i = 0; i < libres.length; i++) {
      for (let j = i + 1; j < libres.length; j++) {
        if (libres[i].symbole === libres[j].symbole) paires.push([libres[i].id, libres[j].id]);
      }
    }
    return paires;
  }, [libres]);

  const gagne = restantes.length === 0;
  const bloque = !gagne && pairesPossibles.length === 0;
  const fini = gagne || bloque;
  const secondes = useTimer(!fini, tuiles.length);

  const reset = useCallback(() => {
    setTuiles(distribuer());
    setSelection(null);
    setIndice([]);
    setRecord(false);
    setComptee(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : 'error');
    if (gagne) setRecord(submitScore(secondes));
  }, [fini, comptee, gagne, secondes, haptic, submitScore]);

  const toucher = (id: number) => {
    if (fini) return;
    const tuile = tuiles.find((t) => t.id === id);
    if (!tuile || tuile.retiree || !estLibre(tuile, tuiles)) {
      haptic('warning');
      return;
    }

    if (selection === null) {
      haptic('light');
      setSelection(id);
      setIndice([]);
      return;
    }
    if (selection === id) {
      setSelection(null);
      return;
    }

    const autre = tuiles.find((t) => t.id === selection)!;
    if (autre.symbole !== tuile.symbole) {
      haptic('warning');
      setSelection(id);
      return;
    }

    haptic('success');
    setTuiles((liste) =>
      liste.map((t) => (t.id === id || t.id === selection ? { ...t, retiree: true } : t)),
    );
    setSelection(null);
    setIndice([]);
  };

  const demanderIndice = () => {
    if (pairesPossibles.length === 0) return;
    haptic('medium');
    setIndice(pairesPossibles[0]);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {restantes.length} tuiles
      </Txt>
      <Txt variant="label" tone="faint">
        {formatClock(secondes)}
      </Txt>
      <Txt variant="label" tone={pairesPossibles.length === 0 ? 'danger' : 'faint'}>
        {pairesPossibles.length} paires
      </Txt>
    </Row>,
  );

  // On dessine étage par étage pour que les tuiles du dessus recouvrent.
  const ordonnees = [...tuiles].sort((a, b) => a.place.etage - b.place.etage || a.place.y - b.place.y);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <View
        style={{
          width: demiCase * 17,
          height: hauteurTuile * 5 + 30,
          backgroundColor: c.felt + '22',
          borderRadius: radius.md,
        }}
      >
        {ordonnees.map((tuile) => {
          if (tuile.retiree) return null;
          const choisie = selection === tuile.id;
          const suggeree = indice.includes(tuile.id);
          const libre = estLibre(tuile, tuiles);
          return (
            <Pressable
              key={tuile.id}
              accessibilityRole="button"
              accessibilityLabel={`Tuile ${tuile.symbole}${libre ? ', libre' : ', bloquée'}`}
              onPress={() => toucher(tuile.id)}
              style={{
                position: 'absolute',
                left: tuile.place.x * demiCase * 0.5 + tuile.place.etage * decalageEtage,
                top: tuile.place.y * hauteurTuile * 0.82 - tuile.place.etage * decalageEtage,
                width: largeurTuile,
                height: hauteurTuile,
                borderRadius: 5,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: choisie ? '#34B37E' : suggeree ? '#EFB93B' : '#F4EFE2',
                borderWidth: 1.5,
                borderColor: libre ? '#8A7A5E' : '#00000055',
                opacity: libre ? 1 : 0.62,
                zIndex: tuile.place.etage * 10 + tuile.place.y,
              }}
            >
              <Txt style={{ fontSize: largeurTuile * 0.62, color: '#1A1A24' }}>{tuile.symbole}</Txt>
            </Pressable>
          );
        })}
      </View>

      <Row gap={space.md}>
        <Button
          label="Indice"
          kind="secondary"
          size="sm"
          disabled={pairesPossibles.length === 0 || fini}
          onPress={demanderIndice}
        />
        <Button label="Nouvelle table" kind="ghost" size="sm" onPress={reset} />
      </Row>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'over'}
        title={gagne ? 'Table vidée !' : 'Plus aucune paire jouable'}
        score={gagne ? formatClock(secondes) : `${restantes.length}`}
        scoreLabel={gagne ? 'Temps' : 'Tuiles restantes'}
        best={best !== undefined ? formatClock(best) : undefined}
        isRecord={record}
        accent="#34B37E"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
