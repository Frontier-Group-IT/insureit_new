import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerClaimDetail, type PartnerClaimDetail } from '@/lib/claims';
import { formatIndianCurrency } from '@/lib/format';

type TimelineItem = { key: string; title: string; date: string; kind: 'created' | 'status' | 'stage' };

type OverviewIcon = 'document-text-outline' | 'reader-outline' | 'calendar-outline' | 'location-outline' | 'headset-outline' | 'time-outline';

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
    for (const item of data.status_history) {
      items.push({ key: `status-${item.id}`, title: humanize(item.to_status || 'Status updated'), date: item.created_at, kind: 'status' });
    }
    for (const item of data.stages) {
      items.push({ key: `stage-${item.id}`, title: humanize(item.stage), date: item.created_at, kind: 'stage' });
    }
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerOrbLarge} />
        <View style={styles.headerOrbSmall} />
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerIcon}><Ionicons name="document-text" size={18} color="#FFFFFF" /></View>
        <View style={styles.headerCopy}><Text style={styles.headerEyebrow}>SERVICE</Text><Text style={styles.headerTitle}>Claim Details</Text></View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.stateWrap}><PartnerStateView state="loading" title="Loading claim journey" /></View>
        ) : error || !data ? (
          <View style={styles.stateWrap}><PartnerStateView state="error" title="Claim unavailable" message={error || 'This claim could not be loaded.'} actionLabel="Try again" onAction={() => void load()} /></View>
        ) : (
          <>
            <View style={[styles.card, styles.statusCard]}>
              <View style={styles.statusTopRow}>
                <View style={styles.statusIconWrap}><Ionicons name="shield-checkmark" size={25} color="#3156B8" /></View>
                <View style={styles.statusCopy}><Text style={styles.microLabel}>CURRENT STATUS</Text><Text style={styles.statusTitle}>{humanize(data.claim.current_status || 'Status not recorded')}</Text></View>
                <View style={styles.activeChip}><Text style={styles.activeChipText}>{claimActivityLabel(data.claim.current_status)}</Text></View>
              </View>
              <Text style={styles.statusMeta}>{[data.claim.claim_no, data.customer.name, data.vehicle.vehicle_no].filter(Boolean).join(' · ')}</Text>
              <View style={styles.statusFooter}>
                <Text numberOfLines={1} style={styles.statusFooterText}>{data.insurer.name || 'Insurer not recorded'}</Text>
                <View style={styles.footerDivider} />
                <Text numberOfLines={1} style={styles.statusFooterText}>{humanize(data.claim.claim_service_mode || 'service mode not recorded')}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionTitleRow}><View style={styles.sectionTitleIcon}><Ionicons name="people" size={15} color="#2574E8" /></View><Text style={styles.sectionTitle}>Insured Person</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open customer ${data.customer.name}`} onPress={() => router.push(`/customer/${data.customer.id}` as never)} style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}>
                <View style={styles.personAvatar}><Ionicons name="people" size={25} color="#2F75E8" /></View>
                <View style={styles.personCopy}><Text style={styles.personName}>{data.customer.name}</Text><Text style={styles.personMeta}>{data.vehicle.vehicle_no || data.policy.policy_no || 'Customer record'}</Text></View>
                <Ionicons name="chevron-forward" size={18} color="#7C8CA5" />
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleIcon}><Ionicons name="clipboard" size={15} color="#2574E8" /></View><Text style={styles.sectionTitle}>Claim Overview</Text><View style={styles.sectionSpacer} /><Text style={styles.viewAll}>View All</Text><Ionicons name="chevron-forward" size={13} color="#5538ED" />
              </View>
              <View style={styles.overviewGrid}>
                <OverviewTile icon="document-text-outline" label="Insurer Claim No." value={data.claim.insurer_claim_no || 'Not recorded'} />
                <OverviewTile icon="reader-outline" label="Policy" value={data.policy.policy_no || 'External policy'} />
                <OverviewTile icon="calendar-outline" label="Accident Date" value={formatDateTime(data.claim.accident_at)} />
                <OverviewTile icon="location-outline" label="Location" value={data.claim.accident_location || 'Not recorded'} />
                <OverviewTile icon="headset-outline" label="Assistance" value={humanize(data.claim.assistance_status || 'not requested')} />
                <OverviewTile icon="time-outline" label="Last Updated" value={formatDateTime(data.claim.updated_at)} />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionTitleRow}><View style={styles.sectionTitleIcon}><Ionicons name="bar-chart" size={15} color="#2574E8" /></View><Text style={styles.sectionTitle}>Financial Snapshot</Text></View>
              <View style={styles.amountRow}><Amount label="Estimated Loss" value={data.claim.estimated_loss} /><Amount label="Approved" value={data.claim.approved_amount} highlighted /><Amount label="Settled" value={data.claim.settlement_amount} /></View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionTitleRow}><View style={styles.sectionTitleIcon}><Ionicons name="stopwatch" size={15} color="#2574E8" /></View><View><Text style={styles.sectionTitle}>Journey</Text><Text style={styles.sectionMeta}>{timeline.length} recorded events</Text></View></View>
              {timeline.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.journeyScroll}>
                  {timeline.map((item, index) => (
                    <View key={item.key} style={styles.journeyStep}>
                      <View style={styles.journeyRailRow}><View style={[styles.journeyDot, index === timeline.length - 1 && styles.journeyDotLatest]} />{index < timeline.length - 1 ? <View style={styles.journeyConnector} /> : null}</View>
                      <View style={styles.journeyEventCard}>
                        <View style={[styles.journeyIconWrap, index === timeline.length - 1 && styles.journeyIconLatest]}><Ionicons name={item.kind === 'created' ? 'document-text' : item.kind === 'stage' ? 'hand-left' : 'shield-checkmark'} size={18} color={index === timeline.length - 1 ? '#5E3CF4' : '#2574E8'} /></View>
                        <Text style={styles.journeyDate}>{formatDateTime(item.date)}</Text><Text style={styles.journeyTitle}>{item.title}</Text><Text style={styles.journeyKind}>{item.kind === 'status' ? 'Status update' : item.kind === 'stage' ? 'Claim stage' : 'Claim created'}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : <Text style={styles.emptyJourney}>Recorded claim stages and status updates will appear here.</Text>}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <NavItem icon="home-outline" label="Home" onPress={() => router.push('/(tabs)' as never)} />
        <NavItem icon="briefcase-outline" label="Business" onPress={() => router.push('/(tabs)/business' as never)} />
        <NavItem icon="document-text-outline" label="Policies" onPress={() => router.push('/(tabs)/policies' as never)} />
        <NavItem icon="shield-checkmark" label="Claims" active onPress={() => router.push('/(tabs)/claims' as never)} />
        <NavItem icon="grid-outline" label="More" onPress={() => router.push('/(tabs)/more' as never)} />
      </View>
    </SafeAreaView>
  );
}

function OverviewTile({ icon, label, value }: { icon: OverviewIcon; label: string; value: string }) {
  return <View style={styles.overviewTile}><View style={styles.overviewIcon}><Ionicons name={icon} size={16} color="#2574E8" /></View><View style={styles.overviewCopy}><Text style={styles.overviewLabel}>{label}</Text><Text style={styles.overviewValue}>{value}</Text></View></View>;
}

function Amount({ label, value, highlighted = false }: { label: string; value: number | string | null; highlighted?: boolean }) {
  return <View style={[styles.amount, highlighted && styles.amountHighlighted]}><Text style={styles.amountValue}>{value == null ? '—' : formatIndianCurrency(value)}</Text><Text style={styles.amountLabel}>{label}</Text></View>;
}

function NavItem({ icon, label, active = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><View style={[styles.navIconWrap, active && styles.navIconWrapActive]}><Ionicons name={icon} size={19} color={active ? '#633DF1' : '#6C7D97'} /></View><Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text></Pressable>;
}

function claimActivityLabel(value: string | null) {
  const normalized = (value || '').toLowerCase();
  return normalized.includes('closed') || normalized.includes('settled') || normalized.includes('complete') ? 'Claim Closed' : 'Claim Active';
}

function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string | null) { if (!value) return 'Not recorded'; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: 'numeric', minute: '2-digit' }).format(date); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FB' }, header: { height: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#0860C8' }, headerOrbLarge: { position: 'absolute', right: -40, top: -45, width: 150, height: 120, borderRadius: 80, backgroundColor: '#0C74DF', opacity: 0.9 }, headerOrbSmall: { position: 'absolute', right: 48, top: -18, width: 70, height: 70, borderRadius: 35, backgroundColor: '#0A68D3', opacity: 0.75 }, backButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 5 }, headerIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: 'rgba(255,255,255,0.18)' }, headerCopy: { flex: 1 }, headerEyebrow: { color: '#CFE5FF', fontSize: 7, lineHeight: 9, letterSpacing: 1.05, fontWeight: '800' }, headerTitle: { marginTop: 1, color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: '800' }, scroll: { flex: 1 }, content: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 12, gap: 8 }, stateWrap: { paddingTop: 24 }, card: { borderRadius: 12, padding: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E4E9F2' }, statusCard: { paddingTop: 9, paddingBottom: 8 }, statusTopRow: { flexDirection: 'row', alignItems: 'center' }, statusIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: '#F1F4FF' }, statusCopy: { flex: 1, minWidth: 0 }, microLabel: { color: '#6546EA', fontSize: 6.5, lineHeight: 9, letterSpacing: 0.55, fontWeight: '800' }, statusTitle: { marginTop: 1, color: '#1A2B45', fontSize: 14, lineHeight: 18, fontWeight: '800' }, activeChip: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#EEF6FF' }, activeChipText: { color: '#3677BE', fontSize: 6.5, lineHeight: 9, fontWeight: '700' }, statusMeta: { marginTop: 4, marginLeft: 48, color: '#7A879A', fontSize: 7, lineHeight: 10 }, statusFooter: { marginTop: 7, paddingTop: 6, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDF0F5' }, statusFooterText: { flex: 1, color: '#687A94', fontSize: 7, lineHeight: 10 }, footerDivider: { width: StyleSheet.hairlineWidth, height: 12, marginHorizontal: 10, backgroundColor: '#DDE3EC' }, sectionTitleRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center' }, sectionTitleIcon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: '#EDF6FF' }, sectionTitle: { color: '#1D2C45', fontSize: 10, lineHeight: 13, fontWeight: '800' }, sectionMeta: { marginTop: 1, color: '#8A97A9', fontSize: 6.5, lineHeight: 9 }, sectionSpacer: { flex: 1 }, viewAll: { color: '#5538ED', fontSize: 7.5, lineHeight: 10, fontWeight: '700' }, personRow: { minHeight: 48, marginTop: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }, personAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: '#EDF5FF' }, personCopy: { flex: 1 }, personName: { color: '#20324D', fontSize: 9, lineHeight: 12, fontWeight: '800' }, personMeta: { marginTop: 2, color: '#7A8799', fontSize: 7, lineHeight: 10 }, overviewGrid: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, overviewTile: { width: '49%', minHeight: 48, paddingHorizontal: 7, paddingVertical: 7, borderRadius: 9, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FAFBFD', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E7EBF2' }, overviewIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: '#EEF6FF' }, overviewCopy: { flex: 1, minWidth: 0 }, overviewLabel: { color: '#8A96A8', fontSize: 6.3, lineHeight: 8.5 }, overviewValue: { marginTop: 2, color: '#26364F', fontSize: 7.5, lineHeight: 10.5, fontWeight: '700' }, amountRow: { marginTop: 7, flexDirection: 'row', overflow: 'hidden', borderRadius: 9, backgroundColor: '#F5F7FF' }, amount: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#DDE4EF' }, amountHighlighted: { backgroundColor: '#F3FBF7' }, amountValue: { color: '#24324B', fontSize: 9, lineHeight: 12, fontWeight: '800' }, amountLabel: { marginTop: 3, color: '#7B8798', fontSize: 6.5, lineHeight: 9, textAlign: 'center' }, journeyScroll: { paddingTop: 8, paddingBottom: 2, paddingRight: 8 }, journeyStep: { width: 158, marginRight: 4 }, journeyRailRow: { height: 14, flexDirection: 'row', alignItems: 'center' }, journeyDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 17, backgroundColor: '#3D79E6' }, journeyDotLatest: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#6541F4' }, journeyConnector: { flex: 1, height: 1, marginLeft: 4, backgroundColor: '#D4DEEE' }, journeyEventCard: { width: 148, minHeight: 88, padding: 9, borderRadius: 10, backgroundColor: '#FBFCFE', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E6EAF1' }, journeyIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 5, backgroundColor: '#EEF6FF' }, journeyIconLatest: { backgroundColor: '#F2EEFF' }, journeyDate: { color: '#5575C7', fontSize: 6.5, lineHeight: 9, fontWeight: '600' }, journeyTitle: { marginTop: 2, color: '#25344E', fontSize: 8.5, lineHeight: 11, fontWeight: '800' }, journeyKind: { marginTop: 2, color: '#8B96A8', fontSize: 6.5, lineHeight: 9 }, emptyJourney: { marginTop: 8, color: '#7C8A9F', fontSize: 8, lineHeight: 12 }, bottomNav: { height: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DDE3EC', backgroundColor: '#FFFFFF' }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, navIconWrap: { minWidth: 34, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navIconWrapActive: { backgroundColor: '#EEE9FF' }, navLabel: { marginTop: 1, color: '#6C7D97', fontSize: 6.5, lineHeight: 9, fontWeight: '600' }, navLabelActive: { color: '#633DF1', fontWeight: '800' }, pressed: { opacity: 0.7 },
});
