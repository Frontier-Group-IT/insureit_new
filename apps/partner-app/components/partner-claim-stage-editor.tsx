import { useMemo, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerAssets } from '@/lib/partner-assets';
import { CLAIM_STAGES, type ClaimStageKey } from '@/lib/claim-tracker';
import { savePartnerClaimStage, type PartnerClaimDetail, type PartnerClaimStageKey } from '@/lib/claims';
import { PartnerClaimStepFooter } from '@/components/partner-claim-step-footer';
import { PartnerClaimDocumentUpload } from '@/components/partner-claim-document-upload';

type EditableStage = Exclude<PartnerClaimStageKey, never>;
type Field = { key:string; label:string; required?:boolean; kind?:'text'|'date'|'number'|'choice'; options?:Array<{label:string;value:string}>; placeholder?:string };
type Config = { title:string; subtitle:string; icon:keyof typeof MaterialCommunityIcons.glyphMap; fields:Field[] };

const CONFIG:Record<EditableStage,Config>={
  spot_status:{title:'Spot Status',subtitle:'Record spot survey and surveyor details',icon:'car-search',fields:[
    {key:'spot_survey_done_date',label:'Spot Survey Done Date',required:true,kind:'date'},
    {key:'surveyor_name',label:'Surveyor Name',placeholder:'Enter surveyor name'},
    {key:'surveyor_email',label:'Surveyor Email',placeholder:'Enter surveyor email'},
    {key:'surveyor_phone',label:'Surveyor Number',placeholder:'Enter mobile number'},
  ]},
  claim_intimation:{title:'Claim Intimation',subtitle:'Record claim intimation, workshop and estimate details',icon:'clipboard-text-outline',fields:[
    {key:'claim_intimation_date',label:'Claim Intimation Date',required:true,kind:'date'},
    {key:'dealership_name',label:'Dealership Name',required:true},
    {key:'dealership_location',label:'Dealership Location',required:true},
    {key:'gate_in_date',label:'Gate-in Date',required:true,kind:'date'},
    {key:'estimate_amount',label:'Estimate Amount',required:true,kind:'number',placeholder:'₹ 0'},
  ]},
  work_approval:{title:'Work Approval',subtitle:'Record approval and surveyor details',icon:'clipboard-check-outline',fields:[
    {key:'approval_received_date',label:'Approval Received Date',required:true,kind:'date'},
    {key:'cashless',label:'Cashless Claim',required:true,kind:'choice',options:[{label:'Yes',value:'true'},{label:'No',value:'false'}]},
    {key:'surveyor_name',label:'Surveyor Name'},
    {key:'surveyor_phone',label:'Surveyor Phone'},
    {key:'surveyor_email',label:'Surveyor Email'},
  ]},
  repair_ri:{title:'Repair & RI',subtitle:'Repair completion and re-inspection details',icon:'clipboard-search-outline',fields:[
    {key:'repair_complete_date',label:'Repair Complete Date',required:true,kind:'date'},
    {key:'ri_requested_date',label:'RI Requested Date',kind:'date'},
    {key:'ri_done_date',label:'RI Done Date',required:true,kind:'date'},
  ]},
  billing:{title:'Billing',subtitle:'Record the final workshop bill',icon:'receipt-text-check-outline',fields:[
    {key:'bill_date',label:'Bill Date',required:true,kind:'date'},
    {key:'bill_amount',label:'Bill Amount',required:true,kind:'number',placeholder:'₹ 0'},
  ]},
  delivery_order:{title:'Delivery Order',subtitle:'Record assessment and delivery order details',icon:'file-document-multiple-outline',fields:[
    {key:'assessment_received',label:'Assessment Received?',required:true,kind:'choice',options:[{label:'Yes',value:'yes'},{label:'No',value:'no'}]},
    {key:'do_date',label:'DO Date',required:true,kind:'date'},
    {key:'do_amount',label:'DO Amount',required:true,kind:'number',placeholder:'₹ 0'},
  ]},
  vehicle_delivery:{title:'Vehicle Delivery',subtitle:'Confirm whether the repaired vehicle has been received',icon:'truck-check-outline',fields:[
    {key:'vehicle_received',label:'Vehicle Received?',required:true,kind:'choice',options:[{label:'Yes',value:'yes'},{label:'Not Yet',value:'no'}]},
    {key:'vehicle_received_date',label:'Vehicle Received Date',kind:'date'},
  ]},
  payment_encashment:{title:'Payment Encashment',subtitle:'Record final documents and settlement payment',icon:'cash-check',fields:[
    {key:'depreciation_slip_submitted',label:'Depreciation Slip Submitted?',required:true,kind:'choice',options:[{label:'Yes',value:'yes'},{label:'No',value:'no'}]},
    {key:'satisfaction_voucher_submitted',label:'Satisfaction Voucher Submitted?',required:true,kind:'choice',options:[{label:'Yes',value:'yes'},{label:'No',value:'no'}]},
    {key:'documents_submit_date',label:'Documents Submit Date',kind:'date'},
    {key:'payment_received_date',label:'Payment Received Date',required:true,kind:'date'},
    {key:'payment_received_amount',label:'Amount Received',required:true,kind:'number',placeholder:'₹ 0'},
  ]},
};

const CLAIM_INTIMATION_DOCS=['RC Copy','Insurance Copy','Fitness Copy','GR / Load Bill','Fasttag report last 15 days','Spot Report','Estimate Copy','Driver Licence','Driver Aadhaar front','Driver Aadhaar back','Driver Statement','Road Tax','Local Permit A','Local Permit B','National Permit','Authorization Letter','Aadhaar','PAN','GST','Cancelled Cheque','KYC Form','Claim Form','TP Affidavit','Towing Bill','Repair Estimate','NCB Verification'];

const STAGE_DOCUMENTS: Record<EditableStage, string[]> = {
  spot_status: ['Spot Survey Report', 'Surveyor Documents', 'Spot Photos'],
  claim_intimation: CLAIM_INTIMATION_DOCS,
  work_approval: ['Work Approval Letter', 'Surveyor Approval', 'Approval Photo', 'Repair Estimate', 'Work Order', 'Other Document'],
  repair_ri: ['Repair Photos', 'Re-inspection Report', 'Repair Completion Report'],
  billing: ['Final Invoice', 'Repair Bill', 'Payment Invoice'],
  delivery_order: ['Assessment Sheet', 'Delivery Order', 'DO Approval'],
  vehicle_delivery: ['Vehicle Delivery Receipt', 'Customer Acknowledgement', 'Delivery Photos'],
  payment_encashment: ['Satisfaction Voucher', 'Payment Proof', 'Depreciation Slip', 'Settlement Letter'],
};
const DOCUMENT_ARTWORK = [
  require('../../mobile-app/assets/brand/spot-intimation/glossy_green_vehicle_document_icon.png'),
  require('../../mobile-app/assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png'),
  require('../../mobile-app/assets/brand/spot-intimation/glossy_purple_id_card_icon.png'),
  require('../../mobile-app/assets/brand/spot-intimation/glossy_orange_delivery_document_icon.png'),
  require('../../mobile-app/assets/brand/spot-intimation/glossy_pink_camera_document_icon.png'),
];
const BULK_ARTWORK = require('../../mobile-app/assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png');

export function PartnerClaimStageEditor({data,stage}:{data:PartnerClaimDetail;stage:EditableStage}) {
  const router=useRouter();
  const config=CONFIG[stage];
  const stageIndex=CLAIM_STAGES.findIndex(item=>item.key===stage);
  const restored=useMemo(()=>latestStageValues(data,stage),[data,stage]);
  const [values,setValues]=useState<Record<string,string>>(restored);
  const [saving,setSaving]=useState(false);
  const [documentTab,setDocumentTab]=useState('Vehicle Docs');

  function setValue(key:string,value:string){setValues(current=>({...current,[key]:value}));}
  function previous(){
    const previousStage=CLAIM_STAGES[Math.max(0,stageIndex-1)];
    router.replace({pathname:'/claim/stage',params:{id:data.claim.id,key:previousStage.key}} as never);
  }
  async function save(){
    if(saving)return;
    for(const field of config.fields){
      if(field.required&&!String(values[field.key]??'').trim()){Alert.alert('Complete required fields',`${field.label} is required.`);return;}
    }
    if(stage==='vehicle_delivery'&&['yes','true','1'].includes((values.vehicle_received||'').toLowerCase())&&!values.vehicle_received_date?.trim()){
      Alert.alert('Complete required fields','Vehicle Received Date is required.');return;
    }
    setSaving(true);
    try{
      const payload:Record<string,string|number|boolean>={};
      for(const [key,value] of Object.entries(values)){
        const trimmed=value.trim(); if(!trimmed)continue;
        payload[key]=/amount/i.test(key)&&Number.isFinite(Number(trimmed.replace(/,/g,'')))?Number(trimmed.replace(/,/g,'')):trimmed;
      }
      await savePartnerClaimStage(data.claim.id,stage,payload,true);
      const next=CLAIM_STAGES[stageIndex+1];
      if(next) router.replace({pathname:'/claim/stage',params:{id:data.claim.id,key:next.key}} as never);
      else router.replace({pathname:'/claim/[id]',params:{id:data.claim.id}} as never);
    }catch(error){Alert.alert('Unable to save',error instanceof Error?error.message:'Please try again.');}
    finally{setSaving(false);}
  }

  return <SafeAreaView style={styles.root} edges={['top','bottom']}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to Claim Tracker" onPress={()=>router.back()} style={styles.back}><Ionicons name="chevron-back" color="#FFF" size={23}/></Pressable><View style={styles.headerCopy}><Text style={styles.headerTitle}>{config.title}</Text><Text style={styles.headerSubtitle}>Claim Tracker</Text></View></View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <ClaimHero data={data} title={config.title} icon={config.icon}/>
      <View style={styles.card}>
        <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name={config.icon} size={23} color="#0B58A7"/></View><View style={{flex:1}}><Text style={styles.sectionTitle}>Stage Details</Text><Text style={styles.sectionSubtitle}>{config.subtitle}</Text></View></View>
        {config.fields.map(field=><EditableField key={field.key} field={field} value={values[field.key]||''} onChange={(value)=>setValue(field.key,value)}/>)}
        {stage === 'billing' ? <View style={styles.billingUpload}>
          <Text style={styles.billingLabel}>Bill Upload</Text>
          <PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="Final Invoice" milestoneKey="billing" documents={data.documents} variant="billing" label="Upload final workshop bill" />
        </View> : null}
      </View>

      {stage === 'claim_intimation' ? <View style={styles.card}>
        <View style={styles.documentHeader}><Text style={styles.sectionTitle}>Documents for verification</Text><View style={styles.optionalChip}><Text style={styles.optionalText}>Claims desk review</Text></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:10}}>
          {['Vehicle Docs','Driver Docs','Permit / Tax','KYC / Other','Forms'].map((tab,index)=><Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:documentTab===tab}} onPress={()=>setDocumentTab(tab)} style={[styles.docTab,documentTab===tab&&styles.docTabSelected]}><Text style={[styles.docTabText,documentTab===tab&&styles.docTabTextSelected]}>{index+1}. {tab}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.documentGrid}>{STAGE_DOCUMENTS[stage].filter(label=>claimDocumentCategory(label)===documentTab).map(label=><PartnerClaimDocumentUpload key={label} claimId={data.claim.id} customerId={data.customer.id} documentType={label} milestoneKey={stage} documents={data.documents} variant="tile" artwork={DOCUMENT_ARTWORK[STAGE_DOCUMENTS[stage].indexOf(label)%DOCUMENT_ARTWORK.length]} label={label}/>)}</View>
        <PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType={`${stage} Additional Documents`} milestoneKey={stage} documents={data.documents} variant="bulk" artwork={BULK_ARTWORK} label="Upload multiple documents" subtitle="Select several files now, or tap again later to add more."/>
      </View> : null}
      <PartnerClaimStepFooter index={stageIndex} busy={saving} canContinue onPrevious={previous} onContinue={()=>void save()} continueLabel={stage==='payment_encashment'?'Complete Claim':'Save & Continue'}/>
    </ScrollView>
    <View style={styles.nav}><Nav label="Home" icon="home" onPress={()=>router.push('/(tabs)' as never)}/><Nav label="Business" icon="briefcase-outline" onPress={()=>router.push('/(tabs)/business' as never)}/><Nav label="Policies" icon="document-text-outline" onPress={()=>router.push('/(tabs)/policies' as never)}/><Nav label="Claims" icon="shield-checkmark-outline" onPress={()=>router.push('/(tabs)/claims' as never)}/><Nav label="More" icon="grid-outline" onPress={()=>router.push('/(tabs)/more' as never)}/></View>
  </SafeAreaView>;
}

function claimDocumentCategory(label:string){
  if (['RC Copy','Insurance Copy','Fitness Copy','GR / Load Bill','Fasttag report last 15 days','Spot Report','Estimate Copy'].includes(label)) return 'Vehicle Docs';
  if (['Driver Licence','Driver Aadhaar front','Driver Aadhaar back','Driver Statement'].includes(label)) return 'Driver Docs';
  if (['Road Tax','Local Permit A','Local Permit B','National Permit','Authorization Letter'].includes(label)) return 'Permit / Tax';
  if (['Aadhaar','PAN','GST','Cancelled Cheque','KYC Form'].includes(label)) return 'KYC / Other';
  return 'Forms';
}

function EditableField({field,value,onChange}:{field:Field;value:string;onChange:(value:string)=>void}){
  const [pickerVisible,setPickerVisible]=useState(false);
  const [draftPickerValue,setDraftPickerValue]=useState<Date>(()=>new Date());
  const isDate=field.kind==='date';
  const parsedDate=/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+'T12:00:00'):null;
  const pickerValue=parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  const pad=(n:number)=>String(n).padStart(2,'0');
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{field.label}{field.required?<Text style={styles.required}> *</Text>:null}</Text>
    {field.kind==='choice'?<View style={styles.choiceRow}>{(field.options||[]).map(option=><Pressable key={option.value} accessibilityRole="button" accessibilityState={{selected:value===option.value}} onPress={()=>onChange(option.value)} style={[styles.choice,value===option.value&&styles.choiceSelected]}><Text style={[styles.choiceText,value===option.value&&styles.choiceTextSelected]}>{option.label}</Text></Pressable>)}</View>
    :<>
      <View style={styles.inputShell}>
        <TextInput accessibilityLabel={field.label} value={value} onChangeText={onChange} placeholder={field.placeholder||(isDate?'YYYY-MM-DD':`Enter ${field.label.toLowerCase()}`)} placeholderTextColor="#A1ADBC" keyboardType={field.kind==='number'?'decimal-pad':'default'} style={styles.input}/>
        {isDate?<Pressable accessibilityRole="button" accessibilityLabel={`Choose ${field.label}`} onPress={()=>{setDraftPickerValue(pickerValue);setPickerVisible(true);}} hitSlop={10} style={styles.calendarButton}><Ionicons name="calendar-outline" size={20} color="#1857A9"/></Pressable>:null}
      </View>
      {isDate&&pickerVisible?<Modal transparent animationType="fade" visible={pickerVisible} onRequestClose={()=>setPickerVisible(false)}>
        <View style={pickerModalStyles.backdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss date picker" onPress={()=>setPickerVisible(false)} style={pickerModalStyles.outside}/>
          <View style={pickerModalStyles.sheet}>
            <DateTimePicker value={draftPickerValue} mode="date" display={Platform.OS==='ios'?'spinner':'default'} onChange={(event,date)=>{
              if(Platform.OS!=='ios')setPickerVisible(false);
              if(event.type==='dismissed'||!date)return;
              setDraftPickerValue(date);
              if(Platform.OS!=='ios')onChange(`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`);
            }}/>
            {Platform.OS==='ios'?<Pressable accessibilityRole="button" accessibilityLabel={`Done selecting ${field.label}`} onPress={()=>{const date=draftPickerValue;onChange(`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`);setPickerVisible(false);}} style={pickerModalStyles.done}><Text style={pickerModalStyles.doneText}>Done</Text></Pressable>:null}
          </View>
        </View>
      </Modal>:null}
    </>}
  </View>;
}

function ClaimHero({data,title,icon}:{data:PartnerClaimDetail;title:string;icon:keyof typeof MaterialCommunityIcons.glyphMap}){
  return <View style={styles.hero}><View style={styles.heroHeading}><View style={styles.heroCircle}><MaterialCommunityIcons name={icon} size={20} color="#FFF"/></View><Text style={styles.heroTitle}>{title}</Text><Text numberOfLines={1} style={styles.control}>{data.claim.claim_no||'Not recorded'}</Text></View><View style={styles.heroRule}/><View style={styles.identityRow}><View style={styles.identity}><View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make)??PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View><View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{data.vehicle.vehicle_no||'Vehicle not recorded'}</Text><Text numberOfLines={1} style={styles.identitySub}>{data.vehicle.make||'Manufacturer not recorded'}</Text></View></View><View style={styles.identityDivider}/><View style={styles.identity}><View style={styles.logo}><PartnerInsurerLogo name={data.insurer.name} style={styles.logoImage} fallback={PartnerAssets.navigation.claims}/></View><View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{data.policy.policy_no||'Policy not recorded'}</Text><Text numberOfLines={2} style={styles.identitySub}>{data.insurer.name||'Insurer not recorded'}</Text></View></View></View></View>;
}

function latestStageValues(data:PartnerClaimDetail,stage:ClaimStageKey){
  const result:Record<string,string>={};
  for(const item of data.stages){
    const details=item.details;
    if(!details||typeof details!=='object') continue;
    if(details.milestone_key!==stage) continue;
    for(const [key,value] of Object.entries(details)){
      if(key==='milestone_key'||key==='completed_at'||value===null||value===undefined) continue;
      result[key]=String(value);
    }
  }
  if(stage==='claim_intimation'&&data.claim.estimated_loss!=null&&!result.estimate_amount) result.estimate_amount=String(data.claim.estimated_loss);
  if(stage==='payment_encashment'&&data.claim.settlement_amount!=null&&!result.payment_received_amount) result.payment_received_amount=String(data.claim.settlement_amount);
  return result;
}
function Nav({label,icon,onPress}:{label:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.navItem}><View style={styles.navIcon}><Ionicons name={icon} size={19} color="#D8E5F8"/></View><Text style={styles.navLabel}>{label}</Text></Pressable>;}

const styles=StyleSheet.create({
  docTab:{paddingHorizontal:10,paddingVertical:12,borderBottomWidth:2,borderBottomColor:'transparent',backgroundColor:'#F8FBFF'},docTabSelected:{borderBottomColor:'#0877EB',backgroundColor:'#EAF4FF'},docTabText:{fontSize:9,color:'#718099',fontWeight:'700'},docTabTextSelected:{color:'#0B58B2'},
  documentHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  optionalChip:{backgroundColor:'#EFF5FF',borderRadius:18,paddingHorizontal:9,paddingVertical:6},
  optionalText:{fontSize:9.5,fontWeight:'700',color:'#164B9B'},

  root:{flex:1,backgroundColor:'#EDF6FE'},header:{height:50,backgroundColor:'#0860C8',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:10},back:{width:34,height:34,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1},headerTitle:{color:'#FFF',fontSize:15,fontWeight:'900'},headerSubtitle:{color:'#DDEBFA',fontSize:10},scroll:{flex:1},content:{paddingHorizontal:13,paddingTop:18,paddingBottom:24,gap:12},
  hero:{backgroundColor:'#07357E',borderRadius:18,padding:12,elevation:3},heroHeading:{flexDirection:'row',alignItems:'center',gap:8},heroCircle:{width:32,height:32,borderRadius:16,backgroundColor:'#165AB1',alignItems:'center',justifyContent:'center'},heroTitle:{flex:1,color:'#FFF',fontSize:15,fontWeight:'900'},control:{maxWidth:'42%',color:'#FFF',fontSize:10.5,fontWeight:'800'},heroRule:{height:1,backgroundColor:'#5E7BA8',marginVertical:10},identityRow:{flexDirection:'row',alignItems:'center',gap:7},identity:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:7},identityDivider:{width:1,height:38,backgroundColor:'#5377A6'},logo:{width:40,height:40,borderRadius:9,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},logoImage:{width:33,height:33},identityCopy:{flex:1,minWidth:0},identityTitle:{color:'#FFF',fontSize:9.5,fontWeight:'900'},identitySub:{color:'#DCE8F8',fontSize:8,marginTop:2},
  billingUpload:{gap:6,marginTop:2},billingLabel:{fontSize:10.5,fontWeight:'800',color:'#203859'},
  card:{backgroundColor:'#FFF',borderRadius:18,borderWidth:1,borderColor:'#D7E2EC',padding:13,gap:10},sectionHeading:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:3},sectionIcon:{width:36,height:36,borderRadius:12,backgroundColor:'#EDF5FF',alignItems:'center',justifyContent:'center'},sectionTitle:{fontSize:12.5,fontWeight:'900',color:'#14284B'},sectionSubtitle:{fontSize:9.5,color:'#7D8B9F',marginTop:2},
  fieldWrap:{gap:5},fieldLabel:{fontSize:10.5,fontWeight:'800',color:'#203859'},required:{color:'#D94B4B'},inputShell:{minHeight:47,borderRadius:12,borderWidth:1,borderColor:'#CFDCE9',backgroundColor:'#FBFDFF',paddingHorizontal:11,flexDirection:'row',alignItems:'center'},input:{flex:1,height:45,fontSize:12,color:'#183052',fontWeight:'700'},calendarButton:{minWidth:36,minHeight:36,alignItems:'center',justifyContent:'center'},pickerDone:{alignSelf:'flex-end',padding:10},pickerDoneText:{color:'#1857A9',fontWeight:'800'},choiceRow:{flexDirection:'row',gap:8},choice:{flex:1,minHeight:43,borderRadius:11,borderWidth:1,borderColor:'#D5E0EA',backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},choiceSelected:{backgroundColor:'#EAF3FF',borderColor:'#1768C9'},choiceText:{fontSize:11,fontWeight:'800',color:'#78889D'},choiceTextSelected:{color:'#0B52A5'},documentGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},documentTile:{width:'31.5%',minHeight:132,borderRadius:12,borderWidth:1,borderColor:'#DDE6EF',backgroundColor:'#F8FBFF',padding:7,alignItems:'center',gap:6},documentGlyph:{width:34,height:34,borderRadius:8,backgroundColor:'#1768C9',alignItems:'center',justifyContent:'center'},documentLabel:{fontSize:8.5,fontWeight:'900',color:'#203552',textAlign:'center',minHeight:22},
  nav:{height:61,backgroundColor:'#081F4C',borderTopLeftRadius:17,borderTopRightRadius:17,flexDirection:'row',alignItems:'center'},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{width:34,height:32,borderRadius:11,backgroundColor:'#193869',alignItems:'center',justifyContent:'center'},navLabel:{fontSize:9,color:'#D3E0F3',fontWeight:'700'},
});

const pickerModalStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(10, 24, 48, 0.3)', paddingHorizontal: 22 },
  outside: { ...StyleSheet.absoluteFillObject },
  sheet: { borderRadius: 18, backgroundColor: '#FFFFFF', padding: 14, overflow: 'hidden' },
  done: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 12 },
  doneText: { color: '#1857A9', fontWeight: '800', fontSize: 16 },
});
