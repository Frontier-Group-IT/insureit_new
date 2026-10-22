import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { attachPartnerClaimDocument, type PartnerClaimDetail } from '@/lib/claims';
import { supabase } from '@/lib/supabase';

type Props = {
  claimId: string;
  customerId: string;
  documentType: string;
  milestoneKey?: string;
  documents?: PartnerClaimDetail['documents'];
  compact?: boolean;
};

export function PartnerClaimDocumentUpload({ claimId, customerId, documentType, milestoneKey, documents, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const count = (documents ?? []).filter((item) => item.category === documentType).length;

  async function pickAndUpload() {
    if (busy) return;
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: documentType === 'Accident Photo' || documentType === 'Accident Video' || documentType === 'Spot Intimation Attachment',
      type: ['application/pdf', 'image/*', 'video/*', 'audio/*'],
    });
    if (picked.canceled) return;
    setBusy(true);
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
          await attachPartnerClaimDocument({
            claimId,
            documentType,
            fileName: asset.name || documentType,
            storagePath,
            mimeType: asset.mimeType,
            fileSize: asset.size ?? body.byteLength,
            milestoneKey: milestoneKey ?? null,
          });
        } catch (error) {
          await supabase.storage.from('claim-documents').remove([storagePath]);
          throw error;
        }
      }
      Alert.alert('Uploaded', `${documentType} uploaded successfully.`);
    } catch (error) {
      Alert.alert('Unable to upload', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
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
  button:{minHeight:38,borderRadius:10,backgroundColor:'#145CB8',paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  compact:{minHeight:32,paddingHorizontal:8},
  text:{color:'#FFF',fontSize:9.5,fontWeight:'900'},
  disabled:{opacity:.55},
  pressed:{opacity:.82},
});
