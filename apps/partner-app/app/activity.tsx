import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { listPartnerClaims, type PartnerClaimRow } from '@/lib/claims';
import { listPartnerPolicies, type PartnerPolicyRow } from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';

type ActivityItem =
  | { kind: 'policy'; id: string; date: string; title: string; subtitle: string; meta: string }
  | { kind: 'claim'; id: string; date: string; title: string; subtitle: string; meta: string };

export default function ActivityScreen() {
  const router = useRouter();
  const [policies, setPolicies] = useState<PartnerPolicyRow[]>([]);
  const [claims, setClaims] = useState<PartnerClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [nextPolicies, nextClaims] = await Promise.all([
          listPartnerPolicies({ limit: 12 }),
          listPartnerClaims({ limit: 12 }),
        ]);
        if (cancelled) return;
        setPolicies(nextPolicies);
        setClaims(nextClaims);
      } catch {
        if (!cancelled) setError('Recent activity could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activity = useMemo(() => combineActivity(policies, claims), [claims, policies]);

  return (
    <PartnerScreen
      eyebrow="ACTIVITY"
      title="Recent business activity"
      action={
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="close" size={18} color={partnerTheme.colors.ink} />
        </Pressable>
      }
    >
      <Text style={styles.intro}>A combined timeline of recent authorized policy and claim activity.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : activity.length ? (
        <View style={styles.timeline}>
          {activity.map((item, index) => (
            <View key={`${item.kind}-${item.id}`} style={styles.item}>
              <View style={styles.rail}>
                <View style={[styles.dot, item.kind === 'claim' && styles.dotClaim]} />
                {index < activity.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.itemBody}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemKind}>{item.kind === 'policy' ? 'POLICY' : 'CLAIM'}</Text>
                  <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
                </View>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                <Text style={styles.itemMeta}>{item.meta}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}><Text style={styles.emptyText}>No recent activity in this scope.</Text></View>
      )}
    </PartnerScreen>
  );
}

function combineActivity(policies: PartnerPolicyRow[], claims: PartnerClaimRow[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...policies.map((row) => ({
      kind: 'policy' as const,
      id: row.policy_id,
      date: row.issuance_date || row.start_date || row.end_date || new Date(0).toISOString(),
      title: row.policy_no || row.policy_code || 'Policy',
      subtitle: row.customer_name,
      meta: [row.insurer_name, row.vehicle_no].filter(Boolean).join(' · ') || 'Policy activity',
    })),
    ...claims.map((row) => ({
      kind: 'claim' as const,
      id: row.claim_id,
      date: row.accident_at || row.created_at,
      title: row.claim_no || 'Claim',
      subtitle: row.customer_name,
      meta: [row.current_status, row.vehicle_no].filter(Boolean).join(' · ') || 'Claim activity',
    })),
  ];

  return items
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0,20);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(date);
}

const styles = StyleSheet.create({
  back: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  intro: { color: partnerTheme.colors.inkMuted, fontSize: 10.5, lineHeight: 16 },
  error: { marginTop: 12, color: partnerTheme.colors.danger, fontSize: 10 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  timeline: { marginTop: 20 },
  item: { flexDirection: 'row', minHeight: 94 },
  rail: { width: 26, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: partnerTheme.colors.brand },
  dotClaim: { backgroundColor: partnerTheme.colors.accent },
  line: { width: 1, flex: 1, marginTop: 4, backgroundColor: partnerTheme.colors.line },
  itemBody: { flex: 1, paddingBottom: 18 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  itemKind: { color: partnerTheme.colors.brand, fontSize: 7.5, fontWeight: '800', letterSpacing: 0.9 },
  itemDate: { color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  itemTitle: { marginTop: 5, color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '800' },
  itemSubtitle: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
  itemMeta: { marginTop: 4, color: '#8A94A6', fontSize: 8.5 },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: partnerTheme.colors.inkMuted, fontSize: 10 },
});
