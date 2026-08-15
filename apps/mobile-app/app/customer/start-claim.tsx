import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
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
  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === selectedVehicleId) ?? null, [selectedVehicleId, vehicles]);
  const selectedPolicy = useMemo(() => vehiclePolicies.find((item) => item.id === selectedPolicyId) ?? vehiclePolicies[0] ?? null, [selectedPolicyId, vehiclePolicies]);

  useEffect(() => {
    if (selectedPolicy && selectedPolicy.id !== selectedPolicyId) setSelectedPolicyId(selectedPolicy.id);
    if (!vehiclePolicies.length) setSelectedPolicyId('');
  }, [selectedPolicy, selectedPolicyId, vehiclePolicies.length]);

  function selectAccount(customerId: string) {
    setSelectedCustomerId(customerId);
    const first = vehicles.find((item) => item.customer_id === customerId);
    setSelectedVehicleId(first?.id ?? '');
    setSelectedPolicyId('');
  }

  function selectVehicle(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    setSelectedPolicyId('');
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

  return <Screen title="Start Claim" showTitleHeader={false}>
    <View style={styles.headerBlock}>
      <Pressable onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} /></Pressable>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>START A CLAIM</Text><Text style={styles.title}>Choose the vehicle and policy</Text><Text style={styles.subtitle}>The policy source decides who manages the claim. The claim screen stays consistent.</Text></View>
    </View>
    {message ? <Message type="error">{message}</Message> : null}

    {contexts.length > 1 ? <View style={styles.section}><Text style={styles.sectionLabel}>Account</Text><View style={styles.chips}>{contexts.map((context) => <ChoiceChip key={context.customer_id} label={customerAccountTitle(context)} active={selectedCustomerId === context.customer_id} onPress={() => selectAccount(context.customer_id)} />)}</View></View> : null}

    <View style={styles.section}><Text style={styles.sectionLabel}>Vehicle</Text>{accountVehicles.length ? <View style={styles.chips}>{accountVehicles.map((vehicle) => <ChoiceChip key={vehicle.id} label={vehicle.vehicle_no} active={selectedVehicleId === vehicle.id} onPress={() => selectVehicle(vehicle.id)} />)}</View> : <EmptyState title="No vehicle found" body="Add a vehicle before starting a claim." />}</View>

    {selectedVehicle ? <View style={styles.vehicleSummary}><View style={styles.vehicleIcon}><MaterialCommunityIcons name="truck-outline" size={24} color="#0A43A3" /></View><View><Text style={styles.vehicleNo}>{selectedVehicle.vehicle_no}</Text><Text style={styles.vehicleMeta}>{[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' • ') || selectedVehicle.vehicle_type}</Text></View></View> : null}

    <View style={styles.section}>
      <View style={styles.policyHeading}><View style={{ flex: 1 }}><Text style={styles.sectionLabel}>Insurance policy</Text><Text style={styles.sectionHint}>Sankalp policies and customer-added policies are kept in separate data stores.</Text></View><Pressable onPress={addPolicy} disabled={!selectedVehicleId} style={styles.addPolicyButton}><MaterialCommunityIcons name="plus" size={16} color="#0A43A3" /><Text style={styles.addPolicyText}>Add Policy</Text></Pressable></View>
      {vehiclePolicies.length ? <View style={styles.policyStack}>{vehiclePolicies.map((policy) => {
        const active = selectedPolicy?.id === policy.id;
        const external = policy.source === 'external';
        const insurer = insurers.find((item) => item.id === policy.insurance_company_id);
        return <Pressable key={`${policy.source}-${policy.id}`} onPress={() => setSelectedPolicyId(policy.id)} style={[styles.policyCard, active && styles.policyCardActive]}>
          <View style={[styles.policyIcon, external ? styles.selfIcon : styles.managedIcon]}><MaterialCommunityIcons name={external ? 'account-edit-outline' : 'shield-check'} size={22} color={external ? '#0A43A3' : '#087443'} /></View>
          <View style={styles.policyCopy}><Text style={[styles.modeLabel, { color: external ? '#0A43A3' : '#087443' }]}>{external ? 'SELF TRACKED CLAIM' : 'SANKALP MANAGED CLAIM'}</Text><Text style={styles.policyNo}>{policy.policy_no}</Text><Text style={styles.policyMeta}>{insurer?.name ?? 'Insurance company'} • {policy.policy_type}</Text><Text style={styles.policyDates}>{formatDate(policy.start_date)} – {formatDate(policy.end_date)}</Text></View>
          <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={active ? '#0A43A3' : '#98A2B3'} />
        </Pressable>;
      })}</View> : <View style={styles.noPolicy}><MaterialCommunityIcons name="shield-alert-outline" size={28} color="#B7791F" /><Text style={styles.noPolicyTitle}>No policy recorded for this vehicle</Text><Text style={styles.noPolicyText}>Add the policy details to continue.</Text></View>}
    </View>

    <Pressable disabled={!selectedPolicy} onPress={continueClaim} style={[styles.continueButton, !selectedPolicy && { opacity: 0.45 }]}><Text style={styles.continueText}>{selectedPolicy?.source === 'external' ? 'Start Claim' : 'Continue to Incident Report'}</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></Pressable>
  </Screen>;
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const styles = StyleSheet.create({
  headerBlock:{flexDirection:'row',gap:12,alignItems:'flex-start',marginTop:0,marginBottom:18},backButton:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:'#DCE8F4',backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},headerCopy:{flex:1},eyebrow:{color:'#0A43A3',fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:palette.navy,fontSize:23,lineHeight:28,fontWeight:'900',marginTop:3},subtitle:{color:'#667085',fontSize:12.5,lineHeight:18,marginTop:6,fontWeight:'600'},
  section:{marginBottom:16},sectionLabel:{color:palette.navy,fontSize:13,fontWeight:'900',marginBottom:8},sectionHint:{color:'#7A8799',fontSize:10.5,lineHeight:14,fontWeight:'600'},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{minHeight:36,maxWidth:180,justifyContent:'center',borderRadius:999,borderWidth:1,borderColor:'#D6E2F0',backgroundColor:'#FFF',paddingHorizontal:13},chipActive:{backgroundColor:palette.navy,borderColor:palette.navy},chipText:{color:'#56657A',fontSize:11,fontWeight:'800'},chipTextActive:{color:'#FFF'},
  vehicleSummary:{flexDirection:'row',alignItems:'center',gap:11,borderRadius:16,borderWidth:1,borderColor:'#DCE8F4',backgroundColor:'#F8FBFF',padding:12,marginBottom:17},vehicleIcon:{width:44,height:44,borderRadius:14,backgroundColor:'#EAF2FF',alignItems:'center',justifyContent:'center'},vehicleNo:{color:palette.navy,fontSize:16,fontWeight:'900'},vehicleMeta:{color:'#667085',fontSize:10.5,marginTop:2,fontWeight:'600'},
  policyHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:9},addPolicyButton:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'#EEF5FF',borderRadius:999,paddingHorizontal:10,height:32},addPolicyText:{color:'#0A43A3',fontSize:9.5,fontWeight:'900'},policyStack:{gap:9},policyCard:{flexDirection:'row',alignItems:'center',gap:10,borderRadius:17,padding:12,borderWidth:1,borderColor:'#DDE6F0',backgroundColor:'#FFF'},policyCardActive:{borderColor:'#7AAAF0',backgroundColor:'#F7FAFF'},policyIcon:{width:45,height:45,borderRadius:14,alignItems:'center',justifyContent:'center'},managedIcon:{backgroundColor:'#E8F8F0'},selfIcon:{backgroundColor:'#EAF2FF'},policyCopy:{flex:1,minWidth:0},modeLabel:{fontSize:8.3,fontWeight:'900',letterSpacing:.4,marginBottom:3},policyNo:{color:palette.navy,fontSize:13.5,fontWeight:'900'},policyMeta:{color:'#56657A',fontSize:10.3,fontWeight:'700',marginTop:2},policyDates:{color:'#7A8799',fontSize:9.5,fontWeight:'600',marginTop:3},
  noPolicy:{borderWidth:1,borderColor:'#F0D9AC',backgroundColor:'#FFF9EE',borderRadius:16,padding:15,alignItems:'center'},noPolicyTitle:{color:palette.navy,fontSize:12,fontWeight:'900',marginTop:6},noPolicyText:{color:'#7A8799',fontSize:10.5,fontWeight:'600',marginTop:3},continueButton:{minHeight:52,borderRadius:16,backgroundColor:palette.navy,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:14},continueText:{color:'#FFF',fontSize:13,fontWeight:'900'}
});
