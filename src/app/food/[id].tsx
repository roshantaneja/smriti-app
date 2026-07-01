import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MacroColors, Spacing } from '@/constants/theme';
import { MICROS } from '@/lib/nutrition';
import { useStore } from '@/lib/store';
import type { NutrientKey } from '@/lib/types';

const MACROS: { key: NutrientKey; label: string; unit: string; color: string }[] = [
  { key: 'calories', label: 'kcal', unit: '', color: MacroColors.calories },
  { key: 'protein', label: 'protein', unit: 'g', color: MacroColors.protein },
  { key: 'carbs', label: 'carbs', unit: 'g', color: MacroColors.carbs },
  { key: 'fat', label: 'fat', unit: 'g', color: MacroColors.fat },
  { key: 'fiber', label: 'fiber', unit: 'g', color: MacroColors.fiber },
];

export default function IngredientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const getIngredient = useStore((s) => s.getIngredient);
  const ing = getIngredient(id);

  if (!ing) {
    return (
      <Screen title="Ingredient" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Ingredient' }} />
        <ThemedText type="small" themeColor="textSecondary">
          This ingredient no longer exists.
        </ThemedText>
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const p = ing.per100g;

  return (
    <Screen scroll title={ing.name} subtitle={`${ing.category} · per 100 g`} edges={['bottom']}>
      <Stack.Screen options={{ title: ing.name }} />

      {/* Headline macros */}
      <Card style={{ gap: Spacing.three }}>
        <ThemedText type="smallBold">Macros per 100 g</ThemedText>
        <View style={{ flexDirection: 'row', gap: Spacing.four, flexWrap: 'wrap' }}>
          {MACROS.map((m) => (
            <View key={m.key}>
              <ThemedText style={{ fontSize: 22, fontWeight: '800', color: m.color }}>
                {Math.round(p[m.key] ?? 0)}
                {m.unit}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {m.label}
              </ThemedText>
            </View>
          ))}
        </View>
      </Card>

      {/* Micronutrients */}
      <Card style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold" style={{ marginBottom: Spacing.one }}>
          Micronutrients per 100 g
        </ThemedText>
        {MICROS.map((m) => (
          <View
            key={m.key}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText type="small" themeColor="textSecondary">
              {m.label}
            </ThemedText>
            <ThemedText type="small">
              {p[m.key] != null ? `${Math.round(p[m.key] as number)} ${m.unit}` : '—'}
            </ThemedText>
          </View>
        ))}
      </Card>

      {/* Household portions */}
      {ing.portions.length > 0 ? (
        <Card style={{ gap: Spacing.one }}>
          <ThemedText type="smallBold" style={{ marginBottom: Spacing.one }}>
            Household measures
          </ThemedText>
          {ing.portions.map((portion) => (
            <View
              key={portion.unit}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText type="small" themeColor="textSecondary">
                1 {portion.unit}
              </ThemedText>
              <ThemedText type="small">{Math.round(portion.grams)} g</ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Price */}
      {ing.price && ing.price.grams > 0 ? (
        <Card style={{ gap: Spacing.one }}>
          <ThemedText type="smallBold">Price</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            ${ing.price.amount.toFixed(2)} per {Math.round(ing.price.grams)} g
            {`  ·  $${((ing.price.amount / ing.price.grams) * 100).toFixed(2)} / 100 g`}
          </ThemedText>
        </Card>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        Source: {ing.source}
      </ThemedText>

      <Button title="Add to today" variant="secondary" onPress={() => router.push('/log-add')} style={{ marginTop: Spacing.two }} />
    </Screen>
  );
}
