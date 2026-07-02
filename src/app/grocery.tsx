import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/date';
import {
  addDays,
  aggregateGroceries,
  formatGrams,
  groceryTotals,
  weekStart,
  type GroceryLine,
} from '@/lib/grocery';
import { useStore } from '@/lib/store';

/** "Jun 29 – Jul 5" for a week beginning at `startKey`. */
function rangeLabel(startKey: string): string {
  const fmt = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return `${fmt(startKey)} – ${fmt(addDays(startKey, 6))}`;
}

export default function GroceryScreen() {
  const theme = useTheme();
  // 0 = this week; › steps forward (plan next week's shop), ‹ steps back.
  const [weekOffset, setWeekOffset] = useState(0);

  const plan = useStore((s) => s.plan);
  const getIngredient = useStore((s) => s.getIngredient);
  const getRecipe = useStore((s) => s.getRecipe);
  const groceryChecked = useStore((s) => s.groceryChecked);
  const toggleGroceryChecked = useStore((s) => s.toggleGroceryChecked);
  const clearGroceryChecked = useStore((s) => s.clearGroceryChecked);

  const startKey = useMemo(() => addDays(weekStart(dayKey()), weekOffset * 7), [weekOffset]);
  const lines = useMemo(
    () => aggregateGroceries(plan, startKey, getIngredient, getRecipe),
    [plan, startKey, getIngredient, getRecipe],
  );
  const totals = useMemo(() => groceryTotals(lines), [lines]);
  const checkedCount = lines.filter((l) => groceryChecked[l.key]).length;

  const categories = useMemo(() => {
    const map = new Map<string, GroceryLine[]>();
    for (const l of lines) {
      const arr = map.get(l.category) ?? [];
      arr.push(l);
      map.set(l.category, arr);
    }
    return [...map.entries()];
  }, [lines]);

  const weekLabel =
    weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : rangeLabel(startKey);

  return (
    <Screen scroll title="Grocery list" subtitle="Everything the week's plan needs" edges={['bottom']}>
      {/* Week navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setWeekOffset((w) => w - 1)} hitSlop={12} accessibilityLabel="Previous week">
          <Ionicons name="chevron-back" size={20} color={theme.tint} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <ThemedText type="smallBold">{weekLabel}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {rangeLabel(startKey)}
          </ThemedText>
        </View>
        <Pressable onPress={() => setWeekOffset((w) => w + 1)} hitSlop={12} accessibilityLabel="Next week">
          <Ionicons name="chevron-forward" size={20} color={theme.tint} />
        </Pressable>
      </View>

      {lines.length === 0 ? (
        <Card>
          <EmptyState
            icon="cart-outline"
            title="Nothing to buy"
            message="Plan some meals for this week and the shopping list builds itself."
          />
          <Button title="Go to plan" onPress={() => router.back()} />
        </Card>
      ) : (
        <>
          {categories.map(([category, items]) => (
            <View key={category} style={{ gap: Spacing.one }}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {category}
              </ThemedText>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {items.map((l, i) => {
                  const checked = !!groceryChecked[l.key];
                  return (
                    <Pressable
                      key={l.key}
                      onPress={() => toggleGroceryChecked(l.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: Spacing.two,
                        padding: Spacing.three,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: theme.border,
                      }}>
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={checked ? theme.tint : theme.textSecondary}
                      />
                      <ThemedText
                        type="small"
                        style={{
                          flex: 1,
                          textDecorationLine: checked ? 'line-through' : 'none',
                          color: checked ? theme.textSecondary : theme.text,
                        }}>
                        {l.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatGrams(l.totalGrams)}
                      </ThemedText>
                      {l.estCost != null ? (
                        <ThemedText type="smallBold" style={{ minWidth: 52, textAlign: 'right' }}>
                          ${l.estCost.toFixed(2)}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          ))}

          {/* Totals footer */}
          <Card style={{ gap: Spacing.one }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <ThemedText type="smallBold">Estimated total</ThemedText>
              <ThemedText type="subtitle" style={{ fontSize: 20, lineHeight: 26 }}>
                ${totals.totalCost.toFixed(2)}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {totals.pricedLines} of {totals.totalLines} items priced
              {totals.pricedLines < totals.totalLines ? ' — the real total will be higher' : ''} ·{' '}
              {checkedCount}/{lines.length} checked
            </ThemedText>
            <Button
              title="Uncheck all"
              variant="ghost"
              size="sm"
              disabled={checkedCount === 0}
              onPress={() => clearGroceryChecked(lines.map((l) => l.key))}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}
