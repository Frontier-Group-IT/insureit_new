import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerSectionHeader({
  title,
  meta,
  action,
  compact = false,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {meta ? <Text numberOfLines={1} style={styles.meta}>{meta}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: partnerTheme.spacing.xl,
    marginBottom: partnerTheme.spacing.sm,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: partnerTheme.spacing.md,
  },
  rowCompact: {
    marginTop: partnerTheme.spacing.lg,
    marginBottom: 4,
    minHeight: 28,
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    color: partnerTheme.colors.inkMuted,
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-medium',
      default: undefined,
    }),
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },
  meta: {
    marginTop: 3,
    color: partnerTheme.colors.inkSubtle,
    ...partnerTheme.typography.caption,
  },
  action: {
    minHeight: partnerTheme.control.compactHeight,
    justifyContent: 'center',
  },
});
