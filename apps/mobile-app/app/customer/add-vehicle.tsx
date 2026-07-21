import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Message, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, isPortfolioCustomerContext, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany } from '@/lib/types';

type VehicleKind = 'Commercial Vehicle' | 'Private Vehicle';

const vehicleTypes: VehicleKind[] = ['Commercial Vehicle', 'Private Vehicle'];
const policyTypes = ['Commercial comprehensive', 'Third party', 'Own damage', 'Package policy'];

export default function AddVehicleScreen() {
  const router = useRouter();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [makeOpen, setMakeOpen] = useState(false);
  const [makeQuery, setMakeQuery] = useState('');
  const [insurerOpen, setInsurerOpen] = useState(false);
  const [policyTypeOpen, setPolicyTypeOpen] = useState(false);
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleKind>('Commercial Vehicle');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [chassisNo, setChassisNo] = useState('');
  const [engineNo, setEngineNo] = useState('');
  const [permitNo, setPermitNo] = useState('');
  const [gvwKg, setGvwKg] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [fitnessExpiryDate, setFitnessExpiryDate] = useState('');
  const [pucExpiryDate, setPucExpiryDate] = useState('');
  const [roadTaxExpiryDate, setRoadTaxExpiryDate] = useState('');
  const [nationalPermitExpiryDate, setNationalPermitExpiryDate] = useState('');
  const [localPermitExpiryDate, setLocalPermitExpiryDate] = useState('');
  const [policyInsurerId, setPolicyInsurerId] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [policyIdv, setPolicyIdv] = useState('');
  const [policyStartDate, setPolicyStartDate] = useState('');
  const [policyEndDate, setPolicyEndDate] = useState('');
  const [policyPremium, setPolicyPremium] = useState('');
  const [policyType, setPolicyType] = useState(policyTypes[0]);
  const [dateTarget, setDateTarget] = useState<{ label: string; value: string; onChange: (value: string) => void } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isCommercial = vehicleType === 'Commercial Vehicle';
  const selectedContext = contexts.find((context) => context.customer_id === selectedCustomerId) ?? null;
  const selectedInsurer = insurers.find((insurer) => insurer.id === policyInsurerId) ?? null;
  const hasPolicyDetails = Boolean(
    policyInsurerId ||
    policyNo.trim() ||
    policyIdv.trim() ||
    policyStartDate ||
    policyEndDate ||
    policyPremium.trim() ||
    (policyType && policyType !== policyTypes[0])
  );
  const visibleDateFields = useMemo(() => {
    const common = [
      { key: 'registration', label: 'Registration', value: registrationDate, onChange: setRegistrationDate },
      { key: 'puc', label: 'PUC expiry', value: pucExpiryDate, onChange: setPucExpiryDate },
    ];
    if (!isCommercial) return common;
    return [
      ...common,
      { key: 'fitness', label: 'Fitness expiry', value: fitnessExpiryDate, onChange: setFitnessExpiryDate },
      { key: 'road_tax', label: 'Road tax expiry', value: roadTaxExpiryDate, onChange: setRoadTaxExpiryDate },
      { key: 'national_permit', label: 'National permit', value: nationalPermitExpiryDate, onChange: setNationalPermitExpiryDate },
      { key: 'local_permit', label: 'Local permit', value: localPermitExpiryDate, onChange: setLocalPermitExpiryDate },
    ];
  }, [fitnessExpiryDate, isCommercial, localPermitExpiryDate, nationalPermitExpiryDate, pucExpiryDate, registrationDate, roadTaxExpiryDate]);

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
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    let active = true;
    async function loadLookups() {
      const [manufacturerResult, insurerResult] = await Promise.all([
        supabase
        .from('vehicle_manufacturers')
        .select('name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase.from('insurance_companies').select('*').order('name'),
      ]);
      if (!active) return;
      if (manufacturerResult.error) {
        setManufacturers([]);
      } else {
        setManufacturers((manufacturerResult.data ?? []).map((item) => item.name).filter(Boolean));
      }
      setInsurers((insurerResult.data ?? []) as InsuranceCompany[]);
    }
    void loadLookups();
    return () => {
      active = false;
    };
  }, []);

  function chooseVehicleType(nextType: VehicleKind) {
    setVehicleType(nextType);
    if (nextType === 'Private Vehicle') {
      setGvwKg('');
      setPermitNo('');
      setFitnessExpiryDate('');
      setRoadTaxExpiryDate('');
      setNationalPermitExpiryDate('');
      setLocalPermitExpiryDate('');
    }
  }

  async function save() {
    setMessage('');
    if (saving) return;
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const target = contexts.find((context) => context.customer_id === selectedCustomerId);
    if (!target) return setMessage('Select the customer account for this vehicle.');
    if (!vehicleNo.trim()) return setMessage('Enter the vehicle number.');
    if (!vehicleType.trim()) return setMessage('Select the vehicle type.');
    if (!make.trim()) return setMessage('Select the vehicle manufacturer.');
    const parsedYear = year ? Number(year) : null;
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > new Date().getFullYear() + 1)) return setMessage('Enter a valid manufacturing year.');
    const parsedGvw = isCommercial && gvwKg ? Number(gvwKg) : null;
    if (parsedGvw !== null && (!Number.isFinite(parsedGvw) || parsedGvw <= 0)) return setMessage('Enter a valid GVW.');
    const policyIdvValue = policyIdv ? Number(policyIdv) : null;
    if (policyIdvValue !== null && (!Number.isFinite(policyIdvValue) || policyIdvValue < 0)) return setMessage('Enter a valid policy IDV.');
    const policyPremiumValue = policyPremium ? Number(policyPremium) : null;
    if (policyPremiumValue !== null && (!Number.isFinite(policyPremiumValue) || policyPremiumValue < 0)) return setMessage('Enter a valid policy premium.');
    if (hasPolicyDetails) {
      if (!policyInsurerId) return setMessage('Select the policy insurer.');
      if (!policyNo.trim()) return setMessage('Enter the policy number.');
      if (!policyType.trim()) return setMessage('Select the policy type.');
      if (!policyStartDate || !policyEndDate) return setMessage('Select the policy start and end dates.');
      if (new Date(policyEndDate).getTime() < new Date(policyStartDate).getTime()) return setMessage('Policy end date must be after the start date.');
    }

    const rpcPayload = {
      p_customer_id: target.customer_id,
      p_vehicle_no: vehicleNo.trim().toUpperCase(),
      p_vehicle_type: vehicleType,
      p_make: make.trim(),
      p_model: model.trim() || null,
      p_year: parsedYear,
      p_chassis_no: cleanCode(chassisNo),
      p_engine_no: cleanCode(engineNo),
      p_permit_no: isCommercial ? cleanCode(permitNo) : null,
      p_gvw_kg: parsedGvw,
      p_registration_date: cleanDate(registrationDate),
      p_fitness_expiry_date: isCommercial ? cleanDate(fitnessExpiryDate) : null,
      p_puc_expiry_date: cleanDate(pucExpiryDate),
      p_road_tax_expiry_date: isCommercial ? cleanDate(roadTaxExpiryDate) : null,
      p_national_permit_expiry_date: isCommercial ? cleanDate(nationalPermitExpiryDate) : null,
      p_local_permit_expiry_date: isCommercial ? cleanDate(localPermitExpiryDate) : null,
    };

    setSaving(true);
    let { data: vehicleData, error } = await (supabase.rpc as any)('create_customer_vehicle', rpcPayload);
    if (isMissingVehicleRpcSignature(error)) {
      console.warn('create_customer_vehicle extended signature is unavailable; retrying legacy signature');
      const fallback = await (supabase.rpc as any)('create_customer_vehicle', {
        p_customer_id: rpcPayload.p_customer_id,
        p_vehicle_no: rpcPayload.p_vehicle_no,
        p_vehicle_type: rpcPayload.p_vehicle_type,
        p_make: rpcPayload.p_make,
        p_model: rpcPayload.p_model,
        p_year: rpcPayload.p_year,
      });
      vehicleData = fallback.data;
      error = fallback.error;
    }
    if (!error && hasPolicyDetails) {
      const policyPayload = {
        p_customer_id: target.customer_id,
        p_vehicle_id: vehicleData?.id,
        p_insurance_company_id: policyInsurerId,
        p_policy_no: policyNo.trim().toUpperCase(),
        p_policy_type: policyType.trim(),
        p_start_date: policyStartDate,
        p_end_date: policyEndDate,
        p_premium_amount: policyPremiumValue,
        p_insured_declared_value: policyIdvValue,
      };
      if (!policyPayload.p_vehicle_id) {
        error = { message: 'Vehicle saved, but policy details could not be linked. Please add the policy from the policy page.' };
      } else {
        let policyResult = await (supabase.rpc as any)('create_customer_policy', policyPayload);
        if (isMissingPolicyRpcSignature(policyResult.error)) {
          const { p_insured_declared_value, ...legacyPolicyPayload } = policyPayload;
          policyResult = await (supabase.rpc as any)('create_customer_policy', legacyPolicyPayload);
        }
        error = policyResult.error;
      }
    }
    setSaving(false);
    if (error) setMessage(error.message || 'We could not save this vehicle. Please try again.');
    else router.replace(contexts.some(isPortfolioCustomerContext) ? '/customer/group/fleet' : '/customer/vehicles');
  }

  return (
    <Screen title="Add Vehicle" showLogout showTitleHeader={false}>
      <Text style={styles.compactTitle}>Add Vehicle</Text>
      <Card style={styles.formCard}>
        <View pointerEvents="none" style={styles.formAccentOne} />
        <View pointerEvents="none" style={styles.formAccentTwo} />
        {message ? <Message type="error">{message}</Message> : null}
        {contexts.length > 1 ? <AccountDropdown contexts={contexts} selectedCustomerId={selectedCustomerId} open={accountOpen} onToggle={() => setAccountOpen((value) => !value)} onSelect={(customerId) => { setSelectedCustomerId(customerId); setAccountOpen(false); }} /> : null}
        {selectedContext && contexts.length <= 1 ? <View style={styles.accountPill}><MaterialCommunityIcons name="office-building-outline" size={17} color="#0A43A3" /><View style={styles.flex}><Text style={styles.accountPillLabel}>Add for</Text><Text style={styles.accountPillTitle}>{customerAccountTitle(selectedContext)}</Text></View></View> : null}

        <FormSection title="Vehicle details" icon="truck-outline" tone="vehicle">
          <View style={styles.twoColumnRow}>
            <View style={styles.columnWide}><InputField icon="card-text-outline" label="Vehicle number" value={vehicleNo} onChangeText={(value) => setVehicleNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" /></View>
            <View style={styles.column}><VehicleTypeDropdown value={vehicleType} onSelect={chooseVehicleType} /></View>
          </View>
          <MakeDropdown manufacturers={manufacturers} selectedMake={make} query={makeQuery} open={makeOpen} onToggle={() => setMakeOpen((value) => !value)} onQueryChange={setMakeQuery} onSelect={(value) => { setMake(value); setMakeQuery(value); setMakeOpen(false); }} />
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><InputField icon="car-info" label="Model" value={model} onChangeText={setModel} /></View>
            <View style={styles.column}><InputField icon="calendar-blank-outline" label="Year" keyboardType="number-pad" value={year} onChangeText={(value) => setYear(value.replace(/\D/g, '').slice(0, 4))} /></View>
          </View>
        </FormSection>

        <FormSection title="Vehicle identity" icon="identifier" tone="identity">
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><InputField icon="barcode" label="Chassis no." value={chassisNo} onChangeText={(value) => setChassisNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" /></View>
            <View style={styles.column}><InputField icon="engine-outline" label="Engine no." value={engineNo} onChangeText={(value) => setEngineNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" /></View>
          </View>
        </FormSection>

        <FormSection title="Operational details" icon="clipboard-pulse-outline" tone="operational">
          {isCommercial ? <View style={styles.twoColumnRow}>
            <View style={styles.column}><InputField icon="weight-kilogram" label="GVW (kg)" keyboardType="decimal-pad" value={gvwKg} onChangeText={(value) => setGvwKg(value.replace(/[^0-9.]/g, ''))} /></View>
            <View style={styles.column}><InputField icon="file-certificate-outline" label="Permit no." value={permitNo} onChangeText={(value) => setPermitNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" /></View>
          </View> : null}
          <View style={styles.dateGrid}>
            {visibleDateFields.map((field) => (
              <View key={field.key} style={styles.dateCell}>
                <PremiumDateField label={field.label} value={field.value} onPress={() => setDateTarget(field)} />
              </View>
            ))}
          </View>
        </FormSection>

        <FormSection title="Optional policy details" icon="shield-check-outline" tone="policy">
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><InsurerDropdown insurers={insurers} selectedInsurer={selectedInsurer} open={insurerOpen} onToggle={() => setInsurerOpen((value) => !value)} onSelect={(insurer) => { setPolicyInsurerId(insurer.id); setInsurerOpen(false); }} /></View>
            <View style={styles.column}><InputField icon="file-document-outline" label="Policy no." value={policyNo} onChangeText={(value) => setPolicyNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" /></View>
          </View>
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><InputField icon="cash-multiple" label="IDV" keyboardType="decimal-pad" value={policyIdv} onChangeText={(value) => setPolicyIdv(value.replace(/[^0-9.]/g, ''))} /></View>
            <View style={styles.column}><InputField icon="currency-inr" label="Premium" keyboardType="decimal-pad" value={policyPremium} onChangeText={(value) => setPolicyPremium(value.replace(/[^0-9.]/g, ''))} /></View>
          </View>
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><PremiumDateField label="Start date" value={policyStartDate} onPress={() => setDateTarget({ label: 'Policy start date', value: policyStartDate, onChange: setPolicyStartDate })} /></View>
            <View style={styles.column}><PremiumDateField label="End date" value={policyEndDate} onPress={() => setDateTarget({ label: 'Policy end date', value: policyEndDate, onChange: setPolicyEndDate })} /></View>
          </View>
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><PolicyTypeDropdown value={policyType} open={policyTypeOpen} onToggle={() => setPolicyTypeOpen((value) => !value)} onSelect={(value) => { setPolicyType(value); setPolicyTypeOpen(false); }} /></View>
            <View style={styles.column}><View style={styles.policyHintBox}><MaterialCommunityIcons name="information-outline" size={16} color="#0A43A3" /><Text style={styles.policyHintText}>Skip this section if policy is not ready.</Text></View></View>
          </View>
        </FormSection>

        <Button label={saving ? 'Saving vehicle...' : 'Save vehicle'} onPress={save} disabled={saving} />
        {saving ? <ActivityIndicator color={palette.navy} /> : null}
      </Card>
      <PremiumCalendarModal
        target={dateTarget}
        onClose={() => setDateTarget(null)}
        onSelect={(value) => {
          dateTarget?.onChange(value);
          setDateTarget(null);
        }}
      />
    </Screen>
  );
}

function FormSection({ title, icon, tone = 'default', children }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone?: 'default' | 'vehicle' | 'identity' | 'operational' | 'policy'; children: React.ReactNode }) {
  return (
    <View style={[styles.section, tone === 'vehicle' && styles.vehicleSection, tone === 'identity' && styles.identitySection, tone === 'operational' && styles.operationalSection, tone === 'policy' && styles.policySection]}>
      <View style={[styles.sectionHeader, tone === 'vehicle' && styles.vehicleSectionHeader, tone === 'identity' && styles.identitySectionHeader, tone === 'operational' && styles.operationalSectionHeader, tone === 'policy' && styles.policySectionHeader]}>
        <View style={[styles.sectionIcon, tone === 'vehicle' && styles.vehicleSectionIcon, tone === 'identity' && styles.identitySectionIcon, tone === 'operational' && styles.operationalSectionIcon, tone === 'policy' && styles.policySectionIcon]}><MaterialCommunityIcons name={icon} size={18} color="#0A43A3" /></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InputField({ label, icon, style, ...props }: React.ComponentProps<typeof TextInput> & { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <MaterialCommunityIcons name={icon} size={17} color="#6A7A90" />
        <TextInput {...props} placeholderTextColor="#9AA7B8" style={[styles.input, style]} />
      </View>
    </View>
  );
}

function VehicleTypeDropdown({ value, onSelect }: { value: VehicleKind; onSelect: (value: VehicleKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Vehicle type</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)} style={styles.selectButton}>
        <View style={styles.selectIcon}><MaterialCommunityIcons name={value === 'Commercial Vehicle' ? 'truck-outline' : 'car-outline'} size={18} color="#0A43A3" /></View>
        <Text style={styles.selectValue}>{value}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.selectMenu}>{vehicleTypes.map((type) => <Pressable key={type} onPress={() => { onSelect(type); setOpen(false); }} style={[styles.selectOption, value === type && styles.selectOptionActive]}><Text style={[styles.selectOptionText, value === type && styles.selectOptionTextActive]}>{type}</Text>{value === type ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>)}</View> : null}
    </View>
  );
}

function AccountDropdown({ contexts, selectedCustomerId, open, onToggle, onSelect }: { contexts: CustomerAccountContext[]; selectedCustomerId: string; open: boolean; onToggle: () => void; onSelect: (customerId: string) => void }) {
  const selected = contexts.find((context) => context.customer_id === selectedCustomerId);
  return (
    <View style={styles.accountBlock}>
      <Text style={styles.fieldLabel}>Add for</Text>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.dropdownButton}>
        <View style={styles.accountCopy}>
          <Text style={styles.accountTitle} numberOfLines={1}>{selected ? customerAccountTitle(selected) : 'Select customer'}</Text>
          <Text style={styles.accountMeta}>{selected ? `${accountSelectorRoleLabel(selected)} - ${partnerTypeLabel(selected.partner_type)}` : 'Choose where this vehicle belongs'}</Text>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.dropdownMenu}>{contexts.map((context) => {
        const active = context.customer_id === selectedCustomerId;
        return <Pressable key={context.customer_id} accessibilityRole="button" onPress={() => onSelect(context.customer_id)} style={[styles.dropdownItem, active && styles.dropdownItemActive]}>
          <View style={styles.accountCopy}>
            <Text style={[styles.accountTitle, active && styles.accountTitleActive]} numberOfLines={1}>{customerAccountTitle(context)}</Text>
            <Text style={[styles.accountMeta, active && styles.accountMetaActive]}>{accountSelectorRoleLabel(context)} - {partnerTypeLabel(context.partner_type)}</Text>
          </View>
          {active ? <MaterialCommunityIcons name="check-circle" size={19} color={palette.navy} /> : null}
        </Pressable>;
      })}</View> : null}
    </View>
  );
}

function accountSelectorRoleLabel(context: CustomerAccountContext) {
  if (context.group_customer_id || context.access_source === 'group_child') return 'Associated account';
  return 'Parent account';
}

function MakeDropdown({ manufacturers, selectedMake, query, open, onToggle, onQueryChange, onSelect }: { manufacturers: string[]; selectedMake: string; query: string; open: boolean; onToggle: () => void; onQueryChange: (value: string) => void; onSelect: (make: string) => void }) {
  const visibleManufacturers = manufacturers.filter((manufacturer) => !query.trim() || manufacturer.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 10);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Make</Text>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.selectButton}>
        <View style={styles.selectIcon}><MaterialCommunityIcons name="factory" size={18} color="#0A43A3" /></View>
        <Text style={[styles.selectValue, !selectedMake && styles.placeholder]} numberOfLines={1}>{selectedMake || 'Select manufacturer'}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.makeMenu}>
        <View style={styles.makeSearch}><MaterialCommunityIcons name="magnify" size={18} color="#7A8799" /><TextInput value={query} onChangeText={onQueryChange} placeholder="Search make" placeholderTextColor="#8A94A6" style={styles.makeSearchInput} /></View>
        {manufacturers.length ? visibleManufacturers.map((manufacturer) => {
          const active = manufacturer === selectedMake;
          return <Pressable key={manufacturer} accessibilityRole="button" onPress={() => onSelect(manufacturer)} style={[styles.makeOption, active && styles.selectOptionActive]}><Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]} numberOfLines={1}>{manufacturer}</Text>{active ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>;
        }) : <InputField icon="factory" label="Make" value={selectedMake} onChangeText={onSelect} />}
      </View> : null}
    </View>
  );
}

function InsurerDropdown({ insurers, selectedInsurer, open, onToggle, onSelect }: { insurers: InsuranceCompany[]; selectedInsurer: InsuranceCompany | null; open: boolean; onToggle: () => void; onSelect: (insurer: InsuranceCompany) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Insurer</Text>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.selectButton}>
        <View style={styles.selectIcon}><MaterialCommunityIcons name="shield-check-outline" size={18} color="#0A43A3" /></View>
        <Text style={[styles.selectValue, !selectedInsurer && styles.placeholder]} numberOfLines={1}>{selectedInsurer?.name ?? 'Select insurer'}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.selectMenu}>{insurers.length ? insurers.slice(0, 12).map((insurer) => {
        const active = selectedInsurer?.id === insurer.id;
        return <Pressable key={insurer.id} accessibilityRole="button" onPress={() => onSelect(insurer)} style={[styles.selectOption, active && styles.selectOptionActive]}><Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]} numberOfLines={1}>{insurer.name}</Text>{active ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>;
      }) : <Text style={styles.emptyLookupText}>No insurers available.</Text>}</View> : null}
    </View>
  );
}

function PolicyTypeDropdown({ value, open, onToggle, onSelect }: { value: string; open: boolean; onToggle: () => void; onSelect: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Policy type</Text>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.selectButton}>
        <View style={styles.selectIcon}><MaterialCommunityIcons name="shield-car" size={18} color="#0A43A3" /></View>
        <Text style={styles.selectValue} numberOfLines={1}>{value}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.selectMenu}>{policyTypes.map((type) => {
        const active = value === type;
        return <Pressable key={type} accessibilityRole="button" onPress={() => onSelect(type)} style={[styles.selectOption, active && styles.selectOptionActive]}><Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]} numberOfLines={1}>{type}</Text>{active ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>;
      })}</View> : null}
    </View>
  );
}

function PremiumDateField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateButton}>
        <View style={styles.dateIcon}><MaterialCommunityIcons name="calendar-month-outline" size={17} color="#0A43A3" /></View>
        <Text style={[styles.dateValue, !value && styles.datePlaceholder]} numberOfLines={1}>{value ? formatDisplayDate(value) : 'Select date'}</Text>
      </Pressable>
    </View>
  );
}

function PremiumCalendarModal({ target, onClose, onSelect }: { target: { label: string; value: string; onChange: (value: string) => void } | null; onClose: () => void; onSelect: (value: string) => void }) {
  const [cursor, setCursor] = useState(() => monthStart(parseDate(target?.value ?? '') ?? new Date()));
  const selected = parseDate(target?.value ?? '');
  const days = useMemo(() => buildMonthDays(cursor), [cursor]);

  useEffect(() => {
    if (target) setCursor(monthStart(parseDate(target.value) ?? new Date()));
  }, [target]);

  function moveMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function moveYear(delta: number) {
    setCursor((current) => new Date(current.getFullYear() + delta, current.getMonth(), 1));
  }

  return (
    <Modal visible={Boolean(target)} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.calendarScreen}>
        <View pointerEvents="none" style={styles.calendarAccent} />
        <View style={styles.calendarTopBar}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.calendarClose}>
            <MaterialCommunityIcons name="close" size={22} color={palette.navy} />
          </Pressable>
          <View style={styles.calendarHeadingCopy}>
            <Text style={styles.calendarEyebrow}>Vehicle onboarding</Text>
            <Text style={styles.calendarHeading} numberOfLines={1}>Select {target?.label ?? 'date'}</Text>
          </View>
        </View>

        <View style={styles.calendarHero}>
          <View style={styles.calendarHeroIcon}><MaterialCommunityIcons name="calendar-check-outline" size={27} color="#FFFFFF" /></View>
          <View style={styles.flex}>
            <Text style={styles.calendarHeroTitle}>{target?.label ?? 'Date'}</Text>
            <Text style={styles.calendarHeroText}>{target?.value ? formatDisplayDate(target.value) : 'No date selected yet'}</Text>
          </View>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.monthControl}>
            <Pressable accessibilityRole="button" onPress={() => moveYear(-1)} style={styles.yearButton}>
              <MaterialCommunityIcons name="chevron-double-left" size={19} color={palette.navy} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => moveMonth(-1)} style={styles.monthButton}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={palette.navy} />
            </Pressable>
            <View style={styles.monthTitleWrap}>
              <Text style={styles.monthTitle}>{cursor.toLocaleDateString('en-IN', { month: 'long' })}</Text>
              <Text style={styles.yearTitle}>{cursor.getFullYear()}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => moveMonth(1)} style={styles.monthButton}>
              <MaterialCommunityIcons name="chevron-right" size={22} color={palette.navy} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => moveYear(1)} style={styles.yearButton}>
              <MaterialCommunityIcons name="chevron-double-right" size={19} color={palette.navy} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((item, index) => <Text key={`${item}-${index}`} style={styles.weekDay}>{item}</Text>)}</View>
          <View style={styles.calendarGrid}>
            {days.map((day, index) => {
              const isSelected = Boolean(selected && sameDate(selected, day.date));
              return (
                <Pressable
                  key={`${day.date.toISOString()}-${index}`}
                  accessibilityRole="button"
                  onPress={() => onSelect(formatIsoDate(day.date))}
                  style={[styles.dayCell, !day.inMonth && styles.dayMuted, isSelected && styles.daySelected]}
                >
                  <Text style={[styles.dayText, !day.inMonth && styles.dayTextMuted, isSelected && styles.dayTextSelected]}>{day.date.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.calendarFooter}>
          <Pressable accessibilityRole="button" onPress={() => onSelect(formatIsoDate(new Date()))} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>Use Today</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function cleanDate(value: string) {
  const next = value.trim();
  return next ? next : null;
}

function cleanCode(value: string) {
  const next = value.replace(/\s/g, '').toUpperCase();
  return next ? next : null;
}

function isMissingVehicleRpcSignature(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === 'PGRST202' || (message.includes('create_customer_vehicle') && (message.includes('schema cache') || message.includes('could not find the function')));
}

function isMissingPolicyRpcSignature(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === 'PGRST202' || (message.includes('create_customer_policy') && (message.includes('schema cache') || message.includes('could not find the function')));
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthDays(month: Date) {
  const first = monthStart(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, inMonth: date.getMonth() === month.getMonth() };
  });
}

function sameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  const parsed = parseDate(value);
  return parsed ? parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : value;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  compactTitle: { color: palette.navy, fontSize: 16, fontWeight: '800', marginBottom: 6, marginTop: -30, letterSpacing: 0 },
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
  dateIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  dateValue: { flex: 1, color: palette.navy, fontSize: 11.5, fontWeight: '700' },
  datePlaceholder: { color: '#7F8EA4', fontWeight: '600' },
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
