import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { ExternalClaimErrorPopup } from '@/components/external-claim-error-popup';
import { ClaimActionBar, ClaimFormSection, ClaimStageSummaryCard, ExternalClaimStageHeader } from '@/components/external-claim-ui';
import { LoadingState, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { type ClaimMilestone } from '@/lib/claim-service-mode';
import { validateStageChronology } from '@/lib/self-managed-claim-timeline';
import { supabase } from '@/lib/supabase';

export default function SelfManagedSpotStatusScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [surveyDate, setSurveyDate] = useState('');
  const [surveyorName, setSurveyorName] = useState('');
  const [surveyorEmail, setSurveyorEmail] = useState('');
  const [surveyorPhone, setSurveyorPhone] = useState('');
  const [claimNo, setClaimNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [milestones, setMilestones] = useState<ClaimMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    if (!id) {
      setMessage('Claim reference is missing.');
      setLoading(false);
      return;
    }
    let active = true;
    async function load() {
      const [claimResult, milestoneResult] = await Promise.all([
        supabase.from('claims').select('id, claim_no, claim_service_mode, vehicle_id').eq('id', id).maybeSingle(),
        (supabase as any).from('claim_milestones').select('*').eq('claim_id', id),
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
      const vehicleId = (claimResult.data as any).vehicle_id as string | undefined;
      if (vehicleId) {
        const vehicleResult = await supabase.from('vehicles').select('vehicle_no').eq('id', vehicleId).maybeSingle();
        if (active && vehicleResult.data) setVehicleNo((vehicleResult.data as any).vehicle_no ?? '');
      }
      const nextMilestones = (milestoneResult.data ?? []) as ClaimMilestone[];
      setMilestones(nextMilestones);
      const current = nextMilestones.find((item) => item.milestone_key === 'spot_status');
      const details = current?.details;
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
    setValidationMessage('');
    if (!id || !surveyDate) return setValidationMessage('Spot Survey Done Date is required.');
    if (surveyorEmail.trim() && !/^\S+@\S+\.\S+$/.test(surveyorEmail.trim())) return setValidationMessage('Enter a valid surveyor email or leave it blank.');
    const surveyDoneAt = dateAtNoon(surveyDate);
    if (!surveyDoneAt || surveyDoneAt.getTime() > Date.now() + 12 * 60 * 60 * 1000) return setValidationMessage('Spot Survey Done Date cannot be in the future.');
    const chronology = validateStageChronology('spot_status', surveyDate, milestones);
    if (chronology) return setValidationMessage(chronology);

    setSubmitting(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const current = milestones.find((item) => item.milestone_key === 'spot_status');
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
        completed_at: current?.completed_at ?? new Date().toISOString(),
        recorded_by: session.user.id,
        recorded_by_actor: 'customer',
      }, { onConflict: 'claim_id,milestone_key' });
      if (error) {
        console.warn('Self-managed Spot Status save failed', error);
        setMessage('We could not save Spot Status right now. Please try again.');
        return;
      }
      router.replace({ pathname: '/customer/self-managed-milestone', params: { id, key: 'claim_intimation' } });
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
      <ExternalClaimStageHeader
        step={2}
        title="Spot Status"
        subtitle="Record the completed spot survey."
        vehicleNo={vehicleNo}
        claimNo={claimNo}
        onBack={() => router.back()}
      />

      <ClaimStageSummaryCard
        title="Spot Status"
        body="Record the survey completion details you received for this external claim."
        icon="shield-check-outline"
      />

      <ClaimFormSection title="Spot Survey" subtitle="Survey completion date is mandatory" icon="clipboard-check-outline">
        <AppDatePicker label="Spot Survey Done Date *" value={surveyDate} onChange={setSurveyDate} maxDate={todayIsoDate()} formatDisplay={formatDisplayDate} />
      </ClaimFormSection>

      <ClaimFormSection title="Surveyor Details" subtitle="Optional details for this claim stage" optional icon="account-tie-outline">
        <TextField label="Surveyor Name (Optional)" value={surveyorName} onChangeText={setSurveyorName} />
        <View style={styles.gap} />
        <TextField label="Surveyor Email (Optional)" value={surveyorEmail} onChangeText={setSurveyorEmail} keyboardType="email-address" autoCapitalize="none" />
        <View style={styles.gap} />
        <TextField label="Surveyor Number (Optional)" value={surveyorPhone} onChangeText={setSurveyorPhone} keyboardType="phone-pad" />
      </ClaimFormSection>

      <ClaimActionBar
        primaryDisabled={submitting}
        primaryLabel={submitting ? 'Saving...' : 'Save & Continue'}
        primaryIcon="arrow-right"
        onPrimary={() => void submit()}
        onAssistance={() => id && router.push({ pathname: '/customer/request-claim-assistance', params: { id } })}
      />

      <ExternalClaimErrorPopup
        visible={Boolean(validationMessage)}
        message={validationMessage}
        onClose={() => setValidationMessage('')}
      />
      <ExternalClaimErrorPopup
        visible={Boolean(message)}
        message={message}
        title="Something went wrong"
        onClose={() => setMessage('')}
      />
    </Screen>
  );
}

function stringValue(value: unknown) { return typeof value === 'string' ? value : ''; }
function dateAtNoon(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const [y, m, d] = value.split('-').map(Number); const date = new Date(y, m - 1, d, 12, 0, 0, 0); return Number.isNaN(date.getTime()) ? null : date; }
function todayIsoDate() { const value = new Date(); const y = value.getFullYear(); const m = String(value.getMonth() + 1).padStart(2, '0'); const d = String(value.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function formatDisplayDate(value: string) { if (!value) return ''; const [y, m, d] = value.split('-'); return `${d}-${m}-${y}`; }

const styles = StyleSheet.create({ gap: { height: 10 } });