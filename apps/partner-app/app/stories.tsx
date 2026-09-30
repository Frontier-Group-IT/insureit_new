import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getPartnerStories, type PartnerStory, type PartnerStoriesData } from '@/lib/stories';
import { formatIndianCurrency } from '@/lib/format';

const STORY_ARTWORK = require('../assets/partner/banners/business-growth-11.png');

export default function StoriesScreen() {
  const router = useRouter();
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
      <View style={styles.blueWash} pointerEvents="none" />
      <View style={styles.artworkWrap} pointerEvents="none">
        <Image source={STORY_ARTWORK} resizeMode="cover" style={styles.artwork} />
        <View style={styles.artworkTopFade} />
        <View style={styles.artworkBottomFade} />
      </View>
      <View style={styles.topGlow} pointerEvents="none" />

      <View style={styles.top}>
        <View style={styles.progress}>
          {progress.map((active, itemIndex) => (
            <View key={itemIndex} style={styles.progressTrack}>
              <View style={[styles.progressFill, active && styles.progressFillActive]} />
            </View>
          ))}
        </View>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>I</Text></View>
            <View>
              <Text style={styles.brandTitle}>INSUREIT STORIES</Text>
              <Text style={styles.brandMeta}>Your business, in moments</Text>
            </View>
          </View>
          <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#FFFFFF" /></View>
      ) : error || !story ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'No Story is available.'}</Text>
          <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.content}>
            <View style={[styles.storyIcon, storyToneStyle(story.tone)]}>
              <Ionicons name={storyIcon(story.kind)} size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.eyebrow}>{story.eyebrow}</Text>

            <Pressable
              onPress={openStory}
              disabled={!story.route}
              hitSlop={10}
              accessibilityRole={story.route ? 'link' : undefined}
              accessibilityLabel={story.route ? `Open ${story.title}` : undefined}
              style={({ pressed }) => [styles.storyTextLink, pressed && story.route ? styles.storyTextPressed : null]}
            >
              {story.metric !== undefined ? <Text style={styles.metric}>{formatMetric(story)}</Text> : null}
              <View style={styles.titleRow}>
                <Text style={styles.title}>{story.title}</Text>
                {story.route ? <Ionicons name="arrow-forward" size={18} color="#DCE7FF" style={styles.titleArrow} /> : null}
              </View>
              <Text style={styles.body}>{story.body}</Text>
            </Pressable>

            {story.progress_current !== undefined && story.progress_target ? (
              <View style={styles.storyProgressWrap}>
                <View style={styles.storyProgressTrack}>
                  <View style={[styles.storyProgressFill, { width: `${Math.min(100, Math.max(0, (story.progress_current / story.progress_target) * 100))}%` }]} />
                </View>
                <View style={styles.storyProgressMeta}>
                  <Text style={styles.storyProgressText}>{story.progress_current}</Text>
                  <Text style={styles.storyProgressText}>{story.progress_target}</Text>
                </View>
              </View>
            ) : null}

            {story.kind === 'learn' && story.answered_today ? (
              <View style={styles.completedPill}>
                <Ionicons name="checkmark-circle-outline" size={15} color="#BDE8CD" />
                <Text style={styles.completedText}>Completed today</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerHint}>{index + 1} of {data?.items.length || 0}</Text>
          </View>

          <Pressable onPress={previous} style={styles.leftZone} accessibilityLabel="Previous story" />
          <Pressable onPress={next} style={styles.rightZone} accessibilityLabel="Next story" />
        </>
      )}
    </View>
  );
}

function storyIcon(kind: PartnerStory['kind']) {
  if (kind === 'today') return 'sunny-outline' as const;
  if (kind === 'impact') return 'heart-outline' as const;
  if (kind === 'journey') return 'trail-sign-outline' as const;
  if (kind === 'business') return 'analytics-outline' as const;
  return 'bulb-outline' as const;
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

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#061733', paddingTop: 10, paddingHorizontal: 11, paddingBottom: 14 },
  blueWash: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#052A6E', opacity: 0.48 },
  artworkWrap: { position: 'absolute', left: 0, right: 0, top: '31%', bottom: 0, overflow: 'hidden' },
  artwork: { position: 'absolute', left: -82, right: -82, top: 0, width: '150%', height: '100%', opacity: 0.98 },
  artworkTopFade: { position: 'absolute', left: 0, right: 0, top: 0, height: '24%', backgroundColor: '#061A3D', opacity: 0.52 },
  artworkBottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '18%', backgroundColor: '#06142F', opacity: 0.45 },
  topGlow: { position: 'absolute', left: -90, right: -90, top: 55, height: 250, borderRadius: 220, backgroundColor: '#0C46A5', opacity: 0.26 },
  top: { zIndex: 6 },
  progress: { flexDirection: 'row', gap: 4 },
  progressTrack: { flex: 1, height: 3, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(186,204,235,0.30)' },
  progressFill: { width: '0%', height: '100%', borderRadius: 999, backgroundColor: '#8175FF' },
  progressFillActive: { width: '100%' },
  header: { marginTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5B4CE3' },
  brandMarkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  brandTitle: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  brandMeta: { marginTop: 1, color: '#B8C5DB', fontSize: 7.5 },
  close: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24,42,74,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  errorText: { color: '#CDD4E0', fontSize: 13, textAlign: 'center' },
  retry: { marginTop: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#4F46C8' },
  retryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  content: { zIndex: 5, position: 'absolute', left: 11, right: 11, top: '16%' },
  storyIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  toneAttention: { backgroundColor: '#D88916' },
  toneImpact: { backgroundColor: '#0E9A9C' },
  toneJourney: { backgroundColor: '#675FD4' },
  toneBusiness: { backgroundColor: '#1464EA' },
  toneLearn: { backgroundColor: '#A66B17' },
  toneCalm: { backgroundColor: '#49627A' },
  eyebrow: { marginTop: 12, color: '#B8B3FF', fontSize: 9.5, lineHeight: 13, fontWeight: '900', letterSpacing: 1.4 },
  storyTextLink: { alignSelf: 'flex-start', maxWidth: '94%', paddingRight: 2 },
  storyTextPressed: { opacity: 0.74 },
  metric: { marginTop: 7, color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -0.8, textShadowColor: 'rgba(0,0,0,0.24)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  titleRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  title: { maxWidth: 310, color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.22)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  titleArrow: { marginLeft: 7, marginTop: 2 },
  body: { marginTop: 6, maxWidth: 330, color: '#D1DBEA', fontSize: 13, lineHeight: 19, textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  storyProgressWrap: { marginTop: 14, maxWidth: 330 },
  storyProgressTrack: { height: 7, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(48,74,112,0.80)' },
  storyProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#7B73FF' },
  storyProgressMeta: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  storyProgressText: { color: '#CBD5E4', fontSize: 9 },
  completedPill: { alignSelf: 'flex-start', marginTop: 13, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, backgroundColor: 'rgba(24,56,45,0.90)' },
  completedText: { color: '#BDE8CD', fontSize: 10, fontWeight: '800' },
  footer: { position: 'absolute', zIndex: 6, right: 13, bottom: 16, alignItems: 'flex-end' },
  footerHint: { color: '#D2DBE9', fontSize: 9 },
  leftZone: { position: 'absolute', zIndex: 2, left: 0, top: 75, bottom: 54, width: '22%' },
  rightZone: { position: 'absolute', zIndex: 2, right: 0, top: 75, bottom: 54, width: '22%' },
});
