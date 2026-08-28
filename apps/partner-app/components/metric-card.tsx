import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function MetricCard({ icon, label, value, hint }: { icon: IconName; label: string; value: number; hint?: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}><Ionicons name={icon} size={17} color={partnerTheme.colors.brand} /></View>
        <Text style={styles.value}>{value}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 145,
    borderRadius: partnerTheme.radius.lg,
    backgroundColor: partnerTheme.colors.surface,
    padding: 16,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
    ...partnerTheme.shadow,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  value: { color: partnerTheme.colors.ink, fontSize: 24, fontWeight: '700' },
  label: { marginTop: 13, color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '700' },
  hint: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 9.5, lineHeight: 14 },
});
