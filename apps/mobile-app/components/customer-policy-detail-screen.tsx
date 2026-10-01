import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getInsurerLogoSource, getVehicleBrandLogoSource } from '@/lib/catalog-logos';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { formatExternalPolicyNumber } from '@/lib/policy-number-display';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

const policyDetailIcons = {
  policy: require('../assets/custom-icons/policy-detail/policy-booked.png'),
  insurer: require('../assets/custom-icons/policy-detail/insurer.png'),
  renewal: require('../assets/custom-icons/policy-detail/renewal.png'),
  premium: require('../assets/custom-icons/policy-detail/premium.png'),
  vehicle: require('../assets/custom-icons/policy-detail/linked-vehicle.png'),
} satisfies Record<string, ImageSourcePropType>;

const MAX_POLICY_COPY_SIZE_BYTES = 5 * 1024 * 1024;

type PolicyPremiumDetails = {
  od_premium: number | null;
  tp_premium: number | null;
  cpa_amount: number | null;
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

type PolicyDisplay = {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  insurance_company_id: string | null;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium_amount?: number | null;
  insured_declared_value?: number | null;
  source: 'sibl' | 'external';
};

export default function CustomerPolicyDetailScreen() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams<{ id: string; source?: 'sibl' | 'external' }>();
  const [policy, setPolicy] = useState<PolicyDisplay | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [company, setCompany] = useState<InsuranceCompany | null>(null);
  const [premiumDetails, setPremiumDetails] = useState<PolicyPremiumDetails | null>(null);
  const [policyCopy, setPolicyCopy] = useState<PolicyCopyDocument | null>(null);
  const [policyCopyUrl, setPolicyCopyUrl] = useState<string | null>(null);
  const [policyCopyAspectRatio, setPolicyCopyAspectRatio] = useState<number | null>(null);
  const [policyCopyExpanded, setPolicyCopyExpanded] = useState(false);
  const [uploadingCopy, setUploadingCopy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function applyPolicyCopy(document: PolicyCopyDocument | null) {
    setPolicyCopy(document);
    setPolicyCopyUrl(null);
    setPolicyCopyAspectRatio(null);
    setPolicyCopyExpanded(false);
    if (!document?.storage_bucket || !document.storage_path) return;

    const signed = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 10 * 60);
    if (signed.error) return;
    const url = signed.data?.signedUrl ?? null;
    setPolicyCopyUrl(url);
    if (url && isImagePolicyCopy(document)) {
      Image.getSize(
        url,
        (width, height) => {
          if (width > 0 && height > 0) setPolicyCopyAspectRatio(width / height);
        },
        () => undefined,
      );
    }
  }

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
      if (next) setPolicy({ ...next, source: nextSource });

      if (next) {
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

        const vehicleQuery = next.vehicle_id
          ? supabase.from('vehicles').select('*').eq('id', next.vehicle_id).in('customer_id', customerIds).maybeSingle()
          : Promise.resolve({ data: null });
        const companyQuery = next.insurance_company_id
          ? supabase.from('insurance_companies').select('*').eq('id', next.insurance_company_id).maybeSingle()
          : Promise.resolve({ data: null });
        const premiumQuery =
          nextSource === 'sibl'
            ? (supabase as any)
                .from('policy_premium_details')
                .select('od_premium,tp_premium,cpa_amount')
                .eq('policy_id', next.id)
                .maybeSingle()
            : Promise.resolve({ data: null });

        const [vehicleResult, companyResult, premiumResult, documentResult] = await Promise.all([
          vehicleQuery,
          companyQuery,
          premiumQuery,
          documentQuery,
        ]);
        if (!active) return;
        setVehicle(vehicleResult.data as Vehicle | null);
        setCompany(companyResult.data as InsuranceCompany | null);
        setPremiumDetails((premiumResult.data ?? null) as PolicyPremiumDetails | null);
        await applyPolicyCopy((documentResult.data ?? null) as PolicyCopyDocument | null);
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [id, router, source]);

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
      await applyPolicyCopy(recorded.data as PolicyCopyDocument);
    } catch (error) {
      console.warn('Customer policy copy upload failed', error);
      setUploadMessage('Policy copy could not be uploaded. Please try again.');
    } finally {
      setUploadingCopy(false);
    }
  }

  const renewalState = useMemo(() => {
    if (!policy) return { action: false, tone: 'neutral' as const };
    const days = Math.ceil((new Date(policy.end_date).getTime() - Date.now()) / 86400000);
    if (days < 0) return { action: true, tone: 'danger' as const };
    if (days <= 30) return { action: true, tone: 'warning' as const };
    return { action: false, tone: 'success' as const };
  }, [policy]);

  if (loading) {
    return (
      <Screen title="Policy Detail">
        <LoadingState />
      </Screen>
    );
  }
  if (!policy) {
    return (
      <Screen title="Policy Detail">
        <EmptyState title="Policy not found" body="Please choose another policy from your list." />
      </Screen>
    );
  }

  const healthPolicy = isHealthPolicy(policy.policy_type);
  const displayPolicyNumber =
    policy.source === 'external' ? formatExternalPolicyNumber(policy.policy_no) : policy.policy_no;

  return (
    <Screen
      title="Policy details"
      subtitle={vehicle?.vehicle_no ?? policy.policy_no}
      showLogout
      showTitleHeader={false}
    >
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>Policy details</Text>
        {renewalState.action ? (
          <Pressable
            onPress={() =>
              router.push(
                policy.vehicle_id
                  ? { pathname: '/customer/add-policy', params: { vehicleId: policy.vehicle_id } }
                  : '/customer/add-policy',
              )
            }
            style={styles.pageRenewAction}
          >
            <MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" />
            <Text style={styles.pageRenewActionText}>Add renewed policy</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.contentStack}>
        <View style={[styles.heroLayout, healthPolicy && styles.healthHeroLayout]}>
          <View style={[styles.heroAccent, { backgroundColor: renewalTone(renewalState.tone) }]} />
          <View style={styles.heroTop}>
            <Text style={styles.policyNo} numberOfLines={1}>
              {displayPolicyNumber}
            </Text>
            <StatusBadge state={renewalState.tone} label={compactPolicyStatusLabel(policy.end_date)} />
          </View>

          <View style={styles.heroMetaRow}>
            <HeroMetric
              image={getInsurerLogoSource(company?.name) ?? policyDetailIcons.insurer}
              label="Insurer"
              value={company?.name ?? 'Insurer pending'}
            />
            <HeroMetric
              image={policyDetailIcons.policy}
              label="Policy product"
              value={formatPolicyType(policy.policy_type)}
            />
          </View>

          {healthPolicy ? (
            <>
              <View style={styles.heroMetaRow}>
                <SimpleMetric
                  image={policyDetailIcons.renewal}
                  label="Start date"
                  value={formatDate(policy.start_date)}
                />
                <SimpleMetric
                  image={policyDetailIcons.renewal}
                  label="End date"
                  value={formatDate(policy.end_date)}
                />
              </View>
              <View style={styles.healthPremiumRow}>
                <SimpleMetric
                  image={policyDetailIcons.premium}
                  label="Premium"
                  value={formatCurrency(policy.premium_amount)}
                  fullWidth
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.heroMetaRow}>
                <DateFinancialMetric
                  dateLabel="Start date"
                  dateValue={formatDate(policy.start_date)}
                  financialLabel="Premium"
                  financialValue={formatCurrency(policy.premium_amount)}
                />
                <DateFinancialMetric
                  dateLabel="End date"
                  dateValue={formatDate(policy.end_date)}
                  financialLabel="IDV"
                  financialValue={formatCurrency(policy.insured_declared_value)}
                />
              </View>
              <View style={styles.heroMetaRow}>
                <HeroMetric
                  image={policyDetailIcons.premium}
                  label="OD Premium"
                  value={formatCurrency(premiumDetails?.od_premium)}
                />
                <HeroMetric
                  image={policyDetailIcons.premium}
                  label="TP Premium"
                  value={formatCurrency(premiumDetails?.tp_premium)}
                />
              </View>
              <View style={styles.heroMetaRow}>
                <HeroMetric
                  image={policyDetailIcons.premium}
                  label="CPA Amount"
                  value={formatCurrency(premiumDetails?.cpa_amount)}
                />
              </View>
            </>
          )}
        </View>

        {policyCopy ? (
          <View style={styles.policyCopyCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={policyCopyExpanded ? 'Collapse policy copy' : 'Expand policy copy'}
              accessibilityState={{ expanded: policyCopyExpanded }}
              onPress={() => setPolicyCopyExpanded((expanded) => !expanded)}
              style={({ pressed }) => [styles.policyCopyHeader, pressed && styles.policyCopyHeaderPressed]}
            >
              <View style={styles.policyCopyIcon}>
                <MaterialCommunityIcons name="file-document-check-outline" size={25} color="#0A43A3" />
              </View>
              <View style={styles.policyCopyContent}>
                <Text style={styles.policyCopyTitle}>Policy copy</Text>
                <Text style={styles.policyCopyFileName} numberOfLines={1}>
                  {policyCopy.file_name || 'Policy document'}
                </Text>
                <Text style={styles.policyCopyMeta}>{formatFileSize(policyCopy.file_size)}</Text>
              </View>
              <MaterialCommunityIcons
                name={policyCopyExpanded ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#38506C"
              />
            </Pressable>

            {policyCopyExpanded ? (
              policyCopyUrl && isImagePolicyCopy(policyCopy) ? (
                <Image
                  source={{ uri: policyCopyUrl }}
                  resizeMode="contain"
                  style={[
                    styles.policyCopyPreview,
                    policyCopyAspectRatio
                      ? { aspectRatio: policyCopyAspectRatio }
                      : styles.policyCopyPreviewFallback,
                  ]}
                  accessibilityLabel="Policy copy preview"
                />
              ) : (
                <View style={styles.policyCopyPreviewUnavailable}>
                  <MaterialCommunityIcons name="file-document-outline" size={28} color="#78879A" />
                  <Text style={styles.policyCopyMissing}>
                    {policyCopyUrl
                      ? 'Inline preview is not available for this file format.'
                      : 'Policy copy preview unavailable'}
                  </Text>
                </View>
              )
            ) : null}
          </View>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upload policy copy"
              disabled={uploadingCopy}
              onPress={() => void pickAndUploadPolicyCopy()}
              style={({ pressed }) => [
                styles.policyCopyMissingCard,
                pressed && styles.policyCopyMissingCardPressed,
              ]}
            >
              <View style={styles.policyCopyIconMuted}>
                <MaterialCommunityIcons name="file-document-outline" size={25} color="#78879A" />
              </View>
              <View style={styles.policyCopyContent}>
                <Text style={styles.policyCopyTitle}>Policy copy</Text>
                <Text style={styles.policyCopyMissingLeft}>
                  {uploadingCopy ? 'Uploading policy copy...' : 'Policy copy not uploaded'}
                </Text>
              </View>
              {uploadingCopy ? (
                <ActivityIndicator size="small" color="#0A43A3" />
              ) : (
                <View style={styles.policyCopyUploadIcon}>
                  <MaterialCommunityIcons name="upload-outline" size={22} color="#0A43A3" />
                </View>
              )}
            </Pressable>
            {uploadMessage ? <Text style={styles.uploadMessage}>{uploadMessage}</Text> : null}
          </>
        )}

        {vehicle ? (
          <Pressable
            onPress={() => router.push({ pathname: '/customer/vehicle-detail', params: { id: vehicle.id } } as any)}
            style={styles.vehicleCard}
          >
            <View style={styles.vehicleBrandIcon}>
              <Image
                source={getVehicleBrandLogoSource(vehicle.make) ?? policyDetailIcons.vehicle}
                resizeMode="contain"
                style={styles.vehicleBrandIconImage}
              />
            </View>
            <View style={styles.vehicleSummaryCopy}>
              <Text style={styles.vehicleSummaryTitle}>Linked vehicle</Text>
              <Text style={styles.vehicleSummaryNumber}>{vehicle.vehicle_no || '-'}</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={22} color={palette.navy} />
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function StatusBadge({
  state,
  label,
}: {
  state: 'success' | 'warning' | 'danger' | 'neutral';
  label: string;
}) {
  const colors = {
    success: { text: '#0F8A61', background: '#EAF8F2' },
    warning: { text: '#B7791F', background: '#FFF6E8' },
    danger: { text: '#D7262E', background: '#FFF0F0' },
    neutral: { text: '#64748B', background: '#F1F5F9' },
  }[state];
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
      <Text style={[styles.statusText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function HeroMetric({ image, label, value }: { image: ImageSourcePropType; label: string; value: string }) {
  return (
    <View style={styles.heroMetric}>
      <Image source={image} resizeMode="contain" style={styles.heroMetricIconImage} />
      <View style={styles.heroMetricCopy}>
        <Text style={styles.heroMetricLabel}>{label}</Text>
        <Text style={styles.heroMetricValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SimpleMetric({
  image,
  label,
  value,
  fullWidth = false,
}: {
  image: ImageSourcePropType;
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <View style={[styles.simpleMetric, fullWidth && styles.simpleMetricFull]}>
      <Image source={image} resizeMode="contain" style={styles.heroMetricIconImage} />
      <View style={styles.heroMetricCopy}>
        <Text style={styles.heroMetricLabel}>{label}</Text>
        <Text style={styles.heroMetricValue}>{value}</Text>
      </View>
    </View>
  );
}

function DateFinancialMetric({
  dateLabel,
  dateValue,
  financialLabel,
  financialValue,
}: {
  dateLabel: string;
  dateValue: string;
  financialLabel: string;
  financialValue: string;
}) {
  return (
    <View style={styles.dateFinancialMetric}>
      <View style={styles.dateFinancialRow}>
        <Image source={policyDetailIcons.renewal} style={styles.dateFinancialIcon} />
        <View>
          <Text style={styles.heroMetricLabel}>{dateLabel}</Text>
          <Text style={styles.dateFinancialValue}>{dateValue}</Text>
        </View>
      </View>
      <View style={styles.dateFinancialDivider} />
      <View style={styles.dateFinancialRow}>
        <Image source={policyDetailIcons.premium} style={styles.dateFinancialIcon} />
        <View>
          <Text style={styles.heroMetricLabel}>{financialLabel}</Text>
          <Text style={styles.dateFinancialValue}>{financialValue}</Text>
        </View>
      </View>
    </View>
  );
}

function isImagePolicyCopy(document: PolicyCopyDocument) {
  const mimeType = document.mime_type?.toLowerCase() ?? '';
  const fileName = document.file_name?.toLowerCase() ?? '';
  return mimeType.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/.test(fileName);
}

function isHealthPolicy(value?: string | null) {
  return /health/i.test(value?.trim() ?? '');
}

function formatPolicyType(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return 'Policy';
  if (/health/i.test(normalized)) return 'Health';
  if (/motor/i.test(normalized)) return 'Motor Insurance';
  if (/package/i.test(normalized)) return 'Package Insurance';
  return normalized;
}

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-';
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

function formatCurrency(value?: number | null) {
  return value == null ? '-' : `INR ${Number(value).toLocaleString('en-IN')}`;
}

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) return 'Policy document';
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}

function renewalTone(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return '#12805C';
  if (tone === 'warning') return '#B7791F';
  if (tone === 'danger') return '#C43838';
  return '#64748B';
}

const styles = StyleSheet.create({
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  pageTitle: { color: palette.navy, fontSize: 21, fontWeight: '900' },
  pageRenewAction: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: palette.navy,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageRenewActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  contentStack: { gap: 14, paddingBottom: 16 },
  heroLayout: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE6F1',
    backgroundColor: '#FFFFFF',
    padding: 14,
    paddingLeft: 17,
    gap: 10,
  },
  healthHeroLayout: { gap: 9 },
  heroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  policyNo: { flex: 1, color: palette.navy, fontSize: 18, fontWeight: '900' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 10, fontWeight: '900' },
  heroMetaRow: { flexDirection: 'row', gap: 9 },
  heroMetric: {
    flex: 1,
    minHeight: 66,
    borderRadius: 14,
    backgroundColor: '#F7FAFE',
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  simpleMetric: {
    flex: 1,
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: '#F7FAFE',
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  simpleMetricFull: { flex: 1 },
  healthPremiumRow: { flexDirection: 'row' },
  heroMetricIconImage: { width: 28, height: 28 },
  heroMetricCopy: { flex: 1, minWidth: 0 },
  heroMetricLabel: { color: '#728196', fontSize: 10, fontWeight: '700', marginBottom: 3 },
  heroMetricValue: { color: palette.navy, fontSize: 12, fontWeight: '800' },
  dateFinancialMetric: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#F7FAFE',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  dateFinancialRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateFinancialIcon: { width: 23, height: 23, resizeMode: 'contain' },
  dateFinancialValue: { color: palette.navy, fontSize: 11, fontWeight: '800' },
  dateFinancialDivider: { height: 1, backgroundColor: '#E2E9F1' },
  policyCopyCard: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE6F1',
    backgroundColor: '#FFFFFF',
  },
  policyCopyHeader: {
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  policyCopyHeaderPressed: { backgroundColor: '#F8FBFF' },
  policyCopyIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EDF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyCopyIconMuted: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyCopyContent: { flex: 1, minWidth: 0 },
  policyCopyTitle: { color: palette.navy, fontSize: 13, fontWeight: '900' },
  policyCopyFileName: { color: '#40516A', fontSize: 11, fontWeight: '600', marginTop: 3 },
  policyCopyMeta: { color: '#8A97A7', fontSize: 10, marginTop: 3 },
  policyCopyPreview: {
    width: '100%',
    maxHeight: 520,
    borderTopWidth: 1,
    borderTopColor: '#E7EDF4',
    backgroundColor: '#F7F9FC',
  },
  policyCopyPreviewFallback: { height: 360 },
  policyCopyPreviewUnavailable: {
    minHeight: 140,
    borderTopWidth: 1,
    borderTopColor: '#E7EDF4',
    backgroundColor: '#F7F9FC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
  },
  policyCopyMissing: { color: '#78879A', fontSize: 11, textAlign: 'center' },
  policyCopyMissingCard: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE6F1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  policyCopyMissingCardPressed: { backgroundColor: '#F8FBFF' },
  policyCopyMissingLeft: { color: '#78879A', fontSize: 11, marginTop: 3 },
  policyCopyUploadIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadMessage: { marginTop: -6, color: '#C43838', fontSize: 11, fontWeight: '600' },
  vehicleCard: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE6F1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  vehicleBrandIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F4F7FB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  vehicleBrandIconImage: { width: '100%', height: '100%' },
  vehicleSummaryCopy: { flex: 1 },
  vehicleSummaryTitle: { color: '#718096', fontSize: 10, fontWeight: '700' },
  vehicleSummaryNumber: { color: palette.navy, fontSize: 13, fontWeight: '900', marginTop: 3 },
});
