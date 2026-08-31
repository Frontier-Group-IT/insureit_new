import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { getPartnerActivity, type PartnerActivityData } from '@/lib/engagement';
import { partnerTheme } from '@/lib/theme';

export default function ActivityScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPartnerActivity(40)
      .then(setData)
      .catch(() => setError('Recent activity could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PartnerScreen eyebrow="ACTIVITY" title="What changed" action={<PartnerIconButton icon="close" label="Close activity" onPress={() => router.back()} />}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading || !data ? <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View> : <>
        {data.attention.length ? <>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Needs attention</Text></View>
          <View style={styles.attentionList}>
            {data.attention.slice(0,3).map((item) => <Pressable key={`${item.kind}-${item.title}`} onPress={() => router.push(item.route as never)} style={styles.attentionCard}>
              <View style={styles.attentionIcon}><Ionicons name="flash-outline" size={18} color={partnerTheme.colors.warning} /></View>
              <View style={styles.attentionBody}><Text style={styles.attentionTitle}>{item.title}</Text><Text style={styles.attentionText}>{item.subtitle}</Text></View>
              <Ionicons name="chevron-forward" size={16} color="#9AA3B2" />
            </Pressable>)}
          </View>
        </> : null}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent timeline</Text></View>
        {data.items.length ? <View style={styles.timeline}>
          {data.items.map((item,index) => <Pressable key={`${item.kind}-${item.entity_id}-${item.event_at}`} onPress={() => router.push(item.route as never)} style={styles.item}>
            <View style={styles.rail}><View style={[styles.dot,toneDot(item.tone)]} />{index < data.items.length - 1 ? <View style={styles.line} /> : null}</View>
            <View style={styles.itemBody}>
              <View style={styles.itemTop}><Text style={[styles.kind,toneText(item.tone)]}>{labelFor(item.kind)}</Text><Text style={styles.date}>{formatDate(item.event_at)}</Text></View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              <Text style={styles.meta}>{item.meta}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#B2B8C2" />
          </Pressable>)}
        </View> : <View style={styles.empty}><Text style={styles.emptyText}>No recent activity in this scope.</Text></View>}
      </>}
    </PartnerScreen>
  );
}

function labelFor(kind: PartnerActivityData['items'][number]['kind']) { if (kind === 'policy') return 'POLICY'; if (kind === 'claim') return 'CLAIM'; if (kind === 'intake') return 'OPERATIONS'; return 'LEARN'; }
function toneDot(tone: PartnerActivityData['items'][number]['tone']) { if (tone === 'service') return styles.dotService; if (tone === 'attention') return styles.dotAttention; if (tone === 'learn') return styles.dotLearn; if (tone === 'operations') return styles.dotOps; return styles.dotBusiness; }
function toneText(tone: PartnerActivityData['items'][number]['tone']) { if (tone === 'service') return styles.textService; if (tone === 'attention') return styles.textAttention; if (tone === 'learn') return styles.textLearn; if (tone === 'operations') return styles.textOps; return styles.textBusiness; }
function formatDate(value:string){const d=new Date(value);if(Number.isNaN(d.getTime()))return value;return new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d);}

const styles=StyleSheet.create({
  close:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},error:{color:partnerTheme.colors.danger,fontSize:10},loading:{minHeight:240,alignItems:'center',justifyContent:'center'},
  sectionHeader:{marginTop:14,marginBottom:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sectionTitle:{color:partnerTheme.colors.ink,fontSize:14,fontWeight:'800'},
  attentionList:{gap:8},attentionCard:{minHeight:60,flexDirection:'row',alignItems:'center',gap:10,borderRadius:16,paddingHorizontal:13,backgroundColor:'#FFF9EE',borderWidth:1,borderColor:'#F5DFC1'},attentionIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#FFF0D5'},attentionBody:{flex:1},attentionTitle:{color:partnerTheme.colors.ink,fontSize:10.5,fontWeight:'800'},attentionText:{marginTop:3,color:'#806B52',fontSize:8.5,lineHeight:13},
  timeline:{marginTop:2},item:{minHeight:76,flexDirection:'row',gap:8},rail:{width:24,alignItems:'center'},dot:{width:10,height:10,borderRadius:5,marginTop:6},dotBusiness:{backgroundColor:partnerTheme.colors.brand},dotService:{backgroundColor:partnerTheme.colors.accent},dotAttention:{backgroundColor:partnerTheme.colors.warning},dotLearn:{backgroundColor:'#C17B18'},dotOps:{backgroundColor:'#667085'},line:{width:1,flex:1,marginTop:4,backgroundColor:partnerTheme.colors.line},
  itemBody:{flex:1,paddingBottom:11},itemTop:{flexDirection:'row',justifyContent:'space-between',gap:8},kind:{fontSize:7.2,fontWeight:'800',letterSpacing:.8},textBusiness:{color:partnerTheme.colors.brand},textService:{color:partnerTheme.colors.accent},textAttention:{color:partnerTheme.colors.warning},textLearn:{color:'#A3630D'},textOps:{color:'#667085'},date:{color:partnerTheme.colors.inkMuted,fontSize:7.5},title:{marginTop:5,color:partnerTheme.colors.ink,fontSize:11,fontWeight:'800'},subtitle:{marginTop:3,color:partnerTheme.colors.inkMuted,fontSize:8.5},meta:{marginTop:4,color:'#8A94A6',fontSize:8},empty:{minHeight:160,alignItems:'center',justifyContent:'center'},emptyText:{color:partnerTheme.colors.inkMuted,fontSize:9}
});
