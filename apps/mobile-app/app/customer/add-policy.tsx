import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { Button, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

export default function AddPolicyScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicleId ?? '');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [policyType, setPolicyType] = useState('Commercial comprehensive');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [premium, setPremium] = useState('');
  const [idv, setIdv] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextContexts = await getOperationalCustomerContexts();
      const ids = nextContexts.map((item) => item.customer_id);
      const [vehicleResult, companyResult] = await Promise.all([
        ids.length ? supabase.from('vehicles').select('*').in('customer_id', ids).order('vehicle_no') : Promise.resolve({ data: [] }),
        supabase.from('insurance_companies').select('*').order('name'),
      ]);
      if (!active) return;
      const nextVehicles = (vehicleResult.data ?? []) as Vehicle[];
      const routeVehicle = vehicleId ? nextVehicles.find((item) => item.id === vehicleId) : null;
      const firstCustomerId = routeVehicle?.customer_id ?? nextContexts[0]?.customer_id ?? '';
      const firstVehicle = routeVehicle ?? nextVehicles.find((item) => item.customer_id === firstCustomerId) ?? null;
      setContexts(nextContexts);
      setVehicles(nextVehicles);
      setCompanies((companyResult.data ?? []) as InsuranceCompany[]);
      setSelectedCustomerId(firstCustomerId);
      setSelectedVehicleId(firstVehicle?.id ?? '');
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router, vehicleId]);

  const accountVehicles = useMemo(() => vehicles.filter((item) => item.customer_id === selectedCustomerId), [selectedCustomerId, vehicles]);
  const selectedVehicle = accountVehicles.find((item) => item.id === selectedVehicleId) ?? null;

  function selectAccount(customerId: string) {
    setSelectedCustomerId(customerId);
    const first = vehicles.find((item) => item.customer_id === customerId);
    setSelectedVehicleId(first?.id ?? '');
  }

  async function save() {
    setMessage('');
    if (saving) return;
    if (!selectedCustomerId || !selectedVehicleId) return setMessage('Select the account and vehicle.');
    if (!selectedCompanyId) return setMessage('Select the insurance company.');
    if (!policyNo.trim()) return setMessage('Enter the policy number.');
    if (!startDate || !endDate) return setMessage('Select policy start and end dates.');
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) return setMessage('Policy end date must be after the start date.');
    const premiumAmount = premium.trim() ? Number(premium) : null;
    const idvAmount = idv.trim() ? Number(idv) : null;
    if (premiumAmount !== null && (!Number.isFinite(premiumAmount) || premiumAmount < 0)) return setMessage('Enter a valid premium amount.');
    if (idvAmount !== null && (!Number.isFinite(idvAmount) || idvAmount < 0)) return setMessage('Enter a valid IDV amount.');

    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)('create_customer_external_policy', {
        p_customer_id: selectedCustomerId,
        p_vehicle_id: selectedVehicleId,
        p_insurance_company_id: selectedCompanyId,
        p_policy_no: policyNo.trim().toUpperCase(),
        p_policy_type: policyType.trim(),
        p_start_date: startDate,
        p_end_date: endDate,
        p_premium_amount: premiumAmount,
        p_insured_declared_value: idvAmount,
      });
      if (error) {
        setMessage(/duplicate/i.test(error.message) ? 'This external policy is already recorded for the selected account.' : error.message || 'We could not save the external policy.');
        return;
      }
      router.replace('/customer/start-claim');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title="Add External Policy"><LoadingState label="Opening external policy form" /></Screen>;

  return (
    <Screen title="Add External Policy" showTitleHeader={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>CUSTOMER PORTFOLIO</Text><Text style={styles.title}>Add External Policy</Text><Text style={styles.subtitle}>Use this only for a policy purchased outside Sankalp. It stays separate from Sankalp business, payout, partner and RM reporting.</Text></View>
      </View>

      <View style={styles.infoBanner}><MaterialCommunityIcons name="database-lock-outline" size={22} color="#0A43A3" /><View style={styles.infoCopy}><Text style={styles.infoTitle}>Stored separately</Text><Text style={styles.infoText}>This record is used for your portfolio, renewals and self-tracked claims. It does not become Sankalp business.</Text></View></View>

      {message ? <Message type="error">{message}</Message> : null}

      {contexts.length > 1 ? <View style={styles.section}><Text style={styles.label}>Account</Text><View style={styles.chips}>{contexts.map((context) => <Chip key={context.customer_id} label={customerAccountTitle(context)} active={selectedCustomerId === context.customer_id} onPress={() => selectAccount(context.customer_id)} />)}</View></View> : null}

      <View style={styles.section}><Text style={styles.label}>Vehicle</Text><View style={styles.chips}>{accountVehicles.map((vehicle) => <Chip key={vehicle.id} label={vehicle.vehicle_no} active={selectedVehicleId === vehicle.id} onPress={() => setSelectedVehicleId(vehicle.id)} />)}</View>{selectedVehicle ? <Text style={styles.vehicleMeta}>{[selectedVehicle.make, selectedVehicle.model, selectedVehicle.vehicle_type].filter(Boolean).join(' • ')}</Text> : null}</View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Policy details</Text>
        <TextField label="Policy number *" value={policyNo} onChangeText={(value) => setPolicyNo(value.toUpperCase())} autoCapitalize="characters" />
        <View style={styles.gap} /><TextField label="Policy type *" value={policyType} onChangeText={setPolicyType} />
        <View style={styles.gap} /><AppDatePicker label="Start Date *" value={startDate} onChange={setStartDate} formatDisplay={formatDisplayDate} />
        <View style={styles.gap} /><AppDatePicker label="End Date *" value={endDate} onChange={setEndDate} formatDisplay={formatDisplayDate} />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Insurance company</Text>
        <View style={styles.insurerStack}>{companies.map((company) => { const active = selectedCompanyId === company.id; return <Pressable key={company.id} onPress={() => setSelectedCompanyId(company.id)} style={[styles.insurerRow, active && styles.insurerRowActive]}><View style={[styles.insurerIcon, active && styles.insurerIconActive]}><MaterialCommunityIcons name="shield-check-outline" size={18} color={active ? '#0A43A3' : '#667085'} /></View><Text numberOfLines={1} style={[styles.insurerName, active && styles.insurerNameActive]}>{company.name}</Text><MaterialCommunityIcons name={active ? 'check-circle' : 'circle-outline'} size={19} color={active ? '#0A43A3' : '#B7C0CC'} /></Pressable>; })}</View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Optional values</Text>
        <TextField label="Premium amount" value={premium} onChangeText={(value) => setPremium(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
        <View style={styles.gap} /><TextField label="Insured Declared Value (IDV)" value={idv} onChangeText={(value) => setIdv(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
      </View>

      <Button label={saving ? 'Saving external policy...' : 'Save External Policy'} onPress={save} disabled={saving} />
      <View style={styles.bottomSpace} />
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function formatDisplayDate(value: string) { if (!value) return ''; const [year, month, day] = value.split('-'); return `${day}-${month}-${year}`; }

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: -12, marginBottom: 15 }, backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1 }, eyebrow: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 }, title: { color: palette.navy, fontSize: 22, fontWeight: '900', marginTop: 2 }, subtitle: { color: '#667085', fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 4 },
  infoBanner: { flexDirection: 'row', gap: 9, borderRadius: 16, backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#C9DCF7', padding: 12, marginBottom: 14 }, infoCopy: { flex: 1 }, infoTitle: { color: palette.navy, fontSize: 12, fontWeight: '900' }, infoText: { color: '#53647B', fontSize: 10.2, lineHeight: 14.5, fontWeight: '600', marginTop: 2 },
  section: { marginBottom: 14 }, label: { color: palette.navy, fontSize: 12.5, fontWeight: '900', marginBottom: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { height: 35, maxWidth: 185, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D8E3EF', backgroundColor: '#FFFFFF' }, chipActive: { backgroundColor: palette.navy, borderColor: palette.navy }, chipText: { color: '#65758B', fontSize: 10.5, fontWeight: '800' }, chipTextActive: { color: '#FFFFFF' }, vehicleMeta: { color: '#7A8799', fontSize: 9.8, fontWeight: '600', marginTop: 7 },
  formCard: { borderRadius: 18, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', padding: 14, marginBottom: 12 }, cardTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900', marginBottom: 11 }, gap: { height: 10 }, insurerStack: { gap: 7 }, insurerRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: '#E0E7EF', backgroundColor: '#FFFFFF', paddingHorizontal: 10 }, insurerRowActive: { borderColor: '#9ABCEA', backgroundColor: '#F6FAFF' }, insurerIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F5F8', alignItems: 'center', justifyContent: 'center' }, insurerIconActive: { backgroundColor: '#EAF2FF' }, insurerName: { flex: 1, color: '#53647B', fontSize: 11, fontWeight: '700' }, insurerNameActive: { color: palette.navy, fontWeight: '900' }, bottomSpace: { height: 18 },
});
