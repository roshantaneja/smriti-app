import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EmptyState({
  icon = 'leaf-outline',
  title,
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: Spacing.five, gap: Spacing.two }}>
      <Ionicons name={icon} size={40} color={theme.textSecondary} />
      <ThemedText type="subtitle" style={{ fontSize: 20, lineHeight: 26, textAlign: 'center' }}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 300 }}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}
