import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { SELF_MANAGED_CLAIM_NOTICE } from '@/lib/claim-service-mode';
import { customerAccountTitle, getOperationalCustomerContexts, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Policy, Vehicle } from '@/lib/types';

export default function SelfManagedClaimScreen() {
  const router = useRouter();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [selectedInsurerId, setSelectedInsurerId] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextContexts = await getOperationalCustomerContexts();
      const customerIds = nextContexts.map((item) => item.customer_id);
      if (!active) return;
      setContexts(nextContexts);
      const firstCustomerId = nextContexts[0]?.customer_id ?? '';
      setSelectedCustomerId(firstCustomerId);

      if (customerIds.length) {
        const [vehicleResult, policyResult, insurerResult] = await Promise.all([
          supabase.from('vehicles').select('*').in('customer_id', customerIds).order('vehicle_no'),
          supabase.from('policies').select('*').in('customer_id', customerIds).order('end_date', { ascending: false }),
          supabase.from('insurance_companies').select('*').order('name'),
        ]);
        if (!active) return;
        if (vehicleResult.error || policyResult.error || insurerResult.error) {
          console.warn('Self-managed claim setup load failed', vehicleResult.error ?? policyResult.error ?? insurerResult.error);
          setMessage('We could not load your vehicle and policy details. Please try again.');
        }
        const nextVehicles = vehicleResult.data ?? [];
        const nextPolicies = policyResult.data ?? [];
        setVehicles(nextVehicles);
        setPolicies(nextPolicies);
        setInsurers(insurerResult.data ?? []);
        const firstVehicle = nextVehicles.find((item) => item.customer_id === firstCustomerId) ?? nextVehicles[0];
        if (firstVehicle) {
          setSelectedVehicleId(firstVehicle.id);
          const firstPolicy = nextPolicies.find((item) => item.vehicle_id === firstVehicle.id);
          if (firstPolicy) {
            setSelectedPolicyId(firstPolicy.id);
            setSelectedInsurerId(firstPolicy.insurance_company_id ?? '');
          }
        }
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const accountVehicles = useMemo(
    () => vehicles.filter((item) => item.customer_id === selectedCustomerId),
    [selectedCustomerId, vehicles],
  );
  const selectedVehicle = useMemo(
    () => accountVehicles.find((item) => item.id === selectedVehicleId) ?? null,
    [accountVehicles, selectedVehicleId],
  );
  const vehiclePolicies = useMemo(
    () => policies.filter((item) => item.vehicle_id === selectedVehicleId),
    [policies, selectedVehicleId],
  );
  const selectedPolicy = useMemo(
    () => vehiclePolicies.find((item) => item.id === selectedPolicyId) ?? null,
    [selectedPolicyId, vehiclePolicies],
  );

  function selectAccount(customerId: string) {
    setSelectedCustomerId(customerId);
    const firstVehicle = vehicles.find((item) => item.customer_id === customerId);
    setSelectedVehicleId(firstVehicle?.id ?? '');
    const firstPolicy = firstVehicle ? policies.find((item) => item.vehicle_id === firstVehicle.id) : null;
    setSelectedPolicyId(firstPolicy?.id ?? '');
    setSelectedInsurerId(firstPolicy?.insurance_company_id ?? '');
  }

  function selectVehicle(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (vehicle) setSelectedCustomerId(vehicle.customer_id);
    const firstPolicy = policies.find((item) => item.vehicle_id === vehicleId);
    setSelectedPolicyId(firstPolicy?.id ?? '');
    setSelectedInsurerId(firstPolicy?.insurance_company_id ?? '');
  }

  function selectPolicy(policy: Policy) {
    setSelectedPolicyId(policy.id);
    setSelectedInsurerId(policy.insurance_company_id ?? '');
  }

  async function submit() {
    setMessage('');
    if (!selectedCustomerId || !selectedVehicle || !selectedPolicy) {
      setMessage('Select a vehicle and its external insurance policy.');
      return;
    }
    if (!selectedInsurerId) {
      setMessage('Select the insurance company for this external policy.');
      return;
    }
    const incidentAt = buildIncidentDateTime(incidentDate, incidentTime);
    if (!incidentAt) {
      setMessage('Enter the accident date and time. Use time in HH:MM format.');
      return;
    }
    if (incidentAt.getTime() > Date.now()) {
      setMessage('Accident date and time cannot be in the future.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const { data, error } = await supabase.rpc('create_self_managed_claim', {
        p_customer_id: selectedCustomerId,
        p_vehicle_id: selectedVehicle.id,
        p_policy_id: selectedPolicy.id,
        p_insurance_company_id: selectedInsurerId,
        p_accident_at: incidentAt.toISOString(),
        p_driver_name: driverName.trim() || null,
        p_driver_phone: driverPhone.trim() || null,
        p_location: location.trim() || null,
      });
      if (error) {
        console.warn('Self-managed claim creation failed', error);
        setMessage(mapSubmitError(error.message));
        return;
      }
      const created = Array.isArray(data) ? data[0] : data;
      const claimId = created?.claim_id;
      if (!claimId) {
        setMessage('The claim was not created. Please try again.');
        return;
      }
      router.replace({ pathname: '/customer/self-managed-claim-detail', params: { id: claimId } });
    } catch (error) {
      console.error('Self-managed claim submit failed', error);
      setMessage('We could not start self-managed claim tracking right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Self-Managed Claim" showTitleHeader={false}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.eyebrow}>SELF-MANAGED • STEP 1 OF 9</Text>
          <Text style={styles.title}>Spot Intimation</Text>
          <Text style={styles.subtitle}>Record the first details of the accident. Only accident date, time and insurer are mandatory.</Text>
        </View>
      </View>

      <View style={styles.noticeBox}>
        <MaterialCommunityIcons name="account-edit-outline" size={22} color="#8A5B00" />
        <Text style={styles.noticeText}>{SELF_MANAGED_CLAIM_NOTICE}</Text>
      </View>

      {message ? <Message type="error">{message}</Message> : null}
      {loading ? <Text style={styles.loadingText}>Loading vehicles and policies...</Text> : null}

      {!loading && contexts.length > 1 ? (
        <SectionCard title="Account" icon="account-switch-outline">
          <View style={styles.chips}>
            {contexts.map((context) => {
              const active = context.customer_id === selectedCustomerId;
              return <ChoiceChip key={context.customer_id} label={customerAccountTitle(context)} active={active} onPress={() => selectAccount(context.customer_id)} />;
            })}
          </View>
        </SectionCard>
      ) : null}

      {!loading ? (
        <SectionCard title="Vehicle & External Policy" icon="truck-outline">
          {accountVehicles.length ? (
            <View style={styles.chips}>
              {accountVehicles.map((vehicle) => <ChoiceChip key={vehicle.id} label={vehicle.vehicle_no} active={vehicle.id === selectedVehicleId} onPress={() => selectVehicle(vehicle.id)} />)}
            </View>
          ) : <Text style={styles.emptyText}>No vehicle is available for this account. Add the vehicle first.</Text>}

          {selectedVehicle ? <View style={styles.vehicleMeta}><Text style={styles.vehicleNo}>{selectedVehicle.vehicle_no}</Text><Text style={styles.metaText}>{[selectedVehicle.make, selectedVehicle.model, selectedVehicle.vehicle_type].filter(Boolean).join(' • ') || 'Vehicle'}</Text></View> : null}

          {vehiclePolicies.length > 1 ? (
            <View style={styles.policyStack}>
              <Text style={styles.fieldLabel}>Policy</Text>
              {vehiclePolicies.map((policy) => (
                <Pressable key={policy.id} onPress={() => selectPolicy(policy)} style={[styles.policyRow, policy.id === selectedPolicyId && styles.policyRowActive]}>
                  <View style={styles.policyCopy}><Text style={styles.policyNo}>{policy.policy_no}</Text><Text style={styles.metaText}>Expires {formatDate(policy.end_date)}</Text></View>
                  <MaterialCommunityIcons name={policy.id === selectedPolicyId ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={policy.id === selectedPolicyId ? '#0A43A3' : '#98A2B3'} />
                </Pressable>
              ))}
            </View>
          ) : selectedPolicy ? (
            <View style={styles.policySummary}><Text style={styles.policyNo}>{selectedPolicy.policy_no}</Text><Text style={styles.metaText}>Expires {formatDate(selectedPolicy.end_date)}</Text></View>
          ) : selectedVehicle ? <Text style={styles.emptyText}>No policy is linked to this vehicle. Add the external policy before starting claim tracking.</Text> : null}
        </SectionCard>
      ) : null}

      <SectionCard title="Accident Details" icon="car-emergency">
        <AppDatePicker label="Accident Date *" value={incidentDate} onChange={setIncidentDate} maxDate={todayIsoDate()} formatDisplay={formatDisplayDate} />
        <View style={styles.fieldGap} />
        <TextField label="Accident Time *" placeholder="HH:MM (24-hour)" value={incidentTime} onChangeText={setIncidentTime} keyboardType="numbers-and-punctuation" />
        <View style={styles.fieldGap} />
        <TextField label="Driver Name (Optional)" value={driverName} onChangeText={setDriverName} />
        <View style={styles.fieldGap} />
        <TextField label="Driver Number (Optional)" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" />
        <View style={styles.fieldGap} />
        <TextField label="Location (Optional)" placeholder="Accident location or landmark" value={location} onChangeText={setLocation} />
      </SectionCard>

      <SectionCard title="Insurance Company" icon="office-building-outline">
        <Text style={styles.requiredHint}>Mandatory for an external policy</Text>
        <View style={styles.insurerStack}>
          {insurers.map((insurer) => {
            const active = insurer.id === selectedInsurerId;
            return (
              <Pressable key={insurer.id} onPress={() => setSelectedInsurerId(insurer.id)} style={[styles.insurerRow, active && styles.insurerRowActive]}>
                <View style={[styles.insurerIcon, active && styles.insurerIconActive]}><MaterialCommunityIcons name="shield-check-outline" size={18} color={active ? '#0A43A3' : '#667085'} /></View>
                <Text style={[styles.insurerName, active && styles.insurerNameActive]}>{insurer.name}</Text>
                <MaterialCommunityIcons name={active ? 'check-circle' : 'circle-outline'} size={19} color={active ? '#0A43A3' : '#B7C0CC'} />
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <View style={styles.documentsPreview}>
        <MaterialCommunityIcons name="file-multiple-outline" size={22} color="#0A43A3" />
        <View style={styles.documentsCopy}><Text style={styles.documentsTitle}>Documents are optional at this stage</Text><Text style={styles.documentsText}>RC, insurance copy, driving licence and GR can be added from the claim document vault after this step.</Text></View>
      </View>

      <Pressable accessibilityRole="button" disabled={submitting || loading} onPress={() => void submit()} style={[styles.submitButton, (submitting || loading) && styles.submitDisabled]}>
        <Text style={styles.submitText}>{submitting ? 'Starting tracker...' : 'Start Self-Managed Claim'}</Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
      </Pressable>
    </Screen>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; children: React.ReactNode }) {
  return <View style={styles.sectionCard}><View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={18} color="#0A43A3" /></View><Text style={styles.sectionTitle}>{title}</Text></View>{children}</View>;
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text></Pressable>;
}

function buildIncidentDateTime(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeValue.trim())) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.trim().split(':').map(Number);
  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(value.getTime())) return null;
  return value;
}
function todayIsoDate() { const value = new Date(); const y = value.getFullYear(); const m = String(value.getMonth() + 1).padStart(2, '0'); const d = String(value.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function formatDisplayDate(value: string) { if (!value) return ''; const [y, m, d] = value.split('-'); return `${d}-${m}-${y}`; }
function formatDate(value?: string | null) { if (!value) return '-'; return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function mapSubmitError(message: string) {
  if (/future/i.test(message)) return 'Accident date and time cannot be in the future.';
  if (/insurance company/i.test(message)) return 'Select the insurance company for this external policy.';
  if (/policy/i.test(message)) return 'The selected policy could not be used for this claim.';
  if (/vehicle/i.test(message)) return 'The selected vehicle could not be used for this claim.';
  if (/access|customer account/i.test(message)) return 'You do not have access to the selected account.';
  return 'We could not start self-managed claim tracking right now. Please try again.';
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: -12, marginBottom: 14 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  topCopy: { flex: 1 },
  eyebrow: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: palette.navy, fontSize: 24, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#667085', fontSize: 12.5, lineHeight: 18, marginTop: 5, fontWeight: '600' },
  noticeBox: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderRadius: 16, padding: 12, backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F2D99F', marginBottom: 13 },
  noticeText: { flex: 1, color: '#77520B', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  loadingText: { color: '#667085', fontSize: 12, textAlign: 'center', paddingVertical: 18, fontWeight: '700' },
  sectionCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE7F2', borderRadius: 20, padding: 15, marginBottom: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13 },
  sectionIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#DCE3EC' },
  chipActive: { backgroundColor: '#EAF2FF', borderColor: '#0A43A3' },
  chipText: { color: '#526172', fontSize: 11.5, fontWeight: '800' },
  chipTextActive: { color: '#0A43A3' },
  vehicleMeta: { marginTop: 12, borderRadius: 13, backgroundColor: '#F8FAFC', padding: 11 },
  vehicleNo: { color: palette.navy, fontSize: 16, fontWeight: '900' },
  metaText: { color: '#667085', fontSize: 10.5, lineHeight: 15, marginTop: 2, fontWeight: '600' },
  policyStack: { marginTop: 12, gap: 7 },
  fieldLabel: { color: '#344054', fontSize: 11, fontWeight: '900', marginBottom: 1 },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 13, borderWidth: 1, borderColor: '#E3E8EF', backgroundColor: '#FFFFFF' },
  policyRowActive: { borderColor: '#79A6E8', backgroundColor: '#F5F9FF' },
  policyCopy: { flex: 1 },
  policySummary: { marginTop: 12, padding: 11, borderRadius: 13, backgroundColor: '#F5F9FF', borderWidth: 1, borderColor: '#D7E6FB' },
  policyNo: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  emptyText: { color: '#8A4450', fontSize: 11.5, lineHeight: 17, fontWeight: '700', backgroundColor: '#FFF5F5', borderRadius: 12, padding: 10 },
  fieldGap: { height: 10 },
  requiredHint: { color: '#667085', fontSize: 10.5, fontWeight: '700', marginTop: -4, marginBottom: 9 },
  insurerStack: { gap: 7 },
  insurerRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 13, borderWidth: 1, borderColor: '#E3E8EF', backgroundColor: '#FFFFFF' },
  insurerRowActive: { borderColor: '#79A6E8', backgroundColor: '#F5F9FF' },
  insurerIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  insurerIconActive: { backgroundColor: '#E3EEFF' },
  insurerName: { flex: 1, color: '#475467', fontSize: 11.5, fontWeight: '800' },
  insurerNameActive: { color: '#0A43A3' },
  documentsPreview: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#F3F7FC', borderRadius: 16, padding: 13, marginBottom: 14 },
  documentsCopy: { flex: 1 },
  documentsTitle: { color: palette.navy, fontSize: 12, fontWeight: '900' },
  documentsText: { color: '#667085', fontSize: 10.5, lineHeight: 15, marginTop: 3, fontWeight: '600' },
  submitButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#082A66', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 10 },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
