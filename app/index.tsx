import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useProgress } from '@/engine/progress';
import { CATEGORIES, CATEGORY_BY_ID, type CategoryId, type GameEntry } from '@/engine/types';
import { GAMES, GAME_COUNT, countByCategory, searchGames } from '@/games/registry';
import { Badge, Banniere, BottomInset, Card, IconButton, Row, Txt } from '@/ui';

type Filter = CategoryId | 'tous' | 'favoris';

export default function Accueil() {
  const { c, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { favorites, recent, statFor, isFavorite, toggleFavorite, gamesTried } = useProgress();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');

  const counts = useMemo(() => countByCategory(), []);

  const visible = useMemo(() => {
    let list: GameEntry[] = query ? searchGames(query) : GAMES;
    if (filter === 'favoris') list = list.filter((g) => favorites.includes(g.meta.id));
    else if (filter !== 'tous') list = list.filter((g) => g.meta.category === filter);
    return list;
  }, [query, filter, favorites]);

  const recentGames = useMemo(
    () => recent.map((id) => GAMES.find((g) => g.meta.id === id)).filter(Boolean) as GameEntry[],
    [recent],
  );

  const chips: { key: Filter; label: string; emoji: string; accent?: string; count: number }[] = [
    { key: 'tous', label: 'Tous', emoji: '🎯', count: GAME_COUNT },
    { key: 'favoris', label: 'Favoris', emoji: '⭐', count: favorites.length },
    ...CATEGORIES.map((cat) => ({
      key: cat.id as Filter,
      label: cat.label,
      emoji: cat.emoji,
      accent: cat.accent,
      count: counts[cat.id] ?? 0,
    })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.meta.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md, paddingHorizontal: space.lg }}
        contentContainerStyle={{ gap: space.md, paddingBottom: space.xl }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: space.lg, paddingHorizontal: space.lg, paddingBottom: space.md }}>
            <Row between align="flex-start">
              <View style={{ gap: 2 }}>
                <Row gap={8}>
                  <Txt variant="h1">Plateau</Txt>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: radius.pill,
                      backgroundColor: c.accentSoft,
                      alignSelf: 'center',
                    }}
                  >
                    <Txt variant="caption" tone="accent">
                      {GAME_COUNT} jeux
                    </Txt>
                  </View>
                </Row>
                <Txt variant="label" tone="dim">
                  {gamesTried > 0
                    ? `${gamesTried} essayé${gamesTried > 1 ? 's' : ''} · ${GAME_COUNT - gamesTried} à découvrir`
                    : 'Choisis ton jeu'}
                </Txt>
              </View>
              <IconButton glyph="⚙︎" label="Réglages" onPress={() => router.push('/reglages')} />
            </Row>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                backgroundColor: c.surfaceAlt,
                borderRadius: radius.md,
                paddingHorizontal: space.md,
                height: 44,
              }}
            >
              <Txt tone="faint">🔍</Txt>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Chercher un jeu…"
                placeholderTextColor={c.textFaint}
                style={{ flex: 1, color: c.text, fontSize: 16 }}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>

            <FlatList
              horizontal
              data={chips}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm }}
              renderItem={({ item }) => {
                const active = filter === item.key;
                const tint = item.accent ?? c.accent;
                return (
                  <Pressable
                    onPress={() => setFilter(item.key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: space.md,
                      paddingVertical: 9,
                      borderRadius: radius.pill,
                      backgroundColor: active ? tint : c.surfaceAlt,
                    }}
                  >
                    <Txt style={{ fontSize: 13 }}>{item.emoji}</Txt>
                    <Txt variant="caption" style={{ color: active ? '#FFFFFF' : c.textDim }}>
                      {item.label}
                    </Txt>
                    <Txt variant="caption" style={{ color: active ? '#FFFFFFAA' : c.textFaint }}>
                      {item.count}
                    </Txt>
                  </Pressable>
                );
              }}
            />

            {recentGames.length > 0 && filter === 'tous' && !query ? (
              <View style={{ gap: space.sm }}>
                <Txt variant="caption" tone="faint">
                  REPRENDRE
                </Txt>
                <FlatList
                  horizontal
                  data={recentGames}
                  keyExtractor={(item) => item.meta.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: space.sm }}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => router.push(`/game/${item.meta.id}`)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: space.md,
                        paddingVertical: space.sm,
                        borderRadius: radius.md,
                        backgroundColor: c.surface,
                        borderWidth: 1,
                        borderColor: c.border,
                      }}
                    >
                      <Txt style={{ fontSize: 17 }}>{item.meta.emoji}</Txt>
                      <Txt variant="label">{item.meta.name}</Txt>
                    </Pressable>
                  )}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: space.xxxl, gap: space.sm }}>
            <Txt style={{ fontSize: 34 }}>🕳️</Txt>
            <Txt variant="h3">Aucun jeu trouvé</Txt>
            <Txt variant="label" tone="dim" center>
              {filter === 'favoris'
                ? 'Touche l’étoile sur une fiche de jeu pour l’ajouter ici.'
                : 'Essaie un autre mot-clé.'}
            </Txt>
          </View>
        }
        ListFooterComponent={<BottomInset extra={12} />}
        renderItem={({ item }) => {
          const cat = CATEGORY_BY_ID[item.meta.category];
          const stat = statFor(item.meta.id);
          const fav = isFavorite(item.meta.id);
          return (
            <Card
              onPress={() => router.push(`/game/${item.meta.id}`)}
              accent={cat.accent}
              style={{ flex: 1, gap: space.sm, padding: space.md }}
            >
              {/* Bandeau de couleur : identifie la catégorie d'un coup d'œil. */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 3,
                  backgroundColor: cat.accent,
                  borderTopLeftRadius: radius.lg,
                  borderTopRightRadius: radius.lg,
                }}
              />
              <Row between align="flex-start">
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: cat.accent + '1F',
                    borderWidth: 1,
                    borderColor: cat.accent + '33',
                  }}
                >
                  <Txt style={{ fontSize: 23 }}>{item.meta.emoji}</Txt>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => toggleFavorite(item.meta.id)}
                  accessibilityRole="button"
                  accessibilityLabel={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Txt style={{ fontSize: 15, opacity: fav ? 1 : 0.28 }}>{fav ? '⭐' : '☆'}</Txt>
                </Pressable>
              </Row>

              <View style={{ gap: 2 }}>
                <Txt variant="h3" numberOfLines={1}>
                  {item.meta.name}
                </Txt>
                <Txt variant="caption" tone="faint" numberOfLines={2} style={{ minHeight: 30 }}>
                  {item.meta.tagline}
                </Txt>
              </View>

              <Row gap={6}>
                <Badge label={cat.label} color={cat.accent} />
                <Badge
                  label={item.meta.players === '1' ? 'Solo' : `${item.meta.players} j.`}
                  color={c.textFaint}
                />
              </Row>

              {stat.plays > 0 ? (
                <Txt variant="caption" tone="faint">
                  {stat.best !== undefined
                    ? `Record ${stat.best}`
                    : `${stat.wins}V · ${stat.losses}D`}
                </Txt>
              ) : null}
            </Card>
          );
        }}
      />

      {/* Bandeau ancré en bas du catalogue. Il est hors de la liste, donc il
          ne défile pas sous une carte de jeu, et la marge le tient à distance
          des fiches : aucun appui destiné à un jeu ne peut l'atteindre. */}
      <Banniere marge={space.sm} />
    </View>
  );
}
