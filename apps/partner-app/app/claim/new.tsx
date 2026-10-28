import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CLAIM_STAGES } from '@/lib/claim-tracker';

const DOCUMENTS = [
  { title: 'RC Copy', icon: 'file-document-outline', color: '#07A56D' },
  { title: 'Insurance Copy', icon: 'shield-check-outline', color: '#1677DE' },
  { title: 'Driver Licence', icon: 'card-account-details-outline', color: '#8B42DE' },
  { title: 'GR / Load Bill', icon: 'truck-outline', color: '#ED9811' },
  { title: 'Accident Photo', icon: 'camera-outline', color: '#DE1592' },
  { title: 'Accident Video', icon: 'video-outline', color: '#EF2442' },
] as const;

type DraftField = 'customer' | 'vehicle' | 'policy' | 'insurer' | 'accidentDate' | 'accidentTime' | 'intimationDate' | 'intimationTime' | 'driverName' | 'driverNumber' | 'location';
export default function PartnerNewClaimScreen() {
  const router = useRouter();
  const mainScrollRef = useRef<ScrollView>(null);
  useFocusEffect(useCallback(() => {
    const reset = () => mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, []));
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Record<DraftField,string>>({
    customer:'',vehicle:'',policy:'',insurer:'',accidentDate:'',accidentTime:'',
    intimationDate:'',intimationTime:'',driverName:'',driverNumber:'',location:'',
  });
  const update = (key:DraftField,value:string) => setDraft(previous=>({...previous,[key]:value}));
  return (
    <SafeAreaView style={styles.screen} edges={['top','bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Claims" style={styles.back} onPress={()=>router.back()}><Ionicons name="chevron-back" color="#FFF" size={23}/></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>Spot Intimation</Text><Text style={styles.headerSubtitle}>Claim Tracker</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroHeading}>
            <View style={styles.heroCircle}><MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#FFF"/></View>
            <Text style={styles.heroTitle}>Spot Intimation</Text><Text style={styles.control}>NEW CLAIM</Text>
          </View>
          <View style={styles.heroRule}/>
          <View style={styles.identityRow}>
            <View style={styles.identity}>
              <View style={styles.logo}><Ionicons name="car-outline" size={25} color="#1355A1"/></View>
              <View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{draft.vehicle || 'Select vehicle'}</Text><Text numberOfLines={1} style={styles.identitySub}>{draft.customer || 'Select customer'}</Text></View>
            </View>
            <View style={styles.identityDivider}/>
            <View style={styles.identity}>
              <View style={styles.logo}><Ionicons name="shield-checkmark-outline" size={24} color="#1355A1"/></View>
              <View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{draft.policy || 'Select policy'}</Text><Text numberOfLines={2} style={styles.identitySub}>{draft.insurer || 'Insurer from policy'}</Text></View>
            </View>
          </View>
        </View>
        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityState={{expanded}} accessibilityLabel="View all nine claim stages" onPress={()=>setExpanded(v=>!v)} style={styles.stageToggle}>
            <Ionicons name="list-outline" size={19} color="#1859AB"/>
            <Text style={styles.sectionTitle}>Stage 1 of 9 · View all stages</Text>
            <Ionicons name={expanded?'chevron-up':'chevron-down'} size={18} color="#1859AB"/>
          </Pressable>
          {expanded ? CLAIM_STAGES.map((stage,index)=>(
            <View key={stage.key} style={styles.stageLine}>
              <View style={styles.stageBadge}><Text style={styles.stageNumber}>{index+1}</Text></View>
              <Text style={styles.stageLineText}>{stage.label}</Text>
              {index===0?<Text style={styles.currentStage}>Current</Text>:<Ionicons name="lock-closed-outline" size={15} color="#9BAABC"/>}
            </View>
          )) : null}
        </View>
        <View style={styles.card}>
          <View style={styles.sectionHeading}><MaterialCommunityIcons name="clipboard-text-outline" size={28} color="#1859AB"/><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Incident Details</Text><Text style={styles.subtitle}>Accident date, time and first insurer intimation</Text></View></View>
          <EditField label="Customer *" value={draft.customer} onChangeText={v=>update('customer',v)} hint="Customer selection requires authorized lookup"/>
          <EditField label="Vehicle *" value={draft.vehicle} onChangeText={v=>update('vehicle',v)} hint="Vehicle selection requires authorized lookup"/>
          <EditField label="Policy" value={draft.policy} onChangeText={v=>update('policy',v)} hint="Linked policy verification pending"/>
          <EditField label="Insurer" value={draft.insurer} onChangeText={v=>update('insurer',v)} hint="Autofill after verified policy selection"/>
          <EditField label="Accident Date *" value={draft.accidentDate} onChangeText={v=>update('accidentDate',v)} hint="DD/MM/YYYY"/>
          <EditField label="Accident Time *" value={draft.accidentTime} onChangeText={v=>update('accidentTime',v)} hint="HH:MM" icon="time-outline"/>
          <View style={styles.subheading}><Text style={styles.subheadingText}>Spot Intimation</Text></View>
          <EditField label="Spot Intimation Date *" value={draft.intimationDate} onChangeText={v=>update('intimationDate',v)} hint="DD/MM/YYYY"/>
          <EditField label="Spot Intimation Time *" value={draft.intimationTime} onChangeText={v=>update('intimationTime',v)} hint="HH:MM" icon="time-outline"/>
          <EditField label="Driver Name *" value={draft.driverName} onChangeText={v=>update('driverName',v)} hint="Driver name"/>
          <EditField label="Driver Number *" value={draft.driverNumber} onChangeText={v=>update('driverNumber',v)} hint="Driver phone" keyboardType="phone-pad"/>
          <EditField label="Location *" value={draft.location} onChangeText={v=>update('location',v)} hint="Incident location"/>
          <Text style={styles.notice}>These entries are local to this screen and are not saved. Secure customer/vehicle/policy selection and claim creation require an authorized backend.</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.docsHeading}><Text style={styles.sectionTitle}>Upload claim documents</Text><View style={styles.optional}><Text style={styles.optionalText}>Unavailable</Text></View></View>
          <View style={styles.tiles}>{DOCUMENTS.map(item=><View key={item.title} accessibilityLabel={`${item.title}, upload unavailable`} style={styles.tile}>
            <View style={[styles.documentIcon,{backgroundColor:item.color}]}><MaterialCommunityIcons name={item.icon} color="#FFF" size={24}/></View>
            <Text style={styles.tileTitle}>{item.title}</Text><Text style={styles.tileSub}>Upload unavailable</Text>
          </View>)}</View>
          <View style={styles.bulk}><Ionicons name="documents-outline" size={27} color="#245CB0"/><View style={styles.bulkText}><Text style={styles.bulkTitle}>Upload multiple documents</Text><Text style={styles.bulkHint}>Available after secure claim upload authorization</Text></View></View>
        </View>
        <View style={styles.voice}>
          <View style={styles.voiceTop}><View style={styles.mic}><Ionicons name="mic-outline" size={27} color="#1A56A3"/></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Incident Voice Note</Text><Text style={styles.subtitle}>Describe what happened in your own words. Maximum recording time is 2 minutes.</Text></View></View>
          <View style={styles.disabledRecording}><Ionicons name="mic-outline" size={18} color="#FFF"/><Text style={styles.disabledText}>Recording unavailable until enabled</Text></View>
        </View>
        <View style={styles.footerButtons}><View style={styles.fakeButton}><Text style={styles.fakeText}>Save Draft</Text></View><View style={styles.fakeButton}><Text style={styles.fakeText}>Save & Continue</Text></View></View>
        <Text style={styles.notice}>Save actions are unavailable until the secure Partner claim creation and draft API is verified. No documents or recordings are uploaded.</Text>
      </ScrollView>
      <View style={styles.nav}><Nav title="Home" icon="home" onPress={()=>router.push('/(tabs)' as never)}/><Nav title="Business" icon="briefcase-outline" onPress={()=>router.push('/(tabs)/business' as never)}/><Nav title="Policies" icon="document-text-outline" onPress={()=>router.push('/(tabs)/policies' as never)}/><Nav title="Claims" icon="shield-checkmark-outline" onPress={()=>router.push('/(tabs)/claims' as never)}/><Nav title="More" icon="grid-outline" onPress={()=>router.push('/(tabs)/more' as never)}/></View>
    </SafeAreaView>
  );
}
function EditField({label,value,onChangeText,hint,icon,keyboardType}:{label:string;value:string;onChangeText:(value:string)=>void;hint:string;icon?:keyof typeof Ionicons.glyphMap;keyboardType?:'phone-pad'}) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.field}><TextInput style={styles.editInput} value={value} onChangeText={onChangeText} placeholder={hint} placeholderTextColor="#8B9AAC" keyboardType={keyboardType}/>{icon?<Ionicons name={icon} color="#1857A9" size={21}/>:null}</View></View>;
}
function Nav({title,icon,onPress}:{title:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.navItem}><View style={styles.navIcon}><Ionicons name={icon} size={20} color="#D3E2F9"/></View><Text style={styles.navLabel}>{title}</Text></Pressable>;
}
const styles=StyleSheet.create({
screen:{flex:1,backgroundColor:'#EDF6FE'},header:{height:50,backgroundColor:'#0860C8',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:10},back:{width:34,height:34,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1,justifyContent:'center'},headerTitle:{color:'#FFF',fontSize:15,fontWeight:'800'},headerSubtitle:{color:'#DDEBFA',fontSize:10},scroll:{flex:1},content:{paddingHorizontal:13,paddingTop:23,paddingBottom:30,gap:13},
hero:{backgroundColor:'#07357E',borderRadius:19,padding:12,shadowColor:'#001B4E',shadowOpacity:.2,shadowRadius:7,elevation:3},heroHeading:{flexDirection:'row',alignItems:'center',gap:9},heroCircle:{height:34,width:34,borderRadius:18,backgroundColor:'#165AB1',alignItems:'center',justifyContent:'center'},heroTitle:{flex:1,color:'#FFF',fontSize:17,fontWeight:'900'},control:{color:'#FFF',fontSize:12,fontWeight:'800'},heroRule:{height:1,backgroundColor:'#6985AC',marginVertical:10},identityRow:{flexDirection:'row',alignItems:'center',gap:8},identity:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:7},identityDivider:{width:1,height:39,backgroundColor:'#5175A5'},logo:{backgroundColor:'#FFF',height:43,width:43,borderRadius:10,alignItems:'center',justifyContent:'center'},logoImage:{width:36,height:36},identityCopy:{flex:1,minWidth:0},identityTitle:{color:'#FFF',fontSize:10.5,fontWeight:'900'},identitySub:{color:'#DEE9FA',fontSize:8.5,marginTop:3},
card:{backgroundColor:'#FFF',borderRadius:20,borderColor:'#D7E2EC',borderWidth:1,padding:13,gap:10},sectionHeading:{flexDirection:'row',alignItems:'center',gap:11,marginBottom:11,paddingVertical:6},headingCopy:{flex:1},sectionTitle:{fontSize:13,fontWeight:'900',color:'#14284B'},subtitle:{fontSize:10,color:'#7F8B9D',lineHeight:15,marginTop:4},fieldWrap:{gap:6},fieldLabel:{fontSize:10.5,color:'#172E51',fontWeight:'800'},field:{minHeight:49,borderRadius:12,borderColor:'#D3E0EC',borderWidth:1,backgroundColor:'#FAFCFE',paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},fieldValue:{fontSize:12,color:'#183052',fontWeight:'800'},subheading:{borderTopWidth:1,borderTopColor:'#E3EAF1',paddingTop:15,marginTop:5},subheadingText:{color:'#183052',fontSize:12,fontWeight:'900'},restricted:{fontSize:9,color:'#8191A6',lineHeight:14,marginTop:5},
docsHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:2},optional:{backgroundColor:'#EDF4FF',paddingVertical:6,paddingHorizontal:9,borderRadius:12},optionalText:{fontSize:9,color:'#1A56A2',fontWeight:'800'},tiles:{flexDirection:'row',flexWrap:'wrap',gap:8},tile:{width:'31.5%',height:109,borderRadius:13,backgroundColor:'#F5F8FD',borderColor:'#DCE5EE',borderWidth:1,alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:4},documentIcon:{width:36,height:39,borderRadius:8,alignItems:'center',justifyContent:'center'},tileTitle:{fontSize:9,fontWeight:'900',color:'#183052',textAlign:'center'},tileSub:{fontSize:8,color:'#8F9FB0'},bulk:{borderColor:'#B8CBE1',borderWidth:1.5,borderStyle:'dashed',borderRadius:14,padding:13,flexDirection:'row',alignItems:'center',gap:10},bulkText:{flex:1},bulkTitle:{fontSize:11,color:'#1B3150',fontWeight:'900'},bulkHint:{fontSize:9,color:'#8494AA',marginTop:4},
voice:{borderRadius:18,backgroundColor:'#F4F8FE',borderWidth:1,borderColor:'#D3E0EC',padding:13,gap:12},voiceTop:{flexDirection:'row',alignItems:'center',gap:11},mic:{height:48,width:48,backgroundColor:'#E7F0FC',borderRadius:12,alignItems:'center',justifyContent:'center'},disabledRecording:{minHeight:46,backgroundColor:'#315C9F',borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},disabledText:{color:'#FFF',fontSize:11,fontWeight:'800'},nav:{height:61,backgroundColor:'#081F4C',flexDirection:'row',alignItems:'center',justifyContent:'space-around',borderTopLeftRadius:18,borderTopRightRadius:18},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{width:36,height:32,borderRadius:10,backgroundColor:'#193666',alignItems:'center',justifyContent:'center'},navLabel:{fontSize:9,color:'#D1DFF1',fontWeight:'700'}
,editInput:{flex:1,fontSize:12,color:'#183052',fontWeight:'700',paddingVertical:10},blocked:{opacity:0.65},stageToggle:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:7},stageLine:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:5},stageBadge:{width:24,height:24,borderRadius:12,backgroundColor:'#E7EFF9',alignItems:'center',justifyContent:'center'},stageNumber:{color:'#45648D',fontSize:10,fontWeight:'800'},stageLineText:{flex:1,fontSize:11,color:'#405679',fontWeight:'700'},notice:{fontSize:10,color:'#815D63',lineHeight:16},footerButtons:{flexDirection:'row',gap:8},fakeButton:{flex:1,minHeight:40,borderRadius:9,backgroundColor:'#C0C9DD',alignItems:'center',justifyContent:'center',opacity:.75},fakeText:{fontSize:11,fontWeight:'800',color:'#FFFFFF'},currentStage:{color:'#148B70',fontWeight:'800',fontSize:9},identityPlaceholder:{width:36,height:36,alignItems:'center',justifyContent:'center'},
});
