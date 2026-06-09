import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Card, EmptyState, LoadingState, Row, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Claim } from '@/lib/types';

export default function ClaimsScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const { data } = await supabase.from('claims').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
        setClaims(data ?? []);
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) return <Screen title="My Claims"><LoadingState /></Screen>;

  return (
    <Screen title="My Claims" showLogout>
      {claims.length === 0 ? <EmptyState title="No claims yet" body="When you report an accident, your claim progress appears here." /> : claims.map((claim) => (
        <Link key={claim.id} href={{ pathname: '/customer/claim-detail', params: { id: claim.id } }} asChild>
          <Card>
            <Row label="Claim number" value={claim.claim_no} />
            <Row label="Status" value={claim.current_status} />
            <Row label="Accident location" value={claim.accident_location} />
          </Card>
        </Link>
      ))}
    </Screen>
  );
}
