import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createRuntime, type Runtime } from '../src/runtime/runtime';
import { RuntimeProvider } from '../src/ui/runtime-context';
import { colors } from '../src/ui/theme';

/** Mise en page racine : polices, base locale et vues-modèles avant d'afficher les écrans. */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [runtime, setRuntime] = useState<Runtime | null>(null);

  useEffect(() => {
    let created: Runtime | undefined;
    let cancelled = false;
    void createRuntime().then((value) => {
      if (cancelled) value.stop();
      else {
        created = value;
        setRuntime(value);
      }
    });
    return () => {
      cancelled = true;
      created?.stop();
    };
  }, []);

  if (!fontsLoaded || runtime === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <RuntimeProvider value={runtime}>
        <StatusBar style="dark" />
        <Slot />
      </RuntimeProvider>
    </SafeAreaProvider>
  );
}
