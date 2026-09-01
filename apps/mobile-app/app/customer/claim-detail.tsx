import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ClaimFinancialSummary, ClaimPrimaryAction } from '@/components/external-claim-ui';
import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { SELF_MANAGED_MILESTONES, type ClaimMilestone, type ClaimMilestoneKey } from '@/lib/claim-service-mode';
import { customerStageCopy } from '@/lib/claim-workflow';
import { formatJourneyAmount, formatJourneyDate, stageMainAmount } from '@/lib/self-managed-claim-timeline';
import { supabase } from '@/lib/supabase';
import { palette, roleTheme } from '@/lib/theme';
import type { Claim, ClaimDocument, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

const ASSISTANCE_TOOLTIP_STORAGE_KEY = 'claim-tracker-assistance-tooltip-seen-v1';

type ClaimWithOwnership = Claim & {
  external_policy_id?: string | null;
  claim_service_mode?: 'broker_managed' | 'self_managed' | null;
  assistance_status?: 'not_requested' | 'requested' | 'accepted' | 'declined' | 'cancelled' | null;
};

type PolicyDisplay = Pick<Policy, 'id' | 'customer_id' | 'vehicle_id' | 'insurance_company_id' | 'policy_no' | 'policy_type' | 'start_date' | 'end_date'> & { source: 'sibl' | 'external' };

export default function ClaimDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [claim, setClaim] = useState<ClaimWithOwnership | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [policy, setPolicy] = useState<PolicyDisplay | null>(null);
  const [insurer, setInsurer] = useState<InsuranceCompany | null>(null);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [milestones, setMilestones] = useState<ClaimMilestone[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [documentsExpanded, setDocumentsExpanded] = useState(false);
  const [journeyExpanded, setJourneyExpanded] = useState(true);
  const [showAssistanceTooltip, setShowAssistanceTooltip] = useState(false);
  const [claimNumberModalVisible, setClaimNumberModalVisible] = useState(false);
  const [claimNumberDraft, setClaimNumberDraft] = useState('');
  const [claimNumberSaving, setClaimNumberSaving] = useState(false);
  const [claimNumberError, setClaimNumberError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!id) return;
      const [claimResult, documentsResult, milestoneResult] = await Promise.all([
        supabase.from('claims').select('*').eq('id', id).maybeSingle(),
        supabase.from('claim_documents').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        (supabase as any).from('claim_milestones').select('*').eq('claim_id', id),
      ]);
      if (!active) return;
      const nextClaim = claimResult.data as ClaimWithOwnership | null;
      setClaim(nextClaim);
      setDocuments(documentsResult.data ?? []);
      setMilestones((milestoneResult.data ?? []) as ClaimMilestone[]);
      if (!nextClaim) { setLoading(false); return; }

      const vehicleResult = await supabase.from('vehicles').select('*').eq('id', nextClaim.vehicle_id).maybeSingle();
      if (!active) return;
      setVehicle(vehicleResult.data);

      let nextPolicy: PolicyDisplay | null = null;
      if (nextClaim.policy_id) {
        const result = await supabase.from('policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date').eq('id', nextClaim.policy_id).maybeSingle();
        if (result.data) nextPolicy = { ...(result.data as any), source: 'sibl' };
      } else if (nextClaim.external_policy_id) {
        const result = await (supabase as any).from('external_policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date').eq('id', nextClaim.external_policy_id).maybeSingle();
        if (result.data) nextPolicy = { ...(result.data as any), source: 'external' };
      }
      if (!active) return;
      setPolicy(nextPolicy);
      const insurerId = nextClaim.insurance_company_id || nextPolicy?.insurance_company_id;
      if (insurerId) {
        const insurerResult = await supabase.from('insurance_companies').select('*').eq('id', insurerId).maybeSingle();
        if (active) setInsurer(insurerResult.data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  const selfManaged = claim?.claim_service_mode === 'self_managed';

  useEffect(() => {
    if (!selfManaged) return;
    let active = true;
    void AsyncStorage.getItem(ASSISTANCE_TOOLTIP_STORAGE_KEY).then((seen) => {
      if (!active || seen) return;
      setShowAssistanceTooltip(true);
      void AsyncStorage.setItem(ASSISTANCE_TOOLTIP_STORAGE_KEY, '1');
    });
    return () => { active = false; };
  }, [selfManaged]);

  useEffect(() => {
    if (!showAssistanceTooltip) return;
    const timer = setTimeout(() => setShowAssistanceTooltip(false), 4500);
    return () => clearTimeout(timer);
  }, [showAssistanceTooltip]);

  const completedKeys = useMemo(() => new Set(milestones.filter((item) => item.milestone_status === 'completed' || item.milestone_status === 'not_applicable').map((item) => item.milestone_key)), [milestones]);
  const selfStageIndex = useMemo(() => Math.max(0, SELF_MANAGED_MILESTONES.findIndex((stage) => !completedKeys.has(stage.key))), [completedKeys]);
  const managedStageIndex = useMemo(() => managedStageFor(claim?.current_status), [claim?.current_status]);
  const currentStageIndex = selfManaged ? (completedKeys.size >= 9 ? 8 : selfStageIndex) : managedStageIndex;
  const progress = selfManaged ? Math.round((completedKeys.size / 9) * 100) : Math.round(((currentStageIndex + 1) / 9) * 100);

  if (loading) return <Screen title="Claim Detail"><LoadingState /></Screen>;
  if (!claim) return <Screen title="Claim Detail"><EmptyState title="Claim not found" body="Please choose another claim from your list." /></Screen>;

  const claimId = claim.id;
  const tone = selfManaged ? externalClaimTone : claimTone(claim.current_status);
  const currentStage = SELF_MANAGED_MILESTONES[currentStageIndex];
  const settled = ['Settled', 'Closed', 'Claim Complete'].includes(claim.current_status) || (selfManaged && completedKeys.size >= 9);
  const compactClaimIntimation = selfManaged;
  const financialRows = selfManaged ? buildFinancialRows(milestones) : [];

  function openSelfStage(key: ClaimMilestoneKey) {
    if (key === 'spot_intimation') return router.push({ pathname: '/customer/self-managed-claim', params: { id: claimId } });
    if (key === 'spot_status') return router.push({ pathname: '/customer/self-managed-spot-status', params: { id: claimId } });
    return router.push({ pathname: '/customer/self-managed-milestone', params: { id: claimId, key } });
  }

  function openCurrentSelfStage() {
    if (!selfManaged || settled || !currentStage) return;
    openSelfStage(currentStage.key);
  }

  function openAssistance() {
    setShowAssistanceTooltip(false);
    router.push({ pathname: '/customer/request-claim-assistance', params: { id: claimId } });
  }

  async function openDocument(document: ClaimDocument) {
    setMessage('');
    const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
    if (error || !data?.signedUrl) return setMessage('We could not open this document. Please try again.');
    await Linking.openURL(data.signedUrl);
  }
  function openClaimNumberModal() {
    if (!claim || claim.insurer_claim_no || claimNumberSaving) return;
    setClaimNumberDraft('');
    setClaimNumberError('');
    setClaimNumberModalVisible(true);
  }

  function closeClaimNumberModal() {
    if (claimNumberSaving) return;
    setClaimNumberModalVisible(false);
    setClaimNumberError('');
  }

  async function saveCompletedClaimNumber() {
    if (!claim || claimNumberSaving) return;
    const nextClaimNumber = claimNumberDraft.trim();
    if (!nextClaimNumber) {
      setClaimNumberError('Enter the claim number issued by the insurer.');
      return;
    }

    setClaimNumberSaving(true);
    setClaimNumberError('');
    const { error } = await supabase.from('claims').update({ insurer_claim_no: nextClaimNumber }).eq('id', claim.id);
    setClaimNumberSaving(false);

    if (error) {
      setClaimNumberError('We could not save the claim number. Please try again.');
      return;
    }

    setClaim((current) => current ? { ...current, insurer_claim_no: nextClaimNumber } : current);
    setClaimNumberModalVisible(false);
  }


  return (
    <Screen title="Claim Detail" showLogout showTitleHeader={false}>
      <View style={styles.pageHeading}>
        <View style={styles.pageHeadingCopy}>
          <Text style={styles.pageEyebrow}>{selfManaged ? 'EXTERNAL CLAIM' : 'CLAIMS'}</Text>
          <Text style={styles.pageTitle}>{selfManaged ? 'Claim Tracker' : 'Claim Detail'}</Text>
          {!selfManaged ? <Text style={styles.pageSubtitle}>{customerStageCopy(claim.current_status)}</Text> : null}
        </View>
        {selfManaged ? <View style={styles.headingActions}>
          <View style={styles.assistanceActionWrap}>
            {showAssistanceTooltip ? <View pointerEvents="none" style={styles.assistanceTooltip}>
              <Text style={styles.assistanceTooltipText}>Need help? Tap here.</Text>
              <View style={styles.assistanceTooltipArrow} />
            </View> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get Assistance"
              accessibilityHint="Opens Sankalp claim assistance"
              hitSlop={6}
              onPress={openAssistance}
              style={({ pressed }) => [styles.assistanceIconButton, pressed && styles.assistanceIconButtonPressed]}
            >
              <MaterialCommunityIcons name="account-voice" size={21} color="#168161" />
              <Text style={styles.assistanceActionLabel}>Get Assistance</Text>
            </Pressable>
          </View>
        </View> : null}
      </View>
      {message ? <Message type="error">{message}</Message> : null}

      <View style={[styles.heroCard, compactClaimIntimation && styles.heroCardCompact, { borderColor: tone.border }]}>
        <View style={[styles.heroOrbLarge, compactClaimIntimation && styles.heroOrbLargeCompact]} />
        <View style={[styles.heroOrbSmall, compactClaimIntimation && styles.heroOrbSmallCompact]} />
        <View style={[styles.heroTop, compactClaimIntimation && styles.heroTopCompact]}>
          <Image source={settled ? require('../../assets/claims/tasks-completed.png') : require('../../assets/claims/claim-approval.png')} style={[styles.statusArtwork, compactClaimIntimation && styles.statusArtworkCompact]} resizeMode="contain" />
          <View style={styles.heroCopy}>
            <Text style={[styles.stageLabel, compactClaimIntimation && styles.stageLabelCompact]}>{settled ? 'CLAIM COMPLETE' : currentStage?.label ?? claim.current_status}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.vehicleNo, compactClaimIntimation && styles.vehicleNoCompact]}>{vehicle?.vehicle_no ?? 'Vehicle linked'}</Text>
            <Text numberOfLines={1} style={[styles.heroIdentity, compactClaimIntimation && styles.heroIdentityCompact]}>{selfManaged ? (claim.insurer_claim_no || claim.claim_no) : claim.claim_no}{!selfManaged && claim.insurer_claim_no ? ` · ${claim.insurer_claim_no}` : ''}</Text>
          </View>
          <ProgressRing progress={progress} compact={compactClaimIntimation} />
        </View>
        <View style={[styles.incidentRow, compactClaimIntimation && styles.incidentRowCompact]}>
          <View><Text style={[styles.metaLabel, compactClaimIntimation && styles.metaLabelCompact]}>INCIDENT</Text><Text style={[styles.incidentValue, compactClaimIntimation && styles.incidentValueCompact]}>{selfManaged ? formatDateTime(claim.accident_at) : formatDate(claim.accident_at)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsExpanded }} onPress={() => setDetailsExpanded((value) => !value)} style={[styles.detailsToggle, compactClaimIntimation && styles.detailsToggleCompact]}><Text style={[styles.detailsToggleText, compactClaimIntimation && styles.detailsToggleTextCompact]}>Claim details</Text><MaterialCommunityIcons name={detailsExpanded ? 'chevron-up' : 'chevron-down'} size={compactClaimIntimation ? 15 : 18} color="#FFFFFF" /></Pressable>
        </View>
        {selfManaged && settled && !claim.insurer_claim_no ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Add insurer claim number" onPress={openClaimNumberModal} style={({ pressed }) => [styles.addClaimNumberAction, pressed && styles.addClaimNumberActionPressed]}>
            <View style={styles.addClaimNumberIcon}><MaterialCommunityIcons name="pencil-plus-outline" size={15} color="#0A43A3" /></View>
            <Text style={styles.addClaimNumberText}>Add Claim Number</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color="#0A43A3" />
          </Pressable>
        ) : null}
        {detailsExpanded ? <View style={styles.infoBox}>
          <InfoPair leftLabel="Control No." leftValue={claim.claim_no} rightLabel="Claim No." rightValue={claim.insurer_claim_no || 'Awaiting insurer'} />
          <InfoPair leftLabel="Manufacturer" leftValue={vehicle?.make ?? '-'} rightLabel="Model" rightValue={vehicle?.model ?? '-'} />
          <InfoPair leftLabel="Policy" leftValue={policy?.policy_no ?? '-'} rightLabel="Insurer" rightValue={insurer?.name ?? '-'} />
          <InfoPair leftLabel="Policy Source" leftValue={policy?.source === 'external' ? 'External' : 'Sankalp'} rightLabel="Policy Type" rightValue={policy?.policy_type ?? '-'} />
        </View> : null}
      </View>

      {!settled ? <Pressable
        accessibilityRole={selfManaged ? 'button' : undefined}
        accessibilityLabel={selfManaged ? `Continue to ${currentStage?.label ?? 'current milestone'}` : undefined}
        disabled={!selfManaged}
        onPress={openCurrentSelfStage}
        style={({ pressed }) => [styles.currentCard, { borderColor: tone.border, backgroundColor: tone.background }, selfManaged && pressed && styles.currentCardPressed]}
      >
        <View style={[styles.currentAccent, { backgroundColor: tone.accent }]} />
        <Image source={currentMilestoneArtwork(currentStage?.key)} style={styles.currentIconArtwork} resizeMode="contain" />
        <View style={styles.currentCopy}>
          <Text style={[styles.currentEyebrow, { color: tone.accent }]}>{selfManaged ? 'CURRENT MILESTONE' : 'NEXT ACTION'}</Text>
          <Text style={styles.currentTitle}>{currentStage?.label ?? claim.current_status}</Text>
          <Text numberOfLines={2} style={styles.currentBody}>{selfManaged ? currentStageHint(currentStage?.key) : customerStageCopy(claim.current_status)}</Text>
        </View>
        {selfManaged ? <View style={styles.currentContinue}>
          <MaterialCommunityIcons name="chevron-right" size={20} color={tone.accent} />
        </View> : null}
      </Pressable> : null}

      {!selfManaged ? <ClaimPrimaryAction label="Upload Documents" icon="cloud-upload-outline" onPress={() => router.push({ pathname: '/customer/upload-documents', params: { claimId: claim.id } })} /> : null}

      <SectionHeader title="Claim Journey" subtitle={`${progress}% complete • ${currentStage?.label ?? claim.current_status}`} expanded={journeyExpanded} onPress={() => setJourneyExpanded((value) => !value)} />
      {journeyExpanded ? <View style={[styles.sectionBody, styles.journeyBody]}>{SELF_MANAGED_MILESTONES.map((stage, index) => {
        const done = selfManaged ? completedKeys.has(stage.key) : index < currentStageIndex;
        const current = !settled && index === currentStageIndex;
        const milestone = selfManaged ? milestones.find((item) => item.milestone_key === stage.key) : null;
        const editable = selfManaged && (done || current);
        const amount = selfManaged ? formatJourneyAmount(stageMainAmount(milestone)) : null;
        const dateText = selfManaged ? formatJourneyDate(milestone) : null;
        const statusText = done ? stageCompletedCopy(stage.key) : current ? (milestone?.milestone_status === 'in_progress' ? 'In progress' : 'Current milestone') : 'Upcoming';
        return <Pressable key={stage.key} accessibilityRole={editable ? 'button' : undefined} disabled={!editable} onPress={() => openSelfStage(stage.key)} style={[styles.stageRow, current && styles.stageRowCurrent]}>
          <View style={styles.stageRail}>
            <View style={[styles.stageNode, done && styles.stageDone, current && styles.stageCurrent]}><MaterialCommunityIcons name={done ? 'check' : current ? 'circle-slice-8' : 'lock-outline'} size={9} color={done || current ? '#FFFFFF' : '#98A2B3'} /></View>
            {index < SELF_MANAGED_MILESTONES.length - 1 ? <View style={[styles.stageLine, done && styles.stageLineDone]} /> : null}
          </View>
          <View style={styles.stageCopy}>
            <Text style={styles.stageTitle}>{stage.label}</Text>
            <Text style={[styles.stageMeta, current && styles.stageMetaCurrent]}>{statusText}</Text>
          </View>
          {selfManaged ? <View style={styles.stageRight}>
            <Text numberOfLines={2} style={[styles.stageDate, !milestone && styles.stageDateMuted]}>{done || current ? dateText : 'Pending'}</Text>
            {amount ? <Text style={styles.stageAmount}>{amount}</Text> : null}
            {editable ? <MaterialCommunityIcons name="chevron-right" size={12} color="#6782A2" /> : null}
          </View> : null}
        </Pressable>;
      })}</View> : null}

      {selfManaged && financialRows.length ? <ClaimFinancialSummary rows={financialRows} /> : null}

      <SectionHeader title="Documents" subtitle={`${documents.length} document${documents.length === 1 ? '' : 's'}`} expanded={documentsExpanded} onPress={() => setDocumentsExpanded((value) => !value)} />
      {documentsExpanded ? <View style={styles.sectionBody}>{documents.length ? documents.map((document) => <Pressable key={document.id} onPress={() => void openDocument(document)} style={styles.documentRow}><MaterialCommunityIcons name="file-document-outline" size={20} color={roleTheme.customer.accent} /><View style={{ flex: 1 }}><Text style={styles.documentTitle}>{document.document_type}</Text><Text style={styles.documentMeta}>{document.verification_status ?? 'uploaded'}</Text></View><MaterialCommunityIcons name="open-in-new" size={18} color={palette.slate} /></Pressable>) : <Text style={styles.emptyText}>No claim documents uploaded yet.</Text>}</View> : null}

      <Modal visible={claimNumberModalVisible} transparent animationType="fade" onRequestClose={closeClaimNumberModal}>
        <View style={styles.claimNumberBackdrop}>
          <View style={styles.claimNumberCard}>
            <View style={styles.claimNumberIcon}><MaterialCommunityIcons name="shield-check-outline" size={23} color="#0A43A3" /></View>
            <Text style={styles.claimNumberTitle}>Add insurer claim number?</Text>
            <View style={[styles.claimNumberInputShell, Boolean(claimNumberError) && styles.claimNumberInputShellError]}>
              <TextInput value={claimNumberDraft} onChangeText={(value) => { setClaimNumberDraft(value); if (claimNumberError) setClaimNumberError(''); }} editable={!claimNumberSaving} autoCapitalize="characters" autoCorrect={false} placeholder="Enter claim number" placeholderTextColor="#98A2B3" returnKeyType="done" style={styles.claimNumberInput} onSubmitEditing={() => void saveCompletedClaimNumber()} />
            </View>
            {claimNumberError ? <Text style={styles.claimNumberError}>{claimNumberError}</Text> : null}
            <View style={styles.claimNumberActions}>
              <Pressable accessibilityRole="button" disabled={claimNumberSaving} onPress={closeClaimNumberModal} style={styles.claimNumberSecondary}><Text style={styles.claimNumberSecondaryText}>Not now</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={claimNumberSaving} onPress={() => void saveCompletedClaimNumber()} style={[styles.claimNumberPrimary, claimNumberSaving && styles.claimNumberDisabled]}><Text style={styles.claimNumberPrimaryText}>{claimNumberSaving ? 'Saving...' : 'Continue'}</Text><MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" /></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {selfManaged && claim.assistance_status === 'requested' && !settled ? <View style={styles.assistanceNotice}>
        <View style={styles.assistanceNoticeIcon}><MaterialCommunityIcons name="information-outline" size={19} color="#168161" /></View>
        <View style={styles.assistanceNoticeCopy}>
          <Text style={styles.assistanceNoticeTitle}>Assistance request sent</Text>
          <Text style={styles.assistanceNoticeText}>Sankalp assistance has already been requested. Until accepted, you remain in control of this claim.</Text>
        </View>
      </View> : null}

    </Screen>
  );
}

function buildFinancialRows(milestones: ClaimMilestone[]) {
  const mapping: Array<{ key: ClaimMilestoneKey; label: string }> = [
    { key: 'claim_intimation', label: 'Estimate' },
    { key: 'billing', label: 'Bill' },
    { key: 'delivery_order', label: 'DO' },
    { key: 'payment_encashment', label: 'Received' },
  ];
  return mapping.flatMap(({ key, label }) => {
    const milestone = milestones.find((item) => item.milestone_key === key);
    const amount = formatJourneyAmount(stageMainAmount(milestone));
    return amount ? [{ label, value: amount, emphasis: key === 'payment_encashment' }] : [];
  });
}

function currentMilestoneArtwork(key?: ClaimMilestoneKey) {
  if (key === 'spot_intimation') return require('../../assets/claims/claims.png');
  if (key === 'spot_status') return require('../../assets/claims/claim-survey.png');
  if (key === 'claim_intimation') return require('../../assets/claims/claims.png');
  if (key === 'work_approval') return require('../../assets/claims/claim-approval.png');
  if (key === 'repair_ri') return require('../../assets/claims/tasks-completed.png');
  if (key === 'billing') return require('../../assets/claims/accounts-finance.png');
  if (key === 'delivery_order') return require('../../assets/claims/claim-assessment.png');
  if (key === 'vehicle_delivery') return require('../../assets/claims/fleet-vehicle.png');
  if (key === 'payment_encashment') return require('../../assets/claims/receipts-posted.png');
  return require('../../assets/claims/claim-approval.png');
}

function currentStageHint(key?: ClaimMilestoneKey) {
  if (key === 'spot_intimation') return 'Record the incident and when the insurer was first informed.';
  if (key === 'spot_status') return 'Record when the spot survey is completed.';
  if (key === 'claim_intimation') return 'Record insurer intimation, workshop and estimate details.';
  if (key === 'work_approval') return 'Record insurer approval and settlement method.';
  if (key === 'repair_ri') return 'Record repair completion and re-inspection.';
  if (key === 'billing') return 'Record the final workshop bill.';
  if (key === 'delivery_order') return 'Record assessment and delivery order details.';
  if (key === 'vehicle_delivery') return 'Confirm when the repaired vehicle is actually received.';
  if (key === 'payment_encashment') return 'Record settlement documents and final payment.';
  return 'Record the next claim update.';
}

function stageCompletedCopy(key: ClaimMilestoneKey) {
  if (key === 'spot_intimation') return 'Insurer informed';
  if (key === 'spot_status') return 'Survey completed';
  if (key === 'claim_intimation') return 'Claim registered';
  if (key === 'work_approval') return 'Approval received';
  if (key === 'repair_ri') return 'Repair / RI completed';
  if (key === 'billing') return 'Bill recorded';
  if (key === 'delivery_order') return 'DO issued';
  if (key === 'vehicle_delivery') return 'Vehicle received';
  return 'Payment received';
}

function ProgressRing({ progress, compact = false }: { progress: number; compact?: boolean }) {
  const size = compact ? 38 : 70;
  const strokeWidth = compact ? 4 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const dashOffset = circumference * (1 - normalizedProgress / 100);

  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: normalizedProgress }} accessibilityLabel={`Journey progress ${normalizedProgress}%`} style={[styles.progressRing, compact && styles.progressRingCompact]}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="rgba(255,255,255,.18)" strokeWidth={strokeWidth} />
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="#63A9FF" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={dashOffset} rotation="-90" origin={`${size / 2}, ${size / 2}`} />
    </Svg>
    <View pointerEvents="none" style={styles.progressRingLabel}><Text style={[styles.progressRingValue, compact && styles.progressRingValueCompact]}>{normalizedProgress}%</Text></View>
  </View>;
}

function InfoPair({ leftLabel, leftValue, rightLabel, rightValue }: { leftLabel: string; leftValue: string; rightLabel: string; rightValue: string }) { return <View style={styles.infoPair}><View style={{ flex: 1 }}><Text style={styles.infoLabel}>{leftLabel}</Text><Text style={styles.infoValue}>{leftValue}</Text></View><View style={{ flex: 1 }}><Text style={styles.infoLabel}>{rightLabel}</Text><Text style={styles.infoValue}>{rightValue}</Text></View></View>; }
function SectionHeader({ title, subtitle, expanded, onPress }: { title: string; subtitle: string; expanded: boolean; onPress: () => void }) {
  const compactJourney = title === 'Claim Journey';
  const artwork = title === 'Claim Journey' ? require('../../assets/claims/claims.png') : title === 'Documents' ? require('../../assets/claims/claim-documents.png') : require('../../assets/claims/claim-approval.png');
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={[styles.sectionHeader, compactJourney && styles.journeyHeader]}><Image source={artwork} style={[styles.sectionHeaderArtwork, compactJourney && styles.journeyHeaderArtwork]} resizeMode="contain" /><View style={styles.sectionHeaderCopy}><Text style={[styles.sectionTitle, compactJourney && styles.journeyHeaderTitle]}>{title}</Text><Text style={[styles.sectionSub, compactJourney && styles.journeyHeaderSub]}>{subtitle}</Text></View><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={compactJourney ? 16 : 22} color="#667C98" /></Pressable>;
}
function managedStageFor(status?: string | null) { const value = (status ?? '').toLowerCase(); if (/settled|closed|payment/.test(value)) return 8; if (/delivery/.test(value)) return 7; if (/do submitted|delivery order/.test(value)) return 6; if (/bill/.test(value)) return 5; if (/repair/.test(value)) return 4; if (/approval|estimate/.test(value)) return 3; if (/intimat|surveyor|inspected/.test(value)) return 2; if (/document/.test(value)) return 1; return 0; }
const externalClaimTone = { accent:'#0A43A3',soft:'#EAF2FF',background:'#F7FAFF',border:'#BFD3EB' };
function claimTone(status: string) { if (['Settled','Closed','Claim Complete'].includes(status)) return { accent:'#12805C',soft:'#E8F8F0',background:'#F7FCF9',border:'#BFE6D5' }; return { accent:'#B7791F',soft:'#FFF4E2',background:'#FFFBF3',border:'#F0D9AC' }; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-'; }
function formatDateTime(value?: string | null) { return value ? new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}) : '-'; }

const styles = StyleSheet.create({
  pageHeading:{marginBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},pageHeadingCopy:{flex:1,minWidth:0},pageEyebrow:{color:'#145ED7',fontSize:10,fontWeight:'900',letterSpacing:1},pageTitle:{color:palette.navy,fontSize:24,fontWeight:'900',marginTop:2},pageSubtitle:{color:'#6A7789',fontSize:10.5,lineHeight:15,fontWeight:'600',marginTop:3},headingActions:{flexDirection:'row',alignItems:'flex-start',gap:7,flexShrink:0},assistanceActionWrap:{position:'relative',alignItems:'center'},assistanceIconButton:{minWidth:68,minHeight:48,borderRadius:13,paddingHorizontal:7,paddingVertical:5,alignItems:'center',justifyContent:'center',gap:1,backgroundColor:'#EAF8F1',borderWidth:1,borderColor:'#B9E3D0',shadowColor:'#168161',shadowOpacity:.16,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:3},assistanceIconButtonPressed:{backgroundColor:'#DDF3E8',transform:[{scale:.97}]},assistanceActionLabel:{color:'#168161',fontSize:7.5,lineHeight:9,fontWeight:'900',textAlign:'center'},assistanceTooltip:{position:'absolute',right:0,top:55,zIndex:20,minWidth:116,borderRadius:10,paddingHorizontal:9,paddingVertical:6,backgroundColor:'#07327B',shadowColor:'#001B44',shadowOpacity:.22,shadowRadius:8,shadowOffset:{width:0,height:4},elevation:6},assistanceTooltipText:{color:'#FFFFFF',fontSize:9,lineHeight:12,fontWeight:'800',textAlign:'center'},assistanceTooltipArrow:{position:'absolute',right:25,top:-5,width:10,height:10,backgroundColor:'#07327B',transform:[{rotate:'45deg'}]},
  heroCard:{position:'relative',borderWidth:1,borderRadius:21,padding:15,backgroundColor:'#07327B',overflow:'hidden',marginTop:13,marginBottom:11,shadowColor:'#07327B',shadowOpacity:.16,shadowRadius:12,shadowOffset:{width:0,height:6},elevation:3},heroCardCompact:{borderRadius:18,paddingVertical:10,paddingHorizontal:11,marginTop:9,marginBottom:8},heroOrbLarge:{position:'absolute',width:190,height:190,borderRadius:95,right:-75,top:-108,borderWidth:1,borderColor:'rgba(75,145,255,.20)'},heroOrbLargeCompact:{width:128,height:128,borderRadius:64,right:-47,top:-74},heroOrbSmall:{position:'absolute',width:130,height:130,borderRadius:65,right:-23,top:-74,borderWidth:1,borderColor:'rgba(75,145,255,.18)'},heroOrbSmallCompact:{width:90,height:90,borderRadius:45,right:-15,top:-48},heroTop:{flexDirection:'row',alignItems:'center',gap:11},heroTopCompact:{gap:8},statusArtwork:{width:48,height:48,flexShrink:0},statusArtworkCompact:{width:40,height:40},heroCopy:{flex:1,minWidth:0},stageLabel:{color:'#A8C8FF',fontSize:9,fontWeight:'900',letterSpacing:.7},stageLabelCompact:{fontSize:8.5,letterSpacing:.55},vehicleNo:{color:'#FFFFFF',fontSize:21,fontWeight:'900',marginTop:2},vehicleNoCompact:{fontSize:18.5,marginTop:1},heroIdentity:{color:'#DCE8F7',fontSize:10.5,fontWeight:'800',marginTop:2},heroIdentityCompact:{fontSize:9.5,marginTop:1},progressRing:{width:70,height:70,flexShrink:0,alignItems:'center',justifyContent:'center',marginLeft:2},progressRingCompact:{width:38,height:38,marginLeft:0},progressRingLabel:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'},progressRingValue:{color:'#FFFFFF',fontSize:15,fontWeight:'900',letterSpacing:-.3},progressRingValueCompact:{fontSize:10.5,letterSpacing:-.15},incidentRow:{marginTop:13,paddingTop:11,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.27)',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},incidentRowCompact:{marginTop:8,paddingTop:7,gap:8},metaLabel:{color:'#A9C0E0',fontSize:8.5,fontWeight:'900',letterSpacing:.6},metaLabelCompact:{fontSize:8,letterSpacing:.5},incidentValue:{color:'#FFFFFF',fontSize:11,fontWeight:'900',marginTop:2},incidentValueCompact:{fontSize:10.2,marginTop:1},detailsToggle:{minHeight:38,borderRadius:11,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(255,255,255,.10)',borderWidth:1,borderColor:'rgba(255,255,255,.22)'},detailsToggleCompact:{minHeight:32,borderRadius:9,paddingHorizontal:8,gap:2},detailsToggleText:{color:'#FFFFFF',fontSize:9.5,fontWeight:'900'},detailsToggleTextCompact:{fontSize:8.8},infoBox:{marginTop:10,borderRadius:14,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#D9E4F0',padding:10,gap:8,shadowColor:'#001B44',shadowOpacity:.08,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:2},infoPair:{flexDirection:'row',gap:14},infoLabel:{color:'#6C7D93',fontSize:8.5,fontWeight:'800'},infoValue:{color:palette.navy,fontSize:10.2,fontWeight:'900',marginTop:2},
  addClaimNumberAction:{marginTop:8,minHeight:38,borderRadius:11,backgroundColor:'#F7FAFF',borderWidth:1,borderColor:'#C8DCF3',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:7},
  addClaimNumberActionPressed:{backgroundColor:'#EDF5FF',transform:[{scale:.995}]},
  addClaimNumberIcon:{width:26,height:26,borderRadius:9,backgroundColor:'#E8F1FF',alignItems:'center',justifyContent:'center'},
  addClaimNumberText:{flex:1,color:'#0A43A3',fontSize:10,fontWeight:'900'},
  claimNumberBackdrop:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(5,20,48,.50)',paddingHorizontal:24},
  claimNumberCard:{width:'100%',maxWidth:342,borderRadius:22,backgroundColor:'#FFFFFF',paddingHorizontal:18,paddingTop:18,paddingBottom:22,alignItems:'center',shadowColor:'#071D49',shadowOpacity:.2,shadowRadius:20,shadowOffset:{width:0,height:10},elevation:12},
  claimNumberIcon:{width:44,height:44,borderRadius:15,backgroundColor:'#EEF5FF',borderWidth:1,borderColor:'#D2E2FA',alignItems:'center',justifyContent:'center',marginBottom:10},
  claimNumberTitle:{color:palette.navy,fontSize:17,lineHeight:22,fontWeight:'900',textAlign:'center'},
  claimNumberInputShell:{width:'100%',minHeight:48,borderRadius:13,borderWidth:1.2,borderColor:'#CFD9E6',backgroundColor:'#F9FBFD',justifyContent:'center',marginTop:14},
  claimNumberInputShellError:{borderColor:'#D92D20',backgroundColor:'#FFF9F8'},
  claimNumberInput:{minHeight:46,paddingHorizontal:13,color:palette.navy,fontSize:13,fontWeight:'800'},
  claimNumberError:{alignSelf:'stretch',color:'#B42318',fontSize:9.5,lineHeight:13,fontWeight:'700',marginTop:5},
  claimNumberActions:{width:'100%',flexDirection:'row',alignItems:'stretch',marginTop:14,gap:10},
  claimNumberPrimary:{flex:1,flexBasis:0,minWidth:0,minHeight:44,borderRadius:12,backgroundColor:'#0A43A3',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:10},
  claimNumberPrimaryText:{color:'#FFFFFF',fontSize:10.8,fontWeight:'900'},
  claimNumberSecondary:{flex:1,flexBasis:0,minWidth:0,minHeight:44,borderRadius:12,borderWidth:1,borderColor:'#D7E0EB',backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
  claimNumberSecondaryText:{color:'#475467',fontSize:10.5,fontWeight:'900'},
  claimNumberDisabled:{opacity:.55},
  currentCard:{position:'relative',borderWidth:1,borderRadius:16,paddingVertical:9,paddingHorizontal:10,paddingLeft:14,flexDirection:'row',alignItems:'center',gap:9,marginBottom:7,overflow:'hidden'},currentCardPressed:{opacity:.84,transform:[{scale:.995}]},currentAccent:{position:'absolute',left:0,top:0,bottom:0,width:4},currentIconArtwork:{width:36,height:36,flexShrink:0},currentCopy:{flex:1,minWidth:0},currentEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:.5},currentTitle:{color:palette.navy,fontSize:13.5,fontWeight:'900',marginTop:1},currentBody:{color:'#5F7086',fontSize:10,lineHeight:13.5,fontWeight:'700',marginTop:2},currentContinue:{flexDirection:'row',alignItems:'center',gap:1,marginLeft:3},currentContinueText:{color:'#0A43A3',fontSize:9.5,fontWeight:'900'},
  sectionHeader:{minHeight:62,borderRadius:17,borderWidth:1,borderColor:'#D6E2EE',backgroundColor:'#F7FAFF',padding:11,marginTop:10,flexDirection:'row',alignItems:'center',gap:10},sectionHeaderArtwork:{width:40,height:40,flexShrink:0},sectionHeaderCopy:{flex:1,minWidth:0},sectionTitle:{color:palette.navy,fontSize:14,fontWeight:'900'},sectionSub:{color:'#718198',fontSize:10,fontWeight:'700',marginTop:2},sectionBody:{borderWidth:1,borderTopWidth:0,borderColor:'#D6E2EE',backgroundColor:'#FFFFFF',borderBottomLeftRadius:17,borderBottomRightRadius:17,padding:10,gap:8},
  journeyHeader:{minHeight:40,borderRadius:12,paddingVertical:5,paddingHorizontal:7,marginTop:6,gap:6},journeyHeaderArtwork:{width:30,height:30},journeyHeaderTitle:{fontSize:12,lineHeight:14},journeyHeaderSub:{fontSize:9.2,lineHeight:11,marginTop:1},journeyBody:{paddingVertical:5,paddingHorizontal:5,gap:4},
  stageRow:{minHeight:54,paddingHorizontal:5,paddingVertical:4,flexDirection:'row',alignItems:'stretch',gap:6,borderBottomWidth:1,borderBottomColor:'#EEF2F6'},stageRowCurrent:{backgroundColor:'#EDF5FF',borderRadius:8,borderWidth:1,borderColor:'#C8DCF3',marginVertical:2,paddingHorizontal:6},stageRail:{width:19,alignItems:'center',paddingTop:8},stageNode:{width:18,height:18,borderRadius:9,backgroundColor:'#EEF2F6',borderWidth:1,borderColor:'#E0E6ED',alignItems:'center',justifyContent:'center'},stageDone:{backgroundColor:'#168161',borderColor:'#168161'},stageCurrent:{backgroundColor:'#0A43A3',borderColor:'#0A43A3'},stageLine:{width:1,flex:1,minHeight:6,marginTop:3,backgroundColor:'#E4EAF1'},stageLineDone:{backgroundColor:'#A9D8C7'},stageCopy:{flex:1,minWidth:0,justifyContent:'center'},stageTitle:{color:palette.navy,fontSize:10.8,lineHeight:12.8,fontWeight:'900'},stageMeta:{color:'#7A8799',fontSize:9,lineHeight:10.5,fontWeight:'700',marginTop:1},stageMetaCurrent:{color:'#0A43A3',fontWeight:'900'},stageRight:{width:88,alignItems:'flex-end',justifyContent:'center',gap:2},stageDate:{color:'#344054',fontSize:8.7,lineHeight:10.4,fontWeight:'800',textAlign:'right'},stageDateMuted:{color:'#98A2B3'},stageAmount:{color:'#10365F',fontSize:9,lineHeight:10.5,fontWeight:'900',backgroundColor:'#EEF4FB',paddingHorizontal:5,paddingVertical:1,borderRadius:999},
  assistanceNotice:{marginTop:10,borderRadius:14,borderWidth:1,borderColor:'#B9E3D0',backgroundColor:'#F2FBF6',paddingVertical:11,paddingHorizontal:12,flexDirection:'row',alignItems:'flex-start',gap:9,shadowColor:'#0B5D45',shadowOpacity:.07,shadowRadius:6,shadowOffset:{width:0,height:2},elevation:1},assistanceNoticeIcon:{width:32,height:32,borderRadius:10,backgroundColor:'#DFF4E9',alignItems:'center',justifyContent:'center',flexShrink:0},assistanceNoticeCopy:{flex:1,minWidth:0},assistanceNoticeTitle:{color:'#12664C',fontSize:11,fontWeight:'900'},assistanceNoticeText:{color:'#23483C',fontSize:10.5,lineHeight:15,fontWeight:'700',marginTop:2},
  documentRow:{minHeight:52,borderRadius:13,backgroundColor:'#F7FAFF',borderWidth:1,borderColor:'#E1E9F2',padding:10,flexDirection:'row',alignItems:'center',gap:9},documentTitle:{color:palette.navy,fontSize:10.5,fontWeight:'900'},documentMeta:{color:'#7A8799',fontSize:9,fontWeight:'600',marginTop:2},emptyText:{color:'#7A8799',fontSize:10,fontWeight:'600',lineHeight:14},
});