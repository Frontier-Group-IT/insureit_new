import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LoadingState, Message, Screen } from '@/components/ui';
import { SELF_MANAGED_CLAIM_NOTICE, SELF_MANAGED_MILESTONES, type ClaimMilestone, type ClaimMilestoneKey } from '@/lib/claim-service-mode';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

type ClaimSummary = {
  id: string;
  claim_no: string;
  claim_service_mode: string;
  policy_service_source: string | null;
  assistance_status: string;
  customer_id: string;
  vehicle_id: string;
  policy_id: string;
  insurance_company_id: string | null;
  accident_at: string | null;
};

type VehicleSummary = { id: string; vehicle_no: string; make: string | null; model: string | null };
type PolicySummary = { id: string; policy_no: string; end_date: string };
type InsurerSummary = { id: string; name: string };

export default function SelfManagedClaimDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [claim, setClaim] = useState<ClaimSummary | null>(null);
  const [vehicle, setVehicle] = useState<VehicleSummary | null>(null);
  const [policy, setPolicy] = useState<PolicySummary | null>(null);
  const [insurer, setInsurer] = useState<InsurerSummary | null>(null);
  const [milestones, setMilestones] = useState<ClaimMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Claim reference is missing.');
      setLoading(false);
      return;
    }
    let active = true;
    async function load() {
      const { data: claimData, error: claimError } = await supabase
        .from('claims')
        .select('id, claim_no, claim_service_mode, policy_service_source, assistance_status, customer_id, vehicle_id, policy_id, insurance_company_id, accident_at')
        .eq('id', id)
        .maybeSingle();
      if (!active) return;
      if (claimError || !claimData) {
        setError('We could not load this claim.');
        setLoading(false);
        return;
      }
      if (claimData.claim_service_mode !== 'self_managed') {
        router.replace({ pathname: '/customer/claim-detail', params: { id: claimData.id } });
        return;
      }
      setClaim(claimData as ClaimSummary);
      const [vehicleResult, policyResult, insurerResult, milestoneResult] = await Promise.all([
        supabase.from('vehicles').select('id, vehicle_no, make, model').eq('id', claimData.vehicle_id).maybeSingle(),
        supabase.from('policies').select('id, policy_no, end_date').eq('id', claimData.policy_id).maybeSingle(),
        claimData.insurance_company_id
          ? supabase.from('insurance_companies').select('id, name').eq('id', claimData.insurance_company_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('claim_milestones').select('*').eq('claim_id', claimData.id).order('created_at', { ascending: true }),
      ]);
      if (!active) return;
      setVehicle((vehicleResult.data as VehicleSummary | null) ?? null);
      setPolicy((policyResult.data as PolicySummary | null) ?? null);
      setInsurer((insurerResult.data as InsurerSummary | null) ?? null);
      setMilestones((milestoneResult.data ?? []) as ClaimMilestone[]);
      if (milestoneResult.error) console.warn('Self-managed milestones load failed', milestoneResult.error);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id, router]);

  const milestoneMap = useMemo(() => new Map(milestones.map((item) => [item.milestone_key, item])), [milestones]);
  const completedCount = useMemo(() => SELF_MANAGED_MILESTONES.filter((item) => milestoneMap.get(item.key)?.milestone_status === 'completed').length, [milestoneMap]);
  const nextMilestone = useMemo(() => SELF_MANAGED_MILESTONES.find((item) => {
    const status = milestoneMap.get(item.key)?.milestone_status;
    return status !== 'completed' && status !== 'not_applicable';
  }) ?? null, [milestoneMap]);

  if (loading) return <Screen title="Claim Tracker" showTitleHeader={false}><LoadingState label="Opening claim tracker" /></Screen>;
  if (error || !claim) return <Screen title="Claim Tracker" showTitleHeader={false}><Message type="error">{error || 'Claim not found.'}</Message></Screen>;

  return (
    <Screen title="Claim Tracker" showTitleHeader={false}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} /></Pressable>
        <View style={styles.topCopy}><Text style={styles.eyebrow}>SELF-MANAGED CLAIM</Text><Text style={styles.title}>{claim.claim_no}</Text><Text style={styles.subtitle}>{vehicle?.vehicle_no ?? 'Vehicle'} • {insurer?.name ?? 'External insurer'}</Text></View>
        <View style={styles.externalBadge}><Text style={styles.externalBadgeText}>EXTERNAL</Text></View>
      </View>

      <View style={styles.noticeBox}><MaterialCommunityIcons name="account-edit-outline" size={21} color="#8A5B00" /><Text style={styles.noticeText}>{SELF_MANAGED_CLAIM_NOTICE}</Text></View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}><View><Text style={styles.summaryLabel}>Journey progress</Text><Text style={styles.summaryValue}>{completedCount} of {SELF_MANAGED_MILESTONES.length} milestones</Text></View><View style={styles.progressBadge}><Text style={styles.progressBadgeText}>{Math.round((completedCount / SELF_MANAGED_MILESTONES.length) * 100)}%</Text></View></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(completedCount / SELF_MANAGED_MILESTONES.length) * 100}%` }]} /></View>
        <View style={styles.metaGrid}><Meta label="Vehicle" value={vehicle?.vehicle_no ?? '-'} /><Meta label="Policy" value={policy?.policy_no ?? '-'} /><Meta label="Insurer" value={insurer?.name ?? '-'} /><Meta label="Accident" value={formatDateTime(claim.accident_at)} /></View>
      </View>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Claim Journey</Text><Text style={styles.sectionHint}>You control these tracking milestones</Text></View>

      <View style={styles.timelineCard}>
        {SELF_MANAGED_MILESTONES.map((definition, index) => {
          const milestone = milestoneMap.get(definition.key);
          const status = milestone?.milestone_status ?? 'not_started';
          const completed = status === 'completed';
          const notApplicable = status === 'not_applicable';
          const active = nextMilestone?.key === definition.key;
          return (
            <View key={definition.key} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, completed && styles.timelineDotDone, active && styles.timelineDotActive, notApplicable && styles.timelineDotMuted]}>
                  {completed ? <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" /> : <Text style={[styles.timelineNumber, active && styles.timelineNumberActive]}>{index + 1}</Text>}
                </View>
                {index < SELF_MANAGED_MILESTONES.length - 1 ? <View style={[styles.timelineLine, completed && styles.timelineLineDone]} /> : null}
              </View>
              <View style={[styles.milestoneCard, active && styles.milestoneCardActive]}>
                <View style={styles.milestoneTop}><Text style={[styles.milestoneTitle, active && styles.milestoneTitleActive]}>{definition.label}</Text><StatusPill status={status} /></View>
                {completed ? <Text style={styles.milestoneDate}>Recorded {formatDate(milestone?.completed_at)}</Text> : active ? <Text style={styles.milestoneHint}>This is the next milestone to update.</Text> : <Text style={styles.milestoneHint}>Waiting for previous milestone.</Text>}
                {active && definition.key === 'spot_status' ? (
                  <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/customer/self-managed-spot-status', params: { id: claim.id } })} style={styles.continueButton}>
                    <Text style={styles.continueText}>Update Spot Status</Text><MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {nextMilestone && nextMilestone.key !== 'spot_status' ? <View style={styles.phaseNote}><MaterialCommunityIcons name="progress-wrench" size={19} color="#0A43A3" /><Text style={styles.phaseNoteText}>The next milestone form will be added in the next implementation batch. Your completed tracking data is already saved.</Text></View> : null}

      <View style={styles.vaultCard}><View style={styles.vaultIcon}><MaterialCommunityIcons name="folder-multiple-image" size={24} color="#0A43A3" /></View><View style={styles.vaultCopy}><Text style={styles.vaultTitle}>Claim Document Vault</Text><Text style={styles.vaultText}>RC, insurance, licence, GR and stage documents will be organized here as the document phase is enabled.</Text></View></View>
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) { return <View style={styles.metaItem}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue} numberOfLines={2}>{value}</Text></View>; }
function StatusPill({ status }: { status: string }) {
  const done = status === 'completed'; const na = status === 'not_applicable';
  return <View style={[styles.statusPill, done && styles.statusPillDone, na && styles.statusPillMuted]}><Text style={[styles.statusPillText, done && styles.statusPillTextDone]}>{done ? 'Done' : na ? 'N/A' : 'Pending'}</Text></View>;
}
function formatDate(value?: string | null) { if (!value) return '-'; return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatDateTime(value?: string | null) { if (!value) return '-'; return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: -12, marginBottom: 13 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  topCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: palette.navy, fontSize: 22, fontWeight: '900', marginTop: 1 },
  subtitle: { color: '#667085', fontSize: 11, marginTop: 3, fontWeight: '700' },
  externalBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#C4D9F7' },
  externalBadgeText: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  noticeBox: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderRadius: 16, padding: 12, backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F2D99F', marginBottom: 12 },
  noticeText: { flex: 1, color: '#77520B', fontSize: 10.5, lineHeight: 16, fontWeight: '700' },
  summaryCard: { borderRadius: 20, backgroundColor: '#082A66', padding: 15, marginBottom: 16 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { color: '#BFD3F2', fontSize: 10, fontWeight: '800' },
  summaryValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 2 },
  progressBadge: { minWidth: 43, height: 32, borderRadius: 11, backgroundColor: '#174A93', alignItems: 'center', justifyContent: 'center' },
  progressBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  progressTrack: { height: 6, borderRadius: 99, backgroundColor: '#244A7D', overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#F3C83A' },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 13, borderTopWidth: 1, borderTopColor: '#244A7D', paddingTop: 11 },
  metaItem: { width: '50%', paddingRight: 8, paddingVertical: 4 },
  metaLabel: { color: '#9DB6D8', fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaValue: { color: '#FFFFFF', fontSize: 10.5, lineHeight: 14, fontWeight: '800', marginTop: 2 },
  sectionHeader: { marginBottom: 9 },
  sectionTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' },
  sectionHint: { color: '#667085', fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  timelineCard: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE7F2', padding: 13, marginBottom: 12 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineRail: { width: 34, alignItems: 'center' },
  timelineDot: { width: 27, height: 27, borderRadius: 14, borderWidth: 2, borderColor: '#C8D1DC', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  timelineDotDone: { backgroundColor: '#14845C', borderColor: '#14845C' },
  timelineDotActive: { borderColor: '#0A43A3', backgroundColor: '#EAF2FF' },
  timelineDotMuted: { backgroundColor: '#E9EDF2', borderColor: '#D0D5DD' },
  timelineNumber: { color: '#98A2B3', fontSize: 9, fontWeight: '900' },
  timelineNumberActive: { color: '#0A43A3' },
  timelineLine: { flex: 1, width: 2, minHeight: 34, backgroundColor: '#E4E9F0', marginVertical: -1 },
  timelineLineDone: { backgroundColor: '#8FD5BA' },
  milestoneCard: { flex: 1, marginBottom: 9, padding: 10, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF1F5' },
  milestoneCardActive: { backgroundColor: '#F4F8FF', borderColor: '#BFD5F4' },
  milestoneTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  milestoneTitle: { flex: 1, color: '#344054', fontSize: 12, fontWeight: '900' },
  milestoneTitleActive: { color: '#0A43A3' },
  milestoneDate: { color: '#667085', fontSize: 9.5, marginTop: 4, fontWeight: '600' },
  milestoneHint: { color: '#7A8798', fontSize: 9.5, lineHeight: 14, marginTop: 4, fontWeight: '600' },
  statusPill: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: '#EEF1F5' },
  statusPillDone: { backgroundColor: '#E5F7EF' },
  statusPillMuted: { backgroundColor: '#F2F4F7' },
  statusPillText: { color: '#667085', fontSize: 8, fontWeight: '900' },
  statusPillTextDone: { color: '#087443' },
  continueButton: { marginTop: 9, minHeight: 36, borderRadius: 11, backgroundColor: '#0A43A3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  continueText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  phaseNote: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 12, borderRadius: 15, backgroundColor: '#EEF5FF', marginBottom: 12 },
  phaseNoteText: { flex: 1, color: '#435C7B', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  vaultCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', padding: 13, marginBottom: 10 },
  vaultIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  vaultCopy: { flex: 1 },
  vaultTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  vaultText: { color: '#667085', fontSize: 9.5, lineHeight: 14, marginTop: 2, fontWeight: '600' },
});
