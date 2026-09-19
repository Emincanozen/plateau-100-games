import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useFrameRestart, useFrameStatus } from '@/engine/frame';
import type { GameMeta, GameScreenProps } from '@/engine/types';
import { Carte as CarteVue, Row, Txt, GameOver } from '@/ui';
import { jeu52, melanger, type Carte } from '../lib/cartes';

export const meta: GameMeta = {
  id: 'accordeon',
  name: 'Accordéon',
  tagline: 'Replie les cinquante-deux cartes en un seul tas.',
  category: 'cartes',
  emoji: '🪗',
  difficulty: 3,
  players: '1',
  minutes: 7,
  score: 'low',
  scoreUnit: 'tas',
  tags: ['réussite', 'solo', 'exigeant'],
  rules: [
    'Les cartes sont alignées. Une carte peut sauter sur sa voisine de gauche, ou sur celle située trois rangs plus à gauche.',
    'Le saut n’est permis que si les deux cartes partagent la couleur ou la valeur.',
    'La carte qui saute recouvre l’autre : les tas se replient et la ligne raccourcit.',
    'Le but est de tout réduire à un seul tas. Réussir est rare : finir sous cinq tas est déjà très bon.',
  ],
};

/** Un tas : on ne voit que la carte du dessus, mais il en cache d'autres. */
interface Tas {
  dessus: Carte;
  hauteur: number;
  /** Identifiant stable pour les clés React, même après repliement. */
  cle: string;
}

const distribuer = (): Tas[] =>
  melanger(jeu52()).map((carte, i) => ({
    dessus: { ...carte, visible: true },
    hauteur: 1,
    cle: `${carte.id}-${i}`,
  }));

/** Un saut est permis vers la voisine immédiate ou la troisième à gauche. */
const compatibles = (a: Carte, b: Carte) => a.couleur === b.couleur || a.rang === b.rang;

function ciblesDe(tas: Tas[], index: number): number[] {
  const out: number[] = [];
  for (const recul of [1, 3]) {
    const cible = index - recul;
    if (cible < 0) continue;
    if (compatibles(tas[index].dessus, tas[cible].dessus)) out.push(cible);
  }
  return out;
}

export default function Accordeon({ submitScore, best, haptic }: GameScreenProps) {
  const { c, space } = useTheme();
  const { width } = useWindowDimensions();
  const largeurCarte = Math.min(Math.floor((width - 32) / 7) - 4, 48);

  const [tas, setTas] = useState<Tas[]>(distribuer);
  const [selection, setSelection] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  const [comptee, setComptee] = useState(false);

  /** Tous les sauts encore possibles sur la ligne. */
  const coupsPossibles = useMemo(
    () => tas.reduce((total, _, i) => total + ciblesDe(tas, i).length, 0),
    [tas],
  );

  const gagne = tas.length === 1;
  const fini = gagne || coupsPossibles === 0;

  const reset = useCallback(() => {
    setTas(distribuer());
    setSelection(null);
    setRecord(false);
    setComptee(false);
  }, []);

  useFrameRestart(reset);

  useEffect(() => {
    if (!fini || comptee) return;
    setComptee(true);
    haptic(gagne ? 'success' : 'error');
    setRecord(submitScore(tas.length));
  }, [fini, comptee, gagne, tas.length, haptic, submitScore]);

  const cibles = selection !== null ? ciblesDe(tas, selection) : [];

  const toucher = (index: number) => {
    if (fini) return;

    if (selection !== null && cibles.includes(index)) {
      haptic('success');
      setTas((precedent) => {
        const suivant = precedent.slice();
        const source = suivant[selection];
        const destination = suivant[index];
        // La carte qui saute recouvre celle d'arrivée : le tas grandit.
        suivant[index] = {
          dessus: source.dessus,
          hauteur: destination.hauteur + source.hauteur,
          cle: destination.cle,
        };
        suivant.splice(selection, 1);
        return suivant;
      });
      setSelection(null);
      return;
    }

    if (selection === index) {
      setSelection(null);
      return;
    }

    if (ciblesDe(tas, index).length === 0) {
      haptic('warning');
      setSelection(null);
      return;
    }
    haptic('light');
    setSelection(index);
  };

  useFrameStatus(
    <Row gap={space.md}>
      <Txt variant="label" tone="dim">
        {tas.length} tas
      </Txt>
      <Txt variant="label" tone="faint">
        {coupsPossibles} coup{coupsPossibles > 1 ? 's' : ''}
      </Txt>
      {best !== undefined ? (
        <Txt variant="label" tone="faint">
          Record {best}
        </Txt>
      ) : null}
    </Row>,
  );

  return (
    <View style={{ flex: 1, paddingVertical: space.md }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Row gap={4} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {tas.map((pile, index) => {
            const estCible = cibles.includes(index);
            const jouable = ciblesDe(tas, index).length > 0;
            return (
              <View key={pile.cle} style={{ alignItems: 'center', marginBottom: 6 }}>
                <CarteVue
                  carte={pile.dessus}
                  largeur={largeurCarte}
                  compacte
                  selectionnee={selection === index || estCible}
                  onPress={() => toucher(index)}
                  style={
                    estCible
                      ? { borderColor: '#34B37E', borderWidth: 2.5 }
                      : !jouable && selection === null
                        ? { opacity: 0.72 }
                        : undefined
                  }
                />
                {pile.hauteur > 1 ? (
                  <Txt variant="caption" tone="faint" style={{ fontSize: 9 }}>
                    ×{pile.hauteur}
                  </Txt>
                ) : (
                  <View style={{ height: 12 }} />
                )}
              </View>
            );
          })}
        </Row>
      </ScrollView>

      <Txt variant="caption" tone="faint" center style={{ paddingTop: space.sm }}>
        {selection === null
          ? 'Touche une carte qui peut sauter'
          : `Saute sur la carte encadrée en vert`}
      </Txt>

      <GameOver
        visible={fini}
        outcome={gagne ? 'win' : 'over'}
        title={gagne ? 'Un seul tas — parfait !' : 'Plus aucun saut possible'}
        score={tas.length}
        scoreLabel="Tas restants"
        best={best}
        isRecord={record}
        detail={gagne ? undefined : 'Moins de cinq tas est un très bon résultat.'}
        accent="#E0525F"
        onReplay={reset}
        onQuit={reset}
      />
    </View>
  );
}
