import { StyleSheet, Text, View } from 'react-native';

import { PartnerCard } from '@/components/ui/partner-card';
import { partnerTheme } from '@/lib/theme';

export function PartnerMetricCard({
  value,
  label,
  meta,
}: {
  value: string | number;
  label: string;
  meta?: string;
}) {
  return (
    <PartnerCard style={styles.card}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </PartnerCard>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 96, justifyContent: 'center' },
  value: { color: partnerTheme.colors.ink, ...partnerTheme.typography.display },
  label: { marginTop: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  meta: { marginTop: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
});
