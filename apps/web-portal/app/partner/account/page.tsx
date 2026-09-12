import Link from "next/link";
import { ArrowRight, FileText, GraduationCap, LayoutGrid, LifeBuoy, ShieldCheck, UserRound, UsersRound } from "lucide-react";
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
  const partnerCode = intermediary?.partner_code || "—";
  const accountCode = intermediary?.intermediary_code || partnerCode;

  return (
    <PartnerPortalShell title="Account">
      <div className="space-y-4 pb-4">
        <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-[#172846] sm:text-[24px]">{identity.display_name}</h1>

        <section className="grid overflow-hidden rounded-xl border border-[#DCE5F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)] sm:grid-cols-2 xl:grid-cols-4">
          <AccountMetric
            label="Partner Family"
            value={intermediary?.partner_name || "—"}
            icon={UsersRound}
            iconClassName="bg-[#EAF3FF] text-[#2563EB]"
          />
          <AccountMetric
            label="Partner Code"
            value={partnerCode}
            icon={FileText}
            iconClassName="bg-[#E7F8F0] text-[#16A36A]"
          />
          <AccountMetric
            label="Portal Status"
            value="Active"
            icon={ShieldCheck}
            iconClassName="bg-[#F0E9FF] text-[#7650D8]"
          />
          <AccountMetric
            label="Access Type"
            value={humanize(scope.scope_mode)}
            icon={LayoutGrid}
            iconClassName="bg-[#FFF2E5] text-[#F28A19]"
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
          <div className="flex items-center gap-3 border-b border-[#E4EAF2] px-4 py-3 sm:px-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#EAF3FF] text-[#2563EB]">
              <FileText className="h-5 w-5" />
            </span>
            <h2 className="text-[14px] font-extrabold text-[#172846]">Account Overview</h2>
            <div className="ml-auto border-l border-[#DCE5F0] pl-5 text-right">
              <p className="text-[9px] font-medium text-[#7A8AA2]">Partner account</p>
              <p className="mt-0.5 text-[12px] font-extrabold text-[#172846]">{accountCode}</p>
            </div>
          </div>

          <div className="mx-4 overflow-hidden rounded-xl border border-[#E1E7EF] sm:mx-5">
            <AccountAction href="/partner/profile" icon={UserRound} title="Profile & Registration" />
            <AccountAction href="/partner/account/registration" icon={GraduationCap} title="Registration & Training" />
            <AccountAction href="/partner/support" icon={LifeBuoy} title="Support" />
          </div>

          <div className="mx-4 mt-3 flex items-start gap-3 border-t border-[#E4EAF2] px-1 py-4 sm:mx-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-[12px] font-extrabold text-[#172846]">Account access</h3>
              <p className="mt-1 text-[10px] font-medium leading-5 text-[#74839A]">Your access is based on your Partner profile and linked business. Registration and training are available from this account.</p>
            </div>
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function AccountMetric({ label, value, icon: Icon, iconClassName }: { label: string; value: string; icon: typeof UsersRound; iconClassName: string }) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 border-b border-[#E8EDF3] px-4 py-3 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(n+3)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${iconClassName}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[7.5px] font-black uppercase tracking-[0.08em] text-[#6A7A90]">{label}</p>
        <p className="mt-1 truncate text-[14px] font-extrabold text-[#172846]">{value}</p>
      </div>
    </div>
  );
}

function AccountAction({ href, icon: Icon, title }: { href: string; icon: typeof UserRound; title: string }) {
  return (
    <Link href={href} className="group flex min-h-[62px] items-center gap-3 border-b border-[#E6ECF3] px-2 py-2.5 transition hover:bg-[#FAFCFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 last:border-b-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#111A35] text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-[11.5px] font-extrabold text-[#172846]">{title}</span>
      <ArrowRight className="h-4 w-4 text-[#315A91] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
