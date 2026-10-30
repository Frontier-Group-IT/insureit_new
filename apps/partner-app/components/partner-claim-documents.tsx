import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PartnerClaimDocument } from '@/lib/claims';
import { supabase } from '@/lib/supabase';

type Props = { documents: PartnerClaimDocument[] | null; claimId: string; category?: string };
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
export function PartnerClaimDocuments({ documents, claimId, category }: Props) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selection, setSelection] = useState<PartnerClaimDocument[] | null>(null);
  if (documents === null) return <Text style={styles.hint}>Document inventory is not yet available from the authorized Partner claim API.</Text>;
  const matches = category ? documents.filter(doc => norm(doc.category || '') === norm(category)) : documents;
  if (matches.length === 0) return <Text style={styles.hint}>No uploaded documents are recorded{category ? ' in this category' : ''}.</Text>;
  const groups = Array.from(matches.reduce((map, doc) => {
    const group = doc.category || 'Claim document';
    map.set(group, [...(map.get(group) ?? []), doc]);
    return map;
  }, new Map<string, PartnerClaimDocument[]>()).entries());
  async function openDocument(file: PartnerClaimDocument) {
    if (openingId) return;
    setOpeningId(file.id);
    try {
      // Identical claim-scoped preview path flow to the Partner claim upload component.
      const { data: path, error: pathError } = await supabase.rpc('partner_app_claim_document_preview_path', { p_claim_id: claimId, p_document_id: file.id });
      if (pathError) throw pathError;
      if (typeof path !== 'string' || !path) throw new Error('The document is not available.');
      const { data: signed, error: signError } = await supabase.storage.from('claim-documents').createSignedUrl(path, 120);
      if (signError) throw signError;
      if (!signed?.signedUrl) throw new Error('A secure preview link could not be generated.');
      await Linking.openURL(signed.signedUrl);
    } catch (error) {
      Alert.alert('Unable to open document', error instanceof Error ? error.message : 'Please try again.');
    } finally { setOpeningId(null); }
  }
  function chooseDocument(files: PartnerClaimDocument[]) {
    if (files.length === 1) { void openDocument(files[0]); return; }
    setSelection(files);
  }
  return <><View style={styles.list}>{groups.map(([group, files]) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${group} documents`} key={group} onPress={() => chooseDocument(files)} disabled={Boolean(openingId)} style={styles.item}>
    <View style={styles.icon}><Ionicons name="document-text-outline" size={19} color="#1F2937"/></View>
    <View style={styles.info}><Text style={styles.name}>{group}</Text><Text style={styles.meta}>{files.length} file{files.length === 1 ? '' : 's'} uploaded</Text></View>
    {openingId && files.some(file => file.id === openingId) ? <ActivityIndicator size="small" color="#1459A3"/> : <Ionicons name="open-outline" size={20} color="#1459A3"/>}
  </Pressable>)}</View>
    <Modal visible={Boolean(selection)} transparent animationType="fade" onRequestClose={() => setSelection(null)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Open document</Text><ScrollView style={styles.modalList}>{selection?.map(file => <Pressable key={file.id} accessibilityRole="button" accessibilityLabel={`Open ${file.name}`} onPress={() => { setSelection(null); void openDocument(file); }} style={styles.fileRow}><Ionicons name="document-outline" size={20} color="#1459A3"/><Text numberOfLines={2} style={styles.fileName}>{file.name}</Text><Ionicons name="open-outline" size={18} color="#1459A3"/></Pressable>)}</ScrollView><Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => setSelection(null)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable></View></View></Modal>
  </>;
}
const styles=StyleSheet.create({modalBackdrop:{flex:1,backgroundColor:'rgba(5,24,53,.6)',justifyContent:'center',padding:20},modalCard:{backgroundColor:'#FFF',borderRadius:18,padding:16,maxHeight:'75%',gap:12},modalTitle:{fontSize:16,fontWeight:'900',color:'#10284B'},modalList:{flexGrow:0},fileRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderColor:'#E5ECF3'},fileName:{flex:1,fontSize:12,color:'#10284B'},cancel:{padding:12,alignItems:'center',borderRadius:10,backgroundColor:'#EBF3FF'},cancelText:{fontSize:12,fontWeight:'800',color:'#1459A3'},list:{gap:8},item:{flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:8,borderWidth:1,borderColor:'#DDE7EF',borderRadius:12,backgroundColor:'#F7F9FC',gap:8},icon:{height:35,width:35,borderRadius:9,backgroundColor:'#F0F2F6',justifyContent:'center',alignItems:'center'},info:{flex:1,minWidth:0},name:{color:'#1F2937',fontSize:11,fontWeight:'800'},meta:{color:'#6B7280',fontSize:9,marginTop:3},hint:{color:'#65758D',fontSize:11,lineHeight:17,paddingVertical:4}});
