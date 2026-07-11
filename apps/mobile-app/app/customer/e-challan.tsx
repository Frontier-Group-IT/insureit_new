import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { getCurrentSession, getCustomerForUser, getProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Vehicle } from '@/lib/types';

export default function EChallanScreen() {
  const router = useRouter();
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [profileInitial, setProfileInitial] = useState('I');

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!active) return;
      setIsSignedIn(Boolean(session?.user));
      if (!session?.user) return;
      const profile = await getProfile(session.user.id);
      if (active) setProfileInitial(initialFor(profile?.full_name ?? session.user.email ?? 'InsureIT'));
      const customer = await getCustomerForUser(session.user.id);
      if (!customer) return;
      if (active) setProfileInitial(initialFor(customer.contact_name ?? profile?.full_name ?? session.user.email ?? 'InsureIT'));
      const { data } = await supabase
        .from('vehicles')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      if (active) setVehicles(data ?? []);
    }
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  const vehicleOptions = useMemo(() => vehicles.filter((vehicle) => vehicle.vehicle_no).slice(0, 4), [vehicles]);

  function updateVehicleNo(text: string) {
    setVehicleNo(formatVehicleNo(text));
    setChecked(false);
    setMessage('');
  }

  function checkChallan() {
    if (vehicleNo.replace(/-/g, '').length < 6) {
      setMessage('Enter a valid vehicle number to check challan status.');
      setChecked(false);
      return;
    }
    setMessage('');
    setChecked(true);
  }

  function goBack() {
    router.replace(isSignedIn ? '/customer/home' : '/login');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={25} color={palette.ink} />
        </Pressable>
        <Pressable onPress={goBack} style={styles.brand}>
          <BrandLogo width={158} />
        </Pressable>
        {isSignedIn ? (
          <>
            <NotificationBell />
            <Pressable onPress={() => router.push('/customer/profile')} style={styles.avatar}>
              <Text style={styles.avatarText}>{profileInitial}</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={30} color="#0F9F9A" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>TRAFFIC FINE STATUS</Text>
              <Text style={styles.title}>E Challan</Text>
              <Text style={styles.subtitle}>Check traffic challans for your vehicle number and continue on the official portal when payment is required.</Text>
            </View>
          </View>

          <View style={styles.inputCard}>
            <Text style={styles.label}>Vehicle number</Text>
            <TextInput
              value={vehicleNo}
              onChangeText={updateVehicleNo}
              autoCapitalize="characters"
              placeholder="MP-20-CB-1234"
              placeholderTextColor="#8A94A6"
              style={styles.input}
            />
            {vehicleOptions.length ? (
              <View style={styles.vehicleChips}>
                {vehicleOptions.map((vehicle) => (
                  <Pressable key={vehicle.id} onPress={() => updateVehicleNo(vehicle.vehicle_no)} style={styles.vehicleChip}>
                    <MaterialCommunityIcons name="truck-outline" size={14} color="#0B63CE" />
                    <Text style={styles.vehicleChipText}>{vehicle.vehicle_no}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <Pressable onPress={checkChallan} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Check Challan</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat icon="shield-check-outline" label="Secure" value="Vehicle check" />
          <Stat icon="file-search-outline" label="Status" value="Official flow" />
          <Stat icon="receipt-text-outline" label="Payment" value="Portal ready" />
        </View>

        {checked ? (
          <View style={styles.resultCard}>
            <View style={styles.resultTop}>
              <View style={styles.resultIcon}>
                <MaterialCommunityIcons name="information-outline" size={24} color="#0B63CE" />
              </View>
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle}>Challan check noted</Text>
                <Text style={styles.resultText}>We are preparing an assisted challan verification flow for {vehicleNo}. You can review the steps below while this service is being connected.</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.stepsCard}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <Step index="1" title="Enter vehicle number" body="Use your registration number or choose one of your saved vehicles." />
          <Step index="2" title="Verify challan details" body="Review violation, date, location, and penalty details on the official system." />
          <Step index="3" title="Resolve safely" body="Pay or contest the challan only after checking the details carefully." />
        </View>

        <View style={styles.disclaimer}>
          <MaterialCommunityIcons name="shield-alert-outline" size={18} color="#607086" />
          <Text style={styles.disclaimerText}>Challan records and payments are handled by government or traffic authority systems. Always verify details before payment.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <MaterialCommunityIcons name={icon} size={19} color="#0F9F9A" />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Step({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNo}>
        <Text style={styles.stepNoText}>{index}</Text>
      </View>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

function formatVehicleNo(value: string) {
  const raw = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const state = raw.slice(0, 2).replace(/[^A-Z]/g, '');
  const district = raw.slice(2, 4).replace(/[^0-9]/g, '');
  const series = raw.slice(4, 6).replace(/[^A-Z]/g, '');
  const number = raw.slice(6, 10).replace(/[^0-9]/g, '');
  return [state, district, series, number].filter(Boolean).join('-');
}

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'I';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4FAFF' },
  header: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' },
  backButton: { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(191,216,255,0.78)' },
  brand: { flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '900' },
  scroll: { flex: 1 },
  body: { padding: 14, gap: 12, paddingBottom: 26 },
  hero: { borderRadius: 22, padding: 14, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1, borderColor: '#DDEBFA', elevation: 3 },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -80, top: -76, backgroundColor: '#DFF8F4' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#E9FAF8', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#0F9F9A', fontSize: 10.5, fontWeight: '900' },
  title: { color: palette.navy, fontSize: 26, lineHeight: 30, fontWeight: '900', marginTop: 1 },
  subtitle: { color: '#536477', fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  inputCard: { marginTop: 12, borderRadius: 17, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#CFE0F2', padding: 12 },
  label: { color: '#5F6C7A', fontSize: 11, fontWeight: '900' },
  input: { minHeight: 39, color: palette.navy, fontSize: 18, fontWeight: '900' },
  vehicleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 6 },
  vehicleChip: { minHeight: 30, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E6F5', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  vehicleChipText: { color: palette.navy, fontSize: 11, fontWeight: '900' },
  message: { color: '#B42318', fontSize: 11.5, fontWeight: '800', marginTop: 8 },
  primaryButton: { marginTop: 12, minHeight: 50, borderRadius: 16, backgroundColor: '#0F9F9A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  stats: { minHeight: 78, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF5', flexDirection: 'row', paddingVertical: 10, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  statLabel: { color: '#607086', fontSize: 10, fontWeight: '900', marginTop: 4 },
  statValue: { color: palette.navy, fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  resultCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E6F5', padding: 13, elevation: 2 },
  resultTop: { flexDirection: 'row', gap: 11 },
  resultIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1 },
  resultTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' },
  resultText: { color: '#536477', fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 4 },
  stepsCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF5', padding: 14, gap: 12 },
  sectionTitle: { color: palette.navy, fontSize: 17, fontWeight: '900' },
  step: { flexDirection: 'row', gap: 10 },
  stepNo: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#E9FAF8', alignItems: 'center', justifyContent: 'center' },
  stepNoText: { color: '#0F9F9A', fontSize: 13, fontWeight: '900' },
  stepCopy: { flex: 1 },
  stepTitle: { color: palette.navy, fontSize: 13, fontWeight: '900' },
  stepBody: { color: '#607086', fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  disclaimer: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: '#DCE8F4', padding: 11, flexDirection: 'row', gap: 9 },
  disclaimerText: { flex: 1, color: '#607086', fontSize: 10.8, lineHeight: 15, fontWeight: '700' },
});
