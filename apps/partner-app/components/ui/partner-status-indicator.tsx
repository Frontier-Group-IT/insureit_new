import { StyleSheet, Text, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const toneColors: Record<Tone, string> = {
  neutral: partnerTheme.colors.inkMuted,
  brand: partnerTheme.colors.brand,
  success: partnerTheme.colors.success,
  warning: partnerTheme.colors.warning,
  danger: partnerTheme.colors.danger,
  info: partnerTheme.colors.info,
};

export function PartnerStatusIndicator({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: Tone;
}) {
  const color = toneColors[tone];
  return (
    <View accessibilityLabel={label} accessibilityRole="text" style={styles.root}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: partnerTheme.radius.pill,
  },
  label: {
    ...partnerTheme.typography.caption,
  },
});
