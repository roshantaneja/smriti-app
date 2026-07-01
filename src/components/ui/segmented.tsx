import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A horizontally scrollable row of selectable chips (single-select). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              paddingVertical: Spacing.two,
              paddingHorizontal: Spacing.three,
              borderRadius: Radius.pill,
              backgroundColor: active ? theme.tint : theme.backgroundSelected,
            }}>
            <ThemedText type="small" style={{ color: active ? '#fff' : theme.text, fontWeight: '600' }}>
              {opt.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A single toggle chip (used for recipe tags). */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.two + 2,
        borderRadius: Radius.pill,
        backgroundColor: active ? theme.tintSoft : theme.backgroundSelected,
        borderWidth: 1,
        borderColor: active ? theme.tint : 'transparent',
      }}>
      <ThemedText type="small" style={{ color: active ? theme.tint : theme.textSecondary, fontWeight: '600' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
