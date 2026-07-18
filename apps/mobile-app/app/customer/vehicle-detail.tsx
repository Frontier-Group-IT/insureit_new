import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppSectionHeader } from '@/components/design-system';
import { Card, EmptyState, LoadingState, Row, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { InsuranceCompany, Policy, Vehicle } from '@/lib/types';

export default function VehicleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const ids = contexts.map((context) => context.customer_id);
      if (!ids.length) {
        setLoading(false);
        return;
      }

      const vehicleResult = await supabase.from('vehicles').select('*').eq('id', id).in('customer_id', ids).maybeSingle();
      setVehicle(vehicleResult.data);
      if (vehicleResult.data) {
        const policyResult = await supabase.from('policies').select('*').eq('vehicle_id', vehicleResult.data.id).in('customer_id', ids).order('end_date', { ascending: true });
        const nextPolicies = policyResult.data ?? [];
        setPolicies(nextPolicies);
        const companyIds = Array.from(new Set(nextPolicies.map((policy) => policy.insurance_company_id).filter(Boolean)));
        if (companyIds.length) {
          const companyResult = await supabase.from('insurance_companies').select('*').in('id', companyIds);
          setCompanies(companyResult.data ?? []);
        }
      }
      setLoading(false);
    }
    void load();
  }, [id, router]);

  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const latestPolicy = useMemo(() => [...policies].sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0] ?? null, [policies]);
  const latestPolicyCompany = latestPolicy ? companyById.get(latestPolicy.insurance_company_id) : null;
  const policyState = latestPolicy ? policyStatus(latestPolicy.end_date) : { label: 'No policy', tone: 'red' as const, helper: 'Add a policy to complete protection' };

  if (loading) return <Screen title="Vehicle Detail"><LoadingState /></Screen>;
  if (!vehicle) return <Screen title="Vehicle Detail"><EmptyState title="Vehicle not found" body="Please choose another vehicle from your list." /></Screen>;

  return (
    <Screen title="Vehicle Detail" subtitle={vehicle.vehicle_no} showLogout showTitleHeader={false}>
      <Card style={styles.heroCard}>
        <View style={styles.heroWash} />
        <View style={styles.heroTop}>
          <View style={styles.vehicleIcon}>
            <MaterialCommunityIcons name={vehicleIcon(vehicle.vehicle_type)} size={28} color={palette.surface} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.vehicleNo}>{vehicle.vehicle_no}</Text>
            <Text style={styles.vehicleMeta}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_type || 'Vehicle'}</Text>
          </View>
          <StatusPill tone={policyState.tone} label={policyState.label} />
        </View>
        <View style={styles.heroStats}>
          <MiniStat label="Insurer" value={latestPolicyCompany?.name ?? 'Pending'} />
          <MiniStat label="Policy" value={latestPolicy?.policy_no ?? 'Not added'} />
          <MiniStat label="Expiry" value={latestPolicy ? formatDate(latestPolicy.end_date) : '-'} />
        </View>
        <Text style={styles.heroHelper}>{policyState.helper}</Text>
      </Card>

      <View style={styles.actionGrid}>
        <ActionTile icon="file-plus-outline" label="Report incident" body="Start a claim for this vehicle" tone="orange" onPress={() => router.push({ pathname: '/customer/report-accident', params: { vehicleId: vehicle.id } })} />
        <ActionTile icon="shield-plus-outline" label="Add policy" body="Attach or renew cover" tone="blue" onPress={() => router.push({ pathname: '/customer/add-policy', params: { vehicleId: vehicle.id } })} />
      </View>

      <Card style={styles.detailSection}>
        <View style={styles.sectionRow}>
          <View style={styles.detailIcon}>
            <MaterialCommunityIcons name="card-account-details-outline" size={21} color={palette.navy} />
          </View>
          <View style={styles.sectionCopy}>
            <AppSectionHeader title="Vehicle profile" />
            <Text style={styles.sectionHint}>Registration and technical details</Text>
          </View>
        </View>
        <View style={styles.detailGrid}>
          <DetailCell label="Vehicle type" value={vehicle.vehicle_type} />
          <DetailCell label="Make" value={vehicle.make} />
          <DetailCell label="Model" value={vehicle.model} />
          <DetailCell label="Year" value={vehicle.year ? String(vehicle.year) : '-'} />
          <DetailCell label="Chassis no." value={vehicle.chassis_no} wide />
          <DetailCell label="Engine no." value={vehicle.engine_no} wide />
          <DetailCell label="Permit no." value={vehicle.permit_no} wide />
        </View>
      </Card>

      <Card style={styles.policySection}>
        <View style={styles.sectionRow}>
          <View style={styles.sectionIcon}>
            <MaterialCommunityIcons name="shield-check-outline" size={21} color={palette.emerald} />
          </View>
          <View style={styles.sectionCopy}>
            <AppSectionHeader title="Associated policies" />
            <Text style={styles.sectionHint}>{policies.length} polic{policies.length === 1 ? 'y' : 'ies'} linked with this vehicle</Text>
          </View>
        </View>
        {policies.length ? policies.map((policy) => (
          <Pressable key={policy.id} onPress={() => router.push({ pathname: '/customer/policy-detail', params: { id: policy.id } } as any)} style={({ pressed }) => [styles.policyBlock, pressed && styles.policyBlockPressed]}>
            <View style={styles.policyHeader}>
              <View style={styles.policyIcon}>
                <MaterialCommunityIcons name="shield-outline" size={19} color={palette.emerald} />
              </View>
              <View style={styles.policyCopy}>
                <Text style={styles.policyNo}>{policy.policy_no}</Text>
                <Text style={styles.policyMeta}>{policy.policy_type || 'Policy'} - {companyById.get(policy.insurance_company_id)?.name ?? 'Insurer'}</Text>
              </View>
              <StatusPill tone={policyStatus(policy.end_date).tone} label={policyStatus(policy.end_date).label} />
            </View>
            <Row label="Start date" value={formatDate(policy.start_date)} />
            <Row label="End date" value={formatDate(policy.end_date)} />
            <Row label="Premium" value={formatCurrency(policy.premium_amount)} />
            <Row label="IDV" value={formatCurrency(policy.insured_declared_value)} />
          </Pressable>
        )) : <Text style={styles.emptyText}>No policy is linked with this vehicle yet.</Text>}
      </Card>
    </Screen>
  );
}

function StatusPill({ tone, label }: { tone: 'green' | 'orange' | 'red'; label: string }) {
  const config = tone === 'green' ? { bg: '#E8F8F0', text: '#12805C' } : tone === 'orange' ? { bg: '#FFF4E2', text: '#B7791F' } : { bg: '#FDECEC', text: '#C43838' };
  return <View style={[styles.statusPill, { backgroundColor: config.bg }]}><Text style={[styles.statusText, { color: config.text }]}>{label}</Text></View>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.miniStat}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue} numberOfLines={1}>{value}</Text></View>;
}

function ActionTile({ icon, label, body, tone, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; body: string; tone: 'blue' | 'orange'; onPress: () => void }) {
  const config = tone === 'blue' ? { bg: '#EEF5FF', border: '#C9DDFF', icon: palette.navy } : { bg: '#FFF7EA', border: '#F4D7AA', icon: '#B7791F' };
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionTile, { backgroundColor: config.bg, borderColor: config.border }, pressed && styles.actionTilePressed]}><View style={[styles.actionIcon, { backgroundColor: '#FFFFFF' }]}><MaterialCommunityIcons name={icon} size={22} color={config.icon} /></View><Text style={styles.actionTitle}>{label}</Text><Text style={styles.actionBody}>{body}</Text></Pressable>;
}

function DetailCell({ label, value, wide = false }: { label: string; value?: string | null; wide?: boolean }) {
  return <View style={[styles.detailCell, wide && styles.detailCellWide]}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue} numberOfLines={2}>{value || '-'}</Text></View>;
}

function policyStatus(endDate: string) {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Expired', tone: 'red' as const, helper: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` };
  if (days <= 30) return { label: 'Renewal due', tone: 'orange' as const, helper: `${days} day${days === 1 ? '' : 's'} left for renewal` };
  return { label: 'Protected', tone: 'green' as const, helper: `${days} day${days === 1 ? '' : 's'} of cover remaining` };
}

function vehicleIcon(type?: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  const normalized = type?.toLowerCase() ?? '';
  if (normalized.includes('bus')) return 'bus';
  if (normalized.includes('tanker')) return 'truck-cargo-container';
  if (normalized.includes('trailer')) return 'truck-trailer';
  return 'truck-outline';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '-';
  return `INR ${value.toLocaleString('en-IN')}`;
}

const styles = StyleSheet.create({
  heroCard: { padding: 15, overflow: 'hidden', backgroundColor: '#F2F7FF', borderColor: '#C9DDFF' },
  heroWash: { position: 'absolute', right: -70, top: -80, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(7,94,234,0.12)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: roleTheme.customer.accent, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  vehicleNo: { color: palette.ink, fontSize: 21, fontWeight: '900' },
  vehicleMeta: { color: palette.slate, fontSize: 14, fontWeight: '600', marginTop: 3 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 15 },
  heroHelper: { color: palette.slate, fontSize: 12.5, fontWeight: '700', marginTop: 10 },
  miniStat: { flex: 1, minHeight: 54, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: '#D9E8FA', padding: 9, justifyContent: 'center' },
  miniLabel: { color: '#64748B', fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase' },
  miniValue: { color: palette.navy, fontSize: 11.5, fontWeight: '900', marginTop: 3 },
  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionTile: { flex: 1, minHeight: 104, borderRadius: 18, borderWidth: 1, padding: 12, shadowColor: '#10233F', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  actionTilePressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  actionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionTitle: { color: palette.ink, fontSize: 13.5, fontWeight: '900' },
  actionBody: { color: palette.slate, fontSize: 10.5, lineHeight: 14, fontWeight: '700', marginTop: 3 },
  detailSection: { backgroundColor: '#F8FBFF', borderColor: '#D7E6FA' },
  policySection: { backgroundColor: '#F0FBF5', borderColor: '#BFEBD0' },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  sectionIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  detailIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionHint: { color: palette.slate, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: -5, marginBottom: 4 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 7 },
  detailCell: { width: '48%', minHeight: 62, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0EAF5', padding: 10 },
  detailCellWide: { width: '100%' },
  detailLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { color: palette.ink, fontSize: 13, fontWeight: '900', marginTop: 5 },
  policyBlock: { borderTopWidth: 1, borderTopColor: 'rgba(198,211,225,0.75)', paddingTop: 12, marginTop: 12 },
  policyBlockPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  policyIcon: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  policyCopy: { flex: 1, minWidth: 0 },
  policyNo: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  policyMeta: { color: palette.slate, fontSize: 12, fontWeight: '600', marginTop: 3 },
  emptyText: { color: palette.slate, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 9, fontWeight: '900' },
});
