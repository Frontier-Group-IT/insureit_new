import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { LoadingState, Message, Screen } from '@/components/ui';
import { ensureCustomerForUser, getCurrentSession, getProfile, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette, roleTheme } from '@/lib/theme';
import type { Claim, Customer, CustomerDocument, Policy, Profile, SupportTicket, Vehicle } from '@/lib/types';

const avatarIllustration = require('../../assets/profile/customer-avatar-illustration.png');
const kycDocumentTypes = ['PAN Card', 'Aadhaar Card', 'GST Certificate', 'RC Copy', 'Address Proof', 'Other'];

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({ name: '', phone: '', email: '', address: '' });
  const [selectedDocType, setSelectedDocType] = useState('PAN Card');
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2200, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2200, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const [nextProfile, nextCustomer] = await Promise.all([getProfile(session.user.id), ensureCustomerForUser(session.user)]);
        if (!nextCustomer || !active) return router.replace('/customer/home');
        const [vehicleResult, policyResult, claimResult, documentResult, ticketResult] = await Promise.all([
          supabase.from('vehicles').select('*').eq('customer_id', nextCustomer.id).order('created_at', { ascending: false }),
          supabase.from('policies').select('*').eq('customer_id', nextCustomer.id).order('created_at', { ascending: false }),
          supabase.from('claims').select('*').eq('customer_id', nextCustomer.id).order('updated_at', { ascending: false }),
          supabase.from('customer_documents').select('*').eq('customer_id', nextCustomer.id).order('created_at', { ascending: false }),
          supabase.from('support_tickets').select('*').eq('customer_id', nextCustomer.id).order('created_at', { ascending: false }),
        ]);
        if (!active) return;
        setProfile(nextProfile); setCustomer(nextCustomer); setVehicles(vehicleResult.data ?? []); setPolicies(policyResult.data ?? []); setClaims(claimResult.data ?? []); setDocuments(documentResult.data ?? []); setTickets(ticketResult.data ?? []);
        setDraft({ name: nextCustomer.contact_name ?? nextProfile?.full_name ?? '', phone: nextCustomer.phone ?? nextProfile?.phone ?? '', email: nextCustomer.email ?? nextProfile?.email ?? '', address: formatAddress(nextCustomer) });
        if (ticketResult.error) setMessage('Support ticket summary is temporarily unavailable.');
      } catch {
        if (active) setMessage('We could not load your profile. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const displayName = customer?.contact_name ?? profile?.full_name ?? 'Customer';
  const activePolicies = policies.filter((policy) => new Date(policy.end_date).getTime() >= Date.now()).length;
  const openClaims = claims.filter((claim) => !['Settled', 'Closed', 'Rejected'].includes(claim.current_status)).length;
  const avatarLift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const avatarScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const profileAddress = useMemo(() => formatAddress(customer), [customer]);

  async function saveContactDetails() {
    if (!customer || !profile) return;
    setSaving(true); setMessage('');
    const [customerResult, profileResult] = await Promise.all([
      supabase.from('customers').update({ contact_name: draft.name.trim(), phone: draft.phone.trim(), email: draft.email.trim() || null, address: draft.address.trim() || null }).eq('id', customer.id).select('*').single(),
      supabase.from('profiles').update({ full_name: draft.name.trim(), phone: draft.phone.trim() || null, email: draft.email.trim() || null }).eq('id', profile.id).select('*').single(),
    ]);
    if (customerResult.error || profileResult.error) setMessage('Your contact details could not be saved.');
    else { setCustomer(customerResult.data); setProfile(profileResult.data); setEditing(false); setMessage('Contact details saved.'); }
    setSaving(false);
  }

  async function uploadCustomerDocument() {
    if (!customer || !profile || documentUploading) return;
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      setMessage('Please upload a document below 5 MB.');
      return;
    }

    setDocumentUploading(true);
    try {
      const extension = asset.name.includes('.') ? asset.name.split('.').pop() : 'bin';
      const storagePath = `${customer.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const response = await fetch(asset.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > 5 * 1024 * 1024) {
        setMessage('Please upload a document below 5 MB.');
        return;
      }
      const uploadResult = await supabase.storage.from('customer-documents').upload(storagePath, body, {
        contentType: asset.mimeType ?? 'application/octet-stream',
        upsert: false,
      });
      if (uploadResult.error) {
        setMessage('Document upload failed. Please try again.');
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
      if (error || !data) setMessage('Document uploaded, but record could not be saved.');
      else {
        setDocuments((current) => [data, ...current]);
        setMessage('Document uploaded.');
      }
    } catch {
      setMessage('Document upload failed. Please try again.');
    } finally {
      setDocumentUploading(false);
    }
  }

  async function openCustomerDocument(document: CustomerDocument) {
    setMessage('');
    const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
    if (error || !data?.signedUrl) return setMessage('Could not open this document.');
    await Linking.openURL(data.signedUrl);
  }

  async function deleteCustomerDocument(document: CustomerDocument) {
    setMessage('');
    const { error } = await supabase.from('customer_documents').delete().eq('id', document.id);
    if (error) {
      setMessage('Could not delete this document.');
      return;
    }
    await supabase.storage.from(document.storage_bucket).remove([document.storage_path]);
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    setMessage('Document deleted.');
  }

  if (loading) return <Screen title="Profile"><LoadingState /></Screen>;

  return (
    <Screen title="Profile" showTitleHeader={false}>
      <View style={styles.pageHeading}><Text style={styles.pageTitle}>Profile</Text><Pressable accessibilityRole="button" onPress={() => setEditing((value) => !value)} style={styles.menuButton}><MaterialCommunityIcons name={editing ? 'close' : 'pencil-outline'} size={20} color="#FFFFFF" /></Pressable></View>
      {message ? <Message type={/saved|uploaded|deleted/i.test(message) ? 'success' : 'error'}>{message}</Message> : null}

      <View style={styles.hero}>
        <View style={styles.heroShield}><MaterialCommunityIcons name="shield-check-outline" size={72} color="rgba(255,255,255,0.13)" /></View>
        <Animated.View style={[styles.avatarShell, { transform: [{ translateY: avatarLift }, { scale: avatarScale }] }]}><Image source={avatarIllustration} style={styles.avatarImage} resizeMode="cover" /></Animated.View>
        <View style={styles.identity}><Text style={styles.customerName}>{displayName}</Text><Text style={styles.customerId}>Customer ID: {customer?.customer_code ?? 'INSUREIT'}</Text><View style={styles.verified}><MaterialCommunityIcons name="check-circle" size={15} color="#69D6BA" /><Text style={styles.verifiedText}>Verified account</Text></View></View>
      </View>

      <View style={styles.statsCard}>
        <Stat icon="shield-check-outline" value={activePolicies} label="Active Policies" accent="#0B63CE" />
        <Stat icon="truck-outline" value={vehicles.length} label="My Vehicles" accent="#1688D4" />
        <Stat icon="file-document-alert-outline" value={openClaims} label="Open Claims" accent="#D88B13" />
        <Stat icon="headset" value={tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length} label="Support Tickets" accent="#0C9A73" last />
      </View>

      <Section title="Contact Information" icon="account-outline" action={editing ? undefined : 'Edit'} onAction={() => setEditing(true)}>
        {editing ? <View style={styles.editForm}><TextField label="Full name" value={draft.name} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} /><TextField label="Mobile number" value={draft.phone} keyboardType="phone-pad" onChangeText={(phone) => setDraft((current) => ({ ...current, phone }))} /><TextField label="Email address" value={draft.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(email) => setDraft((current) => ({ ...current, email }))} /><TextField label="Address" value={draft.address} multiline onChangeText={(address) => setDraft((current) => ({ ...current, address }))} /><Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveContactDetails()} style={[styles.saveButton, saving && styles.disabled]}><Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save changes'}</Text></Pressable></View> : <><ActionRow icon="phone-outline" label={customer?.phone ?? profile?.phone ?? 'Add mobile number'} onPress={() => void call(customer?.phone ?? profile?.phone)} /><ActionRow icon="email-outline" label={customer?.email ?? profile?.email ?? 'Add email address'} onPress={() => void email(customer?.email ?? profile?.email)} /><ActionRow icon="map-marker-outline" label={profileAddress || 'Add your address'} onPress={() => void openMap(profileAddress)} /></>}
      </Section>

      <View style={styles.kycVaultCard}>
        <Pressable accessibilityRole="button" onPress={() => setDocumentsOpen((current) => !current)} style={styles.kycVaultHeader}>
          <View style={styles.kycVaultIcon}><MaterialCommunityIcons name="shield-account-outline" size={22} color="#0B63CE" /></View>
          <View style={styles.kycVaultCopy}>
            <Text style={styles.kycVaultTitle}>Documents & KYC</Text>
            <Text style={styles.kycVaultSub}>{documents.length ? `${documents.length} customer document${documents.length === 1 ? '' : 's'} stored safely` : 'Keep PAN, Aadhaar, GST and other KYC files ready'}</Text>
          </View>
          <View style={styles.kycVaultCount}><Text style={styles.kycVaultCountText}>{documents.length}</Text></View>
          <MaterialCommunityIcons name={documentsOpen ? 'chevron-up' : 'chevron-down'} size={24} color={palette.navy} />
        </Pressable>

        <View style={styles.kycVaultSummary}>
          <View style={styles.kycMiniStat}><Text style={styles.kycMiniStatValue}>{documents.length}</Text><Text style={styles.kycMiniStatLabel}>Uploaded</Text></View>
          <View style={styles.kycMiniStat}><MaterialCommunityIcons name="lock-check-outline" size={17} color="#12805C" /><Text style={styles.kycMiniStatLabel}>Private vault</Text></View>
          <View style={styles.kycMiniStat}><MaterialCommunityIcons name="trash-can-outline" size={17} color="#B7791F" /><Text style={styles.kycMiniStatLabel}>Delete anytime</Text></View>
        </View>

        {documentsOpen ? <>
          <View style={styles.kycUploadPanel}>
            <View style={styles.kycUploadTop}>
              <View>
                <Text style={styles.kycUploadLabel}>Choose document type</Text>
                <Text style={styles.kycUploadHint}>Upload only clear customer KYC or supporting files.</Text>
              </View>
              <Pressable accessibilityRole="button" disabled={documentUploading} onPress={() => void uploadCustomerDocument()} style={[styles.kycUploadButton, documentUploading && styles.kycUploadButtonDisabled]}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={17} color="#FFFFFF" />
                <Text style={styles.kycUploadButtonText}>{documentUploading ? 'Uploading' : 'Upload'}</Text>
              </Pressable>
            </View>
            <View style={styles.kycTypeRow}>
              {kycDocumentTypes.map((type) => (
                <Pressable key={type} accessibilityRole="button" onPress={() => setSelectedDocType(type)} style={[styles.kycTypeChip, selectedDocType === type && styles.kycTypeChipActive]}>
                  <Text style={[styles.kycTypeText, selectedDocType === type && styles.kycTypeTextActive]}>{type}</Text>
                </Pressable>
              ))}
            </View>
          </View>

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
                <Text style={styles.emptyDocsText}>Choose a document type and tap Upload to add PAN, Aadhaar, GST or other customer documents.</Text>
              </View>
            )}
          </View>
        </> : null}
      </View>

      <Section title="Preferences" icon="cog-outline"><ActionRow icon="bell-outline" label="Notifications" value="All notifications" onPress={() => router.push('/customer/notifications')} /><ActionRow icon="translate" label="Language" value="English" onPress={() => setMessage('English is currently selected.')} /><View style={styles.preferenceToggle}><View style={styles.preferenceLeft}><View style={styles.rowIcon}><MaterialCommunityIcons name="weather-night" size={19} color={roleTheme.customer.accent} /></View><Text style={styles.rowLabel}>Dark Mode</Text></View><Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: '#DCE4ED', true: '#8ACDB7' }} thumbColor={darkMode ? roleTheme.customer.accent : '#FFFFFF'} /></View></Section>

      <Section title="Quick Actions" icon="lightning-bolt-outline"><View style={styles.quickActions}><QuickAction icon="pencil-outline" label="Edit Profile" onPress={() => setEditing(true)} /><QuickAction icon="file-download-outline" label="My Policies" onPress={() => router.push('/customer/policies')} /><QuickAction icon="headset" label="Contact Support" onPress={() => router.push('/customer/support')} /></View></Section>
      <Pressable accessibilityRole="button" onPress={() => void signOut(router)} style={styles.signOut}><MaterialCommunityIcons name="logout" size={18} color="#C43838" /><Text style={styles.signOutText}>Sign out securely</Text></Pressable>
    </Screen>
  );
}

function Section({ title, icon, action, onAction, children }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; action?: string; onAction?: () => void; children: React.ReactNode }) { return <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.sectionTitleWrap}><View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={19} color="#0B63CE" /></View><Text style={styles.sectionTitle}>{title}</Text></View>{action ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.sectionAction}><Text style={styles.sectionActionText}>{action}</Text></Pressable> : null}</View>{children}</View>; }
function Stat({ icon, value, label, accent, last = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; value: number; label: string; accent: string; last?: boolean }) { return <View style={[styles.stat, !last && styles.statBorder]}><MaterialCommunityIcons name={icon} size={22} color={accent} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function ActionRow({ icon, label, value, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionRow}><View style={styles.rowIcon}><MaterialCommunityIcons name={icon} size={19} color={roleTheme.customer.accent} /></View><Text style={styles.rowLabel} numberOfLines={value ? 1 : 2}>{label}</Text>{value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}<MaterialCommunityIcons name="chevron-right" size={19} color="#9BACBE" /></Pressable>; }
function QuickAction({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.quickAction}><MaterialCommunityIcons name={icon} size={22} color="#0B63CE" /><Text style={styles.quickActionText}>{label}</Text></Pressable>; }
function TextField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.fieldInput} placeholderTextColor="#8090A6" {...props} /></View>; }
function documentIcon(document: CustomerDocument): keyof typeof MaterialCommunityIcons.glyphMap { if (document.mime_type?.startsWith('image/')) return 'image-outline'; if (document.mime_type === 'application/pdf' || /\.pdf$/i.test(document.file_name)) return 'file-pdf-box'; return 'file-document-outline'; }
function formatAddress(customer: Customer | null) { return [customer?.address, customer?.city, customer?.state, customer?.postal_code].filter(Boolean).join(', '); }
async function call(phone?: string | null) { if (phone) await Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`); }
async function email(address?: string | null) { if (address) await Linking.openURL(`mailto:${address}`); }
async function openMap(address?: string) { if (address) await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`); }

const styles = StyleSheet.create({
  pageHeading: { marginTop: -22, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pageTitle: { color: palette.ink, fontSize: 24, fontWeight: '900' }, menuButton: { width: 39, height: 39, borderRadius: 13, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  hero: { minHeight: 177, marginHorizontal: -14, marginTop: 0, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 16, backgroundColor: '#061D43', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 14 }, heroShield: { position: 'absolute', right: 18, top: 23 }, avatarShell: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#EAF2FF', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: .3, shadowRadius: 12, elevation: 5 }, avatarImage: { width: '100%', height: '100%', transform: [{ scale: 1.24 }, { translateY: 11 }] }, identity: { flex: 1, minWidth: 0 }, customerName: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' }, customerId: { color: '#BDD2F2', fontSize: 11.5, fontWeight: '700', marginTop: 4 }, verified: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, borderRadius: 99, backgroundColor: 'rgba(52,183,139,.16)', paddingHorizontal: 8, paddingVertical: 5 }, verifiedText: { color: '#A5E5CD', fontSize: 10.5, fontWeight: '900' },
  statsCard: { flexDirection: 'row', minHeight: 88, marginHorizontal: 0, marginTop: -13, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingVertical: 10, shadowColor: palette.ink, shadowOpacity: .08, shadowRadius: 12, elevation: 3 }, stat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, statBorder: { borderRightWidth: 1, borderRightColor: '#E5ECF5' }, statValue: { color: palette.ink, fontSize: 19, lineHeight: 22, fontWeight: '900', marginTop: 2 }, statLabel: { color: palette.slate, fontSize: 8.5, lineHeight: 11, fontWeight: '800', textAlign: 'center', marginTop: 2 },
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
  preferenceToggle: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, preferenceLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 }, quickActions: { flexDirection: 'row', gap: 8, padding: 10 }, quickAction: { flex: 1, minHeight: 73, borderRadius: 12, borderWidth: 1, borderColor: '#E1EAF4', backgroundColor: '#FBFDFF', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 }, quickActionText: { color: palette.navy, fontSize: 9.5, fontWeight: '900', textAlign: 'center' }, signOut: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#F2C6C6', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, marginBottom: 8 }, signOutText: { color: '#C43838', fontSize: 12, fontWeight: '900' },
});
