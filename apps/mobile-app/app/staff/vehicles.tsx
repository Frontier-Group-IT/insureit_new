import { useState } from 'react';

import { Button, Card, EmptyState, Row, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Vehicle } from '@/lib/types';

export default function VehicleSearchScreen() {
  const [query, setQuery] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searched, setSearched] = useState(false);

  async function search() {
    setSearched(true);
    const term = `%${query.trim()}%`;
    const { data } = await supabase.from('vehicles').select('*').or(`vehicle_no.ilike.${term},make.ilike.${term},model.ilike.${term},chassis_no.ilike.${term},engine_no.ilike.${term}`).limit(25);
    setVehicles(data ?? []);
  }

  return (
    <Screen title="Vehicle Search" showLogout>
      <Card>
        <TextField label="Vehicle, chassis, engine, make, or model" value={query} onChangeText={setQuery} />
        <Button label="Search vehicles" onPress={search} />
      </Card>
      {searched && vehicles.length === 0 ? <EmptyState title="No vehicles found" body="Try another vehicle number or identifier." /> : vehicles.map((vehicle) => (
        <Card key={vehicle.id}>
          <Row label="Vehicle number" value={vehicle.vehicle_no} />
          <Row label="Type" value={vehicle.vehicle_type} />
          <Row label="Make and model" value={[vehicle.make, vehicle.model].filter(Boolean).join(' ')} />
          <Row label="Chassis" value={vehicle.chassis_no} />
        </Card>
      ))}
    </Screen>
  );
}
