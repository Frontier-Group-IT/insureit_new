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
                <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>Every milestone matters.</Text>
              </View>
              <View style={styles.earnedCount} accessibilityLabel={`${data.items.length} recorded achievements`}>
                <Text style={styles.earnedNumber}>{data.items.length.toLocaleString('en-IN')}</Text>
                <Text style={styles.earnedLabel}>{data.items.length === 1 ? 'Recorded achievement' : 'Recorded achievements'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Unlocked achievements</Text>
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
                      </View>
                      <View style={styles.achievementMeta}>
                        <View style={styles.earnedPill}><Text style={styles.earnedPillText}>ACHIEVED</Text></View>
                        {item.date ? <Text style={styles.date}>{formatDate(item.date)}</Text> : null}
                      </View>
                    </View>
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
                <View style={styles.percentGroup}>
                  <View
                    style={styles.percentCircle}
                    accessibilityRole="progressbar"
                    accessibilityLabel={next.title}
                    accessibilityValue={{ min: 0, max: Math.max(0, next.target), now: Math.max(0, Math.min(next.current, Math.max(0, next.target))) }}
                  >
                    <Text style={styles.percentText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>{(progress * 100).toFixed(1)}%</Text>
                  </View>
                  <Text style={styles.currentNumber}>{next.current.toLocaleString('en-IN')}</Text>
                </View>
              </View>
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
  hero: { marginHorizontal: -partnerTheme.spacing.lg, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: partnerTheme.spacing.lg, paddingVertical: 16 },
  trophyTile: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF2FA' },
  heroArtwork: { width: 39, height: 39 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroEyebrow: { color: '#6856C9', fontSize: 9, letterSpacing: 0.7, fontWeight: '800' },
  heroTitle: { marginTop: 4, color: '#17233A', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  earnedCount: { alignItems: 'center', justifyContent: 'center', width: 64, flexShrink: 0 },
  earnedNumber: { color: '#16805B', fontSize: 18, lineHeight: 22, fontWeight: '800' },
  earnedLabel: { color: '#56657C', fontSize: 8, lineHeight: 11, fontWeight: '700', textAlign: 'center' },
  sectionHeading: { marginTop: 15, marginBottom: 9 },
  sectionTitle: { color: '#151C2B', fontSize: 16, fontWeight: '800' },
  earnedPill: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#E9E5FF' },
  earnedPillText: { color: '#604BC5', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  list: { gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 12, borderWidth: 1, borderColor: '#E4E8EF' },
  achievementTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  artworkTile: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  achievementArtwork: { width: 36, height: 36 },
  achievementHeading: { flex: 1, minWidth: 0 },
  title: { color: '#1C2638', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  achievementMeta: { alignItems: 'flex-end', justifyContent: 'center', gap: 7, maxWidth: '39%' },
  date: { color: '#6957C9', fontSize: 10, fontWeight: '700', textAlign: 'right' },
  nextCard: { marginTop: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8EF', borderRadius: 17, padding: 12 },
  nextHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  nextHeadingText: { flex: 1, minWidth: 0 },
  nextEyebrow: { color: '#6856D5', fontSize: 10, letterSpacing: 0.8, fontWeight: '800' },
  nextTitle: { marginTop: 5, color: '#17233A', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  percentGroup: { alignItems: 'center', justifyContent: 'center', gap: 5 },
  percentCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2.5, borderColor: '#7158DC', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F4FF' },
  percentText: { color: '#6954D6', fontSize: 7, lineHeight: 10, fontWeight: '800', textAlign: 'center', includeFontPadding: false },
  currentNumber: { color: '#17233A', fontSize: 15, fontWeight: '800' },
  journeyLink: { marginTop: 12, paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.md, backgroundColor: '#EBF1FA' },
  journeyLinkPressed: { opacity: 0.7 },
  journeyLinkText: { color: '#315E9C', fontSize: 12, fontWeight: '800' },
});
