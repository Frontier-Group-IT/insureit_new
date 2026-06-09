import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function AddVehicleScreen() {
  const router = useRouter();
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('Commercial Vehicle');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [message, setMessage] = useState('');

  async function save() {
    setMessage('');
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const customer = await getCustomerForUser(session.user.id);
    if (!customer) return setMessage('Please contact support to complete your customer record.');
    const { error } = await supabase.from('vehicles').insert({ customer_id: customer.id, vehicle_no: vehicleNo.trim().toUpperCase(), vehicle_type: vehicleType.trim(), make: make.trim() || null, model: model.trim() || null, year: year ? Number(year) : null });
    if (error) setMessage('We could not save this vehicle. Please try again.');
    else router.replace('/customer/vehicles');
  }

  return (
    <Screen title="Add Vehicle" showLogout>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
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
