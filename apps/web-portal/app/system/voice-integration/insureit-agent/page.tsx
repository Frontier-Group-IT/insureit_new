import { redirect } from "next/navigation";
import {
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  Database,
  FlaskConical,
  Layers3,
  LockKeyhole,
  Network,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getPrivateVoiceRuntimeConfig } from "@/lib/private-voice/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const phases = [
  ["0", "Baseline & isolation", "Complete", "Working Sarvam path documented and protected as an independent fallback."],
  ["1", "Private runtime foundation", "Current", "Isolated schema, provider contracts and independent configuration boundaries."],
  ["2", "Training & evaluation data", "Next", "Curate historical calls into training, validation and permanent test datasets."],
  ["3–5", "Agent brain & tools", "Planned", "Text agent, deterministic state machine, memory and controlled business tools."],
  ["6–7", "Speech & real-time gateway", "Planned", "Provider-neutral STT/TTS/telephony adapters, streaming audio and barge-in."],
  ["8–11", "Shadow → pilot → A/B", "Planned", "Shadow evaluation, internal calls, controlled customers and measured rollout."],
] as const;

const isolation = [
  ["Private campaign state", "private_voice_campaigns / members"],
  ["Private call state", "private_voice_attempts / events"],
  ["Conversation state", "private_voice_sessions / turns"],
  ["Agent versions", "private_voice_agent_versions"],
  ["Training data", "private_voice_training_examples"],
  ["Evaluation data", "private_voice_evaluations"],
] as const;

const providerContracts = [
  ["Telephony", "PrivateVoiceTelephonyProvider"],
  ["Speech to text", "PrivateVoiceSpeechToTextProvider"],
  ["Agent / LLM", "PrivateVoiceLanguageModelProvider"],
  ["Text to speech", "PrivateVoiceTextToSpeechProvider"],
] as const;

export default async function InsureitAgentPage() {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    redirect("/access-denied");
  }

  const config = getPrivateVoiceRuntimeConfig();

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
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.08em] text-blue-700">
                  <CircleDashed className="h-3 w-3" /> Phase 1 · foundation
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#102A56] text-white shadow-[0_10px_24px_rgba(16,42,86,.18)]">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-[20px] font-black tracking-[-.035em] text-[#142B50]">Insureit Agent</h1>
                  <p className="mt-0.5 text-[10px] leading-5 text-[#647891]">Private voice-agent foundation · isolated from the working Sarvam managed-agent system.</p>
                </div>
              </div>
            </div>
            <div className="grid min-w-[280px] grid-cols-2 gap-2">
              <StatusTile label="Private calling" value={config.outboundEnabled ? "Enabled" : "Disabled"} tone={config.outboundEnabled ? "red" : "amber"} />
              <StatusTile label="Sarvam fallback" value="Protected" tone="green" />
              <StatusTile label="Workspace flag" value={config.workspaceEnabled ? "Enabled" : "Off by default"} />
              <StatusTile label="Current phase" value="1 / 11" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <p className="text-[10px] font-black text-emerald-900">Hard isolation remains in force.</p>
              <p className="mt-0.5 text-[9px] leading-4 text-emerald-800/80">Phase 1 adds private contracts, configuration namespace and isolated schema only. No provider implementation is registered and no private outbound call can start from this workspace.</p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 xl:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
            <SectionHeading icon={Layers3} title="Rollout roadmap" subtitle="Progression stays gated and reversible." />
            <div className="mt-4 space-y-2">
              {phases.map(([number, title, state, description]) => (
                <div key={number} className="grid grid-cols-[38px_1fr_auto] items-start gap-3 rounded-xl border border-[#E7EDF4] bg-[#FBFCFE] px-3 py-2.5">
                  <div className={`grid h-8 w-8 place-items-center rounded-xl text-[9px] font-black ${state === "Current" ? "bg-[#102A56] text-white" : "bg-white text-[#637892] ring-1 ring-[#DDE6F0]"}`}>{number}</div>
                  <div>
                    <p className="text-[9.5px] font-black text-[#263C59]">{title}</p>
                    <p className="mt-0.5 text-[8.5px] leading-4 text-[#74869D]">{description}</p>
                  </div>
                  <span className={`mt-1 rounded-full px-2 py-0.5 text-[7px] font-black ${state === "Complete" ? "bg-emerald-100 text-emerald-700" : state === "Current" ? "bg-blue-100 text-blue-700" : state === "Next" ? "bg-[#EEF4FF] text-[#3156B8]" : "bg-slate-100 text-slate-500"}`}>{state}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
            <SectionHeading icon={Database} title="Private data boundary" subtitle="No private runtime writes into Sarvam production state." />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {isolation.map(([label, table]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-[#E7EDF4] px-3 py-2.5">
                  <span className="text-[8.5px] font-black text-[#536A84]">{label}</span>
                  <span className="max-w-[58%] truncate rounded-lg bg-[#F3F6FA] px-2 py-1 font-mono text-[7.5px] text-[#60738B]">{table}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[8.5px] leading-4 text-amber-800">
              Schema is prepared as a migration but Phase 1 does not itself authorize live calling, provider credentials or customer exposure.
            </div>
          </section>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
            <SectionHeading icon={Network} title="Provider-neutral contracts" subtitle="Business logic will not be hard-wired to a single vendor." />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {providerContracts.map(([label, contract]) => (
                <div key={contract} className="rounded-xl border border-[#E7EDF4] bg-[#FBFCFE] p-3">
                  <p className="text-[8px] font-black uppercase tracking-[.06em] text-[#8292A6]">{label}</p>
                  <p className="mt-1.5 break-all font-mono text-[8px] font-bold text-[#3156B8]">{contract}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
            <SectionHeading icon={Workflow} title="Private configuration boundary" subtitle="Independent flags default to OFF and do not reuse Sarvam switches." />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <ConfigRow label="Workspace" value={config.workspaceEnabled ? "ON" : "OFF"} />
              <ConfigRow label="Outbound" value={config.outboundEnabled ? "ON" : "OFF"} />
              <ConfigRow label="Shadow mode" value={config.shadowEnabled ? "ON" : "OFF"} />
              <ConfigRow label="Telephony" value={config.telephonyProvider} />
              <ConfigRow label="STT" value={config.sttProvider} />
              <ConfigRow label="Agent / LLM" value={config.llmProvider} />
              <ConfigRow label="TTS" value={config.ttsProvider} />
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_4px_18px_rgba(31,55,86,.045)]">
          <SectionHeading icon={FlaskConical} title="Next: Training Library" subtitle="Phase 2 will turn selected historical calls into a privacy-safe training and evaluation corpus." />
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <FutureCard icon={Database} title="Training" text="Approved examples only" />
            <FutureCard icon={CheckCircle2} title="Validation" text="Tuning feedback set" />
            <FutureCard icon={BrainCircuit} title="Permanent test" text="Never used for training" />
            <FutureCard icon={PhoneCall} title="Excluded" text="Failures, empty calls, bad examples" />
          </div>
        </section>
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

function ConfigRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E7EDF4] bg-[#FBFCFE] px-3 py-2.5"><span className="text-[8px] font-black text-[#667A92]">{label}</span><span className="rounded-full bg-white px-2 py-0.5 text-[7.5px] font-black uppercase text-[#3156B8] ring-1 ring-[#E0E7F0]">{value}</span></div>;
}

function FutureCard({ icon: Icon, title, text }: { icon: typeof Database; title: string; text: string }) {
  return <div className="rounded-xl border border-[#E7EDF4] bg-[#FBFCFE] p-3"><div className="flex items-center justify-between"><Icon className="h-4 w-4 text-[#3156B8]" /><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[7px] font-black text-slate-500">Phase 2</span></div><p className="mt-2 text-[9px] font-black text-[#2B415E]">{title}</p><p className="mt-1 text-[8px] text-[#7A8BA0]">{text}</p></div>;
}
