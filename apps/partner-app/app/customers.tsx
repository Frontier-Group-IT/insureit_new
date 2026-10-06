import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerPagination } from '@/components/ui/partner-pagination';
import {
  getPartnerCustomerSummary,
  listPartnerCustomers,
  type PartnerCustomerRow,
  type PartnerCustomerSummary,
} from '@/lib/customers';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPageQuery } from '@/lib/use-partner-page-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 25;
let savedCustomerQuery = '';

export default function CustomersScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
  const [query, setQuery] = useState(savedCustomerQuery);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    savedCustomerQuery = query;
  }, [query]);

  const fetchSummary = useCallback(() => getPartnerCustomerSummary(), []);
  const summary = usePartnerQuery<PartnerCustomerSummary>({
    scopeKey: cacheScopeKey,
    key: 'customers:summary',
    fetcher: fetchSummary,
    staleTimeMs: 2 * 60_000,
  });

  const fetchPage = useCallback(async ({ limit, offset }: { limit: number; offset: number }) => {
    const nextRows = await listPartnerCustomers({ limit, offset, search: debouncedSearch });
    return {
      rows: nextRows,
      total: nextRows[0]?.total_count ?? 0,
    };
  }, [debouncedSearch]);

  const collection = usePartnerPageQuery<PartnerCustomerRow>({
    scopeKey: cacheScopeKey,
    key: `customers:list:${debouncedSearch || 'all'}`,
    pageSize: PAGE_SIZE,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);

  const totals = useMemo(() => {
    const customers = summary.data?.total_customers ?? 0;
    const active = summary.data?.active_customers ?? 0;
    return { customers, active, inactive: Math.max(customers - active, 0) };
  }, [summary.data]);

  const listHeader = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.heroIcon}>
          <Ionicons name="people" size={19} color="#0A5CC7" />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>BUSINESS</Text>
          <Text style={styles.title}>Customers</Text>
        </View>
      </View>

      <View style={styles.kpiOuter}>
        {summary.loading && !summary.data ? (
          <View style={styles.kpiLoading}><ActivityIndicator size="small" color="#123E75" /></View>
        ) : (
          <View style={styles.kpiStrip}>
            <KpiCell label="Customers" value={totals.customers} active first />
            <KpiCell label="Active" value={totals.active} />
            <KpiCell label="Inactive" value={totals.inactive} last />
          </View>
        )}
      </View>

      <View style={styles.searchBand}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color="#7F8EA3" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, code, phone, email or city"
            placeholderTextColor="#98A5B8"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color="#9BA7B8" />
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh customers" onPress={() => void refreshAll()} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
          <Ionicons name="refresh" size={18} color="#173E73" />
        </Pressable>
      </View>

      {(collection.stale || summary.stale) ? (
        <View style={styles.banner}>
          <PartnerBanner
            tone="warning"
            title={collection.offline || summary.offline ? "You're offline" : 'Showing cached information'}
            message={`Last refreshed ${formatUpdatedAt(collection.updatedAt || summary.updatedAt)}. Pull down to try again.`}
          />
        </View>
      ) : null}

      {collection.error && collection.rows.length && !collection.stale ? (
        <View style={styles.banner}><PartnerBanner tone="warning" message={collection.error} /></View>
      ) : null}
    </View>
  );

  const empty = collection.loading ? (
    <PartnerStateView state="loading" title="Finding customers" />
  ) : collection.error ? (
    <PartnerStateView state="error" title="Customers could not be loaded" message={collection.error} actionLabel="Try again" onAction={() => void refreshAll()} />
  ) : (
    <PartnerStateView
      state="empty"
      asset={PartnerAssets.emptyStates.noCustomers}
      title="No customers found"
      message={debouncedSearch ? 'Try a different name, code, phone, email or city.' : 'Customers in your authorized business scope will appear here.'}
    />
  );

  const footer = collection.rows.length ? (
    <PartnerPagination
      page={collection.page}
      totalPages={collection.totalPages}
      total={collection.total}
      pageSize={PAGE_SIZE}
      rowCount={collection.rows.length}
      onPrevious={collection.previousPage}
      onNext={collection.nextPage}
      disabled={collection.changingPage}
    />
  ) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FlatList
        key={`customers-page-${collection.page}`}
        data={collection.rows}
        keyExtractor={(row) => row.customer_id}
        renderItem={({ item }) => <CustomerCard row={item} onOpen={() => router.push(`/customer/${item.customer_id}` as never)} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<View style={styles.emptyWrap}>{empty}</View>}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshing={collection.refreshing || summary.refreshing}
        onRefresh={() => void refreshAll()}
      />

      <View style={styles.bottomNav}>
        <NavItem icon="home-outline" label="Home" onPress={() => router.push('/(tabs)' as never)} />
        <NavItem icon="briefcase" label="Business" active onPress={() => router.push('/(tabs)/business' as never)} />
        <NavItem icon="document-text-outline" label="Policies" onPress={() => router.push('/(tabs)/policies' as never)} />
        <NavItem icon="shield-checkmark-outline" label="Claims" onPress={() => router.push('/(tabs)/claims' as never)} />
        <NavItem icon="grid-outline" label="More" onPress={() => router.push('/(tabs)/more' as never)} />
      </View>
    </SafeAreaView>
  );
}

function KpiCell({ label, value, active = false, first = false, last = false }: { label: string; value: number; active?: boolean; first?: boolean; last?: boolean }) {
  return (
    <View style={[styles.kpiCell, active && styles.kpiCellActive, first && styles.kpiCellFirst, last && styles.kpiCellLast]}>
      <Text style={[styles.kpiValue, active && styles.kpiTextActive]}>{value}</Text>
      <Text style={[styles.kpiLabel, active && styles.kpiTextActive]}>{label}</Text>
    </View>
  );
}

function CustomerCard({ row, onOpen }: { row: PartnerCustomerRow; onOpen: () => void }) {
  const location = [row.city, row.state].filter(Boolean).join(', ');
  const isActive = (row.customer_status || '').trim().toLowerCase() === 'active';
  const phone = normalizePhone(row.phone || '');

  return (
    <View style={styles.cardWrap}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(row.customer_name)}</Text>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={`Open customer ${row.customer_name}`} onPress={onOpen} style={({ pressed }) => [styles.customerMain, pressed && styles.customerMainPressed]}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.customerName}>{row.customer_name}</Text>
            <View accessibilityLabel={isActive ? 'Active customer' : 'Inactive customer'} style={[styles.statusDot, isActive ? styles.statusDotActive : styles.statusDotInactive]} />
          </View>
          <Text numberOfLines={1} style={styles.meta}>{row.customer_code || 'Customer code pending'}{row.phone ? ` · ${row.phone}` : ''}</Text>
          <Text numberOfLines={1} style={styles.meta}>{row.intermediary_code || 'Direct / unassigned'}</Text>
          {location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={9} color="#6E809B" />
              <Text numberOfLines={1} style={styles.location}>{location}</Text>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.actions}>
          <ContactIcon icon="call-outline" label="Call" disabled={!phone} tone="phone" onPress={() => phone ? void Linking.openURL(`tel:+91${phone}`) : undefined} />
          <ContactIcon icon="logo-whatsapp" label="WhatsApp" disabled={!phone} tone="whatsapp" onPress={() => phone ? void Linking.openURL(`https://wa.me/91${phone}`) : undefined} />
        </View>
      </View>
    </View>
  );
}

function ContactIcon({ icon, label, disabled, tone, onPress }: { icon: 'call-outline' | 'logo-whatsapp'; label: string; disabled: boolean; tone: 'phone' | 'whatsapp'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, tone === 'whatsapp' && styles.actionButtonWhatsapp, disabled && styles.actionDisabled, pressed && !disabled && styles.pressed]}>
      <Ionicons name={icon} size={16} color={tone === 'whatsapp' ? '#12A64A' : '#5935E8'} />
    </Pressable>
  );
}

function NavItem({ icon, label, active = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}>
      <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}><Ionicons name={icon} size={19} color={active ? '#633DF1' : '#60738F'} /></View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function normalizePhone(value: string) { return value.replace(/\D/g, '').slice(-10); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CU'; }
function formatUpdatedAt(value: number | null) { if (!value) return 'earlier'; return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { paddingBottom: 88, backgroundColor: '#F5F7FB' },
  pressed: { opacity: 0.72 },
  hero: { height: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#0762CC' },
  heroOrbLarge: { position: 'absolute', right: -42, top: -55, width: 180, height: 130, borderRadius: 90, backgroundColor: '#0B78E6', opacity: 0.92 },
  heroOrbSmall: { position: 'absolute', right: 105, top: -32, width: 100, height: 88, borderRadius: 52, backgroundColor: '#0870DA', opacity: 0.82 },
  backButton: { width: 30, height: 34, alignItems: 'flex-start', justifyContent: 'center' },
  heroIcon: { width: 31, height: 31, marginLeft: 2, marginRight: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#D6E9FF', fontSize: 7.5, lineHeight: 9, letterSpacing: 0.85, fontWeight: '800' },
  title: { marginTop: 1, color: '#FFFFFF', fontSize: 14, lineHeight: 17, fontWeight: '800' },

  kpiOuter: { paddingHorizontal: 10, paddingTop: 8, backgroundColor: '#F5F7FB' },
  kpiLoading: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DEE7F2' },
  kpiStrip: { height: 48, flexDirection: 'row', borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE5F0' },
  kpiCell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E1E7F0', backgroundColor: '#FFFFFF' },
  kpiCellActive: { backgroundColor: '#0B2E63', borderLeftColor: '#0B2E63' },
  kpiCellFirst: { borderLeftWidth: 0 },
  kpiCellLast: {},
  kpiValue: { color: '#122B4E', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  kpiLabel: { marginTop: 1, color: '#65758D', fontSize: 7.4, lineHeight: 9.5, fontWeight: '600' },
  kpiTextActive: { color: '#FFFFFF' },

  searchBand: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', gap: 7 },
  searchBox: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE5F0', shadowColor: '#173B6C', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 7, color: '#20344F', fontSize: 9.5, lineHeight: 13 },
  refreshButton: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE5F0' },
  banner: { marginHorizontal: 10, marginBottom: 5 },

  cardWrap: { paddingHorizontal: 10, paddingTop: 5 },
  card: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E0E8F2', shadowColor: '#15375F', shadowOpacity: 0.035, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EDFF' },
  avatarText: { color: '#583CE7', fontSize: 8, lineHeight: 10, fontWeight: '800' },
  customerMain: { flex: 1, minWidth: 0, paddingVertical: 2, borderRadius: 6 },
  customerMainPressed: { opacity: 0.62 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  customerName: { flexShrink: 1, color: '#0B1A32', fontSize: 9.4, lineHeight: 12, fontWeight: '800' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotActive: { backgroundColor: '#1BB36B' },
  statusDotInactive: { backgroundColor: '#F3A32A' },
  meta: { marginTop: 1, color: '#60708A', fontSize: 6.9, lineHeight: 9 },
  locationRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 2 },
  location: { flex: 1, color: '#6E809B', fontSize: 6.5, lineHeight: 8.5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionButton: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F0FF' },
  actionButtonWhatsapp: { backgroundColor: '#ECFAF0' },
  actionDisabled: { opacity: 0.3 },

  emptyWrap: { paddingHorizontal: 10, paddingTop: 16 },
  listFooter: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  loadingMoreText: { color: '#71819A', fontSize: 7.5, lineHeight: 10 },

  bottomNav: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DDE5EF', backgroundColor: '#FFFFFF', paddingHorizontal: 5, paddingBottom: 2 },
  navItem: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  navIconWrap: { width: 34, height: 24, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#F0ECFF' },
  navLabel: { marginTop: 1, color: '#60738F', fontSize: 7, lineHeight: 9, fontWeight: '600' },
  navLabelActive: { color: '#633DF1', fontWeight: '800' },
});