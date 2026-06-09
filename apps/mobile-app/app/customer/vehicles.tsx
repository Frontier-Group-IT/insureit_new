import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, EmptyState, LoadingState, Row, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Vehicle } from '@/lib/types';

export default function VehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const { data } = await supabase.from('vehicles').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
        setVehicles(data ?? []);
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) return <Screen title="My Vehicles"><LoadingState /></Screen>;

  return (
    <Screen title="My Vehicles" showLogout>
      <Link href="/customer/add-vehicle" asChild><Button label="Add Vehicle" onPress={() => undefined} /></Link>
      {vehicles.length === 0 ? <EmptyState title="No vehicles yet" body="Add your vehicle to keep claim support details ready." /> : vehicles.map((vehicle) => (
        <Card key={vehicle.id}>
          <Row label="Vehicle number" value={vehicle.vehicle_no} />
          <Row label="Type" value={vehicle.vehicle_type} />
          <Row label="Make and model" value={[vehicle.make, vehicle.model].filter(Boolean).join(' ')} />
          <Row label="Year" value={vehicle.year} />
        </Card>
      ))}
    </Screen>
  );
}
