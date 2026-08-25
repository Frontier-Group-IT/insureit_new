import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, CircleAlert, Clock3, Plus, Sparkles } from "lucide-react";
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
  detail: string;
  href: string;
  icon: string;
  tone: "critical" | "warning" | "info" | "neutral";
};

type PulseCard = {
  eyebrow: string;
  value: number;
  title: string;
  detail: string;
  href: string;
  icon: string;
  accent: string;
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
    ...(canReviewPolicyIntakes ? [{ label: "Policy Intakes need review", value: intakeAction, detail: intakeManual ? `${intakeManual} require manual OCR review` : "Ready for Operations review", href: "/policy-intakes", icon: DASHBOARD_ICON_ASSETS.policyIntakeReview, tone: intakeManual ? "warning" as const : "info" as const }] : []),
    ...(canViewPolicies ? [{ label: "Expired policies", value: dashboard.totals.expiredPolicies, detail: "Coverage requires immediate review", href: "/policies", icon: DASHBOARD_ICON_ASSETS.expiredPolicy, tone: "critical" as const }] : []),
    ...(canViewTasks ? [{ label: "Overdue tasks", value: dashboard.attention.overdueTasks, detail: `${dashboard.attention.openTasks} open follow-ups`, href: "/tasks", icon: DASHBOARD_ICON_ASSETS.tasksWorkQueue, tone: "warning" as const }] : []),
    ...((canViewClaims || canViewKyc) ? [{ label: "Documents pending review", value: dashboard.attention.documents, detail: "Pending or returned files", href: canViewClaims ? "/claims" : "/customers/applications", icon: DASHBOARD_ICON_ASSETS.documentsPending, tone: "neutral" as const }] : []),
    ...(canViewKyc ? [{ label: "KYC corrections requested", value: dashboard.attention.changesRequested, detail: `${dashboard.attention.submittedOnboarding} newly submitted`, href: "/customers/applications", icon: DASHBOARD_ICON_ASSETS.kycCorrection, tone: "info" as const }] : []),
    ...(accounts?.overdueInvoiceCount ? [{ label: "Insurer receivables overdue", value: accounts.overdueInvoiceCount, detail: `${formatMoney(accounts.overdueReceivableAmount)} outstanding past due`, href: "/accounts/receivables", icon: DASHBOARD_ICON_ASSETS.receivableOverdue, tone: "warning" as const }] : []),
  ];
  const actionItems = allActions.filter((item) => item.value > 0).slice(0, 6);

  const pulseCards: PulseCard[] = [
    ...(canViewPolicies ? [{ eyebrow: "Policies", value: dashboard.totals.activePolicies, title: "Active policies", detail: `${dashboard.totals.expiringPolicies} due within 45 days`, href: "/policies", icon: DASHBOARD_ICON_ASSETS.policy, accent: "from-[#6257F7]/14 to-[#6257F7]/2" }] : []),
    ...(canViewClaims ? [{ eyebrow: "Claims", value: dashboard.totals.openClaims, title: "Open claims", detail: `${dashboard.totals.recentClaims} reported in 30 days`, href: "/claims", icon: DASHBOARD_ICON_ASSETS.claims, accent: "from-[#FF6F61]/13 to-[#FF6F61]/2" }] : []),
    ...(canViewPolicyIntakes ? [{ eyebrow: "Policy Intake", value: intakeActive, title: "Active intakes", detail: `${intakeAction} action required · ${intakeProcessing} processing`, href: "/policy-intakes", icon: DASHBOARD_ICON_ASSETS.policyIntake, accent: "from-[#7C67F8]/14 to-[#7C67F8]/2" }] : []),
    ...(canViewCustomers ? [{ eyebrow: "Customer base", value: dashboard.totals.activeCustomers, title: "Active customers", detail: `${dashboard.totals.newCustomers} added in 30 days`, href: "/customers", icon: DASHBOARD_ICON_ASSETS.customers, accent: "from-[#17BFC5]/13 to-[#17BFC5]/2" }] : []),
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
  const displayName = firstName(profile?.full_name) || "Operations Team";
  const generatedAt = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const generatedDate = now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" });
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
      <main className="mx-auto max-w-[1580px] space-y-4 pb-10">
        <section className="relative overflow-hidden rounded-[20px] border border-[#243254] bg-[#101A36] px-5 py-4 text-white shadow-[0_22px_60px_rgba(16,26,54,.18)] sm:px-6 lg:px-7">
          <div className="portal-grid pointer-events-none absolute inset-0 opacity-[.13]" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#6759FF]/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[8.5px] font-bold uppercase tracking-[.15em] text-white/50"><span>Operations command center</span><span className="h-1 w-1 rounded-full bg-[#68D8D0]" /><span>{generatedDate}</span></div>
              <div className="mt-2 flex flex-col gap-1.5 lg:flex-row lg:items-end lg:gap-4">
                <h1 className="portal-display text-[24px] font-semibold leading-none sm:text-[28px]">Operations Overview</h1>
                <p className="max-w-[560px] text-[9.5px] leading-4 text-white/58">{displayName}, here is the live operational picture and the work that needs attention next.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[.06] px-3 text-[9px] font-semibold text-white/72"><span className="h-1.5 w-1.5 rounded-full bg-[#61D7CF] shadow-[0_0_0_4px_rgba(97,215,207,.10)]" />Updated {generatedAt}</span>
              {canCreatePolicyIntakes ? <Link href="/policy-intakes/new" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[9px] font-bold text-[#101A36] shadow-lg transition hover:-translate-y-0.5"><Plus className="h-3.5 w-3.5" />New Intake</Link> : null}
              <Link href="/notifications" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6759FF] px-3 text-[9px] font-bold text-white shadow-[0_10px_24px_rgba(103,89,255,.24)] transition hover:-translate-y-0.5">Open Work <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </section>

        {warnings.length ? <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-[10px] text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">Some figures are temporarily unavailable.</p><p className="mt-0.5 text-amber-800">{warnings.join(" ")}</p></div></section> : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(300px,.72fr)]">
          <div className="overflow-hidden rounded-[18px] border border-[#E4E9F1] bg-white shadow-[0_14px_38px_rgba(31,45,76,.05)]">
            <SectionHeader eyebrow="Act" title="Action Center" subtitle="Exceptions worth acting on now, ordered by operational importance." href="/notifications" />
            {actionItems.length ? <div className="divide-y divide-[#EEF1F6] px-3 pb-2 sm:px-4">{actionItems.map((item) => <ActionRow key={item.label} item={item} />)}</div> : <AllClear />}
          </div>

          <div className="overflow-hidden rounded-[18px] border border-[#E4E9F1] bg-[#F8FAFD] shadow-[0_14px_38px_rgba(31,45,76,.04)]">
            <div className="border-b border-[#E8ECF3] px-4 py-4 sm:px-5"><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#8A96A8]">30-day activity</p><div className="mt-1 flex items-center justify-between gap-3"><h2 className="portal-display text-[17px] font-semibold text-[#13203B]">Operating snapshot</h2><Sparkles className="h-4 w-4 text-[#6759FF]" /></div></div>
            {snapshotItems.length ? <div className="grid grid-cols-2 gap-px bg-[#E8ECF3]">{snapshotItems.map((item) => <SnapshotCell key={item.label} {...item} />)}</div> : <div className="px-5 py-8 text-center text-[9px] text-[#7B8799]">No 30-day activity metrics are available for this role.</div>}
            {canViewCustomers ? <Link href="/customers" className="flex items-center justify-between px-4 py-3 text-[9px] font-bold text-[#536079] hover:bg-white sm:px-5"><span>{dashboard.totals.customers.toLocaleString("en-IN")} customers in the current portfolio</span><ChevronRight className="h-3.5 w-3.5" /></Link> : null}
          </div>
        </section>

        {pulseCards.length ? <section className={`grid gap-3 sm:grid-cols-2 ${pulseCards.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`} aria-label="Business pulse">{pulseCards.map((card) => <Pulse key={card.eyebrow} card={card} />)}</section> : null}

        {accounts ? <section className="overflow-hidden rounded-[18px] border border-[#DDE6EA] bg-gradient-to-r from-[#F7FBFA] via-white to-[#FAF9FF] shadow-[0_14px_38px_rgba(31,45,76,.04)]">
          <div className="flex flex-col gap-3 border-b border-[#E7ECEF] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex items-center gap-3"><IconAsset src={DASHBOARD_ICON_ASSETS.accountsFinance} size={38} /><div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#7B8C91]">Accounts pulse</p><h2 className="portal-display mt-0.5 text-[16px] font-semibold text-[#17365D]">Financial operations</h2></div></div><Link href="/accounts" className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#D8E4E5] bg-white px-2.5 text-[8.5px] font-bold text-[#315E62]">Open Accounts <ArrowUpRight className="h-3 w-3" /></Link></div>
          <div className="grid gap-px bg-[#E8EEEF] md:grid-cols-3"><MoneyMetric label="Insurer receivable" value={accounts.receivableOutstanding} detail={`${accounts.overdueInvoiceCount} overdue invoice${accounts.overdueInvoiceCount === 1 ? "" : "s"}`} icon={DASHBOARD_ICON_ASSETS.reconciliation} href="/accounts/receivables" /><MoneyMetric label="Past-due receivable" value={accounts.overdueReceivableAmount} detail="Requires collection follow-up" icon={DASHBOARD_ICON_ASSETS.receivableOverdue} href="/accounts/receivables" /><MoneyMetric label="Partner payable" value={accounts.partnerPayableOutstanding} detail={`${accounts.partnerPayableCount} open payable${accounts.partnerPayableCount === 1 ? "" : "s"}`} icon={DASHBOARD_ICON_ASSETS.partnerIntermediary} href="/accounts/partner-payables" /></div>
        </section> : null}

        {(canViewPolicies || canViewClaims) ? <section className={`grid gap-4 ${canViewPolicies && canViewClaims ? "xl:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]" : "xl:grid-cols-1"}`}>
          {canViewPolicies ? <div className="rounded-[18px] border border-[#E4E9F1] bg-white p-4 shadow-[0_14px_38px_rgba(31,45,76,.045)] sm:p-5">
            <SectionTitle eyebrow="Monitor" title="Renewal pipeline" detail={`${dashboard.totals.expiringPolicies + dashboard.totals.expiredPolicies} policies need renewal attention`} href="/policies" />
            <div className="mt-5 space-y-3.5">{analytics.renewal ? <>
              <Bar label="Expired" value={analytics.renewal.expired} max={renewalMax} tone="bg-[#F06B61]" note="Immediate coverage review" />
              <Bar label="Due in 0–7 days" value={analytics.renewal.due0to7} max={renewalMax} tone="bg-[#EA8B42]" note="Highest-priority renewal window" />
              <Bar label="Due in 8–15 days" value={analytics.renewal.due8to15} max={renewalMax} tone="bg-[#E8A93B]" note="Near-term renewal pipeline" />
              <Bar label="Due in 16–30 days" value={analytics.renewal.due16to30} max={renewalMax} tone="bg-[#8E77E8]" note="Upcoming renewals" />
              <Bar label="Due in 31–45 days" value={analytics.renewal.due31to45} max={renewalMax} tone="bg-[#6D63E8]" note="Early renewal window" />
            </> : <>
              <Bar label="Expired" value={dashboard.totals.expiredPolicies} max={renewalMax} tone="bg-[#F06B61]" note="Immediate coverage review" />
              <Bar label="Due within 45 days" value={dashboard.totals.expiringPolicies} max={renewalMax} tone="bg-[#E8A93B]" note="Renewal pipeline" />
              <Bar label="Active beyond 45 days" value={renewalBeyond45} max={renewalMax} tone="bg-[#6D63E8]" note="Healthy active book" />
            </>}</div>
          </div> : null}
          {canViewClaims ? <div className="rounded-[18px] border border-[#E4E9F1] bg-white p-4 shadow-[0_14px_38px_rgba(31,45,76,.045)] sm:p-5">
            <SectionTitle eyebrow="Monitor" title="Open-claim aging" detail={`${dashboard.totals.openClaims} claims currently open`} href="/claims" />
            <div className="mt-5 space-y-3.5">{analytics.claimAging ? <>
              <Bar label="Under 3 days" value={analytics.claimAging.under3} max={claimMax} tone="bg-[#28B7AE]" note="Newly opened claims" />
              <Bar label="3–7 days" value={analytics.claimAging.days3to7} max={claimMax} tone="bg-[#54A7D9]" note="Early active handling" />
              <Bar label="8–15 days" value={analytics.claimAging.days8to15} max={claimMax} tone="bg-[#6A62EA]" note="Developing claim inventory" />
              <Bar label="16–30 days" value={analytics.claimAging.days16to30} max={claimMax} tone="bg-[#D89B42]" note="Older open claims" />
              <Bar label="Over 30 days" value={analytics.claimAging.over30} max={claimMax} tone="bg-[#F06B61]" note="Long-running open claims" />
            </> : <>
              <Bar label="Open inventory" value={dashboard.totals.openClaims} max={claimMax} tone="bg-[#FF7668]" note="Current operational load" />
              <Bar label="Reported in 30 days" value={dashboard.totals.recentClaims} max={claimMax} tone="bg-[#6A62EA]" note="Recent claim inflow" />
              <Bar label="Closed / settled" value={claimClosed} max={claimMax} tone="bg-[#28B7AE]" note="Cumulative completed inventory" />
            </>}</div>
          </div> : null}
        </section> : null}

        {(showPrimaryWorkQueue || canViewClaims) ? <section className={`grid gap-4 ${showPrimaryWorkQueue && canViewClaims ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}>
          {showPrimaryWorkQueue ? <QueuePanel title={canViewPolicyIntakes ? "Policy Intake queue" : "Onboarding queue"} subtitle={canViewPolicyIntakes ? `${intakeInReview} in review · ${intakeProcessing} processing · ${intakeCompleted} completed` : `${dashboard.attention.onboarding} KYC applications need processing`} href={canViewPolicyIntakes ? "/policy-intakes" : "/customers/applications"}>
            {canViewPolicyIntakes ? recentActiveIntakes.map((row) => <IntakeQueueRow key={row.id} row={row} />) : dashboard.recentApplications.slice(0, 5).map((row) => <Link key={row.id} href={`/customers/applications/${row.id}`} className="group flex items-center gap-3 py-3"><IconAsset src={DASHBOARD_ICON_ASSETS.kyc} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-[10.5px] font-bold text-[#1A2743]">{row.display_name || "Customer application"}</p><p className="mt-0.5 truncate text-[9px] text-[#778399]">{row.status.replaceAll("_", " ")} · {formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A5AEBD] group-hover:text-[#6759FF]" /></Link>)}
            {canViewPolicyIntakes && !recentActiveIntakes.length ? <EmptyQueue label="No active Policy Intakes right now" /> : null}
            {!canViewPolicyIntakes && !dashboard.recentApplications.length ? <EmptyQueue label="No KYC applications need attention" /> : null}
          </QueuePanel> : null}
          {canViewClaims ? <QueuePanel title="Latest claim movement" subtitle="Recent movement across the claim portfolio." href="/claims">
            {dashboard.latestClaims.slice(0, 5).map((row) => <Link key={row.id} href={`/claims/${row.id}`} className="group flex items-center gap-3 py-3"><IconAsset src={DASHBOARD_ICON_ASSETS.claims} size={32} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-[10.5px] font-bold text-[#1A2743]">{row.vehicles?.vehicle_no ?? row.claim_no}</p><span className="shrink-0 rounded-full bg-[#FFF0ED] px-2 py-0.5 text-[7.5px] font-bold uppercase tracking-[.04em] text-[#C95348]">{row.current_status}</span></div><p className="mt-0.5 truncate text-[9px] text-[#778399]">{row.customers?.company_name ?? row.customers?.contact_name ?? "Customer"} · {row.claim_no} · {formatAge(row.updated_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A5AEBD] group-hover:text-[#6759FF]" /></Link>)}
            {!dashboard.latestClaims.length ? <EmptyQueue label="No recent claim movement" /> : null}
          </QueuePanel> : null}
        </section> : null}
      </main>
    </ClaimManagerShell>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const tone = { critical: "border-[#FFD9D4] bg-[#FFF8F6]", warning: "border-[#F7E2B8] bg-[#FFFBF2]", info: "border-[#DED9FF] bg-[#FAF9FF]", neutral: "border-[#E4E9F1] bg-[#FAFBFD]" }[item.tone];
  return <Link href={item.href} className="group block py-2.5"><div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_28px_rgba(31,45,76,.07)] ${tone}`}><IconAsset src={item.icon} size={38} /><div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><p className="text-[10.5px] font-bold text-[#17223D]">{item.label}</p><strong className="portal-display text-[19px] font-semibold text-[#17223D]">{item.value.toLocaleString("en-IN")}</strong></div><p className="mt-0.5 truncate text-[8.8px] text-[#778399]">{item.detail}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-[#ABB4C3] transition group-hover:translate-x-0.5 group-hover:text-[#6759FF]" /></div></Link>;
}

function AllClear() {
  return <div className="flex min-h-[210px] items-center justify-center px-6 py-8 text-center"><div><div className="flex justify-center"><IconAsset src={DASHBOARD_ICON_ASSETS.tasksCompleted} size={50} /></div><p className="mt-4 text-[12px] font-bold text-[#20304A]">No urgent exceptions right now</p><p className="mx-auto mt-1 max-w-[360px] text-[9px] leading-4 text-[#7A8799]">The monitored queues are clear. New exceptions will appear here automatically as operational data changes.</p></div></div>;
}

function Pulse({ card }: { card: PulseCard }) {
  return <Link href={card.href} className="group relative overflow-hidden rounded-[18px] border border-[#E4E9F1] bg-white p-4 shadow-[0_10px_30px_rgba(31,45,76,.04)] transition hover:-translate-y-0.5 hover:border-[#D9D5FA] hover:shadow-[0_16px_36px_rgba(31,45,76,.07)]"><div className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${card.accent}`} /><div className="relative flex items-start justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#8995A7]">{card.eyebrow}</p><p className="portal-display mt-2.5 text-[28px] font-semibold leading-none text-[#13203B]">{card.value.toLocaleString("en-IN")}</p></div><IconAsset src={card.icon} size={44} /></div><div className="relative mt-3.5 border-t border-[#EEF1F5] pt-3"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold text-[#23304A]">{card.title}</p><ArrowUpRight className="h-3.5 w-3.5 text-[#A5AEBD] group-hover:text-[#6759FF]" /></div><p className="mt-1 text-[8.5px] text-[#7A869A]">{card.detail}</p></div></Link>;
}

function SnapshotCell({ icon, value, label }: SnapshotItem) {
  return <div className="bg-white px-4 py-4"><div className="flex items-center gap-3"><IconAsset src={icon} size={32} /><div><p className="portal-display text-[19px] font-semibold leading-none text-[#17223D]">{value.toLocaleString("en-IN")}</p><p className="mt-1.5 text-[8.2px] font-semibold text-[#7B8799]">{label}</p></div></div></div>;
}

function MoneyMetric({ label, value, detail, icon, href }: { label: string; value: number; detail: string; icon: string; href: string }) {
  return <Link href={href} className="group flex items-center gap-3 bg-white/80 px-4 py-4 transition hover:bg-white sm:px-5"><IconAsset src={icon} size={34} /><div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#7C8A94]">{label}</p><p className="portal-display mt-1 text-[18px] font-semibold text-[#17365D]">{formatMoney(value)}</p><p className="mt-0.5 truncate text-[8.5px] text-[#7D8997]">{detail}</p></div><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#A5AEBD] group-hover:text-[#0F766E]" /></Link>;
}

function QueuePanel({ title, subtitle, href, children }: { title: string; subtitle: string; href: string; children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-[18px] border border-[#E4E9F1] bg-white shadow-[0_14px_38px_rgba(31,45,76,.045)]"><SectionHeader eyebrow="Work" title={title} subtitle={subtitle} href={href} /><div className="divide-y divide-[#EEF1F6] px-4 pb-2">{children}</div></div>;
}

function SectionHeader({ eyebrow, title, subtitle, href }: { eyebrow: string; title: string; subtitle: string; href: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[#EDF0F5] px-4 py-4 sm:px-5"><div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#8995A7]">{eyebrow}</p><div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="portal-display text-[17px] font-semibold text-[#13203B]">{title}</h2><p className="text-[8.8px] text-[#7B8799]">{subtitle}</p></div></div><Link href={href} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-[#E3E7EE] bg-[#FAFBFD] px-2.5 text-[8.5px] font-bold text-[#536079] hover:border-[#D7D1FB] hover:bg-white hover:text-[#6759FF]">View all <ArrowUpRight className="h-3 w-3" /></Link></div>;
}

function SectionTitle({ eyebrow, title, detail, href }: { eyebrow: string; title: string; detail: string; href: string }) {
  return <div className="flex items-start justify-between gap-4"><div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#8995A7]">{eyebrow}</p><h2 className="portal-display mt-1 text-[17px] font-semibold text-[#13203B]">{title}</h2><p className="mt-1 text-[8.8px] text-[#7B8799]">{detail}</p></div><Link href={href} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#E3E7EE] bg-[#FAFBFD] text-[#768297] hover:border-[#D7D1FB] hover:bg-white hover:text-[#6759FF]"><ArrowUpRight className="h-3.5 w-3.5" /></Link></div>;
}

function Bar({ label, value, max, tone, note }: { label: string; value: number; max: number; tone: string; note: string }) {
  const width = Math.max(value ? 5 : 0, Math.round((value / max) * 100));
  return <div><div className="mb-2 flex items-end justify-between gap-4"><div><p className="text-[9.8px] font-bold text-[#27344E]">{label}</p><p className="mt-0.5 text-[8.3px] text-[#8A95A7]">{note}</p></div><p className="portal-display text-[17px] font-semibold text-[#17223D]">{value.toLocaleString("en-IN")}</p></div><div className="h-2 overflow-hidden rounded-full bg-[#EFF2F6]"><div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} /></div></div>;
}

function IntakeQueueRow({ row }: { row: IntakeRow }) {
  return <Link href={`/policy-intakes/${row.id}`} className="group flex items-center gap-3 py-3"><IconAsset src={row.ocr_status === "failed" ? DASHBOARD_ICON_ASSETS.ocrManualReview : DASHBOARD_ICON_ASSETS.policyIntake} size={32} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-[10.5px] font-bold text-[#1A2743]">{row.intake_number}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[7.5px] font-bold uppercase tracking-[.04em] ${intakeTone(row)}`}>{intakeLabel(row)}</span></div><p className="mt-0.5 truncate text-[9px] text-[#778399]">{row.lead_source_name} · {row.customer_mobile} · {formatAge(row.created_at)}</p></div><ChevronRight className="h-3.5 w-3.5 text-[#A5AEBD] group-hover:text-[#6759FF]" /></Link>;
}

function EmptyQueue({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 py-8 text-[9.5px] font-semibold text-[#8A95A7]"><Clock3 className="h-4 w-4" />{label}</div>;
}

function IconAsset({ src, size }: { src: string; size: number }) {
  return <span className="grid shrink-0 place-items-center rounded-2xl bg-white/75 ring-1 ring-[#E7EBF2] shadow-[0_7px_18px_rgba(31,45,76,.055)]" style={{ width: size + 8, height: size + 8 }}><Image src={src} alt="" width={size} height={size} className="object-contain" /></span>;
}

function intakeLabel(row: IntakeRow) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Manual review";
  return ({ ready_for_review: "Ready", in_review: "In review", processing: "Processing", needs_attention: "Attention" } as Record<string, string>)[row.status] ?? row.status.replaceAll("_", " ");
}

function intakeTone(row: IntakeRow) {
  if (row.status === "processing" && row.ocr_status === "failed") return "bg-[#FFF3D9] text-[#A56B09]";
  if (row.status === "ready_for_review" || row.status === "in_review") return "bg-[#EEEAFE] text-[#5B4DDD]";
  if (row.status === "processing") return "bg-[#EAF4FF] text-[#3D6EA6]";
  return "bg-[#F1F3F6] text-[#68758A]";
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

function firstName(value?: string | null) {
  return value?.trim().split(/\s+/)[0] ?? "";
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
