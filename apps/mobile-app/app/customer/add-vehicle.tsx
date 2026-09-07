import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Message, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, isPortfolioCustomerContext, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { lookupCustomerRc } from '@/lib/customer-rc-lookup';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany } from '@/lib/types';

const vehicleClasses = [
  { value: 'PCP', label: 'PCP - Private Car' },
  { value: 'TWP', label: 'TWP - Two Wheeler' },
  { value: 'GCV', label: 'GCV - Goods Carrying Vehicle' },
  { value: 'PCV', label: 'PCV - Passenger Carrying Vehicle' },
  { value: 'MISD', label: 'MISD - Miscellaneous Vehicle' },
  { value: 'CPM', label: 'CPM - Contractor Plant & Machinery' },
];
const fuelOptions = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'Bi-Fuel', 'Other'];
const policyTypeOptions = ['Motor', 'Health', 'Life', 'Travel', 'Personal Accident', 'Fire', 'Marine', 'Engineering', 'Liability', 'Cyber', 'Property', 'Agriculture / Crop', 'Other / Miscellaneous'];
const MAX_POLICY_COPY_SIZE_BYTES = 5 * 1024 * 1024;
type PickedPolicyCopy = { uri: string; name: string; mimeType: string | null; size: number | null };
type RcLookupState = 'idle' | 'loading' | 'success' | 'error';
type ComplianceKey = 'fitness' | 'puc' | 'road_tax' | 'national_permit' | 'local_permit';

export default function AddVehicleScreen() {
  const router = useRouter();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [makeOpen, setMakeOpen] = useState(false);
  const [makeQuery, setMakeQuery] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [chassisNo, setChassisNo] = useState('');
  const [engineNo, setEngineNo] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [gvwKg, setGvwKg] = useState('');
  const [engineCapacityCc, setEngineCapacityCc] = useState('');
  const [seatingCapacity, setSeatingCapacity] = useState('');
  const [lastFetchedRc, setLastFetchedRc] = useState('');
  const [insurerQuery, setInsurerQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [policyType, setPolicyType] = useState('Motor');
  const [policyTypeOpen, setPolicyTypeOpen] = useState(false);
  const [policyStartDate, setPolicyStartDate] = useState('');
  const [policyEndDate, setPolicyEndDate] = useState('');
  const [premium, setPremium] = useState('');
  const [idv, setIdv] = useState('');
  const [policyCopy, setPolicyCopy] = useState<PickedPolicyCopy | null>(null);
  const [registrationDate, setRegistrationDate] = useState('');
  const [fitnessExpiryDate, setFitnessExpiryDate] = useState('');
  const [pucExpiryDate, setPucExpiryDate] = useState('');
  const [roadTaxExpiryDate, setRoadTaxExpiryDate] = useState('');
  const [nationalPermitExpiryDate, setNationalPermitExpiryDate] = useState('');
  const [localPermitExpiryDate, setLocalPermitExpiryDate] = useState('');
  const [dateTarget, setDateTarget] = useState<{ label: string; value: string; onChange: (value: string) => void; autoEnd?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [rcLookupState, setRcLookupState] = useState<RcLookupState>('idle');
  const [rcLookupMessage, setRcLookupMessage] = useState('');

  const normalizedRc = normalizeRc(vehicleNo);
  const rcReady = isValidIndianRegistrationNumber(normalizedRc);
  const complianceKeys = useMemo(() => complianceKeysForVehicleType(vehicleType), [vehicleType]);
  const visibleDateFields = useMemo(() => {
    const all: Array<{ key: ComplianceKey; label: string; value: string; onChange: (value: string) => void }> = [
      { key: 'fitness', label: 'Fitness expiry', value: fitnessExpiryDate, onChange: setFitnessExpiryDate },
      { key: 'puc', label: 'PUC expiry', value: pucExpiryDate, onChange: setPucExpiryDate },
      { key: 'road_tax', label: 'Road tax expiry', value: roadTaxExpiryDate, onChange: setRoadTaxExpiryDate },
      { key: 'national_permit', label: 'National permit expiry', value: nationalPermitExpiryDate, onChange: setNationalPermitExpiryDate },
      { key: 'local_permit', label: 'Local permit expiry', value: localPermitExpiryDate, onChange: setLocalPermitExpiryDate },
    ];
    return all.filter((field) => complianceKeys.includes(field.key));
  }, [complianceKeys, fitnessExpiryDate, localPermitExpiryDate, nationalPermitExpiryDate, pucExpiryDate, roadTaxExpiryDate]);

  const capacity = capacityFieldForVehicleType(vehicleType, {
    gvwKg,
    engineCapacityCc,
    seatingCapacity,
    setGvwKg,
    setEngineCapacityCc,
    setSeatingCapacity,
  });

  useEffect(() => {
    let active = true;
    async function loadContexts() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const operationalContexts = await getOperationalCustomerContexts();
      const groupParent = operationalContexts.find((context) => context.partner_type === 'group' && context.access_source === 'direct');
      const nextContexts = groupParent
        ? operationalContexts.filter((context) => context.customer_id !== groupParent.customer_id)
        : operationalContexts;
      if (!active) return;
      setContexts(nextContexts);
      setSelectedCustomerId(nextContexts[0]?.customer_id ?? '');
    }
    void loadContexts();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    let active = true;
    async function loadLookups() {
      const [manufacturerResult, companyResult] = await Promise.all([
        supabase.from('vehicle_manufacturer_brands').select('brand_name').eq('is_active', true).order('brand_name', { ascending: true }),
        supabase.from('insurance_companies').select('*').order('name'),
      ]);
      if (!active) return;
      setCompanies((companyResult.data ?? []) as InsuranceCompany[]);
      if (manufacturerResult.error) setManufacturers([]);
      else setManufacturers(Array.from(new Set((manufacturerResult.data ?? []).map((item) => item.brand_name).filter(Boolean))));
    }
    void loadLookups();
    return () => { active = false; };
  }, []);

  function changeVehicleNo(value: string) {
    const next = value.replace(/[^A-Za-z0-9 -]/g, '').toUpperCase();
    setVehicleNo(next);
    if (normalizeRc(next) !== lastFetchedRc) {
      setRcLookupState('idle');
      setRcLookupMessage('');
    }
  }

  async function fetchRcDetails() {
    if (rcLookupState === 'loading') return;
    setMessage('');
    setRcLookupMessage('');

    const normalized = normalizeRc(vehicleNo);
    if (!isValidIndianRegistrationNumber(normalized)) {
      setRcLookupState('error');
      return setRcLookupMessage('Enter the complete vehicle registration number.');
    }
    if (lastFetchedRc === normalized && rcLookupState === 'success') return;

    if (selectedCustomerId) {
      const { data: existingVehicles } = await supabase.from('vehicles').select('id,vehicle_no').eq('customer_id', selectedCustomerId).limit(250);
      const duplicate = (existingVehicles ?? []).find((item) => normalizeRc(String(item.vehicle_no ?? '')) === normalized);
      if (duplicate) {
        setRcLookupState('error');
        return setRcLookupMessage('This vehicle is already added to this account.');
      }
    }

    setRcLookupState('loading');
    setRcLookupMessage('Fetching vehicle details…');
    try {
      const response = await lookupCustomerRc(normalized);
      const details = response.details;
      setVehicleNo(details.registrationNumber || normalized);
      if (details.registrationDate) setRegistrationDate(details.registrationDate);

      let manufacturerNeedsConfirmation = false;
      if (details.manufacturer) {
        const resolvedMake = resolveManufacturer(details.manufacturer, manufacturers);
        if (resolvedMake) {
          setMake(resolvedMake);
          setMakeQuery(resolvedMake);
          setMakeOpen(false);
        } else {
          setMake('');
          setMakeQuery(details.manufacturer);
          setMakeOpen(true);
          manufacturerNeedsConfirmation = true;
        }
      }

      if (details.model) setModel(cleanProviderModel(details.model, details.manufacturer));
      if (details.manufacturingYear) setYear(details.manufacturingYear);
      if (details.vehicleClass && vehicleClasses.some((item) => item.value === details.vehicleClass)) setVehicleType(details.vehicleClass);
      if (details.chassisNumber) setChassisNo(details.chassisNumber);
      if (details.engineNumber) setEngineNo(details.engineNumber);
      if (details.fuelType && fuelOptions.includes(details.fuelType)) setFuelType(details.fuelType);
      if (details.gvwKg) setGvwKg(details.gvwKg);
      if (details.engineCapacityCc) setEngineCapacityCc(details.engineCapacityCc);
      if (details.seatingCapacity) setSeatingCapacity(details.seatingCapacity);
      if (details.fitnessExpiryDate) setFitnessExpiryDate(details.fitnessExpiryDate);
      if (details.pucExpiryDate) setPucExpiryDate(details.pucExpiryDate);
      if (details.roadTaxExpiryDate) setRoadTaxExpiryDate(details.roadTaxExpiryDate);
      if (details.nationalPermitExpiryDate) setNationalPermitExpiryDate(details.nationalPermitExpiryDate);
      if (details.localPermitExpiryDate) setLocalPermitExpiryDate(details.localPermitExpiryDate);

      setLastFetchedRc(normalized);
      setRcLookupState('success');
      if (response.isStale) {
        setRcLookupMessage('Vehicle details found from an earlier lookup. Please review before saving.');
      } else if (manufacturerNeedsConfirmation) {
        setRcLookupMessage('Vehicle details found. Please confirm the manufacturer before saving.');
      } else {
        setRcLookupMessage('Vehicle details found. Please review the filled information.');
      }
    } catch (error) {
      setRcLookupState('error');
      setRcLookupMessage(error instanceof Error ? error.message : 'We could not fetch vehicle details. You can continue manually.');
    }
  }

  async function save() {
    setMessage('');
    if (saving) return;
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const target = contexts.find((context) => context.customer_id === selectedCustomerId);
    if (!target) return setMessage('Select the customer account for this vehicle.');
    if (!isValidIndianRegistrationNumber(normalizeRc(vehicleNo))) return setMessage('Enter the complete vehicle registration number.');
    if (!vehicleType) return setMessage('Select the vehicle class.');
    if (!make.trim()) return setMessage('Select the vehicle manufacturer.');
    if (!model.trim()) return setMessage('Enter the vehicle model.');
    if (!year.trim()) return setMessage('Select the manufacturing year.');
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > new Date().getFullYear() + 1) return setMessage('Enter a valid manufacturing year.');

    const parsedGvw = gvwKg ? Number(gvwKg) : null;
    const parsedCc = engineCapacityCc ? Number(engineCapacityCc) : null;
    const parsedSeats = seatingCapacity ? Number(seatingCapacity) : null;
    if (parsedGvw !== null && (!Number.isFinite(parsedGvw) || parsedGvw <= 0)) return setMessage('Enter a valid GVW.');
    if (parsedCc !== null && (!Number.isFinite(parsedCc) || parsedCc <= 0)) return setMessage('Enter a valid engine capacity.');
    if (parsedSeats !== null && (!Number.isInteger(parsedSeats) || parsedSeats <= 0)) return setMessage('Enter a valid seating capacity.');

    const hasPolicyDetails = Boolean(selectedCompanyId || policyNo.trim() || policyStartDate || policyEndDate || premium.trim() || idv.trim() || policyCopy);
    if (hasPolicyDetails && !selectedCompanyId) return setMessage('Search and select the insurer to save policy details.');
    if (hasPolicyDetails && !policyNo.trim()) return setMessage('Enter policy number to save policy details.');
    if (hasPolicyDetails && !policyType.trim()) return setMessage('Select policy type to save policy details.');
    if (hasPolicyDetails && !policyStartDate) return setMessage('Select policy start date to save policy details.');
    if (hasPolicyDetails && !policyEndDate) return setMessage('Select policy end date to save policy details.');
    if (hasPolicyDetails && new Date(policyEndDate).getTime() < new Date(policyStartDate).getTime()) return setMessage('End date must be after start date.');
    const premiumValue = premium ? Number(premium) : null;
    if (hasPolicyDetails && premiumValue !== null && (!Number.isFinite(premiumValue) || premiumValue < 0)) return setMessage('Enter a valid premium amount.');
    const idvValue = idv ? Number(idv) : null;
    if (hasPolicyDetails && idvValue !== null && (!Number.isFinite(idvValue) || idvValue < 0)) return setMessage('Enter a valid IDV.');

    const rpcPayload = {
      p_customer_id: target.customer_id,
      p_vehicle_no: normalizeRc(vehicleNo),
      p_vehicle_type: vehicleType || null,
      p_make: make.trim(),
      p_model: model.trim(),
      p_year: parsedYear,
      p_chassis_no: cleanCode(chassisNo),
      p_engine_no: cleanCode(engineNo),
      p_permit_no: null,
      p_gvw_kg: parsedGvw,
      p_engine_capacity_cc: parsedCc,
      p_seating_capacity: parsedSeats,
      p_fuel_type: fuelType || null,
      p_registration_date: cleanDate(registrationDate),
      p_fitness_expiry_date: cleanDate(fitnessExpiryDate),
      p_puc_expiry_date: cleanDate(pucExpiryDate),
      p_road_tax_expiry_date: cleanDate(roadTaxExpiryDate),
      p_national_permit_expiry_date: cleanDate(nationalPermitExpiryDate),
      p_local_permit_expiry_date: cleanDate(localPermitExpiryDate),
    };

    setSaving(true);
    let { data: vehicleData, error } = await (supabase.rpc as any)('create_customer_vehicle_v2', rpcPayload);
    if (isMissingVehicleRpcSignature(error, 'create_customer_vehicle_v2')) {
      console.warn('create_customer_vehicle_v2 is unavailable; retrying compatible vehicle save');
      const compatiblePayload = {
        p_customer_id: rpcPayload.p_customer_id,
        p_vehicle_no: rpcPayload.p_vehicle_no,
        p_vehicle_type: rpcPayload.p_vehicle_type,
        p_make: rpcPayload.p_make,
        p_model: rpcPayload.p_model,
        p_year: rpcPayload.p_year,
        p_chassis_no: rpcPayload.p_chassis_no,
        p_engine_no: rpcPayload.p_engine_no,
        p_permit_no: rpcPayload.p_permit_no,
        p_gvw_kg: rpcPayload.p_gvw_kg,
        p_fuel_type: rpcPayload.p_fuel_type,
        p_registration_date: rpcPayload.p_registration_date,
        p_fitness_expiry_date: rpcPayload.p_fitness_expiry_date,
        p_puc_expiry_date: rpcPayload.p_puc_expiry_date,
        p_road_tax_expiry_date: rpcPayload.p_road_tax_expiry_date,
        p_national_permit_expiry_date: rpcPayload.p_national_permit_expiry_date,
        p_local_permit_expiry_date: rpcPayload.p_local_permit_expiry_date,
      };
      const fallback = await (supabase.rpc as any)('create_customer_vehicle', compatiblePayload);
      vehicleData = fallback.data;
      error = fallback.error;
      if (isMissingVehicleRpcSignature(error, 'create_customer_vehicle')) {
        const legacy = await (supabase.rpc as any)('create_customer_vehicle', {
          p_customer_id: rpcPayload.p_customer_id,
          p_vehicle_no: rpcPayload.p_vehicle_no,
          p_vehicle_type: rpcPayload.p_vehicle_type,
          p_make: rpcPayload.p_make,
          p_model: rpcPayload.p_model,
          p_year: rpcPayload.p_year,
        });
        vehicleData = legacy.data;
        error = legacy.error;
      }
    }
    if (error) {
      console.warn('Customer vehicle save failed', error.message);
      setSaving(false);
      return setMessage('We could not save this vehicle right now. Please try again.');
    }

    const createdVehicle = Array.isArray(vehicleData) ? vehicleData[0] : vehicleData;
    if (!createdVehicle?.id) {
      setSaving(false);
      return setMessage('Vehicle was saved, but we could not confirm the new vehicle record.');
    }

    if (hasPolicyDetails) {
      const policyPayload = {
        p_customer_id: target.customer_id,
        p_vehicle_id: createdVehicle.id,
        p_insurance_company_id: selectedCompanyId,
        p_policy_no: policyNo.trim().toUpperCase(),
        p_policy_type: policyType.trim(),
        p_start_date: policyStartDate,
        p_end_date: policyEndDate,
        p_premium_amount: premiumValue,
        p_insured_declared_value: idvValue,
      };
      const policyResult = await (supabase.rpc as any)('create_customer_external_policy', policyPayload);
      if (policyResult.error) {
        console.warn('Customer vehicle policy save failed', policyResult.error.message);
        setSaving(false);
        return setMessage('Vehicle saved, but the policy details could not be saved. Please add the policy again from the vehicle screen.');
      }
      if (policyCopy) {
        const uploadError = await uploadPolicyCopy(target.customer_id, policyCopy, session.user.id);
        if (uploadError) {
          console.warn('Customer vehicle policy copy upload failed', uploadError);
          setSaving(false);
          return setMessage('Vehicle and policy saved, but the policy copy could not be uploaded. You can add the copy again later.');
        }
      }
    }
    setSaving(false);
    router.replace(contexts.some(isPortfolioCustomerContext) ? '/customer/group/fleet' : '/customer/vehicles');
  }

  async function pickPolicyCopy() {
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_POLICY_COPY_SIZE_BYTES) return setMessage('Policy copy must be 5 MB or smaller.');
    setPolicyCopy({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null });
  }

  return (
    <Screen title="Add Vehicle" showLogout showTitleHeader={false} topSpacing="compact">
      <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>VEHICLE ONBOARDING</Text><Text style={styles.compactTitle}>Add Vehicle</Text></View><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.modalClose}><MaterialCommunityIcons name="close" size={20} color={palette.navy} /></Pressable></View>
      <Card style={styles.formCard}>
        <View pointerEvents="none" style={styles.formAccentOne} />
        <View pointerEvents="none" style={styles.formAccentTwo} />
        {message ? <Message type="error">{message}</Message> : null}
        {contexts.length > 1 ? <AccountDropdown contexts={contexts} selectedCustomerId={selectedCustomerId} open={accountOpen} onToggle={() => setAccountOpen((value) => !value)} onSelect={(customerId) => { setSelectedCustomerId(customerId); setAccountOpen(false); setRcLookupState('idle'); setRcLookupMessage(''); setLastFetchedRc(''); }} /> : null}

        <FormSection title="Vehicle ownership" icon="truck-outline" tone="vehicle">
          <RcLookupField value={vehicleNo} state={rcLookupState} valid={rcReady} fetched={rcLookupState === 'success' && lastFetchedRc === normalizedRc} onChangeText={changeVehicleNo} onFetch={() => void fetchRcDetails()} />
          {rcLookupMessage ? (
            <View style={[styles.rcStatus, rcLookupState === 'success' ? styles.rcStatusSuccess : rcLookupState === 'error' ? styles.rcStatusError : styles.rcStatusInfo]}>
              {rcLookupState === 'loading' ? <ActivityIndicator size="small" color="#0A43A3" /> : <MaterialCommunityIcons name={rcLookupState === 'success' ? 'check-circle-outline' : rcLookupState === 'error' ? 'alert-circle-outline' : 'information-outline'} size={17} color={rcLookupState === 'success' ? '#12805C' : rcLookupState === 'error' ? '#B54747' : '#0A43A3'} />}
              <Text style={styles.rcStatusText}>{rcLookupMessage}</Text>
            </View>
          ) : null}
          <PremiumDateField label="Registration date" value={registrationDate} onPress={() => setDateTarget({ label: 'Registration date', value: registrationDate, onChange: setRegistrationDate })} />
          <MakeDropdown required manufacturers={manufacturers} selectedMake={make} query={makeQuery} open={makeOpen} onToggle={() => setMakeOpen((value) => !value)} onQueryChange={setMakeQuery} onSelect={(value) => { setMake(value); setMakeQuery(value); setMakeOpen(false); }} />
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><InputField required icon="car-info" label="Model" value={model} onChangeText={setModel} /></View>
            <View style={styles.column}><YearDropdown value={year} onSelect={setYear} /></View>
          </View>
        </FormSection>

        <FormSection title="Vehicle specification" icon="identifier" tone="identity">
          <VehicleTypeDropdown required value={vehicleType} onSelect={setVehicleType} />
          <MaskedCodeField icon="barcode" label="Chassis number" value={chassisNo} onChangeText={setChassisNo} />
          <MaskedCodeField icon="engine-outline" label="Engine number" value={engineNo} onChangeText={setEngineNo} />
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><FuelDropdown value={fuelType} onSelect={setFuelType} /></View>
            <View style={styles.column}><InputField icon={capacity.icon} label={capacity.label} keyboardType={capacity.keyboardType} value={capacity.value} onChangeText={capacity.onChangeText} /></View>
          </View>
        </FormSection>

        {visibleDateFields.length ? (
          <FormSection title="Compliance & permit" icon="clipboard-pulse-outline" tone="operational">
            <View style={styles.dateGrid}>
              {visibleDateFields.map((field) => <View key={field.key} style={styles.dateCell}><PremiumDateField label={field.label} value={field.value} onPress={() => setDateTarget(field)} /></View>)}
            </View>
          </FormSection>
        ) : null}

        <FormSection title="Policy details · Optional" icon="file-document-outline" tone="policy">
          <SearchInsurer query={insurerQuery} selectedInsurer={companies.find((company) => company.id === selectedCompanyId) ?? null} companies={companies.filter((company) => !insurerQuery.trim() || company.name.toLowerCase().includes(insurerQuery.trim().toLowerCase())).slice(0, 10)} onChange={(value) => { setSelectedCompanyId(''); setInsurerQuery(value); }} onSelect={(company) => { setSelectedCompanyId(company.id); setInsurerQuery(company.name); }} />
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><InputField icon="identifier" label="Policy no." value={policyNo} onChangeText={(value) => setPolicyNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" /></View>
            <View style={styles.column}><PolicyTypeDropdown value={policyType} open={policyTypeOpen} onToggle={() => setPolicyTypeOpen((value) => !value)} onSelect={(value) => { setPolicyType(value); setPolicyTypeOpen(false); }} /></View>
          </View>
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><PremiumDateField label="Start date" value={policyStartDate} onPress={() => setDateTarget({ label: 'Policy start date', value: policyStartDate, onChange: (value) => { setPolicyStartDate(value); setPolicyEndDate(defaultPolicyEndDate(value)); }, autoEnd: true })} /></View>
            <View style={styles.column}><ReadonlyDateField label="End date" value={policyEndDate} /></View>
          </View>
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><MoneyField label="IDV" icon="car-info" value={idv} onChangeText={setIdv} /></View>
            <View style={styles.column}><MoneyField label="Premium" icon="currency-inr" value={premium} onChangeText={setPremium} /></View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void pickPolicyCopy()} style={styles.policyCopyButton}>
            <MaterialCommunityIcons name="file-upload-outline" size={18} color="#0A43A3" />
            <View style={styles.flex}><Text style={styles.policyCopyTitle}>{policyCopy ? 'Policy copy selected' : 'Upload policy copy'}</Text><Text style={styles.policyCopyText} numberOfLines={1}>{policyCopy?.name ?? 'PDF or image, up to 5 MB'}</Text></View>
            <MaterialCommunityIcons name="upload-outline" size={18} color="#0A43A3" />
          </Pressable>
        </FormSection>

        <Button label={saving ? 'Saving vehicle...' : 'Save vehicle'} onPress={save} disabled={saving || rcLookupState === 'loading'} />
        {saving ? <ActivityIndicator color={palette.navy} /> : null}
      </Card>
      <PremiumCalendarModal target={dateTarget} onClose={() => setDateTarget(null)} onSelect={(value) => { dateTarget?.onChange(value); setDateTarget(null); }} />
    </Screen>
  );
}

function FormSection({ title, icon, tone = 'default', children }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone?: 'default' | 'vehicle' | 'identity' | 'operational' | 'policy'; children: React.ReactNode }) {
  return <View style={[styles.section, tone === 'vehicle' && styles.vehicleSection, tone === 'identity' && styles.identitySection, tone === 'operational' && styles.operationalSection, tone === 'policy' && styles.policySection]}><View style={[styles.sectionHeader, tone === 'vehicle' && styles.vehicleSectionHeader, tone === 'identity' && styles.identitySectionHeader, tone === 'operational' && styles.operationalSectionHeader, tone === 'policy' && styles.policySectionHeader]}><View style={[styles.sectionIcon, tone === 'vehicle' && styles.vehicleSectionIcon, tone === 'identity' && styles.identitySectionIcon, tone === 'operational' && styles.operationalSectionIcon, tone === 'policy' && styles.policySectionIcon]}><MaterialCommunityIcons name={icon} size={18} color="#0A43A3" /></View><Text style={styles.sectionTitle}>{title}</Text></View><View style={styles.sectionBody}>{children}</View></View>;
}

function RcLookupField({ value, state, valid, fetched, onChangeText, onFetch }: { value: string; state: RcLookupState; valid: boolean; fetched: boolean; onChangeText: (value: string) => void; onFetch: () => void }) {
  const loading = state === 'loading';
  const disabled = loading || !valid || fetched;
  const label = loading ? 'Fetching' : fetched ? 'Fetched' : 'Fetch';
  const icon = fetched ? 'check-circle-outline' : 'database-search-outline';
  return <View style={styles.field}><Text style={styles.fieldLabel}>RC number *</Text><View style={styles.rcRow}><View style={[styles.inputShell, styles.rcInputShell, valid && styles.rcInputValid]}><MaterialCommunityIcons name="card-text-outline" size={17} color={valid ? '#0A43A3' : '#6A7A90'} /><TextInput value={value} onChangeText={onChangeText} autoCapitalize="characters" placeholder="MP20AB1234" placeholderTextColor="#9AA7B8" style={styles.input} maxLength={15} /></View><Pressable accessibilityRole="button" disabled={disabled} onPress={onFetch} style={({ pressed }) => [styles.rcFetchButton, !valid && styles.rcFetchButtonInvalid, fetched && styles.rcFetchButtonFetched, pressed && !disabled && styles.rcFetchButtonPressed]}>{loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name={icon} size={17} color={valid || fetched ? '#FFFFFF' : '#7F8EA4'} />}<Text style={[styles.rcFetchText, !valid && styles.rcFetchTextDisabled]}>{label}</Text></Pressable></View>{!valid && normalizeRc(value).length >= 4 ? <Text style={styles.rcHint}>Enter the complete registration number to enable Fetch.</Text> : null}</View>;
}

function InputField({ label, icon, style, required = false, ...props }: React.ComponentProps<typeof TextInput> & { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; required?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}{required ? ' *' : ''}</Text><View style={styles.inputShell}><MaterialCommunityIcons name={icon} size={17} color="#6A7A90" /><TextInput {...props} placeholderTextColor="#9AA7B8" style={[styles.input, style]} /></View></View>;
}

function MaskedCodeField({ label, icon, value, onChangeText }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; value: string; onChangeText: (value: string) => void }) {
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputShell}><MaterialCommunityIcons name={icon} size={17} color="#6A7A90" /><TextInput value={focused ? value : maskAlternateCharacters(value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChangeText={(next) => onChangeText(next.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" placeholder="Optional" placeholderTextColor="#9AA7B8" style={styles.input} /></View></View>;
}

function VehicleTypeDropdown({ value, onSelect, required = false }: { value: string; onSelect: (value: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = vehicleClasses.find((item) => item.value === value);
  return <View style={styles.field}><Text style={styles.fieldLabel}>Vehicle class{required ? ' *' : ''}</Text><Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)} style={styles.selectButton}><View style={styles.selectIcon}><MaterialCommunityIcons name="truck-outline" size={18} color="#0A43A3" /></View><Text style={[styles.selectValue, !selected && styles.placeholder]}>{selected?.label ?? 'Select class'}</Text><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} /></Pressable>{open ? <View style={styles.selectMenu}>{vehicleClasses.map((item) => <Pressable key={item.value} onPress={() => { onSelect(item.value); setOpen(false); }} style={[styles.selectOption, value === item.value && styles.selectOptionActive]}><Text style={[styles.selectOptionText, value === item.value && styles.selectOptionTextActive]}>{item.label}</Text>{value === item.value ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>)}</View> : null}</View>;
}

function YearDropdown({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const maxYear = new Date().getFullYear() + 1;
  const years = useMemo(() => Array.from({ length: maxYear - 1949 }, (_, index) => String(maxYear - index)), [maxYear]);
  return <View style={styles.field}><Text style={styles.fieldLabel}>Manufacturing year *</Text><Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)} style={styles.selectButton}><View style={styles.selectIcon}><MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#0A43A3" /></View><Text style={[styles.selectValue, !value && styles.placeholder]}>{value || 'Select year'}</Text><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} /></Pressable>{open ? <View style={styles.yearMenu}><ScrollView nestedScrollEnabled showsVerticalScrollIndicator>{years.map((item) => <Pressable key={item} onPress={() => { onSelect(item); setOpen(false); }} style={[styles.selectOption, value === item && styles.selectOptionActive]}><Text style={[styles.selectOptionText, value === item && styles.selectOptionTextActive]}>{item}</Text>{value === item ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>)}</ScrollView></View> : null}</View>;
}

function FuelDropdown({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.field}><Text style={styles.fieldLabel}>Fuel type</Text><Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)} style={styles.selectButton}><View style={styles.selectIcon}><MaterialCommunityIcons name="gas-station-outline" size={18} color="#0A43A3" /></View><Text style={[styles.selectValue, !value && styles.placeholder]}>{value || 'Select fuel (optional)'}</Text><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} /></Pressable>{open ? <View style={styles.selectMenu}>{fuelOptions.map((item) => <Pressable key={item} onPress={() => { onSelect(item); setOpen(false); }} style={[styles.selectOption, value === item && styles.selectOptionActive]}><Text style={[styles.selectOptionText, value === item && styles.selectOptionTextActive]}>{item}</Text>{value === item ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>)}</View> : null}</View>;
}

function SearchInsurer({ query, selectedInsurer, companies, onChange, onSelect }: { query: string; selectedInsurer: InsuranceCompany | null; companies: InsuranceCompany[]; onChange: (value: string) => void; onSelect: (company: InsuranceCompany) => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>Insurer</Text><View style={styles.inputShell}><MaterialCommunityIcons name="magnify" size={17} color="#6A7A90" /><TextInput value={query} onChangeText={onChange} placeholder="Search insurer by name" placeholderTextColor="#9AA7B8" style={styles.input} />{selectedInsurer ? <MaterialCommunityIcons name="check-circle" size={18} color="#12805C" /> : null}</View><View style={styles.selectMenu}>{!query.trim() ? <Text style={styles.emptyLookupText}>Type matching letters to search insurer.</Text> : selectedInsurer ? <Text style={styles.emptyLookupText}>Selected: {selectedInsurer.name}</Text> : companies.length ? companies.map((company) => <Pressable key={company.id} accessibilityRole="button" onPress={() => onSelect(company)} style={styles.selectOption}><Text style={styles.selectOptionText} numberOfLines={1}>{company.name}</Text></Pressable>) : <Text style={styles.emptyLookupText}>No matching insurer found.</Text>}</View></View>;
}

function PolicyTypeDropdown({ value, open, onToggle, onSelect }: { value: string; open: boolean; onToggle: () => void; onSelect: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>Policy type</Text><Pressable accessibilityRole="button" onPress={onToggle} style={styles.selectButton}><View style={styles.selectIcon}><MaterialCommunityIcons name="shield-car" size={18} color="#0A43A3" /></View><Text style={styles.selectValue} numberOfLines={1}>{value}</Text><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} /></Pressable>{open ? <View style={styles.selectMenu}>{policyTypeOptions.map((type) => { const active = value === type; return <Pressable key={type} accessibilityRole="button" onPress={() => onSelect(type)} style={[styles.selectOption, active && styles.selectOptionActive]}><Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]} numberOfLines={1}>{type}</Text>{active ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>; })}</View> : null}</View>;
}

function ReadonlyDateField({ label, value }: { label: string; value: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={[styles.dateButton, styles.readonlyDate]}><View style={styles.dateIcon}><MaterialCommunityIcons name="calendar-sync-outline" size={17} color="#0A43A3" /></View><Text style={[styles.dateValue, !value && styles.datePlaceholder]} numberOfLines={1}>{value ? formatDisplayDate(value) : 'Auto after start'}</Text></View></View>;
}

function MoneyField({ label, icon, value, onChangeText }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; value: string; onChangeText: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label} optional</Text><View style={styles.inputShell}><MaterialCommunityIcons name={icon} size={17} color="#12805C" /><Text style={styles.moneyPrefix}>Rs.</Text><TextInput value={value} onChangeText={(next) => onChangeText(next.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#9AA7B8" style={styles.input} /></View></View>;
}

function AccountDropdown({ contexts, selectedCustomerId, open, onToggle, onSelect }: { contexts: CustomerAccountContext[]; selectedCustomerId: string; open: boolean; onToggle: () => void; onSelect: (customerId: string) => void }) {
  const selected = contexts.find((context) => context.customer_id === selectedCustomerId);
  return <View style={styles.accountBlock}><Text style={styles.fieldLabel}>Add for</Text><Pressable accessibilityRole="button" onPress={onToggle} style={styles.dropdownButton}><View style={styles.accountCopy}><Text style={styles.accountTitle} numberOfLines={1}>{selected ? customerAccountTitle(selected) : 'Select customer'}</Text><Text style={styles.accountMeta}>{selected ? `${accountSelectorRoleLabel(selected)} - ${partnerTypeLabel(selected.partner_type)}` : 'Choose where this vehicle belongs'}</Text></View><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={palette.navy} /></Pressable>{open ? <View style={styles.dropdownMenu}>{contexts.map((context) => { const active = context.customer_id === selectedCustomerId; return <Pressable key={context.customer_id} accessibilityRole="button" onPress={() => onSelect(context.customer_id)} style={[styles.dropdownItem, active && styles.dropdownItemActive]}><View style={styles.accountCopy}><Text style={[styles.accountTitle, active && styles.accountTitleActive]} numberOfLines={1}>{customerAccountTitle(context)}</Text><Text style={[styles.accountMeta, active && styles.accountMetaActive]}>{accountSelectorRoleLabel(context)} - {partnerTypeLabel(context.partner_type)}</Text></View>{active ? <MaterialCommunityIcons name="check-circle" size={19} color={palette.navy} /> : null}</Pressable>; })}</View> : null}</View>;
}

function accountSelectorRoleLabel(context: CustomerAccountContext) {
  if (context.group_customer_id || context.access_source === 'group_child') return 'Associated account';
  return 'Parent account';
}

function MakeDropdown({ manufacturers, selectedMake, query, open, onToggle, onQueryChange, onSelect, required = false }: { manufacturers: string[]; selectedMake: string; query: string; open: boolean; onToggle: () => void; onQueryChange: (value: string) => void; onSelect: (make: string) => void; required?: boolean }) {
  const visibleManufacturers = manufacturers.filter((manufacturer) => !query.trim() || manufacturer.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 10);
  return <View style={styles.field}><Text style={styles.fieldLabel}>Manufacturer{required ? ' *' : ''}</Text><Pressable accessibilityRole="button" onPress={onToggle} style={styles.selectButton}><View style={styles.selectIcon}><MaterialCommunityIcons name="factory" size={18} color="#0A43A3" /></View><Text style={[styles.selectValue, !selectedMake && styles.placeholder]} numberOfLines={1}>{selectedMake || 'Select manufacturer'}</Text><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} /></Pressable>{open ? <View style={styles.makeMenu}><View style={styles.makeSearch}><MaterialCommunityIcons name="magnify" size={18} color="#7A8799" /><TextInput value={query} onChangeText={onQueryChange} placeholder="Search make" placeholderTextColor="#8A94A6" style={styles.makeSearchInput} /></View>{manufacturers.length ? visibleManufacturers.map((manufacturer) => { const active = manufacturer === selectedMake; return <Pressable key={manufacturer} accessibilityRole="button" onPress={() => onSelect(manufacturer)} style={[styles.makeOption, active && styles.selectOptionActive]}><Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]} numberOfLines={1}>{manufacturer}</Text>{active ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>; }) : <InputField icon="factory" label="Make" value={selectedMake} onChangeText={onSelect} />}</View> : null}</View>;
}

function PremiumDateField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Pressable accessibilityRole="button" onPress={onPress} style={styles.dateButton}><View style={styles.dateIcon}><MaterialCommunityIcons name="calendar-month-outline" size={17} color="#0A43A3" /></View><Text style={[styles.dateValue, !value && styles.datePlaceholder]} numberOfLines={1}>{value ? formatDisplayDate(value) : 'Select date'}</Text></Pressable></View>;
}

function PremiumCalendarModal({ target, onClose, onSelect }: { target: { label: string; value: string; onChange: (value: string) => void } | null; onClose: () => void; onSelect: (value: string) => void }) {
  const [cursor, setCursor] = useState(() => monthStart(parseDate(target?.value ?? '') ?? new Date()));
  const selected = parseDate(target?.value ?? '');
  const days = useMemo(() => buildMonthDays(cursor), [cursor]);
  useEffect(() => { if (target) setCursor(monthStart(parseDate(target.value) ?? new Date())); }, [target]);
  function moveMonth(delta: number) { setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1)); }
  function moveYear(delta: number) { setCursor((current) => new Date(current.getFullYear() + delta, current.getMonth(), 1)); }
  return <Modal visible={Boolean(target)} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}><View style={styles.calendarScreen}><View pointerEvents="none" style={styles.calendarAccent} /><View style={styles.calendarTopBar}><Pressable accessibilityRole="button" onPress={onClose} style={styles.calendarClose}><MaterialCommunityIcons name="close" size={22} color={palette.navy} /></Pressable><View style={styles.calendarHeadingCopy}><Text style={styles.calendarEyebrow}>Vehicle onboarding</Text><Text style={styles.calendarHeading} numberOfLines={1}>Select {target?.label ?? 'date'}</Text></View></View><View style={styles.calendarHero}><View style={styles.calendarHeroIcon}><MaterialCommunityIcons name="calendar-check-outline" size={27} color="#FFFFFF" /></View><View style={styles.flex}><Text style={styles.calendarHeroTitle}>{target?.label ?? 'Date'}</Text><Text style={styles.calendarHeroText}>{target?.value ? formatDisplayDate(target.value) : 'No date selected yet'}</Text></View></View><View style={styles.calendarCard}><View style={styles.monthControl}><Pressable accessibilityRole="button" onPress={() => moveYear(-1)} style={styles.yearButton}><MaterialCommunityIcons name="chevron-double-left" size={19} color={palette.navy} /></Pressable><Pressable accessibilityRole="button" onPress={() => moveMonth(-1)} style={styles.monthButton}><MaterialCommunityIcons name="chevron-left" size={22} color={palette.navy} /></Pressable><View style={styles.monthTitleWrap}><Text style={styles.monthTitle}>{cursor.toLocaleDateString('en-IN', { month: 'long' })}</Text><Text style={styles.yearTitle}>{cursor.getFullYear()}</Text></View><Pressable accessibilityRole="button" onPress={() => moveMonth(1)} style={styles.monthButton}><MaterialCommunityIcons name="chevron-right" size={22} color={palette.navy} /></Pressable><Pressable accessibilityRole="button" onPress={() => moveYear(1)} style={styles.yearButton}><MaterialCommunityIcons name="chevron-double-right" size={19} color={palette.navy} /></Pressable></View><View style={styles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((item, index) => <Text key={`${item}-${index}`} style={styles.weekDay}>{item}</Text>)}</View><View style={styles.calendarGrid}>{days.map((day, index) => { const isSelected = Boolean(selected && sameDate(selected, day.date)); return <Pressable key={`${day.date.toISOString()}-${index}`} accessibilityRole="button" onPress={() => onSelect(formatIsoDate(day.date))} style={[styles.dayCell, !day.inMonth && styles.dayMuted, isSelected && styles.daySelected]}><Text style={[styles.dayText, !day.inMonth && styles.dayTextMuted, isSelected && styles.dayTextSelected]}>{day.date.getDate()}</Text></Pressable>; })}</View></View><View style={styles.calendarFooter}><Pressable accessibilityRole="button" onPress={() => onSelect(formatIsoDate(new Date()))} style={styles.todayButton}><Text style={styles.todayButtonText}>Use Today</Text></Pressable><Pressable accessibilityRole="button" onPress={onClose} style={styles.doneButton}><Text style={styles.doneButtonText}>Done</Text></Pressable></View></View></Modal>;
}

function normalizeRc(value: string) { return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }
function isValidIndianRegistrationNumber(value: string) { if (/^\d{2}BH\d{4}[A-Z]{2}$/.test(value)) return true; return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(value) && value.length >= 7 && value.length <= 12; }
function normalizeManufacturer(value: string) { return value.toUpperCase().replace(/&/g, ' AND ').replace(/\b(PRIVATE|PVT|LIMITED|LTD|MOTORS?|AUTOMOBILES?|AUTOMOTIVE|INDIA|COMPANY|CO)\b/g, ' ').replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim(); }
function resolveManufacturer(providerValue: string, manufacturers: string[]) {
  const provider = normalizeManufacturer(providerValue);
  if (!provider) return null;
  const exact = manufacturers.find((item) => normalizeManufacturer(item) === provider);
  if (exact) return exact;
  const candidates = manufacturers.filter((item) => { const normalized = normalizeManufacturer(item); return normalized.length >= 3 && (provider.includes(normalized) || normalized.includes(provider)); });
  return candidates.length === 1 ? candidates[0] : null;
}
function cleanProviderModel(model: string, manufacturer: string | null) {
  let next = model.replace(/\s+/g, ' ').trim();
  if (manufacturer) {
    const makerWords = manufacturer.split(/\s+/).filter((word) => word.length >= 3);
    for (const word of makerWords) next = next.replace(new RegExp(`^${escapeRegExp(word)}\\s+`, 'i'), '');
  }
  return next.trim() || model.trim();
}
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function maskAlternateCharacters(value: string) { return value.split('').map((char, index) => index % 2 === 1 ? '•' : char).join(''); }
function complianceKeysForVehicleType(vehicleType: string): ComplianceKey[] {
  if (vehicleType === 'TWP') return ['road_tax'];
  if (vehicleType === 'PCP') return ['puc', 'road_tax'];
  if (vehicleType === 'GCV' || vehicleType === 'PCV') return ['fitness', 'puc', 'road_tax', 'national_permit', 'local_permit'];
  if (vehicleType === 'CPM') return ['fitness', 'road_tax', 'national_permit', 'local_permit'];
  if (vehicleType === 'MISD') return ['fitness', 'puc', 'road_tax'];
  return ['fitness', 'puc', 'road_tax', 'national_permit', 'local_permit'];
}
function capacityFieldForVehicleType(vehicleType: string, state: { gvwKg: string; engineCapacityCc: string; seatingCapacity: string; setGvwKg: (value: string) => void; setEngineCapacityCc: (value: string) => void; setSeatingCapacity: (value: string) => void }) {
  if (vehicleType === 'PCV') return { label: 'Seating capacity', icon: 'seat-passenger' as const, value: state.seatingCapacity, keyboardType: 'number-pad' as const, onChangeText: (value: string) => state.setSeatingCapacity(value.replace(/[^0-9]/g, '')) };
  if (vehicleType === 'GCV' || vehicleType === 'CPM') return { label: 'GVW (KG)', icon: 'weight-kilogram' as const, value: state.gvwKg, keyboardType: 'decimal-pad' as const, onChangeText: (value: string) => state.setGvwKg(value.replace(/[^0-9.]/g, '')) };
  return { label: 'Engine capacity (CC)', icon: 'engine-outline' as const, value: state.engineCapacityCc, keyboardType: 'decimal-pad' as const, onChangeText: (value: string) => state.setEngineCapacityCc(value.replace(/[^0-9.]/g, '')) };
}
function cleanDate(value: string) { const next = value.trim(); return next ? next : null; }
function cleanCode(value: string) { const next = value.replace(/\s/g, '').toUpperCase(); return next ? next : null; }
async function uploadPolicyCopy(customerId: string, file: PickedPolicyCopy, userId: string) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const storagePath = `${customerId}/policy-copy/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  try {
    const body = await (await fetch(file.uri)).arrayBuffer();
    const uploadResult = await supabase.storage.from('customer-documents').upload(storagePath, body, { contentType: file.mimeType ?? 'application/octet-stream', upsert: false });
    if (uploadResult.error) return uploadResult.error.message;
    const recordResult = await supabase.from('customer_documents').insert({ customer_id: customerId, document_type: 'policy_copy', file_name: file.name, storage_bucket: 'customer-documents', storage_path: storagePath, mime_type: file.mimeType, file_size: file.size, uploaded_by: userId });
    if (recordResult.error) { await supabase.storage.from('customer-documents').remove([storagePath]); return recordResult.error.message; }
    return null;
  } catch (error) { return error instanceof Error ? error.message : 'Upload failed.'; }
}
function defaultPolicyEndDate(startIso: string) { const start = parseDate(startIso); if (!start) return ''; const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()); end.setDate(end.getDate() - 1); return formatIsoDate(end); }
function isMissingVehicleRpcSignature(error: { code?: string; message?: string } | null | undefined, functionName: string) { const message = error?.message?.toLowerCase() ?? ''; return error?.code === 'PGRST202' || (message.includes(functionName.toLowerCase()) && (message.includes('schema cache') || message.includes('could not find the function'))); }
function parseDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const [year, month, day] = value.split('-').map(Number); const parsed = new Date(year, month - 1, day); if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null; return parsed; }
function monthStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function buildMonthDays(month: Date) { const first = monthStart(month); const start = new Date(first); start.setDate(first.getDate() - first.getDay()); return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { date, inMonth: date.getMonth() === month.getMonth() }; }); }
function sameDate(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function formatIsoDate(date: Date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
function formatDisplayDate(value: string) { const parsed = parseDate(value); return parsed ? parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : value; }

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  modalEyebrow: { color: '#8A5B16', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7, marginBottom: 2 },
  modalSub: { color: palette.slate, fontSize: 11.2, lineHeight: 16, fontWeight: '700', marginTop: 2, maxWidth: 290 },
  modalClose: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  compactTitle: { color: palette.navy, fontSize: 16, fontWeight: '800', marginBottom: 6, marginTop: 0, letterSpacing: 0 },
  formCard: { borderRadius: 18, padding: 12, gap: 12, backgroundColor: '#F8FBFF', borderColor: '#CFE0F8', overflow: 'hidden' },
  formAccentOne: { position: 'absolute', right: -28, top: -18, width: 110, height: 58, borderRadius: 18, backgroundColor: 'rgba(10,67,163,0.08)', transform: [{ rotate: '-10deg' }] },
  formAccentTwo: { position: 'absolute', left: -20, bottom: 80, width: 86, height: 48, borderRadius: 16, backgroundColor: 'rgba(18,128,92,0.08)', transform: [{ rotate: '12deg' }] },
  accountBlock: { gap: 6 },
  accountPill: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F8FBFF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  accountPillLabel: { color: '#607089', fontSize: 9.5, fontWeight: '700' },
  accountPillTitle: { color: palette.navy, fontSize: 12, fontWeight: '800', marginTop: 1 },
  section: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: 'rgba(255,255,255,0.94)', overflow: 'hidden', shadowColor: '#0A43A3', shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 },
  vehicleSection: { borderColor: '#B8D4F7', backgroundColor: '#EEF6FF' },
  identitySection: { borderColor: '#D9CCF8', backgroundColor: '#F6F2FF' },
  operationalSection: { borderColor: '#B9E6D0', backgroundColor: '#EFFAF5' },
  policySection: { borderColor: '#F1D1A6', backgroundColor: '#FFF7EC' },
  sectionHeader: { minHeight: 42, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F7FF', borderBottomWidth: 1, borderBottomColor: '#E1ECF8' },
  vehicleSectionHeader: { backgroundColor: '#DDEEFF', borderBottomColor: '#B8D4F7' },
  identitySectionHeader: { backgroundColor: '#EEE7FF', borderBottomColor: '#D9CCF8' },
  operationalSectionHeader: { backgroundColor: '#DCF6EA', borderBottomColor: '#B9E6D0' },
  policySectionHeader: { backgroundColor: '#FFECD0', borderBottomColor: '#F1D1A6' },
  sectionIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  vehicleSectionIcon: { backgroundColor: '#FFFFFF', borderColor: '#B8D4F7' },
  identitySectionIcon: { backgroundColor: '#FFFFFF', borderColor: '#D9CCF8' },
  operationalSectionIcon: { backgroundColor: '#FFFFFF', borderColor: '#B9E6D0' },
  policySectionIcon: { backgroundColor: '#FFFFFF', borderColor: '#F1D1A6' },
  sectionTitle: { color: palette.navy, fontSize: 13, fontWeight: '800', letterSpacing: 0 },
  sectionBody: { padding: 11, gap: 10 },
  field: { gap: 5 },
  fieldLabel: { color: '#3F4D63', fontSize: 10.5, fontWeight: '700', letterSpacing: 0 },
  inputShell: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FBFDFF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  input: { flex: 1, minHeight: 43, color: palette.navy, fontSize: 12.6, fontWeight: '600', letterSpacing: 0 },
  rcRow: { flexDirection: 'row', gap: 7, alignItems: 'stretch' },
  rcInputShell: { flex: 1, minWidth: 0 },
  rcInputValid: { borderColor: '#9EC4F3', backgroundColor: '#FFFFFF' },
  rcFetchButton: { minWidth: 88, minHeight: 45, borderRadius: 12, backgroundColor: '#0A43A3', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  rcFetchButtonInvalid: { backgroundColor: '#E8EEF5', borderWidth: 1, borderColor: '#D5DFEA' },
  rcFetchButtonFetched: { backgroundColor: '#12805C' },
  rcFetchButtonPressed: { opacity: 0.84, transform: [{ scale: 0.97 }] },
  rcFetchText: { color: '#FFFFFF', fontSize: 10.4, fontWeight: '900' },
  rcFetchTextDisabled: { color: '#7F8EA4' },
  rcHint: { color: '#6E7C90', fontSize: 9.8, lineHeight: 13, fontWeight: '600' },
  rcStatus: { minHeight: 40, borderRadius: 11, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7 },
  rcStatusSuccess: { backgroundColor: '#EFFAF5', borderColor: '#B9E6D0' },
  rcStatusError: { backgroundColor: '#FFF4F2', borderColor: '#F0C3BC' },
  rcStatusInfo: { backgroundColor: '#EEF6FF', borderColor: '#B8D4F7' },
  rcStatusText: { flex: 1, color: '#526176', fontSize: 10.2, lineHeight: 14, fontWeight: '700' },
  twoColumnRow: { flexDirection: 'row', gap: 9 },
  column: { flex: 1, minWidth: 0 },
  columnWide: { flex: 1.12, minWidth: 0 },
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  dateCell: { width: '48.5%' },
  selectButton: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FBFDFF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  selectIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  selectValue: { flex: 1, color: palette.navy, fontSize: 12.1, fontWeight: '700' },
  placeholder: { color: '#7A8798' },
  selectMenu: { borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  yearMenu: { maxHeight: 228, borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  selectOption: { minHeight: 43, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  selectOptionActive: { backgroundColor: '#EEF5FF' },
  selectOptionText: { flex: 1, color: '#607089', fontSize: 11.5, fontWeight: '700' },
  selectOptionTextActive: { color: palette.navy, fontWeight: '800' },
  emptyLookupText: { color: '#7A8799', fontSize: 11, fontWeight: '700', paddingHorizontal: 11, paddingVertical: 12 },
  dropdownButton: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F8FBFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownMenu: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  dropdownItem: { minHeight: 54, paddingHorizontal: 11, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownItemActive: { backgroundColor: '#EEF5FF' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountTitle: { color: palette.ink, fontSize: 12.5, fontWeight: '800' },
  accountTitleActive: { color: palette.navy },
  accountMeta: { color: palette.slate, fontSize: 10, fontWeight: '700', marginTop: 2 },
  accountMetaActive: { color: '#315C99' },
  makeMenu: { borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  makeSearch: { minHeight: 42, backgroundColor: '#F8FBFF', borderBottomWidth: 1, borderBottomColor: '#E8EFF7', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  makeSearchInput: { flex: 1, minHeight: 40, color: palette.navy, fontSize: 12.5, fontWeight: '600' },
  makeOption: { minHeight: 42, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  dateButton: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F7FBFF', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  readonlyDate: { backgroundColor: '#F3F8FC' },
  dateIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  dateValue: { flex: 1, color: palette.navy, fontSize: 11.5, fontWeight: '700' },
  datePlaceholder: { color: '#7F8EA4', fontWeight: '600' },
  moneyPrefix: { color: '#12805C', fontSize: 11, fontWeight: '900' },
  policyCopyButton: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: '#B8D4F7', backgroundColor: '#F8FBFF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  policyCopyTitle: { color: palette.navy, fontSize: 11.5, fontWeight: '900' },
  policyCopyText: { color: '#607089', fontSize: 10, fontWeight: '700', marginTop: 2 },
  policyHintBox: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F8FBFF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  policyHintText: { flex: 1, color: '#607089', fontSize: 10.3, lineHeight: 14, fontWeight: '700' },
  calendarScreen: { flex: 1, backgroundColor: '#EEF7FF', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 },
  calendarAccent: { position: 'absolute', left: -70, right: -70, top: 118, height: 120, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.64)', transform: [{ rotate: '-7deg' }] },
  calendarTopBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  calendarClose: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE0F8', alignItems: 'center', justifyContent: 'center' },
  calendarHeadingCopy: { flex: 1, minWidth: 0 },
  calendarEyebrow: { color: '#607089', fontSize: 10.5, fontWeight: '700' },
  calendarHeading: { color: palette.navy, fontSize: 20, lineHeight: 25, fontWeight: '800', marginTop: 1 },
  calendarHero: { minHeight: 78, borderRadius: 20, backgroundColor: palette.navy, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, shadowColor: palette.navy, shadowOpacity: 0.16, shadowRadius: 13, elevation: 4 },
  calendarHeroIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  calendarHeroTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  calendarHeroText: { color: '#CFE0F8', fontSize: 11.5, fontWeight: '600', marginTop: 3 },
  calendarCard: { flex: 1, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', marginTop: 14, padding: 14, shadowColor: '#0A43A3', shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  monthControl: { minHeight: 52, borderRadius: 18, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 13 },
  monthButton: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  yearButton: { width: 31, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monthTitleWrap: { flex: 1, alignItems: 'center' },
  monthTitle: { color: palette.navy, fontSize: 16, lineHeight: 20, fontWeight: '800' },
  yearTitle: { color: '#607089', fontSize: 11, fontWeight: '700', marginTop: 1 },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', color: '#607089', fontSize: 12, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 15, marginVertical: 2 },
  dayMuted: { opacity: 0.34 },
  daySelected: { backgroundColor: '#0A43A3', shadowColor: '#0A43A3', shadowOpacity: 0.18, shadowRadius: 8, elevation: 2 },
  dayText: { color: palette.navy, fontSize: 14, fontWeight: '700' },
  dayTextMuted: { color: '#7F8EA4' },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '900' },
  calendarFooter: { flexDirection: 'row', gap: 10, marginTop: 14 },
  todayButton: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: '#B8D4F7', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  todayButtonText: { color: palette.navy, fontSize: 13, fontWeight: '800' },
  doneButton: { flex: 1, minHeight: 50, borderRadius: 15, backgroundColor: '#0A43A3', alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
