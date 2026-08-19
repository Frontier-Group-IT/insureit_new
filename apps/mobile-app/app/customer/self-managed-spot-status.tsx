import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CLAIM_STAGE_ICON, ClaimProgressRail, ClaimStageHeader, ClaimUpdateContext, StageDetailsCard, StageSaveButton } from '@/components/claim-stage';
import { AppDatePicker } from '@/components/design-system';
import { LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { SELF_MANAGED_CLAIM_NOTICE } from '@/lib/claim-service-mode';
import { supabase } from '@/lib/supabase';

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
      <ClaimStageHeader step={2} icon={CLAIM_STAGE_ICON.spot_status} title="Spot Status" subtitle={`${claimNo || 'Claim'} • Record the completed spot survey.`} />
      <ClaimProgressRail step={2} />

      <ClaimUpdateContext title="Spot Status" body="Record the survey completion details you received for this external claim." />

      <View style={styles.noticeBox}><MaterialCommunityIcons name="account-edit-outline" size={21} color="#8A5B00" /><Text style={styles.noticeText}>{SELF_MANAGED_CLAIM_NOTICE}</Text></View>
      {message ? <Message type="error">{message}</Message> : null}

      <StageDetailsCard icon="clipboard-check-outline" title="Spot Survey" subtitle="Survey completion date is mandatory">
        <AppDatePicker label="Spot Survey Done Date *" value={surveyDate} onChange={setSurveyDate} maxDate={todayIsoDate()} formatDisplay={formatDisplayDate} />
      </StageDetailsCard>

      <StageDetailsCard icon="account-tie-outline" title="Surveyor Details" subtitle="Optional details for this claim stage">
        <TextField label="Surveyor Name (Optional)" value={surveyorName} onChangeText={setSurveyorName} />
        <View style={styles.gap} />
        <TextField label="Surveyor Email (Optional)" value={surveyorEmail} onChangeText={setSurveyorEmail} keyboardType="email-address" autoCapitalize="none" />
        <View style={styles.gap} />
        <TextField label="Surveyor Number (Optional)" value={surveyorPhone} onChangeText={setSurveyorPhone} keyboardType="phone-pad" />
      </StageDetailsCard>

      <View style={styles.helpBox}><MaterialCommunityIcons name="information-outline" size={18} color="#0A43A3" /><Text style={styles.helpText}>Enter surveyor details only when they are available. The survey completion date is required to finish this milestone.</Text></View>

      <StageSaveButton label="Save Spot Status" saving={submitting} onPress={() => void submit()} />
    </Screen>
  );
}

function stringValue(value: unknown) { return typeof value === 'string' ? value : ''; }
function dateAtNoon(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const [y, m, d] = value.split('-').map(Number); const date = new Date(y, m - 1, d, 12, 0, 0, 0); return Number.isNaN(date.getTime()) ? null : date; }
function todayIsoDate() { const value = new Date(); const y = value.getFullYear(); const m = String(value.getMonth() + 1).padStart(2, '0'); const d = String(value.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function formatDisplayDate(value: string) { if (!value) return ''; const [y, m, d] = value.split('-'); return `${d}-${m}-${y}`; }

const styles = StyleSheet.create({
  noticeBox: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderRadius: 15, padding: 11, backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F2D99F', marginBottom: 10 },
  noticeText: { flex: 1, color: '#77520B', fontSize: 10.3, lineHeight: 15, fontWeight: '700' },
  gap: { height: 10 },
  helpBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#C9DAF2', borderRadius: 13, padding: 11, marginBottom: 12 },
  helpText: { flex: 1, color: '#4F6380', fontSize: 10.3, lineHeight: 15, fontWeight: '700' },
});
