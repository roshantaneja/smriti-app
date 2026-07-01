import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Spacing } from '@/constants/theme';
import { useStore } from '@/lib/store';

export default function SettingsScreen() {
  const usdaApiKey = useStore((s) => s.settings.usdaApiKey);
  const setUsdaApiKey = useStore((s) => s.setUsdaApiKey);
  const resetData = useStore((s) => s.resetData);

  const [keyBuffer, setKeyBuffer] = useState(usdaApiKey);
  const [saved, setSaved] = useState(false);

  const onSaveKey = () => {
    setUsdaApiKey(keyBuffer.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const onReset = () => {
    Alert.alert(
      'Reset all data?',
      'This permanently deletes your ingredients, recipes, and daily log, and resets goals to defaults. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetData();
            router.back();
          },
        },
      ],
    );
  };

  return (
    <Screen scroll title="Settings" edges={['bottom']}>
      <ThemedText type="smallBold">USDA API key</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Powers online food search against USDA FoodData Central. Grab a free key at
        https://fdc.nal.usda.gov/api-key-signup and paste it below.
      </ThemedText>
      <Card style={{ gap: Spacing.three }}>
        <Field
          label="API key"
          placeholder="Paste your key"
          value={keyBuffer}
          onChangeText={setKeyBuffer}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button title={saved ? 'Saved ✓' : 'Save key'} onPress={onSaveKey} />
      </Card>

      <ThemedText type="smallBold">Profile</ThemedText>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Profile and personalization are coming in a later version.
        </ThemedText>
      </Card>

      <ThemedText type="smallBold">Data</ThemedText>
      <Card>
        <Button title="Reset all data" variant="danger" onPress={onReset} />
      </Card>
    </Screen>
  );
}
