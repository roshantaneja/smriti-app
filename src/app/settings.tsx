import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Spacing } from '@/constants/theme';
import { dayTotalsToCsv, logToCsv, weightsToCsv } from '@/lib/csv';
import { dayKey } from '@/lib/date';
import { useStore } from '@/lib/store';

export default function SettingsScreen() {
  const usdaApiKey = useStore((s) => s.settings.usdaApiKey);
  const setUsdaApiKey = useStore((s) => s.setUsdaApiKey);
  const resetData = useStore((s) => s.resetData);
  const log = useStore((s) => s.log);
  const weights = useStore((s) => s.weights);
  const getIngredient = useStore((s) => s.getIngredient);
  const getRecipe = useStore((s) => s.getRecipe);

  const [keyBuffer, setKeyBuffer] = useState(usdaApiKey);
  const [saved, setSaved] = useState(false);

  const onSaveKey = () => {
    setUsdaApiKey(keyBuffer.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // Write the CSV to the app cache and hand it to the system share sheet.
  const exportCsv = async (basename: string, build: () => string) => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
        return;
      }
      const file = new File(Paths.cache, `${basename}-${dayKey()}.csv`);
      file.write(build());
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not export the CSV file.');
    }
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
      <ThemedText type="smallBold">Daily goals</ThemedText>
      <Card>
        <Button
          title="Edit goals & presets"
          variant="secondary"
          onPress={() => router.push('/goals')}
        />
      </Card>

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

      <ThemedText type="smallBold">Export</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Share your data as CSV files — open them in any spreadsheet.
      </ThemedText>
      <Card style={{ gap: Spacing.three }}>
        <Button
          title="Export food log (CSV)"
          variant="secondary"
          onPress={() => exportCsv('smriti-food-log', () => logToCsv(log, { getIngredient, getRecipe }))}
        />
        <Button
          title="Export day totals (CSV)"
          variant="secondary"
          onPress={() => exportCsv('smriti-day-totals', () => dayTotalsToCsv(log, { getIngredient, getRecipe }))}
        />
        <Button
          title="Export weights (CSV)"
          variant="secondary"
          onPress={() => exportCsv('smriti-weights', () => weightsToCsv(weights))}
        />
      </Card>

      <ThemedText type="smallBold">Data</ThemedText>
      <Card>
        <Button title="Reset all data" variant="danger" onPress={onReset} />
      </Card>
    </Screen>
  );
}
