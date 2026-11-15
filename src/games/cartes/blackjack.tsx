import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Button, Carte as CarteVue, Row, Txt } from '@/ui';
import { melanger, jeu52, totalBlackjack, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'blackjack',
  name: 'Blackjack',
  tagline: 'Approche 21 sans jamais le dépasser. Le croupier tire jusqu’à 17.',
  category: 'cartes',
  emoji: '🂡',
  difficulty: 1,
  players: '1',
  minutes: 6,
  score: 'high',
  scoreUnit: 'jetons',
  tags: ['casino', 'solo', 'rapide'],
  rules: [
    'Tu mises, puis tu reçois deux cartes ; le croupier en montre une seule.',
    'Tire autant de cartes que tu veux, mais dépasser 21 fait perdre la mise immédiatement.',
    'Quand tu restes, le croupier tire tant qu’il n’a pas atteint 17.',
    'Un blackjack — as et figure servis d’entrée — paie une fois et demie la mise.',
  ],
};

type Phase = 'mise' | 'joueur' | 'croupier' | 'fin';
type Issue = 'gagne' | 'perd' | 'egalite' | 'blackjack';

const MISES = [5, 10, 25, 50];

export default function Blackjack({ submitScore, best, haptic }: GameScreenProps) {
  const { c, space } = useTheme();

  const [jetons, setJetons] = useState(100);
  const [mise, setMise] = useState(10);
  const [phase, setPhase] = useState<Phase>('mise');
  const [joueur, setJoueur] = useState<Carte[]>([]);
  const [croupier, setCroupier] = useState<Carte[]>([]);
  const [issue, setIssue] = useState<Issue | null>(null);
  const sabotRef = useRef<Carte[]>(melanger(jeu52()));

  const tirer = (): Carte => {
    if (sabotRef.current.length < 8) sabotRef.current = melanger(jeu52());
    const carte = sabotRef.current.pop()!;
    return { ...carte, visible: true };
  };

  const reset = useCallback(() => {
    sabotRef.current = melanger(jeu52());
    setJetons(100);
    setMise(10);
    setPhase('mise');
    setJoueur([]);
    setCroupier([]);
    setIssue(null);
  }, []);

  useFrameRestart(reset);

  // Le score conserve est le plus haut tapis atteint : une seule fois par main.
  const mainComptee = useRef(false);
  useEffect(() => {
    if (phase !== 'fin') {
      mainComptee.current = false;
      return;
    }
    if (mainComptee.current) return;
    mainComptee.current = true;
    submitScore(jetons);
  }, [phase, jetons, submitScore]);

  const distribuer = () => {
    if (mise > jetons) return;
    haptic('medium');
    const mainJoueur = [tirer(), tirer()];
    const mainCroupier = [tirer(), { ...tirer(), visible: false }];
    setJoueur(mainJoueur);
    setCroupier(mainCroupier);
    setJetons((j) => j - mise);

    const totalJoueur = totalBlackjack(mainJoueur).total;
    if (totalJoueur === 21) {
      // Blackjack servi : on revele et on paie 3 pour 2.
      const revele = mainCroupier.map((carte) => ({ ...carte, visible: true }));
      setCroupier(revele);
      const totalCroupier = totalBlackjack(revele).total;
      if (totalCroupier === 21) {
        terminer('egalite', mise);
      } else {
        terminer('blackjack', Math.floor(mise * 2.5));
      }
      return;
    }
    setPhase('joueur');
    setIssue(null);
  };

  const terminer = (resultat: Issue, gain: number) => {
    setIssue(resultat);
    setPhase('fin');
    if (gain > 0) setJetons((j) => j + gain);
    haptic(resultat === 'perd' ? 'error' : resultat === 'egalite' ? 'warning' : 'success');
  };

  const carteSupplementaire = () => {
    const main = [...joueur, tirer()];
    setJoueur(main);
    haptic('light');
    if (totalBlackjack(main).total > 21) {
      setCroupier((mains) => mains.map((carte) => ({ ...carte, visible: true })));
      terminer('perd', 0);
    }
  };

  const rester = () => {
    haptic('medium');
    setPhase('croupier');
    let mainCroupier = croupier.map((carte) => ({ ...carte, visible: true }));
    // Le croupier tire jusqu'a 17, as compris.
    while (totalBlackjack(mainCroupier).total < 17) {
      mainCroupier = [...mainCroupier, tirer()];
    }
    setCroupier(mainCroupier);

    const scoreJoueur = totalBlackjack(joueur).total;
    const scoreCroupier = totalBlackjack(mainCroupier).total;

    if (scoreCroupier > 21 || scoreJoueur > scoreCroupier) terminer('gagne', mise * 2);
    else if (scoreJoueur === scoreCroupier) terminer('egalite', mise);
    else terminer('perd', 0);
  };

  const rejouer = () => {
    setPhase('mise');
    setJoueur([]);
    setCroupier([]);
    setIssue(null);
  };

  const totalJoueur = totalBlackjack(joueur);
  const croupierVisible = croupier.filter((carte) => carte.visible);
  const totalCroupier = totalBlackjack(croupierVisible);

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {jetons} jetons
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  const messages: Record<Issue, string> = {
    gagne: 'Tu gagnes la main',
    perd: totalJoueur.total > 21 ? 'Tu dépasses 21' : 'Le croupier l’emporte',
    egalite: 'Égalité, mise rendue',
    blackjack: 'Blackjack ! Paie 3 pour 2',
  };

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Txt variant="caption" tone="faint">
          CROUPIER {croupier.length > 0 ? `· ${totalCroupier.total}` : ''}
        </Txt>
        <Row gap={6} style={{ minHeight: 90, justifyContent: 'center' }}>
          {croupier.map((carte, i) => (
            <CarteVue key={`${carte.id}-${i}`} carte={carte} largeur={58} />
          ))}
        </Row>
      </View>

      {issue ? (
        <Txt variant="h3" center tone={issue === 'perd' ? 'danger' : issue === 'egalite' ? 'dim' : 'success'}>
          {messages[issue]}
        </Txt>
      ) : null}

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Row gap={6} style={{ minHeight: 90, justifyContent: 'center' }}>
          {joueur.map((carte, i) => (
            <CarteVue key={`${carte.id}-${i}`} carte={carte} largeur={58} />
          ))}
        </Row>
        <Txt variant="caption" tone="faint">
          TOI {joueur.length > 0 ? `· ${totalJoueur.total}${totalJoueur.souple ? ' souple' : ''}` : ''}
        </Txt>
      </View>

      <View style={{ gap: space.md }}>
        {phase === 'mise' ? (
          <>
            <Row gap={space.sm} style={{ justifyContent: 'center' }}>
              {MISES.map((montant) => (
                <Button
                  key={montant}
                  label={`${montant}`}
                  size="sm"
                  kind={mise === montant ? 'primary' : 'secondary'}
                  accent="#E0525F"
                  disabled={montant > jetons}
                  onPress={() => setMise(montant)}
                />
              ))}
            </Row>
            <Button
              label={jetons <= 0 ? 'Plus de jetons — recommencer' : `Distribuer (${mise})`}
              full
              accent="#E0525F"
              onPress={jetons <= 0 ? reset : distribuer}
            />
          </>
        ) : phase === 'joueur' ? (
          <Row gap={space.md}>
            <Button label="Carte" full accent="#E0525F" onPress={carteSupplementaire} style={{ flex: 1 }} />
            <Button label="Rester" kind="secondary" onPress={rester} style={{ flex: 1 }} />
          </Row>
        ) : (
          <Button label="Main suivante" full accent="#E0525F" onPress={rejouer} />
        )}
      </View>
    </View>
  );
}
