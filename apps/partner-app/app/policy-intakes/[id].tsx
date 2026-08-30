import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import {
  listPartnerPolicyIntakes,
  submitPartnerPolicyIntakeReplacement,
  type PartnerPolicyIntake,
  type PartnerPolicyIntakeUploadProgress,
} from '@/lib/policy-intakes';
import { partnerTheme } from '@/lib/theme';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export default function PolicyIntakeDetailScreen() {
  const router = useRouter();
  const { id, submitted } = useLocalSearchParams<{ id: string; submitted?: string }>();
  const [row, setRow] = useState<PartnerPolicyIntake | null>(null);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [replacementProgress, setReplacementProgress] = useState<PartnerPolicyIntakeUploadProgress | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listPartnerPolicyIntakes();
      setRow(result.intakes.find((item) => item.id === id) ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy Intake could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = useMemo(() => new Map((row?.ocr_fields ?? []).map((field) => [field.key, field])), [row?.ocr_fields]);

  async function replaceDocument() {
    if (!row) return;
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: ALLOWED_TYPES, copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    if (file.size && file.size > MAX_FILE_SIZE) {
      setError('Policy copy must be 15 MB or smaller.');
      return;
    }

    setReplacing(true);
    setReplacementProgress({ stage: 'preparing' });
    try {
      await submitPartnerPolicyIntakeReplacement({
        intakeId: row.id,
        file,
        onProgress: setReplacementProgress,
      });
      setReplacementProgress(null);
      await load();
    } catch (cause) {
      setReplacementProgress(null);
      setError(cause instanceof Error ? cause.message : 'Replacement document could not be submitted.');
    } finally {
      setReplacing(false);
    }
  }

  return (
    <PartnerScreen
      eyebrow="POLICY INTAKE"
      title={row?.intake_number || 'Submission'}
      action={<PartnerIconButton icon="close" label="Close Policy Intake detail" onPress={() => router.back()} />}
    >
      {submitted === '1' && row ? (
        <View style={styles.banner}>
          <PartnerBanner
            tone="success"
            title={`Policy Intake ${row.intake_number} submitted`}
            message="Operations has received this intake. Track extraction, review and final policy creation here."
          />
        </View>
      ) : null}

      {loading ? (
        <PartnerStateView state="loading" title="Loading Policy Intake" />
      ) : error && !row ? (
        <PartnerStateView
          state="error"
          title="Policy Intake unavailable"
          message={error}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : !row ? (
        <PartnerStateView state="empty" title="Policy Intake unavailable" message="This submission is not available in your account." />
      ) : (
        <>
          {error ? (
            <View style={styles.banner}>
              <PartnerBanner tone="danger" title="Action not completed" message={error} />
            </View>
          ) : null}

          <View style={styles.statusCard}>
            <View style={styles.statusTop}>
              <View style={styles.statusIcon}><Ionicons name="git-network-outline" size={21} color={partnerTheme.colors.brand} /></View>
              <View style={styles.statusBody}>
                <Text style={styles.statusLabel}>CURRENT STATUS</Text>
                <Text style={styles.statusValue}>{statusLabel(row)}</Text>
                <Text style={styles.statusHelp}>{statusHelp(row)}</Text>
              </View>
            </View>
            <IntakeProgress row={row} />
            <Text style={styles.updated}>Updated {formatDate(row.updated_at)}</Text>
          </View>

          {row.final_policy_id ? (
            <View style={styles.finalPolicy}>
              <PartnerButton
                label="Open final policy"
                icon="document-text-outline"
                onPress={() => router.push(`/policy/${row.final_policy_id}` as never)}
              />
            </View>
          ) : null}

          {row.attention_reason ? (
            <View style={styles.attention}>
              <View style={styles.attentionTop}>
                <Ionicons name="alert-circle-outline" size={19} color="#9A5B12" />
                <Text style={styles.attentionTitle}>Operations needs your response</Text>
              </View>
              <Text style={styles.attentionText}>{row.attention_reason}</Text>

              {replacementProgress ? <ReplacementProgress progress={replacementProgress} /> : null}

              <View style={styles.replaceButton}>
                <PartnerButton
                  label={replacing ? replacementLabel(replacementProgress) : 'Upload replacement policy copy'}
                  icon="cloud-upload-outline"
                  loading={replacing}
                  disabled={replacing}
                  onPress={() => void replaceDocument()}
                />
              </View>
            </View>
          ) : null}

          <PartnerSectionHeader title="Submission" />
          <View style={styles.details}>
            <Detail label="Customer mobile" value={row.customer_mobile} />
            <Detail label="Lead source" value={row.lead_source_name} />
            <Detail label="Intermediary" value={`${row.lead_source_type.toUpperCase()}${row.lead_source_code ? ` · ${row.lead_source_code}` : ''}`} />
            <Detail label="Policy copy" value={row.file_name} />
            <Detail label="Submitted" value={formatDate(row.created_at)} last />
          </View>

          <PartnerSectionHeader title="Extracted policy details" meta={row.ocr_status === 'completed' ? 'OCR complete' : humanize(row.ocr_status)} />
          <View style={styles.details}>
            <Detail label="Policy number" value={fields.get('policy_number')?.value || pendingLabel(row)} />
            <Detail label="Insurer" value={fields.get('insurer_name')?.value || pendingLabel(row)} />
            <Detail label="Product" value={fields.get('policy_product')?.value || pendingLabel(row)} />
            <Detail label="Valid from" value={fields.get('policy_start_date')?.value || pendingLabel(row)} />
            <Detail label="Valid upto" value={fields.get('policy_end_date')?.value || pendingLabel(row)} last />
          </View>

          <PartnerSectionHeader title="Extracted vehicle details" />
          <View style={styles.details}>
            <Detail label="Registration" value={fields.get('vehicle_registration_number')?.value || pendingLabel(row)} />
            <Detail label="Make" value={fields.get('vehicle_make')?.value || pendingLabel(row)} />
            <Detail label="Model" value={fields.get('vehicle_model')?.value || pendingLabel(row)} />
            <Detail label="Chassis" value={fields.get('vehicle_chassis_number')?.value || pendingLabel(row)} last />
          </View>

          <View style={styles.note}>
            <PartnerBanner
              tone="info"
              message="OCR values are review aids only. Operations confirms the final customer, vehicle, policy and financial data during Policy Onboarding."
            />
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function IntakeProgress({ row }: { row: PartnerPolicyIntake }) {
  const manual = row.status === 'processing' && row.ocr_status === 'failed';
  const activeStep = row.status === 'completed'
    ? 4
    : row.status === 'in_review'
      ? 3
      : row.status === 'ready_for_review' || row.status === 'needs_attention' || manual
        ? 2
        : 1;

  const rejected = row.status === 'rejected';

  return (
    <View style={styles.progressWrap}>
      {['Uploaded', 'Read', 'Review', 'Done'].map((label, index) => {
        const step = index + 1;
        const complete = !rejected && step <= activeStep;
        const current = !rejected && step === activeStep;
        return (
          <View key={label} style={styles.progressStep}>
            <View style={styles.progressLineWrap}>
              <View style={[styles.progressDot, complete && styles.progressDotComplete, current && styles.progressDotCurrent, rejected && step === activeStep && styles.progressDotRejected]} />
              {index < 3 ? <View style={[styles.progressLine, step < activeStep && !rejected && styles.progressLineComplete]} /> : null}
            </View>
            <Text style={[styles.progressLabel, complete && styles.progressLabelActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReplacementProgress({ progress }: { progress: PartnerPolicyIntakeUploadProgress }) {
  const percent = progress.stage === 'preparing'
    ? 8
    : progress.stage === 'submitting'
      ? 96
      : Math.max(12, Math.min(92, progress.percent ?? 12));

  return (
    <View accessibilityLiveRegion="polite" style={styles.replacementProgress}>
      <View style={styles.replacementProgressTop}>
        <Text style={styles.replacementProgressText}>{replacementLabel(progress)}</Text>
        <Text style={styles.replacementProgressText}>{Math.round(percent)}%</Text>
      </View>
      <View style={styles.replacementTrack}><View style={[styles.replacementFill, { width: `${percent}%` }]} /></View>
    </View>
  );
}

function Detail({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function statusLabel(row: PartnerPolicyIntake) {
  if (row.status === 'processing' && row.ocr_status === 'failed') return 'Manual review required';
  return ({
    processing: 'Fetching policy details',
    ready_for_review: 'Ready for Operations review',
    in_review: 'In Operations review',
    needs_attention: 'Your response is needed',
    completed: 'Policy onboarding completed',
    rejected: 'Intake rejected',
  } as Record<string, string>)[row.status] || humanize(row.status);
}

function statusHelp(row: PartnerPolicyIntake) {
  if (row.status === 'processing' && row.ocr_status === 'failed') return 'Automatic extraction was unavailable. Operations can continue from the saved policy copy.';
  if (row.status === 'processing') return 'The uploaded policy copy is being read automatically.';
  if (row.status === 'ready_for_review') return 'The extracted details are ready for an Operations reviewer.';
  if (row.status === 'in_review') return 'An Operations user is reviewing this intake.';
  if (row.status === 'needs_attention') return 'Read the Operations note below and upload a replacement policy copy.';
  if (row.status === 'completed') return 'The final policy was linked and this intake is closed.';
  if (row.status === 'rejected') return 'This intake was closed without policy onboarding.';
  return 'Track this submission here.';
}

function pendingLabel(row: PartnerPolicyIntake) {
  return row.ocr_status === 'failed' ? 'Manual review' : row.ocr_status === 'completed' ? 'Not found' : 'Fetching…';
}

function replacementLabel(progress: PartnerPolicyIntakeUploadProgress | null) {
  if (!progress) return 'Uploading replacement…';
  if (progress.stage === 'preparing') return 'Preparing secure upload';
  if (progress.stage === 'submitting') return 'Sending to Operations';
  return progress.percent != null ? `Uploading · ${progress.percent}%` : 'Uploading replacement';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  banner: { marginBottom: 10 },
  statusCard: { borderRadius: partnerTheme.radius.xl, padding: 17, backgroundColor: partnerTheme.colors.nav },
  statusTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  statusBody: { flex: 1 },
  statusLabel: { color: '#AEB8C8', letterSpacing: 0.7, ...partnerTheme.typography.meta },
  statusValue: { marginTop: 4, color: '#FFFFFF', ...partnerTheme.typography.sectionTitle },
  statusHelp: { marginTop: 5, color: '#C5CCDA', ...partnerTheme.typography.caption },
  progressWrap: { marginTop: 17, paddingTop: 13, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3B4658' },
  progressStep: { flex: 1, alignItems: 'center' },
  progressLineWrap: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  progressDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#647084' },
  progressDotComplete: { backgroundColor: '#AAA5FF' },
  progressDotCurrent: { borderWidth: 2, borderColor: '#FFFFFF' },
  progressDotRejected: { backgroundColor: '#EF8C83' },
  progressLine: { position: 'absolute', left: '58%', width: '84%', height: 1, backgroundColor: '#465165' },
  progressLineComplete: { backgroundColor: '#AAA5FF' },
  progressLabel: { marginTop: 6, color: '#8995A7', ...partnerTheme.typography.meta },
  progressLabelActive: { color: '#FFFFFF' },
  updated: { marginTop: 12, color: '#8F9BAD', textAlign: 'right', ...partnerTheme.typography.meta },
  finalPolicy: { marginTop: 10 },
  attention: { marginTop: 14, borderRadius: partnerTheme.radius.lg, padding: 15, backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#F0D7AE' },
  attentionTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  attentionTitle: { color: '#80511A', ...partnerTheme.typography.bodyStrong },
  attentionText: { marginTop: 7, color: '#80511A', ...partnerTheme.typography.caption },
  replacementProgress: { marginTop: 12 },
  replacementProgressTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  replacementProgressText: { color: '#80511A', ...partnerTheme.typography.meta },
  replacementTrack: { height: 7, marginTop: 6, overflow: 'hidden', borderRadius: 999, backgroundColor: '#F0D7AE' },
  replacementFill: { height: '100%', borderRadius: 999, backgroundColor: '#A36A22' },
  replaceButton: { marginTop: 12 },
  details: { overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  detailRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  detailValue: { flex: 1, color: partnerTheme.colors.ink, textAlign: 'right', ...partnerTheme.typography.caption },
  note: { marginTop: 14 },
});
