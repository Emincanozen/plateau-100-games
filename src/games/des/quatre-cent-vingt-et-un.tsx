import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, De, Row, Txt, GameOver } from '@/ui';
import { randBetween } from '../lib/rng';
import { evaluerMain, type Des3 as Des } from '../lib/regles';

export const meta: GameMeta = {
  id: '421',
  name: '421',
  tagline: 'Trois dés, trois lancers, et la combinaison reine : 4-2-1.',
  category: 'des',
  emoji: '🎯',
  difficulty: 2,
  players: '1',
  minutes: 8,
  score: 'low',
  scoreUnit: 'jetons',
  tags: ['dés', 'bistrot', 'classique'],
  rules: [
    'Chaque manche, tu lances trois dés et tu peux relancer deux fois ceux que tu gardes pas.',
    'Le 421 est la meilleure main, puis les as (1-1-X), puis les brelans, puis les suites.',
    'Le perdant de la manche ramasse des jetons — il y en a onze en jeu.',
    'Le premier débarrassé de tous ses jetons gagne. Ton score est le nombre de jetons restants.',
  ],
};


const lancerDes = (): Des => [randBetween(1, 6), randBetween(1, 6), randBetween(1, 6)];

/**
 * Valeur d'une main, du plus fort au plus faible. On renvoie aussi le nombre
 * de jetons que le perdant ramasse quand cette main l'emporte.
 */

const JETONS_EN_JEU = 11;

export default function QuatreCentVingtEtUn({ submitScore, best, haptic }: GameScreenProps) {
  const { c, radius, space } = useTheme();

  const [mesJetons, setMesJetons] = useState(0);
  const [sesJetons, setSesJetons] = useState(0);
  const [pot, setPot] = useState(JETONS_EN_JEU);
  const [des, setDes] = useState<Des>(lancerDes);
  const [gardes, setGardes] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [lancersRestants, setLancersRestants] = useState(2);
  const [mainAdverse, setMainAdverse] = useState<Des | null>(null);
  const [message, setMessage] = useState('Lance tes dés');
  const [record, setRecord] = useState(false);
  const comptee = useRef(false);

  const maMain = useMemo(() => evaluerMain(des), [des]);

  // La partie s'arrête quand le pot est vide et qu'un camp n'a aucun jeton.
  const fini = pot === 0 && (mesJetons === 0 || sesJetons === 0);
  const gagne = fini && mesJetons === 0;

  const reset = useCallback(() => {
    setMesJetons(0);
    setSesJetons(0);
    setPot(JETONS_EN_JEU);
    setDes(lancerDes());
    setGardes([false, false, false]);
    setLancersRestants(2);
    setMainAdverse(null);
    setMessage('Lance tes dés');
    setRecord(false);
    comptee.current = false;
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee.current) return;
    comptee.current = true;
    haptic(gagne ? 'success' : 'error');
    setRecord(submitScore(mesJetons));
  }, [fini, gagne, mesJetons, haptic, submitScore]);

  const relancer = () => {
    if (lancersRestants <= 0 || fini) return;
    haptic('medium');
    setDes((d) => d.map((valeur, i) => (gardes[i] ? valeur : randBetween(1, 6))) as Des);
    setLancersRestants((n) => n - 1);
  };

  /** L'ordinateur relance ce qui ne sert pas : il garde les 1, les 4 et les 2. */
  function jouerOrdinateur(): Des {
    let main = lancerDes();
    for (let tour = 0; tour < 2; tour++) {
      const actuelle = evaluerMain(main);
      if (actuelle.rang >= 800) break; // déjà une bonne main, il s'arrête
      main = main.map((valeur) => ([1, 2, 4].includes(valeur) ? valeur : randBetween(1, 6))) as Des;
    }
    return main;
  }

  const comparer = () => {
    if (fini) return;
    const sienne = jouerOrdinateur();
    setMainAdverse(sienne);
    const saMain = evaluerMain(sienne);

    if (maMain.rang === saMain.rang) {
      setMessage(`Égalité sur ${maMain.nom} — on rejoue`);
      haptic('warning');
    } else {
      const jeGagne = maMain.rang > saMain.rang;
      const gagnante = jeGagne ? maMain : saMain;
      const mise = Math.min(gagnante.jetons, pot > 0 ? pot : gagnante.jetons);

      if (pot > 0) {
        // Phase de charge : le perdant prend des jetons du pot.
        setPot((p) => Math.max(0, p - mise));
        if (jeGagne) setSesJetons((n) => n + mise);
        else setMesJetons((n) => n + mise);
      } else {
        // Phase de décharge : le gagnant se débarrasse de ses jetons.
        if (jeGagne) {
          const donne = Math.min(mise, mesJetons);
          setMesJetons((n) => n - donne);
          setSesJetons((n) => n + donne);
        } else {
          const donne = Math.min(mise, sesJetons);
          setSesJetons((n) => n - donne);
          setMesJetons((n) => n + donne);
        }
      }

      setMessage(
        `${maMain.nom} contre ${saMain.nom} — ${jeGagne ? 'tu gagnes' : 'tu perds'} ${mise} jeton${mise > 1 ? 's' : ''}`,
      );
      haptic(jeGagne ? 'success' : 'error');
    }

    setDes(lancerDes());
    setGardes([false, false, false]);
    setLancersRestants(2);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        Toi {mesJetons}
      </Txt>
      <Txt variant="label" tone="faint">
        Ordi {sesJetons}
      </Txt>
      <Txt variant="label" tone="warning">
        Pot {pot}
      </Txt>
    </Row>,
  );

  return (
    <View style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center', paddingVertical: space.lg }}>
      {mainAdverse ? (
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Txt variant="caption" tone="faint">
            ORDINATEUR · {evaluerMain(mainAdverse).nom}
          </Txt>
          <Row gap={space.sm}>
            {mainAdverse.map((valeur, i) => (
              <De key={i} valeur={valeur} taille={44} tint="#E0525F" />
            ))}
          </Row>
        </View>
      ) : (
        <Txt variant="caption" tone="faint">
          L’ordinateur n’a pas encore joué
        </Txt>
      )}

      <Txt variant="label" tone="dim" center>
        {message}
      </Txt>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <Row gap={space.md}>
          {des.map((valeur, i) => (
            <De
              key={i}
              valeur={valeur}
              taille={68}
              garde={gardes[i]}
              onPress={() =>
                setGardes((g) => g.map((v, j) => (i === j ? !v : v)) as [boolean, boolean, boolean])
              }
            />
          ))}
        </Row>
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: 6,
            borderRadius: radius.pill,
            backgroundColor: c.surfaceAlt,
          }}
        >
          <Txt variant="label" style={{ color: '#A96CF0' }}>
            {maMain.nom}
          </Txt>
        </View>
        <Txt variant="caption" tone="faint">
          Touche un dé pour le garder
        </Txt>
      </View>

      <Row gap={space.md}>
        <Button
          label={lancersRestants > 0 ? `Relancer (${lancersRestants})` : 'Plus de lancer'}
          accent="#A96CF0"
          disabled={lancersRestants <= 0 || fini}
          onPress={relancer}
        />
        <Button label="Comparer" kind="secondary" disabled={fini} onPress={comparer} />
      </Row>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'loss'}
        title={gagne ? 'Débarrassé !' : 'Tu ramasses tout'}
        score={mesJetons}
        scoreLabel="Jetons restants"
        best={best}
        isRecord={record}
        accent="#A96CF0"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
