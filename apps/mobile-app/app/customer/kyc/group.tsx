import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { ensureCustomerOnboardingForPartner, getCurrentSession, getProfile, saveOnboardingDraft } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { CustomerOnboardingApplication, Json, Profile } from '@/lib/types';

export default function GroupKycScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [application, setApplication] = useState<CustomerOnboardingApplication | null>(null);
  const [groupName, setGroupName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const [nextProfile, nextApplication] = await Promise.all([
          getProfile(session.user.id),
          ensureCustomerOnboardingForPartner(session.user, 'group'),
        ]);
        if (nextApplication.status === 'submitted' || nextApplication.status === 'under_review') return router.replace('/customer/group/under-review');
        if (nextApplication.partner_type !== 'group') {
          if (active) setError('Your Group KYC could not be opened. Go back and choose the partner type again.');
          return;
        }
        if (!active) return;
        const draft = asDraft(nextApplication.draft_data);
        setProfile(nextProfile);
        setApplication(nextApplication);
        setGroupName(textDraft(draft, 'group_name'));
        setOwnerName(textDraft(draft, 'owner_name') || nextProfile?.full_name || '');
        setEmail(textDraft(draft, 'email') || nextProfile?.email || session.user.email || '');
        const reviewNotes = textDraft(draft, 'review_notes');
        if (nextApplication.status === 'changes_requested' && reviewNotes) setError(`Please update your application: ${reviewNotes}`);
      } catch {
        if (active) setError('We could not open your Group KYC application. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const phone = application?.applicant_phone ?? profile?.phone ?? '';

  function validate() {
    if (groupName.trim().length < 2) return 'Enter the Group name.';
    if (ownerName.trim().length < 2) return 'Enter the owner or promoter name.';
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address or leave it blank.';
    if (!phone) return 'Your mobile number is missing. Please sign out and register again.';
    return '';
  }

  async function submit() {
    if (!application || submitting) return;
    const validationError = validate();
    if (validationError) return setError(validationError);
    setSubmitting(true);
    setError('');
    try {
      const draft: Json = {
        group_name: groupName.trim(),
        owner_name: ownerName.trim(),
        email: email.trim().toLowerCase() || null,
      };
      await saveOnboardingDraft(application.id, draft, 3);
      const { error: submitError } = await supabase.rpc('submit_group_onboarding_application', {
        p_application_id: application.id,
        p_group_name: groupName.trim(),
        p_owner_name: ownerName.trim(),
        p_email: email.trim() || null,
      });
      if (submitError) throw submitError;
      setSuccessVisible(true);
    } catch (nextError) {
      setError(nextError instanceof Error && nextError.message ? nextError.message : 'Your Group KYC could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><ActivityIndicator size="large" color="#0A43A3" /><Text style={styles.loadingText}>Preparing Group KYC</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/customer/kyc/partner-type')} style={styles.backButton}><MaterialCommunityIcons name="chevron-left" size={27} color={palette.navy} /></Pressable>
        <BrandLogo width={145} />
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Complete Your KYC</Text>
        <View style={styles.partnerSummary}><View style={styles.partnerIcon}><MaterialCommunityIcons name="account-group-outline" size={23} color="#0A43A3" /></View><View style={styles.partnerCopy}><Text style={styles.partnerEyebrow}>Partner type</Text><Text style={styles.partnerTitle}>Group</Text></View><MaterialCommunityIcons name="check-circle" size={21} color="#21A66B" /></View>
        <Text style={styles.intro}>Create the umbrella Group first. Corporate, Dealership and Individual customers can be associated after verification.</Text>
        {error ? <View style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View> : null}
        <View style={styles.card}>
          <Field label="Group name" required value={groupName} onChangeText={setGroupName} placeholder="Group or umbrella name" autoCapitalize="words" />
          <Field label="Owner / promoter name" required value={ownerName} onChangeText={setOwnerName} placeholder="Full name" autoCapitalize="words" />
          <Field label="Contact number" required value={phone} editable={false} icon="lock-outline" />
          <Field label="Email address" value={email} onChangeText={setEmail} placeholder="Optional email" keyboardType="email-address" autoCapitalize="none" />
        </View>
      </ScrollView>
      <View style={styles.footer}><Pressable accessibilityRole="button" disabled={submitting} onPress={submit} style={[styles.submitButton, submitting && styles.submitDisabled]}>{submitting ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.submitText}>Submit Group KYC</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></>}</Pressable></View>
      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => router.replace('/customer/group/under-review')}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.successIcon}><MaterialCommunityIcons name="check" size={34} color="#FFFFFF" /></View><Text style={styles.modalTitle}>KYC submitted</Text><Text style={styles.modalText}>Your Group details have been submitted for verification. You can now explore the Group dashboard.</Text><Pressable onPress={() => router.replace('/customer/group/under-review')} style={styles.modalButton}><Text style={styles.modalButtonText}>Open Group dashboard</Text></Pressable></View></View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, required = false, icon, ...props }: React.ComponentProps<typeof TextInput> & { label: string; required?: boolean; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return <View style={styles.field}><Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text><View style={styles.inputShell}>{icon ? <MaterialCommunityIcons name={icon} size={18} color="#7A8798" /> : null}<TextInput placeholderTextColor="#9AA7B8" style={styles.input} {...props} /></View></View>;
}
function asDraft(value: Json | null): Record<string, Json | undefined> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json | undefined> : {}; }
function textDraft(draft: Record<string, Json | undefined>, key: string) { const value = draft[key]; return typeof value === 'string' ? value : ''; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FC' },
  header: { height: 66, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backButton: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#D8E2EE', alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 42 }, content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 30 }, screenTitle: { color: palette.navy, fontSize: 22, fontWeight: '800', marginBottom: 12 },
  partnerSummary: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, borderWidth: 1, borderColor: '#D8E2EE', backgroundColor: '#FFFFFF', padding: 13 }, partnerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' }, partnerCopy: { flex: 1 }, partnerEyebrow: { color: '#7A8798', fontSize: 10.5 }, partnerTitle: { color: palette.navy, fontSize: 15, fontWeight: '800', marginTop: 2 },
  intro: { color: '#59687A', fontSize: 12.5, lineHeight: 19, marginVertical: 15 }, errorBox: { borderRadius: 11, backgroundColor: '#FEF3F2', padding: 11, flexDirection: 'row', gap: 8, marginBottom: 13 }, errorText: { flex: 1, color: '#B42318', fontSize: 12, lineHeight: 17 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#D9E2ED', backgroundColor: '#FFFFFF', padding: 16 }, field: { marginBottom: 15 }, label: { color: palette.navy, fontSize: 12.5, fontWeight: '700', marginBottom: 7 }, required: { color: '#D92D20' }, inputShell: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: '#D4DDE8', backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 }, input: { flex: 1, minHeight: 50, color: '#17202F', fontSize: 15 },
  footer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' }, submitButton: { minHeight: 54, borderRadius: 12, backgroundColor: '#0A3B8F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, submitDisabled: { opacity: 0.65 }, submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: '#59687A' }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }, modalCard: { width: '100%', maxWidth: 390, borderRadius: 20, backgroundColor: '#FFFFFF', padding: 24, alignItems: 'center' }, successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#21A66B', alignItems: 'center', justifyContent: 'center' }, modalTitle: { marginTop: 16, color: palette.navy, fontSize: 20, fontWeight: '800' }, modalText: { marginTop: 8, color: '#59687A', textAlign: 'center', lineHeight: 20 }, modalButton: { marginTop: 20, minHeight: 48, borderRadius: 12, backgroundColor: '#0A3B8F', paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' }, modalButtonText: { color: '#FFFFFF', fontWeight: '800' },
});