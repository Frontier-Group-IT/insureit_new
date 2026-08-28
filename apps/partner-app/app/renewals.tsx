import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { listPartnerPolicies, type PartnerPolicyRow } from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';

export default function RenewalsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<PartnerPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'expiring' | 'expired'>('expiring');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await listPartnerPolicies({ lifecycle: mode, limit: 50 }));
    } catch {
      setRows([]);
      setError('Renewal data could not be loaded for this account.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PartnerScreen
      eyebrow="RENEWALS"
      title="Renewal book"
      action={
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="close" size={18} color={partnerTheme.colors.ink} />
        </Pressable>
      }
    >
      <Text style={styles.intro}>Renewals are derived from your already-authorized policy book, so no additional customer or policy access is opened.</Text>

      <View style={styles.filters}>
        <Pressable onPress={() => setMode('expiring')} style={[styles.filter, mode === 'expiring' && styles.filterActive]}>
          <Text style={[styles.filterText, mode === 'expiring' && styles.filterTextActive]}>Next 30 days</Text>
        </Pressable>
        <Pressable onPress={() => setMode('expired')} style={[styles.filter, mode === 'expired' && styles.filterActive]}>
          <Text style={[styles.filterText, mode === 'expired' && styles.filterTextActive]}>Expired</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : rows.length ? (
        <View style={styles.list}>
          {rows.map((row) => (
            <View key={row.policy_id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardIdentity}>
                  <Text style={styles.policyNo}>{row.policy_no || row.policy_code || 'Policy'}</Text>
                  <Text style={styles.customer}>{row.customer_name}</Text>
                </View>
                <Text style={[styles.days, mode === 'expired' && styles.daysExpired]}>{renewalLabel(row.end_date)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Meta label="Insurer" value={row.insurer_name || 'Not recorded'} />
                <Meta label="Vehicle" value={row.vehicle_no || 'Non-motor / not linked'} />
              </View>
              <View style={styles.footer}>
                <Text style={styles.date}>Ends {formatDate(row.end_date)}</Text>
                <Text style={styles.premium}>{formatMoney(row.premium_amount)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={30} color={partnerTheme.colors.success} />
          <Text style={styles.emptyTitle}>{mode === 'expiring' ? 'No renewals due in 30 days' : 'No expired policies found'}</Text>
        </View>
      )}
    </PartnerScreen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function renewalLabel(value: string | null) {
  if (!value) return 'No expiry';
  const end = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d left`;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatMoney(value: number | string | null) {
  const amount = Number(value ?? 0);
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)}`;
}

const styles = StyleSheet.create({
  back: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  intro: { marginBottom: 15, color: partnerTheme.colors.inkMuted, fontSize: 10.5, lineHeight: 16 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filter: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: partnerTheme.colors.surfaceMuted },
  filterActive: { backgroundColor: partnerTheme.colors.brandStrong },
  filterText: { color: partnerTheme.colors.inkMuted, fontSize: 9.5, fontWeight: '700' },
  filterTextActive: { color: partnerTheme.colors.white },
  error: { marginBottom: 12, color: partnerTheme.colors.danger, fontSize: 10 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 10 },
  card: { borderRadius: partnerTheme.radius.lg, padding: 16, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardIdentity: { flex: 1 },
  policyNo: { color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '800' },
  customer: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
  days: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, color: '#9A5B12', backgroundColor: '#FFF2DD', fontSize: 8, fontWeight: '800' },
  daysExpired: { color: '#A7372D', backgroundColor: '#FCEDEC' },
  metaRow: { marginTop: 14, flexDirection: 'row' },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', fontSize: 7.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 9.5, fontWeight: '600' },
  footer: { marginTop: 13, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  date: { color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  premium: { color: partnerTheme.colors.brandStrong, fontSize: 9, fontWeight: '700' },
  empty: { minHeight: 190, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  emptyTitle: { marginTop: 10, color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '700' },
});
