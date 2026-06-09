import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, EmptyState, LoadingState, Row, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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
    <Screen title="My Policies" showLogout>
      <Link href="/customer/add-policy" asChild><Button label="Add Policy" onPress={() => undefined} /></Link>
      {policies.length === 0 ? <EmptyState title="No policies yet" body="Add your active policy to speed up claim reporting." /> : policies.map((policy) => (
        <Card key={policy.id}>
          <Row label="Policy number" value={policy.policy_no} />
          <Row label="Type" value={policy.policy_type} />
          <Row label="Start date" value={policy.start_date} />
          <Row label="End date" value={policy.end_date} />
        </Card>
      ))}
    </Screen>
  );
}
