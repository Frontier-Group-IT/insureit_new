import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

export function PartnerContactActions({
  phone,
  email,
  compact = false,
}: {
  phone?: string | null;
  email?: string | null;
  compact?: boolean;
}) {
  const normalizedPhone = lastTen(phone || '');

  return (
    <View style={[styles.row, compact && styles.compactRow]}>
      <Action
        icon="call-outline"
        label="Call"
        disabled={!normalizedPhone}
        compact={compact}
        onPress={() => normalizedPhone ? void Linking.openURL(`tel:+91${normalizedPhone}`) : undefined}
      />
      <Action
        icon="logo-whatsapp"
        label="WhatsApp"
        disabled={!normalizedPhone}
        compact={compact}
        onPress={() => normalizedPhone ? void Linking.openURL(`https://wa.me/91${normalizedPhone}`) : undefined}
      />
      {!compact ? (
        <Action
          icon="mail-outline"
          label="Email"
          disabled={!email}
          compact={compact}
          onPress={() => email ? void Linking.openURL(`mailto:${email}`) : undefined}
        />
      ) : null}
    </View>
  );
}

function Action({
  icon,
  label,
  disabled,
  compact,
  onPress,
}: {
  icon: 'call-outline' | 'logo-whatsapp' | 'mail-outline';
  label: string;
  disabled: boolean;
  compact: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [
        styles.action,
        compact && styles.compactAction,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={compact ? 16 : 18} color={disabled ? '#AAB2C0' : partnerTheme.colors.brand} />
      {!compact ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

function lastTen(value: string) {
  return value.replace(/\D/g, '').slice(-10);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  compactRow: { gap: 5 },
  action: {
    flex: 1,
    minHeight: partnerTheme.control.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: partnerTheme.radius.md,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  compactAction: {
    flex: 0,
    width: partnerTheme.control.minTouchTarget,
    height: partnerTheme.control.minTouchTarget,
    borderRadius: 14,
  },
  label: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
});
