import { PartnerClaimStageDraft } from '@/components/partner-claim-stage-draft';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerAssets } from '@/lib/partner-assets';
import type { PartnerClaimDetail } from '@/lib/claims';

type Stage = 'repair_ri' | 'billing' | 'delivery_order';
const SETTINGS: Record<Stage, { title: string; hint: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  repair_ri: { title: 'Repair & RI', hint: 'Repair completion and re-inspection details', icon: 'clipboard-search-outline' },
  billing: { title: 'Billing', hint: 'Record the final workshop bill', icon: 'receipt-text-check-outline' },
  delivery_order: { title: 'Delivery Order', hint: 'Record assessment and delivery order details', icon: 'file-document-multiple-outline' },
};

function ReadonlyField({ label, date = false }: { label: string; date?: boolean }) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.input} accessibilityLabel={label + ', unavailable in read-only Partner stage'}>
      <Text style={styles.placeholder}>{date ? 'Select date' : ''}</Text>
      {date ? <Ionicons name="calendar-outline" color="#94A0AE" size={23}/> : null}
    </View>
  </View>;
}
export function PartnerClaimWorkshopStage({ data, stage }: { data: PartnerClaimDetail; stage: Stage }) {
  const router = useRouter();
  const config = SETTINGS[stage];
  const insurer = data.insurer.name || 'Insurer not recorded';
  return <SafeAreaView style={styles.root} edges={['top','bottom']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Claim Tracker" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color="#FFF"/></Pressable>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="clipboard-text-outline" size={21} color="#FFF"/></View>
          <Text style={styles.heroTitle}>{config.title}</Text>
          <Text numberOfLines={1} style={styles.claimNo}>{data.claim.claim_no || 'Claim pending'}</Text>
        </View>
        <View style={styles.divider}/>
        <View style={styles.identityRow}>
          <View style={styles.identity}>
            <View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make) ?? PartnerAssets.navigation.claims} style={styles.logoImage as ImageStyle} resizeMode="contain"/></View>
            <View style={styles.identityCopy}><Text style={styles.identityMain} numberOfLines={1}>{data.vehicle.vehicle_no || 'Vehicle not recorded'}</Text><Text style={styles.identitySecondary} numberOfLines={2}>{data.vehicle.make || 'Manufacturer not recorded'}</Text></View>
          </View>
          <View style={styles.verticalDivider}/>
          <View style={styles.identity}>
            <View style={styles.logo}><PartnerInsurerLogo name={insurer} fallback={PartnerAssets.navigation.claims} style={styles.logoImage}/></View>
            <View style={styles.identityCopy}><Text style={styles.identityMain} numberOfLines={1}>{data.policy.policy_no || 'Policy not recorded'}</Text><Text style={styles.identitySecondary} numberOfLines={2}>{insurer}</Text></View>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name={config.icon} color="#0B4B97" size={29}/>
          <View style={styles.sectionCopy}><Text style={styles.sectionTitle}>Stage Details</Text><Text style={styles.sectionHint}>{config.hint}</Text></View>
        </View>
        {stage === 'repair_ri' ? <>
          <ReadonlyField label="Repair Complete Date *" date/>
          <View style={styles.hr}/>
          <View style={styles.reinspection}><Text style={styles.reinspectionTitle}>Re-inspection</Text><Text style={styles.reinspectionNote}>Always available</Text></View>
          <ReadonlyField label="RI Requested Date (Optional)" date/>
          <ReadonlyField label="RI Done Date *" date/>
        </> : null}
        {stage === 'billing' ? <>
          <ReadonlyField label="Bill Date *" date/>
          <ReadonlyField label="Bill Amount *"/>
        </> : null}
        {stage === 'delivery_order' ? <>
          <Text style={styles.fieldLabel}>Assessment Received? *</Text>
          <View style={styles.choiceRow}><View style={styles.choice}><Text style={styles.choiceText}>Yes</Text></View><View style={styles.choice}><Text style={styles.choiceText}>No</Text></View></View>
          <ReadonlyField label="DO Date *" date/>
          <ReadonlyField label="DO Amount *"/>
        </> : null}
        <Text style={styles.readOnly}>These fields are view-only until authorized Partner claim-stage updates are available.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('Get Assistance', 'Please contact your claims desk for help with this stage.')} style={styles.assistance}><MaterialCommunityIcons name="account-voice" color="#093876" size={20}/><Text style={styles.assistanceText}>Get Assistance</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue to Claim Tracker" onPress={() => router.back()} style={styles.continue}><Text style={styles.continueText}>Continue</Text><Ionicons name="arrow-forward" color="#FFF" size={21}/></Pressable>
      </View>
    <PartnerClaimStageDraft data={data} stage={stage} />
      </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#EDF5FE'},content:{paddingHorizontal:16,paddingTop:20,paddingBottom:45,gap:17},
  hero:{backgroundColor:'#0B347A',borderRadius:22,padding:15,gap:13},heroTop:{flexDirection:'row',alignItems:'center',gap:9},back:{height:35,width:35,alignItems:'center',justifyContent:'center',borderColor:'#5D81B4',borderWidth:1,borderRadius:19},heroIcon:{height:34,width:34,backgroundColor:'#1455B2',alignItems:'center',justifyContent:'center',borderRadius:20},heroTitle:{color:'#FFF',fontWeight:'900',fontSize:19,flex:1},claimNo:{color:'#FFF',fontWeight:'800',fontSize:12,maxWidth:'28%'},divider:{height:1,backgroundColor:'#5274A7'},identityRow:{flexDirection:'row',alignItems:'center',gap:10},identity:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:9},verticalDivider:{width:1,height:50,backgroundColor:'#5579AD'},logo:{width:48,height:48,borderRadius:13,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},logoImage:{width:37,height:37},identityCopy:{flex:1,minWidth:0},identityMain:{color:'#FFF',fontSize:13,fontWeight:'900'},identitySecondary:{color:'#D7E5FB',fontSize:10,fontWeight:'600',marginTop:3},
  card:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#D7E1EB',borderRadius:23,padding:20,gap:17},sectionHeader:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:3},sectionCopy:{flex:1},sectionTitle:{fontSize:18,fontWeight:'900',color:'#0F294A'},sectionHint:{color:'#7B8797',fontSize:11,marginTop:4},field:{gap:10},fieldLabel:{fontSize:13,fontWeight:'700',color:'#59677B'},input:{height:58,borderRadius:18,borderColor:'#E0E4EA',borderWidth:1,paddingHorizontal:15,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},placeholder:{fontSize:15,color:'#A9B0BA',fontWeight:'700'},hr:{height:1,backgroundColor:'#E4E9EE',marginVertical:3},reinspection:{flexDirection:'row',justifyContent:'space-between'},reinspectionTitle:{fontSize:14,fontWeight:'900',color:'#122A4D'},reinspectionNote:{fontSize:11,color:'#718196',fontWeight:'600'},choiceRow:{flexDirection:'row',gap:10},choice:{height:55,width:'39%',borderRadius:17,borderColor:'#DEE3E9',borderWidth:1,alignItems:'center',justifyContent:'center'},choiceText:{fontSize:13,color:'#9CA4AF',fontWeight:'800'},readOnly:{fontSize:10,color:'#8594A7'},actions:{flexDirection:'row',gap:10},assistance:{flex:1,height:58,borderRadius:17,borderColor:'#BBD0E6',borderWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},assistanceText:{fontSize:12,fontWeight:'900',color:'#103B79'},continue:{flex:1,height:58,borderRadius:17,backgroundColor:'#0A367E',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:15},continueText:{fontSize:13,fontWeight:'900',color:'#FFF'}
});
