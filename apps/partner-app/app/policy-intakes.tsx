import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerFilterChip } from '@/components/ui/partner-filter-chip';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
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
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroBody}>
            <Text style={styles.heroEyebrow}>OPERATIONS PIPELINE</Text>
            <Text style={styles.heroTitle}>{counts.active} active submissions</Text>
          </View>
          <View style={styles.heroIcon}><Ionicons name="git-network-outline" size={22} color="#FFFFFF" /></View>
        </View>
        <View style={styles.heroStats}>
          <PipelineStat value={counts.attention} label="Need you" warn />
          <PipelineStat value={counts.progress} label="In progress" />
          <PipelineStat value={counts.completed} label="Completed" />
        </View>
      </View>

      <View style={styles.filters}>
        <PartnerFilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <PartnerFilterChip label="Attention" active={filter === 'attention'} onPress={() => setFilter('attention')} />
        <PartnerFilterChip label="In progress" active={filter === 'in_progress'} onPress={() => setFilter('in_progress')} />
        <PartnerFilterChip label="Completed" active={filter === 'completed'} onPress={() => setFilter('completed')} />
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
            {visibleRows.map((row) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open Policy Intake ${row.intake_number}. ${statusLabel(row)}`}
                key={row.id}
                onPress={() => router.push({ pathname: '/policy-intakes/[id]', params: { id: row.id } })}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.top}>
                  <View style={styles.identity}>
                    <Text style={styles.number}>{row.intake_number}</Text>
                    <Text style={styles.customer}>{row.customer_mobile} · {row.lead_source_name}</Text>
                  </View>
                  <PartnerStatusBadge label={statusLabel(row)} tone={statusTone(row)} />
                </View>

                <View style={styles.metaRow}>
                  <Meta label="Policy" value={field(row, 'policy_number') || 'Fetching / review pending'} />
                  <Meta label="Vehicle" value={field(row, 'vehicle_registration_number') || 'Fetching / review pending'} />
                </View>

                <IntakeProgress row={row} />

                {row.attention_reason ? (
                  <View style={styles.attention}>
                    <Ionicons name="alert-circle-outline" size={17} color="#9A5B12" />
                    <Text style={styles.attentionText}>{row.attention_reason}</Text>
                  </View>
                ) : null}

                <View style={styles.footer}>
                  <View>
                    <Text style={styles.footerLabel}>UPDATED</Text>
                    <Text style={styles.date}>{formatDate(row.updated_at || row.created_at)}</Text>
                  </View>
                  <View style={styles.open}>
                    <Text style={styles.openText}>Open</Text>
                    <Ionicons name="chevron-forward" size={16} color={partnerTheme.colors.brand} />
                  </View>
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

function PipelineStat({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
  return (
    <View style={styles.pipelineStat}>
      <Text style={[styles.pipelineValue, warn && value > 0 && styles.pipelineValueWarn]}>{value}</Text>
      <Text style={styles.pipelineLabel}>{label}</Text>
    </View>
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metaValue}>{value}</Text>
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
  hero: { borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.nav },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroBody: { flex: 1 },
  heroEyebrow: { color: '#AAA5FF', letterSpacing: 1.1, ...partnerTheme.typography.meta },
  heroTitle: { marginTop: 3, color: '#FFFFFF', fontSize: 19, lineHeight: 25, fontWeight: '900' },
  heroIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#343D52' },
  heroStats: { marginTop: 10, paddingTop: 9, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3B4658' },
  pipelineStat: { flex: 1, alignItems: 'center' },
  pipelineValue: { color: '#FFFFFF', fontSize: 16, lineHeight: 21, fontWeight: '800' },
  pipelineValueWarn: { color: '#F1C687' },
  pipelineLabel: { marginTop: 3, color: '#96A2B4', ...partnerTheme.typography.meta },
  filters: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  inlineError: { marginBottom: 10, color: partnerTheme.colors.danger, textAlign: 'center', ...partnerTheme.typography.caption },
  list: { gap: 8 },
  card: { borderRadius: partnerTheme.radius.lg, padding: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  identity: { flex: 1 },
  number: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  customer: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  metaRow: { marginTop: 9, flexDirection: 'row' },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', textTransform: 'uppercase', letterSpacing: 0.6, ...partnerTheme.typography.meta },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  progressWrap: { marginTop: 10, paddingTop: 9, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  progressStep: { flex: 1, alignItems: 'center' },
  progressLineWrap: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D6DCE6' },
  progressDotComplete: { backgroundColor: partnerTheme.colors.brand },
  progressDotCurrent: { borderWidth: 2, borderColor: '#CFCBFF' },
  progressDotRejected: { backgroundColor: partnerTheme.colors.danger, borderColor: '#F4B8B1' },
  progressLine: { position: 'absolute', left: '58%', width: '84%', height: 1, backgroundColor: '#DCE1E9' },
  progressLineComplete: { backgroundColor: '#AAA5FF' },
  progressLabel: { marginTop: 6, color: '#98A2B3', ...partnerTheme.typography.meta },
  progressLabelActive: { color: partnerTheme.colors.ink },
  attention: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: 11, padding: 10, backgroundColor: partnerTheme.colors.warningSoft },
  attentionText: { flex: 1, color: '#80511A', ...partnerTheme.typography.caption },
  footer: { marginTop: 9, paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  footerLabel: { color: '#9AA3B2', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  date: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  pressed: { opacity: 0.8 },
});
