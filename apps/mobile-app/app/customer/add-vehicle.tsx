import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

export default function AddVehicleScreen() {
  const router = useRouter();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [makeQuery, setMakeQuery] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('Commercial Vehicle');
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function loadContexts() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextContexts = await getOperationalCustomerContexts();
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
      const nextManufacturers = (data ?? []).map((item) => item.name).filter(Boolean);
      setManufacturers(nextManufacturers);
      setMake((current) => current || nextManufacturers[0] || '');
    }
    void loadManufacturers();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setMessage('');
    if (saving) return;
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const target = contexts.find((context) => context.customer_id === selectedCustomerId);
    if (!target) return setMessage('Select the customer account for this vehicle.');
    if (!vehicleNo.trim()) return setMessage('Enter the vehicle number.');
    if (!vehicleType.trim()) return setMessage('Enter the vehicle type.');
    if (!make.trim()) return setMessage('Select the vehicle manufacturer.');
    const parsedYear = year ? Number(year) : null;
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > new Date().getFullYear() + 1)) return setMessage('Enter a valid manufacturing year.');
    const parsedGvw = gvwKg ? Number(gvwKg) : null;
    if (parsedGvw !== null && (!Number.isFinite(parsedGvw) || parsedGvw <= 0)) return setMessage('Enter a valid GVW.');
    const dateFields = [
      ['registration date', registrationDate],
      ['fitness expiry date', fitnessExpiryDate],
      ['PUC expiry date', pucExpiryDate],
      ['road tax expiry date', roadTaxExpiryDate],
      ['national permit expiry date', nationalPermitExpiryDate],
      ['local permit expiry date', localPermitExpiryDate],
    ] as const;
    const invalidDate = dateFields.find(([, value]) => value.trim() && !isDateOnly(value.trim()));
    if (invalidDate) return setMessage(`Enter ${invalidDate[0]} as YYYY-MM-DD.`);

    const rpcPayload = {
      p_customer_id: target.customer_id,
      p_vehicle_no: vehicleNo.trim().toUpperCase(),
      p_vehicle_type: vehicleType.trim(),
      p_make: make.trim(),
      p_model: model.trim() || null,
      p_year: parsedYear,
      p_chassis_no: cleanCode(chassisNo),
      p_engine_no: cleanCode(engineNo),
      p_permit_no: cleanCode(permitNo),
      p_gvw_kg: parsedGvw,
      p_registration_date: cleanDate(registrationDate),
      p_fitness_expiry_date: cleanDate(fitnessExpiryDate),
      p_puc_expiry_date: cleanDate(pucExpiryDate),
      p_road_tax_expiry_date: cleanDate(roadTaxExpiryDate),
      p_national_permit_expiry_date: cleanDate(nationalPermitExpiryDate),
      p_local_permit_expiry_date: cleanDate(localPermitExpiryDate),
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
        <TextField label="Vehicle number" value={vehicleNo} onChangeText={(value) => setVehicleNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" />
        <TextField label="Vehicle type" value={vehicleType} onChangeText={setVehicleType} />
        <ManufacturerSelector manufacturers={manufacturers} selectedMake={make} query={makeQuery} onQueryChange={setMakeQuery} onSelect={setMake} />
        <TextField label="Model" value={model} onChangeText={setModel} />
        <TextField label="Year" keyboardType="number-pad" value={year} onChangeText={setYear} />
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vehicle identity</Text>
          <Text style={styles.sectionHint}>Optional registration identifiers for claims and compliance.</Text>
        </View>
        <TextField label="Chassis number" value={chassisNo} onChangeText={(value) => setChassisNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" />
        <TextField label="Engine number" value={engineNo} onChangeText={(value) => setEngineNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" />
        <TextField label="Permit number" value={permitNo} onChangeText={(value) => setPermitNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" />
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Operational details</Text>
          <Text style={styles.sectionHint}>Optional fields used for fleet compliance tracking.</Text>
        </View>
        <TextField label="GVW (kg)" keyboardType="decimal-pad" value={gvwKg} onChangeText={(value) => setGvwKg(value.replace(/[^0-9.]/g, ''))} />
        <TextField label="Registration date" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={registrationDate} onChangeText={setRegistrationDate} />
        <TextField label="Fitness expiry" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={fitnessExpiryDate} onChangeText={setFitnessExpiryDate} />
        <TextField label="PUC expiry" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={pucExpiryDate} onChangeText={setPucExpiryDate} />
        <TextField label="Road tax expiry" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={roadTaxExpiryDate} onChangeText={setRoadTaxExpiryDate} />
        <TextField label="National permit expiry" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={nationalPermitExpiryDate} onChangeText={setNationalPermitExpiryDate} />
        <TextField label="Local permit expiry" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={localPermitExpiryDate} onChangeText={setLocalPermitExpiryDate} />
        <Button label={saving ? 'Saving vehicle...' : 'Save vehicle'} onPress={save} disabled={saving} />
        {saving ? <ActivityIndicator color={palette.navy} /> : null}
      </Card>
    </Screen>
  );
}

function AccountDropdown({ contexts, selectedCustomerId, open, onToggle, onSelect }: { contexts: CustomerAccountContext[]; selectedCustomerId: string; open: boolean; onToggle: () => void; onSelect: (customerId: string) => void }) {
  const selected = contexts.find((context) => context.customer_id === selectedCustomerId);
  return (
    <View style={styles.accountBlock}>
      <Text style={styles.accountLabel}>Add for</Text>
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

function ManufacturerSelector({ manufacturers, selectedMake, query, onQueryChange, onSelect }: { manufacturers: string[]; selectedMake: string; query: string; onQueryChange: (value: string) => void; onSelect: (make: string) => void }) {
  const visibleManufacturers = manufacturers.filter((manufacturer) => !query.trim() || manufacturer.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12);
  return (
    <View style={styles.manufacturerBlock}>
      <Text style={styles.accountLabel}>Make</Text>
      {manufacturers.length ? (
        <View style={styles.makePanel}>
          <View style={styles.makeSearch}><MaterialCommunityIcons name="magnify" size={18} color="#7A8799" /><TextInput value={query} onChangeText={onQueryChange} placeholder="Search manufacturer" placeholderTextColor="#8A94A6" style={styles.makeSearchInput} /></View>
          <View style={styles.manufacturerGrid}>
          {visibleManufacturers.map((manufacturer) => {
            const active = manufacturer === selectedMake;
            return (
              <Pressable key={manufacturer} accessibilityRole="button" onPress={() => onSelect(manufacturer)} style={[styles.manufacturerChip, active && styles.manufacturerChipActive]}>
                <Text style={[styles.manufacturerText, active && styles.manufacturerTextActive]} numberOfLines={1}>{manufacturer}</Text>
              </Pressable>
            );
          })}
          </View>
        </View>
      ) : (
        <TextField label="Make" value={selectedMake} onChangeText={onSelect} />
      )}
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

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isMissingVehicleRpcSignature(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === 'PGRST202' || (message.includes('create_customer_vehicle') && (message.includes('schema cache') || message.includes('could not find the function')));
}

const styles = StyleSheet.create({
  compactTitle: { color: palette.navy, fontSize: 18, fontWeight: '900', marginBottom: 6, marginTop: -6 },
  formCard: { borderRadius: 18 },
  accountBlock: { gap: 8, marginBottom: 10 },
  accountLabel: { color: palette.slate, fontSize: 12, fontWeight: '800' },
  dropdownButton: { minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F8FBFF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownMenu: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  dropdownItem: { minHeight: 56, paddingHorizontal: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownItemActive: { backgroundColor: '#EEF5FF' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  accountTitleActive: { color: palette.navy },
  accountMeta: { color: palette.slate, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  accountMetaActive: { color: '#315C99' },
  manufacturerBlock: { marginBottom: 12 },
  makePanel: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', padding: 10, gap: 9 },
  makeSearch: { minHeight: 42, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  makeSearchInput: { flex: 1, minHeight: 40, color: palette.navy, fontSize: 13, fontWeight: '700' },
  manufacturerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  manufacturerChip: { maxWidth: '48%', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  manufacturerChipActive: { borderColor: palette.navy, backgroundColor: '#EEF5FF' },
  manufacturerText: { color: palette.slate, fontSize: 11.5, fontWeight: '800' },
  manufacturerTextActive: { color: palette.navy },
  sectionHeader: { marginTop: 4, marginBottom: 4 },
  sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  sectionHint: { color: palette.slate, fontSize: 11, fontWeight: '700', marginTop: 2 },
});
