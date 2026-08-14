import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppSectionHeader } from '@/components/design-system';
import { Card, EmptyState, LoadingState, Row, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

type PolicyDisplay = { id:string; customer_id:string; vehicle_id:string; insurance_company_id:string; policy_no:string; policy_type:string; start_date:string; end_date:string; premium_amount?:number|null; insured_declared_value?:number|null; source:'sibl'|'external' };

export default function PolicyDetailScreen() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams<{ id: string; source?: 'sibl'|'external' }>();
  const [policy, setPolicy] = useState<PolicyDisplay | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [company, setCompany] = useState<InsuranceCompany | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!id) return;
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const ids = contexts.map((context) => context.customer_id);
      if (!ids.length) { if (active) setLoading(false); return; }
      let next: any = null;
      let nextSource: 'sibl'|'external' = source === 'external' ? 'external' : 'sibl';
      if (source === 'external') {
        const result = await (supabase as any).from('external_policies').select('*').eq('id', id).in('customer_id', ids).maybeSingle();
        next = result.data;
      } else {
        const result = await supabase.from('policies').select('*').eq('id', id).in('customer_id', ids).maybeSingle();
        next = result.data;
        if (!next) {
          const externalResult = await (supabase as any).from('external_policies').select('*').eq('id', id).in('customer_id', ids).maybeSingle();
          next = externalResult.data;
          if (next) nextSource = 'external';
        }
      }
      if (!active) return;
      if (next) setPolicy({ ...next, source: nextSource });
      if (next) {
        const [vehicleResult, companyResult] = await Promise.all([
          supabase.from('vehicles').select('*').eq('id', next.vehicle_id).in('customer_id', ids).maybeSingle(),
          supabase.from('insurance_companies').select('*').eq('id', next.insurance_company_id).maybeSingle(),
        ]);
        if (!active) return;
        setVehicle(vehicleResult.data);
        setCompany(companyResult.data);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, router, source]);

  const renewalState = useMemo(() => {
    if (!policy) return { label:'Unavailable', action:false, tone:'neutral' as const, helper:'' };
    const days=Math.ceil((new Date(policy.end_date).getTime()-Date.now())/86400000);
    if(days<0)return{label:'Expired',action:true,tone:'danger' as const,helper:`Expired ${Math.abs(days)} day${Math.abs(days)===1?'':'s'} ago`};
    if(days<=30)return{label:'Renewal due',action:true,tone:'warning' as const,helper:`${days} day${days===1?'':'s'} left to renew`};
    return{label:'Active',action:false,tone:'success' as const,helper:`${days} day${days===1?'':'s'} remaining`};
  },[policy]);

  if(loading)return <Screen title="Policy Detail"><LoadingState/></Screen>;
  if(!policy)return <Screen title="Policy Detail"><EmptyState title="Policy not found" body="Please choose another policy from your list."/></Screen>;

  return <Screen title="Policy Detail" subtitle={vehicle?.vehicle_no??policy.policy_no} showLogout>
    <Card style={styles.heroCard}><View style={styles.heroGlow}/><View style={styles.heroRow}><View style={styles.heroIcon}><MaterialCommunityIcons name={policy.source==='external'?'account-edit-outline':'shield-check-outline'} size={30} color="#FFF"/></View><View style={styles.heroCopy}><Text style={styles.vehicleNo}>{vehicle?.vehicle_no??'Vehicle unavailable'}</Text><Text style={styles.insurerName}>{company?.name??'Insurer pending'}</Text>{policy.source==='external'?<Text style={styles.externalText}>Customer-added policy • kept outside Sankalp business register</Text>:null}</View><StatusBadge state={renewalState.tone} label={renewalState.label}/></View><Text style={styles.heroHelper}>{renewalState.helper}</Text></Card>
    <Card><AppSectionHeader title="Policy information"/><Row label="Policy number" value={policy.policy_no}/><Row label="Policy type" value={policy.policy_type}/><Row label="Start date" value={formatDate(policy.start_date)}/><Row label="End date" value={formatDate(policy.end_date)}/><Row label="Premium amount" value={formatCurrency(policy.premium_amount)}/><Row label="Insured declared value" value={formatCurrency(policy.insured_declared_value)}/></Card>
    <Card style={styles.vehicleCard}><View style={styles.sectionHeaderRow}><View style={styles.sectionIcon}><MaterialCommunityIcons name="truck-outline" size={22} color={palette.navy}/></View><View style={styles.sectionCopy}><AppSectionHeader title="Linked vehicle"/><Text style={styles.sectionHint}>{[vehicle?.make,vehicle?.model].filter(Boolean).join(' ')||vehicle?.vehicle_type||'Commercial vehicle'}</Text></View></View><Row label="Vehicle number" value={vehicle?.vehicle_no}/><Row label="Vehicle type" value={vehicle?.vehicle_type}/><Row label="Chassis no." value={vehicle?.chassis_no}/></Card>
    {renewalState.action?<Pressable onPress={()=>router.push({pathname:'/customer/add-policy',params:{vehicleId:policy.vehicle_id}} as any)} style={styles.renewButton}><View style={styles.renewIcon}><MaterialCommunityIcons name="refresh" size={22} color="#FFF"/></View><View style={styles.renewCopy}><Text style={styles.renewTitle}>Renew this policy</Text><Text style={styles.renewText}>Add the renewed policy details for this vehicle.</Text></View><MaterialCommunityIcons name="arrow-right" size={22} color="#FFF"/></Pressable>:null}
  </Screen>;
}

function StatusBadge({state,label}:{state:'success'|'warning'|'danger'|'neutral';label:string}){const c={success:{bg:'#E8F8F0',text:'#12805C'},warning:{bg:'#FFF4E2',text:'#B7791F'},danger:{bg:'#FDECEC',text:'#C43838'},neutral:{bg:'#EEF2F6',text:'#64748B'}}[state];return <View style={[styles.statusBadge,{backgroundColor:c.bg}]}><Text style={[styles.statusText,{color:c.text}]}>{label}</Text></View>;}
function formatDate(value?:string|null){return value?new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'-';}
function formatCurrency(value?:number|null){return value===null||value===undefined?'-':`INR ${Number(value).toLocaleString('en-IN')}`;}
const styles=StyleSheet.create({heroCard:{padding:15,overflow:'hidden',backgroundColor:'#F1F7FF',borderColor:'#C9DDFF'},heroGlow:{position:'absolute',right:-54,top:-74,width:190,height:190,borderRadius:95,backgroundColor:'rgba(10,67,163,0.12)'},heroRow:{flexDirection:'row',alignItems:'center',gap:12},heroIcon:{width:54,height:54,borderRadius:18,backgroundColor:roleTheme.customer.accent,alignItems:'center',justifyContent:'center'},heroCopy:{flex:1,minWidth:0},vehicleNo:{color:palette.ink,fontSize:22,fontWeight:'900'},insurerName:{color:palette.navy,fontSize:13.5,fontWeight:'800',marginTop:4},externalText:{color:'#0A43A3',fontSize:9.5,fontWeight:'800',marginTop:4},heroHelper:{color:palette.slate,fontSize:12.5,fontWeight:'700',marginTop:12},statusBadge:{borderRadius:999,paddingHorizontal:9,paddingVertical:5},statusText:{fontSize:9.5,fontWeight:'900'},vehicleCard:{backgroundColor:'#F8FBFF',borderColor:'#D7E6FA'},sectionHeaderRow:{flexDirection:'row',alignItems:'flex-start',gap:10,marginBottom:6},sectionIcon:{width:42,height:42,borderRadius:radii.md,backgroundColor:'#EAF3FF',alignItems:'center',justifyContent:'center'},sectionCopy:{flex:1,minWidth:0},sectionHint:{color:palette.slate,fontSize:12,fontWeight:'700',marginTop:-4},renewButton:{minHeight:64,borderRadius:20,backgroundColor:palette.navy,padding:12,flexDirection:'row',alignItems:'center',gap:12},renewIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.14)'},renewCopy:{flex:1},renewTitle:{color:'#FFF',fontSize:15,fontWeight:'900'},renewText:{color:'#C9D7EF',fontSize:11.5,fontWeight:'700',marginTop:2}});
