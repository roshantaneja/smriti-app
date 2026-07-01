import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { MacroColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/lib/store';
import type { Ingredient } from '@/lib/types';
import { searchFoods } from '@/services/usda';

type IngredientDraft = Omit<Ingredient, 'id'>;

export default function FoodSearchScreen() {
  const usdaApiKey = useStore((s) => s.settings.usdaApiKey);

  if (!usdaApiKey) {
    return (
      <Screen title="Search foods" subtitle="USDA FoodData Central">
        <Card style={{ gap: Spacing.three }}>
          <ThemedText type="smallBold">A free USDA key is required</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Online search uses USDA FoodData Central. Grab a free API key from
            fdc.nal.usda.gov and add it in Settings to search millions of foods.
          </ThemedText>
          <Button title="Open Settings" onPress={() => router.push('/settings')} />
        </Card>
      </Screen>
    );
  }

  return <SearchBody apiKey={usdaApiKey} />;
}

function SearchBody({ apiKey }: { apiKey: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<IngredientDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // All synchronous state transitions live in the handler (not the effect) so
  // the effect only schedules the debounced fetch — keeps the react-compiler
  // lint rules happy and stale responses invalidated per keystroke.
  const onChangeQuery = (text: string) => {
    setQ(text);
    reqId.current += 1;
    setError(null);
    if (text.trim()) {
      setLoading(true);
    } else {
      setResults([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    const term = q.trim();
    if (!term) return;

    const id = reqId.current;

    const timer = setTimeout(async () => {
      try {
        const found = await searchFoods(term, apiKey);
        if (id !== reqId.current) return;
        setResults(found);
        setError(null);
      } catch (e) {
        if (id !== reqId.current) return;
        setResults([]);
        setError(e instanceof Error ? e.message : 'generic');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [q, apiKey]);

  return (
    <Screen title="Search foods" subtitle="USDA FoodData Central">
      <Field
        placeholder="Search USDA foods…"
        value={q}
        onChangeText={onChangeQuery}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus
      />
      <Body q={q} loading={loading} error={error} results={results} />
    </Screen>
  );
}

function Body({
  q,
  loading,
  error,
  results,
}: {
  q: string;
  loading: boolean;
  error: string | null;
  results: IngredientDraft[];
}) {
  const theme = useTheme();
  const term = q.trim();

  if (!term) {
    return (
      <Message icon="search-outline">
        Type a food name to search USDA FoodData Central.
      </Message>
    );
  }

  if (loading) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.four }}>
          <ActivityIndicator color={theme.tint} />
          <ThemedText type="small" themeColor="textSecondary">
            Searching…
          </ThemedText>
        </View>
      </Card>
    );
  }

  if (error) {
    if (error === 'rate_limit') {
      return <Message icon="time-outline">USDA rate limit reached — try again in a moment.</Message>;
    }
    if (error === 'bad_key') {
      return (
        <Card style={{ gap: Spacing.three }}>
          <View style={{ alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three }}>
            <Ionicons name="key-outline" size={32} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              That USDA API key was rejected. Check it in Settings.
            </ThemedText>
          </View>
          <Button title="Open Settings" variant="secondary" onPress={() => router.push('/settings')} />
        </Card>
      );
    }
    return (
      <Message icon="cloud-offline-outline">Couldn&apos;t reach USDA. Check your connection.</Message>
    );
  }

  if (results.length === 0) {
    return <Message icon="search-outline">No matches for “{term}”.</Message>;
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {results.map((draft, i) => (
        <ResultRow key={`${draft.fdcId ?? draft.name}-${i}`} draft={draft} first={i === 0} />
      ))}
    </Card>
  );
}

function ResultRow({ draft, first }: { draft: IngredientDraft; first: boolean }) {
  const theme = useTheme();
  const p = draft.per100g;
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/food/new', params: { prefill: JSON.stringify(draft) } })
      }
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        padding: Spacing.three,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.border,
      }}>
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold">{draft.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {draft.category}
        </ThemedText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <ThemedText type="smallBold" style={{ color: MacroColors.calories }}>
          {p.calories ?? 0} kcal
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {p.protein ?? 0}P · {p.carbs ?? 0}C · {p.fat ?? 0}F
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

function Message({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four }}>
        <Ionicons name={icon} size={32} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {children}
        </ThemedText>
      </View>
    </Card>
  );
}
