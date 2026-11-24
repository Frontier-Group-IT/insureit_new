import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPartnerStories, type PartnerStory, type PartnerStoriesData } from '@/lib/stories';
import { formatIndianCurrency } from '@/lib/format';
import { ImpactCounter, reveal, useImpactTimeline, type ImpactTimeline } from '@/components/impact-story-motion';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';

const STORY_DURATION_MS = 10000;
const StoryMotion = createContext<{ enabled: boolean; running: boolean; hold: (held: boolean) => void }>({ enabled: false, running: false, hold: () => undefined });

export default function StoriesScreen() {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reduced, setReduced] = useState(true);
  const [held, setHeldState] = useState(false);
  const heldRef = useRef(false);
  const setHeld = useCallback((value: boolean) => { heldRef.current = value; setHeldState(value); }, []);
  const [trackWidth, setTrackWidth] = useState(0);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const direction = useRef(1);
  const transition = useRef(new Animated.Value(1)).current;
  const closeMotion = useRef(new Animated.Value(1)).current;
  const closePress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const elapsed = useRef(0);
  const generation = useRef(0);
  const touchAt = useRef(0);
  const moved = useRef(false);
  const navAt = useRef(0);
  const active = focused && foreground && !closing;
  const motion = active && !reduced;
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setHeld(false); }; }, [setHeld]));
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); }).catch(() => {});
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state !== 'active') setHeld(false); });
    return () => { alive = false; preference.remove(); app.remove(); if (closeTimer.current) clearTimeout(closeTimer.current); closeMotion.stopAnimation(); closePress.stopAnimation(); };
  }, [closeMotion, closePress, setHeld]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ start?: string }>();
  const [data, setData] = useState<PartnerStoriesData | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigationTouch = useRef<{ x: number; y: number } | null>(null);
  const [storyViewportHeight, setStoryViewportHeight] = useState(0);
  const [storyMeasuredHeight, setStoryMeasuredHeight] = useState(0);
  const [artworkReduction, setArtworkReduction] = useState(0);
  // Reduce only the artwork's reserved space when a story exceeds the available
  // area between the fixed header and the permission-aware bottom tabs.
  // Leave a legible illustration and allow native scrolling on very small screens.
  const artworkHeight = Math.max(96, 300 - artworkReduction);
  const journeyArtworkHeight = Math.max(100, 304 - artworkReduction);
  // A Story should behave as a fixed-screen slide, not a continuously
  // scrollable page. Only allow scrolling if the original artwork has already
  // been reduced to its safe minimum and the content still cannot fit (e.g.
  // a small device or enlarged accessibility text).
  const storyScrollEnabled = storyViewportHeight > 0
    && storyMeasuredHeight > storyViewportHeight + 2
    && artworkReduction >= 204;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getPartnerStories();
      setData(result);
      const start = typeof params.start === 'string' ? params.start : '';
      const startIndex = result.items.findIndex((item) => item.kind === start);
      generation.current += 1;
      elapsed.current = 0;
      progressValue.setValue(0);
      setIndex(startIndex >= 0 ? startIndex : 0);
    } catch {
      setError('Your INSUREIT Stories could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.start, progressValue]);

  useEffect(() => {
    void load();
  }, [load]);

  const story = data?.items[index] || null;
  const impactClock = useImpactTimeline(active && !loading && !error && story?.kind === 'impact', held);
  const learnClock = useImpactTimeline(active && !loading && !error && story?.kind === 'learn', held);

  useEffect(() => {
    setArtworkReduction(0);
    setStoryMeasuredHeight(0);
  }, [index, windowHeight, windowWidth]);

  useEffect(() => {
    if (storyViewportHeight <= 0 || storyMeasuredHeight <= storyViewportHeight + 1) return;
    const remainingReduction = 204 - artworkReduction;
    if (remainingReduction <= 0) return;
    const overflow = Math.ceil(storyMeasuredHeight - storyViewportHeight);
    setArtworkReduction(current => Math.min(204, current + Math.min(overflow, 204 - current)));
  }, [storyViewportHeight, storyMeasuredHeight, artworkReduction]);

  const closeStory = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    if (reduced || !foreground) { router.back(); return; }
    Animated.timing(closeMotion, { toValue: 0, duration: 140, useNativeDriver: true }).start();
    closeTimer.current = setTimeout(() => router.back(), 140);
  }, [closeMotion, foreground, reduced, router]);

  const navigate = useCallback((step: number, intentional = true) => {
    if (!data || closingRef.current || !active) return;
    const now = Date.now();
    if (now - navAt.current < 280) return;
    if (step < 0 && index <= 0) return;
    navAt.current = now;
    if (intentional) void Haptics.selectionAsync().catch(() => {});
    if (step > 0 && index >= data.items.length - 1) { closeStory(); return; }
    direction.current = step;
    generation.current += 1;
    elapsed.current = 0;
    progressValue.setValue(0);
    transition.setValue(motion ? 0 : 1);
    setIndex(value => value + step);
  }, [active, closeStory, data, index, motion, progressValue, transition]);
  const next = () => navigate(1);
  const previous = () => navigate(-1);

  useEffect(() => {
    if (!motion) { transition.setValue(1); return; }
    const animation = Animated.timing(transition, { toValue: 1, duration: 310, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [index, motion, transition]);

  const advanceRef = useRef(navigate);
  useEffect(() => { advanceRef.current = navigate; }, [navigate]);
  useEffect(() => {
    if (!story || loading || error || !active || held || reduced) return;
    const epoch = generation.current;
    const initial = elapsed.current;
    const remaining = Math.max(0, STORY_DURATION_MS - initial);
    const started = Date.now();
    let valid = true;
    progressValue.setValue(initial / STORY_DURATION_MS);
    const animation = Animated.timing(progressValue, { toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: true, isInteraction: false });
    animation.start();
    const timer = setTimeout(() => { if (valid && generation.current === epoch && !heldRef.current && AppState.currentState === 'active' && !closingRef.current) advanceRef.current(1, false); }, remaining);
    return () => {
      valid = false;
      clearTimeout(timer);
      animation.stop();
      if (generation.current === epoch) elapsed.current = Math.min(STORY_DURATION_MS, initial + Date.now() - started);
    };
  }, [story, index, loading, error, active, held, reduced, progressValue]);

  const ambient = useStoryLoop(motion && !held, 4200);
  const progress = data?.items ?? [];
  // Observe taps without claiming the ScrollView's responder: vertical drags still scroll.
  // Interactive story links stop propagation so opening a route never also advances the story.
  function handleStoryTouchStart(event: { nativeEvent: { pageX: number; pageY: number; touches: readonly unknown[] } }) {
    if (event.nativeEvent.touches.length !== 1) {
      setHeld(false);
      navigationTouch.current = null;
      return;
    }
    moved.current = false;
    touchAt.current = Date.now();
    setHeld(true);
    navigationTouch.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
  }

  function handleStoryTouchMove(event: { nativeEvent: { pageX: number; pageY: number } }) {
    const start = navigationTouch.current;
    if (start && (Math.abs(start.x - event.nativeEvent.pageX) > 12 || Math.abs(start.y - event.nativeEvent.pageY) > 12)) moved.current = true;
  }

  function handleStoryTouchEnd(event: { nativeEvent: { pageX: number; pageY: number } }) {
    const start = navigationTouch.current;
    navigationTouch.current = null;
    setHeld(false);
    if (!start) return;
    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) { navigate(dx < 0 ? 1 : -1); return; }
    if (moved.current || Date.now() - touchAt.current >= 280 || Math.abs(dx) > 12 || Math.abs(dy) > 12) return;
    if (event.nativeEvent.pageX < windowWidth / 2) previous();
    else next();
  }

  function openStory() {
    if (!story?.route) return;
    closingRef.current = true;
    setClosing(true);
    router.replace(story.route as never);
  }

  return (
    <StoryMotion.Provider value={{ enabled: motion, running: motion && !held, hold: setHeld }}><Animated.View style={[styles.screen, { opacity: closeMotion, transform: [{ scale: closeMotion.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] }]}>
      <StatusBar style="light" backgroundColor="#092B62" />
      <View style={[styles.top, { paddingTop: insets.top + 11 }]}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>I</Text></View>
            <View style={styles.brandDivider} />
            <View>
              <Text style={styles.brandTitle}>INSUREIT STORIES</Text>
              <Text style={styles.brandMeta}>Your business, in moments</Text>
            </View>
          </View>
          <Pressable onPress={closeStory} onPressIn={() => { if (motion) Animated.spring(closePress, { toValue: 1, useNativeDriver: true }).start(); }} onPressOut={() => { if (motion) Animated.spring(closePress, { toValue: 0, useNativeDriver: true }).start(); }} style={styles.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close INSUREIT Stories">
            <Animated.View style={{ transform: [{ scale: closePress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }, { rotate: closePress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "12deg"] }) }] }}><Ionicons name="close" size={24} color="#FFFFFF" /></Animated.View>
          </Pressable>
        </View>
        <View style={styles.progress} accessibilityLabel={'Story ' + (index + 1) + ' of ' + (data?.items.length || 5)}>
          {progress.map((_, itemIndex) => (
            <View key={itemIndex} style={styles.progressTrack} onLayout={event => { if (itemIndex === 0) setTrackWidth(event.nativeEvent.layout.width); }}>
              <Animated.View style={[styles.progressFill, { width: itemIndex <= index ? '100%' : '0%', transform: [{ translateX: itemIndex === index && !reduced ? progressValue.interpolate({ inputRange: [0, 1], outputRange: [-trackWidth, 0] }) : 0 }] }]} />
            </View>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.storyLoadingArea} accessibilityRole="progressbar" accessibilityLabel="Loading INSUREIT Stories">
          <View style={styles.storySkeleton}>
            <View style={styles.storySkeletonIcon} />
            <View style={styles.storySkeletonEyebrow} />
            <View style={styles.storySkeletonTitle} />
            <View style={styles.storySkeletonLine} />
            <View style={styles.storySkeletonLineShort} />
          </View>
          <View style={styles.storySkeletonSecondary}>
            <View style={styles.storySkeletonArtwork} />
            <View style={styles.storySkeletonLine} />
            <View style={styles.storySkeletonLineShort} />
          </View>
        </View>
      ) : error || !story ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'No Story is available.'}</Text>
          <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            key={index}
            style={styles.scroll}
            scrollEnabled={storyScrollEnabled}
            bounces={storyScrollEnabled}
            alwaysBounceVertical={false}
            onLayout={(event) => setStoryViewportHeight(event.nativeEvent.layout.height)}
            onContentSizeChange={(_width, height) => setStoryMeasuredHeight(height)}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 12 }]}
            showsVerticalScrollIndicator={false}
            accessibilityLabel="Story content. Tap left for previous, right for next."
            accessibilityActions={[{ name: 'decrement', label: 'Previous story' }, { name: 'increment', label: 'Next story' }]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === 'decrement') previous();
              if (nativeEvent.actionName === 'increment') next();
            }}
            onTouchStart={handleStoryTouchStart}
            onTouchMove={handleStoryTouchMove}
            onTouchEnd={handleStoryTouchEnd}
            onTouchCancel={() => { navigationTouch.current = null; setHeld(false); }}
            onScrollBeginDrag={() => { navigationTouch.current = null; setHeld(false); }}
          >
            <View pointerEvents="none" style={styles.storyBackdrop}>
              <Animated.View style={[styles.waveUpper, { transform: [{ rotate: '-9deg' }, { translateX: ambient.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }] }]} />
              <Animated.View style={[styles.waveMiddle, { transform: [{ rotate: '-10deg' }, { translateX: ambient.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }]} />
              <Animated.View style={[styles.waveLower, { transform: [{ rotate: '-11deg' }, { translateY: ambient.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] }]} />
            </View>
            <Animated.View style={[styles.storyContent, { opacity: transition.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), transform: [{ perspective: 900 }, { translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [direction.current * 34, 0] }) }, { rotateY: transition.interpolate({ inputRange: [0, 1], outputRange: [direction.current * -3 + 'deg', '0deg'] }) }, { scale: transition.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }] }]}>
              {story.kind === 'today' ? (
                <TodayRenewalStory story={story} onOpen={openStory} artworkHeight={artworkHeight} />
              ) : story.kind === 'business' ? (
                <BusinessMonthStory story={story} onOpen={openStory} artworkHeight={artworkHeight} />
              ) : story.kind === 'journey' ? (
                <JourneyMilestoneStory story={story} artworkHeight={journeyArtworkHeight} />
              ) : story.kind === 'impact' ? (
                <ImpactStory story={story} onOpen={openStory} artworkHeight={artworkHeight} clock={impactClock} onPause={setHeld} />
              ) : story.kind === 'learn' ? (
                <LearnStory story={story} onOpen={openStory} artworkHeight={artworkHeight} clock={learnClock} />
              ) : (
              <>
              <View style={styles.lessonBadge}>
                <Ionicons name={story.kind === 'learn' ? 'time-outline' : storyIcon(story.kind)} size={20} color="#0757C8" />
                <Text numberOfLines={1} style={styles.lessonBadgeText}>{story.eyebrow}</Text>
              </View>
              <Pressable
                onPress={openStory}
                onTouchStart={(event) => { navigationTouch.current = null; setHeld(true); event.stopPropagation(); }}
                onTouchEnd={(event) => { setHeld(false); event.stopPropagation(); }} onTouchCancel={() => setHeld(false)}
                disabled={!story.route}
                accessibilityRole={story.route ? 'link' : undefined}
                accessibilityLabel={story.route ? 'Open ' + story.title : undefined}
                style={({ pressed }) => [styles.storyTextLink, pressed && story.route ? styles.storyTextPressed : null]}
              >
                {story.metric !== undefined ? (
                  <Text style={styles.metric} adjustsFontSizeToFit numberOfLines={2}>{formatMetric(story)}</Text>
                ) : null}
                <Text style={styles.title} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.75}>{story.title}</Text>
              </Pressable>
              <View style={styles.titleRule}><View style={styles.titleRuleActive} /></View>
              <Text style={styles.body}>{highlightStoryText(story.body)}</Text>
              {story.progress_current !== undefined && story.progress_target ? (
                <View style={styles.storyProgressWrap}>
                  <View style={styles.storyProgressTrack}>
                    <View style={[styles.storyProgressFill, { width: (Math.min(100, Math.max(0, (story.progress_current / story.progress_target) * 100))) + '%' as `${number}%` }]} />
                  </View>
                  <View style={styles.storyProgressMeta}>
                    <Text style={styles.storyProgressText}>{story.progress_current}</Text>
                    <Text style={styles.storyProgressText}>{story.progress_target}</Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.illustrationWrap} pointerEvents="none">
                <StoryIllustration kind={story.kind} body={story.body} />
              </View>
              {story.kind === 'learn' && story.answered_today ? (
                <View style={styles.completedPill}>
                  <Ionicons name="checkmark-circle" size={23} color="#079064" />
                  <Text style={styles.completedText}>Completed today</Text>
                </View>
              ) : null}
              </>
              )}
            </Animated.View>
          </ScrollView>
        </>
      )}
      <View style={[styles.bottomNavigationShell, { paddingBottom: insets.bottom }]}>
        <PartnerCaseBottomNavigation activeTab="Home" />
      </View>
    </Animated.View></StoryMotion.Provider>
  );
}

function useStoryLoop(enabled: boolean, duration: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) { value.stopAnimation(); value.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [enabled, duration, value]);
  return value;
}

function MotionArtwork(props: React.ComponentProps<typeof Image>) {
  const { running } = useContext(StoryMotion);
  const float = useStoryLoop(running, 2800);
  return <Animated.Image {...props} style={[props.style, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }, { scale: float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) }, { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '0.6deg'] }) }] }]} />;
}

function MotionCount({ value, currency = false }: { value: number | string; currency?: boolean }) {
  const { enabled } = useContext(StoryMotion);
  const target = Number(String(value).replace(/,/g, ''));
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (!enabled || !Number.isFinite(target)) { setShown(target); return; }
    const start = Date.now();
    let frame = 0;
    const tick = () => { const t = Math.min(1, (Date.now() - start) / 650); setShown(t === 1 ? target : Math.round(target * (1 - Math.pow(1 - t, 3)))); if (t < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, target]);
  if (!Number.isFinite(target) || !enabled) return <>{currency && Number.isFinite(target) ? formatIndianCurrency(target) : value}</>;
  return <>{currency ? formatIndianCurrency(shown) : shown === target ? value : typeof value === 'string' && value.includes(',') ? shown.toLocaleString('en-IN') : shown}</>;
}

function storyIcon(kind: PartnerStory['kind']) {
  if (kind === 'today') return 'sunny-outline' as const;
  if (kind === 'impact') return 'shield-checkmark-outline' as const;
  if (kind === 'journey') return 'people-outline' as const;
  if (kind === 'business') return 'stats-chart-outline' as const;
  return 'document-text-outline' as const;
}

function formatMetric(story: PartnerStory) {
  const value = Number(story.metric || 0);
  if (story.metric_label?.toLowerCase().includes('idv') || story.metric_label?.toLowerCase().includes('premium')) return formatIndianCurrency(value);
  return String(story.metric);
}


const storyColors = {
  navy: '#092B5B',
  blue: '#086FE8',
  pale: '#EDF6FF',
  green: '#119C69',
  violet: '#7448D8',
  gold: '#F4AF18',
} as const;

/** Shared design system for all five illustrated stories. */
function StoryHeading({ icon, title, tone = 'blue' }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tone?: 'blue' | 'gold' | 'violet' | 'green';
}) {
  const { running } = useContext(StoryMotion);
  const sun = useStoryLoop(running && tone === 'gold', 3800);
  return (
    <View style={[styles.unifiedHeading, tone === 'gold' && styles.unifiedHeadingGold, tone === 'violet' && styles.unifiedHeadingViolet, tone === 'green' && styles.unifiedHeadingGreen]}>
      <Animated.View style={{ transform: [{ rotate: sun.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "18deg"] }) }] }}><Ionicons name={icon} size={19} color={tone === 'gold' ? '#B06900' : tone === 'violet' ? '#7544CD' : tone === 'green' ? '#087A57' : storyColors.blue} /></Animated.View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.unifiedHeadingText}>{title}</Text>
    </View>
  );
}

function StoryPanel({ children, impact = false }: { children: React.ReactNode; impact?: boolean }) {
  const { enabled } = useContext(StoryMotion);
  const entrance = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!enabled) { entrance.setValue(1); return; }
    entrance.setValue(0);
    const animation = Animated.spring(entrance, { toValue: 1, speed: 18, bounciness: 3, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [enabled, entrance]);
  return <Animated.View style={[styles.unifiedPanel, impact && styles.impactPanel, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }]}>{children}</Animated.View>;
}

function ImpactStory({ story, onOpen, artworkHeight, clock, onPause }: { story: PartnerStory; onOpen: () => void; artworkHeight: number; clock: ImpactTimeline; onPause: (paused: boolean) => void }) {
  const vehicleMatch = story.title.match(/([\d,]+)\s+(vehicles?)(.*)/i);
  const customerMatch = story.body.match(/([\d,]+)\s+customers?\s+served/i);
  const claimMatch = story.body.match(/([\d,]+)\s+claims?\s+assisted/i);
  const hasRoute = Boolean(story.route);
  const metric = Number(story.metric);
  const formatMoney = (value: number) => formatIndianCurrency(Math.round(value * (Number.isInteger(metric) ? 1 : 100)) / (Number.isInteger(metric) ? 1 : 100));
  const count = (value: number) => String(Math.round(value));
  const accent = clock.time.interpolate({ inputRange: [0, 300, 1100, 1600], outputRange: [0, 0.45, 0.15, 0], extrapolate: 'clamp' });
  const glow = clock.ambient.interpolate({inputRange:[0,1],outputRange:[0,0.22]});
  return (
    <View style={styles.unifiedStory}>
      <Animated.View style={[{ alignItems: 'center', maxWidth: '100%' }, reveal(clock, 0, 300, 4, 0.96)]}>
        {clock.enabled ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: 25, backgroundColor: '#9ACBFF', opacity: glow, transform: [{scale:1.04}] }]} /> : null}
        <StoryHeading icon="shield-checkmark-outline" title={story.eyebrow} />
      </Animated.View>
      <Animated.View style={[{ width: '100%' }, reveal(clock, 0, 200, 5)]}><StoryPanel impact>
        {clock.enabled ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, {borderRadius:21,borderWidth:2,borderColor:'#81BEFF',opacity:accent}]} /> : null}
        <Pressable
          onPress={onOpen}
          disabled={!hasRoute}
          onTouchStart={(event) => { onPause(true); event.stopPropagation(); }}
          onTouchEnd={(event) => { onPause(false); event.stopPropagation(); }}
          onTouchCancel={() => onPause(false)}
          accessibilityRole={hasRoute ? 'link' : undefined}
          accessibilityLabel={hasRoute ? 'Open ' + story.title : undefined}
          style={styles.impactLink}
        >
          {story.metric !== undefined ? (
            <>
              <ImpactCounter clock={clock} value={Number.isFinite(metric) ? metric : 0} start={200} duration={1400} format={formatMoney} style={[styles.impactPremium, {fontVariant:['tabular-nums']}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.43} />
              <Text style={styles.impactCaption}>{story.metric_label?.trim() || 'Coverage value'}</Text>
            </>
          ) : null}
          {vehicleMatch ? (
            <Animated.View style={[styles.impactVehicleRow, reveal(clock, 500, 800)]}>
              <Ionicons name="car-sport-outline" size={27} color={storyColors.blue} />
              <View style={styles.impactVehicleCopy}>
                <ImpactCounter clock={clock} value={Number(vehicleMatch[1].replace(/,/g, ''))} start={500} duration={650} format={count} style={styles.impactVehicleNumber} />
                <Text style={styles.impactVehicleLabel}>{vehicleMatch[2] + vehicleMatch[3]}</Text>
              </View>
            </Animated.View>
          ) : <Text style={styles.impactFallback}>{story.title}</Text>}
        </Pressable>
        {customerMatch || claimMatch ? (
          <View style={styles.impactSmallGrid}>
            {customerMatch ? (
              <Animated.View style={[styles.impactSmallTile, reveal(clock, 800, 1100)]}>
                <Ionicons name="people" size={24} color={storyColors.blue} />
                <ImpactCounter clock={clock} value={Number(customerMatch[1].replace(/,/g, ''))} start={800} duration={650} format={count} style={styles.impactSmallValue} />
                <Text style={styles.impactSmallLabel}>Customers served</Text>
              </Animated.View>
            ) : null}
            {claimMatch ? (
              <Animated.View style={[styles.impactSmallTile, reveal(clock, 800, 1100)]}>
                <Ionicons name="checkbox-outline" size={24} color={storyColors.blue} />
                <ImpactCounter clock={clock} value={Number(claimMatch[1].replace(/,/g, ''))} start={800} duration={650} format={count} style={styles.impactSmallValue} />
                <Text style={styles.impactSmallLabel}>Claims assisted</Text>
              </Animated.View>
            ) : null}
          </View>
        ) : <Text style={styles.impactFallback}>{story.body}</Text>}
      </StoryPanel></Animated.View>
      <View pointerEvents="none" style={[styles.unifiedArtworkBox, { height: artworkHeight }]}>
        <Animated.View style={[{width:'100%',height:artworkHeight,alignItems:'center',justifyContent:'center'}, reveal(clock, 1200, 1600, 8)]}>
          {clock.enabled ? <Animated.View style={{position:'absolute',bottom:4,width:'60%',height:12,borderRadius:20,backgroundColor:'#6FA8DF',opacity:clock.ambient.interpolate({inputRange:[0,1],outputRange:[0.12,0.06]}),transform:[{scaleX:clock.ambient.interpolate({inputRange:[0,1],outputRange:[1,0.96]})}]}} /> : null}
          <Animated.View style={[{width:'100%',height:artworkHeight,alignItems:'center'}, clock.enabled && {transform:[{translateY:clock.ambient.interpolate({inputRange:[0,1],outputRange:[0,-8]})},{scale:clock.ambient.interpolate({inputRange:[0,1],outputRange:[1,1.015]})},{rotate:clock.ambient.interpolate({inputRange:[0,1],outputRange:['0deg','0.35deg']})}]}]}>
            <Image source={require('../assets/partner/stories/your-impact.png')} resizeMode="contain" style={[styles.storyHeroArtwork, { height: artworkHeight }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            {clock.enabled ? <Animated.View pointerEvents="none" style={{position:'absolute',top:'18%',left:'46%',width:22,height:22,borderRadius:11,backgroundColor:'#FFE6A1',opacity:clock.time.interpolate({inputRange:[2000,2250,2500],outputRange:[0,0.32,0],extrapolate:'clamp'}),transform:[{translateX:clock.time.interpolate({inputRange:[2000,2500],outputRange:[-24,24],extrapolate:'clamp'})}]}} /> : null}
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}


/**
 * Animated 60 SEC LEARN story. The original learning-car.png is a flattened
 * artwork containing the car, registration plate and gold attention marks.
 * Animate that one image as a unit; do not pretend any part is OCR-verified.
 *
 * The shared timeline pauses for story holds/background and resets on exit.
 * Static JSX is legible immediately when Reduce Motion is enabled.
 */
function LearnStory({ story, onOpen, artworkHeight, clock }: {
  story: PartnerStory; onOpen: () => void; artworkHeight: number; clock: ImpactTimeline;
}) {
  const { hold } = useContext(StoryMotion);
  const hasRoute = Boolean(story.route);
  const entrance = clock.time.interpolate({ inputRange: [700, 1400], outputRange: [0, 1], extrapolate: 'clamp' });
  const shadowReveal = clock.time.interpolate({ inputRange: [1000, 1800], outputRange: [0, 0.17], extrapolate: 'clamp' });
  const ambient = clock.ambient.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const pulse = clock.ambient.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const iconTick = clock.time.interpolate({ inputRange: [0, 120, 230, 370], outputRange: ['0deg', '0deg', '7deg', '0deg'], extrapolate: 'clamp' });
  const badgeGlow = clock.ambient.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] });
  const underline = clock.time.interpolate({ inputRange: [200, 900], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.unifiedStory}>
      <Animated.View style={[{ maxWidth: '96%', alignItems: 'center' }, reveal(clock, 0, 300, 5, 0.96)]}>
        {clock.enabled ? <Animated.View pointerEvents="none" style={[styles.learnBadgeGlow, { opacity: badgeGlow }]} /> : null}
        <View style={[styles.unifiedHeading, styles.unifiedHeadingGreen]}>
          <Animated.View style={clock.enabled ? { transform: [{ rotate: iconTick }] } : undefined}>
            <Ionicons name="time-outline" size={19} color="#087A57" />
          </Animated.View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.unifiedHeadingText}>{story.eyebrow}</Text>
        </View>
      </Animated.View>
      <StoryPanel>
        <Pressable
          onPress={onOpen}
          disabled={!hasRoute}
          onTouchStart={(event) => { hold(true); event.stopPropagation(); }}
          onTouchEnd={(event) => { hold(false); event.stopPropagation(); }}
          onTouchCancel={() => hold(false)}
          accessibilityRole={hasRoute ? 'link' : undefined}
          accessibilityLabel={hasRoute ? 'Open ' + story.title : undefined}
          style={({ pressed }) => [styles.learnStoryLink, pressed && hasRoute ? styles.storyTextPressed : null]}
        >
          <Animated.View style={[{ alignSelf: 'stretch', alignItems: 'center' }, reveal(clock, 200, 550, 7, 0.98)]}>
            <Text style={styles.learnStoryTitle} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.78}>{story.title}</Text>
            <View style={styles.titleRule}>
              <Animated.View style={[styles.titleRuleActive, clock.enabled ? { transform: [{ scaleX: underline }] } : null]} />
            </View>
          </Animated.View>
          <Animated.View style={[{ width: '100%' }, reveal(clock, 400, 780, 5)]}>
            <Text style={styles.learnStoryQuestion}>{highlightStoryText(story.body)}</Text>
          </Animated.View>
        </Pressable>
      </StoryPanel>
      <View pointerEvents="none" style={[styles.unifiedArtworkBox, { height: artworkHeight }]}>
        {clock.enabled ? <Animated.View style={[styles.learnArtShadow, {
          opacity: shadowReveal,
          transform: [{ scaleX: pulse }],
        }]} /> : null}
        <Animated.View style={[{ width: '100%', height: artworkHeight, alignItems: 'center', justifyContent: 'center' },
          clock.enabled ? {
            opacity: entrance,
            transform: [
              { translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
              { translateY: Animated.add(entrance.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }), ambient) },
              { scale: Animated.multiply(entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }), pulse) },
              { rotate: clock.ambient.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '0.3deg'] }) },
            ],
          } : null
        ]}>
          <StoryIllustration kind={story.kind} body={story.body} artworkHeight={artworkHeight} />
        </Animated.View>
      </View>
      {story.answered_today ? (
        <View style={styles.completedPill}>
          <Ionicons name="checkmark-circle" size={23} color="#079064" />
          <Text style={styles.completedText}>Completed today</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Story 3/5: customer journey milestone. Use only verified, scoped story
 * progress fields so counts, target and completion stay live and consistent.
 * The shared curved background, story header, progress dashes and invisible
 * tap navigation remain owned by StoriesScreen.
 */
function JourneyMilestoneStory({ story, artworkHeight }: { story: PartnerStory; artworkHeight: number }) {
  const current = Number(story.progress_current);
  const target = Number(story.progress_target);
  const hasMilestone = Number.isFinite(current) && current >= 0 &&
    Number.isFinite(target) && target > 0;
  const achieved = hasMilestone ? current : 0;
  const remaining = hasMilestone ? Math.max(0, target - current) : 0;
  const completion = hasMilestone ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
  const formatCount = (value: number) => Math.round(value).toLocaleString('en-IN');

  return (
    <View style={styles.journeyStory}>
      <View pointerEvents="none" style={styles.journeyBlueArc} />
      <StoryHeading icon="people" title={story.eyebrow} tone="violet" />
      <Text style={styles.journeySubtitle}>Your milestone progress at a glance.</Text>

      {hasMilestone ? (
        <>
          <View style={styles.journeyMetricPanel}>
          <View style={styles.journeyStats}>
            <View style={styles.journeyStat}>
              <View style={[styles.journeyStatIcon, styles.journeyStatIconBlue]}>
                <Ionicons name="people" size={25} color="#146DD5" />
              </View>
              <Text style={styles.journeyStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}><MotionCount value={formatCount(current)} /></Text>
              <Text style={styles.journeyStatLabel}>Customers achieved</Text>
            </View>
            <View style={styles.journeyStatDivider} />
            <View style={styles.journeyStat}>
              <View style={[styles.journeyStatIcon, styles.journeyStatIconViolet]}>
                <Ionicons name="locate" size={25} color="#8B45DB" />
              </View>
              <Text style={styles.journeyStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}><MotionCount value={formatCount(remaining)} /></Text>
              <Text style={styles.journeyStatLabel}>Customers to go</Text>
            </View>
            <View style={styles.journeyStatDivider} />
            <View style={styles.journeyStat}>
              <View style={[styles.journeyStatIcon, styles.journeyStatIconGold]}>
                <Ionicons name="trophy" size={25} color="#E7A408" />
              </View>
              <Text style={styles.journeyStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}><MotionCount value={formatCount(target)} /></Text>
              <Text style={styles.journeyStatLabel}>Customer milestone</Text>
            </View>
          </View>

          <View style={styles.journeyProgressBlock} accessibilityLabel={`Milestone ${Math.round(completion)} percent complete, ${formatCount(remaining)} customers remaining`}>
            <View style={styles.journeyProgressTop}>
              <Text style={styles.journeyProgressLabel}>Milestone completion</Text>
              <View style={styles.journeyProgressPercent}><Text style={styles.journeyProgressPercentText}>{Math.round(completion)}%</Text></View>
            </View>
            <View style={styles.journeyProgressTrack}>
              <View style={[styles.journeyProgressFill, { width: `${completion}%` as `${number}%` }]} />
            </View>
          </View>

          </View>
          <View style={[styles.journeyScene, { height: artworkHeight }]} pointerEvents="none">
            <View style={[styles.journeySceneHalo, { height: Math.min(235, artworkHeight - 20) }]} />
            <MotionArtwork
              source={require('../assets/partner/stories/my-journey.png')}
              style={[styles.storyHeroArtwork, { height: artworkHeight }]}
              resizeMode="contain"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <View style={styles.journeySceneAchieved}>
              <Ionicons name="checkmark-circle" size={16} color="#0FA565" />
              <Text style={styles.journeySceneMarkerText}>{formatCount(achieved)} achieved</Text>
            </View>
            <View style={styles.journeySceneTarget}>
              <Text style={styles.journeySceneMarkerText}>{formatCount(target)} target</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.journeyNoMilestone}>
          <Ionicons name="analytics-outline" size={29} color="#286BC5" />
          <Text style={styles.journeyNoMilestoneText}>Your next customer milestone will appear when progress data is available.</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The fourth (monthly business) story uses a focused financial snapshot instead
 * of the shared narrative slide. Metrics and policy counts stay backend-driven.
 */
function BusinessMonthStory({ story, onOpen, artworkHeight }: { story: PartnerStory; onOpen: () => void; artworkHeight: number }) {
  const { hold } = useContext(StoryMotion);
  const policyMatch = story.title.match(/^([0-9,]+) +(polic(?:y|ies)) *(.*)$/i);
  const premium = story.metric !== undefined ? formatMetric(story) : null;
  const label = story.metric_label?.trim() || 'Gross premium';
  const hasRoute = Boolean(story.route);
  const hasTarget = story.progress_current !== undefined && Boolean(story.progress_target);

  return (
    <View style={styles.businessSnapshot}>
      <StoryHeading icon="stats-chart-outline" title={story.eyebrow} />
      <StoryPanel>
      <Pressable
        onPress={onOpen}
        onTouchStart={(event) => { hold(true); event.stopPropagation(); }}
        onTouchEnd={(event) => { hold(false); event.stopPropagation(); }} onTouchCancel={() => hold(false)}
        disabled={!hasRoute}
        accessibilityRole={hasRoute ? 'link' : undefined}
        accessibilityLabel={hasRoute ? 'Open ' + story.title : undefined}
        style={({ pressed }) => [styles.businessSummaryLink, pressed && hasRoute && styles.storyTextPressed]}
      >
        {premium ? (
          <>
            <Text style={styles.businessPremiumAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.42}>
              <MotionCount value={story.metric ?? 0} currency={Boolean(story.metric_label?.toLowerCase().match(/premium|idv/))} />
            </Text>
            <Text style={styles.businessPremiumCaption}>{label}</Text>
          </>
        ) : <Text style={styles.businessPremiumCaption}>{story.body}</Text>}
        <View style={styles.titleRule}><View style={styles.titleRuleActive} /></View>
        <View style={styles.businessPoliciesCard}>
          <Ionicons name="document-text-outline" size={31} color="#0E6ADD" />
          <View style={styles.businessPolicyText}>
            {policyMatch ? (
              <>
                <Text style={styles.businessPolicyCount}><MotionCount value={policyMatch[1]} /></Text>
                <Text style={styles.businessPolicyLabel}>{policyMatch[2] + (policyMatch[3] ? ' ' + policyMatch[3].trim() : '')}</Text>
              </>
            ) : (
              <Text style={styles.businessPolicyLabel}>{story.title}</Text>
            )}
          </View>
        </View>
      </Pressable>
      {hasTarget ? (
        <View style={styles.storyProgressWrap}>
          <View style={styles.storyProgressTrack}>
            <View style={[styles.storyProgressFill, { width: (Math.min(100, Math.max(0, (Number(story.progress_current) / Number(story.progress_target)) * 100))) + '%' as `${number}%` }]} />
          </View>
          <View style={styles.storyProgressMeta}>
            <Text style={styles.storyProgressText}>{story.progress_current}</Text>
            <Text style={styles.storyProgressText}>{story.progress_target}</Text>
          </View>
        </View>
      ) : null}
      </StoryPanel>
      <View style={[styles.businessIllustrationWrap, { minHeight: artworkHeight }]} pointerEvents="none">
        <StoryIllustration kind="business" body={story.body} artworkHeight={artworkHeight} />
      </View>
    </View>
  );
}

/**
 * Today has a dedicated renewal summary layout. Reuse the exact story title/body
 * from partner_app_stories; a premium is highlighted only when the supplied
 * text contains an actual rupee amount.
 */
function TodayRenewalStory({ story, onOpen, artworkHeight }: { story: PartnerStory; onOpen: () => void; artworkHeight: number }) {
  const { hold, running, enabled } = useContext(StoryMotion);
  const arrow = useStoryLoop(running, 2200);
  const entrance = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!enabled) { entrance.setValue(1); return; }
    entrance.setValue(0);
    const animation = Animated.spring(entrance, { toValue: 1, speed: 18, bounciness: 3, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [enabled, entrance]);
  const premiumMatch = story.body.match(/₹\s*[\d,]+(?:\.\d{1,2})?/);
  const premium = premiumMatch?.[0].replace(/\s+/g, '') ?? null;
  const remainingCopy = premiumMatch
    ? (story.body.slice(0, premiumMatch.index).trim() + ' ' + story.body.slice((premiumMatch.index ?? 0) + premiumMatch[0].length).trim()).trim()
    : story.body;
  const renewalDays = story.title.match(/\b(?:in|within)\s+(\d+)\s+days?\b/i)?.[1] ?? null;
  const hasRoute = Boolean(story.route);
  const isRenewal = /renew|expir|premium due/i.test(story.title + ' ' + story.body);
  const isClaim = !isRenewal && /claim/i.test(story.title + ' ' + story.body);
  const storyCategory = isClaim ? 'CLAIMS UPDATE' : isRenewal ? 'RENEWAL REMINDER' : 'TODAY\'S UPDATE';
  const countTitle = story.title.match(/^([\d,]+)(\s+.*)$/);
  const titleParts = isRenewal ? story.title.match(/^(.*?)(\b(?:in|within)\s+\d+\s+days?)(.*)$/i) : null;

  return (
    <View style={styles.todaySnapshot}>
      <StoryHeading icon="sunny" title={story.eyebrow} tone="gold" />
      <Animated.View style={[styles.todayCard, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }] }]}>
        <View pointerEvents="none" style={styles.todayCornerAccent} />
        <View style={styles.todayHeadlineRow}>
          <Animated.View style={[styles.todaySunIcon, isClaim && styles.todayClaimsIcon, { transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
            <Ionicons name={isClaim ? 'shield-checkmark' : 'sunny-outline'} size={34} color="#FFFFFF" />
          </Animated.View>
          <View style={styles.todayHeadlineText}>
            <Text style={styles.todayEyebrow}>{storyCategory}</Text>
            <Pressable
              onPress={onOpen}
              disabled={!hasRoute}
              onTouchStart={(event) => { hold(true); event.stopPropagation(); }}
              onTouchEnd={(event) => { hold(false); event.stopPropagation(); }} onTouchCancel={() => hold(false)}
              accessibilityRole={hasRoute ? 'link' : undefined}
              accessibilityLabel={hasRoute ? 'Open ' + story.title : undefined}
              style={styles.todayTitleLink}
            >
              <Text style={styles.todayHeadline}>{titleParts ? <>{titleParts[1]}<Text style={styles.todayDaysBadge}>{titleParts[2]}</Text>{titleParts[3]}</> : countTitle ? <><MotionCount value={countTitle[1]} />{countTitle[2]}</> : story.title}</Text>
              {hasRoute ? <Animated.View style={{ transform: [{ translateX: arrow.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) }] }}><Ionicons name="arrow-forward" size={20} color="#0B6DD6" /></Animated.View> : null}
            </Pressable>
          </View>
        </View>
        <View style={styles.todayDivider} />
        <View style={styles.todayPremiumPanel}>
          <View style={styles.todayPremiumIcon}><Ionicons name={isClaim ? 'medkit-outline' : 'calendar-outline'} size={25} color="#0C6EDC" /></View>
          <View style={styles.todayPremiumBody}>
            {premium ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.todayPremiumValue}>{premium}</Text> : null}
            <Text style={styles.todayPremiumDescription}>{remainingCopy}</Text>
          </View>
        </View>
        {story.progress_current !== undefined && story.progress_target ? (
          <View style={styles.storyProgressWrap}>
            <View style={styles.storyProgressTrack}>
              <View style={[styles.storyProgressFill, { width: (Math.min(100, Math.max(0, (story.progress_current / story.progress_target) * 100))) + '%' as `${number}%` }]} />
            </View>
            <View style={styles.storyProgressMeta}>
              <Text style={styles.storyProgressText}>{story.progress_current}</Text>
              <Text style={styles.storyProgressText}>{story.progress_target}</Text>
            </View>
          </View>
        ) : null}
      </Animated.View>
      <View pointerEvents="none" style={[styles.todayArtWrap, { height: artworkHeight }]}>
        {isRenewal ? (
          <MotionArtwork source={require('../assets/partner/stories/today-renewal.png')} resizeMode="contain" style={[styles.storyHeroArtwork, { height: artworkHeight }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        ) : isClaim ? (
          <MotionArtwork source={require('../assets/partner/stories/claims.png')} resizeMode="contain" style={[styles.storyHeroArtwork, { height: artworkHeight }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        ) : (
          <MotionArtwork source={require('../assets/partner/stories/your-impact.png')} resizeMode="contain" style={[styles.storyHeroArtwork, { height: artworkHeight }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        )}
      </View>
    </View>
  );
}

/** Emphasize the educational keywords without changing backend story copy. */
function highlightStoryText(copy: string) {
  return copy.split(/(vehicle number|Motor policy servicing\?)/gi).map((part, index) => (
    /^(vehicle number|Motor policy servicing\?)$/i.test(part)
      ? <Text key={index} style={styles.bodyEmphasis}>{part}</Text>
      : part
  ));
}

/** Native and bundled artwork: no new dependency or hard-coded story data. */

function StoryIllustration({ kind, body, artworkHeight = 300 }: { kind: PartnerStory['kind']; body: string; artworkHeight?: number }) {
  // Keep the same approved 3D car-and-plate artwork on every 60 Sec Learn
  // topic. Lesson title/question stays live and never derives from the image.
  if (kind === 'learn') {
    return (
      <View style={[styles.vehicleScene, { height: artworkHeight }]}>
        <View style={styles.vehicleHalo} />
        <Image
          source={require('../assets/partner/stories/learning-car.png')}
          resizeMode="contain"
          style={[styles.storyHeroArtwork, { height: artworkHeight }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    );
  }
  if (kind === 'business') {
    return (
      <View style={[styles.businessGrowthScene, { height: artworkHeight }]}>
        <View style={styles.businessGrowthHalo} />
        <MotionArtwork source={require('../assets/partner/stories/this-month.png')} resizeMode="contain" style={[styles.businessGrowth3dArtwork, { height: artworkHeight }]} />
      </View>
    );
  }
  return (
    <View style={styles.illustrationScene}>
      <View style={styles.sceneHalo} />
      <View style={[styles.documentSheet, styles.documentSheetBack]} />
      <View style={styles.documentSheet}>
        <View style={styles.documentIcon}><Ionicons name={kind === 'impact' ? 'shield-checkmark' : 'document-text'} size={42} color="#167AF4" /></View>
        {[0, 1, 2].map(i => <View key={i} style={styles.checkRow}><Ionicons name="checkbox" size={23} color="#197CF4" /><View style={[styles.dummyLine, { width: i === 2 ? 80 : 128 }]} /></View>)}
      </View>
      <View style={styles.sceneBadge}><Ionicons name={kind === 'impact' ? 'shield-checkmark' : 'umbrella'} size={44} color="#FFFFFF" /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#EAF3FF' },
  top: { zIndex: 5, backgroundColor: '#0A3478', paddingHorizontal: 18, paddingTop: 11, paddingBottom: 16 },
  bottomNavigationShell: { backgroundColor: '#071E49' },
  progress: { flexDirection: 'row', gap: 6, marginTop: 16 },
  progressTrack: { flex: 1, height: 4, overflow: 'hidden', borderRadius: 999, backgroundColor: '#7D9BC7' },
  progressFill: { width: '0%', height: '100%', backgroundColor: '#FFFFFF', borderRadius: 999 },
  progressFillActive: { width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 },
  brandMark: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#6551EB', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  brandDivider: { width: 1.5, height: 42, backgroundColor: '#BBD4FB', marginHorizontal: 1 },
  brandTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  brandMeta: { marginTop: 3, color: '#DBE8FF', fontSize: 11 },
  close: { width: 42, height: 42, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D5998' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 20, justifyContent: 'flex-start' },
  storyBackdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  waveUpper: { position: 'absolute', top: -205, left: -110, width: '150%', height: 255, borderBottomLeftRadius: 250, borderBottomRightRadius: 145, backgroundColor: '#0A3478', transform: [{ rotate: '-9deg' }] },
  waveMiddle: { position: 'absolute', top: -45, left: -100, width: '160%', height: 200, borderTopLeftRadius: 245, borderTopRightRadius: 180, backgroundColor: '#CFE2FF', opacity: 0.9, transform: [{ rotate: '-10deg' }] },
  waveLower: { position: 'absolute', bottom: -110, right: -130, width: '155%', height: 230, borderTopLeftRadius: 240, borderTopRightRadius: 280, backgroundColor: '#D6E6FF', opacity: 0.88, transform: [{ rotate: '-11deg' }] },
  storyContent: { alignItems: 'center', width: '100%', paddingTop: 3 },

  unifiedStory: { width: '100%', alignItems: 'center', paddingTop: 4, gap: 8 },
  unifiedHeading: { minHeight: 32, maxWidth: '96%', borderRadius: 25, paddingHorizontal: 17, paddingVertical: 4, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F9FF', borderWidth: 1, borderColor: '#DCEAFF', shadowColor: '#185AAB', shadowOpacity: 0.12, shadowRadius: 7, elevation: 2 },
  unifiedHeadingGold: { backgroundColor: '#FFF8E9', borderColor: '#FFE4A8' },
  unifiedHeadingViolet: { backgroundColor: '#F6EEFF', borderColor: '#DCD0FF' },
  unifiedHeadingGreen: { backgroundColor: '#EBFFF7', borderColor: '#C7F0DD' },
  unifiedHeadingText: { color: '#12386E', fontSize: 13, fontWeight: '800', letterSpacing: 0.45, textTransform: 'uppercase', flexShrink: 1 },
  unifiedPanel: { width: '100%', padding: 8, borderRadius: 23, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF7', shadowColor: '#0E579C', shadowOpacity: 0.09, shadowRadius: 12, elevation: 2 },
  impactPanel: { borderWidth: 2, borderColor: '#3687E8' },
  unifiedArtworkBox: { width: '100%', height: 300, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  storyHeroArtwork: { width: '100%', height: 300, maxWidth: 360 },
  todayFallbackArt: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  unifiedArtHalo: { position: 'absolute', width: 275, height: 240, borderRadius: 150, backgroundColor: '#DCEBFF' },
  impactLink: { alignSelf: 'stretch', alignItems: 'center' },
  impactPremium: { color: '#092B5B', fontSize: 25, lineHeight: 32, fontWeight: '800', textAlign: 'center', width: '100%' },
  impactCaption: { marginTop: 1, color: '#486389', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  impactVehicleRow: { width: '100%', marginTop: 7, minHeight: 48, padding: 5, borderRadius: 16, backgroundColor: '#E9F4FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  impactVehicleCopy: { flexShrink: 1, alignItems: 'flex-start' },
  impactVehicleNumber: { color: '#092B5B', fontSize: 20, lineHeight: 23, fontWeight: '800' },
  impactVehicleLabel: { color: '#345577', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  impactSmallGrid: { marginTop: 6, flexDirection: 'row', gap: 10 },
  impactSmallTile: { flex: 1, minWidth: 0, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 15, backgroundColor: '#E9F4FF', alignItems: 'center', justifyContent: 'center', gap: 3 },
  impactSmallValue: { color: '#092B5B', fontSize: 16, lineHeight: 19, fontWeight: '800' },
  impactSmallLabel: { color: '#385A83', fontSize: 11, lineHeight: 14, textAlign: 'center', fontWeight: '700' },
  impactFallback: { color: '#385A83', fontSize: 14, lineHeight: 19, textAlign: 'center', marginTop: 9 },
  impactProtectionArtwork: { width: 164, height: 178, position: 'absolute', top: 21, left: '30%' },
  impactGoldenShield: { position: 'absolute', top: 5, width: 168, height: 170, borderRadius: 64, borderColor: '#FFE492', borderWidth: 9, backgroundColor: '#0765CD', alignItems: 'center', justifyContent: 'center', shadowColor: '#C79508', shadowOpacity: 0.36, shadowRadius: 15, elevation: 5 },
  impactApprovedMedal: { position: 'absolute', right: '1%', bottom: 5, width: 61, height: 61, borderRadius: 35, backgroundColor: '#F3AA00', borderColor: '#FFE7A1', borderWidth: 6, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  impactVehicleArtwork: { width: 166, height: 137, position: 'absolute', bottom: 0, left: '2%' },
  impactDocumentArtwork: { width: 117, height: 127, position: 'absolute', bottom: 2, right: '2%' },
  learnStoryLink: { alignItems: 'center', alignSelf: 'stretch' },
  learnBadgeGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 25, backgroundColor: '#80E6BA', transform: [{ scale: 1.045 }] },
  learnArtShadow: { position: 'absolute', bottom: 8, width: '58%', height: 14, borderRadius: 20, backgroundColor: '#3974AD' },
  learnStoryTitle: { color: '#092B5B', fontSize: 18, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
  learnStoryQuestion: { color: '#31537E', fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '600', marginTop: 7 },
  journeyStory: { width: '100%', alignItems: 'center', paddingTop: 4, paddingBottom: 8, gap: 6 },
  journeyBlueArc: { position: 'absolute', top: -30, width: '125%', height: 120, borderBottomLeftRadius: 210, borderBottomRightRadius: 195, backgroundColor: '#278CF3', opacity: 0.85 },
  journeyHeadingBadge: { minHeight: 45, maxWidth: '100%', paddingHorizontal: 22, borderRadius: 35, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, backgroundColor: '#E5F2FF', shadowColor: '#064E9F', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 3 },
  journeyHeadingText: { color: '#08449B', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  journeySubtitle: { marginTop: 3, marginBottom: 3, color: '#0752AD', fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  journeyMetricPanel: { width: '100%', paddingHorizontal: 5, marginTop: 3 },
  journeyStats: { marginTop: 0, width: '100%', flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-between' },
  journeyStat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingHorizontal: 3 },
  journeyStatDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: '#A7C5E9', marginVertical: 9 },
  journeyStatIcon: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#116AB9', shadowOpacity: 0.09, shadowRadius: 5, elevation: 2 },
  journeyStatIconBlue: { backgroundColor: '#EDF6FF' },
  journeyStatIconViolet: { backgroundColor: '#F0E4FF' },
  journeyStatIconGold: { backgroundColor: '#FFF4DE' },
  journeyStatValue: { color: '#092E67', fontSize: 18, lineHeight: 22, fontWeight: '800' },
  journeyStatLabel: { color: '#4C6387', fontSize: 9.5, lineHeight: 12, fontWeight: '700', textAlign: 'center' },
  journeyProgressBlock: { width: '100%', marginTop: 6, paddingHorizontal: 4 },
  journeyProgressTop: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  journeyProgressLabel: { color: '#285A8C', fontSize: 11, fontWeight: '700' },
  journeyProgressPercent: { paddingHorizontal: 12, paddingVertical: 2, borderRadius: 12, backgroundColor: '#09975B' },
  journeyProgressPercentText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  journeyProgressTrack: { height: 17, borderRadius: 20, backgroundColor: '#D7E2F1', padding: 3, borderWidth: 1, borderColor: '#FFFFFF', overflow: 'hidden' },
  journeyProgressFill: { height: '100%', borderRadius: 16, backgroundColor: '#14AF76' },
  journeyScene: { width: '100%', height: 304, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  journeySceneHalo: { position: 'absolute', width: '100%', height: 235, borderRadius: 140, backgroundColor: 'rgba(237,248,255,0.67)', top: 19 },
  journeyRoadArtwork: { width: '100%', height: 258 },
  journeyPeopleArtwork: { position: 'absolute', bottom: 55, left: '7%', width: 62, height: 62 },
  journeyTrophy: { position: 'absolute', right: '10%', top: 39, width: 56, height: 56, borderRadius: 30, backgroundColor: '#FFF6DB', borderWidth: 2, borderColor: '#FFDC80', alignItems: 'center', justifyContent: 'center', shadowColor: '#B17C0C', shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 },
  journeyTrophyArtwork: { width: 51, height: 51 },
  journeySceneAchieved: { position: 'absolute', left: 2, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: '#6FD4A5', borderRadius: 10 },
  journeySceneTarget: { position: 'absolute', right: 3, top: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#6EB2F7' },
  journeySceneMarkerText: { color: '#184879', fontSize: 11, fontWeight: '800' },
  journeyNoMilestone: { minHeight: 225, marginTop: 35, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', gap: 12 },
  journeyNoMilestoneText: { color: '#285A8C', textAlign: 'center', lineHeight: 21, fontSize: 14, fontWeight: '600' },

  todaySnapshot: { width: '100%', paddingTop: 3, gap: 8, alignItems: 'center' },
  todayCard: { width: '100%', borderRadius: 24, padding: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFEAFB', overflow: 'hidden', shadowColor: '#497BB6', shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  todayCornerAccent: { position: 'absolute', right: -40, top: -65, width: 158, height: 160, borderRadius: 85, backgroundColor: '#E3EEFF' },
  todayHeadlineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  todaySunIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#FFA51E', alignItems: 'center', justifyContent: 'center', shadowColor: '#DC941F', shadowOpacity: 0.18, shadowRadius: 7, elevation: 3 },
  todayClaimsIcon: { backgroundColor: '#177ADE', shadowColor: '#13569C' },
  todayHeadlineText: { flex: 1, minWidth: 0 },
  todayEyebrow: { color: '#7B8AA3', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 },
  todayTitleLink: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayHeadline: { color: '#092E68', fontSize: 18, lineHeight: 24, fontWeight: '800', flex: 1, flexShrink: 1 },
  todayDaysBadge: { color: '#0766DA', backgroundColor: '#D8E8FF', fontWeight: '900' },
  todayDivider: { marginTop: 7, marginBottom: 7, height: 1, backgroundColor: '#DAE7F8' },
  todayPremiumPanel: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 6, borderRadius: 17, backgroundColor: '#EDF5FF' },
  todayPremiumIcon: { width: 47, height: 47, backgroundColor: '#D7E9FF', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  todayPremiumBody: { flex: 1, minWidth: 0 },
  todayPremiumValue: { fontSize: 21, lineHeight: 25, fontWeight: '800', color: '#0B326E' },
  todayPremiumDescription: { color: '#506889', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  todayArtWrap: { width: '100%', height: 300, maxWidth: 360, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  todayArtHalo: { position: 'absolute', width: 280, height: 258, borderRadius: 150, backgroundColor: '#DCEBFF', opacity: 0.85 },
  todayBackDocument: { position: 'absolute', left: '14%', top: 40, width: 185, height: 216, borderRadius: 22, backgroundColor: '#E5F3FF', borderWidth: 6, borderColor: '#87BDFA', transform: [{ rotate: '-12deg' }] },
  todayFrontDocument: { position: 'absolute', left: '22%', top: 20, width: 205, height: 232, borderRadius: 23, backgroundColor: '#FFFFFF', borderWidth: 6, borderColor: '#2686F3', paddingHorizontal: 19, paddingTop: 23, shadowColor: '#246EC1', shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  todayArtLabel: { backgroundColor: '#146FE6', borderRadius: 15, paddingVertical: 8, alignItems: 'center', marginBottom: 22 },
  todayArtLabelText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  todayArtLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  todayArtLineBar: { height: 10, width: 102, backgroundColor: '#B6D0F4', borderRadius: 10 },
  todayArtLineBarShort: { width: 65 },
  todayShield: { position: 'absolute', left: '4%', bottom: 8, height: 89, width: 89, borderRadius: 24, backgroundColor: '#126FDD', borderWidth: 5, borderColor: '#E8F5FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#1667B9', shadowOpacity: 0.19, shadowRadius: 8, elevation: 6 },
  todayCalendar: { position: 'absolute', right: '5%', bottom: 6, width: 111, height: 124, backgroundColor: '#FFFFFF', borderRadius: 19, borderWidth: 4, borderColor: '#99C5FF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#2676CE', shadowOpacity: 0.22, shadowRadius: 10, elevation: 7 },
  todayCalendarTop: { position: 'absolute', height: 22, backgroundColor: '#116DE6', top: 0, right: 0, left: 0 },
  todayCalendarNumber: { marginTop: 14, color: '#0C326C', fontSize: 45, lineHeight: 53, fontWeight: '900' },
  todayCalendarDays: { color: '#0C326C', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  // Story 4/5: the reference's large financial headline, policy summary and 3D-style growth artwork.
  businessSnapshot: { width: '100%', alignItems: 'center', paddingTop: 4, gap: 8 },
  businessMonthBadge: { minHeight: 40, maxWidth: '95%', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 30, backgroundColor: '#CFE2FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  businessMonthBadgeText: { color: '#0758C3', fontSize: 14, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  businessSummaryLink: { width: '100%', alignItems: 'center', marginTop: 3 },
  businessPremiumAmount: { alignSelf: 'stretch', textAlign: 'center', color: '#092D68', fontSize: 24, lineHeight: 31, fontWeight: '800', letterSpacing: -0.8 },
  businessPoliciesCard: { marginTop: 8, width: '100%', minHeight: 52, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 28, backgroundColor: '#DCEBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  businessPolicyText: { flexShrink: 1, alignItems: 'flex-start' },
  businessPolicyCount: { fontSize: 22, lineHeight: 25, fontWeight: '800', color: '#082D67' },
  businessPolicyLabel: { fontSize: 14, lineHeight: 17, fontWeight: '700', color: '#0B2E64', textAlign: 'left' },
  businessPremiumCaption: { marginTop: 3, textAlign: 'center', fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#476384' },
  businessIllustrationWrap: { width: '100%', minHeight: 235, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  businessGrowthScene: { width: '100%', height: 300, maxWidth: 360, alignItems: 'center', justifyContent: 'center' },
  businessGrowthHalo: { position: 'absolute', top: 17, width: 275, height: 224, borderRadius: 155, backgroundColor: '#D6E7FF' },
  businessGrowth3dArtwork: { width: '100%', height: 300, maxWidth: 360 },
  businessGrowthPlatform: { position: 'absolute', bottom: 6, width: 275, height: 24, borderRadius: 40, backgroundColor: '#C1DEFD', borderWidth: 2, borderColor: '#E7F4FF' },
  businessGrowthBars: { position: 'absolute', bottom: 25, flexDirection: 'row', alignItems: 'flex-end', gap: 8, left: '19%' },
  businessGrowthBar: { width: 41, borderWidth: 2, borderColor: '#68BCFF', borderRadius: 10, backgroundColor: '#0F8DF4', overflow: 'hidden', shadowColor: '#126BC5', shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  businessGrowthBarHighlight: { position: 'absolute', left: 2, top: 3, bottom: 3, width: 7, borderRadius: 4, backgroundColor: '#7DD5FF', opacity: 0.7 },
  businessGrowthTrend: { position: 'absolute', top: 0, left: '21%', transform: [{ rotate: '-10deg' }] },
  businessRupeeCoin: { position: 'absolute', bottom: 13, left: '4%', width: 76, height: 76, borderRadius: 41, borderWidth: 5, borderColor: '#FFFFFF', backgroundColor: '#E6F3FF', justifyContent: 'center', alignItems: 'center', shadowColor: '#256CB3', shadowOpacity: 0.16, shadowRadius: 8, elevation: 5 },
  businessRupeeText: { fontSize: 42, fontWeight: '900', color: '#075ABC' },
  businessCashCoin: { position: 'absolute', bottom: 10, right: '4%', width: 79, height: 79, borderRadius: 42, borderWidth: 5, borderColor: '#FFFFFF', backgroundColor: '#0968D6', justifyContent: 'center', alignItems: 'center', shadowColor: '#256CB3', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  lessonBadge: { minHeight: 39, maxWidth: '90%', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 30, backgroundColor: '#D1E3FF', flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  lessonBadgeText: { color: '#0856B6', fontSize: 13, fontWeight: '900', letterSpacing: 0.2, textTransform: 'uppercase' },
  storyTextLink: { marginTop: 15, alignSelf: 'stretch', alignItems: 'center' },
  storyTextPressed: { opacity: 0.7 },
  metric: { textAlign: 'center', fontSize: 27, lineHeight: 34, color: '#0A2C65', fontWeight: '800' },
  businessMetric: { fontSize: 29 },
  title: { textAlign: 'center', color: '#0B2F69', fontSize: 27, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8 },
  titleRule: { marginTop: 8, width: 116, height: 3, backgroundColor: '#C7DCF9', borderRadius: 5, alignItems: 'center' },
  titleRuleActive: { width: 54, height: 3, borderRadius: 5, backgroundColor: '#125FDB' },
  body: { marginTop: 18, color: '#31537E', fontSize: 16, lineHeight: 24, fontWeight: '500', textAlign: 'center', maxWidth: 350 },
  bodyEmphasis: { color: '#0659BF', fontWeight: '800' },
  storyProgressWrap: { marginTop: 15, alignSelf: 'stretch', marginHorizontal: 13 },
  storyProgressTrack: { height: 8, borderRadius: 999, backgroundColor: '#D6E2FB', overflow: 'hidden' },
  storyProgressFill: { height: '100%', backgroundColor: '#1979EF', borderRadius: 999 },
  storyProgressMeta: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  storyProgressText: { color: '#153D74', fontSize: 12, fontWeight: '800' },
  illustrationWrap: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 220, marginTop: 6 },
  illustrationScene: { width: '100%', height: 245, alignItems: 'center', justifyContent: 'center' },
  vehicleScene: { width: '100%', height: 300, alignItems: 'center', justifyContent: 'center' },
  vehicleHalo: { position: 'absolute', width: 290, height: 205, borderRadius: 165, backgroundColor: '#D4E7FF', top: 19, opacity: 0.8 },
  vehiclePlate: { position: 'absolute', top: 35, right: '4%', width: 225, height: 83, borderWidth: 4, borderColor: '#1B5BAE', backgroundColor: '#FFFFFF', borderRadius: 10, flexDirection: 'row', alignItems: 'center', transform: [{ rotate: '7deg' }], shadowColor: '#1B5BAE', shadowOpacity: 0.19, shadowRadius: 10, shadowOffset: { width: 1, height: 5 }, elevation: 4 },
  plateCountry: { width: 42, alignSelf: 'stretch', backgroundColor: '#0A4DAD', alignItems: 'center', justifyContent: 'center', gap: 3 },
  plateCountryTop: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  plateNumber: { flex: 1, color: '#153B74', fontSize: 19, fontWeight: '900', letterSpacing: -0.9, textAlign: 'center', paddingHorizontal: 5 },
  learningCar: { position: 'absolute', left: -14, bottom: 2, width: 268, height: 172 },
  vehicleSpark: { position: 'absolute', top: 15, right: 0 },
  sceneHalo: { position: 'absolute', top: 10, width: 240, height: 225, borderRadius: 130, backgroundColor: '#D5E7FF' },
  documentSheet: { position: 'absolute', top: 28, width: 178, height: 195, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 5, borderColor: '#258CF4', shadowColor: '#0870D5', shadowOpacity: 0.2, shadowRadius: 12, elevation: 4, alignItems: 'center', paddingTop: 12 },
  documentSheetBack: { top: 39, left: '15%', borderColor: '#8CC3FF', transform: [{ rotate: '-9deg' }], backgroundColor: '#EDF6FF' },
  documentIcon: { marginBottom: 9 },
  checkRow: { width: 142, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  dummyLine: { height: 9, borderRadius: 12, backgroundColor: '#B4D6FA' },
  sceneBadge: { position: 'absolute', bottom: 10, right: '9%', width: 67, height: 67, backgroundColor: '#086BDD', borderRadius: 36, borderWidth: 4, borderColor: '#E6F2FF', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  growthBars: { position: 'absolute', bottom: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 7, left: '22%' },
  growthBar: { width: 35, borderRadius: 10, backgroundColor: '#278DF4', borderWidth: 2, borderColor: '#8EC4FF' },
  sceneGrowthArrow: { position: 'absolute', top: 0, left: '25%', transform: [{ rotate: '-10deg' }] },
  peopleRow: { position: 'absolute', bottom: 19, left: '12%', flexDirection: 'row', alignItems: 'flex-end', gap: -5 },
  rupeeBadge: { position: 'absolute', left: '7%', bottom: 20, width: 63, height: 63, borderRadius: 32, backgroundColor: '#DDEEFF', borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  rupeeText: { fontSize: 35, fontWeight: '900', color: '#0763C7' },
  completedPill: { alignSelf: 'center', marginTop: 5, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingVertical: 6, borderRadius: 50, backgroundColor: '#DDF6EA' },
  completedText: { color: '#06845A', fontSize: 13, fontWeight: '800' },
  storyLoadingArea: { flex: 1, minHeight: 0, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 20, gap: 14, backgroundColor: '#EAF3FF' },
  storySkeleton: { gap: 17, padding: 24, borderRadius: 22, backgroundColor: '#FFFFFF' },
  storySkeletonSecondary: { gap: 14, padding: 20, borderRadius: 22, backgroundColor: '#FFFFFF' },
  storySkeletonArtwork: { height: 120, width: '100%', borderRadius: 16, backgroundColor: '#DBE6F8' },
  storySkeletonIcon: { height: 54, width: 54, borderRadius: 15, backgroundColor: '#E1EAF8' },
  storySkeletonEyebrow: { height: 12, width: '35%', borderRadius: 5, backgroundColor: '#E1EAF8' },
  storySkeletonTitle: { height: 27, width: '80%', borderRadius: 8, backgroundColor: '#DBE6F8' },
  storySkeletonLine: { height: 14, width: '92%', borderRadius: 6, backgroundColor: '#E1EAF8' },
  storySkeletonLineShort: { height: 14, width: '65%', borderRadius: 6, backgroundColor: '#E1EAF8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 35 },
  errorText: { color: '#506483', fontSize: 14, textAlign: 'center' },
  retry: { marginTop: 16, borderRadius: 13, paddingHorizontal: 17, paddingVertical: 12, backgroundColor: '#0D6FE0' },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
});
