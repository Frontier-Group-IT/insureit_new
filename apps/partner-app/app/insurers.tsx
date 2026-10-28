import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerTopInsurers, type PartnerTopInsurer } from '@/lib/business';
import { formatIndianCurrency } from '@/lib/format';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;
const NAME_WIDTH = 215;
const METRIC_WIDTH = 106;

export default function InsurerListScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const { context, cacheScopeKey } = usePartnerSession();
  const from = typeof params.from === 'string' && DATE_PATTERN.test(params.from) ? params.from : '';
  const to = typeof params.to === 'string' && DATE_PATTERN.test(params.to) ? params.to : '';
  const validRange = Boolean(from && to && from <= to);
  const employee = context?.identity.actor_kind === 'employee';
  const columns = employee
    ? ['POLICIES', 'NET PREMIUM', 'PAY-IN', 'RETENTION']
    : ['POLICIES', 'NET PREMIUM', 'PAYOUT'];

  const fetchInsurers = useCallback(() => {
    if (!validRange) return Promise.resolve([] as PartnerTopInsurer[]);
    return getPartnerTopInsurers(from, to);
  }, [from, to, validRange]);

  const query = usePartnerQuery<PartnerTopInsurer[]>({
    scopeKey: cacheScopeKey,
    key: `business:insurers:range:${from}:${to}`,
    fetcher: fetchInsurers,
    staleTimeMs: 90_000,
  });

  return (
    <PartnerScreen
      title="Insurance Company List"
      scrollProps={{
        refreshControl: <RefreshControl refreshing={query.refreshing} onRefresh={() => void query.refresh()} />,
      }}
    >
      <View style={styles.panel}>
        <Text style={styles.heading}>Insurer</Text>
        <Text style={styles.range}>{validRange ? `${from} to ${to}` : 'Select a date range on Business to view insurers'}</Text>
        {!validRange ? (
          <PartnerStateView state="empty" title="Date range unavailable" message="Return to Business and select a reporting period." />
        ) : query.loading && !query.data ? (
          <PartnerStateView state="loading" title="Loading insurers" />
        ) : query.error && !query.data ? (
          <PartnerStateView state="error" title="Insurer list unavailable" message={query.error} actionLabel="Try again" onAction={() => void query.refresh()} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalContent}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.columnTitle, styles.insurerColumn]}>INSURER NAME</Text>
                {columns.map((column) => <Text key={column} style={[styles.columnTitle, styles.metricColumn]}>{column}</Text>)}
              </View>
              {(query.data ?? []).map((insurer) => (
                <View key={insurer.name} style={styles.tableRow}>
                  <View style={styles.insurerColumn}>
                    <View style={styles.insurerCell}>
                      <PartnerInsurerLogo name={insurer.name} style={styles.logo} />
                      <Text style={styles.insurerName} numberOfLines={2}>{insurer.name}</Text>
                    </View>
                  </View>
                  <Text style={[styles.metricColumn, styles.number]}>{insurer.policies}</Text>
                  <Text style={[styles.metricColumn, styles.number]}>{formatIndianCurrency(insurer.premium)}</Text>
                  {employee ? (
                    <>
                      <Text style={[styles.metricColumn, styles.number]}>—</Text>
                      <Text style={[styles.metricColumn, styles.number]}>—</Text>
                    </>
                  ) : <Text style={[styles.metricColumn, styles.number]}>—</Text>}
                </View>
              ))}
              {!query.data?.length ? <Text style={styles.empty}>No insurers found for the selected reporting period.</Text> : null}
            </View>
          </ScrollView>
        )}
        <Text style={styles.note}>Pay-in, retention and payout are not available from the existing insurer summary service; values are left blank rather than estimated.</Text>
      </View>
    </PartnerScreen>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#FFFFFF', borderColor: '#DCE5F0', borderWidth: 1, borderRadius: 15, overflow: 'hidden', marginTop: 12 },
  heading: { fontSize: 15, fontWeight: '800', color: '#14294B', paddingHorizontal: 14, paddingTop: 14 },
  range: { color: '#728198', fontSize: 10, paddingHorizontal: 14, paddingTop: 3, paddingBottom: 13 },
  horizontalContent: { paddingBottom: 3 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 43, backgroundColor: '#F5F8FC' },
  columnTitle: { color: '#7D8BA1', fontSize: 10, fontWeight: '800', paddingHorizontal: 10 },
  insurerColumn: { width: NAME_WIDTH },
  metricColumn: { width: METRIC_WIDTH, textAlign: 'right', paddingHorizontal: 10 },
  tableRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E3EAF2' },
  insurerCell: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10 },
  logo: { width: 30, height: 30 },
  insurerName: { flex: 1, color: '#30466A', fontSize: 11 },
  number: { color: '#30466A', fontSize: 11, fontWeight: '600' },
  empty: { padding: 18, fontSize: 12, color: '#718198' },
  note: { fontSize: 10, lineHeight: 15, color: '#75839A', paddingHorizontal: 14, paddingVertical: 12 },
});
