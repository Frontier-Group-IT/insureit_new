import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, LoadingState, Message, Screen } from '@/components/ui';
import { SELF_MANAGED_MILESTONES, type ClaimMilestone } from '@/lib/claim-service-mode';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

type ClaimRow={id:string;claim_no:string;vehicle_id:string;policy_id:string|null;current_status:string;claim_service_mode:string;assistance_status:string};
type Named={vehicle_no?:string;policy_no?:string};

export default function SelfManagedClaimDetailScreen(){
 const router=useRouter(); const {id}=useLocalSearchParams<{id?:string}>();
 const [claim,setClaim]=useState<ClaimRow|null>(null); const [vehicle,setVehicle]=useState<Named|null>(null); const [policy,setPolicy]=useState<Named|null>(null); const [steps,setSteps]=useState<ClaimMilestone[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 useEffect(()=>{if(!id){setError('Claim reference is missing.');setLoading(false);return;} let active=true; void(async()=>{
  const [c,m]=await Promise.all([supabase.from('claims').select('id,claim_no,vehicle_id,policy_id,current_status,claim_service_mode,assistance_status').eq('id',id).maybeSingle(),supabase.from('claim_milestones').select('*').eq('claim_id',id)]);
  if(!active)return; const next=c.data as ClaimRow|null; if(!next){setError('We could not load this claim.');setLoading(false);return;} if(next.claim_service_mode!=='self_managed'){router.replace({pathname:'/customer/claim-detail',params:{id}});return;}
  const [v,p]=await Promise.all([supabase.from('vehicles').select('vehicle_no').eq('id',next.vehicle_id).maybeSingle(),next.policy_id?supabase.from('policies').select('policy_no').eq('id',next.policy_id).maybeSingle():Promise.resolve({data:null})]);
  if(!active)return; setClaim(next);setVehicle(v.data);setPolicy(p.data);setSteps((m.data??[]) as ClaimMilestone[]);setLoading(false);
 })(); return()=>{active=false};},[id,router]);
 const completed=useMemo(()=>new Set(steps.filter(s=>s.milestone_status==='completed'||s.milestone_status==='not_applicable').map(s=>s.milestone_key)),[steps]);
 const count=completed.size; const settled=claim?.current_status==='Settled'||count===9; const current=SELF_MANAGED_MILESTONES.find(s=>!completed.has(s.key));
 if(loading)return <Screen title="Claim Tracker"><LoadingState label="Opening claim tracker"/></Screen>; if(!claim)return <Screen title="Claim Tracker"><Message type="error">{error}</Message></Screen>;
 return <Screen title="Claim Tracker" subtitle={`${vehicle?.vehicle_no??claim.claim_no} • ${policy?.policy_no??'Policy linked'}`} showLogout>
  <Card><Text style={s.cardTitle}>{settled?'Claim Settled':'Claim Progress'}</Text><Text style={s.cardSub}>{settled?'All 9 milestones are recorded':`${count} of 9 milestones completed`}</Text><Text style={s.progress}>{Math.round(count/9*100)}%</Text>{!settled&&current?<Text style={s.note}>Current stage: {current.label}</Text>:<Text style={s.note}>This claim remains available as settled claim history.</Text>}</Card>
  {!settled&&claim.assistance_status==='requested'?<Message type="info">Assistance requested. Until Sankalp accepts, this claim remains self-tracked.</Message>:null}
  {!settled&&claim.assistance_status!=='requested'?<Button label="Request Sankalp Assistance" variant="secondary" onPress={()=>router.push({pathname:'/customer/request-claim-assistance',params:{id:claim.id}})}/>:null}
  <View style={s.gap}/><Button label="Claim Documents" variant="secondary" onPress={()=>router.push({pathname:'/customer/self-managed-documents',params:{id:claim.id}})}/>
  <Text style={s.heading}>Claim Journey</Text>
  {SELF_MANAGED_MILESTONES.map((stage,index)=>{const done=completed.has(stage.key);const now=!settled&&current?.key===stage.key;const locked=!done&&!now;const route=stage.key==='spot_status'?'/customer/self-managed-spot-status':'/customer/self-managed-milestone';return <Pressable key={stage.key} disabled={locked||stage.key==='spot_intimation'} onPress={()=>router.push({pathname:route as any,params:stage.key==='spot_status'?{id:claim.id}:{id:claim.id,key:stage.key}})} style={[s.stage,now&&s.current,done&&s.done,locked&&s.locked]}><Text style={s.number}>{done?'✓':index+1}</Text><View style={{flex:1}}><Text style={s.name}>{stage.label}</Text><Text style={s.state}>{done?'Completed • tap to review or edit':now?'Current stage • tap to update':'Upcoming'}</Text></View></Pressable>})}
 </Screen>;
}
const s=StyleSheet.create({cardTitle:{color:palette.navy,fontSize:15,fontWeight:'900'},cardSub:{color:palette.slate,fontSize:10.5,fontWeight:'600',marginTop:3},progress:{color:palette.navy,fontSize:28,fontWeight:'900',marginTop:9},note:{color:'#667085',fontSize:11,fontWeight:'700',marginTop:5},gap:{height:8},heading:{color:palette.navy,fontSize:15,fontWeight:'900',marginTop:18,marginBottom:8},stage:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#DDE7F2',backgroundColor:'#FFF',borderRadius:15,padding:12,marginBottom:8},current:{borderColor:'#8CB5EF',backgroundColor:'#F7FAFF'},done:{borderColor:'#CBE8D8',backgroundColor:'#FAFFFC'},locked:{opacity:.55},number:{width:24,color:'#0A43A3',fontWeight:'900'},name:{color:palette.navy,fontSize:12,fontWeight:'900'},state:{color:'#7A8799',fontSize:9.5,fontWeight:'600',marginTop:2}});