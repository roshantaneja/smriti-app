import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Field } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/date';
import { recipePerServing, scale } from '@/lib/nutrition';
import { SEED_INGREDIENTS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Ingredient, NutrientKey } from '@/lib/types';
import { defaultUnit, toGrams, unitOptions } from '@/lib/units';

type Mode = 'foods' | 'recipes' | 'quick' | 'water';
const MODES: { value: Mode; label: string }[] = [
  { value: 'foods', label: 'Foods' },
  { value: 'recipes', label: 'Recipes' },
  { value: 'quick', label: 'Quick add' },
  { value: 'water', label: 'Water' },
];

export default function LogAddScreen() {
  const [mode, setMode] = useState<Mode>('foods');
  return (
    <Screen scroll title="Add to today" edges={['bottom']}>
      <Segmented options={MODES} value={mode} onChange={setMode} />
      {mode === 'foods' && <FoodsMode />}
      {mode === 'recipes' && <RecipesMode />}
      {mode === 'quick' && <QuickMode />}
      {mode === 'water' && <WaterMode />}
    </Screen>
  );
}

function FoodsMode() {
  const theme = useTheme();
  const userIngredients = useStore((s) => s.userIngredients);
  const addLogEntry = useStore((s) => s.addLogEntry);

  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [amount, setAmount] = useState('100');
  const [unit, setUnit] = useState('g');

  const library = useMemo(
    () => [...SEED_INGREDIENTS, ...userIngredients].sort((a, b) => a.name.localeCompare(b.name)),
    [userIngredients],
  );
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? library.filter((i) => i.name.toLowerCase().includes(t)) : library).slice(0, 40);
  }, [library, q]);

  const select = (ing: Ingredient) => {
    const u = defaultUnit(ing);
    setSelected(ing);
    setUnit(u);
    setAmount(u === 'g' ? '100' : '1');
  };

  if (selected) {
    const grams = toGrams(selected, Number(amount) || 0, unit);
    const n = scale(selected.per100g, grams);
    return (
      <Card style={{ gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText type="subtitle" style={{ fontSize: 18, lineHeight: 24, flex: 1 }}>
            {selected.name}
          </ThemedText>
          <Pressable onPress={() => setSelected(null)} hitSlop={8}>
            <ThemedText type="small" style={{ color: theme.tint, fontWeight: '700' }}>
              Change
            </ThemedText>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
          <View style={{ width: 100 }}>
            <Field keyboardType="decimal-pad" value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, flex: 1 }}>
            {unitOptions(selected).map((o) => {
              const active = o.unit === unit;
              return (
                <Pressable
                  key={o.unit}
                  onPress={() => setUnit(o.unit)}
                  style={{
                    paddingHorizontal: Spacing.two,
                    paddingVertical: Spacing.one,
                    borderRadius: Radius.pill,
                    backgroundColor: active ? theme.tint : theme.backgroundSelected,
                  }}>
                  <ThemedText type="small" style={{ color: active ? '#fff' : theme.text, fontSize: 12 }}>
                    {o.unit}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: Spacing.four, flexWrap: 'wrap' }}>
          <MiniStat label="kcal" value={Math.round(n.calories ?? 0)} color={MacroColors.calories} />
          <MiniStat label="protein" value={`${Math.round(n.protein ?? 0)}g`} color={MacroColors.protein} />
          <MiniStat label="carbs" value={`${Math.round(n.carbs ?? 0)}g`} color={MacroColors.carbs} />
          <MiniStat label="fat" value={`${Math.round(n.fat ?? 0)}g`} color={MacroColors.fat} />
        </View>

        <Button
          title="Add to today"
          onPress={() => {
            addLogEntry({ date: dayKey(), kind: 'ingredient', ingredientId: selected.id, grams });
            router.back();
          }}
        />
      </Card>
    );
  }

  return (
    <>
      <Field placeholder="Search foods…" value={q} onChangeText={setQ} autoCorrect={false} />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {list.map((ing, i) => (
          <Pressable
            key={ing.id}
            onPress={() => select(ing)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: Spacing.three,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.border,
            }}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">{ing.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {ing.per100g.calories ?? 0} kcal · {ing.per100g.protein ?? 0}g protein / 100g
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
        ))}
      </Card>
    </>
  );
}

function RecipesMode() {
  const theme = useTheme();
  const recipes = useStore((s) => s.recipes);
  const getIngredient = useStore((s) => s.getIngredient);
  const addLogEntry = useStore((s) => s.addLogEntry);

  if (recipes.length === 0) {
    return (
      <Card>
        <EmptyState icon="book-outline" title="No recipes yet" message="Create a recipe, then log it here in one tap." />
        <Button title="Create a recipe" onPress={() => router.push('/recipe/new')} />
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {recipes.map((r, i) => {
        const per = recipePerServing(r, getIngredient);
        return (
          <View
            key={r.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.three,
              padding: Spacing.three,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.border,
            }}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push(`/recipe/${r.id}`)}>
              <ThemedText type="smallBold">{r.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {Math.round(per.calories ?? 0)} kcal · {Math.round(per.protein ?? 0)}g protein / serving
              </ThemedText>
            </Pressable>
            <Button
              title="Log 1×"
              size="sm"
              variant="secondary"
              onPress={() => {
                addLogEntry({ date: dayKey(), kind: 'recipe', recipeId: r.id, servings: 1 });
                router.back();
              }}
            />
          </View>
        );
      })}
    </Card>
  );
}

const QUICK_FIELDS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
];

function QuickMode() {
  const addLogEntry = useStore((s) => s.addLogEntry);
  const [label, setLabel] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const canAdd = label.trim().length > 0 && (Number(vals.calories) || 0) > 0;

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        For a one-off food you won&apos;t reuse — a restaurant dish, a snack. Enter what you know.
      </ThemedText>
      <Card style={{ gap: Spacing.three }}>
        <Field label="What did you eat?" placeholder="e.g. Olive Garden breadstick" value={label} onChangeText={setLabel} />
        {QUICK_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            suffix={f.unit}
            keyboardType="decimal-pad"
            placeholder="0"
            value={vals[f.key] ?? ''}
            onChangeText={(t) => setVals((v) => ({ ...v, [f.key]: t.replace(/[^0-9.]/g, '') }))}
          />
        ))}
      </Card>
      <Button
        title="Add to today"
        disabled={!canAdd}
        onPress={() => {
          const nutrients = Object.fromEntries(
            QUICK_FIELDS.map((f) => [f.key, Number(vals[f.key]) || 0]).filter(([, v]) => (v as number) > 0),
          );
          addLogEntry({ date: dayKey(), kind: 'quick', label: label.trim(), nutrients });
          router.back();
        }}
      />
    </>
  );
}

function WaterMode() {
  const addWater = useStore((s) => s.addWater);
  const [custom, setCustom] = useState('');
  const quick = (ml: number) => {
    addWater(ml);
    router.back();
  };
  return (
    <>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        {[250, 500, 750].map((ml) => (
          <Button key={ml} title={`${ml} ml`} variant="secondary" style={{ flex: 1 }} onPress={() => quick(ml)} />
        ))}
      </View>
      <Card style={{ gap: Spacing.three }}>
        <Field label="Custom amount" suffix="ml" keyboardType="number-pad" placeholder="0" value={custom} onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, ''))} />
        <Button title="Add water" disabled={!(Number(custom) > 0)} onPress={() => quick(Number(custom))} />
      </Card>
    </>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View>
      <ThemedText style={{ fontSize: 18, fontWeight: '800', color }}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {label}
      </ThemedText>
    </View>
  );
}
