import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { getCurrentSession, getProfile } from '@/lib/auth';
import { palette } from '@/lib/theme';

export default function InsuranceQuoteScreen() {
  const router = useRouter();
  const [vehicleNo, setVehicleNo] = useState('');
  const [message, setMessage] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [profileInitial, setProfileInitial] = useState('I');

  useEffect(() => {
    let active = true;
    async function loadSession() {
      const session = await getCurrentSession();
      if (!active) return;
      setIsSignedIn(Boolean(session?.user));
      if (!session?.user) return;
      const profile = await getProfile(session.user.id);
      if (active) setProfileInitial(initialFor(profile?.full_name ?? session.user.email ?? 'InsureIT'));
    }
    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  function submit() {
    setMessage(vehicleNo.trim().length < 6 ? 'Please enter a valid vehicle number.' : 'Quote request workflow will be connected in the next step.');
  }

  function updateVehicleNo(text: string) {
    setVehicleNo(formatVehicleNo(text));
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

      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={styles.glow} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>GET QUOTE IN 2 MINUTES</Text>
          </View>
          <Text style={styles.title}>Commercial Vehicle Insurance</Text>
          <Text style={styles.priceLine}>
            Starts at <Text style={styles.price}>Rs 3,139*</Text>
          </Text>
          <View style={styles.inputWrap}>
            <Text style={styles.label}>Vehicle No.</Text>
            <TextInput
              value={vehicleNo}
              onChangeText={updateVehicleNo}
              autoCapitalize="characters"
              placeholder="e.g. MP-20-CB-1234"
              placeholderTextColor="#8A94A6"
              style={styles.input}
            />
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable onPress={submit} style={styles.button}>
            <Text style={styles.buttonText}>View Prices</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.consentText}>
            By clicking on {'"'}View prices{'"'}, you agree to our{' '}
            <Text onPress={() => router.push(isSignedIn ? '/customer/legal/privacy-policy' : '/legal/privacy-policy')} style={styles.consentLink}>Privacy Policy</Text>
            {' '}and{' '}
            <Text onPress={() => router.push(isSignedIn ? '/customer/legal/terms-of-use' : '/legal/terms-of-use')} style={styles.consentLink}>Terms of Use</Text>.
          </Text>
        </View>

        <Pressable onPress={() => router.push(isSignedIn ? '/customer/add-vehicle' : '/login')} style={styles.newVehicleCard}>
          <View style={styles.newVehicleIcon}>
            <MaterialCommunityIcons name="truck-plus-outline" size={20} color="#0B63CE" />
          </View>
          <Text style={styles.newVehicleText}>Brand new vehicle?</Text>
          <Text style={styles.newVehicleAction}>Click here</Text>
          <MaterialCommunityIcons name="chevron-right" size={21} color={palette.navy} />
        </Pressable>

        <View style={styles.expert}>
          <MaterialCommunityIcons name="headset" size={34} color="#FFFFFF" />
          <View style={styles.expertCopy}>
            <Text style={styles.expertTitle}>Need expert help?</Text>
            <Text style={styles.expertBody}>Talk to an InsureIT expert for the best commercial vehicle policy.</Text>
            <Pressable onPress={() => router.push(isSignedIn ? '/customer/support' : '/login')} style={styles.expertButton}>
              <Text style={styles.expertButtonText}>Talk to Expert</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => router.push(isSignedIn ? '/customer/legal' : '/legal/terms-of-use')} style={styles.legalCenterLink}>
          <MaterialCommunityIcons name="shield-check-outline" size={13} color="#607086" />
          <Text style={styles.legalCenterText}>View all legal policies</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
  body: { flex: 1, padding: 14, gap: 9 },
  hero: { borderRadius: 22, padding: 15, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1, borderColor: '#DDEBFA', elevation: 3 },
  glow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -78, top: -74, backgroundColor: '#E3F1FF' },
  badge: { alignSelf: 'flex-start', borderRadius: 12, backgroundColor: '#E6F2FF', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  badgeText: { color: '#174777', fontSize: 10.5, fontWeight: '900' },
  title: { color: palette.navy, fontSize: 25, lineHeight: 30, fontWeight: '900' },
  priceLine: { color: '#344054', fontSize: 14.5, fontWeight: '700', marginTop: 5 },
  price: { color: '#F06423', fontSize: 24, fontWeight: '900' },
  inputWrap: { marginTop: 14, borderRadius: 16, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#CFE0F2', padding: 11 },
  label: { color: '#5F6C7A', fontSize: 11, fontWeight: '900' },
  input: { minHeight: 35, color: palette.navy, fontSize: 17, fontWeight: '900' },
  message: { color: palette.navy, fontSize: 11.5, fontWeight: '800', marginTop: 8 },
  button: { marginTop: 11, minHeight: 50, borderRadius: 16, backgroundColor: '#0969F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  consentText: { color: '#607086', fontSize: 8.6, lineHeight: 12, fontWeight: '700', textAlign: 'center', paddingTop: 7, paddingHorizontal: 0 },
  consentLink: { color: '#0B63CE', fontWeight: '900', textDecorationLine: 'underline' },
  newVehicleCard: { minHeight: 48, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6E7FA', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  newVehicleIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  newVehicleText: { color: palette.navy, fontSize: 13, fontWeight: '900', flex: 1 },
  newVehicleAction: { color: '#0B63CE', fontSize: 12, fontWeight: '900' },
  legalCenterLink: { alignSelf: 'center', minHeight: 25, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.68)', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 'auto' },
  legalCenterText: { color: '#607086', fontSize: 10, fontWeight: '900' },
  expert: { minHeight: 118, borderRadius: 20, backgroundColor: palette.navy, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  expertCopy: { flex: 1 },
  expertTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  expertBody: { color: 'rgba(255,255,255,0.78)', fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 4 },
  expertButton: { alignSelf: 'flex-start', minHeight: 35, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  expertButtonText: { color: palette.navy, fontSize: 12, fontWeight: '900' },
});
