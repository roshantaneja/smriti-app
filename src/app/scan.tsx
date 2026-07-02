import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchProduct } from '@/services/openFoodFacts';

type Status =
  | { kind: 'scanning' }
  | { kind: 'looking-up' }
  | { kind: 'not-found'; barcode: string }
  | { kind: 'error' };

/** Hand off to the manual add-ingredient form (used from every dead-end here). */
function enterManually() {
  router.replace('/food/new');
}

export default function ScanScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>({ kind: 'scanning' });

  const busy = status.kind !== 'scanning';

  const handleScanned = async ({ data }: { data: string }) => {
    setStatus({ kind: 'looking-up' });
    try {
      const draft = await fetchProduct(data);
      if (draft) {
        router.replace({ pathname: '/food/new', params: { prefill: JSON.stringify(draft) } });
      } else {
        setStatus({ kind: 'not-found', barcode: data });
      }
    } catch {
      setStatus({ kind: 'error' });
    }
  };

  // Permission still loading (null on first render).
  if (!permission) {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <Card style={styles.centerCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Preparing camera…
          </ThemedText>
        </Card>
      </Screen>
    );
  }

  // Permission not granted — centered prompt.
  if (!permission.granted) {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <View style={styles.promptWrap}>
          <Card style={styles.centerCard}>
            <Ionicons name="camera-outline" size={40} color={theme.tint} />
            <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
              Camera access needed
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              Point your camera at a product barcode to look it up on Open Food Facts and prefill the
              ingredient.
            </ThemedText>
            <View style={{ gap: Spacing.two, width: '100%' }}>
              <Button title="Grant camera access" onPress={requestPermission} />
              <Button title="Enter manually" variant="ghost" onPress={enterManually} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={busy ? undefined : handleScanned}
      />

      {/* Framing guide */}
      <View style={[styles.overlayFill, styles.frameLayer]} pointerEvents="none">
        <View style={[styles.frame, { borderColor: 'rgba(255,255,255,0.9)' }]} />
        <View style={styles.hintPill}>
          <ThemedText type="small" style={{ color: '#fff' }}>
            Point at a barcode
          </ThemedText>
        </View>
      </View>

      {/* Looking-up spinner overlay */}
      {status.kind === 'looking-up' ? (
        <View style={[styles.overlayFill, styles.statusLayer]}>
          <Card style={styles.centerCard}>
            <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
              Looking up product…
            </ThemedText>
            <Button title="Looking up" loading disabled onPress={() => {}} style={{ width: '100%' }} />
          </Card>
        </View>
      ) : null}

      {/* Not-found overlay */}
      {status.kind === 'not-found' ? (
        <View style={[styles.overlayFill, styles.statusLayer]}>
          <Card style={styles.centerCard}>
            <Ionicons name="help-circle-outline" size={36} color={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
              No product found for {status.barcode}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              It may not be in the Open Food Facts database yet.
            </ThemedText>
            <View style={{ gap: Spacing.two, width: '100%' }}>
              <Button title="Scan again" onPress={() => setStatus({ kind: 'scanning' })} />
              <Button title="Enter manually" variant="ghost" onPress={enterManually} />
            </View>
          </Card>
        </View>
      ) : null}

      {/* Error overlay */}
      {status.kind === 'error' ? (
        <View style={[styles.overlayFill, styles.statusLayer]}>
          <Card style={styles.centerCard}>
            <Ionicons name="cloud-offline-outline" size={36} color={theme.danger} />
            <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
              Couldn&apos;t reach Open Food Facts. Check your connection.
            </ThemedText>
            <View style={{ gap: Spacing.two, width: '100%' }}>
              <Button title="Try again" onPress={() => setStatus({ kind: 'scanning' })} />
              <Button title="Enter manually" variant="ghost" onPress={enterManually} />
            </View>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  promptWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  centerCard: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  overlayFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  frameLayer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  frame: {
    width: '72%',
    aspectRatio: 1.6,
    borderWidth: 2,
    borderRadius: Radius.lg,
    backgroundColor: 'transparent',
  },
  hintPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  statusLayer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
});
