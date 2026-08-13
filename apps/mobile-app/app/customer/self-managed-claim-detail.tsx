import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LoadingState, Message, Screen } from '@/components/ui';
import { SELF_MANAGED_MILESTONES, type ClaimMilestone } from '@/lib/claim-service-mode';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

type ClaimSummary = {
  id: string;
  claim_no: string;
  claim_service_mode: string;
  assistance_status: string;
  assistance_requested_at: string | null;
  assistance_notes: string | null;
  customer_id: string;
  vehicle_id: string;
  policy_id: string | null;
  external_policy_id: string | null;
  insurance_company_id: string | null;
  accident_at: string | null;
};
type VehicleSummary = { id: string; vehicle_no: string; make: string | null; model: string | null };
type PolicySummary = { id: string; policy_no: string; end_date: string };
type InsurerSummary = { id: string; name: string };
type FinancialSummary = {
  estimate_amount: number | null;
  approved_amount: number | null;
  bill_amount: number | null;
  do_amount: number | null;
  customer_paid_amount: number | null;
  payment_received_amount: number | null;
  further_deduction_amount: number | null;
  cashless: boolean | null;
};

export default function SelfManagedClaimDetailScreen() {
  const router = useRouter();
  const { id, assistance } = useLocalSearchParams<{ id?: string; assistance?: string }>();
  const [claim, setClaim] = useState<ClaimSummary | null>(null);
  const [vehicle, setVehicle] = useState<VehicleSummary | null>(null);
  const [policy, setPolicy] = useState<PolicySummary | null>(null);
  const [insurer, setInsurer] = useState<InsurerSummary | null>(null);
  const [milestones, setMilestones] = useState<ClaimMilestone[]>([]);
  const [financials, setFinancials] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Claim reference is missing.');
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const { data: c, error: e } = await supabase
        .from('claims')
        .select('id,claim_no,claim_service_mode,assistance_status,assistance_requested_at,assistance_notes,customer_id,vehicle_id,policy_id,external_policy_id,insurance_company_id,accident_at')
        .eq('id', id)
        .maybeSingle();
      if (!active) return;
      if (e || !c) {
        setError('We could not load this claim.');
        setLoading(false);
        return;
      }
      if (c.claim_service_mode !== 'self_managed') {
        router.replace({ pathname: '/customer/claim-detail', params: { id: c.id } });
        return;
      }
      setClaim(c as ClaimSummary);
      const policyQuery = c.external_policy_id
        ? supabase.from('external_policies').select('id,policy_no,end_date').eq('id', c.external_policy_id).maybeSingle()
        : c.policy_id
          ? supabase.from('policies').select('id,policy_no,end_date').eq('id', c.policy_id).maybeSingle()
          : Promise.resolve({ data: null, error: null });
      const [v, p, i, m, f] = await Promise.all([
        supabase.from('vehicles').select('id,vehicle_no,make,model').eq('id', c.vehicle_id).maybeSingle(),
        policyQuery,
        c.insurance_company_id
          ? supabase.from('insurance_companies').select('id,name').eq('id', c.insurance_company_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('claim_milestones').select('*').eq('claim_id', c.id).order('created_at', { ascending: true }),
        supabase.from('claim_financials').select('*').eq('claim_id', c.id).maybeSingle(),
      ]);
      if (!active) return;
      setVehicle((v.data as VehicleSummary | null) ?? null);
      setPolicy((p.data as PolicySummary | null) ?? null);
      setInsurer((i.data as InsurerSummary | null) ?? null);
      setMilestones((m.data ?? []) as ClaimMilestone[]);
      setFinancials((f.data as FinancialSummary | null) ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, router]);

  const map = useMemo(() => new Map(milestones.map((x) => [x.milestone_key, x])), [milestones]);
  const completed = useMemo(
    () => SELF_MANAGED_MILESTONES.filter((x) => ['completed', 'not_applicable'].includes(map.get(x.key)?.milestone_status ?? '')).length,
    [map],
  );
  const next = useMemo(
    () => SELF_MANAGED_MILESTONES.find((x) => !['completed', 'not_applicable'].includes(map.get(x.key)?.milestone_status ?? '')) ?? null,
    [map],
  );
  const progress = Math.round((completed / SELF_MANAGED_MILESTONES.length) * 100);
  const recentActivity = useMemo(
    () => milestones
      .filter((item) => ['completed', 'not_applicable'].includes(item.milestone_status))
      .sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime())
      .slice(0, 4),
    [milestones],
  );

  if (loading) return <Screen title="Claim Tracker" showTitleHeader={false}><LoadingState label="Opening claim tracker" /></Screen>;
  if (error || !claim) return <Screen title="Claim Tracker" showTitleHeader={false}><Message type="error">{error || 'Claim not found.'}</Message></Screen>;

  const assistanceRequested = claim.assistance_status === 'requested';
  const assistanceDeclined = claim.assistance_status === 'declined';
  const serviceTitle = assistanceRequested ? 'Assistance requested' : assistanceDeclined ? 'Self tracked' : 'Self tracked';
  const serviceSubtitle = assistanceRequested
    ? 'Sankalp review is pending. You can continue updating the claim.'
    : assistanceDeclined
      ? 'This claim remains under your tracking.'
      : 'You control the journey for this external policy.';

  const openMilestone = (key: string) => {
    if (key === 'spot_intimation') return;
    if (key === 'spot_status') {
      router.push({ pathname: '/customer/self-managed-spot-status', params: { id: claim.id } });
      return;
    }
    router.push({ pathname: '/customer/self-managed-milestone', params: { id: claim.id, key } });
  };

  return (
    <Screen title="Claim Tracker" showTitleHeader={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.overline}>EXTERNAL CLAIM</Text>
          <Text style={styles.claimNo}>{claim.claim_no}</Text>
          <Text style={styles.headerSub}>{vehicle?.vehicle_no ?? 'Vehicle'} · {insurer?.name ?? 'External insurer'}</Text>
        </View>
        <View style={styles.externalBadge}><Text style={styles.externalBadgeText}>SELF TRACKED</Text></View>
      </View>

      {assistance === 'requested' ? <Message type="success">Your assistance request has been sent to Sankalp.</Message> : null}

      <View style={[styles.serviceCard, assistanceRequested && styles.serviceCardPending]}>
        <View style={[styles.serviceIcon, assistanceRequested && styles.serviceIconPending]}>
          <MaterialCommunityIcons name={assistanceRequested ? 'clock-outline' : 'account-edit-outline'} size={20} color={assistanceRequested ? '#8A5B00' : '#0A43A3'} />
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.serviceTitle}>{serviceTitle}</Text>
          <Text style={styles.serviceSubtitle}>{serviceSubtitle}</Text>
        </View>
        {assistanceRequested ? <View style={styles.pendingPill}><Text style={styles.pendingPillText}>PENDING</Text></View> : null}
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.flexOne}>
            <Text style={styles.heroEyebrow}>CLAIM PROGRESS</Text>
            <Text style={styles.heroValue}>{progress}% complete</Text>
            <Text style={styles.heroMeta}>{completed} of {SELF_MANAGED_MILESTONES.length} milestones recorded</Text>
          </View>
          <View style={styles.progressRing}><Text style={styles.progressRingText}>{progress}%</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <View style={styles.currentStageCard}>
          <View style={styles.currentStageIcon}><MaterialCommunityIcons name={next ? 'flag-outline' : 'check-decagram'} size={20} color="#FFFFFF" /></View>
          <View style={styles.flexOne}>
            <Text style={styles.currentStageLabel}>{next ? 'CURRENT STEP' : 'CLAIM HISTORY COMPLETE'}</Text>
            <Text style={styles.currentStageTitle}>{next?.label ?? 'All 9 milestones are recorded'}</Text>
            <Text style={styles.currentStageHint}>{next ? 'Update this when the insurer or workshop moves the claim forward.' : 'This claim now stays available as a completed record. You can still review stages and documents whenever needed.'}</Text>
          </View>
          {next && next.key !== 'spot_intimation' ? (
            <Pressable style={styles.currentStageAction} onPress={() => openMilestone(next.key)}>
              <Text style={styles.currentStageActionText}>UPDATE</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoGrid}>
          <Info label="Vehicle" value={vehicle?.vehicle_no ?? '-'} />
          <Info label="Policy" value={policy?.policy_no ?? '-'} />
          <Info label="Insurer" value={insurer?.name ?? '-'} />
          <Info label="Accident" value={fmtDateTime(claim.accident_at)} />
        </View>
      </View>

      {financials ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>FINANCIAL SNAPSHOT</Text>
              <Text style={styles.sectionTitle}>Claim amounts</Text>
            </View>
            {financials.cashless != null ? <View style={styles.cashlessPill}><Text style={styles.cashlessPillText}>{financials.cashless ? 'CASHLESS' : 'REIMBURSEMENT'}</Text></View> : null}
          </View>
          <View style={styles.moneyGrid}>
            <Money label="Estimate" value={financials.estimate_amount} />
            <Money label="Approved" value={financials.approved_amount} />
            <Money label="Final bill" value={financials.bill_amount} />
            <Money label="DO amount" value={financials.do_amount} />
            <Money label="Customer paid" value={financials.customer_paid_amount} />
            <Money label="Payment received" value={financials.payment_received_amount} />
          </View>
          {financials.further_deduction_amount != null && financials.further_deduction_amount > 0 ? (
            <View style={styles.deductionRow}>
              <Text style={styles.deductionLabel}>Further deduction</Text>
              <Text style={styles.deductionValue}>{money(financials.further_deduction_amount)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionHeaderStandalone}>
        <Text style={styles.sectionEyebrow}>CLAIM JOURNEY</Text>
        <Text style={styles.sectionTitle}>9-stage tracker</Text>
        <Text style={styles.sectionHint}>Completed stages can be reopened to review or correct the information you entered.</Text>
      </View>

      <View style={styles.timelineCard}>
        {SELF_MANAGED_MILESTONES.map((definition, index) => {
          const milestone = map.get(definition.key);
          const status = milestone?.milestone_status ?? 'not_started';
          const done = status === 'completed' || status === 'not_applicable';
          const active = next?.key === definition.key;
          const canOpen = definition.key !== 'spot_intimation' && (done || active);
          return (
            <View key={definition.key} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, done && styles.timelineDotDone, active && styles.timelineDotActive]}>
                  {done ? <MaterialCommunityIcons name="check" size={14} color="#FFF" /> : <Text style={[styles.timelineNumber, active && styles.timelineNumberActive]}>{index + 1}</Text>}
                </View>
                {index < SELF_MANAGED_MILESTONES.length - 1 ? <View style={[styles.timelineLine, done && styles.timelineLineDone]} /> : null}
              </View>
              <Pressable disabled={!canOpen} onPress={() => openMilestone(definition.key)} style={[styles.milestoneCard, active && styles.milestoneCardActive, done && styles.milestoneCardDone]}>
                <View style={styles.milestoneTop}>
                  <View style={styles.flexOne}>
                    <Text style={[styles.milestoneTitle, active && styles.milestoneTitleActive]}>{definition.label}</Text>
                    <Text style={styles.milestoneHint}>{done ? `Recorded ${fmtDate(milestone?.completed_at)}` : active ? 'Action required from you' : 'Upcoming'}</Text>
                  </View>
                  <View style={[styles.statusPill, done && styles.statusPillDone, active && styles.statusPillActive]}>
                    <Text style={[styles.statusText, done && styles.statusTextDone, active && styles.statusTextActive]}>{done ? 'DONE' : active ? 'CURRENT' : 'UPCOMING'}</Text>
                  </View>
                </View>
                {canOpen ? (
                  <View style={styles.milestoneFooter}>
                    <Text style={styles.milestoneFooterText}>{done ? 'Review / edit' : 'Update stage'}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={17} color="#0A43A3" />
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>

      {recentActivity.length ? (
        <View style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>RECENT ACTIVITY</Text>
              <Text style={styles.sectionTitle}>Claim updates</Text>
            </View>
            <MaterialCommunityIcons name="history" size={20} color="#0A43A3" />
          </View>
          {recentActivity.map((item, index) => {
            const definition = SELF_MANAGED_MILESTONES.find((entry) => entry.key === item.milestone_key);
            return (
              <View key={item.id} style={[styles.activityRow, index === recentActivity.length - 1 && styles.activityRowLast]}>
                <View style={styles.activityDot}><MaterialCommunityIcons name="check" size={12} color="#FFFFFF" /></View>
                <View style={styles.flexOne}>
                  <Text style={styles.activityTitle}>{definition?.label ?? 'Claim milestone'} updated</Text>
                  <Text style={styles.activityMeta}>{fmtDateTime(item.completed_at)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <Pressable style={styles.quickActionCard} onPress={() => router.push({ pathname: '/customer/self-managed-documents', params: { id: claim.id } })}>
        <View style={styles.quickActionIcon}><MaterialCommunityIcons name="folder-multiple-image" size={22} color="#0A43A3" /></View>
        <View style={styles.flexOne}>
          <Text style={styles.quickActionTitle}>Claim Document Vault</Text>
          <Text style={styles.quickActionText}>View and upload supporting files for each stage.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={21} color="#0A43A3" />
      </Pressable>

      <View style={[styles.assistanceCard, assistanceRequested && styles.assistancePending, assistanceDeclined && styles.assistanceDeclined]}>
        <View style={styles.assistanceIcon}>
          <MaterialCommunityIcons name={assistanceRequested ? 'clock-outline' : assistanceDeclined ? 'information-outline' : 'account-tie-voice-outline'} size={22} color={assistanceRequested ? '#8A5B00' : assistanceDeclined ? '#A33B32' : '#0A43A3'} />
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.assistanceTitle}>{assistanceRequested ? 'Sankalp review pending' : assistanceDeclined ? 'Previous request declined' : 'Need help with this claim?'}</Text>
          <Text style={styles.assistanceText}>{assistanceRequested ? `Requested ${claim.assistance_requested_at ? fmtDate(claim.assistance_requested_at) : 'recently'}. The claim remains self-tracked until Sankalp accepts it.` : assistanceDeclined ? 'Continue tracking the claim yourself, or request assistance again if circumstances have changed.' : 'Ask Sankalp to review this external claim. Responsibility transfers only after Sankalp accepts the request.'}</Text>
          {!assistanceRequested ? (
            <Pressable style={styles.assistanceButton} onPress={() => router.push({ pathname: '/customer/request-claim-assistance', params: { id: claim.id } })}>
              <Text style={styles.assistanceButtonText}>{assistanceDeclined ? 'REQUEST AGAIN' : 'REQUEST ASSISTANCE'}</Text>
              <MaterialCommunityIcons name="arrow-right" size={15} color="#FFF" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoItem}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={2}>{value}</Text></View>;
}
function Money({ label, value }: { label: string; value: number | null }) {
  return <View style={styles.moneyItem}><Text style={styles.moneyLabel}>{label}</Text><Text style={styles.moneyValue}>{value == null ? '—' : money(value)}</Text></View>;
}
function money(value: number) { return `₹${Number(value).toLocaleString('en-IN')}`; }
function fmtDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }
function fmtDateTime(value?: string | null) { return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: -12, marginBottom: 12 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  overline: { color: '#0A43A3', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  claimNo: { color: palette.navy, fontSize: 23, fontWeight: '900', marginTop: 1 },
  headerSub: { color: '#667085', fontSize: 11, fontWeight: '700', marginTop: 3 },
  externalBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#CDDDF8' },
  externalBadgeText: { color: '#0A43A3', fontSize: 8, fontWeight: '900' },
  serviceCard: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: '#F5F8FD', borderWidth: 1, borderColor: '#DCE6F3', marginBottom: 12 },
  serviceCardPending: { backgroundColor: '#FFF9EA', borderColor: '#F1DC9C' },
  serviceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F1FF' },
  serviceIconPending: { backgroundColor: '#FFF0C5' },
  serviceTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  serviceSubtitle: { color: '#667085', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  pendingPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#FFE7A3' },
  pendingPillText: { color: '#8A5B00', fontSize: 8, fontWeight: '900' },
  heroCard: { borderRadius: 22, backgroundColor: '#082A66', padding: 16, marginBottom: 12 },
  heroTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroEyebrow: { color: '#AFC6E9', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  heroValue: { color: '#FFF', fontSize: 21, fontWeight: '900', marginTop: 2 },
  heroMeta: { color: '#BFD0E8', fontSize: 10, fontWeight: '700', marginTop: 3 },
  progressRing: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#174A93', borderWidth: 4, borderColor: '#F3C83A', alignItems: 'center', justifyContent: 'center' },
  progressRingText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  progressTrack: { height: 6, borderRadius: 99, backgroundColor: '#244A7D', overflow: 'hidden', marginTop: 13 },
  progressFill: { height: '100%', backgroundColor: '#F3C83A' },
  currentStageCard: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 16, backgroundColor: '#123D7E', marginTop: 13, padding: 12 },
  currentStageIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24569C' },
  currentStageLabel: { color: '#AFC6E9', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  currentStageTitle: { color: '#FFF', fontSize: 13, fontWeight: '900', marginTop: 1 },
  currentStageHint: { color: '#C9D8EE', fontSize: 9.5, lineHeight: 13, fontWeight: '600', marginTop: 2 },
  currentStageAction: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFF' },
  currentStageActionText: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900' },
  infoCard: { borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E8F0', padding: 12, marginBottom: 12 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoItem: { width: '50%', paddingVertical: 6, paddingRight: 8 },
  infoLabel: { color: '#8A95A5', fontSize: 8.5, fontWeight: '800' },
  infoValue: { color: palette.navy, fontSize: 10.5, fontWeight: '900', marginTop: 2 },
  sectionCard: { borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E8F0', padding: 13, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderStandalone: { marginBottom: 8 },
  sectionEyebrow: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  sectionTitle: { color: palette.navy, fontSize: 15.5, fontWeight: '900', marginTop: 1 },
  sectionHint: { color: '#667085', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  cashlessPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#EAF7F1' },
  cashlessPillText: { color: '#147A57', fontSize: 7.5, fontWeight: '900' },
  moneyGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 9 },
  moneyItem: { width: '33.33%', paddingVertical: 7, paddingRight: 6 },
  moneyLabel: { color: '#7A8799', fontSize: 8, fontWeight: '800' },
  moneyValue: { color: palette.navy, fontSize: 11, fontWeight: '900', marginTop: 2 },
  deductionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEF1F5', marginTop: 7, paddingTop: 10 },
  deductionLabel: { color: '#9A3F36', fontSize: 10, fontWeight: '800' },
  deductionValue: { color: '#9A3F36', fontSize: 12, fontWeight: '900' },
  timelineCard: { borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E8F0', padding: 12, marginBottom: 12 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineRail: { width: 34, alignItems: 'center' },
  timelineDot: { width: 27, height: 27, borderRadius: 14, borderWidth: 2, borderColor: '#CDD5DF', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  timelineDotDone: { backgroundColor: '#14845C', borderColor: '#14845C' },
  timelineDotActive: { backgroundColor: '#EAF2FF', borderColor: '#0A43A3' },
  timelineNumber: { color: '#98A2B3', fontSize: 9, fontWeight: '900' },
  timelineNumberActive: { color: '#0A43A3' },
  timelineLine: { flex: 1, width: 2, minHeight: 38, backgroundColor: '#E7EBF0' },
  timelineLineDone: { backgroundColor: '#9BD8BF' },
  milestoneCard: { flex: 1, marginBottom: 9, padding: 11, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF1F5' },
  milestoneCardActive: { backgroundColor: '#F2F7FF', borderColor: '#BBD2F3' },
  milestoneCardDone: { backgroundColor: '#FBFDFC' },
  milestoneTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  milestoneTitle: { color: '#344054', fontSize: 12, fontWeight: '900' },
  milestoneTitleActive: { color: '#0A43A3' },
  milestoneHint: { color: '#7A8799', fontSize: 9.5, fontWeight: '600', marginTop: 3 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 99, backgroundColor: '#EEF1F5' },
  statusPillDone: { backgroundColor: '#E5F5ED' },
  statusPillActive: { backgroundColor: '#DCEAFF' },
  statusText: { color: '#7B8794', fontSize: 7.5, fontWeight: '900' },
  statusTextDone: { color: '#147A57' },
  statusTextActive: { color: '#0A43A3' },
  milestoneFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#E7ECF2', marginTop: 9, paddingTop: 8 },
  milestoneFooterText: { color: '#0A43A3', fontSize: 9, fontWeight: '900' },
  activityCard: { borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E8F0', padding: 13, marginBottom: 12 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  activityRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
  activityDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#14845C', alignItems: 'center', justifyContent: 'center' },
  activityTitle: { color: palette.navy, fontSize: 10.5, fontWeight: '900' },
  activityMeta: { color: '#7A8799', fontSize: 8.8, fontWeight: '600', marginTop: 2 },
  quickActionCard: { flexDirection: 'row', gap: 11, alignItems: 'center', padding: 13, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DCE7F4', marginBottom: 12 },
  quickActionIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  quickActionTitle: { color: palette.navy, fontSize: 12, fontWeight: '900' },
  quickActionText: { color: '#667085', fontSize: 9.5, fontWeight: '600', marginTop: 2 },
  assistanceCard: { flexDirection: 'row', gap: 10, padding: 13, borderRadius: 18, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#C9DAF2', marginBottom: 24 },
  assistancePending: { backgroundColor: '#FFF9EA', borderColor: '#F1DC9C' },
  assistanceDeclined: { backgroundColor: '#FFF5F4', borderColor: '#EBC5C0' },
  assistanceIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  assistanceTitle: { color: palette.navy, fontSize: 12, fontWeight: '900' },
  assistanceText: { color: '#667085', fontSize: 9.8, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  assistanceButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0A43A3', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, marginTop: 9 },
  assistanceButtonText: { color: '#FFF', fontSize: 8.5, fontWeight: '900' },
});