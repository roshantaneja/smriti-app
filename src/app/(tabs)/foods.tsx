import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { MacroColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SEED_INGREDIENTS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Ingredient } from '@/lib/types';

export default function FoodsScreen() {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const userIngredients = useStore((s) => s.userIngredients);

  const all = useMemo(
    () => [...SEED_INGREDIENTS, ...userIngredients].sort((a, b) => a.name.localeCompare(b.name)),
    [userIngredients],
  );
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? all.filter((i) => i.name.toLowerCase().includes(t)) : all;
  }, [all, q]);

  return (
    <Screen
      title="Foods"
      subtitle={`${all.length} ingredients · macros per 100 g`}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
          </Pressable>
          <Button title="+ New" size="sm" onPress={() => router.push('/food/new')} />
        </View>
      }>
      <Field placeholder="Search foods…" value={q} onChangeText={setQ} autoCorrect={false} />

      <View style={{ flexDirection: 'row', gap: Spacing.three }}>
        <Button
          title="Scan barcode"
          size="sm"
          variant="secondary"
          onPress={() => router.push('/scan')}
          style={{ flex: 1 }}
        />
        <Button
          title="Search online"
          size="sm"
          variant="secondary"
          onPress={() => router.push('/food-search')}
          style={{ flex: 1 }}
        />
      </View>

      {filtered.length === 0 ? (
        <Card>
          <View style={{ alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four }}>
            <Ionicons name="search-outline" size={32} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              No foods match “{q}”. Add it as a new ingredient.
            </ThemedText>
            <Button title="Add new ingredient" size="sm" variant="secondary" onPress={() => router.push('/food/new')} />
          </View>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((ing, i) => (
            <IngredientRow key={ing.id} ing={ing} first={i === 0} />
          ))}
        </Card>
      )}

      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        Seed data from USDA FoodData Central. Add your own via label or manual entry.
      </ThemedText>
    </Screen>
  );
}

function IngredientRow({ ing, first }: { ing: Ingredient; first: boolean }) {
  const theme = useTheme();
  const p = ing.per100g;
  return (
    <Pressable
      onPress={() => router.push(`/food/${ing.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        padding: Spacing.three,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.border,
      }}>
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold">{ing.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {ing.category}
        </ThemedText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <ThemedText type="smallBold" style={{ color: MacroColors.calories }}>
          {p.calories ?? 0} kcal
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {p.protein ?? 0}P · {p.carbs ?? 0}C · {p.fat ?? 0}F
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}
