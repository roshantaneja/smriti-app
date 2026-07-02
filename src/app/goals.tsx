import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Chip } from '@/components/ui/segmented';
import { MacroColors, Spacing } from '@/constants/theme';
import { MICROS } from '@/lib/nutrition';
import { PRESETS } from '@/lib/presets';
import { useStore } from '@/lib/store';
import type { Goals, Weekday } from '@/lib/types';

const FIELDS: { key: keyof Goals; label: string; unit: string; color?: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', color: MacroColors.calories },
  { key: 'protein', label: 'Protein', unit: 'g', color: MacroColors.protein },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: MacroColors.carbs },
  { key: 'fat', label: 'Fat', unit: 'g', color: MacroColors.fat },
  { key: 'fiber', label: 'Fiber', unit: 'g', color: MacroColors.fiber },
  { key: 'waterMl', label: 'Water', unit: 'ml' },
];

// Monday-first, matching the planner's weeks.
const DAYS: { key: Weekday; label: string; name: string }[] = [
  { key: 'mon', label: 'Mon', name: 'Monday' },
  { key: 'tue', label: 'Tue', name: 'Tuesday' },
  { key: 'wed', label: 'Wed', name: 'Wednesday' },
  { key: 'thu', label: 'Thu', name: 'Thursday' },
  { key: 'fri', label: 'Fri', name: 'Friday' },
  { key: 'sat', label: 'Sat', name: 'Saturday' },
  { key: 'sun', label: 'Sun', name: 'Sunday' },
];

const emptyDayDraft = () =>
  Object.fromEntries(FIELDS.map((f) => [f.key, ''])) as Record<keyof Goals, string>;

export default function GoalsScreen() {
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);

  const setPreset = useStore((s) => s.setPreset);
  const goalOverrides = useStore((s) => s.goalOverrides);
  const setGoalOverride = useStore((s) => s.setGoalOverride);
  const pinnedNutrients = useStore((s) => s.pinnedNutrients);
  const togglePinnedNutrient = useStore((s) => s.togglePinnedNutrient);

  const [draft, setDraft] = useState<Record<keyof Goals, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, String(goals[f.key])])) as Record<keyof Goals, string>,
  );
  const [saved, setSaved] = useState(false);
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Weekday | null>(null);
  const [dayDraft, setDayDraft] = useState<Record<keyof Goals, string>>(emptyDayDraft);
  const [daySaved, setDaySaved] = useState(false);

  const num = (k: keyof Goals) => Math.max(0, Math.round(Number(draft[k]) || 0));
  const macroCalories = num('protein') * 4 + num('carbs') * 4 + num('fat') * 9;
  const delta = macroCalories - num('calories');

  const onSave = () => {
    const next = Object.fromEntries(FIELDS.map((f) => [f.key, num(f.key)])) as unknown as Goals;
    setGoals(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const applyPreset = (goalsForPreset: Goals, name: string) => {
    setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, String(goalsForPreset[f.key])])) as Record<keyof Goals, string>);
    setPreset(goalsForPreset);
    setAppliedPreset(name);
    setTimeout(() => setAppliedPreset(null), 1800);
  };

  const openDay = (day: Weekday) => {
    if (selectedDay === day) {
      setSelectedDay(null);
      return;
    }
    const override = goalOverrides[day] ?? {};
    setDayDraft(
      Object.fromEntries(
        FIELDS.map((f) => [f.key, override[f.key] != null ? String(override[f.key]) : '']),
      ) as Record<keyof Goals, string>,
    );
    setSelectedDay(day);
  };

  const saveDay = () => {
    if (!selectedDay) return;
    const patch: Partial<Goals> = {};
    for (const f of FIELDS) {
      const text = dayDraft[f.key].trim();
      if (text !== '') patch[f.key] = Math.max(0, Math.round(Number(text) || 0));
    }
    setGoalOverride(selectedDay, patch); // empty patch clears the day
    setDaySaved(true);
    setTimeout(() => setDaySaved(false), 1500);
  };

  const clearDay = () => {
    if (!selectedDay) return;
    setGoalOverride(selectedDay, null);
    setDayDraft(emptyDayDraft());
  };

  return (
    <Screen title="Goals" subtitle="Your daily targets">
      <Card style={{ gap: Spacing.two }}>
        <ThemedText type="smallBold">Apply a preset</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {appliedPreset ? `Applied ${appliedPreset} ✓` : 'A starting point you can then fine-tune below.'}
        </ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
          {PRESETS.map((p) => (
            <Chip key={p.id} label={p.name} onPress={() => applyPreset(p.goals, p.name)} />
          ))}
        </View>
      </Card>

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

      <Card style={{ gap: Spacing.two }}>
        <ThemedText type="smallBold">Weekly schedule</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Set different targets for training or rest days. Blank fields inherit your base goals.
        </ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
          {DAYS.map((d) => (
            <Chip
              key={d.key}
              label={d.label}
              active={selectedDay === d.key || goalOverrides[d.key] != null}
              onPress={() => openDay(d.key)}
            />
          ))}
        </View>
        {selectedDay ? (
          <View style={{ gap: Spacing.three, marginTop: Spacing.one }}>
            <ThemedText type="smallBold">{DAYS.find((d) => d.key === selectedDay)?.name}</ThemedText>
            {FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                suffix={f.unit}
                keyboardType="number-pad"
                placeholder={String(goals[f.key])}
                value={dayDraft[f.key]}
                onChangeText={(t) => setDayDraft((d) => ({ ...d, [f.key]: t.replace(/[^0-9]/g, '') }))}
              />
            ))}
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button
                title={daySaved ? 'Saved ✓' : 'Save day'}
                size="sm"
                style={{ flex: 1 }}
                onPress={saveDay}
              />
              <Button title="Clear day" variant="ghost" size="sm" style={{ flex: 1 }} onPress={clearDay} />
            </View>
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: Spacing.two }}>
        <ThemedText type="smallBold">Pin nutrients</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Pinned nutrients appear as tiles on Today, right under your macros.
        </ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
          {MICROS.map((m) => (
            <Chip
              key={m.key}
              label={m.label}
              active={pinnedNutrients.includes(m.key)}
              onPress={() => togglePinnedNutrient(m.key)}
            />
          ))}
        </View>
      </Card>

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
