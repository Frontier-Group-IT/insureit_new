import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { getPartnerClaimDetail, type PartnerClaimDetail } from '@/lib/claims';
import { partnerTheme } from '@/lib/theme';

type TimelineItem={key:string;title:string;date:string;kind:'created'|'status'|'stage'};

export default function ClaimDetailScreen(){
  const router=useRouter();
  const {id}=useLocalSearchParams<{id:string}>();
  const [data,setData]=useState<PartnerClaimDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    if(!id)return;
    setLoading(true);setError('');
    try{setData(await getPartnerClaimDetail(id));}
    catch{setError('This claim could not be loaded in your Partner scope.');}
    finally{setLoading(false);}
  },[id]);

  useEffect(()=>{void load();},[load]);

  const timeline=useMemo<TimelineItem[]>(()=>{
    if(!data)return[];
    const items:TimelineItem[]=[{key:'created',title:'Claim recorded',date:data.claim.created_at,kind:'created'}];
    for(const item of data.status_history)items.push({key:`status-${item.id}`,title:item.to_status||'Status updated',date:item.created_at,kind:'status'});
    for(const item of data.stages)items.push({key:`stage-${item.id}`,title:humanize(item.stage),date:item.created_at,kind:'stage'});
    return items.sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
  },[data]);

  return <PartnerScreen eyebrow="CLAIM JOURNEY" title={data?.claim.claim_no||'Claim'} action={
    <PartnerIconButton icon="close" label="Close claim detail" onPress={() => router.back()} />
  }>
    {loading?<View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand}/></View>:error||!data?(
      <View style={styles.errorCard}><Text style={styles.errorText}>{error||'Claim unavailable.'}</Text><Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable></View>
    ):(
      <>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>CURRENT STATUS</Text>
          <Text style={styles.heroStatus}>{data.claim.current_status||'Status not recorded'}</Text>
          <Text style={styles.heroMeta}>{data.customer.name}{data.vehicle.vehicle_no?` · ${data.vehicle.vehicle_no}`:''}</Text>
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>{data.insurer.name||'Insurer not recorded'}</Text>
            <Text style={styles.heroFooterText}>{humanize(data.claim.claim_service_mode||'service mode not recorded')}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={()=>router.push(`/customer/${data.customer.id}` as never)} style={styles.action}><Ionicons name="person-outline" size={17} color={partnerTheme.colors.brand}/><Text style={styles.actionText}>Customer</Text></Pressable>
          <Pressable onPress={()=>router.push('/(tabs)/claims')} style={styles.action}><Ionicons name="shield-outline" size={17} color={partnerTheme.colors.brand}/><Text style={styles.actionText}>Claim book</Text></Pressable>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Claim overview</Text></View>
        <View style={styles.infoCard}>
          <Info label="Insurer claim no." value={data.claim.insurer_claim_no||'Not recorded'}/>
          <Info label="Policy" value={data.policy.policy_no||'External policy'}/>
          <Info label="Accident date" value={formatDateTime(data.claim.accident_at)}/>
          <Info label="Location" value={data.claim.accident_location||'Not recorded'}/>
          <Info label="Assistance" value={humanize(data.claim.assistance_status||'not requested')}/>
          <Info label="Last updated" value={formatDateTime(data.claim.updated_at)}/>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Financial snapshot</Text></View>
        <View style={styles.amountRow}>
          <Amount label="Estimated loss" value={data.claim.estimated_loss}/>
          <Amount label="Approved" value={data.claim.approved_amount}/>
          <Amount label="Settlement" value={data.claim.settlement_amount}/>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Journey</Text><Text style={styles.sectionHint}>{timeline.length} recorded events</Text></View>
        {timeline.length?(
          <View style={styles.timeline}>
            {timeline.map((item,index)=>(
              <View key={item.key} style={styles.timelineRow}>
                <View style={styles.rail}>
                  <View style={[styles.dot,index===timeline.length-1&&styles.dotLatest]}>{item.kind==='stage'?<View style={styles.innerDot}/>:null}</View>
                  {index<timeline.length-1?<View style={styles.line}/>:null}
                </View>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineDate}>{formatDateTime(item.date)}</Text>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineKind}>{item.kind==='status'?'Status update':item.kind==='stage'?'Claim stage':'Claim created'}</Text>
                </View>
              </View>
            ))}
          </View>
        ):<View style={styles.empty}><Text style={styles.emptyText}>No journey events are recorded yet.</Text></View>}

        <View style={styles.note}><Ionicons name="information-circle-outline" size={15} color={partnerTheme.colors.accent}/><Text style={styles.noteText}>This timeline exposes recorded status and stage events only. Internal notes are not shown in the Partner app.</Text></View>
      </>
    )}
  </PartnerScreen>;
}

function Info({label,value}:{label:string;value:string}){return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;}
function Amount({label,value}:{label:string;value:number|string|null}){return <View style={styles.amount}><Text style={styles.amountValue}>{value==null?'—':formatMoney(value)}</Text><Text style={styles.amountLabel}>{label}</Text></View>;}
function humanize(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());}
function formatMoney(value:number|string){const n=Number(value);return `₹${new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(Number.isFinite(n)?n:0)}`;}
function formatDateTime(value:string|null){if(!value)return 'Not recorded';const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);}

const styles=StyleSheet.create({
  close:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  loading:{minHeight:280,alignItems:'center',justifyContent:'center'},errorCard:{minHeight:190,alignItems:'center',justifyContent:'center',borderRadius:partnerTheme.radius.lg,backgroundColor:partnerTheme.colors.surface},errorText:{color:partnerTheme.colors.inkMuted,fontSize:10,textAlign:'center'},retry:{marginTop:10,color:partnerTheme.colors.brand,fontSize:10,fontWeight:'800'},
  hero:{borderRadius:partnerTheme.radius.xl,padding:19,backgroundColor:partnerTheme.colors.nav},heroEyebrow:{color:'#AAA5FF',fontSize:8,fontWeight:'800',letterSpacing:1.1},heroStatus:{marginTop:7,color:'#FFFFFF',fontSize:22,lineHeight:28,fontWeight:'900'},heroMeta:{marginTop:7,color:'#C4CCD8',fontSize:9.5},heroFooter:{marginTop:16,paddingTop:12,flexDirection:'row',justifyContent:'space-between',gap:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#3B4658'},heroFooterText:{flex:1,color:'#8F9BAD',fontSize:7.5},
  actions:{marginTop:11,flexDirection:'row',gap:8},action:{flex:1,minHeight:50,alignItems:'center',justifyContent:'center',gap:4,borderRadius:14,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},actionText:{color:partnerTheme.colors.ink,fontSize:8,fontWeight:'800'},
  sectionHeader:{marginTop:20,marginBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sectionTitle:{color:partnerTheme.colors.ink,fontSize:13.5,fontWeight:'800'},sectionHint:{color:partnerTheme.colors.inkMuted,fontSize:8},
  infoCard:{flexDirection:'row',flexWrap:'wrap',rowGap:13,borderRadius:17,padding:15,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},info:{width:'50%',paddingRight:8},infoLabel:{color:'#8A94A6',fontSize:7,fontWeight:'800',textTransform:'uppercase',letterSpacing:0.5},infoValue:{marginTop:3,color:partnerTheme.colors.ink,fontSize:9,fontWeight:'600',lineHeight:13},
  amountRow:{flexDirection:'row',borderRadius:17,paddingVertical:15,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},amount:{flex:1,alignItems:'center',paddingHorizontal:4},amountValue:{color:partnerTheme.colors.ink,fontSize:12,fontWeight:'800'},amountLabel:{marginTop:4,color:partnerTheme.colors.inkMuted,fontSize:7,textAlign:'center'},
  timeline:{paddingLeft:2},timelineRow:{minHeight:76,flexDirection:'row'},rail:{width:28,alignItems:'center'},dot:{width:12,height:12,marginTop:4,borderRadius:6,alignItems:'center',justifyContent:'center',backgroundColor:'#BFC5D1',borderWidth:2,borderColor:partnerTheme.colors.canvas},dotLatest:{backgroundColor:partnerTheme.colors.brand},innerDot:{width:4,height:4,borderRadius:2,backgroundColor:'#FFFFFF'},line:{width:1,flex:1,marginTop:3,backgroundColor:partnerTheme.colors.line},timelineBody:{flex:1,paddingBottom:15},timelineDate:{color:partnerTheme.colors.brand,fontSize:7.5,fontWeight:'800'},timelineTitle:{marginTop:4,color:partnerTheme.colors.ink,fontSize:10.5,fontWeight:'800'},timelineKind:{marginTop:2,color:partnerTheme.colors.inkMuted,fontSize:7.5},
  empty:{minHeight:90,alignItems:'center',justifyContent:'center',borderRadius:15,backgroundColor:partnerTheme.colors.surface},emptyText:{color:partnerTheme.colors.inkMuted,fontSize:8.5},
  note:{marginTop:10,flexDirection:'row',alignItems:'flex-start',gap:8,borderRadius:13,padding:11,backgroundColor:partnerTheme.colors.accentSoft},noteText:{flex:1,color:'#56716F',fontSize:8,lineHeight:12},
});
