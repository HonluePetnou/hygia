import { observer } from 'mobx-react-lite';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VITAL_FIELDS, type VitalField } from '../../src/offline/vitals';
import { t } from '../../src/ui/i18n';
import { useRuntime } from '../../src/ui/runtime-context';
import { colors, fonts } from '../../src/ui/theme';

/** Écran « Saisie » : constantes, observation de soins, horloge, enregistrement local. */
const EntryScreen = observer(function EntryScreen() {
  const { entry, patients } = useRuntime();
  const offline = !patients.connectivity.online;

  if (entry.patientId === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Text style={styles.title}>{t('mobile.entry.title')}</Text>
        <Text style={styles.empty}>{t('mobile.entry.noPatient')}</Text>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('mobile.entry.title')}</Text>
        <Text style={styles.subtitle}>{entry.header}</Text>
        <View style={[styles.banner, offline ? styles.offline : styles.online]}>
          <Text style={styles.bannerText}>
            {t(offline ? 'mobile.entry.offlineBanner' : 'mobile.entry.onlineBanner')}
          </Text>
        </View>
        <View style={styles.grid}>
          {VITAL_FIELDS.map((field) => (
            <VitalTile key={field} field={field} />
          ))}
        </View>
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>{t('mobile.entry.note')}</Text>
          <TextInput
            style={styles.note}
            multiline
            value={entry.note}
            onChangeText={entry.setNote}
            placeholder={t('mobile.entry.notePlaceholder')}
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel={t('mobile.entry.note')}
          />
        </View>
        <View style={styles.clock}>
          <Text style={styles.clockText}>{entry.clockLabel}</Text>
        </View>
        {entry.message !== '' && (
          <Text
            style={[styles.message, entry.outcome.kind === 'saved' ? styles.ok : styles.error]}
            accessibilityLiveRegion="polite"
          >
            {entry.message}
          </Text>
        )}
        <Pressable
          style={styles.save}
          onPress={() => void entry.save()}
          accessibilityRole="button"
        >
          <Text style={styles.saveText}>{`✓ ${t('mobile.entry.save')}`}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
});

export default EntryScreen;

const VitalTile = observer(function VitalTile({ field }: { field: VitalField }) {
  const { entry } = useRuntime();
  const abnormal = entry.abnormal.has(field);
  return (
    <View style={[styles.tile, abnormal && styles.tileAbnormal]}>
      <Text style={styles.tileLabel}>{t(`mobile.vital.${field}`)}</Text>
      <View style={styles.tileValue}>
        <TextInput
          style={[styles.input, abnormal && styles.inputAbnormal]}
          value={entry.input[field]}
          onChangeText={(text) => entry.setField(field, text)}
          keyboardType={field === 'bp' ? 'numbers-and-punctuation' : 'decimal-pad'}
          placeholder="–"
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={`${t(`mobile.vital.${field}`)} (${t(`mobile.unit.${field}`)})`}
          accessibilityHint={abnormal ? t('mobile.entry.abnormal') : undefined}
        />
        <Text style={styles.unit}>{t(`mobile.unit.${field}`)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  content: { padding: 16, gap: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSubtle },
  empty: { fontFamily: fonts.medium, color: colors.textMuted, marginTop: 24 },
  banner: { borderRadius: 12, borderWidth: 1, padding: 12 },
  offline: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  online: { backgroundColor: colors.successSoft, borderColor: colors.success },
  bannerText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  tileAbnormal: { borderColor: colors.warning, borderWidth: 2 },
  tileLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  tileValue: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  input: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.ink, minWidth: 70, padding: 0 },
  inputAbnormal: { color: colors.warning },
  unit: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSubtle },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  noteTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  note: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, minHeight: 80 },
  clock: { backgroundColor: colors.ink, borderRadius: 10, padding: 12 },
  clockText: { fontFamily: 'monospace', fontSize: 13, color: '#9fe8d8' },
  message: { fontFamily: fonts.semibold, fontSize: 14 },
  ok: { color: colors.successText },
  error: { color: colors.danger },
  save: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  saveText: { fontFamily: fonts.bold, fontSize: 16, color: '#ffffff' },
});
