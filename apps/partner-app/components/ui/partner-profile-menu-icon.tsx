import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export type PartnerProfileMenuIconKind =
  | 'search'
  | 'policy-intake'
  | 'renewals'
  | 'customers'
  | 'week'
  | 'impact'
  | 'journey'
  | 'activity'
  | 'learn'
  | 'recognition'
  | 'stories'
  | 'profile'
  | 'support'
  | 'settings';

const CONFIG: Record<PartnerProfileMenuIconKind, {
  icon: keyof typeof Ionicons.glyphMap;
  accentIcon?: keyof typeof Ionicons.glyphMap;
}> = {
  search: { icon: 'search', accentIcon: 'briefcase' },
  'policy-intake': { icon: 'document-text', accentIcon: 'add' },
  renewals: { icon: 'refresh-circle', accentIcon: 'calendar' },
  customers: { icon: 'people', accentIcon: 'checkmark' },
  week: { icon: 'bar-chart', accentIcon: 'trending-up' },
  impact: { icon: 'analytics', accentIcon: 'sparkles' },
  journey: { icon: 'navigate-circle', accentIcon: 'flag' },
  activity: { icon: 'pulse', accentIcon: 'notifications' },
  learn: { icon: 'school', accentIcon: 'play' },
  recognition: { icon: 'ribbon', accentIcon: 'star' },
  stories: { icon: 'newspaper', accentIcon: 'play' },
  profile: { icon: 'person', accentIcon: 'shield-checkmark' },
  support: { icon: 'headset', accentIcon: 'chatbubble-ellipses' },
  settings: { icon: 'settings', accentIcon: 'information' },
};

export function PartnerProfileMenuIcon({
  kind,
  size = 38,
}: {
  kind: PartnerProfileMenuIconKind;
  size?: number;
}) {
  const config = CONFIG[kind];
  const iconSize = Math.round(size * 0.5);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.28) }]}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <Ionicons name={config.icon} size={iconSize} color="#0A63C9" />
      {config.accentIcon ? (
        <View style={styles.badge}>
          <Ionicons name={config.accentIcon} size={8} color="#FFFFFF" />
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
});
