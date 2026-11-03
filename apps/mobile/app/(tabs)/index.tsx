import { useFocusEffect, useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PatientCard } from '../../src/view-models/patients-view-model';
import { Badge } from '../../src/ui/badge';
import { t } from '../../src/ui/i18n';
import { useRuntime } from '../../src/ui/runtime-context';
import { colors, fonts, type BadgeTone } from '../../src/ui/theme';

const TONES: Record<PatientCard['status']['kind'], BadgeTone> = {
  synced: 'success',
  pending: 'warning',
  conflict: 'danger',
};

/** Écran « Patients » : dossiers locaux, recherche, statut de synchronisation. */
const PatientsScreen = observer(function PatientsScreen() {
  const { patients, entry } = useRuntime();
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      void patients.load();
    }, [patients]),
  );
  const banner = patients.banner;

  const open = (id: string) => {
    void entry.open(id).then(() => router.navigate('/saisie'));
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={patients.cards}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{patients.greeting}</Text>
            <Text style={styles.subtitle}>{patients.profile}</Text>
            <View style={[styles.banner, banner.tone === 'offline' ? styles.offline : styles.online]}>
              <Text style={styles.bannerText}>{banner.text}</Text>
            </View>
            <TextInput
              style={styles.search}
              placeholder={patients.searchPlaceholder}
              placeholderTextColor={colors.textSubtle}
              value={patients.search.query}
              onChangeText={(text) => void patients.search.setQuery(text)}
              accessibilityLabel={patients.searchPlaceholder}
            />
            <Text style={styles.section}>{t('mobile.patients.section').toUpperCase()}</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{patients.search.emptyMessage ?? t('mobile.patients.empty')}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => open(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.statusLabel}`}
          >
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.initials}>{item.initials}</Text>
              </View>
              <View style={styles.identity}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.subtitle}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
            <View style={[styles.row, styles.cardFooter]}>
              <Text style={styles.reason}>{item.reason}</Text>
              <Badge tone={TONES[item.status.kind]} label={item.statusLabel} />
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
});

export default PatientsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSubtle, marginBottom: 12 },
  banner: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  offline: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  online: { backgroundColor: colors.successSoft, borderColor: colors.success },
  bannerText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  search: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  section: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSubtle, marginTop: 16 },
  empty: { fontFamily: fonts.medium, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardFooter: { justifyContent: 'space-between' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: fonts.bold, color: colors.primary },
  identity: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSubtle },
  chevron: { fontSize: 22, color: colors.textSubtle },
  reason: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
});
