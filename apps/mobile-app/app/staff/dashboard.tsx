import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Card, LoadingState, NavLink, Row, Screen } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function StaffDashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState({ claims: 0, tasks: 0, documents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextProfile = await getProfile(session.user.id);
      if (!isValidProfile(nextProfile) || nextProfile.role === 'customer') return router.replace('/access-denied');
      setProfile(nextProfile);
      const [claims, tasks, documents] = await Promise.all([
        supabase.from('claims').select('id', { count: 'exact', head: true }),
        supabase.from('claim_tasks').select('id', { count: 'exact', head: true }).neq('status', 'completed'),
        supabase.from('claim_documents').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      ]);
      setCounts({ claims: claims.count ?? 0, tasks: tasks.count ?? 0, documents: documents.count ?? 0 });
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) return <Screen title="Staff Dashboard" showLogout><LoadingState /></Screen>;

  return (
    <Screen title="Staff Dashboard" subtitle={`Welcome${profile?.full_name ? `, ${profile.full_name}` : ''}.`} showLogout>
      <Card>
        <Row label="Open claim records" value={counts.claims} />
        <Row label="Follow-up tasks" value={counts.tasks} />
        <Row label="Documents for review" value={counts.documents} />
      </Card>
      <NavLink href="/staff/claims" label="Claims List" />
      <NavLink href="/staff/documents" label="Document Review" />
      <NavLink href="/staff/tasks" label="Follow-up Tasks" />
      <NavLink href="/staff/customers" label="Customer Search" />
      <NavLink href="/staff/vehicles" label="Vehicle Search" />
    </Screen>
  );
}
