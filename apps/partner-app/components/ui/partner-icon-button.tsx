import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function PartnerIconButton({
  icon,
  label,
  onPress,
  disabled = false,
  tone = 'default',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'brand' | 'danger';
}) {
  const iconColor = tone === 'brand'
    ? partnerTheme.colors.brand
    : tone === 'danger'
      ? partnerTheme.colors.danger
      : partnerTheme.colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.touchTarget, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[styles.iconSurface, tone === 'brand' && styles.brandSurface, tone === 'danger' && styles.dangerSurface]}>
        <Ionicons name={icon} size={19} color={disabled ? '#AAB2C0' : iconColor} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    width: partnerTheme.control.minTouchTarget,
    height: partnerTheme.control.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSurface: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  brandSurface: { backgroundColor: partnerTheme.colors.brandSoft, borderColor: '#D9D5FF' },
  dangerSurface: { backgroundColor: partnerTheme.colors.dangerSoft, borderColor: '#F2C8C5' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.48 },
});
