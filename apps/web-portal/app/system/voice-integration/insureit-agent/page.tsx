import { redirect } from "next/navigation";
import {
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  Database,
  FlaskConical,
  Layers3,
  LockKeyhole,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const phases = [
  ["0", "Baseline & isolation", "Current", "Document, protect the Sarvam fallback and establish the private-agent workspace."],
  ["1", "Private runtime foundation", "Next", "Isolated schema, provider contracts and independent kill switches."],
  ["2", "Training & evaluation data", "Planned", "Build curated training, validation and permanent test datasets."],
  ["3–5", "Agent brain & tools", "Planned", "Text agent, deterministic state machine, memory and controlled business tools."],
  ["6–7", "Speech & real-time gateway", "Planned", "Provider-neutral STT/TTS/telephony adapters, streaming audio and barge-in."],
  ["8–11", "Shadow → pilot → A/B", "Planned", "Shadow evaluation, internal calls, controlled customers and measured rollout."],
] as const;

const workspaces = [
  {
    icon: Database,
    title: "Training Library",
    text: "Curated historical conversations, behavior labels and evaluation datasets.",
  },
  {
    icon: BrainCircuit,
    title: "Agent Lab",
    text: "Prompt, model, state-machine and tool behavior testing before any live call.",
  },
  {
    icon: Workflow,
    title: "Runtime",
    text: "Private conversation sessions, speech adapters, latency and safety controls.",
  },
  {
    icon: PhoneCall,
    title: "Pilot Campaigns",
    text: "Shadow, internal and controlled customer cohorts with direct Sarvam comparison.",
  },
];

const reused = [
  "Campaign import & Tata grouping",
  "RC / policy enrichment",
  "Customer & vehicle context",
  "Calling-window safeguards",
  "DNC / terminal suppression",
  "Previous-call context",
  "Retry & active-attempt rules",
  "Structured outcomes & reporting",
];

export default async function InsureitAgentPage() {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    redirect("/access-denied");
  }

  return (
    <AppShell title="Insureit Agent">
      <div className="mx-auto max-w-[1380px] space-y-3 pb-8">
        <section className="overflow-hidden rounded-[22px] border border-[#DCE5F0] bg-[radial-gradient(circle_at_top_right,rgba(103,89,255,.12),transparent_34%),linear-gradient(135deg,#FFFFFF_0%,#F8FBFF_62%,#F4F7FF_100%)] p-4 shadow-[0_16px_42px_rgba(31,55,86,.07)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8D5E6] bg-white/80 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.08em] text-[#405774]">
                  <LockKeyhole className="h-3 w-3" />
                  IT Super User
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.08em] text-amber-700">
                  <CircleDashed className="h-3 w-3" />
                  Phase 0 · UI only
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#102A56] text-white shadow-[0_10px_24px_rgba(16,42,86,.18)]">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-[20px] font-black tracking-[-.035em] text-[#142B50]">Insureit Agent</h1>
                  <p className="mt-0.5 text-[10px] leading-5 text-[#647891]">
                    Private voice-agent workspace · built beside the current Sarvam production system, never over it.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid min-w-[250px] grid-cols-2 gap-2">
              <StatusTile label="Private calling" value="Disabled" tone="amber" />
              <StatusTile label="Sarvam fallback" value="Protected" tone="green" />
              <StatusTile label="Private runtime" value="Not connected" />
              <StatusTile label="Current phase" value="0 / 11" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <p className="text-[10px] font-black text-emerald-900">Current Sarvam system is isolated and remains the working fallback.</p>
              <p className="mt-0.5 text-[9px] leading-4 text-emerald-800/80">
                This page does not call customers, create private attempts, change Sarvam settings, alter campaign dispatch or write private-agent runtime state.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 xl:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading icon={Layers3} title="Rollout roadmap" subtitle="Each phase must pass before customer exposure expands." />
              <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[8px] font-black text-[#3156B8]">Parallel rollout</span>
            </div>
            <div className="mt-4 space-y-2">
              {phases.map(([number, title, state, description]) => (
                <div key={number} className="grid grid-cols-[38px_1fr_auto] items-start gap-3 rounded-xl border border-[#E7EDF4] bg-[#FBFCFE] px-3 py-2.5">
                  <div className={`grid h-8 w-8 place-items-center rounded-xl text-[9px] font-black ${state === "Current" ? "bg-[#102A56] text-white" : "bg-white text-[#637892] ring-1 ring-[#DDE6F0]"}`}>
                    {number}
                  </div>
                  <div>
                    <p className="text-[9.5px] font-black text-[#263C59]">{title}</p>
                    <p className="mt-0.5 text-[8.5px] leading-4 text-[#74869D]">{description}</p>
                  </div>
                  <span className={`mt-1 rounded-full px-2 py-0.5 text-[7px] font-black ${state === "Current" ? "bg-amber-100 text-amber-700" : state === "Next" ? "bg-[#EEF4FF] text-[#3156B8]" : "bg-slate-100 text-slate-500"}`}>
                    {state}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
            <SectionHeading icon={CheckCircle2} title="Reuse first" subtitle="Build only what the private-agent runtime genuinely needs." />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {reused.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-[#E7EDF4] px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="text-[8.5px] font-semibold text-[#536A84]">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-[#F6F8FC] p-3">
              <p className="text-[8px] font-black uppercase tracking-[.08em] text-[#8192A7]">Build separately</p>
              <p className="mt-1.5 text-[8.5px] leading-4 text-[#566B84]">
                Training pipeline · evaluation harness · private agent runtime · state machine · controlled tools · provider adapters · real-time audio gateway · shadow/pilot execution.
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
          <SectionHeading icon={FlaskConical} title="Future private-agent workspace" subtitle="These modules are intentionally non-functional in Phase 0." />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {workspaces.map(({ icon: Icon, title, text }) => (
              <div key={title} className="group rounded-2xl border border-[#E4EAF2] bg-[#FBFCFE] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[#3156B8] shadow-[0_5px_14px_rgba(31,55,86,.06)] ring-1 ring-[#E2E9F2]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[7px] font-black text-slate-500">Planned</span>
                </div>
                <p className="mt-3 text-[9.5px] font-black text-[#2B415E]">{title}</p>
                <p className="mt-1 text-[8.5px] leading-4 text-[#74869D]">{text}</p>
                <button type="button" disabled className="mt-3 h-8 w-full cursor-not-allowed rounded-lg border border-[#E0E7F0] bg-white text-[8px] font-black text-[#9AA8B9]">
                  Available in a later phase
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <MetricPlaceholder label="Cost / meaningful call" />
          <MetricPlaceholder label="Disposition accuracy" />
          <MetricPlaceholder label="Median response latency" />
        </section>
      </div>
    </AppShell>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof BrainCircuit;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F0F4FA] text-[#3156B8]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-[10px] font-black text-[#263C59]">{title}</h2>
        <p className="mt-0.5 text-[8px] leading-4 text-[#8292A6]">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusTile({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "amber" | "green" }) {
  const classes =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-[#DDE6F0] bg-white/85 text-[#37506D]";
  return (
    <div className={`rounded-xl border px-3 py-2 ${classes}`}>
      <p className="text-[7px] font-black uppercase tracking-[.06em] opacity-65">{label}</p>
      <p className="mt-0.5 text-[9px] font-black">{value}</p>
    </div>
  );
}

function MetricPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#CBD7E5] bg-white/70 px-4 py-3">
      <p className="text-[8px] font-black uppercase tracking-[.07em] text-[#8292A6]">{label}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[16px] font-black text-[#B1BDCB]">—</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[7px] font-black text-slate-500">Baseline pending</span>
      </div>
    </div>
  );
}
