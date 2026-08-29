import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { getPartnerNetwork, type PartnerNetworkData, type PartnerNetworkRow } from '@/lib/network';
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
      action={
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={18} color={partnerTheme.colors.ink} />
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : error || !data ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error || 'Network is unavailable.'}</Text>
          <Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroNode}>
              <Ionicons name="git-network-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroEyebrow}>AUTHORIZED NETWORK</Text>
              <Text style={styles.heroTitle}>{data.total_partners} Partner {data.total_partners === 1 ? 'family' : 'families'}</Text>
              <Text style={styles.heroText}>
                {data.total_groups > 0
                  ? `${data.total_groups} active Intermediary Group${data.total_groups === 1 ? '' : 's'} in this scope.`
                  : 'Partner families are currently shown without active Group containers.'}
              </Text>
            </View>
          </View>

          <View style={styles.legend}>
            <LegendDot style={styles.legendPartner} label="Partner family" />
            <LegendDot style={styles.legendChild} label="POSP / MISP child" />
            <LegendDot style={styles.legendGroup} label="Group container" />
          </View>

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
                      <Pressable onPress={() => setExpanded(isOpen ? null : row.partner_id)} style={styles.partnerTop}>
                        <View style={styles.partnerNode}>
                          <Text style={styles.partnerInitial}>{initials(row.partner_name)}</Text>
                        </View>
                        <View style={styles.partnerIdentity}>
                          <Text style={styles.partnerName}>{row.partner_name}</Text>
                          <Text style={styles.partnerCode}>{row.partner_code}</Text>
                        </View>
                        <View style={styles.partnerRight}>
                          <Text style={styles.partnerPremium}>{formatMoney(row.metrics.premium_this_month)}</Text>
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
                              <Text style={styles.standaloneText}>Standalone Partner family · direct business is supported.</Text>
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

function LegendDot({ style, label }: { style: object; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, style]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase()).join('') || 'P';
}

function formatMoney(value: number | string) {
  const amount = Number(value || 0);
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

const styles = StyleSheet.create({
  close: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  errorCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  errorText: { color: partnerTheme.colors.inkMuted, fontSize: 10 },
  retry: { marginTop: 10, color: partnerTheme.colors.brand, fontSize: 10, fontWeight: '800' },

  hero: { flexDirection: 'row', gap: 13, borderRadius: partnerTheme.radius.xl, padding: 18, backgroundColor: partnerTheme.colors.nav },
  heroNode: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#343D52' },
  heroBody: { flex: 1 },
  heroEyebrow: { color: '#AAA5FF', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { marginTop: 4, color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  heroText: { marginTop: 4, color: '#C9D0DE', fontSize: 9, lineHeight: 13 },

  legend: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendPartner: { backgroundColor: partnerTheme.colors.brand },
  legendChild: { backgroundColor: partnerTheme.colors.accent },
  legendGroup: { backgroundColor: '#CBD0DC' },
  legendText: { color: partnerTheme.colors.inkMuted, fontSize: 7.5 },

  section: { marginTop: 18 },
  sectionHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#EEF1F5' },
  sectionHeaderGroup: { backgroundColor: partnerTheme.colors.brandSoft },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  sectionHeaderBody: { flex: 1 },
  sectionName: { color: partnerTheme.colors.ink, fontSize: 10.5, fontWeight: '800' },
  sectionMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, fontSize: 8 },

  partnerList: { marginTop: 8, gap: 8 },
  partnerCard: { overflow: 'hidden', borderRadius: 17, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  partnerTop: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  partnerNode: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  partnerInitial: { color: partnerTheme.colors.brandStrong, fontSize: 10, fontWeight: '800' },
  partnerIdentity: { flex: 1 },
  partnerName: { color: partnerTheme.colors.ink, fontSize: 10.5, fontWeight: '800' },
  partnerCode: { marginTop: 2, color: partnerTheme.colors.inkMuted, fontSize: 7.5 },
  partnerRight: { alignItems: 'flex-end' },
  partnerPremium: { color: partnerTheme.colors.ink, fontSize: 10, fontWeight: '800' },
  partnerPremiumLabel: { marginTop: 1, color: partnerTheme.colors.inkMuted, fontSize: 6.5 },

  partnerMetrics: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line, backgroundColor: '#FBFCFE' },
  miniStat: { flex: 1, alignItems: 'center' },
  miniValue: { color: partnerTheme.colors.ink, fontSize: 11, fontWeight: '800' },
  miniLabel: { marginTop: 2, color: partnerTheme.colors.inkMuted, fontSize: 6.8 },

  expanded: { position: 'relative', padding: 13, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  connectionLine: { position: 'absolute', left: 30, top: 37, bottom: 18, width: 1, backgroundColor: '#D9E3E5' },
  expandedLabel: { marginBottom: 9, color: '#78908F', fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  childRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 3 },
  childNode: { zIndex: 1, width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.accentSoft },
  childBody: { flex: 1 },
  childName: { color: partnerTheme.colors.ink, fontSize: 9.5, fontWeight: '700' },
  childMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, fontSize: 7.5 },
  standalone: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 43, paddingHorizontal: 8, borderRadius: 11, backgroundColor: '#F5FBF7' },
  standaloneText: { flex: 1, color: '#5F7967', fontSize: 8.2, lineHeight: 12 },
  ownerRow: { marginTop: 9, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  ownerLabel: { color: partnerTheme.colors.inkMuted, fontSize: 7.5 },
  ownerValue: { flex: 1, textAlign: 'right', color: partnerTheme.colors.ink, fontSize: 8.5, fontWeight: '700' },
});
