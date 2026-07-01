import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  size?: 'md' | 'sm';
};

export function Button({ title, variant = 'primary', loading, size = 'md', style, disabled, ...rest }: Props) {
  const theme = useTheme();

  const bg =
    variant === 'primary' ? theme.tint
    : variant === 'danger' ? theme.danger
    : variant === 'secondary' ? theme.backgroundSelected
    : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger' ? '#fff'
    : variant === 'ghost' ? theme.tint
    : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style as object,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <ThemedText style={{ color: fg, fontWeight: '700', fontSize: size === 'sm' ? 14 : 16 }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three - 2,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  sm: {
    minHeight: 38,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
