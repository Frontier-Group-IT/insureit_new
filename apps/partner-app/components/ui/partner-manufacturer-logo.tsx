import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';

export function PartnerManufacturerLogo({
  name,
  style,
  fallback,
  accessibilityLabel,
}: {
  name?: string | null;
  style?: StyleProp<ImageStyle>;
  fallback?: ImageSourcePropType | null;
  accessibilityLabel?: string;
}) {
  const source = getPartnerManufacturerLogoSource(name) ?? fallback ?? null;
  if (!source) return null;

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={style}
      accessibilityLabel={accessibilityLabel || name || 'Vehicle manufacturer'}
    />
  );
}
