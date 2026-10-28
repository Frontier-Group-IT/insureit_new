import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PartnerClaimDocument } from '@/lib/claims';

type Props = { documents: PartnerClaimDocument[] | null; category?: string };
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
export function PartnerClaimDocuments({ documents, category }: Props) {
  if (documents === null) return <Text style={styles.hint}>Document inventory is not yet available from the authorized Partner claim API.</Text>;
  const matches = category ? documents.filter(doc => norm(doc.category || '') === norm(category)) : documents;
  if (matches.length === 0) return <Text style={styles.hint}>No uploaded documents are recorded{category ? ' in this category' : ''}.</Text>;
  const groups = Array.from(matches.reduce((map, doc) => {
    const category = doc.category || 'Claim document';
    map.set(category, (map.get(category) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries());
  return <View style={styles.list}>{groups.map(([category, count]) => <View key={category} style={styles.item}>
    <View style={styles.icon}><Ionicons name="document-text-outline" size={19} color="#1459A3"/></View>
    <View style={styles.info}><Text style={styles.name}>{category}</Text><Text style={styles.meta}>{count} file{count === 1 ? '' : 's'} uploaded</Text></View>
    <Text style={styles.uploaded}>Saved</Text>
  </View>)}</View>;
}
const styles=StyleSheet.create({list:{gap:8},item:{flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:8,borderWidth:1,borderColor:'#DDE7EF',borderRadius:12,backgroundColor:'#EFFAF4',gap:8},icon:{height:35,width:35,borderRadius:9,backgroundColor:'#EDF5FD',justifyContent:'center',alignItems:'center'},info:{flex:1,minWidth:0},name:{color:'#173354',fontSize:11,fontWeight:'800'},meta:{color:'#75869A',fontSize:9,marginTop:3},uploaded:{fontSize:9,color:'#13855B',fontWeight:'800'},hint:{color:'#65758D',fontSize:11,lineHeight:17,paddingVertical:4}});
