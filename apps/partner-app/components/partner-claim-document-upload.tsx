import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
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
  variant?: 'button' | 'tile' | 'bulk' | 'voice';
  artwork?: ImageSourcePropType;
  label?: string;
  subtitle?: string;
};

export function PartnerClaimDocumentUpload({ claimId, customerId, documentType, milestoneKey, documents, compact = false, variant = 'button', artwork, label, subtitle }: Props) {
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

  if (variant === 'tile') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label ?? documentType}, ${busy ? 'uploading' : count ? 'uploaded, tap to add more' : 'tap to upload'}`}
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={() => void pickAndUpload()}
        style={({ pressed }) => [styles.tile, count > 0 && styles.tileReady, busy && styles.disabled, pressed && !busy && styles.pressed]}
      >
        <View style={styles.artworkWrap}>{artwork ? <Image source={artwork} style={styles.artwork} resizeMode="contain" /> : documentType === "Accident Video" ? <View style={styles.videoIcon}><Ionicons name="videocam" size={27} color="#FFFFFF" /></View> : <Ionicons name="document-outline" size={34} color="#0A43A3" />}</View>
        <Text numberOfLines={2} style={styles.tileTitle}>{label ?? documentType}</Text>
        <Text numberOfLines={1} style={[styles.tileStatus, count > 0 && styles.tileStatusReady]}>{busy ? 'Uploading…' : count > 0 ? 'Uploaded' : 'Tap to upload'}</Text>
      </Pressable>
    );
  }

  if (variant === 'bulk') {
    return (
      <Pressable
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
        <Ionicons name={busy ? 'hourglass-outline' : count > 0 ? 'checkmark-circle-outline' : 'add-circle-outline'} size={25} color={count > 0 ? '#168161' : '#0A43A3'} />
      </Pressable>
    );
  }

  if (variant === 'voice') {
    return (
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
    );
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
  tile:{position:'relative',width:'31.5%',minWidth:0,minHeight:106,borderRadius:14,backgroundColor:'#F7FAFF',borderWidth:1.5,borderColor:'#E2EAF4',paddingVertical:8,paddingHorizontal:5,alignItems:'center',justifyContent:'center'},
  tileReady:{backgroundColor:'#F2F7FF',borderColor:'#6D9EE8'},
  artworkWrap:{width:49,height:49,overflow:'hidden',alignItems:'center',justifyContent:'center'},
  artwork:{width:39,height:39},
  videoIcon:{width:43,height:43,borderRadius:10,backgroundColor:'#F31E35',alignItems:'center',justifyContent:'center'},
  tileTitle:{color:'#071D49',fontSize:8.5,lineHeight:11,fontWeight:'800',textAlign:'center',marginTop:3},
  tileStatus:{color:'#7A8799',fontSize:7.5,fontWeight:'800',marginTop:3},
  tileStatusReady:{color:'#326FC6'},
  bulk:{minHeight:58,marginTop:10,borderRadius:14,borderWidth:1.5,borderStyle:'dashed',borderColor:'#AFC8E8',backgroundColor:'#F7FAFF',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:9},
  bulkReady:{borderStyle:'solid',borderColor:'#52B57F',backgroundColor:'#EFFAF4'},
  bulkArtwork:{width:34,height:34},
  bulkCopy:{flex:1,minWidth:0},
  bulkTitle:{color:'#071D49',fontSize:10.5,fontWeight:'900'},
  bulkSubtitle:{color:'#718198',fontSize:8.5,lineHeight:12,fontWeight:'600',marginTop:2},
  voiceButton:{minHeight:54,borderRadius:13,backgroundColor:'#145BC3',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  voiceText:{color:'#FFF',fontSize:12,fontWeight:'900'},
  disabled:{opacity:.55},
  pressed:{opacity:.82},
});
