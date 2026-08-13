import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { customerAccountTitle, getOperationalCustomerContexts, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Policy, Vehicle } from '@/lib/types';

type ExternalPolicy = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
};

type PolicyChoice = {
  id: string;
  source: 'sankalp' | 'external';
  customerId: string;
  vehicleId: string;
  insuranceCompanyId: string;
  policyNo: string;
  policyType: string;
  startDate: string;
  endDate: string;
};

export default function StartClaimScreen() {
  const router = useRouter();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sankalpPolicies, setSankalpPolicies] = useState<Policy[]>([]);
  const [externalPolicies, setExternalPolicies] = useState<ExternalPolicy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedPolicyKey, setSelectedPolicyKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const nextContexts = await getOperationalCustomerContexts();
        const ids = nextContexts.map((item) => item.customer_id);
        const [vehicleResult, sankalpResult, externalResult, insurerResult] = await Promise.all([
          ids.length ? supabase.from('vehicles').select('*').in('customer_id', ids).order('vehicle_no') : Promise.resolve({ data: [] }),
          ids.length ? supabase.from('policies').select('*').in('customer_id', ids).order('end_date', { ascending: false }) : Promise.resolve({ data: [] }),
          ids.length ? (supabase as any).from('external_policies').select('*').in('customer_id', ids).order('end_date', { ascending: false }) : Promise.resolve({ data: [] }),
          supabase.from('insurance_companies').select('*').order('name'),
        ]);
        if (!active) return;
        setContexts(nextContexts);
        setVehicles((vehicleResult.data ?? []) as Vehicle[]);
        setSankalpPolicies((sankalpResult.data ?? []) as Policy[]);
        setExternalPolicies((externalResult.data ?? []) as ExternalPolicy[]);
        setInsurers((insurerResult.data ?? []) as InsuranceCompany[]);
        const firstCustomerId = nextContexts[0]?.customer_id ?? '';
        const firstVehicle = ((vehicleResult.data ?? []) as Vehicle[]).find((item) => item.customer_id === firstCustomerId) ?? (vehicleResult.data ?? [])[0];
        setSelectedCustomerId(firstCustomerId);
        setSelectedVehicleId(firstVehicle?.id ?? '');
      } catch (error) {
        console.warn('Start claim policy selector load failed', error);
        if (active) setMessage('We could not load your policy portfolio. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const accountVehicles = useMemo(() => vehicles.filter((item) => item.customer_id === selectedCustomerId), [selectedCustomerId, vehicles]);
  const choices = useMemo<PolicyChoice[]>(() => {
    const managed = sankalpPolicies.filter((item) => item.vehicle_id === selectedVehicleId).map((item) => ({
      id: item.id, source: 'sankalp' as const, customerId: item.customer_id, vehicleId: item.vehicle_id,
      insuranceCompanyId: item.insurance_company_id, policyNo: item.policy_no, policyType: item.policy_type,
      startDate: item.start_date, endDate: item.end_date,
    }));
    const external = externalPolicies.filter((item) => item.vehicle_id === selectedVehicleId).map((item) => ({
      id: item.id, source: 'external' as const, customerId: item.customer_id, vehicleId: item.vehicle_id,
      insuranceCompanyId: item.insurance_company_id, policyNo: item.policy_no, policyType: item.policy_type,
      startDate: item.start_date, endDate: item.end_date,
    }));
    return [...managed, ...external].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  }, [externalPolicies, sankalpPolicies, selectedVehicleId]);
  const selectedPolicy = choices.find((item) => `${item.source}:${item.id}` === selectedPolicyKey) ?? choices[0] ?? null;
  const selectedVehicle = vehicles.find((item) => item.id === selectedVehicleId) ?? null;

  useEffect(() => {
    if (choices.length && !choices.some((item) => `${item.source}:${item.id}` === selectedPolicyKey)) {
      setSelectedPolicyKey(`${choices[0].source}:${choices[0].id}`);
    }
    if (!choices.length) setSelectedPolicyKey('');
  }, [choices, selectedPolicyKey]);

  function selectAccount(customerId: string) {
    setSelectedCustomerId(customerId);
    const first = vehicles.find((item) => item.customer_id === customerId);
    setSelectedVehicleId(first?.id ?? '');
    setSelectedPolicyKey('');
  }

  function selectVehicle(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    setSelectedPolicyKey('');
  }

  function continueClaim() {
    if (!selectedPolicy || !selectedVehicle) return;
    if (selectedPolicy.source === 'sankalp') {
      router.push({ pathname: '/customer/report-accident', params: { vehicleId: selectedVehicle.id } });
      return;
    }
    router.push({ pathname: '/customer/self-managed-claim', params: { externalPolicyId: selectedPolicy.id } });
  }

  if (loading) return <Screen title="Start Claim"><LoadingState label="Loading policy portfolio" /></Screen>;

  return (
    <Screen title="Start Claim" showTitleHeader={false}>
      <View style={styles.headerBlock}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} /></Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>START A CLAIM</Text>
          <Text style={styles.title}>Choose the vehicle and policy</Text>
          <Text style={styles.subtitle}>InsureIt automatically identifies whether Sankalp manages the claim from the policy record you select.</Text>
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
        <View style={styles.policyHeading}><View><Text style={styles.sectionLabel}>Insurance policy</Text><Text style={styles.sectionHint}>Both Sankalp-serviced and customer-added external policies appear here.</Text></View><Pressable onPress={() => router.push({ pathname: '/customer/add-policy', params: { vehicleId: selectedVehicleId } })} style={styles.addPolicyButton}><MaterialCommunityIcons name="plus" size={16} color="#0A43A3" /><Text style={styles.addPolicyText}>Add external</Text></Pressable></View>
        {choices.length ? <View style={styles.policyStack}>{choices.map((policy) => {
          const active = selectedPolicy?.id === policy.id && selectedPolicy.source === policy.source;
          const insurer = insurers.find((item) => item.id === policy.insuranceCompanyId);
          const managed = policy.source === 'sankalp';
          return <Pressable key={`${policy.source}:${policy.id}`} onPress={() => setSelectedPolicyKey(`${policy.source}:${policy.id}`)} style={[styles.policyCard, active && styles.policyCardActive]}>
            <View style={[styles.policyIcon, managed ? styles.managedIcon : styles.externalIcon]}><MaterialCommunityIcons name={managed ? 'shield-check' : 'shield-outline'} size={23} color={managed ? '#087443' : '#0A43A3'} /></View>
            <View style={styles.policyCopy}><View style={styles.badgeRow}><Text style={[styles.sourceBadge, managed ? styles.managedBadge : styles.externalBadge]}>{managed ? 'SANKALP SERVICED' : 'EXTERNAL POLICY'}</Text></View><Text style={styles.policyNo}>{policy.policyNo}</Text><Text style={styles.policyMeta}>{insurer?.name ?? 'Insurance company'} • {policy.policyType}</Text><Text style={styles.policyDates}>{formatDate(policy.startDate)} – {formatDate(policy.endDate)}</Text></View>
            <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={active ? '#0A43A3' : '#98A2B3'} />
          </Pressable>;
        })}</View> : <View style={styles.noPolicy}><MaterialCommunityIcons name="shield-alert-outline" size={28} color="#B7791F" /><Text style={styles.noPolicyTitle}>No policy recorded for this vehicle</Text><Text style={styles.noPolicyText}>If this policy was purchased outside Sankalp, add it as an external policy. It will stay separate from Sankalp business reporting.</Text></View>}
      </View>

      {selectedPolicy ? <View style={[styles.routePreview, selectedPolicy.source === 'sankalp' ? styles.managedPreview : styles.externalPreview]}>
        <View style={styles.routeTitleRow}><MaterialCommunityIcons name={selectedPolicy.source === 'sankalp' ? 'account-tie' : 'account-edit-outline'} size={22} color={selectedPolicy.source === 'sankalp' ? '#087443' : '#0A43A3'} /><Text style={styles.routeTitle}>{selectedPolicy.source === 'sankalp' ? 'Sankalp Managed Claim' : 'Self-Tracked Claim'}</Text></View>
        <Text style={styles.routeText}>{selectedPolicy.source === 'sankalp' ? 'This policy is part of Sankalp business. Our claim team will manage the operational claim journey after your incident report.' : 'This policy is stored separately from Sankalp business. You will track insurer, survey, repair, billing, delivery order and payment milestones in InsureIt.'}</Text>
      </View> : null}

      <Pressable accessibilityRole="button" disabled={!selectedPolicy} onPress={continueClaim} style={[styles.continueButton, !selectedPolicy && styles.continueDisabled]}><Text style={styles.continueText}>{selectedPolicy?.source === 'external' ? 'Start Self-Tracked Claim' : 'Continue to Incident Report'}</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></Pressable>
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
  section: { marginBottom: 16 }, sectionLabel: { color: palette.navy, fontSize: 13, fontWeight: '900', marginBottom: 8 }, sectionHint: { color: '#7A8799', fontSize: 10.5, lineHeight: 14, fontWeight: '600', maxWidth: 280 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 36, maxWidth: 180, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#D6E2F0', backgroundColor: '#FFFFFF', paddingHorizontal: 13 }, chipActive: { backgroundColor: palette.navy, borderColor: palette.navy }, chipText: { color: '#56657A', fontSize: 11, fontWeight: '800' }, chipTextActive: { color: '#FFFFFF' },
  vehicleSummary: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', padding: 12, marginBottom: 17 }, vehicleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' }, vehicleCopy: { flex: 1 }, vehicleNo: { color: palette.navy, fontSize: 16, fontWeight: '900' }, vehicleMeta: { color: '#667085', fontSize: 10.5, marginTop: 2, fontWeight: '600' },
  policyHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 9 }, addPolicyButton: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EEF5FF', borderRadius: 999, paddingHorizontal: 10, height: 32 }, addPolicyText: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900' },
  policyStack: { gap: 9 }, policyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 17, padding: 12, borderWidth: 1, borderColor: '#DDE6F0', backgroundColor: '#FFFFFF' }, policyCardActive: { borderColor: '#7AAAF0', backgroundColor: '#F7FAFF' }, policyIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, managedIcon: { backgroundColor: '#E8F8F0' }, externalIcon: { backgroundColor: '#EAF2FF' }, policyCopy: { flex: 1, minWidth: 0 }, badgeRow: { flexDirection: 'row', marginBottom: 3 }, sourceBadge: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.55, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' }, managedBadge: { color: '#087443', backgroundColor: '#E8F8F0' }, externalBadge: { color: '#0A43A3', backgroundColor: '#EAF2FF' }, policyNo: { color: palette.navy, fontSize: 13.5, fontWeight: '900' }, policyMeta: { color: '#53647B', fontSize: 10.5, fontWeight: '700', marginTop: 2 }, policyDates: { color: '#7A8799', fontSize: 9.8, fontWeight: '600', marginTop: 2 },
  noPolicy: { alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#F0D5A3', backgroundColor: '#FFF9EF', padding: 17 }, noPolicyTitle: { color: '#7A5409', fontSize: 13, fontWeight: '900', marginTop: 6 }, noPolicyText: { color: '#8A6A2B', textAlign: 'center', fontSize: 10.5, lineHeight: 15, marginTop: 4, fontWeight: '600' },
  routePreview: { borderRadius: 17, padding: 13, borderWidth: 1, marginBottom: 14 }, managedPreview: { backgroundColor: '#F3FBF7', borderColor: '#BDE7CE' }, externalPreview: { backgroundColor: '#F3F8FF', borderColor: '#C8DBF7' }, routeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, routeTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' }, routeText: { color: '#53647B', fontSize: 10.8, lineHeight: 16, fontWeight: '600', marginTop: 6 },
  continueButton: { height: 52, borderRadius: 16, backgroundColor: palette.navy, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, continueDisabled: { opacity: 0.4 }, continueText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
