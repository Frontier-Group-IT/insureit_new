import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { PartnerAssets } from '@/lib/partner-assets';
import { listPartnerPolicyIntakes, type PartnerPolicyIntake } from '@/lib/policy-intakes';
import { partnerTheme } from '@/lib/theme';

type IntakeFilter = 'action_required' | 'in_review' | 'processing' | 'completed' | 'duplicate' | 'rejected' | 'all';

const FILTERS: Array<{ key: IntakeFilter; label: string }> = [
  { key: 'action_required', label: 'Action Required' },
  { key: 'in_review', label: 'In Review' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
  { key: 'duplicate', label: 'Duplicate' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export default function PolicyIntakesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<PartnerPolicyIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<IntakeFilter>('action_required');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await listPartnerPolicyIntakes();
      setRows(result.intakes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy Intakes could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const counts = useMemo<Record<IntakeFilter, number>>(() => ({
    action_required: rows.filter((row) => row.status === 'needs_attention' || (row.status === 'processing' && row.ocr_status === 'failed')).length,
    in_review: rows.filter((row) => ['ready_for_review', 'in_review'].includes(row.status)).length,
    processing: rows.filter((row) => row.status === 'processing' && row.ocr_status !== 'failed').length,
    completed: rows.filter((row) => row.status === 'completed').length,
    duplicate: rows.filter((row) => row.status === 'duplicate').length,
    rejected: rows.filter((row) => row.status === 'rejected').length,
    all: rows.length,
  }), [rows]);

  const visibleRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!search) return true;
      const haystack = [row.intake_number, row.customer_mobile, row.lead_source_name, row.lead_source_code, row.status, ...row.ocr_fields.flatMap((item) => [item.label, item.value])].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [filter, query, rows]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerOrbLarge} /><View style={styles.headerOrbSmall} />
        <View style={styles.titleIcon}><Ionicons name="document-text" size={21} color="#FFFFFF" /></View>
        <View style={styles.titleCopy}><Text style={styles.eyebrow}>POLICY INTAKE</Text><Text style={styles.title}>My Submissions</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Create new policy intake" onPress={() => router.push('/policy-intake-new')} style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}><Ionicons name="add" size={17} color="#FFFFFF" /><Text style={styles.newButtonText}>New</Text></Pressable>
      </View>
      <View style={styles.searchBand}>
        <View style={styles.searchBox}><Ionicons name="search-outline" size={17} color="#8A98AC" /><TextInput value={query} onChangeText={setQuery} placeholder="Search by PIR number, customer, insurer or source" placeholderTextColor="#9AA5B5" style={styles.searchInput} autoCapitalize="none" returnKeyType="search" />{query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={17} color="#A3ADBB" /></Pressable> : null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh submissions" onPress={() => void load(true)} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}><Ionicons name="refresh" size={20} color="#17365D" /></Pressable>
      </View>
      <View style={styles.filtersWrap}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>{FILTERS.map((item) => { const active = filter === item.key; return <Pressable key={item.key} onPress={() => setFilter(item.key)} style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}><Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{item.label}</Text><Text style={[styles.filterCount, active && styles.filterCountActive]}>{counts[item.key]}</Text></Pressable>; })}</ScrollView></View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={partnerTheme.colors.brand} colors={[partnerTheme.colors.brand]} />}>
        {loading && !rows.length ? <PartnerStateView state="loading" title="Loading Policy Intakes" /> : error && !rows.length ? <PartnerStateView state="error" title="Policy Intakes unavailable" message={error} actionLabel="Try again" onAction={() => void load(true)} /> : visibleRows.length ? <>{error ? <Text style={styles.inlineError}>{error}</Text> : null}{visibleRows.map((row) => <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`Open Policy Intake ${row.intake_number}. ${statusLabel(row)}`} onPress={() => router.push({ pathname: '/policy-intakes/[id]', params: { id: row.id } })} style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}><View style={styles.rowTop}><View style={styles.rowArtwork}><Image source={intakeArtwork(row)} style={styles.rowArtworkImage} resizeMode="contain" /></View><View style={styles.identity}><Text style={styles.number}>{row.intake_number}</Text><Text numberOfLines={1} style={styles.customer}>{row.customer_mobile} · {row.lead_source_name}</Text><Text numberOfLines={1} style={styles.metaLine}>{field(row, 'policy_number') || 'Policy pending'} · {field(row, 'vehicle_registration_number') || 'Vehicle pending'}</Text></View><PartnerStatusBadge label={statusLabel(row)} tone={statusTone(row)} /></View><IntakeProgress row={row} />{row.attention_reason ? <View style={styles.attention}><Ionicons name="alert-circle-outline" size={16} color="#B66B0B" /><Text numberOfLines={2} style={styles.attentionText}>{row.attention_reason}</Text></View> : null}<View style={styles.rowFooter}><Text style={styles.date}>Updated {formatDate(row.updated_at || row.created_at)}</Text><Ionicons name="chevron-forward" size={17} color="#1E3C66" /></View></Pressable>)}</> : <PartnerStateView state="empty" asset={rows.length ? PartnerAssets.emptyStates.noSearchResults : PartnerAssets.emptyStates.policyUpload} title={rows.length ? 'No submissions in this filter' : 'No Policy Intakes yet'} message={rows.length ? 'Try another filter or search term.' : 'Create an intake when you have a policy copy that Operations needs to onboard.'} actionLabel={rows.length ? undefined : 'Create first intake'} onAction={rows.length ? undefined : () => router.push('/policy-intake-new')} />}
      </ScrollView>
      <View style={styles.bottomNav}><NavItem icon="home-outline" label="Home" onPress={() => router.push('/(tabs)' as never)} /><NavItem icon="briefcase-outline" label="Business" onPress={() => router.push('/(tabs)/business' as never)} /><NavItem icon="document-text" label="Policies" active onPress={() => router.push('/(tabs)/policies' as never)} /><NavItem icon="shield-checkmark-outline" label="Claims" onPress={() => router.push('/(tabs)/claims' as never)} /><NavItem icon="grid-outline" label="More" onPress={() => router.push('/(tabs)/more' as never)} /></View>
    </SafeAreaView>
  );
}

function matchesFilter(row: PartnerPolicyIntake, filter: IntakeFilter) { if (filter === 'all') return true; if (filter === 'action_required') return row.status === 'needs_attention' || (row.status === 'processing' && row.ocr_status === 'failed'); if (filter === 'in_review') return ['ready_for_review', 'in_review'].includes(row.status); if (filter === 'processing') return row.status === 'processing' && row.ocr_status !== 'failed'; return row.status === filter; }
function intakeArtwork(row: PartnerPolicyIntake) { if (row.status === 'completed') return PartnerAssets.status.verified; if (row.status === 'rejected') return PartnerAssets.status.rejected; if (row.status === 'needs_attention') return PartnerAssets.status.policyAttention; if (['ready_for_review', 'in_review'].includes(row.status)) return PartnerAssets.status.pendingReview; return PartnerAssets.status.documentUpload; }
function IntakeProgress({ row }: { row: PartnerPolicyIntake }) { const manual = row.status === 'processing' && row.ocr_status === 'failed'; const activeStep = row.status === 'completed' ? 4 : row.status === 'in_review' ? 3 : row.status === 'ready_for_review' || row.status === 'needs_attention' || manual ? 2 : 1; const rejected = row.status === 'rejected' || row.status === 'duplicate'; return <View style={styles.progressWrap}>{['Uploaded', 'RTO', 'Review', 'Done'].map((label, index) => { const step = index + 1; const complete = !rejected && step <= activeStep; return <View key={label} style={styles.progressStep}><View style={styles.progressLineWrap}><View style={[styles.progressDot, complete && styles.progressDotComplete, rejected && step === activeStep && styles.progressDotRejected]}>{complete && step < activeStep ? <Ionicons name="checkmark" size={9} color="#FFFFFF" /> : null}</View>{index < 3 ? <View style={[styles.progressLine, step < activeStep && !rejected && styles.progressLineComplete]} /> : null}</View><Text style={[styles.progressLabel, complete && styles.progressLabelActive]}>{label}</Text></View>; })}</View>; }
function NavItem({ icon, label, active = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><View style={[styles.navIconWrap, active && styles.navIconWrapActive]}><Ionicons name={icon} size={19} color={active ? '#633DF1' : '#60738F'} /></View><Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text></Pressable>; }
function field(row: PartnerPolicyIntake, key: string) { return row.ocr_fields?.find((item) => item.key === key)?.value?.trim() || ''; }
function statusLabel(row: PartnerPolicyIntake) { if (row.status === 'processing' && row.ocr_status === 'failed') return 'Action Required'; return ({ processing: 'Processing', ready_for_review: 'Ready', in_review: 'In review', needs_attention: 'Action Required', completed: 'Completed', duplicate: 'Duplicate', rejected: 'Rejected' } as Record<string, string>)[row.status] || humanize(row.status); }
function statusTone(row: PartnerPolicyIntake): 'success' | 'warning' | 'danger' | 'info' { if (row.status === 'completed') return 'success'; if (row.status === 'rejected' || row.status === 'duplicate') return 'danger'; if (row.status === 'needs_attention' || (row.status === 'processing' && row.ocr_status === 'failed')) return 'warning'; return 'info'; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date); }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FB' }, header: { height: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#0860C8' }, headerOrbLarge: { position: 'absolute', right: -38, top: -52, width: 170, height: 130, borderRadius: 90, backgroundColor: '#0D74E3', opacity: 0.9 }, headerOrbSmall: { position: 'absolute', right: 95, top: -25, width: 85, height: 85, borderRadius: 45, backgroundColor: '#096BD7', opacity: 0.8 }, titleIcon: { width: 31, height: 31, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: 'rgba(255,255,255,0.16)' }, titleCopy: { flex: 1 }, eyebrow: { color: '#D5E9FF', fontSize: 7.5, lineHeight: 9, letterSpacing: 0.85, fontWeight: '800' }, title: { marginTop: 1, color: '#FFFFFF', fontSize: 14, lineHeight: 17, fontWeight: '800' }, newButton: { minWidth: 65, height: 34, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#5A35D6' }, newButtonText: { color: '#FFFFFF', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  searchBand: { paddingHorizontal: 11, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', gap: 7, backgroundColor: '#0860C8' }, searchBox: { flex: 1, minHeight: 38, borderRadius: 9, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF' }, searchInput: { flex: 1, paddingVertical: 0, color: '#1F314C', fontSize: 10.5, lineHeight: 14 }, refreshButton: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  filtersWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE4EF', backgroundColor: '#FFFFFF' }, filtersContent: { paddingHorizontal: 10, paddingVertical: 7, gap: 7 }, filterChip: { minHeight: 31, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F7F8FB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E0E5ED' }, filterChipActive: { backgroundColor: '#183864', borderColor: '#183864' }, filterLabel: { color: '#4D5D75', fontSize: 9.2, lineHeight: 12, fontWeight: '700' }, filterLabelActive: { color: '#FFFFFF' }, filterCount: { color: '#728099', fontSize: 8.5, lineHeight: 11, fontWeight: '700' }, filterCountActive: { color: '#DDEAFF' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 9, paddingTop: 9, paddingBottom: 12, gap: 8 }, inlineError: { marginBottom: 5, color: partnerTheme.colors.danger, textAlign: 'center', fontSize: 10 }, card: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E1E7F0', shadowColor: '#0B2447', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, pressedCard: { opacity: 0.75 }, rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, rowArtwork: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F7FC' }, rowArtworkImage: { width: 31, height: 31 }, identity: { flex: 1, minWidth: 0 }, number: { color: '#1D2C45', fontSize: 11, lineHeight: 14, fontWeight: '800' }, customer: { marginTop: 2, color: '#687A92', fontSize: 8.5, lineHeight: 11 }, metaLine: { marginTop: 4, color: '#8290A3', fontSize: 8, lineHeight: 10.5 },
  progressWrap: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start' }, progressStep: { flex: 1, alignItems: 'center' }, progressLineWrap: { width: '100%', minHeight: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, progressDot: { width: 10, height: 10, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE2EC' }, progressDotComplete: { backgroundColor: '#6541F4' }, progressDotRejected: { backgroundColor: '#EA625C' }, progressLine: { position: 'absolute', left: '57%', width: '86%', height: 1.5, backgroundColor: '#DCE2EC' }, progressLineComplete: { backgroundColor: '#6541F4' }, progressLabel: { marginTop: 3, color: '#7D899B', fontSize: 7.5, lineHeight: 10, fontWeight: '500' }, progressLabelActive: { color: '#23344E', fontWeight: '600' }, attention: { marginTop: 8, minHeight: 28, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF3DF' }, attentionText: { flex: 1, color: '#9B5C10', fontSize: 8.5, lineHeight: 11, fontWeight: '700' }, rowFooter: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, date: { color: '#6F7D91', fontSize: 8, lineHeight: 10.5 },
  bottomNav: { height: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DDE3EC', backgroundColor: '#FFFFFF' }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, navIconWrap: { minWidth: 36, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navIconWrapActive: { backgroundColor: '#EEE9FF' }, navLabel: { marginTop: 1, color: '#60738F', fontSize: 7.5, lineHeight: 10, fontWeight: '600' }, navLabelActive: { color: '#633DF1', fontWeight: '800' }, pressed: { opacity: 0.7 },
});