import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Field } from '@/components/ui/field';
import { Bar } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, dayLabel } from '@/lib/date';
import { weekStart } from '@/lib/grocery';
import { useStore } from '@/lib/store';
import {
  currentStreak,
  dayTotals,
  lastNDays,
  rangeAverages,
  waterByDay,
  weightTrend,
  type WeightTrendPoint,
} from '@/lib/trends';
import type { Nutrients } from '@/lib/types';

type RangeKey = '7' | '30' | '90';

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

/** Parse a local YYYY-MM-DD key into a local Date (noon dodges DST edges). */
function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export default function TrendsScreen() {
  const theme = useTheme();
  const today = dayKey();

  const log = useStore((s) => s.log);
  const goals = useStore((s) => s.goals);
  const getIngredient = useStore((s) => s.getIngredient);
  const getRecipe = useStore((s) => s.getRecipe);
  const weights = useStore((s) => s.weights);
  const addWeight = useStore((s) => s.addWeight);
  const deleteWeight = useStore((s) => s.deleteWeight);

  const [range, setRange] = useState<RangeKey>('7');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [kgBuffer, setKgBuffer] = useState('');

  const ctx = useMemo(() => ({ getIngredient, getRecipe }), [getIngredient, getRecipe]);
  const totalsByDay = useMemo(() => dayTotals(log, ctx), [log, ctx]);
  const water = useMemo(() => waterByDay(log), [log]);
  const days = useMemo(() => lastNDays(Number(range), today), [range, today]);
  const { avg, daysLogged } = useMemo(
    () => rangeAverages(log, ctx, Number(range), today),
    [log, ctx, range, today],
  );
  const streak = useMemo(() => currentStreak(log, today), [log, today]);
  const trend = useMemo(() => weightTrend(weights), [weights]);

  const avgWater = useMemo(() => {
    if (daysLogged === 0) return 0;
    let total = 0;
    for (const d of days) total += water.get(d) ?? 0;
    return Math.round(total / daysLogged);
  }, [days, water, daysLogged]);

  // Calorie chart buckets: one per day at 7 days, per Monday-start week beyond
  // (each weekly bar is the average of its logged days, comparable to the goal line).
  const buckets = useMemo(() => {
    if (range === '7') {
      return days.map((d) => ({
        key: d,
        label: keyToDate(d).toLocaleDateString(undefined, { weekday: 'narrow' }),
        value: totalsByDay.get(d)?.calories ?? 0,
      }));
    }
    const byWeek = new Map<string, { total: number; logged: number }>();
    for (const d of days) {
      const ws = weekStart(d);
      const kcal = totalsByDay.get(d)?.calories ?? 0;
      const b = byWeek.get(ws) ?? { total: 0, logged: 0 };
      if (kcal > 0) {
        b.total += kcal;
        b.logged += 1;
      }
      byWeek.set(ws, b);
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ws, b]) => ({
        key: ws,
        label: String(keyToDate(ws).getDate()),
        value: b.logged > 0 ? Math.round(b.total / b.logged) : 0,
      }));
  }, [range, days, totalsByDay]);

  const onAddWeight = () => {
    const kg = Number(kgBuffer.replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0) return;
    addWeight(Math.round(kg * 10) / 10);
    setKgBuffer('');
  };

  // Latest weigh-in (by date, then entry time) — the one the ✕ removes.
  const latestWeight = useMemo(() => {
    if (weights.length === 0) return undefined;
    return [...weights].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    )[weights.length - 1];
  }, [weights]);

  const summaryDay = selectedDay ?? today;
  const summaryTotals = totalsByDay.get(summaryDay);

  return (
    <Screen title="Trends" subtitle="Averages, history, and weight over time">
      <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />

      {/* 1 — Daily averages vs goals */}
      <ThemedText type="smallBold">Daily averages</ThemedText>
      <Card style={{ gap: Spacing.three }}>
        {daysLogged === 0 ? (
          <EmptyState
            icon="trending-up-outline"
            title="Nothing logged yet"
            message={`Log a few days of food and your ${range}-day averages will show up here.`}
          />
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Averaged over the {daysLogged} logged day{daysLogged === 1 ? '' : 's'} in the last {range}.
            </ThemedText>
            <AvgRow label="Calories" value={avg.calories ?? 0} goal={goals.calories} unit="kcal" color={MacroColors.calories} />
            <AvgRow label="Protein" value={avg.protein ?? 0} goal={goals.protein} unit="g" color={MacroColors.protein} />
            <AvgRow label="Carbs" value={avg.carbs ?? 0} goal={goals.carbs} unit="g" color={MacroColors.carbs} />
            <AvgRow label="Fat" value={avg.fat ?? 0} goal={goals.fat} unit="g" color={MacroColors.fat} />
            <AvgRow label="Fiber" value={avg.fiber ?? 0} goal={goals.fiber} unit="g" color={MacroColors.fiber} />
            <AvgRow label="Water" value={avgWater} goal={goals.waterMl} unit="ml" color={theme.water} />
          </>
        )}
      </Card>

      {/* 2 — Calorie chart */}
      <ThemedText type="smallBold">Calories</ThemedText>
      <Card style={{ gap: Spacing.two }}>
        <CalorieChart buckets={buckets} goal={goals.calories} perWeek={range !== '7'} />
      </Card>

      {/* 3 — History calendar */}
      <ThemedText type="smallBold">History</ThemedText>
      <Card style={{ gap: Spacing.two }}>
        <HistoryCalendar
          today={today}
          totalsByDay={totalsByDay}
          goal={goals.calories}
          selected={summaryDay}
          onSelect={setSelectedDay}
        />
        <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: Spacing.two }}>
          <ThemedText type="smallBold">{dayLabel(summaryDay)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {summaryTotals && (summaryTotals.calories ?? 0) > 0
              ? `${Math.round(summaryTotals.calories ?? 0)} kcal · P ${Math.round(summaryTotals.protein ?? 0)} g · C ${Math.round(summaryTotals.carbs ?? 0)} g · F ${Math.round(summaryTotals.fat ?? 0)} g`
              : 'Nothing logged'}
          </ThemedText>
        </View>
      </Card>

      {/* 4 — Weight */}
      <ThemedText type="smallBold">Weight</ThemedText>
      <Card style={{ gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' }}>
          <Field
            label="Log a weigh-in"
            placeholder="70.0"
            suffix="kg"
            keyboardType="decimal-pad"
            value={kgBuffer}
            onChangeText={setKgBuffer}
          />
          <Button title="Add" size="sm" style={{ minHeight: 48 }} onPress={onAddWeight} />
        </View>

        {trend.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No weigh-ins yet. Your raw weights and smoothed trend will chart here.
          </ThemedText>
        ) : (
          <>
            <WeightChart points={trend.slice(-30)} />
            <ThemedText type="small" themeColor="textSecondary">
              Trend weight: <ThemedText type="smallBold">{trend[trend.length - 1].trendKg.toFixed(1)} kg</ThemedText>
              {'  ·  '}○ weigh-in · ● trend
            </ThemedText>
            {latestWeight ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <ThemedText type="small" themeColor="textSecondary">
                  Latest: {latestWeight.kg} kg · {dayLabel(latestWeight.date)}
                </ThemedText>
                <Pressable
                  onPress={() => deleteWeight(latestWeight.id)}
                  hitSlop={8}
                  accessibilityLabel="Remove latest weigh-in">
                  <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </Card>

      {/* 5 — Stats strip */}
      <Card style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <View style={{ flex: 1, alignItems: 'center', gap: Spacing.one }}>
          <Ionicons name="flame-outline" size={20} color={MacroColors.protein} />
          <ThemedText style={{ fontSize: 28, fontWeight: '800', lineHeight: 32 }}>{streak}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            day streak
          </ThemedText>
        </View>
        <View style={{ width: 1, backgroundColor: theme.border }} />
        <View style={{ flex: 1, alignItems: 'center', gap: Spacing.one }}>
          <Ionicons name="checkmark-done-outline" size={20} color={theme.tint} />
          <ThemedText style={{ fontSize: 28, fontWeight: '800', lineHeight: 32 }}>
            {daysLogged}/{range}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            days logged
          </ThemedText>
        </View>
      </Card>
    </Screen>
  );
}

/** Compact average row: label, value vs goal, progress bar. */
function AvgRow({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  return (
    <View style={{ gap: Spacing.one }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(value)} / {Math.round(goal)} {unit}
        </ThemedText>
      </View>
      <Bar value={value} goal={goal} color={color} height={6} />
    </View>
  );
}

const CHART_HEIGHT = 140;

/** Pure-RN bar chart with a horizontal goal line; over-goal bars turn danger. */
function CalorieChart({
  buckets,
  goal,
  perWeek,
}: {
  buckets: { key: string; label: string; value: number }[];
  goal: number;
  perWeek: boolean;
}) {
  const theme = useTheme();
  const max = Math.max(goal * 1.15, ...buckets.map((b) => b.value), 1);
  const goalBottom = (goal / max) * CHART_HEIGHT;
  // Thin the x-axis labels when weekly buckets get dense (90 days ≈ 13 weeks).
  const labelEvery = buckets.length > 9 ? 2 : 1;
  return (
    <View style={{ gap: Spacing.one }}>
      <View style={{ height: CHART_HEIGHT }}>
        <View
          style={{
            height: CHART_HEIGHT,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: Spacing.one,
          }}>
          {buckets.map((b) => (
            <View
              key={b.key}
              style={{
                flex: 1,
                height: Math.max(3, (b.value / max) * CHART_HEIGHT),
                borderRadius: 3,
                backgroundColor:
                  b.value === 0 ? theme.backgroundSelected
                  : b.value > goal ? theme.danger
                  : MacroColors.calories,
              }}
            />
          ))}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: goalBottom,
            height: 1,
            backgroundColor: theme.textSecondary,
            opacity: 0.7,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.one }}>
        {buckets.map((b, i) => (
          <ThemedText
            key={b.key}
            type="small"
            themeColor="textSecondary"
            style={{ flex: 1, textAlign: 'center', fontSize: 10, lineHeight: 12 }}>
            {i % labelEvery === 0 ? b.label : ''}
          </ThemedText>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        Line marks your {goal} kcal goal
        {perWeek ? ' · bars are weekly averages (week-start dates below)' : ''}.
      </ThemedText>
    </View>
  );
}

const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Current-month grid (Monday-start), each day banded by calories vs goal. */
function HistoryCalendar({
  today,
  totalsByDay,
  goal,
  selected,
  onSelect,
}: {
  today: string;
  totalsByDay: Map<string, Nutrients>;
  goal: number;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const theme = useTheme();
  const [y, m] = today.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1, 12).getDay() + 6) % 7; // Mon=0 … Sun=6
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(y, m - 1, i + 1, 12))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Band: empty (no food logged / future), under goal, within ±5%, over.
  const bandColor = (d: string): string | null => {
    if (d > today) return null;
    const kcal = totalsByDay.get(d)?.calories ?? 0;
    if (kcal <= 0) return null;
    if (kcal > goal * 1.05) return theme.danger;
    if (kcal >= goal * 0.95) return MacroColors.fiber;
    return theme.tint;
  };

  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
        {keyToDate(today).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
      </ThemedText>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_HEADERS.map((h, i) => (
          <ThemedText
            key={`${h}-${i}`}
            type="small"
            themeColor="textSecondary"
            style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
            {h}
          </ThemedText>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((d, di) => {
            if (!d) return <View key={`blank-${di}`} style={{ flex: 1, aspectRatio: 1, margin: 1 }} />;
            const band = bandColor(d);
            const isSelected = d === selected;
            return (
              <Pressable
                key={d}
                onPress={() => onSelect(d)}
                accessibilityLabel={`Show totals for ${d}`}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  margin: 1,
                  borderRadius: Radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: band ?? 'transparent',
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: theme.text,
                }}>
                <ThemedText
                  type="small"
                  style={{ fontSize: 12, color: band ? '#fff' : theme.textSecondary }}>
                  {Number(d.slice(8))}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const WEIGHT_CHART_HEIGHT = 120;
const DOT = 8;

/** Raw weigh-ins (hollow dots) + EWMA trend (filled dots) with min/max ticks. */
function WeightChart({ points }: { points: WeightTrendPoint[] }) {
  const theme = useTheme();
  const values = points.flatMap((p) => [p.kg, p.trendKg]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.5);
  const bottomFor = (v: number) => ((v - min) / span) * (WEIGHT_CHART_HEIGHT - DOT);
  return (
    <View style={{ gap: Spacing.one }}>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <View
          style={{
            height: WEIGHT_CHART_HEIGHT,
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10, lineHeight: 12 }}>
            {max.toFixed(1)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10, lineHeight: 12 }}>
            {min.toFixed(1)}
          </ThemedText>
        </View>
        <View
          style={{
            flex: 1,
            height: WEIGHT_CHART_HEIGHT,
            flexDirection: 'row',
            borderLeftWidth: 1,
            borderLeftColor: theme.border,
          }}>
          {points.map((p, i) => (
            <View key={`${p.date}-${i}`} style={{ flex: 1, height: WEIGHT_CHART_HEIGHT }}>
              <View
                style={{
                  position: 'absolute',
                  bottom: bottomFor(p.kg),
                  alignSelf: 'center',
                  width: DOT - 2,
                  height: DOT - 2,
                  borderRadius: DOT,
                  backgroundColor: theme.card,
                  borderWidth: 1.5,
                  borderColor: theme.textSecondary,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: bottomFor(p.trendKg),
                  alignSelf: 'center',
                  width: DOT,
                  height: DOT,
                  borderRadius: DOT,
                  backgroundColor: theme.tint,
                }}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>
          {dayLabel(points[0].date)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>
          {dayLabel(points[points.length - 1].date)}
        </ThemedText>
      </View>
    </View>
  );
}
