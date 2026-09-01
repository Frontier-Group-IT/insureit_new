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
  dense = false,
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
  dense?: boolean;
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
      {showChevron ? <Ionicons name="chevron-forward" size={16} color={partnerTheme.colors.inkSubtle} /> : null}
    </>
  );

  const rowStyle = [styles.row, dense && styles.rowDense, divider && styles.divider];

  if (!onPress) {
    return <View style={rowStyle}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel || [title, subtitle, meta].filter(Boolean).join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
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
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: partnerTheme.radius.xs,
  },
  rowDense: {
    minHeight: 54,
    paddingVertical: 5,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  leading: { flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: partnerTheme.colors.ink,
    ...partnerTheme.typography.bodyStrong,
  },
  subtitle: {
    marginTop: 2,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  meta: {
    maxWidth: '36%',
    color: partnerTheme.colors.inkMuted,
    textAlign: 'right',
    ...partnerTheme.typography.caption,
  },
  trailing: { flexShrink: 0 },
  pressed: {
    backgroundColor: partnerTheme.colors.pressed,
    opacity: 0.96,
  },
});
