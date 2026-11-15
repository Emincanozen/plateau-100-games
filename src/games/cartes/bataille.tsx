import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Carte as CarteVue, EmplacementVide, Row, Txt, GameOver } from '@/ui';
import { jeu52, melanger, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'bataille',
  name: 'Bataille',
  tagline: 'La plus forte carte ramasse. Et à égalité, c’est la bataille.',
  category: 'cartes',
  emoji: '⚔️',
  difficulty: 1,
  players: '1',
  minutes: 8,
  score: 'none',
  tags: ['classique', 'famille', 'hasard'],
  rules: [
    'Le paquet est partagé en deux. À chaque tour, chacun retourne sa carte du dessus.',
    'La plus forte remporte les deux cartes, qui passent sous le paquet du gagnant.',
    'L’as est la carte la plus forte, le deux la plus faible.',
    'À égalité c’est la bataille : on pose une carte face cachée, puis on rejoue pour tout rafler.',
  ],
};

/** L'as bat le roi : on le remonte au-dessus de 13. */
const force = (carte: Carte): number => (carte.rang === 1 ? 14 : carte.rang);

interface Etat {
  joueur: Carte[];
  ordinateur: Carte[];
  /** Cartes posées au centre, en attente d'être ramassées. */
  tapis: Carte[];
  carteJoueur: Carte | null;
  carteOrdinateur: Carte | null;
  message: string;
  bataille: boolean;
}

function distribuer(): Etat {
  const paquet = melanger(jeu52()).map((c) => ({ ...c, visible: true }));
  return {
    joueur: paquet.slice(0, 26),
    ordinateur: paquet.slice(26),
    tapis: [],
    carteJoueur: null,
    carteOrdinateur: null,
    message: 'Retourne ta première carte',
    bataille: false,
  };
}

export default function Bataille({ submitResult, haptic }: GameScreenProps) {
  const { c, space } = useTheme();

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [tours, setTours] = useState(0);
  const comptee = useRef(false);

  const fini = etat.joueur.length === 0 || etat.ordinateur.length === 0;
  const gagne = etat.ordinateur.length === 0;

  const reset = useCallback(() => {
    setEtat(distribuer());
    setTours(0);
    comptee.current = false;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    submitResult(gagne ? 'win' : 'loss');
  }, [fini, gagne, haptic, submitResult]);

  const jouer = () => {
    if (fini) return;
    haptic('medium');
    setTours((t) => t + 1);

    setEtat((prev) => {
      if (prev.joueur.length === 0 || prev.ordinateur.length === 0) return prev;

      const carteJoueur = prev.joueur[0];
      const carteOrdinateur = prev.ordinateur[0];
      let joueur = prev.joueur.slice(1);
      let ordinateur = prev.ordinateur.slice(1);
      const tapis = [...prev.tapis, carteJoueur, carteOrdinateur];

      const forceJoueur = force(carteJoueur);
      const forceOrdinateur = force(carteOrdinateur);

      if (forceJoueur === forceOrdinateur) {
        // Bataille : chacun mise une carte face cachée, si possible.
        const miseJoueur = joueur.slice(0, 1);
        const miseOrdinateur = ordinateur.slice(0, 1);
        joueur = joueur.slice(1);
        ordinateur = ordinateur.slice(1);
        return {
          joueur,
          ordinateur,
          tapis: [...tapis, ...miseJoueur, ...miseOrdinateur],
          carteJoueur,
          carteOrdinateur,
          message: 'Bataille ! Une carte cachée, puis on rejoue',
          bataille: true,
        };
      }

      const joueurGagne = forceJoueur > forceOrdinateur;
      // Le gagnant récupère le tapis, mélangé, sous son paquet.
      const butin = melanger(tapis);
      return {
        joueur: joueurGagne ? [...joueur, ...butin] : joueur,
        ordinateur: joueurGagne ? ordinateur : [...ordinateur, ...butin],
        tapis: [],
        carteJoueur,
        carteOrdinateur,
        message: joueurGagne
          ? `Tu ramasses ${butin.length} cartes`
          : `L’ordinateur ramasse ${butin.length} cartes`,
        bataille: false,
      };
    });
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {etat.joueur.length}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {etat.ordinateur.length}
      </Txt>
      <Txt variant="label" tone="faint">
        {tours} tours
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          ORDINATEUR · {etat.ordinateur.length} cartes
        </Txt>
        {etat.carteOrdinateur ? (
          <CarteVue carte={etat.carteOrdinateur} largeur={78} />
        ) : (
          <EmplacementVide largeur={78} />
        )}
      </View>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        {etat.tapis.length > 0 ? (
          <View
            style={{
              paddingHorizontal: space.md,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: c.surfaceAlt,
            }}
          >
            <Txt variant="caption" tone="warning">
              {etat.tapis.length} cartes en jeu
            </Txt>
          </View>
        ) : null}
        <Txt variant="h3" center tone={etat.bataille ? 'warning' : 'normal'}>
          {etat.message}
        </Txt>
      </View>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        {etat.carteJoueur ? (
          <CarteVue carte={etat.carteJoueur} largeur={78} />
        ) : (
          <EmplacementVide largeur={78} />
        )}
        <Txt variant="caption" tone="faint">
          TOI · {etat.joueur.length} cartes
        </Txt>
      </View>

      <Button
        label={etat.bataille ? 'Rejouer la bataille' : 'Retourner une carte'}
        full
        accent="#E0525F"
        disabled={fini}
        onPress={jouer}
      />

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Tu remportes tout le paquet !' : 'L’ordinateur rafle la mise'}
        detail={`Partie jouée en ${tours} tours`}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
