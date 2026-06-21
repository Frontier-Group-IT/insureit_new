import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDatePicker, AppSearchSelect, AppSectionHeader } from '@/components/design-system';
import { Button, Card, Message, Row, Screen, TextField } from '@/components/ui';
import { ensureCustomerForUser, getCurrentSession, getCustomerForUser, makeClaimNumber } from '@/lib/auth';
import { recordClaimEvent } from '@/lib/claim-notifications';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Customer, Policy, Vehicle } from '@/lib/types';

export default function ReportAccidentScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [accidentDate, setAccidentDate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [message, setMessage] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const [vehicleResult, policyResult] = await Promise.all([
          supabase.from('vehicles').select('*').eq('customer_id', customer.id).order('vehicle_no'),
          supabase.from('policies').select('*').eq('customer_id', customer.id).order('end_date', { ascending: false }),
        ]);
        const nextVehicles = vehicleResult.data ?? [];
        setVehicles(nextVehicles);
        setPolicies(policyResult.data ?? []);
        if (nextVehicles.length === 1) setSelectedVehicleId(nextVehicles[0].id);
      }
    }
    void load();
    void captureLocation();
  }, [router]);

  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === selectedVehicleId) ?? null, [selectedVehicleId, vehicles]);
  const selectedPolicy = useMemo(() => {
    if (!selectedVehicle) return null;
    return policies.find((item) => item.vehicle_id === selectedVehicle.id) ?? null;
  }, [policies, selectedVehicle]);

  function selectVehicle(vehicle: Vehicle) {
    setSelectedVehicleId(vehicle.id);
    const linkedPolicy = policies.find((item) => item.vehicle_id === vehicle.id);
    if (!linkedPolicy) setMessage('Policy details are not available for this vehicle.');
    else setMessage('');
  }

  async function submit() {
    setMessage('');
    if (!selectedVehicle || !selectedPolicy) {
      setMessage('Select a vehicle with active policy details.');
      return;
    }
    if (!driverName.trim() || !driverPhone.trim()) {
      setMessage('Enter driver name and phone number.');
      return;
    }
    const accidentAt = buildAccidentDate(accidentDate);
    if (!accidentAt) {
      setMessage('Select the accident date and time.');
      return;
    }
    setSubmitting(true);
    let customer: Customer | null = null;
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      customer = await ensureCustomerForUser(session.user);
      if (!customer) {
        setMessage('Your customer profile is not ready yet. Please contact support.');
        return;
      }

      const payload = {
        claim_no: makeClaimNumber(),
        customer_id: customer.id,
        vehicle_id: selectedVehicle.id,
        policy_id: selectedPolicy.id,
        insurance_company_id: selectedPolicy.insurance_company_id,
        current_status: 'Initial Documents Pending' as const,
        accident_at: accidentAt.toISOString(),
        accident_location: location.trim() || coordinatesToText(coordinates),
        accident_description: buildAccidentDescription({ driverName, driverPhone }),
        estimated_loss: null,
        created_by: session.user.id,
      };
      const { data: claim, error } = await supabase.from('claims').insert(payload).select('*').single();
      if (error || !claim) {
        setMessage(mapSubmitError(error));
        return;
      }
      try {
        await recordClaimEvent({
          claimId: claim.id,
          customerId: claim.customer_id,
          fromStatus: null,
          toStatus: claim.current_status,
          notes: 'New accident claim reported by customer.',
          changedBy: session.user.id,
          title: `New claim ${claim.claim_no}`,
        });
      } catch (eventError) {
        console.warn('Claim event logging skipped after customer claim creation', eventError);
      }
      router.replace({ pathname: '/customer/upload-documents', params: { claimId: claim.id } });
    } catch (error) {
      console.error('Report accident submit failed', { error, customer });
      setMessage('We could not submit the accident report right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Report Accident" showTitleHeader={false}>
      <View style={styles.intakeHero}>
        <View style={styles.heroWash} />
        <View style={styles.intakeIcon}>
          <MaterialCommunityIcons name="truck-alert-outline" size={24} color={palette.surface} />
        </View>
        <View style={styles.intakeCopy}>
          <Text style={styles.intakeEyebrow}>Commercial vehicle claim</Text>
          <Text style={styles.intakeTitle}>Accident report</Text>
        </View>
      </View>
      <View style={styles.stepStrip}>
        <StepPill done={Boolean(selectedVehicle && selectedPolicy)} label="Vehicle" />
        <StepPill done={Boolean(driverName && driverPhone && buildAccidentDate(accidentDate))} label="Accident" />
        <StepPill done={Boolean(location || coordinates)} label="Location" />
      </View>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
        <AppSectionHeader title="Vehicle" />
        <AppSearchSelect
          label="Vehicle number"
          placeholder="Search your vehicle"
          options={vehicles}
          selectedId={selectedVehicleId}
          onSelect={selectVehicle}
          getTitle={(vehicle) => vehicle.vehicle_no}
          getSubtitle={(vehicle) => [vehicle.make, vehicle.model, vehicle.vehicle_type].filter(Boolean).join(' | ')}
        />
        <Row label="Policy number" value={selectedPolicy?.policy_no} />
        <Row label="Policy period" value={selectedPolicy ? `${formatDate(selectedPolicy.start_date)} to ${formatDate(selectedPolicy.end_date)}` : null} />
      </Card>
      <Card>
        <AppSectionHeader title="Driver and accident" />
        <TextField label="Driver name" value={driverName} onChangeText={setDriverName} />
        <TextField label="Driver phone" keyboardType="phone-pad" value={driverPhone} onChangeText={setDriverPhone} />
        <AppDatePicker label="Accident date" value={accidentDate} onChange={setAccidentDate} formatDisplay={formatDisplayDate} />
        {locationMessage ? <Message type="info">{locationMessage}</Message> : null}
        <TextField label="Location" value={location} onChangeText={setLocation} />
        <View style={styles.locationButtons}>
          <Pressable accessibilityRole="button" onPress={() => void captureLocation()} disabled={loadingLocation} style={styles.refreshLocationButton}>
            <MaterialCommunityIcons name="crosshairs-gps" size={17} color={roleTheme.customer.accent} />
            <Text style={styles.refreshLocationText}>{loadingLocation ? 'Capturing...' : 'Refresh location'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={enterLocationManually} style={[styles.refreshLocationButton, styles.manualLocationButton]}>
            <MaterialCommunityIcons name="map-marker-plus-outline" size={17} color={palette.blue} />
            <Text style={[styles.refreshLocationText, styles.manualLocationText]}>Enter Manually</Text>
          </Pressable>
        </View>
        <Button label={submitting ? 'Saving claim...' : 'Continue'} onPress={submit} disabled={submitting} />
      </Card>
    </Screen>
  );

  async function captureLocation() {
    setLocationMessage('');
    setLoadingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationMessage('Enter the location manually.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextCoordinates = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setCoordinates(nextCoordinates);
      const address = await reverseGeocode(nextCoordinates.latitude, nextCoordinates.longitude);
      setLocation(address || coordinatesToText(nextCoordinates));
    } catch (error) {
      console.error('Report accident location capture failed', { error });
      setLocationMessage('Enter the location manually.');
    } finally {
      setLoadingLocation(false);
    }
  }

  function enterLocationManually() {
    setCoordinates(null);
    setLocation('');
    setLocationMessage('Type the accident location in the field above.');
  }
}

function StepPill({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={[styles.stepPill, done && styles.stepPillDone]}>
      <MaterialCommunityIcons name={done ? 'check-circle' : 'circle-outline'} size={15} color={done ? roleTheme.customer.accent : palette.slate} />
      <Text style={[styles.stepPillText, done && styles.stepPillTextDone]}>{label}</Text>
    </View>
  );
}

async function reverseGeocode(latitude: number, longitude: number) {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!address) return '';
    return [address.name, address.street, address.city, address.region, address.postalCode, address.country].filter(Boolean).join(', ');
  } catch (error) {
    console.error('Report accident reverse geocode failed', { error, latitude, longitude });
    return '';
  }
}

function coordinatesToText(coordinates: { latitude: number; longitude: number } | null) {
  if (!coordinates) return '';
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
}

function buildAccidentDescription({ driverName, driverPhone }: { driverName: string; driverPhone: string }) {
  return [
    `Driver: ${driverName.trim()}`,
    `Driver phone: ${driverPhone.trim()}`,
  ].filter(Boolean).join('\n');
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildAccidentDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDisplayDate(value: string) {
  const parsed = buildAccidentDate(value);
  if (!parsed) return '';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mapSubmitError(error: unknown) {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (message.toLowerCase().includes('violates row-level security') || code === '42501') return 'Your customer profile is not ready yet. Please contact support.';
  if (message.toLowerCase().includes('foreign key') || code === '23503') return 'Policy details are not available for this vehicle.';
  return 'We could not submit the accident report right now. Please try again.';
}

const styles = StyleSheet.create({
  intakeHero: { borderRadius: radii.lg, backgroundColor: palette.blue, borderWidth: 1, borderColor: '#0750C7', padding: 15, marginTop: -8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', shadowColor: palette.blue, shadowOpacity: 0.14, shadowRadius: 14, elevation: 3 },
  heroWash: { position: 'absolute', right: -54, top: -70, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.18)' },
  intakeIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.17)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)', alignItems: 'center', justifyContent: 'center' },
  intakeCopy: { flex: 1, minWidth: 0 },
  intakeEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0 },
  intakeTitle: { color: palette.surface, fontSize: 20, fontWeight: '900', lineHeight: 25, marginTop: 2 },
  stepStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  stepPill: { minHeight: 34, borderRadius: radii.sm, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepPillDone: { backgroundColor: roleTheme.customer.soft, borderColor: '#BCE9D2' },
  stepPillText: { color: palette.slate, fontSize: 12, fontWeight: '600' },
  stepPillTextDone: { color: roleTheme.customer.accent },
  label: { color: palette.ink, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  locationButtons: { flexDirection: 'row', gap: 8, marginTop: -4, marginBottom: 12 },
  refreshLocationButton: { flex: 1, minHeight: 42, borderRadius: radii.sm, borderWidth: 1, borderColor: '#BCE9D2', backgroundColor: roleTheme.customer.soft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, flexDirection: 'row', gap: 7 },
  manualLocationButton: { borderColor: '#C7DEFF', backgroundColor: palette.blueSoft },
  refreshLocationText: { color: roleTheme.customer.accent, fontSize: 13, fontWeight: '700' },
  manualLocationText: { color: palette.blue },
});
