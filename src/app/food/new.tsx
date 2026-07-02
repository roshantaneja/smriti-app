import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Spacing } from '@/constants/theme';
import { useStore } from '@/lib/store';
import type { Ingredient, Nutrients, NutrientKey } from '@/lib/types';

const MACROS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
];

type Draft = Omit<Ingredient, 'id'>;

/** Seed the visible macro inputs from a prefilled per-100 g profile. */
function macroStrings(per100g: Nutrients): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of MACROS) {
    const v = per100g[m.key];
    if (typeof v === 'number') out[m.key] = String(v);
  }
  return out;
}

export default function NewIngredientScreen() {
  const addIngredient = useStore((s) => s.addIngredient);

  // Optional prefill from a barcode scan or an online search (JSON-encoded draft).
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const draft = useMemo<Draft | null>(() => {
    if (!prefill) return null;
    try {
      return JSON.parse(prefill) as Draft;
    } catch {
      return null;
    }
  }, [prefill]);

  const [name, setName] = useState(draft?.name ?? '');
  const [category, setCategory] = useState(draft?.category ?? '');
  const [vals, setVals] = useState<Record<string, string>>(() =>
    draft ? macroStrings(draft.per100g) : {},
  );
  const [portionUnit, setPortionUnit] = useState(draft?.portions?.[0]?.unit ?? '');
  const [portionGrams, setPortionGrams] = useState(
    draft?.portions?.[0] ? String(draft.portions[0].grams) : '',
  );
  const [priceAmount, setPriceAmount] = useState('');
  const [priceGrams, setPriceGrams] = useState('');

  const setVal = (k: string, t: string) => setVals((v) => ({ ...v, [k]: t.replace(/[^0-9.]/g, '') }));
  const number = (k: string) => Number(vals[k]) || 0;
  const canSave = name.trim().length > 0;

  const onSave = () => {
    if (!canSave) return;
    // Start from any imported micronutrients the form doesn't surface, then let
    // the visible macro fields win so hand edits always take effect.
    const per100g: Nutrients = { ...(draft?.per100g ?? {}) };
    for (const m of MACROS) {
      const v = number(m.key);
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
    addIngredient({
      name: name.trim(),
      category: category.trim() || 'Custom',
      per100g,
      portions,
      source: draft?.source ?? 'Manual entry',
      ...(draft?.barcode ? { barcode: draft.barcode } : {}),
      ...(draft?.fdcId ? { fdcId: draft.fdcId } : {}),
      ...(draft?.fdcDescription ? { fdcDescription: draft.fdcDescription } : {}),
      ...(price ? { price } : {}),
    });
    router.back();
  };

  return (
    <Screen
      scroll
      title="New ingredient"
      subtitle={draft ? `Imported from ${draft.source} · per 100 g` : 'Nutrition per 100 g'}
      edges={['bottom']}>
      <Card style={{ gap: Spacing.three }}>
        <Field label="Name" placeholder="e.g. Skinny Pop popcorn" value={name} onChangeText={setName} />
        <Field label="Category (optional)" placeholder="Snacks" value={category} onChangeText={setCategory} />
      </Card>

      <ThemedText type="smallBold">Per 100 g</ThemedText>
      <Card style={{ gap: Spacing.three }}>
        {MACROS.map((m) => (
          <Field
            key={m.key}
            label={m.label}
            suffix={m.unit}
            keyboardType="decimal-pad"
            value={vals[m.key] ?? ''}
            onChangeText={(t) => setVal(m.key, t)}
            placeholder="0"
          />
        ))}
      </Card>

      <ThemedText type="smallBold">Household serving (optional)</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Lets you log this by the unit you actually use (e.g. 1 cup) instead of grams.
      </ThemedText>
      <Card>
        <View style={{ flexDirection: 'row', gap: Spacing.three }}>
          <Field label="Unit" placeholder="cup" value={portionUnit} onChangeText={setPortionUnit} />
          <Field label="Grams" suffix="g" keyboardType="decimal-pad" value={portionGrams} onChangeText={(t) => setPortionGrams(t.replace(/[^0-9.]/g, ''))} placeholder="0" />
        </View>
      </Card>

      <ThemedText type="smallBold">Price (optional)</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        What you paid and for how many grams — powers cost-per-serving on recipes (e.g. $3.50 per 500 g).
      </ThemedText>
      <Card>
        <View style={{ flexDirection: 'row', gap: Spacing.three }}>
          <Field label="Price" suffix="$" keyboardType="decimal-pad" value={priceAmount} onChangeText={(t) => setPriceAmount(t.replace(/[^0-9.]/g, ''))} placeholder="0.00" />
          <Field label="For" suffix="g" keyboardType="decimal-pad" value={priceGrams} onChangeText={(t) => setPriceGrams(t.replace(/[^0-9.]/g, ''))} placeholder="0" />
        </View>
      </Card>

      <Button title="Save ingredient" onPress={onSave} disabled={!canSave} />
    </Screen>
  );
}
