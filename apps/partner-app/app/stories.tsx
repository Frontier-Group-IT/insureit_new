import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPartnerStories, type PartnerStory, type PartnerStoriesData } from '@/lib/stories';
import { formatIndianCurrency } from '@/lib/format';

export default function StoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ start?: string }>();
  const [data, setData] = useState<PartnerStoriesData | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getPartnerStories();
      setData(result);
      const start = typeof params.start === 'string' ? params.start : '';
      const startIndex = result.items.findIndex((item) => item.kind === start);
      setIndex(startIndex >= 0 ? startIndex : 0);
    } catch {
      setError('Your INSUREIT Stories could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.start]);

  useEffect(() => {
    void load();
  }, [load]);

  const story = data?.items[index] || null;

  const progress = useMemo(() => {
    if (!data?.items.length) return [];
    return data.items.map((_, itemIndex) => itemIndex <= index);
  }, [data, index]);

  function next() {
    if (!data) return;
    if (index >= data.items.length - 1) {
      router.back();
      return;
    }
    setIndex((value) => value + 1);
  }

  function previous() {
    if (index <= 0) return;
    setIndex((value) => value - 1);
  }

  function openStory() {
    if (!story?.route) return;
    router.replace(story.route as never);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" backgroundColor="#092B62" />
      <View style={[styles.top, { paddingTop: insets.top + 11 }]}>
        <View style={styles.progress} accessibilityLabel={'Story ' + (index + 1) + ' of ' + (data?.items.length || 5)}>
          {progress.map((active, itemIndex) => (
            <View key={itemIndex} style={styles.progressTrack}>
              <View style={[styles.progressFill, active && styles.progressFillActive]} />
            </View>
          ))}
        </View>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>I</Text></View>
            <View style={styles.brandDivider} />
            <View>
              <Text style={styles.brandTitle}>INSUREIT STORIES</Text>
              <Text style={styles.brandMeta}>Your business, in moments</Text>
            </View>
          </View>
          <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close INSUREIT Stories">
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.storySkeleton} accessibilityRole="progressbar" accessibilityLabel="Loading INSUREIT Stories">
          <View style={styles.storySkeletonIcon} />
          <View style={styles.storySkeletonEyebrow} />
          <View style={styles.storySkeletonTitle} />
          <View style={styles.storySkeletonLine} />
          <View style={styles.storySkeletonLineShort} />
        </View>
      ) : error || !story ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'No Story is available.'}</Text>
          <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { minHeight: Math.max(480, windowHeight - insets.top - insets.bottom - 210) }]}
            showsVerticalScrollIndicator={false}
            accessibilityLabel="Story content"
          >
            <View pointerEvents="none" style={styles.storyBackdrop}>
              <View style={styles.waveUpper} />
              <View style={styles.waveMiddle} />
              <View style={styles.waveLower} />
            </View>
            <View style={styles.storyContent}>
              {story.kind === 'business' ? (
                <BusinessMonthStory story={story} onOpen={openStory} />
              ) : (
              <>
              <View style={styles.lessonBadge}>
                <Ionicons name={story.kind === 'learn' ? 'time-outline' : storyIcon(story.kind)} size={20} color="#0757C8" />
                <Text numberOfLines={1} style={styles.lessonBadgeText}>{story.eyebrow}</Text>
              </View>
              <Pressable
                onPress={openStory}
                disabled={!story.route}
                accessibilityRole={story.route ? 'link' : undefined}
                accessibilityLabel={story.route ? 'Open ' + story.title : undefined}
                style={({ pressed }) => [styles.storyTextLink, pressed && story.route ? styles.storyTextPressed : null]}
              >
                {story.metric !== undefined ? (
                  <Text style={[styles.metric, story.kind === 'business' && styles.businessMetric]} adjustsFontSizeToFit numberOfLines={2}>{formatMetric(story)}</Text>
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
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
            <Pressable onPress={previous} disabled={index === 0} accessibilityRole="button" accessibilityLabel="Previous story" style={[styles.navButton, index === 0 && styles.navDisabled]}>
              <Ionicons name="arrow-back" size={27} color="#0C5EC5" />
            </Pressable>
            <Text style={styles.footerHint}>{index + 1} of {data?.items.length || 0}</Text>
            <Pressable onPress={next} accessibilityRole="button" accessibilityLabel={index === (data?.items.length || 1) - 1 ? 'Close stories' : 'Next story'} style={[styles.navButton, styles.navButtonPrimary]}>
              <Ionicons name="arrow-forward" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
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

/**
 * The fourth (monthly business) story uses a focused financial snapshot instead
 * of the shared narrative slide. Metrics and policy counts stay backend-driven.
 */
function BusinessMonthStory({ story, onOpen }: { story: PartnerStory; onOpen: () => void }) {
  const policyMatch = story.title.match(/^([0-9,]+) +(polic(?:y|ies)) *(.*)$/i);
  const premium = story.metric !== undefined ? formatMetric(story) : null;
  const label = story.metric_label?.trim() || 'Gross premium';
  const hasRoute = Boolean(story.route);
  const hasTarget = story.progress_current !== undefined && Boolean(story.progress_target);

  return (
    <View style={styles.businessSnapshot}>
      <View style={styles.businessMonthBadge}>
        <Ionicons name="stats-chart-outline" size={23} color="#075ECB" />
        <Text style={styles.businessMonthBadgeText}>{story.eyebrow}</Text>
      </View>
      <Pressable
        onPress={onOpen}
        disabled={!hasRoute}
        accessibilityRole={hasRoute ? 'link' : undefined}
        accessibilityLabel={hasRoute ? 'Open ' + story.title : undefined}
        style={({ pressed }) => [styles.businessSummaryLink, pressed && hasRoute && styles.storyTextPressed]}
      >
        {premium ? (
          <Text style={styles.businessPremiumAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.42}>
            {premium}
          </Text>
        ) : null}
        <View style={styles.titleRule}><View style={styles.titleRuleActive} /></View>
        <View style={styles.businessPoliciesCard}>
          <Ionicons name="document-text-outline" size={31} color="#0E6ADD" />
          <View style={styles.businessPolicyText}>
            {policyMatch ? (
              <>
                <Text style={styles.businessPolicyCount}>{policyMatch[1]}</Text>
                <Text style={styles.businessPolicyLabel}>{policyMatch[2] + (policyMatch[3] ? ' ' + policyMatch[3].trim() : '')}</Text>
              </>
            ) : (
              <Text style={styles.businessPolicyLabel}>{story.title}</Text>
            )}
          </View>
        </View>
      </Pressable>
      <Text style={styles.businessPremiumCaption}>
        {premium ? label + ' ' + premium : story.body}
      </Text>
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
      <View style={styles.businessIllustrationWrap} pointerEvents="none">
        <StoryIllustration kind="business" body={story.body} />
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

function StoryIllustration({ kind, body }: { kind: PartnerStory['kind']; body: string }) {
  // Match the vehicle-servicing story in the supplied reference. Other learning
  // questions retain a generic insured-document illustration instead of showing
  // an unrelated number plate.
  if (kind === 'learn' && /vehicle number/i.test(body)) {
    return (
      <View style={styles.vehicleScene}>
        <View style={styles.vehicleHalo} />
        <View style={styles.vehiclePlate}>
          <View style={styles.plateCountry}><Text style={styles.plateCountryTop}>IND</Text><Ionicons name="car-sport" size={20} color="#FFFFFF" /></View>
          <Text style={styles.plateNumber} adjustsFontSizeToFit numberOfLines={1}>MH12AB1234</Text>
        </View>
        <Image source={require('../assets/partner/actions/impact-blue-3d-car.png')}
          resizeMode="contain" style={styles.learningCar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <View style={styles.vehicleSpark}><Ionicons name="sparkles" size={26} color="#075FCC" /></View>
      </View>
    );
  }
  if (kind === 'journey') {
    return (
      <View style={styles.illustrationScene}>
        <View style={styles.sceneHalo} />
        <View style={styles.growthBars}>
          {[60, 95, 132, 171].map((height, i) => <View key={i} style={[styles.growthBar, { height }]} />)}
        </View>
        <View style={styles.sceneGrowthArrow}><Ionicons name="trending-up" size={120} color="#1988FA" /></View>
        <View style={styles.peopleRow}>
          {[32, 42, 55, 46].map((size, i) => <Ionicons key={i} name="person" size={size} color={i === 2 ? '#075AB9' : '#1680E6'} />)}
        </View>
        <View style={styles.sceneBadge}><Ionicons name="people" size={38} color="#FFFFFF" /></View>
      </View>
    );
  }
  if (kind === 'business') {
    return (
      <View style={styles.businessGrowthScene}>
        <View style={styles.businessGrowthHalo} />
        <View style={styles.businessGrowthPlatform} />
        <View style={styles.businessGrowthBars}>
          {[68, 107, 146, 183].map((height, i) => (
            <View key={i} style={[styles.businessGrowthBar, { height }]}>
              <View style={styles.businessGrowthBarHighlight} />
            </View>
          ))}
        </View>
        <View style={styles.businessGrowthTrend}><Ionicons name="trending-up" size={138} color="#0888F5" /></View>
        <View style={styles.businessRupeeCoin}><Text style={styles.businessRupeeText}>₹</Text></View>
        <View style={styles.businessCashCoin}><Ionicons name="cash-outline" size={39} color="#FFFFFF" /></View>
      </View>
    );
  }
  if (kind === 'learn') {
    return (
      <View style={styles.illustrationScene}>
        <View style={styles.sceneHalo} />
        <View style={[styles.documentSheet, styles.documentSheetBack]} />
        <View style={styles.documentSheet}>
          <View style={styles.documentIcon}><Ionicons name="shield-checkmark" size={43} color="#176FDD" /></View>
          {[0, 1, 2].map(i => <View key={i} style={styles.checkRow}><Ionicons name="checkbox" size={23} color="#197CF4" /><View style={[styles.dummyLine, { width: i === 2 ? 90 : 125 }]} /></View>)}
        </View>
        <View style={styles.sceneBadge}><Ionicons name="refresh" size={40} color="#FFFFFF" /></View>
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
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#EAF2FF' },
  top: { zIndex: 5, backgroundColor: '#0A3478', paddingHorizontal: 18, paddingTop: 11, paddingBottom: 28 },
  progress: { flexDirection: 'row', gap: 6 },
  progressTrack: { flex: 1, height: 4, overflow: 'hidden', borderRadius: 999, backgroundColor: '#7D9BC7' },
  progressFill: { width: '0%', height: '100%', backgroundColor: '#FFFFFF', borderRadius: 999 },
  progressFillActive: { width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 },
  brandMark: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#6551EB', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  brandDivider: { width: 1.5, height: 42, backgroundColor: '#BBD4FB', marginHorizontal: 1 },
  brandTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  brandMeta: { marginTop: 3, color: '#DBE8FF', fontSize: 11 },
  close: { width: 42, height: 42, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D5998' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 44, paddingBottom: 14, justifyContent: 'center' },
  storyBackdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  waveUpper: { position: 'absolute', top: -205, left: -110, width: '150%', height: 255, borderBottomLeftRadius: 250, borderBottomRightRadius: 145, backgroundColor: '#0A3478', transform: [{ rotate: '-9deg' }] },
  waveMiddle: { position: 'absolute', top: -45, left: -100, width: '160%', height: 200, borderTopLeftRadius: 245, borderTopRightRadius: 180, backgroundColor: '#CFE2FF', opacity: 0.9, transform: [{ rotate: '-10deg' }] },
  waveLower: { position: 'absolute', bottom: -110, right: -130, width: '155%', height: 230, borderTopLeftRadius: 240, borderTopRightRadius: 280, backgroundColor: '#D6E6FF', opacity: 0.88, transform: [{ rotate: '-11deg' }] },
  storyContent: { alignItems: 'center', width: '100%', paddingTop: 8 },
  // Story 4/5: the reference's large financial headline, policy summary and 3D-style growth artwork.
  businessSnapshot: { width: '100%', alignItems: 'center', paddingTop: 4 },
  businessMonthBadge: { minHeight: 40, maxWidth: '95%', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 30, backgroundColor: '#CFE2FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  businessMonthBadgeText: { color: '#0758C3', fontSize: 14, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  businessSummaryLink: { width: '100%', alignItems: 'center', marginTop: 18 },
  businessPremiumAmount: { alignSelf: 'stretch', textAlign: 'center', color: '#092D68', fontSize: 41, lineHeight: 52, fontWeight: '900', letterSpacing: -1.1 },
  businessPoliciesCard: { marginTop: 18, width: '100%', minHeight: 78, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 28, backgroundColor: '#DCEBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  businessPolicyText: { flexShrink: 1, alignItems: 'flex-start' },
  businessPolicyCount: { fontSize: 29, lineHeight: 33, fontWeight: '900', color: '#082D67' },
  businessPolicyLabel: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: '#0B2E64', textAlign: 'left' },
  businessPremiumCaption: { marginTop: 13, textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '700', color: '#476384' },
  businessIllustrationWrap: { width: '100%', minHeight: 250, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
  businessGrowthScene: { width: '100%', height: 270, maxWidth: 360, alignItems: 'center', justifyContent: 'center' },
  businessGrowthHalo: { position: 'absolute', top: 17, width: 275, height: 224, borderRadius: 155, backgroundColor: '#D6E7FF' },
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
  metric: { textAlign: 'center', fontSize: 31, lineHeight: 38, color: '#0A2C65', fontWeight: '900' },
  businessMetric: { fontSize: 29 },
  title: { textAlign: 'center', color: '#0B2F69', fontSize: 32, lineHeight: 39, fontWeight: '900', letterSpacing: -0.8 },
  titleRule: { marginTop: 14, width: 116, height: 3, backgroundColor: '#C7DCF9', borderRadius: 5, alignItems: 'center' },
  titleRuleActive: { width: 54, height: 3, borderRadius: 5, backgroundColor: '#125FDB' },
  body: { marginTop: 18, color: '#31537E', fontSize: 19, lineHeight: 28, fontWeight: '500', textAlign: 'center', maxWidth: 350 },
  bodyEmphasis: { color: '#0659BF', fontWeight: '800' },
  storyProgressWrap: { marginTop: 15, alignSelf: 'stretch', marginHorizontal: 13 },
  storyProgressTrack: { height: 8, borderRadius: 999, backgroundColor: '#D6E2FB', overflow: 'hidden' },
  storyProgressFill: { height: '100%', backgroundColor: '#1979EF', borderRadius: 999 },
  storyProgressMeta: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  storyProgressText: { color: '#153D74', fontSize: 12, fontWeight: '800' },
  illustrationWrap: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 230, marginTop: 6 },
  illustrationScene: { width: '100%', height: 245, alignItems: 'center', justifyContent: 'center' },
  vehicleScene: { width: '100%', height: 250, alignItems: 'center', justifyContent: 'center' },
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
  completedPill: { alignSelf: 'center', marginTop: 5, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 50, backgroundColor: '#DDF6EA' },
  completedText: { color: '#06845A', fontSize: 14, fontWeight: '800' },
  footer: { zIndex: 5, paddingHorizontal: 23, paddingBottom: 18, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#DDEBFF' },
  footerHint: { color: '#12366C', fontSize: 15, fontWeight: '900' },
  navButton: { width: 57, height: 57, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 30 },
  navButtonPrimary: { backgroundColor: '#0955CC', shadowColor: '#0446A3', shadowOpacity: 0.17, shadowRadius: 8, elevation: 3 },
  navDisabled: { opacity: 0.3 },
  storySkeleton: { margin: 24, gap: 17, padding: 24, borderRadius: 22, backgroundColor: '#FFFFFF' },
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
