import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { requiredDocumentsForStatus } from '@/lib/claim-documents';
import { customerStageCopy } from '@/lib/claim-workflow';
import { supabase } from '@/lib/supabase';
import { palette, roleTheme } from '@/lib/theme';
import type { Claim, ClaimDocument, ClaimHistory, ClaimStatus, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

export default function ClaimDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [claim, setClaim] = useState<Claim | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [insurer, setInsurer] = useState<InsuranceCompany | null>(null);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [documentsExpanded, setDocumentsExpanded] = useState(false);
  const [journeyExpanded, setJourneyExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;

      const [claimResult, historyResult, documentsResult] = await Promise.all([
        supabase.from('claims').select('*').eq('id', id).maybeSingle(),
        supabase.from('claim_status_history').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        supabase.from('claim_documents').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
      ]);

      const nextClaim = claimResult.data;
      setClaim(nextClaim);
      setHistory(historyResult.data ?? []);
      const nextDocuments = documentsResult.data ?? [];
      setDocuments(nextDocuments);

      const previewEntries = await Promise.all(
        nextDocuments.filter(isImageDocument).map(async (document) => {
          const { data } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
          return data?.signedUrl ? [document.id, data.signedUrl] as const : null;
        }),
      );
      setImagePreviews(Object.fromEntries(previewEntries.filter((entry): entry is readonly [string, string] => entry !== null)));

      if (nextClaim?.vehicle_id) {
        const { data } = await supabase.from('vehicles').select('*').eq('id', nextClaim.vehicle_id).maybeSingle();
        setVehicle(data);
      }

      if (nextClaim?.policy_id) {
        const { data } = await supabase.from('policies').select('*').eq('id', nextClaim.policy_id).maybeSingle();
        setPolicy(data);

        const insurerId = nextClaim.insurance_company_id || data?.insurance_company_id;
        if (insurerId) {
          const insurerResult = await supabase.from('insurance_companies').select('*').eq('id', insurerId).maybeSingle();
          setInsurer(insurerResult.data);
        }
      }

      setLoading(false);
    }

    void load();
  }, [id]);

  async function openDocument(document: ClaimDocument) {
    setMessage('');
    const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);

    if (error || !data?.signedUrl) {
      setMessage('We could not open this document. Please try again.');
      return;
    }

    await Linking.openURL(data.signedUrl);
  }

  const currentJourneyIndex = useMemo(() => currentJourneyIndexFor(claim?.current_status), [claim?.current_status]);

  if (loading) return <Screen title="Claim Detail"><LoadingState /></Screen>;
  if (!claim) return <Screen title="Claim Detail"><EmptyState title="Claim not found" body="Please go back and choose a claim from your list." /></Screen>;

  const nextAction = nextActionForStatus(claim.current_status);
  const verifiedCount = documents.filter((document) => document.verification_status === 'verified').length;
  const canUploadDocuments = shouldShowUploadDocuments(claim, documents);
  const tone = claimTone(claim.current_status);
  const progress = journeyProgress(claim.current_status);
  const policyExpiredBeforeIncident = isIncidentAfterPolicyExpiry(claim, policy);

  return (
    <Screen title="Claim Detail" showLogout showTitleHeader={false}>
      <View style={styles.claimDetailContent}>
        <View style={styles.pageHeading}>
          <Text style={styles.pageEyebrow}>Claims</Text>
          <Text style={styles.pageTitle}>Claim Detail</Text>
        </View>

        {message ? <Message type="error">{message}</Message> : null}

        <View style={[styles.heroCard, { backgroundColor: tone.background, borderColor: tone.border }]}>
        <View style={[styles.accentBar, { backgroundColor: tone.accent }]} />

        <View style={styles.heroTop}>
          <View style={[styles.statusIcon, { backgroundColor: tone.soft }]}>
            <MaterialCommunityIcons name={statusIcon(claim.current_status)} size={25} color={tone.accent} />
          </View>

          <View style={styles.heroCopy}>
            <Text style={[styles.stageLabel, { color: tone.accent }]}>{claimStageLabel(claim.current_status)}</Text>
            <Text style={styles.vehicleNo} numberOfLines={1}>{vehicle?.vehicle_no ?? 'Vehicle linked'}</Text>
          </View>

          <View style={[styles.focusStatusBadge, { backgroundColor: tone.soft, borderColor: tone.border }]}>
            <Text style={[styles.focusStatusText, { color: tone.accent }]} numberOfLines={2}>{statusBadgeLabel(claim.current_status)}</Text>
          </View>
        </View>

        <View style={styles.numberRow}>
          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>Control No.</Text>
            <Text style={styles.numberValue}>{claim.claim_no}</Text>
          </View>
          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>Claim No.</Text>
            <Text style={styles.numberValue}>{claim.insurer_claim_no || 'Awaiting insurer'}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <InfoPair leftLabel="Manufacturer" leftValue={vehicle?.make ?? '-'} rightLabel="Model" rightValue={vehicle?.model ?? '-'} />
          <InfoPair leftLabel="Policy" leftValue={policy?.policy_no ?? '-'} rightLabel="Insurer" rightValue={insurer?.name ?? '-'} />
          <InfoPair leftLabel="Last Update" leftValue={formatDateOnly(claim.updated_at ?? claim.created_at)} rightLabel="Incident Date" rightValue={claim.accident_at ? formatDateOnly(claim.accident_at) : '-'} />
        </View>

        {policyExpiredBeforeIncident ? (
          <View style={styles.expiredClaimWarning}>
            <MaterialCommunityIcons name="alert-octagon-outline" size={17} color="#B42318" />
            <View style={styles.expiredClaimWarningCopy}>
              <Text style={styles.expiredClaimWarningTitle}>Policy expired before loss date</Text>
              <Text style={styles.expiredClaimWarningText}>Expiry {formatDateOnly(policy?.end_date)} • Loss {formatDateOnly(claim.accident_at)}</Text>
            </View>
          </View>
        ) : null}
        </View>

        <View style={[styles.nextActionCard, { borderColor: tone.border }]}>
          <View style={[styles.nextActionIcon, { backgroundColor: tone.soft }]}>
            <MaterialCommunityIcons name="arrow-right-circle-outline" size={22} color={tone.accent} />
          </View>
          <View style={styles.nextActionCopy}>
          <Text style={[styles.nextLabel, { color: tone.accent }]}>Next Action</Text>
          <Text style={styles.nextTitle}>{nextAction.title}</Text>
          <Text style={styles.nextBody}>{customerStageCopy(claim.current_status)}</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
        {canUploadDocuments ? (
          <QuickAction icon="cloud-upload-outline" label="Upload Documents" primary onPress={() => router.push({ pathname: '/customer/upload-documents', params: { claimId: claim.id } })} />
        ) : null}
        <QuickAction icon="headset" label="Claims Desk" onPress={() => router.push('/customer/support')} />
        </View>

        <View style={styles.sectionCard}>
        <Pressable accessibilityRole="button" onPress={() => setDocumentsExpanded((expanded) => !expanded)} style={styles.documentHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#EEF5FF' }]}>
            <MaterialCommunityIcons name="folder-file-outline" size={21} color={roleTheme.customer.accent} />
          </View>

          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>Documents</Text>
            <Text style={styles.sectionSub}>{documents.length ? `${documents.length} uploaded • ${verifiedCount} verified` : 'No documents uploaded yet'}</Text>
          </View>

          <MaterialCommunityIcons name={documentsExpanded ? 'chevron-up' : 'chevron-down'} size={24} color={palette.slate} />
        </Pressable>

        {documentsExpanded ? (
          <View style={styles.documentList}>
            {documents.length ? documents.map((document) => (
              <DocumentTile key={document.id} document={document} imagePreview={imagePreviews[document.id]} onOpen={() => void openDocument(document)} />
            )) : (
              <View style={styles.emptyPanel}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={roleTheme.customer.accent} />
                <Text style={styles.emptyTitle}>No claim documents uploaded yet</Text>
                <Text style={styles.emptyText}>Upload required claim files.</Text>
              </View>
            )}
          </View>
        ) : null}
        </View>

        <View style={styles.sectionCard}>
        <Pressable accessibilityRole="button" onPress={() => setHistoryExpanded((expanded) => !expanded)} style={styles.sectionTop}>
          <View>
            <Text style={styles.sectionTitle}>Status History</Text>
            <Text style={styles.sectionSub}>{history.length ? `${history.length} claim movement records` : 'No timeline updates yet'}</Text>
          </View>
          <MaterialCommunityIcons name={historyExpanded ? 'chevron-up' : 'chevron-down'} size={22} color={palette.slate} />
        </Pressable>

        {historyExpanded ? (
          <View style={styles.historyList}>
            {history.length ? history.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <View style={[styles.historyDot, { backgroundColor: claimTone(item.to_status).accent }]} />
                <View style={styles.historyCopy}>
                  <Text style={styles.historyStatus}>{item.to_status}</Text>
                  <Text style={styles.historyMeta}>{formatDateTime(item.created_at)}</Text>
                  {item.notes ? <Text style={styles.historyNote}>{item.notes}</Text> : null}
                </View>
              </View>
            )) : (
              <Text style={styles.emptyText}>No timeline updates yet.</Text>
            )}
            </View>
        ) : null}
        </View>

        <View style={styles.sectionCard}>
        <Pressable accessibilityRole="button" onPress={() => setJourneyExpanded((value) => !value)} style={styles.sectionTop}>
          <View>
            <Text style={styles.sectionTitle}>Claim Journey</Text>
            <Text style={styles.sectionSub}>{journey[currentJourneyIndex]?.label ?? claim.current_status}</Text>
          </View>
          <View style={styles.journeyRight}>
            <View style={[styles.progressPill, { backgroundColor: tone.soft }]}>
              <Text style={[styles.progressText, { color: tone.accent }]}>{progress}%</Text>
            </View>
            <MaterialCommunityIcons name={journeyExpanded ? 'chevron-up' : 'chevron-down'} size={22} color={palette.slate} />
          </View>
        </Pressable>

        <JourneyChainPreview currentIndex={currentJourneyIndex} accent={tone.accent} soft={tone.soft} />

        <View style={[styles.currentStageBox, { backgroundColor: tone.soft, borderColor: tone.border }]}>
          <Text style={[styles.currentStageLabel, { color: tone.accent }]}>You are here</Text>
          <Text style={styles.currentStageText}>{journey[currentJourneyIndex]?.label ?? claim.current_status}</Text>
        </View>

        {journeyExpanded ? (
          <View style={styles.journeyChainList}>
            <View style={styles.journeyChainLine} />
            {journey.map((step, index) => {
              const complete = index < currentJourneyIndex;
              const current = index === currentJourneyIndex;
              return (
                <View key={step.label} style={styles.journeyChainStep}>
                  <View style={styles.chainNodeWrap}>
                    <View style={[styles.chainNodeOuter, complete && styles.chainNodeOuterComplete, current && { borderColor: tone.accent, backgroundColor: tone.soft }]}>
                      <View style={[styles.chainNodeInner, complete && styles.chainNodeInnerComplete, current && { backgroundColor: tone.accent }]}>
                        <MaterialCommunityIcons name={complete ? 'check' : current ? 'truck-fast-outline' : 'lock-outline'} size={13} color={complete || current ? '#FFFFFF' : palette.slate} />
                      </View>
                    </View>
                  </View>
                  <View style={[styles.chainStepCard, current && { borderColor: tone.border, backgroundColor: tone.soft }]}>
                    <View style={styles.chainStepTop}>
                      <Text style={[styles.journeyStepTitle, current && { color: tone.accent }]}>{step.label}</Text>
                      {step.label === 'Journey Complete' && !current && !complete ? null : (
                        <Text style={[styles.chainStepBadge, complete && styles.chainStepBadgeDone, current && { color: tone.accent, backgroundColor: '#FFFFFF' }]}>{current ? 'Current' : complete ? 'Done' : 'Pending'}</Text>
                      )}
                    </View>
                    <Text style={styles.journeyStepMeta}>{current ? customerStageCopy(claim.current_status) : complete ? 'This stage has been completed.' : 'This stage will unlock as your claim moves ahead.'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
        </View>
      </View>
    </Screen>
  );
}

function JourneyChainPreview({ currentIndex, accent, soft }: { currentIndex: number; accent: string; soft: string }) {
  const visible = journey.filter((_, index) => index === 0 || index === journey.length - 1 || Math.abs(index - currentIndex) <= 1);
  return (
    <View style={styles.chainPreview}>
      {visible.map((step, visibleIndex) => {
        const index = journey.indexOf(step);
        const complete = index < currentIndex;
        const current = index === currentIndex;
        const skipped = visibleIndex > 0 && journey.indexOf(visible[visibleIndex - 1]) !== index - 1;
        return (
          <View key={step.label} style={styles.chainPreviewItem}>
            {visibleIndex > 0 ? <View style={[styles.chainPreviewLink, complete || current ? { backgroundColor: accent } : null]}><Text style={styles.chainPreviewDots}>{skipped ? '•••' : ''}</Text></View> : null}
            <View style={[styles.chainPreviewNode, complete && { backgroundColor: '#12805C' }, current && { backgroundColor: accent, shadowColor: accent }, !complete && !current && { backgroundColor: soft }]}>
              <MaterialCommunityIcons name={complete ? 'check' : current ? 'map-marker' : 'circle-outline'} size={13} color={complete || current ? '#FFFFFF' : palette.slate} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function InfoPair({ leftLabel, leftValue, rightLabel, rightValue }: { leftLabel: string; leftValue: string; rightLabel: string; rightValue: string }) {
  return (
    <View style={styles.infoPairRow}>
      <View style={styles.infoPairHalf}>
        <Text style={styles.infoPairText} numberOfLines={1}><Text style={styles.infoPairLabel}>{leftLabel}: </Text>{leftValue}</Text>
      </View>
      <View style={styles.infoPairHalf}>
        <Text style={styles.infoPairText} numberOfLines={1}><Text style={styles.infoPairLabel}>{rightLabel}: </Text>{rightValue}</Text>
      </View>
    </View>
  );
}

function QuickAction({ icon, label, onPress, primary = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.quickAction, primary && styles.quickActionPrimary]}>
      <MaterialCommunityIcons name={icon} size={18} color={primary ? '#FFFFFF' : palette.navy} />
      <Text style={[styles.quickActionText, primary && styles.quickActionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function DocumentTile({ document, imagePreview, onOpen }: { document: ClaimDocument; imagePreview?: string; onOpen: () => void }) {
  const tone = documentTone(document.verification_status);

  return (
    <View style={styles.documentTile}>
      <View style={[styles.documentIcon, { backgroundColor: tone.soft }]}>
        {imagePreview ? <Image source={{ uri: imagePreview }} style={styles.documentThumbnail} /> : <MaterialCommunityIcons name={tone.icon} size={20} color={tone.accent} />}
      </View>

      <View style={styles.documentCopy}>
        <Text style={styles.documentType}>{document.document_type}</Text>
        <Text style={styles.documentName} numberOfLines={1}>{document.file_name}</Text>
      </View>

      <View style={styles.documentSide}>
        <Text style={[styles.documentStatus, { color: tone.accent }]}>{documentStatusText(document.verification_status)}</Text>
        <Pressable accessibilityRole="button" onPress={onOpen} style={styles.openDocumentButton}>
          <MaterialCommunityIcons name="open-in-new" size={15} color={palette.ink} />
        </Pressable>
      </View>
    </View>
  );
}

function claimStageLabel(status: ClaimStatus) {
  if (status.includes('Document') || status.includes('Awaited')) return 'DOCUMENT STAGE';
  if (status.includes('Survey') || status.includes('Inspected')) return 'SURVEY STAGE';
  if (status.includes('Approval') || status.includes('Estimate')) return 'APPROVAL STAGE';
  if (status.includes('Repair') || status.includes('DO') || status.includes('RA')) return 'REPAIR / DO STAGE';
  if (status.includes('Payment') || status.includes('Settlement')) return 'PAYMENT STAGE';
  if (status === 'Closed' || status === 'Settled') return 'COMPLETED';
  return 'CLAIM STAGE';
}

function statusBadgeLabel(status: ClaimStatus) {
  if (status === 'Initial Documents Verification Pending' || status === 'Initial Documents Submitted' || status === 'Documents Submitted') {
    return 'Initial Documents Uploaded';
  }

  return status;
}

function claimTone(status: ClaimStatus) {
  if (status === 'Closed' || status === 'Settled') return { accent: '#12805C', soft: '#E8F8F0', background: '#F7FFFB', border: '#BFEBD0' };
  if (status === 'Rejected') return { accent: '#C43838', soft: '#FDECEC', background: '#FFF7F7', border: '#F2C6C6' };
  if (status.includes('Payment') || status.includes('Settlement')) return { accent: '#B7791F', soft: '#FFF4E2', background: '#FFFCF5', border: '#F7DCA2' };
  if (status.includes('Repair') || status.includes('DO') || status.includes('RA')) return { accent: '#7C3AED', soft: '#F0E9FF', background: '#FCFAFF', border: '#D8C8FF' };
  if (status.includes('Document') || status.includes('Awaited')) return { accent: '#C83272', soft: '#FFF0F6', background: '#FFF8FB', border: '#F8BFD7' };
  return { accent: '#0B63CE', soft: '#EEF5FF', background: '#F8FBFF', border: '#CFE0FF' };
}

const journey: { label: string; statuses: ClaimStatus[] }[] = [
  { label: 'Loss Report', statuses: ['Accident Reported'] },
  { label: 'Spot Intimation', statuses: ['Initial Documents Pending', 'Initial Documents Verification Pending', 'Initial Documents Submitted', 'Initial Documents Verified', 'Documents Submitted', 'Documents Pending'] },
  { label: 'Spot Surveyor Assigned', statuses: ['Surveyor Appointed'] },
  { label: 'Spot Survey Completed', statuses: ['Vehicle Inspected'] },
  { label: 'Final Documents', statuses: ['Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified'] },
  { label: 'Claim Intimation', statuses: ['Claim Intimated', 'Claim Intimation'] },
  { label: 'Final Surveyor Deputation', statuses: ['Final Surveyor Details', 'Survey Status', 'Survey Done'] },
  { label: 'Work Approval', statuses: ['Work Approval Status', 'Work Approval Received', 'Estimate Submitted', 'Approval Pending'] },
  { label: 'Under Repair', statuses: ['Under Repair', 'Repair Done', 'Repair Started', 'Repair Completed'] },
  { label: 'RI Status', statuses: ['RA Intimation', 'RA Intimation Done'] },
  { label: 'DO Status', statuses: ['DO Status', 'DO Submitted'] },
  { label: 'Vehicle Release', statuses: ['Final Bill Submitted'] },
  { label: 'DO Encashment', statuses: ['Payment Stage'] },
  { label: 'Payment Advice Status', statuses: ['Claim Completion In Progress', 'Settlement Under Process'] },
  { label: 'Journey Complete', statuses: ['Claim Complete', 'Settled', 'Closed'] },
];

function currentJourneyIndexFor(status?: ClaimStatus | null) {
  if (!status) return 0;
  return Math.max(0, journey.findIndex((step) => step.statuses.includes(status)));
}

function journeyProgress(status: ClaimStatus) {
  const index = currentJourneyIndexFor(status);
  return Math.round(((index + 1) / journey.length) * 100);
}

function nextActionForStatus(status: ClaimStatus) {
  if (status.includes('Document') || status.includes('Awaited')) return { title: 'Documents are being collected' };
  if (status.includes('Survey') || status.includes('Inspected')) return { title: 'Surveyor process is in progress' };
  if (status.includes('Approval') || status.includes('Estimate')) return { title: 'Approval is being coordinated' };
  if (status.includes('Repair') || status.includes('DO') || status.includes('RA')) return { title: 'Repair and delivery process is active' };
  if (status.includes('Payment') || status.includes('Settlement')) return { title: 'Payment settlement is being tracked' };
  if (status === 'Closed' || status === 'Settled') return { title: 'Claim journey is complete' };
  return { title: 'Claim desk is processing your case' };
}

function shouldShowUploadDocuments(claim: Claim, documents: ClaimDocument[]) {
  const required = requiredDocumentsForStatus(claim.current_status);
  return required.some((section) => !documents.some((document) => document.document_type === section.type && document.verification_status !== 'rejected'));
}

function statusIcon(status: ClaimStatus): keyof typeof MaterialCommunityIcons.glyphMap {
  if (status.includes('Document')) return 'file-document-check-outline';
  if (status.includes('Survey')) return 'clipboard-search-outline';
  if (status.includes('Repair')) return 'wrench-outline';
  if (status.includes('Payment') || status.includes('Settlement')) return 'bank-transfer';
  if (status === 'Closed' || status === 'Settled') return 'check-circle-outline';
  if (status === 'Rejected') return 'close-circle-outline';
  return 'shield-check-outline';
}

function documentTone(status: ClaimDocument['verification_status']) {
  if (status === 'verified') return { accent: '#12805C', soft: '#E8F8F0', icon: 'check-circle-outline' as const };
  if (status === 'rejected') return { accent: '#C43838', soft: '#FDECEC', icon: 'alert-circle-outline' as const };
  return { accent: '#B7791F', soft: '#FFF4E2', icon: 'clock-outline' as const };
}

function documentStatusText(status: ClaimDocument['verification_status']) {
  if (status === 'verified') return 'Verified';
  if (status === 'rejected') return 'Replacement';
  return 'Pending';
}

function isImageDocument(document: ClaimDocument) {
  if (document.mime_type?.startsWith('image/')) return true;
  return /\.(avif|gif|heic|jpe?g|png|webp)$/i.test(document.file_name);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isIncidentAfterPolicyExpiry(claim: Claim, policy: Policy | null) {
  const incident = claim.accident_at ? new Date(claim.accident_at) : null;
  const expiry = policyExpiryEndOfDay(policy?.end_date);
  if (!incident || Number.isNaN(incident.getTime()) || !expiry) return false;
  return incident.getTime() > expiry.getTime();
}

function policyExpiryEndOfDay(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

const styles = StyleSheet.create({
  claimDetailContent: { marginTop: -22 },
  pageHeading: { marginBottom: 12 },
  pageEyebrow: { color: palette.slate, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  pageTitle: { color: palette.ink, fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: 2 },
  heroCard: { borderRadius: 18, borderWidth: 1, padding: 13, paddingLeft: 17, marginBottom: 10, overflow: 'hidden', shadowColor: palette.ink, shadowOpacity: 0.055, shadowRadius: 10, elevation: 2 },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  stageLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  vehicleNo: { color: palette.ink, fontSize: 18, fontWeight: '900', marginTop: 1 },
  controlNo: { color: palette.slate, fontSize: 11.3, fontWeight: '800', marginTop: 2 },
  numberRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  numberBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  focusStatusBadge: { maxWidth: 132, minHeight: 34, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  focusStatusText: { fontSize: 10.5, lineHeight: 13, fontWeight: '900', textAlign: 'center' },
  numberLabel: { color: palette.slate, fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  numberValue: { color: palette.ink, fontSize: 12.2, lineHeight: 16, fontWeight: '900', marginTop: 2 },

  infoBox: { marginTop: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#E5ECF5', gap: 5 },
  infoPairRow: { flexDirection: 'row', gap: 8 },
  infoPairHalf: { flex: 1, minWidth: 0 },
  infoPairText: { color: palette.ink, fontSize: 11.1, lineHeight: 15, fontWeight: '800' },
  infoPairLabel: { color: palette.slate, fontSize: 10.2, fontWeight: '900' },
  expiredClaimWarning: { marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: '#FDA29B', backgroundColor: '#FEF3F2', paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  expiredClaimWarningCopy: { flex: 1, minWidth: 0 },
  expiredClaimWarningTitle: { color: '#B42318', fontSize: 11.6, fontWeight: '900' },
  expiredClaimWarningText: { color: '#7A271A', fontSize: 10.4, fontWeight: '800', marginTop: 2 },
  nextActionCard: { flexDirection: 'row', gap: 10, borderRadius: 18, borderWidth: 1, padding: 13, marginBottom: 10, backgroundColor: '#FFFFFF', shadowColor: palette.ink, shadowOpacity: 0.045, shadowRadius: 9, elevation: 1 },
  nextActionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextActionCopy: { flex: 1, minWidth: 0 },
  nextLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextTitle: { color: palette.ink, fontSize: 13.5, fontWeight: '900', marginTop: 3 },
  nextBody: { color: palette.slate, fontSize: 11.8, lineHeight: 16, fontWeight: '700', marginTop: 3 },

  quickActions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickAction: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#C7DAFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  quickActionPrimary: { backgroundColor: palette.navy, borderColor: palette.navy },
  quickActionText: { color: palette.navy, fontSize: 12, fontWeight: '900' },
  quickActionTextPrimary: { color: '#FFFFFF' },

  sectionCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 18, padding: 13, marginBottom: 10, shadowColor: palette.ink, shadowOpacity: 0.045, shadowRadius: 9, elevation: 1 },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' },
  sectionSub: { color: palette.slate, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  progressPill: { minHeight: 30, borderRadius: 10, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  progressText: { fontSize: 12, fontWeight: '900' },

  progressTrack: { height: 8, borderRadius: 99, backgroundColor: '#E8EEF7', overflow: 'hidden', marginBottom: 11 },
  progressFill: { height: 8, borderRadius: 99 },
  chainPreview: { minHeight: 54, borderRadius: 16, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E4ECF7', paddingHorizontal: 11, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  chainPreviewItem: { flexDirection: 'row', alignItems: 'center' },
  chainPreviewLink: { width: 30, height: 4, borderRadius: 99, backgroundColor: '#D7E2F0', alignItems: 'center', justifyContent: 'center', marginHorizontal: 2 },
  chainPreviewDots: { color: '#91A3BA', fontSize: 11, lineHeight: 11, fontWeight: '900', marginTop: -10 },
  chainPreviewNode: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: palette.ink, shadowOpacity: 0.1, shadowRadius: 7, elevation: 2 },
  stageRail: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  stageRailText: { color: palette.slate, fontSize: 8.5, fontWeight: '900' },
  dotJourney: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  dotWrap: { flex: 1, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
  dotComplete: { backgroundColor: '#12805C' },
  currentStageBox: { borderWidth: 1, borderRadius: 14, padding: 10 },
  currentStageLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  currentStageText: { color: palette.ink, fontSize: 13.5, fontWeight: '900', marginTop: 3 },

  documentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionHeaderCopy: { flex: 1, minWidth: 0 },
  documentList: { marginTop: 11, gap: 8 },
  documentTile: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E5ECF5', borderRadius: 14, padding: 10 },
  documentIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  documentThumbnail: { width: 38, height: 38, borderRadius: 12 },
  documentCopy: { flex: 1, minWidth: 0 },
  documentType: { color: palette.ink, fontSize: 12.5, fontWeight: '900' },
  documentName: { color: palette.slate, fontSize: 11, fontWeight: '700', marginTop: 2 },
  documentSide: { alignItems: 'flex-end', gap: 5 },
  documentStatus: { fontSize: 10.5, fontWeight: '900' },
  openDocumentButton: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },

  emptyPanel: { alignItems: 'center', paddingVertical: 14, gap: 5 },
  emptyTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  emptyText: { color: palette.slate, fontSize: 12, fontWeight: '700', lineHeight: 17 },

  historyList: { marginTop: 11 },
  historyRow: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#E5ECF5' },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  historyCopy: { flex: 1 },
  historyStatus: { color: palette.ink, fontSize: 12.5, fontWeight: '900' },
  historyMeta: { color: palette.slate, fontSize: 11.5, lineHeight: 16, fontWeight: '900', marginTop: 2 },
  historyNote: { color: palette.slate, fontSize: 11.3, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  journeyRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  journeyChainList: { marginTop: 13, gap: 10, position: 'relative', paddingLeft: 2 },
  journeyChainLine: { position: 'absolute', left: 22, top: 18, bottom: 18, width: 3, borderRadius: 99, backgroundColor: '#D7E2F0' },
  journeyChainStep: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  chainNodeWrap: { width: 43, alignItems: 'center', paddingTop: 5, zIndex: 2 },
  chainNodeOuter: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#D8E2EF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: palette.ink, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  chainNodeOuterComplete: { borderColor: '#12805C', backgroundColor: '#E8F8F0' },
  chainNodeInner: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center' },
  chainNodeInnerComplete: { backgroundColor: '#12805C' },
  chainStepCard: { flex: 1, borderRadius: 15, borderWidth: 1, borderColor: '#E5ECF5', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10 },
  chainStepTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chainStepBadge: { color: palette.slate, backgroundColor: '#EEF2F7', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9.5, fontWeight: '900', overflow: 'hidden' },
  chainStepBadgeDone: { color: '#12805C', backgroundColor: '#E8F8F0' },
  journeyStepTitle: { color: palette.ink, fontSize: 12.5, fontWeight: '900' },
  journeyStepMeta: { color: palette.slate, fontSize: 10.8, fontWeight: '700', marginTop: 4, lineHeight: 15 },
});
