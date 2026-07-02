import { Screen } from '@/components/screen';
import { EmptyState } from '@/components/ui/empty';

// Placeholder — the trends & analytics screen is being built.
export default function TrendsScreen() {
  return (
    <Screen title="Trends" subtitle="Your week at a glance">
      <EmptyState
        icon="trending-up-outline"
        title="Trends are coming"
        message="Charts, averages, weight trend, and a history calendar over your log."
      />
    </Screen>
  );
}
