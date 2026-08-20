import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ClaimInlineNote, ClaimPrimaryAction } from '@/components/external-claim-ui';
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
    <Screen title="Start Claim" showTitleHeader={false}>
      <View style={styles.header}>
        <View style={styles.headerOrbLarge} />
        <View style={styles.headerOrbSmall} />
        <View style={styles.headerAccent} />
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} />
        </Pressable>
        <View style={styles.headerIcon}><MaterialCommunityIcons name="shield-check-outline" size={24} color="#FFFFFF" /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>START A CLAIM</Text>
          <Text style={styles.title}>Choose the vehicle involved</Text>
          <Text style={styles.subtitle}>We’ll use the vehicle’s active policy to start the correct claim journey.</Text>
        </View>
      </View>

      {message ? <Message type="error">{message}</Message> : null}

      {contexts.length > 1 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.chips}>{contexts.map((context) => <ChoiceChip key={context.customer_id} label={customerAccountTitle(context)} active={selectedCustomerId === context.customer_id} onPress={() => selectAccount(context.customer_id)} />)}</View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Vehicle</Text>
        {accountVehicles.length ? <VehicleDropdown vehicles={filteredVehicles} query={vehicleQuery} selectedVehicle={selectedVehicle} open={vehicleOpen} onToggle={() => setVehicleOpen((value) => !value)} onQueryChange={setVehicleQuery} onSelect={(vehicle) => { setSelectedVehicleId(vehicle.id); setVehicleQuery(''); setVehicleOpen(false); setSelectedCustomerId(vehicle.customer_id); }} /> : <EmptyState title="No vehicle found" body="Add a vehicle before starting a claim." />}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionLabel}>Active policy</Text>
          {selectedVehicle && !activePolicy ? <Pressable accessibilityRole="button" onPress={addPolicy} style={styles.addPolicyButton}><MaterialCommunityIcons name="plus" size={16} color="#0A43A3" /><Text style={styles.addPolicyText}>Add policy</Text></Pressable> : null}
        </View>

        {selectedPolicy ? (
          <View style={styles.policyCard}>
            <View style={styles.policyTopAccent} />
            <View style={styles.policyOrb} />
            <View style={styles.policyTop}>
              <View style={[styles.policyIcon, selectedPolicy.source === 'external' ? styles.policyIconExternal : styles.policyIconManaged]}><MaterialCommunityIcons name={selectedPolicy.source === 'external' ? 'file-document-edit-outline' : 'shield-check-outline'} size={22} color={selectedPolicy.source === 'external' ? '#0A43A3' : '#087443'} /></View>
              <View style={styles.policyCopy}>
                <Text style={styles.insurerName}>{selectedInsurer?.name ?? 'Insurance company'}</Text>
                <Text style={styles.policyNo}>{selectedPolicy.policy_no}</Text>
                <Text style={styles.policyMeta}>{selectedPolicy.policy_type} · Valid until {formatDate(selectedPolicy.end_date)}</Text>
              </View>
              <View style={styles.activePolicyBadge}><MaterialCommunityIcons name="check" size={13} color="#FFFFFF" /><Text style={styles.activePolicyText}>ACTIVE</Text></View>
            </View>
            <View style={styles.modeRow}>
              <View style={[styles.modeIcon, selectedPolicy.source === 'external' ? styles.modeIconExternal : styles.modeIconManaged]}><MaterialCommunityIcons name={selectedPolicy.source === 'external' ? 'account-edit-outline' : 'account-tie-outline'} size={18} color={selectedPolicy.source === 'external' ? '#0A43A3' : '#087443'} /></View>
              <View style={styles.modeCopy}>
                <Text style={styles.modeTitle}>{selectedPolicy.source === 'external' ? 'You will track this claim' : 'Sankalp will manage this claim'}</Text>
                <Text style={styles.modeText}>{selectedPolicy.source === 'external' ? 'This customer-added policy uses the self-tracked claim journey. You can request Sankalp assistance later if needed.' : 'Continue into the managed claim process for this Sankalp-serviced policy.'}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noPolicy}><MaterialCommunityIcons name="shield-alert-outline" size={26} color="#B7791F" /><View style={styles.noPolicyCopy}><Text style={styles.noPolicyTitle}>No policy recorded for this vehicle</Text><Text style={styles.noPolicyText}>Add the policy details before starting a claim.</Text></View></View>
        )}
      </View>

      {selectedPolicy?.source === 'external' ? <ClaimInlineNote>External claims stay under your control until you request and Sankalp accepts assistance.</ClaimInlineNote> : null}
      <ClaimPrimaryAction disabled={!selectedPolicy} label={selectedPolicy?.source === 'external' ? 'Continue to Spot Intimation' : 'Continue to Incident Report'} onPress={continueClaim} />
    </Screen>
  );
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function VehicleDropdown({ vehicles, query, selectedVehicle, open, onToggle, onQueryChange, onSelect }: { vehicles: Vehicle[]; query: string; selectedVehicle: Vehicle | null; open: boolean; onToggle: () => void; onQueryChange: (value: string) => void; onSelect: (vehicle: Vehicle) => void }) {
  return <View style={styles.vehicleField}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.selectButton}>
      <View style={styles.selectIcon}><MaterialCommunityIcons name="truck-outline" size={19} color="#0A43A3" /></View>
      <View style={styles.selectCopy}><Text style={[styles.selectValue, !selectedVehicle && styles.placeholder]} numberOfLines={1}>{selectedVehicle ? selectedVehicle.vehicle_no : 'Select vehicle'}</Text>{selectedVehicle ? <Text style={styles.selectMeta} numberOfLines={1}>{[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' · ') || selectedVehicle.vehicle_type}</Text> : null}</View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
    </Pressable>
    {open ? <View style={styles.makeMenu}>
      <View style={styles.makeSearch}><MaterialCommunityIcons name="magnify" size={18} color="#7A8799" /><TextInput value={query} onChangeText={onQueryChange} autoCapitalize="characters" placeholder="Search vehicle number, make or model" placeholderTextColor="#8A94A6" style={styles.makeSearchInput} /></View>
      {vehicles.length ? vehicles.map((vehicle) => <Pressable key={vehicle.id} accessibilityRole="button" onPress={() => onSelect(vehicle)} style={[styles.makeOption, selectedVehicle?.id === vehicle.id && styles.selectOptionActive]}><View style={styles.vehicleOptionCopy}><Text style={[styles.selectOptionText, selectedVehicle?.id === vehicle.id && styles.selectOptionTextActive]} numberOfLines={1}>{vehicle.vehicle_no}</Text><Text style={styles.optionMeta} numberOfLines={1}>{[vehicle.make, vehicle.model].filter(Boolean).join(' · ') || vehicle.vehicle_type}</Text></View>{selectedVehicle?.id === vehicle.id ? <MaterialCommunityIcons name="check-circle" size={17} color="#0A43A3" /> : null}</Pressable>) : <Text style={styles.emptyLookupText}>No matching vehicles found.</Text>}
    </View> : null}
  </View>;
}

function formatDate(value: string) { return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatIsoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

const styles = StyleSheet.create({
  header: { position:'relative', flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:17, borderRadius:21, borderWidth:1, borderColor:'#C9D9EF', backgroundColor:'#F4F8FF', padding:13, overflow:'hidden', shadowColor:'#0F355F', shadowOpacity:.08, shadowRadius:12, shadowOffset:{width:0,height:5}, elevation:2 }, headerOrbLarge:{position:'absolute',width:120,height:120,borderRadius:60,right:-42,top:-62,backgroundColor:'#DDEAFF',opacity:.78},headerOrbSmall:{position:'absolute',width:58,height:58,borderRadius:29,right:34,top:-27,backgroundColor:'#C6DAF5',opacity:.55},headerAccent:{position:'absolute',left:0,top:0,bottom:0,width:5,backgroundColor:'#0A43A3'}, backButton: { width:44,height:44,borderRadius:14,borderWidth:1,borderColor:'#C9D9EF',backgroundColor:'rgba(255,255,255,.9)',alignItems:'center',justifyContent:'center' },headerIcon:{width:46,height:46,borderRadius:15,backgroundColor:'#102F59',alignItems:'center',justifyContent:'center',shadowColor:'#102F59',shadowOpacity:.15,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:2}, headerCopy:{flex:1,minWidth:0}, eyebrow:{color:'#0A43A3',fontSize:9.5,fontWeight:'900',letterSpacing:.9}, title:{color:palette.navy,fontSize:21.5,lineHeight:26,fontWeight:'900',marginTop:2}, subtitle:{color:'#667085',fontSize:11.3,lineHeight:16,fontWeight:'600',marginTop:4},
  section:{marginBottom:16},sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:8},sectionLabel:{color:palette.navy,fontSize:13,fontWeight:'900'},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{minHeight:42,maxWidth:190,justifyContent:'center',borderRadius:999,borderWidth:1,borderColor:'#D6E2F0',backgroundColor:'#FFFFFF',paddingHorizontal:13},chipActive:{backgroundColor:'#102F59',borderColor:'#102F59'},chipText:{color:'#56657A',fontSize:11,fontWeight:'800'},chipTextActive:{color:'#FFFFFF'},
  vehicleField:{gap:6},selectButton:{minHeight:60,borderRadius:16,borderWidth:1,borderColor:'#D2DFEC',backgroundColor:'#FFFFFF',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:10,shadowColor:'#143A64',shadowOpacity:.05,shadowRadius:6,shadowOffset:{width:0,height:2},elevation:1},selectIcon:{width:39,height:39,borderRadius:12,backgroundColor:'#E9F2FF',borderWidth:1,borderColor:'#D3E3F6',alignItems:'center',justifyContent:'center'},selectCopy:{flex:1,minWidth:0},selectValue:{color:palette.navy,fontSize:14,fontWeight:'900'},selectMeta:{color:'#708198',fontSize:10.5,fontWeight:'700',marginTop:2},placeholder:{color:'#7A8798',fontWeight:'700'},makeMenu:{borderRadius:15,borderWidth:1,borderColor:'#D8E4F0',backgroundColor:'#FFFFFF',overflow:'hidden',marginTop:5,shadowColor:'#143A64',shadowOpacity:.08,shadowRadius:9,shadowOffset:{width:0,height:4},elevation:2},makeSearch:{minHeight:46,backgroundColor:'#F7FAFF',borderBottomWidth:1,borderBottomColor:'#E8EFF7',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:7},makeSearchInput:{flex:1,minHeight:44,color:palette.navy,fontSize:12.5,fontWeight:'600'},makeOption:{minHeight:54,paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#EEF2F6'},selectOptionActive:{backgroundColor:'#EEF5FF'},selectOptionText:{color:'#607089',fontSize:12,fontWeight:'800'},selectOptionTextActive:{color:palette.navy,fontWeight:'900'},vehicleOptionCopy:{flex:1,minWidth:0},optionMeta:{color:'#8A94A6',fontSize:10.5,fontWeight:'600',marginTop:2},emptyLookupText:{color:'#7A8799',fontSize:11,fontWeight:'700',paddingHorizontal:11,paddingVertical:13},
  addPolicyButton:{minHeight:38,flexDirection:'row',alignItems:'center',gap:4,borderRadius:11,borderWidth:1,borderColor:'#C9DAF2',backgroundColor:'#F7FAFF',paddingHorizontal:10},addPolicyText:{color:'#0A43A3',fontSize:10.5,fontWeight:'900'},policyCard:{position:'relative',borderRadius:18,borderWidth:1,borderColor:'#D3E0ED',backgroundColor:'#FFFFFF',padding:13,overflow:'hidden',shadowColor:'#12385F',shadowOpacity:.08,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:2},policyTopAccent:{position:'absolute',left:0,top:0,right:0,height:4,backgroundColor:'#0A43A3'},policyOrb:{position:'absolute',width:90,height:90,borderRadius:45,right:-36,top:-47,backgroundColor:'#E6F0FC',opacity:.8},policyTop:{flexDirection:'row',alignItems:'center',gap:10},policyIcon:{width:45,height:45,borderRadius:14,alignItems:'center',justifyContent:'center',borderWidth:1},policyIconExternal:{backgroundColor:'#EEF5FF',borderColor:'#D4E4F6'},policyIconManaged:{backgroundColor:'#EAF8F0',borderColor:'#CCE9DA'},policyCopy:{flex:1,minWidth:0},insurerName:{color:palette.navy,fontSize:13.7,fontWeight:'900'},policyNo:{color:'#344054',fontSize:11,fontWeight:'800',marginTop:2},policyMeta:{color:'#718198',fontSize:10,lineHeight:14,fontWeight:'700',marginTop:2},activePolicyBadge:{height:26,borderRadius:999,backgroundColor:'#168161',paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:3},activePolicyText:{color:'#FFFFFF',fontSize:8,fontWeight:'900',letterSpacing:.5},modeRow:{marginTop:12,paddingTop:11,borderTopWidth:1,borderTopColor:'#E9EEF4',flexDirection:'row',alignItems:'flex-start',gap:9},modeIcon:{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center'},modeIconExternal:{backgroundColor:'#EAF2FF'},modeIconManaged:{backgroundColor:'#EAF8F0'},modeCopy:{flex:1,minWidth:0},modeTitle:{color:palette.navy,fontSize:11.5,fontWeight:'900'},modeText:{color:'#667085',fontSize:10.5,lineHeight:15,fontWeight:'600',marginTop:2},
  noPolicy:{borderRadius:15,borderWidth:1,borderColor:'#F0D9AC',backgroundColor:'#FFFBF3',padding:12,flexDirection:'row',alignItems:'center',gap:10},noPolicyCopy:{flex:1},noPolicyTitle:{color:'#77520B',fontSize:12,fontWeight:'900'},noPolicyText:{color:'#8A6A25',fontSize:10.5,lineHeight:15,fontWeight:'600',marginTop:2},
});