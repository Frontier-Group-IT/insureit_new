import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerAnchoredDropdown } from '@/components/ui/partner-anchored-dropdown';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerWeeklyStory, type PartnerWeeklyStory } from '@/lib/engagement';
import { getPartnerBusinessRange, type PartnerBusinessRangeSummary } from '@/lib/home';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function WeeklyStoryScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(true);
  const animate = isFocused && foreground && !reduceMotion;
  const [data, setData] = useState<PartnerWeeklyStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comparisonDays, setComparisonDays] = useState<7 | 14 | 30>(7);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonData, setComparisonData] = useState<PartnerBusinessRangeSummary | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const rangeRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (live) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => { live = false; motion.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    const motion = Animated.timing(rangeRotation, { toValue: comparisonOpen ? 1 : 0, duration: animate ? 260 : 0, useNativeDriver: true });
    motion.start();
    return () => motion.stop();
  }, [comparisonOpen, animate, rangeRotation]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerWeeklyStory());
    } catch {
      setError('Your weekly summary could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (comparisonDays === 7) {
      setComparisonData(null);
      setComparisonError('');
      setComparisonLoading(false);
      return;
    }

    const range = comparisonDateRange(comparisonDays);
    let active = true;
    setComparisonLoading(true);
    setComparisonError('');
    void getPartnerBusinessRange(range.from, range.to)
      .then((result) => {
        if (active) setComparisonData(result);
      })
      .catch(() => {
        if (active) {
          setComparisonData(null);
          setComparisonError('Unable to load this comparison period.');
        }
      })
      .finally(() => {
        if (active) setComparisonLoading(false);
      });

    return () => {
      active = false;
    };
  }, [comparisonDays]);

  return (
    <PartnerScreen title="A week with INSUREIT" hideTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation activeTab="More" />}>
      <PartnerCasePageHeader title="A week with INSUREIT" icon="bar-chart-outline" onBack={() => router.back()} />
      {loading && !data ? (
        <WeeklySkeleton animate={animate} />
      ) : error && !data ? (
        <PartnerStateView
          state="error"
          title="Your week is temporarily unavailable"
          message={error || 'Your weekly summary could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : data ? (
        <View style={styles.pageBody}>
          <Entrance style={styles.hero} animate={animate} delay={0}>
            <AmbientGlow animate={animate} style={styles.heroGlowLarge} delay={0} />
            <AmbientGlow animate={animate} style={styles.heroGlowSmall} delay={220} />

            <View style={styles.heroTopRow}>
              <Text style={styles.dates}>{formatDate(data.week_start)} – {formatDate(data.week_end)}</Text>
              <View style={styles.periodPill}>
                <Ionicons name="calendar-outline" size={14} color="#1765C1" />
                <Text style={styles.periodPillText}>This Week</Text>
              </View>
            </View>

            <View style={styles.heroMainRow}>
              <View style={styles.heroCopy}>
                <AnimatedCurrency value={data.premium_this_week} style={styles.heroValue} animate={animate} />
                <Text style={styles.heroLabel}>Gross premium recorded this week</Text>
              </View>
              <GrowthBars animate={animate} />
            </View>

            <View style={styles.heroDivider} />
            <View style={styles.heroStats}>
              <HeroStat icon="document-text" iconBackground="#6267E9" value={data.policies_this_week} label="Policies" animate={animate} delay={100} />
              <View style={styles.statDivider} />
              <HeroStat icon="people" iconBackground="#28A790" value={data.customers_this_week} label="Customers added" animate={animate} delay={200} />
              <View style={styles.statDivider} />
              <HeroStat icon="shield-checkmark" iconBackground="#D96C47" value={data.claims_progressed_this_week} label="Claims progressed" animate={animate} delay={300} />
            </View>
          </Entrance>

          <Entrance style={styles.comparisonSectionHeading} animate={animate} delay={130}>
            <Text style={styles.sectionTitle}>{comparisonDays === 7 ? 'Compared with last week' : `Compared with previous ${comparisonDays} days`}</Text>
          <View style={styles.compareHeader}>
            <View style={styles.rangeWrap}>
              <PartnerAnchoredDropdown
                visible={comparisonOpen}
                onDismiss={() => setComparisonOpen(false)}
                align="right"
                menuWidth={142}
                menu={(
                  <Entrance animate={animate && comparisonOpen} delay={0} style={styles.rangeMenu}>
                    {[7, 14, 30].map((days) => (
                      <Pressable
                        key={days}
                        accessibilityRole="button"
                        accessibilityLabel={`Use last ${days} days comparison`}
                        onPress={() => {
                          setComparisonDays(days as 7 | 14 | 30);
                          setComparisonOpen(false);
                          void Haptics.selectionAsync().catch(() => {});
                        }}
                        style={({ pressed }) => [
                          styles.rangeOption,
                          comparisonDays === days && styles.rangeOptionActive,
                          pressed && styles.cardPressed,
                        ]}
                      >
                        <Text style={[styles.rangeOptionText, comparisonDays === days && styles.rangeOptionTextActive]}>{`Last ${days} days`}</Text>
                        {comparisonDays === days ? <Ionicons name="checkmark" size={14} color="#1765C1" /> : null}
                      </Pressable>
                    ))}
                  </Entrance>
                )}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Comparison period: last ${comparisonDays} days`}
                  accessibilityState={{ expanded: comparisonOpen }}
                  onPress={() => setComparisonOpen((value) => !value)}
                  style={({ pressed }) => [styles.rangePill, pressed && styles.cardPressed]}
                >
                  <Ionicons name="calendar-outline" size={14} color="#33415F" />
                  <Text style={styles.rangePillText}>{`Last ${comparisonDays} days`}</Text>
                  <Animated.View style={{ transform: [{ rotate: rangeRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}><Ionicons name="chevron-down" size={14} color="#33415F" /></Animated.View>
                </Pressable>
              </PartnerAnchoredDropdown>
            </View>
          </View>
          </Entrance>
          <Entrance style={styles.compareCard} animate={animate} delay={180}>

            {comparisonLoading ? (
              <View style={styles.compareMessage}><Text style={styles.compareMessageText}>Updating comparison…</Text></View>
            ) : comparisonError ? (
              <View style={styles.compareMessage}><Text style={styles.compareErrorText}>{comparisonError}</Text></View>
            ) : (
              <View style={styles.compareBody}>
                <View style={styles.previousMetric}>
                  <View style={styles.compareIcon}><MiniBars /></View>
                  <View style={styles.previousCopy}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.compareValue}>
                      <AnimatedCurrencyText value={comparisonDays === 7 ? data.premium_last_week : comparisonData?.premium_previous_period ?? 0} animate={animate} />
                    </Text>
                    <Text style={styles.compareLabel}>{comparisonDays === 7 ? 'Last week premium' : `Previous ${comparisonDays} days premium`}</Text>
                  </View>
                </View>
                <View style={styles.compareDivider} />
                <Trend value={Number(comparisonDays === 7 ? data.premium_change_percent || 0 : comparisonData?.premium_change_percent ?? 0)} caption={comparisonDays === 7 ? undefined : `vs previous ${comparisonDays} days`} animate={animate} />
              </View>
            )}
          </Entrance>

          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={23} color="#168C7B" />
            <Text style={styles.sectionTitle}>Coming next</Text>
            <DividerReveal animate={animate} />
          </View>
          <Entrance animate={animate} delay={350}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open renewals"
            onPress={() => router.push('/renewals')}
            style={({ pressed }) => [styles.nextCard, pressed && styles.cardPressed]}
          >
            <View style={styles.nextIcon}>
              <IconTurn animate={animate}><Image source={PartnerAssets.actions.quickRenewals} style={styles.nextArtwork} resizeMode="contain" /></IconTurn>
            </View>
            <View style={styles.nextBody}>
              <Text style={styles.nextTitle}>{data.renewals_next_week} renewal{data.renewals_next_week === 1 ? '' : 's'} next week</Text>
              <Text style={styles.nextText}>{formatIndianCurrency(data.renewal_premium_next_week)} gross premium is approaching renewal.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#0F3D8A" />
          </Pressable>
          </Entrance>

          <Entrance style={styles.endCard} animate={animate} delay={450}>
            <AmbientGlow animate={animate} style={styles.reflectionGlow} delay={200} />
            <View style={styles.reflectionIcon}><Ionicons name="document-text-outline" size={22} color="#079A87" /></View>
            <Entrance style={styles.reflectionCopy} animate={animate} delay={560}>
              <Text style={styles.endEyebrow}>WEEKLY REFLECTION</Text>
              <Text style={styles.endTitle}>{data.policies_this_week > 0 ? 'Real progress, recorded.' : 'A quiet week is still useful data.'}</Text>
              <Text style={styles.endText}>{data.policies_this_week > 0 ? 'Keep up the good work and continue building momentum this week.' : 'Use the signals from this week to focus the next conversation and opportunity.'}</Text>
            </Entrance>
            <ReflectionGrowth animate={animate} />
          </Entrance>
        </View>
      ) : null}
    </PartnerScreen>
  );
}


/** Only existing native/OTA-safe React Native animation primitives are used here. */
function useEntrance(animate: boolean, delay: number, duration = 410) {
  const fade = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const rise = useRef(new Animated.Value(animate ? 9 : 0)).current;
  useEffect(() => {
    if (!animate) {
      fade.setValue(1); rise.setValue(0);
      return;
    }
    fade.setValue(0); rise.setValue(9);
    const motion = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    motion.start();
    return () => motion.stop();
  }, [animate, delay, duration, fade, rise]);
  return { opacity: fade, transform: [{ translateY: rise }] };
}

function Entrance({ children, style, animate, delay = 0 }: { children: ReactNode; style?: ViewStyle; animate: boolean; delay?: number }) {
  const motion = useEntrance(animate, delay);
  return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}

function AnimatedNumber({ value, animate, duration = 900, delay = 0, money = false, percent = false }: {
  value: number; animate: boolean; duration?: number; delay?: number; money?: boolean; percent?: boolean;
}) {
  const motion = useRef(new Animated.Value(0)).current;
  const [number, setNumber] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate || !Number.isFinite(value) || value === 0) {
      motion.stopAnimation();
      motion.setValue(Number.isFinite(value) ? value : 0);
      setNumber(Number.isFinite(value) ? value : 0);
      return;
    }
    motion.setValue(0);
    setNumber(0);
    let displayed = Number.NaN;
    const listener = motion.addListener(({ value: next }) => {
      // Avoid more React work than necessary while displaying the count-up.
      const rounded = money ? Math.round(next * 100) / 100 : percent ? Math.round(next * 10) / 10 : Math.round(next);
      if (rounded !== displayed) { displayed = rounded; setNumber(rounded); }
    });
    const animation = Animated.timing(motion, { toValue: value, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setNumber(value); });
    return () => { animation.stop(); motion.removeListener(listener); };
  }, [motion, value, animate, duration, delay, money, percent]);
  return <>{money ? formatIndianCurrency(number) : percent ? Math.abs(number).toFixed(1) + '%' : Math.round(number).toLocaleString('en-IN')}</>;
}

function AnimatedCurrency({ value, style, animate }: { value: number; style: TextStyle; animate: boolean }) {
  return <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={style}>
    <AnimatedNumber value={value} money animate={animate} duration={1400} />
  </Text>;
}
function AnimatedCurrencyText({ value, animate }: { value: number; animate: boolean }) {
  return <AnimatedNumber value={value} money animate={animate} duration={1000} />;
}

function HeroStat({ icon, iconBackground, value, label, animate, delay }: {
  icon: 'document-text' | 'people' | 'shield-checkmark'; iconBackground: string; value: number; label: string; animate: boolean; delay: number;
}) {
  const motion = useEntrance(animate, delay);
  const scale = useRef(new Animated.Value(animate ? 0.9 : 1)).current;
  useEffect(() => {
    if (!animate) { scale.setValue(1); return; }
    scale.setValue(0.9);
    const spring = Animated.spring(scale, { toValue: 1, friction: 10, tension: 75, delay, useNativeDriver: true });
    spring.start();
    return () => spring.stop();
  }, [animate, delay, scale]);
  return (
    <Animated.View style={[styles.stat, motion]}>
      <Animated.View style={[styles.statIcon, { backgroundColor: iconBackground, transform: [{ scale }] }]}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </Animated.View>
      <View style={styles.statCopy}>
        <Text style={styles.statValue}><AnimatedNumber value={value} animate={animate} duration={900} delay={delay} /></Text>
        <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
      </View>
    </Animated.View>
  );
}

function Trend({ value, caption, animate }: { value: number; caption?: string; animate: boolean }) {
  const positive = value > 0;
  const negative = value < 0;
  const color = positive ? '#14845F' : negative ? '#D52234' : '#667085';
  const backgroundColor = positive ? '#EAF8F2' : negative ? '#FFF0F2' : '#F2F4F7';
  const trendMotion = useEntrance(animate, 90, 300);
  return (
    <View style={[styles.trend, { backgroundColor }]}>
      <Animated.View style={trendMotion}>
        <Ionicons name={positive ? 'trending-up' : negative ? 'trending-down' : 'remove-outline'} size={24} color={color} />
      </Animated.View>
      <View style={styles.trendCopy}>
        <Text numberOfLines={1} style={[styles.trendValue, { color }]}>
          <AnimatedNumber value={value} animate={animate} duration={850} percent />
        </Text>
        <Text numberOfLines={2} style={[styles.trendCaption, { color }]}>
          {caption ?? (positive ? 'Higher than last week' : negative ? 'Lower than last week' : 'Unchanged from last week')}
        </Text>
      </View>
    </View>
  );
}

/** Heights are the existing decorative artwork, NOT real daily premium analytics. */
function AnimatedBar({ height, index, animate, reflection = false }: { height: number; index: number; animate: boolean; reflection?: boolean }) {
  const growth = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) { growth.setValue(1); return; }
    growth.setValue(0);
    const animation = Animated.timing(growth, {
      toValue: 1, duration: 580, delay: (reflection ? 220 : 110) + index * 90,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [animate, index, growth, reflection]);
  const transform = [
    { translateY: growth.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] }) },
    { scaleY: growth },
  ];
  const originalOpacity = reflection ? 0.28 + index * 0.14 : 0.7 + index * 0.05;
  return <Animated.View style={[reflection ? styles.reflectionBar : styles.growthBar, { height, opacity: originalOpacity, transform }]} />;
}
function GrowthBars({ animate }: { animate: boolean }) {
  const heights = [22, 34, 48, 38, 50, 68];
  return <View pointerEvents="none" style={styles.growthBars}>
    {heights.map((height, index) => <AnimatedBar key={index} height={height} index={index} animate={animate} />)}
  </View>;
}

function MiniBars() {
  return <View style={styles.miniBars}><View style={[styles.miniBar, { height: 10 }]} /><View style={[styles.miniBar, { height: 16 }]} /><View style={[styles.miniBar, { height: 23 }]} /></View>;
}

function ReflectionGrowth({ animate }: { animate: boolean }) {
  const motion = useEntrance(animate, 400);
  return (
    <View pointerEvents="none" style={styles.reflectionGrowth}>
      <Animated.View style={[styles.reflectionArrow, motion]}><Ionicons name="arrow-up-outline" size={28} color="#69CFC2" /></Animated.View>
      <View style={styles.reflectionBars}>
        {[18, 31, 48].map((height, index) => <AnimatedBar key={index} height={height} index={index} animate={animate} reflection />)}
      </View>
    </View>
  );
}

function IconTurn({ children, animate }: { children: ReactNode; animate: boolean }) {
  const turn = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) { turn.setValue(1); return; }
    turn.setValue(0);
    const animation = Animated.timing(turn, { toValue: 1, duration: 420, delay: 390, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [animate, turn]);
  return <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '0deg'] }) }] }}>{children}</Animated.View>;
}

function DividerReveal({ animate }: { animate: boolean }) {
  const growth = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) { growth.setValue(1); return; }
    growth.setValue(0);
    const animation = Animated.timing(growth, { toValue: 1, duration: 450, delay: 320, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [animate, growth]);
  return <View style={styles.headingRule}><Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#36AA97', transform: [{ scaleX: growth }] }]} /></View>;
}

function AmbientGlow({ animate, style, delay }: { animate: boolean; style: ViewStyle; delay: number }) {
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { motion.setValue(0); return; }
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(motion, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animate, delay, motion]);
  return <Animated.View pointerEvents="none" style={[style, {
    transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [-7, 7] }) }],
  }]} />;
}
function WeeklySkeleton({ animate }: { animate: boolean }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (!animate) { pulse.setValue(0.7); return; }
    const shimmer = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]));
    shimmer.start();
    return () => shimmer.stop();
  }, [animate, pulse]);
  return <View style={styles.weeklySkeleton} accessibilityRole="progressbar" accessibilityLabel="Loading your week">
    <Animated.View style={[styles.skeletonHero, { opacity: pulse }]}>
      <View style={[styles.skeletonLine, { width: '48%' }]} />
      <View style={[styles.skeletonLine, { height: 34, width: '72%' }]} />
      <View style={[styles.skeletonLine, { width: '63%' }]} />
      <View style={[styles.skeletonLine, { width: '88%' }]} />
    </Animated.View>
    {[0, 1, 2].map((i) => <Animated.View key={i} style={[styles.skeletonCard, { opacity: pulse }]}>
      <View style={[styles.skeletonLine, { width: i === 2 ? '40%' : '60%' }]} />
      <View style={[styles.skeletonLine, { width: '82%' }]} />
    </Animated.View>)}
  </View>;
}

function comparisonDateRange(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: localDate(from), to: localDate(to) };
}

function localDate(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(d);
}

const styles = StyleSheet.create({
  pageBody: { gap: 0, paddingTop: 2 },
  hero: { position: 'relative', overflow: 'hidden', minHeight: 192, borderRadius: 18, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 15, backgroundColor: '#0756BE', shadowColor: '#0A3D8A', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  heroGlowLarge: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -68, top: -156, backgroundColor: 'rgba(20, 116, 235, 0.52)' },
  heroGlowSmall: { position: 'absolute', width: 188, height: 188, borderRadius: 94, right: 28, top: -120, backgroundColor: 'rgba(43, 137, 245, 0.22)' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dates: { flex: 1, color: '#B9D5FF', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  periodPill: { minHeight: 30, minWidth: 92, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE9FA' },
  periodPillText: { color: '#1765C1', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  heroMainRow: { minHeight: 78, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  heroCopy: { flex: 1, minWidth: 0, paddingTop: 7, paddingBottom: 5 },
  heroValue: { color: '#FFFFFF', fontSize: 31, lineHeight: 37, fontWeight: '800', letterSpacing: -0.8 },
  heroLabel: { marginTop: 3, color: '#E7F1FF', fontSize: 12, lineHeight: 17, fontWeight: '500' },
  growthBars: { width: 140, height: 72, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 7 },
  growthBar: { width: 17, borderRadius: 6, backgroundColor: '#BBDDFF', shadowColor: '#FFFFFF', shadowOpacity: 0.24, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  heroDivider: { height: StyleSheet.hairlineWidth, marginTop: 4, backgroundColor: 'rgba(210, 231, 255, 0.34)' },
  heroStats: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingTop: 12 },
  stat: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statCopy: { flex: 1, minWidth: 0 },
  statValue: { color: '#FFFFFF', fontSize: 18, lineHeight: 21, fontWeight: '800' },
  statLabel: { marginTop: 1, color: '#E2EEFF', fontSize: 9.5, lineHeight: 13, fontWeight: '500' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 38, marginHorizontal: 13, backgroundColor: 'rgba(218, 235, 255, 0.30)' },
  comparisonSectionHeading: { marginTop: 18, marginBottom: 8, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  compareCard: { borderRadius: 16, paddingHorizontal: 15, paddingTop: 13, paddingBottom: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EAF2', shadowColor: '#163565', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  compareHeader: { position: 'relative', zIndex: 5, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  sectionHeader: { marginTop: 19, marginBottom: 9, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 29 },
  headingRule: { flex: 1, height: 2, marginLeft: 3, backgroundColor: 'transparent', overflow: 'hidden' },
  sectionTitle: { flexShrink: 1, color: '#07142F', fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: -0.2 },
  rangeWrap: { position: 'relative', zIndex: 10 },
  rangePill: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#E1E6EF', backgroundColor: '#FFFFFF' },
  rangePillText: { color: '#1B2944', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  rangeMenu: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#E1E6EF', backgroundColor: '#FFFFFF', shadowColor: '#163565', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  rangeOption: { minHeight: 38, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rangeOptionActive: { backgroundColor: '#F0F6FF' },
  rangeOptionText: { color: '#526078', fontSize: 11, fontWeight: '600' },
  rangeOptionTextActive: { color: '#1765C1', fontWeight: '800' },
  compareMessage: { minHeight: 69, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  compareMessageText: { color: '#77839A', fontSize: 10.5, fontWeight: '600' },
  compareErrorText: { color: partnerTheme.colors.danger, fontSize: 10.5, fontWeight: '600' },
  compareBody: { minHeight: 69, flexDirection: 'row', alignItems: 'center' },
  previousMetric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 13 },
  compareIcon: { width: 47, height: 47, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EAFE' },
  miniBars: { height: 25, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  miniBar: { width: 5, borderRadius: 3, backgroundColor: '#7D5CF3' },
  previousCopy: { flex: 1, minWidth: 0 },
  compareValue: { color: '#07142F', fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.25 },
  compareLabel: { marginTop: 3, color: '#77839A', fontSize: 10.5, lineHeight: 14, fontWeight: '500' },
  compareDivider: { width: StyleSheet.hairlineWidth, height: 48, marginHorizontal: 12, backgroundColor: '#DCE2EC' },
  trend: { width: 144, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 12 },
  trendCopy: { flex: 1, minWidth: 0, alignItems: 'center' },
  trendValue: { fontSize: 15, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  trendCaption: { marginTop: 2, fontSize: 9.5, lineHeight: 12, fontWeight: '500', textAlign: 'center', flexShrink: 1 },
  nextCard: { minHeight: 79, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E7F0', shadowColor: '#163565', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardPressed: { opacity: 0.72 },
  nextIcon: { position: 'relative', width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F1FF' },
  nextArtwork: { width: 40, height: 40 },
  nextBody: { flex: 1, minWidth: 0 },
  nextTitle: { color: '#07142F', fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  nextText: { marginTop: 5, color: '#65728C', fontSize: 10.5, lineHeight: 15, fontWeight: '500' },
  endCard: { position: 'relative', overflow: 'hidden', minHeight: 104, marginTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#A6DFD1', shadowColor: '#36AA97', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  reflectionGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -62, top: -72, backgroundColor: 'rgba(220, 247, 243, 0.42)' },
  reflectionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7F4EF' },
  reflectionCopy: { flex: 1, minWidth: 0, paddingTop: 2, paddingRight: 72 },
  endEyebrow: { color: '#31877E', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.65 },
  endTitle: { marginTop: 4, color: '#07142F', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  endText: { marginTop: 3, color: '#61738A', fontSize: 10.5, lineHeight: 15, fontWeight: '500' },
  reflectionGrowth: { position: 'absolute', right: 15, bottom: 12, width: 74, height: 68, justifyContent: 'flex-end', alignItems: 'flex-end' },
  reflectionArrow: { position: 'absolute', right: 2, top: 0, transform: [{ rotate: '36deg' }] },
  reflectionBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  reflectionBar: { width: 12, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#64CFC1' },
  weeklySkeleton: { gap: 18, paddingTop: 8, paddingBottom: 22 },
  skeletonHero: { height: 192, borderRadius: 18, backgroundColor: '#CEE0F7', padding: 18, gap: 17 },
  skeletonCard: { height: 86, borderRadius: 16, backgroundColor: '#E1EAF7', padding: 16, gap: 15 },
  skeletonLine: { height: 13, borderRadius: 7, backgroundColor: '#F6FAFF' },
});
