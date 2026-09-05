import { useCallback, useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerRecognition, type PartnerRecognition } from '@/lib/engagement';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function RecognitionScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerRecognition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerRecognition());
    } catch {
      setData(null);
      setError('Recognition could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <PartnerScreen eyebrow="RECOGNITION" title="Progress worth noticing" onBack={() => router.back()}>
      {loading ? (
        <PartnerStateView state="loading" title="Loading recognition" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Recognition is temporarily unavailable" message={error || 'Recognition could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>
          <View style={styles.hero}>
            <Image source={PartnerAssets.status.achievement} style={styles.heroArtwork} resizeMode="contain" />
            <Text style={styles.heroTitle}>Your milestones</Text>
          </View>

          <View style={styles.list}>
            {data.items.length ? data.items.map((item) => (
              <View key={item.code} style={styles.card}>
                <View style={styles.artworkWrap}><Image source={milestoneArtwork(item.icon)} style={styles.artwork} resizeMode="contain" /></View>
                <View style={styles.body}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.text}>{item.body}</Text>
                  {item.date ? <Text style={styles.date}>{formatDate(item.date)}</Text> : null}
                </View>
              </View>
            )) : (
              <PartnerStateView state="empty" title="More highlights will appear here" message="Recognition appears when a recorded milestone is reached." asset={PartnerAssets.status.achievement} />
            )}
          </View>

          {data.next_milestone ? (
            <View style={styles.nextCard}>
              <Text style={styles.nextEyebrow}>NEXT MILESTONE</Text>
              <Text style={styles.nextTitle}>{data.next_milestone.title}</Text>
              <Text style={styles.nextText}>{data.next_milestone.remaining} remaining · {data.next_milestone.current} / {data.next_milestone.target}</Text>
              <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (data.next_milestone.current / data.next_milestone.target) * 100)}%` }]} /></View>
            </View>
          ) : null}
        </>
      )}
    </PartnerScreen>
  );
}

function milestoneArtwork(icon: PartnerRecognition['items'][number]['icon']): ImageSourcePropType {
  if (icon === 'learn') return PartnerAssets.actions.policyChecklist;
  if (icon === 'renewal') return PartnerAssets.actions.renewals;
  return PartnerAssets.status.journey;
}

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

const styles = StyleSheet.create({
  hero: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: partnerTheme.radius.xl, paddingHorizontal: 15, paddingVertical: 12, backgroundColor: partnerTheme.colors.nav },
  heroArtwork: { width: 40, height: 40 },
  heroTitle: { flex: 1, color: '#FFFFFF', ...partnerTheme.typography.sectionTitle },
  list: { marginTop: 11, gap: 7 },
  card: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: partnerTheme.radius.lg, padding: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  artworkWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  artwork: { width: 38, height: 38 },
  body: { flex: 1 },
  title: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  text: { marginTop: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  date: { marginTop: 5, color: partnerTheme.colors.brand, ...partnerTheme.typography.meta },
  nextCard: { marginTop: 11, borderRadius: partnerTheme.radius.lg, padding: 13, backgroundColor: partnerTheme.colors.brandSoft },
  nextEyebrow: { color: partnerTheme.colors.brand, letterSpacing: 1, ...partnerTheme.typography.meta },
  nextTitle: { marginTop: 5, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  nextText: { marginTop: 4, color: '#5D5A80', ...partnerTheme.typography.caption },
  track: { height: 7, marginTop: 9, overflow: 'hidden', borderRadius: 999, backgroundColor: '#DCD9FF' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: partnerTheme.colors.brand },
});
