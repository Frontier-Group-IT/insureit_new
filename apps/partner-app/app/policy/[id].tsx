import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { getPartnerPolicyDetail, type PartnerPolicyDetail } from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';

export default function PolicyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PartnerPolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerPolicyDetail(id));
    } catch {
      setError('This policy could not be loaded in your Partner scope.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const category = data ? policyCategory(data) : 'Policy';

  return (
    <PartnerScreen
      eyebrow="POLICY"
      title={data?.policy.policy_no || data?.policy.policy_code || 'Policy'}
      action={<PartnerIconButton icon="close" label="Close policy detail" onPress={() => router.back()} />}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading policy" />
      ) : error || !data ? (
        <PartnerStateView
          state="error"
          title="Policy unavailable"
          message={error || 'This policy could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name={category === 'Motor' ? 'car-outline' : category === 'Health' ? 'medkit-outline' : category === 'Life' ? 'heart-outline' : 'business-outline'} size={22} color="#FFFFFF" />
              </View>
              <View style={styles.heroBody}>
                <Text style={styles.heroNo}>{data.policy.policy_no || data.policy.policy_code || 'Policy'}</Text>
                <Text style={styles.heroInsurer}>{data.insurer.name || 'Insurer not recorded'}</Text>
              </View>
              <View style={styles.heroBadges}>
                <PartnerStatusBadge label={category} tone="brand" />
                <PartnerStatusBadge label={humanize(data.policy.lifecycle_status)} tone={lifecycleTone(data.policy.lifecycle_status)} />
              </View>
            </View>

            <View style={styles.heroPremiumRow}>
              <View>
                <Text style={styles.heroPremium}>{formatMoney(data.premium.gross_premium)}</Text>
                <Text style={styles.heroPremiumLabel}>gross premium</Text>
              </View>
              <View style={styles.heroDateBlock}>
                <Text style={styles.heroDate}>{formatDate(data.policy.start_date)} → {formatDate(data.policy.end_date)}</Text>
                <Text style={styles.heroDateLabel}>{data.policy.business_type || data.policy.policy_product || data.policy.policy_type || 'Policy term'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickRow}>
            {data.customer.id ? (
              <QuickAction icon="person-outline" label="Customer" onPress={() => router.push(`/customer/${data.customer.id}` as never)} />
            ) : null}
            <QuickAction icon="refresh-outline" label="Renewals" onPress={() => router.push('/renewals')} />
            <QuickAction icon="cloud-upload-outline" label="Intakes" onPress={() => router.push('/policy-intakes')} />
          </View>

          <PartnerSectionHeader title="Policy overview" />
          <InfoCard>
            <Info label="Category" value={category} />
            <Info label="Product" value={data.policy.policy_product || data.policy.policy_type || data.policy.business_line || 'Not recorded'} />
            <Info label="Business type" value={data.policy.business_type || 'Not recorded'} />
            <Info label="Issuance" value={formatDate(data.policy.issuance_date)} />
            <Info label="Status" value={humanize(data.policy.status || data.policy.lifecycle_status)} />
            <Info label="IDV" value={data.policy.insured_declared_value != null ? formatMoney(data.policy.insured_declared_value) : 'Not recorded'} />
          </InfoCard>

          <PartnerSectionHeader title="Premium breakup" />
          <InfoCard>
            <Info label="Gross premium" value={formatMoney(data.premium.gross_premium)} />
            <Info label="Net premium" value={nullableMoney(data.premium.net_premium)} />
            <Info label="OD premium" value={nullableMoney(data.premium.od_premium)} />
            <Info label="TP premium" value={nullableMoney(data.premium.tp_premium)} />
            <Info label="GST" value={nullableMoney(data.premium.gst_amount)} />
            <Info label="CPA" value={data.premium.cpa_opted ? nullableMoney(data.premium.cpa_amount) : 'Not opted / not recorded'} />
          </InfoCard>

          <PartnerSectionHeader title={data.vehicle ? 'Customer & vehicle' : 'Customer & insured risk'} />
          <View style={styles.entityStack}>
            <Pressable
              accessibilityRole={data.customer.id ? 'button' : undefined}
              disabled={!data.customer.id}
              onPress={() => data.customer.id ? router.push(`/customer/${data.customer.id}` as never) : undefined}
              style={({ pressed }) => [styles.entity, pressed && data.customer.id ? styles.pressed : null]}
            >
              <View style={styles.entityIcon}><Ionicons name="person-outline" size={19} color={partnerTheme.colors.brand} /></View>
              <View style={styles.entityBody}>
                <Text style={styles.entityTitle}>{data.customer.name}</Text>
                <Text style={styles.entityMeta}>{data.customer.customer_code || 'Customer'}</Text>
              </View>
              {data.customer.id ? <Ionicons name="chevron-forward" size={16} color="#9AA3B2" /> : null}
            </Pressable>

            {data.vehicle ? (
              <View style={styles.entity}>
                <View style={styles.entityIcon}><Ionicons name="car-outline" size={19} color={partnerTheme.colors.accent} /></View>
                <View style={styles.entityBody}>
                  <Text style={styles.entityTitle}>{data.vehicle.vehicle_no || 'Vehicle'}</Text>
                  <Text style={styles.entityMeta}>{[data.vehicle.make, data.vehicle.model, data.vehicle.year].filter(Boolean).join(' · ') || humanize(data.vehicle.vehicle_type || 'vehicle')}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.entity}>
                <View style={styles.entityIcon}><Ionicons name="business-outline" size={19} color={partnerTheme.colors.accent} /></View>
                <View style={styles.entityBody}>
                  <Text style={styles.entityTitle}>{data.policy.policy_product || data.policy.policy_type || data.policy.business_line || 'Non-motor insured risk'}</Text>
                  <Text style={styles.entityMeta}>No vehicle is linked to this policy.</Text>
                </View>
              </View>
            )}
          </View>

          <PartnerSectionHeader title="Commercial attribution" />
          <InfoCard>
            <Info label="Intermediary" value={[humanize(data.commercial.intermediary_type || ''), data.commercial.intermediary_code].filter(Boolean).join(' · ') || 'Not recorded'} />
            <Info label="RM" value={data.commercial.rm_name || 'Not recorded'} />
            <Info label="Group" value={[data.commercial.group_name, data.commercial.group_code].filter(Boolean).join(' · ') || 'No policy snapshot'} />
            <Info label="Policy lifecycle" value={humanize(data.policy.lifecycle_status)} />
          </InfoCard>
        </>
      )}
    </PartnerScreen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: 'person-outline' | 'refresh-outline' | 'cloud-upload-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={partnerTheme.colors.brand} />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function InfoCard({ children }: { children: ReactNode }) {
  return <View style={styles.infoCard}>{children}</View>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function policyCategory(data: PartnerPolicyDetail) {
  const value = [data.policy.policy_type, data.policy.policy_product, data.policy.business_line].filter(Boolean).join(' ').toLowerCase();
  if (value.includes('health')) return 'Health';
  if (value.includes('life')) return 'Life';
  if (value.includes('motor') || data.vehicle) return 'Motor';
  return 'Non-Motor';
}

function lifecycleTone(value: PartnerPolicyDetail['policy']['lifecycle_status']): 'success' | 'warning' | 'danger' | 'info' {
  if (value === 'expired') return 'danger';
  if (value === 'expiring') return 'warning';
  if (value === 'upcoming') return 'info';
  return 'success';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(d);
}

function formatMoney(value: number | string | null) {
  const n = Number(value ?? 0);
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)}`;
}

function nullableMoney(value: number | string | null) {
  return value == null ? 'Not recorded' : formatMoney(value);
}

const styles = StyleSheet.create({
  hero: { borderRadius: partnerTheme.radius.xl, padding: 18, backgroundColor: partnerTheme.colors.nav },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  heroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#343D52' },
  heroBody: { flex: 1 },
  heroNo: { color: '#FFFFFF', ...partnerTheme.typography.sectionTitle },
  heroInsurer: { marginTop: 3, color: '#B9C2D0', ...partnerTheme.typography.caption },
  heroBadges: { alignItems: 'flex-end', gap: 5 },
  heroPremiumRow: { marginTop: 18, paddingTop: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3A4558' },
  heroPremium: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  heroPremiumLabel: { marginTop: 2, color: '#8F9BAD', ...partnerTheme.typography.meta },
  heroDateBlock: { flex: 1, alignItems: 'flex-end' },
  heroDate: { color: '#D4DAE4', textAlign: 'right', ...partnerTheme.typography.caption },
  heroDateLabel: { marginTop: 3, color: '#8F9BAD', textAlign: 'right', ...partnerTheme.typography.meta },
  quickRow: { marginTop: 11, flexDirection: 'row', gap: 8 },
  quick: { flex: 1, minHeight: partnerTheme.control.minTouchTarget, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  quickText: { color: partnerTheme.colors.ink, ...partnerTheme.typography.meta },
  infoCard: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 13, borderRadius: 17, padding: 15, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  info: { width: '50%', paddingRight: 8 },
  infoLabel: { color: '#8A94A6', textTransform: 'uppercase', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  infoValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  entityStack: { gap: 8 },
  entity: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  entityIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surfaceMuted },
  entityBody: { flex: 1 },
  entityTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  entityMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  pressed: { opacity: 0.78 },
});
