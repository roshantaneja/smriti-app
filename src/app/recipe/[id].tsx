import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/date';
import { trimNum } from '@/lib/format';
import { recipeCost, recipePerServing, recipeTotals, scale } from '@/lib/nutrition';
import { useStore } from '@/lib/store';

export default function RecipeDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const recipe = useStore((s) => s.recipes.find((r) => r.id === id));
  const getIngredient = useStore((s) => s.getIngredient);
  const addLogEntry = useStore((s) => s.addLogEntry);
  const updateRecipe = useStore((s) => s.updateRecipe);
  const deleteRecipe = useStore((s) => s.deleteRecipe);

  const [servings, setServings] = useState(1);
  const [logged, setLogged] = useState(false);

  const per = useMemo(
    () => (recipe ? recipePerServing(recipe, getIngredient) : {}),
    [recipe, getIngredient],
  );
  const totals = useMemo(
    () => (recipe ? recipeTotals(recipe, getIngredient) : {}),
    [recipe, getIngredient],
  );
  const cost = useMemo(
    () => (recipe ? recipeCost(recipe, getIngredient) : null),
    [recipe, getIngredient],
  );

  if (!recipe) {
    return (
      <Screen title="Recipe" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Recipe' }} />
        <ThemedText type="small" themeColor="textSecondary">
          This recipe no longer exists.
        </ThemedText>
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const onLog = () => {
    addLogEntry({ date: dayKey(), kind: 'recipe', recipeId: recipe.id, servings });
    setLogged(true);
    setTimeout(() => setLogged(false), 1600);
  };

  const onDelete = () => {
    Alert.alert('Delete recipe?', `“${recipe.name}” will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRecipe(recipe.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen scroll title={recipe.name} subtitle={`${recipe.servings} servings`} edges={['bottom']}>
      <Stack.Screen options={{ title: recipe.name }} />

      {/* Per-serving macros */}
      <Card style={{ gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <ThemedText type="smallBold">Per serving</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round(totals.calories ?? 0)} kcal total
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.four, flexWrap: 'wrap' }}>
          <Stat label="kcal" value={Math.round(per.calories ?? 0)} color={MacroColors.calories} />
          <Stat label="protein" value={`${Math.round(per.protein ?? 0)}g`} color={MacroColors.protein} />
          <Stat label="carbs" value={`${Math.round(per.carbs ?? 0)}g`} color={MacroColors.carbs} />
          <Stat label="fat" value={`${Math.round(per.fat ?? 0)}g`} color={MacroColors.fat} />
          <Stat label="fiber" value={`${Math.round(per.fiber ?? 0)}g`} color={MacroColors.fiber} />
        </View>
      </Card>

      {/* Estimated cost (only when at least one ingredient is priced) */}
      {cost ? (
        <Card style={{ gap: Spacing.two }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <ThemedText type="smallBold">Cost per serving</ThemedText>
            <ThemedText type="smallBold" style={{ color: MacroColors.calories }}>
              ${cost.perServing.toFixed(2)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            ${cost.total.toFixed(2)} total for {recipe.servings} serving{recipe.servings === 1 ? '' : 's'}
            {cost.pricedItems < cost.totalItems
              ? ` · estimate from ${cost.pricedItems} of ${cost.totalItems} priced ingredients`
              : ''}
          </ThemedText>
        </Card>
      ) : null}

      {/* Log to today */}
      <Card style={{ gap: Spacing.three }}>
        <ThemedText type="smallBold">Log to today</ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stepper value={servings} onChange={setServings} />
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round((per.calories ?? 0) * servings)} kcal · {Math.round((per.protein ?? 0) * servings)}g protein
          </ThemedText>
        </View>
        <Button title={logged ? 'Added to today ✓' : `Log ${trimNum(servings)} serving${servings === 1 ? '' : 's'}`} onPress={onLog} />
      </Card>

      {/* Rating */}
      <Card style={{ gap: Spacing.two }}>
        <ThemedText type="smallBold">How was it?</ThemedText>
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => updateRecipe(recipe.id, { rating: n })} hitSlop={4}>
              <Ionicons
                name={(recipe.rating ?? 0) >= n ? 'star' : 'star-outline'}
                size={30}
                color={(recipe.rating ?? 0) >= n ? '#E0A93B' : theme.textSecondary}
              />
            </Pressable>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Ratings power the “Top rated” sort on your Recipes tab.
        </ThemedText>
      </Card>

      {/* Ingredients */}
      <ThemedText type="smallBold">Ingredients ({recipe.items.length})</ThemedText>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {recipe.items.map((it, i) => {
          const ing = getIngredient(it.ingredientId);
          const kcal = ing ? scale(ing.per100g, it.grams).calories ?? 0 : 0;
          return (
            <View
              key={`${it.ingredientId}-${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: Spacing.three,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: theme.border,
              }}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{ing?.name ?? 'Unknown ingredient'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {trimNum(it.amount)} {it.unit} · {Math.round(it.grams)} g
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {Math.round(kcal)} kcal
              </ThemedText>
            </View>
          );
        })}
      </Card>

      {recipe.notes ? (
        <Card>
          <ThemedText type="small">{recipe.notes}</ThemedText>
        </Card>
      ) : null}

      <Button title="Delete recipe" variant="ghost" onPress={onDelete} style={{ marginTop: Spacing.two }} />
    </Screen>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const theme = useTheme();
  const btn = (label: string, delta: number) => (
    <Pressable
      onPress={() => onChange(Math.max(0.5, Math.round((value + delta) * 2) / 2))}
      style={{
        width: 40,
        height: 40,
        borderRadius: Radius.md,
        backgroundColor: theme.backgroundSelected,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>{label}</ThemedText>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
      {btn('−', -0.5)}
      <ThemedText style={{ fontSize: 20, fontWeight: '800', minWidth: 44, textAlign: 'center' }}>
        {trimNum(value)}
      </ThemedText>
      {btn('+', 0.5)}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View>
      <ThemedText style={{ fontSize: 22, fontWeight: '800', color }}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {label}
      </ThemedText>
    </View>
  );
}
