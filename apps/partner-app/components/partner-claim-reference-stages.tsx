import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerAssets } from '@/lib/partner-assets';
import type { PartnerClaimDetail } from '@/lib/claims';
import { PartnerClaimDocuments } from '@/components/partner-claim-documents';

type Stage = 'spot_status' | 'claim_intimation';
type DocumentTab = 'vehicle' | 'driver' | 'permit' | 'kyc' | 'forms';
type DocumentItem = { label: string; detail: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string };
const DOCUMENT_TABS: Array<{ key: DocumentTab; label: string }> = [
  { key:'vehicle', label:'1. Vehicle Docs' },
  { key:'driver', label:'2. Driver Docs' },
  { key:'permit', label:'3. Permit / Tax' },
  { key:'kyc', label:'4. KYC / Other' },
  { key:'forms', label:'5. Forms' },
];
const DOCUMENTS: Record<DocumentTab, DocumentItem[]> = {
  vehicle: [
    {label:'RC Copy',detail:'Registration certificate copy',icon:'file-document-outline',color:'#10AA81'},
    {label:'Insurance Copy',detail:'Insurance policy copy',icon:'shield-check-outline',color:'#2488DF'},
    {label:'Fitness Copy',detail:'Vehicle fitness copy',icon:'clipboard-check-outline',color:'#2B928F'},
    {label:'GR/Load Bill',detail:'GR or load bill copy',icon:'file-document-outline',color:'#EF9E21'},
    {label:'Fasttag report last 15 days',detail:'Fastag report for last 15 days',icon:'chart-line',color:'#528CCB'},
    {label:'Spot Report',detail:'Spot survey or inspection report',icon:'car-search',color:'#397CAB'},
    {label:'Estimate Copy',detail:'Workshop estimate copy',icon:'clipboard-text-outline',color:'#418BC6'},
  ],
  driver: [
    {label:'Driver Licence',detail:'Driver licence copy',icon:'card-account-details-outline',color:'#A45AD8'},
    {label:'Driver Aadhaar front',detail:'Driver Aadhaar front side',icon:'card-account-details-outline',color:'#5298BF'},
    {label:'Driver Aadhaar back',detail:'Driver Aadhaar back side',icon:'card-account-details-outline',color:'#5298BF'},
    {label:'Driver Statement',detail:'Driver statement document',icon:'file-document-multiple-outline',color:'#657CCC'},
  ],
  permit: [
    {label:'Road Tax',detail:'Road tax receipt',icon:'file-certificate-outline',color:'#558CCC'},
    {label:'Local Permit A',detail:'Local permit A copy',icon:'file-check-outline',color:'#608DC0'},
    {label:'Local Permit B',detail:'Local permit B copy',icon:'file-check-outline',color:'#608DC0'},
    {label:'National Permit',detail:'National permit copy',icon:'file-check-outline',color:'#608DC0'},
    {label:'Authorization Letter',detail:'Authorization letter copy',icon:'file-document-multiple-outline',color:'#757DD1'},
  ],
  kyc: [
    {label:'Aadhaar',detail:'Aadhaar card copy',icon:'card-account-details-outline',color:'#4C9ABB'},
    {label:'PAN',detail:'PAN card copy',icon:'card-account-details-outline',color:'#4C9ABB'},
    {label:'GST',detail:'GST certificate',icon:'wallet-outline',color:'#4E7FAA'},
    {label:'Cancelled Cheque',detail:'Cancelled cheque copy',icon:'wallet-outline',color:'#4E7FAA'},
    {label:'KYC Form',detail:'KYC form copy',icon:'clipboard-check-outline',color:'#418C96'},
  ],
  forms: [
    {label:'Claim Form',detail:'Signed claim form',icon:'file-document-multiple-outline',color:'#6C7ECF'},
    {label:'TP Affidavit',detail:'Third-party affidavit',icon:'file-check-outline',color:'#767BCB'},
    {label:'Towing Bill',detail:'Towing bill copy',icon:'truck-outline',color:'#4C85B6'},
    {label:'Repair Estimate',detail:'Workshop repair estimate',icon:'clipboard-text-outline',color:'#5B93BC'},
    {label:'NCB Verification',detail:'NCB verification document',icon:'clipboard-check-outline',color:'#529989'},
  ],
};

export function PartnerClaimReferenceStage({data, stage}:{data:PartnerClaimDetail;stage:Stage}) {
  const router=useRouter();
  const [documentTab,setDocumentTab]=useState<DocumentTab>('vehicle');
  const spot=stage==='spot_status';
  const title=spot?'Spot Status':'Claim Intimation';
  return <SafeAreaView style={styles.root} edges={['top','bottom']}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back to claim tracker" accessibilityRole="button" onPress={()=>router.back()} style={styles.back}><Ionicons name="chevron-back" size={23} color="#FFF"/></Pressable>
      <View style={styles.headerCopy}><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerSubtitle}>Claim Tracker</Text></View>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}><View style={styles.roundIcon}><MaterialCommunityIcons name="clipboard-text-outline" color="#FFF" size={21}/></View><Text style={styles.heroTitle}>{title}</Text><Text style={styles.control}>{data.claim.claim_no||'Not recorded'}</Text></View>
        <View style={styles.rule}/>
        <View style={styles.identityRow}>
          <View style={styles.identity}><View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make)??PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View><View style={styles.identityText}><Text numberOfLines={1} style={styles.identityTitle}>{data.vehicle.vehicle_no||'Vehicle not recorded'}</Text><Text numberOfLines={2} style={styles.identityCaption}>{data.vehicle.make||'Manufacturer not recorded'}</Text></View></View>
          <View style={styles.split}/>
          <View style={styles.identity}><View style={styles.logo}><PartnerInsurerLogo name={data.insurer.name} fallback={PartnerAssets.navigation.claims} style={styles.logoImage}/></View><View style={styles.identityText}><Text numberOfLines={1} style={styles.identityTitle}>{data.policy.policy_no||'Policy not recorded'}</Text><Text numberOfLines={2} style={styles.identityCaption}>{data.insurer.name||'Insurer not recorded'}</Text></View></View>
        </View>
      </View>
      {spot ? <>
        <View style={styles.card}><ReferenceIconHeading image={require('../assets/partner/claim-stages/spot-survey-reference.png')} title="Spot Survey"/><Readonly label="Spot Survey Done Date *" date/></View>
        <View style={styles.card}><ReferenceIconHeading image={require('../assets/partner/claim-stages/surveyor-details-reference.png')} title="Surveyor Details" subtitle="Optional"/><Readonly label="Surveyor Name (Optional)"/><Readonly label="Surveyor Email (Optional)"/><Readonly label="Surveyor Number (Optional)"/></View>
      </> : <>
        <View style={styles.card}><SectionHeading icon="clipboard-text-outline" title="Stage Details" subtitle="Record claim intimation, workshop and estimate details"/><Readonly label="Claim Intimation Date *" date/><Readonly label="Dealership Name *"/><Readonly label="Dealership Location *"/><Readonly label="Gate-in Date *" date/><Readonly label="Estimate Amount *" value={data.claim.estimated_loss==null?null:String(data.claim.estimated_loss)}/></View>
        <View style={styles.card}><View style={styles.docHeading}><Text style={styles.sectionTitle}>Documents for verification</Text><Text style={styles.chip}>Claims desk review</Text></View>
          <View style={styles.tabStrip}>{DOCUMENT_TABS.map(tab=><Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{selected:documentTab===tab.key}} accessibilityLabel={tab.label} onPress={()=>setDocumentTab(tab.key)} style={[styles.tab,documentTab===tab.key&&styles.tabSelected]}><Text numberOfLines={1} style={[styles.tabText,documentTab===tab.key&&styles.tabTextSelected]}>{tab.label}</Text></Pressable>)}</View>
          <View style={styles.lockNotice}><Ionicons name="lock-closed-outline" size={20} color="#77622E"/><Text style={styles.lockText}>This document stage is visible now. Uploads will open when the claims desk requests the Claim Intimation documents.</Text></View>
          <View style={styles.card}><Text style={styles.sectionTitle}>Uploaded claim documents</Text><PartnerClaimDocuments documents={data.documents} claimId={data.claim.id} /></View>
          <View style={styles.documentGrid}>{DOCUMENTS[documentTab].map(item=><View key={item.label} style={styles.documentTile}><View style={[styles.documentIcon,{backgroundColor:item.color}]}><MaterialCommunityIcons name={item.icon} color="#FFF" size={25}/></View><Text style={styles.documentName}>{item.label}</Text><Text style={styles.documentDescription}>{item.detail}</Text><View style={styles.uploadDisabled}><Ionicons name="cloud-upload-outline" size={15} color="#D9E2F3"/><Text style={styles.uploadDisabledText}>Upload</Text></View></View>)}</View>
          <View style={styles.additional}><MaterialCommunityIcons name="file-document-multiple-outline" size={28} color="#7C91BB"/><View style={styles.additionalCopy}><Text style={styles.additionalTitle}>Additional uploads locked</Text><Text style={styles.additionalHint}>The claims desk will open uploads when these documents are required.</Text></View><Ionicons name="chevron-forward" size={16} color="#7790B0"/></View></View>
      </>}
    </ScrollView>
    <View style={styles.nav}><Nav label="Home" icon="home" onPress={()=>router.push('/(tabs)' as never)}/><Nav label="Business" icon="briefcase-outline" onPress={()=>router.push('/(tabs)/business' as never)}/><Nav label="Policies" icon="document-text-outline" onPress={()=>router.push('/(tabs)/policies' as never)}/><Nav label="Claims" icon="shield-checkmark-outline" onPress={()=>router.push('/(tabs)/claims' as never)}/><Nav label="More" icon="grid-outline" onPress={()=>router.push('/(tabs)/more' as never)}/></View>
  </SafeAreaView>;
}
function ReferenceIconHeading({image,title,subtitle}:{image:import('react-native').ImageSourcePropType;title:string;subtitle?:string}) {return <View style={styles.sectionHeading}><Image source={image} resizeMode="contain" style={{width:28,height:28}}/><View style={{flex:1,flexDirection:'row',alignItems:'center',gap:5}}><Text style={styles.sectionTitle}>{title}</Text>{subtitle?<Text style={styles.sectionSubtitle}>{subtitle}</Text>:null}</View></View>}
function SectionHeading({icon,title,subtitle}:{icon:keyof typeof MaterialCommunityIcons.glyphMap;title:string;subtitle?:string}){return <View style={styles.sectionHeading}><MaterialCommunityIcons name={icon} size={28} color="#1C5AA9"/><View style={{flex:1}}><Text style={styles.sectionTitle}>{title}</Text>{subtitle?<Text style={styles.sectionSubtitle}>{subtitle}</Text>:null}</View></View>}
function Readonly({label,date=false,value}:{label:string;date?:boolean;value?:string|null}){return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.field}><Text style={[styles.fieldText,!value&&styles.placeholder]}>{value||'Not recorded'}</Text>{date?<Ionicons name="calendar-outline" color="#A8B1C0" size={19}/>:null}</View></View>}
function Nav({label,icon,onPress}:{label:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.navItem}><View style={styles.navIcon}><Ionicons name={icon} color="#DCE8FB" size={21}/></View><Text style={styles.navText}>{label}</Text></Pressable>}
const styles=StyleSheet.create({
root:{flex:1,backgroundColor:'#EDF6FE'},header:{height:50,backgroundColor:'#0860C8',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:10},back:{width:34,height:34,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1,justifyContent:'center'},headerTitle:{color:'#FFF',fontSize:15,fontWeight:'800'},headerSubtitle:{color:'#DDEBFA',fontSize:10},scroll:{flex:1},content:{padding:14,paddingTop:23,paddingBottom:35,gap:15},hero:{backgroundColor:'#07357E',borderRadius:18,padding:13,elevation:3},heroHeading:{flexDirection:'row',alignItems:'center',gap:9},roundIcon:{width:34,height:34,borderRadius:18,backgroundColor:'#1B60B8',alignItems:'center',justifyContent:'center'},heroTitle:{flex:1,fontSize:17,fontWeight:'900',color:'#FFF'},control:{fontSize:12,fontWeight:'800',color:'#FFF'},rule:{height:1,backgroundColor:'#597DAF',marginVertical:10},identityRow:{flexDirection:'row',alignItems:'center',gap:8},identity:{flex:1,flexDirection:'row',alignItems:'center',gap:7,minWidth:0},logo:{height:42,width:42,borderRadius:9,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},logoImage:{width:35,height:35},identityText:{flex:1,minWidth:0},identityTitle:{fontSize:10,fontWeight:'900',color:'#FFF'},identityCaption:{fontSize:8.5,fontWeight:'700',color:'#D6E7FF',marginTop:4},split:{height:42,width:1,backgroundColor:'#6583AF'},card:{backgroundColor:'#FFF',borderRadius:19,borderWidth:1,borderColor:'#D6E1EA',padding:15,gap:14},sectionHeading:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:10},sectionTitle:{fontSize:13.5,color:'#132D50',fontWeight:'900'},sectionSubtitle:{fontSize:10,color:'#8792A4',marginTop:4},fieldWrap:{gap:8,marginBottom:5},fieldLabel:{fontSize:11,color:'#52637E',fontWeight:'800'},field:{minHeight:53,borderRadius:15,borderColor:'#E4E8ED',borderWidth:1,backgroundColor:'#FCFDFE',paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},fieldText:{fontSize:12,fontWeight:'700',color:'#203655'},placeholder:{color:'#B5BBC7'},docHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},tabStrip:{flexDirection:'row',backgroundColor:'#F5F8FD',borderBottomWidth:1,borderBottomColor:'#D9E4F0'},tab:{flex:1,minWidth:0,minHeight:43,alignItems:'center',justifyContent:'center',paddingHorizontal:2,borderBottomWidth:3,borderBottomColor:'transparent'},tabSelected:{borderBottomColor:'#1671DC'},tabText:{fontSize:8,fontWeight:'700',color:'#65758B'},tabTextSelected:{color:'#114D9D',fontWeight:'900'},lockNotice:{borderRadius:13,backgroundColor:'#FFF7E5',flexDirection:'row',alignItems:'center',gap:9,paddingVertical:12,paddingHorizontal:11},lockText:{flex:1,fontSize:9.5,lineHeight:14,color:'#7B5B22',fontWeight:'700'},chip:{fontSize:9,color:'#2259A5',fontWeight:'800',backgroundColor:'#EFF6FF',borderRadius:12,paddingHorizontal:8,paddingVertical:5},documentGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},documentTile:{width:'31.5%',minHeight:160,borderRadius:13,borderWidth:1,borderColor:'#E0E7EE',padding:8,alignItems:'center',gap:6},documentIcon:{height:37,width:34,borderRadius:7,alignItems:'center',justifyContent:'center'},documentName:{fontSize:9.5,fontWeight:'800',color:'#2B3F5E',textAlign:'center'},documentDescription:{fontSize:8.5,color:'#919DAC',textAlign:'center',flex:1},uploadDisabled:{borderRadius:9,height:34,backgroundColor:'#A9BFE0',alignSelf:'stretch',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4},uploadDisabledText:{color:'#EBF2FB',fontSize:9,fontWeight:'800'},additional:{minHeight:63,borderWidth:1.5,borderStyle:'dashed',borderColor:'#CBD6E4',borderRadius:14,padding:10,flexDirection:'row',alignItems:'center',gap:10},additionalCopy:{flex:1},additionalTitle:{fontSize:10.5,fontWeight:'800',color:'#243655'},additionalHint:{fontSize:8.5,color:'#8796AA',marginTop:4},nav:{height:62,backgroundColor:'#071F4D',borderTopLeftRadius:17,borderTopRightRadius:17,flexDirection:'row',alignItems:'center'},navItem:{flex:1,alignItems:'center',gap:4},navIcon:{height:33,width:36,borderRadius:12,backgroundColor:'#193869',alignItems:'center',justifyContent:'center'},navText:{fontSize:9,color:'#C9DBF0',fontWeight:'700'}
});
