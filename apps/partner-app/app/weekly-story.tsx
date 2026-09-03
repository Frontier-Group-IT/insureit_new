import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerWeeklyStory, type PartnerWeeklyStory } from '@/lib/engagement';
import { formatIndianCurrency } from '@/lib/format';
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

  useEffect(() => {
    void load();
  }, [load]);

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
        <>
          <View style={styles.hero}>
            <Text style={styles.dates}>{formatDate(data.week_start)} — {formatDate(data.week_end)}</Text>
            <Text style={styles.heroValue}>{formatIndianCurrency(data.premium_this_week)}</Text>
            <Text style={styles.heroLabel}>gross premium recorded this week</Text>
            <View style={styles.heroStats}>
              <Stat value={data.policies_this_week} label="Policies" inverse />
              <Stat value={data.customers_this_week} label="Customers added" inverse />
              <Stat value={data.claims_progressed_this_week} label="Claims progressed" inverse />
            </View>
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Compared with last week</Text></View>
          <View style={styles.compareCard}>
            <View><Text style={styles.compareValue}>{formatIndianCurrency(data.premium_last_week)}</Text><Text style={styles.compareLabel}>last week premium</Text></View>
            <Trend value={Number(data.premium_change_percent || 0)} />
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Coming next</Text></View>
          <View style={styles.nextCard}>
            <View style={styles.nextIcon}><Ionicons name="refresh-outline" size={21} color={partnerTheme.colors.brand} /></View>
            <View style={styles.nextBody}>
              <Text style={styles.nextTitle}>{data.renewals_next_week} renewal{data.renewals_next_week === 1 ? '' : 's'} next week</Text>
              <Text style={styles.nextText}>{formatIndianCurrency(data.renewal_premium_next_week)} gross premium is approaching renewal.</Text>
            </View>
            <Pressable onPress={() => router.push('/renewals')}><Ionicons name="chevron-forward" size={18} color="#9AA3B2" /></Pressable>
          </View>

          <View style={styles.endCard}>
            <Text style={styles.endEyebrow}>WEEKLY REFLECTION</Text>
            <Text style={styles.endTitle}>{data.policies_this_week > 0 ? 'Real progress, recorded.' : 'A quiet week is still useful data.'}</Text>
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function Stat({ value, label, inverse }: { value: number; label: string; inverse?: boolean }) {
  return <View style={styles.stat}><Text style={[styles.statValue, inverse && styles.inverse]}>{value}</Text><Text style={[styles.statLabel, inverse && styles.inverseMuted]}>{label}</Text></View>;
}

function Trend({ value }: { value: number }) {
  const positive = value >= 0;
  return <View style={[styles.trend, { backgroundColor: positive ? '#EAF7EF' : '#FFF2DD' }]}><Ionicons name={positive ? 'trending-up' : 'trending-down'} size={15} color={positive ? partnerTheme.colors.success : partnerTheme.colors.warning} /><Text style={[styles.trendText,{ color: positive ? partnerTheme.colors.success : partnerTheme.colors.warning }]}>{Math.abs(value).toFixed(1)}%</Text></View>;
}

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short'}).format(d);
}

const styles = StyleSheet.create({
  hero:{borderRadius:partnerTheme.radius.xl,padding:15,backgroundColor:partnerTheme.colors.nav},
  dates:{color:'#AAA5FF',fontSize:8,fontWeight:'800',letterSpacing:1},
  heroValue:{marginTop:5,color:'#FFFFFF',fontSize:30,fontWeight:'800'},
  heroLabel:{marginTop:3,color:'#AEB7C5',fontSize:9},
  heroStats:{marginTop:12,paddingTop:10,flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#3A4558'},
  stat:{flex:1},statValue:{color:partnerTheme.colors.ink,fontSize:16,fontWeight:'800'},statLabel:{marginTop:3,color:partnerTheme.colors.inkMuted,fontSize:7.5,lineHeight:10},inverse:{color:'#FFFFFF'},inverseMuted:{color:'#9EA9BA'},
  sectionHeader:{marginTop:15,marginBottom:7},sectionTitle:{color:partnerTheme.colors.ink,fontSize:14,fontWeight:'800'},
  compareCard:{minHeight:62,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderRadius:18,padding:12,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  compareValue:{color:partnerTheme.colors.ink,fontSize:17,fontWeight:'800'},compareLabel:{marginTop:3,color:partnerTheme.colors.inkMuted,fontSize:8},
  trend:{flexDirection:'row',alignItems:'center',gap:5,borderRadius:999,paddingHorizontal:10,paddingVertical:7},trendText:{fontSize:9,fontWeight:'800'},
  nextCard:{minHeight:66,flexDirection:'row',alignItems:'center',gap:11,borderRadius:18,padding:14,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  nextIcon:{width:36,height:36,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.brandSoft},nextBody:{flex:1},nextTitle:{color:partnerTheme.colors.ink,fontSize:10.5,fontWeight:'800'},nextText:{marginTop:4,color:partnerTheme.colors.inkMuted,fontSize:8.5,lineHeight:13},
  endCard:{marginTop:11,borderRadius:partnerTheme.radius.lg,padding:13,backgroundColor:partnerTheme.colors.accentSoft},endEyebrow:{color:'#3C7B78',fontSize:7.5,fontWeight:'800',letterSpacing:1},endTitle:{marginTop:5,color:partnerTheme.colors.ink,fontSize:12,fontWeight:'800'},
});
