import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PartnerScreen } from '@/components/partner-screen';
import { prepareNativePolicyOnboarding, saveNativePolicyOnboarding, type NativePolicyDraft, type NativeOnboardingData } from '@/lib/policy-onboarding';

type FieldKey = keyof NativePolicyDraft;
type Field = { key:FieldKey; label:string; required?:boolean; options?:string[] };
const policy = [
  {key:'issuanceDate',label:'Policy issuance date (YYYY-MM-DD)',required:true},
  {key:'businessLine',label:'Policy type',required:true,options:['Motor']},
  {key:'intermediaryType',label:'Intermediary type',required:true,options:['POSP','MISP','SIBL / Partner']},
  {key:'leadSource',label:'Lead source',required:true},
  {key:'intermediaryCode',label:'Lead source code'},
  {key:'rmName',label:'Relationship manager'},
] satisfies Field[];
const vehicle = [
  {key:'registrationMode',label:'Registration status',required:true,options:['registered','unregistered']},
  {key:'registrationNo',label:'Registration number'},
  {key:'insuredName',label:'Insured name',required:true},
  {key:'phoneNo',label:'Mobile number',required:true},
  {key:'vehicleClass',label:'Vehicle class',required:true,options:['PCP','TWP','PCV','GCV','CPM','MISD']},
  {key:'make',label:'Manufacturer',required:true},
  {key:'model',label:'Model / variant',required:true},
  {key:'fuelType',label:'Fuel type',options:['Petrol','Diesel','CNG','Electric','Hybrid','Bi-Fuel','Other']},
  {key:'manufacturingYear',label:'Manufacturing year'},
  {key:'rtoState',label:'RTO state'},
  {key:'rtoName',label:'RTO name'},
  {key:'capacity',label:'Capacity'},
  {key:'chassisNo',label:'Chassis number'},
  {key:'engineNo',label:'Engine number'},
] satisfies Field[];
const product = [
  {key:'policyProduct',label:'Policy product',required:true,options:['Comprehensive','Third Party','SAOD','Bundled']},
  {key:'policyNo',label:'Policy number',required:true},
  {key:'insurerId',label:'Insurance company',required:true},
  {key:'idv',label:'IDV (₹)',required:true},
  {key:'od',label:'OD premium (₹)',required:true},
  {key:'tp',label:'TP premium (₹)',required:true},
  {key:'cpa',label:'CPA amount (₹)'},
  {key:'cpaOpted',label:'CPA opted',options:['Yes','No']},
  {key:'validFrom',label:'Validity from (YYYY-MM-DD)',required:true},
  {key:'validUpto',label:'Validity up to (YYYY-MM-DD)',required:true},
] satisfies Field[];

function amount(value:string){const n=Number(value);return Number.isFinite(n)&&n>0?n:0;}
export default function NativePolicyOnboarding(){
  const { id }=useLocalSearchParams<{id:string}>();
  const router=useRouter();
  const [data,setData]=useState<NativeOnboardingData|null>(null);
  const [draft,setDraft]=useState<NativePolicyDraft|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [picker,setPicker]=useState<{key:FieldKey;items:{value:string;label:string}[]}|null>(null);
  const [dirty,setDirty]=useState(false);
  const load=useCallback(async()=>{
    if(!id)return;
    setLoading(true);setError('');
    try{
      const loaded=await prepareNativePolicyOnboarding(id);
      setData(loaded);setDraft(loaded.draft);setDirty(false);
    }catch(e){setError(e instanceof Error?e.message:'Onboarding could not be opened.');}
    finally{setLoading(false);}
  },[id]);
  useEffect(()=>{void load();},[load]);
  const update=(key:FieldKey,value:string)=>{
    setDraft(current=>current?{...current,[key]:value}:current);
    setDirty(true);
  };
  const save=async(goBack=false)=>{
    if(!draft||!data||saving)return;
    setSaving(true);setError('');
    try{
      const result=await saveNativePolicyOnboarding(id,data.revision,draft);
      setData(current=>current?{...current,revision:result.revision}:current);
      setDirty(false);
      if(goBack)router.back();
    }catch(e){setError(e instanceof Error?e.message:'Draft could not be saved.');}
    finally{setSaving(false);}
  };
  const net=useMemo(()=>draft?amount(draft.od)+amount(draft.tp)+amount(draft.cpa):0,[draft]);
  const filled=useMemo(()=>{
    if(!draft)return 0;
    const required=[...policy,...vehicle,...product].filter(field=>field.required);
    return Math.round(100*required.filter(f=>String(draft[f.key]??'').trim()).length/required.length);
  },[draft]);
  const field=(f:Field)=>{
    if(!draft)return null;
    const current=draft[f.key]??'';
    const options=f.key==='insurerId'?data?.insurers??[]:f.key==='make'?(data?.manufacturers??[]).map(x=>({value:x,label:x})):(f.options??[]).map(x=>({value:x,label:x}));
    const displayed=options.find(x=>x.value===current)?.label??current;
    return <View key={f.key} style={styles.field}>
      <Text style={styles.label}>{f.label}{f.required?<Text style={styles.star}> *</Text>:null}</Text>
      {options.length?(
        <Pressable accessibilityRole="button" accessibilityLabel={f.label} onPress={()=>setPicker({key:f.key,items:options})} style={styles.inputRow}>
          <Text numberOfLines={1} style={[styles.value,!current&&styles.placeholder]}>{displayed||'Select '+f.label.toLowerCase()}</Text>
          <Ionicons name="chevron-down" size={15} color="#63758D"/>
        </Pressable>
      ):(
        <TextInput accessibilityLabel={f.label} value={current} onChangeText={v=>update(f.key,v)} placeholder={'Enter '+f.label.toLowerCase()}
          autoCapitalize={['registrationNo','chassisNo','engineNo','policyNo'].includes(f.key)?'characters':'sentences'}
          keyboardType={['phoneNo','idv','od','tp','cpa','capacity','manufacturingYear'].includes(f.key)?'numeric':'default'}
          style={styles.input} placeholderTextColor="#9AA7B9" />
      )}
    </View>;
  };
  const section=(number:string,title:string,items:Field[])=><View style={styles.section} key={number}>
    <View style={styles.sectionHead}><Text style={styles.number}>{number}</Text><Text style={styles.sectionTitle}>{title}</Text></View>
    <View style={styles.fields}>{items.map(field)}</View>
  </View>;
  return <PartnerScreen title="Policy Onboarding" eyebrow="POLICY INTAKE" onBack={()=>router.back()} navyTopBar navyStatusBar topBarIcon="document-text-outline">
    {loading?<View style={styles.wait}><ActivityIndicator color="#2843A9"/><Text style={styles.muted}>Loading saved Policy Onboarding…</Text></View>:null}
    {error?<View style={styles.error}><Ionicons name="alert-circle-outline" size={16} color="#B42318"/><Text style={styles.errorText}>{error}</Text></View>:null}
    {!loading&&!draft?<Pressable style={styles.retry} onPress={()=>void load()}><Text style={styles.retryText}>Retry loading</Text></Pressable>:null}
    {draft?<>
      <View style={styles.status}><View><Text style={styles.intake}>{data?.intake_number||'Policy Intake'}</Text><Text style={styles.muted}>Existing draft · {dirty?'Unsaved changes':'Saved revision '+data?.revision}</Text></View><View style={styles.progress}><Text style={styles.progressText}>{filled}% complete</Text></View></View>
      {section('01','Policy source & ownership',policy)}
      {section('02','Insured & vehicle identification',vehicle)}
      {section('03','Policy product, premium & validity',product)}
      <View style={styles.section}>
        <View style={styles.sectionHead}><Ionicons name="calculator-outline" size={18} color="#254C83"/><Text style={styles.sectionTitle}>Onboarding summary</Text></View>
        <View style={styles.summary}><Text style={styles.muted}>OD + TP + CPA (before applicable taxes)</Text><Text style={styles.total}>₹{net.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</Text></View>
        <Text style={styles.notice}>This is a draft summary, not the final policy premium calculation. Final taxes, premiums, validation and booking must use the website's authoritative booking engine.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving} style={styles.secondary} onPress={()=>void save(true)}><Text style={styles.secondaryText}>{saving?'Saving…':'Save & return to Intake'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={saving||!dirty} style={[styles.primary,(saving||!dirty)&&styles.disabled]} onPress={()=>void save()}><Text style={styles.primaryText}>{saving?'Saving…':'Save draft'}</Text></Pressable>
      </View>
      <View style={styles.bookingNotice}><Ionicons name="lock-closed-outline" size={17} color="#8A5A17"/><Text style={styles.bookingText}>Book Policy remains locked until the native workflow is connected to the existing verified booking, conflict and commercial validation system. Saving here does not create a policy.</Text></View>
    </>:null}
    <Modal transparent visible={Boolean(picker)} animationType="fade" onRequestClose={()=>setPicker(null)}>
      <View style={styles.scrim}><View style={styles.sheet}>
        <View style={styles.sheetTitle}><Text style={styles.sectionTitle}>Select {picker?.key}</Text><Pressable onPress={()=>setPicker(null)} accessibilityLabel="Close options"><Ionicons name="close" size={21} color="#4C5970"/></Pressable></View>
        <ScrollView style={styles.choiceScroll}>{picker?.items.map(item=><Pressable key={item.value} style={styles.choice} onPress={()=>{update(picker!.key,item.value);setPicker(null);}}><Text style={styles.choiceText}>{item.label}</Text></Pressable>)}</ScrollView>
      </View></View>
    </Modal>
  </PartnerScreen>;
}
const styles=StyleSheet.create({
  wait:{padding:28,alignItems:'center',gap:12},muted:{fontSize:11,color:'#738196',lineHeight:17},
  error:{flexDirection:'row',gap:8,backgroundColor:'#FFF0EF',padding:12,borderRadius:11,marginBottom:10},errorText:{flex:1,color:'#A32924',fontSize:12},
  retry:{padding:14,backgroundColor:'#DFE8FF',borderRadius:10,alignItems:'center'},retryText:{color:'#1B397A',fontWeight:'700'},
  status:{backgroundColor:'#FFFFFF',borderRadius:13,borderWidth:1,borderColor:'#DFE6F1',padding:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
  intake:{color:'#1C375D',fontWeight:'800',fontSize:14},progress:{borderRadius:20,backgroundColor:'#EAEFFA',paddingVertical:6,paddingHorizontal:10},progressText:{color:'#324D9E',fontWeight:'700',fontSize:11},
  section:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DFE6F0',borderRadius:13,marginBottom:11,overflow:'hidden'},
  sectionHead:{flexDirection:'row',gap:9,alignItems:'center',paddingHorizontal:13,paddingVertical:12,backgroundColor:'#EAF1FA'},
  number:{fontSize:11,color:'#355EA0',fontWeight:'800'},sectionTitle:{fontSize:13,color:'#1B385B',fontWeight:'800'},
  fields:{padding:12,gap:10},field:{gap:5},label:{fontSize:10,color:'#65758E',fontWeight:'700'},star:{color:'#B93333'},
  input:{minHeight:42,borderWidth:1,borderColor:'#D8E1EC',backgroundColor:'#FFFFFF',borderRadius:9,paddingHorizontal:11,fontSize:12,color:'#183653'},
  inputRow:{minHeight:42,borderWidth:1,borderColor:'#D8E1EC',borderRadius:9,paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  value:{color:'#183653',fontSize:12,flex:1},placeholder:{color:'#97A5B7'},
  summary:{padding:14,gap:7},total:{fontSize:20,color:'#1B385B',fontWeight:'800'},notice:{fontSize:10,lineHeight:16,color:'#65758E',paddingHorizontal:14,paddingBottom:13},
  actions:{flexDirection:'row',gap:8,marginBottom:11},secondary:{flex:1,borderWidth:1,borderColor:'#CDD9EB',borderRadius:10,padding:13,alignItems:'center'},secondaryText:{fontWeight:'700',fontSize:11,color:'#25466E'},
  primary:{flex:1,backgroundColor:'#243F9E',borderRadius:10,padding:13,alignItems:'center'},primaryText:{fontSize:11,fontWeight:'800',color:'white'},disabled:{opacity:.48},
  bookingNotice:{flexDirection:'row',gap:9,padding:12,backgroundColor:'#FFF7E9',borderRadius:10,marginBottom:14},bookingText:{flex:1,fontSize:10,lineHeight:16,color:'#75531C'},
  scrim:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(5,18,40,.5)'},sheet:{backgroundColor:'white',borderTopLeftRadius:20,borderTopRightRadius:20,padding:17,maxHeight:'70%'},
  sheetTitle:{flexDirection:'row',justifyContent:'space-between',paddingBottom:12},choiceScroll:{maxHeight:420},
  choice:{minHeight:44,justifyContent:'center',borderTopWidth:1,borderColor:'#EEF1F7'},choiceText:{fontSize:12,color:'#284064'},
});
