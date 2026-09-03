import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerJourney, type PartnerJourneyData } from '@/lib/journey';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function JourneyScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerJourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerJourney());
    } catch {
      setError('Your journey could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const progress = useMemo(() => {
    if (!data?.next_milestone.target) return 0;
    return Math.max(0, Math.min(1, data.next_milestone.current / data.next_milestone.target));
  }, [data]);

  return (
    <PartnerScreen
      eyebrow="MY JOURNEY"
      title="My progress"
      onBack={() => router.back()}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading your journey" />
      ) : error || !data ? (
        <PartnerStateView
          state="error"
          title="Your journey is temporarily unavailable"
          message={error || 'Your journey could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>NEXT MILESTONE</Text>
            <Text style={styles.heroTitle}>{data.next_milestone.title}</Text>
            <Text style={styles.heroText}>
              {data.next_milestone.remaining > 0
                ? `${data.next_milestone.remaining} more customer${data.next_milestone.remaining === 1 ? '' : 's'} to reach the next recorded milestone.`
                : 'Milestone reached.'}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressText}>{data.next_milestone.current}</Text>
              <Text style={styles.progressText}>{data.next_milestone.target}</Text>
            </View>
          </View>

          <View style={styles.summary}>
            <Summary value={data.policy_count} label="Policies since tracking" />
            <Summary value={data.customer_count} label="Customers since tracking" />
            <Summary value={data.claim_count} label="Claims since tracking" />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your recorded timeline</Text>
            
          </View>

          {data.milestones.length ? (
            <View style={styles.timeline}>
              {data.milestones.map((item, index) => (
                <View key={`${item.kind}-${item.date}-${index}`} style={styles.timelineRow}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, index === data.milestones.length - 1 && styles.dotLatest]} />
                    {index < data.milestones.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineDate}>{formatDate(item.date)}</Text>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    <Text style={styles.timelineText}>{item.subtitle}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <PartnerStateView
              state="empty"
              title="Your journey is just beginning"
              message="Business and service milestones will appear as real events are recorded."
              asset={PartnerAssets.status.journey}
            />
          )}

        </>
      )}
    </PartnerScreen>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  hero: { borderRadius: partnerTheme.radius.xl, padding: 15, backgroundColor: partnerTheme.colors.nav },
  heroEyebrow: { color: '#AAA5FF', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { marginTop: 4, color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroText: { marginTop: 4, color: '#C9D0DE', fontSize: 9.5, lineHeight: 14 },
  progressTrack: { height: 7, marginTop: 11, overflow: 'hidden', borderRadius: 999, backgroundColor: '#343E50' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#8F88FF' },
  progressMeta: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: '#AEB7C5', fontSize: 7.5, fontWeight: '700' },

  summary: { marginTop: 9, flexDirection: 'row', borderRadius: 18, paddingVertical: 11, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  summaryItem: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 17, fontWeight: '800' },
  summaryLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, fontSize: 7.5, textAlign: 'center', lineHeight: 11 },

  sectionHeader: { marginTop: 15, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '800' },

  timeline: { paddingLeft: 2 },
  timelineRow: { minHeight: 70, flexDirection: 'row' },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 11, height: 11, marginTop: 5, borderRadius: 6, backgroundColor: '#BFC5D1', borderWidth: 2, borderColor: partnerTheme.colors.canvas },
  dotLatest: { backgroundColor: partnerTheme.colors.brand },
  line: { width: 1, flex: 1, marginTop: 3, backgroundColor: partnerTheme.colors.line },
  timelineBody: { flex: 1, paddingBottom: 18 },
  timelineDate: { color: partnerTheme.colors.brand, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  timelineTitle: { marginTop: 4, color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '800' },
  timelineText: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 8.5, lineHeight: 13 },

});
