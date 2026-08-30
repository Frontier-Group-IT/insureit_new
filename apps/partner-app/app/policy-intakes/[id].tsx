import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import {
  listPartnerPolicyIntakes,
  submitPartnerPolicyIntakeReplacement,
  type PartnerPolicyIntake,
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
    try {
      await submitPartnerPolicyIntakeReplacement({ intakeId: row.id, file });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Replacement document could not be submitted.');
    } finally {
      setReplacing(false);
    }
  }

  return (
    <PartnerScreen
      eyebrow="POLICY INTAKE"
      title={row?.intake_number || 'Submission'}
      action={
        <PartnerIconButton icon="close" label="Close Policy Intake detail" onPress={() => router.back()} />
      }
    >
      {submitted === '1' ? (
        <View style={styles.success}>
          <Ionicons name="checkmark-circle-outline" size={18} color={partnerTheme.colors.success} />
          <Text style={styles.successText}>Submitted successfully. Operations now receives this intake in the existing review queue.</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : !row ? (
        <View style={styles.empty}><Text style={styles.emptyText}>This Policy Intake is not available in your account.</Text></View>
      ) : (
        <>
          <View style={styles.statusCard}>
            <View style={styles.statusTop}>
              <View style={styles.statusIcon}><Ionicons name="git-network-outline" size={20} color={partnerTheme.colors.brand} /></View>
              <View style={styles.statusBody}>
                <Text style={styles.statusLabel}>Current status</Text>
                <Text style={styles.statusValue}>{statusLabel(row)}</Text>
              </View>
            </View>
            <Text style={styles.statusHelp}>{statusHelp(row)}</Text>
          </View>

          {row.attention_reason ? (
            <View style={styles.attention}>
              <View style={styles.attentionTop}>
                <Ionicons name="alert-circle-outline" size={18} color="#9A5B12" />
                <Text style={styles.attentionTitle}>Operations needs your response</Text>
              </View>
              <Text style={styles.attentionText}>{row.attention_reason}</Text>
              <Pressable disabled={replacing} onPress={replaceDocument} style={styles.replaceButton}>
                {replacing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />}
                <Text style={styles.replaceButtonText}>{replacing ? 'Uploading…' : 'Upload replacement policy copy'}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Submission</Text>
            <View style={styles.details}>
              <Detail label="Customer mobile" value={row.customer_mobile} />
              <Detail label="Lead source" value={row.lead_source_name} />
              <Detail label="Intermediary" value={`${row.lead_source_type.toUpperCase()}${row.lead_source_code ? ` · ${row.lead_source_code}` : ''}`} />
              <Detail label="Policy copy" value={row.file_name} />
              <Detail label="Submitted" value={formatDate(row.created_at)} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extracted policy details</Text>
            <View style={styles.details}>
              <Detail label="Policy number" value={fields.get('policy_number')?.value || pendingLabel(row)} />
              <Detail label="Insurer" value={fields.get('insurer_name')?.value || pendingLabel(row)} />
              <Detail label="Product" value={fields.get('policy_product')?.value || pendingLabel(row)} />
              <Detail label="Valid from" value={fields.get('policy_start_date')?.value || pendingLabel(row)} />
              <Detail label="Valid upto" value={fields.get('policy_end_date')?.value || pendingLabel(row)} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extracted vehicle details</Text>
            <View style={styles.details}>
              <Detail label="Registration" value={fields.get('vehicle_registration_number')?.value || pendingLabel(row)} />
              <Detail label="Make" value={fields.get('vehicle_make')?.value || pendingLabel(row)} />
              <Detail label="Model" value={fields.get('vehicle_model')?.value || pendingLabel(row)} />
              <Detail label="Chassis" value={fields.get('vehicle_chassis_number')?.value || pendingLabel(row)} />
            </View>
          </View>

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={partnerTheme.colors.brand} />
            <Text style={styles.noteText}>OCR values are a review aid only. Operations confirms the final customer, vehicle, policy and financial data during Policy Onboarding.</Text>
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
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
  } as Record<string, string>)[row.status] || row.status;
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

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

const styles = StyleSheet.create({
  close: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  success: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 12, backgroundColor: '#EAF7F0' },
  successText: { flex: 1, color: '#276546', fontSize: 9, lineHeight: 13 },
  error: { marginTop: 12, color: partnerTheme.colors.danger, fontSize: 9.5, lineHeight: 14 },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  empty: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: partnerTheme.colors.inkMuted, fontSize: 10 },
  statusCard: { marginTop: 12, borderRadius: partnerTheme.radius.xl, padding: 16, backgroundColor: partnerTheme.colors.nav },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  statusBody: { flex: 1 },
  statusLabel: { color: '#AEB8C8', fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  statusValue: { marginTop: 3, color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  statusHelp: { marginTop: 11, color: '#C5CCDA', fontSize: 9, lineHeight: 14 },
  attention: { marginTop: 14, borderRadius: partnerTheme.radius.lg, padding: 15, backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#F0D7AE' },
  attentionTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  attentionTitle: { color: '#80511A', fontSize: 10.5, fontWeight: '800' },
  attentionText: { marginTop: 7, color: '#80511A', fontSize: 9, lineHeight: 14 },
  replaceButton: { minHeight: 44, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, backgroundColor: '#A36A22' },
  replaceButtonText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
  section: { marginTop: 18 },
  sectionTitle: { marginBottom: 8, color: partnerTheme.colors.ink, fontSize: 13, fontWeight: '800' },
  details: { overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  detailRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  detailLabel: { color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
  detailValue: { flex: 1, color: partnerTheme.colors.ink, fontSize: 9.5, fontWeight: '700', textAlign: 'right' },
  note: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 12, backgroundColor: partnerTheme.colors.brandSoft },
  noteText: { flex: 1, color: '#5D5A80', fontSize: 8.5, lineHeight: 13 },
});
