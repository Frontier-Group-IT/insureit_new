import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, CircleAlert, Plus } from "lucide-react";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { DASHBOARD_ICON_ASSETS } from "@/lib/dashboard-icon-assets";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getOperationsDashboardData } from "@/lib/operations-dashboard";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getDashboardV2Analytics } from "./operational-analytics";
import {
  getDistributionMtdAnalytics,
  type DistributionMtdAnalytics,
  type DistributionType,
} from "./distribution-mtd-analytics";

type IntakeRow = {
  id: string;
  intake_number: string;
  status: string;
  ocr_status: string;
  customer_mobile: string;
  lead_source_name: string;
  created_at: string;
  updated_at: string;
};

type ActionItem = {
  label: string;
  value: number;
  detail?: string;
  href: string;
  icon: string;
  tone: "critical" | "warning" | "info" | "neutral";
};

type MetricItem = {
  label: string;
  value: number;
  meta?: string;
  href: string;
  icon: string;
};

type AccountsSummary = {
  receivableOutstanding: number;
  overdueReceivableAmount: number;
  overdueInvoiceCount: number;
  partnerPayableOutstanding: number;
  partnerPayableCount: number;
};

type AgingItem = { label: string; value: number; tone: string };

export default async function DashboardCommandCenterRefined() {
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const [{ profile }, dashboard] = await Promise.all([
    getAuthenticatedProfile(accessToken),
    getOperationsDashboardData(supabase),
  ]);

  const [
    canViewPolicyIntakes,
    canReviewPolicyIntakes,
    canCreatePolicyIntakes,
    accountsCapability,
    canViewPolicies,
    canViewClaims,
    canViewCustomers,
    canViewTasks,
    canViewKyc,
    canViewIntermediaries,
  ] = await Promise.all([
    hasEffectiveCapability(profile, "view_policy_intakes", "view"),
    hasEffectiveCapability(profile, "review_policy_intakes", "edit"),
    hasEffectiveCapability(profile, "create_policy_intakes", "edit"),
    hasEffectiveCapability(profile, "view_accounts", "view"),
    hasEffectiveCapability(profile, "view_policies", "view"),
    hasEffectiveCapability(profile, "view_claims", "view"),
    hasEffectiveCapability(profile, "view_customers", "view"),
    hasEffectiveCapability(profile, "view_tasks", "view"),
    hasEffectiveCapability(profile, "view_kyc", "view"),
    hasEffectiveCapability(profile, "view_intermediaries", "view"),
  ]);

  const commercialAccess = canAccessPolicyCommercials(profile);
  const canViewAccounts = accountsCapability && commercialAccess;
  const [analytics, distribution] = await Promise.all([
    getDashboardV2Analytics(profile, { policies: canViewPolicies, claims: canViewClaims }),
    getDistributionMtdAnalytics(profile, {
      canViewIntermediaries,
      canViewProduction: canViewIntermediaries && canViewPolicies,
      canViewCommercials: canViewIntermediaries && canViewPolicies && commercialAccess,
    }),
  ]);

  const admin = createSupabaseAdminClient();
  let intakeRows: IntakeRow[] = [];
  let intakeWarning: string | null = null;
  let accountsWarning: string | null = null;
  let accounts: AccountsSummary | null = null;

  if (canViewPolicyIntakes) {
    let intakeQuery = admin
      .from("policy_intake_requests")
      .select("id,intake_number,status,ocr_status,customer_mobile,lead_source_name,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!canReviewPolicyIntakes && profile?.id) intakeQuery = intakeQuery.eq("submitted_by_profile_id", profile.id);
    const intakeResult = await intakeQuery.returns<IntakeRow[]>();
    if (intakeResult.error) intakeWarning = "Policy Intake figures could not be refreshed.";
    else intakeRows = intakeResult.data ?? [];
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (canViewAccounts) {
    const [receivableResult, invoiceResult, payableResult] = await Promise.all([
      admin.from("accounts_receivable_entries").select("debit_amount,credit_amount").limit(5000),
      admin.from("accounts_invoices").select("id,outstanding_amount,due_date").gt("outstanding_amount", 0).limit(2000),
      admin.from("partner_payables").select("id,outstanding_amount,status").gt("outstanding_amount", 0).limit(2000),
    ]);
    if (receivableResult.error || invoiceResult.error || payableResult.error) {
      accountsWarning = "Accounts figures could not be refreshed.";
    } else {
      const overdueInvoices = (invoiceResult.data ?? []).filter((row) => Boolean(row.due_date) && String(row.due_date) < today);
      const partnerPayables = payableResult.data ?? [];
      accounts = {
        receivableOutstanding: money((receivableResult.data ?? []).reduce((sum, row) => sum + numberValue(row.debit_amount) - numberValue(row.credit_amount), 0)),
        overdueReceivableAmount: money(overdueInvoices.reduce((sum, row) => sum + numberValue(row.outstanding_amount), 0)),
        overdueInvoiceCount: overdueInvoices.length,
        partnerPayableOutstanding: money(partnerPayables.reduce((sum, row) => sum + numberValue(row.outstanding_amount), 0)),
        partnerPayableCount: partnerPayables.length,
      };
    }
  }

  const intakeAction = intakeRows.filter((row) => row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed")).length;
  const intakeManual = intakeRows.filter((row) => row.status === "processing" && row.ocr_status === "failed").length;
  const intakeActive = intakeRows.filter((row) => ["ready_for_review", "in_review", "processing", "needs_attention"].includes(row.status)).length;
  const recentActiveIntakes = intakeRows.filter((row) => !["completed", "rejected"].includes(row.status)).slice(0, 5);

  const actionItems: ActionItem[] = [
    ...(canReviewPolicyIntakes && intakeAction ? [{ label: "Policy Intakes", value: intakeAction, detail: intakeManual ? `${intakeManual} manual OCR` : "need review", href: "/policy-intakes", icon: DASHBOARD_ICON_ASSETS.policyIntakeReview, tone: intakeManual ? "warning" as const : "info" as const }] : []),
    ...(canViewPolicies && dashboard.totals.expiredPolicies ? [{ label: "Expired policies", value: dashboard.totals.expiredPolicies, href: "/policies", icon: DASHBOARD_ICON_ASSETS.expiredPolicy, tone: "critical" as const }] : []),
    ...(canViewTasks && dashboard.attention.overdueTasks ? [{ label: "Overdue tasks", value: dashboard.attention.overdueTasks, detail: dashboard.attention.openTasks ? `${dashboard.attention.openTasks} open` : undefined, href: "/tasks", icon: DASHBOARD_ICON_ASSETS.tasksWorkQueue, tone: "warning" as const }] : []),
    ...((canViewClaims || canViewKyc) && dashboard.attention.documents ? [{ label: "Documents pending", value: dashboard.attention.documents, href: canViewClaims ? "/claims" : "/customers/applications", icon: DASHBOARD_ICON_ASSETS.documentsPending, tone: "neutral" as const }] : []),
    ...(canViewKyc && dashboard.attention.changesRequested ? [{ label: "KYC corrections", value: dashboard.attention.changesRequested, href: "/customers/applications", icon: DASHBOARD_ICON_ASSETS.kycCorrection, tone: "info" as const }] : []),
    ...(distribution?.pendingApplications ? [{ label: "Intermediary onboarding", value: distribution.pendingApplications, href: "/intermediaries", icon: DASHBOARD_ICON_ASSETS.partnerIntermediary, tone: "info" as const }] : []),
    ...(accounts?.overdueInvoiceCount ? [{ label: "Receivables overdue", value: accounts.overdueInvoiceCount, detail: formatMoneyCompact(accounts.overdueReceivableAmount), href: "/accounts/receivables", icon: DASHBOARD_ICON_ASSETS.receivableOverdue, tone: "warning" as const }] : []),
  ].slice(0, 6);

  const metrics: MetricItem[] = [
    ...(canViewPolicies ? [{ label: "Active policies", value: dashboard.totals.activePolicies, meta: dashboard.totals.expiringPolicies ? `${dashboard.totals.expiringPolicies} due ≤45d` : undefined, href: "/policies", icon: DASHBOARD_ICON_ASSETS.policy }] : []),
    ...(canViewClaims ? [{ label: "Open claims", value: dashboard.totals.openClaims, meta: dashboard.totals.recentClaims ? `${dashboard.totals.recentClaims} reported / 30d` : undefined, href: "/claims", icon: DASHBOARD_ICON_ASSETS.claims }] : []),
    ...(canViewPolicyIntakes ? [{ label: "Active intakes", value: intakeActive, meta: intakeAction ? `${intakeAction} need review` : undefined, href: "/policy-intakes", icon: DASHBOARD_ICON_ASSETS.policyIntake }] : []),
    ...(canViewIntermediaries && distribution ? [{ label: "Active intermediaries", value: distribution.activeIntermediaries, meta: distribution.pendingApplications ? `${distribution.pendingApplications} onboarding` : undefined, href: "/intermediaries", icon: DASHBOARD_ICON_ASSETS.distributionNetwork }] : []),
    ...(canViewCustomers ? [{ label: "Customers", value: dashboard.totals.customers, meta: `${dashboard.totals.activeCustomers} active`, href: "/customers", icon: DASHBOARD_ICON_ASSETS.customers }] : []),
  ];

  const claimBuckets: AgingItem[] = analytics.claimAging ? [
    { label: "<3 days", value: analytics.claimAging.under3, tone: "bg-[#23B7AE]" },
    { label: "3–7 days", value: analytics.claimAging.days3to7, tone: "bg-[#4C9DD1]" },
    { label: "8–15 days", value: analytics.claimAging.days8to15, tone: "bg-[#685BE3]" },
    { label: "16–30 days", value: analytics.claimAging.days16to30, tone: "bg-[#D99A3B]" },
    { label: ">30 days", value: analytics.claimAging.over30, tone: "bg-[#EE695F]" },
  ] : [];
  const claimAgingTotal = claimBuckets.reduce((sum, item) => sum + item.value, 0);

  const renewalBuckets: AgingItem[] = analytics.renewal ? [
    { label: "Expired", value: analytics.renewal.expired, tone: "bg-[#EE695F]" },
    { label: "0–7 days", value: analytics.renewal.due0to7, tone: "bg-[#E78B3E]" },
    { label: "8–15 days", value: analytics.renewal.due8to15, tone: "bg-[#DCAE42]" },
    { label: "16–30 days", value: analytics.renewal.due16to30, tone: "bg-[#8F79E7]" },
    { label: "31–45 days", value: analytics.renewal.due31to45, tone: "bg-[#685BE3]" },
  ] : [];
  const renewalAttention = renewalBuckets.reduce((sum, item) => sum + item.value, 0);

  const hasFinancialSignal = Boolean(accounts && (
    Math.abs(accounts.receivableOutstanding) > 0.009 ||
    Math.abs(accounts.overdueReceivableAmount) > 0.009 ||
    accounts.overdueInvoiceCount > 0 ||
    Math.abs(accounts.partnerPayableOutstanding) > 0.009 ||
    accounts.partnerPayableCount > 0
  ));

  const warnings = [...dashboard.errors, intakeWarning, accountsWarning, ...analytics.warnings, ...(distribution?.warnings ?? [])].filter(Boolean) as string[];
  const generatedAt = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const generatedDate = now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
  const showPrimaryQueue = canViewPolicyIntakes || canViewKyc;
  const showWorkMovement = (showPrimaryQueue && (recentActiveIntakes.length || dashboard.recentApplications.length)) || (canViewClaims && dashboard.latestClaims.length);

  return (
    <ClaimManagerShell title="Operations Overview" activeNav="dashboard">
      <main className="mx-auto max-w-[1580px] pb-12">
        <header className="flex flex-col gap-4 border-b border-[#D8E0EA] pb-4 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.13em] text-[#77859A]"><span>Operations</span><span className="h-1 w-1 bg-[#17BFC5]" /><span>{generatedDate}</span></div>
            <h1 className="portal-display mt-1.5 text-[30px] font-semibold leading-none tracking-[-.025em] text-[#0E203E] sm:text-[34px]">Operations Overview</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[9px] font-semibold text-[#718096]">Updated {generatedAt}</span>
            {canCreatePolicyIntakes ? <Link href="/policy-intakes/new" className="inline-flex h-9 items-center gap-1.5 border border-[#BCC9D9] bg-white px-3 text-[9px] font-bold text-[#182844] transition hover:border-[#879DB8] hover:bg-[#F8FAFC]"><Plus className="h-3.5 w-3.5" />New Intake</Link> : null}
            <Link href="/notifications" className="inline-flex h-9 items-center gap-1.5 bg-[#203962] px-3 text-[9px] font-bold text-white transition hover:bg-[#172F57]">Open Work <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        </header>

        {warnings.length ? <section className="mt-4 flex items-start gap-3 border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-[10px] text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{warnings.join(" ")}</p></section> : null}

        {metrics.length ? <section className={`mt-5 grid border-y border-[#D8E0EA] bg-white ${metricGrid(metrics.length)}`}>{metrics.map((metric, index) => <MetricRailItem key={metric.label} metric={metric} divided={index > 0} />)}</section> : null}

        {actionItems.length ? <AttentionStrip items={actionItems} /> : null}

        {distribution?.production ? <MtdBusinessExecutive distribution={distribution} /> : null}

        {(claimAgingTotal > 0 || renewalAttention > 0) ? <section className={`mt-6 grid gap-0 border-y border-[#D8E0EA] bg-white ${claimAgingTotal > 0 && renewalAttention > 0 ? "xl:grid-cols-2" : "grid-cols-1"}`}>
          {claimAgingTotal > 0 ? <PortfolioHealth title="Claim aging" total={claimAgingTotal} href="/claims" items={claimBuckets} /> : null}
          {renewalAttention > 0 ? <PortfolioHealth title="Renewal attention" total={renewalAttention} href="/policies" items={renewalBuckets} divided={claimAgingTotal > 0} /> : null}
        </section> : null}

        {hasFinancialSignal && accounts ? <section className="mt-6 border-y border-[#D8E0EA] bg-white">
          <div className="flex items-center justify-between px-4 py-3"><div className="flex items-center gap-2.5"><Icon src={DASHBOARD_ICON_ASSETS.accountsFinance} size={28} /><h2 className="text-[11px] font-bold text-[#1E2E4B]">Financial operations</h2></div><Link href="/accounts" className="text-[8.5px] font-bold text-[#66758B] hover:text-[#203962]">Open Accounts ↗</Link></div>
          <div className="grid border-t border-[#E8EDF3] md:grid-cols-3"><MoneyCell label="Insurer receivable" value={accounts.receivableOutstanding} href="/accounts/receivables" /><MoneyCell label="Past-due receivable" value={accounts.overdueReceivableAmount} href="/accounts/receivables" divided /><MoneyCell label="Partner payable" value={accounts.partnerPayableOutstanding} href="/accounts/partner-payables" divided /></div>
        </section> : null}

        {showWorkMovement ? <WorkMovement
          canViewClaims={canViewClaims}
          canViewPolicyIntakes={canViewPolicyIntakes}
          canViewKyc={canViewKyc}
          recentActiveIntakes={recentActiveIntakes}
          recentApplications={dashboard.recentApplications.slice(0, 5)}
          latestClaims={dashboard.latestClaims.slice(0, 5)}
        /> : null}
      </main>
    </ClaimManagerShell>
  );
}

function AttentionStrip({ items }: { items: ActionItem[] }) {
  return <section className="mt-5 flex flex-col border-y border-[#D8E0EA] bg-white xl:flex-row xl:items-stretch">
    <div className="flex shrink-0 items-center justify-between gap-5 border-b border-[#E8EDF3] px-4 py-3 xl:w-[170px] xl:border-b-0 xl:border-r"><h2 className="text-[10.5px] font-bold text-[#1D2C49]">Needs attention</h2><Link href="/notifications" className="text-[8px] font-bold text-[#7B8799] hover:text-[#203962] xl:hidden">View all ↗</Link></div>
    <div className="flex min-w-0 flex-1 flex-wrap xl:flex-nowrap">{items.map((item, index) => <AttentionItem key={item.label} item={item} divided={index > 0} />)}</div>
    <Link href="/notifications" className="hidden w-[88px] shrink-0 items-center justify-center border-l border-[#E8EDF3] text-[8px] font-bold text-[#68778D] hover:bg-[#F9FBFD] hover:text-[#203962] xl:flex">View all ↗</Link>
  </section>;
}

function MtdBusinessExecutive({ distribution }: { distribution: DistributionMtdAnalytics }) {
  const production = distribution.production!;
  const commercial = production.grossPremiumMtd !== null;
  const channelTotal = production.byType.partner + production.byType.posp + production.byType.misp + production.byType.other;
  const channelItems = (["partner", "posp", "misp", "other"] as DistributionType[]).filter((type) => production.byType[type] > 0);
  const producerPolicyTotal = Math.max(production.policiesMtd, 1);
  const producerPremiumTotal = Math.max(production.grossPremiumMtd ?? 0, 1);

  const headline = commercial ? [
    { label: "Gross premium", value: formatMoneyCompact(production.grossPremiumMtd ?? 0) },
    { label: "Policies", value: production.policiesMtd.toLocaleString("en-IN") },
    { label: "Avg. premium / policy", value: formatMoneyCompact(production.averageGrossPremiumMtd ?? 0) },
    { label: "Active producers", value: production.activeProducersMtd.toLocaleString("en-IN") },
  ] : [
    { label: "Policies", value: production.policiesMtd.toLocaleString("en-IN") },
    { label: "Active producers", value: production.activeProducersMtd.toLocaleString("en-IN") },
  ];

  return <section className="mt-6 overflow-hidden border-y border-[#D8E0EA] bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
      <div className="flex items-center gap-3"><Icon src={DASHBOARD_ICON_ASSETS.reportsAnalytics} size={30} /><div><h2 className="text-[12px] font-bold text-[#172844]">Month-to-date business</h2><p className="mt-0.5 text-[8px] font-bold uppercase tracking-[.1em] text-[#8995A7]">{distribution.monthLabel}</p></div></div>
      <Link href="/reports" className="text-[8.5px] font-bold text-[#66758B] hover:text-[#203962]">Business reports ↗</Link>
    </div>

    <div className="border-t border-[#E8EDF3] bg-[linear-gradient(90deg,#FBFCFF_0%,#F7FAFD_48%,#FBFFFE_100%)] px-4 py-5 sm:px-5">
      <div className={`grid gap-x-8 gap-y-5 ${headline.length === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}>{headline.map((item) => <div key={item.label}><p className="portal-display text-[29px] font-semibold leading-none tracking-[-.025em] text-[#10213D]">{item.value}</p><p className="mt-2 text-[8px] font-bold uppercase tracking-[.1em] text-[#77869B]">{item.label} MTD</p></div>)}</div>
    </div>

    <div className="grid border-t border-[#E8EDF3] xl:grid-cols-[1.05fr_.95fr_.95fr]">
      <div className="px-4 py-5 sm:px-5 xl:border-r xl:border-[#E8EDF3]">
        <InsightHeading title="Channel contribution" value={`${production.policiesMtd} policies`} />
        <div className="mt-4 flex h-3 overflow-hidden bg-[#EDF1F6]">{channelItems.map((type) => <div key={type} className={channelTone(type)} style={{ width: `${Math.max(2, Math.round((production.byType[type] / Math.max(channelTotal, 1)) * 100))}%` }} />)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{channelItems.map((type) => <ChannelStat key={type} type={type} value={production.byType[type]} total={Math.max(channelTotal, 1)} />)}</div>
      </div>

      <div className="border-t border-[#E8EDF3] px-4 py-5 sm:px-5 xl:border-r xl:border-t-0 xl:border-[#E8EDF3]">
        <InsightHeading title="Business mix" />
        <div className="mt-3 space-y-3">{production.byBusinessType.slice(0, 4).map((item) => <RankedBar key={item.label} label={item.label} count={item.count} total={producerPolicyTotal} tone="bg-[#6357DC]" />)}{!production.byBusinessType.length ? <EmptyInsight /> : null}</div>
        {production.byProduct.length ? <div className="mt-5 border-t border-[#EDF1F5] pt-4"><InsightHeading title="Product mix" /><div className="mt-3 space-y-2.5">{production.byProduct.slice(0, 4).map((item) => <RankedBar key={item.label} label={item.label} count={item.count} total={producerPolicyTotal} tone="bg-[#19AFA9]" compact />)}</div></div> : null}
      </div>

      <div className="border-t border-[#E8EDF3] px-4 py-5 sm:px-5 xl:border-t-0">
        <InsightHeading title="Top insurers" value={commercial ? "Ranked by gross premium" : "By policy volume"} />
        <div className="mt-3 space-y-3">{production.topInsurers.slice(0, 5).map((item, index) => <InsurerRank key={item.id} rank={index + 1} name={item.name} policies={item.policies} amount={item.grossPremium} policyTotal={producerPolicyTotal} premiumTotal={producerPremiumTotal} />)}{!production.topInsurers.length ? <EmptyInsight /> : null}</div>
      </div>
    </div>

    <div className="border-t border-[#DDE4EC] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#8290A3]">Producer leaderboard</p><h3 className="mt-1 text-[11.5px] font-bold text-[#1A2A46]">Top producers MTD</h3></div><span className="text-[7.5px] font-semibold uppercase tracking-[.08em] text-[#97A1B0]">{commercial ? "Ranked by gross premium · policies for context" : "Ranked by policy volume"}</span></div>
      <div className="mt-3 divide-y divide-[#EEF2F6] border-t border-[#E7ECF2]">{distribution.topSources.slice(0, 6).map((row, index) => <ProducerRow key={row.code} rank={index + 1} row={row} policyTotal={producerPolicyTotal} premiumTotal={producerPremiumTotal} />)}{!distribution.topSources.length ? <EmptyInsight /> : null}</div>
    </div>
  </section>;
}

function PortfolioHealth({ title, total, href, items, divided = false }: { title: string; total: number; href: string; items: AgingItem[]; divided?: boolean }) {
  const nonZero = items.filter((item) => item.value > 0);
  return <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#E8EDF3] px-4 py-5 sm:px-5`}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#8190A4]">Portfolio health</p><div className="mt-1 flex items-end gap-3"><h2 className="text-[12px] font-bold text-[#1A2A46]">{title}</h2><span className="portal-display text-[25px] font-semibold leading-none text-[#10213D]">{total}</span></div></div><Link href={href} className="text-[8px] font-bold text-[#6E7D91] hover:text-[#203962]">View all ↗</Link></div>
    <div className="mt-5 flex h-3 overflow-hidden bg-[#EDF1F5]">{nonZero.map((item) => <div key={item.label} className={item.tone} style={{ width: `${Math.max(3, Math.round((item.value / total) * 100))}%` }} />)}</div>
    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">{items.map((item) => <div key={item.label}><div className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 ${item.tone}`} /><span className="text-[8px] font-semibold text-[#637187]">{item.label}</span></div><p className="mt-1 text-[12px] font-bold text-[#20304B]">{item.value}</p></div>)}</div>
  </div>;
}

function WorkMovement({
  canViewClaims,
  canViewPolicyIntakes,
  canViewKyc,
  recentActiveIntakes,
  recentApplications,
  latestClaims,
}: {
  canViewClaims: boolean;
  canViewPolicyIntakes: boolean;
  canViewKyc: boolean;
  recentActiveIntakes: IntakeRow[];
  recentApplications: Array<{ id: string; display_name: string | null; status: string; updated_at: string }>;
  latestClaims: Array<{ id: string; claim_no: string; current_status: string; updated_at: string; vehicles?: { vehicle_no?: string | null } | null; customers?: { company_name?: string | null; contact_name?: string | null } | null }>;
}) {
  const showPrimary = canViewPolicyIntakes || canViewKyc;
  return <section className={`mt-6 grid border-y border-[#D8E0EA] bg-white ${showPrimary && canViewClaims ? "xl:grid-cols-2" : "grid-cols-1"}`}>
    {showPrimary ? <WorkStream title={canViewPolicyIntakes ? "Policy Intake" : "KYC onboarding"} href={canViewPolicyIntakes ? "/policy-intakes" : "/customers/applications"}>
      {canViewPolicyIntakes ? recentActiveIntakes.map((row) => <IntakeRowItem key={row.id} row={row} />) : recentApplications.map((row) => <Link key={row.id} href={`/customers/applications/${row.id}`} className="group flex items-center gap-3 border-t border-[#EEF2F6] px-4 py-3.5 first:border-t-0 sm:px-5"><Icon src={DASHBOARD_ICON_ASSETS.kyc} size={27} /><div className="min-w-0 flex-1"><p className="truncate text-[10.5px] font-bold text-[#21304D]">{row.display_name || "Customer application"}</p><p className="mt-1 text-[8.5px] text-[#7F8CA0]">{row.status.replaceAll("_", " ")} · {formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A6B0BF] group-hover:text-[#203962]" /></Link>)}
    </WorkStream> : null}
    {canViewClaims ? <WorkStream title="Claim movement" href="/claims" divided={showPrimary}>
      {latestClaims.map((row) => <Link key={row.id} href={`/claims/${row.id}`} className="group flex items-center gap-3 border-t border-[#EEF2F6] px-4 py-3.5 first:border-t-0 sm:px-5"><Icon src={DASHBOARD_ICON_ASSETS.claims} size={27} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2.5"><p className="truncate text-[10.5px] font-bold text-[#21304D]">{row.vehicles?.vehicle_no ?? row.claim_no}</p><span className="shrink-0 text-[7.5px] font-bold uppercase tracking-[.05em] text-[#D35A52]">{row.current_status}</span></div><p className="mt-1 truncate text-[8.5px] text-[#7F8CA0]">{row.customers?.company_name ?? row.customers?.contact_name ?? "Customer"} · {row.claim_no} · {formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A6B0BF] group-hover:text-[#203962]" /></Link>)}
    </WorkStream> : null}
  </section>;
}

function MetricRailItem({ metric, divided }: { metric: MetricItem; divided: boolean }) {
  return <Link href={metric.href} className={`${divided ? "border-t md:border-l md:border-t-0" : ""} group flex min-h-[96px] items-center gap-3 border-[#E3E9F0] px-4 py-3.5 transition hover:bg-[#FAFBFD]`}><Icon src={metric.icon} size={35} /><div className="min-w-0 flex-1"><p className="portal-display text-[26px] font-semibold leading-none tracking-[-.02em] text-[#10213D]">{metric.value.toLocaleString("en-IN")}</p><div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[8px] font-bold uppercase tracking-[.085em] text-[#5D6C83]">{metric.label}</span>{metric.meta ? <span className="text-[7.5px] font-semibold text-[#8B97A8]">{metric.meta}</span> : null}</div></div><ArrowUpRight className="h-3.5 w-3.5 text-[#A3ADBC] group-hover:text-[#203962]" /></Link>;
}

function AttentionItem({ item, divided }: { item: ActionItem; divided: boolean }) {
  const marker = { critical: "bg-[#EE695F]", warning: "bg-[#D99A3B]", info: "bg-[#6357DC]", neutral: "bg-[#8A98AA]" }[item.tone];
  return <Link href={item.href} className={`${divided ? "border-l border-[#E8EDF3]" : ""} group flex min-w-[220px] flex-1 items-center gap-3 px-4 py-3 transition hover:bg-[#FAFBFD]`}><span className={`h-8 w-[3px] shrink-0 ${marker}`} /><Icon src={item.icon} size={27} /><div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><p className="truncate text-[9.5px] font-bold text-[#25344F]">{item.label}</p><strong className="portal-display text-[19px] font-semibold text-[#10213D]">{item.value}</strong></div>{item.detail ? <p className="mt-0.5 truncate text-[7.5px] font-medium text-[#8A96A8]">{item.detail}</p> : null}</div><ChevronRight className="h-3.5 w-3.5 text-[#A8B2C0] group-hover:text-[#203962]" /></Link>;
}

function InsightHeading({ title, value }: { title: string; value?: string }) {
  return <div className="flex items-baseline justify-between gap-3"><h3 className="text-[8px] font-bold uppercase tracking-[.11em] text-[#7B899D]">{title}</h3>{value ? <span className="text-[7.5px] font-bold text-[#98A2B1]">{value}</span> : null}</div>;
}

function ChannelStat({ type, value, total }: { type: DistributionType; value: number; total: number }) {
  const share = Math.round((value / total) * 100);
  return <div className="flex items-center gap-2.5"><span className={`h-2.5 w-2.5 shrink-0 ${channelTone(type)}`} /><div className="min-w-0"><p className="text-[8.5px] font-bold text-[#33415B]">{typeLabel(type)}</p><p className="mt-0.5 text-[8px] font-semibold text-[#8591A3]">{value} policies · {share}%</p></div></div>;
}

function RankedBar({ label, count, total, tone, compact = false }: { label: string; count: number; total: number; tone: string; compact?: boolean }) {
  const share = Math.round((count / total) * 100);
  return <div><div className="flex items-center justify-between gap-3"><span className={`${compact ? "text-[8px]" : "text-[8.5px]"} min-w-0 truncate font-semibold text-[#44526A]`}>{label}</span><span className="shrink-0 text-[8px] font-bold text-[#26354F]">{count} <span className="font-semibold text-[#9AA4B3]">· {share}%</span></span></div><div className={`${compact ? "mt-1 h-1" : "mt-1.5 h-1.5"} overflow-hidden bg-[#EDF1F5]`}><div className={`h-full ${tone}`} style={{ width: `${Math.max(count ? 4 : 0, share)}%` }} /></div></div>;
}

function InsurerRank({ rank, name, policies, amount, policyTotal, premiumTotal }: { rank: number; name: string; policies: number; amount: number | null; policyTotal: number; premiumTotal: number }) {
  const share = amount !== null ? Math.round((amount / premiumTotal) * 100) : Math.round((policies / policyTotal) * 100);
  return <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5"><span className="portal-display text-[13px] font-semibold text-[#A0AABB]">{String(rank).padStart(2, "0")}</span><div className="min-w-0"><p className="truncate text-[9px] font-semibold text-[#34425C]">{name}</p><div className="mt-1.5 h-1 overflow-hidden bg-[#EDF1F5]"><div className="h-full bg-[#4C9DD1]" style={{ width: `${Math.max(4, share)}%` }} /></div></div><div className="min-w-[92px] text-right">{amount !== null ? <><p className="portal-display text-[11px] font-semibold text-[#1D2D49]">{formatMoneyCompact(amount)}</p><p className="mt-0.5 text-[7px] font-semibold text-[#8F9AAA]">{policies} policies · {share}%</p></> : <><p className="portal-display text-[11px] font-semibold text-[#1D2D49]">{policies}</p><p className="mt-0.5 text-[7px] font-semibold text-[#8F9AAA]">policies · {share}%</p></>}</div></div>;
}

function ProducerRow({ rank, row, policyTotal, premiumTotal }: { rank: number; row: DistributionMtdAnalytics["topSources"][number]; policyTotal: number; premiumTotal: number }) {
  const share = row.grossPremium !== null ? Math.round((row.grossPremium / premiumTotal) * 100) : Math.round((row.policies / policyTotal) * 100);
  return <Link href="/intermediaries" className="group grid grid-cols-[34px_minmax(0,1fr)_110px_72px_52px] items-center gap-3 py-3.5 hover:bg-[#FAFBFD] sm:px-2"><span className="portal-display text-[14px] font-semibold text-[#A2ACBB]">{String(rank).padStart(2, "0")}</span><div className="min-w-0"><p className="truncate text-[10px] font-bold text-[#26344E]">{row.name}</p><p className="mt-0.5 text-[7.5px] font-bold uppercase tracking-[.07em] text-[#96A1B1]">{typeLabel(row.type)}</p></div><div className="text-right">{row.grossPremium !== null ? <><p className="portal-display text-[12px] font-semibold text-[#1D2D49]">{formatMoneyCompact(row.grossPremium)}</p><p className="mt-0.5 text-[7px] font-semibold text-[#929DAC]">Gross premium</p></> : <p className="text-[9px] font-semibold text-[#929DAC]">—</p>}</div><div className="text-right"><p className="text-[10px] font-bold text-[#25344E]">{row.policies}</p><p className="mt-0.5 text-[7px] font-semibold text-[#929DAC]">Policies</p></div><div className="text-right"><p className="text-[9px] font-bold text-[#6F7D91]">{share}%</p><p className="mt-0.5 text-[7px] font-semibold text-[#A0A9B7]">Share</p></div></Link>;
}

function WorkStream({ title, href, divided = false, children }: { title: string; href: string; divided?: boolean; children: React.ReactNode }) {
  return <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#E8EDF3]`}><div className="flex items-center justify-between px-4 py-3 sm:px-5"><h2 className="text-[11px] font-bold text-[#1E2E4B]">{title}</h2><Link href={href} className="text-[8px] font-bold text-[#6E7D91] hover:text-[#203962]">View all ↗</Link></div><div className="border-t border-[#E8EDF3]">{children}</div></div>;
}

function IntakeRowItem({ row }: { row: IntakeRow }) {
  return <Link href={`/policy-intakes/${row.id}`} className="group flex items-center gap-3 border-t border-[#EEF2F6] px-4 py-3.5 first:border-t-0 sm:px-5"><Icon src={row.ocr_status === "failed" ? DASHBOARD_ICON_ASSETS.ocrManualReview : DASHBOARD_ICON_ASSETS.policyIntake} size={27} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2.5"><p className="truncate text-[10.5px] font-bold text-[#21304D]">{row.intake_number}</p><span className="shrink-0 text-[7.5px] font-bold uppercase tracking-[.05em] text-[#6357DC]">{intakeLabel(row)}</span></div><p className="mt-1 truncate text-[8.5px] text-[#7F8CA0]">{row.lead_source_name} · {row.customer_mobile} · {formatAge(row.created_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A6B0BF] group-hover:text-[#203962]" /></Link>;
}

function MoneyCell({ label, value, href, divided = false }: { label: string; value: number; href: string; divided?: boolean }) {
  return <Link href={href} className={`${divided ? "border-t md:border-l md:border-t-0" : ""} border-[#E8EDF3] px-4 py-4 hover:bg-[#FAFBFD] sm:px-5`}><p className="text-[8px] font-bold uppercase tracking-[.09em] text-[#8190A4]">{label}</p><p className="portal-display mt-2 text-[22px] font-semibold text-[#142542]">{formatMoneyCompact(value)}</p></Link>;
}

function EmptyInsight() { return <p className="py-5 text-[8px] text-[#95A0B0]">No MTD data</p>; }
function Icon({ src, size }: { src: string; size: number }) { return <Image src={src} alt="" width={size} height={size} className="shrink-0 object-contain" />; }
function channelTone(type: DistributionType) { return type === "partner" ? "bg-[#6357DC]" : type === "posp" ? "bg-[#19AFA9]" : type === "misp" ? "bg-[#D99A3B]" : "bg-[#A4AFBE]"; }
function typeLabel(type: DistributionType) { return type === "posp" ? "POSP" : type === "misp" ? "MISP" : type === "partner" ? "Partner" : "Other"; }
function intakeLabel(row: IntakeRow) { if (row.status === "processing" && row.ocr_status === "failed") return "Manual review"; return ({ ready_for_review: "Ready", in_review: "In review", processing: "Processing", needs_attention: "Attention" } as Record<string, string>)[row.status] ?? row.status.replaceAll("_", " "); }
function formatAge(value: string) { const time = Date.parse(value); if (!Number.isFinite(time)) return "recently"; const minutes = Math.max(1, Math.round((Date.now() - time) / 60000)); if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60); return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`; }
function numberValue(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: number) { return Math.round(value * 100) / 100; }
function formatMoneyCompact(value: number) { const absolute = Math.abs(value); if (absolute >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`; if (absolute >= 100000) return `₹${(value / 100000).toFixed(1)} L`; if (absolute >= 1000) return `₹${(value / 1000).toFixed(1)} K`; return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }
function metricGrid(count: number) { if (count >= 5) return "md:grid-cols-3 xl:grid-cols-5"; if (count === 4) return "md:grid-cols-2 xl:grid-cols-4"; if (count === 3) return "md:grid-cols-3"; return "md:grid-cols-2"; }