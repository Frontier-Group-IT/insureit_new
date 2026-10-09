import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, Plus, TrendingUp } from "lucide-react";
import { DASHBOARD_ICON_ASSETS } from "@/lib/dashboard-icon-assets";
import type {
  DashboardAccess,
  DashboardCurrentData,
  DashboardIntakeRow,
} from "./dashboard-data";
import type {
  DashboardBusinessData,
  DashboardBusinessMixRow,
  DashboardBusinessRankRow,
} from "./dashboard-business";
import { BusinessFilterPopover } from "./dashboard-business-filter-popover";

type Props = {
  data: DashboardCurrentData;
  access: DashboardAccess;
  business: DashboardBusinessData;
  canCreatePolicy: boolean;
  canCreatePolicyIntake: boolean;
};

type AttentionSignal = {
  label: string;
  value: number;
  detail?: string;
  href: string;
  icon: string;
  tone: "red" | "amber" | "violet" | "teal" | "slate";
};

type RailMetric = {
  policyBreakdown?: { motor: number; nonMotor: number; life: number; health: number; other: number };
  label: string;
  value: string;
  meta?: string;
  secondary?: {
    label: string;
    value: string;
    meta?: string;
  };
  href: string;
  icon: string;
};

export function DashboardFullyLoaded({ data, access, business, canCreatePolicy, canCreatePolicyIntake }: Props) {
  const attention = buildAttention(data, access, business);
  const rail = buildMetricRail(data, access, business);
  const renewalTotal = data.renewals
    ? data.renewals.expired + data.renewals.due0to7 + data.renewals.due8to15 + data.renewals.due16to30 + data.renewals.due31to45
    : 0;
  const showHealth = Boolean(data.claims || data.fleet || renewalTotal > 0);
  const hasWork = Boolean(
    (data.policyIntakes?.recent.length ?? 0) > 0 ||
    (access.viewClaims && (data.claims?.recent.length ?? 0) > 0),
  );

  return (
    <div className="mx-auto max-w-[1580px] pb-10">
      <header className="flex flex-col gap-4 border-b border-[#D5DEE9] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.15em] text-[#7B8799]">
            <span>Operations</span>
            <span className="h-1 w-1 bg-[#18BFC2]" />
            <span>{formatHeaderDate(data.generatedAt)}</span>
          </div>
          <h1 className="portal-display mt-1.5 text-[30px] font-semibold leading-none tracking-[-.025em] text-[#10213D] sm:text-[34px]">
            Operations Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[8.5px] font-semibold text-[#7A879A]">
            Updated {formatHeaderTime(data.generatedAt)}
          </span>
          {access.viewReports ? (
            <Link
              prefetch={false}
              href="/rm-performance"
              className="inline-flex h-9 items-center gap-1.5 border border-[#BFCBDA] bg-white px-3 text-[8.5px] font-bold text-[#1E2E4A] transition hover:border-[#8298B5] hover:bg-[#F8FAFC]"
            >
              <TrendingUp className="h-3.5 w-3.5" /> RM Performance
            </Link>
          ) : null}
          {canCreatePolicy ? (
            <Link prefetch={false}
              href="/policies/new"
              className="inline-flex h-9 items-center gap-1.5 border border-[#BFCBDA] bg-white px-3 text-[8.5px] font-bold text-[#1E2E4A] transition hover:border-[#8298B5] hover:bg-[#F8FAFC]"
            >
              <Plus className="h-3.5 w-3.5" /> Add Policy
            </Link>
          ) : null}
          {canCreatePolicyIntake ? (
            <Link prefetch={false}
              href="/policy-intakes/new"
              className="inline-flex h-9 items-center gap-1.5 bg-[#203A63] px-3 text-[8.5px] font-bold text-white transition hover:bg-[#173157]"
            >
              <Plus className="h-3.5 w-3.5" /> New Intake
            </Link>
          ) : null}
        </div>
      </header>

      {[...data.warnings, ...business.warnings].length ? (
        <div className="mt-4 border-l-2 border-amber-400 bg-amber-50 px-4 py-2.5 text-[9px] font-semibold text-amber-900">
          {[...data.warnings, ...business.warnings].join(" ")}
        </div>
      ) : null}

      {rail.length ? (
        <section className={`mt-5 grid border-y border-[#D8E0EA] bg-white ${railGrid(rail.length)}`}>
          {rail.map((item, index) => (
            <MetricRail key={item.label} item={item} divided={index > 0} />
          ))}
        </section>
      ) : null}

      {attention.length ? <NeedsAttention items={attention} /> : null}

      {access.viewPolicies ? <BusinessPerformance business={business} /> : null}

      {business.commercial ? <CommercialOperations business={business} canOpenControl={access.viewAccounts} /> : null}

      {showHealth ? <PortfolioHealth data={data} renewalTotal={renewalTotal} /> : null}

      {hasWork ? <WorkMovement data={data} access={access} /> : null}
    </div>
  );
}

function buildMetricRail(data: DashboardCurrentData, access: DashboardAccess, _business: DashboardBusinessData): RailMetric[] {
  const metrics: RailMetric[] = [];

  if (access.viewPolicies) {
    const composition = data.portfolio
      ? [
          data.portfolio.motor ? `${data.portfolio.motor} Motor` : null,
          data.portfolio.life ? `${data.portfolio.life} Life` : null,
          data.portfolio.nonMotor ? `${data.portfolio.nonMotor} Non-Motor` : null,
          data.portfolio.health ? `${data.portfolio.health} Health` : null,
          data.portfolio.other ? `${data.portfolio.other} Other` : null,
        ].filter(Boolean).join(" · ")
      : undefined;
    metrics.push({
      label: "Active policies",
      policyBreakdown: data.portfolio ? { motor: data.portfolio.motor, nonMotor: data.portfolio.nonMotor, life: data.portfolio.life, health: data.portfolio.health, other: data.portfolio.other } : undefined,
      value: (data.portfolio?.active ?? data.base.totals.activePolicies).toLocaleString("en-IN"),
      meta: composition || undefined,
      href: "/policies",
      icon: DASHBOARD_ICON_ASSETS.policy,
    });
  }

  if (data.claims) {
    metrics.push({
      label: "Open claims",
      value: data.claims.open.toLocaleString("en-IN"),
      meta: `${formatMoney(data.claims.openAmount)} open amount`,
      secondary: {
        label: "Settled claims",
        value: data.claims.settled.toLocaleString("en-IN"),
        meta: `${formatMoney(data.claims.settledAmount)} amount received`,
      },
      href: "/claims",
      icon: DASHBOARD_ICON_ASSETS.claims,
    });
  }

  if (data.intermediaries) {
    metrics.push({
      label: "Active intermediaries",
      value: data.intermediaries.active.toLocaleString("en-IN"),
      meta: data.intermediaries.pendingApplications ? `${data.intermediaries.pendingApplications} onboarding` : undefined,
      href: "/intermediaries/partner",
      icon: DASHBOARD_ICON_ASSETS.distributionNetwork,
    });
  }

  if (data.fleet) {
    metrics.push({
      label: "Fleet",
      value: data.fleet.total.toLocaleString("en-IN"),
      meta: data.fleet.registrationPending ? `${data.fleet.registrationPending} registration pending` : `${data.fleet.registered} registered`,
      href: "/vehicles",
      icon: DASHBOARD_ICON_ASSETS.fleetVehicle,
    });
  }

  if (access.viewCustomers) {
    metrics.push({
      label: "Customers",
      value: data.base.totals.customers.toLocaleString("en-IN"),
      meta: `${data.base.totals.activeCustomers} active`,
      href: "/customers",
      icon: DASHBOARD_ICON_ASSETS.customers,
    });
  }

  return metrics.slice(0, 6);
}

function buildAttention(data: DashboardCurrentData, access: DashboardAccess, business: DashboardBusinessData): AttentionSignal[] {
  const rows: AttentionSignal[] = [];
  if (data.intermediaries?.pendingApplications) {
    rows.push({
      label: "Intermediary onboarding",
      value: data.intermediaries.pendingApplications,
      href: "/customers/posp-misp",
      icon: DASHBOARD_ICON_ASSETS.partnerIntermediary,
      tone: "teal",
    });
  }

  const renewalAttention = data.renewals
    ? data.renewals.expired + data.renewals.due0to7 + data.renewals.due8to15 + data.renewals.due16to30 + data.renewals.due31to45
    : 0;
  if (renewalAttention) {
    rows.push({
      label: "Renewal attention",
      value: renewalAttention,
      detail: data.renewals?.expired ? `${data.renewals.expired} expired` : undefined,
      href: "/policies",
      icon: DASHBOARD_ICON_ASSETS.renewal,
      tone: data.renewals?.expired ? "red" : "amber",
    });
  }

  if (business.commercial?.reconciliationExceptions) {
    rows.push({
      label: "Commercial reconciliation",
      value: business.commercial.reconciliationExceptions,
      detail: "Pay-In / TDS mismatch",
      href: "/policies/commercial-review",
      icon: DASHBOARD_ICON_ASSETS.reconciliationException,
      tone: "red",
    });
  } else if (business.commercial?.needsReview) {
    rows.push({
      label: "Commercial review",
      value: business.commercial.needsReview,
      href: "/policies/commercial-review",
      icon: DASHBOARD_ICON_ASSETS.reconciliationException,
      tone: "amber",
    });
  }

  if (access.viewTasks && data.tasks?.overdue) {
    rows.push({
      label: "Overdue tasks",
      value: data.tasks.overdue,
      href: "/tasks",
      icon: DASHBOARD_ICON_ASSETS.tasksWorkQueue,
      tone: "amber",
    });
  }

  return rows.slice(0, 6);
}

function NeedsAttention({ items }: { items: AttentionSignal[] }) {
  return (
    <section className="mt-5 border-y border-[#D8E0EA] bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-5">
        <h2 className="text-[10.5px] font-bold text-[#1D2C49]">Needs attention</h2>
        <Link prefetch={false} href="/notifications" className="text-[8px] font-bold text-[#6E7D92] hover:text-[#203A63]">
          View all ↗
        </Link>
      </div>
      <div className={`grid border-t border-[#E8EDF3] ${attentionGrid(items.length)}`}>
        {items.map((item, index) => (
          <AttentionItem key={item.label} item={item} divided={index > 0} />
        ))}
      </div>
    </section>
  );
}

function BusinessPerformance({ business }: { business: DashboardBusinessData }) {
  const commercial = business.grossPremium !== null;
  const motorPolicies = business.businessLineMix.find((row) => row.label === "Motor")?.policies ?? 0;
  const nonMotorPolicies = business.businessLineMix.find((row) => row.label === "Non Motor")?.policies ?? 0;
  const lifePolicies = business.businessLineMix.find((row) => row.label === "Life")?.policies ?? 0;
  const healthPolicies = business.businessLineMix.find((row) => row.label === "Health")?.policies ?? 0;
  const policyBreakdown = [
    { label: "Motor", value: motorPolicies },
    { label: "Non-Motor", value: nonMotorPolicies },
    { label: "Life", value: lifePolicies },
    { label: "Health", value: healthPolicies },
  ];
  const averageNetPremium = business.netPremium !== null && business.policyCount > 0
    ? business.netPremium / business.policyCount
    : 0;
  const headline = [
    ...(commercial ? [
      { label: `Net premium · ${business.periodShortLabel}`, value: formatMoney(business.netPremium ?? 0) },
      { label: "Avg. net / policy", value: formatMoney(averageNetPremium) },
    ] : []),
    { label: "Producing intermediary", value: business.activeProducerCount.toLocaleString("en-IN") },
  ];
  const totalAmount = business.grossPremium ?? 0;

  return (
    <section className="mt-6 border-y border-[#D5DEE9] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Icon src={DASHBOARD_ICON_ASSETS.reportsAnalytics} size={30} />
          <div className="min-w-0">
            <h2 className="whitespace-normal break-words text-[12px] font-bold leading-snug text-[#172844]">Business performance</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="whitespace-normal break-words text-[7.5px] font-bold uppercase tracking-[.11em] text-[#8A96A8]">
                {business.periodLabel}
              </p>
              {business.appliedFilterCount ? (
                <span className="whitespace-normal break-words text-[7px] font-bold leading-relaxed text-[#52657F]">
                  · {business.appliedFilterCount} additional {business.appliedFilterCount === 1 ? "filter" : "filters"}
                </span>
              ) : null}
              {business.incompletePolicies ? (
                <span className="whitespace-normal break-words text-[7px] font-bold leading-relaxed text-[#B66B1D]">
                  · {business.incompletePolicies} incomplete
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BusinessFilterPopover business={business} />
          <Link prefetch={false}
            href="/reports/business"
            className="inline-flex h-9 items-center px-2 text-[8.5px] font-bold text-[#65758B] hover:text-[#203A63]"
          >
            Business reports ↗
          </Link>
        </div>
      </div>

      <div className={`grid border-t border-[#E7ECF2] bg-[linear-gradient(90deg,#FBFCFF,#F8FAFD,#FAFFFE)] ${headlineGrid(headline.length + 1)}`}>
        <div className="px-4 py-4 sm:px-5">
          <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
            <div className="min-w-0">
              <p className="portal-display whitespace-normal break-words text-[25px] font-semibold leading-tight tracking-[-.02em] text-[#10213D]">
                {business.policyCount.toLocaleString("en-IN")}
              </p>
              <p className="mt-2 whitespace-normal break-words text-[9px] font-black uppercase leading-relaxed tracking-[.08em] text-[#52657F]">
                Policies · {business.periodShortLabel}
              </p>
            </div>
            <div className="min-w-0 space-y-1.5">
              {policyBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-[8px] leading-tight">
                  <span className="font-bold uppercase tracking-[.05em] text-[#6D7B90]">{item.label}</span>
                  <span className="portal-display text-[13px] font-semibold text-[#20314D]">{item.value.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {headline.map((item) => (
          <div key={item.label} className="border-t border-[#E5EAF1] px-4 py-4 sm:border-l sm:border-t-0 sm:px-5">
            <p className="portal-display whitespace-normal break-words text-[25px] font-semibold leading-tight tracking-[-.02em] text-[#10213D]">{item.value}</p>
            <p className="mt-2 whitespace-normal break-words text-[9px] font-black uppercase leading-relaxed tracking-[.08em] text-[#52657F]">{item.label}</p>
          </div>
        ))}
      </div>

      <details className="group border-t border-[#E7ECF2]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[8px] font-bold text-[#64748B] sm:px-5">
          <span className="whitespace-normal break-words">Business mix & ranking</span><span className="whitespace-normal break-words text-right">Show / hide details</span>
        </summary>
        <div className="grid border-t border-[#EEF2F6] xl:grid-cols-4">
          <MixColumn title="Channel contribution" rows={business.channelMix} divided={false} />
          <MixColumn title="Vehicle class" rows={business.vehicleClassMix} divided />
          <MixColumn title="Coverage mix" rows={business.coverageMix} divided />
          {commercial && business.topInsurers.length ? (
            <TopColumn title="Top insurers" rows={business.topInsurers} totalAmount={totalAmount} divided />
          ) : (
            <MixColumn title={business.businessLineMix.length > 1 ? "Business line" : "Business mix"} rows={business.businessLineMix} divided />
          )}
        </div>

        {commercial && business.topProducers.length ? (
          <div className={`grid border-t border-[#DDE4EC] ${business.topGroups.length ? "xl:grid-cols-[1.35fr_.65fr]" : "grid-cols-1"}`}>
            <Leaderboard title="Top producers" rows={business.topProducers} totalAmount={totalAmount} href="/intermediaries/partner" />
            {business.topGroups.length ? (
              <Leaderboard title="Top Intermediary Groups" rows={business.topGroups} totalAmount={totalAmount} href="/intermediaries/groups" divided compact />
            ) : null}
          </div>
        ) : null}
      </details>
    </section>
  );
}

function CommercialOperations({ business, canOpenControl }: { business: DashboardBusinessData; canOpenControl: boolean }) {
  const commercial = business.commercial!;

  return (
    <section className="mt-6 border-y border-[#D5DEE9] bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-3">
          <Icon src={DASHBOARD_ICON_ASSETS.accountsFinance} size={30} />
          <div>
            <h2 className="text-[12px] font-bold text-[#172844]">Commercial operations</h2>
            <p className="mt-0.5 text-[7.5px] font-bold uppercase tracking-[.11em] text-[#8A96A8]">{business.periodLabel}</p>
          </div>
        </div>
        {canOpenControl ? (
          <Link prefetch={false} href="/policies/commercial-review" className="text-[8.5px] font-bold text-[#65758B] hover:text-[#203A63]">Open control ↗</Link>
        ) : null}
      </div>

      <div className="grid border-t border-[#E7ECF2] md:grid-cols-3">
        <div className="flex min-h-[88px] min-w-0 flex-col px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[.065em] text-[#53637A]">Net Pay-In</p>
          <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
            <p className="portal-display min-w-0 text-[27px] font-semibold leading-none text-[#10213D]">{formatMoney(commercial.payinAfterTds)}</p>
            <div className="flex shrink-0 flex-col gap-1.5 border-l border-[#E7ECF2] pl-3">
              <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                <span className="text-[8px] font-semibold uppercase text-[#65758B]">Projected Gross</span>
                <span className="portal-display text-[12px] font-semibold tabular-nums text-[#10213D]">{formatMoney(commercial.projectedPayin)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                <span className="text-[8px] font-semibold uppercase text-[#65758B]">Projected TDS</span>
                <span className="portal-display text-[12px] font-semibold tabular-nums text-[#10213D]">{formatMoney(commercial.tdsAmount)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex min-h-[88px] min-w-0 flex-col border-t border-[#E7ECF2] px-3 py-2.5 md:border-l md:border-t-0">
          <p className="text-[9px] font-bold uppercase tracking-[.065em] text-[#53637A]">Partner Payout</p>
          <div className="flex flex-1 items-center justify-center">
            <p className="portal-display text-[27px] font-semibold leading-none text-[#10213D]">{formatMoney(commercial.partnerPayout)}</p>
          </div>
        </div>
        <div className="flex min-h-[88px] min-w-0 flex-col border-t border-[#E7ECF2] px-3 py-2.5 md:border-l md:border-t-0">
          <p className="text-[9px] font-bold uppercase tracking-[.065em] text-[#53637A]">Retention</p>
          <div className="flex flex-1 items-center justify-center">
            <p className="portal-display text-[27px] font-semibold leading-none text-[#10213D]">{formatMoney(commercial.retention)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-[#142448] px-4 py-2.5 text-[9px] font-semibold text-white sm:px-5">
        <span><b>{commercial.payinPolicies}</b> policies with Pay-In</span>
        <span><b>{commercial.payoutPolicies}</b> policies with Payout</span>
        <span>Retention rate <b>{commercial.retentionRate.toFixed(1)}%</b></span>
        {commercial.needsReview ? <span className="text-[#FFD18C]"><b>{commercial.needsReview}</b> entries need review</span> : null}
        {commercial.reconciliationExceptions ? (
          <span className="font-bold text-[#FFB9B3]">{commercial.reconciliationExceptions} Pay-In / TDS reconciliation exceptions</span>
        ) : (
          <span className="font-bold text-[#A4E7D8]">Commercial data reconciled</span>
        )}
      </div>
    </section>
  );
}

function PortfolioHealth({ data, renewalTotal }: { data: DashboardCurrentData; renewalTotal: number }) {
  const panels = [
    data.claims ? "claims" : null,
    data.fleet ? "fleet" : null,
    renewalTotal > 0 ? "renewal" : null,
  ].filter(Boolean);

  return (
    <section className="mt-6 border-y border-[#D5DEE9] bg-white">
      <div className="px-4 py-3 sm:px-5">
        <h2 className="text-[11.5px] font-bold text-[#172844]">Portfolio health</h2>
      </div>
      <div className={`grid border-t border-[#E7ECF2] ${panels.length === 3 ? "xl:grid-cols-3" : panels.length === 2 ? "xl:grid-cols-2" : "grid-cols-1"}`}>
        {data.claims ? <ClaimHealth claims={data.claims} /> : null}
        {data.fleet ? <FleetHealth fleet={data.fleet} divided={Boolean(data.claims)} /> : null}
        {renewalTotal > 0 && data.renewals ? <RenewalHealth renewals={data.renewals} total={renewalTotal} divided={Boolean(data.claims || data.fleet)} /> : null}
      </div>
    </section>
  );
}

function ClaimHealth({ claims }: { claims: NonNullable<DashboardCurrentData["claims"]> }) {
  const agingColors = ["#25B4A6", "#7562E8", "#D99D3D", "#EF6969", "#D95656"];
  const agingTotal = claims.aging.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex min-h-[160px] flex-1 flex-col bg-white px-3 py-3">
        <p className="text-[9px] font-bold uppercase tracking-[.065em] text-[#53637A]">Claim aging</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="portal-display text-[29px] font-semibold leading-none text-[#10213D]">{claims.open}</p>
            <p className="text-[9px] text-[#64748B]">open claims</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="portal-display text-[19px] font-semibold leading-none text-[#16605F]">{formatMoney(claims.estimateExposure)}</p>
            <p className="mt-1 text-[8px] font-semibold uppercase tracking-[.03em] text-[#7A8A9D]">Estimated exposure</p>
          </div>
        </div>
        <div className="mt-5 flex h-[12px] w-full overflow-hidden" role="img" aria-label={`Claim aging distribution: ${claims.aging.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
          {claims.aging.map((item, index) => (
            <div key={item.label} style={{ width: agingTotal > 0 ? `${(item.value / agingTotal) * 100}%` : "0%", backgroundColor: agingColors[Math.min(index, agingColors.length - 1)] }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {claims.aging.map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="truncate text-[8px] text-[#64748B]" title={item.label}>{item.label}</p>
              <p className="mt-1 text-[11px] font-semibold tabular-nums text-[#233650]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
      {(claims.assistanceRequested || claims.pendingDocuments || claims.billExposure) ? (
        <div className="flex min-h-[36px] items-center justify-center bg-[#142448] px-3 py-2">
          <p className="overflow-x-auto whitespace-nowrap text-center text-[10px] font-semibold text-white [scrollbar-width:none]">
            {[
              claims.assistanceRequested ? `${claims.assistanceRequested} assistance` : null,
              claims.pendingDocuments ? `${claims.pendingDocuments} documents pending` : null,
              claims.billExposure ? `Bill ${formatMoney(claims.billExposure)}` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FleetHealth({ fleet, divided }: { fleet: NonNullable<DashboardCurrentData["fleet"]>; divided: boolean }) {
  const total = Math.max(fleet.total, 1);
  const items = [
    { label: "Registered", value: fleet.registered, tone: "bg-[#23B7AE]" },
    { label: "Registration pending", value: fleet.registrationPending, tone: "bg-[#D99A3B]" },
    { label: "Incomplete / legacy", value: fleet.incompleteLegacy, tone: "bg-[#9AA5B4]" },
  ].filter((item) => item.value > 0);

  return (
    <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#E7ECF2] px-4 py-4 sm:px-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#8290A3]">Fleet readiness</p>
          <div className="mt-1 flex items-end gap-2.5">
            <span className="portal-display text-[26px] font-semibold leading-none text-[#10213D]">{fleet.total}</span>
            <span className="pb-0.5 text-[8px] font-semibold text-[#718095]">vehicles</span>
          </div>
        </div>
        {fleet.authbridgeVerified ? (
          <div className="min-w-0 text-right">
            <p className="portal-display text-[17px] font-semibold text-[#315E8B]">{fleet.authbridgeVerified}</p>
            <p className="mt-0.5 text-[7px] font-bold uppercase tracking-[.08em] text-[#8995A7]">RC verified</p>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden bg-[#EDF1F5]">
        {items.map((item) => <div key={item.label} className={item.tone} style={{ width: `${Math.max(3, Math.round((item.value / total) * 100))}%` }} />)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          { label: "Registered", value: fleet.registered },
          { label: "Pending", value: fleet.registrationPending },
          { label: "Incomplete", value: fleet.incompleteLegacy },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-[7px] font-semibold text-[#738197]">{item.label}</p>
            <p className="mt-0.5 text-[10px] font-bold text-[#26354F]">{item.value}</p>
          </div>
        ))}
      </div>
      <Link prefetch={false} href="/vehicles" className="mt-4 inline-flex items-center gap-1 text-[8px] font-bold text-[#65758B] hover:text-[#203A63]">
        Vehicle Register <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function RenewalHealth({ renewals, total, divided }: { renewals: NonNullable<DashboardCurrentData["renewals"]>; total: number; divided: boolean }) {
  const items = [
    { label: "Expired", value: renewals.expired, tone: "bg-[#EE695F]" },
    { label: "0–7d", value: renewals.due0to7, tone: "bg-[#E88A3E]" },
    { label: "8–15d", value: renewals.due8to15, tone: "bg-[#DDAE43]" },
    { label: "16–30d", value: renewals.due16to30, tone: "bg-[#8D77E4]" },
    { label: "31–45d", value: renewals.due31to45, tone: "bg-[#6659DC]" },
  ];

  return (
    <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#E7ECF2] px-4 py-4 sm:px-5`}>
      <p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#8290A3]">Renewal horizon</p>
      <div className="mt-1 flex items-end gap-2.5">
        <span className="portal-display text-[26px] font-semibold leading-none text-[#10213D]">{total}</span>
        <span className="pb-0.5 text-[8px] font-semibold text-[#718095]">within 45 days / expired</span>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden bg-[#EDF1F5]">
        {items.filter((item) => item.value > 0).map((item) => <div key={item.label} className={item.tone} style={{ width: `${Math.max(3, Math.round((item.value / total) * 100))}%` }} />)}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-[7px] font-semibold text-[#738197]">{item.label}</p>
            <p className="mt-0.5 text-[10px] font-bold text-[#26354F]">{item.value}</p>
          </div>
        ))}
      </div>
      <Link prefetch={false} href="/policies" className="mt-4 inline-flex items-center gap-1 text-[8px] font-bold text-[#65758B] hover:text-[#203A63]">
        Policy Register <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function WorkMovement({ data, access }: { data: DashboardCurrentData; access: DashboardAccess }) {
  const showIntakes = Boolean(data.policyIntakes?.recent.length);
  const showClaims = Boolean(access.viewClaims && data.claims?.recent.length);

  return (
    <section className={`mt-6 grid border-y border-[#D5DEE9] bg-white ${showIntakes && showClaims ? "xl:grid-cols-2" : "grid-cols-1"}`}>
      {showIntakes ? (
        <WorkStream title="Policy Intake" href="/policy-intakes">
          {data.policyIntakes!.recent.map((row) => <PolicyIntakeRow key={row.id} row={row} />)}
        </WorkStream>
      ) : null}
      {showClaims ? (
        <WorkStream title="Claim movement" href="/claims" divided={showIntakes}>
          {data.claims!.recent.map((row) => (
            <Link prefetch={false} key={row.id} href={`/claims/${row.id}`} className="group flex items-center gap-3 border-t border-[#EEF2F6] px-4 py-3.5 first:border-t-0 sm:px-5">
              <Icon src={DASHBOARD_ICON_ASSETS.claims} size={27} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
                  <p className="whitespace-normal break-words text-[10.5px] font-bold text-[#21304D]">{row.vehicleNo ?? row.claim_no}</p>
                  <span className="whitespace-normal break-words text-[7px] font-black uppercase leading-relaxed tracking-[.05em] text-[#D35A52]">{row.current_status}</span>
                </div>
                <p className="mt-1 whitespace-normal break-words text-[8.5px] text-[#7F8CA0]">
                  {row.customerName || "Incomplete"} · {row.claim_no} · {formatAge(row.updated_at)}
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-[#A6B0BF] group-hover:text-[#203A63]" />
            </Link>
          ))}
        </WorkStream>
      ) : null}
    </section>
  );
}

function MixColumn({ title, rows, divided }: { title: string; rows: DashboardBusinessMixRow[]; divided: boolean }) {
  const amountMode = rows.some((row) => row.netPremium !== null);
  const total = Math.max(rows.reduce((sum, row) => sum + (amountMode ? row.netPremium ?? 0 : row.policies), 0), 1);

  return (
    <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#E7ECF2] px-4 py-4 sm:px-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[8px] font-black uppercase tracking-[.11em] text-[#7B899D]">{title}</h3>
        <span className="text-[7px] font-semibold text-[#99A3B2]">{amountMode ? "By net premium" : "By policies"}</span>
      </div>
      <div className="mt-3 space-y-3">
        {rows.slice(0, 5).map((row) => {
          const value = amountMode ? row.netPremium ?? 0 : row.policies;
          const share = Math.round((value / total) * 100);
          return (
            <div key={row.key}>
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1 whitespace-normal break-words text-[8.5px] font-semibold leading-relaxed text-[#435169]">{row.label || "Incomplete"}</span>
                <span className="max-w-[44%] shrink-0 whitespace-normal break-words text-right text-[8px] font-bold leading-relaxed text-[#28364F]">
                  {amountMode ? formatMoney(value) : row.policies}
                  <span className="ml-1 font-semibold text-[#99A3B2]">· {share}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 bg-[#EDF1F5]">
                <div className="h-full bg-[#6257D9]" style={{ width: `${Math.max(value ? 4 : 0, share)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopColumn({ title, rows, totalAmount, divided }: { title: string; rows: DashboardBusinessRankRow[]; totalAmount: number; divided: boolean }) {
  return (
    <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#E7ECF2] px-4 py-4 sm:px-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[8px] font-black uppercase tracking-[.11em] text-[#7B899D]">{title}</h3>
        <span className="text-[7px] font-semibold text-[#99A3B2]">Ranked by gross premium</span>
      </div>
      <div className="mt-2 divide-y divide-[#EEF2F6]">
        {rows.slice(0, 5).map((row, index) => (
          <div key={row.key} className="grid grid-cols-[24px_minmax(0,1fr)_minmax(72px,auto)] items-center gap-2 py-2.5">
            <span className="portal-display text-[12px] font-semibold text-[#A0AABB]">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="whitespace-normal break-words text-[8.5px] font-semibold leading-relaxed text-[#394760]">{row.label || "Incomplete"}</p>
              <p className="mt-0.5 text-[7px] font-semibold text-[#96A1B1]">{row.policies} policies</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="whitespace-normal break-words text-[9px] font-bold leading-snug text-[#26354F]">{formatMoney(row.grossPremium)}</p>
              <p className="mt-0.5 text-[7px] font-semibold text-[#96A1B1]">{amountShare(row.grossPremium, totalAmount)}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Leaderboard({ title, rows, totalAmount, href, divided = false, compact = false }: { title: string; rows: DashboardBusinessRankRow[]; totalAmount: number; href: string; divided?: boolean; compact?: boolean }) {
  return (
    <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#DDE4EC] px-4 py-4 sm:px-5`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[7.5px] font-black uppercase tracking-[.11em] text-[#8290A3]">Ranked by gross premium</p>
          <h3 className="mt-1 text-[11px] font-bold text-[#1A2A46]">{title}</h3>
        </div>
        <Link prefetch={false} href={href} className="text-[8px] font-bold text-[#65758B] hover:text-[#203A63]">View all ↗</Link>
      </div>
      <div className="mt-3 divide-y divide-[#EEF2F6] border-t border-[#E7ECF2]">
        {rows.slice(0, compact ? 5 : 6).map((row, index) => (
          <Link prefetch={false} key={row.key} href={href} className="group grid grid-cols-[34px_minmax(0,1fr)_minmax(86px,auto)] items-center gap-3 py-3 hover:bg-[#FAFBFD] sm:px-1">
            <span className="portal-display text-[14px] font-semibold text-[#A2ACBB]">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="whitespace-normal break-words text-[9.5px] font-bold leading-relaxed text-[#26344E]">{row.label || "Incomplete"}</p>
              <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[.05em] text-[#96A1B1]">
                {row.detail ? `${row.detail} · ` : ""}{row.policies} policies
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="portal-display whitespace-normal break-words text-[14px] font-semibold leading-snug text-[#17365D]">{formatMoney(row.grossPremium)}</p>
              <p className="mt-0.5 text-[7px] font-semibold text-[#8D99AA]">{amountShare(row.grossPremium, totalAmount)}% of period</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function WorkStream({ title, href, children, divided = false }: { title: string; href: string; children: React.ReactNode; divided?: boolean }) {
  return (
    <div className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} border-[#E7ECF2]`}>
      <div className="flex items-center justify-between px-4 py-3 sm:px-5">
        <h2 className="text-[11px] font-bold text-[#1E2E4B]">{title}</h2>
        <Link prefetch={false} href={href} className="text-[8px] font-bold text-[#6E7D91] hover:text-[#203A63]">View all ↗</Link>
      </div>
      <div className="border-t border-[#E7ECF2]">{children}</div>
    </div>
  );
}

function PolicyIntakeRow({ row }: { row: DashboardIntakeRow }) {
  const manual = row.ocr_status === "failed";
  return (
    <Link prefetch={false} href={`/policy-intakes/${row.id}`} className="group flex items-center gap-3 border-t border-[#EEF2F6] px-4 py-3.5 first:border-t-0 sm:px-5">
      <Icon src={manual ? DASHBOARD_ICON_ASSETS.ocrManualReview : DASHBOARD_ICON_ASSETS.policyIntake} size={27} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
          <p className="whitespace-normal break-words text-[10.5px] font-bold text-[#21304D]">{row.intake_number}</p>
          <span className={`${manual ? "text-[#C27A20]" : "text-[#6257D9]"} whitespace-normal break-words text-[7px] font-black uppercase leading-relaxed tracking-[.05em]`}>
            {manual ? "Manual OCR" : intakeStatus(row.status)}
          </span>
        </div>
        <p className="mt-1 whitespace-normal break-words text-[8.5px] text-[#7F8CA0]">{row.lead_source_name || "Incomplete"} · {formatAge(row.created_at)}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-[#A6B0BF] group-hover:text-[#203A63]" />
    </Link>
  );
}

function MetricRail({ item, divided }: { item: RailMetric; divided: boolean }) {
  const isPolicies = item.label === "Active policies";
  const footer = isPolicies && item.policyBreakdown
    ? [
        `${item.policyBreakdown.motor.toLocaleString("en-IN")} Motor`,
        `${item.policyBreakdown.nonMotor.toLocaleString("en-IN")} Non-Motor`,
        `${item.policyBreakdown.life.toLocaleString("en-IN")} Life`,
        `${item.policyBreakdown.health.toLocaleString("en-IN")} Health`,
        ...(item.policyBreakdown.other ? [`${item.policyBreakdown.other.toLocaleString("en-IN")} Other`] : []),
      ].join(" · ")
    : item.meta || "—";
  return (
    <Link
      prefetch={false}
      href={item.href}
      className={`${divided ? "border-t md:border-l md:border-t-0" : ""} group flex h-[128px] min-w-0 flex-col overflow-hidden border-[#E3E9F0] transition hover:brightness-[0.98]`}
    >
      <div className="flex h-[60%] min-h-0 flex-col bg-white px-3 py-2">
        {item.secondary ? (
          <>
            <p className="text-[9px] font-bold uppercase tracking-[.065em] text-[#53637A]">Claims</p>
            <div className="grid min-h-0 flex-1 grid-cols-2 items-center gap-2">
              <div className="min-w-0 text-center">
                <p className="portal-display text-[23px] font-semibold leading-none text-[#10213D]">{item.value}</p>
                <p className="mt-1 text-[8px] font-bold uppercase leading-tight text-[#5D6C83]">{item.label}</p>
              </div>
              <div className="min-w-0 border-l border-[#E7ECF2] text-center">
                <p className="portal-display text-[23px] font-semibold leading-none text-[#10213D]">{item.secondary.value}</p>
                <p className="mt-1 text-[8px] font-bold uppercase leading-tight text-[#5D6C83]">{item.secondary.label}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-[9px] font-bold uppercase tracking-[.065em] text-[#53637A]">{item.label}</p>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <p className="portal-display text-center text-[27px] font-semibold leading-none tracking-[-.02em] text-[#10213D]">{item.value}</p>
            </div>
          </>
        )}
      </div>
      <div className="flex h-[40%] min-h-0 items-center bg-[#142448] px-2.5 text-white">
        {item.secondary ? (
          <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2">
            <span className="block min-w-0 truncate text-center text-[10px] font-semibold leading-tight" title={item.meta || undefined}>{item.meta || "—"}</span>
            <span className="block min-w-0 truncate border-l border-white/30 text-center text-[10px] font-semibold leading-tight" title={item.secondary.meta || undefined}>{item.secondary.meta || "—"}</span>
          </div>
        ) : (
          <span className="block w-full min-w-0 overflow-x-auto whitespace-nowrap text-center text-[10px] font-semibold leading-tight [scrollbar-width:none]" title={footer}>{footer}</span>
        )}
      </div>
    </Link>
  );
}

function AttentionItem({ item, divided }: { item: AttentionSignal; divided: boolean }) {
  const tone = {
    red: "bg-[#EE695F]",
    amber: "bg-[#D99A3B]",
    violet: "bg-[#6357DC]",
    teal: "bg-[#19AFA9]",
    slate: "bg-[#8A98AA]",
  }[item.tone];
  return (
    <Link prefetch={false} href={item.href} className={`${divided ? "border-t xl:border-l xl:border-t-0" : ""} group flex min-w-0 items-center gap-3 border-[#E7ECF2] px-4 py-3 hover:bg-[#FAFBFD]`}>
      <span className={`h-8 w-[3px] shrink-0 ${tone}`} />
      <Icon src={item.icon} size={27} />
      <div className="min-w-0 flex-1">
        <p className="whitespace-normal break-words text-[9px] font-bold text-[#26344F]">{item.label}</p>
        {item.detail ? <p className="mt-0.5 whitespace-normal break-words text-[7.2px] font-semibold text-[#8D98A9]">{item.detail}</p> : null}
      </div>
      <span className="portal-display max-w-[30%] whitespace-normal break-words text-right text-[19px] font-semibold leading-tight text-[#10213D]">{item.value}</span>
      <ChevronRight className="h-3.5 w-3.5 text-[#A6B0BF] group-hover:text-[#203A63]" />
    </Link>
  );
}

function Icon({ src, size }: { src: string; size: number }) {
  return <Image src={src} alt="" width={size} height={size} className="shrink-0 object-contain" />;
}

function amountShare(amount: number, total: number) {
  return total > 0 ? Math.round((amount / total) * 100) : 0;
}

function intakeStatus(status: string) {
  const labels: Record<string, string> = {
    ready_for_review: "Ready",
    in_review: "In review",
    processing: "Processing",
    needs_attention: "Attention",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function formatHeaderDate(value: Date) {
  return value.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

function formatHeaderTime(value: Date) {
  return value.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function formatAge(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "recently";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    currencyDisplay: "symbol",
    maximumFractionDigits: 0,
  }).format(value);
}

function railGrid(count: number) {
  if (count >= 6) return "md:grid-cols-3 xl:grid-cols-6";
  if (count === 5) return "md:grid-cols-3 xl:grid-cols-5";
  if (count === 4) return "md:grid-cols-2 xl:grid-cols-4";
  if (count === 3) return "md:grid-cols-3";
  return "md:grid-cols-2";
}

function attentionGrid(count: number) {
  if (count >= 6) return "md:grid-cols-3 xl:grid-cols-6";
  if (count === 5) return "md:grid-cols-3 xl:grid-cols-5";
  if (count === 4) return "md:grid-cols-2 xl:grid-cols-4";
  if (count === 3) return "md:grid-cols-3";
  return "md:grid-cols-2";
}

function headlineGrid(count: number) {
  if (count >= 5) return "sm:grid-cols-2 xl:grid-cols-5";
  if (count === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (count === 3) return "sm:grid-cols-3";
  return "sm:grid-cols-2";
}