import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerBusinessPerformance, type PartnerBusinessPerformance } from '@/lib/business';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function BusinessReportScreen() {
  const { cacheScopeKey } = usePartnerSession();
  const fetchReport = useCallback(() => getPartnerBusinessPerformance(), []);
  const report = usePartnerQuery<PartnerBusinessPerformance>({
    scopeKey: cacheScopeKey,
    key: 'business:report',
    fetcher: fetchReport,
    staleTimeMs: 90_000,
  });

  return (
    <PartnerScreen
      title="Business Report"
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
            <ReportCard icon="cash-outline" label="MTD Premium" value={formatIndianCurrency(report.data.premium_this_month)} />
            <ReportCard icon="document-text-outline" label="MTD Policies" value={String(report.data.policies_this_month)} />
            <ReportCard icon="people-outline" label="Customers" value={String(report.data.total_customers)} />
          </View>

          <Text style={styles.sectionTitle}>Last 6 Months</Text>
          <View style={styles.reportCard}>
            {report.data.trend.slice(-6).map((item) => (
              <View key={item.month} style={styles.row}>
                <Text style={styles.month}>{formatMonth(item.month)}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.policies}>{item.policies} policies</Text>
                  <Text style={styles.premium}>{formatIndianCurrency(item.premium)}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Business by Product</Text>
          <View style={styles.reportCard}>
            {report.data.business_mix.length ? report.data.business_mix.map((item) => (
              <View key={item.label} style={styles.row}>
                <Text numberOfLines={1} style={styles.month}>{humanize(item.label)}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.policies}>{item.policies} policies</Text>
                  <Text style={styles.premium}>{formatIndianCurrency(item.premium)}</Text>
                </View>
              </View>
            )) : <Text style={styles.empty}>No product mix available.</Text>}
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function ReportCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.icon}><Ionicons name={icon} size={18} color="#3156B8" /></View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  summaryGrid: { flexDirection: 'row', gap: 8 },
  summaryCard: { flex: 1, minHeight: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 14, padding: 9, backgroundColor: '#F5F9FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE6F1' },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F0FF' },
  value: { width: '100%', marginTop: 7, color: '#14367B', textAlign: 'center', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  label: { marginTop: 3, color: '#718198', textAlign: 'center', ...partnerTheme.typography.caption, fontWeight: '700' },
  sectionTitle: { marginTop: 18, marginBottom: 7, color: partnerTheme.colors.inkMuted, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.7 },
  reportCard: { borderRadius: 16, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE6F1', ...partnerTheme.shadowSoft },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF4' },
  month: { flex: 1, color: '#253858', ...partnerTheme.typography.bodyStrong },
  rowRight: { alignItems: 'flex-end' },
  policies: { color: '#8795A9', ...partnerTheme.typography.meta },
  premium: { marginTop: 2, color: '#3156B8', ...partnerTheme.typography.bodyStrong },
  empty: { paddingVertical: 18, color: '#8795A9', ...partnerTheme.typography.caption },
});