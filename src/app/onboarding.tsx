import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRESETS } from '@/lib/presets';
import { useStore } from '@/lib/store';

export default function OnboardingScreen() {
  const theme = useTheme();
  const setPreset = useStore((s) => s.setPreset);
  const setHasOnboarded = useStore((s) => s.setHasOnboarded);

  const [selectedId, setSelectedId] = useState(PRESETS[0].id);
  const selected = PRESETS.find((p) => p.id === selectedId) ?? PRESETS[0];

  const start = () => {
    setPreset(selected.goals);
    setHasOnboarded(true);
  };
  const skip = () => setHasOnboarded(true);

  return (
    <Screen scroll title="Welcome to Smriti" subtitle="A private, on-device nutrition tracker for home cooks.">
      <ThemedText type="small" themeColor="textSecondary">
        Pick a starting point for your daily goals. You can fine-tune every number later on the Goals tab.
      </ThemedText>

      {PRESETS.map((p) => {
        const active = p.id === selectedId;
        const g = p.goals;
        return (
          <Pressable key={p.id} onPress={() => setSelectedId(p.id)}>
            <Card
              style={{
                gap: Spacing.two,
                borderColor: active ? theme.tint : theme.border,
                borderWidth: active ? 2 : 1,
                backgroundColor: active ? theme.tintSoft : theme.card,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                  {p.name}
                </ThemedText>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: Radius.pill,
                    borderWidth: 2,
                    borderColor: active ? theme.tint : theme.border,
                    backgroundColor: active ? theme.tint : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {active ? <View style={{ width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: '#fff' }} /> : null}
                </View>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {p.tagline}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                <ThemedText type="smallBold" style={{ color: MacroColors.calories }}>{g.calories} kcal</ThemedText>
                {`  ·  ${g.protein}P · ${g.carbs}C · ${g.fat}F · ${g.fiber} fiber`}
              </ThemedText>
            </Card>
          </Pressable>
        );
      })}

      <Button title={`Start with ${selected.name}`} onPress={start} />
      <Button title="Skip for now" variant="ghost" onPress={skip} />
    </Screen>
  );
}
