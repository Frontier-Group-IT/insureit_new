import Link from "next/link";
import { ArrowLeft, Building2, Network, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebSession } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "IP";
}

export default async function PartnerProfilePage() {
  const { identity, scope } = await getPartnerWebSession();
  const intermediary = identity.actor_kind === "intermediary" ? identity : null;

  return (
    <PartnerPortalShell title="Profile">
      <div className="space-y-4">
        <Link href="/partner/account" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653]"><ArrowLeft className="h-3.5 w-3.5" /> Account</Link>

        <section className="overflow-hidden rounded-[26px] border border-[#D7E0EC] bg-white shadow-[0_16px_45px_rgba(34,56,89,.07)]">
          <div className="flex items-center gap-4 bg-[#111A35] px-5 py-6 text-white sm:px-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-white/10 text-[15px] font-black">{initials(identity.display_name)}</span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/55">Profile & Registration</p>
              <h2 className="mt-1 truncate text-[23px] font-extrabold tracking-[-0.025em]">{identity.display_name}</h2>
              <p className="mt-1 text-[10.5px] font-medium text-white/65">{intermediary ? humanize(intermediary.intermediary_type) : "Partner account"}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2">
            <Detail label="Intermediary Code" value={intermediary?.intermediary_code || "Not recorded"} />
            <Detail label="Intermediary Type" value={intermediary ? humanize(intermediary.intermediary_type) : "Not recorded"} />
            <Detail label="Partner Family" value={intermediary?.partner_name || "Not recorded"} />
            <Detail label="Partner Code" value={intermediary?.partner_code || "Not recorded"} />
            <Detail label="Portal Status" value="Active" />
            <Detail label="Scope Mode" value={humanize(scope.scope_mode)} />
          </div>
        </section>

        <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
          <h3 className="text-[16px] font-extrabold text-[#152746]">Commercial Access</h3>
          <p className="mt-1 text-[10.5px] font-medium text-[#74839A]">The identifiers below are returned by the same backend scope contract used by the Partner app.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ScopeMetric icon={Building2} label="Partner Families" value={scope.partner_ids.length} />
            <ScopeMetric icon={UsersRound} label="Intermediaries" value={scope.intermediary_ids.length} />
            <ScopeMetric icon={Network} label="Groups" value={scope.group_ids.length} />
            <ScopeMetric icon={ShieldCheck} label="Access" value={humanize(scope.scope_mode)} />
          </div>
        </section>

        <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><UserRound className="h-4 w-4" /></span>
            <div>
              <h3 className="text-[13px] font-extrabold text-[#172846]">Registration and qualification</h3>
              <p className="mt-1 text-[10px] font-medium leading-4 text-[#74839A]">Training, examination, agreement and IIB registration remain available through the secure Registration & Training workspace.</p>
              <Link href="/intermediary-portal" className="mt-3 inline-flex h-9 items-center rounded-xl bg-[#111A35] px-4 text-[10px] font-bold text-white">Open Registration & Training</Link>
            </div>
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-[58px] items-center justify-between gap-4 border-b border-[#E6ECF3] px-5 py-4 odd:sm:border-r sm:px-6"><p className="text-[9px] font-black uppercase tracking-[0.09em] text-[#7A899F]">{label}</p><p className="max-w-[62%] text-right text-[10.5px] font-extrabold text-[#203653]">{value}</p></div>;
}
function ScopeMetric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | number }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#3156B8]"><Icon className="h-4 w-4" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#75849A]">{label}</p><p className="mt-1 text-[16px] font-extrabold text-[#162746]">{value}</p></div></div>;
}
