import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
};

/** Standard themed screen container: safe area + optional header + scroll body. */
export function Screen({ title, subtitle, right, children, scroll = true, edges = ['top'] }: Props) {
  const theme = useTheme();

  const header = title ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.three }}>
      <View style={{ flex: 1 }}>
        <ThemedText type="title" style={{ fontSize: 34, lineHeight: 40 }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </View>
  ) : null;

  const body = (
    <View style={{ width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three }}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{
            padding: Spacing.three,
            paddingBottom: BottomTabInset + Spacing.five,
            gap: Spacing.three,
          }}
          keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: Spacing.three }}>{body}</View>
      )}
    </SafeAreaView>
  );
}
