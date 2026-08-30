import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { getPartnerJourney, type PartnerJourneyData } from '@/lib/journey';
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
      title="Progress, not a leaderboard"
      action={
        <PartnerIconButton icon="close" label="Close journey" onPress={() => router.back()} />
      }
    >
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : error || !data ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error || 'Journey is unavailable.'}</Text>
          <Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable>
        </View>
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
            <Text style={styles.sectionHint}>Real events only</Text>
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
            <View style={styles.empty}>
              <Ionicons name="trail-sign-outline" size={28} color="#9AA3B2" />
              <Text style={styles.emptyTitle}>Your journey is just beginning</Text>
              <Text style={styles.emptyText}>Business and service milestones will appear as real events are recorded.</Text>
            </View>
          )}

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={partnerTheme.colors.brand} />
            <Text style={styles.noteText}>Journey tracking begins from the earliest reliable digital lifecycle date available for your account. We do not invent historical milestones that the system cannot prove.</Text>
          </View>
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
  close: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  errorCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  errorText: { color: partnerTheme.colors.inkMuted, fontSize: 10 },
  retry: { marginTop: 10, color: partnerTheme.colors.brand, fontSize: 10, fontWeight: '800' },

  hero: { borderRadius: partnerTheme.radius.xl, padding: 20, backgroundColor: partnerTheme.colors.nav },
  heroEyebrow: { color: '#AAA5FF', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { marginTop: 6, color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroText: { marginTop: 6, color: '#C9D0DE', fontSize: 9.5, lineHeight: 14 },
  progressTrack: { height: 7, marginTop: 17, overflow: 'hidden', borderRadius: 999, backgroundColor: '#343E50' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#8F88FF' },
  progressMeta: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: '#AEB7C5', fontSize: 7.5, fontWeight: '700' },

  summary: { marginTop: 12, flexDirection: 'row', borderRadius: 18, paddingVertical: 15, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  summaryItem: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 17, fontWeight: '800' },
  summaryLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, fontSize: 7.5, textAlign: 'center', lineHeight: 11 },

  sectionHeader: { marginTop: 21, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '800' },
  sectionHint: { color: partnerTheme.colors.inkMuted, fontSize: 8.5 },

  timeline: { paddingLeft: 2 },
  timelineRow: { minHeight: 92, flexDirection: 'row' },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 11, height: 11, marginTop: 5, borderRadius: 6, backgroundColor: '#BFC5D1', borderWidth: 2, borderColor: partnerTheme.colors.canvas },
  dotLatest: { backgroundColor: partnerTheme.colors.brand },
  line: { width: 1, flex: 1, marginTop: 3, backgroundColor: partnerTheme.colors.line },
  timelineBody: { flex: 1, paddingBottom: 18 },
  timelineDate: { color: partnerTheme.colors.brand, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  timelineTitle: { marginTop: 4, color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '800' },
  timelineText: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 8.5, lineHeight: 13 },

  empty: { minHeight: 190, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: partnerTheme.colors.surface },
  emptyTitle: { marginTop: 9, color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '800' },
  emptyText: { marginTop: 4, maxWidth: 270, color: partnerTheme.colors.inkMuted, fontSize: 8.5, lineHeight: 13, textAlign: 'center' },

  note: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 13, padding: 12, backgroundColor: partnerTheme.colors.brandSoft },
  noteText: { flex: 1, color: '#5D5A80', fontSize: 8.5, lineHeight: 13 },
});
