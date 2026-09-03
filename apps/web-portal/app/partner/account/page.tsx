import Link from "next/link";
import { ArrowRight, GraduationCap, LifeBuoy, ShieldCheck, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
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
      <div className="space-y-7">
        <PartnerPageHeader
          eyebrow="Partner Account"
          title={identity.display_name}
          description={intermediary ? humanize(intermediary.intermediary_type) + " · " + (intermediary.intermediary_code || "Code not recorded") : "Partner workspace"}
        />
        <PartnerMetricStrip
          items={[
            { label: "Partner Family", value: intermediary?.partner_name || "—" },
            { label: "Partner Code", value: intermediary?.partner_code || "—" },
            { label: "Portal Status", value: "Active" },
            { label: "Commercial Scope", value: humanize(scope.scope_mode) },
          ]}
        />

        <section className="grid border-y border-[#DCE4ED] lg:grid-cols-3">
          <AccountAction
            href="/partner/profile"
            icon={UserRound}
            title="Profile & Registration"
            text="View Partner identity, registration codes and commercial access."
          />
          <AccountAction
            href="/partner/account/registration"
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

        <section className="py-1">
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

function AccountAction({ href, icon: Icon, title, text }: { href: string; icon: typeof UserRound; title: string; text: string }) {
  return (
    <Link href={href} className="group flex min-h-[92px] items-center gap-4 border-b border-[#E0E7EF] px-1 py-4 transition hover:bg-white/70 lg:border-b-0 lg:border-r lg:px-4 lg:last:border-r-0">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#111A35] text-white"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[12px] font-extrabold text-[#172846]">{title}</span><span className="mt-1 block text-[10px] font-medium leading-4 text-[#74839A]">{text}</span></span>
      <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
