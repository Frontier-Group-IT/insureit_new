import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { Card, EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { queueForStatus } from '@/lib/claim-workflow';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { Claim, ClaimStatus } from '@/lib/types';

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
    <Screen title="My Claims" subtitle={`${claims.length} claim${claims.length === 1 ? '' : 's'}`} showLogout>
      {claims.length === 0 ? <EmptyState title="No claims yet" body="Reported claims will appear here." /> : claims.map((claim) => (
        <Link key={claim.id} href={{ pathname: '/customer/claim-detail', params: { id: claim.id } }} asChild>
          <Card style={styles.claimCard}>
            <View style={styles.claimIcon}>
              <MaterialCommunityIcons name={queueForStatus(claim.current_status).icon} size={20} color={palette.blue} />
            </View>
            <View style={styles.claimCopy}>
              <Text style={styles.claimNo} numberOfLines={1}>{claim.claim_no}</Text>
              <Text style={styles.claimMeta} numberOfLines={1}>{formatDate(claim.accident_at ?? claim.created_at)} · {claim.accident_location || 'Location pending'}</Text>
            </View>
            <View style={styles.claimSide}>
              <AppBadge label={claim.current_status} tone={statusTone(claim.current_status)} />
              <MaterialCommunityIcons name="chevron-right" size={20} color={palette.slate} />
            </View>
          </Card>
        </Link>
      ))}
    </Screen>
  );
}

function statusTone(status: ClaimStatus) {
  if (['Settled', 'Closed'].includes(status)) return 'success';
  if (status === 'Rejected') return 'danger';
  if (['Approval Pending', 'Initial Documents Pending', 'Initial Documents Verification Pending', 'Documents Pending', 'Final Documents Awaited', 'Final Documents Verification Pending', 'Settlement Under Process'].includes(status)) return 'warning';
  return 'info';
}

function formatDate(date?: string | null) {
  if (!date) return 'Date pending';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  claimCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: radii.sm, marginBottom: 8 },
  claimIcon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  claimCopy: { flex: 1, minWidth: 0 },
  claimNo: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  claimMeta: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 3 },
  claimSide: { alignItems: 'flex-end', gap: 7, maxWidth: 130 },
});

