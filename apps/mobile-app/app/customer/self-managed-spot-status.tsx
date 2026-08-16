import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppDatePicker } from '@/components/design-system';
import { LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { SELF_MANAGED_CLAIM_NOTICE } from '@/lib/claim-service-mode';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

export default function SelfManagedSpotStatusScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [surveyDate, setSurveyDate] = useState('');
  const [surveyorName, setSurveyorName] = useState('');
  const [surveyorEmail, setSurveyorEmail] = useState('');
  const [surveyorPhone, setSurveyorPhone] = useState('');
  const [claimNo, setClaimNo] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id) {
      setMessage('Claim reference is missing.');
      setLoading(false);
      return;
    }
    let active = true;
    async function load() {
      const [claimResult, milestoneResult] = await Promise.all([
        supabase.from('claims').select('id, claim_no, claim_service_mode').eq('id', id).maybeSingle(),
        supabase.from('claim_milestones').select('*').eq('claim_id', id).eq('milestone_key', 'spot_status').maybeSingle(),
      ]);
      if (!active) return;
      if (claimResult.error || !claimResult.data) {
        setMessage('We could not load this claim.');
        setLoading(false);
        return;
      }
      if ((claimResult.data as any).claim_service_mode !== 'self_managed') {
        router.replace({ pathname: '/customer/claim-detail', params: { id } });
        return;
      }
      setClaimNo((claimResult.data as any).claim_no);
      const details = (milestoneResult.data as any)?.details;
      if (details && typeof details === 'object' && !Array.isArray(details)) {
        const record = details as Record<string, unknown>;
        setSurveyDate(stringValue(record.spot_survey_done_date));
        setSurveyorName(stringValue(record.surveyor_name));
        setSurveyorEmail(stringValue(record.surveyor_email));
        setSurveyorPhone(stringValue(record.surveyor_phone));
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id, router]);

  async function submit() {
    setMessage('');
    if (!id || !surveyDate) {
      setMessage('Spot survey done date is required.');
      return;
    }
    if (surveyorEmail.trim() && !/^\S+@\S+\.\S+$/.test(surveyorEmail.trim())) {
      setMessage('Enter a valid surveyor email or leave it blank.');
      return;
    }
    const surveyDoneAt = dateAtNoon(surveyDate);
    if (!surveyDoneAt || surveyDoneAt.getTime() > Date.now() + 12 * 60 * 60 * 1000) {
      setMessage('Spot survey done date cannot be in the future.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const { error } = await (supabase as any).from('claim_milestones').upsert({
        claim_id: id,
        milestone_key: 'spot_status',
        milestone_status: 'completed',
        details: {
          spot_survey_done_date: surveyDate,
          surveyor_name: surveyorName.trim() || null,
          surveyor_email: surveyorEmail.trim() || null,
          surveyor_phone: surveyorPhone.trim() || null,
        },
        completed_at: surveyDoneAt.toISOString(),
        recorded_by: session.user.id,
        recorded_by_actor: 'customer',
      }, { onConflict: 'claim_id,milestone_key' });
      if (error) {
        console.warn('Self-managed Spot Status save failed', error);
        setMessage('We could not save Spot Status right now. Please try again.');
        return;
      }
      router.replace({ pathname: '/customer/self-managed-claim-detail', params: { id } });
    } catch (error) {
      console.error('Self-managed Spot Status submit failed', error);
      setMessage('We could not save Spot Status right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Screen title="Spot Status" showTitleHeader={false}><LoadingState label="Opening Spot Status" /></Screen>;

  return (
    <Screen title="Spot Status" showTitleHeader={false}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} /></Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.eyebrow}>EXTERNAL CLAIM • STEP 2 OF 9</Text>
          <Text style={styles.title}>Spot Status</Text>
          <Text style={styles.subtitle}>{claimNo || 'Claim'} • Record the completed spot survey.</Text>
        </View>
        <AppBadge label="Self Tracked" tone="info" />
      </View>

      <View style={styles.contextCard}>
        <View style={styles.contextIcon}><MaterialCommunityIcons name="shield-check-outline" size={22} color="#B7791F" /></View>
        <View style={styles.contextCopy}>
          <Text style={styles.contextLabel}>CLAIM UPDATE</Text>
          <Text style={styles.contextTitle}>Spot Status</Text>
          <Text style={styles.contextBody}>Record the survey completion details you received for this external claim.</Text>
        </View>
      </View>

      <View style={styles.noticeBox}><MaterialCommunityIcons name="account-edit-outline" size={21} color="#8A5B00" /><Text style={styles.noticeText}>{SELF_MANAGED_CLAIM_NOTICE}</Text></View>
      {message ? <Message type="error">{message}</Message> : null}

      <View style={styles.card}>
        <View style={styles.cardHeading}><View style={styles.iconBox}><MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#B7791F" /></View><View><Text style={styles.cardTitle}>Spot Survey</Text><Text style={styles.cardSub}>Survey completion date is mandatory</Text></View></View>
        <AppDatePicker label="Spot Survey Done Date *" value={surveyDate} onChange={setSurveyDate} maxDate={todayIsoDate()} formatDisplay={formatDisplayDate} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeading}><View style={styles.iconBox}><MaterialCommunityIcons name="account-tie-outline" size={20} color="#B7791F" /></View><View><Text style={styles.cardTitle}>Surveyor Details</Text><Text style={styles.cardSub}>Optional details for this claim stage</Text></View></View>
        <TextField label="Surveyor Name (Optional)" value={surveyorName} onChangeText={setSurveyorName} />
        <View style={styles.gap} />
        <TextField label="Surveyor Email (Optional)" value={surveyorEmail} onChangeText={setSurveyorEmail} keyboardType="email-address" autoCapitalize="none" />
        <View style={styles.gap} />
        <TextField label="Surveyor Number (Optional)" value={surveyorPhone} onChangeText={setSurveyorPhone} keyboardType="phone-pad" />
      </View>

      <View style={styles.helpBox}><MaterialCommunityIcons name="information-outline" size={18} color="#0A43A3" /><Text style={styles.helpText}>Enter surveyor details only when they are available. The survey completion date is required to finish this milestone.</Text></View>

      <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void submit()} style={[styles.submitButton, submitting && styles.submitDisabled]}><Text style={styles.submitText}>{submitting ? 'Saving...' : 'Save Spot Status'}</Text><MaterialCommunityIcons name="check" size={20} color="#FFFFFF" /></Pressable>
    </Screen>
  );
}

function stringValue(value: unknown) { return typeof value === 'string' ? value : ''; }
function dateAtNoon(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const [y, m, d] = value.split('-').map(Number); const date = new Date(y, m - 1, d, 12, 0, 0, 0); return Number.isNaN(date.getTime()) ? null : date; }
function todayIsoDate() { const value = new Date(); const y = value.getFullYear(); const m = String(value.getMonth() + 1).padStart(2, '0'); const d = String(value.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function formatDisplayDate(value: string) { if (!value) return ''; const [y, m, d] = value.split('-'); return `${d}-${m}-${y}`; }

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginTop: 0, marginBottom: 12 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  topCopy: { flex: 1 },
  eyebrow: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  title: { color: palette.navy, fontSize: 24, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#7A8799', fontSize: 10.3, lineHeight: 14, marginTop: 3, fontWeight: '600' },
  contextCard: { borderWidth: 1, borderColor: '#C9DAF2', borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7FAFF', marginBottom: 10 },
  contextIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  contextCopy: { flex: 1, minWidth: 0 },
  contextLabel: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 },
  contextTitle: { color: palette.navy, fontSize: 13, fontWeight: '900', marginTop: 2 },
  contextBody: { color: '#667085', fontSize: 10.3, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  noticeBox: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderRadius: 15, padding: 11, backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F2D99F', marginBottom: 10 },
  noticeText: { flex: 1, color: '#77520B', fontSize: 10.3, lineHeight: 15, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6F0', borderRadius: 17, padding: 12, marginBottom: 10 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFF4E2', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  cardSub: { color: '#7A8799', fontSize: 9.8, marginTop: 2, fontWeight: '600' },
  gap: { height: 10 },
  helpBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#C9DAF2', borderRadius: 13, padding: 11, marginBottom: 12 },
  helpText: { flex: 1, color: '#4F6380', fontSize: 10.3, lineHeight: 15, fontWeight: '700' },
  submitButton: { minHeight: 48, borderRadius: 15, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
