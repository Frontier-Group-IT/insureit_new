import { useEffect, useState, type ReactNode } from 'react';
import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

import { getPartnerInsurerLogoSource } from '@/lib/catalog-logos';
import { supabase } from '@/lib/supabase';

type ManagedLogo = { name: string; logo_path: string | null };
const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');
let cached: Map<string, string> | null = null;
let cacheAt = 0;
let pending: Promise<Map<string, string>> | null = null;

function loadManagedInsurerLogos(): Promise<Map<string, string>> {
  if (cached && Date.now() - cacheAt < 300_000) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    const { data, error } = await supabase.from('insurance_companies')
      .select('name,logo_path').not('logo_path', 'is', null);
    if (error) throw error;
    const next = new Map<string, string>();
    for (const row of (data ?? []) as ManagedLogo[]) {
      if (row.logo_path) {
        const { data: asset } = supabase.storage.from('insurer-assets').getPublicUrl(row.logo_path);
        if (asset.publicUrl) next.set(normalize(row.name), asset.publicUrl);
      }
    }
    cached = next;
    cacheAt = Date.now();
    return next;
  })().finally(() => { pending = null; });
  return pending;
}

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
  fallbackContent?: ReactNode;
  accessibilityLabel?: string;
}) {
  const [managedUri, setManagedUri] = useState<string | null>(null);
  const [managedFailed, setManagedFailed] = useState(false);
  const [bundledFailed, setBundledFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setManagedUri(null);
    setManagedFailed(false);
    setBundledFailed(false);
    const value = String(name || '').trim();
    if (value) {
      void loadManagedInsurerLogos().then(logos => {
        if (current) setManagedUri(logos.get(normalize(value)) ?? null);
      }).catch(() => {
        // Bundled catalogue is always available when Supabase is unreachable.
      });
    }
    return () => { current = false; };
  }, [name]);

  const bundledFallback = getPartnerInsurerLogoSource(name) ?? fallback ?? null;
  const remoteSource: ImageSourcePropType | null = managedUri && !managedFailed ? { uri: managedUri } : null;
  const source = remoteSource ?? (!bundledFailed ? bundledFallback : null);
  if (!source) return <>{fallbackContent ?? null}</>;

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={style}
      accessibilityLabel={accessibilityLabel || name || 'Insurer'}
      onError={() => {
        if (remoteSource) setManagedFailed(true);
        else setBundledFailed(true);
      }}
    />
  );
}
