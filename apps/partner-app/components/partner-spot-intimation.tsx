import { useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerAssets } from '@/lib/partner-assets';
import { savePartnerClaimSpot, type PartnerClaimDetail } from '@/lib/claims';
import { PartnerClaimStepFooter } from '@/components/partner-claim-step-footer';
import { PartnerClaimDocumentUpload } from '@/components/partner-claim-document-upload';
import { getPartnerCurrentLocation } from '@/lib/current-location';

const DOCUMENTS = [
  { title: 'RC Copy', artwork: require('../../mobile-app/assets/brand/spot-intimation/glossy_green_vehicle_document_icon.png') },
  { title: 'Insurance Copy', artwork: require('../../mobile-app/assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png') },
  { title: 'Driver Licence', artwork: require('../../mobile-app/assets/brand/spot-intimation/glossy_purple_id_card_icon.png') },
  { title: 'GR / Load Bill', artwork: require('../../mobile-app/assets/brand/spot-intimation/glossy_orange_delivery_document_icon.png') },
  { title: 'Accident Photo', artwork: require('../../mobile-app/assets/brand/spot-intimation/glossy_pink_camera_document_icon.png') },
  { title: 'Accident Video', artwork: undefined },
] as const;

const CUSTOMER_STAGE_ICON = require('../../mobile-app/assets/claims/claim-intimation.png');
const CUSTOMER_BULK_ICON = require('../../mobile-app/assets/claims/claim-documents.png');

export function PartnerSpotIntimation({ data }: { data: PartnerClaimDetail }) {
  const router = useRouter();
  const initialAccident = splitDateTime(data.claim.accident_at);
  const initialSpot = splitDateTime(data.claim.spot_intimation_at);
  const initialDriver = parseDriver(data.claim.accident_description);
  const [incidentDate, setIncidentDate] = useState(initialAccident.date);
  const [incidentTime, setIncidentTime] = useState(initialAccident.time);
  const [spotDate, setSpotDate] = useState(initialSpot.date);
  const [spotTime, setSpotTime] = useState(initialSpot.time);
  const [driver, setDriver] = useState(initialDriver.name);
  const [phone, setPhone] = useState(initialDriver.phone);
  const [location, setLocation] = useState(data.claim.accident_location || '');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const fillCurrentLocation = async () => {
    if (!editable || locating) return;
    setLocating(true);
    try { setLocation(await getPartnerCurrentLocation()); }
    catch (error) { Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Please enter the location manually.'); }
    finally { setLocating(false); }
  };
  const save = async () => {
    if (saving) return;
    const accident = parseLocalDateTime(incidentDate, incidentTime);
    const spot = parseLocalDateTime(spotDate, spotTime);
    if (!accident || !spot || accident.getTime() > spot.getTime() || spot.getTime() > Date.now() || !driver.trim() || !phone.trim() || !location.trim()) {
      Alert.alert('Complete all required details','Enter valid accident and spot-intimation date/time, driver details and location.'); return;
    }
    setSaving(true);
    try {
      await savePartnerClaimSpot(data.claim.id, accident.toISOString(), spot.toISOString(), location, driver, phone);
      router.replace({ pathname: '/claim/stage', params: { id: data.claim.id, key: 'spot_status' } } as never);
    } catch (e) { Alert.alert('Unable to save',e instanceof Error ? e.message : 'Please try again.'); }
    finally { setSaving(false); }
  };
  const editable = data.claim.current_status === 'Draft' || data.claim.current_status === 'Initial Documents Pending';
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Claim Tracker" style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" color="#FFF" size={23}/></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>Spot Intimation</Text><Text style={styles.headerSubtitle}>Claim Tracker</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroGlowLarge}/><View style={styles.heroGlowSmall}/>
          <View style={styles.heroHeading}><View style={styles.heroCircle}><Image source={CUSTOMER_STAGE_ICON} style={styles.heroIconArtwork} resizeMode="contain"/></View><Text style={styles.heroTitle}>Spot Intimation</Text><Text style={styles.control}>{data.claim.claim_no?.startsWith('CLM-') ? 'Control No. Pending' : (data.claim.claim_no || 'Control No. Pending')}</Text></View>
          <View style={styles.heroRule}/>
          <View style={styles.identityRow}>
            <View style={styles.identity}><View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make) ?? PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View><View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{data.vehicle.vehicle_no || 'Vehicle not recorded'}</Text><Text style={styles.identitySub} numberOfLines={1}>{data.vehicle.make || 'Manufacturer not recorded'}</Text></View></View>
            <View style={styles.identityDivider}/>
            <View style={styles.identity}><View style={styles.logo}><PartnerInsurerLogo name={data.insurer.name} style={styles.logoImage} fallback={PartnerAssets.navigation.claims}/></View><View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{data.policy.policy_no || 'Policy not recorded'}</Text><Text style={styles.identitySub} numberOfLines={2}>{data.insurer.name || 'Insurer not recorded'}</Text></View></View>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.sectionHeading}><View style={styles.sectionArtworkWrap}><Image source={CUSTOMER_STAGE_ICON} style={styles.sectionArtwork} resizeMode="contain"/></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Incident Details</Text><Text style={styles.subtitle}>Accident date, time and first insurer intimation</Text></View></View>
          <EditableField label="Accident Date" required value={incidentDate} onChange={setIncidentDate} placeholder="YYYY-MM-DD" editable={editable} icon="calendar-outline"/>
          <EditableField label="Accident Time" required value={incidentTime} onChange={setIncidentTime} placeholder="HH:mm" editable={editable} icon="time-outline"/>
          <View style={styles.subheading}><Text style={styles.subheadingText}>Spot Intimation</Text></View>
          <EditableField label="Spot Intimation Date" required value={spotDate} onChange={setSpotDate} placeholder="YYYY-MM-DD" editable={editable} icon="calendar-outline"/>
          <EditableField label="Spot Intimation Time" required value={spotTime} onChange={setSpotTime} placeholder="HH:mm" editable={editable} icon="time-outline"/>
          <EditableField label="Driver Name" required value={driver} onChange={setDriver} placeholder="Enter driver name" editable={editable}/>
          <EditableField label="Driver Number" required value={phone} onChange={setPhone} placeholder="Enter mobile number" editable={editable} keyboard="phone-pad"/>
          <View style={styles.locationHeading}><Text style={styles.fieldLabel}>Location <Text style={styles.locationRequired}>*</Text></Text><Pressable accessibilityRole="button" accessibilityLabel="Use Current Location" accessibilityState={{disabled:!editable||locating}} disabled={!editable||locating} style={styles.locationButton} onPress={()=>void fillCurrentLocation()}><Ionicons name="locate-outline" size={16} color="#0B4DA3"/><Text style={styles.locationButtonText}>{locating?"Locating…":"Use Current Location"}</Text></Pressable></View>
          <EditableField label="" value={location} onChange={setLocation} placeholder="Enter accident location" editable={editable}/>
          {!editable ? <Text style={styles.restricted}>This completed stage remains visible for reference. Current claim progression determines whether it can be edited.</Text> : null}
        </View>
        <View style={styles.documentReadyCard}>
          <View style={styles.docsHeading}><Text style={styles.sectionTitle}>Documents for verification</Text><View style={styles.optional}><Text style={styles.optionalText}>Claims desk review</Text></View></View>
          <View style={styles.tiles}>{DOCUMENTS.map(item=><PartnerClaimDocumentUpload key={item.title} claimId={data.claim.id} customerId={data.customer.id} documentType={item.title} milestoneKey="spot_intimation" documents={data.documents} variant="tile" artwork={item.artwork} label={item.title}/>)}</View>
          <PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="Spot Intimation Attachment" milestoneKey="spot_intimation" documents={data.documents} variant="bulk" artwork={CUSTOMER_BULK_ICON} label="Upload multiple documents" subtitle="Select several files now, or tap again later to add more."/>
        </View>
        <View style={styles.voice}><View style={styles.voiceTop}><View style={styles.mic}><Ionicons name="mic-outline" size={28} color="#0A4FA8"/></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Incident Voice Note</Text><Text style={styles.subtitle}>Describe what happened in your own words. Maximum recording time is 2 minutes.</Text></View></View><PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="Incident Voice Note" milestoneKey="spot_intimation" documents={data.documents} variant="voice"/></View>
        <PartnerClaimStepFooter index={0} busy={saving} canContinue={data.claim.current_status === "Draft" || data.claim.current_status === "Initial Documents Pending"} onPrevious={() => router.push("/claim/select-vehicle" as never)} onContinue={() => void save()} continueLabel="Start Claim & Continue" />
      </ScrollView>
      <View style={styles.nav}><Nav title="Home" icon="home" onPress={() => router.push('/(tabs)' as never)}/><Nav title="Business" icon="briefcase-outline" onPress={() => router.push('/(tabs)/business' as never)}/><Nav title="Policies" icon="document-text-outline" onPress={() => router.push('/(tabs)/policies' as never)}/><Nav title="Claims" icon="shield-checkmark-outline" onPress={() => router.push('/(tabs)/claims' as never)}/><Nav title="More" icon="grid-outline" onPress={() => router.push('/(tabs)/more' as never)}/></View>
    </SafeAreaView>
  );
}
function EditableField({label,required,value,onChange,placeholder,editable,icon,keyboard='default'}:{label:string;required?:boolean;value:string;onChange:(value:string)=>void;placeholder:string;editable:boolean;icon?:keyof typeof Ionicons.glyphMap;keyboard?:'default'|'phone-pad'}) {
  const [pickerVisible,setPickerVisible]=useState(false);
  const [draftPickerValue,setDraftPickerValue]=useState<Date>(()=>new Date());
  const mode=icon==='calendar-outline'?'date':icon==='time-outline'?'time':null;
  const now=new Date();
  const pickerValue=(()=>{
    if(mode==='date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed=new Date(value+'T12:00:00');
      if(!Number.isNaN(parsed.getTime()))return parsed;
    }
    if(mode==='time' && /^\d{2}:\d{2}$/.test(value)) {
      const [h,m]=value.split(':').map(Number);
      if(h<24&&m<60){const parsed=new Date();parsed.setHours(h,m,0,0);return parsed;}
    }
    return now;
  })();
  const openPicker=()=>{if(editable&&mode){setDraftPickerValue(pickerValue);setPickerVisible(true);}};
  const pad=(n:number)=>String(n).padStart(2,'0');
  return <View style={styles.fieldWrap}>
    {label ? <Text style={styles.fieldLabel}>{label}{required?<Text style={{color:'#D74747'}}> *</Text>:null}</Text> : null}
    <View style={[styles.field,!editable&&{opacity:.65}]}>
      <TextInput accessibilityLabel={label} editable={editable} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9EABBC" keyboardType={keyboard} style={styles.editableInput}/>
      {icon?<Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label}`} accessibilityState={{disabled:!editable}} disabled={!editable} onPress={openPicker} hitSlop={10} style={{minWidth:36,minHeight:36,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} color="#1857A9" size={20}/></Pressable>:null}
    </View>
    {pickerVisible && mode ? <Modal transparent animationType="fade" visible={pickerVisible} onRequestClose={()=>setPickerVisible(false)}>
      <View style={pickerModalStyles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss date or time picker" onPress={()=>setPickerVisible(false)} style={pickerModalStyles.outside}/>
        <View style={pickerModalStyles.sheet}>
          <DateTimePicker value={draftPickerValue} mode={mode} display={Platform.OS==='ios'?'spinner':'default'} onChange={(event,date)=>{
            if(Platform.OS!=='ios')setPickerVisible(false);
            if(event.type==='dismissed'||!date)return;
            setDraftPickerValue(date);
            if(Platform.OS!=='ios')onChange(mode==='date'? `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`:`${pad(date.getHours())}:${pad(date.getMinutes())}`);
          }}/>
          {Platform.OS==='ios'?<Pressable accessibilityRole="button" accessibilityLabel="Done selecting date or time" onPress={()=>{const date=draftPickerValue;onChange(mode==='date'?`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`:`${pad(date.getHours())}:${pad(date.getMinutes())}`);setPickerVisible(false);}} style={pickerModalStyles.done}><Text style={pickerModalStyles.doneText}>Done</Text></Pressable>:null}
        </View>
      </View>
    </Modal> : null}
  </View>;
}

function splitDateTime(value:string|null|undefined){if(!value)return{date:'',time:''};const date=new Date(value);if(Number.isNaN(date.getTime()))return{date:'',time:''};const pad=(n:number)=>String(n).padStart(2,'0');return{date:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,time:`${pad(date.getHours())}:${pad(date.getMinutes())}`};}
function parseLocalDateTime(date:string,time:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;const parsed=new Date(`${date}T${time}:00`);return Number.isNaN(parsed.getTime())?null:parsed;}
function parseDriver(value:string|null|undefined){const text=value||'';const name=text.match(/^Driver:\s*(.+)$/mi)?.[1]?.trim()||'';const phone=text.match(/^Driver phone:\s*(.+)$/mi)?.[1]?.trim()||'';return{name,phone};}
function Nav({title,icon,onPress}:{title:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void}) {return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.navItem}><View style={styles.navIcon}><Ionicons name={icon} size={20} color="#D3E2F9"/></View><Text style={styles.navLabel}>{title}</Text></Pressable>}
const styles=StyleSheet.create({
screen:{flex:1,backgroundColor:'#EDF6FE'},header:{height:50,backgroundColor:'#081F4C',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:10},back:{width:34,height:34,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1,justifyContent:'center'},headerTitle:{color:'#FFF',fontSize:15,fontWeight:'800'},headerSubtitle:{color:'#DDEBFA',fontSize:10},scroll:{flex:1},content:{paddingHorizontal:13,paddingTop:23,paddingBottom:30,gap:13},
hero:{position:'relative',overflow:'hidden',backgroundColor:'#062D70',borderRadius:18,paddingHorizontal:12,paddingTop:10,paddingBottom:10,shadowColor:'#062D70',shadowOpacity:.16,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:3},heroGlowLarge:{position:'absolute',width:180,height:180,borderRadius:90,backgroundColor:'#0C58C8',right:-95,top:-105,opacity:.26},heroGlowSmall:{position:'absolute',width:110,height:110,borderRadius:55,borderWidth:1,borderColor:'rgba(120,169,255,0.16)',right:-20,top:-62},heroHeading:{flexDirection:'row',alignItems:'center',gap:8,minHeight:32},heroCircle:{height:30,width:30,borderRadius:15,backgroundColor:'#0B51BE',alignItems:'center',justifyContent:'center'},heroIconArtwork:{width:21,height:21},heroTitle:{flex:1,minWidth:0,color:'#FFF',fontSize:17,lineHeight:21,fontWeight:'900'},control:{maxWidth:'38%',color:'#FFF',fontSize:13.5,lineHeight:17,fontWeight:'900',textAlign:'right'},heroRule:{height:1,backgroundColor:'rgba(174,204,255,0.24)',marginTop:8,marginBottom:8},identityRow:{flexDirection:'row',alignItems:'stretch',minWidth:0},identity:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:4},identityDivider:{width:1,backgroundColor:'rgba(174,204,255,0.18)',marginHorizontal:5,marginVertical:1},logo:{backgroundColor:'#FFF',height:44,width:44,borderRadius:11,alignItems:'center',justifyContent:'center'},logoImage:{width:37,height:37},identityCopy:{flex:1,minWidth:0},identityTitle:{color:'#FFF',fontSize:10.4,lineHeight:14,fontWeight:'900'},identitySub:{color:'#EAF2FF',fontSize:8.8,lineHeight:11.5,fontWeight:'700',marginTop:3},
card:{backgroundColor:'#FFF',borderRadius:18,borderColor:'#D7E2EF',borderWidth:1,padding:12,gap:10,shadowColor:'#14375F',shadowOpacity:.04,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:1},sectionHeading:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8,paddingVertical:2},sectionArtworkWrap:{width:38,height:38,alignItems:'center',justifyContent:'center'},sectionArtwork:{width:34,height:34},headingCopy:{flex:1},sectionTitle:{fontSize:12.5,fontWeight:'900',color:'#071D49'},subtitle:{fontSize:9.5,color:'#718198',lineHeight:13,marginTop:2},fieldWrap:{gap:6},fieldLabel:{fontSize:10.5,color:'#172E51',fontWeight:'800'},field:{minHeight:52,borderRadius:14,borderColor:'#D3E0EC',borderWidth:1,backgroundColor:'#FBFDFF',paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},fieldValue:{fontSize:12,color:'#183052',fontWeight:'800'},editableInput:{flex:1,height:47,fontSize:12,color:'#183052',fontWeight:'700'},subheading:{borderTopWidth:1,borderTopColor:'#E3EAF1',paddingTop:15,marginTop:5},subheadingText:{color:'#183052',fontSize:12,fontWeight:'900'},restricted:{fontSize:9,color:'#8191A6',lineHeight:14,marginTop:5},
locationHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},locationRequired:{color:"#D74747"},locationButton:{flexDirection:"row",alignItems:"center",gap:4,paddingVertical:5},locationButtonText:{fontSize:9.5,fontWeight:"800",color:"#0B4DA3"},
documentReadyCard:{borderRadius:18,borderWidth:1,borderColor:'#D7E2EF',backgroundColor:'#FFF',padding:12,shadowColor:'#14375F',shadowOpacity:.05,shadowRadius:9,shadowOffset:{width:0,height:4},elevation:1},docsHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:10},optional:{backgroundColor:'#EEF5FF',paddingVertical:5,paddingHorizontal:9,borderRadius:999},optionalText:{fontSize:8.5,color:'#0A43A3',fontWeight:'900'},tiles:{flexDirection:'row',flexWrap:'wrap',gap:8},
voice:{borderRadius:18,backgroundColor:'#F4F8FE',borderWidth:1,borderColor:'#D3E0EC',padding:12,gap:12},voiceTop:{flexDirection:'row',alignItems:'center',gap:10},mic:{height:48,width:48,backgroundColor:'#E7F0FC',borderRadius:12,alignItems:'center',justifyContent:'center'},disabledRecording:{minHeight:46,backgroundColor:'#315C9F',borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},disabledText:{color:'#FFF',fontSize:11,fontWeight:'800'},nav:{height:61,backgroundColor:'#081F4C',flexDirection:'row',alignItems:'center',justifyContent:'space-around',borderTopLeftRadius:18,borderTopRightRadius:18},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{width:36,height:32,borderRadius:10,backgroundColor:'#193666',alignItems:'center',justifyContent:'center'},navLabel:{fontSize:9,color:'#D1DFF1',fontWeight:'700'}
});

const pickerModalStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(10, 24, 48, 0.3)', paddingHorizontal: 22 },
  outside: { ...StyleSheet.absoluteFillObject },
  sheet: { borderRadius: 18, backgroundColor: '#FFFFFF', padding: 14, overflow: 'hidden' },
  done: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 12 },
  doneText: { color: '#1857A9', fontWeight: '800', fontSize: 16 },
});
