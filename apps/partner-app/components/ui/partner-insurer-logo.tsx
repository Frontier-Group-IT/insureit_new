import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

import { getPartnerInsurerLogoSource } from '@/lib/catalog-logos';

const LOGO_SESSION_VERSION = String(Date.now());

export function PartnerInsurerLogo({
  name,
  style,
  fallback,
  fallbackContent,
  accessibilityLabel,
}: {
  name?: string | null;
  style?: StyleProp<ImageStyle>;
  fallback?: ImageSourcePropType | null;
  /** Shown only when neither the remote nor bundled logo can load. */
  fallbackContent?: ReactNode;
  accessibilityLabel?: string;
}) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [bundledFailed, setBundledFailed] = useState(false);

  useEffect(() => {
    setRemoteFailed(false);
    setBundledFailed(false);
  }, [name]);

  const remoteSource = useMemo<ImageSourcePropType | null>(() => {
    const normalized = String(name || '').trim();
    if (!normalized) return null;
    const query = `name=${encodeURIComponent(normalized)}&v=${encodeURIComponent(LOGO_SESSION_VERSION)}`;
    return { uri: `https://portal.insureit.in/api/insurer-logo?${query}` };
  }, [name]);

  const bundledFallback = getPartnerInsurerLogoSource(name) ?? fallback ?? null;
  const source = !remoteFailed && remoteSource ? remoteSource : !bundledFailed ? bundledFallback : null;
  if (!source) return <>{fallbackContent ?? null}</>;

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={style}
      accessibilityLabel={accessibilityLabel || name || 'Insurer'}
      onError={() => {
        if (remoteSource && !remoteFailed) setRemoteFailed(true);
        else setBundledFailed(true);
      }}
    />
  );
}
