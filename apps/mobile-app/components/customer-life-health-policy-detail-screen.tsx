import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getInsurerLogoSource } from '@/lib/catalog-logos';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { formatExternalPolicyNumber } from '@/lib/policy-number-display';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany } from '@/lib/types';

const MAX_POLICY_COPY_SIZE_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = [
  ['policy_copy', 'Policy copy', 'file-document-check-outline'],
  ['proposal_form', 'Proposal form', 'file-sign'],
  ['illustration_form', 'Illustration form', 'file-chart-outline'],
  ['payment_receipt', 'Payment receipt', 'receipt-text-outline'],
  ['other_form', 'Other form', 'file-outline'],
] as const;

type PolicyRow = {
  id: string;
  customer_id: string;
  insurance_company_id: string | null;
  policy_no: string;
  policy_type: string;
  policy_product?: string | null;
  issuance_date?: string | null;
  start_date: string;
  end_date: string;
  premium_amount?: number | null;
  remarks?: string | null;
  source: 'sibl' | 'external';
};

type LifeHealthDetails = {
  proposal_number: string | null;
  premium_paying_term: string | null;
  policy_duration: string | null;
  payment_frequency: string | null;
  payment_mode: string | null;
};

type PolicyDocument = {
  id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

export default function CustomerLifeHealthPolicyDetailScreen() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams<{ id: string; source?: 'sibl' | 'external' }>();
  const [policy, setPolicy] = useState<PolicyRow | null>(null);
  const [company, setCompany] = useState<InsuranceCompany | null>(null);
  const [details, setDetails] = useState<LifeHealthDetails | null>(null);
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [policyCopyExpanded, setPolicyCopyExpanded] = useState(false);
  const [policyCopyUrl, setPolicyCopyUrl] = useState<string | null>(null);
  const [uploadingCopy, setUploadingCopy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!id) return;
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const customerIds = contexts.map((context) => context.customer_id);
      if (!customerIds.length) {
        if (active) setLoading(false);
        return;
      }

      let next: any = null;
      let nextSource: 'sibl' | 'external' = source === 'external' ? 'external' : 'sibl';
      if (source === 'external') {
        next = (
          await (supabase as any)
            .from('external_policies')
            .select('*')
            .eq('id', id)
            .in('customer_id', customerIds)
            .maybeSingle()
        ).data;
      } else {
        next = (
          await supabase.from('policies').select('*').eq('id', id).in('customer_id', customerIds).maybeSingle()
        ).data;
        if (!next) {
          next = (
            await (supabase as any)
              .from('external_policies')
              .select('*')
              .eq('id', id)
              .in('customer_id', customerIds)
              .maybeSingle()
          ).data;
          if (next) nextSource = 'external';
        }
      }
      if (!active) return;
      if (!next || !isLifeHealthPolicy(next.policy_type)) {
        setLoading(false);
        return;
      }
      const nextPolicy = { ...next, source: nextSource } as PolicyRow;
      setPolicy(nextPolicy);

      const companyQuery = next.insurance_company_id
        ? supabase.from('insurance_companies').select('*').eq('id', next.insurance_company_id).maybeSingle()
        : Promise.resolve({ data: null });
      const detailsQuery =
        nextSource === 'sibl'
          ? (supabase as any)
              .from('life_health_policy_details')
              .select('proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode')
              .eq('policy_id', next.id)
              .maybeSingle()
          : Promise.resolve({ data: null });
      const documentsQuery =
        nextSource === 'sibl'
          ? (supabase as any)
              .from('policy_documents')
              .select('id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,created_at')
              .eq('policy_id', next.id)
              .in('document_type', DOCUMENT_TYPES.map(([type]) => type))
              .order('created_at', { ascending: false })
          : (supabase as any)
              .from('customer_documents')
              .select('id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,created_at')
              .eq('external_policy_id', next.id)
              .eq('customer_id', next.customer_id)
              .in('document_type', DOCUMENT_TYPES.map(([type]) => type))
              .order('created_at', { ascending: false });

      const [companyResult, detailsResult, documentsResult] = await Promise.all([
        companyQuery,
        detailsQuery,
        documentsQuery,
      ]);
      if (!active) return;
      setCompany(companyResult.data as InsuranceCompany | null);
      setDetails((detailsResult.data ?? null) as LifeHealthDetails | null);
      setDocuments((documentsResult.data ?? []) as PolicyDocument[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, router, source]);

  const documentByType = useMemo(() => {
    const map = new Map<string, PolicyDocument>();
    for (const document of documents) if (!map.has(document.document_type)) map.set(document.document_type, document);
    return map;
  }, [documents]);

  async function togglePolicyCopy(document: PolicyDocument) {
    if (policyCopyExpanded) {
      setPolicyCopyExpanded(false);
      setPolicyCopyUrl(null);
      return;
    }
    const signed = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 10 * 60);
    setPolicyCopyUrl(signed.data?.signedUrl ?? null);
    setPolicyCopyExpanded(true);
  }

  async function pickAndUploadPolicyCopy() {
    if (!policy || documentByType.has('policy_copy') || uploadingCopy) return;
    setUploadMessage('');
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    if (file.size && file.size > MAX_POLICY_COPY_SIZE_BYTES) {
      setUploadMessage('Policy copy must be 5 MB or smaller.');
      return;
    }
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    setUploadingCopy(true);
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const storagePath = `${policy.customer_id}/policy-copy/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    try {
      const body = await (await fetch(file.uri)).arrayBuffer();
      const uploaded = await supabase.storage.from('customer-documents').upload(storagePath, body, {
        contentType: file.mimeType ?? 'application/octet-stream',
        upsert: false,
      });
      if (uploaded.error) throw uploaded.error;
      const payload =
        policy.source === 'external'
          ? {
              customer_id: policy.customer_id,
              external_policy_id: policy.id,
              document_type: 'policy_copy',
              file_name: file.name,
              storage_bucket: 'customer-documents',
              storage_path: storagePath,
              mime_type: file.mimeType ?? null,
              file_size: file.size ?? null,
              uploaded_by: session.user.id,
            }
          : {
              policy_id: policy.id,
              document_type: 'policy_copy',
              file_name: file.name,
              storage_bucket: 'customer-documents',
              storage_path: storagePath,
              mime_type: file.mimeType ?? null,
              file_size: file.size ?? null,
            };
      const table = policy.source === 'external' ? 'customer_documents' : 'policy_documents';
      const recorded = await (supabase as any)
        .from(table)
        .insert(payload)
        .select('id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,created_at')
        .single();
      if (recorded.error) {
        await supabase.storage.from('customer-documents').remove([storagePath]);
        throw recorded.error;
      }
      setDocuments((current) => [recorded.data as PolicyDocument, ...current]);
    } catch (error) {
      console.warn('Customer Life/Health policy copy upload failed', error);
      setUploadMessage('Policy copy could not be uploaded. Please try again.');
    } finally {
      setUploadingCopy(false);
    }
  }

  if (loading) return <Screen title="Policy Detail"><LoadingState /></Screen>;
  if (!policy) return <Screen title="Policy Detail"><EmptyState title="Policy not found" body="Please choose another policy from your list." /></Screen>;

  const displayPolicyNumber = policy.source === 'external' ? formatExternalPolicyNumber(policy.policy_no) : policy.policy_no;
  const product = policy.policy_product?.trim() || formatPolicyType(policy.policy_type);
  const policyCopy = documentByType.get('policy_copy') ?? null;

  return (
    <Screen title="Policy details" subtitle={policy.policy_no} showLogout showTitleHeader={false}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>Policy details</Text>
      </View>

      <Card style={styles.detailSection}>
        <View style={styles.sectionRow}>
          <View style={styles.detailIcon}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color={palette.navy} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Policy details</Text>
            <Text style={styles.sectionHint}>Details stored for this {formatPolicyType(policy.policy_type).toLowerCase()} policy</Text>
          </View>
          <StatusPill label={compactPolicyStatusLabel(policy.end_date)} tone={policyStatusTone(policy.end_date)} />
        </View>

        <Text style={styles.detailGroupLabel}>Policy information</Text>
        <View style={styles.detailGrid}>
          <DetailCell icon="office-building-outline" label="Insurer" value={company?.name ?? null} logo={getInsurerLogoSource(company?.name)} />
          <DetailCell icon="shield-star-outline" label="Policy product" value={product} />
          <DetailCell icon="identifier" label="Policy number" value={displayPolicyNumber} />
          <DetailCell icon="file-sign" label="Proposal number" value={details?.proposal_number} />
        </View>

        <Text style={styles.detailGroupLabel}>Policy term & payment</Text>
        <View style={styles.detailGrid}>
          <DetailCell icon="calendar-clock-outline" label="PPT" value={details?.premium_paying_term} />
          <DetailCell icon="calendar-range" label="Policy duration / term" value={details?.policy_duration} />
          <DetailCell icon="repeat" label="Payment frequency" value={details?.payment_frequency} />
          <DetailCell icon="credit-card-outline" label="Payment mode" value={details?.payment_mode} />
        </View>

        <Text style={styles.detailGroupLabel}>Policy dates & premium</Text>
        <View style={styles.detailGrid}>
          <DetailCell icon="calendar-edit" label="Issuance date" value={formatDate(policy.issuance_date)} />
          <DetailCell icon="calendar-start" label="Policy start date" value={formatDate(policy.start_date)} />
          <DetailCell icon="calendar-end" label="Policy end / maturity date" value={formatDate(policy.end_date)} />
          <DetailCell icon="cash-check" label="Final premium" value={formatCurrency(policy.premium_amount)} />
        </View>

        <Text style={styles.detailGroupLabel}>Remarks / activity note</Text>
        <View style={styles.noteBox}>
          <MaterialCommunityIcons name="note-text-outline" size={17} color={palette.navy} />
          <Text style={styles.noteText}>{policy.remarks?.trim() || '-'}</Text>
        </View>

        <Text style={styles.detailGroupLabel}>Documents</Text>
        <View style={styles.documentList}>
          {DOCUMENT_TYPES.map(([type, label, icon]) => {
            const document = documentByType.get(type) ?? null;
            const isPolicyCopy = type === 'policy_copy';
            return (
              <View key={type}>
                <Pressable
                  accessibilityRole={isPolicyCopy ? 'button' : undefined}
                  accessibilityLabel={isPolicyCopy ? (document ? `${policyCopyExpanded ? 'Collapse' : 'Expand'} policy copy` : 'Upload policy copy') : undefined}
                  accessibilityState={isPolicyCopy && document ? { expanded: policyCopyExpanded } : undefined}
                  disabled={!isPolicyCopy || uploadingCopy}
                  onPress={() => {
                    if (!isPolicyCopy) return;
                    if (document) void togglePolicyCopy(document);
                    else void pickAndUploadPolicyCopy();
                  }}
                  style={({ pressed }) => [styles.documentRow, pressed && isPolicyCopy && styles.documentRowPressed]}
                >
                  <MaterialCommunityIcons name={icon} size={18} color={document ? palette.navy : '#7C8998'} />
                  <View style={styles.documentCopy}>
                    <Text style={styles.documentLabel}>{label}</Text>
                    <Text style={[styles.documentValue, !document && styles.documentValueMuted]} numberOfLines={1}>
                      {document?.file_name || 'Not uploaded'}
                    </Text>
                  </View>
                  {isPolicyCopy ? (
                    uploadingCopy ? <ActivityIndicator size="small" color={palette.navy} /> : (
                      <MaterialCommunityIcons name={document ? (policyCopyExpanded ? 'chevron-up' : 'chevron-down') : 'upload-outline'} size={21} color={palette.navy} />
                    )
                  ) : null}
                </Pressable>
                {isPolicyCopy && document && policyCopyExpanded ? (
                  <View style={styles.policyCopyPreviewShell}>
                    {policyCopyUrl && isImageDocument(document) ? (
                      <Image source={{ uri: policyCopyUrl }} resizeMode="contain" style={styles.policyCopyPreview} accessibilityLabel="Policy copy preview" />
                    ) : (
                      <View style={styles.previewUnavailable}>
                        <MaterialCommunityIcons name="file-document-outline" size={27} color="#7C8998" />
                        <Text style={styles.previewUnavailableText}>{policyCopyUrl ? 'Inline preview is not available for this file format.' : 'Policy copy preview unavailable'}</Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        {uploadMessage ? <Text style={styles.uploadMessage}>{uploadMessage}</Text> : null}
      </Card>
    </Screen>
  );
}

function DetailCell({ icon, label, value, logo }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string | null; logo?: any }) {
  return (
    <View style={styles.detailCell}>
      {logo ? <Image source={logo} resizeMode="contain" style={styles.detailCellLogo} /> : <MaterialCommunityIcons name={icon} size={17} color={palette.navy} />}
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={2}>{value || '-'}</Text>
      </View>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'orange' | 'red' }) {
  const config = tone === 'green' ? { bg: '#E8F8F0', text: '#12805C' } : tone === 'orange' ? { bg: '#FFF4E2', text: '#B7791F' } : { bg: '#FDECEC', text: '#C43838' };
  return <View style={[styles.statusPill, { backgroundColor: config.bg }]}><Text style={[styles.statusText, { color: config.text }]}>{label}</Text></View>;
}

function isLifeHealthPolicy(value?: string | null) {
  return /\b(life|health)\b/i.test(value?.trim() ?? '');
}

function formatPolicyType(value?: string | null) {
  const normalized = value?.trim() ?? '';
  if (/health/i.test(normalized)) return 'Health';
  if (/life/i.test(normalized)) return 'Life';
  return normalized || 'Policy';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(value?: number | null) {
  return value == null ? '-' : `INR ${Number(value).toLocaleString('en-IN')}`;
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function compactPolicyStatusLabel(value: string) {
  const days = daysUntil(value);
  if (days < 0) return `EXPIRED ${Math.abs(days)}d ago`;
  if (days <= 30) return `DUE IN ${days}d`;
  return 'ACTIVE';
}

function policyStatusTone(value: string): 'green' | 'orange' | 'red' {
  const days = daysUntil(value);
  return days < 0 ? 'red' : days <= 30 ? 'orange' : 'green';
}

function isImageDocument(document: PolicyDocument) {
  const mimeType = document.mime_type?.toLowerCase() ?? '';
  const fileName = document.file_name?.toLowerCase() ?? '';
  return mimeType.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/.test(fileName);
}

const styles = StyleSheet.create({
  pageHeaderRow: { marginBottom: 8 },
  pageTitle: { color: palette.navy, fontSize: 21, fontWeight: '900' },
  detailSection: { borderRadius: 22, padding: 16, gap: 0 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 12 },
  detailIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#EEF5FC', alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: palette.navy, fontSize: 17, fontWeight: '900' },
  sectionHint: { marginTop: 2, color: '#667589', fontSize: 12.5, fontWeight: '600' },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '900' },
  detailGroupLabel: { color: '#0A43A3', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 13, paddingBottom: 5 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  detailCell: { width: '50%', minHeight: 74, flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 13, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: '#E4EAF1' },
  detailCellLogo: { width: 19, height: 19 },
  detailCopy: { flex: 1, paddingRight: 7 },
  detailLabel: { color: '#6B7889', fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.25 },
  detailValue: { marginTop: 4, color: palette.navy, fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  noteBox: { minHeight: 54, flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E4EAF1' },
  noteText: { flex: 1, color: palette.navy, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  documentList: { borderTopWidth: 1, borderTopColor: '#E4EAF1' },
  documentRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E4EAF1', paddingVertical: 9, paddingHorizontal: 2 },
  documentRowPressed: { opacity: 0.72 },
  documentCopy: { flex: 1 },
  documentLabel: { color: '#6B7889', fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.25 },
  documentValue: { marginTop: 3, color: palette.navy, fontSize: 12.5, fontWeight: '800' },
  documentValueMuted: { color: '#8B97A6', fontWeight: '700' },
  policyCopyPreviewShell: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E4EAF1' },
  policyCopyPreview: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#F6F8FB' },
  previewUnavailable: { minHeight: 92, borderRadius: 12, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12 },
  previewUnavailableText: { color: '#708095', fontSize: 12, textAlign: 'center', fontWeight: '700' },
  uploadMessage: { marginTop: 8, color: '#C43838', fontSize: 12, fontWeight: '700' },
});
