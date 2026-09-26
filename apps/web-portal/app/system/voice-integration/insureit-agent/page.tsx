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
  Split,
  Workflow,
} from "lucide-react";

import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getPrivateVoiceRuntimeConfig } from "@/lib/private-voice/config";
import { getTrainingLibraryOverview } from "@/lib/private-voice/training-library";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const phases = [
  ["0", "Baseline & isolation", "Complete", "Working Sarvam path documented and protected as an independent fallback."],
  ["1", "Private runtime foundation", "Complete", "Isolated schema, provider contracts and private configuration boundary."],
  ["2", "Training & evaluation data", "Current", "Curate privacy-safe historical outcomes into training, validation and untouched test sets."],
  ["3–5", "Agent brain & tools", "Next", "Text agent, deterministic state machine, memory and controlled business tools."],
  ["6–7", "Speech & real-time gateway", "Planned", "Provider-neutral STT/TTS/telephony adapters, streaming audio and barge-in."],
  ["8–11", "Shadow → pilot → A/B", "Planned", "Shadow evaluation, internal calls, controlled customers and measured rollout."],
] as const;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function outcomeValue(outcome: Record<string, unknown> | null, key: string) {
  const value = outcome?.[key];
  return typeof value === "string" && value.trim() ? value : "—";
}

export default async function InsureitAgentPage({ searchParams }: PageProps) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    redirect("/access-denied");
  }

  const [config, library, resolvedParams] = await Promise.all([
    Promise.resolve(getPrivateVoiceRuntimeConfig()),
    getTrainingLibraryOverview(),
    searchParams ?? Promise.resolve({}),
  ]);

  const stageState = param(resolvedParams.training_stage);
  const staged = param(resolvedParams.staged);
  const skipped = param(resolvedParams.skipped);
  const screenedOut = param(resolvedParams.screened_out);
  const stageError = param(resolvedParams.training_error);

  return (
    <AppShell title="Insureit Agent">
      <div className="mx-auto max-w-[1380px] space-y-3 pb-8">
        <section className="overflow-hidden rounded-[22px] border border-[#DCE5F0] bg-[radial-gradient(circle_at_top_right,rgba(103,89,255,.12),transparent_34%),linear-gradient(135deg,#FFFFFF_0%,#F8FBFF_62%,#F4F7FF_100%)] p-4 shadow-[0_16px_42px_rgba(31,55,86,.07)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8D5E6] bg-white/80 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.08em] text-[#405774]">
                  <LockKeyhole className="h-3 w-3" /> IT Super User
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.08em] text-violet-700">
                  <CircleDashed className="h-3 w-3" /> Phase 2 · training library
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#102A56] text-white shadow-[0_10px_24px_rgba(16,42,86,.18)]">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-[20px] font-black tracking-[-.035em] text-[#142B50]">Insureit Agent</h1>
                  <p className="mt-0.5 text-[10px] leading-5 text-[#647891]">Private voice-agent training foundation · built from privacy-safe historical outcomes while Sarvam remains untouched.</p>
                </div>
              </div>
            </div>
            <div className="grid min-w-[280px] grid-cols-2 gap-2">
              <StatusTile label="Private calling" value={config.outboundEnabled ? "Enabled" : "Disabled"} tone={config.outboundEnabled ? "red" : "amber"} />
              <StatusTile label="Sarvam fallback" value="Protected" tone="green" />
              <StatusTile label="Raw transcript" value="Not stored" />
              <StatusTile label="Current phase" value="2 / 11" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <p className="text-[10px] font-black text-emerald-900">Sarvam production calling remains independent.</p>
              <p className="mt-0.5 text-[9px] leading-4 text-emerald-800/80">Phase 2 only reads normalized historical outcomes and writes curated examples into the isolated private training table. It does not dispatch calls, alter Sarvam attempts, or enable private telephony.</p>
            </div>
          </div>
        </section>

        {stageState === "success" ? (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-[9px] font-semibold text-blue-800">
            Dataset staging finished: <strong>{staged ?? "0"}</strong> new examples staged · {skipped ?? "0"} existing candidates skipped · {screenedOut ?? "0"} low-signal candidates screened out.
          </section>
        ) : null}
        {stageState === "failed" ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[9px] font-semibold text-red-800">{stageError ?? "Training-library staging failed."}</section>
        ) : null}

        <section id="training-library" className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SectionHeading icon={Database} title="Training Library" subtitle="Curated from normalized historical call outcomes; raw transcripts are not copied into the private dataset." />
            <form action="/api/system/private-voice/training-library/stage" method="post" className="flex items-center gap-2">
              <input type="hidden" name="limit" value="200" />
              <button type="submit" className="h-9 rounded-xl bg-[#102A56] px-4 text-[8.5px] font-black text-white shadow-[0_8px_20px_rgba(16,42,86,.15)] hover:bg-[#17386e]">
                Stage next 200 eligible calls
              </button>
            </form>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Kpi label="Historical attempts" value={library.sourceTotal} />
            <Kpi label="Eligible source" value={library.eligibleSource} tone="blue" />
            <Kpi label="Auto excluded" value={library.autoExcludedSource} tone="amber" />
            <Kpi label="Staged total" value={library.stagedTotal} tone="green" />
            <Kpi label="Training" value={library.splits.training} />
            <Kpi label="Validation" value={library.splits.validation} />
            <Kpi label="Permanent test" value={library.splits.test} />
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_.82fr]">
            <div className="overflow-hidden rounded-2xl border border-[#E4EAF2]">
              <div className="grid grid-cols-[90px_90px_120px_1fr] gap-2 bg-[#F7F9FC] px-3 py-2 text-[7.5px] font-black uppercase tracking-[.06em] text-[#7B8CA1]">
                <span>Split</span><span>Status</span><span>Disposition</span><span>Redacted conversation summary</span>
              </div>
              {library.recent.length ? library.recent.map((example) => (
                <div key={example.id} className="grid grid-cols-[90px_90px_120px_1fr] gap-2 border-t border-[#EDF1F6] px-3 py-2.5 text-[8px] text-[#516982]">
                  <span className="font-black text-[#3156B8]">{example.split ?? "—"}</span>
                  <span className="font-semibold">{example.status}</span>
                  <span className="font-semibold">{outcomeValue(example.target_outcome, "disposition")}</span>
                  <span className="line-clamp-2 leading-4">{outcomeValue(example.target_outcome, "conversation_summary")}</span>
                </div>
              )) : (
                <div className="px-4 py-8 text-center text-[9px] text-[#8091A5]">No examples staged yet. Use the staging action to create privacy-redacted draft candidates.</div>
              )}
            </div>

            <div className="space-y-2">
              <RuleCard icon={CheckCircle2} title="Eligible source rule" text="Completed + connected + completed provider result, at least 20 seconds, persisted call summary and structured disposition." />
              <RuleCard icon={ShieldCheck} title="Privacy rule" text="Customer name, mobile, RC-like values and long identifiers are redacted before a training example is written. Raw transcripts are not persisted by the current Sarvam workflow." />
              <RuleCard icon={Split} title="Stable split rule" text="Deterministic 70% training · 15% validation · 15% permanent-test candidate split based on the source attempt UUID." />
              <RuleCard icon={PhoneCall} title="Low-signal screen" text="Empty/failed/busy/non-connected calls are excluded. Generic no-response/no-audio no-decision summaries are screened from training candidates." />
            </div>
          </div>
        </section>

        <div className="grid gap-3 xl:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
            <SectionHeading icon={Layers3} title="Rollout roadmap" subtitle="Progress remains gated, measurable and reversible." />
            <div className="mt-4 space-y-2">
              {phases.map(([number, title, state, description]) => (
                <div key={number} className="grid grid-cols-[38px_1fr_auto] items-start gap-3 rounded-xl border border-[#E7EDF4] bg-[#FBFCFE] px-3 py-2.5">
                  <div className={`grid h-8 w-8 place-items-center rounded-xl text-[9px] font-black ${state === "Current" ? "bg-[#102A56] text-white" : "bg-white text-[#637892] ring-1 ring-[#DDE6F0]"}`}>{number}</div>
                  <div><p className="text-[9.5px] font-black text-[#263C59]">{title}</p><p className="mt-0.5 text-[8.5px] leading-4 text-[#74869D]">{description}</p></div>
                  <span className={`mt-1 rounded-full px-2 py-0.5 text-[7px] font-black ${state === "Complete" ? "bg-emerald-100 text-emerald-700" : state === "Current" ? "bg-violet-100 text-violet-700" : state === "Next" ? "bg-[#EEF4FF] text-[#3156B8]" : "bg-slate-100 text-slate-500"}`}>{state}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
            <SectionHeading icon={BrainCircuit} title="Phase 2 realization" subtitle="The current production store has outcomes and summaries, not raw conversation turns." />
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[8.5px] leading-4 text-amber-900">
              Historical Sarvam attempts persist normalized disposition, interest, objection, follow-up and call summary, but intentionally do not persist raw transcripts. This library therefore builds behavior/outcome examples from structured summaries now; any larger transcript corpus must later enter through an explicit privacy-reviewed import pipeline rather than being inferred from missing data.
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <FutureCard icon={Database} title="Transcript import" text="Separate privacy-reviewed source pipeline" />
              <FutureCard icon={FlaskConical} title="Human review" text="Approve / exclude / relabel examples" />
              <FutureCard icon={Workflow} title="Dataset versions" text="Freeze reproducible training releases" />
              <FutureCard icon={BrainCircuit} title="Evaluation harness" text="Phase 3 agent replay against permanent test" />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }: { icon: typeof BrainCircuit; title: string; subtitle: string }) {
  return <div className="flex items-start gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F0F4FA] text-[#3156B8]"><Icon className="h-4 w-4" /></span><div><h2 className="text-[10px] font-black text-[#263C59]">{title}</h2><p className="mt-0.5 text-[8px] leading-4 text-[#8292A6]">{subtitle}</p></div></div>;
}

function StatusTile({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "amber" | "green" | "red" }) {
  const classes = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : tone === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-[#DDE6F0] bg-white/85 text-[#37506D]";
  return <div className={`rounded-xl border px-3 py-2 ${classes}`}><p className="text-[7px] font-black uppercase tracking-[.06em] opacity-65">{label}</p><p className="mt-0.5 text-[9px] font-black">{value}</p></div>;
}

function Kpi({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "blue" | "green" | "amber" }) {
  const classes = tone === "blue" ? "border-blue-200 bg-blue-50" : tone === "green" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-[#E3EAF2] bg-[#FBFCFE]";
  return <div className={`rounded-xl border px-3 py-2.5 ${classes}`}><p className="text-[7px] font-black uppercase tracking-[.055em] text-[#7C8DA2]">{label}</p><p className="mt-1 text-[16px] font-black tracking-[-.03em] text-[#213A59]">{value.toLocaleString("en-IN")}</p></div>;
}

function RuleCard({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return <div className="rounded-xl border border-[#E7EDF4] bg-[#FBFCFE] p-3"><div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-[#3156B8]" /><p className="text-[8.5px] font-black text-[#334D6B]">{title}</p></div><p className="mt-1.5 text-[8px] leading-4 text-[#75879C]">{text}</p></div>;
}

function FutureCard({ icon: Icon, title, text }: { icon: typeof Database; title: string; text: string }) {
  return <div className="rounded-xl border border-[#E7EDF4] bg-[#FBFCFE] p-3"><div className="flex items-center justify-between"><Icon className="h-4 w-4 text-[#3156B8]" /><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[7px] font-black text-slate-500">Planned</span></div><p className="mt-2 text-[9px] font-black text-[#2B415E]">{title}</p><p className="mt-1 text-[8px] text-[#7A8BA0]">{text}</p></div>;
}
