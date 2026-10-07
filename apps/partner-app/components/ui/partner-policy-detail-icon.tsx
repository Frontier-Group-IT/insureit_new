import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export type PartnerPolicyDetailIconKind =
  | 'quick-actions'
  | 'policy-document'
  | 'renew-policy'
  | 'raise-claim'
  | 'customer-details'
  | 'policy-overview'
  | 'category'
  | 'product'
  | 'business-type'
  | 'issuance-date'
  | 'insurer'
  | 'idv'
  | 'premium'
  | 'premium-breakup'
  | 'customer-vehicle'
  | 'commercial-attribution'
  | 'sales-ownership'
  | 'policy-period';

export type PartnerPolicyDetailIconTone = 'blue' | 'green' | 'orange' | 'purple' | 'neutral';

const CONFIG: Record<PartnerPolicyDetailIconKind, {
  icon: keyof typeof Ionicons.glyphMap;
  badge?: keyof typeof Ionicons.glyphMap;
}> = {
  'quick-actions': { icon: 'flash', badge: 'sparkles' },
  'policy-document': { icon: 'document-text', badge: 'checkmark' },
  'renew-policy': { icon: 'refresh-circle', badge: 'calendar' },
  'raise-claim': { icon: 'shield-checkmark', badge: 'add' },
  'customer-details': { icon: 'people', badge: 'person' },
  'policy-overview': { icon: 'document-text', badge: 'shield-checkmark' },
  category: { icon: 'grid', badge: 'shield-checkmark' },
  product: { icon: 'cube', badge: 'checkmark' },
  'business-type': { icon: 'briefcase', badge: 'business' },
  'issuance-date': { icon: 'calendar', badge: 'checkmark' },
  insurer: { icon: 'business', badge: 'shield-checkmark' },
  idv: { icon: 'cash', badge: 'car-sport' },
  premium: { icon: 'wallet', badge: 'cash' },
  'premium-breakup': { icon: 'cash', badge: 'analytics' },
  'customer-vehicle': { icon: 'people', badge: 'car-sport' },
  'commercial-attribution': { icon: 'stats-chart', badge: 'briefcase' },
  'sales-ownership': { icon: 'briefcase', badge: 'person' },
  'policy-period': { icon: 'calendar', badge: 'time' },
};

const TONES: Record<PartnerPolicyDetailIconTone, { bg: string; border: string; fg: string; badge: string; glow: string }> = {
  blue: { bg: '#EDF6FF', border: '#D4E8FF', fg: '#0A63C9', badge: '#075BC8', glow: 'rgba(61, 171, 255, 0.20)' },
  green: { bg: '#ECF9F4', border: '#D2F0E4', fg: '#14936D', badge: '#0E805D', glow: 'rgba(41, 181, 133, 0.17)' },
  orange: { bg: '#FFF4EA', border: '#F8DEC7', fg: '#D97221', badge: '#C75E12', glow: 'rgba(239, 144, 67, 0.18)' },
  purple: { bg: '#F4F0FF', border: '#E2D9FF', fg: '#6544C5', badge: '#5937B9', glow: 'rgba(126, 89, 220, 0.16)' },
  neutral: { bg: '#F4F8FC', border: '#E2EAF3', fg: '#45658F', badge: '#31557F', glow: 'rgba(85, 123, 168, 0.12)' },
};

export function PartnerPolicyDetailIcon({
  kind,
  size = 34,
  tone = 'blue',
  showBadge = true,
}: {
  kind: PartnerPolicyDetailIconKind;
  size?: number;
  tone?: PartnerPolicyDetailIconTone;
  showBadge?: boolean;
}) {
  const config = CONFIG[kind];
  const palette = TONES[tone];
  const iconSize = Math.round(size * 0.5);
  const badgeSize = Math.max(12, Math.round(size * 0.36));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: palette.bg,
          borderColor: palette.border,
          shadowColor: palette.fg,
        },
      ]}
    >
      <View style={[styles.glow, { backgroundColor: palette.glow }]} />
      <Ionicons name={config.icon} size={iconSize} color={palette.fg} />
      {showBadge && config.badge ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: palette.badge,
            },
          ]}
        >
          <Ionicons name={config.badge} size={Math.max(7, Math.round(badgeSize * 0.52))} color="#FFFFFF" />
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
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  glow: {
    position: 'absolute',
    top: -8,
    right: -7,
    width: 25,
    height: 25,
    borderRadius: 14,
  },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
