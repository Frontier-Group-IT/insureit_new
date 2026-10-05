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
  const [showAllVehicles, setShowAllVehicles] = useState(false);
  const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});

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

  const visibleVehicles = data ? (showAllVehicles ? data.vehicles : data.vehicles.slice(0, 2)) : [];
  const unlinkedPolicies = data ? data.policies.filter((policy) => !policy.vehicle_id) : [];
  const unlinkedClaims = data ? data.claims.filter((claim) => !claim.policy_id) : [];

  const toggleVehicle = (vehicleId: string) => {
    setExpandedVehicles((current) => ({ ...current, [vehicleId]: !current[vehicleId] }));
  };

  const toggleClaims = (policyId: string) => {
    setExpandedClaims((current) => ({ ...current, [policyId]: !current[policyId] }));
  };

  return (
    <PartnerScreen title="Customer" hideTopBar>
      {loading ? (
        <PartnerStateView state="loading" title="Loading customer" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Customer unavailable" message={error || 'This customer could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>
          <View style={styles.headerWrap}>
            <View style={styles.headerOrbLarge} />
            <View style={styles.headerOrbSmall} />
            <View style={styles.headerRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </Pressable>
              <View style={styles.headerIcon}><Ionicons name="people" size={22} color="#1767E8" /></View>
              <Text style={styles.headerTitle}>Customer</Text>
            </View>
          </View>

          <View style={styles.identityCard}>
            <View style={styles.identityMainRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(data.customer.customer_name)}</Text></View>
              <View style={styles.identityBody}>
                <View style={styles.identityTitleRow}>
                  <Text numberOfLines={1} style={styles.identityName}>{data.customer.customer_name}</Text>
                  <PartnerStatusBadge label={humanize(data.customer.status || 'active')} tone={customerTone(data.customer.status)} />
                </View>
                <Text style={styles.identityMeta}>{[data.customer.city, data.customer.state].filter(Boolean).join(', ') || 'Location not recorded'}{data.customer.customer_code ? ` · ${data.customer.customer_code}` : ''}</Text>
                <View style={styles.sinceRow}><Ionicons name="calendar-outline" size={12} color="#77839A" /><Text style={styles.sinceText}>Customer record since {formatMonthYear(data.customer.created_at)}</Text></View>
              </View>
            </View>
            <View style={styles.contactActions}><PartnerContactActions phone={data.customer.phone} email={data.customer.email} /></View>
          </View>

          {data.summary.renewals_30_days > 0 ? <View style={styles.attention}><PartnerBanner tone="warning" title="Renewal attention" message={`${data.summary.renewals_30_days} ${data.summary.renewals_30_days === 1 ? 'policy is' : 'policies are'} due within 30 days.`} /></View> : null}

          <SectionHeader icon="list-outline" title="Relationship" />
          <View style={styles.relationshipCard}>
            <Info label="Customer Type" value={humanize(data.customer.customer_type || 'not recorded')} />
            <Info label="Fleet" value={humanize(data.customer.fleet_size_band || 'not recorded')} />
            <Info label="Intermediary" value={data.customer.intermediary_code || 'Organization / unassigned'} />
            <Info label="Status" value={humanize(data.customer.status || 'not recorded')} status={data.customer.status} />
          </View>

          <View style={styles.vehiclesSection}>
            <View style={styles.vehiclesHeader}>
              <View style={styles.sectionTitleRow}><Ionicons name="car-outline" size={19} color="#1767E8" /><Text style={styles.sectionTitle}>Vehicles</Text></View>
              <Text style={styles.vehiclesCount}>{data.summary.vehicles} total</Text>
            </View>
            {data.vehicles.length ? (
              <View style={styles.stack}>{visibleVehicles.map((vehicle) => {
                const logo = getPartnerManufacturerLogoSource(vehicle.make);
                const policies = data.policies.filter((policy) => policy.vehicle_id === vehicle.vehicle_id);
                const expanded = Boolean(expandedVehicles[vehicle.vehicle_id]);
                return (
                  <View key={vehicle.vehicle_id} style={styles.vehicleCard}>
                    <View style={styles.vehicleTopRow}>
                      <Logo source={logo} fallback={PartnerAssets.products.motorInsurance} />
                      <View style={styles.itemBody}>
                        <Text style={styles.itemTitle}>{vehicle.vehicle_no || 'Vehicle'}</Text>
                        <Text style={styles.itemText}>{displayParts(vehicle.make, vehicle.model, vehicle.year) || humanize(vehicle.vehicle_type || 'vehicle')}</Text>
                        <View style={styles.expiryRow}><Expiry label="PUC" date={vehicle.puc_expiry_date} /><Expiry label="Fitness" date={vehicle.fitness_expiry_date} /><Expiry label="Road tax" date={vehicle.road_tax_expiry_date} /><Expiry label="National permit" date={vehicle.national_permit_expiry_date} /><Expiry label="Local permit" date={vehicle.local_permit_expiry_date} /></View>
                      </View>
                      {policies.length ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Hide policy details' : 'View policy details'} onPress={() => toggleVehicle(vehicle.vehicle_id)} style={({ pressed }) => [styles.viewPolicyButton, pressed && styles.pressed]}>
                          <Text style={styles.viewPolicyText}>{expanded ? 'Hide Policy' : 'View Policy'}</Text>
                          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#FFFFFF" />
                        </Pressable>
                      ) : null}
                    </View>

                    {expanded ? (
                      <View style={styles.policyStack}>{policies.map((policy) => {
                        const policyClaims = data.claims.filter((claim) => claim.policy_id === policy.policy_id);
                        const claimsExpanded = Boolean(expandedClaims[policy.policy_id]);
                        const insurerLogo = getPartnerInsurerLogoSource(policy.insurer_name);
                        return (
                          <View key={policy.policy_id} style={styles.policyCard}>
                            <View style={styles.policyRow}>
                              <Logo source={insurerLogo} fallback={PartnerAssets.products.motorInsurance} compact />
                              <Pressable accessibilityRole="button" accessibilityLabel={`Open policy ${policy.policy_no || policy.policy_code || ''}`} onPress={() => router.push(`/policy/${policy.policy_id}` as never)} style={({ pressed }) => [styles.policyBody, pressed && styles.pressed]}>
                                <View style={styles.itemHeading}><Text style={styles.itemTitle}>{policy.policy_no || policy.policy_code || 'Policy'}</Text><PartnerStatusBadge label={policyCategory(policy)} tone="brand" /></View>
                                <Text numberOfLines={1} style={styles.itemText}>{policy.insurer_name || 'Insurer not recorded'}</Text>
                                <Text style={styles.itemMeta}>Ends {formatDate(policy.end_date)} · {formatIndianCurrency(policy.premium_amount)}</Text>
                                <Text style={styles.policyDetailsText}>Policy Details</Text>
                              </Pressable>
                              {policyClaims.length ? (
                                <Pressable accessibilityRole="button" accessibilityLabel={claimsExpanded ? `Collapse ${policyClaims.length} claims` : `Expand ${policyClaims.length} claims`} onPress={() => toggleClaims(policy.policy_id)} style={({ pressed }) => [styles.claimToggle, pressed && styles.pressed]}>
                                  <Text style={styles.claimToggleText}>Claims {policyClaims.length}</Text>
                                  <Ionicons name={claimsExpanded ? 'chevron-up' : 'chevron-down'} size={13} color="#163F79" />
                                </Pressable>
                              ) : null}
                            </View>

                            {claimsExpanded ? (
                              <View style={styles.claimStack}>{policyClaims.map((claim) => (
                                <Pressable accessibilityRole="button" accessibilityLabel={`Open claim ${claim.claim_no || ''}`} key={claim.claim_id} onPress={() => router.push(`/claim/${claim.claim_id}` as never)} style={({ pressed }) => [styles.claimCard, pressed && styles.pressed]}>
                                  <View style={styles.claimIcon}><Ionicons name="shield-checkmark-outline" size={17} color="#F59E0B" /></View>
                                  <View style={styles.itemBody}>
                                    <View style={styles.itemHeading}><Text style={styles.itemTitle}>{claim.claim_no || 'Claim'}</Text><PartnerStatusBadge label={humanize(claim.current_status || 'active')} tone={claimTone(claim.current_status)} /></View>
                                    <Text numberOfLines={1} style={styles.itemText}>{claim.insurer_name || 'Claim details'}</Text>
                                  </View>
                                  <Ionicons name="chevron-forward" size={17} color="#5A35EE" />
                                </Pressable>
                              ))}</View>
                            ) : null}
                          </View>
                        );
                      })}</View>
                    ) : null}
                  </View>
                );
              })}</View>
            ) : <EmptyCard icon="car-outline" title="No vehicles recorded." subtitle="Vehicles linked to this customer will appear here." />}
            {data.vehicles.length > 2 ? <ExpandToggle expanded={showAllVehicles} total={data.vehicles.length} label="vehicles" onPress={() => setShowAllVehicles((value) => !value)} /> : null}
          </View>

          {unlinkedPolicies.length ? (
            <>
              <SectionHeader icon="document-text-outline" title="Other Policies" meta={`${unlinkedPolicies.length} without a linked vehicle`} />
              <View style={styles.stack}>{unlinkedPolicies.map((policy) => {
                const logo = getPartnerInsurerLogoSource(policy.insurer_name);
                return (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open policy ${policy.policy_no || policy.policy_code || ''}`} key={policy.policy_id} onPress={() => router.push(`/policy/${policy.policy_id}` as never)} style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}>
                    <Logo source={logo} fallback={PartnerAssets.products.motorInsurance} />
                    <View style={styles.itemBody}>
                      <View style={styles.itemHeading}><Text style={styles.itemTitle}>{policy.policy_no || policy.policy_code || 'Policy'}</Text><PartnerStatusBadge label={policyCategory(policy)} tone="brand" /></View>
                      <Text numberOfLines={1} style={styles.itemText}>{policy.insurer_name || 'Insurer not recorded'}</Text>
                      <Text style={styles.itemMeta}>Ends {formatDate(policy.end_date)} · {formatIndianCurrency(policy.premium_amount)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#5A35EE" />
                  </Pressable>
                );
              })}</View>
            </>
          ) : null}

          {unlinkedClaims.length ? (
            <>
              <SectionHeader icon="shield-checkmark-outline" title="Other Claims" meta={`${unlinkedClaims.length} without a linked policy`} />
              <View style={styles.stack}>{unlinkedClaims.map((claim) => (
                <Pressable accessibilityRole="button" accessibilityLabel={`Open claim ${claim.claim_no || ''}`} key={claim.claim_id} onPress={() => router.push(`/claim/${claim.claim_id}` as never)} style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}>
                  <Logo source={getPartnerInsurerLogoSource(claim.insurer_name)} fallback={PartnerAssets.navigation.claims} />
                  <View style={styles.itemBody}>
                    <View style={styles.itemHeading}><Text style={styles.itemTitle}>{claim.claim_no || 'Claim'}</Text><PartnerStatusBadge label={humanize(claim.current_status || 'active')} tone={claimTone(claim.current_status)} /></View>
                    <Text numberOfLines={1} style={styles.itemText}>{[claim.vehicle_no, claim.insurer_name].filter(Boolean).join(' · ') || 'Claim details'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#5A35EE" />
                </Pressable>
              ))}</View>
            </>
          ) : null}
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
  sinceRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }, sinceText: { color: '#7B8799', fontSize: 8.5, lineHeight: 12 },
  contactActions: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEF1F5' }, attention: { marginTop: 8 },
  sectionHeader: { marginTop: 13, marginBottom: 6 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, sectionTitle: { color: '#131D33', fontSize: 13, lineHeight: 17, fontWeight: '800' }, sectionMeta: { marginTop: 1, marginLeft: 26, color: '#7A8799', fontSize: 8.5, lineHeight: 11 },
  relationshipCard: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF' },
  info: { width: '50%', paddingRight: 8 }, infoLabel: { color: '#768297', fontSize: 8, lineHeight: 10, textTransform: 'uppercase', letterSpacing: 0.35 }, infoValue: { marginTop: 3, color: '#111B30', fontSize: 10.5, lineHeight: 14, fontWeight: '700' }, inlineStatus: { alignSelf: 'flex-start', marginTop: 3, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: '#E6F8EF' }, inlineStatusText: { color: '#109E65', fontSize: 9, fontWeight: '800' },
  vehiclesSection: { marginTop: 13, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF' }, vehiclesHeader: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, vehiclesCount: { color: '#7A8799', fontSize: 8.5, lineHeight: 11 },
  stack: { gap: 7 }, itemCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF' },
  vehicleCard: { borderRadius: 11, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF', overflow: 'hidden' }, vehicleTopRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10 },
  viewPolicyButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#163F79', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, viewPolicyText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '800' },
  policyStack: { borderTopWidth: 1, borderTopColor: '#E8EDF5', backgroundColor: '#F8FAFD', padding: 8, gap: 7 }, policyCard: { borderRadius: 10, borderWidth: 1, borderColor: '#DDE5F0', backgroundColor: '#FFFFFF', overflow: 'hidden' }, policyRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9 }, policyBody: { flex: 1, minWidth: 0 }, policyDetailsText: { marginTop: 4, color: '#163F79', fontSize: 8.5, fontWeight: '800' },
  claimToggle: { alignSelf: 'center', minHeight: 32, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1, borderColor: '#C9D7E9', backgroundColor: '#F1F6FC', flexDirection: 'row', alignItems: 'center', gap: 3 }, claimToggleText: { color: '#163F79', fontSize: 8.5, fontWeight: '800' },
  claimStack: { borderTopWidth: 1, borderTopColor: '#E8EDF5', padding: 7, gap: 6, backgroundColor: '#FBFCFE' }, claimCard: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 9, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF' }, claimIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1DC' },
  logoShell: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FC' }, logoImage: { width: 43, height: 43 }, logoShellCompact: { width: 40, height: 40, borderRadius: 9 }, logoImageCompact: { width: 35, height: 35 },
  itemBody: { flex: 1, minWidth: 0 }, itemHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 }, itemTitle: { flex: 1, color: '#10192D', fontSize: 11.5, lineHeight: 15, fontWeight: '800' }, itemText: { marginTop: 2, color: '#67758A', fontSize: 9.5, lineHeight: 13 }, itemMeta: { marginTop: 3, color: '#4B2CE7', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  expiryRow: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, expiry: { borderRadius: partnerTheme.radius.pill, paddingHorizontal: 7, paddingVertical: 3 }, expiryGood: { backgroundColor: partnerTheme.colors.successSoft }, expiryWarn: { backgroundColor: partnerTheme.colors.warningSoft }, expiryBad: { backgroundColor: partnerTheme.colors.dangerSoft }, expiryText: { color: partnerTheme.colors.inkMuted, fontSize: 8 },
  emptyCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E4E9F2', backgroundColor: '#FFFFFF' }, emptyIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F8' }, emptyBody: { flex: 1 }, emptyTitle: { color: '#172039', fontSize: 10.5, lineHeight: 14, fontWeight: '800' }, emptySubtitle: { marginTop: 2, color: '#7A8799', fontSize: 8.5, lineHeight: 12 },
  expandToggle: { minHeight: 40, marginTop: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, expandToggleText: { color: partnerTheme.colors.brandStrong, fontSize: 10, fontWeight: '700' }, pressed: { opacity: 0.7 },
});