import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { minHeight: Math.max(510, windowHeight - 185) }]} showsVerticalScrollIndicator={false}>
            <View style={styles.metricCard}>
              <View style={styles.cardCorner} pointerEvents="none" />
              <View style={styles.metricHeader}>
                <View style={[styles.storyIcon, storyToneStyle(story.tone)]}>
                  <Ionicons name={storyIcon(story.kind)} size={32} color="#FFFFFF" />
                </View>
                <View style={styles.metricText}>
                  <Text style={styles.eyebrow}>{story.eyebrow}</Text>
                  <Pressable onPress={openStory} disabled={!story.route} accessibilityRole={story.route ? 'link' : undefined} accessibilityLabel={story.route ? 'Open ' + story.title : undefined} style={({ pressed }) => [styles.storyTextLink, pressed && story.route ? styles.storyTextPressed : null]}>
                    {story.metric !== undefined ? <Text style={[styles.metric, story.kind === 'business' && styles.businessMetric]} adjustsFontSizeToFit numberOfLines={2}>{formatMetric(story)}</Text> : null}
                    <View style={styles.titleRow}>
                      <Text style={styles.title}>{story.title}</Text>
                      {story.route ? <Ionicons name="arrow-forward" size={23} color="#1169E7" style={styles.titleArrow} /> : null}
                    </View>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.body}>{story.body}</Text>
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
              {story.kind === 'learn' && story.answered_today ? (
                <View style={styles.completedPill}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#0D8659" />
                  <Text style={styles.completedText}>Completed today</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.illustrationWrap} pointerEvents="none">
              <StoryIllustration kind={story.kind} />
            </View>
            <View style={styles.lowerWave} pointerEvents="none" />
          </ScrollView>
          <View style={styles.footer}>
            <Pressable onPress={previous} disabled={index === 0} accessibilityRole="button" accessibilityLabel="Previous story" style={[styles.navButton, index === 0 && styles.navDisabled]}>
              <Ionicons name="arrow-back" size={19} color="#1358B5" />
            </Pressable>
            <Text style={styles.footerHint}>{index + 1} of {data?.items.length || 0}</Text>
            <Pressable onPress={next} accessibilityRole="button" accessibilityLabel={index === (data?.items.length || 1) - 1 ? 'Close stories' : 'Next story'} style={styles.navButton}>
              <Ionicons name="arrow-forward" size={19} color="#1358B5" />
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

function storyToneStyle(tone: PartnerStory['tone']) {
  if (tone === 'attention') return styles.toneAttention;
  if (tone === 'impact') return styles.toneImpact;
  if (tone === 'journey') return styles.toneJourney;
  if (tone === 'business') return styles.toneBusiness;
  if (tone === 'learn') return styles.toneLearn;
  return styles.toneCalm;
}

function formatMetric(story: PartnerStory) {
  const value = Number(story.metric || 0);
  if (story.metric_label?.toLowerCase().includes('idv') || story.metric_label?.toLowerCase().includes('premium')) return formatIndianCurrency(value);
  return String(story.metric);
}

/** No photographic/full-screen background; each story gets native, scalable illustration artwork. */
function StoryIllustration({ kind }: { kind: PartnerStory['kind'] }) {
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
      <View style={styles.illustrationScene}>
        <View style={styles.sceneHalo} />
        <View style={styles.growthBars}>
          {[60, 94, 133, 184].map((height, i) => <View key={i} style={[styles.growthBar, { height }]} />)}
        </View>
        <View style={styles.sceneGrowthArrow}><Ionicons name="trending-up" size={128} color="#117CF4" /></View>
        <View style={styles.sceneBadge}><Ionicons name="cash-outline" size={44} color="#FFFFFF" /></View>
        <View style={styles.rupeeBadge}><Text style={styles.rupeeText}>₹</Text></View>
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
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#F6F9FF' },
  top: { zIndex: 5, backgroundColor: '#092B62', paddingHorizontal: 19, paddingTop: 11, paddingBottom: 25, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  progress: { flexDirection: 'row', gap: 6 },
  progressTrack: { flex: 1, height: 4, overflow: 'hidden', borderRadius: 999, backgroundColor: '#57749E' },
  progressFill: { width: '0%', height: '100%', backgroundColor: '#FFFFFF', borderRadius: 999 },
  progressFillActive: { width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 23 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 },
  brandMark: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#6550EC', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  brandDivider: { width: 1.5, height: 44, backgroundColor: '#C4D4EE', marginHorizontal: 2 },
  brandTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  brandMeta: { marginTop: 3, color: '#C8D6EC', fontSize: 11 },
  close: { width: 41, height: 41, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D477D' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 39, paddingHorizontal: 15, paddingBottom: 20 },
  metricCard: { overflow: 'hidden', backgroundColor: '#FFFFFF', borderRadius: 27, borderWidth: 1, borderColor: '#DCEAFF', padding: 19, shadowColor: '#1D64BC', shadowOffset: { width: 0, height: 10 }, shadowRadius: 17, shadowOpacity: 0.12, elevation: 4 },
  cardCorner: { position: 'absolute', right: -44, top: -56, width: 140, height: 140, borderRadius: 75, backgroundColor: '#DCEBFF', opacity: 0.83 },
  metricHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  storyIcon: { width: 62, height: 62, borderRadius: 19, alignItems: 'center', justifyContent: 'center', shadowColor: '#0E64C7', shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  toneAttention: { backgroundColor: '#FFA216' },
  toneImpact: { backgroundColor: '#0977E9' },
  toneJourney: { backgroundColor: '#7047EF' },
  toneBusiness: { backgroundColor: '#078AF3' },
  toneLearn: { backgroundColor: '#1689EE' },
  toneCalm: { backgroundColor: '#176BBA' },
  metricText: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#626F8C', fontSize: 12, fontWeight: '900', letterSpacing: 1.15, marginTop: 2, marginBottom: 10, textTransform: 'uppercase' },
  storyTextLink: { flexShrink: 1 },
  storyTextPressed: { opacity: 0.66 },
  metric: { fontSize: 31, lineHeight: 38, color: '#0B2C65', fontWeight: '900', letterSpacing: -0.8 },
  businessMetric: { fontSize: 29 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 6 },
  title: { color: '#0A2B63', fontSize: 24, lineHeight: 31, fontWeight: '900', flexShrink: 1 },
  titleArrow: { marginLeft: 1 },
  body: { marginTop: 18, color: '#566580', fontSize: 14, lineHeight: 21, fontWeight: '500' },
  storyProgressWrap: { marginTop: 20 },
  storyProgressTrack: { height: 11, borderRadius: 999, backgroundColor: '#D6E2FB', overflow: 'hidden' },
  storyProgressFill: { height: '100%', backgroundColor: '#645BFF', borderRadius: 999 },
  storyProgressMeta: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  storyProgressText: { color: '#153D74', fontSize: 14, fontWeight: '800' },
  completedPill: { alignSelf: 'flex-start', marginTop: 17, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 50, backgroundColor: '#E7F7EF' },
  completedText: { color: '#0D8659', fontSize: 11, fontWeight: '800' },
  illustrationWrap: { minHeight: 250, flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 35, paddingBottom: 16 },
  illustrationScene: { width: '100%', height: 300, alignItems: 'center', justifyContent: 'center' },
  sceneHalo: { position: 'absolute', top: 24, width: 256, height: 248, borderRadius: 130, backgroundColor: '#E3EFFF' },
  documentSheet: { position: 'absolute', top: 34, width: 190, height: 221, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 6, borderColor: '#258CF4', shadowColor: '#0870D5', shadowOpacity: 0.22, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8, alignItems: 'center', paddingTop: 15 },
  documentSheetBack: { top: 49, left: '15%', borderColor: '#8CC3FF', transform: [{ rotate: '-9deg' }], backgroundColor: '#EDF6FF' },
  documentIcon: { marginBottom: 12 },
  checkRow: { width: 152, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13 },
  dummyLine: { height: 10, borderRadius: 12, backgroundColor: '#B4D6FA' },
  sceneBadge: { position: 'absolute', bottom: 17, right: '12%', width: 85, height: 85, backgroundColor: '#086BDD', borderRadius: 44, borderWidth: 5, borderColor: '#E6F2FF', justifyContent: 'center', alignItems: 'center', shadowColor: '#176FC7', shadowOpacity: 0.22, shadowRadius: 10, elevation: 7 },
  growthBars: { position: 'absolute', bottom: 29, flexDirection: 'row', alignItems: 'flex-end', gap: 9, left: '23%' },
  growthBar: { width: 41, borderRadius: 10, backgroundColor: '#278DF4', borderWidth: 2, borderColor: '#8EC4FF', shadowColor: '#126CBA', shadowOpacity: 0.17, shadowRadius: 7, elevation: 3 },
  sceneGrowthArrow: { position: 'absolute', top: 4, left: '27%', transform: [{ rotate: '-10deg' }] },
  peopleRow: { position: 'absolute', bottom: 30, left: '13%', flexDirection: 'row', alignItems: 'flex-end', gap: -5 },
  rupeeBadge: { position: 'absolute', left: '9%', bottom: 30, width: 73, height: 73, borderRadius: 37, backgroundColor: '#DDEEFF', borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  rupeeText: { fontSize: 40, fontWeight: '900', color: '#0763C7' },
  lowerWave: { alignSelf: 'center', width: '120%', height: 35, marginTop: 10, backgroundColor: '#E5F0FF', borderTopLeftRadius: 110, borderTopRightRadius: 130, opacity: 0.8 },
  footer: { zIndex: 5, paddingHorizontal: 23, paddingBottom: 18, paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerHint: { color: '#12366C', fontSize: 12, fontWeight: '700' },
  navButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F2FF', borderRadius: 22 },
  navDisabled: { opacity: 0.26 },
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
