import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppSearchBar } from '@/components/design-system';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, ClaimStatus, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

type ClaimFilter = 'All' | 'Open' | 'Action Required' | 'Completed';
type CustomerClaim = Claim & {
  claim_service_mode?: 'broker_managed' | 'self_managed' | null;
  assistance_status?: 'not_requested' | 'requested' | 'accepted' | 'declined' | 'cancelled' | null;
};

export default function ClaimsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const requestedFilter = validClaimFilter(typeof params.filter === 'string' ? params.filter : undefined);
  const [claims, setClaims] = useState<CustomerClaim[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClaimFilter>(requestedFilter);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFilter(requestedFilter);
  }, [requestedFilter]);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const [claimResult, vehicleResult, policyResult, insurerResult] = await Promise.all([
          supabase.from('claims').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
          supabase.from('vehicles').select('*').eq('customer_id', customer.id),
          supabase.from('policies').select('*').eq('customer_id', customer.id),
          supabase.from('insurance_companies').select('*'),
        ]);
        setClaims((claimResult.data ?? []) as CustomerClaim[]);
        setVehicles(vehicleResult.data ?? []);
        setPolicies(policyResult.data ?? []);
        setInsurers(insurerResult.data ?? []);
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  const filteredClaims = useMemo(() => {
    const search = query.trim().toLowerCase();
    return claims.filter((claim) => {
      if (!matchesFilter(claim, filter)) return false;
      const vehicle = vehicles.find((item) => item.id === claim.vehicle_id);
      const policy = policies.find((item) => item.id === claim.policy_id);
      const insurerId = claim.insurance_company_id || policy?.insurance_company_id;
      const insurer = insurers.find((item) => item.id === insurerId);
      const haystack = [claim.claim_no, claim.insurer_claim_no, claim.current_status, claim.accident_location, vehicle?.vehicle_no, vehicle?.make, vehicle?.model, policy?.policy_no, insurer?.name].filter(Boolean).join(' ').toLowerCase();
      return !search || haystack.includes(search);
    });
  }, [claims, filter, insurers, policies, query, vehicles]);

  if (loading) return <Screen title="My Claims"><LoadingState /></Screen>;

  return (
    <Screen title="My Claims" showLogout showTitleHeader={false}>
      <View style={styles.pageHeader}>
        <Text style={styles.eyebrow}>CLAIMS</Text>
        <Text style={styles.pageTitle}>My Claims</Text>
        <Text style={styles.pageSubtitle}>Track active claims, actions and completed settlements.</Text>
      </View>

      <AppSearchBar value={query} onChangeText={setQuery} placeholder="Search vehicle, control or claim no." />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterWrap}>
        {(['All', 'Open', 'Action Required', 'Completed'] as ClaimFilter[]).map((item) => (
          <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item} ({countForFilter(item, claims)})</Text>
          </Pressable>
        ))}
      </ScrollView>

      {claims.length === 0 ? <EmptyState title="No claims yet" body="Reported claims will appear here." /> : null}

      {filteredClaims.map((claim) => {
        const vehicle = vehicles.find((item) => item.id === claim.vehicle_id);
        const policy = policies.find((item) => item.id === claim.policy_id);
        const insurerId = claim.insurance_company_id || policy?.insurance_company_id;
        const insurer = insurers.find((item) => item.id === insurerId);
        const tone = claimTone(claim.current_status);
        const policyExpiredBeforeIncident = isIncidentAfterPolicyExpiry(claim, policy);
        const selfTracked = claim.claim_service_mode === 'self_managed';
        const completed = ['Closed', 'Settled', 'Claim Complete'].includes(claim.current_status);
        const assistanceRequested = selfTracked && !completed && claim.assistance_status === 'requested';

        return (
          <Pressable key={claim.id} accessibilityRole="button" accessibilityLabel={`Open claim ${claim.claim_no}`} onPress={() => router.push({ pathname: selfTracked ? '/customer/self-managed-claim-detail' : '/customer/claim-detail', params: { id: claim.id } })} style={[styles.claimCard, selfTracked && styles.externalCard, { borderColor: selfTracked ? '#C9DAF2' : tone.border }]}>
            <View style={[styles.accentBar, { backgroundColor: selfTracked ? '#0A43A3' : tone.accent }]} />

            <View style={styles.claimTop}>
              <View style={[styles.statusIcon, { backgroundColor: selfTracked ? '#EEF5FF' : tone.soft }]}>
                <MaterialCommunityIcons name={selfTracked ? 'timeline-check-outline' : statusIcon(claim.current_status)} size={22} color={selfTracked ? '#0A43A3' : tone.accent} />
              </View>
              <View style={styles.claimTitleCopy}>
                <Text style={[styles.modeLabel, { color: selfTracked ? '#0A43A3' : tone.accent }]}>{selfTracked ? 'SELF TRACKED' : claimStageLabel(claim.current_status)}</Text>
                <Text style={styles.vehicleNo} numberOfLines={1}>{vehicle?.vehicle_no ?? 'Vehicle linked'}</Text>
                <Text style={styles.vehicleMeta} numberOfLines={1}>{[vehicle?.make, vehicle?.model].filter(Boolean).join(' · ') || insurer?.name || 'Claim record'}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={21} color={selfTracked ? '#0A43A3' : tone.accent} />
            </View>

            <View style={styles.identityRow}>
              <View style={styles.identityBlock}><Text style={styles.identityLabel}>CONTROL NO.</Text><Text style={styles.identityValue} numberOfLines={1}>{claim.claim_no}</Text></View>
              <View style={styles.identityBlock}><Text style={styles.identityLabel}>CLAIM NO.</Text><Text style={styles.identityValue} numberOfLines={1}>{claim.insurer_claim_no || 'Awaiting insurer'}</Text></View>
            </View>

            <View style={styles.currentRow}>
              <View style={styles.currentCopy}>
                <Text style={styles.currentLabel}>{selfTracked ? 'CURRENT MILESTONE' : 'CURRENT STATUS'}</Text>
                <Text style={styles.currentValue}>{claim.current_status}</Text>
              </View>
              <View style={styles.incidentCopy}>
                <Text style={styles.currentLabel}>INCIDENT</Text>
                <Text style={styles.incidentValue}>{claim.accident_at ? formatDate(claim.accident_at) : '-'}</Text>
              </View>
            </View>

            {assistanceRequested ? <View style={styles.assistancePill}><MaterialCommunityIcons name="clock-outline" size={13} color="#805700" /><Text style={styles.assistancePillText}>Assistance requested</Text></View> : null}
            {policyExpiredBeforeIncident ? <View style={styles.expiredClaimWarning}><MaterialCommunityIcons name="alert-octagon-outline" size={16} color="#B42318" /><Text style={styles.expiredClaimWarningText}>Policy expired before loss date</Text></View> : null}

            {!selfTracked ? <Text style={styles.managedMeta} numberOfLines={1}>{[policy?.policy_no, insurer?.name].filter(Boolean).join(' · ')}</Text> : null}
          </Pressable>
        );
      })}

      {claims.length > 0 && filteredClaims.length === 0 ? <EmptyState title="No matching claim" body="Try another search or filter." /> : null}
    </Screen>
  );
}

function validClaimFilter(value?: string): ClaimFilter {
  return value === 'Open' || value === 'Action Required' || value === 'Completed' || value === 'All' ? value : 'All';
}

function matchesFilter(claim: CustomerClaim, filter: ClaimFilter) {
  if (filter === 'All') return true;
  if (filter === 'Completed') return ['Closed', 'Settled', 'Claim Complete'].includes(claim.current_status);
  if (filter === 'Action Required') return claim.current_status.includes('Document') || claim.current_status.includes('Awaited') || claim.current_status.includes('Pending');
  return !['Closed', 'Settled', 'Claim Complete', 'Rejected'].includes(claim.current_status);
}
function countForFilter(filter: ClaimFilter, claims: CustomerClaim[]) { return claims.filter((claim) => matchesFilter(claim, filter)).length; }
function claimStageLabel(status: ClaimStatus) { if (status.includes('Document') || status.includes('Awaited')) return 'DOCUMENT STAGE'; if (status.includes('Survey') || status.includes('Inspected')) return 'SURVEY STAGE'; if (status.includes('Approval') || status.includes('Estimate')) return 'APPROVAL STAGE'; if (status.includes('Repair') || status.includes('DO') || status.includes('RA')) return 'REPAIR / DO STAGE'; if (status.includes('Payment') || status.includes('Settlement')) return 'PAYMENT STAGE'; if (status === 'Closed' || status === 'Settled' || status === 'Claim Complete') return 'COMPLETED'; return 'CLAIM STAGE'; }
function claimTone(status: ClaimStatus) { if (status === 'Closed' || status === 'Settled' || status === 'Claim Complete') return { accent: '#12805C', soft: '#E8F8F0', border: '#BFEBD0' }; if (status === 'Rejected') return { accent: '#C43838', soft: '#FDECEC', border: '#F2C6C6' }; if (status.includes('Payment') || status.includes('Settlement')) return { accent: '#B7791F', soft: '#FFF4E2', border: '#F7DCA2' }; if (status.includes('Repair') || status.includes('DO') || status.includes('RA')) return { accent: '#7C3AED', soft: '#F0E9FF', border: '#D8C8FF' }; if (status.includes('Document') || status.includes('Awaited')) return { accent: '#C83272', soft: '#FFF0F6', border: '#F8BFD7' }; return { accent: '#0B63CE', soft: '#EEF5FF', border: '#CFE0FF' }; }
function statusIcon(status: ClaimStatus): keyof typeof MaterialCommunityIcons.glyphMap { if (status.includes('Document')) return 'file-document-check-outline'; if (status.includes('Survey')) return 'clipboard-search-outline'; if (status.includes('Repair')) return 'wrench-outline'; if (status.includes('Payment') || status.includes('Settlement')) return 'bank-transfer'; if (status === 'Closed' || status === 'Settled' || status === 'Claim Complete') return 'check-circle-outline'; if (status === 'Rejected') return 'close-circle-outline'; return 'shield-check-outline'; }
function formatDate(value?: string | null) { if (!value) return '-'; return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function isIncidentAfterPolicyExpiry(claim: CustomerClaim, policy?: Policy | null) { const incident = claim.accident_at ? new Date(claim.accident_at) : null; const expiry = policyExpiryEndOfDay(policy?.end_date); if (!incident || Number.isNaN(incident.getTime()) || !expiry) return false; return incident.getTime() > expiry.getTime(); }
function policyExpiryEndOfDay(value?: string | null) { if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null; const [year, month, day] = value.slice(0, 10).split('-').map(Number); const parsed = new Date(year, month - 1, day, 23, 59, 59, 999); return Number.isNaN(parsed.getTime()) ? null : parsed; }

const styles = StyleSheet.create({
  pageHeader: { marginBottom: 12 }, eyebrow: { color: '#0A43A3', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, pageTitle: { color: palette.navy, fontSize: 24, fontWeight: '900', marginTop: 2 }, pageSubtitle: { color: '#667085', fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  filterScroller: { maxHeight: 44, marginTop: 10, marginBottom: 12 }, filterWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14 }, filterChip: { minHeight: 36, borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' }, filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy }, filterText: { color: palette.slate, fontSize: 11, fontWeight: '900' }, filterTextActive: { color: '#FFFFFF' },
  claimCard: { borderWidth: 1, borderRadius: 17, padding: 12, paddingLeft: 17, marginBottom: 10, overflow: 'hidden', backgroundColor: '#FFFFFF' }, externalCard: { backgroundColor: '#FBFDFF' }, accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 }, claimTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, statusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, claimTitleCopy: { flex: 1, minWidth: 0 }, modeLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 }, vehicleNo: { color: palette.navy, fontSize: 17, fontWeight: '900', marginTop: 1 }, vehicleMeta: { color: '#7A8799', fontSize: 10, fontWeight: '600', marginTop: 2 }, identityRow: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F6', flexDirection: 'row', gap: 12 }, identityBlock: { flex: 1, minWidth: 0 }, identityLabel: { color: '#98A2B3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 }, identityValue: { color: '#344054', fontSize: 10.8, fontWeight: '900', marginTop: 2 }, currentRow: { marginTop: 10, borderRadius: 12, backgroundColor: '#F8FAFC', padding: 9, flexDirection: 'row', gap: 10 }, currentCopy: { flex: 1, minWidth: 0 }, incidentCopy: { alignItems: 'flex-end' }, currentLabel: { color: '#98A2B3', fontSize: 8.3, fontWeight: '900', letterSpacing: 0.4 }, currentValue: { color: palette.navy, fontSize: 11.2, fontWeight: '900', marginTop: 2 }, incidentValue: { color: '#344054', fontSize: 10.5, fontWeight: '800', marginTop: 2 }, assistancePill: { alignSelf: 'flex-start', marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#FFF4CC', paddingHorizontal: 9, paddingVertical: 5 }, assistancePillText: { color: '#805700', fontSize: 9, fontWeight: '900' }, expiredClaimWarning: { marginTop: 9, borderRadius: 10, backgroundColor: '#FFF1F0', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, expiredClaimWarningText: { color: '#B42318', fontSize: 9.5, fontWeight: '900' }, managedMeta: { color: '#7A8799', fontSize: 9.5, fontWeight: '600', marginTop: 8 },
});
