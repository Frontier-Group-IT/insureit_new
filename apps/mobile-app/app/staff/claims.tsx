import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppSearchBar } from '@/components/design-system';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { claimStatuses } from '@/lib/auth';
import { isOpenClaimStatus, operationsQueueForKey, queueForStatus, stageAgeLabel, terminalClaimStatuses } from '@/lib/claim-workflow';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { Claim, ClaimStatus, Customer, Vehicle } from '@/lib/types';

export default function StaffClaimsScreen() {
  const params = useLocalSearchParams<{ queue?: string }>();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [claimsResult, customersResult, vehiclesResult] = await Promise.all([
        supabase.from('claims').select('*').order('created_at', { ascending: false }).limit(75),
        supabase.from('customers').select('*'),
        supabase.from('vehicles').select('*'),
      ]);
      setClaims(claimsResult.data ?? []);
      setCustomers(customersResult.data ?? []);
      setVehicles(vehiclesResult.data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  const filteredClaims = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const selectedOperationsQueue = operationsQueueForKey(params.queue);
    return claims.filter((claim) => {
      const customer = customers.find((item) => item.id === claim.customer_id);
      const vehicle = vehicles.find((item) => item.id === claim.vehicle_id);
      const haystack = [claim.claim_no, claim.current_status, customer?.contact_name, customer?.company_name, vehicle?.vehicle_no].filter(Boolean).join(' ').toLowerCase();
      const matchesDashboardQueue =
        !params.queue ||
        (selectedOperationsQueue && selectedOperationsQueue.statuses.includes(claim.current_status)) ||
        (params.queue === 'active' && isOpenClaimStatus(claim.current_status)) ||
        (params.queue === 'closed' && terminalClaimStatuses.includes(claim.current_status)) ||
        (params.queue === 'customer-action' && isCustomerActionAwaited(claim.current_status)) ||
        (params.queue === 'manager-action' && isManagerActionRequired(claim));
      return matchesDashboardQueue && (!normalizedQuery || haystack.includes(normalizedQuery)) && (statusFilter === 'All' || claim.current_status === statusFilter);
    });
  }, [claims, customers, params.queue, query, statusFilter, vehicles]);

  if (loading) return <Screen title="Claims"><LoadingState /></Screen>;

  return (
    <Screen title={titleForQueue(params.queue)} subtitle={`${filteredClaims.length} visible`} showLogout>
      <AppSearchBar value={query} onChangeText={setQuery} placeholder="Search claim, customer, vehicle" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterWrap}>
        {['All', ...claimStatuses].map((status) => (
          <Pressable key={status} accessibilityRole="button" onPress={() => setStatusFilter(status)} style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}>
            <Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]} numberOfLines={1}>{status}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {claims.length === 0 ? <EmptyState title="No claims found" body="Submitted claims will appear here." /> : filteredClaims.map((claim) => {
        const customer = customers.find((item) => item.id === claim.customer_id);
        const vehicle = vehicles.find((item) => item.id === claim.vehicle_id);
        const queue = queueForStatus(claim.current_status);
        return (
          <Link key={claim.id} href={{ pathname: '/staff/claim-detail', params: { id: claim.id } }} asChild>
            <Pressable style={styles.claimRow}>
              <View style={[styles.claimIcon, { backgroundColor: toneBackground(queue.tone) }]}>
                <MaterialCommunityIcons name={queue.icon} size={19} color={toneColor(queue.tone)} />
              </View>
              <View style={styles.claimCopy}>
                <View style={styles.claimTop}>
                  <Text style={styles.claimNo} numberOfLines={1}>{claim.claim_no}</Text>
                  <AppBadge label={claim.current_status} tone={queue.tone} />
                </View>
                <Text style={styles.claimMeta} numberOfLines={1}>{customer?.contact_name ?? customer?.company_name ?? 'Customer'} Â· {vehicle?.vehicle_no ?? 'Vehicle'}</Text>
                <Text style={styles.claimAge}>{claim.assigned_to ? 'Assigned' : 'Unassigned'} Â· {stageAgeLabel(claim.updated_at ?? claim.created_at)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={palette.slate} />
            </Pressable>
          </Link>
        );
      })}
      {claims.length > 0 && filteredClaims.length === 0 ? <EmptyState title="No matching claims" body="Adjust search or status." /> : null}
    </Screen>
  );
}

const customerActionAwaitedStatuses: ClaimStatus[] = ['Initial Documents Pending', 'Documents Pending', 'Final Documents Awaited'];

function isCustomerActionAwaited(status: ClaimStatus) {
  return customerActionAwaitedStatuses.includes(status);
}

function isManagerActionRequired(claim: Claim) {
  return isOpenClaimStatus(claim.current_status) && !isCustomerActionAwaited(claim.current_status);
}

function titleForQueue(queue?: string) {
  const operationsQueue = operationsQueueForKey(queue);
  if (operationsQueue) return operationsQueue.label;
  if (queue === 'active') return 'Active Claims';
  if (queue === 'closed') return 'Closed Cases';
  if (queue === 'customer-action') return 'Customer Action Awaited';
  if (queue === 'manager-action') return 'Our Action Required';
  return 'Claims';
}

function toneBackground(tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral') {
  if (tone === 'success') return palette.emeraldSoft;
  if (tone === 'warning') return palette.amberSoft;
  if (tone === 'danger') return palette.coralSoft;
  return palette.blueSoft;
}

function toneColor(tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral') {
  if (tone === 'success') return palette.emerald;
  if (tone === 'warning') return palette.amber;
  if (tone === 'danger') return palette.coral;
  return palette.blue;
}

const styles = StyleSheet.create({
  filterScroller: { maxHeight: 46, marginBottom: 10 },
  filterWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 14 },
  filterChip: { height: 38, borderRadius: 999, paddingHorizontal: 13, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: palette.blueSoft, borderColor: '#B9D5FF' },
  filterText: { color: palette.slate, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  filterTextActive: { color: palette.blue },
  claimRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, padding: 11, marginBottom: 8 },
  claimIcon: { width: 38, height: 38, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  claimCopy: { flex: 1, minWidth: 0 },
  claimTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  claimNo: { color: palette.ink, fontSize: 14, fontWeight: '700', flex: 1 },
  claimMeta: { color: palette.ink, fontSize: 13, fontWeight: '500', marginTop: 4 },
  claimAge: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 3 },
});


