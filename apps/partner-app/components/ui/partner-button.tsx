import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function PartnerButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  trailing,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
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
        fullWidth && styles.fullWidth,
        styles[variant],
        pressed && !blocked && styles.pressed,
        blocked && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={foreground} />
      ) : null}
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: partnerTheme.control.buttonHeight,
    minWidth: partnerTheme.control.minTouchTarget,
    paddingHorizontal: 16,
    borderRadius: partnerTheme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  fullWidth: { alignSelf: 'stretch' },
  primary: { backgroundColor: partnerTheme.colors.brandStrong, borderColor: partnerTheme.colors.brandStrong },
  secondary: { backgroundColor: partnerTheme.colors.surface, borderColor: partnerTheme.colors.line },
  danger: { backgroundColor: '#FFF7F6', borderColor: '#F2C8C5' },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  label: { ...partnerTheme.typography.label },
  trailing: { marginLeft: 2 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.42 },
});
