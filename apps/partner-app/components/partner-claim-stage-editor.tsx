import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerAssets } from '@/lib/partner-assets';
import { CLAIM_STAGES, type ClaimStageKey } from '@/lib/claim-tracker';
import { savePartnerClaimStage, savePartnerInsurerClaimNumber, type PartnerClaimDetail, type PartnerClaimStageKey } from '@/lib/claims';
import { PartnerClaimStepFooter } from '@/components/partner-claim-step-footer';
import { PartnerClaimDocumentUpload } from '@/components/partner-claim-document-upload';
import { getPartnerCurrentLocation } from '@/lib/current-location';

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
  require('../assets/partner/claim-stages/spot-survey-reference.png'),
];
const APPROVAL_ARTWORK = require('../../mobile-app/assets/claims/claim-approval.png');
const SURVEYOR_APPROVAL_ARTWORK = require('../../mobile-app/assets/claims/claim-survey.png');
const ACCIDENT_VIDEO_ARTWORK = require('../../mobile-app/assets/brand/spot-intimation/glossy_red_video_document_icon.png');
const BULK_ARTWORK = require('../../mobile-app/assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png');

export function PartnerClaimStageEditor({data,stage}:{data:PartnerClaimDetail;stage:EditableStage}) {
  const router=useRouter();
  const config=CONFIG[stage];
  const stageIndex=CLAIM_STAGES.findIndex(item=>item.key===stage);
  const restored=useMemo(()=>latestStageValues(data,stage),[data,stage]);
  const billingValues=useMemo(()=>latestStageValues(data,'billing'),[data]);
  const deliveryOrderValues=useMemo(()=>latestStageValues(data,'delivery_order'),[data]);
  const billAmount=finiteAmount(billingValues.bill_amount);
  const [values,setValues]=useState<Record<string,string>>(restored);
  const doAmount=finiteAmount(values.do_amount);
  const savedDoAmount=finiteAmount(deliveryOrderValues.do_amount);
  const receivedAmount=finiteAmount(values.payment_received_amount);
  const [saving,setSaving]=useState(false);
  const [documentTab,setDocumentTab]=useState('Vehicle Docs');
  const [claimNumberOpen,setClaimNumberOpen]=useState(false);
  const [claimNumber,setClaimNumber]=useState(data.claim.insurer_claim_no ?? '');
  const [claimNumberSaving,setClaimNumberSaving]=useState(false);
  const [locating,setLocating]=useState(false);
  async function fillCurrentLocation(){
    if(locating||saving)return;
    setLocating(true);
    try {setValue('dealership_location',await getPartnerCurrentLocation());}
    catch(error){Alert.alert('Location unavailable',error instanceof Error?error.message:'Please enter the location manually.');}
    finally{setLocating(false);}
  }

  function setValue(key:string,value:string){setValues(current=>({...current,[key]:value}));}
  function previous(){
    const previousStage=CLAIM_STAGES[Math.max(0,stageIndex-1)];
    router.replace({pathname:'/claim/stage',params:{id:data.claim.id,key:previousStage.key}} as never);
  }
  function advance() {
    const next=CLAIM_STAGES[stageIndex+1];
    if(next) router.replace({pathname:'/claim/stage',params:{id:data.claim.id,key:next.key}} as never);
    else router.replace({pathname:'/claim/[id]',params:{id:data.claim.id}} as never);
  }
  function skipClaimNumber(){
    if(claimNumberSaving)return;
    setClaimNumberOpen(false);
    advance();
  }
  async function continueClaimNumber(){
    if(claimNumberSaving)return;
    const value=claimNumber.trim();
    if(!value||value.length>80){Alert.alert('Action required','Enter a valid insurer claim number (up to 80 characters).');return;}
    setClaimNumberSaving(true);
    try{
      await savePartnerInsurerClaimNumber(data.claim.id,value);
      setClaimNumberOpen(false);
      advance();
    }catch(error){
      Alert.alert('Unable to save',error instanceof Error?error.message:'Please try again.');
    }finally{setClaimNumberSaving(false);}
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
      if(stage==='claim_intimation'){
        setClaimNumber(data.claim.insurer_claim_no ?? '');
        setClaimNumberOpen(true);
      }else advance();
    }catch(error){Alert.alert('Unable to save',error instanceof Error?error.message:'Please try again.');}
    finally{setSaving(false);}
  }

  return <SafeAreaView style={styles.root} edges={['top','bottom']}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to Claim Tracker" onPress={()=>router.back()} style={styles.back}><Ionicons name="chevron-back" color="#FFF" size={23}/></Pressable><View style={styles.headerCopy}><Text style={styles.headerTitle}>{config.title}</Text><Text style={styles.headerSubtitle}>Claim Tracker</Text></View></View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <ClaimHero data={data} title={config.title} icon={config.icon}/>
      {stage==='spot_status' ? <>
        <View style={spotStyles.card}>
          <View style={spotStyles.heading}><Image source={require('../../mobile-app/assets/claims/claim-survey.png')} style={spotStyles.artwork} resizeMode="contain"/><Text style={spotStyles.headingText}>Spot Survey</Text></View>
          <EditableField field={{...CONFIG.spot_status.fields[0],label:'Spot Survey Done Date'}} value={values.spot_survey_done_date||''} onChange={(value)=>setValue('spot_survey_done_date',value)} displayDate />
        </View>
        <View style={spotStyles.card}>
          <View style={spotStyles.heading}><Image source={require('../../mobile-app/assets/claims/claim-assessment.png')} style={spotStyles.artwork} resizeMode="contain"/><Text style={spotStyles.headingText}>Surveyor Details</Text><Text style={spotStyles.optional}>Optional</Text></View>
          {CONFIG.spot_status.fields.slice(1).map(field=><EditableField key={field.key} field={{...field,label:`${field.label} (Optional)`}} value={values[field.key]||''} onChange={(value)=>setValue(field.key,value)}/>)}
        </View>
      </> : stage==='work_approval' ? <View style={approvalStyles.card}>
        <View style={styles.sectionHeading}><View style={styles.sectionIcon}><Image source={APPROVAL_ARTWORK} resizeMode="contain" style={styles.approvalHeadingArtwork} accessibilityLabel="Approval stage details" /></View><View style={{flex:1}}><Text style={styles.sectionTitle}>Stage Details</Text><Text style={styles.sectionSubtitle}>{config.subtitle}</Text></View></View>
        {CONFIG.work_approval.fields.map(field=><View key={field.key} style={approvalStyles.fieldBlock}><EditableField field={field.key.startsWith('surveyor_')?{...field,label:`${field.label} (Optional)`}:field} value={values[field.key]||''} onChange={value=>setValue(field.key,value)} displayDate={field.kind==='date'}/></View>)}
      </View> : <View style={styles.card}>
        <View style={[styles.sectionHeading,(stage==='vehicle_delivery'||stage==='payment_encashment')&&styles.vehicleStageHeading]}><View style={(stage==='vehicle_delivery'||stage==='payment_encashment')?styles.vehicleStageIcon:styles.sectionIcon}>{stage==='repair_ri' ? <Image source={require('../assets/repair-ri-stage-icon.png')} resizeMode="contain" style={styles.repairRiStageArtwork} accessibilityLabel="Repair and re-inspection" /> : stage==='vehicle_delivery' ? <View style={styles.deliveryTruckIcon} accessibilityLabel="Vehicle delivered"><MaterialCommunityIcons name="truck" size={27} color="#145A9C"/><View style={styles.deliveryTruckBadge}><Ionicons name="checkmark" size={10} color="#FFFFFF"/></View></View> : stage==='claim_intimation' ? <Image source={require('../../mobile-app/assets/claims/claim-intimation.png')} resizeMode="contain" style={styles.claimIntimationArtwork} accessibilityLabel="Claim intimation stage details" /> : stage==='delivery_order' ? <Image source={require('../../mobile-app/assets/claims/claim-assessment.png')} resizeMode="contain" style={styles.deliveryOrderArtwork} accessibilityLabel="Delivery order stage details" /> : stage==='billing' ? <Image source={require('../../mobile-app/assets/claims/receipts-posted.png')} resizeMode="contain" style={styles.billingStageArtwork} accessibilityLabel="Billing stage details" /> : stage==='payment_encashment' ? <Image source={require('../../mobile-app/assets/claims/accounts-finance.png')} resizeMode="contain" style={styles.paymentStageArtwork} accessibilityLabel="Payment encashment finance artwork" /> : <MaterialCommunityIcons name={config.icon} size={23} color="#0B58A7"/>}</View><View style={{flex:1}}><Text style={styles.sectionTitle}>Stage Details</Text><Text style={styles.sectionSubtitle}>{stage==='vehicle_delivery'?'Confirm whether the repaired vehicle has been received.':config.subtitle}</Text></View></View>
        {config.fields.map(field=><View key={field.key} style={stage==='delivery_order' ? styles.deliveryField : stage==='vehicle_delivery'||stage==='payment_encashment' ? styles.vehicleDeliveryField : undefined}>{field.key==='dealership_location'?<View style={locationStyles.action}><Pressable accessibilityRole="button" accessibilityLabel="Use Current Location" disabled={locating||saving} onPress={()=>void fillCurrentLocation()} style={locationStyles.button}><Ionicons name="locate-outline" size={16} color="#0B4DA3"/><Text style={locationStyles.text}>{locating?"Locating…":"Use Current Location"}</Text></Pressable></View>:null}<View style={(stage==='delivery_order'||stage==='vehicle_delivery'||stage==='payment_encashment')&&field.kind==='choice'?styles.deliveryChoice:undefined}><EditableField field={stage==='vehicle_delivery'&&field.key==='vehicle_received_date'&&['yes','true','1'].includes((values.vehicle_received||'').toLowerCase())?{...field,required:true}:field} value={values[field.key]||''} onChange={(value)=>setValue(field.key,value)} displayDate={(stage==='delivery_order'||stage==='vehicle_delivery'||stage==='payment_encashment')&&field.kind==='date'}/></View></View>)}
        {stage === 'delivery_order' ? <>
          <View style={styles.deliveryUpload}>
            <Text style={styles.billingLabel}>Assistance Upload</Text>
            <PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="Assessment Sheet" milestoneKey="delivery_order" documents={data.documents} variant="assessment" label="Assessment Report (Optional)" />
          </View>
          <View style={styles.financialCard}>
            <View style={styles.financialHeader}><Image source={require("../../mobile-app/assets/claims/accounts-finance.png")} resizeMode="contain" style={styles.paymentFinancialArtwork} accessibilityLabel="Delivery order financial progress" /><View><Text style={styles.financialHeading}>FINANCIAL PROGRESS</Text><Text style={styles.financialSubtitle}>Claim value movement</Text></View></View>
            <View style={styles.financialRow}><Text style={styles.financialText}>Bill Amount</Text><Text style={styles.financialValue}>{formatClaimAmount(billAmount)}</Text></View>
            <View style={styles.financialRow}><Text style={styles.financialText}>DO Amount</Text><Text style={styles.financialValue}>{formatClaimAmount(doAmount)}</Text></View>
            <View style={styles.financialContribution}><Text style={styles.financialValue}>Customer Contribution</Text><Text style={styles.financialValue}>{billAmount!==null&&doAmount!==null&&billAmount>=doAmount?formatClaimAmount(billAmount-doAmount):'—'}</Text></View>
          </View>
        </> : null}
        {stage === 'payment_encashment' ? <View style={styles.financialCard}>
          <View style={styles.financialHeader}><Image source={require('../../mobile-app/assets/claims/accounts-finance.png')} resizeMode="contain" style={styles.paymentFinancialArtwork} accessibilityLabel="Financial progress"/><View><Text style={styles.financialHeading}>FINANCIAL PROGRESS</Text><Text style={styles.financialSubtitle}>Claim value movement</Text></View></View>
          <View style={styles.financialRow}><Text style={styles.financialText}>DO Amount</Text><Text style={styles.financialValue}>{formatClaimAmount(savedDoAmount)}</Text></View>
          <View style={styles.financialRow}><Text style={styles.financialText}>Amount Received</Text><Text style={styles.financialValue}>{formatClaimAmount(receivedAmount)}</Text></View>
          <View style={styles.financialContribution}><Text style={styles.financialValue}>Further Deduction</Text><Text style={styles.financialValue}>{savedDoAmount!==null&&receivedAmount!==null&&savedDoAmount>=receivedAmount?formatClaimAmount(savedDoAmount-receivedAmount):'—'}</Text></View>
        </View> : null}
        {stage === 'billing' ? <View style={styles.billingUpload}>
          <Text style={styles.billingLabel}>Bill Upload</Text>
          <PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="Final Invoice" milestoneKey="billing" documents={data.documents} variant="billing" label="Upload final workshop bill" />
        </View> : null}
      </View>}

      {stage === 'work_approval' ? <View style={approvalStyles.documentsCard}>
        <View style={approvalStyles.documentsHeading}><Image source={APPROVAL_ARTWORK} resizeMode="contain" style={styles.approvalHeadingArtwork} accessibilityLabel="Approval documents" /><Text style={approvalStyles.documentsTitle}>Approval Documents</Text><Text style={approvalStyles.optionalPill}>Optional</Text></View>
        <View style={approvalStyles.documentsRow}>
          <View style={approvalStyles.documentHalf}><PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="Work Approval Letter" tileFullWidth milestoneKey="work_approval" documents={data.documents} variant="tile" artwork={APPROVAL_ARTWORK} label="Insurer Approval Letter"/></View>
          <View style={approvalStyles.documentHalf}><PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="Surveyor Approval" tileFullWidth milestoneKey="work_approval" documents={data.documents} variant="tile" artwork={SURVEYOR_APPROVAL_ARTWORK} label="Surveyor Approval / Report"/></View>
        </View>
        <PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="work_approval Additional Documents" milestoneKey="work_approval" documents={data.documents} variant="bulk" artwork={BULK_ARTWORK} label="Upload Multiple Documents" subtitle="Select several files now, or tap again later to add more."/>
      </View> : null}

      {stage === 'claim_intimation' ? <View style={styles.card}>
        <View style={styles.documentHeader}><Text style={styles.sectionTitle}>Documents for verification</Text><View style={styles.optionalChip}><Text style={styles.optionalText}>Claims desk review</Text></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:10}}>
          {['Vehicle Docs','Driver Docs','Permit / Tax','KYC / Other','Forms'].map((tab,index)=><Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:documentTab===tab}} onPress={()=>setDocumentTab(tab)} style={[styles.docTab,documentTab===tab&&styles.docTabSelected]}><Text style={[styles.docTabText,documentTab===tab&&styles.docTabTextSelected]}>{index+1}. {tab}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.documentGrid}>{STAGE_DOCUMENTS[stage].filter(label=>claimDocumentCategory(label)===documentTab).map(label=><PartnerClaimDocumentUpload key={label} claimId={data.claim.id} customerId={data.customer.id} documentType={label} milestoneKey={stage} documents={data.documents} variant="tile" artwork={label === 'Accident Video' ? ACCIDENT_VIDEO_ARTWORK : DOCUMENT_ARTWORK[STAGE_DOCUMENTS[stage].indexOf(label)%DOCUMENT_ARTWORK.length]} label={label}/>)}</View>
        <PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType={`${stage} Additional Documents`} milestoneKey={stage} documents={data.documents} variant="bulk" artwork={BULK_ARTWORK} label="Upload multiple documents" subtitle="Select several files now, or tap again later to add more."/>
      </View> : null}
      <PartnerClaimStepFooter index={stageIndex} busy={saving} canContinue onPrevious={previous} onContinue={()=>void save()} continueLabel={stage==='payment_encashment'?'Complete Claim':'Save & Continue'}/>
    </ScrollView>
    <Modal visible={claimNumberOpen} transparent animationType="fade" onRequestClose={skipClaimNumber}>
      <View style={claimPopupStyles.backdrop}>
        <View style={claimPopupStyles.card}>
          <View style={claimPopupStyles.icon}><Ionicons name="shield-checkmark-outline" size={28} color="#0B347A"/></View>
          <Text style={claimPopupStyles.title}>Add insurer claim</Text>
          <View style={claimPopupStyles.inputWrap}>
            <Ionicons name="document-text-outline" size={20} color="#0B347A"/>
            <TextInput accessibilityLabel="Enter claim number" placeholder="Enter claim number" placeholderTextColor="#8994A7" style={claimPopupStyles.input} value={claimNumber} onChangeText={setClaimNumber} editable={!claimNumberSaving} maxLength={80} autoCapitalize="characters" returnKeyType="done"/>
          </View>
          <View style={claimPopupStyles.actions}>
            <Pressable accessibilityRole="button" disabled={claimNumberSaving} onPress={skipClaimNumber} style={claimPopupStyles.notNow}><Text style={claimPopupStyles.notNowText}>Not now</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={claimNumberSaving} onPress={()=>void continueClaimNumber()} style={claimPopupStyles.continue}>{claimNumberSaving?<ActivityIndicator color="#FFF"/>:<><Text style={claimPopupStyles.continueText}>Continue</Text><Ionicons name="arrow-forward" size={20} color="#FFF"/></>}</Pressable>
          </View>
        </View>
      </View>
    </Modal>
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

function EditableField({field,value,onChange,displayDate=false}:{field:Field;value:string;onChange:(value:string)=>void;displayDate?:boolean}){
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
        <TextInput accessibilityLabel={field.label} value={isDate&&displayDate&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('-'):value} onChangeText={text=>{if(isDate&&displayDate&&/^\d{2}-\d{2}-\d{4}$/.test(text))onChange(text.split('-').reverse().join('-'));else if(!displayDate)onChange(text);}} editable={!displayDate} placeholder="" placeholderTextColor="#A1ADBC" keyboardType={field.kind==='number'?'decimal-pad':'default'} style={styles.input}/>
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

function finiteAmount(value?:string):number|null {
  if(!value?.trim())return null;
  const amount=Number(value.replace(/[,₹\s]/g,''));
  return Number.isFinite(amount)&&amount>=0?amount:null;
}
function formatClaimAmount(value:number|null):string {
  return value===null?'—':'₹'+value.toLocaleString('en-IN',{maximumFractionDigits:2});
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
  vehicleStageHeading:{marginBottom:8},vehicleStageIcon:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  approvalHeadingArtwork:{width:30,height:30},
  claimIntimationArtwork:{width:32,height:32},
  deliveryOrderArtwork:{width:30,height:30},billingStageArtwork:{width:30,height:30},paymentStageArtwork:{width:32,height:32},paymentFinancialArtwork:{width:32,height:32},
  repairRiStageArtwork:{width:28,height:28},
  deliveryTruckIcon:{width:34,height:32,alignItems:'center',justifyContent:'center'},deliveryTruckBadge:{position:'absolute',right:0,bottom:0,width:15,height:15,borderRadius:8,backgroundColor:'#1AA365',borderWidth:1.5,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},vehicleDeliveryField:{marginTop:8},
  deliveryField:{marginTop:3},deliveryChoice:{maxWidth:260},deliveryUpload:{gap:7,marginTop:12},financialCard:{backgroundColor:'#0B3271',borderRadius:16,padding:13,gap:9,marginTop:3},financialHeader:{flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:'#345688',paddingBottom:11},financialHeading:{color:'#FFF',fontSize:10,fontWeight:'900',letterSpacing:1},financialSubtitle:{color:'#CCD9EB',fontSize:9,marginTop:3},financialRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:5,borderBottomWidth:1,borderBottomColor:'#345688'},financialText:{color:'#D4E0EF',fontSize:11},financialValue:{color:'#FFF',fontSize:11,fontWeight:'900'},financialContribution:{backgroundColor:'#1C437E',flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:9,paddingVertical:12},

  billingUpload:{gap:6,marginTop:2},billingLabel:{fontSize:10.5,fontWeight:'800',color:'#203859'},
  docTab:{paddingHorizontal:10,paddingVertical:12,borderBottomWidth:2,borderBottomColor:'transparent',backgroundColor:'#F8FBFF'},docTabSelected:{borderBottomColor:'#0877EB',backgroundColor:'#EAF4FF'},docTabText:{fontSize:9,color:'#718099',fontWeight:'700'},docTabTextSelected:{color:'#0B58B2'},
  documentHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  optionalChip:{backgroundColor:'#EFF5FF',borderRadius:18,paddingHorizontal:9,paddingVertical:6},
  optionalText:{fontSize:9.5,fontWeight:'700',color:'#164B9B'},

  root:{flex:1,backgroundColor:'#EDF6FE'},header:{height:50,backgroundColor:'#0860C8',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:10},back:{width:34,height:34,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1},headerTitle:{color:'#FFF',fontSize:15,fontWeight:'900'},headerSubtitle:{color:'#DDEBFA',fontSize:10},scroll:{flex:1},content:{paddingHorizontal:13,paddingTop:18,paddingBottom:24,gap:12},
  hero:{backgroundColor:'#07357E',borderRadius:18,padding:12,elevation:3},heroHeading:{flexDirection:'row',alignItems:'center',gap:8},heroCircle:{width:32,height:32,borderRadius:16,backgroundColor:'#165AB1',alignItems:'center',justifyContent:'center'},heroTitle:{flex:1,color:'#FFF',fontSize:15,fontWeight:'900'},control:{maxWidth:'42%',color:'#FFF',fontSize:10.5,fontWeight:'800'},heroRule:{height:1,backgroundColor:'#5E7BA8',marginVertical:10},identityRow:{flexDirection:'row',alignItems:'center',gap:7},identity:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:7},identityDivider:{width:1,height:38,backgroundColor:'#5377A6'},logo:{width:40,height:40,borderRadius:9,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},logoImage:{width:33,height:33},identityCopy:{flex:1,minWidth:0},identityTitle:{color:'#FFF',fontSize:9.5,fontWeight:'900'},identitySub:{color:'#DCE8F8',fontSize:8,marginTop:2},
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

const claimPopupStyles=StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'rgba(3,16,43,0.58)',justifyContent:'center',paddingHorizontal:34},
  card:{backgroundColor:'#FFFFFF',borderRadius:24,paddingHorizontal:20,paddingTop:22,paddingBottom:20,alignItems:'center',gap:22},
  icon:{height:48,width:48,borderRadius:15,backgroundColor:'#EDF4FF',alignItems:'center',justifyContent:'center',borderColor:'#D5E3F6',borderWidth:1},
  title:{fontSize:18,fontWeight:'900',color:'#0C244D',textAlign:'center'},
  inputWrap:{width:'100%',height:61,borderColor:'#16519B',borderWidth:1.5,borderRadius:15,flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:12},
  input:{flex:1,color:'#142A4D',fontSize:13,fontWeight:'700'},
  actions:{width:'100%',flexDirection:'row',gap:10},
  notNow:{flex:1,minHeight:56,borderRadius:14,borderColor:'#D6DCE5',borderWidth:1,alignItems:'center',justifyContent:'center'},
  notNowText:{fontSize:12,color:'#273955',fontWeight:'800'},
  continue:{flex:1.2,minHeight:56,borderRadius:14,backgroundColor:'#104AA5',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  continueText:{fontSize:12,color:'#FFF',fontWeight:'800'}
});

const spotStyles=StyleSheet.create({
 card:{backgroundColor:'#FFFFFF',borderRadius:20,borderWidth:1,borderColor:'#D6E2EC',padding:16,gap:17},
 heading:{flexDirection:'row',alignItems:'center',gap:10,minHeight:37,marginBottom:4},
 artwork:{width:34,height:34},
 headingText:{fontSize:13,fontWeight:'900',color:'#152D50'},
 optional:{color:'#8290A1',fontSize:10,fontWeight:'700'},
});

const locationStyles=StyleSheet.create({action:{alignItems:'flex-end',marginBottom:2},button:{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:3},text:{fontSize:10,color:'#0B4DA3',fontWeight:'800'}});

const approvalStyles=StyleSheet.create({
 card:{backgroundColor:'#FFF',borderRadius:19,borderWidth:1,borderColor:'#D7E2EC',padding:14,gap:13},
 fieldBlock:{marginTop:2},
 documentsCard:{backgroundColor:'#FFF',borderRadius:19,borderWidth:1,borderColor:'#D7E2EC',padding:13,gap:12},
 documentsHeading:{flexDirection:'row',alignItems:'center',gap:9},
 documentsTitle:{fontSize:12,fontWeight:'900',color:'#14284B',flex:1},
 optionalPill:{backgroundColor:'#EDF4FF',borderRadius:16,paddingHorizontal:9,paddingVertical:5,color:'#1554A1',fontSize:9,fontWeight:'800'},
 documentsRow:{flexDirection:'row',gap:10},
 documentHalf:{flex:1,minWidth:0},
});
