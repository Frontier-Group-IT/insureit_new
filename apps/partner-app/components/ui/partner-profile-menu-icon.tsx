import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

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

type IconPalette = {
  icon: keyof typeof Ionicons.glyphMap;
  accentIcon: keyof typeof Ionicons.glyphMap;
  face: string;
  edge: string;
  shadow: string;
  tile: string;
  light: string;
};

// A palette per destination makes the small icons easy to distinguish at a glance.
// The extruded silhouettes, rim lighting and inset tile replace flat monochrome glyphs
// without adding image downloads, native dependencies, or changing touch targets.
// Six destinations use bundled illustrated 3D PNG artwork, including three updated icons.
// All other More menu icons preserve their existing native vector rendering.
const ILLUSTRATED_ICONS: Partial<Record<PartnerProfileMenuIconKind, ImageSourcePropType>> = {
  'policy-intake': require('../../assets/partner/icons/more-policy-intake-3d.png'),
  'case-register': require('../../assets/partner/icons/more-case-register.png'),
  renewals: require('../../assets/partner/icons/more-renewals.png'),
  // Reuse the established add-customer artwork for a clearer customer shortcut.
  customers: require('../../assets/partner/actions/add-customer.png'),
  impact: require('../../assets/partner/icons/more-impact.png'),
  // Render Journey as a resolution-independent vector below (old PNG is soft at row scale).
};

const CONFIG: Record<Exclude<PartnerProfileMenuIconKind, 'case-register'>, IconPalette> = {
  search: { icon: 'search', accentIcon: 'briefcase', face: '#3488F2', edge: '#0756BB', shadow: '#123A7B', tile: '#EAF4FF', light: '#FFFFFF' },
  'policy-intake': { icon: 'document-text', accentIcon: 'add', face: '#527AF2', edge: '#2147B4', shadow: '#172F73', tile: '#EDF2FF', light: '#FFFFFF' },
  renewals: { icon: 'refresh-circle', accentIcon: 'calendar', face: '#13B6A9', edge: '#087A86', shadow: '#12526A', tile: '#E5FAF6', light: '#FFFFFF' },
  customers: { icon: 'people', accentIcon: 'checkmark', face: '#327CE7', edge: '#2351B6', shadow: '#192E74', tile: '#E9F3FF', light: '#FFFFFF' },
  week: { icon: 'bar-chart', accentIcon: 'trending-up', face: '#238CEB', edge: '#1456B5', shadow: '#1D3F80', tile: '#E9F5FF', light: '#FFFFFF' },
  impact: { icon: 'analytics', accentIcon: 'sparkles', face: '#8563E6', edge: '#5A38B5', shadow: '#362477', tile: '#F2EEFF', light: '#FFFFFF' },
  journey: { icon: 'navigate-circle', accentIcon: 'flag', face: '#2BA5CA', edge: '#096C99', shadow: '#175575', tile: '#E7F8FF', light: '#FFFFFF' },
  activity: { icon: 'pulse', accentIcon: 'notifications', face: '#EB638B', edge: '#AC3D70', shadow: '#752954', tile: '#FFF0F5', light: '#FFFFFF' },
  learn: { icon: 'school', accentIcon: 'play', face: '#427CE6', edge: '#2251B6', shadow: '#253E77', tile: '#EAF2FF', light: '#FFFFFF' },
  recognition: { icon: 'ribbon', accentIcon: 'star', face: '#E5A43B', edge: '#B56D18', shadow: '#75501D', tile: '#FFF5E2', light: '#FFFFFF' },
  stories: { icon: 'newspaper', accentIcon: 'play', face: '#7666E8', edge: '#4534A9', shadow: '#342B75', tile: '#F1EFFF', light: '#FFFFFF' },
  profile: { icon: 'person', accentIcon: 'shield-checkmark', face: '#387DDC', edge: '#1451A9', shadow: '#1E376F', tile: '#EAF3FF', light: '#FFFFFF' },
  support: { icon: 'headset', accentIcon: 'chatbubble-ellipses', face: '#17A5AC', edge: '#087880', shadow: '#164E61', tile: '#E7FAFA', light: '#FFFFFF' },
  settings: { icon: 'settings', accentIcon: 'information', face: '#7384A7', edge: '#44577A', shadow: '#33405F', tile: '#EFF2F8', light: '#FFFFFF' },
};

export function PartnerProfileMenuIcon({
  kind,
  size = 38,
}: {
  kind: PartnerProfileMenuIconKind;
  size?: number;
}) {
  const artwork = ILLUSTRATED_ICONS[kind];
  if (artwork) {
    return (
      <Image
        source={artwork}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: size, height: size }}
      />
    );
  }
  // Only the preserved kinds reach this palette; case-register uses artwork.
  const config = CONFIG[kind as Exclude<PartnerProfileMenuIconKind, 'case-register'>];
  const glyph = Math.round(size * 0.56);
  const badgeSize = Math.round(size * 0.33);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, {
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.27),
        backgroundColor: config.tile,
        shadowColor: config.shadow,
      }]}
    >
      {/* Layered lighting gives the tile a raised, softly rounded 3D surface. */}
      <View pointerEvents="none" style={styles.upperLight} />
      <View pointerEvents="none" style={styles.lowerShade} />
      <View pointerEvents="none" style={styles.topRim} />
      <View pointerEvents="none" style={styles.iconStack}>
        <Ionicons name={config.icon} size={glyph} color={config.shadow}
          style={[styles.glyph, styles.glyphDepth]} />
        <Ionicons name={config.icon} size={glyph} color={config.edge}
          style={[styles.glyph, styles.glyphEdge]} />
        <Ionicons name={config.icon} size={glyph} color={config.face}
          style={[styles.glyph, styles.glyphFace]} />
        <Ionicons name={config.icon} size={glyph} color={config.light}
          style={[styles.glyph, styles.glyphRim]} />
      </View>
      <View pointerEvents="none" style={[styles.badgeShadow, {
        width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2,
        backgroundColor: config.shadow,
      }]} />
      <View pointerEvents="none" style={[styles.badge, {
        width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2,
        backgroundColor: config.edge,
      }]}>
        <View pointerEvents="none" style={styles.badgeShine} />
        <Ionicons name={config.accentIcon} size={Math.round(badgeSize * 0.59)} color="#FFFFFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderRightColor: '#D6E0F2',
    borderBottomColor: '#CBD8EB',
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  upperLight: {
    position: 'absolute',
    top: 3, left: 4, right: 5, height: '42%',
    borderTopLeftRadius: 10, borderTopRightRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  lowerShade: {
    position: 'absolute',
    bottom: 2, left: 4, right: 3, height: '32%',
    borderBottomLeftRadius: 9, borderBottomRightRadius: 9,
    backgroundColor: 'rgba(50,95,170,0.08)',
  },
  topRim: {
    position: 'absolute',
    top: 2, left: 6, right: 7, height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 2,
  },
  iconStack: {
    width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
    transform: [{ translateX: -1 }, { translateY: -1 }],
  },
  glyph: { position: 'absolute' },
  glyphDepth: { transform: [{ translateX: 2 }, { translateY: 3 }] },
  glyphEdge: { transform: [{ translateX: 0.9 }, { translateY: 1.5 }] },
  glyphFace: { transform: [{ translateX: -0.7 }, { translateY: -0.8 }] },
  glyphRim: {
    opacity: 0.25,
    transform: [{ translateX: -1.8 }, { translateY: -2 }],
  },
  badgeShadow: {
    position: 'absolute', right: -2, bottom: -3,
    opacity: 0.36,
  },
  badge: {
    position: 'absolute', right: -1, bottom: -1,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  badgeShine: {
    position: 'absolute', left: 1, top: 1, right: 1,
    height: '45%', borderTopLeftRadius: 8, borderTopRightRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.27)',
  },
});
