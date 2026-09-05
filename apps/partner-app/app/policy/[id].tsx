import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { getPartnerPolicyDetail, type PartnerPolicyDetail } from '@/lib/policies';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function PolicyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PartnerPolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPremiumDetails, setShowPremiumDetails] = useState(false);
  const [showCommercialDetails, setShowCommercialDetails] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerPolicyDetail(id));
    } catch {
      setError('This policy could not be loaded in your Partner scope.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const category = data ? policyCategory(data) : 'Policy';

  return (
    <PartnerScreen eyebrow="BUSINESS" title="Policy" onBack={() => router.back()}>
      {loading ? (
        <PartnerStateView state="loading" title="Loading policy" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Policy unavailable" message={error || 'This policy could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroArtworkWrap}><Image source={policyArtwork(category)} style={styles.heroArtwork} resizeMode="contain" /></View>
              <View style={styles.heroBody}>
                <Text style={styles.heroNo}>{data.policy.policy_no || data.policy.policy_code || 'Policy'}</Text>
                <Text style={styles.heroInsurer}>{data.insurer.name || 'Insurer not recorded'}</Text>
              </View>
              <View style={styles.heroBadges}>
                <PartnerStatusBadge label={category} tone="brand" />
                <PartnerStatusBadge label={humanize(data.policy.lifecycle_status)} tone={lifecycleTone(data.policy.lifecycle_status)} />
              </View>
            </View>
            <View style={styles.heroPremiumRow}>
              <View><Text style={styles.heroPremium}>{formatIndianCurrency(data.premium.gross_premium)}</Text><Text style={styles.heroPremiumLabel}>gross premium</Text></View>
              <View style={styles.heroDateBlock}><Text style={styles.heroDate}>{formatDate(data.policy.start_date)} → {formatDate(data.policy.end_date)}</Text><Text style={styles.heroDateLabel}>{data.policy.business_type || data.policy.policy_product || data.policy.policy_type || 'Policy term'}</Text></View>
            </View>
          </View>

          <PartnerSectionHeader title="Policy overview" />
          <InfoCard>
            <Info label="Category" value={category} /><Info label="Product" value={data.policy.policy_product || data.policy.policy_type || data.policy.business_line || 'Not recorded'} /><Info label="Business type" value={data.policy.business_type || 'Not recorded'} /><Info label="Issuance" value={formatDate(data.policy.issuance_date)} /><Info label="Status" value={humanize(data.policy.status || data.policy.lifecycle_status)} /><Info label="IDV" value={data.policy.insured_declared_value != null ? formatIndianCurrency(data.policy.insured_declared_value) : 'Not recorded'} />
          </InfoCard>

          <PartnerSectionHeader title="Premium" />
          <Disclosure title="Premium breakup" summary={formatIndianCurrency(data.premium.gross_premium)} expanded={showPremiumDetails} onPress={() => setShowPremiumDetails((value) => !value)}>
            <InfoCard><Info label="Net premium" value={nullableMoney(data.premium.net_premium)} /><Info label="OD premium" value={nullableMoney(data.premium.od_premium)} /><Info label="TP premium" value={nullableMoney(data.premium.tp_premium)} /><Info label="GST" value={nullableMoney(data.premium.gst_amount)} /><Info label="CPA" value={data.premium.cpa_opted ? nullableMoney(data.premium.cpa_amount) : 'Not opted / not recorded'} /></InfoCard>
          </Disclosure>

          <PartnerSectionHeader title={data.vehicle ? 'Customer & vehicle' : 'Customer & insured risk'} />
          <View style={styles.entityStack}>
            <Pressable accessibilityRole={data.customer.id ? 'button' : undefined} disabled={!data.customer.id} onPress={() => data.customer.id ? router.push(`/customer/${data.customer.id}` as never) : undefined} style={({ pressed }) => [styles.entity, pressed && data.customer.id ? styles.pressed : null]}>
              <View style={styles.entityArtworkWrap}><Image source={PartnerAssets.navigation.customers} style={styles.entityArtwork} resizeMode="contain" /></View>
              <View style={styles.entityBody}><Text style={styles.entityTitle}>{data.customer.name}</Text><Text style={styles.entityMeta}>{data.customer.customer_code || 'Customer'}</Text></View>
              {data.customer.id ? <Ionicons name="chevron-forward" size={16} color="#9AA3B2" /> : null}
            </Pressable>
            {data.vehicle ? (
              <View style={styles.entity}><View style={styles.entityArtworkWrap}><Image source={PartnerAssets.products.motorInsurance} style={styles.entityArtwork} resizeMode="contain" /></View><View style={styles.entityBody}><Text style={styles.entityTitle}>{data.vehicle.vehicle_no || 'Vehicle'}</Text><Text style={styles.entityMeta}>{displayParts(data.vehicle.make, data.vehicle.model, data.vehicle.year) || humanize(data.vehicle.vehicle_type || 'vehicle')}</Text></View></View>
            ) : (
              <View style={styles.entity}><View style={styles.entityArtworkWrap}><Image source={PartnerAssets.products.commercialInsurance} style={styles.entityArtwork} resizeMode="contain" /></View><View style={styles.entityBody}><Text style={styles.entityTitle}>{data.policy.policy_product || data.policy.policy_type || data.policy.business_line || 'Non-motor insured risk'}</Text><Text style={styles.entityMeta}>No vehicle is linked to this policy.</Text></View></View>
            )}
          </View>

          <PartnerSectionHeader title="Commercial attribution" />
          <Disclosure title="Sales ownership" summary={[data.commercial.rm_name, data.commercial.intermediary_code].filter(Boolean).join(' · ') || 'View details'} expanded={showCommercialDetails} onPress={() => setShowCommercialDetails((value) => !value)}>
            <InfoCard><Info label="Intermediary" value={[humanize(data.commercial.intermediary_type || ''), data.commercial.intermediary_code].filter(Boolean).join(' · ') || 'Not recorded'} /><Info label="RM" value={data.commercial.rm_name || 'Not recorded'} /><Info label="Group" value={[data.commercial.group_name, data.commercial.group_code].filter(Boolean).join(' · ') || 'No policy snapshot'} /><Info label="Policy lifecycle" value={humanize(data.policy.lifecycle_status)} /></InfoCard>
          </Disclosure>
        </>
      )}
    </PartnerScreen>
  );
}

function Disclosure({ title, summary, expanded, onPress, children }: { title: string; summary: string; expanded: boolean; onPress: () => void; children: ReactNode }) {
  return <View><Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${title}`} onPress={onPress} style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}><View style={styles.disclosureBody}><Text style={styles.disclosureTitle}>{title}</Text><Text numberOfLines={1} style={styles.disclosureSummary}>{summary}</Text></View><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={partnerTheme.colors.brand} /></Pressable>{expanded ? <View style={styles.disclosureContent}>{children}</View> : null}</View>;
}
function InfoCard({ children }: { children: ReactNode }) { return <View style={styles.infoCard}>{children}</View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function policyArtwork(category: string): ImageSourcePropType { if (category === 'Motor') return PartnerAssets.products.motorInsurance; if (category === 'Health') return PartnerAssets.products.healthInsurance; if (category === 'Life') return PartnerAssets.products.familyInsurance; return PartnerAssets.products.commercialInsurance; }
function displayParts(...values: Array<string | number | null | undefined>) { return values.map((value) => value == null ? '' : String(value).trim()).filter((value) => value && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined').join(' · '); }
function policyCategory(data: PartnerPolicyDetail) { const value = [data.policy.policy_type, data.policy.policy_product, data.policy.business_line].filter(Boolean).join(' ').toLowerCase(); if (value.includes('health')) return 'Health'; if (value.includes('life')) return 'Life'; if (value.includes('motor') || data.vehicle) return 'Motor'; return 'Non-Motor'; }
function lifecycleTone(value: PartnerPolicyDetail['policy']['lifecycle_status']): 'success' | 'warning' | 'danger' | 'info' { if (value === 'expired') return 'danger'; if (value === 'expiring') return 'warning'; if (value === 'upcoming') return 'info'; return 'success'; }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string | null) { if (!value) return '—'; const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(d); }
function nullableMoney(value: number | string | null) { return value == null ? 'Not recorded' : formatIndianCurrency(value); }

const styles = StyleSheet.create({
  hero: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line }, heroTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, heroArtworkWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, heroArtwork: { width: 42, height: 42 }, heroBody: { flex: 1 }, heroNo: { color: partnerTheme.colors.ink, ...partnerTheme.typography.sectionTitle }, heroInsurer: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption }, heroBadges: { alignItems: 'flex-end', gap: 5 }, heroPremiumRow: { marginTop: 10, paddingTop: 9, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line }, heroPremium: { color: partnerTheme.colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '600' }, heroPremiumLabel: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta }, heroDateBlock: { flex: 1, alignItems: 'flex-end' }, heroDate: { color: partnerTheme.colors.ink, textAlign: 'right', ...partnerTheme.typography.caption }, heroDateLabel: { marginTop: 3, color: partnerTheme.colors.inkMuted, textAlign: 'right', ...partnerTheme.typography.meta }, disclosure: { minHeight: partnerTheme.control.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 10, backgroundColor: partnerTheme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line }, disclosureBody: { flex: 1 }, disclosureTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong }, disclosureSummary: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption }, disclosureContent: { marginTop: 7 }, infoCard: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 9, paddingVertical: 8, backgroundColor: partnerTheme.colors.surface }, info: { width: '50%', paddingRight: 8 }, infoLabel: { color: '#8A94A6', textTransform: 'uppercase', letterSpacing: 0.5, ...partnerTheme.typography.meta }, infoValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption }, entityStack: { gap: 0 }, entity: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, backgroundColor: partnerTheme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line }, entityArtworkWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, entityArtwork: { width: 38, height: 38 }, entityBody: { flex: 1 }, entityTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong }, entityMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption }, pressed: { backgroundColor: partnerTheme.colors.pressed },
});
