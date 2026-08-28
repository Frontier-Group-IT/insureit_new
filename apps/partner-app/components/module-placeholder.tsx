import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function ModulePlaceholder({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.copy}>{copy}</Text>
      <View style={styles.status}><Text style={styles.statusText}>FOUNDATION READY · DATA CONTRACT NEXT</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10, alignItems: 'center', borderRadius: partnerTheme.radius.xl, paddingHorizontal: 25, paddingVertical: 34, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line, ...partnerTheme.shadow },
  icon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  title: { marginTop: 17, color: partnerTheme.colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  copy: { marginTop: 8, maxWidth: 330, color: partnerTheme.colors.inkMuted, fontSize: 10.5, lineHeight: 17, textAlign: 'center' },
  status: { marginTop: 18, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: partnerTheme.colors.surfaceMuted },
  statusText: { color: partnerTheme.colors.inkMuted, fontSize: 7.5, fontWeight: '800', letterSpacing: 0.75 },
});
