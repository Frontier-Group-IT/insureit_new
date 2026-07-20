import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { Button, Card, Message, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

type VehicleKind = 'Commercial Vehicle' | 'Private Vehicle';

const vehicleTypes: VehicleKind[] = ['Commercial Vehicle', 'Private Vehicle'];

export default function AddVehicleScreen() {
  const router = useRouter();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [makeOpen, setMakeOpen] = useState(false);
  const [makeQuery, setMakeQuery] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleKind>('Commercial Vehicle');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [chassisNo, setChassisNo] = useState('');
  const [engineNo, setEngineNo] = useState('');
  const [gvwKg, setGvwKg] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [fitnessExpiryDate, setFitnessExpiryDate] = useState('');
  const [pucExpiryDate, setPucExpiryDate] = useState('');
  const [roadTaxExpiryDate, setRoadTaxExpiryDate] = useState('');
  const [nationalPermitExpiryDate, setNationalPermitExpiryDate] = useState('');
  const [localPermitExpiryDate, setLocalPermitExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isCommercial = vehicleType === 'Commercial Vehicle';
  const selectedContext = contexts.find((context) => context.customer_id === selectedCustomerId) ?? null;
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
    async function loadManufacturers() {
      const { data, error } = await supabase
        .from('vehicle_manufacturers')
        .select('name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (!active) return;
      if (error) {
        setManufacturers([]);
        return;
      }
      setManufacturers((data ?? []).map((item) => item.name).filter(Boolean));
    }
    void loadManufacturers();
    return () => {
      active = false;
    };
  }, []);

  function chooseVehicleType(nextType: VehicleKind) {
    setVehicleType(nextType);
    if (nextType === 'Private Vehicle') {
      setGvwKg('');
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

    const rpcPayload = {
      p_customer_id: target.customer_id,
      p_vehicle_no: vehicleNo.trim().toUpperCase(),
      p_vehicle_type: vehicleType,
      p_make: make.trim(),
      p_model: model.trim() || null,
      p_year: parsedYear,
      p_chassis_no: cleanCode(chassisNo),
      p_engine_no: cleanCode(engineNo),
      p_permit_no: null,
      p_gvw_kg: parsedGvw,
      p_registration_date: cleanDate(registrationDate),
      p_fitness_expiry_date: isCommercial ? cleanDate(fitnessExpiryDate) : null,
      p_puc_expiry_date: cleanDate(pucExpiryDate),
      p_road_tax_expiry_date: isCommercial ? cleanDate(roadTaxExpiryDate) : null,
      p_national_permit_expiry_date: isCommercial ? cleanDate(nationalPermitExpiryDate) : null,
      p_local_permit_expiry_date: isCommercial ? cleanDate(localPermitExpiryDate) : null,
    };

    setSaving(true);
    let { error } = await (supabase.rpc as any)('create_customer_vehicle', rpcPayload);
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
      error = fallback.error;
    }
    setSaving(false);
    if (error) setMessage(error.message || 'We could not save this vehicle. Please try again.');
    else router.replace(contexts[0]?.partner_type === 'group' ? '/customer/group/fleet' : '/customer/vehicles');
  }

  return (
    <Screen title="Add Vehicle" showLogout showTitleHeader={false}>
      <Text style={styles.compactTitle}>Add Vehicle</Text>
      <Card style={styles.formCard}>
        {message ? <Message type="error">{message}</Message> : null}
        {contexts.length > 1 ? <AccountDropdown contexts={contexts} selectedCustomerId={selectedCustomerId} open={accountOpen} onToggle={() => setAccountOpen((value) => !value)} onSelect={(customerId) => { setSelectedCustomerId(customerId); setAccountOpen(false); }} /> : null}
        {selectedContext && contexts.length <= 1 ? <View style={styles.accountPill}><MaterialCommunityIcons name="office-building-outline" size={17} color="#0A43A3" /><View style={styles.flex}><Text style={styles.accountPillLabel}>Add for</Text><Text style={styles.accountPillTitle}>{customerAccountTitle(selectedContext)}</Text></View></View> : null}

        <FormSection title="Vehicle details" icon="truck-outline">
          <InputField icon="card-text-outline" label="Vehicle number" value={vehicleNo} onChangeText={(value) => setVehicleNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" />
          <VehicleTypeDropdown value={vehicleType} onSelect={chooseVehicleType} />
          <MakeDropdown manufacturers={manufacturers} selectedMake={make} query={makeQuery} open={makeOpen} onToggle={() => setMakeOpen((value) => !value)} onQueryChange={setMakeQuery} onSelect={(value) => { setMake(value); setMakeQuery(value); setMakeOpen(false); }} />
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><InputField icon="car-info" label="Model" value={model} onChangeText={setModel} /></View>
            <View style={styles.column}><InputField icon="calendar-blank-outline" label="Year" keyboardType="number-pad" value={year} onChangeText={(value) => setYear(value.replace(/\D/g, '').slice(0, 4))} /></View>
          </View>
        </FormSection>

        <FormSection title="Vehicle identity" icon="identifier">
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><InputField icon="barcode" label="Chassis no." value={chassisNo} onChangeText={(value) => setChassisNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" /></View>
            <View style={styles.column}><InputField icon="engine-outline" label="Engine no." value={engineNo} onChangeText={(value) => setEngineNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" /></View>
          </View>
        </FormSection>

        <FormSection title="Operational details" icon="clipboard-pulse-outline">
          {isCommercial ? <InputField icon="weight-kilogram" label="GVW (kg)" keyboardType="decimal-pad" value={gvwKg} onChangeText={(value) => setGvwKg(value.replace(/[^0-9.]/g, ''))} /> : null}
          <View style={styles.dateGrid}>
            {visibleDateFields.map((field) => (
              <View key={field.key} style={styles.dateCell}>
                <AppDatePicker label={field.label} value={field.value} onChange={field.onChange} />
              </View>
            ))}
          </View>
        </FormSection>

        <Button label={saving ? 'Saving vehicle...' : 'Save vehicle'} onPress={save} disabled={saving} />
        {saving ? <ActivityIndicator color={palette.navy} /> : null}
      </Card>
    </Screen>
  );
}

function FormSection({ title, icon, children }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={18} color="#0A43A3" /></View>
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
          <Text style={styles.accountMeta}>{selected ? `${selected.access_source === 'group_child' ? 'Associated account' : 'Parent account'} - ${partnerTypeLabel(selected.partner_type)}` : 'Choose where this vehicle belongs'}</Text>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.dropdownMenu}>{contexts.map((context) => {
        const active = context.customer_id === selectedCustomerId;
        return <Pressable key={context.customer_id} accessibilityRole="button" onPress={() => onSelect(context.customer_id)} style={[styles.dropdownItem, active && styles.dropdownItemActive]}>
          <View style={styles.accountCopy}>
            <Text style={[styles.accountTitle, active && styles.accountTitleActive]} numberOfLines={1}>{customerAccountTitle(context)}</Text>
            <Text style={[styles.accountMeta, active && styles.accountMetaActive]}>{context.access_source === 'group_child' ? 'Associated account' : 'Parent account'} - {partnerTypeLabel(context.partner_type)}</Text>
          </View>
          {active ? <MaterialCommunityIcons name="check-circle" size={19} color={palette.navy} /> : null}
        </Pressable>;
      })}</View> : null}
    </View>
  );
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  compactTitle: { color: palette.navy, fontSize: 16, fontWeight: '900', marginBottom: 6, marginTop: -12, letterSpacing: 0 },
  formCard: { borderRadius: 18, padding: 12, gap: 12 },
  accountBlock: { gap: 6 },
  accountPill: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F8FBFF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  accountPillLabel: { color: '#607089', fontSize: 9.5, fontWeight: '800' },
  accountPillTitle: { color: palette.navy, fontSize: 12, fontWeight: '900', marginTop: 1 },
  section: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  sectionHeader: { minHeight: 45, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FBFF', borderBottomWidth: 1, borderBottomColor: '#E8EFF7' },
  sectionIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: palette.navy, fontSize: 13, fontWeight: '900', letterSpacing: 0 },
  sectionBody: { padding: 11, gap: 10 },
  field: { gap: 5 },
  fieldLabel: { color: '#35445A', fontSize: 10.5, fontWeight: '900', letterSpacing: 0 },
  inputShell: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FFFFFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minHeight: 44, color: palette.navy, fontSize: 13, fontWeight: '800', letterSpacing: 0 },
  twoColumnRow: { flexDirection: 'row', gap: 9 },
  column: { flex: 1, minWidth: 0 },
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  dateCell: { width: '48.5%' },
  selectButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FFFFFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  selectValue: { flex: 1, color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  placeholder: { color: '#7A8798' },
  selectMenu: { borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  selectOption: { minHeight: 43, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  selectOptionActive: { backgroundColor: '#EEF5FF' },
  selectOptionText: { flex: 1, color: '#607089', fontSize: 11.5, fontWeight: '800' },
  selectOptionTextActive: { color: palette.navy, fontWeight: '900' },
  dropdownButton: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F8FBFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownMenu: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  dropdownItem: { minHeight: 54, paddingHorizontal: 11, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownItemActive: { backgroundColor: '#EEF5FF' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountTitle: { color: palette.ink, fontSize: 12.5, fontWeight: '900' },
  accountTitleActive: { color: palette.navy },
  accountMeta: { color: palette.slate, fontSize: 10, fontWeight: '700', marginTop: 2 },
  accountMetaActive: { color: '#315C99' },
  makeMenu: { borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  makeSearch: { minHeight: 42, backgroundColor: '#F8FBFF', borderBottomWidth: 1, borderBottomColor: '#E8EFF7', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  makeSearchInput: { flex: 1, minHeight: 40, color: palette.navy, fontSize: 12.5, fontWeight: '800' },
  makeOption: { minHeight: 42, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
});
