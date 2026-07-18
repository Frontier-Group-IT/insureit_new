import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { InsuranceCompany, Policy, Vehicle } from '@/lib/types';

export default function PoliciesScreen() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const ids = contexts.map((context) => context.customer_id);
      if (ids.length) {
        const [policyResult, vehicleResult, companyResult] = await Promise.all([
          supabase.from('policies').select('*').in('customer_id', ids).order('end_date', { ascending: true }),
          supabase.from('vehicles').select('*').in('customer_id', ids),
          supabase.from('insurance_companies').select('*'),
        ]);
        if (!active) return;
        setPolicies(policyResult.data ?? []);
        setVehicles(vehicleResult.data ?? []);
        setCompanies(companyResult.data ?? []);
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  if (loading) return <Screen title="My Policies"><LoadingState /></Screen>;

  return (
    <Screen title="My Policies" subtitle={`${policies.length} polic${policies.length === 1 ? 'y' : 'ies'}`} showLogout>
      {policies.length === 0 ? <EmptyState title="No policies yet" body="Policy records will appear here." /> : policies.map((policy) => {
        const vehicle = vehicles.find((item) => item.id === policy.vehicle_id);
        const company = companies.find((item) => item.id === policy.insurance_company_id);
        const days = daysUntil(policy.end_date);
        const tone = days < 0 ? 'expired' : days <= 30 ? 'due' : 'active';
        return (
          <Pressable key={policy.id} onPress={() => router.push({ pathname: '/customer/policy-detail', params: { id: policy.id } } as any)} style={({ pressed }) => [styles.policyRow, pressed && styles.policyRowPressed]}>
            <View style={styles.policyIcon}>
              <MaterialCommunityIcons name="shield-outline" size={21} color={palette.emerald} />
            </View>
            <View style={styles.policyCopy}>
              <Text style={styles.vehicleNo}>{vehicle?.vehicle_no ?? 'Vehicle unavailable'}</Text>
              <Text style={styles.insurerName} numberOfLines={1}>{company?.name ?? 'Insurer pending'}</Text>
              <Text style={styles.policyMeta} numberOfLines={1}>{policy.policy_no} - {policy.policy_type || 'Policy'} - Ends {formatDate(policy.end_date)}</Text>
            </View>
            <View style={[styles.statusPill, tone === 'expired' && styles.statusExpired, tone === 'due' && styles.statusDue]}>
              <Text style={[styles.statusText, tone === 'expired' && styles.statusExpiredText, tone === 'due' && styles.statusDueText]}>{tone === 'expired' ? 'Expired' : tone === 'due' ? 'Renewal' : 'Active'}</Text>
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

const styles = StyleSheet.create({
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radii.md, padding: 12, marginBottom: 9, shadowColor: '#10233F', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  policyRowPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  policyIcon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  policyCopy: { flex: 1, minWidth: 0 },
  vehicleNo: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  insurerName: { color: palette.navy, fontSize: 12.5, fontWeight: '800', marginTop: 2 },
  policyMeta: { color: palette.slate, fontSize: 11.5, fontWeight: '600', marginTop: 3 },
  statusPill: { borderRadius: 999, backgroundColor: palette.emeraldSoft, paddingHorizontal: 9, paddingVertical: 5 },
  statusExpired: { backgroundColor: '#FDECEC' },
  statusDue: { backgroundColor: '#FFF4E2' },
  statusText: { color: palette.emerald, fontSize: 9.5, fontWeight: '900' },
  statusExpiredText: { color: '#C43838' },
  statusDueText: { color: '#B7791F' },
});
