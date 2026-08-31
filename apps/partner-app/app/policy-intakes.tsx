import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerListSummaryStrip } from '@/components/ui/partner-list-summary-strip';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { PartnerTopTabs } from '@/components/ui/partner-top-tabs';
import { listPartnerPolicyIntakes, type PartnerPolicyIntake } from '@/lib/policy-intakes';
import { partnerTheme } from '@/lib/theme';

type IntakeFilter = 'all' | 'attention' | 'in_progress' | 'completed';

export default function PolicyIntakesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<PartnerPolicyIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<IntakeFilter>('all');
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await listPartnerPolicyIntakes();
      setRows(result.intakes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy Intakes could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load(false);
  }, [load]));

  const counts = useMemo(() => ({
    active: rows.filter((row) => !['completed', 'rejected'].includes(row.status)).length,
    attention: rows.filter((row) => row.status === 'needs_attention').length,
    progress: rows.filter((row) => ['processing', 'ready_for_review', 'in_review'].includes(row.status)).length,
    completed: rows.filter((row) => row.status === 'completed').length,
  }), [rows]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'attention') return row.status === 'needs_attention';
    if (filter === 'completed') return row.status === 'completed';
    return ['processing', 'ready_for_review', 'in_review'].includes(row.status);
  }), [filter, rows]);

  return (
    <PartnerScreen
      eyebrow="POLICY INTAKE"
      title="My submissions"
      action={
        <PartnerButton
          label="New"
          icon="add"
          fullWidth={false}
          onPress={() => router.push('/policy-intake-new')}
        />
      }
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={partnerTheme.colors.brand}
            colors={[partnerTheme.colors.brand]}
          />
        ),
      }}
    >
      <PartnerListSummaryStrip
        items={[
          { key: 'active', label: 'Active', value: counts.active },
          { key: 'attention', label: 'Need you', value: counts.attention, tone: counts.attention ? 'warning' : 'default' },
          { key: 'progress', label: 'In progress', value: counts.progress },
          { key: 'completed', label: 'Completed', value: counts.completed, tone: 'success' },
        ]}
      />

      <View style={styles.tabs}>
        <PartnerTopTabs
          activeKey={filter}
          onChange={(key) => setFilter(key as IntakeFilter)}
          tabs={[
            { key: 'all', label: 'All', badge: rows.length },
            { key: 'attention', label: 'Attention', badge: counts.attention },
            { key: 'in_progress', label: 'In progress', badge: counts.progress },
            { key: 'completed', label: 'Completed', badge: counts.completed },
          ]}
        />
      </View>

      <PartnerSectionHeader
        title="Submission history"
        meta={loading ? 'Loading…' : `${visibleRows.length} shown · ${rows.length} total`}
      />

      {loading && !rows.length ? (
        <PartnerStateView state="loading" title="Loading Policy Intakes" />
      ) : error && !rows.length ? (
        <PartnerStateView
          state="error"
          title="Policy Intakes unavailable"
          message={error}
          actionLabel="Try again"
          onAction={() => void load(true)}
        />
      ) : visibleRows.length ? (
        <>
          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
          <View style={styles.list}>
            {visibleRows.map((row, index) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open Policy Intake ${row.intake_number}. ${statusLabel(row)}`}
                key={row.id}
                onPress={() => router.push({ pathname: '/policy-intakes/[id]', params: { id: row.id } })}
                style={({ pressed }) => [
                  styles.row,
                  index < visibleRows.length - 1 && styles.rowDivider,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.identity}>
                    <Text style={styles.number}>{row.intake_number}</Text>
                    <Text numberOfLines={1} style={styles.customer}>{row.customer_mobile} · {row.lead_source_name}</Text>
                  </View>
                  <PartnerStatusBadge label={statusLabel(row)} tone={statusTone(row)} />
                </View>

                <Text numberOfLines={1} style={styles.metaLine}>
                  {field(row, 'policy_number') || 'Policy pending'} · {field(row, 'vehicle_registration_number') || 'Vehicle pending'}
                </Text>

                <IntakeProgress row={row} />

                {row.attention_reason ? (
                  <View style={styles.attention}>
                    <Ionicons name="alert-circle-outline" size={16} color="#9A5B12" />
                    <Text numberOfLines={2} style={styles.attentionText}>{row.attention_reason}</Text>
                  </View>
                ) : null}

                <View style={styles.rowFooter}>
                  <Text style={styles.date}>Updated {formatDate(row.updated_at || row.created_at)}</Text>
                  <Ionicons name="chevron-forward" size={17} color="#9CA6B5" />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <PartnerStateView
          state="empty"
          icon="cloud-upload-outline"
          title={rows.length ? 'No submissions in this filter' : 'No Policy Intakes yet'}
          message={rows.length ? 'Choose another pipeline filter.' : 'Create an intake when you have a policy copy that Operations needs to onboard.'}
          actionLabel={rows.length ? undefined : 'Create first intake'}
          onAction={rows.length ? undefined : () => router.push('/policy-intake-new')}
        />
      )}
    </PartnerScreen>
  );
}

function IntakeProgress({ row }: { row: PartnerPolicyIntake }) {
  const manual = row.status === 'processing' && row.ocr_status === 'failed';
  const activeStep = row.status === 'completed'
    ? 4
    : row.status === 'in_review'
      ? 3
      : row.status === 'ready_for_review' || row.status === 'needs_attention' || manual
        ? 2
        : 1;
  const rejected = row.status === 'rejected';

  return (
    <View style={styles.progressWrap}>
      {['Uploaded', 'Read', 'Review', 'Done'].map((label, index) => {
        const step = index + 1;
        const complete = !rejected && step <= activeStep;
        const current = !rejected && step === activeStep;
        return (
          <View key={label} style={styles.progressStep}>
            <View style={styles.progressLineWrap}>
              <View style={[styles.progressDot, complete && styles.progressDotComplete, current && styles.progressDotCurrent, rejected && step === activeStep && styles.progressDotRejected]} />
              {index < 3 ? <View style={[styles.progressLine, step < activeStep && !rejected && styles.progressLineComplete]} /> : null}
            </View>
            <Text style={[styles.progressLabel, complete && styles.progressLabelActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function field(row: PartnerPolicyIntake, key: string) {
  return row.ocr_fields?.find((item) => item.key === key)?.value?.trim() || '';
}

function statusLabel(row: PartnerPolicyIntake) {
  if (row.status === 'processing' && row.ocr_status === 'failed') return 'Manual review';
  return ({
    processing: 'Processing',
    ready_for_review: 'Ready',
    in_review: 'In review',
    needs_attention: 'Needs attention',
    completed: 'Completed',
    rejected: 'Rejected',
  } as Record<string, string>)[row.status] || humanize(row.status);
}

function statusTone(row: PartnerPolicyIntake): 'success' | 'warning' | 'danger' | 'info' {
  if (row.status === 'completed') return 'success';
  if (row.status === 'rejected') return 'danger';
  if (row.status === 'needs_attention' || (row.status === 'processing' && row.ocr_status === 'failed')) return 'warning';
  return 'info';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  tabs: { marginTop: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  inlineError: { marginBottom: 8, color: partnerTheme.colors.danger, textAlign: 'center', ...partnerTheme.typography.caption },
  list: { marginTop: 1, backgroundColor: partnerTheme.colors.surface },
  row: {
    minHeight: 106,
    paddingVertical: 11,
    paddingHorizontal: 2,
    backgroundColor: partnerTheme.colors.surface,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  identity: { flex: 1, minWidth: 0 },
  number: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  customer: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  metaLine: { marginTop: 6, color: '#8A94A6', ...partnerTheme.typography.meta },
  progressWrap: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressStep: { flex: 1, alignItems: 'center' },
  progressLineWrap: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D6DCE6' },
  progressDotComplete: { backgroundColor: partnerTheme.colors.brand },
  progressDotCurrent: { borderWidth: 2, borderColor: '#CFCBFF' },
  progressDotRejected: { backgroundColor: partnerTheme.colors.danger, borderColor: '#F4B8B1' },
  progressLine: { position: 'absolute', left: '58%', width: '84%', height: 1, backgroundColor: '#DCE1E9' },
  progressLineComplete: { backgroundColor: '#AAA5FF' },
  progressLabel: { marginTop: 4, color: '#98A2B3', fontSize: 9, lineHeight: 12, fontWeight: '500' },
  progressLabelActive: { color: partnerTheme.colors.ink },
  attention: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: partnerTheme.colors.warningSoft,
  },
  attentionText: { flex: 1, color: '#80511A', ...partnerTheme.typography.meta },
  rowFooter: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  date: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  pressed: { opacity: 0.78 },
});
