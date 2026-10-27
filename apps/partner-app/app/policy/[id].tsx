import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerPolicyDetailIcon, type PartnerPolicyDetailIconKind } from '@/components/ui/partner-policy-detail-icon';
import { getPartnerPolicyDetail, getPartnerPolicyIntermediaryName, type PartnerPolicyDetail } from '@/lib/policies';
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
  const [intermediaryName, setIntermediaryName] = useState<string | null>(null);
  const [showOverviewDetails, setShowOverviewDetails] = useState(false);
  const [showPremiumDetails, setShowPremiumDetails] = useState(false);
  const [showCommercialDetails, setShowCommercialDetails] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const detail = await getPartnerPolicyDetail(id);
      setData(detail);
      setIntermediaryName(null);
      if (detail.commercial.intermediary_code) {
        // Name lookup is scoped by the same policy access check as policy details.
        void getPartnerPolicyIntermediaryName(id).then(setIntermediaryName).catch(() => setIntermediaryName(null));
      }
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
  const policyNumber = data?.policy.policy_no || data?.policy.policy_code || 'Policy';
  const isVerified = data ? ['active', 'issued', 'in_force', 'in force'].includes((data.policy.status || data.policy.lifecycle_status || '').toLowerCase().replaceAll('-', '_')) : false;

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
          <Ionicons name="document-text" size={23} color="#FFFFFF" />
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
                <View style={styles.policyNoRow}><Text numberOfLines={1} style={styles.summaryPolicyNo}>{policyNumber}</Text>{isVerified ? <Ionicons name="checkmark-circle" color="#22B57C" size={19} /> : null}</View>
              </View>
              <View style={styles.summaryBadges}>
                <View style={styles.categoryPill}><Ionicons name={data.vehicle ? "car" : "shield-checkmark"} color="#12498D" size={15}/><Text style={styles.categoryLabel}>{category}</Text></View>
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
                <View style={styles.periodTitleRow}><Text style={styles.periodLabel}>Policy Period</Text></View>
                <Text style={styles.periodValue}>{formatDate(data.policy.start_date)} – {formatDate(data.policy.end_date)}</Text>
              </View>
            </View>
          </View>

          <Card>
            <CardHeader iconKind="quick-actions" title="Quick Actions" />
            <View style={styles.quickGrid}>
              <QuickAction iconKind="policy-document" label="Policy Document" tone="blue" onPress={() => router.push('/policies' as never)} />
              <QuickAction iconKind="renew-policy" label="Renew Policy" tone="green" onPress={() => router.push('/renewals' as never)} />
              <QuickAction iconKind="raise-claim" label="Raise Claim" tone="orange" onPress={() => router.push('/claims' as never)} />
              <QuickAction iconKind="customer-details" label="Customer Details" tone="purple" onPress={() => data.customer.id ? router.push(`/customer/${data.customer.id}` as never) : undefined} />
            </View>
          </Card>

          <Card>
            <CardHeader iconKind="policy-overview" title="Policy Overview" actionLabel="View All" onAction={() => setShowOverviewDetails((value) => !value)} />
            <View style={styles.overviewGrid}>
              <OverviewItem iconKind="category" label="Category" value={category} />
              <OverviewItem iconKind="product" label="Product" value={data.policy.policy_product || data.policy.policy_type || data.policy.business_line || 'Not recorded'} />
              <OverviewItem iconKind="business-type" label="Business Type" value={data.policy.business_type || 'Not recorded'} />
              <OverviewItem iconKind="issuance-date" label="Issuance Date" value={formatDate(data.policy.issuance_date)} />
              <OverviewItem iconKind="idv" label="IDV" value={data.policy.insured_declared_value != null ? formatIndianCurrency(data.policy.insured_declared_value) : 'Not recorded'} />
              <OverviewItem iconKind="premium-breakup" label="Total Premium" value={nullableMoney(data.premium.gross_premium)} />
            </View>
            {showOverviewDetails ? (
              <View style={styles.detailGrid}>
                <OverviewItem iconKind="insurer" label="Insurer" value={data.insurer.name || 'Not recorded'} insurerName={data.insurer.name} />
                <MiniInfo label="Policy number" value={data.policy.policy_no || data.policy.policy_code || 'Not recorded'} />
                <MiniInfo label="Policy status" value={humanize(data.policy.status || data.policy.lifecycle_status)} />
                <MiniInfo label="Start date" value={formatDate(data.policy.start_date)} />
                <MiniInfo label="End date" value={formatDate(data.policy.end_date)} />
              </View>
            ) : null}
          </Card>

          <Card>
            <CardHeader iconKind="premium" title="Premium" actionLabel="View Breakup" onAction={() => setShowPremiumDetails((value) => !value)} />
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPremiumDetails }} onPress={() => setShowPremiumDetails((value) => !value)} style={({ pressed }) => [styles.premiumDisclosure, pressed && styles.pressed]}>
              <PartnerPolicyDetailIcon kind="premium-breakup" size={25} />
              <View style={styles.disclosureText}><Text style={styles.disclosureTitle}>Premium breakup</Text><Text style={styles.disclosureSummary}>{formatIndianCurrency(data.premium.gross_premium)}</Text></View>

            </Pressable>
            {showPremiumDetails ? (
              <View style={styles.premiumDetailGrid}>
                <MiniInfo compact label="Net premium" value={nullableMoney(data.premium.net_premium)} />
                <MiniInfo compact label="OD premium" value={nullableMoney(data.premium.od_premium)} />
                <MiniInfo compact label="TP premium" value={nullableMoney(data.premium.tp_premium)} />
                <MiniInfo compact label="GST" value={nullableMoney(data.premium.gst_amount)} />
                <MiniInfo compact label="CPA" value={data.premium.cpa_opted ? nullableMoney(data.premium.cpa_amount) : 'Not opted / not recorded'} />
              </View>
            ) : null}
          </Card>

          <Card>
            <CardHeader iconKind="customer-vehicle" title="Customer Details" actionLabel="View Details" onAction={data.customer.id ? () => router.push(`/customer/${data.customer.id}` as never) : undefined} />
            <View style={styles.entityStack}>
              <EntityRow icon="person-outline" title={data.customer.name} subtitle={data.customer.customer_code || 'Customer'} onPress={data.customer.id ? () => router.push(`/customer/${data.customer.id}` as never) : undefined} />
            </View>
          </Card>
          <Card>
            <CardHeader iconKind="customer-vehicle" title={data.vehicle ? 'Vehicle Details' : 'Insured Risk Details'} actionLabel="View Details" onAction={() => setShowVehicleDetails((value) => !value)} />
            <View style={styles.entityStack}>
              {data.vehicle ? (
                <EntityRow image={manufacturerLogo || PartnerAssets.products.motorInsurance} title={data.vehicle.vehicle_no || 'Vehicle'} subtitle={displayParts(data.vehicle.make, data.vehicle.model, data.vehicle.year) || humanize(data.vehicle.vehicle_type || 'vehicle')} onPress={() => setShowVehicleDetails((value) => !value)} />
              ) : (
                <EntityRow image={PartnerAssets.products.commercialInsurance} title={data.policy.policy_product || data.policy.policy_type || data.policy.business_line || 'Non-motor insured risk'} subtitle="No vehicle is linked to this policy." />
              )}
            </View>
            {showVehicleDetails ? (
              <View style={styles.detailGrid}>
                {data.vehicle ? (
                  <>
                    <MiniInfo label="Vehicle number" value={data.vehicle.vehicle_no || "Not recorded"} />
                    <MiniInfo label="Manufacturer" value={data.vehicle.make || "Not recorded"} />
                    <MiniInfo label="Model" value={data.vehicle.model || "Not recorded"} />
                    <MiniInfo label="Year" value={data.vehicle.year != null ? String(data.vehicle.year) : "Not recorded"} />
                    <MiniInfo label="Vehicle type" value={humanize(data.vehicle.vehicle_type || "")} />
                    <MiniInfo label="Commercial vehicle" value={data.vehicle.is_commercial == null ? "Not recorded" : data.vehicle.is_commercial ? "Yes" : "No"} />
                  </>
                ) : (
                  <MiniInfo label="Insured risk" value="No vehicle is linked to this policy." />
                )}
              </View>
            ) : null}
          </Card>

          <Card>
            <CardHeader iconKind="commercial-attribution" title="Commercial Attribution" actionLabel="View Details" onAction={() => setShowCommercialDetails((value) => !value)} />
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCommercialDetails }} onPress={() => setShowCommercialDetails((value) => !value)} style={({ pressed }) => [styles.commercialRow, pressed && styles.pressed]}>
              <PartnerPolicyDetailIcon kind="sales-ownership" size={25} />
              <View style={styles.disclosureText}><Text style={styles.disclosureTitle}>Sales ownership</Text><Text numberOfLines={1} style={styles.disclosureSummary}>{[data.commercial.rm_name, data.commercial.intermediary_code].filter(Boolean).join(' · ') || 'View details'}</Text></View>

            </Pressable>
            {showCommercialDetails ? (
              <View style={styles.detailGrid}>
                <MiniInfo label="Intermediary" value={intermediaryName || "Not recorded"} />
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

function CardHeader({ iconKind, title, actionLabel, onAction }: { iconKind: PartnerPolicyDetailIconKind; title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardHeaderLeft}><PartnerPolicyDetailIcon kind={iconKind} size={22} showBadge={false} /><Text style={styles.cardTitle}>{title}</Text></View>
      {actionLabel ? (
        <Pressable accessibilityRole="button" disabled={!onAction} onPress={onAction} hitSlop={8} style={({ pressed }) => [styles.cardHeaderAction, pressed && onAction ? styles.pressed : null]}>
          <Text style={styles.cardHeaderActionText}>{actionLabel}</Text><Ionicons name="chevron-forward" size={13} color="#0969CF" />
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickAction({ iconKind, label, onPress }: { iconKind: PartnerPolicyDetailIconKind; label: string; tone?: string; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, iconKind === "policy-document" ? styles.quickBlue : iconKind === "renew-policy" ? styles.quickGreen : iconKind === "raise-claim" ? styles.quickOrange : styles.quickPurple, pressed && styles.pressed]}><Ionicons name={iconKind === "policy-document" ? "document-text" : iconKind === "renew-policy" ? "sync" : iconKind === "raise-claim" ? "shield-checkmark" : "people"} size={25} color="#0879E9" /><Text numberOfLines={2} style={styles.quickLabel}>{label}</Text></Pressable>;
}

function OverviewItem({ iconKind, label, value, insurerName }: { iconKind: PartnerPolicyDetailIconKind; label: string; value: string; insurerName?: string | null }) {
  return <View style={styles.overviewItem}>{insurerName ? <View style={styles.overviewLogoWrap}><PartnerInsurerLogo name={insurerName} fallback={PartnerAssets.products.motorInsurance} style={styles.overviewLogo} /></View> : <PartnerPolicyDetailIcon kind={iconKind} size={21} tone="neutral" />}<View style={styles.overviewCopy}><Text style={styles.overviewLabel}>{label}</Text><Text numberOfLines={2} style={styles.overviewValue}>{value}</Text></View></View>;
}

function EntityRow({ image, icon, title, subtitle, onPress }: { image?: ImageSourcePropType; icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.entityRow, pressed && onPress ? styles.pressed : null]}><View style={styles.entityIcon}>{icon ? <Ionicons name={icon} size={20} color="#2468D7" /> : image ? <Image source={image} style={styles.entityArtwork} resizeMode="contain" /> : null}</View><View style={styles.entityBody}><Text numberOfLines={1} style={styles.entityTitle}>{title}</Text><Text numberOfLines={1} style={styles.entityMeta}>{subtitle}</Text></View></Pressable>;
}

function MiniInfo({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) { return <View style={[styles.miniInfo, compact && styles.miniInfoCompact]}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>; }
function policyArtwork(category: string): ImageSourcePropType { if (category === 'Motor') return PartnerAssets.products.motorInsurance; if (category === 'Health') return PartnerAssets.products.healthInsurance; if (category === 'Life') return PartnerAssets.products.familyInsurance; return PartnerAssets.products.commercialInsurance; }
function displayParts(...values: Array<string | number | null | undefined>) { return values.map((value) => value == null ? '' : String(value).trim()).filter((value) => value && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined').join(' · '); }
function policyCategory(data: PartnerPolicyDetail) { const value = [data.policy.policy_type, data.policy.policy_product, data.policy.business_line].filter(Boolean).join(' ').toLowerCase(); if (value.includes('health')) return 'Health'; if (value.includes('life')) return 'Life'; if (value.includes('motor') || data.vehicle) return 'Motor'; return 'Non-Motor'; }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string | null) { if (!value) return '—'; const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(d); }
function nullableMoney(value: number | string | null) { return value == null ? 'Not recorded' : formatIndianCurrency(value); }

const styles = StyleSheet.create({
  pageHeader: { height: 64, marginHorizontal: -partnerTheme.spacing.lg, overflow: 'hidden', paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#0756BB' },
  headerGlowOne: { position: 'absolute', width: 210, height: 150, borderRadius: 120, right: -42, top: -76, backgroundColor: 'rgba(38,142,238,0.30)' },
  headerGlowTwo: { position: 'absolute', width: 170, height: 120, borderRadius: 100, right: 68, top: 34, backgroundColor: 'rgba(14,99,197,0.28)' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBackButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '700', letterSpacing: -0.12 },
  stateWrap: { marginTop: 14 },
  contentWrap: { marginTop: 10, gap: 9, paddingBottom: 15 },
  summaryCard: { padding: 13, borderRadius: 15, backgroundColor: '#073472', shadowColor: '#052A60', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryArtworkWrap: { width: 43, height: 43, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  summaryArtwork: { width: 34, height: 34 },
  summaryBody: { flex: 1, minWidth: 0 },
  summaryPolicyNo: { color: '#FFFFFF', fontSize: 20, lineHeight: 25, fontWeight: '800', flexShrink: 1, minWidth: 0 },
  policyNoRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  categoryLabel: { color: '#16457D', fontSize: 10, fontWeight: '700' },
  periodIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1375DC' },
  summaryInsurer: { color: '#75849A', fontSize: 9, lineHeight: 12, marginTop: 2 },
  summaryBadges: { alignItems: 'flex-end', gap: 5 },
  summaryDivider: { height: 1, marginTop: 12, backgroundColor: '#6B89AD' },
  premiumRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', paddingTop: 7 },
  premiumBlock: { flex: 1 }, premiumLabel: { color: '#D5E5FA', fontSize: 9, lineHeight: 11 }, premiumValue: { marginTop: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '800', letterSpacing: -0.3 },
  periodDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 12, backgroundColor: '#6B89AD' },
  periodBlock: { flex: 1.03, minWidth: 0 }, periodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, periodLabel: { color: '#D5E5FA', fontSize: 9, lineHeight: 11 }, periodValue: { marginTop: 2, color: '#FFFFFF', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },
  card: { overflow: 'hidden', borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F1', backgroundColor: '#FFFFFF' },
  cardHeader: { minHeight: 37, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 }, cardTitle: { color: '#102A51', fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  cardHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 1, minHeight: 32, paddingLeft: 8 }, cardHeaderActionText: { color: '#0969CF', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  quickGrid: { flexDirection: 'row', gap: 0, paddingHorizontal: 9, paddingBottom: 9 },
  quickAction: { flex: 1, borderRadius: 9, marginHorizontal: 2, minHeight: 61, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 3, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#DCE7F3' },
  quickBlue: { backgroundColor: '#EAF5FF' }, quickGreen: { backgroundColor: '#E9F8F2' }, quickOrange: { backgroundColor: '#FFF1E6' }, quickPurple: { backgroundColor: '#F0EBFF' },
  quickLabel: { color: '#17304F', textAlign: 'center', fontSize: 8.5, lineHeight: 11, fontWeight: '700' },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: 9, paddingBottom: 9 },
  overviewItem: { width: '49%', flexGrow: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE7F3', borderRadius: 9 },
  overviewLogoWrap: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#F0F5FC', alignItems: 'center', justifyContent: 'center' }, overviewLogo: { width: 27, height: 27 }, overviewCopy: { flex: 1, minWidth: 0 }, overviewLabel: { color: '#8A95A6', fontSize: 8.5, lineHeight: 10 }, overviewValue: { marginTop: 2, color: '#192B46', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  premiumDisclosure: { minHeight: 47, marginHorizontal: 9, marginBottom: 8, paddingHorizontal: 9, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF' },
  commercialRow: { minHeight: 47, marginHorizontal: 9, marginBottom: 8, paddingHorizontal: 9, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF' },
  disclosureText: { flex: 1, minWidth: 0 }, disclosureTitle: { color: '#152945', fontSize: 10.5, lineHeight: 13, fontWeight: '700' }, disclosureSummary: { marginTop: 2, color: '#6F7F94', fontSize: 8.5, lineHeight: 11 },
  premiumDetailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingBottom: 10 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10, paddingBottom: 10 }, miniInfo: { width: '47%', minHeight: 38, padding: 7, borderRadius: 8, backgroundColor: '#F7F9FC' }, miniLabel: { color: '#8A95A6', fontSize: 8, lineHeight: 10, textTransform: 'uppercase' }, miniValue: { marginTop: 2, color: '#21334E', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },
  miniInfoCompact: { width: '31%', flexGrow: 1, minWidth: 0, paddingHorizontal: 5 },
  entityStack: { paddingHorizontal: 10, paddingBottom: 8 }, entityRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDF1F6' }, entityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF5FF' }, entityArtwork: { width: 27, height: 27 }, entityBody: { flex: 1, minWidth: 0 }, entityTitle: { color: '#142A49', fontSize: 10, lineHeight: 13, fontWeight: '800' }, entityMeta: { marginTop: 2, color: '#7C899B', fontSize: 8.5, lineHeight: 11 },
  pressed: { opacity: 0.68 },
});