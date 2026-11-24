import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AccessibilityInfo, Animated, AppState, Easing, Image, type ImageSourcePropType, Platform, Pressable, StyleSheet, Text, View, type TextStyle, type StyleProp } from 'react-native';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerRecognition, type PartnerRecognition } from '@/lib/engagement';
import { PartnerAssets } from '@/lib/partner-assets';
import { usePartnerSession } from '@/providers/partner-session-provider';
import { reconcileRecognitionHistory } from '@/lib/recognition-motion';

type RecognitionItem = PartnerRecognition['items'][number];
const PURPLE = '#6325D7';
const INK = '#101A54';
const RING_COUNT = 120;
const RING_SIZE = 50;
const RING_RADIUS = 20.5;
const RING_SEGMENTS = Array.from({ length: RING_COUNT }, (_, index) => {
  const angle = (index * 360) / RING_COUNT;
  const radians = angle * Math.PI / 180;
  return {
    left: RING_SIZE / 2 + RING_RADIUS * Math.sin(radians) - 1.85,
    top: RING_SIZE / 2 - RING_RADIUS * Math.cos(radians) - 1.05,
    transform: [{ rotate: `${angle}deg` as `${number}deg` }],
  };
});

const NATIVE_MOTION = Platform.OS !== 'web';
const EASE = Easing.out(Easing.cubic);
const SPRING = { stiffness: 190, damping: 21, mass: 0.8, overshootClamping: true, useNativeDriver: NATIVE_MOTION, isInteraction: false } as const;
const COUNT_MS = 680;

function useScreenMotion() {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState == null || AppState.currentState === 'active' || Platform.OS === 'web');
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    let changed = false;
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true;
      if (live) setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (live && !changed) setReduced(value);
    }).catch(() => { if (live && !changed) setReduced(true); });
    return () => { live = false; app.remove(); preference.remove(); };
  }, []);
  const visible = focused && foreground;
  return { visible, motion: visible && reduced === false };
}

function useEntrance(motion: boolean, delay = 0) {
  const value = useRef(new Animated.Value(1)).current;
  const played = useRef(false);
  useEffect(() => {
    if (!motion) { value.setValue(1); return; }
    if (played.current) return;
    played.current = true;
    value.setValue(0);
    const animation = Animated.sequence([Animated.delay(delay), Animated.spring(value, { ...SPRING, toValue: 1 })]);
    animation.start();
    return () => { animation.stop(); value.setValue(1); };
  }, [motion, delay, value]);
  return value;
}
function entrance(value: Animated.Value) {
  return { opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [7, 0], extrapolate: 'clamp' }) }] };
}
function Entrance({ children, motion, delay = 0 }: { children: ReactNode; motion: boolean; delay?: number }) {
  const value = useEntrance(motion, delay);
  return <Animated.View style={entrance(value)}>{children}</Animated.View>;
}

function useNewAchievements(data: PartnerRecognition | null, actorId: string, visible: boolean) {
  const [celebrating, setCelebrating] = useState<ReadonlySet<string>>(() => new Set());
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    setCelebrating(previous => previous.size ? new Set() : previous);
    if (!data || !actorId || !visible) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = `partner:recognition-seen:v1:${actorId}`;
    const codes = [...new Set(data.items.map(item => item.code).filter(Boolean))];
    writes.current = writes.current.catch(() => {}).then(async () => {
      if (cancelled) return;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;
        const { newlyUnlocked, persisted, shouldWrite } = reconcileRecognitionHistory(raw, codes);
        if (shouldWrite) await AsyncStorage.setItem(key, persisted);
        if (cancelled || !newlyUnlocked.length) return;
        setCelebrating(new Set(newlyUnlocked));
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        timer = setTimeout(() => { if (!cancelled) setCelebrating(new Set()); }, 1250);
      } catch {
        // Cannot prove a new unlock when storage fails; do not celebrate.
      }
    });
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [data, actorId, visible]);
  return celebrating;
}

const PARTICLES = [[-13,-15],[5,-21],[24,-14],[31,3],[23,20],[4,23],[-16,13],[-22,-1]] as const;
function Celebration({ enabled }: { enabled: boolean }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return;
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, duration: 1100, easing: EASE, useNativeDriver: NATIVE_MOTION, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [enabled, value]);
  if (!enabled) return null;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.particleOrigin}>
    {PARTICLES.map(([x,y], index) => <Animated.View key={index} style={[styles.particle, {
      opacity: value.interpolate({ inputRange: [0, 0.12, 0.65, 1], outputRange: [0, 1, 0.8, 0] }),
      transform: [{ translateX: value.interpolate({ inputRange: [0, 1], outputRange: [0, x * 1.65] }) },
        { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, y * 1.65] }) },
        { rotate: value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', index % 2 ? '55deg' : '-45deg'] }) }],
    }]}>{index % 3 === 0 ? <Ionicons name="sparkles" size={9} color="#E4AA32" /> : <View style={[styles.confettiPiece, index % 2 === 0 && styles.confettiLavender]} />}</Animated.View>)}
  </View>;
}
function AchievementCard({ item, index, motion, celebrate }: { item: RecognitionItem; index: number; motion: boolean; celebrate: boolean }) {
  const delay = Math.min(index, 8) * 100;
  const appear = useEntrance(motion, delay);
  const shine = useRef(new Animated.Value(0)).current;
  const played = useRef(false);
  useEffect(() => {
    if (!motion || played.current) return;
    played.current = true;
    const animation = Animated.sequence([Animated.delay(delay + 100), Animated.timing(shine, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_MOTION, isInteraction: false })]);
    animation.start();
    return () => { animation.stop(); shine.setValue(0); };
  }, [motion, delay, shine]);
  return <Animated.View style={[styles.card, entrance(appear)]}>
    <Animated.View pointerEvents="none" accessible={false} style={[styles.cardGlow, { opacity: shine.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.6, 0] }) }]} />
    <View style={styles.artworkTile}>
      <Image source={milestoneArtwork(item.icon, item.title)} style={styles.achievementArtwork} resizeMode="contain" />
      <View pointerEvents="none" accessible={false} style={styles.iconShineClip}>
        <Animated.View style={[styles.iconShine, {
          opacity: shine.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [0, 0.28, 0.28, 0] }),
          transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-35, 65] }) }, { rotate: '24deg' }],
        }]} />
      </View>
      <Celebration enabled={motion && celebrate} />
    </View>
    <View style={styles.verticalRule} />
    <View style={styles.achievementHeading}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.supportingText}>A great start!</Text>
    </View>
    <View style={styles.achievementMeta}>
      <Animated.View style={[styles.earnedPill, { transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1], extrapolate: 'clamp' }) }] }]}>
        <Ionicons name="checkmark-circle" size={14} color={PURPLE} />
        <Text style={styles.earnedPillText}>ACHIEVED</Text>
      </Animated.View>
      {item.date ? <View style={styles.dateRow}><Ionicons name="calendar-outline" size={13} color={PURPLE} /><Text style={styles.date}>{formatDate(item.date)}</Text></View> : null}
    </View>
  </Animated.View>;
}

function Trophy({ motion }: { motion: boolean }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) { value.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_MOTION, isInteraction: false }),
      Animated.timing(value, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_MOTION, isInteraction: false }),
      Animated.delay(1800),
    ]));
    animation.start();
    return () => { animation.stop(); value.setValue(0); };
  }, [motion, value]);
  return <View style={styles.artworkTile}>
    <Animated.View pointerEvents="none" accessible={false} style={[styles.trophyGlow, {
      opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0, 0.32] }),
      transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] }) }],
    }]} />
    <Animated.Image source={require('../assets/partner/status/journey-trophy-reference.png')} style={[styles.achievementArtwork, {
      transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
    }]} resizeMode="contain" />
  </View>;
}

function blendColor(from: readonly number[], to: readonly number[], fraction: number) {
  return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * fraction)).join(',')})`;
}
const RING_COLORS = RING_SEGMENTS.map((_, index) => {
  const t = index / Math.max(1, RING_COUNT - 1);
  return t < 0.5 ? blendColor([99,37,215], [141,80,217], t * 2) : blendColor([141,80,217], [84,27,199], (t - 0.5) * 2);
});
const ProgressRing = memo(function ProgressRing({ progress, motion }: { progress: number; motion: boolean }) {
  const value = useRef(new Animated.Value(progress)).current;
  const animated = useRef(false);
  useEffect(() => {
    if (!motion) { value.setValue(progress); return; }
    if (!animated.current) { animated.current = true; value.setValue(0); }
    const animation = Animated.timing(value, { toValue: progress, duration: COUNT_MS, easing: EASE, useNativeDriver: NATIVE_MOTION, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [progress, motion, value]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <View style={styles.ringBase} />
    {RING_SEGMENTS.map((segment, index) => (
      <Animated.View key={`fill-${index}`} accessible={false} style={[styles.progressSegment, segment, {
        backgroundColor: RING_COLORS[index],
        opacity: value.interpolate({ inputRange: [(index + 0.49) / RING_COUNT, (index + 0.5) / RING_COUNT], outputRange: [0, 1], extrapolate: 'clamp' }),
      }]} />
    ))}
  </View>;
});

function AnimatedMetric({ value, format, style, motion }: { value: number; format: (value: number) => string; style: StyleProp<TextStyle>; motion: boolean }) {
  const [shown, setShown] = useState(value);
  const displayed = useRef(value);
  const animated = useRef(false);
  useEffect(() => {
    if (!motion || !Number.isFinite(value)) { displayed.current = value; setShown(value); return; }
    const startValue = animated.current ? displayed.current : 0;
    animated.current = true;
    displayed.current = startValue;
    setShown(startValue);
    let frame = 0;
    let start: number | undefined;
    let last = -Infinity;
    const tick = (now: number) => {
      start ??= now;
      const ratio = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      if (now - last >= 32 || ratio === 1) {
        displayed.current = startValue + (value - startValue) * EASE(ratio);
        setShown(displayed.current);
        last = now;
      }
      if (ratio < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, motion]);
  return <Text style={style} accessibilityLabel={format(value)}>{format(motion ? shown : value)}</Text>;
}
const formatProgress = (progress: number) => `${(progress * 100).toFixed(1)}%`;
const formatCurrent = (value: number) => Math.round(value).toLocaleString('en-IN');

const GRADIENT_BANDS = Array.from({ length: 24 }, (_, index) => blendColor([225,206,250], [231,220,255], 1 - Math.abs(2 * index / 23 - 1)));
function JourneyButton({ motion, onPress }: { motion: boolean; onPress: () => void }) {
  const [width, setWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!motion || width <= 0) { sweep.setValue(0); press.setValue(1); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(5100),
      Animated.timing(sweep, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_MOTION, isInteraction: false }),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: NATIVE_MOTION, isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); press.stopAnimation(); sweep.setValue(0); press.setValue(1); };
  }, [motion, width, sweep, press]);
  const pressTo = (toValue: number) => {
    if (motion) Animated.spring(press, { ...SPRING, toValue }).start();
  };
  return <Animated.View style={{ transform: [{ scale: press }] }}>
    <Pressable accessibilityRole="button" accessibilityLabel="View your full journey"
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      onPressIn={() => pressTo(0.978)} onPressOut={() => pressTo(1)}
      style={({ pressed }) => [styles.journeyLink, pressed && styles.journeyLinkPressed]}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}>
      <View style={styles.journeyTint} pointerEvents="none" />
      <Animated.View pointerEvents="none" accessible={false} style={[styles.gradientBands, {
        opacity: sweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.28, 0.65, 0.28] }),
      }]}>
        {GRADIENT_BANDS.map((backgroundColor, index) => <View key={index} style={{ flex: 1, backgroundColor }} />)}
      </Animated.View>
      {motion && width > 0 ? <Animated.View pointerEvents="none" accessible={false} style={[styles.shimmer, {
        opacity: sweep.interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 0.5, 0.5, 0] }),
        transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-70, width + 70] }) }, { rotate: '18deg' }],
      }]}>
        {[0.08,0.16,0.32,0.16,0.08].map((opacity, index) => <View key={index} style={{ flex: 1, backgroundColor: '#FFFFFF', opacity }} />)}
      </Animated.View> : null}
      <Text style={styles.journeyLinkText}>View your full journey</Text>
      <Animated.View style={[styles.journeyArrow, { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 3.5, 0] }) }] }]}>
        <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
      </Animated.View>
    </Pressable>
  </Animated.View>;
}

export default function RecognitionScreen() {
  const { context } = usePartnerSession();
  const actorId = context?.identity.auth_user_id ?? '';
  return <RecognitionContent key={actorId} actorId={actorId} />;
}

function RecognitionContent({ actorId }: { actorId: string }) {
  const router = useRouter();
  const { visible, motion } = useScreenMotion();
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<PartnerRecognition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => { setLoading(true); setRetry(value => value + 1); }, []);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setError('');
    void getPartnerRecognition().then(result => {
      if (live) setData(result);
    }).catch(() => {
      if (live) { setData(null); setError('Recognition could not be loaded.'); }
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [visible, retry]);
  const celebrating = useNewAchievements(loading ? null : data, actorId, visible);

  const next = data?.next_milestone;
  const progress = next && next.target > 0 ? Math.max(0, Math.min(1, next.current / next.target)) : 0;

  return (
    <PartnerScreen
      title="My Achievements"
      hideTopBar
      navyStatusBar
      bottomNavigationNavy
      bottomNavigation={<PartnerCaseBottomNavigation activeTab="More" />}
    >
      <PartnerCasePageHeader title="My Achievements" icon="ribbon-outline" onBack={() => router.back()} />
      {loading ? (
        <PartnerStateView state="loading" title="Loading recognition" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Recognition is temporarily unavailable" message={error || 'Recognition could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <View style={styles.content}>
          <Entrance motion={motion}><View style={styles.sectionHeading}>
            <Ionicons name="star" size={23} color={PURPLE} />
            <Text style={styles.sectionTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76}>Unlocked achievements</Text>
            <View style={styles.headingRule} />
          </View></Entrance>

          {data.items.length ? (
            <View style={styles.list}>
              {data.items.map((item, index) => (
                <AchievementCard key={item.code} item={item} index={index} motion={motion} celebrate={celebrating.has(item.code)} />
              ))}
            </View>
          ) : (
            <PartnerStateView state="empty" title="More highlights will appear here" message="Recognition appears when a recorded milestone is reached." asset={PartnerAssets.status.achievement} />
          )}

          {next ? (
            <Entrance motion={motion} delay={Math.min(data.items.length, 8) * 100}><View style={styles.nextCard}>
              <Trophy motion={motion} />
              <View style={styles.verticalRule} />
              <View style={styles.nextHeadingText}>
                <Text style={styles.nextEyebrow}>NEXT MILESTONE</Text>
                <Text style={styles.nextTitle}>{next.title}</Text>
                <Text style={styles.supportingText}>{"Keep going, you\'re on track!"}</Text>
              </View>
              <View style={styles.percentGroup}>
                <View style={styles.percentCircle} accessibilityRole="progressbar" accessibilityLabel={next.title}
                  accessibilityValue={{ min: 0, max: Math.max(0, next.target), now: Math.max(0, Math.min(next.current, Math.max(0, next.target))) }}>
                  <ProgressRing progress={progress} motion={motion} />
                  <AnimatedMetric value={progress} format={formatProgress} style={styles.percentText} motion={motion} />
                </View>
                <View style={styles.customersRow}>
                  <Ionicons name="people" size={15} color={PURPLE} />
                  <AnimatedMetric value={next.current} format={formatCurrent} style={styles.currentNumber} motion={motion} />
                </View>
              </View>
            </View></Entrance>
          ) : null}

          <Entrance motion={motion} delay={Math.min(data.items.length + 1, 8) * 100}>
            <JourneyButton motion={motion} onPress={() => router.push('/journey')} />
          </Entrance>
        </View>
      )}
    </PartnerScreen>
  );
}

function milestoneArtwork(icon: RecognitionItem['icon'], title: string): ImageSourcePropType {
  if (icon === 'learn') return require('../assets/partner/status/learning-rhythm-3d.png');
  if (icon === 'renewal') return PartnerAssets.actions.renewalsReference;
  if (/claim/i.test(title)) return PartnerAssets.actions.quickClaims;
  return PartnerAssets.status.journey;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 18, gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 29 },
  sectionTitle: { color: INK, fontWeight: '800', fontSize: 17, letterSpacing: -0.35 },
  headingRule: { flex: 1, height: 2, backgroundColor: '#8D50D9', marginLeft: 4 },
  list: { gap: 9 },
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 88, paddingHorizontal: 11, paddingVertical: 9, gap: 9, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4DDFC', shadowColor: '#5433B6', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  artworkTile: { width: 55, height: 59, borderRadius: 17, flexShrink: 0, backgroundColor: '#F1EAFE', alignItems: 'center', justifyContent: 'center' },
  achievementArtwork: { width: 51, height: 51 },
  verticalRule: { width: 1, height: 55, backgroundColor: '#CDB5F4' },
  achievementHeading: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: INK },
  supportingText: { color: '#56608F', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  achievementMeta: { flexShrink: 0, alignItems: 'flex-end', gap: 8 },
  earnedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDE2FF', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 6 },
  earnedPillText: { fontSize: 8, fontWeight: '800', color: '#4E1AC1' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  date: { color: '#435078', fontSize: 9, fontWeight: '600' },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 100, paddingHorizontal: 11, paddingVertical: 11, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4DDFC', shadowColor: '#5433B6', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  nextHeadingText: { flex: 1, minWidth: 0, gap: 4 },
  nextEyebrow: { color: PURPLE, fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },
  nextTitle: { color: INK, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  percentGroup: { width: 69, flexShrink: 0, alignItems: 'center', gap: 4 },
  percentCircle: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  progressSegment: { position: 'absolute', width: 3.7, height: 2.1, borderRadius: 3 },
  ringBase: { position: 'absolute', top: 3.45, left: 3.45, width: 43.1, height: 43.1, borderRadius: 22, borderWidth: 2.1, borderColor: '#DED1FB' },
  percentText: { color: '#241478', fontSize: 11, fontWeight: '800' },
  customersRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currentNumber: { color: INK, fontSize: 13, fontWeight: '800' },
  journeyLink: { marginTop: 3, minHeight: 49, paddingHorizontal: 12, borderRadius: 30, backgroundColor: '#E1CEFA', overflow: 'hidden', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 13 },
  journeyTint: { position: 'absolute', left: '15%', right: '15%', top: 0, bottom: 0, backgroundColor: '#E7DCFF', opacity: 0.65, borderRadius: 40 },
  journeyLinkPressed: { opacity: 0.75 },
  journeyLinkText: { color: '#541BC7', fontSize: 14, fontWeight: '800' },
  journeyArrow: { width: 31, height: 31, borderRadius: 16, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  cardGlow: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderRadius: 20, borderColor: '#B99AF0' },
  iconShineClip: { ...StyleSheet.absoluteFillObject, borderRadius: 17, overflow: 'hidden' },
  iconShine: { position: 'absolute', top: -12, bottom: -12, width: 12, backgroundColor: '#FFFFFF' },
  particleOrigin: { position: 'absolute', top: 29, left: 27, width: 0, height: 0, zIndex: 3 },
  particle: { position: 'absolute', width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
  confettiPiece: { width: 4, height: 6, borderRadius: 1, backgroundColor: '#E4AA32' },
  confettiLavender: { backgroundColor: '#B79AF0' },
  trophyGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 17, backgroundColor: '#CDB5F4' },
  gradientBands: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  shimmer: { position: 'absolute', top: -18, bottom: -18, width: 60, left: 0, flexDirection: 'row' },
});
