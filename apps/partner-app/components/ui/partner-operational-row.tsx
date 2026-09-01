import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

export function PartnerOperationalRow({
  title,
  subtitle,
  detail,
  value,
  meta,
  leading,
  status,
  trailing,
  onPress,
  accessibilityLabel,
  divider = true,
  dense = false,
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  value?: string;
  meta?: string;
  leading?: ReactNode;
  status?: ReactNode;
  trailing?: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  divider?: boolean;
  dense?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || [title, subtitle, detail, value, meta].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        dense && styles.rowDense,
        divider && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}

      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          {status ? <View style={styles.status}>{status}</View> : null}
        </View>

        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
        {detail ? <Text numberOfLines={1} style={styles.detail}>{detail}</Text> : null}

        {(value || meta) ? (
          <View style={styles.bottomLine}>
            {value ? <Text numberOfLines={1} style={styles.value}>{value}</Text> : <View />}
            {meta ? <Text numberOfLines={1} style={styles.meta}>{meta}</Text> : null}
          </View>
        ) : null}
      </View>

      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      <Ionicons name="chevron-forward" size={15} color={partnerTheme.colors.inkSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 2,
    backgroundColor: partnerTheme.colors.surface,
  },
  rowDense: {
    minHeight: 64,
    paddingVertical: 5,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  leading: { flexShrink: 0 },
  body: { flex: 1, minWidth: 0 },
  titleLine: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
    color: partnerTheme.colors.ink,
    ...partnerTheme.typography.bodyStrong,
  },
  status: { flexShrink: 0 },
  subtitle: {
    marginTop: 1,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  detail: {
    marginTop: 1,
    color: partnerTheme.colors.inkSubtle,
    ...partnerTheme.typography.meta,
  },
  bottomLine: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  value: {
    flex: 1,
    minWidth: 0,
    color: partnerTheme.colors.ink,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  meta: {
    flexShrink: 0,
    maxWidth: '44%',
    color: partnerTheme.colors.inkMuted,
    textAlign: 'right',
    ...partnerTheme.typography.meta,
  },
  trailing: { flexShrink: 0 },
  pressed: { backgroundColor: partnerTheme.colors.pressed },
});
