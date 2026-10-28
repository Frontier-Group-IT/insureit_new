import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

export function PartnerContactActions({
  phone,
  email,
  compact = false,
  iconOnlyVertical = false,
  inlineLabeled = false,
  customerDetailLayout = false,
}: {
  phone?: string | null;
  email?: string | null;
  compact?: boolean;
  iconOnlyVertical?: boolean;
  inlineLabeled?: boolean;
  customerDetailLayout?: boolean;
}) {
  const normalizedPhone = lastTen(phone || '');

  const iconMode = compact || iconOnlyVertical || inlineLabeled;

  return (
    <View style={[styles.row, compact && styles.compactRow, iconOnlyVertical && styles.verticalRow, inlineLabeled && styles.inlineLabeledRow, customerDetailLayout && styles.customerDetailRow]}>
      <Action
        icon="call-outline"
        label="Call"
        disabled={!normalizedPhone}
        compact={iconMode}
        inlineLabeled={inlineLabeled}
          customerDetailLayout={customerDetailLayout}
        onPress={() => normalizedPhone ? void Linking.openURL(`tel:+91${normalizedPhone}`) : undefined}
      />
      <Action
        icon="logo-whatsapp"
        label="WhatsApp"
        disabled={!normalizedPhone}
        compact={iconMode}
        inlineLabeled={inlineLabeled}
          customerDetailLayout={customerDetailLayout}
        onPress={() => normalizedPhone ? void Linking.openURL(`https://wa.me/91${normalizedPhone}`) : undefined}
      />
      {!compact || iconOnlyVertical || inlineLabeled ? (
        <Action
          icon="mail-outline"
          label="Email"
          disabled={!email}
          compact={iconMode}
        inlineLabeled={inlineLabeled}
          customerDetailLayout={customerDetailLayout}
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
  inlineLabeled = false,
  customerDetailLayout = false,
  onPress,
}: {
  icon: 'call-outline' | 'logo-whatsapp' | 'mail-outline';
  label: string;
  disabled: boolean;
  compact: boolean;
  inlineLabeled?: boolean;
  customerDetailLayout?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={compact ? 8 : 4}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [
        styles.action,
        compact && styles.compactAction,
        inlineLabeled && styles.inlineLabeledAction,
        customerDetailLayout && styles.customerDetailAction,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons
        name={icon}
        size={inlineLabeled ? 23 : compact ? 20 : 18}
        color={disabled ? partnerTheme.colors.inkSubtle : partnerTheme.colors.brandStrong}
      />
      {(!compact || inlineLabeled) ? <Text style={[styles.label, inlineLabeled && styles.inlineLabeledText]}>{label === "Email" && inlineLabeled ? "Mail" : label}</Text> : null}
    </Pressable>
  );
}

function lastTen(value: string) {
  return value.replace(/\D/g, '').slice(-10);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  compactRow: { gap: 2 },
  verticalRow: { flexDirection: 'column', alignItems: 'center', gap: 2 },
  inlineLabeledRow: { justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  customerDetailRow: { width: '100%', justifyContent: 'flex-start', flexWrap: 'wrap', columnGap: 8, rowGap: 6 },
  customerDetailAction: { minHeight: 38, height: 38, paddingHorizontal: 7, gap: 5, borderRadius: 9, backgroundColor: '#FFFFFF' },
  inlineLabeledAction: { flexDirection: 'row', width: 'auto', height: 42, minHeight: 42, gap: 4, paddingHorizontal: 3 },
  inlineLabeledText: { color: partnerTheme.colors.brandStrong, fontSize: 11, fontWeight: '700' },
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
    width: 36,
    height: 32,
    minHeight: 32,
    borderRadius: partnerTheme.radius.pill,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  label: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  pressed: { backgroundColor: partnerTheme.colors.pressed },
  disabled: { opacity: 0.38 },
});
