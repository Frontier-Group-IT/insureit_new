import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Policy, Vehicle } from '@/lib/types';

const truckSketch = require('../../assets/vehicles/truck sketch.png');
const carSketch = require('../../assets/vehicles/car sketch.png');

export default function VehicleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsExpanded, setAlertsExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const ids = contexts.map((context) => context.customer_id);
      setContexts(contexts);
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
  const complianceItems = useMemo(() => vehicleComplianceItems(vehicle, latestPolicy), [latestPolicy, vehicle]);
  const alertItems = complianceItems.filter((item) => item.status !== 'ok');
  const vehicleImage = vehicle && isPrivateVehicle(vehicle) ? carSketch : truckSketch;
  const registeredCompany = vehicle ? registeredCompanyName(vehicle.customer_id, contexts) : '';

  if (loading) return <Screen title="Vehicle Detail"><LoadingState /></Screen>;
  if (!vehicle) return <Screen title="Vehicle Detail"><EmptyState title="Vehicle not found" body="Please choose another vehicle from your list." /></Screen>;

  return (
    <Screen title="Vehicle Detail" subtitle={vehicle.vehicle_no} showLogout showTitleHeader={false}>
      <Card style={styles.heroCard}>
        <View style={styles.heroWash} />
        <View style={styles.heroTop}>
          <Image source={vehicleImage} style={styles.vehicleImage} resizeMode="contain" />
          <View style={styles.heroCopy}>
            {registeredCompany ? <Text style={styles.companyName} numberOfLines={1}>{registeredCompany}</Text> : null}
            <Text style={styles.vehicleNo}>{vehicle.vehicle_no}</Text>
            <Text style={styles.vehicleMeta}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_type || 'Vehicle'}</Text>
          </View>
          <StatusPill tone={policyState.tone} label={policyState.label} showDot={policyState.tone !== 'green'} />
        </View>
        <View style={styles.heroStats}>
          <MiniStat label="Insurer" value={latestPolicyCompany?.name ?? 'Pending'} />
          <MiniStat label="Policy" value={latestPolicy?.policy_no ?? 'Not added'} />
          <MiniStat label="Expiry" value={latestPolicy ? formatDate(latestPolicy.end_date) : '-'} />
        </View>
        <Text style={styles.heroHelper}>{policyState.helper}</Text>
      </Card>

      <Card accessibilityRole="button" onPress={() => setAlertsExpanded((value) => !value)} style={styles.alertSection}>
          <View style={styles.compactSectionRow}>
            <View style={styles.alertIcon}>
              <MaterialCommunityIcons name="calendar-alert-outline" size={18} color="#B7791F" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Alerts and dues</Text>
              <Text style={styles.sectionHint}>Expired and renewal-due documents</Text>
            </View>
            <View style={[styles.alertCountBox, alertItems.length > 0 && styles.alertCountBoxWarning]}>
              <Text style={styles.alertCount}>{alertItems.length}</Text>
              <MaterialCommunityIcons name={alertsExpanded ? 'chevron-up' : 'chevron-down'} size={17} color={palette.navy} />
            </View>
          </View>
          {alertsExpanded ? <>
            <View style={styles.alertLegend}>
              <Dot tone="red" /><Text style={styles.legendText}>Expired</Text>
              <Dot tone="yellow" /><Text style={styles.legendText}>Renewal due</Text>
            </View>
            {alertItems.length ? alertItems.map((item) => <ComplianceRow key={item.key} item={item} />) : <Text style={styles.emptyText}>No expired or renewal-due documents found.</Text>}
          </> : null}
      </Card>

      <Card style={styles.detailSection}>
        <View style={styles.sectionRow}>
          <View style={styles.detailIcon}>
            <MaterialCommunityIcons name="card-account-details-outline" size={19} color={palette.navy} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Vehicle details</Text>
            <Text style={styles.sectionHint}>Details stored for this vehicle</Text>
          </View>
        </View>
        <View style={styles.detailGrid}>
          <DetailCell icon="truck-outline" label="Vehicle type" value={vehicle.vehicle_type} />
          <DetailCell icon="factory" label="Make" value={vehicle.make} />
          <DetailCell icon="car-info" label="Model" value={vehicle.model} />
          <DetailCell icon="calendar-blank-outline" label="Manufacturing year" value={vehicle.year ? String(vehicle.year) : null} />
          <DetailCell icon="weight-kilogram" label="GVW" value={privateNotApplicable(vehicle, vehicle.gvw_kg ? `${vehicle.gvw_kg.toLocaleString('en-IN')} kg` : null)} />
          <DetailCell icon="calendar-check-outline" label="Registration date" value={formatDate(vehicle.registration_date)} />
          <DetailCell icon="barcode" label="Chassis no." value={vehicle.chassis_no} />
          <DetailCell icon="engine-outline" label="Engine no." value={vehicle.engine_no} />
          <DetailCell icon="file-certificate-outline" label="Permit no." value={privateNotApplicable(vehicle, vehicle.permit_no)} />
          <DetailCell icon="calendar-alert" label="Fitness expiry" value={privateNotApplicable(vehicle, formatDate(vehicle.fitness_expiry_date))} status={isPrivateVehicle(vehicle) ? 'ok' : complianceStatus(vehicle.fitness_expiry_date).status} />
          <DetailCell icon="smog" label="PUC expiry" value={formatDate(vehicle.puc_expiry_date)} status={complianceStatus(vehicle.puc_expiry_date).status} />
          <DetailCell icon="road-variant" label="Road tax expiry" value={privateNotApplicable(vehicle, formatDate(vehicle.road_tax_expiry_date))} status={isPrivateVehicle(vehicle) ? 'ok' : complianceStatus(vehicle.road_tax_expiry_date).status} />
          <DetailCell icon="map-marker-path" label="National permit expiry" value={privateNotApplicable(vehicle, formatDate(vehicle.national_permit_expiry_date))} status={isPrivateVehicle(vehicle) ? 'ok' : complianceStatus(vehicle.national_permit_expiry_date).status} />
          <DetailCell icon="map-marker-radius-outline" label="Local permit expiry" value={privateNotApplicable(vehicle, formatDate(vehicle.local_permit_expiry_date))} status={isPrivateVehicle(vehicle) ? 'ok' : complianceStatus(vehicle.local_permit_expiry_date).status} />
        </View>
      </Card>
    </Screen>
  );
}

function StatusPill({ tone, label, showDot = false }: { tone: 'green' | 'orange' | 'red'; label: string; showDot?: boolean }) {
  const config = tone === 'green' ? { bg: '#E8F8F0', text: '#12805C' } : tone === 'orange' ? { bg: '#FFF4E2', text: '#B7791F' } : { bg: '#FDECEC', text: '#C43838' };
  return <View style={[styles.statusPill, { backgroundColor: config.bg }]}>{showDot ? <PulseDot tone={tone === 'red' ? 'red' : 'yellow'} /> : null}<Text style={[styles.statusText, { color: config.text }]}>{label}</Text></View>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.miniStat}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue} numberOfLines={1}>{value}</Text></View>;
}

function DetailCell({ icon, label, value, status = 'ok' }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string | null; status?: 'expired' | 'due' | 'ok' }) {
  const showDateDot = status === 'expired' || status === 'due';
  return <View style={styles.detailCell}><MaterialCommunityIcons name={icon} size={15} color="#7A8799" /><View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><View style={styles.detailValueRow}>{showDateDot ? <PulseDot tone={status === 'expired' ? 'red' : 'yellow'} /> : null}<Text style={styles.detailValue} numberOfLines={2}>{value || '-'}</Text></View></View></View>;
}

function policyStatus(endDate: string) {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Expired', tone: 'red' as const, helper: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` };
  if (days <= 30) return { label: 'Renewal due', tone: 'orange' as const, helper: `${days} day${days === 1 ? '' : 's'} left for renewal` };
  return { label: 'Protected', tone: 'green' as const, helper: `${days} day${days === 1 ? '' : 's'} of cover remaining` };
}

type ComplianceItem = { key: string; label: string; date: string | null; status: 'expired' | 'due' | 'ok'; helper: string };

function ComplianceRow({ item }: { item: ComplianceItem }) {
  return (
    <View style={styles.complianceRow}>
      <View style={styles.complianceCopy}>
        <Text style={styles.complianceTitle}>{item.label}</Text>
        <View style={styles.complianceDateRow}>
          <PulseDot tone={item.status === 'expired' ? 'red' : 'yellow'} />
          <Text style={styles.complianceDate}>{formatDate(item.date)}</Text>
        </View>
      </View>
      <Text style={[styles.complianceStatus, item.status === 'expired' ? styles.complianceExpired : styles.complianceDue]}>{item.helper}</Text>
    </View>
  );
}

function Dot({ tone }: { tone: 'red' | 'yellow' }) {
  return <View style={[styles.statusDot, tone === 'red' ? styles.redDot : styles.yellowDot]} />;
}

function PulseDot({ tone }: { tone: 'red' | 'yellow' }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.35, duration: 650, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.35, duration: 650, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return <Animated.View style={[styles.animatedDot, tone === 'red' ? styles.redDot : styles.yellowDot, { opacity, transform: [{ scale }] }]} />;
}

function vehicleComplianceItems(vehicle: Vehicle | null, policy: Policy | null): ComplianceItem[] {
  if (!vehicle) return [];
  return [
    { key: 'policy', label: 'Insurance policy', date: policy?.end_date ?? null },
    { key: 'fitness', label: 'Fitness certificate', date: vehicle.fitness_expiry_date },
    { key: 'puc', label: 'PUC certificate', date: vehicle.puc_expiry_date },
    { key: 'road_tax', label: 'Road tax', date: vehicle.road_tax_expiry_date },
    { key: 'national_permit', label: 'National permit', date: vehicle.national_permit_expiry_date },
    { key: 'local_permit', label: 'Local permit', date: vehicle.local_permit_expiry_date },
  ].map((item) => ({ ...item, ...complianceStatus(item.date) }));
}

function complianceStatus(date: string | null) {
  if (!date) return { status: 'ok' as const, helper: 'Not available' };
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (days < 0) return { status: 'expired' as const, helper: `${Math.abs(days)}d overdue` };
  if (days <= 45) return { status: 'due' as const, helper: `${days}d left` };
  return { status: 'ok' as const, helper: `${days}d left` };
}

function isPrivateVehicle(vehicle: Vehicle) {
  return (vehicle.vehicle_type ?? '').toLowerCase().includes('private');
}

function privateNotApplicable(vehicle: Vehicle, value?: string | null) {
  if (isPrivateVehicle(vehicle)) return 'N/A';
  return value;
}

function registeredCompanyName(customerId: string, contexts: CustomerAccountContext[]) {
  const context = contexts.find((item) => item.customer_id === customerId);
  return context ? customerAccountTitle(context) : '';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  heroCard: { marginTop: -20, padding: 12, overflow: 'hidden', backgroundColor: '#F2F7FF', borderColor: '#C9DDFF' },
  heroWash: { position: 'absolute', right: -70, top: -80, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(7,94,234,0.12)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroCopy: { flex: 1, minWidth: 0 },
  vehicleNo: { color: palette.ink, fontSize: 22, lineHeight: 26, fontWeight: '800' },
  vehicleMeta: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 2 },
  companyName: { color: '#0A43A3', fontSize: 10.5, lineHeight: 13, fontWeight: '700', marginBottom: 1 },
  vehicleImage: { width: 54, height: 38 },
  heroStats: { flexDirection: 'row', gap: 7, marginTop: 10 },
  heroHelper: { color: palette.slate, fontSize: 11, fontWeight: '600', marginTop: 7 },
  miniStat: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: '#D9E8FA', padding: 7, justifyContent: 'center' },
  miniLabel: { color: '#64748B', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase' },
  miniValue: { color: palette.navy, fontSize: 11.5, fontWeight: '800', marginTop: 3 },
  alertSection: { padding: 10, backgroundColor: '#FFF5E6', borderColor: '#D99012', borderWidth: 1.2 },
  detailSection: { backgroundColor: '#F8FBFF', borderColor: '#D7E6FA' },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  compactSectionRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 9 },
  alertIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF1D8', alignItems: 'center', justifyContent: 'center' },
  alertCountBox: { minWidth: 44, height: 30, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0E1C8', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  alertCountBoxWarning: { backgroundColor: '#FFF0D2', borderColor: '#D99012' },
  alertCount: { color: '#B7791F', fontSize: 14, fontWeight: '900' },
  detailIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: palette.navy, fontSize: 14.5, lineHeight: 18, fontWeight: '700' },
  sectionHint: { color: palette.slate, fontSize: 11, fontWeight: '500', lineHeight: 15, marginTop: 1, marginBottom: 2 },
  alertLegend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 8 },
  legendText: { color: '#5F6B7A', fontSize: 10.5, fontWeight: '600', marginRight: 8 },
  complianceRow: { minHeight: 48, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0E1C8', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
  complianceCopy: { flex: 1, minWidth: 0 },
  complianceTitle: { color: palette.navy, fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  complianceDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  complianceDate: { color: '#667085', fontSize: 11, lineHeight: 14, fontWeight: '500', marginTop: 1 },
  complianceStatus: { fontSize: 11, fontWeight: '700' },
  complianceExpired: { color: '#C43D2D' },
  complianceDue: { color: '#B7791F' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  animatedDot: { width: 8, height: 8, borderRadius: 4 },
  redDot: { backgroundColor: '#C43D2D' },
  yellowDot: { backgroundColor: '#F6C33B' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 0, marginTop: 4 },
  detailCell: { width: '48%', minHeight: 50, paddingVertical: 8, flexDirection: 'row', gap: 7, borderBottomWidth: 1, borderBottomColor: '#E5ECF5' },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: '#64748B', fontSize: 9.5, fontWeight: '500', textTransform: 'uppercase' },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  detailValue: { flex: 1, color: palette.ink, fontSize: 12, lineHeight: 15, fontWeight: '500' },
  emptyText: { color: palette.slate, fontSize: 12.5, lineHeight: 18, fontWeight: '500', marginTop: 6 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { fontSize: 9, fontWeight: '800' },
});
