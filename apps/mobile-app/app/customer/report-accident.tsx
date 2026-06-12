import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Message, Row, Screen, TextField, colors } from '@/components/ui';
import { ensureCustomerForUser, getCurrentSession, getCustomerForUser, makeClaimNumber } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Customer, Policy, Vehicle } from '@/lib/types';

export default function ReportAccidentScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [accidentAt, setAccidentAt] = useState(() => new Date());
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [description, setDescription] = useState('');
  const [loss, setLoss] = useState('');
  const [message, setMessage] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      console.log('Report accident customer lookup', { userId: session.user.id, customer });
      if (customer) {
        const [vehicleResult, policyResult] = await Promise.all([
          supabase.from('vehicles').select('*').eq('customer_id', customer.id),
          supabase.from('policies').select('*').eq('customer_id', customer.id),
        ]);
        const nextVehicles = vehicleResult.data ?? [];
        const nextPolicies = policyResult.data ?? [];
        console.log('Report accident vehicle/policy lookup', {
          customer,
          vehicles: nextVehicles,
          policies: nextPolicies,
          vehicleError: vehicleResult.error,
          policyError: policyResult.error,
        });
        setVehicles(nextVehicles);
        setPolicies(nextPolicies);
        if (nextVehicles.length === 1) setVehicleNo(nextVehicles[0].vehicle_no);
        if (nextPolicies.length === 1) setPolicyNo(nextPolicies[0].policy_no);
      }
    }
    void load();
    setAccidentAt(new Date());
    void captureLocation();
  }, [router]);

  async function submit() {
    setMessage('');
    setSubmitting(true);
    let customer: Customer | null = null;
    let vehicle: Vehicle | undefined;
    let policy: Policy | undefined;
    let payload: Record<string, unknown> | null = null;
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      customer = await ensureCustomerForUser(session.user);
      console.log('Report accident ensured customer', { userId: session.user.id, customer });
      if (!customer) {
        setMessage('Your customer profile is not ready yet. Please sign out and sign in again, or contact support.');
        return;
      }

      vehicle = findVehicle(vehicles, vehicleNo);
      policy = findPolicy(policies, policyNo, vehicle?.id);
      console.log('Report accident selected vehicle/policy', { vehicleNo, policyNo, vehicle, policy });
      if (!vehicle || !policy) {
        setMessage('We could not find the selected vehicle or policy. Please check the details and try again.');
        return;
      }

      const estimatedLoss = parseEstimatedLoss(loss);
      if (estimatedLoss === undefined || Number.isNaN(accidentAt.getTime())) {
        setMessage('Please check the entered details and try again.');
        return;
      }

      payload = {
        claim_no: makeClaimNumber(),
        customer_id: customer.id,
        vehicle_id: vehicle.id,
        policy_id: policy.id,
        insurance_company_id: policy.insurance_company_id,
        current_status: 'Accident Reported',
        accident_at: accidentAt.toISOString(),
        accident_location: location.trim() || coordinatesToText(coordinates),
        accident_description: description.trim(),
        estimated_loss: estimatedLoss,
        created_by: session.user.id,
      };
      console.log('Report accident insert payload', { payload, customer, vehicle, policy, coordinates });
      const { error } = await supabase.from('claims').insert(payload);
      if (error) {
        console.error('Report accident insert failed', { payload, error, customer, vehicle, policy });
        setMessage(mapSubmitError(error));
      } else {
        router.replace('/customer/claims');
      }
    } catch (error) {
      console.error('Report accident submit crashed', { payload, error, customer, vehicle, policy });
      setMessage('We could not submit the accident report right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Report Accident" subtitle="Share the key details so the claim journey can begin." showLogout>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
        <TextField label="Vehicle number" value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" />
        <TextField label="Policy number" value={policyNo} onChangeText={setPolicyNo} />
        <View style={styles.readOnlyField}>
          <Text style={styles.label}>Accident Date & Time</Text>
          <Text style={styles.readOnlyValue}>{formatAccidentDate(accidentAt)}</Text>
        </View>
        {locationMessage ? <Message type="info">{locationMessage}</Message> : null}
        <TextField label="Location" value={location} onChangeText={setLocation} />
        <Pressable accessibilityRole="button" onPress={() => void captureLocation()} disabled={loadingLocation} style={styles.refreshLocationButton}>
          <Text style={styles.refreshLocationText}>{loadingLocation ? 'Capturing location...' : 'Refresh location'}</Text>
        </Pressable>
        <TextField label="What happened" value={description} onChangeText={setDescription} multiline />
        <TextField label="Estimated loss" value={loss} onChangeText={setLoss} keyboardType="decimal-pad" />
        <Button label={submitting ? 'Submitting...' : 'Submit report'} onPress={submit} disabled={submitting} />
      </Card>
      <Card>
        <Row label="Vehicles" value={vehicles.map((item) => item.vehicle_no).join(', ')} />
        <Row label="Policies" value={policies.map((item) => item.policy_no).join(', ')} />
      </Card>
    </Screen>
  );

  async function captureLocation() {
    setLocationMessage('');
    setLoadingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationMessage('We could not capture your location. You can enter it manually.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextCoordinates = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setCoordinates(nextCoordinates);

      const address = await reverseGeocode(nextCoordinates.latitude, nextCoordinates.longitude);
      setLocation(address || coordinatesToText(nextCoordinates));
    } catch (error) {
      console.error('Report accident location capture failed', { error });
      setLocationMessage('We could not capture your location. You can enter it manually.');
    } finally {
      setLoadingLocation(false);
    }
  }
}

async function reverseGeocode(latitude: number, longitude: number) {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!address) return '';
    return [address.name, address.street, address.city, address.region, address.postalCode, address.country]
      .filter(Boolean)
      .join(', ');
  } catch (error) {
    console.error('Report accident reverse geocode failed', { error, latitude, longitude });
    return '';
  }
}

function findVehicle(vehicles: Vehicle[], vehicleNo: string) {
  const normalized = normalizeIdentifier(vehicleNo);
  return vehicles.find((item) => normalizeIdentifier(item.vehicle_no) === normalized);
}

function findPolicy(policies: Policy[], policyNo: string, vehicleId?: string) {
  const normalized = normalizeIdentifier(policyNo);
  return policies.find((item) => normalizeIdentifier(item.policy_no) === normalized && (!vehicleId || item.vehicle_id === vehicleId));
}

function normalizeIdentifier(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function parseEstimatedLoss(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function coordinatesToText(coordinates: { latitude: number; longitude: number } | null) {
  if (!coordinates) return '';
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
}

function formatAccidentDate(date: Date) {
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function mapSubmitError(error: unknown) {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (message.toLowerCase().includes('invalid input syntax') || code === '22P02') return 'Please check the entered details and try again.';
  if (message.toLowerCase().includes('violates row-level security') || code === '42501') return 'Your customer profile is not ready yet. Please sign out and sign in again, or contact support.';
  if (message.toLowerCase().includes('foreign key') || code === '23503') return 'We could not find the selected vehicle or policy. Please check the details and try again.';
  return 'We could not submit the accident report right now. Please try again.';
}

const styles = StyleSheet.create({
  readOnlyField: { marginBottom: 12 },
  label: { color: colors.navy, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  readOnlyValue: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#F8FAFC', color: colors.navy, fontSize: 16, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 14 },
  refreshLocationButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: '#B9D5FF', backgroundColor: '#E8F1FB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: -4, marginBottom: 12 },
  refreshLocationText: { color: '#0B63CE', fontSize: 13, fontWeight: '800' },
});
