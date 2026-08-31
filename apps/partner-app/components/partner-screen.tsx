import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { partnerTheme } from '@/lib/theme';

export function PartnerScreen({
  title,
  eyebrow,
  action,
  children,
  scrollProps,
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
}>) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        {...scrollProps}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={scrollProps?.keyboardShouldPersistTaps ?? 'handled'}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: partnerTheme.colors.canvas },
  content: {
    flexGrow: 1,
    paddingHorizontal: partnerTheme.spacing.lg,
    paddingBottom: 104,
  },
  header: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: partnerTheme.spacing.md,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: partnerTheme.colors.brand,
    letterSpacing: 1.35,
    ...partnerTheme.typography.eyebrow,
  },
  title: {
    marginTop: 2,
    color: partnerTheme.colors.ink,
    ...partnerTheme.typography.pageTitle,
  },
  action: {
    minWidth: partnerTheme.control.minTouchTarget,
    minHeight: partnerTheme.control.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
