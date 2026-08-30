import { StyleSheet, View, type ViewStyle } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerSkeleton({ width = '100%', height = 16, radius = 8, style }: {
  width?: ViewStyle['width'];
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  return <View accessibilityElementsHidden style={[styles.base, { width, height, borderRadius: radius }, style]} />;
}

const styles = StyleSheet.create({
  base: { backgroundColor: partnerTheme.colors.surfaceMuted },
});
