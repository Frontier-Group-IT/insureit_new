import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerSectionHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: partnerTheme.spacing.lg,
    marginBottom: 6,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: partnerTheme.spacing.md,
  },
  text: { flex: 1 },
  title: {
    color: partnerTheme.colors.inkMuted,
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-medium',
      default: undefined,
    }),
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  meta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
});
