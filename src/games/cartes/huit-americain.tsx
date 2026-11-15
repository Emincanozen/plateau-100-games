import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Carte as CarteVue, EmplacementVide, Row, Sheet, Txt, GameOver } from '@/ui';
import { COULEURS, NOM_COULEUR, SYMBOLE, jeu52, melanger, type Carte, type Couleur } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'huit-americain',
  name: 'Huit américain',
  tagline: 'Débarrasse-toi de ta main en suivant la couleur ou la valeur.',
  category: 'cartes',
  emoji: '8️⃣',
  difficulty: 1,
  players: '1',
  minutes: 8,
  score: 'none',
  tags: ['classique', 'famille', 'plis'],
  rules: [
    'Pose une carte de la même couleur ou de la même valeur que celle du talon.',
    'Le 8 est un joker : il se pose toujours et te laisse choisir la couleur demandée.',
    'Si tu ne peux rien poser, pioche une carte — et rejoue si elle convient.',
    'Le premier qui n’a plus de cartes en main gagne la partie.',
  ],
};

interface Etat {
  main: Carte[];
  adversaire: Carte[];
  pioche: Carte[];
  talon: Carte[];
  /** Couleur imposée après un 8. */
  couleurDemandee: Couleur;
  tour: 'joueur' | 'ordinateur';
}

function distribuer(): Etat {
  const paquet = melanger(jeu52());
  // On évite de démarrer sur un 8, qui imposerait une couleur d'entrée.
  let depart = paquet.findIndex((c) => c.rang !== 8);
  if (depart < 0) depart = 0;
  const premiere = { ...paquet[depart], visible: true };
  const reste = paquet.filter((_, i) => i !== depart);

  return {
    main: reste.slice(0, 7).map((c) => ({ ...c, visible: true })),
    adversaire: reste.slice(7, 14).map((c) => ({ ...c, visible: false })),
    pioche: reste.slice(14),
    talon: [premiere],
    couleurDemandee: premiere.couleur,
    tour: 'joueur',
  };
}

const jouable = (carte: Carte, talon: Carte, couleur: Couleur): boolean =>
  carte.rang === 8 || carte.couleur === couleur || carte.rang === talon.rang;

export default function HuitAmericain({ submitResult, haptic }: GameScreenProps) {
  const { c, space } = useTheme();

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [choixCouleur, setChoixCouleur] = useState<Carte | null>(null);
  const [message, setMessage] = useState('À toi de jouer');
  const comptee = useRef(false);

  const talon = etat.talon[etat.talon.length - 1];
  const gagne = etat.main.length === 0;
  const perdu = etat.adversaire.length === 0;
  const fini = gagne || perdu;

  const reset = useCallback(() => {
    setEtat(distribuer());
    setChoixCouleur(null);
    setMessage('À toi de jouer');
    comptee.current = false;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    submitResult(gagne ? 'win' : 'loss');
  }, [fini, gagne, haptic, submitResult]);

  /** Pose une carte et passe la main. */
  const poser = useCallback(
    (carte: Carte, couleur: Couleur) => {
      setEtat((prev) => ({
        ...prev,
        main: prev.main.filter((m) => m.id !== carte.id),
        talon: [...prev.talon, carte],
        couleurDemandee: couleur,
        tour: 'ordinateur',
      }));
    },
    [],
  );

  const toucher = (carte: Carte) => {
    if (fini || etat.tour !== 'joueur') return;
    if (!jouable(carte, talon, etat.couleurDemandee)) {
      haptic('warning');
      setMessage('Cette carte ne suit ni la couleur ni la valeur');
      return;
    }
    haptic('light');
    if (carte.rang === 8) {
      setChoixCouleur(carte);
      return;
    }
    setMessage('');
    poser(carte, carte.couleur);
  };

  const piocher = () => {
    if (fini || etat.tour !== 'joueur') return;
    if (etat.pioche.length === 0) {
      setMessage('La pioche est vide : tu passes ton tour');
      setEtat((prev) => ({ ...prev, tour: 'ordinateur' }));
      return;
    }
    haptic('light');
    setEtat((prev) => {
      const tiree = { ...prev.pioche[prev.pioche.length - 1], visible: true };
      return { ...prev, pioche: prev.pioche.slice(0, -1), main: [...prev.main, tiree] };
    });
    setMessage('Tu pioches une carte');
  };

  // Tour de l'ordinateur.
  useEffect(() => {
    if (etat.tour !== 'ordinateur' || fini) return;

    // Le coup est calculé hors de l'updater : pas d'effet de bord dedans.
    const id = setTimeout(() => {
      const dessus = etat.talon[etat.talon.length - 1];
      const possibles = etat.adversaire.filter((carte) =>
        jouable(carte, dessus, etat.couleurDemandee),
      );

      if (possibles.length === 0) {
        if (etat.pioche.length === 0) {
          setMessage('L’ordinateur passe son tour');
          setEtat((prev) => ({ ...prev, tour: 'joueur' }));
          return;
        }
        setMessage('L’ordinateur pioche');
        setEtat((prev) => ({
          ...prev,
          pioche: prev.pioche.slice(0, -1),
          adversaire: [...prev.adversaire, prev.pioche[prev.pioche.length - 1]],
          tour: 'joueur',
        }));
        return;
      }

      // Il garde ses 8 pour la fin et, s'il en joue un, demande la couleur
      // dont il a le plus de cartes en main.
      const sansHuit = possibles.filter((carte) => carte.rang !== 8);
      const choisie = sansHuit.length > 0 ? sansHuit[0] : possibles[0];

      let couleur = choisie.couleur;
      if (choisie.rang === 8) {
        const comptes = COULEURS.map((coul) => ({
          coul,
          n: etat.adversaire.filter((carte) => carte.couleur === coul).length,
        }));
        comptes.sort((a, b) => b.n - a.n);
        couleur = comptes[0].coul;
      }

      setMessage(
        choisie.rang === 8
          ? `L’ordinateur joue un 8 et demande ${NOM_COULEUR[couleur]}`
          : 'À toi de jouer',
      );

      setEtat((prev) => ({
        ...prev,
        adversaire: prev.adversaire.filter((carte) => carte.id !== choisie.id),
        talon: [...prev.talon, { ...choisie, visible: true }],
        couleurDemandee: couleur,
        tour: 'joueur',
      }));
    }, 720);

    return () => clearTimeout(id);
  }, [etat, fini]);

  const coupsPossibles = useMemo(
    () => etat.main.filter((carte) => jouable(carte, talon, etat.couleurDemandee)).length,
    [etat.main, talon, etat.couleurDemandee],
  );

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {etat.main.length}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {etat.adversaire.length}
      </Txt>
      <Txt variant="label" style={{ color: talon.rouge ? '#E0525F' : c.textDim }}>
        {SYMBOLE[etat.couleurDemandee]}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          ORDINATEUR · {etat.adversaire.length} cartes
        </Txt>
        <Row gap={-22}>
          {etat.adversaire.slice(0, 9).map((carte, i) => (
            <CarteVue key={`${carte.id}-${i}`} carte={{ ...carte, visible: false }} largeur={40} />
          ))}
        </Row>
      </View>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <Row gap={space.xl} style={{ alignItems: 'center' }}>
          <Pressable onPress={piocher} accessibilityRole="button" accessibilityLabel="Piocher">
            {etat.pioche.length > 0 ? (
              <CarteVue carte={{ ...etat.pioche[0], visible: false }} largeur={62} />
            ) : (
              <EmplacementVide largeur={62} glyphe="∅" />
            )}
          </Pressable>
          <CarteVue carte={talon} largeur={72} />
        </Row>
        <Txt variant="label" tone="dim" center>
          {message}
        </Txt>
        {coupsPossibles === 0 && etat.tour === 'joueur' && !fini ? (
          <Button label="Piocher une carte" size="sm" accent="#E0525F" onPress={piocher} />
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          TA MAIN · {coupsPossibles} carte{coupsPossibles > 1 ? 's' : ''} jouable
          {coupsPossibles > 1 ? 's' : ''}
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={4} style={{ paddingVertical: 4 }}>
            {etat.main.map((carte) => (
              <CarteVue
                key={carte.id}
                carte={carte}
                largeur={54}
                selectionnee={jouable(carte, talon, etat.couleurDemandee)}
                onPress={() => toucher(carte)}
              />
            ))}
          </Row>
        </ScrollView>
      </View>

      <Sheet
        visible={choixCouleur !== null}
        onClose={() => setChoixCouleur(null)}
        title="Quelle couleur demandes-tu ?"
      >
        <Row gap={space.sm} style={{ paddingBottom: space.lg, justifyContent: 'center' }}>
          {COULEURS.map((couleur) => (
            <Pressable
              key={couleur}
              accessibilityRole="button"
              accessibilityLabel={NOM_COULEUR[couleur]}
              onPress={() => {
                const carte = choixCouleur!;
                setChoixCouleur(null);
                setMessage(`Tu demandes ${NOM_COULEUR[couleur]}`);
                poser(carte, couleur);
              }}
              style={{
                width: 66,
                height: 66,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.surfaceAlt,
              }}
            >
              <Txt
                style={{
                  fontSize: 30,
                  color: couleur === 'C' || couleur === 'K' ? '#E0525F' : c.text,
                }}
              >
                {SYMBOLE[couleur]}
              </Txt>
            </Pressable>
          ))}
        </Row>
      </Sheet>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Main vidée !' : 'L’ordinateur a fini avant toi'}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
