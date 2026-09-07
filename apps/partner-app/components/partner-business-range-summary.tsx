import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerDatePicker } from '@/components/ui/partner-date-picker';
import { PartnerListSummaryStrip } from '@/components/ui/partner-list-summary-strip';
import { getPartnerBusinessRange, type PartnerBusinessRangeSummary } from '@/lib/home';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';

const MAX_RANGE_DAYS = 366;

export function PartnerBusinessRangeSummaryCard() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [summary, setSummary] = useState<PartnerBusinessRangeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maximumToDate = fromDate ? minDate(today, addDays(fromDate, MAX_RANGE_DAYS - 1)) : today;
  const rangeReady = Boolean(fromDate && toDate && fromDate <= toDate && daysInclusive(fromDate, toDate) <= MAX_RANGE_DAYS);

  const handleFromDate = (value: Date) => {
    const next = startOfDay(value);
    setFromDate(next);
    setSummary(null);
    setError(null);
    if (toDate && (toDate < next || daysInclusive(next, toDate) > MAX_RANGE_DAYS)) setToDate(null);
  };

  const handleToDate = (value: Date) => {
    setToDate(startOfDay(value));
    setSummary(null);
    setError(null);
  };

  const applyRange = async () => {
    if (!fromDate || !toDate || !rangeReady || loading) return;
    setLoading(true);
    setError(null);
    try {
      setSummary(await getPartnerBusinessRange(toIsoDate(fromDate), toIsoDate(toDate)));
    } catch (reason) {
      setSummary(null);
      setError(reason instanceof Error ? reason.message : 'Business summary could not be loaded for this range.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Custom range</Text>
          <Text style={styles.meta}>Premium, policies, customers and claims</Text>
        </View>
        {summary ? <Text style={styles.appliedRange}>{formatRange(summary.from_date, summary.to_date)}</Text> : null}
      </View>

      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <PartnerDatePicker
            label="From"
            value={fromDate}
            maximumDate={toDate ?? today}
            onChange={handleFromDate}
          />
        </View>
        <View style={styles.dateField}>
          <PartnerDatePicker
            label="To"
            value={toDate}
            minimumDate={fromDate ?? undefined}
            maximumDate={maximumToDate}
            disabled={!fromDate}
            onChange={handleToDate}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apply custom business date range"
        accessibilityState={{ disabled: !rangeReady || loading }}
        disabled={!rangeReady || loading}
        onPress={() => void applyRange()}
        style={({ pressed }) => [styles.applyButton, (!rangeReady || loading) && styles.applyDisabled, pressed && styles.pressed]}
      >
        <Text style={styles.applyText}>{loading ? 'Loading…' : 'Apply range'}</Text>
      </Pressable>

      {error ? (
        <View style={styles.feedback}>
          <PartnerBanner tone="warning" message={error} />
        </View>
      ) : null}

      {summary ? (
        <View style={styles.summary}>
          <PartnerListSummaryStrip
            items={[
              { key: 'premium', label: 'Premium', value: formatIndianCurrency(summary.premium) },
              { key: 'policies', label: 'Policies', value: summary.policies },
              { key: 'customers', label: 'Customers', value: summary.customers },
              { key: 'claims', label: 'Claims', value: summary.claims },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function minDate(a: Date, b: Date) {
  return a <= b ? a : b;
}

function daysInclusive(fromDate: Date, toDate: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / dayMs) + 1;
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRange(fromDate: string, toDate: string) {
  const formatter = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' });
  return `${formatter.format(new Date(`${fromDate}T00:00:00`))} – ${formatter.format(new Date(`${toDate}T00:00:00`))}`;
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: partnerTheme.radius.lg,
    padding: 12,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headingCopy: { flex: 1 },
  title: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  meta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  appliedRange: { color: partnerTheme.colors.brand, ...partnerTheme.typography.meta },
  dateRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  dateField: { flex: 1 },
  applyButton: {
    minHeight: partnerTheme.control.minTouchTarget,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: partnerTheme.radius.lg,
    backgroundColor: partnerTheme.colors.brand,
  },
  applyDisabled: { opacity: 0.45 },
  applyText: { color: '#FFFFFF', ...partnerTheme.typography.bodyStrong },
  feedback: { marginTop: 8 },
  summary: { marginTop: 10 },
  pressed: { opacity: 0.82 },
});
