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
import { partnerTheme } from '@/lib/theme';

type RecognitionItem = PartnerRecognition['items'][number];

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
  const progress = next && next.target > 0
    ? Math.max(0, Math.min(1, next.current / next.target))
    : 0;

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
        <>
          <View style={styles.hero}>
            <View style={styles.heroContent}>
              <View style={styles.trophyTile}>
                <Image source={PartnerAssets.status.achievement} style={styles.heroArtwork} resizeMode="contain" />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>YOUR RECOGNITION</Text>
                <Text style={styles.heroTitle}>Every milestone matters.</Text>
              </View>
            </View>
            <Text style={styles.heroDescription}>
              Celebrate the achievements earned throughout your INSUREIT journey.
            </Text>
            <View style={styles.earnedRow}>
              <Ionicons name="checkmark-circle-outline" color="#A6E7BF" size={18} />
              <Text style={styles.earnedText}>
                {data.items.length.toLocaleString('en-IN')} recorded {data.items.length === 1 ? 'achievement' : 'achievements'}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Unlocked achievements</Text>
            {data.items.length > 0 ? (
              <View style={styles.earnedPill}><Text style={styles.earnedPillText}>ACHIEVED</Text></View>
            ) : null}
          </View>

          {data.items.length ? (
            <View style={styles.list}>
              {data.items.map((item) => {
                const colors = achievementTone(item.tone);
                return (
                  <View key={item.code} style={styles.card}>
                    <View style={styles.achievementTop}>
                      <View style={[styles.artworkTile, { backgroundColor: colors.background }]}>
                        <Image source={milestoneArtwork(item.icon)} style={styles.achievementArtwork} resizeMode="contain" />
                      </View>
                      <View style={styles.achievementHeading}>
                        <Text style={styles.title}>{item.title}</Text>
                        {item.date ? (
                          <View style={styles.dateRow}>
                            <Ionicons name="calendar-outline" size={13} color="#6957C9" />
                            <Text style={styles.date}>{formatDate(item.date)}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.cardDivider} />
                    <Text style={styles.description}>{item.body}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <PartnerStateView state="empty" title="More highlights will appear here" message="Recognition appears when a recorded milestone is reached." asset={PartnerAssets.status.achievement} />
          )}

          {next ? (
            <View style={styles.nextCard}>
              <View style={styles.nextHeading}>
                <View style={styles.nextHeadingText}>
                  <Text style={styles.nextEyebrow}>NEXT MILESTONE</Text>
                  <Text style={styles.nextTitle}>{next.title}</Text>
                </View>
                <Ionicons name="flag-outline" size={22} color="#6856D5" />
              </View>
              <View style={styles.progressNumbers}>
                <View>
                  <Text style={styles.currentNumber}>{next.current.toLocaleString('en-IN')}</Text>
                  <Text style={styles.progressCaption}>Customers achieved</Text>
                </View>
                <View style={styles.percentGroup}>
                  <Text style={styles.percentText}>{(progress * 100).toFixed(1)}%</Text>
                  <Text style={styles.progressCaption}>Completed</Text>
                </View>
              </View>
              <View
                style={styles.track}
                accessibilityRole="progressbar"
                accessibilityLabel={next.title}
                accessibilityValue={{ min: 0, max: Math.max(0, next.target), now: Math.max(0, Math.min(next.current, Math.max(0, next.target))) }}
              >
                <View style={[styles.fill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.remaining}>
                {next.remaining > 0 ? `${next.remaining.toLocaleString('en-IN')} more customers to unlock` : 'Milestone achieved'}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to My Progress"
            style={({ pressed }) => [styles.journeyLink, pressed && styles.journeyLinkPressed]}
            onPress={() => router.push('/journey')}
          >
            <Text style={styles.journeyLinkText}>View your full journey</Text>
            <Ionicons name="arrow-forward" size={17} color="#315E9C" />
          </Pressable>
        </>
      )}
    </PartnerScreen>
  );
}

function milestoneArtwork(icon: RecognitionItem['icon']): ImageSourcePropType {
  if (icon === 'learn') return PartnerAssets.actions.policyChecklist;
  if (icon === 'renewal') return PartnerAssets.actions.renewals;
  return PartnerAssets.status.journey;
}

function achievementTone(tone: RecognitionItem['tone']) {
  if (tone === 'learn') return { background: '#F2ECFF', foreground: '#7754C7' };
  if (tone === 'clear') return { background: '#E7F7EF', foreground: '#13805C' };
  return { background: '#EAF2FF', foreground: '#2866B8' };
}

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

const styles = StyleSheet.create({
  hero: { marginTop: 13, borderRadius: 22, padding: 18, backgroundColor: '#142849' },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  trophyTile: { width: 58, height: 58, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2C4166' },
  heroArtwork: { width: 44, height: 44 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroEyebrow: { color: '#C4B5FD', fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  heroTitle: { marginTop: 5, color: '#FFFFFF', fontSize: 19, lineHeight: 24, fontWeight: '800' },
  heroDescription: { marginTop: 15, color: '#D3DDEF', fontSize: 12, lineHeight: 18 },
  earnedRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  earnedText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 20, marginBottom: 10 },
  sectionTitle: { flex: 1, color: '#151C2B', fontSize: 16, fontWeight: '800' },
  earnedPill: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: '#E9E5FF' },
  earnedPillText: { color: '#604BC5', fontSize: 10, fontWeight: '800', letterSpacing: 0.35 },
  list: { gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 19, padding: 15, borderWidth: 1, borderColor: '#E4E8EF' },
  achievementTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  artworkTile: { width: 56, height: 56, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  achievementArtwork: { width: 40, height: 40 },
  achievementHeading: { flex: 1, minWidth: 0 },
  title: { color: '#1C2638', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  date: { color: '#6957C9', fontSize: 11, fontWeight: '700' },
  cardDivider: { height: 1, marginVertical: 13, backgroundColor: '#E9EDF3' },
  description: { color: '#657186', fontSize: 11.5, lineHeight: 18 },
  nextCard: { marginTop: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8EF', borderRadius: 19, padding: 16 },
  nextHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nextHeadingText: { flex: 1, minWidth: 0 },
  nextEyebrow: { color: '#6856D5', fontSize: 10, letterSpacing: 0.9, fontWeight: '800' },
  nextTitle: { marginTop: 5, color: '#17233A', fontSize: 18, lineHeight: 23, fontWeight: '800' },
  progressNumbers: { marginTop: 19, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  currentNumber: { color: '#17233A', fontSize: 23, fontWeight: '800' },
  percentGroup: { alignItems: 'flex-end' },
  percentText: { color: '#6954D6', fontSize: 21, fontWeight: '800' },
  progressCaption: { color: '#657186', fontSize: 10.5, fontWeight: '600', marginTop: 3 },
  track: { height: 9, borderRadius: 999, overflow: 'hidden', backgroundColor: '#E5E1FA', marginTop: 14 },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#7158DC' },
  remaining: { color: '#57657B', fontSize: 11, fontWeight: '600', marginTop: 11 },
  journeyLink: { marginTop: 12, paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.md, backgroundColor: '#EBF1FA' },
  journeyLinkPressed: { opacity: 0.7 },
  journeyLinkText: { color: '#315E9C', fontSize: 12, fontWeight: '800' },
});
