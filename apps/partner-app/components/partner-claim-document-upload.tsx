import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Image, Modal, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { attachPartnerClaimDocument, removePartnerClaimDocument, type PartnerClaimDetail } from '@/lib/claims';
import { supabase } from '@/lib/supabase';

/** Subtle icon-only pulse. No background, and disabled when reduced motion is requested. */
function VerificationPulse({ children, active, tint }: { children: ReactNode; active: boolean; tint: string }) {
  const animation = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!active || reduceMotion) {
      animation.stopAnimation();
      animation.setValue(1);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(animation, { toValue: 1.09, duration: 850, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 1, duration: 850, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); animation.setValue(1); };
  }, [active, reduceMotion, animation]);
  return <Animated.View style={{ transform: [{ scale: animation }], borderColor: tint }}>{children}</Animated.View>;
}

type Props = {
  claimId: string;
  customerId: string;
  documentType: string;
  milestoneKey?: string;
  documents?: PartnerClaimDetail['documents'];
  compact?: boolean;
  tileFullWidth?: boolean;
  variant?: 'button' | 'tile' | 'bulk' | 'voice' | 'billing';
  artwork?: ImageSourcePropType;
  label?: string;
  subtitle?: string;
};

export function PartnerClaimDocumentUpload({ claimId, customerId, documentType, milestoneKey, documents, compact = false, tileFullWidth = false, variant = 'button', artwork, label, subtitle }: Props) {
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{ fileName: string; count: number } | null>(null);
  const [added, setAdded] = useState<Array<{ id: string; name: string; category: string }>>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const uploaded = [...(documents ?? []), ...added].filter(item => item.category === documentType && !removedIds.includes(item.id));
  const count = uploaded.length;
  const latest = uploaded[uploaded.length - 1];
  const [bulkFilesOpen, setBulkFilesOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [selectedForReview, setSelectedForReview] = useState<string[]>([]);
  const allVerified = count > 0 && uploaded.every(file => 'verification_status' in file && file.verification_status === 'verified');
  const deleting = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await removePartnerClaimDocument(claimId, deleteTarget.id);
      setRemovedIds(current => [...current, deleteTarget.id]);
      setDeleteTarget(null);
    } catch (error) {
      Alert.alert('Unable to delete', error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  };

  async function pickAndUpload() {
    if (busy) return;
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: documentType === 'Accident Photo' || documentType === 'Accident Video' || documentType === 'Spot Intimation Attachment' || documentType.endsWith(' Additional Documents'),
      type: variant === 'billing' ? ['application/pdf', 'image/jpeg', 'image/png'] : ['application/pdf', 'image/*', 'video/*', 'audio/*'],
    });
    if (picked.canceled) return;
    if (variant === 'billing' && picked.assets.some(asset => !/\.(pdf|jpe?g|png)$/i.test(asset.name ?? ''))) {
      Alert.alert('Unsupported file', 'Choose a PDF, JPG, or PNG workshop bill.');
      return;
    }
    setBusy(true);
    setUploadProgress({ completed: 0, total: picked.assets.length });
    try {
      for (const asset of picked.assets) {
        if (asset.size && asset.size > 50 * 1024 * 1024) throw new Error('Each claim file must be 50 MB or smaller.');
        const extension = safeExtension(asset.name, asset.mimeType);
        const storagePath = `${customerId}/${claimId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error('The selected file could not be read from this device.');
        const body = await response.arrayBuffer();
        if (!body.byteLength) throw new Error('The selected file is empty.');
        const upload = await supabase.storage.from('claim-documents').upload(storagePath, body, {
          contentType: asset.mimeType ?? 'application/octet-stream',
          upsert: false,
        });
        if (upload.error) throw upload.error;
        try {
          const documentId = await attachPartnerClaimDocument({
            claimId,
            documentType,
            fileName: asset.name || documentType,
            storagePath,
            mimeType: asset.mimeType,
            fileSize: asset.size ?? body.byteLength,
            milestoneKey: milestoneKey ?? null,
          });
          setAdded(current => [...current, { id: documentId, name: asset.name || documentType, category: documentType }]);
          setUploadProgress(previous => previous ? { ...previous, completed: previous.completed + 1 } : null);
        } catch (error) {
          await supabase.storage.from('claim-documents').remove([storagePath]);
          throw error;
        }
      }
      setUploadSuccess({ fileName: picked.assets[picked.assets.length - 1]?.name || documentType, count: picked.assets.length });
    } catch (error) {
      Alert.alert('Unable to upload', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUploadProgress(null);
      setBusy(false);
    }
  }

  const progressDialog = (
    <Modal transparent visible={uploadProgress !== null} animationType="fade" onRequestClose={() => {}}>
      <View style={styles.modalDim}><View style={styles.progressDialog}>
        <ActivityIndicator size="large" color="#1768C9" />
        <Text style={styles.progressTitle}>Uploading Documents</Text>
        <Text style={styles.progressSubtitle}>Please keep this screen open while your files upload.</Text>
        <Text style={styles.progressCount}>{uploadProgress ? `Uploading file ${Math.min(uploadProgress.completed + 1, uploadProgress.total)} of ${uploadProgress.total}` : ''}</Text>
        <Text style={styles.progressSubtitle}>{uploadProgress?.completed ?? 0} completed</Text>
      </View></View>
    </Modal>
  );

  const successDialog = (
    <Modal transparent visible={uploadSuccess !== null} animationType="fade" onRequestClose={() => setUploadSuccess(null)}>
      <View style={styles.modalDim}>
        <View style={styles.successDialog}>
          <View style={styles.successCircle}><Ionicons name="checkmark-circle" color="#18965D" size={38} /></View>
          <Text style={styles.successTitle}>Document Uploaded!</Text>
          <Text style={styles.successMessage}>{uploadSuccess && uploadSuccess.count > 1 ? `${uploadSuccess.count} documents uploaded successfully.` : `${label ?? documentType} uploaded successfully.`}</Text>
          <View style={styles.successFileRow}>
            <Ionicons name="document-text-outline" color="#18965D" size={23}/>
            <View style={styles.successFileCopy}>
              <Text numberOfLines={1} style={styles.successFileType}>{uploadSuccess && uploadSuccess.count > 1 ? `${uploadSuccess.count} uploaded files` : label ?? documentType}</Text>
              <Text numberOfLines={1} style={styles.successFileName}>{uploadSuccess?.fileName ?? ''}</Text>
            </View>
            <Ionicons name="checkmark-circle-outline" color="#18965D" size={21}/>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close upload confirmation" onPress={() => setUploadSuccess(null)} style={styles.successOk}><Text style={styles.successOkText}>OK</Text></Pressable>
        </View>
      </View>
    </Modal>
  );

  if (variant === 'billing') {
    return (
      <>
        <View style={styles.billingShell}>
          <Ionicons name="document-text-outline" size={28} color="#1857A9" />
          <View style={styles.billingCopy}>
            <Text style={styles.billingTitle} numberOfLines={1}>{busy ? 'Uploading workshop bill…' : 'Upload final workshop bill'}</Text>
            <Text style={styles.billingSubtitle} numberOfLines={1}>{count ? `${count} uploaded • ${latest?.name ?? 'Saved'}` : 'PDF, JPG, PNG'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose final workshop bill" accessibilityState={{ busy }} disabled={busy} onPress={() => void pickAndUpload()} style={({ pressed }) => [styles.billingChoose, busy && styles.disabled, pressed && !busy && styles.pressed]}>
            <Text style={styles.billingChooseText}>{busy ? 'Uploading…' : 'Choose File'}</Text>
          </Pressable>
        </View>
        {progressDialog}
        {successDialog}
      </>
    );
  }

  if (variant === 'tile') {
    return (
      <>
        <View style={[styles.tile, tileFullWidth && styles.tileFullWidth, count > 0 && styles.tileReady]}>
          {count > 0 && !busy ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Review ${label ?? documentType} uploaded files`}
              style={styles.tileVerify} onPress={() => { setSelectedForReview([]); setVerificationOpen(true); }}>
              <VerificationPulse active tint="#1769DC"><Text style={styles.tileVerifyText}>Verify</Text></VerificationPulse>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button"
            accessibilityLabel={`${label ?? documentType}, ${busy ? 'uploading' : count ? 'uploaded, tap to add more' : 'tap to upload'}`}
            accessibilityState={{ busy }} disabled={busy}
            onPress={() => void pickAndUpload()}
            style={({ pressed }) => [styles.tileInner, busy && styles.disabled, pressed && !busy && styles.pressed]}>
            <View style={styles.artworkWrap}>{artwork ? <Image source={artwork} style={styles.artwork} resizeMode="contain" /> : <Ionicons name="document-outline" size={34} color="#0A43A3" />}</View>
            <Text numberOfLines={2} style={styles.tileTitle}>{label ?? documentType}</Text>
            {count > 1 ? <Text style={styles.fileName}>{count} files uploaded</Text> : null}
            {busy ? <Text style={styles.tileStatus}>Uploading…</Text> : count > 0 ? (
              <Text accessibilityLabel="Document saved" style={[styles.tileStatus, styles.tileStatusReady]}>Saved</Text>
            ) : <Text style={styles.tileStatus}>Tap to upload</Text>}
          </Pressable>
          {latest && !busy ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${latest.name}`}
              onPress={() => setDeleteTarget({ id: latest.id, name: latest.name })} style={styles.tileRemoveBottom}>
              <Ionicons name="close-circle" size={20} color="#D64545" />
            </Pressable>
          ) : null}
        </View>
        <Modal transparent visible={verificationOpen} animationType="fade" onRequestClose={() => setVerificationOpen(false)}>
          <View style={styles.modalDim}><View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Verify {label ?? documentType}</Text>
            <Text style={styles.dialogBody}>Select uploaded files for verification review.</Text>
            {uploaded.map(file => {
              const selected = selectedForReview.includes(file.id);
              const verified = 'verification_status' in file && file.verification_status === 'verified';
              return (
                <Pressable key={file.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Select ${file.name}`} onPress={() => setSelectedForReview(current => selected ? current.filter(id => id !== file.id) : [...current, file.id])}
                  style={styles.verifyFileRow}>
                  <VerificationPulse active={selected} tint="#1769DC">
                    <Ionicons name={selected ? 'shield-checkmark' : 'shield-outline'} size={22} color={selected ? '#1769DC' : '#718198'} />
                  </VerificationPulse>
                  <Text style={styles.verifyFileName} numberOfLines={2}>{file.name}</Text>
                  {verified ? <Ionicons name="checkmark-circle-outline" size={18} color="#18965D" accessibilityLabel="Verified" /> : null}
                </Pressable>
              );
            })}
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" onPress={() => setVerificationOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => {
                if (!selectedForReview.length) { Alert.alert('Action required', 'Please select a file.'); return; }
                Alert.alert('Verification pending', 'Selected files must be verified by the Claims Desk. Their status has not been changed.');
                setVerificationOpen(false);
              }} style={styles.verifyConfirm}>
                <Text style={styles.verifyConfirmText}>Verify Selected</Text>
              </Pressable>
            </View>
          </View></View>
        </Modal>
        <Modal transparent visible={Boolean(deleteTarget)} animationType="fade" onRequestClose={() => !busy && setDeleteTarget(null)}>
          <View style={styles.modalDim}><View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Delete document?</Text>
            <Text style={styles.dialogBody}>Are you sure you want to delete {deleteTarget?.name}?</Text>
            <View style={styles.dialogActions}>
              <Pressable disabled={busy} accessibilityRole="button" onPress={() => setDeleteTarget(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable disabled={busy} accessibilityRole="button" onPress={() => void deleting()} style={styles.deleteButton}><Text style={styles.deleteText}>{busy ? 'Deleting…' : 'Delete'}</Text></Pressable>
            </View>
          </View></View>
        </Modal>
        {progressDialog}
        {successDialog}
      </>
    );
  }

  if (variant === 'bulk') {
    return (
      <>
      <View style={styles.bulkWrapper}><Pressable
        accessibilityRole="button"
        accessibilityLabel="Upload multiple documents"
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={() => void pickAndUpload()}
        style={({ pressed }) => [styles.bulk, count > 0 && styles.bulkReady, busy && styles.disabled, pressed && !busy && styles.pressed]}
      >
        {artwork ? <Image source={artwork} style={styles.bulkArtwork} resizeMode="contain" /> : <Ionicons name="documents-outline" size={30} color="#245CB0" />}
        <View style={styles.bulkCopy}>
          <Text style={styles.bulkTitle}>{label ?? 'Upload multiple documents'}</Text>
          <Text style={styles.bulkSubtitle}>{busy ? 'Uploading…' : count > 0 ? `${count} file${count === 1 ? '' : 's'} uploaded` : subtitle ?? 'Select several files now, or tap again later to add more.'}</Text>
        </View>
        
      </Pressable>
      {count > 0 && !busy ? <Pressable accessibilityRole="button" accessibilityLabel="Manage uploaded documents" onPress={() => setBulkFilesOpen(true)} style={styles.bulkRemoveIcon}><Ionicons name="close-circle" size={24} color="#D64545" /></Pressable> : null}</View>
      <Modal transparent visible={bulkFilesOpen} animationType="fade" onRequestClose={() => setBulkFilesOpen(false)}>
        <View style={styles.modalDim}><View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Uploaded documents ({count})</Text>
          <Text style={styles.dialogBody}>Select the document to remove. Each removal requires confirmation.</Text>
          {uploaded.map(file => <Pressable key={file.id} accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} onPress={() => { setBulkFilesOpen(false); setDeleteTarget({ id: file.id, name: file.name }); }} style={styles.bulkFileRow}>
            <Text numberOfLines={1} style={styles.bulkFileLabel}>{file.name}</Text><Ionicons name="close-circle" size={20} color="#D64545" />
          </Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => setBulkFilesOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Close</Text></Pressable>
        </View></View>
      </Modal>
      <Modal transparent visible={Boolean(deleteTarget)} animationType="fade" onRequestClose={() => !busy && setDeleteTarget(null)}><View style={styles.modalDim}><View style={styles.dialog}><Text style={styles.dialogTitle}>Delete document?</Text><Text style={styles.dialogBody}>Are you sure you want to delete {deleteTarget?.name}?</Text><View style={styles.dialogActions}><Pressable disabled={busy} onPress={() => setDeleteTarget(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={busy} onPress={() => void deleting()} style={styles.deleteButton}><Text style={styles.deleteText}>{busy ? 'Deleting…' : 'Delete'}</Text></Pressable></View></View></View></Modal>
      {progressDialog}
      {successDialog}
      </>
    );
  }

  if (variant === 'voice') {
    return (
      <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Record Voice Note"
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={() => void pickAndUpload()}
        style={({ pressed }) => [styles.voiceButton, busy && styles.disabled, pressed && !busy && styles.pressed]}
      >
        <Ionicons name={busy ? 'hourglass-outline' : 'mic'} size={20} color="#FFFFFF" />
        <Text style={styles.voiceText}>{busy ? 'Uploading voice note…' : count > 0 ? 'Add Voice Note' : 'Record Voice Note'}</Text>
      </Pressable>
      {progressDialog}
      {successDialog}
      </>
    );
  }

  return (
    <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Upload ${documentType}`}
      disabled={busy}
      onPress={() => void pickAndUpload()}
      style={({ pressed }) => [styles.button, compact && styles.compact, busy && styles.disabled, pressed && !busy && styles.pressed]}
    >
      <Ionicons name={busy ? 'hourglass-outline' : 'cloud-upload-outline'} size={compact ? 16 : 18} color="#FFFFFF" />
      <Text numberOfLines={1} style={styles.text}>{busy ? 'Uploading…' : count ? `Add more (${count})` : 'Upload'}</Text>
    </Pressable>
    {progressDialog}
    {successDialog}
    </>
  );
}

function safeExtension(name: string, mimeType?: string | null) {
  const match = name.toLowerCase().match(/\.([a-z0-9]{2,6})$/);
  if (match) return match[1];
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('jpeg') || mimeType?.includes('jpg')) return 'jpg';
  if (mimeType?.includes('video')) return 'mp4';
  if (mimeType?.includes('audio')) return 'm4a';
  return 'bin';
}

const styles=StyleSheet.create({
  billingShell:{minHeight:64,borderWidth:1,borderColor:'#D7E1EC',borderRadius:12,backgroundColor:'#F7FAFD',paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10},
  billingCopy:{flex:1,minWidth:0,gap:3},
  billingTitle:{fontSize:11,fontWeight:'800',color:'#183052'},
  billingSubtitle:{fontSize:9,color:'#7C8A9E'},
  billingChoose:{minHeight:38,paddingHorizontal:13,borderRadius:9,backgroundColor:'#104A9B',alignItems:'center',justifyContent:'center'},
  billingChooseText:{color:'#FFF',fontSize:10,fontWeight:'800'},
  button:{minHeight:38,borderRadius:10,backgroundColor:'#145CB8',paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  compact:{minHeight:32,paddingHorizontal:8},
  text:{color:'#FFF',fontSize:9.5,fontWeight:'900'},
  tile:{position:'relative',width:'31.5%',minWidth:0,minHeight:109,borderRadius:13,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DDE6EF',paddingVertical:6,paddingHorizontal:4,alignItems:'center',justifyContent:'center'},
  tileFullWidth:{width:'100%'},
  tileVerify:{position:'absolute',top:3,right:3,zIndex:6,paddingHorizontal:4,paddingVertical:3,borderColor:'#1769DC',borderWidth:1,borderRadius:5},
  tileVerifyText:{color:'#1769DC',fontSize:8,fontWeight:'700'},
  tileRemoveBottom:{position:'absolute',bottom:3,right:3,zIndex:5,padding:2},
  verifyFileRow:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#DCE4EE',borderRadius:10,padding:10,marginBottom:8},
  verifyFileName:{flex:1,minWidth:0,fontSize:11,color:'#243A60'},
  verifyConfirm:{borderRadius:9,backgroundColor:'#1769DC',paddingHorizontal:12,paddingVertical:11,alignItems:'center',justifyContent:'center',flex:1},
  verifyConfirmText:{color:'#FFFFFF',fontSize:11,fontWeight:'700'},
  tileReady:{backgroundColor:'#EFFAF4',borderColor:'#B5DCC7',borderWidth:1},
  tileInner:{width:'100%',minHeight:96,alignItems:'center',justifyContent:'center'},
  savedCheck:{position:'absolute',top:0,left:0},
  removeIcon:{position:'absolute',top:2,right:2,zIndex:5,padding:2},
  fileName:{color:'#53647A',fontSize:7,marginTop:2,maxWidth:'95%'},
  modalDim:{flex:1,backgroundColor:'rgba(13,29,52,0.5)',justifyContent:'center',paddingHorizontal:30},
  progressDialog:{width:'100%',maxWidth:340,borderRadius:20,backgroundColor:'#FFFFFF',padding:24,alignItems:'center',gap:12},
  progressTitle:{fontSize:16,fontWeight:'800',color:'#132A4B'},
  progressSubtitle:{fontSize:11,color:'#718095',textAlign:'center'},
  progressCount:{fontSize:13,fontWeight:'800',color:'#1768C9'},
  successDialog:{backgroundColor:'#FFFFFF',borderRadius:22,padding:22,alignItems:'center',gap:13},
  successCircle:{width:64,height:64,borderRadius:32,backgroundColor:'#EAF8F0',alignItems:'center',justifyContent:'center'},
  successTitle:{fontSize:18,fontWeight:'800',color:'#132A4B'},
  successMessage:{fontSize:12.5,lineHeight:19,textAlign:'center',color:'#718095'},
  successFileRow:{flexDirection:'row',width:'100%',alignItems:'center',gap:10,padding:12,borderRadius:12,backgroundColor:'#F0FAF4'},
  successFileCopy:{flex:1,minWidth:0,gap:3},
  successFileType:{fontSize:12,fontWeight:'700',color:'#1A3454'},
  successFileName:{fontSize:10,color:'#718095'},
  successOk:{width:'100%',minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:'#1155AD',borderRadius:12},
  successOkText:{color:'#FFFFFF',fontSize:13,fontWeight:'800'},
  dialog:{borderRadius:22,backgroundColor:'#FFFFFF',padding:22,alignItems:'center',gap:12},
  trashCircle:{width:48,height:48,borderRadius:24,backgroundColor:'#FFF0F0',alignItems:'center',justifyContent:'center'},
  dialogTitle:{fontSize:18,fontWeight:'800',color:'#17243B'},
  dialogBody:{fontSize:13,lineHeight:19,color:'#667489',textAlign:'center'},
  dialogActions:{flexDirection:'row',gap:10,width:'100%',marginTop:6},
  cancelButton:{flex:1,alignItems:'center',paddingVertical:14,borderRadius:12,borderWidth:1,borderColor:'#CCD6E1'},
  deleteButton:{flex:1,alignItems:'center',paddingVertical:14,borderRadius:12,backgroundColor:'#C73535'},
  cancelText:{color:'#1A2F4F',fontWeight:'700'},deleteText:{color:'#FFFFFF',fontWeight:'700'},
  artworkWrap:{width:39,height:39,overflow:'hidden',alignItems:'center',justifyContent:'center'},
  artwork:{width:32,height:32},
  videoIcon:{width:33,height:33,borderRadius:9,backgroundColor:'#F31E35',alignItems:'center',justifyContent:'center'},
  tileTitle:{color:'#071D49',fontSize:8.2,lineHeight:10,fontWeight:'800',textAlign:'center',marginTop:3},
  tileStatus:{color:'#718198',fontSize:7.8,fontWeight:'700',marginTop:4,textAlign:'center'},
  tileStatusReady:{color:'#16865B'},
  bulk:{minHeight:49,marginTop:8,marginRight:0,borderRadius:14,borderWidth:1.5,borderStyle:'dashed',borderColor:'#AFC8E8',backgroundColor:'#F7FAFF',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:9},
  bulkReady:{borderStyle:'solid',borderColor:'#52B57F',backgroundColor:'#EFFAF4'},
  bulkWrapper:{position:'relative'},
  bulkRemoveIcon:{position:'absolute',right:13,top:24,zIndex:2},
  bulkFileRow:{width:'100%',flexDirection:'row',alignItems:'center',paddingVertical:9,gap:8},
  bulkFileLabel:{flex:1,fontSize:12,color:'#173354'},
  bulkArtwork:{width:29,height:29},
  bulkCopy:{flex:1,minWidth:0},
  bulkTitle:{color:'#071D49',fontSize:10.5,fontWeight:'900'},
  bulkSubtitle:{color:'#718198',fontSize:8.5,lineHeight:12,fontWeight:'600',marginTop:2},
  voiceButton:{minHeight:54,borderRadius:13,backgroundColor:'#145BC3',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  voiceText:{color:'#FFF',fontSize:12,fontWeight:'900'},
  disabled:{opacity:.55},
  pressed:{opacity:.82},
});
