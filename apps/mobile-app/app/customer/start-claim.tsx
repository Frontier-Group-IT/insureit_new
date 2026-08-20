import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { customerAccountTitle, getOperationalCustomerContexts, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

const startClaimHero = require('../../assets/brand/start-claim/start-claim-hero.png');
const startClaimFooterScene = require('../../assets/brand/start-claim/start-claim-footer-scene.png');

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

  useEffect(() => {
    setVehicleQuery('');
    setVehicleOpen(false);
  }, [selectedVehicleId]);

  function selectAccount(customerId: string) {
    setSelectedCustomerId(customerId);
    const first = vehicles.find((item) => item.customer_id === customerId);
    setSelectedVehicleId(first?.id ?? '');
  }

  function selectVehicle(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
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

  return <Screen title="Start Claim" showTitleHeader={false} brandHeaderVariant="navy" bottomTabsVariant="navy">
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>START A CLAIM</Text>
      <Text style={styles.title}>Let&apos;s get you moving again.</Text>
      <Text style={styles.subtitle}>Choose your vehicle to begin a simple, guided claim journey.</Text>
    </View>
    <View style={styles.heroFrame}>
      <Image accessibilityLabel="InsureIT claim protection illustration" source={startClaimHero} resizeMode="contain" style={styles.heroArtwork} />
    </View>
    {message ? <Message type="error">{message}</Message> : null}

    {contexts.length > 1 ? <View style={styles.section}><Text style={styles.sectionLabel}>Account</Text><View style={styles.chips}>{contexts.map((context) => <ChoiceChip key={context.customer_id} label={customerAccountTitle(context)} active={selectedCustomerId === context.customer_id} onPress={() => selectAccount(context.customer_id)} />)}</View></View> : null}

    <View style={styles.section}>{accountVehicles.length ? <VehicleDropdown vehicles={filteredVehicles} query={vehicleQuery} selectedVehicle={selectedVehicle} open={vehicleOpen} onToggle={() => setVehicleOpen((value) => !value)} onQueryChange={setVehicleQuery} onSelect={(vehicle) => { selectVehicle(vehicle.id); setVehicleQuery(''); setVehicleOpen(false); setSelectedCustomerId(vehicle.customer_id); }} /> : <EmptyState title="No vehicle found" body="Add a vehicle before starting a claim." />}</View>

    <View style={styles.section}>
      <View style={styles.policyHeading}><Text style={styles.sectionLabel}>Policy details</Text>{selectedVehicle && !activePolicy ? <Pressable onPress={addPolicy} style={styles.addPolicyButton}><MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={styles.addPolicyText}>Add Policy</Text></Pressable> : null}</View>
      {selectedPolicy ? <View style={styles.policyStack}>{[selectedPolicy].map((policy) => {
        const external = policy.source === 'external';
        const insurer = insurers.find((item) => item.id === policy.insurance_company_id);
        return <View key={`${policy.source}-${policy.id}`} style={styles.policyCard}>
          <View style={[styles.policyIcon, external ? styles.selfIcon : styles.managedIcon]}><MaterialCommunityIcons name={external ? 'account-edit-outline' : 'shield-check'} size={22} color={external ? '#0A43A3' : '#087443'} /></View>
          <View style={styles.policyCopy}><Text style={[styles.modeLabel, { color: external ? '#0A43A3' : '#087443' }]}>{external ? 'SELF TRACKED CLAIM' : 'SANKALP MANAGED CLAIM'}</Text><Text style={styles.policyNo}>{policy.policy_no}</Text><Text style={styles.policyMeta}>{insurer?.name ?? 'Insurance company'} • {policy.policy_type}</Text><Text style={styles.policyDates}>{formatDate(policy.start_date)} – {formatDate(policy.end_date)}</Text></View>
          <MaterialCommunityIcons name="check-circle" size={21} color="#087443" />
        </View>;
      })}</View> : <View style={styles.noPolicy}><MaterialCommunityIcons name="shield-alert-outline" size={28} color="#B7791F" /><Text style={styles.noPolicyTitle}>No policy recorded for this vehicle</Text><Text style={styles.noPolicyText}>Add the policy details to continue.</Text></View>}
    </View>

    <Image accessibilityLabel="InsureIT protected journey illustration" source={startClaimFooterScene} resizeMode="contain" style={styles.footerArtwork} />
    <Pressable disabled={!selectedPolicy} onPress={continueClaim} style={[styles.continueButton, !selectedPolicy && { opacity: 0.45 }]}><Text style={styles.continueText}>{selectedPolicy?.source === 'external' ? 'Start Claim' : 'Continue to Incident Report'}</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></Pressable>
  </Screen>;
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }

function VehicleDropdown({ vehicles, query, selectedVehicle, open, onToggle, onQueryChange, onSelect }: { vehicles: Vehicle[]; query: string; selectedVehicle: Vehicle | null; open: boolean; onToggle: () => void; onQueryChange: (value: string) => void; onSelect: (vehicle: Vehicle) => void }) {
  return <View style={styles.vehicleField}>
    <Text style={styles.fieldLabel}>Vehicle number *</Text>
    <Pressable accessibilityRole="button" onPress={onToggle} style={styles.selectButton}>
      <View style={styles.selectIcon}><MaterialCommunityIcons name="truck-outline" size={18} color="#0A43A3" /></View>
      <View style={styles.selectCopy}>
        <Text style={[styles.selectValue, !selectedVehicle && styles.placeholder]} numberOfLines={1}>{selectedVehicle ? selectedVehicle.vehicle_no : 'Select vehicle'}</Text>
        {selectedVehicle ? <Text style={styles.selectedVehicleMeta} numberOfLines={1}>{[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ') || selectedVehicle.vehicle_type || 'Vehicle'}</Text> : null}
      </View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
    </Pressable>
    <Text style={styles.helperText}>Start typing to find a vehicle.</Text>
    {open ? <View style={styles.makeMenu}>
      <View style={styles.makeSearch}><MaterialCommunityIcons name="magnify" size={18} color="#7A8799" /><TextInput value={query} onChangeText={onQueryChange} autoCapitalize="characters" placeholder="Search vehicle number" placeholderTextColor="#8A94A6" style={styles.makeSearchInput} /></View>
      {vehicles.length ? vehicles.map((vehicle) => <Pressable key={vehicle.id} accessibilityRole="button" onPress={() => onSelect(vehicle)} style={[styles.makeOption, selectedVehicle?.id === vehicle.id && styles.selectOptionActive]}><View style={styles.vehicleOptionCopy}><Text style={[styles.selectOptionText, selectedVehicle?.id === vehicle.id && styles.selectOptionTextActive]} numberOfLines={1}>{vehicle.vehicle_no}</Text><Text style={styles.optionMeta} numberOfLines={1}>{[vehicle.make, vehicle.model].filter(Boolean).join(' - ') || vehicle.vehicle_type}</Text></View>{selectedVehicle?.id === vehicle.id ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>) : <Text style={styles.emptyLookupText}>No matching vehicles found.</Text>}
    </View> : null}
  </View>;
}
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatIsoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

const styles = StyleSheet.create({
  intro:{marginBottom:16},eyebrow:{color:'#1B68E8',fontSize:11,fontWeight:'900',letterSpacing:1.05},title:{color:'#15202B',fontSize:27,lineHeight:33,fontWeight:'900',marginTop:7},subtitle:{color:'#4E596A',fontSize:16,lineHeight:24,fontWeight:'500',marginTop:8},heroFrame:{borderRadius:18,borderWidth:1,borderColor:'#D6E3F2',backgroundColor:'rgba(234,243,255,0.82)',padding:12,marginBottom:20,shadowColor:'#193B74',shadowOpacity:0.08,shadowRadius:12,elevation:2},heroArtwork:{width:'100%',aspectRatio:1.5},footerArtwork:{width:'100%',aspectRatio:1.78,marginTop:2,marginBottom:12},
  section:{marginBottom:16},sectionLabel:{color:palette.navy,fontSize:13,fontWeight:'900',marginBottom:8},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{minHeight:36,maxWidth:180,justifyContent:'center',borderRadius:999,borderWidth:1,borderColor:'#D6E2F0',backgroundColor:'#FFF',paddingHorizontal:13},chipActive:{backgroundColor:palette.navy,borderColor:palette.navy},chipText:{color:'#56657A',fontSize:11,fontWeight:'800'},chipTextActive:{color:'#FFF'},policyHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:9},vehicleField:{gap:5},fieldLabel:{color:'#3F4D63',fontSize:10.5,fontWeight:'700'},selectButton:{minHeight:62,borderRadius:16,borderWidth:2,borderColor:'#1B68E8',backgroundColor:'#FFFFFF',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:9},selectIcon:{width:38,height:38,borderRadius:20,backgroundColor:'#EAF3FF',alignItems:'center',justifyContent:'center'},selectCopy:{flex:1,minWidth:0},selectValue:{color:'#15202B',fontSize:16,fontWeight:'800'},selectedVehicleMeta:{color:'#56657A',fontSize:12,lineHeight:17,fontWeight:'500',marginTop:2},placeholder:{color:'#7A8798'},helperText:{color:'#8A94A6',fontSize:10,lineHeight:13,fontWeight:'500',marginTop:4},makeMenu:{borderRadius:13,borderWidth:1,borderColor:'#DCE8F4',backgroundColor:'#FFFFFF',overflow:'hidden',marginTop:7},makeSearch:{minHeight:42,backgroundColor:'#F8FBFF',borderBottomWidth:1,borderBottomColor:'#E8EFF7',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:7},makeSearchInput:{flex:1,minHeight:40,color:palette.navy,fontSize:12.5,fontWeight:'600'},makeOption:{minHeight:46,paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#EEF2F6'},selectOptionActive:{backgroundColor:'#EEF5FF'},selectOptionText:{flex:1,color:'#607089',fontSize:11.5,fontWeight:'700'},selectOptionTextActive:{color:palette.navy,fontWeight:'800'},vehicleOptionCopy:{flex:1,minWidth:0},optionMeta:{color:'#8A94A6',fontSize:10,fontWeight:'600'},emptyLookupText:{color:'#7A8799',fontSize:11,fontWeight:'700',paddingHorizontal:11,paddingVertical:12},addPolicyButton:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'#0A43A3',borderRadius:12,paddingHorizontal:12,height:36,shadowColor:'#0A43A3',shadowOpacity:0.28,shadowRadius:7,elevation:4},addPolicyText:{color:'#FFFFFF',fontSize:9.5,fontWeight:'900'},policyStack:{gap:9},policyCard:{flexDirection:'row',alignItems:'center',gap:10,borderRadius:17,padding:12,borderWidth:1,borderColor:'#DDE6F0',backgroundColor:'#FFF'},policyIcon:{width:45,height:45,borderRadius:14,alignItems:'center',justifyContent:'center'},managedIcon:{backgroundColor:'#E8F8F0'},selfIcon:{backgroundColor:'#EAF2FF'},policyCopy:{flex:1,minWidth:0},modeLabel:{fontSize:8.3,fontWeight:'900',letterSpacing:.4,marginBottom:3},policyNo:{color:palette.navy,fontSize:13.5,fontWeight:'900'},policyMeta:{color:'#56657A',fontSize:10.3,fontWeight:'700',marginTop:2},policyDates:{color:'#7A8799',fontSize:9.5,fontWeight:'600',marginTop:3},
  noPolicy:{borderWidth:1,borderColor:'#F0D9AC',backgroundColor:'#FFF9EE',borderRadius:16,padding:15,alignItems:'center'},noPolicyTitle:{color:palette.navy,fontSize:12,fontWeight:'900',marginTop:6},noPolicyText:{color:'#7A8799',fontSize:10.5,fontWeight:'600',marginTop:3},continueButton:{minHeight:54,borderRadius:16,backgroundColor:'#1B68E8',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:14,shadowColor:'#1B68E8',shadowOpacity:0.2,shadowRadius:10,elevation:3},continueText:{color:'#FFF',fontSize:14,fontWeight:'900'}
});
