import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerContactActions } from '@/components/ui/partner-contact-actions';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { getPartnerCustomerDetail, type PartnerCustomerDetail } from '@/lib/customers';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PartnerCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerCustomerDetail(id));
    } catch {
      setError('This customer could not be loaded in your Partner scope.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PartnerScreen
      eyebrow="CUSTOMER"
      title={data?.customer.customer_name || 'Customer'}
      action={<PartnerIconButton icon="close" label="Close customer detail" onPress={() => router.back()} />}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading customer" />
      ) : error || !data ? (
        <PartnerStateView
          state="error"
          title="Customer unavailable"
          message={error || 'This customer could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(data.customer.customer_name)}</Text></View>
              <View style={styles.heroBody}>
                <Text style={styles.heroName}>{data.customer.customer_name}</Text>
                <Text style={styles.heroMeta}>
                  {[data.customer.city, data.customer.state].filter(Boolean).join(', ') || 'Location not recorded'}
                  {data.customer.customer_code ? ` · ${data.customer.customer_code}` : ''}
                </Text>
              </View>
              <PartnerStatusBadge label={humanize(data.customer.status || 'active')} tone={customerTone(data.customer.status)} />
            </View>
            <Text style={styles.heroSince}>Customer record since {formatMonthYear(data.customer.created_at)}</Text>
          </View>

          <View style={styles.contactActions}>
            <PartnerContactActions phone={data.customer.phone} email={data.customer.email} />
          </View>

          {data.summary.renewals_30_days > 0 ? (
            <View style={styles.attention}>
              <PartnerBanner
                tone="warning"
                title="Renewal attention"
                message={`${data.summary.renewals_30_days} ${data.summary.renewals_30_days === 1 ? 'policy is' : 'policies are'} due within 30 days.`}
              />
            </View>
          ) : null}

          <View style={styles.summary}>
            <Summary value={data.summary.policies} label="Policies" />
            <Summary value={data.summary.vehicles} label="Vehicles" />
            <Summary value={data.summary.claims} label="Claims" />
            <Summary value={data.summary.renewals_30_days} label="Renewals" />
          </View>

          <PartnerSectionHeader title="Relationship" />
          <View style={styles.relationshipCard}>
            <Info label="Phone" value={data.customer.phone || 'Not recorded'} />
            <Info label="Email" value={data.customer.email || 'Not recorded'} />
            <Info label="Customer type" value={humanize(data.customer.customer_type || 'not recorded')} />
            <Info label="Fleet" value={humanize(data.customer.fleet_size_band || 'not recorded')} />
            <Info label="Intermediary" value={data.customer.intermediary_code || 'Organization / unassigned'} />
            <Info label="Status" value={humanize(data.customer.status || 'not recorded')} />
          </View>

          <PartnerSectionHeader title="Policies" meta={`${data.summary.policies} total`} />
          {data.policies.length ? (
            <View style={styles.stack}>
              {data.policies.map((policy) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open policy ${policy.policy_no || policy.policy_code || ''}`}
                  key={policy.policy_id}
                  onPress={() => router.push(`/policy/${policy.policy_id}` as never)}
                  style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}
                >
                  <View style={styles.itemIcon}><Ionicons name="document-text-outline" size={18} color={partnerTheme.colors.brand} /></View>
                  <View style={styles.itemBody}>
                    <View style={styles.itemHeading}>
                      <Text style={styles.itemTitle}>{policy.policy_no || policy.policy_code || 'Policy'}</Text>
                      <PartnerStatusBadge label={policyCategory(policy)} tone="brand" />
                    </View>
                    <Text style={styles.itemText}>
                      {[policy.insurer_name, policy.vehicle_no].filter(Boolean).join(' · ') || 'Policy details'}
                    </Text>
                    <Text style={styles.itemMeta}>Ends {formatDate(policy.end_date)} · {formatIndianCurrency(policy.premium_amount)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9AA3B2" />
                </Pressable>
              ))}
            </View>
          ) : <EmptyLine text="No scoped policies recorded." />}

          <PartnerSectionHeader title="Vehicles" meta={`${data.summary.vehicles} total`} />
          {data.vehicles.length ? (
            <View style={styles.stack}>
              {data.vehicles.map((vehicle) => (
                <View key={vehicle.vehicle_id} style={styles.vehicleCard}>
                  <View style={styles.itemIcon}><Ionicons name="car-outline" size={18} color={partnerTheme.colors.accent} /></View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle}>{vehicle.vehicle_no || 'Vehicle'}</Text>
                    <Text style={styles.itemText}>{[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || humanize(vehicle.vehicle_type || 'vehicle')}</Text>
                    <View style={styles.expiryRow}>
                      <Expiry label="PUC" date={vehicle.puc_expiry_date} />
                      <Expiry label="Fitness" date={vehicle.fitness_expiry_date} />
                      <Expiry label="Road tax" date={vehicle.road_tax_expiry_date} />
                      <Expiry label="National permit" date={vehicle.national_permit_expiry_date} />
                      <Expiry label="Local permit" date={vehicle.local_permit_expiry_date} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : <EmptyLine text="No vehicles recorded." />}

          <PartnerSectionHeader title="Claims" meta={`${data.summary.claims} total`} />
          {data.claims.length ? (
            <View style={styles.stack}>
              {data.claims.map((claim) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open claim ${claim.claim_no || ''}`}
                  key={claim.claim_id}
                  onPress={() => router.push(`/claim/${claim.claim_id}` as never)}
                  style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}
                >
                  <View style={styles.itemIcon}><Ionicons name="shield-outline" size={18} color={partnerTheme.colors.warning} /></View>
                  <View style={styles.itemBody}>
                    <View style={styles.itemHeading}>
                      <Text style={styles.itemTitle}>{claim.claim_no || 'Claim'}</Text>
                      <PartnerStatusBadge label={humanize(claim.current_status || 'active')} tone={claimTone(claim.current_status)} />
                    </View>
                    <Text style={styles.itemText}>{[claim.vehicle_no, claim.insurer_name].filter(Boolean).join(' · ') || 'Claim details'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9AA3B2" />
                </Pressable>
              ))}
            </View>
          ) : <EmptyLine text="No claims recorded." />}
        </>
      )}
    </PartnerScreen>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text numberOfLines={2} style={styles.infoValue}>{value}</Text></View>;
}

function Expiry({ label, date }: { label: string; date: string | null }) {
  if (!date) return null;
  const days = daysUntil(date);
  const tone = days < 0 ? styles.expiryBad : days <= 30 ? styles.expiryWarn : styles.expiryGood;
  return <View style={[styles.expiry, tone]}><Text style={styles.expiryText}>{label} · {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}</Text></View>;
}

function EmptyLine({ text }: { text: string }) {
  return <View style={styles.emptyLine}><Text style={styles.emptyLineText}>{text}</Text></View>;
}

function customerTone(value: string | null): 'success' | 'warning' | 'neutral' {
  const normalized = (value || '').toLowerCase();
  if (!normalized || normalized.includes('active')) return 'success';
  if (normalized.includes('pending') || normalized.includes('hold')) return 'warning';
  return 'neutral';
}

function claimTone(value: string | null): 'success' | 'warning' | 'info' {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('complete') || normalized.includes('settled') || normalized.includes('closed')) return 'success';
  if (normalized.includes('pending') || normalized.includes('attention')) return 'warning';
  return 'info';
}

function policyCategory(policy: PartnerCustomerDetail['policies'][number]) {
  const value = [policy.policy_type, policy.policy_product].filter(Boolean).join(' ').toLowerCase();
  if (value.includes('motor') || policy.vehicle_no) return 'Motor';
  if (value.includes('health')) return 'Health';
  if (value.includes('life')) return 'Life';
  return 'Non-Motor';
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CU';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(d);
}

function formatMonthYear(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'recorded date' : new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(d);
}

function daysUntil(value: string) {
  const end = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

const styles = StyleSheet.create({
  hero: { borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.nav },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#373F53' },
  avatarText: { color: '#FFFFFF', ...partnerTheme.typography.bodyStrong },
  heroBody: { flex: 1 },
  heroName: { color: '#FFFFFF', ...partnerTheme.typography.sectionTitle },
  heroMeta: { marginTop: 4, color: '#C0C8D4', ...partnerTheme.typography.caption },
  heroSince: { marginTop: 8, paddingTop: 8, color: '#8F9BAD', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3B4658', ...partnerTheme.typography.meta },
  contactActions: { marginTop: 8 },
  attention: { marginTop: 8 },
  summary: { marginTop: 9, flexDirection: 'row', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  summaryItem: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  summaryLabel: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  relationshipCard: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 9, borderRadius: partnerTheme.radius.lg, padding: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  info: { width: '50%', paddingRight: 8 },
  infoLabel: { color: '#8A94A6', textTransform: 'uppercase', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  infoValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  stack: { gap: 8 },
  itemCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: partnerTheme.radius.lg, padding: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  vehicleCard: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: partnerTheme.radius.lg, padding: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  itemIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surfaceMuted },
  itemBody: { flex: 1 },
  itemHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  itemTitle: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  itemText: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  itemMeta: { marginTop: 3, color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.meta },
  expiryRow: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  expiry: { borderRadius: partnerTheme.radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  expiryGood: { backgroundColor: partnerTheme.colors.successSoft },
  expiryWarn: { backgroundColor: partnerTheme.colors.warningSoft },
  expiryBad: { backgroundColor: partnerTheme.colors.dangerSoft },
  expiryText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  emptyLine: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  emptyLineText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  pressed: { opacity: 0.8 },
});
