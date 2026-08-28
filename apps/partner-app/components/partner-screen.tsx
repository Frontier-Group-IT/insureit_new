import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { partnerTheme } from '@/lib/theme';

export function PartnerScreen({
  title,
  eyebrow,
  action,
  children,
}: PropsWithChildren<{ title: string; eyebrow?: string; action?: ReactNode }>) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: partnerTheme.colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingBottom: 116 },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1 },
  eyebrow: { color: partnerTheme.colors.brand, fontSize: 9, fontWeight: '800', letterSpacing: 1.55 },
  title: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '700' },
});
