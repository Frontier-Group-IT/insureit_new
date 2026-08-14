import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { customerAccountTitle, getOperationalCustomerContexts, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

type PolicyRow = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  policy_service_source: 'sibl' | 'external' | null;
};

export default function StartClaimScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string; policyId?: string }>();
  const requestedVehicleId = typeof params.vehicleId === 'string' ? params.vehicleId : '';
  const requestedPolicyId = typeof params.policyId === 'string' ? params.policyId : '';
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const nextContexts = await getOperationalCustomerContexts();
        const ids = nextContexts.map((item) => item.customer_id);
        const [vehicleResult, policyResult, insurerResult] = await Promise.all([
          ids.length ? supabase.from('vehicles').select('*').in('customer_id', ids).order('vehicle_no') : Promise.resolve({ data: [] }),
          ids.length ? (supabase as any).from('policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date,policy_service_source').in('customer_id', ids).order('end_date', { ascending: false }) : Promise.resolve({ data: [] }),
          supabase.from('insurance_companies').select('*').order('name'),
        ]);
        if (!active) return;
        const nextVehicles = (vehicleResult.data ?? []) as Vehicle[];
        const nextPolicies = (policyResult.data ?? []) as PolicyRow[];
        setContexts(nextContexts);
        setVehicles(nextVehicles);
        setPolicies(nextPolicies);
        setInsurers((insurerResult.data ?? []) as InsuranceCompany[]);

        const routeVehicle = requestedVehicleId ? nextVehicles.find((item) => item.id === requestedVehicleId) : null;
        const routePolicy = requestedPolicyId ? nextPolicies.find((item) => item.id === requestedPolicyId) : null;
        const firstCustomerId = routeVehicle?.customer_id ?? routePolicy?.customer_id ?? nextContexts[0]?.customer_id ?? '';
        const firstVehicle = routeVehicle ?? (routePolicy ? nextVehicles.find((item) => item.id === routePolicy.vehicle_id) : null) ?? nextVehicles.find((item) => item.customer_id === firstCustomerId) ?? null;
        setSelectedCustomerId(firstCustomerId);
        setSelectedVehicleId(firstVehicle?.id ?? '');
        setSelectedPolicyId(routePolicy?.id ?? '');
      } catch (error) {
        console.warn('Start claim selector load failed', error);
        if (active) setMessage('We could not load your policy portfolio. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [requestedPolicyId, requestedVehicleId]);

  const accountVehicles = useMemo(() => vehicles.filter((item) => item.customer_id === selectedCustomerId), [selectedCustomerId, vehicles]);
  const vehiclePolicies = useMemo(() => policies.filter((item) => item.vehicle_id === selectedVehicleId), [policies, selectedVehicleId]);
  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === selectedVehicleId) ?? null, [selectedVehicleId, vehicles]);
  const selectedPolicy = useMemo(() => vehiclePolicies.find((item) => item.id === selectedPolicyId) ?? vehiclePolicies[0] ?? null, [selectedPolicyId, vehiclePolicies]);

  useEffect(() => {
    if (selectedPolicy && selectedPolicy.id !== selectedPolicyId) setSelectedPolicyId(selectedPolicy.id);
    if (!vehiclePolicies.length && selectedPolicyId) setSelectedPolicyId('');
  }, [selectedPolicy, selectedPolicyId, vehiclePolicies.length]);

  function selectAccount(customerId: string) {
    setSelectedCustomerId(customerId);
    const first = vehicles.find((item) => item.customer_id === customerId);
    setSelectedVehicleId(first?.id ?? '');
    setSelectedPolicyId('');
  }

  function selectVehicle(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (vehicle) setSelectedCustomerId(vehicle.customer_id);
    setSelectedPolicyId('');
  }

  function continueClaim() {
    if (!selectedVehicle || !selectedPolicy) return;
    const selfTracked = selectedPolicy.policy_service_source === 'external';
    if (selfTracked) {
      router.push({ pathname: '/customer/self-managed-claim', params: { policyId: selectedPolicy.id } });
      return;
    }
    router.push({ pathname: '/customer/report-accident', params: { vehicleId: selectedVehicle.id, policyId: selectedPolicy.id } });
  }

  function addPolicy() {
    router.push({ pathname: '/customer/add-policy', params: { vehicleId: selectedVehicleId, returnTo: 'start-claim' } } as any);
  }

  if (loading) return <Screen title="Start Claim"><LoadingState label="Loading your policies" /></Screen>;

  return (
    <Screen title="Start Claim" showTitleHeader={false}>
      <View style={styles.headerBlock}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} /></Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>START A CLAIM</Text>
          <Text style={styles.title}>Choose the vehicle and policy</Text>
          <Text style={styles.subtitle}>We will automatically open the correct claim journey for the selected policy.</Text>
        </View>
      </View>

      {message ? <Message type="error">{message}</Message> : null}

      {contexts.length > 1 ? <View style={styles.section}><Text style={styles.sectionLabel}>Account</Text><View style={styles.chips}>{contexts.map((context) => <ChoiceChip key={context.customer_id} label={customerAccountTitle(context)} active={selectedCustomerId === context.customer_id} onPress={() => selectAccount(context.customer_id)} />)}</View></View> : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Vehicle</Text>
        {accountVehicles.length ? <View style={styles.chips}>{accountVehicles.map((vehicle) => <ChoiceChip key={vehicle.id} label={vehicle.vehicle_no} active={selectedVehicleId === vehicle.id} onPress={() => selectVehicle(vehicle.id)} />)}</View> : <EmptyState title="No vehicle found" body="Add a vehicle before starting a claim." />}
      </View>

      {selectedVehicle ? <View style={styles.vehicleSummary}><View style={styles.vehicleIcon}><MaterialCommunityIcons name="truck-outline" size={24} color="#0A43A3" /></View><View style={styles.vehicleCopy}><Text style={styles.vehicleNo}>{selectedVehicle.vehicle_no}</Text><Text style={styles.vehicleMeta}>{[selectedVehicle.make, selectedVehicle.model, selectedVehicle.vehicle_type].filter(Boolean).join(' • ') || 'Vehicle'}</Text></View></View> : null}

      <View style={styles.section}>
        <View style={styles.policyHeading}>
          <View style={styles.policyHeadingCopy}><Text style={styles.sectionLabel}>Insurance policy</Text><Text style={styles.sectionHint}>Choose the policy covering this vehicle at the time of loss.</Text></View>
          <Pressable onPress={addPolicy} disabled={!selectedVehicleId} style={[styles.addPolicyButton, !selectedVehicleId && styles.disabled]}><MaterialCommunityIcons name="plus" size={16} color="#0A43A3" /><Text style={styles.addPolicyText}>Add Policy</Text></Pressable>
        </View>

        {vehiclePolicies.length ? <View style={styles.policyStack}>{vehiclePolicies.map((policy) => {
          const active = selectedPolicy?.id === policy.id;
          const insurer = insurers.find((item) => item.id === policy.insurance_company_id);
          const selfTracked = policy.policy_service_source === 'external';
          return <Pressable key={policy.id} onPress={() => setSelectedPolicyId(policy.id)} style={[styles.policyCard, active && styles.policyCardActive]}>
            <View style={[styles.policyIcon, selfTracked ? styles.selfIcon : styles.managedIcon]}><MaterialCommunityIcons name={selfTracked ? 'account-edit-outline' : 'shield-check'} size={22} color={selfTracked ? '#0A43A3' : '#087443'} /></View>
            <View style={styles.policyCopy}>
              <Text style={[styles.modeLabel, selfTracked ? styles.selfLabel : styles.managedLabel]}>{selfTracked ? 'SELF TRACKED CLAIM' : 'SANKALP MANAGED CLAIM'}</Text>
              <Text style={styles.policyNo}>{policy.policy_no}</Text>
              <Text style={styles.policyMeta}>{insurer?.name ?? 'Insurance company'} • {policy.policy_type}</Text>
              <Text style={styles.policyDates}>{formatDate(policy.start_date)} – {formatDate(policy.end_date)}</Text>
            </View>
            <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={active ? '#0A43A3' : '#98A2B3'} />
          </Pressable>;
        })}</View> : <View style={styles.noPolicy}><MaterialCommunityIcons name="shield-alert-outline" size={28} color="#B7791F" /><Text style={styles.noPolicyTitle}>No policy recorded for this vehicle</Text><Text style={styles.noPolicyText}>Add the policy details to continue with claim tracking.</Text><Pressable onPress={addPolicy} style={styles.noPolicyButton}><Text style={styles.noPolicyButtonText}>Add Policy</Text></Pressable></View>}
      </View>

      {selectedPolicy ? <View style={[styles.routePreview, selectedPolicy.policy_service_source === 'external' ? styles.selfPreview : styles.managedPreview]}>
        <MaterialCommunityIcons name={selectedPolicy.policy_service_source === 'external' ? 'account-edit-outline' : 'account-tie'} size={21} color={selectedPolicy.policy_service_source === 'external' ? '#0A43A3' : '#087443'} />
        <View style={styles.routeCopy}><Text style={styles.routeTitle}>{selectedPolicy.policy_service_source === 'external' ? 'You will track this claim' : 'Sankalp will manage this claim'}</Text><Text style={styles.routeText}>{selectedPolicy.policy_service_source === 'external' ? 'Record insurer, survey, repair, billing, delivery and payment progress in the app. You can request Sankalp assistance later if required.' : 'Continue with the existing incident report. The current Sankalp claim workflow remains unchanged.'}</Text></View>
      </View> : null}

      <Pressable accessibilityRole="button" disabled={!selectedPolicy} onPress={continueClaim} style={[styles.continueButton, !selectedPolicy && styles.disabled]}><Text style={styles.continueText}>{selectedPolicy?.policy_service_source === 'external' ? 'Start Claim Tracking' : 'Continue to Incident Report'}</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></Pressable>
    </Screen>
  );
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}
function formatDate(value?: string | null) { if (!value) return '-'; return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const styles = StyleSheet.create({
  headerBlock: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: -12, marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 }, eyebrow: { color: '#0A43A3', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: palette.navy, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#667085', fontSize: 12.5, lineHeight: 18, marginTop: 6, fontWeight: '600' },
  section: { marginBottom: 16 }, sectionLabel: { color: palette.navy, fontSize: 13, fontWeight: '900', marginBottom: 8 }, sectionHint: { color: '#7A8799', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 36, maxWidth: 180, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#D6E2F0', backgroundColor: '#FFFFFF', paddingHorizontal: 13 }, chipActive: { backgroundColor: palette.navy, borderColor: palette.navy }, chipText: { color: '#56657A', fontSize: 11, fontWeight: '800' }, chipTextActive: { color: '#FFFFFF' },
  vehicleSummary: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', padding: 12, marginBottom: 17 }, vehicleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' }, vehicleCopy: { flex: 1 }, vehicleNo: { color: palette.navy, fontSize: 16, fontWeight: '900' }, vehicleMeta: { color: '#667085', fontSize: 10.5, marginTop: 2, fontWeight: '600' },
  policyHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 9 }, policyHeadingCopy: { flex: 1 }, addPolicyButton: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EEF5FF', borderRadius: 999, paddingHorizontal: 10, height: 32 }, addPolicyText: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900' },
  policyStack: { gap: 9 }, policyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 17, padding: 12, borderWidth: 1, borderColor: '#DDE6F0', backgroundColor: '#FFFFFF' }, policyCardActive: { borderColor: '#7AAAF0', backgroundColor: '#F7FAFF' }, policyIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, managedIcon: { backgroundColor: '#E8F8F0' }, selfIcon: { backgroundColor: '#EAF2FF' }, policyCopy: { flex: 1, minWidth: 0 }, modeLabel: { alignSelf: 'flex-start', fontSize: 8.3, fontWeight: '900', letterSpacing: 0.4, marginBottom: 3 }, managedLabel: { color: '#087443' }, selfLabel: { color: '#0A43A3' }, policyNo: { color: palette.navy, fontSize: 13.5, fontWeight: '900' }, policyMeta: { color: '#56657A', fontSize: 10.3, fontWeight: '700', marginTop: 2 }, policyDates: { color: '#8A95A5', fontSize: 9.2, fontWeight: '700', marginTop: 3 },
  noPolicy: { alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#F1D8A5', backgroundColor: '#FFFBF3', padding: 18 }, noPolicyTitle: { color: palette.navy, fontSize: 13, fontWeight: '900', marginTop: 7 }, noPolicyText: { color: '#725F40', fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 4, textAlign: 'center' }, noPolicyButton: { marginTop: 10, borderRadius: 11, backgroundColor: palette.navy, paddingHorizontal: 14, paddingVertical: 9 }, noPolicyButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  routePreview: { flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 13 }, managedPreview: { backgroundColor: '#F3FBF7', borderColor: '#BFE6D5' }, selfPreview: { backgroundColor: '#F3F8FF', borderColor: '#CFE0FF' }, routeCopy: { flex: 1 }, routeTitle: { color: palette.navy, fontSize: 11.5, fontWeight: '900' }, routeText: { color: '#667085', fontSize: 9.8, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  continueButton: { minHeight: 52, borderRadius: 16, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }, continueText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' }, disabled: { opacity: 0.45 },
});
