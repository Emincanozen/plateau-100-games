import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, Row, Txt, GameOver } from '@/ui';
import { jeu52, melanger, type Carte } from '../lib/cartes';
import { randInt } from '../lib/rng';

export const meta: GameMeta = {
  id: 'pouilleux',
  name: 'Le pouilleux',
  tagline: 'Forme toutes tes paires. Celui qui garde le valet noir a perdu.',
  category: 'cartes',
  emoji: '🃏',
  difficulty: 1,
  players: '1',
  minutes: 6,
  score: 'none',
  tags: ['famille', 'classique', 'bluff'],
  rules: [
    'Un seul valet noir reste dans le paquet : c’est le pouilleux, il n’a pas de paire.',
    'Toutes les paires de même valeur sont défaussées automatiquement.',
    'À ton tour, pioche une carte au hasard dans la main de l’adversaire, face cachée.',
    'Le premier débarrassé de toutes ses cartes gagne. Celui qui garde le pouilleux perd.',
  ],
};

/** Le pouilleux : on retire un valet noir pour qu'il reste sans paire. */
function paquetPouilleux(): Carte[] {
  // On enlève le valet de trèfle : le valet de pique devient le pouilleux.
  return jeu52().filter((carte) => !(carte.rang === 11 && carte.couleur === 'T'));
}

const estPouilleux = (carte: Carte) => carte.rang === 11 && carte.couleur === 'P';

/** Retire toutes les paires d'une main et renvoie la main nettoyée. */
function retirerPaires(main: Carte[]): { main: Carte[]; retirees: number } {
  const restantes: Carte[] = [];
  const parRang = new Map<number, Carte[]>();

  for (const carte of main) {
    const groupe = parRang.get(carte.rang) ?? [];
    groupe.push(carte);
    parRang.set(carte.rang, groupe);
  }

  let retirees = 0;
  for (const groupe of parRang.values()) {
    // On défausse deux par deux ; l'impair reste en main.
    const paires = Math.floor(groupe.length / 2);
    retirees += paires * 2;
    restantes.push(...groupe.slice(paires * 2));
  }
  return { main: restantes, retirees };
}

export default function Pouilleux({ submitResult, haptic }: GameScreenProps) {
  const { c, space } = useTheme();

  const [maMain, setMaMain] = useState<Carte[]>([]);
  const [saMain, setSaMain] = useState<Carte[]>([]);
  const [defaussees, setDefaussees] = useState(0);
  const [aMoi, setAMoi] = useState(true);
  const [message, setMessage] = useState('Pioche une carte chez l’adversaire');
  const comptee = useRef(false);

  const distribuer = useCallback(() => {
    const paquet = melanger(paquetPouilleux());
    const mienne = retirerPaires(paquet.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, visible: true })));
    const sienne = retirerPaires(paquet.filter((_, i) => i % 2 === 1).map((c) => ({ ...c, visible: false })));
    setMaMain(mienne.main);
    setSaMain(sienne.main);
    setDefaussees(mienne.retirees + sienne.retirees);
    setAMoi(true);
    setMessage('Pioche une carte chez l’adversaire');
    comptee.current = false;
  }, []);

  useEffect(() => {
    distribuer();
  }, [distribuer]);

  useFrameRestart(distribuer);

  const fini = useMemo(
    () => (maMain.length === 0 || saMain.length === 0) && defaussees > 0,
    [maMain.length, saMain.length, defaussees],
  );
  const gagne = fini && maMain.length === 0;

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    submitResult(gagne ? 'win' : 'loss');
  }, [fini, gagne, haptic, submitResult]);

  /** Transfère une carte d'une main à l'autre, puis nettoie les paires. */
  const piocher = (index: number) => {
    if (fini || !aMoi) return;
    const carte = saMain[index];
    if (!carte) return;

    haptic('light');
    const restante = saMain.filter((_, i) => i !== index);
    const nettoyee = retirerPaires([...maMain, { ...carte, visible: true }]);

    setSaMain(restante);
    setMaMain(nettoyee.main);
    setDefaussees((n) => n + nettoyee.retirees);
    setMessage(
      nettoyee.retirees > 0
        ? `Tu pioches un ${carte.rang === 11 ? 'valet' : carte.rang} et fais une paire`
        : estPouilleux(carte)
          ? 'Tu viens de piocher le pouilleux…'
          : 'Rien à apparier cette fois',
    );
    setAMoi(false);
  };

  // Tour de l'ordinateur : il pioche au hasard, il ne voit pas tes cartes.
  useEffect(() => {
    if (aMoi || fini) return;
    if (maMain.length === 0) return;

    const id = setTimeout(() => {
      const index = randInt(maMain.length);
      const carte = maMain[index];
      const restante = maMain.filter((_, i) => i !== index);
      const nettoyee = retirerPaires([...saMain, { ...carte, visible: false }]);

      setMaMain(restante);
      setSaMain(nettoyee.main);
      setDefaussees((n) => n + nettoyee.retirees);
      setMessage(
        nettoyee.retirees > 0
          ? 'L’ordinateur pioche et fait une paire'
          : 'L’ordinateur pioche sans rien apparier',
      );
      setAMoi(true);
    }, 800);

    return () => clearTimeout(id);
  }, [aMoi, fini, maMain, saMain]);

  const jaiLePouilleux = maMain.some(estPouilleux);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {maMain.length}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {saMain.length}
      </Txt>
      <Txt variant="label" tone="faint">
        {defaussees} défaussées
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          MAIN DE L’ORDINATEUR — touche une carte pour la piocher
        </Txt>
        <Row gap={3} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {saMain.map((carte, i) => (
            <CarteVue
              key={`${carte.id}-${i}`}
              carte={{ ...carte, visible: false }}
              largeur={40}
              onPress={aMoi && !fini ? () => piocher(i) : undefined}
            />
          ))}
        </Row>
      </View>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="label" tone={jaiLePouilleux ? 'danger' : 'dim'} center>
          {message}
        </Txt>
        {jaiLePouilleux ? (
          <Txt variant="caption" tone="danger">
            ⚠ Tu as le pouilleux en main — fais-le piocher
          </Txt>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          TA MAIN
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={3} style={{ paddingVertical: 4 }}>
            {maMain.map((carte, i) => (
              <CarteVue
                key={`${carte.id}-${i}`}
                carte={carte}
                largeur={48}
                style={estPouilleux(carte) ? { borderColor: '#E0525F', borderWidth: 2.5 } : undefined}
              />
            ))}
          </Row>
        </ScrollView>
      </View>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Main vidée !' : 'Tu gardes le pouilleux'}
        detail={gagne ? 'L’ordinateur reste avec le valet noir.' : undefined}
        accent="#E0525F"
        onReplay={distribuer}
        onQuit={distribuer}
      />
    </View>
  );
}
