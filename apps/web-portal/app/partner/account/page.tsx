import Link from "next/link";
import { ArrowRight, GraduationCap, LifeBuoy, ShieldCheck, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebSession } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PartnerAccountPage() {
  const { identity, scope } = await getPartnerWebSession();
  const intermediary = identity.actor_kind === "intermediary" ? identity : null;

  return (
    <PartnerPortalShell title="Account">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-[26px] border border-[#D7E0EC] bg-white shadow-[0_16px_45px_rgba(34,56,89,.07)]">
          <div className="bg-[#111A35] px-5 py-6 text-white sm:px-6">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/60">Partner Account</p>
            <h2 className="mt-1 text-[23px] font-extrabold tracking-[-0.025em]">{identity.display_name}</h2>
            <p className="mt-1 text-[10.5px] font-medium text-white/65">{intermediary ? humanize(intermediary.intermediary_type) + " · " + (intermediary.intermediary_code || "Code not recorded") : "Partner workspace"}</p>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            <Info label="Partner Family" value={intermediary?.partner_name || "—"} />
            <Info label="Partner Code" value={intermediary?.partner_code || "—"} />
            <Info label="Portal Status" value="Active" />
            <Info label="Commercial Scope" value={humanize(scope.scope_mode)} />
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          <AccountAction
            href="/partner/profile"
            icon={UserRound}
            title="Profile & Registration"
            text="View Partner identity, registration codes and commercial access."
          />
          <AccountAction
            href="/intermediary-portal"
            icon={GraduationCap}
            title="Registration & Training"
            text="Open onboarding, training, examination, agreement and IIB registration."
          />
          <AccountAction
            href="/partner/support"
            icon={LifeBuoy}
            title="Support"
            text="Contact your relationship owner and review Operations workload."
          />
        </section>

        <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><ShieldCheck className="h-4 w-4" /></span>
            <div>
              <h3 className="text-[14px] font-extrabold text-[#172846]">Authorized Partner access</h3>
              <p className="mt-1 text-[10.5px] font-medium leading-5 text-[#74839A]">This website follows the same Partner family and commercial scope as INSUREIT Partner. Registration and qualification actions remain on the existing secure portal until their dedicated Partner-scoped account contract is migrated.</p>
            </div>
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[#E6ECF3] px-5 py-4 sm:border-r sm:px-6 xl:border-b-0 xl:last:border-r-0"><p className="text-[8.5px] font-black uppercase tracking-[0.1em] text-[#7A899F]">{label}</p><p className="mt-1.5 truncate text-[10.5px] font-extrabold text-[#203653]">{value}</p></div>;
}

function AccountAction({ href, icon: Icon, title, text }: { href: string; icon: typeof UserRound; title: string; text: string }) {
  return (
    <Link href={href} className="group flex min-h-[124px] items-center gap-4 rounded-[24px] border border-[#D7E0EC] bg-white p-5 shadow-[0_12px_35px_rgba(34,56,89,.06)] transition hover:-translate-y-0.5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#111A35] text-white"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[12px] font-extrabold text-[#172846]">{title}</span><span className="mt-1 block text-[10px] font-medium leading-4 text-[#74839A]">{text}</span></span>
      <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
