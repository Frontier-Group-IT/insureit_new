import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStackBottomNavigation } from '@/components/partner-stack-bottom-navigation';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerJourney, type PartnerJourneyData } from '@/lib/journey';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function JourneyScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerJourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [showAll, setShowAll] = useState(false);

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

  const milestones = useMemo(() => [...(data?.milestones ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [data]);
  const achievements = useMemo(() => milestones.filter((item) => !/tracking started/i.test(item.title)).slice(0, 3), [milestones]);
  const filtered = useMemo(() => milestones.filter((item) => filter === 'all' || milestoneCategory(item.kind, item.title) === filter), [milestones, filter]);
  const visible = showAll ? filtered : filtered.slice(0, 8);

  return (
    <PartnerScreen eyebrow="MY JOURNEY" title="My progress" onBack={() => router.back()}
      navyTopBar navyStatusBar bottomNavigationNavy
      bottomNavigation={<PartnerStackBottomNavigation activeTab="home" />}>
      {loading ? (
        <PartnerStateView state="loading" title="Loading your journey" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Your journey is temporarily unavailable" message={error || 'Your journey could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.heroEyebrow}>NEXT CUSTOMER MILESTONE</Text>
            </View>
            <Text style={styles.heroTitle}>{data.next_milestone.title}</Text>
            <View style={styles.heroNumbers}>
              <View>
                <Text style={styles.heroCount}>{data.next_milestone.current.toLocaleString('en-IN')}</Text>
                <Text style={styles.heroMuted}>Customers achieved</Text>
              </View>
              <View style={styles.heroPercentWrap}>
                <Text style={styles.heroPercent}>{Math.round(progress * 100)}%</Text>
                <Text style={styles.heroMuted}>Completed</Text>
              </View>
            </View>
            <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: data.next_milestone.target, now: Math.min(data.next_milestone.current, data.next_milestone.target) }}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroRemaining}>
                {data.next_milestone.remaining > 0
                  ? `${data.next_milestone.remaining.toLocaleString('en-IN')} more customers to unlock`
                  : 'Milestone achieved'}
              </Text>
              <Ionicons name="flag-outline" size={17} color="#C4B5FD" />
            </View>
          </View>

          <View style={styles.summary}>
            <Summary value={data.policy_count} label="Policies" icon="document-text-outline" color="#2866B8" background="#EAF2FF" onPress={() => router.push('/(tabs)/policies')} />
            <Summary value={data.customer_count} label="Customers" icon="people-outline" color="#13805C" background="#E7F7EF" onPress={() => router.push('/customers')} />
            <Summary value={data.claim_count} label="Claims" icon="shield-checkmark-outline" color="#7954C7" background="#F1EDFC" onPress={() => router.push('/(tabs)/claims')} />
          </View>

          {achievements.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.sectionTitle}>My achievements</Text>
                <View style={styles.smallPill}><Text style={styles.smallPillText}>Milestones</Text></View>
              </View>
              <View style={styles.achievementRow}>
                {achievements.map((item, index) => {
                  const category = milestoneCategory(item.kind, item.title);
                  const tone = categoryTone(category);
                  return (
                    <View key={`${item.kind}-${item.date}-${index}`} style={styles.achievement}>
                      <View style={[styles.achievementIcon, { backgroundColor: tone.background }]}>
                        <Ionicons name={journeyMilestoneIcon(item.kind, item.title)} size={25} color={tone.color} />
                      </View>
                      <Text style={styles.achievementTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.achievementDate}>{formatDate(item.date)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeading}>
              <Text style={styles.sectionTitle}>Journey timeline</Text>
            </View>
            <View style={styles.filters}>
              {JOURNEY_FILTERS.map((choice) => (
                <Pressable
                  key={choice.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === choice.key }}
                  onPress={() => { setFilter(choice.key); setShowAll(false); }}
                  style={[styles.filterButton, filter === choice.key && styles.filterActive]}
                >
                  <Text style={[styles.filterText, filter === choice.key && styles.filterActiveText]}>{choice.label}</Text>
                </Pressable>
              ))}
            </View>
            {visible.length ? (
              <View style={styles.timeline}>
                {visible.map((item, index) => {
                  const tone = categoryTone(milestoneCategory(item.kind, item.title));
                  return (
                    <View key={`${item.kind}-${item.date}-${index}`} style={styles.timelineRow}>
                      <View style={styles.rail}>
                        <View style={[styles.timelineArtwork, { backgroundColor: tone.background }]}>
                          <Ionicons name={journeyMilestoneIcon(item.kind, item.title)} size={19} color={tone.color} />
                        </View>
                        {index < visible.length - 1 ? <View style={styles.line} /> : null}
                      </View>
                      <View style={styles.timelineBody}>
                        <Text style={styles.timelineDate}>{formatDate(item.date)}</Text>
                        <Text style={styles.timelineTitle}>{item.title}</Text>
                        <Text style={styles.timelineText}>{item.subtitle}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <PartnerStateView state="empty" title={filter === 'all' ? 'Your journey is just beginning' : 'No milestones in this category'} message="Recorded milestones will appear here when achieved." asset={PartnerAssets.status.journey} />
            )}
            {filtered.length > 8 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={showAll ? 'Show fewer milestones' : 'View all milestones'} onPress={() => setShowAll(!showAll)} style={styles.showMore}>
                <Text style={styles.showMoreText}>{showAll ? 'Show less' : `View all ${filtered.length} milestones`}</Text>
                <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color="#315E9C" />
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

type JourneyFilter = 'all' | 'policies' | 'customers' | 'premium';
const JOURNEY_FILTERS: { key: JourneyFilter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'policies', label: 'Policies' },
  { key: 'customers', label: 'Customers' }, { key: 'premium', label: 'Premium' },
];

function milestoneCategory(kind: string, title: string): JourneyFilter {
  const label = `${kind} ${title}`.toLowerCase();
  if (/customer/.test(label)) return 'customers';
  if (/premium|month|₹|gross/.test(label)) return 'premium';
  if (/policy|policies/.test(label)) return 'policies';
  return 'all';
}

function categoryTone(category: JourneyFilter) {
  if (category === 'customers') return { background: '#E7F7EF', color: '#13805C' };
  if (category === 'premium') return { background: '#F2EBFF', color: '#7954C7' };
  if (category === 'policies') return { background: '#EAF2FF', color: '#2866B8' };
  return { background: '#FFF3D9', color: '#A77419' };
}

function Summary({ value, label, icon, color, background, onPress }: { value: number; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; background: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}`} onPress={onPress} style={({ pressed }) => [styles.summaryItem, pressed && styles.summaryItemPressed]}>
      <View style={[styles.summaryIcon, { backgroundColor: background }]}><Ionicons name={icon} size={21} color={color} /></View>
      <Text style={styles.summaryValue} adjustsFontSizeToFit numberOfLines={1}>{value.toLocaleString('en-IN')}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </Pressable>
  );
}

function journeyMilestoneIcon(kind: string, title: string): keyof typeof Ionicons.glyphMap {
  const value = `${kind} ${title}`.toLowerCase();
  if (value.includes('first customer') || value.includes('customer')) return 'person-add';
  if (value.includes('first policy')) return 'document-text';
  if (value.includes('policy') || value.includes('policies')) return 'documents';
  if (value.includes('₹') || value.includes('premium') || value.includes('month')) return 'cash';
  if (value.includes('start') || value.includes('journey')) return 'flag';
  return 'trophy';
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  hero: { marginTop: 16, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#142849' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { color: '#C3B6FF', letterSpacing: 0.9, fontSize: 10, fontWeight: '800' },
  heroTitle: { marginTop: 5, color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '800' },
  heroNumbers: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 },
  heroCount: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroPercentWrap: { alignItems: 'flex-end' },
  heroPercent: { color: '#C4B5FD', fontSize: 21, fontWeight: '800' },
  heroMuted: { marginTop: 3, color: '#CAD6EE', fontSize: 10.5, fontWeight: '500' },
  progressTrack: { height: 8, marginTop: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: '#405171' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#A78BFA' },
  heroBottom: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroRemaining: { color: '#DFE7F8', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  summary: { marginTop: 12, flexDirection: 'row', gap: 8 },
  summaryItem: { flex: 1, minWidth: 0, minHeight: 109, alignItems: 'center', justifyContent: 'center', padding: 7, borderRadius: 17, borderWidth: 1, borderColor: '#E7E9EE', backgroundColor: '#FFFFFF' },
  summaryItemPressed: { backgroundColor: '#F1F5FB' },
  summaryIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  summaryLabel: { marginTop: 2, color: partnerTheme.colors.inkMuted, textAlign: 'center', fontSize: 10.5, fontWeight: '600' },
  card: { marginTop: 13, padding: 15, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7E9EE' },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { color: partnerTheme.colors.ink, fontSize: 16, fontWeight: '800' },
  smallPill: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F0F1F4', borderRadius: 999 },
  smallPillText: { fontSize: 10, color: '#667085', fontWeight: '700' },
  achievementRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  achievement: { flex: 1, minWidth: 0, alignItems: 'center' },
  achievementIcon: { width: 57, height: 57, borderRadius: 29, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  achievementTitle: { color: '#192333', fontSize: 11, lineHeight: 15, fontWeight: '700', textAlign: 'center', minHeight: 30 },
  achievementDate: { color: '#7A8698', fontSize: 9.5, textAlign: 'center', marginTop: 4 },
  filters: { flexDirection: 'row', gap: 5, marginBottom: 19 },
  filterButton: { flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 2, alignItems: 'center', borderRadius: 9, backgroundColor: '#F3F5F9' },
  filterActive: { backgroundColor: '#142849' },
  filterText: { fontSize: 10, fontWeight: '700', color: '#667085' },
  filterActiveText: { color: '#FFFFFF' },
  timeline: { paddingLeft: 1 },
  timelineRow: { minHeight: 74, flexDirection: 'row' },
  rail: { width: 49, alignItems: 'flex-start', paddingLeft: 1 },
  timelineArtwork: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  line: { width: 1.5, flex: 1, marginTop: 3, marginLeft: 18, marginBottom: 2, backgroundColor: '#E2E7EE' },
  timelineBody: { flex: 1, paddingBottom: 20 },
  timelineDate: { color: '#6C72A1', fontSize: 10, fontWeight: '700' },
  timelineTitle: { marginTop: 4, color: '#182333', fontSize: 12.5, fontWeight: '800' },
  timelineText: { marginTop: 4, color: '#667085', fontSize: 10.5, lineHeight: 15 },
  showMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 11, borderRadius: 11, backgroundColor: '#F0F4FA', marginTop: 3 },
  showMoreText: { color: '#315E9C', fontSize: 12, fontWeight: '700' },
});
