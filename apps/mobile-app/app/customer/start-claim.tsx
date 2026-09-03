import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActiveClaimPopup } from '@/components/active-claim-popup';
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

type PolicyCondition = 'active' | 'due' | 'expired';

type SelfManagedClaimRow = {
  id: string;
  current_status?: string | null;
  created_at?: string | null;
};

type SelfManagedMilestoneRow = {
  claim_id: string;
  milestone_key: string;
  milestone_status: string;
};

const SELF_MANAGED_MILESTONE_COUNT = 9;
const selfTrackedPolicyIcon = require('../../assets/claims/policy.png');
const managedPolicyIcon = require('../../assets/custom-icons/policy-detail/policy-booked.png');
const vehicleNumberIcon = require('../../assets/custom-icons/policy-detail/linked-vehicle.png');
const SETTLED_SELF_MANAGED_STATUSES = new Set(['Settled', 'Closed', 'Claim Complete']);
const COMPLETED_MILESTONE_STATUSES = new Set(['completed', 'not_applicable']);

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
  const [checkingActiveClaim, setCheckingActiveClaim] = useState(false);
  const [existingActiveClaimId, setExistingActiveClaimId] = useState('');
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
  const selectedPolicyCondition = selectedPolicy ? policyCondition(selectedPolicy.end_date) : null;

  useEffect(() => {
    setVehicleQuery('');
    setVehicleOpen(false);
    setExistingActiveClaimId('');
  }, [selectedVehicleId]);

  function selectAccount(customerId: string) {
    setSelectedCustomerId(customerId);
    const first = vehicles.find((item) => item.customer_id === customerId);
    setSelectedVehicleId(first?.id ?? '');
  }

  async function continueClaim() {
    if (!selectedVehicle || !selectedPolicy || checkingActiveClaim) return;
    if (selectedPolicy.source === 'external') {
      setMessage('');
      setCheckingActiveClaim(true);
      try {
        const existingClaim = await findActiveSelfManagedClaim(selectedPolicy.id);
        if (existingClaim) {
          setExistingActiveClaimId(existingClaim.id);
          return;
        }
        router.push({ pathname: '/customer/self-managed-claim', params: { externalPolicyId: selectedPolicy.id } } as any);
      } catch (error) {
        console.warn('Active self-tracked claim check failed', error);
        setMessage('We could not verify existing claims right now. Please try again.');
      } finally {
        setCheckingActiveClaim(false);
      }
      return;
    }
    router.push({ pathname: '/customer/report-accident', params: { vehicleId: selectedVehicle.id, policyId: selectedPolicy.id } });
  }

  function addPolicy() {
    router.push({ pathname: '/customer/add-policy', params: { vehicleId: selectedVehicleId } } as any);
  }

  function viewExistingClaim() {
    if (!existingActiveClaimId) return;
    const id = existingActiveClaimId;
    setExistingActiveClaimId('');
    router.push({ pathname: '/customer/claim-detail', params: { id } });
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
        {accountVehicles.length ? (
          <VehicleDropdown
            vehicles={filteredVehicles}
            query={vehicleQuery}
            selectedVehicle={selectedVehicle}
            open={vehicleOpen}
            onToggle={() => setVehicleOpen((value) => !value)}
            onQueryChange={setVehicleQuery}
            onSelect={(vehicle) => {
              setSelectedVehicleId(vehicle.id);
              setVehicleQuery('');
              setVehicleOpen(false);
              setSelectedCustomerId(vehicle.customer_id);
            }}
          />
        ) : (
          <>
            <Text style={styles.sectionLabel}>Vehicle number *</Text>
            <EmptyState title="No vehicle found" body="Add a vehicle before starting a claim." />
          </>
        )}
        <Text style={styles.helper}>Start typing to find a vehicle.</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Policy details</Text>
          {selectedVehicle && !activePolicy ? <Pressable accessibilityRole="button" onPress={addPolicy} style={styles.addPolicyButton}><MaterialCommunityIcons name="plus" size={16} color="#0A43A3" /><Text style={styles.addPolicyText}>Add policy</Text></Pressable> : null}
        </View>

        {selectedPolicy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View policy details for ${selectedPolicy.policy_no}`}
            onPress={() => router.push({ pathname: '/customer/policy-detail', params: { id: selectedPolicy.id, source: selectedPolicy.source } } as any)}
            style={({ pressed }) => [styles.policyCardShadow, pressed && styles.policyCardPressed]}
          >
            <View style={[styles.policyCard, selectedPolicy.source === 'external' && styles.policyCardCompact]}>
              <View pointerEvents="none" style={styles.policyDecoration}>
                <View style={styles.policyArcOne} />
                <View style={styles.policyArcTwo} />
              </View>
              <View style={[styles.policyContent, selectedPolicy.source === 'external' && styles.policyContentCompact]}>
                <View style={[styles.policyIcon, selectedPolicy.source === 'external' && styles.policyIconCompact]}>
                  <Image
                    accessible={false}
                    source={selectedPolicy.source === 'external' ? selfTrackedPolicyIcon : managedPolicyIcon}
                    style={[
                      styles.policyIconArtwork,
                      selectedPolicy.source === 'external' && styles.policyIconArtworkCompact,
                      selectedPolicy.source === 'external' && styles.selfTrackedPolicyIconArtwork,
                    ]}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.policyCopy}>
                  <Text style={[styles.policyMode, selectedPolicy.source === 'external' && styles.policyModeCompact]}>{selectedPolicy.source === 'external' ? 'SELF TRACKED CLAIM' : 'SANKALP MANAGED CLAIM'}</Text>
                  <Text style={[styles.policyNo, selectedPolicy.source === 'external' && styles.policyNoCompact]}>{selectedPolicy.policy_no}</Text>
                  <Text style={[styles.policyInsurer, selectedPolicy.source === 'external' && styles.policyInsurerCompact]}>{selectedInsurer?.name ?? 'Insurance company'} · {selectedPolicy.policy_type}</Text>
                  <Text style={[styles.policyDates, selectedPolicy.source === 'external' && styles.policyDatesCompact]}>{formatDate(selectedPolicy.start_date)} – {formatDate(selectedPolicy.end_date)}</Text>
                </View>
                {selectedPolicy.source === 'external' ? (
                  <PolicyStatusPulse condition={selectedPolicyCondition ?? 'active'} />
                ) : selectedPolicyCondition === 'expired' ? (
                  <ExpiredPolicyPulse />
                ) : (
                  <View style={[styles.policyCheck, selectedPolicyCondition === 'due' && styles.policyCheckDue]}>
                    <MaterialCommunityIcons name={selectedPolicyCondition === 'due' ? 'alert-outline' : 'check'} size={selectedPolicyCondition === 'due' ? 21 : 20} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={styles.noPolicy}><MaterialCommunityIcons name="shield-alert-outline" size={26} color="#B7791F" /><View style={styles.noPolicyCopy}><Text style={styles.noPolicyTitle}>No policy recorded for this vehicle</Text><Text style={styles.noPolicyText}>Add the policy details before starting a claim.</Text></View></View>
        )}
      </View>

      <ClaimActionBar
        primaryDisabled={!selectedPolicy || checkingActiveClaim}
        primaryLabel={checkingActiveClaim ? 'Checking...' : selectedPolicy?.source === 'external' ? 'Start Claim' : 'Continue to Incident Report'}
        primaryIcon="arrow-right"
        onPrimary={() => void continueClaim()}
        onAssistance={() => router.push('/customer/support')}
      />

      <ActiveClaimPopup
        visible={Boolean(existingActiveClaimId)}
        onViewClaim={viewExistingClaim}
        onCancel={() => setExistingActiveClaimId('')}
      />

      <Image accessible={false} source={require('../../assets/brand/start-claim/start-claim-footer-scene.png')} style={styles.footerArtwork} resizeMode="contain" />
    </Screen>
  );
}

async function findActiveSelfManagedClaim(externalPolicyId: string): Promise<SelfManagedClaimRow | null> {
  const claimResult = await (supabase as any)
    .from('claims')
    .select('id,current_status,created_at')
    .eq('external_policy_id', externalPolicyId)
    .eq('claim_service_mode', 'self_managed')
    .order('created_at', { ascending: false });

  if (claimResult.error) throw claimResult.error;
  const claims = (claimResult.data ?? []) as SelfManagedClaimRow[];
  if (!claims.length) return null;

  const unsettledClaims = claims.filter((claim) => !SETTLED_SELF_MANAGED_STATUSES.has(claim.current_status ?? ''));
  if (!unsettledClaims.length) return null;

  const claimIds = unsettledClaims.map((claim) => claim.id);
  const milestoneResult = await (supabase as any)
    .from('claim_milestones')
    .select('claim_id,milestone_key,milestone_status')
    .in('claim_id', claimIds);
  if (milestoneResult.error) throw milestoneResult.error;

  const milestones = (milestoneResult.data ?? []) as SelfManagedMilestoneRow[];
  for (const claim of unsettledClaims) {
    const completedKeys = new Set(
      milestones
        .filter((item) => item.claim_id === claim.id && COMPLETED_MILESTONE_STATUSES.has(item.milestone_status))
        .map((item) => item.milestone_key),
    );
    if (completedKeys.size < SELF_MANAGED_MILESTONE_COUNT) return claim;
  }
  return null;
}

function PolicyStatusPulse({ condition }: { condition: PolicyCondition }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 760, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const conditionStyle = condition === 'expired'
    ? styles.policyCheckExpired
    : condition === 'due'
      ? styles.policyCheckDue
      : null;

  return (
    <Animated.View style={[styles.policyCheck, styles.policyCheckCompact, conditionStyle, { opacity, transform: [{ scale }] }]}>
      {condition === 'expired' ? (
        <Text style={styles.policyStatusExclamation}>!</Text>
      ) : (
        <MaterialCommunityIcons
          name={condition === 'due' ? 'alert-outline' : 'check'}
          size={condition === 'due' ? 16 : 15}
          color="#FFFFFF"
        />
      )}
    </Animated.View>
  );
}

function ExpiredPolicyPulse() {
  return <PolicyStatusPulse condition="expired" />;
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function VehicleDropdown({ vehicles, query, selectedVehicle, open, onToggle, onQueryChange, onSelect }: { vehicles: Vehicle[]; query: string; selectedVehicle: Vehicle | null; open: boolean; onToggle: () => void; onQueryChange: (value: string) => void; onSelect: (vehicle: Vehicle) => void }) {
  const anchorRef = useRef<View>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });

  function focusSearchInput() {
    requestAnimationFrame(() => {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    });
  }

  function closeSelector() {
    Keyboard.dismiss();
    if (open) onToggle();
  }

  function toggleSelector() {
    if (open) {
      Keyboard.dismiss();
      onToggle();
      return;
    }
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      onToggle();
    });
  }

  return <View style={styles.vehicleField}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selectedVehicle ? `Vehicle number ${selectedVehicle.vehicle_no}. Open vehicle selector.` : 'Open vehicle selector'}
      accessibilityState={{ expanded: open }}
      onPress={toggleSelector}
      style={({ pressed }) => [styles.vehicleSelectorPressTarget, pressed && !open && styles.vehicleSelectorPressed]}
    >
      <Text pointerEvents="none" style={styles.sectionLabel}>Vehicle number *</Text>
      <View ref={anchorRef} collapsable={false} pointerEvents="none" style={[styles.selectButton, open && styles.selectButtonHidden]}>
        <Image accessible={false} source={vehicleNumberIcon} style={styles.selectVehicleArtwork} resizeMode="contain" />
        <View style={styles.selectCopy}><Text style={[styles.selectValue, !selectedVehicle && styles.placeholder]} numberOfLines={1}>{selectedVehicle ? selectedVehicle.vehicle_no : 'Select vehicle'}</Text>{selectedVehicle ? <Text style={styles.selectMeta} numberOfLines={1}>{[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' · ') || selectedVehicle.vehicle_type}</Text> : null}</View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={23} color={palette.navy} />
      </View>
    </Pressable>

    <Modal
      visible={open}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSelector}
      onShow={focusSearchInput}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Close vehicle selector" onPress={closeSelector} style={styles.vehicleDropdownOverlay}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.vehicleAnchoredMenu,
            {
              left: anchor.x,
              top: anchor.y + anchor.height + 4,
              width: anchor.width,
            },
          ]}
        >
          <View style={styles.makeSearch}>
            <MaterialCommunityIcons name="magnify" size={19} color="#145ED7" />
            <TextInput
              ref={searchInputRef}
              value={query}
              onChangeText={onQueryChange}
              autoCapitalize="characters"
              returnKeyType="search"
              placeholder="Search vehicle number, make or model"
              placeholderTextColor="#6E7F96"
              style={styles.makeSearchInput}
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            style={styles.vehicleModalOptions}
          >
            {vehicles.length ? vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                accessibilityRole="button"
                onPress={() => {
                  Keyboard.dismiss();
                  onSelect(vehicle);
                }}
                style={[styles.makeOption, selectedVehicle?.id === vehicle.id && styles.selectOptionActive]}
              >
                <View style={styles.vehicleOptionCopy}>
                  <Text style={[styles.selectOptionText, selectedVehicle?.id === vehicle.id && styles.selectOptionTextActive]} numberOfLines={1}>{vehicle.vehicle_no}</Text>
                  <Text style={styles.optionMeta} numberOfLines={1}>{[vehicle.make, vehicle.model].filter(Boolean).join(' · ') || vehicle.vehicle_type}</Text>
                </View>
                {selectedVehicle?.id === vehicle.id ? <MaterialCommunityIcons name="check-circle" size={17} color="#0A43A3" /> : null}
              </Pressable>
            )) : <Text style={styles.emptyLookupText}>No matching vehicles found.</Text>}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
}

function formatDate(value: string) { return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatIsoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function daysUntil(value: string) { return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000); }
function policyCondition(endDate: string): PolicyCondition { const days = daysUntil(endDate); return days < 0 ? 'expired' : days <= 30 ? 'due' : 'active'; }

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
  vehicleSelectorPressTarget: { width: '100%' },
  vehicleSelectorPressed: { opacity: 0.96 },
  selectButton: { minHeight: 64, borderRadius: 16, borderWidth: 1.5, borderColor: '#AFC9EC', backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectButtonOpen: { borderColor: '#3F7FE5', backgroundColor: '#FBFDFF', shadowColor: '#145ED7', shadowOpacity: 0.09, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  selectButtonHidden: { opacity: 0 },
  selectVehicleArtwork: { width: 36, height: 36 },
  selectCopy: { flex: 1, minWidth: 0 },
  selectValue: { color: palette.navy, fontSize: 14.5, fontWeight: '900' },
  selectMeta: { color: '#718198', fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  placeholder: { color: '#7A8798', fontWeight: '700' },
  makeMenu: { borderRadius: 15, borderWidth: 1, borderColor: '#C8D9EF', backgroundColor: '#FFFFFF', overflow: 'hidden', marginTop: 4 },
  vehicleDropdownOverlay: { flex: 1, backgroundColor: 'transparent' },
  vehicleAnchoredMenu: { position: 'absolute', maxHeight: 330, borderRadius: 15, borderWidth: 1, borderColor: '#C8D9EF', backgroundColor: '#FFFFFF', overflow: 'hidden', shadowColor: '#071D49', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 12 },
  vehicleModalOptions: { maxHeight: 270 },
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
  policyCardShadow: { borderRadius: 20, shadowColor: '#07327B', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3, backgroundColor: '#07327B' },
  policyCardPressed: { opacity: 0.94, transform: [{ scale: 0.995 }] },
  policyCard: { position: 'relative', minHeight: 145, borderRadius: 20, backgroundColor: '#07327B', overflow: 'hidden' },
  policyCardCompact: { minHeight: 106 },
  policyDecoration: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  policyArcOne: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1, borderColor: 'rgba(68,137,255,0.20)', right: -100, top: -118 },
  policyArcTwo: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: 'rgba(68,137,255,0.18)', right: -50, top: -88 },
  policyContent: { position: 'relative', zIndex: 2, minHeight: 145, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  policyContentCompact: { minHeight: 106, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  policyIcon: { width: 60, height: 60, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  policyIconCompact: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'transparent' },
  policyIconArtwork: { width: 43, height: 43 },
  policyIconArtworkCompact: { width: 34, height: 34 },
  selfTrackedPolicyIconArtwork: { tintColor: '#FFFFFF', opacity: 0.96 },
  policyCopy: { flex: 1, minWidth: 0, zIndex: 2 },
  policyMode: { color: '#8EB8FF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.55 },
  policyModeCompact: { fontSize: 8.8, letterSpacing: 0.42 },
  policyNo: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 4 },
  policyNoCompact: { fontSize: 16.5, marginTop: 1 },
  policyInsurer: { color: '#E0E9F7', fontSize: 10.5, lineHeight: 15, fontWeight: '700', marginTop: 4 },
  policyInsurerCompact: { fontSize: 9.8, lineHeight: 12.8, marginTop: 1 },
  policyDates: { color: '#D2DEEF', fontSize: 10.5, fontWeight: '700', marginTop: 5 },
  policyDatesCompact: { fontSize: 9.8, marginTop: 2 },
  policyCheck: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#11A35D', alignItems: 'center', justifyContent: 'center' },
  policyCheckCompact: { width: 28, height: 28, borderRadius: 14 },
  policyCheckExpired: { backgroundColor: '#E85D63' },
  policyCheckDue: { backgroundColor: '#F59E0B' },
  policyStatusExclamation: { color: '#FFFFFF', fontSize: 18, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
  noPolicy: { borderRadius: 15, borderWidth: 1, borderColor: '#F0D9AC', backgroundColor: '#FFFBF3', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noPolicyCopy: { flex: 1 },
  noPolicyTitle: { color: '#77520B', fontSize: 12, fontWeight: '900' },
  noPolicyText: { color: '#8A6A25', fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 2 },
  footerArtwork: { alignSelf: 'stretch', width: '100%', height: 190, marginHorizontal: 0, marginTop: -20, marginBottom: -4, opacity: 0.96 },
});