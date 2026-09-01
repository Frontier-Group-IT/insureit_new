import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function PartnerTopBar({
  title,
  eyebrow,
  subtitle,
  onBack,
  backDisabled = false,
  action,
  actionIcon,
  actionLabel = 'Action',
  onAction,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  backDisabled?: boolean;
  action?: ReactNode;
  actionIcon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.root}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          accessibilityState={{ disabled: backDisabled }}
          disabled={backDisabled}
          hitSlop={4}
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, backDisabled && styles.disabled, pressed && !backDisabled && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={20} color={backDisabled ? partnerTheme.colors.inkSubtle : partnerTheme.colors.ink} />
        </Pressable>
      ) : null}

      <View style={styles.copy}>
        {eyebrow ? <Text numberOfLines={1} style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {action ? <View style={styles.action}>{action}</View> : null}
      {!action && actionIcon && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={4}
          onPress={onAction}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name={actionIcon} size={20} color={partnerTheme.colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: partnerTheme.spacing.sm,
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    marginBottom: 1,
    color: partnerTheme.colors.brand,
    letterSpacing: 1.15,
    ...partnerTheme.typography.eyebrow,
  },
  title: {
    color: partnerTheme.colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 1,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  iconButton: {
    width: partnerTheme.control.minTouchTarget,
    height: partnerTheme.control.minTouchTarget,
    borderRadius: partnerTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    minWidth: partnerTheme.control.minTouchTarget,
    minHeight: partnerTheme.control.minTouchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: partnerTheme.colors.pressed },
  disabled: { opacity: 0.45 },
});
