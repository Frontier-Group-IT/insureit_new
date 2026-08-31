import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { LoadingState, Message, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette, roleTheme } from '@/lib/theme';

export default function AccountDeletionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [userId, setUserId] = useState('');
  const [existingRequest, setExistingRequest] = useState<{ id: string; ticket_no: string; status: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) {
          router.replace('/login');
          return;
        }

        const customer = await getCustomerForUser(session.user.id);
        if (!customer) {
          if (!active) return;
          setUserId(session.user.id);
          return;
        }

        const { data } = await supabase
          .from('support_tickets')
          .select('id,ticket_no,status')
          .eq('customer_id', customer.id)
          .eq('category', 'other')
          .eq('subject', 'Account deletion request')
          .in('status', ['open', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!active) return;
        setCustomerId(customer.id);
        setUserId(session.user.id);
        setExistingRequest(data ?? null);
      } catch {
        if (active) setMessage('We could not load account deletion options. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  async function submitDeletionRequest() {
    if (!customerId || !userId || submitting || !confirmed) return;

    setSubmitting(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          customer_id: customerId,
          claim_id: null,
          assigned_to: null,
          category: 'other',
          priority: 'high',
          subject: 'Account deletion request',
          description:
            'I request deletion of my InsureIT app account and associated personal data. I understand that records which Sankalp Insurance Brokers Private Limited is legally or regulatorily required to retain may be preserved or access-restricted according to the Privacy Policy.',
          created_by: userId,
        })
        .select('id,ticket_no,status')
        .single();

      if (error || !data) {
        setMessage('Your deletion request could not be submitted. Please try again.');
        return;
      }

      setExistingRequest(data);
      setConfirmed(false);
    } catch {
      setMessage('Your deletion request could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Screen title="Account deletion">
        <LoadingState label="Loading account options" />
      </Screen>
    );
  }

  return (
    <Screen title="Account deletion" showTitleHeader={false}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>ACCOUNT & PRIVACY</Text>
        <Text style={styles.title}>Request account deletion</Text>
        <Text style={styles.subtitle}>
          You can ask us to delete your InsureIT account and personal data associated with it.
        </Text>
      </View>

      {message ? <Message type="error">{message}</Message> : null}

      <View style={styles.infoCard}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="account-remove-outline" size={28} color="#C43838" />
        </View>
        <Text style={styles.infoTitle}>What happens after you request deletion?</Text>
        <Text style={styles.infoBody}>
          Our team will verify the request, stop unnecessary processing, and delete account-linked data that is no longer required.
          Some policy, claim, payment, fraud-prevention, audit, or regulatory records may need to be retained for a lawful period.
          Where retention is required, access will remain restricted and the data will not be kept merely to continue your app account.
        </Text>
      </View>

      <View style={styles.stepsCard}>
        <Step number="1" text="Submit the request from this screen." />
        <Step number="2" text="Our team verifies that the request belongs to you." />
        <Step number="3" text="Eligible account data is deleted and required retained records are handled under our Privacy Policy." />
      </View>

      {!customerId ? (
        <View style={styles.externalCard}>
          <MaterialCommunityIcons name="web" size={24} color="#0B63CE" />
          <View style={styles.pendingCopy}>
            <Text style={styles.externalTitle}>Your customer profile is not active yet</Text>
            <Text style={styles.pendingText}>
              You can still request deletion of your InsureIT login account using our public deletion page. No completed customer profile is required.
            </Text>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://portal.insureit.in/account-deletion')} style={styles.externalButton}>
              <Text style={styles.externalButtonText}>Open deletion request page</Text>
              <MaterialCommunityIcons name="open-in-new" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : existingRequest ? (
        <View style={styles.pendingCard}>
          <MaterialCommunityIcons name="clock-check-outline" size={24} color="#B7791F" />
          <View style={styles.pendingCopy}>
            <Text style={styles.pendingTitle}>Deletion request already submitted</Text>
            <Text style={styles.pendingText}>
              Request {existingRequest.ticket_no} is currently {existingRequest.status === 'in_progress' ? 'being reviewed' : 'open'}.
              You do not need to submit another request.
            </Text>
          </View>
        </View>
      ) : (
        <>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed }}
            onPress={() => setConfirmed((value) => !value)}
            style={styles.confirmRow}
          >
            <MaterialCommunityIcons
              name={confirmed ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={23}
              color={confirmed ? roleTheme.customer.accent : palette.slate}
            />
            <Text style={styles.confirmText}>
              I understand that requesting deletion may end my access to InsureIT and that legally required records may still be retained.
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!confirmed || submitting}
            onPress={() => void submitDeletionRequest()}
            style={[styles.deleteButton, (!confirmed || submitting) && styles.disabled]}
          >
            <MaterialCommunityIcons name="delete-alert-outline" size={19} color="#FFFFFF" />
            <Text style={styles.deleteButtonText}>{submitting ? 'Submitting request…' : 'Submit deletion request'}</Text>
          </Pressable>
        </>
      )}

      <Pressable accessibilityRole="button" onPress={() => router.push('/customer/legal/privacy-policy')} style={styles.policyLink}>
        <Text style={styles.policyLinkText}>Read our Privacy Policy</Text>
        <MaterialCommunityIcons name="chevron-right" size={19} color="#0B63CE" />
      </Pressable>
    </Screen>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: 12 },
  eyebrow: { color: '#0B63CE', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  title: { color: palette.ink, fontSize: 24, fontWeight: '900', marginTop: 4 },
  subtitle: { color: palette.slate, fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 4 },
  infoCard: { borderRadius: 19, borderWidth: 1, borderColor: '#F0D2D2', backgroundColor: '#FFF8F8', padding: 14, marginBottom: 10 },
  iconWrap: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#FCEAEA', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  infoTitle: { color: palette.ink, fontSize: 14.5, fontWeight: '900' },
  infoBody: { color: palette.slate, fontSize: 11.2, lineHeight: 17, fontWeight: '700', marginTop: 5 },
  stepsCard: { borderRadius: 18, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', padding: 12, gap: 10, marginBottom: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 25, height: 25, borderRadius: 9, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#0B63CE', fontSize: 11, fontWeight: '900' },
  stepText: { flex: 1, color: palette.ink, fontSize: 11.2, lineHeight: 16, fontWeight: '700', paddingTop: 3 },
  pendingCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 17, borderWidth: 1, borderColor: '#F1D7A5', backgroundColor: '#FFF9EE', padding: 12, marginBottom: 10 },
  externalCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 17, borderWidth: 1, borderColor: '#CFE0FF', backgroundColor: '#F8FBFF', padding: 12, marginBottom: 10 },
  externalTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  externalButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 11, backgroundColor: '#0B63CE', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  externalButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  pendingCopy: { flex: 1 },
  pendingTitle: { color: '#805B18', fontSize: 12.5, fontWeight: '900' },
  pendingText: { color: '#7A6641', fontSize: 10.7, lineHeight: 15, fontWeight: '700', marginTop: 3 },
  confirmRow: { minHeight: 62, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', padding: 12, marginBottom: 10 },
  confirmText: { flex: 1, color: palette.ink, fontSize: 10.8, lineHeight: 15, fontWeight: '700' },
  deleteButton: { minHeight: 47, borderRadius: 14, backgroundColor: '#C43838', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 10 },
  deleteButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  policyLink: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#CFE0FF', backgroundColor: '#F8FBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  policyLinkText: { color: '#0B63CE', fontSize: 11.5, fontWeight: '900' },
});
