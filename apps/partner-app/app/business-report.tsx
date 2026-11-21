import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Image, RefreshControl, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerStackBottomNavigation } from '@/components/partner-stack-bottom-navigation';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerBusinessReportNet, type PartnerBusinessPerformance } from '@/lib/business';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

type Accent = 'blue' | 'purple' | 'green';

export default function BusinessReportScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
  const fetchReport = useCallback(() => getPartnerBusinessReportNet(), []);
  const report = usePartnerQuery<PartnerBusinessPerformance>({
    scopeKey: cacheScopeKey,
    key: 'business:report:net:v1',
    fetcher: fetchReport,
    staleTimeMs: 90_000,
  });

  return (
    <PartnerScreen
      title="Business Report"
      hideTopBar
      navyStatusBar
      bottomNavigationNavy
      bottomNavigation={<PartnerStackBottomNavigation activeTab="business" />}
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={report.refreshing}
            onRefresh={() => void report.refresh()}
            tintColor={partnerTheme.colors.brand}
            colors={[partnerTheme.colors.brand]}
          />
        ),
      }}
    >
      <PartnerCasePageHeader title="Business Report" icon="business-outline" onBack={() => router.back()} />
      {report.loading && !report.data ? (
        <PartnerStateView state="loading" title="Loading business report" />
      ) : !report.data ? (
        <PartnerStateView
          state="error"
          title="Business report unavailable"
          message={report.error || 'Business report could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void report.refresh()}
        />
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <ReportCard artwork={require('../assets/partner/business-report/premium-wallet-3d.png')} accent="blue" label="MTD Net Premium" value={formatIndianCurrency(report.data.premium_this_month)} />
            <ReportCard artwork={require('../assets/partner/business-report/policies-approved-3d.png')} accent="purple" label="MTD Policies" value={String(report.data.policies_this_month)} />
            <ReportCard artwork={require('../assets/partner/business-report/customers-shield-3d.png')} accent="green" label="Customers" value={String(report.data.total_customers)} />
          </View>

          <SectionHeading title="Last 6 Months · Net Premium" icon="stats-chart" tone="blue" aside="Last 6 Months" />
          <View style={styles.reportCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderLabel, styles.nameColumn]}>Month</Text>
              <Text style={[styles.tableHeaderLabel, styles.countColumn]}>Policies</Text>
              <Text style={[styles.tableHeaderLabel, styles.amountColumn]}>Net Premium</Text>
            </View>
            {report.data.trend.slice(-6).map((item, index, rows) => (
              <ReportRow
                key={item.month}
                title={formatMonth(item.month)}
                count={item.policies}
                amount={formatIndianCurrency(item.premium)}
                tone="blue"
                last={index === rows.length - 1}
              />
            ))}
          </View>

          <SectionHeading title="Business by Product · Net Premium" icon="layers" tone="purple" />
          <View style={styles.reportCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderLabel, styles.nameColumn]}>Product</Text>
              <Text style={[styles.tableHeaderLabel, styles.countColumn]}>Policies</Text>
              <Text style={[styles.tableHeaderLabel, styles.amountColumn]}>Net Premium</Text>
            </View>
            {report.data.business_mix.length ? report.data.business_mix.map((item, index, rows) => (
              <ReportRow
                key={item.label}
                title={humanize(item.label)}
                count={item.policies}
                amount={formatIndianCurrency(item.premium)}
                tone="purple"
                last={index === rows.length - 1}
              />
            )) : <Text style={styles.empty}>No product mix available.</Text>}
          </View>
          <View pointerEvents="none" style={styles.footerWave} />
        </>
      )}
    </PartnerScreen>
  );
}

function ReportCard({ artwork, accent, label, value }: {
  artwork: ImageSourcePropType;
  accent: Accent;
  label: string;
  value: string;
}) {
  const accentColor = accent === 'purple' ? '#9951ED' : accent === 'green' ? '#159B58' : '#1687F6';
  return (
    <View style={[styles.summaryCard, accent === 'purple' ? styles.purpleCard : accent === 'green' ? styles.greenCard : styles.blueCard]}>
      <Image source={artwork} style={styles.summaryArtwork} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.64} style={styles.value}>{value}</Text>
      <Text numberOfLines={2} style={styles.label}>{label}</Text>
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
    </View>
  );
}

function SectionHeading({ title, icon, tone, aside }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'blue' | 'purple';
  aside?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Ionicons name={icon} size={21} color={tone === 'purple' ? '#8547E9' : '#1577DD'} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {aside ? <View style={styles.periodTag}><Text style={styles.periodText}>{aside}</Text></View> : null}
    </View>
  );
}

function ReportRow({ title, count, amount, tone, last }: {
  title: string;
  count: number;
  amount: string;
  tone: 'blue' | 'purple';
  last: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text numberOfLines={2} style={[styles.rowName, styles.nameColumn]}>{title}</Text>
      <View style={styles.countColumn}>
        <View style={[styles.countPill, tone === 'purple' ? styles.purplePill : styles.bluePill]}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.countText}>{count} policies</Text>
        </View>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.rowAmount, styles.amountColumn]}>{amount}</Text>
    </View>
  );
}

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\\b\\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  summaryGrid: { marginTop: 14, flexDirection: 'row', gap: 7 },
  summaryCard: { flex: 1, minWidth: 0, minHeight: 138, paddingHorizontal: 5, paddingTop: 9, paddingBottom: 15, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#E4E9F3', overflow: 'hidden', ...partnerTheme.shadowSoft },
  blueCard: { backgroundColor: '#EFF7FF' },
  purpleCard: { backgroundColor: '#F7F3FF' },
  greenCard: { backgroundColor: '#F0FAF7' },
  summaryArtwork: { width: 67, height: 64 },
  value: { width: '100%', textAlign: 'center', color: '#08295C', fontSize: 15, lineHeight: 22, fontWeight: '800', marginTop: 3 },
  label: { color: '#506487', fontSize: 10.5, lineHeight: 14, fontWeight: '600', textAlign: 'center', marginTop: 3 },
  cardAccent: { position: 'absolute', bottom: 0, left: 10, right: 10, height: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  sectionHeading: { marginTop: 23, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: '#0B2657', fontSize: 13.5, lineHeight: 18, fontWeight: '800', flexShrink: 1, flexGrow: 1 },
  periodTag: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E4F0FF', flexShrink: 0 },
  periodText: { fontSize: 10, color: '#0D468F', fontWeight: '700' },
  reportCard: { borderRadius: 17, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF5', ...partnerTheme.shadowSoft },
  tableHeader: { minHeight: 34, backgroundColor: '#F3F8FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 6 },
  tableHeaderLabel: { fontSize: 10, lineHeight: 14, color: '#72819B', fontWeight: '700' },
  nameColumn: { flex: 1.05, minWidth: 0 },
  countColumn: { flex: 1.02, minWidth: 0 },
  amountColumn: { flex: 1.52, minWidth: 0, textAlign: 'right' },
  row: { minHeight: 50, paddingVertical: 9, paddingHorizontal: 11, gap: 6, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5EDF8' },
  lastRow: { borderBottomWidth: 0 },
  rowName: { color: '#0D2855', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  rowAmount: { color: '#0B285F', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  countPill: { borderRadius: 14, paddingVertical: 5, paddingHorizontal: 4, alignItems: 'center' },
  bluePill: { backgroundColor: '#E4F2FF' },
  purplePill: { backgroundColor: '#EFE3FF' },
  countText: { fontSize: 9.5, lineHeight: 12, fontWeight: '700', color: '#173775', textAlign: 'center' },
  empty: { paddingVertical: 18, paddingHorizontal: 12, color: '#8795A9', ...partnerTheme.typography.caption },
  footerWave: { height: 24, marginTop: 27, marginHorizontal: -partnerTheme.spacing.lg, backgroundColor: '#E2F1FF', borderTopLeftRadius: 110, borderTopRightRadius: 80 },
});
