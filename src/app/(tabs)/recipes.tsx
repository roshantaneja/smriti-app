import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Chip, Segmented } from '@/components/ui/segmented';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { recipeCost, recipePerServing } from '@/lib/nutrition';
import { useStore } from '@/lib/store';
import type { Recipe } from '@/lib/types';

type SortKey = 'recent' | 'protein' | 'quick' | 'rated';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'protein', label: 'Most protein/cal' },
  { value: 'quick', label: 'Quickest' },
  { value: 'rated', label: 'Top rated' },
];

export default function RecipesScreen() {
  const [sort, setSort] = useState<SortKey>('recent');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [highProtein, setHighProtein] = useState(false);
  const [pricedOnly, setPricedOnly] = useState(false);
  const recipes = useStore((s) => s.recipes);
  const getIngredient = useStore((s) => s.getIngredient);

  const allTags = useMemo(
    () => [...new Set(recipes.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b)),
    [recipes],
  );
  const toggleTag = (tag: string) =>
    setActiveTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]));

  const rows = useMemo(() => {
    // Filters compose (AND), then the chosen sort orders what's left.
    const withMacros = recipes
      .map((r) => ({
        recipe: r,
        per: recipePerServing(r, getIngredient),
      }))
      .filter(({ recipe, per }) => {
        if (activeTags.length && !activeTags.every((t) => recipe.tags.includes(t))) return false;
        if (highProtein && (per.protein ?? 0) < 30) return false;
        if (pricedOnly && recipeCost(recipe, getIngredient) === null) return false;
        return true;
      });
    const proteinDensity = (m: { per: { protein?: number; calories?: number } }) =>
      (m.per.calories ?? 0) > 0 ? (m.per.protein ?? 0) / (m.per.calories ?? 1) : 0;
    switch (sort) {
      case 'protein':
        return withMacros.sort((a, b) => proteinDensity(b) - proteinDensity(a));
      case 'quick':
        return withMacros.sort(
          (a, b) => (a.recipe.prepMinutes ?? Infinity) - (b.recipe.prepMinutes ?? Infinity),
        );
      case 'rated':
        return withMacros.sort((a, b) => (b.recipe.rating ?? 0) - (a.recipe.rating ?? 0));
      default:
        return withMacros.sort((a, b) => b.recipe.createdAt.localeCompare(a.recipe.createdAt));
    }
  }, [recipes, getIngredient, sort, activeTags, highProtein, pricedOnly]);

  return (
    <Screen
      title="Recipes"
      subtitle={recipes.length ? `${recipes.length} saved` : 'Build your library'}
      right={<Button title="+ New" size="sm" onPress={() => router.push('/recipe/new')} />}>
      {recipes.length === 0 ? (
        <Card>
          <EmptyState
            icon="book-outline"
            title="No recipes yet"
            message="Create a recipe from your foods once — then logging that meal is a single tap, forever."
          />
          <Button title="Create your first recipe" onPress={() => router.push('/recipe/new')} />
        </Card>
      ) : (
        <>
          <Segmented options={SORTS} value={sort} onChange={setSort} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            <Chip label="≥30g protein" active={highProtein} onPress={() => setHighProtein((v) => !v)} />
            <Chip label="Priced only" active={pricedOnly} onPress={() => setPricedOnly((v) => !v)} />
            {allTags.map((t) => (
              <Chip key={t} label={t} active={activeTags.includes(t)} onPress={() => toggleTag(t)} />
            ))}
          </View>
          {rows.length === 0 ? (
            <Card>
              <EmptyState
                icon="funnel-outline"
                title="No recipes match"
                message="Clear a filter or two to see more of your library."
              />
            </Card>
          ) : (
            rows.map(({ recipe, per }) => (
              <RecipeCard key={recipe.id} recipe={recipe} perCalories={per.calories ?? 0} perProtein={per.protein ?? 0} />
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function RecipeCard({
  recipe,
  perCalories,
  perProtein,
}: {
  recipe: Recipe;
  perCalories: number;
  perProtein: number;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => router.push(`/recipe/${recipe.id}`)}>
      <Card style={{ gap: Spacing.two }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two }}>
          <ThemedText type="subtitle" style={{ fontSize: 18, lineHeight: 24, flex: 1 }}>
            {recipe.name}
          </ThemedText>
          {recipe.rating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="star" size={14} color="#E0A93B" />
              <ThemedText type="small" themeColor="textSecondary">
                {recipe.rating}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' }}>
          <Meta icon="flame-outline" text={`${Math.round(perCalories)} kcal/serving`} color={MacroColors.calories} />
          <Meta icon="barbell-outline" text={`${Math.round(perProtein)}g protein`} color={MacroColors.protein} />
          <Meta icon="layers-outline" text={`${recipe.items.length} ingredients`} />
          {recipe.prepMinutes ? <Meta icon="time-outline" text={`${recipe.prepMinutes} min`} /> : null}
        </View>

        {recipe.tags.length ? (
          <View style={{ flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' }}>
            {recipe.tags.map((t) => (
              <View
                key={t}
                style={{
                  paddingHorizontal: Spacing.two,
                  paddingVertical: 2,
                  borderRadius: Radius.pill,
                  backgroundColor: theme.tintSoft,
                }}>
                <ThemedText type="small" style={{ color: theme.tint, fontSize: 12 }}>
                  {t}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function Meta({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one }}>
      <Ionicons name={icon} size={14} color={color ?? theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </View>
  );
}
