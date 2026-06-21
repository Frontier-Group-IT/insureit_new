import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppSearchBar } from '@/components/design-system';
import { Button, EmptyState, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
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
    <Screen title="Vehicles" subtitle={searched ? `${vehicles.length} results` : 'Search vehicle records'} showLogout>
      <AppSearchBar value={query} onChangeText={setQuery} placeholder="Vehicle, chassis, engine, make" />
      <Button label="Search" onPress={search} />
      {searched && vehicles.length === 0 ? <EmptyState title="No vehicles found" body="Try another identifier." /> : vehicles.map((vehicle) => (
        <View key={vehicle.id} style={styles.vehicleRow}>
          <View style={styles.vehicleIcon}>
            <MaterialCommunityIcons name="truck-outline" size={21} color={palette.blue} />
          </View>
          <View style={styles.vehicleCopy}>
            <Text style={styles.vehicleNo}>{vehicle.vehicle_no}</Text>
            <Text style={styles.vehicleMeta} numberOfLines={1}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_type || 'Vehicle'}</Text>
            <Text style={styles.vehicleMeta} numberOfLines={1}>Chassis {vehicle.chassis_no || '-'}</Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, padding: 11, marginBottom: 8 },
  vehicleIcon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  vehicleCopy: { flex: 1, minWidth: 0 },
  vehicleNo: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  vehicleMeta: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 3 },
});
