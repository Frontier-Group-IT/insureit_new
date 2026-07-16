import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Message, Row, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

export default function AddPolicyScreen() {
  const router = useRouter();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [policyType, setPolicyType] = useState('Commercial comprehensive');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [premium, setPremium] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextContexts = await getOperationalCustomerContexts();
      const ids = nextContexts.map((context) => context.customer_id);
      const [vehicleResult, companyResult] = await Promise.all([
        ids.length ? supabase.from('vehicles').select('*').in('customer_id', ids).order('vehicle_no') : Promise.resolve({ data: [] as Vehicle[] }),
        supabase.from('insurance_companies').select('*').order('name'),
      ]);
      setContexts(nextContexts);
      setSelectedCustomerId(nextContexts[0]?.customer_id ?? '');
      setVehicles((vehicleResult.data ?? []) as Vehicle[]);
      setCompanies(companyResult.data ?? []);
    }
    void load();
  }, [router]);

  const accountVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.customer_id === selectedCustomerId), [selectedCustomerId, vehicles]);

  async function save() {
    setMessage('');
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const target = contexts.find((context) => context.customer_id === selectedCustomerId);
    const vehicle = accountVehicles.find((item) => item.vehicle_no.toLowerCase() === vehicleNo.trim().toLowerCase());
    const company = companies.find((item) => item.name.toLowerCase() === companyName.trim().toLowerCase());
    if (!target || !vehicle || !company) return setMessage('Please select an account, matching vehicle number and insurer name.');
    const { error } = await supabase.from('policies').insert({ customer_id: target.customer_id, vehicle_id: vehicle.id, insurance_company_id: company.id, policy_no: policyNo.trim(), policy_type: policyType.trim(), start_date: startDate, end_date: endDate, premium_amount: premium ? Number(premium) : null });
    if (error) setMessage('We could not save this policy. Please try again.');
    else router.replace(contexts[0]?.partner_type === 'group' ? '/customer/group/policies' : '/customer/policies');
  }

  return (
    <Screen title="Add Policy" showLogout>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
        {contexts.length > 1 ? <AccountSelector contexts={contexts} selectedCustomerId={selectedCustomerId} onSelect={(customerId) => { setSelectedCustomerId(customerId); setVehicleNo(''); }} /> : null}
        <TextField label="Vehicle number" value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" />
        <TextField label="Insurer name" value={companyName} onChangeText={setCompanyName} />
        <TextField label="Policy number" value={policyNo} onChangeText={setPolicyNo} />
        <TextField label="Policy type" value={policyType} onChangeText={setPolicyType} />
        <TextField label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
        <TextField label="End date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />
        <TextField label="Premium amount" keyboardType="decimal-pad" value={premium} onChangeText={setPremium} />
        <Button label="Save policy" onPress={save} />
      </Card>
      <Card>
        <Row label="Available vehicles" value={accountVehicles.map((item) => item.vehicle_no).join(', ')} />
        <Row label="Available insurers" value={companies.map((item) => item.name).join(', ')} />
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
