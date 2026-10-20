import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerAssets } from '@/lib/partner-assets';
import type { PartnerClaimDetail } from '@/lib/claims';
import { formatClaimDate } from '@/lib/claim-tracker';

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
  const date = data.claim.accident_at ? new Date(data.claim.accident_at) : null;
  const incidentTime = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date) : null;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Claim Tracker" style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" color="#FFF" size={23}/></Pressable>
        <View style={styles.brand}><Ionicons name="shield-checkmark-outline" size={31} color="#FFF"/><View><Text style={styles.brandName}>insureit</Text><Text style={styles.brandTag}>YOUR SAFETY, OUR PROMISE</Text></View></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Activity notifications" style={styles.bell} onPress={() => router.push('/activity' as never)}><Ionicons name="notifications-outline" color="#FFF" size={21}/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" style={styles.profile} onPress={() => router.push('/profile' as never)}><Ionicons name="person-outline" color="#FFF" size={20}/></Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroHeading}><View style={styles.heroCircle}><MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#FFF"/></View><Text style={styles.heroTitle}>Spot Intimation</Text><Text style={styles.control}>{data.claim.claim_no || 'Not recorded'}</Text></View>
          <View style={styles.heroRule}/>
          <View style={styles.identityRow}><View style={styles.identity}><View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make) ?? PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View><View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{data.vehicle.vehicle_no || 'Vehicle not recorded'}</Text><Text style={styles.identitySub} numberOfLines={1}>{data.vehicle.make || 'Manufacturer not recorded'}</Text></View></View><View style={styles.identityDivider}/><View style={styles.identity}><View style={styles.logo}><PartnerInsurerLogo name={data.insurer.name} style={styles.logoImage} fallback={PartnerAssets.navigation.claims}/></View><View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{data.policy.policy_no || 'Policy not recorded'}</Text><Text style={styles.identitySub} numberOfLines={2}>{data.insurer.name || 'Insurer not recorded'}</Text></View></View></View>
        </View>
        <View style={styles.card}>
          <View style={styles.sectionHeading}><MaterialCommunityIcons name="clipboard-text-outline" size={28} color="#1859AB"/><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Incident Details</Text><Text style={styles.subtitle}>Accident date, time and first insurer intimation</Text></View></View>
          <ReadOnlyField label="Accident Date *" value={formatClaimDate(data.claim.accident_at)} />
          <ReadOnlyField label="Accident Time *" value={incidentTime} icon="time-outline"/>
          <View style={styles.subheading}><Text style={styles.subheadingText}>Spot Intimation</Text></View>
          <ReadOnlyField label="Spot Intimation Date *" value={null}/>
          <ReadOnlyField label="Spot Intimation Time *" value={null} icon="time-outline"/>
          <ReadOnlyField label="Driver Name *" value={null}/>
          <ReadOnlyField label="Driver Number *" value={null}/>
          <ReadOnlyField label="Location *" value={data.claim.accident_location}/>
          <Text style={styles.restricted}>Fields not supplied by the authorized Partner claim service are shown as Not recorded, rather than using invented values.</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.docsHeading}><Text style={styles.sectionTitle}>Upload claim documents</Text><View style={styles.optional}><Text style={styles.optionalText}>View only</Text></View></View>
          <View style={styles.tiles}>{DOCUMENTS.map(item=><View key={item.title} accessible accessibilityLabel={`${item.title}, document availability not provided`} style={styles.tile}><View style={[styles.documentIcon,{backgroundColor:item.color}]}><MaterialCommunityIcons name={item.icon} color="#FFF" size={24}/></View><Text style={styles.tileTitle}>{item.title}</Text><Text style={styles.tileSub}>Unavailable</Text></View>)}</View>
          <View style={styles.bulk}><Ionicons name="documents-outline" size={27} color="#245CB0"/><View style={styles.bulkText}><Text style={styles.bulkTitle}>Upload multiple documents</Text><Text style={styles.bulkHint}>Partner document uploads require authorized access</Text></View><Ionicons name="add-circle-outline" size={25} color="#8EA3C4"/></View>
        </View>
        <View style={styles.voice}><View style={styles.voiceTop}><View style={styles.mic}><Ionicons name="mic-outline" size={27} color="#1A56A3"/></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Incident Voice Note</Text><Text style={styles.subtitle}>Describe what happened in your own words. Maximum recording time is 2 minutes.</Text></View></View><View style={styles.disabledRecording}><Ionicons name="mic-outline" size={18} color="#FFF"/><Text style={styles.disabledText}>Recording unavailable for Partner access</Text></View></View>
      </ScrollView>
      <View style={styles.nav}><Nav title="Home" icon="home" onPress={() => router.push('/(tabs)' as never)}/><Nav title="Business" icon="briefcase-outline" onPress={() => router.push('/(tabs)/business' as never)}/><Nav title="Policies" icon="document-text-outline" onPress={() => router.push('/(tabs)/policies' as never)}/><Nav title="Claims" icon="shield-checkmark-outline" onPress={() => router.push('/(tabs)/claims' as never)}/><Nav title="More" icon="grid-outline" onPress={() => router.push('/(tabs)/more' as never)}/></View>
    </SafeAreaView>
  );
}
function ReadOnlyField({label,value,icon}:{label:string;value?:string|null;icon?:keyof typeof Ionicons.glyphMap}) {return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.field}><Text style={styles.fieldValue}>{value || 'Not recorded'}</Text>{icon ? <Ionicons name={icon} color="#1857A9" size={21}/> : null}</View></View>}
function Nav({title,icon,onPress}:{title:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void}) {return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.navItem}><View style={styles.navIcon}><Ionicons name={icon} size={20} color="#D3E2F9"/></View><Text style={styles.navLabel}>{title}</Text></Pressable>}
const styles=StyleSheet.create({
screen:{flex:1,backgroundColor:'#EDF6FE'},header:{height:72,backgroundColor:'#081F4C',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:11},back:{width:42,height:42,borderRadius:24,borderWidth:1,borderColor:'#5A7194',alignItems:'center',justifyContent:'center'},brand:{flex:1,flexDirection:'row',alignItems:'center',gap:9},brandName:{color:'#FFF',fontSize:19,fontWeight:'900'},brandTag:{color:'#FFF',fontSize:5,fontWeight:'700'},bell:{padding:6},profile:{width:40,height:40,borderRadius:22,borderWidth:1.5,borderColor:'#FFF',alignItems:'center',justifyContent:'center'},scroll:{flex:1},content:{paddingHorizontal:13,paddingTop:23,paddingBottom:30,gap:13},
hero:{backgroundColor:'#07357E',borderRadius:19,padding:12,shadowColor:'#001B4E',shadowOpacity:.2,shadowRadius:7,elevation:3},heroHeading:{flexDirection:'row',alignItems:'center',gap:9},heroCircle:{height:34,width:34,borderRadius:18,backgroundColor:'#165AB1',alignItems:'center',justifyContent:'center'},heroTitle:{flex:1,color:'#FFF',fontSize:17,fontWeight:'900'},control:{color:'#FFF',fontSize:12,fontWeight:'800'},heroRule:{height:1,backgroundColor:'#6985AC',marginVertical:10},identityRow:{flexDirection:'row',alignItems:'center',gap:8},identity:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:7},identityDivider:{width:1,height:39,backgroundColor:'#5175A5'},logo:{backgroundColor:'#FFF',height:43,width:43,borderRadius:10,alignItems:'center',justifyContent:'center'},logoImage:{width:36,height:36},identityCopy:{flex:1,minWidth:0},identityTitle:{color:'#FFF',fontSize:10.5,fontWeight:'900'},identitySub:{color:'#DEE9FA',fontSize:8.5,marginTop:3},
card:{backgroundColor:'#FFF',borderRadius:20,borderColor:'#D7E2EC',borderWidth:1,padding:13,gap:10},sectionHeading:{flexDirection:'row',alignItems:'center',gap:11,marginBottom:11,paddingVertical:6},headingCopy:{flex:1},sectionTitle:{fontSize:13,fontWeight:'900',color:'#14284B'},subtitle:{fontSize:10,color:'#7F8B9D',lineHeight:15,marginTop:4},fieldWrap:{gap:6},fieldLabel:{fontSize:10.5,color:'#172E51',fontWeight:'800'},field:{minHeight:49,borderRadius:12,borderColor:'#D3E0EC',borderWidth:1,backgroundColor:'#FAFCFE',paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},fieldValue:{fontSize:12,color:'#183052',fontWeight:'800'},subheading:{borderTopWidth:1,borderTopColor:'#E3EAF1',paddingTop:15,marginTop:5},subheadingText:{color:'#183052',fontSize:12,fontWeight:'900'},restricted:{fontSize:9,color:'#8191A6',lineHeight:14,marginTop:5},
docsHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:2},optional:{backgroundColor:'#EDF4FF',paddingVertical:6,paddingHorizontal:9,borderRadius:12},optionalText:{fontSize:9,color:'#1A56A2',fontWeight:'800'},tiles:{flexDirection:'row',flexWrap:'wrap',gap:8},tile:{width:'31.5%',height:109,borderRadius:13,backgroundColor:'#F5F8FD',borderColor:'#DCE5EE',borderWidth:1,alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:4},documentIcon:{width:36,height:39,borderRadius:8,alignItems:'center',justifyContent:'center'},tileTitle:{fontSize:9,fontWeight:'900',color:'#183052',textAlign:'center'},tileSub:{fontSize:8,color:'#8F9FB0'},bulk:{borderColor:'#B8CBE1',borderWidth:1.5,borderStyle:'dashed',borderRadius:14,padding:13,flexDirection:'row',alignItems:'center',gap:10},bulkText:{flex:1},bulkTitle:{fontSize:11,color:'#1B3150',fontWeight:'900'},bulkHint:{fontSize:9,color:'#8494AA',marginTop:4},
voice:{borderRadius:18,backgroundColor:'#F4F8FE',borderWidth:1,borderColor:'#D3E0EC',padding:13,gap:12},voiceTop:{flexDirection:'row',alignItems:'center',gap:11},mic:{height:48,width:48,backgroundColor:'#E7F0FC',borderRadius:12,alignItems:'center',justifyContent:'center'},disabledRecording:{minHeight:46,backgroundColor:'#315C9F',borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},disabledText:{color:'#FFF',fontSize:11,fontWeight:'800'},nav:{height:61,backgroundColor:'#081F4C',flexDirection:'row',alignItems:'center',justifyContent:'space-around',borderTopLeftRadius:18,borderTopRightRadius:18},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{width:36,height:32,borderRadius:10,backgroundColor:'#193666',alignItems:'center',justifyContent:'center'},navLabel:{fontSize:9,color:'#D1DFF1',fontWeight:'700'}
});
