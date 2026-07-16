import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { GroupPageShell } from '@/components/group/group-page-shell';
import { getCurrentSession, getProfile } from '@/lib/auth';
import { customerAccountTitle, getSelectedCustomerContext, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { IndiaLocation, Json, PartnerType, Profile } from '@/lib/types';

type AccountType = Exclude<PartnerType, 'group'>;
type PickedFile = { uri: string; name: string; mimeType: string | null; size: number | null };
type Values = Record<string, string>;
type FileMap = Record<string, PickedFile | undefined>;

const fleetOptions = [['less_than_5','Less than 5'],['5_to_20','5–20'],['20_to_50','20–50'],['more_than_50','More than 50']] as const;
const salesOptions = [['less_than_500','Less than 500'],['500_to_1000','500–1000'],['more_than_1000','More than 1000']] as const;
const maxFileSize = 5 * 1024 * 1024;

export function GroupAddAccountScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groupContext, setGroupContext] = useState<CustomerAccountContext | null>(null);
  const [type, setType] = useState<AccountType | null>(null);
  const [dealershipType, setDealershipType] = useState<'posp' | 'misp'>('posp');
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [files, setFiles] = useState<FileMap>({});
  const [gstRegistered, setGstRegistered] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<IndiaLocation | null>(null);
  const [locationOptions, setLocationOptions] = useState<IndiaLocation[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationSearched, setLocationSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const [nextProfile, context] = await Promise.all([getProfile(session.user.id), getSelectedCustomerContext()]);
        if (!active) return;
        if (!context || context.partner_type !== 'group') {
          setMessage('Open your Group account before adding an associated customer.');
          return;
        }
        setProfile(nextProfile);
        setGroupContext(context);
      } catch {
        if (active) setMessage('We could not prepare the onboarding form. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!profile || !type) return;
    setValues((current) => {
      if (type === 'corporate') return {
        ...current,
        corporate_creator_name: current.corporate_creator_name || profile.full_name || '',
        corporate_creator_mobile: current.corporate_creator_mobile || profile.phone || '',
        corporate_creator_email: current.corporate_creator_email || profile.email || '',
      };
      if (type === 'dealership') return {
        ...current,
        owner_name: current.owner_name || profile.full_name || '',
        phone: current.phone || profile.phone || '',
        email: current.email || profile.email || '',
      };
      return current;
    });
  }, [profile, type]);

  useEffect(() => {
    const query = locationQuery.trim().replace(/[^a-zA-Z\s.'-]/g, '');
    if (query.length < 2 || (selectedLocation && query.toLowerCase() === selectedLocation.city_name.toLowerCase())) {
      setLocationOptions([]);
      setLocationSearching(false);
      setLocationSearched(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setLocationSearching(true);
      setLocationSearched(false);
      const result = await supabase
        .from('india_locations')
        .select('*')
        .ilike('city_name', `%${query}%`)
        .order('city_name')
        .order('state_name')
        .limit(15);
      if (!active) return;
      setLocationSearching(false);
      setLocationSearched(true);
      if (result.error) {
        setLocationOptions([]);
        setMessage('City search is temporarily unavailable. Please try again.');
        return;
      }
      setMessage('');
      setLocationOptions(result.data ?? []);
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [locationQuery, selectedLocation]);

  const steps = useMemo(() => type ? stepDefinitions(type, dealershipType, gstRegistered) : [], [dealershipType, gstRegistered, type]);
  const current = steps[step];

  function setValue(name: string, value: string) { setValues((prev) => ({ ...prev, [name]: value })); }

  function selectPartnerType(next: AccountType) {
    setType(next);
    setStep(0);
    setValues({});
    setFiles({});
    setGstRegistered(false);
    setDealershipType('posp');
    clearLocation();
    setMessage('');
  }

  function leavePartnerType() {
    setType(null);
    setStep(0);
    setValues({});
    setFiles({});
    setGstRegistered(false);
    clearLocation();
    setMessage('');
  }

  function clearLocation() {
    setLocationQuery('');
    setSelectedLocation(null);
    setLocationOptions([]);
    setLocationSearching(false);
    setLocationSearched(false);
  }

  function changeLocationQuery(value: string) {
    setLocationQuery(value);
    setSelectedLocation(null);
    setLocationOptions([]);
    setLocationSearched(false);
    setValues((currentValues) => ({
      ...currentValues,
      city: value,
      state: '',
      postal_code: '',
      india_location_id: '',
    }));
  }

  function chooseLocation(location: IndiaLocation) {
    setSelectedLocation(location);
    setLocationQuery(location.city_name);
    setLocationOptions([]);
    setLocationSearched(false);
    setMessage('');
    setValues((currentValues) => ({
      ...currentValues,
      city: location.city_name,
      state: location.state_name,
      postal_code: location.pincode,
      india_location_id: location.id,
    }));
  }

  async function chooseFile(name: string) {
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > maxFileSize) return setMessage('Each file must be 5 MB or smaller.');
    setFiles((prev) => ({ ...prev, [name]: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null } }));
  }

  function validateCurrent() {
    if (!current) return '';
    for (const field of current.fields) {
      if (field.name === 'city' && field.required && !values.india_location_id) return 'Enter at least 2 letters and select the city from the matching locations.';
      if (field.kind === 'file' && field.required && !files[field.name]) return `Attach ${field.label}.`;
      if (field.kind !== 'file' && field.required && !values[field.name]?.trim()) return `Enter ${field.label}.`;
    }
    return '';
  }

  async function next() {
    setMessage('');
    const validation = validateCurrent();
    if (validation) return setMessage(validation);
    if (step < steps.length - 1) setStep((value) => value + 1);
    else await submit();
  }

  async function submit() {
    if (!type || !groupContext || !profile || submitting) return;
    if (!values.india_location_id) return setMessage('Select the city from the matching locations before submitting.');
    setSubmitting(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const draft: Json = {
        ...values,
        dealership_type: type === 'dealership' ? dealershipType : null,
        is_gst_registered: gstRegistered,
        group_customer_id: groupContext.customer_id,
        group_name: customerAccountTitle(groupContext),
        initiated_from: 'group_mobile',
      };
      const insert = await (supabase.rpc as any)('start_group_associated_onboarding_application', {
        p_group_customer_id: groupContext.customer_id,
        p_partner_type: type,
        p_current_step: steps.length,
        p_applicant_phone: profile.phone,
        p_applicant_email: profile.email,
        p_draft_data: draft,
      });
      if (insert.error || !insert.data) throw new Error(insert.error?.message || 'Application could not be created.');
      for (const [documentType, file] of Object.entries(files)) if (file) await uploadDocument(insert.data.id, documentType, file);
      const submitted = await (supabase.rpc as any)('submit_group_associated_onboarding_application', { p_application_id: insert.data.id, p_draft_data: draft });
      if (submitted.error) throw new Error(submitted.error.message || 'The onboarding application could not be submitted.');
      setSuccess(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The onboarding application could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <GroupPageShell title="Add Associated Customer" subtitle="Preparing onboarding" icon="account-plus-outline"><ActivityIndicator size="large" color="#0A43A3" /></GroupPageShell>;

  return <GroupPageShell title="Add Associated Customer" subtitle={type ? `${partnerTypeLabel(type)} onboarding` : 'Choose the partner type to begin'} icon="account-plus-outline">
    {!type ? <PartnerTypePicker onSelect={selectPartnerType} /> : <>
      <View style={styles.contextCard}><MaterialCommunityIcons name="account-group-outline" size={20} color="#0A43A3" /><View style={styles.flex}><Text style={styles.contextLabel}>Associated with</Text><Text style={styles.contextValue}>{groupContext ? customerAccountTitle(groupContext) : 'Group Account'}</Text></View><Pressable onPress={leavePartnerType}><Text style={styles.changeText}>Change</Text></Pressable></View>
      <View style={styles.stepTrack}>{steps.map((item, index) => <View key={item.title} style={[styles.stepDot, index <= step && styles.stepDotActive]} />)}</View>
      {message ? <View style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B42318" /><Text style={styles.errorText}>{message}</Text></View> : null}
      {current ? <View style={styles.section}><Text style={styles.sectionTitle}>{current.title}</Text><Text style={styles.sectionText}>{current.subtitle}</Text>
        {current.fields.map((field) => {
          if (field.kind === 'switch') return <View key={field.name} style={styles.switchRow}><View style={styles.flex}><Text style={styles.fieldLabel}>{field.label}</Text><Text style={styles.switchHint}>Enable when applicable.</Text></View><Switch value={gstRegistered} onValueChange={setGstRegistered} /></View>;
          if (field.kind === 'choice') return <ChoiceField key={field.name} label={field.label} value={values[field.name] || ''} options={field.options || []} onChange={(value) => { setValue(field.name, value); if (field.name === 'dealership_type') setDealershipType(value as 'posp' | 'misp'); }} />;
          if (field.kind === 'file') return <DocumentField key={field.name} label={field.label} file={files[field.name]} required={field.required} onPress={() => void chooseFile(field.name)} />;
          if (field.name === 'city') return <LocationSearchField key={field.name} query={locationQuery} selected={selectedLocation} options={locationOptions} searching={locationSearching} searched={locationSearched} onChange={changeLocationQuery} onSelect={chooseLocation} />;
          const locationControlled = field.name === 'state' || field.name === 'postal_code';
          return <Field key={field.name} label={field.label} required={field.required} value={values[field.name] || ''} onChangeText={(value) => setValue(field.name, normalize(field.name, value))} keyboardType={field.keyboardType} editable={!field.locked && !locationControlled} />;
        })}
      </View> : null}
      <View style={styles.footerActions}><Pressable disabled={submitting} onPress={() => step > 0 ? setStep((value) => value - 1) : leavePartnerType()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Back</Text></Pressable><Pressable disabled={submitting} onPress={() => void next()} style={[styles.primaryButton, submitting && styles.disabled]}>{submitting ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.primaryButtonText}>{step === steps.length - 1 ? 'Submit for Review' : 'Continue'}</Text><MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" /></>}</Pressable></View>
    </>}
    <Modal visible={success} transparent animationType="fade"><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.successIcon}><MaterialCommunityIcons name="check" size={34} color="#FFFFFF" /></View><Text style={styles.modalTitle}>Onboarding submitted</Text><Text style={styles.modalText}>The new associated customer is now queued for verification under your Group account.</Text><Pressable onPress={() => router.replace('/customer/group/accounts')} style={styles.modalButton}><Text style={styles.modalButtonText}>View Associated Customers</Text></Pressable></View></View></Modal>
  </GroupPageShell>;
}

function PartnerTypePicker({ onSelect }: { onSelect: (type: AccountType) => void }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>Select partner type</Text><Text style={styles.sectionText}>The mobile flow follows the same onboarding format as the website.</Text>{([
    ['corporate','office-building-outline','Corporate','Company details, fleet profile and four login contacts'],
    ['individual_proprietor','account-outline','Individual / Proprietor','Personal KYC, GST, documents and fleet size'],
    ['dealership','storefront-outline','Dealership','POSP or MISP, OEM profile, representative KYC and contacts'],
  ] as const).map(([value,icon,title,body]) => <Pressable key={value} onPress={() => onSelect(value)} style={styles.typeCard}><View style={styles.typeIcon}><MaterialCommunityIcons name={icon} size={25} color="#0A43A3" /></View><View style={styles.typeCopy}><Text style={styles.typeTitle}>{title}</Text><Text style={styles.typeBody}>{body}</Text></View><MaterialCommunityIcons name="chevron-right" size={23} color="#7A8799" /></Pressable>)}</View>;
}

type FieldDef = { name: string; label: string; required?: boolean; kind?: 'text'|'file'|'choice'|'switch'; options?: readonly (readonly [string,string])[]; keyboardType?: 'default'|'phone-pad'|'email-address'|'number-pad'; locked?: boolean };
type StepDef = { title: string; subtitle: string; fields: FieldDef[] };
function stepDefinitions(type: AccountType, dealershipType: 'posp'|'misp', gst: boolean): StepDef[] {
  if (type === 'corporate') return [
    { title:'Company Details', subtitle:'Match the website Corporate onboarding form.', fields:[f('company_name','Company Name',true),f('gst_number','GST Number'),file('gst_copy','GST Certificate'),f('company_pan','Company PAN Number',true),file('company_pan_copy','Company PAN Copy',true)] },
    { title:'Company Address & Fleet', subtitle:'Search and select a verified city; State and PIN Code will be filled automatically.', fields:[f('address_street','Street',true),f('address_locality','Locality'),f('city','City',true),f('state','State',true),f('postal_code','PIN Code',true,'number-pad'),choice('fleet_size_band','Fleet Size',fleetOptions,true)] },
    { title:'Login Contacts', subtitle:'Each contact receives separate mobile OTP access.', fields:[f('corporate_creator_name','Corporate Creator Name',true),f('corporate_creator_mobile','Corporate Creator Mobile',true,'phone-pad'),f('corporate_creator_email','Corporate Creator Email',false,'email-address'),f('ceo_head_name','CEO / Head Name',true),f('ceo_head_mobile','CEO / Head Mobile',true,'phone-pad'),f('ceo_head_email','CEO / Head Email',false,'email-address'),f('admin_head_name','Admin Head Name',true),f('admin_head_mobile','Admin Head Mobile',true,'phone-pad'),f('admin_head_email','Admin Head Email',false,'email-address'),f('dedicated_spoc_name','Dedicated SPOC Name',true),f('dedicated_spoc_mobile','Dedicated SPOC Mobile',true,'phone-pad'),f('dedicated_spoc_email','Dedicated SPOC Email',false,'email-address')] },
    { title:'Review & Submit', subtitle:'Confirm all details before sending the Corporate onboarding for review.', fields:[] },
  ];
  if (type === 'individual_proprietor') return [
    { title:'Personal Information', subtitle:'Use details that match the identity documents.', fields:[f('contact_name','Customer / Proprietor Name',true),f('phone','Mobile Number',true,'phone-pad'),f('email','Email ID',false,'email-address')] },
    { title:'Address Details', subtitle:'Search and select a verified city; State and PIN Code will be filled automatically.', fields:[f('address_street','Street',true),f('address_locality','Locality'),f('city','City',true),f('state','State',true),f('postal_code','PIN Code',true,'number-pad')] },
    { title:'KYC and GST Details', subtitle:'This matches the website KYC and GST section.', fields:[sw('is_gst_registered','GST Registered'),f('pan_number','PAN Number',true),f('aadhaar_number','Aadhaar Number',true,'number-pad'),f('legal_trade_name','Legal Trade Name',gst),...(gst?[f('gst_number','GST Number',true)]:[])] },
    { title:'Documents & Fleet', subtitle:'Upload the same documents required on the website.', fields:[file('pan_copy','PAN Copy',true),file('aadhaar_front','Aadhaar Front',true),file('aadhaar_back','Aadhaar Back',true),...(gst?[file('gst_copy','GST Copy',true)]:[]),choice('fleet_size_band','Fleet Size',fleetOptions,true)] },
    { title:'Review & Submit', subtitle:'Confirm all details before sending the onboarding for review.', fields:[] },
  ];
  const rep = dealershipType === 'posp' ? 'POSP' : 'DP';
  return [
    { title:'Dealership Type', subtitle:'Choose the same category used on the website.', fields:[choice('dealership_type','Type', [['posp','POSP'],['misp','MISP']], true)] },
    { title:'Dealership Details', subtitle:'Owner name and mobile are prefilled from your signed-in Group profile.', fields:[f('dealership_name','Dealership Name',true),f('owner_name','Owner Name',true),f('phone','Mobile Number',true,'phone-pad'),f('email','Email ID',false,'email-address')] },
    { title:'Address & Business Profile', subtitle:'Search and select a verified city; State and PIN Code will be filled automatically.', fields:[f('address_street','Street',true),f('address_locality','Locality'),f('city','City',true),f('state','State',true),f('postal_code','PIN Code',true,'number-pad'),f('oem_name','Dealership OEM',true),choice('yearly_sales_band','Yearly Sales',salesOptions,true)] },
    { title:'GST Details', subtitle:'GST number and certificate become required when enabled.', fields:[sw('is_gst_registered','GST Registered'),...(gst?[f('gst_number','GST Number',true),file('gst_copy','GST Certificate',true)]:[])] },
    { title:`${rep} Information`, subtitle:`Complete the ${rep} identity and document details.`, fields:[f('representative_name',`${rep} Name`,true),f('representative_mobile','Mobile Number',true,'phone-pad'),f('representative_email','Email ID',false,'email-address'),f('representative_aadhaar','Aadhaar Number',true,'number-pad'),file('representative_aadhaar_front','Aadhaar Front',true),file('representative_aadhaar_back','Aadhaar Back',true),f('representative_pan','PAN Card Number',true),file('representative_pan_copy','PAN Card Copy',true)] },
    { title:'Additional Contact Information', subtitle:'Optional website contact roles.', fields:[f('sales_head_name','Sales Head Name'),f('sales_head_mobile','Sales Head Mobile',false,'phone-pad'),f('sales_head_email','Sales Head Email',false,'email-address'),f('bodyshop_head_name','Bodyshop Head Name'),f('bodyshop_head_mobile','Bodyshop Head Mobile',false,'phone-pad'),f('bodyshop_head_email','Bodyshop Head Email',false,'email-address'),f('insurance_head_name','Insurance Head Name'),f('insurance_head_mobile','Insurance Head Mobile',false,'phone-pad'),f('insurance_head_email','Insurance Head Email',false,'email-address'),f('insurance_spoc_name','Insurance SPOC Name'),f('insurance_spoc_mobile','Insurance SPOC Mobile',false,'phone-pad'),f('insurance_spoc_email','Insurance SPOC Email',false,'email-address')] },
    { title:'Review & Submit', subtitle:'Confirm all details before sending the Dealership onboarding for review.', fields:[] },
  ];
}
function f(name:string,label:string,required=false,keyboardType:FieldDef['keyboardType']='default'):FieldDef{return{name,label,required,kind:'text',keyboardType};}
function file(name:string,label:string,required=false):FieldDef{return{name,label,required,kind:'file'};}
function choice(name:string,label:string,options:readonly (readonly [string,string])[],required=false):FieldDef{return{name,label,required,kind:'choice',options};}
function sw(name:string,label:string):FieldDef{return{name,label,kind:'switch'};}
function normalize(name:string,value:string){if(name.includes('mobile')||name==='phone'||name.includes('aadhaar')||name==='postal_code')return value.replace(/\D/g,'').slice(0,name.includes('aadhaar')?12:name==='postal_code'?6:10);if(name.includes('pan')||name==='gst_number')return value.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,name.includes('gst')?15:10);return value;}

async function uploadDocument(applicationId:string,type:string,file:PickedFile){const session=await getCurrentSession();if(!session?.user)throw new Error('Your session expired.');const response=await fetch(file.uri);const body=await response.arrayBuffer();const ext=file.mimeType==='application/pdf'?'pdf':file.mimeType==='image/png'?'png':'jpg';const path=`${applicationId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const upload=await supabase.storage.from('customer-documents').upload(path,body,{contentType:file.mimeType??'application/octet-stream'});if(upload.error)throw upload.error;const result=await (supabase.from('customer_onboarding_documents') as any).upsert({application_id:applicationId,document_type:type,file_name:file.name,storage_bucket:'customer-documents',storage_path:path,mime_type:file.mimeType,file_size:file.size??body.byteLength,verification_status:'pending',uploaded_by:session.user.id},{onConflict:'application_id,document_type'});if(result.error)throw result.error;}
function Field({ label, required, ...props }: React.ComponentProps<typeof TextInput> & { label:string; required?:boolean }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}{required?<Text style={styles.required}> *</Text>:null}</Text><TextInput placeholderTextColor="#9AA7B8" style={[styles.input,props.editable===false&&styles.inputLocked]} {...props} /></View>; }
function LocationSearchField({query,selected,options,searching,searched,onChange,onSelect}:{query:string;selected:IndiaLocation|null;options:IndiaLocation[];searching:boolean;searched:boolean;onChange:(value:string)=>void;onSelect:(location:IndiaLocation)=>void}){return <View style={styles.field}><Text style={styles.fieldLabel}>City <Text style={styles.required}>*</Text></Text><View style={[styles.locationInputShell,selected&&styles.locationInputSelected]}><TextInput value={query} onChangeText={onChange} placeholder="Enter at least 2 letters" placeholderTextColor="#9AA7B8" autoCapitalize="words" style={styles.locationInput}/>{searching?<ActivityIndicator size="small" color="#0A43A3"/>:<MaterialCommunityIcons name={selected?'check-circle':'magnify'} size={19} color={selected?'#12805C':'#607089'}/>}</View>{query.trim().length===1?<Text style={styles.locationHint}>Enter one more letter to search.</Text>:null}{options.length?<View style={styles.locationList}>{options.map((option)=><Pressable key={option.id} onPress={()=>onSelect(option)} style={styles.locationOption}><View style={styles.flex}><Text style={styles.locationCity}>{option.city_name}</Text><Text style={styles.locationMeta}>{[option.district,option.state_name,option.pincode].filter(Boolean).join(' · ')}</Text></View><MaterialCommunityIcons name="chevron-right" size={19} color="#728197"/></Pressable>)}</View>:null}{searched&&!searching&&!selected&&query.trim().length>=2&&!options.length?<Text style={styles.locationEmpty}>No matching city found. Check the spelling and try again.</Text>:null}{selected?<View style={styles.selectedLocation}><MaterialCommunityIcons name="map-marker-check-outline" size={18} color="#12805C"/><View style={styles.flex}><Text style={styles.selectedLocationTitle}>{selected.city_name}, {selected.state_name}</Text><Text style={styles.selectedLocationMeta}>PIN {selected.pincode}{selected.district?` · ${selected.district}`:''}</Text></View></View>:null}</View>;}
function ChoiceField({label,value,options,onChange}:{label:string;value:string;options:readonly (readonly [string,string])[];onChange:(value:string)=>void}){return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.choiceGrid}>{options.map(([key,text])=><Pressable key={key} onPress={()=>onChange(key)} style={[styles.choice,value===key&&styles.choiceActive]}><Text style={[styles.choiceText,value===key&&styles.choiceTextActive]}>{text}</Text></Pressable>)}</View></View>;}
function DocumentField({label,file,required,onPress}:{label:string;file?:PickedFile;required?:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.documentField,file&&styles.documentReady]}><MaterialCommunityIcons name={file?'check-circle':'cloud-upload-outline'} size={22} color={file?'#12805C':'#0A43A3'} /><View style={styles.flex}><Text style={styles.documentTitle}>{label}{required?' *':''}</Text><Text numberOfLines={1} style={styles.documentMeta}>{file?.name||'Tap to choose PDF, JPG or PNG'}</Text></View></Pressable>;}

const styles=StyleSheet.create({flex:{flex:1},contextCard:{minHeight:58,borderRadius:14,backgroundColor:'#EEF5FF',borderWidth:1,borderColor:'#CFE0F8',padding:11,flexDirection:'row',alignItems:'center',gap:9},contextLabel:{color:'#607089',fontSize:9.5,fontWeight:'700'},contextValue:{color:palette.navy,fontSize:12.5,fontWeight:'900',marginTop:1},changeText:{color:'#0A43A3',fontSize:10.5,fontWeight:'900'},stepTrack:{flexDirection:'row',gap:5},stepDot:{flex:1,height:4,borderRadius:999,backgroundColor:'#DCE5EF'},stepDotActive:{backgroundColor:'#0A43A3'},section:{gap:9,borderRadius:17,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DCE6F0',padding:13},sectionTitle:{color:palette.navy,fontSize:16,fontWeight:'900'},sectionText:{color:'#65758B',fontSize:10.5,lineHeight:15,fontWeight:'600',marginBottom:2},typeCard:{minHeight:78,borderRadius:15,borderWidth:1,borderColor:'#DCE6F0',padding:12,flexDirection:'row',alignItems:'center',gap:11},typeIcon:{width:44,height:44,borderRadius:13,backgroundColor:'#EEF5FF',alignItems:'center',justifyContent:'center'},typeCopy:{flex:1},typeTitle:{color:palette.navy,fontSize:14,fontWeight:'900'},typeBody:{color:'#65758B',fontSize:9.8,lineHeight:13,marginTop:2},field:{marginBottom:2},fieldLabel:{color:'#334155',fontSize:10.8,fontWeight:'800',marginBottom:5},required:{color:'#D92D20'},input:{minHeight:48,borderRadius:12,borderWidth:1,borderColor:'#D7E0EA',backgroundColor:'#FFFFFF',paddingHorizontal:12,color:palette.navy,fontSize:13,fontWeight:'600'},inputLocked:{backgroundColor:'#F3F6FA',color:'#607089'},locationInputShell:{minHeight:48,borderRadius:12,borderWidth:1,borderColor:'#D7E0EA',backgroundColor:'#FFFFFF',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8},locationInputSelected:{borderColor:'#8ED7B7',backgroundColor:'#F7FFFB'},locationInput:{flex:1,minHeight:46,color:palette.navy,fontSize:13,fontWeight:'600'},locationHint:{color:'#667085',fontSize:9.5,marginTop:5},locationList:{marginTop:6,borderRadius:12,borderWidth:1,borderColor:'#D7E0EA',backgroundColor:'#FFFFFF',overflow:'hidden'},locationOption:{minHeight:54,paddingHorizontal:11,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:8,borderBottomWidth:1,borderBottomColor:'#EEF2F6'},locationCity:{color:palette.navy,fontSize:11.5,fontWeight:'900'},locationMeta:{color:'#667085',fontSize:9.3,marginTop:2},locationEmpty:{color:'#B42318',fontSize:9.8,lineHeight:14,marginTop:6},selectedLocation:{marginTop:7,minHeight:48,borderRadius:11,backgroundColor:'#F0FBF5',borderWidth:1,borderColor:'#B9E5D1',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:8},selectedLocationTitle:{color:'#0B684C',fontSize:10.8,fontWeight:'900'},selectedLocationMeta:{color:'#4E7869',fontSize:9.2,marginTop:1},choiceGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},choice:{minHeight:38,borderRadius:11,borderWidth:1,borderColor:'#D8E3EF',paddingHorizontal:11,alignItems:'center',justifyContent:'center'},choiceActive:{backgroundColor:'#0A43A3',borderColor:'#0A43A3'},choiceText:{color:'#65758B',fontSize:10.5,fontWeight:'800'},choiceTextActive:{color:'#FFFFFF'},switchRow:{minHeight:52,flexDirection:'row',alignItems:'center',gap:10},switchHint:{color:'#7A8798',fontSize:9.5,marginTop:2},documentField:{minHeight:58,borderRadius:13,borderWidth:1,borderStyle:'dashed',borderColor:'#BCD0E8',backgroundColor:'#F8FBFF',padding:11,flexDirection:'row',alignItems:'center',gap:9},documentReady:{borderStyle:'solid',borderColor:'#B9E5D1',backgroundColor:'#F0FBF5'},documentTitle:{color:palette.navy,fontSize:11.5,fontWeight:'900'},documentMeta:{color:'#667085',fontSize:9.5,marginTop:2},errorBox:{borderRadius:12,backgroundColor:'#FEF3F2',borderWidth:1,borderColor:'#FECDCA',padding:10,flexDirection:'row',gap:8},errorText:{flex:1,color:'#B42318',fontSize:10.5,lineHeight:14},footerActions:{flexDirection:'row',gap:8},secondaryButton:{flex:1,minHeight:48,borderRadius:13,borderWidth:1,borderColor:'#C9D5E3',backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},secondaryButtonText:{color:palette.navy,fontSize:12,fontWeight:'900'},primaryButton:{flex:1.7,minHeight:48,borderRadius:13,backgroundColor:'#0A43A3',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},primaryButtonText:{color:'#FFFFFF',fontSize:12,fontWeight:'900'},disabled:{opacity:.6},modalBackdrop:{flex:1,backgroundColor:'rgba(15,23,42,.48)',alignItems:'center',justifyContent:'center',padding:24},modalCard:{width:'100%',maxWidth:390,borderRadius:20,backgroundColor:'#FFFFFF',padding:24,alignItems:'center'},successIcon:{width:64,height:64,borderRadius:32,backgroundColor:'#21A66B',alignItems:'center',justifyContent:'center'},modalTitle:{marginTop:16,color:palette.navy,fontSize:20,fontWeight:'900'},modalText:{marginTop:8,color:'#59687A',textAlign:'center',lineHeight:20},modalButton:{marginTop:20,minHeight:48,borderRadius:12,backgroundColor:'#0A3B8F',paddingHorizontal:20,alignItems:'center',justifyContent:'center'},modalButtonText:{color:'#FFFFFF',fontWeight:'900'}});
