import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../../src/ui/i18n';
import { colors, fonts } from '../../src/ui/theme';

/** Écran « Scribe » : réservé (maquette 18, tâche suivante). */
export default function ScribeScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>{t('mobile.scribe.title')}</Text>
      <Text style={styles.text}>{t('mobile.scribe.soon')}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
});
