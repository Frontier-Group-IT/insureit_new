import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function PartnerBusinessGrowthIcon({ size = 64 }: { size?: number }) {
  const scale = size / 64;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: 14 * scale,
        },
      ]}
    >
      <View style={[styles.bar, styles.barOne, { width: 8 * scale, height: 26 * scale, left: 12 * scale, bottom: 11 * scale, borderRadius: 4 * scale }]} />
      <View style={[styles.bar, styles.barTwo, { width: 8 * scale, height: 34 * scale, left: 24 * scale, bottom: 11 * scale, borderRadius: 4 * scale }]} />
      <View style={[styles.bar, styles.barThree, { width: 8 * scale, height: 29 * scale, left: 36 * scale, bottom: 11 * scale, borderRadius: 4 * scale }]} />
      <View style={[styles.bar, styles.barFour, { width: 8 * scale, height: 44 * scale, left: 48 * scale, bottom: 11 * scale, borderRadius: 4 * scale }]} />
      <Ionicons
        name="trending-up"
        size={35 * scale}
        color="#147FD8"
        style={{ position: 'absolute', left: 13 * scale, top: 9 * scale }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#EAF6FF',
  },
  bar: {
    position: 'absolute',
  },
  barOne: { backgroundColor: '#77B8EE' },
  barTwo: { backgroundColor: '#4EA3E8' },
  barThree: { backgroundColor: '#2E8DDF' },
  barFour: { backgroundColor: '#177FD7' },
});
