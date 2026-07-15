import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { customerAccountTitle, getAccessibleCustomerContexts, partnerTypeLabel, selectCustomerContext, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, Policy, Vehicle } from '@/lib/types';

type PortfolioRow = CustomerAccountContext & { vehicles: number; policies: number; claims: number; city: string | null; status: string };

export function GroupAccountsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'corporate' | 'individual_proprietor' | 'dealership'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { let active = true; void (async () => {
    try {
      const contexts = (await getAccessibleCustomerContexts()).filter((item) => item.access_source === 'group_child');
      const ids = contexts.map((item) => item.customer_id);
      if (!ids.length) { if (active) setRows([]); return; }
      const [customerResult, vehicleResult, policyResult, claimResult] = await Promise.all([
        supabase.from('customers').select('id, city, onboarding_status').in('id', ids),
        supabase.from('vehicles').select('id, customer_id').in('customer_id', ids),
        supabase.from('policies').select('id, customer_id, end_date').in('customer_id', ids),
        supabase.from('claims').select('id, customer_id, current_status').in('customer_id', ids),
      ]);
      if (!active) return;
      const customers = new Map((customerResult.data ?? []).map((item) => [item.id, item]));
      setRows(contexts.map((context) => ({
        ...context,
        vehicles: (vehicleResult.data ?? []).filter((item) => item.customer_id === context.customer_id).length,
        policies: (policyResult.data ?? []).filter((item) => item.customer_id === context.customer_id && new Date(item.end_date).getTime() >= Date.now()).length,
        claims: (claimResult.data ?? []).filter((item) => item.customer_id === context.customer_id && !['Closed', 'Settled', 'Rejected', 'Claim Complete'].includes(item.current_status)).length,
        city: customers.get(context.customer_id)?.city ?? null,
        status: customers.get(context.customer_id)?.onboarding_status ?? 'active',
      })));
    } finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    if (filter !== 'all' && row.partner_type !== filter) return false;
    const haystack = `${customerAccountTitle(row)} ${row.customer_code} ${row.city ?? ''} ${row.contact_name}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [filter, query, rows]);

  if (loading) return <Screen title="Associated Customers"><LoadingState /></Screen>;
  return <Screen title="Associated Customers" showLogout>
    <View style={styles.titleRow}><View><Text style={styles.heading}>Associated Customers</Text><Text style={styles.subheading}>{rows.length} account{rows.length === 1 ? '' : 's'} in the Group portfolio</Text></View><Pressable onPress={() => router.push('/customer/group/add-account')} style={styles.addButton}><MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" /><Text style={styles.addButtonText}>Add</Text></Pressable></View>
    <View style={styles.searchBox}><MaterialCommunityIcons name="magnify" size={20} color="#7A8799" /><TextInput value={query} onChangeText={setQuery} placeholder="Search company, contact, mobile or city" placeholderTextColor="#9AA6B6" style={styles.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{([['all','All'],['corporate','Corporate'],['individual_proprietor','Individual'],['dealership','Dealership']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filterChip, filter === value && styles.filterChipActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</ScrollView>
    {!filtered.length ? <EmptyState title="No associated customers" body="Accounts associated with this Group will appear here." /> : filtered.map((row) => <Pressable key={row.customer_id} onPress={() => router.push({ pathname: '/customer/group/account-detail', params: { id: row.customer_id } })} style={styles.customerCard}>
      <View style={styles.cardTop}><View style={styles.businessIcon}><MaterialCommunityIcons name={row.partner_type === 'dealership' ? 'storefront-outline' : row.partner_type === 'corporate' ? 'office-building-outline' : 'account-outline'} size={22} color="#0A43A3" /></View><View style={styles.cardCopy}><Text style={styles.customerName} numberOfLines={1}>{customerAccountTitle(row)}</Text><Text style={styles.customerMeta}>{partnerTypeLabel(row.partner_type)} · {row.customer_code}</Text><Text style={styles.customerLocation}>{row.city || 'Location not available'}</Text></View><View style={[styles.statusPill, row.status !== 'active' && styles.statusPillMuted]}><Text style={styles.statusText}>{row.status === 'active' ? 'Active' : 'Inactive'}</Text></View></View>
      <View style={styles.cardMetrics}><SmallMetric label="Vehicles" value={row.vehicles} /><SmallMetric label="Policies" value={row.policies} lined /><SmallMetric label="Open Claims" value={row.claims} lined /></View>
      <View style={styles.cardFooter}><Text style={styles.contactText}>Contact: {row.contact_name}</Text><MaterialCommunityIcons name="chevron-right" size={20} color="#0A43A3" /></View>
    </Pressable>)}
  </Screen>;
}

export function GroupAccountDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [context, setContext] = useState<CustomerAccountContext | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { let active = true; void (async () => {
    try {
      const contexts = await getAccessibleCustomerContexts();
      const next = contexts.find((item) => item.customer_id === id && item.access_source === 'group_child') ?? null;
      if (!next) return;
      const [customerResult, vehicleResult, policyResult, claimResult] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).maybeSingle(),
        supabase.from('vehicles').select('*').eq('customer_id', id),
        supabase.from('policies').select('*').eq('customer_id', id),
        supabase.from('claims').select('*').eq('customer_id', id),
      ]);
      if (!active) return;
      setContext(next); setCustomer(customerResult.data); setVehicles(vehicleResult.data ?? []); setPolicies(policyResult.data ?? []); setClaims(claimResult.data ?? []);
    } finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; }, [id]);

  if (loading) return <Screen title="Account Details"><LoadingState /></Screen>;
  if (!context || !customer) return <Screen title="Account Details"><EmptyState title="Account unavailable" body="This account is not available in the Group portfolio." /></Screen>;
  const openClaims = claims.filter((claim) => !['Closed','Settled','Rejected','Claim Complete'].includes(claim.current_status));
  const activePolicies = policies.filter((policy) => new Date(policy.end_date).getTime() >= Date.now());
  const groupName = context.group_name || 'Group Account';

  async function openAsSelectedAccount() { await selectCustomerContext(context.customer_id); router.replace('/customer/home'); }

  return <Screen title={customerAccountTitle(context)} showLogout>
    <View style={styles.detailHero}><View style={styles.detailIcon}><MaterialCommunityIcons name="office-building-outline" size={30} color="#FFFFFF" /></View><View style={styles.detailCopy}><Text style={styles.detailName}>{customerAccountTitle(context)}</Text><Text style={styles.detailAssociation}>Associated with {groupName}</Text><View style={styles.detailStatus}><Text style={styles.detailStatusText}>{partnerTypeLabel(context.partner_type)} · {customer.onboarding_status === 'active' ? 'Active' : 'Inactive'}</Text></View></View></View>
    <View style={styles.detailMetrics}><LargeMetric label="Vehicles" value={vehicles.length} /><LargeMetric label="Policies" value={activePolicies.length} lined /><LargeMetric label="Open Claims" value={openClaims.length} lined /></View>
    <View style={styles.infoCard}><Info label="Customer Code" value={context.customer_code} /><Info label="Contact Person" value={customer.contact_name || '—'} /><Info label="Mobile" value={customer.phone || '—'} /><Info label="Email" value={customer.email || '—'} /><Info label="Location" value={[customer.city, customer.state].filter(Boolean).join(', ') || '—'} /></View>
    <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Account Actions</Text></View>
    <View style={styles.actionGrid}><DetailAction icon="truck-outline" title="Vehicles" onPress={openAsSelectedAccount} /><DetailAction icon="file-document-outline" title="Policies" onPress={openAsSelectedAccount} /><DetailAction icon="shield-search-outline" title="Claims" onPress={openAsSelectedAccount} /><DetailAction icon="account-switch-outline" title="Open Account" onPress={openAsSelectedAccount} /></View>
    <View style={styles.noteCard}><MaterialCommunityIcons name="information-outline" size={20} color="#0A43A3" /><Text style={styles.noteText}>Opening this account switches the app context while keeping your Group access active. You can return to the Group overview from the account switcher.</Text></View>
  </Screen>;
}

function SmallMetric({ label, value, lined }: { label: string; value: number; lined?: boolean }) { return <View style={[styles.smallMetric, lined && styles.smallMetricLined]}><Text style={styles.smallMetricValue}>{value}</Text><Text style={styles.smallMetricLabel}>{label}</Text></View>; }
function LargeMetric({ label, value, lined }: { label: string; value: number; lined?: boolean }) { return <View style={[styles.largeMetric, lined && styles.largeMetricLined]}><Text style={styles.largeMetricValue}>{value}</Text><Text style={styles.largeMetricLabel}>{label}</Text></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={2}>{value}</Text></View>; }
function DetailAction({ icon, title, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.detailAction}><View style={styles.detailActionIcon}><MaterialCommunityIcons name={icon} size={22} color="#0A43A3" /></View><Text style={styles.detailActionText}>{title}</Text></Pressable>; }

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, heading: { color: palette.navy, fontSize: 21, fontWeight: '900' }, subheading: { color: '#65758B', fontSize: 11, fontWeight: '600', marginTop: 2 }, addButton: { minHeight: 38, borderRadius: 11, backgroundColor: '#0A43A3', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 5 }, addButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  searchBox: { minHeight: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6F0', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }, searchInput: { flex: 1, minHeight: 44, color: palette.navy, fontSize: 13, fontWeight: '600' }, filterRow: { gap: 7, paddingBottom: 12 }, filterChip: { height: 34, borderRadius: 999, borderWidth: 1, borderColor: '#D8E3EF', backgroundColor: '#FFFFFF', paddingHorizontal: 13, justifyContent: 'center' }, filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy }, filterText: { color: '#65758B', fontSize: 11, fontWeight: '800' }, filterTextActive: { color: '#FFFFFF' },
  customerCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 12, marginBottom: 10, shadowColor: '#122544', shadowOpacity: 0.05, shadowRadius: 9, elevation: 2 }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, businessIcon: { width: 43, height: 43, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1, minWidth: 0 }, customerName: { color: palette.navy, fontSize: 14.5, fontWeight: '900' }, customerMeta: { color: '#0A43A3', fontSize: 10, fontWeight: '800', marginTop: 2 }, customerLocation: { color: '#65758B', fontSize: 10.5, fontWeight: '600', marginTop: 2 }, statusPill: { borderRadius: 999, backgroundColor: '#E8F8F0', paddingHorizontal: 8, paddingVertical: 4 }, statusPillMuted: { backgroundColor: '#F2F4F7' }, statusText: { color: '#12805C', fontSize: 9, fontWeight: '900' }, cardMetrics: { minHeight: 60, borderRadius: 13, backgroundColor: '#F7FAFE', flexDirection: 'row', marginTop: 11, paddingVertical: 8 }, smallMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, smallMetricLined: { borderLeftWidth: 1, borderLeftColor: '#DDE6F0' }, smallMetricValue: { color: palette.navy, fontSize: 18, fontWeight: '900' }, smallMetricLabel: { color: '#65758B', fontSize: 9.5, fontWeight: '700', marginTop: 1 }, cardFooter: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E8EDF3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, contactText: { color: '#65758B', fontSize: 10, fontWeight: '600' },
  detailHero: { borderRadius: 19, backgroundColor: palette.navy, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, overflow: 'hidden' }, detailIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' }, detailCopy: { flex: 1 }, detailName: { color: '#FFFFFF', fontSize: 19, lineHeight: 24, fontWeight: '900' }, detailAssociation: { color: '#D7E6FF', fontSize: 10.5, fontWeight: '600', marginTop: 2 }, detailStatus: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 4, marginTop: 7 }, detailStatusText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' }, detailMetrics: { minHeight: 83, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', flexDirection: 'row', marginTop: 11 }, largeMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, largeMetricLined: { borderLeftWidth: 1, borderLeftColor: '#DDE6F0' }, largeMetricValue: { color: palette.navy, fontSize: 22, fontWeight: '900' }, largeMetricLabel: { color: '#65758B', fontSize: 10, fontWeight: '700', marginTop: 2 }, infoCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 13, marginTop: 11 }, infoRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, infoLabel: { color: '#65758B', fontSize: 10.5, fontWeight: '700' }, infoValue: { flex: 1, textAlign: 'right', color: palette.navy, fontSize: 11.5, fontWeight: '800' }, sectionTitleRow: { marginTop: 14, marginBottom: 8 }, sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, detailAction: { width: '48.7%', minHeight: 75, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center', gap: 5 }, detailActionIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, detailActionText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' }, noteCard: { borderRadius: 14, backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#CFE0F8', padding: 12, marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, noteText: { flex: 1, color: '#315277', fontSize: 10.5, lineHeight: 15, fontWeight: '600' },
});