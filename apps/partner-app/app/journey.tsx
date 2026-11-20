import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStackBottomNavigation } from '@/components/partner-stack-bottom-navigation';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerJourney, type PartnerJourneyData } from '@/lib/journey';
import { getPartnerRenewalSummary, type PartnerRenewalSummary } from '@/lib/policies';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function JourneyScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerJourneyData | null>(null);
  const [renewalSummary, setRenewalSummary] = useState<PartnerRenewalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [journeyResult, renewalResult] = await Promise.allSettled([
        getPartnerJourney(), getPartnerRenewalSummary(),
      ]);
      if (journeyResult.status === 'rejected') throw journeyResult.reason;
      setData(journeyResult.value);
      setRenewalSummary(renewalResult.status === 'fulfilled' ? renewalResult.value : null);
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
    <PartnerScreen title="My progress" artwork={require('../assets/partner/icons/more-journey-3d-new.png')} onBack={() => router.back()}
      navyTopBar navyStatusBar bottomNavigationNavy
      bottomNavigation={<PartnerStackBottomNavigation activeTab="home" />}>
      {loading ? (
        <PartnerStateView state="loading" title="Loading your journey" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Your journey is temporarily unavailable" message={error || 'Your journey could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>
          <View style={styles.hero}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open renewals due in the next 30 days"
              onPress={() => router.push('/renewals')} style={({ pressed }) => [styles.next30Row, pressed && styles.summaryItemPressed]}>
              <Image source={PartnerAssets.actions.quickRenewals} style={styles.next30Artwork} resizeMode="contain" accessible={false} />
              <View style={styles.next30Details}>
                <Text style={styles.next30Eyebrow}>NEXT 30 DAYS</Text>
                <Text style={styles.next30Premium} numberOfLines={1}>
                  Net Premium - {renewalSummary ? formatWholeRupees(renewalSummary.due_30_premium) : '—'}
                </Text>
              </View>
              <Text style={styles.next30Count} numberOfLines={1}>
                POLICIES {renewalSummary ? renewalSummary.due_30_count.toLocaleString('en-IN') : '—'}
              </Text>
            </Pressable>
            <View style={styles.heroSectionDivider} accessible={false}/>
            <View style={styles.heroHeadline}>
              <Image source={require('../assets/partner/status/journey-trophy-reference.png')} style={styles.milestoneTrophy} resizeMode="contain" accessible={false} />
              <View style={styles.milestoneVerticalDivider} accessible={false}/>
              <View style={styles.milestoneCopy}>
                <Text style={styles.milestoneEyebrow}>NEXT MILESTONE</Text>
                <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} accessibilityLabel={data.next_milestone.title}>{data.next_milestone.title}</Text>
                <Text style={styles.milestoneSubtitle} numberOfLines={1}>{"Keep going, you're on track!"}</Text>
              </View>
              <CircularMilestoneProgress progress={progress} current={data.next_milestone.current} target={data.next_milestone.target} />
            </View>
            <View style={styles.summary}>
              <Summary value={data.policy_count} label="Policies" artwork={PartnerAssets.actions.quickPolicyIntake} onPress={() => router.push('/(tabs)/policies')} />
              <View style={styles.summaryDivider} accessible={false}/>
              <Summary value={data.customer_count} label="Customers" artwork={PartnerAssets.actions.quickCustomers} onPress={() => router.push('/customers')} />
              <View style={styles.summaryDivider} accessible={false}/>
              <Summary value={data.claim_count} label="Claims" artwork={PartnerAssets.actions.quickClaims} onPress={() => router.push('/(tabs)/claims')} />
            </View>
          </View>

          {achievements.length > 0 ? (
            <View style={styles.achievementSection}>
              <View style={styles.outsideHeading}>
                <Text style={styles.sectionTitle}>My achievements</Text>
                <View style={styles.smallPill}><Text style={styles.smallPillText}>Milestones</Text></View>
              </View>
              <View style={styles.achievementCard}>
                <View style={styles.achievementRow}>
                {achievements.map((item, index) => {
                  return (
                    <View key={`${item.kind}-${item.date}-${index}`} style={styles.achievement}>
                      <View style={styles.achievementIcon}>
                        <Image source={journeyMilestoneArtwork(item.kind, item.title)} style={styles.achievementArtwork} resizeMode="contain" accessibilityLabel={item.title} />
                      </View>
                      <Text style={styles.achievementTitle} numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={item.title}>{item.title}</Text>
                      <Text style={styles.achievementDate}>{formatDate(item.date)}</Text>
                    </View>
                  );
                })}
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeading}>
              <Text style={styles.sectionTitle}>Journey timeline</Text>
            </View>
            <View style={styles.filters}>
              {JOURNEY_FILTERS.map((choice, index) => (
                <Pressable
                  key={choice.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === choice.key }}
                  onPress={() => { setFilter(choice.key); setShowAll(false); }}
                  style={[styles.filterButton, filter === choice.key && styles.filterActive]}
                >
                  <View style={[styles.filterLabelRow, index === JOURNEY_FILTERS.length - 1 && styles.filterLabelLast]}>
                    <Text style={[styles.filterText, filter === choice.key && styles.filterActiveText]}>{choice.label}</Text>
                  </View>
                  <View style={[styles.filterUnderline, filter === choice.key && styles.filterUnderlineActive]}/>
                </Pressable>
              ))}
            </View>
            {visible.length ? (
              <View style={styles.timeline}>
                {visible.map((item, index) => {
                  return (
                    <View key={`${item.kind}-${item.date}-${index}`} style={[styles.timelineRow, index > 0 && styles.timelineDivider]}>
                      <Image source={journeyMilestoneArtwork(item.kind, item.title)} style={styles.timelineArtwork} resizeMode="contain" accessible={false} />
                      <View style={styles.timelineBody}>
                        <Text style={styles.timelineTitle} numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={item.title}>{item.title}</Text>
                        {item.subtitle ? <Text style={styles.timelineText} numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={item.subtitle}>{item.subtitle}</Text> : null}
                      </View>
                      <Text style={styles.timelineDate}>{formatDate(item.date)}</Text>
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

function Summary({ value, label, artwork, onPress }: { value: number; label: string; artwork: ImageSourcePropType; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}: ${value.toLocaleString('en-IN')}`} onPress={onPress} style={({ pressed }) => [styles.summaryItem, pressed && styles.summaryItemPressed]}>
      <Image source={artwork} style={styles.summaryArtwork} resizeMode="contain" accessible={false} />
      <View style={styles.summaryDetails}>
        <Text style={styles.summaryLabel} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.8}>{label}</Text>
        <Text style={styles.summaryValue} adjustsFontSizeToFit numberOfLines={1}>{value.toLocaleString('en-IN')}</Text>
      </View>
    </Pressable>
  );
}

const CIRCLE_SEGMENT_COUNT = 96;
const CIRCLE_SEGMENTS = Array.from({ length: CIRCLE_SEGMENT_COUNT }, (_, index) => {
  const angle = (index * 2 * Math.PI) / CIRCLE_SEGMENT_COUNT;
  return { left: 26 + Math.sin(angle) * 20.5 - 0.9, top: 26 - Math.cos(angle) * 20.5 - 1.5, rotate: `${index * 360 / CIRCLE_SEGMENT_COUNT}deg` };
});

function CircularMilestoneProgress({ progress, current, target }: { progress: number; current: number; target: number }) {
  const percentage = Math.round(progress * 100);
  const activeSegments = Math.round(progress * CIRCLE_SEGMENT_COUNT);
  return (
    <View style={styles.progressColumn}>
      <View style={styles.progressCircle} accessible accessibilityRole="progressbar" accessibilityLabel="Milestone progress"
        accessibilityValue={{ min: 0, max: Math.max(0, target), now: Math.max(0, Math.min(current, Math.max(0, target))) }}>
        {CIRCLE_SEGMENTS.map((segment, index) => (
          <View key={index} style={[styles.progressSegment, { left: segment.left, top: segment.top, transform: [{ rotate: segment.rotate }], backgroundColor: index < activeSegments ? '#7158DC' : '#E5E1FA' }]} />
        ))}
        <Text style={styles.progressCircleText}>{percentage}%</Text>
      </View>
      <Text style={styles.heroProgressLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>Milestone progress</Text>
    </View>
  );
}
function journeyMilestoneArtwork(kind: string, title: string): ImageSourcePropType {
  const value = `${kind} ${title}`.toLowerCase();
  if (value.includes('claim')) return PartnerAssets.actions.quickClaims;
  if (value.includes('customer')) return PartnerAssets.actions.quickCustomers;
  if (value.includes('policy') || value.includes('policies')) return PartnerAssets.actions.quickPolicyIntake;
  if (value.includes('₹') || value.includes('premium') || value.includes('month')) return PartnerAssets.actions.payoutGrowth;
  if (value.includes('start') || value.includes('journey')) return PartnerAssets.status.journey;
  return PartnerAssets.status.achievement;
}

function formatWholeRupees(value: number | string): string {
  const amount = Number(value);
  return formatIndianCurrency(Number.isFinite(amount) ? Math.trunc(amount) : 0);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  hero: { marginTop: 12, borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 18, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, backgroundColor: '#FFFFFF' },
  next30Row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 8, minHeight: 44 },
  next30Artwork: { width: 34, height: 34, flexShrink: 0 },
  next30Details: { flex: 1, minWidth: 0, gap: 3 },
  next30Eyebrow: { color: '#17233A', fontSize: 10, fontWeight: '800' },
  next30Premium: { color: '#53637C', fontSize: 10, fontWeight: '600' },
  next30Count: { color: '#17233A', fontSize: 9, fontWeight: '800', flexShrink: 0 },
  heroSectionDivider: { width: '100%', height: 1, backgroundColor: '#E1E5ED', marginBottom: 10 },
  heroHeadline: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 70 },
  milestoneTrophy: { width: 42, height: 42, borderRadius: 10, flexShrink: 0 },
  milestoneVerticalDivider: { width: 2, height: 43, backgroundColor: '#A78DEB', flexShrink: 0 },
  milestoneCopy: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 },
  milestoneEyebrow: { color: '#7154CE', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  heroTitle: { color: '#17233A', fontSize: 15, lineHeight: 19, fontWeight: '800' },
  milestoneSubtitle: { color: '#53637C', fontSize: 9, lineHeight: 13 },
  progressColumn: { width: 92, flexShrink: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  progressCircle: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  progressSegment: { position: 'absolute', width: 1.6, height: 3, borderRadius: 1 },
  progressCircleText: { color: '#6954D6', fontSize: 12, fontWeight: '800' },
  heroProgressLabel: { width: '100%', color: '#6856D5', fontSize: 9, fontWeight: '700', textAlign: 'center' },
  summary: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E1E5ED', flexDirection: 'row', alignItems: 'stretch', width: '100%' },
  summaryItem: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, paddingVertical: 4, gap: 4 },
  summaryItemPressed: { backgroundColor: '#F1F5FB' },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#A6B3C6', marginVertical: 5 },
  summaryArtwork: { width: 27, height: 29, flexShrink: 0 },
  summaryDetails: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start', justifyContent: 'center', gap: 1 },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  summaryLabel: { color: partnerTheme.colors.inkMuted, fontSize: 9, lineHeight: 12, fontWeight: '600' },
  card: { marginTop: 13, padding: 15, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7E9EE' },
  achievementSection: { marginTop: 15 },
  outsideHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  achievementCard: { padding: 15, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7E9EE' },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { color: partnerTheme.colors.ink, fontSize: 16, fontWeight: '800' },
  smallPill: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#E9E1FF', borderRadius: 999 },
  smallPillText: { fontSize: 10, color: '#6842B5', fontWeight: '700' },
  achievementRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  achievement: { flex: 1, minWidth: 0, alignItems: 'center' },
  achievementIcon: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center', marginBottom: 5, backgroundColor: 'transparent' },
  achievementArtwork: { width: 48, height: 48 },
  achievementTitle: { width: '100%', color: '#192333', fontSize: 10.5, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  achievementDate: { color: '#7A8698', fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 3 },
  filters: { flexDirection: 'row', gap: 0, width: '100%', marginBottom: 18 },
  filterButton: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  filterLabelRow: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 34, paddingHorizontal: 1, borderRightWidth: 1, borderRightColor: '#A6B3C6' },
  filterActive: {},
  filterLabelLast: { borderRightWidth: 0 },
  filterUnderline: { width: '100%', height: 1, backgroundColor: '#E3E8F0' },
  filterUnderlineActive: { height: 3, backgroundColor: '#2488ED' },
  filterText: { fontSize: 10, fontWeight: '700', color: '#667085' },
  filterActiveText: { color: '#17233A' },
  timeline: { borderTopWidth: 1, borderTopColor: '#E7E9EE' },
  timelineRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  timelineArtwork: { width: 30, height: 32, flexShrink: 0 },
  timelineDivider: { borderTopWidth: 1, borderTopColor: '#E7E9EE' },
  timelineBody: { flex: 1, minWidth: 0 },
  timelineDate: { width: 82, flexShrink: 0, color: '#6C72A1', fontSize: 9, fontWeight: '600', textAlign: 'right' },
  timelineTitle: { color: '#182333', fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  timelineText: { marginTop: 3, color: '#667085', fontSize: 10, lineHeight: 14 },
  showMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 11, borderRadius: 11, backgroundColor: '#F0F4FA', marginTop: 3 },
  showMoreText: { color: '#315E9C', fontSize: 12, fontWeight: '700' },
});
