import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/segmented';
import { Field } from '@/components/ui/field';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { uid } from '@/lib/id';
import { recipePerServing, recipeTotals } from '@/lib/nutrition';
import { SEED_INGREDIENTS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Ingredient, Recipe, RecipeItem } from '@/lib/types';
import { defaultUnit, toGrams, unitOptions } from '@/lib/units';

const TAG_OPTIONS = ['High-protein', 'Vegetarian', 'Vegan', 'Gluten-free', 'Keto', 'Quick'];

interface ItemDraft {
  key: string;
  ingredientId: string;
  amount: string;
  unit: string;
}

export default function NewRecipeScreen() {
  const theme = useTheme();
  const addRecipe = useStore((s) => s.addRecipe);
  const getIngredient = useStore((s) => s.getIngredient);
  const userIngredients = useStore((s) => s.userIngredients);

  const [name, setName] = useState('');
  const [servings, setServings] = useState('2');
  const [prep, setPrep] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [q, setQ] = useState('');

  const library = useMemo(
    () => [...SEED_INGREDIENTS, ...userIngredients].sort((a, b) => a.name.localeCompare(b.name)),
    [userIngredients],
  );
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return library.filter((i) => i.name.toLowerCase().includes(t)).slice(0, 8);
  }, [library, q]);

  // Build a preview recipe to compute live macros.
  const previewRecipe: Recipe = useMemo(() => {
    const recipeItems: RecipeItem[] = items.map((it) => {
      const ing = getIngredient(it.ingredientId);
      const amount = Number(it.amount) || 0;
      const grams = ing ? toGrams(ing, amount, it.unit) : 0;
      return { ingredientId: it.ingredientId, amount, unit: it.unit, grams };
    });
    return {
      id: 'preview',
      name,
      servings: Math.max(1, Number(servings) || 1),
      items: recipeItems,
      tags,
      createdAt: '',
    };
  }, [items, name, servings, tags, getIngredient]);

  const totals = recipeTotals(previewRecipe, getIngredient);
  const per = recipePerServing(previewRecipe, getIngredient);

  const addItem = (ing: Ingredient) => {
    const unit = defaultUnit(ing);
    setItems((prev) => [
      ...prev,
      { key: uid(), ingredientId: ing.id, amount: unit === 'g' ? '100' : '1', unit },
    ]);
    setQ('');
  };
  const updateItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));
  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const canSave = name.trim().length > 0 && items.length > 0;

  const onSave = () => {
    if (!canSave) return;
    addRecipe({
      name: name.trim(),
      servings: Math.max(1, Number(servings) || 1),
      prepMinutes: Number(prep) > 0 ? Number(prep) : undefined,
      tags,
      items: previewRecipe.items.filter((it) => getIngredient(it.ingredientId)),
    });
    router.back();
  };

  return (
    <Screen scroll title="New recipe" edges={['bottom']}>
      <Card style={{ gap: Spacing.three }}>
        <Field label="Recipe name" placeholder="e.g. Chana masala" value={name} onChangeText={setName} />
        <View style={{ flexDirection: 'row', gap: Spacing.three }}>
          <Field label="Servings" keyboardType="number-pad" value={servings} onChangeText={(t) => setServings(t.replace(/[^0-9]/g, ''))} />
          <Field label="Prep (min, optional)" keyboardType="number-pad" value={prep} onChangeText={(t) => setPrep(t.replace(/[^0-9]/g, ''))} placeholder="—" />
        </View>
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="small" themeColor="textSecondary">
            Tags
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {TAG_OPTIONS.map((t) => (
              <Chip key={t} label={t} active={tags.includes(t)} onPress={() => toggleTag(t)} />
            ))}
          </View>
        </View>
      </Card>

      {/* Live macro preview */}
      <Card style={{ gap: Spacing.two }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <ThemedText type="smallBold">Per serving</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {previewRecipe.servings} servings · {Math.round(totals.calories ?? 0)} kcal total
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' }}>
          <Stat label="kcal" value={Math.round(per.calories ?? 0)} color={MacroColors.calories} />
          <Stat label="protein" value={`${Math.round(per.protein ?? 0)}g`} color={MacroColors.protein} />
          <Stat label="carbs" value={`${Math.round(per.carbs ?? 0)}g`} color={MacroColors.carbs} />
          <Stat label="fat" value={`${Math.round(per.fat ?? 0)}g`} color={MacroColors.fat} />
          <Stat label="fiber" value={`${Math.round(per.fiber ?? 0)}g`} color={MacroColors.fiber} />
        </View>
      </Card>

      {/* Ingredient search */}
      <ThemedText type="smallBold">Ingredients</ThemedText>
      <Field placeholder="Search foods to add…" value={q} onChangeText={setQ} autoCorrect={false} />
      {matches.length > 0 ? (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {matches.map((ing, i) => (
            <Pressable
              key={ing.id}
              onPress={() => addItem(ing)}
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
              <Ionicons name="add-circle" size={24} color={theme.tint} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {/* Added items */}
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No ingredients yet — search above and tap to add.
        </ThemedText>
      ) : (
        items.map((it) => {
          const ing = getIngredient(it.ingredientId);
          if (!ing) return null;
          const opts = unitOptions(ing);
          return (
            <Card key={it.key} style={{ gap: Spacing.two }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText type="smallBold" style={{ flex: 1 }}>
                  {ing.name}
                </ThemedText>
                <Pressable onPress={() => removeItem(it.key)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={theme.danger} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
                <View style={{ width: 90 }}>
                  <Field
                    keyboardType="decimal-pad"
                    value={it.amount}
                    onChangeText={(t) => updateItem(it.key, { amount: t.replace(/[^0-9.]/g, '') })}
                  />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, flex: 1 }}>
                  {opts.map((o) => {
                    const active = o.unit === it.unit;
                    return (
                      <Pressable
                        key={o.unit}
                        onPress={() => updateItem(it.key, { unit: o.unit })}
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
              <ThemedText type="small" themeColor="textSecondary">
                = {Math.round(toGrams(ing, Number(it.amount) || 0, it.unit))} g
              </ThemedText>
            </Card>
          );
        })
      )}

      <Button title="Save recipe" onPress={onSave} disabled={!canSave} style={{ marginTop: Spacing.two }} />
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View>
      <ThemedText style={{ fontSize: 20, fontWeight: '800', color }}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {label}
      </ThemedText>
    </View>
  );
}
