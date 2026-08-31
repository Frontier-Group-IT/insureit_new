import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

export function PartnerListRow({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  showChevron = Boolean(onPress),
  divider = true,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  showChevron?: boolean;
  divider?: boolean;
}) {
  const body = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text numberOfLines={1} style={styles.meta}>{meta}</Text> : null}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {showChevron ? <Ionicons name="chevron-forward" size={17} color="#9CA6B5" /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, divider && styles.divider]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel || [title, subtitle, meta].filter(Boolean).join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  leading: { flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  subtitle: {
    marginTop: 2,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  meta: {
    maxWidth: '34%',
    color: partnerTheme.colors.inkMuted,
    textAlign: 'right',
    ...partnerTheme.typography.caption,
  },
  trailing: { flexShrink: 0 },
  pressed: { opacity: 0.72 },
});
