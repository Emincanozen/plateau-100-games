import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';

export const meta: GameMeta = {
  id: 'des-menteurs',
  name: 'Dés menteurs',
  tagline: 'Annonce plus fort que l’autre, ou traite-le de menteur.',
  category: 'des',
  emoji: '🤫',
  difficulty: 3,
  players: '1',
  minutes: 10,
  score: 'none',
  tags: ['bluff', 'dés', 'déduction'],
  rules: [
    'Chacun a cinq dés cachés. Tu ne vois que les tiens.',
    'Une annonce porte sur le total des dés d’une face : « quatre fois le 3 » signifie qu’il y a au moins quatre 3 sur la table.',
    'À ton tour, monte l’annonce — plus de dés, ou la même quantité sur une face plus forte — ou crie « menteur ».',
    'Si l’annonce contestée est vraie, l’accusateur perd un dé ; sinon c’est l’annonceur. Le dernier avec des dés gagne.',
  ],
};

interface Annonce {
  quantite: number;
  face: number;
}

const lancer = (nombre: number): number[] =>
  Array.from({ length: nombre }, () => randBetween(1, 6));

const plusForte = (a: Annonce, b: Annonce) =>
  a.quantite > b.quantite || (a.quantite === b.quantite && a.face > b.face);

export default function DesMenteurs({ submitResult, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [mesDes, setMesDes] = useState<number[]>(() => lancer(5));
  const [sesDes, setSesDes] = useState<number[]>(() => lancer(5));
  const [annonce, setAnnonce] = useState<Annonce | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [face, setFace] = useState(1);
  const [aMoi, setAMoi] = useState(true);
  const [message, setMessage] = useState('Fais une annonce');
  const [revele, setRevele] = useState(false);
  const comptee = useRef(false);

  const fini = mesDes.length === 0 || sesDes.length === 0;
  const gagne = sesDes.length === 0;
  const totalDes = mesDes.length + sesDes.length;

  const nouvelleManche = useCallback(
    (mesDesNombre: number, sesDesNombre: number) => {
      setMesDes(lancer(mesDesNombre));
      setSesDes(lancer(sesDesNombre));
      setAnnonce(null);
      setQuantite(1);
      setFace(1);
      setRevele(false);
    },
    [],
  );

  const reset = useCallback(() => {
    nouvelleManche(5, 5);
    setAMoi(true);
    setMessage('Fais une annonce');
    comptee.current = false;
  }, [nouvelleManche]);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    submitResult(gagne ? 'win' : 'loss');
  }, [fini, gagne, haptic, submitResult]);

  /** Nombre réel de dés d'une face, sur toute la table. */
  const compterFace = useCallback(
    (cible: number) =>
      [...mesDes, ...sesDes].filter((d) => d === cible).length,
    [mesDes, sesDes],
  );

  const resoudre = useCallback(
    (accusateur: 'moi' | 'lui') => {
      if (!annonce) return;
      const reel = compterFace(annonce.face);
      const annonceVraie = reel >= annonce.quantite;
      // Si l'annonce est vraie, c'est l'accusateur qui perd un dé.
      const perdant = annonceVraie ? accusateur : accusateur === 'moi' ? 'lui' : 'moi';

      setRevele(true);
      setMessage(
        `Il y avait ${reel} × ${annonce.face} — ${annonceVraie ? 'l’annonce tenait' : 'c’était du bluff'}. ${
          perdant === 'moi' ? 'Tu perds' : 'L’ordinateur perd'
        } un dé.`,
      );
      haptic(perdant === 'moi' ? 'error' : 'success');

      const mesSuivants = perdant === 'moi' ? mesDes.length - 1 : mesDes.length;
      const sesSuivants = perdant === 'lui' ? sesDes.length - 1 : sesDes.length;

      setTimeout(() => {
        if (mesSuivants === 0 || sesSuivants === 0) {
          setMesDes(perdant === 'moi' ? [] : mesDes);
          setSesDes(perdant === 'lui' ? [] : sesDes);
          return;
        }
        nouvelleManche(mesSuivants, sesSuivants);
        setAMoi(perdant === 'moi');
        setMessage('Nouvelle manche');
      }, 2400);
    },
    [annonce, compterFace, mesDes, sesDes, haptic, nouvelleManche],
  );

  const annoncer = () => {
    if (!aMoi || fini || revele) return;
    const nouvelle = { quantite, face };
    if (annonce && !plusForte(nouvelle, annonce)) {
      setMessage('Il faut annoncer plus fort');
      haptic('warning');
      return;
    }
    haptic('medium');
    setAnnonce(nouvelle);
    setMessage(`Tu annonces ${nouvelle.quantite} × ${nouvelle.face}`);
    setAMoi(false);
  };

  const accuser = () => {
    if (!aMoi || !annonce || fini || revele) return;
    haptic('medium');
    resoudre('moi');
  };

  // Tour de l'ordinateur.
  useEffect(() => {
    if (aMoi || fini || revele) return;

    const id = setTimeout(() => {
      const mesConnus = sesDes.filter((d) => d === (annonce?.face ?? 1)).length;
      // Il estime les dés adverses : un sixième de chances par dé.
      const estimation = mesConnus + mesDes.length / 6;

      if (annonce && annonce.quantite > estimation + 1.4) {
        resoudre('lui');
        return;
      }

      // Il annonce en s'appuyant sur sa face la plus fréquente.
      const comptes = [0, 0, 0, 0, 0, 0, 0];
      sesDes.forEach((d) => (comptes[d] += 1));
      let meilleureFace = 1;
      for (let f = 1; f <= 6; f++) if (comptes[f] >= comptes[meilleureFace]) meilleureFace = f;

      let proposition: Annonce = annonce
        ? { quantite: annonce.quantite, face: Math.min(6, annonce.face + 1) }
        : { quantite: Math.max(2, comptes[meilleureFace]), face: meilleureFace };

      if (annonce && !plusForte(proposition, annonce)) {
        proposition = { quantite: annonce.quantite + 1, face: meilleureFace };
      }
      if (proposition.quantite > totalDes) {
        resoudre('lui');
        return;
      }

      setAnnonce(proposition);
      setQuantite(proposition.quantite);
      setFace(proposition.face);
      setMessage(`L’ordinateur annonce ${proposition.quantite} × ${proposition.face}`);
      setAMoi(true);
    }, 1000);

    return () => clearTimeout(id);
  }, [aMoi, fini, revele, annonce, sesDes, mesDes.length, totalDes, resoudre]);

  const mesComptes = useMemo(() => {
    const comptes = [0, 0, 0, 0, 0, 0, 0];
    mesDes.forEach((d) => (comptes[d] += 1));
    return comptes;
  }, [mesDes]);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {mesDes.length} dés
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {sesDes.length} dés
      </Txt>
      {annonce ? (
        <Txt variant="label" tone="warning">
          {annonce.quantite} × {annonce.face}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          DÉS DE L’ORDINATEUR
        </Txt>
        <Row gap={6}>
          {sesDes.map((valeur, i) => (
            <De key={i} valeur={revele ? valeur : 1} taille={40} eteint={!revele} tint="#E0525F" />
          ))}
        </Row>
      </View>

      <View
        style={{
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.xl,
          paddingVertical: space.md,
          borderRadius: radius.lg,
          backgroundColor: c.surface,
        }}
      >
        <Txt variant="caption" tone="faint">
          ANNONCE EN COURS
        </Txt>
        <Txt variant="h2" style={{ color: annonce ? '#A96CF0' : c.textFaint }}>
          {annonce ? `${annonce.quantite} × ${annonce.face}` : '—'}
        </Txt>
        <Txt variant="label" tone="dim" center>
          {message}
        </Txt>
      </View>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Row gap={6}>
          {mesDes.map((valeur, i) => (
            <De key={i} valeur={valeur} taille={48} />
          ))}
        </Row>
        <Txt variant="caption" tone="faint">
          TES DÉS ·{' '}
          {mesComptes
            .map((n, f) => (n > 0 ? `${n}×${f}` : null))
            .filter(Boolean)
            .join('  ')}
        </Txt>
      </View>

      <View style={{ gap: space.sm, alignItems: 'center' }}>
        <Row gap={space.md} align="center">
          <Reglage
            label="Quantité"
            valeur={quantite}
            min={1}
            max={totalDes}
            onChange={setQuantite}
          />
          <Reglage label="Face" valeur={face} min={1} max={6} onChange={setFace} />
        </Row>

        <Row gap={space.md}>
          <Button
            label="Annoncer"
            accent="#A96CF0"
            disabled={!aMoi || fini || revele}
            onPress={annoncer}
          />
          <Button
            label="Menteur !"
            kind="danger"
            disabled={!aMoi || !annonce || fini || revele}
            onPress={accuser}
          />
        </Row>
      </View>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'L’ordinateur n’a plus de dés !' : 'Tu n’as plus de dés'}
        accent="#A96CF0"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}

function Reglage({
  label,
  valeur,
  min,
  max,
  onChange,
}: {
  label: string;
  valeur: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const { c, radius, space } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
      <Row gap={6} align="center">
        <Button
          label="−"
          size="sm"
          kind="secondary"
          onPress={() => onChange(Math.max(min, valeur - 1))}
        />
        <View
          style={{
            minWidth: 40,
            paddingVertical: 6,
            borderRadius: radius.sm,
            backgroundColor: c.surfaceAlt,
            alignItems: 'center',
          }}
        >
          <Txt variant="h3">{valeur}</Txt>
        </View>
        <Button
          label="+"
          size="sm"
          kind="secondary"
          onPress={() => onChange(Math.min(max, valeur + 1))}
        />
      </Row>
    </View>
  );
}
