import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { formatExternalPolicyNumber } from '@/lib/policy-number-display';
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

type AlertItem = {
  key: string;
  label: string;
  date: string;
  status: 'expired' | 'due';
  days: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type TabKey = 'details' | 'documents' | 'history';

export default function VehicleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [policies, setPolicies] = useState<VehiclePolicyDisplay[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  useEffect(() => {
    async function load() {
      if (!id) return;
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const customerIds = contexts.map((context) => context.customer_id);
      if (!customerIds.length) {
        setLoading(false);
        return;
      }

      const vehicleResult = await supabase.from('vehicles').select('*').eq('id', id).in('customer_id', customerIds).maybeSingle();
      setVehicle(vehicleResult.data);

      if (vehicleResult.data) {
        const [policyResult, externalPolicyResult] = await Promise.all([
          supabase.from('policies').select('vehicle_id,insurance_company_id,policy_no,start_date,end_date').eq('vehicle_id', vehicleResult.data.id).in('customer_id', customerIds),
          (supabase as any).from('external_policies').select('vehicle_id,insurance_company_id,policy_no,start_date,end_date').eq('vehicle_id', vehicleResult.data.id).in('customer_id', customerIds),
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
  const alerts = useMemo(() => buildAlerts(vehicle, latestPolicy), [latestPolicy, vehicle]);
  const expiredCount = alerts.filter((item) => item.status === 'expired').length;
  const dueCount = alerts.filter((item) => item.status === 'due').length;
  const vehicleImage = vehicle ? vehicleSketchFor(vehicle) : truckSketch;

  if (loading) return <Screen title="Vehicle Detail"><LoadingState /></Screen>;
  if (!vehicle) return <Screen title="Vehicle Detail"><EmptyState title="Vehicle not found" body="Please choose another vehicle from your list." /></Screen>;

  const v = vehicle as any;
  const modelText = [v.make, v.model].filter(Boolean).join(' ') || v.vehicle_type || 'Vehicle';
  const policyType = latestPolicy?.source === 'external' ? 'External' : latestPolicy ? 'Insureit' : '-';

  return (
    <Screen title="Vehicle Detail" subtitle={v.vehicle_no} showLogout showTitleHeader={false}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIdentity}>
            <Text style={styles.eyebrow}>VEHICLE DETAIL</Text>
            <View style={styles.vehicleNoRow}>
              <Text style={styles.vehicleNo} numberOfLines={1}>{v.vehicle_no || '-'}</Text>
              <MaterialCommunityIcons name="content-copy" size={17} color="#6B7E9E" />
            </View>
            <Text style={styles.vehicleMeta} numberOfLines={2}>{modelText}</Text>
          </View>
          <View style={styles.vehicleArtWrap}>
            <Image source={vehicleImage} style={styles.vehicleArt} resizeMode="contain" />
          </View>
          <View style={[styles.statusBadge, policyState.tone === 'green' ? styles.statusBadgeGreen : policyState.tone === 'orange' ? styles.statusBadgeOrange : styles.statusBadgeRed]}>
            <MaterialCommunityIcons name={policyState.tone === 'green' ? 'shield-check' : 'shield-alert'} size={14} color={policyState.tone === 'green' ? '#12805C' : policyState.tone === 'orange' ? '#B7791F' : '#D62F2F'} />
            <Text style={[styles.statusBadgeText, policyState.tone === 'green' ? styles.statusGreenText : policyState.tone === 'orange' ? styles.statusOrangeText : styles.statusRedText]}>{policyState.label}</Text>
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <SummaryItem icon="file-document-outline" label="Insurer" value={latestPolicyCompany?.name ?? 'Pending'} />
          <View style={styles.statDivider} />
          <SummaryItem icon="shield-check-outline" label="Policy Type" value={policyType} accent="#0B9A83" />
          <View style={styles.statDivider} />
          <SummaryItem icon="calendar-month-outline" label="Expiry Date" value={latestPolicy ? formatDate(latestPolicy.end_date) : '-'} />
        </View>
      </View>

      <View style={[styles.protectionCard, policyState.tone === 'green' ? styles.protectionGreen : policyState.tone === 'orange' ? styles.protectionOrange : styles.protectionRed]}>
        <View style={styles.protectionIconWrap}>
          <MaterialCommunityIcons name={policyState.tone === 'green' ? 'shield-check' : 'shield-remove'} size={22} color={policyState.tone === 'green' ? '#12805C' : policyState.tone === 'orange' ? '#B7791F' : '#D93030'} />
        </View>
        <View style={styles.protectionCopy}>
          <Text style={[styles.protectionLabel, policyState.tone === 'red' && styles.statusRedText]}>PROTECTION STATUS</Text>
          <View style={styles.protectionLine}>
            <Text style={[styles.protectionTitle, policyState.tone === 'red' && styles.statusRedText]}>{policyState.label}</Text>
            <Text style={styles.protectionDot}>•</Text>
            <Text style={styles.protectionHelper}>{policyState.helper}</Text>
          </View>
        </View>
        {policyState.tone !== 'green' ? (
          <Pressable onPress={() => router.push({ pathname: '/customer/add-policy', params: { vehicleId: v.id } } as any)} style={({ pressed }) => [styles.renewButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="refresh" size={17} color="#D93030" />
            <Text style={styles.renewButtonText}>{latestPolicy ? 'Renew Now' : 'Add policy'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.alertCard}>
        <Pressable onPress={() => setAlertsExpanded((value) => !value)} style={styles.alertHeader}>
          <View style={styles.alertBellWrap}><MaterialCommunityIcons name="bell-alert" size={24} color="#E4A521" /></View>
          <View style={styles.flexOne}>
            <Text style={styles.sectionTitle}>Alerts and dues</Text>
            <Text style={styles.sectionHint}>Expired and renewal-due documents</Text>
          </View>
          <View style={styles.itemCount}><Text style={styles.itemCountText}>{alerts.length} {alerts.length === 1 ? 'Item' : 'Items'}</Text><MaterialCommunityIcons name={alertsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.navy} /></View>
        </Pressable>
        {alertsExpanded ? (
          <>
            <View style={styles.alertLegend}>
              <View style={styles.legendPair}><View style={[styles.legendDot, styles.redDot]} /><Text style={styles.legendText}>Expired ({expiredCount})</Text></View>
              <View style={styles.legendPair}><View style={[styles.legendDot, styles.yellowDot]} /><Text style={styles.legendText}>Renewal due ({dueCount})</Text></View>
            </View>
            <View style={styles.alertList}>
              {alerts.length ? alerts.map((item) => <AlertRow key={item.key} item={item} />) : <Text style={styles.emptyText}>No expired or renewal-due documents found.</Text>}
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.tabsRow}>
        <TabButton active={activeTab === 'details'} label="Vehicle Details" onPress={() => setActiveTab('details')} />
        <TabButton active={activeTab === 'documents'} label="Documents" onPress={() => setActiveTab('documents')} />
        <TabButton active={activeTab === 'history'} label="History" onPress={() => setActiveTab('history')} />
      </View>

      {activeTab === 'details' ? (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleIcon}><MaterialCommunityIcons name="car" size={24} color="#1475F6" /></View>
            <View style={styles.flexOne}><Text style={styles.detailTitle}>Vehicle details</Text><Text style={styles.sectionHint}>Details stored for this vehicle</Text></View>
            <View style={styles.editButton}><MaterialCommunityIcons name="pencil" size={16} color="#1475F6" /><Text style={styles.editText}>Edit</Text></View>
          </View>

          <Text style={styles.groupLabel}>IDENTITY AND REGISTRATION</Text>
          <View style={styles.detailGrid}>
            <DetailCell icon="car" label="Vehicle type" value={v.vehicle_type} />
            <DetailCell icon="factory" label="Make" value={v.make} />
            <DetailCell icon="cube-outline" label="Model" value={v.model} />
            <DetailCell icon="calendar-month-outline" label="Manufacturing year" value={v.year ? String(v.year) : null} />
            <DetailCell icon="card-account-details-outline" label="Registration number" value={v.vehicle_no} />
            <DetailCell icon="gas-station-outline" label="Fuel type" value={v.fuel_type} />
            <DetailCell icon="weight-kilogram" label="GVW" value={v.gvw_kg ? `${Number(v.gvw_kg).toLocaleString('en-IN')} kg` : null} />
            <DetailCell icon="calendar-check-outline" label="Registration date" value={formatDate(v.registration_date)} />
            <DetailCell icon="barcode" label="Chassis no." value={maskAlternateCharacters(v.chassis_no)} />
            <DetailCell icon="engine-outline" label="Engine no." value={maskAlternateCharacters(v.engine_no)} />
          </View>

          <Text style={[styles.groupLabel, styles.secondGroup]}>COMPLIANCE AND PERMITS</Text>
          <View style={styles.detailGrid}>
            <DetailCell icon="file-certificate-outline" label="Permit no." value={v.permit_no} />
            <DetailCell icon="calendar-alert" label="Fitness expiry" value={formatDate(v.fitness_expiry_date)} status={dateStatus(v.fitness_expiry_date)} />
            <DetailCell icon="smog" label="PUC expiry" value={formatDate(v.puc_expiry_date)} status={dateStatus(v.puc_expiry_date)} />
            <DetailCell icon="road-variant" label="Road tax expiry" value={formatDate(v.road_tax_expiry_date)} status={dateStatus(v.road_tax_expiry_date)} />
            <DetailCell icon="map-marker-path" label="National permit expiry" value={formatDate(v.national_permit_expiry_date)} status={dateStatus(v.national_permit_expiry_date)} />
            <DetailCell icon="map-marker-radius-outline" label="Local permit expiry" value={formatDate(v.local_permit_expiry_date)} status={dateStatus(v.local_permit_expiry_date)} />
          </View>
        </View>
      ) : activeTab === 'documents' ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Documents</Text>
          <Text style={styles.sectionHint}>Vehicle compliance and insurance dates available for this vehicle.</Text>
          <View style={styles.simpleList}>{buildDocumentRows(vehicle, latestPolicy).map((row) => <SimpleRow key={row.label} icon={row.icon} label={row.label} value={row.value} />)}</View>
        </View>
      ) : (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>History</Text>
          <Text style={styles.sectionHint}>Insurance policies recorded for this vehicle.</Text>
          <View style={styles.simpleList}>{policies.length ? [...policies].sort((a, b) => b.end_date.localeCompare(a.end_date)).map((policy) => <SimpleRow key={`${policy.source}-${policy.policy_no}-${policy.end_date}`} icon="shield-check-outline" label={policy.source === 'external' ? 'External policy' : 'Insureit policy'} value={`${policy.source === 'external' ? formatExternalPolicyNumber(policy.policy_no) : policy.policy_no} · ${formatDate(policy.end_date)}`} />) : <Text style={styles.emptyText}>No policy history found.</Text>}</View>
        </View>
      )}
    </Screen>
  );
}

function SummaryItem({ icon, label, value, accent = '#1475F6' }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; accent?: string }) {
  return <View style={styles.summaryItem}><MaterialCommunityIcons name={icon} size={22} color={accent} /><View style={styles.summaryCopy}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue} numberOfLines={1}>{value}</Text></View></View>;
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.tabButton, active && styles.tabButtonActive, pressed && styles.pressed]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>;
}

function AlertRow({ item }: { item: AlertItem }) {
  return <View style={styles.alertRow}><View style={[styles.alertRowIcon, item.status === 'expired' ? styles.alertRowIconRed : styles.alertRowIconYellow]}><MaterialCommunityIcons name={item.icon} size={23} color={item.status === 'expired' ? '#D93030' : '#B7791F'} /></View><View style={styles.flexOne}><Text style={styles.alertRowTitle}>{item.label}</Text><View style={styles.alertDateRow}><MaterialCommunityIcons name="calendar-month-outline" size={14} color="#63738F" /><Text style={styles.alertDate}>{formatDate(item.date)}</Text></View></View><Text style={[styles.overdueText, item.status === 'due' && styles.dueText]}>{item.status === 'expired' ? `${item.days}d overdue` : `${item.days}d left`}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={palette.navy} /></View>;
}

function DetailCell({ icon, label, value, status = 'ok' }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string | null; status?: 'expired' | 'due' | 'ok' }) {
  const danger = status === 'expired';
  const due = status === 'due';
  return <View style={styles.detailCell}><MaterialCommunityIcons name={icon} size={20} color={danger ? '#D93030' : due ? '#B7791F' : '#1475F6'} /><View style={styles.detailCellCopy}><Text style={styles.detailLabel}>{label}</Text><Text style={[styles.detailValue, danger && styles.detailValueDanger, due && styles.detailValueDue]} numberOfLines={2}>{value || '-'}</Text></View></View>;
}

function SimpleRow({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return <View style={styles.simpleRow}><MaterialCommunityIcons name={icon} size={20} color="#1475F6" /><View style={styles.flexOne}><Text style={styles.alertRowTitle}>{label}</Text><Text style={styles.sectionHint}>{value}</Text></View></View>;
}

function selectVehiclePolicy(policies: VehiclePolicyDisplay[]) {
  return [...policies].sort((a, b) => {
    const activeDelta = Number(isPolicyActive(b)) - Number(isPolicyActive(a));
    return activeDelta || new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
  })[0] ?? null;
}

function isPolicyActive(policy: Pick<VehiclePolicyDisplay, 'start_date' | 'end_date'>) {
  const today = new Date();
  const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return policy.start_date <= currentDate && policy.end_date >= currentDate;
}

function policyStatus(endDate: string) {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Expired', tone: 'red' as const, helper: `Expired ${Math.abs(days)} days ago` };
  if (days <= 30) return { label: 'Renewal due', tone: 'orange' as const, helper: `${days} days left` };
  return { label: 'Protected', tone: 'green' as const, helper: `${days} days of cover remaining` };
}

function buildAlerts(vehicle: Vehicle | null, policy: VehiclePolicyDisplay | null): AlertItem[] {
  if (!vehicle) return [];
  const v = vehicle as any;
  const values: Array<{ key: string; label: string; date?: string | null; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
    { key: 'policy', label: 'Insurance policy', date: policy?.end_date, icon: 'file-document-outline' },
    { key: 'fitness', label: 'Fitness certificate', date: v.fitness_expiry_date, icon: 'certificate-outline' },
    { key: 'road-tax', label: 'Road tax', date: v.road_tax_expiry_date, icon: 'road-variant' },
    { key: 'puc', label: 'PUC certificate', date: v.puc_expiry_date, icon: 'smog' },
    { key: 'national-permit', label: 'National permit', date: v.national_permit_expiry_date, icon: 'map-marker-path' },
    { key: 'local-permit', label: 'Local permit', date: v.local_permit_expiry_date, icon: 'map-marker-radius-outline' },
  ];
  return values.flatMap((item) => {
    if (!item.date) return [];
    const diff = Math.ceil((new Date(item.date).getTime() - Date.now()) / 86400000);
    if (diff < 0) return [{ ...item, date: item.date, status: 'expired' as const, days: Math.abs(diff) }];
    if (diff <= 30) return [{ ...item, date: item.date, status: 'due' as const, days: diff }];
    return [];
  });
}

function buildDocumentRows(vehicle: Vehicle, policy: VehiclePolicyDisplay | null) {
  const v = vehicle as any;
  return [
    { icon: 'file-document-outline' as const, label: 'Insurance policy', value: policy ? `Expires ${formatDate(policy.end_date)}` : 'Not added' },
    { icon: 'certificate-outline' as const, label: 'Fitness certificate', value: formatDate(v.fitness_expiry_date) },
    { icon: 'smog' as const, label: 'PUC certificate', value: formatDate(v.puc_expiry_date) },
    { icon: 'road-variant' as const, label: 'Road tax', value: formatDate(v.road_tax_expiry_date) },
  ];
}

function dateStatus(value?: string | null): 'expired' | 'due' | 'ok' {
  if (!value) return 'ok';
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'due';
  return 'ok';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function maskAlternateCharacters(value?: string | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  return normalized.split('').map((char, index) => index % 2 === 1 ? '•' : char).join('');
}

function vehicleSketchFor(vehicle: Vehicle) {
  const raw = `${(vehicle as any).vehicle_type ?? ''} ${(vehicle as any).make ?? ''} ${(vehicle as any).model ?? ''}`.toLowerCase();
  if (/twp|two.?wheeler|bike|motorcycle|scooter|honda|bajaj|hero|yamaha|tvs/.test(raw)) return bikeSketch;
  if (/pcv|bus|coach/.test(raw)) return busSketch;
  if (/jcb|excavator|loader|backhoe|construction/.test(raw)) return jcbSketch;
  if (/pcp|car|suv|sedan|hatchback/.test(raw)) return carSketch;
  return truckSketch;
}

const styles = StyleSheet.create({
  heroCard: { backgroundColor: '#F8FBFF', borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E3ECF7', overflow: 'hidden' },
  heroTopRow: { minHeight: 174, flexDirection: 'row', position: 'relative', alignItems: 'flex-start' },
  heroIdentity: { flex: 1, paddingTop: 15, paddingRight: 8, zIndex: 2 },
  eyebrow: { color: '#63738F', fontSize: 12, fontWeight: '800', letterSpacing: 1.1, marginBottom: 12 },
  vehicleNoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  vehicleNo: { color: palette.navy, fontSize: 24, lineHeight: 29, fontWeight: '900', maxWidth: '88%' },
  vehicleMeta: { color: '#667995', fontSize: 16, lineHeight: 22, marginTop: 6, fontWeight: '600' },
  vehicleArtWrap: { width: '44%', height: 155, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF7FF', borderRadius: 90 },
  vehicleArt: { width: '118%', height: '92%' },
  statusBadge: { position: 'absolute', right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  statusBadgeRed: { backgroundColor: '#FFF0F0' },
  statusBadgeOrange: { backgroundColor: '#FFF5E5' },
  statusBadgeGreen: { backgroundColor: '#EAF8F1' },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  statusRedText: { color: '#D93030' },
  statusOrangeText: { color: '#B7791F' },
  statusGreenText: { color: '#12805C' },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12 },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryLabel: { color: '#72829B', fontSize: 11, marginBottom: 3 },
  summaryValue: { color: palette.navy, fontSize: 12.5, fontWeight: '800' },
  statDivider: { width: 1, height: 44, backgroundColor: '#D7E0EC', marginHorizontal: 8 },
  protectionCard: { borderRadius: 18, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  protectionRed: { backgroundColor: '#FFF4F4', borderColor: '#FFDADA' },
  protectionOrange: { backgroundColor: '#FFFAF0', borderColor: '#F3DFB7' },
  protectionGreen: { backgroundColor: '#F2FBF7', borderColor: '#CBEADA' },
  protectionIconWrap: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#FFFFFFAA', alignItems: 'center', justifyContent: 'center' },
  protectionCopy: { flex: 1, minWidth: 0 },
  protectionLabel: { color: '#A53A3A', fontSize: 10.5, fontWeight: '900', letterSpacing: .6 },
  protectionLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  protectionTitle: { color: palette.navy, fontWeight: '900', fontSize: 15 },
  protectionDot: { color: '#C8A3A3' },
  protectionHelper: { color: '#75839A', fontSize: 12 },
  renewButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFE8E8', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16 },
  renewButtonText: { color: '#D93030', fontWeight: '800', fontSize: 12 },
  alertCard: { backgroundColor: '#FFFCF2', borderRadius: 22, borderWidth: 1, borderColor: '#F2E6BD', padding: 16, marginBottom: 14 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertBellWrap: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#FFF1C9', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: palette.navy, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: '#6C7A91', fontSize: 12.5, marginTop: 2 },
  itemCount: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#EAD7A1', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  itemCountText: { color: '#82621D', fontWeight: '800', fontSize: 12 },
  alertLegend: { flexDirection: 'row', gap: 24, marginTop: 14, marginBottom: 8 },
  legendPair: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 11, height: 11, borderRadius: 6 },
  redDot: { backgroundColor: '#EE4040' },
  yellowDot: { backgroundColor: '#F4C94A' },
  legendText: { color: '#60718E', fontSize: 12 },
  alertList: { gap: 9 },
  alertRow: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E8E2D3', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  alertRowIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  alertRowIconRed: { backgroundColor: '#FFF0F0' },
  alertRowIconYellow: { backgroundColor: '#FFF7E3' },
  alertRowTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '800' },
  alertDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  alertDate: { color: '#63738F', fontSize: 11.5 },
  overdueText: { color: '#D93030', fontSize: 12, fontWeight: '800' },
  dueText: { color: '#B7791F' },
  tabsRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  tabButton: { flex: 1, minHeight: 48, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8EEF7' },
  tabButtonActive: { backgroundColor: '#2F63F5', borderColor: '#2F63F5' },
  tabText: { color: '#60718E', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#FFFFFF' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E5EDF7', padding: 18, marginBottom: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 19 },
  detailTitleIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  detailTitle: { color: palette.navy, fontSize: 19, fontWeight: '900' },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  editText: { color: '#1475F6', fontWeight: '800', fontSize: 12 },
  groupLabel: { color: '#2F4E86', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4, marginBottom: 6 },
  secondGroup: { marginTop: 18 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  detailCell: { width: '50%', minHeight: 78, flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingVertical: 13, paddingRight: 8 },
  detailCellCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: '#76859D', fontSize: 10.5, marginBottom: 4 },
  detailValue: { color: palette.navy, fontSize: 13.5, fontWeight: '700' },
  detailValueDanger: { color: '#D93030' },
  detailValueDue: { color: '#B7791F' },
  simpleList: { marginTop: 14, gap: 10 },
  simpleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  emptyText: { color: '#6C7A91', textAlign: 'center', paddingVertical: 16, fontSize: 12.5 },
  flexOne: { flex: 1, minWidth: 0 },
  pressed: { opacity: .78 },
});
