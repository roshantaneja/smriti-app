import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A thin colored progress bar that softly caps display at 100% (overflow tinted). */
export function Bar({ value, goal, color, height = 8 }: { value: number; goal: number; color: string; height?: number }) {
  const theme = useTheme();
  const ratio = goal > 0 ? value / goal : 0;
  const pct = Math.max(0, Math.min(1, ratio));
  const over = ratio > 1;
  return (
    <View style={{ height, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
      <View
        style={{
          height,
          width: `${pct * 100}%`,
          borderRadius: Radius.pill,
          backgroundColor: over ? theme.danger : color,
        }}
      />
    </View>
  );
}

/** A labeled macro row: name, value/goal, and a progress bar. */
export function MacroProgress({
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
  const remaining = Math.round(goal - value);
  return (
    <View style={{ gap: Spacing.one }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(value)}
          <ThemedText type="small" themeColor="textSecondary"> / {Math.round(goal)} {unit}</ThemedText>
        </ThemedText>
      </View>
      <Bar value={value} goal={goal} color={color} />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {remaining > 0 ? `${remaining} ${unit} to go` : `${Math.abs(remaining)} ${unit} over`}
      </ThemedText>
    </View>
  );
}
