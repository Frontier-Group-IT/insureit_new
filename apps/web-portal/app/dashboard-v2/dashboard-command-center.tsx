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
import { getDistributionAnalytics, type DistributionAnalytics, type DistributionType } from "./distribution-analytics";

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

export default async function DashboardCommandCenter() {
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
    getDistributionAnalytics(profile, {
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

  const thirtyDaysAgo = now.getTime() - 30 * 86400000;
  const intakeAction = intakeRows.filter((row) => row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed")).length;
  const intakeManual = intakeRows.filter((row) => row.status === "processing" && row.ocr_status === "failed").length;
  const intakeActive = intakeRows.filter((row) => ["ready_for_review", "in_review", "processing", "needs_attention"].includes(row.status)).length;
  const recentActiveIntakes = intakeRows.filter((row) => !["completed", "rejected"].includes(row.status)).slice(0, 5);

  const allActions: ActionItem[] = [
    ...(canReviewPolicyIntakes ? [{
      label: "Policy Intakes",
      value: intakeAction,
      detail: intakeManual ? `${intakeManual} manual OCR` : "need review",
      href: "/policy-intakes",
      icon: DASHBOARD_ICON_ASSETS.policyIntakeReview,
      tone: intakeManual ? "warning" as const : "info" as const,
    }] : []),
    ...(canViewPolicies ? [{
      label: "Expired policies",
      value: dashboard.totals.expiredPolicies,
      href: "/policies",
      icon: DASHBOARD_ICON_ASSETS.expiredPolicy,
      tone: "critical" as const,
    }] : []),
    ...(canViewTasks ? [{
      label: "Overdue tasks",
      value: dashboard.attention.overdueTasks,
      detail: dashboard.attention.openTasks ? `${dashboard.attention.openTasks} open` : undefined,
      href: "/tasks",
      icon: DASHBOARD_ICON_ASSETS.tasksWorkQueue,
      tone: "warning" as const,
    }] : []),
    ...((canViewClaims || canViewKyc) ? [{
      label: "Documents pending",
      value: dashboard.attention.documents,
      href: canViewClaims ? "/claims" : "/customers/applications",
      icon: DASHBOARD_ICON_ASSETS.documentsPending,
      tone: "neutral" as const,
    }] : []),
    ...(canViewKyc ? [{
      label: "KYC corrections",
      value: dashboard.attention.changesRequested,
      href: "/customers/applications",
      icon: DASHBOARD_ICON_ASSETS.kycCorrection,
      tone: "info" as const,
    }] : []),
    ...(distribution?.network.pendingApplications ? [{
      label: "Intermediary onboarding",
      value: distribution.network.pendingApplications,
      href: "/intermediaries",
      icon: DASHBOARD_ICON_ASSETS.partnerIntermediary,
      tone: "info" as const,
    }] : []),
    ...(accounts?.overdueInvoiceCount ? [{
      label: "Receivables overdue",
      value: accounts.overdueInvoiceCount,
      detail: formatMoney(accounts.overdueReceivableAmount),
      href: "/accounts/receivables",
      icon: DASHBOARD_ICON_ASSETS.receivableOverdue,
      tone: "warning" as const,
    }] : []),
  ];
  const actionItems = allActions.filter((item) => item.value > 0).slice(0, 5);

  const metrics: MetricItem[] = [
    ...(canViewPolicies ? [{
      label: "Active policies",
      value: dashboard.totals.activePolicies,
      meta: dashboard.totals.expiringPolicies ? `${dashboard.totals.expiringPolicies} due ≤45d` : undefined,
      href: "/policies",
      icon: DASHBOARD_ICON_ASSETS.policy,
    }] : []),
    ...(canViewClaims ? [{
      label: "Open claims",
      value: dashboard.totals.openClaims,
      meta: dashboard.totals.recentClaims ? `${dashboard.totals.recentClaims} reported / 30d` : undefined,
      href: "/claims",
      icon: DASHBOARD_ICON_ASSETS.claims,
    }] : []),
    ...(canViewPolicyIntakes ? [{
      label: "Active intakes",
      value: intakeActive,
      meta: intakeAction ? `${intakeAction} need review` : undefined,
      href: "/policy-intakes",
      icon: DASHBOARD_ICON_ASSETS.policyIntake,
    }] : []),
    ...(canViewIntermediaries && distribution ? [{
      label: "Active intermediaries",
      value: distribution.network.active,
      meta: `${distribution.network.partner.active} Partner · ${distribution.network.posp.active} POSP${distribution.network.misp.active ? ` · ${distribution.network.misp.active} MISP` : ""}`,
      href: "/intermediaries",
      icon: DASHBOARD_ICON_ASSETS.distributionNetwork,
    }] : []),
    ...(canViewCustomers ? [{
      label: "Customers",
      value: dashboard.totals.customers,
      meta: `${dashboard.totals.activeCustomers} active`,
      href: "/customers",
      icon: DASHBOARD_ICON_ASSETS.customers,
    }] : []),
  ];

  const warnings = [...dashboard.errors, intakeWarning, accountsWarning, ...analytics.warnings, ...(distribution?.warnings ?? [])].filter(Boolean) as string[];
  const generatedAt = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const generatedDate = now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

  const renewalBuckets = analytics.renewal ? [
    { label: "Expired", value: analytics.renewal.expired, tone: "bg-[#EF6A60]" },
    { label: "0–7 days", value: analytics.renewal.due0to7, tone: "bg-[#EA8B42]" },
    { label: "8–15 days", value: analytics.renewal.due8to15, tone: "bg-[#E8A93B]" },
    { label: "16–30 days", value: analytics.renewal.due16to30, tone: "bg-[#8E77E8]" },
    { label: "31–45 days", value: analytics.renewal.due31to45, tone: "bg-[#6257D9]" },
  ] : [];
  const renewalAttention = renewalBuckets.reduce((sum, item) => sum + item.value, 0);

  const claimBuckets = analytics.claimAging ? [
    { label: "<3 days", value: analytics.claimAging.under3, tone: "bg-[#2CB9B0]" },
    { label: "3–7 days", value: analytics.claimAging.days3to7, tone: "bg-[#4E9DD0]" },
    { label: "8–15 days", value: analytics.claimAging.days8to15, tone: "bg-[#6257D9]" },
    { label: "16–30 days", value: analytics.claimAging.days16to30, tone: "bg-[#D89B42]" },
    { label: ">30 days", value: analytics.claimAging.over30, tone: "bg-[#EF6A60]" },
  ] : [];
  const openClaimAgingTotal = claimBuckets.reduce((sum, item) => sum + item.value, 0);
  const hasFinancialSignal = Boolean(accounts && (
    Math.abs(accounts.receivableOutstanding) > 0.009 ||
    Math.abs(accounts.overdueReceivableAmount) > 0.009 ||
    accounts.overdueInvoiceCount > 0 ||
    Math.abs(accounts.partnerPayableOutstanding) > 0.009 ||
    accounts.partnerPayableCount > 0
  ));
  const showPrimaryQueue = canViewPolicyIntakes || canViewKyc;
  const showWorkMovement = (showPrimaryQueue && (recentActiveIntakes.length || dashboard.recentApplications.length)) || (canViewClaims && dashboard.latestClaims.length);

  return (
    <ClaimManagerShell title="Operations Overview" activeNav="dashboard">
      <main className="mx-auto max-w-[1580px] pb-12">
        <header className="flex flex-col gap-4 border-b border-[#DDE4EC] pb-4 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.13em] text-[#7F8CA0]">
              <span>Operations</span><span className="h-1 w-1 bg-[#17BFC5]" /><span>{generatedDate}</span>
            </div>
            <h1 className="portal-display mt-1.5 text-[28px] font-semibold leading-none tracking-[-.02em] text-[#10213D] sm:text-[32px]">Operations Overview</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[9px] font-semibold text-[#788599]">Updated {generatedAt}</span>
            {canCreatePolicyIntakes ? <Link href="/policy-intakes/new" className="inline-flex h-9 items-center gap-1.5 border border-[#CAD4E1] bg-white px-3 text-[9px] font-bold text-[#1D2B45] transition hover:border-[#9CAFC5] hover:bg-[#F8FAFC]"><Plus className="h-3.5 w-3.5" />New Intake</Link> : null}
            <Link href="/notifications" className="inline-flex h-9 items-center gap-1.5 bg-[#263B66] px-3 text-[9px] font-bold text-white transition hover:bg-[#1D3159]">Open Work <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        </header>

        {warnings.length ? <section className="mt-4 flex items-start gap-3 border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-[10px] text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{warnings.join(" ")}</p></section> : null}

        {metrics.length ? <section className={`mt-5 grid border-y border-[#DDE4EC] bg-white ${metricGrid(metrics.length)}`} aria-label="Current operating metrics">
          {metrics.map((metric, index) => <MetricRailItem key={metric.label} metric={metric} divided={index > 0} />)}
        </section> : null}

        <PriorityStrip items={actionItems} />

        {distribution ? <DistributionSection distribution={distribution} /> : null}

        {hasFinancialSignal && accounts ? <FinancialExceptions accounts={accounts} /> : null}

        {(renewalAttention > 0 || openClaimAgingTotal > 0) ? <section className={`mt-6 grid border-y border-[#DDE4EC] bg-white ${renewalAttention > 0 && openClaimAgingTotal > 0 ? "xl:grid-cols-2" : "grid-cols-1"}`}>
          {renewalAttention > 0 ? <HealthBand title="Renewals" value={renewalAttention} href="/policies" buckets={renewalBuckets} /> : null}
          {openClaimAgingTotal > 0 ? <HealthBand title="Claim aging" value={openClaimAgingTotal} href="/claims" buckets={claimBuckets} divided={renewalAttention > 0} /> : null}
        </section> : null}

        {showWorkMovement ? <section className={`mt-6 grid border-y border-[#DDE4EC] bg-white ${showPrimaryQueue && canViewClaims ? "xl:grid-cols-2" : "grid-cols-1"}`}>
          {showPrimaryQueue ? <WorkColumn title={canViewPolicyIntakes ? "Policy Intake" : "KYC onboarding"} href={canViewPolicyIntakes ? "/policy-intakes" : "/customers/applications"}>
            {canViewPolicyIntakes ? recentActiveIntakes.map((row) => <IntakeRowItem key={row.id} row={row} />) : dashboard.recentApplications.slice(0, 5).map((row) => <Link key={row.id} href={`/customers/applications/${row.id}`} className="group flex min-h-[56px] items-center gap-3 border-t border-[#EDF1F5] px-5 py-2.5 first:border-t-0"><RawIcon src={DASHBOARD_ICON_ASSETS.kyc} size={28} /><div className="min-w-0 flex-1"><p className="truncate text-[9.5px] font-bold text-[#1E2B45]">{row.display_name || "Customer application"}</p><p className="mt-0.5 text-[8px] text-[#8995A6]">{formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A6B0BE] group-hover:text-[#263B66]" /></Link>)}
          </WorkColumn> : null}
          {canViewClaims ? <WorkColumn title="Claim movement" href="/claims" divided={showPrimaryQueue}>
            {dashboard.latestClaims.slice(0, 5).map((row) => <Link key={row.id} href={`/claims/${row.id}`} className="group flex min-h-[56px] items-center gap-3 border-t border-[#EDF1F5] px-5 py-2.5 first:border-t-0"><RawIcon src={DASHBOARD_ICON_ASSETS.claims} size={28} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-[9.5px] font-bold text-[#1E2B45]">{row.vehicles?.vehicle_no ?? row.claim_no}</p><span className="shrink-0 text-[7px] font-bold uppercase tracking-[.04em] text-[#D65C53]">{row.current_status}</span></div><p className="mt-0.5 truncate text-[8px] text-[#8995A6]">{row.customers?.company_name ?? row.customers?.contact_name ?? "Customer"} · {row.claim_no} · {formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A6B0BE] group-hover:text-[#263B66]" /></Link>)}
          </WorkColumn> : null}
        </section> : null}
      </main>
    </ClaimManagerShell>
  );
}

function PriorityStrip({ items }: { items: ActionItem[] }) {
  return <section className="mt-6 border-y border-[#DDE4EC] bg-white">
    <div className="grid xl:grid-cols-[130px_minmax(0,1fr)]">
      <div className="flex items-center justify-between border-b border-[#E6EBF1] px-4 py-3 xl:border-b-0 xl:border-r"><div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#8290A3]">Priority</p><p className="portal-display mt-0.5 text-[18px] font-semibold text-[#17243E]">{items.length}</p></div><Link href="/notifications" className="text-[8px] font-bold text-[#758196] hover:text-[#263B66] xl:hidden">View all</Link></div>
      {items.length ? <div className={`grid ${priorityGrid(items.length)}`}>{items.map((item, index) => <PriorityItem key={item.label} item={item} divided={index > 0} />)}</div> : <div className="flex min-h-[72px] items-center gap-3 px-5"><RawIcon src={DASHBOARD_ICON_ASSETS.tasksCompleted} size={30} /><span className="text-[9.5px] font-bold text-[#526079]">No urgent work</span></div>}
    </div>
  </section>;
}

function PriorityItem({ item, divided }: { item: ActionItem; divided: boolean }) {
  const tone = { critical: "bg-[#EF6A60]", warning: "bg-[#E6A23C]", info: "bg-[#6257D9]", neutral: "bg-[#8693A5]" }[item.tone];
  return <Link href={item.href} className={`group flex min-h-[72px] items-center gap-3 px-4 py-3 transition hover:bg-[#F8FAFC] ${divided ? "border-t border-[#E6EBF1] sm:border-l sm:border-t-0" : ""}`}>
    <span className={`h-8 w-[3px] shrink-0 ${tone}`} /><RawIcon src={item.icon} size={29} />
    <div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><p className="truncate text-[9px] font-bold text-[#27344D]">{item.label}</p><strong className="portal-display text-[20px] font-semibold leading-none text-[#17243E]">{item.value.toLocaleString("en-IN")}</strong></div>{item.detail ? <p className="mt-1 truncate text-[7.5px] font-medium text-[#8A96A7]">{item.detail}</p> : null}</div>
    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#A8B2C0] group-hover:text-[#263B66]" />
  </Link>;
}

function MetricRailItem({ metric, divided }: { metric: MetricItem; divided: boolean }) {
  return <Link href={metric.href} className={`group relative flex min-h-[100px] items-center gap-4 px-5 py-4 transition hover:bg-[#F9FBFD] ${divided ? "border-t border-[#E3E8EF] sm:border-l sm:border-t-0" : ""}`}>
    <RawIcon src={metric.icon} size={37} />
    <div className="min-w-0 flex-1"><div className="flex items-baseline gap-2.5"><strong className="portal-display text-[26px] font-semibold leading-none text-[#12203A]">{metric.value.toLocaleString("en-IN")}</strong>{metric.meta ? <span className="truncate text-[7.5px] font-semibold text-[#8995A7]">{metric.meta}</span> : null}</div><p className="mt-2 text-[8px] font-bold uppercase tracking-[.09em] text-[#67758B]">{metric.label}</p></div>
    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#A7B1BF] group-hover:text-[#263B66]" />
  </Link>;
}

function DistributionSection({ distribution }: { distribution: DistributionAnalytics }) {
  const production = distribution.production;
  const activeNetwork = distribution.network.active;
  const businessMax = production ? Math.max(production.byType.partner, production.byType.posp, production.byType.misp, production.byType.other, 1) : 1;
  return <section className="mt-6 border-y border-[#DDE4EC] bg-white">
    <div className="flex h-[54px] items-center justify-between border-b border-[#E6EBF1] px-5"><div className="flex items-center gap-2.5"><RawIcon src={DASHBOARD_ICON_ASSETS.distributionNetwork} size={31} /><h2 className="text-[12px] font-bold text-[#1D2A43]">Distribution & Business</h2></div><Link href="/intermediaries" className="inline-flex items-center gap-1 text-[8.5px] font-bold text-[#6F7C90] hover:text-[#263B66]">View all <ArrowUpRight className="h-3 w-3" /></Link></div>
    <div className={`grid ${production ? "xl:grid-cols-[.82fr_1.18fr]" : "grid-cols-1"}`}>
      <div className={`px-5 py-5 ${production ? "xl:border-r xl:border-[#DDE4EC]" : ""}`}>
        <div className="flex items-end justify-between gap-4"><div><p className="portal-display text-[30px] font-semibold leading-none text-[#14223C]">{activeNetwork.toLocaleString("en-IN")}</p><p className="mt-1.5 text-[8px] font-bold uppercase tracking-[.09em] text-[#758397]">Active network</p></div><p className="text-[8px] font-semibold text-[#8894A5]">{distribution.network.total} total accounts</p></div>
        <div className="mt-5 grid grid-cols-2 border-t border-[#E8EDF2] sm:grid-cols-4">
          <NetworkMetric label="Partner" active={distribution.network.partner.active} total={distribution.network.partner.total} />
          <NetworkMetric label="POSP" active={distribution.network.posp.active} total={distribution.network.posp.total} divided />
          <NetworkMetric label="MISP" active={distribution.network.misp.active} total={distribution.network.misp.total} divided />
          <NetworkMetric label="Onboarding" active={distribution.network.pendingApplications} total={distribution.network.pendingApplications} divided />
        </div>
      </div>

      {production ? <div className="min-w-0 px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="portal-display text-[30px] font-semibold leading-none text-[#14223C]">{production.policies30d.toLocaleString("en-IN")}</p><p className="mt-1.5 text-[8px] font-bold uppercase tracking-[.09em] text-[#758397]">Policies / 30 days</p></div>{production.grossPremium30d !== null ? <div className="text-right"><p className="portal-display text-[24px] font-semibold leading-none text-[#14223C]">{formatCompactMoney(production.grossPremium30d)}</p><p className="mt-1.5 text-[8px] font-bold uppercase tracking-[.09em] text-[#758397]">Gross premium</p></div> : null}</div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <div className="space-y-3">
            <ProductionBar label="Partner" value={production.byType.partner} max={businessMax} tone="bg-[#6257D9]" />
            <ProductionBar label="POSP" value={production.byType.posp} max={businessMax} tone="bg-[#18AEB2]" />
            {production.byType.misp ? <ProductionBar label="MISP" value={production.byType.misp} max={businessMax} tone="bg-[#2A91D2]" /> : null}
            {production.byType.other ? <ProductionBar label="Other" value={production.byType.other} max={businessMax} tone="bg-[#97A2B1]" /> : null}
          </div>
          {distribution.topSources.length ? <div className="border-t border-[#E8EDF2] lg:border-l lg:border-t-0 lg:pl-5"><p className="mb-1 text-[8px] font-bold uppercase tracking-[.1em] text-[#7E8B9E]">Top producers / 30d</p>{distribution.topSources.slice(0, 4).map((row) => <div key={row.code} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-[#EEF2F5] py-2 first:border-t-0"><div className="min-w-0"><p className="truncate text-[8.8px] font-bold text-[#27344D]">{row.name}</p><p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[.04em] text-[#98A3B2]">{distributionTypeLabel(row.type)}</p></div><span className="text-[9px] font-bold tabular-nums text-[#25334D]">{row.policies}</span>{row.grossPremium !== null ? <span className="min-w-[58px] text-right text-[8px] font-semibold tabular-nums text-[#6E7A8D]">{formatCompactMoney(row.grossPremium)}</span> : null}</div>)}</div> : null}
        </div>
      </div> : null}
    </div>
  </section>;
}

function NetworkMetric({ label, active, total, divided = false }: { label: string; active: number; total: number; divided?: boolean }) {
  return <div className={`py-3 pr-3 ${divided ? "border-l border-[#E8EDF2] pl-3" : ""}`}><p className="portal-display text-[18px] font-semibold text-[#1B2942]">{active.toLocaleString("en-IN")}</p><p className="mt-1 text-[7.5px] font-bold uppercase tracking-[.08em] text-[#7E8A9D]">{label}</p>{total !== active ? <p className="mt-0.5 text-[7px] font-medium text-[#9AA4B2]">{total} total</p> : null}</div>;
}

function ProductionBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const width = value ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return <div><div className="mb-1.5 flex items-center justify-between gap-3"><span className="text-[8px] font-semibold text-[#637086]">{label}</span><span className="text-[9px] font-bold tabular-nums text-[#25334D]">{value.toLocaleString("en-IN")}</span></div><div className="h-1.5 bg-[#EDF1F5]"><div className={`h-full ${tone}`} style={{ width: `${width}%` }} /></div></div>;
}

function FinancialExceptions({ accounts }: { accounts: AccountsSummary }) {
  const items = [
    ...(Math.abs(accounts.receivableOutstanding) > 0.009 ? [{ label: "Insurer receivable", value: formatMoney(accounts.receivableOutstanding), href: "/accounts/receivables" }] : []),
    ...(accounts.overdueInvoiceCount > 0 ? [{ label: "Past-due receivable", value: formatMoney(accounts.overdueReceivableAmount), href: "/accounts/receivables" }] : []),
    ...(accounts.partnerPayableCount > 0 ? [{ label: "Partner payable", value: formatMoney(accounts.partnerPayableOutstanding), href: "/accounts/partner-payables" }] : []),
  ];
  return <section className="mt-6 border-y border-[#DDE4EC] bg-white"><div className="grid xl:grid-cols-[180px_minmax(0,1fr)]"><Link href="/accounts" className="flex min-h-[72px] items-center gap-3 px-5 hover:bg-[#F8FAFC] xl:border-r xl:border-[#DDE4EC]"><RawIcon src={DASHBOARD_ICON_ASSETS.accountsFinance} size={30} /><div><p className="text-[9px] font-bold text-[#25334C]">Financial exceptions</p><p className="mt-0.5 text-[7px] font-semibold text-[#8B97A7]">{items.length} active</p></div></Link><div className={`grid ${items.length === 3 ? "md:grid-cols-3" : items.length === 2 ? "md:grid-cols-2" : "grid-cols-1"}`}>{items.map((item, index) => <Link key={item.label} href={item.href} className={`flex min-h-[72px] items-center justify-between gap-4 px-5 hover:bg-[#F8FAFC] ${index ? "border-t border-[#E7ECF1] md:border-l md:border-t-0" : ""}`}><div><p className="text-[7.5px] font-bold uppercase tracking-[.08em] text-[#7E8B9D]">{item.label}</p><p className="portal-display mt-1 text-[18px] font-semibold text-[#17243E]">{item.value}</p></div><ArrowUpRight className="h-3.5 w-3.5 text-[#A4AFBD]" /></Link>)}</div></div></section>;
}

function HealthBand({ title, value, href, buckets, divided = false }: { title: string; value: number; href: string; buckets: Array<{ label: string; value: number; tone: string }>; divided?: boolean }) {
  return <div className={`min-w-0 px-5 py-5 ${divided ? "border-t border-[#DDE4EC] xl:border-l xl:border-t-0" : ""}`}><div className="flex items-end justify-between gap-4"><div><h2 className="text-[11px] font-bold text-[#25334C]">{title}</h2><p className="portal-display mt-1 text-[25px] font-semibold leading-none text-[#17243E]">{value.toLocaleString("en-IN")}</p></div><Link href={href} className="inline-flex items-center gap-1 text-[8px] font-bold text-[#758196] hover:text-[#263B66]">View all <ArrowUpRight className="h-3 w-3" /></Link></div><SegmentBand buckets={buckets} total={value} /><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">{buckets.map((bucket) => <div key={bucket.label} className="flex items-center justify-between gap-2"><div className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 ${bucket.tone}`} /><span className="text-[7.5px] font-semibold text-[#79869A]">{bucket.label}</span></div><span className="text-[8.5px] font-bold tabular-nums text-[#2B3851]">{bucket.value}</span></div>)}</div></div>;
}

function SegmentBand({ buckets, total }: { buckets: Array<{ label: string; value: number; tone: string }>; total: number }) {
  return <div className="mt-4 flex h-2 w-full overflow-hidden bg-[#EDF1F5]">{buckets.filter((bucket) => bucket.value > 0).map((bucket) => <div key={bucket.label} className={`h-full ${bucket.tone}`} style={{ width: `${(bucket.value / Math.max(total, 1)) * 100}%` }} title={`${bucket.label}: ${bucket.value}`} />)}</div>;
}

function WorkColumn({ title, href, divided = false, children }: { title: string; href: string; divided?: boolean; children: React.ReactNode }) {
  return <div className={`min-w-0 ${divided ? "border-t border-[#DDE4EC] xl:border-l xl:border-t-0" : ""}`}><div className="flex h-[52px] items-center justify-between border-b border-[#E6EBF1] px-5"><h2 className="text-[11px] font-bold text-[#25334C]">{title}</h2><Link href={href} className="inline-flex items-center gap-1 text-[8px] font-bold text-[#758196] hover:text-[#263B66]">View all <ArrowUpRight className="h-3 w-3" /></Link></div>{children}</div>;
}

function IntakeRowItem({ row }: { row: IntakeRow }) {
  const failed = row.status === "processing" && row.ocr_status === "failed";
  return <Link href={`/policy-intakes/${row.id}`} className="group flex min-h-[56px] items-center gap-3 border-t border-[#EDF1F5] px-5 py-2.5 first:border-t-0"><RawIcon src={failed ? DASHBOARD_ICON_ASSETS.ocrManualReview : DASHBOARD_ICON_ASSETS.policyIntake} size={28} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-[9.5px] font-bold text-[#1E2B45]">{row.intake_number}</p><span className={`shrink-0 text-[7px] font-bold uppercase tracking-[.04em] ${failed ? "text-[#B77711]" : "text-[#6257D9]"}`}>{failed ? "Manual review" : intakeLabel(row)}</span></div><p className="mt-0.5 truncate text-[8px] text-[#8995A6]">{row.lead_source_name} · {row.customer_mobile} · {formatAge(row.created_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A6B0BE] group-hover:text-[#263B66]" /></Link>;
}

function RawIcon({ src, size }: { src: string; size: number }) {
  return <Image src={src} alt="" width={size} height={size} className="shrink-0 object-contain" />;
}

function priorityGrid(count: number) {
  if (count >= 5) return "sm:grid-cols-2 xl:grid-cols-5";
  if (count === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (count === 3) return "sm:grid-cols-3";
  if (count === 2) return "sm:grid-cols-2";
  return "grid-cols-1";
}

function metricGrid(count: number) {
  if (count >= 5) return "sm:grid-cols-2 xl:grid-cols-5";
  if (count === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (count === 3) return "sm:grid-cols-3";
  if (count === 2) return "sm:grid-cols-2";
  return "grid-cols-1";
}

function distributionTypeLabel(type: DistributionType) {
  return type === "posp" ? "POSP" : type === "misp" ? "MISP" : type === "partner" ? "Partner" : "Other";
}

function intakeLabel(row: IntakeRow) {
  return ({ ready_for_review: "Ready", in_review: "In review", processing: "Processing", needs_attention: "Attention" } as Record<string, string>)[row.status] ?? row.status.replaceAll("_", " ");
}

function formatAge(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "recent";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatCompactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 10000000) return `₹${(value / 10000000).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (absolute >= 100000) return `₹${(value / 100000).toFixed(1).replace(/\.0$/, "")} L`;
  if (absolute >= 1000) return `₹${(value / 1000).toFixed(1).replace(/\.0$/, "")} K`;
  return formatMoney(value);
}
