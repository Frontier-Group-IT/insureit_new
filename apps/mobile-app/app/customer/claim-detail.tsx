import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppSectionHeader, AppTimeline } from '@/components/design-system';
import { Button, Card, EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { requiredDocumentsForStatus } from '@/lib/claim-documents';
import { customerStageCopy } from '@/lib/claim-workflow';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Claim, ClaimDocument, ClaimHistory, ClaimStageDetail, ClaimStatus, Vehicle } from '@/lib/types';

export default function ClaimDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [stageDetails, setStageDetails] = useState<ClaimStageDetail[]>([]);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [documentsExpanded, setDocumentsExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [claimResult, historyResult, documentsResult, stageDetailsResult] = await Promise.all([
        supabase.from('claims').select('*').eq('id', id).maybeSingle(),
        supabase.from('claim_status_history').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        supabase.from('claim_documents').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        supabase.from('claim_stage_details').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
      ]);
      setClaim(claimResult.data);
      if (claimResult.data?.vehicle_id) {
        const { data } = await supabase.from('vehicles').select('*').eq('id', claimResult.data.vehicle_id).maybeSingle();
        setVehicle(data);
      }
      setHistory(historyResult.data ?? []);
      setDocuments(documentsResult.data ?? []);
      setStageDetails(stageDetailsResult.data ?? []);
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

  if (loading) return <Screen title="Claim Detail"><LoadingState /></Screen>;
  if (!claim) return <Screen title="Claim Detail"><EmptyState title="Claim not found" body="Please go back and choose a claim from your list." /></Screen>;

  const nextAction = nextActionForStatus(claim.current_status);
  const verifiedCount = documents.filter((document) => document.verification_status === 'verified').length;
  const canUploadDocuments = shouldShowUploadDocuments(claim, documents);
  const heroTone = claimHeroTone(claim.current_status);
  const managerUpdateFallbacks = managerUpdateFallbacksFor(history, stageDetails);

  return (
    <Screen title="Claim Detail" showLogout showTitleHeader={false}>
      {message ? <Message type="error">{message}</Message> : null}
      <Card style={[styles.heroCard, { backgroundColor: heroTone.background, borderColor: heroTone.border }]}>
        <View style={[styles.heroWash, { backgroundColor: heroTone.wash }]} />
        <View style={[styles.heroWashSmall, { backgroundColor: heroTone.washAlt }]} />
        <View style={styles.heroTop}>
          <View style={[styles.statusIcon, { backgroundColor: heroTone.accent }]}>
            <MaterialCommunityIcons name={statusIcon(claim.current_status)} size={25} color={palette.surface} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>Commercial vehicle claim</Text>
            <Text style={styles.claimNo}>{claim.claim_no}</Text>
            <Text style={styles.vehicleNo}>{vehicle?.vehicle_no ?? 'Vehicle linked'}</Text>
          </View>
          <AppBadge label={claim.current_status} tone={statusTone(claim.current_status)} />
        </View>
        <View style={[styles.nextPanel, { borderColor: heroTone.border }]}>
          <View style={styles.nextTopRow}>
            <Text style={[styles.nextLabel, { color: heroTone.accent }]}>Next step</Text>
            <MaterialCommunityIcons name="transit-connection-variant" size={18} color={heroTone.accent} />
          </View>
          <Text style={styles.nextTitle}>{nextAction.title}</Text>
          <Text style={styles.nextBody}>{customerStageCopy(claim.current_status)}</Text>
        </View>
        <View style={styles.factGrid}>
          <Fact icon="clock-outline" label="Last update" value={formatDateTime(claim.updated_at ?? claim.created_at)} />
          <Fact icon="calendar-alert" label="Accident date" value={claim.accident_at ? formatDateTime(claim.accident_at) : null} />
          <Fact icon="map-marker-radius-outline" label="Location" value={claim.accident_location} wide />
        </View>
      </Card>

      <View style={styles.actionPanel}>
        {canUploadDocuments ? (
          <View style={styles.actionButton}>
            <Button label="Upload documents" onPress={() => router.push({ pathname: '/customer/upload-documents', params: { claimId: claim.id } })} />
          </View>
        ) : null}
        <View style={styles.actionButton}>
          <Button label="Claims Desk" variant="secondary" onPress={() => router.push('/customer/support')} />
        </View>
      </View>

      <Card style={[styles.journeyCard, styles.journeySection]}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderCopy}>
            <AppSectionHeader title="Claim journey" />
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>{journeyProgress(claim.current_status)}%</Text>
          </View>
        </View>
        <AppTimeline steps={buildJourney(claim.current_status, history)} />
      </Card>

      <Card style={styles.documentsSection}>
        <Pressable accessibilityRole="button" onPress={() => setDocumentsExpanded((expanded) => !expanded)} style={styles.documentGroupHeader}>
          <View style={styles.documentGroupIcon}>
            <MaterialCommunityIcons name="folder-file-outline" size={21} color={roleTheme.customer.accent} />
          </View>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.documentGroupTitle}>Documents</Text>
            <Text style={styles.documentGroupMeta}>{documents.length ? `${documents.length} uploaded - ${verifiedCount} verified` : 'No documents uploaded yet'}</Text>
          </View>
          <MaterialCommunityIcons name={documentsExpanded ? 'chevron-up' : 'chevron-down'} size={24} color={palette.slate} />
        </Pressable>
        {documentsExpanded ? (
          documents.length ? documents.map((document) => (
            <DocumentTile key={document.id} document={document} onOpen={() => void openDocument(document)} />
          )) : (
            <View style={styles.emptyPanel}>
              <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={roleTheme.customer.accent} />
              <Text style={styles.emptyTitle}>No claim documents uploaded yet</Text>
              <Text style={styles.emptyText}>Upload required claim files.</Text>
            </View>
          )
        ) : null}
      </Card>

      <Card style={styles.stageDetailsSection}>
        <AppSectionHeader title="Manager updates" />
        {stageDetails.length || managerUpdateFallbacks.length ? null : <Text style={styles.emptyText}>No manager details recorded yet.</Text>}
        {stageDetails.map((item) => (
          <View key={item.id} style={styles.stageDetailRow}>
            <Text style={styles.stageDetailTitle}>{item.stage}</Text>
            <Text style={styles.stageDetailMeta}>{formatStageDetails(item.details)}</Text>
          </View>
        ))}
        {managerUpdateFallbacks.map((item) => (
          <View key={`history-${item.id}`} style={styles.stageDetailRow}>
            <Text style={styles.stageDetailTitle}>{item.to_status}</Text>
            <Text style={styles.stageDetailMeta}>{item.notes ?? '-'}</Text>
          </View>
        ))}
      </Card>
      <Card style={styles.historySection}>
        <AppSectionHeader title="Status history" />
        {history.length ? null : <Text style={styles.emptyText}>No timeline updates yet.</Text>}
        {history.map((item) => (
          <View key={item.id} style={styles.historyRow}>
            <View style={styles.historyDot} />
            <View style={styles.historyCopy}>
              <Text style={styles.historyStatus}>{item.to_status}</Text>
              <Text style={styles.historyMeta}>{item.notes ?? formatDateOnly(item.created_at)}</Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function Fact({ icon, label, value, wide = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string | null; wide?: boolean }) {
  return (
    <View style={[styles.factTile, wide && styles.factTileWide]}>
      <View style={styles.factIcon}>
        <MaterialCommunityIcons name={icon} size={17} color={roleTheme.customer.accent} />
      </View>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={wide ? 2 : 1}>{value ?? '-'}</Text>
    </View>
  );
}

function DocumentTile({ document, onOpen }: { document: ClaimDocument; onOpen: () => void }) {
  const tone = documentTone(document.verification_status);
  return (
    <View style={styles.documentTile}>
      <View style={[styles.documentIcon, { backgroundColor: tone.soft }]}>
        <MaterialCommunityIcons name={tone.icon} size={21} color={tone.accent} />
      </View>
      <View style={styles.documentCopy}>
        <Text style={styles.documentType}>{document.document_type}</Text>
        <Text style={styles.documentName} numberOfLines={1}>{document.file_name}</Text>
      </View>
      <View style={styles.documentSide}>
        <Text style={[styles.documentStatus, { color: tone.accent }]}>{document.verification_status}</Text>
        <Pressable accessibilityRole="button" onPress={onOpen} style={styles.openDocumentButton}>
          <MaterialCommunityIcons name="open-in-new" size={16} color={palette.ink} />
        </Pressable>
      </View>
    </View>
  );
}

function managerUpdateFallbacksFor(history: ClaimHistory[], stageDetails: ClaimStageDetail[]) {
  const structuredStages: ClaimStatus[] = ['Surveyor Appointed', 'Final Surveyor Details'];
  return structuredStages.flatMap((stage) => {
    if (stageDetails.some((item) => item.stage === stage)) return [];
    const historyItem = history.find((item) => item.to_status === stage && item.notes);
    return historyItem ? [historyItem] : [];
  });
}
function formatStageDetails(details: ClaimStageDetail['details']) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return '-';
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== '')
    .map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`)
    .join(' - ') || '-';
}

function humanizeKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}
const journey: { label: string; statuses: ClaimStatus[] }[] = [
  { label: 'Accident Reported', statuses: ['Accident Reported'] },
  { label: 'Initial Documents', statuses: ['Initial Documents Pending', 'Initial Documents Verification Pending', 'Initial Documents Submitted', 'Initial Documents Verified', 'Documents Submitted', 'Documents Pending'] },
  { label: 'Surveyor Assigned', statuses: ['Surveyor Appointed'] },
  { label: 'Survey Completed', statuses: ['Vehicle Inspected'] },
  { label: 'Final Documents', statuses: ['Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified'] },
  { label: 'Claim Intimation', statuses: ['Claim Intimated', 'Claim Intimation'] },
  { label: 'Final Surveyor', statuses: ['Final Surveyor Details', 'Survey Status', 'Survey Done'] },
  { label: 'Work Approval', statuses: ['Work Approval Status', 'Work Approval Received', 'Estimate Submitted', 'Approval Pending'] },
  { label: 'Under Repair', statuses: ['Under Repair', 'Repair Done', 'Repair Started', 'Repair Completed'] },
  { label: 'RA / DO', statuses: ['RA Intimation', 'RA Intimation Done', 'DO Status', 'DO Submitted', 'Final Bill Submitted'] },
  { label: 'Payment Advice Received', statuses: ['Payment Stage', 'Claim Completion In Progress', 'Settlement Under Process'] },
  { label: 'Journey Complete', statuses: ['Claim Complete', 'Settled', 'Closed'] },
];

function buildJourney(currentStatus: ClaimStatus, history: ClaimHistory[]) {
  const currentIndex = Math.max(0, journey.findIndex((step) => step.statuses.includes(currentStatus)));
  const completedStatuses = new Set(history.map((item) => item.to_status));
  completedStatuses.add(currentStatus);
  return journey.map((step, index) => {
    const state = index < currentIndex || (index <= currentIndex && step.statuses.some((status) => completedStatuses.has(status)) && step.statuses[0] !== currentStatus)
      ? 'complete' as const
      : index === currentIndex
        ? 'current' as const
        : 'pending' as const;
    return { label: step.label, state, meta: step.statuses.includes(currentStatus) ? currentStatus : undefined };
  });
}

function statusTone(status: ClaimStatus) {
  if (['Settled', 'Closed'].includes(status)) return 'success';
  if (['Rejected'].includes(status)) return 'danger';
  if (['Approval Pending', 'Initial Documents Pending', 'Initial Documents Verification Pending', 'Documents Pending', 'Final Documents Awaited', 'Final Documents Verification Pending', 'Survey Status', 'Work Approval Status', 'RA Intimation', 'DO Status', 'Payment Stage', 'Claim Completion In Progress', 'Settlement Under Process'].includes(status)) return 'warning';
  return 'info';
}

function claimHeroTone(status: ClaimStatus) {
  if (['Initial Documents Pending', 'Documents Pending', 'Final Documents Awaited', 'Accident Reported', 'Draft'].includes(status)) {
    return { background: '#FFF8EA', border: '#F4D999', wash: 'rgba(245,158,11,0.16)', washAlt: 'rgba(255,255,255,0.7)', accent: palette.amber };
  }
  if (['Initial Documents Verification Pending', 'Initial Documents Submitted', 'Documents Submitted', 'Final Documents Verification Pending', 'Final Documents Submitted'].includes(status)) {
    return { background: '#EFFBFD', border: '#BCEBF1', wash: 'rgba(14,175,200,0.14)', washAlt: 'rgba(255,255,255,0.72)', accent: palette.cyan };
  }
  if (['Initial Documents Verified', 'Final Documents Verified', 'Survey Done', 'Work Approval Received', 'RA Intimation Done', 'Claim Complete', 'Settled', 'Closed'].includes(status)) {
    return { background: '#F0FBF5', border: '#BFEBD0', wash: 'rgba(16,166,111,0.14)', washAlt: 'rgba(255,255,255,0.75)', accent: palette.emerald };
  }
  if (['Claim Intimated', 'Claim Intimation', 'Surveyor Appointed', 'Vehicle Inspected', 'Final Surveyor Details', 'Survey Status', 'Survey Done'].includes(status)) {
    return { background: '#F2F7FF', border: '#C9DDFF', wash: 'rgba(7,94,234,0.14)', washAlt: 'rgba(14,175,200,0.08)', accent: palette.blue };
  }
  if (['Estimate Submitted', 'Approval Pending', 'Work Approval Status', 'Work Approval Received'].includes(status)) {
    return { background: '#F7F5FF', border: '#D8D4FF', wash: 'rgba(98,87,215,0.14)', washAlt: 'rgba(255,255,255,0.74)', accent: palette.violet };
  }
  if (['Under Repair', 'Repair Done', 'Repair Started', 'Repair Completed', 'RA Intimation', 'RA Intimation Done', 'DO Status', 'DO Submitted', 'Final Bill Submitted', 'Payment Stage', 'Claim Completion In Progress', 'Claim Complete', 'Settlement Under Process'].includes(status)) {
    return { background: '#FFF4EF', border: '#FFD2C7', wash: 'rgba(229,72,77,0.1)', washAlt: 'rgba(245,158,11,0.1)', accent: '#E05F2D' };
  }
  if (status === 'Rejected') {
    return { background: '#FFF1F2', border: '#FAC7C9', wash: 'rgba(229,72,77,0.13)', washAlt: 'rgba(255,255,255,0.76)', accent: palette.coral };
  }
  return { background: palette.surface, border: palette.line, wash: palette.blueSoft, washAlt: 'rgba(255,255,255,0.8)', accent: palette.blue };
}

function statusIcon(status: ClaimStatus): keyof typeof MaterialCommunityIcons.glyphMap {
  if (['Settled', 'Closed'].includes(status)) return 'check-decagram-outline';
  if (['Rejected'].includes(status)) return 'alert-octagon-outline';
  if (['Initial Documents Pending', 'Documents Pending', 'Final Documents Awaited'].includes(status)) return 'file-alert-outline';
  if (['Initial Documents Verification Pending', 'Initial Documents Submitted', 'Documents Submitted', 'Final Documents Verification Pending', 'Final Documents Submitted'].includes(status)) return 'file-search-outline';
  if (['Surveyor Appointed', 'Vehicle Inspected', 'Final Surveyor Details', 'Survey Status', 'Survey Done'].includes(status)) return 'clipboard-search-outline';
  if (['Under Repair', 'Repair Done', 'Repair Started', 'Repair Completed', 'RA Intimation', 'RA Intimation Done', 'DO Status'].includes(status)) return 'wrench-outline';
  if (['Payment Stage', 'Claim Completion In Progress', 'Claim Complete', 'Settlement Under Process'].includes(status)) return 'bank-transfer';
  return 'truck-check-outline';
}

function nextActionForStatus(status: ClaimStatus) {
  if (status === 'Accident Reported' || status === 'Initial Documents Pending') return { title: 'Upload initial documents' };
  if (status === 'Documents Pending') return { title: 'Complete missing documents' };
  if (status === 'Initial Documents Verification Pending' || status === 'Initial Documents Submitted' || status === 'Documents Submitted') return { title: 'Initial document verification pending' };
  if (status === 'Initial Documents Verified') return { title: 'Surveyor appointment' };
  if (status === 'Surveyor Appointed') return { title: 'Vehicle inspection' };
  if (status === 'Vehicle Inspected') return { title: 'Final document request' };
  if (status === 'Final Documents Awaited') return { title: 'Upload final documents' };
  if (status === 'Final Documents Verification Pending' || status === 'Final Documents Submitted') return { title: 'Final document verification pending' };
  if (status === 'Final Documents Verified') return { title: 'Claim intimation' };
  if (status === 'Claim Intimation') return { title: 'Final surveyor details' };
  if (status === 'Final Surveyor Details') return { title: 'Survey status' };
  if (status === 'Survey Status') return { title: 'Survey in progress' };
  if (status === 'Survey Done') return { title: 'Work approval status' };
  if (status === 'Work Approval Status') return { title: 'Awaiting work approval' };
  if (status === 'Work Approval Received') return { title: 'Under repair' };
  if (status === 'Under Repair') return { title: 'Repair in progress' };
  if (status === 'Repair Done') return { title: 'RA intimation next' };
  if (status === 'RA Intimation' || status === 'RA Intimation Done') return { title: 'RA intimation' };
  if (status === 'DO Status') return { title: 'Delivery order status' };
  if (status === 'Payment Stage') return { title: 'Payment advice' };
  if (status === 'Claim Completion In Progress') return { title: 'Claim completion in progress' };
  if (status === 'Claim Complete') return { title: 'Claim completion' };
  if (['Estimate Submitted', 'Approval Pending', 'Work Approval Status', 'Work Approval Received'].includes(status)) return { title: 'Awaiting approval' };
  if (['Under Repair', 'Repair Done', 'Repair Started', 'Repair Completed', 'RA Intimation', 'RA Intimation Done', 'DO Status'].includes(status)) return { title: 'Repair and billing' };
  if (['DO Submitted', 'Final Bill Submitted', 'Settlement Under Process'].includes(status)) return { title: 'Settlement processing' };
  if (['Settled', 'Closed'].includes(status)) return { title: 'Claim complete' };
  if (status === 'Rejected') return { title: 'Contact claims desk' };
  return { title: 'Processing' };
}

const customerUploadStatuses: ClaimStatus[] = ['Accident Reported', 'Initial Documents Pending', 'Documents Pending', 'Final Documents Awaited'];
const documentReviewStatuses: ClaimStatus[] = ['Initial Documents Verification Pending', 'Initial Documents Submitted', 'Documents Submitted', 'Final Documents Verification Pending', 'Final Documents Submitted'];

function shouldShowUploadDocuments(claim: Claim, documents: ClaimDocument[]) {
  if (customerUploadStatuses.includes(claim.current_status)) return true;
  if (documents.some((document) => document.verification_status === 'rejected')) return true;
  if (!documentReviewStatuses.includes(claim.current_status)) return false;

  const required = requiredDocumentsForStatus(claim.current_status);
  return required.some((requiredDocument) => {
    const latestForType = documents
      .filter((document) => document.document_type === requiredDocument.type)
      .sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime())[0];
    return !latestForType;
  });
}

function documentTone(status: string): { accent: string; soft: string; icon: keyof typeof MaterialCommunityIcons.glyphMap } {
  if (status === 'verified') return { accent: palette.emerald, soft: palette.emeraldSoft, icon: 'file-check-outline' };
  if (status === 'rejected') return { accent: palette.coral, soft: palette.coralSoft, icon: 'file-remove-outline' };
  if (status === 'pending') return { accent: palette.amber, soft: palette.amberSoft, icon: 'file-alert-outline' };
  return { accent: palette.blue, soft: palette.blueSoft, icon: 'file-document-outline' };
}

function journeyProgress(currentStatus: ClaimStatus) {
  const currentIndex = Math.max(0, journey.findIndex((step) => step.statuses.includes(currentStatus)));
  return Math.round(((currentIndex + 1) / journey.length) * 100);
}

function formatDateTime(date?: string) {
  if (!date) return null;
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDateOnly(date?: string) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  heroCard: { padding: 14, overflow: 'hidden', marginTop: -8 },
  heroWash: { position: 'absolute', right: -70, top: -80, width: 210, height: 210, borderRadius: 105, backgroundColor: palette.emeraldSoft },
  heroWashSmall: { position: 'absolute', left: -82, bottom: -94, width: 190, height: 190, borderRadius: 95 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusIcon: { width: 44, height: 44, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', shadowColor: palette.ink, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroLabel: { color: palette.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0 },
  claimNo: { color: palette.ink, fontSize: 20, fontWeight: '800', marginTop: 2 },
  vehicleNo: { color: palette.slate, fontSize: 14, fontWeight: '600', marginTop: 3 },
  nextPanel: { marginTop: 14, borderRadius: radii.sm, backgroundColor: palette.surfaceAlt, borderWidth: 1, borderColor: palette.line, padding: 12 },
  nextTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  nextLabel: { color: roleTheme.customer.accent, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0 },
  nextTitle: { color: palette.ink, fontSize: 17, fontWeight: '700', marginTop: 4, lineHeight: 22 },
  nextBody: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 19, marginTop: 6 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  factTile: { width: '48.7%', borderRadius: radii.sm, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 10 },
  factTileWide: { width: '100%' },
  factIcon: { width: 30, height: 30, borderRadius: radii.sm, backgroundColor: roleTheme.customer.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  factLabel: { color: palette.muted, fontSize: 12, fontWeight: '500' },
  factValue: { color: palette.ink, fontSize: 14, fontWeight: '700', marginTop: 3, lineHeight: 19 },
  actionPanel: { flexDirection: 'row', gap: 9, marginBottom: 10, padding: 10, borderRadius: radii.md, backgroundColor: palette.blueMist, borderWidth: 1, borderColor: '#C7DEFF' },
  actionButton: { flex: 1, minWidth: 0 },
  journeyCard: { paddingBottom: 16 },
  journeySection: { backgroundColor: '#F7F5FF', borderColor: '#D8D4FF' },
  documentsSection: { backgroundColor: '#F0FBF5', borderColor: '#BFEBD0' },
  stageDetailsSection: { backgroundColor: '#F8FBFF', borderColor: '#D7E6FA' },
  historySection: { backgroundColor: '#FFF8EA', borderColor: '#F4D999' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionHeaderCopy: { flex: 1, minWidth: 0 },
  sectionSubtitle: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: -5, marginBottom: 8 },
  progressBadge: { minWidth: 54, height: 34, borderRadius: radii.sm, backgroundColor: roleTheme.customer.soft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  progressBadgeText: { color: roleTheme.customer.accent, fontSize: 13, fontWeight: '700' },
  documentCount: { color: palette.slate, fontSize: 12, fontWeight: '600', marginTop: 2 },
  documentGroupHeader: { minHeight: 62, borderRadius: radii.sm, backgroundColor: palette.surfaceAlt, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 11, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  documentGroupIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: roleTheme.customer.soft, alignItems: 'center', justifyContent: 'center' },
  documentGroupTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  documentGroupMeta: { color: palette.slate, fontSize: 12, fontWeight: '600', marginTop: 3 },
  documentTile: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: radii.sm, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceAlt, padding: 11, marginTop: 9 },
  documentIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  documentCopy: { flex: 1, minWidth: 0 },
  documentType: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  documentName: { color: palette.muted, fontSize: 12, fontWeight: '500', marginTop: 3 },
  documentSide: { alignItems: 'flex-end', gap: 6 },
  documentStatus: { fontSize: 11, fontWeight: '700' },
  openDocumentButton: { width: 34, height: 30, borderRadius: radii.sm, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  emptyPanel: { borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceAlt, padding: 14, marginTop: 8 },
  emptyTitle: { color: palette.ink, fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptyText: { color: palette.slate, fontSize: 14, fontWeight: '500', lineHeight: 20, marginTop: 4 },
  stageDetailRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.line },
  stageDetailTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  stageDetailMeta: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 3 },
  historyRow: { flexDirection: 'row', gap: 11, paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.line },
  historyDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: roleTheme.customer.accent, marginTop: 5 },
  historyCopy: { flex: 1, minWidth: 0 },
  historyStatus: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  historyMeta: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 3 },
});








