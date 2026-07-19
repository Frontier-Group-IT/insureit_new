import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useLoadingRouter } from '@/components/app-loading';
import { GroupPageShell } from '@/components/group/group-page-shell';
import { EmptyState, LoadingState } from '@/components/ui';
import { customerAccountTitle, getAccessibleCustomerContexts, getSelectedCustomerContext, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

const fleetSketch = require('../../assets/vehicles/truck sketch.jpeg');

type Mode = 'fleet' | 'policies' | 'claims';
type RecordRow = { id: string; customerId: string; accountName: string; title: string; subtitle: string; meta: string; status: string; tone: 'blue' | 'green' | 'orange' | 'red' };

export function GroupRecordsScreen({ mode }: { mode: Mode }) {
  const router = useLoadingRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [query, setQuery] = useState('');
  const [accountId, setAccountId] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { let active = true; setLoading(true); void (async () => {
    try {
      const selectedGroup = await getSelectedCustomerContext();
      if (!selectedGroup || selectedGroup.partner_type !== 'group') { if (active) setRows([]); return; }
      const associated = (await getAccessibleCustomerContexts()).filter((item) => item.customer_id !== selectedGroup.customer_id && item.group_customer_id === selectedGroup.customer_id);
      const portfolioContexts = [selectedGroup, ...associated];
      const ids = Array.from(new Set(portfolioContexts.map((item) => item.customer_id)));
      if (!active) return;
      setContexts(portfolioContexts);
      const requestedAccountId = typeof params.accountId === 'string' ? params.accountId : '';
      if (requestedAccountId && portfolioContexts.some((context) => context.customer_id === requestedAccountId)) setAccountId(requestedAccountId);
      if (!ids.length) { setRows([]); return; }
      const accountNames = new Map(portfolioContexts.map((item) => [item.customer_id, customerAccountTitle(item)]));
      if (mode === 'fleet') {
        const [{ data: vehicles }, { data: policies }, { data: claims }] = await Promise.all([
          supabase.from('vehicles').select('*').in('customer_id', ids).order('created_at', { ascending: false }),
          supabase.from('policies').select('*').in('customer_id', ids),
          supabase.from('claims').select('*').in('customer_id', ids),
        ]);
        const next = ((vehicles ?? []) as Vehicle[]).map((vehicle) => {
          const policy = ((policies ?? []) as Policy[]).filter((item) => item.vehicle_id === vehicle.id).sort((a,b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
          const openClaims = ((claims ?? []) as Claim[]).filter((item) => item.vehicle_id === vehicle.id && !['Closed','Settled','Rejected','Claim Complete'].includes(item.current_status)).length;
          const expired = policy ? new Date(policy.end_date).getTime() < Date.now() : true;
          return { id: vehicle.id, customerId: vehicle.customer_id, accountName: accountNames.get(vehicle.customer_id) ?? 'Associated Account', title: vehicle.vehicle_no, subtitle: [vehicle.make, vehicle.model || vehicle.vehicle_type].filter(Boolean).join(' · ') || 'Commercial Vehicle', meta: policy ? `Policy expires ${formatDate(policy.end_date)} · ${openClaims} open claim${openClaims === 1 ? '' : 's'}` : 'Policy information unavailable', status: policy ? expired ? 'Expired' : 'Insured' : 'Uninsured', tone: expired ? 'red' : 'green' } as RecordRow;
        });
        if (active) setRows(next);
      } else if (mode === 'policies') {
        const [{ data }, { data: vehicles }, { data: companies }] = await Promise.all([
          supabase.from('policies').select('*').in('customer_id', ids).order('end_date', { ascending: true }),
          supabase.from('vehicles').select('*').in('customer_id', ids),
          supabase.from('insurance_companies').select('*'),
        ]);
        const vehicleNumbers = new Map(((vehicles ?? []) as Vehicle[]).map((vehicle) => [vehicle.id, vehicle.vehicle_no]));
        const companyNames = new Map(((companies ?? []) as InsuranceCompany[]).map((company) => [company.id, company.name]));
        const next = ((data ?? []) as Policy[]).map((policy) => { const days = Math.ceil((new Date(policy.end_date).getTime() - Date.now()) / 86400000); const vehicleNo = vehicleNumbers.get(policy.vehicle_id) ?? 'Vehicle unavailable'; const insurer = companyNames.get(policy.insurance_company_id) ?? 'Insurer pending'; return { id: policy.id, customerId: policy.customer_id, accountName: accountNames.get(policy.customer_id) ?? 'Associated Account', title: vehicleNo, subtitle: insurer, meta: `${policy.policy_no} - ${policy.policy_type || 'Insurance Policy'} - Valid until ${formatDate(policy.end_date)}`, status: days < 0 ? 'Expired' : days <= 30 ? 'Renewal Due' : 'Active', tone: days < 0 ? 'red' : days <= 30 ? 'orange' : 'green' } as RecordRow; });
        if (active) setRows(next);
      } else {
        const { data } = await supabase.from('claims').select('*').in('customer_id', ids).order('created_at', { ascending: false });
        const next = ((data ?? []) as Claim[]).map((claim) => ({ id: claim.id, customerId: claim.customer_id, accountName: accountNames.get(claim.customer_id) ?? 'Associated Account', title: claim.claim_no, subtitle: claim.current_status, meta: claim.accident_at ? `Incident ${formatDate(claim.accident_at)}` : 'Incident date not available', status: ['Closed','Settled','Claim Complete'].includes(claim.current_status) ? 'Completed' : /pending|awaited|document/i.test(claim.current_status) ? 'Action Required' : 'Open', tone: ['Closed','Settled','Claim Complete'].includes(claim.current_status) ? 'green' : /pending|awaited|document/i.test(claim.current_status) ? 'orange' : 'blue' } as RecordRow));
        if (active) setRows(next);
      }
    } finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; }, [mode, params.accountId]);

  const filtered = useMemo(() => rows.filter((row) => (accountId === 'all' || row.customerId === accountId) && (!query.trim() || `${row.title} ${row.subtitle} ${row.meta} ${row.accountName}`.toLowerCase().includes(query.trim().toLowerCase()))), [accountId, query, rows]);
  const title = mode === 'fleet' ? 'Group Fleet' : mode === 'policies' ? 'Group Policies' : 'Group Claims';
  const summary = mode === 'fleet' ? `${rows.length} vehicles across ${contexts.length} accounts` : mode === 'policies' ? `${rows.length} policies across the Group portfolio` : `${rows.length} claims across the Group portfolio`;
  const icon = mode === 'fleet' ? 'truck-outline' : mode === 'policies' ? 'file-document-outline' : 'shield-check-outline';
  const action = mode === 'fleet' ? { label: 'Add Vehicle', icon: 'truck-plus-outline' as const, href: '/customer/add-vehicle' as const } : mode === 'policies' ? { label: 'Add Policy', icon: 'shield-plus-outline' as const, href: '/customer/add-policy' as const } : { label: 'Add Claim', icon: 'file-plus-outline' as const, href: '/customer/report-accident' as const };

  return <GroupPageShell title={title} subtitle={summary} icon={icon} loading={loading} rightAction={<Pressable accessibilityRole="button" onPress={() => router.push(action.href)} style={styles.headerAction}><MaterialCommunityIcons name={action.icon} size={16} color={palette.navy} /><Text style={styles.headerActionText}>{action.label}</Text></Pressable>}>
    {loading ? <LoadingState /> : <>
      <View style={styles.searchBox}><MaterialCommunityIcons name="magnify" size={20} color="#7A8799" /><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${mode === 'fleet' ? 'vehicle or customer' : mode === 'policies' ? 'policy or customer' : 'claim, vehicle or customer'}`} placeholderTextColor="#9AA6B6" style={styles.searchInput} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountFilters}><Pressable onPress={() => setAccountId('all')} style={[styles.filterChip, accountId === 'all' && styles.filterChipActive]}><Text style={[styles.filterText, accountId === 'all' && styles.filterTextActive]}>All Accounts</Text></Pressable>{contexts.map((context) => <Pressable key={context.customer_id} onPress={() => setAccountId(context.customer_id)} style={[styles.filterChip, accountId === context.customer_id && styles.filterChipActive]}><Text numberOfLines={1} style={[styles.filterText, accountId === context.customer_id && styles.filterTextActive]}>{customerAccountTitle(context)}</Text></Pressable>)}</ScrollView>
      {!filtered.length ? <EmptyState title={`No ${mode}`} body={`No matching ${mode} records were found for this Group portfolio.`} /> : filtered.map((row) => <Pressable key={row.id} onPress={() => openRecord(router, mode, row.id)} style={({ pressed }) => [styles.recordCard, pressed && styles.recordCardPressed]}>
        <View style={[styles.accent, { backgroundColor: tone(row.tone).accent }]} />
        {mode === 'fleet' ? <Image source={fleetSketch} resizeMode="cover" style={styles.fleetCardImage} /> : null}
        {mode === 'fleet' ? <View style={styles.fleetImageFade} /> : null}
        <View style={[styles.recordIcon, { backgroundColor: tone(row.tone).soft }]}><MaterialCommunityIcons name={mode === 'fleet' ? 'truck-outline' : mode === 'policies' ? 'file-document-outline' : 'shield-check-outline'} size={23} color={tone(row.tone).accent} /></View>
        <View style={styles.recordCopy}><Text style={styles.accountName} numberOfLines={1}>{row.accountName}</Text><Text style={styles.recordTitle} numberOfLines={1}>{row.title}</Text><Text style={styles.recordSubtitle} numberOfLines={1}>{row.subtitle}</Text><Text style={styles.recordMeta} numberOfLines={2}>{row.meta}</Text></View>
        <View style={[styles.statusPill, { backgroundColor: tone(row.tone).soft }]}><Text style={[styles.statusText, { color: tone(row.tone).accent }]}>{row.status}</Text></View>
      </Pressable>)}
    </>}
  </GroupPageShell>;
}

function openRecord(router: ReturnType<typeof useLoadingRouter>, mode: Mode, id: string) {
  if (mode === 'claims') return router.push({ pathname: '/customer/claim-detail', params: { id } });
  if (mode === 'fleet') return router.push({ pathname: '/customer/vehicle-detail', params: { id } });
  return router.push({ pathname: '/customer/policy-detail', params: { id } } as any);
}

function tone(value: RecordRow['tone']) { if (value === 'green') return { accent: '#12805C', soft: '#E8F8F0' }; if (value === 'orange') return { accent: '#B7791F', soft: '#FFF4E2' }; if (value === 'red') return { accent: '#C43838', soft: '#FDECEC' }; return { accent: '#0B63CE', soft: '#EEF5FF' }; }
function formatDate(value?: string | null) { if (!value) return '—'; return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const styles = StyleSheet.create({
  headerAction: { minHeight: 36, maxWidth: 112, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  headerActionText: { color: palette.navy, fontSize: 9.5, fontWeight: '900' },
  searchBox: { minHeight: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6F0', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }, searchInput: { flex: 1, minHeight: 44, color: palette.navy, fontSize: 13, fontWeight: '600' }, accountFilters: { gap: 7, paddingBottom: 2 }, filterChip: { maxWidth: 180, height: 34, borderRadius: 999, borderWidth: 1, borderColor: '#D8E3EF', backgroundColor: '#FFFFFF', paddingHorizontal: 12, justifyContent: 'center' }, filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy }, filterText: { color: '#65758B', fontSize: 10.5, fontWeight: '800' }, filterTextActive: { color: '#FFFFFF' }, recordCard: { minHeight: 105, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 12, paddingLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden', shadowColor: '#122544', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }, recordCardPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] }, fleetCardImage: { position: 'absolute', right: -10, top: 0, bottom: 0, width: 156, opacity: 0.22 }, fleetImageFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 170, backgroundColor: 'rgba(255,255,255,0.44)' }, accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }, recordIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, recordCopy: { flex: 1, minWidth: 0 }, accountName: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 }, recordTitle: { color: palette.navy, fontSize: 15.5, fontWeight: '900', marginTop: 2 }, recordSubtitle: { color: '#334155', fontSize: 10.5, fontWeight: '700', marginTop: 2 }, recordMeta: { color: '#65758B', fontSize: 9.8, lineHeight: 13, fontWeight: '600', marginTop: 2 }, statusPill: { maxWidth: 88, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 }, statusText: { fontSize: 8.8, lineHeight: 11, fontWeight: '900', textAlign: 'center' },
});
