import { partnerAlert } from '@/components/ui/partner-alert-provider';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { getAccountDeletionRequest, submitAccountDeletionRequest, type AccountDeletionRequest } from '@/lib/account-deletion';

export default function AccountDeletionScreen() {
  const router = useRouter();
  const [request, setRequest] = useState<AccountDeletionRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getAccountDeletionRequest().then((value) => { if (active) setRequest(value); })
      .catch(() => { if (active) setError('Could not load deletion request status. Please try again.'); });
    return () => { active = false; };
  }, []);
  const submit = () => partnerAlert(
    'Request account deletion?',
    'This requests deletion of your individual login and eligible personal information. Insurance, claims, commission and other business records may be retained where legally required. Your access may continue until the request is verified and fulfilled.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Request deletion', style: 'destructive', onPress: () => {
      setBusy(true);
      setError('');
      void submitAccountDeletionRequest().then(setRequest)
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Request failed.'))
        .finally(() => setBusy(false));
    } }],
  );
  const active = request?.status === 'requested' || request?.status === 'under_review' || request?.status === 'fulfilling';
  return <PartnerScreen title="Account deletion" hideTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation activeTab="More" />}>
    <PartnerCasePageHeader title="Account deletion" icon="shield-checkmark-outline" onBack={() => router.back()} />
    <ScrollView style={styles.canvas} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroCircleLarge} />
        <View pointerEvents="none" style={styles.heroCircleSmall} />
        <View style={styles.heroCopy}>
          <Text accessibilityRole="header" style={styles.heroTitle}>Your account,</Text>
          <Text style={[styles.heroTitle, styles.heroTitleAccent]}>your choice</Text>
          <View style={styles.heroUnderline} />
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroBrand}>
          <Image source={require('../assets/insureit-partner-official.png')} style={styles.heroLogo} resizeMode="contain" accessibilityLabel="INSUREIT Partner" />
          <Text style={styles.heroBrandName}>insureit</Text>
          <Text style={styles.heroBrandPartner}>Partner</Text>
        </View>
      </View>
      <Text style={styles.intro}>Request removal of your individual INSUREIT Partner login and eligible personal data. We verify ownership and legal retention obligations before fulfillment.</Text>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.infoIcon}><Ionicons name="information" size={20} color="#FFFFFF" /></View>
          <Text style={styles.label}>What happens to your data?</Text>
        </View>
        <Text style={styles.cardText}>Your individual access and eligible account data will be deleted after review. The Partner organization and its legitimate customer, policy, claim, financial, regulatory and audit records are not automatically deleted. Some information may be retained where required by law.</Text>
      </View>
      {request ? <View style={styles.requestCard}>
        <Text style={styles.requestLabel}>Latest request: {request.status.replace('_', ' ')}</Text>
        <Text style={styles.cardText}>Requested {new Date(request.requested_at).toLocaleDateString('en-IN')}. We will confirm fulfillment after the required verification.</Text>
      </View> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={active ? 'Request already submitted' : 'Request account deletion'} accessibilityState={{ disabled: busy || active }}
        disabled={busy || active} onPress={submit} style={({ pressed }) => [styles.button, (busy || active) && styles.disabled, pressed && styles.pressed]}>
        <View style={styles.buttonIcon}><Ionicons name="trash-outline" size={24} color="#FFFFFF" /></View>
        <View style={styles.buttonDivider} />
        <Text style={styles.buttonText}>{busy ? 'Submitting…' : active ? 'Request already submitted' : 'Request account deletion'}</Text>
        <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
      </Pressable>
      <View style={styles.noteCard}>
        <View style={styles.noteIcon}><Ionicons name="shield-checkmark" size={29} color="#7138D8" /></View>
        <Text style={styles.note}>Submitting a request does not instantly remove your account. For assistance, contact the INSUREIT support team. <Text style={styles.noteEmphasis}>You will not need to provide your password to support.</Text></Text>
      </View>
      <View pointerEvents="none" style={styles.bottomWaves}>
        <View style={styles.waveBack} />
        <View style={styles.waveFront} />
      </View>
    </ScrollView>
  </PartnerScreen>;
}
const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#FAF7FF', marginHorizontal: -18 },
  body: { paddingHorizontal: 18, paddingBottom: 28, gap: 19, minHeight: 700 },
  hero: { height: 144, marginHorizontal: -18, paddingHorizontal: 20, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1E6FF' },
  heroCircleLarge: { position: 'absolute', height: 215, width: 215, borderRadius: 108, right: -72, top: -94, backgroundColor: '#7022CE' },
  heroCircleSmall: { position: 'absolute', height: 125, width: 125, borderRadius: 63, right: -42, top: -65, backgroundColor: '#8E4CF0', opacity: 0.9 },
  heroCopy: { flex: 1, minWidth: 0, paddingRight: 10, zIndex: 1 },
  heroTitle: { fontSize: 24, lineHeight: 29, fontWeight: '900', color: '#171B59', letterSpacing: -0.6 },
  heroTitleAccent: { color: '#4726B6' },
  heroUnderline: { width: 83, height: 4, borderRadius: 3, marginTop: 9, backgroundColor: '#8241E9' },
  heroDivider: { height: 72, width: 1.5, backgroundColor: '#5E2BBB', marginRight: 12, zIndex: 1 },
  heroBrand: { width: 114, minHeight: 80, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  heroLogo: { width: 52, height: 42, marginBottom: 3 },
  heroBrandName: { fontSize: 17, lineHeight: 20, fontWeight: '900', color: '#FFFFFF' },
  heroBrandPartner: { fontSize: 13, lineHeight: 17, fontWeight: '900', color: '#FFCB53' },
  intro: { fontSize: 14, lineHeight: 23, color: '#242657', fontWeight: '500' },
  card: { overflow: 'hidden', borderRadius: 22, backgroundColor: '#FCFAFF', borderWidth: 1, borderColor: '#E2D3FA', shadowColor: '#7C4FC8', shadowOpacity: 0.12, shadowRadius: 9, elevation: 2 },
  cardHeader: { minHeight: 64, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0E4FF' },
  infoIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7732D7' },
  label: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '900', color: '#25205C' },
  cardText: { paddingHorizontal: 17, paddingVertical: 17, fontSize: 13.5, lineHeight: 22, color: '#30305B' },
  requestCard: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#E2D3FA', backgroundColor: '#FFFFFF' },
  requestLabel: { fontSize: 14, fontWeight: '800', color: '#342177', paddingHorizontal: 17, paddingTop: 14 },
  button: { minHeight: 66, borderRadius: 33, backgroundColor: '#D80920', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, shadowColor: '#A60018', shadowOpacity: 0.18, shadowRadius: 7, elevation: 3, borderBottomWidth: 3, borderBottomColor: '#A30013' },
  buttonIcon: { width: 31, alignItems: 'center', justifyContent: 'center' },
  buttonDivider: { width: 1, height: 33, backgroundColor: 'rgba(255,255,255,0.65)' },
  buttonText: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  error: { color: '#B32636', fontSize: 13, fontWeight: '600' },
  noteCard: { minHeight: 100, borderRadius: 21, backgroundColor: '#EFE3FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 13, gap: 12 },
  noteIcon: { width: 43, alignItems: 'center', justifyContent: 'center' },
  note: { flex: 1, fontSize: 12.5, lineHeight: 20, color: '#302866' },
  noteEmphasis: { fontWeight: '800', color: '#241B59' },
  bottomWaves: { height: 120, marginTop: 32, marginHorizontal: -18, overflow: 'hidden' },
  waveBack: { position: 'absolute', left: -60, right: -45, bottom: -68, height: 142, borderTopLeftRadius: 200, borderTopRightRadius: 170, backgroundColor: '#EAD8FF', transform: [{ rotate: '-5deg' }] },
  waveFront: { position: 'absolute', left: -65, right: -60, bottom: -92, height: 138, borderTopLeftRadius: 125, borderTopRightRadius: 210, backgroundColor: '#F4EAFF', transform: [{ rotate: '7deg' }] },
});
