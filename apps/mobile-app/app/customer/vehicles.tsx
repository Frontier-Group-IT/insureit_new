import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { customerAccountTitle, partnerTypeLabel } from '@/lib/customer-context';
import { getSelectedCustomerRecord } from '@/lib/selected-customer';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { Claim, Policy, Vehicle } from '@/lib/types';

export default function VehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const selected = await getSelectedCustomerRecord();
        if (!selected) {
          if (active) setError('No active customer account is available.');
          return;
        }
        if (!active) return;
        setAccountName(customerAccountTitle(selected.context));
        setAccountType(partnerTypeLabel(selected.context.partner_type));
        setIsGroup(selected.context.partner_type === 'group');

        const [vehicleResult, policyResult, claimResult] = await Promise.all([
          supabase.from('vehicles').select('*').eq('customer_id', selected.customer.id).order('created_at', { ascending: false }),
          supabase.from('policies').select('*').eq('customer_id', selected.customer.id),
          supabase.from('claims').select('*').eq('customer_id', selected.customer.id),
        ]);
        if (!active) return;
        if (vehicleResult.error || policyResult.error || claimResult.error) throw vehicleResult.error ?? policyResult.error ?? claimResult.error;
        setVehicles(vehicleResult.data ?? []);
        setPolicies(policyResult.data ?? []);
        setClaims(claimResult.data ?? []);
      } catch (nextError) {
        console.warn('Vehicles load failed', nextError);
        if (active) setError('We could not load vehicles for this account.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const expiringSoon = useMemo(() => policies.filter((policy) => {
    const end = new Date(policy.end_date);
    const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  }).length, [policies]);

  const title = isGroup ? 'Group Fleet' : 'My Vehicles';
  if (loading) return <Screen title={title}><LoadingState /></Screen>;

  return (
    <Screen title={title} showLogout showTitleHeader={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.account} numberOfLines={1}>{accountName || 'Selected account'} · {accountType}</Text>
          <Text style={styles.subtitle}>{vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}{expiringSoon ? ` · ${expiringSoon} renewal${expiringSoon === 1 ? '' : 's'} due soon` : ''}</Text>
        </View>
        <Pressable onPress={() => router.push('/customer/support')} style={styles.addButton}>
          <MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Vehicle</Text>
        </Pressable>
      </View>

      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
      {!error && vehicles.length === 0 ? <EmptyState title="No vehicles yet" body={`Vehicle records for ${accountName || 'this account'} will appear here.`} /> : null}

      {vehicles.map((vehicle) => {
        const vehiclePolicies = policies.filter((policy) => policy.vehicle_id === vehicle.id);
        const latestPolicy = vehiclePolicies.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
        const openClaims = claims.filter((claim) => claim.vehicle_id === vehicle.id && !['Closed', 'Settled', 'Rejected', 'Claim Complete'].includes(claim.current_status)).length;
        return (
          <View key={vehicle.id} style={styles.card}>
            <View style={styles.icon}><MaterialCommunityIcons name="truck-outline" size={27} color={palette.navy} /></View>
            <View style={styles.copy}>
              <Text style={styles.vehicleNo}>{vehicle.vehicle_no}</Text>
              <Text style={styles.meta} numberOfLines={1}>{[vehicle.make, vehicle.model, vehicle.vehicle_type].filter(Boolean).join(' · ') || 'Commercial vehicle'}</Text>
              <Text style={styles.policy}>{latestPolicy ? `Policy ${latestPolicy.policy_no} · expires ${formatDate(latestPolicy.end_date)}` : 'No active policy linked'}</Text>
              {openClaims ? <Text style={styles.claims}>{openClaims} open claim{openClaims === 1 ? '' : 's'}</Text> : null}
            </View>
            <Pressable onPress={() => router.push({ pathname: '/customer/report-accident', params: { vehicleId: vehicle.id } })} style={styles.claimButton}>
              <MaterialCommunityIcons name="file-plus-outline" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        );
      })}
    </Screen>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  header: { marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: palette.navy, fontSize: 22, fontWeight: '900' },
  account: { marginTop: 3, color: '#334155', fontSize: 12, fontWeight: '800' },
  subtitle: { marginTop: 3, color: palette.slate, fontSize: 11.5, fontWeight: '600' },
  addButton: { minHeight: 38, borderRadius: 11, paddingHorizontal: 12, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  errorCard: { borderRadius: radii.sm, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 12 },
  errorText: { color: '#B42318', fontSize: 12, fontWeight: '700' },
  card: { marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: '#DCE5F0', backgroundColor: '#FFFFFF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  vehicleNo: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  meta: { marginTop: 2, color: palette.slate, fontSize: 11.5, fontWeight: '700' },
  policy: { marginTop: 5, color: '#334155', fontSize: 10.5, fontWeight: '600' },
  claims: { marginTop: 3, color: '#B45309', fontSize: 10.5, fontWeight: '800' },
  claimButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#D97706', alignItems: 'center', justifyContent: 'center' },
});