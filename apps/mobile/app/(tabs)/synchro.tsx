import { useFocusEffect } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConflictCard, ConflictSide } from '../../src/view-models/sync-view-model';
import { Badge } from '../../src/ui/badge';
import { t } from '../../src/ui/i18n';
import { useRuntime } from '../../src/ui/runtime-context';
import { colors, fonts } from '../../src/ui/theme';

/** Écran « Synchro » : fusions sans perte et conflits à arbitrer. */
const SyncScreen = observer(function SyncScreen() {
  const { sync } = useRuntime();
  useFocusEffect(
    useCallback(() => {
      void sync.refresh();
    }, [sync]),
  );
  const hasReport = sync.report !== null;
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('mobile.sync.title')}</Text>
        <Text style={styles.subtitle}>{sync.subtitle}</Text>
        {hasReport && sync.report !== null && sync.report.merged.length > 0 && (
          <View>
            <View style={styles.merged}>
              <Text style={styles.mergedTitle}>{`✓ ${sync.mergedTitle}`}</Text>
              <Text style={styles.mergedHint}>{t('mobile.sync.mergedHint')}</Text>
            </View>
            {sync.mergedRows.map((row, index) => (
              <Text key={`${row}-${index}`} style={styles.mergedRow}>{`✓ ${row}`}</Text>
            ))}
          </View>
        )}
        {sync.conflictCards.map((card) => (
          <ConflictPanel key={card.id} card={card} />
        ))}
        {!hasReport && sync.conflicts.length === 0 && (
          <Text style={styles.empty}>{t('mobile.sync.none')}</Text>
        )}
        <Text style={styles.waiting}>{sync.waitingLabel}</Text>
        {sync.failureLabel !== '' && <Text style={styles.failure}>{sync.failureLabel}</Text>}
        <Pressable
          style={[styles.button, sync.syncing && styles.disabled]}
          disabled={sync.syncing}
          onPress={() => void sync.synchronise()}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{t('mobile.sync.now')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
});

export default SyncScreen;

const ConflictPanel = observer(function ConflictPanel({ card }: { card: ConflictCard }) {
  const { sync } = useRuntime();
  return (
    <View style={styles.conflict}>
      <View style={styles.conflictHead}>
        <Text style={styles.conflictTitle}>{`⑂ ${sync.conflictsTitle}`}</Text>
        <Badge tone="warning" label={t('mobile.sync.concurrent')} />
      </View>
      <Text style={styles.hint}>{t('mobile.sync.conflictHint')}</Text>
      <Text style={styles.heading}>{card.heading}</Text>
      {card.sides.map((side) => (
        <Version
          key={side.choice}
          side={side}
          selected={card.chosen === side.choice}
          onSelect={() => sync.choose(card.id, side.choice)}
        />
      ))}
      <Pressable
        style={styles.button}
        onPress={() => void sync.apply(card.id)}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{`✓ ${t('mobile.sync.apply')}`}</Text>
      </Pressable>
      <Text style={styles.audit}>{t('mobile.sync.auditNote')}</Text>
    </View>
  );
});

function Version({
  side,
  selected,
  onSelect,
}: {
  side: ConflictSide;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      style={[styles.version, selected && styles.versionSelected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${side.author} ${side.time} ${side.value}`}
    >
      <View style={styles.versionHead}>
        <Text style={styles.radio}>{selected ? '◉' : '○'}</Text>
        <Text style={styles.author}>{side.author}</Text>
        <Text style={styles.time}>{side.time}</Text>
      </View>
      <Text style={styles.value}>{side.value}</Text>
      <Text style={styles.clock}>{side.clock}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSubtle },
  empty: { fontFamily: fonts.medium, color: colors.textMuted, marginTop: 12 },
  merged: { backgroundColor: colors.successSoft, borderRadius: 14, borderWidth: 1, borderColor: '#bfe4d0', padding: 14 },
  mergedTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  mergedHint: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  mergedRow: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, paddingVertical: 4, paddingHorizontal: 6 },
  conflict: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.warning, padding: 14, gap: 10 },
  conflictHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conflictTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  heading: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSubtle },
  version: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  versionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft, borderWidth: 1.5 },
  versionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { fontSize: 18, color: colors.primary },
  author: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  time: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSubtle },
  value: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink },
  clock: { fontFamily: 'monospace', fontSize: 12, color: colors.textSubtle },
  audit: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  waiting: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  failure: { fontFamily: fonts.semibold, fontSize: 14, color: colors.warningText },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: '#ffffff' },
});
