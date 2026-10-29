import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
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

type VerificationField = { key: string; label: string; required?: boolean; placeholder?: string };
function documentVerificationFields(category: string): VerificationField[] {
  const name = category.toLowerCase();
  if (/\brc\b|registration certificate/.test(name)) return [
    { key: 'registration_number', label: 'Registration number', required: true },
    { key: 'registration_valid_upto', label: 'Registration valid up to (DD/MM/YYYY)', required: true },
    { key: 'registered_owner', label: 'Registered owner', required: true },
  ];
  if (/insurance|policy copy/.test(name)) return [
    { key: 'policy_number', label: 'Policy number', required: true },
    { key: 'policy_start', label: 'Policy start date (DD/MM/YYYY)', required: true },
    { key: 'policy_end', label: 'Policy end date (DD/MM/YYYY)', required: true },
    { key: 'ncb_percent', label: 'NCB percentage' },
  ];
  if (/driving licen[cs]e|\bdl\b/.test(name)) return [
    { key: 'licence_number', label: 'Licence number', required: true },
    { key: 'licence_valid_upto', label: 'Licence valid up to (DD/MM/YYYY)', required: true },
    { key: 'vehicle_class', label: 'Authorized vehicle class', required: true },
  ];
  if (/\bgr\b|load bill/.test(name)) return [
    { key: 'consignment_number', label: 'GR / Load bill number', required: true },
    { key: 'transport_name', label: 'Transporter name', required: true },
    { key: 'consignment_date', label: 'Consignment date (DD/MM/YYYY)' },
  ];
  if (/spot photo|spot image|accident photo/.test(name)) return [
    { key: 'photo_details', label: 'Accident / photo details', required: true },
    { key: 'incident_date', label: 'Incident date (DD/MM/YYYY)' },
  ];
  return [
    { key: 'document_reference', label: 'Document reference / number' },
    { key: 'document_date', label: 'Document date (DD/MM/YYYY)' },
    { key: 'review_details', label: 'Document review details', required: true },
  ];
}

function VerificationReviewForm({ category, filenames, onBack }: { category: string; filenames: string[]; onBack: () => void }) {
  const fields = documentVerificationFields(category);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<'valid' | 'invalid'>('valid');
  const [remarks, setRemarks] = useState('');
  return (
    <>
      <Text style={styles.dialogTitle}>{category} Verification</Text>
      <Text style={styles.dialogBody}>Review the selected document details. Only an authorized Claims Desk user can finalize verification.</Text>
      <ScrollView style={styles.reviewScroll} keyboardShouldPersistTaps="handled">
        {filenames.map(name => <View key={name} style={styles.verifyFileRow}><Ionicons name="shield-checkmark-outline" size={19} color="#1769DC" /><Text style={styles.verifyFileName}>{name}</Text></View>)}
        {fields.map(field => (
          <View key={field.key} style={styles.reviewField}>
            <Text style={styles.reviewFieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
            <TextInput style={styles.reviewInput} placeholder={field.placeholder ?? field.label} value={answers[field.key] ?? ''}
              onChangeText={value => setAnswers(current => ({ ...current, [field.key]: value }))} autoCapitalize="sentences" />
          </View>
        ))}
        <Text style={styles.reviewFieldLabel}>Review result</Text>
        <View style={styles.reviewChoices}>
          {(['valid', 'invalid'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: result === value }}
            onPress={() => setResult(value)} style={[styles.reviewChoice, result === value && styles.reviewChoiceSelected]}>
            <Text style={styles.reviewFieldLabel}>{value === 'valid' ? 'Valid' : 'Invalid'}</Text>
          </Pressable>)}
        </View>
        <Text style={styles.reviewFieldLabel}>Remarks{result === 'invalid' ? ' *' : ''}</Text>
        <TextInput style={[styles.reviewInput, styles.reviewRemarks]} multiline value={remarks} onChangeText={setRemarks} placeholder="Enter review remarks" />
      </ScrollView>
      <View style={styles.dialogActions}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.cancelButton}><Text style={styles.cancelText}>Back</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.verifyConfirm} onPress={() => {
          if (fields.some(field => field.required && !answers[field.key]?.trim()) || (result === 'invalid' && !remarks.trim())) {
            Alert.alert('Action required', 'Please complete all required verification fields.'); return;
          }
          Alert.alert('Claims Desk approval required', 'This Partner App form is for review only. No verification details or status have been saved. The Claims Desk must complete verification through the Operations Portal.');
        }}><Text style={styles.verifyConfirmText}>Submit Review</Text></Pressable>
      </View>
    </>
  );
}

type Props = {
  claimId: string;
  customerId: string;
  documentType: string;
  milestoneKey?: string;
  documents?: PartnerClaimDetail['documents'];
  compact?: boolean;
  tileFullWidth?: boolean;
  variant?: 'button' | 'tile' | 'bulk' | 'voice' | 'billing' | 'assessment';
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
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [selectedForReview, setSelectedForReview] = useState<string[]>([]);
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
      type: (variant === 'billing' || variant === 'assessment') ? ['application/pdf', 'image/jpeg', 'image/png'] : ['application/pdf', 'image/*', 'video/*', 'audio/*'],
    });
    if (picked.canceled) return;
    if ((variant === 'billing' || variant === 'assessment') && picked.assets.some(asset => !/\.(pdf|jpe?g|png)$/i.test(asset.name ?? ''))) {
      Alert.alert('Unsupported file', 'Choose a PDF, JPG, or PNG document.');
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

  if (variant === 'billing' || variant === 'assessment') {
    return (
      <>
        <View style={styles.billingShell}>
          <Ionicons name={variant === "assessment" ? "clipboard-outline" : "document-text-outline"} size={28} color="#1857A9" />
          <View style={styles.billingCopy}>
            <Text style={styles.billingTitle} numberOfLines={1}>{busy ? 'Uploading document…' : variant === 'assessment' ? 'Assessment Report (Optional)' : 'Upload final workshop bill'}</Text>
            <Text style={styles.billingSubtitle} numberOfLines={1}>{count ? `${count} uploaded • ${latest?.name ?? 'Saved'}` : 'PDF, JPG, PNG'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={variant === "assessment" ? "Upload assessment report" : "Choose final workshop bill"} accessibilityState={{ busy }} disabled={busy} onPress={() => void pickAndUpload()} style={({ pressed }) => [styles.billingChoose, busy && styles.disabled, pressed && !busy && styles.pressed]}>
            <Text style={styles.billingChooseText}>{busy ? 'Uploading…' : variant === 'assessment' ? 'Upload' : 'Choose File'}</Text>
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
          <View style={styles.tileHeading}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Add more ${label ?? documentType} documents`} disabled={busy} onPress={() => void pickAndUpload()} style={styles.tileHeadingIdentity}>
              {artwork ? <Image source={artwork} style={styles.tileHeadingArtwork} resizeMode="contain" /> : <Ionicons name="document-outline" size={23} color="#0A43A3" />}
              <Text style={styles.tileHeadingName} numberOfLines={2}>{label ?? documentType}</Text>
            </Pressable>
            {latest && !busy ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${latest.name}`}
                onPress={() => setDeleteTarget({ id: latest.id, name: latest.name })} style={styles.tileHeadingDelete}>
                <Ionicons name="close-circle" size={20} color="#D64545" />
              </Pressable>
            ) : null}
          </View>
          {count ? (
            <View style={styles.tileCounts}>
              <View style={styles.tileCountItem}>
                <VerificationPulse active tint="#E68B17"><Ionicons name="time-outline" size={19} color="#E68B17" accessibilityLabel="Pending verification" /></VerificationPulse>
                <Text style={styles.tileCountText}>{uploaded.filter(file => !('verification_status' in file && file.verification_status === 'verified')).length}</Text>
              </View>
              <View style={styles.tileCountItem}>
                <Ionicons name="checkmark-circle-outline" size={19} color="#18965D" accessibilityLabel="Verified" />
                <Text style={styles.tileCountText}>{uploaded.filter(file => 'verification_status' in file && file.verification_status === 'verified').length}</Text>
              </View>
            </View>
          ) : <Pressable accessibilityRole="button" disabled={busy} onPress={() => void pickAndUpload()} style={styles.tileEmpty}>
            <Text style={styles.tileStatus}>{busy ? 'Uploading…' : 'Tap to upload'}</Text>
          </Pressable>}
          {count > 0 && !busy ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Verify ${label ?? documentType} documents`}
              style={styles.tileVerifyBottom} onPress={() => { setSelectedForReview([]); setVerificationFormOpen(false); setVerificationOpen(true); }}>
              <VerificationPulse active tint="#1769DC"><Text style={styles.tileVerifyText}>Verify</Text></VerificationPulse>
            </Pressable>
          ) : null}
        </View>
        <Modal transparent visible={verificationOpen} animationType="fade" onRequestClose={() => setVerificationOpen(false)}>
          <View style={styles.modalDim}><View style={styles.dialog}>
            {verificationFormOpen ? <VerificationReviewForm category={documentType} filenames={uploaded.filter(file => selectedForReview.includes(file.id)).map(file => file.name)} onBack={() => setVerificationFormOpen(false)} /> : <>
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
                setVerificationFormOpen(true);
              }} style={styles.verifyConfirm}>
                <Text style={styles.verifyConfirmText}>Verify Selected</Text>
              </Pressable>
            </View>
            </>}
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
  tileHeading:{width:'100%',flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:3,minHeight:43},
  tileHeadingIdentity:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:3},
  tileHeadingArtwork:{width:23,height:26},
  tileHeadingName:{flex:1,minWidth:0,fontSize:9,fontWeight:'800',color:'#0B2248'},
  tileHeadingDelete:{padding:1},
  tileCounts:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:12,width:'100%',minHeight:31},
  tileCountItem:{flexDirection:'row',alignItems:'center',gap:3},
  tileCountText:{fontSize:12,fontWeight:'800',color:'#173354'},
  tileEmpty:{flex:1,alignItems:'center',justifyContent:'center'},
  tileVerifyBottom:{borderWidth:1,borderColor:'#1769DC',borderRadius:6,minHeight:25,alignItems:'center',justifyContent:'center',width:'100%',marginTop:3},
  tileVerify:{position:'absolute',top:3,right:3,zIndex:6,paddingHorizontal:4,paddingVertical:3,borderColor:'#1769DC',borderWidth:1,borderRadius:5},
  tileVerifyText:{color:'#1769DC',fontSize:8,fontWeight:'700'},
  tileRemoveBottom:{position:'absolute',bottom:3,right:3,zIndex:5,padding:2},
  verifyFileRow:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#DCE4EE',borderRadius:10,padding:10,marginBottom:8},
  verifyFileName:{flex:1,minWidth:0,fontSize:11,color:'#243A60'},
  reviewScroll:{maxHeight:370,width:'100%'},
  reviewField:{marginBottom:10,gap:4},
  reviewFieldLabel:{fontSize:11,fontWeight:'700',color:'#264267'},
  reviewInput:{borderWidth:1,borderColor:'#CCD9E7',borderRadius:9,minHeight:40,paddingHorizontal:10,color:'#152B4B',fontSize:12},
  reviewRemarks:{minHeight:70,textAlignVertical:'top',paddingVertical:10},
  reviewChoices:{flexDirection:'row',gap:10,marginVertical:9},
  reviewChoice:{flex:1,borderWidth:1,borderColor:'#CCD9E7',padding:9,borderRadius:9,alignItems:'center'},
  reviewChoiceSelected:{borderColor:'#1769DC'},
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
