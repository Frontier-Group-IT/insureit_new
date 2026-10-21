import { PartnerClaimStageDraft } from '@/components/partner-claim-stage-draft';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerAssets } from '@/lib/partner-assets';
import type { PartnerClaimDetail } from '@/lib/claims';

/** Read-only reference layout: the Partner claim API has no authorized settlement-stage write endpoint. */
export function PartnerPaymentEncashment({ data }: { data: PartnerClaimDetail }) {
  const router = useRouter();
  const insurer = data.insurer.name || 'Insurer not recorded';
  return <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Claim Tracker" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={20} color="#FFF"/>
          </Pressable>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="cash-check" size={18} color="#FFF"/></View>
          <Text numberOfLines={1} style={styles.heroTitle}>Payment Encashment</Text>
          <Text numberOfLines={1} style={styles.control}>{data.claim.claim_no || 'Control number pending'}</Text>
        </View>
        <View style={styles.divider}/>
        <View style={styles.identityRow}>
          <View style={styles.identity}>
            <View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make) ?? PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View>
            <View style={styles.identityText}><Text numberOfLines={1} style={styles.identityTitle}>{data.vehicle.vehicle_no || 'Vehicle not recorded'}</Text><Text numberOfLines={1} style={styles.identityCaption}>{data.vehicle.make || 'Manufacturer not recorded'}</Text></View>
          </View>
          <View style={styles.identityDivider}/>
          <View style={styles.identity}>
            <View style={styles.logo}><PartnerInsurerLogo name={insurer} fallback={PartnerAssets.navigation.claims} style={styles.logoImage}/></View>
            <View style={styles.identityText}><Text numberOfLines={1} style={styles.identityTitle}>{data.policy.policy_no || 'Policy not recorded'}</Text><Text numberOfLines={2} style={styles.identityCaption}>{insurer}</Text></View>
          </View>
        </View>
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeader}><MaterialCommunityIcons name="cash-check" size={25} color="#1959A6"/><View style={styles.cardHeadingText}><Text style={styles.cardTitle}>Stage Details</Text><Text style={styles.cardSubtitle}>Record final documents and settlement payment</Text></View></View>
        <YesNo label="Depreciation Slip Submitted?" />
        <YesNo label="Satisfaction Voucher Submitted?" />
        <DateField label="Documents Submit Date" required={false}/>
        <DateField label="Payment Received Date" required/>
        <View style={styles.formGroup}><Text style={styles.fieldLabel}>Amount Received <Text style={styles.required}>*</Text></Text><View style={styles.inputPlaceholder}><Text style={styles.placeholder}>Not recorded</Text></View></View>
        <Text style={styles.readonly}>Settlement updates are unavailable in the Partner app. These fields are displayed for reference and cannot be submitted.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Get Assistance" onPress={() => Alert.alert('Get Assistance', 'Please contact your claims desk for settlement assistance.')} style={styles.assist}><MaterialCommunityIcons name="account-voice" size={17} color="#164A90"/><Text style={styles.assistText}>Get Assistance</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Claim" onPress={() => router.back()} style={styles.primary}><Text style={styles.primaryText}>Back to Claim</Text><Ionicons name="checkmark" color="#FFF" size={17}/></Pressable>
      </View>
    <PartnerClaimStageDraft data={data} stage={"payment_encashment"} />
      </ScrollView>
    <View style={styles.nav}><Nav label="Home" icon="home" onPress={() => router.push('/(tabs)' as never)}/><Nav label="Business" icon="briefcase-outline" onPress={() => router.push('/(tabs)/business' as never)}/><Nav label="Policies" icon="document-text-outline" onPress={() => router.push('/(tabs)/policies' as never)}/><Nav label="Claims" icon="shield-checkmark-outline" onPress={() => router.push('/(tabs)/claims' as never)}/><Nav label="More" icon="grid-outline" onPress={() => router.push('/(tabs)/more' as never)}/></View>
  </SafeAreaView>;
}
function YesNo({ label }: { label: string }) {
  return <View style={styles.formGroup}><Text style={styles.fieldLabel}>{label} <Text style={styles.required}>*</Text></Text><View style={styles.choiceRow}><View style={styles.choice}><Text style={styles.choiceLabel}>Yes</Text></View><View style={styles.choice}><Text style={styles.choiceLabel}>No</Text></View></View></View>;
}
function DateField({label,required}:{label:string;required:boolean}) {
  return <View style={styles.formGroup}><Text style={styles.fieldLabel}>{label}{required?<Text style={styles.required}> *</Text>:null}</Text><View style={styles.dateField}><Text style={styles.placeholder}>Select date</Text><Ionicons name="calendar-outline" size={20} color="#9FA9B6"/></View></View>;
}
function Nav({label,icon,onPress}:{label:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.navItem}><View style={styles.navIcon}><Ionicons name={icon} size={19} color="#D6E4F9"/></View><Text style={styles.navLabel}>{label}</Text></Pressable>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#EDF6FE'},scroll:{flex:1},content:{paddingHorizontal:14,paddingTop:16,paddingBottom:28,gap:15},
  hero:{borderRadius:20,backgroundColor:'#083477',padding:13,shadowColor:'#142E58',shadowOpacity:.15,shadowRadius:5,elevation:3},
  heroHeading:{flexDirection:'row',alignItems:'center',gap:7},back:{width:27,height:29,justifyContent:'center',alignItems:'center'},headerIcon:{height:29,width:29,backgroundColor:'#1559B2',borderRadius:15,justifyContent:'center',alignItems:'center'},heroTitle:{flex:1,color:'#FFF',fontSize:15,fontWeight:'900'},control:{color:'#FFF',fontSize:11,fontWeight:'800',maxWidth:'29%'},divider:{height:1,backgroundColor:'#6382B3',marginTop:10,marginBottom:10},
  identityRow:{flexDirection:'row',alignItems:'center',gap:8},identity:{flex:1,flexDirection:'row',gap:7,alignItems:'center',minWidth:0},identityDivider:{width:1,height:39,backgroundColor:'#5679AD'},logo:{height:42,width:42,backgroundColor:'#FFF',borderRadius:10,alignItems:'center',justifyContent:'center'},logoImage:{height:34,width:34},identityText:{flex:1,minWidth:0},identityTitle:{color:'#FFF',fontSize:10.5,fontWeight:'900'},identityCaption:{color:'#D8E6FA',fontSize:9,marginTop:3},
  card:{backgroundColor:'#FFF',borderRadius:20,borderWidth:1,borderColor:'#D9E4EF',padding:15,gap:18},cardHeader:{flexDirection:'row',alignItems:'center',gap:13,marginBottom:1},cardHeadingText:{flex:1},cardTitle:{fontSize:14,fontWeight:'900',color:'#152B4B'},cardSubtitle:{fontSize:10,color:'#7B899C',marginTop:3},
  formGroup:{gap:9},fieldLabel:{fontSize:11,fontWeight:'800',color:'#617087'},required:{color:'#DE4B4B'},choiceRow:{flexDirection:'row',gap:9},choice:{height:47,width:'33%',borderRadius:12,borderWidth:1,borderColor:'#E2E5EA',alignItems:'center',justifyContent:'center'},choiceLabel:{fontSize:11,fontWeight:'700',color:'#A5AAB5'},dateField:{height:52,borderWidth:1,borderColor:'#E6EAF0',borderRadius:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14},inputPlaceholder:{minHeight:54,borderWidth:1,borderColor:'#E6EAF0',borderRadius:17,justifyContent:'center',paddingHorizontal:14},placeholder:{fontSize:12,fontWeight:'600',color:'#ABB3C0'},readonly:{fontSize:9,color:'#7F8C9D',lineHeight:14},
  actions:{flexDirection:'row',gap:9},assist:{flex:1,borderWidth:1,borderColor:'#C6D8E9',backgroundColor:'#F6FAFE',borderRadius:13,minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},assistText:{color:'#19458B',fontSize:10,fontWeight:'800'},primary:{flex:1,backgroundColor:'#0B347D',borderRadius:13,minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},primaryText:{color:'#FFF',fontSize:11,fontWeight:'900'},
  nav:{height:62,backgroundColor:'#081F4C',borderTopLeftRadius:17,borderTopRightRadius:17,flexDirection:'row',alignItems:'center'},navItem:{flex:1,alignItems:'center',gap:4},navIcon:{height:33,width:35,backgroundColor:'#193869',borderRadius:12,alignItems:'center',justifyContent:'center'},navLabel:{color:'#D2E0F4',fontSize:9,fontWeight:'700'}
});
