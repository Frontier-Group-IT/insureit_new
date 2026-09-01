import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

export function PartnerDisclosureRow({
  label,
  value,
  helper,
  leading,
  onPress,
  accessibilityLabel,
  divider = true,
}: {
  label: string;
  value?: string;
  helper?: string;
  leading?: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel || [label, value, helper].filter(Boolean).join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {helper ? <Text numberOfLines={1} style={styles.helper}>{helper}</Text> : null}
      </View>
      {value ? <Text numberOfLines={1} style={styles.value}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={partnerTheme.colors.inkSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: partnerTheme.spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: 2,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  leading: { flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  label: {
    color: partnerTheme.colors.ink,
    ...partnerTheme.typography.bodyStrong,
  },
  helper: {
    marginTop: 1,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  value: {
    maxWidth: '42%',
    color: partnerTheme.colors.inkMuted,
    textAlign: 'right',
    ...partnerTheme.typography.body,
  },
  pressed: { backgroundColor: partnerTheme.colors.pressed },
});
