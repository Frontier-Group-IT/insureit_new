import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { getPartnerRecognition, type PartnerRecognition } from '@/lib/engagement';
import { partnerTheme } from '@/lib/theme';

export default function RecognitionScreen() {
  const router = useRouter();
  const [data,setData]=useState<PartnerRecognition|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{getPartnerRecognition().then(setData).finally(()=>setLoading(false));},[]);

  return (
    <PartnerScreen eyebrow="RECOGNITION" title="Progress worth noticing" onBack={() => router.back()}>
      {loading || !data ? <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand}/></View> : (
        <>
          <View style={styles.hero}>
            <Ionicons name="sparkles-outline" size={24} color="#FFFFFF" />
            <Text style={styles.heroTitle}>Your milestones</Text>
          </View>

          <View style={styles.list}>
            {data.items.length ? data.items.map((item)=><View key={item.code} style={styles.card}>
              <View style={[styles.icon,toneStyle(item.tone)]}><Ionicons name={iconName(item.icon)} size={19} color={iconColor(item.tone)}/></View>
              <View style={styles.body}><Text style={styles.title}>{item.title}</Text><Text style={styles.text}>{item.body}</Text>{item.date ? <Text style={styles.date}>{formatDate(item.date)}</Text>:null}</View>
            </View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>More highlights will appear here</Text><Text style={styles.emptyText}>Recognition is only created when the system can prove the underlying milestone.</Text></View>}
          </View>

          {data.next_milestone ? <View style={styles.nextCard}>
            <Text style={styles.nextEyebrow}>NEXT MILESTONE</Text>
            <Text style={styles.nextTitle}>{data.next_milestone.title}</Text>
            <Text style={styles.nextText}>{data.next_milestone.remaining} remaining · {data.next_milestone.current} / {data.next_milestone.target}</Text>
            <View style={styles.track}><View style={[styles.fill,{width:`${Math.min(100,(data.next_milestone.current/data.next_milestone.target)*100)}%`}]} /></View>
          </View>:null}
        </>
      )}
    </PartnerScreen>
  );
}

function iconName(icon: PartnerRecognition['items'][number]['icon']) { if(icon==='learn') return 'bulb-outline' as const; if(icon==='renewal') return 'refresh-outline' as const; return 'trail-sign-outline' as const; }
function toneStyle(tone: PartnerRecognition['items'][number]['tone']) { if(tone==='learn') return styles.learn; if(tone==='clear') return styles.clear; return styles.journey; }
function iconColor(tone: PartnerRecognition['items'][number]['tone']) { if(tone==='learn') return '#9A5B12'; if(tone==='clear') return partnerTheme.colors.success; return partnerTheme.colors.brand; }
function formatDate(value:string){const d=new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(d);}

const styles=StyleSheet.create({
  close:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},loading:{minHeight:260,alignItems:'center',justifyContent:'center'},
  hero:{borderRadius:partnerTheme.radius.xl,padding:15,backgroundColor:partnerTheme.colors.nav},heroTitle:{marginTop:6,color:'#FFFFFF',fontSize:18,fontWeight:'800'},
  list:{marginTop:11,gap:7},card:{minHeight:66,flexDirection:'row',alignItems:'center',gap:12,borderRadius:17,padding:11,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  icon:{width:36,height:36,borderRadius:14,alignItems:'center',justifyContent:'center'},journey:{backgroundColor:partnerTheme.colors.brandSoft},learn:{backgroundColor:'#FFF2DD'},clear:{backgroundColor:'#EAF7EF'},body:{flex:1},title:{color:partnerTheme.colors.ink,fontSize:10.5,fontWeight:'800'},text:{marginTop:4,color:partnerTheme.colors.inkMuted,fontSize:8.5,lineHeight:13},date:{marginTop:5,color:partnerTheme.colors.brand,fontSize:7.5,fontWeight:'700'},
  empty:{minHeight:110,alignItems:'center',justifyContent:'center',padding:20,borderRadius:18,backgroundColor:partnerTheme.colors.surface},emptyTitle:{color:partnerTheme.colors.ink,fontSize:11,fontWeight:'800'},emptyText:{marginTop:5,color:partnerTheme.colors.inkMuted,fontSize:8.5,lineHeight:13,textAlign:'center'},
  nextCard:{marginTop:11,borderRadius:18,padding:13,backgroundColor:partnerTheme.colors.brandSoft},nextEyebrow:{color:partnerTheme.colors.brand,fontSize:7.5,fontWeight:'800',letterSpacing:1},nextTitle:{marginTop:5,color:partnerTheme.colors.ink,fontSize:13,fontWeight:'800'},nextText:{marginTop:4,color:'#5D5A80',fontSize:8.5},track:{height:7,marginTop:9,overflow:'hidden',borderRadius:999,backgroundColor:'#DCD9FF'},fill:{height:'100%',borderRadius:999,backgroundColor:partnerTheme.colors.brand}
});
