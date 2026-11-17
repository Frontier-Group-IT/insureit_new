import { partnerAlert } from '@/components/ui/partner-alert-provider';
import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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
const empty=Object.fromEntries(fields.flatMap(section=>section.items.map(item=>[item.key,'']))) as Record<MispField,string>;
const isoDate=(value:string)=>{
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if(!m)return null;
  const date=new Date(Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1])));
  return date.getUTCFullYear()===Number(m[3])&&date.getUTCMonth()===Number(m[2])-1&&date.getUTCDate()===Number(m[1])
    ? m[3]+'-'+m[2]+'-'+m[1]:null;
};
export function MispPartnerForm({rms,banks,oems,pendingMisps,loading,onDirtyChange}:{rms:Option[];banks:Option[];oems:Option[];pendingMisps:Option[];loading:boolean;onDirtyChange:(dirty:boolean)=>void}) {
  const router=useRouter();
  const [form,setForm]=useState(empty);
  const [picker,setPicker]=useState<'rm'|'oem'|'bank'|null>(null);
  const [search,setSearch]=useState('');
  const [dateField,setDateField]=useState<'document_received_at'|'date_of_birth'|null>(null);
  const [saving,setSaving]=useState(false);
  const set=(key:MispField,value:string)=>{
    setForm(prev=>({...prev,[key]:value}));
    onDirtyChange(true);
  };
  const list=picker==='rm'?rms:picker==='oem'?oems:banks;
  const selected=picker==='rm'?form.associate_employee_id:picker==='oem'?form.oem_name:form.bank_id;
  const submit=async (intent:'exit'|'documents')=>{
    if(saving||loading)return;
    const dob=isoDate(form.date_of_birth),received=form.document_received_at.trim()?isoDate(form.document_received_at):null;
    const normalized={
      ...form,partner_type:'misp',date_of_birth:dob,document_received_at:received,
      pan_number:form.pan_number.trim().toUpperCase(),dp_pan_number:form.dp_pan_number.trim().toUpperCase(),
      dp_phone:form.dp_phone.trim().replace(/^\+91/,''),dp_email:form.dp_email.trim().toLowerCase(),
      aadhaar_number:form.aadhaar_number.replace(/\s/g,''),
      bank_account_number:form.bank_account_number.trim(),bank_ifsc_code:form.bank_ifsc_code.trim().toUpperCase(),
      gst_number:form.gst_number.trim().toUpperCase(),postal_code:form.postal_code.trim(),
    };
    if(!form.misp_name.trim()||!form.oem_name||!form.associate_employee_id||!form.dp_first_name.trim()
      ||!/^[A-Z]{5}\d{4}[A-Z]$/.test(normalized.pan_number)
      ||!/^[A-Z]{5}\d{4}[A-Z]$/.test(normalized.dp_pan_number)
      ||!/^[6-9]\d{9}$/.test(normalized.dp_phone)
      ||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.dp_email)
      ||!/^\d{12}$/.test(normalized.aadhaar_number)
      ||!dob||dob>new Date().toISOString().slice(0,10)
      ||(form.document_received_at.trim()&&!received)
      ||!form.address.trim()||!form.city.trim()||!form.state.trim()||!/^\d{6}$/.test(normalized.postal_code)
      ||!form.bank_id||!/^\d{6,20}$/.test(normalized.bank_account_number)
      ||!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized.bank_ifsc_code)
      ||!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized.gst_number)) {
      partnerAlert('Check MISP details','Complete the required MISP, Designated Person, address and bank fields in the same format as the website.');
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
      onDirtyChange(false);
      if(intent==='documents')router.replace({pathname:'/partner-documents',params:{applicationId:result.application_id}} as never);
      else {
        partnerAlert('MISP details saved','Application saved. Continue document upload from the application record.',[
          {text:'OK',onPress:()=>router.replace('/(tabs)/policies')},
        ]);
      }
    } catch(error){partnerAlert('Unable to save MISP',error instanceof Error?error.message:'Please retry.');}
    finally{setSaving(false);}
  };
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
                  <Pressable accessibilityRole="button" accessibilityLabel={'Select '+field.label} disabled={loading}
                    onPress={()=>{if(field.date)setDateField(field.key as 'document_received_at'|'date_of_birth');else{setSearch('');setPicker(field.pick!);}}}
                    style={styles.inputPress}>
                    <Text numberOfLines={1} style={styles.inputText}>{field.date?(form[field.key]||field.hint):(optionName||field.hint)}</Text>
                    <Ionicons name={field.date?'calendar-outline':'chevron-down'} size={18} color="#17365D"/>
                  </Pressable>
                  :<TextInput value={form[field.key]} onChangeText={value=>set(field.key,value)}
                    keyboardType={field.keyboard||'default'} secureTextEntry={Boolean(field.secret)}
                    placeholder={field.hint} placeholderTextColor="#98A3B2"
                    autoCapitalize={['pan_number','dp_pan_number','bank_ifsc_code','gst_number'].includes(field.key)?'characters':field.key==='dp_email'?'none':'sentences'}
                    maxLength={field.key==='aadhaar_number'?12:field.key==='postal_code'?6:field.key==='pan_number'||field.key==='dp_pan_number'?10:field.key==='gst_number'?15:field.key==='bank_ifsc_code'?11:field.key==='address'?300:150}
                    style={styles.input}/>}
              </View>;
            })}
          </View>
        </View>
      ))}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving||loading} onPress={()=>void submit('exit')} style={[styles.secondary,saving&&styles.disabled]}>
          <Text style={styles.secondaryText}>Save & Exit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={saving||loading} onPress={()=>void submit('documents')} style={[styles.primary,saving&&styles.disabled]}>
          <Text style={styles.primaryText}>{saving?'Saving…':'Upload Documents'}</Text>
        </Pressable>
      </View>
      {dateField?<DateTimePicker value={isoDate(form[dateField])?new Date(isoDate(form[dateField])+'T12:00:00'):new Date()}
        mode="date" display={Platform.OS==='ios'?'spinner':'default'} maximumDate={new Date()}
        onChange={(_event,date)=>{if(date){set(dateField,String(date.getDate()).padStart(2,'0')+'/'+String(date.getMonth()+1).padStart(2,'0')+'/'+date.getFullYear());}setDateField(null);}}/>:null}
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
});