import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { SELF_MANAGED_MILESTONES, type ClaimMilestone } from '@/lib/claim-service-mode';
import { customerStageCopy } from '@/lib/claim-workflow';
import { supabase } from '@/lib/supabase';
import { palette, roleTheme } from '@/lib/theme';
import type { Claim, ClaimDocument, ClaimHistory, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

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
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [milestones, setMilestones] = useState<ClaimMilestone[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [documentsExpanded, setDocumentsExpanded] = useState(false);
  const [journeyExpanded, setJourneyExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!id) return;
      const [claimResult, historyResult, documentsResult, milestoneResult] = await Promise.all([
        supabase.from('claims').select('*').eq('id', id).maybeSingle(),
        supabase.from('claim_status_history').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        supabase.from('claim_documents').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        (supabase as any).from('claim_milestones').select('*').eq('claim_id', id),
      ]);
      if (!active) return;
      const nextClaim = claimResult.data as ClaimWithOwnership | null;
      setClaim(nextClaim);
      setHistory(historyResult.data ?? []);
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

  const tone = selfManaged ? externalClaimTone : claimTone(claim.current_status);
  const currentStage = SELF_MANAGED_MILESTONES[currentStageIndex];
  const settled = ['Settled', 'Closed', 'Claim Complete'].includes(claim.current_status) || (selfManaged && completedKeys.size >= 9);
  const lastUpdateAt = history[0]?.created_at ?? claim.updated_at ?? claim.created_at;
  const remainingStages = selfManaged ? Math.max(0, SELF_MANAGED_MILESTONES.length - completedKeys.size) : Math.max(0, SELF_MANAGED_MILESTONES.length - currentStageIndex - 1);

  function openCurrentSelfStage() {
    if (!selfManaged || settled || !currentStage) return;
    if (currentStage.key === 'spot_status') router.push({ pathname: '/customer/self-managed-spot-status', params: { id: claim.id } });
    else router.push({ pathname: '/customer/self-managed-milestone', params: { id: claim.id, key: currentStage.key } });
  }

  async function openDocument(document: ClaimDocument) {
    setMessage('');
    const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
    if (error || !data?.signedUrl) return setMessage('We could not open this document. Please try again.');
    await Linking.openURL(data.signedUrl);
  }

  return <Screen title="Claim Detail" showLogout showTitleHeader={false}>
    <View style={styles.pageHeading}>
      <View style={styles.pageHeadingCopy}>
        <Text style={styles.pageEyebrow}>{selfManaged ? 'EXTERNAL CLAIM' : 'CLAIMS'}</Text>
        <Text style={styles.pageTitle}>{selfManaged ? 'Claim Tracker' : 'Claim Detail'}</Text>
      </View>
      {selfManaged ? <AppBadge label="Self Tracked" tone="info" /> : null}
    </View>
    {message ? <Message type="error">{message}</Message> : null}

    <View style={[styles.heroCard, { backgroundColor: tone.background, borderColor: tone.border }]}>
      <View style={[styles.accentBar, { backgroundColor: tone.accent }]} />
      <View style={styles.heroTop}>
        <View style={[styles.statusIcon, { backgroundColor: tone.soft }]}><MaterialCommunityIcons name={settled ? 'check-decagram-outline' : 'shield-check-outline'} size={25} color={tone.accent} /></View>
        <View style={styles.heroCopy}><Text style={[styles.stageLabel, { color: tone.accent }]}>{settled ? 'CLAIM COMPLETE' : currentStage?.label ?? claim.current_status}</Text><Text style={styles.vehicleNo}>{vehicle?.vehicle_no ?? 'Vehicle linked'}</Text></View>
        {!selfManaged ? <View style={[styles.focusStatusBadge, { backgroundColor: tone.soft, borderColor: tone.border }]}><Text style={[styles.focusStatusText, { color: tone.accent }]}>Sankalp Managed</Text></View> : null}
      </View>
      <View style={styles.numberRow}><InfoNumber label="Control No." value={claim.claim_no} /><InfoNumber label="Claim No." value={claim.insurer_claim_no || 'Awaiting insurer'} /></View>
      <View style={styles.infoBox}><InfoPair leftLabel="Manufacturer" leftValue={vehicle?.make ?? '-'} rightLabel="Model" rightValue={vehicle?.model ?? '-'} /><InfoPair leftLabel="Policy" leftValue={policy?.policy_no ?? '-'} rightLabel="Insurer" rightValue={insurer?.name ?? '-'} /><InfoPair leftLabel="Incident Date" leftValue={formatDate(claim.accident_at)} rightLabel="Policy Source" rightValue={policy?.source === 'external' ? 'External' : 'Sankalp'} /></View>
      <View style={styles.progressSummary}>
        <View style={styles.progressSummaryHeader}><Text style={styles.progressLabel}>CLAIM PROGRESS</Text><Text style={styles.progressCount}>{selfManaged ? `${completedKeys.size} of 9 milestones` : `${currentStageIndex + 1} of 9 stages`}</Text></View>
        <View style={styles.progressTrack}>{SELF_MANAGED_MILESTONES.map((stage, index) => {
          const active = selfManaged ? completedKeys.has(stage.key) || index === currentStageIndex : index <= currentStageIndex;
          return <View key={stage.key} style={[styles.progressSegment, active && { backgroundColor: tone.accent }]} />;
        })}</View>
        <View style={styles.progressMeta}><Text style={styles.progressMetaText}>{progress}% complete</Text><Text style={styles.progressMetaText}>{settled ? 'Journey complete' : `${remainingStages} ${remainingStages === 1 ? 'stage' : 'stages'} remaining`}</Text></View>
      </View>
    </View>

    <View style={[styles.nextActionCard, { borderColor: tone.border }]}><View style={[styles.nextActionIcon, { backgroundColor: tone.soft }]}><MaterialCommunityIcons name={settled ? 'check-circle-outline' : 'arrow-right-circle-outline'} size={22} color={tone.accent} /></View><View style={{ flex: 1 }}><Text style={[styles.nextLabel, { color: tone.accent }]}>{settled ? 'JOURNEY STATUS' : 'WHAT HAPPENS NEXT'}</Text><Text style={styles.nextTitle}>{settled ? 'Claim journey complete' : currentStage?.label ?? claim.current_status}</Text><Text style={styles.nextBody}>{selfManaged ? settled ? 'All nine external claim milestones are recorded.' : 'Record this milestone when you receive the related update from the insurer, surveyor, or workshop.' : customerStageCopy(claim.current_status)}</Text><View style={styles.nextMeta}><Text style={styles.nextMetaText}>Last update: {formatDateTime(lastUpdateAt)}</Text><Text style={styles.nextMetaText}>{claim.assistance_status === 'requested' ? 'Assistance requested' : selfManaged ? 'You are in control' : 'Sankalp is managing'}</Text></View></View></View>

    <View style={styles.quickActions}>
      {selfManaged && !settled ? (
        claim.assistance_status !== 'requested' ? (
          <View style={styles.selfManagedActionRow}>
            <View style={styles.selfManagedActionColumn}>
              <QuickAction icon="pencil-circle-outline" label="Update Current Stage" primary onPress={openCurrentSelfStage} />
            </View>
            <View style={styles.selfManagedActionColumn}>
              <QuickAction tone="secondary" icon="account-tie-voice-outline" label="Request Assistance" onPress={() => router.push({ pathname: '/customer/request-claim-assistance', params: { id: claim.id } })} />
            </View>
          </View>
        ) : (
          <QuickAction icon="pencil-circle-outline" label="Update Current Stage" primary onPress={openCurrentSelfStage} />
        )
      ) : null}
      {!selfManaged ? <QuickAction icon="cloud-upload-outline" label="Upload Documents" primary onPress={() => router.push({ pathname: '/customer/upload-documents', params: { claimId: claim.id } })} /> : null}
    </View>
    {selfManaged && claim.assistance_status === 'requested' && !settled ? <Message type="info">Sankalp assistance has been requested. Until accepted, you remain in control of this claim.</Message> : null}

    <SectionHeader title="Documents" subtitle={`${documents.length} document${documents.length === 1 ? '' : 's'}`} expanded={documentsExpanded} onPress={() => setDocumentsExpanded((value) => !value)} />
    {documentsExpanded ? <View style={styles.sectionBody}>{documents.length ? documents.map((document) => <Pressable key={document.id} onPress={() => void openDocument(document)} style={styles.documentRow}><MaterialCommunityIcons name="file-document-outline" size={20} color={roleTheme.customer.accent} /><View style={{ flex: 1 }}><Text style={styles.documentTitle}>{document.document_type}</Text><Text style={styles.documentMeta}>{document.verification_status ?? 'uploaded'}</Text></View><MaterialCommunityIcons name="open-in-new" size={18} color={palette.slate} /></Pressable>) : <View style={styles.emptyState}><MaterialCommunityIcons name="file-plus-outline" size={22} color={tone.accent} /><Text style={styles.emptyText}>{selfManaged ? 'No documents uploaded yet. Add the documents requested for this stage.' : 'No claim documents uploaded yet.'}</Text></View>}</View> : null}

    <SectionHeader title="Status History" subtitle={`${history.length} movement record${history.length === 1 ? '' : 's'}`} expanded={historyExpanded} onPress={() => setHistoryExpanded((value) => !value)} />
    {historyExpanded ? <View style={styles.sectionBody}>{history.length ? history.map((item) => <View key={item.id} style={styles.historyRow}><View style={styles.historyDot} /><View style={{ flex: 1 }}><Text style={styles.historyStatus}>{item.to_status}</Text><Text style={styles.documentMeta}>{formatDateTime(item.created_at)}</Text>{item.notes ? <Text style={styles.emptyText}>{item.notes}</Text> : null}</View></View>) : <Text style={styles.emptyText}>No timeline updates yet.</Text>}</View> : null}

    <SectionHeader title={selfManaged ? 'External Claim Journey' : 'Claim Journey'} subtitle={`${progress}% complete • ${currentStage?.label ?? claim.current_status}`} expanded={journeyExpanded} onPress={() => setJourneyExpanded((value) => !value)} />
    {journeyExpanded ? <View style={styles.sectionBody}>{SELF_MANAGED_MILESTONES.map((stage, index) => {
      const done = selfManaged ? completedKeys.has(stage.key) : index < currentStageIndex;
      const current = !settled && index === currentStageIndex;
      const editable = selfManaged && (done || current) && stage.key !== 'spot_intimation';
      return <Pressable key={stage.key} disabled={!editable} onPress={() => {
        if (stage.key === 'spot_status') router.push({ pathname: '/customer/self-managed-spot-status', params: { id: claim.id } });
        else router.push({ pathname: '/customer/self-managed-milestone', params: { id: claim.id, key: stage.key } });
      }} style={[styles.stageRow, current && { borderColor: tone.accent, backgroundColor: tone.soft }]}>
        <View style={[styles.stageNode, done && styles.stageDone, current && { backgroundColor: tone.accent }]}><MaterialCommunityIcons name={done ? 'check' : current ? 'map-marker' : 'lock-outline'} size={14} color={done || current ? '#FFF' : '#7A8799'} /></View>
        <View style={{ flex: 1 }}><Text style={styles.stageTitle}>{stage.label}</Text><Text style={styles.stageMeta}>{done ? selfManaged ? 'Completed • tap to review' : 'Completed' : current ? selfManaged ? 'Current stage • tap to update' : 'Current stage' : 'Upcoming'}</Text></View>
      </Pressable>;
    })}<View style={styles.bottomContentSpacer} /></View> : null}
  </Screen>;
}

function InfoNumber({ label, value }: { label: string; value: string }) { return <View style={{ flex: 1 }}><Text style={styles.numberLabel}>{label}</Text><Text style={styles.numberValue}>{value}</Text></View>; }
function InfoPair({ leftLabel, leftValue, rightLabel, rightValue }: { leftLabel: string; leftValue: string; rightLabel: string; rightValue: string }) { return <View style={styles.infoPair}><View style={{ flex: 1 }}><Text style={styles.infoLabel}>{leftLabel}</Text><Text style={styles.infoValue}>{leftValue}</Text></View><View style={{ flex: 1 }}><Text style={styles.infoLabel}>{rightLabel}</Text><Text style={styles.infoValue}>{rightValue}</Text></View></View>; }
function QuickAction({ icon, label, onPress, primary, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; primary?: boolean; tone?: 'primary' | 'secondary' }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.02, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const isSecondary = tone === 'secondary' && !primary;

  return (
    <Animated.View style={{ transform: [{ scale: pulse }], flex: 1 }}>
      <Pressable onPress={onPress} style={[styles.quickAction, primary && styles.quickActionPrimary, isSecondary && styles.quickActionSecondary]}>
        <MaterialCommunityIcons name={icon} size={20} color={primary ? '#FFF' : isSecondary ? '#B45309' : palette.navy} />
        <Text style={[styles.quickActionText, primary && { color: '#FFF' }, isSecondary && { color: '#7C2D12' }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}
function SectionHeader({ title, subtitle, expanded, onPress }: { title: string; subtitle: string; expanded: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSub}>{subtitle}</Text></View><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={palette.slate} /></Pressable>; }
function managedStageFor(status?: string | null) { const value = (status ?? '').toLowerCase(); if (/settled|closed|payment/.test(value)) return 8; if (/delivery/.test(value)) return 7; if (/do submitted|delivery order/.test(value)) return 6; if (/bill/.test(value)) return 5; if (/repair/.test(value)) return 4; if (/approval|estimate/.test(value)) return 3; if (/intimat|surveyor|inspected/.test(value)) return 2; if (/document/.test(value)) return 1; return 0; }
const externalClaimTone = { accent:'#0A43A3',soft:'#EAF2FF',background:'#F7FAFF',border:'#C9DAF2' };
function claimTone(status: string) { if (['Settled','Closed','Claim Complete'].includes(status)) return { accent:'#12805C',soft:'#E8F8F0',background:'#F7FCF9',border:'#BFE6D5' }; return { accent:'#B7791F',soft:'#FFF4E2',background:'#FFFBF3',border:'#F0D9AC' }; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-'; }
function formatDateTime(value?: string | null) { return value ? new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-'; }

const styles = StyleSheet.create({
  pageHeading:{marginBottom:12,flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},pageHeadingCopy:{flex:1,minWidth:0},pageEyebrow:{color:'#0A43A3',fontSize:9.5,fontWeight:'900',letterSpacing:1},pageTitle:{color:palette.navy,fontSize:24,fontWeight:'900',marginTop:2},heroCard:{borderWidth:1,borderRadius:21,padding:15,overflow:'hidden',marginBottom:12},accentBar:{position:'absolute',left:0,top:0,bottom:0,width:5},heroTop:{flexDirection:'row',alignItems:'center',gap:11},statusIcon:{width:48,height:48,borderRadius:15,alignItems:'center',justifyContent:'center'},heroCopy:{flex:1,minWidth:0},stageLabel:{fontSize:9,fontWeight:'900',letterSpacing:.5},vehicleNo:{color:palette.navy,fontSize:20,fontWeight:'900',marginTop:2},focusStatusBadge:{maxWidth:100,borderWidth:1,borderRadius:999,paddingHorizontal:8,paddingVertical:5},focusStatusText:{fontSize:8.5,fontWeight:'900',textAlign:'center'},numberRow:{flexDirection:'row',gap:14,marginTop:15,paddingTop:12,borderTopWidth:1,borderTopColor:'rgba(100,120,150,.16)'},numberLabel:{color:'#7A8799',fontSize:9,fontWeight:'800'},numberValue:{color:palette.navy,fontSize:12,fontWeight:'900',marginTop:2},infoBox:{marginTop:12,borderRadius:14,backgroundColor:'rgba(255,255,255,.72)',padding:11,gap:9},infoPair:{flexDirection:'row',gap:14},infoLabel:{color:'#7A8799',fontSize:8.5,fontWeight:'800'},infoValue:{color:'#334155',fontSize:10.5,fontWeight:'800',marginTop:2},
  progressSummary:{marginTop:12,borderRadius:14,backgroundColor:'rgba(255,255,255,.72)',padding:11,gap:8},progressSummaryHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},progressLabel:{color:'#0A43A3',fontSize:8.5,fontWeight:'900',letterSpacing:.5},progressCount:{color:'#334155',fontSize:9.5,fontWeight:'800'},progressTrack:{flexDirection:'row',gap:5},progressSegment:{flex:1,height:6,borderRadius:4,backgroundColor:'#DCE6F0'},progressMeta:{flexDirection:'row',justifyContent:'space-between',gap:8},progressMetaText:{color:'#667085',fontSize:9,fontWeight:'700'},
  nextActionCard:{borderWidth:1,borderRadius:17,padding:12,flexDirection:'row',gap:10,backgroundColor:'#FFF',marginBottom:10},nextActionIcon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center'},nextLabel:{fontSize:8.5,fontWeight:'900',letterSpacing:.4},nextTitle:{color:palette.navy,fontSize:13,fontWeight:'900'},nextBody:{color:'#667085',fontSize:10.3,lineHeight:14,fontWeight:'600',marginTop:3},nextMeta:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:7},nextMetaText:{color:'#7A8799',fontSize:8.8,fontWeight:'700'},quickActions:{width:'100%',flexDirection:'row',flexWrap:'nowrap',gap:8,marginBottom:10},selfManagedActionRow:{flexDirection:'row',gap:8,width:'100%'},selfManagedActionColumn:{flex:1,minWidth:0},quickAction:{flex:1,minHeight:44,borderRadius:14,borderWidth:1,borderColor:'#DCE6F0',backgroundColor:'#FFF',paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},quickActionPrimary:{backgroundColor:palette.navy,borderColor:palette.navy},quickActionSecondary:{backgroundColor:'#FFF7ED',borderColor:'#F59E0B',shadowColor:'#F59E0B',shadowOpacity:0.2,shadowRadius:6,shadowOffset:{width:0,height:3},elevation:2},quickActionText:{color:palette.navy,fontSize:10,fontWeight:'900'},
  sectionHeader:{minHeight:64,borderRadius:17,borderWidth:1,borderColor:'#DCE6F0',backgroundColor:'#FFF',padding:12,marginTop:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sectionTitle:{color:palette.navy,fontSize:14,fontWeight:'900'},sectionSub:{color:'#7A8799',fontSize:9.8,fontWeight:'600',marginTop:2},sectionBody:{borderWidth:1,borderTopWidth:0,borderColor:'#DCE6F0',backgroundColor:'#FFF',borderBottomLeftRadius:17,borderBottomRightRadius:17,padding:10,gap:8},documentRow:{minHeight:50,borderRadius:12,backgroundColor:'#F8FBFF',padding:10,flexDirection:'row',alignItems:'center',gap:9},documentTitle:{color:palette.navy,fontSize:10.5,fontWeight:'900'},documentMeta:{color:'#7A8799',fontSize:9,fontWeight:'600',marginTop:2},emptyState:{minHeight:52,borderRadius:12,backgroundColor:'#F8FBFF',padding:10,flexDirection:'row',alignItems:'center',gap:9},emptyText:{color:'#7A8799',fontSize:10,fontWeight:'600',lineHeight:14,flex:1},historyRow:{flexDirection:'row',gap:9,paddingVertical:7},historyDot:{width:9,height:9,borderRadius:5,backgroundColor:'#0A43A3',marginTop:4},historyStatus:{color:palette.navy,fontSize:10.5,fontWeight:'900'},stageRow:{minHeight:58,borderRadius:13,borderWidth:1,borderColor:'#E1E8F0',backgroundColor:'#FFF',padding:10,flexDirection:'row',alignItems:'center',gap:10},stageNode:{width:28,height:28,borderRadius:14,backgroundColor:'#EEF2F6',alignItems:'center',justifyContent:'center'},stageDone:{backgroundColor:'#12805C'},stageTitle:{color:palette.navy,fontSize:11,fontWeight:'900'},stageMeta:{color:'#7A8799',fontSize:9,fontWeight:'600',marginTop:2},bottomContentSpacer:{height:96}
});