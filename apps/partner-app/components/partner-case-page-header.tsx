import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { partnerTheme } from '@/lib/theme';

/** Matches the Policy Details navy title strip on nested Partner pages. */
export function PartnerCasePageHeader({ title, icon, onBack }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onBack: () => void;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.headerTitleRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8}
          style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Ionicons name={icon} size={23} color="#FFFFFF" />
        <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  pageHeader: { height: 52, marginHorizontal: -partnerTheme.spacing.lg, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#0A234A', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#244269' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBackButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: -0.12 },
  pressed: { opacity: 0.65 },
});
