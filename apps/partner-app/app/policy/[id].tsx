import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { getPartnerPolicyDetail, type PartnerPolicyDetail } from '@/lib/policies';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { partnerTheme } from '@/lib/theme';

export default function PolicyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PartnerPolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOverviewDetails, setShowOverviewDetails] = useState(false);
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

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  const category = data ? policyCategory(data) : 'Policy';
  const manufacturerLogo = data?.vehicle ? getPartnerManufacturerLogoSource(data.vehicle.make) : null;

  return (
    <PartnerScreen title="Policy Details" hideTopBar>
      <View style={styles.pageHeader}>
        <View style={styles.headerGlowOne} />
        <View style={styles.headerGlowTwo} />
        <View style={styles.headerTitleRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Policy Details</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.stateWrap}><PartnerStateView state="loading" title="Loading policy" /></View>
      ) : error || !data ? (
        <View style={styles.stateWrap}><PartnerStateView state="error" title="Policy unavailable" message={error || 'This policy could not be loaded.'} actionLabel="Try again" onAction={() => void load()} /></View>
      ) : (
        <View style={styles.contentWrap}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryArtworkWrap}>
                <PartnerInsurerLogo name={data.insurer.name} fallback={policyArtwork(category)} style={styles.summaryArtwork} />
              </View>
              <View style={styles.summaryBody}>
                <Text numberOfLines={1} style={styles.summaryPolicyNo}>{data.policy.policy_no || data.policy.policy_code || 'Policy'}</Text>
              </View>
              <View style={styles.summaryBadges}>
                <PartnerStatusBadge label={category} tone="brand" />
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.premiumRow}>
              <View style={styles.premiumBlock}>
                <Text style={styles.premiumLabel}>Net Premium</Text>
                <Text style={styles.premiumValue}>{nullableMoney(data.premium.net_premium)}</Text>
              </View>
              <View style={styles.periodDivider} />
              <View style={styles.periodBlock}>
                <View style={styles.periodTitleRow}><Ionicons name="calendar-outline" size={15} color="#1686E8" /><Text style={styles.periodLabel}>Policy Period</Text></View>
                <Text style={styles.periodValue}>{formatDate(data.policy.start_date)} – {formatDate(data.policy.end_date)}</Text>
              </View>
            </View>
          </View>

          <Card>
            <CardHeader icon="document-text-outline" title="Quick Actions" actionLabel="View More" onAction={() => router.push('/policies' as never)} />
            <View style={styles.quickGrid}>
              <QuickAction icon="document-text-outline" label="Policy Document" tone="blue" onPress={() => router.push('/policies' as never)} />
              <QuickAction icon="sync-outline" label="Renew Policy" tone="green" onPress={() => router.push('/renewals' as never)} />
              <QuickAction icon="shield-checkmark-outline" label="Raise Claim" tone="orange" onPress={() => router.push('/claims' as never)} />
              <QuickAction icon="people-outline" label="Customer Details" tone="purple" onPress={() => data.customer.id ? router.push(`/customer/${data.customer.id}` as never) : undefined} />
            </View>
          </Card>

          <Card>
            <CardHeader icon="document-text-outline" title="Policy Overview" actionLabel="View All" onAction={() => setShowOverviewDetails((value) => !value)} />
            <View style={styles.overviewGrid}>
              <OverviewItem icon="grid-outline" label="Category" value={category} />
              <OverviewItem icon="cube-outline" label="Product" value={data.policy.policy_product || data.policy.policy_type || data.policy.business_line || 'Not recorded'} />
              <OverviewItem icon="briefcase-outline" label="Business Type" value={data.policy.business_type || 'Not recorded'} />
              <OverviewItem icon="calendar-outline" label="Issuance Date" value={formatDate(data.policy.issuance_date)} />
              <OverviewItem icon="business-outline" label="Insurer" value={data.insurer.name || 'Not recorded'} />
              <OverviewItem icon="cash-outline" label="IDV" value={data.policy.insured_declared_value != null ? formatIndianCurrency(data.policy.insured_declared_value) : 'Not recorded'} />
            </View>
            {showOverviewDetails ? (
              <View style={styles.detailGrid}>
                <MiniInfo label="Policy number" value={data.policy.policy_no || data.policy.policy_code || 'Not recorded'} />
                <MiniInfo label="Policy status" value={humanize(data.policy.status || data.policy.lifecycle_status)} />
                <MiniInfo label="Start date" value={formatDate(data.policy.start_date)} />
                <MiniInfo label="End date" value={formatDate(data.policy.end_date)} />
              </View>
            ) : null}
          </Card>

          <Card>
            <CardHeader icon="wallet-outline" title="Premium" />
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPremiumDetails }} onPress={() => setShowPremiumDetails((value) => !value)} style={({ pressed }) => [styles.premiumDisclosure, pressed && styles.pressed]}>
              <View style={styles.roundIcon}><Ionicons name="cash-outline" size={20} color="#1889EE" /></View>
              <View style={styles.disclosureText}><Text style={styles.disclosureTitle}>Premium breakup</Text><Text style={styles.disclosureSummary}>{formatIndianCurrency(data.premium.gross_premium)}</Text></View>
              <Ionicons name={showPremiumDetails ? 'chevron-up' : 'chevron-forward'} size={17} color="#2468D7" />
            </Pressable>
            {showPremiumDetails ? (
              <View style={styles.detailGrid}>
                <MiniInfo label="Net premium" value={nullableMoney(data.premium.net_premium)} />
                <MiniInfo label="OD premium" value={nullableMoney(data.premium.od_premium)} />
                <MiniInfo label="TP premium" value={nullableMoney(data.premium.tp_premium)} />
                <MiniInfo label="GST" value={nullableMoney(data.premium.gst_amount)} />
                <MiniInfo label="CPA" value={data.premium.cpa_opted ? nullableMoney(data.premium.cpa_amount) : 'Not opted / not recorded'} />
              </View>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              icon="people-outline"
              title={data.vehicle ? 'Customer & Vehicle' : 'Customer & Insured Risk'}
              actionLabel="View Details"
              onAction={data.customer.id ? () => router.push(`/customer/${data.customer.id}` as never) : undefined}
            />
            <View style={styles.entityStack}>
              <EntityRow
                image={PartnerAssets.navigation.customers}
                title={data.customer.name}
                subtitle={data.customer.customer_code || 'Customer'}
                onPress={data.customer.id ? () => router.push(`/customer/${data.customer.id}` as never) : undefined}
              />
              {data.vehicle ? (
                <EntityRow
                  image={manufacturerLogo || PartnerAssets.products.motorInsurance}
                  title={data.vehicle.vehicle_no || 'Vehicle'}
                  subtitle={displayParts(data.vehicle.make, data.vehicle.model, data.vehicle.year) || humanize(data.vehicle.vehicle_type || 'vehicle')}
                  onPress={data.customer.id ? () => router.push(`/customer/${data.customer.id}` as never) : undefined}
                />
              ) : (
                <EntityRow image={PartnerAssets.products.commercialInsurance} title={data.policy.policy_product || data.policy.policy_type || data.policy.business_line || 'Non-motor insured risk'} subtitle="No vehicle is linked to this policy." />
              )}
            </View>
          </Card>

          <Card>
            <CardHeader icon="stats-chart-outline" title="Commercial Attribution" />
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCommercialDetails }} onPress={() => setShowCommercialDetails((value) => !value)} style={({ pressed }) => [styles.commercialRow, pressed && styles.pressed]}>
              <View style={styles.roundIcon}><Ionicons name="briefcase-outline" size={20} color="#1889EE" /></View>
              <View style={styles.disclosureText}><Text style={styles.disclosureTitle}>Sales ownership</Text><Text numberOfLines={1} style={styles.disclosureSummary}>{[data.commercial.rm_name, data.commercial.intermediary_code].filter(Boolean).join(' · ') || 'View details'}</Text></View>
              <Ionicons name={showCommercialDetails ? 'chevron-up' : 'chevron-forward'} size={17} color="#2468D7" />
            </Pressable>
            {showCommercialDetails ? (
              <View style={styles.detailGrid}>
                <MiniInfo label="Intermediary" value={[humanize(data.commercial.intermediary_type || ''), data.commercial.intermediary_code].filter(Boolean).join(' · ') || 'Not recorded'} />
                <MiniInfo label="RM" value={data.commercial.rm_name || 'Not recorded'} />
                <MiniInfo label="Group" value={[data.commercial.group_name, data.commercial.group_code].filter(Boolean).join(' · ') || 'No policy snapshot'} />
                <MiniInfo label="Policy lifecycle" value={humanize(data.policy.lifecycle_status)} />
              </View>
            ) : null}
          </Card>
        </View>
      )}
    </PartnerScreen>
  );
}

function Card({ children }: { children: ReactNode }) { return <View style={styles.card}>{children}</View>; }

function CardHeader({ icon, title, actionLabel, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardHeaderLeft}><Ionicons name={icon} size={17} color="#1686E8" /><Text style={styles.cardTitle}>{title}</Text></View>
      {actionLabel ? (
        <Pressable accessibilityRole="button" disabled={!onAction} onPress={onAction} hitSlop={8} style={({ pressed }) => [styles.cardHeaderAction, pressed && onAction ? styles.pressed : null]}>
          <Text style={styles.cardHeaderActionText}>{actionLabel}</Text><Ionicons name="chevron-forward" size={13} color="#6D46CE" />
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickAction({ icon, label, tone, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; tone: 'blue' | 'green' | 'orange' | 'purple'; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, quickToneStyle(tone), pressed && styles.pressed]}><Ionicons name={icon} size={25} color={quickToneColor(tone)} /><Text numberOfLines={2} style={styles.quickLabel}>{label}</Text></Pressable>;
}

function OverviewItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.overviewItem}><View style={styles.overviewIcon}><Ionicons name={icon} size={17} color="#4F6D9D" /></View><View style={styles.overviewCopy}><Text style={styles.overviewLabel}>{label}</Text><Text numberOfLines={2} style={styles.overviewValue}>{value}</Text></View></View>;
}

function EntityRow({ image, title, subtitle, onPress }: { image: ImageSourcePropType; title: string; subtitle: string; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.entityRow, pressed && onPress ? styles.pressed : null]}><View style={styles.entityIcon}><Image source={image} style={styles.entityArtwork} resizeMode="contain" /></View><View style={styles.entityBody}><Text numberOfLines={1} style={styles.entityTitle}>{title}</Text><Text numberOfLines={1} style={styles.entityMeta}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={16} color="#8B9AAE" /></Pressable>;
}

function MiniInfo({ label, value }: { label: string; value: string }) { return <View style={styles.miniInfo}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>; }
function quickToneColor(tone: 'blue' | 'green' | 'orange' | 'purple') { if (tone === 'green') return '#19A477'; if (tone === 'orange') return '#E7802F'; if (tone === 'purple') return '#6A43D6'; return '#187FD6'; }
function quickToneStyle(tone: 'blue' | 'green' | 'orange' | 'purple') { if (tone === 'green') return styles.quickGreen; if (tone === 'orange') return styles.quickOrange; if (tone === 'purple') return styles.quickPurple; return styles.quickBlue; }
function policyArtwork(category: string): ImageSourcePropType { if (category === 'Motor') return PartnerAssets.products.motorInsurance; if (category === 'Health') return PartnerAssets.products.healthInsurance; if (category === 'Life') return PartnerAssets.products.familyInsurance; return PartnerAssets.products.commercialInsurance; }
function displayParts(...values: Array<string | number | null | undefined>) { return values.map((value) => value == null ? '' : String(value).trim()).filter((value) => value && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined').join(' · '); }
function policyCategory(data: PartnerPolicyDetail) { const value = [data.policy.policy_type, data.policy.policy_product, data.policy.business_line].filter(Boolean).join(' ').toLowerCase(); if (value.includes('health')) return 'Health'; if (value.includes('life')) return 'Life'; if (value.includes('motor') || data.vehicle) return 'Motor'; return 'Non-Motor'; }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string | null) { if (!value) return '—'; const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(d); }
function nullableMoney(value: number | string | null) { return value == null ? 'Not recorded' : formatIndianCurrency(value); }

const styles = StyleSheet.create({
  pageHeader: { height: 92, marginHorizontal: -partnerTheme.spacing.lg, overflow: 'hidden', paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#0758B6' },
  headerGlowOne: { position: 'absolute', width: 210, height: 150, borderRadius: 120, right: -42, top: -76, backgroundColor: 'rgba(38,142,238,0.30)' },
  headerGlowTwo: { position: 'absolute', width: 170, height: 120, borderRadius: 100, right: 68, top: 34, backgroundColor: 'rgba(14,99,197,0.28)' },
  headerTitleRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBackButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '700', letterSpacing: -0.12 },
  stateWrap: { marginTop: 14 },
  contentWrap: { marginTop: -31, gap: 10, paddingBottom: 8 },
  summaryCard: { padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DEE6F1', backgroundColor: '#FFFFFF', shadowColor: '#14345E', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryArtworkWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  summaryArtwork: { width: 40, height: 40 },
  summaryBody: { flex: 1, minWidth: 0 },
  summaryPolicyNo: { color: '#0F213F', fontSize: 15, lineHeight: 19, fontWeight: '800' },
  summaryBadges: { alignItems: 'flex-end', gap: 5 },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginTop: 11, backgroundColor: '#E7ECF4' },
  premiumRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingTop: 9 },
  premiumBlock: { flex: 1 }, premiumLabel: { color: '#79879B', fontSize: 9, lineHeight: 11 }, premiumValue: { marginTop: 1, color: '#092C62', fontSize: 21, lineHeight: 25, fontWeight: '800', letterSpacing: -0.3 },
  periodDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 12, backgroundColor: '#E0E6F0' },
  periodBlock: { flex: 1.03, minWidth: 0 }, periodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, periodLabel: { color: '#7B8797', fontSize: 9, lineHeight: 11 }, periodValue: { marginTop: 2, color: '#12233E', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },
  card: { overflow: 'hidden', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F1', backgroundColor: '#FFFFFF', shadowColor: '#17365F', shadowOpacity: 0.035, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardHeader: { minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 }, cardTitle: { color: '#102A51', fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  cardHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 1, minHeight: 32, paddingLeft: 8 }, cardHeaderActionText: { color: '#6C46CC', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  quickGrid: { flexDirection: 'row', gap: 7, paddingHorizontal: 10, paddingBottom: 10 },
  quickAction: { flex: 1, minHeight: 71, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  quickBlue: { backgroundColor: '#EAF5FF' }, quickGreen: { backgroundColor: '#E9F8F2' }, quickOrange: { backgroundColor: '#FFF1E6' }, quickPurple: { backgroundColor: '#F0EBFF' },
  quickLabel: { color: '#17304F', textAlign: 'center', fontSize: 8.5, lineHeight: 11, fontWeight: '700' },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 8 },
  overviewItem: { width: '50%', minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDF1F6' },
  overviewIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F8FC' }, overviewCopy: { flex: 1, minWidth: 0 }, overviewLabel: { color: '#8A95A6', fontSize: 8.5, lineHeight: 10 }, overviewValue: { marginTop: 2, color: '#192B46', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  premiumDisclosure: { minHeight: 58, marginHorizontal: 10, marginBottom: 9, paddingHorizontal: 9, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#F2F7FF' },
  commercialRow: { minHeight: 58, marginHorizontal: 10, marginBottom: 9, paddingHorizontal: 9, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FAFCFF' },
  roundIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F2FF' }, disclosureText: { flex: 1, minWidth: 0 }, disclosureTitle: { color: '#152945', fontSize: 10.5, lineHeight: 13, fontWeight: '700' }, disclosureSummary: { marginTop: 2, color: '#6F7F94', fontSize: 8.5, lineHeight: 11 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10, paddingBottom: 10 }, miniInfo: { width: '47%', minHeight: 38, padding: 7, borderRadius: 8, backgroundColor: '#F7F9FC' }, miniLabel: { color: '#8A95A6', fontSize: 8, lineHeight: 10, textTransform: 'uppercase' }, miniValue: { marginTop: 2, color: '#21334E', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },
  entityStack: { paddingHorizontal: 10, paddingBottom: 9 }, entityRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDF1F6' }, entityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF5FF' }, entityArtwork: { width: 27, height: 27 }, entityBody: { flex: 1, minWidth: 0 }, entityTitle: { color: '#142A49', fontSize: 10, lineHeight: 13, fontWeight: '800' }, entityMeta: { marginTop: 2, color: '#7C899B', fontSize: 8.5, lineHeight: 11 },
  pressed: { opacity: 0.68 },
});