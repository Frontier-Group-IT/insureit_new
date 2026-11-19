import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

export type PartnerProfileMenuIconKind =
  | 'search'
  | 'policy-intake'
  | 'case-register'
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

type MenuIconConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

/** Plain, legible menu glyphs without tiles, borders, shadows or built-in image backdrops. */
const MENU_ICONS: Record<PartnerProfileMenuIconKind, MenuIconConfig> = {
  search: { icon: 'search-outline', color: '#126FC5' },
  'policy-intake': { icon: 'document-text-outline', color: '#0878E8' },
  'case-register': { icon: 'medkit-outline', color: '#148D7B' },
  renewals: { icon: 'refresh-circle-outline', color: '#0878E8' },
  customers: { icon: 'people-outline', color: '#0878E8' },
  week: { icon: 'bar-chart-outline', color: '#126FC5' },
  impact: { icon: 'analytics-outline', color: '#5D51CD' },
  journey: { icon: 'navigate-circle-outline', color: '#0878E8' },
  activity: { icon: 'notifications-outline', color: '#C55786' },
  learn: { icon: 'school-outline', color: '#286FDB' },
  recognition: { icon: 'ribbon-outline', color: '#B77A1C' },
  stories: { icon: 'newspaper-outline', color: '#7666D9' },
  profile: { icon: 'person-circle-outline', color: '#286FDB' },
  support: { icon: 'headset-outline', color: '#138A96' },
  settings: { icon: 'settings-outline', color: '#53698F' },
};

export function PartnerProfileMenuIcon({
  kind,
  size = 42,
}: {
  kind: PartnerProfileMenuIconKind;
  size?: number;
}) {
  const config = MENU_ICONS[kind];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={config.icon} size={size} color={config.color} />
    </View>
  );
}
