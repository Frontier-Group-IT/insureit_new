import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { partnerAlert } from '@/components/ui/partner-alert-provider';
import { listPartnerPolicyDocuments, openPartnerPolicyDocument, type PartnerPolicyDocument } from '@/lib/policy-documents';

const LABELS: Record<string, string> = {
  policy_copy: 'Policy Copy / Policy Bond',
  proposal_form: 'Proposal Form',
  benefit_illustration: 'Benefit Illustration',
  premium_receipt: 'Premium Receipt',
  endorsement: 'Endorsement',
  endorsements: 'Endorsements',
  certificate: 'Certificate',
  health_card: 'Health Card',
  policy_schedule: 'Policy Schedule',
  kyc: 'KYC Document',
  other_document: 'Other Document',
};
export function PartnerPolicyDocuments({ policyId }: { policyId: string }) {
  const [files, setFiles] = useState<PartnerPolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setFiles(await listPartnerPolicyDocuments(policyId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Documents could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [policyId]);
  useEffect(() => { void reload(); }, [reload]);
  const open = async (file: PartnerPolicyDocument, download = false) => {
    if (busy) return;
    setBusy(file.source + ':' + file.id + (download ? ':download' : ':view'));
    try {
      const url = await openPartnerPolicyDocument(policyId, file, download);
      await Linking.openURL(url);
    } catch (cause) {
      partnerAlert(download ? 'Unable to download' : 'Unable to view document',
        cause instanceof Error ? cause.message : 'Please retry.');
    } finally { setBusy(''); }
  };
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headingLeft}>
          <View style={styles.headerIcon}><Ionicons name="folder-open-outline" color="#1769BB" size={20}/></View>
          <View style={styles.headingText}>
            <Text style={styles.title}>Documents</Text>
            <Text style={styles.subtitle}>Policy attachments</Text>
          </View>
        </View>
        {!loading && !error ? <Text style={styles.count}>{files.length} file{files.length === 1 ? '' : 's'}</Text> : null}
      </View>
      {loading ? <View style={styles.statusRow}><ActivityIndicator size="small" color="#1769BB"/><Text style={styles.hint}>Loading policy documents…</Text></View>
      : error ? <View style={styles.statusRow}><Text style={styles.hint}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry loading documents" onPress={() => void reload()} style={styles.retry}><Text style={styles.actionText}>Retry</Text></Pressable></View>
      : files.length === 0 ? <View style={styles.statusRow}><Ionicons name="document-outline" size={18} color="#7E8FA6"/><Text style={styles.hint}>No documents available for this policy.</Text></View>
      : <View style={styles.items}>
        {files.map(file => {
          const key = file.source + ':' + file.id;
          const pending = busy.startsWith(key);
          const label = LABELS[file.type] || file.type.replaceAll('_',' ').replace(/\b\w/g, letter => letter.toUpperCase());
          return <View key={key} style={styles.file}>
            <View style={styles.fileTop}>
              <View style={styles.fileIcon}><Ionicons name={file.mimeType?.includes('pdf') ? 'document-text-outline' : 'image-outline'} color="#1769BB" size={21}/></View>
              <View style={styles.fileText}>
                <Text style={styles.fileType} numberOfLines={1}>{label}</Text>
                <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
              </View>
              {pending ? <ActivityIndicator size="small" color="#1769BB"/> : null}
            </View>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={'View ' + label} disabled={Boolean(busy)} style={({pressed}) => [styles.action, pressed && styles.pressed]} onPress={() => void open(file)}>
                <Ionicons name="eye-outline" color="#1769BB" size={16}/><Text style={styles.actionText}>View</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={'Download ' + label} disabled={Boolean(busy)} style={({pressed}) => [styles.action, pressed && styles.pressed]} onPress={() => void open(file, true)}>
                <Ionicons name="download-outline" color="#1769BB" size={16}/><Text style={styles.actionText}>Download</Text>
              </Pressable>
            </View>
          </View>;
        })}
      </View>}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D2E5FA', backgroundColor: '#E9F2FC', overflow: 'hidden', padding: 10, gap: 9 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headingText: { flex: 1, minWidth: 0 },
  headerIcon: { width: 32, height: 32, backgroundColor: '#FFFFFF', borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#102A51', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  subtitle: { color: '#64738A', fontSize: 9, marginTop: 2 },
  count: { color: '#53677F', fontSize: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 18, overflow: 'hidden' },
  statusRow: { minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C3D1E0', paddingVertical: 8, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  hint: { color: '#64738A', fontSize: 11, flexShrink: 1 },
  retry: { padding: 6 },
  items: { gap: 0 },
  file: { paddingVertical: 8, paddingHorizontal: 2, gap: 6, borderTopColor: '#C3D1E0', borderTopWidth: StyleSheet.hairlineWidth },
  fileTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  fileIcon: { width: 35, height: 35, borderRadius: 9, backgroundColor: '#EDF4FD', alignItems: 'center', justifyContent: 'center' },
  fileText: { flex: 1, minWidth: 0 },
  fileType: { color: '#192B46', fontSize: 11, fontWeight: '700' },
  fileName: { color: '#64738A', fontSize: 10, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 7 },
  action: { flex: 1, minHeight: 34, borderRadius: 8, backgroundColor: '#EDF4FD', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  actionText: { color: '#1769BB', fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.74 },
});
