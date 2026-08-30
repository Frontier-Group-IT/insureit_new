import { StyleSheet, Text } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerStatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return <Text accessibilityRole="text" style={[styles.base, styles[tone]]}>{label}</Text>;
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderRadius: partnerTheme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    ...partnerTheme.typography.meta,
  },
  neutral: { color: partnerTheme.colors.inkMuted, backgroundColor: partnerTheme.colors.surfaceMuted },
  brand: { color: partnerTheme.colors.brandStrong, backgroundColor: partnerTheme.colors.brandSoft },
  success: { color: partnerTheme.colors.success, backgroundColor: partnerTheme.colors.successSoft },
  warning: { color: '#9A5B12', backgroundColor: partnerTheme.colors.warningSoft },
  danger: { color: '#A7372D', backgroundColor: partnerTheme.colors.dangerSoft },
  info: { color: partnerTheme.colors.info, backgroundColor: partnerTheme.colors.infoSoft },
});
