import { partnerAlert } from '@/components/ui/partner-alert-provider';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { PartnerPolicyCalendarDialog } from '@/components/policy-intakes/partner-policy-calendar-dialog';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Option={id:string;name:string};
type MispField='document_received_at'|'oem_name'|'associate_employee_id'|'misp_name'|'pan_number'
  |'dp_first_name'|'dp_middle_name'|'dp_last_name'|'date_of_birth'|'dp_phone'|'dp_email'|'dp_pan_number'|'aadhaar_number'
  |'address'|'city'|'state'|'postal_code'|'bank_id'|'bank_account_number'|'bank_ifsc_code'|'gst_number';
type FieldConfig={key:MispField;label:string;hint:string;optional?:boolean;date?:boolean;pick?:'rm'|'oem'|'bank';secret?:boolean;keyboard?:'default'|'phone-pad'|'email-address'|'number-pad'};
const fields: Array<{title:string;items:FieldConfig[]}>= [
  {title:'MISP details',items:[
    {key:'document_received_at',label:'Documents received',hint:'DD/MM/YYYY',optional:true,date:true},
    {key:'oem_name',label:'OEM Name',hint:'Select OEM',pick:'oem'},
    {key:'associate_employee_id',label:'RM',hint:'Select RM',pick:'rm'},
    {key:'misp_name',label:'MISP Name',hint:'Company / dealership name'},
    {key:'pan_number',label:'MISP PAN',hint:'ABCDE1234F'},
  ]},
  {title:'Designated Person (DP)',items:[
    {key:'dp_first_name',label:'DP First Name',hint:'First name'},
    {key:'dp_middle_name',label:'DP Middle Name',hint:'Middle name',optional:true},
    {key:'dp_last_name',label:'DP Last Name',hint:'Last name',optional:true},
    {key:'date_of_birth',label:'DP Date of Birth',hint:'DD/MM/YYYY',date:true},
    {key:'dp_phone',label:'DP Contact',hint:'10-digit mobile',keyboard:'phone-pad'},
    {key:'dp_email',label:'DP Email',hint:'Email address',keyboard:'email-address'},
    {key:'dp_pan_number',label:'DP PAN No',hint:'ABCDE1234F'},
    {key:'aadhaar_number',label:'DP Aadhaar Number',hint:'12-digit Aadhaar',keyboard:'number-pad',secret:true},
  ]},
  {title:'Address',items:[
    {key:'address',label:'Address',hint:'Complete address'},
    {key:'city',label:'City',hint:'City'},
    {key:'state',label:'State',hint:'State'},
    {key:'postal_code',label:'PIN Code',hint:'6-digit PIN',keyboard:'number-pad'},
  ]},
  {title:'Bank & tax',items:[
    {key:'bank_id',label:'Bank',hint:'Select bank',pick:'bank'},
    {key:'bank_account_number',label:'Account Number',hint:'Bank account number',keyboard:'number-pad',secret:true},
    {key:'bank_ifsc_code',label:'IFSC',hint:'ABCD0123456'},
    {key:'gst_number',label:'GST Number',hint:'GSTIN'},
  ]},
];
const documentSlots = [
  {key:'aadhaar_front',label:'Aadhaar Front'},
  {key:'aadhaar_back',label:'Aadhaar Back'},
  {key:'pan_copy',label:'PAN Copy'},
  {key:'cancelled_cheque',label:'Cancelled Cheque / Bank Proof'},
  {key:'photograph',label:'Photograph'},
  {key:'gst_copy',label:'GST Certificate'},
  {key:'signed_registration_form',label:'Signed Registration Certificate'},
  {key:'education_10th_marksheet',label:'Education Marksheet'},
  {key:'custom_1',label:'Other Document 1'},
  {key:'custom_2',label:'Other Document 2'},
] as const;
type SavedDocument={type:string;name:string;label?:string|null};
const educationOptions=[
  {key:'education_10th_marksheet',label:'10th Marksheet'},
  {key:'education_12th_marksheet',label:'12th Marksheet'},
  {key:'education_graduation_marksheet',label:'Graduation Marksheet'},
  {key:'education_post_graduation_marksheet',label:'Post Graduation Marksheet'},
];
const empty=Object.fromEntries(fields.flatMap(section=>section.items.map(item=>[item.key,'']))) as Record<MispField,string>;
const isoDate=(value:string)=>{
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if(!m)return null;
  const date=new Date(Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1])));
  return date.getUTCFullYear()===Number(m[3])&&date.getUTCMonth()===Number(m[2])-1&&date.getUTCDate()===Number(m[1])
    ? m[3]+'-'+m[2]+'-'+m[1]:null;
};
type MispErrors=Partial<Record<MispField,string>>;
const mispFieldOrder:MispField[]=fields.flatMap(section=>section.items.map(field=>field.key));
function validateMispField(key:MispField,form:Record<MispField,string>):string|null {
  const value=form[key].trim();
  const label=fields.flatMap(section=>section.items).find(field=>field.key===key)?.label||key;
  if(!value) {
    return key==='document_received_at'||key==='dp_middle_name'||key==='dp_last_name'
      ?null:`${label} is required.`;
  }
  const upper=value.toUpperCase();
  if(key==='pan_number'||key==='dp_pan_number')
    return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(upper)?null:`${label} format is invalid. Use ABCDE1234F.`;
  if(key==='aadhaar_number')
    return /^[0-9]{12}$/.test(value)?null:'DP Aadhaar Number must contain exactly 12 digits.';
  if(key==='dp_phone')
    return /^[6-9][0-9]{9}$/.test(value.replace(/^\+91/,''))?null:'DP Contact must be a valid 10-digit Indian mobile number.';
  if(key==='dp_email')
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?null:'DP Email format is invalid.';
  if(key==='date_of_birth') {
    const dob=isoDate(value);
    return dob&&dob<=new Date().toISOString().slice(0,10)?null:'DP Date of Birth is invalid.';
  }
  if(key==='document_received_at')
    return isoDate(value)?null:'Documents received date is invalid.';
  if(key==='postal_code')
    return /^[0-9]{6}$/.test(value)?null:'PIN Code must contain exactly 6 digits.';
  if(key==='bank_account_number')
    return /^[0-9]{6,20}$/.test(value)?null:'Account Number must contain 6 to 20 digits.';
  if(key==='bank_ifsc_code')
    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(upper)?null:'IFSC format is invalid. Use ABCD0123456.';
  if(key==='gst_number')
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(upper)?null:'GST Number format is invalid.';
  return null;
}
function validateMisp(form:Record<MispField,string>):MispErrors {
  const errors:MispErrors={};
  for(const key of mispFieldOrder){
    const error=validateMispField(key,form);
    if(error)errors[key]=error;
  }
  return errors;
}
export function MispPartnerForm({rms,banks,oems,pendingMisps,loading,onDirtyChange,onCancel}:{rms:Option[];banks:Option[];oems:Option[];pendingMisps:Option[];loading:boolean;onDirtyChange:(dirty:boolean)=>void;onCancel:()=>void}) {
  const router=useRouter();
  const [form,setForm]=useState(empty);
  const [fieldErrors,setFieldErrors]=useState<MispErrors>({});
  const [picker,setPicker]=useState<'rm'|'oem'|'bank'|null>(null);
  const [search,setSearch]=useState('');
  const [dateField,setDateField]=useState<'document_received_at'|'date_of_birth'|null>(null);
  const [saving,setSaving]=useState(false);
  const [applicationId,setApplicationId]=useState<string|null>(null);
  const [documentsOpen,setDocumentsOpen]=useState(false);
  const [documents,setDocuments]=useState<SavedDocument[]>([]);
  const [busyDocument,setBusyDocument]=useState<string|null>(null);
  const [educationType,setEducationType]=useState('education_10th_marksheet');
  const [customNames,setCustomNames]=useState<Record<string,string>>({});
  const set=(key:MispField,value:string)=>{
    // Aadhaar stays digit-only and accepts all 12 digits (never a 10-digit cap).
    const nextValue=key==='aadhaar_number'?value.replace(/\D/g,'').slice(0,12):value;
    setForm(prev=>({...prev,[key]:nextValue}));
    setFieldErrors(prev=>{
      if(!prev[key])return prev;
      const next={...prev};
      const message=validateMispField(key,{...form,[key]:nextValue});
      if(message)next[key]=message;
      else delete next[key];
      return next;
    });
    onDirtyChange(true);
  };
  const list=picker==='rm'?rms:picker==='oem'?oems:banks;
  const selected=picker==='rm'?form.associate_employee_id:picker==='oem'?form.oem_name:form.bank_id;
  const portalBase=(process.env.EXPO_PUBLIC_PORTAL_URL||'https://portal.insureit.in').replace(/\/$/,'');
  const authorizedDocs=async(method:'GET'|'POST'|'DELETE',id:string,body?:FormData|Record<string,string>)=>{
    const {data}=await supabase.auth.getSession();
    if(!data.session?.access_token)throw new Error('Sign in again to continue.');
    const url=portalBase+'/api/partner/onboarding/documents'+(method==='GET'?'?applicationId='+encodeURIComponent(id):'');
    const response=await fetch(url,{
      method,headers:{Authorization:'Bearer '+data.session.access_token,...(method==='DELETE'?{'Content-Type':'application/json'}:{})},
      ...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{}),
    });
    const result=await response.json() as {ok?:boolean;error?:string;documents?:SavedDocument[]};
    if(!response.ok||!result.ok)throw new Error(result.error||'Document request failed.');
    return result;
  };
  const refreshDocuments=async(id:string)=>{
    const result=await authorizedDocs('GET',id);
    setDocuments(result.documents||[]);
  };
  const showSavedChoice=()=>{
    partnerAlert('MISP Details Saved','Would you like to upload documents now?',[
      {text:'Not Now',style:'cancel',onPress:()=>router.replace('/(tabs)/policies')},
      {text:'Upload Documents',onPress:()=>setDocumentsOpen(true)},
    ]);
  };
  const submit=async ()=>{
    if(saving||loading)return;
    if(applicationId){showSavedChoice();return;}
    const dob=isoDate(form.date_of_birth),received=form.document_received_at.trim()?isoDate(form.document_received_at):null;
    const normalized={
      ...form,partner_type:'misp',date_of_birth:dob,document_received_at:received,
      pan_number:form.pan_number.trim().toUpperCase(),dp_pan_number:form.dp_pan_number.trim().toUpperCase(),
      dp_phone:form.dp_phone.trim().replace(/^\+91/,''),dp_email:form.dp_email.trim().toLowerCase(),
      aadhaar_number:form.aadhaar_number.replace(/\s/g,''),
      bank_account_number:form.bank_account_number.trim(),bank_ifsc_code:form.bank_ifsc_code.trim().toUpperCase(),
      gst_number:form.gst_number.trim().toUpperCase(),postal_code:form.postal_code.trim(),
    };
    const errors=validateMisp(form);
    setFieldErrors(errors);
    const firstInvalid=mispFieldOrder.find(key=>errors[key]);
    if(firstInvalid){
      Keyboard.dismiss();
      const label=fields.flatMap(section=>section.items).find(field=>field.key===firstInvalid)?.label||'Field';
      partnerAlert(`${label} invalid`,errors[firstInvalid]||'Check this field.');
      return;
    }
    setSaving(true);
    try {
      const {data}=await supabase.auth.getSession();
      if(!data.session?.access_token)throw new Error('Sign in again to continue.');
      const base=(process.env.EXPO_PUBLIC_PORTAL_URL||'https://portal.insureit.in').replace(/\/$/,'');
      const response=await fetch(base+'/api/partner/onboarding/partner-only',{
        method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify(normalized),
      });
      const result=await response.json() as {ok?:boolean;application_id?:string;error?:string};
      if(!response.ok||!result.ok||!result.application_id)throw new Error(result.error||'MISP application could not be saved.');
      setApplicationId(result.application_id);
      onDirtyChange(false);
      showSavedChoice();
    } catch(error){partnerAlert('Unable to save MISP',error instanceof Error?error.message:'Please retry.');}
    finally{setSaving(false);}
  };

  const findDocument=(key:string)=>key==='education_10th_marksheet'
    ?documents.find(doc=>doc.type.startsWith('education_'))
    :documents.find(doc=>doc.type===key);
  const uploadDocument=async(key:string)=>{
    if(!applicationId||busyDocument)return;
    const type=key==='education_10th_marksheet'?educationType:key;
    const name=key.startsWith('custom_')?(customNames[key]??findDocument(key)?.label??'').trim():undefined;
    if(key.startsWith('custom_')&&!name){
      partnerAlert('Document name required','Enter a name for this document.');return;
    }
    try{
      const choice=await DocumentPicker.getDocumentAsync({
        type:['application/pdf','image/jpeg','image/png'],copyToCacheDirectory:true,multiple:false,
      });
      if(choice.canceled||!choice.assets.length)return;
      const file=choice.assets[0];
      if(!file.size||file.size>10*1024*1024)throw new Error('Choose a PDF, JPG or PNG under 10 MB.');
      const mime=file.mimeType||(file.name.toLowerCase().endsWith('.pdf')?'application/pdf':file.name.toLowerCase().endsWith('.png')?'image/png':'image/jpeg');
      if(!['application/pdf','image/jpeg','image/png'].includes(mime))throw new Error('Choose a PDF, JPG or PNG.');
      setBusyDocument(key);
      const payload=new FormData();
      payload.append('application_id',applicationId);
      payload.append('intent','upload');
      payload.append('document_type',type);
      if(name)payload.append('document_label',name);
      payload.append('file',{uri:file.uri,name:file.name,type:mime} as unknown as Blob);
      await authorizedDocs('POST',applicationId,payload);
      await refreshDocuments(applicationId);
    }catch(error){
      partnerAlert('Document upload failed',error instanceof Error?error.message:'Try again.');
    }finally{setBusyDocument(null);}
  };
  const deleteDocument=(key:string)=>{
    if(!applicationId||busyDocument)return;
    const current=findDocument(key);
    if(!current)return;
    partnerAlert('Delete document?','Remove this document from the MISP application?',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:()=>void (async()=>{
        setBusyDocument(key);
        try{
          await authorizedDocs('DELETE',applicationId,{application_id:applicationId,document_type:current.type});
          await refreshDocuments(applicationId);
        }catch(error){partnerAlert('Delete failed',error instanceof Error?error.message:'Try again.');}
        finally{setBusyDocument(null);}
      })()},
    ]);
  };
  useEffect(()=>{
    if(!documentsOpen||!applicationId)return;
    void refreshDocuments(applicationId).catch(error=>
      partnerAlert('Documents unavailable',error instanceof Error?error.message:'Try again.'));
  },[documentsOpen,applicationId]);
  return (
    <View style={styles.wrapper}>
      {pendingMisps.length>0&&<View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.heading}>Continue saved MISP documents</Text></View><View style={styles.grid}>{pendingMisps.map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>router.push({pathname:"/partner-documents",params:{applicationId:item.id}} as never)} style={styles.pendingItem}><Text style={styles.inputText} numberOfLines={1}>{item.name}</Text><Ionicons name="chevron-forward" color="#17365D" size={17}/></Pressable>)}</View></View>}
      {fields.map((section,index)=>(
        <View key={section.title} style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.index}><Text style={styles.indexText}>{String(index+1).padStart(2,'0')}</Text></View>
            <Text style={styles.heading}>{section.title}</Text>
          </View>
          <View style={styles.grid}>
            {section.items.map(field=>{
              const options=field.pick==='rm'?rms:field.pick==='oem'?oems:banks;
              const optionName=options.find(x=>x.id===form[field.key])?.name;
              return <View key={field.key} style={styles.half}>
                <Text style={styles.label}>{field.label}{!field.optional?<Text style={styles.requiredStar}> *</Text>:null}</Text>
                {field.pick||field.date?
                  <Pressable accessibilityRole="button" accessibilityLabel={'Select '+field.label} disabled={loading||Boolean(applicationId)}
                    onPress={()=>{if(field.date)setDateField(field.key as 'document_received_at'|'date_of_birth');else{setSearch('');setPicker(field.pick!);}}}
                    style={[styles.inputPress,fieldErrors[field.key]&&styles.invalidInput]}>
                    <Text numberOfLines={1} style={styles.inputText}>{field.date?(form[field.key]||field.hint):(optionName||field.hint)}</Text>
                    <Ionicons name={field.date?'calendar-outline':'chevron-down'} size={18} color="#17365D"/>
                  </Pressable>
                  :<TextInput editable={!applicationId} value={form[field.key]} onChangeText={value=>set(field.key,value)}
                    keyboardType={field.keyboard||'default'} secureTextEntry={Boolean(field.secret)}
                    placeholder={field.hint} placeholderTextColor="#98A3B2"
                    autoCapitalize={['pan_number','dp_pan_number','bank_ifsc_code','gst_number'].includes(field.key)?'characters':field.key==='dp_email'?'none':'sentences'}
                    maxLength={field.key==='aadhaar_number'?12:field.key==='postal_code'?6:field.key==='pan_number'||field.key==='dp_pan_number'?10:field.key==='gst_number'?15:field.key==='bank_ifsc_code'?11:field.key==='address'?300:150}
                    style={[styles.input,fieldErrors[field.key]&&styles.invalidInput]}/>}
                {fieldErrors[field.key]?<Text style={styles.fieldError}>{fieldErrors[field.key]}</Text>:null}
              </View>;
            })}
          </View>
        </View>
      ))}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving||loading||Boolean(busyDocument)} onPress={onCancel} style={[styles.secondary,saving&&styles.disabled]}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={saving||loading||Boolean(busyDocument)} onPress={()=>void submit()} style={[styles.primary,saving&&styles.disabled]}>
          <Text style={styles.primaryText}>{saving?'Saving…':'Save Detail'}</Text>
        </Pressable>
      </View>
      <PartnerPolicyCalendarDialog
        visible={Boolean(dateField)}
        value={dateField && isoDate(form[dateField]) ? new Date(isoDate(form[dateField])+'T12:00:00') : new Date()}
        maximumDate={new Date()}
        onCancel={() => setDateField(null)}
        onConfirm={date => {
          if (dateField) {
            set(dateField, String(date.getDate()).padStart(2,'0')+'/'+String(date.getMonth()+1).padStart(2,'0')+'/'+date.getFullYear());
          }
          setDateField(null);
        }}
      />

      <Modal visible={documentsOpen} transparent animationType="fade" onRequestClose={()=>{if(!busyDocument)setDocumentsOpen(false);}}>
        <View style={styles.documentBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} accessibilityLabel="Close MISP document popup"
            disabled={Boolean(busyDocument)} onPress={()=>setDocumentsOpen(false)}/>
          <View style={styles.documentModal}>
            <View style={styles.documentHead}>
              <Text style={styles.documentHeading}>Upload Documents</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close MISP document popup" disabled={Boolean(busyDocument)}
                onPress={()=>setDocumentsOpen(false)}><Ionicons name="close" size={22} color="#4C5970"/></Pressable>
            </View>
            <ScrollView style={styles.documentScroll} keyboardShouldPersistTaps="handled">
              {documentSlots.map(slot=>{
                const current=findDocument(slot.key);
                return <View key={slot.key} style={styles.documentRow}>
                  <Ionicons name="document-text-outline" size={20} color="#315B85"/>
                  <View style={styles.documentLabel}>
                    <Text style={styles.documentName}>{slot.label}</Text>
                    {current?<Text numberOfLines={1} style={styles.documentFilename}>{current.name}</Text>:null}
                    {slot.key==='education_10th_marksheet'?
                      <View style={styles.educationOptions}>{educationOptions.map(option=>
                        <Pressable key={option.key} accessibilityRole="button" accessibilityLabel={option.label}
                          onPress={()=>setEducationType(option.key)}
                          style={[styles.educationPill,educationType===option.key&&styles.educationSelected]}>
                          <Text style={styles.educationText}>{option.label}</Text>
                        </Pressable>)}</View>:null}
                    {slot.key.startsWith('custom_')?<TextInput
                      placeholder="Document name" placeholderTextColor="#8290A5"
                      value={customNames[slot.key]??current?.label??''}
                      onChangeText={value=>setCustomNames(prev=>({...prev,[slot.key]:value}))}
                      maxLength={60} style={styles.customDocumentName}/>:null}
                  </View>
                  {current?<>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Replace ${slot.label}`}
                      disabled={Boolean(busyDocument)} onPress={()=>void uploadDocument(slot.key)} style={styles.docIconButton}>
                      <Ionicons name="refresh-outline" size={18} color="#24517E"/>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${slot.label}`}
                      disabled={Boolean(busyDocument)} onPress={()=>deleteDocument(slot.key)} style={styles.docIconButton}>
                      <Ionicons name="trash-outline" size={18} color="#C02D3A"/>
                    </Pressable>
                  </>:<Pressable accessibilityRole="button" accessibilityLabel={`Upload ${slot.label}`}
                    disabled={Boolean(busyDocument)} onPress={()=>void uploadDocument(slot.key)} style={styles.docUpload}>
                    {busyDocument===slot.key?<ActivityIndicator size="small" color="#24517E"/>:<Ionicons name="cloud-upload-outline" size={16} color="#24517E"/>}
                    <Text style={styles.docUploadText}>Upload</Text>
                  </Pressable>}
                </View>;
              })}
            </ScrollView>
            <Pressable accessibilityRole="button" accessibilityLabel="Done uploading MISP documents" disabled={Boolean(busyDocument)}
              onPress={()=>{setDocumentsOpen(false);router.replace('/(tabs)/policies');}} style={styles.docDone}>
              <Text style={styles.primaryText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={picker!==null} transparent animationType="fade" onRequestClose={()=>setPicker(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} accessibilityLabel="Close picker" onPress={()=>setPicker(null)}/>
          <View style={styles.modal}>
            <Text style={styles.heading}>{picker==='rm'?'Select RM':picker==='oem'?'Select OEM':'Select Bank'}</Text>
            <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Search…" placeholderTextColor="#98A3B2" autoCapitalize="none"/>
            <ScrollView keyboardShouldPersistTaps="always" style={styles.list}>
              {list.filter(x=>x.name.toLowerCase().includes(search.trim().toLowerCase())).map(option=>
                <Pressable accessibilityRole="button" key={option.id} style={styles.option} onPress={()=>{
                  set(picker==='rm'?'associate_employee_id':picker==='oem'?'oem_name':'bank_id',option.id);
                  Keyboard.dismiss();setPicker(null);
                }}>
                  <Text style={styles.inputText}>{option.name}</Text>
                  {selected===option.id?<Ionicons name="checkmark" size={18} color="#17365D"/>:null}
                </Pressable>
              )}
            </ScrollView>
            <Pressable onPress={()=>setPicker(null)} style={styles.close}><Text style={styles.secondaryText}>Close</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles=StyleSheet.create({
  wrapper:{gap:12},section:{backgroundColor:'#FFFFFF',borderRadius:14,borderWidth:1,borderColor:'#DEE7F1',overflow:'hidden'},
  sectionHeading:{flexDirection:'row',alignItems:'center',gap:10,padding:12,backgroundColor:'#F9FBFD',borderBottomWidth:1,borderBottomColor:'#E1E7F1'},
  index:{width:33,height:33,borderRadius:7,backgroundColor:'#17365D',alignItems:'center',justifyContent:'center'},
  indexText:{color:'#FFF',fontSize:11,fontWeight:'800'},heading:{color:'#000000',fontSize:13,fontWeight:'800'},
  grid:{padding:12,flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:12},
  half:{width:'48.5%',gap:5},pendingItem:{width:"100%",minHeight:42,borderRadius:9,borderWidth:1,borderColor:"#DEE7F1",flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:12},label:{color:'#000000',fontSize:11,fontWeight:'700'},requiredStar:{color:'#DC2626'},
  invalidInput:{borderColor:'#DC2626',backgroundColor:'#FFF9F9'},
  fieldError:{fontSize:10.5,lineHeight:15,color:'#B91C1C',fontWeight:'600'},
  input:{minHeight:44,paddingHorizontal:10,backgroundColor:'#FFF',borderWidth:1,borderColor:'#CED8E7',borderRadius:10,fontSize:12,color:'#152A49'},
  inputPress:{minHeight:44,paddingHorizontal:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:5,borderWidth:1,borderColor:'#CED8E7',borderRadius:10},
  inputText:{color:'#17365D',fontWeight:'600',fontSize:12,flexShrink:1},
  actions:{flexDirection:'row',gap:8,padding:10,marginTop:4,backgroundColor:'#E7EEFC',borderWidth:1,borderColor:'#CBDCFB',borderRadius:12},
  primary:{minHeight:44,backgroundColor:'#4379EF',borderRadius:10,alignItems:'center',justifyContent:'center',paddingHorizontal:8,flex:1,minWidth:0},
  primaryText:{fontSize:12,color:'#FFF',fontWeight:'800'},
  secondary:{minHeight:44,borderRadius:10,alignItems:'center',justifyContent:'center',paddingHorizontal:8,borderColor:'#CED8E7',borderWidth:1,backgroundColor:'#FFF',flex:1,minWidth:0},
  secondaryText:{fontSize:12,color:'#17365D',fontWeight:'800'},disabled:{opacity:.5},
  backdrop:{flex:1,backgroundColor:'#14233B88',justifyContent:'flex-end'},
  modal:{padding:16,gap:12,maxHeight:'80%',backgroundColor:'#FFF',borderTopLeftRadius:18,borderTopRightRadius:18},
  list:{maxHeight:320},option:{minHeight:45,padding:12,borderBottomColor:'#E6ECF4',borderBottomWidth:1,flexDirection:'row',justifyContent:'space-between'},
  close:{minHeight:44,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#DEE7F1',borderRadius:10},
  documentBackdrop:{flex:1,justifyContent:'center',padding:16,backgroundColor:'#14233B88'},
  documentModal:{backgroundColor:'#FFF',borderRadius:18,padding:16,maxHeight:'90%',gap:12},
  documentHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:10,borderBottomWidth:1,borderBottomColor:'#E7EDF5'},
  documentHeading:{color:'#17365D',fontSize:16,fontWeight:'800'},
  documentScroll:{flexGrow:0},documentRow:{flexDirection:'row',alignItems:'center',gap:9,minHeight:53,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#E7EDF5'},
  documentLabel:{flex:1,minWidth:0,gap:4},documentName:{fontSize:12,fontWeight:'700',color:'#000'},
  documentFilename:{fontSize:11,color:'#16805C'},
  docIconButton:{width:34,height:36,borderWidth:1,borderColor:'#D9E3F1',borderRadius:9,alignItems:'center',justifyContent:'center'},
  docUpload:{minHeight:36,paddingHorizontal:9,borderWidth:1,borderColor:'#CBD8E8',borderRadius:9,flexDirection:'row',gap:4,alignItems:'center'},
  docUploadText:{fontSize:11,color:'#24517E',fontWeight:'700'},
  docDone:{minHeight:43,backgroundColor:'#155EBA',borderRadius:10,alignItems:'center',justifyContent:'center'},
  customDocumentName:{minHeight:35,borderWidth:1,borderColor:'#DCE5EF',borderRadius:8,paddingHorizontal:8,fontSize:11,color:'#17365D'},
  educationOptions:{flexDirection:'row',flexWrap:'wrap',gap:4},
  educationPill:{borderWidth:1,borderColor:'#CBD8E8',borderRadius:8,padding:5},
  educationSelected:{backgroundColor:'#E8F2FF'},educationText:{fontSize:10,color:'#17365D'},
});