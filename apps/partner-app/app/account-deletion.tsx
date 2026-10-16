import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PartnerScreen } from '@/components/partner-screen';
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
  const submit = () => Alert.alert(
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
  const active = request?.status === 'requested' || request?.status === 'under_review';
  return <PartnerScreen eyebrow="PRIVACY" title="Account deletion" onBack={() => router.back()}>
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.heading}>Your account, your choice</Text>
      <Text style={styles.text}>Request removal of your individual INSUREIT Partner login and eligible personal data. We verify ownership and legal retention obligations before fulfillment.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>What happens to your data?</Text>
        <Text style={styles.text}>Your individual access and eligible account data will be deleted after review. The Partner organization and its legitimate customer, policy, claim, financial, regulatory and audit records are not automatically deleted. Some information may be retained where required by law.</Text>
      </View>
      {request ? <View style={styles.card}>
        <Text style={styles.label}>Latest request: {request.status.replace('_', ' ')}</Text>
        <Text style={styles.text}>Requested {new Date(request.requested_at).toLocaleDateString('en-IN')}. We will confirm fulfillment after the required verification.</Text>
      </View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy || active} onPress={submit} style={[styles.button, (busy || active) && styles.disabled]}>
        <Text style={styles.buttonText}>{busy ? 'Submitting…' : active ? 'Request already submitted' : 'Request account deletion'}</Text>
      </Pressable>
      <Text style={styles.note}>Submitting a request does not instantly remove your account. For assistance, contact the INSUREIT support team. You will not need to provide your password to support.</Text>
    </ScrollView>
  </PartnerScreen>;
}
const styles = StyleSheet.create({
  body: { padding: 18, gap: 16, paddingBottom: 42 },
  heading: { fontSize: 20, fontWeight: '800', color: '#071D49' },
  text: { fontSize: 14, lineHeight: 22, color: '#53657E' },
  label: { fontSize: 15, fontWeight: '800', color: '#102D5C', marginBottom: 8 },
  card: { padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DBE7F4' },
  button: { backgroundColor: '#B32636', padding: 16, borderRadius: 14, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  error: { color: '#B32636', fontSize: 13 },
  note: { fontSize: 12, lineHeight: 18, color: '#64748B' },
});
