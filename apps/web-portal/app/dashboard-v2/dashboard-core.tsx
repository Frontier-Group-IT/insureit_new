import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, CircleAlert, Clock3, Plus } from "lucide-react";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { DASHBOARD_ICON_ASSETS } from "@/lib/dashboard-icon-assets";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getOperationsDashboardData } from "@/lib/operations-dashboard";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getDashboardV2Analytics } from "./operational-analytics";

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

type SnapshotItem = { icon: string; value: number; label: string };

export default async function DashboardV2Core() {
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
  ]);
  const canViewAccounts = accountsCapability && canAccessPolicyCommercials(profile);

  const analytics = await getDashboardV2Analytics(profile, { policies: canViewPolicies, claims: canViewClaims });
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
      const receivableOutstanding = money(
        (receivableResult.data ?? []).reduce((sum, row) => sum + numberValue(row.debit_amount) - numberValue(row.credit_amount), 0),
      );
      const overdueInvoices = (invoiceResult.data ?? []).filter((row) => Boolean(row.due_date) && String(row.due_date) < today);
      const overdueReceivableAmount = money(overdueInvoices.reduce((sum, row) => sum + numberValue(row.outstanding_amount), 0));
      const partnerPayables = payableResult.data ?? [];
      accounts = {
        receivableOutstanding,
        overdueReceivableAmount,
        overdueInvoiceCount: overdueInvoices.length,
        partnerPayableOutstanding: money(partnerPayables.reduce((sum, row) => sum + numberValue(row.outstanding_amount), 0)),
        partnerPayableCount: partnerPayables.length,
      };
    }
  }

  const thirtyDaysAgo = now.getTime() - 30 * 86400000;
  const intakeAction = intakeRows.filter((row) => row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed")).length;
  const intakeManual = intakeRows.filter((row) => row.status === "processing" && row.ocr_status === "failed").length;
  const intakeInReview = intakeRows.filter((row) => row.status === "in_review").length;
  const intakeProcessing = intakeRows.filter((row) => row.status === "processing" && row.ocr_status !== "failed").length;
  const intakeCompleted = intakeRows.filter((row) => row.status === "completed").length;
  const intakeActive = intakeRows.filter((row) => ["ready_for_review", "in_review", "processing", "needs_attention"].includes(row.status)).length;
  const intakeReceived30d = intakeRows.filter((row) => new Date(row.created_at).getTime() >= thirtyDaysAgo).length;
  const intakeCompleted30d = intakeRows.filter((row) => row.status === "completed" && new Date(row.updated_at).getTime() >= thirtyDaysAgo).length;
  const recentActiveIntakes = intakeRows.filter((row) => !["completed", "rejected"].includes(row.status)).slice(0, 5);

  const allActions: ActionItem[] = [
    ...(canReviewPolicyIntakes ? [{
      label: "Policy Intakes need review",
      value: intakeAction,
      detail: intakeManual ? `${intakeManual} manual OCR review` : undefined,
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
      label: "Documents pending review",
      value: dashboard.attention.documents,
      href: canViewClaims ? "/claims" : "/customers/applications",
      icon: DASHBOARD_ICON_ASSETS.documentsPending,
      tone: "neutral" as const,
    }] : []),
    ...(canViewKyc ? [{
      label: "KYC corrections requested",
      value: dashboard.attention.changesRequested,
      detail: dashboard.attention.submittedOnboarding ? `${dashboard.attention.submittedOnboarding} submitted` : undefined,
      href: "/customers/applications",
      icon: DASHBOARD_ICON_ASSETS.kycCorrection,
      tone: "info" as const,
    }] : []),
    ...(accounts?.overdueInvoiceCount ? [{
      label: "Insurer receivables overdue",
      value: accounts.overdueInvoiceCount,
      detail: formatMoney(accounts.overdueReceivableAmount),
      href: "/accounts/receivables",
      icon: DASHBOARD_ICON_ASSETS.receivableOverdue,
      tone: "warning" as const,
    }] : []),
  ];
  const actionItems = allActions.filter((item) => item.value > 0).slice(0, 6);

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
      meta: dashboard.totals.recentClaims ? `${dashboard.totals.recentClaims} new / 30d` : undefined,
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
    ...(canViewCustomers ? [{
      label: "Active customers",
      value: dashboard.totals.activeCustomers,
      meta: dashboard.totals.newCustomers ? `${dashboard.totals.newCustomers} added / 30d` : undefined,
      href: "/customers",
      icon: DASHBOARD_ICON_ASSETS.customers,
    }] : []),
  ];

  const snapshotItems: SnapshotItem[] = [
    ...(canViewCustomers ? [{ icon: DASHBOARD_ICON_ASSETS.customers, value: dashboard.totals.newCustomers, label: "New customers" }] : []),
    ...(canViewClaims ? [{ icon: DASHBOARD_ICON_ASSETS.claimsIntimatedToday, value: dashboard.totals.recentClaims, label: "Claims reported" }] : []),
    ...(canViewPolicyIntakes ? [
      { icon: DASHBOARD_ICON_ASSETS.intakesReceived, value: intakeReceived30d, label: "Intakes received" },
      { icon: DASHBOARD_ICON_ASSETS.policyBooked, value: intakeCompleted30d, label: "Intakes completed" },
    ] : []),
    ...(!canViewPolicyIntakes && canViewKyc ? [
      { icon: DASHBOARD_ICON_ASSETS.kyc, value: dashboard.attention.onboarding, label: "KYC in progress" },
      { icon: DASHBOARD_ICON_ASSETS.kycCorrection, value: dashboard.attention.changesRequested, label: "KYC corrections" },
    ] : []),
    ...(canViewTasks ? [{ icon: DASHBOARD_ICON_ASSETS.tasksWorkQueue, value: dashboard.attention.openTasks, label: "Open tasks" }] : []),
  ].slice(0, 4);

  const showPrimaryWorkQueue = canViewPolicyIntakes || canViewKyc;
  const warnings = [...dashboard.errors, intakeWarning, accountsWarning, ...analytics.warnings].filter(Boolean) as string[];
  const generatedAt = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const generatedDate = now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
  const renewalBeyond45 = analytics.renewal?.beyond45 ?? Math.max(dashboard.totals.activePolicies - dashboard.totals.expiringPolicies, 0);
  const renewalMax = analytics.renewal
    ? Math.max(analytics.renewal.expired, analytics.renewal.due0to7, analytics.renewal.due8to15, analytics.renewal.due16to30, analytics.renewal.due31to45, analytics.renewal.beyond45, 1)
    : Math.max(dashboard.totals.expiredPolicies, dashboard.totals.expiringPolicies, renewalBeyond45, 1);
  const claimClosed = Math.max(dashboard.totals.claims - dashboard.totals.openClaims, 0);
  const claimMax = analytics.claimAging
    ? Math.max(analytics.claimAging.under3, analytics.claimAging.days3to7, analytics.claimAging.days8to15, analytics.claimAging.days16to30, analytics.claimAging.over30, 1)
    : Math.max(dashboard.totals.openClaims, dashboard.totals.recentClaims, claimClosed, 1);

  return (
    <ClaimManagerShell title="Operations Overview" activeNav="dashboard">
      <main className="mx-auto max-w-[1580px] pb-12">
        <header className="flex flex-col gap-4 border-b border-[#DDE4EC] pb-4 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.13em] text-[#7F8CA0]">
              <span>Operations</span>
              <span className="h-1 w-1 bg-[#17BFC5]" />
              <span>{generatedDate}</span>
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

        <section className="mt-6 border-y border-[#DDE4EC] bg-white">
          <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,.7fr)]">
            <div className="min-w-0 xl:border-r xl:border-[#DDE4EC]">
              <SectionLine title="Action Center" href="/notifications" />
              {actionItems.length ? <div className="divide-y divide-[#E8EDF3]">{actionItems.map((item) => <ActionRow key={item.label} item={item} />)}</div> : <AllClear />}
            </div>
            <div className="min-w-0 border-t border-[#DDE4EC] xl:border-t-0">
              <div className="flex h-[53px] items-center justify-between border-b border-[#E8EDF3] px-5">
                <h2 className="text-[12px] font-bold text-[#1D2A43]">Last 30 days</h2>
                {canViewCustomers ? <Link href="/customers" className="text-[9px] font-bold text-[#5B6880] hover:text-[#263B66]">{dashboard.totals.customers.toLocaleString("en-IN")} customers</Link> : null}
              </div>
              {snapshotItems.length ? <div className="grid grid-cols-2">{snapshotItems.map((item, index) => <SnapshotCell key={item.label} item={item} index={index} />)}</div> : <div className="px-5 py-8 text-[9px] text-[#7B8799]">No activity metrics available.</div>}
            </div>
          </div>
        </section>

        {accounts ? <section className="mt-6 grid border-y border-[#DDE4EC] bg-white lg:grid-cols-[250px_repeat(3,minmax(0,1fr))]">
          <div className="flex items-center gap-3 px-5 py-4 lg:border-r lg:border-[#DDE4EC]">
            <DashboardIcon src={DASHBOARD_ICON_ASSETS.accountsFinance} size={36} />
            <div>
              <h2 className="text-[12px] font-bold text-[#17365D]">Financial operations</h2>
              <Link href="/accounts" className="mt-1 inline-flex items-center gap-1 text-[8.5px] font-bold text-[#617085] hover:text-[#17365D]">Accounts <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          </div>
          <MoneyRail label="Insurer receivable" value={accounts.receivableOutstanding} meta={accounts.overdueInvoiceCount ? `${accounts.overdueInvoiceCount} overdue` : undefined} href="/accounts/receivables" divided />
          <MoneyRail label="Past-due receivable" value={accounts.overdueReceivableAmount} href="/accounts/receivables" divided />
          <MoneyRail label="Partner payable" value={accounts.partnerPayableOutstanding} meta={accounts.partnerPayableCount ? `${accounts.partnerPayableCount} open` : undefined} href="/accounts/partner-payables" divided />
        </section> : null}

        {(canViewPolicies || canViewClaims) ? <section className={`mt-6 grid border-y border-[#DDE4EC] bg-white ${canViewPolicies && canViewClaims ? "xl:grid-cols-2" : "grid-cols-1"}`}>
          {canViewPolicies ? <div className={`min-w-0 px-5 py-5 ${canViewClaims ? "xl:border-r xl:border-[#DDE4EC]" : ""}`}>
            <ChartHeader title="Renewals" value={dashboard.totals.expiringPolicies + dashboard.totals.expiredPolicies} href="/policies" />
            <div className="mt-5 space-y-3">{analytics.renewal ? <>
              <Bar label="Expired" value={analytics.renewal.expired} max={renewalMax} tone="bg-[#E45F56]" />
              <Bar label="0–7 days" value={analytics.renewal.due0to7} max={renewalMax} tone="bg-[#E1843F]" />
              <Bar label="8–15 days" value={analytics.renewal.due8to15} max={renewalMax} tone="bg-[#D9A12F]" />
              <Bar label="16–30 days" value={analytics.renewal.due16to30} max={renewalMax} tone="bg-[#8170D8]" />
              <Bar label="31–45 days" value={analytics.renewal.due31to45} max={renewalMax} tone="bg-[#6257C9]" />
            </> : <>
              <Bar label="Expired" value={dashboard.totals.expiredPolicies} max={renewalMax} tone="bg-[#E45F56]" />
              <Bar label="Within 45 days" value={dashboard.totals.expiringPolicies} max={renewalMax} tone="bg-[#D9A12F]" />
              <Bar label="Beyond 45 days" value={renewalBeyond45} max={renewalMax} tone="bg-[#6257C9]" />
            </>}</div>
          </div> : null}

          {canViewClaims ? <div className="min-w-0 border-t border-[#DDE4EC] px-5 py-5 xl:border-t-0">
            <ChartHeader title="Claim aging" value={dashboard.totals.openClaims} href="/claims" />
            <div className="mt-5 space-y-3">{analytics.claimAging ? <>
              <Bar label="Under 3 days" value={analytics.claimAging.under3} max={claimMax} tone="bg-[#24AFA8]" />
              <Bar label="3–7 days" value={analytics.claimAging.days3to7} max={claimMax} tone="bg-[#4D9CCB]" />
              <Bar label="8–15 days" value={analytics.claimAging.days8to15} max={claimMax} tone="bg-[#6257C9]" />
              <Bar label="16–30 days" value={analytics.claimAging.days16to30} max={claimMax} tone="bg-[#D09238]" />
              <Bar label="Over 30 days" value={analytics.claimAging.over30} max={claimMax} tone="bg-[#E45F56]" />
            </> : <>
              <Bar label="Open" value={dashboard.totals.openClaims} max={claimMax} tone="bg-[#E45F56]" />
              <Bar label="Reported / 30d" value={dashboard.totals.recentClaims} max={claimMax} tone="bg-[#6257C9]" />
              <Bar label="Closed / settled" value={claimClosed} max={claimMax} tone="bg-[#24AFA8]" />
            </>}</div>
          </div> : null}
        </section> : null}

        {(showPrimaryWorkQueue || canViewClaims) ? <section className={`mt-6 grid border-y border-[#DDE4EC] bg-white ${showPrimaryWorkQueue && canViewClaims ? "xl:grid-cols-2" : "grid-cols-1"}`}>
          {showPrimaryWorkQueue ? <QueueColumn title={canViewPolicyIntakes ? "Policy Intake" : "Onboarding"} href={canViewPolicyIntakes ? "/policy-intakes" : "/customers/applications"} divided={canViewClaims}>
            {canViewPolicyIntakes ? recentActiveIntakes.map((row) => <IntakeQueueRow key={row.id} row={row} />) : dashboard.recentApplications.slice(0, 5).map((row) => <Link key={row.id} href={`/customers/applications/${row.id}`} className="group flex min-h-[58px] items-center gap-3 border-b border-[#EDF1F5] px-5 py-2.5 last:border-b-0"><DashboardIcon src={DASHBOARD_ICON_ASSETS.kyc} size={28} /><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-[#1A2743]">{row.display_name || "Customer application"}</p><p className="mt-0.5 text-[8.5px] text-[#7C899B]">{row.status.replaceAll("_", " ")} · {formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A5AEBD] group-hover:text-[#263B66]" /></Link>)}
            {canViewPolicyIntakes && !recentActiveIntakes.length ? <EmptyQueue label="No active Policy Intakes" /> : null}
            {!canViewPolicyIntakes && !dashboard.recentApplications.length ? <EmptyQueue label="No KYC applications" /> : null}
          </QueueColumn> : null}

          {canViewClaims ? <QueueColumn title="Claim movement" href="/claims">
            {dashboard.latestClaims.slice(0, 5).map((row) => <Link key={row.id} href={`/claims/${row.id}`} className="group flex min-h-[58px] items-center gap-3 border-b border-[#EDF1F5] px-5 py-2.5 last:border-b-0"><DashboardIcon src={DASHBOARD_ICON_ASSETS.claims} size={28} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-baseline gap-2"><p className="truncate text-[10px] font-bold text-[#1A2743]">{row.vehicles?.vehicle_no ?? row.claim_no}</p><span className="shrink-0 text-[7.5px] font-bold uppercase tracking-[.04em] text-[#C95348]">{row.current_status}</span></div><p className="mt-0.5 truncate text-[8.5px] text-[#7C899B]">{row.customers?.company_name ?? row.customers?.contact_name ?? "Customer"} · {row.claim_no} · {formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A5AEBD] group-hover:text-[#263B66]" /></Link>)}
            {!dashboard.latestClaims.length ? <EmptyQueue label="No recent claim movement" /> : null}
          </QueueColumn> : null}
        </section> : null}
      </main>
    </ClaimManagerShell>
  );
}

function MetricRailItem({ metric, divided }: { metric: MetricItem; divided: boolean }) {
  return <Link href={metric.href} className={`group flex min-h-[112px] items-center gap-4 px-5 py-4 transition hover:bg-[#F8FAFC] ${divided ? "border-t border-[#E7ECF2] sm:border-l sm:border-t-0" : ""}`}><DashboardIcon src={metric.icon} size={40} /><div className="min-w-0 flex-1"><p className="portal-display text-[30px] font-semibold leading-none tracking-[-.035em] text-[#14233D]">{metric.value.toLocaleString("en-IN")}</p><div className="mt-2 flex items-center gap-2"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#526079]">{metric.label}</p>{metric.meta ? <span className="truncate text-[8px] font-semibold text-[#8A95A6]">{metric.meta}</span> : null}</div></div><ArrowUpRight className="h-3.5 w-3.5 text-[#ABB5C4] group-hover:text-[#263B66]" /></Link>;
}

function ActionRow({ item }: { item: ActionItem }) {
  const accent = { critical: "bg-[#E45F56]", warning: "bg-[#D79532]", info: "bg-[#6257C9]", neutral: "bg-[#8A96A8]" }[item.tone];
  return <Link href={item.href} className="group grid min-h-[64px] grid-cols-[4px_38px_minmax(0,1fr)_auto_20px] items-center gap-3 px-5 transition hover:bg-[#F8FAFC]"><span className={`h-7 w-[3px] ${accent}`} /><DashboardIcon src={item.icon} size={30} /><div className="min-w-0"><p className="truncate text-[10px] font-bold text-[#1A2743]">{item.label}</p>{item.detail ? <p className="mt-0.5 text-[8.5px] font-semibold text-[#7D899A]">{item.detail}</p> : null}</div><strong className="portal-display text-[21px] font-semibold text-[#17223D]">{item.value.toLocaleString("en-IN")}</strong><ChevronRight className="h-3.5 w-3.5 text-[#ACB5C2] group-hover:text-[#263B66]" /></Link>;
}

function AllClear() {
  return <div className="flex min-h-[142px] items-center gap-3 px-5"><DashboardIcon src={DASHBOARD_ICON_ASSETS.tasksCompleted} size={36} /><p className="text-[10px] font-bold text-[#526079]">No urgent exceptions</p></div>;
}

function SnapshotCell({ item, index }: { item: SnapshotItem; index: number }) {
  return <div className={`flex min-h-[88px] items-center gap-3 px-5 py-3 ${index % 2 ? "border-l border-[#E8EDF3]" : ""} ${index > 1 ? "border-t border-[#E8EDF3]" : ""}`}><DashboardIcon src={item.icon} size={30} /><div><p className="portal-display text-[22px] font-semibold leading-none text-[#17223D]">{item.value.toLocaleString("en-IN")}</p><p className="mt-1.5 text-[8.5px] font-semibold text-[#7C899B]">{item.label}</p></div></div>;
}

function MoneyRail({ label, value, meta, href, divided }: { label: string; value: number; meta?: string; href: string; divided?: boolean }) {
  return <Link href={href} className={`group flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-[#F8FAFC] ${divided ? "border-t border-[#E7ECF2] lg:border-l lg:border-t-0" : ""}`}><div><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#7B8899]">{label}</p><p className="portal-display mt-1 text-[20px] font-semibold text-[#17365D]">{formatMoney(value)}</p>{meta ? <p className="mt-1 text-[8px] font-semibold text-[#8A95A6]">{meta}</p> : null}</div><ArrowUpRight className="h-3.5 w-3.5 text-[#ADB6C3] group-hover:text-[#17365D]" /></Link>;
}

function SectionLine({ title, href }: { title: string; href: string }) {
  return <div className="flex h-[53px] items-center justify-between border-b border-[#E8EDF3] px-5"><h2 className="text-[12px] font-bold text-[#1D2A43]">{title}</h2><Link href={href} className="inline-flex items-center gap-1 text-[8.5px] font-bold text-[#6C788B] hover:text-[#263B66]">View all <ArrowUpRight className="h-3 w-3" /></Link></div>;
}

function ChartHeader({ title, value, href }: { title: string; value: number; href: string }) {
  return <div className="flex items-end justify-between gap-4"><div><h2 className="text-[12px] font-bold text-[#1D2A43]">{title}</h2><p className="portal-display mt-1 text-[24px] font-semibold leading-none text-[#17223D]">{value.toLocaleString("en-IN")}</p></div><Link href={href} className="inline-flex items-center gap-1 text-[8.5px] font-bold text-[#6C788B] hover:text-[#263B66]">View all <ArrowUpRight className="h-3 w-3" /></Link></div>;
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const width = Math.max(value ? 4 : 0, Math.round((value / max) * 100));
  return <div className="grid grid-cols-[112px_minmax(0,1fr)_38px] items-center gap-3"><p className="text-[8.8px] font-semibold text-[#5F6C7F]">{label}</p><div className="h-[5px] bg-[#EEF2F6]"><div className={`h-full ${tone}`} style={{ width: `${width}%` }} /></div><p className="text-right text-[9px] font-bold text-[#26344C]">{value.toLocaleString("en-IN")}</p></div>;
}

function QueueColumn({ title, href, divided, children }: { title: string; href: string; divided?: boolean; children: React.ReactNode }) {
  return <div className={`min-w-0 ${divided ? "xl:border-r xl:border-[#DDE4EC]" : ""}`}><SectionLine title={title} href={href} /><div>{children}</div></div>;
}

function IntakeQueueRow({ row }: { row: IntakeRow }) {
  const failed = row.status === "processing" && row.ocr_status === "failed";
  return <Link href={`/policy-intakes/${row.id}`} className="group flex min-h-[58px] items-center gap-3 border-b border-[#EDF1F5] px-5 py-2.5 last:border-b-0"><DashboardIcon src={failed ? DASHBOARD_ICON_ASSETS.ocrManualReview : DASHBOARD_ICON_ASSETS.policyIntake} size={28} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-baseline gap-2"><p className="truncate text-[10px] font-bold text-[#1A2743]">{row.intake_number}</p><span className={`shrink-0 text-[7.5px] font-bold uppercase tracking-[.04em] ${intakeTextTone(row)}`}>{intakeLabel(row)}</span></div><p className="mt-0.5 truncate text-[8.5px] text-[#7C899B]">{row.lead_source_name} · {row.customer_mobile} · {formatAge(row.created_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A5AEBD] group-hover:text-[#263B66]" /></Link>;
}

function EmptyQueue({ label }: { label: string }) {
  return <div className="flex min-h-[90px] items-center gap-2 px-5 text-[9px] font-semibold text-[#8A95A7]"><Clock3 className="h-3.5 w-3.5" />{label}</div>;
}

function DashboardIcon({ src, size }: { src: string; size: number }) {
  return <Image src={src} alt="" width={size} height={size} className="shrink-0 object-contain" />;
}

function intakeLabel(row: IntakeRow) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Manual review";
  return ({ ready_for_review: "Ready", in_review: "In review", processing: "Processing", needs_attention: "Attention" } as Record<string, string>)[row.status] ?? row.status.replaceAll("_", " ");
}

function intakeTextTone(row: IntakeRow) {
  if (row.status === "processing" && row.ocr_status === "failed") return "text-[#A56B09]";
  if (row.status === "ready_for_review" || row.status === "in_review") return "text-[#5B4DDD]";
  if (row.status === "processing") return "text-[#3D6EA6]";
  return "text-[#68758A]";
}

function metricGrid(count: number) {
  if (count >= 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (count === 3) return "sm:grid-cols-3";
  if (count === 2) return "sm:grid-cols-2";
  return "grid-cols-1";
}

function formatAge(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "recently";
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
