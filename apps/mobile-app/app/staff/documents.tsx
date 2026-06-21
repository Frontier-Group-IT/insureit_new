import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { Button, Card, EmptyState, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { documentDrivenStatusFor, documentStatusLabel, replacementStatusFor } from '@/lib/claim-documents';
import { recordClaimEvent } from '@/lib/claim-notifications';
import { canVerifyDocument } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { Claim, ClaimDocument } from '@/lib/types';

export default function DocumentsScreen() {
  const router = useRouter();
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [rejectingId, setRejectingId] = useState('');
  const [reviewingId, setReviewingId] = useState('');
  const [expandedClaimId, setExpandedClaimId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const session = await getCurrentSession();
    if (!session?.user) {
      setLoading(false);
      return router.replace('/login');
    }
    const profile = await getProfile(session.user.id);
    if (!isValidProfile(profile) || !canVerifyDocument(profile.role)) {
      setMessage('Document verification is restricted to the claims manager and claim processor.');
      setLoading(false);
      return;
    }
    const documentsResult = await supabase.from('claim_documents').select('*').order('created_at', { ascending: false }).limit(80);
    const nextDocuments = documentsResult.data ?? [];
    const claimIds = Array.from(new Set(nextDocuments.map((document) => document.claim_id)));
    const claimsResult = claimIds.length
      ? await supabase.from('claims').select('*').in('id', claimIds).order('created_at', { ascending: false })
      : { data: [] };
    setDocuments(nextDocuments);
    setClaims(claimsResult.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const groupedClaims = useMemo(() => claims.map((claim) => ({
    claim,
    documents: documents.filter((document) => document.claim_id === claim.id),
  })).filter((group) => group.documents.length), [claims, documents]);

  async function review(document: ClaimDocument, verification_status: 'verified' | 'rejected') {
    setMessage('');
    if (verification_status === 'rejected' && rejectingId !== document.id) {
      setRejectingId(document.id);
      setReason('');
      return;
    }
    setReviewingId(document.id);
    try {
      const session = await getCurrentSession();
      const { error } = await supabase.from('claim_documents').update({
        verification_status,
        verified_by: session?.user.id ?? null,
        verified_at: new Date().toISOString(),
        rejection_reason: verification_status === 'rejected' ? reason.trim() || 'Replacement requested by claim desk' : null,
      }).eq('id', document.id);
      if (error) {
        setMessage('Document review could not be saved.');
        return;
      }
      if (verification_status === 'verified' && session?.user.id) await advanceAfterVerification(document, session.user.id);
      if (verification_status === 'rejected' && session?.user.id) await requestReplacement(document, session.user.id);
      setRejectingId('');
      setReason('');
      await load();
    } finally {
      setReviewingId('');
    }
  }

  async function openDocument(document: ClaimDocument) {
    setMessage('');
    const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
    if (error || !data?.signedUrl) {
      setMessage('Document could not be opened.');
      return;
    }
    await Linking.openURL(data.signedUrl);
  }

  if (loading) return <Screen title="Document Review"><LoadingState /></Screen>;

  return (
    <Screen title="Document Review" subtitle={`${documents.length} files`}>
      {message ? <Message type="error">{message}</Message> : null}
      {groupedClaims.length === 0 ? <EmptyState title="No documents found" body="Uploaded claim files will appear here." /> : groupedClaims.map(({ claim, documents: claimDocuments }) => (
        <Card key={claim.id}>
          <Pressable accessibilityRole="button" onPress={() => setExpandedClaimId((current) => current === claim.id ? '' : claim.id)} style={styles.claimToggle}>
            <View style={styles.claimTitleWrap}>
              <Text style={styles.claimNo}>{claim.claim_no}</Text>
              <AppBadge label={claim.current_status} tone="info" />
            </View>
            <View style={styles.claimCountPill}>
              <Text style={styles.claimCount}>{claimDocuments.length}</Text>
              <MaterialCommunityIcons name={expandedClaimId === claim.id ? 'chevron-up' : 'chevron-down'} size={20} color={palette.ink} />
            </View>
          </Pressable>
          {expandedClaimId === claim.id ? claimDocuments.map((document) => (
            <View key={document.id} style={styles.documentBlock}>
              <Pressable accessibilityRole="button" onPress={() => void openDocument(document)} style={styles.documentRow}>
                <View style={styles.documentIcon}>
                  <MaterialCommunityIcons name="file-document-outline" size={18} color={palette.blue} />
                </View>
                <View style={styles.documentCopy}>
                  <Text style={styles.documentType}>{document.document_type}</Text>
                  <Text style={styles.documentName} numberOfLines={1}>{document.file_name}</Text>
                </View>
                <AppBadge label={documentStatusLabel(document.verification_status)} tone={document.verification_status === 'verified' ? 'success' : document.verification_status === 'rejected' ? 'danger' : 'warning'} />
              </Pressable>
              <View style={styles.actions}>
                <CompactButton label="Open" onPress={() => void openDocument(document)} />
                {document.verification_status === 'pending' ? (
                  <>
                    <CompactButton label={reviewingId === document.id ? 'Verifying...' : 'Verify'} loading={reviewingId === document.id} disabled={reviewingId === document.id} onPress={() => void review(document, 'verified')} />
                    <CompactButton label={reviewingId === document.id ? 'Requesting...' : 'Request replacement'} danger loading={reviewingId === document.id} disabled={reviewingId === document.id} onPress={() => void review(document, 'rejected')} />
                  </>
                ) : null}
              </View>
              {rejectingId === document.id ? (
                <View style={styles.rejectBox}>
                  <TextField label="Replacement reason" value={reason} onChangeText={setReason} />
                  <Button label={reviewingId === document.id ? 'Requesting replacement...' : 'Request replacement'} variant="danger" onPress={() => void review(document, 'rejected')} disabled={reviewingId === document.id} />
                </View>
              ) : null}
            </View>
          )) : null}
        </Card>
      ))}
    </Screen>
  );
}

function CompactButton({ label, onPress, danger = false, disabled = false, loading = false }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.compactButton, danger && styles.compactDanger, disabled && styles.compactButtonDisabled]}>
      {loading ? <ActivityIndicator size="small" color={danger ? '#B42318' : palette.ink} /> : <Text style={[styles.compactText, danger && styles.compactDangerText]}>{label}</Text>}
    </Pressable>
  );
}

async function advanceAfterVerification(document: ClaimDocument, changedBy: string) {
  const { data: claim } = await supabase.from('claims').select('*').eq('id', document.claim_id).maybeSingle();
  if (!claim) return;
  const [documentsResult, tasksResult] = await Promise.all([
    supabase.from('claim_documents').select('*').eq('claim_id', document.claim_id),
    supabase.from('claim_tasks').select('*').eq('claim_id', document.claim_id).eq('status', 'open').like('title', 'Final document: %'),
  ]);
  const nextDocuments = (documentsResult.data ?? []).map((item) => item.id === document.id ? { ...item, verification_status: 'verified' as const } : item);
  const requestedFinalDocumentTypes = (tasksResult.data ?? []).map((task) => task.title.slice('Final document: '.length));
  const nextStatus = documentDrivenStatusFor(claim, nextDocuments, requestedFinalDocumentTypes);
  if (!nextStatus || nextStatus === claim.current_status) return;

  const { error } = await supabase.from('claims').update({ current_status: nextStatus }).eq('id', claim.id);
  if (error) return;
  await recordClaimEvent({
    claimId: claim.id,
    customerId: claim.customer_id,
    fromStatus: claim.current_status,
    toStatus: nextStatus,
    notes: 'All required documents verified by claim desk.',
    changedBy,
    title: `Documents verified for ${claim.claim_no}`,
  });
}

async function requestReplacement(document: ClaimDocument, changedBy: string) {
  const { data: claim } = await supabase.from('claims').select('*').eq('id', document.claim_id).maybeSingle();
  if (!claim) return;
  const nextStatus = replacementStatusFor(claim);
  if (nextStatus === claim.current_status) return;

  const { error } = await supabase.from('claims').update({ current_status: nextStatus }).eq('id', claim.id);
  if (error) return;
  await recordClaimEvent({
    claimId: claim.id,
    customerId: claim.customer_id,
    fromStatus: claim.current_status,
    toStatus: nextStatus,
    notes: `Replacement requested for ${document.document_type}.`,
    changedBy,
    title: `Replacement requested for ${claim.claim_no}`,
  });
}

const styles = StyleSheet.create({
  claimToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  claimTitleWrap: { flex: 1, minWidth: 0, gap: 7 },
  claimNo: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  claimCountPill: { minWidth: 54, minHeight: 36, borderRadius: radii.sm, backgroundColor: palette.surfaceAlt, borderWidth: 1, borderColor: palette.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8 },
  claimCount: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  documentBlock: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 9, marginTop: 8 },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  documentIcon: { width: 34, height: 34, borderRadius: radii.sm, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  documentCopy: { flex: 1, minWidth: 0 },
  documentType: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  documentName: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 2 },
  compactButton: { flex: 1, minHeight: 34, borderRadius: radii.sm, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  compactDanger: { borderColor: '#FECACA', backgroundColor: '#FEEFEF' },
  compactText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  compactDangerText: { color: '#B42318' },
  compactButtonDisabled: { opacity: 0.7 },
  rejectBox: { marginTop: 6 },
});
