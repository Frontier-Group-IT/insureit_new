import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerListSummaryStrip } from '@/components/ui/partner-list-summary-strip';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerNetwork, type PartnerNetworkData, type PartnerNetworkRow } from '@/lib/network';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';

export default function NetworkScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerNetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

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
    const map = new Map<string, { label: string; owner: string | null; rows: PartnerNetworkRow[] }>();
    for (const row of data.partners) {
      const groupKey = row.group?.group_id || `ungrouped:${row.owner.employee_id || 'none'}`;
      const label = row.group?.group_name || 'Ungrouped';
      const existing = map.get(groupKey);
      if (existing) existing.rows.push(row);
      else map.set(groupKey, { label, owner: row.owner.name, rows: [row] });
    }
    return [...map.entries()].map(([key, value]) => ({ key, ...value }));
  }, [data]);

  return (
    <PartnerScreen
      eyebrow="MY NETWORK"
      title="Commercial relationships"
      action={<PartnerIconButton icon="close" label="Close network" onPress={() => router.back()} />}
    >
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

          <PartnerListSummaryStrip
            items={[
              { key: 'partners', label: 'Partner families', value: data.total_partners },
              { key: 'groups', label: 'Groups', value: data.total_groups },
              { key: 'children', label: 'POSP / MISP', value: data.partners.reduce((sum, row) => sum + row.child_count, 0) },
            ]}
          />

          {sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <View style={[styles.sectionHeader, section.label !== 'Ungrouped' && styles.sectionHeaderGroup]}>
                <View style={styles.sectionIcon}>
                  <Ionicons name={section.label === 'Ungrouped' ? 'layers-outline' : 'folder-open-outline'} size={17} color={section.label === 'Ungrouped' ? '#667085' : partnerTheme.colors.brand} />
                </View>
                <View style={styles.sectionHeaderBody}>
                  <Text style={styles.sectionName}>{section.label}</Text>
                  <Text style={styles.sectionMeta}>
                    {section.rows.length} Partner {section.rows.length === 1 ? 'family' : 'families'}
                    {section.owner ? ` · ${section.owner}` : ''}
                  </Text>
                </View>
              </View>

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
                          <Text style={styles.partnerName}>{row.partner_name}</Text>
                          <Text style={styles.partnerCode}>{row.partner_code}</Text>
                        </View>
                        <View style={styles.partnerRight}>
                          <Text style={styles.partnerPremium}>{formatIndianCurrency(row.metrics.premium_this_month)}</Text>
                          <Text style={styles.partnerPremiumLabel}>this month</Text>
                        </View>
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9AA3B2" />
                      </Pressable>

                      <View style={styles.partnerMetrics}>
                        <MiniStat value={row.metrics.total_policies} label="Policies" />
                        <MiniStat value={row.metrics.total_customers} label="Customers" />
                        <MiniStat value={row.metrics.renewals_30_days} label="Renewals" />
                        <MiniStat value={row.metrics.active_claims} label="Claims" />
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
            </View>
          ))}
        </>
      )}
    </PartnerScreen>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase()).join('') || 'P';
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
  freshnessRow: { minHeight: 26, marginTop: -8, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  scope: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  updated: { color: '#8A94A6', ...partnerTheme.typography.meta },

  section: { marginTop: partnerTheme.spacing.lg },
  sectionHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surfaceMuted },
  sectionHeaderGroup: { backgroundColor: partnerTheme.colors.brandSoft },
  sectionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface },
  sectionHeaderBody: { flex: 1 },
  sectionName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  sectionMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },

  partnerList: { marginTop: 6 },
  partnerCard: { backgroundColor: partnerTheme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  partnerTop: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10 },
  partnerNode: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  partnerInitial: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.bodyStrong },
  partnerIdentity: { flex: 1 },
  partnerName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  partnerCode: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  partnerRight: { alignItems: 'flex-end' },
  partnerPremium: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  partnerPremiumLabel: { marginTop: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },

  partnerMetrics: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line, backgroundColor: '#FBFCFE' },
  miniStat: { flex: 1, alignItems: 'center' },
  miniValue: { color: partnerTheme.colors.ink, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  miniLabel: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },

  expanded: { position: 'relative', padding: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
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
  pressed: { opacity: 0.78 },
});
