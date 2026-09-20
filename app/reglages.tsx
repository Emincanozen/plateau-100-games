import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useSettings } from '@/engine/settings';
import { useProgress } from '@/engine/progress';
import { useRetour } from '@/engine/navigation';
import { GAME_COUNT } from '@/games/registry';
import { Button, Card, Divider, Row, Segmented, Txt } from '@/ui';

export default function Reglages() {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const retour = useRetour();
  const { settings, set } = useSettings();
  const { totalPlays, gamesTried, favorites, resetEverything } = useProgress();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confidentialite, setConfidentialite] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.md }}>
      <Row between style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
        <Txt variant="h2">Réglages</Txt>
        <Pressable onPress={retour} hitSlop={10}>
          <Txt variant="label" tone="accent">
            Fermer
          </Txt>
        </Pressable>
      </Row>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ gap: space.md }}>
          <Txt variant="caption" tone="faint">
            APPARENCE
          </Txt>
          <Segmented
            value={settings.theme}
            onChange={(v) => set('theme', v)}
            options={[
              { value: 'system', label: 'Système' },
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
            ]}
          />
        </Card>

        <Card style={{ gap: space.md }}>
          <Txt variant="caption" tone="faint">
            JEU
          </Txt>
          <Toggle
            label="Vibrations"
            hint="Retour haptique sur les coups et les fins de partie"
            value={settings.haptics}
            onChange={(v) => set('haptics', v)}
          />
          <Divider />
          <Toggle
            label="Sons"
            hint="Effets sonores des jeux"
            value={settings.sound}
            onChange={(v) => set('sound', v)}
          />
          <Divider />
          <Toggle
            label="Animations réduites"
            hint="Limite les mouvements à l’écran"
            value={settings.reduceMotion}
            onChange={(v) => set('reduceMotion', v)}
          />
          <Divider />
          <Toggle
            label="Règles au premier lancement"
            hint="Affiche les règles la première fois que tu ouvres un jeu"
            value={settings.autoRules}
            onChange={(v) => set('autoRules', v)}
          />
        </Card>

        <Card style={{ gap: space.md }}>
          <Txt variant="caption" tone="faint">
            TES STATISTIQUES
          </Txt>
          <Row between>
            <Stat value={totalPlays} label="parties" />
            <Stat value={`${gamesTried}/${GAME_COUNT}`} label="jeux essayés" />
            <Stat value={favorites.length} label="favoris" />
          </Row>
        </Card>

        <Card style={{ gap: space.md }}>
          <Txt variant="caption" tone="faint">
            DONNÉES
          </Txt>
          <Txt variant="label" tone="dim">
            Tout est stocké sur ton téléphone : aucun compte, aucun serveur, aucune donnée envoyée.
          </Txt>
          <Button
            label={confidentialite ? 'Masquer le détail' : 'Politique de confidentialité'}
            kind="ghost"
            full
            onPress={() => setConfidentialite((v) => !v)}
          />
          {confidentialite ? (
            <View style={{ gap: space.sm }}>
              <Divider />
              <Txt variant="caption" tone="dim">
                Plateau ne collecte aucune donnée personnelle et ne transmet rien sur
                Internet. L’application ne contient ni publicité, ni traceur, ni mesure
                d’audience, ni rapport d’incident automatique.
              </Txt>
              <Txt variant="caption" tone="dim">
                Deux choses seulement sont enregistrées, dans le stockage local de
                l’appareil : tes réglages, et ta progression — records, parties jouées,
                victoires et favoris. Rien de tout cela ne permet de t’identifier, et
                rien ne quitte le téléphone.
              </Txt>
              <Txt variant="caption" tone="dim">
                La seule permission demandée est la vibration, sur Android, pour le retour
                haptique. Ni localisation, ni contacts, ni appareil photo, ni micro, ni
                notifications, ni identifiant publicitaire.
              </Txt>
              <Txt variant="caption" tone="faint">
                Le bouton ci-dessous efface définitivement tout ce qui est enregistré.
              </Txt>
            </View>
          ) : null}
          {confirmReset ? (
            <Row gap={space.sm}>
              <Button
                label="Annuler"
                kind="secondary"
                onPress={() => setConfirmReset(false)}
                style={{ flex: 1 }}
              />
              <Button
                label="Tout effacer"
                kind="danger"
                onPress={() => {
                  resetEverything();
                  setConfirmReset(false);
                }}
                style={{ flex: 1 }}
              />
            </Row>
          ) : (
            <Button
              label="Réinitialiser scores et favoris"
              kind="ghost"
              full
              onPress={() => setConfirmReset(true)}
            />
          )}
        </Card>

        <Txt variant="caption" tone="faint" center>
          Plateau · {GAME_COUNT} jeux
        </Txt>
      </ScrollView>
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { c } = useTheme();
  return (
    <Row between gap={12}>
      <View style={{ flex: 1 }}>
        <Txt variant="label">{label}</Txt>
        {hint ? (
          <Txt variant="caption" tone="faint">
            {hint}
          </Txt>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.accent, false: c.surfaceAlt }}
        thumbColor="#FFFFFF"
      />
    </Row>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt style={{ fontSize: 22, fontWeight: '800', color: c.accent }}>{value}</Txt>
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
    </View>
  );
}
