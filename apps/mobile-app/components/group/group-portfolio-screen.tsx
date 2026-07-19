import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useLoadingRouter } from '@/components/app-loading';
import { GroupPageShell } from '@/components/group/group-page-shell';
import { EmptyState, LoadingState } from '@/components/ui';
import { getGroupAssociatedAccountDetail, getGroupChildAccountOverview, getSelectedCustomerContext, groupChildAccountTitle, partnerTypeLabel, type GroupAssociatedAccountDetail, type GroupChildAccountOverview } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, Policy, Vehicle } from '@/lib/types';

type PortfolioRow = GroupChildAccountOverview & { vehicles: number; policies: number; claims: number };
type ActivityRow = { id: string; event_type: string; title: string | null; message: string | null; priority: string; status: string; created_at: string };
type AccountFilter = 'all' | 'corporate' | 'individual_proprietor' | 'dealership';
const accountFilters: AccountFilter[] = ['all', 'corporate', 'individual_proprietor', 'dealership'];
const manageableParentTypes = new Set(['group', 'corporate', 'dealership']);

export function GroupAccountsScreen() {
  const router = useLoadingRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AccountFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof params.filter === 'string' && accountFilters.includes(params.filter as AccountFilter)) {
      setFilter(params.filter as AccountFilter);
    }
  }, [params.filter]);

  useEffect(() => { let active = true; setLoading(true); void (async () => {
    try {
      const groupContext = await getSelectedCustomerContext();
      if (!groupContext || !manageableParentTypes.has(groupContext.partner_type)) { if (active) setRows([]); return; }
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

  return <GroupPageShell title="Associated Customers" subtitle={`${rows.length} account${rows.length === 1 ? '' : 's'} under this account`} icon="account-multiple-outline" rightAction={addAction} loading={loading}>
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
  const params = useLocalSearchParams<{ id?: string; applicationId?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const applicationId = typeof params.applicationId === 'string' ? params.applicationId : '';
  const [detail, setDetail] = useState<GroupAssociatedAccountDetail | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { let active = true; setLoading(true); void (async () => {
    try {
      const groupContext = await getSelectedCustomerContext();
      if (!groupContext || !manageableParentTypes.has(groupContext.partner_type)) return;
      const next = await getGroupAssociatedAccountDetail({ groupCustomerId: groupContext.customer_id, customerId: id || null, applicationId: applicationId || null });
      if (!next) return;
      const childCustomerId = next.customer_id;
      const [vehicleResult, policyResult, claimResult, activityResult] = childCustomerId ? await Promise.all([
        supabase.from('vehicles').select('*').eq('customer_id', childCustomerId),
        supabase.from('policies').select('*').eq('customer_id', childCustomerId),
        supabase.from('claims').select('*').eq('customer_id', childCustomerId),
        supabase.from('customer_activity_events').select('id, event_type, title, message, priority, status, created_at').eq('customer_id', childCustomerId).order('created_at', { ascending: false }).limit(6),
      ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
      if (!active) return;
      setDetail(next); setVehicles(vehicleResult.data ?? []); setPolicies(policyResult.data ?? []); setClaims(claimResult.data ?? []); setActivities((activityResult.data ?? []) as ActivityRow[]);
    } finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; }, [applicationId, id]);

  if (loading) return <GroupPageShell title="Account Details" subtitle="Loading associated account" icon="office-building-outline" loading><LoadingState /></GroupPageShell>;
  if (!detail) return <GroupPageShell title="Account Details" subtitle="Associated account unavailable" icon="office-building-outline"><EmptyState title="Account unavailable" body="This account is not available under the selected parent account." /></GroupPageShell>;
  const currentDetail = detail;
  const details = currentDetail.details;
  const openClaims = claims.filter((claim) => !['Closed','Settled','Rejected','Claim Complete'].includes(claim.current_status));
  const activePolicies = policies.filter((policy) => new Date(policy.end_date).getTime() >= Date.now());
  const accountFilter = currentDetail.customer_id ? { accountId: currentDetail.customer_id } : undefined;

  return <GroupPageShell title={currentDetail.account_title} subtitle={`${partnerTypeLabel(currentDetail.partner_type)} - ${statusLabel(currentDetail.onboarding_status)}`} icon="office-building-outline" rightAction={<StatusPill status={currentDetail.onboarding_status} />}>
    <AccountSummaryCard detail={currentDetail} />
    <View style={styles.detailMetrics}>
      <LargeMetric icon="truck-outline" label="Vehicles" value={vehicles.length || currentDetail.vehicle_count} onPress={() => accountFilter && router.push({ pathname: '/customer/group/fleet', params: accountFilter })} />
      <LargeMetric icon="file-document-outline" label="Policies" value={activePolicies.length || currentDetail.active_policy_count} onPress={() => accountFilter && router.push({ pathname: '/customer/group/policies', params: accountFilter })} />
      <LargeMetric icon="shield-check-outline" label="Open Claims" value={openClaims.length || currentDetail.open_claim_count} onPress={() => accountFilter && router.push({ pathname: '/customer/group/claims', params: accountFilter })} />
    </View>
    <SectionCard title="Customer Details" icon="card-account-details-outline"><Info label="Customer Code" value={textValue(details.customer_code)} /><Info label="Partner Type" value={partnerTypeLabel(currentDetail.partner_type)} /><Info label="Company" value={textValue(details.company_name)} /><Info label="Contact Person" value={textValue(details.contact_name)} /><Info label="Mobile" value={textValue(details.phone)} /><Info label="Email" value={textValue(details.email)} /><Info label="Address" value={[textValue(details.address), textValue(details.address_locality)].filter((item) => item !== '-').join(', ') || '-'} /><Info label="Location" value={[textValue(details.city), textValue(details.state), textValue(details.postal_code)].filter((item) => item !== '-').join(', ') || '-'} /><Info label="PAN / GST" value={[textValue(details.company_pan), textValue(details.gst_number)].filter((item) => item !== '-').join(' / ') || '-'} /><Info label="Fleet Size" value={fleetLabel(textValue(details.fleet_size_band))} /></SectionCard>
    <SectionCard title="Login Contacts" icon="account-key-outline">{currentDetail.contacts.length ? currentDetail.contacts.map((contact, index) => <ContactInfo key={`${textValue(contact.role)}-${index}`} contact={contact} />) : <Info label="Contacts" value="No contact records available" />}</SectionCard>
    <SectionCard title="Documents" icon="file-check-outline">{currentDetail.documents.length ? currentDetail.documents.map((document, index) => <DocumentInfo key={`${textValue(document.type)}-${index}`} document={document} />) : <Info label="Documents" value="No documents uploaded yet" />}</SectionCard>
    <SectionCard title="Recent Activity" icon="history">{activities.length ? activities.map((activity) => <ActivityInfo key={activity.id} activity={activity} />) : <Info label="Activity" value={currentDetail.customer_id ? 'No recent activity yet' : 'Activity will appear after approval and activation' } />}</SectionCard>
  </GroupPageShell>;
}

function SmallMetric({ label, value, lined }: { label: string; value: number; lined?: boolean }) { return <View style={[styles.smallMetric, lined && styles.smallMetricLined]}><Text style={styles.smallMetricValue}>{value}</Text><Text style={styles.smallMetricLabel}>{label}</Text></View>; }
function LargeMetric({ icon, label, value, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: number; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.largeMetric, pressed && styles.largeMetricPressed]}><View style={styles.largeMetricIcon}><MaterialCommunityIcons name={icon} size={19} color="#0A43A3" /></View><Text style={styles.largeMetricValue}>{value}</Text><Text style={styles.largeMetricLabel}>{label}</Text><MaterialCommunityIcons name="chevron-right" size={16} color="#8EA0B8" /></Pressable>; }
function AccountSummaryCard({ detail }: { detail: GroupAssociatedAccountDetail }) {
  const details = detail.details;
  const location = [textValue(details.city), textValue(details.state)].filter((item) => item !== '-').join(', ') || 'Location not available';
  const contact = [textValue(details.contact_name), textValue(details.phone)].filter((item) => item !== '-').join(' - ') || 'Contact pending';
  return <View style={styles.summaryCard}>
    <View style={styles.summaryTop}>
      <View style={styles.summaryIcon}><MaterialCommunityIcons name={detail.partner_type === 'dealership' ? 'storefront-outline' : detail.partner_type === 'corporate' ? 'office-building-outline' : 'account-outline'} size={25} color="#FFFFFF" /></View>
      <View style={styles.summaryCopy}>
        <Text style={styles.summaryEyebrow}>{partnerTypeLabel(detail.partner_type)}</Text>
        <Text style={styles.summaryName} numberOfLines={2}>{detail.account_title}</Text>
        <Text style={styles.summaryMeta} numberOfLines={1}>{location}</Text>
      </View>
      <StatusPill status={detail.onboarding_status} />
    </View>
    <View style={styles.summaryFacts}>
      <SummaryFact icon="account-tie-outline" label="Primary contact" value={contact} />
      <SummaryFact icon="identifier" label="Customer code" value={textValue(details.customer_code)} />
      <SummaryFact icon="card-account-details-outline" label="PAN / GST" value={[textValue(details.company_pan), textValue(details.gst_number)].filter((item) => item !== '-').join(' / ') || '-'} />
    </View>
  </View>;
}
function SummaryFact({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) { return <View style={styles.summaryFact}><View style={styles.summaryFactIcon}><MaterialCommunityIcons name={icon} size={15} color="#0A43A3" /></View><View style={styles.summaryFactCopy}><Text style={styles.summaryFactLabel}>{label}</Text><Text style={styles.summaryFactValue} numberOfLines={1}>{value}</Text></View></View>; }
function SectionCard({ title, icon, children }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; children: ReactNode }) { return <View style={styles.sectionCard}><View style={styles.sectionHeader}><View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={18} color="#0A43A3" /></View><Text style={styles.sectionTitle}>{title}</Text></View><View style={styles.infoCard}>{children}</View></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={2}>{value}</Text></View>; }
function ContactInfo({ contact }: { contact: Record<string, unknown> }) { return <View style={styles.contactCard}><View style={styles.contactIcon}><MaterialCommunityIcons name="account-circle-outline" size={19} color="#0A43A3" /></View><View style={styles.infoStack}><Text style={styles.contactRole}>{roleLabel(textValue(contact.role))}</Text><Text style={styles.infoValue} numberOfLines={1}>{textValue(contact.name)}</Text><Text style={styles.infoSubValue} numberOfLines={1}>{[textValue(contact.phone), textValue(contact.email)].filter((item) => item !== '-').join(' - ') || '-'}</Text></View><StatusPill status={textValue(contact.status)} /></View>; }
function DocumentInfo({ document }: { document: Record<string, unknown> }) { return <View style={styles.documentCard}><View style={styles.documentIcon}><MaterialCommunityIcons name="file-document-check-outline" size={18} color="#0A43A3" /></View><View style={styles.infoStack}><Text style={styles.infoValue} numberOfLines={1}>{documentLabel(textValue(document.type))}</Text><Text style={styles.infoSubValue} numberOfLines={1}>{textValue(document.file_name)}</Text></View><StatusPill status={textValue(document.status)} /></View>; }
function ActivityInfo({ activity }: { activity: ActivityRow }) { return <View style={styles.timelineRow}><View style={styles.timelineRail}><View style={styles.activityDot}><MaterialCommunityIcons name={activityIcon(activity.event_type)} size={15} color="#0A43A3" /></View></View><View style={styles.timelineBody}><View style={styles.timelineTop}><Text style={styles.infoValue} numberOfLines={1}>{activity.title || eventLabel(activity.event_type)}</Text><Text style={styles.activityTime}>{shortDate(activity.created_at)}</Text></View><Text style={styles.infoSubValue} numberOfLines={2}>{activity.message || formatDate(activity.created_at)}</Text></View></View>; }
function StatusPill({ status }: { status: string }) { const active = status === 'active' || status === 'approved'; const review = ['submitted','under_review','in_progress'].includes(status); return <View style={[styles.statusPill, active ? styles.statusPillActive : review ? styles.statusPillReview : styles.statusPillMuted]}><Text style={[styles.statusText, active ? styles.statusTextActive : review ? styles.statusTextReview : styles.statusTextMuted]}>{statusLabel(status)}</Text></View>; }
function statusLabel(status: string) { if (status === 'active' || status === 'approved') return 'Verified'; if (status === 'under_review') return 'Under review'; if (status === 'submitted') return 'Submitted'; if (status === 'changes_requested') return 'Changes requested'; if (status === 'in_progress') return 'In progress'; return status.replace(/_/g, ' '); }
function textValue(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : '-'; }
function roleLabel(value: string) { return value === '-' ? 'Contact' : value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function documentLabel(value: string) { return value === '-' ? 'Document' : value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function fleetLabel(value: string) { if (value === 'less_than_5') return 'Less than 5'; if (value === '5_to_20') return '5 to 20'; if (value === '20_to_50') return '20 to 50'; if (value === 'more_than_50') return 'More than 50'; return value; }
function formatDate(value?: string | null) { if (!value) return '-'; return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function shortDate(value: string) { return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
function eventLabel(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function activityIcon(value: string): keyof typeof MaterialCommunityIcons.glyphMap { if (value.includes('document')) return 'file-document-outline'; if (value.includes('support')) return 'headset'; if (value.includes('claim')) return 'shield-check-outline'; if (value.includes('vehicle')) return 'truck-outline'; return 'history'; }

const styles = StyleSheet.create({
  addButton: { minHeight: 36, borderRadius: 11, backgroundColor: '#0A43A3', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 }, addButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  searchBox: { minHeight: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6F0', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }, searchInput: { flex: 1, minHeight: 44, color: palette.navy, fontSize: 13, fontWeight: '600' }, filterRow: { gap: 7, paddingBottom: 2 }, filterChip: { height: 34, borderRadius: 999, borderWidth: 1, borderColor: '#D8E3EF', backgroundColor: '#FFFFFF', paddingHorizontal: 13, justifyContent: 'center' }, filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy }, filterText: { color: '#65758B', fontSize: 11, fontWeight: '800' }, filterTextActive: { color: '#FFFFFF' },
  customerCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 12, shadowColor: '#122544', shadowOpacity: 0.05, shadowRadius: 9, elevation: 2 }, customerCardPending: { borderStyle: 'dashed', backgroundColor: '#FBFDFF' }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, businessIcon: { width: 43, height: 43, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1, minWidth: 0 }, customerName: { color: palette.navy, fontSize: 14.5, fontWeight: '900' }, customerMeta: { color: '#0A43A3', fontSize: 10, fontWeight: '800', marginTop: 2 }, customerLocation: { color: '#65758B', fontSize: 10.5, fontWeight: '600', marginTop: 2 }, statusPill: { borderRadius: 999, backgroundColor: '#E8F8F0', paddingHorizontal: 8, paddingVertical: 4 }, statusPillActive: { backgroundColor: '#E8F8F0' }, statusPillReview: { backgroundColor: '#FFF4E2' }, statusPillMuted: { backgroundColor: '#F2F4F7' }, statusText: { color: '#12805C', fontSize: 9, fontWeight: '900' }, statusTextActive: { color: '#12805C' }, statusTextReview: { color: '#B7791F' }, statusTextMuted: { color: '#667085' }, cardMetrics: { minHeight: 60, borderRadius: 13, backgroundColor: '#F7FAFE', flexDirection: 'row', marginTop: 11, paddingVertical: 8 }, smallMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, smallMetricLined: { borderLeftWidth: 1, borderLeftColor: '#DDE6F0' }, smallMetricValue: { color: palette.navy, fontSize: 18, fontWeight: '900' }, smallMetricLabel: { color: '#65758B', fontSize: 9.5, fontWeight: '700', marginTop: 1 }, cardFooter: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E8EDF3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, contactText: { color: '#65758B', fontSize: 10, fontWeight: '600' }, pendingText: { color: '#0A43A3', fontSize: 10, fontWeight: '900' },
  summaryCard: { borderRadius: 20, backgroundColor: palette.navy, padding: 14, overflow: 'hidden', shadowColor: '#122544', shadowOpacity: 0.12, shadowRadius: 12, elevation: 3 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  summaryIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryEyebrow: { color: '#AFC2E6', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase' },
  summaryName: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '900', marginTop: 2 },
  summaryMeta: { color: '#C9D7EF', fontSize: 10.5, fontWeight: '700', marginTop: 3 },
  summaryFacts: { marginTop: 13, gap: 8 },
  summaryFact: { minHeight: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  summaryFactIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  summaryFactCopy: { flex: 1, minWidth: 0 },
  summaryFactLabel: { color: '#AFC2E6', fontSize: 9, fontWeight: '800' },
  summaryFactValue: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900', marginTop: 1 },
  detailMetrics: { flexDirection: 'row', gap: 8 },
  largeMetric: { flex: 1, minHeight: 104, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center', padding: 9, shadowColor: '#122544', shadowOpacity: 0.06, shadowRadius: 9, elevation: 2 },
  largeMetricPressed: { transform: [{ scale: 0.97 }], backgroundColor: '#F6FAFF' },
  largeMetricIcon: { width: 34, height: 34, borderRadius: 13, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  largeMetricValue: { color: palette.navy, fontSize: 22, fontWeight: '900' },
  largeMetricLabel: { color: '#65758B', fontSize: 9.2, fontWeight: '800', marginTop: 1, textAlign: 'center' },
  sectionCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', overflow: 'hidden', shadowColor: '#122544', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  sectionHeader: { minHeight: 52, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#F8FBFF', borderBottomWidth: 1, borderBottomColor: '#E8EEF6' },
  sectionIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  infoCard: { paddingHorizontal: 13, paddingVertical: 5, backgroundColor: '#FFFFFF' },
  infoRow: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { width: 108, color: '#65758B', fontSize: 10.4, fontWeight: '800' },
  infoStack: { flex: 1, minWidth: 0 },
  infoValue: { flex: 1, color: palette.navy, fontSize: 11.8, fontWeight: '800' },
  infoSubValue: { color: '#65758B', fontSize: 10.3, fontWeight: '700', marginTop: 2 },
  contactCard: { minHeight: 62, borderRadius: 15, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E3EBF5', paddingHorizontal: 10, marginVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 9 },
  contactIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  contactRole: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 1 },
  documentCard: { minHeight: 58, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3EBF5', paddingHorizontal: 10, marginVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 9 },
  documentIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  timelineRow: { minHeight: 64, flexDirection: 'row', gap: 10, paddingVertical: 7 },
  timelineRail: { width: 31, alignItems: 'center' },
  timelineBody: { flex: 1, minWidth: 0, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', paddingBottom: 8 },
  timelineTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityRow: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityDot: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  activityTime: { color: '#7A8799', fontSize: 9.5, fontWeight: '900' },
});
