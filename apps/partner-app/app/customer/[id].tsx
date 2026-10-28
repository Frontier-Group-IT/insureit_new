import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerContactActions } from '@/components/ui/partner-contact-actions';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { getPartnerCustomerDetail, type PartnerCustomerDetail } from '@/lib/customers';
import { formatIndianCurrency } from '@/lib/format';
import { getPartnerInsurerLogoSource, getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PartnerCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'vehicles' | 'policies'>('overview');
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

  useEffect(() => { void load(); }, [load]);


  return (
    <PartnerScreen title="Customer" hideTopBar fullWidth>
      {loading ? (
        <PartnerStateView state="loading" title="Loading customer" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Customer unavailable" message={error || 'This customer could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>

          <View style={redesign.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color="#FFFFFF" /></Pressable>
            <Text style={redesign.headerTitle}>Customer Details</Text>
          </View>
          <View style={redesign.profile}>
            <View style={redesign.avatar}><Text style={redesign.avatarText}>{initials(data.customer.customer_name)}</Text></View>
            <View style={redesign.profileContent}>
              <View style={redesign.profileNameWrap}>
                <Text style={redesign.profileName}>{data.customer.customer_name}</Text>
                {customerTone(data.customer.status) === 'success' ? <Ionicons name="checkmark-circle" size={19} color="#0CB76B" /> : null}
              </View>
              <View style={redesign.actions}>
                <PartnerContactActions phone={data.customer.phone} email={data.customer.email} inlineLabeled />
              </View>
            </View>
          </View>
          <View style={redesign.tabs}>
            {([
              ['overview', 'person-outline', 'Overview'],
              ['vehicles', 'car-sport-outline', 'Vehicles'],
              ['policies', 'shield-checkmark-outline', 'Policies'],
            ] as const).map(([key, icon, title]) => (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: activeTab === key }} onPress={() => setActiveTab(key)} style={[redesign.tab, activeTab === key && redesign.activeTab]}>
                <Ionicons name={icon} size={17} color={activeTab === key ? '#0879F1' : '#69758A'} />
                <Text style={[redesign.tabText, activeTab === key && redesign.activeTabText]}>{title}</Text>
              </Pressable>
            ))}
          </View>
          <View style={redesign.content}>
            {activeTab === 'overview' ? (
              <>
                <Text style={redesign.sectionTitle}>Customer Information</Text>
                <DetailLine icon="person-outline" label="Customer Type" value={humanize(data.customer.customer_type || 'Not recorded')} />
                <DetailLine icon="document-text-outline" label="Customer ID" value={data.customer.customer_code || 'Not recorded'} />
                <DetailLine icon="people-outline" label="Intermediary" value={data.customer.intermediary_code || 'Not recorded'} />
                <DetailLine icon="calendar-outline" label="Customer Since" value={formatMonthYear(data.customer.created_at)} />
                <DetailLine icon="car-outline" label="Fleet" value={humanize(data.customer.fleet_size_band || 'Not recorded')} />
                <DetailLine icon="checkmark-circle-outline" label="Status" value={humanize(data.customer.status || 'Not recorded')} />
                {data.summary.renewals_30_days > 0 ? <PartnerBanner tone="warning" title="Renewal attention" message={`${data.summary.renewals_30_days} policies due within 30 days.`} /> : null}
                {data.claims.length ? (
                  <View style={redesign.claimsSection}>
                    <Text style={redesign.sectionTitle}>Claims</Text>
                    {data.claims.map((claim) => (
                      <Pressable key={claim.claim_id} accessibilityRole="button" onPress={() => router.push(`/claim/${claim.claim_id}` as never)} style={redesign.simpleRow}>
                        <Logo source={getPartnerInsurerLogoSource(claim.insurer_name)} fallback={PartnerAssets.navigation.claims} compact />
                        <View style={{ flex: 1 }}><Text style={redesign.value}>{claim.claim_no || 'Claim'}</Text><Text style={redesign.label}>{displayParts(claim.insurer_name, humanize(claim.current_status || 'Not recorded'))}</Text></View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : activeTab === 'vehicles' ? (
              <>
                <View style={redesign.sectionHeading}><Ionicons name="car-sport-outline" size={20} color="#0879F1" /><Text style={redesign.sectionTitle}>Vehicle Details</Text></View>
                {data.vehicles.length ? data.vehicles.map((vehicle) => (
                  <View key={vehicle.vehicle_id} style={redesign.recordCard}>
                    <View style={redesign.vehicleIdentity}>
                      <Logo source={getPartnerManufacturerLogoSource(vehicle.make)} fallback={PartnerAssets.products.motorInsurance} />
                      <View style={{ flex: 1 }}><Text style={redesign.recordTitle}>{vehicle.vehicle_no || 'Vehicle number not recorded'}</Text><Text style={redesign.label}>{displayParts(vehicle.make, vehicle.model, vehicle.year) || 'Not recorded'}</Text></View>
                    </View>

                  </View>
                )) : <EmptyCard icon="car-sport-outline" title="No vehicles recorded." subtitle="Vehicles linked to this customer will appear here." />}
              </>
            ) : (
              <>
                <View style={redesign.sectionHeading}><Ionicons name="shield-checkmark-outline" size={20} color="#0879F1" /><Text style={redesign.sectionTitle}>Policy Details</Text></View>
                {data.policies.length ? data.policies.map((policy) => (
                  <Pressable key={policy.policy_id} accessibilityRole="button" accessibilityLabel={`Open policy ${policy.policy_no || policy.policy_code || policy.vehicle_no || ''}`} onPress={() => router.push(`/policy/${policy.policy_id}` as never)} style={redesign.compactPolicyRow}>
                    <Logo source={getPartnerInsurerLogoSource(policy.insurer_name)} fallback={PartnerAssets.products.motorInsurance} compact />
                    <View style={redesign.policyMain}>
                      {policy.vehicle_no ? <Text style={redesign.recordTitle}>{policy.vehicle_no}</Text> : null}
                      {policy.policy_no || policy.policy_code ? <Text style={policy.vehicle_no ? redesign.label : redesign.recordTitle}>{policy.policy_no || policy.policy_code}</Text> : null}
                    </View>
                    <View style={redesign.policyRight}>
                      {displayParts(policy.policy_type, policy.policy_product) ? <Text style={redesign.policyTypeBadge}>{displayParts(policy.policy_type, policy.policy_product)}</Text> : null}
                      {policy.end_date ? <Text style={redesign.policyExpiryText}>Exp: {formatDate(policy.end_date)}</Text> : null}
                    </View>
                  </Pressable>
                )) : <EmptyCard icon="shield-checkmark-outline" title="No policies recorded." subtitle="Policies linked to this customer will appear here." />}
              </>
            )}
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function Logo({ source, fallback, compact = false }: { source: ReturnType<typeof getPartnerInsurerLogoSource>; fallback: number; compact?: boolean }) {
  return <View style={[styles.logoShell, compact && styles.logoShellCompact]}><Image source={source || fallback} style={[styles.logoImage, compact && styles.logoImageCompact]} resizeMode="contain" /></View>;
}

function SectionHeader({ icon, title, meta }: { icon: keyof typeof Ionicons.glyphMap; title: string; meta?: string }) {
  return <View style={styles.sectionHeader}><View style={styles.sectionTitleRow}><Ionicons name={icon} size={19} color="#1767E8" /><Text style={styles.sectionTitle}>{title}</Text></View>{meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}</View>;
}

function Info({ label, value, status }: { label: string; value: string; status?: string | null }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text>{status ? <View style={styles.inlineStatus}><Text style={styles.inlineStatusText}>{value}</Text></View> : <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>}</View>;
}

function EmptyCard({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return <View style={styles.emptyCard}><View style={styles.emptyIcon}><Ionicons name={icon} size={24} color="#74829A" /></View><View style={styles.emptyBody}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptySubtitle}>{subtitle}</Text></View></View>;
}

function Expiry({ label, date }: { label: string; date: string | null }) { if (!date) return null; const days = daysUntil(date); const tone = days < 0 ? styles.expiryBad : days <= 30 ? styles.expiryWarn : styles.expiryGood; return <View style={[styles.expiry, tone]}><Text style={styles.expiryText}>{label} · {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}</Text></View>; }
function ExpandToggle({ expanded, total, label, onPress }: { expanded: boolean; total: number; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={expanded ? `Show fewer ${label}` : `Show all ${total} ${label}`} onPress={onPress} style={({ pressed }) => [styles.expandToggle, pressed && styles.pressed]}><Text style={styles.expandToggleText}>{expanded ? 'Show less' : `Show all ${total}`}</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={partnerTheme.colors.brand} /></Pressable>; }
function customerTone(value: string | null): 'success' | 'warning' | 'neutral' { const normalized = (value || '').toLowerCase(); if (!normalized || normalized.includes('active')) return 'success'; if (normalized.includes('pending') || normalized.includes('hold')) return 'warning'; return 'neutral'; }
function claimTone(value: string | null): 'success' | 'warning' | 'info' { const normalized = (value || '').toLowerCase(); if (normalized.includes('complete') || normalized.includes('settled') || normalized.includes('closed')) return 'success'; if (normalized.includes('pending') || normalized.includes('attention')) return 'warning'; return 'info'; }
function policyCategory(policy: PartnerCustomerDetail['policies'][number]) { const value = [policy.policy_type, policy.policy_product].filter(Boolean).join(' ').toLowerCase(); if (value.includes('motor') || policy.vehicle_no) return 'Motor'; if (value.includes('health')) return 'Health'; if (value.includes('life')) return 'Life'; return 'Non-Motor'; }
function displayParts(...values: Array<string | number | null | undefined>) { return values.map((value) => value == null ? '' : String(value).trim()).filter((value) => value && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined').join(' · '); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CU'; }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string | null) { if (!value) return '—'; const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(d); }
function formatMonthYear(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'recorded date' : new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(d); }
function daysUntil(value: string) { const end = new Date(`${value}T00:00:00`); const today = new Date(); today.setHours(0, 0, 0, 0); return Math.ceil((end.getTime() - today.getTime()) / 86400000); }


function DetailLine({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={redesign.detailLine}><View style={redesign.iconCircle}><Ionicons name={icon} size={17} color="#66758B" /></View><Text style={redesign.lineLabel}>{label}</Text><Text style={redesign.lineValue}>{value}</Text></View>;
}
function DetailCell({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null | undefined }) {
  return <View style={redesign.detailCell}><View style={redesign.iconCircle}><Ionicons name={icon} size={16} color="#1477DE" /></View><View style={{ flex: 1 }}><Text style={redesign.label}>{label}</Text><Text style={redesign.value}>{value && value !== '—' ? value : 'Not recorded'}</Text></View></View>;
}
const redesign = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 12, backgroundColor: partnerTheme.colors.nav },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  profile: { backgroundColor: '#E5F1FF', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEE1FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#6B28CE', fontSize: 20, fontWeight: '700' },
  profileContent: { flex: 1, minWidth: 0, gap: 6 },
  profileNameWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  profileName: { color: '#111B37', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  actions: { alignItems: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF' },
  tab: { flex: 1, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#0879F1' },
  tabText: { fontSize: 11, color: '#69758A', fontWeight: '500' },
  activeTabText: { color: '#0879F1', fontWeight: '700' },
  content: { backgroundColor: '#FFFFFF', padding: 12, gap: 10, minHeight: 350 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111B37' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF4' },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDF5FF', alignItems: 'center', justifyContent: 'center' },
  lineLabel: { color: '#66758B', fontSize: 11, flex: 1 },
  lineValue: { color: '#111B37', fontSize: 11, fontWeight: '600', flex: 1, textAlign: 'right' },
  recordCard: { borderRadius: 12, borderWidth: 1, borderColor: '#E2EAF4', padding: 10, gap: 10 },
  compactPolicyRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2EAF4', paddingHorizontal: 10, paddingVertical: 8 },
  policyMain: { flex: 1, minWidth: 0, gap: 3 },
  policyRight: { alignItems: 'flex-end', gap: 5, maxWidth: '43%' },
  policyTypeBadge: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#EAF2FF', color: '#174EA6', fontSize: 10, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 4 },
  policyExpiryText: { color: '#66758B', fontSize: 10, fontWeight: '600' },
  vehicleIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  recordTitle: { fontSize: 12, fontWeight: '700', color: '#111B37' },
  label: { color: '#66758B', fontSize: 9.5, lineHeight: 13 },
  value: { color: '#111B37', fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap' },
  detailCell: { width: '50%', minHeight: 60, flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingVertical: 10, paddingRight: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF4' },
  claimsSection: { marginTop: 12, gap: 8 },
  simpleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, borderWidth: 1, borderColor: '#E2EAF4', borderRadius: 9 },
});
const styles = StyleSheet.create({
  headerWrap: { height: 72, marginHorizontal: -partnerTheme.spacing.lg, paddingHorizontal: 16, overflow: 'hidden', backgroundColor: '#0865CC' },
  headerOrbLarge: { position: 'absolute', right: -45, top: -80, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(51,153,255,0.28)' },
  headerOrbSmall: { position: 'absolute', right: 80, top: -72, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(0,126,232,0.34)' },
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  headerIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 19, fontWeight: '800' },
  identityCard: { marginTop: -9, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF', shadowColor: '#14335F', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 9, elevation: 2 },
  identityMainRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EDFF' }, avatarText: { color: '#4E25E8', fontSize: 18, fontWeight: '800' },
  identityBody: { flex: 1 }, identityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, identityName: { flex: 1, color: '#10192D', fontSize: 14, lineHeight: 18, fontWeight: '800' }, identityMeta: { marginTop: 3, color: '#68758B', fontSize: 9.5, lineHeight: 13 },
  contactActions: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEF1F5' }, relationshipInline: { marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#EEF1F5', flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 }, attention: { marginTop: 8 },
  sectionHeader: { marginTop: 13, marginBottom: 6 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, sectionTitle: { color: '#131D33', fontSize: 13, lineHeight: 17, fontWeight: '800' }, sectionMeta: { marginTop: 1, marginLeft: 26, color: '#7A8799', fontSize: 8.5, lineHeight: 11 },
  info: { width: '50%', paddingRight: 8 }, infoLabel: { color: '#768297', fontSize: 8, lineHeight: 10, textTransform: 'uppercase', letterSpacing: 0.35 }, infoValue: { marginTop: 3, color: '#111B30', fontSize: 10.5, lineHeight: 14, fontWeight: '700' }, inlineStatus: { alignSelf: 'flex-start', marginTop: 3, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: '#E6F8EF' }, inlineStatusText: { color: '#109E65', fontSize: 9, fontWeight: '800' },
  vehiclesSection: { marginTop: 13, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF' }, vehiclesHeader: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, vehiclesCount: { color: '#7A8799', fontSize: 8.5, lineHeight: 11 },
  stack: { gap: 7 }, itemCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF' },
  vehicleCard: { borderRadius: 11, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF', overflow: 'hidden' }, vehicleTopRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10 },
  viewPolicyButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#163F79', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, viewPolicyText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '800' },
  policyStack: { borderTopWidth: 1, borderTopColor: '#E8EDF5', backgroundColor: '#F8FAFD', padding: 8, gap: 7 }, policyCard: { borderRadius: 10, borderWidth: 1, borderColor: '#DDE5F0', backgroundColor: '#FFFFFF', overflow: 'hidden' }, policyRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9 }, policyBody: { flex: 1, minWidth: 0, justifyContent: 'center' }, policyIdentity: { minWidth: 0, alignItems: 'flex-start', gap: 1 }, policyNumber: { color: '#10192D', fontSize: 11.5, lineHeight: 15, fontWeight: '800' }, policyExpiry: { color: '#4B2CE7', fontSize: 9.5, lineHeight: 13, fontWeight: '700' }, policyDetailsButton: { minHeight: 32, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#163F79', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }, policyDetailsButtonText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '800' },
  claimToggle: { alignSelf: 'center', minHeight: 32, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1, borderColor: '#C9D7E9', backgroundColor: '#F1F6FC', flexDirection: 'row', alignItems: 'center', gap: 3 }, claimToggleText: { color: '#163F79', fontSize: 8.5, fontWeight: '800' },
  claimStack: { borderTopWidth: 1, borderTopColor: '#E8EDF5', padding: 7, gap: 6, backgroundColor: '#FBFCFE' }, claimCard: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 9, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF' }, claimIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1DC' },
  logoShell: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FC' }, logoImage: { width: 43, height: 43 }, logoShellCompact: { width: 40, height: 40, borderRadius: 9 }, logoImageCompact: { width: 35, height: 35 },
  itemBody: { flex: 1, minWidth: 0 }, itemHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 }, itemTitle: { flex: 1, color: '#10192D', fontSize: 11.5, lineHeight: 15, fontWeight: '800' }, vehicleIdentity: { minWidth: 0, alignItems: 'flex-start', gap: 3 }, vehicleDetailText: { flexShrink: 1, color: '#67758A', fontSize: 9.5, lineHeight: 13, fontWeight: '600' }, itemText: { marginTop: 2, color: '#67758A', fontSize: 9.5, lineHeight: 13 }, itemMeta: { marginTop: 3, color: '#4B2CE7', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  expiryRow: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, expiry: { borderRadius: partnerTheme.radius.pill, paddingHorizontal: 7, paddingVertical: 3 }, expiryGood: { backgroundColor: partnerTheme.colors.successSoft }, expiryWarn: { backgroundColor: partnerTheme.colors.warningSoft }, expiryBad: { backgroundColor: partnerTheme.colors.dangerSoft }, expiryText: { color: partnerTheme.colors.inkMuted, fontSize: 8 },
  emptyCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF' }, emptyIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F8' }, emptyBody: { flex: 1 }, emptyTitle: { color: '#172039', fontSize: 10.5, lineHeight: 14, fontWeight: '800' }, emptySubtitle: { marginTop: 2, color: '#7A8799', fontSize: 8.5, lineHeight: 12 },
  expandToggle: { minHeight: 40, marginTop: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, expandToggleText: { color: partnerTheme.colors.brandStrong, fontSize: 10, fontWeight: '700' }, pressed: { opacity: 0.7 },
});
