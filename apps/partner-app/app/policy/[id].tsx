import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { getPartnerPolicyDetail, type PartnerPolicyDetail } from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';

export default function PolicyDetailScreen() {
  const router=useRouter();
  const { id }=useLocalSearchParams<{id:string}>();
  const [data,setData]=useState<PartnerPolicyDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    if(!id)return;
    setLoading(true);setError('');
    try{setData(await getPartnerPolicyDetail(id));}
    catch{setError('This policy could not be loaded in your Partner scope.');}
    finally{setLoading(false);}
  },[id]);

  useEffect(()=>{void load();},[load]);

  return (
    <PartnerScreen eyebrow="POLICY" title={data?.policy.policy_no||data?.policy.policy_code||'Policy'} action={
      <PartnerIconButton icon="close" label="Close policy detail" onPress={() => router.back()} />
    }>
      {loading?<View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand}/></View>:error||!data?(
        <View style={styles.errorCard}><Text style={styles.errorText}>{error||'Policy unavailable.'}</Text><Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable></View>
      ):(
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}><Ionicons name="document-text-outline" size={21} color="#FFFFFF"/></View>
              <View style={styles.heroBody}>
                <Text style={styles.heroNo}>{data.policy.policy_no||data.policy.policy_code||'Policy'}</Text>
                <Text style={styles.heroInsurer}>{data.insurer.name||'Insurer not recorded'}</Text>
              </View>
              <LifecycleBadge value={data.policy.lifecycle_status}/>
            </View>
            <View style={styles.heroPremiumRow}>
              <View>
                <Text style={styles.heroPremium}>{formatMoney(data.premium.gross_premium)}</Text>
                <Text style={styles.heroPremiumLabel}>gross premium</Text>
              </View>
              <View style={styles.heroDateBlock}>
                <Text style={styles.heroDate}>{formatDate(data.policy.start_date)} → {formatDate(data.policy.end_date)}</Text>
                <Text style={styles.heroDateLabel}>{data.policy.business_type||data.policy.policy_product||data.policy.policy_type||'Policy term'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickRow}>
            {data.customer.id?<Pressable onPress={()=>router.push(`/customer/${data.customer.id}` as never)} style={styles.quick}><Ionicons name="person-outline" size={17} color={partnerTheme.colors.brand}/><Text style={styles.quickText}>Customer</Text></Pressable>:null}
            <Pressable onPress={()=>router.push('/renewals')} style={styles.quick}><Ionicons name="refresh-outline" size={17} color={partnerTheme.colors.brand}/><Text style={styles.quickText}>Renewals</Text></Pressable>
            <Pressable onPress={()=>router.push('/policy-intakes')} style={styles.quick}><Ionicons name="cloud-upload-outline" size={17} color={partnerTheme.colors.brand}/><Text style={styles.quickText}>Intakes</Text></Pressable>
          </View>

          <Section title="Policy overview">
            <Info label="Product" value={data.policy.policy_product||data.policy.policy_type||data.policy.business_line||'Not recorded'}/>
            <Info label="Business type" value={data.policy.business_type||'Not recorded'}/>
            <Info label="Issuance" value={formatDate(data.policy.issuance_date)}/>
            <Info label="IDV" value={data.policy.insured_declared_value!=null?formatMoney(data.policy.insured_declared_value):'Not recorded'}/>
          </Section>

          <Section title="Premium breakup">
            <Info label="Gross premium" value={formatMoney(data.premium.gross_premium)}/>
            <Info label="Net premium" value={nullableMoney(data.premium.net_premium)}/>
            <Info label="OD premium" value={nullableMoney(data.premium.od_premium)}/>
            <Info label="TP premium" value={nullableMoney(data.premium.tp_premium)}/>
            <Info label="GST" value={nullableMoney(data.premium.gst_amount)}/>
            <Info label="CPA" value={data.premium.cpa_opted?nullableMoney(data.premium.cpa_amount):'Not opted / not recorded'}/>
          </Section>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Customer & vehicle</Text></View>
          <View style={styles.entityStack}>
            <Pressable disabled={!data.customer.id} onPress={()=>data.customer.id?router.push(`/customer/${data.customer.id}` as never):undefined} style={styles.entity}>
              <View style={styles.entityIcon}><Ionicons name="person-outline" size={18} color={partnerTheme.colors.brand}/></View>
              <View style={styles.entityBody}><Text style={styles.entityTitle}>{data.customer.name}</Text><Text style={styles.entityMeta}>{data.customer.customer_code||'Customer'}</Text></View>
              {data.customer.id?<Ionicons name="chevron-forward" size={16} color="#9AA3B2"/>:null}
            </Pressable>
            {data.vehicle?<View style={styles.entity}>
              <View style={styles.entityIcon}><Ionicons name="car-outline" size={18} color={partnerTheme.colors.accent}/></View>
              <View style={styles.entityBody}><Text style={styles.entityTitle}>{data.vehicle.vehicle_no||'Vehicle'}</Text><Text style={styles.entityMeta}>{[data.vehicle.make,data.vehicle.model,data.vehicle.year].filter(Boolean).join(' · ')||humanize(data.vehicle.vehicle_type||'vehicle')}</Text></View>
            </View>:null}
          </View>

          <Section title="Commercial attribution">
            <Info label="Intermediary" value={[humanize(data.commercial.intermediary_type||''),data.commercial.intermediary_code].filter(Boolean).join(' · ')||'Not recorded'}/>
            <Info label="RM" value={data.commercial.rm_name||'Not recorded'}/>
            <Info label="Group" value={[data.commercial.group_name,data.commercial.group_code].filter(Boolean).join(' · ')||'No policy snapshot'}/>
            <Info label="Status" value={humanize(data.policy.status||data.policy.lifecycle_status)}/>
          </Section>
        </>
      )}
    </PartnerScreen>
  );
}

function Section({title,children}:{title:string;children:React.ReactNode}){return <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text></View><View style={styles.infoCard}>{children}</View></>;}
function Info({label,value}:{label:string;value:string}){return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;}
function LifecycleBadge({value}:{value:PartnerPolicyDetail['policy']['lifecycle_status']}){const s=value==='expired'?styles.badgeBad:value==='expiring'?styles.badgeWarn:value==='upcoming'?styles.badgeBlue:styles.badgeGood;return <Text style={[styles.badge,s]}>{humanize(value)}</Text>;}
function humanize(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());}
function formatDate(value:string|null){if(!value)return '—';const d=new Date(`${value}T00:00:00`);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'2-digit'}).format(d);}
function formatMoney(value:number|string|null){const n=Number(value??0);return `₹${new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(Number.isFinite(n)?n:0)}`;}
function nullableMoney(value:number|string|null){return value==null?'Not recorded':formatMoney(value);}

const styles=StyleSheet.create({
  close:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  loading:{minHeight:280,alignItems:'center',justifyContent:'center'},
  errorCard:{minHeight:190,alignItems:'center',justifyContent:'center',borderRadius:partnerTheme.radius.lg,backgroundColor:partnerTheme.colors.surface},
  errorText:{color:partnerTheme.colors.inkMuted,fontSize:10,textAlign:'center'},
  retry:{marginTop:10,color:partnerTheme.colors.brand,fontSize:10,fontWeight:'800'},
  hero:{borderRadius:partnerTheme.radius.xl,padding:18,backgroundColor:partnerTheme.colors.nav},
  heroTop:{flexDirection:'row',alignItems:'center',gap:11},
  heroIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#343D52'},
  heroBody:{flex:1},
  heroNo:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},
  heroInsurer:{marginTop:3,color:'#B9C2D0',fontSize:8.5},
  badge:{overflow:'hidden',borderRadius:999,paddingHorizontal:8,paddingVertical:5,fontSize:7.5,fontWeight:'800'},
  badgeGood:{color:'#BDE8CD',backgroundColor:'#18382D'},badgeWarn:{color:'#F0CB90',backgroundColor:'#44341E'},badgeBad:{color:'#F3B8B2',backgroundColor:'#48211F'},badgeBlue:{color:'#B8D1F5',backgroundColor:'#233A5E'},
  heroPremiumRow:{marginTop:18,paddingTop:14,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#3A4558'},
  heroPremium:{color:'#FFFFFF',fontSize:24,fontWeight:'900'},heroPremiumLabel:{marginTop:2,color:'#8F9BAD',fontSize:7.5},
  heroDateBlock:{flex:1,alignItems:'flex-end'},heroDate:{color:'#D4DAE4',fontSize:8.5,fontWeight:'700'},heroDateLabel:{marginTop:3,color:'#8F9BAD',fontSize:7.5},
  quickRow:{marginTop:11,flexDirection:'row',gap:8},
  quick:{flex:1,minHeight:51,alignItems:'center',justifyContent:'center',gap:4,borderRadius:14,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  quickText:{color:partnerTheme.colors.ink,fontSize:7.8,fontWeight:'800'},
  sectionHeader:{marginTop:20,marginBottom:8},
  sectionTitle:{color:partnerTheme.colors.ink,fontSize:13.5,fontWeight:'800'},
  infoCard:{flexDirection:'row',flexWrap:'wrap',rowGap:13,borderRadius:17,padding:15,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  info:{width:'50%',paddingRight:8},infoLabel:{color:'#8A94A6',fontSize:7,fontWeight:'800',textTransform:'uppercase',letterSpacing:0.5},infoValue:{marginTop:3,color:partnerTheme.colors.ink,fontSize:9,fontWeight:'600',lineHeight:13},
  entityStack:{gap:8},entity:{minHeight:68,flexDirection:'row',alignItems:'center',gap:10,borderRadius:16,paddingHorizontal:12,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  entityIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.surfaceMuted},entityBody:{flex:1},entityTitle:{color:partnerTheme.colors.ink,fontSize:10.5,fontWeight:'800'},entityMeta:{marginTop:3,color:partnerTheme.colors.inkMuted,fontSize:8},
});
