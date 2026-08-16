import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

const truckSketch = require('../../assets/vehicles/gcv-truck.webp');
const carSketch = require('../../assets/vehicles/pcp-car.webp');
const busSketch = require('../../assets/vehicles/pcv-bus.webp');
const bikeSketch = require('../../assets/vehicles/twp-bike.png');
const jcbSketch = require('../../assets/vehicles/misd-cpm-jcb.png');

type VehiclePolicyDisplay = {
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  start_date: string;
  end_date: string;
  source: 'sibl' | 'external';
};

export default function VehicleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [policies, setPolicies] = useState<VehiclePolicyDisplay[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsExpanded, setAlertsExpanded] = useState(false);

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
        const [policyResult, externalPolicyResult] = await Promise.all([
          supabase.from('policies').select('vehicle_id,insurance_company_id,policy_no,start_date,end_date').eq('vehicle_id', vehicleResult.data.id).in('customer_id', ids),
          (supabase as any).from('external_policies').select('vehicle_id,insurance_company_id,policy_no,start_date,end_date').eq('vehicle_id', vehicleResult.data.id).in('customer_id', ids),
        ]);
        const nextPolicies: VehiclePolicyDisplay[] = [
          ...((policyResult.data ?? []).map((policy) => ({ ...policy, source: 'sibl' as const }))),
          ...(((externalPolicyResult.data ?? []) as Omit<VehiclePolicyDisplay, 'source'>[]).map((policy) => ({ ...policy, source: 'external' as const }))),
        ];
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
  const latestPolicy = useMemo(() => selectVehiclePolicy(policies), [policies]);
  const latestPolicyCompany = latestPolicy ? companyById.get(latestPolicy.insurance_company_id) : null;
  const policyState = latestPolicy ? policyStatus(latestPolicy.end_date) : { label: 'No policy', tone: 'red' as const, helper: 'Add a policy to complete protection' };
  const policyAction = policyState.tone === 'red' ? { label: 'Add policy', icon: 'shield-plus-outline' as const } : policyState.tone === 'orange' ? { label: 'Get quote', icon: 'file-document-outline' as const } : null;
  const statusTone = policyTone(policyState.tone);
  const complianceItems = useMemo(() => vehicleComplianceItems(vehicle, latestPolicy), [latestPolicy, vehicle]);
  const alertItems = complianceItems.filter((item) => item.status !== 'ok');
  const vehicleImage = vehicle ? vehicleSketchFor(vehicle) : truckSketch;

  if (loading) return <Screen title="Vehicle Detail"><LoadingState /></Screen>;
  if (!vehicle) return <Screen title="Vehicle Detail"><EmptyState title="Vehicle not found" body="Please choose another vehicle from your list." /></Screen>;

  return (
    <Screen title="Vehicle Detail" subtitle={vehicle.vehicle_no} showLogout showTitleHeader={false}>
      <View style={[styles.heroCard, { backgroundColor: statusTone.background, borderColor: statusTone.border }]}>
        <View style={[styles.heroAccent, { backgroundColor: statusTone.accent }]} />
        <View style={styles.heroTop}>
          <View style={[styles.vehicleImageShell, { backgroundColor: statusTone.soft }]}>
            <Image source={vehicleImage} style={styles.vehicleImage} resizeMode="contain" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: statusTone.accent }]}>VEHICLE DETAIL</Text>
            <Text style={styles.vehicleNo} numberOfLines={1}>{vehicle.vehicle_no}</Text>
            <Text style={styles.vehicleMeta} numberOfLines={2}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_type || 'Vehicle'}</Text>
          </View>
          <StatusPill tone={policyState.tone} label={policyState.label} showDot={policyState.tone !== 'green'} />
        </View>
        <View style={styles.policySummary}>
          <MiniStat label="Insurer" value={latestPolicyCompany?.name ?? 'Pending'} />
          <MiniStat label="Policy" value={latestPolicy?.policy_no ?? 'Not added'} badge={latestPolicy?.source === 'external' ? 'External' : undefined} />
          <MiniStat label="Expiry" value={latestPolicy ? formatDate(latestPolicy.end_date) : '-'} />
        </View>
        <View style={[styles.protectionRow, { borderTopColor: statusTone.border }]}>
          <View style={[styles.protectionIcon, { backgroundColor: statusTone.soft }]}>
            <MaterialCommunityIcons name={latestPolicy ? 'shield-check-outline' : 'shield-plus-outline'} size={20} color={statusTone.accent} />
          </View>
          <View style={styles.protectionCopy}>
            <Text style={[styles.nextLabel, { color: statusTone.accent }]}>PROTECTION STATUS</Text>
            <Text style={styles.nextTitle}>{policyState.label}</Text>
          </View>
          {policyAction ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/customer/add-policy', params: { vehicleId: vehicle.id } } as any)} style={({ pressed }) => [styles.compactPolicyAction, { backgroundColor: statusTone.accent }, pressed && styles.actionPressed]}>
            <MaterialCommunityIcons name={policyAction.icon} size={14} color="#FFFFFF" />
            <Text style={styles.compactPolicyActionText}>{policyAction.label}</Text>
          </Pressable> : null}
        </View>
        <View style={styles.protectionHelperRow}>
          <Text style={styles.nextBody}>{policyState.helper}</Text>
        </View>
      </View>

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
        <Text style={styles.detailGroupLabel}>Identity and registration</Text>
        <View style={styles.detailGrid}>
          <DetailCell icon="truck-outline" label="Vehicle type" value={vehicle.vehicle_type} />
          <DetailCell icon="factory" label="Make" value={vehicle.make} />
          <DetailCell icon="car-info" label="Model" value={vehicle.model} />
          <DetailCell icon="calendar-blank-outline" label="Manufacturing year" value={vehicle.year ? String(vehicle.year) : null} />
          <DetailCell icon="weight-kilogram" label="GVW" value={privateNotApplicable(vehicle, vehicle.gvw_kg ? `${vehicle.gvw_kg.toLocaleString('en-IN')} kg` : null)} />
          <DetailCell icon="calendar-check-outline" label="Registration date" value={formatDate(vehicle.registration_date)} />
          <DetailCell icon="barcode" label="Chassis no." value={vehicle.chassis_no} />
          <DetailCell icon="engine-outline" label="Engine no." value={vehicle.engine_no} />
        </View>
        <Text style={styles.detailGroupLabel}>Compliance and permits</Text>
        <View style={styles.detailGrid}>
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

function MiniStat({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return <View style={styles.miniStat}><View style={styles.miniLabelRow}><Text style={styles.miniLabel}>{label}</Text>{badge ? <View style={styles.externalBadge}><Text style={styles.externalBadgeText}>{badge}</Text></View> : null}</View><Text style={styles.miniValue} numberOfLines={1}>{value}</Text></View>;
}

function DetailCell({ icon, label, value, status = 'ok' }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string | null; status?: 'expired' | 'due' | 'ok' }) {
  const showDateDot = status === 'expired' || status === 'due';
  return <View style={styles.detailCell}><MaterialCommunityIcons name={icon} size={15} color={showDateDot ? status === 'expired' ? '#C43D2D' : '#B7791F' : '#7A8799'} /><View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><View style={styles.detailValueRow}>{showDateDot ? <PulseDot tone={status === 'expired' ? 'red' : 'yellow'} /> : null}<Text style={[styles.detailValue, status === 'expired' && styles.detailValueExpired, status === 'due' && styles.detailValueDue]} numberOfLines={2}>{value || '-'}</Text></View></View></View>;
}

function selectVehiclePolicy(policies: VehiclePolicyDisplay[]) {
  return [...policies].sort((a, b) => {
    const activeDelta = Number(isPolicyActive(b)) - Number(isPolicyActive(a));
    return activeDelta || new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
  })[0] ?? null;
}

function isPolicyActive(policy: Pick<VehiclePolicyDisplay, 'start_date' | 'end_date'>) {
  const now = new Date();
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return policy.start_date <= currentDate && policy.end_date >= currentDate;
}

function policyStatus(endDate: string) {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Expired', tone: 'red' as const, helper: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` };
  if (days <= 30) return { label: 'Renewal due', tone: 'orange' as const, helper: `${days} day${days === 1 ? '' : 's'} left for renewal` };
  return { label: 'Protected', tone: 'green' as const, helper: `${days} day${days === 1 ? '' : 's'} of cover remaining` };
}

function policyTone(tone: 'green' | 'orange' | 'red') {
  if (tone === 'green') return { accent: '#12805C', soft: '#E8F8F0', background: '#F7FCF9', border: '#BFE6D5' };
  if (tone === 'orange') return { accent: '#B7791F', soft: '#FFF4E2', background: '#FFFBF3', border: '#F0D9AC' };
  return { accent: '#C43838', soft: '#FDECEC', background: '#FFF8F8', border: '#F2C6C6' };
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

function vehicleComplianceItems(vehicle: Vehicle | null, policy: VehiclePolicyDisplay | null): ComplianceItem[] {
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

function vehicleClassCode(vehicle: Vehicle) {
  const normalized = (vehicle.vehicle_type ?? '').trim().toUpperCase();
  if (normalized === 'PCP' || normalized.startsWith('PCP ')) return 'PCP';
  if (
    normalized === 'TWP'
    || normalized.startsWith('TWP ')
    || normalized.includes('TWO WHEEL')
    || normalized.includes('TWO-WHEEL')
    || normalized.includes('2 WHEEL')
    || normalized.includes('MOTORCYCLE')
    || normalized.includes('MOTOR CYCLE')
    || normalized.includes('BIKE')
    || normalized.includes('SCOOTER')
  ) return 'TWP';
  if (normalized === 'PCV' || normalized.startsWith('PCV ') || normalized.includes('PASSENGER') || normalized.includes('BUS')) return 'PCV';
  if (normalized === 'MISD' || normalized.startsWith('MISD ') || normalized.includes('MISCELLANEOUS')) return 'MISD';
  if (normalized === 'CPM' || normalized.startsWith('CPM ') || normalized.includes('PLANT') || normalized.includes('MACHINERY')) return 'CPM';
  if (normalized === 'GCV' || normalized.startsWith('GCV ') || normalized.includes('GOODS')) return 'GCV';
  if (normalized.includes('PRIVATE') || normalized.includes('CAR')) return 'PCP';
  return normalized || 'GCV';
}

function vehicleSketchFor(vehicle: Vehicle) {
  switch (vehicleClassCode(vehicle)) {
    case 'PCP': return carSketch;
    case 'PCV': return busSketch;
    case 'TWP': return bikeSketch;
    case 'MISD':
    case 'CPM': return jcbSketch;
    default: return truckSketch;
  }
}

function isPrivateVehicle(vehicle: Vehicle) {
  return vehicleClassCode(vehicle) === 'PCP';
}

function privateNotApplicable(vehicle: Vehicle, value?: string | null) {
  if (isPrivateVehicle(vehicle)) return 'N/A';
  return value;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  heroCard: { marginTop: 0, padding: 15, overflow: 'hidden', borderWidth: 1, borderRadius: 21, marginBottom: 10 },
  heroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: palette.navy, fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  vehicleNo: { color: palette.navy, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 1 },
  vehicleMeta: { color: '#334155', fontSize: 12, fontWeight: '800', marginTop: 2 },
  companyName: { color: '#334155', fontSize: 10.5, lineHeight: 13, fontWeight: '800', marginTop: 2 },
  vehicleImageShell: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vehicleImage: { width: 44, height: 32 },
  policySummary: { flexDirection: 'row', gap: 7, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(100,120,150,.16)' },
  protectionRow: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  protectionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  protectionCopy: { flex: 1, minWidth: 0 },
  protectionHelperRow: { marginLeft: 45, marginTop: 3 },
  nextLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: .4 },
  nextTitle: { color: palette.navy, fontSize: 13, fontWeight: '900', marginTop: 2 },
  nextBody: { color: '#667085', fontSize: 10.3, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  compactPolicyAction: { minHeight: 30, borderRadius: 10, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  compactPolicyActionText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  actionPressed: { opacity: 0.86, transform: [{ scale: 0.97 }] },
  miniStat: { flex: 1, minHeight: 53, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.68)', borderWidth: 1, borderColor: 'rgba(100,120,150,.16)', padding: 8, justifyContent: 'center' },
  miniLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  externalBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#CFE0F8' },
  externalBadgeText: { color: '#315C99', fontSize: 7.5, lineHeight: 9, fontWeight: '800' },
  miniLabel: { color: '#64748B', fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase' },
  miniValue: { color: palette.navy, fontSize: 11.5, fontWeight: '900', marginTop: 4 },
  alertSection: { padding: 10, backgroundColor: '#FFFBF3', borderColor: '#E8D7B5', borderWidth: 1 },
  detailSection: { backgroundColor: '#F8FBFF', borderColor: '#D7E6FA' },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  compactSectionRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 9 },
  alertIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF1D8', alignItems: 'center', justifyContent: 'center' },
  alertCountBox: { minWidth: 44, height: 30, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8D7B5', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  alertCountBoxWarning: { backgroundColor: '#FFF4E2', borderColor: '#D8B978' },
  alertCount: { color: '#8A641E', fontSize: 14, fontWeight: '900' },
  detailIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: palette.navy, fontSize: 14.5, lineHeight: 18, fontWeight: '700' },
  sectionHint: { color: palette.slate, fontSize: 11, fontWeight: '500', lineHeight: 15, marginTop: 1, marginBottom: 2 },
  alertLegend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 8 },
  legendText: { color: '#5F6B7A', fontSize: 10.5, fontWeight: '600', marginRight: 8 },
  complianceRow: { minHeight: 48, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8D7B5', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
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
  detailGroupLabel: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: .55, textTransform: 'uppercase', marginTop: 8, marginBottom: 2 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 0, marginTop: 4 },
  detailCell: { width: '48%', minHeight: 50, paddingVertical: 8, flexDirection: 'row', gap: 7, borderBottomWidth: 1, borderBottomColor: '#E5ECF5' },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: '#64748B', fontSize: 9.5, fontWeight: '500', textTransform: 'uppercase' },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  detailValue: { flex: 1, color: palette.ink, fontSize: 12, lineHeight: 15, fontWeight: '500' },
  detailValueExpired: { color: '#B42318', fontWeight: '800' },
  detailValueDue: { color: '#946200', fontWeight: '800' },
  emptyText: { color: palette.slate, fontSize: 12.5, lineHeight: 18, fontWeight: '500', marginTop: 6 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { fontSize: 9, fontWeight: '800' },
});
