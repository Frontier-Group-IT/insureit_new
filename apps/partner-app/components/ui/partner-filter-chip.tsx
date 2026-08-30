import { Pressable, StyleSheet, Text } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerFilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} filter`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.base, active && styles.active, pressed && styles.pressed]}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: partnerTheme.control.minTouchTarget,
    justifyContent: 'center',
    borderRadius: partnerTheme.radius.pill,
    paddingHorizontal: 13,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  active: { backgroundColor: partnerTheme.colors.brandStrong, borderColor: partnerTheme.colors.brandStrong },
  text: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  textActive: { color: partnerTheme.colors.white },
  pressed: { opacity: 0.8 },
});
