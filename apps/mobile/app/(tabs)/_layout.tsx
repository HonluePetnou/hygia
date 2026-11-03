import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { t } from '../../src/ui/i18n';
import { colors, fonts } from '../../src/ui/theme';

const glyph = (symbol: string) =>
  function TabGlyph({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20, fontFamily: fonts.bold }}>{symbol}</Text>;
  };

/** Barre d'onglets Patients / Saisie / Synchro / Scribe. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('mobile.tab.patients'), tabBarIcon: glyph('☺') }}
      />
      <Tabs.Screen name="saisie" options={{ title: t('mobile.tab.entry'), tabBarIcon: glyph('+') }} />
      <Tabs.Screen name="synchro" options={{ title: t('mobile.tab.sync'), tabBarIcon: glyph('⟳') }} />
      <Tabs.Screen name="scribe" options={{ title: t('mobile.tab.scribe'), tabBarIcon: glyph('♪') }} />
    </Tabs>
  );
}
