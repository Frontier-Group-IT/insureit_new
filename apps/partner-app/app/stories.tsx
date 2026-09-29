import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { StoryImpactArtwork } from '@/components/StoryImpactArtwork';
import { getPartnerStories, type PartnerStory, type PartnerStoriesData } from '@/lib/stories';
import { formatIndianCurrency } from '@/lib/format';

export default function StoriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ start?: string }>();
  const [data, setData] = useState<PartnerStoriesData | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await getPartnerStories();
      setData(result);
      const start = typeof params.start === 'string' ? params.start : '';
      const startIndex = result.items.findIndex((item) => item.kind === start);
      setIndex(startIndex >= 0 ? startIndex : 0);
    } catch { setError('Your INSUREIT Stories could not be loaded.'); }
    finally { setLoading(false); }
  }, [params.start]);

  useEffect(() => { void load(); }, [load]);
  const story = data?.items[index] || null;
  const progress = useMemo(() => data?.items.map((_, itemIndex) => itemIndex <= index) || [], [data, index]);

  function next() {
    if (!data) return;
    if (index >= data.items.length - 1) { router.back(); return; }
    setIndex((value) => value + 1);
  }
  function previous() { if (index > 0) setIndex((value) => value - 1); }
  function openStory() { if (story?.route) router.replace(story.route as never); }

  return (
    <View style={styles.screen}>
      <View style={styles.ambientGlow} pointerEvents="none" />
      <View style={styles.top}>
        <View style={styles.progress}>
          {progress.map((active, itemIndex) => <View key={itemIndex} style={styles.progressTrack}><View style={[styles.progressFill, active && styles.progressFillActive]} /></View>)}
        </View>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>I</Text></View>
            <View><Text style={styles.brandTitle}>INSUREIT STORIES</Text><Text style={styles.brandMeta}>Your business, in moments</Text></View>
          </View>
          <Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={20} color="#FFFFFF" /></Pressable>
        </View>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color="#FFFFFF" /></View> : error || !story ? (
        <View style={styles.center}><Text style={styles.errorText}>{error || 'No Story is available.'}</Text><Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>
      ) : <>
        {story.kind === 'impact' ? <StoryImpactArtwork vehicleCount={story.title.match(/[\d,]+/)?.[0]} /> : null}
        <View style={[styles.content, story.kind === 'impact' && styles.impactContent]}>
          <View style={[styles.storyIcon, storyToneStyle(story.tone)]}><Ionicons name={storyIcon(story.kind)} size={25} color="#FFFFFF" /></View>
          <Text style={styles.eyebrow}>{story.eyebrow}</Text>
          {story.metric !== undefined ? <Text style={styles.metric}>{formatMetric(story)}</Text> : null}
          <Text style={styles.title}>{story.title}</Text>
          <Text style={styles.body}>{story.body}</Text>
          {story.progress_current !== undefined && story.progress_target ? <View style={styles.storyProgressWrap}>
            <View style={styles.storyProgressTrack}><View style={[styles.storyProgressFill, { width: `${Math.min(100, Math.max(0, (story.progress_current / story.progress_target) * 100))}%` }]} /></View>
            <View style={styles.storyProgressMeta}><Text style={styles.storyProgressText}>{story.progress_current}</Text><Text style={styles.storyProgressText}>{story.progress_target}</Text></View>
          </View> : null}
          {story.kind === 'learn' && story.answered_today ? <View style={styles.completedPill}><Ionicons name="checkmark-circle-outline" size={15} color="#BDE8CD" /><Text style={styles.completedText}>Completed today</Text></View> : null}
        </View>

        <View style={styles.footer}>
          <Pressable onPress={openStory} hitSlop={16} style={styles.openLink} accessibilityRole="link">
            <Text style={styles.openLinkText}>{story.kind === 'learn' ? 'Open 60 Sec Learn' : 'Open'}</Text><Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.footerHint}>{index + 1} of {data?.items.length || 0}</Text>
        </View>
        <Pressable onPress={previous} style={styles.leftZone} /><Pressable onPress={next} style={styles.rightZone} />
      </>}
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
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#071733', paddingTop: 10, paddingHorizontal: 11, paddingBottom: 14 },
  ambientGlow: { position: 'absolute', left: -80, right: -80, top: 150, bottom: -120, borderRadius: 240, backgroundColor: '#082A62', opacity: 0.62 },
  top: { zIndex: 6 }, progress: { flexDirection: 'row', gap: 4 },
  progressTrack: { flex: 1, height: 3, overflow: 'hidden', borderRadius: 999, backgroundColor: '#40516F' },
  progressFill: { width: '0%', height: '100%', backgroundColor: '#7B73FF' }, progressFillActive: { width: '100%' },
  header: { marginTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandMark: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5B4CE3' },
  brandMarkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, brandTitle: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, brandMeta: { marginTop: 1, color: '#A5AFC0', fontSize: 6.8 },
  close: { width: 29, height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#182A4A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, errorText: { color: '#CDD4E0', fontSize: 10, textAlign: 'center' }, retry: { marginTop: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#4F46C8' }, retryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  content: { zIndex: 4, position: 'absolute', left: 11, right: 11, top: '27%' }, impactContent: { top: '21%' },
  storyIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, toneAttention: { backgroundColor: '#C97A16' }, toneImpact: { backgroundColor: '#0F9A9C' }, toneJourney: { backgroundColor: '#675FD4' }, toneBusiness: { backgroundColor: '#34549C' }, toneLearn: { backgroundColor: '#8E5F1A' }, toneCalm: { backgroundColor: '#49627A' },
  eyebrow: { marginTop: 12, color: '#B8B3FF', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, metric: { marginTop: 7, color: '#FFFFFF', fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.6 },
  title: { marginTop: 3, maxWidth: 340, color: '#FFFFFF', fontSize: 21, lineHeight: 27, fontWeight: '900' }, body: { marginTop: 3, maxWidth: 330, color: '#CBD4E3', fontSize: 10, lineHeight: 16 },
  storyProgressWrap: { marginTop: 14, maxWidth: 330 }, storyProgressTrack: { height: 7, overflow: 'hidden', borderRadius: 999, backgroundColor: '#304A70' }, storyProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#7B73FF' }, storyProgressMeta: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' }, storyProgressText: { color: '#AAB5C7', fontSize: 8 },
  completedPill: { alignSelf: 'flex-start', marginTop: 13, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, backgroundColor: '#18382D' }, completedText: { color: '#BDE8CD', fontSize: 8.5, fontWeight: '800' },
  footer: { position: 'absolute', zIndex: 8, left: 12, right: 12, bottom: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openLink: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingRight: 12 }, openLinkText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' }, footerHint: { color: '#D6DEEB', fontSize: 8 },
  leftZone: { position: 'absolute', zIndex: 2, left: 0, top: 75, bottom: 70, width: '28%' }, rightZone: { position: 'absolute', zIndex: 2, right: 0, top: 75, bottom: 70, width: '28%' },
});
