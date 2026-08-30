import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerCard({
  children,
  tone = 'default',
  padded = true,
  style,
}: PropsWithChildren<{
  tone?: 'default' | 'muted' | 'brand' | 'success' | 'warning' | 'danger';
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}>) {
  return <View style={[styles.base, styles[tone], padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: partnerTheme.radius.lg,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
    backgroundColor: partnerTheme.colors.surface,
  },
  padded: { padding: partnerTheme.spacing.lg },
  default: {},
  muted: { backgroundColor: partnerTheme.colors.surfaceMuted },
  brand: { backgroundColor: partnerTheme.colors.brandSoft, borderColor: '#D9D5FF' },
  success: { backgroundColor: partnerTheme.colors.successSoft, borderColor: '#CFE9DB' },
  warning: { backgroundColor: partnerTheme.colors.warningSoft, borderColor: '#F5DFC1' },
  danger: { backgroundColor: partnerTheme.colors.dangerSoft, borderColor: '#F2C8C5' },
});
