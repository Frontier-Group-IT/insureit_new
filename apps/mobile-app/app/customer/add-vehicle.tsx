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

    setSaving(true);
    const { error } = await (supabase.rpc as any)('create_customer_vehicle', {
      p_customer_id: target.customer_id,
      p_vehicle_no: vehicleNo.trim().toUpperCase(),
      p_vehicle_type: vehicleType.trim(),
      p_make: make.trim(),
      p_model: model.trim() || null,
      p_year: parsedYear,
    });
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
});
