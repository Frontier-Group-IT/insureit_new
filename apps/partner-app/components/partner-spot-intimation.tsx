import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerAssets } from '@/lib/partner-assets';
import { savePartnerClaimSpot, type PartnerClaimDetail } from '@/lib/claims';
import { PartnerClaimStepFooter } from '@/components/partner-claim-step-footer';
import { PartnerClaimDocumentUpload } from '@/components/partner-claim-document-upload';

const DOCUMENTS = [
  { title: 'RC Copy', icon: 'file-document-outline', color: '#07A56D' },
  { title: 'Insurance Copy', icon: 'shield-check-outline', color: '#1677DE' },
  { title: 'Driver Licence', icon: 'card-account-details-outline', color: '#8B42DE' },
  { title: 'GR / Load Bill', icon: 'truck-outline', color: '#ED9811' },
  { title: 'Accident Photo', icon: 'camera-outline', color: '#DE1592' },
  { title: 'Accident Video', icon: 'video-outline', color: '#EF2442' },
] as const;

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
          <View style={styles.heroHeading}><View style={styles.heroCircle}><MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#FFF"/></View><Text style={styles.heroTitle}>Spot Intimation</Text><Text style={styles.control}>{data.claim.claim_no || 'Not recorded'}</Text></View>
          <View style={styles.heroRule}/>
          <View style={styles.identityRow}><View style={styles.identity}><View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make) ?? PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View><View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{data.vehicle.vehicle_no || 'Vehicle not recorded'}</Text><Text style={styles.identitySub} numberOfLines={1}>{data.vehicle.make || 'Manufacturer not recorded'}</Text></View></View><View style={styles.identityDivider}/><View style={styles.identity}><View style={styles.logo}><PartnerInsurerLogo name={data.insurer.name} style={styles.logoImage} fallback={PartnerAssets.navigation.claims}/></View><View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{data.policy.policy_no || 'Policy not recorded'}</Text><Text style={styles.identitySub} numberOfLines={2}>{data.insurer.name || 'Insurer not recorded'}</Text></View></View></View>
        </View>
        <View style={styles.card}>
          <View style={styles.sectionHeading}><MaterialCommunityIcons name="clipboard-text-outline" size={28} color="#1859AB"/><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Incident Details</Text><Text style={styles.subtitle}>Accident date, time and first insurer intimation</Text></View></View>
          <EditableField label="Accident Date" required value={incidentDate} onChange={setIncidentDate} placeholder="YYYY-MM-DD" editable={editable} icon="calendar-outline"/>
          <EditableField label="Accident Time" required value={incidentTime} onChange={setIncidentTime} placeholder="HH:mm" editable={editable} icon="time-outline"/>
          <View style={styles.subheading}><Text style={styles.subheadingText}>Spot Intimation</Text></View>
          <EditableField label="Spot Intimation Date" required value={spotDate} onChange={setSpotDate} placeholder="YYYY-MM-DD" editable={editable} icon="calendar-outline"/>
          <EditableField label="Spot Intimation Time" required value={spotTime} onChange={setSpotTime} placeholder="HH:mm" editable={editable} icon="time-outline"/>
          <EditableField label="Driver Name" required value={driver} onChange={setDriver} placeholder="Enter driver name" editable={editable}/>
          <EditableField label="Driver Number" required value={phone} onChange={setPhone} placeholder="Enter mobile number" editable={editable} keyboard="phone-pad"/>
          <EditableField label="Location" required value={location} onChange={setLocation} placeholder="Enter accident location" editable={editable}/>
          {!editable ? <Text style={styles.restricted}>This completed stage remains visible for reference. Current claim progression determines whether it can be edited.</Text> : null}
        </View>
        <View style={styles.card}>
          <View style={styles.docsHeading}><Text style={styles.sectionTitle}>Upload claim documents</Text><View style={styles.optional}><Text style={styles.optionalText}>Partner upload</Text></View></View>
          <View style={styles.tiles}>{DOCUMENTS.map(item=><View key={item.title} style={styles.tile}><View style={[styles.documentIcon,{backgroundColor:item.color}]}><MaterialCommunityIcons name={item.icon} color="#FFF" size={24}/></View><Text style={styles.tileTitle}>{item.title}</Text><PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType={item.title} milestoneKey="spot_intimation" documents={data.documents} compact/></View>)}</View>
          <View style={styles.bulk}><Ionicons name="documents-outline" size={27} color="#245CB0"/><View style={styles.bulkText}><Text style={styles.bulkTitle}>Upload multiple documents</Text><Text style={styles.bulkHint}>Add any extra Spot Intimation files</Text></View><PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="Spot Intimation Attachment" milestoneKey="spot_intimation" documents={data.documents} compact/></View>
        </View>
        <View style={styles.voice}><View style={styles.voiceTop}><View style={styles.mic}><Ionicons name="mic-outline" size={27} color="#1A56A3"/></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Incident Voice Note</Text><Text style={styles.subtitle}>Attach a recorded incident voice note. Native in-app recording will use the same slot when the Partner binary includes the audio module.</Text></View></View><PartnerClaimDocumentUpload claimId={data.claim.id} customerId={data.customer.id} documentType="Incident Voice Note" milestoneKey="spot_intimation" documents={data.documents}/></View>
        <PartnerClaimStepFooter index={0} busy={saving} canContinue={data.claim.current_status === "Draft" || data.claim.current_status === "Initial Documents Pending"} onPrevious={() => router.push("/claim/select-vehicle" as never)} onContinue={() => void save()} continueLabel="Start Claim & Continue" />
      </ScrollView>
      <View style={styles.nav}><Nav title="Home" icon="home" onPress={() => router.push('/(tabs)' as never)}/><Nav title="Business" icon="briefcase-outline" onPress={() => router.push('/(tabs)/business' as never)}/><Nav title="Policies" icon="document-text-outline" onPress={() => router.push('/(tabs)/policies' as never)}/><Nav title="Claims" icon="shield-checkmark-outline" onPress={() => router.push('/(tabs)/claims' as never)}/><Nav title="More" icon="grid-outline" onPress={() => router.push('/(tabs)/more' as never)}/></View>
    </SafeAreaView>
  );
}
function EditableField({label,required,value,onChange,placeholder,editable,icon,keyboard='default'}:{label:string;required?:boolean;value:string;onChange:(value:string)=>void;placeholder:string;editable:boolean;icon?:keyof typeof Ionicons.glyphMap;keyboard?:'default'|'phone-pad'}) {return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}{required?<Text style={{color:'#D74747'}}> *</Text>:null}</Text><View style={[styles.field,!editable&&{opacity:.65}]}><TextInput accessibilityLabel={label} editable={editable} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9EABBC" keyboardType={keyboard} style={styles.editableInput}/>{icon?<Ionicons name={icon} color="#1857A9" size={20}/>:null}</View></View>}

function splitDateTime(value:string|null|undefined){if(!value)return{date:'',time:''};const date=new Date(value);if(Number.isNaN(date.getTime()))return{date:'',time:''};const pad=(n:number)=>String(n).padStart(2,'0');return{date:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,time:`${pad(date.getHours())}:${pad(date.getMinutes())}`};}
function parseLocalDateTime(date:string,time:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;const parsed=new Date(`${date}T${time}:00`);return Number.isNaN(parsed.getTime())?null:parsed;}
function parseDriver(value:string|null|undefined){const text=value||'';const name=text.match(/^Driver:\s*(.+)$/mi)?.[1]?.trim()||'';const phone=text.match(/^Driver phone:\s*(.+)$/mi)?.[1]?.trim()||'';return{name,phone};}
function Nav({title,icon,onPress}:{title:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void}) {return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.navItem}><View style={styles.navIcon}><Ionicons name={icon} size={20} color="#D3E2F9"/></View><Text style={styles.navLabel}>{title}</Text></Pressable>}
const styles=StyleSheet.create({
screen:{flex:1,backgroundColor:'#EDF6FE'},header:{height:50,backgroundColor:'#0860C8',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:10},back:{width:34,height:34,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1,justifyContent:'center'},headerTitle:{color:'#FFF',fontSize:15,fontWeight:'800'},headerSubtitle:{color:'#DDEBFA',fontSize:10},scroll:{flex:1},content:{paddingHorizontal:13,paddingTop:23,paddingBottom:30,gap:13},
hero:{backgroundColor:'#07357E',borderRadius:19,padding:12,shadowColor:'#001B4E',shadowOpacity:.2,shadowRadius:7,elevation:3},heroHeading:{flexDirection:'row',alignItems:'center',gap:9},heroCircle:{height:34,width:34,borderRadius:18,backgroundColor:'#165AB1',alignItems:'center',justifyContent:'center'},heroTitle:{flex:1,color:'#FFF',fontSize:17,fontWeight:'900'},control:{color:'#FFF',fontSize:12,fontWeight:'800'},heroRule:{height:1,backgroundColor:'#6985AC',marginVertical:10},identityRow:{flexDirection:'row',alignItems:'center',gap:8},identity:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:7},identityDivider:{width:1,height:39,backgroundColor:'#5175A5'},logo:{backgroundColor:'#FFF',height:43,width:43,borderRadius:10,alignItems:'center',justifyContent:'center'},logoImage:{width:36,height:36},identityCopy:{flex:1,minWidth:0},identityTitle:{color:'#FFF',fontSize:10.5,fontWeight:'900'},identitySub:{color:'#DEE9FA',fontSize:8.5,marginTop:3},
card:{backgroundColor:'#FFF',borderRadius:20,borderColor:'#D7E2EC',borderWidth:1,padding:13,gap:10},sectionHeading:{flexDirection:'row',alignItems:'center',gap:11,marginBottom:11,paddingVertical:6},headingCopy:{flex:1},sectionTitle:{fontSize:13,fontWeight:'900',color:'#14284B'},subtitle:{fontSize:10,color:'#7F8B9D',lineHeight:15,marginTop:4},fieldWrap:{gap:6},fieldLabel:{fontSize:10.5,color:'#172E51',fontWeight:'800'},field:{minHeight:49,borderRadius:12,borderColor:'#D3E0EC',borderWidth:1,backgroundColor:'#FAFCFE',paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},fieldValue:{fontSize:12,color:'#183052',fontWeight:'800'},editableInput:{flex:1,height:47,fontSize:12,color:'#183052',fontWeight:'700'},subheading:{borderTopWidth:1,borderTopColor:'#E3EAF1',paddingTop:15,marginTop:5},subheadingText:{color:'#183052',fontSize:12,fontWeight:'900'},restricted:{fontSize:9,color:'#8191A6',lineHeight:14,marginTop:5},
docsHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:2},optional:{backgroundColor:'#EDF4FF',paddingVertical:6,paddingHorizontal:9,borderRadius:12},optionalText:{fontSize:9,color:'#1A56A2',fontWeight:'800'},tiles:{flexDirection:'row',flexWrap:'wrap',gap:8},tile:{width:'31.5%',height:109,borderRadius:13,backgroundColor:'#F5F8FD',borderColor:'#DCE5EE',borderWidth:1,alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:4},documentIcon:{width:36,height:39,borderRadius:8,alignItems:'center',justifyContent:'center'},tileTitle:{fontSize:9,fontWeight:'900',color:'#183052',textAlign:'center'},tileSub:{fontSize:8,color:'#8F9FB0'},bulk:{borderColor:'#B8CBE1',borderWidth:1.5,borderStyle:'dashed',borderRadius:14,padding:13,flexDirection:'row',alignItems:'center',gap:10},bulkText:{flex:1},bulkTitle:{fontSize:11,color:'#1B3150',fontWeight:'900'},bulkHint:{fontSize:9,color:'#8494AA',marginTop:4},
voice:{borderRadius:18,backgroundColor:'#F4F8FE',borderWidth:1,borderColor:'#D3E0EC',padding:13,gap:12},voiceTop:{flexDirection:'row',alignItems:'center',gap:11},mic:{height:48,width:48,backgroundColor:'#E7F0FC',borderRadius:12,alignItems:'center',justifyContent:'center'},disabledRecording:{minHeight:46,backgroundColor:'#315C9F',borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},disabledText:{color:'#FFF',fontSize:11,fontWeight:'800'},nav:{height:61,backgroundColor:'#081F4C',flexDirection:'row',alignItems:'center',justifyContent:'space-around',borderTopLeftRadius:18,borderTopRightRadius:18},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{width:36,height:32,borderRadius:10,backgroundColor:'#193666',alignItems:'center',justifyContent:'center'},navLabel:{fontSize:9,color:'#D1DFF1',fontWeight:'700'}
});
