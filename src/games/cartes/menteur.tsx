import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Carte as CarteVue, Row, Txt, GameOver } from '@/ui';
import { jeu52, melanger, nomRang, type Carte, type Rang } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'menteur',
  name: 'Le menteur',
  tagline: 'Annonce, bluffe, et démasque l’autre au bon moment.',
  category: 'cartes',
  emoji: '🤥',
  difficulty: 2,
  players: '1',
  minutes: 8,
  score: 'none',
  tags: ['bluff', 'plis', 'psychologie'],
  rules: [
    'La valeur demandée monte à chaque tour : as, deux, trois… puis on recommence.',
    'Pose une à quatre cartes face cachée en annonçant cette valeur — même si tu mens.',
    'Tu peux accuser l’adversaire de mentir. Si tu as raison, il ramasse le tas ; sinon c’est toi.',
    'Le premier débarrassé de toutes ses cartes gagne.',
  ],
};

interface Etat {
  maMain: Carte[];
  saMain: Carte[];
  tas: Carte[];
  /** Ce que le dernier joueur a annoncé, pour permettre l'accusation. */
  derniere: { joueur: 'moi' | 'lui'; annonce: Rang; cartes: Carte[] } | null;
  rangDemande: Rang;
  tour: 'moi' | 'lui';
}

const rangSuivant = (rang: Rang): Rang => ((rang % 13) + 1) as Rang;

function distribuer(): Etat {
  const paquet = melanger(jeu52());
  return {
    maMain: paquet.slice(0, 26).map((c) => ({ ...c, visible: true })),
    saMain: paquet.slice(26).map((c) => ({ ...c, visible: false })),
    tas: [],
    derniere: null,
    rangDemande: 1,
    tour: 'moi',
  };
}

export default function Menteur({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [etat, setEtat] = useState<Etat>(distribuer);
  const [selection, setSelection] = useState<string[]>([]);
  const [message, setMessage] = useState('Annonce des as');
  const [revelation, setRevelation] = useState<Carte[] | null>(null);
  const comptee = useRef(false);

  const fini = etat.maMain.length === 0 || etat.saMain.length === 0;
  const gagne = etat.maMain.length === 0;

  const reset = useCallback(() => {
    setEtat(distribuer());
    setSelection([]);
    setMessage('Annonce des as');
    setRevelation(null);
    comptee.current = false;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    submitResult(gagne ? 'win' : 'loss');
  }, [fini, gagne, haptic, submitResult]);

  const cartesChoisies = useMemo(
    () => etat.maMain.filter((carte) => selection.includes(carte.id)),
    [etat.maMain, selection],
  );

  const poser = () => {
    if (etat.tour !== 'moi' || fini) return;
    if (cartesChoisies.length === 0 || cartesChoisies.length > 4) {
      setMessage('Choisis une à quatre cartes');
      haptic('warning');
      return;
    }
    haptic('medium');
    const annonce = etat.rangDemande;
    setMessage(`Tu annonces ${cartesChoisies.length} × ${nomRang(annonce)}`);
    setRevelation(null);
    setSelection([]);
    setEtat((prev) => ({
      ...prev,
      maMain: prev.maMain.filter((carte) => !selection.includes(carte.id)),
      tas: [...prev.tas, ...cartesChoisies],
      derniere: { joueur: 'moi', annonce, cartes: cartesChoisies },
      rangDemande: rangSuivant(prev.rangDemande),
      tour: 'lui',
    }));
  };

  /** Résout une accusation : le menteur — ou l'accusateur à tort — ramasse. */
  const resoudre = useCallback(
    (accusateur: 'moi' | 'lui') => {
      const derniere = etat.derniere;
      if (!derniere) return;

      const mentait = derniere.cartes.some((carte) => carte.rang !== derniere.annonce);
      setRevelation(derniere.cartes.map((carte) => ({ ...carte, visible: true })));

      const ramasseur = mentait ? derniere.joueur : accusateur;
      const tas = etat.tas;

      setMessage(
        mentait
          ? `${derniere.joueur === 'moi' ? 'Tu mentais' : 'L’ordinateur mentait'} — ${
              ramasseur === 'moi' ? 'tu ramasses' : 'il ramasse'
            } ${tas.length} cartes`
          : `C’était vrai — ${ramasseur === 'moi' ? 'tu ramasses' : 'il ramasse'} ${tas.length} cartes`,
      );
      haptic(ramasseur === 'moi' ? 'error' : 'success');

      setTimeout(() => {
        setRevelation(null);
        setEtat((prev) => ({
          ...prev,
          maMain:
            ramasseur === 'moi'
              ? [...prev.maMain, ...prev.tas.map((carte) => ({ ...carte, visible: true }))]
              : prev.maMain,
          saMain:
            ramasseur === 'lui'
              ? [...prev.saMain, ...prev.tas.map((carte) => ({ ...carte, visible: false }))]
              : prev.saMain,
          tas: [],
          derniere: null,
          rangDemande: 1,
          tour: ramasseur === 'moi' ? 'moi' : 'lui',
        }));
      }, 2400);
    },
    [etat.derniere, etat.tas, haptic],
  );

  const accuser = () => {
    if (etat.derniere?.joueur !== 'lui' || fini) return;
    haptic('medium');
    resoudre('moi');
  };

  // Tour de l'ordinateur : il accuse parfois, puis pose en mentant si besoin.
  useEffect(() => {
    if (etat.tour !== 'lui' || fini || revelation) return;

    const id = setTimeout(() => {
      // Décision d'accuser : plus l'annonce est grosse, plus c'est suspect.
      if (etat.derniere?.joueur === 'moi') {
        const suspicion = 0.12 + etat.derniere.cartes.length * 0.16;
        if (Math.random() < suspicion) {
          resoudre('lui');
          return;
        }
      }

      setEtat((prev) => {
        const annonce = prev.rangDemande;
        const vraies = prev.saMain.filter((carte) => carte.rang === annonce);
        // S'il a les bonnes cartes il les joue, sinon il bluffe avec ses plus basses.
        const cartes =
          vraies.length > 0
            ? vraies.slice(0, Math.min(vraies.length, 3))
            : prev.saMain.slice(0, 1 + (Math.random() < 0.3 ? 1 : 0));

        const ids = new Set(cartes.map((carte) => carte.id));
        setMessage(`L’ordinateur annonce ${cartes.length} × ${nomRang(annonce)}`);

        return {
          ...prev,
          saMain: prev.saMain.filter((carte) => !ids.has(carte.id)),
          tas: [...prev.tas, ...cartes],
          derniere: { joueur: 'lui', annonce, cartes },
          rangDemande: rangSuivant(prev.rangDemande),
          tour: 'moi',
        };
      });
    }, 950);

    return () => clearTimeout(id);
  }, [etat.tour, etat.derniere, fini, revelation, resoudre]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {etat.maMain.length}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {etat.saMain.length}
      </Txt>
      <Txt variant="label" tone="warning">
        Tas {etat.tas.length}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.md }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          ORDINATEUR · {etat.saMain.length} cartes
        </Txt>
        <Row gap={-20}>
          {etat.saMain.slice(0, 12).map((carte, i) => (
            <CarteVue key={`${carte.id}-${i}`} carte={{ ...carte, visible: false }} largeur={36} />
          ))}
        </Row>
      </View>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <View
          style={{
            paddingHorizontal: space.xl,
            paddingVertical: space.sm,
            borderRadius: radius.pill,
            backgroundColor: '#E0525F22',
          }}
        >
          <Txt variant="h3" style={{ color: '#E0525F' }}>
            Valeur demandée : {nomRang(etat.rangDemande)}
          </Txt>
        </View>

        <Row gap={5} style={{ minHeight: 80, justifyContent: 'center' }}>
          {revelation
            ? revelation.map((carte, i) => (
                <CarteVue key={`${carte.id}-${i}`} carte={carte} largeur={50} />
              ))
            : etat.derniere?.cartes.map((carte, i) => (
                <CarteVue key={`${carte.id}-${i}`} carte={{ ...carte, visible: false }} largeur={50} />
              ))}
        </Row>

        <Txt variant="label" tone="dim" center>
          {message}
        </Txt>

        {etat.derniere?.joueur === 'lui' && !revelation && !fini ? (
          <Button label="Menteur !" accent="#E0525F" onPress={accuser} />
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          TA MAIN — choisis les cartes à poser
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={3} style={{ paddingVertical: 4 }}>
            {etat.maMain.map((carte) => (
              <CarteVue
                key={carte.id}
                carte={carte}
                largeur={46}
                selectionnee={selection.includes(carte.id)}
                onPress={() =>
                  setSelection((s) =>
                    s.includes(carte.id) ? s.filter((id) => id !== carte.id) : [...s, carte.id],
                  )
                }
              />
            ))}
          </Row>
        </ScrollView>

        <Button
          label={`Annoncer ${selection.length || ''} ${nomRang(etat.rangDemande)}`}
          full
          accent="#E0525F"
          disabled={etat.tour !== 'moi' || fini || !!revelation || selection.length === 0}
          onPress={poser}
        />
      </View>

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
