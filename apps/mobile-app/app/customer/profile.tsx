import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Card, LoadingState, Row, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser, getProfile } from '@/lib/auth';
import { roleLabels } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { Customer, Profile } from '@/lib/types';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextProfile = await getProfile(session.user.id);
      setProfile(nextProfile);
      setCustomer(await getCustomerForUser(session.user.id));
      if (nextProfile?.reporting_manager_id) {
        const { data } = await supabase.from('profiles').select('full_name').eq('id', nextProfile.reporting_manager_id).maybeSingle<{ full_name: string }>();
        setManagerName(data?.full_name ?? null);
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) return <Screen title="My Profile"><LoadingState /></Screen>;

  return (
    <Screen title="My Profile" subtitle="Your contact details for policy and claim updates." showLogout>
      <Card>
        <Row label="Name" value={customer?.contact_name ?? profile?.full_name} />
        <Row label="Role" value={profile?.role ? roleLabels[profile.role] : null} />
        <Row label="Reporting manager" value={managerName ?? 'Not assigned'} />
        <Row label="Company" value={customer?.company_name} />
        <Row label="Phone" value={customer?.phone ?? profile?.phone} />
        <Row label="Email" value={customer?.email ?? profile?.email} />
        <Row label="Address" value={[customer?.address, customer?.city, customer?.state, customer?.postal_code].filter(Boolean).join(', ')} />
      </Card>
    </Screen>
  );
}
