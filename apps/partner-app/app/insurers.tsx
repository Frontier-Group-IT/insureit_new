import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerInsurerRegister, type PartnerInsurerRegisterRow } from '@/lib/business';
import { formatIndianCurrency } from '@/lib/format';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NAME_WIDTH = 215;
const METRIC_WIDTH = 106;

export default function InsurerListScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const { context, cacheScopeKey } = usePartnerSession();
  const today = new Date();
  const defaultFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultTo = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const from = typeof params.from === 'string' && DATE_PATTERN.test(params.from) ? params.from : defaultFrom;
  const to = typeof params.to === 'string' && DATE_PATTERN.test(params.to) ? params.to : defaultTo;
  const validRange = Boolean(from && to && from <= to && (Date.parse(to) - Date.parse(from)) / 86400000 <= 366);
  const employee = context?.identity.actor_kind === 'employee';
  const columns = employee
    ? ['POLICIES', 'NET PREMIUM', 'PAY-IN', 'RETENTION']
    : ['POLICIES', 'NET PREMIUM', 'PAYOUT'];

  const fetchInsurers = useCallback(() => {
    if (!validRange) return Promise.resolve([] as PartnerInsurerRegisterRow[]);
    return getPartnerInsurerRegister(from, to);
  }, [from, to, validRange]);

  const query = usePartnerQuery<PartnerInsurerRegisterRow[]>({
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
                  ) : <Text style={[styles.metricColumn, styles.number]}>{insurer.payout == null ? '—' : formatIndianCurrency(insurer.payout)}</Text>}
                </View>
              ))}
              {!query.data?.length ? <Text style={styles.empty}>No insurers found for the selected reporting period.</Text> : null}
            </View>
          </ScrollView>
        )}

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
