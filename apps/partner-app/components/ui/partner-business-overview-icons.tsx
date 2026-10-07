import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export type PartnerBusinessOverviewIconKind = 'premium' | 'policies' | 'commission' | 'customers';

const CONFIG: Record<PartnerBusinessOverviewIconKind, {
  icon: keyof typeof Ionicons.glyphMap;
  badge?: 'rupee' | 'verified';
}> = {
  premium: { icon: 'cash', badge: 'rupee' },
  policies: { icon: 'document-text', badge: 'verified' },
  commission: { icon: 'wallet', badge: 'rupee' },
  customers: { icon: 'people' },
};

export function PartnerBusinessOverviewIcon({
  kind,
  size = 38,
}: {
  kind: PartnerBusinessOverviewIconKind;
  size?: number;
}) {
  const config = CONFIG[kind];
  const iconSize = Math.round(size * 0.52);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.28) }]}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <Ionicons name={config.icon} size={iconSize} color="#0A63C9" />

      {config.badge === 'rupee' ? (
        <View style={styles.badge}>
          <Text style={styles.rupee}>₹</Text>
        </View>
      ) : null}

      {config.badge === 'verified' ? (
        <View style={styles.badge}>
          <Ionicons name="checkmark" size={8} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF6FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D4E8FF',
    shadowColor: '#0B4E9B',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  glowTop: {
    position: 'absolute',
    top: -8,
    right: -7,
    width: 25,
    height: 25,
    borderRadius: 14,
    backgroundColor: 'rgba(61, 171, 255, 0.20)',
  },
  glowBottom: {
    position: 'absolute',
    left: -10,
    bottom: -12,
    width: 28,
    height: 28,
    borderRadius: 16,
    backgroundColor: 'rgba(7, 91, 200, 0.07)',
  },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#075BC8',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  rupee: {
    color: '#FFFFFF',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
});
