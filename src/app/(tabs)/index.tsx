import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Bar, MacroProgress } from '@/components/ui/progress';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, dayLabel } from '@/lib/date';
import { entrySubtitle, entryTitle } from '@/lib/format';
import { MICROS, resolveEntryNutrients, totalForEntries, totalWater } from '@/lib/nutrition';
import { useStore } from '@/lib/store';
import type { LogEntry, MealType } from '@/lib/types';

const MEAL_ORDER: { meal: MealType; label: string }[] = [
  { meal: 'breakfast', label: 'Breakfast' },
  { meal: 'lunch', label: 'Lunch' },
  { meal: 'dinner', label: 'Dinner' },
  { meal: 'snack', label: 'Snacks' },
];

export default function TodayScreen() {
  const theme = useTheme();
  const today = dayKey();

  const log = useStore((s) => s.log);
  const goals = useStore((s) => s.goals);
  const getIngredient = useStore((s) => s.getIngredient);
  const getRecipe = useStore((s) => s.getRecipe);
  const addWater = useStore((s) => s.addWater);
  const deleteLogEntry = useStore((s) => s.deleteLogEntry);

  const [microsOpen, setMicrosOpen] = useState(false);

  const entries = useMemo(() => log.filter((e) => e.date === today), [log, today]);
  const ctx = useMemo(() => ({ getIngredient, getRecipe }), [getIngredient, getRecipe]);
  const totals = useMemo(() => totalForEntries(entries, ctx), [entries, ctx]);
  const water = useMemo(() => totalWater(entries), [entries]);

  const kcal = totals.calories ?? 0;

  const waterEntries = useMemo(() => entries.filter((e) => e.kind === 'water'), [entries]);
  // Group food entries by meal; legacy/unset entries fall into Snacks.
  const sections = useMemo(
    () =>
      MEAL_ORDER.map((m) => {
        const items = entries.filter((e) => e.kind !== 'water' && (e.meal ?? 'snack') === m.meal);
        const kcalSum = items.reduce((acc, e) => acc + (resolveEntryNutrients(e, ctx).calories ?? 0), 0);
        return { ...m, items, kcal: kcalSum };
      }).filter((s) => s.items.length > 0),
    [entries, ctx],
  );

  return (
    <Screen
      title="Today"
      subtitle={dayLabel(today)}
      right={
        <Button title="+ Add" size="sm" onPress={() => router.push('/log-add')} />
      }>
      {/* Calorie hero */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <ThemedText type="small" themeColor="textSecondary">
            Calories
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {Math.max(0, Math.round(goals.calories - kcal))} kcal left
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, marginVertical: Spacing.one }}>
          <ThemedText style={{ fontSize: 44, fontWeight: '800', color: MacroColors.calories }}>
            {Math.round(kcal)}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            / {goals.calories} kcal
          </ThemedText>
        </View>
        <Bar value={kcal} goal={goals.calories} color={MacroColors.calories} height={10} />
      </Card>

      {/* Macros */}
      <Card style={{ gap: Spacing.three }}>
        <MacroProgress label="Protein" value={totals.protein ?? 0} goal={goals.protein} unit="g" color={MacroColors.protein} />
        <MacroProgress label="Carbs" value={totals.carbs ?? 0} goal={goals.carbs} unit="g" color={MacroColors.carbs} />
        <MacroProgress label="Fat" value={totals.fat ?? 0} goal={goals.fat} unit="g" color={MacroColors.fat} />
        <MacroProgress label="Fiber" value={totals.fiber ?? 0} goal={goals.fiber} unit="g" color={MacroColors.fiber} />
      </Card>

      {/* Micronutrients (collapsible) */}
      <Card style={{ gap: microsOpen ? Spacing.two : 0 }}>
        <Pressable
          onPress={() => setMicrosOpen((v) => !v)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ThemedText type="smallBold">More nutrients</ThemedText>
          <Ionicons name={microsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
        </Pressable>
        {microsOpen ? (
          <View style={{ gap: Spacing.one }}>
            {MICROS.map((m) => (
              <View
                key={m.key}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText type="small" themeColor="textSecondary">
                  {m.label}
                </ThemedText>
                <ThemedText type="small">
                  {Math.round(totals[m.key] ?? 0)} {m.unit}
                </ThemedText>
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, marginTop: Spacing.one }}>
              Totals across everything logged today. Availability depends on each food&apos;s data.
            </ThemedText>
          </View>
        ) : null}
      </Card>

      {/* Water */}
      <Card style={{ gap: Spacing.two }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Ionicons name="water-outline" size={18} color={theme.water} />
            <ThemedText type="smallBold">Water</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {water} / {goals.waterMl} ml
          </ThemedText>
        </View>
        <Bar value={water} goal={goals.waterMl} color={theme.water} />
        <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one }}>
          <Button title="+250 ml" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => addWater(250)} />
          <Button title="+500 ml" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => addWater(500)} />
        </View>
      </Card>

      {/* Log */}
      <ThemedText type="subtitle" style={{ fontSize: 20, lineHeight: 26 }}>
        Logged
      </ThemedText>
      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon="restaurant-outline"
            title="Nothing logged yet"
            message="Tap + Add to log a meal, an ingredient, a quick snack, or water."
          />
        </Card>
      ) : (
        <>
          {sections.map((section) => (
            <View key={section.meal} style={{ gap: Spacing.two }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <ThemedText type="smallBold">{section.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.round(section.kcal)} kcal
                </ThemedText>
              </View>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {section.items
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <LogRow
                      key={e.id}
                      entry={e}
                      kcal={resolveEntryNutrients(e, ctx).calories ?? 0}
                      title={entryTitle(e, ctx)}
                      subtitle={entrySubtitle(e)}
                      onDelete={() => deleteLogEntry(e.id)}
                      first={i === 0}
                    />
                  ))}
              </Card>
            </View>
          ))}

          {waterEntries.length > 0 ? (
            <View style={{ gap: Spacing.two }}>
              <ThemedText type="smallBold">Water</ThemedText>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {waterEntries
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <LogRow
                      key={e.id}
                      entry={e}
                      kcal={0}
                      title={entryTitle(e, ctx)}
                      subtitle={entrySubtitle(e)}
                      onDelete={() => deleteLogEntry(e.id)}
                      first={i === 0}
                    />
                  ))}
              </Card>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function LogRow({
  entry,
  kcal,
  title,
  subtitle,
  onDelete,
  first,
}: {
  entry: LogEntry;
  kcal: number;
  title: string;
  subtitle: string;
  onDelete: () => void;
  first: boolean;
}) {
  const theme = useTheme();
  const icon =
    entry.kind === 'recipe' ? 'restaurant'
    : entry.kind === 'water' ? 'water'
    : entry.kind === 'quick' ? 'flash'
    : 'nutrition';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        padding: Spacing.three,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.border,
      }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: Radius.sm,
          backgroundColor: theme.tintSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={18} color={theme.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      {entry.kind !== 'water' ? (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {Math.round(kcal)} kcal
        </ThemedText>
      ) : null}
      <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="Remove entry">
        <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}
