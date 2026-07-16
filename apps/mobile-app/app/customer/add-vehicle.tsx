import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
      setManufacturers((data ?? []).map((item) => item.name).filter(Boolean));
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
    <Screen title="Add Vehicle" showLogout>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
        {contexts.length > 1 ? <AccountSelector contexts={contexts} selectedCustomerId={selectedCustomerId} onSelect={setSelectedCustomerId} /> : null}
        <TextField label="Vehicle number" value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" />
        <TextField label="Vehicle type" value={vehicleType} onChangeText={setVehicleType} />
        <ManufacturerSelector manufacturers={manufacturers} selectedMake={make} onSelect={setMake} />
        <TextField label="Model" value={model} onChangeText={setModel} />
        <TextField label="Year" keyboardType="number-pad" value={year} onChangeText={setYear} />
        <Button label={saving ? 'Saving vehicle...' : 'Save vehicle'} onPress={save} disabled={saving} />
        {saving ? <ActivityIndicator color={palette.navy} /> : null}
      </Card>
    </Screen>
  );
}

function AccountSelector({ contexts, selectedCustomerId, onSelect }: { contexts: CustomerAccountContext[]; selectedCustomerId: string; onSelect: (customerId: string) => void }) {
  return (
    <View style={styles.accountBlock}>
      <Text style={styles.accountLabel}>Add for</Text>
      {contexts.map((context) => {
        const active = context.customer_id === selectedCustomerId;
        return (
          <Pressable key={context.customer_id} accessibilityRole="button" onPress={() => onSelect(context.customer_id)} style={[styles.accountOption, active && styles.accountOptionActive]}>
            <View style={styles.accountCopy}>
              <Text style={[styles.accountTitle, active && styles.accountTitleActive]} numberOfLines={1}>{customerAccountTitle(context)}</Text>
              <Text style={[styles.accountMeta, active && styles.accountMetaActive]}>{context.access_source === 'group_child' ? 'Associated account' : 'Parent account'} - {partnerTypeLabel(context.partner_type)}</Text>
            </View>
            <View style={[styles.radio, active && styles.radioActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function ManufacturerSelector({ manufacturers, selectedMake, onSelect }: { manufacturers: string[]; selectedMake: string; onSelect: (make: string) => void }) {
  return (
    <View style={styles.manufacturerBlock}>
      <Text style={styles.accountLabel}>Make</Text>
      {manufacturers.length ? (
        <View style={styles.manufacturerGrid}>
          {manufacturers.map((manufacturer) => {
            const active = manufacturer === selectedMake;
            return (
              <Pressable key={manufacturer} accessibilityRole="button" onPress={() => onSelect(manufacturer)} style={[styles.manufacturerChip, active && styles.manufacturerChipActive]}>
                <Text style={[styles.manufacturerText, active && styles.manufacturerTextActive]} numberOfLines={1}>{manufacturer}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextField label="Make" value={selectedMake} onChangeText={onSelect} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  accountBlock: { gap: 8, marginBottom: 10 },
  accountLabel: { color: palette.slate, fontSize: 12, fontWeight: '800' },
  accountOption: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountOptionActive: { borderColor: palette.navy, backgroundColor: '#EEF5FF' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  accountTitleActive: { color: palette.navy },
  accountMeta: { color: palette.slate, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  accountMetaActive: { color: '#315C99' },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: '#B7C5D8' },
  radioActive: { borderColor: palette.navy, backgroundColor: palette.navy },
  manufacturerBlock: { marginBottom: 12 },
  manufacturerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  manufacturerChip: { maxWidth: '48%', minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  manufacturerChipActive: { borderColor: palette.navy, backgroundColor: '#EEF5FF' },
  manufacturerText: { color: palette.slate, fontSize: 11.5, fontWeight: '800' },
  manufacturerTextActive: { color: palette.navy },
});
