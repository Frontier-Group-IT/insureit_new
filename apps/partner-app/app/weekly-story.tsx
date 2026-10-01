import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerWeeklyStory, type PartnerWeeklyStory } from '@/lib/engagement';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function WeeklyStoryScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerWeeklyStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerWeeklyStory());
    } catch {
      setData(null);
      setError('Your weekly summary could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <PartnerScreen eyebrow="YOUR WEEK" title="A week with INSUREIT" onBack={() => router.back()}>
      {loading ? (
        <PartnerStateView state="loading" title="Loading your week" />
      ) : error || !data ? (
        <PartnerStateView
          state="error"
          title="Your week is temporarily unavailable"
          message={error || 'Your weekly summary could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <View style={styles.pageBody}>
          <View style={styles.hero}>
            <View pointerEvents="none" style={styles.heroGlowLarge} />
            <View pointerEvents="none" style={styles.heroGlowSmall} />

            <View style={styles.heroTopRow}>
              <Text style={styles.dates}>{formatDate(data.week_start)} – {formatDate(data.week_end)}</Text>
              <View style={styles.periodPill}>
                <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
                <Text style={styles.periodPillText}>This Week</Text>
              </View>
            </View>

            <View style={styles.heroMainRow}>
              <View style={styles.heroCopy}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.heroValue}>
                  {formatIndianCurrency(data.premium_this_week)}
                </Text>
                <Text style={styles.heroLabel}>Gross premium recorded this week</Text>
              </View>
              <GrowthBars />
            </View>

            <View style={styles.heroDivider} />
            <View style={styles.heroStats}>
              <HeroStat icon="document-text" iconBackground="#6267E9" value={data.policies_this_week} label="Policies" />
              <View style={styles.statDivider} />
              <HeroStat icon="people" iconBackground="#28A790" value={data.customers_this_week} label="Customers added" />
              <View style={styles.statDivider} />
              <HeroStat icon="shield-checkmark" iconBackground="#D96C47" value={data.claims_progressed_this_week} label="Claims progressed" />
            </View>
          </View>

          <View style={styles.compareCard}>
            <View style={styles.compareHeader}>
              <Text style={styles.sectionTitle}>Compared with last week</Text>
              <View style={styles.rangePill} accessibilityLabel="Comparison period: last 7 days">
                <Ionicons name="calendar-outline" size={14} color="#33415F" />
                <Text style={styles.rangePillText}>Last 7 days</Text>
                <Ionicons name="chevron-down" size={14} color="#33415F" />
              </View>
            </View>

            <View style={styles.compareBody}>
              <View style={styles.previousMetric}>
                <View style={styles.compareIcon}><MiniBars /></View>
                <View style={styles.previousCopy}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.compareValue}>{formatIndianCurrency(data.premium_last_week)}</Text>
                  <Text style={styles.compareLabel}>Last week premium</Text>
                </View>
              </View>
              <View style={styles.compareDivider} />
              <Trend value={Number(data.premium_change_percent || 0)} />
            </View>
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Coming next</Text></View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open renewals"
            onPress={() => router.push('/renewals')}
            style={({ pressed }) => [styles.nextCard, pressed && styles.cardPressed]}
          >
            <View style={styles.nextIcon}>
              <Image source={PartnerAssets.actions.renewals} style={styles.nextArtwork} resizeMode="contain" />
              <View style={styles.clockBadge}><Ionicons name="time" size={12} color="#FFFFFF" /></View>
            </View>
            <View style={styles.nextBody}>
              <Text style={styles.nextTitle}>{data.renewals_next_week} renewal{data.renewals_next_week === 1 ? '' : 's'} next week</Text>
              <Text style={styles.nextText}>{formatIndianCurrency(data.renewal_premium_next_week)} gross premium is approaching renewal.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#0F3D8A" />
          </Pressable>

          <View style={styles.endCard}>
            <View pointerEvents="none" style={styles.reflectionGlow} />
            <View style={styles.reflectionIcon}><Ionicons name="document-text-outline" size={22} color="#079A87" /></View>
            <View style={styles.reflectionCopy}>
              <Text style={styles.endEyebrow}>WEEKLY REFLECTION</Text>
              <Text style={styles.endTitle}>{data.policies_this_week > 0 ? 'Real progress, recorded.' : 'A quiet week is still useful data.'}</Text>
              <Text style={styles.endText}>{data.policies_this_week > 0 ? 'Keep up the good work and continue building momentum this week.' : 'Use the signals from this week to focus the next conversation and opportunity.'}</Text>
            </View>
            <ReflectionGrowth />
          </View>
        </View>
      )}
    </PartnerScreen>
  );
}

function HeroStat({ icon, iconBackground, value, label }: { icon: 'document-text' | 'people' | 'shield-checkmark'; iconBackground: string; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: iconBackground }]}><Ionicons name={icon} size={20} color="#FFFFFF" /></View>
      <View style={styles.statCopy}><Text style={styles.statValue}>{value}</Text><Text numberOfLines={1} style={styles.statLabel}>{label}</Text></View>
    </View>
  );
}

function Trend({ value }: { value: number }) {
  const positive = value >= 0;
  const color = positive ? '#14845F' : '#D52234';
  const backgroundColor = positive ? '#EAF8F2' : '#FFF0F2';
  return (
    <View style={[styles.trend, { backgroundColor }]}>
      <Ionicons name={positive ? 'trending-up' : 'trending-down'} size={24} color={color} />
      <View><Text style={[styles.trendValue, { color }]}>{Math.abs(value).toFixed(1)}%</Text><Text style={[styles.trendCaption, { color }]}>{positive ? 'Higher than last week' : 'Lower than last week'}</Text></View>
    </View>
  );
}

function GrowthBars() {
  const heights = [22, 34, 48, 38, 50, 68];
  return <View pointerEvents="none" style={styles.growthBars}>{heights.map((height, index) => <View key={`${height}-${index}`} style={[styles.growthBar, { height, opacity: 0.7 + index * 0.05 }]} />)}</View>;
}

function MiniBars() {
  return <View style={styles.miniBars}><View style={[styles.miniBar, { height: 10 }]} /><View style={[styles.miniBar, { height: 16 }]} /><View style={[styles.miniBar, { height: 23 }]} /></View>;
}

function ReflectionGrowth() {
  return (
    <View pointerEvents="none" style={styles.reflectionGrowth}>
      <Ionicons name="arrow-up-outline" size={28} color="#69CFC2" style={styles.reflectionArrow} />
      <View style={styles.reflectionBars}><View style={[styles.reflectionBar, { height: 18, opacity: 0.28 }]} /><View style={[styles.reflectionBar, { height: 31, opacity: 0.42 }]} /><View style={[styles.reflectionBar, { height: 48, opacity: 0.58 }]} /></View>
    </View>
  );
}

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(d);
}

const styles = StyleSheet.create({
  pageBody: { gap: 0, paddingTop: 2 },
  hero: { position: 'relative', overflow: 'hidden', minHeight: 192, borderRadius: 18, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 15, backgroundColor: '#0756BE', shadowColor: '#0A3D8A', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  heroGlowLarge: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -68, top: -156, backgroundColor: 'rgba(20, 116, 235, 0.52)' },
  heroGlowSmall: { position: 'absolute', width: 188, height: 188, borderRadius: 94, right: 28, top: -120, backgroundColor: 'rgba(43, 137, 245, 0.22)' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dates: { flex: 1, color: '#B9D5FF', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  periodPill: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(78, 156, 244, 0.44)' },
  periodPillText: { color: '#FFFFFF', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  heroMainRow: { minHeight: 78, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  heroCopy: { flex: 1, minWidth: 0, paddingTop: 7, paddingBottom: 5 },
  heroValue: { color: '#FFFFFF', fontSize: 31, lineHeight: 37, fontWeight: '800', letterSpacing: -0.8 },
  heroLabel: { marginTop: 3, color: '#E7F1FF', fontSize: 12, lineHeight: 17, fontWeight: '500' },
  growthBars: { width: 140, height: 72, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 7 },
  growthBar: { width: 17, borderRadius: 6, backgroundColor: '#BBDDFF', shadowColor: '#FFFFFF', shadowOpacity: 0.24, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  heroDivider: { height: StyleSheet.hairlineWidth, marginTop: 4, backgroundColor: 'rgba(210, 231, 255, 0.34)' },
  heroStats: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingTop: 12 },
  stat: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statCopy: { flex: 1, minWidth: 0 },
  statValue: { color: '#FFFFFF', fontSize: 18, lineHeight: 21, fontWeight: '800' },
  statLabel: { marginTop: 1, color: '#E2EEFF', fontSize: 9.5, lineHeight: 13, fontWeight: '500' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 38, marginHorizontal: 13, backgroundColor: 'rgba(218, 235, 255, 0.30)' },
  compareCard: { marginTop: 18, borderRadius: 16, paddingHorizontal: 15, paddingTop: 13, paddingBottom: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EAF2', shadowColor: '#163565', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  compareHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionHeader: { marginTop: 19, marginBottom: 9, paddingHorizontal: 3 },
  sectionTitle: { flexShrink: 1, color: '#07142F', fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: -0.2 },
  rangePill: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#E1E6EF', backgroundColor: '#FFFFFF' },
  rangePillText: { color: '#1B2944', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  compareBody: { minHeight: 69, marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  previousMetric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 13 },
  compareIcon: { width: 47, height: 47, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EAFE' },
  miniBars: { height: 25, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  miniBar: { width: 5, borderRadius: 3, backgroundColor: '#7D5CF3' },
  previousCopy: { flex: 1, minWidth: 0 },
  compareValue: { color: '#07142F', fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.25 },
  compareLabel: { marginTop: 3, color: '#77839A', fontSize: 10.5, lineHeight: 14, fontWeight: '500' },
  compareDivider: { width: StyleSheet.hairlineWidth, height: 48, marginHorizontal: 12, backgroundColor: '#DCE2EC' },
  trend: { width: 144, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 12 },
  trendValue: { fontSize: 15, lineHeight: 19, fontWeight: '800' },
  trendCaption: { marginTop: 2, fontSize: 9.5, lineHeight: 12, fontWeight: '500' },
  nextCard: { minHeight: 79, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E7F0', shadowColor: '#163565', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardPressed: { opacity: 0.72 },
  nextIcon: { position: 'relative', width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F1FF' },
  nextArtwork: { width: 34, height: 34 },
  clockBadge: { position: 'absolute', right: 4, bottom: 4, width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3C87E8', borderWidth: 1.5, borderColor: '#E6F1FF' },
  nextBody: { flex: 1, minWidth: 0 },
  nextTitle: { color: '#07142F', fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  nextText: { marginTop: 5, color: '#65728C', fontSize: 10.5, lineHeight: 15, fontWeight: '500' },
  endCard: { position: 'relative', overflow: 'hidden', minHeight: 104, marginTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 16, backgroundColor: '#EAF9F7', borderWidth: 1, borderColor: '#CEECE8' },
  reflectionGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -62, top: -72, backgroundColor: 'rgba(196, 242, 235, 0.55)' },
  reflectionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7F4EF' },
  reflectionCopy: { flex: 1, minWidth: 0, paddingTop: 2, paddingRight: 72 },
  endEyebrow: { color: '#31877E', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.65 },
  endTitle: { marginTop: 4, color: '#07142F', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  endText: { marginTop: 3, color: '#61738A', fontSize: 10.5, lineHeight: 15, fontWeight: '500' },
  reflectionGrowth: { position: 'absolute', right: 15, bottom: 12, width: 74, height: 68, justifyContent: 'flex-end', alignItems: 'flex-end' },
  reflectionArrow: { position: 'absolute', right: 2, top: 0, transform: [{ rotate: '36deg' }] },
  reflectionBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  reflectionBar: { width: 12, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#64CFC1' },
});
