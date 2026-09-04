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
    paddingHorizontal: 11,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: partnerTheme.colors.lineStrong,
  },
  active: { backgroundColor: partnerTheme.colors.brandSoft, borderColor: partnerTheme.colors.brandSoft },
  text: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  textActive: { color: partnerTheme.colors.brandStrong, fontWeight: '700' },
  pressed: { backgroundColor: partnerTheme.colors.pressed },
});
