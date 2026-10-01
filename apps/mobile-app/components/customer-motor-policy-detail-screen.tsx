import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getInsurerLogoSource, getVehicleBrandLogoSource } from '@/lib/catalog-logos';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { formatExternalPolicyNumber } from '@/lib/policy-number-display';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

const MAX_POLICY_COPY_SIZE_BYTES = 5 * 1024 * 1024;

type MotorPolicyRow = {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  insurance_company_id: string | null;
  policy_no: string;
  policy_type: string;
  policy_product?: string | null;
  start_date: string;
  end_date: string;
  issuance_date?: string | null;
  policy_term?: string | null;
  premium_amount?: number | null;
  insured_declared_value?: number | null;
  remarks?: string | null;
  source: 'sibl' | 'external';
};

type PremiumDetails = {
  od_premium: number | null;
  tp_premium: number | null;
  cpa_amount: number | null;
  net_premium: number | null;
  gst_amount: number | null;
  gross_premium: number | null;
};

type CustomerSummary = {
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
};

type PolicyCopyDocument = {
  id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

export default function CustomerMotorPolicyDetailScreen() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams<{ id: string; source?: 'sibl' | 'external' }>();
  const [policy, setPolicy] = useState<MotorPolicyRow | null>(null);
  const [company, setCompany] = useState<InsuranceCompany | null>(null);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [premiumDetails, setPremiumDetails] = useState<PremiumDetails | null>(null);
  const [policyCopy, setPolicyCopy] = useState<PolicyCopyDocument | null>(null);
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
      if (!next || !isMotorPolicy(next.policy_type)) {
        setLoading(false);
        return;
      }
      const nextPolicy = { ...next, source: nextSource } as MotorPolicyRow;
      setPolicy(nextPolicy);

      const companyQuery = next.insurance_company_id
        ? supabase.from('insurance_companies').select('*').eq('id', next.insurance_company_id).maybeSingle()
        : Promise.resolve({ data: null });
      const customerQuery = supabase
        .from('customers')
        .select('company_name,contact_name,phone')
        .eq('id', next.customer_id)
        .in('id', customerIds)
        .maybeSingle();
      const vehicleQuery = next.vehicle_id
        ? supabase.from('vehicles').select('*').eq('id', next.vehicle_id).in('customer_id', customerIds).maybeSingle()
        : Promise.resolve({ data: null });
      const premiumQuery =
        nextSource === 'sibl'
          ? (supabase as any)
              .from('policy_premium_details')
              .select('od_premium,tp_premium,cpa_amount,net_premium,gst_amount,gross_premium')
              .eq('policy_id', next.id)
              .maybeSingle()
          : Promise.resolve({ data: null });
      const documentQuery =
        nextSource === 'sibl'
          ? (supabase as any)
              .from('policy_documents')
              .select('id,file_name,storage_bucket,storage_path,mime_type,file_size,created_at')
              .eq('policy_id', next.id)
              .eq('document_type', 'policy_copy')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          : (supabase as any)
              .from('customer_documents')
              .select('id,file_name,storage_bucket,storage_path,mime_type,file_size,created_at')
              .eq('external_policy_id', next.id)
              .eq('customer_id', next.customer_id)
              .eq('document_type', 'policy_copy')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

      const [companyResult, customerResult, vehicleResult, premiumResult, documentResult] = await Promise.all([
        companyQuery,
        customerQuery,
        vehicleQuery,
        premiumQuery,
        documentQuery,
      ]);
      if (!active) return;
      setCompany(companyResult.data as InsuranceCompany | null);
      setCustomer(customerResult.data as CustomerSummary | null);
      setVehicle(vehicleResult.data as Vehicle | null);
      setPremiumDetails((premiumResult.data ?? null) as PremiumDetails | null);
      setPolicyCopy((documentResult.data ?? null) as PolicyCopyDocument | null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, router, source]);

  const status = useMemo(() => policyStatus(policy?.end_date), [policy?.end_date]);

  async function togglePolicyCopy() {
    if (!policyCopy) return;
    if (policyCopyExpanded) {
      setPolicyCopyExpanded(false);
      setPolicyCopyUrl(null);
      return;
    }
    const signed = await supabase.storage.from(policyCopy.storage_bucket).createSignedUrl(policyCopy.storage_path, 10 * 60);
    setPolicyCopyUrl(signed.data?.signedUrl ?? null);
    setPolicyCopyExpanded(true);
  }

  async function pickAndUploadPolicyCopy() {
    if (!policy || policyCopy || uploadingCopy) return;
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
        .select('id,file_name,storage_bucket,storage_path,mime_type,file_size,created_at')
        .single();
      if (recorded.error) {
        await supabase.storage.from('customer-documents').remove([storagePath]);
        throw recorded.error;
      }
      setPolicyCopy(recorded.data as PolicyCopyDocument);
    } catch (error) {
      console.warn('Customer Motor policy copy upload failed', error);
      setUploadMessage('Policy copy could not be uploaded. Please try again.');
    } finally {
      setUploadingCopy(false);
    }
  }

  if (loading) return <Screen title="Policy Detail"><LoadingState /></Screen>;
  if (!policy) return <Screen title="Policy Detail"><EmptyState title="Policy not found" body="Please choose another policy from your list." /></Screen>;

  const displayPolicyNumber = policy.source === 'external' ? formatExternalPolicyNumber(policy.policy_no) : policy.policy_no;
  const insuredName = customer?.company_name?.trim() || customer?.contact_name?.trim() || '-';
  const product = policy.policy_product?.trim() || formatPolicyProduct(policy.policy_type);

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
            <Text style={styles.sectionTitle}>Motor policy details</Text>
            <Text style={styles.sectionHint}>Details stored for this motor policy</Text>
          </View>
          <StatusPill label={status.label} tone={status.tone} />
        </View>

        <Text style={styles.detailGroupLabel}>Policy information</Text>
        <View style={styles.detailGrid}>
          <DetailCell icon="shield-outline" label="Policy product" value={product} />
          <DetailCell icon="office-building-outline" label="Insurance company" value={company?.name ?? '-'} logo={getInsurerLogoSource(company?.name)} />
          <DetailCell icon="file-document-outline" label="Policy number" value={displayPolicyNumber} />
          <DetailCell icon="cash-lock" label="IDV" value={formatCurrency(policy.insured_declared_value)} />
        </View>

        <Text style={styles.detailGroupLabel}>Premium breakup</Text>
        <View style={styles.detailGrid}>
          <DetailCell icon="cash" label="OD premium" value={formatCurrency(premiumDetails?.od_premium)} />
          <DetailCell icon="cash" label="TP premium" value={formatCurrency(premiumDetails?.tp_premium)} />
          <DetailCell icon="shield-outline" label="CPA amount" value={formatCurrency(premiumDetails?.cpa_amount)} />
          <DetailCell icon="calculator-variant-outline" label="Net premium" value={formatCurrency(premiumDetails?.net_premium)} />
          <DetailCell icon="percent-outline" label="GST" value={formatCurrency(premiumDetails?.gst_amount)} />
          <DetailCell icon="cash-check" label="Gross premium" value={formatCurrency(premiumDetails?.gross_premium ?? policy.premium_amount)} emphasis />
        </View>

        <Text style={styles.detailGroupLabel}>Policy validity</Text>
        <View style={styles.detailGrid}>
          <DetailCell icon="calendar-start" label="Policy start date" value={formatDate(policy.start_date)} />
          <DetailCell icon="calendar-end" label="Policy end date" value={formatDate(policy.end_date)} />
          <DetailCell icon="calendar-check-outline" label="Issuance date" value={formatDate(policy.issuance_date)} />
          <DetailCell icon="calendar-range-outline" label="Policy term" value={policy.policy_term || '-'} />
        </View>

        <Text style={styles.detailGroupLabel}>Insured details</Text>
        <View style={styles.detailGrid}>
          <DetailCell icon="account-outline" label="Insured name" value={insuredName} />
          <DetailCell icon="phone-outline" label="Phone number" value={customer?.phone || '-'} />
        </View>

        <Text style={styles.detailGroupLabel}>Remarks / activity note</Text>
        <View style={styles.noteBox}>
          <MaterialCommunityIcons name="note-text-outline" size={16} color={palette.navy} />
          <Text style={styles.noteText}>{policy.remarks?.trim() || '-'}</Text>
        </View>
      </Card>

      <Card style={styles.documentsCard}>
        <Text style={styles.detailGroupLabel}>Documents</Text>
        {policyCopy ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={policyCopyExpanded ? 'Collapse policy copy' : 'Expand policy copy'}
              accessibilityState={{ expanded: policyCopyExpanded }}
              onPress={() => void togglePolicyCopy()}
              style={({ pressed }) => [styles.documentRow, pressed && styles.pressed]}
            >
              <View style={styles.documentIcon}><MaterialCommunityIcons name="file-document-check-outline" size={22} color="#0A43A3" /></View>
              <View style={styles.documentCopy}>
                <Text style={styles.documentTitle}>Policy copy</Text>
                <Text style={styles.documentName} numberOfLines={1}>{policyCopy.file_name || 'Policy document'}</Text>
                <Text style={styles.documentMeta}>{formatFileSize(policyCopy.file_size)}</Text>
              </View>
              <MaterialCommunityIcons name={policyCopyExpanded ? 'chevron-up' : 'chevron-down'} size={22} color="#38506C" />
            </Pressable>
            {policyCopyExpanded ? (
              policyCopyUrl && isImagePolicyCopy(policyCopy) ? (
                <Image source={{ uri: policyCopyUrl }} resizeMode="contain" style={styles.policyCopyPreview} accessibilityLabel="Policy copy preview" />
              ) : (
                <View style={styles.previewUnavailable}>
                  <MaterialCommunityIcons name="file-document-outline" size={27} color="#78879A" />
                  <Text style={styles.previewText}>{policyCopyUrl ? 'Inline preview is not available for this file format.' : 'Policy copy preview unavailable'}</Text>
                </View>
              )
            ) : null}
          </>
        ) : (
          <Pressable disabled={uploadingCopy} onPress={() => void pickAndUploadPolicyCopy()} style={({ pressed }) => [styles.documentRow, pressed && styles.pressed]}>
            <View style={styles.documentIcon}><MaterialCommunityIcons name="file-upload-outline" size={22} color="#0A43A3" /></View>
            <View style={styles.documentCopy}>
              <Text style={styles.documentTitle}>Policy copy</Text>
              <Text style={styles.documentName}>{uploadingCopy ? 'Uploading policy copy...' : 'Policy copy not uploaded'}</Text>
            </View>
            {uploadingCopy ? <ActivityIndicator size="small" color="#0A43A3" /> : <MaterialCommunityIcons name="upload-outline" size={22} color="#0A43A3" />}
          </Pressable>
        )}
        {uploadMessage ? <Text style={styles.uploadMessage}>{uploadMessage}</Text> : null}
      </Card>

      {vehicle ? (
        <Pressable onPress={() => router.push({ pathname: '/customer/vehicle-detail', params: { id: vehicle.id } } as any)} style={styles.vehicleCard}>
          <View style={styles.vehicleLogoShell}>
            <Image source={getVehicleBrandLogoSource(vehicle.make) ?? undefined} resizeMode="contain" style={styles.vehicleLogo} />
          </View>
          <View style={styles.vehicleCopy}>
            <Text style={styles.vehicleLabel}>Linked vehicle</Text>
            <Text style={styles.vehicleValue}>{vehicle.vehicle_no || '-'}</Text>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={21} color={palette.navy} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

function DetailCell({ icon, label, value, logo, emphasis = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string | null; logo?: any; emphasis?: boolean }) {
  return (
    <View style={styles.detailCell}>
      {logo ? <Image source={logo} resizeMode="contain" style={styles.detailLogo} /> : <MaterialCommunityIcons name={icon} size={16} color={palette.navy} />}
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, emphasis && styles.detailValueEmphasis]} numberOfLines={3}>{value || '-'}</Text>
      </View>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' }) {
  const colors = tone === 'success' ? { bg: '#E8F8F0', text: '#12805C' } : tone === 'warning' ? { bg: '#FFF4E2', text: '#B7791F' } : { bg: '#FDECEC', text: '#C43838' };
  return <View style={[styles.statusPill, { backgroundColor: colors.bg }]}><Text style={[styles.statusText, { color: colors.text }]}>{label}</Text></View>;
}

function isMotorPolicy(value?: string | null) {
  const normalized = value?.trim() ?? '';
  return /\bmotor\b/i.test(normalized) || /package|comprehensive|standalone|third.?party|own.?damage/i.test(normalized);
}

function formatPolicyProduct(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return 'Motor Insurance';
  if (/package/i.test(normalized)) return 'Package';
  return normalized;
}

function policyStatus(endDate?: string | null) {
  if (!endDate) return { label: 'ACTIVE', tone: 'success' as const };
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'EXPIRED', tone: 'danger' as const };
  if (days <= 30) return { label: `DUE IN ${days}d`, tone: 'warning' as const };
  return { label: 'ACTIVE', tone: 'success' as const };
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

function formatCurrency(value?: number | null) {
  return value == null ? '-' : `INR ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) return 'Policy document';
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}

function isImagePolicyCopy(document: PolicyCopyDocument) {
  const mimeType = document.mime_type?.toLowerCase() ?? '';
  const fileName = document.file_name?.toLowerCase() ?? '';
  return mimeType.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/.test(fileName);
}

const styles = StyleSheet.create({
  pageHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  pageTitle: { color: palette.navy, fontSize: 21, fontWeight: '900' },
  detailSection: { borderRadius: 22, borderWidth: 1, borderColor: '#DCE6F1', padding: 16, backgroundColor: '#FFFFFF' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  detailIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EEF4FB', alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: palette.navy, fontSize: 17, fontWeight: '900' },
  sectionHint: { color: '#6D7B8F', fontSize: 12, marginTop: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 10, fontWeight: '900' },
  detailGroupLabel: { color: '#0A4A92', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.55, marginTop: 6, marginBottom: 4 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  detailCell: { width: '50%', minHeight: 76, flexDirection: 'row', gap: 9, paddingVertical: 13, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: '#E4EAF1' },
  detailCopy: { flex: 1 },
  detailLabel: { color: '#718096', fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  detailValue: { color: '#102445', fontSize: 13.5, fontWeight: '800', marginTop: 4 },
  detailValueEmphasis: { color: '#254DDB' },
  detailLogo: { width: 18, height: 18 },
  noteBox: { minHeight: 54, flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E4EAF1' },
  noteText: { flex: 1, color: '#102445', fontSize: 13.5, fontWeight: '700', lineHeight: 19 },
  documentsCard: { marginTop: 14, borderRadius: 22, borderWidth: 1, borderColor: '#DCE6F1', padding: 14, backgroundColor: '#FFFFFF' },
  documentRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  pressed: { opacity: 0.72 },
  documentIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EEF4FB', alignItems: 'center', justifyContent: 'center' },
  documentCopy: { flex: 1 },
  documentTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  documentName: { color: '#43536B', fontSize: 12, fontWeight: '700', marginTop: 3 },
  documentMeta: { color: '#8793A4', fontSize: 10.5, marginTop: 2 },
  policyCopyPreview: { width: '100%', height: 320, borderRadius: 14, backgroundColor: '#F7F9FC', marginTop: 8 },
  previewUnavailable: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#F7F9FC', borderRadius: 14, marginTop: 8, padding: 14 },
  previewText: { color: '#78879A', fontSize: 12, textAlign: 'center' },
  uploadMessage: { color: '#C43838', fontSize: 12, marginTop: 6 },
  vehicleCard: { marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: '#DCE6F1', backgroundColor: '#FFFFFF', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  vehicleLogoShell: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F2F6FB', alignItems: 'center', justifyContent: 'center' },
  vehicleLogo: { width: 30, height: 30 },
  vehicleCopy: { flex: 1 },
  vehicleLabel: { color: '#718096', fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  vehicleValue: { color: palette.navy, fontSize: 14, fontWeight: '900', marginTop: 3 },
});
