import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, Message, Row, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

export default function AddPolicyScreen() {
  const router = useRouter();
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
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const vehicleResult = await supabase.from('vehicles').select('*').eq('customer_id', customer.id);
        setVehicles(vehicleResult.data ?? []);
      }
      const companyResult = await supabase.from('insurance_companies').select('*').order('name');
      setCompanies(companyResult.data ?? []);
    }
    void load();
  }, [router]);

  async function save() {
    setMessage('');
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const customer = await getCustomerForUser(session.user.id);
    const vehicle = vehicles.find((item) => item.vehicle_no.toLowerCase() === vehicleNo.trim().toLowerCase());
    const company = companies.find((item) => item.name.toLowerCase() === companyName.trim().toLowerCase());
    if (!customer || !vehicle || !company) return setMessage('Please enter a matching vehicle number and insurer name.');
    const { error } = await supabase.from('policies').insert({ customer_id: customer.id, vehicle_id: vehicle.id, insurance_company_id: company.id, policy_no: policyNo.trim(), policy_type: policyType.trim(), start_date: startDate, end_date: endDate, premium_amount: premium ? Number(premium) : null });
    if (error) setMessage('We could not save this policy. Please try again.');
    else router.replace('/customer/policies');
  }

  return (
    <Screen title="Add Policy" showLogout>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
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
        <Row label="Your vehicles" value={vehicles.map((item) => item.vehicle_no).join(', ')} />
        <Row label="Available insurers" value={companies.map((item) => item.name).join(', ')} />
      </Card>
    </Screen>
  );
}
