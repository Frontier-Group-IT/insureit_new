import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { listPartnerPolicyIntakes, type PartnerPolicyIntake } from '@/lib/policy-intakes';
import { partnerTheme } from '@/lib/theme';

export default function PolicyIntakesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<PartnerPolicyIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listPartnerPolicyIntakes();
      setRows(result.intakes);
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : 'Policy Intakes could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <PartnerScreen
      eyebrow="POLICY INTAKE"
      title="My submissions"
      action={
        <Pressable onPress={() => router.push('/policy-intake-new')} style={styles.newButton}>
          <Ionicons name="add" size={17} color="#FFFFFF" />
          <Text style={styles.newButtonText}>New</Text>
        </Pressable>
      }
    >
      <View style={styles.info}>
        <Ionicons name="git-network-outline" size={18} color={partnerTheme.colors.brand} />
        <Text style={styles.infoText}>Upload the policy copy once. Operations reviews the same intake, confirms the extracted details and completes final onboarding.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : rows.length ? (
        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable key={row.id} onPress={() => router.push({ pathname: '/policy-intakes/[id]', params: { id: row.id } })} style={styles.card}>
              <View style={styles.top}>
                <View style={styles.identity}>
                  <Text style={styles.number}>{row.intake_number}</Text>
                  <Text style={styles.customer}>{row.customer_mobile} · {row.lead_source_name}</Text>
                </View>
                <StatusPill row={row} />
              </View>

              <View style={styles.metaRow}>
                <Meta label="Policy" value={field(row, 'policy_number') || 'Fetching / review pending'} />
                <Meta label="Vehicle" value={field(row, 'vehicle_registration_number') || 'Fetching / review pending'} />
              </View>

              {row.attention_reason ? (
                <View style={styles.attention}>
                  <Ionicons name="alert-circle-outline" size={15} color="#9A5B12" />
                  <Text style={styles.attentionText}>{row.attention_reason}</Text>
                </View>
              ) : null}

              <View style={styles.footer}>
                <Text style={styles.date}>{formatDate(row.created_at)}</Text>
                <View style={styles.open}>
                  <Text style={styles.openText}>View</Text>
                  <Ionicons name="chevron-forward" size={14} color={partnerTheme.colors.brand} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="cloud-upload-outline" size={32} color="#99A3B3" />
          <Text style={styles.emptyTitle}>No Policy Intakes yet</Text>
          <Text style={styles.emptyText}>Create an intake when you have a policy copy that Operations needs to onboard.</Text>
          <Pressable onPress={() => router.push('/policy-intake-new')} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Create first intake</Text>
          </Pressable>
        </View>
      )}
    </PartnerScreen>
  );
}

function StatusPill({ row }: { row: PartnerPolicyIntake }) {
  const manual = row.status === 'processing' && row.ocr_status === 'failed';
  const label = manual ? 'Manual review' : ({
    processing: 'Processing',
    ready_for_review: 'Ready',
    in_review: 'In review',
    needs_attention: 'Needs attention',
    completed: 'Completed',
    rejected: 'Rejected',
  } as Record<string, string>)[row.status] || row.status;
  const tone = row.status === 'completed'
    ? styles.statusCompleted
    : row.status === 'rejected'
      ? styles.statusRejected
      : row.status === 'needs_attention' || manual
        ? styles.statusAttention
        : styles.statusActive;
  return <Text style={[styles.status, tone]}>{label}</Text>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function field(row: PartnerPolicyIntake, key: string) {
  return row.ocr_fields?.find((item) => item.key === key)?.value?.trim() || '';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

const styles = StyleSheet.create({
  newButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 12, backgroundColor: partnerTheme.colors.brandStrong },
  newButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  info: { flexDirection: 'row', gap: 10, borderRadius: partnerTheme.radius.md, padding: 13, backgroundColor: partnerTheme.colors.brandSoft },
  infoText: { flex: 1, color: '#5D5A80', fontSize: 9.5, lineHeight: 14 },
  error: { marginTop: 12, color: partnerTheme.colors.danger, fontSize: 10 },
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center' },
  list: { marginTop: 14, gap: 10 },
  card: { borderRadius: partnerTheme.radius.lg, padding: 16, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  identity: { flex: 1 },
  number: { color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '800' },
  customer: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
  status: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: '800' },
  statusActive: { color: '#315E9C', backgroundColor: '#EAF1FB' },
  statusCompleted: { color: '#18794E', backgroundColor: '#E9F7EF' },
  statusRejected: { color: '#A7372D', backgroundColor: '#FCEDEC' },
  statusAttention: { color: '#9A5B12', backgroundColor: '#FFF2DD' },
  metaRow: { marginTop: 14, flexDirection: 'row' },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', fontSize: 7.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 9.5, fontWeight: '600' },
  attention: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: 10, padding: 10, backgroundColor: '#FFF8EA' },
  attentionText: { flex: 1, color: '#80511A', fontSize: 8.5, lineHeight: 13 },
  footer: { marginTop: 13, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  date: { color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { color: partnerTheme.colors.brand, fontSize: 8.5, fontWeight: '700' },
  empty: { marginTop: 16, minHeight: 240, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, padding: 24, backgroundColor: partnerTheme.colors.surface },
  emptyTitle: { marginTop: 10, color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '700' },
  emptyText: { marginTop: 5, maxWidth: 280, color: partnerTheme.colors.inkMuted, fontSize: 9.5, lineHeight: 14, textAlign: 'center' },
  emptyButton: { marginTop: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: partnerTheme.colors.brandStrong },
  emptyButtonText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
});
