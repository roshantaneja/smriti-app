import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { MacroColors, Spacing } from '@/constants/theme';
import { useStore } from '@/lib/store';
import type { Goals } from '@/lib/types';

const FIELDS: { key: keyof Goals; label: string; unit: string; color?: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', color: MacroColors.calories },
  { key: 'protein', label: 'Protein', unit: 'g', color: MacroColors.protein },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: MacroColors.carbs },
  { key: 'fat', label: 'Fat', unit: 'g', color: MacroColors.fat },
  { key: 'fiber', label: 'Fiber', unit: 'g', color: MacroColors.fiber },
  { key: 'waterMl', label: 'Water', unit: 'ml' },
];

export default function GoalsScreen() {
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);

  const [draft, setDraft] = useState<Record<keyof Goals, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, String(goals[f.key])])) as Record<keyof Goals, string>,
  );
  const [saved, setSaved] = useState(false);

  const num = (k: keyof Goals) => Math.max(0, Math.round(Number(draft[k]) || 0));
  const macroCalories = num('protein') * 4 + num('carbs') * 4 + num('fat') * 9;
  const delta = macroCalories - num('calories');

  const onSave = () => {
    const next = Object.fromEntries(FIELDS.map((f) => [f.key, num(f.key)])) as unknown as Goals;
    setGoals(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Screen title="Goals" subtitle="Your daily targets">
      <Card style={{ gap: Spacing.three }}>
        {FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            suffix={f.unit}
            keyboardType="number-pad"
            value={draft[f.key]}
            onChangeText={(t) => setDraft((d) => ({ ...d, [f.key]: t.replace(/[^0-9]/g, '') }))}
          />
        ))}
      </Card>

      <Card style={{ gap: Spacing.two }}>
        <ThemedText type="smallBold">Macro math check</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your macros add up to {macroCalories} kcal
          {Math.abs(delta) <= 50
            ? ' — nicely aligned with your calorie goal.'
            : delta > 0
              ? `, which is ${delta} over your calorie goal.`
              : `, which is ${Math.abs(delta)} under your calorie goal.`}
        </ThemedText>
      </Card>

      <Button title={saved ? 'Saved ✓' : 'Save goals'} onPress={onSave} />

      <Card style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold">About Smriti</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Everything is stored on this device — no account, no cloud. Built for home cooks: log meals from
          your own recipes in one tap. Nutrition seed data from USDA FoodData Central.
        </ThemedText>
      </Card>

      <View style={{ height: Spacing.two }} />
    </Screen>
  );
}
