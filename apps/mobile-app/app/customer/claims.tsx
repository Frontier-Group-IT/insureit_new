import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppSearchBar } from '@/components/design-system';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, ClaimStatus, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

type ExtendedClaim = Claim & {
  claim_service_mode?: string | null;
  assistance_status?: string | null;
  external_policy_id?: string | null;
};
type ExternalPolicy = { id: string; policy_no: string; insurance_company_id: string | null; end_date: string | null };
type ClaimFilter = 'All' | 'Open' | 'Action Required' | 'Completed';

export default function ClaimsScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<ExtendedClaim[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [externalPolicies, setExternalPolicies] = useState<ExternalPolicy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClaimFilter>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const [claimResult, vehicleResult, policyResult, externalResult, insurerResult] = await Promise.all([
          supabase.from('claims').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
          supabase.from('vehicles').select('*').eq('customer_id', customer.id),
          supabase.from('policies').select('*').eq('customer_id', customer.id),
          supabase.from('external_policies').select('id,policy_no,insurance_company_id,end_date').eq('customer_id', customer.id),
          supabase.from('insurance_companies').select('*'),
        ]);
        setClaims((claimResult.data ?? []) as ExtendedClaim[]);
        setVehicles(vehicleResult.data ?? []);
        setPolicies(policyResult.data ?? []);
        setExternalPolicies((externalResult.data ?? []) as ExternalPolicy[]);
        setInsurers(insurerResult.data ?? []);
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  const counts = useMemo(() => ({
    managed: claims.filter((claim) => claim.claim_service_mode !== 'self_managed').length,
    self: claims.filter((claim) => claim.claim_service_mode === 'self_managed' && claim.assistance_status !== 'requested').length,
    requested: claims.filter((claim) => claim.assistance_status === 'requested').length,
  }), [claims]);

  const filteredClaims = useMemo(() => {
    const search = query.trim().toLowerCase();
    return claims.filter((claim) => {
      if (!matchesFilter(claim, filter)) return false;
      const vehicle = vehicles.find((item) => item.id === claim.vehicle_id);
      const businessPolicy = policies.find((item) => item.id === claim.policy_id);
      const externalPolicy = externalPolicies.find((item) => item.id === claim.external_policy_id);
      const policyNo = businessPolicy?.policy_no ?? externalPolicy?.policy_no;
      const insurerId = claim.insurance_company_id || businessPolicy?.insurance_company_id || externalPolicy?.insurance_company_id;
      const insurer = insurers.find((item) => item.id === insurerId);
      const haystack = [claim.claim_no, claim.insurer_claim_no, claim.current_status, claim.accident_location, vehicle?.vehicle_no, vehicle?.make, vehicle?.model, policyNo, insurer?.name].filter(Boolean).join(' ').toLowerCase();
      return !search || haystack.includes(search);
    });
  }, [claims, externalPolicies, filter, insurers, policies, query, vehicles]);

  if (loading) return <Screen title="My Claims"><LoadingState /></Screen>;

  return (
    <Screen title="My Claims" showLogout showTitleHeader={false}>
      <View style={styles.pageIntro}>
        <Text style={styles.pageEyebrow}>CLAIM PORTFOLIO</Text>
        <Text style={styles.pageTitle}>My Claims</Text>
        <Text style={styles.pageSubtitle}>See who is handling each claim and what needs attention next.</Text>
      </View>

      <View style={styles.serviceSummary}>
        <SummaryStat icon="shield-check-outline" label="Sankalp managed" value={counts.managed} tone="blue" />
        <SummaryStat icon="account-edit-outline" label="Self tracked" value={counts.self} tone="green" />
        <SummaryStat icon="clock-outline" label="Assistance" value={counts.requested} tone="amber" />
      </View>

      <View style={styles.searchSection}>
        <AppSearchBar value={query} onChangeText={setQuery} placeholder="Search vehicle, policy, control or claim no." />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterWrap}>
        {(['All', 'Open', 'Action Required', 'Completed'] as ClaimFilter[]).map((item) => (
          <Pressable key={item} accessibilityRole="button" onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item} ({countForFilter(item, claims)})</Text>
          </Pressable>
        ))}
      </ScrollView>

      {claims.length === 0 ? <EmptyState title="No claims yet" body="Reported claims will appear here." /> : null}

      {filteredClaims.map((claim) => {
        const vehicle = vehicles.find((item) => item.id === claim.vehicle_id);
        const businessPolicy = policies.find((item) => item.id === claim.policy_id);
        const externalPolicy = externalPolicies.find((item) => item.id === claim.external_policy_id);
        const policyNo = businessPolicy?.policy_no ?? externalPolicy?.policy_no ?? '-';
        const policyEndDate = businessPolicy?.end_date ?? externalPolicy?.end_date ?? null;
        const insurerId = claim.insurance_company_id || businessPolicy?.insurance_company_id || externalPolicy?.insurance_company_id;
        const insurer = insurers.find((item) => item.id === insurerId);
        const tone = claimTone(claim.current_status);
        const selfManaged = claim.claim_service_mode === 'self_managed';
        const assistanceRequested = claim.assistance_status === 'requested';
        const service = assistanceRequested ? { label: 'ASSISTANCE REQUESTED', icon: 'clock-outline' as const, bg: '#FFF1C9', fg: '#8A5B00' } : selfManaged ? { label: 'SELF TRACKED', icon: 'account-edit-outline' as const, bg: '#EAF7F1', fg: '#147A57' } : { label: 'SANKALP MANAGED', icon: 'shield-check-outline' as const, bg: '#EAF2FF', fg: '#0A43A3' };
        const policyExpiredBeforeIncident = isIncidentAfterPolicyExpiry(claim, policyEndDate);

        return (
          <Pressable key={claim.id} accessibilityRole="button" onPress={() => router.push(selfManaged ? { pathname: '/customer/self-managed-claim-detail', params: { id: claim.id } } : { pathname: '/customer/claim-detail', params: { id: claim.id } })} style={styles.claimCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.claimIcon, { backgroundColor: tone.soft }]}><MaterialCommunityIcons name={statusIcon(claim.current_status)} size={22} color={tone.accent} /></View>
              <View style={styles.flexOne}>
                <Text style={styles.vehicleNo}>{vehicle?.vehicle_no ?? 'Vehicle linked'}</Text>
                <Text style={styles.claimControl}>{claim.claim_no}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#7A8799" />
            </View>

            <View style={styles.badgeRow}>
              <View style={[styles.serviceBadge, { backgroundColor: service.bg }]}>
                <MaterialCommunityIcons name={service.icon} size={12} color={service.fg} />
                <Text style={[styles.serviceBadgeText, { color: service.fg }]}>{service.label}</Text>
              </View>
              <View style={[styles.stageBadge, { backgroundColor: tone.soft }]}><Text style={[styles.stageBadgeText, { color: tone.accent }]}>{claimStageLabel(claim.current_status)}</Text></View>
            </View>

            <View style={styles.currentStatusBox}>
              <Text style={styles.currentStatusLabel}>CURRENT STATUS</Text>
              <Text style={styles.currentStatusValue}>{claim.current_status}</Text>
              {assistanceRequested ? <Text style={styles.currentStatusHint}>Sankalp review is pending; you remain in control until the request is accepted.</Text> : null}
            </View>

            <View style={styles.infoGrid}>
              <Info label="Policy" value={policyNo} />
              <Info label="Insurer" value={insurer?.name ?? '-'} />
              <Info label="Loss date" value={claim.accident_at ? formatDate(claim.accident_at) : '-'} />
              <Info label="Insurer claim no." value={claim.insurer_claim_no || 'Not recorded'} />
            </View>

            {policyExpiredBeforeIncident ? <View style={styles.warning}><MaterialCommunityIcons name="alert-octagon-outline" size={15} color="#B42318" /><Text style={styles.warningText}>Policy expired before loss date</Text></View> : null}

            <View style={styles.footerRow}><Text style={styles.footerText}>{selfManaged ? 'Open claim tracker' : 'Open managed claim'}</Text><MaterialCommunityIcons name="arrow-right" size={16} color="#0A43A3" /></View>
          </Pressable>
        );
      })}

      {claims.length > 0 && filteredClaims.length === 0 ? <EmptyState title="No matching claim" body="Try another search or filter." /> : null}
    </Screen>
  );
}

function SummaryStat({ icon, label, value, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: number; tone: 'blue' | 'green' | 'amber' }) {
  const colors = tone === 'blue' ? { bg: '#EAF2FF', fg: '#0A43A3' } : tone === 'green' ? { bg: '#EAF7F1', fg: '#147A57' } : { bg: '#FFF1C9', fg: '#8A5B00' };
  return <View style={styles.summaryStat}><View style={[styles.summaryIcon, { backgroundColor: colors.bg }]}><MaterialCommunityIcons name={icon} size={18} color={colors.fg} /></View><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoItem}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={2}>{value}</Text></View>; }
function matchesFilter(claim: Claim, filter: ClaimFilter) {
  if (filter === 'All') return true;
  if (filter === 'Completed') return ['Closed', 'Settled', 'Claim Complete'].includes(claim.current_status);
  if (filter === 'Action Required') return claim.current_status.includes('Document') || claim.current_status.includes('Awaited') || claim.current_status.includes('Pending');
  return !['Closed', 'Settled', 'Claim Complete', 'Rejected'].includes(claim.current_status);
}
function countForFilter(filter: ClaimFilter, claims: Claim[]) { return claims.filter((claim) => matchesFilter(claim, filter)).length; }
function claimStageLabel(status: ClaimStatus) {
  if (status.includes('Document') || status.includes('Awaited')) return 'Documents';
  if (status.includes('Survey') || status.includes('Inspected')) return 'Survey';
  if (status.includes('Approval') || status.includes('Estimate')) return 'Approval';
  if (status.includes('Repair') || status.includes('DO') || status.includes('RA')) return 'Repair / DO';
  if (status.includes('Payment') || status.includes('Settlement')) return 'Payment';
  if (status === 'Closed' || status === 'Settled') return 'Completed';
  return 'Claim journey';
}
function claimTone(status: ClaimStatus) {
  if (status === 'Closed' || status === 'Settled') return { accent: '#12805C', soft: '#E8F8F0' };
  if (status === 'Rejected') return { accent: '#C43838', soft: '#FDECEC' };
  if (status.includes('Payment') || status.includes('Settlement')) return { accent: '#B7791F', soft: '#FFF4E2' };
  if (status.includes('Repair') || status.includes('DO') || status.includes('RA')) return { accent: '#7C3AED', soft: '#F0E9FF' };
  if (status.includes('Document') || status.includes('Awaited')) return { accent: '#C83272', soft: '#FFF0F6' };
  return { accent: '#0B63CE', soft: '#EEF5FF' };
}
function statusIcon(status: ClaimStatus): keyof typeof MaterialCommunityIcons.glyphMap {
  if (status.includes('Document')) return 'file-document-check-outline';
  if (status.includes('Survey')) return 'clipboard-search-outline';
  if (status.includes('Repair')) return 'wrench-outline';
  if (status.includes('Payment') || status.includes('Settlement')) return 'bank-transfer';
  if (status === 'Closed' || status === 'Settled') return 'check-circle-outline';
  if (status === 'Rejected') return 'close-circle-outline';
  return 'shield-check-outline';
}
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }
function isIncidentAfterPolicyExpiry(claim: Claim, endDate?: string | null) {
  const incident = claim.accident_at ? new Date(claim.accident_at) : null;
  const expiry = policyExpiryEndOfDay(endDate);
  return Boolean(incident && !Number.isNaN(incident.getTime()) && expiry && incident.getTime() > expiry.getTime());
}
function policyExpiryEndOfDay(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 23, 59, 59, 999);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  pageIntro: { marginTop: -20, marginBottom: 12 },
  pageEyebrow: { color: '#0A43A3', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  pageTitle: { color: palette.navy, fontSize: 23, fontWeight: '900', marginTop: 1 },
  pageSubtitle: { color: '#667085', fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 3 },
  serviceSummary: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryStat: { flex: 1, minHeight: 88, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E8F0', borderRadius: 16, padding: 10 },
  summaryIcon: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { color: palette.navy, fontSize: 18, fontWeight: '900', marginTop: 6 },
  summaryLabel: { color: '#667085', fontSize: 8.5, lineHeight: 11, fontWeight: '800', marginTop: 1 },
  searchSection: { marginBottom: 10 },
  filterScroller: { maxHeight: 42, marginBottom: 12 },
  filterWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14 },
  filterChip: { height: 34, borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy },
  filterText: { color: palette.slate, fontSize: 10.5, fontWeight: '900' },
  filterTextActive: { color: '#FFF' },
  claimCard: { borderWidth: 1, borderColor: '#DFE7F1', borderRadius: 19, padding: 13, marginBottom: 10, backgroundColor: '#FFF', shadowColor: palette.ink, shadowOpacity: 0.05, shadowRadius: 9, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  claimIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  vehicleNo: { color: palette.navy, fontSize: 16, fontWeight: '900' },
  claimControl: { color: '#667085', fontSize: 9.5, fontWeight: '800', marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  serviceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99 },
  serviceBadgeText: { fontSize: 7.5, fontWeight: '900' },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99 },
  stageBadgeText: { fontSize: 7.5, fontWeight: '900' },
  currentStatusBox: { backgroundColor: '#F7F9FC', borderRadius: 13, padding: 10, marginTop: 10 },
  currentStatusLabel: { color: '#8A95A5', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  currentStatusValue: { color: palette.navy, fontSize: 11.5, fontWeight: '900', marginTop: 2 },
  currentStatusHint: { color: '#8A5B00', fontSize: 8.5, lineHeight: 12, fontWeight: '700', marginTop: 4 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 7 },
  infoItem: { width: '50%', paddingVertical: 6, paddingRight: 7 },
  infoLabel: { color: '#8A95A5', fontSize: 8, fontWeight: '800' },
  infoValue: { color: '#344054', fontSize: 9.5, fontWeight: '800', marginTop: 2 },
  warning: { flexDirection: 'row', gap: 6, alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: '#FFF1F0', marginTop: 6 },
  warningText: { color: '#B42318', fontSize: 9, fontWeight: '800' },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 5, borderTopWidth: 1, borderTopColor: '#EEF1F5', marginTop: 7, paddingTop: 9 },
  footerText: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900' },
});