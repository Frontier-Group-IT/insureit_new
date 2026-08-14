import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

type PolicyFilter = 'All' | 'Active' | 'Renewal Due' | 'Expired';
type PolicyRow = { id: string; customer_id: string; vehicle_id: string; insurance_company_id: string; policy_no: string; policy_type: string; start_date: string; end_date: string; source: 'sibl' | 'external' };

export default function PoliciesScreen() {
  const router = useRouter();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PolicyFilter>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const ids = contexts.map((context) => context.customer_id);
      if (ids.length) {
        const [policyResult, externalPolicyResult, vehicleResult, companyResult] = await Promise.all([
          supabase.from('policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date').in('customer_id', ids).order('end_date', { ascending: true }),
          (supabase as any).from('external_policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date').in('customer_id', ids).order('end_date', { ascending: true }),
          supabase.from('vehicles').select('*').in('customer_id', ids),
          supabase.from('insurance_companies').select('*'),
        ]);
        if (!active) return;
        setPolicies([
          ...((policyResult.data ?? []) as Omit<PolicyRow, 'source'>[]).map((policy) => ({ ...policy, source: 'sibl' as const })),
          ...((externalPolicyResult.data ?? []) as Omit<PolicyRow, 'source'>[]).map((policy) => ({ ...policy, source: 'external' as const })),
        ].sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()));
        setVehicles(vehicleResult.data ?? []);
        setCompanies(companyResult.data ?? []);
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  if (loading) return <Screen title="My Policies"><LoadingState /></Screen>;

  const metrics = policyMetrics(policies);
  const filteredPolicies = policies.filter((policy) => {
    const vehicle = vehicles.find((item) => item.id === policy.vehicle_id);
    const company = companies.find((item) => item.id === policy.insurance_company_id);
    const tone = policyTone(policy.end_date);
    const text = [policy.policy_no, policy.policy_type, vehicle?.vehicle_no, vehicle?.make, vehicle?.model, company?.name].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'All' || (filter === 'Renewal Due' ? tone === 'due' : filter.toLowerCase() === tone);
    return matchesSearch && matchesFilter;
  });

  return (
    <Screen title="My Policies" showLogout showTitleHeader={false}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.eyebrow}>POLICY WALLET</Text>
            <Text style={styles.pageTitle}>My Policies</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/customer/add-policy')} style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
            <MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
        <Text style={styles.heroText}>Track cover, expiry and renewal action for every vehicle.</Text>
        <View style={styles.metricRow}>
          <Metric label="Active" value={metrics.active} tone="active" />
          <Metric label="Due" value={metrics.due} tone="due" />
          <Metric label="Expired" value={metrics.expired} tone="expired" />
        </View>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={18} color="#0A43A3" />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search vehicle, insurer or policy no." placeholderTextColor="#7F8EA4" style={styles.searchInput} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear policy search" onPress={() => setQuery('')} style={styles.clearButton}><MaterialCommunityIcons name="close" size={15} color="#667085" /></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterWrap}>
        {(['All', 'Active', 'Renewal Due', 'Expired'] as PolicyFilter[]).map((item) => (
          <Pressable key={item} accessibilityRole="button" onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {policies.length === 0 ? <EmptyState title="No policies yet" body="Add your current policy once and we will keep the vehicle cover visible here." actionLabel="Add Policy" onAction={() => router.push('/customer/add-policy')} icon="shield-plus-outline" /> : null}
      {policies.length > 0 && filteredPolicies.length === 0 ? <EmptyState title="No matching policies" body="Clear search or switch the filter to see more policy records." actionLabel="Clear Filters" onAction={() => { setQuery(''); setFilter('All'); }} icon="filter-remove-outline" /> : null}

      {filteredPolicies.map((policy) => {
        const vehicle = vehicles.find((item) => item.id === policy.vehicle_id);
        const company = companies.find((item) => item.id === policy.insurance_company_id);
        const days = daysUntil(policy.end_date);
        const tone = policyTone(policy.end_date);
        return (
          <Pressable key={`${policy.source}-${policy.id}`} onPress={() => router.push({ pathname: '/customer/policy-detail', params: { id: policy.id, source: policy.source } } as any)} style={({ pressed }) => [styles.policyCard, pressed && styles.policyCardPressed]}>
            <View style={[styles.cardAccent, tone === 'expired' && styles.cardAccentExpired, tone === 'due' && styles.cardAccentDue]} />
            <View style={styles.policyTop}>
              <View style={[styles.policyIcon, policy.source === 'external' && styles.externalPolicyIcon, tone === 'expired' && styles.policyIconExpired, tone === 'due' && styles.policyIconDue]}>
                <MaterialCommunityIcons name={policy.source === 'external' ? 'account-edit-outline' : tone === 'expired' ? 'shield-alert-outline' : tone === 'due' ? 'calendar-alert' : 'shield-check-outline'} size={22} color={policy.source === 'external' ? '#0A43A3' : toneColor(tone)} />
              </View>
              <View style={styles.policyCopy}>
                <View style={styles.titleLine}>
                  <Text style={styles.vehicleNo}>{vehicle?.vehicle_no ?? 'Vehicle unavailable'}</Text>
                  {policy.source === 'external' ? <View style={styles.sourcePill}><Text style={styles.sourceText}>Customer Added</Text></View> : null}
                </View>
                <Text style={styles.insurerName} numberOfLines={1}>{company?.name ?? 'Insurer pending'}</Text>
              </View>
              <View style={[styles.statusPill, tone === 'expired' && styles.statusExpired, tone === 'due' && styles.statusDue]}>
                <Text style={[styles.statusText, tone === 'expired' && styles.statusExpiredText, tone === 'due' && styles.statusDueText]}>{tone === 'expired' ? 'Expired' : tone === 'due' ? 'Renewal' : 'Active'}</Text>
              </View>
            </View>
            <View style={styles.policyInfo}>
              <Info label="Policy No." value={policy.policy_no} />
              <Info label="Type" value={policy.policy_type || 'Policy'} />
            </View>
            <View style={styles.timelineRow}>
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineLabel}>Valid till</Text>
                <Text style={styles.timelineDate}>{formatDate(policy.end_date)}</Text>
              </View>
              <View style={styles.daysPill}>
                <Text style={[styles.daysText, tone === 'expired' && styles.daysExpired]}>{days < 0 ? `${Math.abs(days)}d ago` : `${days}d left`}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={toneColor(tone)} />
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'active' | 'due' | 'expired' }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, tone === 'due' && styles.metricDue, tone === 'expired' && styles.metricExpired]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={1}>{value || '-'}</Text></View>;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function policyTone(endDate: string) {
  const days = daysUntil(endDate);
  return days < 0 ? 'expired' : days <= 30 ? 'due' : 'active';
}

function toneColor(tone: 'active' | 'due' | 'expired') {
  return tone === 'expired' ? '#C43838' : tone === 'due' ? '#B7791F' : palette.emerald;
}

function policyMetrics(items: PolicyRow[]) {
  return items.reduce((total, policy) => {
    const tone = policyTone(policy.end_date);
    total[tone] += 1;
    return total;
  }, { active: 0, due: 0, expired: 0 });
}

const styles = StyleSheet.create({
  hero: { minHeight: 178, borderRadius: 22, backgroundColor: palette.navy, padding: 15, marginTop: -22, marginBottom: 12, overflow: 'hidden' },
  heroGlow: { position: 'absolute', right: -64, top: -50, width: 168, height: 168, borderRadius: 90, backgroundColor: 'rgba(11,99,206,0.44)' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  eyebrow: { color: '#B9D5FF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pageTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '900', marginTop: 3 },
  heroText: { color: '#D7E7FF', fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 8, maxWidth: 260 },
  addButton: { minHeight: 38, borderRadius: 13, backgroundColor: '#0B63CE', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addButtonPressed: { opacity: 0.84, transform: [{ scale: 0.96 }] },
  addButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  metricRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metric: { flex: 1, minHeight: 58, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: '#7EE0B2', fontSize: 22, lineHeight: 26, fontWeight: '900' },
  metricDue: { color: '#F6C665' },
  metricExpired: { color: '#FF9A9A' },
  metricLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', marginTop: 2 },
  searchBox: { minHeight: 50, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  searchInput: { flex: 1, minHeight: 48, color: palette.navy, fontSize: 12.5, fontWeight: '700' },
  clearButton: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#F3F6FA', alignItems: 'center', justifyContent: 'center' },
  filterScroll: { maxHeight: 42, marginBottom: 11 },
  filterWrap: { flexDirection: 'row', gap: 8, paddingRight: 14 },
  filterChip: { height: 34, borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy },
  filterText: { color: palette.slate, fontSize: 11, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  policyCard: { position: 'relative', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 12, marginBottom: 10, overflow: 'hidden', shadowColor: '#10233F', shadowOpacity: 0.055, shadowRadius: 11, elevation: 2 },
  policyCardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: palette.emerald },
  cardAccentExpired: { backgroundColor: '#C43838' },
  cardAccentDue: { backgroundColor: '#B7791F' },
  policyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyIcon: { width: 42, height: 42, borderRadius: radii.sm, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  externalPolicyIcon: { backgroundColor: '#EAF2FF' },
  policyIconExpired: { backgroundColor: '#FDECEC' },
  policyIconDue: { backgroundColor: '#FFF4E2' },
  policyCopy: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleNo: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  sourcePill: { backgroundColor: '#EAF2FF', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3 },
  sourceText: { color: '#0A43A3', fontSize: 7.8, fontWeight: '900' },
  insurerName: { color: palette.navy, fontSize: 12.5, fontWeight: '800', marginTop: 2 },
  statusPill: { borderRadius: 999, backgroundColor: palette.emeraldSoft, paddingHorizontal: 9, paddingVertical: 5 },
  statusExpired: { backgroundColor: '#FDECEC' },
  statusDue: { backgroundColor: '#FFF4E2' },
  statusText: { color: palette.emerald, fontSize: 9.5, fontWeight: '900' },
  statusExpiredText: { color: '#C43838' },
  statusDueText: { color: '#B7791F' },
  policyInfo: { flexDirection: 'row', gap: 8, marginTop: 12 },
  info: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E1EAF5', paddingHorizontal: 10, justifyContent: 'center' },
  infoLabel: { color: palette.slate, fontSize: 9.5, fontWeight: '800' },
  infoValue: { color: palette.navy, fontSize: 11.5, fontWeight: '900', marginTop: 3 },
  timelineRow: { minHeight: 42, marginTop: 10, borderRadius: 14, backgroundColor: '#FBFDFF', borderWidth: 1, borderColor: '#E6EDF6', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  timelineCopy: { flex: 1 },
  timelineLabel: { color: palette.slate, fontSize: 9.5, fontWeight: '800' },
  timelineDate: { color: palette.ink, fontSize: 12, fontWeight: '900', marginTop: 1 },
  daysPill: { borderRadius: 999, backgroundColor: '#F2F6FB', paddingHorizontal: 8, paddingVertical: 4 },
  daysText: { color: palette.navy, fontSize: 10, fontWeight: '900' },
  daysExpired: { color: '#C43838' },
});
