import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState, Message, Screen } from '@/components/ui';
import { ensureCustomerForUser, getCurrentSession, getOnboardingApplicationForUser, getProfile, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette, roleTheme } from '@/lib/theme';
import type { Customer, CustomerDocument, CustomerOnboardingApplication, Profile } from '@/lib/types';

const avatarIllustration = require('../../assets/profile/customer-avatar-illustration.png');
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [onboarding, setOnboarding] = useState<CustomerOnboardingApplication | null>(null);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [draft, setDraft] = useState({ name: '', phone: '', email: '', address: '' });
  const selectedDocType = 'Other';
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const float = useRef(new Animated.Value(0)).current;
  const successToastOpacity = useRef(new Animated.Value(0)).current;
  const successToastLift = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2200, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2200, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float]);

  useEffect(() => {
    if (message?.type !== 'success') {
      successToastOpacity.setValue(0);
      successToastLift.setValue(-8);
      return;
    }

    successToastOpacity.setValue(0);
    successToastLift.setValue(-8);

    Animated.parallel([
      Animated.timing(successToastOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(successToastLift, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(successToastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(successToastLift, { toValue: -8, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMessage((current) => current?.type === 'success' ? null : current);
      });
    }, 4300);

    return () => clearTimeout(timer);
  }, [message, successToastLift, successToastOpacity]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const [nextProfile, nextCustomer, nextOnboarding] = await Promise.all([getProfile(session.user.id), ensureCustomerForUser(session.user), getOnboardingApplicationForUser(session.user.id)]);
        if (!active) return;
        const documentResult = nextCustomer
          ? await supabase.from('customer_documents').select('*').eq('customer_id', nextCustomer.id).order('created_at', { ascending: false })
          : { data: [] };
        if (!active) return;
        setProfile(nextProfile); setCustomer(nextCustomer); setOnboarding(nextOnboarding); setDocuments(documentResult.data ?? []);
        setDraft({ name: nextCustomer?.contact_name ?? nextProfile?.full_name ?? '', phone: nextCustomer?.phone ?? nextProfile?.phone ?? '', email: nextCustomer?.email ?? nextProfile?.email ?? '', address: formatAddress(nextCustomer) });
      } catch {
        if (active) setMessage({ text: 'We could not load your profile. Please try again.', type: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const displayName = customer?.contact_name ?? profile?.full_name ?? 'Customer';
  const avatarLift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const avatarScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const profileAddress = useMemo(() => formatAddress(customer), [customer]);
  const kycAwaitingReview = onboarding?.status === 'submitted' || onboarding?.status === 'under_review';
  const kycRoute = onboarding?.partner_type === 'individual_proprietor' ? '/customer/kyc/individual' : '/customer/kyc/partner-type';

  async function saveContactDetails() {
    if (!profile || saving) return;

    setSaving(true);
    setMessage(null);

    try {
      const name = draft.name.trim();
      const phone = draft.phone.trim();
      const email = draft.email.trim();
      const address = draft.address.trim();

      if (!customer) {
        const profileResult = await supabase
          .from('profiles')
          .update({
            full_name: name,
            phone: phone || null,
            email: email || null,
          })
          .eq('id', profile.id)
          .select('*')
          .single();

        if (profileResult.error || !profileResult.data) {
          setMessage({ text: 'Your contact details could not be saved.', type: 'error' });
          return;
        }

        setProfile(profileResult.data);
        setEditing(false);
        setMessage({ text: 'Contact details saved successfully.', type: 'success' });
        return;
      }

      const customerResult = await supabase
        .from('customers')
        .update({
          contact_name: name,
          phone,
          email: email || null,
          address: address || null,
        })
        .eq('id', customer.id)
        .select('*')
        .single();

      if (customerResult.error || !customerResult.data) {
        setMessage({ text: 'Your contact details could not be saved.', type: 'error' });
        return;
      }

      setCustomer(customerResult.data);
      setEditing(false);
      setMessage({ text: 'Contact details saved successfully.', type: 'success' });

      const profileResult = await supabase
        .from('profiles')
        .update({
          full_name: name,
          phone: phone || null,
          email: email || null,
        })
        .eq('id', profile.id)
        .select('*')
        .single();

      if (!profileResult.error && profileResult.data) {
        setProfile(profileResult.data);
      }
    } catch (error) {
      console.error('Contact save failed', error);
      setMessage({ text: 'Your contact details could not be saved.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function uploadCustomerDocument() {
    if (!customer || !profile || documentUploading) return;
    setMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      setMessage({ text: 'Please upload a document below 5 MB.', type: 'error' });
      return;
    }

    setDocumentUploading(true);
    try {
      const extension = asset.name.includes('.') ? asset.name.split('.').pop() : 'bin';
      const storagePath = `${customer.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const response = await fetch(asset.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > 5 * 1024 * 1024) {
        setMessage({ text: 'Please upload a document below 5 MB.', type: 'error' });
        return;
      }
      const uploadResult = await supabase.storage.from('customer-documents').upload(storagePath, body, {
        contentType: asset.mimeType ?? 'application/octet-stream',
        upsert: false,
      });
      if (uploadResult.error) {
        setMessage({ text: 'Document upload failed. Please try again.', type: 'error' });
        return;
      }
      const { data, error } = await supabase.from('customer_documents').insert({
        customer_id: customer.id,
        document_type: selectedDocType,
        file_name: asset.name,
        storage_bucket: 'customer-documents',
        storage_path: storagePath,
        mime_type: asset.mimeType ?? null,
        file_size: asset.size ?? null,
        uploaded_by: profile.id,
      }).select('*').single();
      if (error || !data) setMessage({ text: 'Document uploaded, but record could not be saved.', type: 'error' });
      else {
        setDocuments((current) => [data, ...current]);
        setMessage({ text: 'Document uploaded.', type: 'success' });
      }
    } catch {
      setMessage({ text: 'Document upload failed. Please try again.', type: 'error' });
    } finally {
      setDocumentUploading(false);
    }
  }

  async function openCustomerDocument(document: CustomerDocument) {
    setMessage(null);
    const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
    if (error || !data?.signedUrl) return setMessage({ text: 'Could not open this document.', type: 'error' });
    await Linking.openURL(data.signedUrl);
  }

  async function deleteCustomerDocument(document: CustomerDocument) {
    setMessage(null);
    const { error } = await supabase.from('customer_documents').delete().eq('id', document.id);
    if (error) {
      setMessage({ text: 'Could not delete this document.', type: 'error' });
      return;
    }
    await supabase.storage.from(document.storage_bucket).remove([document.storage_path]);
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    setMessage({ text: 'Document deleted.', type: 'success' });
  }

  if (loading) return <Screen title="Profile"><LoadingState /></Screen>;

  return (
    <View style={styles.profileRoot}>
      <Screen title="Profile" showTitleHeader={false} topSpacing="compact">
      <View style={styles.pageHeading}><Text style={styles.pageTitle}>Profile</Text></View>
      {message?.type === 'error' ? <Message type="error">{message.text}</Message> : null}

      <View style={styles.hero}>
        <View style={styles.heroShield}><MaterialCommunityIcons name="shield-check-outline" size={72} color="rgba(255,255,255,0.13)" /></View>
        <Animated.View style={[styles.avatarShell, { transform: [{ translateY: avatarLift }, { scale: avatarScale }] }]}><Image source={avatarIllustration} style={styles.avatarImage} resizeMode="cover" /></Animated.View>
        <View style={styles.identity}><Text style={styles.customerName}>{displayName}</Text><Text style={styles.customerId}>{customer ? `Customer ID: ${customer.customer_code}` : 'Customer profile not activated'}</Text><View style={[styles.verified, !customer && styles.pendingVerification]}><MaterialCommunityIcons name={customer ? 'check-circle' : 'clock-outline'} size={15} color={customer ? '#69D6BA' : '#FFD27A'} /><Text style={[styles.verifiedText, !customer && styles.pendingVerificationText]}>{customer ? 'Verified account' : kycAwaitingReview ? 'KYC under review' : 'KYC pending'}</Text></View></View>
      </View>

      {!customer ? <Pressable accessibilityRole="button" disabled={kycAwaitingReview} onPress={() => router.push(kycRoute)} style={styles.kycActionCard}><View style={styles.kycActionIcon}><MaterialCommunityIcons name={kycAwaitingReview ? 'clipboard-clock-outline' : 'shield-account-outline'} size={25} color="#0A43A3" /></View><View style={styles.kycActionCopy}><Text style={styles.kycActionTitle}>{kycAwaitingReview ? 'Verification in progress' : onboarding?.partner_type ? 'Continue KYC' : 'Complete your KYC'}</Text><Text style={styles.kycActionText}>{kycAwaitingReview ? 'Your submitted details are being reviewed.' : 'Complete identity and business details to activate your customer profile.'}</Text></View>{kycAwaitingReview ? <View style={styles.reviewPill}><Text style={styles.reviewPillText}>Submitted</Text></View> : <MaterialCommunityIcons name="chevron-right" size={23} color="#0A43A3" />}</Pressable> : null}

      <Section title="Contact Information" icon="account-outline" action={editing ? undefined : 'Edit'} onAction={() => setEditing(true)}>
        {editing ? <View style={styles.editForm}><TextField label="Full name" value={draft.name} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} /><TextField label="Mobile number" value={draft.phone} keyboardType="phone-pad" onChangeText={(phone) => setDraft((current) => ({ ...current, phone }))} /><TextField label="Email address" value={draft.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(email) => setDraft((current) => ({ ...current, email }))} />{customer ? <TextField label="Address" value={draft.address} multiline onChangeText={(address) => setDraft((current) => ({ ...current, address }))} /> : null}<Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveContactDetails()} style={[styles.saveButton, saving && styles.disabled]}><Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text></Pressable></View> : <><ActionRow icon="phone-outline" label={customer?.phone ?? profile?.phone ?? 'Add mobile number'} onPress={() => void call(customer?.phone ?? profile?.phone)} /><ActionRow icon="email-outline" label={customer?.email ?? profile?.email ?? 'Add email address'} onPress={() => void email(customer?.email ?? profile?.email)} />{customer ? <ActionRow icon="map-marker-outline" label={profileAddress || 'Add your address'} onPress={() => void openMap(profileAddress)} /> : null}</>}
      </Section>

      {customer ? <View style={styles.kycVaultCard}>
        <Pressable accessibilityRole="button" onPress={() => setDocumentsOpen((current) => !current)} style={styles.kycVaultHeader}>
          <View style={styles.kycVaultIcon}><MaterialCommunityIcons name="shield-account-outline" size={22} color="#0B63CE" /></View>
          <View style={styles.kycVaultCopy}>
            <Text style={styles.kycVaultTitle}>Documents & KYC</Text>
            <Text style={styles.kycVaultSub}>{documents.length ? `${documents.length} document${documents.length === 1 ? '' : 's'} stored safely` : 'Keep PAN, Aadhaar, GST and other KYC files ready'}</Text>
          </View>
          <View style={styles.kycVaultCount}><Text style={styles.kycVaultCountText}>{documents.length}</Text></View>
          <MaterialCommunityIcons name={documentsOpen ? 'chevron-up' : 'chevron-down'} size={24} color={palette.navy} />
        </Pressable>

        {documentsOpen ? <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload document"
            disabled={documentUploading}
            onPress={() => void uploadCustomerDocument()}
            style={[styles.kycUploadPanel, documentUploading && styles.kycUploadButtonDisabled]}
          >
            <View style={styles.kycUploadTop}>
              <View>
                <Text style={styles.kycUploadLabel}>Upload document</Text>
              </View>
              <View style={styles.kycUploadButton}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={19} color="#FFFFFF" />
              </View>
            </View>
          </Pressable>

          <View style={styles.customerDocList}>
            {documents.length ? documents.map((document) => (
              <View key={document.id} style={styles.customerDocTile}>
                <View style={styles.customerDocIcon}><MaterialCommunityIcons name={documentIcon(document)} size={19} color="#0B63CE" /></View>
                <View style={styles.customerDocCopy}>
                  <Text style={styles.customerDocType}>{document.document_type}</Text>
                  <Text style={styles.customerDocName} numberOfLines={1}>{document.file_name}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => void openCustomerDocument(document)} style={styles.customerDocAction}>
                  <MaterialCommunityIcons name="open-in-new" size={16} color={palette.navy} />
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void deleteCustomerDocument(document)} style={[styles.customerDocAction, styles.customerDocDelete]}>
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#C43838" />
                </Pressable>
              </View>
            )) : (
              <View style={styles.emptyDocsPanel}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={roleTheme.customer.accent} />
                <Text style={styles.emptyDocsTitle}>No KYC documents uploaded yet</Text>
                <Text style={styles.emptyDocsText}>Tap Upload to add a customer document.</Text>
              </View>
            )}
          </View>
        </> : null}
      </View> : null}

      <Section title="Account & Privacy" icon="shield-account-outline">
        <ActionRow icon="file-document-outline" label="Privacy & Legal Center" onPress={() => router.push('/customer/legal')} />
        <ActionRow icon="account-remove-outline" label="Request account deletion" onPress={() => router.push('/customer/account-deletion')} />
      </Section>

      <Pressable accessibilityRole="button" onPress={() => void signOut(router)} style={styles.signOut}><MaterialCommunityIcons name="logout" size={18} color="#C43838" /><Text style={styles.signOutText}>Sign out securely</Text></Pressable>
      </Screen>

      {message?.type === 'success' ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.successToast,
            {
              top: insets.top + 78,
              opacity: successToastOpacity,
              transform: [{ translateY: successToastLift }],
            },
          ]}
        >
          <View style={styles.successToastIcon}>
            <MaterialCommunityIcons name="check-circle" size={22} color="#067647" />
          </View>
          <View style={styles.successToastCopy}>
            <Text style={styles.successToastTitle}>Success</Text>
            <Text style={styles.successToastText}>{message.text}</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Section({ title, icon, action, onAction, children }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; action?: string; onAction?: () => void; children: React.ReactNode }) { return <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.sectionTitleWrap}><View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={19} color="#0B63CE" /></View><Text style={styles.sectionTitle}>{title}</Text></View>{action ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.sectionAction}><Text style={styles.sectionActionText}>{action}</Text></Pressable> : null}</View>{children}</View>; }
function ActionRow({ icon, label, value, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionRow}><View style={styles.rowIcon}><MaterialCommunityIcons name={icon} size={19} color={roleTheme.customer.accent} /></View><Text style={styles.rowLabel} numberOfLines={value ? 1 : 2}>{label}</Text>{value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}<MaterialCommunityIcons name="chevron-right" size={19} color="#9BACBE" /></Pressable>; }
function TextField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.fieldInput} placeholderTextColor="#8090A6" {...props} /></View>; }
function documentIcon(document: CustomerDocument): keyof typeof MaterialCommunityIcons.glyphMap { if (document.mime_type?.startsWith('image/')) return 'image-outline'; if (document.mime_type === 'application/pdf' || /\.pdf$/i.test(document.file_name)) return 'file-pdf-box'; return 'file-document-outline'; }
function formatAddress(customer: Customer | null) { return [customer?.address, customer?.city, customer?.state, customer?.postal_code].filter(Boolean).join(', '); }
async function call(phone?: string | null) { if (phone) await Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`); }
async function email(address?: string | null) { if (address) await Linking.openURL(`mailto:${address}`); }
async function openMap(address?: string) { if (address) await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`); }

const styles = StyleSheet.create({
  profileRoot: { flex: 1, position: 'relative' },
  successToast: { position: 'absolute', left: 18, right: 18, zIndex: 30, elevation: 12, minHeight: 68, borderRadius: 18, borderWidth: 1, borderColor: '#B7E4CF', backgroundColor: '#F0FBF5', paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#0B3D2E', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  successToastIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  successToastCopy: { flex: 1, gap: 2 },
  successToastTitle: { color: '#05603A', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  successToastText: { color: '#067647', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  pageHeading: { marginTop: 0, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pageTitle: { color: palette.ink, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  hero: { minHeight: 177, marginHorizontal: -14, marginTop: 0, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 16, backgroundColor: '#061D43', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 14 }, heroShield: { position: 'absolute', right: 18, top: 23 }, avatarShell: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#EAF2FF', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: .3, shadowRadius: 12, elevation: 5 }, avatarImage: { width: '100%', height: '100%', transform: [{ scale: 1.24 }, { translateY: 11 }] }, identity: { flex: 1, minWidth: 0 }, customerName: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' }, customerId: { color: '#BDD2F2', fontSize: 11.5, fontWeight: '700', marginTop: 4 }, verified: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, borderRadius: 99, backgroundColor: 'rgba(52,183,139,.16)', paddingHorizontal: 8, paddingVertical: 5 }, verifiedText: { color: '#A5E5CD', fontSize: 10.5, fontWeight: '900' }, pendingVerification: { backgroundColor: 'rgba(238,172,55,.17)' }, pendingVerificationText: { color: '#FFDFA0' },
  kycActionCard: { minHeight: 74, marginTop: 10, borderRadius: 16, backgroundColor: '#F1F7FF', borderWidth: 1, borderColor: '#CFE1F7', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, kycActionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D4E6FA', alignItems: 'center', justifyContent: 'center' }, kycActionCopy: { flex: 1, minWidth: 0 }, kycActionTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '800' }, kycActionText: { color: '#5E6E82', fontSize: 9.8, lineHeight: 14, marginTop: 3 }, reviewPill: { borderRadius: 99, backgroundColor: '#FFF3D6', paddingHorizontal: 8, paddingVertical: 5 }, reviewPillText: { color: '#875B0E', fontSize: 8.8, fontWeight: '700' },
  section: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', marginTop: 10, overflow: 'hidden', shadowColor: palette.ink, shadowOpacity: .035, shadowRadius: 8, elevation: 1 }, sectionHeader: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E8EEF5' }, sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 }, sectionIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, sectionAction: { minHeight: 30, paddingHorizontal: 5, justifyContent: 'center' }, sectionActionText: { color: '#0B63CE', fontSize: 11, fontWeight: '900' },
  actionRow: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, rowIcon: { width: 27, alignItems: 'center' }, rowLabel: { flex: 1, color: palette.ink, fontSize: 11.8, fontWeight: '700' }, rowValue: { maxWidth: 105, color: palette.slate, fontSize: 10.5, fontWeight: '800', textAlign: 'right' },
  editForm: { padding: 12 }, field: { marginBottom: 10 }, fieldLabel: { color: palette.slate, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .3, marginBottom: 5 }, fieldInput: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', color: palette.ink, paddingHorizontal: 10, fontSize: 12, fontWeight: '700' }, saveButton: { height: 42, borderRadius: 12, backgroundColor: roleTheme.customer.accent, alignItems: 'center', justifyContent: 'center', marginTop: 2 }, saveButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, disabled: { opacity: .6 },
  fleetRow: { flexDirection: 'row', padding: 10, gap: 9 }, vehicleCard: { flex: 1, minWidth: 0, alignItems: 'center' }, vehicleImage: { width: '100%', height: 64 }, vehicleCopy: { alignSelf: 'stretch' }, vehicleName: { color: palette.ink, fontSize: 10.5, fontWeight: '900', textAlign: 'center', marginTop: 2 }, vehicleNo: { alignSelf: 'center', color: '#0B63CE', fontSize: 10, fontWeight: '900', backgroundColor: '#EEF5FF', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, marginTop: 4 }, policyState: { color: '#12805C', fontSize: 9.5, fontWeight: '800', textAlign: 'center', marginTop: 4 }, policyDot: { color: '#2BA26A' }, emptyPanel: { minHeight: 65, margin: 10, borderRadius: 12, backgroundColor: '#F8FBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 }, emptyPanelText: { color: palette.slate, fontSize: 11, fontWeight: '800', flex: 1 },
  kycVaultCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', marginTop: 10, overflow: 'hidden', shadowColor: palette.ink, shadowOpacity: .045, shadowRadius: 10, elevation: 2 },
  kycVaultHeader: { minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kycVaultIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D6E8FF' },
  kycVaultCopy: { flex: 1, minWidth: 0 },
  kycVaultTitle: { color: palette.navy, fontSize: 14.5, fontWeight: '900' },
  kycVaultSub: { color: palette.slate, fontSize: 10.7, lineHeight: 15, fontWeight: '800', marginTop: 3 },
  kycVaultCount: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: '#0B63CE', alignItems: 'center', justifyContent: 'center', shadowColor: '#0B63CE', shadowOpacity: .22, shadowRadius: 7, elevation: 2 },
  kycVaultCountText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  kycVaultSummary: { flexDirection: 'row', gap: 7, paddingHorizontal: 10, paddingBottom: 10 },
  kycMiniStat: { flex: 1, minHeight: 38, borderRadius: 12, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E1EAF4', alignItems: 'center', justifyContent: 'center', gap: 2 },
  kycMiniStatValue: { color: '#0B63CE', fontSize: 14, lineHeight: 16, fontWeight: '900' },
  kycMiniStatLabel: { color: palette.slate, fontSize: 8.8, fontWeight: '900', textAlign: 'center' },
  kycUploadPanel: { marginHorizontal: 10, marginBottom: 2, borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FBFDFF', overflow: 'hidden' },
  kycUploadTop: { padding: 11, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kycUploadLabel: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  kycUploadHint: { color: palette.slate, fontSize: 9.7, lineHeight: 13, fontWeight: '700', marginTop: 2 },
  kycUploadButton: { minWidth: 91, height: 36, borderRadius: 12, backgroundColor: roleTheme.customer.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10 },
  kycUploadButtonDisabled: { opacity: .55 },
  kycUploadButtonText: { color: '#FFFFFF', fontSize: 10.7, fontWeight: '900' },
  kycTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, paddingTop: 7 },
  kycTypeChip: { minHeight: 32, borderRadius: 12, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  kycTypeChipActive: { backgroundColor: '#0B63CE', borderColor: '#0B63CE' },
  kycTypeText: { color: palette.slate, fontSize: 10.5, fontWeight: '900' },
  kycTypeTextActive: { color: '#FFFFFF' },
  customerDocList: { padding: 10, gap: 8 },
  customerDocTile: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#E1EAF4', backgroundColor: '#FBFDFF', padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  customerDocIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  customerDocCopy: { flex: 1, minWidth: 0 },
  customerDocType: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  customerDocName: { color: palette.slate, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  customerDocAction: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  customerDocDelete: { borderColor: '#F2C6C6', backgroundColor: '#FFF8F8' },
  emptyDocsPanel: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 16, borderRadius: 14, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E1EAF4' },
  emptyDocsTitle: { color: palette.ink, fontSize: 12.5, fontWeight: '900', marginTop: 6 },
  emptyDocsText: { color: palette.slate, fontSize: 11, lineHeight: 16, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  preferenceToggle: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, preferenceLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 }, signOut: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#F2C6C6', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, marginBottom: 8 }, signOutText: { color: '#C43838', fontSize: 12, fontWeight: '900' },
});
