import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppSearchBar } from '@/components/design-system';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, type CustomerAccountContext } from '@/lib/customer-context';
import { getSelectedCustomerRecord, selectedAccountScreenTitle } from '@/lib/selected-customer';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, ClaimStatus, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

type ClaimFilter = 'All' | 'Open' | 'Action Required' | 'Completed';

export default function ClaimsScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [context, setContext] = useState<CustomerAccountContext | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClaimFilter>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const selected = await getSelectedCustomerRecord();
      setContext(selected?.context ?? null);
      if (selected) {
        const [claimResult, vehicleResult, policyResult, insurerResult] = await Promise.all([
          supabase.from('claims').select('*').eq('customer_id', selected.customer.id).order('created_at', { ascending: false }),
          supabase.from('vehicles').select('*').eq('customer_id', selected.customer.id),
          supabase.from('policies').select('*').eq('customer_id', selected.customer.id),
          supabase.from('insurance_companies').select('*'),
        ]);

        setClaims(claimResult.data ?? []);
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

      const haystack = [
        claim.claim_no,
        claim.insurer_claim_no,
        claim.current_status,
        claim.accident_location,
        vehicle?.vehicle_no,
        vehicle?.make,
        vehicle?.model,
        policy?.policy_no,
        insurer?.name,
      ].filter(Boolean).join(' ').toLowerCase();

      return !search || haystack.includes(search);
    });
  }, [claims, filter, insurers, policies, query, vehicles]);

  const title = selectedAccountScreenTitle(context, 'My Claims');
  if (loading) return <Screen title={title}><LoadingState /></Screen>;

  return (
    <Screen title={title} showLogout showTitleHeader={false}>
      <View style={styles.accountLine}><Text style={styles.accountLineText}>{context ? customerAccountTitle(context) : 'Selected account'}</Text></View>
      <View style={styles.searchSection}>
        <Text style={styles.searchHeading}>Find your claim</Text>
        <AppSearchBar value={query} onChangeText={setQuery} placeholder="Search vehicle, policy, control or claim no." />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterWrap}>
        {(['All', 'Open', 'Action Required', 'Completed'] as ClaimFilter[]).map((item) => (
          <Pressable key={item} accessibilityRole="button" onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item} ({countForFilter(item, claims)})</Text>
          </Pressable>
        ))}
      </ScrollView>

      {claims.length === 0 ? <EmptyState title="No claims yet" body="Claims for the selected account will appear here." /> : null}

      {filteredClaims.map((claim) => {
        const vehicle = vehicles.find((item) => item.id === claim.vehicle_id);
        const policy = policies.find((item) => item.id === claim.policy_id);
        const insurerId = claim.insurance_company_id || policy?.insurance_company_id;
        const insurer = insurers.find((item) => item.id === insurerId);
        const tone = claimTone(claim.current_status);
        const policyExpiredBeforeIncident = isIncidentAfterPolicyExpiry(claim, policy);

        return (
          <Pressable key={claim.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/customer/claim-detail', params: { id: claim.id } })} style={[styles.claimCard, { backgroundColor: tone.background, borderColor: tone.border }]}>
            <View style={[styles.accentBar, { backgroundColor: tone.accent }]} />

            <View style={styles.claimTop}>
              <View style={[styles.statusIcon, { backgroundColor: tone.soft }]}>
                <MaterialCommunityIcons name={statusIcon(claim.current_status)} size={23} color={tone.accent} />
              </View>

              <View style={styles.claimTitleCopy}>
                <Text style={[styles.stageLabel, { color: tone.accent }]}>{claimStageLabel(claim.current_status)}</Text>
                <Text style={styles.vehicleNo} numberOfLines={1}>{vehicle?.vehicle_no ?? 'Vehicle linked'}</Text>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: tone.accent }]}>
                <Text style={styles.statusBadgeText} numberOfLines={2}>{claim.current_status}</Text>
              </View>
            </View>

            <View style={styles.numberRow}>
              <View style={styles.numberBox}>
                <Text style={styles.numberLabel}>Control No.</Text>
                <Text style={styles.numberValue} numberOfLines={2}>{claim.claim_no}</Text>
              </View>
              <View style={styles.numberBox}>
                <Text style={styles.numberLabel}>Claim No.</Text>
                <Text style={styles.numberValue} numberOfLines={2}>{claim.insurer_claim_no || 'Awaiting insurer'}</Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <InfoPair leftLabel="Manufacturer" leftValue={vehicle?.make ?? '-'} rightLabel="Model" rightValue={vehicle?.model ?? '-'} />
              <InfoPair leftLabel="Policy" leftValue={policy?.policy_no ?? '-'} rightLabel="Insurer" rightValue={insurer?.name ?? '-'} />
              <InfoPair leftLabel="Expiry" leftValue={policy ? formatDate(policy.end_date) : '-'} rightLabel="Incident Date" rightValue={claim.accident_at ? formatDate(claim.accident_at) : '-'} />
            </View>

            {policyExpiredBeforeIncident ? (
              <View style={styles.expiredClaimWarning}>
                <MaterialCommunityIcons name="alert-octagon-outline" size={16} color="#B42318" />
                <Text style={styles.expiredClaimWarningText}>Policy expired before loss date</Text>
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.footerHint}>View claim details</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={tone.accent} />
            </View>
          </Pressable>
        );
      })}

      {claims.length > 0 && filteredClaims.length === 0 ? <EmptyState title="No matching claim" body="Try another search or filter." /> : null}
    </Screen>
  );
}

function InfoPair({ leftLabel, leftValue, rightLabel, rightValue }: { leftLabel: string; leftValue: string; rightLabel: string; rightValue: string }) {
  return (
    <View style={styles.infoPairRow}>
      <View style={styles.infoPairHalf}>
        <Text style={styles.infoPairText} numberOfLines={1}><Text style={styles.infoPairLabel}>{leftLabel}: </Text>{leftValue}</Text>
      </View>
      <View style={styles.infoPairHalf}>
        <Text style={styles.infoPairText} numberOfLines={1}><Text style={styles.infoPairLabel}>{rightLabel}: </Text>{rightValue}</Text>
      </View>
    </View>
  );
}

function matchesFilter(claim: Claim, filter: ClaimFilter) {
  if (filter === 'All') return true;
  if (filter === 'Completed') return ['Closed', 'Settled', 'Claim Complete'].includes(claim.current_status);
  if (filter === 'Action Required') return claim.current_status.includes('Document') || claim.current_status.includes('Awaited') || claim.current_status.includes('Pending');
  return !['Closed', 'Settled', 'Claim Complete', 'Rejected'].includes(claim.current_status);
}

function countForFilter(filter: ClaimFilter, claims: Claim[]) {
  return claims.filter((claim) => matchesFilter(claim, filter)).length;
}

function claimStageLabel(status: ClaimStatus) {
  if (status.includes('Document') || status.includes('Awaited')) return 'DOCUMENT STAGE';
  if (status.includes('Survey') || status.includes('Inspected')) return 'SURVEY STAGE';
  if (status.includes('Approval') || status.includes('Estimate')) return 'APPROVAL STAGE';
  if (status.includes('Repair') || status.includes('DO') || status.includes('RA')) return 'REPAIR / DO STAGE';
  if (status.includes('Payment') || status.includes('Settlement')) return 'PAYMENT STAGE';
  if (status === 'Closed' || status === 'Settled') return 'COMPLETED';
  return 'CLAIM STAGE';
}

function claimTone(status: ClaimStatus) {
  if (status === 'Closed' || status === 'Settled') return { accent: '#12805C', soft: '#E8F8F0', background: '#F7FFFB', border: '#BFEBD0' };
  if (status === 'Rejected') return { accent: '#C43838', soft: '#FDECEC', background: '#FFF7F7', border: '#F2C6C6' };
  if (status.includes('Payment') || status.includes('Settlement')) return { accent: '#B7791F', soft: '#FFF4E2', background: '#FFFCF5', border: '#F7DCA2' };
  if (status.includes('Repair') || status.includes('DO') || status.includes('RA')) return { accent: '#7C3AED', soft: '#F0E9FF', background: '#FCFAFF', border: '#D8C8FF' };
  if (status.includes('Document') || status.includes('Awaited')) return { accent: '#C83272', soft: '#FFF0F6', background: '#FFF8FB', border: '#F8BFD7' };
  return { accent: '#0B63CE', soft: '#EEF5FF', background: '#F8FBFF', border: '#CFE0FF' };
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

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isIncidentAfterPolicyExpiry(claim: Claim, policy?: Policy | null) {
  const incident = claim.accident_at ? new Date(claim.accident_at) : null;
  const expiry = policyExpiryEndOfDay(policy?.end_date);
  if (!incident || Number.isNaN(incident.getTime()) || !expiry) return false;
  return incident.getTime() > expiry.getTime();
}

function policyExpiryEndOfDay(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

const styles = StyleSheet.create({
  accountLine: { marginTop: -22, marginBottom: 8 },
  accountLineText: { color: palette.slate, fontSize: 10.5, fontWeight: '800' },
  searchSection: { marginBottom: 10 },
  searchHeading: { color: palette.navy, fontSize: 13, fontWeight: '900', marginBottom: 7 },
  filterScroller: { maxHeight: 42, marginBottom: 12 },
  filterWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14 },
  filterChip: { height: 34, borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy },
  filterText: { color: palette.slate, fontSize: 11.5, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  claimCard: { borderWidth: 1, borderRadius: 18, padding: 12, paddingLeft: 17, marginBottom: 10, overflow: 'hidden', shadowColor: palette.ink, shadowOpacity: 0.055, shadowRadius: 10, elevation: 2 },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  claimTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  claimTitleCopy: { flex: 1, minWidth: 0 },
  stageLabel: { fontSize: 9.8, fontWeight: '900', letterSpacing: 0.6 },
  vehicleNo: { color: palette.ink, fontSize: 17, fontWeight: '900', marginTop: 1 },
  statusBadge: { maxWidth: 126, minHeight: 34, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  statusBadgeText: { color: '#FFFFFF', fontSize: 10.2, lineHeight: 13, fontWeight: '900', textAlign: 'center' },
  numberRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  numberBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  numberLabel: { color: palette.slate, fontSize: 9.3, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  numberValue: { color: palette.ink, fontSize: 11.7, lineHeight: 15, fontWeight: '900', marginTop: 2 },
  infoBox: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#E5ECF5', gap: 5 },
  infoPairRow: { flexDirection: 'row', gap: 8 },
  infoPairHalf: { flex: 1, minWidth: 0 },
  infoPairText: { color: palette.ink, fontSize: 11.1, lineHeight: 15, fontWeight: '800' },
  infoPairLabel: { color: palette.slate, fontSize: 10.2, fontWeight: '900' },
  expiredClaimWarning: { marginTop: 9, borderRadius: 12, borderWidth: 1, borderColor: '#FDA29B', backgroundColor: '#FEF3F2', paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  expiredClaimWarningText: { color: '#B42318', fontSize: 10.8, fontWeight: '900', flex: 1 },
  cardFooter: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#E5ECF5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerHint: { color: palette.slate, fontSize: 11.5, fontWeight: '900' },
});