import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { Policy } from '@/lib/types';

export default function PoliciesScreen() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const { data } = await supabase.from('policies').select('*').eq('customer_id', customer.id).order('end_date', { ascending: true });
        setPolicies(data ?? []);
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) return <Screen title="My Policies"><LoadingState /></Screen>;

  return (
    <Screen title="My Policies" subtitle={`${policies.length} polic${policies.length === 1 ? 'y' : 'ies'}`} showLogout>
      {policies.length === 0 ? <EmptyState title="No policies yet" body="Policy records will appear here." /> : policies.map((policy) => (
        <View key={policy.id} style={styles.policyRow}>
          <View style={styles.policyIcon}>
            <MaterialCommunityIcons name="shield-outline" size={21} color={palette.emerald} />
          </View>
          <View style={styles.policyCopy}>
            <Text style={styles.policyNo}>{policy.policy_no}</Text>
            <Text style={styles.policyMeta} numberOfLines={1}>{policy.policy_type || 'Policy'} · Ends {formatDate(policy.end_date)}</Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, padding: 11, marginBottom: 8 },
  policyIcon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  policyCopy: { flex: 1, minWidth: 0 },
  policyNo: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  policyMeta: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 3 },
});
