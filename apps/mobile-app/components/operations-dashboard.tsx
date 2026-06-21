import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppGrid, AppScreen, AppSectionHeader, AppStatCard } from '@/components/design-system';
import { Card, LoadingState, NavLink } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { claimQueueDefinitions, isOpenClaimStatus, operationsQueueDefinitions, queueForStatus, stageAgeLabel, terminalClaimStatuses } from '@/lib/claim-workflow';
import { canHandleClaim, canViewManagementReports } from '@/lib/permissions';
import { roleLabels } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Claim, ClaimStatus, Profile } from '@/lib/types';

type DashboardMode = 'agent' | 'hierarchy' | 'admin' | 'operations';

export function OperationsDashboard({ mode }: { mode: DashboardMode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [documentsPending, setDocumentsPending] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const nextProfile = await getProfile(session.user.id);
        if (!isValidProfile(nextProfile) || nextProfile.role === 'customer') return router.replace('/access-denied');
        const [claimsResult, documentsResult] = await Promise.all([
          supabase.from('claims').select('*').order('updated_at', { ascending: false }),
          supabase.from('claim_documents').select('id, claim_id').eq('verification_status', 'pending'),
        ]);
        if (!active) return;
        const pendingDocuments = documentsResult.data ?? [];
        setProfile(nextProfile);
        setClaims(claimsResult.data ?? []);
        setDocumentsPending(pendingDocuments.length);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  const counts = useMemo(() => {
    const open = claims.filter((claim) => isOpenClaimStatus(claim.current_status)).length;
    return {
      total: claims.length,
      open,
      documentsPending,
      approvalPending: claims.filter((claim) => claim.current_status === 'Approval Pending').length,
      underRepair: claims.filter((claim) => ['Repair Started', 'Repair Completed', 'DO Submitted', 'Final Bill Submitted'].includes(claim.current_status)).length,
      customerActionAwaited: claims.filter((claim) => isCustomerActionAwaited(claim.current_status) && isOpenClaimStatus(claim.current_status)).length,
      managerActionRequired: claims.filter((claim) => isManagerActionRequired(claim)).length,
      completed: claims.filter((claim) => terminalClaimStatuses.includes(claim.current_status)).length,
      escalations: claims.filter((claim) => stageAgeLabel(claim.updated_at ?? claim.created_at).includes('days')).length,
    };
  }, [claims, documentsPending]);

  const queueCounts = useMemo(() => claimQueueDefinitions.map((queue) => ({
    ...queue,
    count: claims.filter((claim) => queue.statuses.includes(claim.current_status)).length,
  })), [claims]);

  const hotClaims = useMemo(() => claims.filter((claim) => isOpenClaimStatus(claim.current_status)).slice(0, 4), [claims]);

  if (loading) return <AppScreen title={dashboardTitle(mode)} showTitleHeader={false}><LoadingState label="Opening dashboard" /></AppScreen>;

  const role = profile?.role;
  const title = dashboardTitle(mode);
  const subtitle = profile?.full_name ? profile.full_name : role ? roleLabels[role] : undefined;

  return (
    <AppScreen title={title} subtitle={subtitle} showTitleHeader={false}>
      {mode === 'operations' ? null : <RoleHero mode={mode} role={role} counts={counts} />}
      {role === 'backoffice_executive' ? (
        <BackOfficeExperience />
      ) : mode === 'agent' ? (
        <AgentExperience openClaims={counts.open} documentsPending={documentsPending} hotClaims={hotClaims} />
      ) : mode === 'hierarchy' ? (
        <ManagementExperience counts={counts} queueCounts={queueCounts} canViewReports={canViewManagementReports(role)} />
      ) : mode === 'admin' ? (
        <AdminExperience counts={counts} />
      ) : role === 'manager' || role === 'claim_processor' ? (
        <ClaimOperationsExperience claims={claims} name={profile?.full_name} />
      ) : (
        <OperationsExperience counts={counts} queueCounts={queueCounts} hotClaims={hotClaims} canHandle={canHandleClaim(role)} />
      )}
    </AppScreen>
  );
}

function BackOfficeExperience() {
  const router = useRouter();
  return (
    <View style={styles.backofficeWrap}>
      <View style={styles.backofficeHero}>
        <View style={styles.backofficeHeroIcon}>
          <MaterialCommunityIcons name="briefcase-edit-outline" size={24} color={roleTheme.ops.accent} />
        </View>
        <View style={styles.backofficeHeroCopy}>
          <Text style={styles.backofficeHeroTitle}>Customer setup desk</Text>
          <Text style={styles.backofficeHeroText}>Create customer records, attach vehicles, and add policies with clean handoff to the claims workflow.</Text>
        </View>
      </View>
      <View style={styles.backofficeGrid}>
        <BackOfficeAction
          title="New Customer"
          body="Create login and customer profile"
          icon="account-plus-outline"
          onPress={() => router.push('/staff/create-customer')}
        />
        <BackOfficeAction
          title="Add Vehicle"
          body="Link a vehicle under a customer"
          icon="truck-plus-outline"
          onPress={() => router.push('/staff/add-vehicle')}
        />
        <BackOfficeAction
          title="Add Policy"
          body="Attach policy to a customer vehicle"
          icon="shield-plus-outline"
          onPress={() => router.push('/staff/add-policy')}
        />
      </View>
    </View>
  );
}

function BackOfficeAction({ title, body, icon, onPress }: { title: string; body: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.backofficeAction}>
      <View style={styles.backofficeActionTop}>
        <View style={styles.backofficeActionIcon}>
          <MaterialCommunityIcons name={icon} size={22} color={roleTheme.ops.accent} />
        </View>
        <MaterialCommunityIcons name="arrow-top-right" size={19} color={roleTheme.ops.accent} />
      </View>
      <Text style={styles.backofficeActionTitle}>{title}</Text>
      <Text style={styles.backofficeActionText}>{body}</Text>
    </Pressable>
  );
}

function RoleHero({ mode, role, counts }: { mode: DashboardMode; role?: Profile['role']; counts: DashboardCounts }) {
  const tone = mode === 'agent' ? roleTheme.agent : mode === 'hierarchy' ? roleTheme.management : mode === 'admin' ? roleTheme.it : roleTheme.ops;
  const copy = {
    agent: ['Service Desk', 'Commercial vehicle customers, document follow-ups, and claim reassurance.'],
    hierarchy: ['Management View', 'Stage health, aging pressure, and commercial claim bottlenecks.'],
    admin: ['Admin Desk', 'Access, partner records, and commercial claim oversight.'],
    operations: ['Manager Command Center', 'Monitor live claim pressure, pending customer actions, and settlement progress.'],
  }[mode];
  return (
    <View style={[styles.hero, { borderColor: mode === 'operations' ? 'rgba(191,216,255,0.78)' : tone.accent }]}>
      <View style={styles.heroRouteA} />
      <View style={styles.heroRouteB} />
      <View style={[styles.heroIcon, { backgroundColor: tone.soft }]}>
        <MaterialCommunityIcons name={tone.icon} size={21} color={tone.accent} />
      </View>
      {mode === 'operations' ? null : (
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>{role ? roleLabels[role] : copy[0]}</Text>
          <Text style={styles.heroTitle}>{copy[0]}</Text>
          <Text style={styles.heroBody}>{copy[1]}</Text>
        </View>
      )}
      {mode === 'operations' ? (
        <View style={styles.heroMetrics}>
          <HeroMetric label="Open" value={counts.open} />
          <HeroMetric label="Action" value={counts.managerActionRequired} />
        </View>
      ) : null}
    </View>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.heroMetric}>
      <Text style={styles.heroMetricValue}>{value}</Text>
      <Text style={styles.heroMetricLabel}>{label}</Text>
    </View>
  );
}


function ClaimOperationsExperience({ claims, name }: { claims: Claim[]; name?: string }) {
  const router = useRouter();
  const cards = useMemo(() => operationsQueueDefinitions.map((queue) => {
    const queueClaims = claims.filter((claim) => queue.statuses.includes(claim.current_status));
    return { ...queue, count: queueClaims.length, amount: operationsAmount(queue.amount, queueClaims) };
  }), [claims]);

  return (
    <View style={styles.operationsDashboard}>
      <View style={styles.operationsIntro}>
        <Text style={styles.operationsTitle}>Welcome, {name?.split(' ')[0] ?? 'Operations Team'}!</Text>
        <Text style={styles.operationsSubtitle}>Here&apos;s an overview of today&apos;s pending tasks.</Text>
      </View>
      <View style={styles.operationsGrid}>
        {cards.map((card) => (
          <Pressable key={card.key} accessibilityRole="button" onPress={() => router.push({ pathname: '/staff/claims', params: { queue: card.key } })} style={styles.operationsCard}>
            <View style={styles.operationsCardTop}>
              <View style={[styles.operationsIcon, { backgroundColor: managerToneSoft(card.tone) }]}>
                <MaterialCommunityIcons name={card.icon} size={26} color={managerToneColor(card.tone)} />
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={palette.slate} />
            </View>
            <Text style={styles.operationsCardLabel} numberOfLines={2}>{card.label}</Text>
            <Text style={styles.operationsCardCount}>{card.count}</Text>
            {card.amount ? <Text style={[styles.operationsAmount, { color: managerToneColor(card.tone) }]}>{card.amount}</Text> : <View style={styles.operationsAmountSpacer} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function operationsAmount(kind: 'none' | 'estimated' | 'approved' | 'settlement', claims: Claim[]) {
  if (kind === 'none') return null;
  const values = claims.map((claim) => {
    if (kind === 'estimated') return claim.estimated_loss;
    if (kind === 'approved') return claim.approved_amount;
    return claim.settlement_amount ?? claim.approved_amount;
  }).filter((value): value is number => value !== null && value !== undefined);
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return 'Amount ' + formatOperationsMoney(total);
}

function formatOperationsMoney(value: number) {
  return value >= 100000 ? 'INR ' + (value / 100000).toFixed(1) + 'L' : 'INR ' + Math.round(value).toLocaleString('en-IN');
}
function OperationsExperience({ counts, queueCounts, hotClaims, canHandle }: { counts: DashboardCounts; queueCounts: QueueCount[]; hotClaims: Claim[]; canHandle: boolean }) {
  void queueCounts;
  void hotClaims;
  void canHandle;
  const router = useRouter();
  return (
    <View style={styles.managerSection}>
      <AppSectionHeader title="Claim control" />
      <View style={styles.managerActions}>
      <ManagerActionTile
        label="Active Claims"
        value={counts.open}
        icon="file-document-multiple-outline"
        tone="primary"
        caption="All claims currently in progress"
        onPress={() => router.push({ pathname: '/staff/claims', params: { queue: 'active' } })}
      />
      <ManagerActionTile
        label="Customer Action Awaited"
        value={counts.customerActionAwaited}
        icon="account-clock-outline"
        tone="neutral"
        caption="Claims waiting on customer uploads or corrections"
        onPress={() => router.push({ pathname: '/staff/claims', params: { queue: 'customer-action' } })}
      />
      <ManagerActionTile
        label="Our Action Required"
        value={counts.managerActionRequired}
        icon="clipboard-check-outline"
        tone="warning"
        caption="Claims waiting for manager review or document verification"
        onPress={() => router.push({ pathname: '/staff/claims', params: { queue: 'manager-action' } })}
      />
      <ManagerActionTile
        label="Closed Cases"
        value={counts.completed}
        icon="check-decagram-outline"
        tone="success"
        caption="Settled, rejected, and closed records"
        onPress={() => router.push({ pathname: '/staff/claims', params: { queue: 'closed' } })}
      />
      </View>
    </View>
  );
}

function ManagerActionTile({ label, value, icon, tone, caption, onPress }: { label: string; value: number; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: 'primary' | 'danger' | 'warning' | 'success' | 'neutral'; caption: string; onPress: () => void }) {
  const color = managerToneColor(tone);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.managerTile}>
      <View style={styles.managerTileTop}>
        <View style={[styles.managerIcon, { backgroundColor: managerToneSoft(tone) }]}>
          <MaterialCommunityIcons name={icon} size={23} color={color} />
        </View>
        <View style={styles.managerCountPill}>
          <Text style={[styles.managerCount, { color }]}>{value}</Text>
        </View>
      </View>
      <Text style={styles.managerLabel}>{label}</Text>
      <Text style={styles.managerCaption}>{caption}</Text>
      <View style={styles.managerTileFooter}>
        <Text style={[styles.managerOpenText, { color }]}>Open</Text>
        <MaterialCommunityIcons name="arrow-right" size={18} color={color} />
      </View>
    </Pressable>
  );
}

function AgentExperience({ openClaims, documentsPending, hotClaims }: { openClaims: number; documentsPending: number; hotClaims: Claim[] }) {
  const router = useRouter();
  return (
    <>
      <View style={styles.agentFocus}>
        <FocusItem icon="phone-in-talk-outline" title="Calls" body={`${documentsPending} document follow-ups`} />
        <FocusItem icon="account-heart-outline" title="Open claims" body={`${openClaims} customer files`} />
      </View>
      <AppSectionHeader title="Customer follow-ups" />
      <NavLink href="/staff/customers" label="Customers" />
      <NavLink href="/staff/tasks" label="Tasks" />
      <NavLink href="/staff/claims" label="Claims" />
      <PriorityClaims claims={hotClaims} actionLabel="Assist" onAction={(claim) => router.push({ pathname: '/staff/claim-detail', params: { id: claim.id } })} />
    </>
  );
}

function ManagementExperience({ counts, queueCounts, canViewReports }: { counts: DashboardCounts; queueCounts: QueueCount[]; canViewReports: boolean }) {
  return (
    <>
      <AppGrid>
        <AppStatCard label="Portfolio" value={counts.total} icon="chart-box-outline" tone="info" />
        <AppStatCard label="Open" value={counts.open} icon="chart-timeline-variant" tone="warning" />
        <AppStatCard label="Escalations" value={counts.escalations} icon="alert-decagram-outline" tone="danger" />
        <AppStatCard label="Closed" value={counts.completed} icon="check-decagram-outline" tone="success" />
      </AppGrid>
      <Card>
        <AppSectionHeader title="Stage funnel" />
        {queueCounts.map((queue) => <FunnelRow key={queue.key} label={queue.label} count={queue.count} total={Math.max(1, counts.total)} />)}
      </Card>
      {canViewReports ? (
        <>
          <NavLink href="/staff/claims" label="View downline claims" />
          <NavLink href="/it/organization" label="Open organization tree" />
        </>
      ) : null}
    </>
  );
}

function AdminExperience({ counts }: { counts: DashboardCounts }) {
  return (
    <>
      <AppGrid>
        <AppStatCard label="Total claims" value={counts.total} icon="file-document-outline" tone="info" />
        <AppStatCard label="Open claims" value={counts.open} icon="progress-clock" tone="warning" />
        <AppStatCard label="Docs pending" value={counts.documentsPending} icon="file-alert-outline" tone="danger" />
        <AppStatCard label="Completed" value={counts.completed} icon="check-decagram-outline" tone="success" />
      </AppGrid>
      <AppSectionHeader title="Admin shortcuts" />
      <NavLink href="/it/users" label="User management" />
      <NavLink href="/it/organization" label="Organization hierarchy" />
      <NavLink href="/staff/create-customer" label="Create customer" />
      <NavLink href="/staff/add-insurer" label="Add insurer" />
    </>
  );
}

function PriorityClaims({ claims, actionLabel = 'Open', onAction }: { claims: Claim[]; actionLabel?: string; onAction?: (claim: Claim) => void }) {
  const router = useRouter();
  return (
    <Card>
      <AppSectionHeader title="Priority claims" />
      {claims.length ? claims.map((claim) => {
        const queue = queueForStatus(claim.current_status);
        return (
          <Pressable key={claim.id} accessibilityRole="button" onPress={() => onAction ? onAction(claim) : router.push({ pathname: '/staff/claim-detail', params: { id: claim.id } })} style={styles.claimRow}>
            <View style={styles.claimIcon}>
              <MaterialCommunityIcons name={queue.icon} size={19} color={palette.blue} />
            </View>
            <View style={styles.claimCopy}>
              <Text style={styles.claimNo}>{claim.claim_no}</Text>
              <Text style={styles.claimMeta}>{stageAgeLabel(claim.updated_at ?? claim.created_at)}</Text>
            </View>
            <View style={styles.claimSide}>
              <AppBadge label={claim.current_status} tone={queue.tone} />
              <Text style={styles.claimAction}>{actionLabel}</Text>
            </View>
          </Pressable>
        );
      }) : (
        <Text style={styles.emptyText}>No priority claims right now.</Text>
      )}
    </Card>
  );
}

function FocusItem({ icon, title, body }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.focusItem}>
      <View style={styles.focusIcon}>
        <MaterialCommunityIcons name={icon} size={22} color={roleTheme.agent.accent} />
      </View>
      <Text style={styles.focusTitle}>{title}</Text>
      <Text style={styles.focusBody}>{body}</Text>
    </View>
  );
}

function FunnelRow({ label, count, total }: { label: string; count: number; total: number }) {
  const width = `${Math.max(5, Math.round((count / total) * 100))}%` as DimensionValue;
  return (
    <View style={styles.funnelRow}>
      <View style={styles.funnelTop}>
        <Text style={styles.funnelLabel}>{label}</Text>
        <Text style={styles.funnelCount}>{count}</Text>
      </View>
      <View style={styles.funnelTrack}>
        <View style={[styles.funnelFill, { width }]} />
      </View>
    </View>
  );
}

type DashboardCounts = {
  total: number;
  open: number;
  documentsPending: number;
  customerActionAwaited: number;
  managerActionRequired: number;
  approvalPending: number;
  underRepair: number;
  completed: number;
  escalations: number;
};

type QueueCount = (typeof claimQueueDefinitions)[number] & { count: number };

function dashboardTitle(mode: DashboardMode) {
  if (mode === 'agent') return 'Agent Desk';
  if (mode === 'hierarchy') return 'Management Desk';
  if (mode === 'admin') return 'Admin Desk';
  return 'Claims Desk';
}

const customerActionAwaitedStatuses: ClaimStatus[] = ['Initial Documents Pending', 'Documents Pending', 'Final Documents Awaited'];

function isCustomerActionAwaited(status: ClaimStatus) {
  return customerActionAwaitedStatuses.includes(status);
}

function isManagerActionRequired(claim: Claim) {
  return isOpenClaimStatus(claim.current_status) && !isCustomerActionAwaited(claim.current_status);
}

function managerToneColor(tone: 'primary' | 'info' | 'danger' | 'warning' | 'success' | 'neutral') {
  if (tone === 'danger') return palette.coral;
  if (tone === 'warning') return palette.amber;
  if (tone === 'success') return palette.emerald;
  if (tone === 'neutral') return palette.slate;
  return palette.blue;
}

function managerToneSoft(tone: 'primary' | 'info' | 'danger' | 'warning' | 'success' | 'neutral') {
  if (tone === 'danger') return palette.coralSoft;
  if (tone === 'warning') return palette.amberSoft;
  if (tone === 'success') return palette.emeraldSoft;
  if (tone === 'neutral') return palette.surfaceAlt;
  return palette.blueSoft;
}

const styles = StyleSheet.create({
  operationsDashboard: { gap: 13 },
  operationsIntro: { paddingHorizontal: 2, paddingTop: 3, paddingBottom: 1 },
  operationsTitle: { color: palette.ink, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  operationsSubtitle: { color: palette.slate, fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 3 },
  operationsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  operationsCard: { width: '48.5%', minHeight: 151, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: '#DCE8F4', padding: 11, shadowColor: palette.ink, shadowOpacity: 0.045, shadowRadius: 9, elevation: 1 },
  operationsCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 9 },
  operationsIcon: { width: 47, height: 47, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  operationsCardLabel: { color: palette.ink, fontSize: 11, lineHeight: 14, fontWeight: '800', minHeight: 28 },
  operationsCardCount: { color: palette.ink, fontSize: 25, lineHeight: 29, fontWeight: '900', marginTop: 2 },
  operationsAmount: { fontSize: 10, lineHeight: 14, fontWeight: '900', marginTop: 3 },
  operationsAmountSpacer: { height: 17 },  managerSection: { marginTop: 2 },
  managerActions: { gap: 10 },
  managerTile: { minHeight: 124, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: 'rgba(224,231,240,0.94)', padding: 15, shadowColor: '#0B1220', shadowOpacity: 0.065, shadowRadius: 14, elevation: 2, overflow: 'hidden' },
  managerTileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  managerIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  managerCountPill: { minWidth: 48, height: 38, borderRadius: 16, backgroundColor: 'rgba(248,251,255,0.92)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(224,231,240,0.9)' },
  managerCount: { fontSize: 24, fontWeight: '900' },
  managerLabel: { color: palette.ink, fontSize: 16, fontWeight: '900', lineHeight: 21 },
  managerCaption: { color: palette.slate, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 5 },
  managerTileFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  managerOpenText: { fontSize: 13, fontWeight: '800' },
  backofficeWrap: { gap: 10 },
  backofficeHero: { borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13, shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  backofficeHeroIcon: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: roleTheme.ops.soft, alignItems: 'center', justifyContent: 'center' },
  backofficeHeroCopy: { flex: 1, minWidth: 0 },
  backofficeHeroTitle: { color: palette.ink, fontSize: 18, fontWeight: '900', lineHeight: 23 },
  backofficeHeroText: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 4 },
  backofficeGrid: { gap: 10 },
  backofficeAction: { minHeight: 124, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 15, shadowColor: palette.ink, shadowOpacity: 0.035, shadowRadius: 9, elevation: 1 },
  backofficeActionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  backofficeActionIcon: { width: 42, height: 42, borderRadius: radii.sm, backgroundColor: roleTheme.ops.soft, alignItems: 'center', justifyContent: 'center' },
  backofficeActionTitle: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  backofficeActionText: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 5 },
  hero: { borderRadius: 24, padding: 16, marginBottom: 14, minHeight: 128, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, overflow: 'hidden', shadowColor: '#0C4A88', shadowOpacity: 0.11, shadowRadius: 18, elevation: 4 },
  heroRouteA: { position: 'absolute', right: -44, top: -48, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(234,243,255,0.9)' },
  heroRouteB: { position: 'absolute', right: 36, bottom: -54, width: 132, height: 132, borderRadius: 66, backgroundColor: 'rgba(232,248,240,0.9)' },
  heroIcon: { width: 46, height: 46, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(224,231,240,0.92)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  heroEyebrow: { color: palette.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0 },
  heroTitle: { color: palette.ink, fontSize: 20, fontWeight: '900', lineHeight: 25, marginTop: 2 },
  heroBody: { color: palette.slate, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 4 },
  heroMetrics: { gap: 7 },
  heroMetric: { minWidth: 58, minHeight: 48, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(224,231,240,0.9)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  heroMetricValue: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  heroMetricLabel: { color: palette.slate, fontSize: 9, fontWeight: '900', marginTop: 1 },
  queueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  queueTile: { width: '31.8%', minHeight: 90, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 10 },
  queueIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  queueCount: { color: palette.ink, fontSize: 22, fontWeight: '800' },
  queueLabel: { color: palette.slate, fontSize: 11, fontWeight: '600', marginTop: 2 },
  claimRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingVertical: 10 },
  claimIcon: { width: 38, height: 38, borderRadius: radii.md, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  claimCopy: { flex: 1, minWidth: 0 },
  claimNo: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  claimMeta: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 3 },
  claimSide: { alignItems: 'flex-end', gap: 4, maxWidth: 132 },
  claimAction: { color: palette.blue, fontSize: 11, fontWeight: '700' },
  emptyText: { color: palette.slate, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  agentFocus: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  focusItem: { flex: 1, minHeight: 104, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 13 },
  focusIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: roleTheme.agent.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  focusTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  focusBody: { color: palette.slate, fontSize: 12, fontWeight: '500', lineHeight: 17, marginTop: 5 },
  funnelRow: { marginTop: 10 },
  funnelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  funnelLabel: { color: palette.ink, fontSize: 13, fontWeight: '600', flex: 1 },
  funnelCount: { color: palette.slate, fontSize: 13, fontWeight: '700' },
  funnelTrack: { height: 8, borderRadius: 4, backgroundColor: palette.line },
  funnelFill: { height: 8, borderRadius: 4, backgroundColor: roleTheme.management.accent },
});

