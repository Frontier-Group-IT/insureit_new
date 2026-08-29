import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { getPartnerBusinessPerformance, type PartnerBusinessPerformance } from '@/lib/business';
import { getPartnerNetwork, type PartnerNetworkData } from '@/lib/network';
import { partnerTheme } from '@/lib/theme';

export default function BusinessScreen() {
  const router = useRouter();
  const [performance, setPerformance] = useState<PartnerBusinessPerformance | null>(null);
  const [network, setNetwork] = useState<PartnerNetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextPerformance, nextNetwork] = await Promise.all([
        getPartnerBusinessPerformance(),
        getPartnerNetwork(),
      ]);
      setPerformance(nextPerformance);
      setNetwork(nextNetwork);
    } catch {
      setError('Your business workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topPartners = useMemo(() => {
    if (!network) return [];
    return [...network.partners]
      .sort((a,b) => Number(b.metrics.premium_this_month || 0) - Number(a.metrics.premium_this_month || 0))
      .slice(0,3);
  }, [network]);

  return (
    <PartnerScreen eyebrow="MY BUSINESS" title="Performance & network">
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : error || !performance || !network ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error || 'Business data is unavailable.'}</Text>
          <Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroHeader}>
              <View>
                <Text style={styles.heroEyebrow}>{monthLabel(performance.current_month).toUpperCase()}</Text>
                <Text style={styles.heroValue}>{formatMoney(performance.premium_this_month)}</Text>
                <Text style={styles.heroLabel}>gross premium</Text>
              </View>
              <TrendBadge
                value={Number(performance.premium_change_percent || 0)}
                hasPrevious={Number(performance.premium_last_month || 0) > 0}
              />
            </View>
            <View style={styles.heroStats}>
              <HeroStat value={performance.policies_this_month} label="Policies" />
              <HeroStat value={performance.total_customers} label="Customers" />
              <HeroStat value={network.total_partners} label={network.total_partners === 1 ? 'Partner family' : 'Partner families'} />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Business trend</Text>
            <Text style={styles.sectionHint}>Last 6 months</Text>
          </View>
          <TrendChart data={performance.trend} />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Business mix</Text>
            <Text style={styles.sectionHint}>Current month</Text>
          </View>
          <View style={styles.mixCard}>
            {performance.business_mix.length ? (
              performance.business_mix.slice(0,5).map((item) => (
                <MixRow
                  key={item.label}
                  label={item.label}
                  premium={Number(item.premium || 0)}
                  policies={item.policies}
                  totalPremium={Number(performance.premium_this_month || 0)}
                />
              ))
            ) : (
              <Text style={styles.noData}>No policy mix has been recorded this month.</Text>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My network</Text>
            <Pressable onPress={() => router.push('/network')}>
              <Text style={styles.sectionAction}>Explore network</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.push('/network')} style={styles.networkCard}>
            <View style={styles.networkVisual}>
              <View style={styles.networkRoot}><Ionicons name="git-network-outline" size={21} color="#FFFFFF" /></View>
              <View style={styles.networkLine} />
              <View style={styles.networkNodes}>
                {Math.max(1, Math.min(network.total_partners,4)) > 0
                  ? Array.from({ length: Math.max(1, Math.min(network.total_partners,4)) }).map((_,index) => <View key={index} style={styles.networkNode} />)
                  : null}
              </View>
            </View>
            <View style={styles.networkCopy}>
              <Text style={styles.networkTitle}>{network.total_partners} Partner {network.total_partners === 1 ? 'family' : 'families'}</Text>
              <Text style={styles.networkText}>
                {network.total_groups > 0
                  ? `${network.total_groups} active Group${network.total_groups === 1 ? '' : 's'} · tap to explore Partner → POSP/MISP relationships.`
                  : 'Tap to explore Partner → POSP/MISP relationships and standalone Partner families.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9AA3B2" />
          </Pressable>

          {topPartners.length ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{performance.scope_mode === 'partner_family' ? 'Partner family' : 'Top contribution'}</Text>
                <Text style={styles.sectionHint}>This month</Text>
              </View>
              <View style={styles.contributionList}>
                {topPartners.map((row,index) => (
                  <View key={row.partner_id} style={styles.contributionRow}>
                    <View style={styles.rank}><Text style={styles.rankText}>{index+1}</Text></View>
                    <View style={styles.contributionBody}>
                      <Text style={styles.contributionName}>{row.partner_name}</Text>
                      <Text style={styles.contributionMeta}>
                        {row.metrics.policies_this_month} policies · {row.metrics.total_customers} customers
                        {row.child_count ? ` · ${row.child_count} POSP/MISP` : ' · standalone'}
                      </Text>
                    </View>
                    <Text style={styles.contributionValue}>{formatMoney(row.metrics.premium_this_month)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </PartnerScreen>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function TrendBadge({ value, hasPrevious }: { value: number; hasPrevious: boolean }) {
  if (!hasPrevious) return <View style={styles.trendBadgeNeutral}><Text style={styles.trendBadgeNeutralText}>New baseline</Text></View>;
  const positive = value >= 0;
  return (
    <View style={[styles.trendBadge, positive ? styles.trendBadgeGood : styles.trendBadgeWarn]}>
      <Ionicons name={positive ? 'trending-up' : 'trending-down'} size={13} color={positive ? partnerTheme.colors.success : partnerTheme.colors.warning} />
      <Text style={[styles.trendBadgeText,{ color: positive ? partnerTheme.colors.success : partnerTheme.colors.warning }]}>
        {Math.abs(value).toFixed(1)}%
      </Text>
    </View>
  );
}

function TrendChart({ data }: { data: PartnerBusinessPerformance['trend'] }) {
  const max = Math.max(1,...data.map((item) => Number(item.premium || 0)));
  return (
    <View style={styles.chartCard}>
      <View style={styles.chart}>
        {data.map((item) => {
          const premium = Number(item.premium || 0);
          const height = Math.max(5,Math.round((premium/max)*76));
          return (
            <View key={item.month} style={styles.barColumn}>
              <Text style={styles.barValue}>{compactMoney(premium)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar,{ height }]} />
              </View>
              <Text style={styles.barMonth}>{shortMonth(item.month)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MixRow({ label, premium, policies, totalPremium }: { label: string; premium: number; policies: number; totalPremium: number }) {
  const percent = totalPremium > 0 ? Math.min(100,(premium/totalPremium)*100) : 0;
  return (
    <View style={styles.mixRow}>
      <View style={styles.mixTop}>
        <Text style={styles.mixLabel}>{humanize(label)}</Text>
        <Text style={styles.mixValue}>{formatMoney(premium)} · {policies} policies</Text>
      </View>
      <View style={styles.mixTrack}><View style={[styles.mixFill,{ width: `${percent}%` }]} /></View>
    </View>
  );
}

function formatMoney(value: number | string) {
  const amount=Number(value||0);
  if(amount>=10000000)return `₹${(amount/10000000).toFixed(1)}Cr`;
  if(amount>=100000)return `₹${(amount/100000).toFixed(1)}L`;
  if(amount>=1000)return `₹${(amount/1000).toFixed(1)}K`;
  return `₹${new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(amount)}`;
}

function compactMoney(value:number){
  if(value>=100000)return `${(value/100000).toFixed(1)}L`;
  if(value>=1000)return `${Math.round(value/1000)}K`;
  return String(Math.round(value));
}

function monthLabel(value:string){
  const [year,month]=value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(new Date(year,month-1,1));
}

function shortMonth(value:string){
  const [year,month]=value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN',{month:'short'}).format(new Date(year,month-1,1));
}

function humanize(value:string){
  return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

const styles=StyleSheet.create({
  loading:{minHeight:300,alignItems:'center',justifyContent:'center'},
  errorCard:{minHeight:190,alignItems:'center',justifyContent:'center',borderRadius:partnerTheme.radius.lg,backgroundColor:partnerTheme.colors.surface},
  errorText:{color:partnerTheme.colors.inkMuted,fontSize:10},
  retry:{marginTop:10,color:partnerTheme.colors.brand,fontSize:10,fontWeight:'800'},

  hero:{borderRadius:partnerTheme.radius.xl,padding:19,backgroundColor:partnerTheme.colors.nav},
  heroHeader:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},
  heroEyebrow:{color:'#AAA5FF',fontSize:8,fontWeight:'800',letterSpacing:1.1},
  heroValue:{marginTop:5,color:'#FFFFFF',fontSize:28,fontWeight:'800'},
  heroLabel:{marginTop:2,color:'#AEB7C5',fontSize:8.5},
  trendBadge:{minHeight:31,flexDirection:'row',alignItems:'center',gap:4,borderRadius:999,paddingHorizontal:9},
  trendBadgeGood:{backgroundColor:'#18382D'},
  trendBadgeWarn:{backgroundColor:'#44341E'},
  trendBadgeText:{fontSize:8.5,fontWeight:'800'},
  trendBadgeNeutral:{borderRadius:999,paddingHorizontal:9,paddingVertical:8,backgroundColor:'#303A4D'},
  trendBadgeNeutralText:{color:'#C7CFDC',fontSize:8},
  heroStats:{marginTop:18,flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#3A4558',paddingTop:13},
  heroStat:{flex:1},
  heroStatValue:{color:'#FFFFFF',fontSize:15,fontWeight:'800'},
  heroStatLabel:{marginTop:3,color:'#9EA9BA',fontSize:7.5,lineHeight:10},

  sectionHeader:{marginTop:21,marginBottom:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  sectionTitle:{color:partnerTheme.colors.ink,fontSize:14,fontWeight:'800'},
  sectionHint:{color:partnerTheme.colors.inkMuted,fontSize:8.5},
  sectionAction:{color:partnerTheme.colors.brand,fontSize:9,fontWeight:'800'},

  chartCard:{borderRadius:18,padding:14,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  chart:{height:126,flexDirection:'row',alignItems:'flex-end',gap:6},
  barColumn:{flex:1,height:'100%',alignItems:'center',justifyContent:'flex-end'},
  barValue:{height:14,color:partnerTheme.colors.inkMuted,fontSize:6.5,fontWeight:'700'},
  barTrack:{height:80,width:'74%',justifyContent:'flex-end',overflow:'hidden',borderRadius:7,backgroundColor:'#F0F2F7'},
  bar:{width:'100%',borderRadius:7,backgroundColor:partnerTheme.colors.brand},
  barMonth:{marginTop:5,color:partnerTheme.colors.inkMuted,fontSize:7.5,fontWeight:'700'},

  mixCard:{borderRadius:18,padding:15,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  mixRow:{marginBottom:13},
  mixTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
  mixLabel:{color:partnerTheme.colors.ink,fontSize:9.5,fontWeight:'800'},
  mixValue:{color:partnerTheme.colors.inkMuted,fontSize:7.5},
  mixTrack:{height:6,marginTop:6,overflow:'hidden',borderRadius:999,backgroundColor:'#ECEFF4'},
  mixFill:{height:'100%',borderRadius:999,backgroundColor:partnerTheme.colors.accent},
  noData:{color:partnerTheme.colors.inkMuted,fontSize:9,textAlign:'center'},

  networkCard:{minHeight:92,flexDirection:'row',alignItems:'center',gap:12,borderRadius:18,padding:14,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  networkVisual:{width:58,height:64,alignItems:'center'},
  networkRoot:{width:34,height:34,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.brandStrong},
  networkLine:{width:1,height:9,backgroundColor:'#C8CFDB'},
  networkNodes:{flexDirection:'row',gap:3},
  networkNode:{width:8,height:8,borderRadius:4,backgroundColor:partnerTheme.colors.accent},
  networkCopy:{flex:1},
  networkTitle:{color:partnerTheme.colors.ink,fontSize:11,fontWeight:'800'},
  networkText:{marginTop:4,color:partnerTheme.colors.inkMuted,fontSize:8.5,lineHeight:13},

  contributionList:{overflow:'hidden',borderRadius:18,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  contributionRow:{minHeight:66,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:13,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:partnerTheme.colors.line},
  rank:{width:28,height:28,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.brandSoft},
  rankText:{color:partnerTheme.colors.brandStrong,fontSize:9,fontWeight:'800'},
  contributionBody:{flex:1},
  contributionName:{color:partnerTheme.colors.ink,fontSize:10,fontWeight:'800'},
  contributionMeta:{marginTop:3,color:partnerTheme.colors.inkMuted,fontSize:7.5},
  contributionValue:{color:partnerTheme.colors.ink,fontSize:9.5,fontWeight:'800'},
});
