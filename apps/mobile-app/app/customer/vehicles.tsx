import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppSectionHeader } from '@/components/design-system';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
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
    <Screen title="My Vehicles" subtitle={`${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`} showLogout>
      <AppSectionHeader title="Vehicles & policies" />
      {vehicles.length === 0 ? <EmptyState title="No vehicles yet" body="Vehicle records will appear here." /> : vehicles.map((vehicle) => (
        <Pressable key={vehicle.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/customer/vehicle-detail', params: { id: vehicle.id } })} style={styles.vehicleRow}>
          <View style={styles.vehicleWash} />
          <View style={styles.vehicleIcon}>
            <MaterialCommunityIcons name={vehicleIcon(vehicle.vehicle_type)} size={24} color={palette.blue} />
          </View>
          <View style={styles.vehicleCopy}>
            <Text style={styles.vehicleNo}>{vehicle.vehicle_no}</Text>
            <Text style={styles.vehicleMeta} numberOfLines={1}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_type || 'Vehicle'}</Text>
          </View>
          {vehicle.year ? <View style={styles.yearPill}><Text style={styles.vehicleYear}>{vehicle.year}</Text></View> : null}
          <MaterialCommunityIcons name="chevron-right" size={22} color={palette.slate} />
        </Pressable>
      ))}
    </Screen>
  );
}

function vehicleIcon(type?: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  const normalized = type?.toLowerCase() ?? '';
  if (normalized.includes('bus')) return 'bus';
  if (normalized.includes('tanker')) return 'truck-cargo-container';
  if (normalized.includes('trailer')) return 'truck-trailer';
  return 'truck-outline';
}

const styles = StyleSheet.create({
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radii.md, padding: 12, marginBottom: 9, overflow: 'hidden' },
  vehicleWash: { position: 'absolute', right: -45, top: -52, width: 132, height: 132, borderRadius: 66, backgroundColor: palette.blueSoft },
  vehicleIcon: { width: 46, height: 46, borderRadius: radii.md, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C8DAF2' },
  vehicleCopy: { flex: 1, minWidth: 0 },
  vehicleNo: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  vehicleMeta: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 3 },
  yearPill: { minHeight: 30, borderRadius: 999, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  vehicleYear: { color: palette.slate, fontSize: 12, fontWeight: '700' },
});
