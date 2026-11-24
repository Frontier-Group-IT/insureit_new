import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
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
  const [reducedMotion, setReducedMotion] = useState(false);
  const filterPosition = useRef(new Animated.Value(0)).current;
  const timelineOpacity = useRef(new Animated.Value(1)).current;
  const timelineOffset = useRef(new Animated.Value(0)).current;
  const [filterWidth, setFilterWidth] = useState(0);
  const filterTransition = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => () => {
    filterTransition.current?.stop();
    filterPosition.stopAnimation();
    timelineOpacity.stopAnimation();
    timelineOffset.stopAnimation();
  }, [filterPosition, timelineOpacity, timelineOffset]);

  const changeFilter = useCallback((next: JourneyFilter) => {
    if (next === filter) return;
    filterTransition.current?.stop();
    const nextIndex = JOURNEY_FILTERS.findIndex((choice) => choice.key === next);
    if (reducedMotion) {
      filterPosition.setValue(nextIndex);
      timelineOpacity.setValue(1);
      timelineOffset.setValue(0);
      setFilter(next);
      setShowAll(false);
      return;
    }
    Animated.timing(filterPosition, { toValue: nextIndex, duration: 280, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
    const exit = Animated.timing(timelineOpacity, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true });
    filterTransition.current = exit;
    exit.start(({ finished }) => {
      if (!finished) return;
      setFilter(next);
      setShowAll(false);
      timelineOffset.setValue(7);
      filterTransition.current = Animated.parallel([
        Animated.timing(timelineOpacity, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(timelineOffset, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]);
      filterTransition.current.start();
    });
  }, [filter, filterPosition, reducedMotion, timelineOpacity, timelineOffset]);

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
            <View style={styles.heroHeadline}>
              <MotionEntrance reducedMotion={reducedMotion} delay={60} icon><Image source={require('../assets/partner/status/journey-trophy-reference.png')} style={styles.milestoneTrophy} resizeMode="contain" accessible={false} /></MotionEntrance>
              <View style={styles.milestoneVerticalDivider} accessible={false}/>
              <View style={styles.milestoneBody}>
                <View style={styles.milestoneTopRow}>
                  <MotionEntrance reducedMotion={reducedMotion} delay={120} style={styles.milestoneCopy}>
                    <Text style={styles.milestoneEyebrow}>NEXT MILESTONE</Text>
                    <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} accessibilityLabel={data.next_milestone.title}>{data.next_milestone.title}</Text>
                  </MotionEntrance>
                  <CircularMilestoneProgress progress={progress} current={data.next_milestone.current} target={data.next_milestone.target} reducedMotion={reducedMotion} />
                </View>
                <View style={styles.milestoneBottomRow}>
                  <MotionEntrance reducedMotion={reducedMotion} delay={160} style={styles.milestoneSubtitle}><Text style={styles.milestoneSubtitleText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{"Keep going, you're on track!"}</Text></MotionEntrance>
                  <Text style={styles.heroProgressLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Milestone progress</Text>
                </View>
              </View>
            </View>
            <View style={styles.summary}>
              <Summary value={data.policy_count} label="Policies" artwork={PartnerAssets.actions.quickPolicyIntake} onPress={() => router.push('/(tabs)/policies')} reducedMotion={reducedMotion} delay={120} />
              <MotionEntrance reducedMotion={reducedMotion} delay={180} style={styles.summaryDivider} />
              <Summary value={data.customer_count} label="Customers" artwork={PartnerAssets.actions.quickCustomers} onPress={() => router.push('/customers')} reducedMotion={reducedMotion} delay={220} />
              <MotionEntrance reducedMotion={reducedMotion} delay={280} style={styles.summaryDivider} />
              <Summary value={data.claim_count} label="Claims" artwork={PartnerAssets.actions.quickClaims} onPress={() => router.push('/(tabs)/claims')} reducedMotion={reducedMotion} delay={320} />
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
                    <MotionEntrance key={`${item.kind}-${item.date}-${index}`} reducedMotion={reducedMotion} delay={300 + index * 100} style={styles.achievement}>
                      <PressScale reducedMotion={reducedMotion} style={styles.achievement} accessibilityLabel={item.title}>
                        <MotionEntrance reducedMotion={reducedMotion} delay={380 + index * 100} icon style={styles.achievementIcon}>
                          {index === 0 && recentlyUnlocked(item.date) ? <AchievementGlow reducedMotion={reducedMotion} /> : null}
                          <Image source={journeyMilestoneArtwork(item.kind, item.title)} style={styles.achievementArtwork} resizeMode="contain" accessibilityLabel={item.title} />
                        </MotionEntrance>
                        <Text style={styles.achievementTitle} numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={item.title}>{item.title}</Text>
                        <Text style={styles.achievementDate}>{formatDate(item.date)}</Text>
                      </PressScale>
                    </MotionEntrance>
                  );
                })}
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.timelineSection}>
            <View style={styles.outsideHeading}>
              <Text style={styles.sectionTitle}>Journey timeline</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.filters} onLayout={(event) => setFilterWidth(event.nativeEvent.layout.width)}>
              {JOURNEY_FILTERS.map((choice, index) => (
                <Pressable
                  key={choice.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === choice.key }}
                  onPress={() => changeFilter(choice.key)}
                  style={[styles.filterButton, filter === choice.key && styles.filterActive]}
                >
                  <View style={[styles.filterLabelRow, index === JOURNEY_FILTERS.length - 1 && styles.filterLabelLast]}>
                    <Animated.Text style={[styles.filterText, {
                      color: filterPosition.interpolate({
                        inputRange: [0, 1, 2, 3],
                        outputRange: JOURNEY_FILTERS.map((candidate) => candidate.key === choice.key ? '#17233A' : '#667085'),
                      }),
                    }]}>{choice.label}</Animated.Text>
                  </View>
                  <View style={styles.filterUnderline}/>
                </Pressable>
              ))}
              {filterWidth > 0 ? <Animated.View pointerEvents="none" style={[styles.filterSlidingUnderline, {
                width: filterWidth / JOURNEY_FILTERS.length,
                transform: [{ translateX: Animated.multiply(filterPosition, filterWidth / JOURNEY_FILTERS.length) }],
              }]} /> : null}
            </View>
            <Animated.View style={{ opacity: timelineOpacity, transform: [{ translateY: timelineOffset }] }}>
            {visible.length ? (
              <View style={styles.timeline}>
                {visible.map((item, index) => (
                  <MotionEntrance key={`${item.kind}-${item.date}-${index}`} reducedMotion={reducedMotion} delay={Math.min(index, 6) * 55} style={index > 0 ? styles.timelineDivider : undefined}>
                    <PressScale reducedMotion={reducedMotion} style={styles.timelineRow} contentStyle={styles.timelinePressContent} accessibilityLabel={item.title}>
                      <MotionEntrance reducedMotion={reducedMotion} delay={Math.min(index, 6) * 55 + 40} icon>
                        <Image source={journeyMilestoneArtwork(item.kind, item.title)} style={styles.timelineArtwork} resizeMode="contain" accessible={false} />
                      </MotionEntrance>
                      <View style={styles.timelineBody}>
                        <Text style={styles.timelineTitle} numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={item.title}>{item.title}</Text>
                        {item.subtitle ? <Text style={styles.timelineText} numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={item.subtitle}>{item.subtitle}</Text> : null}
                      </View>
                      <Text style={styles.timelineDate}>{formatDate(item.date)}</Text>
                    </PressScale>
                  </MotionEntrance>
                ))}
              </View>
            ) : (
              <PartnerStateView state="empty" title={filter === 'all' ? 'Your journey is just beginning' : 'No milestones in this category'} message="Recorded milestones will appear here when achieved." asset={PartnerAssets.status.journey} />
            )}
            </Animated.View>
            {filtered.length > 8 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={showAll ? 'Show fewer milestones' : 'View all milestones'} onPress={() => setShowAll(!showAll)} style={styles.showMore}>
                <Text style={styles.showMoreText}>{showAll ? 'Show less' : `View all ${filtered.length} milestones`}</Text>
                <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color="#315E9C" />
              </Pressable>
            ) : null}
            </View>
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

function Summary({ value, label, artwork, onPress, reducedMotion, delay }: { value: number; label: string; artwork: ImageSourcePropType; onPress: () => void; reducedMotion: boolean; delay: number }) {
  return (
    <MotionEntrance reducedMotion={reducedMotion} delay={delay} style={styles.summaryItem}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}: ${value.toLocaleString('en-IN')}`} onPress={onPress} style={({ pressed }) => [styles.summaryItem, styles.summaryPressable, pressed && styles.summaryItemPressed]}>
        <MotionEntrance reducedMotion={reducedMotion} delay={delay + 60} icon>
          <Image source={artwork} style={styles.summaryArtwork} resizeMode="contain" accessible={false} />
        </MotionEntrance>
        <View style={styles.summaryDetails}>
          <Text style={styles.summaryLabel} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.8}>{label}</Text>
          <AnimatedCount value={value} reducedMotion={reducedMotion} delay={delay} style={styles.summaryValue} />
        </View>
      </Pressable>
    </MotionEntrance>
  );
}

function MotionEntrance({ children, style, delay = 0, icon = false, reducedMotion }: { children?: ReactNode; style?: object; delay?: number; icon?: boolean; reducedMotion: boolean }) {
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const displacement = useRef(new Animated.Value(reducedMotion ? 0 : 8)).current;
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : 0.94)).current;
  useEffect(() => {
    if (reducedMotion) {
      opacity.stopAnimation(); displacement.stopAnimation(); scale.stopAnimation();
      opacity.setValue(1); displacement.setValue(0); scale.setValue(1);
      return;
    }
    opacity.setValue(0);
    displacement.setValue(icon ? 0 : 8);
    scale.setValue(icon ? 0.94 : 1);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      icon
        ? Animated.spring(scale, { toValue: 1, delay, friction: 9, tension: 85, useNativeDriver: true })
        : Animated.timing(displacement, { toValue: 0, duration: 400, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, displacement, scale, delay, icon, reducedMotion]);
  return <Animated.View style={[style, { opacity, transform: icon ? [{ scale }] : [{ translateY: displacement }] }]}>{children}</Animated.View>;
}

function PressScale({ children, style, contentStyle, reducedMotion, accessibilityLabel }: { children: ReactNode; style?: object; contentStyle?: object; reducedMotion: boolean; accessibilityLabel: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => {
    if (reducedMotion) { scale.setValue(1); return; }
    Animated.timing(scale, { toValue, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  useEffect(() => () => scale.stopAnimation(), [scale]);
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable accessible accessibilityLabel={accessibilityLabel} onPressIn={() => animate(0.975)} onPressOut={() => animate(1)} style={[styles.pressScaleContent, contentStyle]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function recentlyUnlocked(date: string) {
  const timestamp = Date.parse(`${date}T00:00:00`);
  return Number.isFinite(timestamp) && Date.now() >= timestamp && Date.now() - timestamp < 48 * 60 * 60 * 1000;
}

function AchievementGlow({ reducedMotion }: { reducedMotion: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 0.45, duration: 380, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);
  return <Animated.View pointerEvents="none" style={[styles.achievementGlow, { opacity }]} />;
}

function AnimatedCount({ value, reducedMotion, delay, style }: { value: number; reducedMotion: boolean; delay: number; style?: object }) {
  const animated = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  useEffect(() => {
    if (reducedMotion) { animated.stopAnimation(); animated.setValue(value); setDisplay(value); return; }
    animated.setValue(0);
    setDisplay(0);
    const listener = animated.addListener(({ value: next }) => setDisplay(Math.round(next)));
    const animation = Animated.timing(animated, { toValue: value, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setDisplay(value); });
    return () => { animation.stop(); animated.removeListener(listener); };
  }, [animated, value, reducedMotion, delay]);
  return <Text style={style} adjustsFontSizeToFit numberOfLines={1}>{display.toLocaleString('en-IN')}</Text>;
}

const CIRCLE_SEGMENT_COUNT = 96;
const CIRCLE_SEGMENTS = Array.from({ length: CIRCLE_SEGMENT_COUNT }, (_, index) => {
  const angle = (index * 2 * Math.PI) / CIRCLE_SEGMENT_COUNT;
  return { left: 20 + Math.sin(angle) * 15.5 - 0.8, top: 20 - Math.cos(angle) * 15.5 - 1.5, rotate: `${index * 360 / CIRCLE_SEGMENT_COUNT}deg` };
});

function CircularMilestoneProgress({ progress, current, target, reducedMotion }: { progress: number; current: number; target: number; reducedMotion: boolean }) {
  const animated = useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = useState(reducedMotion ? progress : 0);
  useEffect(() => {
    if (reducedMotion) { animated.stopAnimation(); animated.setValue(progress); setDisplayProgress(progress); return; }
    animated.setValue(0);
    setDisplayProgress(0);
    let lastPercent = -1;
    const listener = animated.addListener(({ value }) => {
      const percent = Math.round(value * 100);
      if (percent !== lastPercent) { lastPercent = percent; setDisplayProgress(value); }
    });
    const animation = Animated.timing(animated, { toValue: progress, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setDisplayProgress(progress); });
    return () => { animation.stop(); animated.removeListener(listener); };
  }, [animated, progress, reducedMotion]);
  const percentage = Math.round(displayProgress * 100);
  const activeSegments = Math.round(displayProgress * CIRCLE_SEGMENT_COUNT);
  return (
    <View style={styles.progressColumn}>
      <View style={styles.progressCircle} accessible accessibilityRole="progressbar" accessibilityLabel="Milestone progress"
        accessibilityValue={{ min: 0, max: Math.max(0, target), now: Math.max(0, Math.min(current, Math.max(0, target))) }}>
        {CIRCLE_SEGMENTS.map((segment, index) => (
          <View key={index} style={[styles.progressSegment, { left: segment.left, top: segment.top, transform: [{ rotate: segment.rotate }], backgroundColor: index < activeSegments ? '#7158DC' : '#E5E1FA' }]} />
        ))}
        <Text style={styles.progressCircleText}>{percentage}%</Text>
      </View>

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

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: -partnerTheme.spacing.lg, borderBottomWidth: 1, borderBottomColor: '#D7DFEB', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, backgroundColor: '#FFFFFF' },
  heroHeadline: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 70 },
  milestoneTrophy: { width: 42, height: 42, borderRadius: 10, flexShrink: 0 },
  milestoneVerticalDivider: { width: 2, height: 43, backgroundColor: '#A78DEB', flexShrink: 0 },
  milestoneBody: { flex: 1, minWidth: 0, justifyContent: 'center' },
  milestoneTopRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  milestoneBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3, marginTop: 3 },
  milestoneCopy: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 },
  milestoneEyebrow: { color: '#7154CE', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  heroTitle: { color: '#17233A', fontSize: 15, lineHeight: 19, fontWeight: '800' },
  milestoneSubtitle: { flex: 1, minWidth: 0, transform: [{ translateY: -6 }] },
  milestoneSubtitleText: { color: '#53637C', fontSize: 9, lineHeight: 13 },
  progressColumn: { width: 86, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  progressCircle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progressSegment: { position: 'absolute', width: 1.6, height: 3, borderRadius: 1 },
  progressCircleText: { color: '#6954D6', fontSize: 10, fontWeight: '800' },
  heroProgressLabel: { width: 86, flexShrink: 0, color: '#6856D5', fontSize: 9, lineHeight: 13, fontWeight: '700', textAlign: 'center' },
  summary: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E1E5ED', flexDirection: 'row', alignItems: 'stretch', width: '100%' },
  summaryItem: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 5, paddingVertical: 4, gap: 16 },
  summaryItemPressed: { backgroundColor: '#F1F5FB' },
  summaryPressable: { flex: 1, paddingHorizontal: 0, paddingVertical: 0 },
  pressScaleContent: { alignItems: 'center', justifyContent: 'center' },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#A6B3C6', marginVertical: 5 },
  summaryArtwork: { width: 27, height: 29, flexShrink: 0 },
  summaryDetails: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start', justifyContent: 'center', gap: 1 },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  summaryLabel: { color: partnerTheme.colors.inkMuted, fontSize: 9, lineHeight: 12, fontWeight: '600' },
  timelineSection: { marginTop: 13 },
  card: { padding: 15, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7E9EE' },
  achievementSection: { marginTop: 15 },
  outsideHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  achievementCard: { padding: 15, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7E9EE' },
  sectionTitle: { color: partnerTheme.colors.ink, fontSize: 16, fontWeight: '800' },
  smallPill: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#E9E1FF', borderRadius: 999 },
  smallPillText: { fontSize: 10, color: '#6842B5', fontWeight: '700' },
  achievementRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  achievement: { flex: 1, minWidth: 0, alignItems: 'center' },
  achievementIcon: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center', marginBottom: 5, backgroundColor: 'transparent' },
  achievementGlow: { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: '#E9E1FF' },
  achievementArtwork: { width: 48, height: 48 },
  achievementTitle: { width: '100%', color: '#192333', fontSize: 10.5, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  achievementDate: { color: '#7A8698', fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 3 },
  filters: { flexDirection: 'row', gap: 0, width: '100%', marginBottom: 18, position: 'relative' },
  filterButton: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  filterLabelRow: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 34, paddingHorizontal: 1, borderRightWidth: 1, borderRightColor: '#A6B3C6' },
  filterActive: {},
  filterLabelLast: { borderRightWidth: 0 },
  filterUnderline: { width: '100%', height: 1, backgroundColor: '#E3E8F0' },
  filterUnderlineActive: { height: 3, backgroundColor: '#2488ED' },
  filterSlidingUnderline: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: '#2488ED' },
  filterText: { fontSize: 10, fontWeight: '700', color: '#667085' },
  filterActiveText: { color: '#17233A' },
  timeline: { borderTopWidth: 1, borderTopColor: '#E7E9EE' },
  timelineRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  timelinePressContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-start' },
  timelineArtwork: { width: 30, height: 32, flexShrink: 0 },
  timelineDivider: { borderTopWidth: 1, borderTopColor: '#E7E9EE' },
  timelineBody: { flex: 1, minWidth: 0 },
  timelineDate: { width: 82, flexShrink: 0, color: '#6C72A1', fontSize: 9, fontWeight: '600', textAlign: 'right' },
  timelineTitle: { color: '#182333', fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  timelineText: { marginTop: 3, color: '#667085', fontSize: 10, lineHeight: 14 },
  showMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 11, borderRadius: 11, backgroundColor: '#F0F4FA', marginTop: 3 },
  showMoreText: { color: '#315E9C', fontSize: 12, fontWeight: '700' },
});
