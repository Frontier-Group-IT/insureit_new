import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, LoadingState, Row, Screen } from '@/components/ui';
import { getCurrentSession, getProfile, signOut } from '@/lib/auth';
import { roleLabels } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function ItProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextProfile = await getProfile(session.user.id);
      setProfile(nextProfile);
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
    <Screen title="My Profile" subtitle="Your access and organization details.">
      <Card>
        <Row label="Name" value={profile?.full_name} />
        <Row label="Email" value={profile?.email} />
        <Row label="Role" value={profile?.role ? roleLabels[profile.role] : null} />
        <Row label="Employee code" value={profile?.employee_code} />
        <Row label="Department" value={profile?.department} />
        <Row label="Designation" value={profile?.designation} />
        <Row label="Reporting manager" value={managerName ?? 'Not assigned'} />
        <Row label="Status" value={profile?.is_active ? 'Active' : 'Inactive'} />
      </Card>
      <Button label="Back to control center" variant="secondary" onPress={() => router.replace('/it/dashboard')} />
      <Button label="Sign out" variant="danger" onPress={() => void signOut(router)} />
    </Screen>
  );
}
