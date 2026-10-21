import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { openPartnerClaimDocument, type PartnerClaimDocument } from '@/lib/claims';

type Props = { documents: PartnerClaimDocument[] | null; category?: string; claimId?: string };
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
export function PartnerClaimDocuments({ documents, category, claimId }: Props) {
  const [opening,setOpening]=useState<string|null>(null);
  const open=async(documentId:string)=>{
    if(!claimId||opening)return;
    setOpening(documentId);
    try {const url=await openPartnerClaimDocument(claimId,documentId);await Linking.openURL(url);}
    catch(e){Alert.alert('Unable to open document',e instanceof Error?e.message:'Please retry.');}
    finally{setOpening(null);}
  };
  if (documents === null) return <Text style={styles.hint}>Document inventory is not yet available from the authorized Partner claim API.</Text>;
  const matches = category ? documents.filter(doc => norm(doc.category || '') === norm(category)) : documents;
  if (matches.length === 0) return <Text style={styles.hint}>No uploaded documents are recorded{category ? ' in this category' : ''}.</Text>;
  return <View style={styles.list}>{matches.map(doc => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${doc.name}`} disabled={!claimId||Boolean(opening)} onPress={()=>void open(doc.id)} key={doc.id} style={styles.item}>
    <View style={styles.icon}><Ionicons name="document-text-outline" size={19} color="#1459A3"/></View>
    <View style={styles.info}><Text numberOfLines={2} style={styles.name}>{doc.name}</Text><Text style={styles.meta}>{doc.category || 'Claim document'} · Uploaded</Text></View>
    <View style={styles.state}><Ionicons name={opening===doc.id ? "hourglass-outline" : "open-outline"} size={16} color="#13855B"/><Text style={styles.uploaded}>{opening===doc.id ? "Opening…" : "View"}</Text></View>
  </Pressable>)}</View>;
}
const styles=StyleSheet.create({list:{gap:8},item:{flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:8,borderWidth:1,borderColor:'#DDE7EF',borderRadius:12,backgroundColor:'#FFF',gap:8},icon:{height:35,width:35,borderRadius:9,backgroundColor:'#EDF5FD',justifyContent:'center',alignItems:'center'},info:{flex:1,minWidth:0},name:{color:'#173354',fontSize:11,fontWeight:'800'},meta:{color:'#75869A',fontSize:9,marginTop:3},state:{flexDirection:'row',alignItems:'center',gap:3},uploaded:{fontSize:9,color:'#13855B',fontWeight:'800'},hint:{color:'#65758D',fontSize:11,lineHeight:17,paddingVertical:4}});
