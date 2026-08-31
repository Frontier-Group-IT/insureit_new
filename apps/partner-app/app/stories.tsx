import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getPartnerStories, type PartnerStory, type PartnerStoriesData } from '@/lib/stories';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';

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
          <Pressable onPress={() => router.back()} style={styles.close}>
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
              <Ionicons name={storyIcon(story.kind)} size={25} color="#FFFFFF" />
            </View>

            <Text style={styles.eyebrow}>{story.eyebrow}</Text>

            {story.metric !== undefined ? (
              <Text style={styles.metric}>{formatMetric(story)}</Text>
            ) : null}

            <Text style={styles.title}>{story.title}</Text>
            <Text style={styles.body}>{story.body}</Text>

            {story.progress_current !== undefined && story.progress_target ? (
              <View style={styles.storyProgressWrap}>
                <View style={styles.storyProgressTrack}>
                  <View
                    style={[
                      styles.storyProgressFill,
                      { width: `${Math.min(100, Math.max(0, (story.progress_current / story.progress_target) * 100))}%` },
                    ]}
                  />
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
            <Pressable onPress={openStory} style={styles.openButton}>
              <Text style={styles.openButtonText}>{story.kind === 'learn' ? 'Open 60 Sec Learn' : 'Open'}</Text>
              <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.footerHint}>{index + 1} of {data?.items.length || 0}</Text>
          </View>

          <Pressable onPress={previous} style={styles.leftZone} />
          <Pressable onPress={next} style={styles.rightZone} />
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
  if (story.metric_label?.toLowerCase().includes('idv') || story.metric_label?.toLowerCase().includes('premium')) {
    return formatIndianCurrency(value);
  }
  return String(story.metric);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101827', paddingTop: 38, paddingHorizontal: 16, paddingBottom: 18 },
  top: { zIndex: 4 },
  progress: { flexDirection: 'row', gap: 4 },
  progressTrack: { flex: 1, height: 3, overflow: 'hidden', borderRadius: 999, backgroundColor: '#344055' },
  progressFill: { width: '0%', height: '100%', backgroundColor: '#FFFFFF' },
  progressFillActive: { width: '100%' },
  header: { marginTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4F46C8' },
  brandMarkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  brandTitle: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  brandMeta: { marginTop: 2, color: '#929DB0', fontSize: 7.5 },
  close: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#202B3D' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#CDD4E0', fontSize: 10, textAlign: 'center' },
  retry: { marginTop: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#4F46C8' },
  retryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },

  content: { zIndex: 2, flex: 1, justifyContent: 'center', paddingHorizontal: 4, paddingBottom: 42 },
  storyIcon: { width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  toneAttention: { backgroundColor: '#A5681B' },
  toneImpact: { backgroundColor: '#0F8B8D' },
  toneJourney: { backgroundColor: '#675FD4' },
  toneBusiness: { backgroundColor: '#34549C' },
  toneLearn: { backgroundColor: '#8E5F1A' },
  toneCalm: { backgroundColor: '#49627A' },
  eyebrow: { marginTop: 14, color: '#AAA5FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  metric: { marginTop: 7, color: '#FFFFFF', fontSize: 36, fontWeight: '900', letterSpacing: -0.8 },
  title: { marginTop: 7, maxWidth: 340, color: '#FFFFFF', fontSize: 25, lineHeight: 32, fontWeight: '900' },
  body: { marginTop: 8, maxWidth: 330, color: '#B7C0CF', fontSize: 11, lineHeight: 18 },

  storyProgressWrap: { marginTop: 15, maxWidth: 330 },
  storyProgressTrack: { height: 8, overflow: 'hidden', borderRadius: 999, backgroundColor: '#303C50' },
  storyProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#8E87FF' },
  storyProgressMeta: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  storyProgressText: { color: '#97A3B6', fontSize: 8 },

  completedPill: { alignSelf: 'flex-start', marginTop: 13, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, backgroundColor: '#18382D' },
  completedText: { color: '#BDE8CD', fontSize: 8.5, fontWeight: '800' },

  footer: { zIndex: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 14, paddingHorizontal: 16, backgroundColor: '#4F46C8' },
  openButtonText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  footerHint: { color: '#8490A3', fontSize: 8.5 },

  leftZone: { position: 'absolute', zIndex: 1, left: 0, top: 120, bottom: 90, width: '28%' },
  rightZone: { position: 'absolute', zIndex: 1, right: 0, top: 120, bottom: 90, width: '28%' },
});
