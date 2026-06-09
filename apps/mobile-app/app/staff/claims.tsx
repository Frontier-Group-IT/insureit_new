import { Link } from 'expo-router';
import { useEffect, useState } from 'react';

import { Card, EmptyState, LoadingState, Row, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Claim } from '@/lib/types';

export default function StaffClaimsScreen() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('claims').select('*').order('created_at', { ascending: false }).limit(50);
      setClaims(data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) return <Screen title="Claims List"><LoadingState /></Screen>;

  return (
    <Screen title="Claims List" showLogout>
      {claims.length === 0 ? <EmptyState title="No claims found" body="Submitted claims will appear here for review." /> : claims.map((claim) => (
        <Link key={claim.id} href={{ pathname: '/staff/claim-detail', params: { id: claim.id } }} asChild>
          <Card>
            <Row label="Claim number" value={claim.claim_no} />
            <Row label="Status" value={claim.current_status} />
            <Row label="Assigned" value={claim.assigned_to ? 'Assigned' : 'Unassigned'} />
          </Card>
        </Link>
      ))}
    </Screen>
  );
}
