import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerRecognition, type PartnerRecognition } from '@/lib/engagement';
import { PartnerAssets } from '@/lib/partner-assets';

type RecognitionItem = PartnerRecognition['items'][number];
const PURPLE = '#6325D7';
const INK = '#101A54';
const RING_COUNT = 120;
const RING_SIZE = 100;
const RING_RADIUS = 41;
const RING_SEGMENTS = Array.from({ length: RING_COUNT }, (_, index) => {
  const angle = (index * 360) / RING_COUNT;
  const radians = angle * Math.PI / 180;
  return {
    left: RING_SIZE / 2 + RING_RADIUS * Math.sin(radians) - 3.7,
    top: RING_SIZE / 2 - RING_RADIUS * Math.cos(radians) - 2.1,
    transform: [{ rotate: `${angle}deg` as `${number}deg` }],
  };
});

export default function RecognitionScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerRecognition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerRecognition());
    } catch {
      setData(null);
      setError('Recognition could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

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
          <View style={styles.sectionHeading}>
            <Ionicons name="star" size={31} color={PURPLE} />
            <Text style={styles.sectionTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76}>Unlocked achievements</Text>
            <View style={styles.headingRule} />
          </View>

          {data.items.length ? (
            <View style={styles.list}>
              {data.items.map((item) => (
                <View key={item.code} style={styles.card}>
                  <View style={styles.artworkTile}>
                    <Image source={milestoneArtwork(item.icon, item.title)} style={styles.achievementArtwork} resizeMode="contain" />
                  </View>
                  <View style={styles.verticalRule} />
                  <View style={styles.achievementHeading}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.supportingText}>A great start!</Text>
                  </View>
                  <View style={styles.achievementMeta}>
                    <View style={styles.earnedPill}>
                      <Ionicons name="checkmark-circle" size={18} color={PURPLE} />
                      <Text style={styles.earnedPillText}>ACHIEVED</Text>
                    </View>
                    {item.date ? (
                      <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={16} color={PURPLE} />
                        <Text style={styles.date}>{formatDate(item.date)}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <PartnerStateView state="empty" title="More highlights will appear here" message="Recognition appears when a recorded milestone is reached." asset={PartnerAssets.status.achievement} />
          )}

          {next ? (
            <View style={styles.nextCard}>
              <View style={styles.artworkTile}>
                <Image source={PartnerAssets.status.achievement} style={styles.achievementArtwork} resizeMode="contain" />
              </View>
              <View style={styles.verticalRule} />
              <View style={styles.nextHeadingText}>
                <Text style={styles.nextEyebrow}>NEXT MILESTONE</Text>
                <Text style={styles.nextTitle}>{next.title}</Text>
                <Text style={styles.supportingText}>{"Keep going, you\'re on track!"}</Text>
              </View>
              <View style={styles.percentGroup}>
                <View style={styles.percentCircle} accessibilityRole="progressbar" accessibilityLabel={next.title}
                  accessibilityValue={{ min: 0, max: Math.max(0, next.target), now: Math.max(0, Math.min(next.current, Math.max(0, next.target))) }}>
                  {RING_SEGMENTS.map((segment, index) => (
                    <View key={index} accessible={false} style={[styles.progressSegment, segment, {
                      backgroundColor: index < Math.round(progress * RING_COUNT) ? PURPLE : '#DED1FB',
                    }]} />
                  ))}
                  <Text style={styles.percentText}>{(progress * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.customersRow}>
                  <Ionicons name="people" size={20} color={PURPLE} />
                  <Text style={styles.currentNumber}>{next.current.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </View>
          ) : null}

          <Pressable accessibilityRole="button" accessibilityLabel="View your full journey"
            style={({ pressed }) => [styles.journeyLink, pressed && styles.journeyLinkPressed]}
            onPress={() => router.push('/journey')}>
            <View style={styles.journeyTint} pointerEvents="none" />
            <Text style={styles.journeyLinkText}>View your full journey</Text>
            <View style={styles.journeyArrow}><Ionicons name="arrow-forward" size={23} color="#FFFFFF" /></View>
          </Pressable>
        </View>
      )}
    </PartnerScreen>
  );
}

function milestoneArtwork(icon: RecognitionItem['icon'], title: string): ImageSourcePropType {
  if (icon === 'learn') return PartnerAssets.actions.policyChecklist;
  if (icon === 'renewal') return PartnerAssets.actions.renewalsReference;
  if (/claim/i.test(title)) return PartnerAssets.actions.quickClaims;
  return PartnerAssets.status.journey;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 28, gap: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  sectionTitle: { color: INK, fontWeight: '800', fontSize: 20, letterSpacing: -0.5 },
  headingRule: { flex: 1, height: 2, backgroundColor: '#8D50D9', marginLeft: 4 },
  list: { gap: 14 },
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 116, paddingHorizontal: 13, paddingVertical: 13, gap: 11, borderRadius: 25, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4DDFC', shadowColor: '#5433B6', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  artworkTile: { width: 69, height: 77, borderRadius: 23, flexShrink: 0, backgroundColor: '#F1EAFE', alignItems: 'center', justifyContent: 'center' },
  achievementArtwork: { width: 65, height: 65 },
  verticalRule: { width: 1, height: 75, backgroundColor: '#CDB5F4' },
  achievementHeading: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: INK },
  supportingText: { color: '#56608F', fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  achievementMeta: { flexShrink: 0, alignItems: 'flex-end', gap: 12 },
  earnedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDE2FF', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 8 },
  earnedPillText: { fontSize: 9, fontWeight: '800', color: '#4E1AC1' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  date: { color: '#435078', fontSize: 10.5, fontWeight: '600' },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 148, paddingHorizontal: 13, paddingVertical: 15, borderRadius: 25, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4DDFC', shadowColor: '#5433B6', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  nextHeadingText: { flex: 1, minWidth: 0, gap: 6 },
  nextEyebrow: { color: PURPLE, fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  nextTitle: { color: INK, fontSize: 19, lineHeight: 24, fontWeight: '800' },
  percentGroup: { width: 101, flexShrink: 0, alignItems: 'center', gap: 4 },
  percentCircle: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  progressSegment: { position: 'absolute', width: 7.4, height: 4.2, borderRadius: 3 },
  percentText: { color: '#241478', fontSize: 18, fontWeight: '800' },
  customersRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currentNumber: { color: INK, fontSize: 19, fontWeight: '800' },
  journeyLink: { marginTop: 3, minHeight: 67, paddingHorizontal: 16, borderRadius: 40, backgroundColor: '#E1CEFA', overflow: 'hidden', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 13 },
  journeyTint: { position: 'absolute', left: '15%', right: '15%', top: 0, bottom: 0, backgroundColor: '#E7DCFF', opacity: 0.65, borderRadius: 40 },
  journeyLinkPressed: { opacity: 0.75 },
  journeyLinkText: { color: '#541BC7', fontSize: 17, fontWeight: '800' },
  journeyArrow: { width: 39, height: 39, borderRadius: 20, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
});
