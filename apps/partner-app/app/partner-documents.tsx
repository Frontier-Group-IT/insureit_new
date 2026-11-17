import { partnerAlert } from '@/components/ui/partner-alert-provider';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { PartnerStackBottomNavigation } from '@/components/partner-stack-bottom-navigation';
import { canPartnerAccess } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

const SLOTS=[
  {key:'aadhaar_front',label:'Aadhaar Front',required:true},
  {key:'aadhaar_back',label:'Aadhaar Back',required:true},
  {key:'pan_copy',label:'PAN Copy',required:true},
  {key:'cancelled_cheque',label:'Cancelled Cheque',required:true},
  {key:'photograph',label:'Photograph',required:true},
  {key:'gst_copy',label:'GST Certificate',required:true},
  {key:'education_10th_marksheet',label:'Education Marksheet',required:false},
  {key:'signed_registration_form',label:'Signed Registration Certificate',required:false},
  {key:'custom_1',label:'Other Document 1',required:false},
  {key:'custom_2',label:'Other Document 2',required:false},
] as const;
const EDUCATION=[
  {key:'education_10th_marksheet',label:'10th Marksheet'},
  {key:'education_12th_marksheet',label:'12th Marksheet'},
  {key:'education_graduation_marksheet',label:'Graduation Marksheet'},
  {key:'education_post_graduation_marksheet',label:'Post Graduation Marksheet'},
];
type Saved={type:string;name:string;label?:string|null};
type ApiResult={ok?:boolean;error?:string;documents?:Saved[];partner_id?:string};
const BASE=(process.env.EXPO_PUBLIC_PORTAL_URL||'https://portal.insureit.in').replace(/\/$/,'');
async function request(applicationId:string,form?:FormData):Promise<ApiResult> {
  const {data}=await supabase.auth.getSession();
  if(!data.session?.access_token)throw new Error('Sign in again to continue.');
  const response=await fetch(BASE+'/api/partner/onboarding/documents'+(form?'':'?applicationId='+encodeURIComponent(applicationId)),{
    method:form?'POST':'GET',
    headers:{Authorization:'Bearer '+data.session.access_token},
    ...(form?{body:form}:{}),
  });
  const result=await response.json() as ApiResult;
  if(!response.ok||!result.ok)throw new Error(result.error||'Unable to update MISP documents.');
  return result;
}
export default function MispDocumentsScreen() {
  const router=useRouter();
  const {applicationId}=useLocalSearchParams<{applicationId?:string}>();
  const {context}=usePartnerSession();
  const allowed=context?.identity.actor_kind==='employee'
    &&canPartnerAccess(context,'create_intermediary_application','edit');
  const [saved,setSaved]=useState<Saved[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [educationType,setEducationType]=useState<string>(EDUCATION[0].key);
  const [educationOpen,setEducationOpen]=useState(false);
  const [customLabels,setCustomLabels]=useState<Record<string,string>>({});
  useEffect(()=>{
    if(!allowed||!applicationId){setLoading(false);return;}
    let active=true;
    void request(applicationId).then(result=>{if(active)setSaved(result.documents||[]);})
      .catch(error=>{if(active)partnerAlert('MISP documents',error instanceof Error?error.message:'Unable to load documents.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[allowed,applicationId]);
  const findSaved=(key:string)=>key==='education_10th_marksheet'
    ?saved.find(row=>row.type.startsWith('education_'))
    :saved.find(row=>row.type===key);
  const upload=async (key:string)=>{
    if(!applicationId||busy)return;
    const documentType=key==='education_10th_marksheet'?educationType:key;
    const label=key.startsWith('custom_')?(customLabels[key]??findSaved(key)?.label??'').trim():undefined;
    if(key.startsWith('custom_')&&!label){
      // Custom documents are optional; a meaningful file label must be supplied.
      partnerAlert('Other Document','Enter a name before uploading this document.');
      return;
    }
    try {
      const result=await DocumentPicker.getDocumentAsync({
        type:['application/pdf','image/jpeg','image/png'],copyToCacheDirectory:true,multiple:false,
      });
      if(result.canceled||!result.assets?.length)return;
      const file=result.assets[0];
      if(file.size&&file.size>10*1024*1024)throw new Error('Each file must be 10 MB or smaller.');
      setBusy(key);
      const form=new FormData();
      form.append('application_id',applicationId);
      form.append('intent','upload');
      form.append('document_type',documentType);
      if(label)form.append('document_label',label);
      form.append('file',{uri:file.uri,name:file.name||documentType+'.pdf',type:file.mimeType||'application/pdf'} as unknown as Blob);
      await request(applicationId,form);
      const fresh=await request(applicationId);
      setSaved(fresh.documents||[]);
    } catch(error){partnerAlert('Document upload failed',error instanceof Error?error.message:'Please retry.');}
    finally{setBusy(null);}
  };
  const finalize=async ()=>{
    if(!applicationId||busy)return;
    const missing=SLOTS.filter(s=>s.required&&!findSaved(s.key)).map(s=>s.label);
    if(missing.length){partnerAlert('Required documents missing',missing.join(', '));return;}
    partnerAlert('Complete MISP documents?','This will finish the required document stage and request Partner activation.',[
      {text:'Cancel',style:'cancel'},
      {text:'Complete',onPress:()=>void (async()=>{
        setBusy('finalize');
        try {
          const form=new FormData();
          form.append('application_id',applicationId);
          form.append('intent','finalize');
          const result=await request(applicationId,form);
          partnerAlert('MISP documents completed',result.partner_id?'Partner ID: '+result.partner_id:'Documents completed.',[
            {text:'OK',onPress:()=>router.replace('/(tabs)/policies')},
          ]);
        }catch(error){partnerAlert('Unable to complete documents',error instanceof Error?error.message:'Please retry.');}
        finally{setBusy(null);}
      })()},
    ]);
  };
  if(!allowed)return <SafeAreaView style={styles.screen}><Text style={styles.helper}>Employee Add Partner permission required.</Text></SafeAreaView>;
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <StatusBar style="light" backgroundColor="#071E49"/>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to policies" onPress={()=>router.replace('/(tabs)/policies')}>
        <Ionicons name="arrow-back" color="#FFFFFF" size={22}/>
      </Pressable>
      <Text style={styles.title}>MISP Documents</Text>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <Text style={styles.heading}>02 · MISP documents</Text>
        <Text style={styles.helper}>Same required documents as Operations MISP onboarding. PDF, JPG or PNG, up to 10 MB per file.</Text>
      </View>
      {loading?<ActivityIndicator color="#17365D"/>:SLOTS.map(slot=>{
        const current=findSaved(slot.key);
        return <View key={slot.key} style={styles.card}>
          <View style={styles.itemHead}>
            <View style={styles.itemTitle}>
              <Text style={styles.label}>{slot.label}{slot.required?' *':''}</Text>
              <Text style={styles.helper} numberOfLines={2}>{current?.name||'No file uploaded'}</Text>
            </View>
            <Ionicons name={current?'checkmark-circle':'document-outline'} size={20} color={current?'#19956B':'#8392A7'}/>
          </View>
          {slot.key==='education_10th_marksheet'&&
            <View style={styles.education}>
              <Pressable accessibilityRole="button" onPress={()=>setEducationOpen(!educationOpen)} style={styles.educationChoice}>
                <Text style={styles.small}>{EDUCATION.find(e=>e.key===educationType)?.label}</Text>
                <Ionicons name="chevron-down" size={16} color="#17365D"/>
              </Pressable>
              {educationOpen&&EDUCATION.map(option=><Pressable key={option.key} onPress={()=>{setEducationType(option.key);setEducationOpen(false);}} style={styles.educationChoice}>
                <Text style={styles.small}>{option.label}</Text>
              </Pressable>)}
            </View>
          }
          {slot.key.startsWith('custom_')&&
            <TextInput accessibilityLabel={'Name '+slot.label} style={styles.customInput}
              placeholder="Enter document name" placeholderTextColor="#8290A5"
              value={customLabels[slot.key]??current?.label??''} maxLength={60}
              onChangeText={value=>setCustomLabels(prev=>({...prev,[slot.key]:value}))}/>
          }
          <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={()=>void upload(slot.key)} style={styles.upload}>
            <Ionicons name="cloud-upload-outline" size={17} color="#17365D"/>
            <Text style={styles.uploadText}>{busy===slot.key?'Uploading…':current?'Replace Document':'Upload Document'}</Text>
          </Pressable>
        </View>;
      })}
      <Pressable accessibilityRole="button" disabled={Boolean(busy)||loading} onPress={()=>void finalize()}
        style={[styles.finish,(Boolean(busy)||loading)&&styles.disabled]}>
        <Text style={styles.finishText}>{busy==='finalize'?'Completing…':'Complete Document Stage'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={()=>router.replace('/(tabs)/policies')} style={styles.exit}>
        <Text style={styles.uploadText}>Save & Exit</Text>
      </Pressable>
    </ScrollView>
    <PartnerStackBottomNavigation activeTab="more" includeBottomInset onNavigate={destination=>router.navigate(destination as never)}/>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#071E49'},scroll:{flex:1,backgroundColor:'#F2F5FB'},
  header:{height:54,backgroundColor:'#071E49',flexDirection:'row',alignItems:'center',paddingHorizontal:18,gap:14},
  title:{fontSize:17,fontWeight:'800',color:'#FFF'},content:{padding:12,gap:12,paddingBottom:35},
  intro:{padding:13,backgroundColor:'#FFF',borderRadius:14,borderWidth:1,borderColor:'#DEE7F1',gap:6},
  heading:{color:'#17365D',fontWeight:'800',fontSize:14},helper:{color:'#64748B',fontSize:11,lineHeight:17},
  card:{backgroundColor:'#FFF',borderRadius:14,borderWidth:1,borderColor:'#DCE5EF',padding:12,gap:10},
  itemHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  itemTitle:{flex:1,gap:4},label:{color:'#172846',fontSize:12,fontWeight:'800'},
  upload:{minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderRadius:9,borderWidth:1,borderColor:'#D1DCE9',backgroundColor:'#F9FBFF'},
  uploadText:{color:'#17365D',fontSize:12,fontWeight:'800'},finish:{minHeight:46,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#17365D'},
  finishText:{color:'#FFF',fontWeight:'800',fontSize:13},exit:{minHeight:44,borderRadius:10,borderWidth:1,borderColor:'#CAD6E5',backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},
  disabled:{opacity:.55},education:{gap:5},educationChoice:{minHeight:37,paddingHorizontal:10,borderRadius:8,borderWidth:1,borderColor:'#DCE5EF',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},small:{color:'#17365D',fontSize:12},
  customInput:{minHeight:42,borderWidth:1,borderColor:'#DCE5EF',borderRadius:8,paddingHorizontal:12,fontSize:12,color:'#17365D'},
});