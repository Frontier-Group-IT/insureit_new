import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { getPartnerClaimDetail, type PartnerClaimDetail } from '@/lib/claims';
import { partnerTheme } from '@/lib/theme';

type TimelineItem = { key: string; title: string; date: string; kind: 'created' | 'status' | 'stage' };

export default function ClaimDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PartnerClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerClaimDetail(id));
    } catch {
      setError('This claim could not be loaded in your Partner scope.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!data) return [];
    const items: TimelineItem[] = [{ key: 'created', title: 'Claim recorded', date: data.claim.created_at, kind: 'created' }];
    for (const item of data.status_history) items.push({ key: `status-${item.id}`, title: humanize(item.to_status || 'Status updated'), date: item.created_at, kind: 'status' });
    for (const item of data.stages) items.push({ key: `stage-${item.id}`, title: humanize(item.stage), date: item.created_at, kind: 'stage' });
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  const latestStage = data?.stages.length ? data.stages[data.stages.length - 1]?.stage : null;

  return (
    <PartnerScreen
      eyebrow="CLAIM"
      title={data?.claim.claim_no || 'Claim'}
      action={<PartnerIconButton icon="close" label="Close claim detail" onPress={() => router.back()} />}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading claim journey" />
      ) : error || !data ? (
        <PartnerStateView
          state="error"
          title="Claim unavailable"
          message={error || 'This claim could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroStatusBlock}>
                <Text style={styles.heroEyebrow}>CURRENT STATUS</Text>
                <Text style={styles.heroStatus}>{humanize(data.claim.current_status || 'Status not recorded')}</Text>
              </View>
              <PartnerStatusBadge
                label={latestStage ? humanize(latestStage) : 'Claim active'}
                tone={claimTone(data.claim.current_status)}
              />
            </View>
            <Text style={styles.heroMeta}>{data.customer.name}{data.vehicle.vehicle_no ? ` · ${data.vehicle.vehicle_no}` : ''}</Text>
            <View style={styles.heroFooter}>
              <Text style={styles.heroFooterText}>{data.insurer.name || 'Insurer not recorded'}</Text>
              <Text style={styles.heroFooterText}>{humanize(data.claim.claim_service_mode || 'service mode not recorded')}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => router.push(`/customer/${data.customer.id}` as never)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Ionicons name="person-outline" size={18} color={partnerTheme.colors.brand} />
              <Text style={styles.actionText}>Customer</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/claims')} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Ionicons name="shield-outline" size={18} color={partnerTheme.colors.brand} />
              <Text style={styles.actionText}>Claim book</Text>
            </Pressable>
          </View>

          <PartnerSectionHeader title="What is happening" />
          <View style={styles.guidanceCard}>
            <GuidanceRow
              icon="pulse-outline"
              title="Current position"
              text={humanize(data.claim.current_status || latestStage || 'Status not recorded')}
            />
            <GuidanceRow
              icon="person-circle-outline"
              title="What needs you"
              text={partnerActionText(data)}
            />
            <GuidanceRow
              icon="arrow-forward-circle-outline"
              title="What happens next"
              text="New claim updates will appear below."
              last
            />
          </View>

          <PartnerSectionHeader title="Claim overview" />
          <View style={styles.infoCard}>
            <Info label="Insurer claim no." value={data.claim.insurer_claim_no || 'Not recorded'} />
            <Info label="Policy" value={data.policy.policy_no || 'External policy'} />
            <Info label="Accident date" value={formatDateTime(data.claim.accident_at)} />
            <Info label="Location" value={data.claim.accident_location || 'Not recorded'} />
            <Info label="Assistance" value={humanize(data.claim.assistance_status || 'not requested')} />
            <Info label="Last updated" value={formatDateTime(data.claim.updated_at)} />
          </View>

          <PartnerSectionHeader title="Financial snapshot" />
          <View style={styles.amountRow}>
            <Amount label="Estimated loss" value={data.claim.estimated_loss} />
            <Amount label="Approved" value={data.claim.approved_amount} />
            <Amount label="Settlement" value={data.claim.settlement_amount} />
          </View>

          <PartnerSectionHeader title="Journey" meta={`${timeline.length} recorded events`} />
          {timeline.length ? (
            <View style={styles.timeline}>
              {timeline.map((item, index) => (
                <View key={item.key} style={styles.timelineRow}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, index === timeline.length - 1 && styles.dotLatest]}>
                      {item.kind === 'stage' ? <View style={styles.innerDot} /> : null}
                    </View>
                    {index < timeline.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineDate}>{formatDateTime(item.date)}</Text>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    <Text style={styles.timelineKind}>{item.kind === 'status' ? 'Status update' : item.kind === 'stage' ? 'Claim stage' : 'Claim created'}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <PartnerStateView state="empty" title="No journey events yet" message="Recorded claim stages and status updates will appear here." />
          )}

        </>
      )}
    </PartnerScreen>
  );
}

function GuidanceRow({ icon, title, text, last = false }: { icon: 'pulse-outline' | 'person-circle-outline' | 'arrow-forward-circle-outline'; title: string; text: string; last?: boolean }) {
  return (
    <View style={[styles.guidanceRow, !last && styles.guidanceDivider]}>
      <View style={styles.guidanceIcon}><Ionicons name={icon} size={19} color={partnerTheme.colors.brand} /></View>
      <View style={styles.guidanceBody}>
        <Text style={styles.guidanceTitle}>{title}</Text>
        <Text style={styles.guidanceText}>{text}</Text>
      </View>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function Amount({ label, value }: { label: string; value: number | string | null }) {
  return <View style={styles.amount}><Text style={styles.amountValue}>{value == null ? '—' : formatMoney(value)}</Text><Text style={styles.amountLabel}>{label}</Text></View>;
}

function partnerActionText(data: PartnerClaimDetail) {
  const assistance = (data.claim.assistance_status || '').toLowerCase();
  if (assistance.includes('request') || assistance.includes('pending') || assistance.includes('open')) {
    return `Assistance is recorded as ${humanize(data.claim.assistance_status || 'open')}. Check the latest journey update or contact Support if clarification is needed.`;
  }
  return 'No specific Partner action is recorded in the available claim data right now.';
}

function claimTone(value: string | null): 'success' | 'warning' | 'info' {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('complete') || normalized.includes('settled') || normalized.includes('closed')) return 'success';
  if (normalized.includes('pending') || normalized.includes('attention')) return 'warning';
  return 'info';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: number | string) {
  const n = Number(value);
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
}

const styles = StyleSheet.create({
  hero: { borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.nav },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroStatusBlock: { flex: 1 },
  heroEyebrow: { color: '#AAA5FF', letterSpacing: 1.1, ...partnerTheme.typography.meta },
  heroStatus: { marginTop: 4, color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '900' },
  heroMeta: { marginTop: 5, color: '#C4CCD8', ...partnerTheme.typography.caption },
  heroFooter: { marginTop: 10, paddingTop: 9, flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3B4658' },
  heroFooterText: { flex: 1, color: '#8F9BAD', ...partnerTheme.typography.meta },
  actions: { marginTop: 8, flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: partnerTheme.control.minTouchTarget, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  actionText: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  guidanceCard: { overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  guidanceRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11 },
  guidanceDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  guidanceIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  guidanceBody: { flex: 1 },
  guidanceTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  guidanceText: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  infoCard: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 9, borderRadius: 17, padding: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  info: { width: '50%', paddingRight: 8 },
  infoLabel: { color: '#8A94A6', textTransform: 'uppercase', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  infoValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  amountRow: { flexDirection: 'row', borderRadius: 17, paddingVertical: 11, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  amount: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  amountValue: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  amountLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
  timeline: { paddingLeft: 2 },
  timelineRow: { minHeight: 62, flexDirection: 'row' },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 12, height: 12, marginTop: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#BFC5D1', borderWidth: 2, borderColor: partnerTheme.colors.canvas },
  dotLatest: { backgroundColor: partnerTheme.colors.brand },
  innerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  line: { width: 1, flex: 1, marginTop: 3, backgroundColor: partnerTheme.colors.line },
  timelineBody: { flex: 1, paddingBottom: 10 },
  timelineDate: { color: partnerTheme.colors.brand, ...partnerTheme.typography.meta },
  timelineTitle: { marginTop: 4, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  timelineKind: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  pressed: { opacity: 0.78 },
});
