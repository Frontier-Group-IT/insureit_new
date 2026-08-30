import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { getPartnerSupport, type PartnerSupport } from '@/lib/engagement';
import { partnerTheme } from '@/lib/theme';

export default function SupportScreen() {
  const router=useRouter();
  const [data,setData]=useState<PartnerSupport|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{getPartnerSupport().then(setData).finally(()=>setLoading(false));},[]);

  return <PartnerScreen eyebrow="SUPPORT" title="Your INSUREIT team" action={<PartnerIconButton icon="close" label="Close support" onPress={() => router.back()} />}>
    {loading || !data ? <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand}/></View> : <>
      {data.relationship_contact ? <View style={styles.personCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(data.relationship_contact.name)}</Text></View>
        <View style={styles.personBody}>
          <Text style={styles.eyebrow}>YOUR RELATIONSHIP CONTACT</Text>
          <Text style={styles.name}>{data.relationship_contact.name}</Text>
          <Text style={styles.meta}>{[data.relationship_contact.designation,data.relationship_contact.employee_code].filter(Boolean).join(' · ')}</Text>
        </View>
        <View style={styles.actions}>
          {data.relationship_contact.phone ? <Pressable onPress={()=>Linking.openURL(`tel:${data.relationship_contact?.phone}`)} style={styles.action}><Ionicons name="call-outline" size={17} color={partnerTheme.colors.brand}/></Pressable>:null}
          {data.relationship_contact.email ? <Pressable onPress={()=>Linking.openURL(`mailto:${data.relationship_contact?.email}`)} style={styles.action}><Ionicons name="mail-outline" size={17} color={partnerTheme.colors.brand}/></Pressable>:null}
        </View>
      </View> : <View style={styles.teamCard}><View style={styles.teamIcon}><Ionicons name="people-outline" size={20} color={partnerTheme.colors.brand}/></View><View style={styles.personBody}><Text style={styles.name}>INSUREIT Operations Desk</Text><Text style={styles.meta}>Your work queues and service items are summarized below.</Text></View></View>}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Operations desk</Text></View>
      <View style={styles.opsCard}>
        <OpsStat value={data.operations.intakes_in_progress} label="Policy Intakes in progress" onPress={()=>router.push('/policy-intakes')}/>
        <OpsStat value={data.operations.intakes_need_attention} label="Need your attention" onPress={()=>router.push('/policy-intakes')}/>
        <OpsStat value={data.operations.active_claims} label="Active claims" onPress={()=>router.push('/(tabs)/claims')}/>
      </View>

      <View style={styles.note}><Ionicons name="shield-checkmark-outline" size={17} color={partnerTheme.colors.accent}/><Text style={styles.noteText}>Support only shows the relationship contact and work items already authorized for your Partner identity. It does not expose internal staff directories.</Text></View>
    </>}
  </PartnerScreen>;
}

function OpsStat({value,label,onPress}:{value:number;label:string;onPress:()=>void}){return <Pressable onPress={onPress} style={styles.opsRow}><View><Text style={styles.opsValue}>{value}</Text><Text style={styles.opsLabel}>{label}</Text></View><Ionicons name="chevron-forward" size={17} color="#9AA3B2"/></Pressable>}
function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'IT'}

const styles=StyleSheet.create({
  close:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},loading:{minHeight:260,alignItems:'center',justifyContent:'center'},
  personCard:{minHeight:110,flexDirection:'row',alignItems:'center',gap:12,borderRadius:partnerTheme.radius.xl,padding:17,backgroundColor:partnerTheme.colors.nav},teamCard:{minHeight:100,flexDirection:'row',alignItems:'center',gap:12,borderRadius:partnerTheme.radius.xl,padding:17,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  avatar:{width:48,height:48,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:'#383F52'},avatarText:{color:'#FFFFFF',fontSize:13,fontWeight:'800'},teamIcon:{width:46,height:46,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.brandSoft},personBody:{flex:1},eyebrow:{color:'#AAA5FF',fontSize:7,fontWeight:'800',letterSpacing:1},name:{marginTop:4,color:'#FFFFFF',fontSize:12,fontWeight:'800'},meta:{marginTop:3,color:'#C5CCDA',fontSize:8.5,lineHeight:12},
  actions:{flexDirection:'row',gap:6},action:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF'},
  sectionHeader:{marginTop:21,marginBottom:10},sectionTitle:{color:partnerTheme.colors.ink,fontSize:14,fontWeight:'800'},
  opsCard:{overflow:'hidden',borderRadius:18,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},opsRow:{minHeight:68,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:15,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:partnerTheme.colors.line},opsValue:{color:partnerTheme.colors.ink,fontSize:16,fontWeight:'800'},opsLabel:{marginTop:2,color:partnerTheme.colors.inkMuted,fontSize:8.5},
  note:{marginTop:14,flexDirection:'row',gap:8,borderRadius:14,padding:13,backgroundColor:partnerTheme.colors.accentSoft},noteText:{flex:1,color:'#56716F',fontSize:8.5,lineHeight:13}
});
