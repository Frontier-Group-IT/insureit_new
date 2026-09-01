import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function PartnerBanner({
  title,
  message,
  tone = 'info',
  icon,
}: {
  title?: string;
  message: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  icon?: IconName;
}) {
  const iconName = icon ?? (tone === 'success' ? 'checkmark-circle-outline' : tone === 'warning' ? 'warning-outline' : tone === 'danger' ? 'alert-circle-outline' : 'information-circle-outline');
  const iconColor = tone === 'success' ? partnerTheme.colors.success : tone === 'warning' ? partnerTheme.colors.warning : tone === 'danger' ? partnerTheme.colors.danger : partnerTheme.colors.info;

  return (
    <View accessibilityLiveRegion="polite" style={[styles.base, styles[tone]]}>
      <Ionicons name={iconName} size={17} color={iconColor} />
      <View style={styles.body}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 9, paddingHorizontal: 2, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  info: { backgroundColor: partnerTheme.colors.infoSoft, borderColor: '#C9D9EE' },
  success: { backgroundColor: partnerTheme.colors.successSoft, borderColor: '#CFE9DB' },
  warning: { backgroundColor: partnerTheme.colors.warningSoft, borderColor: '#F5DFC1' },
  danger: { backgroundColor: partnerTheme.colors.dangerSoft, borderColor: '#F2C8C5' },
  body: { flex: 1 },
  title: { color: partnerTheme.colors.ink, ...partnerTheme.typography.label },
  message: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
});
