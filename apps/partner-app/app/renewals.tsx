import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import {
  getPartnerRenewalSummary,
  listPartnerPolicies,
  type PartnerPolicyRow,
  type PartnerRenewalSummary,
} from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';

type RenewalMode = 'expiring' | 'expired';
type RenewalWindow = 'all' | '0_7' | '8_15' | '16_30';

export default function RenewalsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<PartnerPolicyRow[]>([]);
  const [summary, setSummary] = useState<PartnerRenewalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<RenewalMode>('expiring');
  const [window, setWindow] = useState<RenewalWindow>('all');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextSummary, nextRows] = await Promise.all([
        getPartnerRenewalSummary(),
        listPartnerPolicies({ lifecycle: mode, limit: 100 }),
      ]);
      setSummary(nextSummary);
      setRows(nextRows);
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

  const visibleRows = useMemo(() => {
    if (mode === 'expired' || window === 'all') return rows;
    return rows.filter((row) => {
      const days = daysUntil(row.end_date);
      if (window === '0_7') return days >= 0 && days <= 7;
      if (window === '8_15') return days >= 8 && days <= 15;
      return days >= 16 && days <= 30;
    });
  }, [mode, rows, window]);

  return (
    <PartnerScreen
      eyebrow="RENEWALS"
      title="Renewal work queue"
      action={
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="close" size={18} color={partnerTheme.colors.ink} />
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroEyebrow}>NEXT 30 DAYS</Text>
                <Text style={styles.heroPremium}>{formatMoney(summary?.due_30_premium ?? 0)}</Text>
                <Text style={styles.heroLabel}>gross premium in renewal window</Text>
              </View>
              <View style={styles.heroCount}>
                <Text style={styles.heroCountValue}>{summary?.due_30_count ?? 0}</Text>
                <Text style={styles.heroCountLabel}>policies</Text>
              </View>
            </View>

            <View style={styles.heroBins}>
              <HeroBin label="0–7d" count={summary?.due_0_7_count ?? 0} />
              <HeroBin label="8–15d" count={summary?.due_8_15_count ?? 0} />
              <HeroBin label="16–30d" count={summary?.due_16_30_count ?? 0} />
              <HeroBin label="Overdue" count={summary?.overdue_count ?? 0} danger />
            </View>
          </View>

          <View style={styles.modeTabs}>
            <Pressable onPress={() => { setMode('expiring'); setWindow('all'); }} style={[styles.modeTab, mode === 'expiring' && styles.modeTabActive]}>
              <Text style={[styles.modeText, mode === 'expiring' && styles.modeTextActive]}>Upcoming</Text>
            </Pressable>
            <Pressable onPress={() => { setMode('expired'); setWindow('all'); }} style={[styles.modeTab, mode === 'expired' && styles.modeTabActive]}>
              <Text style={[styles.modeText, mode === 'expired' && styles.modeTextActive]}>Overdue</Text>
            </Pressable>
          </View>

          {mode === 'expiring' ? (
            <View style={styles.windowRow}>
              <WindowChip label="All 30d" active={window === 'all'} onPress={() => setWindow('all')} />
              <WindowChip label="0–7d" active={window === '0_7'} onPress={() => setWindow('0_7')} />
              <WindowChip label="8–15d" active={window === '8_15'} onPress={() => setWindow('8_15')} />
              <WindowChip label="16–30d" active={window === '16_30'} onPress={() => setWindow('16_30')} />
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{mode === 'expired' ? 'Overdue policies' : 'Renewal opportunities'}</Text>
            <Text style={styles.listCount}>{visibleRows.length} shown</Text>
          </View>

          {visibleRows.length ? (
            <View style={styles.list}>
              {visibleRows.map((row) => (
                <Pressable key={row.policy_id} onPress={() => router.push(`/policy/${row.policy_id}` as never)} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardIdentity}>
                      <Text style={styles.customer}>{row.customer_name}</Text>
                      <Text style={styles.policyNo}>{row.policy_no || row.policy_code || 'Policy'}</Text>
                    </View>
                    <Text style={[styles.days, mode === 'expired' && styles.daysExpired]}>{renewalLabel(row.end_date)}</Text>
                  </View>

                  <View style={styles.vehicleLine}>
                    <Ionicons name={row.vehicle_no ? 'car-outline' : 'document-text-outline'} size={15} color={partnerTheme.colors.brand} />
                    <Text style={styles.vehicleText}>{row.vehicle_no || 'Non-motor / vehicle not linked'}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Meta label="Insurer" value={row.insurer_name || 'Not recorded'} />
                    <Meta label="Current premium" value={formatMoney(row.premium_amount)} />
                  </View>

                  <View style={styles.footer}>
                    <View>
                      <Text style={styles.footerLabel}>EXPIRY</Text>
                      <Text style={styles.date}>{formatDate(row.end_date)}</Text>
                    </View>
                    <View style={styles.open}>
                      <Text style={styles.openText}>Open policy</Text>
                      <Ionicons name="chevron-forward" size={14} color={partnerTheme.colors.brand} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={32} color={partnerTheme.colors.success} />
              <Text style={styles.emptyTitle}>{mode === 'expiring' ? 'No policies in this renewal window' : 'No overdue policies found'}</Text>
              <Text style={styles.emptyText}>The queue is derived from your authorized policy book and updates with policy expiry dates.</Text>
            </View>
          )}
        </>
      )}
    </PartnerScreen>
  );
}

function HeroBin({ label, count, danger = false }: { label: string; count: number; danger?: boolean }) {
  return (
    <View style={styles.heroBin}>
      <Text style={[styles.heroBinValue, danger && styles.heroBinDanger]}>{count}</Text>
      <Text style={styles.heroBinLabel}>{label}</Text>
    </View>
  );
}

function WindowChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.windowChip, active && styles.windowChipActive]}>
      <Text style={[styles.windowText, active && styles.windowTextActive]}>{label}</Text>
    </Pressable>
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

function daysUntil(value: string | null) {
  if (!value) return 9999;
  const end = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function renewalLabel(value: string | null) {
  const days = daysUntil(value);
  if (days === 9999) return 'No expiry';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d left`;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatMoney(value: number | string | null) {
  const amount = Number(value ?? 0);
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)}`;
}

const styles = StyleSheet.create({
  back: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: partnerTheme.radius.xl, padding: 18, backgroundColor: partnerTheme.colors.nav },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroEyebrow: { color: '#AAA5FF', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  heroPremium: { marginTop: 6, color: '#FFFFFF', fontSize: 27, fontWeight: '900' },
  heroLabel: { marginTop: 2, color: '#AEB7C5', fontSize: 8 },
  heroCount: { minWidth: 58, alignItems: 'center', borderRadius: 15, paddingVertical: 10, paddingHorizontal: 9, backgroundColor: '#263246' },
  heroCountValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  heroCountLabel: { marginTop: 2, color: '#99A5B7', fontSize: 7 },
  heroBins: { marginTop: 16, paddingTop: 13, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3B4658' },
  heroBin: { flex: 1, alignItems: 'center' },
  heroBinValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  heroBinDanger: { color: '#F2B6AF' },
  heroBinLabel: { marginTop: 3, color: '#97A3B5', fontSize: 7 },
  modeTabs: { marginTop: 13, flexDirection: 'row', gap: 8 },
  modeTab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: partnerTheme.colors.surfaceMuted },
  modeTabActive: { backgroundColor: partnerTheme.colors.brandStrong },
  modeText: { color: partnerTheme.colors.inkMuted, fontSize: 9.5, fontWeight: '800' },
  modeTextActive: { color: '#FFFFFF' },
  windowRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  windowChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: partnerTheme.colors.surface },
  windowChipActive: { backgroundColor: partnerTheme.colors.brandSoft },
  windowText: { color: partnerTheme.colors.inkMuted, fontSize: 8, fontWeight: '700' },
  windowTextActive: { color: partnerTheme.colors.brandStrong },
  error: { marginTop: 12, color: partnerTheme.colors.danger, fontSize: 10 },
  listHeader: { marginTop: 20, marginBottom: 9, flexDirection: 'row', justifyContent: 'space-between' },
  listTitle: { color: partnerTheme.colors.ink, fontSize: 13.5, fontWeight: '800' },
  listCount: { color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  list: { gap: 9 },
  card: { borderRadius: 17, padding: 15, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardIdentity: { flex: 1 },
  customer: { color: partnerTheme.colors.ink, fontSize: 11, fontWeight: '800' },
  policyNo: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  days: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, color: '#9A5B12', backgroundColor: '#FFF2DD', fontSize: 8, fontWeight: '800' },
  daysExpired: { color: '#A7372D', backgroundColor: '#FCEDEC' },
  vehicleLine: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleText: { color: partnerTheme.colors.ink, fontSize: 9.5, fontWeight: '700' },
  metaRow: { marginTop: 12, flexDirection: 'row' },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', fontSize: 7, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 9, fontWeight: '600' },
  footer: { marginTop: 13, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  footerLabel: { color: '#9AA3B2', fontSize: 6.5, fontWeight: '800', letterSpacing: 0.5 },
  date: { marginTop: 2, color: partnerTheme.colors.inkMuted, fontSize: 8 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { color: partnerTheme.colors.brand, fontSize: 8.5, fontWeight: '800' },
  empty: { minHeight: 190, alignItems: 'center', justifyContent: 'center', borderRadius: 17, padding: 20, backgroundColor: partnerTheme.colors.surface },
  emptyTitle: { marginTop: 10, color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '800' },
  emptyText: { marginTop: 4, maxWidth: 280, color: partnerTheme.colors.inkMuted, fontSize: 8.5, lineHeight: 13, textAlign: 'center' },
});
