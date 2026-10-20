import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerAssets } from '@/lib/partner-assets';
import type { PartnerClaimDetail } from '@/lib/claims';

/** Display-only stage until Partner-scoped delivery confirmation is exposed by the claims API. */
export function PartnerVehicleDelivery({ data }: { data: PartnerClaimDetail }) {
  const router = useRouter();
  const vehicle = data.vehicle.vehicle_no || 'Vehicle not recorded';
  const insurer = data.insurer.name || 'Insurer not recorded';
  const control = data.claim.claim_no || 'Control number pending';

  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Claim Tracker" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color="#FFFFFF"/></Pressable>
          <View style={styles.titleGroup}><View style={styles.titleIcon}><MaterialCommunityIcons name="truck-check-outline" size={17} color="#FFFFFF"/></View><Text style={styles.heroTitle}>Vehicle Delivery</Text></View>
          <Text numberOfLines={1} style={styles.claimControl}>{control}</Text>
        </View>
        <View style={styles.identityRow}>
          <View style={styles.identity}>
            <View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make) ?? PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View>
            <View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{vehicle}</Text><Text numberOfLines={1} style={styles.identitySubtitle}>{data.vehicle.make || 'Manufacturer not recorded'}</Text></View>
          </View>
          <View style={styles.identity}>
            <View style={styles.logo}><PartnerInsurerLogo name={insurer} fallback={PartnerAssets.navigation.claims} style={styles.logoImage}/></View>
            <View style={styles.identityCopy}><Text numberOfLines={1} style={styles.identityTitle}>{data.policy.policy_no || 'Policy not recorded'}</Text><Text numberOfLines={2} style={styles.identitySubtitle}>{insurer}</Text></View>
          </View>
        </View>
      </View>
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="truck-check-outline" size={28} color="#0A559F"/>
          <View style={styles.sectionCopy}><Text style={styles.sectionTitle}>Stage Details</Text><Text style={styles.sectionHint}>Confirm whether the repaired vehicle has been received</Text></View>
        </View>
        <Text style={styles.fieldLabel}>Vehicle Received? <Text style={styles.required}>*</Text></Text>
        <View style={styles.choiceRow}>
          <View accessibilityLabel="Yes, confirmation unavailable" style={styles.choice}><Text style={styles.choiceText}>Yes</Text></View>
          <View accessibilityLabel="Not Yet, awaiting confirmation" style={styles.choice}><Text style={styles.choiceText}>Not Yet</Text></View>
        </View>
        <View style={styles.notice}><Ionicons name="alert-circle-outline" size={19} color="#9E6A0D"/><Text style={styles.noticeText}>This stage stays in progress until the vehicle is received.</Text></View>
        <Text style={styles.readOnly}>Delivery confirmation is read-only in the Partner app until authorized stage updates are available.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Get Assistance" onPress={() => Alert.alert('Get Assistance', 'Please contact your claims desk for vehicle delivery assistance.')} style={styles.secondary}><MaterialCommunityIcons name="account-voice" size={17} color="#0B3E88"/><Text style={styles.secondaryText}>Get Assistance</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue to Claim Tracker" onPress={() => router.back()} style={styles.primary}><Text style={styles.primaryText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#FFF"/></Pressable>
      </View>
    </ScrollView>
    <View style={styles.nav}>
      <Nav label="Home" icon="home-outline" onPress={() => router.push('/(tabs)' as never)}/>
      <Nav label="Business" icon="briefcase-outline" onPress={() => router.push('/(tabs)/business' as never)}/>
      <Nav label="Policies" icon="document-text-outline" onPress={() => router.push('/(tabs)/policies' as never)}/>
      <Nav label="Claims" icon="shield-checkmark-outline" onPress={() => router.push('/(tabs)/claims' as never)}/>
      <Nav label="More" icon="grid-outline" onPress={() => router.push('/(tabs)/more' as never)}/>
    </View>
  </SafeAreaView>;
}
function Nav({label,icon,onPress}:{label:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.navItem}><View style={styles.navIcon}><Ionicons name={icon} size={19} color="#E0EAF9"/></View><Text style={styles.navLabel}>{label}</Text></Pressable>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#EDF6FE'},scroll:{flex:1},content:{paddingBottom:28,gap:14},
  hero:{backgroundColor:'#08285F',borderBottomLeftRadius:24,borderBottomRightRadius:24,paddingHorizontal:14,paddingTop:14,paddingBottom:18,gap:15},
  heroTop:{flexDirection:'row',alignItems:'center',gap:9},back:{width:36,height:36,borderRadius:22,borderWidth:1,borderColor:'#7C95BA',alignItems:'center',justifyContent:'center'},
  titleGroup:{flex:1,flexDirection:'row',alignItems:'center',gap:7},titleIcon:{width:25,height:25,backgroundColor:'#1958AB',borderRadius:13,alignItems:'center',justifyContent:'center'},heroTitle:{fontSize:16,fontWeight:'900',color:'#FFF'},claimControl:{maxWidth:'32%',fontSize:10,fontWeight:'800',color:'#FFF'},
  identityRow:{flexDirection:'row',gap:8},identity:{flex:1,minWidth:0,backgroundColor:'#FFF',borderRadius:12,padding:7,flexDirection:'row',alignItems:'center',gap:7,minHeight:60},logo:{width:37,height:37,borderRadius:9,backgroundColor:'#F7FAFD',alignItems:'center',justifyContent:'center'},logoImage:{width:31,height:31},identityCopy:{flex:1,minWidth:0},identityTitle:{fontSize:10,fontWeight:'900',color:'#0C2853'},identitySubtitle:{fontSize:9,color:'#405777',marginTop:3},
  card:{backgroundColor:'#FFF',borderRadius:16,borderColor:'#D5E2EF',borderWidth:1,marginHorizontal:12,padding:14,gap:13},sectionTitleRow:{flexDirection:'row',alignItems:'center',gap:11},sectionCopy:{flex:1},sectionTitle:{fontSize:14,color:'#0C2952',fontWeight:'900'},sectionHint:{fontSize:10,color:'#7A8DA7',marginTop:3},
  fieldLabel:{fontSize:11,fontWeight:'800',color:'#19335B'},required:{color:'#E84141'},choiceRow:{flexDirection:'row',gap:8},choice:{width:'33%',minHeight:41,alignItems:'center',justifyContent:'center',borderRadius:11,borderWidth:1,borderColor:'#DCE3EC',backgroundColor:'#FFF'},choiceText:{fontSize:11,fontWeight:'700',color:'#8A95A6'},
  notice:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FFF9E9',borderColor:'#F3DEAD',borderWidth:1,borderRadius:11,padding:10},noticeText:{flex:1,fontSize:9.5,lineHeight:15,color:'#805718',fontWeight:'700'},readOnly:{fontSize:9,color:'#8493A8',lineHeight:13},
  actions:{marginHorizontal:12,flexDirection:'row',gap:8},secondary:{flex:1,minHeight:43,borderRadius:12,borderColor:'#C5D6E9',borderWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},secondaryText:{fontSize:10,fontWeight:'800',color:'#0B3E88'},primary:{flex:1,minHeight:43,borderRadius:12,backgroundColor:'#08367D',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},primaryText:{fontSize:11,fontWeight:'800',color:'#FFF'},
  nav:{height:61,backgroundColor:'#081F4C',borderTopLeftRadius:17,borderTopRightRadius:17,flexDirection:'row',alignItems:'center'},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{width:34,height:32,borderRadius:11,backgroundColor:'#193869',alignItems:'center',justifyContent:'center'},navLabel:{fontSize:9,color:'#D5E1F3',fontWeight:'700'},
});
