import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { MacroColors, Spacing } from '@/constants/theme';
import { MICROS } from '@/lib/nutrition';
import { useStore } from '@/lib/store';
import type { Ingredient, NutrientKey, Nutrients } from '@/lib/types';

const MACROS: { key: NutrientKey; label: string; unit: string; color: string }[] = [
  { key: 'calories', label: 'kcal', unit: '', color: MacroColors.calories },
  { key: 'protein', label: 'protein', unit: 'g', color: MacroColors.protein },
  { key: 'carbs', label: 'carbs', unit: 'g', color: MacroColors.carbs },
  { key: 'fat', label: 'fat', unit: 'g', color: MacroColors.fat },
  { key: 'fiber', label: 'fiber', unit: 'g', color: MacroColors.fiber },
];

/** Field labels for the user-ingredient editor (same set food/new.tsx edits). */
const EDIT_MACROS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
];

export default function IngredientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const getIngredient = useStore((s) => s.getIngredient);
  const userIngredients = useStore((s) => s.userIngredients);
  const ing = getIngredient(id);
  // Seed ingredients stay read-only; only the user's own foods are editable.
  const isUserIngredient = userIngredients.some((i) => i.id === id);

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

      {isUserIngredient ? <EditorSection ing={ing} /> : null}
    </Screen>
  );
}

/** Edit/delete for the user's own ingredients (never rendered for seed foods). */
function EditorSection({ ing }: { ing: Ingredient }) {
  const updateIngredient = useStore((s) => s.updateIngredient);
  const deleteIngredient = useStore((s) => s.deleteIngredient);

  const [name, setName] = useState(ing.name);
  const [category, setCategory] = useState(ing.category);
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const m of EDIT_MACROS) {
      const v = ing.per100g[m.key];
      if (typeof v === 'number') out[m.key] = String(v);
    }
    return out;
  });
  const [portionUnit, setPortionUnit] = useState(ing.portions[0]?.unit ?? '');
  const [portionGrams, setPortionGrams] = useState(
    ing.portions[0] ? String(ing.portions[0].grams) : '',
  );
  const [priceAmount, setPriceAmount] = useState(ing.price ? String(ing.price.amount) : '');
  const [priceGrams, setPriceGrams] = useState(ing.price ? String(ing.price.grams) : '');

  const setVal = (k: string, t: string) => setVals((v) => ({ ...v, [k]: t.replace(/[^0-9.]/g, '') }));
  const canSave = name.trim().length > 0;

  const onSave = () => {
    if (!canSave) return;
    // Keep any micronutrients the form doesn't surface; the visible macro
    // fields win so hand edits always take effect (same as food/new.tsx).
    const per100g: Nutrients = { ...ing.per100g };
    for (const m of EDIT_MACROS) {
      const v = Number(vals[m.key]) || 0;
      if (v > 0) per100g[m.key] = v;
      else delete per100g[m.key];
    }
    const portions =
      portionUnit.trim() && Number(portionGrams) > 0
        ? [{ unit: portionUnit.trim(), grams: Number(portionGrams) }]
        : [];
    const price =
      Number(priceAmount) > 0 && Number(priceGrams) > 0
        ? { amount: Number(priceAmount), grams: Number(priceGrams) }
        : undefined;
    updateIngredient(ing.id, {
      name: name.trim(),
      category: category.trim() || 'Custom',
      per100g,
      portions,
      price,
    });
  };

  const onDelete = () => {
    Alert.alert(
      'Delete ingredient',
      `Delete “${ing.name}”? Recipes, plans, and pantry entries that use it will show it as missing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteIngredient(ing.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={{ gap: Spacing.three, marginTop: Spacing.two }}>
      <ThemedText type="smallBold">Edit ingredient</ThemedText>
      <Card style={{ gap: Spacing.three }}>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Category" placeholder="Custom" value={category} onChangeText={setCategory} />
        {EDIT_MACROS.map((m) => (
          <Field
            key={m.key}
            label={`${m.label} (per 100 g)`}
            suffix={m.unit}
            keyboardType="decimal-pad"
            placeholder="0"
            value={vals[m.key] ?? ''}
            onChangeText={(t) => setVal(m.key, t)}
          />
        ))}
        <View style={{ flexDirection: 'row', gap: Spacing.three }}>
          <Field label="Portion unit" placeholder="cup" value={portionUnit} onChangeText={setPortionUnit} />
          <Field
            label="Grams"
            suffix="g"
            keyboardType="decimal-pad"
            placeholder="0"
            value={portionGrams}
            onChangeText={(t) => setPortionGrams(t.replace(/[^0-9.]/g, ''))}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.three }}>
          <Field
            label="Price"
            suffix="$"
            keyboardType="decimal-pad"
            placeholder="0.00"
            value={priceAmount}
            onChangeText={(t) => setPriceAmount(t.replace(/[^0-9.]/g, ''))}
          />
          <Field
            label="For"
            suffix="g"
            keyboardType="decimal-pad"
            placeholder="0"
            value={priceGrams}
            onChangeText={(t) => setPriceGrams(t.replace(/[^0-9.]/g, ''))}
          />
        </View>
        <Button title="Save changes" onPress={onSave} disabled={!canSave} />
      </Card>
      <Button title="Delete ingredient" variant="danger" onPress={onDelete} />
    </View>
  );
}
