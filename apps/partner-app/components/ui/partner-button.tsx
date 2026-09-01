import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function PartnerButton({
  label,
  onPress,
  variant = 'primary',
  size = 'regular',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  trailing,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'compact' | 'regular';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  trailing?: ReactNode;
}) {
  const blocked = disabled || loading;
  const foreground = variant === 'primary'
    ? partnerTheme.colors.white
    : variant === 'danger'
      ? partnerTheme.colors.danger
      : partnerTheme.colors.brandStrong;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'compact' ? styles.compact : styles.regular,
        fullWidth && styles.fullWidth,
        styles[variant],
        pressed && !blocked && styles.pressed,
        blocked && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'compact' ? 16 : 18} color={foreground} />
      ) : null}
      <Text style={[styles.label, size === 'compact' && styles.labelCompact, { color: foreground }]}>{label}</Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: partnerTheme.control.minTouchTarget,
    paddingHorizontal: 16,
    borderRadius: partnerTheme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  regular: { minHeight: partnerTheme.control.buttonHeight },
  compact: { minHeight: partnerTheme.control.compactHeight, paddingHorizontal: 13 },
  fullWidth: { alignSelf: 'stretch' },
  primary: {
    backgroundColor: partnerTheme.colors.brandStrong,
    borderColor: partnerTheme.colors.brandStrong,
  },
  secondary: {
    backgroundColor: partnerTheme.colors.surface,
    borderColor: partnerTheme.colors.lineStrong,
  },
  danger: {
    backgroundColor: partnerTheme.colors.dangerSoft,
    borderColor: '#F2C8C5',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  label: { ...partnerTheme.typography.label },
  labelCompact: { fontSize: 10.5, lineHeight: 15 },
  trailing: { marginLeft: 2 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.42 },
});
