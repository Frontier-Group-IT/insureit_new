import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";

import { AppShell, Card, PageHeader } from "@/components/shell";
import SarvamVoiceAgentEmbed from "@/components/development/sarvam-voice-agent-embed";
import { requireCapability } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";

const SAMPLE_PROSPECT = [
  ["Customer", "Rajesh Sharma"],
  ["Vehicle", "Mahindra Scorpio N"],
  ["Registration", "MP20 AB 1234"],
  ["Current insurer", "ICICI Lombard"],
  ["Policy expiry", "24 Sep 2026"],
  ["Previous IDV", "About ₹14.2 lakh"],
  ["Previous premium", "₹19,450"],
] as const;

export default async function SarvamVoiceAgentDevelopmentPage() {
  const profile = await requireCapability("manage_system", "approve");
  if (profile.role !== "it_super_user") redirect("/access-denied");

  const embedSnippet = process.env.SARVAM_VOICE_AGENT_EMBED_SNIPPET?.trim() || null;

  return (
    <AppShell title="Sarvam Voice Agent">
      <PageHeader
        title="Sarvam Full Voice Agent"
        description="Independent Sarvam Voice Agents benchmark. The existing ChatGPT Realtime lab remains unchanged."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/development/voice-agents" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-300">
              <ArrowLeft className="h-4 w-4" /> Voice Agents
            </Link>
            <a href="https://indus.sarvam.ai/samvaad" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#071D49] px-3 text-xs font-semibold text-white hover:bg-[#102B62]">
              Sarvam Console <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.7fr)]">
        <Card>
          <SarvamVoiceAgentEmbed embedSnippet={embedSnippet} />
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Benchmark boundaries</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">Browser role-play only. Use synthetic data. Do not collect OTPs, payment credentials, Aadhaar/PAN, passwords, or bank details. The agent must not invent premiums, IDV, NCB, discounts, add-ons, coverage or insurer terms.</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Same renewal scenario</h2>
            <p className="mt-1 text-xs text-slate-500">Use the same prospect as the OpenAI lab so voice quality, latency and cost can be compared fairly.</p>
            <dl className="mt-4 divide-y divide-slate-100 text-xs">
              {SAMPLE_PROSPECT.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] gap-3 py-2.5">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-semibold text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Sarvam agent configuration</h2>
            <div className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
              <p><strong className="text-slate-800">Role:</strong> INSUREIT insurance renewal assistant.</p>
              <p><strong className="text-slate-800">Style:</strong> natural Indian English/Hindi/Hinglish, short turns, interruption-friendly, clear numbers and insurance terms.</p>
              <p><strong className="text-slate-800">Voice:</strong> choose and tune the speaker, speed, pitch and pronunciation dictionary in Sarvam Voice Agents.</p>
              <p><strong className="text-slate-800">Web deployment:</strong> commit/test the agent, enable the Web channel, then use the official Embed snippet. Sarvam documents Web as a supported voice channel and provides the embed snippet from Deploy with Code.</p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
