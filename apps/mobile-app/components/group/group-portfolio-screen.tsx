import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppLoading, useLoadingRouter } from '@/components/app-loading';
import { GroupPageShell } from '@/components/group/group-page-shell';
import { EmptyState, LoadingState } from '@/components/ui';
import { getGroupAssociatedAccountDetail, getGroupChildAccountOverview, getSelectedCustomerContext, groupChildAccountTitle, partnerTypeLabel, selectCustomerContext, type GroupAssociatedAccountDetail, type GroupChildAccountOverview } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, Policy, Vehicle } from '@/lib/types';

type PortfolioRow = GroupChildAccountOverview & { vehicles: number; policies: number; claims: number };

export function GroupAccountsScreen() {
  const router = useLoadingRouter();
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'corporate' | 'individual_proprietor' | 'dealership'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { let active = true; setLoading(true); void (async () => {
    try {
      const groupContext = await getSelectedCustomerContext();
      if (!groupContext || groupContext.partner_type !== 'group') { if (active) setRows([]); return; }
      const contexts = await getGroupChildAccountOverview(groupContext.customer_id);
      const ids = contexts.map((item) => item.customer_id).filter((id): id is string => Boolean(id));
      const [vehicleResult, policyResult, claimResult] = ids.length ? await Promise.all([
        supabase.from('vehicles').select('id, customer_id').in('customer_id', ids),
        supabase.from('policies').select('id, customer_id, end_date').in('customer_id', ids),
        supabase.from('claims').select('id, customer_id, current_status').in('customer_id', ids),
      ]) : [{ data: [] }, { data: [] }, { data: [] }];
      if (!active) return;
      setRows(contexts.map((context) => ({
        ...context,
        vehicles: context.customer_id ? (vehicleResult.data ?? []).filter((item) => item.customer_id === context.customer_id).length : 0,
        policies: context.customer_id ? (policyResult.data ?? []).filter((item) => item.customer_id === context.customer_id && new Date(item.end_date).getTime() >= Date.now()).length : 0,
        claims: context.customer_id ? (claimResult.data ?? []).filter((item) => item.customer_id === context.customer_id && !['Closed', 'Settled', 'Rejected', 'Claim Complete'].includes(item.current_status)).length : 0,
      })));
    } finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    if (filter !== 'all' && row.partner_type !== filter) return false;
    const haystack = `${groupChildAccountTitle(row)} ${row.customer_code ?? ''} ${row.city ?? ''} ${row.state ?? ''} ${row.contact_name ?? ''} ${row.phone ?? ''} ${row.onboarding_status}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [filter, query, rows]);
  const addAction = <Pressable onPress={() => router.push('/customer/group/add-account')} style={styles.addButton}><MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" /><Text style={styles.addButtonText}>Add</Text></Pressable>;

  return <GroupPageShell title="Associated Customers" subtitle={`${rows.length} account${rows.length === 1 ? '' : 's'} in the Group portfolio`} icon="account-multiple-outline" rightAction={addAction} loading={loading}>
    {loading ? <LoadingState /> : <>
      <View style={styles.searchBox}><MaterialCommunityIcons name="magnify" size={20} color="#7A8799" /><TextInput value={query} onChangeText={setQuery} placeholder="Search company, contact, mobile or city" placeholderTextColor="#9AA6B6" style={styles.searchInput} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{([['all','All'],['corporate','Corporate'],['individual_proprietor','Individual'],['dealership','Dealership']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filterChip, filter === value && styles.filterChipActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</ScrollView>
      {!filtered.length ? <EmptyState title="No associated customers" body="Accounts associated with this Group will appear here with their onboarding status." /> : filtered.map((row) => {
        return <Pressable key={row.row_id} onPress={() => router.push({ pathname: '/customer/group/account-detail', params: { id: row.customer_id ?? '', applicationId: row.application_id ?? '' } })} style={[styles.customerCard, row.account_source !== 'linked_customer' && styles.customerCardPending]}>
          <View style={styles.cardTop}><View style={styles.businessIcon}><MaterialCommunityIcons name={row.partner_type === 'dealership' ? 'storefront-outline' : row.partner_type === 'corporate' ? 'office-building-outline' : 'account-outline'} size={22} color="#0A43A3" /></View><View style={styles.cardCopy}><Text style={styles.customerName} numberOfLines={1}>{groupChildAccountTitle(row)}</Text><Text style={styles.customerMeta}>{partnerTypeLabel(row.partner_type)} - {row.customer_code ?? 'KYC application'}</Text><Text style={styles.customerLocation}>{[row.city, row.state].filter(Boolean).join(', ') || 'Location not available'}</Text></View><StatusPill status={row.onboarding_status} /></View>
          <View style={styles.cardMetrics}><SmallMetric label="Vehicles" value={row.vehicles} /><SmallMetric label="Policies" value={row.policies} lined /><SmallMetric label="Open Claims" value={row.claims} lined /></View>
          <View style={styles.cardFooter}><Text style={styles.contactText}>Contact: {row.contact_name || 'Pending contact'}</Text>{row.account_source === 'linked_customer' ? <MaterialCommunityIcons name="chevron-right" size={20} color="#0A43A3" /> : <Text style={styles.pendingText}>View onboarding status</Text>}</View>
        </Pressable>;
      })}
    </>}
  </GroupPageShell>;
}

export function GroupAccountDetailScreen() {
  const router = useLoadingRouter();
  const { runWithLoader } = useAppLoading();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const applicationId = typeof params.applicationId === 'string' ? params.applicationId : '';
  const [detail, setDetail] = useState<GroupAssociatedAccountDetail | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { let active = true; setLoading(true); void (async () => {
    try {
      const groupContext = await getSelectedCustomerContext();
      if (!groupContext || groupContext.partner_type !== 'group') return;
      const next = await getGroupAssociatedAccountDetail({ groupCustomerId: groupContext.customer_id, customerId: id || null, applicationId: applicationId || null });
      if (!next) return;
      const childCustomerId = next.customer_id;
      const [vehicleResult, policyResult, claimResult] = childCustomerId ? await Promise.all([supabase.from('vehicles').select('*').eq('customer_id', childCustomerId), supabase.from('policies').select('*').eq('customer_id', childCustomerId), supabase.from('claims').select('*').eq('customer_id', childCustomerId)]) : [{ data: [] }, { data: [] }, { data: [] }];
      if (!active) return;
      setDetail(next); setVehicles(vehicleResult.data ?? []); setPolicies(policyResult.data ?? []); setClaims(claimResult.data ?? []);
    } finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; }, [applicationId, id]);

  if (loading) return <GroupPageShell title="Account Details" subtitle="Loading associated account" icon="office-building-outline" loading><LoadingState /></GroupPageShell>;
  if (!context || !customer) return <GroupPageShell title="Account Details" subtitle="Associated account unavailable" icon="office-building-outline"><EmptyState title="Account unavailable" body="This account is not available in the Group portfolio." /></GroupPageShell>;
  const selectedContext = context;
  const openClaims = claims.filter((claim) => !['Closed','Settled','Rejected','Claim Complete'].includes(claim.current_status));
  const activePolicies = policies.filter((policy) => new Date(policy.end_date).getTime() >= Date.now());
  const groupName = selectedContext.group_name || 'Group Account';
  function openAsSelectedAccount() { void runWithLoader(async () => { await selectCustomerContext(selectedContext.customer_id); router.replace('/customer/home'); }, 'Opening associated account'); }

  return <GroupPageShell title={currentDetail.account_title} subtitle={`Associated with ${groupName}`} icon="office-building-outline">
    <View style={styles.detailStatusCard}><View><Text style={styles.statusLabel}>Onboarding status</Text><Text style={styles.statusTitle}>{statusLabel(currentDetail.onboarding_status)}</Text></View><StatusPill status={currentDetail.onboarding_status} /></View>
    <View style={styles.detailMetrics}><LargeMetric label="Vehicles" value={vehicles.length || currentDetail.vehicle_count} /><LargeMetric label="Policies" value={activePolicies.length || currentDetail.active_policy_count} lined /><LargeMetric label="Open Claims" value={openClaims.length || currentDetail.open_claim_count} lined /></View>
    <View style={styles.infoCard}><Info label="Customer Code" value={textValue(details.customer_code)} /><Info label="Partner Type" value={partnerTypeLabel(currentDetail.partner_type)} /><Info label="Company" value={textValue(details.company_name)} /><Info label="Contact Person" value={textValue(details.contact_name)} /><Info label="Mobile" value={textValue(details.phone)} /><Info label="Email" value={textValue(details.email)} /><Info label="Address" value={[textValue(details.address), textValue(details.address_locality)].filter((item) => item !== '-').join(', ') || '-'} /><Info label="Location" value={[textValue(details.city), textValue(details.state), textValue(details.postal_code)].filter((item) => item !== '-').join(', ') || '-'} /><Info label="PAN / GST" value={[textValue(details.company_pan), textValue(details.gst_number)].filter((item) => item !== '-').join(' / ') || '-'} /><Info label="Fleet Size" value={fleetLabel(textValue(details.fleet_size_band))} /></View>
    <Text style={styles.sectionTitle}>Login Contacts</Text>
    <View style={styles.infoCard}>{currentDetail.contacts.length ? currentDetail.contacts.map((contact, index) => <ContactInfo key={`${textValue(contact.role)}-${index}`} contact={contact} />) : <Info label="Contacts" value="No contact records available" />}</View>
    <Text style={styles.sectionTitle}>Documents</Text>
    <View style={styles.infoCard}>{currentDetail.documents.length ? currentDetail.documents.map((document, index) => <DocumentInfo key={`${textValue(document.type)}-${index}`} document={document} />) : <Info label="Documents" value="No documents uploaded yet" />}</View>
    {currentDetail.customer_id ? <><Text style={styles.sectionTitle}>Account Actions</Text><View style={styles.actionGrid}><DetailAction icon="truck-outline" title="Vehicles" onPress={openAsSelectedAccount} /><DetailAction icon="file-document-outline" title="Policies" onPress={openAsSelectedAccount} /><DetailAction icon="shield-check-outline" title="Claims" onPress={openAsSelectedAccount} /><DetailAction icon="account-switch-outline" title="Open Account" onPress={openAsSelectedAccount} /></View><View style={styles.noteCard}><MaterialCommunityIcons name="information-outline" size={20} color="#0A43A3" /><Text style={styles.noteText}>Opening this account switches the app context while keeping your Group access active.</Text></View></> : <View style={styles.noteCard}><MaterialCommunityIcons name="clock-outline" size={20} color="#0A43A3" /><Text style={styles.noteText}>This account is still in onboarding. Vehicles, policies and claims will appear here after approval and activation.</Text></View>}
  </GroupPageShell>;
}

function SmallMetric({ label, value, lined }: { label: string; value: number; lined?: boolean }) { return <View style={[styles.smallMetric, lined && styles.smallMetricLined]}><Text style={styles.smallMetricValue}>{value}</Text><Text style={styles.smallMetricLabel}>{label}</Text></View>; }
function LargeMetric({ label, value, lined }: { label: string; value: number; lined?: boolean }) { return <View style={[styles.largeMetric, lined && styles.largeMetricLined]}><Text style={styles.largeMetricValue}>{value}</Text><Text style={styles.largeMetricLabel}>{label}</Text></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={2}>{value}</Text></View>; }
function ContactInfo({ contact }: { contact: Record<string, unknown> }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{roleLabel(textValue(contact.role))}</Text><View style={styles.infoStack}><Text style={styles.infoValue} numberOfLines={1}>{textValue(contact.name)}</Text><Text style={styles.infoSubValue} numberOfLines={1}>{[textValue(contact.phone), textValue(contact.email), statusLabel(textValue(contact.status))].filter((item) => item !== '-').join(' - ') || '-'}</Text></View></View>; }
function DocumentInfo({ document }: { document: Record<string, unknown> }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{documentLabel(textValue(document.type))}</Text><View style={styles.infoStack}><Text style={styles.infoValue} numberOfLines={1}>{textValue(document.file_name)}</Text><Text style={styles.infoSubValue}>{statusLabel(textValue(document.status))}</Text></View></View>; }
function DetailAction({ icon, title, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.detailAction}><View style={styles.detailActionIcon}><MaterialCommunityIcons name={icon} size={22} color="#0A43A3" /></View><Text style={styles.detailActionText}>{title}</Text></Pressable>; }
function StatusPill({ status }: { status: string }) { const active = status === 'active' || status === 'approved'; const review = ['submitted','under_review','in_progress'].includes(status); return <View style={[styles.statusPill, active ? styles.statusPillActive : review ? styles.statusPillReview : styles.statusPillMuted]}><Text style={[styles.statusText, active ? styles.statusTextActive : review ? styles.statusTextReview : styles.statusTextMuted]}>{statusLabel(status)}</Text></View>; }
function statusLabel(status: string) { if (status === 'active' || status === 'approved') return 'Verified'; if (status === 'under_review') return 'Under review'; if (status === 'submitted') return 'Submitted'; if (status === 'changes_requested') return 'Changes requested'; if (status === 'in_progress') return 'In progress'; return status.replace(/_/g, ' '); }
function textValue(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : '-'; }
function roleLabel(value: string) { return value === '-' ? 'Contact' : value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function documentLabel(value: string) { return value === '-' ? 'Document' : value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function fleetLabel(value: string) { if (value === 'less_than_5') return 'Less than 5'; if (value === '5_to_20') return '5 to 20'; if (value === '20_to_50') return '20 to 50'; if (value === 'more_than_50') return 'More than 50'; return value; }

const styles = StyleSheet.create({
  addButton: { minHeight: 36, borderRadius: 11, backgroundColor: '#0A43A3', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 }, addButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  searchBox: { minHeight: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6F0', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }, searchInput: { flex: 1, minHeight: 44, color: palette.navy, fontSize: 13, fontWeight: '600' }, filterRow: { gap: 7, paddingBottom: 2 }, filterChip: { height: 34, borderRadius: 999, borderWidth: 1, borderColor: '#D8E3EF', backgroundColor: '#FFFFFF', paddingHorizontal: 13, justifyContent: 'center' }, filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy }, filterText: { color: '#65758B', fontSize: 11, fontWeight: '800' }, filterTextActive: { color: '#FFFFFF' },
  customerCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 12, shadowColor: '#122544', shadowOpacity: 0.05, shadowRadius: 9, elevation: 2 }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, businessIcon: { width: 43, height: 43, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1, minWidth: 0 }, customerName: { color: palette.navy, fontSize: 14.5, fontWeight: '900' }, customerMeta: { color: '#0A43A3', fontSize: 10, fontWeight: '800', marginTop: 2 }, customerLocation: { color: '#65758B', fontSize: 10.5, fontWeight: '600', marginTop: 2 }, statusPill: { borderRadius: 999, backgroundColor: '#E8F8F0', paddingHorizontal: 8, paddingVertical: 4 }, statusPillMuted: { backgroundColor: '#F2F4F7' }, statusText: { color: '#12805C', fontSize: 9, fontWeight: '900' }, cardMetrics: { minHeight: 60, borderRadius: 13, backgroundColor: '#F7FAFE', flexDirection: 'row', marginTop: 11, paddingVertical: 8 }, smallMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, smallMetricLined: { borderLeftWidth: 1, borderLeftColor: '#DDE6F0' }, smallMetricValue: { color: palette.navy, fontSize: 18, fontWeight: '900' }, smallMetricLabel: { color: '#65758B', fontSize: 9.5, fontWeight: '700', marginTop: 1 }, cardFooter: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E8EDF3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, contactText: { color: '#65758B', fontSize: 10, fontWeight: '600' },
  detailMetrics: { minHeight: 78, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', flexDirection: 'row', paddingVertical: 10 }, largeMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, largeMetricLined: { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }, largeMetricValue: { color: palette.navy, fontSize: 24, fontWeight: '900' }, largeMetricLabel: { color: '#65758B', fontSize: 9.5, fontWeight: '700', marginTop: 2 }, infoCard: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 13 }, infoRow: { minHeight: 45, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', flexDirection: 'row', alignItems: 'center', gap: 10 }, infoLabel: { width: 105, color: '#65758B', fontSize: 10.5, fontWeight: '700' }, infoValue: { flex: 1, color: palette.navy, fontSize: 11.5, fontWeight: '800' }, sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, detailAction: { width: '48%', minHeight: 78, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center', padding: 8 }, detailActionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, detailActionText: { color: palette.navy, fontSize: 10.5, fontWeight: '800', marginTop: 5 }, noteCard: { borderRadius: 14, backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#CFE0F8', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }, noteText: { flex: 1, color: '#526278', fontSize: 9.8, lineHeight: 14, fontWeight: '600' },
});
