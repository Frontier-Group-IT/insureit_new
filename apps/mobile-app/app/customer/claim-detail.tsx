import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { ClaimActionBar, ClaimFinancialSummary, ClaimPrimaryAction, ClaimProgressStrip } from '@/components/external-claim-ui';
import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { SELF_MANAGED_MILESTONES, type ClaimMilestone, type ClaimMilestoneKey } from '@/lib/claim-service-mode';
import { customerStageCopy } from '@/lib/claim-workflow';
import { formatJourneyAmount, formatJourneyDate, stageMainAmount, STAGE_DATE_LABELS } from '@/lib/self-managed-claim-timeline';
import { supabase } from '@/lib/supabase';
import { palette, roleTheme } from '@/lib/theme';
import type { Claim, ClaimDocument, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

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

  async function openDocument(document: ClaimDocument) {
    setMessage('');
    const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
    if (error || !data?.signedUrl) return setMessage('We could not open this document. Please try again.');
    await Linking.openURL(data.signedUrl);
  }

  return (
    <Screen title="Claim Detail" showLogout showTitleHeader={false}>
      <View style={styles.pageHeading}>
        <View style={styles.pageHeadingCopy}>
          <Text style={styles.pageEyebrow}>{selfManaged ? 'EXTERNAL CLAIM' : 'CLAIMS'}</Text>
          <Text style={styles.pageTitle}>{selfManaged ? 'Claim Tracker' : 'Claim Detail'}</Text>
          <Text style={styles.pageSubtitle}>{selfManaged ? 'Follow the complete claim journey and continue from the current stage.' : customerStageCopy(claim.current_status)}</Text>
        </View>
        {selfManaged ? <AppBadge label="Self Tracked" tone="info" /> : null}
      </View>
      {message ? <Message type="error">{message}</Message> : null}

      {selfManaged ? <ClaimProgressStrip step={Math.min(9, currentStageIndex + 1)} /> : null}

      <View style={[styles.heroCard, { borderColor: tone.border }]}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        <View style={styles.heroTop}>
          <View style={styles.statusIcon}><MaterialCommunityIcons name={settled ? 'check-decagram-outline' : 'shield-check-outline'} size={28} color="#0A43A3" /></View>
          <View style={styles.heroCopy}>
            <Text style={styles.stageLabel}>{settled ? 'CLAIM COMPLETE' : currentStage?.label ?? claim.current_status}</Text>
            <Text style={styles.vehicleNo}>{vehicle?.vehicle_no ?? 'Vehicle linked'}</Text>
            <Text style={styles.heroIdentity}>{claim.claim_no}{claim.insurer_claim_no ? ` · ${claim.insurer_claim_no}` : ''}</Text>
          </View>
        </View>
        <View style={styles.incidentRow}>
          <View><Text style={styles.metaLabel}>INCIDENT</Text><Text style={styles.incidentValue}>{selfManaged ? formatDateTime(claim.accident_at) : formatDate(claim.accident_at)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsExpanded }} onPress={() => setDetailsExpanded((value) => !value)} style={styles.detailsToggle}><Text style={styles.detailsToggleText}>Claim details</Text><MaterialCommunityIcons name={detailsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#FFFFFF" /></Pressable>
        </View>
        <View style={styles.heroProgressShell}>
          <View style={styles.heroProgressTop}><Text style={styles.heroProgressLabel}>JOURNEY PROGRESS</Text><Text style={styles.heroProgressValue}>{progress}%</Text></View>
          <View style={styles.heroProgressTrack}><View style={[styles.heroProgressFill, { width: `${Math.max(6, progress)}%` }]} /></View>
        </View>
        {detailsExpanded ? <View style={styles.infoBox}>
          <InfoPair leftLabel="Control No." leftValue={claim.claim_no} rightLabel="Claim No." rightValue={claim.insurer_claim_no || 'Awaiting insurer'} />
          <InfoPair leftLabel="Manufacturer" leftValue={vehicle?.make ?? '-'} rightLabel="Model" rightValue={vehicle?.model ?? '-'} />
          <InfoPair leftLabel="Policy" leftValue={policy?.policy_no ?? '-'} rightLabel="Insurer" rightValue={insurer?.name ?? '-'} />
          <InfoPair leftLabel="Policy Source" leftValue={policy?.source === 'external' ? 'External' : 'Sankalp'} rightLabel="Policy Type" rightValue={policy?.policy_type ?? '-'} />
        </View> : null}
      </View>

      <View style={[styles.currentCard, { borderColor: tone.border, backgroundColor: tone.background }]}>
        <View style={[styles.currentAccent, { backgroundColor: tone.accent }]} />
        <View style={[styles.currentIcon, { backgroundColor: tone.soft }]}><MaterialCommunityIcons name={settled ? 'check-circle-outline' : 'arrow-right-circle-outline'} size={23} color={tone.accent} /></View>
        <View style={styles.currentCopy}>
          <Text style={[styles.currentEyebrow, { color: tone.accent }]}>{selfManaged ? 'CURRENT MILESTONE' : 'NEXT ACTION'}</Text>
          <Text style={styles.currentTitle}>{settled ? 'Claim journey complete' : currentStage?.label ?? claim.current_status}</Text>
          <Text style={styles.currentBody}>{selfManaged ? settled ? 'All nine external claim milestones are recorded.' : currentStageHint(currentStage?.key) : customerStageCopy(claim.current_status)}</Text>
        </View>
      </View>

      {selfManaged && !settled ? <ClaimActionBar
        primaryLabel="Proceed to Next Step"
        primaryIcon="arrow-right"
        onPrimary={openCurrentSelfStage}
        onAssistance={() => router.push({ pathname: '/customer/request-claim-assistance', params: { id: claim.id } })}
      /> : null}
      {!selfManaged ? <ClaimPrimaryAction label="Upload Documents" icon="cloud-upload-outline" onPress={() => router.push({ pathname: '/customer/upload-documents', params: { claimId: claim.id } })} /> : null}

      {selfManaged && claim.assistance_status === 'requested' && !settled ? <Message type="info">Sankalp assistance has already been requested. Until accepted, you remain in control of this claim.</Message> : null}

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
            <View style={[styles.stageNode, done && styles.stageDone, current && styles.stageCurrent]}><MaterialCommunityIcons name={done ? 'check' : current ? 'circle-slice-8' : 'lock-outline'} size={13} color={done || current ? '#FFFFFF' : '#98A2B3'} /></View>
            {index < SELF_MANAGED_MILESTONES.length - 1 ? <View style={[styles.stageLine, done && styles.stageLineDone]} /> : null}
          </View>
          <View style={styles.stageCopy}>
            <Text style={styles.stageTitle}>{stage.label}</Text>
            <Text style={[styles.stageMeta, current && styles.stageMetaCurrent]}>{statusText}</Text>
            {selfManaged && (done || current) ? <Text style={styles.stageEventLabel}>{STAGE_DATE_LABELS[stage.key]}</Text> : null}
          </View>
          {selfManaged ? <View style={styles.stageRight}>
            <Text numberOfLines={2} style={[styles.stageDate, !milestone && styles.stageDateMuted]}>{done || current ? dateText : 'Pending'}</Text>
            {amount ? <Text style={styles.stageAmount}>{amount}</Text> : null}
            {editable ? <MaterialCommunityIcons name="chevron-right" size={18} color="#6782A2" /> : null}
          </View> : null}
        </Pressable>;
      })}</View> : null}

      {selfManaged && financialRows.length ? <ClaimFinancialSummary rows={financialRows} /> : null}

      <SectionHeader title="Documents" subtitle={`${documents.length} document${documents.length === 1 ? '' : 's'}`} expanded={documentsExpanded} onPress={() => setDocumentsExpanded((value) => !value)} />
      {documentsExpanded ? <View style={styles.sectionBody}>{documents.length ? documents.map((document) => <Pressable key={document.id} onPress={() => void openDocument(document)} style={styles.documentRow}><MaterialCommunityIcons name="file-document-outline" size={20} color={roleTheme.customer.accent} /><View style={{ flex: 1 }}><Text style={styles.documentTitle}>{document.document_type}</Text><Text style={styles.documentMeta}>{document.verification_status ?? 'uploaded'}</Text></View><MaterialCommunityIcons name="open-in-new" size={18} color={palette.slate} /></Pressable>) : <Text style={styles.emptyText}>No claim documents uploaded yet.</Text>}</View> : null}

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

function InfoPair({ leftLabel, leftValue, rightLabel, rightValue }: { leftLabel: string; leftValue: string; rightLabel: string; rightValue: string }) { return <View style={styles.infoPair}><View style={{ flex: 1 }}><Text style={styles.infoLabel}>{leftLabel}</Text><Text style={styles.infoValue}>{leftValue}</Text></View><View style={{ flex: 1 }}><Text style={styles.infoLabel}>{rightLabel}</Text><Text style={styles.infoValue}>{rightValue}</Text></View></View>; }
function SectionHeader({ title, subtitle, expanded, onPress }: { title: string; subtitle: string; expanded: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={styles.sectionHeader}><View style={styles.sectionHeaderIcon}><MaterialCommunityIcons name={title === 'Claim Journey' ? 'timeline-check-outline' : title === 'Documents' ? 'file-document-multiple-outline' : 'history'} size={18} color="#0A43A3" /></View><View style={styles.sectionHeaderCopy}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSub}>{subtitle}</Text></View><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#667C98" /></Pressable>; }
function managedStageFor(status?: string | null) { const value = (status ?? '').toLowerCase(); if (/settled|closed|payment/.test(value)) return 8; if (/delivery/.test(value)) return 7; if (/do submitted|delivery order/.test(value)) return 6; if (/bill/.test(value)) return 5; if (/repair/.test(value)) return 4; if (/approval|estimate/.test(value)) return 3; if (/intimat|surveyor|inspected/.test(value)) return 2; if (/document/.test(value)) return 1; return 0; }
const externalClaimTone = { accent:'#0A43A3',soft:'#EAF2FF',background:'#F7FAFF',border:'#BFD3EB' };
function claimTone(status: string) { if (['Settled','Closed','Claim Complete'].includes(status)) return { accent:'#12805C',soft:'#E8F8F0',background:'#F7FCF9',border:'#BFE6D5' }; return { accent:'#B7791F',soft:'#FFF4E2',background:'#FFFBF3',border:'#F0D9AC' }; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-'; }
function formatDateTime(value?: string | null) { return value ? new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}) : '-'; }

const styles = StyleSheet.create({
  pageHeading:{marginBottom:12,flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},pageHeadingCopy:{flex:1,minWidth:0},pageEyebrow:{color:'#145ED7',fontSize:10,fontWeight:'900',letterSpacing:1},pageTitle:{color:palette.navy,fontSize:24,fontWeight:'900',marginTop:2},pageSubtitle:{color:'#6A7789',fontSize:10.5,lineHeight:15,fontWeight:'600',marginTop:3},
  heroCard:{position:'relative',borderWidth:1,borderRadius:21,padding:15,backgroundColor:'#07327B',overflow:'hidden',marginTop:13,marginBottom:11,shadowColor:'#07327B',shadowOpacity:.16,shadowRadius:12,shadowOffset:{width:0,height:6},elevation:3},heroOrbLarge:{position:'absolute',width:190,height:190,borderRadius:95,right:-75,top:-108,borderWidth:1,borderColor:'rgba(75,145,255,.20)'},heroOrbSmall:{position:'absolute',width:130,height:130,borderRadius:65,right:-23,top:-74,borderWidth:1,borderColor:'rgba(75,145,255,.18)'},heroTop:{flexDirection:'row',alignItems:'center',gap:11},statusIcon:{width:54,height:54,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF'},heroCopy:{flex:1,minWidth:0},stageLabel:{color:'#A8C8FF',fontSize:9,fontWeight:'900',letterSpacing:.7},vehicleNo:{color:'#FFFFFF',fontSize:21,fontWeight:'900',marginTop:2},heroIdentity:{color:'#DCE8F7',fontSize:10.5,fontWeight:'800',marginTop:2},incidentRow:{marginTop:13,paddingTop:11,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.27)',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},metaLabel:{color:'#A9C0E0',fontSize:8.5,fontWeight:'900',letterSpacing:.6},incidentValue:{color:'#FFFFFF',fontSize:11,fontWeight:'900',marginTop:2},detailsToggle:{minHeight:38,borderRadius:11,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(255,255,255,.10)',borderWidth:1,borderColor:'rgba(255,255,255,.22)'},detailsToggleText:{color:'#FFFFFF',fontSize:9.5,fontWeight:'900'},heroProgressShell:{marginTop:11,borderRadius:13,backgroundColor:'rgba(255,255,255,.08)',borderWidth:1,borderColor:'rgba(255,255,255,.16)',padding:9},heroProgressTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},heroProgressLabel:{color:'#C4D5EC',fontSize:8,fontWeight:'900',letterSpacing:.7},heroProgressValue:{color:'#FFFFFF',fontSize:10,fontWeight:'900'},heroProgressTrack:{height:7,borderRadius:999,backgroundColor:'rgba(255,255,255,.18)',marginTop:7,overflow:'hidden'},heroProgressFill:{height:'100%',borderRadius:999,backgroundColor:'#4A9BFF'},infoBox:{marginTop:10,borderRadius:14,backgroundColor:'rgba(255,255,255,.08)',borderWidth:1,borderColor:'rgba(255,255,255,.16)',padding:10,gap:8},infoPair:{flexDirection:'row',gap:14},infoLabel:{color:'#A9BED9',fontSize:8.5,fontWeight:'800'},infoValue:{color:'#FFFFFF',fontSize:10.2,fontWeight:'900',marginTop:2},
  currentCard:{position:'relative',borderWidth:1,borderRadius:18,padding:12,paddingLeft:15,flexDirection:'row',alignItems:'center',gap:10,marginBottom:10,overflow:'hidden'},currentAccent:{position:'absolute',left:0,top:0,bottom:0,width:4},currentIcon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center'},currentCopy:{flex:1,minWidth:0},currentEyebrow:{fontSize:8.5,fontWeight:'900',letterSpacing:.5},currentTitle:{color:palette.navy,fontSize:14.5,fontWeight:'900',marginTop:2},currentBody:{color:'#5F7086',fontSize:10.8,lineHeight:15,fontWeight:'700',marginTop:3},
  sectionHeader:{minHeight:62,borderRadius:17,borderWidth:1,borderColor:'#D6E2EE',backgroundColor:'#F7FAFF',padding:11,marginTop:10,flexDirection:'row',alignItems:'center',gap:10},sectionHeaderIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#E7F0FC',borderWidth:1,borderColor:'#D4E2F2',alignItems:'center',justifyContent:'center'},sectionHeaderCopy:{flex:1,minWidth:0},sectionTitle:{color:palette.navy,fontSize:14,fontWeight:'900'},sectionSub:{color:'#718198',fontSize:10,fontWeight:'700',marginTop:2},sectionBody:{borderWidth:1,borderTopWidth:0,borderColor:'#D6E2EE',backgroundColor:'#FFFFFF',borderBottomLeftRadius:17,borderBottomRightRadius:17,padding:10,gap:8},journeyBody:{padding:8,gap:0},
  stageRow:{minHeight:72,paddingHorizontal:8,paddingVertical:9,flexDirection:'row',alignItems:'stretch',gap:9,borderBottomWidth:1,borderBottomColor:'#EEF2F6'},stageRowCurrent:{backgroundColor:'#EDF5FF',borderRadius:14,borderWidth:1,borderColor:'#C8DCF3',marginVertical:4,paddingHorizontal:10},stageRail:{width:30,alignItems:'center'},stageNode:{width:30,height:30,borderRadius:15,backgroundColor:'#EEF2F6',borderWidth:1,borderColor:'#E0E6ED',alignItems:'center',justifyContent:'center'},stageDone:{backgroundColor:'#168161',borderColor:'#168161'},stageCurrent:{backgroundColor:'#0A43A3',borderColor:'#0A43A3'},stageLine:{width:2,flex:1,minHeight:20,marginTop:4,backgroundColor:'#E4EAF1'},stageLineDone:{backgroundColor:'#A9D8C7'},stageCopy:{flex:1,minWidth:0,justifyContent:'center'},stageTitle:{color:palette.navy,fontSize:11.5,fontWeight:'900'},stageMeta:{color:'#7A8799',fontSize:9.5,fontWeight:'700',marginTop:2},stageMetaCurrent:{color:'#0A43A3',fontWeight:'900'},stageEventLabel:{color:'#8B9AAD',fontSize:8.5,fontWeight:'700',marginTop:3},stageRight:{width:112,alignItems:'flex-end',justifyContent:'center',gap:3},stageDate:{color:'#344054',fontSize:9.5,lineHeight:13,fontWeight:'800',textAlign:'right'},stageDateMuted:{color:'#98A2B3'},stageAmount:{color:'#10365F',fontSize:10.8,fontWeight:'900',backgroundColor:'#EEF4FB',paddingHorizontal:7,paddingVertical:3,borderRadius:999},
  documentRow:{minHeight:52,borderRadius:13,backgroundColor:'#F7FAFF',borderWidth:1,borderColor:'#E1E9F2',padding:10,flexDirection:'row',alignItems:'center',gap:9},documentTitle:{color:palette.navy,fontSize:10.5,fontWeight:'900'},documentMeta:{color:'#7A8799',fontSize:9,fontWeight:'600',marginTop:2},emptyText:{color:'#7A8799',fontSize:10,fontWeight:'600',lineHeight:14},
});
