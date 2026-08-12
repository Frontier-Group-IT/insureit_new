import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileBarChart2,
  FileCheck2,
  Filter,
  Landmark,
  LineChart,
  LockKeyhole,
  PieChart,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
  TimerReset,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/shell";

type ReportTone = "blue" | "green" | "amber" | "red" | "teal" | "violet" | "slate";

type ReportDefinition = {
  title: string;
  category: string;
  owner: string;
  cadence: string;
  sensitivity: string;
  description: string;
  icon: LucideIcon;
  tone: ReportTone;
  metrics: string[];
  filters: string[];
  outputs: string[];
  workflow: string;
};

const toneStyles: Record<ReportTone, { icon: string; border: string; text: string; chip: string }> = {
  blue: {
    icon: "bg-[#eaf2ff] text-[#215dc8]",
    border: "border-[#cfe0ff]",
    text: "text-[#215dc8]",
    chip: "bg-[#f3f7ff] text-[#285da9]",
  },
  green: {
    icon: "bg-[#e9f8ef] text-[#16854f]",
    border: "border-[#cdebd9]",
    text: "text-[#16854f]",
    chip: "bg-[#f1fbf5] text-[#21734b]",
  },
  amber: {
    icon: "bg-[#fff7e6] text-[#b77912]",
    border: "border-[#f5ddb0]",
    text: "text-[#b77912]",
    chip: "bg-[#fff9ec] text-[#92620d]",
  },
  red: {
    icon: "bg-[#fff0ed] text-[#cf4d43]",
    border: "border-[#f4c9c4]",
    text: "text-[#cf4d43]",
    chip: "bg-[#fff6f4] text-[#b0443c]",
  },
  teal: {
    icon: "bg-[#e7fbfa] text-[#078f93]",
    border: "border-[#bfeceb]",
    text: "text-[#078f93]",
    chip: "bg-[#effdfc] text-[#087c80]",
  },
  violet: {
    icon: "bg-[#f0edff] text-[#6251e8]",
    border: "border-[#d8d0ff]",
    text: "text-[#6251e8]",
    chip: "bg-[#f7f5ff] text-[#5b4ce5]",
  },
  slate: {
    icon: "bg-[#eef2f7] text-[#475569]",
    border: "border-[#d9e1ec]",
    text: "text-[#475569]",
    chip: "bg-[#f6f8fb] text-[#526174]",
  },
};

const reportCategories = [
  { label: "Business", count: 4, icon: BarChart3 },
  { label: "Distribution", count: 3, icon: UsersRound },
  { label: "Renewals", count: 3, icon: CalendarClock },
  { label: "Claims", count: 3, icon: ShieldCheck },
  { label: "Operations", count: 4, icon: TimerReset },
  { label: "Compliance", count: 3, icon: LockKeyhole },
  { label: "Finance", count: 3, icon: Landmark },
];

const summaryTiles = [
  {
    label: "Report families",
    value: "7",
    detail: "Business, distribution, renewals, claims, operations, compliance and finance",
    icon: FileBarChart2,
    tone: "blue" as ReportTone,
  },
  {
    label: "Management views",
    value: "23",
    detail: "Designed as governed report blueprints before live data wiring",
    icon: Table2,
    tone: "violet" as ReportTone,
  },
  {
    label: "Primary workflow",
    value: "Filter",
    detail: "Choose scope, date range and owner before generating output",
    icon: SlidersHorizontal,
    tone: "teal" as ReportTone,
  },
  {
    label: "Export posture",
    value: "Gated",
    detail: "Exports should respect role, hierarchy and sensitive-data masking",
    icon: Download,
    tone: "amber" as ReportTone,
  },
];

const reports: ReportDefinition[] = [
  {
    title: "Policy Business Register",
    category: "Business",
    owner: "Operations / Sales",
    cadence: "Daily, month-end",
    sensitivity: "Sensitive",
    description: "Issued policy portfolio by insurer, product, customer, vehicle, intermediary and RM.",
    icon: FileCheck2,
    tone: "blue",
    metrics: ["Policy count", "Gross premium", "OD / TP / CPA split", "IDV / sum insured"],
    filters: ["Issue date", "Insurer", "Product", "RM", "Partner / POSP / MISP"],
    outputs: ["Register table", "Premium trend", "Insurer mix", "CSV / XLSX export"],
    workflow: "Start from date range, narrow by business owner, then drill into policy records.",
  },
  {
    title: "Premium Production Summary",
    category: "Business",
    owner: "Leadership",
    cadence: "Daily, weekly",
    sensitivity: "Sensitive",
    description: "Top-line premium movement across insurers, lines of business and sales hierarchy.",
    icon: LineChart,
    tone: "green",
    metrics: ["Gross premium", "Average premium", "New business", "Product mix"],
    filters: ["Current month", "Quarter", "Insurer", "Hierarchy", "Business source"],
    outputs: ["KPI strip", "Trend chart", "Leaderboard", "Printable summary"],
    workflow: "Use as the leadership snapshot before drilling into RM or intermediary performance.",
  },
  {
    title: "Insurer Performance Report",
    category: "Business",
    owner: "Management",
    cadence: "Weekly, monthly",
    sensitivity: "Internal",
    description: "Compare policy count, premium, claims and operational quality by insurer.",
    icon: PieChart,
    tone: "violet",
    metrics: ["Policies", "Premium", "Open claims", "OCR review rate"],
    filters: ["Insurer", "Product", "Period", "RM", "Claim status"],
    outputs: ["Insurer cards", "Policy/claim matrix", "Exception list"],
    workflow: "Identify insurers with high volume, pending work or data-quality issues.",
  },
  {
    title: "Vehicle Portfolio Report",
    category: "Business",
    owner: "Operations",
    cadence: "Weekly",
    sensitivity: "Sensitive",
    description: "Fleet under management by vehicle status, manufacturer, registration state and policy coverage.",
    icon: CarFront,
    tone: "teal",
    metrics: ["Vehicles", "Covered vehicles", "Registration pending", "Uninsured exposure"],
    filters: ["Customer", "Manufacturer", "Registration status", "Policy status"],
    outputs: ["Fleet register", "Coverage gap list", "Manufacturer summary"],
    workflow: "Review customer fleet coverage and prioritize missing or expiring policy action.",
  },
  {
    title: "RM Performance Report",
    category: "Distribution",
    owner: "Sales Head",
    cadence: "Daily, weekly",
    sensitivity: "Hierarchy-scoped",
    description: "Business contribution, renewals and work-in-progress by relationship manager.",
    icon: UsersRound,
    tone: "green",
    metrics: ["Assigned partners", "Policies", "Premium", "Renewals due"],
    filters: ["Sales hierarchy", "RM", "Partner type", "Period"],
    outputs: ["RM leaderboard", "Portfolio drill-down", "Renewal workload"],
    workflow: "Sales heads compare teams while RMs see only their accessible portfolio.",
  },
  {
    title: "Partner / POSP / MISP Business Report",
    category: "Distribution",
    owner: "Distribution",
    cadence: "Weekly, monthly",
    sensitivity: "Hierarchy-scoped",
    description: "Business, onboarding health and active account status for distribution partners.",
    icon: Sparkles,
    tone: "teal",
    metrics: ["Active accounts", "Policy count", "Premium", "Pending onboarding"],
    filters: ["Partner", "POSP", "MISP", "Assigned RM", "Registration status"],
    outputs: ["Partner cards", "Account register", "Business trend"],
    workflow: "Move from high-level partner health to linked POSP/MISP activity and records.",
  },
  {
    title: "Intermediary Onboarding Pipeline",
    category: "Distribution",
    owner: "Operations",
    cadence: "Daily",
    sensitivity: "Sensitive",
    description: "Partner, POSP and MISP applications by stage, status, aging and required action.",
    icon: ClipboardCheck,
    tone: "amber",
    metrics: ["Applications", "Stage aging", "Training pending", "IIB pending"],
    filters: ["Account type", "Stage", "RM", "Status", "Age bucket"],
    outputs: ["Stage funnel", "Aging table", "Action queue"],
    workflow: "Use stage and age filters to unblock applications before they become stale.",
  },
  {
    title: "Renewal Pipeline",
    category: "Renewals",
    owner: "Sales / Operations",
    cadence: "Daily",
    sensitivity: "Sensitive",
    description: "Policies expiring soon with customer, vehicle, insurer, intermediary and owner context.",
    icon: CalendarClock,
    tone: "amber",
    metrics: ["Due in 7 days", "Due in 30 days", "Expired", "Renewed"],
    filters: ["Expiry window", "RM", "Insurer", "Customer", "Intermediary"],
    outputs: ["Renewal queue", "Owner workload", "Aging summary"],
    workflow: "Filter by expiry window, assign follow-up, then open the policy or customer record.",
  },
  {
    title: "Lost Renewal Analysis",
    category: "Renewals",
    owner: "Leadership",
    cadence: "Monthly",
    sensitivity: "Internal",
    description: "Renewals not converted, grouped by reason, product, insurer, RM and intermediary.",
    icon: AlertTriangle,
    tone: "red",
    metrics: ["Lost count", "Lost premium", "Reason mix", "At-risk owners"],
    filters: ["Expiry month", "RM", "Insurer", "Loss reason"],
    outputs: ["Reason chart", "Lost-policy table", "Owner comparison"],
    workflow: "Review non-renewals after month close and decide retention interventions.",
  },
  {
    title: "Renewal Conversion Tracker",
    category: "Renewals",
    owner: "Sales Head",
    cadence: "Weekly",
    sensitivity: "Hierarchy-scoped",
    description: "Conversion progress by RM and intermediary for policies that entered the renewal window.",
    icon: CheckCircle2,
    tone: "green",
    metrics: ["Conversion rate", "Pending follow-up", "Renewed premium", "Expired unpaid"],
    filters: ["Window", "RM", "Partner", "Product"],
    outputs: ["Conversion funnel", "Follow-up queue", "RM comparison"],
    workflow: "Track whether renewal work is moving from due to contacted to closed.",
  },
  {
    title: "Claims Aging Report",
    category: "Claims",
    owner: "Claims Head",
    cadence: "Daily",
    sensitivity: "Sensitive",
    description: "Open claims by stage, age bucket, insurer, customer, vehicle and pending dependency.",
    icon: ShieldCheck,
    tone: "red",
    metrics: ["Open claims", "Average age", "Overdue claims", "Stage bottlenecks"],
    filters: ["Claim status", "Age bucket", "Insurer", "RM", "Customer"],
    outputs: ["Aging table", "Stage heatmap", "Overdue queue"],
    workflow: "Find old claims, identify pending blockers, then open claim detail for action.",
  },
  {
    title: "Claims Settlement Summary",
    category: "Claims",
    owner: "Claims / Finance",
    cadence: "Weekly, monthly",
    sensitivity: "Sensitive",
    description: "Settled and open claim values once settlement/payment fields are available.",
    icon: Landmark,
    tone: "blue",
    metrics: ["Settled claims", "Outstanding claims", "Settlement amount", "Average cycle time"],
    filters: ["Settlement period", "Insurer", "Product", "Status"],
    outputs: ["Settlement summary", "Claim rows", "Insurer comparison"],
    workflow: "Reconcile claims handling outcomes with insurer and finance follow-up.",
  },
  {
    title: "Claims Document Exception Report",
    category: "Claims",
    owner: "Claims Operations",
    cadence: "Daily",
    sensitivity: "Sensitive",
    description: "Claims blocked because required documents are missing, rejected or awaiting review.",
    icon: FileCheck2,
    tone: "amber",
    metrics: ["Missing documents", "Returned documents", "Pending review", "Oldest blocker"],
    filters: ["Document type", "Claim status", "Age", "Owner"],
    outputs: ["Exception queue", "Customer contact list", "Claim drill-down"],
    workflow: "Resolve document gaps before survey, repair or settlement stages stall.",
  },
  {
    title: "Customer KYC Workload",
    category: "Operations",
    owner: "Operations",
    cadence: "Daily",
    sensitivity: "Sensitive",
    description: "Customer onboarding and KYC applications by status, reviewer and aging.",
    icon: ClipboardCheck,
    tone: "violet",
    metrics: ["Submitted", "Under review", "Changes requested", "Aging"],
    filters: ["Customer type", "Status", "Reviewer", "Age bucket"],
    outputs: ["Queue table", "Reviewer workload", "Aging summary"],
    workflow: "Use as the daily queue for customer onboarding and KYC review work.",
  },
  {
    title: "Policy OCR Processing Report",
    category: "Operations",
    owner: "Operations / IT",
    cadence: "Weekly",
    sensitivity: "Sensitive",
    description: "OCR usage, review-required outcomes and insurer parser coverage without exposing raw OCR text.",
    icon: RefreshCw,
    tone: "teal",
    metrics: ["Uploads", "Accepted fields", "Review required", "Parser family"],
    filters: ["Insurer", "Processor result", "User", "Date"],
    outputs: ["OCR summary", "Warning categories", "Unsupported insurer list"],
    workflow: "Improve parser quality by finding insurer formats that frequently require manual review.",
  },
  {
    title: "AuthBridge RC Lookup Report",
    category: "Operations",
    owner: "Operations / IT",
    cadence: "Weekly",
    sensitivity: "Sensitive",
    description: "RC lookup attempts, success, timeout and user-declined application outcomes.",
    icon: Search,
    tone: "blue",
    metrics: ["Lookup attempts", "Successful lookups", "Timeouts", "Applied details"],
    filters: ["Date", "Status", "User", "Vehicle mode"],
    outputs: ["Usage summary", "Failure table", "Latency buckets"],
    workflow: "Track provider reliability and credit usage without storing raw provider responses.",
  },
  {
    title: "Task SLA Report",
    category: "Operations",
    owner: "Operations",
    cadence: "Daily",
    sensitivity: "Internal",
    description: "Open, overdue and completed tasks by owner, workflow area and priority.",
    icon: TimerReset,
    tone: "amber",
    metrics: ["Open tasks", "Overdue", "Completed", "Average age"],
    filters: ["Owner", "Priority", "Status", "Workflow area"],
    outputs: ["SLA cards", "Owner workload", "Task rows"],
    workflow: "Use for daily review of operational follow-ups and delayed work.",
  },
  {
    title: "Portal User Access Report",
    category: "Compliance",
    owner: "IT / Compliance",
    cadence: "Weekly, monthly",
    sensitivity: "Restricted",
    description: "Employee and intermediary portal access status, invitations and disabled accounts.",
    icon: LockKeyhole,
    tone: "slate",
    metrics: ["Active users", "Pending invites", "Disabled users", "Critical roles"],
    filters: ["Role", "Access status", "Department", "Invitation date"],
    outputs: ["Access register", "Pending invite list", "Critical access review"],
    workflow: "Review portal access regularly and confirm privileged access remains intentional.",
  },
  {
    title: "Audit Activity Report",
    category: "Compliance",
    owner: "IT / Compliance",
    cadence: "Weekly, month-end",
    sensitivity: "Restricted",
    description: "Sensitive actions such as master-record deletion, permission updates and workflow overrides.",
    icon: ClipboardCheck,
    tone: "red",
    metrics: ["Sensitive actions", "Deletes", "Permission changes", "Actor count"],
    filters: ["Actor", "Action type", "Module", "Date"],
    outputs: ["Audit table", "Actor summary", "Exception export"],
    workflow: "Start from restricted actions, then inspect actor and record context.",
  },
  {
    title: "Master Data Quality Report",
    category: "Compliance",
    owner: "Operations / IT",
    cadence: "Weekly",
    sensitivity: "Internal",
    description: "Missing aliases, inactive reference rows, duplicate-like names and incomplete records.",
    icon: Table2,
    tone: "violet",
    metrics: ["Missing aliases", "Inactive records", "Duplicate signals", "Incomplete records"],
    filters: ["Master type", "Status", "Issue type", "Updated date"],
    outputs: ["Quality score", "Issue queue", "Master-data links"],
    workflow: "Resolve reference-data issues before they affect OCR, policy entry or reporting.",
  },
  {
    title: "Premium Collection Report",
    category: "Finance",
    owner: "Finance",
    cadence: "Daily, month-end",
    sensitivity: "Restricted",
    description: "Premium receivable, collected and pending reconciliation once finance fields are connected.",
    icon: Landmark,
    tone: "green",
    metrics: ["Receivable", "Collected", "Outstanding", "Reconciliation pending"],
    filters: ["Policy period", "Insurer", "Customer", "RM"],
    outputs: ["Collection summary", "Outstanding list", "Reconciliation queue"],
    workflow: "Match issued business against payment and reconciliation state.",
  },
  {
    title: "Commission Basis Report",
    category: "Finance",
    owner: "Finance / Management",
    cadence: "Monthly",
    sensitivity: "Restricted",
    description: "Premium and policy basis for commission calculation before payout rules are finalized.",
    icon: FileBarChart2,
    tone: "blue",
    metrics: ["Eligible premium", "Policy count", "Business source", "Chargeback candidates"],
    filters: ["Intermediary", "RM", "Insurer", "Product", "Month"],
    outputs: ["Commission basis table", "Intermediary summary", "Exception list"],
    workflow: "Validate business basis before applying commission schedules or payout approvals.",
  },
  {
    title: "Month-End Management Pack",
    category: "Finance",
    owner: "Leadership",
    cadence: "Monthly",
    sensitivity: "Restricted",
    description: "Single management pack combining production, renewals, claims, operations and finance sections.",
    icon: FileBarChart2,
    tone: "slate",
    metrics: ["Premium", "Policies", "Renewal conversion", "Open risk items"],
    filters: ["Month", "Business unit", "Hierarchy", "Product"],
    outputs: ["Executive PDF", "Workbook export", "Exception appendix"],
    workflow: "Generate after operational reports are validated and month-end data is locked.",
  },
];

const buildSteps = [
  "Select report family and report type",
  "Choose date range, role scope and business owner",
  "Generate preview with masked sensitive fields",
  "Drill into source records for investigation",
  "Export or save view only when permission allows",
];

export default function ReportsPage() {
  const featuredReports = reports.slice(0, 6);

  return (
    <AppShell title="Reports">
      <div className="mx-auto max-w-[1540px] space-y-5 pb-8">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-[#111a35] px-4 py-5 text-white shadow-[0_28px_80px_rgba(17,26,53,.22)] sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] lg:items-end">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#90e8e5]">Management intelligence</p>
              <h1 className="mt-2 portal-display text-[24px] font-semibold leading-tight sm:text-[30px] lg:text-[36px]">
                Reports built for decisions, review and export control
              </h1>
              <p className="mt-3 max-w-3xl text-[12px] leading-5 text-white/72 sm:text-[13px]">
                A full reporting workspace for policy business, distribution, renewals, claims, operations, compliance and finance. The page defines the complete report catalogue and workflow without inventing live figures.
              </p>
            </div>

            <div className="grid gap-2 rounded-[22px] border border-white/12 bg-white/8 p-3 backdrop-blur-xl sm:grid-cols-2">
              <ControlPill icon={CalendarClock} label="Date range" value="Month to date" />
              <ControlPill icon={Filter} label="Scope" value="Role based" />
              <ControlPill icon={SlidersHorizontal} label="Filters" value="Report first" />
              <ControlPill icon={Download} label="Exports" value="Permission gated" />
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Reports summary">
          {summaryTiles.map((tile) => (
            <SummaryTile key={tile.label} tile={tile} />
          ))}
        </section>

        <section className="portal-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[8.5px] font-black uppercase tracking-[0.16em] text-[#6759ff]">Report catalogue</p>
              <h2 className="mt-1 text-[17px] font-semibold text-[#14213c]">Browse by business question</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {reportCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <a
                    key={category.label}
                    href={`#${category.label.toLowerCase()}`}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#e1e5ed] bg-white px-3 text-[10px] font-bold text-[#536174] transition hover:border-[#cfc8ff] hover:text-[#6759ff]"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{category.label}</span>
                    <span className="rounded-full bg-[#eef2f7] px-1.5 py-0.5 text-[8.5px] text-[#6b778b]">{category.count}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <section className="portal-card overflow-hidden">
              <div className="border-b border-[#edf0f5] p-4 sm:p-5">
                <SectionTitle eyebrow="Featured workspace" title="First reports to wire when data aggregation begins" />
              </div>
              <div className="grid gap-0 divide-y divide-[#edf0f5] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                {featuredReports.map((report) => (
                  <FeaturedReport key={report.title} report={report} />
                ))}
              </div>
            </section>

            {reportCategories.map((category) => (
              <section key={category.label} id={category.label.toLowerCase()} className="portal-card scroll-mt-24 p-4 sm:p-5">
                <SectionTitle eyebrow={category.label} title={`${category.label} reports`} />
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {reports
                    .filter((report) => report.category === category.label)
                    .map((report) => (
                      <ReportCard key={report.title} report={report} />
                    ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <section className="portal-card p-4 sm:p-5">
              <SectionTitle eyebrow="Workflow" title="How reports should run" />
              <ol className="mt-4 space-y-3">
                {buildSteps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[#eef2ff] text-[10px] font-black text-[#5b4ce5]">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-[11px] font-semibold leading-4 text-[#334155]">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="portal-card p-4 sm:p-5">
              <SectionTitle eyebrow="Governance" title="Rules before live data" />
              <div className="mt-4 space-y-3 text-[11px] leading-5 text-[#526174]">
                <Rule icon={LockKeyhole} text="Respect existing role and hierarchy scopes for every report and export." />
                <Rule icon={ShieldCheck} text="Mask or omit sensitive identity fields unless a workflow explicitly requires them." />
                <Rule icon={RefreshCw} text="Generate expensive results only after filters are selected." />
                <Rule icon={Download} text="Treat exported files as controlled outputs with auditability." />
              </div>
            </section>

            <section className="portal-card p-4 sm:p-5">
              <SectionTitle eyebrow="Preview controls" title="Default report filters" />
              <div className="mt-4 grid gap-2">
                {["Date range", "Business scope", "Insurer", "RM / hierarchy", "Partner / POSP / MISP", "Product", "Status"].map((filter) => (
                  <div key={filter} className="flex items-center justify-between rounded-xl border border-[#e5e9f0] bg-[#fafbfe] px-3 py-2">
                    <span className="text-[10.5px] font-bold text-[#334155]">{filter}</span>
                    <span className="text-[9px] font-semibold text-[#8290a4]">planned</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

function ControlPill({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/12 text-white">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-white/50">{label}</p>
        <p className="truncate text-[11px] font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function SummaryTile({ tile }: { tile: (typeof summaryTiles)[number] }) {
  const Icon = tile.icon;
  const tone = toneStyles[tile.tone];

  return (
    <section className="portal-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a879a]">{tile.label}</p>
          <p className="portal-display mt-3 text-[28px] font-semibold leading-none text-[#13203b]">{tile.value}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 border-t border-[#edf0f5] pt-3 text-[10px] leading-4 text-[#718096]">{tile.detail}</p>
    </section>
  );
}

function FeaturedReport({ report }: { report: ReportDefinition }) {
  const Icon = report.icon;
  const tone = toneStyles[report.tone];

  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className={`text-[8.5px] font-black uppercase tracking-[0.14em] ${tone.text}`}>{report.category}</p>
          <h3 className="mt-1 text-[13px] font-bold text-[#17213e]">{report.title}</h3>
          <p className="mt-1 text-[10.5px] leading-4 text-[#68758a]">{report.description}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <MiniFact label="Owner" value={report.owner} />
        <MiniFact label="Cadence" value={report.cadence} />
      </div>
    </article>
  );
}

function ReportCard({ report }: { report: ReportDefinition }) {
  const Icon = report.icon;
  const tone = toneStyles[report.tone];

  return (
    <article className={`rounded-2xl border ${tone.border} bg-white p-4 shadow-[0_12px_30px_rgba(29,40,70,.05)]`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold text-[#17213e]">{report.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold ${tone.chip}`}>{report.sensitivity}</span>
          </div>
          <p className="mt-1 text-[10.5px] leading-4 text-[#68758a]">{report.description}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <ReportList icon={BarChart3} title="Measures" items={report.metrics} />
        <ReportList icon={Filter} title="Filters" items={report.filters} />
        <ReportList icon={Download} title="Outputs" items={report.outputs} />
      </div>

      <div className="mt-4 rounded-xl border border-[#edf0f5] bg-[#fafbfe] px-3 py-2.5">
        <p className="text-[8.5px] font-black uppercase tracking-[0.14em] text-[#7a879a]">Workflow</p>
        <p className="mt-1 text-[10.5px] leading-4 text-[#334155]">{report.workflow}</p>
      </div>
    </article>
  );
}

function ReportList({ icon: Icon, title, items }: { icon: LucideIcon; title: string; items: string[] }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#7a879a]">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-[#e4e9f2] bg-[#fbfcff] px-2 py-1 text-[9.5px] font-semibold text-[#526174]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e5e9f0] bg-[#fafbfe] px-3 py-2">
      <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-[#8a96a8]">{label}</p>
      <p className="mt-1 truncate text-[10.5px] font-bold text-[#334155]">{value}</p>
    </div>
  );
}

function Rule({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#e5e9f0] bg-[#fafbfe] p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#6759ff]" />
      <p>{text}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[8.5px] font-black uppercase tracking-[0.16em] text-[#6759ff]">{eyebrow}</p>
        <h2 className="mt-1 text-[16px] font-semibold text-[#14213c]">{title}</h2>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#a0aabd]" />
    </div>
  );
}
