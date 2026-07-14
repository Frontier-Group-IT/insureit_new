import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { getCurrentSession, getCustomerForUser, getOnboardingApplicationForUser, startCustomerOnboarding } from '@/lib/auth';
import { palette } from '@/lib/theme';
import type { PartnerType } from '@/lib/types';

type PartnerOption = {
  value: PartnerType;
  label: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const partnerOptions: PartnerOption[] = [
  { value: 'individual_proprietor', label: 'Individual / Proprietor', description: 'Personal or proprietor account', icon: 'account-outline' },
  { value: 'dealership', label: 'Dealership', description: 'Vehicle dealer or service partner', icon: 'storefront-outline' },
  { value: 'corporate', label: 'Corporate', description: 'Registered company or enterprise', icon: 'office-building-outline' },
  { value: 'group', label: 'Group', description: 'Multiple linked entities under one group', icon: 'account-group-outline' },
];

export default function PartnerTypeScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [selected, setSelected] = useState<PartnerType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const customer = await getCustomerForUser(session.user.id);
        if (customer) return router.replace('/customer/home');
        const application = await getOnboardingApplicationForUser(session.user.id);
        if (!active) return;
        setUserId(session.user.id);
        setSelected(application?.partner_type ?? null);
      } catch {
        if (active) setError('We could not load your KYC application. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function saveSelection() {
    if (!selected || saving) return;
    if (selected !== 'individual_proprietor' && selected !== 'group') {
      setError(`${partnerOptions.find((option) => option.value === selected)?.label ?? 'This'} onboarding form will be added in the next workflow update.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const session = await getCurrentSession();
      if (!session?.user || session.user.id !== userId) return router.replace('/login');
      await startCustomerOnboarding(session.user, selected);
      router.replace(selected === 'group' ? '/customer/kyc/group' : '/customer/kyc/individual');
    } catch {
      setError('Your partner type could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><ActivityIndicator size="large" color="#0A43A3" /><Text style={styles.loadingText}>Opening your KYC</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/customer/home')} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={27} color={palette.navy} />
        </Pressable>
        <BrandLogo width={145} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Complete Your KYC</Text>
        <View style={styles.stepper}>
          {['Partner Type', 'Personal Details', 'Documents', 'Review'].map((label, index) => (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepCircle, index === 0 && styles.stepCircleActive]}><Text style={[styles.stepNumber, index === 0 && styles.stepNumberActive]}>{index + 1}</Text></View>
              <Text numberOfLines={2} style={[styles.stepLabel, index === 0 && styles.stepLabelActive]}>{label}</Text>
              {index < 3 ? <View style={styles.stepLine} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.formCard}>
          <View style={styles.introRow}>
            <View style={styles.introIcon}><MaterialCommunityIcons name="card-account-details-outline" size={38} color="#1597E5" /></View>
            <View style={styles.introCopy}><Text style={styles.introTitle}>Let&apos;s get started</Text><Text style={styles.introBody}>Select the account type that best describes you.</Text></View>
          </View>

          <Text style={styles.fieldTitle}>Partner Type <Text style={styles.required}>*</Text></Text>
          <View style={styles.optionList}>
            {partnerOptions.map((option) => {
              const active = selected === option.value;
              return (
                <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => setSelected(option.value)} style={[styles.option, active && styles.optionActive]}>
                  <View style={[styles.optionIcon, active && styles.optionIconActive]}><MaterialCommunityIcons name={option.icon} size={24} color={active ? '#FFFFFF' : '#0A43A3'} /></View>
                  <View style={styles.optionCopy}><Text style={styles.optionLabel}>{option.label}</Text><Text style={styles.optionDescription}>{option.description}</Text></View>
                  <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={23} color={active ? '#0A43A3' : '#A8B3C2'} />
                </Pressable>
              );
            })}
          </View>

          {error ? <View style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={17} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View> : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" disabled={!selected || saving} onPress={saveSelection} style={[styles.continueButton, (!selected || saving) && styles.continueButtonDisabled]}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.continueText}>Continue</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FC' },
  header: { height: 66, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backButton: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#D8E2EE', alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 42 },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 28 },
  screenTitle: { color: palette.navy, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  stepper: { flexDirection: 'row', marginTop: 22, marginBottom: 24 },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative' },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CDD6E2', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  stepCircleActive: { backgroundColor: '#082E72', borderColor: '#082E72' },
  stepNumber: { color: '#8B97A8', fontSize: 14, fontWeight: '700' },
  stepNumberActive: { color: '#FFFFFF' },
  stepLabel: { minHeight: 34, marginTop: 7, color: '#7A8798', fontSize: 10, lineHeight: 13, textAlign: 'center' },
  stepLabelActive: { color: palette.navy, fontWeight: '700' },
  stepLine: { position: 'absolute', left: '67%', top: 17, width: '66%', height: 2, backgroundColor: '#DCE3EC' },
  formCard: { borderRadius: 16, borderWidth: 1, borderColor: '#D9E2ED', backgroundColor: '#FFFFFF', padding: 17, shadowColor: '#102A4C', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 20 },
  introIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: '#EFF8FF', alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1 },
  introTitle: { color: palette.navy, fontSize: 17, fontWeight: '800' },
  introBody: { marginTop: 4, color: '#59687A', fontSize: 12.5, lineHeight: 18 },
  fieldTitle: { color: palette.navy, fontSize: 14, fontWeight: '700', marginBottom: 9 },
  required: { color: '#D92D20' },
  optionList: { overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: '#D8E1EC' },
  option: { minHeight: 76, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8EDF3' },
  optionActive: { backgroundColor: '#F4F8FF' },
  optionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  optionIconActive: { backgroundColor: '#0A43A3' },
  optionCopy: { flex: 1, minWidth: 0 },
  optionLabel: { color: palette.navy, fontSize: 14, fontWeight: '700' },
  optionDescription: { marginTop: 3, color: '#6A7788', fontSize: 10.5, lineHeight: 14 },
  errorBox: { marginTop: 13, borderRadius: 10, backgroundColor: '#FEF3F2', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: '#B42318', fontSize: 11.5, lineHeight: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  continueButton: { minHeight: 54, borderRadius: 12, backgroundColor: '#0A3B8F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  continueButtonDisabled: { backgroundColor: '#A8B3C2' },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#59687A', fontSize: 13 },
});
