import { useEffect, useMemo, useState } from 'react';
import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

import { getPartnerInsurerLogoSource } from '@/lib/catalog-logos';

const LOGO_SESSION_VERSION = String(Date.now());

export function PartnerInsurerLogo({
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
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    setRemoteFailed(false);
  }, [name]);

  const remoteSource = useMemo<ImageSourcePropType | null>(() => {
    const normalized = String(name || '').trim();
    if (!normalized) return null;
    const query = `name=${encodeURIComponent(normalized)}&v=${encodeURIComponent(LOGO_SESSION_VERSION)}`;
    return { uri: `https://portal.insureit.in/api/insurer-logo?${query}` };
  }, [name]);

  const bundledFallback = getPartnerInsurerLogoSource(name) ?? fallback ?? null;
  const source = !remoteFailed && remoteSource ? remoteSource : bundledFallback;
  if (!source) return null;

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={style}
      accessibilityLabel={accessibilityLabel || name || 'Insurer'}
      onError={remoteSource ? () => setRemoteFailed(true) : undefined}
    />
  );
}
