import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Spacing } from '@/constants/theme';
import { useStore } from '@/lib/store';
import type { NutrientKey } from '@/lib/types';

const MACROS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
];

export default function NewIngredientScreen() {
  const addIngredient = useStore((s) => s.addIngredient);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [portionUnit, setPortionUnit] = useState('');
  const [portionGrams, setPortionGrams] = useState('');

  const setVal = (k: string, t: string) => setVals((v) => ({ ...v, [k]: t.replace(/[^0-9.]/g, '') }));
  const number = (k: string) => Number(vals[k]) || 0;
  const canSave = name.trim().length > 0;

  const onSave = () => {
    if (!canSave) return;
    const per100g = Object.fromEntries(
      MACROS.map((m) => [m.key, number(m.key)]).filter(([, v]) => (v as number) > 0),
    );
    const portions =
      portionUnit.trim() && Number(portionGrams) > 0
        ? [{ unit: portionUnit.trim(), grams: Number(portionGrams) }]
        : [];
    addIngredient({
      name: name.trim(),
      category: category.trim() || 'Custom',
      per100g,
      portions,
      source: 'Manual entry',
    });
    router.back();
  };

  return (
    <Screen scroll title="New ingredient" subtitle="Nutrition per 100 g" edges={['bottom']}>
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

      <Button title="Save ingredient" onPress={onSave} disabled={!canSave} />
    </Screen>
  );
}
