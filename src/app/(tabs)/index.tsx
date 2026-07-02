import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Field } from '@/components/ui/field';
import { Bar, MacroProgress } from '@/components/ui/progress';
import { Ring } from '@/components/ui/ring';
import { Segmented } from '@/components/ui/segmented';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, dayLabel } from '@/lib/date';
import { entrySubtitle, entryTitle, trimNum } from '@/lib/format';
import { addDays } from '@/lib/grocery';
import { MICROS, resolveEntryNutrients, totalForEntries, totalWater } from '@/lib/nutrition';
import { useStore } from '@/lib/store';
import type { LogEntry, MealType, SavedMealItem } from '@/lib/types';

const MEAL_ORDER: { meal: MealType; label: string }[] = [
  { meal: 'breakfast', label: 'Breakfast' },
  { meal: 'lunch', label: 'Lunch' },
  { meal: 'dinner', label: 'Dinner' },
  { meal: 'snack', label: 'Snacks' },
];

const MEALS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
];

/** Map one meal section's (non-water) entries to saved-meal template items. */
function toSavedMealItems(items: LogEntry[]): SavedMealItem[] {
  return items.map((e) =>
    e.kind === 'ingredient'
      ? { kind: 'ingredient' as const, ingredientId: e.ingredientId, grams: e.grams, label: e.label }
      : e.kind === 'recipe'
        ? { kind: 'recipe' as const, recipeId: e.recipeId, servings: e.servings, label: e.label }
        : { kind: 'quick' as const, label: e.label, nutrients: e.nutrients },
  );
}

export default function TodayScreen() {
  const theme = useTheme();
  const today = dayKey();
  const yesterday = addDays(today, -1);

  const log = useStore((s) => s.log);
  const goals = useStore((s) => s.goals);
  const getIngredient = useStore((s) => s.getIngredient);
  const getRecipe = useStore((s) => s.getRecipe);
  const addWater = useStore((s) => s.addWater);
  const deleteLogEntry = useStore((s) => s.deleteLogEntry);
  const copyLogEntries = useStore((s) => s.copyLogEntries);
  const addSavedMeal = useStore((s) => s.addSavedMeal);

  const [microsOpen, setMicrosOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Android fallback for the iOS-only Alert.prompt "Save as meal…" flow.
  const [savingMeal, setSavingMeal] = useState<MealType | null>(null);
  const [mealName, setMealName] = useState('');

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
      }),
    [entries, ctx],
  );

  // Which meals yesterday has food entries for — drives the "Copy yesterday" buttons.
  const yesterdayMeals = useMemo(() => {
    const meals = new Set<MealType>();
    for (const e of log) {
      if (e.date === yesterday && e.kind !== 'water') meals.add(e.meal ?? 'snack');
    }
    return meals;
  }, [log, yesterday]);

  // Consecutive days with ≥1 food entry, ending today (or yesterday, so the
  // streak survives until today's first log).
  const streak = useMemo(() => {
    const days = new Set<string>();
    for (const e of log) {
      if (e.kind !== 'water') days.add(e.date);
    }
    let d = days.has(today) ? today : yesterday;
    let n = 0;
    while (days.has(d)) {
      n += 1;
      d = addDays(d, -1);
    }
    return n;
  }, [log, today, yesterday]);

  const saveSection = (meal: MealType, label: string, items: LogEntry[]) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Save as meal',
        `Name this ${label.toLowerCase()} to log the whole set again in one tap.`,
        (name) => {
          const trimmed = name?.trim();
          if (trimmed) addSavedMeal(trimmed, toSavedMealItems(items));
        },
      );
    } else {
      setMealName('');
      setSavingMeal(meal);
    }
  };

  return (
    <Screen
      title="Today"
      subtitle={dayLabel(today)}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
          </Pressable>
          <Button title="+ Add" size="sm" onPress={() => router.push('/log-add')} />
        </View>
      }>
      {streak >= 2 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one }}>
          <Ionicons name="flame" size={16} color={MacroColors.protein} />
          <ThemedText type="small" themeColor="textSecondary">
            {streak}-day streak
          </ThemedText>
        </View>
      ) : null}

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
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: Spacing.three,
          }}>
          <Ring label="Calories" value={kcal} goal={goals.calories} unit="kcal" color={MacroColors.calories} size={64} />
          <Ring label="Protein" value={totals.protein ?? 0} goal={goals.protein} unit="g" color={MacroColors.protein} size={64} />
          <Ring label="Carbs" value={totals.carbs ?? 0} goal={goals.carbs} unit="g" color={MacroColors.carbs} size={64} />
          <Ring label="Fat" value={totals.fat ?? 0} goal={goals.fat} unit="g" color={MacroColors.fat} size={64} />
        </View>
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
      ) : null}
      {sections.map((section) => {
        if (section.items.length === 0) {
          // Empty meal: offer to copy yesterday's, when yesterday has one.
          if (!yesterdayMeals.has(section.meal)) return null;
          return (
            <View key={section.meal} style={{ gap: Spacing.two }}>
              <ThemedText type="smallBold">{section.label}</ThemedText>
              <Button
                title={`Copy yesterday's ${section.label.toLowerCase()}`}
                variant="ghost"
                size="sm"
                onPress={() => copyLogEntries(yesterday, today, section.meal)}
              />
            </View>
          );
        }
        return (
          <View key={section.meal} style={{ gap: Spacing.two }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <ThemedText type="smallBold">{section.label}</ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                <Pressable
                  onPress={() => saveSection(section.meal, section.label, section.items)}
                  hitSlop={8}
                  accessibilityRole="button">
                  <ThemedText type="small" style={{ color: theme.tint, fontWeight: '700' }}>
                    Save as meal…
                  </ThemedText>
                </Pressable>
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.round(section.kcal)} kcal
                </ThemedText>
              </View>
            </View>
            {savingMeal === section.meal ? (
              <Card style={{ gap: Spacing.two }}>
                <Field
                  label="Meal name"
                  placeholder={`e.g. Usual ${section.label.toLowerCase()}`}
                  value={mealName}
                  onChangeText={setMealName}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => setSavingMeal(null)}
                  />
                  <Button
                    title="Save meal"
                    size="sm"
                    style={{ flex: 1 }}
                    disabled={!mealName.trim()}
                    onPress={() => {
                      addSavedMeal(mealName.trim(), toSavedMealItems(section.items));
                      setSavingMeal(null);
                    }}
                  />
                </View>
              </Card>
            ) : null}
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
                    first={i === 0}
                    expanded={editingId === e.id}
                    onToggle={() => setEditingId((cur) => (cur === e.id ? null : e.id))}
                    onDelete={() => deleteLogEntry(e.id)}
                  />
                ))}
            </Card>
          </View>
        );
      })}

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
                  first={i === 0}
                  onDelete={() => deleteLogEntry(e.id)}
                />
              ))}
          </Card>
        </View>
      ) : null}

      <NoteCard date={today} />
    </Screen>
  );
}

function LogRow({
  entry,
  kcal,
  title,
  subtitle,
  first,
  expanded,
  onToggle,
  onDelete,
}: {
  entry: LogEntry;
  kcal: number;
  title: string;
  subtitle: string;
  first: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const icon =
    entry.kind === 'recipe' ? 'restaurant'
    : entry.kind === 'water' ? 'water'
    : entry.kind === 'quick' ? 'flash'
    : 'nutrition';
  // Water rows are delete-only; food rows expand into the inline editor.
  const editable = entry.kind !== 'water';
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: theme.border }}>
      <Pressable
        onPress={editable ? onToggle : undefined}
        accessibilityRole={editable ? 'button' : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three }}>
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
        {editable ? (
          <ThemedText type="smallBold" themeColor="textSecondary">
            {Math.round(kcal)} kcal
          </ThemedText>
        ) : null}
        {editable ? (
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
        ) : (
          <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="Remove entry">
            <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
          </Pressable>
        )}
      </Pressable>
      {editable && expanded ? <EntryEditor entry={entry} onDone={onToggle} /> : null}
    </View>
  );
}

/** Inline editor for a logged entry: portion, meal move, delete. */
function EntryEditor({ entry, onDone }: { entry: LogEntry; onDone?: () => void }) {
  const updateLogEntry = useStore((s) => s.updateLogEntry);
  const deleteLogEntry = useStore((s) => s.deleteLogEntry);

  const initial = entry.kind === 'ingredient' ? entry.grams ?? 0 : entry.servings ?? 1;
  const [amount, setAmount] = useState(trimNum(initial));
  const hasAmount = entry.kind === 'ingredient' || entry.kind === 'recipe';
  const next = Number(amount) || 0;

  return (
    <View style={{ paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two }}>
      {hasAmount ? (
        <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' }}>
          <View style={{ width: 120 }}>
            <Field
              label={entry.kind === 'ingredient' ? 'Amount (g)' : 'Servings'}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
            />
          </View>
          <Button
            title="Update"
            size="sm"
            disabled={!(next > 0) || next === initial}
            onPress={() => {
              updateLogEntry(entry.id, entry.kind === 'ingredient' ? { grams: next } : { servings: next });
              onDone?.();
            }}
          />
        </View>
      ) : null}
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="small" themeColor="textSecondary">
          Meal
        </ThemedText>
        <Segmented
          options={MEALS}
          value={entry.meal ?? 'snack'}
          onChange={(m) => updateLogEntry(entry.id, { meal: m })}
        />
      </View>
      <Button title="Delete entry" variant="danger" size="sm" onPress={() => deleteLogEntry(entry.id)} />
    </View>
  );
}

/** Collapsible free-text journal for the day, saved on blur/submit. */
function NoteCard({ date }: { date: string }) {
  const theme = useTheme();
  const note = useStore((s) => s.notes[date] ?? '');
  const setNote = useStore((s) => s.setNote);

  const [open, setOpen] = useState(note.length > 0);
  const [draft, setDraft] = useState(note);

  return (
    <Card style={{ gap: open ? Spacing.two : 0 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Ionicons name="create-outline" size={18} color={theme.textSecondary} />
          <ThemedText type="smallBold">Note</ThemedText>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </Pressable>
      {open ? (
        <Field
          placeholder="Add a note about today…"
          value={draft}
          onChangeText={setDraft}
          returnKeyType="done"
          onBlur={() => setNote(date, draft)}
          onSubmitEditing={() => setNote(date, draft)}
        />
      ) : null}
    </Card>
  );
}
