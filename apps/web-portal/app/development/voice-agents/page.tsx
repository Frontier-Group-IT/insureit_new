import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bot, IndianRupee, Mic2, ShieldCheck } from "lucide-react";

import { AppShell, Card, PageHeader } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";

const agents = [
  {
    name: "ChatGPT Realtime Agent",
    provider: "OpenAI",
    href: "/partner/renewals/voice-lab",
    description: "Current working INSUREIT renewal Voice Lab. Kept unchanged as the benchmark implementation.",
    icon: Bot,
    badge: "Current benchmark",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    name: "Sarvam Full Agent",
    provider: "Sarvam Voice Agents",
    href: "/development/voice-agents/sarvam",
    description: "India-focused full voice-agent stack for Hindi, Indian English and code-mixed browser testing.",
    icon: Mic2,
    badge: "New benchmark",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
] as const;

export default async function VoiceAgentsDevelopmentPage() {
  const profile = await requireCapability("manage_system", "approve");
  if (profile.role !== "it_super_user") redirect("/access-denied");

  return (
    <AppShell title="Voice Agents">
      <PageHeader
        title="Voice Agents"
        description="IT Super User benchmark workspace for comparing voice quality, latency, naturalness and operating cost without changing the existing OpenAI implementation."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((agent, index) => {
          const Icon = agent.icon;
          return (
            <Card key={agent.name} className="group relative overflow-hidden">
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#071D49] text-white shadow-sm"><Icon className="h-5 w-5" /></span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Agent {index + 1} · {agent.provider}</p>
                      <h2 className="mt-0.5 text-base font-semibold tracking-[-0.02em] text-slate-900">{agent.name}</h2>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${agent.badgeClass}`}>{agent.badge}</span>
                </div>

                <p className="mt-4 min-h-12 text-xs leading-5 text-slate-600">{agent.description}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Synthetic test data</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1.5"><IndianRupee className="h-3.5 w-3.5" /> Cost benchmark</span>
                </div>

                <Link href={agent.href} prefetch={false} className="mt-5 inline-flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-[#071D49] transition hover:border-[#9CB1CF] hover:bg-slate-50">
                  Open {agent.name} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <p className="text-xs leading-5 text-slate-600"><strong className="text-slate-900">Comparison rule:</strong> test both agents against the same synthetic renewal scenario and record the same measures—voice clarity, pronunciation, pacing, interruption handling, first-response latency and cost per connected minute. Do not connect either benchmark to live customers or telephony from this workspace.</p>
      </Card>
    </AppShell>
  );
}
