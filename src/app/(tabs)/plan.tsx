import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Chip, Segmented } from '@/components/ui/segmented';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, dayLabel } from '@/lib/date';
import { trimNum } from '@/lib/format';
import { addDays, planDayNutrients, weekDays, weekStart } from '@/lib/grocery';
import { computeEntryNutrients } from '@/lib/nutrition';
import { SEED_INGREDIENTS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Ingredient, MealType, PlanEntry, Recipe } from '@/lib/types';

const MEALS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
];
const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** "Jun 29 – Jul 5" for a week's first/last day keys. */
function rangeLabel(first: string, last: string): string {
  const fmt = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return `${fmt(first)} – ${fmt(last)}`;
}

export default function PlanScreen() {
  const theme = useTheme();
  const [weekOffset, setWeekOffset] = useState(0);
  // Remember the last grams entered so planning staples ("150 g rice" every
  // night) doesn't mean retyping the amount each time. UI default only.
  const lastGramsRef = useRef(100);

  const startKey = useMemo(() => addDays(weekStart(dayKey()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => weekDays(startKey), [startKey]);

  const plan = useStore((s) => s.plan);
  const menus = useStore((s) => s.menus);
  const saveMenu = useStore((s) => s.saveMenu);
  const applyMenu = useStore((s) => s.applyMenu);
  const deleteMenu = useStore((s) => s.deleteMenu);
  // Android fallback for the iOS-only Alert.prompt "Save week…" flow.
  const [savingMenu, setSavingMenu] = useState(false);
  const [menuName, setMenuName] = useState('');

  const weekHasEntries = useMemo(() => {
    const week = new Set(days);
    return plan.some((p) => week.has(p.date));
  }, [plan, days]);

  const onSaveWeek = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Save week as menu',
        'Name this week to re-apply the whole plan to any future week.',
        (name) => {
          const trimmed = name?.trim();
          if (trimmed) saveMenu(trimmed, startKey);
        },
      );
    } else {
      setMenuName('');
      setSavingMenu(true);
    }
  };

  const onApplyMenu = (id: string, name: string) => {
    if (weekHasEntries) {
      Alert.alert('Apply menu', `This week already has entries — add “${name}” on top?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', onPress: () => applyMenu(id, startKey) },
      ]);
    } else {
      applyMenu(id, startKey);
    }
  };

  const onDeleteMenu = (id: string, name: string) => {
    Alert.alert('Delete menu', `Delete the saved menu “${name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMenu(id) },
    ]);
  };

  return (
    <Screen
      title="Plan"
      subtitle="Weekly meal plan"
      right={<Button title="Grocery list" size="sm" onPress={() => router.push('/grocery')} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => setWeekOffset((w) => w - 1)}
          hitSlop={8}
          accessibilityLabel="Previous week"
          style={{
            width: 36,
            height: 36,
            borderRadius: Radius.md,
            backgroundColor: theme.backgroundSelected,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="chevron-back" size={18} color={theme.text} />
        </Pressable>
        <Pressable onPress={() => setWeekOffset(0)} disabled={weekOffset === 0} style={{ alignItems: 'center' }}>
          <ThemedText type="smallBold">{rangeLabel(days[0], days[6])}</ThemedText>
          <ThemedText
            type="small"
            style={{ color: weekOffset === 0 ? theme.textSecondary : theme.tint, fontSize: 12 }}>
            {weekOffset === 0
              ? 'This week'
              : weekOffset === 1
                ? 'Next week'
                : weekOffset === -1
                  ? 'Last week'
                  : 'Back to this week'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setWeekOffset((w) => w + 1)}
          hitSlop={8}
          accessibilityLabel="Next week"
          style={{
            width: 36,
            height: 36,
            borderRadius: Radius.md,
            backgroundColor: theme.backgroundSelected,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="chevron-forward" size={18} color={theme.text} />
        </Pressable>
      </View>

      {/* Reusable week menus: snapshot the visible week, re-apply saved ones. */}
      {menus.length > 0 || weekHasEntries ? (
        <View style={{ gap: Spacing.two }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedText type="small" themeColor="textSecondary">
              {menus.length > 0 ? 'Menus — tap to apply to this week' : 'Menus'}
            </ThemedText>
            <Pressable
              onPress={onSaveWeek}
              disabled={!weekHasEntries}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Save this week as a menu">
              <ThemedText
                type="small"
                style={{ color: theme.tint, fontWeight: '700', opacity: weekHasEntries ? 1 : 0.4 }}>
                Save week…
              </ThemedText>
            </Pressable>
          </View>
          {menus.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two }}>
              {menus.map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one }}>
                  <Chip label={m.name} onPress={() => onApplyMenu(m.id, m.name)} />
                  <Pressable
                    onPress={() => onDeleteMenu(m.id, m.name)}
                    hitSlop={8}
                    accessibilityLabel={`Delete menu ${m.name}`}>
                    <Ionicons name="close" size={14} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {savingMenu ? (
            <Card style={{ gap: Spacing.two }}>
              <Field
                label="Menu name"
                placeholder="e.g. Usual training week"
                value={menuName}
                onChangeText={setMenuName}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => setSavingMenu(false)}
                />
                <Button
                  title="Save menu"
                  size="sm"
                  style={{ flex: 1 }}
                  disabled={!menuName.trim()}
                  onPress={() => {
                    saveMenu(menuName.trim(), startKey);
                    setSavingMenu(false);
                  }}
                />
              </View>
            </Card>
          ) : null}
        </View>
      ) : null}

      {days.map((date) => (
        <DaySection key={date} date={date} lastGramsRef={lastGramsRef} />
      ))}
    </Screen>
  );
}

function DaySection({ date, lastGramsRef }: { date: string; lastGramsRef: { current: number } }) {
  const plan = useStore((s) => s.plan);
  const log = useStore((s) => s.log);
  const getIngredient = useStore((s) => s.getIngredient);
  const getRecipe = useStore((s) => s.getRecipe);
  const deletePlanEntry = useStore((s) => s.deletePlanEntry);
  const logPlanEntry = useStore((s) => s.logPlanEntry);
  const [adding, setAdding] = useState(false);

  const entries = useMemo(() => plan.filter((p) => p.date === date), [plan, date]);
  const totals = useMemo(
    () => planDayNutrients(plan, date, getIngredient, getRecipe),
    [plan, date, getIngredient, getRecipe],
  );

  // Derived, never persisted: a slot counts as logged when the day's log
  // already has an entry from the same source in the same meal.
  const isLogged = (p: PlanEntry) =>
    log.some(
      (e) =>
        e.date === p.date &&
        e.meal === p.meal &&
        e.kind === p.kind &&
        (p.kind === 'recipe' ? e.recipeId === p.recipeId : e.ingredientId === p.ingredientId),
    );

  return (
    <Card style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <ThemedText type="smallBold">{dayLabel(date)}</ThemedText>
        {entries.length ? (
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round(totals.calories ?? 0)} kcal · {Math.round(totals.protein ?? 0)}g protein
          </ThemedText>
        ) : null}
      </View>

      {MEAL_ORDER.map((meal) => {
        const rows = entries.filter((p) => p.meal === meal);
        if (rows.length === 0) return null;
        return (
          <View key={meal} style={{ gap: Spacing.one }}>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {MEAL_LABELS[meal]}
            </ThemedText>
            {rows.map((p) => (
              <PlanRow
                key={p.id}
                entry={p}
                logged={isLogged(p)}
                onLog={() => logPlanEntry(p.id)}
                onDelete={() => deletePlanEntry(p.id)}
              />
            ))}
          </View>
        );
      })}

      {entries.length === 0 && !adding ? (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing planned.
        </ThemedText>
      ) : null}

      {adding ? (
        <AddForm date={date} lastGramsRef={lastGramsRef} onDone={() => setAdding(false)} />
      ) : (
        <Button title="+ Add" size="sm" variant="secondary" onPress={() => setAdding(true)} />
      )}
    </Card>
  );
}

function PlanRow({
  entry,
  logged,
  onLog,
  onDelete,
}: {
  entry: PlanEntry;
  logged: boolean;
  onLog: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const getIngredient = useStore((s) => s.getIngredient);
  const getRecipe = useStore((s) => s.getRecipe);

  const name =
    entry.kind === 'recipe'
      ? getRecipe(entry.recipeId ?? '')?.name ?? 'Recipe'
      : getIngredient(entry.ingredientId ?? '')?.name ?? 'Food';
  const portion =
    entry.kind === 'recipe'
      ? `${trimNum(entry.servings ?? 1)} serving${(entry.servings ?? 1) === 1 ? '' : 's'}`
      : `${trimNum(entry.grams ?? 0)} g`;
  const kcal = Math.round(
    computeEntryNutrients(entry, { getIngredient, getRecipe }).calories ?? 0,
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold">
          {name}
          {entry.leftover ? ' · leftover' : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {portion} · {kcal} kcal
        </ThemedText>
      </View>
      <Button title={logged ? 'Logged ✓' : 'Log'} size="sm" variant="secondary" disabled={logged} onPress={onLog} />
      <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel={`Remove ${name} from plan`}>
        <Ionicons name="close" size={18} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

type Picked =
  | { kind: 'recipe'; recipe: Recipe }
  | { kind: 'ingredient'; ingredient: Ingredient };

function AddForm({
  date,
  lastGramsRef,
  onDone,
}: {
  date: string;
  lastGramsRef: { current: number };
  onDone: () => void;
}) {
  const theme = useTheme();
  const recipes = useStore((s) => s.recipes);
  const userIngredients = useStore((s) => s.userIngredients);
  const addPlanEntry = useStore((s) => s.addPlanEntry);

  const [meal, setMeal] = useState<MealType>('dinner');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [amount, setAmount] = useState('1');
  const [leftoverOffer, setLeftoverOffer] = useState<{ recipeId: string; remaining: number } | null>(
    null,
  );

  const library = useMemo(
    () => [...SEED_INGREDIENTS, ...userIngredients].sort((a, b) => a.name.localeCompare(b.name)),
    [userIngredients],
  );
  const term = q.trim().toLowerCase();
  const recipeList = useMemo(
    () => (term ? recipes.filter((r) => r.name.toLowerCase().includes(term)) : recipes).slice(0, 8),
    [recipes, term],
  );
  const foodList = useMemo(
    () => (term ? library.filter((i) => i.name.toLowerCase().includes(term)) : library).slice(0, 8),
    [library, term],
  );

  const onAdd = () => {
    if (!picked) return;
    if (picked.kind === 'recipe') {
      const servings = Number(amount) || 1;
      addPlanEntry({ date, meal, kind: 'recipe', recipeId: picked.recipe.id, servings });
      const remaining = picked.recipe.servings - servings;
      if (remaining > 0) {
        // The cook makes more than this slot's plan — offer the rest as
        // tomorrow's lunch leftovers (excluded from the grocery list).
        setLeftoverOffer({ recipeId: picked.recipe.id, remaining });
        return;
      }
    } else {
      const grams = Number(amount) || 0;
      if (grams <= 0) return;
      lastGramsRef.current = grams;
      addPlanEntry({ date, meal, kind: 'ingredient', ingredientId: picked.ingredient.id, grams });
    }
    onDone();
  };

  if (leftoverOffer) {
    return (
      <View style={{ gap: Spacing.two, paddingTop: Spacing.one }}>
        <ThemedText type="small">
          That cook leaves {trimNum(leftoverOffer.remaining)} serving
          {leftoverOffer.remaining === 1 ? '' : 's'} over — plan as leftovers for the next day&apos;s
          lunch?
        </ThemedText>
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          <Button
            title="Add leftovers"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => {
              addPlanEntry({
                date: addDays(date, 1),
                meal: 'lunch',
                kind: 'recipe',
                recipeId: leftoverOffer.recipeId,
                servings: leftoverOffer.remaining,
                leftover: true,
              });
              onDone();
            }}
          />
          <Button title="No thanks" size="sm" variant="secondary" style={{ flex: 1 }} onPress={onDone} />
        </View>
      </View>
    );
  }

  if (picked) {
    const isRecipe = picked.kind === 'recipe';
    const name = isRecipe ? picked.recipe.name : picked.ingredient.name;
    return (
      <View style={{ gap: Spacing.two, paddingTop: Spacing.one }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText type="smallBold" style={{ flex: 1 }}>
            {name}
          </ThemedText>
          <Pressable onPress={() => setPicked(null)} hitSlop={8}>
            <ThemedText type="small" style={{ color: theme.tint, fontWeight: '700' }}>
              Change
            </ThemedText>
          </Pressable>
        </View>
        <Segmented options={MEALS} value={meal} onChange={setMeal} />
        <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' }}>
          <View style={{ width: 120 }}>
            <Field
              label={isRecipe ? 'Servings' : 'Grams'}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
            />
          </View>
          <Button
            title="Add to day"
            size="sm"
            style={{ flex: 1 }}
            disabled={!(Number(amount) > 0)}
            onPress={onAdd}
          />
        </View>
      </View>
    );
  }

  const row = (i: number) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: i === 0 ? 0 : 1,
    borderTopColor: theme.border,
  });

  return (
    <View style={{ gap: Spacing.two, paddingTop: Spacing.one }}>
      <Segmented options={MEALS} value={meal} onChange={setMeal} />
      <Field placeholder="Search recipes & foods…" value={q} onChangeText={setQ} autoCorrect={false} />
      <View>
        {recipeList.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => {
              setPicked({ kind: 'recipe', recipe: r });
              setAmount('1');
            }}
            style={row(i)}>
            <Ionicons name="book-outline" size={16} color={theme.tint} />
            <ThemedText type="small" style={{ flex: 1 }}>
              {r.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {trimNum(r.servings)} serving{r.servings === 1 ? '' : 's'}
            </ThemedText>
          </Pressable>
        ))}
        {foodList.map((ing, i) => (
          <Pressable
            key={ing.id}
            onPress={() => {
              setPicked({ kind: 'ingredient', ingredient: ing });
              setAmount(String(lastGramsRef.current));
            }}
            style={row(recipeList.length + i)}>
            <Ionicons name="nutrition-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ flex: 1 }}>
              {ing.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {ing.per100g.calories ?? 0} kcal/100g
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <Button title="Cancel" size="sm" variant="ghost" onPress={onDone} />
    </View>
  );
}
