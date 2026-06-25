import Link from "next/link";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getManagerDashboardData } from "@/lib/manager-dashboard";

type WorkflowGroup = {
  key: string;
  label: string;
  description: string;
  count: number;
  oldestLabel: string;
  href: string;
  tone: "blue" | "amber" | "green" | "slate";
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const dashboard = await getManagerDashboardData(supabase);

  const displayName = firstName(profile?.full_name) || "Manager";
  const greeting = greetingForIndiaTime();
  const workflowGroups = buildWorkflowGroups(dashboard);
  const totalClaims = workflowGroups.reduce((total, group) => total + group.count, 0);
  const closedClaims = workflowGroups.find((group) => group.key === "closed")?.count ?? 0;
  const activeClaims = Math.max(totalClaims - closedClaims, 0);

  return (
    <ClaimManagerShell title="Claim Manager Desk" activeNav="dashboard">
      <div className="space-y-4 pb-8">
        <section className="overflow-hidden rounded-2xl border border-[#DCE7F5] bg-white shadow-[0_10px_28px_rgba(7,29,73,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EEF7] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#174EA6]">Claim Manager Operations Desk</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-[#071D49]">{greeting}, {displayName}</h1>
              <p className="mt-0.5 text-[12.5px] text-[#68758A]">A simplified workflow view for all claims. Customer actions now live in the notification inbox.</p>
            </div>
            <Link href="/claims" className="inline-flex h-9 items-center rounded-lg bg-[#071D49] px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#12356C]">
              Open Claims Queue
            </Link>
          </div>

          <div className="grid gap-2 border-b border-[#E6EEF7] bg-[#F8FBFF] px-4 py-3 sm:grid-cols-3">
            <SummaryMetric label="Total Claims" value={totalClaims} />
            <SummaryMetric label="Active Claims" value={activeClaims} />
            <SummaryMetric label="Closed / Completed" value={closedClaims} />
          </div>

          <div className="px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[#071D49]">Claim Workflow Board</h2>
                <p className="mt-0.5 text-[11.5px] text-[#68758A]">Grouped stages only. No duplicate KPI cards and no long activity feeds.</p>
              </div>
              <span className="rounded-full bg-[#F2F6FB] px-2.5 py-1 text-[11px] font-semibold text-[#68758A]">{workflowGroups.length} workflow groups</span>
            </div>
            <WorkflowBoard groups={workflowGroups} />
          </div>
        </section>

        {dashboard.errors.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-5 text-amber-800">
            {dashboard.errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        ) : null}
      </div>
    </ClaimManagerShell>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#E1E9F3] bg-white px-3 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#68758A]">{label}</p>
      <p className="mt-1 text-[24px] font-semibold leading-none tracking-tight text-[#071D49]">{value}</p>
    </div>
  );
}

function WorkflowBoard({ groups }: { groups: WorkflowGroup[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E1E9F3]">
      <div className="hidden grid-cols-[1.5fr_0.6fr_0.8fr_110px] border-b border-[#E6EEF7] bg-[#F6F9FD] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#68758A] md:grid">
        <div>Workflow Stage</div>
        <div>Claims</div>
        <div>Oldest</div>
        <div className="text-right">Action</div>
      </div>
      <div className="divide-y divide-[#E8EEF6] bg-white">
        {groups.map((group) => (
          <Link key={group.key} href={group.href} className="grid gap-2 px-3 py-3 transition hover:bg-[#FAFCFF] md:grid-cols-[1.5fr_0.6fr_0.8fr_110px] md:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${toneDot(group.tone)}`} />
                <p className="text-[13px] font-semibold text-[#071D49]">{group.label}</p>
              </div>
              <p className="mt-0.5 text-[11.5px] text-[#68758A]">{group.description}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A8797] md:hidden">Claims</p>
              <p className="text-[20px] font-semibold leading-none text-[#071D49]">{group.count}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A8797] md:hidden">Oldest</p>
              <p className="text-[11.5px] font-medium text-[#4B596B]">{group.oldestLabel}</p>
            </div>
            <div className="text-left md:text-right">
              <span className="inline-flex rounded-lg border border-[#D6E0EC] px-3 py-1.5 text-[11px] font-semibold text-[#071D49] transition hover:border-[#174EA6] hover:bg-[#F3F7FD]">Open</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function buildWorkflowGroups(dashboard: Awaited<ReturnType<typeof getManagerDashboardData>>): WorkflowGroup[] {
  const stage = (key: string) => dashboard.journeyKpis.find((item) => item.key === key);
  const count = (...keys: string[]) => keys.reduce((total, key) => total + (stage(key)?.count ?? 0), 0);
  const oldest = (...keys: string[]) => oldestLabel(keys.map((key) => stage(key)?.oldestAgeLabel).filter(Boolean) as string[]);

  return [
    {
      key: "intake-documents",
      label: "Intake & Initial Documents",
      description: "Loss report, spot intimation and first document verification.",
      count: count("loss-report", "spot-intimation"),
      oldestLabel: oldest("loss-report", "spot-intimation"),
      href: "/claims?journey=spot-intimation",
      tone: "amber"
    },
    {
      key: "survey",
      label: "Survey",
      description: "Spot surveyor assignment, inspection and survey completion.",
      count: count("spot-surveyor-assigned", "spot-survey-completed", "final-surveyor"),
      oldestLabel: oldest("spot-surveyor-assigned", "spot-survey-completed", "final-surveyor"),
      href: "/claims?journey=spot-surveyor-assigned",
      tone: "blue"
    },
    {
      key: "final-documents",
      label: "Final Documents",
      description: "Final document collection and verification after later claim stages.",
      count: count("final-documents", "claim-intimation"),
      oldestLabel: oldest("final-documents", "claim-intimation"),
      href: "/claims?journey=final-documents",
      tone: "amber"
    },
    {
      key: "approval",
      label: "Approval",
      description: "Estimate submission, insurer review and work approval.",
      count: count("work-approval"),
      oldestLabel: oldest("work-approval"),
      href: "/claims?journey=work-approval",
      tone: "blue"
    },
    {
      key: "repair-billing",
      label: "Repair & Billing",
      description: "Repair, RI, delivery order and final bill movement.",
      count: count("under-repair", "ri-stage", "do-stage", "vehicle-release"),
      oldestLabel: oldest("under-repair", "ri-stage", "do-stage", "vehicle-release"),
      href: "/claims?journey=under-repair",
      tone: "slate"
    },
    {
      key: "settlement",
      label: "Settlement",
      description: "Payment advice, settlement under process and claim completion.",
      count: count("payment-advice-received"),
      oldestLabel: oldest("payment-advice-received"),
      href: "/claims?journey=payment-advice-received",
      tone: "green"
    },
    {
      key: "closed",
      label: "Closed / Completed",
      description: "Settled and closed claim journeys.",
      count: count("journey-complete"),
      oldestLabel: oldest("journey-complete"),
      href: "/claims?queue=closed",
      tone: "green"
    }
  ];
}

function oldestLabel(labels: string[]) {
  const days = labels.map((label) => oldestAgeDays(label)).filter((value) => value > 0);
  if (!labels.length) return "No claims";
  if (!days.length) return labels.some((label) => label === "Updated today") ? "Updated today" : "No pending claims";
  const max = Math.max(...days);
  return max === 1 ? "Oldest 1 day" : `Oldest ${max} days`;
}

function toneDot(tone: WorkflowGroup["tone"]) {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "blue") return "bg-blue-500";
  return "bg-slate-400";
}

function oldestAgeDays(label: string) {
  const match = label.match(/(\d+) day/);
  return match ? Number(match[1]) : 0;
}
function firstName(name?: string | null) { return name?.trim().split(/\s+/)[0] ?? ""; }
function greetingForIndiaTime() { const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())); if (hour < 12) return "Good morning"; if (hour < 17) return "Good afternoon"; return "Good evening"; }
