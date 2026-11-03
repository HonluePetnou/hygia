import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScribeViewModel } from '@hygia/view-models';
import { t } from '../../src/ui/i18n';
import { useRuntime } from '../../src/ui/runtime-context';
import { colors, fonts } from '../../src/ui/theme';

const WAVE_BARS = 28;

/** Écran « Scribe » (maquette 18) : enregistrement, brouillon structuré « À valider », validation. */
const ScribeScreen = observer(function ScribeScreen() {
  const { entry, scribe } = useRuntime();
  if (entry.patientId === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Text style={styles.title}>{t('mobile.scribe.title')}</Text>
        <Text style={styles.empty}>{t('mobile.scribe.noPatient')}</Text>
      </SafeAreaView>
    );
  }
  const vm = scribe.forPatient(entry.patientId);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('mobile.scribe.title')}</Text>
        <Text style={styles.subtitle}>{t('mobile.scribe.subtitle', { patient: entry.header })}</Text>
        <ScribeBody vm={vm} />
      </ScrollView>
    </SafeAreaView>
  );
});

export default ScribeScreen;

const ScribeBody = observer(function ScribeBody({ vm }: { vm: ScribeViewModel }) {
  useEffect(() => {
    const timer = setInterval(() => vm.tick(), 200);
    return () => clearInterval(timer);
  }, [vm]);
  const busy = vm.state === 'saving';
  return (
    <>
      {vm.errorMessage !== '' && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {vm.errorMessage}
        </Text>
      )}
      {vm.state === 'idle' && (
        <Pressable style={styles.primary} onPress={() => void vm.start()} accessibilityRole="button">
          <Text style={styles.primaryText}>{t('scribe.start')}</Text>
        </Pressable>
      )}
      {vm.state === 'recording' && (
        <>
          <RecordingCard vm={vm} />
          <Pressable style={styles.primary} onPress={() => void vm.stop()} accessibilityRole="button">
            <Text style={styles.primaryText}>{t('scribe.stop')}</Text>
          </Pressable>
        </>
      )}
      {(vm.state === 'processing' || busy) && (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {t('scribe.processing')}
        </Text>
      )}
      {(vm.state === 'draft' || busy) && vm.draft !== null && <DraftCard vm={vm} busy={busy} />}
      {(vm.state === 'validated' || vm.state === 'rejected') && (
        <>
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {vm.outcomeMessage}
          </Text>
          <Pressable style={styles.secondary} onPress={() => vm.reset()} accessibilityRole="button">
            <Text style={styles.secondaryText}>{t('scribe.newConsultation')}</Text>
          </Pressable>
        </>
      )}
    </>
  );
});

const RecordingCard = observer(function RecordingCard({ vm }: { vm: ScribeViewModel }) {
  return (
    <View style={styles.recording}>
      <View style={styles.recordingHead}>
        <View style={styles.dot} />
        <Text style={styles.recordingText}>{`${t('scribe.recording')} · ${vm.durationLabel}`}</Text>
      </View>
      <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no">
        {Array.from({ length: WAVE_BARS }, (_, i) => (
          <View
            key={i}
            style={[styles.bar, { height: 6 + vm.level * 34 * Math.abs(Math.sin(i * 1.7)) }]}
          />
        ))}
      </View>
      <Text style={styles.notice}>{t('scribe.consentNotice')}</Text>
    </View>
  );
});

const DraftCard = observer(function DraftCard({ vm, busy }: { vm: ScribeViewModel; busy: boolean }) {
  return (
    <>
      <View style={styles.draft} accessibilityLabel={t('scribe.draftTitle')}>
        <View style={styles.draftHead}>
          <Text style={styles.draftTitle}>{`✦ ${t('scribe.draftTitle')}`}</Text>
          <Text style={styles.pill}>{t('scribe.toValidate')}</Text>
        </View>
        {vm.sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            {vm.editing && (section.key === 'motif' || section.key === 'examen') ? (
              <TextInput
                style={styles.input}
                multiline
                value={vm.draft?.[section.key] ?? ''}
                onChangeText={(text) => vm.setText(section.key as 'motif' | 'examen', text)}
                accessibilityLabel={section.title}
              />
            ) : section.lines.length === 0 ? (
              <Text style={styles.muted}>{t('scribe.nothing')}</Text>
            ) : (
              section.lines.map((line) => (
                <Text key={line} style={styles.line}>
                  {line}
                </Text>
              ))
            )}
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.secondary, styles.half]}
          disabled={busy}
          onPress={() => vm.toggleEditing()}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>
            {vm.editing ? t('scribe.doneCorrecting') : t('scribe.correct')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.primary, styles.half]}
          disabled={busy}
          onPress={() => void vm.validate()}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{`✓ ${t('scribe.validate')}`}</Text>
        </Pressable>
      </View>
      <Pressable disabled={busy} onPress={() => void vm.reject()} accessibilityRole="button">
        <Text style={styles.reject}>{t('scribe.reject')}</Text>
      </Pressable>
      <Text style={styles.footnote}>{t('scribe.noPersist')}</Text>
    </>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  content: { padding: 16, gap: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSubtle },
  empty: { fontFamily: fonts.medium, color: colors.textMuted, marginTop: 24 },
  error: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
  status: { fontFamily: fonts.semibold, fontSize: 14, color: colors.successText },
  recording: { backgroundColor: colors.ink, borderRadius: 18, padding: 18, gap: 12, alignItems: 'center' },
  recordingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e5484d' },
  recordingText: { fontFamily: fonts.bold, fontSize: 16, color: '#ffffff' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 44 },
  bar: { width: 4, borderRadius: 2, backgroundColor: '#5eead4' },
  notice: { fontFamily: fonts.regular, fontSize: 13, color: '#9fb0bf', textAlign: 'center' },
  draft: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#6750d8',
    padding: 16,
    gap: 10,
  },
  draftHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  draftTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  pill: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: '#4c3bb0',
    backgroundColor: '#eeebfc',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  section: { gap: 2 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSubtle, letterSpacing: 0.6 },
  line: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSubtle },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    minHeight: 60,
  },
  actions: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  primary: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, color: '#ffffff' },
  secondary: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
  },
  secondaryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  reject: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger, textAlign: 'center', padding: 6 },
  footnote: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSubtle },
});
