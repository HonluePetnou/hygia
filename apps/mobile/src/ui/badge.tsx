import { StyleSheet, Text, View } from 'react-native';
import { badgeTones, fonts, type BadgeTone } from './theme.js';

/** Pastille de statut (même famille que les badges du web). */
export function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  const { background, color } = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: background }]} accessibilityRole="text">
      <Text style={[styles.label, { color }]}>{`● ${label}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  label: { fontFamily: fonts.semibold, fontSize: 12 },
});
