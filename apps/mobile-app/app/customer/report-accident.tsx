import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, Message, Row, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getCustomerForUser, makeClaimNumber } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Policy, Vehicle } from '@/lib/types';

export default function ReportAccidentScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [accidentAt, setAccidentAt] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loss, setLoss] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const [vehicleResult, policyResult] = await Promise.all([
          supabase.from('vehicles').select('*').eq('customer_id', customer.id),
          supabase.from('policies').select('*').eq('customer_id', customer.id),
        ]);
        setVehicles(vehicleResult.data ?? []);
        setPolicies(policyResult.data ?? []);
      }
    }
    void load();
  }, [router]);

  async function submit() {
    setMessage('');
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const customer = await getCustomerForUser(session.user.id);
    const vehicle = vehicles.find((item) => item.vehicle_no.toLowerCase() === vehicleNo.trim().toLowerCase());
    const policy = policies.find((item) => item.policy_no.toLowerCase() === policyNo.trim().toLowerCase());
    if (!customer || !vehicle || !policy) return setMessage('Please enter a matching vehicle and policy.');
    const { error } = await supabase.from('claims').insert({ claim_no: makeClaimNumber(), customer_id: customer.id, vehicle_id: vehicle.id, policy_id: policy.id, insurance_company_id: policy.insurance_company_id, current_status: 'Accident Reported', accident_at: accidentAt ? new Date(accidentAt).toISOString() : new Date().toISOString(), accident_location: location.trim(), accident_description: description.trim(), estimated_loss: loss ? Number(loss) : null, created_by: session.user.id });
    if (error) setMessage('We could not submit the accident report. Please try again.');
    else router.replace('/customer/claims');
  }

  return (
    <Screen title="Report Accident" subtitle="Share the key details so the claim journey can begin." showLogout>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
        <TextField label="Vehicle number" value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" />
        <TextField label="Policy number" value={policyNo} onChangeText={setPolicyNo} />
        <TextField label="Accident date and time" value={accidentAt} onChangeText={setAccidentAt} placeholder="YYYY-MM-DD HH:MM" />
        <TextField label="Location" value={location} onChangeText={setLocation} />
        <TextField label="What happened" value={description} onChangeText={setDescription} multiline />
        <TextField label="Estimated loss" value={loss} onChangeText={setLoss} keyboardType="decimal-pad" />
        <Button label="Submit report" onPress={submit} />
      </Card>
      <Card>
        <Row label="Vehicles" value={vehicles.map((item) => item.vehicle_no).join(', ')} />
        <Row label="Policies" value={policies.map((item) => item.policy_no).join(', ')} />
      </Card>
    </Screen>
  );
}
