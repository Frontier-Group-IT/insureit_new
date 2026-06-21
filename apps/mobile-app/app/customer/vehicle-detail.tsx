import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppSectionHeader } from '@/components/design-system';
import { Card, EmptyState, LoadingState, Row, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
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
      const customer = await getCustomerForUser(session.user.id);
      if (!customer) {
        setLoading(false);
        return;
      }

      const vehicleResult = await supabase.from('vehicles').select('*').eq('id', id).eq('customer_id', customer.id).maybeSingle();
      setVehicle(vehicleResult.data);
      if (vehicleResult.data) {
        const policyResult = await supabase.from('policies').select('*').eq('vehicle_id', vehicleResult.data.id).eq('customer_id', customer.id).order('end_date', { ascending: true });
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

  if (loading) return <Screen title="Vehicle Detail"><LoadingState /></Screen>;
  if (!vehicle) return <Screen title="Vehicle Detail"><EmptyState title="Vehicle not found" body="Please choose another vehicle from your list." /></Screen>;

  return (
    <Screen title="Vehicle Detail" subtitle={vehicle.vehicle_no} showLogout>
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
          <AppBadge label={vehicle.year ? String(vehicle.year) : 'Active'} tone="info" />
        </View>
      </Card>

      <Card style={styles.detailSection}>
        <AppSectionHeader title="Vehicle details" />
        <Row label="Vehicle type" value={vehicle.vehicle_type} />
        <Row label="Make" value={vehicle.make} />
        <Row label="Model" value={vehicle.model} />
        <Row label="Year" value={vehicle.year} />
        <Row label="Chassis no." value={vehicle.chassis_no} />
        <Row label="Engine no." value={vehicle.engine_no} />
        <Row label="Permit no." value={vehicle.permit_no} />
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
          <View key={policy.id} style={styles.policyBlock}>
            <View style={styles.policyHeader}>
              <View style={styles.policyIcon}>
                <MaterialCommunityIcons name="shield-outline" size={19} color={palette.emerald} />
              </View>
              <View style={styles.policyCopy}>
                <Text style={styles.policyNo}>{policy.policy_no}</Text>
                <Text style={styles.policyMeta}>{policy.policy_type || 'Policy'} - {companyById.get(policy.insurance_company_id)?.name ?? 'Insurer'}</Text>
              </View>
            </View>
            <Row label="Start date" value={formatDate(policy.start_date)} />
            <Row label="End date" value={formatDate(policy.end_date)} />
            <Row label="Premium" value={formatCurrency(policy.premium_amount)} />
            <Row label="IDV" value={formatCurrency(policy.insured_declared_value)} />
          </View>
        )) : <Text style={styles.emptyText}>No policy is linked with this vehicle yet.</Text>}
      </Card>
    </Screen>
  );
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
  heroCard: { padding: 14, overflow: 'hidden', backgroundColor: '#F2F7FF', borderColor: '#C9DDFF' },
  heroWash: { position: 'absolute', right: -70, top: -80, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(7,94,234,0.12)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: roleTheme.customer.accent, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  vehicleNo: { color: palette.ink, fontSize: 21, fontWeight: '900' },
  vehicleMeta: { color: palette.slate, fontSize: 14, fontWeight: '600', marginTop: 3 },
  detailSection: { backgroundColor: '#F8FBFF', borderColor: '#D7E6FA' },
  policySection: { backgroundColor: '#F0FBF5', borderColor: '#BFEBD0' },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  sectionIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionHint: { color: palette.slate, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: -5, marginBottom: 4 },
  policyBlock: { borderTopWidth: 1, borderTopColor: 'rgba(198,211,225,0.75)', paddingTop: 10, marginTop: 10 },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  policyIcon: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  policyCopy: { flex: 1, minWidth: 0 },
  policyNo: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  policyMeta: { color: palette.slate, fontSize: 12, fontWeight: '600', marginTop: 3 },
  emptyText: { color: palette.slate, fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
