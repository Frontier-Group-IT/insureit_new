import { formatAppDate } from '@/lib/indian-date';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
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
  const [showPremiumDetails, setShowPremiumDetails] = useState(true);
  const [showCommercialDetails, setShowCommercialDetails] = useState(true);

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
    <PartnerScreen title="Policy Details" hideTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation activeTab="Policies" />}>
      <View style={styles.pageHeader}>
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
                <View style={styles.policyNoRow}><Text numberOfLines={1} style={styles.summaryPolicyNo}>{policyNumber}</Text>{isVerified ? <Ionicons name="checkmark-circle" color="#38D99C" size={19} /> : null}</View>
                <Text style={styles.summaryNetPremium}>Net Premium - {nullableMoney(data.premium.net_premium)}</Text>
              </View>
              <View style={styles.summaryBadges}>
                <View style={styles.categoryPill}><Ionicons name={data.vehicle ? "car" : "shield-checkmark"} color="#12498D" size={15}/><Text style={styles.categoryLabel}>{category}</Text></View>
                <Text style={styles.periodValue}>{formatDate(data.policy.start_date)} – {formatDate(data.policy.end_date)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickSection}>
            <Text style={styles.quickSectionHeading}>Quick Actions</Text>
            <View style={styles.quickGrid}>
              <QuickAction iconKind="policy-document" label="Policy Document" onPress={() => router.push('/policies' as never)} />
              <QuickAction iconKind="renew-policy" label="Renew Policy" onPress={() => router.push('/renewals' as never)} />
              <QuickAction iconKind="raise-claim" label="Raise Claim" onPress={() => router.push('/claims' as never)} />
              <QuickAction iconKind="customer-details" label="Customer Details" onPress={() => data.customer.id ? router.push(`/customer/${data.customer.id}` as never) : undefined} />
            </View>
          </View>

          <View style={styles.externalSection}>
            <View style={styles.externalSectionHeading}><CardHeader title="Customer & Vehicle Details" /></View>
            <Card>
              <Pressable
                accessibilityRole={data.customer.id ? "button" : undefined}
                disabled={!data.customer.id}
                accessibilityLabel={data.vehicle ? `Open customer details: ${data.customer.name}, ${data.vehicle.vehicle_no || "vehicle"}` : `Open customer details: ${data.customer.name}`}
                onPress={data.customer.id ? () => router.push(`/customer/${data.customer.id}` as never) : undefined}
                style={({ pressed }) => [styles.customerVehicleRow, pressed && data.customer.id ? styles.pressed : null]}
              >
                <View style={styles.entityIcon}>
                  <Image
                    source={data.vehicle ? (manufacturerLogo || PartnerAssets.products.motorInsurance) : PartnerAssets.products.commercialInsurance}
                    style={styles.entityArtwork}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.entityBody}>
                  <View style={styles.customerVehicleTitleRow}>
                    <Text numberOfLines={1} style={styles.entityTitle}>{data.customer.name || "Customer"}</Text>
                    {data.vehicle?.vehicle_no ? (
                      <Text numberOfLines={1} style={styles.customerVehicleRegistration}>|  {data.vehicle.vehicle_no}</Text>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={styles.entityMeta}>
                    {data.vehicle
                      ? displayParts(data.vehicle.make, data.vehicle.model, data.vehicle.year) || humanize(data.vehicle.vehicle_type || "vehicle")
                      : data.policy.policy_product || data.policy.policy_type || data.policy.business_line || "Non-motor insured risk"}
                  </Text>
                </View>
              </Pressable>
            </Card>
          </View>

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
            <View style={styles.unifiedSectionDivider} />
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPremiumDetails }} onPress={() => setShowPremiumDetails((value) => !value)} style={({ pressed }) => [styles.premiumDisclosure, pressed && styles.pressed]}>
              <PartnerPolicyDetailIcon kind="premium-breakup" size={22} showBadge={false} />
              <View style={styles.disclosureText}><Text style={styles.cardTitle}>Premium breakup</Text><Text style={styles.disclosureSummary}>{formatIndianCurrency(data.premium.gross_premium)}</Text></View>

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
            <View style={styles.unifiedSectionDivider} />
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCommercialDetails }} onPress={() => setShowCommercialDetails((value) => !value)} style={({ pressed }) => [styles.commercialRow, pressed && styles.pressed]}>
              <PartnerPolicyDetailIcon kind="sales-ownership" size={22} showBadge={false} />
              <View style={styles.disclosureText}><Text style={styles.cardTitle}>Sales ownership</Text><Text numberOfLines={1} style={styles.disclosureSummary}>{[data.commercial.rm_name, data.commercial.intermediary_code].filter(Boolean).join(' · ') || 'View details'}</Text></View>

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

function Card({ children, onPress, accessibilityLabel }: { children: ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  if (onPress) return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>{children}</Pressable>;
  return <View style={styles.card}>{children}</View>;
}

function CardHeader({ iconKind, title, actionLabel, onAction }: { iconKind?: PartnerPolicyDetailIconKind; title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardHeaderLeft}>{iconKind ? <PartnerPolicyDetailIcon kind={iconKind} size={22} showBadge={false} /> : null}<Text style={styles.cardTitle}>{title}</Text></View>
      {actionLabel ? (
        <Pressable accessibilityRole="button" disabled={!onAction} onPress={onAction} hitSlop={8} style={({ pressed }) => [styles.cardHeaderAction, pressed && onAction ? styles.pressed : null]}>
          <Text style={styles.cardHeaderActionText}>{actionLabel}</Text><Ionicons name="chevron-forward" size={13} color="#0969CF" />
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickAction({ iconKind, label, onPress }: {
  iconKind: PartnerPolicyDetailIconKind; label: string; onPress: () => void;
}) {
  // Reuse the exact Home quick-action artwork for Renewals and Claims.
  // Keep the existing Policy Document / Customer Details assets unchanged.
  const illustration = iconKind === 'renew-policy'
    ? PartnerAssets.actions.quickRenewals
    : iconKind === 'raise-claim'
      ? PartnerAssets.actions.quickClaims
      : iconKind === 'policy-document'
        ? require('../../assets/partner/quick-actions/policy-document.png')
        : require('../../assets/partner/quick-actions/customer-details.png');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={styles.quickActionIcon}>
        <Image source={illustration} style={iconKind === 'renew-policy' || iconKind === 'raise-claim' ? styles.quickActionArtworkCompact : styles.quickActionArtwork} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function OverviewItem({ iconKind, label, value, insurerName }: { iconKind: PartnerPolicyDetailIconKind; label: string; value: string; insurerName?: string | null }) {
  return <View style={styles.overviewItem}>{insurerName ? <View style={styles.overviewLogoWrap}><PartnerInsurerLogo name={insurerName} fallback={PartnerAssets.products.motorInsurance} style={styles.overviewLogo} /></View> : <PartnerPolicyDetailIcon kind={iconKind} size={17} tone="neutral" />}<View style={styles.overviewCopy}><Text style={styles.overviewLabel}>{label}</Text><Text numberOfLines={2} style={styles.overviewValue}>{value}</Text></View></View>;
}

function EntityRow({ image, icon, title, subtitle, onPress }: { image?: ImageSourcePropType; icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.entityRow, pressed && onPress ? styles.pressed : null]}><View style={styles.entityIcon}>{icon ? <Ionicons name={icon} size={20} color="#2468D7" /> : image ? <Image source={image} style={styles.entityArtwork} resizeMode="contain" /> : null}</View><View style={styles.entityBody}><Text numberOfLines={1} style={styles.entityTitle}>{title}</Text><Text numberOfLines={1} style={styles.entityMeta}>{subtitle}</Text></View></Pressable>;
}

function MiniInfo({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) { return <View style={[styles.miniInfo, compact && styles.miniInfoCompact]}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>; }
function policyArtwork(category: string): ImageSourcePropType { if (category === 'Motor') return PartnerAssets.products.motorInsurance; if (category === 'Health') return PartnerAssets.products.healthInsurance; if (category === 'Life') return PartnerAssets.products.familyInsurance; return PartnerAssets.products.commercialInsurance; }
function displayParts(...values: Array<string | number | null | undefined>) { return values.map((value) => value == null ? '' : String(value).trim()).filter((value) => value && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined').join(' · '); }
function policyCategory(data: PartnerPolicyDetail) { const value = [data.policy.policy_type, data.policy.policy_product, data.policy.business_line].filter(Boolean).join(' ').toLowerCase(); if (value.includes('health')) return 'Health'; if (value.includes('life')) return 'Life'; if (value.includes('motor') || data.vehicle) return 'Motor'; return 'Non-Motor'; }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string | null) { return formatAppDate(value, '—'); }
function nullableMoney(value: number | string | null) { return value == null ? 'Not recorded' : formatIndianCurrency(value); }

const styles = StyleSheet.create({
  pageHeader: { height: 52, marginHorizontal: -partnerTheme.spacing.lg, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#0A234A', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#244269' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBackButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: -0.12 },
  stateWrap: { marginTop: 14 },
  contentWrap: { marginTop: 0, gap: 9, paddingBottom: 15 },
  summaryCard: {
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12,
    marginHorizontal: -partnerTheme.spacing.lg,
    backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E3E9F1',
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryArtworkWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  summaryArtwork: { width: 34, height: 34 },
  summaryBody: { flex: 1, minWidth: 0 },
  summaryPolicyNo: { color: '#1B2536', fontSize: 18, lineHeight: 23, fontWeight: '800', flexShrink: 1, minWidth: 0 },
  policyNoRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  summaryNetPremium: { marginTop: 4, color: '#53677F', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF2DE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  categoryLabel: { color: '#895519', fontSize: 10, fontWeight: '700' },
  periodIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1375DC' },
  summaryInsurer: { color: '#75849A', fontSize: 9, lineHeight: 12, marginTop: 2 },
  summaryBadges: { alignItems: 'flex-end', justifyContent: 'center', gap: 7, maxWidth: '45%' },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginTop: 12, backgroundColor: '#E6EBF2' },
  premiumRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', paddingTop: 7 },
  premiumBlock: { flex: 1 }, premiumLabel: { color: '#718096', fontSize: 9, lineHeight: 11 },
  premiumValue: { marginTop: 1, color: '#1B344F', fontSize: 14, lineHeight: 20, fontWeight: '800', letterSpacing: -0.3 },
  periodDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 12, backgroundColor: '#E6EBF2' },
  periodBlock: { flex: 1.03, minWidth: 0 }, periodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  periodLabel: { color: '#718096', fontSize: 9, lineHeight: 11 },
  periodValue: { color: '#53677F', fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'right' },
  externalSection: { gap: 5 },
  externalSectionHeading: { marginLeft: -6, paddingLeft: 0, paddingRight: 2 },
  card: { overflow: 'hidden', borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F1', backgroundColor: '#FFFFFF' },
  cardHeader: { minHeight: 37, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 }, cardTitle: { color: '#102A51', fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  cardHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 1, minHeight: 32, paddingLeft: 8 }, cardHeaderActionText: { color: '#0969CF', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  quickSection: { marginHorizontal: 12, paddingVertical: 8 },
  quickSectionHeading: { marginLeft: -6, marginRight: 3, marginBottom: 8, color: '#17365D', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', alignItems: 'stretch', gap: 7 },
  quickAction: {
    flex: 1, minWidth: 0, minHeight: 74, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2, paddingVertical: 6, gap: 4, backgroundColor: 'transparent',
  },
  quickActionIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  quickActionArtwork: { width: 54, height: 54 },
  quickActionArtworkCompact: { width: 43, height: 43 },
  quickLabel: {
    color: '#102D55', textAlign: 'center', fontSize: 9.25, lineHeight: 12,
    fontWeight: '800', width: '100%', includeFontPadding: false,
  },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: 9, paddingBottom: 9 },
  overviewItem: { width: '31%', flexGrow: 1, minWidth: 0, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE7F3', borderRadius: 9 },
  overviewLogoWrap: { width: 23, height: 23, borderRadius: 9, backgroundColor: '#F0F5FC', alignItems: 'center', justifyContent: 'center' }, overviewLogo: { width: 20, height: 20 }, overviewCopy: { flex: 1, minWidth: 0 }, overviewLabel: { color: '#8A95A6', fontSize: 8.5, lineHeight: 10 }, overviewValue: { marginTop: 2, color: '#192B46', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  unifiedSectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E3E9F1', marginHorizontal: 10, marginVertical: 2 },
  premiumDisclosure: { minHeight: 47, marginHorizontal: 9, marginBottom: 8, paddingHorizontal: 2, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF' },
  commercialRow: { minHeight: 47, marginHorizontal: 9, marginBottom: 8, paddingHorizontal: 2, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF' },
  disclosureText: { flex: 1, minWidth: 0 }, disclosureTitle: { color: '#152945', fontSize: 10.5, lineHeight: 13, fontWeight: '700' }, disclosureSummary: { marginTop: 2, color: '#6F7F94', fontSize: 8.5, lineHeight: 11 },
  premiumDetailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingBottom: 10 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10, paddingBottom: 10 }, miniInfo: { width: '47%', minHeight: 38, padding: 7, borderRadius: 8, backgroundColor: '#F7F9FC' }, miniLabel: { color: '#8A95A6', fontSize: 8, lineHeight: 10, textTransform: 'uppercase' }, miniValue: { marginTop: 2, color: '#21334E', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },
  miniInfoCompact: { width: '31%', flexGrow: 1, minWidth: 0, paddingHorizontal: 5 },
  customerVehicleRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingVertical: 9 },
  customerVehicleTitleRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 5 },
  customerVehicleRegistration: { color: '#142A49', fontSize: 10, lineHeight: 13, fontWeight: '800', flexShrink: 1 },
  entityStack: { paddingHorizontal: 10, paddingBottom: 8 }, entityRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDF1F6' }, entityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF5FF' }, entityArtwork: { width: 27, height: 27 }, entityBody: { flex: 1, minWidth: 0 }, entityTitle: { color: '#142A49', fontSize: 10, lineHeight: 13, fontWeight: '800' }, entityMeta: { marginTop: 2, color: '#7C899B', fontSize: 8.5, lineHeight: 11 },
  pressed: { opacity: 0.68 },
});