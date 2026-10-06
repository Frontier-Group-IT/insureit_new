import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerAnchoredDropdown } from '@/components/ui/partner-anchored-dropdown';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerNetwork, type PartnerNetworkData, type PartnerNetworkRow } from '@/lib/network';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';

type NetworkFilter = 'all' | 'grouped' | 'ungrouped';

const metricVisuals = {
  policies: { icon: 'document-text-outline' as const, color: '#1677FF', background: '#EEF6FF' },
  customers: { icon: 'people-outline' as const, color: '#12A150', background: '#EAFBF1' },
  renewals: { icon: 'refresh-outline' as const, color: '#5B35F5', background: '#F0ECFF' },
  claims: { icon: 'shield-outline' as const, color: '#F28A16', background: '#FFF4E8' },
};

export default function NetworkScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerNetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<NetworkFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerNetwork());
    } catch {
      setError('Your commercial network could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const map = new Map<string, { label: string; owner: string | null; rows: PartnerNetworkRow[] }>();

    for (const row of data.partners) {
      const isGrouped = Boolean(row.group?.group_id);
      if (filter === 'grouped' && !isGrouped) continue;
      if (filter === 'ungrouped' && isGrouped) continue;
      if (
        normalizedQuery &&
        !row.partner_name.toLowerCase().includes(normalizedQuery) &&
        !row.partner_code.toLowerCase().includes(normalizedQuery)
      ) {
        continue;
      }

      const groupKey = row.group?.group_id || `ungrouped:${row.owner.employee_id || 'none'}`;
      const label = row.group?.group_name || 'Ungrouped';
      const existing = map.get(groupKey);
      if (existing) existing.rows.push(row);
      else map.set(groupKey, { label, owner: row.owner.name, rows: [row] });
    }

    return [...map.entries()].map(([key, value]) => ({ key, ...value }));
  }, [data, filter, query]);

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  return (
    <PartnerScreen title="Commercial relationships" hideTopBar>
      <View style={styles.header}>
        <View style={styles.headerAccentOne} />
        <View style={styles.headerAccentTwo} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerBrandIcon}>
          <Ionicons name="business" size={21} color="#0B5DC2" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>MY NETWORK</Text>
          <Text style={styles.headerTitle}>Commercial relationships</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close network"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {loading ? (
        <PartnerStateView state="loading" title="Loading network" />
      ) : error || !data ? (
        <PartnerStateView
          state="error"
          title="Network unavailable"
          message={error || 'Your commercial network could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <>
          <View style={styles.freshnessRow}>
            <Text style={styles.scope}>{humanize(data.scope_mode)} scope</Text>
            <Text style={styles.updated}>{formatUpdatedAt(data.generated_at)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <SummaryCard
              icon="people"
              iconColor="#5B35F5"
              iconBackground="#F0ECFF"
              value={data.total_partners}
              label="Partner families"
            />
            <SummaryCard
              icon="people-circle-outline"
              iconColor="#0788E8"
              iconBackground="#EAF6FF"
              value={data.total_groups}
              label="Groups"
            />
            <SummaryCard
              icon="shield-checkmark"
              iconColor="#1677FF"
              iconBackground="#EEF4FF"
              value={data.partners.reduce((sum, row) => sum + row.child_count, 0)}
              label="POSP / MISP"
            />
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color="#60708B" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search partner by name or code..."
                placeholderTextColor="#7D8799"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.searchInput}
                accessibilityLabel="Search partner by name or code"
              />
              {query ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color="#A4ADBC" />
                </Pressable>
              ) : null}
            </View>

            <PartnerAnchoredDropdown
              visible={filterOpen}
              onDismiss={() => setFilterOpen(false)}
              align="right"
              menuWidth={154}
              menu={(
                <View style={styles.filterMenu}>
                  <FilterOption label="All partners" selected={filter === 'all'} onPress={() => { setFilter('all'); setFilterOpen(false); }} />
                  <FilterOption label="Grouped" selected={filter === 'grouped'} onPress={() => { setFilter('grouped'); setFilterOpen(false); }} />
                  <FilterOption label="Ungrouped" selected={filter === 'ungrouped'} onPress={() => { setFilter('ungrouped'); setFilterOpen(false); }} />
                </View>
              )}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filter network"
                accessibilityState={{ expanded: filterOpen }}
                onPress={() => setFilterOpen((value) => !value)}
                style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
              >
                <Ionicons name="filter-outline" size={18} color="#17244A" />
                <Text style={styles.filterText}>Filter</Text>
                <Ionicons name={filterOpen ? 'chevron-up' : 'chevron-down'} size={15} color="#17244A" />
              </Pressable>
            </PartnerAnchoredDropdown>
          </View>

          {sections.length ? (
            sections.map((section) => {
              const sectionCollapsed = collapsedSections.has(section.key);
              return (
                <View key={section.key} style={styles.section}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !sectionCollapsed }}
                    accessibilityLabel={`${sectionCollapsed ? 'Expand' : 'Collapse'} ${section.label}`}
                    onPress={() => toggleSection(section.key)}
                    style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}
                  >
                    <View style={styles.sectionIcon}>
                      <Ionicons
                        name={section.label === 'Ungrouped' ? 'layers-outline' : 'folder-open-outline'}
                        size={19}
                        color="#173A67"
                      />
                    </View>
                    <View style={styles.sectionHeaderBody}>
                      <Text style={styles.sectionName}>{section.label}</Text>
                      <Text numberOfLines={1} style={styles.sectionMeta}>
                        {section.rows.length} Partner {section.rows.length === 1 ? 'family' : 'families'}
                        {section.owner ? ` · ${section.owner}` : ''}
                      </Text>
                    </View>
                    <Ionicons name={sectionCollapsed ? 'chevron-down' : 'chevron-up'} size={16} color="#23486F" />
                  </Pressable>

                  {!sectionCollapsed ? (
                    <View style={styles.partnerList}>
                      {section.rows.map((row) => {
                        const isOpen = expanded === row.partner_id;
                        return (
                          <View key={row.partner_id} style={styles.partnerCard}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{ expanded: isOpen }}
                              accessibilityLabel={`${isOpen ? 'Collapse' : 'Expand'} ${row.partner_name} network`}
                              onPress={() => setExpanded(isOpen ? null : row.partner_id)}
                              style={({ pressed }) => [styles.partnerTop, pressed && styles.pressed]}
                            >
                              <View style={styles.partnerNode}>
                                <Text style={styles.partnerInitial}>{initials(row.partner_name)}</Text>
                              </View>
                              <View style={styles.partnerIdentity}>
                                <Text numberOfLines={1} style={styles.partnerName}>{row.partner_name}</Text>
                                <Text style={styles.partnerCode}>{row.partner_code}</Text>
                              </View>
                              <View style={styles.partnerRight}>
                                <Text style={styles.partnerPremium}>{formatIndianCurrency(row.metrics.premium_this_month)}</Text>
                                <Text style={styles.partnerPremiumLabel}>this month</Text>
                              </View>
                              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#3F6288" />
                            </Pressable>

                            <View style={styles.partnerMetrics}>
                              <MetricStat visual={metricVisuals.policies} value={row.metrics.total_policies} label="Policies" />
                              <View style={styles.metricDivider} />
                              <MetricStat visual={metricVisuals.customers} value={row.metrics.total_customers} label="Customers" />
                              <View style={styles.metricDivider} />
                              <MetricStat visual={metricVisuals.renewals} value={row.metrics.renewals_30_days} label="Renewals" />
                              <View style={styles.metricDivider} />
                              <MetricStat visual={metricVisuals.claims} value={row.metrics.active_claims} label="Claims" />
                            </View>

                            {isOpen ? (
                              <View style={styles.expanded}>
                                <View style={styles.connectionLine} />
                                <Text style={styles.expandedLabel}>FAMILY STRUCTURE</Text>
                                {row.children.length ? (
                                  row.children.map((child) => (
                                    <View key={child.intermediary_id} style={styles.childRow}>
                                      <View style={styles.childNode}>
                                        <Ionicons name={child.type === 'posp' ? 'person-outline' : 'business-outline'} size={14} color={partnerTheme.colors.accent} />
                                      </View>
                                      <View style={styles.childBody}>
                                        <Text style={styles.childName}>{child.name}</Text>
                                        <Text style={styles.childMeta}>{child.type.toUpperCase()}{child.code ? ` · ${child.code}` : ''}</Text>
                                      </View>
                                    </View>
                                  ))
                                ) : (
                                  <View style={styles.standalone}>
                                    <Ionicons name="checkmark-circle-outline" size={16} color={partnerTheme.colors.success} />
                                    <Text style={styles.standaloneText}>Standalone Partner family</Text>
                                  </View>
                                )}
                                {row.owner.name ? (
                                  <View style={styles.ownerRow}>
                                    <Text style={styles.ownerLabel}>Sales owner</Text>
                                    <Text style={styles.ownerValue}>{row.owner.name}{row.owner.employee_code ? ` · ${row.owner.employee_code}` : ''}</Text>
                                  </View>
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={styles.noResults}>
              <Ionicons name="search-outline" size={22} color="#74829A" />
              <Text style={styles.noResultsTitle}>No matching partners</Text>
              <Text style={styles.noResultsText}>Try another name, partner code or filter.</Text>
            </View>
          )}
        </>
      )}
    </PartnerScreen>
  );
}

function SummaryCard({
  icon,
  iconColor,
  iconBackground,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.summaryCopy}>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text numberOfLines={1} style={styles.summaryLabel}>{label}</Text>
      </View>
    </View>
  );
}

function MetricStat({
  visual,
  value,
  label,
}: {
  visual: { icon: keyof typeof Ionicons.glyphMap; color: string; background: string };
  value: number;
  label: string;
}) {
  return (
    <View style={styles.metricStat}>
      <View style={[styles.metricIcon, { backgroundColor: visual.background }]}>
        <Ionicons name={visual.icon} size={14} color={visual.color} />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

function FilterOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.filterOption, pressed && styles.pressed]}>
      <Text style={[styles.filterOptionText, selected && styles.filterOptionSelected]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={16} color="#0C67D8" /> : null}
    </Pressable>
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'P';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Network loaded';
  return `Updated ${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(date)}`;
}

const styles = StyleSheet.create({
  header: {
    position: 'relative',
    minHeight: 62,
    marginHorizontal: -partnerTheme.spacing.lg,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    overflow: 'hidden',
    backgroundColor: '#0756B8',
  },
  headerAccentOne: {
    position: 'absolute',
    right: 58,
    top: -42,
    width: 112,
    height: 126,
    backgroundColor: '#0A68D5',
    transform: [{ rotate: '26deg' }],
  },
  headerAccentTwo: {
    position: 'absolute',
    right: -38,
    top: -42,
    width: 104,
    height: 132,
    backgroundColor: '#0961CB',
    transform: [{ rotate: '24deg' }],
  },
  headerButton: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerBrandIcon: { width: 34, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerEyebrow: { color: '#DCEBFF', fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 1 },
  headerTitle: { marginTop: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 19, fontWeight: '700' },

  freshnessRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  scope: { color: '#58677E', fontSize: 10, lineHeight: 13, fontWeight: '500' },
  updated: { color: '#8995A7', fontSize: 9, lineHeight: 12 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E5EAF2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    shadowColor: '#122746',
    shadowOpacity: 0.035,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  summaryIcon: { width: 31, height: 31, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryValue: { color: '#101828', fontSize: 20, lineHeight: 22, fontWeight: '700' },
  summaryLabel: { marginTop: 2, color: '#59677B', fontSize: 9, lineHeight: 11 },

  searchRow: { position: 'relative', zIndex: 5, flexDirection: 'row', gap: 8, marginBottom: 9 },
  searchBox: {
    flex: 1,
    height: 38,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE5EF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  searchInput: { flex: 1, minWidth: 0, height: 38, paddingVertical: 0, color: '#172033', fontSize: 11 },
  filterButton: {
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE5EF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
  },
  filterText: { color: '#17244A', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  filterMenu: {
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DDE5EF',
    backgroundColor: '#FFFFFF',
    shadowColor: '#17213A',
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  filterOption: { minHeight: 36, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterOptionText: { color: '#4E5D73', fontSize: 11 },
  filterOptionSelected: { color: '#0C67D8', fontWeight: '700' },

  section: { marginBottom: 10 },
  sectionHeader: {
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E3E9F1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#F9FBFE',
  },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF1F6' },
  sectionHeaderBody: { flex: 1, minWidth: 0 },
  sectionName: { color: '#172033', fontSize: 13, lineHeight: 16, fontWeight: '700' },
  sectionMeta: { marginTop: 2, color: '#627188', fontSize: 9, lineHeight: 12 },

  partnerList: { gap: 7, marginTop: 6 },
  partnerCard: {
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#19304C',
    shadowOpacity: 0.035,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  partnerTop: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  partnerNode: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0ECFF' },
  partnerInitial: { color: '#4A39D1', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  partnerIdentity: { flex: 1, minWidth: 0 },
  partnerName: { color: '#161D2A', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  partnerCode: { marginTop: 2, color: '#617086', fontSize: 9, lineHeight: 11 },
  partnerRight: { alignItems: 'flex-end' },
  partnerPremium: { color: '#101828', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  partnerPremiumLabel: { marginTop: 1, color: '#69788E', fontSize: 8, lineHeight: 10 },

  partnerMetrics: { minHeight: 50, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E6EBF2', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF' },
  metricStat: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  metricIcon: { width: 25, height: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricCopy: { minWidth: 0 },
  metricValue: { color: '#111827', fontSize: 11, lineHeight: 12, fontWeight: '700' },
  metricLabel: { marginTop: 2, color: '#69778B', fontSize: 7.5, lineHeight: 9 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: '#E4EAF2' },

  expanded: { position: 'relative', padding: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E6EBF2', backgroundColor: '#FBFCFE' },
  connectionLine: { position: 'absolute', left: 31, top: 39, bottom: 18, width: 1, backgroundColor: '#D9E3E5' },
  expandedLabel: { marginBottom: 7, color: partnerTheme.colors.inkMuted, letterSpacing: 0.8, ...partnerTheme.typography.meta },
  childRow: { minHeight: partnerTheme.control.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 3 },
  childNode: { zIndex: 1, width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.accentSoft },
  childBody: { flex: 1 },
  childName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  childMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  standalone: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: partnerTheme.control.minTouchTarget, paddingHorizontal: 8, borderRadius: partnerTheme.radius.md, backgroundColor: partnerTheme.colors.successSoft },
  standaloneText: { flex: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  ownerRow: { marginTop: 7, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  ownerLabel: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  ownerValue: { flex: 1, textAlign: 'right', color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },

  noResults: { marginTop: 34, alignItems: 'center', paddingVertical: 24 },
  noResultsTitle: { marginTop: 8, color: '#27364B', fontSize: 13, fontWeight: '700' },
  noResultsText: { marginTop: 4, color: '#74829A', fontSize: 10 },
  pressed: { opacity: 0.72 },
});
