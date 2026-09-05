import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { getPartnerClaimDetail, type PartnerClaimDetail } from '@/lib/claims';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

type TimelineItem = { key: string; title: string; date: string; kind: 'created' | 'status' | 'stage' };

export default function ClaimDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PartnerClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllJourney, setShowAllJourney] = useState(false);

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
  const visibleTimeline = showAllJourney ? timeline : timeline.slice(-5);

  return (
    <PartnerScreen eyebrow="SERVICE" title="Claim" onBack={() => router.back()}>
      {loading ? (
        <PartnerStateView state="loading" title="Loading claim journey" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Claim unavailable" message={error || 'This claim could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroArtworkWrap}><Image source={claimHeroArtwork(data.claim.current_status)} style={styles.heroArtwork} resizeMode="contain" /></View>
              <View style={styles.heroStatusBlock}><Text style={styles.heroEyebrow}>CURRENT STATUS</Text><Text style={styles.heroStatus}>{humanize(data.claim.current_status || 'Status not recorded')}</Text></View>
              <PartnerStatusBadge label={latestStage ? humanize(latestStage) : 'Claim active'} tone={claimTone(data.claim.current_status)} />
            </View>
            <Text style={styles.heroMeta}>{[data.claim.claim_no, data.customer.name, data.vehicle.vehicle_no].filter(Boolean).join(' · ')}</Text>
            <View style={styles.heroFooter}><Text style={styles.heroFooterText}>{data.insurer.name || 'Insurer not recorded'}</Text><Text style={styles.heroFooterText}>{humanize(data.claim.claim_service_mode || 'service mode not recorded')}</Text></View>
          </View>

          {needsPartnerAttention(data) ? <View style={styles.attention}><PartnerBanner tone="warning" title="Partner attention" message={partnerActionText(data)} /></View> : null}

          <Pressable accessibilityRole="button" accessibilityLabel={`Open customer ${data.customer.name}`} onPress={() => router.push(`/customer/${data.customer.id}` as never)} style={({ pressed }) => [styles.customerLink, pressed && styles.pressed]}>
            <View style={styles.customerArtworkWrap}><Image source={PartnerAssets.navigation.customers} style={styles.customerArtwork} resizeMode="contain" /></View>
            <View style={styles.customerBody}><Text style={styles.customerName}>{data.customer.name}</Text><Text style={styles.customerMeta}>{data.vehicle.vehicle_no || data.policy.policy_no || 'Customer record'}</Text></View>
            <Ionicons name="chevron-forward" size={16} color="#9AA3B2" />
          </Pressable>

          <PartnerSectionHeader title="Claim overview" />
          <View style={styles.infoCard}><Info label="Insurer claim no." value={data.claim.insurer_claim_no || 'Not recorded'} /><Info label="Policy" value={data.policy.policy_no || 'External policy'} /><Info label="Accident date" value={formatDateTime(data.claim.accident_at)} /><Info label="Location" value={data.claim.accident_location || 'Not recorded'} /><Info label="Assistance" value={humanize(data.claim.assistance_status || 'not requested')} /><Info label="Last updated" value={formatDateTime(data.claim.updated_at)} /></View>

          <PartnerSectionHeader title="Financial snapshot" />
          <View style={styles.amountRow}><Amount label="Estimated loss" value={data.claim.estimated_loss} /><Amount label="Approved" value={data.claim.approved_amount} /><Amount label="Settlement" value={data.claim.settlement_amount} /></View>

          <PartnerSectionHeader title="Journey" meta={`${timeline.length} recorded events`} />
          {timeline.length ? (
            <View style={styles.timeline}>
              {visibleTimeline.map((item, index) => (
                <View key={item.key} style={styles.timelineRow}>
                  <View style={styles.rail}>
                    <View style={styles.timelineArtworkWrap}><Image source={timelineArtwork(item)} style={[styles.timelineArtwork, index === visibleTimeline.length - 1 && styles.timelineArtworkLatest]} resizeMode="contain" /></View>
                    {index < visibleTimeline.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.timelineBody}><Text style={styles.timelineDate}>{formatDateTime(item.date)}</Text><Text style={styles.timelineTitle}>{item.title}</Text><Text style={styles.timelineKind}>{item.kind === 'status' ? 'Status update' : item.kind === 'stage' ? 'Claim stage' : 'Claim created'}</Text></View>
                </View>
              ))}
            </View>
          ) : (
            <PartnerStateView state="empty" asset={PartnerAssets.status.journey} title="No journey events yet" message="Recorded claim stages and status updates will appear here." />
          )}
          {timeline.length > 5 ? (
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAllJourney }} accessibilityLabel={showAllJourney ? 'Show recent claim journey' : `Show full claim journey with ${timeline.length} events`} onPress={() => setShowAllJourney((value) => !value)} style={({ pressed }) => [styles.journeyToggle, pressed && styles.pressed]}>
              <Text style={styles.journeyToggleText}>{showAllJourney ? 'Show recent' : `Show full journey · ${timeline.length}`}</Text><Ionicons name={showAllJourney ? 'chevron-up' : 'chevron-down'} size={15} color={partnerTheme.colors.brand} />
            </Pressable>
          ) : null}
        </>
      )}
    </PartnerScreen>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function Amount({ label, value }: { label: string; value: number | string | null }) { return <View style={styles.amount}><Text style={styles.amountValue}>{value == null ? '—' : formatIndianCurrency(value)}</Text><Text style={styles.amountLabel}>{label}</Text></View>; }
function timelineArtwork(item: TimelineItem): ImageSourcePropType { return item.kind === 'created' ? PartnerAssets.navigation.claims : PartnerAssets.status.journey; }
function claimHeroArtwork(value: string | null): ImageSourcePropType { const normalized = (value || '').toLowerCase(); if (normalized.includes('complete') || normalized.includes('settled') || normalized.includes('closed')) return PartnerAssets.status.verified; if (normalized.includes('pending') || normalized.includes('attention')) return PartnerAssets.status.claimAttention; return PartnerAssets.navigation.claims; }
function needsPartnerAttention(data: PartnerClaimDetail) { const assistance = (data.claim.assistance_status || '').toLowerCase().replaceAll('_', ' ').trim(); if (!assistance || assistance === 'not requested' || assistance === 'none' || assistance === 'closed') return false; return assistance.includes('requested') || assistance.includes('pending') || assistance.includes('open'); }
function partnerActionText(data: PartnerClaimDetail) { return `Assistance is ${humanize(data.claim.assistance_status || 'open')}. Check the latest journey update or contact Support if clarification is needed.`; }
function claimTone(value: string | null): 'success' | 'warning' | 'info' { const normalized = (value || '').toLowerCase(); if (normalized.includes('complete') || normalized.includes('settled') || normalized.includes('closed')) return 'success'; if (normalized.includes('pending') || normalized.includes('attention')) return 'warning'; return 'info'; }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string | null) { if (!value) return 'Not recorded'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d); }

const styles = StyleSheet.create({
  hero: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line }, heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, heroArtworkWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, heroArtwork: { width: 42, height: 42 }, heroStatusBlock: { flex: 1 }, heroEyebrow: { color: partnerTheme.colors.brand, letterSpacing: 1.1, ...partnerTheme.typography.meta }, heroStatus: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '700' }, heroMeta: { marginTop: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption }, heroFooter: { marginTop: 8, paddingTop: 7, flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line }, heroFooterText: { flex: 1, color: partnerTheme.colors.inkSubtle, ...partnerTheme.typography.meta }, attention: { marginTop: 8 }, customerLink: { minHeight: partnerTheme.control.minTouchTarget, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 9, backgroundColor: partnerTheme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line }, customerArtworkWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, customerArtwork: { width: 36, height: 36 }, customerBody: { flex: 1 }, customerName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong }, customerMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta }, journeyToggle: { minHeight: partnerTheme.control.minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, journeyToggleText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.caption }, infoCard: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 9, paddingVertical: 8, backgroundColor: partnerTheme.colors.surface }, info: { width: '50%', paddingRight: 8 }, infoLabel: { color: '#8A94A6', textTransform: 'uppercase', letterSpacing: 0.5, ...partnerTheme.typography.meta }, infoValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption }, amountRow: { flexDirection: 'row', paddingVertical: 10, backgroundColor: partnerTheme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line }, amount: { flex: 1, alignItems: 'center', paddingHorizontal: 4 }, amountValue: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong }, amountLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta }, timeline: { paddingLeft: 2 }, timelineRow: { minHeight: 66, flexDirection: 'row' }, rail: { width: 42, alignItems: 'center' }, timelineArtworkWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, timelineArtwork: { width: 30, height: 30 }, timelineArtworkLatest: { width: 34, height: 34 }, line: { width: 1, flex: 1, marginTop: 2, backgroundColor: partnerTheme.colors.line }, timelineBody: { flex: 1, paddingBottom: 10 }, timelineDate: { color: partnerTheme.colors.brand, ...partnerTheme.typography.meta }, timelineTitle: { marginTop: 4, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong }, timelineKind: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta }, pressed: { backgroundColor: partnerTheme.colors.pressed },
});
