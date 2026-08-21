import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ClaimActionBar } from '@/components/external-claim-ui';
import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { customerAccountTitle, getOperationalCustomerContexts, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

type PolicyChoice = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  source: 'sibl' | 'external';
};

export default function StartClaimScreen() {
  const router = useRouter();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<PolicyChoice[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextContexts = await getOperationalCustomerContexts();
        const ids = nextContexts.map((item) => item.customer_id);
        const [vehicleResult, siblResult, externalResult, insurerResult] = await Promise.all([
          ids.length ? supabase.from('vehicles').select('*').in('customer_id', ids).order('vehicle_no') : Promise.resolve({ data: [] }),
          ids.length ? supabase.from('policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date').in('customer_id', ids) : Promise.resolve({ data: [] }),
          ids.length ? (supabase as any).from('external_policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date').in('customer_id', ids) : Promise.resolve({ data: [] }),
          supabase.from('insurance_companies').select('*').order('name'),
        ]);
        if (!active) return;
        const nextVehicles = (vehicleResult.data ?? []) as Vehicle[];
        const nextPolicies: PolicyChoice[] = [
          ...((siblResult.data ?? []) as any[]).map((item) => ({ ...item, source: 'sibl' as const })),
          ...((externalResult.data ?? []) as any[]).map((item) => ({ ...item, source: 'external' as const })),
        ].sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
        setContexts(nextContexts);
        setVehicles(nextVehicles);
        setPolicies(nextPolicies);
        setInsurers((insurerResult.data ?? []) as InsuranceCompany[]);
        const firstCustomerId = nextContexts[0]?.customer_id ?? '';
        const firstVehicle = nextVehicles.find((item) => item.customer_id === firstCustomerId) ?? null;
        setSelectedCustomerId(firstCustomerId);
        setSelectedVehicleId(firstVehicle?.id ?? '');
      } catch (error) {
        console.warn('Start claim selector load failed', error);
        if (active) setMessage('We could not load your policy portfolio. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const accountVehicles = useMemo(() => vehicles.filter((item) => item.customer_id === selectedCustomerId), [selectedCustomerId, vehicles]);
  const vehiclePolicies = useMemo(() => policies.filter((item) => item.vehicle_id === selectedVehicleId), [policies, selectedVehicleId]);
  const filteredVehicles = useMemo(() => {
    const query = vehicleQuery.trim().toLowerCase();
    const base = query ? accountVehicles.filter((vehicle) => `${vehicle.vehicle_no} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.toLowerCase().includes(query)) : accountVehicles;
    return base.slice(0, 30);
  }, [accountVehicles, vehicleQuery]);
  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === selectedVehicleId) ?? null, [selectedVehicleId, vehicles]);
  const activePolicy = useMemo(() => {
    const currentDate = formatIsoDate(new Date());
    return vehiclePolicies.find((policy) => policy.start_date <= currentDate && policy.end_date >= currentDate) ?? null;
  }, [vehiclePolicies]);
  const selectedPolicy = activePolicy ?? vehiclePolicies[0] ?? null;
  const selectedInsurer = selectedPolicy ? insurers.find((item) => item.id === selectedPolicy.insurance_company_id) ?? null : null;

  useEffect(() => {
    setVehicleQuery('');
    setVehicleOpen(false);
  }, [selectedVehicleId]);

  function selectAccount(customerId: string) {
    setSelectedCustomerId(customerId);
    const first = vehicles.find((item) => item.customer_id === customerId);
    setSelectedVehicleId(first?.id ?? '');
  }

  function continueClaim() {
    if (!selectedVehicle || !selectedPolicy) return;
    if (selectedPolicy.source === 'external') {
      router.push({ pathname: '/customer/self-managed-claim', params: { externalPolicyId: selectedPolicy.id } } as any);
      return;
    }
    router.push({ pathname: '/customer/report-accident', params: { vehicleId: selectedVehicle.id, policyId: selectedPolicy.id } });
  }

  function addPolicy() {
    router.push({ pathname: '/customer/add-policy', params: { vehicleId: selectedVehicleId } } as any);
  }

  if (loading) return <Screen title="Start Claim"><LoadingState label="Loading your policies" /></Screen>;

  return (
    <Screen title="Start Claim" showTitleHeader={false} showBackNavigation={false} topSpacing="tight">
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>START A CLAIM</Text>
          <Text style={styles.title}>Select the vehicle</Text>
          <Text style={styles.subtitle}>Choose the vehicle involved and we’ll use its active policy.</Text>
        </View>
        <Image accessible={false} source={require('../../assets/brand/start-claim/start-claim-hero.png')} style={styles.heroArtwork} resizeMode="contain" />
      </View>

      {message ? <Message type="error">{message}</Message> : null}

      {contexts.length > 1 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.chips}>{contexts.map((context) => <ChoiceChip key={context.customer_id} label={customerAccountTitle(context)} active={selectedCustomerId === context.customer_id} onPress={() => selectAccount(context.customer_id)} />)}</View>
        </View>
      ) : null}

      <View style={[styles.section, styles.vehicleSection]}>
        <Text style={styles.sectionLabel}>Vehicle number *</Text>
        {accountVehicles.length ? <VehicleDropdown vehicles={filteredVehicles} query={vehicleQuery} selectedVehicle={selectedVehicle} open={vehicleOpen} onToggle={() => setVehicleOpen((value) => !value)} onQueryChange={setVehicleQuery} onSelect={(vehicle) => { setSelectedVehicleId(vehicle.id); setVehicleQuery(''); setVehicleOpen(false); setSelectedCustomerId(vehicle.customer_id); }} /> : <EmptyState title="No vehicle found" body="Add a vehicle before starting a claim." />}
        <Text style={styles.helper}>Start typing to find a vehicle.</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Policy details</Text>
          {selectedVehicle && !activePolicy ? <Pressable accessibilityRole="button" onPress={addPolicy} style={styles.addPolicyButton}><MaterialCommunityIcons name="plus" size={16} color="#0A43A3" /><Text style={styles.addPolicyText}>Add policy</Text></Pressable> : null}
        </View>

        {selectedPolicy ? (
          <View style={styles.policyCard}>
            <View style={styles.policyArcOne} />
            <View style={styles.policyArcTwo} />
            <View style={styles.policyIcon}><MaterialCommunityIcons name={selectedPolicy.source === 'external' ? 'account-edit-outline' : 'shield-check-outline'} size={28} color="#0A43A3" /></View>
            <View style={styles.policyCopy}>
              <Text style={styles.policyMode}>{selectedPolicy.source === 'external' ? 'SELF TRACKED CLAIM' : 'SANKALP MANAGED CLAIM'}</Text>
              <Text style={styles.policyNo}>{selectedPolicy.policy_no}</Text>
              <Text style={styles.policyInsurer}>{selectedInsurer?.name ?? 'Insurance company'} · {selectedPolicy.policy_type}</Text>
              <Text style={styles.policyDates}>{formatDate(selectedPolicy.start_date)} – {formatDate(selectedPolicy.end_date)}</Text>
            </View>
            <View style={styles.policyCheck}><MaterialCommunityIcons name="check" size={20} color="#FFFFFF" /></View>
          </View>
        ) : (
          <View style={styles.noPolicy}><MaterialCommunityIcons name="shield-alert-outline" size={26} color="#B7791F" /><View style={styles.noPolicyCopy}><Text style={styles.noPolicyTitle}>No policy recorded for this vehicle</Text><Text style={styles.noPolicyText}>Add the policy details before starting a claim.</Text></View></View>
        )}
      </View>

      <ClaimActionBar
        primaryDisabled={!selectedPolicy}
        primaryLabel={selectedPolicy?.source === 'external' ? 'Start Claim' : 'Continue to Incident Report'}
        primaryIcon="arrow-right"
        onPrimary={continueClaim}
        onAssistance={() => router.push('/customer/support')}
      />

      <Image accessible={false} source={require('../../assets/brand/start-claim/start-claim-footer-scene.png')} style={styles.footerArtwork} resizeMode="contain" />
    </Screen>
  );
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function VehicleDropdown({ vehicles, query, selectedVehicle, open, onToggle, onQueryChange, onSelect }: { vehicles: Vehicle[]; query: string; selectedVehicle: Vehicle | null; open: boolean; onToggle: () => void; onQueryChange: (value: string) => void; onSelect: (vehicle: Vehicle) => void }) {
  return <View style={styles.vehicleField}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={[styles.selectButton, open && styles.selectButtonOpen]}>
      <View style={styles.selectIcon}><MaterialCommunityIcons name="truck-outline" size={20} color="#145ED7" /></View>
      <View style={styles.selectCopy}><Text style={[styles.selectValue, !selectedVehicle && styles.placeholder]} numberOfLines={1}>{selectedVehicle ? selectedVehicle.vehicle_no : 'Select vehicle'}</Text>{selectedVehicle ? <Text style={styles.selectMeta} numberOfLines={1}>{[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' · ') || selectedVehicle.vehicle_type}</Text> : null}</View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={23} color={palette.navy} />
    </Pressable>
    {open ? <View style={styles.makeMenu}>
      <View style={styles.makeSearch}><MaterialCommunityIcons name="magnify" size={19} color="#145ED7" /><TextInput value={query} onChangeText={onQueryChange} autoFocus autoCapitalize="characters" returnKeyType="search" placeholder="Search vehicle number, make or model" placeholderTextColor="#6E7F96" style={styles.makeSearchInput} /></View>
      {vehicles.length ? vehicles.map((vehicle) => <Pressable key={vehicle.id} accessibilityRole="button" onPress={() => onSelect(vehicle)} style={[styles.makeOption, selectedVehicle?.id === vehicle.id && styles.selectOptionActive]}><View style={styles.vehicleOptionCopy}><Text style={[styles.selectOptionText, selectedVehicle?.id === vehicle.id && styles.selectOptionTextActive]} numberOfLines={1}>{vehicle.vehicle_no}</Text><Text style={styles.optionMeta} numberOfLines={1}>{[vehicle.make, vehicle.model].filter(Boolean).join(' · ') || vehicle.vehicle_type}</Text></View>{selectedVehicle?.id === vehicle.id ? <MaterialCommunityIcons name="check-circle" size={17} color="#0A43A3" /> : null}</Pressable>) : <Text style={styles.emptyLookupText}>No matching vehicles found.</Text>}
    </View> : null}
  </View>;
}

function formatDate(value: string) { return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatIsoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

const styles = StyleSheet.create({
  hero: { minHeight: 126, marginHorizontal: 0, marginBottom: 2, flexDirection: 'row', alignItems: 'flex-start' },
  heroCopy: { flex: 1, minWidth: 0, paddingHorizontal: 0, paddingTop: 12, paddingBottom: 4, paddingRight: 4 },
  eyebrow: { color: '#145ED7', fontSize: 10, fontWeight: '900', letterSpacing: 0.55 },
  title: { color: palette.navy, fontSize: 23, lineHeight: 27, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#68778D', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 4, maxWidth: 190 },
  heroArtwork: { width: '46%', height: 122, marginTop: -2, marginRight: -4 },
  section: { marginBottom: 14 },
  vehicleSection: { marginTop: -2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  sectionLabel: { color: palette.navy, fontSize: 12, fontWeight: '900', marginBottom: 7 },
  sectionTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' },
  helper: { color: '#778296', fontSize: 10, fontWeight: '600', marginTop: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, maxWidth: 190, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#D6E2F0', backgroundColor: '#FFFFFF', paddingHorizontal: 13 },
  chipActive: { backgroundColor: '#07327B', borderColor: '#07327B' },
  chipText: { color: '#56657A', fontSize: 10.5, fontWeight: '800' },
  chipTextActive: { color: '#FFFFFF' },
  vehicleField: { gap: 6 },
  selectButton: { minHeight: 64, borderRadius: 16, borderWidth: 1.5, borderColor: '#AFC9EC', backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectButtonOpen: { borderColor: '#3F7FE5', backgroundColor: '#FBFDFF', shadowColor: '#145ED7', shadowOpacity: 0.09, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  selectIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  selectCopy: { flex: 1, minWidth: 0 },
  selectValue: { color: palette.navy, fontSize: 14.5, fontWeight: '900' },
  selectMeta: { color: '#718198', fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  placeholder: { color: '#7A8798', fontWeight: '700' },
  makeMenu: { borderRadius: 15, borderWidth: 1, borderColor: '#C8D9EF', backgroundColor: '#FFFFFF', overflow: 'hidden', marginTop: 4 },
  makeSearch: { minHeight: 50, margin: 7, borderRadius: 12, borderWidth: 2, borderColor: '#6FA1EA', backgroundColor: '#F0F6FF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  makeSearchInput: { flex: 1, minHeight: 46, color: palette.navy, fontSize: 13, fontWeight: '700' },
  makeOption: { minHeight: 54, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  selectOptionActive: { backgroundColor: '#EEF5FF' },
  selectOptionText: { color: '#607089', fontSize: 12, fontWeight: '800' },
  selectOptionTextActive: { color: palette.navy, fontWeight: '900' },
  vehicleOptionCopy: { flex: 1, minWidth: 0 },
  optionMeta: { color: '#8A94A6', fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  emptyLookupText: { color: '#7A8799', fontSize: 11, fontWeight: '700', paddingHorizontal: 11, paddingVertical: 13 },
  addPolicyButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, borderWidth: 1, borderColor: '#C9DAF2', backgroundColor: '#F7FAFF', paddingHorizontal: 9 },
  addPolicyText: { color: '#0A43A3', fontSize: 10, fontWeight: '900' },
  policyCard: { position: 'relative', minHeight: 145, borderRadius: 20, backgroundColor: '#07327B', padding: 15, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#07327B', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  policyArcOne: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1, borderColor: 'rgba(68,137,255,0.20)', right: -100, top: -118 },
  policyArcTwo: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: 'rgba(68,137,255,0.18)', right: -50, top: -88 },
  policyIcon: { width: 60, height: 60, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  policyCopy: { flex: 1, minWidth: 0 },
  policyMode: { color: '#8EB8FF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.55 },
  policyNo: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 4 },
  policyInsurer: { color: '#E0E9F7', fontSize: 10.5, lineHeight: 15, fontWeight: '700', marginTop: 4 },
  policyDates: { color: '#D2DEEF', fontSize: 10.5, fontWeight: '700', marginTop: 5 },
  policyCheck: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#11A35D', alignItems: 'center', justifyContent: 'center' },
  noPolicy: { borderRadius: 15, borderWidth: 1, borderColor: '#F0D9AC', backgroundColor: '#FFFBF3', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noPolicyCopy: { flex: 1 },
  noPolicyTitle: { color: '#77520B', fontSize: 12, fontWeight: '900' },
  noPolicyText: { color: '#8A6A25', fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 2 },
  footerArtwork: { alignSelf: 'stretch', width: '100%', height: 190, marginHorizontal: 0, marginTop: -20, marginBottom: -4, opacity: 0.96 },
});
