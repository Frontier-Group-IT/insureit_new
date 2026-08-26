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
import { getDistributionMtdAnalytics, type DistributionType } from "./distribution-mtd-analytics";

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

export default async function DashboardCommandCenterMtd() {
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
    ...(accounts?.overdueInvoiceCount ? [{ label: "Receivables overdue", value: accounts.overdueInvoiceCount, detail: formatMoney(accounts.overdueReceivableAmount), href: "/accounts/receivables", icon: DASHBOARD_ICON_ASSETS.receivableOverdue, tone: "warning" as const }] : []),
  ].slice(0, 6);

  const metrics: MetricItem[] = [
    ...(canViewPolicies ? [{ label: "Active policies", value: dashboard.totals.activePolicies, meta: dashboard.totals.expiringPolicies ? `${dashboard.totals.expiringPolicies} due ≤45d` : undefined, href: "/policies", icon: DASHBOARD_ICON_ASSETS.policy }] : []),
    ...(canViewClaims ? [{ label: "Open claims", value: dashboard.totals.openClaims, meta: dashboard.totals.recentClaims ? `${dashboard.totals.recentClaims} reported / 30d` : undefined, href: "/claims", icon: DASHBOARD_ICON_ASSETS.claims }] : []),
    ...(canViewPolicyIntakes ? [{ label: "Active intakes", value: intakeActive, meta: intakeAction ? `${intakeAction} need review` : undefined, href: "/policy-intakes", icon: DASHBOARD_ICON_ASSETS.policyIntake }] : []),
    ...(canViewIntermediaries && distribution ? [{ label: "Active intermediaries", value: distribution.activeIntermediaries, meta: distribution.pendingApplications ? `${distribution.pendingApplications} onboarding` : undefined, href: "/intermediaries", icon: DASHBOARD_ICON_ASSETS.distributionNetwork }] : []),
    ...(canViewCustomers ? [{ label: "Customers", value: dashboard.totals.customers, meta: `${dashboard.totals.activeCustomers} active`, href: "/customers", icon: DASHBOARD_ICON_ASSETS.customers }] : []),
  ];

  const warnings = [...dashboard.errors, intakeWarning, accountsWarning, ...analytics.warnings, ...(distribution?.warnings ?? [])].filter(Boolean) as string[];
  const generatedAt = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const generatedDate = now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

  const renewalBuckets = analytics.renewal ? [
    { label: "Expired", value: analytics.renewal.expired, tone: "bg-[#EF6A60]" },
    { label: "0–7d", value: analytics.renewal.due0to7, tone: "bg-[#EA8B42]" },
    { label: "8–15d", value: analytics.renewal.due8to15, tone: "bg-[#E8A93B]" },
    { label: "16–30d", value: analytics.renewal.due16to30, tone: "bg-[#8E77E8]" },
    { label: "31–45d", value: analytics.renewal.due31to45, tone: "bg-[#6257D9]" },
  ] : [];
  const renewalAttention = renewalBuckets.reduce((sum, item) => sum + item.value, 0);

  const claimBuckets = analytics.claimAging ? [
    { label: "<3d", value: analytics.claimAging.under3, tone: "bg-[#2CB9B0]" },
    { label: "3–7d", value: analytics.claimAging.days3to7, tone: "bg-[#4E9DD0]" },
    { label: "8–15d", value: analytics.claimAging.days8to15, tone: "bg-[#6257D9]" },
    { label: "16–30d", value: analytics.claimAging.days16to30, tone: "bg-[#D89B42]" },
    { label: ">30d", value: analytics.claimAging.over30, tone: "bg-[#EF6A60]" },
  ] : [];
  const openClaimAgingTotal = claimBuckets.reduce((sum, item) => sum + item.value, 0);

  const hasFinancialSignal = Boolean(accounts && (
    Math.abs(accounts.receivableOutstanding) > 0.009 || Math.abs(accounts.overdueReceivableAmount) > 0.009 ||
    accounts.overdueInvoiceCount > 0 || Math.abs(accounts.partnerPayableOutstanding) > 0.009 || accounts.partnerPayableCount > 0
  ));
  const showPrimaryQueue = canViewPolicyIntakes || canViewKyc;
  const showWorkMovement = (showPrimaryQueue && (recentActiveIntakes.length || dashboard.recentApplications.length)) || (canViewClaims && dashboard.latestClaims.length);

  return (
    <ClaimManagerShell title="Operations Overview" activeNav="dashboard">
      <main className="mx-auto max-w-[1580px] pb-12">
        <header className="flex flex-col gap-4 border-b border-[#DDE4EC] pb-4 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.13em] text-[#7F8CA0]"><span>Operations</span><span className="h-1 w-1 bg-[#17BFC5]" /><span>{generatedDate}</span></div>
            <h1 className="portal-display mt-1.5 text-[28px] font-semibold leading-none tracking-[-.02em] text-[#10213D] sm:text-[32px]">Operations Overview</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[9px] font-semibold text-[#788599]">Updated {generatedAt}</span>
            {canCreatePolicyIntakes ? <Link href="/policy-intakes/new" className="inline-flex h-9 items-center gap-1.5 border border-[#CAD4E1] bg-white px-3 text-[9px] font-bold text-[#1D2B45] hover:bg-[#F8FAFC]"><Plus className="h-3.5 w-3.5" />New Intake</Link> : null}
            <Link href="/notifications" className="inline-flex h-9 items-center gap-1.5 bg-[#263B66] px-3 text-[9px] font-bold text-white hover:bg-[#1D3159]">Open Work <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        </header>

        {warnings.length ? <section className="mt-4 flex items-start gap-3 border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-[10px] text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{warnings.join(" ")}</p></section> : null}

        {metrics.length ? <section className={`mt-5 grid border-y border-[#DDE4EC] bg-white ${metricGrid(metrics.length)}`}>{metrics.map((metric, index) => <MetricRailItem key={metric.label} metric={metric} divided={index > 0} />)}</section> : null}

        {actionItems.length ? <section className="mt-5 border-y border-[#DDE4EC] bg-white">
          <div className="flex items-center justify-between border-b border-[#E6EBF1] px-4 py-2.5"><h2 className="text-[10px] font-bold text-[#22304B]">Needs attention</h2><Link href="/notifications" className="text-[8px] font-bold text-[#718096] hover:text-[#263B66]">View all ↗</Link></div>
          <div className={`grid ${actionItems.length >= 4 ? "xl:grid-cols-4" : actionItems.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>{actionItems.map((item, index) => <AttentionItem key={item.label} item={item} divided={index > 0} />)}</div>
        </section> : null}

        {distribution?.production ? <MtdBusinessSection distribution={distribution} /> : null}

        {(openClaimAgingTotal > 0 || renewalAttention > 0) ? <section className="mt-6 grid border-y border-[#DDE4EC] bg-white xl:grid-cols-2">
          {openClaimAgingTotal > 0 ? <AgingStrip title="Claim aging" total={openClaimAgingTotal} href="/claims" items={claimBuckets} divided={renewalAttention > 0} /> : null}
          {renewalAttention > 0 ? <AgingStrip title="Renewal attention" total={renewalAttention} href="/policies" items={renewalBuckets} divided={openClaimAgingTotal > 0} /> : null}
        </section> : null}

        {hasFinancialSignal && accounts ? <section className="mt-6 border-y border-[#DDE4EC] bg-white">
          <div className="flex items-center justify-between border-b border-[#E6EBF1] px-4 py-3"><div className="flex items-center gap-2.5"><Icon src={DASHBOARD_ICON_ASSETS.accountsFinance} size={27} /><h2 className="text-[10px] font-bold text-[#22304B]">Financial operations</h2></div><Link href="/accounts" className="text-[8px] font-bold text-[#718096] hover:text-[#263B66]">Open Accounts ↗</Link></div>
          <div className="grid md:grid-cols-3"><MoneyCell label="Insurer receivable" value={accounts.receivableOutstanding} href="/accounts/receivables" /><MoneyCell label="Past-due receivable" value={accounts.overdueReceivableAmount} href="/accounts/receivables" divided /><MoneyCell label="Partner payable" value={accounts.partnerPayableOutstanding} href="/accounts/partner-payables" divided /></div>
        </section> : null}

        {showWorkMovement ? <section className={`mt-6 grid border-y border-[#DDE4EC] bg-white ${showPrimaryQueue && canViewClaims ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}>
          {showPrimaryQueue ? <WorkStream title={canViewPolicyIntakes ? "Policy Intake" : "KYC onboarding"} href={canViewPolicyIntakes ? "/policy-intakes" : "/customers/applications"}>
            {canViewPolicyIntakes ? recentActiveIntakes.map((row) => <IntakeRowItem key={row.id} row={row} />) : dashboard.recentApplications.slice(0, 5).map((row) => <Link key={row.id} href={`/customers/applications/${row.id}`} className="group flex items-center gap-3 border-t border-[#EEF1F5] px-4 py-3 first:border-t-0"><Icon src={DASHBOARD_ICON_ASSETS.kyc} size={24} /><div className="min-w-0 flex-1"><p className="truncate text-[9.5px] font-bold text-[#24324D]">{row.display_name || "Customer application"}</p><p className="mt-0.5 text-[8px] text-[#8792A5]">{row.status.replaceAll("_", " ")} · {formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A8B2C1]" /></Link>)}
          </WorkStream> : null}
          {canViewClaims ? <WorkStream title="Claim movement" href="/claims" divided={showPrimaryQueue}>
            {dashboard.latestClaims.slice(0, 5).map((row) => <Link key={row.id} href={`/claims/${row.id}`} className="group flex items-center gap-3 border-t border-[#EEF1F5] px-4 py-3 first:border-t-0"><Icon src={DASHBOARD_ICON_ASSETS.claims} size={24} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[9.5px] font-bold text-[#24324D]">{row.vehicles?.vehicle_no ?? row.claim_no}</p><span className="text-[7px] font-bold uppercase tracking-[.04em] text-[#D75D55]">{row.current_status}</span></div><p className="mt-0.5 truncate text-[8px] text-[#8792A5]">{row.customers?.company_name ?? row.customers?.contact_name ?? "Customer"} · {formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A8B2C1]" /></Link>)}
          </WorkStream> : null}
        </section> : null}
      </main>
    </ClaimManagerShell>
  );
}

function MtdBusinessSection({ distribution }: { distribution: NonNullable<Awaited<ReturnType<typeof getDistributionMtdAnalytics>>> }) {
  const production = distribution.production!;
  const commercial = production.grossPremiumMtd !== null;
  const channelTotal = production.byType.partner + production.byType.posp + production.byType.misp + production.byType.other;
  const headline = commercial ? [
    { label: "Gross premium MTD", value: formatMoneyCompact(production.grossPremiumMtd ?? 0) },
    { label: "Policies MTD", value: production.policiesMtd.toLocaleString("en-IN") },
    { label: "Average premium / policy", value: formatMoneyCompact(production.averageGrossPremiumMtd ?? 0) },
    { label: "Active producers MTD", value: production.activeProducersMtd.toLocaleString("en-IN") },
  ] : [
    { label: "Policies MTD", value: production.policiesMtd.toLocaleString("en-IN") },
    { label: "Active producers MTD", value: production.activeProducersMtd.toLocaleString("en-IN") },
  ];

  return <section className="mt-6 border-y border-[#DDE4EC] bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EBF1] px-5 py-3.5">
      <div className="flex items-center gap-3"><Icon src={DASHBOARD_ICON_ASSETS.reportsAnalytics} size={30} /><div><h2 className="text-[12px] font-bold text-[#1F2E4A]">Month-to-date business</h2><p className="mt-0.5 text-[8px] font-bold uppercase tracking-[.09em] text-[#8793A5]">{distribution.monthLabel}</p></div></div>
      <Link href="/reports" className="text-[8.5px] font-bold text-[#66758D] hover:text-[#263B66]">Business reports ↗</Link>
    </div>

    <div className={`grid border-b border-[#E6EBF1] ${headline.length === 4 ? "md:grid-cols-4" : "md:grid-cols-2"}`}>{headline.map((item, index) => <div key={item.label} className={`${index ? "border-t md:border-l md:border-t-0" : ""} border-[#E6EBF1] px-5 py-5`}><p className="portal-display text-[27px] font-semibold leading-none tracking-[-.02em] text-[#10213D]">{item.value}</p><p className="mt-2.5 text-[8px] font-bold uppercase tracking-[.09em] text-[#748298]">{item.label}</p></div>)}</div>

    <div className="grid xl:grid-cols-[.9fr_1.1fr]">
      <div className="border-b border-[#E6EBF1] px-5 py-5 xl:border-b-0 xl:border-r">
        <h3 className="text-[8.5px] font-bold uppercase tracking-[.1em] text-[#748298]">Channel contribution · MTD</h3>
        <div className="mt-4 space-y-3.5">{(["partner", "posp", "misp"] as DistributionType[]).map((type) => <MixBar key={type} label={typeLabel(type)} value={production.byType[type]} total={Math.max(channelTotal, 1)} />)}</div>
        {production.byBusinessType.length ? <div className="mt-6 border-t border-[#EEF1F5] pt-4"><h3 className="text-[8.5px] font-bold uppercase tracking-[.1em] text-[#748298]">Business type · MTD</h3><div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3.5">{production.byBusinessType.map((item) => <CompactCount key={item.label} label={item.label} count={item.count} total={Math.max(production.policiesMtd, 1)} />)}</div></div> : null}
      </div>

      <div className="grid md:grid-cols-2">
        <div className="border-b border-[#E6EBF1] px-5 py-5 md:border-b-0 md:border-r">
          <div className="flex items-end justify-between gap-3"><h3 className="text-[8.5px] font-bold uppercase tracking-[.1em] text-[#748298]">Top insurers · MTD</h3><span className="text-[7px] font-semibold uppercase tracking-[.07em] text-[#9AA5B4]">{commercial ? "Ranked by gross premium" : "By policy volume"}</span></div>
          <div className="mt-2 divide-y divide-[#EEF1F5]">{production.topInsurers.slice(0, 5).map((item, index) => <TopAmountRow key={item.id} rank={index + 1} label={item.name} count={item.policies} amount={item.grossPremium} />)}{!production.topInsurers.length ? <EmptyInsight /> : null}</div>
        </div>
        <div className="px-5 py-5"><h3 className="text-[8.5px] font-bold uppercase tracking-[.1em] text-[#748298]">Policy product · MTD</h3><div className="mt-2 divide-y divide-[#EEF1F5]">{production.byProduct.map((item) => <InsightRow key={item.label} label={item.label} count={item.count} />)}{!production.byProduct.length ? <EmptyInsight /> : null}</div></div>
      </div>
    </div>

    <div className="border-t border-[#E6EBF1]">
      <div className="flex flex-wrap items-end justify-between gap-2 px-5 py-3.5"><h3 className="text-[8.5px] font-bold uppercase tracking-[.1em] text-[#748298]">Top producers · MTD</h3><span className="text-[7px] font-semibold uppercase tracking-[.07em] text-[#9AA5B4]">{commercial ? "Ranked by gross premium · policies shown for context" : "Ranked by policy volume"}</span></div>
      <div className="border-t border-[#EEF1F5]">{distribution.topSources.slice(0, 6).map((row, index) => {
        const premiumShare = row.grossPremium !== null && (production.grossPremiumMtd ?? 0) > 0
          ? Math.round((row.grossPremium / (production.grossPremiumMtd ?? 1)) * 100)
          : null;
        return <Link key={row.code} href="/intermediaries" className="group grid min-h-[58px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#EEF1F5] px-5 py-3 first:border-t-0 hover:bg-[#FAFBFD]">
          <span className="portal-display text-[13px] font-semibold text-[#A0AABA]">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0"><p className="truncate text-[10px] font-bold text-[#22314D]">{row.name}</p><p className="mt-0.5 text-[7.5px] font-bold uppercase tracking-[.06em] text-[#98A3B3]">{typeLabel(row.type)}</p></div>
          <div className="min-w-[150px] text-right">{row.grossPremium !== null ? <><p className="portal-display text-[14px] font-semibold text-[#17243E]">{formatMoneyCompact(row.grossPremium)}</p><p className="mt-0.5 text-[7.5px] font-semibold text-[#8995A7]">{row.policies} policies{premiumShare !== null ? ` · ${premiumShare}% of MTD premium` : ""}</p></> : <><p className="portal-display text-[14px] font-semibold text-[#17243E]">{row.policies}</p><p className="mt-0.5 text-[7.5px] font-semibold text-[#8995A7]">policies MTD</p></>}</div>
        </Link>;
      })}</div>
    </div>
  </section>;
}

function MetricRailItem({ metric, divided }: { metric: MetricItem; divided: boolean }) {
  return <Link href={metric.href} className={`${divided ? "border-t md:border-l md:border-t-0" : ""} group flex min-h-[92px] items-center gap-3 border-[#E1E7EF] px-4 py-3 hover:bg-[#FAFBFD]`}><Icon src={metric.icon} size={34} /><div className="min-w-0 flex-1"><p className="portal-display text-[24px] font-semibold leading-none text-[#13213D]">{metric.value.toLocaleString("en-IN")}</p><div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[7.5px] font-bold uppercase tracking-[.08em] text-[#61708A]">{metric.label}</span>{metric.meta ? <span className="text-[7px] text-[#8A96A8]">{metric.meta}</span> : null}</div></div><ArrowUpRight className="h-3 w-3 text-[#A4AFC0] group-hover:text-[#263B66]" /></Link>;
}

function AttentionItem({ item, divided }: { item: ActionItem; divided: boolean }) {
  const marker = { critical: "bg-[#EF6A60]", warning: "bg-[#D79B37]", info: "bg-[#6257D9]", neutral: "bg-[#8B98AA]" }[item.tone];
  return <Link href={item.href} className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} group flex min-h-[74px] items-center gap-3 border-[#E6EBF1] px-4 py-3 hover:bg-[#FAFBFD]`}><span className={`h-7 w-[3px] shrink-0 ${marker}`} /><Icon src={item.icon} size={29} /><div className="min-w-0 flex-1"><p className="text-[8.8px] font-bold text-[#2A3852]">{item.label}</p>{item.detail ? <p className="mt-0.5 text-[7.3px] text-[#8A95A6]">{item.detail}</p> : null}</div><p className="portal-display text-[20px] font-semibold text-[#17243E]">{item.value}</p><ChevronRight className="h-3.5 w-3.5 text-[#A6B0BF]" /></Link>;
}

function AgingStrip({ title, total, href, items, divided }: { title: string; total: number; href: string; items: Array<{ label: string; value: number; tone: string }>; divided?: boolean }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#E1E7EF] p-4`}><div className="flex items-center justify-between"><div className="flex items-baseline gap-2"><h2 className="text-[10px] font-bold text-[#26344E]">{title}</h2><span className="portal-display text-[18px] font-semibold text-[#17243E]">{total}</span></div><Link href={href} className="text-[8px] font-bold text-[#718096] hover:text-[#263B66]">View all ↗</Link></div><div className="mt-4 grid grid-cols-5 gap-3">{items.map((item) => <div key={item.label}><div className="flex items-end justify-between gap-1"><span className="text-[7px] font-semibold text-[#7D899B]">{item.label}</span><span className="text-[8px] font-bold text-[#2C3951]">{item.value}</span></div><div className="mt-1.5 h-1.5 bg-[#EEF1F5]"><div className={`h-full ${item.tone}`} style={{ width: `${Math.max(item.value ? 8 : 0, Math.round((item.value / max) * 100))}%` }} /></div></div>)}</div></div>;
}

function MoneyCell({ label, value, href, divided }: { label: string; value: number; href: string; divided?: boolean }) {
  return <Link href={href} className={`${divided ? "border-t md:border-l md:border-t-0" : ""} group flex items-center justify-between border-[#E6EBF1] px-4 py-4 hover:bg-[#FAFBFD]`}><div><p className="text-[7.5px] font-bold uppercase tracking-[.09em] text-[#8793A5]">{label}</p><p className="portal-display mt-1.5 text-[20px] font-semibold text-[#17365D]">{formatMoney(value)}</p></div><ArrowUpRight className="h-3.5 w-3.5 text-[#A5AEBD]" /></Link>;
}

function WorkStream({ title, href, children, divided }: { title: string; href: string; children: React.ReactNode; divided?: boolean }) {
  return <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#E1E7EF]`}><div className="flex items-center justify-between px-4 py-3"><h2 className="text-[10px] font-bold text-[#26344E]">{title}</h2><Link href={href} className="text-[8px] font-bold text-[#718096] hover:text-[#263B66]">View all ↗</Link></div>{children}</div>;
}

function IntakeRowItem({ row }: { row: IntakeRow }) {
  return <Link href={`/policy-intakes/${row.id}`} className="group flex items-center gap-3 border-t border-[#EEF1F5] px-4 py-3"><Icon src={row.ocr_status === "failed" ? DASHBOARD_ICON_ASSETS.ocrManualReview : DASHBOARD_ICON_ASSETS.policyIntake} size={24} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[9.5px] font-bold text-[#24324D]">{row.intake_number}</p><span className="text-[7px] font-bold uppercase tracking-[.04em] text-[#6257D9]">{intakeLabel(row)}</span></div><p className="mt-0.5 truncate text-[8px] text-[#8792A5]">{row.lead_source_name} · {formatAge(row.created_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A8B2C1]" /></Link>;
}

function MixBar({ label, value, total }: { label: string; value: number; total: number }) {
  const share = Math.round((value / total) * 100);
  return <div><div className="flex items-center justify-between"><span className="text-[8.5px] font-bold text-[#33405A]">{label}</span><span className="text-[8.5px] font-bold text-[#33405A]">{value} <span className="font-semibold text-[#96A1B1]">· {share}%</span></span></div><div className="mt-1.5 h-1.5 bg-[#EEF1F5]"><div className="h-full bg-[#6257D9]" style={{ width: `${Math.max(value ? 5 : 0, share)}%` }} /></div></div>;
}

function CompactCount({ label, count, total }: { label: string; count: number; total: number }) {
  return <div className="flex items-center justify-between gap-2"><span className="truncate text-[8.5px] font-semibold text-[#536078]">{label}</span><span className="shrink-0 text-[8.5px] font-bold text-[#29364E]">{count} <span className="font-semibold text-[#9AA5B4]">· {Math.round((count / total) * 100)}%</span></span></div>;
}

function InsightRow({ label, count }: { label: string; count: number }) {
  return <div className="flex items-center gap-3 py-2.5"><p className="min-w-0 flex-1 truncate text-[9px] font-semibold text-[#344159]">{label}</p><span className="text-[9px] font-bold text-[#26344E]">{count}</span></div>;
}

function TopAmountRow({ rank, label, count, amount }: { rank: number; label: string; count: number; amount?: number | null }) {
  return <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5"><span className="portal-display text-[10px] font-semibold text-[#A1ABBA]">{String(rank).padStart(2, "0")}</span><p className="min-w-0 truncate text-[9px] font-semibold text-[#344159]">{label}</p><div className="text-right">{amount !== undefined && amount !== null ? <><p className="portal-display text-[11px] font-semibold text-[#1D2C47]">{formatMoneyCompact(amount)}</p><p className="mt-0.5 text-[7px] font-semibold text-[#929EAE]">{count} policies</p></> : <><p className="portal-display text-[11px] font-semibold text-[#1D2C47]">{count}</p><p className="mt-0.5 text-[7px] font-semibold text-[#929EAE]">policies</p></>}</div></div>;
}

function EmptyInsight() { return <p className="py-5 text-[8px] text-[#95A0B0]">No MTD data</p>; }
function Icon({ src, size }: { src: string; size: number }) { return <Image src={src} alt="" width={size} height={size} className="shrink-0 object-contain" />; }
function typeLabel(type: DistributionType) { return type === "posp" ? "POSP" : type === "misp" ? "MISP" : type === "partner" ? "Partner" : "Other"; }
function intakeLabel(row: IntakeRow) { if (row.status === "processing" && row.ocr_status === "failed") return "Manual review"; return ({ ready_for_review: "Ready", in_review: "In review", processing: "Processing", needs_attention: "Attention" } as Record<string, string>)[row.status] ?? row.status.replaceAll("_", " "); }
function formatAge(value: string) { const time = Date.parse(value); if (!Number.isFinite(time)) return "recently"; const minutes = Math.max(1, Math.round((Date.now() - time) / 60000)); if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60); return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`; }
function numberValue(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: number) { return Math.round(value * 100) / 100; }
function formatMoney(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }
function formatMoneyCompact(value: number) { const absolute = Math.abs(value); if (absolute >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`; if (absolute >= 100000) return `₹${(value / 100000).toFixed(1)} L`; if (absolute >= 1000) return `₹${(value / 1000).toFixed(1)} K`; return formatMoney(value); }
function metricGrid(count: number) { if (count >= 5) return "md:grid-cols-3 xl:grid-cols-5"; if (count === 4) return "md:grid-cols-2 xl:grid-cols-4"; if (count === 3) return "md:grid-cols-3"; return "md:grid-cols-2"; }