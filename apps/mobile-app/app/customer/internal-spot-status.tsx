import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { ExternalClaimErrorPopup } from '@/components/external-claim-error-popup';
import { ClaimFormSection } from '@/components/external-claim-ui';
import { LoadingState, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

export default function InternalSpotStatusScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [surveyDate, setSurveyDate] = useState('');
  const [surveyorName, setSurveyorName] = useState('');
  const [surveyorEmail, setSurveyorEmail] = useState('');
  const [surveyorPhone, setSurveyorPhone] = useState('');
  const [claimNo, setClaimNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleMeta, setVehicleMeta] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [insurerName, setInsurerName] = useState('Insurance company');
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
    void (async () => {
      const [claimResult, milestoneResult] = await Promise.all([
        supabase.from('claims').select('id,claim_no,claim_service_mode,vehicle_id,policy_id').eq('id', id).maybeSingle(),
        (supabase as any).from('claim_milestones').select('*').eq('claim_id', id).eq('milestone_key', 'spot_status').maybeSingle(),
      ]);
      if (!active) return;
      if (claimResult.error || !claimResult.data) {
        setMessage('We could not load this claim.');
        setLoading(false);
        return;
      }
      const claim = claimResult.data as any;
      if (claim.claim_service_mode === 'self_managed') {
        router.replace({ pathname: '/customer/self-managed-spot-status', params: { id } });
        return;
      }
      setClaimNo(claim.claim_no ?? '');
      if (claim.vehicle_id) {
        const vehicleResult = await supabase.from('vehicles').select('vehicle_no,make,model').eq('id', claim.vehicle_id).maybeSingle();
        if (active && vehicleResult.data) {
          const vehicle = vehicleResult.data as any;
          setVehicleNo(vehicle.vehicle_no ?? '');
          setVehicleMeta([vehicle.make, vehicle.model].filter(Boolean).join(' · '));
        }
      }
      if (claim.policy_id) {
        const policyResult = await supabase.from('policies').select('policy_no,insurance_company_id').eq('id', claim.policy_id).maybeSingle();
        if (active && policyResult.data) {
          const policy = policyResult.data as any;
          setPolicyNo(policy.policy_no ?? '');
          if (policy.insurance_company_id) {
            const insurerResult = await supabase.from('insurance_companies').select('name').eq('id', policy.insurance_company_id).maybeSingle();
            if (active && insurerResult.data?.name) setInsurerName(insurerResult.data.name);
          }
        }
      }
      const details = (milestoneResult.data as any)?.details;
      if (details && typeof details === 'object' && !Array.isArray(details)) {
        setSurveyDate(stringValue(details.spot_survey_done_date));
        setSurveyorName(stringValue(details.surveyor_name));
        setSurveyorEmail(stringValue(details.surveyor_email));
        setSurveyorPhone(stringValue(details.surveyor_phone));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, router]);

  async function submit() {
    setMessage('');
    setValidationMessage('');
    if (!id || !surveyDate) return setValidationMessage('Spot Survey Done Date is required.');
    if (surveyorEmail.trim() && !/^\S+@\S+\.\S+$/.test(surveyorEmail.trim())) return setValidationMessage('Enter a valid surveyor email or leave it blank.');
    const surveyDoneAt = dateAtNoon(surveyDate);
    if (!surveyDoneAt || surveyDoneAt.getTime() > Date.now() + 12 * 60 * 60 * 1000) return setValidationMessage('Spot Survey Done Date cannot be in the future.');

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
        completed_at: new Date().toISOString(),
        recorded_by: session.user.id,
        recorded_by_actor: 'customer',
      }, { onConflict: 'claim_id,milestone_key' });
      if (error) {
        console.warn('Internal Spot Status save failed', error);
        setMessage('We could not save Spot Status right now. Please try again.');
        return;
      }
      router.replace({ pathname: '/customer/internal-claim-stage', params: { id, key: 'claim_intimation' } });
    } catch (error) {
      console.error('Internal Spot Status submit failed', error);
      setMessage('We could not save Spot Status right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Screen title="Spot Status" showTitleHeader={false}><LoadingState label="Opening Spot Status" /></Screen>;

  return (
    <Screen title="Spot Status" showTitleHeader={false}>
      <CompactSpotStatusHeader claimNo={claimNo} vehicleNo={vehicleNo} vehicleMeta={vehicleMeta} policyNo={policyNo} insurerName={insurerName} />

      <ClaimFormSection title="Spot Survey" iconImage={require('../../assets/claims/claim-survey.png')}>
        <AppDatePicker label="Spot Survey Done Date *" value={surveyDate} onChange={setSurveyDate} maxDate={todayIsoDate()} formatDisplay={formatDisplayDate} />
      </ClaimFormSection>

      <ClaimFormSection title="Surveyor Details" optional iconImage={require('../../assets/claims/claim-assessment.png')}>
        <TextField label="Surveyor Name (Optional)" value={surveyorName} onChangeText={setSurveyorName} />
        <View style={styles.gap} />
        <TextField label="Surveyor Email (Optional)" value={surveyorEmail} onChangeText={setSurveyorEmail} keyboardType="email-address" autoCapitalize="none" />
        <View style={styles.gap} />
        <TextField label="Surveyor Number (Optional)" value={surveyorPhone} onChangeText={setSurveyorPhone} keyboardType="phone-pad" />
      </ClaimFormSection>

      <View style={styles.stageFooterActions}>
        <Pressable accessibilityRole="button" disabled={submitting} onPress={() => id && router.replace({ pathname: '/customer/internal-claim-stage', params: { id, key: 'spot_intimation' } })} style={styles.footerSecondary}>
          <Text style={styles.footerSecondaryArrow}>←</Text><Text style={styles.footerSecondaryText}>Previous</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void submit()} style={[styles.footerPrimary, submitting && styles.footerDisabled]}>
          <Text style={styles.footerPrimaryText}>{submitting ? 'Saving...' : 'Save & Continue'}</Text><Text style={styles.footerPrimaryArrow}>→</Text>
        </Pressable>
      </View>

      <ExternalClaimErrorPopup visible={Boolean(validationMessage)} message={validationMessage} onClose={() => setValidationMessage('')} />
      <ExternalClaimErrorPopup visible={Boolean(message)} message={message} title="Something went wrong" onClose={() => setMessage('')} />
    </Screen>
  );
}

function CompactSpotStatusHeader({ claimNo, vehicleNo, vehicleMeta, policyNo, insurerName }: { claimNo: string; vehicleNo: string; vehicleMeta: string; policyNo: string; insurerName: string }) {
  return (
    <View style={styles.spotStatusCard}>
      <View style={styles.spotStatusGlowLarge} /><View style={styles.spotStatusGlowSmall} />
      <View style={styles.spotStatusHeaderRow}>
        <View style={[styles.spotStatusIconBadge, styles.spotStatusStageBadge]}><Image source={require('../../assets/claims/claim-survey.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" /></View>
        <Text style={styles.spotStatusHeaderTitle} numberOfLines={1}>Spot Status</Text>
        <Text style={styles.spotStatusClaimNo} numberOfLines={1}>{claimNo || 'Claim'}</Text>
      </View>
      <View style={styles.spotStatusHeaderDivider} />
      <View style={styles.spotStatusInfoGrid}>
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}><View style={[styles.spotStatusIconBadge, styles.spotStatusVehicleBadge]}><Image source={require('../../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" /></View><Text style={styles.spotStatusMainInfoLine} numberOfLines={1}><Text style={styles.spotStatusMainInfoLabel}>Vehicle: </Text><Text style={styles.spotStatusMainInfoValue}>{vehicleNo || 'Vehicle'}</Text></Text></View>
          <View style={styles.spotStatusSubInfoRow}><View style={[styles.spotStatusIconBadge, styles.spotStatusVehicleBadge]}><Image source={require('../../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" /></View><Text style={styles.spotStatusSubInfoText} numberOfLines={1}>{vehicleMeta || 'Vehicle details'}</Text></View>
        </View>
        <View style={styles.spotStatusVerticalDivider} />
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}><View style={[styles.spotStatusIconBadge, styles.spotStatusPolicyBadge]}><Image source={require('../../assets/claims/policy.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" /></View><Text style={styles.spotStatusMainInfoLine} numberOfLines={1}><Text style={styles.spotStatusMainInfoLabel}>Policy: </Text><Text style={styles.spotStatusMainInfoValue}>{policyNo || 'Policy'}</Text></Text></View>
          <View style={styles.spotStatusSubInfoRow}><View style={[styles.spotStatusIconBadge, styles.spotStatusInsurerBadge]}><Image source={require('../../assets/claims/insurance.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" /></View><Text style={styles.spotStatusSubInfoText} numberOfLines={2}>{insurerName || 'Insurance company'}</Text></View>
        </View>
      </View>
    </View>
  );
}

function stringValue(value: unknown) { return typeof value === 'string' ? value : ''; }
function dateAtNoon(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const [y, m, d] = value.split('-').map(Number); const date = new Date(y, m - 1, d, 12); return Number.isNaN(date.getTime()) ? null : date; }
function todayIsoDate() { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function formatDisplayDate(value: string) { if (!value) return ''; const [y, m, d] = value.split('-'); return `${d}-${m}-${y}`; }

const styles = StyleSheet.create({
  gap: { height: 10 },
  spotStatusCard: { position: 'relative', overflow: 'hidden', borderRadius: 18, backgroundColor: '#0C3B8E', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 13, marginBottom: 12, shadowColor: '#072C70', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  spotStatusGlowLarge: { position: 'absolute', width: 145, height: 145, borderRadius: 73, borderWidth: 1.5, borderColor: 'rgba(81,151,255,0.22)', right: -58, top: -82 },
  spotStatusGlowSmall: { position: 'absolute', width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(34,103,210,0.20)', right: -20, top: 10 },
  spotStatusHeaderRow: { flexDirection: 'row', alignItems: 'center', minHeight: 34 },
  spotStatusHeaderTitle: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginLeft: 8 },
  spotStatusClaimNo: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', marginLeft: 8 },
  spotStatusHeaderDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 8, marginBottom: 10 },
  spotStatusInfoGrid: { flexDirection: 'row', alignItems: 'stretch' },
  spotStatusInfoSection: { flex: 1, minWidth: 0, gap: 8 },
  spotStatusVerticalDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: 10 },
  spotStatusMainInfoRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 7 },
  spotStatusSubInfoRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 7 },
  spotStatusMainInfoLine: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 10, lineHeight: 14 },
  spotStatusMainInfoLabel: { fontWeight: '700', color: '#E6EEFF' },
  spotStatusMainInfoValue: { fontWeight: '900', color: '#FFFFFF' },
  spotStatusSubInfoText: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 9.5, lineHeight: 13, fontWeight: '700' },
  spotStatusIconBadge: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  spotStatusStageBadge: { backgroundColor: '#1964C7' },
  spotStatusVehicleBadge: { backgroundColor: '#E7F5F1' },
  spotStatusPolicyBadge: { backgroundColor: '#E8F1FF' },
  spotStatusInsurerBadge: { backgroundColor: '#FFF0C9' },
  spotStatusBadgeArtwork: { width: 25, height: 25 },
  stageFooterActions: { flexDirection: 'row', gap: 10, marginTop: 2, marginBottom: 10 },
  footerSecondary: { flex: 1, minHeight: 58, borderRadius: 17, borderWidth: 1, borderColor: '#B9CBE3', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerSecondaryText: { color: '#0A43A3', fontSize: 12, fontWeight: '900' },
  footerSecondaryArrow: { color: '#0A43A3', fontSize: 22, fontWeight: '700' },
  footerPrimary: { flex: 1, minHeight: 58, borderRadius: 17, backgroundColor: '#0A3E91', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  footerPrimaryArrow: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  footerDisabled: { opacity: 0.55 },
});
