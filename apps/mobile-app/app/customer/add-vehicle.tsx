import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

export default function AddVehicleScreen() {
  const router = useRouter();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('Commercial Vehicle');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
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

  async function save() {
    setMessage('');
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const target = contexts.find((context) => context.customer_id === selectedCustomerId);
    if (!target) return setMessage('Select the customer account for this vehicle.');
    const { error } = await supabase.from('vehicles').insert({ customer_id: target.customer_id, vehicle_no: vehicleNo.trim().toUpperCase(), vehicle_type: vehicleType.trim(), make: make.trim() || null, model: model.trim() || null, year: year ? Number(year) : null });
    if (error) setMessage('We could not save this vehicle. Please try again.');
    else router.replace(contexts[0]?.partner_type === 'group' ? '/customer/group/fleet' : '/customer/vehicles');
  }

  return (
    <Screen title="Add Vehicle" showLogout>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
        {contexts.length > 1 ? <AccountSelector contexts={contexts} selectedCustomerId={selectedCustomerId} onSelect={setSelectedCustomerId} /> : null}
        <TextField label="Vehicle number" value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" />
        <TextField label="Vehicle type" value={vehicleType} onChangeText={setVehicleType} />
        <TextField label="Make" value={make} onChangeText={setMake} />
        <TextField label="Model" value={model} onChangeText={setModel} />
        <TextField label="Year" keyboardType="number-pad" value={year} onChangeText={setYear} />
        <Button label="Save vehicle" onPress={save} />
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
});
