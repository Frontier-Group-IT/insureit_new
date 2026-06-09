import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Card, LoadingState, NavLink, Row, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser, getProfile, isValidProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Customer, Profile } from '@/lib/types';

export default function CustomerHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [counts, setCounts] = useState({ vehicles: 0, policies: 0, claims: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextProfile = await getProfile(session.user.id);
      if (!isValidProfile(nextProfile) || nextProfile.role !== 'customer') return router.replace('/access-denied');
      const nextCustomer = await getCustomerForUser(session.user.id);
      setProfile(nextProfile);
      setCustomer(nextCustomer);
      if (nextCustomer) {
        const [vehicles, policies, claims] = await Promise.all([
          supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('customer_id', nextCustomer.id),
          supabase.from('policies').select('id', { count: 'exact', head: true }).eq('customer_id', nextCustomer.id),
          supabase.from('claims').select('id', { count: 'exact', head: true }).eq('customer_id', nextCustomer.id),
        ]);
        setCounts({ vehicles: vehicles.count ?? 0, policies: policies.count ?? 0, claims: claims.count ?? 0 });
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) return <Screen title="Customer home" showLogout><LoadingState /></Screen>;

  return (
    <Screen title="Customer home" subtitle={`Welcome${profile?.full_name ? `, ${profile.full_name}` : ''}.`} showLogout>
      <Card>
        <Row label="Customer" value={customer?.contact_name ?? profile?.full_name} />
        <Row label="Vehicles" value={counts.vehicles} />
        <Row label="Policies" value={counts.policies} />
        <Row label="Claims" value={counts.claims} />
      </Card>
      <NavLink href="/customer/profile" label="My Profile" />
      <NavLink href="/customer/vehicles" label="My Vehicles" />
      <NavLink href="/customer/policies" label="My Policies" />
      <NavLink href="/customer/report-accident" label="Report Accident" />
      <NavLink href="/customer/upload-documents" label="Upload Claim Documents" />
      <NavLink href="/customer/claims" label="My Claims" />
      <NavLink href="/customer/support" label="Support / Contact" />
    </Screen>
  );
}
